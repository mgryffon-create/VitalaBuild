# VitalaMatch — Product Requirements Document

## Original Problem Statement
Healthcare hiring platform matching pros with employers, featuring bidirectional matching, worker protection, and structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI
- **AI:** GPT-4.1 vision (emergentintegrations) for resume parsing + document verification

## What's Been Implemented

### Phase 2: Structured Offer System (April 2025)
- **Offer Builder Modal**: Pre-fills position title + salary from job data. Fields: pay rate + type, start date, expiration, shift, contract length, overtime, sign-on bonus, completion bonus, housing stipend, travel stipend, time off, benefits, conditions, custom notes
- **Dual entry points**: Offer Builder opens from both messaging profile panel and pipeline candidate modal (replaces stage-only advance)
- **Employment documents**: Separate `employment_documents` collection — NOT mixed with credential vault. Auto-creates offer_letter record on offer submission
- **Seeker offer view**: Enhanced MyOffersPage with structured sections — Pay & Schedule, Compensation Extras, Benefits, Conditions, Employer Notes
- **Accept/Decline**: Existing workflow preserved with conflict detection

### Phase 2: Offer State Sync (April 2025)
- Write path sync: offer creation updates pipeline_stages. Seeker reads offer_id + details from applications API.

### Phase 2: Credential Verification Layer (April 2025)
- Cross-referencing certs with vault docs. Verified/Needs Review/Unverified statuses. Compliance summary.

### Phase 2: Job-Grouped Messaging (April 2025)
- Conversations grouped by job. Collapsible sections.

### Phase 2: Recruiter Credential Display (April 2025)
- Credential badges (RN/CNA/LPN).

### Phase 2: Match/Conversation Detail (April 2025)
- Full candidate profile panel, privacy-gated contact, stage-driven actions, back nav.

### Phase 2: Hiring Flow UX Overhaul (April 2025)
- Profile Preview Modal, state-driven actions, contextual guidance, pass/reject, actionable errors.

### Phase 2: All Prior Features
- Acceptance flow, UI layout, role eligibility, state sync, vault verification, compliance, candidate prioritization, onboarding, swipe, offer guardrails, tiered matching, structured pay, quality gates, messaging fix

## Data Model: Offer + Employment Documents

### employment_offers collection
```
{id, match_id, job_id, poster_id, seeker_id, position_title, salary_amount, salary_type,
 start_date, expiration_date, contract_length, shift_details, overtime_rate,
 sign_on_bonus, completion_bonus, housing_stipend, travel_stipend,
 approved_time_off, conditions[], benefits_summary, custom_notes,
 status: pending|accepted|rejected|withdrawn|expired, created_at, updated_at}
```

### employment_documents collection (separate from vault)
```
{id, offer_id, match_id, job_id, candidate_id, employer_id,
 document_type: offer_letter|contract|onboarding,
 title, generated_at, status: active|archived}
```

### Vault separation
- `vault_documents` → licenses, certifications, compliance docs only
- `employment_documents` → offer letters, contracts, onboarding packets only

## Test Accounts
| Role | Email | Password |
|---|---|---|
| Seeker | seeker_test@vitalamatch.com | test123 |
| Employer | employer_test@vitalamatch.com | test123 |
| Test Seeker | testseeker@test.com | test123 |
| Admin | admin@vitalamatch.com | admin123 |

## Prioritized Backlog
### P0
- Seeker profile Role Category selector (normalized_role_category dropdown in ProfileBuilder.jsx)
### P1
- Interview Scheduling Integration
- Pipeline Analytics Dashboard for Employers
### P2
- Post-assignment feedback UI, Facility accountability dashboard
- PDF offer letter generation, e-signatures
### Refactoring
- Extract server.py logic, break down ProfileBuilder.jsx (>1600 lines)
### Mocked
- SendGrid (logged to DB), Twilio SMS (disabled), Nursys API (disabled)
