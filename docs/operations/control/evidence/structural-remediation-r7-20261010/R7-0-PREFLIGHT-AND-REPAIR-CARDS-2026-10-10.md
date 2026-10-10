# R7-0 — Preflight, Repair Cards, and Consumer Inventories (UI Structural Boundaries and Compatibility Shims)

**Program:** WS-216 / ARCH-007 — Structural Remediation R0–R10, R7 wave
**Report date:** 2026-10-10 · **Executor:** Z AI (single primary executor; five read-only review gates)
**Mode:** R7-0 is read-only for production code. This file records the preflight, the eleven package cards, the consumer inventories, and the slice plan. No production file was changed in R7-0.

---

## 1. Live baseline verification (VERIFIED)

| Element | Value | Class |
|---|---|---|
| `origin/main` at execution start | `e01d560539476c1c7f712891f2355200d2d74aa6` (merge of `8f7ba482…` R6 final implementation + `2e2dbd99…` R6 reconciliation = PR #341) | VERIFIED |
| Lineage check | `8f7ba482` = merge(`6106497b` W2, `0cb58b5a` W3); first-parent chain contains `5ff733dd` (W1) — exactly the R6 closure recorded in the R6 complete report | VERIFIED |
| Open PRs | 0 (API query, state=open, per_page=50) | VERIFIED |
| CI on main head | run `37999470232` — `completed/success` on `e01d5605` exactly | VERIFIED |
| Worktree | clean; R7 branch `refactoring/r7-structural-ui-boundaries-20261010` created from `origin/main` at `e01d5605`; one writer | VERIFIED |
| Credentials | secure askpass mechanism (`.secrets` file, never printed). Token pasted in the mission chat was never used, quoted, or stored. NO_SECRETS_EXPOSED | VERIFIED |
| Authorization | Owner R7 execution mission (this wave): R7-0 → R7-6, BRANCH_AND_PR_ONLY, final state PR_READY, owner merges | VERIFIED |
| Schema/Export | `localSchemaVersion=38` / `localExportVersion=30` (storage/local/types.ts) — untouched throughout R7 | VERIFIED |
| Preserved UI branch | `docs/ux-ui-zed-handoff-20260921` untouched | VERIFIED |

No `STATE_DRIFT`. No unknown local work. The R6 evidence convention (`structural-remediation-r7-20261010/`) was verified against the existing R6 directory before creating this file.

## 2. Census method and binding constraints (VERIFIED)

**Census tools** (persisted outside the repository, outputs archived in the executor workspace):
- `r7-shim-census.py` — every import statement (value / `import type` / dynamic `import()` / `export … from`) referencing the compatibility units, with file:line; a regex defect (indented dynamic imports) was found and fixed against the live `PrototypeServicesContext.tsx:216` case before results were accepted.
- `r7-package-census.py` — every importer of each of the eleven package primary files, with kind and file:line.

**Binding guard constraints recorded before any extraction (all live-verified):**
1. `moneyLayerGuard.contract.test.ts` FROZEN_SURFACE pins money-compute mirror lines per UI file: OrderDetail 13, SupplierPurchaseEditor 5, DirectSaleEditor 2, OwnerEntitlement 2, Statement 1 (+ non-package files). Neither growth nor silent shrink passes; a mechanical move updates the table same-PR with evidence.
2. `check-application-door-surfaces.mjs` pins the exact value+type export surface of every `application/**/index.ts` door; widening a door is a deliberate same-PR baseline change with a dated note.
3. `check-file-size-ratchet.mjs` fails only for band escalation or a new file entering a review band directly; a new NORMAL file passes; deleted files must be pruned from the baseline same-PR (door-hygiene rule).
4. `text_density_policy.py` PAGES ledger (60 entries) measures page files by basename; `components/**` and `application/**` are not page-measured. The R7 design therefore creates **no new `pages/` files**.
5. ESLint layer rules: `application/**` may not import React (not even type-only) and may not import `@/components/*` / `@/pages/*` (not even type-only). Extracted view-model modules are therefore React-free pure modules; React binding stays in the page.
6. `check-type-cycles.mjs` baseline = 1 (storage types ↔ supplierScheduleCommitGuard, STR-307). The Finance mixed SCC (STR-204c / R6-SCAN-F-019) is a value+type SCC between `pages/Finance.tsx:65` (value import of `FinancePeriodResultSection`) and `components/finance/FinancePeriodResultSection.tsx:12` (type import of `FinanceState` from the page) — dissolution is the R7-1 acceptance.
7. `ui-application-import-baseline.json` pins UI→application deep-import keys (ADR-018 R6 rule); migrating a site removes its key same-PR; a legitimate new key carries a dated reason.
8. Bundle ceilings 650,000 raw / 155,300 gzip (ADR-012/ADR-017 discipline: measure before push; normalize/compress first; raising is an owner decision).

**Extraction architecture decided from these constraints (the R7 seam):**
- Application-owned view-model/query surfaces live in `application/<area>/` as React-free modules: state types, block-assembly/query functions, pure validation/derivation functions. They take services (and the injectable clock) as parameters; they never touch storage directly and never own financial rules (those stay in `src/domain/` and the canonical application services).
- Pages keep a thin React binding (useState/useEffect glue + rendering) and consume the extracted surfaces through the existing doors or the module files, following the live deep-import baseline protocol.
- Presentation-section separations inside components (P10) stay within `components/finance/`.
- No new `pages/` files; no generic barrels; no file-per-function splits.

## 3. Package census summary (VERIFIED live; matches register §2/§3)

| ID | Primary file | Lines | useState | Prod consumers | Direct test files |
|---|---|---|---|---|---|
| P01 | pages/OrderDetail.tsx | 1885 | 51 | MicroRouter:28 (dynamic) | 12 (ArabicRtlContent.w44, G3, G3Delivery, G3Hardening, G4RetainedDeposit, G6, OrdJourneys, OrderDetail.ui, OrderShare.exe015, R1.orderDetailVoid, ReversalSurfacesExe010, check-layer-boundaries.test.mjs) |
| P02 | pages/Finance.tsx | 1640 | 13 | MicroRouter:33 (dynamic); FinancePeriodResultSection.tsx:12 (type — the F-019 cycle edge) | 15 (D005, EventsLayer.familyGuard, FinanceBridge.w173, FinanceBudgets.w174, FinanceEmptyTruth, FinanceJourneys, FinanceObligations.w43, FinanceSafeWithdrawal.w176, FinanceShortCashHorizon.w175, G005FinanceReadIsolation, U001, U05, U07, group1Surfaces, group2InventorySurfaces) |
| P03 | pages/FinancialEventEditor.tsx | 1285 | 31 | MicroRouter:46 (dynamic) | 4 (DeepScreens.w43, FinancialEventEditor.guided, FinancialEventEditor.ui, OwnerJourneysExe009) |
| P04 | pages/SupplierPurchaseEditor.tsx | 1184 | 27 | MicroRouter:48 (dynamic) | 5 (G004CapabilityGuard, G3Hardening, PurchasingBridgeExe011, SupplierPurchaseEditor.ui, group2InventorySurfaces) |
| P05 | pages/OwnerEntitlement.tsx | 1165 | 52 | MicroRouter:42 (dynamic) | 1 (G6) |
| P06 | pages/Schedule.tsx | 1032 | 16 | MicroRouter:31 (dynamic) | 1 (G004CapabilityGuard) |
| P07 | pages/DirectSaleEditor.tsx | 1023 | 31 | MicroRouter:17 (dynamic) | 4 (DirectSaleEditor.ui, G3, ReversalSurfacesExe010, U005) |
| P08 | pages/InventoryMovementEditor.tsx | 967 | 26 | MicroRouter:58 (dynamic) | 3 (InventoryAdjustExe012, Ops001MovementSelection, group2InventorySurfaces) |
| P09 | pages/InventoryMaterials.tsx | 876 | 13 | MicroRouter:56 (dynamic) | 5 (G004CapabilityGuard, InventoryAdjustExe012, InventoryLowStock, PurchasingBridgeExe011, group2InventorySurfaces) |
| P10 | components/finance/EventsLayer.tsx | 844 | 20 | Finance.tsx:65 (value) | 1 (group1Surfaces) |
| P11 | pages/Statement.tsx | 825 | 14 | MicroRouter:90 (dynamic) | 2 (G2, StatementPeriod.w173) |

All dynamic route imports are lazy route entries in `app/MicroRouter.tsx` (unchanged by R7). No page is imported by another production module except the two Finance edges above. **No page owns financial truth** (re-confirmed: canonical readers throughout; the F-049 mirror surface is frozen and guarded).

---

## 4. Repair cards R6-F17-P01..P11

> Common fields apply to all cards unless overridden: Category = structural UI boundary; Classification = R6-SCAN-F-017 DEFER package converted to an executing R7 card (owner R7 mission, 2026-10-10); User/data/financial/security/UI impact = none (no visual change: CSS/DOM/tokens/copy/navigation untouched; no financial semantic change; schema/export/history/rejection untouched); Short-term safety measure = the existing journey/dom suites + guards already pin observable behavior; Final state = filled at closure per package. Journey/test commands use the live suite names from TEST-AND-DOCUMENTATION-MAP and package cards.

### R6-F17-P01 — OrderDetail.tsx

- **Affected files/modules:** `apps/prototype-web/client/src/pages/OrderDetail.tsx` (1885 lines; 51 useState; single orchestrator `OrderDetail()` at :81). New: `application/orders/orderDetailViewModel.ts` (React-free view-model/query surface).
- **Responsibility and seam:** order-detail page coordinator — query/state assembly for the agreement / delivery / collection / corrections sections is embedded in the page function; 13 frozen W5-A money-mirror sites (FROZEN_SURFACE `pages/OrderDetail.tsx: 13`) stay in place.
- **Canonical source of truth:** financial rules in `src/domain/craft-order/**` + canonical application services (contract 40 §8); the page only renders and calls.
- **Complete consumer inventory:** 13 live imports — value/dynamic: `app/MicroRouter.tsx:28` (lazy route); type/test: 12 files (ArabicRtlContent.w44, G3, G3Delivery, G3Hardening, G4RetainedDeposit, G6, OrdJourneys, OrderDetail.ui, OrderShare.exe015, R1.orderDetailVoid, ReversalSurfacesExe010 dom tests + `scripts/check-layer-boundaries.test.mjs` string reference). No other production importer.
- **Value/type inventory:** all consumers value-import the default component (route + tests); zero type-only production imports of this file.
- **Runtime/dynamic/string references:** MicroRouter lazy `import()`; `check-layer-boundaries.test.mjs` pins the file's layer classification by path.
- **Direct tests and journey tests:** OrdJourneys, G3/G3Delivery/G3Hardening, G6, G4RetainedDeposit, OrderShare.exe015, ArabicRtlContent.w44, R1.orderDetailVoid, ReversalSurfacesExe010, OrderDetail.ui (full list §3).
- **Root cause:** state/query ownership never separated from presentation when the page grew (W5-A documented the mirror family; R6 scan F-017 recorded the seam).
- **Dependencies:** none blocking; W5-A baseline update required only if a mirror moves (not planned).
- **Allowed files:** pages/OrderDetail.tsx; new application/orders/orderDetailViewModel.ts; application/orders door surface + door baseline; tests for the new module; records (register/test-map/ownership) at closure.
- **Forbidden files:** src/domain/**; storage/**; styles/**; components/** (unless a mechanical import needs it — none planned); MicroRouter.tsx; any CSS/DOM/copy change.
- **Minimum safe remediation:** extract the order-loading/query orchestration (order read, settlement/delivery/collection/correction reads, derived presentation models that are pure derivations, not the frozen mirrors) into `application/orders/orderDetailViewModel.ts` with services injected; the page keeps React binding and calls the view-model functions.
- **Tests and commands:** focused `pnpm prototype:test -- OrderDetail OrdJourneys G3 G3Delivery G3Hardening G6 G4RetainedDeposit OrderShare R1.orderDetailVoid ReversalSurfacesExe010 ArabicRtlContent` + new module unit tests; then the full chain (§7 commands).
- **Acceptance criteria:** page consumes the application-owned view-model/query surface; zero financial rule in UI; mirrors count unchanged (FROZEN_SURFACE `pages/OrderDetail.tsx: 13` untouched); all journeys green on the pushed head; no visual diff (source-level review; no DOM/CSS/copy edits).
- **Rollback boundary:** revert the P01 slice commits only (page returns to its pre-slice unit; no data effect).

### R6-F17-P02 — Finance.tsx (FinanceState boundary + F-019 mixed-cycle root fix)

- **Affected files/modules:** `pages/Finance.tsx` (1640 lines); `components/finance/FinancePeriodResultSection.tsx:12` (the type edge); new `application/finance/financeState.ts`; `application/finance/index.ts` door (type exports).
- **Responsibility and seam:** Finance page state/query ownership — `FinanceState`/`FinanceBlockId` types, `BlockRead`/`safeBlock` query machinery, and the G-005 block-assembly (Promise.all over 15 canonical reads + failedBlocks) are page-embedded today. The only mixed value/type SCC in the tree runs through this file.
- **Canonical source of truth:** financial truth stays canonical — `projectFinancialService` (contract 40 §8: the sole reader of record; spy `periodResultCanonical`), `financialPulseService`, `financialAnalysisService` (g5), `ownerEntitlementService` (owner-money), `fulfillment`, `correctionHistory` (financial-records), `inventory`, `assets`, `loans`, `retainedDeposits`. The view-model module only orchestrates reads and shapes state — it owns no rule.
- **Complete consumer inventory:** 17 live imports (§3): MicroRouter:33 dynamic; FinancePeriodResultSection.tsx:12 type (`FinanceState` — the cycle edge); 15 dom/journey test files value-import the page.
- **Value/type inventory:** the cycle is `Finance.tsx:65` value-imports `FinancePeriodResultSection` ⇄ `FinancePeriodResultSection.tsx:12` type-imports `FinanceState` from the page. All other consumers are value (route/test).
- **Runtime/dynamic/string references:** MicroRouter lazy import; `EventsLayer.familyGuard.dom.test.tsx` and others reference the page path; `check-module-boundaries` documents the component→page type edge (STR-204c row, ownership registry §5).
- **Direct tests and journey tests:** 15 files (§3) incl. FinanceJourneys (journey), G005FinanceReadIsolation (block isolation), FinanceBridge/Budgets/EmptyTruth/Obligations/SafeWithdrawal/ShortCashHorizon (feature journeys), D005/U001/U05/U07/group1/group2/EventsLayer.familyGuard.
- **Root cause:** FinanceState was defined inside the page when G-005 introduced block isolation; the extracted section component needed the type, creating the component→page type edge (F-019); the state assembly stayed page-owned (F-017 seam; STR-204c).
- **Dependencies:** P10 (EventsLayer is rendered by this page); the door-surface baseline update; FIN-002 five lazy-build sites keep their documented lazy `import()` behavior (budgets service loads on first section open — unchanged).
- **Allowed files:** pages/Finance.tsx; components/finance/FinancePeriodResultSection.tsx (import line only); new application/finance/financeState.ts; application/finance/index.ts; scripts/application-door-surfaces-baseline.json; tests for the new module; records at closure.
- **Forbidden files:** src/domain/**; storage/**; the service files themselves; styles; MicroRouter; any DOM/CSS/copy change; the 13 mirrors are not in this file (Finance is not in FROZEN_SURFACE).
- **Minimum safe remediation:** move `FinanceBlockId`, `FinanceState`, `BlockRead`, `safeBlock`, `BridgeState`, `CashHorizonState` and the three block-assembly orchestrations (main overview, profit-to-cash bridge, short-cash horizon) verbatim into `application/finance/financeState.ts` as `readFinanceOverview(deps, from, to)`, `readProfitToCashBridge(deps, from, to)`, `readShortCashHorizonBlock(deps, days)`; export the types through the finance door; both Finance.tsx and FinancePeriodResultSection.tsx import from the door; the cycle is gone (type edge now component→application, legal).
- **Tests and commands:** focused Finance suites (15 files) + `periodResultCanonical` spy + `node scripts/check-type-cycles.mjs` + `node scripts/check-runtime-cycles.mjs` proving the mixed SCC dissolved; then the full chain.
- **Acceptance criteria:** mixed SCC gone without type-only concealment (the value edge Finance→FinancePeriodResultSection remains as-is; the type edge is re-pointed to the application module — no SCC either way); page consumes application-owned FinanceState/query surface; journeys green; no visual diff; FIN-002 lazy sites unchanged.
- **Rollback boundary:** revert the P02 slice commits only.

### R6-F17-P03 — FinancialEventEditor.tsx

- **Affected files/modules:** `pages/FinancialEventEditor.tsx` (1285 lines; 31 useState; `coerceEditorDraft` at :180); new `application/financial-events/financialEventEditorModel.ts` (or the existing financial-events home if it exists — verify at implementation).
- **Responsibility and seam:** financial-event editor view-model — form-state machine (draft coercion, field validation, category classification channel, save command) embedded in the page function.
- **Canonical source of truth:** domain `financial-event` policies + the canonical financial-event write services; guided-input contract 27 (EnglishNumberInput regime) is a UI input contract preserved byte-for-byte.
- **Complete consumer inventory:** 5 live imports: MicroRouter:46 dynamic; DeepScreens.w43, FinancialEventEditor.guided, FinancialEventEditor.ui, OwnerJourneysExe009 tests.
- **Value/type inventory:** all value (route + tests).
- **Runtime/dynamic/string references:** MicroRouter lazy import only.
- **Direct tests and journey tests:** the four test files; guided contract tests pin the input behavior (contract 27).
- **Root cause:** single-function editor growth (97–99% family); validation/channel logic never separated from rendering.
- **Dependencies:** none blocking.
- **Allowed files:** the page; the new application model module (+ its door surface if exported through a door — else deep module file); tests; records at closure.
- **Forbidden files:** src/domain; storage; styles; components/forms/** (guided input components untouched); MicroRouter.
- **Minimum safe remediation:** extract pure editor-model parts (draft coercion `coerceEditorDraft`, validation predicates, classification/save channel orchestration taking services as parameters) into the application module; the page keeps React binding and the guided-input wiring.
- **Tests and commands:** focused FinancialEventEditor.guided/.ui + DeepScreens + OwnerJourneysExe009 + new model unit tests; then full chain.
- **Acceptance criteria:** editor driven through the application-owned model/query surface; contract-27 guided behavior byte-identical; journeys green; no visual diff.
- **Rollback boundary:** revert the P03 slice commits only.

### R6-F17-P04 — SupplierPurchaseEditor.tsx

- Same family as P03 (97–99% single function; 27 useState; 5 frozen money mirrors — FROZEN_SURFACE `pages/SupplierPurchaseEditor.tsx: 5`).
- **Complete consumer inventory:** 6 live imports: MicroRouter:48 dynamic; G004CapabilityGuard, G3Hardening, PurchasingBridgeExe011, SupplierPurchaseEditor.ui, group2InventorySurfaces tests.
- **Responsibility and seam:** purchase/payment/validation view-model behind an application-owned surface; supplier-purchase contract 07 behavior preserved.
- **Minimum safe remediation:** extract the pure purchase-line/payment/validation model parts into `application/suppliers/supplierPurchaseEditorModel.ts` (services injected); mirrors stay in the page.
- **Allowed/Forbidden:** as P03 (suppliers home; contract-07 write path untouched; storage doors untouched).
- **Tests:** focused PurchasingBridgeExe011/G3Hardening/G004CapabilityGuard/SupplierPurchaseEditor.ui/group2InventorySurfaces + new model tests; full chain.
- **Acceptance:** contract 07 unchanged; mirrors count unchanged; journeys green; no visual diff. **Rollback:** revert the P04 slice only.

### R6-F17-P05 — OwnerEntitlement.tsx

- **Affected files/modules:** `pages/OwnerEntitlement.tsx` (1165 lines; **52 useState — highest in the tree**; 2 frozen mirrors); new `application/owner-money/ownerEntitlementViewModel.ts`.
- **Responsibility and seam:** entitlement view-model — policies/movements/safe-withdrawal read assembly and withdrawal-reserve session state embedded in the page.
- **Canonical source of truth:** `application/owner-money/ownerEntitlementService.ts` (PC-4 write-path contract; F-014 PRESERVE — the service itself is NOT split by R7) + domain `owner-entitlement` policies.
- **Complete consumer inventory:** 2 live imports: MicroRouter:42 dynamic; G6.dom.test.tsx.
- **Value/type inventory:** value only.
- **Runtime/dynamic/string references:** MicroRouter lazy import; `withdrawalWalletGuard` canonical tests live in owner-money (untouched).
- **Direct tests and journey tests:** G6 journey; ownerEntitlementService.test, withdrawalWalletGuard.test (service-level, unchanged).
- **Root cause:** page accumulated read-assembly + policy/movement channels while the service stayed canonical (F-017).
- **Dependencies:** F-014 preserve boundary — do not split the service; do not alter the canonical write path.
- **Allowed files:** the page; the new application/owner-money view-model module (+ door surface if widened); tests; records.
- **Forbidden files:** application/owner-money/ownerEntitlementService.ts; withdrawalWalletGuard.ts; src/domain; storage; styles.
- **Minimum safe remediation:** extract the read/assembly view-model (overview/policies/movements queries, safe-withdrawal reserve derivation) into the owner-money view-model module with the service injected; page keeps React binding; mirrors stay.
- **Tests:** focused G6 + new model tests; full chain.
- **Acceptance:** page driven by the application-owned view-model; service invariants intact (PC-4); journeys green; no visual diff. **Rollback:** revert the P05 slice only.

### R6-F17-P06 — Schedule.tsx

- **Affected files/modules:** `pages/Schedule.tsx` (1032 lines; 16 useState; main component 32% / 68% supporting sections: CapacityDecisionSurface :396, RecurrencePanel :444, MonthSchedulePanel :697, MonthDayCell :815, MonthDayDetail :888, ScheduleSection :942, WeekDay :1000).
- **Responsibility and seam:** schedule state/section separation — day/month computation and section state embedded in the page alongside 7 presentation sections.
- **Canonical source of truth:** `application/scheduling/scheduleService.ts` + `recurrenceService.ts` (door exists); domain recurrence rules.
- **Complete consumer inventory:** 2 live imports: MicroRouter:31 dynamic; G004CapabilityGuard test.
- **Value/type inventory:** value only.
- **Runtime/dynamic/string references:** MicroRouter lazy import; text-density PAGES ledger entry "Schedule" (page keeps its name/basename — no ledger change).
- **Direct tests and journey tests:** G004CapabilityGuard today; the card requires adding journey coverage for the extracted path.
- **Root cause:** sections and state grew inside one file (F-017); smoke-only journey coverage (plan §R7).
- **Minimum safe remediation:** extract the schedule view-model (month/day derivation, capacity decision read model) into `application/scheduling/scheduleViewModel.ts`; presentation sections stay in the page file (they are rendering, not state); add a focused journey test for the extracted query path.
- **Allowed/Forbidden:** as family; scheduling home; recurrence contract unchanged.
- **Tests:** focused G004CapabilityGuard + new journey/model tests; full chain.
- **Acceptance:** real responsibility seam (state/query in application, rendering in page); new journey coverage lands; journeys green; no visual diff. **Rollback:** revert the P06 slice only.

### R6-F17-P07 — DirectSaleEditor.tsx

- Same editor family (1023 lines; 31 useState; 2 frozen mirrors; `productParamFromSearch` :39; save/cancel command channels :323/:455).
- **Complete consumer inventory:** 5 live imports: MicroRouter:17 dynamic; DirectSaleEditor.ui, G3, ReversalSurfacesExe010, U005 tests.
- **Responsibility and seam:** direct-sale editor view-model — form state/validation/channel logic behind an application-owned query/command surface; **EXE-010 collection-reversal path preserved** (SaleCollectionReversalSection consumption and its tests untouched).
- **Minimum safe remediation:** extract the pure model (param parsing, validation, save/cancel channel orchestration with services injected) into `application/direct-sales/directSaleEditorModel.ts`; page keeps React binding + guided input; mirrors stay.
- **Tests:** focused DirectSaleEditor.ui/G3/ReversalSurfacesExe010/U005 + new model tests; full chain.
- **Acceptance:** EXE-010 reversal journeys green; contract behavior byte-identical; no visual diff. **Rollback:** revert the P07 slice only.

### R6-F17-P08 — InventoryMovementEditor.tsx

- Same editor family (967 lines; 26 useState; single function :31).
- **Complete consumer inventory:** 4 live imports: MicroRouter:58 dynamic; InventoryAdjustExe012, Ops001MovementSelection, group2InventorySurfaces tests.
- **Responsibility and seam:** inventory-movement editor view-model (movement type selection, quantity/validation, adjustment channel) behind an application-owned surface; **InventoryAdjustExe012 and Ops001 behavior preserved**.
- **Minimum safe remediation:** extract pure model parts into `application/inventory/inventoryMovementEditorModel.ts` (services injected); page keeps binding.
- **Tests:** focused InventoryAdjustExe012/Ops001MovementSelection/group2InventorySurfaces + new model tests; full chain.
- **Acceptance:** adjustment/selection journeys green; storage doors untouched; no visual diff. **Rollback:** revert the P08 slice only.

### R6-F17-P09 — InventoryMaterials.tsx

- **Affected files/modules:** `pages/InventoryMaterials.tsx` (876 lines; 13 useState; LowStockThresholdRow :833).
- **Responsibility and seam:** inventory-materials page query/view-model boundary — material reads, low-stock threshold, adjustment/purchasing suggestion reads assembled in the page.
- **Canonical source of truth:** `application/inventory/inventoryMaterialService.ts` (Wave F split family — canonical); low-stock/adjustment/purchasing contracts.
- **Complete consumer inventory:** 6 live imports: MicroRouter:56 dynamic; G004CapabilityGuard, InventoryAdjustExe012, InventoryLowStock, PurchasingBridgeExe011, group2InventorySurfaces tests.
- **Value/type inventory:** value only.
- **Runtime/dynamic/string references:** MicroRouter lazy import; text-density PAGES ledger "InventoryMaterials".
- **Direct tests and journey tests:** the five test files (incl. InventoryLowStock journey).
- **Root cause:** read-coordination embedded in the page (F-017).
- **Minimum safe remediation:** extract the read-assembly view-model into `application/inventory/inventoryMaterialsViewModel.ts` (service injected); page keeps binding and threshold-row rendering.
- **Allowed/Forbidden:** inventory home; service files untouched; no storage access from the new module.
- **Tests:** focused five suites + new model tests; full chain.
- **Acceptance:** low-stock/adjustment/purchasing guards green; no visual diff. **Rollback:** revert the P09 slice only.

### R6-F17-P10 — components/finance/EventsLayer.tsx

- **Affected files/modules:** `components/finance/EventsLayer.tsx` (844 lines; main `EventsLayer` :758 = 10.6%; `familyEventOwner` :69; `FinancialEventRow` :97 ≈ 660 lines of parallel presentation).
- **Responsibility and seam:** event-layer orchestration vs parallel presentation sections — one file mixes the layer orchestrator, the row renderer, and its helpers.
- **Canonical source of truth:** event reads stay with the canonical readers (projectFinancialService.listEvents etc.); presentation labels via presentation layer.
- **Complete consumer inventory:** 2 live imports: `pages/Finance.tsx:65` (value); `group1Surfaces.test.tsx`.
- **Value/type inventory:** value only (named export `EventsLayer`).
- **Runtime/dynamic/string references:** none beyond imports.
- **Direct tests and journey tests:** group1Surfaces + all Finance journeys that render the layer (15 P02 test files).
- **Root cause:** section growth inside the layer component file (S3-08: 10.6% main share).
- **Dependencies:** P02 (same page family; implemented in the same R7-1 slice).
- **Minimum safe remediation:** move `FinancialEventRow` + `familyEventOwner` verbatim into a sibling presentation file `components/finance/FinancialEventRow.tsx`; `EventsLayer.tsx` keeps the orchestrator and imports the row; no behavior change; no text-density impact (components are not page-measured).
- **Allowed files:** the two component files; group1Surfaces test only if an import path must be pinned (not expected — the row is internal).
- **Forbidden files:** pages/**; application/**; styles; any DOM/copy change inside the moved code (verbatim move).
- **Tests:** focused group1Surfaces + Finance journeys; full chain.
- **Acceptance:** layer orchestrated separately from its parallel sections; group1 + Finance journeys green; no visual diff. **Rollback:** revert the P10 slice only.

### R6-F17-P11 — Statement.tsx

- **Affected files/modules:** `pages/Statement.tsx` (825 lines; 14 useState; 1 frozen mirror; `StatementMarkdownService` instantiation note at :167 — R6-SCAN-F-022).
- **Responsibility and seam:** statement page query/view-model boundary — period statement read assembly + markdown composition embedded in the page; :167 is the only stateless-service instantiation outside the composition root.
- **Canonical source of truth:** `application/finance/statementService.ts` (+ statementMarkdownService) — canonical statement owner.
- **Complete consumer inventory:** 3 live imports: MicroRouter:90 dynamic; G2, StatementPeriod.w173 tests.
- **Value/type inventory:** value only.
- **Runtime/dynamic/string references:** MicroRouter lazy import; text-density PAGES "Statement".
- **Direct tests and journey tests:** G2 + StatementPeriod.w173.
- **Root cause:** read/composition coordination embedded in the page (F-017); F-022 notes the :167 deviation (no layer rule broken — the service is read-only/stateless).
- **Minimum safe remediation:** extract the statement view-model (period bounds, statement read, markdown composition call) into `application/finance/statementViewModel.ts` with the services injected **through parameters** — the :167 direct instantiation is reconciled by receiving the service from the page's service context (composition stays at the root; no copy or presentation-semantics change).
- **Allowed files:** the page; new application/finance/statementViewModel.ts; door surface/baseline if exports widen; tests; records.
- **Forbidden files:** statementService.ts/statementMarkdownService.ts internals; src/domain; storage; styles; any rendered-text change.
- **Tests:** focused G2 + StatementPeriod.w173 + new model tests; full chain.
- **Acceptance:** page driven by the application-owned view-model; :167 note reconciled with the composition inventory; rendering/copy byte-identical; journeys green. **Rollback:** revert the P11 slice only.

---

## 5. Compatibility-shim inventory (live census, VERIFIED)

Nine re-export compatibility units exist; one prompt-listed unit is already absent:

| # | Unit | Re-exports | Production consumers | Test consumers | Disposition route |
|---|---|---|---|---|---|
| 1 | `src/domain/g5/index.ts` | `../financial-analysis/index.js` | G5DecisionPanel.tsx:6 (type), Finance.tsx:43 (type) | tests/domain/public-surface.test.ts:21 (parity guard itself) | migrate 2 type imports → `@micro-domain/financial-analysis/index.js`; retire parity section with the shim |
| 2 | `application/g5/g5Service.ts` | `../financial-analysis/financialAnalysisService.js` | G5DecisionPanel.tsx:4,5 (type), :54 (type-position `import()`), Finance.tsx:33 (type), G5DeclarationEditor.tsx:11 (type) | 15 dom test files (value: `G5Service`) | migrate all → canonical `@/application/financial-analysis/financialAnalysisService` (exports `FinancialAnalysisService` + `G5Service` alias :569) |
| 3 | `application/finance/ownerEntitlementService.ts` | `../owner-money/ownerEntitlementService.js` | none | 17 dom test files | migrate tests → canonical; remove |
| 4 | `application/finance/withdrawalWalletGuard.ts` | — | **file absent** (removed Wave E / ADR-016; canonical at `application/owner-money/withdrawalWalletGuard.ts`) | — | record absence; nothing to do |
| 5 | `application/finance/expenseBudgetService.ts` | `../budgets/expenseBudgetService.js` | none (R5 migrated the last site to the budgets door) | none | **zero-consumer trigger fired** → remove with proof |
| 6 | `application/finance/correctionHistoryService.ts` | `../financial-records/correctionHistoryService.js` | none (composition root uses canonical :32) | 15 dom test files | migrate tests → canonical; remove |
| 7 | `application/finance/retainedDepositService.ts` | `../financial-records/retainedDepositService.js` | none (composition root canonical :83) | 19 dom test files | migrate tests → canonical; remove |
| 8 | `application/finance/recurringExpenseService.ts` | `../recurring/recurringExpenseService.js` | PrototypeServicesContext.tsx:216 (dynamic value) | DeepScreens.w43 + RecurringExpenseSurfaces tests | migrate dynamic import → `@/application/recurring/recurringExpenseService`; baseline key swap; remove |
| 9 | `application/finance/expenseRecordIntent.ts` | `../financial-records/expenseRecordIntent.js` | none | none | **zero-consumer trigger fired (R0-N5)** → remove with proof |
| 10 | `application/finance/expenseCategorySuggestions.ts` | `../financial-records/expenseCategorySuggestions.js` | none | none | **zero-consumer trigger fired (R0-N5)** → remove with proof |

**String references to clean same-PR at removal:** `scripts/file-size-ratchet-baseline.json` (10 entries incl. the absent #4? — verified: 9 present entries), `scripts/ui-application-import-baseline.json` (g5Service + recurringExpenseService keys), `scripts/check-module-boundaries.test.mjs` (domain/g5 + @micro-domain/g5 references), `tests/domain/public-surface.test.ts` (g5Compat parity), `storage/local/capabilities/shortCashDeclarationStore.ts:19-20` (comment mentioning domain/g5 — comment-only update), `docs/architecture/refactoring/OWNERSHIP-AND-TRUTH-REGISTRY.md` §8-3 fate table (dated update), register §2 rows (dated removal notes).

**Removal rule honored:** each shim is removed only in the same PR as (a) the last consumer migration, (b) the zero-consumer re-census, (c) baseline/registry cleanups. The domain g5 barrel and app g5Service shim are removed only after Finance/G5DecisionPanel/G5DeclarationEditor/test migrations land. Shims with a frozen consumer would stay as PRESERVE_BY_DESIGN — the census shows none remaining frozen after migration except none; all routes end in removal.

## 6. Slice plan (execution order)

- **R7-1:** P02 + P10 (Finance boundary + EventsLayer separation; F-019 dissolution proof).
- **R7-2:** P01, P03, P07 (order detail + two financial editors; separate sub-slices).
- **R7-3:** P04, P08, P09 (supplier/inventory editors + materials page).
- **R7-4:** P05, P06, P11 (owner, schedule, statement).
- **R7-5:** shim closure (units 1–3, 5–10 above) with per-unit zero-consumer proofs.
- **R7-6:** closure evidence: register/ownership/test-map updates, Operations Control JSON + views, current-state live fields + state-log, sequential worklog, final report + merge manifest; PR(s) left for owner review — NO merge.

## 7. Command chain (every implementation slice)

Focused suites first (per-card test lists), then: `pnpm operations-control:test`, `pnpm operations-control:check`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm text-density`, `pnpm design-guards`, `pnpm guards`, `pnpm test`, `pnpm prototype:check`, `pnpm prototype:test`, `pnpm prototype:build` (aggregate `pnpm check`); bundle guards `node scripts/check-bundle-budget.mjs` + `node scripts/check-bundle-surfaces.mjs`; structural surfaces `node scripts/check-module-boundaries.mjs`, `check-type-cycles.mjs`, `check-runtime-cycles.mjs`, `check-application-door-surfaces.mjs`, `check-application-readwrite.mjs`, `check-file-size-ratchet.mjs`, `check-doc-index-coverage.mjs`, `check-current-state-size.mjs`. Bundle measured before push (ADR-012 discipline).

---

## 8. Five read-only review gates — verdicts and reconciled amendments (2026-10-10)

All five gates ran read-only against the live tree at `e01d5605` on the R7 branch. Verdicts: **Boundary PASS_WITH_NOTES · Data/domain PASS_WITH_NOTES · Dependency/runtime PASS_WITH_NOTES · Tests/CI/ops PASS_WITH_NOTES · Hostile PASS_WITH_NOTES.** No reviewer mutated the branch. Amendments reconciled into the execution plan (binding for the slices):

1. **(R1/R3/R4) Line citation fix:** the F-019 value edge is `Finance.tsx:68` (FinancePeriodResultSection import); `:65` is EventsLayer. All slice evidence uses `:68`.
2. **(R1/R3) Door protocol for P02 — type-only widening, module-level functions:** the finance door (`application/finance/index.ts`) is statically imported by `PrototypeServicesContext.tsx:31+` into the **entry chunk**; gzip headroom is ≈617 B. Therefore only **type-only** exports (`FinanceState`, `FinanceBlockId`, `BridgeState`, `CashHorizonState`) may be added to the door; the assembly **functions** (`readFinanceOverview`, bridge/horizon readers, `safeBlock`) are exported from the module file `application/finance/financeState.ts` and consumed by the lazy Finance route chunk via a **deep import with a new documented `ui-application-import-baseline.json` key** (same-PR, dated reason). No value widening of the finance door.
3. **(R5) P02 symbol move/stay table (binding):** MOVE verbatim-in-logic: `FinanceBlockId`, `FinanceState`, `BridgeState`, `CashHorizonState`, `BlockRead`, `safeBlock`, the inline `pulseSafe` block (:275–282), the `Promise.all` assembly with `failedBlocks` classification (:283–369) including the pure status-membership derivations `completed`/`excludedOrders`/`ordersRecorded`/`finalOrdersRecorded` (:328–364 — evidence classification, not money math), and `monthBounds` (:172 — pure date bound helper, shared by page and module via export). STAY page-side: `useState`/`useEffect` glue, `active`-flag cleanup, `validMonth`/`currentMonth` (range input UI), the FIN-002 lazy `import()` sites, all rendering. The extraction is a **restructure** (useEffect body → injected-deps function), not a byte-verbatim move; behavior equivalence is proven by the journey suites and the unchanged read set/order.
4. **(R5) moneyLayerGuard extension for view-model modules:** the guard's part 1 scans pages/components/app only; the new `application/**` view-model modules would be unscanned. Slice R7-1 extends `moneyLayerGuard.contract.test.ts` with a pinned module list (financeState + every later view-model/editor-model file) at **zero** money-compute lines, so a view-model can never silently become a mirror dump. The pin applies to view-model modules only — application services legitimately compute money and stay out of this list.
5. **(R5) P10 dependency-correct split:** `FinancialEventRow` consumes module-scope `eventLabel` (:27), `expenseContextLabel` (:28), and `CorrectionMode` (:63) — all three move **with** the row into `components/finance/FinancialEventRow.tsx` (they have no other consumers), avoiding a back-import cycle. `familyEventOwner` (:69) moves with the row as well.
6. **(R1) P11 composition decision:** `PrototypeServicesContext` does **not** provide `StatementMarkdownService`; adding it would edit the composition root outside P11's allowed files. Binding design: the extracted view-model receives the markdown renderer as an **explicit injected parameter**; the page keeps the `:167` instantiation (stateless, read-only). F-022's composition-root normalization stays a documented track-T note; R7's structural improvement is the explicit parameterization (dependency visible in the view-model signature). No copy/presentation change.
7. **(R1) P03/P07 homes:** `application/financial-events/` does not exist; `application/finance/` already owns the event write path (`projectFinancialEventWrites.ts`) — the P03 editor model lands in `application/finance/financialEventEditorModel.ts` (same home as its write channel; no new door unless exports widen the finance door, which they must not beyond types). `application/direct-sales/` exists without a door: the P07 model is a deep module consumed via a new documented baseline key (same-PR), mirroring the existing `directSaleService.ts` deep-import precedent.
8. **(R3/R5) Mixed-SCC dissolution proof (P02 acceptance, corrected):** `check-type-cycles.mjs` (type-edge graph, baseline = storage pair) and `check-runtime-cycles.mjs` (value-edge graph, Finance SCC is documented exception #3) both pass before **and** after — neither detects the mixed SCC. The dissolution proof is therefore: (a) live census showing `FinancePeriodResultSection.tsx` imports `FinanceState` from `@/application/finance` (no `@/pages/Finance` import remains anywhere), (b) `Finance.tsx:68` value edge unchanged, (c) a fresh import-graph SCC scan (executor census tooling) showing no path back, and (d) the dated retirement of the STR-204c row in `OWNERSHIP-AND-TRUTH-REGISTRY.md` §5.
9. **(R5) Shim-cleanup completeness additions:** `scripts/check-runtime-cycles.mjs:10` and `scripts/text_density_policy.py:166` carry g5Service comment references — updated with the shim removal slice; the UI→domain **value** baseline (`check-module-boundaries.mjs:224–240`) needs **no** g5 key change (all migrating g5 imports are type-only — recorded so the executor does not guess); the registry §5 STR-204c row retirement is part of R7-6 records (amendment 8).
10. **(R3) R7-5 baseline-key swaps:** migrating the three g5Service production sites to `@/application/financial-analysis/financialAnalysisService` adds three **new** type-only keys to `ui-application-import-baseline.json` (path-based rule keys type imports too) with dated reasons, while removing the three old g5Service keys; `PrototypeServicesContext:216` swaps its `finance/recurringExpenseService` key for `recurring/recurringExpenseService`.
11. **(R5/R4) Visual-behavior pins:** per-slice evidence names the journey suites that assert rendered text (FinanceJourneys, group1Surfaces, G2, StatementPeriod.w173, OrdJourneys, G6, etc.) as the DOM-characterization pins; the full suites run on every slice head; `git diff` review confirms zero CSS/DOM/copy edits.
12. **(R5) Smoke-only pages discharge:** `SmokeOnlyPagesJourneys.dom.test.tsx:24–29,98–240` (merged W7, commit `ac114ac9`) already covers all six plan-§R7 pages (`CashReversalEditor`, `CashWalletEditor`, `G5DeclarationEditor`, `InventoryReversalEditor`, `ReceivedLoanDetail`, `SharePreview`) — recorded as the §R7 journey-completion discharge; R7 adds no duplicate journeys there, and `G5DeclarationEditor` gains only the shim-import migration (R7-5).
13. **(R2) Mirror-stay pins (binding for P04/P07/P09):** `editPreview`/`reversalPreview` useMemo blocks (SupplierPurchaseEditor :488–538), DirectSaleEditor `difference` derivation (:236) and render mirror (:888), and all other FROZEN_SURFACE sites stay page-side; the extracted models receive their outputs as parameters and never recompute them.
14. **(R2/R5) Scope-hygiene pins:** the only touches inside `src/domain/**` and `storage/**` path spaces in all of R7 are the R7-5 deletion of the `src/domain/g5/index.ts` re-export barrel itself and the comment-only update at `storage/local/capabilities/shortCashDeclarationStore.ts:19–21` (stale path reference to the deleted barrel) — both recorded here as the exact, complete boundary of R7 inside those trees.
15. **(R4) Commit discipline:** R7-0 outputs (this file + Operations Control JSON + regenerated views) are committed as the first R7 commit before any production slice, so CI gates the records; every slice that adds/moves test files regenerates `generated/test-map.json` same-PR (CI-enforced drift pin).

**Review-gate conclusion:** the plan is approved for implementation with the fifteen amendments above binding every slice. No blocker; no protected decision hidden; no STATE_DRIFT.
