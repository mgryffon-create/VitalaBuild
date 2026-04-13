# VitalaMatch — Product Requirements Document

## Original Problem Statement
Healthcare hiring platform matching pros with employers, featuring bidirectional matching, worker protection, and structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI

## What's Been Implemented

### Phase 2: Single-Type Document Upload (April 2025)
- **One upload = one type**: Radio-style single-select buttons in type step; clicking auto-advances to file step
- **No global multi-select**: Checkboxes removed from standard upload flow on both DocumentsPage and VaultPage
- **Medical exception**: After uploading a medical document, optional post-upload dialog asks "Does this file also cover other records?" limited to related sibling types from the same group only (Vaccinations ↔ Vaccinations, TB ↔ TB)
- **Non-medical categories**: Upload completes without any post-upload tag dialog

### Phase 2: Structured Document Upload System (April 2025)
- 3-step category-first wizard (Category → Type → File) on both DocumentsPage and VaultPage
- 5 categories: Medical Documents, Certifications, Identification, Licenses, Compliance Documents
- Medical Documents split into Vaccinations (7 types) and TB/Medical Clearance (4 types)
- Searchable type filtering within categories
- Backend: `document_category` and `document_tags` fields in DocumentUpload model

### Phase 2: Post-Login Routing Fix (April 2025)
- RedirectIfAuth wrapper on `/` and `/auth`

### Phase 2: Mandatory Onboarding Flow (April 2025)
- GET /api/profile/completion endpoint, OnboardingGate.jsx, dashboard progress bars

### Phase 2: Bidirectional Matching & Worker Protection — Phase A (April 2025)
- Worker Preferences, Facility Profile, Assignment Feedback, Trust Scores, Signals, Badges

### Phase 2: Browse Pros & Tiered Matching (April 2025)
- Tiered matching, filter refinement, Pro Profile View, Express interest pipeline

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
