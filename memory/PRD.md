# VitalaMatch — Product Requirements Document

## Original Problem Statement
Healthcare hiring platform matching pros with employers, featuring bidirectional matching, worker protection, and structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI

## What's Been Implemented

### Phase 2: Searchable Inputs + Document Preview Fix (April 2025)
- **All long-list fields are now autocomplete**: Specialty (SpecialtyAutocomplete), Certifications, License Type, License State, Position/Title, Department/Unit (InlineAutocomplete), Clinical Skills, Experience Highlights (SuggestionInput), Preferred Locations (LocationAutocomplete)
- **Short-list fields remain as Select** (by design): Availability, Shift, Job Type, Travel Readiness, Worker Protection fields (3-5 options each)
- **Document Preview fixed**: Root cause — file_url pointed to auth-protected endpoint but `<img src>` / `<iframe src>` don't send auth headers. Fix: DocumentPreview.jsx now fetches via authenticated `axios.get(url, {responseType:'blob'})` → creates blob URL → uses as src. Images render as `<img>`, PDFs as `<iframe>`, others show download fallback.
- **Dedup improved**: Prefers documents with file_url over metadata-only duplicates

### Phase 2: Document Vault Organization (April 2025)
- Category tabs, human labels, single status, dedup, replace flow, attention banner

### Phase 2: All Prior Features
- Human-centered vault, work history editing, global autocomplete, vault-as-source-of-truth, UX polish, resume upload, matching, onboarding

## Test Accounts
| Role | Email | Password |
|---|---|---|
| Seeker | seeker_test@vitalamatch.com | test123 |
| Employer | employer_test@vitalamatch.com | test123 |
| Admin | admin@vitalamatch.com | admin123 |

## Prioritized Backlog
### P1
- Interview Scheduling Integration
- Pipeline Analytics Dashboard
- Facility signals in seeker job cards
### P2
- Post-assignment feedback UI, Facility accountability dashboard
### Refactoring
- Extract server.py logic, break down ProfileBuilder.jsx
### Mocked
- SendGrid (logged to DB), Twilio SMS (disabled), Nursys API (disabled)
