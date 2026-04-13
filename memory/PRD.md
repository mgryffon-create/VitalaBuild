# VitalaMatch — Product Requirements Document

## Original Problem Statement
Healthcare hiring platform matching pros with employers, featuring bidirectional matching, worker protection, and structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI

## What's Been Implemented

### Phase 2: Offer Acceptance Guardrails (April 2025)
- **Conflict detection engine**: checks date overlap, shift overlap, distance (city), job type compatibility against all active/accepted assignments
- **Hard blocks**: overlapping dates with incompatible job types (both full-commitment), overlapping shifts, ongoing assignments with no end date
- **Soft warnings**: different city, similar shift times for flexible roles, risky but feasible combos
- **New endpoint**: GET /api/hiring/offers/{id}/conflicts — returns {has_hard_block, hard_blocks, soft_warnings, existing_assignments}
- **Acceptance blocking**: respond_to_offer returns 409 with conflict details when hard blocks exist; decline always works
- **Enriched employment records**: end_date (calculated from duration), shift_type, location, job_type stored from linked job
- **Frontend**: conflict alerts in review dialog (red hard block / amber soft warning), "Blocked" accept button, existing assignments display

### Phase 2: Card Polish (April 2025)
- Confident reason lines, description de-emphasis, chip hierarchy, human date formatting

### Phase 2: Tiered Matching (April 2025)
- 3-tier classification (Strong/Possible/Hidden), 7-dimension scoring, Expand Search

### Phase 2: Structured Pay (April 2025)
- Structured pay fields, auto-calculated weekly pay, pay range validation

### Phase 2: Job Posting Quality Gate (April 2025)
- 9+ required fields, weak title detection, section-level errors, publish gating

### Phase 2: All Prior Features
- Global autocomplete, work history editing, vault-as-source-of-truth, UX polish, resume upload, matching, onboarding, document vault

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
