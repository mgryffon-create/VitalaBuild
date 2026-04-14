"""Hiring Pipeline routes — manage candidate stages, messaging with context, nudges"""
from fastapi import APIRouter, Depends
from shared import (
    db, get_current_user, log_audit, NotificationService,
    HTTPException, uuid, datetime, timezone, BaseModel, Optional, List,
)
from datetime import timedelta
from eligibility import get_seeker_role

router = APIRouter(prefix="/pipeline", tags=["pipeline"])

STAGES = ["interested", "matched", "interviewing", "offer_sent", "hired", "passed", "rejected"]
ACTIVE_STAGES = ["interested", "matched", "interviewing", "offer_sent", "hired"]


def _compute_verified_credentials(profile_certs: list, vault_docs: list) -> dict:
    """Cross-reference self-reported certifications with vault documents.
    
    Returns:
        {
            "credentials": [{"name": str, "verification_status": "verified"|"needs_review"|"unverified", "source": "self_reported"}],
            "summary": {"level": str, "verified": int, "needs_review": int, "unverified": int, "total": int}
        }
    """
    results = []
    verified = 0
    needs_review = 0
    unverified = 0

    # Normalize vault docs into a lookup by subtype (lowercased)
    vault_by_subtype = {}
    for doc in vault_docs:
        sub = (doc.get("subtype") or "").lower().strip()
        if sub:
            vault_by_subtype[sub] = doc

    for cert in profile_certs:
        cert_name = cert if isinstance(cert, str) else (cert.get("name") or cert.get("certification") or "")
        if not cert_name:
            continue
        cert_lower = cert_name.lower().strip()

        # Try to find a matching vault document
        matched_doc = None
        for sub_key, doc in vault_by_subtype.items():
            if cert_lower == sub_key or cert_lower in sub_key or sub_key in cert_lower:
                matched_doc = doc
                break

        if matched_doc:
            doc_status = matched_doc.get("verification_status", "pending")
            comp_status = matched_doc.get("compliance_status", "")
            if doc_status == "verified" and comp_status not in ("expired", "mismatch"):
                status = "verified"
                verified += 1
            elif doc_status in ("mismatch", "rejected") or comp_status in ("expired", "mismatch", "review_needed"):
                status = "needs_review"
                needs_review += 1
            else:
                # Document exists but not fully verified (pending, unverified)
                status = "needs_review"
                needs_review += 1
        else:
            status = "unverified"
            unverified += 1

        results.append({
            "name": cert_name,
            "verification_status": status,
            "source": "self_reported",
        })

    total = verified + needs_review + unverified
    if total == 0:
        level = "verification_needed"
    elif verified == total:
        level = "compliance_ready"
    elif verified > 0:
        level = "partially_verified"
    else:
        level = "verification_needed"

    return {
        "credentials": results,
        "summary": {
            "level": level,
            "verified": verified,
            "needs_review": needs_review,
            "unverified": unverified,
            "total": total,
        },
    }


