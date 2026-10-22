# AI-Powered Financial Document & Policy Analyzer

Upload loan agreements, audit reports or regulatory filings (PDF or TXT). The backend extracts text with page numbers, asks Claude or Gemini for a schema-validated risk analysis, checks each quotation against the source, and stores the result. The React dashboard shows live status, risk breakdowns and flagged clauses, and exports CSV or Excel audit reports.

## Layout

```
src/
├── backend/    FastAPI + SQLAlchemy 2.0 (async) + Alembic
└── frontend/   React 18 + TypeScript + Tailwind + Recharts + Lucide
```

## Backend

Requires Python 3.11+.

```bash
cd src/backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # then set ANTHROPIC_API_KEY and/or GEMINI_API_KEY
alembic upgrade head               # optional: tables are also created on startup for local dev
uvicorn app.main:app --reload --port 8000
```

API docs are at http://localhost:8000/docs.

### Key configuration (`.env`)

| Variable | Purpose |
| --- | --- |
| `LLM_PROVIDER` | Primary provider: `anthropic` or `gemini` |
| `LLM_FALLBACK_PROVIDER` | Optional. Used only after the primary fails its retries |
| `LLM_TEMPERATURE` | Defaults to `0.0` for reproducible extraction |
| `LLM_MAX_RETRIES` | Retries for transient errors (rate limits, 5xx, invalid output) |
| `DATABASE_URL` | SQLite by default. Use `postgresql+asyncpg://...` in production |

### Endpoints

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/v1/documents/upload` | Upload PDF/TXT; returns 202 and processes in the background |
| GET | `/api/v1/documents/` | List documents (`?status=`, `?skip=`, `?limit=`) |
| GET | `/api/v1/documents/{id}` | Document status |
| GET | `/api/v1/documents/{id}/analysis` | Full structured analysis |
| GET | `/api/v1/reports/export?format=xlsx\|csv` | Audit report download |
| GET | `/api/v1/dashboard/summary` | Aggregates for the dashboard |

### Hallucination controls

- The system prompt limits statements to text in the document and requires `null` for anything not stated.
- The document is wrapped in `<page number="n">` blocks, and the model must cite those page numbers.
- After the model responds, each `clause_text` is matched against the extracted text. Matches are marked `source_verified`. A wrong page number is corrected to where the quote actually appears. Unmatched quotes are kept but flagged for manual review.
- The risk level is derived from the score by a fixed rule, not taken from the model.

## Frontend

Requires Node 18+.

```bash
cd src/frontend
npm install
npm run dev          # http://localhost:5173 (proxies /api to :8000)
npm run build        # typecheck + production build
```
