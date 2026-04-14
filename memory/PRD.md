# VitalaMatch — Product Requirements Document

## Original Problem Statement
Healthcare hiring platform matching pros with employers, featuring bidirectional matching, worker protection, and structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI
- **AI:** GPT-4.1 vision (emergentintegrations) for resume parsing + document verification

## What's Been Implemented

### Phase 2: Platform-Wide UX Consistency (April 2025)
- **Universal back navigation**: PageHeader component with consistent back button on Pipeline, Hiring Manager, Offers, Matches, Licenses, Settings, Messages pages
- **Autocomplete/autofill**: Login (email, current-password), Register (name, email, new-password), Job title, Offer position title
- **Date validation**: Offer Builder enforces expiration >= start date with inline error + submission block
- **Organic fields preserved**: Messaging composer, notes, descriptions remain autocomplete-free

### Phase 2: Structured Offer System (April 2025)
- Offer Builder modal, employment documents, seeker structured offer view

### Phase 2: Offer State Sync (April 2025)
- Write path sync, seeker "Offer Received" banner

### Phase 2: Credential Verification Layer (April 2025)
- Verified/Needs Review/Unverified statuses, compliance summary

### Phase 2: Job-Grouped Messaging (April 2025)
- Conversations grouped by job, collapsible sections

### Phase 2: Recruiter Credential Display (April 2025)
- Credential badges (RN/CNA/LPN)

### Phase 2: Match/Conversation Detail (April 2025)
- Full candidate profile panel, privacy-gated contact, stage-driven actions

### Phase 2: Hiring Flow UX Overhaul (April 2025)
- Profile Preview Modal, state-driven actions, contextual guidance

### Phase 2: All Prior Features
- Acceptance flow, UI layout, role eligibility, state sync, vault verification, compliance, candidate prioritization, onboarding, swipe, offer guardrails, tiered matching, structured pay, quality gates, messaging fix

## Test Accounts
| Role | Email | Password |
|---|---|---|
| Seeker | seeker_test@vitalamatch.com | test123 |
| Employer | employer_test@vitalamatch.com | test123 |
| Test Seeker | testseeker@test.com | test123 |
| Admin | admin@vitalamatch.com | admin123 |

## Prioritized Backlog
### P0
- Seeker profile Role Category selector (normalized_role_category in ProfileBuilder.jsx)
### P1
- Interview Scheduling Integration
- Pipeline Analytics Dashboard for Employers
### P2
- PDF offer letter generation, e-signatures
- Post-assignment feedback UI, Facility accountability dashboard
### Refactoring
- Extract server.py logic, break down ProfileBuilder.jsx (>1600 lines)
### Mocked
- SendGrid (logged to DB), Twilio SMS (disabled), Nursys API (disabled)
