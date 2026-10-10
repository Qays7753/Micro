# R8-1 — Bundle-Surface Semantics and Environment-Aware Anchoring (Execution Report)

**Program:** WS-216 / ARCH-007 — Structural Remediation R8, slice R8-1
**Date:** 2026-10-10 · **Executor:** Z AI · **Findings closed by this slice:** R8-F-020, R7-CF-REPAIR (design replacement; CI record bootstrap completes in R8-4)
**Commit:** this slice's commit on `refactoring/r8-bundle-file-growth-guards-20261010` (from `1e267864`)

> **Dated correction (2026-10-10, R8-N1 root fix, code head `7341f911`):** this report recorded finding R8-N1 (31 duplicate precache URLs) as *separate-tracked* because fixing it changes `sw.js` content and was then classified as an owner-gated PWA configuration decision outside the guard wave. The owner has since decided **FIX_NOW**, and the root fix is executed and closed with evidence in `R8-N1-PWA-PRECACHE-ROOT-FIX-EXECUTION-REPORT-2026-10-10.md` (same directory): the configuration overlap is eliminated (`includeAssets` removed + `includeManifestIcons: false` — one canonical `globPatterns` selection path), the generated `sw.js` now carries 156 entries / 156 unique / 0 duplicates with the unique set proven identical, and the guard now fails closed on duplicates (`DUPLICATE_PRECACHE_URLS`) instead of measuring over them. The unique-URL measurement semantics documented in this report remain correct and unchanged; only the separate-track disposition is superseded (old → new, nothing rewritten silently).

---

## 1. What changed

| File | Change |
|---|---|
| `apps/prototype-web/scripts/check-bundle-surfaces.mjs` | Full rewrite: manifest-based classification, per-environment anchoring, deterministic gzip normalization, safe precache resolution, sw-runtime surface, fail-closed environment/baseline handling (135 → 457 nbLOC — WATCH band entered; v1 ratchet baseline updated same-PR with the dated register note §7) |
| `apps/prototype-web/scripts/check-bundle-surfaces.test.mjs` | Replaced: 19 deterministic offline tests covering the full R8-1 contract (see §4) |
| `apps/prototype-web/scripts/bundle-surfaces-baseline.json` | Schema v2 (provenance + tolerances + per-environment records): `local` + `cloudflare-pages` anchored; `github-actions` deliberately absent pending the documented CI bootstrap (§5) |
| `scripts/file-size-ratchet-baseline.json` | v1 band entry added for the rewritten guard (documented same-PR protocol; superseded by v2 in R8-2) |
| `docs/architecture/refactoring/FILE-SIZE-AND-RESPONSIBILITY-REGISTER.md` | Dated §7 note: guard growth measurement + new finding R8-N1 |

No production code, no vite config, no workflow, no package script changed. Entry ceilings `650,000/155,300` untouched; the budget guard remains the single entry-selection and ceiling source of truth (the surfaces guard reports the entry and explicitly disclaims its governance).

## 2. Surface semantics (the R8-F-020 root fix)

Classification now derives exclusively from `dist/public/.vite/manifest.json`:

- **Entry** — the single `isEntry` js record (mirrors `check-bundle-budget.mjs::selectEntry`). Reported only.
- **Initial-closure companions** — the entry's static `imports` closure minus the entry file. **Guarded** (raw + normalized gzip). Replaces the old guard's *accidental* coverage of these chunks under the "lazy" label.
- **Lazy/dynamic-only closure** — union of closures of all `isDynamicEntry` roots following `imports` + `dynamicImports`, minus the initial closure. **Guarded** (raw + normalized gzip). Shared chunks reachable from the entry statically are attributed to the initial surface and counted exactly once.
- **PWA precache** — `precacheAndRoute` URLs from `sw.js`, resolved safely inside the dist root (absolute paths, `..` segments, and escapes rejected; missing files fail). **Guarded** (raw). Duplicate URLs are counted once (unique-URL semantics — the runtime caches by URL) and reported.
- **Service-worker runtime** — `sw.js` + `workbox-*.js` at the dist root. **Guarded** (raw). Closes the previously unclassified blind spot.

Fail-closed consistency: unresolvable manifest references, emitted `assets/*.js` absent from the manifest graph, manifest files missing from disk, zero/ambiguous entries, missing/malformed precache, and path escapes all fail with distinct codes.

**Quantified correction at `1e267864`:** the replaced heuristic missed 14,228 B of genuinely lazy JS (two `index-*`-named dynamic chunks) and misattributed 224,687 B of initial-load chunks; it also double-counted 31 duplicate precache URLs (+76,466 B) and ignored the 28,885 B sw-runtime. The new baseline records the corrected surfaces (documented semantic reduction: lazy raw 1,417,088 → 1,206,629; precache 2,748,709 → 2,672,243 unique-URL bytes).

## 3. Environment-aware anchoring (the +512 bridge replacement)

