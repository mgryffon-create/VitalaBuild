# VitalaMatch — Product Requirements Document

## Original Problem Statement
Healthcare hiring platform matching pros with employers, featuring bidirectional matching, worker protection, and structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI

## What's Been Implemented

### Phase 2: Preferences Tab Fixes (April 2025)
- **Location Autocomplete**: Replaced raw text input with searchable typeahead (LocationAutocomplete.jsx) suggesting ~200 US cities in "City, ST" format. Supports chips, keyboard nav, and multiple selections.
- **ResizeObserver Fix**: Improved global error suppression in index.js to catch both "completed" and "limit exceeded" variants.
- **SeekerProfile Model Fix**: Added missing fields (education, full_name, license_number, etc.) and `extra='ignore'` to prevent 422 errors on save.

### Phase 2: Single-Type Document Upload (April 2025)
- One upload = one type with radio-style single-select. Medical exception: post-upload dialog for related sibling types only.

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
