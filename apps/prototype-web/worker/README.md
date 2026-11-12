# Micro network worker (EX-D18)

Cloudflare Pages advanced-mode worker (`_worker.js`) for the Micro Market +
Delivery network layer — same-origin BFF compatible with Pages
Functions/Workers, built from `worker/index.ts` by
`apps/prototype-web/scripts/build-worker.mjs` into
`apps/prototype-web/dist/public/_worker.js` **after** the client build (so the
service-worker precache manifest never includes the worker).

## Layout

| Path               | Purpose                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------- |
| `index.ts`         | Entry: `/api/*` routing, static assets + SPA fallback, security headers                       |
| `env.ts`           | Binding/secret NAMES and engineering defaults (no values live here)                           |
| `auth/`            | Google OIDC (authorization-code + strict payload validation), D1-backed sessions, CSRF/origin |
| `db/migrations/`   | Versioned D1 migrations (network entities ONLY — never Manage data)                           |
| `api/`             | Route handlers (auth, media, system)                                                          |
| `authorization.ts` | Server-side capability resolution (guest/authenticated/vendor/driver/admin)                   |
| `media.ts`         | Private R2 object handling (random keys, authorized reads only)                               |
| `tests/`           | Real workerd + D1 + R2 emulation tests (Miniflare + esbuild harness)                          |

## Bindings and secrets (owner/Manus setup — names only)

| Name                    | Kind                        | Purpose                                                                          |
| ----------------------- | --------------------------- | -------------------------------------------------------------------------------- |
| `DB`                    | D1 binding                  | Market/Delivery network data                                                     |
| `MEDIA`                 | R2 bucket binding (private) | Listing images + driver evidence                                                 |
| `ASSETS`                | Pages-provided              | Static assets (automatic)                                                        |
| `GOOGLE_CLIENT_ID`      | Var                         | Google OAuth client id                                                           |
| `GOOGLE_CLIENT_SECRET`  | Secret                      | Google OAuth client secret                                                       |
| `BOOTSTRAP_OWNER_EMAIL` | Var/Secret (one-time)       | First admin bootstrap; remove after use                                          |
| `GOOGLE` (optional)     | Service binding             | Synthetic Google in tests; in production unset — plain `fetch` to Google is used |

No production database/account/zone IDs, domains, or secret values belong in
this repository. Sessions use the `micro_session` HttpOnly cookie; the
short-lived login-flow binding uses `micro_flow`.

## D1 migrations — apply IN ORDER (local and remote)

Apply every file under `worker/db/migrations/` in filename order — the
numbered prefix is the order. Local example (repeat for each file):

```bash
for f in apps/prototype-web/worker/db/migrations/*.sql; do
  npx wrangler d1 execute DB --local --file="$f"
done
```

Remote/production: the same loop against the provisioned database with
`--remote` (or the dashboard's console), **first in a non-production
environment, then after owner approval in production**. Record the backup
snapshot before each remote apply (`wrangler d1 export` / Time Travel
restore point).

| File                         | Contents                                                              |
| ---------------------------- | --------------------------------------------------------------------- |
| `0001_init.sql`              | All 28 network tables, constraints, FKs, base indexes                 |
| `0002_listing_revisions.sql` | Listing revision workflow rebuild (revision status, admin suspension) |
| `0003_hot_path_indexes.sql`  | Hot-path indexes (listing media, driver ratings, owner statements)    |

## Operational settings (admin actions, allowlisted)

Two network settings are owner/admin-controlled through the API —
`PUT /api/admin/settings/:key` (admin session required, everything else
returns 404/403):

- `disclosure.recipient` — `blocked` (default) or `allowed_after_acceptance`:
  the EX-O14 recipient-details gate for drivers. It stays `blocked` until the
  owner records the consent/legal decision; even on
  `allowed_after_acceptance`, details reach the driver only after the booking
  is confirmed.
- `rate.limits` — engineering-reference abuse limits (submissionsPerDay,
  imagesPerDay, reportsPerDay, guestReadsPerMinute, authStartsPerMinute).
  Final pilot values are an owner action (EX-O16).

## Local development (no Cloudflare account required)

```bash
pnpm install --frozen-lockfile
pnpm --filter @micro/prototype-web build        # client + worker into dist/public
npx wrangler pages dev apps/prototype-web/dist/public \
  --d1 DB=micro-network-local \
  --r2 MEDIA=micro-media-local \
  --binding GOOGLE_CLIENT_ID=test-client \
  --binding GOOGLE_CLIENT_SECRET=test-secret
# then apply ALL migrations in order to the local D1 (see the section above)
```

The automated tests (`pnpm --filter @micro/prototype-web test`) run the same
worker in embedded workerd emulation (Miniflare) with real local D1/R2 and a
synthetic Google binding — no network, no credentials.

## Free-tier guard

The build fails if the bundled worker exceeds 1 MB. No paid service is
required by this code; if a required behavior cannot run within the free
tier, the exact quota/feature and options are surfaced to the owner instead
of an automatic upgrade.
