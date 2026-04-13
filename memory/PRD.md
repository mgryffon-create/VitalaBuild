# VitalaMatch — Product Requirements Document

## Original Problem Statement
Healthcare hiring platform matching pros with employers, featuring bidirectional matching, worker protection, and structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI

## What's Been Implemented

### Phase 2: Structured Pay System (April 2025)
- **Structured pay fields**: base_rate, guaranteed_hours, weekly_stipend, overtime_rate, weekly_pay, job_type, stipend, weekly_hours
- Backend Pydantic models (JobPosting + JobPostingResponse) updated to persist and return all fields
- JobFormPage: 4-field pay grid (Base Rate, Hours/Week, Weekly Stipend, OT Rate) with auto-calculated Weekly Pay
- Pay range validation by role (CNA/LPN/RN/NP) with out-of-range warning + acknowledgment
- SwipePage: Pay-first card hierarchy — weekly pay in green, hourly breakdown, match score badge
- Rewind/Undo button on swipe cards (single undo, resets after use)

### Phase 2: Job Posting Quality Gate (April 2025)
- 9 required fields: title (non-weak), specialty, location, description (150+), shift, pay (>$0), job type, experience, start date
- Travel/contract extras: +duration, +stipend/housing (11 total)
- Publish disabled until all required fields complete
- Structured inputs: Specialty, Location, Certifications (autocomplete)
- Weak title detection with auto-generation
- Section-level errors in progress tracker

### Phase 2: Job Card Redesign (April 2025)
- Pay-first hierarchy, smart title, match score badge, quick detail chips, action buttons with labels

### Phase 2: Document Vault Organization (April 2025)
- Category tabs, human labels, single status, dedup, replace flow, preview fix

### Phase 2: All Prior Features
- Global autocomplete, work history editing, vault-as-source-of-truth, UX polish, resume upload, matching, onboarding

## Test Accounts
| Role | Email | Password |
|---|---|---|
| Seeker | seeker_test@vitalamatch.com | test123 |
| Employer | employer_test@vitalamatch.com | test123 |
| Admin | admin@vitalamatch.com | admin123 |

## Prioritized Backlog
### P1
- Interview Scheduling Integration
- Pipeline Analytics Dashboard
- Facility signals in seeker job cards
### P2
- Post-assignment feedback UI, Facility accountability dashboard
### Refactoring
- Extract server.py logic, break down ProfileBuilder.jsx
### Mocked
- SendGrid (logged to DB), Twilio SMS (disabled), Nursys API (disabled)
