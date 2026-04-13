# VitalaMatch — Product Requirements Document

## Original Problem Statement
Healthcare hiring platform matching pros with employers, featuring bidirectional matching, worker protection, and structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI

## What's Been Implemented

### Phase 2: Document Vault Organization + Clean UX (April 2025)
- **Phase A — Category Tabs**: Top-level tabs (All, Medical Records, Certifications, Identification, Compliance) with dynamic counts
- **Phase B — Human Labels**: LABEL_MAP converts raw names (drivers_license→Driver's License, TB_test→TB Test, etc.) + CATEGORY_NORMALIZE maps old categories (identity→identification, health_screen→medical, resume→compliance)
- **Phase C — Single Status**: One badge per doc: Active/Expires in Xd/Expired/Uploaded/Replaced — no double badges
- **Phase D — Dedup**: Shows only latest per category+subtype. Older versions hidden by default, shown via "History" toggle with reduced opacity and "Replaced" badge
- **Phase E — Metadata Prefill**: Replace flow prefills issuing authority, document number, state from original
- **Phase F/G — Counts + Sorting**: Dynamic tab counts, sort expired→expiring→active→uploaded→replaced

### Phase 2: Human-Centered Vault (April 2025)
- User-first language, expiration badges, replace flow, archived versioning, attention banner

### Phase 2: All Prior Features
- Work history editing, global autocomplete, vault-as-source-of-truth, UX polish, resume upload, matching, onboarding

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
