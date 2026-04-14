# VitalaMatch — Product Requirements Document

## Original Problem Statement
Healthcare hiring platform matching pros with employers, featuring bidirectional matching, worker protection, and structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI

## What's Been Implemented

### Phase 2: Employer Onboarding Flow (April 2025)
- **3-step flow**: intro slides (3 slides) → profile form (name, org type, location, description) → redirect to job creation
- **EmployerOnboardingGate**: wraps all /poster/* routes except /poster/onboarding, /poster/jobs/new, /poster/profile
- **Completion logic**: profile saved AND at least 1 valid job posted → dashboard unlocked
- **Backend**: PosterProfile model accepts org_type; existing profile/completion endpoint handles checks
- **Job quality**: enforced by existing JobFormPage quality gates (structured pay, 9 required fields, pay range validation)
- **Dashboard**: 0-jobs state shows "Post your first job to start receiving candidates"

### Phase 2: Desktop Swipe Layout Fix (April 2025)
- Flex column layout, reserved action bar, buttons guaranteed visible

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
