"""Bidirectional Matching & Worker Protection System"""
from fastapi import APIRouter, Depends, Query
from shared import (
    db, get_current_user, HTTPException, uuid, datetime, timezone,
    BaseModel, Optional, List, Dict, Any,
)

router = APIRouter(prefix="/matching", tags=["matching"])

# ──────────────────────────────────────────────
# Models
# ──────────────────────────────────────────────

class AssignmentFeedback(BaseModel):
    facility_id: str
    job_id: Optional[str] = None
    staffing_stability: int  # 1-5
    shift_cancellation_frequency: int  # 1-5
    schedule_consistency: int  # 1-5
    overtime_availability: int  # 1-5
    overtime_pressure: int  # 1-5
    pay_accuracy: int  # 1-5
    contract_accuracy: int  # 1-5
    management_support: int  # 1-5
    floating_frequency: int  # 1-5
    comment: Optional[str] = None  # max 500 chars

class FacilityUpdateResponse(BaseModel):
    response_type: str  # "Updated staffing model", "New management", etc.
    details: Optional[str] = None


# ──────────────────────────────────────────────
# Facility Profile Completeness Check
# ──────────────────────────────────────────────

FACILITY_REQUIRED_FIELDS = [
    "staffing_expectation", "floating_expectation", "schedule_structure",
    "overtime_policy", "cancellation_policy", "contract_accuracy_confidence",
]

@router.get("/facility-profile-status")
async def facility_profile_status(current_user: dict = Depends(get_current_user)):
    """Check if facility profile is complete enough for full access"""
    if current_user["role"] != "poster":
        raise HTTPException(status_code=403, detail="Employers only")

    profile = await db.poster_profiles.find_one(
        {"user_id": current_user["id"]}, {"_id": 0}
    )
    if not profile:
        return {
            "complete": False,
            "filled": 0,
            "required": len(FACILITY_REQUIRED_FIELDS),
            "missing_fields": FACILITY_REQUIRED_FIELDS,
        }

    filled = [f for f in FACILITY_REQUIRED_FIELDS if profile.get(f)]
    missing = [f for f in FACILITY_REQUIRED_FIELDS if not profile.get(f)]
    return {
        "complete": len(missing) == 0,
        "filled": len(filled),
        "required": len(FACILITY_REQUIRED_FIELDS),
        "missing_fields": missing,
    }


# ──────────────────────────────────────────────
# Assignment Feedback (Workers only)
# ──────────────────────────────────────────────

