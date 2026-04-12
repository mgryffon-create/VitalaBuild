"""
Shared state, configuration, models, services, and helpers.
Imported by all route modules.
"""
from fastapi import HTTPException, Depends, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Dict, Any
from pathlib import Path
from datetime import datetime, timezone, timedelta
import os
import uuid
import jwt
import bcrypt
import aiofiles
import logging

from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content

from audit_log import log_audit
from onboarding_logic import create_onboarding_case, compute_case_status, compute_progress, RESOLVED_STATUSES
from training_service import create_training_course, assign_training, get_compliance_summary

# ==================== CONFIG ====================

ROOT_DIR = Path(__file__).parent

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET')
if not JWT_SECRET:
    raise ValueError("JWT_SECRET environment variable must be set")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

SENDGRID_API_KEY = os.environ.get('SENDGRID_API_KEY')
SENDGRID_FROM_EMAIL = os.environ.get('SENDGRID_FROM_EMAIL', 'noreply@vitalamatch.com')
TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID')
TWILIO_API_KEY = os.environ.get('TWILIO_API_KEY')
TWILIO_API_SECRET = os.environ.get('TWILIO_API_SECRET')
TWILIO_PHONE_NUMBER = os.environ.get('TWILIO_PHONE_NUMBER')
NURSYS_API_KEY = os.environ.get('NURSYS_API_KEY')
NURSYS_API_URL = os.environ.get('NURSYS_API_URL', 'https://www.nursys.com/api/v1')
ALLOW_DEV_BYPASS = os.environ.get('ALLOW_DEV_BYPASS', 'false').lower() == 'true'

logger = logging.getLogger("server")
security = HTTPBearer()

VAULT_UPLOAD_DIR = ROOT_DIR / "uploads" / "vault"
VAULT_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

VAULT_CATEGORIES = ["identity", "certification", "license", "health_record", "health_screen", "resume", "miscellaneous"]

# ==================== SPECIALTY LISTS ====================

NURSING_SPECIALTIES = [
    "Registered Nurse (RN) - General", "Registered Nurse (RN) - ICU/Critical Care",
    "Registered Nurse (RN) - Emergency Room", "Registered Nurse (RN) - Operating Room",
    "Registered Nurse (RN) - PACU", "Registered Nurse (RN) - Labor & Delivery",
    "Registered Nurse (RN) - Postpartum", "Registered Nurse (RN) - NICU",
    "Registered Nurse (RN) - Pediatrics", "Registered Nurse (RN) - Pediatric ICU",
    "Registered Nurse (RN) - Oncology", "Registered Nurse (RN) - Cardiac/Telemetry",
    "Registered Nurse (RN) - Cath Lab", "Registered Nurse (RN) - Med-Surg",
    "Registered Nurse (RN) - Step-Down", "Registered Nurse (RN) - Dialysis",
    "Registered Nurse (RN) - Home Health", "Registered Nurse (RN) - Hospice",
    "Registered Nurse (RN) - Psych/Mental Health", "Registered Nurse (RN) - Rehabilitation",
    "Registered Nurse (RN) - Long-Term Care", "Registered Nurse (RN) - Clinic/Outpatient",
    "Registered Nurse (RN) - School Nurse", "Registered Nurse (RN) - Case Manager",
    "Registered Nurse (RN) - Infection Control", "Registered Nurse (RN) - Wound Care",
    "Licensed Practical Nurse (LPN)", "Licensed Vocational Nurse (LVN)",
    "Nurse Practitioner (NP) - Family", "Nurse Practitioner (NP) - Adult-Gerontology",
    "Nurse Practitioner (NP) - Pediatrics", "Nurse Practitioner (NP) - Psychiatric",
    "Nurse Practitioner (NP) - Acute Care", "Nurse Practitioner (NP) - Women's Health",
    "Clinical Nurse Specialist (CNS)", "Certified Registered Nurse Anesthetist (CRNA)",
    "Certified Nurse Midwife (CNM)", "Certified Nursing Assistant (CNA)",
    "Patient Care Technician (PCT)", "Nurse Aide",
]

