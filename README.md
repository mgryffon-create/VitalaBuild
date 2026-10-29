# VitalaMatch

Healthcare hiring platform with seeker and employer profiles, bidirectional matching, offers, hiring pipelines and a private document vault.

## Architecture

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Tailwind, Shadcn UI; Vercel static frontend |
| API | FastAPI on Vercel |
| Identity | Supabase Auth; application roles stored in backend-owned profiles |
| Data | Supabase Postgres; backend-only domain tables with JSONB payloads |
| Files | Private Supabase Storage |
| AI | Direct OpenAI SDK (optional) |
| Payments | Official Stripe SDK (optional) |
| Scheduling | Protected Vercel cron endpoint |

## Migration status

This branch contains the Supabase migration implementation. It is not a verified live deployment. The separate Supabase organization/project, runtime secrets, live SQL verification, and end-to-end cloud checks are still required. See [migration instructions and verification limits](docs/supabase-migration.md).

The earlier [hosting audit](docs/hosting-readiness.md) records findings from the original export. Its backend blockers are the starting point for this migration, not the current code inventory.

## Local setup

Use Python 3.12 and Node.js 22 or newer. Install the Python runtime with `pip install -r backend/requirements.lock` and the frontend with `yarn --cwd frontend install --frozen-lockfile`.

Configure the backend from `backend/.env.example` and frontend from `frontend/.env.example`; never commit secrets. Apply the reviewed SQL migration to an isolated Supabase project before running the API. Use the transaction pooler URL for DATABASE_URL, with SSL enabled. Prepared statements are disabled by the data layer.

After project linking, secrets, and schema are configured:

```bash
cd backend
uvicorn server:app --host 0.0.0.0 --port 8001
```

In another terminal:

```bash
yarn --cwd frontend start
```

## Checks

```bash
PYTHONPATH=backend pytest -q backend/tests/migration
CI=true yarn --cwd frontend build
```

The full original API tests depend on seeded users and a running service; they are not equivalent to the isolated migration checks.

## License

Private — all rights reserved.
