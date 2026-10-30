import asyncio
import importlib.util
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import AsyncMock

# Supply the HTTP exception boundary when running the pure service tests without
# installing the full web application in this environment.
class HttpError(Exception):
    def __init__(self, status_code, detail): self.status_code = status_code; self.detail = detail
try:
    import fastapi
except ImportError:
    sys.modules['fastapi'] = types.SimpleNamespace(HTTPException=HttpError)
from match_readiness import match_readiness, refresh_match, require_match_ready, uploaded_current

class Cursor:
    def __init__(self, rows): self.rows = rows
    async def to_list(self, limit): return self.rows[:limit]
class Vault:
    def __init__(self, rows): self.rows = rows
    def find(self, query, projection): return Cursor(self.rows)
def database(docs, role='RN', certifications=None):
    return types.SimpleNamespace(
        vault_documents=Vault(docs),
        seeker_profiles=types.SimpleNamespace(find_one=AsyncMock(return_value={'normalized_role_category':role} if role else {})),
        jobs=types.SimpleNamespace(find_one=AsyncMock(return_value={'primary_role_category':'RN','certifications_required':certifications or []})),
        matches=types.SimpleNamespace(update_one=AsyncMock()))
def doc(category, subtype, **kwargs): return dict(category=category, subtype=subtype, storage_path='private/file', **kwargs)
JOB={'primary_role_category':'RN'}

class ReadinessTests(unittest.TestCase):
    def test_text_credentials_and_resume_do_not_unlock_match(self):
        db=database([{'category':'license','subtype':'RN License'}, doc('resume','resume')])
        result=asyncio.run(match_readiness(db,'seeker',JOB))
        self.assertFalse(result['ready']); self.assertEqual(len(result['missing_documents']),2)
    def test_acls_only_when_job_requires_it(self):
        db=database([doc('license','RN License'),doc('certification','BLS')])
        self.assertTrue(asyncio.run(match_readiness(db,'seeker',JOB))['ready'])
        job={**JOB,'certifications_required':['ACLS']}
        self.assertEqual(asyncio.run(match_readiness(db,'seeker',job))['missing_documents'],['ACLS certification'])
    def test_expired_rejected_and_replaced_uploads_do_not_count(self):
        for attrs in ({'expiration_date':'2000-01-01'}, {'verification_status':'rejected'}, {'status':'replaced'}, {'expiration_date':'invalid'}):
            self.assertFalse(uploaded_current(doc('certification','BLS',**attrs)))
    def test_missing_or_incompatible_role_stays_pending(self):
        for role in (None,'CNA'):
            db=database([doc('license','RN License'),doc('certification','BLS')],role=role)
            self.assertFalse(asyncio.run(match_readiness(db,'seeker',JOB))['ready'])
    def test_pending_match_unlocks_when_uploads_are_added(self):
        db=database([]); match={'id':'match','seeker_id':'seeker','job_id':'job','status':'active'}
        self.assertEqual(asyncio.run(refresh_match(db,match))['status'],'pending_documents')
        db.vault_documents.rows=[doc('license','RN License'),doc('certification','BLS')]
        ready=asyncio.run(refresh_match(db,{**match,'status':'pending_documents'}))
        self.assertEqual(ready['status'],'active')
    def test_message_or_offer_boundary_rejects_missing_uploads(self):
        db=database([])
        with self.assertRaises(Exception) as caught:
            asyncio.run(require_match_ready(db,{'id':'match','seeker_id':'seeker','job_id':'job','status':'pending_documents'}))
        self.assertEqual(caught.exception.status_code,409)

if __name__=='__main__': unittest.main()
