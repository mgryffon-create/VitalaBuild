# VitalaMatch — Product Requirements Document

## Original Problem Statement
Healthcare hiring platform matching pros with employers, featuring bidirectional matching, worker protection, and structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI
- **AI:** GPT-4.1 vision (emergentintegrations) for resume parsing + document verification

## What's Been Implemented

### Phase 2: Offer State Synchronization (April 2025)
- **Write path fix**: `create_employment_offer` now also updates `pipeline_stages` to `offer_sent` (canonical sync)
- **Read path fix**: `get_seeker_applications` returns `offer_id` + full offer object (`position_title`, `salary_amount`, `salary_type`, `start_date`, `expiration_date`, `status`)
- **Pipeline fallback**: Seeker applications check `pipeline_stages` collection for `offer_sent` if no offer record found (covers employer-advanced-stage case)
- **Seeker UI**: "Offer Received" purple badge replaces "Matched" when offer exists. Offer banner shows position title, salary, start date, and "View & Respond to Offer" CTA
- **State consistency**: Employer and seeker now always see the same canonical state for offers

### Phase 2: Credential Verification Layer (April 2025)
- Cross-referencing self-reported certs with vault docs. Verified/Needs Review/Unverified statuses. Compliance summary.

### Phase 2: Job-Grouped Recruiter Messaging (April 2025)
- Hierarchical conversation list grouped by job. Collapsible sections.

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
