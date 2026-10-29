# Supabase + Vercel migration

## Implemented source changes

- 52 backend-only domain tables in app_private. JSONB preserves existing nested document shapes while moving filtering, sorting and writes to Postgres. This is a compatibility migration, not a fully normalized relational redesign.
- Parameterized SQL data layer supports the query/update operations found in the existing API. Unsupported tables, paths and operators fail closed. Updates use transactional row locks and collection-scoped advisory locks for upserts.
- Removed the exported unauthenticated default-password admin seed endpoint. Admin access must be granted by a trusted operator to an existing Supabase Auth user.
- Supabase Auth replaces locally generated JWTs and password hashes. Registration accepts only seeker/poster. The auth trigger creates safe application profiles; admin roles require a trusted administrative database action. Runtime authorization reads the backend-owned profile, never user-editable JWT metadata.
- Browser clients have no schema/table privileges. RLS is enabled with no permissive client policies. API handlers authenticate the user and enforce owner/employer/admin rules before data access; the server database connection is privileged and must never be exposed.
- Private Supabase Storage replaces platform object storage. The vault API now checks authorization and cloud storage directly rather than requiring a local file to exist.
- Direct OpenAI and official Stripe SDK integrations replace platform wrappers. Return URLs are constrained to FRONTEND_URL; signed Stripe webhooks and status polling use server-stored transaction ownership and amounts. Checkout settlement updates usage and marks a payment paid in one transaction, making repeat notifications idempotent.
- The weekly background loop is replaced by an authenticated cron route. Durable uploads no longer use project-local directories.
- Reduced and pinned Python runtime dependencies; the lockfile contains the tested resolved environment.

## External setup still required

1. Create the separate **VitalaMatch** organization in Supabase. Connecting GitHub alone does not create it. Do not modify the URSORA project.
2. Create a VitalaMatch project in that organization, then inspect its tables before applying the reviewed migration.
3. Apply the SQL migration. Run Supabase advisors and live schema/auth/storage tests. The local PGlite verification uses stub auth/storage schemas and cannot prove live Supabase configuration.
4. Configure Auth site URL and allowed redirects for the frontend. Email confirmation remains enabled by default; the UI handles confirmation-required signup. Configure an email provider before sending production confirmations.
5. Create two Vercel projects from the repository: `vitalamatch` with Root Directory `frontend`, and `vitalamatch-api` with Root Directory `backend`. Keep deployments in preview until cloud checks pass. The backend exports `server:app`; its cron configuration calls `/api/cron/document-expiration` weekly and requires CRON_SECRET.
6. Set backend environment values from `.env.example`. DATABASE_URL must use Supabase transaction pooling with SSL. Set REACT_APP_BACKEND_URL to the backend origin. Set CORS_ORIGINS and FRONTEND_URL to the exact frontend origin(s).
7. Configure optional AI/Stripe/email provider secrets directly in the host, then verify those services. Use Stripe test credentials during acceptance testing; configure the signed webhook endpoint and subscription/invoice event types.

No secrets are included in this repository. SUPABASE_SECRET_KEY, DATABASE_URL, Stripe and AI credentials belong only to the backend.

## Verification completed locally

- The FastAPI application imports with 194 registered routes using the reduced dependency set.
- Isolated tests cover registration role rejection, email-confirmation flow, private vault owner/outsider access, payment owner checks, signature validation, return URL validation, query injection rejection, query operator coverage and nested update semantics.
- PGlite executes the complete schema with test-only auth/storage schemas, checks the signup trigger, rejects self-assigned admin roles, denies the browser role access, verifies the private bucket flag and runs generated SQL query fixtures.
- Frontend CI build passed after the session/direct-upload changes; 22 isolated migration tests passed.
- Python dependency installation and full API import passed.

## Required cloud acceptance checks and open limitations

- Test real Supabase signup, email confirmation, login, refresh, signout, disabled accounts and user deletion.
- Test actual Postgres connection behavior, transactional updates/upserts under concurrency, live query plans and table grants. Collection-wide write locks favor correctness during migration but limit throughput; replace hot paths with targeted relational operations when measured.
- Test seeker/employer/admin access to jobs, matches, offers, messages, pipeline records and documents with separate accounts. The existing route authorization logic is retained and is not a comprehensive security audit.
- Test signed webhook delivery, duplicate events, checkout settlement, renewal failures and cancellations with Stripe test mode. No real payment or AI request has been made.
- **Large uploads require a live acceptance test:** the frontend now uploads file bytes directly to private Storage using signed upload URLs, then sends a signed, owner-bound upload ticket to the API. Authorized file downloads redirect to 90-second signed URLs. Verify a 10 MB upload/download in the deployed browser to confirm host limits and CORS behavior; tests do not prove real Storage configuration.
- Verify PDF/image AI extraction and unsupported formats with the direct provider. Missing optional provider keys return explicit unavailable/unverified responses.
- Test service-worker caching, expired sessions and the calendar's existing React/date-library peer-version mismatch in a browser.
- Cron delivery, production mail/SMS and document background processing still require live host verification. Exactly-once cron notification delivery is not guaranteed by the current legacy checker.

Do not describe this branch as deployment-ready until these checks and the upload limit issue are resolved.


## Reproduce the isolated schema check

Install Python test dependencies in a virtual environment, then:

```bash
npm ci --prefix backend/tests/migration
PYTHONPATH=backend python backend/tests/migration/query_fixtures.py > /tmp/vitala-query-fixtures.json
node backend/tests/migration/verify-schema.mjs supabase/migrations/20261029233816_supabase_backend.sql /tmp/vitala-query-fixtures.json
```

These checks operate only on an in-memory PostgreSQL engine with synthetic test
roles and do not apply migrations to any Supabase project.
