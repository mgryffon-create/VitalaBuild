"""Seeker-reviewed uploads, explicit offer sharing, and employer attestations."""
from datetime import datetime, timezone
import uuid
from pathlib import PurePath
import anyio
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from shared import db, get_current_user, log_audit
from object_storage import download_file
from document_screening import screen_file, screening_passed, expected_kind, LICENSE_KINDS
from credential_policy import (revision, current_file, acceptable_upload, badges, candidate_badges,
    necessary_types, document_type, active_offer, consent_allows, employer_checks, document_necessary, offer_job, badge)

router = APIRouter(tags=['credential-workflow'])

class Submission(BaseModel):
    subtype: str = Field(min_length=1, max_length=120)
    expiration_date: str | None = None
    issue_date: str | None = None
    document_date: str | None = None
    issuing_authority: str | None = Field(default=None, max_length=200)
    document_number: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=100)
    confirmed: bool = False

class Sharing(BaseModel):
    document_ids: list[str] = Field(default_factory=list, max_length=200)
    auto_types: list[str] = Field(default_factory=list, max_length=30)

class Verification(BaseModel):
    method: str
    notes: str = Field(min_length=10, max_length=2000)
    confirmed: bool = False

async def offer_for_user(offer_id, user):
    offer = await db.employment_offers.find_one({'id': offer_id}, {'_id': 0})
    if not offer or user['id'] not in (offer.get('seeker_id'), offer.get('poster_id')):
        raise HTTPException(status_code=404, detail='Offer not found')
    match = await db.matches.find_one({'id': offer.get('match_id'), 'seeker_id': offer['seeker_id'], 'poster_id': offer['poster_id'], 'job_id': offer['job_id']}, {'_id': 0})
    if not match:
        raise HTTPException(status_code=409, detail='A valid employer and seeker match is required')
    return offer

@router.get('/vault/credential-badges')
async def own_badges(current_user: dict = Depends(get_current_user)):
    return await candidate_badges(db, current_user['id'])

@router.post('/vault/documents/{doc_id}/submit-unverified')
async def submit_unverified(doc_id: str, body: Submission, current_user: dict = Depends(get_current_user)):
    doc = await db.vault_documents.find_one({'id': doc_id, 'candidate_id': current_user['id']}, {'_id': 0})
    if not doc or not doc.get('storage_path'):
        raise HTTPException(status_code=404, detail='Stored upload not found')
    if not body.confirmed:
        raise HTTPException(status_code=400, detail='Confirm that this is your credential and the corrected details are accurate')
    kind = expected_kind(body.subtype)
    if (doc.get('category') == 'license' and kind not in LICENSE_KINDS) or (doc.get('category') == 'certification' and kind not in {'BLS', 'ACLS', 'PALS', 'CPR', 'CNA'}):
        raise HTTPException(status_code=422, detail='Choose the correct credential type for this upload category')
    updated = {**doc, **body.model_dump(exclude={'confirmed'})}
    if not current_file(updated):
        raise HTTPException(status_code=422, detail='Provide a current expiration date and a current upload')
    if doc.get('category') in ('license', 'certification', 'identification') and not body.expiration_date:
        raise HTTPException(status_code=422, detail='An expiration date is required')
    try:
        contents, content_type = await anyio.to_thread.run_sync(lambda: download_file(doc['storage_path']))
        result = screen_file(contents, content_type, body.subtype, current_user.get('full_name'))
    except Exception:
        raise HTTPException(status_code=503, detail='Could not read the stored upload. Please try again.')
    if result['screening_status'] in ('rejected', 'expired'):
        raise HTTPException(status_code=422, detail=result['verification_notes'])
    # User confirmation never becomes automatic or employer verification.
    now = datetime.now(timezone.utc).isoformat()
    fields = body.model_dump(exclude={'confirmed'})
    fields.update(verification_status='unverified', screening_status='submitted_unverified',
                  verification_method='seeker_attestation', verification_notes='Details reviewed and submitted by the job seeker. Not verified.',
                  compliance_status='unverified', seeker_submission={'submitted_by': current_user['id'], 'submitted_at': now, 'document_revision': revision(updated)})
    await db.vault_documents.update_one({'id': doc_id, 'candidate_id': current_user['id'], 'storage_path': doc['storage_path']}, {'$set': fields})
    await log_audit(db, current_user['id'], 'credential_submit_unverified', 'vault_document', doc_id)
    return {'message': 'Submitted as unverified', 'badge': badges([{**updated, **fields}])}

