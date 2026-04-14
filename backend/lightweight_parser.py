"""
Lightweight Document Parser — first-line verification for vault uploads.

Extracts text from PDFs and images using PyMuPDF (fitz) and basic string matching.
Detects:
- Expiration dates via regex + keyword proximity
- Credential/document type keywords (BLS, ACLS, RN, CNA, etc.)
- Holder name if reasonably detectable

Does NOT:
- Perform full OCR
- Guarantee extraction quality
- Replace the existing LLM-based verifier (that remains as fallback)

Conservative trust model: if uncertain → Needs Review or Unverified.
"""
import re
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Credential keywords to detect in extracted text
CREDENTIAL_KEYWORDS = {
    "bls": ["bls", "basic life support"],
    "acls": ["acls", "advanced cardiovascular life support", "advanced cardiac life support"],
    "pals": ["pals", "pediatric advanced life support"],
    "cpr": ["cpr", "cardiopulmonary resuscitation"],
    "rn": ["registered nurse", "rn license", "rn "],
    "cna": ["certified nursing assistant", "cna", "nurse aide"],
    "lpn": ["licensed practical nurse", "lpn"],
    "lvn": ["licensed vocational nurse", "lvn"],
    "dea": ["dea", "drug enforcement"],
    "npi": ["npi", "national provider identifier"],
}

# Keywords that appear near expiration dates
EXPIRATION_KEYWORDS = [
    "expir", "exp date", "exp.", "valid until", "valid through",
    "renewal", "renew", "expires on", "expiration date", "exp:",
    "valid thru", "not valid after",
]

# Date patterns (regex)
DATE_PATTERNS = [
    # MM/DD/YYYY or M/D/YYYY
    (r'\b(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})\b', "mdy"),
    # YYYY-MM-DD
    (r'\b(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})\b', "ymd"),
    # Month DD, YYYY (January 15, 2026)
    (r'\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b', "named_mdy"),
    # Mon DD, YYYY (Jan 15, 2026)
    (r'\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[.]?\s+(\d{1,2}),?\s+(\d{4})\b', "short_mdy"),
    # MM/DD/YY
    (r'\b(\d{1,2})[/\-](\d{1,2})[/\-](\d{2})\b', "mdy_short"),
    # MM/YYYY
    (r'\b(\d{1,2})[/\-](\d{4})\b', "my"),
]

MONTH_MAP = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
    "jan": 1, "feb": 2, "mar": 3, "apr": 4,
    "jun": 6, "jul": 7, "aug": 8, "sep": 9,
    "oct": 10, "nov": 11, "dec": 12,
}


def _parse_date_match(match_groups, fmt_type):
    """Convert regex match groups to YYYY-MM-DD string."""
    try:
        if fmt_type == "mdy":
            mm, dd, yyyy = match_groups
            return f"{int(yyyy):04d}-{int(mm):02d}-{int(dd):02d}"
        elif fmt_type == "ymd":
            yyyy, mm, dd = match_groups
            return f"{int(yyyy):04d}-{int(mm):02d}-{int(dd):02d}"
        elif fmt_type in ("named_mdy", "short_mdy"):
            month_str, dd, yyyy = match_groups
            mm = MONTH_MAP.get(month_str.lower().rstrip("."))
            if mm:
                return f"{int(yyyy):04d}-{mm:02d}-{int(dd):02d}"
        elif fmt_type == "mdy_short":
            mm, dd, yy = match_groups
            yyyy = 2000 + int(yy) if int(yy) < 80 else 1900 + int(yy)
            return f"{yyyy:04d}-{int(mm):02d}-{int(dd):02d}"
        elif fmt_type == "my":
            mm, yyyy = match_groups
            return f"{int(yyyy):04d}-{int(mm):02d}-01"
    except (ValueError, TypeError):
        pass
    return None


def _validate_date(date_str):
    """Check if a YYYY-MM-DD string is a valid date."""
    try:
        d = datetime.strptime(date_str, "%Y-%m-%d")
        # Reasonable date range: 1950-2099
        if 1950 <= d.year <= 2099 and 1 <= d.month <= 12 and 1 <= d.day <= 31:
            return True
    except ValueError:
        pass
    return False


