"""Billing & Pricing routes for VitalaMatch"""
from fastapi import APIRouter, Depends, Request
from shared import (
    db, get_current_user, log_audit,
    HTTPException, uuid, datetime, timezone, os, BaseModel, Optional, List, Dict, Any,
)
from stripe_provider import (
    StripeCheckout, CheckoutSessionRequest, CheckoutSessionResponse, CheckoutStatusResponse,
)

router = APIRouter(prefix="/billing", tags=["billing"])

STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY")

# ==================== PRICING CONFIG ====================

SUBSCRIPTION_TIERS = {
    "free": {"name": "Free", "price": 0.0, "features": ["job_posting", "limited_candidate_visibility"]},
    "growth": {"name": "Growth", "price": 99.0, "features": ["unlimited_jobs", "full_candidate_access", "basic_filters", "messaging"]},
    "pro": {"name": "Pro", "price": 299.0, "features": ["verified_filtering", "reference_visibility", "priority_matching", "autofill_access"]},
    "enterprise": {"name": "Enterprise", "price": 999.0, "features": ["full_automation", "compliance_integrations", "multi_location", "api_access"]},
}

HIRE_FEES = {
    "CNA": 500.0,
    "LPN": 1500.0,
    "RN": 3500.0,
    "DEFAULT": 1000.0,
}

HIRE_DISCOUNTS = {
    "free": 0.0,
    "growth": 0.05,
    "pro": 0.10,
    "enterprise": 0.20,
}

ADDONS = {
    "boosted_job": {"name": "Boosted Job Posting", "price": 50.0, "description": "7-day visibility boost for your job posting"},
    "compliance_bundle": {"name": "Compliance Bundle", "price": 299.0, "description": "Background check + drug screening + fingerprinting per candidate"},
}

# ==================== MODELS ====================

class SubscriptionUpgradeRequest(BaseModel):
    tier: str
    origin_url: str

class AddonPurchaseRequest(BaseModel):
    addon_type: str
    origin_url: str
    job_id: Optional[str] = None
    candidate_id: Optional[str] = None

class HireConfirmRequest(BaseModel):
    candidate_id: str
    job_id: str
    role_type: Optional[str] = None
    origin_url: Optional[str] = None


def _get_stripe(request: Request):
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    return StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)


# ==================== PRICING INFO ====================

@router.get("/pricing")
async def get_pricing():
    """Get all pricing information (public)"""
    return {
        "tiers": SUBSCRIPTION_TIERS,
        "hire_fees": HIRE_FEES,
        "hire_discounts": HIRE_DISCOUNTS,
        "addons": ADDONS,
    }

@router.get("/my-plan")
async def get_my_plan(current_user: dict = Depends(get_current_user)):
    """Get current employer's billing info"""
    if current_user["role"] != "poster":
        raise HTTPException(status_code=403, detail="Only employers have billing")
    billing = await db.employer_billing.find_one(
        {"employer_id": current_user["id"]}, {"_id": 0}
    )
    if not billing:
        billing = {
            "employer_id": current_user["id"],
            "subscription_tier": "free",
            "billing_status": "active",
            "stripe_customer_id": None,
            "usage": {"hires": 0, "jobs_posted": 0, "boosts_used": 0, "addons_purchased": 0},
        }
        await db.employer_billing.insert_one({**billing, "_id": None} if False else billing)
    tier_info = SUBSCRIPTION_TIERS.get(billing.get("subscription_tier", "free"), SUBSCRIPTION_TIERS["free"])
    return {**billing, "tier_info": tier_info}


