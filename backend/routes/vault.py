"""Vault routes: document CRUD, file upload, file serving"""
import logging
from fastapi import APIRouter, Depends, UploadFile, File, Form, BackgroundTasks
from starlette.responses import FileResponse
from shared import (
    db, get_current_user, log_audit, VAULT_UPLOAD_DIR, VAULT_CATEGORIES,
    MAX_FILE_SIZE, VaultDocumentCreate, VaultDocumentUpdate,
    HTTPException, uuid, datetime, timezone, aiofiles, os,
)
from expiration_verifier import extract_expiration_from_file, determine_verification_status

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/vault", tags=["vault"])

# Document types/subtypes that MUST have an expiration date
EXPIRABLE_SUBTYPES = {
    # Certifications
    "BLS", "ACLS", "PALS", "CPR", "CPR_BLS", "CNA Certificate",
    # Licenses
    "RN License", "RN_license", "CNA License", "CNA_license",
    "LPN License", "LPN_license", "LVN License", "LVN_license",
    "DEA License",
    # Identification
    "Driver's License", "drivers_license", "Passport", "passport",
    "State ID", "state_id",
    # Insurance
    "Professional Liability Insurance",
}

# Categories where ALL subtypes are expirable
EXPIRABLE_CATEGORIES = {"certification", "license", "identification"}


def _is_expirable(category: str, subtype: str) -> bool:
    """Check if a document type requires an expiration date."""
    if category in EXPIRABLE_CATEGORIES:
        return True
    if subtype and subtype in EXPIRABLE_SUBTYPES:
        return True
    return False


def _validate_expiration(category: str, subtype: str, expiration_date: str):
    """Raise HTTPException if an expirable document is missing expiration date."""
    if _is_expirable(category or "", subtype or "") and not expiration_date:
        raise HTTPException(
            status_code=400,
            detail="Expiration date is required for this document type"
        )


def _compute_compliance_status(doc: dict) -> str:
    """Compute compliance status for a single vault document.
    
    A document satisfies compliance ONLY if:
    - correct type + active + not expired + required metadata present
    - AND either verified (match) OR acceptable fallback (parse failed + valid user entry)
    
    Documents with mismatch/expired/missing_expiration → NEVER satisfy compliance.
    """
    category = doc.get("category", "")
    subtype = doc.get("subtype", "")
    exp_date_str = doc.get("expiration_date")
    is_exp = _is_expirable(category, subtype)
    verification = doc.get("verification_status", "pending")

    # Mismatch = always blocked
    if verification == "mismatch":
        return "mismatch"

    # Missing expiration for expirable type
    if is_exp and not exp_date_str:
        return "missing_expiration"

    # Check if expired (use parsed date if available, otherwise user date)
    parsed_exp = doc.get("parsed_expiration_date")
    check_date = parsed_exp or exp_date_str
    if check_date:
        try:
            if "T" in check_date:
                exp = datetime.fromisoformat(check_date.replace("Z", "+00:00")).date()
            else:
                exp = datetime.strptime(check_date, "%Y-%m-%d").date()
            if exp < datetime.now(timezone.utc).date():
                return "expired"
        except (ValueError, TypeError):
            pass

    # Verification-based status
    if verification == "verified":
        return "verified"
    if verification == "unverified":
        # Parse failed but valid user entry — acceptable fallback
        return "unverified"
    if verification == "expired":
        return "expired"
    if verification == "rejected":
        return "review_needed"
    if verification == "pending":
        return "pending"

    return "pending"


@router.post("/documents")
async def create_vault_document(doc: VaultDocumentCreate, current_user: dict = Depends(get_current_user)):
    if doc.category not in VAULT_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category. Must be one of: {VAULT_CATEGORIES}")
    _validate_expiration(doc.category, doc.subtype, doc.expiration_date)
    doc_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    doc_data = {
        "id": doc_id, "candidate_id": current_user["id"],
        "category": doc.category, "subtype": doc.subtype,
        "issuing_authority": doc.issuing_authority, "document_number": doc.document_number,
        "issue_date": doc.issue_date, "expiration_date": doc.expiration_date,
        "document_date": doc.document_date or now_iso[:10], "state": doc.state,
        "verification_status": "pending", "file_url": doc.file_url,
        "file_name": doc.file_name, "extracted_fields": doc.extracted_fields or {},
        "uploaded_at": now_iso, "last_reviewed_at": None,
    }
    if doc.file_data:
        doc_data["file_data"] = doc.file_data
    await db.vault_documents.insert_one(doc_data)
    return {"id": doc_id, "message": "Document added to vault"}


