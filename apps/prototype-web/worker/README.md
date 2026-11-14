# Micro network worker (EX-D18 + EX-D20)

Cloudflare Pages advanced-mode worker (`_worker.js`) for the Micro Market +
Delivery network layer — same-origin BFF compatible with Pages
Functions/Workers, built from `worker/index.ts` by
`apps/prototype-web/scripts/build-worker.mjs` into
`apps/prototype-web/dist/public/_worker.js` **after** the client build (so the
service-worker precache manifest never includes the worker).

**Storage (EX-D20, owner decision 2026-11-13):** Market/Delivery network data
lives on **one PostgreSQL target (Neon Free) reached through Cloudflare
Hyperdrive** — the same target prepared for Manage later, with logical/data
access separation per module. The D1 engine is no longer an active runtime
path; `db/migrations/` is kept untouched as labelled superseded history and
`db/migrations-pg/` is the active ordered PostgreSQL schema.

## Layout

| Path                | Purpose                                                                                                                                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `index.ts`          | Entry: `/api/*` routing, static assets + SPA fallback, security headers                                                                                                                                                                          |
| `env.ts`            | Binding/secret NAMES and engineering defaults (no values live here)                                                                                                                                                                              |
| `auth/`             | Google OIDC (authorization-code + strict payload validation), PostgreSQL-backed sessions, CSRF/origin                                                                                                                                            |
| `db/db.ts`          | The `Db` seam (prepare/batch) + request-scoped client resolution + row/settings helpers                                                                                                                                                          |
| `db/pg.ts`          | PostgreSQL adapter (postgres.js workerd build; `?`→`$n` translation; batch = one transaction)                                                                                                                                                    |
| `db/migrations-pg/` | **ACTIVE** ordered PostgreSQL migrations (network entities; since 0003/EX-D23 also the Manage Online foundation: capability + owner-identity link; synthetic-data manage tables land with M3+; never applied to the shared Neon project by Z AI) |
| `db/migrations/`    | Superseded D1 history (0001..0005) — kept labelled, never applied by tests or code                                                                                                                                                               |
| `api/`              | Route handlers (auth, media, system, ask, manage — EX-D23 M2: state + verified owner link)                                                                                                                                                       |
| `authorization.ts`  | Server-side capability resolution (guest/authenticated/vendor/driver/admin + workspaces EX-D19)                                                                                                                                                  |
| `media.ts`          | Private R2 object handling (random keys, authorized reads only)                                                                                                                                                                                  |
| `tests/`            | Real workerd + PostgreSQL + R2 emulation tests (Miniflare + esbuild harness)                                                                                                                                                                     |

## Bindings and secrets (owner/Manus setup — names only)

| Name                    | Kind                        | Purpose                                                                          |
| ----------------------- | --------------------------- | -------------------------------------------------------------------------------- |
| `DB`                    | **Hyperdrive binding**      | Pooled access to the single PostgreSQL target (Neon Free)                        |
| `MEDIA`                 | R2 bucket binding (private) | Listing images + driver evidence                                                 |
| `ASSETS`                | Pages-provided              | Static assets (automatic)                                                        |
| `GOOGLE_CLIENT_ID`      | Var                         | Google OAuth client id                                                           |
| `GOOGLE_CLIENT_SECRET`  | Secret                      | Google OAuth client secret                                                       |
| `BOOTSTRAP_OWNER_EMAIL` | Var/Secret (one-time)       | First admin bootstrap; remove after use                                          |
| `GOOGLE` (optional)     | Service binding             | Synthetic Google in tests; in production unset — plain `fetch` to Google is used |

**Google OAuth redirect URIs (owner/Manus hardening step, F-26):** the worker
derives `redirect_uri` from the request origin
(`<origin>/api/auth/google/callback`). When registering the OAuth client in
Google Cloud Console, pin the EXACT authorized redirect URIs for the
production and preview origins (e.g. `https://<pages-domain>/api/auth/google/callback`)
instead of leaving the origin open — an origin-derived redirect is a
bootstrap convenience, not the production posture. A failed callback now
renders a visible Arabic error page (never a silent redirect).

**Compatibility flag (required):** the project must enable `nodejs_compat`
(the postgres.js workerd build imports `node:buffer`/`node:events`/
`node:stream`, resolved natively by the Workers runtime). Pages: project
settings → Settings → Functions → Compatibility flags → add `nodejs_compat`
(production + preview). This flag is a deployment setting owned by
owner/Manus — it is not a code change.

No production database/account/zone IDs, domains, or secret values belong in
this repository. Sessions use the `micro_session` HttpOnly cookie; the
short-lived login-flow binding uses `micro_flow`.

## PostgreSQL migrations — apply IN ORDER (owner/Manus setup)

Apply every file under `worker/db/migrations-pg/` in filename order to the
Neon database (the numbered prefix is the order) — e.g. with `psql` against
the Neon connection string, or Neon's console SQL editor:

