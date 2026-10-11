# R10-B W0 — Reads/Locations Matrix

**Date:** 2026-10-11 · **R10B_BASE_SHA:** `ffc54eb1150932c9bba88b48a7c38275f2a3effa`

Purpose: the canonical map of **where each finding's evidence lives and what was actually read** during W0 — one row per finding family, with the exact live locations. Full per-finding records (with all canonical fields) are in `R10-B-FINDINGS-MATRIX-2026-10-11.json`.

## 1. Governing and tracker documents read at W0 (primary executor)

| Read | Location (live main @ ffc54eb1) |
|---|---|
| Routing/authority | `AGENTS.md` (all 173 lines; §2 routing, §3 precedence, §10 guarded limits, §11 gate, §14 Operations Control) |
| Live state | `docs/operations/current-state.md` (107 lines); `docs/operations/control/generated/AGENT-BRIEF.md`; `generated/ACTIVE-WORK.md` |
| Program records | `docs/operations/control/workstreams/WS-216.json`; `items/ARCH-007.json`; `schemas/item.schema.json`; `schemas/workstream.schema.json` |
| Execution contract | `docs/architecture/refactoring/ZAI-STRUCTURAL-REMEDIATION-R0-R10-EXECUTION-CONTRACT-20261007.md` (§5 R10, §6 five-role model, §7 merge policy, §10 closure status, §11–§12 continuation) |
| Control history | `REFACTORING-CONTROL.md` (v1.22 headers + §14/§15); `R0-LIVE-BASELINE-AND-FINDING-RECONCILIATION-2026-10-07.md` §6.4 (lens/vector dispositions); `INDEPENDENT-TRACKS-RECORD.md` (R/S/T/U/V/W/X) |
| R10-A package | extracted from immutable PR #352 head `a2a1af7e` via `git archive` (report 309 ln; evidence ledger 1002 ln / 55 rows; denominator inventories 305 ln / 17 inventories; 5 reviewer reports) — byte-identical to the R10-A session copies (diff-verified) |
| Items corpus | all 85 `items/*.json` censused programmatically (status/classification/gate) |

## 2. Per-finding evidence locations (live code, verified by the named reviewer(s) + reconciler)

