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
