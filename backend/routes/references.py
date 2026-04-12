"""Portable Reference System routes"""
from fastapi import APIRouter, Depends
from shared import (
    db, get_current_user, log_audit, NotificationService,
    HTTPException, uuid, datetime, timezone, BaseModel, Optional, List,
)

router = APIRouter(prefix="/references", tags=["references"])


class ReferenceCreate(BaseModel):
    full_name: str
    title: Optional[str] = None
    facility_name: Optional[str] = None
    relationship: str  # supervisor, charge_nurse, manager, coworker, etc.
    email: Optional[str] = None
    phone: Optional[str] = None


class ReferenceUpdate(BaseModel):
    full_name: Optional[str] = None
    title: Optional[str] = None
    facility_name: Optional[str] = None
    relationship: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    sort_order: Optional[int] = None


class VerificationFeedback(BaseModel):
    confirms_identity: bool = True
    confirms_relationship: bool = True
    feedback: Optional[str] = None
    rating: Optional[int] = None  # 1-5


@router.get("")
async def get_my_references(current_user: dict = Depends(get_current_user)):
    """Get all references for current user"""
    refs = await db.portable_references.find(
        {"candidate_id": current_user["id"]}, {"_id": 0}
    ).sort("sort_order", 1).to_list(20)
    return refs


@router.post("")
async def add_reference(ref: ReferenceCreate, current_user: dict = Depends(get_current_user)):
    """Add a new portable reference"""
    ref_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    count = await db.portable_references.count_documents({"candidate_id": current_user["id"]})
    ref_data = {
        "id": ref_id,
        "candidate_id": current_user["id"],
        "full_name": ref.full_name,
        "title": ref.title,
        "facility_name": ref.facility_name,
        "relationship": ref.relationship,
        "email": ref.email,
        "phone": ref.phone,
        "verification_status": "unverified",
        "verification_method": None,
        "verification_token": None,
        "rating": None,
        "feedback": None,
        "sort_order": count,
        "date_added": now_iso,
        "updated_at": now_iso,
    }
    await db.portable_references.insert_one(ref_data)
    await log_audit(db, current_user["id"], "reference_add", "portable_reference", ref_id)
    return {"id": ref_id, "message": "Reference added"}


