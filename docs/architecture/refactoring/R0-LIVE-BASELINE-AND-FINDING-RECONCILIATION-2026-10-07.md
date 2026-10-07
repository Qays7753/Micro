# R0 — Live Baseline and Finding Reconciliation — 2026-10-07

**Program:** `WS-216` / `ARCH-007` — Structural Remediation R0–R10 (successor; independent of closed programs WS-212, WS-214, WS-215, ARCH-006)
**Contract:** `docs/architecture/refactoring/ZAI-STRUCTURAL-REMEDIATION-R0-R10-EXECUTION-CONTRACT-20261007.md` (status `OWNER_ACCEPTED — R0_IN_PROGRESS`)
**Plan:** `docs/architecture/refactoring/STRUCTURAL-REMEDIATION-PLAN-20261007.md` (owner-accepted with explicit traceability appendix A.1–A.10)
**Mode:** `READ_ONLY` analysis on a fresh disposable clone; this report PR is the single controlled documentation-only write permitted after analysis
**Report date:** 2026-10-07 (UTC) · **Executor:** Z AI sequential repository executor · **Evidence classes:** every material claim below is labeled `VERIFIED` (command/file/SHA evidence recorded), `INFERRED`, or `UNVERIFIED`

---

## 1. Executive result and exact live baseline

**R0 result: the live baseline reconciles.** No `STATE_DRIFT`: every live pointer, branch, PR, claim, and numeric guard baseline was reconciled against the live tree without guessing, resetting, or overwriting. All deviations found are classified documentation drift or scheduled-plan gaps — none changes financial meaning, schema/export/import, history, security, or UI.

**Exact live baseline (all VERIFIED 2026-10-07, commands in §3):**

