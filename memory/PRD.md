# VitalaMatch — Product Requirements Document

## Original Problem Statement
Healthcare hiring platform matching pros with employers, featuring bidirectional matching, worker protection, and structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI

## What's Been Implemented

### Phase 2: Candidate Prioritization (April 2025)
- **Backend**: `_pipeline_match()` in pipeline.py calculates match_tier, match_reasons, compatibility_score per candidate
- **Sorting**: strong matches first, then possible, then null; secondary by score descending
- **Card badges**: "Strong" (green) / "Possible" (amber) in top-right of pipeline cards
- **Match reasons**: 1-2 teal reason lines below specialty on each card
- **Visual highlight**: green border for strong matches
- **Modal**: badge + reasons with checkmark icons shown in profile modal

### Phase 2: Employer Candidate Interaction Fix (April 2025)
- Click → profile modal (no auto-progression), stage-aware actions, confirmation dialogs, messaging gating

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