```bash
# example (owner/Manus runs this against the provisioned free Neon database)
psql "$NEON_CONNECTION_STRING" -f apps/prototype-web/worker/db/migrations-pg/0001_init.sql
```

| File                         | Contents                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------- |
| `0001_init.sql`              | Full active schema: 31 tables (29 network + workspace layer), constraints, FKs, indexes           |
| `0002_report_moderation.sql` | Adds `market_report` to the moderation-event closed object set (report follow-up decisions, F-12) |

The file header documents the lineage from the superseded D1 history
(0001..0005), including the workspace layer new in the PostgreSQL target
(EX-D19). **Do not delete or edit `db/migrations/`** — it is labelled history
(`SUPERSEDED by migrations-pg/0001`); no live D1 resource is touched without a
later explicit owner/Manus read-only check.

## Operational settings (admin actions, allowlisted)

The network settings are owner/admin-controlled through the API —
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
- `market.enabled` / `delivery.enabled` — the global module kill-switches
  (F-25): setting `disabled` fails the module's PARTY-FACING business write
  actions closed server-side (503 `module_globally_disabled`) — vendor
  profile/listing writes and direct updates for market; booking lifecycle,
  execution, consent/change, statements, and the driver application path for
  delivery — while the shared shell entry points, public reads, personal
  bookmarks (saved listings/drivers), abuse reports, and all admin
  review/settings/invitation actions stay available (an incident stop never
  removes the way to report abuse or for admins to act — EX-D19). Absence =
  enabled; the switch exists for operational recovery during an incident.

## Driver application invitations (OD22 — context only)

Self-application AND invitation are both available (OD22). قيس (admin)
issues a single-use invitation code (`POST /api/admin/driver-invitations`,
default validity 7 days, revocable via `DELETE
/api/admin/driver-invitations/:code`); the invited person signs in with the
SAME shared Micro identity and consumes the code (`POST
/api/driver/invitation/:code`). Consumption grants invitation CONTEXT only —
no activation, no review skip, no membership; the normal reviewed application
follows separately. An expired/cancelled/missing invitation never blocks
self-application. Everything is audited (`driver_invitation_*`).

## Local development (no Cloudflare account required)

The automated tests (`pnpm --filter @micro/prototype-web test`) boot an
**embedded PostgreSQL 17** once per run (devDependency
`@embedded-postgres/linux-x64`; MIT wrapper, PostgreSQL-licensed binaries —
free, no account) through the vitest globalSetup
`apps/prototype-web/scripts/pg-test-server.mjs`, then run the real worker in
embedded workerd emulation (Miniflare) with real R2 and a synthetic Google
binding. Inside workerd the worker connects to PostgreSQL over
`cloudflare:sockets` — the exact production Hyperdrive code path. No network
egress, no credentials.

To use an existing PostgreSQL server instead (e.g. a CI service container):

```bash
# set the variable to the maintenance-db connection string of your server
# (format: postgres://<user>@<host>:<port>/postgres — credentials belong in
#  your environment, never in this repository)
export MICRO_TEST_PG_CONNECTION="postgres://$USER@127.0.0.1:5432/postgres"
pnpm --filter @micro/prototype-web test
```

For a manual local run of the built app, point a Hyperdrive-compatible local
binding at any local PostgreSQL (e.g. the embedded one started by the test
setup) — the `DB` binding only needs a `connectionString`.

## Ask Micro (EX-D21) — honest unconfigured state

The universal assistant entry (`GET /api/ask/status`, `POST /api/ask`) is
fully wired and permission-scoped (principal + active role + workspace +
permitted record summaries — never direct SQL, never writes). **No AI provider
is wired in this repository by owner decision**: the status reports
`configured: false` and asking returns an honest 501 `ask_not_configured` with
the next step. Live answers require a later owner/Manus action only: choose an
**approved free-tier provider**, add its credentials through Cloudflare's
secure secret storage, and wire it behind the same boundary — never a paid
plan or fabricated responses.

## In-app reminders scheduling (owner/Manus setup)

The worker exports a `scheduled` handler (contract 19 §9) that runs the same
idempotent due-processor as the admin endpoint `POST /api/admin/reminders/due`.
Repository-side it is fully enabled and locally tested (Miniflare's
`/cdn-cgi/handler/scheduled` route). **Cron Triggers are a Workers feature,
not Pages** (per Cloudflare's current compatibility matrix): for UAT use the
documented manual fallback `POST /api/admin/reminders/due`; for periodic
operation the owner/Manus either runs a small separate scheduled Worker that
calls the endpoint or revisits the platform decision at the production gate.
No reminder ever transitions product state (no auto-close ever — OD16); all
timing values are documented operational engineering choices
(`worker/env.ts`), not owner product decisions.

## Free-tier guard

The build fails if the bundled worker exceeds 1 MB. No paid service is
required by this code; if a required behavior cannot run within the free
tier, the exact quota/feature and options are surfaced to the owner instead
of an automatic upgrade.