| Item | Live value |
|---|---|
| `origin/main` | `fc2ae6e7dbb6f03eef3b0e103ee6176eeddeb052` ("docs: pin R0 baseline to latest main head", 2026-10-07 11:22:31 +0300) |
| Checked-out commit | `fc2ae6e7dbb6f03eef3b0e103ee6176eeddeb052` (clean worktree, 0 uncommitted, 0 ahead/behind) |
| Open PRs | **0** (authenticated API) |
| Last merges | PR #322 (`d51f35b`→merge `c9909c2`, 08:12:50Z), PR #323 (`641ed51`→`773e775`, 08:18:30Z), PR #324 (`6091103`→`fc2ae6e`, 08:22:33Z) — all documentation-only |
| Active claim | exactly 1: `WS-216`/`ARCH-007` IN_PROGRESS, branch `refactoring/structural-remediation-r0-r10-20261007`, no PR |
| Contract + plan on `main` | both added at `d51f35b7bcafecf2d8c9e1b90e04d5ca30ad6990` (2026-10-07 08:11:49Z); blobs `4a8e1b57…` (335 lines) / `29f45d75…` (894 lines) |
| Schema/export | `localSchemaVersion = 38` (`storage/local/types.ts:55`), `localExportVersion = 30` (`:71`) — unchanged |
| Bundle (authoritative guard, this clone) | entry `630,510 raw / 155,094 gzip` vs ceilings `650,000 / 155,300` → PASS (margins 19,490 / 206); lazy 102 chunks `1,415,921 / 435,268`; precache 187 entries `2,743,853 B` — all within baseline |
| True lazy surface (R0-corrected, see F-11/R0-N1) | 103 chunks `1,425,287 raw / 438,331 gzip` (the loans door barrel escapes the guard's `index-*` filter) — still under baseline by 84 raw / 222 gzip |
| Guards | 14-guard chain — **all PASS** (exit 0; full list §12) |
| Tests (inventory, not executed) | root suite 644 listed cases / 57 files; app suite 2,222 listed cases / 300 files; recorded root count 619 is stale (§15) |
| CI on live head | run `37593346319` (push, `fc2ae6e`) completed **success** 08:26:38Z; Cloudflare Pages success — no queued/running checks anywhere |
| UI branch | `docs/ux-ui-zed-handoff-20260921` @ `f28b0fa6b933336fb1b847b906bf126de6f87e2d` — untouched since 2026-09-21 (preserved by design) |
| `pnpm audit` | **clean** (exit 0, no known vulnerabilities; ARCH-006 graph-level elimination holds) |
| Vendored braces | exactly 4 documented copies (prettier@3.9.6, rollup@4.62.4 ×2, vite@7.3.6) — monitoring guard PASS |
| Environment | `NORMAL` (8.4 GB disk free, ~3.5 GB RAM available, load 0.00, 2 CPU) |

**Headline reconciliation verdict:** the four completed historical programs are merged and verified on `main`; the successor's contract, plan, and claim are pinned; every one of the 17 Structure findings (F-01..F-15 + sub-findings), 16 protected-surface identifiers, 19 Flash principles/mechanisms, 6 conflicts, 7 lenses, 12 change vectors, and 10 verification questions now has a live classification (§6). **Twelve of the seventeen Structure findings are CLOSED on the live tree; the rest are PARTIALLY_CLOSED or OPEN exactly where the owner-approved plan already schedules them (R1–R10).** R0 additionally discovered **20 new live findings (R0-N1..R0-N20)** — none financial, none schema/export, none UI-visual — the most serious being a measurement artifact inside the bundle-surfaces guard (R0-N1, HIGH, route R8) that this report corrects on the record.

---

## 2. Repository, branch, PR, credential mode, and environment state

| Field | Value | Class |
|---|---|---|
| Repository | `https://github.com/Qays7753/Micro` | VERIFIED |
| Clone used for analysis | fresh disposable clone `/home/z/my-project/work/micro/repo-r0-20261007` (public HTTPS; pre-existing worktrees of completed programs were not touched) | VERIFIED |
| Credential mode | read operations via public clone + authenticated API using the platform secure credential field (token never printed, echoed, committed, or included in any file, log, PR body, or report; token file mode re-secured to 600 before use) | VERIFIED |
| Write operations | exactly one documentation-only PR (this one) after analysis completed; no `main` writes, no merges, no branch/PR deletions, no force-push | VERIFIED |
| Remote branches | `main`; `docs/ux-ui-zed-handoff-20260921` (preserved); `refactoring/structural-remediation-r0-r10-20261007` (`c9909c2` — fully merged ancestor of `main`, 4 commits behind); `docs/r0-pointer-reconciliation-20261007` (`641ed51`, merged); `docs/r0-final-head-reconciliation-20261007` (`6091103`, merged) | VERIFIED |
| Local work in prior worktrees | `work/micro/repo` (A-to-Z branch, historical), `work/micro/repo-postscan` (post-scan branch at `79c9859`, merged via PR #316) — both inspected read-only, not modified, no unowned work found | VERIFIED |
| Environment state | `NORMAL` — disk 9.9G total / 8.4G free; RAM 4,041 MB total / 3,530 MB available; load average 0.00/0.01/0.00; 2 CPUs | VERIFIED |
| Tooling notes | `gh` CLI unavailable in sandbox (API used instead — recorded by `validate.py` as a warning); pnpm 9.15.9 via corepack; Node v24.21.0 local (CI uses Node 22 — the ADR-012-documented environment drift applies to gzip figures, §15) | VERIFIED |

---

## 3. Commands and exit codes (executed 2026-10-07 08:34–09:20 UTC, recorded in order)

| # | Command | Exit | Key output |
|---|---|---|---|
| 1 | `git ls-remote https://github.com/Qays7753/Micro.git` | 0 | `main` = `fc2ae6e7dbb6f03eef3b0e103ee6176eeddeb052` (matches later fetch) |
| 2 | `git clone …Micro.git repo-r0-20261007` | 0 | fresh clone at `fc2ae6e` |
| 3 | `git fetch origin --prune` | 0 | no pruning needed; no new refs |
| 4 | `git rev-parse origin/main` / `git rev-parse HEAD` | 0 / 0 | both `fc2ae6e7dbb6f03eef3b0e103ee6176eeddeb052` |
| 5 | `git status --short --branch` | 0 | `## main...origin/main`, 0 uncommitted |
| 6 | `git branch -r` / `git rev-list --left-right --count HEAD...origin/main` | 0 / 0 | 5 remote branches; `0 0` |
| 7 | GitHub API `pulls?state=open` | 0 | **0 open PRs** |
| 8 | GitHub API `pulls/322..324` | 0 | head/base/merge SHAs recorded (§1) |
| 9 | GitHub API `commits/fc2ae6e…/check-runs` | 0 | `checks` success, `Cloudflare Pages` success |
| 10 | GitHub API `actions/runs?per_page=8` | 0 | run `37593346319` push `fc2ae6e` success; all 6 recent runs success |
| 11 | `python3 scripts/operations-control/validate.py` | 0 | 85 items, 58 workstreams, 1 active claim, `origin/main=fc2ae6e…`; 3 warnings (§15) |
| 12 | `python3 scripts/operations-control/generate_tracker.py --check` | 0 | views current |
| 13 | `node scripts/check-doc-index-coverage.mjs` | 0 | catalog coverage complete |
| 14 | `python3 -m unittest discover -s scripts/operations-control` | 0 | 8 tests OK |
| 15 | `pnpm install --frozen-lockfile` (disposable clone only) | 0 | 6.1s, cached store |
| 16 | `pnpm --filter @micro/prototype-web build` | 0 | vite build + budget + surfaces PASS (§1 numbers) |
| 17 | `pnpm guards` (14-guard chain) | 0 | all PASS (§12) |
| 18 | `pnpm audit --audit-level low` | 0 | no known vulnerabilities |
| 19 | `node scripts/generate-test-map.mjs --check` | 0 | no drift (matches committed evidence) |
| 20 | `node scripts/check-module-boundaries.mjs` | 0 | PASS — baselines 3/15/0/3/2/47 (§9) |
| 21 | `node scripts/check-type-cycles.mjs` | 0 | PASS — 1 accepted type cycle |
| 22 | `node scripts/check-runtime-cycles.mjs` | 0 | PASS — 400 files, 0 runtime cycles |
| 23 | GitHub API `commits/8ba44555…` / `commits/a59eeb15…` | 200 / 200 | both SHAs preserved on remote (§15) |
| 24 | Test inventory (`vitest list`, read-only) | 0 | root 644 cases / 57 files; app 2,222 cases / 300 files |

Not executed (recorded, not claimed): full root/app test suite execution (CI run `37593346319` on the same head already proves both suites green — `2,222/2,222` app and root suite included in `pnpm check`; local re-execution would duplicate a green CI result for an unchanged SHA, which the plan's R9 forbids as waste); `pnpm typecheck`/`lint`/`format:check` (same reasoning — covered by the green CI `pnpm check` on `fc2ae6e`). **Class: VERIFIED via CI evidence, NOT_EXECUTED locally — intentionally.**

---

## 4. Completed historical programs NOT repeated

| Program | Closure evidence on `main` | R0 stance |
|---|---|---|
| WS-212 / ARCH-002 (controlled remediation 3A–4E) | PRs #300–#308; closure head `04895f2`; two hostile audits AUDIT_PASS; current-state §8.7 | historical input only; not reopened |
| WS-214 / ARCH-004 (A-to-Z completion A0→Z) | PR #311 code merge `c26eb838`, records PR #312, final head `5eacbe38`; CI `37281587396`; A-TO-Z-CLOSURE-RECORD (Wave Z) with owner signature | historical input only; not reopened |
| WS-215 / ARCH-005 (post-scan W0–W10 + correction program) | PR #316 merge `988e6f0` (pre-merge reconciliation `931ce5b`); CI `37526123652`; two hostile audits (PASS at `db6ffbc`/`c71fa31`, PASS_WITH_CORRECTIONS at `e18f18f`); records #319/#320/#321 | historical input only; not reopened |
| ARCH-006 (vendored-toolchain/braces remediation) | PR #317 (graph-level elimination, merge `ea7dcff`), PR #318 (vendored inventory + monitoring guard, merge `ab91615`), records #319; audit clean live; 4 vendored copies guarded | historical input only; not reopened |

Each program's terminal claims were spot-verified live where they intersect R0 evidence (schema 38/30, bundle numbers byte-reproduced, guards green, shims/doors census) — see §5–§12. **No wave of any historical program was re-executed.**

---

## 5. Five specialist reviews and synthesizer reconciliation

Five read-only specialists (S1–S5) executed against the same immutable clone at `fc2ae6e`; the synthesizer (this report) owns the consolidated matrix. Specialists produced no competing reports and mutated nothing.

| Specialist | Scope | Headline result |
|---|---|---|
| **S1 — Architecture & boundaries** | module map, doors, deep imports, cycles, registry, port size | F-03/F-08 CLOSED with live evidence; F-06 PARTIALLY_CLOSED ratcheted (29 doors/37 houses, 43-key retained baseline, 47 sites enforced); port now **130** methods in 22 capability groups; target module map §14 matches live tree (all named houses exist). Found 5 stale-count records + 3 open size concentrations |
| **S2 — Domain, storage & data integrity** | schema/export, commit guards, adapters, capabilities, transfer, goldens, rollback | All 12 areas VERIFIED (38/30; 9 commit guards; 7 capability groups; 12 conformance files; 27 goldens+MANIFEST; 24 legacy pairs + current = 25 accepted, 11 rejected; backup-before-replace implemented at `localTransferService.ts:213–228`). 3 observations recorded (resetAll UI-gated backup; no record-normalization gate above `oldVersion<26`; settlementInvariant covered indirectly, no direct domain test by name) |
| **S3 — Runtime & growth** | ratchets, bundle surfaces, shims, runtime channels, PWA, generated artifacts | F-11 guard exists and passes BUT **N1 HIGH: `index-*` filter blind spot** — the loans door barrel (`index-DgMbwDO5.js`, 9,366 B, `isDynamicEntry`) escapes the lazy ratchet; true lazy = 103/1,425,287/438,331 (−84 raw only); F-10 **not fixed** (band-only ratchet; 55 new NORMAL files absorbed silently). 2 of 8 shims dead (zero consumers). FILE-register §4 carries 3 stale/false facts |
| **S4 — Tests, CI, security, operability** | test inventory, CI wiring, secrets, provenance, determinism, rollback | Root suite live count **644** vs recorded 619 (stale +25 security tests); CI runs every check-chain component exactly once (no lint duplication — F-05c fixed); audit step propagates exit codes (5-test pin); security register `REMEDIATED_BY_ELIMINATION` with 90-day review date (2027-01-06), fail-closed; ops-control provenance verified (145 source files, digest current, 8/8 self-tests). PG-2 central table missing the 14th guard |
| **S5 — Hostile independent reviewer** | challenged all specialist claims A–L + label deceptions + stale-SHA hunt | All 12 claims CONFIRMED (2 with nuances: shim is 11 not 12 lines; "exactly 1 cycle" is metric-scoped). Found the ADR-018 **false "−9,450 raw improvement" under a VERIFIED label**; the mixed value/type cycle gap (FinancePeriodResultSection ↔ pages/Finance) unguarded by both cycle guards; 15 dangling "gap cards" references; 2 SHAs not resolvable in a plain clone (API 200 — downgraded to LOW, §15); craft-order preserve card internal inconsistency |

**Synthesizer reconciliation of disagreements:** S1 reported the g5 shim as 12 lines; S5 measured 11 — reconciled to **11** (S5's byte-level count reproduced by synthesizer). S1 reported "exactly 1 type cycle"; S5 showed a **second, mixed value/type cycle** that both guards ignore — S1's statement is true for the type-edge metric only; the mixed-cycle gap is recorded as R0-N2. S4's environment lacked pnpm on PATH (corepack used) — no impact on results. S5's "2 unresolvable SHAs" was partially refuted by the synthesizer via GitHub API (both HTTP 200; `a59eeb1` also resolves locally after fetching `refs/pull/299/head`) — classified LOW doc-hygiene, not a missing-evidence blocker. All other specialist outputs agreed with each other and with the synthesizer's own independent battery (§3).

---

## 6. Complete finding and principle matrix (live reconciliation, no unexplained omissions)

Legend — Live classification: `CLOSED` (fixed on `main`, evidence below) · `PARTIALLY_CLOSED` (real progress + enforced ratchet; remainder scheduled) · `OPEN` (current defect, wave scheduled) · `REOPENED` · `DUPLICATE` · `FALSE_POSITIVE` · `PRESERVE_BY_DESIGN` (owner card) · `OWNER_DECISION_REQUIRED` · `CLOSED_OUT_OF_SCOPE_NO_TRIGGER` · `BLOCKER`. Every row cites live evidence (file:line / command / count). "Route" = the plan wave that owns the remainder.

### 6.1 Structure Scan findings F-01..F-15 (+ sub-findings)

| ID | Live classification | Evidence (live tree @ fc2ae6e) | Current defect? | Route |
|---|---|---|---|---|
| **F-01** three docs disagreed on program phase | **CLOSED** | Post-scan W1 unified the phase records; live: `REFACTORING-CONTROL.md` v1.9 §0/§14, `current-state.md` header + §9, `README.md` of the space all state one phase (`SUCCESSOR R0–R10 OPENED; R0 READ-ONLY ACTIVE`); no phase contradiction found by S5's doc sweep | No | — (record) |
| **F-02** current-state pinned stale `main` SHA | **CLOSED** (residual one-merge lag = documented pattern) | Header pins `773e775` (authored during PR #324) vs live `fc2ae6e`; the file itself mandates fetch-first and disclaims SHA currency; `773e775..fc2ae6e` diff = PR #324's 9 docs-only files (VERIFIED). Same lag in WS-216 `base_sha` — flagged by `validate.py` warning | No (pattern) | R1 (pointer refresh included in this PR) |
| **F-03** registry named stale `g5Service` cycle | **CLOSED** | Registry §5:192 names `financialAnalysisService ↔ projectFinancialService` (historical name noted); live type-SCC census = exactly 1 (`supplierScheduleCommitGuard.ts ↔ types.ts`, STR-307 baseline, guard PASS); `g5/g5Service.ts` = 11-line compat shim, 3 production consumers all type-only | No | R7 (shim removal at zero consumers) |
| **F-04** owner-money imported its own sibling via finance shim | **CLOSED** | `finance/withdrawalWalletGuard.ts` absent (removed Wave E/ADR-016, shims 9→8); canonical at `application/owner-money/withdrawalWalletGuard.ts`; importers = `ownerEntitlementService.ts:27` + `projectFinancialEventWrites.ts:23` (both canonical-path); test pins "the one canonical policy" | No | — |
| **F-05a** guard header claimed unimplemented check C4 | **CLOSED** | `check-skill-references.mjs:11–21` — header documents C4 as warning-only with dated F-05a correction note; retired skills excluded explicitly | No | — |
| **F-05b** fixtures exclusion inconsistent between guards | **CLOSED** | `check-test-focus.mjs:43–44` `EXCLUDED_EXACT_DIRS = ["scripts/fixtures"]` mirrors `check-secrets.mjs`'s documented narrowing (F-056/REM-004); both headers cross-reference the unification | No | — |
| **F-05c** CI ran `pnpm lint` twice | **CLOSED** | `ci.yml:72–75` — standalone lint step removed with explanatory comment; lint runs exactly once inside `pnpm check`; S4 verified no check-chain component skipped or duplicated | No | — |
| **F-06** no application public doors (~905+ deep imports) | **PARTIALLY_CLOSED** (ratcheted terminal state, ADR-018) | 29 doors / 37 houses; R6 ratchet: 47 deep-import sites = 43-key retained baseline (36 composition-root `PrototypeServicesContext` + 7 frozen-shim/presentation keys), guard FAILs on any new key or stale row; `applicationDoors.contract.test.ts` pins all 29 doors' value surfaces (type exports not pinned — R0-N20) | No (ratcheted) | R5 (door review + type-surface pinning) |
| **F-07** formatters consumed upward by application | **PARTIALLY_CLOSED** | Kernel extracted to `application/formatting/` (Wave B); guard baseline `application→presentation = 0` edges (PASS); residual: money/format/date/message ownership characterization is R2 scope; 1 presentation retained key in R6 baseline | No | R2 |
| **F-08** projectFinancialService mixed readers+writers (1,503 nbLOC) | **CLOSED** | Split verified live: coordinator `projectFinancialService.ts` 142 nbLOC + `projectFinancialTypes.ts` 288 + `Reads` 215 + `PeriodReads` 407 + `Insights` 207 + `EventWrites` 441 — reads and writes in separate files; PC-4 read-model contract in coordinator header; no `application/finance` file ≥800 nbLOC remains (largest `statementService.ts` 684) | No | — |
| **F-09** bounded UI coupling set | **PARTIALLY_CLOSED** | Live ratchets: 15 UI→domain edges, 2 UI→storage edges, 47 UI→app-interior sites — all baseline-frozen (guard PASS); view-model extraction (STR-305) and page-owned models (STR-204c) remain R7 | No (ratcheted) | R5/R7 |
| **F-10** file-size ratchet permits within-band growth | **OPEN** (current defect, scheduled) | `check-file-size-ratchet.mjs` compares **band labels only** (baseline stores bands, not sizes): NORMAL file can grow 1→399 silently; **55 new NORMAL files absorbed** since baseline without any update (S3+S5 independently recomputed); plan R8 explicitly schedules the within-band fix | **Yes** | **R8** |
| **F-11** bundle budget gated entry chunk only | **PARTIALLY_CLOSED + NEW DEFECT** | Surfaces guard exists (lazy raw/gzip + precache bytes guarded, baseline `bundle-surfaces-baseline.json`, ADR-012 CI-anchor documented) — the original F-11 gap is closed. **But** the lazy filter `!name.startsWith("index-")` also swallows dynamically-imported door barrels: loans barrel `index-DgMbwDO5.js` (9,366 B, `isDynamicEntry`) escapes; true lazy 103/1,425,287/438,331 = **−84 raw** only; ADR-018:17 and worklog Entry 47 record a false "−9,450 raw improvement" under a VERIFIED label (R0-N1, HIGH) | **Yes** (sub-defect) | **R8** (guard fix) + this PR (dated ADR correction) |
| **F-12** six pages smoke-only coverage | **CLOSED** | `SmokeOnlyPagesJourneys.dom.test.tsx` — 6 real journeys (CashWalletEditor, CashReversalEditor, G5DeclarationEditor, InventoryReversalEditor, ReceivedLoanDetail, SharePreview), added W7 (`ac114ac`), fixed `db6ffbc`; generated test map classifies all six `direct` with this evidence; `generate-test-map.mjs --check` no drift | No | — |
| **F-13** duplication not fully classified | **PARTIALLY_CLOSED** | Duplications closed by prior programs: capability extraction (7 groups), formatting kernel, STR-623 anchors (4, guard PASS), error builders/resultCodes densification; remaining transfer-side duplication disposition is R4 scope per plan | No | R4 |
| **F-13c** money messages / persisted notes | **OPEN** (scheduled; no silent change occurred) | Message-only vs persisted-note vs semantic-rule classification not yet executed; W10 evidence: persisted notes byte-identical across program; R2 runs characterization first | No (not yet a drift) | **R2** |
| **F-14** guard gaps (proves/does-not-prove) | **PARTIALLY_CLOSED** | Central PG-2 table (`REFACTORING-PLAN-A-TO-Z.md` §4.3.1) covers 13 guards with يثبت/لا يثبت/تصنيف columns; **14th guard `check-vendored-braces` missing from the table** (R0-N12); mixed-cycle gap unguarded (R0-N2); test-map drift check not wired into CI (R0-N15d) | Partly | R1/R8 |
| **F-15** protection chain (financial/history) | **PRESERVE_BY_DESIGN** (verified intact) | 9 commit guards; IndexedDB/Memory parity (12 conformance files, shared scenarios); 27 goldens + MANIFEST (24 legacy pairs + current + supplement); backup-before-replace (`localTransferService.ts:213–228`); 4 acceptance-value anchors; entity touchpoints 40/40; schema 38/30 pinned by 5+ governance tests. Preserve-card completeness gaps noted for `craft-order/policies.ts` (R0-N8) | No | R3/R4/R6 (cards) |

### 6.2 Structure conflicts and protected links (CON / STR / FIN / AV / EXE)

| ID | Live classification | Evidence | Route |
|---|---|---|---|
| CON-1 (program-phase unification) | **CLOSED** | as F-01 | — |
| CON-2 (live SHA + fetch-first) | **CLOSED** | as F-02 (fetch-first rule live in `current-state.md` §0 and AGENT-BRIEF) | R1 refresh |
| CON-3 (old-name cycle) | **CLOSED** | as F-03 | — |
| CON-4 (SUPERSEDED banners + live metadata) | **PARTIALLY_CLOSED** | banner discipline verified (ADR-016/017 carry dated notes); **but** registry status line 224 (`131/131`), FILE-register §4 stale facts, README v1.4 citation remain unreconciled (R0-N3/N4/N9) | **R1** |
| STR-106 (UI→domain value imports) | **PARTIALLY_CLOSED** (15 edges ratcheted) | guard baseline R1-embedded, PASS | R7 |
| STR-203 (formatting kernel decision) | **PARTIALLY_CLOSED** | kernel exists (`application/formatting/`); full ownership characterization R2 | R2 |
| STR-204b (type-only cycle) | **CLOSED** (guarded) | 1 accepted SCC in `TYPE_SCC_BASELINE`, guard PASS. **New gap:** mixed value/type cycles escape both guards (R0-N2) | R8 (new gap) |
| STR-204c (page-owned view model) | **OPEN** (scheduled) | live mixed cycle `FinancePeriodResultSection.tsx ↔ pages/Finance.tsx` (value edge `Finance.tsx:68`, type edge component:12) documented in registry §5:193 but unguarded — extraction is R7 | **R7** |
| STR-301 (131-method storage port) | **PARTIALLY_CLOSED** | port now **130 methods / 22 capability groups** (registry §2; `getActualTimeRecord` removed Wave D/STR-618); 7 capability stores extracted with anchors + contract tests; full-registry disposition is R3 | **R3** |
| STR-302 (financial rule ownership) | **OPEN** (scheduled) | settlement arithmetic/withdrawal coverage/derivePeriodCogs ownership decision matrix is R2/R5 scope; no silent moves occurred (domain diff empty in all prior programs) | R2/R5 |
| STR-305 (view models for persistence types) | **OPEN** (scheduled) | 17-file coupling set bounded by ratchets; extraction R7 | R7 |
| STR-307 (type-only storage cycle) | **PRESERVE_BY_DESIGN** | `supplierScheduleCommitGuard.ts ↔ types.ts` in guarded baseline; registry §5:191 | — |
| FIN-002 (lazy UI service construction) | **PARTIALLY_CLOSED** (documented) | 4 documented lazy constructions with FIN-002 headers (`ExpenseBudgetsSectionBody.tsx:78`, `Finance.tsx:52–158`, `Loans.tsx:48–62`, `ReceivedLoanEditor/Detail`); route-level lazy routes in `MicroRouter.tsx:15–23` | R7 (review) |
| AV-04 (missing-integrity rejection) | **CLOSED** (verified) | `transferEnvelope.ts` — current-pair file without integrity block rejected; wired at `localTransferService.ts:189–190` | — |
| AV-05 (money safety in transfer boundary) | **CLOSED** (verified) | `transferFamilyValidators.ts:29–32` `isMoney` safe-integer + non-negative; drift/golden evidence (27 goldens, 25 accepted pairs) | R4 (continuity) |
| EXE-014 (verified backup before replace) | **CLOSED** (verified) | `localTransferService.ts:213–228` `confirmImport` → `createVerifiedExport()` → `replaceSnapshot` only after ok; failed backup = `STORAGE_ERROR`, nothing touched. Observation: `resetAll()` (293–298) service-level backup is UI-gated only (R0-N18) | R4 (review) |

### 6.3 Flash principles, clarifications, governance (PA / PC / PG / RS)

| ID | Live classification | Evidence | Route |
|---|---|---|---|
| PA-1 (one write path per fact) | **PARTIALLY_CLOSED** | registry write-path rows exist (§1–§6); formal write-path authority rule per fact = R1 deliverable | R1 |
| PA-2 (owned runtime channels) | **OPEN** | `BroadcastChannel("micro-data-changed")` lives only in `PrototypeServicesContext.tsx:162–182` (one owned surface) but is **not registered in the ownership registry** (0 grep hits); plan checkbox (line 171) unchecked | **R1** |
| PA-3 (feature retirement Preserve/Migrate/Tombstone) | **PARTIALLY_CLOSED** | retirement protocol exists for entities (touchpoints w/ notExportedReason); feature-level retirement record = R1; **2 dead shims' zero-consumer trigger fired unrecorded** (R0-N5) | R1/R7 |
| PA-4 (locale/RTL/formatting single owner) | **OPEN** (scheduled) | single-owner designation is R1/R2; English-numeric input kernel (`application/input/englishNumeric.ts`) exists; locale APIs absent from domain (Q-c evidence) | R1/R2 |
| PC-1 (no ambient clock/random/locale in domain) | **PARTIALLY_CLOSED** | Math-ban lint rules + negative tests live; Clock port (`application/time`) exists; full indirect-use census = R1/R2/R9 | R2/R9 |
| PC-2 (triggers observable + owner-ratified) | **CLOSED** (mechanism) | `INDEPENDENT-TRACKS-RECORD.md` records R/S/T/U/V/W/X with exact triggers; STR-623 disposition gated | — |
| PC-3 (doors expose only consumer need) | **CLOSED** (value surfaces) | contract test pins exact value surfaces of 29 doors; widening fails `toEqual`; type exports not pinned (R0-N20) | R5/R8 |
| PC-4 (read-model contracts) | **PARTIALLY_CLOSED** | PC-4 headers live in PFS family (inputs/derivation/invalidation); full read-model registry = R5/R9 | R5/R9 |
| PG-1 (registry reconciliation history) | **PARTIALLY_CLOSED** | registry carries dated "آخر مصالحة 2026-10-05" + PG-1 rule; **new drift items (R0-N3/N4) require a fresh dated reconciliation** | **R1** |
| PG-2 (guard charters) | **PARTIALLY_CLOSED** | central 13-guard يثبت/لا-يثبت table live; 14th guard missing (R0-N12); per-header charters strong but differently formatted | R1/R8 |
| PG-3 (decision-rights map) | **CLOSED** | `REFACTORING-CONTROL.md` §12 standing-decisions table with sources | — |
| PG-4 (precedence order) | **PARTIALLY_CLOSED** | precedence stated in plan R1 deliverables and AGENTS §3; canonical precedence ladder write-up = R1 | R1 |
| PG-5 (governance artifact owner/trigger/staleness) | **PARTIALLY_CLOSED** | most artifacts carry owners; staleness status columns incomplete (README/registry drift proves need) | R1 |
| PG-6 (data rollback procedure + rehearsal) | **CLOSED** (rule) / **PARTIAL** (rehearsal) | rule mandated; one live rollback rehearsal recorded (§131: re-adding `tsx` fails vendored-braces guard); no full restore drill for durable formats — Q-i honest partial | R9 |
| RS-1..RS-5 (principles restructure) | **OPEN** (scheduled) | all five are R1 deliverables (merge Reversibility+Data-Rollback, Historical-Integrity+Append-only, size-bands→Policy/Runbook, guards-list→CI/Runbook, Freeze/Wave/Handoff→Program Plan) | **R1** |

### 6.4 Flash conflicts C1–C5, lenses L-A..L-G, vectors V1–V12, questions Q-a..Q-j

| ID group | Live classification | Notes |
|---|---|---|
| C1 (P14/P18 rollback duplication) | **OPEN — R1** (via RS-1) | scheduled |
| C2 (data-at-rest vs append-only boundary) | **OPEN — R1/R2/R4** (via RS-2) | scheduled |
| C3 (program freeze mixed into permanent governance) | **OPEN — R1** (via RS-5) | scheduled |
| C4 (port/second-implementation expansion without trigger) | **PARTIALLY_CLOSED** | trigger matrix live (independent tracks); formal expansion guard = R1/R3 |
| C5 (guard weakening without false-positive path) | **PARTIALLY_CLOSED** | PG-2 correct-not-weaken path documented; formal charter = R1/R8 |
| L-A (governance sustainability/staleness) | **OPEN — R1/R9/R10**; live proof of need: the stale records found in §15 | |
| L-B (decision rights, no re-asking) | **CLOSED** (mechanism) — §12 table | |
| L-C (retention/deletion/archival) | **CLOSED_OUT_OF_SCOPE_NO_TRIGGER** — trigger recorded (first external user data / regulatory signal) | |
| L-D (financial reconstructability) | **OPEN — R2/R9** (Q-h evidence pending) | |
| L-E (local security/trust scope) | **CLOSED_OUT_OF_SCOPE_NO_TRIGGER** — trigger recorded (distribution beyond owner-controlled devices) | |
| L-F (agent knowledge/priority order) | **PARTIALLY_CLOSED** — AGENTS §2 is the single routing table (no competing list found by S5); doc-index complete | |
| L-G (Python/analytics need) | **CLOSED_OUT_OF_SCOPE_NO_TRIGGER** — trigger recorded | |
| V1 partial refunds | OPEN — R2/R4 (any historical change carries manifest) | |
| V2 money contract | **PRESERVE_BY_DESIGN** — any change = owner decision + separate schema/semantic track | |
| V3 UI overhaul | **PARTIALLY_CLOSED** — structural-only in R7; visual redesign stays in UI track T (NOT_TRIGGERED) | |
| V4 field/owner placement | OPEN — R1/R5 (registry + doors + feature map) | |
| V5 retire feature | PARTIALLY_CLOSED — R1/R4 via PA-3 | |
| V6 ADR/registry conflict | OPEN — R1 via PG-1/PG-4 (live examples: R0-N3/N4) | |
| V7 runtime perf regression | **CLOSED_OUT_OF_SCOPE_NO_TRIGGER** — trigger = measured regression | |
| V8 cross-module reactive update | PARTIALLY_CLOSED — channel owned in code, registration R1 (PA-2) | |
| V9 guard false positive | PARTIALLY_CLOSED — PG-2 path documented; formal charter R1/R8 | |
| V10 multi-workspace/Auth/Sync | **CLOSED_OUT_OF_SCOPE_NO_TRIGGER** | |
| V11 error shape change | OPEN — R2 (error identity + characterization) | |
| V12 code generator | **CLOSED_OUT_OF_SCOPE_NO_TRIGGER** | |
| Q-a registry vs live code | **PARTIAL** — sample rows match (S1 §9, S2 §11) except enumerated stale lines (R0-N3/N4/N9) | |
| Q-b guard claim vs assertion | **PARTIAL** — charters central (13/14 guards); negative tests live for most guards (ratchet tests, anchors tests, audit-step tests) | |
| Q-c domain ambient clock/random/locale | **VERIFIED (negative)** — no ambient use found; Math-ban + clock-port evidence; full census R2/R9 | |
| Q-d read-model derivation/invalidation | **PARTIAL** — PC-4 headers in PFS family; full registry R5/R9 | |
| Q-e non-import runtime channels | **PARTIAL** — one channel (BroadcastChannel, owned in code) + `dataVersion` counter; registry registration R1 | |
| Q-f rounding/parsing/formatting count | **PARTIAL** — kernels exist (`domain/shared/currency|numeric`, `application/formatting`, `presentation/formatters`, `application/input/englishNumeric`); single-source inventory R2 | |
| Q-g export/import versions | **VERIFIED** — 25 accepted pairs (24 legacy + current 30/38) with reasons; 11 rejected pairs pinned; 27 goldens + MANIFEST; round-trip + migration tests live | |
| Q-h financial reconstructability | **PARTIAL** — durable inputs + derivation owners mapped in registry; graded reconstruction evidence R2/R9 | |
| Q-i rollback rehearsal | **PARTIAL (honest)** — code rollback boundaries documented per wave; data rollback mechanism verified (backup-before-replace, goldens); one live guard-reversal rehearsal (§131); full restore drill = R9 | |
| Q-j superseded docs + CI wiring | **VERIFIED** — doc-index complete; CI wiring verified end-to-end (audit step → check chain → build → guards, no duplication, exit codes propagate) | |

### 6.5 New findings discovered by R0 (not present in the source reports)

| ID | Sev | Finding | Live evidence | Route |
|---|---|---|---|---|
| **R0-N1** | HIGH | Bundle-surfaces lazy ratchet blind spot + false improvement claim under VERIFIED label | `check-bundle-surfaces.mjs:60` filters `index-*`; loans door barrel `index-DgMbwDO5.js` (9,366 B raw / 3,063 gzip, `isDynamicEntry` per vite manifest) escapes; true lazy 103 chunks/1,425,287 raw/438,331 gzip (−84 raw / −222 gzip under baseline) vs reported "102 / 1,415,921 / −9,450"; ADR-018:17 + worklog Entry 47 carry the false figure; baseline (16a3b9a/c71fa31, Oct-5 morning) predates doors wave (086c1d4, Oct-5 19:05) | **R8** (guard: use `isEntry`/`isDynamicEntry` semantics like the budget guard); **dated correction appended to ADR-018 in this PR** |
| R0-N2 | MEDIUM | Mixed value/type cycles invisible to both cycle guards | live mixed SCC `FinancePeriodResultSection.tsx ↔ pages/Finance.tsx` (value + type edges); `check-runtime-cycles.mjs` ignores type edges; `check-type-cycles.mjs` ignores value edges; registry §5:193 documents it but no guard enforces | R8 |
| R0-N3 | MEDIUM | Registry status line stale port count | `OWNERSHIP-AND-TRUTH-REGISTRY.md:224` "131/131" vs same file :41/:70 "130/130" and live interface (130 methods) | R1 |
| R0-N4 | MEDIUM | FILE-register §4 PRESERVE rows carry stale/false facts | line ~1280 "no BroadcastChannel in production" — false (`PrototypeServicesContext.tsx:171`); line ~1282 gzip ceiling "155,000" vs live 155,300 (ADR-017); line ~1272 "application has no barrels / 18 domain barrels" vs live 29 doors / 19 domain barrels | R1 |
| R0-N5 | MEDIUM | 2 dead compat shims; zero-consumer trigger fired but unrecorded | `finance/expenseRecordIntent.ts`, `finance/expenseCategorySuggestions.ts` — zero consumers repo-wide (only self-mentions); removal condition ("after UI import migration") already satisfied; `INDEPENDENT-TRACKS-RECORD.md:25` still says shims "remain with their consumers" | R1 (record) + **R7** (zero-consumer removal slice) |
| R0-N6 | MEDIUM | 15 dangling "gap cards" references | FILE-register lines 794…1223 promise "بطاقات الفجوة" for zero-direct-test files; no gap-cards document exists in docs/ | R1/R9 |
| R0-N7 | LOW | 2 SHA citations not resolvable in a plain clone | `8ba44555…` (REFACTORING-CONTROL.md:24) and `a59eeb1…` (register:5) — both HTTP 200 via GitHub API (preserved in PR histories / `refs/pull/299/head`); no live branch points at them | R1 (annotation) |
| R0-N8 | MEDIUM/LOW | craft-order/policies.ts preserve card internally inconsistent | register row 39 = PRESERVE w/ full exception text; detailed card :894 still opens "SPLIT_NOW (size) — PRESERVE behavior"; tests pillar = 0 direct tests with dangling gap-cards pointer | R6 (card completion) |
| R0-N9 | LOW | refactoring README table staleness | README:46 cites register v1.4 / 1,323 tracked vs live v1.5 / 1,483 tracked (head-pinned numbers drifting) | R1 |
| R0-N10 | LOW | Worklog Entry 47 gzip figure without environment label | 435,338 (CI Node-22) vs ADR-018 435,268 (local) — ADR-012 drift applies but unlabeled | R1 (note) |
| R0-N11 | MEDIUM | Recorded root test count stale | current-state-log §132 + worklog Entries 46/47 record 619/619; live collection = **644** cases (delta = 25 security tests from PRs #317/#318: parity 8 + ci-audit-gate 6 + vendored-braces 11); app 2,222 exact | R1 (record correction; CI green proves suite health) |
| R0-N12 | MEDIUM | PG-2 canonical guard table missing 14th guard | `check-vendored-braces` (PR #318) absent from REFACTORING-PLAN-A-TO-Z §4.3.1 and any mention in that file | R1 |
| R0-N13 | LOW | Guard-count drift across records | "13 guards" (plan/Entry 46) vs "14" (§131) vs live 14 | R1 |
| R0-N14 | LOW | §130 audit-gate test count stale | recorded 25/25; four files now total 28 (11+5+6+6) | R1 |
| R0-N15 | INFO | Four minor operability facts | (a) audit checker default `--audit-level high` (documented posture); (b) Actions pinned by major tag, not SHA; (c) test-map drift check not wired into `pnpm check`/CI (its unit test runs in root suite); (d) whitespace gate runs on `pull_request` events only | R8 (owner-informed choices) |
| R0-N16 | LOW | Security-register owner field wording | entry status `REMEDIATED_BY_ELIMINATION` (correct, fail-closed, review 2027-01-06) but `owner` field text still reads "DECISION PENDING" while `note_on_owner_decision` declares it moot | R1 (wording) |
| R0-N17 | INFO | 55 new NORMAL files absorbed silently by ratchet | recomputed independently by S3 and S5 — the concrete instance of F-10 | R8 |
| R0-N18 | OBSERVATION | `resetAll()` backup is UI-gated, not service-enforced | `localTransferService.ts:293–298` + Settings resetFlow gate (`Settings.tsx:188–190,305–366`); documented exclusivity | R4 (review) |
| R0-N19 | OBSERVATION | settlementInvariant has no direct domain-level test by name | covered indirectly via MIC-18 (`integrityCheckService.test.ts:1239–1354`) + D-15 (`tests/domain/craft-order-d15-settlement.test.ts`) | R9 |
| R0-N20 | OBSERVATION | Doors contract test pins value surfaces only | `applicationDoors.contract.test.ts` header discloses type exports not pinned | R5/R8 |

**No finding in §6.5 is a financial, schema/export/import, historical-data, security-permission, or UI-visual change.** R0-N1 is corrected on the record in this PR (dated ADR note); everything else is routed to its plan wave.

---

## 7. Current module/feature map and target module map

**Current (VERIFIED):**
- `src/domain/` — **19 areas** (18 substantive + `g5` compat barrel): actual-time, asset, budget, cash-continuity, catalog, craft-order, direct-sale, financial-analysis, financial-event, g5(compat), inventory-material, loan, owner-entitlement, owner-safe-withdrawal, received-loan, recurring-expense, recurring-margin, shared, supplier-purchase.
- `apps/prototype-web/client/src/application/` — **37 houses** (activity, agreements, assets, budgets, cash, catalog, collections, cost, diagnostics, direct-sales, drafts, estimates, finance, financial-analysis, financial-pulse, financial-records, follow-up, formatting, fulfillment, g5(compat), home, identity, input, inventory, loans, owner-money, owner, parties, preferences, profile, recurring, scheduling, security, share, suppliers, time, transfers) — every house name-covered by the ownership registry (registry-coverage guard PASS).
- `pages/` — 60 production pages (+9 test files); `components/`, `presentation/`, `storage/local/` (+ `capabilities/` 7 groups), `app/` composition root (`PrototypeServicesContext.tsx`, `MicroRouter.tsx`).
- Storage port: `PrototypeLocalStore` = **130 methods** across **22 registered capability groups**; 7 extracted capability stores under `storage/local/capabilities/`.

**Target map (VERIFIED as logical-only):** `REFACTORING-ARCHITECTURE-AND-MIGRATION-PLAN.md` §14 "Target module map" (+ §23.8 execution status). Spot-check of 10+ map-named boundaries — **all exist live**; no map-named house is missing. Reverse direction: houses created after §14's snapshot (owner-money, recurring, financial-analysis rename, budgets, financial-records) are tracked in §23.8 as dated executions — the tree is *ahead* of the dated §23.8 text (stale-count instances recorded as R0-N4/N9). The plan's R5/R6 own the remaining target-state reconciliation (door review for the 8 doorless houses — 4 of which need no door per STR-615 context-only rule, 4 served via retained composition-root exceptions).

**Discoverability:** domain fully barreled (19 doors, 3 ratcheted exceptions); application 29 doors + 8 compat shims (2 dead — R0-N5); registry-coverage guard enforces name-coverage of every live house/area.

---

## 8. Oversized / mixed-responsibility file register reconciliation

Live register `FILE-SIZE-AND-RESPONSIBILITY-REGISTER.md` v1.5 (head-pinned; ratchet-authoritative baselines live in `scripts/file-size-ratchet-baseline.json` — 407 files banded, 462 measured, 0 escalations):

| Band (register summary) | Count | R0 reconciliation |
|---|---|---|
| SPLIT_NOW | 12 (register) | live application-layer >800 nbLOC production files = 3: `transferFamilyValidators.ts` 1718 (**PRESERVE**, ADR-017 card complete), `transferSnapshotValidation.ts` 1184 (SPLIT_CANDIDATE per live band), `ownerEntitlementService.ts` 998 (SPLIT_CANDIDATE). Pages `OrderDetail.tsx` 1833, `Finance.tsx` 1619, `FinancialEventEditor.tsx` 1268, `index.css` 6778 = UI_OUT_OF_SCOPE (Wave T). Adapters `IndexedDbLocalStore` 4133 / `MemoryLocalStore` 2087 = full long-term exception cards (W6). `craft-order/policies.ts` 1399 = PRESERVE card (field gaps → R0-N8) |
| SPLIT_CANDIDATE | 13 | all banded + ratcheted; dispositions due R6 |
| WATCH | 42 | ratcheted; within-band growth unmeasured (F-10, R8) |
| LARGE_TEST | 4 | out of production-ratchet scope by design |

Post-scan splits verified live: `integrityCheckService` → coordinator 180 + 8 siblings; `projectFinancialService` → coordinator 142 + 5 siblings (F-08); `inventoryMaterialService` → coordinator 181 + 7 siblings. All three originally-SPLIT_NOW application services are now below band or documented. **The register's own §4 PRESERVE rows embed stale facts (R0-N4) — R1 reconciliation.**

---

## 9. Layer, dependency, cycle, and deep-import analysis (all VERIFIED, guard exit 0)

| Boundary rule | Live baseline | Enforcement |
|---|---|---|
| Domain deep imports (inside domain) | 3 accepted | ratchet — new = FAIL |
| UI→domain edges | 15 accepted | ratchet |
| Application→presentation edges | **0** | ratchet (F-07 kernel effect) |
| Cross-domain-area deep pairs | 3 accepted | ratchet |
| UI→storage edges | 2 accepted | ratchet (resolution-based) |
| UI→application-interior deep imports | 47 sites = 43-key retained set (36 composition root + 7 frozen shims/presentation) | R6 ratchet: new key = FAIL; stale row = FAIL |
| Type-only SCCs | 1 accepted (`supplierScheduleCommitGuard ↔ types`, STR-307) | Tarjan guard, new SCC = FAIL |
| Runtime cycles | 0 across 400 production files | guard PASS |
| Mixed value/type SCCs | 1 known (`FinancePeriodResultSection ↔ pages/Finance`, STR-204c) | **UNGUARDED — R0-N2, route R8** |
| settlementInvariant deep import (D-034) | 1 dynamic site (`integrityCheckSettlementBasis.ts:23`) | documented measured exception (barrel export would breach entry ceiling: 650,292 > 650,000) |

---

## 10. Source-of-truth and duplication analysis

- **One routing table:** `AGENTS.md` §2 is the single routing table; no competing reading list found (S5 audit: README/control/current-state all defer to it). **VERIFIED**
- **Ownership registry:** every live house/area name-covered (guard PASS); write-path rows live; PG-1 dated reconciliation present (2026-10-05) but new drift items (R0-N3/N4) require a fresh dated reconciliation → R1. **PARTIAL**
- **Duplications closed:** formatting kernel single home (`application/formatting/`); error builders/resultCodes densified (STR-608); STR-623 acceptance values anchored at both sites (guard PASS) with full unification deferred at the STR-608 budget gate (documented, guarded); capability stores extracted (7 groups) removing adapter-method duplication for those families. **VERIFIED**
- **Active duplication remaining (scheduled):** transfer-side current/historical acceptance duplication (R4); presentation formatters vs application formatting seam (R2 characterization); 8 compat shims = intentional duplicated *paths* (not truth) — 2 now dead (R0-N5, R7). **PARTIAL — R2/R4/R7**
- **Historical acceptance:** exactly one registry (`RELEASED_LEGACY_EXPORT_PAIRS`, 24 pairs + current, each with reason) + value-compatibility registry (`transferCompatibilityValues.ts`: 3 legacy agreement sources, 1 compatibility row, 22-family provenance map). No second active source found. **VERIFIED**

## 11. Storage / application / domain / UI composition and UI-boundary result

- **Composition:** React pages → application services (37 houses, 29 doors) → domain (19 areas) → `PrototypeLocalStore` port (130 methods) → IndexedDB adapter (+ Memory adapter for parity). No UI→IndexedDB direct access (2 ratcheted UI→storage type edges only). **VERIFIED**
- **Adapters:** `IndexedDbLocalStore` 4,133 nbLOC / `MemoryLocalStore` 2,087 nbLOC; full long-term exception cards (single responsibility: adapter implementation; family pre-split: stores/migrations/lifecycle/snapshot/primitives + 10 write guards + 7 capabilities; parity proven by 12 conformance files running identical scenarios). **VERIFIED**
- **Write safety:** 9 commit guards (order, recurring-expense, loan, received-loan, expense-budget, supplier-attribution, supplier-schedule, delivery-reversal, cash-continuity) — basis-match inside write transaction, `storage_stale` rejection without write, idempotency keys on commit types. **VERIFIED**
- **Transfer/restore:** envelope integrity (SHA-256) + counters (`transferCounters.ts`) + 25 accepted version pairs + backup-before-replace (EXE-014). **VERIFIED**
- **UI-boundary result:** zero visual/UI/DOM/CSS/token/navigation changes across all merged programs (audits + diff evidence); UI coupling bounded by ratchets (§9); UI track T remains NOT_TRIGGERED with documented triggers; preserved UI branch untouched (`f28b0fa`, 2026-09-21). **VERIFIED**

## 12. Test, documentation, guard, and CI map

- **Tests:** root suite **644 listed cases / 57 files** (35 `tests/` + 1 `src/` + 21 `scripts/`); app suite **2,222 listed cases / 300 files**; 357 tracked test files total, 0 `.only`/`.skip`. CI on `fc2ae6e` (run `37593346319`) executed the full `pnpm check` chain green — both suites passing on the exact audited head. Recorded root count 619 is stale (R0-N11). Test map: 60 pages — 49 direct + 11 adjacent-with-reason; contract→control links 49; drift check green. **VERIFIED (live counts) + one stale record**
- **Documentation:** doc-index coverage complete (exit 0); current-state size guard intact (18,627/20,480 bytes); this report adds its doc-index row in the same PR.
- **Guards (14, all PASS, exit 0):** secrets (1,482 files, 0 patterns) · test-focus (357 files) · entity-touchpoints (40 entities: 37 stores + 3 local records) · runtime-cycles (400 files, 0) · doc-index-coverage · current-state-size · skill-references (8 skills) · image-policy (git mode, 36 images) · module-boundaries (baselines §9) · type-cycles (1 accepted) · registry-coverage (37+19) · acceptance-value-anchors (4) · file-size-ratchet (462/407, 0 escalation) · vendored-braces (12,665 files, 4 copies = baseline).
- **CI wiring (VERIFIED, no duplication):** push (main + post-scan branch + tags) / pull_request / workflow_dispatch → checkout → pnpm 9.15.9 → Node 22 → `pnpm install --frozen-lockfile --ignore-scripts` → `bash scripts/ci-audit-step.sh` (register-aware, exit-code propagating, 5-test pin, bounded retry) → `pnpm check` (operations-control self-tests + validate → typecheck → lint (≤37 warnings) → format:check → text-density → design-guards → 14 guards → root tests → app typecheck → app tests → build + budget + surfaces) → whitespace gate (pull_request only) → PWA artifact upload (fail-if-missing). Least-privilege `contents: read`; concurrency cancel-in-progress.
- **Security:** `pnpm audit` clean; security-exception register = 1 entry, `REMEDIATED_BY_ELIMINATION` (braces GHSA-vfj7-8cjw-p6xm / CVE-2026-93687), eliminated by replacement 2026-10-06 (PR #317, micromatch → `tools/micromatch-shim` over picomatch@2.3.2), review date 2027-01-06, fail-closed re-entry; vendored copy monitoring guard green (4 copies: prettier@3.9.6, rollup@4.62.4 ×2, vite@7.3.6) with upstream-limitation record and revisit triggers.
- **Provenance:** ops-control 85 items / 58 workstreams / 1 claim; XLSX meta digest current (145 source files); 8/8 generator self-tests.

## 13. Schema / export / import / history / financial / semantic impact statement

**R0 performed zero writes during analysis; this PR is documentation-only.** Verified unchanged on the live head: `localSchemaVersion=38`, `localExportVersion=30` (`types.ts:55,71`, pinned by ≥5 governance tests); 24 legacy pairs + current accepted pair unchanged; 27 goldens + MANIFEST unchanged; migrations untouched (highest normalization gate `oldVersion<26`); no financial formula, rounding, classification, rejection behavior, persisted money text, or historical interpretation altered; IndexedDB/Memory parity, transaction semantics, idempotency, CAS, `storage_stale`, backup-before-replace all verified intact. **Impact of this PR on all six dimensions: NONE (documentation and control records only).**

## 14. Minimum safe remediation waves R1–R10 (dependencies, risks, acceptance, rollback)

The owner-approved plan's wave map is confirmed against the live tree. R0 adds the new findings into their owning waves (column "adds"):

| Wave | Scope (plan) | Adds (from R0) | Key risks | Acceptance core | Rollback boundary |
|---|---|---|---|---|---|
| **R1** truth/governance/docs/guard hygiene | F-01..05 residuals, CON-1..4, PA/PC/PG/RS, stale records | R0-N3, N4, N5(record), N6, N7, N9, N10, N11, N12, N13, N14, N16; PA-2 channel registration; PG-1 dated reconciliation | doc-only; risk = hand-edited generated views (forbidden — JSON first) | no live contradiction in authoritative docs; validate.py + doc-index + views green | single doc revert |
| **R2** money/formatting/input/date/messages | F-07/13c residuals, V11, PC-1 | — | protected: any financial output diff = SEMANTIC_CHANGE_MANIFEST stop | characterization first; byte-equal persisted notes | slice revert, goldens stay |
| **R3** storage capability extraction (full registry, 22 groups) | STR-301 | port-count records now 130 (not 131) | parity break | IndexedDB/Memory parity, no unguarded write, zero-consumer proof before delete | per-capability revert; facade stays until zero consumers |
| **R4** transfer/schema/export/history | F-13 transfer residuals, AV continuity, EXE-014 | R0-N18 (resetAll review) | version-pair changes = owner decision | single active acceptance source; goldens ↔ MANIFEST; round-trip | old import stays working until new proven |
| **R5** application boundaries/reader-writer/doors/deep imports | F-06/08 residuals, STR-302 | R0-N20 (type-surface pinning) | door widening; read/write re-mixing | every door has real consumers; no new deep import | consumer path revert |
| **R6** every large/mixed file | F-15 cards, SPLIT files | R0-N8 (craft-order card completion) | semantic mixing in splits | split-or-complete-card per file; no silent band growth | per-file-family revert |
| **R7** UI structural boundaries + shims | F-09 residuals, STR-204c/305, FIN-002 | **R0-N5 (2 dead shims removal slice)**; mixed-cycle file pair extraction | visual change (forbidden) | UI owns no financial truth; shims removed only at zero consumers | consumer revert to shim |
| **R8** bundle/file growth/guards/CI | F-10, F-11 residual, F-14 | **R0-N1 (isEntry semantics fix + baseline re-anchor)**, R0-N2 (mixed-cycle guard), R0-N15a–d, R0-N17 | baseline edits hiding growth (forbidden same-PR) | no unclassified bundle blind spot; within-band growth guarded; every guard chartered + negative test | guard/policy revert; no auto ceiling raise |
| **R9** test/contract/doc/rollback evidence | Q-a..Q-j answers | R0-N19 (direct settlementInvariant test) | false VERIFIED claims | every finding has test/guard/contract/trigger evidence with command+SHA | — (evidence wave) |
| **R10** hostile final audit + closure | whole matrix | re-verify R0-N1..N20 dispositions | self-certification (forbidden) | independent re-check; merge SHA verified on main | — |

## 15. Exact discrepancies found in live pointers — and their classification

| # | Discrepancy | Classification | Disposition |
|---|---|---|---|
| 1 | `WS-216.json` `base_sha=773e775` vs live `fc2ae6e`; same in current-state header, REFACTORING-CONTROL §14, ARCH-007/WS-216 next_action ("execute R0 from 773e775") | **EXPECTED one-merge self-referential pointer lag** — each pointer PR pins the previous head; `773e775..fc2ae6e` = 9 docs-only files (VERIFIED); the records' own fetch-first rule governs currency; `validate.py` flags it as a warning, not error | reconciled in this PR (pointers re-pinned to the R0-verified baseline `fc2ae6e`); R0 was executed from `fc2ae6e`, a direct descendant — the pinned instruction is satisfied |
| 2 | Recorded root test count 619 vs live 644 | **STALE_RECORD** (post-merge record repeated pre-reconciliation count; +25 = security tests of PRs #317/#318) | R1 record correction (R0-N11); CI green on head proves suite health |
| 3 | Registry "131/131" vs live 130 port methods | **STALE_RECORD** | R1 (R0-N3) |
| 4 | FILE-register §4: "no BroadcastChannel", "155,000", "no app barrels / 18 domain barrels" | **STALE/FALSE RECORDS under PRESERVE rows** | R1 (R0-N4) |
| 5 | ADR-018:17 + worklog Entry 47: "lazy −9,450 raw improvement" | **MEASUREMENT ARTIFACT under a VERIFIED label** (true margin −84 raw) | dated correction appended to ADR-018 in this PR; guard fix + baseline re-anchor → R8 (R0-N1) |
| 6 | SHA citations `8ba44555…`, `a59eeb1…` unresolvable in plain clone | **LOW doc-hygiene** — both preserved remotely (API 200; `a59eeb1` via `refs/pull/299/head`) | R1 annotation (R0-N7) |
| 7 | README v1.4 citation; §130 audit-test count; guard-count 13-vs-14; Entry-47 gzip env label; register owner-field wording | **STALE_RECORD (LOW)** | R1 (R0-N9/N14/N13/N10/N16) |
| 8 | `gh` CLI unavailable in R0 sandbox | **ENVIRONMENT_LIMITATION** — API used instead; validate.py cross-check skipped locally only | recorded; not a repo defect |

**None of the above is `STATE_DRIFT`:** all were reconciled with live evidence, without guessing, resetting, or overwriting anyone's work (protected-stop rule §10 respected).

## 16. Changes made and explicitly not made

**Made in this PR (documentation-only, after read-only analysis completed):**
1. This report: `docs/architecture/refactoring/R0-LIVE-BASELINE-AND-FINDING-RECONCILIATION-2026-10-07.md` (new).
2. Dated correction note appended to `docs/architecture/ADRs/ADR-018-public-doors-terminal-architecture.md` (R0-N1 true lazy numbers; original text preserved).
3. Live-pointer reconciliation required by the report: `WS-216.json` (base_sha → `fc2ae6e…`, next_action, pr), `ARCH-007.json` (next_action, evidence += report path, updated_at), `docs/operations/current-state.md` (header + §9 live fields only), `docs/architecture/refactoring/REFACTORING-CONTROL.md` §14 (live step line), `docs/operations/current-state-log.md` (append §137), `docs/architecture/refactoring/AGENT-SEQUENTIAL-WORKLOG.md` (append Entry 48), `docs/00-document-index.md` (row for this report), regenerated `generated/` views from the edited JSON.

**Explicitly NOT made (R0 boundary):** no production code, no test, no dependency/lockfile/config change; no file moves/renames/deletes; no shim removal (including the 2 dead ones — R7 slice with zero-consumer proof); no guard script changes (including the R0-N1 filter fix — R8); no baseline/ceiling/exception weakening; no schema/export/import/migration change; no financial/semantic/historical change; no UI/CSS/DOM/token change; no branch/PR deletion or merge; no touch of `docs/ux-ui-zed-handoff-20260921`; no reopening of WS-212/214/215 or ARCH-006; no writes to `main`.

## 17. Owner decisions required

**None blocking R0 closure.** This PR's own review/merge is the standing owner gate. For later waves, R0 surfaces (informational, no new decision demanded by R0): (a) dead-shim removal timing in R7 (zero-consumer proof already collectible); (b) R8 scope confirmation for the four R0-N15 operability choices (audit level, Actions SHA-pinning, test-map check wiring, whitespace gate scope); (c) the standing plan protected-decision points (schema/export changes, money contract V2, UI track opening) remain owner-gated exactly as the plan records them.

## 18. Limitations and unresolved blockers

- Full root/app suites and typecheck/lint/format were **not re-executed locally** — green CI run `37593346319` on the identical head `fc2ae6e` covers them; intentional non-duplication (plan R9 rule), classified VERIFIED-via-CI / NOT_EXECUTED-locally.
- `gh` CLI unavailable (API substituted); GitHub merge-state cross-check ran via authenticated REST instead.
- Local Node v24 vs CI Node 22: gzip figures differ by the documented ADR-012 drift; all R0 gzip numbers quote the local level-9 guard output and label the environment; CI-anchored baselines are the authoritative ones (ADR-012).
- The two source reports (`STRUCTURE-ARCHITECTURE-CODE-ORGANIZATION-SCAN-2026-10-04.md`, `FLASH-PASS-A-PRINCIPLES-REVIEW-2026-10-04.md`) are owner-reviewed project inputs supplied outside the repository tree; their finding IDs were reconciled via the plan's traceability appendix A.1–A.10 (which the owner accepted as the explicit mapping).
- No unresolved blockers. R0-N1..R0-N20 are routed, not blocking.

---

## Final status

```text
R0_COMPLETE — CURRENT_BASELINE_VERIFIED
NO_REPOSITORY_WRITES_PERFORMED_DURING_ANALYSIS
REPORT_PR_OPENED — OWNER_REVIEW_REQUIRED
```

- Baseline verified: `origin/main` = `fc2ae6e7dbb6f03eef3b0e103ee6176eeddeb052` (2026-10-07); 0 open PRs; 1 active claim (WS-216/ARCH-007); schema 38 / export 30; bundle within ceilings (entry margins 19,490 raw / 206 gzip); 14 guards PASS; audit clean; CI green on head.
- All 17 Structure findings, 16 protected-surface identifiers, 19 principles/mechanisms, 6 conflicts, 7 lenses, 12 vectors, and 10 questions classified (§6) with live evidence; 20 new findings recorded and routed (§6.5).
- No R1–R10 wave started. No merge performed. Next step: owner review of this PR; upon merge, R1 proceeds from the accepted wave cards per the plan's dependency map.