@router.get('/hiring/offers/{offer_id}/documents')
async def offer_documents(offer_id: str, current_user: dict = Depends(get_current_user)):
    offer = await offer_for_user(offer_id, current_user)
    job = offer_job(await db.jobs.find_one({'id': offer['job_id']}, {'_id': 0}) or {}, offer)
    docs = await db.vault_documents.find({'candidate_id': offer['seeker_id']}, {'_id': 0}).to_list(500)
    seeker = current_user['id'] == offer['seeker_id']
    required = necessary_types(job)
    rows = []
    for doc in docs:
        if not doc.get('storage_path') or doc.get('replaced_by') or doc.get('verification_status') == 'archived': continue
        shared = consent_allows(offer, doc, job)
        if not seeker and not shared: continue
        rows.append({k: doc.get(k) for k in ('id','subtype','category','file_name','file_url','expiration_date','issuing_authority','document_number','state')} | {
            'document_revision': revision(doc), 'type': document_type(doc), 'necessary': document_necessary(job, doc),
            'file_url': f"/api/vault/files/{doc['id']}{PurePath(doc.get('file_name') or '').suffix if PurePath(doc.get('file_name') or '').suffix.lower() in ('.pdf','.png','.jpg','.jpeg','.webp','.docx') else '.bin'}", 'shared': shared, 'current': current_file(doc), 'badge': badge(doc),
            'verification': employer_checks(doc), 'verification_status': doc.get('verification_status')})
    consent = offer.get('document_sharing') or {}
    return {'offer_id': offer_id, 'active': active_offer(offer), 'necessary_types': required, 'documents': rows,
            'auto_types': consent.get('auto_types', []) if seeker else [], 'is_seeker': seeker,
            'disclaimer': 'Only approved documents are shared. Employer verification is a recorded employer attestation, not independent platform verification.'}

@router.put('/hiring/offers/{offer_id}/documents')
async def save_sharing(offer_id: str, body: Sharing, current_user: dict = Depends(get_current_user)):
    offer = await offer_for_user(offer_id, current_user)
    if current_user['id'] != offer['seeker_id']:
        raise HTTPException(status_code=403, detail='Only the job seeker can approve document sharing')
    # Empty selection is always allowed so consent can be revoked even after closure.
    if (body.document_ids or body.auto_types) and not active_offer(offer):
        raise HTTPException(status_code=409, detail='This offer is no longer active')
    job = offer_job(await db.jobs.find_one({'id': offer['job_id']}, {'_id': 0}) or {}, offer)
    if not set(body.auto_types).issubset(necessary_types(job)):
        raise HTTPException(status_code=422, detail='Automatic sharing must be limited to necessary credential types')
    docs = await db.vault_documents.find({'candidate_id': offer['seeker_id'], 'id': {'$in': body.document_ids}}, {'_id': 0}).to_list(500)
    if {d['id'] for d in docs} != set(body.document_ids) or any(not current_file(d) for d in docs):
        raise HTTPException(status_code=422, detail='Select only your current stored documents')
    consent = {'approved_by': current_user['id'], 'approved_at': datetime.now(timezone.utc).isoformat(),
               'documents': {d['id']: revision(d) for d in docs}, 'auto_types': sorted(set(body.auto_types))}
    await db.employment_offers.update_one({'id': offer_id, 'seeker_id': current_user['id']}, {'$set': {'document_sharing': consent}})
    await log_audit(db, current_user['id'], 'document_sharing_changed', 'employment_offer', offer_id,
                    details={'document_count': len(docs), 'auto_types': consent['auto_types']})
    return {'message': 'Sharing choices saved'}

@router.post('/hiring/offers/{offer_id}/documents/{doc_id}/verify')
async def verify_shared(offer_id: str, doc_id: str, body: Verification, current_user: dict = Depends(get_current_user)):
    offer = await offer_for_user(offer_id, current_user)
    if current_user.get('role') != 'poster' or current_user['id'] != offer['poster_id']:
        raise HTTPException(status_code=403, detail='Only this offer’s employer can verify shared credentials')
    doc = await db.vault_documents.find_one({'id': doc_id, 'candidate_id': offer['seeker_id']}, {'_id': 0})
    job = offer_job(await db.jobs.find_one({'id': offer['job_id']}, {'_id': 0}) or {}, offer)
    if not doc or not consent_allows(offer, doc, job):
        raise HTTPException(status_code=403, detail='The candidate has not shared this current document for this offer')
    if body.method not in ('document_review', 'issuer_portal', 'licensing_board', 'issuer_contact') or not body.confirmed or len(body.notes.strip()) < 10:
        raise HTTPException(status_code=422, detail='Choose a verification method and confirm you performed this check')
    profile = await db.poster_profiles.find_one({'user_id': current_user['id']}, {'_id': 0}) or {}
    record = {'id': str(uuid.uuid4()), 'employer_id': current_user['id'], 'employer_name': profile.get('company_name') or current_user.get('full_name'),
              'offer_id': offer_id, 'method': body.method, 'notes': body.notes.strip(), 'verified_at': datetime.now(timezone.utc).isoformat(), 'document_revision': revision(doc)}
    await db.vault_documents.update_one({'id': doc_id, 'candidate_id': offer['seeker_id']}, {'$push': {'employer_verifications': record}})
    await log_audit(db, current_user['id'], 'employer_credential_verified', 'vault_document', doc_id, details={'offer_id': offer_id, 'method': body.method})
    return {'message': 'Employer verification recorded on the seeker credential', 'verification': record}
