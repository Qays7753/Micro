# R7-2 — Order and Financial Editor Boundaries (P01 + P03 + P07) — Execution Report

**Program:** WS-216 / ARCH-007 — R7 wave, slice R7-2
**Date:** 2026-10-10 · **Executor:** Z AI · **Base:** R7-1 head `adad399a…` · **Mode:** BRANCH_AND_PR_ONLY

## 1. Scope executed

- **R6-F17-P01** OrderDetail — application-owned query surface + section decision flags.
- **R6-F17-P03** FinancialEventEditor — editor decision model behind an application surface.
- **R6-F17-P07** DirectSaleEditor — editor decision model behind an application surface.

## 2. What changed (files)

| File | Change |
|---|---|
| `application/agreements/orderDetailViewModel.ts` (+test) | **NEW** — `readOrderDetail` (honest R1 error/not_found/ready main load over agreements+inventory), `readSourceEstimate` (drafts→estimate chain), `readAvailableWalletOptions`, `readPartyNameSuggestions`, `deriveOrderSectionDecisions` (ORD-002 delivered-at, Z2.2 standing delivery, D-031 review lock, S3-12 action flags, AV-07 cancellable statuses — verbatim decision logic, codes not copy). 6 unit tests. |
| `application/finance/financialEventEditorModel.ts` (+test) | **NEW** — `basisFromMode`/`knowledgeFromBasis`, `deriveExpenseContext`, `deriveSharedPercentageBps` (exact-bps policy), `derivePrimaryAmountProblem` (three code branches incl. percentage precision), `deriveSharedExpenseIntent`, `EditorDraft` + `coerceEditorDraft` (TR-11/AV-09/M-04 defensive coercion). 14 unit tests. |
| `application/direct-sales/directSaleEditorModel.ts` (+test) | **NEW** — `productParamFromSearch`, `validateDirectSaleSubmission` (code-based gate), `resolveDifferenceOutcome` (X-06), `proposeProductParam` (deep-link product application incl. the one-shot consumption semantics of unavailable/inactive references), `directSaleToFormValues`. 11 unit tests. |
| `pages/OrderDetail.tsx` | 1885→1870 raw lines: five query effects call the view-model; section derivations replaced by `deriveOrderSectionDecisions` flags; `correctionsSummary` strings built page-side over the flags; AV-07 lists moved (pre-delivery list kept page-side for terms-panel display gating); the 13 frozen money mirrors untouched (FROZEN_SURFACE unchanged). |
| `pages/FinancialEventEditor.tsx` | 1285→1206 raw lines: draft coercion + derivation block + save gate moved to the model; guided-input contract-27 copy stays page-side; `sharedKnowledge` re-derived via the model for the classification section. |
| `pages/DirectSaleEditor.tsx` | 1023→1022 raw lines: validation gate, X-06 outcome, product-param proposal, and loaded-sale mapping via the model; both F-049 mirrors stay page-side; EXE-010 reversal path untouched. |
| `moneyLayerGuard.contract.test.ts` | VIEW_MODEL_MODULES += the three new modules (zero money-compute pin). |
| `scripts/ui-application-import-baseline.json` | +3 documented keys (one per lazy page route → its model module), dated notes. |
| `scripts/check-module-boundaries.test.mjs` | Count pin 7→10 otherKeys with dated note. |
| `apps/prototype-web/scripts/bundle-surfaces-baseline.json` | Deliberate same-PR update per the guard's own protocol: precache +1,144 bytes = the structural cost of the extracted modules inside the build graph; lazy totals re-locked at current measurements + documented CI drift allowance; **entry ceilings untouched** (629,300 raw / 154,689 gzip local vs 650,000/155,300). |
| register §2/§3 | Rows re-measured with dated closures; card closures appended for P01/P03/P07. |
| test-map | Regenerated (3 new module test files; no page drift). |

## 3. Verification (all exit 0 / green)

- Typecheck (app) clean; lint 0 errors / 35 warnings (≤37); format clean.
- Focused suites: **P01** 11 files / 65 tests (OrdJourneys, OrderDetail.ui, G3, G3Delivery, G3Hardening, G4RetainedDeposit, G6, OrderShare.exe015, R1.orderDetailVoid, ReversalSurfacesExe010, ArabicRtlContent); **P03** 4 files / 27 tests (guided, ui, DeepScreens, OwnerJourneysExe009) + 14 model tests; **P07** 4 files / 21 tests (DirectSaleEditor.ui, G3, ReversalSurfacesExe010, U005) + 11 model tests; moneyLayerGuard 10 tests.
- Full suites: **root 730/730; app 326 files / 2,430 tests** (+2 files, +31 tests over R7-1).
- Guards: all 17 PASS (module-boundaries with 3 new documented keys; ratchet; door surfaces unchanged this slice; type/runtime cycles clean).
- Build: budget PASS (entry 629,300 raw / 154,689 gzip — ceilings untouched); surfaces PASS after the documented same-PR baseline update (lazy 101 / 1,413,609 / 433,835; precache 187 / 2,745,193).

## 4. Impact statements

**None** across financial/semantic (decision logic moved verbatim, codes-not-copy; services and domain untouched), schema/export/import (38/30 untouched; no storage/domain/transfer file changed), historical/rejection, security, and visual UI (no CSS/DOM/copy change; DOM output pinned by the 113 focused tests above).

## 5. Rollback boundary

Revert the R7-2 commits only (three pages return to inline logic; three modules+tests deleted; baselines/register/test-map revert with the slice). No data effect.

## 6. Status

R7-2_COMPLETE (P01 + P03 + P07). Remaining: R7-3 (P04/P08/P09), R7-4 (P05/P06/P11), R7-5 (shims), R7-6 (closure).
