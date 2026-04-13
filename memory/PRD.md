# VitalaMatch — Product Requirements Document

## Original Problem Statement
Healthcare hiring platform matching pros with employers, featuring bidirectional matching, worker protection, and structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI

## What's Been Implemented

### Phase 2: Global UX Cleanup — Structured Autocomplete (April 2025)
- **InlineAutocomplete component**: Shared single-value typeahead replacing raw text inputs
- **Fields converted**:
  - Certification name → autocomplete (30+ standard certs: BLS, ACLS, PALS, CCRN, etc.)
  - License Type → autocomplete (20+ types: RN, LPN, CNA, NP, etc.)
  - License State → autocomplete (50 US states + DC + Compact)
  - Work History Position/Title → autocomplete (35+ titles: ICU RN, Travel RN, etc.)
  - Work History Department/Unit → autocomplete (50+ departments: ICU, ED, Med-Surg, etc.)
- **Previously converted** (unchanged): Specialty, Clinical Skills, Experience Highlights, Preferred Locations
- **Suggestion data**: `/app/frontend/src/config/fieldSuggestions.js`

### Phase 2: Document Vault as Single Source of Truth (April 2025)
- Medical Records tab → vault routing + required docs checklist
- Vault deep-linking with category/type/from params

### Phase 2: UX Polish, Resume Upload, Matching, Onboarding
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
