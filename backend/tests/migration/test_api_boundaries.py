import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi import HTTPException
from server import app
from supabase_auth import get_current_user
from routes import auth, vault, billing
import object_storage
import stripe_provider


def run(coro):
    return asyncio.run(coro)


def request(method, path, **kwargs):
    async def call():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as c:
            return await c.request(method, path, **kwargs)
    return run(call())


def test_health_and_unauthenticated_boundary():
    assert request('GET', '/api/health').status_code == 200
    assert request('GET', '/api/profile/seeker').status_code in (401, 403)


def test_cron_requires_secret(monkeypatch):
    monkeypatch.delenv('CRON_SECRET', raising=False)
    assert request('GET', '/api/cron/document-expiration').status_code == 401


def test_register_rejects_admin_before_external_call(monkeypatch):
    mocked = AsyncMock()
    monkeypatch.setattr(auth, 'auth_request', mocked)
    response = request('POST', '/api/auth/register', json={'email':'a@example.com','password':'longpassword','full_name':'A','role':'admin'})
    assert response.status_code == 422
    mocked.assert_not_called()


def test_signup_email_confirmation(monkeypatch):
    monkeypatch.setattr(auth, 'auth_request', AsyncMock(return_value={'user':{'id':'u'}}))
    response = request('POST', '/api/auth/register', json={'email':'a@example.com','password':'longpassword','full_name':'A','role':'seeker'})
    assert response.status_code == 200
    assert response.json()['requires_email_confirmation'] is True
    assert 'access_token' not in response.json()


def test_vault_storage_without_local_file(monkeypatch):
    doc = {'id':'doc','candidate_id':'owner','storage_path':'owner/doc.pdf','content_type':'application/pdf'}
    monkeypatch.setattr(vault, 'db', SimpleNamespace(vault_documents=SimpleNamespace(find_one=AsyncMock(return_value=doc))))
    monkeypatch.setattr(vault, 'log_audit', AsyncMock())
    monkeypatch.setattr(vault, 'signed_url', lambda path: 'https://project.supabase.co/storage/v1/object/sign/documents/owner/doc.pdf?token=shortlived')
    app.dependency_overrides[get_current_user] = lambda: {'id':'owner','role':'seeker'}
    try:
        response=request('GET','/api/vault/files/doc.pdf')
        assert response.status_code==302
        assert response.headers['location'].startswith('https://project.supabase.co/')
    finally:
        app.dependency_overrides.clear()


def test_other_seeker_cannot_read_vault(monkeypatch):
    doc={'id':'doc','candidate_id':'owner','storage_path':'owner/doc.pdf'}
    monkeypatch.setattr(vault, 'db', SimpleNamespace(vault_documents=SimpleNamespace(find_one=AsyncMock(return_value=doc))))
    monkeypatch.setattr(vault, 'log_audit', AsyncMock())
    app.dependency_overrides[get_current_user] = lambda: {'id':'outsider','role':'seeker'}
    try:
        assert request('GET','/api/vault/files/doc.pdf').status_code==403
    finally:
        app.dependency_overrides.clear()


def test_payment_status_scoped_to_owner(monkeypatch):
    monkeypatch.setattr(billing,'_get_stripe',lambda req: SimpleNamespace())
    find=AsyncMock(return_value=None)
    monkeypatch.setattr(billing,'db',SimpleNamespace(payment_transactions=SimpleNamespace(find_one=find)))
    app.dependency_overrides[get_current_user] = lambda: {'id':'outsider','role':'poster'}
    try:
        assert request('GET','/api/billing/checkout-status/cs_123').status_code==404
        assert find.call_args.args[0]['user_id']=='outsider'
    finally:
        app.dependency_overrides.clear()


def test_storage_private_request_and_no_upsert(monkeypatch):
    monkeypatch.setenv('SUPABASE_URL','https://project.supabase.co')
    monkeypatch.setenv('SUPABASE_SECRET_KEY','sb_secret_test')
    captured={}
    def post(url,**kw):
        captured.update(url=url,**kw)
        return SimpleNamespace(raise_for_status=lambda:None)
    monkeypatch.setattr(object_storage.requests,'post',post)
    assert object_storage.upload_file('doc.pdf',b'pdf','application/pdf','owner')=='owner/doc.pdf'
    assert captured['url'].endswith('/storage/v1/object/documents/owner/doc.pdf')
    assert captured['headers']['x-upsert']=='false'
    assert 'sb_secret_test' not in captured['url']
    with pytest.raises(ValueError):
        object_storage.upload_file('../secret',b'x',user_id='owner')


def test_stripe_invalid_signature_rejected(monkeypatch):
    monkeypatch.setenv('STRIPE_WEBHOOK_SECRET','whsec_test')
    adapter=stripe_provider.StripeCheckout('sk_test_fake')
    with pytest.raises(HTTPException) as error:
        run(adapter.handle_webhook(b'{}','invalid'))
    assert error.value.status_code==400


def test_stripe_blocks_external_return_url(monkeypatch):
    monkeypatch.setenv('FRONTEND_URL','https://vitala.example')
    adapter=stripe_provider.StripeCheckout('sk_test_fake')
    req=stripe_provider.CheckoutSessionRequest(10,'usd','https://evil.example/','https://vitala.example/',{})
    with pytest.raises(HTTPException) as error:
        run(adapter.create_checkout_session(req))
    assert error.value.status_code==400


def test_direct_upload_ticket_cannot_change_owner_or_path(monkeypatch):
    from uploaded_files import make_ticket, read_ticket
    import time
    monkeypatch.setenv('SUPABASE_SECRET_KEY','sb_secret_test')
    ticket=make_ticket({'user_id':'owner','path':'owner/file.pdf','filename':'file.pdf','size':3,'content_type':'application/pdf','expires_at':time.time()+60})
    assert read_ticket(ticket,'owner')['path']=='owner/file.pdf'
    with pytest.raises(HTTPException):
        read_ticket(ticket,'outsider')
    with pytest.raises(HTTPException):
        read_ticket(ticket+'x','owner')
    expired=make_ticket({'user_id':'owner','expires_at':time.time()-1})
    with pytest.raises(HTTPException):
        read_ticket(expired,'owner')


def test_resolve_large_direct_upload(monkeypatch):
    import uploaded_files,time
    monkeypatch.setenv('SUPABASE_SECRET_KEY','sb_secret_test')
    contents=b'X'*(5*1024*1024)
    ticket=uploaded_files.make_ticket({'user_id':'owner','path':'owner/file.pdf','filename':'file.pdf','size':len(contents),'content_type':'application/pdf','expires_at':time.time()+60})
    monkeypatch.setattr(uploaded_files,'download_file',lambda path:(contents,'application/pdf'))
    resolved=run(uploaded_files.resolve_upload(None,ticket,{'id':'owner'}))
    assert resolved.storage_path=='owner/file.pdf'
    assert len(run(resolved.read()))==len(contents)


def test_public_admin_seed_removed():
    assert request('POST','/api/admin/seed').status_code==404
