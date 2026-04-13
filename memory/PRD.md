# VitalaMatch — Product Requirements Document

## Original Problem Statement
Healthcare hiring platform matching pros with employers, featuring bidirectional matching, worker protection, and structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI

## What's Been Implemented

### Phase 2: UX Polish — AI Language Removal + Specialty Autocomplete (April 2025)
- **AI language removed**: "Analyzing your resume with AI" → "Getting your profile ready...", "Parsing..." → "Reading...", "Resume Parsed — Review Extracted Data" → "We found this from your resume", "Apply to Profile" → "Add to Profile"
- **Specialty autocomplete**: Replaced dropdown with searchable typeahead (`SpecialtyAutocomplete.jsx`). Displays formatted names: "ICU/Critical Care (RN)" instead of "Registered Nurse (RN) - ICU/Critical Care". Chip display, clear button, keyboard nav.
- **Resume review hierarchy**: Work History emphasized (bordered cards), Name/Specialty compact row, Bio de-emphasized italic
- **Label update**: "Key Responsibilities" → "What did you do?"

### Phase 2: Resume Upload Auth Fix + Review Step (April 2025)
- Fixed auth bug (explicit Content-Type removed), switched to AI parser endpoint, added review dialog

### Phase 2: Experience Highlights & Clinical Skills Autocomplete (April 2025)
- SuggestionInput with specialty-based suggestions

### Phase 2: ResizeObserver Root Cause Fix (April 2025)
- SelectContent changed to `position="item-aligned"`

### Phase 2: Preferences Tab — Location Autocomplete (April 2025)
- LocationAutocomplete with ~200 US cities

### Phase 2: Document Upload, Routing, Onboarding, Matching, UX
- Single-type document upload, structured categories, RedirectIfAuth, OnboardingGate, tiered matching

### Phase 1: Core Features (March-April 2025)
- Stripe Billing, OpenAI Resume Parser, Portable References, Document Vault, Compliance

## Test Accounts
| Role | Email | Password |
|---|---|---|
| Seeker | seeker_test@vitalamatch.com | test123 |
| Employer | employer_test@vitalamatch.com | test123 |
| Admin | admin@vitalamatch.com | admin123 |

## Prioritized Backlog
### P1
- Interview Scheduling Integration
- Pipeline Analytics Dashboard for Employers
- Integrate facility signals into seeker job cards
### P2
- Post-assignment feedback UI, Facility accountability dashboard
### Refactoring
- Extract server.py logic, break down ProfileBuilder.jsx
### Mocked
- SendGrid (logged to DB), Twilio SMS (disabled), Nursys API (disabled)
