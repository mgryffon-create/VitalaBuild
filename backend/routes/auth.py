"""Supabase Auth endpoints preserving the frontend API contract."""
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field

from postgres_store import db
from supabase_auth import auth_request, get_current_user, security

router = APIRouter(prefix='/auth', tags=['auth'])


class Registration(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=200)
    role: Literal['seeker', 'poster']


class Login(BaseModel):
    email: EmailStr
    password: str


class Refresh(BaseModel):
    refresh_token: str


async def _session_response(result):
    token = result.get('access_token')
    if not token:
        return {'requires_email_confirmation': True, 'message': 'Check your email to confirm your account, then sign in.'}
    identity = result['user']
    user = await db.users.find_one({'id': identity['id']}, {'_id': 0, 'password': 0})
    if not user:
        raise HTTPException(status_code=409, detail='Account profile is not ready')
    return {'access_token': token, 'refresh_token': result.get('refresh_token'),
            'expires_at': result.get('expires_at'), 'user': user}


@router.post('/register')
async def register(body: Registration):
    # The auth trigger creates the application profile and safe initial role.
    # Never permit an admin role in public registration.
    result = await auth_request('POST', 'signup', body={
        'email': str(body.email), 'password': body.password,
        'data': {'full_name': body.full_name, 'requested_role': body.role},
    })
    return await _session_response(result)


@router.post('/login')
async def login(body: Login):
    result = await auth_request('POST', 'token?grant_type=password', body=body.model_dump(mode='json'))
    return await _session_response(result)


@router.post('/refresh')
async def refresh(body: Refresh):
    return await _session_response(await auth_request('POST', 'token?grant_type=refresh_token', body=body.model_dump()))


@router.post('/logout')
async def logout(credentials=Depends(security)):
    await auth_request('POST', 'logout', token=credentials.credentials)
    return {'message': 'Signed out'}


@router.get('/me')
async def me(user=Depends(get_current_user)):
    return user
