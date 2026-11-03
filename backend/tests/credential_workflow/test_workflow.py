"""Offer consent and portable credential verification policy regression tests."""
import ast
import copy
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import AsyncMock
from datetime import datetime, timezone
from pydantic import BaseModel, Field
from credential_policy import *
from document_screening import LICENSE_KINDS

class HttpError(Exception):
    def __init__(self,status_code,detail): self.status_code=status_code; self.detail=detail
try: import fastapi
except ImportError: sys.modules['fastapi']=types.SimpleNamespace(HTTPException=HttpError)
from match_readiness import match_readiness

class Cursor:
    def __init__(self,rows): self.rows=rows
    async def to_list(self,limit): return copy.deepcopy(self.rows[:limit])
class Collection:
    def __init__(self,*rows): self.rows=list(rows)
    def matches(self,row,query):
        return all(row.get(k) in v['$in'] if isinstance(v,dict) and '$in' in v else row.get(k)==v for k,v in query.items())
    def find(self,query,projection=None): return Cursor([r for r in self.rows if self.matches(r,query)])
    async def find_one(self,query,projection=None): return next((copy.deepcopy(r) for r in self.rows if self.matches(r,query)),None)
    async def update_one(self,query,update,**kwargs):
        for row in self.rows:
            if self.matches(row,query):
                row.update(copy.deepcopy(update.get('$set',{})))
                for k,v in update.get('$push',{}).items(): row.setdefault(k,[]).append(copy.deepcopy(v))
                return types.SimpleNamespace(matched_count=1)
        return types.SimpleNamespace(matched_count=0)

SEEKER={'id':'seeker','role':'seeker','full_name':'Jane Doe'}
EMPLOYER={'id':'employer','role':'poster','full_name':'Employer Reviewer'}
JOB={'id':'job','primary_role_category':'RN'}
OFFER={'id':'offer','match_id':'match','job_id':'job','seeker_id':'seeker','poster_id':'employer','status':'pending','expiration_date':'2099-01-01'}

def document(subtype='RN License',category='license',id='license'):
    return dict(id=id,candidate_id='seeker',category=category,subtype=subtype,storage_path='private/'+id,file_name=id+'.pdf',file_url='/api/vault/files/'+id+'.pdf',expiration_date='2099-01-01',verification_status='needs_review')

def attest(doc):
    return {**doc,'verification_status':'unverified','screening_status':'submitted_unverified','seeker_submission':{'document_revision':revision(doc),'submitted_by':'seeker'}}

def environment(docs=None,offer=None):
    db=types.SimpleNamespace(vault_documents=Collection(*(docs or [document()])),employment_offers=Collection(offer or copy.deepcopy(OFFER)),jobs=Collection(JOB),matches=Collection({'id':'match','job_id':'job','seeker_id':'seeker','poster_id':'employer'}),poster_profiles=Collection({'user_id':'employer','company_name':'Example Clinic'}),seeker_profiles=Collection({'user_id':'seeker','normalized_role_category':'RN'}))
    ns={**globals(),'db':db,'Depends':lambda fn:None,'get_current_user':lambda:None,'HTTPException':HttpError,'log_audit':AsyncMock(),'download_file':lambda path:(b'bytes','application/pdf'),'screen_file':lambda *args:{'screening_status':'needs_review','verification_notes':'Image needs review'},'uuid':__import__('uuid'),'PurePath':__import__('pathlib').PurePath}
    async def run_sync(fn): return fn()
    ns['anyio']=types.SimpleNamespace(to_thread=types.SimpleNamespace(run_sync=run_sync))
    tree=ast.parse(Path('backend/routes/credential_workflow.py').read_text())
    nodes=[]
    for node in tree.body:
        if isinstance(node,(ast.ClassDef,ast.FunctionDef,ast.AsyncFunctionDef)):
            if hasattr(node,'decorator_list'): node.decorator_list=[]
            nodes.append(node)
    exec(compile(ast.Module(body=nodes,type_ignores=[]),'credential_routes','exec'),ns)
    return db,ns

