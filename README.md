# VitalaMatch

Healthcare hiring platform matching professionals with employers — featuring bidirectional matching, structured hiring pipelines, compliance tracking, and worker-first design.

## Architecture

| Layer     | Tech                              |
|-----------|-----------------------------------|
| Frontend  | React 18 · Tailwind CSS · Shadcn/UI |
| Backend   | FastAPI · Motor (async MongoDB)   |
| Database  | MongoDB                           |
| AI        | GPT-4.1 Vision (document verification) via Emergent LLM Key |

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.11+
- MongoDB 6+

### Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then fill in your values
uvicorn server:app --host 0.0.0.0 --port 8001
```

### Frontend
```bash
cd frontend
yarn install
cp .env.example .env   # set REACT_APP_BACKEND_URL
yarn start              # runs on port 3000
```

## Key Features

- **Tiered Matching** — Weighted compatibility scoring across specialty, certifications, shift preferences, location
- **Strict Role Eligibility** — Hard-filter system ensuring seekers only see jobs they're qualified for (CNA, RN, LPN, NP, etc.)
- **Kanban Hiring Pipeline** — Drag-and-drop stage management for employers
- **Document Vault** — Upload, auto-verify (PyMuPDF regex + GPT Vision fallback), and track credential expiration
- **Structured Offer Builder** — Pay, shifts, stipends, bonuses, typed signatures
- **Bidirectional Onboarding** — Shared checklists, readiness scoring, compliance tracking
- **Admin Dashboard** — User management, document review queue, jobs monitoring, audit logs
- **Privacy Gating** — Contact information hidden until mutual match
- **Resume Parser** — AI-powered profile auto-fill from uploaded resumes

## Project Structure

```
backend/
├── server.py              # Main FastAPI application
├── shared.py              # Pydantic models, DB config
├── eligibility.py         # Role eligibility engine
├── lightweight_parser.py  # PyMuPDF document verification
├── expiration_verifier.py # GPT Vision verification fallback
├── routes/                # Modular API routers
│   ├── auth.py, vault.py, pipeline.py, matching.py, ...
└── requirements.txt

frontend/
├── src/
│   ├── App.js             # Main app with routing
│   ├── pages/             # Page components
│   │   ├── ProfileBuilder.jsx, SwipePage.jsx, HiringPipelinePage.jsx, ...
│   ├── components/        # Shared components
│   │   ├── ui/            # Shadcn/UI primitives
│   │   ├── PageHeader.jsx, SmartDateInput.jsx, SeekerWalkthrough.jsx, ...
│   └── config/            # Feature flags, role taxonomy, suggestions
└── package.json
```

## Environment Variables

See `backend/.env.example` and `frontend/.env.example` for all required configuration.

## License

Private — all rights reserved.
