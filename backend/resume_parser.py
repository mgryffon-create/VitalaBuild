"""Local, deterministic resume extraction. No AI client or network calls."""
import io
import re
from datetime import datetime, timezone

HEADINGS = {
    'experience': ('experience', 'work experience', 'professional experience', 'employment', 'employment history', 'work history'),
    'education': ('education', 'academic background', 'education and training'),
    'credentials': ('licenses', 'licensure', 'certifications', 'licenses and certifications', 'credentials'),
    'skills': ('skills', 'clinical skills', 'technical skills', 'core competencies'),
    'summary': ('summary', 'professional summary', 'profile', 'objective'),
}
MONTH = r'(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)'
DATE = rf'(?:{MONTH}\.?\s+\d{{4}}|\d{{1,2}}[/.-]\d{{4}}|(?:19|20)\d{{2}})'
DATE_RANGE = re.compile(rf'(?P<start>{DATE})\s*(?:[-–—]|\bto\b)\s*(?P<end>{DATE}|present|current|now)\b', re.I)
EMAIL = re.compile(r'[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}', re.I)
PHONE = re.compile(r'(?<!\d)(?:\+1[ .-]?)?\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}(?!\d)|(?<!\d)\d{10}(?!\d)')
ROLES = {'CNA': r'\b(?:CNA|certified nursing assistant|certified nurse aide)\b', 'LPN': r'\b(?:LPN|licensed practical nurse)\b', 'LVN': r'\b(?:LVN|licensed vocational nurse)\b', 'RN': r'\b(?:RN|registered nurse)\b'}
CERTS = {'BLS': r'\b(?:BLS|basic life support)\b', 'ACLS': r'\b(?:ACLS|advanced cardiovascular life support)\b', 'PALS': r'\b(?:PALS|pediatric advanced life support)\b', 'CPR': r'\b(?:CPR|cardiopulmonary resuscitation)\b'}
SKILLS = ('Epic', 'Cerner', 'ADLs', 'vital signs', 'wound care', 'patient care', 'medication administration', 'catheter care', 'trach care', 'dementia care', 'infection control', 'phlebotomy', 'Bilingual', 'recruiting', 'scheduling', 'staff training', 'housekeeping', 'customer service')
SPECIALTIES = {'ICU': r'\b(?:ICU|intensive care)\b', 'Med-Surg': r'\b(?:med[- ]surg|medical[- ]surgical)\b', 'Telemetry': r'\btelemetry\b', 'ER/ED': r'\b(?:emergency department|emergency room|ER|ED)\b', 'LTC': r'\b(?:LTC|long[- ]term care)\b', 'SNF': r'\b(?:SNF|skilled nursing)\b', 'Home Health': r'\bhome health\b'}


def sections(lines):
    result = {key: [] for key in HEADINGS}
    active = None
    for line in lines:
        label = re.sub(r'[^a-z ]', '', line.lower()).strip()
        match = next((key for key, names in HEADINGS.items() if label in names), None)
        if match:
            active = match
        elif active:
            # Other short headings stop the preceding section.
            if label in ('references', 'interests', 'awards', 'volunteering', 'languages'):
                active = None
            else:
                result[active].append(line)
    return result


def normalized_date(value):
    value = value.strip().rstrip('.')
    if value.lower() in ('present', 'current', 'now'):
        return ''
    for fmt in ('%B %Y', '%b %Y', '%m/%Y', '%m-%Y', '%m.%Y', '%Y'):
        try:
            parsed = datetime.strptime(value.replace('. ', ' '), fmt)
            return parsed.strftime('%Y') if fmt == '%Y' else parsed.strftime('%Y-%m')
        except ValueError:
            pass
    return value


