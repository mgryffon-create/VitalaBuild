# VitalaMatch — Product Requirements Document

## Original Problem Statement
Build a healthcare hiring platform matching pros (healthcare workers) with employers, featuring swipe-based job matching, credential management, and a structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI

## What's Been Implemented

### Phase 2: Structured Profile Data (April 2025)
- **New seeker profile fields**: availability, preferred_shift, travel_readiness, job_type_preference, experience_highlights (list), skills (list)
- **Seeker profile form**: New sections — Availability & Shift (dropdowns), Experience Highlights (bullet input, 3-5 items), Clinical Skills (tag input), Work Type & Travel (dropdowns)
- **Browse Pros**: Uses structured data for availability badges, highlights, licenses vs certifications, work preferences
- **Pro Profile View**: Full-screen profile with structured sections — Identity, Summary, Highlights, Licenses & Certs, Verification, Work Preferences

### Phase 2: Browse Pros & Tiered Matching (April 2025)
- Tiered matching: Strong Match / Possible Match / Hidden
- Job-based ranking with context reasons
- Filter refinement layer (specialty, location, experience, shift, certification)
- Express interest → Applicants pipeline integration
- Job picker dialog for multi-job employers

### Phase 2: UX Overhaul (April 2025)
- Navigation grouped: Home, Source Talent, Hiring Flow, Job Management, Account
- Hiring Flow: Applicants → Matches → Offers → Onboarding
- Dashboard: Jobs Snapshot + Hiring Flow metrics (exclusive stage counts)
- Terminology: Pros, Applicants, Matches, Offers, Onboarding
- Mobile: Bottom nav, sticky actions, sign-out button

### Phase 1: Core Features (March-April 2025)
- Stripe Billing, OpenAI Resume Parser, Portable References
- Document Vault, Compliance Scores, Training & Compliance
- Conditional Offers/Onboarding, Legal pages, Admin panel

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
- Interview scheduling
- Pipeline analytics dashboard

### P2
- Live SendGrid, Calendly/Zoom integration

### Mocked
- SendGrid (logged to DB), Twilio SMS (disabled), Nursys API (disabled)
