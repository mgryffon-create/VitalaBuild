# VitalaMatch — Product Requirements Document

## Original Problem Statement
Build a "Tinder for job matching" app for healthcare professionals, evolved into **VitalaMatch** — a secure, professional healthcare hiring platform.

## Current Phase: Phase 1 MVP
The platform has been refactored from a feature-heavy social matching app into a streamlined, professional MVP focused on core hiring functionality.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth
- **Frontend:** React + Tailwind CSS + Shadcn UI
- **Monolithic backend** at `/app/backend/server.py`

## What's Been Implemented

### Compliance Score & Hiring Workflow Configuration (April 2025)
- **Compliance score badges**: Candidate cards show real-time compliance % (green >=80, amber >=50, red <50) computed from training assignments, onboarding progress, and vault document count
- **Hiring workflow config**: Job posting form now includes Application Workflow section with: workflow type (in_platform_only/external_required_immediately/external_required_after_match/external_optional), external URL, stage, profile sufficiency toggle, additional requirements
- Default suggestion: `external_required_after_match` (labeled "Recommended") to reduce candidate drop-off while preserving employer compliance
- **Candidate flow logic**: SwipePage shows blue notice for external workflow jobs — immediate external shows "Apply externally" link; after-match shows "required after match" message
- Workflow fields stored at job-post level and exposed to downstream parsing/autofill logic

### Auto-Assign Training & Backend Refactor (April 2025)
- **Auto-assign training on offer accept**: When onboarding case is created, system queries `compliance_requirements` for employer + role_type and auto-creates `training_assignments` for matching courses (avoids duplicates)
- **Backend refactor**: Extracted auth, vault, and training routes into separate FastAPI router modules under `/app/backend/routes/`
  - `shared.py` (408 lines): Shared config, DB, auth helpers, models, services
  - `routes/auth.py` (65 lines): Register, login, me
  - `routes/vault.py` (153 lines): Documents CRUD, file upload/serve, categories
  - `routes/training.py` (131 lines): Courses, assignments, compliance, transcript, certificates
  - `server.py` reduced from 4536 → 4113 lines; remaining routes (profiles, jobs, matching, hiring, onboarding, admin) can be extracted incrementally

### Security Hardening, Training & Compliance Architecture (April 2025)
- **Audit Logging**: `audit_log.py` service logs login, login_failed, register, vault_upload, vault_access, file_access, unauthorized_access to MongoDB `audit_logs` collection
- **Secure Vault Files**: `GET /api/vault/files/{filename}` now requires auth, checks file ownership (candidate/admin/employer-with-onboarding-case), blocks path traversal
- **HIPAA Architecture Prep**: RBAC (seeker/poster/admin roles), audit trail started, vault files restricted, minimum necessary access principle documented in code comments — does NOT claim HIPAA compliance
- **Training & Compliance API**: `training_service.py` with courses, assignments, compliance requirements, transcript/certificates endpoints. Integration-ready for Relias LMS (external_lms_user_id, external_course_id, launch_url fields)
- **Clinician Training Page** (`/seeker/training`): Tabs for Assigned Training, Transcript, Certificates with summary cards (assigned count, completed, overdue, CE credits)
- **Employer Compliance Dashboard** (`/poster/compliance`): Summary cards (total assigned, completed, overdue, compliance rate), assignments table, Create Course + Assign Training dialogs
- Data models: `training_courses`, `training_assignments`, `compliance_requirements`, `audit_logs` MongoDB collections

### Document Preview & Legal Pages (April 2025)
- **Document Preview**: Clickable vault cards open full preview dialog with image rendering (jpg/png/webp), PDF iframe rendering, metadata strip (status, issuing authority, expiration, state), download + external link buttons, fallback for unsupported types
- **Terms of Service** (`/terms`): 12 sections covering acceptance, user responsibilities, job posting rules, no employment guarantee, limitation of liability, acceptable use, termination rights
- **Privacy Policy** (`/privacy`): 11 sections covering data collection, usage, sharing (employers see onboarding status not full vault), retention, user rights (access/correction/deletion/portability), cookies, children's privacy
- No HIPAA compliance claims; no false legal guarantees; appropriate disclaimers throughout
- **Signup checkbox**: Registration form requires accepting Terms + Privacy before account creation (button disabled until checked)
- **Footer links**: Landing page footer shows Terms and Privacy links

