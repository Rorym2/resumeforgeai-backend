# ResumeForge AI — Backend Handoff Notes
_Last updated: 2026-03-13_

## Overview

ResumeForge AI is a mobile-first ATS resume optimization app. Users upload a resume and paste a job description; the backend runs it through an AI pipeline (Anthropic Claude API) and returns an optimized resume, a tailored cover letter, and a match score.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js + Express |
| AI | Anthropic Claude API (`claude-sonnet-4-6`) |
| Database / Auth | Supabase (Postgres + Auth) |
| File parsing | `pdf-parse`, `mammoth` (DOCX) |
| Deployment target | Railway or Render (not yet deployed) |

---

## Repository Structure

```
resumeforgeai-backend/
├── index.js                  # Express app entry point
├── .env                      # Secrets (not committed — see below)
├── src/
│   ├── ai/
│   │   ├── resumeParser.js       # Extracts structured data from raw resume text
│   │   ├── jobAnalyzer.js        # Extracts requirements/keywords from job description
│   │   ├── resumeOptimizer.js    # Rewrites resume to match job (ATS-optimized)
│   │   ├── coverLetterWriter.js  # Generates tailored cover letter
│   │   ├── matchScorer.js        # Scores resume-to-job match (0–100)
│   │   └── differentiatorAnalyzer.js # Identifies candidate's unique strengths
│   ├── lib/
│   │   └── supabase.js           # Supabase service-role client (DB operations)
│   ├── middleware/
│   │   └── auth.js               # JWT verification via Supabase anon key
│   └── routes/
│       ├── upload.js             # POST /upload/resume — parses file, saves to DB
│       ├── generate.js           # POST /generate — full AI pipeline
│       ├── documents.js          # GET /documents — user's history
│       └── scrape.js             # POST /scrape/job — accepts pasted job text
```

---

## Authentication Architecture

**Client-side Supabase Auth** was chosen over custom backend auth routes.

Flow:
1. Mobile app signs in via `supabase.auth.signInWithPassword()` directly to Supabase
2. Supabase returns a JWT access token
3. App sends `Authorization: Bearer <token>` header on every backend request
4. Backend middleware (`src/middleware/auth.js`) verifies the token by calling `supabaseAuth.auth.getUser(token)` using the **anon key**
5. `req.user` is populated with the verified Supabase user object

**Why:** Standard pattern for Supabase + Express. Simpler than rolling custom sessions, and Supabase handles token refresh, password reset, etc.

---

## Environment Variables (`.env`)

```
ANTHROPIC_API_KEY=sk-ant-...
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
SUPABASE_ANON_KEY=eyJ...
PORT=3000
```

- `SERVICE_ROLE_KEY` — used in `src/lib/supabase.js` for server-side DB writes (bypasses RLS)
- `ANON_KEY` — used in `src/middleware/auth.js` only for JWT verification
- Never commit `.env` — it is in `.gitignore`

---

## Database Schema (Supabase)

### `profiles`
Auto-created on user signup via a Postgres trigger (`on_auth_user_created`).

| Column | Type | Notes |
|---|---|---|
| id | uuid | FK → auth.users |
| full_name | text | nullable |
| created_at | timestamptz | |

### `resumes`
Stores extracted text from uploaded files.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → auth.users |
| filename | text | Original file name |
| text_content | text | Extracted plain text |
| created_at | timestamptz | |

### `generations`
Stores AI pipeline results.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → auth.users |
| resume_id | uuid | FK → resumes |
| job_text | text | Raw job description pasted by user |
| parsed_resume | jsonb | Output of resumeParser |
| parsed_job | jsonb | Output of jobAnalyzer |
| match_score | jsonb | Output of matchScorer |
| optimized_resume | jsonb | Output of resumeOptimizer |
| cover_letter | jsonb | Output of coverLetterWriter |
| differentiators | jsonb | Output of differentiatorAnalyzer |
| created_at | timestamptz | |

### `usage_tracking`
Enforces the free tier limit (3 generations per calendar month).

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → auth.users |
| month | text | Format: `YYYY-MM` |
| generation_count | int | Default 0 |

Unique constraint on `(user_id, month)`. Backend increments on each generation and rejects if count ≥ 3.

### Row Level Security
RLS is enabled on all tables. Users can only read/write their own rows. The backend uses the service role key to bypass RLS for writes.

---

## API Endpoints

All routes except the health check require `Authorization: Bearer <jwt>`.

### `GET /health`
Returns `{ status: 'ok' }`. No auth required.

### `POST /upload/resume`
- Body: `multipart/form-data` with `resume` field (PDF or DOCX, max 10MB)
- Parses file, extracts plain text, saves to `resumes` table
- Returns: `{ resume_id, text, filename }`

### `POST /scrape/job`
- Body: `{ text: string }`
- Currently just validates and returns the text (URL scraping planned for Phase 7)
- Returns: `{ job_text }`

### `POST /generate`
- Body: `{ resume_text, job_text, resume_id }`
- Checks free tier (3/month) — returns `402` if limit reached
- Runs full AI pipeline sequentially
- Saves results to `generations` table, increments `usage_tracking`
- Returns: full generation object (all AI outputs)

### `GET /documents`
- Returns array of user's past generations from `generations` table
- Ordered by `created_at DESC`

---

## AI Pipeline (`src/ai/`)

Each module calls the Claude API independently. The pipeline runs sequentially in `generate.js`:

1. `resumeParser` — structured JSON from raw resume text
2. `jobAnalyzer` — required skills, keywords, tone from job description
3. `matchScorer` — numeric score + gap analysis
4. `differentiatorAnalyzer` — candidate's unique selling points
5. `resumeOptimizer` — ATS-rewritten resume (uses outputs from steps 1–4)
6. `coverLetterWriter` — tailored cover letter (uses all prior outputs)

---

## Git Branches

| Branch | Status | What's in it |
|---|---|---|
| `main` | stable | initial empty commit |
| `phase/0-environment-setup` | complete | Express scaffold, env setup |
| `phase/1-ai-engine` | complete | All 6 AI modules |
| `phase/2-backend-api` | complete | All 4 API routes (stub auth) |
| `phase/3-database-auth` | complete | Supabase integration, JWT middleware, DB schema |

Current active branch: `phase/3-database-auth`

---

## What's Left (Phases 4–10)

- **Phase 4** (in progress on client): Mobile screens — upload, job input, processing, results
- **Phase 5**: Mobile auth — Supabase login/signup screens in the app
- **Phase 6**: Subscriptions — RevenueCat integration, paywall screen, free tier enforcement
- **Phase 7**: Job URL scraping — parse job listings from URLs
- **Phase 8**: Document history — saved results screen, re-view past generations
- **Phase 9**: Polish — onboarding, empty states, error handling, analytics
- **Phase 10**: Launch prep — App Store / Play Store submission, deployment to Railway/Render

---

## Known Issues / Notes for Advisor

1. **Free tier enforcement** is implemented in `generate.js` but not tested end-to-end with a real user yet (client auth not wired in yet).
2. **File size limit** is set to 10MB in `upload.js` via `multer`. Adjust if needed.
3. **AI prompt tuning** — the prompts in `src/ai/` are first-pass. They work but will benefit from iteration once real user resumes are tested.
4. **No rate limiting or abuse protection** yet on the API — should be added before public launch.
5. **No deployment pipeline** — manual deploy to Railway/Render planned for Phase 10.
