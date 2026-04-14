# VitalaMatch — Product Requirements Document

## Original Problem Statement
Healthcare hiring platform matching pros with employers, featuring bidirectional matching, worker protection, and structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI

## What's Been Implemented

### Phase 2: Compliance System Overhaul (April 2025)
- **Employer Baseline Requirements**: 9 toggleable items (license, BLS, ACLS, TB, vaccinations, I-9, background check, drug screen, govt ID) saved to `compliance_baselines` collection; auto-applied to all new hires
- **Job-Specific Requirements**: `compliance_requirements` field on job model for facility-specific items (trainings, policy acknowledgements)
- **Onboarding Progress**: pipeline cards in "hired" column show progress bar (X/Y complete) with status labels (In Progress/Ready/Blocked)
- **Onboarding Detail**: profile modal shows breakdown (completed, missing, expired, pending external)
- **Auto-Match**: existing vault matching logic connects candidate documents to requirements automatically (via onboarding_logic.py)

### Phase 2: Candidate Prioritization (April 2025)
- Match badges, reasons, smart sorting on pipeline cards

### Phase 2: Candidate Interaction Fix (April 2025)
- Click → profile modal, stage-aware actions, confirmation dialogs, messaging gating

### Phase 2: Employer Onboarding, Desktop Swipe, Offer Guardrails, Tiered Matching, Structured Pay, Card Polish, Quality Gates, Prior Features
- (See previous versions for full detail)

## Test Accounts
| Role | Email | Password |
|---|---|---|
| Seeker | seeker_test@vitalamatch.com | test123 |
| Employer | employer_test@vitalamatch.com | test123 |
| New Employer | new_employer_test@vitalamatch.com | test123 |
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
