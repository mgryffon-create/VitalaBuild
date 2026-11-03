from typing import Optional
from uploaded_files import resolve_upload
"""Vault routes: document CRUD, file upload, file serving"""
import logging
from fastapi import APIRouter, Depends, UploadFile, File, Form, BackgroundTasks
from starlette.responses import Response
from shared import (
    db, get_current_user, log_audit, VAULT_UPLOAD_DIR, VAULT_CATEGORIES,
    MAX_FILE_SIZE, VaultDocumentCreate, VaultDocumentUpdate,
    HTTPException, uuid, datetime, timezone, aiofiles, os,
)
from object_storage import upload_file, download_file, signed_url
import anyio
from starlette.responses import RedirectResponse
from document_screening import screen_file, screening_passed, SCREENING_VERSION

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
    - AND current document content screening passed; date-only approval is insufficient
    
    Documents with mismatch/expired/missing_expiration → NEVER satisfy compliance.
    """
    category = doc.get("category", "")
    subtype = doc.get("subtype", "")
    exp_date_str = doc.get("expiration_date")
    is_exp = _is_expirable(category, subtype)
    verification = doc.get("verification_status", "pending")

    if verification == "rejected" or doc.get("screening_status") == "rejected":
        return "rejected"
    if verification == "expired" or doc.get("screening_status") == "expired":
        return "expired"
    if is_exp and not screening_passed(doc):
        return "review_needed"

    # Mismatch or needs_review = always blocked
    if verification == "mismatch":
        return "mismatch"
    if verification == "needs_review":
        return "review_needed"

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
    doc_id = filename.rsplit(".", 1)[0] if "." in filename else filename
    doc = await db.vault_documents.find_one({"id": doc_id}, {"_id": 0})
    job_document = False
    if not doc:
        doc = await db.job_documents.find_one({"file_url": f"/api/vault/files/{filename}"}, {"_id": 0})
        job_document = bool(doc)
    if not doc or not doc.get("storage_path"):
        raise HTTPException(status_code=404, detail="File not found")
    is_admin = current_user.get("role") == "admin"
    owner = doc.get("employer_id") if job_document else doc.get("candidate_id")
    allowed = is_admin or owner == current_user["id"]
    if not allowed and job_document and current_user.get("role") == "seeker":
        allowed = bool(await db.onboarding_cases.find_one({"job_id": doc["job_id"], "candidate_id": current_user["id"]}))
    elif not allowed and not job_document and current_user.get("role") == "poster":
        allowed = bool(await db.onboarding_cases.find_one({"employer_id": current_user["id"], "candidate_id": owner}))
    if not allowed:
        await log_audit(db, current_user["id"], "unauthorized_access", "vault_file", filename)
        raise HTTPException(status_code=403, detail="Not authorized to access this file")
    await log_audit(db, current_user["id"], "file_access", "vault_file", filename)
    try:
        url = await anyio.to_thread.run_sync(lambda: signed_url(doc["storage_path"]))
        return RedirectResponse(url=url, status_code=302)
    except Exception:
        raise HTTPException(status_code=503, detail="Document storage is temporarily unavailable")



async def _run_verification_pipeline(
    doc_id: str, file_bytes: bytes, content_type: str,
    user_expiration: str, user_subtype: str, user_name: str = None
):
    """Background task: conservative content screening without AI or date-only approval."""
    doc = await db.vault_documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        return
    try:
        update_fields = screen_file(file_bytes, content_type, user_subtype, user_name)
        update_fields.update({"verified_at": datetime.now(timezone.utc).isoformat(),
                              "screened_subtype": doc.get("subtype"), "screened_category": doc.get("category")})
        if update_fields.get("screening_status") == "passed":
            date = update_fields["parsed_expiration_date"]
            update_fields.update({"entered_expiration_date": user_expiration, "expiration_date": date,
                                  "screened_expiration_date": date})
        updated = {**doc, **update_fields}
        update_fields["compliance_status"] = _compute_compliance_status(updated)
        # Concurrent user edits invalidate this result instead of approving stale metadata.
        await db.vault_documents.update_one({"id": doc_id, "subtype": user_subtype,
            "category": doc.get("category"), "expiration_date": user_expiration}, {"$set": update_fields})
    except Exception as exc:
        logger.error("Document screening failed: %s", type(exc).__name__)
        await db.vault_documents.update_one({"id": doc_id}, {"$set": {
            "screening_version": SCREENING_VERSION, "screening_status": "needs_review",
            "verification_status": "needs_review", "compliance_status": "review_needed",
            "verification_notes": "Document screening could not complete. This upload cannot unlock matching yet."}})


@router.post("/upload")
async def upload_vault_file(
    background_tasks: BackgroundTasks,
    file: Optional[UploadFile] = File(None), uploaded_file: Optional[str] = Form(None), category: str = Form(...),
    subtype: str = Form(None), issuing_authority: str = Form(None),
    document_number: str = Form(None), issue_date: str = Form(None),
    expiration_date: str = Form(None), document_date: str = Form(None),
    state: str = Form(None), current_user: dict = Depends(get_current_user),
):
    file = await resolve_upload(file, uploaded_file, current_user)
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
    storage_path = getattr(file, "storage_path", None) or upload_file(safe_name, contents, file.content_type, current_user["id"])
    file_url = f"/api/vault/files/{safe_name}"
    is_expirable = _is_expirable(category, subtype)
    doc_data = {
        "id": doc_id, "candidate_id": current_user["id"],
        "category": category, "subtype": subtype or None,
        "issuing_authority": issuing_authority or None, "document_number": document_number or None,
        "issue_date": issue_date or None, "expiration_date": expiration_date or None,
        "document_date": document_date or now_iso[:10], "state": state or None,
        "verification_status": "pending" if is_expirable else "pending",
        "file_url": file_url, "storage_path": storage_path,
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
        # Get user name for name-matching
        user_profile = await db.seeker_profiles.find_one(
            {"user_id": current_user["id"]}, {"_id": 0, "full_name": 1}
        )
        user_name = current_user.get("full_name") or (user_profile.get("full_name") if user_profile else None)
        background_tasks.add_task(
            _run_verification_pipeline, doc_id, contents, file.content_type,
            expiration_date, subtype, user_name
        )
    elif is_expirable:
        # Extract the labeled date even when the user has not entered one.
        background_tasks.add_task(
            _run_verification_pipeline, doc_id, contents, file.content_type,
            None, subtype, current_user.get("full_name")
        )

    return {"id": doc_id, "file_url": file_url, "message": "File uploaded to vault"}


@router.get("/documents")
async def get_vault_documents(current_user: dict = Depends(get_current_user)):
    docs = await db.vault_documents.find(
        {"candidate_id": current_user["id"]}, {"_id": 0, "file_data": 0}
    ).sort("uploaded_at", -1).to_list(200)
    for doc in docs:
        if _is_expirable(doc.get("category", ""), doc.get("subtype", "")) and doc.get("screening_version") != SCREENING_VERSION and doc.get("verification_status") != "pending":
            doc.update(verification_status="needs_review", verification_notes="This upload needs the new document-type check. Select Check document to screen it again.")
        doc["compliance_status"] = _compute_compliance_status(doc)
    return docs


@router.post("/documents/{doc_id}/screen")
async def screen_existing_document(doc_id: str, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    doc = await db.vault_documents.find_one({"id": doc_id, "candidate_id": current_user["id"]}, {"_id": 0})
    if not doc or not doc.get("storage_path"):
        raise HTTPException(status_code=404, detail="Stored document not found. Please upload a new copy.")
    contents, content_type = await anyio.to_thread.run_sync(lambda: download_file(doc["storage_path"]))
    await db.vault_documents.update_one({"id": doc_id}, {"$set": {"screening_version": SCREENING_VERSION, "screening_status": "pending", "verification_status": "pending"}})
    background_tasks.add_task(_run_verification_pipeline, doc_id, contents, content_type, doc.get("expiration_date"), doc.get("subtype"), current_user.get("full_name"))
    return {"message": "Document content check started"}


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
    if any(key in update_fields for key in ("category", "subtype", "expiration_date", "file_url", "extracted_fields", "document_number", "issuing_authority")):
        update_fields.update({"screening_status": "needs_review", "verification_status": "needs_review",
                              "compliance_status": "review_needed", "verification_notes": "Document details changed. Run content screening again."})
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
