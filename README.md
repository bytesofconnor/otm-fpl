# Over the Moon

**Live Fantrax companion for the Over the Moon FPL draft league.**

Monorepo root with web app in `web/`.

## What is Over the Moon?

Over the Moon is a Next.js web app that provides live league standings, head-to-head matchup details, and player form analysis for the Over the Moon FPL draft league hosted on Fantrax.

### Features

- **League (This Week HQ)**: Current gameweek standings, live scoring, and head-to-head matchup results
- **Form**: Player performance analysis comparing scored points vs leftover (bench) points to identify waiver wire opportunities
- **Rankings** (optional): Personal player ranking tool with shareable links
- **Compare** (optional): Side-by-side player comparison tool
- **Predicted** (optional): Pre-season player projections

The product focuses on League and Form as the core features. Rankings, Compare, and Predicted remain as helpful tools but are not the main value proposition.

## Development

- Local dev: `cd web && npm ci && npm run dev`
- Production build: `cd web && npm run build && npm start -p 3000`
- E2E tests: `cd web && npm run test:e2e`

## Analytics & Monitoring

This app includes free Vercel Analytics and Speed Insights for tracking usage and performance:

- **Web Analytics**: Track page views, visitors, and top pages (free on Hobby plan)
- **Speed Insights**: Monitor Core Web Vitals and real user performance metrics (free)

### Enabling in Vercel Dashboard

The code is already instrumented with `@vercel/analytics` and `@vercel/speed-insights`. To start collecting data:

1. Go to your Vercel project dashboard: https://vercel.com/your-team/otm-fpl
2. Click the **Analytics** tab
3. Click **Enable Web Analytics** (free on Hobby plan)
4. Speed Insights is automatically enabled once Analytics is active

No code changes or environment variables needed—it works out of the box once enabled in the dashboard.

## CI/CD

- **checks** runs on every PR and push to `main` (`.github/workflows/ci.yml`): lint, typecheck, unit tests, `next build`, and Playwright smoke
- **Convex** deploys on push to `main` and when a PR into `main` merges (`.github/workflows/convex-deploy.yml`) with the `CONVEX_DEPLOY_KEY` repository secret
- Smoke tests use mocked API responses. No secrets are required in `checks`

## Deployment (Vercel)

- Set Root Directory to `web/` so `web/vercel.json` is used (daily projection capture cron)
- Install Command: `npm ci`
- Build Command: `next build`
- Output: `.next`
- Convex functions deploy from GitHub Actions, not from the Vercel build

## Environment Variables

See `web/.env.example`. Production needs:

- `NEXT_PUBLIC_CONVEX_URL` — Convex deployment URL (from Convex dashboard or `npx convex dev`)
- `CONVEX_DEPLOYMENT` — Convex deployment name (for server-side mutations)
- `CONVEX_DEPLOY_KEY` — Deploy key for CI/CD (keep secret! Get from Convex dashboard Settings > Deploy Keys)
- `CRON_SECRET` — Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` to `GET /api/fantrax/capture` at 08:00 UTC

### Convex Setup

1. Sign up at [convex.dev](https://www.convex.dev) and create a project
2. Run `cd web && npx convex dev` to link your local environment
3. Copy `NEXT_PUBLIC_CONVEX_URL` from `.env.local` to Vercel environment variables
4. Get `CONVEX_DEPLOY_KEY` from Convex dashboard → Settings → Deploy Keys
5. Production data is already imported. Do not rerun `scripts/import-supabase-export.ts` unless you are rebuilding an empty deployment.

Capture skips finished and in-progress fixtures. It does not backfill gameweeks after those games have scored.

## Data Sources

The app pulls live league data from Fantrax. It does not replicate Fantrax functionality—it enhances the league experience with focused views on this week's action and player form trends.