### Inline Onboarding Upload & Backend Integration Cleanup (April 2025)
- **Inline Upload**: Candidates can now upload documents directly from the onboarding requirement list via an inline dialog (file picker + category/subtype pre-filled from requirement type + progress bar). No more navigating away to the vault page.
- **REQ_CATEGORY_HINTS**: Auto-maps requirement types to vault categories (e.g., government_id -> identity, bls_certification -> certification/BLS, tb_screening -> health_screen/TB_test)
- **Backend endpoint**: `POST /api/onboarding/requirements/{req_id}/upload` now accepts multipart file upload, creates vault doc, links to requirement, updates status to pending_manual_review
- **Twilio SMS**: DISABLED — `send_sms()` short-circuited with log message, import commented out
- **Nursys API**: DISABLED — `verify_via_nursys()` returns `api_disabled` status immediately
- Push notification endpoints preserved (subscription management only, no actual push sending)

### Terminology Cleanup & File Upload Support (April 2025)
- **Terminology**: SwipeBinsPage — "It's a match!" (not "connection"), "Marked as interested!" (not "Added to interested")
- **Terminology**: SettingsPage — "match with a job/candidate" (not "connect with"), "matches, messages, and offers" (not "interview requests"), responsive heading
- **File Upload**: Added `POST /api/vault/upload` multipart endpoint (PDF, JPG, PNG, DOCX, max 10 MB)
- **File Upload**: Files stored at `/app/backend/uploads/vault/`, served via `/api/vault/files/{filename}` (ingress-compatible)
- **Vault UI**: File picker dropzone with size validation, upload progress bar, file size display (KB), "View file" link on doc cards

### Admin Panel & Employer Onboarding Dashboard (April 2025)
- **Admin Panel** (`/admin/onboarding`): View all onboarding cases across employers, review vault matches, manually attach vault docs to requirements, update statuses/notes, flag issues, mark as verified
- **Admin endpoints**: `GET /api/admin/onboarding/cases`, `GET /api/admin/onboarding/cases/{id}`, `PUT /api/admin/onboarding/requirements/{id}`, `GET /api/admin/vault/documents/{candidate_id}`, `POST /api/admin/seed`
- **Employer Dashboard**: Added Onboarding Progress section showing per-candidate progress cards with % complete, vault satisfaction count, review/external/flagged counts
- **Status Logic Fix**: Only `satisfied_from_vault` and `completed` count as resolved; `pending_manual_review` and `pending_external_check` do NOT count; `flagged_issue` sets case to flagged; all resolved = cleared
- **Notifications**: Triggers on offer accept (onboarding started to candidate + employer), onboarding cleared (congratulations to candidate) — uses existing NotificationService (SendGrid MOCKED, logged to DB)
- Admin user: `admin@vitalamatch.com / admin123` (seeded via `/api/admin/seed`)

### Conditional Offer & Onboarding Flow with Vault (April 2025)
- **Secure Document Vault** (`/seeker/vault`): Candidates upload documents once (identity, certifications, licenses, health records, health screens, resumes) and reuse them across job offers
- **VaultDocument model**: category, subtype, issuing_authority, document_number, expiration_date, verification_status, file_url, extracted_fields
- **OnboardingCase**: Auto-created when candidate accepts an offer; linked to job, candidate, employer with role-based requirements
- **Rules-based Requirements**: CNA/RN/LPN/DEFAULT role templates auto-generate compliance requirements (Government ID, Background Check, Drug Screen, License Verification, Fingerprinting, BLS, TB Screening, Vaccinations)
- **Vault Matching Logic**: System checks candidate's vault before requesting uploads — satisfied_from_vault, missing_document, document_expired, pending_manual_review, pending_external_check statuses
- **RequirementDocumentMatch**: Links requirements to existing vault documents without duplication
- **Task System**: Only creates tasks for unresolved requirements — no redundant upload tasks for vault-satisfied items
- **OnboardingPage** (`/seeker/onboarding`, `/poster/onboarding`): Progress tracking with expandable requirement lists, status badges, upload/complete actions
- Backend module: `/app/backend/onboarding_logic.py` for business logic separation

### Mobile App Experience Polish (April 2025)
- DashboardLayout: Fixed bottom nav active dot indicator (relative positioning), reduced mobile header/content padding, added min tap target sizes (56px+)
- All pages: Responsive heading sizes (text-xl mobile, text-2xl+ desktop), reduced section spacing on mobile (space-y-5 vs space-y-8)
- MatchesPage: Rewrote for mobile-native UX — mobile shows full-screen detail view with back button instead of awkward stacked panels
- PosterDashboard: Responsive stats grid (compact on mobile), full-width action buttons, tighter job listing cards
- EmployerCandidatesPage: Responsive stats cards, better candidate card layout with full-width action buttons on mobile
- SwipePage: Responsive card height (adapts to viewport), larger touch targets for Pass/Interested buttons with active:scale feedback
- MyOffersPage: Responsive offer cards with full-width Accept/Decline buttons on mobile

