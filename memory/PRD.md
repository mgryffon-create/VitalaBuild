# VitalaMatch — Product Requirements Document

## Original Problem Statement
Healthcare hiring platform matching pros with employers, featuring bidirectional matching, worker protection, and structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI
- **AI:** GPT-4.1 vision (emergentintegrations) for resume parsing + document verification (LLM fallback)

## What's Been Implemented

### Phase 2: Compliance Readiness & Onboarding System (April 2025)
**Seeker Readiness**
- Standard Compliance Bundle: BLS, ACLS, RN License, TB Test, Vaccinations, Gov ID, Background Check, Drug Screen
- GET /api/seeker/readiness: score, level (ready_to_work/partially_ready/needs_documents), per-item status
- Dashboard readiness card: percentage, color-coded item badges, "Upload Documents" CTA

**Typed Signature**
- Offer acceptance requires typed full legal name
- Backend validates (400 if missing/short), stores typed_signature + signature_timestamp
- UI: electronic signature section with legal agreement text

**Job Documents**
- POST/GET /api/jobs/{job_id}/documents: employer uploads per-job onboarding packets, policies, training
- Stored in `job_documents` collection (NOT vault)
- Auto-attached to onboarding checklist after hire

**External Systems**
- POST/GET /api/employer/external-systems: track background check, drug screening, training, e-signature providers
- System name + type + optional URL
- No external integrations — coordination tracking only

**Onboarding Checklist API**
- GET /api/onboarding/{case_id}/checklist: unified bidirectional view (employer + seeker see same data)
- Sections: documents, tasks, external
- PUT /api/onboarding/{case_id}/items/{item_id}/status: update item + recompute case status
- Progress tracking: total, completed, pending, flagged, percent

### Phase 2: Lightweight Document Verification (April 2025)
- PyMuPDF text extraction, regex date/credential detection, LLM fallback

### Phase 2: Platform-Wide UX (April 2025)
- Universal back navigation, autocomplete, date validation

### Phase 2: Structured Offer System (April 2025)
- Offer Builder modal, employment documents, structured seeker offer view

### Phase 2: Offer State Sync, Credential Verification, Job-Grouped Messaging, Recruiter Credential Display, Match/Conversation Detail, Hiring Flow UX Overhaul (April 2025)

## Data Model Additions

### Standard Compliance Bundle (computed, not stored)
BLS, ACLS, RN License, TB Test, Vaccinations, Gov ID, Background Check, Drug Screen

### job_documents collection
```
{id, job_id, employer_id, document_type, action_required, title, file_name, file_url, file_size, uploaded_at}
```

### external_systems collection
```
{id, employer_id, system_name, system_type, url, created_at}
```

### Onboarding checklist (unified API)
```
GET /onboarding/{case_id}/checklist → {case, progress, sections: {documents, tasks, external}, job_documents, external_systems}
```

## Test Accounts
| Role | Email | Password |
|---|---|---|
| Seeker | seeker_test@vitalamatch.com | test123 |
| Employer | employer_test@vitalamatch.com | test123 |
| Test Seeker | testseeker@test.com | test123 |
| Admin | admin@vitalamatch.com | admin123 |

## Prioritized Backlog
### P0
- Seeker profile Role Category selector (normalized_role_category in ProfileBuilder.jsx)
### P1
- Onboarding Checklist UI pages (employer + seeker bidirectional views)
- Interview Scheduling Integration
- Pipeline Analytics Dashboard
### P2
- PDF offer letter generation, e-signatures
- Background check/drug screen API integrations
- Admin manual review queue for needs_review documents
### Refactoring
- Extract server.py logic, break down ProfileBuilder.jsx (>1600 lines)
### Mocked
- SendGrid (logged to DB), Twilio SMS (disabled), Nursys API (disabled)