def extract_text_from_bytes(file_bytes: bytes, content_type: str) -> str:
    """Extract text from file bytes using PyMuPDF (works for PDF and images with embedded text)."""
    text = ""
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(stream=file_bytes, filetype=_fitz_filetype(content_type))
        for page in doc:
            text += page.get_text() + "\n"
        doc.close()
    except Exception as e:
        logger.debug(f"Text extraction failed: {e}")
    return text.strip()


def _fitz_filetype(content_type: str) -> str:
    """Map content_type to fitz filetype."""
    ct = (content_type or "").lower()
    if "pdf" in ct:
        return "pdf"
    if "png" in ct:
        return "png"
    if "jpeg" in ct or "jpg" in ct:
        return "jpeg"
    if "webp" in ct:
        return "webp"
    return "pdf"


def find_dates_in_text(text: str) -> list:
    """Find all valid dates in text with their surrounding context."""
    results = []
    for pattern, fmt_type in DATE_PATTERNS:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            date_str = _parse_date_match(match.groups(), fmt_type)
            if date_str and _validate_date(date_str):
                # Get surrounding context (50 chars before and after)
                start = max(0, match.start() - 50)
                end = min(len(text), match.end() + 50)
                context = text[start:end].strip()
                results.append({
                    "date": date_str,
                    "context": context,
                    "position": match.start(),
                })
    return results


def find_expiration_date(text: str) -> dict:
    """Find the most likely expiration date from extracted text.
    
    Strategy:
    1. Find all dates in text
    2. Score each date by proximity to expiration keywords
    3. Return the highest-scored date as the likely expiration
    
    Returns: {expiration_date, confidence, source_context}
    """
    if not text:
        return {"expiration_date": None, "confidence": None, "source_context": None}

    dates = find_dates_in_text(text)

    if not dates:
        return {"expiration_date": None, "confidence": None, "source_context": None}

    # Score each date by proximity to expiration keywords
    scored = []
    for d in dates:
        score = 0
        ctx = d["context"].lower()
        for kw in EXPIRATION_KEYWORDS:
            if kw in ctx:
                score += 10
        # Bonus if date is in the future (more likely to be expiration)
        try:
            dt = datetime.strptime(d["date"], "%Y-%m-%d")
            if dt > datetime.now():
                score += 3
        except ValueError:
            pass
        scored.append((score, d))

    scored.sort(key=lambda x: -x[0])
    best_score, best = scored[0]

    if best_score >= 10:
        confidence = "high"
    elif best_score >= 3:
        confidence = "medium"
    elif len(dates) == 1:
        # Only one date found — might be expiration by default
        confidence = "low"
    else:
        confidence = "low"

    return {
        "expiration_date": best["date"],
        "confidence": confidence,
        "source_context": best["context"][:100],
    }


def find_credential_keywords(text: str) -> list:
    """Find credential-related keywords in text."""
    if not text:
        return []
    text_lower = text.lower()
    found = []
    for key, patterns in CREDENTIAL_KEYWORDS.items():
        for pattern in patterns:
            if pattern in text_lower:
                found.append(key.upper())
                break
    return found


def find_name_in_text(text: str) -> str:
    """Attempt to find a person's name in text. Very conservative."""
    if not text:
        return None
    # Look for common label patterns
    name_patterns = [
        r"(?:Name|Holder|Issued\s+to|Provider|Candidate)[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)",
        r"(?:Name|Holder|Issued\s+to|Provider|Candidate)[:\s]+([A-Z][a-z]+ [A-Z]\. [A-Z][a-z]+)",
    ]
    for pattern in name_patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(1).strip()
    return None


def dates_match(user_date: str, parsed_date: str, tolerance_days: int = 31) -> bool:
    """Check if two dates match within tolerance."""
    if not user_date or not parsed_date:
        return False
    try:
        u = datetime.strptime(user_date[:10], "%Y-%m-%d")
        p = datetime.strptime(parsed_date[:10], "%Y-%m-%d")
        return abs((u - p).days) <= tolerance_days
    except (ValueError, TypeError):
        return False


