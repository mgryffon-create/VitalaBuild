from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import base64
import aiofiles
import asyncio
from contextlib import asynccontextmanager
from onboarding_logic import create_onboarding_case, compute_case_status, compute_progress, RESOLVED_STATUSES
from audit_log import log_audit
from training_service import create_training_course, assign_training, get_compliance_summary

# SendGrid and Twilio imports (Phase 1: Twilio disabled, SendGrid mocked)
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content
# from twilio.rest import Client as TwilioClient  # Phase 1: SMS disabled

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET')
if not JWT_SECRET:
    raise ValueError("JWT_SECRET environment variable must be set")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# SendGrid Configuration
SENDGRID_API_KEY = os.environ.get('SENDGRID_API_KEY')
SENDGRID_FROM_EMAIL = os.environ.get('SENDGRID_FROM_EMAIL', 'noreply@vitalamatch.com')

# Twilio Configuration
TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID')
TWILIO_API_KEY = os.environ.get('TWILIO_API_KEY')
TWILIO_API_SECRET = os.environ.get('TWILIO_API_SECRET')
TWILIO_PHONE_NUMBER = os.environ.get('TWILIO_PHONE_NUMBER')

# Nursys Configuration (License Verification)
NURSYS_API_KEY = os.environ.get('NURSYS_API_KEY')
NURSYS_API_URL = os.environ.get('NURSYS_API_URL', 'https://www.nursys.com/api/v1')

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== SPECIALTY LISTS ====================

NURSING_SPECIALTIES = [
    # Registered Nurses
    "Registered Nurse (RN) - General",
    "Registered Nurse (RN) - ICU/Critical Care",
    "Registered Nurse (RN) - Emergency Room",
    "Registered Nurse (RN) - Operating Room",
    "Registered Nurse (RN) - PACU",
    "Registered Nurse (RN) - Labor & Delivery",
    "Registered Nurse (RN) - Postpartum",
    "Registered Nurse (RN) - NICU",
    "Registered Nurse (RN) - Pediatrics",
    "Registered Nurse (RN) - Pediatric ICU",
    "Registered Nurse (RN) - Oncology",
    "Registered Nurse (RN) - Cardiac/Telemetry",
    "Registered Nurse (RN) - Cath Lab",
    "Registered Nurse (RN) - Med-Surg",
    "Registered Nurse (RN) - Step-Down",
    "Registered Nurse (RN) - Dialysis",
    "Registered Nurse (RN) - Home Health",
    "Registered Nurse (RN) - Hospice",
    "Registered Nurse (RN) - Psych/Mental Health",
    "Registered Nurse (RN) - Rehabilitation",
    "Registered Nurse (RN) - Long-Term Care",
    "Registered Nurse (RN) - Clinic/Outpatient",
    "Registered Nurse (RN) - School Nurse",
    "Registered Nurse (RN) - Case Manager",
    "Registered Nurse (RN) - Infection Control",
    "Registered Nurse (RN) - Wound Care",
    # Licensed Practical Nurses
    "Licensed Practical Nurse (LPN)",
    "Licensed Vocational Nurse (LVN)",
    # Advanced Practice
    "Nurse Practitioner (NP) - Family",
    "Nurse Practitioner (NP) - Adult-Gerontology",
    "Nurse Practitioner (NP) - Pediatrics",
    "Nurse Practitioner (NP) - Psychiatric",
    "Nurse Practitioner (NP) - Acute Care",
    "Nurse Practitioner (NP) - Women's Health",
    "Clinical Nurse Specialist (CNS)",
    "Certified Registered Nurse Anesthetist (CRNA)",
    "Certified Nurse Midwife (CNM)",
    # Nursing Assistants
    "Certified Nursing Assistant (CNA)",
    "Patient Care Technician (PCT)",
    "Nurse Aide",
]

ALLIED_HEALTH_SPECIALTIES = [
    # Therapy
    "Physical Therapist (PT)",
    "Physical Therapy Assistant (PTA)",
    "Occupational Therapist (OT)",
    "Occupational Therapy Assistant (OTA)",
    "Speech-Language Pathologist (SLP)",
    "Respiratory Therapist (RT)",
    "Recreational Therapist",
    # Radiology & Imaging
    "Radiologic Technologist",
    "CT Technologist",
    "MRI Technologist",
    "Ultrasound Technologist/Sonographer",
    "Mammography Technologist",
    "Nuclear Medicine Technologist",
    "Interventional Radiology Tech",
    # Laboratory
    "Medical Laboratory Technologist (MLT)",
    "Medical Laboratory Scientist (MLS)",
    "Phlebotomist",
    "Histotechnologist",
    "Cytotechnologist",
    # Pharmacy
    "Pharmacist",
    "Pharmacy Technician",
    "Clinical Pharmacist",
    # Cardiovascular
    "Cardiovascular Technologist",
    "Echocardiographer",
    "EKG/ECG Technician",
    "Cardiac Sonographer",
    # Surgical
    "Surgical Technologist",
    "Sterile Processing Technician",
    "First Surgical Assistant",
    # Emergency & Critical Care
    "Emergency Medical Technician (EMT)",
    "Paramedic",
    "Critical Care Technician",
    # Mental Health
    "Licensed Clinical Social Worker (LCSW)",
    "Mental Health Counselor",
    "Psychiatric Technician",
    "Behavioral Health Technician",
    # Other Allied Health
    "Medical Assistant",
    "Certified Medical Assistant (CMA)",
    "Dietitian/Nutritionist",
    "Health Information Technician",
    "Medical Coder",
    "Patient Access Representative",
    "Unit Secretary/Clerk",
    "Physician Assistant (PA)",
    "Athletic Trainer",
    "Orthotist/Prosthetist",
    "Audiologist",
    "Optometrist",
    "Dental Hygienist",
    "Dental Assistant",
]

# ==================== NOTIFICATION SERVICES ====================

class NotificationService:
    """Service for sending email and SMS notifications"""
    
    @staticmethod
    async def send_email(to_email: str, subject: str, content: str) -> bool:
        """Send email via SendGrid"""
        if not SENDGRID_API_KEY:
            logger.warning(f"SendGrid not configured. Would send email to {to_email}: {subject}")
            return False
        
        try:
            message = Mail(
                from_email=Email(SENDGRID_FROM_EMAIL),
                to_emails=To(to_email),
                subject=subject,
                html_content=Content("text/html", content)
            )
            sg = SendGridAPIClient(SENDGRID_API_KEY)
            response = sg.send(message)
            logger.info(f"Email sent to {to_email}, status: {response.status_code}")
            return response.status_code in [200, 202]
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            return False
    
    @staticmethod
    async def send_sms(to_phone: str, message: str) -> bool:
        """Send SMS via Twilio — DISABLED for Phase 1 MVP"""
        logger.info(f"[Phase 1 - SMS disabled] Would send to {to_phone}: {message}")
        return False
    
    @staticmethod
    async def send_notification(user_id: str, subject: str, content: str, sms_content: str = None):
        """Send notification based on user preferences"""
        # Get user and preferences
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        prefs = await db.notification_preferences.find_one({"user_id": user_id}, {"_id": 0})
        
        if not user or not prefs:
            return
        
        # Check frequency - for now, always send if enabled
        if prefs.get("email_enabled") and user.get("email"):
            await NotificationService.send_email(user["email"], subject, content)
        
        if prefs.get("sms_enabled") and prefs.get("phone_number"):
            await NotificationService.send_sms(prefs["phone_number"], sms_content or subject)

# ==================== LICENSE VERIFICATION SERVICE ====================

class LicenseVerificationService:
    """Service for verifying nursing and allied health licenses"""
    
    # License verification statuses
    STATUS_PENDING = "pending"
    STATUS_VERIFIED = "verified"
    STATUS_REJECTED = "rejected"
    STATUS_NURSYS_PENDING = "nursys_pending"
    STATUS_NURSYS_VERIFIED = "nursys_verified"
    STATUS_NURSYS_FAILED = "nursys_failed"
    
    @staticmethod
    async def verify_via_nursys(license_number: str, state: str, license_type: str, first_name: str, last_name: str) -> dict:
        """
        Verify a nursing license via Nursys API — DISABLED for Phase 1 MVP
        """
        logger.info(f"[Phase 1 - Nursys disabled] Would verify license {license_number} in {state}")
        return {
            "success": False,
            "error": "Nursys API disabled for Phase 1 MVP",
            "status": "api_disabled"
        }
    
    @staticmethod
    async def create_verification_request(
        license_id: str,
        user_id: str,
        requested_by: str,
        verification_type: str = "admin"
    ) -> dict:
        """Create a license verification request"""
        request_id = str(uuid.uuid4())
        
        verification_request = {
            "id": request_id,
            "license_id": license_id,
            "user_id": user_id,  # Owner of the license
            "requested_by": requested_by,  # Admin or employer who requested
            "verification_type": verification_type,  # "admin", "nursys", "document"
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "result": None,
            "notes": None
        }
        
        await db.license_verifications.insert_one(verification_request)
        return {"id": request_id, "status": "pending"}
    
    @staticmethod
    async def process_admin_verification(
        request_id: str,
        admin_id: str,
        approved: bool,
        notes: str = None
    ) -> dict:
        """Process an admin verification decision"""
        status = LicenseVerificationService.STATUS_VERIFIED if approved else LicenseVerificationService.STATUS_REJECTED
        
        await db.license_verifications.update_one(
            {"id": request_id},
            {
                "$set": {
                    "status": status,
                    "verified_by": admin_id,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "notes": notes,
                    "result": {
                        "approved": approved,
                        "verified_at": datetime.now(timezone.utc).isoformat()
                    }
                }
            }
        )
        
        # Also update the license record itself
        verification = await db.license_verifications.find_one({"id": request_id}, {"_id": 0})
        if verification:
            await db.seeker_licenses.update_one(
                {"id": verification["license_id"]},
                {
                    "$set": {
                        "verification_status": status,
                        "verified_at": datetime.now(timezone.utc).isoformat(),
                        "verified_by": admin_id
                    }
                }
            )
        
        return {"status": status, "request_id": request_id}

# ==================== BACKGROUND SCHEDULER ====================

class DocumentExpirationChecker:
    """Background job for checking document expirations weekly"""
    
    @staticmethod
    async def check_expiring_documents():
        """Check for documents expiring within 30 days and send reminders"""
        logger.info("Running weekly document expiration check...")
        
        threshold = datetime.now(timezone.utc) + timedelta(days=30)
        
        # Get all documents
        docs = await db.documents.find({}, {"_id": 0, "file_data": 0}).to_list(10000)
        
        users_to_notify = {}  # user_id -> list of expiring docs
        
        for doc in docs:
            if doc.get("expiration_date"):
                try:
                    if 'T' in doc["expiration_date"]:
                        expiration = datetime.fromisoformat(doc["expiration_date"].replace('Z', '+00:00'))
                    else:
                        expiration = datetime.strptime(doc["expiration_date"], '%Y-%m-%d').replace(tzinfo=timezone.utc)
                    
                    if expiration <= threshold:
                        user_id = doc["user_id"]
                        days_left = (expiration - datetime.now(timezone.utc)).days
                        
                        if user_id not in users_to_notify:
                            users_to_notify[user_id] = []
                        
                        users_to_notify[user_id].append({
                            "document_type": doc["document_type"],
                            "days_left": days_left,
                            "expiration_date": doc["expiration_date"]
                        })
                except ValueError:
                    pass
        
        # Send notifications to users
        for user_id, expiring_docs in users_to_notify.items():
            prefs = await db.notification_preferences.find_one({"user_id": user_id}, {"_id": 0})
            
            if prefs and prefs.get("document_reminders", True):
                # Build notification content
                doc_items = []
                for d in expiring_docs:
                    days = d['days_left']
                    doc_type = d['document_type']
                    status = "EXPIRED" if days <= 0 else f"{days} days left"
                    doc_items.append(f"• {doc_type} - {status}")
                doc_list = "\n".join(doc_items)
                
                subject = f"VitalaMatch: {len(expiring_docs)} Document(s) Need Attention"
                
                # Build HTML content
                html_items = []
                for d in expiring_docs:
                    days = d['days_left']
                    doc_type = d['document_type']
                    if days <= 0:
                        status_html = '<span style="color:red">EXPIRED</span>'
                    else:
                        status_html = f"{days} days until expiration"
                    html_items.append(f"<li><strong>{doc_type}</strong> - {status_html}</li>")
                
                html_content = f"""
                <h2>Document Expiration Reminder</h2>
                <p>The following documents need your attention:</p>
                <ul>
                {''.join(html_items)}
                </ul>
                <p>Please log in to VitalaMatch to upload renewed documents.</p>
                """
                
                sms_content = f"VitalaMatch: {len(expiring_docs)} document(s) expiring soon. Log in to renew."
                
                await NotificationService.send_notification(user_id, subject, html_content, sms_content)
                
                # Log the reminder
                await db.notification_logs.insert_one({
                    "id": str(uuid.uuid4()),
                    "user_id": user_id,
                    "type": "document_expiration",
                    "documents": expiring_docs,
                    "sent_at": datetime.now(timezone.utc).isoformat()
                })
        
        logger.info(f"Document expiration check complete. Notified {len(users_to_notify)} users.")
        return len(users_to_notify)

async def run_weekly_scheduler():
    """Run the weekly document expiration checker"""
    while True:
        try:
            await DocumentExpirationChecker.check_expiring_documents()
        except Exception as e:
            logger.error(f"Error in weekly scheduler: {str(e)}")
        
        # Wait for 7 days (604800 seconds)
        await asyncio.sleep(604800)

# Lifespan context manager for startup/shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting VitalaMatch API...")
    
    # Start the weekly scheduler in the background
    scheduler_task = asyncio.create_task(run_weekly_scheduler())
    logger.info("Weekly document expiration scheduler started")
    
    yield
    
    # Shutdown
    scheduler_task.cancel()
    try:
        await scheduler_task
    except asyncio.CancelledError:
        pass
    client.close()
    logger.info("VitalaMatch API shutdown complete")

# Create the main app with lifespan
app = FastAPI(title="VitalaMatch API", lifespan=lifespan)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# ==================== MODELS ====================

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    role: str  # 'seeker' or 'poster'
    full_name: str

class UserLogin(BaseModel):
    email: EmailStr
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
    token_type: str = "bearer"
    user: UserResponse

class SeekerProfile(BaseModel):
    contact_info: Optional[Dict[str, Any]] = None
    work_history: Optional[List[Dict[str, Any]]] = None
    certifications: Optional[List[Dict[str, Any]]] = None
    licenses: Optional[List[Dict[str, Any]]] = None
    expected_pay: Optional[Dict[str, Any]] = None
    desired_benefits: Optional[List[str]] = None
    medical_records: Optional[List[Dict[str, Any]]] = None
    bio: Optional[str] = None
    specialty: Optional[str] = None
    years_experience: Optional[int] = None
    preferred_locations: Optional[List[str]] = None
    profile_image: Optional[str] = None
    # Phase 2: Structured employer-facing fields
    preferred_shift: Optional[str] = None
    availability: Optional[str] = None
    travel_readiness: Optional[str] = None
    job_type_preference: Optional[str] = None
    experience_highlights: Optional[List[str]] = None
    skills: Optional[List[str]] = None
    # Phase 2: Worker protection preferences
    schedule_stability_importance: Optional[str] = None  # Low, Medium, High
    overtime_preference: Optional[str] = None  # Avoid overtime, Open to overtime, Prefer overtime
    overtime_pressure_tolerance: Optional[str] = None  # Not acceptable, Acceptable occasionally, Comfortable with frequent overtime
    shift_cancellation_tolerance: Optional[str] = None  # Not acceptable, Acceptable occasionally, Flexible
    staffing_tolerance: Optional[str] = None  # Only well-staffed environments, Moderate flexibility, Comfortable in high-acuity / short-staffed environments
    floating_tolerance: Optional[str] = None  # Do not float, Occasional floating acceptable, Flexible
    pay_transparency_importance: Optional[str] = None  # Critical, Important, Flexible

class PosterProfile(BaseModel):
    company_name: Optional[str] = None
    company_description: Optional[str] = None
    company_logo: Optional[str] = None
    contact_info: Optional[Dict[str, Any]] = None
    facility_images: Optional[List[str]] = None
    # Phase 2: Structured facility profile (required for full access)
    staffing_expectation: Optional[str] = None  # Well-staffed, Moderate, High-acuity
    floating_expectation: Optional[str] = None  # None, Occasional, Frequent
    schedule_structure: Optional[str] = None  # Fixed, Rotating, Variable
    overtime_policy: Optional[str] = None  # Rare/optional, Available, Expected
    cancellation_policy: Optional[str] = None  # Rare, Occasional, Frequent
    contract_accuracy_confidence: Optional[str] = None  # High, Moderate, Variable

class JobPosting(BaseModel):
    title: str
    description: str
    location: str
    duration: str
    pay_range: Dict[str, Any]
    benefits: List[str]
    time_off_policy: str
    requirements: List[str]
    certifications_required: List[str]
    experience_required: int
    specialty: str
    shift_type: Optional[str] = None
    start_date: Optional[str] = None
    # Hiring workflow configuration
    application_workflow_type: Optional[str] = "in_platform_only"  # in_platform_only, external_required_immediately, external_required_after_match, external_optional
    external_application_url: Optional[str] = None
    external_application_stage: Optional[str] = None  # before_match, after_match, after_offer
    profile_sufficient_for_initial_review: Optional[bool] = True
    required_additional_fields: Optional[str] = None

class JobPostingResponse(BaseModel):
    id: str
    poster_id: str
    title: str
    description: str
    location: str
    duration: str
    pay_range: Dict[str, Any]
    benefits: List[str]
    time_off_policy: str
    requirements: List[str]
    certifications_required: List[str]
    experience_required: int
    specialty: str
    shift_type: Optional[str] = None
    start_date: Optional[str] = None
    created_at: str
    is_active: bool = True
    company_name: Optional[str] = None
    company_logo: Optional[str] = None
    # Hiring workflow configuration
    application_workflow_type: Optional[str] = "in_platform_only"
    external_application_url: Optional[str] = None
    external_application_stage: Optional[str] = None
    profile_sufficient_for_initial_review: Optional[bool] = True
    required_additional_fields: Optional[str] = None

class SwipeAction(BaseModel):
    target_id: str  # job_id for seekers, seeker_id for posters
    action: str  # 'like', 'pass', or 'maybe'

# ==================== NEW MODELS FOR ENHANCED FEATURES ====================

class DirectMessage(BaseModel):
    content: str
    reply_to_id: Optional[str] = None

class InterviewRequest(BaseModel):
    match_id: str
    proposed_times: List[str]  # ISO datetime strings
    duration_minutes: int = 60
    meeting_type: str = "video"  # video, phone, in_person
    notes: Optional[str] = None
    calendly_link: Optional[str] = None
    zoom_link: Optional[str] = None

class InterviewResponse(BaseModel):
    accepted: bool
    selected_time: Optional[str] = None
    meeting_link: Optional[str] = None
    notes: Optional[str] = None

class FeedPost(BaseModel):
    content: str  # Max 140 characters
    image_data: Optional[str] = None  # Base64 encoded image
    visibility: str = "everyone"  # everyone, matches_only
    comment_permission: str = "everyone"  # everyone, matches_only, none

class FeedComment(BaseModel):
    content: str

class CalendlyConfig(BaseModel):
    calendly_link: str
    access_token: Optional[str] = None

class ZoomConfig(BaseModel):
    zoom_link: Optional[str] = None
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None

class BusinessEmailVerification(BaseModel):
    business_email: str

class BusinessEmailVerifyToken(BaseModel):
    token: str