ALLIED_HEALTH_SPECIALTIES = [
    "Physical Therapist (PT)", "Physical Therapy Assistant (PTA)",
    "Occupational Therapist (OT)", "Occupational Therapy Assistant (OTA)",
    "Speech-Language Pathologist (SLP)", "Respiratory Therapist (RT)",
    "Recreational Therapist", "Radiologic Technologist", "CT Technologist",
    "MRI Technologist", "Ultrasound Technologist/Sonographer",
    "Mammography Technologist", "Nuclear Medicine Technologist",
    "Interventional Radiology Tech", "Medical Laboratory Technologist (MLT)",
    "Medical Laboratory Scientist (MLS)", "Phlebotomist", "Histotechnologist",
    "Cytotechnologist", "Pharmacist", "Pharmacy Technician", "Clinical Pharmacist",
    "Cardiovascular Technologist", "Echocardiographer", "EKG/ECG Technician",
    "Cardiac Sonographer", "Surgical Technologist", "Sterile Processing Technician",
    "First Surgical Assistant", "Emergency Medical Technician (EMT)",
    "Paramedic", "Critical Care Technician", "Licensed Clinical Social Worker (LCSW)",
    "Mental Health Counselor", "Psychiatric Technician", "Behavioral Health Technician",
    "Medical Assistant", "Certified Medical Assistant (CMA)", "Dietitian/Nutritionist",
    "Health Information Technician", "Medical Coder", "Patient Access Representative",
    "Unit Secretary/Clerk", "Physician Assistant (PA)", "Athletic Trainer",
    "Orthotist/Prosthetist", "Audiologist", "Optometrist", "Dental Hygienist", "Dental Assistant",
]

ALL_SPECIALTIES = NURSING_SPECIALTIES + ALLIED_HEALTH_SPECIALTIES

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def calculate_compatibility(seeker_profile: dict, job: dict) -> int:
    score = 0
    max_score = 0
    max_score += 30
    if seeker_profile.get('specialty', '').lower() == job.get('specialty', '').lower():
        score += 30
    elif seeker_profile.get('specialty', '').lower() in job.get('specialty', '').lower():
        score += 15
    max_score += 25
    seeker_exp = seeker_profile.get('years_experience', 0)
    required_exp = job.get('experience_required', 0)
    if seeker_exp >= required_exp:
        score += 25
    elif seeker_exp >= required_exp * 0.5:
        score += 12
    max_score += 20
    seeker_loc = seeker_profile.get('preferred_locations', [])
    job_loc = job.get('location', '').lower()
    if any(loc.lower() in job_loc for loc in seeker_loc):
        score += 20
    max_score += 15
    seeker_shift = seeker_profile.get('preferred_shift', '').lower()
    job_shift = job.get('shift_type', '').lower()
    if seeker_shift and job_shift and seeker_shift in job_shift:
        score += 15
    max_score += 10
    seeker_certs = [c.lower() for c in seeker_profile.get('certifications', [])]
    required_certs = [c.lower() for c in job.get('certifications_required', [])]
    if required_certs:
        matched = sum(1 for c in required_certs if c in seeker_certs)
        score += int(10 * (matched / len(required_certs)))
    else:
        score += 10
    return int((score / max_score * 100)) if max_score > 0 else 50


# ==================== SERVICES ====================

