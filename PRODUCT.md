# ResumeForge AI — Product Document

**Company:** Mitchell Strategic Solutions LLC
**Owner:** Rory Mitchell, CEO
**Last updated:** 2026-05-23
**Current phase:** Phase 10 — App Store Submission

---

## Overview

ResumeForge AI is a mobile-first iOS + Android application that uses AI to help job seekers get past Applicant Tracking Systems (ATS). The user uploads their resume and pastes a job description — the app scores their match, rewrites their resume to be ATS-optimized, and generates a tailored cover letter. Results export as PDF or Word (.docx) for immediate use.

**Why:** The ATS-optimization market is a $4.8B TAM growing at 28% CAGR. Most job seekers don't know their resume is being filtered before a human ever reads it. ResumeForge AI solves this with a mobile-native, AI-powered tool that takes under 90 seconds end-to-end.

---

## Current Status

| Area | Status |
|------|--------|
| Android app | Internal Testing track (Google Play), version code 5 |
| iOS app | Blocked — Apple Developer enrollment required ($99/yr) |
| Backend API | Live on Railway |
| Landing page | Live on Vercel |
| Supabase | Active — auth, database, storage |
| RevenueCat | Mocked in client — real config pending Play Store setup |
| PostHog analytics | Not yet integrated |

---

## User Flow

```
1. Sign in (Google OAuth via Supabase)
2. Upload resume (PDF or DOCX)
3. Paste job description text
4. Processing screen (~70s) — 6-step AI pipeline runs
5. Results screen:
   ├── Score tab    — match % + breakdown + strengths/gaps/ATS suggestions
   ├── Resume tab   — ATS-optimized resume (copy to clipboard)
   └── Cover Letter — tailored cover letter (copy to clipboard)
6. Done screen:
   ├── Resume   → [PDF] [Word]
   └── Cover    → [PDF] [Word]
```

---

## AI Pipeline (6 Steps)

The backend runs a sequential/parallel Claude API pipeline on every generation:

| Step | Module | Description |
|------|--------|-------------|
| 1 | `resumeParser.js` | Extracts structured JSON from raw resume text |
| 2 | `jobAnalyzer.js` | Extracts required skills, keywords, seniority from job description |
| 3 | `matchScorer.js` | Scores resume vs job (0–100), returns breakdown + strengths/gaps/ATS issues |
| 4 | `differentiatorAnalyzer.js` | Identifies candidate's strongest differentiators for this role |
| 5 | `resumeOptimizer.js` | Rewrites resume bullets and summary to be ATS-optimized |
| 6 | `coverLetterGenerator.js` | Generates a tailored cover letter from the optimized resume + job |

Steps 1–2 run in parallel. Steps 3–4 run in parallel after 1–2 complete. Steps 5–6 run sequentially.

**Model:** `claude-sonnet-4-6`
**Average pipeline time:** 68–77 seconds

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native (Expo SDK 54) |
| Backend | Node.js + Express |
| AI | Anthropic Claude API (Sonnet 4.6) |
| Auth | Supabase Auth (Google OAuth) |
| Database | Supabase (PostgreSQL) |
| File processing | pdf-parse, mammoth.js, docx |
| Payments | RevenueCat (IAP) + Stripe |
| Hosting — API | Railway |
| Hosting — Landing | Vercel |
| Analytics | PostHog (pending) |
| PDF export | expo-print (client-side, Harvard format) |
| Word export | docx npm package (backend-generated) |

---

## Repositories

| Repo | Branch | Purpose |
|------|--------|---------|
| `Rorym2/resumeforgeai-backend` | `main` | Node.js/Express API |
| `Rorym2/resumeforgeai-client` | `phase/10-app-store` | React Native mobile app |
| `Rorym2/resumeforgeai-landing` | `main` | Next.js landing page |

---

## Infrastructure

| Service | URL | Notes |
|---------|-----|-------|
| Backend API | `https://resumeforgeai-backend-production.up.railway.app` | Railway, auto-deploys on push to `main` |
| Landing page | `https://resumeforgeai-landing.vercel.app` | Vercel, auto-deploys on push |
| Supabase | `vvzimnitymgpyobkxuud.supabase.co` | Auth + DB + Storage |
| Google Play | Internal Testing, version code 5 | Promote to Production when listing complete |

---

## API Routes

