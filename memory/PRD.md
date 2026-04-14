# VitalaMatch — Product Requirements Document

## Original Problem Statement
Healthcare hiring platform matching pros with employers, featuring bidirectional matching, worker protection, and structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI
- **AI:** GPT-4.1 vision (emergentintegrations) for resume parsing + document expiration verification

## What's Been Implemented

### Phase 2: Vault Verification — Expiration Date Parsing (April 2025)
- **GPT-4.1 vision extraction**: background task extracts expiration date from uploaded document images/PDFs
- **Verification statuses**: verified (match), mismatch (conflict), unverified (parse failed), expired, pending
- **Compliance integration**: mismatch/expired/missing_expiration NEVER satisfy compliance; verified and unverified (valid user entry) DO satisfy
- **Date tolerance**: 31-day tolerance for month-level precision matching
- **Frontend badges**: Verified (green), Mismatch (red + note), Unverified (blue), Verifying... (blue), Expired (red)
- **Onboarding matching**: match_vault_document returns flagged_issue for mismatch docs

### Phase 2: Document Vault Validation (April 2025)
- Expirable types blocked without expiration, expired docs allowed for recordkeeping, compliance_status computation

### Phase 2: Compliance System Overhaul (April 2025)
- Baseline requirements, job-specific requirements, onboarding progress, auto-match

### Phase 2: All Prior Features
- Candidate prioritization, interaction fix, employer onboarding, desktop swipe, offer guardrails, tiered matching, structured pay, card polish, quality gates, document vault, resume parsing

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
