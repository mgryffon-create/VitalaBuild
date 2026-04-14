# VitalaMatch — Product Requirements Document

## Original Problem Statement
Healthcare hiring platform matching pros with employers, featuring bidirectional matching, worker protection, and structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI
- **AI:** GPT-4.1 vision (emergentintegrations) for resume parsing + document verification (LLM fallback)

## What's Been Implemented

### Phase 2: Lightweight Document Verification (April 2025)
- **Text extraction**: PyMuPDF (fitz) extracts visible text from uploaded PDFs
- **Date detection**: Regex patterns for MM/DD/YYYY, YYYY-MM-DD, Month DD YYYY, M/D/YY + expiration keyword proximity scoring
- **Credential detection**: Keyword matching for BLS, ACLS, PALS, CPR, RN, CNA, LPN, LVN, DEA, NPI
- **Verification pipeline**: Lightweight parser runs first → if inconclusive, falls through to GPT-4.1 Vision LLM
- **Conservative trust**: matching date+credential → verified; mismatch → needs_review; no text → unverified; expired → needs_review
- **Status notes**: "Expiration date verified (2027-03-15)", "Entered expiration may not match document date", "No readable expiration detected"
- **Vault UI**: Shows Needs Review badge, verification notes for all states, Auto-verified/AI-verified labels

### Phase 2: Platform-Wide UX Consistency (April 2025)
- Universal back navigation, autocomplete/autofill, date validation

### Phase 2: Structured Offer System (April 2025)
- Offer Builder modal, employment documents, seeker structured offer view

### Phase 2: Offer State Sync, Credential Verification, Job-Grouped Messaging, Recruiter Credential Display, Match/Conversation Detail, Hiring Flow UX Overhaul (April 2025)
- Full hiring pipeline, privacy gating, state-driven actions, credential badges, compliance summary

## Verification Architecture
```
Upload → lightweight_parser.py (text extraction + regex)
  ├─ Definitive (verified/needs_review) → Save, done
  └─ Inconclusive (should_run_llm=True) → expiration_verifier.py (GPT-4.1 Vision) → Save
```

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
- Admin manual review queue for needs_review documents
### Refactoring
- Extract server.py logic, break down ProfileBuilder.jsx (>1600 lines)
### Mocked
- SendGrid (logged to DB), Twilio SMS (disabled), Nursys API (disabled)