| Finding(s) | Primary evidence location(s) |
|---|---|
| F-001 | `FILE-SIZE-AND-RESPONSIBILITY-REGISTER.md:63,:413`; deletions at `bfa48d44`/`07a8b7e4` (git log) |
| F-002, F-007 | `docs/architecture/ARCHITECTURE.md:23` (count) + arrow section; live `src/domain/` (18 dirs); 75 storage→domain edges |
| F-003 | `src/domain/inventory-material/types.ts:39-44`; `application/inventory/inventoryMovementEditorModel.ts:114-119` (zero imports); `inventoryMaterialModel.ts:14` (canonical-import counter-example) |
| F-004 | `app/useDisabledCapabilities.ts:11`; `components/settings/SettingsCapabilitiesSection.tsx:25,:57,:101`; `application/preferences/preferenceService.ts:117-122` |
| F-005, NF-008 | `docs/architecture/ADRs/ADR-018.md:14` (43 keys; 4 doorless); `scripts/ui-application-import-baseline.json` (52 keys/57 sites); composition root 36 keys/39 specifiers |
| F-006 | `scripts/check-module-boundaries.mjs:369` (R5 value-only); the 17 type-only import sites (RV1 list) |
| F-008 | 6 method names across the 45-file storage-local test corpus; `IndexedDbLocalStore.ts:184-221` (delegations); indirect coverage via `draftService.test.ts:61,76,86`, `formDraftService.test.ts:21,80`, `localLockService.test.ts:74-81,171-185` |
| **F-009 (+NF-009/-013)** | `transferCounters.ts:10-29` (18 families); `transferSnapshotValidation.ts:77-123` (19 strict + 8 optional), `:851-862` (defaults), `:173-222` (migrations), `:91-93` (contrast case); `localTransferService.ts:119-122,:161,:172-225,:227-242`; `indexedDbSnapshot.ts:273-431,:380-422`; `MemoryLocalStore.ts:1458-1509,:1472-1524`; `influentialSnapshotFamilies.ts:22-114` (mechanism precedent); `ownerEntitlementTransfer.test.ts:257-294` (legacy contract); goldens: `current-pair.golden.json`, `current-pair-supplement.golden.json`, MANIFEST |
| F-010 | `syncSha256.ts:7-34,:52-119`; its 5 self-referential test sites; `exportGoldens.test.ts:64` (node:crypto, MANIFEST-only) |
| F-011 (+NF-010) | `indexedDbStores.ts:23-24`; `MemoryLocalStore.ts:84-85`; `adapterConformance.group10.test.ts:1089-1119`; the ~45-literal inventory (RV2 A4) |
| F-012 (+NF-006) | `assetService.ts:128`; `loanService.ts:88`; `receivedLoanService.ts:96`; `retainedDepositService.ts:65`; insecure-context docs `catalogPresentation:102-105`, `Catalog.operationKey.test.ts:47`; ~41 UI sites (RV1) |
| F-013 | `src/domain/shared/currency.ts:2`; 59 files/326 refs |
| F-014 | `check-date-arithmetic-ownership.mjs:87-127,:130,:152-196`; the 5 guarded sites (`CorrectionsLayer.tsx:82`, `SettingsDataProtectionSection.tsx:171`, `FormDraftRestoreBanner.tsx:59`, `correctionHistoryService.ts:342,:478`) |
| F-015 | `R2.renderSmoke.test.tsx:56` ("(55)" vs 56 URLs); router config (65 routes + catch-all); 9 absent patterns (7 direct-tested) |
| F-016 | `ErrorBoundary.tsx:27-29` (mount-only focus), `:57` (`<main role=alert>` insertion); mount-time test at `:62` |
| F-017 | `Notice.tsx:52-66` (InlineError) + `Field.tsx:56` (polite channels, both outside R9 inventory); 125 alert sites; QuickSaleForm vs DraftEditor contrast |
| F-018 | `markers.tsx:22` (aria-hidden renders; role never in DOM) |
| F-019 | `check-application-readwrite.mjs:63` (5 families); 62-file inventory (RV3) |
| F-020 | `pages/AgreementEditor.tsx`, `pages/CashOpeningLaterEditor.tsx`, `pages/CashWallets.tsx` (no direct test import among 341 files); `generated/test-map.json` (named-reference false positive) |
| F-021 | 18 files/45 lines (RV3 inventory); `moneyLayerGuard.contract.test.ts:48-67` (45/45 frozen) |
| F-022 | `docs/contracts/40-technical-ownership-map-contract.md:18`; register `:356` (R7-5 removal) |
| F-023 (DISPROVED) | `CONTRIBUTING.md` (31 lines, zero audit/policy matches); history `bcb5bc80`/`6fb8e0cf`; repo-wide audit-policy search (0 hits) |
| F-024 | `.replit:17-19` (+`:1` nodejs-20); `scripts/post-merge.sh:2-8`; `check-bundle-surfaces.mjs:97-106,:418-423`; its test `:143-145`; register `:792`; ratchet baseline `:1599`; archived handoff `agent-handoff-2026-08-29.md:47-51` |
| F-025 | `.github/workflows/ci.yml` (4 floating `uses:`, `node-version: 22`, permissions verified) |
| F-026 | `package.json:21` (`--max-warnings 37`); `group6Docs.test.ts:105`; warning families (complexity, max-lines-per-function over src+tests) |
| F-027 | `check-secrets.mjs:60-105` + its 12 test its |
| F-028 (+NF-021) | `check-file-size-ratchet.mjs:288` (+ reanchor ledger handling); `check-bundle-surfaces.mjs:103-104` |
| F-029 | `package.json` overrides block; `pnpm-lock.yaml` (tailwindcss@4.3.3 no nanoid edge) |
| F-030 | `design-token-guards.py`; `theme-contrast-guard.py` (zero tests); contrast: `text-density-count.py` + `test_operations_control.py` (have negatives) |
| F-031 (+NF-020/-022/-023) | `apps/prototype-web/tsconfig.json:2-3` (exclude `**/*.test.ts`; 226 vs 115 census); `tsconfig.node.json` (unreferenced); eslint CLI scope; `tools/micromatch-shim/**` (609 ln) |
| F-032 | `agent-handoff-protocol-v1.md:17,:31,:51`; `todo.md:3`; `AGENTS.md:117,:140`; `current-state.md §7:70` |
| F-033 (+NF-029) | `current-state.md:4,:17,:105`; contract `:3,:19,:21`; plan `:13`; `REFACTORING-CONTROL.md:188,:213`; `ARCH-007.json`/`WS-216.json` next_action; 3 generated views; `control/context.md:10-12,:75,:89-91` |
| F-034 | `items/SCOPE-001.json`, `SCOPE-002.json`, `UX-002.json` (byte-identical generic text); pattern: `INDEPENDENT-TRACKS-RECORD.md`; comparison rows: R0 §6.4 `:185-222`, plan A.6–A.7 |
| F-035 | items corpus (starts HARD-009); `migration-map.md` row 122 |
| F-036 | `generate_tracker.py:35,:143`; `generated/ACTIVE-WORK.md` + `AGENT-BRIEF.md` (WS-216 row) |
| F-037 | `docs/operations/` (SOP/parity-view/transfer-view/guard-view absent); evidence dir on main (absent) vs 3 remote R10 branches (present) |
| NF-001 | `supplierPurchaseEditorModel.ts:21,25-29,49-50,64-65`; `expenseFormModel.ts:24,38-43,60-62` |
| NF-002 | `materialSuggestions.ts:66-73`; `deliveryReviewService.ts:146-152`; +4 UI sites; `src/domain/inventory-material/types.ts:1` |
| NF-003 | `contexts/ThemeContext.tsx:6`; `application/preferences/preferenceService.ts:20` |
| NF-004 | `pages/FinanceActivity.tsx:43`; `application/finance/periodPresets.ts:33` |
| NF-005 | 108 application-internal cross-house edges (RV1 B4 inventory) |
| NF-007 | `src/domain/shared/numeric.ts:188-190` (fieldLabelAr); 4 bypass sites |
| NF-011/-012/-013/-014 | `migrations :15`; `localTransferService.ts:227-242`; the 9 uncounted families; the ~17 ambient-Date sites (RV2 B5) |
| NF-015 | `MicroAppShell.tsx:86` (`key={location}` remount) |
| NF-016 | `pages/AgreementEditor.tsx:326-339` |
| NF-017/-018/-019 | RecurringExpenseDetail inline dialog; Settings overlays; RV3 NF-5..7 list |
| NF-024/-026 | `check-test-focus.mjs:55,:58-61`; `test_operations_control.py` |
| NF-025 | `check-secrets.mjs:60-93` (fs-walk scope) |
| NF-027/-028 | `items/LEGAL-001.json` vs `items/FIN-007.json` (VERIFIED 2026-09-22 @ 893e3c864); `items/DEVICE-001.json` vs `items/REL-001.json` (VERIFIED 2026-09-23 @ 027fc7b5) |
| NF-030 | `releases/pre-pilot.json` (43) vs `items/PILOT-001.json` (35); delta: FIN-009, REM-001..007 |
| NF-031/-032 | `docs/decisions/review-finance-c2-decision-v1.md:67`; `docs/decisions/remaining-capabilities-review-v1.md:155` |
| NF-033 | `items/BE-001..003.json` next_action |
| NF-034 | this matrix + synthesis §3 |