class WorkflowTests(unittest.IsolatedAsyncioTestCase):
    async def test_corrected_upload_stays_unverified_and_allows_matching(self):
        db,ns=environment([document(),attest(document('BLS','certification','bls'))])
        body=ns['Submission'](subtype='RN License',expiration_date='2099-01-01',issuing_authority='Board of Nursing',document_number='RN12345',confirmed=True)
        await ns['submit_unverified']('license',body,SEEKER)
        saved=db.vault_documents.rows[0]
        self.assertEqual(saved['verification_status'],'unverified')
        readiness=await match_readiness(db,'seeker',JOB)
        self.assertTrue(readiness['ready'])
        self.assertTrue(all(b['status']=='unverified' for b in readiness['credential_badges']))
    async def test_clear_wrong_type_cannot_be_attested_past_screening(self):
        db,ns=environment();ns['screen_file']=lambda *args:{'screening_status':'rejected','verification_notes':'Wrong document'}
        with self.assertRaises(HttpError) as caught:
            await ns['submit_unverified']('license',ns['Submission'](subtype='RN License',expiration_date='2099-01-01',confirmed=True),SEEKER)
        self.assertEqual(caught.exception.status_code,422)
        self.assertFalse(submitted(db.vault_documents.rows[0]))
    async def test_private_until_approved_then_revoked_without_erasing_badge(self):
        doc=attest(document());db,ns=environment([doc])
        self.assertEqual((await ns['offer_documents']('offer',EMPLOYER))['documents'],[])
        await ns['save_sharing']('offer',ns['Sharing'](document_ids=['license']),SEEKER)
        packet=await ns['offer_documents']('offer',EMPLOYER)
        self.assertEqual([d['id'] for d in packet['documents']],['license'])
        self.assertNotIn('storage_path',packet['documents'][0])
        body=ns['Verification'](method='licensing_board',notes='Checked state licensing board portal.',confirmed=True)
        await ns['verify_shared']('offer','license',body,EMPLOYER)
        saved=db.vault_documents.rows[0]
        self.assertEqual(badge(saved)['status'],'employer_verified')
        self.assertEqual(badge(saved)['method'],'licensing_board')
        await ns['save_sharing']('offer',ns['Sharing'](),SEEKER)
        self.assertEqual((await ns['offer_documents']('offer',EMPLOYER))['documents'],[])
        self.assertEqual(badge(saved)['status'],'employer_verified')
        self.assertFalse(await employer_can_view(db,'employer',saved))
    async def test_no_verification_before_consent_or_by_other_party(self):
        db,ns=environment([attest(document())]);body=ns['Verification'](method='issuer_portal',notes='Checked issuer website credential.',confirmed=True)
        for user in (EMPLOYER,SEEKER,{'id':'stranger','role':'poster'}):
            with self.assertRaises(HttpError): await ns['verify_shared']('offer','license',body,user)
    async def test_foreign_file_and_foreign_offer_are_denied(self):
        db,ns=environment()
        with self.assertRaises(HttpError): await ns['save_sharing']('offer',ns['Sharing'](document_ids=['foreign']),SEEKER)
        with self.assertRaises(HttpError): await ns['offer_documents']('offer',{'id':'stranger'})
        with self.assertRaises(HttpError): await ns['submit_unverified']('license',ns['Submission'](subtype='RN License',confirmed=True),{'id':'stranger'})
    async def test_scope_cannot_expand_to_unnecessary_medical_automatic_sharing(self):
        db,ns=environment()
        with self.assertRaises(HttpError): await ns['save_sharing']('offer',ns['Sharing'](auto_types=['VACCINES']),SEEKER)
    async def test_declined_or_withdrawn_offer_loses_access(self):
        doc=attest(document());offer={**OFFER,'document_sharing':{'approved_by':'seeker','documents':{'license':revision(doc)}}}
        for status in ('withdrawn','rejected','expired'):
            self.assertFalse(consent_allows({**offer,'status':status},doc,JOB))
    async def test_future_auto_sharing_requires_type_scope_and_submission(self):
        offer={**OFFER,'document_sharing':{'approved_by':'seeker','documents':{},'auto_types':['BLS']}}
        self.assertFalse(consent_allows(offer,document('BLS','certification','bls'),JOB))
        self.assertTrue(consent_allows(offer,attest(document('BLS','certification','bls')),JOB))
        self.assertFalse(consent_allows(offer,attest(document('ACLS','certification','acls')),JOB))
    async def test_document_change_invalidates_consent_submission_and_employer_badge(self):
        doc=attest(document());doc['employer_verifications']=[{'document_revision':revision(doc),'method':'issuer_contact','employer_name':'Example Clinic'}]
        offer={**OFFER,'document_sharing':{'approved_by':'seeker','documents':{'license':revision(doc)}}}
        self.assertTrue(consent_allows(offer,doc,JOB))
        for key,value in (('expiration_date','2098-01-01'),('document_number','NEW123'),('storage_path','private/replacement')):
            changed={**doc,key:value}
            self.assertFalse(consent_allows(offer,changed,JOB)); self.assertFalse(acceptable_upload(changed))
            self.assertEqual(badge(changed)['status'],'unverified')
    async def test_necessary_types_respect_job_and_role(self):
        self.assertEqual(necessary_types(JOB),['BLS','LICENSE'])
        self.assertIn('ACLS',necessary_types({**JOB,'certifications_required':['ACLS']}))
        self.assertFalse(document_necessary(JOB,document('CNA License')))
        self.assertTrue(document_necessary(JOB,document('RN License')))

if __name__=='__main__': unittest.main()

class OnboardingConsentTests(unittest.IsolatedAsyncioTestCase):
    async def test_case_sync_requires_consent_then_employer_check(self):
        from onboarding_logic import sync_case_document_consent
        db,ns=environment([attest(document())])
        db.onboarding_requirements=Collection({'id':'req','onboarding_case_id':'case','type':'license_verification','status':'completed'})
        db.requirement_document_matches=Collection({'id':'legacy','onboarding_requirement_id':'req','vault_document_id':'license'})
        async def delete(query): db.requirement_document_matches.rows=[]
        db.requirement_document_matches.delete_many=delete
        case={'id':'case','offer_id':'offer','candidate_id':'seeker','employer_id':'employer','job_id':'job'}
        await sync_case_document_consent(db,case)
        self.assertEqual(db.onboarding_requirements.rows[0]['status'],'action_required_candidate')
        self.assertEqual(db.requirement_document_matches.rows,[])
        await ns['save_sharing']('offer',ns['Sharing'](document_ids=['license']),SEEKER)
        await sync_case_document_consent(db,case)
        self.assertEqual(db.onboarding_requirements.rows[0]['status'],'pending_manual_review')
        await ns['verify_shared']('offer','license',ns['Verification'](method='document_review',notes='Reviewed the uploaded credential details.',confirmed=True),EMPLOYER)
        await sync_case_document_consent(db,case)
        self.assertEqual(db.onboarding_requirements.rows[0]['status'],'completed')
        await ns['save_sharing']('offer',ns['Sharing'](),SEEKER)
        await sync_case_document_consent(db,case)
        self.assertEqual(db.onboarding_requirements.rows[0]['status'],'action_required_candidate')
