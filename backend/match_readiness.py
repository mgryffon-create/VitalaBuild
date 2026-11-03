from document_screening import screening_passed, expected_kind
"""Essential upload gate; profile completeness never blocks browsing."""
from datetime import datetime, timezone
from fastapi import HTTPException
from eligibility import check_role_eligibility, get_seeker_role


def uploaded_current(doc):
    if not screening_passed(doc):
        return False
    if not (doc.get('storage_path') or doc.get('file_url')):
        return False
    if doc.get('verification_status') in ('rejected', 'invalid', 'expired') or doc.get('status') in ('replaced', 'deleted') or doc.get('replaced_by'):
        return False
    expires = doc.get('expiration_date')
    if expires:
        if not isinstance(expires, str):
            return False
        try:
            if datetime.fromisoformat(expires.replace('Z', '+00:00')).date() < datetime.now(timezone.utc).date():
                return False
        except (ValueError, TypeError):
            return False
    return True


async def match_readiness(db, seeker_id, job):
    profile = await db.seeker_profiles.find_one({'user_id': seeker_id}, {'_id': 0}) or {}
    documents = await db.vault_documents.find({'candidate_id': seeker_id}, {'_id': 0}).to_list(500)
    docs = [d for d in documents if uploaded_current(d)]
    missing = []
    role = get_seeker_role(profile)
    license_roles = {'LPN': {'LPN', 'LVN'}, 'LVN': {'LPN', 'LVN'}}.get(role, {role})
    if not any((d.get('category') == 'license' or expected_kind(d.get('subtype')) == 'CNA')
               and license_roles.intersection(d.get('detected_credentials', [])) for d in docs):
        missing.append('Professional license or credential')
    required = str(job.get('certifications_required', [])).upper()
    for kind in ('BLS', 'ACLS', 'PALS', 'CPR'):
        if kind == 'BLS' or kind in required:
            if not any(expected_kind(d.get('subtype')) == kind for d in docs):
                missing.append(f'{kind} certification')
    eligible = check_role_eligibility(profile, job)
    if not get_seeker_role(profile):
        eligible = {'eligible': False, 'reason': 'Add your professional role to finish matching.'}
    return {'ready': not missing and eligible['eligible'], 'missing_documents': missing,
            'role_reason': eligible.get('reason') if not eligible['eligible'] else None,
            'pending_reason': 'essential_uploads' if missing else ('role_review' if not eligible['eligible'] else None)}


async def refresh_match(db, match):
    job = await db.jobs.find_one({'id': match['job_id']}, {'_id': 0}) or {}
    readiness = await match_readiness(db, match['seeker_id'], job)
    if match.get('status') in ('active', 'pending_documents'):
        desired = 'active' if readiness['ready'] else 'pending_documents'
        if desired != match.get('status'):
            await db.matches.update_one({'id': match['id']}, {'$set': {'status': desired}})
        match = {**match, 'status': desired}
    return {**match, 'readiness': readiness}


async def require_match_ready(db, match):
    refreshed = await refresh_match(db, match)
    if not refreshed['readiness']['ready']:
        raise HTTPException(status_code=409, detail={'message': 'Match pending: complete essential uploads and role details first.', **refreshed['readiness']})
    return refreshed
