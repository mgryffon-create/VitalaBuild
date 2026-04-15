# VitalaMatch — Product Requirements Document

## Original Problem Statement
Healthcare hiring platform matching pros with employers, featuring bidirectional matching, worker protection, and structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI
- **AI:** GPT-4.1 vision (emergentintegrations) for resume parsing + document verification

## What's Been Implemented

### Phase 2: Admin Dashboard (April 2025)
- **Overview**: 9 stat cards (users, seekers, employers, jobs, matches, offers sent/accepted, onboarding, docs review)
- **User Management**: Searchable/filterable user table with role badges, match/doc counts, deactivate/reactivate
- **Document Review Queue**: View needs_review/unverified docs with verify/reject actions
- **Jobs Monitoring**: Table with employer, applicants, matches, hires counts, close/activate toggle
- **Onboarding Monitoring**: Cases with progress bars, completion counts
- **Audit Logs**: Activity trail with timestamps
- **System Health**: DB connection, API status, collection count, error count
- **Access Control**: Admin-only via _require_admin() + ProtectedRoute. Non-admins get 403/redirect.

### Phase 2: Database Cleanup (April 2025)
- Removed 40 test users and 1,755 related records across 25 collections
- Preserved 5 real users (admin + 2 seekers + 2 employers)
- Backup at /app/backups/mongodb_snapshot_20260415_002446

### Phase 2: Seeker Onboarding Walkthrough (April 2025)
- 4-step guided walkthrough, progressive completion

### Phase 2: Compliance Readiness & Onboarding (April 2025)
- Readiness score, typed signature, job documents, external systems, onboarding checklist

### Phase 2: Lightweight Document Verification (April 2025)
- PyMuPDF text extraction, regex date/credential detection, LLM fallback

### Phase 2: Platform-Wide UX (April 2025)
- Universal back nav, autocomplete, date validation

### Phase 2: Structured Offer System (April 2025)
- Offer Builder, employment documents, seeker offer view

### Phase 2: Hiring Flow + Matching + Credential Verification (April 2025)
- State-driven actions, job-grouped messaging, privacy gating, credential badges, credential verification layer

## Admin Access
| Route | Access | Description |
|---|---|---|
| /admin | admin only | Dashboard with 7 tabs |
| /api/admin/* | admin only | All admin API endpoints |

## Test Accounts
| Role | Email | Password |
|---|---|---|
| Admin | admin@vitalamatch.com | admin123 |
| Seeker | mgryffon@outlook.com | (user-set) |
| Seeker | r.l.olsen@outlook.com | (user-set) |
| Poster | janedue@gmail.com | (user-set) |
| Poster | stampd_ut@outlook.com | (user-set) |

## Prioritized Backlog
### P0
- Seeker profile Role Category selector (normalized_role_category)
### P1
- Onboarding Checklist UI pages (bidirectional employer + seeker)
- Interview Scheduling Integration
- Pipeline Analytics Dashboard
### P2
- PDF offer letters, e-signatures
- Background check/drug screen API integrations
- Admin document preview in review queue
### Refactoring
- Extract server.py logic, break down ProfileBuilder.jsx
### Mocked
- SendGrid (logged to DB), Twilio SMS (disabled), Nursys API (disabled)
