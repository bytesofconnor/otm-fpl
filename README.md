# OTM FPL Draftkit

Monorepo root with web app in `web/`.

- Local dev: `cd web && npm ci && npm run dev`
- Production build: `cd web && npm run build && npm start -p 3000`

Deploy notes (Vercel):
- Set Root Directory to `web/` or use `vercel.json` provided
- Install Command: `cd web && npm ci`
- Build Command: `cd web && npm run build`
- Output: `.next`

## Payments (no DB, license-token model)

This app uses Stripe Checkout plus a signed license token to unlock the paid experience without a database or user accounts.

### Overview

1. User clicks Unlock → POST `/api/checkout` creates a Stripe Checkout Session and redirects.
2. On success, Stripe returns to `/success?session_id=...`.
3. Client calls `/api/verify?session_id=...`.
   - Server validates session and payment.
   - Sets httpOnly cookie `otm_paid=1` (1 year, SameSite=Lax, Secure on https).
   - Returns a signed license token (JWT-like; HMAC SHA-256) stored in `localStorage` as `otm_license`.
4. On any device, paste this token via “Restore purchase” → POST `/api/license/activate` verifies signature/expiry and sets the paid cookie.

No DB is required. Rankings still sync via the existing shareable link.

### Environment variables

Required:

- `STRIPE_SECRET_KEY` – Stripe secret key
- `STRIPE_PRICE_ID` – one-time price ID (e.g., `price_...`)
- `NEXT_PUBLIC_BASE_URL` – e.g., `https://yourdomain.com`
- `NEXT_PUBLIC_PAID_HOST` – host where paywall is enforced (e.g., `yourdomain.com`)

Licensing:

- `LICENSE_SECRET` – HMAC secret (fallback)
- `LICENSE_SECRETS` – optional comma-separated secrets for key rotation (first is active, `kid=0`)

Optional:

- `NEXT_PUBLIC_FLAG_PAID_VERSION=1` – enable paid gating

### Frozen weekly projections (Supabase + Vercel Cron)

Fantrax overwrites weekly projected FPts with scored FPts after a fixture. Daily capture freezes the pre-kickoff number (first snapshot wins) so Form can show leftover.

- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — apply `supabase/migrations/20260828000000_create_projection_snapshots.sql`
- `CRON_SECRET` — Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` to `GET /api/fantrax/capture` at 08:00 UTC (`web/vercel.json`). Hobby plans allow one daily cron.
- Capture skips finished and in-progress fixtures. It does not backfill GW1 after those games have scored.

### Security & robustness

- Tokens are HMAC-signed; server verifies signature and expiry.
- Key rotation supported via `LICENSE_SECRETS` (comma-separated). Tokens include `kid` (0) to select the key.
- Cookies are `httpOnly`, `SameSite=Lax`, and `Secure` when served over https.
- Activation uses POST body (not query string) to avoid URL logging of tokens.
- Success page saves token to `localStorage` so users can copy it later. Encourage users to store tokens privately.

Threat model notes:

- Tokens are bearer keys; if leaked, access is granted until expiry. Keep `LICENSE_SECRET(S)` safe.
- No server-side revocation without a DB. To revoke widely leaked tokens, rotate secrets and reissue.
- Paywall is enforced per browser via cookie; clearing cookies requires re-activation (paste token again).

### Endpoints

- `POST /api/checkout` → `{ url }`
- `GET /api/verify?session_id=` → `{ ok, token? }` and sets `otm_paid` cookie
- `GET /api/me` → `{ paid }`
- `POST /api/license/activate` `{ token }` → `{ ok }` and sets `otm_paid` cookie

### Client hooks

- Paid gating is controlled by `PAID_VERSION` feature flag (see `web/src/lib/feature-flags.ts`) and `NEXT_PUBLIC_PAID_HOST`.
- Compare page enforces a 25-pick preview when paywall is active.

### Development notes

- In dev, set `NEXT_PUBLIC_BASE_URL=http://localhost:3000`.
- If testing across fresh browsers, paste the token via “Restore purchase”.
