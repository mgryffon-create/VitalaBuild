# VitalaMatch — Product Requirements Document

## Original Problem Statement
Healthcare hiring platform matching pros with employers, featuring bidirectional matching, worker protection, and structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI

## What's Been Implemented

### Phase 2: Job Posting Quality Gate (April 2025)
- **9 required fields**: title (non-weak), specialty, location, description (20+), shift, pay (>$0), job type, experience, start date
- **Travel/contract extra**: +duration, +stipend/housing (11 total)
- **Publish disabled** until all required fields complete
- **Structured inputs**: Specialty (SpecialtyAutocomplete), Location (LocationAutocomplete), Certifications (InlineAutocomplete)
- **Weak title detection**: regex blocks "Test Job Posting 123" → auto-generates "ICU/Critical Care RN – Night Shift" from structured fields
- **Section-level errors**: Progress tracker shows ⚠️ on incomplete sections
- **Review section**: Missing fields as amber badges, "Ready to publish" green banner when complete

### Phase 2: Job Card Redesign (April 2025)
- Pay-first hierarchy, smart title, match score badge, quick detail chips, action buttons with labels

### Phase 2: Document Vault Organization (April 2025)
- Category tabs, human labels, single status, dedup, replace flow, preview fix

### Phase 2: All Prior Features
- Global autocomplete, work history editing, vault-as-source-of-truth, UX polish, resume upload, matching, onboarding

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
