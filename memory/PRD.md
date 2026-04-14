# VitalaMatch — Product Requirements Document

## Original Problem Statement
Healthcare hiring platform matching pros with employers, featuring bidirectional matching, worker protection, and structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI
- **AI:** GPT-4.1 vision (emergentintegrations) for resume parsing + document verification

## What's Been Implemented

### Phase 2: UI Layout Regression Fix (April 2025)
- **Root cause**: `lg:flex-col` wrapper with `flex-1` on card area created dead space or overlap depending on viewport
- **Fix**: removed flex wrapper, normal document flow with minHeight for mobile, card heights responsive to viewport
- **Result**: all 4 action buttons (Undo, Pass, Details, Interested) fully visible and clickable at all viewports
- **Role eligibility logic untouched**

### Phase 2: Strict Role Eligibility System (April 2025)
- Shared eligibility service, 13 canonical roles, hard-filter in ALL code paths, job + seeker role fields, migration

### Phase 2: State Sync, Vault Verification, Document Validation, Compliance, Prioritization, Interaction Fix, Onboarding, Desktop Swipe, Offer Guardrails, Tiered Matching, Structured Pay, Card Polish, Quality Gates, Prior Features
- (See previous versions)

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
