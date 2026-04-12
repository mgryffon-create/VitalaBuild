"""Hiring Pipeline routes — manage candidate stages, messaging with context, nudges"""
from fastapi import APIRouter, Depends
from shared import (
    db, get_current_user, log_audit, NotificationService,
    HTTPException, uuid, datetime, timezone, BaseModel, Optional, List,
)
from datetime import timedelta

router = APIRouter(prefix="/pipeline", tags=["pipeline"])

STAGES = ["interested", "matched", "interviewing", "offer_sent", "hired"]

# Nudge thresholds: how many days of inactivity before suggesting action per stage
NUDGE_THRESHOLDS = {
    "interested": {"days": 2, "action": "match", "message": "has been waiting — review and match or pass"},
    "matched": {"days": 3, "action": "message", "message": "matched but no conversation started — send a message"},
    "interviewing": {"days": 5, "action": "advance", "message": "interview stage idle — schedule or advance to offer"},
    "offer_sent": {"days": 3, "action": "follow_up", "message": "offer pending response — follow up with candidate"},
}

class StageUpdate(BaseModel):
    stage: str
    notes: Optional[str] = None

class MessageTemplate(BaseModel):
    template_key: str

TEMPLATES = {
    "availability": "Hi {name}, we'd love to learn more about your availability. When would be a good time to connect?",
    "interview_request": "Hi {name}, we'd like to schedule a quick interview for the {job} position. Are you available this week?",
    "application_request": "Hi {name}, to move forward, please complete our application at the link below. Let us know if you have questions!",
    "offer_notification": "Hi {name}, great news! We'd like to extend an offer for the {job} position. Please check your Offers page for details.",
}


@router.get("/candidates")
async def get_pipeline_candidates(current_user: dict = Depends(get_current_user)):
    """Get all candidates in the hiring pipeline, organized by stage"""
    if current_user["role"] not in ("poster", "admin"):
        raise HTTPException(status_code=403, detail="Not authorized")

    # Get candidates from swipes (interested in employer's jobs)
    jobs = await db.jobs.find({"employer_id": current_user["id"]}, {"_id": 0}).to_list(100)
    job_ids = [j["id"] for j in jobs]
    job_map = {j["id"]: j for j in jobs}

    swipes = await db.swipes.find(
        {"target_id": {"$in": job_ids}, "action": "like"}, {"_id": 0}
    ).to_list(500)

    candidates = []
    for sw in swipes:
        seeker = await db.users.find_one({"id": sw["user_id"]}, {"_id": 0, "password": 0})
        if not seeker:
            continue
        profile = await db.seeker_profiles.find_one({"user_id": sw["user_id"]}, {"_id": 0})
        job = job_map.get(sw["target_id"], {})

        # Determine pipeline stage from pipeline_stages collection or default
        stage_doc = await db.pipeline_stages.find_one(
            {"candidate_id": sw["user_id"], "employer_id": current_user["id"], "job_id": sw["target_id"]},
            {"_id": 0}
        )
        stage = stage_doc["stage"] if stage_doc else "interested"
        notes = stage_doc.get("notes", "") if stage_doc else ""
        updated = stage_doc.get("updated_at", sw.get("created_at", "")) if stage_doc else sw.get("created_at", "")

        # Check for offers
        offer = await db.employment_offers.find_one(
            {"seeker_id": sw["user_id"], "job_id": sw["target_id"]}, {"_id": 0}
        )
        if offer and stage not in ("offer_sent", "hired"):
            stage = "offer_sent"

        # Check unread messages
        match = await db.swipes.find_one(
            {"user_id": sw["user_id"], "target_id": sw["target_id"], "match_id": {"$exists": True}},
            {"_id": 0, "match_id": 1}
        )
        last_msg = None
        if match and match.get("match_id"):
            msg = await db.messages.find(
                {"match_id": match["match_id"]}
            ).sort("created_at", -1).limit(1).to_list(1)
            if msg:
                last_msg = {"content": msg[0].get("content", "")[:60], "at": msg[0].get("created_at"), "sender_id": msg[0].get("sender_id")}

        # Compliance score
        vault_count = await db.vault_documents.count_documents({"candidate_id": sw["user_id"]})
        verified_refs = await db.portable_references.count_documents(
            {"candidate_id": sw["user_id"], "verification_status": "verified"}
        )

        candidates.append({
            "id": f"{sw['user_id']}_{sw['target_id']}",
            "candidate_id": sw["user_id"],
            "job_id": sw["target_id"],
            "stage": stage,
            "notes": notes,
            "updated_at": updated,
            "seeker": {
                "full_name": seeker.get("full_name"),
                "email": seeker.get("email"),
                "specialty": profile.get("specialty") if profile else None,
                "years_experience": profile.get("years_experience") if profile else None,
                "preferred_locations": profile.get("preferred_locations", []) if profile else [],
                "preferred_shift": profile.get("preferred_shift") if profile else None,
                "skills": (profile.get("skills") or [])[:5] if profile else [],
            },
            "job": {"id": job.get("id"), "title": job.get("title"), "location": job.get("location")},
            "has_verified_refs": verified_refs > 0,
            "vault_docs": vault_count,
            "last_message": last_msg,
            "offer_status": offer.get("status") if offer else None,
        })

    # Sort: most recently updated first within each stage
    candidates.sort(key=lambda c: c.get("updated_at", ""), reverse=True)

    # Group by stage
    grouped = {s: [] for s in STAGES}
    for c in candidates:
        grouped.get(c["stage"], grouped["interested"]).append(c)

    stats = {s: len(grouped[s]) for s in STAGES}
    stats["total"] = len(candidates)
    return {"candidates": grouped, "stats": stats}


