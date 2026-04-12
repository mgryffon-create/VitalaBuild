"""
Onboarding & Vault Business Logic
Handles requirement generation, vault matching, and task creation.
"""
from datetime import datetime, timezone, timedelta
import uuid

# ==================== REQUIREMENT RULES ====================

# Role-based onboarding requirements
ROLE_REQUIREMENTS = {
    "CNA": [
        {"type": "government_id", "label": "Government ID", "assigned_to": "candidate", "fulfillment_source": "vault", "vault_match": {"category": "identity", "subtypes": ["drivers_license", "passport", "state_id"]}},
        {"type": "background_check", "label": "Background Check", "assigned_to": "admin", "fulfillment_source": "external_vendor"},
        {"type": "drug_screen", "label": "Drug Screen", "assigned_to": "candidate", "fulfillment_source": "external_vendor"},
        {"type": "license_verification", "label": "License Verification", "assigned_to": "admin", "fulfillment_source": "external_vendor", "vault_match": {"category": "license", "subtypes": ["CNA_license"]}},
        {"type": "fingerprinting", "label": "Fingerprinting", "assigned_to": "candidate", "fulfillment_source": "external_vendor"},
        {"type": "bls_certification", "label": "BLS Certification", "assigned_to": "candidate", "fulfillment_source": "vault", "vault_match": {"category": "certification", "subtypes": ["BLS", "CPR", "CPR_BLS"]}},
        {"type": "tb_screening", "label": "TB Screening", "assigned_to": "candidate", "fulfillment_source": "vault", "vault_match": {"category": "health_screen", "subtypes": ["TB_test", "QuantiFERON", "PPD"], "max_age_months": 12}},
        {"type": "vaccination_records", "label": "Vaccination Records", "assigned_to": "candidate", "fulfillment_source": "vault", "vault_match": {"category": "health_record", "subtypes": None}},
    ],
    "RN": [
        {"type": "government_id", "label": "Government ID", "assigned_to": "candidate", "fulfillment_source": "vault", "vault_match": {"category": "identity", "subtypes": ["drivers_license", "passport", "state_id"]}},
        {"type": "background_check", "label": "Background Check", "assigned_to": "admin", "fulfillment_source": "external_vendor"},
        {"type": "drug_screen", "label": "Drug Screen", "assigned_to": "candidate", "fulfillment_source": "external_vendor"},
        {"type": "license_verification", "label": "License Verification", "assigned_to": "admin", "fulfillment_source": "external_vendor", "vault_match": {"category": "license", "subtypes": ["RN_license"]}},
        {"type": "fingerprinting", "label": "Fingerprinting", "assigned_to": "candidate", "fulfillment_source": "external_vendor"},
        {"type": "bls_certification", "label": "BLS Certification", "assigned_to": "candidate", "fulfillment_source": "vault", "vault_match": {"category": "certification", "subtypes": ["BLS", "CPR", "CPR_BLS"]}},
        {"type": "acls_certification", "label": "ACLS Certification", "assigned_to": "candidate", "fulfillment_source": "vault", "vault_match": {"category": "certification", "subtypes": ["ACLS"]}},
        {"type": "tb_screening", "label": "TB Screening", "assigned_to": "candidate", "fulfillment_source": "vault", "vault_match": {"category": "health_screen", "subtypes": ["TB_test", "QuantiFERON", "PPD"], "max_age_months": 12}},
        {"type": "vaccination_records", "label": "Vaccination Records", "assigned_to": "candidate", "fulfillment_source": "vault", "vault_match": {"category": "health_record", "subtypes": None}},
    ],
    "LPN": [
        {"type": "government_id", "label": "Government ID", "assigned_to": "candidate", "fulfillment_source": "vault", "vault_match": {"category": "identity", "subtypes": ["drivers_license", "passport", "state_id"]}},
        {"type": "background_check", "label": "Background Check", "assigned_to": "admin", "fulfillment_source": "external_vendor"},
        {"type": "drug_screen", "label": "Drug Screen", "assigned_to": "candidate", "fulfillment_source": "external_vendor"},
        {"type": "license_verification", "label": "License Verification", "assigned_to": "admin", "fulfillment_source": "external_vendor", "vault_match": {"category": "license", "subtypes": ["LPN_license"]}},
        {"type": "bls_certification", "label": "BLS Certification", "assigned_to": "candidate", "fulfillment_source": "vault", "vault_match": {"category": "certification", "subtypes": ["BLS", "CPR", "CPR_BLS"]}},
        {"type": "tb_screening", "label": "TB Screening", "assigned_to": "candidate", "fulfillment_source": "vault", "vault_match": {"category": "health_screen", "subtypes": ["TB_test", "QuantiFERON", "PPD"], "max_age_months": 12}},
        {"type": "vaccination_records", "label": "Vaccination Records", "assigned_to": "candidate", "fulfillment_source": "vault", "vault_match": {"category": "health_record", "subtypes": None}},
    ],
}

