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
JWT_SECRET = os.environ.get('JWT_SECRET', 'vitalamatch-secret-key-2024')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# SendGrid Configuration
SENDGRID_API_KEY = os.environ.get('SENDGRID_API_KEY')
SENDGRID_FROM_EMAIL = os.environ.get('SENDGRID_FROM_EMAIL', 'noreply@vitalamatch.com')

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

class BusinessEmailVerification(BaseModel):
    business_email: str

class BusinessEmailVerifyToken(BaseModel):
    token: str

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
    
    # Validate it's a business email domain
    if not is_business_email(business_email):
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
    verification_link = f"{os.environ.get('FRONTEND_URL', 'https://vitalamatch.com')}/verify-business-email?token={token}"
    
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
    
    return {
        "business_email": profile.get("business_email") if profile else None,
        "business_email_verified": profile.get("business_email_verified", False) if profile else False,
        "business_email_verified_at": profile.get("business_email_verified_at") if profile else None,
        "pending_verification": verification.get("business_email") if verification and not verification.get("verified") else None
    }

# ==================== JOB ROUTES ====================

@api_router.post("/jobs", response_model=JobPostingResponse)
async def create_job(job: JobPosting, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "poster":
        raise HTTPException(status_code=403, detail="Only job posters can create jobs")
    
    # Check business email verification
    poster_profile = await db.poster_profiles.find_one({"user_id": current_user["id"]}, {"_id": 0})
    
    if not poster_profile or not poster_profile.get("business_email_verified"):
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
