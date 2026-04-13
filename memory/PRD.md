# VitalaMatch — Product Requirements Document

## Original Problem Statement
Healthcare hiring platform matching pros with employers, featuring bidirectional matching, worker protection, and structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI

## What's Been Implemented

### Phase 2: Structured Document Upload System (April 2025)
- **Category-first upload flow**: 3-step wizard (Category → Searchable Types → File) on both DocumentsPage and VaultPage
- **5 categories**: Medical Documents, Certifications, Identification, Licenses, Compliance Documents
- **Medical Documents** split into two groups:
  - **Vaccinations**: COVID-19, Influenza, Hep B, MMR, Varicella, Tdap, Other
  - **TB / Medical Clearance**: PPD, Quantiferon, Chest X-Ray, Physical Exam
- **Multi-tag support**: Single file can be tagged with multiple document types
- **Searchable type filtering**: Input search within selected category
- **Backend**: `document_category` and `document_tags` fields added to DocumentUpload model; vault categories endpoint returns grouped structure
- Config: `/app/frontend/src/config/documentTypes.js` (shared category/type definitions)

### Phase 2: Post-Login Routing Fix (April 2025)
- RedirectIfAuth wrapper on `/` and `/auth` — authenticated users auto-redirect to dashboard

### Phase 2: Mandatory Onboarding Flow (April 2025)
- `GET /api/profile/completion` endpoint, OnboardingGate.jsx HOC, dashboard progress bars
- Gated routes: `/seeker/swipe`, `/seeker/offers`, `/poster/candidates`, `/poster/offers-sent`, `/matches`

### Phase 2: Bidirectional Matching & Worker Protection — Phase A (April 2025)
- Worker Preferences, Facility Profile, Assignment Feedback, Trust Scores, Signals, Badges
- Backend: `/app/backend/routes/matching.py`

### Phase 2: Browse Pros & Tiered Matching (April 2025)
- Tiered matching (Strong/Possible/Hidden), filter refinement, Pro Profile View

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

### P2 — Phase C-D
- Post-assignment feedback UI
- Facility accountability dashboard UI
- Feedback loop: flag mismatches for admin review

### Refactoring (Low Priority)
- Extract heavy logic from server.py into service modules
- Break down ProfileBuilder.jsx (1500+ lines) into sub-components

### Mocked
- SendGrid (logged to DB), Twilio SMS (disabled), Nursys API (disabled)
