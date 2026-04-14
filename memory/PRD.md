# VitalaMatch — Product Requirements Document

## Original Problem Statement
Healthcare hiring platform matching pros with employers, featuring bidirectional matching, worker protection, and structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI

## What's Been Implemented

### Phase 2: Employer Candidate Interaction Fix (April 2025)
- **Click → Profile Modal**: pipeline cards open a CandidateProfileModal (no auto-progression)
- **Stage-aware actions**: Applicants get "Accept Candidate" + disabled "Accept to message"; Matches get "Message" + "Send Offer"; Offers get "Message" + "Start Onboarding"
- **Confirmation dialogs**: AlertDialog required before any stage advancement
- **Messaging gating**: unmatched candidates see "Accept this candidate to start messaging" with disabled input; templates hidden
- **Error handling**: specific errors (409 conflict, 404 not found, 403 unauthorized, connection issue)
- **Double-action prevention**: buttons disabled during API calls
- **Backend fix**: MongoDB projection error in /api/pipeline/nudges (mixed inclusion/exclusion)

### Phase 2: Employer Onboarding Flow (April 2025)
- 3-step flow: intro → profile → job creation; EmployerOnboardingGate on poster routes

### Phase 2: Desktop Swipe Layout + Experience (April 2025)
- Flex column layout, reserved action bar, wider cards, 3-card stack, enlarged buttons

### Phase 2: Offer Acceptance Guardrails (April 2025)
- Conflict detection, hard blocks + soft warnings, 409 acceptance blocking

### Phase 2: Tiered Matching, Structured Pay, Card Polish, Quality Gates, Prior Features
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
