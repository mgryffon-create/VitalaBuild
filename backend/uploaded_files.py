"""Direct-to-Storage uploads keep 10 MB files out of Vercel request bodies."""
import base64
import hashlib
import hmac
import io
import json
import os
import time
import uuid
from pathlib import PurePath

import anyio
from fastapi import APIRouter, Depends, HTTPException, UploadFile
from pydantic import BaseModel, Field
from starlette.datastructures import Headers
from supabase_auth import get_current_user
from object_storage import signed_url, download_file

router=APIRouter(prefix='/uploads',tags=['uploads'])
MAX_SIZE=10*1024*1024
ALLOWED={'.pdf','.jpg','.jpeg','.png','.webp','.heic','.doc','.docx','.txt'}


class UploadRequest(BaseModel):
    filename: str = Field(min_length=1,max_length=240)
    content_type: str = Field(min_length=1,max_length=150)
    size: int = Field(gt=0,le=MAX_SIZE)


def _key():
    key=os.environ.get('SUPABASE_SECRET_KEY')
    if not key:raise HTTPException(status_code=503,detail='Storage is not configured')
    return key.encode()


def make_ticket(data):
    body=base64.urlsafe_b64encode(json.dumps(data,separators=(',',':')).encode()).decode().rstrip('=')
    return body+'.'+hmac.new(_key(),body.encode(),hashlib.sha256).hexdigest()


def read_ticket(ticket,user_id):
    try:
        body,signature=ticket.split('.')
        if not hmac.compare_digest(signature,hmac.new(_key(),body.encode(),hashlib.sha256).hexdigest()):raise ValueError()
        data=json.loads(base64.urlsafe_b64decode(body+'='*(-len(body)%4)))
        if data['user_id']!=user_id or data['expires_at']<time.time():raise ValueError()
        return data
    except (ValueError,KeyError,TypeError):
        raise HTTPException(status_code=400,detail='Invalid or expired upload ticket')


@router.post('/prepare')
async def prepare_upload(body:UploadRequest,current_user=Depends(get_current_user)):
    ext=PurePath(body.filename).suffix.lower()
    if ext not in ALLOWED:raise HTTPException(status_code=400,detail='Unsupported file type')
    path=f'{current_user["id"]}/{uuid.uuid4()}{ext}'
    url=await anyio.to_thread.run_sync(lambda:signed_url(path,upload=True))
    ticket=make_ticket({'user_id':current_user['id'],'path':path,'filename':body.filename,
                        'content_type':body.content_type,'size':body.size,'expires_at':time.time()+1800})
    return {'upload_url':url,'uploaded_file':ticket}


async def resolve_upload(file,uploaded_file,user):
    if uploaded_file:
        if file is not None:raise HTTPException(status_code=400,detail='Supply one upload source')
        data=read_ticket(uploaded_file,user['id'])
        contents,ct=await anyio.to_thread.run_sync(lambda:download_file(data['path']))
        if len(contents)!=data['size'] or len(contents)>MAX_SIZE:
            raise HTTPException(status_code=400,detail='Uploaded file size mismatch')
        resolved=UploadFile(io.BytesIO(contents),filename=data['filename'],headers=Headers({'content-type':data['content_type']}))
        resolved.storage_path=data['path']
        return resolved
    if file is None:raise HTTPException(status_code=400,detail='File required')
    return file
