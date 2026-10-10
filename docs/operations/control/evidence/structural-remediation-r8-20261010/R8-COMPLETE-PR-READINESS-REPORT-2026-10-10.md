# R8 — Complete PR-Readiness Report (Bundle, File-Growth, Guard Charters, CI Hardening)

**Program:** WS-216 / ARCH-007 — Structural Remediation R0–R10, R8 wave
**Report date:** 2026-10-10 · **Executor:** Z AI (single primary executor; five read-only review gates in R8-0)
**Branch:** `refactoring/r8-bundle-file-growth-guards-20261010` from verified `origin/main` `1e2678645d3c41beb448da2a0d8d2b5d817a18fe` · **PR:** #345
**Implementation code head (CI/Cloudflare-verified):** `7341f91195a59100a4b9111b1d81c21f0f184368` (R8 implementation head; later commits on this PR are documentation-only corrections)

---

## 1. Executive status

R8 is complete and PR-ready. All five approved findings are closed with direct code, tests, and live evidence; the R7 interim `+512` bridge is replaced by truthful per-environment anchoring; the within-band file-growth blind spot is closed with a concealment-proof ratchet; the Finance-cycle regression class is continuously guarded; guard metadata is canonical; CI requires no changes and is green on the exact code head locally, in GitHub Actions, and on Cloudflare Pages. No merge was performed; R9 was not started.

## 2. Exact live baseline and lineage (VERIFIED)

