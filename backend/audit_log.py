"""
Audit logging service for tracking security-relevant actions.
Logs to MongoDB for queryability and future HIPAA compliance prep.
"""
from datetime import datetime, timezone

AUDIT_ACTIONS = [
    "login", "login_failed", "register", "logout",
    "vault_upload", "vault_delete", "vault_access",
    "job_create", "job_update", "job_delete",
    "offer_send", "offer_accept", "offer_decline",
    "onboarding_case_created", "requirement_updated",
    "admin_action", "file_access", "unauthorized_access",
]


async def log_audit(db, user_id: str, action: str, resource_type: str = None,
                    resource_id: str = None, ip_address: str = None,
                    details: dict = None):
    """Log an audit event."""
    entry = {
        "user_id": user_id,
        "action": action,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "ip_address": ip_address,
        "details": details or {},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await db.audit_logs.insert_one(entry)
