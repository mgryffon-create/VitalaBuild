# VitalaMatch — Product Requirements Document

## Original Problem Statement
Healthcare hiring platform matching pros with employers, featuring bidirectional matching, worker protection, and structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI

## What's Been Implemented

### Phase 2: ResizeObserver Root Cause Fix — REAL FIX (April 2025)
- **Root cause**: `SelectContent` in `select.jsx` defaulted to `position="popper"`, which invoked Radix's internal `SelectPopperPosition` → `@radix-ui/react-popper` → `@floating-ui/dom` → creates `ResizeObserver` for autoUpdate positioning. This ResizeObserver created a measurement→resize→measurement feedback loop when dropdown opened.
- **Fix**: Changed default from `position="popper"` to `position="item-aligned"`. This uses Radix's native `SelectItemAlignedPosition` which positions the dropdown aligned to items WITHOUT floating-ui or ResizeObserver. Zero dynamic CSS variables. Zero measurement loops.
- **Removed**: All dynamic CSS variables (`--radix-select-content-available-height`, `--radix-select-trigger-height`, `--radix-select-content-transform-origin`), popper-specific translate classes, and the global error suppression from `index.js`
- **Component chain**: `ProfileBuilder.jsx` → `<Select>` → `<SelectContent>` (select.jsx) → `SelectPrimitive.Content` (radix) → now uses `SelectItemAlignedPosition` (no ResizeObserver) instead of `SelectPopperPosition` (ResizeObserver)
- **Verified**: All 5 dropdowns (Specialty, Availability, Shift, Job Type, Travel Readiness) open/select/close with zero errors captured via comprehensive error tracking (window error events, onerror, console.error — all capture phase, no suppression)

### Phase 2: Preferences Tab — Location Autocomplete (April 2025)
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
