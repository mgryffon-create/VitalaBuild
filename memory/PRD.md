# VitalaMatch — Product Requirements Document

## Original Problem Statement
Healthcare hiring platform matching pros with employers, featuring bidirectional matching, worker protection, and structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI

## What's Been Implemented

### Phase 2: Desktop Swipe Layout Fix (April 2025)
- Flex column layout on desktop: `lg:flex lg:flex-col lg:h-[calc(100vh-160px)]`
- Card stack uses `lg:flex-1 lg:overflow-hidden` to constrain height within flex
- Action bar uses `lg:shrink-0 lg:pt-5 lg:pb-2` — guaranteed visible, never clipped
- Card height: `lg:h-[min(440px,calc(100vh-300px))]` — substantial but leaves room for buttons
- Verified: all 4 buttons + labels bottom < 742px in 800px viewport

### Phase 2: Desktop Swipe Experience (April 2025)
- Container max-w-2xl on desktop, 3-card stack, enlarged buttons, scaled text, shadow depth

### Phase 2: Offer Acceptance Guardrails (April 2025)
- Conflict detection, hard blocks + soft warnings, 409 acceptance blocking, enriched employment records

### Phase 2: Card Polish, Tiered Matching, Structured Pay, Quality Gates, Prior Features
- (See previous versions for full detail)

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
