"""Supabase Auth REST operations. Roles are stored in backend-owned profiles."""
import os

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


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    # Remote validation also checks the auth user still exists; never trust
    # user-editable JWT metadata for role assignment.
    identity = await auth_request('GET', 'user', token=credentials.credentials)
    user = await db.users.find_one({'id': identity['id']}, {'_id': 0, 'password': 0})
    if not user:
        raise HTTPException(status_code=401, detail='Account profile not found')
    if user.get('is_active') is False:
        raise HTTPException(status_code=403, detail='Account is disabled')
    return user