# ==================== HIRING SUITE MODELS ====================

class EmploymentOffer(BaseModel):
    match_id: str
    job_id: str
    seeker_id: str
    position_title: str
    salary_amount: float
    salary_type: str = "annual"  # annual, hourly
    start_date: str
    expiration_date: str
    conditions: List[str] = []
    benefits_summary: Optional[str] = None
    additional_terms: Optional[str] = None

class OfferResponse(BaseModel):
    accepted: bool
    notes: Optional[str] = None

# ==================== VAULT & ONBOARDING MODELS ====================

class VaultDocumentCreate(BaseModel):
    category: str  # identity, certification, license, health_record, health_screen, resume, miscellaneous
    subtype: Optional[str] = None
    issuing_authority: Optional[str] = None
    document_number: Optional[str] = None
    issue_date: Optional[str] = None
    expiration_date: Optional[str] = None
    document_date: Optional[str] = None
    state: Optional[str] = None
    file_url: Optional[str] = None
    file_data: Optional[str] = None  # Base64 encoded
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

class OnboardingChecklistItem(BaseModel):
    name: str
    description: Optional[str] = None
    required: bool = True
    due_days: int = 7  # Days after offer acceptance

class OnboardingChecklist(BaseModel):
    employment_id: str
    items: List[OnboardingChecklistItem]

class HiringDocument(BaseModel):
    employment_id: str
    document_type: str  # i9, w4, state_tax, direct_deposit, emergency_contact, policy_ack
    form_data: dict
    signature: Optional[str] = None  # Base64 signature image
    signed_at: Optional[str] = None

class PolicyDocument(BaseModel):
    title: str
    description: Optional[str] = None
    file_data: str  # Base64 encoded PDF
    file_name: str
    requires_signature: bool = True
    version: str = "1.0"

class PolicySignature(BaseModel):
    policy_id: str
    signature: str  # Base64 signature image

class EmploymentReview(BaseModel):
    employment_id: str
    rating: int  # 1-5 stars
    communication_rating: int = 0
    professionalism_rating: int = 0
    reliability_rating: int = 0
    review_text: str
    would_recommend: bool = True

class ReferenceRequest(BaseModel):
    referee_email: EmailStr
    referee_name: str
    relationship: str
    message: Optional[str] = None

class ReferenceSubmission(BaseModel):
    token: str
    rating: int
    strengths: List[str]
    areas_for_improvement: Optional[str] = None
    recommendation: str
    comments: str
    would_work_again: bool

class NotificationPreferences(BaseModel):
    email_enabled: bool = True
    sms_enabled: bool = False
    phone_number: Optional[str] = None
    frequency: str = "immediate"  # immediate, daily, weekly
    match_notifications: bool = True
    message_notifications: bool = True
    document_reminders: bool = True

class Message(BaseModel):
    content: str

class DocumentUpload(BaseModel):
    document_type: str
    expiration_date: Optional[str] = None
    file_data: str  # base64 encoded
    file_name: str

# License Verification Models
class LicenseCreate(BaseModel):
    license_type: str  # e.g., "RN", "LPN", "NP"
    license_number: str
    state: str
    expiration_date: Optional[str] = None
    compact_license: bool = False
    document_id: Optional[str] = None  # Reference to uploaded document

class LicenseResponse(BaseModel):
    id: str
    user_id: str
    license_type: str
    license_number: str
    state: str
    expiration_date: Optional[str] = None
    compact_license: bool = False
    verification_status: str = "pending"  # pending, verified, rejected, nursys_verified
    verified_at: Optional[str] = None
    verified_by: Optional[str] = None
    document_id: Optional[str] = None
    created_at: str

class VerificationRequest(BaseModel):
    license_id: str
    verification_type: str = "admin"  # admin, nursys

class AdminVerificationDecision(BaseModel):
    approved: bool
    notes: Optional[str] = None

class NursysVerificationRequest(BaseModel):
    license_id: str
    seeker_id: str  # The job seeker whose license to verify

# ==================== HELPER FUNCTIONS ====================

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
    """Calculate compatibility score between seeker and job posting"""
    score = 0
    max_score = 0
    
    # Specialty match (30 points)
    max_score += 30
    if seeker_profile.get('specialty', '').lower() == job.get('specialty', '').lower():
        score += 30
    elif seeker_profile.get('specialty', '').lower() in job.get('specialty', '').lower():
        score += 15
    
    # Experience match (25 points)
    max_score += 25
    seeker_exp = seeker_profile.get('years_experience', 0)
    required_exp = job.get('experience_required', 0)
    if seeker_exp >= required_exp:
        score += 25
    elif seeker_exp >= required_exp - 1:
        score += 15
    
    # Location preference (20 points)
    max_score += 20
    preferred_locations = seeker_profile.get('preferred_locations', [])
    job_location = job.get('location', '')
    if any(loc.lower() in job_location.lower() for loc in preferred_locations):
        score += 20
    
    # Certifications match (15 points)
    max_score += 15
    # Handle certifications as either list of strings or list of objects with 'name' key
    raw_certs = seeker_profile.get('certifications', [])
    seeker_certs = []
    for c in raw_certs:
        if isinstance(c, str):
            seeker_certs.append(c.lower())
        elif isinstance(c, dict):
            seeker_certs.append(c.get('name', '').lower())
    required_certs = [c.lower() for c in job.get('certifications_required', [])]
    if required_certs:
        matched_certs = sum(1 for rc in required_certs if any(rc in sc for sc in seeker_certs))
        score += int(15 * (matched_certs / len(required_certs)))
    else:
        score += 15
    
    # Benefits match (10 points)
    max_score += 10
    desired_benefits = [b.lower() for b in seeker_profile.get('desired_benefits', [])]
    offered_benefits = [b.lower() for b in job.get('benefits', [])]
    if desired_benefits and offered_benefits:
        matched_benefits = sum(1 for db in desired_benefits if any(db in ob for ob in offered_benefits))
        score += int(10 * (matched_benefits / len(desired_benefits)))
    else:
        score += 5
    
    return int((score / max_score) * 100) if max_score > 0 else 50

# ==================== AUTH ROUTES (moved to routes/auth.py) ====================

# ==================== PROFILE ROUTES ====================

