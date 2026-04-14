# VitalaMatch — Product Requirements Document

## Original Problem Statement
Healthcare hiring platform matching pros with employers, featuring bidirectional matching, worker protection, and structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI

## What's Been Implemented

### Phase 2: Document Vault Validation + Compliance Logic (April 2025)
- **Expirable types**: certification, license, identification categories MUST have expiration_date — save blocked without it (400 error)
- **Expired documents**: allowed for recordkeeping but marked `expired`, never satisfy compliance
- **compliance_status**: computed dynamically on GET — `complete`, `expired`, `missing_expiration`, `review_needed`
- **Strict matching**: only most recent active version counts, expirable without expiration never satisfies, wrong type never matches
- **Frontend**: required asterisk + "Required for this document type" hint on expiration field for expirable categories
- **API**: GET /api/vault/expirable-types returns lists for frontend validation

### Phase 2: Compliance System Overhaul (April 2025)
- Baseline requirements, job-specific requirements, onboarding progress, auto-match

### Phase 2: Candidate Prioritization + Interaction Fix (April 2025)
- Match badges, smart sorting, profile modal, stage-aware actions, messaging gating

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
