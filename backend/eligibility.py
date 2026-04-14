"""
Role Eligibility Service — strict hard-filter for seeker↔job compatibility.

This is the SINGLE source of truth for role eligibility across the entire platform.
Every endpoint that connects seekers to jobs MUST call check_role_eligibility() first.

Design principles:
- Role category and specialty are SEPARATE concepts
- Strict matching by default — no implicit upgrades/downgrades
- Employer must explicitly opt-in to accept alternate role categories
- Ambiguous data → narrow matching, flag for review
"""
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# ── Canonical Role Taxonomy ──────────────────────────────────────────
# Each key is a canonical role category. Values are known aliases.
ROLE_TAXONOMY = {
    "CNA": [
        "cna", "certified nursing assistant", "nurse aide", "nursing assistant",
        "patient care tech", "patient care technician", "pct", "na",
        "nurse aide certified", "nursing aide", "patient care associate",
        "geriatric nursing assistant", "gna", "restorative aide",
    ],
    "LPN": [
        "lpn", "licensed practical nurse", "lvn", "licensed vocational nurse",
        "practical nurse", "vocational nurse",
    ],
    "RN": [
        "rn", "registered nurse", "bsn", "bsn-rn", "bsn rn",
        "adn", "adn-rn", "asn", "staff nurse", "charge nurse",
        "clinical nurse", "bedside nurse", "floor nurse",
    ],
    "NP": [
        "np", "nurse practitioner", "aprn", "advanced practice registered nurse",
        "arnp", "fnp", "anp", "agnp", "pmhnp", "acnp",
        "family nurse practitioner", "acute care nurse practitioner",
    ],
    "CRNA": [
        "crna", "certified registered nurse anesthetist", "nurse anesthetist",
    ],
    "PA": [
        "pa", "physician assistant", "pa-c", "physician associate",
    ],
    "RT": [
        "rt", "respiratory therapist", "rrt", "crt",
        "registered respiratory therapist", "certified respiratory therapist",
    ],
    "OT": [
        "ot", "occupational therapist", "otr", "otr/l",
        "occupational therapy assistant", "ota", "cota",
    ],
    "PT": [
        "pt", "physical therapist", "dpt", "physical therapy assistant", "pta",
    ],
    "ST": [
        "st", "speech therapist", "slp", "speech-language pathologist",
        "speech pathologist", "ccc-slp",
    ],
    "MEDICAL_ASSISTANT": [
        "ma", "medical assistant", "cma", "certified medical assistant",
        "clinical medical assistant", "rma",
    ],
    "PHLEBOTOMIST": [
        "phlebotomist", "phlebotomy technician", "cpti",
    ],
    "RADIOLOGY_TECH": [
        "rad tech", "radiologic technologist", "x-ray tech",
        "rt(r)", "radiology technician", "ct tech", "mri tech",
    ],
}

# Build reverse lookup: alias → canonical category
_ALIAS_MAP = {}
for category, aliases in ROLE_TAXONOMY.items():
    _ALIAS_MAP[category.lower()] = category
    for alias in aliases:
        _ALIAS_MAP[alias.lower().strip()] = category

# Canonical categories list
CANONICAL_ROLES = sorted(ROLE_TAXONOMY.keys())


def normalize_role(raw_title: str) -> Optional[str]:
    """
    Normalize a raw role/title string to a canonical role category.
    Returns None if the title cannot be resolved (ambiguous/unknown).
    
    Only looks at role indicators — does NOT use specialty to infer role.
    """
    if not raw_title:
        return None

    text = raw_title.lower().strip()

    # Direct lookup
    if text in _ALIAS_MAP:
        return _ALIAS_MAP[text]

    # Check if any alias appears as a substring (match longest first)
    # Sort aliases by length descending to prefer specific matches
    sorted_aliases = sorted(_ALIAS_MAP.keys(), key=len, reverse=True)
    for alias in sorted_aliases:
        # Only match if alias appears as a word boundary (not substring of another word)
        if alias in text:
            # Verify it's not a false positive (e.g., "crane" contains "rn")
            idx = text.index(alias)
            before = text[idx - 1] if idx > 0 else " "
            after = text[idx + len(alias)] if idx + len(alias) < len(text) else " "
            if not before.isalpha() and not after.isalpha():
                return _ALIAS_MAP[alias]

    return None


