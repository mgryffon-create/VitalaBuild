# VitalaMatch — Product Requirements Document

## Original Problem Statement
Healthcare hiring platform matching pros with employers, featuring bidirectional matching, worker protection, and structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI
- **AI:** GPT-4.1 vision (emergentintegrations) for resume parsing + document verification

## What's Been Implemented

### Phase 2: Job-Grouped Recruiter Messaging (April 2025)
- **Hierarchical conversation list**: Conversations grouped by job posting (Job → Candidates). Each job section shows title, location, matched/interested counts
- **Collapsible sections**: Click job header to collapse/expand candidate list. ChevronDown when expanded, ChevronRight when collapsed
- **Per-job candidate entries**: Name + credential badge + specialty + stage badge + last message preview
- **Cross-job deduplication fix**: Same candidate appearing under multiple jobs now shown correctly (dedup by candidate_id+job_id pair, not just candidate_id)
- **Filter integration**: All/Applicants/Matches/Offers filters work with grouped list — only shows job groups containing matching candidates
- **Sorting**: Job groups sorted by candidate count (most active first), candidates within sorted by status priority

### Phase 2: Recruiter Credential Display (April 2025)
- Credential badges (RN/CNA/LPN) in conversation list, chat header, pipeline cards. Chat header: candidate-primary, job-secondary hierarchy

### Phase 2: Match/Conversation Detail Usability (April 2025)
- Full candidate profile panel, privacy-gated contact info, job context prominence, stage-driven sticky actions, back navigation

### Phase 2: Hiring Flow UX Overhaul (April 2025)
- Profile Preview Modal, state-driven actions, contextual guidance, pass/reject flow, enriched pipeline data, actionable error messages

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
