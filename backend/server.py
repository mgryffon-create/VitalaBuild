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

# SendGrid and Twilio imports
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content
from twilio.rest import Client as TwilioClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'medjobmatch-secret-key-2024')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# SendGrid Configuration
SENDGRID_API_KEY = os.environ.get('SENDGRID_API_KEY')
SENDGRID_FROM_EMAIL = os.environ.get('SENDGRID_FROM_EMAIL', 'noreply@medjobmatch.com')

# Twilio Configuration
TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN')
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
        """Send SMS via Twilio"""
        if not all([TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER]):
            logger.warning(f"Twilio not configured. Would send SMS to {to_phone}: {message}")
            return False
        
        try:
            client = TwilioClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
            msg = client.messages.create(
                body=message,
                from_=TWILIO_PHONE_NUMBER,
                to=to_phone
            )
            logger.info(f"SMS sent to {to_phone}, SID: {msg.sid}")
            return True
        except Exception as e:
            logger.error(f"Failed to send SMS to {to_phone}: {str(e)}")
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
        Verify a nursing license via Nursys API
        Returns verification result with status and details
        """
        if not NURSYS_API_KEY:
            logger.warning("Nursys API not configured. Cannot perform license verification.")
            return {
                "success": False,
                "error": "Nursys API not configured",
                "status": "api_not_configured"
            }
        
        try:
            import httpx
            
            # Nursys API request (structure based on typical license verification APIs)
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{NURSYS_API_URL}/verify",
                    headers={
                        "Authorization": f"Bearer {NURSYS_API_KEY}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "license_number": license_number,
                        "state": state,
                        "license_type": license_type,
                        "first_name": first_name,
                        "last_name": last_name
                    },
                    timeout=30.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return {
                        "success": True,
                        "verified": data.get("verified", False),
                        "license_status": data.get("license_status", "unknown"),
                        "expiration_date": data.get("expiration_date"),
                        "discipline_actions": data.get("discipline_actions", []),
                        "compact_status": data.get("compact_status"),
                        "raw_response": data
                    }
                else:
                    return {
                        "success": False,
                        "error": f"API returned status {response.status_code}",
                        "status": "api_error"
                    }
                    
        except Exception as e:
            logger.error(f"Nursys verification failed: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "status": "exception"
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
                
                subject = f"MedJobMatch: {len(expiring_docs)} Document(s) Need Attention"
                
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
                <p>Please log in to MedJobMatch to upload renewed documents.</p>
                """
                
                sms_content = f"MedJobMatch: {len(expiring_docs)} document(s) expiring soon. Log in to renew."
                
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
    logger.info("Starting MedJobMatch API...")
    
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
    logger.info("MedJobMatch API shutdown complete")

# Create the main app with lifespan
app = FastAPI(title="MedJobMatch API", lifespan=lifespan)

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

class PosterProfile(BaseModel):
    company_name: Optional[str] = None
    company_description: Optional[str] = None
    company_logo: Optional[str] = None
    contact_info: Optional[Dict[str, Any]] = None
    facility_images: Optional[List[str]] = None

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
    seeker_certs = [c.get('name', '').lower() for c in seeker_profile.get('certifications', [])]
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

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserRegister):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": user_data.email,
        "password": hash_password(user_data.password),
        "role": user_data.role,
        "full_name": user_data.full_name,
        "profile_complete": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user)
    
    # Create empty profile based on role
    if user_data.role == "seeker":
        await db.seeker_profiles.insert_one({"user_id": user_id, "created_at": datetime.now(timezone.utc).isoformat()})
    else:
        await db.poster_profiles.insert_one({"user_id": user_id, "created_at": datetime.now(timezone.utc).isoformat()})
    
    # Create default notification preferences
    await db.notification_preferences.insert_one({
        "user_id": user_id,
        "email_enabled": True,
        "sms_enabled": False,
        "frequency": "immediate",
        "match_notifications": True,
        "message_notifications": True,
        "document_reminders": True
    })
    
    token = create_token(user_id, user_data.role)
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_id,
            email=user_data.email,
            role=user_data.role,
            full_name=user_data.full_name,
            profile_complete=False,
            created_at=user["created_at"]
        )
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"], user["role"])
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            role=user["role"],
            full_name=user["full_name"],
            profile_complete=user.get("profile_complete", False),
            created_at=user["created_at"]
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
        full_name=current_user["full_name"],
        profile_complete=current_user.get("profile_complete", False),
        created_at=current_user["created_at"]
    )

# ==================== PROFILE ROUTES ====================

@api_router.get("/profile/seeker")
async def get_seeker_profile(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "seeker":
        raise HTTPException(status_code=403, detail="Not a job seeker")
    
    profile = await db.seeker_profiles.find_one({"user_id": current_user["id"]}, {"_id": 0})
    return profile or {}

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

# ==================== JOB ROUTES ====================

@api_router.post("/jobs", response_model=JobPostingResponse)
async def create_job(job: JobPosting, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "poster":
        raise HTTPException(status_code=403, detail="Only job posters can create jobs")
    
    poster_profile = await db.poster_profiles.find_one({"user_id": current_user["id"]}, {"_id": 0})
    
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
            <p>Log in to MedJobMatch to start a conversation and learn more about this opportunity.</p>
            """
            sms_content = f"MedJobMatch: You matched with {job.get('company_name', 'a facility')} for {job.get('title')}! Log in to chat."
            await NotificationService.send_notification(seeker_id, subject, html_content, sms_content)
        
        # Notify poster
        poster_prefs = await db.notification_preferences.find_one({"user_id": poster_id}, {"_id": 0})
        if poster_prefs and poster_prefs.get("match_notifications", True):
            subject = f"🎉 New Match! - {seeker.get('full_name', 'A candidate')}"
            html_content = f"""
            <h2>Congratulations! You have a new match!</h2>
            <p>Great news! <strong>{seeker.get('full_name')}</strong> is interested in your <strong>{job.get('title')}</strong> position.</p>
            <p>Log in to MedJobMatch to view their profile and start a conversation.</p>
            """
            sms_content = f"MedJobMatch: {seeker.get('full_name')} matched with your {job.get('title')} job! Log in to chat."
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
    return {"id": message_data["id"], "message": "Message sent"}

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
        f"MedJobMatch: Your license has been {status_text}."
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
    return {"message": "MedJobMatch API", "version": "1.0.0"}

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

# Include the router
app.include_router(api_router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