All routes except `/health` require `Authorization: Bearer <supabase_jwt>`.

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/health` | Health check |
| POST | `/upload/resume` | Upload PDF/DOCX, returns `resume_text` + `resume_id` |
| POST | `/scrape/job` | Submit raw job description text |
| POST | `/scrape/job-url` | Scrape job from URL (Indeed, ZipRecruiter, generic) |
| POST | `/generate` | Run full AI pipeline, returns optimized resume + cover letter + score |
| GET | `/documents` | List user's generation history |
| GET | `/documents/:id` | Get single generation with full content |
| POST | `/documents/export` | Generate Word (.docx) from structured resume or cover letter |

---

## Database Schema (Supabase)

### `generations`
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | Foreign key → auth.users |
| `resume_id` | uuid | Source resume reference |
| `job_text` | text | Raw job description |
| `job_analysis` | jsonb | Parsed job data |
| `match_score` | jsonb | Score + breakdown + strengths/gaps |
| `differentiators` | jsonb | Candidate differentiators |
| `optimized_resume` | jsonb | ATS-optimized resume (structured) |
| `cover_letter` | jsonb | Generated cover letter |
| `duration_seconds` | float | Pipeline execution time |
| `created_at` | timestamptz | Creation timestamp |

### `usage_tracking`
| Column | Type | Description |
|--------|------|-------------|
| `user_id` | uuid | Foreign key → auth.users |
| `month` | text | e.g. `2026-05` |
| `generation_count` | int | Generations used this month |

### `resumes`
Stores uploaded resume files and extracted text per user.

---

## Auth Pattern

Client-side Supabase Auth only. The mobile app authenticates directly with Supabase (Google OAuth), receives a JWT, and attaches it to every backend request. The backend verifies JWTs via `requireAuth` middleware — there are no custom register/login routes.

---

## Pricing Model

| Tier | Price | Limit |
|------|-------|-------|
| Free | $0 | 3 generations/month |
| Pro Monthly | $12.99/mo | Unlimited |
| Pro Annual | $7.99/mo ($95.88/yr) | Unlimited |
| Pay-Per-Use | $2.99 | 1 generation |

Free tier limit is enforced server-side via `usage_tracking`. Pro status is checked via RevenueCat API on every generation request.

---

## Export Formats

| Format | How | Use case |
|--------|-----|----------|
| PDF | `expo-print` — Harvard Business resume template (Times New Roman 11pt, 1" margins, bold orgs, right-aligned dates, italic titles) | Send directly to recruiters |
| Word (.docx) | Backend-generated via `docx` package, shared via Android share sheet | Open in Google Docs to edit |

---

## Score Tab (Match Scorecard)

Displayed as the first tab on the Results screen:

- **Overall match score** (0–100, weighted: Skills 40% / Experience 40% / Education 20%)
- **Score breakdown** — horizontal progress bars per category, color-coded green/amber/red
- **Strengths** — ✓ green bullet list
- **Gaps** — ✕ red bullet list
- **ATS Suggestions** — → blue bullet list
- **Recommendation** — prioritized 2–3 sentence advice

---

## Environment Variables

### Backend (Railway)
| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Claude API key |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon key (legacy JWT format) |
| `REVENUECAT_API_KEY` | RevenueCat secret key |
| `PORT` | Set automatically by Railway |

### Client (EAS / `.env`)
| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_API_URL` | Backend URL |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (legacy JWT format) |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | RevenueCat Android public key |

---

## Build & Deploy

### Backend
```bash
cd resumeforgeai-backend
railway up          # manual deploy to Railway
# OR: push to main → GitHub Actions auto-deploys via RAILWAY_TOKEN secret
```

### Android (EAS)
```bash
cd resumeforgeai-client   # or C:\rfai\client
eas build --platform android --profile production
eas submit --platform android
```

### iOS (blocked — Apple enrollment required)
```bash
eas build --platform ios --profile production
eas submit --platform ios
```

### Landing page
Push to `main` on `Rorym2/resumeforgeai-landing` — Vercel auto-deploys.

---

## EAS Notes

- `google-play-service-account.json` is gitignored — keep at `C:\Users\Rorym\Documents\resumeforgeai\resumeforgeai-client\`
- Service account: `eas-play-store@project-2b224133-0a9a-4e76-b87.iam.gserviceaccount.com`
- Supabase anon key must be legacy JWT format — NOT the `sb_publishable_` format
- All 3 `EXPO_PUBLIC_*` vars must be set in the `production` profile in `eas.json`

---

## KPIs (6-Month Targets)

| Metric | Target |
|--------|--------|
| Monthly Active Users | 5,000 |
| Resume generations/month | 15,000 |
| Conversion to paid | 8% |
| App Store rating | 4.5+ |

---

## Phase 10 Remaining Tasks

- [ ] Complete Google Play store listing (screenshots, description) — required before promoting to Production
- [ ] Enroll in Apple Developer Program ($99/yr — developer.apple.com) — unblocks all iOS work
- [ ] Configure RevenueCat with real Play Store product IDs — swap mock in `src/lib/purchases.js`
- [ ] Run EAS iOS build (blocked on Apple enrollment)
- [ ] Update landing page store badge links once apps are live
- [ ] Integrate PostHog analytics
- [ ] Add in-app feedback prompt
- [ ] Product Hunt launch + social push

---

## Deferred (v1.1)

- **Confidence score displayed pre-generation** — show users a preview score before running the full pipeline
- **Resume history editing** — allow users to re-export past generations
- **LinkedIn import** — import resume directly from LinkedIn profile

---

## Key Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Job board scraping blocked | High | High | Fallback to user-pasted text (already implemented) |
| AI hallucinating experience | Medium | Critical | Strict prompt engineering + output validation |
| Claude API cost at scale | Medium | Medium | Caching + token optimization |
| Apple rejection | Low | High | Follow HIG guidelines, no misleading claims |
