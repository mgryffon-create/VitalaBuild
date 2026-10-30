"""Supabase Auth REST operations. Roles are stored in backend-owned profiles."""
import os
import logging

import psycopg

import httpx
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from postgres_store import db

security = HTTPBearer()


def config():
    url = os.environ.get('SUPABASE_URL', '').rstrip('/')
    key = os.environ.get('SUPABASE_PUBLISHABLE_KEY', '')
    if not url or not key:
        raise HTTPException(status_code=503, detail='Authentication is not configured')
    return url, key


async def auth_request(method, path, *, body=None, token=None):
    url, key = config()
    headers = {'apikey': key}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.request(method, f'{url}/auth/v1/{path}', headers=headers, json=body)
    if response.status_code >= 400:
        code = 401 if response.status_code in (400, 401, 403, 422) else 503
        raise HTTPException(status_code=code, detail='Authentication failed. Check your credentials and email verification.')
    return response.json() if response.content else {}


async def load_app_user(user_id):
    try:
        return await db.users.find_one({'id': user_id}, {'_id': 0, 'password': 0})
    except (psycopg.Error, RuntimeError, ValueError) as exc:
        # Never log exception text: connection errors can include credentials.
        state = getattr(exc, 'sqlstate', None)
        code = 'DB_QUERY' if state and not state.startswith(('08', '28')) else 'DB_CONNECTION'
        message = str(exc).lower()
        if (state or '').startswith('28') or 'password authentication failed' in message or 'wrong password' in message:
            code = 'DB_CREDENTIALS'
        elif 'tenant or user not found' in message:
            code = 'DB_POOLER_USER'
        elif any(part in message for part in ('could not translate host', 'name or service not known', 'nodename nor servname')):
            code = 'DB_HOST'
        elif any(part in message for part in ('invalid connection option', 'missing \"=\"', 'invalid percent-encoded', 'invalid uri')):
            code = 'DB_URL'
        elif 'network is unreachable' in message:
            code = 'DB_NETWORK'
        elif 'timeout' in message or 'timed out' in message:
            code = 'DB_TIMEOUT'
        logging.getLogger(__name__).error(
            'auth_profile_lookup_failed code=%s exception=%s sqlstate=%s',
            code, type(exc).__name__, state or 'none',
        )
        raise HTTPException(
            status_code=503,
            detail=f'Sign-in was verified, but the application database is unavailable. Please try again shortly. ({code})',
        ) from None


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    # Remote validation also checks the auth user still exists; never trust
    # user-editable JWT metadata for role assignment.
    identity = await auth_request('GET', 'user', token=credentials.credentials)
    user = await load_app_user(identity['id'])
    if not user:
        raise HTTPException(status_code=401, detail='Account profile not found')
    if user.get('is_active') is False:
        raise HTTPException(status_code=403, detail='Account is disabled')
    return user
