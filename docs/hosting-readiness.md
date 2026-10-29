# Hosting readiness audit

## Verdict

The React frontend can be hosted on Vercel after a successful production build. The complete application is **not yet ready** for a standalone Supabase + Vercel deployment. No intentional provider lock or host-denial check was found in the application source reviewed, but several functional dependencies require migration.

## Frontend cleanup

- Removed the remote platform bootstrap and iframe debug scripts from public/index.html.
- Removed the hardcoded PostHog account and automatic tracking script; ownership of that analytics destination was not established.
- Removed visual-editor middleware, Babel instrumentation, and development health tooling. The editor middleware included source-file editing and Git-commit endpoints; these are not application features.
- Retained the source alias used by application imports.
- Added frontend/vercel.json with the Create React App build preset, build output, client route fallback excluding /api, and no-cache service-worker headers.
- Fixed API URL construction so an unset variable does not create undefined/api URLs, and removed trailing slashes before appending /api. Empty configuration expects an actual same-origin API; the static build does not provide one.

## Vercel frontend configuration

Import this repository and set **Root Directory to frontend**. Build command: yarn build. Output directory: build. Install from the committed yarn.lock. Set REACT_APP_BACKEND_URL to the deployed API origin, without /api or a trailing slash. Do not point it directly to a Supabase project URL: the frontend currently expects the existing FastAPI endpoints. All REACT_APP_ variables are public browser values.

Client route rewrites follow Vercel's configuration documentation: https://vercel.com/docs/routing/rewrites . API paths are deliberately excluded from the HTML fallback so missing backend routes are not disguised as successful HTML responses.

## Remaining migration blockers

| Area | Evidence | Required work |
| --- | --- | --- |
| Database | backend/server.py and backend/shared.py create Motor clients using MONGO_URL and DB_NAME; route code uses Mongo queries | Design Postgres tables, indexes, relationships and row-level policies; port queries to Supabase/Postgres |
| Authentication | Custom JWT creation/validation in server.py and shared.py; frontend stores its API token in localStorage | Integrate Supabase Auth and update API token validation and authorization while preserving seeker/poster/admin roles |
| Uploaded files | backend/object_storage.py calls integrations.emergentagent.com using EMERGENT_LLM_KEY | Replace with private Supabase Storage and preserve owner/authorized-employer access checks |
| AI document parsing | backend/resume_parser.py and backend/expiration_verifier.py import emergentintegrations.llm.chat | Replace with an independently configured provider SDK; keep provider keys on the server |
| Payments | backend/routes/billing.py and server.py import emergentintegrations.payments.stripe.checkout | Replace with the Stripe SDK and verify signed webhooks, checkout status and entitlement behavior |
| Backend dependencies | backend/requirements.txt includes emergentintegrations and a wheel hosted on customer-assets.emergentagent.com | Replace provider adapters first, then remove platform-only dependencies and build a minimal supported dependency set |
| Local disk | shared.py creates uploads/vault at import; server.py writes feed images to uploads/feed | Move durable files to object storage; use temporary storage only for transient processing |
| Scheduler | server.py lifespan launches an infinite weekly scheduler via asyncio.create_task | Move scheduled work to a persistent scheduled invocation; do not depend on a serverless process staying alive |
| API deployment | Repository has no Vercel backend entrypoint or routing configuration | Package and verify a supported API deployment after backend migration; static frontend deployment alone is insufficient |
| Production configuration | JWT_SECRET, origin URLs, email/SMS/payment credentials and CORS are runtime configuration | Configure only the services actually used; set explicit allowed origins and keep ALLOW_DEV_BYPASS=false |

The audit found 185 route decorator declarations in the backend source. This is a substantive backend migration, not only a hosting-settings change. Existing data is test data, so no production-data import is required.

## Verification scope

Source audit covers tracked application code, dependency manifests, configuration, HTML and service worker. Only example env files are tracked in the current tree; this is not a full historical secret audit. No browser session, live backend, Supabase schema, or payment flow has been verified in this audit. A successful static build establishes frontend compilation only.
