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
  - `/api/specialties` - Get nursing and allied health specialty lists
  - `/api/admin/check-expirations` - Manual trigger for document expiration check

### Frontend (React + Tailwind + Shadcn)
- **Pages**:
  - Landing page with hero, features, CTA sections
  - Auth page with login/register tabs and role selection
  - Seeker/Poster dashboards with stats and quick actions
  - Swipe page with Tinder-style card interface and swipe up for more details
  - Profile builder with 5 tabs (Basic Info, Work History, Credentials, Medical Records, Preferences)
  - Documents page with upload and expiration tracking
  - References page with blind reference system
  - Matches page with messaging
  - Settings page for notification preferences

### Integrations (Ready for API Keys)
- **SendGrid**: Email notifications for matches, messages, document reminders
  - Set `SENDGRID_API_KEY` and `SENDGRID_FROM_EMAIL` in backend/.env
- **Twilio**: SMS notifications 
  - Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` in backend/.env

### Background Jobs
- **Weekly Document Expiration Checker**: Runs automatically every 7 days
  - Checks for documents expiring within 30 days
  - Sends email/SMS reminders based on user preferences
  - Can be triggered manually via `/api/admin/check-expirations`

## Key Features Implemented
1. ✅ JWT authentication with role-based access
2. ✅ Tinder-style swipe matching with framer-motion
3. ✅ Compatibility scoring based on specialty, experience, location, certifications, benefits
4. ✅ Swipe up gesture to reveal more profile details
5. ✅ Document upload with 30-day expiration reminders
6. ✅ Blind reference system (hidden from requester, visible after match)
7. ✅ User-configurable notification preferences (email/SMS, frequency)
8. ✅ Real-time messaging in matches
9. ✅ Serene blue and green color scheme
10. ✅ Work History section with facility, position, department, dates, responsibilities
11. ✅ Medical Records tracking (TB tests, vaccinations, physicals, titers, etc.)
12. ✅ 90+ Nursing and Allied Health specialties
13. ✅ SendGrid/Twilio integration (ready for API keys)
14. ✅ Weekly background scheduler for document expiration reminders

## Specialties Available
### Nursing (40+ specialties)
- RN specialties: ICU, ER, OR, PACU, L&D, NICU, Pediatrics, Oncology, Cardiac, Med-Surg, etc.
- LPN/LVN
- Advanced Practice: NP, CNS, CRNA, CNM
- CNAs and PCTs

### Allied Health (50+ specialties)
- Therapy: PT, OT, SLP, RT
- Radiology: X-ray Tech, CT, MRI, Ultrasound, Nuclear Medicine
- Laboratory: MLT, MLS, Phlebotomy
- Pharmacy: Pharmacist, Pharmacy Tech
- Cardiovascular, Surgical, Emergency/EMS
- Mental Health: LCSW, Counselors, Psych Techs
- And many more...

## Next Tasks / Enhancements
1. Add profile image upload functionality
2. Add search/filter functionality for jobs
3. Implement notification bell with unread count
4. Add job analytics for posters (views, likes, matches)
5. Add compact license verification integration
6. Implement Stripe for premium features
