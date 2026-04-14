# VitalaMatch — Product Requirements Document

## Original Problem Statement
Healthcare hiring platform matching pros with employers, featuring bidirectional matching, worker protection, and structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI
- **AI:** GPT-4.1 vision (emergentintegrations) for resume parsing + document verification

## What's Been Implemented

### Phase 2: Strict Role Eligibility System (April 2025)
- **Shared eligibility service** (`eligibility.py`): `check_role_eligibility()` — single source of truth
- **13 canonical roles**: CNA, LPN, RN, NP, CRNA, PA, RT, OT, PT, ST, MEDICAL_ASSISTANT, PHLEBOTOMIST, RADIOLOGY_TECH
- **Alias mapping**: 80+ aliases normalized to canonical categories (word-boundary matching)
- **Hard filter enforced in ALL code paths**: swipe/jobs, swipe/seekers, swipe action, browse pros, express interest, accept candidate, pipeline stage update, match creation, offer creation
- **Job model**: `primary_role_category` + `accepted_role_categories` (defaults to primary only)
- **Seeker profile**: `normalized_role_category` (separate from specialty)
- **Migration**: `migrate_roles.py` normalized existing data, flagged invalid matches
- **Frontend**: Role Category * (required) + "Also Accept" (optional) dropdowns on job form
- **Rule**: CNA NEVER sees RN/LPN jobs; RN NEVER sees CNA-only jobs; strict by default, explicit employer override only

### Phase 2: State Sync Fix, Vault Verification, Document Validation, Compliance System, Candidate Prioritization, Interaction Fix, Employer Onboarding, Desktop Swipe, Offer Guardrails, Tiered Matching, Structured Pay, Card Polish, Quality Gates, Prior Features
- (See previous versions for full detail)

## Test Accounts
| Role | Email | Password | Role Category |
|---|---|---|---|
| Seeker | seeker_test@vitalamatch.com | test123 | RN |
| Employer | employer_test@vitalamatch.com | test123 | — |
| New Employer | new_employer_test@vitalamatch.com | test123 | — |
| Test Seeker | testseeker@test.com | test123 | RN |
| Admin | admin@vitalamatch.com | admin123 | — |

## Prioritized Backlog
### P1
- Interview Scheduling Integration
- Pipeline Analytics Dashboard
- Facility signals in seeker job cards
- Seeker profile Role Category selector (currently derived from specialty)
### P2
- Post-assignment feedback UI, Facility accountability dashboard
### Refactoring
- Extract server.py logic, break down ProfileBuilder.jsx
### Mocked
- SendGrid (logged to DB), Twilio SMS (disabled), Nursys API (disabled)
