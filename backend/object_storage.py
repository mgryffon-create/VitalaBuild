"""Private Supabase Storage. Download authorization belongs to API routes."""
import mimetypes
import os
from pathlib import PurePosixPath
from urllib.parse import quote

import requests


def _config():
    url = os.environ.get('SUPABASE_URL', '').rstrip('/')
    key = os.environ.get('SUPABASE_SECRET_KEY', '')
    bucket = os.environ.get('SUPABASE_STORAGE_BUCKET', 'documents')
    if not url or not key:
        raise RuntimeError('Supabase Storage is not configured')
    return url, key, bucket


def _path(path):
    if not path or path.startswith('/') or '..' in PurePosixPath(path).parts or '\\' in path:
        raise ValueError('Invalid storage path')
    return quote(path, safe='/')


def init_storage(force=False):
    # Buckets are provisioned by migration, never made public at runtime.
    return _config()[2]


def put_object(path, data, content_type):
    url, key, bucket = _config()
    response = requests.post(
        f'{url}/storage/v1/object/{quote(bucket, safe="")}/{_path(path)}',
        headers={'apikey': key, 'Content-Type': content_type, 'x-upsert': 'false',
                 **({'Authorization': f'Bearer {key}'} if not key.startswith('sb_secret_') else {})},
        data=data, timeout=60,
    )
    response.raise_for_status()
    return {'path': path, 'size': len(data)}


def get_object(path):
    url, key, bucket = _config()
    response = requests.get(
        f'{url}/storage/v1/object/authenticated/{quote(bucket, safe="")}/{_path(path)}',
        headers={'apikey': key, **({'Authorization': f'Bearer {key}'} if not key.startswith('sb_secret_') else {})}, timeout=30,
    )
    response.raise_for_status()
    return response.content, response.headers.get('Content-Type', 'application/octet-stream')


def upload_file(filename, contents, content_type=None, user_id='system'):
    if '/' in filename or '\\' in filename or '..' in filename:
        raise ValueError('Invalid filename')
    path = f'{user_id}/{filename}'
    put_object(path, contents, content_type or mimetypes.guess_type(filename)[0] or 'application/octet-stream')
    return path


def download_file(storage_path):
    return get_object(storage_path)


def signed_url(path, *, upload=False, expires_in=90):
    """Short-lived private download URL or one-use upload URL from Storage."""
    url, key, bucket = _config()
    operation = 'upload/sign' if upload else 'sign'
    response = requests.post(
        f'{url}/storage/v1/object/{operation}/{quote(bucket, safe="")}/{_path(path)}',
        headers={'apikey': key, **({'Authorization': f'Bearer {key}'} if not key.startswith('sb_secret_') else {})},
        json={} if upload else {'expiresIn': expires_in}, timeout=20,
    )
    response.raise_for_status()
    result = response.json()
    signed = result.get('signedURL') or result.get('signedUrl') or result.get('url')
    if not signed:
        raise RuntimeError('Storage did not return a signed URL')
    if signed.startswith('/'):
        signed = url + ('/storage/v1' if not signed.startswith('/storage/v1/') else '') + signed
    from urllib.parse import urlparse
    if urlparse(signed).netloc != urlparse(url).netloc:
        raise RuntimeError('Unexpected storage URL')
    return signed
