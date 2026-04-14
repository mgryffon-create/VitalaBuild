# VitalaMatch — Product Requirements Document

## Original Problem Statement
Healthcare hiring platform matching pros with employers, featuring bidirectional matching, worker protection, and structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI
- **AI:** GPT-4.1 vision (emergentintegrations) for resume parsing + document verification

## What's Been Implemented

### Phase 2: State Synchronization Fix (April 2025)
- **Root cause**: pipeline update_stage only updated pipeline_stages, never created Match record
- **Fix**: update_stage creates Match record (idempotent) when moving to matched/interviewing/offer_sent/hired
- **Bidirectional sync**: accept_candidate also syncs pipeline_stages; pipeline candidates include match_id
- **Messaging fixed**: uses match_id from pipeline data directly (no redundant API lookup)
- **Seeker sync**: applications show "matched" (not "pending") when Match record exists

### Phase 2: Vault Verification — Expiration Date Parsing (April 2025)
- GPT-4.1 vision extraction, verification statuses, compliance integration, mismatch detection

### Phase 2: Document Vault Validation (April 2025)
- Expirable types enforcement, compliance_status computation, strict matching

### Phase 2: Compliance System, Candidate Prioritization, Interaction Fix, Employer Onboarding, Desktop Swipe, Offer Guardrails, Tiered Matching, Structured Pay, Card Polish, Quality Gates, Prior Features
- (See previous versions for full detail)

## Test Accounts
| Role | Email | Password |
|---|---|---|
| Seeker | seeker_test@vitalamatch.com | test123 |
| Employer | employer_test@vitalamatch.com | test123 |
| New Employer | new_employer_test@vitalamatch.com | test123 |
| Test Seeker | testseeker@test.com | test123 |
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