async def parse_resume_text(text: str) -> dict:
    if len(text.strip()) < 50:
        return {'error': 'Not enough readable resume text. For a scanned PDF, paste the text or enter your details manually.'}
    lines = [re.sub(r'\s+', ' ', line).strip().replace('•', '-').replace('●', '-') for line in text[:100000].splitlines() if line.strip()]
    parts = sections(lines)
    result = {
        'full_name': '', 'first_name': '', 'last_name': '', 'credentials_suffix': [],
        'email': '', 'phone': '', 'address': {'city': '', 'state': '', 'zip': ''},
        'professional_summary': ' '.join(parts['summary'])[:2000],
        'specialties': [], 'skills': [], 'licenses': [], 'certifications': [],
        'education': [], 'employment_groups': [], 'work_history_mode': 'detailed',
        'availability': {'shift_preferences': [], 'start_date': '', 'travel_interest': None, 'preferred_states': []},
        '_parse_metadata': {'parser_version': 'local-rules-1', 'method': 'local_rules', 'parsed_at': datetime.now(timezone.utc).isoformat(), 'text_length': len(text), 'review_required': True},
    }
    email = EMAIL.search(text)
    phone = PHONE.search(text)
    result['email'] = email.group() if email else ''
    result['phone'] = phone.group() if phone else ''
    for line in lines[:5]:
        candidate = re.sub(r',?\s+(?:RN|LPN|LVN|CNA|BSN|MSN)(?:\s*,.*)?$', '', line, flags=re.I).strip()
        words = candidate.split()
        if 2 <= len(words) <= 4 and all(re.fullmatch(r"[^\W\d_][^\W\d_.'’\-]*", word, re.UNICODE) for word in words) and not any(word.lower() in {'resume', 'curriculum', 'vitae', 'experience', 'summary', 'nurse', 'assistant', 'manager', 'registered', 'certified'} for word in words):
            result.update(full_name=candidate, first_name=words[0], last_name=' '.join(words[1:]))
            break
    for line in lines[:10]:
        address = re.search(r'\b([A-Za-z][A-Za-z .\'-]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\b', line)
        if address:
            result['address'] = dict(zip(('city', 'state', 'zip'), address.groups()))
            break
    result['skills'] = [skill for skill in SKILLS if re.search(r'\b' + re.escape(skill) + r'\b', text, re.I)]
    for line in parts['skills']:
        for skill in re.split(r'[|;,•]', line):
            skill = skill.strip()
            if skill and len(skill) <= 70 and skill.lower() not in {s.lower() for s in result['skills']}:
                result['skills'].append(skill)
    result['specialties'] = [name for name, pattern in SPECIALTIES.items() if re.search(pattern, text, re.I)]
    result['credentials_suffix'] = [name for name, pattern in ROLES.items() if re.search(pattern, ' '.join(lines[:3]), re.I)]
    for name, pattern in ROLES.items():
        # Extract only explicit license mentions; do not turn a job title into a verified license.
        if any(re.search(pattern, line, re.I) and re.search(r'\blicen[cs]e|\blicensure\b', line, re.I) for line in parts['credentials']):
            result['licenses'].append({'license_type': name, 'state': '', 'license_number': '', 'expiration_date': '', 'compact': False, 'confidence': 'low'})
    for name, pattern in CERTS.items():
        if re.search(pattern, text, re.I):
            result['certifications'].append({'name': name, 'issuer': '', 'expiration_date': '', 'confidence': 'medium'})
    # Preserve education blocks for review without guessing degree or institution.
    for line in parts['education']:
        if re.search(r'\b(university|college|school|institute)\b', line, re.I):
            result['education'].append({'institution': line, 'degree': '', 'field_of_study': '', 'start_date': '', 'end_date': '', 'confidence': 'low'})
        elif result['education']:
            item = result['education'][-1]
            if re.search(r'\b(bachelor|associate|master|doctor|diploma|BS|BA|AS|AA|BSN|MSN|MBA)\b', line, re.I):
                item['degree'] = line
            dates = re.findall(DATE, line, re.I)
            if dates:
                item['end_date'] = normalized_date(dates[-1])
    work = parts['experience']
    previous_end = 0
    date_positions = [(i, DATE_RANGE.search(line)) for i, line in enumerate(work) if DATE_RANGE.search(line)]
    for idx, (i, dates) in enumerate(date_positions):
        header = [line for line in work[previous_end:i] if not line.startswith(('-', '–'))][-2:]
        inline = (work[i][:dates.start()] + work[i][dates.end():]).strip(' |,–—-')
        if inline:
            header.append(inline)
        next_date = date_positions[idx + 1][0] if idx + 1 < len(date_positions) else len(work)
        # Keep bullet responsibilities; ambiguous unbulleted lines remain for manual review.
        responsibilities = [line.lstrip('-– ') for line in work[i + 1:next_date] if line.startswith(('-', '–'))]
        title = ' — '.join(header) or 'Work experience'
        result['employment_groups'].append({'group_type': 'permanent_role', 'display_title': title, 'primary_employer': '', 'role_title': '', 'start_date': normalized_date(dates['start']), 'end_date': normalized_date(dates['end']), 'currently_working': dates['end'].lower() in ('present', 'current', 'now'), 'locations': [], 'specialties': [], 'assignment_count_estimate': None, 'description_summary': title, 'responsibilities': responsibilities, 'source_assignments': [], 'confidence': 'low'})
        previous_end = i + 1
    return result


async def extract_text_from_file(file_bytes: bytes, filename: str) -> str:
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    try:
        if ext == 'pdf':
            import fitz
            with fitz.open(stream=file_bytes, filetype='pdf') as doc:
                text = '\n'.join(page.get_text(sort=True) for page in doc)
        elif ext == 'docx':
            import docx
            doc = docx.Document(io.BytesIO(file_bytes))
            # Include tables, which are common in resume layouts.
            from docx.oxml.ns import qn
            from docx.table import Table
            from docx.text.paragraph import Paragraph
            blocks = []
            for element in doc.element.body:
                if element.tag == qn('w:p'):
                    blocks.append(Paragraph(element, doc).text)
                elif element.tag == qn('w:tbl'):
                    blocks.extend(' | '.join(cell.text for cell in row.cells) for row in Table(element, doc).rows)
            text = '\n'.join(blocks)
        elif ext == 'txt':
            text = file_bytes.decode('utf-8-sig', errors='replace')
        elif ext == 'doc':
            return '[Older .doc files are not supported. Save as DOCX or PDF, or paste your resume text.]'
        else:
            return '[Please upload a PDF, DOCX, or TXT resume.]'
    except Exception:
        return '[This file could not be read. Try an unlocked PDF or DOCX, or paste your resume text.]'
    if len(text.strip()) < 50:
        return '[Not enough readable text was found. Scanned PDFs need OCR; paste your resume text or enter your details manually.]'
    return text.strip()