@router.put("/candidates/{candidate_id}/{job_id}/stage")
async def update_stage(candidate_id: str, job_id: str, update: StageUpdate, current_user: dict = Depends(get_current_user)):
    """Move a candidate to a new pipeline stage"""
    if current_user["role"] not in ("poster", "admin"):
        raise HTTPException(status_code=403, detail="Not authorized")
    if update.stage not in STAGES:
        raise HTTPException(status_code=400, detail=f"Invalid stage. Must be one of: {STAGES}")

    now_iso = datetime.now(timezone.utc).isoformat()
    await db.pipeline_stages.update_one(
        {"candidate_id": candidate_id, "employer_id": current_user["id"], "job_id": job_id},
        {"$set": {"stage": update.stage, "notes": update.notes or "", "updated_at": now_iso}},
        upsert=True,
    )

    # If moving to "hired", trigger billing
    if update.stage == "hired":
        await log_audit(db, current_user["id"], "candidate_hired", "pipeline", candidate_id,
                        details={"job_id": job_id})

    return {"message": f"Candidate moved to {update.stage}"}


@router.get("/templates")
async def get_message_templates():
    """Get available message templates"""
    return [{"key": k, "preview": v[:80]} for k, v in TEMPLATES.items()]


@router.post("/templates/render")
async def render_template(body: MessageTemplate, current_user: dict = Depends(get_current_user)):
    """Render a message template with placeholders"""
    tpl = TEMPLATES.get(body.template_key)
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"text": tpl, "template_key": body.template_key}


