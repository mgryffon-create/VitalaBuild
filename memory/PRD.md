# VitalaMatch — Product Requirements Document

## Original Problem Statement
Healthcare hiring platform matching pros with employers, featuring bidirectional matching, worker protection, and structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI

## What's Been Implemented

### Phase 2: Mandatory Onboarding Flow (April 2025)
- **Backend**: `GET /api/profile/completion` returns `{complete, percentage, filled, total, checks}` — 8 checks for seekers, 5 for posters
- **OnboardingGate.jsx**: HOC wrapping gated routes; blocks incomplete profiles with a progress card + checklist + CTA
- **Gated routes**: `/seeker/swipe`, `/seeker/offers`, `/poster/candidates`, `/poster/offers-sent`, `/matches`
- **Dashboard progress bars**: Both SeekerDashboard and PosterDashboard render API-driven completion bars
- **Bug fixed**: SeekerDashboard.jsx had a duplicate `const profileCompletion` (useState + computed) causing SyntaxError — resolved by using API state as single source of truth

### Phase 2: Bidirectional Matching & Worker Protection — Phase A (April 2025)
- **Worker Preferences (7 fields)**: schedule_stability_importance, overtime_preference, overtime_pressure_tolerance, shift_cancellation_tolerance, staffing_tolerance, floating_tolerance, pay_transparency_importance
- **Facility Profile (6 fields)**: staffing_expectation, floating_expectation, schedule_structure, overtime_policy, cancellation_policy, contract_accuracy_confidence
- **Assignment Feedback**: 9-metric structured review system
- **Aggregated Metrics**: Trust score (0-100, weighted composite), per-dimension scores
- **Signal System**: Auto-generated positive (>=70) and caution (<=40) signals
- **Trust Badges**: Dynamic badges from verified data (requires 3+ feedbacks, >=75 threshold)
- **Bidirectional Matching**: Candidate Fit Score + Facility Fit Score
- Backend: `/app/backend/routes/matching.py`

### Phase 2: Browse Pros & Tiered Matching (April 2025)
- Tiered matching (Strong/Possible/Hidden), job-based ranking, filter refinement
- Pro Profile View, Express interest -> Applicants pipeline

### Phase 2: UX Overhaul (April 2025)
- Navigation, Hiring Flow (Applicants->Matches->Offers->Onboarding), terminology, mobile UX

### Phase 1: Core Features (March-April 2025)
- Stripe Billing, OpenAI Resume Parser, Portable References, Document Vault, Compliance

## Test Accounts
| Role | Email | Password |
|---|---|---|
| Seeker | seeker_test@vitalamatch.com | test123 |
| Employer | employer_test@vitalamatch.com | test123 |
| Admin | admin@vitalamatch.com | admin123 |

## Prioritized Backlog

### P0 — COMPLETED
- Mandatory Onboarding Flow (profile completion gating)

### P1 — Phase B (Matching System)
- Integrate facility signals into seeker job cards ("What Travelers Report")
- Integrate candidate fit score into job swipe page
- Worker protection warnings on job cards
- Facility profile completion gating (block viewing full profiles / sending offers)
- Interview Scheduling Integration
- Pipeline Analytics Dashboard for Employers

### P2 — Phase C-D
- Post-assignment feedback UI (midpoint check-in + completion review)
- Facility accountability dashboard UI
- Feedback loop: flag mismatches for admin review

### Refactoring (Low Priority)
- Extract heavy logic from server.py into service modules
- Break down ProfileBuilder.jsx (1500+ lines) into sub-components

### Mocked
- SendGrid (logged to DB), Twilio SMS (disabled), Nursys API (disabled)
