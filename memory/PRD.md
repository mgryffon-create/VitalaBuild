# VitalaMatch — Product Requirements Document

## Original Problem Statement
Healthcare hiring platform matching pros with employers, featuring bidirectional matching, worker protection, and structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI

## What's Been Implemented

### Phase 2: ResizeObserver Root Cause Fix (April 2025)
- **Root cause**: Radix Select's `SelectContent` used dynamic CSS variables (`--radix-select-content-available-height`, `--radix-select-trigger-height`) set by internal ResizeObserver, creating a measurement→resize→measurement feedback loop
- **Fix**: Modified `/app/frontend/src/components/ui/select.jsx` — replaced `max-h-[--radix-select-content-available-height]` with static `max-h-96`, removed `h-[var(--radix-select-trigger-height)]` from Viewport, removed `origin-[--radix-select-content-transform-origin]`
- **Removed** global error suppression from `index.js` — no longer needed since root cause is fixed
- Verified all dropdowns (Specialty, Availability, Shift, Job Type, Travel Readiness) work without errors

### Phase 2: Preferences Tab Fixes (April 2025)
- LocationAutocomplete with ~200 US cities in "City, ST" format
- SeekerProfile model fix (missing fields + extra='ignore')

### Phase 2: Single-Type Document Upload (April 2025)
- One upload = one type, medical exception for related sibling types

### Phase 2: Structured Document Upload System (April 2025)
- 3-step category-first wizard, 5 categories, Medical split into Vaccinations + TB/Clearance

### Phase 2: Post-Login Routing Fix (April 2025)
- RedirectIfAuth wrapper on `/` and `/auth`

### Phase 2: Mandatory Onboarding Flow (April 2025)
- GET /api/profile/completion, OnboardingGate.jsx, dashboard progress bars

### Phase 2: Bidirectional Matching & Worker Protection — Phase A (April 2025)
- Worker Preferences, Facility Profile, Feedback, Trust Scores, Signals, Badges

### Phase 2: Browse Pros & Tiered Matching (April 2025)
- Tiered matching, filter refinement, Pro Profile View

### Phase 2: UX Overhaul (April 2025)
- Navigation, Hiring Flow terminology, mobile UX

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
- Integrate facility signals into seeker job cards

### P2 — Phase C-D
- Post-assignment feedback UI
- Facility accountability dashboard UI
- Feedback loop: flag mismatches for admin review

### Refactoring (Low Priority)
- Extract heavy logic from server.py into service modules
- Break down ProfileBuilder.jsx (1500+ lines) into sub-components

### Mocked
- SendGrid (logged to DB), Twilio SMS (disabled), Nursys API (disabled)
