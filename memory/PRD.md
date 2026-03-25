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
