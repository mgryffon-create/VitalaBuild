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

### Phase 1 MVP (March 2025)
- **Landing Page:** Professional tone — "Your Healthcare Career Starts Here", feature cards (Universal Application, Secure Document Vault, Verified Credentials, Portable References)
- **Seeker Navigation:** Dashboard, Find Jobs, My Profile, Licenses, Documents, Matches, Offers, Settings
- **Seeker Dashboard:** Stats (Profile %, Documents, Matches, Offers), cards (Profile, Docs, Matches), quick actions (Find Jobs, Upload License, Upload Documents, Complete Profile)
- **Employer Navigation:** Dashboard, Post Job, Company Profile, Hiring Manager, Verify Credentials, Applicants (Connections, Passed, Saved), References, Settings
- **Terminology:** "Swipe" → job review gesture labels (INTERESTED/PASS/SAVE), "Match" → Matches (kept professional), social/dating language removed
- **Hidden Features (code preserved):** Feed, Interviews, social features, advanced Hiring Suite tools (Offers tab, Policies tab, Reviews tab)
- **Bug Fix:** MatchesPage fetchMatches TDZ error resolved

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