@router.get("/files/{filename}")
async def serve_vault_file(filename: str, current_user: dict = Depends(get_current_user)):
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    file_path = VAULT_UPLOAD_DIR / filename
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    doc_id = filename.rsplit(".", 1)[0] if "." in filename else filename
    vault_doc = await db.vault_documents.find_one({"id": doc_id}, {"_id": 0, "candidate_id": 1})
    if vault_doc:
        is_owner = vault_doc.get("candidate_id") == current_user["id"]
        is_admin = current_user.get("role") == "admin"
        is_employer_with_access = False
        if current_user.get("role") == "poster":
            case = await db.onboarding_cases.find_one(
                {"employer_id": current_user["id"], "candidate_id": vault_doc.get("candidate_id")},
                {"_id": 0, "id": 1},
            )
            if case:
                is_employer_with_access = True
        if not (is_owner or is_admin or is_employer_with_access):
            await log_audit(db, current_user["id"], "unauthorized_access", "vault_file", filename)
            raise HTTPException(status_code=403, detail="Not authorized to access this file")
    await log_audit(db, current_user["id"], "file_access", "vault_file", filename)
    return FileResponse(str(file_path))


async def _run_expiration_verification(doc_id: str, file_bytes: bytes, content_type: str, user_expiration: str):
    """Background task: extract expiration date and verify against user entry."""
    try:
        parsed_result = await extract_expiration_from_file(file_bytes, content_type or "image/jpeg")
        verification = determine_verification_status(user_expiration, parsed_result)
        update_fields = {
            "parsed_expiration_date": verification.get("parsed_expiration_date"),
            "verification_status": verification.get("verification_status", "unverified"),
            "verification_notes": verification.get("verification_notes"),
            "verification_confidence": parsed_result.get("confidence"),
            "verified_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.vault_documents.update_one({"id": doc_id}, {"$set": update_fields})
        logger.info(f"Verification complete for {doc_id}: {verification.get('verification_status')}")
    except Exception as e:
        logger.error(f"Verification failed for {doc_id}: {e}")
        await db.vault_documents.update_one(
            {"id": doc_id},
            {"$set": {"verification_status": "unverified", "verification_notes": f"Verification error: {str(e)[:200]}"}}
        )


@router.post("/upload")
async def upload_vault_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...), category: str = Form(...),
    subtype: str = Form(None), issuing_authority: str = Form(None),
    document_number: str = Form(None), issue_date: str = Form(None),
    expiration_date: str = Form(None), document_date: str = Form(None),
    state: str = Form(None), current_user: dict = Depends(get_current_user),
):
    if category not in VAULT_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category. Must be one of: {VAULT_CATEGORIES}")
    _validate_expiration(category, subtype, expiration_date)
    allowed = (".pdf", ".jpg", ".jpeg", ".png", ".webp", ".heic", ".doc", ".docx")
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in allowed:
        raise HTTPException(status_code=400, detail=f"File type not allowed. Accepted: {', '.join(allowed)}")
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Max 10 MB.")
    doc_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    safe_name = f"{doc_id}{ext}"
    async with aiofiles.open(VAULT_UPLOAD_DIR / safe_name, "wb") as f:
        await f.write(contents)
    file_url = f"/api/vault/files/{safe_name}"
    is_expirable = _is_expirable(category, subtype)
    doc_data = {
        "id": doc_id, "candidate_id": current_user["id"],
        "category": category, "subtype": subtype or None,
        "issuing_authority": issuing_authority or None, "document_number": document_number or None,
        "issue_date": issue_date or None, "expiration_date": expiration_date or None,
        "document_date": document_date or now_iso[:10], "state": state or None,
        "verification_status": "pending" if is_expirable else "pending",
        "file_url": file_url,
        "file_name": file.filename, "file_size": len(contents),
        "content_type": file.content_type, "extracted_fields": {},
        "uploaded_at": now_iso, "last_reviewed_at": None,
        "parsed_expiration_date": None, "verification_notes": None,
        "verification_confidence": None, "verified_at": None,
    }
    await db.vault_documents.insert_one(doc_data)
    await log_audit(db, current_user["id"], "vault_upload", "vault_document", doc_id,
                    details={"category": category, "file_name": file.filename})

    # Trigger background verification for expirable document types
    if is_expirable and expiration_date:
        background_tasks.add_task(
            _run_expiration_verification, doc_id, contents, file.content_type, expiration_date
        )

    return {"id": doc_id, "file_url": file_url, "message": "File uploaded to vault"}


