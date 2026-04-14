# VitalaMatch — Product Requirements Document

## Original Problem Statement
Healthcare hiring platform matching pros with employers, featuring bidirectional matching, worker protection, and structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI
- **AI:** GPT-4.1 vision (emergentintegrations) for resume parsing + document verification

## What's Been Implemented

### Phase 2: Hiring Flow UX Overhaul (April 2025)
- **Profile Preview Modal**: Read-first design — card click opens modal with NO backend mutations
- **State-driven action buttons**: Strictly derived from canonical state machine
  - interested → Accept Candidate (primary) + Pass (secondary)
  - matched → Message (primary) + Send Offer (secondary)
  - interviewing → Message (primary) + Send Offer (secondary)
  - offer_sent → Message (primary) + View Offer (secondary)
  - hired → Message only
  - Invalid actions HIDDEN, not disabled
- **Contextual onboarding guidance**: State-aware inline reminder banners (ONE per candidate)
  - interested → "Review candidate and accept to start conversation"
  - matched (0 msgs) → "Start the conversation to move forward"
  - matched/interviewing → "Next step: message, interview, or send offer"
  - interviewing (no offer) → "Ready to move forward? Send an offer"
  - offer_sent → "Waiting on candidate response"
- **Pass/Reject flow**: Confirmation dialog, moves to "passed" stage, removes from pipeline
- **Enriched candidate data**: certifications, vault categories, messages count, pay range, shift type
- **Actionable error messages**: "Candidate already matched", "Candidate no longer available", "Action not allowed in current stage", "Server error — please retry"
- **Backend stage validation**: Prevents backward movement, duplicate stage, role eligibility checks

### Phase 2: All Prior Features
- Acceptance flow fix, UI layout fix, role eligibility, state sync, vault verification, document validation, compliance, candidate prioritization, interaction fix, employer onboarding, desktop swipe, offer guardrails, tiered matching, structured pay, quality gates, messaging composer fix

## Test Accounts
| Role | Email | Password | Role Category |
|---|---|---|---|
| Seeker | seeker_test@vitalamatch.com | test123 | RN |
| Employer | employer_test@vitalamatch.com | test123 | — |
| New Employer | new_employer_test@vitalamatch.com | test123 | — |
| Test Seeker | testseeker@test.com | test123 | RN |
| Admin | admin@vitalamatch.com | admin123 | — |

## Prioritized Backlog
### P0
- Seeker profile Role Category selector (normalized_role_category dropdown in ProfileBuilder.jsx)
### P1
- Interview Scheduling Integration
- Pipeline Analytics Dashboard for Employers
### P2
- Post-assignment feedback UI, Facility accountability dashboard
### Refactoring
- Extract server.py logic, break down ProfileBuilder.jsx (>1600 lines)
### Mocked
- SendGrid (logged to DB), Twilio SMS (disabled), Nursys API (disabled)
