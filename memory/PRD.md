# VitalaMatch — Product Requirements Document

## Original Problem Statement
Build a healthcare hiring platform matching pros (healthcare workers) with employers, featuring swipe-based job matching, credential management, and a structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers in `/app/backend/routes/`
- **Frontend:** React + Tailwind CSS + Shadcn UI
- **Shared config:** `/app/backend/shared.py`

## What's Been Implemented

### Phase 2: Browse Pros → Hiring Flow Integration (April 2025)
- **Browse Pros page** (`/poster/candidates`): Card-based pro discovery with Pass/Interested actions
- **Job picker dialog**: When employer has multiple jobs, prompts to select which job the interest is for
- **Backend endpoints**: `GET /api/employer/browse-pros`, `POST /api/employer/express-interest`, `POST /api/employer/browse-pass`
- **Pipeline integration**: Interested pros flow into Applicants stage of the Hiring Flow
- **Deduplication**: Prevents duplicate applicant records; passed/interested pros removed from future browse

### Phase 2: UX Overhaul (April 2025)
- **Navigation**: Grouped sidebar (Home, Source Talent, Hiring Flow, Job Management, Account)
- **Hiring Flow**: Applicants → Matches → Offers → Onboarding (Interviewing hidden, merged into Matches)
- **Dashboard**: Jobs Snapshot separated from Hiring Flow metrics; exclusive stage counts
- **Terminology**: Pros (all users), Applicants, Matches, Offers, Onboarding — no overlapping terms
- **Mobile**: Bottom nav (5 tabs), sticky action buttons on swipe/browse pages, sign-out in header

### Phase 1: Core Features (March-April 2025)
- Stripe Billing (Free/Growth/Pro/Enterprise tiers), OpenAI Resume Parser
- Portable References with email verification, Document Vault
- Compliance Scores, Training & Compliance, Conditional Offers/Onboarding
- Backend refactored into modular routers, Legal pages, Admin panel

## Test Accounts
| Role | Email | Password |
|---|---|---|
| Seeker | seeker_test@vitalamatch.com | test123 |
| Employer | employer_test@vitalamatch.com | test123 |
| Admin | admin@vitalamatch.com | admin123 |

## Prioritized Backlog

### P0
- Enforce strict user onboarding flow (block seekers until profile complete)

### P1
- Dedicated pro profile view page for employers
- Interview scheduling (resurface Interviewing stage)

### P2
- Pipeline analytics dashboard
- Live SendGrid, Calendly/Zoom integration

### Mocked Integrations
- SendGrid emails (logged to DB), Twilio SMS (disabled), Nursys API (disabled)