@router.get("/documents")
async def get_vault_documents(current_user: dict = Depends(get_current_user)):
    docs = await db.vault_documents.find(
        {"candidate_id": current_user["id"]}, {"_id": 0, "file_data": 0}
    ).sort("uploaded_at", -1).to_list(200)
    for doc in docs:
        doc["compliance_status"] = _compute_compliance_status(doc)
    return docs


@router.get("/documents/{doc_id}")
async def get_vault_document(doc_id: str, current_user: dict = Depends(get_current_user)):
    doc = await db.vault_documents.find_one(
        {"id": doc_id, "candidate_id": current_user["id"]}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    doc["compliance_status"] = _compute_compliance_status(doc)
    return doc


@router.put("/documents/{doc_id}")
async def update_vault_document(doc_id: str, update: VaultDocumentUpdate, current_user: dict = Depends(get_current_user)):
    doc = await db.vault_documents.find_one({"id": doc_id, "candidate_id": current_user["id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    update_fields = {k: v for k, v in update.model_dump().items() if v is not None}
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    update_fields["last_reviewed_at"] = datetime.now(timezone.utc).isoformat()
    await db.vault_documents.update_one({"id": doc_id}, {"$set": update_fields})
    return {"message": "Document updated"}


@router.delete("/documents/{doc_id}")
async def delete_vault_document(doc_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.vault_documents.delete_one({"id": doc_id, "candidate_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"message": "Document deleted"}


@router.get("/categories")
async def get_vault_categories():
    return {
        "categories": {
            "medical": {
                "label": "Medical Documents",
                "groups": {
                    "vaccinations": {
                        "label": "Vaccinations",
                        "types": [
                            "COVID-19 Vaccine", "Influenza (Flu)", "Hepatitis B",
                            "MMR", "Varicella", "Tdap", "Other Vaccination",
                        ],
                    },
                    "tb_clearance": {
                        "label": "TB / Medical Clearance",
                        "types": [
                            "TB Skin Test (PPD)", "TB Blood Test (Quantiferon)",
                            "Chest X-Ray (TB Clearance)", "Physical Exam",
                        ],
                    },
                },
            },
            "certification": {
                "label": "Certifications",
                "types": ["BLS", "ACLS", "PALS", "CPR", "CNA Certificate"],
            },
            "identification": {
                "label": "Identification",
                "types": ["Driver's License", "Passport", "State ID"],
            },
            "license": {
                "label": "Licenses",
                "types": ["RN License", "CNA License", "LPN License", "LVN License"],
            },
            "compliance": {
                "label": "Compliance Documents",
                "types": [
                    "Background Check", "Drug Screen",
                    "Professional Liability Insurance", "NPI Certificate", "DEA License",
                ],
            },
        }
    }


@router.get("/expirable-types")
async def get_expirable_types():
    """Return list of expirable subtypes and categories for frontend validation."""
    return {
        "expirable_subtypes": sorted(EXPIRABLE_SUBTYPES),
        "expirable_categories": sorted(EXPIRABLE_CATEGORIES),
    }
