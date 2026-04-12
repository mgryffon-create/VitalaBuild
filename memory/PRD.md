# VitalaMatch — Product Requirements Document

## Original Problem Statement
Build a "Tinder for job matching" app for healthcare professionals, evolved into **VitalaMatch** — a secure, professional healthcare hiring platform.

## Current Phase: Phase 1 MVP
The platform has been refactored from a feature-heavy social matching app into a streamlined, professional MVP focused on core hiring functionality.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers in `/app/backend/routes/`
- **Frontend:** React + Tailwind CSS + Shadcn UI
- **Shared config:** `/app/backend/shared.py` for DB, auth helpers, models

## What's Been Implemented

### Kanban Hiring Pipeline, Messaging & Nudge System (April 2025)
- **Hiring Pipeline** (`/poster/pipeline`): Kanban board with 5 columns (Interested, Matched, Interviewing, Offer Sent, Hired). Candidate cards with specialty, skills, verified refs badge, last message. "Message" and stage advancement buttons per card. Stats bar with per-stage counts.
- **Behavior-Driven Nudges**: `GET /api/pipeline/nudges` computes idle candidates per stage (thresholds: interested 2d, matched 3d, interviewing 5d, offer_sent 3d). Nudge banner on pipeline page with action buttons (Review/Message/Advance/Follow Up). Priority escalation (high if 2x threshold). In-chat nudge alerts.
- **Employer Messaging** (`/poster/messages`): Split-pane inbox (conversation list + chat thread). Filters by stage (All/New/Matched/Interview). Message templates (Ask Availability, Request Interview, Send Application, Notify Offer). Advance Stage quick-action in chat.
- **Candidate Context Panel**: Collapsible right panel in messaging showing full candidate profile (experience, skills, vault docs, verified refs, training compliance, onboarding status, preferences, bio).
- **External Application Link**: Banner in chat for jobs with external workflow. "Send App Link" quick-action auto-populates template with external URL.
- **Employer Navigation Refactor**: Sidebar grouped into Hiring (Dashboard, Jobs, Pipeline, Matches, Offers & Hires), Operations (Compliance & Onboarding), Account (Billing & Plans, Company Profile, Settings). Mobile bottom nav: Dashboard, Jobs, Pipeline, Messages, More.
- Backend: `routes/pipeline.py` with candidates, stage update, nudges, context, templates endpoints.

### Billing & Pricing System with Stripe (April 2025)
- **Subscription tiers**: Free / Growth ($99/mo) / Pro ($299/mo) / Enterprise ($999/mo) via Stripe Checkout
- **Pay-per-hire fees**: CNA $500, LPN $1500, RN $3500 with tier-based discounts
- **Add-ons**: Boosted Job ($50), Compliance Bundle ($299)
- **Billing Dashboard** (`/poster/billing`): Current plan, upgrade cards, add-on purchase, transaction history
- Backend module: `routes/billing.py`

### Resume Onboarding Wizard & Reference Packets (April 2025)
- **Resume Onboarding Wizard** (`/seeker/resume-onboarding`): 4-step flow with GPT parsing, confidence badges
- **EmploymentGroupCard**: Travel work grouping, expand/collapse
- **Reference Packet UI**: "Reference Packet" button generates formatted summary

### Portable Reference System & AI Resume Parser (April 2025)
- **Portable References** (`/references`): Full CRUD, email verification flow, reference packets
- **AI Resume Parser**: GPT-4.1 via emergentintegrations, healthcare-optimized extraction
- Backend modules: `routes/references.py`, `routes/resume.py`, `resume_parser.py`

### Compliance Score & Hiring Workflow Configuration (April 2025)
- Compliance score badges on candidate cards
- Hiring workflow config: in_platform_only / external_required / external_optional

### Auto-Assign Training & Backend Refactor (April 2025)
- Auto-assign training on offer accept
- Backend refactored into modular routers under `/app/backend/routes/`

### Security Hardening, Training & Compliance (April 2025)
- Audit logging, secure vault files, RBAC, training API

### Document Preview & Legal Pages (April 2025)
- Document preview, Terms of Service, Privacy Policy, signup checkbox

### All Other Features (March-April 2025)
- Inline onboarding upload, vault file upload, admin panel, conditional offer/onboarding flow
- Mobile app polish, job posting form wizard, mobile landing optimization
- Employer workflow (dashboard, candidates, offers), job browsing & matching, seeker dashboard

## Test Accounts
| Role | Email | Password |
|---|---|---|
| Job Seeker | seeker_test@vitalamatch.com | test123 |
| Employer | employer_test@vitalamatch.com | test123 |
| Admin | admin@vitalamatch.com | admin123 |

## Prioritized Backlog

### P0 — Next Up
- Enforce strict user onboarding flow (block seekers from jobs until profile/credentials complete; block employers until verified/job posted)

### P1
- Update remaining terminology across platform
- Employer dashboard terminology alignment

### P2
- Advanced interview scheduling
- Finalize 3rd party integrations (SendGrid live, Calendly, Zoom)

### Mocked Integrations
- SendGrid emails (logged to DB, not sent)
- Twilio SMS (disabled)
- Nursys API (disabled)