@router.get("/nudges")
async def get_nudges(current_user: dict = Depends(get_current_user)):
    """Get behavior-driven nudge suggestions for inactive pipeline candidates"""
    if current_user["role"] not in ("poster", "admin"):
        raise HTTPException(status_code=403, detail="Not authorized")

    jobs = await db.jobs.find({"employer_id": current_user["id"]}, {"_id": 0, "id": 1, "title": 1}).to_list(100)
    job_ids = [j["id"] for j in jobs]
    job_map = {j["id"]: j for j in jobs}

    swipes = await db.swipes.find(
        {"target_id": {"$in": job_ids}, "action": "like"}, {"_id": 0}
    ).to_list(500)

    now = datetime.now(timezone.utc)
    nudges = []

    for sw in swipes:
        stage_doc = await db.pipeline_stages.find_one(
            {"candidate_id": sw["user_id"], "employer_id": current_user["id"], "job_id": sw["target_id"]},
            {"_id": 0}
        )
        stage = stage_doc["stage"] if stage_doc else "interested"
        if stage == "hired":
            continue

        threshold = NUDGE_THRESHOLDS.get(stage)
        if not threshold:
            continue

        updated_raw = stage_doc.get("updated_at") if stage_doc else sw.get("created_at")
        if not updated_raw:
            continue

        try:
            if isinstance(updated_raw, str):
                updated_dt = datetime.fromisoformat(updated_raw.replace("Z", "+00:00"))
            else:
                updated_dt = updated_raw
            if updated_dt.tzinfo is None:
                updated_dt = updated_dt.replace(tzinfo=timezone.utc)
        except (ValueError, TypeError):
            continue

        days_idle = (now - updated_dt).days
        if days_idle < threshold["days"]:
            continue

        seeker = await db.users.find_one({"id": sw["user_id"]}, {"_id": 0, "password": 0, "full_name": 1})
        job = job_map.get(sw["target_id"], {})

        nudges.append({
            "candidate_id": sw["user_id"],
            "job_id": sw["target_id"],
            "candidate_name": seeker.get("full_name", "Candidate") if seeker else "Candidate",
            "job_title": job.get("title", ""),
            "stage": stage,
            "days_idle": days_idle,
            "action": threshold["action"],
            "message": f"{seeker.get('full_name', 'Candidate') if seeker else 'Candidate'} {threshold['message']}",
            "priority": "high" if days_idle >= threshold["days"] * 2 else "medium",
        })

    nudges.sort(key=lambda n: n["days_idle"], reverse=True)
    return {"nudges": nudges, "total": len(nudges)}


@router.get("/candidates/{candidate_id}/context")
async def get_candidate_context(candidate_id: str, current_user: dict = Depends(get_current_user)):
    """Get full candidate context for the messaging panel"""
    if current_user["role"] not in ("poster", "admin"):
        raise HTTPException(status_code=403, detail="Not authorized")

    seeker = await db.users.find_one({"id": candidate_id}, {"_id": 0, "password": 0})
    if not seeker:
        raise HTTPException(status_code=404, detail="Candidate not found")

    profile = await db.seeker_profiles.find_one({"user_id": candidate_id}, {"_id": 0})
    vault_count = await db.vault_documents.count_documents({"candidate_id": candidate_id})
    refs = await db.portable_references.find(
        {"candidate_id": candidate_id}, {"_id": 0, "verification_token": 0}
    ).to_list(10)
    verified_refs = [r for r in refs if r.get("verification_status") == "verified"]

    # Training compliance
    training_total = await db.training_assignments.count_documents({"user_id": candidate_id})
    training_completed = await db.training_assignments.count_documents({"user_id": candidate_id, "status": "completed"})

    # Onboarding cases with this employer
    onboarding = await db.onboarding_cases.find(
        {"candidate_id": candidate_id, "employer_id": current_user["id"]}, {"_id": 0}
    ).to_list(10)

    # Find job-specific pipeline stages
    stages = await db.pipeline_stages.find(
        {"candidate_id": candidate_id, "employer_id": current_user["id"]}, {"_id": 0}
    ).to_list(10)

    return {
        "candidate_id": candidate_id,
        "full_name": seeker.get("full_name"),
        "email": seeker.get("email"),
        "specialty": profile.get("specialty") if profile else None,
        "years_experience": profile.get("years_experience") if profile else None,
        "preferred_locations": profile.get("preferred_locations", []) if profile else [],
        "preferred_shift": profile.get("preferred_shift") if profile else None,
        "bio": profile.get("bio") if profile else None,
        "skills": profile.get("skills", []) if profile else [],
        "vault_docs": vault_count,
        "references": {
            "total": len(refs),
            "verified": len(verified_refs),
            "top": [{"name": r.get("full_name"), "relationship": r.get("relationship"),
                      "rating": r.get("rating"), "verified": r.get("verification_status") == "verified"}
                     for r in refs[:3]],
        },
        "training": {
            "total": training_total,
            "completed": training_completed,
            "compliance_rate": round(training_completed / training_total * 100) if training_total > 0 else 0,
        },
        "onboarding_cases": [{
            "job_id": c.get("job_id"),
            "state": c.get("state"),
            "progress": c.get("progress", 0),
        } for c in onboarding],
        "pipeline_stages": [{
            "job_id": s.get("job_id"),
            "stage": s.get("stage"),
            "updated_at": s.get("updated_at"),
        } for s in stages],
    }
