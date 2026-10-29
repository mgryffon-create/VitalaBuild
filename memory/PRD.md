# VitalaMatch — Product Requirements Document

## Original Problem Statement
Healthcare hiring platform matching pros with employers, featuring bidirectional matching, worker protection, and structured hiring pipeline.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth, modular routers
- **Frontend:** React + Tailwind CSS + Shadcn UI
- **AI:** GPT-4.1 vision (emergentintegrations) for resume parsing + document verification

## What's Been Implemented

### Phase 2: ProfileBuilder P0 Fixes (April 2026)
- **Mobile UX**: Horizontally scrollable tab bar, sticky positioning during scroll
- **Structured Address**: Street Address, City, State, ZIP fields replace single address input
- **Canonical Role Selector**: `normalized_role_category` dropdown in Professional Info (shared config)
- **Guided Profile Flow**: Auto-advance "Save & Continue" per tab, validation gating, completion state
- **Backend Model Fix**: `SeekerProfile` now uses `ConfigDict(extra="allow")` preserving all frontend fields

### Phase 2: Admin Dashboard (April 2025)
- Overview: 9 stat cards, user management, document review queue, jobs monitoring, onboarding, audit logs, system health
- Access Control: Admin-only via `_require_admin()` + ProtectedRoute

### Phase 2: Database Cleanup (April 2025)
- Removed 40 test users and 1,755 related records
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
- State-driven actions, job-grouped messaging, privacy gating, credential badges

### GitHub Migration Prep (April 2026)
- Clean `.gitignore` excluding `.env`, uploads, backups, test artifacts
- `.env.example` files for frontend and backend with placeholder values
- Removed tracked binary files (backups, vault uploads, test reports)
- Professional README.md with setup instructions

## Admin Access
| Route | Access | Description |
|---|---|---|
| /admin | admin only | Dashboard with 7 tabs |
| /api/admin/* | admin only | All admin API endpoints |

## Test Accounts
| Role | Email | Password |
|---|---|---|
| Admin | admin@vitalamatch.com | admin123 |
| Test Seeker | testseeker@test.com | Test1234! |

## Prioritized Backlog
### P1
- Interview Scheduling Integration
- Pipeline Analytics Dashboard for Employers
### P2
- PDF offer letters, e-signatures
- Post-assignment feedback UI / Facility accountability dashboard
- Admin document preview in review queue
- Background check/drug screen API integrations
### Refactoring
- Break down ProfileBuilder.jsx (1800+ lines) into sub-components
- Extract server.py logic into more modular routers
### Mocked
- SendGrid (logged to DB), Twilio SMS (disabled), Nursys API (disabled)