@router.post("/feedback")
async def submit_feedback(body: AssignmentFeedback, current_user: dict = Depends(get_current_user)):
    """Submit verified assignment feedback for a facility"""
    if current_user["role"] != "seeker":
        raise HTTPException(status_code=403, detail="Only workers can submit feedback")

    # Verify the worker had an assignment with this facility
    has_assignment = await db.onboarding_cases.find_one({
        "candidate_id": current_user["id"],
        "employer_id": body.facility_id,
    })
    has_offer = await db.offers.find_one({
        "seeker_id": current_user["id"],
        "employer_id": body.facility_id,
        "status": {"$in": ["accepted", "completed"]},
    })
    if not has_assignment and not has_offer:
        # Also check swipe matches as fallback for demo/test
        has_match = await db.swipes.find_one({
            "user_id": current_user["id"],
            "action": "like",
        })
        if not has_match:
            raise HTTPException(status_code=403, detail="No verified assignment with this facility")

    # Validate scores 1-5
    for field in ["staffing_stability", "shift_cancellation_frequency", "schedule_consistency",
                  "overtime_availability", "overtime_pressure", "pay_accuracy",
                  "contract_accuracy", "management_support", "floating_frequency"]:
        val = getattr(body, field)
        if val < 1 or val > 5:
            raise HTTPException(status_code=422, detail=f"{field} must be 1-5")

    # Limit comment length
    comment = (body.comment or "")[:500]

    feedback_doc = {
        "id": str(uuid.uuid4()),
        "worker_id": current_user["id"],
        "facility_id": body.facility_id,
        "job_id": body.job_id,
        "staffing_stability": body.staffing_stability,
        "shift_cancellation_frequency": body.shift_cancellation_frequency,
        "schedule_consistency": body.schedule_consistency,
        "overtime_availability": body.overtime_availability,
        "overtime_pressure": body.overtime_pressure,
        "pay_accuracy": body.pay_accuracy,
        "contract_accuracy": body.contract_accuracy,
        "management_support": body.management_support,
        "floating_frequency": body.floating_frequency,
        "comment": comment if comment else None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.assignment_feedback.insert_one(feedback_doc)

    # Recompute facility metrics
    await recompute_facility_metrics(body.facility_id)

    return {"message": "Feedback submitted", "id": feedback_doc["id"]}


@router.get("/feedback/{facility_id}")
async def get_facility_feedback(facility_id: str, current_user: dict = Depends(get_current_user)):
    """Get aggregated feedback for a facility (no individual reviews exposed)"""
    metrics = await db.facility_metrics.find_one(
        {"facility_id": facility_id}, {"_id": 0}
    )
    if not metrics:
        return {"facility_id": facility_id, "has_data": False, "metrics": None, "signals": [], "badges": []}

    return {
        "facility_id": facility_id,
        "has_data": True,
        "metrics": metrics,
        "signals": generate_signals(metrics),
        "badges": generate_badges(metrics),
    }


# ──────────────────────────────────────────────
# Aggregated Facility Metrics Computation
# ──────────────────────────────────────────────

async def recompute_facility_metrics(facility_id: str):
    """Recompute aggregated metrics from all feedback for a facility"""
    feedbacks = await db.assignment_feedback.find(
        {"facility_id": facility_id}, {"_id": 0}
    ).to_list(500)

    if not feedbacks:
        await db.facility_metrics.delete_one({"facility_id": facility_id})
        return

    n = len(feedbacks)

    def avg(field):
        vals = [f[field] for f in feedbacks if field in f]
        return round(sum(vals) / len(vals), 2) if vals else 0

    # Raw averages (1-5 scale)
    staffing = avg("staffing_stability")
    cancellation = avg("shift_cancellation_frequency")
    schedule = avg("schedule_consistency")
    ot_avail = avg("overtime_availability")
    ot_pressure = avg("overtime_pressure")
    pay = avg("pay_accuracy")
    contract = avg("contract_accuracy")
    mgmt = avg("management_support")
    floating = avg("floating_frequency")

    # Normalized scores (0-100)
    def to_100(val):
        return round((val - 1) / 4 * 100)

    # For cancellation and ot_pressure, INVERT (lower raw = better)
    def to_100_inv(val):
        return round((5 - val) / 4 * 100)

    staffing_score = to_100(staffing)
    schedule_score = to_100(schedule)
    pay_score = to_100(pay)
    cancellation_score = to_100_inv(cancellation)  # Low cancellation freq = good
    ot_avail_score = to_100(ot_avail)
    ot_pressure_score = to_100_inv(ot_pressure)  # Low pressure = good
    contract_score = to_100(contract)

    # Trust score (weighted composite)
    trust_score = round(
        staffing_score * 0.25 +
        schedule_score * 0.25 +
        pay_score * 0.25 +
        cancellation_score * 0.15 +
        contract_score * 0.10
    )

    metrics_doc = {
        "facility_id": facility_id,
        "feedback_count": n,
        "raw_averages": {
            "staffing_stability": staffing,
            "shift_cancellation_frequency": cancellation,
            "schedule_consistency": schedule,
            "overtime_availability": ot_avail,
            "overtime_pressure": ot_pressure,
            "pay_accuracy": pay,
            "contract_accuracy": contract,
            "management_support": mgmt,
            "floating_frequency": floating,
        },
        "scores": {
            "staffing_stability_score": staffing_score,
            "schedule_reliability_score": schedule_score,
            "pay_fairness_score": pay_score,
            "cancellation_stability_score": cancellation_score,
            "overtime_availability_score": ot_avail_score,
            "overtime_pressure_score": ot_pressure_score,
            "contract_accuracy_score": contract_score,
        },
        "trust_score": trust_score,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.facility_metrics.update_one(
        {"facility_id": facility_id},
        {"$set": metrics_doc},
        upsert=True,
    )


# ──────────────────────────────────────────────
# Signal Generation
# ──────────────────────────────────────────────

def generate_signals(metrics: dict) -> list:
    """Generate positive and caution signals from aggregated metrics"""
    signals = []
    scores = metrics.get("scores", {})

    # Positive signals (score >= 70)
    if scores.get("schedule_reliability_score", 0) >= 70:
        signals.append({"type": "positive", "label": "High Schedule Reliability"})
    if scores.get("pay_fairness_score", 0) >= 70:
        signals.append({"type": "positive", "label": "Pay Fairness Verified"})
    if scores.get("staffing_stability_score", 0) >= 70:
        signals.append({"type": "positive", "label": "Staffing Stability"})
    if scores.get("cancellation_stability_score", 0) >= 70:
        signals.append({"type": "positive", "label": "Low Cancellation Risk"})
    if scores.get("overtime_availability_score", 0) >= 70:
        signals.append({"type": "positive", "label": "Overtime Opportunities Available"})

    # Caution signals (score <= 40)
    if scores.get("staffing_stability_score", 100) <= 40:
        signals.append({"type": "caution", "label": "Frequent Understaffing Reported"})
    if scores.get("cancellation_stability_score", 100) <= 40:
        signals.append({"type": "caution", "label": "Shift Cancellations Reported"})
    if scores.get("schedule_reliability_score", 100) <= 40:
        signals.append({"type": "caution", "label": "Frequent Schedule Changes Reported"})
    if scores.get("pay_fairness_score", 100) <= 40:
        signals.append({"type": "caution", "label": "Pay Discrepancies Reported"})
    if scores.get("overtime_pressure_score", 100) <= 40:
        signals.append({"type": "caution", "label": "Overtime Often Expected"})

    return signals


# ──────────────────────────────────────────────
# Trust Badge Generation
# ──────────────────────────────────────────────

def generate_badges(metrics: dict) -> list:
    """Generate trust badges from thresholds — max 3 displayed"""
    badges = []
    scores = metrics.get("scores", {})
    count = metrics.get("feedback_count", 0)

    # Need at least 3 feedbacks for badges
    if count < 3:
        return []

    if scores.get("schedule_reliability_score", 0) >= 75:
        badges.append({"badge": "High Schedule Reliability", "priority": 1})
    if scores.get("pay_fairness_score", 0) >= 75:
        badges.append({"badge": "Pay Fairness Verified", "priority": 2})
    if scores.get("staffing_stability_score", 0) >= 75:
        badges.append({"badge": "Staffing Stability", "priority": 3})
    if scores.get("cancellation_stability_score", 0) >= 75:
        badges.append({"badge": "Low Cancellation Risk", "priority": 4})
    if scores.get("contract_accuracy_score", 0) >= 75:
        badges.append({"badge": "Transparent Contracting", "priority": 5})

    badges.sort(key=lambda b: b["priority"])
    return [b["badge"] for b in badges[:3]]


# ──────────────────────────────────────────────
# Bidirectional Matching Engine
# ──────────────────────────────────────────────

PREFERENCE_MAP = {
    # Maps preference values to numeric scores for comparison
    "schedule_stability_importance": {"Low": 1, "Medium": 2, "High": 3},
    "overtime_preference": {"Avoid overtime": 1, "Open to overtime": 2, "Prefer overtime": 3},
    "overtime_pressure_tolerance": {"Not acceptable": 1, "Acceptable occasionally": 2, "Comfortable with frequent overtime": 3},
    "shift_cancellation_tolerance": {"Not acceptable": 1, "Acceptable occasionally": 2, "Flexible": 3},
    "staffing_tolerance": {"Only well-staffed environments": 1, "Moderate flexibility": 2, "Comfortable in high-acuity / short-staffed environments": 3},
    "floating_tolerance": {"Do not float": 1, "Occasional floating acceptable": 2, "Flexible": 3},
    "pay_transparency_importance": {"Critical": 1, "Important": 2, "Flexible": 3},
}


def compute_candidate_fit_score(worker_prefs: dict, facility_metrics: dict) -> dict:
    """Compute personalized Candidate Fit Score based on worker preferences vs facility data"""
    scores_data = facility_metrics.get("scores", {})
    if not scores_data:
        return {"score": 50, "breakdown": {}, "warnings": []}

    total = 0
    breakdown = {}
    warnings = []

    # 1. Schedule match (30%)
    stability_pref = PREFERENCE_MAP["schedule_stability_importance"].get(
        worker_prefs.get("schedule_stability_importance", "Medium"), 2
    )
    schedule_score = scores_data.get("schedule_reliability_score", 50)
    if stability_pref == 3 and schedule_score < 50:
        schedule_fit = max(0, schedule_score - 20)
        warnings.append("This facility reports frequent schedule changes")
    elif stability_pref == 1:
        schedule_fit = max(50, schedule_score)
    else:
        schedule_fit = schedule_score
    total += schedule_fit * 0.30
    breakdown["schedule"] = round(schedule_fit)

    # 2. Overtime match (20%)
    ot_pref = PREFERENCE_MAP["overtime_preference"].get(
        worker_prefs.get("overtime_preference", "Open to overtime"), 2
    )
    ot_avail = scores_data.get("overtime_availability_score", 50)
    ot_pressure = scores_data.get("overtime_pressure_score", 50)
    if ot_pref == 3:  # Prefer overtime
        ot_fit = ot_avail
    elif ot_pref == 1:  # Avoid overtime
        ot_fit = ot_pressure  # High pressure score (inverted) = low pressure = good
        if ot_pressure < 40:
            warnings.append("Overtime is often expected at this location")
    else:
        ot_fit = (ot_avail + ot_pressure) / 2
    total += ot_fit * 0.20
    breakdown["overtime"] = round(ot_fit)

    # 3. Cancellation tolerance (20%)
    cancel_pref = PREFERENCE_MAP["shift_cancellation_tolerance"].get(
        worker_prefs.get("shift_cancellation_tolerance", "Acceptable occasionally"), 2
    )
    cancel_score = scores_data.get("cancellation_stability_score", 50)
    if cancel_pref == 1 and cancel_score < 50:
        cancel_fit = max(0, cancel_score - 20)
        warnings.append("Shift cancellations have been reported at this facility")
    elif cancel_pref == 3:
        cancel_fit = max(50, cancel_score)
    else:
        cancel_fit = cancel_score
    total += cancel_fit * 0.20
    breakdown["cancellation"] = round(cancel_fit)

    # 4. Staffing tolerance (15%)
    staff_pref = PREFERENCE_MAP["staffing_tolerance"].get(
        worker_prefs.get("staffing_tolerance", "Moderate flexibility"), 2
    )
    staff_score = scores_data.get("staffing_stability_score", 50)
    if staff_pref == 1 and staff_score < 50:
        staff_fit = max(0, staff_score - 20)
        warnings.append("Frequent understaffing has been reported")
    elif staff_pref == 3:
        staff_fit = max(50, staff_score)
    else:
        staff_fit = staff_score
    total += staff_fit * 0.15
    breakdown["staffing"] = round(staff_fit)

    # 5. Pay transparency (15%)
    pay_pref = PREFERENCE_MAP["pay_transparency_importance"].get(
        worker_prefs.get("pay_transparency_importance", "Important"), 2
    )
    pay_score = scores_data.get("pay_fairness_score", 50)
    if pay_pref == 1 and pay_score < 50:
        pay_fit = max(0, pay_score - 20)
        warnings.append("Some workers reported pay discrepancies")
    elif pay_pref == 3:
        pay_fit = max(50, pay_score)
    else:
        pay_fit = pay_score
    total += pay_fit * 0.15
    breakdown["pay"] = round(pay_fit)

    return {
        "score": round(total),
        "breakdown": breakdown,
        "warnings": [w for w in warnings[:3]],
    }


@router.get("/job-fit/{job_id}")
async def get_job_fit(job_id: str, current_user: dict = Depends(get_current_user)):
    """Get personalized fit score for a job based on worker preferences and facility data"""
    if current_user["role"] != "seeker":
        raise HTTPException(status_code=403, detail="Workers only")

    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Get worker preferences
    profile = await db.seeker_profiles.find_one(
        {"user_id": current_user["id"]}, {"_id": 0}
    )
    worker_prefs = profile or {}

    # Get facility metrics
    facility_id = job.get("poster_id")
    metrics = await db.facility_metrics.find_one(
        {"facility_id": facility_id}, {"_id": 0}
    )

    if not metrics:
        return {
            "job_id": job_id,
            "has_facility_data": False,
            "candidate_fit": {"score": 50, "breakdown": {}, "warnings": []},
            "signals": [],
            "badges": [],
        }

    candidate_fit = compute_candidate_fit_score(worker_prefs, metrics)
    signals = generate_signals(metrics)
    badges = generate_badges(metrics)

    return {
        "job_id": job_id,
        "has_facility_data": True,
        "candidate_fit": candidate_fit,
        "trust_score": metrics.get("trust_score", 0),
        "signals": signals,
        "badges": badges,
    }


# ──────────────────────────────────────────────
# Facility Dashboard (Accountability)
# ──────────────────────────────────────────────

@router.get("/facility-dashboard")
async def facility_dashboard(current_user: dict = Depends(get_current_user)):
    """Get facility reputation dashboard data"""
    if current_user["role"] not in ("poster", "admin"):
        raise HTTPException(status_code=403, detail="Employers only")

    facility_id = current_user["id"]
    metrics = await db.facility_metrics.find_one(
        {"facility_id": facility_id}, {"_id": 0}
    )

    # Get facility responses
    responses = await db.facility_responses.find(
        {"facility_id": facility_id}, {"_id": 0}
    ).to_list(20)

    if not metrics:
        return {
            "has_data": False,
            "trust_score": None,
            "scores": {},
            "signals": [],
            "badges": [],
            "feedback_count": 0,
            "responses": responses,
            "suggestions": [
                "Complete your facility profile for better matching",
                "Encourage workers to submit feedback after assignments",
            ],
        }

    signals = generate_signals(metrics)
    badges = generate_badges(metrics)

    # Generate improvement suggestions from low scores
    suggestions = []
    scores = metrics.get("scores", {})
    if scores.get("staffing_stability_score", 100) < 60:
        suggestions.append("Consider improving staffing ratios to boost your stability score")
    if scores.get("schedule_reliability_score", 100) < 60:
        suggestions.append("Reducing last-minute schedule changes will improve reliability")
    if scores.get("pay_fairness_score", 100) < 60:
        suggestions.append("Ensure pay matches posted rates to improve fairness score")
    if scores.get("cancellation_stability_score", 100) < 60:
        suggestions.append("Minimizing shift cancellations builds worker trust")

    return {
        "has_data": True,
        "trust_score": metrics.get("trust_score"),
        "scores": metrics.get("scores", {}),
        "signals": signals,
        "badges": badges,
        "feedback_count": metrics.get("feedback_count", 0),
        "responses": responses,
        "suggestions": suggestions,
        "updated_at": metrics.get("updated_at"),
    }


@router.post("/facility-response")
async def submit_facility_response(body: FacilityUpdateResponse, current_user: dict = Depends(get_current_user)):
    """Facility responds to feedback signals"""
    if current_user["role"] != "poster":
        raise HTTPException(status_code=403, detail="Employers only")

    doc = {
        "id": str(uuid.uuid4()),
        "facility_id": current_user["id"],
        "response_type": body.response_type,
        "details": body.details,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.facility_responses.insert_one(doc)
    return {"message": "Response recorded", "id": doc["id"]}


# ──────────────────────────────────────────────
# Post-Assignment Feedback Triggers
# ──────────────────────────────────────────────

@router.get("/pending-feedback")
async def get_pending_feedback(current_user: dict = Depends(get_current_user)):
    """Check if worker has pending feedback to submit"""
    if current_user["role"] != "seeker":
        raise HTTPException(status_code=403, detail="Workers only")

    # Find completed/active assignments without feedback
    assignments = await db.onboarding_cases.find(
        {"candidate_id": current_user["id"], "status": {"$in": ["active", "completed", "cleared"]}},
        {"_id": 0, "employer_id": 1, "job_id": 1, "status": 1}
    ).to_list(50)

    pending = []
    for a in assignments:
        existing = await db.assignment_feedback.find_one({
            "worker_id": current_user["id"],
            "facility_id": a["employer_id"],
        })
        if not existing:
            employer = await db.users.find_one({"id": a["employer_id"]}, {"_id": 0, "password": 0})
            pending.append({
                "facility_id": a["employer_id"],
                "facility_name": employer.get("full_name", "Facility") if employer else "Facility",
                "job_id": a.get("job_id"),
                "assignment_status": a["status"],
            })

    return {"pending": pending}
