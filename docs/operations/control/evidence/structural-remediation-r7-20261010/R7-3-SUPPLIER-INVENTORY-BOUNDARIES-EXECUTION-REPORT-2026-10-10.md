# R7-3 — Supplier and Inventory Editor Boundaries (P04 + P08 + P09) — Execution Report

**Program:** WS-216 / ARCH-007 — R7 wave, slice R7-3
**Date:** 2026-10-10 · **Executor:** Z AI · **Base:** R7-2 head `c86c4f2c…` · **Mode:** BRANCH_AND_PR_ONLY

## 1. Scope executed

- **R6-F17-P04** SupplierPurchaseEditor — editor decision model behind an application surface (suppliers house).
- **R6-F17-P08** InventoryMovementEditor — editor decision model behind an application surface (inventory house).
- **R6-F17-P09** InventoryMaterials — four-way page query behind an application surface (inventory house).

## 2. What changed (files)

| File | Change |
|---|---|
| `application/suppliers/supplierPurchaseEditorModel.ts` | **NEW** — `UNSET_PAYMENT_SOURCE`, `resolveDefaultPaymentSource` (FIN-003), `paymentWalletPayload`, `validatePurchaseSubmission` / `validatePaymentSubmission` / `validatePurchaseEditSubmission` (code gates), `isLinkedMaterialTracked` (EXE-011), `supplierPurchaseToFormValues`. |
| `application/inventory/inventoryMovementEditorModel.ts` (+test) | **NEW** — `parseMovementLinkParams` (order/sale/purchase/material deep links), `validateMovementSubmission` (nine code branches in the original check order — including the original's defensive unreachable project-note branch, preserved verbatim), `deriveWasteContext` (five-kind family). 8 unit tests. |
| `application/inventory/inventoryMaterialsViewModel.ts` (+test) | **NEW** — `InventoryMaterialsState` + `readInventoryMaterialsPage` (four-way Promise.all with the honest all-or-error semantics). Unit tests for both paths. |
| `pages/SupplierPurchaseEditor.tsx` | 1184→1204 raw lines net (gate restructures): wallet rule, load mapping, three gates, EXE-011 check, and both wallet payload derivations via the model; the five frozen preview mirrors untouched; contract-07 copy page-side. |
| `pages/InventoryMovementEditor.tsx` | 973→963 raw lines: link parsing, save gate, waste context via the model; EXE-012/Ops001 paths untouched. |
| `pages/InventoryMaterials.tsx` | 880→860 raw lines: state type + load effect via the view-model; command channels and rendering untouched. |
| `moneyLayerGuard.contract.test.ts` | VIEW_MODEL_MODULES += the three new modules. |
| `scripts/ui-application-import-baseline.json` | +3 documented keys. |
| `scripts/check-module-boundaries.test.mjs` | Count pin 10→13 with dated note. |
| `apps/prototype-web/scripts/bundle-surfaces-baseline.json` | Second documented same-PR update (precache +2,514 for the three modules; lazy totals re-locked; entry ceilings untouched — 629,300 raw / 154,676 gzip local). |
| register §2/§3 | Rows re-measured + dated closures for P04/P08/P09; test-map regenerated. |

## 3. Verification (all green)

- Typecheck clean; lint 0/35; format clean.
- Focused: **P04** 5 files / 36+ tests; **P08** 3 files / 27 tests + 8 model tests; **P09** 5 files / 39 tests + model tests; moneyLayerGuard green.
- Full: **root 730/730; app 329 files / 2,438 tests** (+3 files over R7-2).
- Guards 17/17 PASS; build PASS (budget 629,300/154,676; surfaces within the updated baseline).

## 4. Impact statements

**None** across financial/semantic (decision logic verbatim, codes-not-copy; contract 07 semantics and services untouched), schema/export/import (38/30), historical/rejection, security, visual UI (no CSS/DOM/copy change; DOM pinned by 102 focused tests).

## 5. Rollback boundary

Revert the R7-3 commits only. No data effect.

## 6. Status

R7-3_COMPLETE (P04 + P08 + P09). Remaining: R7-4 (P05/P06/P11), R7-5 (shims), R7-6 (closure).
