"""Conservative content screening, separate from issuer authenticity checks."""
import re
from datetime import datetime, timezone
from lightweight_parser import extract_text_from_bytes, find_dates_in_text

SCREENING_VERSION = 'content-v2'
KINDS = {
    'BLS': r'\b(?:BLS|basic life support)\b',
    'ACLS': r'\b(?:ACLS|advanced (?:cardiovascular|cardiac) life support)\b',
    'PALS': r'\b(?:PALS|pediatric advanced life support)\b',
    'CPR': r'\b(?:CPR|cardiopulmonary resuscitation)\b',
    'RN': r'\b(?:registered nurse|RN)\b',
    'LPN': r'\b(?:licensed practical nurse|LPN)\b',
    'LVN': r'\b(?:licensed vocational nurse|LVN)\b',
    'CNA': r'\b(?:certified (?:nursing assistant|nurse aide)|CNA)\b',
    'NP': r'\b(?:nurse practitioner|APRN|NP)\b',
    'PT': r'\b(?:physical therapist|PT)\b',
    'OT': r'\b(?:occupational therapist|OT)\b',
    'RT': r'\b(?:respiratory therapist|RRT|CRT)\b',
}
LICENSE_KINDS = {'RN', 'LPN', 'LVN', 'CNA', 'NP', 'PT', 'OT', 'RT'}
ISSUER = re.compile(r'american heart association|american red cross|\bAHA\b|\bASHI\b|health.*safety institute|board of (?:registered )?nursing|board of nurse|department of health|department of (?:financial|professional)|professional regulation|licensing board|state of [a-z ]+', re.I)
LICENSE_MARKER = re.compile(r'\b(?:license|licence|licensure|registry|registration)\b', re.I)
NUMBER = re.compile(r'\b(?:license|licence|registration|registry|credential)(?:\s+(?:number|no\.?|#|id))?\s*[:#-]?\s*(?=[A-Z0-9-]*\d)[A-Z0-9-]{4,}\b', re.I)


def expected_kind(subtype):
    for kind, pattern in KINDS.items():
        if re.search(pattern, (subtype or '').replace('_', ' '), re.I):
            return kind
    return 'LICENSE' if (subtype or '').lower() == 'professional license' else None


def labelled_expiration(text):
    candidates = []
    for date in find_dates_in_text(text):
        prefix = text[max(0, date['position'] - 55):date['position']]
        label = re.search(r'(?:expiration(?: date)?|expires?(?: on| date)?|valid (?:until|through|thru)|expiry)\s*[:.-]?\s*$', prefix, re.I)
        if label:
            candidates.append(date['date'])
    unique = sorted(set(candidates))
    return unique[0] if len(unique) == 1 else None


def screen_text(text, subtype, holder_name=None):
    result = {'screening_version': SCREENING_VERSION, 'screening_status': 'needs_review',
              'verification_status': 'needs_review', 'verification_method': 'content_screening',
              'verification_notes': 'Document content could not be confirmed. It does not count toward matching until reviewed.',
              'parsed_expiration_date': None, 'authenticity_status': 'not_checked'}
    if not text or len(text.strip()) < 40:
        result['verification_notes'] = 'Unreadable document or image-only scan. Upload a readable PDF or request review; no credential has been approved.'
        return result
    expected = expected_kind(subtype)
    detected = [kind for kind, pattern in KINDS.items() if re.search(pattern, text, re.I)]
    result['detected_credentials'] = detected
    if not expected:
        result['verification_notes'] = 'This document type needs review. Date extraction alone cannot approve it.'
        return result
    type_match = expected in detected if expected != 'LICENSE' else bool(LICENSE_KINDS.intersection(detected))
    resume_like = bool(re.search(r'\b(?:resume|curriculum vitae|work experience|employment history|professional summary)\b', text, re.I))
    if not type_match or resume_like:
        result.update(screening_status='rejected', verification_status='rejected', verification_notes=f'This file does not appear to be the selected {subtype} document. Upload the credential itself.')
        return result
    if expected in LICENSE_KINDS or expected == 'LICENSE':
        if not LICENSE_MARKER.search(text) or not NUMBER.search(text):
            result['verification_notes'] = 'Could not confirm a professional license and license number. This file needs review and cannot unlock matching.'
            return result
    elif not re.search(r'\b(?:provider|completion|certification|certificate|ecard|card|successfully completed)\b', text, re.I):
        result['verification_notes'] = 'The credential was mentioned, but this file could not be identified as a credential card or certificate.'
        return result
    if not ISSUER.search(text):
        result['verification_notes'] = 'Could not identify the issuing organization. This document needs review.'
        return result
    name_parts = re.findall(r'[^\W\d_]+', holder_name or '', re.UNICODE)
    words = {word.casefold() for word in re.findall(r'[^\W\d_]+', text, re.UNICODE)}
    if len(name_parts) < 2 or not all(part.casefold() in words for part in (name_parts[0], name_parts[-1])):
        result['verification_notes'] = 'Could not match the credential holder to your profile name. Check your name or request review.'
        return result
    expiration = labelled_expiration(text)
    if not expiration:
        result['verification_notes'] = 'Document type was recognized, but an unambiguous labeled expiration date could not be confirmed.'
        return result
    result['parsed_expiration_date'] = expiration
    if expiration < datetime.now(timezone.utc).date().isoformat():
        result.update(screening_status='expired', verification_status='expired', verification_notes=f'This {subtype} document expired on {expiration}. Upload a current copy.')
        return result
    result.update(screening_status='passed', verification_status='verified', verification_notes='Document type, holder name, issuer text, and expiration passed content screening. Issuer authenticity has not been checked.')
    return result


def screen_file(contents, content_type, subtype, holder_name=None):
    return screen_text(extract_text_from_bytes(contents, content_type), subtype, holder_name)


def screening_passed(doc):
    return (doc.get('screening_version') == SCREENING_VERSION and doc.get('screening_status') == 'passed'
            and doc.get('verification_status') == 'verified'
            and doc.get('screened_subtype') == doc.get('subtype')
            and doc.get('screened_category') == doc.get('category')
            and doc.get('screened_expiration_date') == doc.get('expiration_date'))
