"""Resume parsing routes"""
from fastapi import APIRouter, Depends, UploadFile, File, Form
from shared import (
    db, get_current_user, log_audit, VAULT_UPLOAD_DIR, MAX_FILE_SIZE,
    HTTPException, uuid, datetime, timezone, aiofiles, os, BaseModel, Optional, Dict, Any,
)
from resume_parser import parse_resume_text, extract_text_from_file

router = APIRouter(prefix="/resume", tags=["resume"])


class PastedResumeText(BaseModel):
    text: str


@router.post("/parse/upload")
async def parse_resume_upload(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Upload a resume file, extract text, parse with AI, return structured profile"""
    allowed = (".pdf", ".doc", ".docx", ".txt")
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in allowed:
        raise HTTPException(status_code=400, detail=f"File type not allowed. Accepted: {', '.join(allowed)}")
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Max 10 MB.")

    # Save file to vault as resume
    doc_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    safe_name = f"{doc_id}{ext}"
    async with aiofiles.open(VAULT_UPLOAD_DIR / safe_name, "wb") as f:
        await f.write(contents)

    file_url = f"/api/vault/files/{safe_name}"
    vault_doc = {
        "id": doc_id, "candidate_id": current_user["id"],
        "category": "resume", "subtype": "resume",
        "issuing_authority": None, "document_number": None,
        "issue_date": None, "expiration_date": None,
        "document_date": now_iso[:10], "state": None,
        "verification_status": "pending", "file_url": file_url,
        "file_name": file.filename, "file_size": len(contents),
        "content_type": file.content_type, "extracted_fields": {},
        "uploaded_at": now_iso, "last_reviewed_at": None,
    }
    await db.vault_documents.insert_one(vault_doc)

    # Extract text
    raw_text = await extract_text_from_file(contents, file.filename)
    if raw_text.startswith("["):
        return {"error": raw_text, "vault_document_id": doc_id, "file_url": file_url}

    # Parse with AI
    parsed = await parse_resume_text(raw_text)

    # Store the parsed result
    parse_record = {
        "id": str(uuid.uuid4()),
        "candidate_id": current_user["id"],
        "vault_document_id": doc_id,
        "raw_text": raw_text[:10000],
        "parsed_data": parsed,
        "status": "error" if "error" in parsed else "parsed",
        "created_at": now_iso,
    }
    await db.resume_parses.insert_one(parse_record)

    await log_audit(db, current_user["id"], "resume_parsed", "resume", doc_id,
                    details={"file_name": file.filename, "text_length": len(raw_text)})

    return {
        "vault_document_id": doc_id,
        "file_url": file_url,
        "raw_text_preview": raw_text[:300],
        "parsed_profile": parsed,
        "parse_id": parse_record["id"],
    }


@router.post("/parse/text")
async def parse_pasted_text(body: PastedResumeText, current_user: dict = Depends(get_current_user)):
    """Parse pasted resume text with AI"""
    if len(body.text.strip()) < 50:
        raise HTTPException(status_code=400, detail="Text too short to parse")

    parsed = await parse_resume_text(body.text)
    now_iso = datetime.now(timezone.utc).isoformat()
    parse_record = {
        "id": str(uuid.uuid4()),
        "candidate_id": current_user["id"],
        "vault_document_id": None,
        "raw_text": body.text[:10000],
        "parsed_data": parsed,
        "status": "error" if "error" in parsed else "parsed",
        "created_at": now_iso,
    }
    await db.resume_parses.insert_one(parse_record)

    return {
        "parsed_profile": parsed,
        "parse_id": parse_record["id"],
    }


@router.get("/parses")
async def get_my_parses(current_user: dict = Depends(get_current_user)):
    """Get all resume parse records for current user"""
    parses = await db.resume_parses.find(
        {"candidate_id": current_user["id"]},
        {"_id": 0, "raw_text": 0}
    ).sort("created_at", -1).to_list(10)
    return parses


@router.post("/apply-to-profile/{parse_id}")
async def apply_parse_to_profile(parse_id: str, current_user: dict = Depends(get_current_user)):
    """Apply parsed resume data to the candidate's seeker profile"""
    parse = await db.resume_parses.find_one(
        {"id": parse_id, "candidate_id": current_user["id"]}, {"_id": 0}
    )
    if not parse:
        raise HTTPException(status_code=404, detail="Parse record not found")
    parsed = parse.get("parsed_data", {})
    if "error" in parsed:
        raise HTTPException(status_code=400, detail="Cannot apply errored parse")

    # Map parsed data to seeker profile fields
    update_fields = {}
    if parsed.get("full_name"):
        update_fields["full_name"] = parsed["full_name"]
    if parsed.get("specialties"):
        update_fields["specialty"] = parsed["specialties"][0] if parsed["specialties"] else None
    if parsed.get("skills"):
        update_fields["skills"] = parsed["skills"]
    if parsed.get("certifications"):
        update_fields["certifications"] = [c.get("name", "") for c in parsed["certifications"]]
    if parsed.get("education"):
        update_fields["education"] = parsed["education"]
    if parsed.get("employment_groups"):
        update_fields["work_history"] = parsed["employment_groups"]
        update_fields["work_history_mode"] = parsed.get("work_history_mode", "condensed")
    if parsed.get("professional_summary"):
        update_fields["bio"] = parsed["professional_summary"]
    if parsed.get("licenses"):
        first_license = parsed["licenses"][0] if parsed["licenses"] else {}
        if first_license.get("license_type"):
            update_fields["license_type"] = first_license["license_type"]
        if first_license.get("state"):
            update_fields["license_state"] = first_license["state"]
        if first_license.get("license_number"):
            update_fields["license_number"] = first_license["license_number"]
    if parsed.get("availability", {}).get("shift_preferences"):
        update_fields["preferred_shift"] = parsed["availability"]["shift_preferences"][0]
    if parsed.get("availability", {}).get("preferred_states"):
        update_fields["preferred_locations"] = parsed["availability"]["preferred_states"]
    if parsed.get("phone"):
        update_fields["phone"] = parsed["phone"]

    if update_fields:
        await db.seeker_profiles.update_one(
            {"user_id": current_user["id"]}, {"$set": update_fields}
        )
        # Also update user full_name if parsed
        if parsed.get("full_name"):
            await db.users.update_one(
                {"id": current_user["id"]},
                {"$set": {"full_name": parsed["full_name"], "profile_complete": True}}
            )

    return {"message": "Profile updated from resume", "fields_updated": list(update_fields.keys())}
