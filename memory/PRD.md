# VitalaMatch — Product Requirements Document

## Original Problem Statement
Healthcare hiring platform matching pros with employers, featuring bidirectional matching, worker protection, and structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI
- **AI:** GPT-4.1 vision (emergentintegrations) for resume parsing + document verification

## What's Been Implemented

### Phase 2: Seeker Onboarding Walkthrough (April 2025)
- **4-step guided walkthrough**: Welcome → Requirements → Document Vault → What Happens Next
- **Shows only for first-time users** with incomplete profiles on /seeker/swipe
- **Progressive completion**: Only license + role required to browse. Documents optional, onboarding items after offer only
- **Vault explanation**: "Upload once, use everywhere" + "You do NOT need everything right now" with grouped items
- **Skip/remember**: Skippable at any step. localStorage remembers per user. Completed profiles skip entirely
- **Contextual guidance**: OnboardingGate shows "Add your license and role to start viewing jobs". Vault empty state explains documents help you get hired faster

### Phase 2: E2E Bug Fixes (April 2025)
- **Offer Builder default dates**: expiration now defaults to start_date + 7 days (was incorrectly before start_date)
- **Pipeline stage sync on hire**: `respond_to_offer` now updates pipeline_stages to "hired" on acceptance

### Phase 2: Compliance Readiness & Onboarding (April 2025)
- Readiness score, typed signature, job documents, external systems, onboarding checklist API

### Phase 2: Lightweight Document Verification (April 2025)
- PyMuPDF text extraction, regex date/credential detection, LLM fallback

### Phase 2: Platform-Wide UX (April 2025)
- Universal back navigation, autocomplete, date validation

### Phase 2: Structured Offer System (April 2025)
- Offer Builder modal, employment documents, structured seeker offer view

### Phase 2: All Other Features (April 2025)
- Offer state sync, credential verification, job-grouped messaging, recruiter credential display, match/conversation detail, hiring flow UX overhaul, acceptance flow, role eligibility, vault verification, compliance, candidate prioritization, onboarding, swipe, offer guardrails, tiered matching, structured pay

## Test Accounts
| Role | Email | Password | Notes |
|---|---|---|---|
| Seeker | seeker_test@vitalamatch.com | test123 | Jane Smith, RN, complete profile |
| Employer | employer_test@vitalamatch.com | test123 | Test Employer, complete |
| New Seeker | newseeker_e2e@test.com | test123 | Incomplete, shows walkthrough |
| Test Seeker | testseeker@test.com | test123 | Incomplete profile |
| Admin | admin@vitalamatch.com | admin123 | Admin panel |

## Prioritized Backlog
### P0
- Seeker profile Role Category selector (normalized_role_category in ProfileBuilder.jsx)
### P1
- Onboarding Checklist UI pages (bidirectional employer + seeker views)
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
