"""Training & Compliance routes"""
from fastapi import APIRouter, Depends
from shared import (
    db, get_current_user, create_training_course, assign_training,
    get_compliance_summary, log_audit, TrainingCourseCreate,
    TrainingAssignmentCreate, TrainingAssignmentUpdate,
    ComplianceRequirementCreate, HTTPException, uuid, datetime, timezone,
)

router = APIRouter(prefix="/training", tags=["training"])


@router.get("/courses")
async def get_training_courses(current_user: dict = Depends(get_current_user)):
    courses = await db.training_courses.find({"is_active": True}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return courses


@router.post("/courses")
async def create_course(course: TrainingCourseCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ("admin", "poster"):
        raise HTTPException(status_code=403, detail="Not authorized")
    course_id = await create_training_course(db, course.model_dump())
    return {"id": course_id, "message": "Course created"}


@router.get("/assignments")
async def get_training_assignments(current_user: dict = Depends(get_current_user)):
    if current_user["role"] == "seeker":
        assignments = await db.training_assignments.find(
            {"user_id": current_user["id"]}, {"_id": 0}
        ).sort("due_date", 1).to_list(200)
    else:
        assignments = await db.training_assignments.find(
            {"employer_id": current_user["id"]}, {"_id": 0}
        ).sort("due_date", 1).to_list(500)
    for a in assignments:
        course = await db.training_courses.find_one({"id": a["course_id"]}, {"_id": 0})
        a["course"] = course
        if current_user["role"] != "seeker":
            user = await db.users.find_one({"id": a["user_id"]}, {"_id": 0, "password": 0})
            a["user"] = user
    return assignments


@router.post("/assignments")
async def create_assignment(data: TrainingAssignmentCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ("admin", "poster"):
        raise HTTPException(status_code=403, detail="Not authorized")
    assignment_data = data.model_dump()
    assignment_data["assigned_by"] = current_user["id"]
    assignment_data["employer_id"] = current_user["id"]
    assignment_id = await assign_training(db, assignment_data)
    return {"id": assignment_id, "message": "Training assigned"}


@router.put("/assignments/{assignment_id}")
async def update_assignment(assignment_id: str, update: TrainingAssignmentUpdate, current_user: dict = Depends(get_current_user)):
    assignment = await db.training_assignments.find_one({"id": assignment_id})
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    is_owner = assignment["user_id"] == current_user["id"]
    is_admin = current_user.get("role") == "admin"
    is_employer = assignment.get("employer_id") == current_user["id"]
    if not (is_owner or is_admin or is_employer):
        raise HTTPException(status_code=403, detail="Not authorized")
    update_fields = {k: v for k, v in update.model_dump().items() if v is not None}
    if "completion_status" in update_fields and update_fields["completion_status"] == "completed":
        update_fields["completion_date"] = datetime.now(timezone.utc).isoformat()
    if update_fields:
        update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.training_assignments.update_one({"id": assignment_id}, {"$set": update_fields})
    return {"message": "Assignment updated"}


@router.get("/compliance-summary")
async def get_compliance_summary_endpoint(current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ("admin", "poster"):
        raise HTTPException(status_code=403, detail="Not authorized")
    summary = await get_compliance_summary(db, current_user["id"])
    return summary


@router.get("/compliance-requirements")
async def get_compliance_requirements(current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ("admin", "poster"):
        return []
    reqs = await db.compliance_requirements.find(
        {"employer_id": current_user["id"]}, {"_id": 0}
    ).to_list(100)
    for r in reqs:
        course = await db.training_courses.find_one({"id": r["course_id"]}, {"_id": 0})
        r["course"] = course
    return reqs


@router.post("/compliance-requirements")
async def create_compliance_requirement(data: ComplianceRequirementCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ("admin", "poster"):
        raise HTTPException(status_code=403, detail="Not authorized")
    req_id = str(uuid.uuid4())
    req = {
        "id": req_id, "employer_id": current_user["id"],
        "role_type": data.role_type, "course_id": data.course_id,
        "is_mandatory": data.is_mandatory, "job_id": data.job_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.compliance_requirements.insert_one(req)
    return {"id": req_id, "message": "Compliance requirement created"}


@router.get("/transcript")
async def get_transcript(current_user: dict = Depends(get_current_user)):
    assignments = await db.training_assignments.find(
        {"user_id": current_user["id"], "completion_status": "completed"}, {"_id": 0}
    ).sort("completion_date", -1).to_list(200)
    for a in assignments:
        course = await db.training_courses.find_one({"id": a["course_id"]}, {"_id": 0})
        a["course"] = course
    return assignments


@router.get("/certificates")
async def get_certificates(current_user: dict = Depends(get_current_user)):
    assignments = await db.training_assignments.find(
        {"user_id": current_user["id"], "certificate_url": {"$ne": None}}, {"_id": 0}
    ).sort("completion_date", -1).to_list(200)
    for a in assignments:
        course = await db.training_courses.find_one({"id": a["course_id"]}, {"_id": 0})
        a["course"] = course
    return assignments