@router.put("/{ref_id}")
async def update_reference(ref_id: str, update: ReferenceUpdate, current_user: dict = Depends(get_current_user)):
    """Update a reference"""
    ref = await db.portable_references.find_one({"id": ref_id, "candidate_id": current_user["id"]})
    if not ref:
        raise HTTPException(status_code=404, detail="Reference not found")
    fields = {k: v for k, v in update.model_dump().items() if v is not None}
    if fields:
        fields["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.portable_references.update_one({"id": ref_id}, {"$set": fields})
    return {"message": "Reference updated"}


@router.delete("/{ref_id}")
async def delete_reference(ref_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a reference"""
    result = await db.portable_references.delete_one({"id": ref_id, "candidate_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Reference not found")
    return {"message": "Reference deleted"}


@router.post("/{ref_id}/reorder")
async def reorder_reference(ref_id: str, new_order: int, current_user: dict = Depends(get_current_user)):
    """Change sort order of a reference"""
    ref = await db.portable_references.find_one({"id": ref_id, "candidate_id": current_user["id"]})
    if not ref:
        raise HTTPException(status_code=404, detail="Reference not found")
    await db.portable_references.update_one({"id": ref_id}, {"$set": {"sort_order": new_order}})
    return {"message": "Reference reordered"}


@router.post("/{ref_id}/request-verification")
async def request_verification(ref_id: str, current_user: dict = Depends(get_current_user)):
    """Send verification request to a reference via email"""
    ref = await db.portable_references.find_one({"id": ref_id, "candidate_id": current_user["id"]})
    if not ref:
        raise HTTPException(status_code=404, detail="Reference not found")
    if not ref.get("email"):
        raise HTTPException(status_code=400, detail="Reference has no email address")
    if ref.get("verification_status") == "verified":
        return {"message": "Reference is already verified"}

    token = str(uuid.uuid4())
    await db.portable_references.update_one(
        {"id": ref_id},
        {"$set": {"verification_status": "pending", "verification_token": token, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    # Send verification email (mocked for Phase 1)
    candidate = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password": 0})
    candidate_name = candidate.get("full_name", "A candidate") if candidate else "A candidate"
    await NotificationService.send_email(
        ref["email"],
        f"Reference Verification Request — {candidate_name}",
        f"<p>Hi {ref['full_name']},</p>"
        f"<p><strong>{candidate_name}</strong> has listed you as a professional reference on VitalaMatch.</p>"
        f"<p>Please click the link below to confirm your relationship and optionally provide feedback:</p>"
        f"<p><a href='/references/verify/{token}'>Verify Reference</a></p>"
    )
    await log_audit(db, current_user["id"], "reference_verification_requested", "portable_reference", ref_id)
    return {"message": "Verification request sent", "token": token}


@router.get("/verify/{token}")
async def get_verification_details(token: str):
    """Get reference verification details (public endpoint)"""
    ref = await db.portable_references.find_one(
        {"verification_token": token, "verification_status": "pending"}, {"_id": 0}
    )
    if not ref:
        raise HTTPException(status_code=404, detail="Verification request not found or already completed")
    candidate = await db.users.find_one({"id": ref["candidate_id"]}, {"_id": 0, "password": 0})
    return {
        "reference_name": ref["full_name"],
        "candidate_name": candidate.get("full_name") if candidate else "Unknown",
        "relationship": ref["relationship"],
        "facility_name": ref.get("facility_name"),
    }


@router.post("/verify/{token}")
async def submit_verification(token: str, feedback: VerificationFeedback):
    """Submit reference verification (public endpoint)"""
    ref = await db.portable_references.find_one({"verification_token": token, "verification_status": "pending"})
    if not ref:
        raise HTTPException(status_code=404, detail="Verification request not found or already completed")

    update_fields = {
        "verification_status": "verified" if feedback.confirms_identity and feedback.confirms_relationship else "unverified",
        "verification_method": "email_confirmed",
        "verification_token": None,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if feedback.feedback:
        update_fields["feedback"] = feedback.feedback
    if feedback.rating is not None:
        update_fields["rating"] = max(1, min(5, feedback.rating))

    await db.portable_references.update_one({"id": ref["id"]}, {"$set": update_fields})
    return {"message": "Verification submitted. Thank you!"}


@router.get("/candidate/{candidate_id}")
async def get_candidate_references(candidate_id: str, current_user: dict = Depends(get_current_user)):
    """Employer/admin view: get references for a candidate (only verified + unverified, no tokens)"""
    is_admin = current_user.get("role") == "admin"
    is_employer = current_user.get("role") == "poster"
    if not (is_admin or is_employer):
        raise HTTPException(status_code=403, detail="Not authorized")
    refs = await db.portable_references.find(
        {"candidate_id": candidate_id},
        {"_id": 0, "verification_token": 0}
    ).sort("sort_order", 1).to_list(20)
    return refs


@router.get("/packet/{candidate_id}")
async def get_reference_packet(candidate_id: str, current_user: dict = Depends(get_current_user)):
    """Generate a structured reference summary packet"""
    is_owner = current_user["id"] == candidate_id
    is_admin = current_user.get("role") == "admin"
    is_employer = current_user.get("role") == "poster"
    if not (is_owner or is_admin or is_employer):
        raise HTTPException(status_code=403, detail="Not authorized")
    refs = await db.portable_references.find(
        {"candidate_id": candidate_id},
        {"_id": 0, "verification_token": 0}
    ).sort("sort_order", 1).to_list(5)
    candidate = await db.users.find_one({"id": candidate_id}, {"_id": 0, "password": 0})
    verified = [r for r in refs if r.get("verification_status") == "verified"]
    return {
        "candidate_name": candidate.get("full_name") if candidate else "Unknown",
        "total_references": len(refs),
        "verified_count": len(verified),
        "references": refs[:3],  # Top 3
    }
