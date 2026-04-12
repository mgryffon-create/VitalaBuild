"""Auth routes: register, login, me"""
from fastapi import APIRouter, Depends
from shared import (
    db, get_current_user, hash_password, verify_password, create_token,
    log_audit, UserRegister, UserLogin, UserResponse, TokenResponse,
    HTTPException, uuid, datetime, timezone,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
async def register(user_data: UserRegister):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id, "email": user_data.email,
        "password": hash_password(user_data.password),
        "role": user_data.role, "full_name": user_data.full_name,
        "profile_complete": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)
    if user_data.role == "seeker":
        await db.seeker_profiles.insert_one({"user_id": user_id, "created_at": datetime.now(timezone.utc).isoformat()})
    else:
        await db.poster_profiles.insert_one({"user_id": user_id, "created_at": datetime.now(timezone.utc).isoformat()})
    await db.notification_preferences.insert_one({
        "user_id": user_id, "email_enabled": True, "sms_enabled": False,
        "frequency": "immediate", "match_notifications": True,
        "message_notifications": True, "document_reminders": True,
    })
    token = create_token(user_id, user_data.role)
    await log_audit(db, user_id, "register", "user", user_id, details={"role": user_data.role})
    return TokenResponse(access_token=token, user=UserResponse(
        id=user_id, email=user_data.email, role=user_data.role,
        full_name=user_data.full_name, profile_complete=False, created_at=user["created_at"],
    ))


@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password"]):
        await log_audit(db, credentials.email, "login_failed", "auth", details={"email": credentials.email})
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(user["id"], user["role"])
    await log_audit(db, user["id"], "login", "auth", details={"role": user["role"]})
    return TokenResponse(access_token=token, user=UserResponse(
        id=user["id"], email=user["email"], role=user["role"],
        full_name=user["full_name"], profile_complete=user.get("profile_complete", False),
        created_at=user["created_at"],
    ))


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=current_user["id"], email=current_user["email"],
        role=current_user["role"], full_name=current_user["full_name"],
        profile_complete=current_user.get("profile_complete", False),
        created_at=current_user["created_at"],
    )