def lightweight_verify(
    file_bytes: bytes,
    content_type: str,
    user_expiration: str,
    user_subtype: str,
    user_name: str = None,
) -> dict:
    """
    Run lightweight first-line verification on uploaded document.
    
    Returns:
    {
        verification_status: "verified" | "needs_review" | "unverified",
        verification_notes: str,
        parsed_expiration_date: str or None,
        detected_credentials: list,
        detected_name: str or None,
        extraction_quality: "good" | "partial" | "none",
        should_run_llm: bool,  # whether to also run GPT vision for deeper check
    }
    """
    result = {
        "verification_status": "unverified",
        "verification_notes": None,
        "parsed_expiration_date": None,
        "detected_credentials": [],
        "detected_name": None,
        "extraction_quality": "none",
        "should_run_llm": True,
    }

    # Step 1: Extract text
    text = extract_text_from_bytes(file_bytes, content_type)
    if not text or len(text) < 10:
        result["verification_notes"] = "No readable text detected in document"
        return result

    text_len = len(text)
    result["extraction_quality"] = "good" if text_len > 100 else "partial"

    # Step 2: Find credentials
    creds = find_credential_keywords(text)
    result["detected_credentials"] = creds

    # Step 3: Find name
    name = find_name_in_text(text)
    result["detected_name"] = name

    # Step 4: Find expiration date
    exp_result = find_expiration_date(text)
    parsed_exp = exp_result.get("expiration_date")
    exp_confidence = exp_result.get("confidence")
    result["parsed_expiration_date"] = parsed_exp

    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Step 5: Determine status

    # Check if parsed date is expired
    if parsed_exp:
        try:
            if parsed_exp < now_str:
                result["verification_status"] = "needs_review"
                result["verification_notes"] = f"Document expiration date ({parsed_exp}) appears to have passed"
                result["should_run_llm"] = False
                return result
        except (TypeError, ValueError):
            pass

    # Check if user-entered date is expired
    if user_expiration:
        try:
            if user_expiration[:10] < now_str:
                result["verification_status"] = "needs_review"
                result["verification_notes"] = f"Entered expiration ({user_expiration[:10]}) has passed"
                result["should_run_llm"] = False
                return result
        except (TypeError, ValueError):
            pass

    # If no parsed date found
    if not parsed_exp:
        # But we found credential keywords — partially useful
        if creds:
            result["verification_status"] = "unverified"
            result["verification_notes"] = f"Detected {', '.join(creds)} but no readable expiration date"
        else:
            result["verification_status"] = "unverified"
            result["verification_notes"] = "No expiration date or credential keywords detected"
        # Let LLM try deeper extraction
        return result

    # Compare dates
    if user_expiration and dates_match(user_expiration, parsed_exp):
        # Match! Check credential type too
        if user_subtype:
            subtype_lower = user_subtype.lower().replace("_", " ").replace("-", " ")
            type_match = any(
                kw.lower() in subtype_lower or subtype_lower in kw.lower()
                for kw in creds
            ) if creds else True  # If no creds detected, don't penalize

            if type_match and exp_confidence in ("high", "medium"):
                result["verification_status"] = "verified"
                result["verification_notes"] = f"Expiration date verified ({parsed_exp})"
                result["should_run_llm"] = False
                return result
            elif not type_match and creds:
                result["verification_status"] = "needs_review"
                result["verification_notes"] = (
                    f"Expiration date matches but document type ({', '.join(creds)}) "
                    f"may not match entered type ({user_subtype})"
                )
                result["should_run_llm"] = True
                return result

        # Date match with no subtype check needed
        if exp_confidence in ("high", "medium"):
            result["verification_status"] = "verified"
            result["verification_notes"] = f"Expiration date verified ({parsed_exp})"
            result["should_run_llm"] = False
            return result

        # Low confidence match — partial trust
        result["verification_status"] = "needs_review"
        result["verification_notes"] = f"Possible expiration date match ({parsed_exp}) — low confidence"
        return result

    elif user_expiration:
        # Date mismatch
        result["verification_status"] = "needs_review"
        result["verification_notes"] = (
            f"Entered expiration ({user_expiration[:10]}) may not match "
            f"document date ({parsed_exp})"
        )
        result["should_run_llm"] = True
        return result

    # No user expiration but we found a date
    result["parsed_expiration_date"] = parsed_exp
    result["verification_status"] = "unverified"
    result["verification_notes"] = f"Found date {parsed_exp} but no user expiration to compare"
    return result


def name_matches(user_name: str, detected_name: str) -> bool:
    """Conservative name matching."""
    if not user_name or not detected_name:
        return True  # Can't check, don't penalize
    # Normalize
    u_parts = set(user_name.lower().split())
    d_parts = set(detected_name.lower().split())
    # At least one name part must overlap
    return len(u_parts & d_parts) > 0
