# ResumeForge AI — Agent Handoff (Backend)

**Last updated:** 2026-05-22
**Project owner:** Rory Mitchell, CEO — Mitchell Strategic Solutions LLC
**Current phase:** Phase 10 — App Store Submission

---

## Project Overview

ResumeForge AI is a mobile-first iOS + Android app that takes a user's resume (PDF/DOCX) + a job listing URL and generates an ATS-optimized resume and tailored cover letter using the Anthropic Claude API.

---

## Repos

| Repo | Branch | Purpose |
|------|--------|---------|
| `Rorym2/resumeforgeai-backend` | `main` | Node.js/Express API |
| `Rorym2/resumeforgeai-client` | `phase/10-app-store` | React Native (Expo) mobile app |
| `Rorym2/resumeforgeai-landing` | `main` | Next.js landing page |

**Local paths:**
- Backend: `C:\Users\Rorym\Documents\resumeforgeai\resumeforgeai-backend`
- Client: `C:\Users\Rorym\Documents\resumeforgeai\resumeforgeai-client` (also mirrored at `C:\rfai\client` to avoid Windows long path issues)
- Landing: `C:\Users\Rorym\Documents\resumeforgeai\resumeforgeai-landing`

---

## Infrastructure

| Service | URL / Detail | Status |
|---------|-------------|--------|
| Backend | `https://resumeforgeai-backend-production.up.railway.app` | Live |
| Landing page | `https://resumeforgeai-landing.vercel.app` | Live |
| Supabase | `vvzimnitymgpyobkxuud.supabase.co` | Active |
| Google Play | Internal Testing track, version code 5 | Active |
| Apple App Store | NOT enrolled yet — blocks all iOS work | Blocked |

**Important:** Railway does NOT auto-deploy from GitHub. You must run `railway up` manually from the backend folder after any changes.

---

## Tech Stack

- **Mobile:** React Native (Expo)
- **Backend:** Node.js + Express
- **AI:** Anthropic Claude API (Sonnet) — structured output for resume rewriting
- **Job scraping:** Custom scrapers + Apify/BrightData fallback
- **File processing:** pdf-parse, mammoth.js, docx
- **Database/Auth/Storage:** Supabase (PostgreSQL)
- **Payments:** Stripe + RevenueCat (IAP)
- **Hosting:** Railway (API), Vercel (landing)
- **Analytics:** PostHog (not yet integrated)

---

## Auth Pattern

Client-side Supabase Auth only. The mobile app authenticates directly with Supabase, gets a JWT, and sends it to the backend. The backend verifies the JWT via middleware. There are no custom register/login routes on the backend.

---

## EAS / Build Notes

- `google-play-service-account.json` is gitignored — lives only at `C:\Users\Rorym\Documents\resumeforgeai\resumeforgeai-client\`
- EAS service account: `eas-play-store@project-2b224133-0a9a-4e76-b87.iam.gserviceaccount.com`
- Supabase anon key must be the legacy JWT format — NOT the `sb_publishable_` format
- All 3 env vars must be in `eas.json` production profile: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`

---

## Pricing

| Tier | Price |
|------|-------|
| Free | 3 generations/month, PDF only |
| Pro Monthly | $12.99/mo |
| Pro Annual | $7.99/mo ($95.88/yr) |
| Pay-Per-Use | $2.99/generation |

---

## Phase 10 Remaining Tasks

- [ ] Complete Google Play store listing — needs review before promoting to Production
- [ ] Enroll in Apple Developer Program ($99/yr at developer.apple.com) — unblocks all iOS work
- [ ] Swap RevenueCat mock in `src/lib/purchases.js` with real config after Play Store setup
- [ ] Run EAS iOS build (blocked on Apple enrollment)
- [ ] Update landing page store badge links once apps are approved
- [ ] Integrate PostHog analytics
- [ ] Add in-app feedback
- [ ] Product Hunt launch + social push

---

## Deferred (v1.1)

- **Confidence score** — match score between resume and job listing (Rory's idea, raised after Phase 1 test)

---

## Key Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Job board scraping blocked | High | High | Fallback to user-pasted text |
| AI hallucinating experience | Medium | Critical | Strict prompt engineering + validation |
| Claude API cost at scale | Medium | Medium | Caching + token optimization |