# Default requirements for any role not specifically listed
DEFAULT_REQUIREMENTS = [
    {"type": "government_id", "label": "Government ID", "assigned_to": "candidate", "fulfillment_source": "vault", "vault_match": {"category": "identity", "subtypes": ["drivers_license", "passport", "state_id"]}},
    {"type": "background_check", "label": "Background Check", "assigned_to": "admin", "fulfillment_source": "external_vendor"},
    {"type": "drug_screen", "label": "Drug Screen", "assigned_to": "candidate", "fulfillment_source": "external_vendor"},
    {"type": "tb_screening", "label": "TB Screening", "assigned_to": "candidate", "fulfillment_source": "vault", "vault_match": {"category": "health_screen", "subtypes": ["TB_test", "QuantiFERON", "PPD"], "max_age_months": 12}},
    {"type": "vaccination_records", "label": "Vaccination Records", "assigned_to": "candidate", "fulfillment_source": "vault", "vault_match": {"category": "health_record", "subtypes": None}},
]

# ==================== VAULT MATCHING ====================

def _parse_date(date_str):
    """Parse a date string into a timezone-aware datetime."""
    if not date_str:
        return None
    try:
        if 'T' in date_str or '+' in date_str or 'Z' in date_str:
            return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        return datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        return None


def match_vault_document(requirement_rule, vault_docs):
    """
    Try to match a requirement to an existing vault document.
    Returns (status, matched_doc, notes).
    """
    vault_match = requirement_rule.get("vault_match")
    if not vault_match:
        # No vault match possible (external vendor requirement)
        return "pending_external_check", None, "Requires external vendor action"

    category = vault_match["category"]
    subtypes = vault_match.get("subtypes")
    max_age_months = vault_match.get("max_age_months")
    now = datetime.now(timezone.utc)

    candidates = []
    for doc in vault_docs:
        if doc.get("category") != category:
            continue
        if subtypes and doc.get("subtype") not in subtypes:
            continue
        candidates.append(doc)

    if not candidates:
        # No matching document found at all
        if requirement_rule.get("fulfillment_source") == "external_vendor":
            return "pending_external_check", None, "No matching vault document; requires external action"
        return "missing_document", None, "No matching document in vault"

    # Pick the best candidate (most recent, valid)
    best = None
    best_status = None
    best_notes = None

    for doc in candidates:
        exp_date = _parse_date(doc.get("expiration_date"))
        doc_date = _parse_date(doc.get("document_date") or doc.get("uploaded_at"))
        verification = doc.get("verification_status", "unverified")

        # Check expiration
        if exp_date and exp_date < now:
            if best_status != "satisfied_from_vault":
                best = doc
                best_status = "document_expired"
                best_notes = f"Document expired on {exp_date.strftime('%Y-%m-%d')}"
            continue

        # Check max age (for time-sensitive docs like TB)
        if max_age_months and doc_date:
            age_limit = now - timedelta(days=max_age_months * 30)
            if doc_date < age_limit:
                if best_status not in ("satisfied_from_vault",):
                    best = doc
                    best_status = "document_expired"
                    best_notes = f"Document too old (>{max_age_months} months)"
                continue

        # Check verification status
        if verification == "pending":
            if best_status not in ("satisfied_from_vault",):
                best = doc
                best_status = "pending_manual_review"
                best_notes = "Document exists but verification is pending"
            continue

        if verification == "rejected":
            continue

        # Valid document found
        best = doc
        best_status = "satisfied_from_vault"
        best_notes = f"Matched to vault document: {doc.get('subtype', doc.get('category'))}"
        break  # Best possible match

    if best is None:
        if requirement_rule.get("fulfillment_source") == "external_vendor":
            return "pending_external_check", None, "Requires external action"
        return "missing_document", None, "No valid matching document in vault"

    return best_status, best, best_notes


