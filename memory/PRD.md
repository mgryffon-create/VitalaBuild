# VitalaMatch — Product Requirements Document

## Original Problem Statement
Healthcare hiring platform matching pros with employers, featuring bidirectional matching, worker protection, and structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI

## What's Been Implemented

### Phase 2: Desktop Swipe Experience (April 2025)
- Container widened to max-w-2xl (672px) on desktop via `lg:` breakpoint
- Card height increased: `lg:h-[min(480px,calc(100vh-300px))]`
- 3-card visible stack (from 2) with 10px offset, 0.035 scale, 0.5 opacity on 3rd card
- Action buttons enlarged: Interested 80px, Pass 72px, Details 56px, Undo 48px
- Card content text scales up: pay lg:text-4xl, title lg:text-lg, badge lg:text-sm
- Top card shadow-2xl on desktop, background cards shadow-md
- Mobile layout completely unchanged (all desktop-only via `lg:` prefix)

### Phase 2: Offer Acceptance Guardrails (April 2025)
- Conflict detection engine, hard blocks + soft warnings, 409 acceptance blocking
- Enriched employment records with end_date, shift_type, location, job_type

### Phase 2: Card Polish (April 2025)
- Confident reason lines, description de-emphasis, chip hierarchy, human date formatting

### Phase 2: Tiered Matching (April 2025)
- 3-tier classification, 7-dimension scoring, Expand Search

### Phase 2: Structured Pay (April 2025)
- Structured pay fields, auto-calculated weekly pay, pay range validation

### Phase 2: All Prior Features
- Job posting quality gate, job card redesign, document vault, global autocomplete, work history editing, vault-as-source-of-truth, UX polish, resume upload, matching, onboarding

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
