"""
Training & Compliance Service Layer
Handles CEU tracking, training assignments, compliance requirements.
Integration-ready for future Relias or other LMS providers.
"""
from datetime import datetime, timezone
import uuid


COMPLETION_STATUSES = ("not_started", "in_progress", "completed", "expired", "waived")


async def create_training_course(db, course_data: dict) -> str:
    """Create a training course record."""
    course_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    course = {
        "id": course_id,
        "title": course_data["title"],
        "description": course_data.get("description", ""),
        "category": course_data.get("category", "general"),
        "provider": course_data.get("provider", "internal"),
        "external_course_id": course_data.get("external_course_id"),
        "credit_hours": course_data.get("credit_hours", 0),
        "credit_type": course_data.get("credit_type", "CEU"),
        "duration_minutes": course_data.get("duration_minutes", 0),
        "launch_url": course_data.get("launch_url"),
        "is_active": True,
        "created_at": now_iso,
        "updated_at": now_iso,
    }
    await db.training_courses.insert_one(course)
    return course_id


async def assign_training(db, assignment_data: dict) -> str:
    """Create a training assignment for a user."""
    assignment_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    assignment = {
        "id": assignment_id,
        "user_id": assignment_data["user_id"],
        "course_id": assignment_data["course_id"],
        "assigned_by": assignment_data.get("assigned_by"),
        "employer_id": assignment_data.get("employer_id"),
        "job_id": assignment_data.get("job_id"),
        "due_date": assignment_data.get("due_date"),
        "completion_status": "not_started",
        "completion_date": None,
        "score": None,
        "certificate_url": None,
        "certificate_metadata": None,
        "external_assignment_id": assignment_data.get("external_assignment_id"),
        "external_lms_user_id": assignment_data.get("external_lms_user_id"),
        "created_at": now_iso,
        "updated_at": now_iso,
    }
    await db.training_assignments.insert_one(assignment)
    return assignment_id


async def get_compliance_summary(db, employer_id: str) -> dict:
    """Get compliance summary for an employer's candidates."""
    # Get all assignments for this employer
    assignments = await db.training_assignments.find(
        {"employer_id": employer_id}, {"_id": 0}
    ).to_list(500)

    total = len(assignments)
    completed = sum(1 for a in assignments if a["completion_status"] == "completed")
    overdue = sum(1 for a in assignments if (
        a.get("due_date") and
        a["completion_status"] not in ("completed", "waived") and
        a["due_date"] < datetime.now(timezone.utc).isoformat()
    ))
    in_progress = sum(1 for a in assignments if a["completion_status"] == "in_progress")
    not_started = sum(1 for a in assignments if a["completion_status"] == "not_started")

    return {
        "total_assignments": total,
        "completed": completed,
        "overdue": overdue,
        "in_progress": in_progress,
        "not_started": not_started,
        "compliance_rate": round((completed / total) * 100) if total > 0 else 100,
    }
