# VitalaMatch — Product Requirements Document

## Original Problem Statement
Healthcare hiring platform matching pros with employers, featuring bidirectional matching, worker protection, and structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI

## What's Been Implemented

### Phase 2: Job Card Polish (April 2025)
- **Reason line wording**: "Aligned with your RN specialty" (not "Related RN role"), "Meets your X+ year experience requirement", "You hold all required certifications"
- **Description de-emphasis**: collapsed = 1-line truncated preview (text-xs, opacity 70%); full text in expanded/Details view only
- **Chip hierarchy**: primary row (shift, duration, start date) in solid badges; secondary row (hours, stipend, exp, certs) in lighter outline
- **Date formatting**: "Starts Feb 1" (not "Start 2026-02-01"), "36 hrs/week" (not "36hrs/week")

### Phase 2: Tiered Matching System (April 2025)
- 3-tier classification (Strong/Possible/Hidden), 7-dimension scoring, job quality filtering
- Human-readable reason lines, tier badges, Expand Search, backward compat for poster swipe

### Phase 2: Structured Pay System (April 2025)
- Structured pay fields persisted and returned, auto-calculated weekly pay, pay range validation

### Phase 2: Job Posting Quality Gate (April 2025)
- 9+ required fields, weak title detection, section-level errors, publish gating

### Phase 2: Job Card Redesign (April 2025)
- Pay-first hierarchy, smart title, match score badge, quick detail chips, action buttons

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