@router.get("/invoices")
async def get_invoices(current_user: dict = Depends(get_current_user)):
    """Get billing history for employer"""
    if current_user["role"] != "poster":
        raise HTTPException(status_code=403, detail="Only employers have billing")
    txns = await db.payment_transactions.find(
        {"user_id": current_user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return txns


# ==================== SUBSCRIPTIONS ====================

@router.post("/subscribe")
async def create_subscription(req: SubscriptionUpgradeRequest, request: Request, current_user: dict = Depends(get_current_user)):
    """Start or upgrade subscription via Stripe Checkout"""
    if current_user["role"] != "poster":
        raise HTTPException(status_code=403, detail="Only employers can subscribe")
    if req.tier not in SUBSCRIPTION_TIERS or req.tier == "free":
        raise HTTPException(status_code=400, detail="Invalid tier")

    tier = SUBSCRIPTION_TIERS[req.tier]
    amount = tier["price"]
    stripe = _get_stripe(request)

    success_url = f"{req.origin_url}/poster/billing?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{req.origin_url}/poster/billing"

    checkout_req = CheckoutSessionRequest(
        amount=float(amount),
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "type": "subscription",
            "tier": req.tier,
            "employer_id": current_user["id"],
            "employer_email": current_user["email"],
        },
    )
    session = await stripe.create_checkout_session(checkout_req)

    # Create pending transaction
    txn = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "session_id": session.session_id,
        "type": "subscription",
        "tier": req.tier,
        "amount": amount,
        "currency": "usd",
        "payment_status": "pending",
        "metadata": {"tier": req.tier},
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.payment_transactions.insert_one(txn)
    await log_audit(db, current_user["id"], "subscription_initiated", "billing", txn["id"],
                    details={"tier": req.tier, "amount": amount})

    return {"checkout_url": session.url, "session_id": session.session_id}


# ==================== PAY-PER-HIRE ====================

@router.post("/hire-charge")
async def create_hire_charge(req: HireConfirmRequest, request: Request, current_user: dict = Depends(get_current_user)):
    """Create a hire charge — auto for subscribed, invoice for free"""
    if current_user["role"] != "poster":
        raise HTTPException(status_code=403, detail="Only employers can be charged")

    # Determine fee
    role = (req.role_type or "DEFAULT").upper()
    base_fee = HIRE_FEES.get(role, HIRE_FEES["DEFAULT"])

    # Get employer tier for discount
    billing = await db.employer_billing.find_one({"employer_id": current_user["id"]}, {"_id": 0})
    tier = billing.get("subscription_tier", "free") if billing else "free"
    discount = HIRE_DISCOUNTS.get(tier, 0.0)
    final_fee = round(base_fee * (1 - discount), 2)

    if tier == "free":
        # Free tier: create pending invoice (employer must confirm)
        invoice = {
            "id": str(uuid.uuid4()),
            "user_id": current_user["id"],
            "type": "hire_fee",
            "amount": final_fee,
            "currency": "usd",
            "payment_status": "invoice_pending",
            "candidate_id": req.candidate_id,
            "job_id": req.job_id,
            "role_type": role,
            "discount_applied": discount,
            "metadata": {"role_type": role, "base_fee": base_fee, "discount": discount, "tier": tier},
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.payment_transactions.insert_one(invoice)
        return {"status": "invoice_created", "invoice_id": invoice["id"], "amount": final_fee, "requires_payment": True}
    else:
        # Subscribed tier: automatic charge via Stripe Checkout
        if not req.origin_url:
            raise HTTPException(status_code=400, detail="origin_url required for automatic charge")
        stripe = _get_stripe(request)
        success_url = f"{req.origin_url}/poster/billing?session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{req.origin_url}/poster/candidates"

        checkout_req = CheckoutSessionRequest(
            amount=float(final_fee),
            currency="usd",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "type": "hire_fee",
                "employer_id": current_user["id"],
                "candidate_id": req.candidate_id,
                "job_id": req.job_id,
                "role_type": role,
            },
        )
        session = await stripe.create_checkout_session(checkout_req)

        txn = {
            "id": str(uuid.uuid4()),
            "user_id": current_user["id"],
            "session_id": session.session_id,
            "type": "hire_fee",
            "amount": final_fee,
            "currency": "usd",
            "payment_status": "pending",
            "candidate_id": req.candidate_id,
            "job_id": req.job_id,
            "role_type": role,
            "discount_applied": discount,
            "metadata": {"role_type": role, "base_fee": base_fee, "discount": discount, "tier": tier},
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.payment_transactions.insert_one(txn)
        return {"status": "checkout_created", "checkout_url": session.url, "session_id": session.session_id, "amount": final_fee}


@router.post("/pay-invoice/{invoice_id}")
async def pay_invoice(invoice_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    """Pay a pending hire invoice via Stripe Checkout"""
    if current_user["role"] != "poster":
        raise HTTPException(status_code=403, detail="Only employers can pay invoices")
    txn = await db.payment_transactions.find_one(
        {"id": invoice_id, "user_id": current_user["id"], "payment_status": "invoice_pending"}, {"_id": 0}
    )
    if not txn:
        raise HTTPException(status_code=404, detail="Invoice not found")

    stripe = _get_stripe(request)
    origin = os.environ.get("FRONTEND_URL", "").rstrip("/")
    success_url = f"{origin}/poster/billing?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/poster/billing"

    checkout_req = CheckoutSessionRequest(
        amount=float(txn["amount"]),
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "type": "invoice_payment",
            "invoice_id": invoice_id,
            "employer_id": current_user["id"],
        },
    )
    session = await stripe.create_checkout_session(checkout_req)
    await db.payment_transactions.update_one(
        {"id": invoice_id},
        {"$set": {"session_id": session.session_id, "payment_status": "pending"}}
    )
    return {"checkout_url": session.url, "session_id": session.session_id}


# ==================== ADD-ONS ====================

@router.post("/addon")
async def purchase_addon(req: AddonPurchaseRequest, request: Request, current_user: dict = Depends(get_current_user)):
    """Purchase an add-on via Stripe Checkout"""
    if current_user["role"] != "poster":
        raise HTTPException(status_code=403, detail="Only employers can purchase add-ons")
    if req.addon_type not in ADDONS:
        raise HTTPException(status_code=400, detail=f"Invalid addon. Choose from: {list(ADDONS.keys())}")

    addon = ADDONS[req.addon_type]
    stripe = _get_stripe(request)

    success_url = f"{req.origin_url}/poster/billing?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{req.origin_url}/poster/billing"

    checkout_req = CheckoutSessionRequest(
        amount=float(addon["price"]),
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "type": "addon",
            "addon_type": req.addon_type,
            "employer_id": current_user["id"],
            "job_id": req.job_id or "",
            "candidate_id": req.candidate_id or "",
        },
    )
    session = await stripe.create_checkout_session(checkout_req)

    txn = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "session_id": session.session_id,
        "type": "addon",
        "addon_type": req.addon_type,
        "amount": addon["price"],
        "currency": "usd",
        "payment_status": "pending",
        "job_id": req.job_id,
        "candidate_id": req.candidate_id,
        "metadata": {"addon_type": req.addon_type},
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.payment_transactions.insert_one(txn)
    return {"checkout_url": session.url, "session_id": session.session_id}


# ==================== CHECKOUT STATUS ====================

@router.get("/checkout-status/{session_id}")
async def check_status(session_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    """Poll Stripe checkout status and update transaction"""
    stripe = _get_stripe(request)

    txn = await db.payment_transactions.find_one({"session_id": session_id, "user_id": current_user["id"]}, {"_id": 0})
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    status = await stripe.get_checkout_status(session_id)
    from billing_service import settle_checkout
    await settle_checkout(session_id, vars(status), user_id=current_user["id"])
    return {"status": status.status, "payment_status": status.payment_status, "amount": status.amount_total}


# ==================== USAGE ====================

@router.get("/usage")
async def get_usage(current_user: dict = Depends(get_current_user)):
    """Get usage stats for employer"""
    if current_user["role"] != "poster":
        raise HTTPException(status_code=403, detail="Only employers have usage data")
    billing = await db.employer_billing.find_one({"employer_id": current_user["id"]}, {"_id": 0})
    usage = billing.get("usage", {}) if billing else {}
    # Enrich with actual counts
    job_count = await db.jobs.count_documents({"employer_id": current_user["id"]})
    return {
        "hires": usage.get("hires", 0),
        "jobs_posted": job_count,
        "boosts_used": usage.get("boosts_used", 0),
        "addons_purchased": usage.get("addons_purchased", 0),
    }
