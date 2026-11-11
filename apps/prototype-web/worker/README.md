# Micro network worker (EX-D18)

Cloudflare Pages advanced-mode worker (`_worker.js`) for the Micro Market +
Delivery network layer — same-origin BFF compatible with Pages
Functions/Workers, built from `worker/index.ts` by
`apps/prototype-web/scripts/build-worker.mjs` into
`apps/prototype-web/dist/public/_worker.js` **after** the client build (so the
service-worker precache manifest never includes the worker).

## Layout

| Path | Purpose |
|---|---|
| `index.ts` | Entry: `/api/*` routing, static assets + SPA fallback, security headers |
| `env.ts` | Binding/secret NAMES and engineering defaults (no values live here) |
| `auth/` | Google OIDC (authorization-code + strict payload validation), D1-backed sessions, CSRF/origin |
| `db/migrations/` | Versioned D1 migrations (network entities ONLY — never Manage data) |
| `api/` | Route handlers (auth, media, system) |
| `authorization.ts` | Server-side capability resolution (guest/authenticated/vendor/driver/admin) |
| `media.ts` | Private R2 object handling (random keys, authorized reads only) |
| `tests/` | Real workerd + D1 + R2 emulation tests (Miniflare + esbuild harness) |

## Bindings and secrets (owner/Manus setup — names only)

| Name | Kind | Purpose |
|---|---|---|
| `DB` | D1 binding | Market/Delivery network data |
| `MEDIA` | R2 bucket binding (private) | Listing images + driver evidence |
| `ASSETS` | Pages-provided | Static assets (automatic) |
| `GOOGLE_CLIENT_ID` | Var | Google OAuth client id |
| `GOOGLE_CLIENT_SECRET` | Secret | Google OAuth client secret |
| `BOOTSTRAP_OWNER_EMAIL` | Var/Secret (one-time) | First admin bootstrap; remove after use |

No production database/account/zone IDs, domains, or secret values belong in
this repository. Sessions use the `micro_session` HttpOnly cookie.

## Local development (no Cloudflare account required)

```bash
pnpm install --frozen-lockfile
pnpm --filter @micro/prototype-web build        # client + worker into dist/public
npx wrangler pages dev apps/prototype-web/dist/public \
  --d1 DB=micro-network-local \
  --r2 MEDIA=micro-media-local \
  --binding GOOGLE_CLIENT_ID=test-client \
  --binding GOOGLE_CLIENT_SECRET=test-secret
# apply migrations to the local D1 (script splits statements correctly):
npx wrangler d1 execute DB --local \
  --file=apps/prototype-web/worker/db/migrations/0001_init.sql
```

The automated tests (`pnpm --filter @micro/prototype-web test`) run the same
worker in embedded workerd emulation (Miniflare) with real local D1/R2 and a
synthetic Google binding — no network, no credentials.

## Free-tier guard

The build fails if the bundled worker exceeds 1 MB. No paid service is
required by this code; if a required behavior cannot run within the free
tier, the exact quota/feature and options are surfaced to the owner instead
of an automatic upgrade.
