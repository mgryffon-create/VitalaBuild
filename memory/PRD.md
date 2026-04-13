# VitalaMatch — Product Requirements Document

## Original Problem Statement
Healthcare hiring platform matching pros with employers, featuring bidirectional matching, worker protection, and structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI

## What's Been Implemented

### Phase 2: Human-Centered Vault (April 2025)
- **Phase A — Language**: "Your Documents" (not "Secure Document Vault"), user-first copy throughout
- **Phase B — Organization**: Sort by expiration (expired→expiring→active→none), category counts on active docs, archived docs hidden by default with toggle
- **Phase C — Expiration Visibility**: Active/Xd left/Expired badges, attention banner with count ("2 documents need attention")
- **Phase D — Document Replacement**: Replace button (↻) on each card → opens upload with category+type preselected + metadata prefilled → archives old version (verification_status="archived")
- **Phase E — Skipped**: No new parsing system built (constraint: "hook into existing only" — no existing vault-level metadata extraction exists)
- **Phase F/G — Preserved**: Upload flow unchanged, profile routing preserved

### Phase 2: Work History Editing (April 2025)
- Edit/delete buttons on each entry, form prefill, in-place update

### Phase 2: Global Autocomplete System (April 2025)
- InlineAutocomplete for certs, licenses, positions, departments

### Phase 2: Document Vault as Single Source of Truth (April 2025)
- Medical Records tab → vault routing, Credentials tab → vault CTAs

### Phase 2: UX Polish, Resume Upload, Matching, Onboarding
- All prior Phase 2 features

### Phase 1: Core Features
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
- Pipeline Analytics Dashboard
- Facility signals in seeker job cards
### P2
- Post-assignment feedback UI, Facility accountability dashboard
### Refactoring
- Extract server.py logic, break down ProfileBuilder.jsx
### Mocked
- SendGrid (logged to DB), Twilio SMS (disabled), Nursys API (disabled)