class NotificationService:
    @staticmethod
    async def send_email(to_email: str, subject: str, content: str) -> bool:
        if not SENDGRID_API_KEY:
            logger.warning(f"SendGrid not configured. Would send email to {to_email}: {subject}")
            return False
        try:
            message = Mail(from_email=Email(SENDGRID_FROM_EMAIL), to_emails=To(to_email), subject=subject, html_content=Content("text/html", content))
            sg = SendGridAPIClient(SENDGRID_API_KEY)
            response = sg.send(message)
            logger.info(f"Email sent to {to_email}, status: {response.status_code}")
            return response.status_code in [200, 202]
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            return False

    @staticmethod
    async def send_sms(to_phone: str, message: str) -> bool:
        logger.info(f"[Phase 1 - SMS disabled] Would send to {to_phone}: {message}")
        return False

    @staticmethod
    async def send_notification(user_id: str, subject: str, content: str, sms_content: str = None):
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        prefs = await db.notification_preferences.find_one({"user_id": user_id}, {"_id": 0})
        if not user or not prefs:
            return
        if prefs.get("email_enabled") and user.get("email"):
            await NotificationService.send_email(user["email"], subject, content)
        if prefs.get("sms_enabled") and prefs.get("phone_number"):
            await NotificationService.send_sms(prefs["phone_number"], sms_content or subject)

class LicenseVerificationService:
    STATUS_PENDING = "pending"
    STATUS_VERIFIED = "verified"
    STATUS_REJECTED = "rejected"

    @staticmethod
    async def verify_via_nursys(license_number, state, license_type, first_name, last_name):
        logger.info(f"[Phase 1 - Nursys disabled] Would verify license {license_number} in {state}")
        return {"success": False, "error": "Nursys API disabled for Phase 1 MVP", "status": "api_disabled"}

    @staticmethod
    async def create_verification_request(license_id, user_id, requested_by, verification_type="admin"):
        request_id = str(uuid.uuid4())
        verification_request = {
            "id": request_id, "license_id": license_id, "user_id": user_id,
            "requested_by": requested_by, "verification_type": verification_type,
            "status": "pending", "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(), "result": None, "notes": None,
        }
        await db.license_verifications.insert_one(verification_request)
        return {"id": request_id, "status": "pending"}

    @staticmethod
    async def process_admin_verification(request_id, admin_id, approved, notes=None):
        status = LicenseVerificationService.STATUS_VERIFIED if approved else LicenseVerificationService.STATUS_REJECTED
        await db.license_verifications.update_one(
            {"id": request_id},
            {"$set": {"status": status, "verified_by": admin_id, "updated_at": datetime.now(timezone.utc).isoformat(), "notes": notes, "result": {"approved": approved, "verified_at": datetime.now(timezone.utc).isoformat()}}}
        )
        verification = await db.license_verifications.find_one({"id": request_id}, {"_id": 0})
        if verification:
            await db.seeker_licenses.update_one(
                {"id": verification["license_id"]},
                {"$set": {"verification_status": status, "verified_at": datetime.now(timezone.utc).isoformat(), "verified_by": admin_id}}
            )
        return {"status": status, "request_id": request_id}


# ==================== PYDANTIC MODELS ====================

class UserRegister(BaseModel):
    email: str
    password: str
    full_name: str
    role: str

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    role: str
    full_name: str
    profile_complete: bool = False
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    user: UserResponse

class SeekerProfile(BaseModel):
    full_name: Optional[str] = None
    specialty: Optional[str] = None
    years_experience: Optional[int] = 0
    license_type: Optional[str] = None
    license_state: Optional[str] = None
    license_number: Optional[str] = None
    preferred_locations: Optional[List[str]] = []
    preferred_shift: Optional[str] = None
    availability_date: Optional[str] = None
    phone: Optional[str] = None
    bio: Optional[str] = None
    skills: Optional[List[str]] = []
    certifications: Optional[List[str]] = []
    education: Optional[List[Dict[str, Any]]] = []
    work_history: Optional[List[Dict[str, Any]]] = []
    profile_photo_url: Optional[str] = None

class PosterProfile(BaseModel):
    full_name: Optional[str] = None
    company_name: Optional[str] = None
    company_size: Optional[str] = None
    company_type: Optional[str] = None
    location: Optional[str] = None
    about: Optional[str] = None
    logo_url: Optional[str] = None

