# MedJobMatch - Medical Professional Job Board

## Original Problem Statement
Build a job board app for medical professionals that imitates Tinder's matching platform. The color scheme should be a serene blue and green. 

### Job Seekers Profile Features:
- Universal application with contact information, work history, certifications, licenses
- Expected pay expectations and desired benefits
- Personal medical records (TB tests, COVID-19 vaccinations, MMR vaccinations/Titers, annual physical)

### Job Posters Profile Features:
- Location of job, duration of assignment, benefits offered
- Job description, pay range, time off policies
- Job requirements, necessary certifications and experience

### Additional Features:
- Reference request system (blind - not visible to the requester)
- Document upload with 30-day expiration reminders
- Email/SMS notifications with user preference settings
- Swipe matching with compatibility scores

## Architecture

### Backend (FastAPI + MongoDB)
- **Authentication**: JWT-based email/password auth
- **Models**: User, SeekerProfile, PosterProfile, Job, Match, Reference, Document, NotificationPreferences, Message
- **Key Endpoints**:
  - `/api/auth/*` - Register, login, current user
  - `/api/profile/*` - Seeker and poster profile management
  - `/api/jobs/*` - Job posting CRUD
  - `/api/swipe/*` - Get swipeable items with compatibility scores
  - `/api/matches/*` - Match management and messaging
  - `/api/references/*` - Blind reference request system
  - `/api/documents/*` - Document upload with expiration tracking
  - `/api/notifications/preferences` - User notification settings

### Frontend (React + Tailwind + Shadcn)
- **Pages**:
  - Landing page with hero, features, CTA sections
  - Auth page with login/register tabs and role selection
  - Seeker/Poster dashboards with stats and quick actions
  - Swipe page with Tinder-style card interface and swipe up for more details
  - Profile builder with comprehensive form sections
  - Documents page with upload and expiration tracking
  - References page with blind reference system
  - Matches page with messaging
  - Settings page for notification preferences

### Key Features Implemented:
1. ✅ JWT authentication with role-based access
2. ✅ Tinder-style swipe matching with framer-motion
3. ✅ Compatibility scoring based on specialty, experience, location, certifications, benefits
4. ✅ Swipe up gesture to reveal more profile details
5. ✅ Document upload with 30-day expiration reminders
6. ✅ Blind reference system (hidden from requester, visible after match)
7. ✅ User-configurable notification preferences (email/SMS, frequency)
8. ✅ Real-time messaging in matches
9. ✅ Serene blue and green color scheme

## Next Tasks / Enhancements
1. Implement actual email notifications via SendGrid (currently placeholder)
2. Implement SMS notifications via Twilio (currently placeholder)
3. Add background job for checking document expirations and sending reminders
4. Add profile image upload functionality
5. Implement work history section in seeker profile
6. Add medical records upload with specific document types
7. Add search/filter functionality for jobs
8. Implement notification bell with unread count
9. Add job analytics for posters (views, likes, matches)