def _pipeline_match(profile: dict, job: dict) -> dict:
    """Lightweight match calculation for pipeline cards — returns tier + reasons."""
    if not profile or not job:
        return {"match_tier": None, "match_reasons": [], "compatibility_score": 0}

    seeker_spec = (profile.get("specialty") or "").lower().strip()
    job_spec = (job.get("specialty") or "").lower().strip()

    # Role category extraction
    def _cat(s):
        for cat in ["CRNA", "NP", "RN", "LPN", "LVN", "CNA", "PCT"]:
            if cat in s.upper():
                return cat
        return s.split("-")[0].strip().split("(")[0].strip().upper()[:10]

    def _sub(s):
        parts = s.split("-", 1)
        return parts[1].strip().lower() if len(parts) > 1 else ""

    seeker_cat = _cat(seeker_spec)
    job_cat = _cat(job_spec)
    job_sub = _sub(job_spec)

    # Specialty
    spec_score = 0
    spec_reason = None
    if seeker_spec == job_spec:
        spec_score = 30
        short = job_sub.title() if job_sub else job_cat
        spec_reason = f"Matches your {short} specialty" if short else None
    elif seeker_cat and job_cat and seeker_cat == job_cat:
        spec_score = 18
        spec_reason = f"Aligned with your {job_cat} specialty" + (f" in {job_sub.title()}" if job_sub else "")
    elif seeker_cat and job_cat:
        spec_score = 5

    # Experience
    seeker_exp = profile.get("years_experience") or 0
    required_exp = job.get("experience_required") or 0
    exp_score = 0
    exp_reason = None
    if required_exp == 0 or seeker_exp >= required_exp:
        exp_score = 25
        if required_exp > 0:
            exp_reason = f"Meets the {required_exp}+ year experience requirement"
    elif seeker_exp >= required_exp - 1:
        exp_score = 15

    # Certifications
    raw_certs = profile.get("certifications", [])
    seeker_certs = set()
    for c in raw_certs:
        name = c if isinstance(c, str) else (c.get("name") or "")
        if name:
            seeker_certs.add(name.lower().strip())
    required_certs = [c.lower().strip() for c in (job.get("certifications_required") or [])]
    cert_score = 15 if not required_certs else int(15 * sum(1 for rc in required_certs if any(rc in sc for sc in seeker_certs)) / len(required_certs))
    cert_reason = None
    if required_certs and cert_score >= 15:
        cert_reason = f"Has required certifications ({', '.join(c.upper() for c in required_certs[:3])})"

    # Shift
    pref_shift = (profile.get("preferred_shift") or "").lower()
    job_shift = (job.get("shift_type") or "").lower()
    shift_score = 5
    shift_reason = None
    if pref_shift and job_shift and pref_shift.split()[0] in job_shift:
        shift_score = 10
        shift_reason = f"Prefers {job.get('shift_type', '').split('(')[0].strip().lower()} shift"

    total = spec_score + exp_score + cert_score + shift_score + 3 + 3 + 3  # loc + type + timing defaults
    max_total = 30 + 25 + 15 + 10 + 10 + 5 + 5
    pct = int((total / max_total) * 100) if max_total > 0 else 50

    # Tier
    if spec_score >= 18 and exp_score >= 15:
        tier = "strong"
    elif spec_score >= 5:
        tier = "possible"
    else:
        tier = None

    # Collect reasons
    reasons = [r for r in [spec_reason, exp_reason, cert_reason, shift_reason] if r][:2]

    return {"match_tier": tier, "match_reasons": reasons, "compatibility_score": pct}

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
    jobs = await db.jobs.find({"poster_id": current_user["id"]}, {"_id": 0}).to_list(100)
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

        # Compliance / vault detail
        vault_docs_list = await db.vault_documents.find(
            {"candidate_id": sw["user_id"]},
            {"_id": 0, "category": 1, "subtype": 1, "verification_status": 1, "compliance_status": 1}
        ).to_list(30)
        vault_count = len(vault_docs_list)
        vault_categories = list(set(d.get("category", "") for d in vault_docs_list if d.get("category")))

        # Cross-reference certifications with vault
        raw_certs = (profile.get("certifications") or []) if profile else []
        cred_result = _compute_verified_credentials(raw_certs, vault_docs_list)

        verified_refs = await db.portable_references.count_documents(
            {"candidate_id": sw["user_id"], "verification_status": "verified"}
        )

        # Onboarding progress (for hired/onboarding candidates)
        onboarding_progress = None
        if stage == "hired":
            ob_case = await db.onboarding_cases.find_one(
                {"candidate_id": sw["user_id"], "employer_id": current_user["id"], "job_id": sw["target_id"]},
                {"_id": 0}
            )
            if ob_case:
                ob_reqs = await db.onboarding_requirements.find(
                    {"onboarding_case_id": ob_case["id"]}, {"_id": 0}
                ).to_list(50)
                total = len(ob_reqs)
                completed = sum(1 for r in ob_reqs if r.get("status") in ("satisfied_from_vault", "completed"))
                blocked = sum(1 for r in ob_reqs if r.get("status") == "flagged_issue")
                missing = sum(1 for r in ob_reqs if r.get("status") == "missing_document")
                expired = sum(1 for r in ob_reqs if r.get("status") == "document_expired")
                pending_ext = sum(1 for r in ob_reqs if r.get("status") == "pending_external_check")
                status_label = "ready" if total > 0 and completed == total else "blocked" if blocked > 0 else "in_progress"
                onboarding_progress = {
                    "case_id": ob_case["id"],
                    "total": total,
                    "completed": completed,
                    "missing": missing,
                    "expired": expired,
                    "pending_external": pending_ext,
                    "blocked": blocked,
                    "percent": round((completed / total) * 100) if total > 0 else 0,
                    "status_label": status_label,
                }

        # Look up match record (for messaging integration)
        match_record = await db.matches.find_one(
            {"seeker_id": sw["user_id"], "job_id": sw["target_id"]}, {"_id": 0, "id": 1}
        )
        messages_count = 0
        if match_record:
            messages_count = await db.messages.count_documents({"match_id": match_record["id"]})

        candidates.append({
            "id": f"{sw['user_id']}_{sw['target_id']}",
            "candidate_id": sw["user_id"],
            "job_id": sw["target_id"],
            "match_id": match_record["id"] if match_record else None,
            "stage": stage,
            "notes": notes,
            "updated_at": updated,
            "seeker": {
                "full_name": seeker.get("full_name"),
                "email": seeker.get("email"),
                "specialty": profile.get("specialty") if profile else None,
                "credential": get_seeker_role(profile) if profile else None,
                "years_experience": profile.get("years_experience") if profile else None,
                "preferred_locations": profile.get("preferred_locations", []) if profile else [],
                "preferred_shift": profile.get("preferred_shift") if profile else None,
                "skills": (profile.get("skills") or [])[:5] if profile else [],
                "certifications": cred_result["credentials"],
            },
            "job": {
                "id": job.get("id"),
                "title": job.get("title"),
                "location": job.get("location"),
                "pay_range": job.get("pay_range"),
                "shift_type": job.get("shift_type"),
            },
            "has_verified_refs": verified_refs > 0,
            "vault_docs": vault_count,
            "vault_categories": vault_categories,
            "credential_summary": cred_result["summary"],
            "messages_count": messages_count,
            "last_message": last_msg,
            "offer_status": offer.get("status") if offer else None,
            "onboarding_progress": onboarding_progress,
            **_pipeline_match(profile or {}, job),
        })

    # Sort: strong matches first, then possible, then others; secondary by recency
    tier_order = {"strong": 0, "possible": 1}
    candidates.sort(key=lambda c: (
        tier_order.get(c.get("match_tier"), 2),
        -(c.get("compatibility_score") or 0),
    ))

    # Group by active stage (exclude passed/rejected from pipeline view)
    grouped = {s: [] for s in ACTIVE_STAGES}
    total_active = 0
    for c in candidates:
        if c["stage"] in ("passed", "rejected"):
            continue
        grouped.get(c["stage"], grouped["interested"]).append(c)
        total_active += 1

    stats = {s: len(grouped[s]) for s in ACTIVE_STAGES}
    stats["total"] = total_active
    return {"candidates": grouped, "stats": stats}


