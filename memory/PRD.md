# VitalaMatch — Product Requirements Document

## Original Problem Statement
Healthcare hiring platform matching pros with employers, featuring bidirectional matching, worker protection, and structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI
- **AI:** GPT-4.1 vision (emergentintegrations) for resume parsing + document verification

## What's Been Implemented

### Phase 2: Acceptance Flow Fix (April 2025)
- **Root cause**: modal showed both "Accept Candidate" and disabled "Accept to message" — duplicate acceptance concepts
- **Fix**: stage-based state machine rendering in modal footer:
  - interested → "Accept Candidate" only
  - matched/interviewing → "Message" + "Send Offer"
  - offer_sent → "Message" + "Start Onboarding"
  - hired → "Message" only
- **No disabled "Accept to message"** button — removed entirely
- **Single canonical flow**: Accept → Match created → pipeline synced → messaging enabled

### Phase 2: All Prior Features
- UI layout fix, role eligibility, state sync, vault verification, document validation, compliance, candidate prioritization, interaction fix, employer onboarding, desktop swipe, offer guardrails, tiered matching, structured pay, quality gates

## Test Accounts
| Role | Email | Password | Role Category |
|---|---|---|---|
| Seeker | seeker_test@vitalamatch.com | test123 | RN |
| Employer | employer_test@vitalamatch.com | test123 | — |
| New Employer | new_employer_test@vitalamatch.com | test123 | — |
| Test Seeker | testseeker@test.com | test123 | RN |
| Admin | admin@vitalamatch.com | admin123 | — |

## Prioritized Backlog
### P1
- Seeker profile Role Category selector
- Interview Scheduling Integration
- Pipeline Analytics Dashboard
### P2
- Post-assignment feedback UI, Facility accountability dashboard
### Refactoring
- Extract server.py logic, break down ProfileBuilder.jsx
### Mocked
- SendGrid (logged to DB), Twilio SMS (disabled), Nursys API (disabled)
