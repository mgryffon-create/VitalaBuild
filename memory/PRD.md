# VitalaMatch — Product Requirements Document

## Original Problem Statement
Healthcare hiring platform matching pros with employers, featuring bidirectional matching, worker protection, and structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI

## What's Been Implemented

### Phase 2: Post-Login Routing Fix (April 2025)
- **RedirectIfAuth wrapper**: Public routes (`/`, `/auth`) auto-redirect authenticated users to their role-based dashboard
- **No landing page flash**: Auth state checked before rendering public pages
- Seeker → `/seeker`, Employer → `/poster`, Admin → `/admin/onboarding`

### Phase 2: Mandatory Onboarding Flow (April 2025)
- **Backend**: `GET /api/profile/completion` returns `{complete, percentage, filled, total, checks}` — 8 checks for seekers, 5 for posters
- **OnboardingGate.jsx**: HOC wrapping gated routes; blocks incomplete profiles with a progress card + checklist + CTA
- **Gated routes**: `/seeker/swipe`, `/seeker/offers`, `/poster/candidates`, `/poster/offers-sent`, `/matches`
- **Dashboard progress bars**: Both SeekerDashboard and PosterDashboard render API-driven completion bars

### Phase 2: Bidirectional Matching & Worker Protection — Phase A (April 2025)
- Worker Preferences (7 fields), Facility Profile (6 fields), Assignment Feedback (9-metric)
- Aggregated Metrics, Signal System, Trust Badges, Bidirectional Matching
- Backend: `/app/backend/routes/matching.py`

### Phase 2: Browse Pros & Tiered Matching (April 2025)
- Tiered matching (Strong/Possible/Hidden), filter refinement, Pro Profile View, Express interest pipeline

### Phase 2: UX Overhaul (April 2025)
- Navigation, Hiring Flow (Applicants→Matches→Offers→Onboarding), terminology, mobile UX

### Phase 1: Core Features (March-April 2025)
- Stripe Billing, OpenAI Resume Parser, Portable References, Document Vault, Compliance

## Test Accounts
| Role | Email | Password |
|---|---|---|
| Seeker | seeker_test@vitalamatch.com | test123 |
| Employer | employer_test@vitalamatch.com | test123 |
| Admin | admin@vitalamatch.com | admin123 |

## Prioritized Backlog

### P1 — Next Up
- Interview Scheduling Integration
- Pipeline Analytics Dashboard for Employers
- Integrate facility signals into seeker job cards ("What Travelers Report")
- Integrate candidate fit score into job swipe page

### P2 — Phase C-D
- Post-assignment feedback UI (midpoint check-in + completion review)
- Facility accountability dashboard UI
- Feedback loop: flag mismatches for admin review

### Refactoring (Low Priority)
- Extract heavy logic from server.py into service modules
- Break down ProfileBuilder.jsx (1500+ lines) into sub-components

### Mocked
- SendGrid (logged to DB), Twilio SMS (disabled), Nursys API (disabled)
