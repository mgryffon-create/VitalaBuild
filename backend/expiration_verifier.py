"""
Expiration Date Verification — targeted extraction from document images/PDFs.
Uses the OpenAI SDK to extract expiration dates only.
NOT a full document parsing system.
"""
import os
import re
import json
import uuid
import base64
from datetime import datetime, timezone
from ai_provider import extract_json

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")

EXTRACTION_PROMPT = """You are a document expiration date extractor for healthcare compliance.

TASK: Look at this document image and extract ONLY the expiration date.

RULES:
- Look for fields labeled: "Expiration", "Expires", "Exp Date", "Valid Until", "Valid Through", "Expiry", "End Date"
- For licenses: look for "Expiration Date" field
- For certifications (BLS, ACLS, PALS): look for card expiration
- For IDs: look for "EXP" or expiration field
- Return the date in YYYY-MM-DD format
- If you find multiple dates, return the one that is clearly the EXPIRATION (not issue date, not DOB)
- If no expiration date is found, return null
- Do NOT guess or fabricate dates

Return ONLY valid JSON (no markdown, no explanation):
{"expiration_date": "YYYY-MM-DD" or null, "confidence": "high" or "medium" or "low", "source_text": "the text you found containing the date"}"""


def _normalize_date(date_str: str) -> str:
    """Try to normalize various date formats to YYYY-MM-DD."""
    if not date_str:
        return ""
    # Already in correct format
    if re.match(r"^\d{4}-\d{2}-\d{2}$", date_str):
        return date_str
    # Try common formats
    for fmt in ("%m/%d/%Y", "%m-%d-%Y", "%d/%m/%Y", "%B %d, %Y", "%b %d, %Y",
                "%m/%Y", "%Y/%m/%d", "%d-%m-%Y", "%Y%m%d"):
        try:
            dt = datetime.strptime(date_str.strip(), fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue
    return date_str


def _dates_match(user_date: str, parsed_date: str, tolerance_days: int = 31) -> bool:
    """Check if two dates match within tolerance (default 31 days for month-level precision)."""
    if not user_date or not parsed_date:
        return False
    try:
        u = datetime.strptime(user_date[:10], "%Y-%m-%d")
        p = datetime.strptime(parsed_date[:10], "%Y-%m-%d")
        return abs((u - p).days) <= tolerance_days
    except (ValueError, TypeError):
        return False


async def extract_expiration_from_file(file_bytes: bytes, content_type: str) -> dict:
    """
    Extract expiration date from a document file using GPT vision.
    Returns: {parsed_expiration_date, confidence, source_text, parse_error}
    """
    if not OPENAI_API_KEY:
        return {"parsed_expiration_date": None, "confidence": None, "parse_error": "LLM key not configured"}

    # Only process images and PDFs
    supported = ("image/jpeg", "image/png", "image/webp", "application/pdf",
                 "image/jpg", "image/heic")
    if content_type and content_type.lower() not in supported:
        return {"parsed_expiration_date": None, "confidence": None, "parse_error": f"Unsupported file type: {content_type}"}

    try:
        response = await extract_json(
            EXTRACTION_PROMPT, "Extract the expiration date from this document.",
            file_bytes=file_bytes, content_type=content_type,
        )

        # Parse the JSON response
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
            cleaned = re.sub(r"\s*```$", "", cleaned)

        parsed = json.loads(cleaned)
        raw_date = parsed.get("expiration_date")
        normalized = _normalize_date(raw_date) if raw_date else None

        return {
            "parsed_expiration_date": normalized,
            "confidence": parsed.get("confidence", "low"),
            "source_text": parsed.get("source_text"),
            "parse_error": None,
        }
    except json.JSONDecodeError:
        return {"parsed_expiration_date": None, "confidence": None, "parse_error": "Failed to parse LLM response"}
    except Exception as e:
        return {"parsed_expiration_date": None, "confidence": None, "parse_error": str(e)[:200]}


def determine_verification_status(
    user_expiration: str,
    parsed_result: dict,
) -> dict:
    """
    Compare user-entered expiration with parsed result and determine verification status.
    
    Returns: {verification_status, verification_notes, parsed_expiration_date}
    
    Statuses:
    - "verified" — parsed date matches user entry
    - "mismatch" — parsed date conflicts with user entry  
    - "unverified" — parse failed, using user entry only
    - "expired" — parsed or user date is in the past
    """
    parsed_date = parsed_result.get("parsed_expiration_date")
    parse_error = parsed_result.get("parse_error")
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    result = {"parsed_expiration_date": parsed_date}

    # Case 4: Parsed date is expired
    if parsed_date:
        try:
            if parsed_date < now_str:
                result["verification_status"] = "expired"
                result["verification_notes"] = f"Document expiration date ({parsed_date}) has passed"
                return result
        except (TypeError, ValueError):
            pass

    # Case: user entry is expired
    if user_expiration:
        try:
            if user_expiration[:10] < now_str:
                result["verification_status"] = "expired"
                result["verification_notes"] = f"User-entered expiration ({user_expiration[:10]}) has passed"
                return result
        except (TypeError, ValueError):
            pass

    # Case 3: Parse failed — keep user entry, mark unverified
    if not parsed_date:
        result["verification_status"] = "unverified"
        result["verification_notes"] = parse_error or "Could not extract expiration date from document"
        return result

    # Case 1: Match
    if _dates_match(user_expiration, parsed_date):
        result["verification_status"] = "verified"
        result["verification_notes"] = f"Expiration date verified ({parsed_date})"
        return result

    # Case 2: Mismatch
    result["verification_status"] = "mismatch"
    result["verification_notes"] = (
        f"User entered {user_expiration[:10] if user_expiration else 'none'}, "
        f"but document shows {parsed_date}"
    )
    return result