class JobPosting(BaseModel):
    title: str
    description: str
    location: str
    duration: Optional[str] = None
    pay_range: Optional[Dict[str, Any]] = {"min": 0, "max": 0}
    benefits: Optional[List[str]] = []
    time_off_policy: Optional[str] = None
    requirements: Optional[List[str]] = []
    certifications_required: Optional[List[str]] = []
    experience_required: Optional[int] = 0
    specialty: str
    shift_type: Optional[str] = None
    start_date: Optional[str] = None
    # Hiring workflow configuration
    application_workflow_type: Optional[str] = "in_platform_only"  # in_platform_only, external_required_immediately, external_required_after_match, external_optional
    external_application_url: Optional[str] = None
    external_application_stage: Optional[str] = None  # before_match, after_match, after_offer
    profile_sufficient_for_initial_review: Optional[bool] = True
    required_additional_fields: Optional[str] = None

class SwipeAction(BaseModel):
    target_id: str
    action: str

class EmploymentOffer(BaseModel):
    match_id: str
    job_id: str
    seeker_id: str
    position_title: str
    salary_amount: float
    salary_type: str = "annual"
    start_date: str
    expiration_date: str
    conditions: List[str] = []
    benefits_summary: Optional[str] = None
    additional_terms: Optional[str] = None

class OfferResponse(BaseModel):
    accepted: bool
    notes: Optional[str] = None

class VaultDocumentCreate(BaseModel):
    category: str
    subtype: Optional[str] = None
    issuing_authority: Optional[str] = None
    document_number: Optional[str] = None
    issue_date: Optional[str] = None
    expiration_date: Optional[str] = None
    document_date: Optional[str] = None
    state: Optional[str] = None
    file_url: Optional[str] = None
    file_data: Optional[str] = None
    file_name: Optional[str] = None
    extracted_fields: Optional[Dict[str, Any]] = None

class VaultDocumentUpdate(BaseModel):
    category: Optional[str] = None
    subtype: Optional[str] = None
    issuing_authority: Optional[str] = None
    document_number: Optional[str] = None
    issue_date: Optional[str] = None
    expiration_date: Optional[str] = None
    document_date: Optional[str] = None
    state: Optional[str] = None
    file_url: Optional[str] = None
    extracted_fields: Optional[Dict[str, Any]] = None

class AdminRequirementUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    vault_document_id: Optional[str] = None

class TrainingCourseCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    category: Optional[str] = "general"
    provider: Optional[str] = "internal"
    external_course_id: Optional[str] = None
    credit_hours: Optional[float] = 0
    credit_type: Optional[str] = "CEU"
    duration_minutes: Optional[int] = 0
    launch_url: Optional[str] = None

class TrainingAssignmentCreate(BaseModel):
    user_id: str
    course_id: str
    due_date: Optional[str] = None
    job_id: Optional[str] = None

class TrainingAssignmentUpdate(BaseModel):
    completion_status: Optional[str] = None
    score: Optional[float] = None
    certificate_url: Optional[str] = None
    notes: Optional[str] = None

class ComplianceRequirementCreate(BaseModel):
    role_type: str
    course_id: str
    is_mandatory: bool = True
    job_id: Optional[str] = None

class DirectMessage(BaseModel):
    content: str

class LicenseCreate(BaseModel):
    license_type: str
    license_number: str
    state: str
    expiration_date: Optional[str] = None
    issuing_authority: Optional[str] = None
    compact_state: Optional[bool] = False

class NotificationPreferences(BaseModel):
    email_enabled: Optional[bool] = True
    sms_enabled: Optional[bool] = False
    phone_number: Optional[str] = None
    frequency: Optional[str] = "immediate"
    match_notifications: Optional[bool] = True
    message_notifications: Optional[bool] = True
    document_reminders: Optional[bool] = True
