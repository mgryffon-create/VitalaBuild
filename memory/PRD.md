# VitalaMatch — Product Requirements Document

## Original Problem Statement
Healthcare hiring platform matching pros with employers, featuring bidirectional matching, worker protection, and structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI
- **AI:** GPT-4.1 vision (emergentintegrations) for resume parsing + document verification

## What's Been Implemented

### Phase 2: Credential Verification Layer (April 2025)
- **Verification statuses**: Each credential now shows Verified (green, vault-backed), Needs Review (amber, vault doc with issues), or Unverified (gray, self-reported only)
- **Cross-referencing engine**: `_compute_verified_credentials()` matches profile certifications against vault documents by subtype name matching
- **Compliance summary**: Top-level badge derived from credential verification — Compliance Ready / Partially Verified / Verification Needed
- **Honest display**: No ShieldCheck icons for unverified credentials. Gray dot + "Unverified" label for self-reported only
- **Pipeline modal**: Color-coded certification badges with summary line ("2 self-reported · 2 total")
- **Messaging profile panel**: Each cert shows status label badge, credential summary section with level and count
- **Future-ready**: Status model supports later OCR/parsing promoting credentials between unverified → needs_review → verified

### Phase 2: Job-Grouped Recruiter Messaging (April 2025)
- Hierarchical conversation list grouped by job posting. Collapsible sections. Cross-job dedup fix.

### Phase 2: Recruiter Credential Display (April 2025)
- Credential badges (RN/CNA/LPN) in conversation list, chat header, pipeline cards.

### Phase 2: Match/Conversation Detail Usability (April 2025)
- Full candidate profile panel, privacy-gated contact info, stage-driven sticky actions, back navigation.

### Phase 2: Hiring Flow UX Overhaul (April 2025)
- Profile Preview Modal, state-driven actions, contextual guidance, pass/reject flow, actionable error messages.

### Phase 2: All Prior Features
- Acceptance flow fix, UI layout fix, role eligibility, state sync, vault verification, document validation, compliance, candidate prioritization, interaction fix, employer onboarding, desktop swipe, offer guardrails, tiered matching, structured pay, quality gates, messaging composer fix

## Test Accounts
| Role | Email | Password | Role Category |
|---|---|---|---|
| Seeker | seeker_test@vitalamatch.com | test123 | RN |
| Employer | employer_test@vitalamatch.com | test123 | — |
| New Employer | new_employer_test@vitalamatch.com | test123 | — |
| Test Seeker | testseeker@test.com | test123 | RN |
| Admin | admin@vitalamatch.com | admin123 | — |

## Prioritized Backlog
### P0
- Seeker profile Role Category selector (normalized_role_category dropdown in ProfileBuilder.jsx)
### P1
- Interview Scheduling Integration
- Pipeline Analytics Dashboard for Employers
### P2
- Post-assignment feedback UI, Facility accountability dashboard
### Refactoring
- Extract server.py logic, break down ProfileBuilder.jsx (>1600 lines)
### Mocked
- SendGrid (logged to DB), Twilio SMS (disabled), Nursys API (disabled)
