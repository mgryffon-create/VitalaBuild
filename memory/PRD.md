# VitalaMatch — Product Requirements Document

## Original Problem Statement
Healthcare hiring platform matching pros with employers, featuring bidirectional matching, worker protection, and structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI

## What's Been Implemented

### Phase 2: Resume Upload Auth Fix + Review Step (April 2025)
- **Auth bug root cause**: Explicit `Content-Type: multipart/form-data` header in axios replaced the headers config, preventing the interceptor from adding the Authorization bearer token. Fix: removed explicit Content-Type (axios auto-detects from FormData).
- **Endpoint switch**: Changed from `/api/profile/parse-resume` (regex-only) to `/api/resume/parse/upload` (GPT-4.1 AI parser with structured extraction)
- **Review step**: After AI parsing, shows review dialog with extracted Name, Specialty, Work History (with detail), Skills (as chips), Certifications, Licenses, Bio. User clicks "Apply to Profile" or "Discard"
- **Parsing architecture**: Hybrid — PyMuPDF/python-docx for text extraction → GPT-4.1 for structured JSON extraction (employment_groups, skills with confidence, certifications, licenses, education)
- **Fields prefilled**: full_name, specialty, work_history, skills, certifications, licenses, bio, education, contact_info, experience_highlights

### Phase 2: Experience Highlights & Clinical Skills Autocomplete (April 2025)
- SuggestionInput with specialty-based suggestions, search typeahead, custom entry, duplicate prevention

### Phase 2: ResizeObserver Root Cause Fix (April 2025)
- SelectContent changed to `position="item-aligned"` (no floating-ui/ResizeObserver)

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

### P1 — Next Up
- Interview Scheduling Integration
- Pipeline Analytics Dashboard for Employers
- Integrate facility signals into seeker job cards

### P2
- Post-assignment feedback UI
- Facility accountability dashboard UI

### Refactoring
- Extract heavy logic from server.py
- Break down ProfileBuilder.jsx

### Mocked
- SendGrid (logged to DB), Twilio SMS (disabled), Nursys API (disabled)