## 3. Baselines verified live (W0-D)

| Baseline | Commit | Ancestor of main | Proves |
|---|---|---|---|
| Primary semantic/invariant | `fc2ae6e7dbb6f03eef3b0e103ee6176eeddeb052` (2026-10-07, "docs: pin R0 baseline") | YES | isolates the R0–R9 structural program delta (protected-invariant differential for program changes) |
| Secondary weakening/process | `25594773a83ec5eb1e9dde5feaf1c808c0ff686f` (2026-10-06, PR #321 merge) | YES | spans the guard-hardening era (weakening audit: configs, thresholds, baselines) |
| Historical A-to-Z reference | `5eacbe38011c9a753b4daeb9801541fb2538ca30` (2026-10-05, PR #312 merge) | YES | spans both structural programs (longest differential; includes A-to-Z changes) |

Each baseline is used only for what it can prove; no proof type is forced onto a single baseline. Differential proof execution remains post-gate work (owner ratifies this three-baseline policy — OD-1).

## 4. Repository-state reads (W0 preflight)

| Fact | Evidence |
|---|---|
| `R10B_BASE_SHA` | `git fetch --prune` → `origin/main` = `ffc54eb1150932c9bba88b48a7c38275f2a3effa` (== prompt's draft-time observation; == R10-A AUDIT_SHA_X → **no drift**) |
| Branch collision | `git ls-remote` → `refactoring/r10b-systemic-findings-root-fix-20261011` did not exist; created from BASE_SHA |
| Open PRs | #351 head `e3be3897`, #352 head `a2a1af7e`, #344 head `3ec0bfdc` — all NOT ancestors of main (unmerged) |
| R10-A evidence location | on PR #352 branch only (not main) — read via `git archive a2a1af7e`; W0 artifacts cite it by immutable commit |
| Preserved UI branch | `f28b0fa6` (2026-09-21), non-ancestor — untouched |
