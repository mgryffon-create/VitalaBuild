# VitalaMatch — Product Requirements Document

## Original Problem Statement
Healthcare hiring platform matching pros with employers, featuring bidirectional matching, worker protection, and structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI
- **AI:** GPT-4.1 vision (emergentintegrations) for resume parsing + document verification

## What's Been Implemented

### Phase 2: Match/Conversation Detail Usability (April 2025)
- **Full Candidate Profile Panel**: Employer messaging page shows scrollable profile with work history, licenses, certifications, documents, skills, references, bio, compliance status
- **Privacy-Gated Contact Info**: Phone/email only visible post-match. Pre-match shows "Contact details available after match". Backend enforces — fields omitted from API response when no match exists
- **Job Context Prominence**: Job title, location, pay range displayed in chat header bar. Conversation list items show job title under each candidate name
- **Stage-Driven Sticky Actions**: Action bar stays fixed at bottom of profile panel. Buttons derived from canonical state (interested=Accept+Pass, matched=Message+Send Offer, offer_sent=Message+View Offer, hired=Message)
- **Back Navigation**: Both employer and seeker views have visible back button on desktop and mobile. Returns to pipeline/swipe respectively
- **Seeker Match Detail Enhancement**: Building icon with employer name, specialty display, pay range, location always visible

### Phase 2: Hiring Flow UX Overhaul (April 2025)
- **Profile Preview Modal**: Card click opens read-only modal (no mutations)
- **State-driven actions**: Strictly from canonical state machine. Invalid actions hidden, not disabled
- **Contextual onboarding guidance**: Inline reminders per candidate state
- **Pass/Reject flow**: Confirmation dialogs, moves to "passed" stage
- **Enriched pipeline data**: certifications, vault categories, messages count, pay range, shift type
- **Actionable error messages**: Specific errors per HTTP status

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
