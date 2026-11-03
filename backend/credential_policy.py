"""Document submission, portable verification, and offer-scoped consent policy."""
import hashlib
import json
from datetime import datetime, timezone
from document_screening import screening_passed, expected_kind
from eligibility import get_accepted_roles_for_job

REVISION_FIELDS = ('id', 'storage_path', 'category', 'subtype', 'expiration_date', 'issue_date', 'document_number', 'issuing_authority', 'state', 'document_date')

def revision(doc):
    return hashlib.sha256(json.dumps({k: doc.get(k) for k in REVISION_FIELDS}, sort_keys=True).encode()).hexdigest()

def current_file(doc):
    if not doc.get('storage_path') or doc.get('replaced_by') or doc.get('status') in ('deleted', 'replaced') or doc.get('verification_status') == 'archived':
        return False
    if doc.get('expiration_date'):
        try:
            return datetime.fromisoformat(doc['expiration_date'].replace('Z', '+00:00')).date() >= datetime.now(timezone.utc).date()
        except (ValueError, TypeError, AttributeError):
            return False
    return True

def employer_checks(doc):
    return [v for v in doc.get('employer_verifications', []) if v.get('document_revision') == revision(doc)]

def submitted(doc):
    return doc.get('seeker_submission', {}).get('document_revision') == revision(doc)

def acceptable_upload(doc):
    if not current_file(doc) or doc.get('verification_status') in ('rejected', 'invalid', 'expired') or doc.get('screening_status') in ('rejected', 'expired'):
        return False
    if doc.get('category') in ('license', 'certification') and not doc.get('expiration_date'):
        return False
    return screening_passed(doc) or submitted(doc) or bool(employer_checks(doc))

def badge(doc):
    checks = employer_checks(doc) if current_file(doc) else []
    if checks:
        latest = checks[-1]
        return {'credential': doc.get('subtype') or doc.get('category'), 'status': 'employer_verified',
                'label': 'Employer verified', 'employer': latest.get('employer_name'), 'method': latest.get('method'),
                'verified_at': latest.get('verified_at'), 'disclaimer': 'Employer-reported verification; not an independent VitalaMatch or licensing-board verification.'}
    if current_file(doc) and screening_passed(doc):
        return {'credential': doc.get('subtype'), 'status': 'screened', 'label': 'Content screened',
                'disclaimer': 'Automated content check only; issuer authenticity has not been verified.'}
    return {'credential': doc.get('subtype') or doc.get('category'), 'status': 'unverified', 'label': 'Unverified',
            'disclaimer': 'Submitted by the job seeker; credential has not been verified.'}

def badges(docs):
    # Display credential status only, never document numbers, private files, or medical records.
    return [badge(d) for d in docs if d.get('category') in ('license', 'certification') and not d.get('replaced_by') and d.get('verification_status') != 'archived']

async def candidate_badges(db, seeker_id):
    docs = await db.vault_documents.find({'candidate_id': seeker_id}, {'_id': 0}).to_list(500)
    return badges(docs)

def necessary_types(job):
    result = {'LICENSE', 'BLS'}
    text = str(job.get('certifications_required', [])) + ' ' + str(job.get('compliance_requirements', []))
    for kind in ('ACLS', 'PALS', 'CPR'):
        if kind in text.upper(): result.add(kind)
    # Explicit job-specific needs, not an indiscriminate role-based medical bundle.
    aliases = {'government_id': 'ID', 'background_check': 'BACKGROUND', 'drug_screen': 'DRUG', 'tb_screening': 'TB', 'vaccination_records': 'VACCINES'}
    normalized = text.lower().replace('_', ' ')
    for key, kind in aliases.items():
        if key.replace('_', ' ') in normalized: result.add(kind)
    if 'tb ' in normalized or 'tuberculosis' in normalized: result.add('TB')
    if 'government id' in normalized or 'photo id' in normalized: result.add('ID')
    return sorted(result)

def document_type(doc):
    if doc.get('category') == 'license' or expected_kind(doc.get('subtype')) == 'CNA': return 'LICENSE'
    kind = expected_kind(doc.get('subtype'))
    if kind: return kind
    text = (doc.get('subtype') or '').lower()
    if doc.get('category') in ('identity', 'identification'): return 'ID'
    if 'background' in text: return 'BACKGROUND'
    if 'drug' in text: return 'DRUG'
    if any(w in text for w in ('tb', 'quantiferon', 'ppd')): return 'TB'
    if any(w in text for w in ('vaccine', 'vaccination', 'mmr', 'hepatitis', 'varicella', 'tdap', 'influenza', 'covid')): return 'VACCINES'
    return 'OTHER'

def document_necessary(job, doc):
    kind = document_type(doc)
    if kind not in necessary_types(job): return False
    if kind == 'LICENSE':
        roles = set(get_accepted_roles_for_job(job))
        if roles.intersection({'LPN', 'LVN'}): roles.update({'LPN', 'LVN'})
        return not roles or expected_kind(doc.get('subtype')) in roles or bool(roles.intersection(doc.get('detected_credentials', [])))
    return True

def active_offer(offer):
    if not offer or offer.get('status') not in ('pending', 'accepted'): return False
    if offer.get('status') == 'pending' and offer.get('expiration_date'):
        try:
            return datetime.fromisoformat(offer['expiration_date'].replace('Z', '+00:00')).date() >= datetime.now(timezone.utc).date()
        except (ValueError, TypeError): return False
    return True

def consent_allows(offer, doc, job):
    if not active_offer(offer) or offer.get('seeker_id') != doc.get('candidate_id') or not current_file(doc): return False
    consent = offer.get('document_sharing') or {}
    if consent.get('approved_by') != offer.get('seeker_id'): return False
    if consent.get('documents', {}).get(doc.get('id')) == revision(doc): return True
    kind = document_type(doc)
    return kind in consent.get('auto_types', []) and document_necessary(job, doc) and acceptable_upload(doc)

def offer_job(job, offer):
    return {**job, 'compliance_requirements': list(job.get('compliance_requirements') or []) + list(offer.get('conditions') or [])}

async def employer_can_view(db, employer_id, doc):
    offers = await db.employment_offers.find({'poster_id': employer_id, 'seeker_id': doc.get('candidate_id')}, {'_id': 0}).to_list(200)
    for offer in offers:
        job = await db.jobs.find_one({'id': offer.get('job_id')}, {'_id': 0}) or {}
        if consent_allows(offer, doc, offer_job(job, offer)): return True
    return False