| Element | Value |
|---|---|
| `origin/main` at start | `1e2678645d3c41beb448da2a0d8d2b5d817a18fe` (PR #343 merge: R7 post-merge reconciliation + R8 gate opening; base parent `74908e1334098a51bb516aa3bbdcc898a4bedb1f` = PR #342 R7 implementation merge) |
| Post-merge CI | run `38038461385` — success on `1e267864` exactly |
| Open PRs at start | PR #344 (docs-only: the canonical R8 execution prompt itself — the delivery vehicle, disjoint from implementation scope) |
| Canonical prompt | branch `docs/r8-zai-execution-prompt-20261010` commit `3ec0bfdc`; SHA-256 `5779a8fe62dfd51e69860126c4cb99b3ef2d12a351bc2e95dd13d5c3cef11dd3` |
| Worktree | clean; single writer; explicit-refspec pushes only; upstream tracking unset |
| Preserved UI branch | `docs/ux-ui-zed-handoff-20260921` untouched (VERIFIED) |

## 3. Authorization and credential mode

Owner R8 execution mission (canonical prompt) with `BRANCH_AND_PR_ONLY`. GitHub operations via the secure askpass mechanism reading the token from the protected secrets store; the token was never printed, stored in the repository, committed, or quoted (NO_SECRETS_EXPOSED). No Cloudflare credential was present or needed (the Pages record was anchored by publicly fetching the production deployment — read-only evidence gathering, no provider settings touched).

## 4. R8-0 preflight results

Recorded in `R8-0-PREFLIGHT-AND-REPAIR-CARDS-2026-10-10.md`: live-state verification (§1 above); toolchain identity (local Node 24.21.0/zlib 1.3.2.1-motley; CI Node 22.23.3/zlib 1.3.1-e00f703; Pages provider-opaque); the R7 CF-repair evidence chain (+512 bridge, +167 run-to-run swing, +112 CI entry delta) read and then **root-caused**:

1. The +112 CI-over-local entry delta is the **build-identity string** (40-hex `GITHUB_SHA`/`CF_PAGES_COMMIT_SHA` vs the local `null` fallback) — proven by building locally with a 40-char identity, which reproduces CI's 629,412 exactly. Not toolchain drift.
2. The +167 gzip swing is **hash-name propagation**: lazy chunks statically import the entry; an identity change renames the entry and 92/105 assets (fixed-length hashes → raw constant, gzip shifts).
3. Raw can additionally shift ±4 from **esbuild identifier allocation** (character-frequency dependent).
4. Gzip **normalization converges**: canonicalizing known hashed filenames + the build identity makes all measured builds identical (proven across local null-identity, two 40-char identities, the CI run, and the Pages production deployment: lazyGzipNorm 363,974 everywhere).
5. The Pages production deployment (publicly fetched; embedded `CF_PAGES_COMMIT_SHA=1e267864`; manifest topology equal to the local build with 0 mismatches) measured raw-identical surfaces and +207 un-normalized lazy gzip — a distinct zlib build, explaining the R7 Pages failure definitively.

Baseline capture: full manifest-graph analysis (104 records; 1 entry; 70 dynamic roots; every emitted JS accounted); the filename-heuristic defect quantified (14,228 B lazy unguarded; 224,687 B misattributed); ratchet census (488 files); boundary graph (Finance cycle absent — runtime 0, type SCC = the documented storage pair only).

## 5. Five reviewer outputs and reconciliation

Recorded in the R8-0 report §7 (bundle/measurement, guard/boundary, CI/operations, architecture/invariants, hostile). All amendments folded into the cards before implementation; no BLOCKER. The hostile reviewer's challenges (tolerances as cushions; the CI bootstrap as red-to-green; the Pages production anchoring) are answered there and in §8 below.

## 6. Repair Card matrix — final dispositions

| ID | Classification | Final state |
|---|---|---|
| R8-F-020 (filename classifier) | FIX_NOW (R8-1) | **CLOSED_WITH_EVIDENCE** — manifest-closure classification; adversarial tests both directions; the missed/misattributed bytes now guarded |
| R7-CF-REPAIR (+512 bridge) | FIX_NOW (R8-1) | **CLOSED_WITH_EVIDENCE** — three environment records with provenance; deterministic gzip normalization (cross-environment convergence proven); evidence-derived tolerances with hard caps; +512 fields no longer exist |
| R8-F-005 (TFV pin unenforced) | FIX_NOW (R8-2) | **CLOSED_WITH_EVIDENCE** — exact-value baseline + ledger; the historical +12 growth bound by seed provenance |
| R8-F-006 (silent within-band community) | FIX_NOW (R8-2) | **CLOSED_WITH_EVIDENCE** — any growth fails without a chain-valid ledger entry; documented history represented, not reopened |
| R8-F-019 (Finance cycle regression) | FIX_NOW (R8-3) | **CLOSED_WITH_EVIDENCE** — rule R7, all import forms, 0 live edges, named negative test for the exact former pattern |
| R8-F-021 (guard metadata) | FIX_NOW (R8-3) | **CLOSED_WITH_EVIDENCE** — §4.3.1 canonical and complete (19 documented; build-only execution surfaces explicit; dated corrections) |
| R8-N1 (new: 31 duplicate precache URLs, +76,466 B overcount) | ~~SEPARATE_TRACK~~ → **FIX_NOW** *(dated correction 2026-10-10, owner decision on the R8-N1 continuation review)* | **CLOSED_WITH_EVIDENCE** — root fix on code head `7341f911`: `includeAssets` removed + `includeManifestIcons: false` (the second overlapping selector found by differential experiment — a naive includeAssets-only fix leaves exactly the 3 manifest-icon duplicates); one canonical `globPatterns` path; generated `sw.js` 156 entries / 156 unique / **0 duplicates** with the before/after unique set proven identical (lost=[] gained=[]); guard now fails closed (`DUPLICATE_PRECACHE_URLS`, 22 tests); `swRuntimeRawTotal` 28,885 → 26,170 re-anchored in all three environment records; full evidence in `R8-N1-PWA-PRECACHE-ROOT-FIX-EXECUTION-REPORT-2026-10-10.md` |

## 7. Execution/consumer inventories (where recorded)

R8-0 report §6 — every changed guard, baseline, package script, CI step, and metadata row with its direct consumers, CI/workflow references, baselines/fixtures, and tests. Verified live: the surfaces guard executes in the app `build` chain (local, CI `pnpm check`, Pages build) and directly (`node …/check-bundle-surfaces.mjs <dist>`); the ratchet and boundary guard execute in `pnpm guards` + CI + directly; `ci.yml` references nothing R8-new (no workflow change).

## 8. Bundle-surface definitions and before/after measurements

**Definitions (manifest-based, each emitted JS in exactly one surface, fail-closed):** entry (single `isEntry` js — reported only; `check-bundle-budget` owns the 650,000/155,300 ceilings); initial-closure companions (entry's static `imports` closure minus the entry); lazy/dynamic-only closure (`isDynamicEntry` roots via `imports`+`dynamicImports`, minus the initial closure; shared chunks attributed to initial, counted once); PWA precache (unique `precacheAndRoute` URLs, resolved safely, duplicates reported); sw-runtime (`sw.js` + `workbox-*.js`).

| Surface | Old guard (filename heuristic) | New guard @ `1e267864` graph |
|---|---|---|
| Entry | 629,300/154,683 local (guarded by budget) | same bytes — reported only |
| Initial companions | *(inside "lazy", misattributed)* | 2 files, 224,687 raw / 70,716 gzipNorm — **guarded** |
| Lazy | 101 files, 1,417,088 raw / 434,742 gzip (incl. 224,687 B of initial chunks; excl. 14,228 B of real lazy) | 101 files, 1,206,629 raw / 363,974 gzipNorm — **guarded** |
| Precache | 187 entries, 2,748,709 B (31 URLs double-counted) | 156 unique entries, 2,672,243 B (local) — **guarded** |
| sw-runtime | *(blind spot)* | 2 files, 28,885 B — **guarded** |

Cross-environment (same graph): CI = Pages = local on raw (lazy 1,206,629; initial 224,687; swRuntime 28,885); precache local 2,672,243 vs CI/Pages 2,672,355 (the +112 hex-identity entry footprint); normalized gzip identical in all three environments (363,974 / 70,716) — the variance class that broke R7 is eliminated at measurement level.

## 9. Environment/toolchain identity and variance evidence

Per-environment records in `bundle-surfaces-baseline.json` v2 with anchored provenance: `local` (this executor's build of the `1e267864` tree), `github-actions` (bootstrap: dispatch run `38046254527` failed `UNANCHORED_ENVIRONMENT`, printed `ANCHOR_RECORD` — that exact measurement is the record; verified green by run `38046633526`), `cloudflare-pages` (live production deployment, embedded SHA `1e267864`, topology-equal; provider node/zlib recorded as not-exposed). Tolerances: raw +8 (2× the observed ±4 identifier-shift), gzip +16 (2× the conservative post-normalization bound), hard caps raw ≤16/gzip ≤256 enforced by the guard (guard-weakening rejection). Unknown environments fail `UNVERIFIED_ENVIRONMENT`; unanchored environments fail with a machine-readable `ANCHOR_RECORD`.

## 10. File-size metric and baseline schema/policy

nbLOC (register methodology), bands unchanged, scope/exclusions literal. Baseline v2 = exact census (488 files) with binding provenance (historical-growth evidence chain; guard-growth documentation; future-reanchor protocol). Authorization: `file-size-ratchet-reanchors.json` entries (chained from/to + owner-review reference) — first real entries: `R8-3-RULE-R7` (boundary guard 398→431) and `R8-4-CI-ANCHOR` (surfaces baseline data 76→108). Drift audit: merge-base comparison; silent bumps, live-entry removals, and unresolvable bases (in CI) all fail.

## 11. Boundary rule and test evidence

Rule R7 (`components/**` → `pages/**`, every import form, resolution-based; explicit empty owner-reviewed exception list). Negative tests: value, type (the exact former `FinancePeriodResultSection → Finance` pattern), dynamic, relative-after-resolution, re-export, import-type-position. Positive: page→component passes; unrelated legal UI imports unaffected; live tree 0 violations (suite 25/25).

## 12. Guard metadata before/after

§4.3.1: title 17 → **19 documented** (dated R8/F-021 note); rows added for `check-bundle-budget` and `check-bundle-surfaces` (proves / does-not-prove / source of truth / execution surfaces incl. the build-only path / baseline policy / owner-review trigger / change classification); rows updated for the ratchet (v2) and boundaries (R1..R7). No second metadata table; no stale count statements elsewhere (searched; historical mentions remain historical).

## 13. CI/package-script execution map and duplicate-coverage analysis

`ci.yml` **unchanged**. Execution map: `pnpm check` → (control tests+validate → typecheck → lint → format → text-density → design-guards → 17 `pnpm guards` incl. the v2 ratchet with its drift audit [merge-base available via `fetch-depth: 0`] → root tests → app check → app tests incl. both bundle-guard suites → `prototype:build` = vite build [in-build budget gate] + budget + surfaces with environment anchoring). Duplicate analysis: the budget guard's two executions per build are **deliberate cross-path coverage** (in-build gate protects the direct `vite build` invocation; the script-chain run is part of the canonical build command) — removing either deletes a coverage path rather than deduplicating work; lint duplication was already removed in F-05c and is not reintroduced. The audit-retry policy, full-history checkout, concurrency group, timeout, and artifact upload are untouched.

## 14. Fixture-scope proof and false-positive boundaries

No new fixture exemptions exist. The surfaces/ratchet/boundary tests build their fixtures in temp directories at runtime (the canonical pattern); the guard-data exclusions (ratchet baseline + reanchor ledger — and only those) are measurement-data exclusions documented in the guard header, not `fixtures/` exemptions; `dist`/`node_modules`/coverage remain outside scope by their documented tool scopes. False-positive boundaries are test-proven: every guard's failure modes have dedicated negative tests (37 bundle + 20 ratchet + 25 boundary).

## 15. New findings

**R8-N1** — 31 duplicate precache URLs in `sw.js` (overlapping `includeAssets`/`globPatterns` globs; the old guard double-counted +76,466 B). Disposition at this report's original writing: `SEPARATE_TRACK_OPENED_WITH_EXACT_TRIGGER`. **Dated correction (2026-10-10): superseded — the owner classified R8-N1 `FIX_NOW` and the root fix is executed and closed with evidence on the same PR** (code head `7341f911`): the configuration overlap is eliminated at the root, the artifact carries each intended URL exactly once, and the guard fails closed on any returning duplicate. See `R8-N1-PWA-PRECACHE-ROOT-FIX-EXECUTION-REPORT-2026-10-10.md`.

## 16. Files changed and explicitly not changed

**Changed (21 + the R8-N1 root-fix set):** the three guard scripts + their three test files; `bundle-surfaces-baseline.json` (v2); `file-size-ratchet-baseline.json` (v2); `file-size-ratchet-reanchors.json` (new); `REFACTORING-PLAN-A-TO-Z.md` (§4.3.1); `FILE-SIZE-AND-RESPONSIBILITY-REGISTER.md` (§7 dated notes ×3); `WS-216.json`, `ARCH-007.json` + regenerated views; `current-state.md`, `current-state-log.md` (§161), `AGENT-SEQUENTIAL-WORKLOG.md` (Entry 76); six evidence reports (R8-0..R8-4 + this). *(Dated addition 2026-10-10, R8-N1 root fix: `vite.config.ts` — previously listed under "not changed" — now carries the canonical single-selection-path fix; plus the surfaces guard + its tests + the two ratchet data files + the re-anchored surfaces baseline + the R8-N1 report and dated corrections; see §6 and the R8-N1 report for the full changed/not-changed ledger.)*
**Explicitly not changed:** all `client/src/**` and `src/**` production code; `.github/workflows/ci.yml`; `package.json` scripts; every other guard; the preserved UI branch; any Cloudflare/provider setting. The emitted bundle graph is byte-equivalent to `main@1e267864` *(dated correction 2026-10-10: the R8-N1 root fix changes only the generated `sw.js` precache manifest — 31 duplicate entries removed; every JS/CSS chunk and every precached asset byte remains equivalent; the guarded JS surfaces and the unique precache set are unchanged)*.

## 17. All verification commands, exit codes, repetitions, and environments

| Command | Result | Environment |
|---|---|---|
| `pnpm check` (canonical aggregate) | **exit 0** — root 747/747 (63 files); app 2,462/2,462 (333 files); build + both bundle guards PASS | local Node 24.21.0, zlib 1.3.2.1-motley |
| Focused: bundle suites (`vitest run scripts/check-bundle-surfaces.test.mjs scripts/check-bundle-budget.test.mjs`) | 37/37 | local |
| Focused: ratchet v2 | 20/20 | local |
| Focused: boundaries (+ cycles) | 25/25; runtime 0 cycles; type SCC = baseline | local |
| Surfaces guard CLI: local record | PASS (parity) | local |
| Surfaces guard CLI: `CF_PAGES=1 …` against the production mirror | PASS (pages record verified) | local verification of the Pages record |
| Surfaces guard CLI: `GITHUB_ACTIONS=true` pre-anchor / post-anchor | FAIL `UNANCHORED`+`ANCHOR_RECORD` → PASS | local path check |
| CI dispatch `38045976873` (@`ec388bb6`) | failure — env-hermeticity test defect (inherited `GITHUB_ACTIONS` in a CLI subprocess test) — fixed in `a69f1e14` | github-actions |
| CI dispatch `38046254527` (@`a69f1e14`) | **expected** failure — the documented bootstrap: `UNANCHORED_ENVIRONMENT` + `ANCHOR_RECORD` printed; record anchored from it | github-actions |
| CI dispatch `38046574877` (@`a21bfba1`) | failure — the v2 ratchet correctly rejecting the un-ledgered baseline-data growth (+32 nbLOC) in CI — fixed via ledger entry `R8-4-CI-ANCHOR` in `d946db5e` | github-actions |
| CI dispatch `38046633526` (@`d946db5e`) | **success** — full chain green in the real CI environment | github-actions |
| Cloudflare Pages on `d946db5e` | **success** (PR preview; the production-anchored pages record passed — the R7 failure class is closed) | cloudflare-pages |
| PR #345 checks on the final head | pinned in the PR body after the docs commit (this report's commit) | all |

Repetition policy honored: no green workflow was re-run for repetition; each dispatch run above is a distinct head or a distinct documented purpose (bootstrap/fix/verify), and the PR-check runs are the standard PR gate on new heads.

## 18. Exact PR-head CI and Cloudflare URLs

- Code head `d946db5e`: CI run `https://github.com/Qays7753/Micro/actions/runs/38046633526` (success) · Cloudflare Pages check success on the same head (check-run on the PR).
- Final head (this report's docs commit): the PR body of #345 pins the exact CI run and Cloudflare check URLs for the final head after its checks complete (the only commits after the code head are docs/Operations-Control files with no guard or build input change).

## 19. Protected-impact statements

**Financial/semantic: none.** **Schema/export/import: none** (38/30). **Historical data: none.** **Rejection behavior: none.** **Security: none** (no secrets touched; NO_SECRETS_EXPOSED). **Visual UI: none** (no CSS/DOM/copy/navigation; bundle bytes unchanged).

## 20. Risks and rollback

Per slice (each independently revertible): R8-1 — revert restores the R7 guard + interim baseline (the +512 bridge returns; documented as superseded). R8-2 — revert restores the v1 band baseline (within-band growth becomes invisible again; the reanchor ledger becomes inert data). R8-3 — revert removes rule R7 and the metadata rows (the regression class reopens). R8-0/R8-4 — docs/control only. PR-level: standard revert of the merge. Residual risks: the surfaces tolerances could prove too tight for a future toolchain change (failure is the designed outcome — investigate and re-derive with evidence, never auto-widen); the CI-anchored record's raw values are identity-mode-dependent (hex SHAs — stable across the two observed CI eras; a mode change would fail loudly, not silently).

## 21. Operations Control proof

WS-216/ARCH-007 updated first as JSON, views regenerated (`generate_tracker.py`, `--refresh-excel-meta`, `--check` current), `validate.py` exit 0. Evidence appended (PR #345, CI runs, commit URLs). Live fields: branch/base/pr/next_action/updated_at; dated notes appended. `current-state.md` live fields updated within the 20,480-byte contract (20,429; guard PASS); §161 and Worklog Entry 76 appended. Generated views changed only by regeneration from the JSON source.

## 22. Merge Manifest (exact)

- **Merge PR #345** → `main` (owner decision; Z AI does not merge).
- **Post-merge verification (separate step, R2–R4/R7 pattern):** `git fetch origin --prune`; verify the merge commit's parents are `1e2678645d3c41beb448da2a0d8d2b5d817a18fe` (base) and the final source head; CI green on the merge commit; verify the bundle-surfaces baseline's three environment records remain valid on main (a merge does not change the bundle graph, so no re-anchoring is required); update Operations Control live fields (`R8_VERIFIED_ON_MAIN`, merge SHA, CI URL) + `current-state.md` + dated log entries; regenerate views; open the R9 gate. No cleanup, no branch deletion, no deployment changes.

## 23. Remaining work (exact packages only)

- **R8-N1** (duplicate precache URLs): ~~separate owner-gated track~~ → **closed by the FIX_NOW root fix on this PR** *(dated correction 2026-10-10)* — see `R8-N1-PWA-PRECACHE-ROOT-FIX-EXECUTION-REPORT-2026-10-10.md`; the follow-up PWA-config-decision trigger is consumed.
- **Pages provider toolchain opacity**: node/zlib versions are not exposed by Cloudflare; the environment is anchored by direct measurement instead (recorded as not-verifiable in the baseline provenance). No action required unless the provider exposes identity.

## 24. Owner action required

Review PR #345 with this report, the R8-0..R8-3 execution reports, the repair-card matrix, and the merge manifest; then merge by explicit separate authorization. Nothing in this wave assumes or implies approval.

---

**Answers to the contract's explicit questions:** the bundle guard no longer relies on filename prefixes (manifest closures; adversarial tests prove both misclassification directions are rejected) · entry/lazy/shared/precache surfaces are defined by manifest graph semantics with shared chunks attributed to initial and counted once · every counted file and precache URL is resolved, deduplicated, and bounded safely (path escapes and missing files fail closed) · the +512 bridge is replaced by per-environment anchoring with provenance (no blocker remains) · the method distinguishes real code growth from gzip/hash variance via deterministic normalization plus evidence-derived bounded tolerances while raw stays strict beyond ±8 · the file-size ratchet rejects unjustified within-band growth with old/new values · a same-PR baseline update cannot conceal growth (merge-base drift audit + chained ledger — proven by direct tests) · the Finance component→page dependency has a direct regression class covering value, type, dynamic, and relative imports · the live repository has zero violations of the new rule · guard metadata is canonical and consistent with actual commands and execution surfaces (19 documented) · fixture scopes are exact and false positives are covered by positive/negative tests · no financial, historical, schema, export/import, rejection, security, or visual behavior changed · no ceilings were raised and no baselines were weakened (tolerances evidence-derived and hard-capped; every change provenance-pinned or ledger-authorized) · findings fixed: R8-F-005/006/019/020/021 + R7-CF-REPAIR; preserved-with-evidence: none needed beyond the documented historical growth community; no separate R8 track remains; R8-N1 is FIX_NOW — CLOSED_WITH_EVIDENCE; out of scope: everything outside guard/measurement/CI files · not executed because merge is owner-only: the merge itself, post-merge verification, and the Operations Control post-merge reconciliation.

**Status:**

```text
R8_COMPLETE — PR_READY
R8-N1 — FIX_NOW — CLOSED_WITH_EVIDENCE
NO_MERGE_PERFORMED
NO_CLEANUP_PERFORMED
NO_UNAPPROVED_FINANCIAL_OR_SEMANTIC_CHANGE
NO_UNAPPROVED_SCHEMA_OR_EXPORT_IMPORT_CHANGE
NO_UNAPPROVED_HISTORICAL_DATA_CHANGE
NO_UNAPPROVED_VISUAL_UI_CHANGE
NO_BUNDLE_CEILING_RAISED
NO_GUARD_WEAKENED
NO_SECRETS_EXPOSED
```
