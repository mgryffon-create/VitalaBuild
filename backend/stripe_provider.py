"""Official Stripe SDK adapter for existing billing API contracts."""
import os
from dataclasses import dataclass
from decimal import Decimal
from types import SimpleNamespace
from urllib.parse import urlparse

import anyio
import stripe
from fastapi import HTTPException


@dataclass
class CheckoutSessionRequest:
    amount: float
    currency: str
    success_url: str
    cancel_url: str
    metadata: dict


CheckoutSessionResponse = CheckoutStatusResponse = SimpleNamespace


class StripeCheckout:
    def __init__(self, api_key, webhook_url=None):
        if not api_key:
            raise HTTPException(status_code=503, detail='Payments are not configured')
        self.key = api_key

    async def create_checkout_session(self, req):
        allowed = os.environ.get('FRONTEND_URL', '').rstrip('/')
        if not allowed:
            raise HTTPException(status_code=503, detail='Payment return URL is not configured')
        for url in (req.success_url, req.cancel_url):
            if urlparse(url).netloc != urlparse(allowed).netloc or urlparse(url).scheme != urlparse(allowed).scheme:
                raise HTTPException(status_code=400, detail='Invalid payment return URL')
        cents = int((Decimal(str(req.amount)) * 100).quantize(Decimal('1')))
        if cents <= 0:
            raise HTTPException(status_code=400, detail='Invalid payment amount')
        subscription = req.metadata.get('type') == 'subscription'
        price = {'currency': req.currency, 'unit_amount': cents,
                 'product_data': {'name': 'VitalaMatch ' + req.metadata.get('type', 'payment')}}
        if subscription:
            price['recurring'] = {'interval': 'month'}
        result = await anyio.to_thread.run_sync(lambda: stripe.checkout.Session.create(
            api_key=self.key, mode='subscription' if subscription else 'payment',
            line_items=[{'price_data': price, 'quantity': 1}],
            success_url=req.success_url, cancel_url=req.cancel_url, metadata=req.metadata,
            **({'subscription_data': {'metadata': req.metadata}} if subscription else {}),
        ))
        return SimpleNamespace(session_id=result.id, url=result.url)

    async def get_checkout_status(self, session_id):
        result = await anyio.to_thread.run_sync(lambda: stripe.checkout.Session.retrieve(session_id, api_key=self.key))
        return SimpleNamespace(payment_status=result.payment_status, status=result.status,
                               amount_total=result.amount_total, metadata=dict(result.metadata or {}),
                               currency=result.currency, subscription=result.get("subscription"))

    async def handle_webhook(self, body, signature):
        secret = os.environ.get('STRIPE_WEBHOOK_SECRET')
        if not secret:
            raise HTTPException(status_code=503, detail='Webhook is not configured')
        try:
            event = stripe.Webhook.construct_event(body, signature, secret)
        except (ValueError, stripe.SignatureVerificationError):
            raise HTTPException(status_code=400, detail='Invalid webhook signature')
        obj = event.data.object
        return SimpleNamespace(event_type=event.type, event_id=event.id,
                               session_id=obj.get('id'), payment_status=obj.get('payment_status'),
                               metadata=dict(obj.get('metadata') or {}), object=dict(obj))
