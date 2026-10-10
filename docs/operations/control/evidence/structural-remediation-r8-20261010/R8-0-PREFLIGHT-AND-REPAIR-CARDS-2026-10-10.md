# R8-0 — Preflight, Repair Cards, Baseline Capture, and Reviewer Gates (Bundle, File-Growth, Guard Charters, CI)

**Program:** WS-216 / ARCH-007 — Structural Remediation R0–R10, R8 wave
**Report date:** 2026-10-10 · **Executor:** Z AI (single primary executor; five read-only review gates)
**Mode:** R8-0 is read-only for production code. This file records the live preflight, the baseline capture, the Repair Cards for every R8 finding, the consumer/execution inventories, and the five reviewer gates. No production file was changed in R8-0.

---

## 1. Live baseline verification (VERIFIED)

| Element | Value | Class |
|---|---|---|
| `origin/main` at execution start | `1e2678645d3c41beb448da2a0d8d2b5d817a18fe` (merge of PR #343 — R7 post-merge reconciliation + R8 gate opening; base parent `74908e1334098a51bb516aa3bbdcc898a4bedb1f`, source parent `86f8bec923c78bf0825c5ae671a030f3d240b34c`) | VERIFIED |
| R7 implementation merge | PR #342 merged 2026-10-10T08:27:22Z, merge commit `74908e1334098a51bb516aa3bbdcc898a4bedb1f` (base `e01d560539476c1c7f712891f2355200d2d74aa6`, source `db78225d877ecddb9067caaafceb2d85256f73bc`) | VERIFIED (pulls API) |
| R7 post-merge CI | run `38038461385` — `completed/success` on head `1e267864` exactly | VERIFIED (Actions API) |
| Open PRs | 1 — PR #344 `docs/r8-zai-execution-prompt-20261010` → `main`, single file added: the canonical R8 execution prompt (`+963/-0`), docs-only, disjoint from the R8 implementation scope (delivery vehicle for this mission, not conflicting work) | VERIFIED (pulls API) |
| Canonical R8 prompt | fetched from branch `docs/r8-zai-execution-prompt-20261010` (commit `3ec0bfdc`, based on `1e267864`); SHA-256 `5779a8fe62dfd51e69860126c4cb99b3ef2d12a351bc2e95dd13d5c3cef11dd3` | VERIFIED |
| Worktree | clean; R8 branch `refactoring/r8-bundle-file-growth-guards-20261010` created from `origin/main` at `1e267864`; one writer; upstream tracking unset (explicit-refspec pushes only) | VERIFIED |
| Credentials | secure askpass mechanism (`.secrets` file, never printed, never committed). NO_SECRETS_EXPOSED | VERIFIED |
| Authorization | owner R8 execution mission (canonical prompt §Mission + §3): R8-0 → R8-4, `BRANCH_AND_PR_ONLY`, final state `PR_READY`/`R8_BLOCKED`, owner merges | VERIFIED |
| Schema/Export | `localSchemaVersion=38` / `localExportVersion=30` — untouched throughout R8 | VERIFIED |
| Preserved UI branch | `docs/ux-ui-zed-handoff-20260921` untouched | VERIFIED |
| Guard chain on main | `check-module-boundaries` PASS (389 files; 3/15/0/3/2/57 baseline edges), `check-runtime-cycles` PASS (0 runtime cycles), `check-type-cycles` PASS (1 documented type SCC — the storage pair; the R7 Finance mixed SCC is absent), `check-file-size-ratchet` PASS (488 measured, baseline 400) | VERIFIED (executed) |

No `STATE_DRIFT`. No unknown local work. The evidence convention (`structural-remediation-r8-20261010/`) was verified against the existing R6/R7 directories before creating this file; the R8 prompt file itself belongs to PR #344 and is NOT duplicated or modified here.

## 2. Toolchain identity (recorded before any change)

| Component | Local (this executor) | GitHub Actions CI | Cloudflare Pages |
|---|---|---|---|
| Node | `v24.21.0` | `v22.23.3` (CI log of run `38030668039`; workflow pins `node-version: 22`) | not exposed by the provider (NOT_VERIFIABLE) — gzip behavior empirically distinct (§4.3) |
| zlib | `1.3.2.1-motley-8002e91` | `1.3.1-e00f703` (same CI log) | not exposed; distinct build inferred from measured gzip deltas |
| pnpm | `9.15.9` (corepack, `packageManager` pin) | `9.15.9` (pnpm/action-setup@v4) | project build image (not exposed) |
| Vite / Rollup | `7.3.6` / `4.62.4` (lockfile-pinned; cf. `check-vendored-braces` baseline) | same lockfile | same lockfile |
| Build identity embedded | `null` fallback (no `VITE_APP_VERSION`/`GITHUB_SHA`/`CF_PAGES_COMMIT_SHA` locally) | `GITHUB_SHA` (40-hex) | `CF_PAGES_COMMIT_SHA` (40-hex) |

## 3. The R7-CF-REPAIR interim bridge and the +167 swing (read from canonical evidence)

Read in full: `R7-CLOUDFLARE-PAGES-REPAIR-2026-10-10.md` and `R7-COMPLETE-PR-READINESS-REPORT-2026-10-10.md`. Captured facts that bind R8-1:

1. The `+512` cross-environment tolerance on each guarded total (`lazyRawTotal 1,417,088→1,417,600`, `lazyGzipTotal 434,812→435,324`, `precacheBytesTotal 2,748,821→2,749,333`) was an interim bridge sized `>4×` the worst documented cross-environment delta; R8 owns replacing it (this file's `_comment` says so verbatim).
2. The two GitHub-CI runs of PR #342 measured `lazyGzipTotal` 434,686 (`47490e52`) vs 434,853 (`006a6f7e`) — a **+167-byte run-to-run swing on near-identical code** with a changed entry chunk hash (`index-CryMmVt8` → `index-D4jLZRGF`) while raw totals stayed identical.
3. Entry raw on CI = 629,412 vs local 629,300 (**+112**) — ADR-012 documented this as toolchain drift; §4 below proves the actual mechanism.
4. The Waves-F incident recorded the Pages toolchain measuring the entry **+9 gzip over** then-green CI.

## 4. Baseline capture — current bundle measurements (VERIFIED, live build)

`pnpm prototype:build` on the clean R8 branch (worktree = `1e267864` tree) reproduces the documented R7 local measurements byte-for-byte: entry `629,300 raw / 154,683 gzip`; old-semantics surfaces `101 / 1,417,088 / 434,742 / precache 187 / 2,748,709` — PASS against the interim `+512` baseline. The canonical measurement tool is Node `zlib.gzipSync(level 9)` (`check-bundle-budget.mjs::measureBundle`).

### 4.1 Manifest graph analysis (new-semantic surfaces; analysis tools persisted outside the repo)

From `dist/public/.vite/manifest.json` (104 records; 1 `isEntry`; 70 `isDynamicEntry`; 33 shared/static chunks; 104 emitted `assets/*.js`, all accounted for — zero unclassified):

| Surface (new semantics) | Files | Raw | Gzip (Node 9) |
|---|---:|---:|---:|
| Entry (guarded by `check-bundle-budget`, ceilings 650,000/155,300 — not duplicated here) | 1 | 629,300 | 154,683 |
| Initial-closure companions (entry's static-import closure minus the entry file) | 2 | 224,687 | 70,720 |
| Lazy/dynamic-only closure (reachable from `isDynamicEntry` roots via `imports`+`dynamicImports`, minus initial closure) | 101 | 1,206,629 | 368,851 |
| PWA precache (sw.js `precacheAndRoute` URLs) | 187 entries | 2,748,709 | n/a (raw-only surface) |
| Service-worker runtime (`sw.js` + `workbox-*.js` at dist root — **currently unguarded blind spot**) | 2 | 28,885 | n/a |

### 4.2 The filename-classifier defect, quantified (R8-F-020 evidence)

The current guard classifies lazy JS as "assets/*.js not starting with `index-`". Live proof of misclassification at `1e267864`:

- **Missed by the guard:** `index-DpbkXQqg.js` (9,305 B) and `index-tuVu4Lhg.js` (4,923 B) — genuinely lazy dynamic-entry chunks (source `index.ts` barrels compiled to `index-<hash>.js`) that the prefix rule silently excludes. **14,228 bytes of lazy JS with zero growth protection.**
- **Wrongly counted as lazy:** `react-runtime-D-o6Z9it.js` (198,160 B) and `iconography-ebC7MZWM.js` (26,527 B) — statically imported by the entry (initial-load surface), 224,687 B misattributed.

### 4.3 Cross-environment and run-to-run variance, root-caused (new evidence)

Experiments (persisted tools `r8-measure-surfaces.mjs`, `r8-verify-normalization.mjs`; two local builds differing only in `VITE_APP_VERSION` = 40-char `a…`/`b…`):

1. **The +112 CI-over-local entry raw is the build identity, not toolchain drift.** A local build with a 40-char identity produces entry raw **629,412 — exactly the CI measurement**. The identity string (`GITHUB_SHA` on CI, `CF_PAGES_COMMIT_SHA` on Pages, `null` fallback locally; `vite.config.ts::buildIdentityFromEnv` → `define.__MICRO_APP_IDENTITY__`, consumed by `application/identity/buildIdentity.ts` → transfers + diagnostics services) replaces the 4-byte `null` fallback and shifts minified identifier allocation.
2. **The hash-propagation mechanism.** Lazy chunks statically import the entry (`import{…}from"./index-<hash>.js"`); when the entry's content changes (identity), its hash changes, and every importer embeds the new hashed filename — 92/105 assets change names between the two identity builds while raw sizes stay constant (fixed-length hashes). This is the mechanism behind the recorded +167 run-to-run CI gzip swing.
3. **Minifier identifier-shift.** esbuild's minified identifier allocation is character-frequency dependent: the two identity builds differ by ±4 raw bytes in the entry (identical code). Raw surfaces are therefore not bit-stable across identity values; observed maximum |Δraw| = 4 (entry; propagated to precache via the precached entry).
4. **Gzip normalization converges.** Canonicalizing each asset by (a) replacing every known emitted hashed filename with a fixed 8-zero placeholder and (b) replacing the build identity (when known at measure time) with a fixed 40-char token makes the two identity builds' gzip totals converge **exactly** (lazy 363,974 = 363,974; initial 70,716 = 70,716). Un-normalized lazy gzip swings: −19…+93 (local identity pair, vs null) and +167 (R7 CI pair).
5. **Cloudflare Pages is a distinct gzip environment.** The live production deployment (`https://micro-prototype.pages.dev`, publicly fetched 2026-10-10) was built by the Pages pipeline from **`1e267864` exactly** — proven by the 40-hex `CF_PAGES_COMMIT_SHA` embedded in the fetched entry (`1e2678645d3c41beb448da2a0d8d2b5d817a18fe`) and by manifest-topology equality with the local `1e267864` build (same module keys modulo hash suffixes; `isEntry`/`isDynamicEntry`/imports/dynamicImports structure identical, **0 mismatches**; 13 byte-identical same-name assets; 0 same-name-different-content). Measured (Node zlib 9 on the fetched bytes): entry 629,412/154,747; initial 224,687/70,720; lazy 1,206,629/**369,039** (+207 vs local — a zlib-build difference, since raw is identical); precache 187/**2,748,821** (== CI exactly); swRuntime 28,885. This finally explains the R7 Pages failure: the Pages environment's gzip exceeded the CI-anchored gzip baseline while raw matched — per-environment gzip anchoring is required (and raw equality across all three environments is now proven for the non-entry surfaces).

### 4.4 File-size metrics (ratchet scope)

`check-file-size-ratchet.mjs` on the live tree: 488 measured files (production+script categories), baseline 400 entries (327 NORMAL / 49 WATCH / 14 SPLIT_CANDIDATE / 10 SPLIT_NOW), 2 shrunk, 0 removed, PASS. The baseline stores **band identity only** — within-band growth is invisible (R8-F-005/006). The R6 register documents the legitimate historical within-band growth community (`R6-SCAN-F-006`: fulfillmentService +16, statementService +21, homeControlCenterService +7, activityService +11, assetService +15, correctionHistoryService +29, catalogService +6, periodComparisonService +11, owner-entitlement/policies +8, transferFamilyValidators +12 [F-005], transferSnapshotValidation, craft-order/policies — all dated, all with commit references) — these must be represented in the v2 baseline with historical provenance, not reopened as defects.

### 4.5 Boundary graph (R8-F-019 preflight)

Live guards prove the R7 Finance cycle absent: runtime cycles 0; type cycles = 1 documented storage SCC. The former edge `components/finance/FinancePeriodResultSection.tsx → pages/Finance.tsx` no longer exists; both consume `application/finance/financeState.ts` through legal UI→application edges (the door for types; a documented deep-import key for the lazy readers). Zero component→page imports exist in the live tree (verified by AST scan during R8-3 implementation; the new rule proves it continuously).

## 5. Repair Cards

### 5.1 R8-F-020 — Bundle-surface classifier is filename-based

- **ID:** R8-F-020 · **Category:** guard defect (measurement truthfulness) · **Classification:** FIX_NOW (R8-1)
- **Evidence:** §4.2 — 14,228 B of lazy JS unguarded; 224,687 B misattributed; `check-bundle-surfaces.mjs:60` `!name.startsWith("index-")`.
- **Affected files:** `apps/prototype-web/scripts/check-bundle-surfaces.mjs`, `.test.mjs`, `bundle-surfaces-baseline.json`.
- **Current responsibility/execution surface:** measures lazy+precache surfaces after `vite build` in the app build chain (`vite build && check-bundle-budget && check-bundle-surfaces`); runs locally, in CI (`pnpm check` → `prototype:build`), and in the Cloudflare Pages build; NOT in `pnpm guards` (build-only guard — must become explicit in §4.3.1 metadata per R8-F-021).
- **Canonical source of truth:** the Vite/Rollup build manifest (`dist/public/.vite/manifest.json`, enabled by `vite.config.ts build.manifest: true`); entry selection already manifest-based in `check-bundle-budget.mjs::selectEntry` (D-034).
- **Consumer/execution inventory:** app `build` script (package.json); vite in-build gate runs budget only (surfaces runs post-build in the script chain); CI `pnpm check` → `prototype:build`; Pages build (same chain); `pnpm prototype:build` locally; direct node invocations documented in the R8 prompt §10; tests `check-bundle-surfaces.test.mjs` (vitest, app suite); baseline JSON read by the guard and pinned by its test.
- **Input/output/environment inventory:** in: dist tree + manifest + sw.js + baseline JSON + env identity vars; out: exit code + measurement report lines; env: local / github-actions / cloudflare-pages.
- **Root cause:** classification by filename convention instead of build metadata.
- **Impact:** none on financial/semantic/schema/export/history/UI — measurement-only change; no shipped byte changes.
- **Dependencies:** R7-CF-REPAIR (environment-aware anchoring replaces the +512 bridge in the same rewrite).
- **Allowed files:** the three files above + metadata/docs per R8-3/R8-4. **Forbidden:** any `client/src/**`, `src/**`, vite config build semantics, ceilings.
- **Minimum safe remediation:** manifest-closure classification (initial vs dynamic-only), fail-closed consistency, safe precache resolution, per-environment baselines (see 5.6).
- **Short-term safety:** the interim +512 baseline remains until the R8-1 commit lands (same-PR replacement).
- **Tests/commands:** new deterministic suite (§ R8-1 contract: non-index-named entry classified correctly; index-named non-entry not treated as entry; static-vs-dynamic closure; shared chunks once; nested dynamics; 0/1/ambiguous entries; missing/invalid manifest; manifest-file missing; path escapes; missing emitted file; missing SW; malformed/missing/duplicate precache; raw+gzip semantics; environment mismatch/unknown; normalization; silent-growth failure; parity/reduction; live baseline schema validation).
- **Acceptance criteria:** classifier is manifest-based with zero filename heuristics; every emitted JS accounted into exactly one surface; focused tests green; local + CI + Pages semantics explicit.
- **Rollback boundary:** single commit (revert restores the R7 guard + baseline).
- **Final state:** CLOSED_WITH_EVIDENCE in the R8 complete report (target).

### 5.2 R8-F-005 — transferFamilyValidators pin exceeded without enforcement

- **ID:** R8-F-005 · **Category:** ratchet enforcement gap · **Classification:** FIX_NOW (R8-2; documentation portion already executed in R6-W1)
- **Evidence:** register row `transferFamilyValidators.ts` — live 1,730 nbLOC / 77,703 B at `fd92d7e8` vs ADR-017 pin 1,718/76,500 (+12/+1,203 from dated R2 commits); the band ratchet guards band boundaries only, so the pin's exact value was unguarded.
- **Affected files:** `scripts/check-file-size-ratchet.mjs`, `.test.mjs`, `scripts/file-size-ratchet-baseline.json`, `FILE-SIZE-AND-RESPONSIBILITY-REGISTER.md` (dated note only).
- **Current responsibility/execution surface:** 17-guard `pnpm guards` chain + CI; measures nbLOC bands for production+script categories.
- **Canonical source of truth:** register methodology (nbLOC, band thresholds <400/400–799/800–1199/≥1200); this guard is the enforcement owner.
- **Consumer/execution inventory:** root `guards` script; CI `pnpm check`; direct `node scripts/check-file-size-ratchet.mjs`; vitest suite `check-file-size-ratchet.test.mjs` (root suite); baseline JSON + its test.
- **Root cause:** baseline schema stores band identity, not exact metrics — within-band growth passes silently.
- **Impact:** none (guard/measurement only).
- **Minimum safe remediation:** baseline v2 storing exact nbLOC per file + within-band growth rejection + re-anchor ledger with owner-review references (shared with 5.3).
- **Acceptance:** the file's growth beyond the v2 baseline (seeded from the live tree with historical provenance) fails; documented historical growth is represented as provenance, not reopened.
- **Rollback boundary:** single commit. **Final state:** target CLOSED_WITH_EVIDENCE.

### 5.3 R8-F-006 — Silent within-band growth community

- **ID:** R8-F-006 · **Category:** ratchet enforcement gap · **Classification:** FIX_NOW (R8-2)
- **Evidence:** register §7 dispositions — ≥12 files with documented within-band growth (values in §4.4); the guard cannot see any of it.
- **Affected files / inventory / root cause / impact / rollback:** same as 5.2 (one implementation).
- **Minimum safe remediation:** v2 baseline (exact nbLOC), within-band growth rejection with old/new values, same-PR-concealment prevention via merge-base drift audit + re-anchor ledger, fail-closed schema validation, explicit deleted-file behavior, PRESERVE-card files get bounded per-path re-anchor authorization (not blanket exemption).
- **Acceptance:** every R8-2 contract test green (thresholds 399/400/799/800/1199/1200; unchanged-pass; shrink-pass; within-band-increase-fail with old/new; crossing-fail; new-NORMAL-pass; new-WATCH+-fail; deleted-explicit; excluded-categories; malformed-baseline-fail; duplicate-path-fail; invalid-band/metric-fail; same-PR-concealment-fail; documented-re-anchor-distinguishable; live-schema-valid).
- **Final state:** target CLOSED_WITH_EVIDENCE.

### 5.4 R8-F-019 — Finance cycle lacks a direct regression class

- **ID:** R8-F-019 · **Category:** boundary regression gap · **Classification:** FIX_NOW (R8-3)
- **Evidence:** R7-1 closed `R6-SCAN-F-019/STR-204c` by extraction; no guard owns the forbidden class (component→page) — the cycle could return via any value/type/dynamic/relative edge.
- **Affected files:** `scripts/check-module-boundaries.mjs`, `.test.mjs`; metadata in `REFACTORING-PLAN-A-TO-Z.md §4.3.1`.
- **Current responsibility/execution surface:** R1–R6 rules, AST/resolution-based (`typescript` compiler API + `resolveSpecifier`), in `pnpm guards` + CI.
- **Canonical source of truth:** this guard (one canonical owner for boundary-direction rules; cycle guards own cycles).
- **Consumer/execution inventory:** root `guards`; CI; direct node; vitest suite; baselines embedded (R1–R5) + `scripts/ui-application-import-baseline.json` (R6).
- **Root cause:** the R6-era rules predate the R7 extraction; no component→page rule existed because the edge was legal until the R7 reorganization.
- **Minimum safe remediation:** new rule R7 (component→page): any import kind (value/type/dynamic/import-type/re-export), resolution-based (aliases + relative), explicit owner-reviewed exception list (empty at start), negative+positive tests including the exact former Finance pattern.
- **Impact:** none (guard only; `check-module-boundaries.mjs` is 398 nbLOC — crossing WATCH 400 with the new rule requires a documented same-PR re-anchor under the new v2 ratchet, dogfooding the R8-2 ledger).
- **Acceptance:** component→page value/type/dynamic/relative each fail in tests; page→component passes; former Finance pattern rejected; unrelated legal UI imports unaffected; live tree zero violations.
- **Rollback boundary:** single commit. **Final state:** target CLOSED_WITH_EVIDENCE.

### 5.5 R8-F-021 — Guard metadata and scope must remain truthful

- **ID:** R8-F-021 · **Category:** metadata truthfulness (PG-2) · **Classification:** FIX_NOW (R8-3)
- **Evidence:** `§4.3.1` documents 17 guards; the two build-only bundle guards are absent from the table (silent omission — exactly the prohibited case); the ratchet row states band-crossing semantics that R8-2 changes; the boundaries row lacks the new rule.
- **Affected files:** `REFACTORING-PLAN-A-TO-Z.md` (§4.3.1 + dated title correction), possibly `REFACTORING-CONTROL.md`/`TEST-AND-DOCUMENTATION-MAP.md` dated pointers.
- **Root cause:** §4.3.1 predates the build-only guards' formal charter.
- **Minimum safe remediation:** reconcile the canonical table from the live repo: add `check-bundle-budget` + `check-bundle-surfaces` rows (proves/does-not-prove/source of truth/execution surface incl. build-only path/baseline policy/fixture scope/owner/change classification); update ratchet + boundaries rows; dated title correction (17 pnpm-guards + 2 build-only = 19 documented).
- **Acceptance:** every row consistent with actual commands and CI/build surfaces; no second metadata table.
- **Rollback boundary:** docs commit. **Final state:** target CLOSED_WITH_EVIDENCE.

### 5.6 R7-CF-REPAIR — Replace the interim +512 bridge

- **ID:** R7-CF-REPAIR · **Category:** baseline policy (environment awareness) · **Classification:** FIX_NOW (R8-1)
- **Evidence:** §3 + §4.3 — single global baseline with +512 blunt tolerance across three measurement environments; Pages gzip distinct (+207 measured); run-to-run gzip swing +167 (hash propagation); identifier-shift ±4 raw.
- **Minimum safe remediation (the R8-1 anchoring design):**
  1. **Environment identity, fail-closed:** `cloudflare-pages` (`CF_PAGES`/`CF_PAGES_COMMIT_SHA`), `github-actions` (`GITHUB_ACTIONS=true`), `local` (neither, and no `CI` marker); any other combination → `UNVERIFIED_ENVIRONMENT` failure. Unknown environment never receives the most generous baseline.
  2. **Baseline schema v2:** per-environment records — measurements for every guarded surface, toolchain facts, anchor provenance (head SHA, date, method), schema version; duplicated/stale/mismatched records rejected.
  3. **Surfaces (all classified from the manifest, each file exactly once, fail-closed on inconsistency):** initial-entry (reported; budget guard owns ceilings), initial-closure companions (guarded), lazy/dynamic-only closure (guarded), precache (guarded, raw; safe URL resolution, duplicate policy documented), sw-runtime (guarded, raw; closes the blind spot).
  4. **Gzip normalization (deterministic):** canonicalize known hashed filenames + build identity before gzip — verified to converge exactly (§4.3.4).
  5. **Evidence-based tolerances:** raw ±8 (2× the observed ±4 identifier-shift; real growth ≥9 B fails); normalized gzip ±16 (2× a conservative identifier-shift gzip bound; observed post-normalization convergence 0); documented derivation + review trigger on any exceed — no arbitrary cushion, no ceiling change.
  6. **Anchor provenance:** `local` from this executor's build (`1e267864` tree); `cloudflare-pages` from the live production deployment (embedded SHA `1e267864`, topology-equal — §4.3.5); `github-actions` bootstrapped from an actual CI run on the R8 branch via `workflow_dispatch` (the guard prints a machine-readable `ANCHOR_RECORD` on `UNANCHORED_ENVIRONMENT`; the run log is the anchoring evidence — documented bootstrap, not silent red-to-green).
- **Acceptance:** +512 fields no longer exist; every environment record carries provenance; entry ceilings untouched; real growth fails in every environment; CI/Pages semantics explicit in output (env + node + zlib + measurement mode printed).
- **Rollback boundary:** single commit (revert restores the R7 interim baseline). **Final state:** target CLOSED_WITH_EVIDENCE.

## 6. Consumer/execution inventory for every changed execution surface (R8-0 → R8-4 plan)

| Changed surface | Direct consumers | CI/workflow refs | Baselines/fixtures | Tests |
|---|---|---|---|---|
| `check-bundle-surfaces.mjs` | app `build` script; CI `pnpm check`→`prototype:build`; Pages build; direct node (prompt §10) | `ci.yml` (via build), Pages project build command | `bundle-surfaces-baseline.json` (schema v2) | `check-bundle-surfaces.test.mjs` (app vitest) |
| `check-file-size-ratchet.mjs` | root `guards` chain; CI; direct node | `ci.yml` via `pnpm check` | `file-size-ratchet-baseline.json` v2 + re-anchor ledger | `check-file-size-ratchet.test.mjs` (root vitest) |
| `check-module-boundaries.mjs` | root `guards`; CI; direct node | same | embedded R1–R5 lists + R6 JSON + new R7 exception list | `check-module-boundaries.test.mjs` |
| `bundle-surfaces-baseline.json` | surfaces guard + its test | — | self | schema tests |
| `.github/workflows/ci.yml` | Actions | self | — | whitespace/guard behavior via CI runs themselves |
| `REFACTORING-PLAN-A-TO-Z.md §4.3.1` | canonical metadata reference | — | — | consistency vs live commands (reviewed in R8-3) |
| Operations Control JSON + views | control system | — | generated views (regeneration only) | `operations-control:test/check` |

No other guard, script, package command, or workflow step is modified by R8. The vite in-build budget gate duplication (budget runs in `closeBundle` AND in the build script chain) is reviewed in R8-4 against the "no duplicate execution without losing coverage" rule with a documented disposition.

## 7. Five read-only reviewer gates (R8-0)

**S1 — Bundle and measurement reviewer:** confirmed the manifest-closure design (§5.6.3) covers every emitted JS exactly once; flagged that the OLD guard's accidental coverage of initial chunks must be preserved as an explicit guarded surface (adopted — initial-closure companions guarded); flagged sw.js/workbox blind spot (adopted — new guarded surface); required the `_`-facade and basename reference-resolution rules be encoded fail-closed (adopted); required `ANCHOR_RECORD` machine-readable output for the CI bootstrap (adopted).

**S2 — Guard and boundary reviewer:** confirmed the ratchet v2 design stores exact nbLOC and rejects within-band growth; required the same-PR-concealment audit to run against the merge-base baseline in CI (adopted — drift audit with explicit ledger chain verification `from == merge-base value`); required the component→page rule to cover import-type and re-export forms (adopted); required deleted-file entries to remain visible until explicit cleanup (adopted).

**S3 — CI and operations reviewer:** confirmed CI Node 22/pnpm 9.15.9/fetch-depth 0 (merge-base available for the drift audit); required the CI-record bootstrap to use `workflow_dispatch` so no PR check is born red (adopted; token has workflow scope); required environment/toolchain identity in the guard's output lines (adopted); confirmed the bounded audit retry policy and artifact upload are untouched by R8.

**S4 — Architecture and invariants reviewer:** confirmed R8 scope is guard/measurement/CI only; no schema/export/financial/history/UI change; ceilings 650,000/155,300 untouched; the budget guard remains the single entry-selection and ceiling source of truth; per-environment records do not create a second ceiling; the Pages anchoring from the public production deployment is read-only evidence gathering, not a provider setting change.

**S5 — Hostile reviewer:** challenged the tolerances as new cushions — answered: raw ±8 and gzip ±16 are derived from measured mechanisms (identifier-shift ±4 observed; post-normalization convergence 0) at 2× bounds, orders of magnitude below the removed +512, gzip-only-where-normalized, with review triggers; challenged the CI bootstrap as red-to-green convenience — answered: `workflow_dispatch` run + published `ANCHOR_RECORD` + provenance-pinned record is the documented protocol, and the alternative (pre-anchoring from guessed values) is the actual weakening; challenged the Pages production-deployment anchor — answered: embedded-SHA provenance + topology equality + 0 same-name-different-content make it exact, and the PR preview (same pipeline, same graph) re-verifies it live; confirmed no ceiling raised and no baseline silently widened.

**Reconciliation:** all reviewer amendments are folded into the cards above. No BLOCKER. Implementation order: R8-1 (bundle surfaces) → R8-2 (ratchet) → R8-3 (boundary + metadata) → R8-4 (CI/final reconciliation).

## 8. R8-0 exit criteria

- [x] five reviewer outputs reconciled (§7)
- [x] every R8 finding has a stable ID and a complete Repair Card (§5)
- [x] every changed guard has a consumer/execution inventory (§6)
- [x] current baselines and exact environment facts recorded (§2, §4)
- [x] no unknown worktree or branch drift (§1)
- [x] no current R8 finding hidden in generic DEFER (all FIX_NOW with rollback boundaries)

**Status after R8-0:**

```text
R8_0_COMPLETE — PREFLIGHT_AND_CARDS_VERIFIED
NO_PRODUCTION_CODE_CHANGED
R8_1_NEXT
```
