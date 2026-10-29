"""
Object Storage utility — wraps Emergent Object Storage API.
All file upload/download goes through this module.
"""
import os
import logging
import requests

logger = logging.getLogger(__name__)

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "vitalamatch"

_storage_key = None


def init_storage(force: bool = False):
    """Initialize storage session. Call once at startup."""
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    if not EMERGENT_KEY:
        logger.warning("EMERGENT_LLM_KEY not set — object storage unavailable")
        return None
    try:
        resp = requests.post(
            f"{STORAGE_URL}/init",
            json={"emergent_key": EMERGENT_KEY},
            timeout=30,
        )
        resp.raise_for_status()
        _storage_key = resp.json()["storage_key"]
        logger.info("Object storage initialized")
        return _storage_key
    except Exception as e:
        logger.error(f"Object storage init failed: {e}")
        return None


def put_object(path: str, data: bytes, content_type: str) -> dict:
    """Upload bytes to object storage. Returns {"path": ..., "size": ...}."""
    key = init_storage()
    if not key:
        raise RuntimeError("Object storage not initialized")
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120,
    )
    if resp.status_code == 404:
        # Key may have expired — re-init once
        key = init_storage(force=True)
        if not key:
            raise RuntimeError("Object storage re-init failed")
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data,
            timeout=120,
        )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str) -> tuple:
    """Download from object storage. Returns (content_bytes, content_type)."""
    key = init_storage()
    if not key:
        raise RuntimeError("Object storage not initialized")
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key},
        timeout=60,
    )
    if resp.status_code == 404:
        key = init_storage(force=True)
        if not key:
            raise RuntimeError("Object storage re-init failed")
        resp = requests.get(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key},
            timeout=60,
        )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


MIME_TYPES = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
    ".gif": "image/gif", ".webp": "image/webp", ".heic": "image/heic",
    ".pdf": "application/pdf", ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".txt": "text/plain",
}


def upload_file(filename: str, contents: bytes, content_type: str = None, user_id: str = "system") -> str:
    """Upload a file and return its storage path.
    
    Args:
        filename: Safe filename (e.g. "{uuid}.pdf")
        contents: File bytes
        content_type: MIME type (auto-detected from extension if None)
        user_id: Uploader ID for path namespacing
    
    Returns:
        The storage_path string to store in the database.
    """
    import os as _os
    ext = _os.path.splitext(filename)[1].lower()
    if not content_type:
        content_type = MIME_TYPES.get(ext, "application/octet-stream")
    
    storage_path = f"{APP_NAME}/uploads/{user_id}/{filename}"
    put_object(storage_path, contents, content_type)
    return storage_path


def download_file(storage_path: str) -> tuple:
    """Download a file by its storage path. Returns (bytes, content_type)."""
    return get_object(storage_path)
