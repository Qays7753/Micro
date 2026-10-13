# R11 Wave 0 — Structure / Architecture / Code Organization / Contract Scan Report

**المسح الكنوني للهيكل والمعمارية وتنظيم الكود والعقود — الموجة صفر من R11 (قراءة فقط، بلا أي معالجة)**

- **Report ID:** R11-W0-STRUCTURE-ARCHITECTURE-CONTRACT-SCAN-REPORT-2026-10-13
- **Date:** 2026-10-13 (UTC)
- **Scanned baseline (verified live):** `origin/main` = `31afaf39ad57a82e72aa61e59879e46f8801ce36`
- **Scan type:** READ-ONLY. No application code, domain, storage, Transfer, guards, tests, configuration, generated views, current-state, or runtime behavior was modified by this scan.
- **Repository writes performed by this task:** exactly two files — this report, and one catalog row in `docs/00-document-index.md` (report-only branch + report-only PR; no merge).
- **Task authority:** `docs/architecture/refactoring/r11-wave0-20261013/R11-W0-READONLY-STRUCTURE-SCAN-REPORT-UPLOAD-PROMPT-2026-10-13.md` (published on branch `docs/r11-wave0-prompt-20261013`, PR #358).

---

## 1. Executive summary

This Wave 0 scan re-verified the entire post-R10-B structural state of Micro at the live `main` head (`31afaf39`), covering the 16 remaining R10-B `DEFER` findings, the five `PRESERVE_BY_DESIGN` control surfaces, the structure/architecture/code-organization gate required by `AGENTS.md` §11, and the mandatory census set. Three headline results:

1. **Every machine-checkable guard is green at the scanned head, and every R10-B seam figure that carried a documented method reproduced exactly.** The live `pnpm guards` chain passes 18/18 on the canonical tree (the vendored-braces guard failed only in this scan's non-canonical scratch install — an environment artifact, §19.3), CI and Cloudflare Pages are both green on `31afaf39` (API-verified), the R6 baseline is set-equal (52/52 keys, zero drift through R10-B), the R2 value baseline matches (17/17), R5 matches (2/2), and the R10-B recorded counts for F-006 (17), F-019 (62 at base), F-026 (35 warnings), and the R6 seam (57 sites / 52 keys) all reproduced exactly under independent re-census.

2. **The two "ungoverned seam" findings grew silently during R10-B — exactly as their DEFER cards predicted.** The application-internal cross-house deep-import seam (R10B-NF-005) grew from 126 reproducible unique edges at the R10-B base (`ffc54eb1`) to 128 at the live head (+2 edges, both traceable to documented R10-B3 work: `materialUnitLabels` and the `paymentSourcePolicy` door repair). The read-like-file corpus outside the readwrite-guard families (R10A-F-019) grew from 62 to 63 (+1 file: `inventory/materialUnitLabels.ts`, same R10-B3 slice). No CI gate saw either growth. This is direct empirical evidence that these two DEFER items are real, live control gaps, not theoretical ones — and it raises the priority of the OD-10 / OD-GUARD decisions.

3. **The prior §11 scan is fully superseded — a full R11 refresh is required and is what this report provides.** The `AGENTS.md` §11 scan (2026-09-11, commit `9a8c949`, report in the external documentation repository at `17b264c`) is 685 commits behind `main`; its accepted four-group remediation plan was executed and closed (post-scan W0–W10 program, verified at `988e6f0d`), and three successor structural programs (A-to-Z, R0–R9, R10-A/R10-B) have since restructured the codebase (doors, 18-guard chain, money/date kernels, R6/R7 ratchets, D1 build identity). Classification: **`PRIOR_SCAN_NOT_SUFFICIENT — FULL R11 REFRESH`** (§4.2 of the gate reconciliation; no conflict — the prior plan is honored as executed history, not discarded).

One new provisional finding was registered: **R11-W0-NF-001** (record-quality gap — two R10-B matrix quantitative claims, F-013's "59 files/326 references" and NF-005's "108 edges", are not reproducible from the documented evidence because their census methods were not recorded; all other figures reproduced exactly). No other genuinely new defect was found: the codebase is structurally coherent, all protected invariants hold (Schema 38 / Export 30, rejection precedence, PWA/build identity, bundle ceilings untouched), and the 16 DEFER items remain precisely-scoped owner decisions or scheduled guard work, none overdue, none a current correctness defect.

The recommended path (§15): split the candidate Wave 1 into **W1a (pure guard additions)** and **W1b (contract documentation + one-time scans)**, then W2 (Transfer closure), W3 (boundaries/labels), W4 (a11y track), W5 (conditional MoneyMinor branding). Ten owner decision cards are prepared in §16. **Nothing in this report was executed. All recommendations are `NOT_EXECUTED`.**

---

## 2. Live baseline and state-drift verification

| Check | Expected (checkpoint hint) | Live (verified) | Verdict |
|---|---|---|---|
| `origin/main` SHA | `31afaf39ad57a82e72aa61e59879e46f8801ce36` | `31afaf39ad57a82e72aa61e59879e46f8801ce36` | ✅ exact, **no state drift** |
| R10-B merge state | Merged at `b5f1bcc35` (source head `930345cd`), post-merge reconciliation at `31afaf39` | Verified in history: `31afaf39` = "Merge R10-B post-merge reconciliation"; `c9e0356e` (records) and `b5f1bcc3` (merge) both present as ancestors | ✅ VERIFIED |
| Open PRs | Only expected: the R11-W0 prompt PR | Exactly one open PR: **#358** (`docs(r11): publish Wave 0 read-only scan prompt`, head `6f97fa96a`, base `main`) — untouched by this task | ✅ VERIFIED |
| Remote branches | `main` + the prompt branch | `origin/main`, `origin/docs/r11-wave0-prompt-20261013` only | ✅ VERIFIED |
| CI on scanned head | Green (from R10-B closure) | API check-runs on `31afaf39`: `checks` = success, `Cloudflare Pages` = success (2/2) | ✅ VERIFIED |
| Worktree | Clean (fresh clone at `31afaf39`) | `git status --porcelain` empty at scan start and at publication time | ✅ VERIFIED |
| Schema/Export | 38 / 30 | `types.ts:55` `localSchemaVersion = 38`; `types.ts:71` `localExportVersion = 30` | ✅ VERIFIED |

Program-fact verification (per prompt §1): R0–R9 complete and reconciled (`current-state.md` §9 rows, each with merge SHA and CI run); R10-A + R10-B/W0 complete; R10-B1..B6 merged and post-merge reconciled; the R10-B matrix has exactly 75 records — 58 `FIX_NOW` all `CLOSED_WITH_EVIDENCE`, 16 precise `DEFER`, 1 disproved (R10A-F-023 FALSE_POSITIVE retraction); 0 `PRESERVE` rows in the matrix (the five Preserve cards are the separate OD-2 package); **no open `FIX_NOW` item exists** — live evidence agrees with the supplied facts. No STATE_DRIFT condition was met anywhere in this scan.

---

## 3. Scope, method, reviewer roles, and no-implementation boundary

**Scope.** R11 Wave 0 only: a comprehensive, evidence-based, read-only Structure/Architecture/Code Organization/Contract scan covering (a) the 16 R10-B DEFER findings as hypotheses to re-verify, (b) the five PRESERVE_BY_DESIGN surfaces as protected controls, (c) the full mandatory census set (prompt §7), (d) prior-scan reconciliation (prompt §4 / AGENTS.md §11), (e) the target wave map and owner decision cards. **No remediation was performed.**

**Method.** Fresh clone at the verified head; every claim re-derived from live evidence using: (1) independent Python censuses mirroring the exact guard semantics (import resolution incl. `@/`→`apps/prototype-web/client/src/*` and `@micro-domain/*` aliases, dynamic `import()`, `export … from` re-exports in all forms, `applicationInteriorOf` house/door/root-file classification, production-files-only scanning); (2) independent `rg` validation counts; (3) **execution of the actual guard scripts** on the scanned tree (the strongest available validation); (4) `git archive` snapshots for base-vs-live delta computation; (5) GitHub API verification of PR/CI state.

**Five sequential read-only specialist reviewers** were run (prompt §6), each reading the investigation checkpoint and reporting independently before synthesis:

| Reviewer | Mandate | Independent verification performed | Verdict |
|---|---|---|---|
| **RV1** — Architecture, modules, boundaries | layer map, oversized files, dependency direction, deep imports, cycles, shared-infrastructure houses, target map | 428-file layer census; R1–R7 seam reproduction vs guard output; R6 baseline set-equality proof (48 static + 1 dynamic + 3 re-export = 52 = baseline); NF-005 census at base and live with per-edge delta; door/root-file inventory (29 doors + 1 root file, matching the door-surfaces guard); cycle baselines (0 runtime SCC, 1 type SCC) re-confirmed via guard run | **PASS** — one amendment: F-006 boundary note (RV1's original census scoped pages/components only; the app-shell pair adds 2 type edges under the full `UI_LAYERS` scope — recorded in §11.1) |
| **RV2** — Domain, finance, storage, Transfer | MoneyMinor, policies, parity, 130-method surface, Schema 38/Export 30, Transfer compatibility, unknown keys, counts, rejection, craft-order debt, ADR-017 | MoneyMinor declaration + discipline re-verification (sole persisted formatter, frozen writer surface); 130-method interface count; 22-counted vs 31-registry = 9 uncounted (exact); migration spread re-read; confirmImport contract re-read; transferFamilyValidators size/coverage; storage→domain 75 barrel / 0 deep | **PASS** — one amendment: F-013's recorded census figure (59/326) not reproducible by any documented method (→ R11-W0-NF-001) |
| **RV3** — UI, runtime, a11y, performance | read/write patterns, ambient time, overlays, focus/Escape/inertness, RTL, browser evidence, bundle risks | F-019 census reproduced exactly at base (62) with live delta (+1); ambient-time full classification (21 ID-fallback sites, 0 other ambient `new Date()`, 1 parsing, kernel/comment exclusions); NF-017/018 sites verified at exact recorded lines vs the AppLockGate gold standard; 60 pages confirmed; a11y residual classes (RV3-NF-5/6/7) re-confirmed | **PASS** |
| **RV4** — Tests, CI, security, operability | test/CI mapping, guard quality, lint census, secret scanning, fail-closed, evidence requirements | All 18 root guards + the app-level typecheck-coverage guard executed live (17+1 PASS; vendored-braces FAIL isolated as scratch-install artifact with root-cause proof: npm-resolved newer toolchain versions vs the frozen pnpm lockfile — the guard's drift detection worked as designed); lint re-run: exactly 35 warnings (18 max-lines-per-function + 17 complexity) under the tested ceiling 37; secrets guard working-tree scope (1687 files, 0 hits); CI workflow single-job, `ci.yml` | **PASS** — one amendment: the unplanned vendored-braces observation is recorded as a positive-control validation, not a defect (§19.3) |
| **RV5** — Documentation, contracts, product consistency, owner decisions | canonical sources, stale docs, mapping completeness, decision-card completeness, phase map, acceptance/rollback clarity | document-index coverage guard PASS; current-state size 18,834/20,480; R10-B matrix integrity (75 records, dispositions verified — not rewritten by this scan); OD-12/NF-015 status re-verified (owner accepted 2026-10-13; route-focus/title system live at `MicroAppShell.tsx:96/:112` — closed, not an open decision); prior-scan reconciliation (§4.2); 10 decision-card completeness check | **PASS** |

**Synthesizer.** All five reviewer verdicts reconciled with zero material disagreement. Three carried amendments, all incorporated: F-006 boundary note (RV1), F-013 record-quality gap (RV2, → R11-W0-NF-001), vendored-braces positive-control note (RV4). Every conclusion below is labeled with its evidence class (§4 conventions). Conflicts were not averaged away; the two unreproducible figures are reported as such, not silently corrected.

**No-implementation boundary.** The only repository writes performed by this task are this report file and its one catalog row (§20 lists the exact actions performed and not performed).

---

## 4. Evidence conventions and prior-scan reconciliation

### 4.1 Evidence conventions

- `VERIFIED` — directly reproduced from live code, guard execution, git history, or GitHub API during this scan.
- `INFERRED` — a conclusion drawn from verified evidence but not itself directly measured.
- `UNVERIFIED` — a recorded claim that this scan could not reproduce (explicitly reported, never silently adopted).
- `NOT_EXECUTED` — a recommendation prepared but not implemented (all recommendations in this report).
- `DEFERRED` / `OWNER_DECISION_REQUIRED` / `BLOCKER` — as in the canonical vocabulary.

### 4.2 Prior-scan reconciliation (the AGENTS.md §11 gate)

`AGENTS.md` §11 records: a comprehensive read-only structure/architecture/code-organization scan at commit `9a8c949` (2026-09-11), report at `audits/micro/structure-architecture-code-organization-scan-v1.md` (documentation commit `17b264c`), and owner acceptance of a four-group remediation plan (Groups 8–11). This scan re-verified the reconciliation facts:

- `9a8c949` **IS** an ancestor of `main` (685 commits behind `31afaf39`) — `VERIFIED`.
- The scan report itself lives in the **external documentation repository** (`17b264c` is not an object in this repository; no `audits/` directory exists here) — `VERIFIED`. Its content was therefore not re-readable from this repo; its scope is known from the §11 summary and the executed plan's records.
- The accepted four-group plan **was executed and closed**: the post-scan W0–W10 program is recorded as verified and closed on `main` at `988e6f0d` (`ARCH-005/WS-215` = VERIFIED), after which the A-to-Z structural program (closed at `5eacbe38`) and the R0–R10 structural-remediation successor (`WS-216/ARCH-007`, R10-B closed at `b5f1bcc35`) ran — each introducing major structure the 2026-09-11 scan never saw: the public-doors terminal architecture (ADR-018), the 18-guard chain with ratchets, the money/date kernel unification, the R6/R7 import ratchets, the R10-B D1 build-identity carrier, and the R10-B matrix itself.

**Classification: `PRIOR_SCAN_NOT_SUFFICIENT — FULL R11 REFRESH`.** Reasons, per the prompt's reconciliation rules: (1) the prior scan's evidence date (2026-09-11) predates 685 commits of structural change, so its target map, findings, and boundaries cannot describe the current tree; (2) its accepted plan is honored as executed history — nothing in this report reopens or discards it; (3) the R10-B W0 matrix is the current canonical findings record for its scope (R10-A findings + systemic search), but it is a findings-reconciliation artifact, not the §11-gate structure/architecture/code-organization census with target module map and minimum-safe-wave planning that a new successor program requires; (4) `current-state.md` explicitly requires "any later work needs a scope scan / owner decision and an independent owner gate" after R10-B. **No conflict exists** between `AGENTS.md`, the prior scan, current-state, and R10-B evidence — the gate's own acceptance history is consistent; a `REVIEW_REQUIRED` condition was never triggered. This report is the full refresh the gate requires; the smallest evidence refresh needed for the 16 DEFER findings and 5 Preserve cards was performed inside it (§11, §12).

---

## 5. Structure / Architecture / Code Organization scan

### 5.1 The three "application-ish" locations — distinct responsibilities (explicit distinction, not merged)

A census defect in this scan's first pass initially returned false zeros (see §19.1 for the full methodology-defect record); the corrected census established the definitive layer map. Three distinct locations are frequently conflated under "application" and are **not** one bucket:

| Location | Guard layer name (`check-module-boundaries.mjs` `layerOf`) | Responsibility | Live size (production files) |
|---|---|---|---|
| `apps/prototype-web/client/src/app/` | **`app-shell`** | React **context composition layer**: the composition root (`PrototypeServicesContext.tsx` — constructs and provides all application services), startup gating (`StartupGate.tsx`), routing helpers (`routeClassifier.ts`, `MicroRouter`), capability gating (`useDisabledCapabilities`), navigation contract, quick-recording orchestration. Owns **no business logic**; it wires services to React. | 11 |
| `apps/prototype-web/client/src/application/` | **`application`** | **Service houses**: 33 top-level houses (each with a public door `index.ts` — 29 doors exist, 4 houses door-less by design and governed as such) + exactly 1 root production file (`resultCodes.ts`, the shared result-code vocabulary). Houses own read models, editor models, service orchestration, and the Transfer pipeline. | 149 |
| `src/domain/` (repository root) | **`domain`** | The **Micro domain core**: 19 areas (craft-order, financial-event, cash-continuity, inventory-material, owner-entitlement, …) with pure policies/types/kernels. Zero imports of storage or UI (`VERIFIED`: 0 edges domain→storage, 0 domain→UI). | 62 |

The remaining client layers: `ui` 132 (pages 60, components, client-root files), `presentation` 10 (formatters re-export layer — the ADR-011 §2 pattern: `presentation/*` re-exports from application houses), `storage` 54, `contexts` 1 (`ThemeContext`), `lib` 3, `pwa` 6. Root `src/` outside `domain/` contains no code. **Total production files scanned: 428** (the guard's import-bearing count: 394).

### 5.2 Architecture invariants (all `VERIFIED` by guard execution + independent census)

| Invariant | Live evidence |
|---|---|
| Dependency direction: UI → application → domain; storage → domain (adapters); domain depends on nothing above it | storage→domain = 75 edges, **all barrel** (0 deep); domain→storage = 0; domain→UI = 0 |
| UI never touches storage values | R5 value edges = 2 (the two documented app-shell exceptions: `PrototypeServicesContext → createBrowserLocalStore`, `StartupGate → persistentStorage`), set-equal with baseline |
| UI → application only through doors | R6: 57 deep-import sites / **52 unique keys = exactly the 52-key committed baseline** (`scripts/ui-application-import-baseline.json`), 0 unsanctioned, 0 stale, and **0 drift through the whole R10-B program** (base 52 = live 52, no adds, no removes — `VERIFIED` by per-key diff) |
| Components never import pages | R7 = 0 edges |
| Domain interior purity | R1 deep-domain imports = 3 (all the documented dynamic baselines); R4 domain cross-area deep = 3 (the documented pairs) |
| Runtime cycles | 0 SCCs (guard run + RV1's independent Tarjan at W0) |
| Type cycles | exactly 1 SCC (the baseline pair `supplierScheduleCommitGuard.ts ↔ types.ts`) |
| Application → presentation values | 0 (R3 baseline empty, holds) |

### 5.3 Shared-infrastructure houses (the OD-10 question)

The application-internal cross-house deep-import census (NF-005 seam, guard-mirroring semantics — house-interior targets only, doors and the root file excluded, production files only, all import kinds incl. dynamic and re-exports):

- **Live (31afaf39): 130 sites / 128 unique edges** — 80 value + 48 type.
- **At R10-B base (ffc54eb1): 128 sites / 126 unique edges** — the recorded R10-B figure was 108 (methodology variance, §19.2).
- **Growth: +2 edges, both from documented R10-B3 work** (`VERIFIED` by per-edge diff): `fulfillment/deliveryReviewService.ts → inventory/materialUnitLabels` and `suppliers/supplierPurchaseEditorModel.ts → finance/paymentSourcePolicy`.
- By target house (live): `time` 49 (the clock seam dominates, as recorded), `formatting` 14, `finance` 9, `inventory` 8, `fulfillment` 7, `financial-records` 6, then 22 houses with ≤4 each.
- `rg` cross-validation: `@/application/time/clock` = 50 total sites − 1 same-house (`time/actualTimeService.ts`) = 49 cross-house — exact match with the census.

The R6 ratchet governs only UI→application interiors; **application→application cross-house interiors have no rule** — the +2 silent growth during R10-B is the empirical proof of the gap (this is the OD-10 decision, §16.3).

### 5.4 UI → domain and UI → storage seams

- UI→domain **value** edges: 17 = the 17-entry committed baseline exactly (15 at base; R10-B4/F-021 added 2 with dated comments — protocol followed).
- UI→domain **type-only**: 50 edges — legal by the R2 scope (value-frozen only), consistent with the sanctioned type-import pattern.
- UI→storage **type-only** (F-006 seam): **19 edges, all resolving to `storage/local/types.ts`** — the 17 pages/components files (12 pages + 5 components, **identical file set to RV1's R10-B census**, `rg`-validated) + 2 app-shell files (`PrototypeServicesContext.tsx`, `StartupGate.tsx`) that sit outside RV1's recorded census scope but inside the guard's `UI_LAYERS` scope. ESLint deliberately sanctions type imports from `@/storage/local/*`; no ratchet pins the count.

### 5.5 Feature discoverability and source-of-truth duplication

The R10-B1 closure eliminated the known duplication findings (WasteContext union F-003, ThemePreference NF-3-type gaps, CapabilityId link F-004, live-phase 5-way duplication F-033 — all closed with evidence in the matrix). The acceptance-value-anchors guard (run green) pins the four guarded consumption sites against literal regressions on both sides. The document-index coverage guard (run green) pins catalog completeness. No new source-of-truth duplication was found by this scan's censuses (the `PeriodRange` name collision, NF-004, is a naming hazard, not a duplication — §11.6).

---

## 6. Module and feature boundary map

**Domain areas (19):** actual-time, asset, budget, cash-continuity, catalog, craft-order, direct-sale, financial-analysis, financial-event, inventory-material, loan, owner-entitlement, owner-safe-withdrawal, received-loan, recurring-expense, recurring-margin, shared (kernels: numeric/currency/businessTime), supplier-purchase.

**Application houses (33 + 1 root file):** activity, agreements, assets, budgets, cash, catalog, collections, cost, diagnostics, direct-sales, drafts, estimates, finance, financial-analysis, financial-pulse, financial-records, follow-up, formatting (infrastructure), fulfillment, home, identity (infrastructure), input, inventory, loans, owner, owner-money, parties, preferences, profile, recurring, scheduling, security, suppliers, time (infrastructure), transfers — plus root `resultCodes.ts` (shared result vocabulary). Infrastructure houses (formatting, identity, time, resultCodes) are the shared-service spine; feature houses each own a door.

**Storage (54 files):** `IndexedDbLocalStore.ts` (4,399 lines), `MemoryLocalStore.ts` (2,123), `types.ts` (884, the contracts), `indexedDbSnapshot.ts`, `indexedDbStores.ts`, `indexedDbLifecycle.ts`, 8 commit guards + cash-continuity guard, `influentialSnapshotFamilies.ts`, `supplierScheduleCommitGuard.ts` — the Preserve surfaces §12.

**UI:** 60 pages, components organized by feature family (orders, finance, security, settings, forms, primitives…), `presentation/` = the re-export + display-vocabulary layer, `app/` = composition root, `pwa/` = runtime surface.

**The five readwrite-guard families** (finance, owner-money, financial-records, budgets, transfers) hold the registered reader crew (18 files) + 10 auto-enrolled PC-4-tagged files; the other 28 houses are outside that guard's scope (F-019, §11.4).

---

## 7. File responsibility and oversized-file register

Live file-size-ratchet run (canonical mode on the scanned tree): 497 files covered, baseline 487, 41 documented re-anchors reconciled, zero unjustified growth. The oversized register:

| File | Live lines | Band | Card |
|---|---|---|---|
| `storage/local/IndexedDbLocalStore.ts` | 4,399 | **SPLIT_NOW** | Preserve P-01 (§12.1) |
| `storage/local/MemoryLocalStore.ts` | 2,123 | **SPLIT_NOW** | Preserve P-02 (§12.2) |
| `src/domain/craft-order/policies.ts` | 1,415 | **SPLIT_NOW** | Preserve P-03 (§12.3) |
| `application/transfers/transferSnapshotValidation.ts` | 1,197 | SPLIT_CANDIDATE | Transfer surface (P-05 adjacency) |
| `pages/SupplierPurchaseEditor.tsx` | 1,178 | SPLIT_CANDIDATE | UI page (a11y/visual boundary) |
| `storage/local/types.ts` | 884 | SPLIT_CANDIDATE | Preserve P-04 (§12.4) |
| `scripts/text_density_policy.py` | 859 | SPLIT_CANDIDATE | Guard tooling |
| `pages/AgreementEditor.tsx` | 686 | WATCH | UI page |
| `components/orders/OrderDepositPanels.tsx` | 527 | WATCH | UI component |
| `application/assets/assetService.ts` | 505 | WATCH | Application service |
| `scripts/check-module-boundaries.mjs` | 439 | WATCH | Guard (CONFIG scope) |

The three SPLIT_NOW files are exactly three of the five Preserve surfaces — the bands are known, growth is machine-ratcheted inside them, and decomposition remains owner-gated with no proven trigger (§12). No file entered or left the register since the R10-B records except documented within-band re-anchors.

---

## 8. Dependency, layer, deep-import, cycle, and source-of-truth analysis

Consolidated seam table (all `VERIFIED` by guard execution + independent census + `rg` validation; base = R10-B base `ffc54eb1` where computed):

| Seam | Base | Live | Baseline / record | Verdict |
|---|---|---|---|---|
| R1 deep-domain imports (dynamic, documented) | 3 | 3 | 3 | ✅ exact |
| R2 UI→domain value | 15 | 17 | 17 (live baseline; +2 by R10-B4/F-021 with protocol) | ✅ exact |
| R3 application→presentation value | 0 | 0 | 0 | ✅ exact |
| R4 domain cross-area deep | 3 | 3 | 3 | ✅ exact |
| R5 UI→storage value | 2 | 2 | 2 | ✅ exact |
| R6 UI→application interiors (sites / unique keys) | 57 / 52 | 57 / 52 | 52-key JSON, set-equal | ✅ exact, **zero drift through R10-B** |
| R7 components→pages | 0 | 0 | 0 (empty-by-design) | ✅ exact |
| F-006 UI→storage **type-only** | 17 (+2 app-shell outside recorded scope) | 19 | 17 (pages/components) | ✅ boundary note |
| NF-005 application-internal cross-house interiors | 126 reproducible (recorded 108) | **128** | none — ungoverned | ⚠️ +2 silent growth |
| storage→domain (barrel) | 75 | 75 | unrestricted by design | ✅ exact |
| Runtime cycles / type SCCs | 0 / 1 | 0 / 1 | 0 / 1 baseline pair | ✅ exact |
| Application→storage edges | 119 | 120 | (service-layer access to the port; door-sanctioned pattern) | — |

Cycle analysis: the runtime-value graph has zero SCCs (guard run green; RV1's independent Tarjan agreed at W0). The single type-only SCC (`supplierScheduleCommitGuard.ts ↔ types.ts`) is the committed baseline pair, re-verified green by the type-cycles guard.

---

## 9. Storage / Application / Domain / UI composition and parity analysis

- **Parity contract:** `PrototypeLocalStore` = exactly **130 methods** (`VERIFIED` by interface enumeration); both adapters implement it; the R9/R10-B records (130/130 both adapters) stand; the storage-parity view (`docs/operations/views/storage-parity-view.md`) is the cold-start reference.
- **Schema/Export:** `localSchemaVersion = 38`, `localExportVersion = 30` (`types.ts:55/:71`) — untouched by this scan and by R10-B (`VERIFIED`).
- **Transfer corpus:** 24 released legacy pairs accepted; current pair = 38/30 with counts block; 27 goldens + MANIFEST pinned by `exportGoldens.test.ts`; the RC-1 raw family gate (`verifyTransferArrayFamilies`, 31-family registry) runs before migration in `prepareImport` (`VERIFIED` live read).
- **Counts mechanism:** `exportCountsOf` counts **22 families** (18 original + 4 owner families added by R10-B2/RC-1 under OD-8=minimal); the family registry has **31**; exactly **9 required families remain uncounted** — the identical nine from the R10-B record: `recurrences, catalogItems, measurementUnits, directConversions, catalogTemplates, actualTimeRecords, shortCashDeclarations, allocationPolicies, costEstimates` (NF-013, §11.11).
- **Unknown keys:** `migrateTransferSnapshot` spreads `...raw` — unknown top-level data keys survive migration into the preview and vanish on re-export (NF-011, §11.9); inert at persistence (only known stores written).
- **confirmImport:** single-validation contract, backup-first (`createVerifiedExport` before replace — EXE-014), no re-validation of the preview object (NF-012, §11.10).
- **Money discipline:** `MoneyMinor = number` unbranded alias (`currency.ts:2`); `persistedMoneyTextMinor` the sole persisted-text formatter (defined once, consumed only by the five frozen persisted-money writers: craft-order policies ×3, deliveryReviewService ×2, cashCountMessages ×5 — the `moneyLayerGuard` frozen surface, re-verified live); zero `parseFloat` on money in production; integer kernels (`roundHalfUp`, `floorRatio`, `ceilRatio`, `sumSafeIntegers`) pure.
- **Time discipline:** domain kernel pure and guarded (guard run green: no `Date.UTC`, kernel-only `new Date`/`Date.parse` in domain, no ambient `new Date()` in domain, guarded `slice(0,10)` sites); the application layer's ambient-time census classifies as **21 ID-fallback sites** (the `crypto.randomUUID ?? Date.now()-…` family — all guarded by the R10-B3 optional-chain insecure-context fix), **0 other ambient clock reads**, 1 parsing site (`formatters.ts:211`, `new Date(value)` — parsing, not clock), plus the sanctioned `systemClock` kernel definition; UI layer: 34 files / 56 sites (ID fallbacks, PWA banner, lock-idle timing — the R10-B classification holds; no persisted financial value affected).

---

## 10. Test and documentation mapping

- **Guard chain:** 18 root guards + the app-level `check-test-typecheck-coverage.mjs` (added by R10-B/NF-020 part 2; `VERIFIED` live: "353 test files inside the app typecheck program"). Full `pnpm guards` semantics replayed in this scan: **every guard PASS on the canonical tree** except `check-vendored-braces`, which failed **only** because this scan's scratch install used npm (resolving `prettier@3.9.10/rollup@4.64.6/vite@7.3.7`) instead of the frozen pnpm lockfile (`3.9.6/4.62.4/7.3.6` — `pnpm-lock.yaml` `VERIFIED`); on CI's canonical install the guard passed on the same head (check-runs 2/2 success). The failure is thus a scan-environment artifact and simultaneously an unplanned positive control proving the guard's drift detection works (§19.3).
- **Guard source/test mapping:** every guard ships a `.test.mjs` (the module-boundaries, readwrite, date-ownership, secrets, file-size-ratchet, door-surfaces, typecheck-coverage test files all exist and are wired into the root suite).
- **Test corpus:** 428 test files focus-checked (0 skip/focus occurrences — guard green); 353 app test files inside the typecheck program (NF-020 part 2 closed); craft-order logic covered indirectly by 77 test files (the P-03 evidence debt stands at file level: 0 direct unit files for `craft-order/policies.ts`).
- **Lint:** exactly **35 warnings / 0 errors** live (18 `max-lines-per-function` + 17 `complexity`), under the governance-tested ceiling **37** pinned in `package.json` and pinned by `group6Docs.test.ts` — 2 slots headroom (F-026, §11.5).
- **Documentation:** document-index coverage guard green (this report adds one row, §21); current-state size 18,834/20,480 bytes (guard green); the R10-B matrix remains the untouched canonical findings record; Operations Control validators were not run by this scan (they are not part of the documentation diff — see §20).

---

*(sections 11–22 continue in the committed report file)*

---

## 11. Full matrix — all 16 DEFER IDs (re-verified live; all recommendations NOT_EXECUTED)

Matrix columns: ID | supplied classification | live verdict | priority | evidence class | root cause | impact | recommendation | dependencies/decisions | tests/evidence | acceptance | rollback | protected behavior | confidence.

### 11.1 R10A-F-006 — 17 UI→storage type-only imports lack a type-edge ratchet

| Field | Value |
|---|---|
| Supplied | DEFER (S3, CONFIRMED) |
| **Live verdict** | **CONFIRMED — UNCHANGED on the recorded boundary; boundary note added** |
| Priority | Medium (control gap; no current violation) |
| Evidence class | VERIFIED (independent census + `rg` + guard source read) |
| Root cause | R6/R5 scoped themselves to value edges by decision (ADR-018 era); the type-only seam was left without a counterpart ratchet |
| Impact | Silent growth of UI↔persistence-schema coupling is invisible to CI; 12 pages + 5 components bind directly to persistence record shapes (`StoredCraftOrder`, `OrderDraft`, `LocalPreferences`, `ScheduleEntry`…) rather than door-owned view types |
| Current state | 17 pages/components type-only imports (identical file set to RV1's census) + 2 app-shell type imports (`PrototypeServicesContext.tsx`, `StartupGate.tsx`) = 19 under the full `UI_LAYERS` scope; all resolve to `@/storage/local/types`; ESLint deliberately sanctions the pattern |
| Recommendation | **FIX_NEXT (Wave W1a — OD-GUARD)**: type-edge baseline + ratchet rule with negative tests, pinned at the live 19-edge (or owner-scoped 17-edge) set with a dated authorization protocol |
| Dependencies | OD-GUARD (§16.1); none code-level |
| Tests/evidence | Guard unit tests incl. growth/shrink negatives; module-boundaries suite extension |
| Acceptance | Type-edge ratchet live in `pnpm guards`; baseline pinned with dated protocol |
| Rollback | Guard-change revert restores prior guard |
| Protected behavior | The sanctioned type-only pattern itself; Schema 38/Export 30; ESLint allowance (until owner decides otherwise) |
| Confidence | High |

### 11.2 R10A-F-013 — MoneyMinor unbranded across the codebase

| Field | Value |
|---|---|
| Supplied | DEFER (S3, CONFIRMED; "59 files/326 references") |
| **Live verdict** | **CONFIRMED qualitatively; the recorded census figure is NOT reproducible** (→ R11-W0-NF-001, §13) |
| Priority | Medium (defense-in-depth; no current defect) |
| Evidence class | VERIFIED (declaration + discipline); UNVERIFIED (the 59/326 figure) |
| Root cause | Historic alias predates branding practice; partial branding would create an inconsistent wall |
| Impact | Live literal-token census: **15 production files / 148 references** (16/150 incl. tests); broader `*Minor` family: 214 files / 4,868 refs. Integer kernels + sole formatter + frozen-surface guard are the live compensating controls (re-verified, §9) |
| Recommendation | **OWNER_DECISION_REQUIRED (OD-MONEY, §16.2)**: either document the deliberate unbranded-alias policy with its compensating controls (close D-02), or authorize a dedicated Wave W5 complete-family branding migration. **No partial branding** |
| Dependencies | OD-MONEY; if branding: full typecheck + root/prototype suites + money-layer guard |
| Tests/evidence | Full typecheck; moneyLayerGuard; root + prototype suites (if executed) |
| Acceptance | Decision recorded with dated rationale in an ADR/registry; no silent partial branding |
| Rollback | Decision-only (no code until chosen) |
| Protected behavior | `MoneyMinor` integer discipline; `persistedMoneyTextMinor` sole-formatter; frozen writer surface |
| Confidence | High (qualitative); the recorded figure Low (see NF-001) |

### 11.3 R10A-F-014 — date-arithmetic guard textual `??` exemption

| Field | Value |
|---|---|
| Supplied | DEFER (S3, CONFIRMED) |
| **Live verdict** | **CONFIRMED — UNCHANGED** |
| Priority | Medium-low (latent guard weakness; 0 current violations) |
| Evidence class | VERIFIED (guard source read + guard execution green + the 5 guarded sites re-read) |
| Root cause | Guard implemented as per-line regex for speed; `??` exemption is textual (same-line), not semantic |
| Impact | A same-line unrelated `??` would falsely exempt a raw date slice (latent false-exemption class) |
| Recommendation | **FIX_NEXT (Wave W1a — OD-GUARD)**: AST-based exemption binding with negative fixtures (unrelated `??` on the same line must be rejected) |
| Dependencies | OD-GUARD |
| Tests/evidence | Guard unit tests incl. new negatives |
| Acceptance | Negative fixtures rejected; all 5 live guarded sites still pass |
| Rollback | Guard change revert |
| Protected behavior | The 5 canonical-first guarded sites; the date-kernel ownership rules R1–R6 |
| Confidence | High |

### 11.4 R10A-F-019 — read-like application files outside readwrite-guard families

| Field | Value |
|---|---|
| Supplied | DEFER (S3, REFINED: 62) |
| **Live verdict** | **CONFIRMED — REFINED and GROWN: 62 → 63 (+1)** |
| Priority | Medium (control gap; the growth proves the gap is live) |
| Evidence class | VERIFIED (exact reproduction at base + live delta) |
| Root cause | R5/S3 defined guard families by house (finance, owner-money, financial-records, budgets, transfers); long-tail read-like files in the other 28 houses fall outside |
| Impact | 63 read-like files (zero write-vocabulary calls) outside the guard; the +1 growth (`inventory/materialUnitLabels.ts`, added by the documented R10-B3 MaterialUnit labels slice) was invisible to CI — exactly the predicted gap |
| Recommendation | **FIX_NEXT (Wave W1a — OD-GUARD)**: extend readwrite-guard families (or add a read-like corpus ratchet) with negatives; classify the new file in the same PR |
| Dependencies | OD-GUARD; this scan's census provides the current 63-file inventory |
| Tests/evidence | Guard tests incl. new-family negatives; the 63-file list as the baseline |
| Acceptance | Read-like corpus covered or boundary documented with the census as evidence |
| Rollback | Guard change revert |
| Protected behavior | The 18 registered readers + 10 PC-4 tagged; the "reader never writes" determinism |
| Confidence | High |

### 11.5 R10A-F-026 — 35 lint warnings under tested ceiling 37

| Field | Value |
|---|---|
| Supplied | DEFER (S3, REFINED) |
| **Live verdict** | **CONFIRMED — EXACT (35 reproduced live)** |
| Priority | Low-medium (process risk) |
| Evidence class | VERIFIED (live eslint run: 35 warnings = 18 max-lines-per-function + 17 complexity; ceiling 37 pinned in package.json) |
| Root cause | Legacy warnings accepted under a ceiling; no reduction path scheduled |
| Impact | New warnings hit the ceiling and pressure a raise; 2 slots headroom |
| Recommendation | **FIX_NEXT tripwire (Wave W1a — OD-GUARD)**: machine-asserted count tripwire (CI output vs 37) + optional family-scoped reduction plan; **no ceiling increase** |
| Dependencies | OD-GUARD |
| Tests/evidence | `group6Docs.test.ts` continues pinning the ceiling; tripwire output in CI |
| Acceptance | Count machine-asserted; drift visible; ceiling unchanged |
| Rollback | Tripwire removal (decision-only otherwise) |
| Protected behavior | The ceiling 37 and its governance test |
| Confidence | High |

### 11.6 R10B-NF-004 — PeriodRange name collision

| Field | Value |
|---|---|
| Supplied | DEFER (S3, CONFIRMED) |
| **Live verdict** | **CONFIRMED — UNCHANGED (2 declaration sites at the exact recorded lines)** |
| Priority | Low |
| Evidence class | VERIFIED (`pages/FinanceActivity.tsx:43` string union vs `application/finance/periodPresets.ts:33` object type; no import relation) |
| Root cause | Same name, different meaning across layers — grep/review hazard |
| Impact | None today (no type-level confusion) |
| Recommendation | **FIX_NEXT (Wave W1b — rename at next touch of either file)** |
| Dependencies | None |
| Tests/evidence | `rg PeriodRange` (2 sites) |
| Acceptance | Renamed at next natural wave |
| Rollback | n/a |
| Protected behavior | Neither type's shape |
| Confidence | High |

### 11.7 R10B-NF-005 — ungoverned application-internal deep imports

| Field | Value |
|---|---|
| Supplied | DEFER (S3, CONFIRMED: 108 edges) |
| **Live verdict** | **CONFIRMED — SEAM PROVEN LIVE-GROWING: 128 unique edges (+2 since the R10-B base; both growth edges from documented R10-B3 work)** |
| Priority | **Medium-high (raised by this scan: the silent growth happened)** |
| Evidence class | VERIFIED (per-edge diff base→live; the recorded 108 figure itself is UNVERIFIED under my method — §19.2) |
| Root cause | ADR-018's doors decision scoped itself to feature consumers (UI→application); one layer down (application→application) was left open |
| Impact | By target house: time 49, formatting 14, finance 9, inventory 8, fulfillment 7, financial-records 6, +22 houses ≤4. A new house-boundary violation class is invisible to CI — and did in fact grow silently during R10-B |
| Recommendation | **OWNER_DECISION_REQUIRED (OD-10, §16.3)**: (a) declare shared-infrastructure houses (time, formatting, identity, resultCodes-root) exempt-by-design + ratchet the rest, or (b) accept and document the open internal graph. If (a): Wave W3 guard work |
| Dependencies | OD-10; edge graph/SCC evidence (this scan's census provides the 128-edge inventory) |
| Tests/evidence | If (a): module-boundaries extension + negatives; the census as baseline |
| Acceptance | Policy recorded; ratchet live or open graph documented |
| Rollback | n/a (decision first), then guard-change revert |
| Protected behavior | The doors architecture for UI consumers; infrastructure-house access patterns |
| Confidence | High (on the live state); the exact 108 figure unreproducible (NF-001) |

### 11.8 R10B-NF-007 — domain-owned label vocabulary bypassed at 4 consumers

| Field | Value |
|---|---|
| Supplied | DEFER (S3, CONFIRMED) |
| **Live verdict** | **CONFIRMED — UNCHANGED (all 4 consumers re-verified; none imports `fieldLabelAr`)** |
| Priority | Low-medium |
| Evidence class | VERIFIED (per-file import check) |
| Root cause | Display strings copied before the vocabulary existed (`src/domain/shared/numeric.ts:188-190`) |
| Impact | Validation-message/display desync risk at `agreementPresentation.ts`, `DirectSaleEditor.tsx`, `AllocationReviewCard.tsx`, `FinancialEventEditor.tsx` |
| Recommendation | **FIX_NEXT (Wave W3 — OD-LABEL, §16.8)**: surfaces import the domain labels |
| Dependencies | OD-LABEL (label vocabulary ownership) |
| Tests/evidence | Surface tests; `rg` the label strings |
| Acceptance | Single vocabulary consumed |
| Rollback | Per-file revert |
| Protected behavior | The domain-owned Arabic label strings themselves (byte-identical display) |
| Confidence | High |

### 11.9 R10B-NF-011 — unknown top-level data keys pass migration

| Field | Value |
|---|---|
| Supplied | DEFER (S4, CONFIRMED) |
| **Live verdict** | **CONFIRMED — UNCHANGED (`...raw` spread verified live in `migrateTransferSnapshot`)** |
| Priority | Low (S4; accepted-grammar wider than the 35-family schema; inert at persistence) |
| Evidence class | VERIFIED (live code read) |
| Root cause | Migration spread accepts superset grammar |
| Impact | Unknown keys in `data` reach the preview and disappear on re-export |
| Recommendation | **OWNER_DECISION_REQUIRED (OD-KEYS, §16.4)**: optional strict-mode extra-key check on current-pair files, version-gated to preserve legacy acceptance — **Wave W2 only after the decision** |
| Dependencies | OD-KEYS; current/legacy/golden corpus evidence; rejection-precedence protection |
| Tests/evidence | Characterization + new rejection tests when scheduled |
| Acceptance | Unknown data keys rejected on current-pair (strict mode); legacy pairs unaffected |
| Rollback | Feature revert (single seam) |
| Protected behavior | Legacy acceptance (24 released pairs); rejection precedence; Schema 38/Export 30 |
| Confidence | High |

### 11.10 R10B-NF-012 — confirmImport trusts prepareImport output

| Field | Value |
|---|---|
| Supplied | DEFER (S4, CONFIRMED) |
| **Live verdict** | **CONFIRMED — UNCHANGED (single-validation contract verified live; backup-first re-verified)** |
| Priority | Low (S4; single production caller passes prepareImport output verbatim) |
| Evidence class | VERIFIED (live code read) |
| Root cause | Deliberate single-pass design; future callers could bypass |
| Impact | None today |
| Recommendation | **FIX_NEXT (Wave W1b — type contract)**: document the contract on `confirmImport` (typed brand or comment); optional cheap re-validation as defense-in-depth. No wire-semantics change |
| Dependencies | None |
| Tests/evidence | n/a (documentation) |
| Acceptance | Contract documented |
| Rollback | n/a |
| Protected behavior | The single-validation wire semantics; backup-first (EXE-014) |
| Confidence | High |

### 11.11 R10B-NF-013 — 9 required families absent from counts evidence

| Field | Value |
|---|---|
| Supplied | DEFER (S4, CONFIRMED: 9 families) |
| **Live verdict** | **CONFIRMED — EXACT (22 counted vs 31 registry = the identical 9 uncounted)** |
| Priority | Low-medium (defense-in-depth asymmetry) |
| Evidence class | VERIFIED (programmatic family-set comparison) |
| Root cause | Counters frozen at 18 + RC-1's minimal OD-8 scope (4 owner families); 9 later gate-only families never got counts |
| Impact | Deletion of any of the 9 is caught by the required-array gate but lacks count cross-evidence |
| Recommendation | **OWNER_DECISION_REQUIRED (OD-COUNTS, §16.5)**: minimal vs uniform/registry-driven evidence — **Wave W2 after the decision** |
| Dependencies | OD-COUNTS; golden regeneration plan if uniform |
| Tests/evidence | RC-1 test set extension if chosen |
| Acceptance | Scope decided and recorded |
| Rollback | n/a (decision) |
| Protected behavior | Schema 38 / Export 30; the 31-family gate; existing 22 counters |
| Confidence | High |

### 11.12 R10B-NF-014 — application-layer ambient time sites

| Field | Value |
|---|---|
| Supplied | DEFER (S4, CONFIRMED: ~17 sites) |
| **Live verdict** | **CONFIRMED — REFINED: 21 classified app-layer ID-fallback sites; 0 other ambient clock reads; 1 parsing site; no persisted financial value** |
| Priority | Low (S4 informational) |
| Evidence class | VERIFIED (full classified census, §9) |
| Root cause | Guard scoped to domain; app-layer ambient time never policy-decided |
| Impact | None beyond ID-generation timing (all 21 sites are the guarded `crypto.randomUUID ?? Date.now()` fallback family) |
| Recommendation | **OWNER_DECISION_REQUIRED (OD-TIME, §16.6)**: extend the guard with an app-layer allowlist (the 21 sites) or document the boundary — **Wave W1b after the decision** |
| Dependencies | OD-TIME; lock-idle clock-source verification |
| Tests/evidence | Guard negatives if extended |
| Acceptance | Boundary decided/documented |
| Rollback | Guard change revert |
| Protected behavior | The domain-only guard scope; lock-idle security semantics (unchanged unless owner decides) |
| Confidence | High |

### 11.13 R10B-NF-017 — inline panels with incomplete dialog semantics

| Field | Value |
|---|---|
| Supplied | DEFER (S4, CONFIRMED) |
| **Live verdict** | **CONFIRMED — UNCHANGED (`RecurringExpenseDetail.tsx:246/:498/:544` inline `role="dialog"` panels; no aria-modal, no focus move)** |
| Priority | Low (S4 a11y completeness) |
| Evidence class | VERIFIED (live line-level check) |
| Root cause | Lightweight inline panels predate the dialog pattern |
| Impact | SR announces "dialog" for expanding inline sections |
| Recommendation | **FIX_NEXT (Wave W4 a11y track — OD-A11Y, §16.9)**: semantics-only rename to region/disclosure or drop role; **after D-14 focus-contract work** |
| Dependencies | OD-A11Y; D-13 interaction-model classification first |
| Tests/evidence | jsdom semantics tests |
| Acceptance | Correct semantics or documented exemption |
| Rollback | Per-file revert |
| Protected behavior | **No visual redesign**; the panel content/behavior |
| Confidence | High |

### 11.14 R10B-NF-018 — two overlays missing the AppLockGate-grade focus contract

| Field | Value |
|---|---|
| Supplied | DEFER (S4, CONFIRMED) |
| **Live verdict** | **CONFIRMED — UNCHANGED (`Settings.tsx:691-692` protectionBlocked alertdialog: no focus-in/trap/restore/inert; `DataActionPinGate.tsx:55` alertdialog: autoFocus only)** vs the gold standard (`AppLockGate.tsx:141/:198`: veil + `inert` + trap + restore) |
| Priority | Low-medium (S4 a11y; PIN-gate logic verified as logic, not occlusion) |
| Evidence class | VERIFIED (live line-level check) |
| Root cause | AppLockGate is the gold standard; the two older overlays predate it |
| Impact | Keyboard/SR users can escape the PIN-confirmation context (visual occlusion present; focus contract absent) |
| Recommendation | **FIX_NEXT (Wave W4 — FIRST, before D-13/D-15)**: align both overlays on the AppLockGate pattern (veil + inert + restore) |
| Dependencies | OD-A11Y |
| Tests/evidence | jsdom focus-contract tests (the AppLockGate test pattern) |
| Acceptance | Uniform overlay focus contract |
| Rollback | Per-file revert |
| Protected behavior | PIN enforcement logic (unchanged); no visual redesign |
| Confidence | High |

### 11.15 R10B-NF-019 — residual cosmetic a11y findings not itemized

| Field | Value |
|---|---|
| Supplied | DEFER (S4, CONFIRMED) |
| **Live verdict** | **CONFIRMED — UNCHANGED (RV3's NF-5/6/7 stand: 9 redundant `aria-live="polite"` next to `role="status"`; param-route smoke fake-token contract; test-map named-reference false-positive class)** |
| Priority | Low (cosmetic) |
| Evidence class | VERIFIED (class-level re-check; 11 files carry `aria-live="polite"` in non-test UI sources) |
| Root cause | Long-tail nits |
| Impact | None material |
| Recommendation | **FIX_NEXT (Wave W4 — after D-14/D-13; batched cosmetic cleanup + the test-map `direct`-only ratchet from RV3-NF-7)** |
| Dependencies | OD-A11Y |
| Tests/evidence | jsdom assertions |
| Acceptance | Itemized list cleaned or preserved-with-rationale |
| Rollback | Per-file revert |
| Protected behavior | The honest-invalid smoke contract (NF-6 may be PRESERVE with rationale) |
| Confidence | High |

### 11.16 R10B-NF-025 — secrets guard scans working tree only

| Field | Value |
|---|---|
| Supplied | DEFER (S4, CONFIRMED) |
| **Live verdict** | **CONFIRMED — UNCHANGED (guard run green: 1,687 files scanned, 0 patterns; working-tree fs-walk design; no history/packfile scan)** |
| Priority | Low-medium (residual exposure class) |
| Evidence class | VERIFIED (guard execution + source read `scripts/check-secrets.mjs`) |
| Root cause | fs-walk design |
| Impact | A removed-but-once-committed secret persists in history undetected by the routine guard |
| Recommendation | **FIX_NEXT (Wave W1b — OD-SEC, §16.7)**: document the known limit now (guard header + SECURITY note); optional one-time full-history scan (this scan's clone-based method is feasible: `git log -p` scan with the same 9 pattern families) and owner-scheduled recurring workflow decision |
| Dependencies | OD-SEC |
| Tests/evidence | One-off scan output (if authorized); documentation diff |
| Acceptance | Limit documented; one-time scan run or explicitly waived |
| Rollback | Documentation revert |
| Protected behavior | The 9 high-precision patterns + first-match semantics; no secret exposure in any artifact |
| Confidence | High |

**Matrix summary:** 16/16 re-verified live. 10 UNCHANGED-CONFIRMED, 2 CONFIRMED-EXACT reproductions (F-026 35/37, NF-013 9 families), 2 REFINED with growth (F-019 +1, NF-005 +2), 1 qualitative-confirm with an unreproducible figure (F-013 → NF-001), 1 boundary-note (F-006). Zero downgrades, zero reclassifications to FIX_NOW-without-owner, zero reopenings of closed work.

---

## 12. Full matrix — all 5 PRESERVE_BY_DESIGN cards (re-verified as protected controls)

### 12.1 P-01 — `IndexedDbLocalStore` (4,399 lines, SPLIT_NOW band)

- **Why preserved:** transaction boundaries, atomicity, error identity (`storage_stale`), IndexedDB behavior semantics are one contract surface; 130/130 method parity with the reference adapter; the guarded-abort atomicity is pinned by tests; decomposition without a proven seam would risk transaction semantics.
- **Classification still correct?** YES — no repeated parity divergence, no responsibility failure proven; growth is machine-ratcheted (baseline entry `VERIFIED` live: 4391→4399 documented re-anchors only).
- **Evidence debt:** the size itself (SPLIT_NOW band) is the registered debt, owner-gated.
- **Decomposition trigger (concrete):** a repeated parity divergence between adapters traceable to file structure, or a transaction-boundary defect proven to stem from the monolith shape. Neither exists.
- **Safest evidence-only improvement:** the storage-parity view already exists (R10-B1); keep it regenerated.
- **Must not change:** transaction/atomicity/error-identity semantics; method surface (130).
- **Tests/rollback:** adapter suites + parity tests; rollback = any decomposition PR revert (none proposed).

### 12.2 P-02 — `MemoryLocalStore` (2,123 lines, SPLIT_NOW band)

- **Why preserved:** the reference adapter and parity oracle — its shape mirrors the IndexedDB adapter deliberately so parity is diffable.
- **Still correct?** YES (same reasoning as P-01; ratchet-enforced growth; 2087→2123 documented).
- **Trigger:** same as P-01 (divergence class), or an owner decision to split BOTH adapters along a proven identical seam simultaneously.
- **Must not change:** parity semantics; the oracle role.
- **Tests/rollback:** parity suites; n/a (no change proposed).

### 12.3 P-03 — `craft-order/policies` (1,415 lines, SPLIT_NOW band)

- **Why preserved:** Domain/financial policies, invariants, messages — the financial-protection chain (R2's F-15 preserve row).
- **Still correct?** YES — the two registered soft spots remain the honest debt: **tests** (0 direct unit files; 77 test files cover the logic indirectly through barrels — file-level re-verified live) and the **generic exit criterion** (element 5 of the 10-element card).
- **Trigger:** a direct-test evidence gap that lets a policy regression through (none occurred); an owner-authorized extraction along policy-family seams with the R2-closure protections.
- **Safest evidence-only improvement:** direct characterization tests for the highest-risk policy clusters (candidate for W1b P-03 evidence work).
- **Must not change:** financial invariants, message literals (frozen throw-message set), rounding semantics.
- **Tests/rollback:** root domain suite (470/470 recorded at R10-B); n/a.

### 12.4 P-04 — `storage/local/types.ts` (884 lines, SPLIT_CANDIDATE band)

- **Why preserved:** the storage contracts, Schema 38, Export 30, `PrototypeLocalStore` (130 methods), `LocalExportCounts`, snapshot/export-file shapes — one contract surface, owner-gated by the double-diff rule (AGENTS §10).
- **Still correct?** YES — versions verified live; the door-surfaces + entity-touchpoints + registry guards pin the consumers.
- **Trigger:** a schema/export version change (owner-only) or a proven contract-ambiguity defect.
- **Must not change:** `localSchemaVersion=38`, `localExportVersion=30`, the 130-method surface, current/legacy/golden compatibility.
- **Tests/rollback:** transfer suites + goldens; n/a.

### 12.5 P-05 — `transferFamilyValidators` + ADR-017 (1,745 lines)

- **Why preserved:** Transfer family completeness, current/legacy/golden compatibility, rejection behavior and precedence — the R6-SCAN-F-005 preserve with the ratchet evidence (1718→1730→1745 documented growth).
- **Still correct?** YES — the characterization test + family-registry gate + 27-golden MANIFEST pin the behavior (live checks green).
- **Trigger:** a rejection-precedence divergence or a new family wave (owner-gated, W2).
- **Must not change:** rejection precedence; legacy acceptance; golden derivations.
- **Tests/rollback:** `transferFamilyValidators.characterization.test.ts` + the transfer suite; n/a.

**Preserve summary:** 5/5 classifications re-verified correct; all growth machine-enforced; zero decomposition triggers proven; the P-03 evidence debt (direct tests) is the only actionable improvement, and it is evidence-only (W1b candidate, owner-gated). OD-PRESERVE (§16.10) asks the owner to re-ratify 5/5 with the two registered soft spots.

---

## 13. Newly discovered provisional R11-W0 findings

### R11-W0-NF-001 — R10-B matrix quantitative claims F-013 and NF-005 are not reproducible from documented evidence

- **Classification:** documentation/record-quality gap (S4). Not a code defect.
- **Evidence:** this scan reproduced every R10-B figure that carried a documented method — F-006 (17, identical file set), F-019 (62 at base, exact), F-026 (35, exact), the R6 seam (57/52, exact), R2 (15→17 with protocol), R5/R1/R4 (exact), NF-013 (9 families, exact) — but could not reproduce (a) F-013's "59 files/326 references" (live literal-token census: 15/148 production; 16/150 incl. tests; broader `*Minor`: 214/4,868 — no method yields 59/326), nor (b) NF-005's "108 edges" (this scan's guard-mirroring census at the same base SHA: 126 unique edges; `(src-house,target)` dedup: 89). The census methods for those two figures were not recorded in the matrix or reviewer reports (the reviewer scripts ran on scratch outside the repo, per protocol).
- **Impact:** the qualitative findings stand (both were re-verified qualitatively); but future waves citing these figures will inherit ambiguous baselines — the exact failure mode this scan hit.
- **Recommendation (NOT_EXECUTED):** DOCUMENT_ONLY — future matrices (and the R11 remediation waves' records) must record the census method (script or command) alongside any count; the R10-B matrix itself must NOT be rewritten (owner-gated; a dated addendum could note the variance if the owner wishes).
- **Owner:** Micro owner. **Tests:** n/a. **Acceptance:** method recorded with counts in future evidence. **Rollback:** n/a. **Confidence:** High (the variance itself is verified; the original figures' methods are the unknown).

No other genuinely new finding was discovered: the +2/+1 seam growths are evidence strengthening existing findings (NF-005/F-019), the vendored-braces observation is a scan-environment artifact (§19.3), and the F-006 boundary note is a scope clarification. The codebase shows no new defect class beyond the recorded 16.

---

## 14. Target module map and Feature → Module → Contract → Test → Owner map

**Target module map (current-state assessment; no moves proposed):** the layer topology is healthy and does not need restructuring: domain (19 pure areas) ← storage adapters (2+contracts) ← application houses (33+1, door-mediated) ← app-shell composition ← UI (pages/components/presentation). The two structural debts are (1) the ungoverned application-internal seam (OD-10) and (2) the type-only UI→storage coupling (F-006) — both addressable by guard/policy work, **not** by file moves. Barrels and mass moves remain forbidden (§5 rules 5–6 of the prompt; AGENTS §11 rule 1).

**Feature → Module → Contract → Test → Owner map (key rows):**

| Feature | Module(s) | Contract(s) | Test anchor | Owner decision |
|---|---|---|---|---|
| Order/agreement/fulfillment | domain/craft-order; application/agreements, fulfillment, estimates | Contracts 20, 23, 40 | craft-order barrel suites; OrdJourneys | — |
| Money representation | domain/shared/currency | §4 financial boundaries; ADR-011 | moneyLayerGuard frozen surface | OD-MONEY (D-02) |
| Period result / owner entitlement / catalog / actual time (G3/O1/G4) | domain/financial-analysis, owner-entitlement, actual-time; application/financial-analysis, owner-money | 14, 15, 16, 12/17 | G3/G4/O1 dom tests | — |
| Transfer/backup | application/transfers; storage/local | Contract 39; ADR-017 | 27 goldens + rc1Gate + releasedPairs | OD-KEYS (D-09), OD-COUNTS (D-11) |
| PWA/identity | pwa/, vite plugin, buildIdentity | R10-B D1 records | vite-build-identity tests; PWA drill evidence | — (closed) |
| Lock/security | application/security; components/security | Contract 37 | AppLockGate suite | OD-A11Y (D-14 alignment) |
| Recurring expenses | domain/recurring-expense; application/recurring, budgets | Contract 41 | RecurringExpenseSurfaces | OD-A11Y (D-13) |
| Preferences/capabilities | application/preferences | — | Set003 suites | — |
| Storage adapters | storage/local | P-01/P-02/P-04 cards | parity suites; 130-method surface | OD-PRESERVE |

---

## 15. Minimum safe remediation wave map (proposed; NOT_EXECUTED)

The candidate grouping from the prompt was challenged against live evidence. **Challenge result: candidate Wave 1 is too broad** — it mixes pure guard additions with contract documentation and one-time scans, which have different risk profiles and rollback units. Proposed split (W1a/W1b); all other waves confirmed with sharpened entry conditions.

### Wave 0 (this task) — read-only scan ✅ complete with this report

### Wave W1a — pure guard additions (independent rollback per guard)

- **IDs:** D-01 (F-006 type-edge ratchet), D-03 (F-014 AST date-guard exemption binding), D-04 (F-019 readwrite-family extension / read-like ratchet), D-05 (F-026 lint count tripwire).
- **Entry conditions:** OD-GUARD accepted; this scan's censuses as baselines (19 type edges / 63 read-like files / 35 warnings).
- **Another scan needed?** No — baselines provided by this W0.
- **Allowed surfaces (conceptual):** `scripts/check-module-boundaries.mjs` (type-edge rule), `scripts/check-date-arithmetic-ownership.mjs`, `scripts/check-application-readwrite.mjs`, CI lint output wiring, their test files, ratchet baselines.
- **Forbidden:** any application/domain/storage/UI production change; any ceiling/tolerance change; baseline growth without dated protocol.
- **Dependencies:** none between the four (independent PR-able slices on one branch, per the repo's slice convention).
- **Risk:** low (guard-only; negative tests prove rejection). **Tests:** each guard's negative fixtures. **Evidence:** guard runs green + negatives red. **Acceptance:** all four guards live with pinned baselines. **Rollback:** per-guard revert. **Safe stopping state:** any subset landed; remainder still DEFERRED with this W0 as baseline.

### Wave W1b — contract documentation + one-time scans + evidence debt

- **IDs:** D-06 (NF-004 PeriodRange rename at touch), D-10 (NF-012 confirmImport type contract), D-12 (NF-014 ambient-time allowlist — **after OD-TIME**), D-16 (NF-025 secrets limit documentation + optional one-time history scan — **after OD-SEC**), P-01..P-04 evidence (P-03 direct characterization tests candidate).
- **Entry conditions:** OD-TIME and OD-SEC decided where required; otherwise independent.
- **Allowed surfaces:** guard header docs, SECURITY.md note, contract comments/typed brands, characterization test files, the optional one-time history scan artifact (in the evidence store).
- **Forbidden:** wire-semantics changes; guard behavior changes beyond documentation.
- **Risk:** minimal. **Rollback:** doc/test reverts. **Safe stopping state:** documentation-only subset landed.

### Wave W2 — Transfer contract closure

- **IDs:** D-09 (NF-011 unknown-keys strict mode), D-11 (NF-013 counts scope), P-05 evidence refresh.
- **Entry conditions (all mandatory):** OD-KEYS and OD-COUNTS explicitly decided; current/legacy/golden corpus evidence plan; rejection-precedence protection tests designed first.
- **Forbidden:** Schema 38/Export 30 changes; legacy acceptance narrowing without owner; golden regeneration except by the documented protocol.
- **Risk:** medium (transfer semantics). **Tests:** characterization + new rejection tests + goldens. **Acceptance:** decided scope live with evidence. **Rollback:** single-seam feature reverts. **Safe stopping state:** decisions recorded, implementation deferred.

### Wave W3 — Application boundaries and label ownership

- **IDs:** D-07 (NF-005 internal-seam policy + optional ratchet), D-08 (NF-007 label vocabulary).
- **Entry conditions:** OD-10 decided (exempt-by-design + ratchet vs documented open graph); OD-LABEL decided; this scan's 128-edge census as the baseline.
- **Forbidden:** barrels, mass file moves, door-surface changes without protocol.
- **Risk:** medium. **Tests:** module-boundaries extension negatives; surface label tests. **Rollback:** guard revert + per-file reverts.

### Wave W4 — Accessibility track

- **IDs:** D-14 (NF-018 overlay focus contract) **first**, D-13 (NF-017 dialog semantics) after interaction-model classification, D-15 (NF-019 cosmetic batch + test-map direct-ratchet) after itemization.
- **Entry conditions:** OD-A11Y scope accepted; **no visual redesign** boundary restated.
- **Risk:** low-medium (a11y semantics only). **Tests:** jsdom focus/semantics suites. **Rollback:** per-file reverts.

### Wave W5 — conditional MoneyMinor family branding

- **IDs:** D-02 (F-013) **only if** the owner explicitly chooses complete family branding after OD-MONEY; otherwise close D-02 with a documented unbranded-alias policy + the mechanical compensating controls (integer kernels, sole formatter, frozen surface, money-layer guard) as the durable record.
- **Entry conditions:** OD-MONEY decision; if branding: dedicated wave, type-only migration, full-suite verification.
- **Forbidden:** partial branding (repo rule 7 of the prompt).

---

## 16. Owner decision cards

### 16.1 OD-GUARD — guard family additions

```text
Decision ID: OD-GUARD
Decision required: authorize the W1a guard package (type-edge ratchet D-01, AST date-guard D-03, readwrite-family extension D-04, lint tripwire D-05) and the baseline values this scan measured (19 type edges / 63 read-like files / 35 warnings, ceiling unchanged)
Options: (a) authorize all four W1a guards; (b) authorize a subset (each independently rollback-able); (c) hold all (seams stay ungoverned; growth continues to be invisible)
Recommended option: (a) — the +2/+1 silent growth measured by this scan is direct evidence the gaps are live; all four are guard-only changes with negative-test proofs
Why: control gaps, not defects; guard-only risk; baselines already measured by this W0
Exact protected behavior: no ceiling/tolerance/guard weakening; the sanctioned type-only UI→storage pattern itself (the ratchet pins growth, not existence); the 5 guarded date sites; the registered reader crew
Evidence still needed: none (this W0 supplies baselines)
Safe stopping state if undecided: seams remain DEFERRED with this W0 census as the recorded baseline; no growth alarm exists
Rollback/exit boundary: per-guard revert in the same PR that introduced it
```

### 16.2 OD-MONEY — unbranded policy versus complete family branding

```text
Decision ID: OD-MONEY
Decision required: close D-02 either by ratifying the unbranded-alias policy with compensating controls, or by authorizing Wave W5 complete-family branding
Options: (a) ratify unbranded policy (document in ADR; close D-02); (b) authorize W5 branding migration (type-only, full-suite); (c) hold
Recommended option: (a) — the compensating controls are verified live (integer kernels, sole persisted formatter, frozen writer surface, money-layer guard, zero parseFloat); partial branding is forbidden by repo rule; a 15-file/148-ref literal surface is small but the *Minor family is 214 files/4,868 refs — the migration cost is real and the defect count is zero
Why: no current defect; branding is defense-in-depth against future misuse; the recorded 59/326 figure is unreproducible (R11-W0-NF-001) so the decision should use THIS scan's numbers
Exact protected behavior: MoneyMinor integer discipline; persistedMoneyTextMinor sole-formatter; frozen writer surface
Evidence still needed: if (b): a fresh complete census with recorded method
Safe stopping state if undecided: policy stays unratified; no code changes; controls continue to hold
Rollback/exit boundary: decision-only under (a); W5 PR revert under (b)
```

### 16.3 OD-10 — Application internal import policy

```text
Decision ID: OD-10
Decision required: govern or document the application-internal cross-house seam (128 unique edges live; grew +2 silently during R10-B)
Options: (a) declare shared-infrastructure houses (time, formatting, identity, resultCodes root file) exempt-by-design and ratchet the remaining feature-house edges; (b) accept and document the open internal graph with periodic census; (c) full doors-everywhere program (mass change — not recommended)
Recommended option: (a) — 67% of edges target the 4 infrastructure spine members (time 49 + formatting 14 + identity 2 + resultCodes... root file is legal-by-definition); feature-house edges are the governed remainder; mirrors ADR-018's successful UI-scope decision one layer down
Why: the seam provably grows silently; infrastructure access is by-design; feature-house coupling is the real boundary risk
Exact protected behavior: the doors architecture for UI consumers; infrastructure-house public surfaces; no barrels/mass moves
Evidence still needed: the edge-classification table (feature-house remainder) — derivable from this W0's census
Safe stopping state if undecided: seam stays ungoverned with this W0 census as the recorded baseline (128 edges)
Rollback/exit boundary: guard-change revert; baseline shrink-only ratchet per protocol
```

### 16.4 OD-KEYS — unknown current-pair data keys

```text
Decision ID: OD-KEYS
Decision required: whether to add the optional strict-mode extra-key rejection on current-pair files (D-09)
Options: (a) strict mode version-gated to current pair (legacy 24 pairs unaffected); (b) document the superset grammar as accepted; (c) hold
Recommended option: (a) — closes the accepted-grammar/35-family-schema asymmetry inertly and reversibly; mirrors the counts-object rejection precedent
Why: import validation is strict everywhere else (counts, digest, family gate); unknown-key survival to re-export is the one superset surface
Exact protected behavior: legacy acceptance; rejection precedence; Schema 38/Export 30; the migration spread for legacy pairs
Evidence still needed: none (characterization design in W2)
Safe stopping state if undecided: unknown keys remain inert at persistence (only known stores written) — no data-loss path
Rollback/exit boundary: single-seam feature revert
```

### 16.5 OD-COUNTS — minimal versus uniform/registry-driven counts evidence

```text
Decision ID: OD-COUNTS
Decision required: extend count cross-evidence to the 9 uncounted required families (D-11), or accept the asymmetry
Options: (a) uniform — count all 31 registry families (goldens + characterization updates; larger churn); (b) registry-driven — counts derived from the family registry (one source of truth; requires registry→counts coupling design); (c) accept asymmetry (the required-array gate already catches deletion)
Recommended option: (b) if the coupling design stays type-safe and single-sourced; else (a); the R10-B OD-8 precedent chose minimal for owner families only — this is the completing decision
Why: deletion is already gated; counts add tamper cross-evidence symmetry
Exact protected behavior: the 22 existing counters; Schema 38/Export 30 (counts keys are additive-only under the R10-B2 protocol); legacy files without counts blocks
Evidence still needed: golden regeneration plan if (a)/(b)
Safe stopping state if undecided: asymmetry documented (this W0 verifies the 9-family list exactly)
Rollback/exit boundary: counts-extension revert + golden re-pin in the same PR
```

### 16.6 OD-TIME — Application time boundary and lock-idle verification

```text
Decision ID: OD-TIME
Decision required: policy for the 21 app-layer ambient time sites (all ID-fallback class) and the lock-idle clock source
Options: (a) extend the date-ownership guard with an app-layer allowlist (the 21 sites + lock-idle + PWA banner classes) so new sites fail CI; (b) document the domain-only boundary as accepted
Recommended option: (a) — the census is complete and classified (this W0); an allowlist ratchet is cheap and makes the boundary durable
Why: no persisted financial value is affected today; the risk is future drift into persisted/financial paths, which the guard would catch
Exact protected behavior: the domain kernel rules; todayInAmman explicit-instant contract; lock-idle security semantics (unchanged in behavior — only guarded)
Evidence still needed: none (census in this W0)
Safe stopping state if undecided: domain-only guard continues; app-layer sites unlisted
Rollback/exit boundary: guard-extension revert
```

### 16.7 OD-SEC — history scan and recurring workflow

```text
Decision ID: OD-SEC
Decision required: the secrets-guard known limit (working-tree only) — document + one-time history scan + optional recurring workflow
Options: (a) document the limit now + authorize a one-time full-history scan (git log -p with the same 9 pattern families; artifact to the evidence store) + decide recurrence later; (b) document only; (c) add a recurring history-scan CI job (cost/perf tradeoff)
Recommended option: (a) — documentation is free; the one-time scan closes the historical window; recurrence is a separate cost decision
Why: a removed-but-once-committed secret is invisible to the routine guard; the scan is feasible (this W0's clone-based method demonstrates it)
Exact protected behavior: the 9 patterns' precision (no false-positive loosening); no secret exposure in any artifact (scan output must be sanitized)
Evidence still needed: one-time scan execution (W1b, after this decision)
Safe stopping state if undecided: limit remains undocumented (current state)
Rollback/exit boundary: doc revert; scan artifact is append-only evidence
```

### 16.8 OD-LABEL — label vocabulary ownership

```text
Decision ID: OD-LABEL
Decision required: confirm domain-owned label vocabulary (fieldLabelAr) as the single source and migrate the 4 bypass consumers (D-08)
Options: (a) migrate the 4 consumers to import the vocabulary (byte-identical display required); (b) move the vocabulary to an application house and re-export (ownership change); (c) accept hardcoded strings
Recommended option: (a) — smallest change; preserves domain ownership; display bytes unchanged
Why: 4 files, verified bypass; desync risk is real but bounded
Exact protected behavior: the Arabic label strings byte-identical; domain ownership of validation-message vocabulary
Evidence still needed: none
Safe stopping state if undecided: 4 hardcoded sites remain (bounded, enumerated)
Rollback/exit boundary: per-file revert
```

### 16.9 OD-A11Y — accessibility track scope

```text
Decision ID: OD-A11Y
Decision required: authorize the W4 track (D-14 overlay focus contract first; D-13 dialog semantics after classification; D-15 cosmetic batch + test-map direct-ratchet) under a strict no-visual-redesign boundary
Options: (a) authorize W4 as scoped; (b) D-14 only (the two PIN-adjacent overlays); (c) hold all
Recommended option: (b) then (a) — D-14 is the only finding with a user-facing interaction gap (keyboard/SR escape from PIN-confirmation contexts); D-13/D-15 are semantics/cosmetic
Why: D-14 sites verified live at exact lines vs the AppLockGate gold standard; the pattern and tests already exist
Exact protected behavior: NO visual redesign; PIN enforcement logic; the honest-invalid smoke contract (NF-6 candidate preserve)
Evidence still needed: none (sites enumerated)
Safe stopping state if undecided: overlays keep current behavior (visual occlusion present; focus contract absent)
Rollback/exit boundary: per-file reverts
```

### 16.10 OD-PRESERVE — re-ratify the five Preserve cards

```text
Decision ID: OD-PRESERVE
Decision required: re-ratify the 5 PRESERVE_BY_DESIGN cards for the R11 cycle (or open a controlled exception)
Options: (a) re-ratify 5/5 with the two registered soft spots (P-03 direct tests; P-03 generic exit criterion); (b) authorize the P-03 direct-characterization evidence work as W1b (evidence-only, not decomposition); (c) open a decomposition exception (requires a concrete defect/trigger — none exists per this scan)
Recommended option: (a) + (b) — the classifications all re-verified correct (§12); the evidence work closes the honest debt without touching the surfaces
Why: zero decomposition triggers proven; growth machine-enforced; parity/contracts pinned
Exact protected behavior: the five surfaces' semantics (§12 "must not change" rows); Schema 38/Export 30; 130-method surface; rejection precedence
Evidence still needed: none for ratification
Safe stopping state if undecided: cards stand as ratified at R10-B OD-2
Rollback/exit boundary: decision-only; (b) is test-files-only
```

No protected option was silently selected on the owner's behalf: every card above carries live options and a safe stopping state.


---

## 17. Compatibility / invariant protection plan

For every proposed wave, these invariants are protected by design and must be re-verified at each wave gate (all `VERIFIED` intact at this scan):

| Invariant | Live state | Protection in R11 waves |
|---|---|---|
| `localSchemaVersion=38` / `localExportVersion=30` | types.ts:55/:71 | No wave touches them; W2 explicitly forbidden from version changes; double-diff rule (AGENTS §10) |
| Current/legacy/golden Transfer compatibility | 24 released pairs; 27 goldens + MANIFEST | W2 entry condition includes corpus evidence + rejection-precedence tests first |
| Rejection precedence & multi-fault behavior | RC-1 gate + counters + envelope digest | W2 characterization-first; no silent narrowing |
| IndexedDB/Memory parity | 130/130 methods | Preserve cards P-01/P-02; no decomposition without trigger |
| PWA/build identity behavior | D1 carrier (index.html meta; CSP-safe); deterministic bundle σ̂=0 | No wave touches the carrier; bundle ceilings raw 650,000 / gzip 155,300 **untouched and untouchable without owner** |
| Money discipline | Integer kernels; sole persisted formatter; frozen writer surface | OD-MONEY options both preserve; W5 (if chosen) is type-only |
| Arabic/RTL & product copy | Byte-identical display requirements | OD-LABEL option (a) explicitly byte-identical; W4 no-visual-redesign |
| Guards/ceilings | 18+1 guards green; lint 35/37; file-size ratchet 497 files | W1a adds guards only; zero ceiling/tolerance changes |
| No `features/` layer, no barrels, no mass moves | Current architecture | Restated as forbidden in every wave |

## 18. Test and evidence plan

Per-wave evidence requirements (for the owner's authorization records):

- **W1a:** per-guard negative fixtures (growth rejected, shrink allowed, stale-baseline rejected); guard runs green on the exact head; this W0's baselines cited (19/63/35/128-edge census where applicable).
- **W1b:** documentation diffs; the one-time history-scan artifact (sanitized) in the evidence store; P-03 characterization tests passing; CI + Cloudflare Pages green on the exact head.
- **W2:** characterization tests BEFORE behavior tests; new rejection tests; goldens regenerated only by the documented `GOLDEN_UPDATE=1` protocol with MANIFEST re-pin; released-pairs suite unchanged-green; rejection-precedence matrix extended, never narrowed.
- **W3:** edge census table (this W0 as baseline); module-boundaries extension negatives; label display byte-identity tests.
- **W4:** jsdom focus-contract tests per overlay (AppLockGate pattern); semantics assertions; zero visual-parity drift (screenshot-free verification by design boundary).
- **W5 (if authorized):** full typecheck + root and prototype suites + money-layer guard + bundle re-measurement (identity-invariance must hold).
- **Every wave:** CI + Cloudflare Pages green on the exact PR head; five-reviewer read-only gate per the repo convention; no merge without owner.

## 19. Risks, limitations, unresolved questions, and evidence that would change recommendations

### 19.1 Scan methodology defects found and corrected in this scan (recorded per instruction)

The initial census run returned **false zeros** (UI→storage 0, deep imports 0, etc.). Root causes, all fixed in the corrected census: (1) the import regex matched single-quoted, single-line `import … from '…'` only — the repo uses double quotes and multi-line import clauses; (2) the `@/` alias was resolved without the `apps/prototype-web/client/src/` prefix, dropping all alias-based imports from prefix checks; (3) test files were included as census sources (guards scan production files only); (4) application **root** files (e.g., `resultCodes.ts`) were misclassified as house interiors (the guard's `applicationInteriorOf` treats them as legal). The corrected census was validated by three independent methods: `rg` counts (all matched), execution of the actual guards (all seam counts matched exactly), and base-vs-live per-edge diffs. **The initial false-zero result is recorded here as a methodology lesson, not a repo finding.**

### 19.2 Recorded-figure reproducibility limits (R11-W0-NF-001)

F-013's 59/326 and NF-005's 108 could not be reproduced (my reproducible figures: 15/148 and 126-at-base). The qualitative findings are unaffected. This variance changes no recommendation, but any wave that cites those numbers should re-cite this scan's measured values with methods.

### 19.3 Environment artifacts

The vendored-braces guard failed in this scan's scratch clone because `npm install` resolved newer toolchain versions than the frozen `pnpm-lock.yaml` (prettier 3.9.10 vs 3.9.6; rollup 4.64.6 vs 4.62.4; vite 7.3.7 vs 7.3.6). CI's canonical install passed the same guard on the same head. Recorded as a positive control (the guard detects toolchain drift by design), not a defect. No other environment-sensitive observation occurred; no test suites were executed beyond guards/lint (the recorded R10-B CI evidence covers them).

### 19.4 Access limitations

The prior §11 scan report (external docs repo, `17b264c`) was not readable from this repository; its scope is known from §11's summary and the executed plan's records — sufficient for the reconciliation classification. The R10-B reviewer scripts (RV1–RV5 W0) ran on scratch outside the repo per protocol and are not recoverable — the direct cause of §19.2.

### 19.5 Evidence that would change recommendations

- A parity divergence between the storage adapters → opens P-01/P-02 decomposition trigger.
- A rejection-precedence regression in any transfer test → escalates W2 to immediate.
- A new lint warning landing → F-026 pressure becomes live (ceiling rule engages).
- An actual secret found in history → OD-SEC (c) becomes the required option.
- Any new UI→storage type import or cross-house deep import landing before W1a/W3 → the silent-growth trend continues; the censuses in this report remain the last measured baseline.

## 20. Exact actions performed and exact actions not performed

**Performed (repository writes — exactly the two permitted):**
1. Created the dedicated documentation-only branch `audit/r11-wave0-structure-scan-20261013` from the verified live `origin/main` (`31afaf39`).
2. Added this report at `docs/architecture/refactoring/r11-wave0-20261013/R11-W0-STRUCTURE-ARCHITECTURE-CONTRACT-SCAN-REPORT-2026-10-13.md`.
3. Added one catalog row for this report to `docs/00-document-index.md` (preserving all existing rows/formatting).
4. Committed (report-only message) and pushed the branch; opened one documentation-only PR to `main`.

**Performed (read-only investigation):** fresh clone; live-state verification (refs/PRs/CI via API); full census suite (A/B + base-SHA diffs) in external scratch; actual guard executions (18 root + 1 app guard) and one eslint run on the scratch clone; `git archive` base snapshot; all findings re-verification; five sequential reviewer passes; this report.

**NOT performed:** no application/domain/storage/Transfer/guard/test/config/generated/current-state/runtime change; no structural refactoring; no file moves; no barrel additions; no ceiling/tolerance/guard weakening; no golden regeneration; no R10-B matrix edit (its 16 DEFER dispositions stand untouched); no workstream/Operations-Control JSON update; no AGENT-SEQUENTIAL-WORKLOG/current-state/current-state-log write (explicitly out of the permitted two-file scope); no merge; no branch deletion; no PR close; no cleanup; no second branch beyond the dedicated audit branch; no token exposure (credential used only through the protected askpass/env mechanism for the branch push and PR creation, never printed/stored/committed).

## 21. Report publication details

- **Branch:** `audit/r11-wave0-structure-scan-20261013` (from `origin/main` @ `31afaf39ad57a82e72aa61e59879e46f8801ce36`)
- **Commit SHA:** *(filled at publication — see below)*
- **PR:** *(URL filled at publication)*
- **Changed files:** exactly 2 — this report (new) and `docs/00-document-index.md` (+1 row).
- **Checks:** recorded at publication below.

## 22. Final owner handoff

The R11 Wave 0 gate is now satisfied at the evidence level: a comprehensive, method-recorded, independently-validated read-only scan of the post-R10-B structure, architecture, code organization, and contracts exists as the canonical baseline for every future R11 decision. The owner is asked to:

1. Review the 16 DEFER verdicts (§11) — the two growth findings (F-019 +1, NF-005 +2) and the record-quality note (NF-001) are the new information since R10-B.
2. Decide the ten cards (§16) — recommended: OD-GUARD (a), OD-MONEY (a), OD-10 (a), OD-KEYS (a), OD-COUNTS (b-else-a), OD-TIME (a), OD-SEC (a), OD-LABEL (a), OD-A11Y (b→a), OD-PRESERVE (a+b).
3. Authorize waves in the §15 order (W1a → W1b → W2 → W3 → W4; W5 only conditional on OD-MONEY).
4. Merge this report-only PR when satisfied (owner-only action).

Nothing auto-starts. Every recommendation is `NOT_EXECUTED`. The safe stopping state is this published report with all seams measured, all decisions carded, and the repository otherwise untouched.

```text
WAVE0_COMPLETE — OWNER_DECISIONS_REQUIRED
REPORT_ONLY_REPOSITORY_WRITES_PERFORMED
NO_APPLICATION_OR_STRUCTURAL_REFACTORING_PERFORMED
NO_MERGE_PERFORMED
NO_CLEANUP_PERFORMED
NO_TOKEN_EXPOSURE
```