@router.put("/candidates/{candidate_id}/{job_id}/stage")
async def update_stage(candidate_id: str, job_id: str, update: StageUpdate, current_user: dict = Depends(get_current_user)):
    """Move a candidate to a new pipeline stage"""
    if current_user["role"] not in ("poster", "admin"):
        raise HTTPException(status_code=403, detail="Action not allowed — employer access required")
    if update.stage not in STAGES:
        raise HTTPException(status_code=400, detail="Action not allowed in current stage")

    now_iso = datetime.now(timezone.utc).isoformat()

    # HARD FILTER: role eligibility before any stage advancement (skip for pass/reject)
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job no longer available")

    if update.stage not in ("passed", "rejected"):
        profile = await db.seeker_profiles.find_one({"user_id": candidate_id}, {"_id": 0}) or {}
        from eligibility import check_role_eligibility
        elig = check_role_eligibility(profile, job)
        if not elig["eligible"]:
            raise HTTPException(status_code=403, detail=elig["reason"] or "Candidate not eligible for this role")

    # Check if candidate already in this or later stage (prevent duplicate actions)
    existing_stage = await db.pipeline_stages.find_one(
        {"candidate_id": candidate_id, "employer_id": current_user["id"], "job_id": job_id},
        {"_id": 0, "stage": 1}
    )
    if existing_stage:
        current_stage = existing_stage["stage"]
        if current_stage == update.stage:
            raise HTTPException(status_code=409, detail="Candidate already in this stage")
        # Prevent backward movement (except pass/reject which can happen from any stage)
        if update.stage not in ("passed", "rejected"):
            stage_order = {s: i for i, s in enumerate(ACTIVE_STAGES)}
            if stage_order.get(update.stage, 99) <= stage_order.get(current_stage, 0):
                raise HTTPException(status_code=409, detail="Action not allowed in current stage")

    await db.pipeline_stages.update_one(
        {"candidate_id": candidate_id, "employer_id": current_user["id"], "job_id": job_id},
        {"$set": {"stage": update.stage, "notes": update.notes or "", "updated_at": now_iso}},
        upsert=True,
    )

    # When moving to "matched" or later, create a Match record (idempotent)
    if update.stage in ("matched", "interviewing", "offer_sent", "hired"):
        existing_match = await db.matches.find_one(
            {"seeker_id": candidate_id, "job_id": job_id}
        )
        if not existing_match:
            match_id = str(uuid.uuid4())
            await db.matches.insert_one({
                "id": match_id,
                "seeker_id": candidate_id,
                "poster_id": current_user["id"],
                "job_id": job_id,
                "status": "active",
                "created_at": now_iso,
            })
            await log_audit(db, current_user["id"], "match_created", "match", match_id,
                            details={"candidate_id": candidate_id, "job_id": job_id, "source": "pipeline"})

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

    jobs = await db.jobs.find({"poster_id": current_user["id"]}, {"_id": 0, "id": 1, "title": 1}).to_list(100)
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

        seeker = await db.users.find_one({"id": sw["user_id"]}, {"_id": 0, "password": 0})
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
async def get_candidate_context(candidate_id: str, job_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Full candidate context with privacy-gated contact info.
    Contact details (phone, email) only returned when a valid match exists."""
    if current_user["role"] not in ("poster", "admin"):
        raise HTTPException(status_code=403, detail="Not authorized")

    seeker = await db.users.find_one({"id": candidate_id}, {"_id": 0, "password": 0})
    if not seeker:
        raise HTTPException(status_code=404, detail="Candidate not found")

    profile = await db.seeker_profiles.find_one({"user_id": candidate_id}, {"_id": 0}) or {}

    # Privacy gating: check if a valid match exists
    match_query = {"seeker_id": candidate_id, "poster_id": current_user["id"]}
    if job_id:
        match_query["job_id"] = job_id
    has_match = await db.matches.find_one(match_query, {"_id": 0, "id": 1})
    contact_available = bool(has_match)

    # Vault documents
    vault_docs_list = await db.vault_documents.find(
        {"candidate_id": candidate_id},
        {"_id": 0, "category": 1, "subtype": 1, "compliance_status": 1, "verification_status": 1}
    ).to_list(30)
    vault_count = len(vault_docs_list)
    vault_categories = list(set(d.get("category", "") for d in vault_docs_list if d.get("category")))

    # Cross-reference certifications with vault
    raw_certs = profile.get("certifications", [])
    cred_result = _compute_verified_credentials(raw_certs, vault_docs_list)

    # References
    refs = await db.portable_references.find(
        {"candidate_id": candidate_id}, {"_id": 0, "verification_token": 0}
    ).to_list(10)
    verified_refs = [r for r in refs if r.get("verification_status") == "verified"]

    # Licenses
    licenses = await db.seeker_licenses.find(
        {"user_id": candidate_id}, {"_id": 0}
    ).to_list(10)

    # Training compliance
    training_total = await db.training_assignments.count_documents({"user_id": candidate_id})
    training_completed = await db.training_assignments.count_documents({"user_id": candidate_id, "status": "completed"})
    compliance_rate = round(training_completed / training_total * 100) if training_total > 0 else 0

    # Onboarding cases
    onboarding = await db.onboarding_cases.find(
        {"candidate_id": candidate_id, "employer_id": current_user["id"]}, {"_id": 0}
    ).to_list(10)

    # Pipeline stages
    stages = await db.pipeline_stages.find(
        {"candidate_id": candidate_id, "employer_id": current_user["id"]}, {"_id": 0}
    ).to_list(10)

    # Job context
    job_context = None
    if job_id:
        job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
        if job:
            poster_profile = await db.poster_profiles.find_one(
                {"user_id": job.get("poster_id")}, {"_id": 0}
            )
            job_context = {
                "id": job.get("id"),
                "title": job.get("title"),
                "location": job.get("location"),
                "pay_range": job.get("pay_range"),
                "shift_type": job.get("shift_type"),
                "company_name": poster_profile.get("company_name") if poster_profile else None,
            }

    # City/state from preferred_locations
    locs = profile.get("preferred_locations", [])
    city_state = locs[0] if locs else None

    result = {
        "candidate_id": candidate_id,
        "full_name": seeker.get("full_name"),
        "specialty": profile.get("specialty"),
        "years_experience": profile.get("years_experience"),
        "preferred_locations": profile.get("preferred_locations", []),
        "preferred_shift": profile.get("preferred_shift"),
        "bio": profile.get("bio"),
        "city_state": city_state,
        "skills": profile.get("skills", []),
        "certifications": cred_result["credentials"],
        "credential_summary": cred_result["summary"],
        "work_history": profile.get("work_history", []),
        "education": profile.get("education", []),
        "vault_docs": vault_count,
        "vault_categories": vault_categories,
        "contact_available": contact_available,
        "compliance_ready": cred_result["summary"]["level"] == "compliance_ready",
        "references": {
            "total": len(refs),
            "verified": len(verified_refs),
            "top": [{"name": r.get("full_name"), "relationship": r.get("relationship"),
                      "rating": r.get("rating"), "verified": r.get("verification_status") == "verified"}
                     for r in refs[:3]],
        },
        "licenses": [{
            "license_type": lic.get("license_type"),
            "license_number": lic.get("license_number"),
            "state": lic.get("state"),
            "expiration_date": lic.get("expiration_date"),
            "verification_status": lic.get("verification_status"),
        } for lic in licenses],
        "training": {
            "total": training_total,
            "completed": training_completed,
            "compliance_rate": compliance_rate,
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

    # Privacy gating: only include contact info post-match
    if contact_available:
        result["phone"] = profile.get("phone")
        result["email"] = seeker.get("email")

    if job_context:
        result["job"] = job_context

    return result
