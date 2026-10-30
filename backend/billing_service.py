"""Atomic and idempotent application of verified Stripe payment events."""
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from psycopg.types.json import Jsonb
from postgres_store import connection, apply_update


async def _apply_paid(conn, txn_id, txn, metadata, subscription_id=None):
    if txn.get('payment_status') == 'paid':
        return
    employer_id = txn['user_id']
    await conn.execute('SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))', ('billing:' + employer_id,))
    cur = await conn.execute("SELECT id, data FROM app_private.employer_billing WHERE data->>'employer_id' = %s FOR UPDATE", (employer_id,))
    row = await cur.fetchone()
    billing_id, billing = row if row else (str(uuid.uuid4()), {'employer_id': employer_id})
    kind = txn['type']
    if kind == 'subscription':
        billing.update(subscription_tier=txn['tier'], billing_status='active', stripe_subscription_id=subscription_id)
    elif kind == 'hire_fee':
        billing = apply_update(billing, {'$inc': {'usage.hires': 1}})
    elif kind == 'addon':
        key = 'usage.boosts_used' if txn.get('addon_type') == 'boosted_job' else 'usage.addons_purchased'
        billing = apply_update(billing, {'$inc': {key: 1}})
    else:
        raise ValueError('Unknown payment transaction type')
    if row:
        await conn.execute('UPDATE app_private.employer_billing SET data = %s WHERE id = %s', (Jsonb(billing), billing_id))
    else:
        await conn.execute('INSERT INTO app_private.employer_billing(id,data) VALUES (%s,%s)', (billing_id, Jsonb(billing)))
    txn.update(payment_status='paid', paid_at=datetime.now(timezone.utc).isoformat())
    await conn.execute('UPDATE app_private.payment_transactions SET data = %s WHERE id = %s', (Jsonb(txn), txn_id))


async def settle_checkout(session_id, session, *, user_id=None):
    """Session comes only from Stripe SDK or a signature-verified webhook."""
    async with connection() as conn:
        cur = await conn.execute("SELECT id, data FROM app_private.payment_transactions WHERE data->>'session_id' = %s FOR UPDATE", (session_id,))
        row = await cur.fetchone()
        if not row or (user_id is not None and row[1]['user_id'] != user_id):
            raise HTTPException(status_code=404, detail='Transaction not found')
        txn_id, txn = row
        if session.get('payment_status') == 'paid':
            # Check the settled amount and server-stored owner/type before
            # granting access; never accept a browser claim of payment.
            from decimal import Decimal
            expected = int(Decimal(str(txn['amount'])) * 100)
            if session.get('amount_total') != expected or session.get('currency', 'usd').lower() != txn.get('currency', 'usd'):
                raise HTTPException(status_code=409, detail='Payment amount mismatch')
            await _apply_paid(conn, txn_id, txn, session.get('metadata') or {}, session.get('subscription'))
        elif session.get('status') == 'expired' and txn.get('payment_status') != 'paid':
            txn['payment_status'] = 'expired'
            await conn.execute('UPDATE app_private.payment_transactions SET data = %s WHERE id = %s', (Jsonb(txn), txn_id))
        return txn


async def subscription_event(event_type, obj):
    """Reflect renewal failures, cancellations and subscription status changes."""
    subscription_id = obj.get('id') if event_type.startswith('customer.subscription.') else (
        obj.get('subscription') or obj.get('parent', {}).get('subscription_details', {}).get('subscription'))
    if not subscription_id:
        return
    async with connection() as conn:
        cur = await conn.execute("SELECT id,data FROM app_private.employer_billing WHERE data->>'stripe_subscription_id' = %s FOR UPDATE", (subscription_id,))
        row = await cur.fetchone()
        if not row:
            return
        row_id, billing = row
        if event_type == 'customer.subscription.deleted':
            billing.update(subscription_tier='free', billing_status='canceled')
        elif event_type == 'invoice.payment_failed':
            billing['billing_status'] = 'past_due'
        elif event_type == 'invoice.paid':
            billing['billing_status'] = 'active'
        elif event_type == 'customer.subscription.updated':
            billing['billing_status'] = obj.get('status', 'unknown')
            if billing['billing_status'] in ('canceled', 'unpaid', 'incomplete_expired'):
                billing['subscription_tier'] = 'free'
        await conn.execute('UPDATE app_private.employer_billing SET data = %s WHERE id = %s', (Jsonb(billing), row_id))
