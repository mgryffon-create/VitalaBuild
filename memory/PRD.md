# VitalaMatch — Product Requirements Document

## Original Problem Statement
Healthcare hiring platform matching pros with employers, featuring bidirectional matching, worker protection, and structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI

## What's Been Implemented

### Phase 2: Document Vault as Single Source of Truth (April 2025)
- **Medical Records tab**: Removed all upload forms. Now shows vault routing CTA ("Go to Document Vault") + required documents checklist (TB, Physical, COVID-19, Flu, Hep B, MMR). Each item clicks through to vault with correct type preselected.
- **Credentials tab**: Kept metadata entry fields (cert name/expiration, license type/state/number). Added "Upload in Vault" CTA buttons routing to vault with correct category.
- **Vault deep-linking**: Query params `?category=medical&type=TB%20Skin%20Test%20(PPD)&from=profile` auto-open upload dialog with correct type preselected.
- **Vault guidance banner**: Shows contextual message when routed from profile/completion.
- **OnboardingGate**: Each checklist item is now clickable — profile fields route to profile, document items route to vault with context.
- **Backend**: `GET /api/profile/completion` now queries vault_documents + documents collections for doc_checks (tb_clearance, bls_certification, medical_document, license_document).

### Phase 2: UX Polish (April 2025)
- AI language removed, specialty autocomplete, resume review hierarchy, "What did you do?" label

### Phase 2: Resume Upload Auth Fix + Review (April 2025)
- Fixed auth bug, AI parser with review dialog

### Phase 2: Experience Highlights & Skills Autocomplete (April 2025)
- SuggestionInput with specialty-based suggestions

### Phase 2: ResizeObserver Fix (April 2025)
- SelectContent `position="item-aligned"`

### Phase 2: Location Autocomplete, Document Upload, Routing, Onboarding, Matching
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
