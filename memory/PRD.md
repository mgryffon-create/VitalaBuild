# VitalaMatch — Product Requirements Document

## Original Problem Statement
Healthcare hiring platform matching pros with employers, featuring bidirectional matching, worker protection, and structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI

## What's Been Implemented

### Phase 2: Work History Editing (April 2025)
- **Edit mode**: Click gear icon on any work entry → form prefills with entry data → modify → "Save Changes" updates in-place
- **Delete**: Trash icon removes entries, auto-cancels edit mode if editing that entry
- **Field normalization**: Handles both standard (facility_name, position) and resume-parsed (primary_employer, role_title) field names
- **No re-upload required**: All changes happen inline on the Work History tab

### Phase 2: Global Autocomplete System (April 2025)
- InlineAutocomplete for: Certifications, License Type, State, Position/Title, Department/Unit
- SpecialtyAutocomplete, SuggestionInput (Skills, Highlights), LocationAutocomplete

### Phase 2: Document Vault as Single Source of Truth (April 2025)
- Vault routing from profile, deep-linking, guidance banners

### Phase 2: Resume Upload + UX Polish (April 2025)
- Auth fix, review dialog, AI language removed, specialty autocomplete

### Phase 2: Matching, Onboarding, Navigation
- All prior Phase 2 features

### Phase 1: Core Features (March-April 2025)
- Stripe Billing, OpenAI Resume Parser, Portable References, Document Vault, Compliance

## Test Accounts
| Role | Email | Password |
|---|---|---|
| Seeker | seeker_test@vitalamatch.com | test123 |
| Employer | employer_test@vitalamatch.com | test123 |
| Admin | admin@vitalamatch.com | admin123 |

## Prioritized Backlog
### P1
- Interview Scheduling Integration
- Pipeline Analytics Dashboard for Employers
- Integrate facility signals into seeker job cards
### P2
- Post-assignment feedback UI, Facility accountability dashboard
### Refactoring
- Extract server.py logic, break down ProfileBuilder.jsx
### Mocked
- SendGrid (logged to DB), Twilio SMS (disabled), Nursys API (disabled)