- **Environment identity (fail-closed):** `cloudflare-pages` (`CF_PAGES`/`CF_PAGES_COMMIT_SHA`) → `github-actions` (`GITHUB_ACTIONS=true`) → `local` (no markers). Any other CI marker (`CI`, `GITLAB_CI`, …) without a reliable identity → `UNVERIFIED_ENVIRONMENT` failure. No environment ever inherits another's baseline.
- **Per-environment records** carry measurements, counts, toolchain identity, and anchor provenance (`head`/`date`/`method`). The schema rejects unknown environments, missing provenance, invalid values, and tolerances above hard caps (raw ≤ 16, gzip ≤ 256 — guard-weakening rejection).
- **Deterministic gzip normalization:** known hashed filenames (8-char `[A-Za-z0-9_-]` before `.js`, positionally extracted — hashes may contain hyphens) canonicalize to zero-hashes; the build identity (when present in env, vite.config priority) canonicalizes to a fixed token. Verified convergence: local null-identity, two 40-char identities, and the Pages production deployment all measure lazyGzipNorm = 363,974 and initialGzipNorm = 70,716 on the same graph.
- **Evidence-based tolerances** (documented derivation, review trigger on any exceed): raw +8 = 2× the max observed identity-driven minifier identifier-shift (±4, R8-0 §4.3.3); gzip +16 = 2× the conservative post-normalization bound (observed 0 convergence on guarded surfaces). Real growth beyond these bounds fails; raw is otherwise strict.
- **Anchor provenance:** `local` = this executor's build of the `1e267864` tree; `cloudflare-pages` = the live production deployment (`micro-prototype.pages.dev`, embedded `CF_PAGES_COMMIT_SHA=1e267864`, manifest-topology equality proven in R8-0 §4.3.5).

## 4. Tests (19, deterministic, offline)

Environment/identity detection (priority + unverified markers); normalization (hyphen-in-hash canonicalization, identity neutralization, cross-build convergence with raw-gzip inequality); classification (non-`index-*` entry, `index-*` non-entry lazy, static-vs-dynamic closure, shared-once-to-initial, nested dynamics, zero/ambiguous entries, missing/invalid manifest, missing emitted file, unaccounted asset); precache/sw-runtime (missing SW, malformed precache, duplicates deduped+reported, path escapes, missing precache file, sw-runtime bytes); comparison (parity, growth beyond baseline+tolerance with exact values, within-tolerance acceptance, reduction reporting, counts recorded-not-guarded); baseline schema v2 validation (valid + every malformed variant + guard-weakening caps + committed live baseline validity); CLI (missing dist, unverified environment).

**Result:** `npx vitest run scripts/check-bundle-surfaces.test.mjs scripts/check-bundle-budget.test.mjs` — **37/37 passed** (local, Node 24.21.0).

## 5. CI bootstrap (documented, not yet executed)

The `github-actions` record is intentionally absent at this slice: anchoring it from anything but an actual CI measurement would be guessing. The protocol: trigger a `workflow_dispatch` CI run on this branch (the workflow exposes it; no PR check is born red); the guard fails that run with `UNANCHORED_ENVIRONMENT` after printing a machine-readable `ANCHOR_RECORD` (environment, toolchain, measurements, counts); the record is then anchored from that exact run's log with provenance (run URL + head SHA + method) and re-verified by a second run before the PR is created. This is the documented bootstrap, not a silent red-to-green baseline edit. Execution and verification are recorded in the R8 complete report (R8-4).

## 6. Verification record

| Command | Result | Environment |
|---|---|---|
| `npx vitest run scripts/check-bundle-surfaces.test.mjs scripts/check-bundle-budget.test.mjs` | 37/37 passed | local Node 24.21.0 |
| `node apps/prototype-web/scripts/check-bundle-surfaces.mjs apps/prototype-web/dist/public` | PASS — entry 629,300/154,683 (reported); initial 2 (224,687/70,716); lazy 101 (1,206,629/363,974); precache 156 (2,672,243); swRuntime 2 (28,885) | local |
| `CF_PAGES=1 CF_PAGES_COMMIT_SHA=1e26… node …/check-bundle-surfaces.mjs <pages-production-mirror>` | PASS — entry 629,412/154,747; initial 224,687/70,716; lazy 1,206,629/363,974; precache 2,672,355; swRuntime 28,885 | cloudflare-pages record verification |
| `GITHUB_ACTIONS=true node …/check-bundle-surfaces.mjs …` | FAIL `UNANCHORED_ENVIRONMENT` + `ANCHOR_RECORD` printed (expected — bootstrap pending) | github-actions path |
| `CI=true node …/check-bundle-surfaces.mjs …` | FAIL `UNVERIFIED_ENVIRONMENT` (expected fail-closed) | unknown env path |
| `node scripts/check-file-size-ratchet.mjs` | PASS (baseline updated same-PR: guard file WATCH) | local |
| `pnpm prototype:build` (full chain incl. budget gate) | PASS — budget 629,300/154,683; surfaces PASS within local baseline | local Node 24.21.0 |

## 7. Exit-criteria status

- [x] R8-F-020 closed with direct code and negative-test evidence (filename-heuristic behavior now provably rejected by tests that name chunks adversarially in both directions).
- [x] The +512 bridge is replaced by per-environment records with provenance and evidence-based tolerances; remaining status of the CI record bootstrap is tracked to R8-4 (exact, not deferred-generic).
- [x] No entry ceiling changed; no real bundle growth hidden (raw strict per environment beyond ±8 documented bound).
- [x] Local and CI/Pages environment semantics explicit (identity printed in every run; fail-closed unknown).
- [x] Bundle-surface output reproducible and reports environment + measurement mode.
- [x] Focused bundle tests pass (37/37).
- [x] Diff reviewed for no product-code or visual change (guard/test/baseline/docs only).
- [x] Commit and phase evidence recorded (this report + register §7 dated note).

**Status after R8-1:**

```text
R8_1_COMPLETE — MANIFEST_SEMANTICS_AND_ENVIRONMENT_ANCHORING_VERIFIED (local + cloudflare-pages)
CI_BOOTSTRAP_PENDING (github-actions record — documented protocol, executed in R8-4)
NO_BUNDLE_CEILING_RAISED
NO_GUARD_WEAKENED
NO_UNAPPROVED_FINANCIAL_OR_SEMANTIC_CHANGE
NO_UNAPPROVED_SCHEMA_OR_EXPORT_IMPORT_CHANGE
NO_UNAPPROVED_VISUAL_UI_CHANGE
```