### Job Posting Form UX Improvement (April 2025)
- Refactored long single-scroll job form into 5 organized sections: Basic Info, Schedule, Compensation & Benefits, Requirements & Certifications, Review & Submit
- Sticky progress tracker at top with scroll-spy (IntersectionObserver) highlighting active section
- Clickable progress steps for quick navigation between sections
- Collapsible sections with chevron toggle to reduce visual overload
- Review section with field summary and missing-fields warning before submit
- Mobile sticky bottom submit bar (always-visible Post Job button on small viewports)
- Section completion indicators on progress tracker (checkmarks for filled sections)
- All existing fields, validation, auto-save, and backend logic preserved

### Mobile Landing Page Optimization (April 2025)
- Hero CTA buttons ("I'm a Job Seeker" / "I'm an Employer") visible on first screen mobile without scrolling
- Hero image capped at 180px mobile, 280px tablet, 440px desktop
- Sticky bottom action bar (Job Seeker | Employer | Login) on mobile for non-logged-in users
- Compact 2-col feature card grid on mobile, benefits image as small banner
- All navigation buttons route to /auth

### Phase 1 MVP — Employer Workflow (March 2025)
- **Employer Dashboard**: Section-based — stats (Jobs Posted, Candidates, Offers Sent), job postings list with Candidates/Edit/Delete, business email verification
- **Candidates Page** (`/poster/candidates`): Shows all seekers who expressed interest, filterable by job. Employer can Accept (creates match) or Send Offer (opens dialog).
- **Offer Flow**: Dialog with pay rate, pay type, start date, expiration, benefits, conditions. Creates offer record in DB.
- **Backend**: `GET /api/employer/candidates` returns interested seekers with status. `POST /api/employer/candidates/{id}/accept` creates mutual match.
- **Employer Nav**: Dashboard, Post Job, Candidates, Matches, Offers Sent, Company Profile, Settings
- **Bug fix**: datetime comparison error in `/api/hiring/offers` endpoint (fixed by testing agent)

### Phase 1 MVP — Job Browsing & Matching Flow (March 2025)
- **Find Jobs page**: Tinder/Nursa-style card UI — title, facility, location, pay, specialty, description. Two buttons: Pass + Interested. Swipe gestures supported.
- **Backend**: New `GET /api/seeker/applications` endpoint returns all jobs seeker liked with status (pending / matched / offer)
- **Matches page**: Seeker sees application tracker with status badges; pending shows "Waiting for a match" instead of chat; matched enables messaging. Employer sees legacy match view.
- **Employer nav simplified**: flat list (Dashboard, Post Job, Company Profile, Hiring Manager, Verify Credentials, Matches, Settings). References/Connections/Bins removed.

### Phase 1 MVP — Seeker Dashboard v2 (March 2025)
- **Section-based layout**: Profile Status (with per-field checklist), Credentials & Documents (licenses/docs/verification), Matches & Offers (clickable cards), Quick Actions (2-col grid)
- **Profile completion**: Dynamically checks 5 fields (specialty, experience, phone, bio, preferred locations) with green/amber indicators
- All references, connections, and social features removed from dashboard
- Sidebar: Dashboard, Find Jobs, My Profile, Licenses, Documents, Matches, Offers, Settings

### Pre-existing Features (carried forward)
- Full auth (JWT), profile builder with auto-save, job posting, swipe/review UI
- Document vault with expiry tracking, license management, references system
- Direct messaging, business email verification for employers
- PWA support (hidden install prompts), Twilio integration (disabled in UI)

## Test Accounts
| Role | Email | Password |
|---|---|---|
| Job Seeker | seeker_test@vitalamatch.com | test123 |
| Employer | employer_test@vitalamatch.com | test123 |

## Prioritized Backlog

### P0 — Next Up
- Enforce strict user onboarding flow (block seekers from reviewing jobs until profile/credentials complete; block employers until verified/job posted)

### P1
- Update remaining terminology across platform (SwipeBinsPage, settings notifications text)
- Employer dashboard terminology alignment (connections → matches where needed)

### P2
- Disable backend integrations (Twilio SMS, Push Notifications, Nursys API) in server.py
- Backend refactor: break monolithic server.py into routers

### Future / On Hold
- Finalize 3rd party integrations (SendGrid, Calendly, Zoom)
- Resume parsing automation
- Interview scheduling
- Advanced hiring suite (offers, policy management, reviews)
