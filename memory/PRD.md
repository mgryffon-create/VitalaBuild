# VitalaMatch — Product Requirements Document

## Original Problem Statement
Healthcare hiring platform matching pros with employers, featuring bidirectional matching, worker protection, and structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI

## What's Been Implemented

### Phase 2: Experience Highlights & Clinical Skills Autocomplete (April 2025)
- **SuggestionInput component**: Reusable typeahead with quick-tap specialty chips, search dropdown, custom entry, duplicate prevention
- **Specialty-based suggestions**: `specialtySuggestions.js` maps 30+ specialty keywords to relevant highlights and skills
- **Experience Highlights**: Max 5, suggested from specialty, searchable, custom entry allowed
- **Clinical Skills**: Max 15, suggested from specialty, searchable, custom entry allowed
- Quick-tap chips show "Suggested for your specialty" when input is empty; hide when typing

### Phase 2: ResizeObserver Root Cause Fix (April 2025)
- Changed SelectContent from `position="popper"` (floating-ui + ResizeObserver) to `position="item-aligned"` (native Radix, no ResizeObserver)
- Removed global error suppression from index.js

### Phase 2: Preferences Tab — Location Autocomplete (April 2025)
- LocationAutocomplete with ~200 US cities in "City, ST" format

### Phase 2: Single-Type Document Upload (April 2025)
- One upload = one type, medical exception for related sibling types

### Phase 2: Structured Document Upload System (April 2025)
- 3-step category-first wizard, 5 categories, Medical split into Vaccinations + TB/Clearance

### Phase 2: Post-Login Routing, Onboarding Flow, Matching, UX (April 2025)
- RedirectIfAuth, OnboardingGate, Tiered matching, Browse Pros, Hiring Flow terminology

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

### Refactoring (Low Priority)
- Extract heavy logic from server.py into service modules
- Break down ProfileBuilder.jsx into sub-components

### Mocked
- SendGrid (logged to DB), Twilio SMS (disabled), Nursys API (disabled)
