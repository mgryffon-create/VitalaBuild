# VitalaMatch — Product Requirements Document

## Original Problem Statement
Healthcare hiring platform matching pros with employers, featuring bidirectional matching, worker protection, and structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI

## What's Been Implemented

### Phase 2: Tiered Matching System (April 2025)
- **3-tier classification**: Strong Match (exact specialty + experience met + no major conflicts), Possible Match (related role/partial fit), Hidden (unrelated/major conflicts)
- **7-dimension scoring**: specialty, experience, certifications, shift, location, job type, start timing
- **Job quality filtering**: jobs missing pay, shift, location, or having poor descriptions are downgraded
- **Human-readable reason lines**: 1-2 plain-language explanations per job card (e.g., "Matches your Med-Surg specialty")
- **Tier badges**: "Strong Match" (green) / "Possible Match" (amber) — no raw percentages shown
- **Expand Search**: hidden jobs only appear when user explicitly expands after exhausting top matches
- **API change**: GET /api/swipe/jobs returns `{jobs, counts, has_hidden}` (not flat array); supports `?expand=true`
- **Backward compat**: poster swipe (/api/swipe/seekers) still returns flat array via legacy wrapper

### Phase 2: Structured Pay System (April 2025)
- Structured pay fields: base_rate, guaranteed_hours, weekly_stipend, overtime_rate, weekly_pay, job_type, stipend, weekly_hours
- Backend models updated, auto-calculated weekly pay, pay range validation, high-salience card display

### Phase 2: Job Posting Quality Gate (April 2025)
- 9+ required fields, weak title detection, section-level errors, publish gating

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