# ==================== ONBOARDING CASE CREATION ====================

def detect_role_type(job_data):
    """Detect the role type from job specialty for requirement generation."""
    specialty = (job_data.get("specialty") or "").upper()
    if "CNA" in specialty or "CERTIFIED NURSING ASSISTANT" in specialty:
        return "CNA"
    if "LPN" in specialty or "LICENSED PRACTICAL" in specialty:
        return "LPN"
    if "RN" in specialty or "REGISTERED NURSE" in specialty:
        return "RN"
    return "DEFAULT"


async def create_onboarding_case(db, offer, job, candidate_id, employer_id):
    """
    Create an OnboardingCase with requirements, vault matching, and tasks.
    Returns the case_id.
    """
    role_type = detect_role_type(job)
    case_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()

    # Create the case
    case = {
        "id": case_id,
        "candidate_id": candidate_id,
        "employer_id": employer_id,
        "job_id": offer["job_id"],
        "offer_id": offer["id"],
        "state": job.get("location", ""),
        "role_type": role_type,
        "status": "active",
        "created_at": now_iso,
        "updated_at": now_iso,
    }
    await db.onboarding_cases.insert_one(case)

    # Fetch candidate's vault documents
    vault_docs = await db.vault_documents.find(
        {"candidate_id": candidate_id},
        {"_id": 0}
    ).to_list(500)

    # Get requirement rules for role
    rules = ROLE_REQUIREMENTS.get(role_type, DEFAULT_REQUIREMENTS)

    requirements = []
    doc_matches = []
    tasks = []

    for rule in rules:
        req_id = str(uuid.uuid4())
        status, matched_doc, notes = match_vault_document(rule, vault_docs)
        fulfillment_source = rule["fulfillment_source"]

        # Override fulfillment_source based on match result
        if status == "satisfied_from_vault":
            fulfillment_source = "vault"
        elif status == "missing_document":
            fulfillment_source = "candidate_upload"
        elif status == "document_expired":
            fulfillment_source = "candidate_upload"
        elif status == "pending_manual_review":
            fulfillment_source = "admin_review"

        requirement = {
            "id": req_id,
            "onboarding_case_id": case_id,
            "type": rule["type"],
            "label": rule["label"],
            "status": status,
            "fulfillment_source": fulfillment_source,
            "assigned_to": rule["assigned_to"],
            "due_date": None,
            "notes": notes,
            "created_at": now_iso,
        }
        requirements.append(requirement)

        # Create document match link if we found a vault doc
        if matched_doc:
            match_link = {
                "id": str(uuid.uuid4()),
                "onboarding_requirement_id": req_id,
                "vault_document_id": matched_doc["id"],
                "match_status": status,
                "matched_by": "system",
                "matched_at": now_iso,
                "notes": notes,
            }
            doc_matches.append(match_link)

        # Create tasks only for unresolved requirements
        if status not in ("satisfied_from_vault", "completed"):
            task_type = "upload" if status in ("missing_document", "document_expired") else "action"
            if status == "pending_external_check":
                task_type = "external"
            elif status == "pending_manual_review":
                task_type = "review"

            task_assigned = rule["assigned_to"]
            if status == "pending_manual_review":
                task_assigned = "admin"

            task = {
                "id": str(uuid.uuid4()),
                "onboarding_case_id": case_id,
                "onboarding_requirement_id": req_id,
                "type": task_type,
                "status": "action_required" if task_assigned == "candidate" else "pending",
                "assigned_to": task_assigned,
                "due_date": None,
                "notes": notes,
                "created_at": now_iso,
            }
            tasks.append(task)

    # Batch insert
    if requirements:
        await db.onboarding_requirements.insert_many(requirements)
    if doc_matches:
        await db.requirement_document_matches.insert_many(doc_matches)
    if tasks:
        await db.onboarding_tasks.insert_many(tasks)

    return case_id