def normalize_role_from_specialty(specialty: str) -> Optional[str]:
    """
    Extract role category from a specialty string like 'Registered Nurse (RN) - ICU/Critical Care'.
    This is a FALLBACK — dedicated role field should be preferred.
    """
    if not specialty:
        return None

    text = specialty.lower().strip()

    # Check for parenthesized abbreviations first: "(RN)", "(CNA)", "(LPN)", etc.
    import re
    paren_match = re.search(r'\(([^)]+)\)', text)
    if paren_match:
        inner = paren_match.group(1).strip().lower()
        if inner in _ALIAS_MAP:
            return _ALIAS_MAP[inner]

    # Check for role keywords before dash (e.g., "Registered Nurse" part)
    before_dash = text.split("-")[0].strip()
    result = normalize_role(before_dash)
    if result:
        return result

    # Full text fallback
    return normalize_role(text)


def get_accepted_roles_for_job(job: dict) -> list:
    """
    Get the list of accepted role categories for a job.
    Uses explicit accepted_role_categories if set, otherwise defaults to primary_role_category only.
    """
    accepted = job.get("accepted_role_categories")
    if accepted and isinstance(accepted, list) and len(accepted) > 0:
        return [r.upper() for r in accepted]

    primary = job.get("primary_role_category")
    if primary:
        return [primary.upper()]

    # Fallback: try to derive from specialty
    derived = normalize_role_from_specialty(job.get("specialty", ""))
    if derived:
        return [derived]

    return []


def get_seeker_role(profile: dict) -> Optional[str]:
    """
    Get the seeker's canonical role category.
    Uses explicit normalized_role_category if set, otherwise derives from specialty.
    """
    explicit = profile.get("normalized_role_category")
    if explicit:
        return explicit.upper()

    # Fallback: derive from specialty
    return normalize_role_from_specialty(profile.get("specialty", ""))


def check_role_eligibility(seeker_profile: dict, job: dict) -> dict:
    """
    STRICT role eligibility check. Must pass before ANY scoring/ranking runs.
    
    Returns:
        {
            "eligible": bool,
            "reason": str or None,      # human-readable reason if ineligible
            "seeker_role": str or None,
            "job_roles": list,
            "log_reason": str or None,   # machine-readable for logging
        }
    
    Eligibility order:
    1. Role/category compatibility
    2. (Future: required license compatibility)
    3. (Future: credential minimum)
    4. (Future: location/work eligibility)
    """
    seeker_role = get_seeker_role(seeker_profile)
    job_roles = get_accepted_roles_for_job(job)

    result = {
        "seeker_role": seeker_role,
        "job_roles": job_roles,
    }

    # If seeker has no role, allow through with warning (incomplete profile)
    if not seeker_role:
        result["eligible"] = True
        result["reason"] = None
        result["log_reason"] = "seeker_role_unknown"
        return result

    # If job has no role requirements, allow through (legacy/incomplete data)
    if not job_roles:
        result["eligible"] = True
        result["reason"] = None
        result["log_reason"] = "job_roles_unknown"
        return result

    # STRICT CHECK: seeker's role must be in job's accepted categories
    if seeker_role in job_roles:
        result["eligible"] = True
        result["reason"] = None
        result["log_reason"] = None
        return result

    # INELIGIBLE
    result["eligible"] = False
    result["reason"] = f"This role requires {'/'.join(job_roles)} — your profile is {seeker_role}"
    result["log_reason"] = "role_mismatch"

    logger.info(
        "Role eligibility blocked: seeker_role=%s job_roles=%s job_id=%s",
        seeker_role, job_roles, job.get("id", "?")
    )

    return result
