# VitalaMatch — Product Requirements Document

## Original Problem Statement
Build a "Tinder for job matching" app for healthcare professionals, evolved into **VitalaMatch** — a secure, professional healthcare hiring platform.

## Current Phase: Phase 2 UX
The platform has been refactored from a feature-heavy social matching app into a streamlined, professional MVP. Phase 2 focuses on UX simplification and workflow optimization.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers in `/app/backend/routes/`
- **Frontend:** React + Tailwind CSS + Shadcn UI
- **Shared config:** `/app/backend/shared.py` for DB, auth helpers, models

## What's Been Implemented

### Phase 2: Navigation Menu Simplification (April 2025)
- **Seeker Nav** reduced from 11 → 5 items: Dashboard, Find Jobs, Matches, Offers, Profile
- **Employer Nav** reduced from 10+ → 5 items: Dashboard, Post Job, Candidates, Matches, Profile
- **Mobile bottom nav** mirrors sidebar exactly for both roles (5 tabs each, no scrolling)
- **Profile quick-links**: Seeker Profile → Document Vault, Licenses, References, Training, Onboarding, Settings. Employer Profile → Billing, Compliance, Offers & Hires, Settings
- **All existing routes preserved** — no backend changes, no route deletions
- Employer "Candidates" → `/poster/pipeline` (Kanban board), "Matches" → `/poster/messages` (inbox)

### Kanban Hiring Pipeline, Messaging & Nudge System (April 2025)
- **Hiring Pipeline** (`/poster/pipeline`): Kanban board (5 stages), candidate cards, nudge banner
- **Behavior-Driven Nudges**: Idle candidate detection per stage, priority escalation
- **Employer Messaging** (`/poster/messages`): Split-pane inbox, templates, context panel
- **Candidate Context Panel**: Full profile sidebar in messaging
- **External Application Link**: Banner + quick-action in messaging for external workflow jobs

### Billing & Pricing System with Stripe (April 2025)
- Subscription tiers: Free / Growth / Pro / Enterprise via Stripe Checkout
- Pay-per-hire fees, add-ons, billing dashboard

### Resume Onboarding Wizard & Reference Packets (April 2025)
- 4-step wizard with GPT parsing, confidence badges, reference packets

### Portable Reference System & AI Resume Parser (April 2025)
- Full CRUD references, email verification, GPT-4.1 resume parsing

### Compliance Score & Hiring Workflow (April 2025)
- Compliance badges, workflow config (in-platform/external)

### All Other Features (March-April 2025)
- Auto-assign training, backend refactor into modular routers
- Security hardening, training & compliance API, legal pages
- Inline onboarding upload, vault file upload, admin panel
- Conditional offer/onboarding flow, mobile polish, job form wizard
- Employer workflow, job browsing & matching, seeker dashboard

## Test Accounts
| Role | Email | Password |
|---|---|---|
| Job Seeker | seeker_test@vitalamatch.com | test123 |
| Employer | employer_test@vitalamatch.com | test123 |
| Admin | admin@vitalamatch.com | admin123 |

## Prioritized Backlog

### P0 — Next Up
- Enforce strict user onboarding flow (block seekers from jobs until profile complete)

### P1
- Update remaining terminology across platform
- Interview scheduling features

### P2
- Live SendGrid integration, Calendly/Zoom
- Pipeline analytics dashboard

### Mocked Integrations
- SendGrid emails (logged to DB, not sent)
- Twilio SMS (disabled)
- Nursys API (disabled)
