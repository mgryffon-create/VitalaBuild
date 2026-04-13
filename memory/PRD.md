# VitalaMatch — Product Requirements Document

## Original Problem Statement
Healthcare hiring platform matching pros with employers, featuring bidirectional matching, worker protection, and structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI

## What's Been Implemented

### Phase 2: Job Card Redesign — Decision-First UX (April 2025)
- **Smart title**: `smartTitle()` converts generic "Test Job Posting 1234" → "ICU/Critical Care RN" from specialty field
- **Pay-first hierarchy**: Weekly pay shown as 2xl/3xl font (most prominent). Hidden when $0.
- **Match score badge**: Amber card with star + percentage + "match" label
- **Quick detail chips**: Shift, duration, start date, stipend, certs required — all visible without expanding
- **Hidden noise**: $0 pay hidden, "0+ yrs" hidden, generic job IDs replaced
- **Action buttons with labels**: Pass (X), Details (chevron), Interested (heart) — all labeled clearly
- **Employer view redesigned**: Pay expectation prominent, experience highlights as checklist, skills/certs in expanded view
- **Preserved**: Swipe gestures, card stack animation, match dialog, expanded details

### Phase 2: Searchable Inputs + Document Preview Fix (April 2025)
- All long-list fields converted to autocomplete, document preview via authenticated blob URLs

### Phase 2: Document Vault Organization (April 2025)
- Category tabs, human labels, single status, dedup, replace flow

### Phase 2: All Prior Features
- Work history editing, global autocomplete, vault-as-source-of-truth, UX polish, resume upload, matching, onboarding

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