@api_router.get("/profile/seeker")
async def get_seeker_profile(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "seeker":
        raise HTTPException(status_code=403, detail="Not a job seeker")
    
    profile = await db.seeker_profiles.find_one({"user_id": current_user["id"]}, {"_id": 0})
    return profile or {}


@api_router.get("/profile/completion")
async def get_profile_completion(current_user: dict = Depends(get_current_user)):
    """Get profile completion status for onboarding gating"""
    if current_user["role"] == "seeker":
        profile = await db.seeker_profiles.find_one({"user_id": current_user["id"]}, {"_id": 0}) or {}
        checks = {
            "specialty": bool(profile.get("specialty")),
            "years_experience": bool(profile.get("years_experience")),
            "availability": bool(profile.get("availability")),
            "preferred_shift": bool(profile.get("preferred_shift")),
            "travel_readiness": bool(profile.get("travel_readiness")),
            "job_type_preference": bool(profile.get("job_type_preference")),
            "experience_highlights": len(profile.get("experience_highlights", []) or []) >= 2,
            "certifications_or_licenses": bool(profile.get("certifications")) or bool(profile.get("licenses")),
        }
        filled = sum(1 for v in checks.values() if v)
        total = len(checks)
        return {
            "role": "seeker",
            "complete": filled == total,
            "percentage": round(filled / total * 100),
            "filled": filled,
            "total": total,
            "checks": checks,
        }
    elif current_user["role"] == "poster":
        profile = await db.poster_profiles.find_one({"user_id": current_user["id"]}, {"_id": 0}) or {}
        job_count = await db.jobs.count_documents({"poster_id": current_user["id"]})
        # Check if at least one job has required fields
        complete_job = await db.jobs.find_one({
            "poster_id": current_user["id"],
            "specialty": {"$exists": True, "$ne": None, "$ne": ""},
            "location": {"$exists": True, "$ne": None, "$ne": ""},
        }, {"_id": 0, "id": 1})
        checks = {
            "company_name": bool(profile.get("company_name")),
            "company_description": bool(profile.get("company_description")),
            "contact_info": bool(profile.get("contact_info")),
            "has_job_posted": job_count > 0,
            "has_complete_job": bool(complete_job),
        }
        filled = sum(1 for v in checks.values() if v)
        total = len(checks)
        return {
            "role": "poster",
            "complete": filled == total,
            "percentage": round(filled / total * 100),
            "filled": filled,
            "total": total,
            "checks": checks,
        }
    return {"role": current_user["role"], "complete": True, "percentage": 100, "filled": 0, "total": 0, "checks": {}}



@api_router.put("/profile/seeker")
async def update_seeker_profile(profile: SeekerProfile, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "seeker":
        raise HTTPException(status_code=403, detail="Not a job seeker")
    
    profile_data = profile.model_dump(exclude_none=True)
    profile_data["user_id"] = current_user["id"]
    profile_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.seeker_profiles.update_one(
        {"user_id": current_user["id"]},
        {"$set": profile_data},
        upsert=True
    )
    
    # Mark profile as complete if minimum fields are filled
    if profile.contact_info and profile.specialty:
        await db.users.update_one({"id": current_user["id"]}, {"$set": {"profile_complete": True}})
    
    return {"message": "Profile updated successfully"}

@api_router.post("/profile/parse-resume")
async def parse_resume(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """Parse a resume file and extract profile information"""
    if current_user["role"] != "seeker":
        raise HTTPException(status_code=403, detail="Not a job seeker")
    
    # Validate file type
    allowed_types = ["application/pdf", "application/msword", 
                     "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                     "text/plain"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload PDF, DOC, DOCX, or TXT")
    
    # Read file content
    content = await file.read()
    
    # For text files, decode directly
    if file.content_type == "text/plain":
        text_content = content.decode("utf-8", errors="ignore")
    else:
        # For PDF/DOC files, we'll extract text (simplified - in production use PyPDF2 or similar)
        try:
            # Try to decode as text first (for some PDFs)
            text_content = content.decode("utf-8", errors="ignore")
            # If it looks like binary, extract readable parts
            if len([c for c in text_content[:100] if c.isalpha()]) < 20:
                # Extract readable ASCII text from binary
                import re
                text_content = re.sub(r'[^\x20-\x7E\n\r]', ' ', content.decode("latin-1", errors="ignore"))
                text_content = re.sub(r'\s+', ' ', text_content).strip()
        except Exception:
            text_content = ""
    
    if len(text_content) < 50:
        raise HTTPException(status_code=400, detail="Could not extract text from resume. Please try a different format.")
    
    # Parse resume using pattern matching (simplified version)
    # In production, this would use an LLM API for better extraction
    parsed_data = await parse_resume_text(text_content)
    
    return parsed_data

async def parse_resume_text(text: str) -> dict:
    """Extract profile information from resume text"""
    import re
    
    result = {
        "bio": "",
        "specialty": None,
        "years_experience": None,
        "skills": [],
        "work_history": [],
        "certifications": [],
        "contact_info": {}
    }
    
    # Extract email
    email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', text)
    if email_match:
        result["contact_info"]["email"] = email_match.group()
    
    # Extract phone
    phone_match = re.search(r'[\(]?\d{3}[\)\s\.-]?\s?\d{3}[\s\.-]?\d{4}', text)
    if phone_match:
        result["contact_info"]["phone"] = phone_match.group()
    
    # Extract skills (common healthcare keywords)
    healthcare_skills = [
        "BLS", "ACLS", "PALS", "NRP", "CPR", "IV Therapy", "Wound Care",
        "Patient Assessment", "Electronic Medical Records", "EMR", "EHR",
        "Epic", "Cerner", "Meditech", "Critical Care", "ICU", "Emergency",
        "Pediatric", "Geriatric", "Oncology", "Cardiology", "Orthopedic",
        "Surgical", "Medical-Surgical", "Telemetry", "Labor and Delivery",
        "NICU", "PICU", "OR", "PACU", "Dialysis", "Chemotherapy",
        "Phlebotomy", "Medication Administration", "Patient Education",
        "Care Planning", "Discharge Planning", "Team Leadership"
    ]
    
    text_lower = text.lower()
    for skill in healthcare_skills:
        if skill.lower() in text_lower:
            result["skills"].append(skill)
    
    # Extract years of experience
    exp_match = re.search(r'(\d+)\+?\s*(?:years?|yrs?)(?:\s+of)?\s+(?:experience|exp)', text_lower)
    if exp_match:
        result["years_experience"] = int(exp_match.group(1))
    
    # Detect specialty from keywords
    specialty_keywords = {
        "Registered Nurse": ["registered nurse", "rn ", " rn,", "rn-"],
        "Licensed Practical Nurse": ["licensed practical nurse", "lpn", "lvn"],
        "Certified Nursing Assistant": ["certified nursing assistant", "cna", "nursing assistant"],
        "Nurse Practitioner": ["nurse practitioner", "np ", "aprn", "fnp", "anp"],
        "Physical Therapist": ["physical therapist", "pt ", "dpt"],
        "Occupational Therapist": ["occupational therapist", "ot ", "otr"],
        "Respiratory Therapist": ["respiratory therapist", "rt ", "rrt"],
        "Medical Technologist": ["medical technologist", "mt ", "mlt"],
        "Pharmacist": ["pharmacist", "pharmd", "rph"],
        "Physician Assistant": ["physician assistant", "pa-c", "pa "],
        "Radiologic Technologist": ["radiologic technologist", "x-ray tech", "rt(r)"],
        "Surgical Technologist": ["surgical technologist", "surgical tech", "cst"],
    }
    
    for specialty, keywords in specialty_keywords.items():
        for keyword in keywords:
            if keyword in text_lower:
                result["specialty"] = specialty
                break
        if result["specialty"]:
            break
    
    # Extract a bio (first paragraph or objective statement)
    objective_match = re.search(r'(?:objective|summary|profile)[:\s]*([^\n]+(?:\n[^\n]+)?)', text_lower)
    if objective_match:
        result["bio"] = objective_match.group(1).strip()[:500]
    
    # Extract certifications
    cert_patterns = [
        r'(BLS|ACLS|PALS|NRP|TNCC|ENPC|CEN|CCRN|CNOR|OCN|CHPN)\b',
        r'(RN|LPN|LVN|CNA|NP|PA-C|RT|PT|OT|MT|PharmD)\b'
    ]
    
    for pattern in cert_patterns:
        matches = re.findall(pattern, text.upper())
        for match in matches:
            if match not in [c.get("name") for c in result["certifications"]]:
                result["certifications"].append({
                    "name": match,
                    "expiration": ""
                })
    
    return result

@api_router.get("/profile/poster")
async def get_poster_profile(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "poster":
        raise HTTPException(status_code=403, detail="Not a job poster")
    
    profile = await db.poster_profiles.find_one({"user_id": current_user["id"]}, {"_id": 0})
    return profile or {}

@api_router.put("/profile/poster")
async def update_poster_profile(profile: PosterProfile, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "poster":
        raise HTTPException(status_code=403, detail="Not a job poster")
    
    profile_data = profile.model_dump(exclude_none=True)
    profile_data["user_id"] = current_user["id"]
    profile_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.poster_profiles.update_one(
        {"user_id": current_user["id"]},
        {"$set": profile_data},
        upsert=True
    )
    
    if profile.company_name:
        await db.users.update_one({"id": current_user["id"]}, {"$set": {"profile_complete": True}})
    
    return {"message": "Profile updated successfully"}

# ==================== BUSINESS EMAIL VERIFICATION ====================

# List of free/personal email domains that are NOT allowed as business emails
FREE_EMAIL_DOMAINS = [
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com",
    "icloud.com", "mail.com", "protonmail.com", "zoho.com", "yandex.com",
    "gmx.com", "live.com", "msn.com", "me.com", "inbox.com"
]

def is_business_email(email: str) -> bool:
    """Check if email is from a business domain (not free email provider)"""
    domain = email.split("@")[-1].lower()
    return domain not in FREE_EMAIL_DOMAINS

def generate_verification_token() -> str:
    """Generate a secure verification token"""
    return str(uuid.uuid4()) + "-" + str(uuid.uuid4())

@api_router.post("/employer/verify-email/send")
async def send_business_email_verification(
    data: BusinessEmailVerification, 
    current_user: dict = Depends(get_current_user)
):
    """Send verification email to employer's business email"""
    if current_user["role"] != "poster":
        raise HTTPException(status_code=403, detail="Only employers can verify business email")
    
    business_email = data.business_email.lower().strip()
    
    # Validate it's a business email domain (bypass in dev mode)
    dev_bypass = os.environ.get("ALLOW_DEV_BYPASS", "").lower() == "true"
    if not dev_bypass and not is_business_email(business_email):
        raise HTTPException(
            status_code=400, 
            detail="Please use a business email address. Personal email domains (gmail, yahoo, etc.) are not accepted for business verification."
        )
    
    # Generate verification token
    token = generate_verification_token()
    expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
    
    # Store verification request
    await db.business_email_verifications.update_one(
        {"user_id": current_user["id"]},
        {"$set": {
            "user_id": current_user["id"],
            "business_email": business_email,
            "token": token,
            "expires_at": expires_at.isoformat(),
            "verified": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    # Send verification email
    frontend_url = os.environ.get('FRONTEND_URL', os.environ.get('REACT_APP_BACKEND_URL', '').replace('/api', ''))
    verification_link = f"{frontend_url}/verify-business-email?token={token}"
    
    subject = "VitalaMatch - Verify Your Business Email"
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #33C5E3;">Verify Your Business Email</h2>
        <p>Hi {current_user.get('full_name', 'there')},</p>
        <p>Please verify that <strong>{business_email}</strong> is your business email address by clicking the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{verification_link}" style="background-color: #33C5E3; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                Verify Email
            </a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">{verification_link}</p>
        <p style="color: #666; font-size: 14px;">This link will expire in 24 hours.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">
            You're receiving this email because you requested to verify your business email on VitalaMatch.
            If you didn't make this request, you can safely ignore this email.
        </p>
    </div>
    """
    
    # Also provide a 6-digit code as backup
    verification_code = token[-6:].upper()
    
    await NotificationService.send_email(business_email, subject, html_content)
    
    logger.info(f"Business email verification sent to {business_email} for user {current_user['id']}")
    
    return {
        "message": "Verification email sent",
        "email": business_email,
        "verification_code": verification_code  # For manual entry if link doesn't work
    }

@api_router.post("/employer/verify-email/confirm")
async def confirm_business_email(
    data: BusinessEmailVerifyToken,
    current_user: dict = Depends(get_current_user)
):
    """Confirm business email verification with token"""
    if current_user["role"] != "poster":
        raise HTTPException(status_code=403, detail="Only employers can verify business email")
    
    token = data.token.strip()
    
    # Find verification request - check both full token and last 6 chars (code)
    verification = await db.business_email_verifications.find_one({
        "user_id": current_user["id"],
        "$or": [
            {"token": token},
            {"token": {"$regex": f"{token}$", "$options": "i"}}  # Match code at end
        ]
    })
    
    if not verification:
        raise HTTPException(status_code=400, detail="Invalid verification token")
    
    # Check expiration
    expires_at = datetime.fromisoformat(verification["expires_at"].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="Verification token has expired. Please request a new one.")
    
    # Mark as verified
    await db.business_email_verifications.update_one(
        {"user_id": current_user["id"]},
        {"$set": {"verified": True, "verified_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Update poster profile with verified business email
    await db.poster_profiles.update_one(
        {"user_id": current_user["id"]},
        {"$set": {
            "business_email": verification["business_email"],
            "business_email_verified": True,
            "business_email_verified_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    logger.info(f"Business email verified for user {current_user['id']}: {verification['business_email']}")
    
    return {
        "message": "Business email verified successfully",
        "business_email": verification["business_email"]
    }

@api_router.get("/employer/verification-status")
async def get_employer_verification_status(current_user: dict = Depends(get_current_user)):
    """Get employer's business email verification status"""
    if current_user["role"] != "poster":
        raise HTTPException(status_code=403, detail="Only employers can check verification status")
    
    profile = await db.poster_profiles.find_one({"user_id": current_user["id"]}, {"_id": 0})
    verification = await db.business_email_verifications.find_one({"user_id": current_user["id"]}, {"_id": 0})
    
    dev_bypass = os.environ.get("ALLOW_DEV_BYPASS", "").lower() == "true"
    
    return {
        "business_email": profile.get("business_email") if profile else None,
        "business_email_verified": profile.get("business_email_verified", False) if profile else False,
        "business_email_verified_at": profile.get("business_email_verified_at") if profile else None,
        "pending_verification": verification.get("business_email") if verification and not verification.get("verified") else None,
        "dev_bypass_active": dev_bypass
    }

# ==================== JOB ROUTES ====================

@api_router.post("/jobs", response_model=JobPostingResponse)
async def create_job(job: JobPosting, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "poster":
        raise HTTPException(status_code=403, detail="Only job posters can create jobs")
    
    # Check business email verification (bypass in dev mode)
    poster_profile = await db.poster_profiles.find_one({"user_id": current_user["id"]}, {"_id": 0})
    dev_bypass = os.environ.get("ALLOW_DEV_BYPASS", "").lower() == "true"
    
    if not dev_bypass and (not poster_profile or not poster_profile.get("business_email_verified")):
        raise HTTPException(
            status_code=403, 
            detail="You must verify a business email address before posting jobs. Please complete your employer profile verification."
        )
    
    job_id = str(uuid.uuid4())
    job_data = job.model_dump()
    job_data["id"] = job_id
    job_data["poster_id"] = current_user["id"]
    job_data["created_at"] = datetime.now(timezone.utc).isoformat()
    job_data["is_active"] = True
    job_data["company_name"] = poster_profile.get("company_name") if poster_profile else None
    job_data["company_logo"] = poster_profile.get("company_logo") if poster_profile else None
    
    await db.jobs.insert_one(job_data)
    
    return JobPostingResponse(**job_data)

@api_router.get("/jobs", response_model=List[JobPostingResponse])
async def get_jobs(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "poster":
        raise HTTPException(status_code=403, detail="Only job posters can view their jobs")
    
    jobs = await db.jobs.find({"poster_id": current_user["id"]}, {"_id": 0}).to_list(100)
    return [JobPostingResponse(**job) for job in jobs]

@api_router.get("/jobs/{job_id}", response_model=JobPostingResponse)
async def get_job(job_id: str, current_user: dict = Depends(get_current_user)):
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobPostingResponse(**job)

@api_router.put("/jobs/{job_id}")
async def update_job(job_id: str, job: JobPosting, current_user: dict = Depends(get_current_user)):
    existing = await db.jobs.find_one({"id": job_id, "poster_id": current_user["id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job_data = job.model_dump()
    job_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.jobs.update_one({"id": job_id}, {"$set": job_data})
    return {"message": "Job updated successfully"}

@api_router.delete("/jobs/{job_id}")
async def delete_job(job_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.jobs.delete_one({"id": job_id, "poster_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"message": "Job deleted successfully"}

# ==================== SWIPE/MATCHING ROUTES ====================

@api_router.get("/swipe/jobs")
async def get_swipeable_jobs(current_user: dict = Depends(get_current_user)):
    """Get jobs for seeker to swipe on"""
    if current_user["role"] != "seeker":
        raise HTTPException(status_code=403, detail="Only seekers can swipe on jobs")
    
    # Get jobs the user has already swiped on
    swiped = await db.swipes.find({"user_id": current_user["id"]}, {"target_id": 1}).to_list(1000)
    swiped_ids = [s["target_id"] for s in swiped]
    
    # Get seeker profile for compatibility calculation
    seeker_profile = await db.seeker_profiles.find_one({"user_id": current_user["id"]}, {"_id": 0}) or {}
    
    # Get active jobs not yet swiped
    jobs = await db.jobs.find({"id": {"$nin": swiped_ids}, "is_active": True}, {"_id": 0}).to_list(50)
    
    # Add compatibility scores
    for job in jobs:
        job["compatibility_score"] = calculate_compatibility(seeker_profile, job)
    
    # Sort by compatibility score
    jobs.sort(key=lambda x: x["compatibility_score"], reverse=True)
    
    return jobs

@api_router.get("/swipe/seekers")
async def get_swipeable_seekers(job_id: str, current_user: dict = Depends(get_current_user)):
    """Get seekers for poster to swipe on for a specific job"""
    if current_user["role"] != "poster":
        raise HTTPException(status_code=403, detail="Only posters can swipe on seekers")
    
    # Verify job belongs to poster
    job = await db.jobs.find_one({"id": job_id, "poster_id": current_user["id"]}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Get seekers already swiped on for this job
    swiped = await db.swipes.find({"user_id": current_user["id"], "job_id": job_id}, {"target_id": 1}).to_list(1000)
    swiped_ids = [s["target_id"] for s in swiped]
    
    # Get seekers who liked this job
    seeker_likes = await db.swipes.find({"target_id": job_id, "action": "like"}, {"user_id": 1}).to_list(1000)
    seeker_ids = [s["user_id"] for s in seeker_likes if s["user_id"] not in swiped_ids]
    
    seekers = []
    for seeker_id in seeker_ids:
        user = await db.users.find_one({"id": seeker_id}, {"_id": 0, "password": 0})
        profile = await db.seeker_profiles.find_one({"user_id": seeker_id}, {"_id": 0})
        if user and profile:
            seeker_data = {**user, **profile}
            seeker_data["compatibility_score"] = calculate_compatibility(profile, job)
            seekers.append(seeker_data)
    
    seekers.sort(key=lambda x: x.get("compatibility_score", 0), reverse=True)
    return seekers

@api_router.post("/swipe")
async def swipe(action: SwipeAction, job_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Record a swipe action"""
    swipe_data = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "target_id": action.target_id,
        "action": action.action,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    if job_id:
        swipe_data["job_id"] = job_id
    
    await db.swipes.insert_one(swipe_data)
    
    # Check for mutual match
    match_result = {"matched": False}
    
    if action.action == "like":
        if current_user["role"] == "seeker":
            # Seeker liked a job - check if poster liked this seeker for this job
            poster_like = await db.swipes.find_one({
                "target_id": current_user["id"],
                "job_id": action.target_id,
                "action": "like"
            })
            if poster_like:
                match_result = await create_match(current_user["id"], action.target_id, poster_like["user_id"])
        else:
            # Poster liked a seeker - check if seeker liked this job
            seeker_like = await db.swipes.find_one({
                "user_id": action.target_id,
                "target_id": job_id,
                "action": "like"
            })
            if seeker_like:
                match_result = await create_match(action.target_id, job_id, current_user["id"])
    
    return {"message": "Swipe recorded", **match_result}


# ==================== SEEKER APPLICATIONS ====================

@api_router.get("/seeker/applications")
async def get_seeker_applications(current_user: dict = Depends(get_current_user)):
    """Get all jobs the seeker expressed interest in, with status"""
    if current_user["role"] != "seeker":
        raise HTTPException(status_code=403, detail="Only seekers can view applications")

    # Get all 'like' swipes by this seeker
    liked_swipes = await db.swipes.find(
        {"user_id": current_user["id"], "action": "like"},
        {"_id": 0}
    ).to_list(200)

    applications = []
    for sw in liked_swipes:
        job = await db.jobs.find_one({"id": sw["target_id"]}, {"_id": 0})
        if not job:
            continue

        # Check for a mutual match
        match = await db.matches.find_one(
            {"seeker_id": current_user["id"], "job_id": sw["target_id"]},
            {"_id": 0}
        )

        # Check for an offer
        offer = await db.employment_offers.find_one(
            {"seeker_id": current_user["id"], "job_id": sw["target_id"]},
            {"_id": 0}
        )

        status = "pending"
        match_id = None
        if offer:
            # Use the actual offer status (pending, accepted, rejected, expired)
            offer_status = offer.get("status", "pending")
            if offer_status == "accepted":
                status = "accepted"
            elif offer_status == "rejected":
                status = "declined"
            else:
                status = "offer_sent"
            match_id = match["id"] if match else None
        elif match:
            status = "matched"
            match_id = match["id"]

        poster_profile = await db.poster_profiles.find_one(
            {"user_id": job.get("poster_id")}, {"_id": 0}
        )

        applications.append({
            "id": sw["id"],
            "job_id": job["id"],
            "match_id": match_id,
            "status": status,
            "applied_at": sw.get("created_at"),
            "job": {
                "title": job.get("title"),
                "company_name": poster_profile.get("company_name") if poster_profile else job.get("company_name"),
                "location": job.get("location"),
                "specialty": job.get("specialty"),
                "pay_range": job.get("pay_range"),
                "duration": job.get("duration"),
            }
        })

    # Sort: offer_sent first, then matched, then pending, then accepted/declined
    order = {"offer_sent": 0, "matched": 1, "pending": 2, "accepted": 3, "declined": 4}
    applications.sort(key=lambda a: order.get(a["status"], 5))
    return applications


# ==================== EMPLOYER CANDIDATES ====================

async def _calc_candidate_compliance(candidate_id: str, employer_id: str) -> dict:
    """Calculate compliance score for a candidate relative to an employer"""
    # Check training assignments
    assignments = await db.training_assignments.find(
        {"user_id": candidate_id, "employer_id": employer_id}, {"_id": 0}
    ).to_list(100)
    # Check onboarding cases
    cases = await db.onboarding_cases.find(
        {"candidate_id": candidate_id, "employer_id": employer_id}, {"_id": 0}
    ).to_list(10)
    # Check vault doc count
    vault_count = await db.vault_documents.count_documents({"candidate_id": candidate_id})

    training_total = len(assignments)
    training_completed = sum(1 for a in assignments if a.get("completion_status") == "completed")
    training_overdue = sum(1 for a in assignments if (
        a.get("due_date") and a.get("completion_status") not in ("completed", "waived") and
        a["due_date"] < datetime.now(timezone.utc).isoformat()
    ))

    onboarding_status = None
    onboarding_pct = None
    if cases:
        latest = cases[0]
        onboarding_status = latest.get("status", "active")
        reqs = await db.onboarding_requirements.find(
            {"onboarding_case_id": latest["id"]}, {"_id": 0}
        ).to_list(50)
        total = len(reqs)
        resolved = sum(1 for r in reqs if r.get("status") in ("satisfied_from_vault", "completed"))
        onboarding_pct = round((resolved / total) * 100) if total > 0 else 100

    # Overall score: weighted average of training + onboarding + vault
    scores = []
    if training_total > 0:
        scores.append(round((training_completed / training_total) * 100))
    if onboarding_pct is not None:
        scores.append(onboarding_pct)
    if vault_count > 0:
        scores.append(min(100, vault_count * 20))  # 5+ docs = 100

    overall = round(sum(scores) / len(scores)) if scores else None

    return {
        "overall": overall,
        "training": {"total": training_total, "completed": training_completed, "overdue": training_overdue},
        "onboarding": {"status": onboarding_status, "percent": onboarding_pct},
        "vault_documents": vault_count,
    }


@api_router.get("/employer/candidates")
async def get_employer_candidates(current_user: dict = Depends(get_current_user)):
    """Get all seekers who expressed interest in the employer's jobs, with status"""
    if current_user["role"] != "poster":
        raise HTTPException(status_code=403, detail="Only employers can view candidates")

    # Get all employer's jobs
    employer_jobs = await db.jobs.find(
        {"poster_id": current_user["id"]},
        {"_id": 0}
    ).to_list(100)
    job_ids = [j["id"] for j in employer_jobs]
    job_map = {j["id"]: j for j in employer_jobs}

    if not job_ids:
        return []

    # Get all 'like' swipes targeting these jobs
    liked_swipes = await db.swipes.find(
        {"target_id": {"$in": job_ids}, "action": "like"},
        {"_id": 0}
    ).to_list(500)

    candidates = []
    for sw in liked_swipes:
        seeker = await db.users.find_one({"id": sw["user_id"]}, {"_id": 0, "password": 0})
        if not seeker:
            continue

        seeker_profile = await db.seeker_profiles.find_one(
            {"user_id": sw["user_id"]}, {"_id": 0}
        )

        job = job_map.get(sw["target_id"], {})

        # Check for mutual match
        match = await db.matches.find_one(
            {"seeker_id": sw["user_id"], "job_id": sw["target_id"]},
            {"_id": 0}
        )

        # Check for offer
        offer = await db.employment_offers.find_one(
            {"seeker_id": sw["user_id"], "job_id": sw["target_id"]},
            {"_id": 0}
        )

        status = "pending"
        match_id = None
        offer_id = None
        if offer:
            status = "offer_sent"
            offer_id = offer.get("id")
            match_id = match["id"] if match else None
        elif match:
            status = "matched"
            match_id = match["id"]

        candidates.append({
            "id": sw["id"],
            "seeker_id": sw["user_id"],
            "job_id": sw["target_id"],
            "match_id": match_id,
            "offer_id": offer_id,
            "status": status,
            "applied_at": sw.get("created_at"),
            "seeker": {
                "full_name": seeker.get("full_name"),
                "email": seeker.get("email"),
                "specialty": seeker_profile.get("specialty") if seeker_profile else None,
                "years_experience": seeker_profile.get("years_experience") if seeker_profile else None,
                "bio": seeker_profile.get("bio") if seeker_profile else None,
            },
            "job": {
                "id": job.get("id"),
                "title": job.get("title"),
                "location": job.get("location"),
            },
            "compliance_score": await _calc_candidate_compliance(sw["user_id"], current_user["id"]),
        })

    # Sort: pending first, then matched, then offer_sent
    order = {"pending": 0, "matched": 1, "offer_sent": 2}
    candidates.sort(key=lambda c: order.get(c["status"], 3))
    return candidates



@api_router.get("/employer/browse-pros")
async def browse_pros(
    include_all: bool = False,
    specialty: Optional[str] = None,
    location: Optional[str] = None,
    min_experience: Optional[int] = None,
    max_experience: Optional[int] = None,
    shift: Optional[str] = None,
    certification: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """Get all seekers available for employer to browse, ranked by job compatibility"""
    if current_user["role"] != "poster":
        raise HTTPException(status_code=403, detail="Only employers can browse pros")

    # Get employer's active jobs (full data for scoring)
    employer_jobs_full = await db.jobs.find(
        {"poster_id": current_user["id"], "status": {"$ne": "closed"}},
        {"_id": 0}
    ).to_list(100)
    employer_jobs = [{"id": j["id"], "title": j.get("title", "")} for j in employer_jobs_full]

    # Get all seeker IDs already connected to this employer (via swipes or employer interest)
    job_ids = [j["id"] for j in employer_jobs]
    existing_swipes = await db.swipes.find(
        {"target_id": {"$in": job_ids}, "action": "like"},
        {"user_id": 1}
    ).to_list(1000)
    connected_seeker_ids = set(s["user_id"] for s in existing_swipes)

    # Also exclude seekers the employer has already browsed/passed
    employer_browse_actions = await db.employer_browse_actions.find(
        {"employer_id": current_user["id"]},
        {"seeker_id": 1}
    ).to_list(1000)
    browsed_seeker_ids = set(a["seeker_id"] for a in employer_browse_actions)

    exclude_ids = connected_seeker_ids | browsed_seeker_ids
    exclude_ids.add(current_user["id"])

    # Get all seekers with profiles
    all_seekers = await db.users.find(
        {"role": "seeker", "id": {"$nin": list(exclude_ids)}},
        {"_id": 0, "password": 0}
    ).to_list(200)

    pros = []
    for seeker in all_seekers:
        profile = await db.seeker_profiles.find_one({"user_id": seeker["id"]}, {"_id": 0})
        if not profile:
            continue
        # Count verified references
        ref_count = await db.portable_references.count_documents(
            {"candidate_id": seeker["id"], "verification_status": "verified"}
        )
        vault_count = await db.vault_documents.count_documents({"candidate_id": seeker["id"]})

        # Score against all active jobs — take best match
        best_score = 0
        best_job_id = None
        best_job_title = ""
        best_job_data = None
        for job in employer_jobs_full:
            score = calculate_compatibility(profile, job)
            if score > best_score:
                best_score = score
                best_job_id = job["id"]
                best_job_title = job.get("title", "")
                best_job_data = job

        # --- Tiered matching: determine tier based on specialty + experience ---
        tier = "none"
        specialty_match = False
        broad_role_match = False
        experience_met = False
        context_reasons = []

        if best_job_data:
            pro_spec = profile.get("specialty", "").lower()
            job_spec = best_job_data.get("specialty", "").lower()
            exp = profile.get("years_experience", 0) or 0
            req = best_job_data.get("experience_required", 0) or 0

            # Check specialty match (exact sub-specialty)
            if pro_spec and job_spec and (pro_spec in job_spec or job_spec in pro_spec):
                specialty_match = True

            # Check broad role match (same RN/LPN/CNA family)
            if not specialty_match:
                for abbr in ["RN", "LPN", "CNA", "NP"]:
                    if abbr.lower() in pro_spec and abbr.lower() in job_spec:
                        broad_role_match = True
                        break

            # Check experience
            if req == 0 or exp >= req:
                experience_met = True

            # Determine tier
            if specialty_match and experience_met:
                tier = "strong"
            elif specialty_match or (broad_role_match and experience_met) or (broad_role_match and exp > 0):
                tier = "possible"
            else:
                # Check secondary signals
                locs = profile.get("preferred_locations", [])
                job_loc = best_job_data.get("location", "")
                location_match = locs and job_loc and any(l.lower().split(",")[0] in job_loc.lower() for l in locs)
                shift = profile.get("preferred_shift", "")
                job_shift = best_job_data.get("shift_type", "")
                shift_match = shift and job_shift and shift.lower().split()[0] in job_shift.lower()
                if broad_role_match or location_match or shift_match:
                    tier = "possible"

            # Build context reasons explaining WHY this tier
            job_sub = best_job_data.get("specialty", "").replace("Registered Nurse (RN)", "").replace("Licensed Practical Nurse (LPN)", "").replace("Certified Nursing Assistant (CNA)", "").strip(" -")
            if not job_sub:
                job_sub = best_job_title.split(" - ")[0].strip() if " - " in best_job_title else best_job_title.strip()

            if tier == "strong":
                if specialty_match and job_sub:
                    context_reasons.append(f"Specialty aligns with your {job_sub[:35]} role")
                if experience_met and req > 0:
                    context_reasons.append(f"Meets your {req}+ year experience requirement")
            elif tier == "possible":
                if specialty_match and not experience_met and req > 0:
                    context_reasons.append(f"Right specialty, building toward {req}-year requirement")
                elif broad_role_match and job_sub:
                    role_abbr = next((a for a in ["RN", "LPN", "CNA", "NP"] if a.lower() in pro_spec), "")
                    context_reasons.append(f"Transferable {role_abbr} experience, outside {job_sub[:25]}")
                # Secondary signals
                locs = profile.get("preferred_locations", [])
                job_loc = best_job_data.get("location", "")
                if locs and job_loc and any(l.lower().split(",")[0] in job_loc.lower() for l in locs):
                    context_reasons.append("Located near your facility")
                shift = profile.get("preferred_shift", "")
                job_shift = best_job_data.get("shift_type", "")
                if shift and job_shift and shift.lower().split()[0] in job_shift.lower():
                    context_reasons.append(f"Available for your {job_shift.split('(')[0].strip().lower()} opening")

        # Fallback context for possible tier with no reasons yet
        if tier == "possible" and not context_reasons:
            if ref_count > 0:
                context_reasons.append("Has verified references on file")
            elif vault_count >= 3:
                context_reasons.append("Compliance documents uploaded")

        pros.append({
            "id": seeker["id"],
            "full_name": seeker.get("full_name"),
            "email": seeker.get("email"),
            "specialty": profile.get("specialty"),
            "years_experience": profile.get("years_experience"),
            "bio": profile.get("bio"),
            "skills": profile.get("skills", []),
            "preferred_locations": profile.get("preferred_locations", []),
            "preferred_shift": profile.get("preferred_shift"),
            "certifications": profile.get("certifications", []),
            "licenses": profile.get("licenses", []),
            "verified_references": ref_count,
            "vault_documents": vault_count,
            "profile_complete": seeker.get("profile_complete", False),
            "availability": profile.get("availability"),
            "travel_readiness": profile.get("travel_readiness"),
            "job_type_preference": profile.get("job_type_preference"),
            "experience_highlights": profile.get("experience_highlights", []),
            "medical_records_count": len(profile.get("medical_records", [])),
            "match_score": best_score,
            "match_tier": tier,
            "best_job_id": best_job_id,
            "best_job_title": best_job_title,
            "context_reasons": context_reasons[:2],
        })

    # Sort: strong first, then possible, then none; within tier by score
    tier_order = {"strong": 0, "possible": 1, "none": 2}
    pros.sort(key=lambda p: (tier_order.get(p["match_tier"], 3), -p["match_score"]))

    # Filter out "none" tier unless include_all is requested
    if not include_all:
        pros = [p for p in pros if p["match_tier"] != "none"]

    # Apply user filters (narrow within ranked results)
    if specialty:
        sl = specialty.lower()
        pros = [p for p in pros if p.get("specialty") and sl in p["specialty"].lower()]
    if location:
        ll = location.lower()
        pros = [p for p in pros if any(ll in l.lower() for l in (p.get("preferred_locations") or []))]
    if min_experience is not None:
        pros = [p for p in pros if (p.get("years_experience") or 0) >= min_experience]
    if max_experience is not None:
        pros = [p for p in pros if (p.get("years_experience") or 0) <= max_experience]
    if shift:
        sl = shift.lower()
        pros = [p for p in pros if p.get("preferred_shift") and sl in p["preferred_shift"].lower()]
    if certification:
        cl = certification.lower()
        pros = [p for p in pros if any(
            cl in (c.lower() if isinstance(c, str) else (c.get("name", "") or "").lower())
            for c in (p.get("certifications") or [])
        )]

    # Build filter options from all unfiltered pros for the UI dropdowns
    all_specialties = sorted(set(p.get("specialty") for p in pros if p.get("specialty")))

    return {"pros": pros, "jobs": employer_jobs, "filter_options": {"specialties": all_specialties}}


class EmployerInterestBody(BaseModel):
    seeker_id: str
    job_id: str


@api_router.post("/employer/express-interest")
async def employer_express_interest(body: EmployerInterestBody, current_user: dict = Depends(get_current_user)):
    """Employer expresses interest in a Pro — creates applicant record for that job"""
    if current_user["role"] != "poster":
        raise HTTPException(status_code=403, detail="Only employers can express interest")

    # Verify job belongs to employer
    job = await db.jobs.find_one({"id": body.job_id, "poster_id": current_user["id"]}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or doesn't belong to you")

    # Check seeker exists
    seeker = await db.users.find_one({"id": body.seeker_id, "role": "seeker"}, {"_id": 0, "password": 0})
    if not seeker:
        raise HTTPException(status_code=404, detail="Pro not found")

    # Check for duplicate
    existing = await db.swipes.find_one({
        "user_id": body.seeker_id, "target_id": body.job_id, "action": "like"
    })
    if existing:
        raise HTTPException(status_code=409, detail="This pro is already an applicant for this job")

    # Create a swipe record as if the seeker expressed interest (employer-initiated)
    swipe_data = {
        "id": str(uuid.uuid4()),
        "user_id": body.seeker_id,
        "target_id": body.job_id,
        "action": "like",
        "source": "employer_browse",
        "employer_id": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.swipes.insert_one(swipe_data)

    # Record the browse action to prevent showing this pro again
    await db.employer_browse_actions.insert_one({
        "id": str(uuid.uuid4()),
        "employer_id": current_user["id"],
        "seeker_id": body.seeker_id,
        "job_id": body.job_id,
        "action": "interested",
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    await log_audit(db, current_user["id"], "employer_express_interest",
                    details={"seeker_id": body.seeker_id, "job_id": body.job_id})

    return {"message": "Added to Applicants", "swipe_id": swipe_data["id"]}


class EmployerPassBody(BaseModel):
    seeker_id: str


@api_router.post("/employer/browse-pass")
async def employer_browse_pass(body: EmployerPassBody, current_user: dict = Depends(get_current_user)):
    """Employer passes on a Pro — removes from browse feed only"""
    if current_user["role"] != "poster":
        raise HTTPException(status_code=403, detail="Only employers can pass")

    await db.employer_browse_actions.insert_one({
        "id": str(uuid.uuid4()),
        "employer_id": current_user["id"],
        "seeker_id": body.seeker_id,
        "action": "pass",
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    return {"message": "Passed"}



@api_router.post("/employer/candidates/{seeker_id}/accept")
async def accept_candidate(seeker_id: str, job_id: str, current_user: dict = Depends(get_current_user)):
    """Employer accepts a candidate — creates a mutual match"""
    if current_user["role"] != "poster":
        raise HTTPException(status_code=403, detail="Only employers can accept candidates")

    # Verify job belongs to employer
    job = await db.jobs.find_one({"id": job_id, "poster_id": current_user["id"]})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Verify seeker expressed interest
    swipe = await db.swipes.find_one({"user_id": seeker_id, "target_id": job_id, "action": "like"})
    if not swipe:
        raise HTTPException(status_code=404, detail="Candidate has not expressed interest in this job")

    # Check if match already exists
    existing = await db.matches.find_one({"seeker_id": seeker_id, "job_id": job_id})
    if existing:
        return {"message": "Already matched", "match_id": existing["id"]}

    # Create the match
    match_id = str(uuid.uuid4())
    match_data = {
        "id": match_id,
        "seeker_id": seeker_id,
        "poster_id": current_user["id"],
        "job_id": job_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.matches.insert_one(match_data)

    return {"message": "Candidate accepted", "match_id": match_id}



# ==================== SWIPE BINS ROUTES ====================

@api_router.get("/swipe/bins/passed")
async def get_passed_profiles(current_user: dict = Depends(get_current_user)):
    """Get profiles that user swiped left on (Take Another Look bin)"""
    passed_swipes = await db.swipes.find({
        "user_id": current_user["id"],
        "action": "pass"
    }, {"_id": 0}).to_list(100)
    
    profiles = []
    for swipe in passed_swipes:
        if current_user["role"] == "seeker":
            # Get job details
            job = await db.jobs.find_one({"id": swipe["target_id"]}, {"_id": 0})
            if job:
                poster_profile = await db.poster_profiles.find_one({"user_id": job.get("poster_id")}, {"_id": 0})
                if poster_profile:
                    job["company_name"] = poster_profile.get("company_name")
                    job["company_logo"] = poster_profile.get("company_logo")
                profiles.append({**job, "swipe_id": swipe["id"], "swiped_at": swipe["created_at"]})
        else:
            # Get seeker details
            user = await db.users.find_one({"id": swipe["target_id"]}, {"_id": 0, "password": 0})
            profile = await db.seeker_profiles.find_one({"user_id": swipe["target_id"]}, {"_id": 0})
            if user and profile:
                profiles.append({**user, **profile, "swipe_id": swipe["id"], "swiped_at": swipe["created_at"]})
    
    return profiles

@api_router.get("/swipe/bins/maybe")
async def get_maybe_profiles(current_user: dict = Depends(get_current_user)):
    """Get profiles that user marked as 'maybe' for later review"""
    maybe_swipes = await db.swipes.find({
        "user_id": current_user["id"],
        "action": "maybe"
    }, {"_id": 0}).to_list(100)
    
    profiles = []
    for swipe in maybe_swipes:
        if current_user["role"] == "seeker":
            job = await db.jobs.find_one({"id": swipe["target_id"]}, {"_id": 0})
            if job:
                poster_profile = await db.poster_profiles.find_one({"user_id": job.get("poster_id")}, {"_id": 0})
                if poster_profile:
                    job["company_name"] = poster_profile.get("company_name")
                    job["company_logo"] = poster_profile.get("company_logo")
                profiles.append({**job, "swipe_id": swipe["id"], "swiped_at": swipe["created_at"]})
        else:
            user = await db.users.find_one({"id": swipe["target_id"]}, {"_id": 0, "password": 0})
            profile = await db.seeker_profiles.find_one({"user_id": swipe["target_id"]}, {"_id": 0})
            if user and profile:
                profiles.append({**user, **profile, "swipe_id": swipe["id"], "swiped_at": swipe["created_at"]})
    
    return profiles

@api_router.put("/swipe/bins/{swipe_id}/reconsider")
async def reconsider_swipe(swipe_id: str, new_action: str, current_user: dict = Depends(get_current_user)):
    """Change a previous swipe decision (from bin back to active consideration)"""
    if new_action not in ["like", "pass", "maybe"]:
        raise HTTPException(status_code=400, detail="Invalid action")
    
    swipe = await db.swipes.find_one({"id": swipe_id, "user_id": current_user["id"]})
    if not swipe:
        raise HTTPException(status_code=404, detail="Swipe not found")
    
    # Update the swipe action
    await db.swipes.update_one(
        {"id": swipe_id},
        {"$set": {"action": new_action, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # If new action is 'like', check for mutual match
    match_result = {"matched": False}
    if new_action == "like":
        if current_user["role"] == "seeker":
            poster_like = await db.swipes.find_one({
                "target_id": current_user["id"],
                "job_id": swipe["target_id"],
                "action": "like"
            })
            if poster_like:
                match_result = await create_match(current_user["id"], swipe["target_id"], poster_like["user_id"])
        else:
            seeker_like = await db.swipes.find_one({
                "user_id": swipe["target_id"],
                "target_id": swipe.get("job_id"),
                "action": "like"
            })
            if seeker_like:
                match_result = await create_match(swipe["target_id"], swipe.get("job_id"), current_user["id"])
    
    return {"message": "Swipe updated", **match_result}

async def create_match(seeker_id: str, job_id: str, poster_id: str):
    """Create a match between seeker and job"""
    # Check if match already exists
    existing = await db.matches.find_one({
        "seeker_id": seeker_id,
        "job_id": job_id
    })
    if existing:
        return {"matched": False}
    
    match_id = str(uuid.uuid4())
    match_data = {
        "id": match_id,
        "seeker_id": seeker_id,
        "job_id": job_id,
        "poster_id": poster_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "active"
    }
    
    await db.matches.insert_one(match_data)
    
    # Get job and seeker info for the match notification
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    seeker = await db.users.find_one({"id": seeker_id}, {"_id": 0, "password": 0})
    poster = await db.users.find_one({"id": poster_id}, {"_id": 0, "password": 0})
    
    # Send match notifications to both parties
    asyncio.create_task(send_match_notifications(seeker_id, poster_id, job, seeker, poster))
    
    return {
        "matched": True,
        "match_id": match_id,
        "job": job,
        "seeker": seeker
    }

async def send_match_notifications(seeker_id: str, poster_id: str, job: dict, seeker: dict, poster: dict):
    """Send match notifications to seeker and poster"""
    try:
        # Notify seeker
        seeker_prefs = await db.notification_preferences.find_one({"user_id": seeker_id}, {"_id": 0})
        if seeker_prefs and seeker_prefs.get("match_notifications", True):
            subject = f"🎉 It's a Match! - {job.get('title', 'New Job')}"
            html_content = f"""
            <h2>Congratulations! You have a new match!</h2>
            <p>Great news! <strong>{job.get('company_name', 'A healthcare facility')}</strong> is interested in your profile for the <strong>{job.get('title')}</strong> position.</p>
            <p><strong>Location:</strong> {job.get('location')}</p>
            <p><strong>Duration:</strong> {job.get('duration')}</p>
            <p>Log in to VitalaMatch to start a conversation and learn more about this opportunity.</p>
            """
            sms_content = f"VitalaMatch: You matched with {job.get('company_name', 'a facility')} for {job.get('title')}! Log in to chat."
            await NotificationService.send_notification(seeker_id, subject, html_content, sms_content)
        
        # Notify poster
        poster_prefs = await db.notification_preferences.find_one({"user_id": poster_id}, {"_id": 0})
        if poster_prefs and poster_prefs.get("match_notifications", True):
            subject = f"🎉 New Match! - {seeker.get('full_name', 'A candidate')}"
            html_content = f"""
            <h2>Congratulations! You have a new match!</h2>
            <p>Great news! <strong>{seeker.get('full_name')}</strong> is interested in your <strong>{job.get('title')}</strong> position.</p>
            <p>Log in to VitalaMatch to view their profile and start a conversation.</p>
            """
            sms_content = f"VitalaMatch: {seeker.get('full_name')} matched with your {job.get('title')} job! Log in to chat."
            await NotificationService.send_notification(poster_id, subject, html_content, sms_content)
    except Exception as e:
        logger.error(f"Error sending match notifications: {str(e)}")

# ==================== MATCHES ROUTES ====================

@api_router.get("/matches")
async def get_matches(current_user: dict = Depends(get_current_user)):
    """Get all matches for current user"""
    if current_user["role"] == "seeker":
        matches = await db.matches.find({"seeker_id": current_user["id"]}, {"_id": 0}).to_list(100)
    else:
        matches = await db.matches.find({"poster_id": current_user["id"]}, {"_id": 0}).to_list(100)
    
    enriched_matches = []
    for match in matches:
        job = await db.jobs.find_one({"id": match["job_id"]}, {"_id": 0})
        seeker = await db.users.find_one({"id": match["seeker_id"]}, {"_id": 0, "password": 0})
        seeker_profile = await db.seeker_profiles.find_one({"user_id": match["seeker_id"]}, {"_id": 0})
        poster = await db.users.find_one({"id": match["poster_id"]}, {"_id": 0, "password": 0})
        
        # Check if references are available (completed references exist)
        seeker_refs_available = False
        poster_refs_available = False
        
        if current_user["role"] == "poster":
            seeker_ref_count = await db.references.count_documents({
                "requested_for": match["seeker_id"],
                "status": "completed"
            })
            seeker_refs_available = seeker_ref_count > 0
        else:
            poster_ref_count = await db.references.count_documents({
                "requested_for": match["poster_id"],
                "status": "completed"
            })
            poster_refs_available = poster_ref_count > 0
        
        enriched_matches.append({
            **match,
            "job": job,
            "seeker": {**seeker, **(seeker_profile or {})} if seeker else None,
            "poster": poster,
            "seeker_references_available": seeker_refs_available,
            "poster_references_available": poster_refs_available
        })
    
    return enriched_matches

@api_router.get("/matches/{match_id}/messages")
async def get_messages(match_id: str, current_user: dict = Depends(get_current_user)):
    """Get messages for a match"""
    match = await db.matches.find_one({"id": match_id})
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    if current_user["id"] not in [match["seeker_id"], match["poster_id"]]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    messages = await db.messages.find({"match_id": match_id}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    return messages

@api_router.post("/matches/{match_id}/messages")
async def send_message(match_id: str, message: Message, current_user: dict = Depends(get_current_user)):
    """Send a message in a match"""
    match = await db.matches.find_one({"id": match_id})
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    if current_user["id"] not in [match["seeker_id"], match["poster_id"]]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    message_data = {
        "id": str(uuid.uuid4()),
        "match_id": match_id,
        "sender_id": current_user["id"],
        "content": message.content,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.messages.insert_one(message_data)
    
    # Update reply time tracking for the sender
    await update_reply_time_stats(current_user["id"], match_id)
    
    return {"id": message_data["id"], "message": "Message sent"}

# ==================== REPLY TIME ANALYTICS ====================

async def update_reply_time_stats(user_id: str, match_id: str):
    """Track and update user's average reply time"""
    # Get the last message from the other party
    last_message = await db.messages.find_one(
        {"match_id": match_id, "sender_id": {"$ne": user_id}},
        sort=[("created_at", -1)]
    )
    
    if last_message:
        # Calculate reply time in minutes
        last_msg_time = datetime.fromisoformat(last_message["created_at"].replace('Z', '+00:00'))
        reply_time = (datetime.now(timezone.utc) - last_msg_time).total_seconds() / 60
        
        # Update user's reply time stats
        stats = await db.reply_time_stats.find_one({"user_id": user_id})
        if stats:
            # Calculate new average
            total_replies = stats.get("total_replies", 0) + 1
            current_avg = stats.get("avg_reply_time_minutes", 0)
            new_avg = ((current_avg * (total_replies - 1)) + reply_time) / total_replies
            
            await db.reply_time_stats.update_one(
                {"user_id": user_id},
                {"$set": {
                    "avg_reply_time_minutes": new_avg,
                    "total_replies": total_replies,
                    "last_reply_at": datetime.now(timezone.utc).isoformat()
                }}
            )
        else:
            await db.reply_time_stats.insert_one({
                "user_id": user_id,
                "avg_reply_time_minutes": reply_time,
                "total_replies": 1,
                "last_reply_at": datetime.now(timezone.utc).isoformat()
            })

@api_router.get("/matches/{match_id}/reply-probability")
async def get_reply_probability(match_id: str, current_user: dict = Depends(get_current_user)):
    """Get estimated reply probability for a match based on reply time analytics"""
    match = await db.matches.find_one({"id": match_id})
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    if current_user["id"] not in [match["seeker_id"], match["poster_id"]]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get the other party's ID
    other_party_id = match["poster_id"] if current_user["id"] == match["seeker_id"] else match["seeker_id"]
    
    # Get their reply time stats
    stats = await db.reply_time_stats.find_one({"user_id": other_party_id})
    if not stats or stats.get("total_replies", 0) < 3:
        return {"has_data": False, "message": "Not enough data to calculate reply probability"}
    
    avg_reply_time = stats.get("avg_reply_time_minutes", 0)
    
    # Get last message from current user
    last_message = await db.messages.find_one(
        {"match_id": match_id, "sender_id": current_user["id"]},
        sort=[("created_at", -1)]
    )
    
    if not last_message:
        return {"has_data": False, "message": "No messages sent yet"}
    
    # Calculate wait time
    last_msg_time = datetime.fromisoformat(last_message["created_at"].replace('Z', '+00:00'))
    wait_time = (datetime.now(timezone.utc) - last_msg_time).total_seconds() / 60
    
    # Calculate if exceeds 15% threshold
    threshold = avg_reply_time * 1.15
    exceeds_average = wait_time > threshold
    
    response = {
        "has_data": True,
        "avg_reply_time_minutes": round(avg_reply_time, 1),
        "current_wait_minutes": round(wait_time, 1),
        "exceeds_average": exceeds_average
    }
    
    if exceeds_average:
        response["message"] = f"Based on their response pattern (avg {round(avg_reply_time, 1)} min), you may experience a longer wait time. They usually respond within {round(avg_reply_time, 1)} minutes."
    
    return response

# ==================== INTERVIEW REQUEST ROUTES ====================

@api_router.post("/matches/{match_id}/interview-request")
async def create_interview_request(match_id: str, request: InterviewRequest, current_user: dict = Depends(get_current_user)):
    """Create an interview request (employers only)"""
    if current_user["role"] != "poster":
        raise HTTPException(status_code=403, detail="Only employers can request interviews")
    
    match = await db.matches.find_one({"id": match_id})
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    if match["poster_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    interview_id = str(uuid.uuid4())
    interview_data = {
        "id": interview_id,
        "match_id": match_id,
        "poster_id": current_user["id"],
        "seeker_id": match["seeker_id"],
        "job_id": match["job_id"],
        "proposed_times": request.proposed_times,
        "duration_minutes": request.duration_minutes,
        "meeting_type": request.meeting_type,
        "notes": request.notes,
        "calendly_link": request.calendly_link,
        "zoom_link": request.zoom_link,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.interview_requests.insert_one(interview_data)
    
    # Send notification to seeker
    seeker = await db.users.find_one({"id": match["seeker_id"]}, {"_id": 0})
    job = await db.jobs.find_one({"id": match["job_id"]}, {"_id": 0})
    
    subject = f"🎯 Interview Request - {job.get('title', 'New Opportunity')}"
    html_content = f"""
    <h2>You have a new interview request!</h2>
    <p>Great news! You've been invited to interview for the <strong>{job.get('title')}</strong> position.</p>
    <p><strong>Meeting Type:</strong> {request.meeting_type}</p>
    <p><strong>Duration:</strong> {request.duration_minutes} minutes</p>
    <p>Log in to VitalaMatch to respond to this invitation.</p>
    """
    sms_content = f"VitalaMatch: Interview request for {job.get('title')}! Log in to respond."
    await NotificationService.send_notification(match["seeker_id"], subject, html_content, sms_content)
    
    return {"id": interview_id, "message": "Interview request sent"}

@api_router.get("/interview-requests")
async def get_interview_requests(current_user: dict = Depends(get_current_user)):
    """Get all interview requests for current user"""
    if current_user["role"] == "seeker":
        requests = await db.interview_requests.find({"seeker_id": current_user["id"]}, {"_id": 0}).to_list(100)
    else:
        requests = await db.interview_requests.find({"poster_id": current_user["id"]}, {"_id": 0}).to_list(100)
    
    enriched = []
    for req in requests:
        job = await db.jobs.find_one({"id": req["job_id"]}, {"_id": 0})
        seeker = await db.users.find_one({"id": req["seeker_id"]}, {"_id": 0, "password": 0})
        poster = await db.users.find_one({"id": req["poster_id"]}, {"_id": 0, "password": 0})
        enriched.append({**req, "job": job, "seeker": seeker, "poster": poster})
    
    return enriched

@api_router.put("/interview-requests/{request_id}/respond")
async def respond_to_interview(request_id: str, response: InterviewResponse, current_user: dict = Depends(get_current_user)):
    """Respond to an interview request (seekers only)"""
    if current_user["role"] != "seeker":
        raise HTTPException(status_code=403, detail="Only job seekers can respond to interview requests")
    
    interview = await db.interview_requests.find_one({"id": request_id})
    if not interview:
        raise HTTPException(status_code=404, detail="Interview request not found")
    
    if interview["seeker_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {
        "status": "accepted" if response.accepted else "declined",
        "selected_time": response.selected_time,
        "meeting_link": response.meeting_link,
        "response_notes": response.notes,
        "responded_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.interview_requests.update_one({"id": request_id}, {"$set": update_data})
    
    # Notify poster
    job = await db.jobs.find_one({"id": interview["job_id"]}, {"_id": 0})
    seeker = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    
    status_text = "accepted" if response.accepted else "declined"
    subject = f"Interview {status_text.capitalize()} - {seeker.get('full_name')}"
    html_content = f"""
    <h2>Interview Response</h2>
    <p><strong>{seeker.get('full_name')}</strong> has {status_text} your interview request for <strong>{job.get('title')}</strong>.</p>
    {"<p><strong>Selected Time:</strong> " + response.selected_time + "</p>" if response.selected_time else ""}
    <p>Log in to VitalaMatch for more details.</p>
    """
    sms_content = f"VitalaMatch: {seeker.get('full_name')} {status_text} interview for {job.get('title')}."
    await NotificationService.send_notification(interview["poster_id"], subject, html_content, sms_content)
    
    return {"message": f"Interview {status_text}"}

# ==================== EMPLOYER INTEGRATION SETTINGS ====================

@api_router.put("/settings/calendly")
async def save_calendly_settings(config: CalendlyConfig, current_user: dict = Depends(get_current_user)):
    """Save employer's Calendly integration settings"""
    if current_user["role"] != "poster":
        raise HTTPException(status_code=403, detail="Only employers can configure Calendly")
    
    await db.employer_integrations.update_one(
        {"user_id": current_user["id"]},
        {"$set": {
            "user_id": current_user["id"],
            "calendly_link": config.calendly_link,
            "calendly_access_token": config.access_token,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    return {"message": "Calendly settings saved"}

@api_router.get("/settings/integrations")
async def get_integration_settings(current_user: dict = Depends(get_current_user)):
    """Get employer's integration settings"""
    settings = await db.employer_integrations.find_one({"user_id": current_user["id"]}, {"_id": 0})
    return settings or {}

@api_router.put("/settings/zoom")
async def save_zoom_settings(config: ZoomConfig, current_user: dict = Depends(get_current_user)):
    """Save employer's Zoom integration settings"""
    if current_user["role"] != "poster":
        raise HTTPException(status_code=403, detail="Only employers can configure Zoom")
    
    await db.employer_integrations.update_one(
        {"user_id": current_user["id"]},
        {"$set": {
            "user_id": current_user["id"],
            "zoom_link": config.zoom_link,
            "zoom_access_token": config.access_token,
            "zoom_refresh_token": config.refresh_token,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    return {"message": "Zoom settings saved"}

# ==================== SOCIAL FEED ROUTES ====================

@api_router.post("/feed")
async def create_feed_post(post: FeedPost, current_user: dict = Depends(get_current_user)):
    """Create a new feed post (max 140 characters)"""
    if len(post.content) > 140:
        raise HTTPException(status_code=400, detail="Post content must be 140 characters or less")
    
    post_id = str(uuid.uuid4())
    image_url = None
    
    # Handle image upload
    if post.image_data:
        try:
            # Decode and save image
            image_bytes = base64.b64decode(post.image_data.split(",")[-1] if "," in post.image_data else post.image_data)
            image_filename = f"feed_{post_id}.jpg"
            image_path = Path("uploads/feed") / image_filename
            image_path.parent.mkdir(parents=True, exist_ok=True)
            
            async with aiofiles.open(image_path, 'wb') as f:
                await f.write(image_bytes)
            
            image_url = f"/uploads/feed/{image_filename}"
        except Exception as e:
            logger.error(f"Error saving feed image: {str(e)}")
    
    post_data = {
        "id": post_id,
        "user_id": current_user["id"],
        "user_role": current_user["role"],
        "content": post.content,
        "image_url": image_url,
        "visibility": post.visibility,
        "comment_permission": post.comment_permission,
        "likes_count": 0,
        "comments_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.feed_posts.insert_one(post_data)
    
    # Remove MongoDB _id if present
    post_data.pop("_id", None)
    
    # Add user info
    post_data["user"] = {
        "id": current_user["id"],
        "full_name": current_user.get("full_name"),
        "role": current_user["role"]
    }
    
    return post_data

@api_router.get("/feed")
async def get_feed(current_user: dict = Depends(get_current_user), limit: int = 20, offset: int = 0):
    """Get the social feed"""
    # Get user's matches for visibility filtering
    if current_user["role"] == "seeker":
        matches = await db.matches.find({"seeker_id": current_user["id"]}, {"poster_id": 1}).to_list(1000)
        matched_user_ids = [m["poster_id"] for m in matches]
    else:
        matches = await db.matches.find({"poster_id": current_user["id"]}, {"seeker_id": 1}).to_list(1000)
        matched_user_ids = [m["seeker_id"] for m in matches]
    
    # Build query - show posts that are either public or from matches
    query = {
        "$or": [
            {"visibility": "everyone"},
            {"user_id": current_user["id"]},
            {"user_id": {"$in": matched_user_ids}, "visibility": "matches_only"}
        ]
    }
    
    posts = await db.feed_posts.find(query, {"_id": 0}).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    
    # Enrich posts with user info and like status
    enriched_posts = []
    for post in posts:
        user = await db.users.find_one({"id": post["user_id"]}, {"_id": 0, "password": 0})
        
        # Get profile info based on role
        if post.get("user_role") == "seeker":
            profile = await db.seeker_profiles.find_one({"user_id": post["user_id"]}, {"_id": 0})
        else:
            profile = await db.poster_profiles.find_one({"user_id": post["user_id"]}, {"_id": 0})
        
        # Check if current user liked this post
        user_liked = await db.feed_likes.find_one({"post_id": post["id"], "user_id": current_user["id"]}) is not None
        
        # Check if user can comment
        can_comment = True
        if post["comment_permission"] == "none":
            can_comment = False
        elif post["comment_permission"] == "matches_only":
            can_comment = post["user_id"] == current_user["id"] or post["user_id"] in matched_user_ids
        
        enriched_posts.append({
            **post,
            "user": {
                **user,
                "profile_image": profile.get("profile_image") if profile else None,
                "company_logo": profile.get("company_logo") if profile else None,
                "company_name": profile.get("company_name") if profile else None
            } if user else None,
            "user_liked": user_liked,
            "can_comment": can_comment
        })
    
    return enriched_posts

@api_router.post("/feed/{post_id}/like")
async def like_post(post_id: str, current_user: dict = Depends(get_current_user)):
    """Like a feed post"""
    post = await db.feed_posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Check if already liked
    existing = await db.feed_likes.find_one({"post_id": post_id, "user_id": current_user["id"]})
    if existing:
        # Unlike
        await db.feed_likes.delete_one({"post_id": post_id, "user_id": current_user["id"]})
        await db.feed_posts.update_one({"id": post_id}, {"$inc": {"likes_count": -1}})
        return {"liked": False, "likes_count": post["likes_count"] - 1}
    else:
        # Like
        await db.feed_likes.insert_one({
            "id": str(uuid.uuid4()),
            "post_id": post_id,
            "user_id": current_user["id"],
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        await db.feed_posts.update_one({"id": post_id}, {"$inc": {"likes_count": 1}})
        return {"liked": True, "likes_count": post["likes_count"] + 1}

@api_router.post("/feed/{post_id}/comment")
async def comment_on_post(post_id: str, comment: FeedComment, current_user: dict = Depends(get_current_user)):
    """Comment on a feed post"""
    post = await db.feed_posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Check comment permission
    if post["comment_permission"] == "none":
        raise HTTPException(status_code=403, detail="Comments are disabled for this post")
    
    if post["comment_permission"] == "matches_only":
        # Check if user is matched with post author
        if current_user["role"] == "seeker":
            match = await db.matches.find_one({"seeker_id": current_user["id"], "poster_id": post["user_id"]})
        else:
            match = await db.matches.find_one({"poster_id": current_user["id"], "seeker_id": post["user_id"]})
        
        if not match and post["user_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Only matches can comment on this post")
    
    comment_id = str(uuid.uuid4())
    comment_data = {
        "id": comment_id,
        "post_id": post_id,
        "user_id": current_user["id"],
        "content": comment.content,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.feed_comments.insert_one(comment_data)
    await db.feed_posts.update_one({"id": post_id}, {"$inc": {"comments_count": 1}})
    
    # Remove MongoDB _id if present
    comment_data.pop("_id", None)
    
    # Add user info
    comment_data["user"] = {
        "id": current_user["id"],
        "full_name": current_user.get("full_name"),
        "role": current_user["role"]
    }
    
    return comment_data

@api_router.get("/feed/{post_id}/comments")
async def get_post_comments(post_id: str, current_user: dict = Depends(get_current_user)):
    """Get comments for a post"""
    post = await db.feed_posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    comments = await db.feed_comments.find({"post_id": post_id}, {"_id": 0}).sort("created_at", 1).to_list(100)
    
    enriched = []
    for comment in comments:
        user = await db.users.find_one({"id": comment["user_id"]}, {"_id": 0, "password": 0})
        enriched.append({**comment, "user": user})
    
    return enriched

@api_router.delete("/feed/{post_id}")
async def delete_feed_post(post_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a feed post (owner only)"""
    post = await db.feed_posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if post["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.feed_posts.delete_one({"id": post_id})
    await db.feed_likes.delete_many({"post_id": post_id})
    await db.feed_comments.delete_many({"post_id": post_id})
    
    return {"message": "Post deleted"}

@api_router.get("/feed/user/{user_id}")
async def get_user_feed(user_id: str, current_user: dict = Depends(get_current_user), limit: int = 20, offset: int = 0):
    """Get feed posts from a specific user"""
    # Check visibility permissions
    if user_id != current_user["id"]:
        # Check if matched
        if current_user["role"] == "seeker":
            match = await db.matches.find_one({"seeker_id": current_user["id"], "poster_id": user_id})
        else:
            match = await db.matches.find_one({"poster_id": current_user["id"], "seeker_id": user_id})
        
        is_matched = match is not None
        
        query = {
            "user_id": user_id,
            "$or": [
                {"visibility": "everyone"},
                {"visibility": "matches_only"} if is_matched else {"visibility": "never_match"}  # never_match won't exist
            ]
        }
    else:
        query = {"user_id": user_id}
    
    posts = await db.feed_posts.find(query, {"_id": 0}).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    
    return posts

# ==================== LICENSE VERIFICATION ROUTES ====================

@api_router.post("/licenses")
async def create_license(license_data: LicenseCreate, current_user: dict = Depends(get_current_user)):
    """Create a new license record for verification"""
    if current_user["role"] != "seeker":
        raise HTTPException(status_code=403, detail="Only job seekers can add licenses")
    
    license_id = str(uuid.uuid4())
    license_record = {
        "id": license_id,
        "user_id": current_user["id"],
        "license_type": license_data.license_type,
        "license_number": license_data.license_number,
        "state": license_data.state,
        "expiration_date": license_data.expiration_date,
        "compact_license": license_data.compact_license,
        "document_id": license_data.document_id,
        "verification_status": "pending",
        "verified_at": None,
        "verified_by": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.seeker_licenses.insert_one(license_record)
    
    # Create automatic verification request
    await LicenseVerificationService.create_verification_request(
        license_id=license_id,
        user_id=current_user["id"],
        requested_by=current_user["id"],
        verification_type="document"
    )
    
    return LicenseResponse(**license_record)

@api_router.get("/licenses")
async def get_my_licenses(current_user: dict = Depends(get_current_user)):
    """Get all licenses for current user"""
    if current_user["role"] != "seeker":
        raise HTTPException(status_code=403, detail="Only job seekers have licenses")
    
    licenses = await db.seeker_licenses.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).to_list(100)
    
    return [LicenseResponse(**lic) for lic in licenses]

@api_router.get("/licenses/user/{user_id}")
async def get_user_licenses(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get licenses for a specific user (for employers viewing matched candidates)"""
    # Check if there's a match between current user and the target user
    if current_user["role"] == "poster":
        match = await db.matches.find_one({
            "poster_id": current_user["id"],
            "seeker_id": user_id
        })
        if not match:
            raise HTTPException(status_code=403, detail="You can only view licenses of matched candidates")
    elif current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    licenses = await db.seeker_licenses.find(
        {"user_id": user_id},
        {"_id": 0}
    ).to_list(100)
    
    return [LicenseResponse(**lic) for lic in licenses]

@api_router.delete("/licenses/{license_id}")
async def delete_license(license_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a license record"""
    result = await db.seeker_licenses.delete_one({
        "id": license_id,
        "user_id": current_user["id"]
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="License not found")
    return {"message": "License deleted"}

@api_router.post("/licenses/verify/request")
async def request_verification(request: VerificationRequest, current_user: dict = Depends(get_current_user)):
    """Request verification for a license"""
    license_record = await db.seeker_licenses.find_one({"id": request.license_id}, {"_id": 0})
    if not license_record:
        raise HTTPException(status_code=404, detail="License not found")
    
    # Only license owner or admin can request verification
    if license_record["user_id"] != current_user["id"] and current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await LicenseVerificationService.create_verification_request(
        license_id=request.license_id,
        user_id=license_record["user_id"],
        requested_by=current_user["id"],
        verification_type=request.verification_type
    )
    
    return result

@api_router.post("/licenses/verify/nursys")
async def request_nursys_verification(request: NursysVerificationRequest, current_user: dict = Depends(get_current_user)):
    """Request Nursys verification for a candidate's license (employer only)"""
    if current_user["role"] != "poster":
        raise HTTPException(status_code=403, detail="Only employers can request Nursys verification")
    
    # Check if there's a match
    match = await db.matches.find_one({
        "poster_id": current_user["id"],
        "seeker_id": request.seeker_id
    })
    if not match:
        raise HTTPException(status_code=403, detail="You can only verify licenses of matched candidates")
    
    # Get the license
    license_record = await db.seeker_licenses.find_one({
        "id": request.license_id,
        "user_id": request.seeker_id
    }, {"_id": 0})
    if not license_record:
        raise HTTPException(status_code=404, detail="License not found")
    
    # Get seeker info for Nursys lookup
    seeker = await db.users.find_one({"id": request.seeker_id}, {"_id": 0, "password": 0})
    if not seeker:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    # Parse name
    name_parts = seeker["full_name"].split(" ", 1)
    first_name = name_parts[0]
    last_name = name_parts[1] if len(name_parts) > 1 else ""
    
    # Update license status to nursys_pending
    await db.seeker_licenses.update_one(
        {"id": request.license_id},
        {"$set": {"verification_status": "nursys_pending"}}
    )
    
    # Perform Nursys verification
    result = await LicenseVerificationService.verify_via_nursys(
        license_number=license_record["license_number"],
        state=license_record["state"],
        license_type=license_record["license_type"],
        first_name=first_name,
        last_name=last_name
    )
    
    # Update license with result
    if result.get("success") and result.get("verified"):
        new_status = "nursys_verified"
        verification_result = {
            "verified_at": datetime.now(timezone.utc).isoformat(),
            "nursys_response": result,
            "license_status": result.get("license_status"),
            "compact_status": result.get("compact_status")
        }
    elif result.get("status") == "api_not_configured":
        new_status = "nursys_pending"
        verification_result = {"error": "Nursys API not configured", "note": "Verification pending API setup"}
    else:
        new_status = "nursys_failed"
        verification_result = {"error": result.get("error"), "status": result.get("status")}
    
    await db.seeker_licenses.update_one(
        {"id": request.license_id},
        {
            "$set": {
                "verification_status": new_status,
                "verified_at": datetime.now(timezone.utc).isoformat(),
                "verified_by": current_user["id"],
                "nursys_result": verification_result
            }
        }
    )
    
    # Log the verification request
    await db.license_verifications.insert_one({
        "id": str(uuid.uuid4()),
        "license_id": request.license_id,
        "user_id": request.seeker_id,
        "requested_by": current_user["id"],
        "verification_type": "nursys",
        "status": new_status,
        "result": verification_result,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "license_id": request.license_id,
        "status": new_status,
        "result": verification_result
    }

@api_router.get("/licenses/verification/pending")
async def get_pending_verifications(current_user: dict = Depends(get_current_user)):
    """Get all pending license verifications (admin only)"""
    # For now, allow any user to see pending verifications for their own licenses
    # In production, restrict this to admin users
    
    if current_user["role"] == "seeker":
        # Seekers can see their own verification requests
        verifications = await db.license_verifications.find(
            {"user_id": current_user["id"]},
            {"_id": 0}
        ).to_list(100)
    else:
        # Posters/admins can see all pending verifications
        verifications = await db.license_verifications.find(
            {"status": "pending"},
            {"_id": 0}
        ).to_list(100)
    
    # Enrich with license and user info
    enriched = []
    for v in verifications:
        license_info = await db.seeker_licenses.find_one({"id": v["license_id"]}, {"_id": 0})
        user_info = await db.users.find_one({"id": v["user_id"]}, {"_id": 0, "password": 0})
        enriched.append({
            **v,
            "license": license_info,
            "user": user_info
        })
    
    return enriched

@api_router.post("/licenses/verification/{request_id}/decide")
async def admin_verify_license(
    request_id: str,
    decision: AdminVerificationDecision,
    current_user: dict = Depends(get_current_user)
):
    """Admin decision on license verification"""
    # In production, check for admin role
    # For now, allow posters to verify (as facility admins)
    if current_user["role"] == "seeker":
        raise HTTPException(status_code=403, detail="Not authorized to verify licenses")
    
    verification = await db.license_verifications.find_one({"id": request_id}, {"_id": 0})
    if not verification:
        raise HTTPException(status_code=404, detail="Verification request not found")
    
    result = await LicenseVerificationService.process_admin_verification(
        request_id=request_id,
        admin_id=current_user["id"],
        approved=decision.approved,
        notes=decision.notes
    )
    
    # Send notification to license owner
    status_text = "verified" if decision.approved else "rejected"
    await NotificationService.send_notification(
        verification["user_id"],
        f"License Verification {status_text.title()}",
        f"<p>Your license verification has been <strong>{status_text}</strong>.</p>" +
        (f"<p>Notes: {decision.notes}</p>" if decision.notes else ""),
        f"VitalaMatch: Your license has been {status_text}."
    )
    
    return result

# ==================== REFERENCE ROUTES ====================

@api_router.post("/references/request")
async def request_reference(request: ReferenceRequest, current_user: dict = Depends(get_current_user)):
    """Request a reference from someone"""
    ref_id = str(uuid.uuid4())
    token = str(uuid.uuid4())
    
    ref_data = {
        "id": ref_id,
        "token": token,
        "requested_by": current_user["id"],
        "requested_for": current_user["id"],  # References are for the requester's profile
        "referee_email": request.referee_email,
        "referee_name": request.referee_name,
        "relationship": request.relationship,
        "message": request.message,
        "status": "pending",
        "reference_type": "professional" if current_user["role"] == "seeker" else "facility",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.references.insert_one(ref_data)
    
    # In production, send email to referee with token link
    # For now, return the token for testing
    return {
        "message": "Reference request sent",
        "reference_id": ref_id,
        "submission_link": f"/references/submit/{token}"
    }

@api_router.get("/references/pending")
async def get_pending_references(current_user: dict = Depends(get_current_user)):
    """Get pending reference requests"""
    refs = await db.references.find(
        {"requested_by": current_user["id"]},
        {"_id": 0, "submission": 0}  # Exclude submission content from requester
    ).to_list(100)
    return refs

@api_router.get("/references/submit/{token}")
async def get_reference_request(token: str):
    """Get reference request details for submission (public endpoint)"""
    ref = await db.references.find_one({"token": token, "status": "pending"}, {"_id": 0})
    if not ref:
        raise HTTPException(status_code=404, detail="Reference request not found or already completed")
    
    # Get requester info
    requester = await db.users.find_one({"id": ref["requested_for"]}, {"_id": 0, "password": 0})
    
    return {
        "referee_name": ref["referee_name"],
        "requester_name": requester["full_name"] if requester else "Unknown",
        "relationship": ref["relationship"],
        "message": ref.get("message"),
        "reference_type": ref["reference_type"]
    }

@api_router.post("/references/submit/{token}")
async def submit_reference(token: str, submission: ReferenceSubmission):
    """Submit a reference (public endpoint)"""
    ref = await db.references.find_one({"token": token, "status": "pending"})
    if not ref:
        raise HTTPException(status_code=404, detail="Reference request not found or already completed")
    
    submission_data = submission.model_dump()
    submission_data["submitted_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.references.update_one(
        {"token": token},
        {
            "$set": {
                "status": "completed",
                "submission": submission_data
            }
        }
    )
    
    return {"message": "Reference submitted successfully"}

@api_router.get("/references/view/{user_id}")
async def view_references(user_id: str, current_user: dict = Depends(get_current_user)):
    """View references for a user (only available after match and hidden from the user themselves)"""
    # Check if there's a match between current user and the user whose references we want to view
    if current_user["role"] == "seeker":
        match = await db.matches.find_one({
            "seeker_id": current_user["id"],
            "poster_id": user_id
        })
    else:
        match = await db.matches.find_one({
            "poster_id": current_user["id"],
            "seeker_id": user_id
        })
    
    if not match:
        raise HTTPException(status_code=403, detail="You can only view references after a match")
    
    # Get completed references for the user
    refs = await db.references.find(
        {"requested_for": user_id, "status": "completed"},
        {"_id": 0, "token": 0}
    ).to_list(100)
    
    return refs

# ==================== DOCUMENT ROUTES ====================

@api_router.post("/documents")
async def upload_document(doc: DocumentUpload, current_user: dict = Depends(get_current_user)):
    """Upload a document"""
    doc_id = str(uuid.uuid4())
    
    # Parse expiration date if provided
    expiration = None
    days_until_expiry = None
    if doc.expiration_date:
        try:
            # Handle both ISO format and simple date format
            if 'T' in doc.expiration_date:
                expiration = datetime.fromisoformat(doc.expiration_date.replace('Z', '+00:00'))
            else:
                # Simple date format like "2025-12-31"
                expiration = datetime.strptime(doc.expiration_date, '%Y-%m-%d').replace(tzinfo=timezone.utc)
            days_until_expiry = (expiration - datetime.now(timezone.utc)).days
        except (ValueError, TypeError):
            pass
    
    doc_data = {
        "id": doc_id,
        "user_id": current_user["id"],
        "document_type": doc.document_type,
        "file_name": doc.file_name,
        "file_data": doc.file_data,
        "expiration_date": doc.expiration_date,
        "days_until_expiry": days_until_expiry,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.documents.insert_one(doc_data)
    
    return {"message": "Document uploaded", "document_id": doc_id}

@api_router.get("/documents")
async def get_documents(current_user: dict = Depends(get_current_user)):
    """Get all documents for current user"""
    docs = await db.documents.find(
        {"user_id": current_user["id"]},
        {"_id": 0, "file_data": 0}  # Exclude file data for listing
    ).to_list(100)
    
    # Update days until expiry
    for doc in docs:
        if doc.get("expiration_date"):
            try:
                # Handle both ISO format and simple date format
                if 'T' in doc["expiration_date"]:
                    expiration = datetime.fromisoformat(doc["expiration_date"].replace('Z', '+00:00'))
                else:
                    expiration = datetime.strptime(doc["expiration_date"], '%Y-%m-%d').replace(tzinfo=timezone.utc)
                doc["days_until_expiry"] = (expiration - datetime.now(timezone.utc)).days
            except ValueError:
                pass
    
    return docs

@api_router.get("/documents/expiring")
async def get_expiring_documents(current_user: dict = Depends(get_current_user)):
    """Get documents expiring within 30 days"""
    threshold = datetime.now(timezone.utc) + timedelta(days=30)
    
    docs = await db.documents.find(
        {"user_id": current_user["id"]},
        {"_id": 0, "file_data": 0}
    ).to_list(100)
    
    expiring = []
    for doc in docs:
        if doc.get("expiration_date"):
            try:
                # Handle both ISO format and simple date format
                if 'T' in doc["expiration_date"]:
                    expiration = datetime.fromisoformat(doc["expiration_date"].replace('Z', '+00:00'))
                else:
                    expiration = datetime.strptime(doc["expiration_date"], '%Y-%m-%d').replace(tzinfo=timezone.utc)
                if expiration <= threshold:
                    doc["days_until_expiry"] = (expiration - datetime.now(timezone.utc)).days
                    expiring.append(doc)
            except ValueError:
                pass
    
    return expiring

@api_router.get("/documents/{doc_id}")
async def get_document(doc_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific document"""
    doc = await db.documents.find_one(
        {"id": doc_id, "user_id": current_user["id"]},
        {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc

@api_router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a document"""
    result = await db.documents.delete_one({"id": doc_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"message": "Document deleted"}

# ==================== NOTIFICATION PREFERENCES ====================

@api_router.get("/notifications/preferences")
async def get_notification_preferences(current_user: dict = Depends(get_current_user)):
    """Get notification preferences"""
    prefs = await db.notification_preferences.find_one(
        {"user_id": current_user["id"]},
        {"_id": 0}
    )
    return prefs or {}

@api_router.put("/notifications/preferences")
async def update_notification_preferences(prefs: NotificationPreferences, current_user: dict = Depends(get_current_user)):
    """Update notification preferences"""
    prefs_data = prefs.model_dump()
    prefs_data["user_id"] = current_user["id"]
    prefs_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.notification_preferences.update_one(
        {"user_id": current_user["id"]},
        {"$set": prefs_data},
        upsert=True
    )
    
    return {"message": "Preferences updated"}

# ==================== PUSH NOTIFICATIONS ====================

class PushSubscription(BaseModel):
    endpoint: str
    keys: dict

@api_router.post("/notifications/push-subscription")
async def save_push_subscription(subscription: PushSubscription, current_user: dict = Depends(get_current_user)):
    """Save push notification subscription for user"""
    sub_data = {
        "user_id": current_user["id"],
        "endpoint": subscription.endpoint,
        "keys": subscription.keys,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "active": True
    }
    
    await db.push_subscriptions.update_one(
        {"user_id": current_user["id"]},
        {"$set": sub_data},
        upsert=True
    )
    
    logger.info(f"Push subscription saved for user {current_user['id']}")
    return {"message": "Push subscription saved"}

@api_router.delete("/notifications/push-subscription")
async def delete_push_subscription(current_user: dict = Depends(get_current_user)):
    """Delete push notification subscription for user"""
    await db.push_subscriptions.delete_one({"user_id": current_user["id"]})
    return {"message": "Push subscription deleted"}

@api_router.get("/notifications/push-subscription")
async def get_push_subscription(current_user: dict = Depends(get_current_user)):
    """Get push subscription status"""
    sub = await db.push_subscriptions.find_one({"user_id": current_user["id"]}, {"_id": 0})
    return {"subscribed": bool(sub), "endpoint": sub.get("endpoint") if sub else None}

# ==================== HIRING SUITE ====================

# ----- Employment Offers -----

@api_router.post("/hiring/offers")
async def create_employment_offer(offer: EmploymentOffer, current_user: dict = Depends(get_current_user)):
    """Create a conditional employment offer (employer only)"""
    if current_user["role"] != "poster":
        raise HTTPException(status_code=403, detail="Only employers can send offers")
    
    # Verify match exists and belongs to this employer
    match = await db.matches.find_one({"id": offer.match_id})
    if not match or match["poster_id"] != current_user["id"]:
        raise HTTPException(status_code=404, detail="Match not found")
    
    # Verify job belongs to employer
    job = await db.jobs.find_one({"id": offer.job_id, "poster_id": current_user["id"]})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    offer_id = str(uuid.uuid4())
    offer_data = {
        "id": offer_id,
        "match_id": offer.match_id,
        "job_id": offer.job_id,
        "poster_id": current_user["id"],
        "seeker_id": offer.seeker_id,
        "position_title": offer.position_title,
        "salary_amount": offer.salary_amount,
        "salary_type": offer.salary_type,
        "start_date": offer.start_date,
        "expiration_date": offer.expiration_date,
        "conditions": offer.conditions,
        "benefits_summary": offer.benefits_summary,
        "additional_terms": offer.additional_terms,
        "status": "pending",  # pending, accepted, rejected, withdrawn, expired
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.employment_offers.insert_one(offer_data)
    
    # Notify the seeker
    await NotificationService.send_notification(
        offer.seeker_id,
        "You've Received a Job Offer!",
        f"<h2>Congratulations!</h2><p>You've received a conditional offer for <strong>{offer.position_title}</strong>.</p><p>Log in to VitalaMatch to review and respond.</p>",
        f"VitalaMatch: You've received a job offer for {offer.position_title}! Log in to respond."
    )
    
    return {"id": offer_id, "message": "Offer sent successfully"}

@api_router.get("/hiring/offers")
async def get_employment_offers(current_user: dict = Depends(get_current_user)):
    """Get all employment offers (sent or received based on role)"""
    if current_user["role"] == "poster":
        offers = await db.employment_offers.find(
            {"poster_id": current_user["id"]},
            {"_id": 0}
        ).sort("created_at", -1).to_list(100)
    else:
        offers = await db.employment_offers.find(
            {"seeker_id": current_user["id"]},
            {"_id": 0}
        ).sort("created_at", -1).to_list(100)
    
    # Check for expired offers
    for offer in offers:
        if offer["status"] == "pending":
            try:
                exp_date_str = offer["expiration_date"]
                # Handle both date-only strings (YYYY-MM-DD) and ISO datetime strings
                if 'T' in exp_date_str or '+' in exp_date_str or 'Z' in exp_date_str:
                    exp_date = datetime.fromisoformat(exp_date_str.replace('Z', '+00:00'))
                else:
                    # Date-only string - parse and add timezone
                    exp_date = datetime.strptime(exp_date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                
                if exp_date < datetime.now(timezone.utc):
                    await db.employment_offers.update_one(
                        {"id": offer["id"]},
                        {"$set": {"status": "expired", "updated_at": datetime.now(timezone.utc).isoformat()}}
                    )
                    offer["status"] = "expired"
            except (ValueError, KeyError):
                pass
    
    # Enrich with job and user data
    enriched_offers = []
    for offer in offers:
        job = await db.jobs.find_one({"id": offer["job_id"]}, {"_id": 0})
        seeker = await db.users.find_one({"id": offer["seeker_id"]}, {"_id": 0, "password": 0})
        poster = await db.users.find_one({"id": offer["poster_id"]}, {"_id": 0, "password": 0})
        poster_profile = await db.poster_profiles.find_one({"user_id": offer["poster_id"]}, {"_id": 0})
        
        enriched_offers.append({
            **offer,
            "job": job,
            "seeker": seeker,
            "poster": poster,
            "company_name": poster_profile.get("company_name") if poster_profile else None
        })
    
    return enriched_offers

@api_router.get("/hiring/offers/{offer_id}")
async def get_employment_offer(offer_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific employment offer"""
    offer = await db.employment_offers.find_one({"id": offer_id}, {"_id": 0})
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    if current_user["id"] not in [offer["poster_id"], offer["seeker_id"]]:
        raise HTTPException(status_code=403, detail="Not authorized to view this offer")
    
    job = await db.jobs.find_one({"id": offer["job_id"]}, {"_id": 0})
    poster_profile = await db.poster_profiles.find_one({"user_id": offer["poster_id"]}, {"_id": 0})
    
    return {
        **offer,
        "job": job,
        "company_name": poster_profile.get("company_name") if poster_profile else None
    }

@api_router.put("/hiring/offers/{offer_id}/respond")
async def respond_to_offer(offer_id: str, response: OfferResponse, current_user: dict = Depends(get_current_user)):
    """Accept or reject an employment offer (seeker only)"""
    offer = await db.employment_offers.find_one({"id": offer_id})
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    if offer["seeker_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the recipient can respond to this offer")
    
    if offer["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot respond to {offer['status']} offer")
    
    # Check if expired
    try:
        exp_date_str = offer["expiration_date"]
        # Handle both date-only strings (YYYY-MM-DD) and ISO datetime strings
        if 'T' in exp_date_str or '+' in exp_date_str or 'Z' in exp_date_str:
            exp_date = datetime.fromisoformat(exp_date_str.replace('Z', '+00:00'))
        else:
            # Date-only string - parse and add timezone
            exp_date = datetime.strptime(exp_date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        
        if exp_date < datetime.now(timezone.utc):
            await db.employment_offers.update_one(
                {"id": offer_id},
                {"$set": {"status": "expired", "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            raise HTTPException(status_code=400, detail="This offer has expired")
    except (ValueError, KeyError):
        pass
    
    new_status = "accepted" if response.accepted else "rejected"
    update_data = {
        "status": new_status,
        "response_notes": response.notes,
        "responded_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.employment_offers.update_one({"id": offer_id}, {"$set": update_data})
    
    # If accepted, create employment record and onboarding checklist
    employment_id = None
    if response.accepted:
        employment_id = str(uuid.uuid4())
        employment = {
            "id": employment_id,
            "offer_id": offer_id,
            "poster_id": offer["poster_id"],
            "seeker_id": offer["seeker_id"],
            "job_id": offer["job_id"],
            "position_title": offer["position_title"],
            "start_date": offer["start_date"],
            "status": "onboarding",  # onboarding, active, completed
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.employments.insert_one(employment)
        
        # Create default onboarding checklist (legacy)
        default_items = [
            {"id": str(uuid.uuid4()), "name": "I-9 Employment Eligibility", "description": "Verify identity and employment authorization", "required": True, "due_days": 3, "status": "pending"},
            {"id": str(uuid.uuid4()), "name": "W-4 Tax Withholding", "description": "Federal tax withholding form", "required": True, "due_days": 7, "status": "pending"},
            {"id": str(uuid.uuid4()), "name": "State Tax Form", "description": "State tax withholding form", "required": True, "due_days": 7, "status": "pending"},
            {"id": str(uuid.uuid4()), "name": "Direct Deposit Setup", "description": "Bank account information for payroll", "required": True, "due_days": 7, "status": "pending"},
            {"id": str(uuid.uuid4()), "name": "Emergency Contact", "description": "Emergency contact information", "required": True, "due_days": 7, "status": "pending"},
            {"id": str(uuid.uuid4()), "name": "Policy Handbook Review", "description": "Read and acknowledge company policies", "required": True, "due_days": 14, "status": "pending"},
        ]
        
        onboarding = {
            "id": str(uuid.uuid4()),
            "employment_id": employment_id,
            "items": default_items,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.onboarding_checklists.insert_one(onboarding)
        
        # Create new OnboardingCase with vault-aware requirements
        job = await db.jobs.find_one({"id": offer["job_id"]}, {"_id": 0})
        if job:
            await create_onboarding_case(
                db, offer, job, offer["seeker_id"], offer["poster_id"]
            )
            # Notify candidate: onboarding case created + action required
            await NotificationService.send_notification(
                offer["seeker_id"],
                "Onboarding Started",
                f"<p>Your onboarding for <strong>{offer['position_title']}</strong> has begun. "
                f"Please review your onboarding requirements and complete any pending tasks.</p>",
                f"VitalaMatch: Onboarding started for {offer['position_title']}. Check your tasks."
            )
            # Notify employer: onboarding case created
            await NotificationService.send_notification(
                offer["poster_id"],
                "Onboarding Case Created",
                f"<p>An onboarding case has been created for <strong>{offer['position_title']}</strong>. "
                f"Review the candidate's requirement statuses on your onboarding dashboard.</p>",
                f"VitalaMatch: Onboarding case created for {offer['position_title']}."
            )
    
    # Notify the employer
    seeker = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    action = "accepted" if response.accepted else "declined"
    await NotificationService.send_notification(
        offer["poster_id"],
        f"Offer {action.capitalize()}",
        f"<p><strong>{seeker['full_name']}</strong> has {action} your offer for <strong>{offer['position_title']}</strong>.</p>",
        f"VitalaMatch: {seeker['full_name']} has {action} your job offer."
    )
    
    return {
        "message": f"Offer {new_status}",
        "employment_id": employment_id
    }

@api_router.delete("/hiring/offers/{offer_id}")
async def withdraw_offer(offer_id: str, current_user: dict = Depends(get_current_user)):
    """Withdraw an employment offer (employer only)"""
    offer = await db.employment_offers.find_one({"id": offer_id})
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    if offer["poster_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the sender can withdraw this offer")
    
    if offer["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot withdraw {offer['status']} offer")
    
    await db.employment_offers.update_one(
        {"id": offer_id},
        {"$set": {"status": "withdrawn", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Notify the seeker
    await NotificationService.send_notification(
        offer["seeker_id"],
        "Offer Withdrawn",
        f"<p>The offer for <strong>{offer['position_title']}</strong> has been withdrawn by the employer.</p>",
        f"VitalaMatch: The job offer for {offer['position_title']} has been withdrawn."
    )
    
    return {"message": "Offer withdrawn"}

# ----- Onboarding -----

@api_router.get("/hiring/employments")
async def get_employments(current_user: dict = Depends(get_current_user)):
    """Get all employments for the current user"""
    if current_user["role"] == "poster":
        employments = await db.employments.find(
            {"poster_id": current_user["id"]},
            {"_id": 0}
        ).sort("created_at", -1).to_list(100)
    else:
        employments = await db.employments.find(
            {"seeker_id": current_user["id"]},
            {"_id": 0}
        ).sort("created_at", -1).to_list(100)
    
    # Enrich with user data
    enriched = []
    for emp in employments:
        seeker = await db.users.find_one({"id": emp["seeker_id"]}, {"_id": 0, "password": 0})
        poster = await db.users.find_one({"id": emp["poster_id"]}, {"_id": 0, "password": 0})
        poster_profile = await db.poster_profiles.find_one({"user_id": emp["poster_id"]}, {"_id": 0})
        onboarding = await db.onboarding_checklists.find_one({"employment_id": emp["id"]}, {"_id": 0})
        
        # Calculate onboarding progress
        progress = 0
        if onboarding and onboarding.get("items"):
            completed = sum(1 for item in onboarding["items"] if item.get("status") == "completed")
            progress = int((completed / len(onboarding["items"])) * 100)
        
        enriched.append({
            **emp,
            "seeker": seeker,
            "poster": poster,
            "company_name": poster_profile.get("company_name") if poster_profile else None,
            "onboarding_progress": progress
        })
    
    return enriched

@api_router.get("/hiring/employments/{employment_id}")
async def get_employment(employment_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific employment record"""
    employment = await db.employments.find_one({"id": employment_id}, {"_id": 0})
    if not employment:
        raise HTTPException(status_code=404, detail="Employment not found")
    
    if current_user["id"] not in [employment["poster_id"], employment["seeker_id"]]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    onboarding = await db.onboarding_checklists.find_one({"employment_id": employment_id}, {"_id": 0})
    documents = await db.hiring_documents.find({"employment_id": employment_id}, {"_id": 0, "form_data": 0}).to_list(50)
    
    return {
        **employment,
        "onboarding": onboarding,
        "documents": documents
    }

@api_router.get("/hiring/onboarding/{employment_id}")
async def get_onboarding_checklist(employment_id: str, current_user: dict = Depends(get_current_user)):
    """Get onboarding checklist for an employment"""
    employment = await db.employments.find_one({"id": employment_id})
    if not employment:
        raise HTTPException(status_code=404, detail="Employment not found")
    
    if current_user["id"] not in [employment["poster_id"], employment["seeker_id"]]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    checklist = await db.onboarding_checklists.find_one({"employment_id": employment_id}, {"_id": 0})
    return checklist or {"items": []}

@api_router.post("/hiring/onboarding/{employment_id}/items")
async def add_onboarding_item(employment_id: str, item: OnboardingChecklistItem, current_user: dict = Depends(get_current_user)):
    """Add an item to the onboarding checklist (employer only)"""
    employment = await db.employments.find_one({"id": employment_id})
    if not employment:
        raise HTTPException(status_code=404, detail="Employment not found")
    
    if employment["poster_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only employer can add onboarding items")
    
    item_data = {
        "id": str(uuid.uuid4()),
        "name": item.name,
        "description": item.description,
        "required": item.required,
        "due_days": item.due_days,
        "status": "pending"
    }
    
    await db.onboarding_checklists.update_one(
        {"employment_id": employment_id},
        {"$push": {"items": item_data}}
    )
    
    return {"id": item_data["id"], "message": "Item added"}

@api_router.put("/hiring/onboarding/{employment_id}/items/{item_id}")
async def update_onboarding_item(employment_id: str, item_id: str, status: str, current_user: dict = Depends(get_current_user)):
    """Update onboarding item status"""
    employment = await db.employments.find_one({"id": employment_id})
    if not employment:
        raise HTTPException(status_code=404, detail="Employment not found")
    
    if current_user["id"] not in [employment["poster_id"], employment["seeker_id"]]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.onboarding_checklists.update_one(
        {"employment_id": employment_id, "items.id": item_id},
        {"$set": {"items.$.status": status, "items.$.updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Item updated"}

# ----- Hiring Documents (I-9, W-4, etc.) -----

@api_router.post("/hiring/documents")
async def submit_hiring_document(doc: HiringDocument, current_user: dict = Depends(get_current_user)):
    """Submit a hiring document (seeker only)"""
    employment = await db.employments.find_one({"id": doc.employment_id})
    if not employment:
        raise HTTPException(status_code=404, detail="Employment not found")
    
    if employment["seeker_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the employee can submit documents")
    
    doc_id = str(uuid.uuid4())
    doc_data = {
        "id": doc_id,
        "employment_id": doc.employment_id,
        "seeker_id": current_user["id"],
        "poster_id": employment["poster_id"],
        "document_type": doc.document_type,
        "form_data": doc.form_data,
        "signature": doc.signature,
        "signed_at": doc.signed_at or datetime.now(timezone.utc).isoformat(),
        "status": "submitted",  # submitted, approved, rejected
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.hiring_documents.insert_one(doc_data)
    
    # Mark corresponding onboarding item as completed
    type_to_item = {
        "i9": "I-9 Employment Eligibility",
        "w4": "W-4 Tax Withholding",
        "state_tax": "State Tax Form",
        "direct_deposit": "Direct Deposit Setup",
        "emergency_contact": "Emergency Contact"
    }
    
    item_name = type_to_item.get(doc.document_type)
    if item_name:
        await db.onboarding_checklists.update_one(
            {"employment_id": doc.employment_id, "items.name": item_name},
            {"$set": {"items.$.status": "completed", "items.$.updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    # Notify employer
    await NotificationService.send_notification(
        employment["poster_id"],
        f"Document Submitted: {doc.document_type.upper()}",
        f"<p>A new {doc.document_type.upper()} document has been submitted for review.</p>",
        f"VitalaMatch: New {doc.document_type.upper()} document submitted for review."
    )
    
    return {"id": doc_id, "message": "Document submitted"}

@api_router.get("/hiring/documents/{employment_id}")
async def get_hiring_documents(employment_id: str, current_user: dict = Depends(get_current_user)):
    """Get all hiring documents for an employment"""
    employment = await db.employments.find_one({"id": employment_id})
    if not employment:
        raise HTTPException(status_code=404, detail="Employment not found")
    
    if current_user["id"] not in [employment["poster_id"], employment["seeker_id"]]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    docs = await db.hiring_documents.find(
        {"employment_id": employment_id},
        {"_id": 0}
    ).to_list(50)
    
    return docs

@api_router.put("/hiring/documents/{doc_id}/review")
async def review_hiring_document(doc_id: str, approved: bool, notes: str = None, current_user: dict = Depends(get_current_user)):
    """Review a hiring document (employer only)"""
    doc = await db.hiring_documents.find_one({"id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if doc["poster_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only employer can review documents")
    
    status = "approved" if approved else "rejected"
    await db.hiring_documents.update_one(
        {"id": doc_id},
        {"$set": {
            "status": status,
            "review_notes": notes,
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "reviewed_by": current_user["id"]
        }}
    )
    
    return {"message": f"Document {status}"}

# ----- Policy Documents (Handbooks) -----

@api_router.post("/hiring/policies")
async def upload_policy_document(policy: PolicyDocument, current_user: dict = Depends(get_current_user)):
    """Upload a policy document (employer only)"""
    if current_user["role"] != "poster":
        raise HTTPException(status_code=403, detail="Only employers can upload policies")
    
    policy_id = str(uuid.uuid4())
    policy_data = {
        "id": policy_id,
        "poster_id": current_user["id"],
        "title": policy.title,
        "description": policy.description,
        "file_data": policy.file_data,
        "file_name": policy.file_name,
        "requires_signature": policy.requires_signature,
        "version": policy.version,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.policy_documents.insert_one(policy_data)
    return {"id": policy_id, "message": "Policy uploaded"}

@api_router.get("/hiring/policies")
async def get_policy_documents(current_user: dict = Depends(get_current_user)):
    """Get all policy documents for the employer"""
    if current_user["role"] != "poster":
        raise HTTPException(status_code=403, detail="Only employers can view their policies")
    
    policies = await db.policy_documents.find(
        {"poster_id": current_user["id"], "is_active": True},
        {"_id": 0, "file_data": 0}  # Exclude file data for listing
    ).to_list(100)
    
    return policies

@api_router.get("/hiring/policies/{policy_id}")
async def get_policy_document(policy_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific policy document with file data"""
    policy = await db.policy_documents.find_one({"id": policy_id}, {"_id": 0})
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    
    # Employers can see their own policies, employees can see policies from their employer
    if current_user["role"] == "poster":
        if policy["poster_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    else:
        # Check if seeker has employment with this employer
        employment = await db.employments.find_one({
            "seeker_id": current_user["id"],
            "poster_id": policy["poster_id"]
        })
        if not employment:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    return policy

@api_router.delete("/hiring/policies/{policy_id}")
async def delete_policy_document(policy_id: str, current_user: dict = Depends(get_current_user)):
    """Delete/deactivate a policy document (employer only)"""
    policy = await db.policy_documents.find_one({"id": policy_id})
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    
    if policy["poster_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.policy_documents.update_one(
        {"id": policy_id},
        {"$set": {"is_active": False, "deleted_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Policy deleted"}

@api_router.get("/hiring/policies/for-employment/{employment_id}")
async def get_policies_for_employment(employment_id: str, current_user: dict = Depends(get_current_user)):
    """Get policies that need to be signed for an employment"""
    employment = await db.employments.find_one({"id": employment_id})
    if not employment:
        raise HTTPException(status_code=404, detail="Employment not found")
    
    if current_user["id"] not in [employment["poster_id"], employment["seeker_id"]]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get all active policies from the employer
    policies = await db.policy_documents.find(
        {"poster_id": employment["poster_id"], "is_active": True},
        {"_id": 0, "file_data": 0}
    ).to_list(100)
    
    # Get signatures for this employment
    signatures = await db.policy_signatures.find(
        {"employment_id": employment_id},
        {"_id": 0}
    ).to_list(100)
    
    signed_policy_ids = {sig["policy_id"] for sig in signatures}
    
    # Add signed status to each policy
    for policy in policies:
        policy["signed"] = policy["id"] in signed_policy_ids
    
    return policies

@api_router.post("/hiring/policies/{policy_id}/sign")
async def sign_policy(policy_id: str, signature: PolicySignature, employment_id: str, current_user: dict = Depends(get_current_user)):
    """Sign a policy document (employee only)"""
    employment = await db.employments.find_one({"id": employment_id})
    if not employment:
        raise HTTPException(status_code=404, detail="Employment not found")
    
    if employment["seeker_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the employee can sign")
    
    policy = await db.policy_documents.find_one({"id": policy_id})
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    
    if policy["poster_id"] != employment["poster_id"]:
        raise HTTPException(status_code=400, detail="Policy doesn't belong to this employer")
    
    sig_id = str(uuid.uuid4())
    sig_data = {
        "id": sig_id,
        "policy_id": policy_id,
        "employment_id": employment_id,
        "seeker_id": current_user["id"],
        "signature": signature.signature,
        "signed_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.policy_signatures.insert_one(sig_data)
    
    # Check if all policies are signed, update onboarding item
    all_policies = await db.policy_documents.find(
        {"poster_id": employment["poster_id"], "is_active": True, "requires_signature": True}
    ).to_list(100)
    
    all_signatures = await db.policy_signatures.find({"employment_id": employment_id}).to_list(100)
    signed_ids = {s["policy_id"] for s in all_signatures}
    
    if all(p["id"] in signed_ids for p in all_policies):
        await db.onboarding_checklists.update_one(
            {"employment_id": employment_id, "items.name": "Policy Handbook Review"},
            {"$set": {"items.$.status": "completed", "items.$.updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    return {"id": sig_id, "message": "Policy signed"}

# ----- Employment Reviews -----

@api_router.post("/hiring/reviews")
async def submit_employment_review(review: EmploymentReview, current_user: dict = Depends(get_current_user)):
    """Submit a review for an employment relationship"""
    employment = await db.employments.find_one({"id": review.employment_id})
    if not employment:
        raise HTTPException(status_code=404, detail="Employment not found")
    
    if current_user["id"] not in [employment["poster_id"], employment["seeker_id"]]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Determine who is being reviewed
    if current_user["id"] == employment["poster_id"]:
        reviewee_id = employment["seeker_id"]
        reviewer_type = "employer"
    else:
        reviewee_id = employment["poster_id"]
        reviewer_type = "employee"
    
    # Check if already reviewed
    existing = await db.employment_reviews.find_one({
        "employment_id": review.employment_id,
        "reviewer_id": current_user["id"]
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="You have already submitted a review")
    
    review_id = str(uuid.uuid4())
    review_data = {
        "id": review_id,
        "employment_id": review.employment_id,
        "reviewer_id": current_user["id"],
        "reviewee_id": reviewee_id,
        "reviewer_type": reviewer_type,
        "rating": review.rating,
        "communication_rating": review.communication_rating,
        "professionalism_rating": review.professionalism_rating,
        "reliability_rating": review.reliability_rating,
        "review_text": review.review_text,
        "would_recommend": review.would_recommend,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.employment_reviews.insert_one(review_data)
    
    # Update employment to mark as completed if both reviewed
    other_review = await db.employment_reviews.find_one({
        "employment_id": review.employment_id,
        "reviewer_id": reviewee_id
    })
    
    if other_review:
        await db.employments.update_one(
            {"id": review.employment_id},
            {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    return {"id": review_id, "message": "Review submitted"}

@api_router.get("/hiring/reviews/pending")
async def get_pending_reviews(current_user: dict = Depends(get_current_user)):
    """Get employments pending review from current user"""
    if current_user["role"] == "poster":
        employments = await db.employments.find(
            {"poster_id": current_user["id"], "status": {"$in": ["active", "onboarding"]}}
        ).to_list(100)
    else:
        employments = await db.employments.find(
            {"seeker_id": current_user["id"], "status": {"$in": ["active", "onboarding"]}}
        ).to_list(100)
    
    pending = []
    for emp in employments:
        # Check if current user has already reviewed
        existing_review = await db.employment_reviews.find_one({
            "employment_id": emp["id"],
            "reviewer_id": current_user["id"]
        })
        
        if not existing_review:
            # Check if employment is old enough to review (e.g., 30+ days)
            created = datetime.fromisoformat(emp["created_at"].replace('Z', '+00:00'))
            if (datetime.now(timezone.utc) - created).days >= 30:
                other_user_id = emp["seeker_id"] if current_user["role"] == "poster" else emp["poster_id"]
                other_user = await db.users.find_one({"id": other_user_id}, {"_id": 0, "password": 0})
                pending.append({
                    "employment_id": emp["id"],
                    "position_title": emp.get("position_title"),
                    "other_party": other_user,
                    "start_date": emp.get("start_date"),
                    "days_employed": (datetime.now(timezone.utc) - created).days
                })
    
    return pending

@api_router.get("/profiles/{user_id}/reviews")
async def get_profile_reviews(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get reviews for a user's profile"""
    reviews = await db.employment_reviews.find(
        {"reviewee_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    # Calculate averages
    if reviews:
        avg_rating = sum(r["rating"] for r in reviews) / len(reviews)
        avg_communication = sum(r.get("communication_rating", 0) for r in reviews) / len(reviews)
        avg_professionalism = sum(r.get("professionalism_rating", 0) for r in reviews) / len(reviews)
        avg_reliability = sum(r.get("reliability_rating", 0) for r in reviews) / len(reviews)
        recommend_pct = sum(1 for r in reviews if r.get("would_recommend")) / len(reviews) * 100
    else:
        avg_rating = avg_communication = avg_professionalism = avg_reliability = recommend_pct = 0
    
    # Enrich reviews with reviewer info (hide identity for employee reviews)
    enriched = []
    for review in reviews:
        reviewer = await db.users.find_one({"id": review["reviewer_id"]}, {"_id": 0, "password": 0})
        
        # For employer reviews of employees, show company name
        # For employee reviews of employers, show generic "Former Employee"
        if review["reviewer_type"] == "employer":
            poster_profile = await db.poster_profiles.find_one({"user_id": review["reviewer_id"]}, {"_id": 0})
            reviewer_display = poster_profile.get("company_name", "Employer") if poster_profile else "Employer"
        else:
            reviewer_display = "Former Employee"
        
        enriched.append({
            **review,
            "reviewer_display": reviewer_display
        })
    
    return {
        "reviews": enriched,
        "stats": {
            "total_reviews": len(reviews),
            "avg_rating": round(avg_rating, 1),
            "avg_communication": round(avg_communication, 1),
            "avg_professionalism": round(avg_professionalism, 1),
            "avg_reliability": round(avg_reliability, 1),
            "recommendation_percentage": round(recommend_pct)
        }
    }

@api_router.post("/hiring/request-review/{employment_id}")
async def request_review(employment_id: str, current_user: dict = Depends(get_current_user)):
    """Send review request notification to the other party"""
    employment = await db.employments.find_one({"id": employment_id})
    if not employment:
        raise HTTPException(status_code=404, detail="Employment not found")
    
    if current_user["id"] not in [employment["poster_id"], employment["seeker_id"]]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Determine other party
    if current_user["id"] == employment["poster_id"]:
        other_party_id = employment["seeker_id"]
    else:
        other_party_id = employment["poster_id"]
    
    # Send notification
    await NotificationService.send_notification(
        other_party_id,
        "Review Request",
        f"<p>You've been asked to leave a review for your experience at <strong>{employment.get('position_title', 'your position')}</strong>.</p><p>Your feedback helps others make informed decisions.</p>",
        f"VitalaMatch: Please leave a review for your recent employment experience."
    )
    
    return {"message": "Review request sent"}

# ==================== STATS/DASHBOARD ====================

@api_router.get("/stats")
async def get_stats(current_user: dict = Depends(get_current_user)):
    """Get dashboard stats"""
    if current_user["role"] == "seeker":
        matches_count = await db.matches.count_documents({"seeker_id": current_user["id"]})
        pending_refs = await db.references.count_documents({"requested_by": current_user["id"], "status": "pending"})
        completed_refs = await db.references.count_documents({"requested_by": current_user["id"], "status": "completed"})
        expiring_docs_response = await get_expiring_documents(current_user)
        expiring_docs = len(expiring_docs_response)
        
        return {
            "matches": matches_count,
            "pending_references": pending_refs,
            "completed_references": completed_refs,
            "expiring_documents": expiring_docs
        }
    else:
        jobs_count = await db.jobs.count_documents({"poster_id": current_user["id"]})
        matches_count = await db.matches.count_documents({"poster_id": current_user["id"]})
        pending_refs = await db.references.count_documents({"requested_by": current_user["id"], "status": "pending"})
        
        return {
            "active_jobs": jobs_count,
            "matches": matches_count,
            "pending_references": pending_refs
        }

# ==================== ROOT ====================

@api_router.get("/")
async def root():
    return {"message": "VitalaMatch API", "version": "1.0.0"}

# ==================== ADMIN/SYSTEM ROUTES ====================

@api_router.post("/admin/check-expirations")
async def trigger_expiration_check(current_user: dict = Depends(get_current_user)):
    """Manually trigger document expiration check (for testing)"""
    count = await DocumentExpirationChecker.check_expiring_documents()
    return {"message": f"Expiration check complete. Notified {count} users."}

@api_router.get("/admin/notification-logs")
async def get_notification_logs(current_user: dict = Depends(get_current_user)):
    """Get notification logs for current user"""
    logs = await db.notification_logs.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("sent_at", -1).to_list(50)
    return logs

@api_router.get("/specialties")
async def get_specialties():
    """Get list of all available specialties"""
    return {
        "nursing": NURSING_SPECIALTIES,
        "allied_health": ALLIED_HEALTH_SPECIALTIES,
        "all": NURSING_SPECIALTIES + ALLIED_HEALTH_SPECIALTIES
    }

# ==================== SECURE DOCUMENT VAULT (moved to routes/vault.py) ====================

# ==================== ONBOARDING CASES ====================

@api_router.get("/onboarding/cases")
async def get_onboarding_cases(current_user: dict = Depends(get_current_user)):
    """Get onboarding cases for the current user (candidate sees their own, employer sees their candidates')"""
    if current_user["role"] == "seeker":
        cases = await db.onboarding_cases.find(
            {"candidate_id": current_user["id"]}, {"_id": 0}
        ).sort("created_at", -1).to_list(50)
    else:
        cases = await db.onboarding_cases.find(
            {"employer_id": current_user["id"]}, {"_id": 0}
        ).sort("created_at", -1).to_list(50)

    enriched = []
    for case in cases:
        job = await db.jobs.find_one({"id": case["job_id"]}, {"_id": 0, "description": 0})
        candidate = await db.users.find_one({"id": case["candidate_id"]}, {"_id": 0, "password": 0})
        employer = await db.users.find_one({"id": case["employer_id"]}, {"_id": 0, "password": 0})
        reqs = await db.onboarding_requirements.find(
            {"onboarding_case_id": case["id"]}, {"_id": 0}
        ).to_list(50)
        tasks = await db.onboarding_tasks.find(
            {"onboarding_case_id": case["id"]}, {"_id": 0}
        ).to_list(50)
        progress = compute_progress(reqs)
        # Sync case status from requirements
        computed_status = compute_case_status(reqs)
        if computed_status != case.get("status"):
            await db.onboarding_cases.update_one(
                {"id": case["id"]}, {"$set": {"status": computed_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            case["status"] = computed_status
        enriched.append({
            **case,
            "job": job,
            "candidate": candidate,
            "employer": employer,
            "requirements": reqs,
            "tasks": tasks,
            "progress": progress,
        })
    return enriched

@api_router.get("/onboarding/cases/{case_id}")
async def get_onboarding_case(case_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific onboarding case with full details"""
    case = await db.onboarding_cases.find_one({"id": case_id}, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail="Onboarding case not found")
    if current_user["id"] not in (case["candidate_id"], case["employer_id"]):
        raise HTTPException(status_code=403, detail="Not authorized")

    job = await db.jobs.find_one({"id": case["job_id"]}, {"_id": 0, "description": 0})
    candidate = await db.users.find_one({"id": case["candidate_id"]}, {"_id": 0, "password": 0})
    reqs = await db.onboarding_requirements.find(
        {"onboarding_case_id": case_id}, {"_id": 0}
    ).to_list(50)
    tasks = await db.onboarding_tasks.find(
        {"onboarding_case_id": case_id}, {"_id": 0}
    ).to_list(50)
    doc_matches = await db.requirement_document_matches.find(
        {"onboarding_requirement_id": {"$in": [r["id"] for r in reqs]}}, {"_id": 0}
    ).to_list(200)

    # Enrich requirements with matched vault docs
    match_map = {m["onboarding_requirement_id"]: m for m in doc_matches}
    for req in reqs:
        req["document_match"] = match_map.get(req["id"])

    progress = compute_progress(reqs)

    return {
        **case,
        "job": job,
        "candidate": candidate,
        "requirements": reqs,
        "tasks": tasks,
        "document_matches": doc_matches,
        "progress": progress,
    }

@api_router.put("/onboarding/requirements/{req_id}/status")
async def update_requirement_status(req_id: str, current_user: dict = Depends(get_current_user)):
    """Mark a requirement as completed (employer or admin)"""
    req = await db.onboarding_requirements.find_one({"id": req_id})
    if not req:
        raise HTTPException(status_code=404, detail="Requirement not found")
    case = await db.onboarding_cases.find_one({"id": req["onboarding_case_id"]})
    if not case:
        raise HTTPException(status_code=404, detail="Onboarding case not found")
    # Allow candidate, employer, or admin
    is_admin = current_user.get("role") == "admin"
    is_party = current_user["id"] in (case["candidate_id"], case["employer_id"])
    if not is_admin and not is_party:
        raise HTTPException(status_code=403, detail="Not authorized")
    await db.onboarding_requirements.update_one(
        {"id": req_id}, {"$set": {"status": "completed"}}
    )
    await db.onboarding_tasks.update_many(
        {"onboarding_requirement_id": req_id},
        {"$set": {"status": "completed"}}
    )
    # Recompute case status
    all_reqs = await db.onboarding_requirements.find(
        {"onboarding_case_id": case["id"]}, {"_id": 0}
    ).to_list(50)
    # Simulate the update we just made
    for r in all_reqs:
        if r["id"] == req_id:
            r["status"] = "completed"
    new_status = compute_case_status(all_reqs)
    await db.onboarding_cases.update_one(
        {"id": case["id"]}, {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    # Notify candidate if cleared
    if new_status == "cleared":
        await NotificationService.send_notification(
            case["candidate_id"],
            "Onboarding Cleared!",
            "<p>Congratulations! All your onboarding requirements have been completed. You are cleared to start.</p>",
            "VitalaMatch: Your onboarding is complete! You are cleared to start."
        )
    return {"message": "Requirement marked as completed", "case_status": new_status}

@api_router.post("/onboarding/requirements/{req_id}/upload")
async def upload_for_requirement(
    req_id: str,
    file: UploadFile = File(...),
    category: str = Form(...),
    subtype: str = Form(None),
    issuing_authority: str = Form(None),
    document_number: str = Form(None),
    expiration_date: str = Form(None),
    state: str = Form(None),
    current_user: dict = Depends(get_current_user),
):
    """Upload a file directly to fulfill an onboarding requirement (adds to vault + links)"""
    req = await db.onboarding_requirements.find_one({"id": req_id})
    if not req:
        raise HTTPException(status_code=404, detail="Requirement not found")
    case = await db.onboarding_cases.find_one({"id": req["onboarding_case_id"]})
    if not case or case["candidate_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Validate file
    allowed = (".pdf", ".jpg", ".jpeg", ".png", ".webp", ".heic", ".doc", ".docx")
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in allowed:
        raise HTTPException(status_code=400, detail=f"File type not allowed. Accepted: {', '.join(allowed)}")
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Max 10 MB.")

    # Save file
    doc_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    safe_name = f"{doc_id}{ext}"
    file_path = VAULT_UPLOAD_DIR / safe_name
    async with aiofiles.open(file_path, "wb") as f:
        await f.write(contents)

    file_url = f"/api/vault/files/{safe_name}"
    doc_data = {
        "id": doc_id,
        "candidate_id": current_user["id"],
        "category": category,
        "subtype": subtype or None,
        "issuing_authority": issuing_authority or None,
        "document_number": document_number or None,
        "issue_date": None,
        "expiration_date": expiration_date or None,
        "document_date": now_iso[:10],
        "state": state or None,
        "verification_status": "pending",
        "file_url": file_url,
        "file_name": file.filename,
        "file_size": len(contents),
        "content_type": file.content_type,
        "extracted_fields": {},
        "uploaded_at": now_iso,
        "last_reviewed_at": None,
    }
    await db.vault_documents.insert_one(doc_data)

    # Link to requirement
    match_link = {
        "id": str(uuid.uuid4()),
        "onboarding_requirement_id": req_id,
        "vault_document_id": doc_id,
        "match_status": "pending_manual_review",
        "matched_by": "candidate",
        "matched_at": now_iso,
        "notes": "Uploaded by candidate for requirement fulfillment",
    }
    await db.requirement_document_matches.insert_one(match_link)

    # Update requirement and task statuses
    await db.onboarding_requirements.update_one(
        {"id": req_id},
        {"$set": {"status": "pending_manual_review", "fulfillment_source": "candidate_upload"}}
    )
    await db.onboarding_tasks.update_many(
        {"onboarding_requirement_id": req_id},
        {"$set": {"status": "in_progress"}}
    )
    return {"id": doc_id, "file_url": file_url, "message": "Document uploaded and linked to requirement"}

@api_router.get("/onboarding/tasks")
async def get_onboarding_tasks(current_user: dict = Depends(get_current_user)):
    """Get all tasks for the current user"""
    if current_user["role"] == "seeker":
        tasks = await db.onboarding_tasks.find(
            {"assigned_to": "candidate"}, {"_id": 0}
        ).to_list(200)
        # Filter to tasks belonging to this candidate's cases
        case_ids = [c["id"] for c in await db.onboarding_cases.find(
            {"candidate_id": current_user["id"]}, {"id": 1, "_id": 0}
        ).to_list(50)]
        tasks = [t for t in tasks if t.get("onboarding_case_id") in case_ids]
    else:
        tasks = await db.onboarding_tasks.find(
            {"assigned_to": {"$in": ["admin", "system"]}}, {"_id": 0}
        ).to_list(200)
        case_ids = [c["id"] for c in await db.onboarding_cases.find(
            {"employer_id": current_user["id"]}, {"id": 1, "_id": 0}
        ).to_list(50)]
        tasks = [t for t in tasks if t.get("onboarding_case_id") in case_ids]

    # Enrich with requirement info
    for task in tasks:
        req = await db.onboarding_requirements.find_one(
            {"id": task.get("onboarding_requirement_id")}, {"_id": 0}
        )
        task["requirement"] = req
    return tasks

# ==================== ADMIN ONBOARDING PANEL ====================

class AdminRequirementUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    vault_document_id: Optional[str] = None  # manually attach a vault doc

@api_router.get("/admin/onboarding/cases")
async def admin_get_all_cases(current_user: dict = Depends(get_current_user)):
    """Admin: view all onboarding cases across all employers/candidates"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    cases = await db.onboarding_cases.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    enriched = []
    for case in cases:
        job = await db.jobs.find_one({"id": case["job_id"]}, {"_id": 0, "description": 0})
        candidate = await db.users.find_one({"id": case["candidate_id"]}, {"_id": 0, "password": 0})
        employer = await db.users.find_one({"id": case["employer_id"]}, {"_id": 0, "password": 0})
        reqs = await db.onboarding_requirements.find(
            {"onboarding_case_id": case["id"]}, {"_id": 0}
        ).to_list(50)
        progress = compute_progress(reqs)
        computed_status = compute_case_status(reqs)
        if computed_status != case.get("status"):
            await db.onboarding_cases.update_one(
                {"id": case["id"]}, {"$set": {"status": computed_status}}
            )
            case["status"] = computed_status
        enriched.append({
            **case, "job": job, "candidate": candidate, "employer": employer,
            "requirements": reqs, "progress": progress,
        })
    return enriched

@api_router.get("/admin/onboarding/cases/{case_id}")
async def admin_get_case_detail(case_id: str, current_user: dict = Depends(get_current_user)):
    """Admin: get full onboarding case detail including vault matches"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    case = await db.onboarding_cases.find_one({"id": case_id}, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    job = await db.jobs.find_one({"id": case["job_id"]}, {"_id": 0, "description": 0})
    candidate = await db.users.find_one({"id": case["candidate_id"]}, {"_id": 0, "password": 0})
    employer = await db.users.find_one({"id": case["employer_id"]}, {"_id": 0, "password": 0})
    reqs = await db.onboarding_requirements.find(
        {"onboarding_case_id": case_id}, {"_id": 0}
    ).to_list(50)
    tasks = await db.onboarding_tasks.find(
        {"onboarding_case_id": case_id}, {"_id": 0}
    ).to_list(50)
    doc_matches = await db.requirement_document_matches.find(
        {"onboarding_requirement_id": {"$in": [r["id"] for r in reqs]}}, {"_id": 0}
    ).to_list(200)
    # Enrich with vault doc details
    match_map = {}
    for m in doc_matches:
        vault_doc = await db.vault_documents.find_one(
            {"id": m["vault_document_id"]}, {"_id": 0, "file_data": 0}
        )
        m["vault_document"] = vault_doc
        match_map[m["onboarding_requirement_id"]] = m
    for req in reqs:
        req["document_match"] = match_map.get(req["id"])
    progress = compute_progress(reqs)
    return {
        **case, "job": job, "candidate": candidate, "employer": employer,
        "requirements": reqs, "tasks": tasks, "document_matches": doc_matches,
        "progress": progress,
    }

@api_router.put("/admin/onboarding/requirements/{req_id}")
async def admin_update_requirement(req_id: str, update: AdminRequirementUpdate, current_user: dict = Depends(get_current_user)):
    """Admin: update requirement status, notes, or manually attach a vault document"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    req = await db.onboarding_requirements.find_one({"id": req_id})
    if not req:
        raise HTTPException(status_code=404, detail="Requirement not found")

    update_fields = {}
    if update.status:
        valid_statuses = [
            "satisfied_from_vault", "missing_document", "document_expired",
            "pending_manual_review", "pending_external_check",
            "action_required_candidate", "in_progress", "completed", "flagged_issue"
        ]
        if update.status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
        update_fields["status"] = update.status
    if update.notes is not None:
        update_fields["notes"] = update.notes

    if update_fields:
        await db.onboarding_requirements.update_one({"id": req_id}, {"$set": update_fields})

    # Manually attach vault document
    if update.vault_document_id:
        vault_doc = await db.vault_documents.find_one({"id": update.vault_document_id}, {"_id": 0})
        if not vault_doc:
            raise HTTPException(status_code=404, detail="Vault document not found")
        now_iso = datetime.now(timezone.utc).isoformat()
        # Remove old match if exists
        await db.requirement_document_matches.delete_many({"onboarding_requirement_id": req_id})
        match_link = {
            "id": str(uuid.uuid4()),
            "onboarding_requirement_id": req_id,
            "vault_document_id": update.vault_document_id,
            "match_status": update.status or "pending_manual_review",
            "matched_by": "admin",
            "matched_at": now_iso,
            "notes": update.notes or "Manually attached by admin",
        }
        await db.requirement_document_matches.insert_one(match_link)

    # Update task statuses if requirement completed
    if update.status in ("completed", "satisfied_from_vault"):
        await db.onboarding_tasks.update_many(
            {"onboarding_requirement_id": req_id}, {"$set": {"status": "completed"}}
        )

    # Recompute case status
    case = await db.onboarding_cases.find_one({"id": req["onboarding_case_id"]})
    if case:
        all_reqs = await db.onboarding_requirements.find(
            {"onboarding_case_id": case["id"]}, {"_id": 0}
        ).to_list(50)
        for r in all_reqs:
            if r["id"] == req_id and update.status:
                r["status"] = update.status
        new_status = compute_case_status(all_reqs)
        await db.onboarding_cases.update_one(
            {"id": case["id"]}, {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        if new_status == "cleared":
            await NotificationService.send_notification(
                case["candidate_id"], "Onboarding Cleared!",
                "<p>All onboarding requirements have been completed. You are cleared to start.</p>",
                "VitalaMatch: Onboarding complete! You are cleared to start."
            )

    return {"message": "Requirement updated"}

@api_router.get("/admin/vault/documents/{candidate_id}")
async def admin_get_candidate_vault(candidate_id: str, current_user: dict = Depends(get_current_user)):
    """Admin: view a candidate's vault documents for manual matching"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    docs = await db.vault_documents.find(
        {"candidate_id": candidate_id}, {"_id": 0, "file_data": 0}
    ).sort("uploaded_at", -1).to_list(200)
    return docs

# ==================== ADMIN SEED ====================

@api_router.post("/admin/seed")
async def seed_admin_user():
    """Seed an admin user for testing (idempotent)"""
    existing = await db.users.find_one({"email": "admin@vitalamatch.com"})
    if existing:
        return {"message": "Admin user already exists", "id": existing["id"]}
    admin_id = str(uuid.uuid4())
    hashed = bcrypt.hashpw("admin123".encode(), bcrypt.gensalt()).decode()
    admin_user = {
        "id": admin_id,
        "email": "admin@vitalamatch.com",
        "password": hashed,
        "full_name": "System Admin",
        "role": "admin",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(admin_user)
    return {"message": "Admin user created", "id": admin_id}

# ==================== TRAINING & COMPLIANCE (moved to routes/training.py) ====================

@api_router.get("/audit/logs")
async def get_audit_logs(current_user: dict = Depends(get_current_user)):
    """Get audit logs (admin only)"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    logs = await db.audit_logs.find(
        {}, {"_id": 0}
    ).sort("timestamp", -1).to_list(200)
    return logs

# ==================== HIPAA PREP NOTES ====================
# This section documents what would be needed for future HIPAA compliance:
# 1. PHI (Protected Health Information) encryption at rest (MongoDB field-level encryption)
# 2. Full audit trail for all PHI access (audit_logs collection started)
# 3. BAA (Business Associate Agreement) with cloud providers
# 4. Role-based access control (RBAC) - currently: seeker/poster/admin roles
# 5. Automatic session timeout (JWT expiration set to 24h, should be reduced)
# 6. Data breach notification procedures
# 7. Employee training on HIPAA requirements
# 8. Annual risk assessments
# 9. Minimum necessary access principle (vault files restricted to owner/admin/employer-with-case)
# 10. Secure data disposal procedures
# NOTE: VitalaMatch does NOT claim HIPAA compliance at this time.

# Include routers
from routes.auth import router as auth_router
from routes.vault import router as vault_router
from routes.training import router as training_router
from routes.references import router as references_router
from routes.resume import router as resume_router
from routes.billing import router as billing_router
from routes.pipeline import router as pipeline_router
from routes.matching import router as matching_router
api_router.include_router(auth_router)
api_router.include_router(vault_router)
api_router.include_router(training_router)
api_router.include_router(references_router)
api_router.include_router(resume_router)
api_router.include_router(billing_router)
api_router.include_router(pipeline_router)
api_router.include_router(matching_router)

# Include the main api_router
app.include_router(api_router)

# Stripe webhook (outside /api prefix for direct Stripe access)
from fastapi import Request as FastAPIRequest
from emergentintegrations.payments.stripe.checkout import StripeCheckout
@app.post("/api/webhook/stripe")
async def stripe_webhook(request: FastAPIRequest):
    """Handle Stripe webhook events"""
    stripe_key = os.environ.get("STRIPE_API_KEY")
    if not stripe_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    host_url = str(request.base_url).rstrip("/")
    stripe = StripeCheckout(api_key=stripe_key, webhook_url=f"{host_url}/api/webhook/stripe")
    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    try:
        event = await stripe.handle_webhook(body, sig)
        # Log the webhook event
        await db.webhook_events.insert_one({
            "event_type": event.event_type,
            "event_id": event.event_id,
            "session_id": event.session_id,
            "payment_status": event.payment_status,
            "metadata": event.metadata,
            "received_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Stripe webhook error: {str(e)}")
        return {"status": "error", "message": str(e)}

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
