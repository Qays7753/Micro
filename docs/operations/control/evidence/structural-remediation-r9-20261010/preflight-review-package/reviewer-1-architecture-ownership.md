# R9 Preflight — Reviewer 1: Architecture and Ownership (R9-PF-R1)

- **Reviewer:** general-purpose (Reviewer 1 — Architecture and Ownership)
- **Repo head reviewed:** `8b3c9aeb09ca33ed66f0a929c157b668839d0463` (== origin/main; verified `git log --oneline -1`, clean worktree)
- **Mode:** READ-ONLY. No file under the repo was modified; no checks/builds were executed (all guard "PASS" claims cited below come from R8 evidence reports committed on main, not from my own runs).
- **Method note:** per-house/per-area file and import counts were produced with `rg --files` / text-pattern import censuses (read-only). The authoritative import graph is the AST/resolution-based guard (`scripts/check-module-boundaries.mjs`); my census is an independent text-level cross-check labeled INFERRED where it substitutes for the guard.

---

## 0. Executive summary

| Dimension | Count (live, VERIFIED unless noted) |
|---|---|
| Domain areas (`src/domain/*/`) | **18** (55 prod files + 1 co-located test; 18/18 have `index.ts` barrels) |
| Domain tests | 36 files in `tests/domain/` + 1 co-located (`src/domain/direct-sale/policies.test.ts`) |
| Application houses (`application/*/`) | **36**; **29 with `index.ts` doors**, **7 doorless** (direct-sales, financial-analysis, formatting, identity, owner, profile, recurring); + 1 root prod file (`resultCodes.ts`) + 3 loose root test files |
| Application files | 146 prod (incl. doors) + 141 test files (138 in houses + 3 loose) |
| Storage layer (`storage/local/`) | 55 prod files (23 in local/ root incl. 9 pure commit guards + 32 in `capabilities/` = 16 stores + 16 anchors) + 47 test files (31 local/ + 16 capability contract tests) |
| Storage port | `PrototypeLocalStore` = **130 methods** (types.ts:429; counted); `localSchemaVersion=38` (types.ts:55), `localExportVersion=30` (types.ts:71) — protected values intact |
| Presentation | `App.tsx` (provider composition) → `app/MicroRouter.tsx` (**65 `<Route path=` entries**, 258 lines); **60 prod pages** + 13 page test files; components 69 prod + 15 tests (17 subdirs); `presentation/` 10 prod (3 Wave-B shims + 7 owned) + 7 tests; app-shell 11 prod + 7 tests; 74 root `*.dom.test.tsx` journeys |
| Contract docs | 49 files in `docs/contracts/` (01–43, 6 doubled numbers) |
| Door-surface baseline | 29 doors + 1 root file (`resultCodes.ts`) registered in `scripts/application-door-surfaces-baseline.json` |
| R6 deep-import baseline | **52 keys = 36 composition-root + 16 others** (3 presentation shims + 13 page/component edges) |
| File-size ratchet v2 | 488 files: **413 NORMAL / 52 WATCH / 14 SPLIT_CANDIDATE / 9 SPLIT_NOW** (live `file-size-ratchet-baseline.json`); re-anchor ledger = 3 entries (R8-3-RULE-R7, R8-4-CI-ANCHOR, R8-N1-ROOT-FIX) |

**Top findings (stale/mismatched evidence for the consolidated R9 report):**

1. **OWNERSHIP-AND-TRUTH-REGISTRY §3M doors row is stale:** says "43 retained keys = 36 composition root + 7 frozen compatibility surfaces"; live baseline has **52 = 36 + 16** (history: 120 →43 STR-615 →42 R5/S1 →43 R7-1 →46 R7-2 →49 R7-3 →52 R7-4/R7-5).
2. **§3M house counts stale for ≥13 houses** (R2/R7-era growth not regenerated; e.g. agreements 5→6 prod, inventory 11→12, suppliers 1→2, transfers tests 28→30).
3. **§3M doorless-houses row inaccurate:** names 4 doorless houses; live has **7**; and 2 of the 4 named (direct-sales, financial-analysis) have UI consumers beyond the composition root (baselined R6 keys).
4. **FILE-SIZE-REGISTER §1 summary ≠ §2 table:** §1 claims 757 rows (681/47/13/9/3/4); §2 contains **759 rows** (682/49/13/8/3/4) — +1 NORMAL, +2 WATCH, −1 SPLIT_NOW, never re-summed after R7 row additions.
5. **FILE-SIZE-REGISTER §2 has 9 dead rows** for files removed in R7-5 (`src/domain/g5/index.ts`, `application/g5/g5Service.ts`, `application/finance/{ownerEntitlement,correctionHistory,retainedDeposit,recurringExpense,expenseBudget,expenseRecordIntent,expenseCategorySuggestions}Service.ts`) still marked "NORMAL — frozen until the UI wave removes importers"; plus a stale row for the moved `finance/recurringExpenseService.test.ts`; and the **10 R7-created files have no §2 rows** (only dated notes on parent page rows).
6. **Register R8-2 dated note band split off-by-one** vs shipped baseline (414/51 vs 413/52; totals both 488).
7. **§7 money-message line inventory drifted** (e.g. craft-order policies :1180/1319/1396/1414/1491 → live :1195/1334/1411/1429/1506; §8-6's newer refs :1429/1506 are exact) — §7 lacks a dated supersession pointer.

Everything else verified clean: single-writer snapshot rule, 130-method port, 9 pure guards, 16 capability stores, R1–R7 baselines all match live code, component→page = 0 edges, application→presentation = 0 value edges, canonical money/date cores in place.

---

## 1. Feature → Module → Contract → Test → Owner map

### 1a. Domain areas (18) — `src/domain/**`

All 18 areas follow the uniform shape `types.ts` + `policies.ts` + `index.ts` (craft-order and financial-analysis have extra policy units). Read/write: domain is pure computation (no I/O) — classification below reflects what the area *computes* (read models vs write-policy decisions).

| Area | Public door | Prod files | R/W class | Canonical truth | Contract doc | Direct tests | Owner (registry §1) | Consumers (import census, prod) | Status |
|---|---|---|---|---|---|---|---|---|---|
| shared | `index.ts` (numeric/businessTime/currency) | 4 | both (money/date/qty kernels) | `domain/shared` | AGENTS §10; scale contract | `tests/domain/shared.test.ts`, `businessTime.test.ts`, `localDateArithmetic.test.ts`, `localDateValidityBoundaries.characterization.test.ts` | domain/shared (Shared Kernel) | 57 imports | PRESERVE — VERIFIED (`persistedMoneyTextMinor` currency.ts:31; `localDateInAmman` businessTime.ts:47) |
| craft-order | `index.ts` | 7 | both (settlement/delivery/classification policies) | `domain/craft-order` | 02/10/12 | 7 files (`craft-order*.test.ts`) + `moneyMessageCharacterization.test.ts` | domain/craft-order | 35 | PRESERVE — VERIFIED |
| financial-event | `index.ts` | 3 | both | `domain/financial-event` | 05 | `financial-event.test.ts` | domain/financial-event | 58 (most-consumed) | PRESERVE — VERIFIED |
| cash-continuity | `index.ts` | 3 | both | `domain/cash-continuity` | 03 | `cash-continuity.test.ts` | domain/cash-continuity | 31 | PRESERVE — VERIFIED |
| inventory-material | `index.ts` | 3 | both | `domain/inventory-material` | 06/11/28 | `inventory-material.test.ts`, `waste-context.characterization.test.ts` | domain/inventory-material | 27 | PRESERVE — VERIFIED |
| supplier-purchase | `index.ts` | 3 | both | `domain/supplier-purchase` | 07 | `supplier-purchase-corrections.test.ts` | domain/supplier-purchase | 13 | PRESERVE — VERIFIED |
| asset | `index.ts` | 3 | both | `domain/asset` | 43 | `asset.test.ts`, `assetResidual.test.ts` | domain/asset | 8 | PRESERVE — VERIFIED |
| loan | `index.ts` | 3 | both | `domain/loan` | 05 | `loan.test.ts` | domain/loan | 7 | PRESERVE — VERIFIED |
| received-loan | `index.ts` | 3 | both | `domain/received-loan` | 05 | `receivedLoan.test.ts` | domain/received-loan | 8 | PRESERVE — VERIFIED |
| direct-sale | `index.ts` | 3 (+1 test) | both | `domain/direct-sale` | 09 | co-located `policies.test.ts` | domain/direct-sale | 23 | PRESERVE — VERIFIED |
| owner-entitlement | `index.ts` | 3 | both | `domain/owner-entitlement` | 13 | (covered via owner-money suites + `tests/owner-entitlement.test.ts` per registry) | domain/owner-entitlement | 14 | PRESERVE — VERIFIED |
| owner-safe-withdrawal | `index.ts` | 3 | write-policy | `domain/owner-safe-withdrawal` | 13/14 | `owner-safe-withdrawal.test.ts` | domain/owner-safe-withdrawal | 1 (Finance.tsx:58 value edge, baselined R2) | PRESERVE — VERIFIED |
| recurring-expense | `index.ts` | 3 | both | `domain/recurring-expense` | 41 | `recurring-expense.test.ts` | domain/recurring-expense | 9 | PRESERVE — VERIFIED |
| recurring-margin | `index.ts` | 3 | read (margin read models) | `domain/recurring-margin` | 12/17 | `recurring-margin.test.ts`, `complex-six.characterization.test.ts` | domain/recurring-margin | 10 | PRESERVE — VERIFIED |
| budget | `index.ts` | 3 | both | `domain/budget` | 42 | `budget.test.ts` | domain/budget | 9 | PRESERVE — VERIFIED |
| catalog | `index.ts` | 3 | both | `domain/catalog` | 15 | `catalog.test.ts` | domain/catalog | 18 | PRESERVE — VERIFIED |
| actual-time | `index.ts` | 3 | both | `domain/actual-time` | 16 | `actual-time.test.ts` | domain/actual-time | 7 | PRESERVE — VERIFIED |
| financial-analysis | `index.ts` (ex-g5; g5 barrels REMOVED R7-5) | 4 (incl. `operatingBreakEven.ts`) | read (analysis/break-even/short-cash) | `domain/financial-analysis` | 12/17 | `financial-analysis.test.ts`, `operatingBreakEven.test.ts` | domain/financial-analysis | 11 | PRESERVE — VERIFIED; 2 documented R1 deep-import consumers of `operatingBreakEven` |

Domain structural facts (VERIFIED): 18/18 barrels; R4 cross-area deep imports frozen at exactly 3 pairs (`recurring-expense→financial-event/types`, `recurring-margin→inventory-material/{policies,types}` — script baseline lines 263–267, live files confirm the imports); no `src/domain/g5/` remains (R7-5 removal).

### 1b. Application houses (36) — `application/**`

Legend: door = `index.ts` present; exports = value+type symbols registered in `scripts/application-door-surfaces-baseline.json`; prod/tests = file counts excluding tests / test files (incl. `index.ts` in prod). R/W: W = write path (mutates store), R = read model, VM = view/editor model, MIX = both.

| House | Door (V/T symbols) | Prod | Tests | R/W | Canonical truth read | Contract | Owner concept | Status |
|---|---|---|---|---|---|---|---|---|
| finance | yes (16/29) | 29 | 25 | MIX (read models + writes + integrity) | domain via `@micro-domain` | 01/05/12/14/27/29/31/32/35/40 | Contract-40 financial reader | Split executed (Wave F: coordinator + 5 projectFinancial siblings + 8 integrity siblings; R7: financeState + statementViewModel + financialEventEditorModel) — VERIFIED |
| transfers | yes (0/5 — **types only**) | 11 | 30 | W (snapshot transfer/export/import) | storage snapshot + domain unions | 21/39 | application/transfers | PA-1 single-writer pair VERIFIED (only localTransferService + guidedOpeningImportService touch readSnapshot/replaceSnapshot: localTransferService.ts:147/239/309; guidedOpeningImportService.ts:213/354/369) |
| inventory | yes (3/9) | 13 | 5 | MIX | domain/inventory-material + capabilities | 11/28 | domain/inventory-material | Wave F split (coordinator 228 raw lines + 7 siblings) + R7 view/editor models — VERIFIED |
| fulfillment | yes (0/6) | 5 | 9 | MIX (order cycle writes) | domain/craft-order | 02 | domain/craft-order | R3 capability store consumer — VERIFIED |
| agreements | yes (5/4) | 7 | 5 | MIX | domain/craft-order | 20 (G7-A) | G7-A | +R7 orderDetailViewModel ( undocumented count drift, see §2) |
| scheduling | yes (1/7) | 6 | 4 | MIX | domain/craft-order (scheduling) | 07/19/22 | craft-order scheduling | +R7 scheduleViewModel |
| financial-records | yes (5/6) | 5 | 4 | MIX | domain + storage | 34 | Financial Records | Wave 4B move; R7 retainedDeposit/correctionHistory deep edges baselined |
| owner-money | yes (1/3) | 4 | 4 | W (owner ledger writer + guard) | domain/owner-entitlement | 13/14 | Owner Money cluster | Wave 4B move VERIFIED; +R7 ownerEntitlementViewModel |
| drafts | yes (5/2) | 5 | 3 | W | storage drafts | 36 | application/drafts | formDraftTestHarness = documented test-support surface |
| suppliers | yes (0/2) | 3 | 4 | MIX | domain/supplier-purchase | 09 | domain/supplier-purchase | +R7 supplierPurchaseEditorModel |
| collections | yes (0/9) | 4 | 3 | MIX | domain/craft-order | 02 | collection | — |
| cash | yes (5/3) | 4 | 3 | MIX | domain/cash-continuity | 10 | cash-continuity | +R2 cashCountMessages (M-10/D11) — door widened same-PR per PC-3, VERIFIED in door header |
| loans | yes (1/5) | 3 | 3 | MIX | domain/loan + received-loan | 29 | Group 4 | +ammanBusinessDateBoundary.test (R2) |
| input | yes (10/1) | 2 | 4 | R (parse/echo) | — (pure) | 27 | guided entry | formatEnglishQuantityEcho (M-07) VERIFIED |
| catalog | yes (0/3) | 3 | 3 | MIX | domain/catalog | 15 | catalog | — |
| time | yes (1/2) | 3 | 2 | R (clock/today) | domain/shared businessTime | 16 (D-044) | time boundary | todayInAmman first value through door (M-11/D13) VERIFIED (time/index.ts) |
| preferences | yes (0/2) | 3 | 2 | W | storage (3 localStorage records) | 19-adjacent | preferences | imports `@/storage/local/persistentStorage` (documented, non-UI-rule) |
| home | yes (0/5) | 3 | 2 | R | OrderLifecycleStore | H01A | home | — |
| diagnostics | yes (2/0) | 3 | 2 | R | storage | 36-adjacent | diagnostics | — |
| parties | yes (1/2) | 2 | 2 | R | storage parties | 18-adjacent | parties | — |
| direct-sales | **no door** | 2 | 2 | MIX | domain/direct-sale | 09 | direct-sale | deep imports baselined (PSC + pages/DirectSaleEditor) |
| cost | yes (0/2) | 2 | 2 | W (cost snapshot) | domain/craft-order | 03 | cost snapshot | priceDate local-date policy (M-04) |
| activity | yes (0/4) | 3 | 1 | R | storage financial events | 30 | unified activity reader | — |
| estimates | yes (0/2) | 2 | 1 | W | capabilities costEstimateStore | 03 | estimates | STR-403 naming fixed |
| budgets | yes (1/3) | 2 | 1 | W | capabilities expenseBudgetStore | 42 | budget | — |
| assets | yes (0/3) | 2 | 1 | MIX | capabilities assetStore | 43 | asset | — |
| financial-pulse | yes (0/2) | 2 | 1 | R | OrderLifecycleStore | STR-619 row | financial pulse | row added Wave G2 VERIFIED (74 nbLOC register vs 80 raw live — within drift) |
| financial-analysis | **no door** | 1 | 2 | R | domain/financial-analysis | 12/17 | financial-analysis | 4 baselined deep keys (PSC, G5DecisionPanel, Finance, G5DeclarationEditor) |
| follow-up | yes (0/2) | 2 | 1 | R | storage | 20 (G7-A) | follow-up | — |
| formatting | **no door** | 1 | 1 | R (display formatting) | — | ADR-011 §2 | formatting core | UI goes via `presentation/formatters.ts` shim (67 files) — VERIFIED; only the shim itself deep-imports the house |
| home/identity | **no door** | 1 | 1 | R (build identity) | storage identity | — | activity identity | consumed only by PSC + application internals |
| owner | **no door** | 1 | 1 | R (owner profile) | storage | 13-adjacent | owner | PSC-only consumer |
| profile | **no door** | 1 | 1 | W (activity profile) | storage profile | 01-adjacent | profile | PSC-only consumer |
| recurring | **no door** | 1 | 1 | W (recurring expense) | capabilities recurringExpenseStore | 41 | recurring-expense | PSC + application internals |
| security | yes (2/0) | 2 | 1 | W (local lock) | storage (localStorage) | 37 | local app lock | — |
| share | yes (2/1) | 2 | 1 | R (share text) | read models | 33 | manual share | — |
| root files | `resultCodes.ts` (registered root file) | 1 | 3 loose tests (`reentrancyGuards`, `supplierScheduleConcurrency`, `supplierScheduleStaleResults`) | R (codes) | — | — | guarded by door-surface root-file rule |

### 1c. Storage layer — `storage/local/**`

| Surface | Files | R/W | Canonical truth | Contract/tests | Owner | Status |
|---|---|---|---|---|---|---|
| `IndexedDbLocalStore.ts` (4,137 raw lines) | 1 | both (adapter, 130 methods) | `types.ts` port | 10 direct test files + adapterConformance suites | storage | PRESERVE (full-exception card W6; family split: Stores/Migrations/Lifecycle/Snapshot/Primitives) — VERIFIED |
| `MemoryLocalStore.ts` (2,095 raw) | 1 | both (mirror) | same | 178 direct test consumers per register (register row) | storage | PRESERVE (same exception basis) |
| Port `types.ts` (884 raw) | 1 | contract | itself | 69 direct tests per register | storage | PRESERVE (R6-SCAN-F-011); 97 prod importers (census) |
| `capabilities/` | 48 (16 stores + 16 anchors + 16 contract tests) | narrow ports (Pick) | `types.ts` | 16 `*.contract.test.ts` (both adapters) | storage per area | R3 extraction complete for 16 groups — VERIFIED (all 16 store files exist; consumed by application houses: orderLifecycleStore×9, inventoryMaterialStore×6, ownerEntitlementStore×3, loanStore×3, 8 more ×1–2) |
| Commit guards (9 pure units) | 9 | write guards | — | co-located tests (8/9 have `.test.ts`) | storage | VERIFIED count exactly 9: cashContinuity, deliveryReversal, expenseBudget, loan, order, receivedLoan, recurringExpense, supplierAttribution, supplierSchedule |
| Migrations/snapshot/lifecycle/primitives/stores | 5 | writers (schema + snapshot engine) | — | via adapter suites | storage | indexedDbSnapshot = the readSnapshot/replaceSnapshot transaction engine (PA-1) |
| `persistentStorage.ts` | 1 | W (navigator.storage) | — | `persistentStorage.test.ts` | storage | consumed by StartupGate (documented R5 exception) + preferences |
| `createBrowserLocalStore.ts` | 1 | factory | — | — | storage | consumed by PrototypeServicesContext (documented R5 exception) |
| Snapshot transfer service | `application/transfers/localTransferService.ts` + `guidedOpeningImportService.ts` | W (the only snapshot writers) | envelope contract 39 | 30 test files in transfers | application/transfers | PA-1 single-writer VERIFIED (only these 2 files call readSnapshot/replaceSnapshot in prod) |

### 1d. Presentation entry points

| Surface | Entry | Count | Notes |
|---|---|---|---|
| Root composition | `App.tsx` (23 nbLOC) | 1 | ErrorBoundary → PrototypeServicesProvider → ThemeProvider(light default, W5/D1) → MicroRouter — VERIFIED (App.tsx:1–20) |
| Router | `app/MicroRouter.tsx` | 65 `<Route path=…>` (258 lines) | lazy pages; gates: StartupGate → AppLockGate (contract 37); `OwnerWithdrawalLegacyRedirect` (EXE-009) |
| Pages | `pages/*.tsx` | 60 prod + 13 tests | largest: OrderDetail 1,869 raw, Finance 1,500, FinancialEventEditor 1,205 (SPLIT_NOW/SPLIT_CANDIDATE dispositions with R7 executed notes) |
| Components | `components/**` (17 subdirs + ErrorBoundary) | 69 prod + 15 tests | 0 component→page imports — VERIFIED (empty rg over components for `@/pages/`) |
| Presentation layer | `presentation/*` | 10 prod + 7 tests | 3 Wave-B shims (`formatters`, `activityLabels`, `orderAgreementPresentation` — each `export * from @/application/...`, removal = T track) + 7 owned modules (`cashCountMessages` instant display text, `plurals`, `stateAdapter` (ADR-003, zero application imports), `financialEventLabels`, `catalogPresentation`, `ownerEntitlementPresentation`, `g5Plurals`) |
| App shell | `app/*` | 11 prod + 7 tests | navigationContract (EXE-016 param registry), routeClassifier, CapabilityRouteGate, quickRecording (context :23), PrototypeServicesContext (channels, §2 row 18) |
| Journey tests | client/src root | 74 `*.dom.test.tsx` (+100 root tests total) | route-feature coverage evidence |

---

## 2. Registry accuracy — OWNERSHIP-AND-TRUTH-REGISTRY.md (v1.3, 311 lines)

Structure: §1 domain concept map (18 areas + allocations row = 19 rows); §2 storage port inventory (130 methods / 22 capability groups); §3 finance service clusters (6 clusters); §3M non-finance house ownership rows + STR-619 rows; §4 duplicated value-union ledger; §5 deep-import/cycle/waiver exception ledger; §6 open owner decisions; §7 domain money-message ownership (W2); §8 PA-1..PA-4 operational surfaces (§8-1 channels, §8-2 single write path, §8-3 retirement registry, §8-4 language/formatting ownership, §8-5 date validity owner, §8-6 money text conventions).

**22 rows/claims verified against live code (≥15 required):**

| # | Registry claim | Live evidence | Verdict |
|---|---|---|---|
| 1 | §1: 18 domain areas, all owned | 18 dirs, 18 barrels (Glob) | VERIFIED |
| 2 | §1: owner-safe-withdrawal consumed by Finance.tsx (STR-304 value edge) | R2 baseline key + `pages/Finance.tsx:58` import | VERIFIED |
| 3 | §1: financial-analysis is canonical name (ex-g5) | dir exists; `src/domain/g5/` absent | VERIFIED |
| 4 | §2: port = 130 methods | `types.ts:429` interface — counted 130 method signatures | VERIFIED |
| 5 | §2: 9 pure standalone guard units | exactly 9 `*CommitGuard.ts` files | VERIFIED |
| 6 | §2: 16 extracted capability stores (R3) | 16 `*Store.ts` in capabilities/ | VERIFIED |
| 7 | §2: snapshot pair single-writer (PA-1) | only localTransferService.ts:147/239/309 + guidedOpeningImportService.ts:213/354/369 | VERIFIED |
| 8 | §3: projectFinancialService split → coordinator + 5 siblings | live coordinator 167 raw lines; siblings Types/Reads/PeriodReads/Insights/EventWrites exist | VERIFIED |
| 9 | §3: integrityCheckService split → coordinator + 8 siblings | live 207 raw; 8 `integrityCheck*` siblings exist | VERIFIED |
| 10 | §3M: financialPulseService 75 nbLOC, OrderLifecycleStore consumer | file exists (80 raw lines), consumes orderLifecycleStore | VERIFIED (within drift) |
| 11 | §5 R1: exactly 3 deep domain imports | script baseline (lines 224–228) = 3; live files match | VERIFIED |
| 12 | §5 R2: 15 UI→domain value edges | script baseline 15 keys; live spot-checks all present (CostEditor.tsx:5, Finance.tsx:58, OrderDetail.tsx:21/47-49, OwnerEntitlement.tsx:43, DirectSaleEditor.tsx:21, AssetDetail.tsx:19, Catalog.tsx:9, InventoryMaterials.tsx:34, AllocationReviewCard.tsx:8, quickFormHelpers.ts:2, EventEffectPreview.tsx:9, ExpenseBudgetsSectionBody.tsx:18, catalogPresentation.ts:8, ownerEntitlementPresentation.ts:9); suspicious others (RecurringExpenseDetail, Catalog:57, FinancialEventEditor:58, OwnerPolicy/LedgerFormsSection) are **type-only** — not R2 edges | VERIFIED |
| 13 | §5 R3: 0 application→presentation value edges | empty baseline; presentation shims re-export *from* application (correct direction) | VERIFIED |
| 14 | §5 R4: 3 domain cross-area deep pairs | script baseline lines 263–267; live imports present | VERIFIED |
| 15 | §5 R5: 2 UI→storage value edges | StartupGate.tsx:6; PrototypeServicesContext (createBrowserLocalStore) | VERIFIED |
| 16 | §7/§8-6: persistedMoneyTextMinor canonical, 5 stored writers | currency.ts:31; writers: craft-order policies.ts:1429/1506, deliveryReviewService.ts:605, cashCountMessages.ts (2 builders :12/:18-19) | VERIFIED (§8-6 line refs exact; §7 line refs stale, see below) |
| 17 | §8-6: 11 frozen throw embeddings (policies×3, loan×2, received-loan×2, deliveryContribution×4) | policies.ts:1195/1334/1411; loan/policies.ts:82 (2 embeddings); received-loan/policies.ts:106 (2); deliveryContribution.ts:47-49 (4) | VERIFIED (count exact; line refs drifted) |
| 18 | §8-1: channels inventory (context :160, dataVersion :157/:165, BroadcastChannel :162/:171; QuickRecording :23; UnsavedChanges :15; ThemeContext :18) | all line numbers match live files exactly | VERIFIED |
| 19 | §8-1: usePrototypeServices "60+ files" | 72 non-test files import it | VERIFIED (understated, not wrong) |
| 20 | §8-1 negative census (no 2nd BroadcastChannel, no prod CustomEvent/EventTarget dispatch, no storage listeners) | rg censuses: exactly 1 BroadcastChannel file; 0 others | VERIFIED |
| 21 | §8-5: unified date core | `localDateInAmman` businessTime.ts:47 + `check-date-arithmetic-ownership.mjs` guard (R4/R5/R6 rules) | VERIFIED |
| 22 | §8-3: all 9 application shims removed (R7-5) | no `application/g5/`, no `finance/*Service` shims, no `src/domain/g5/` | VERIFIED (but see register staleness below) |

**STALE / MISMATCHED / INACCURATE rows (exact evidence):**

| # | Row | Registry says | Live tree says | Class |
|---|---|---|---|---|
| A | §3M doors row (line ~113) | R6 ratchet = "43 keys = 36 composition root + 7 frozen compatibility surfaces" | `scripts/ui-application-import-baseline.json` = **52 keys = 36 PSC + 16** (3 presentation shims + 13 page/component edges; 9 added by R7 P01–P11, 4 legacy). Git history: 2659a8ad 120 → 086c1d4d 43 → e085addc 42 → adad399a 43 → c86c4f2c 46 → c0fe0df2 49 → 4d60d1bc/bfa48d44 52 | **STALE** (R7-era updates never propagated to this row) |
| B | §3M house count columns | e.g. agreements 5/4; budgets 2/1; cash 2/2; cost 1/1; direct-sales 1/1; formatting 1/0; input 1/3; inventory 11/3; loans 2/2; scheduling 4/3; suppliers 1/3; time 2/1; transfers 10/28 | live (excl. index.ts): agreements 6/5; budgets **1**/1; cash 3/3; cost 1/**2**; direct-sales **2/2**; formatting 1/**1**; input 1/**4**; inventory **12/5**; loans 2/**3**; scheduling **5/4**; suppliers **2/4**; time 2/**2**; transfers 10/**30** | **STALE** (documented-as-regeneration-pending; 13 houses affected) |
| C | §3M doorless-houses row | doorless = direct-sales, financial-analysis, owner, profile ("only consumer is composition root") | doorless = **7** (+ formatting, identity, recurring); direct-sales has UI consumer `pages/DirectSaleEditor.tsx` → directSaleEditorModel (baselined key); financial-analysis has 3 UI consumers (G5DecisionPanel, Finance.tsx, G5DeclarationEditor.tsx) | **MISMATCHED** (both count and consumer claim) |
| D | §7 line inventory | craft-order policies :1180/1319/1396/1414/1491; loan :78; received-loan :101 | live: throws :1195/1334/1411; stored notes :1429/1506 (now via `persistedMoneyTextMinor`); loan :82; received-loan :106 | **STALE** (superseded by §8-6 refs which are exact; §7 lacks dated supersession note) |
| E | §8-6 | deliveryReviewService:593 | live :605 (Δ+12) | STALE (minor line drift) |
| F | §2 footnote re: guard-concept names vs 9 file units | self-documenting correction (STR-606) | consistent | OK (no action) |

No DUPLICATE rows found (each concept has exactly one row; g5 rows were removed with the shims).

---

## 3. File-size register — FILE-SIZE-AND-RESPONSIBILITY-REGISTER.md (v1.5, 1,539 lines)

- **Structure:** §1 band summary; §2 full table (path/cat/nbLOC/raw/bytes/exports/imports/consumers/tests/band/owner/action/flags); §3 high-risk file cards; §4 additional professional surfaces; §5 growth-control rules; §6 limits; §7 dated re-measurement updates; §8 R6-SCAN-F-001..027 permanent matrix + R8 dated updates (R8-1 :1495, R8-2 :1497, R8-3 :1499, R8-N1 :1501).
- **§1 summary (as written):** NORMAL 681 / WATCH 47 / SPLIT_CANDIDATE 13 / SPLIT_NOW 9 / PRESERVE 3 / LARGE_TEST 4 = 757; categories config=21, fixture=29, generated=7, production=343, script=20, test=337.
- **§2 actual table (my count of rows):** **NORMAL 682 / WATCH 49 / SPLIT_CANDIDATE 13 / SPLIT_NOW 8 / PRESERVE 3 / LARGE_TEST 4 = 759 rows** → **internal §1↔§2 mismatch** (+1 NORMAL, +2 WATCH, −1 SPLIT_NOW, +2 total). Cause: R7-era row additions (e.g. `FinancialEventRow.tsx` WATCH card) never re-summed into §1; the −1 SPLIT_NOW is unexplained by any dated note I could find. **Action for R9: re-sum §1 from §2 or regenerate.**
- **SPLIT_NOW files (8 live §2 rows) and dispositions:** `index.css` (6,778 nbLOC — UI_OUT_OF_SCOPE, design-token guards govern); `pages/OrderDetail.tsx` (R7-2 package executed — orderDetailViewModel); `transfers/transferFamilyValidators.ts` (1,718 nb — ADR-017 PRESERVE-by-decision, band left SPLIT_NOW); `pages/Finance.tsx` (R7-1 executed — financeState); `finance/projectFinancialService.ts` (Wave F split — historical row values, live coordinator 167 raw); `finance/integrityCheckService.ts` (Wave F split — live 207 raw); `inventory/inventoryMaterialService.ts` (Wave F slice 3 — live 228 raw); `pages/FinancialEventEditor.tsx` (R7-2 executed — financialEventEditorModel). §1 claims 9 — one-row discrepancy vs §2 (see above).
- **PRESERVE (3):** `IndexedDbLocalStore.ts` (4,135 nb), `MemoryLocalStore.ts` (2,091 nb), `src/domain/craft-order/policies.ts` (1,399 nb; dated note: live 1,413 at R6-W1). All three have full 9-element exception cards — VERIFIED present.
- **SPLIT_CANDIDATE (13):** transferSnapshotValidation (R4-C2 PRESERVE-by-review), SupplierPurchaseEditor (R7-3 executed), OwnerEntitlement.tsx (R7-4 executed), owner-money/ownerEntitlementService (cluster home settled 4B), Schedule.tsx (R7-4 executed), DirectSaleEditor.tsx (R7-2 executed), InventoryMovementEditor.tsx (R7-3 executed), domain/financial-analysis/policies.ts (R6-W1 PRESERVE), domain/owner-entitlement/policies.ts (R6-W1 PRESERVE), storage/local/types.ts (R6-SCAN-F-011 PRESERVE, Wave O gated), InventoryMaterials.tsx (R7-3 executed), Statement.tsx (R7-4 executed), scripts/text_density_policy.py (R6-W3 engine/policy split).
- **Re-anchor ledger (`scripts/file-size-ratchet-reanchors.json`, 3 entries — all R8):** `R8-3-RULE-R7` (check-module-boundaries.mjs 398 NORMAL → 431 WATCH); `R8-4-CI-ANCHOR` (bundle-surfaces-baseline.json 76 → 108 NORMAL); `R8-N1-ROOT-FIX` (check-bundle-surfaces.mjs 457 → 467 WATCH). Register §7 carries matching dated notes (R8-2/R8-3/R8-N1 at :1497/:1499/:1501; R8-4 documented inside R8-2's narrative and the d946db5e commit). **R8-2's stated seed "414 NORMAL / 51 WATCH" ≠ shipped baseline "413 / 52"** (totals both 488; one-file NORMAL↔WATCH difference, unexplained) — MINOR.
- **Live ratchet v2 baseline:** 488 files, 413/52/14/9 by band; head `c70d3eed`; category coverage = production+script only (guard data excluded by design).
- **nbLOC/raw spot-checks (wc -l vs register "raw"):** IndexedDbLocalStore 4,137 vs 4,139 (−2); MemoryLocalStore 2,095 vs 2,099 (−4); OrderDetail 1,869 vs 1,870 (−1); transferFamilyValidators 1,745 vs 1,733 (+12); Finance 1,500 vs 1,498 (+2); FinancialEventEditor 1,205 vs 1,206 (−1); Statement 813 vs 814 (−1); FinancialEventRow 750 vs 751 (−1); types.ts 884 vs 885 (−1); split coordinators match documented post-split sizes (projectFinancialService 167 raw ≈ 146 nb; integrityCheckService 207 ≈ 180 nb; inventoryMaterialService 228 ≈ 181 nb). **Verdict: register matches live within ±12 raw lines for never-split files; split files match their documented post-split state; the ratchet v2 baseline (488 exact nbLOC) is the live governing census.**
- **Dead/stale §2 rows (files deleted in R7-5, rows not updated):** lines 348 (`src/domain/g5/index.ts`), 351 (`application/g5/g5Service.ts`), 352 (`finance/expenseBudgetService.ts`), 353 (`finance/expenseRecordIntent.ts`), 354 (`finance/ownerEntitlementService.ts`), 357 (`finance/correctionHistoryService.ts`), 358 (`finance/expenseCategorySuggestions.ts`), 359 (`finance/retainedDepositService.ts`), 61 (`finance/recurringExpenseService.ts` compat-unit note, file gone) — all still read "NORMAL — frozen until the UI wave removes importers". Line 360 (`finance/withdrawalWalletGuard.ts`) correctly carries a dated removal note (Wave E). Additionally line 411 (`finance/recurringExpenseService.test.ts`) points at the pre-Wave-E path (test now lives at `application/recurring/`). **The 10 R7-created files (financeState.ts + 9 view/editor models) have no §2 rows** — they appear only inside parent rows' dated notes (FinancialEventRow.tsx is the only R7 file with its own row). R7-5's report (evidence dir) proves the 9 removals with zero-consumer census; the register itself was not reconciled.

---

## 4. Public doors and deep imports

### 4a. Door-surface guard (`scripts/check-application-door-surfaces.mjs`, 147 nbLOC NORMAL)

- **Enforcement:** every `application/**/index.ts` (any depth) must export exactly its baseline-registered value+type symbols; `export *` / `export * as ns` in doors forbidden; new door / new root production file / stale baseline row = fail. Fail-closed on missing baseline. (Read from source, lines 100–136.)
- **Baseline inventory (`scripts/application-door-surfaces-baseline.json`):** **29 doors + 1 root file** (`resultCodes.ts`). Symbol totals: 66 values / 111 types across doors; largest surfaces: finance (16V/29T), input (10V/1T), agreements (5V/4T), cash (5V/3T), drafts (5V/5T), financial-records (5V/6T). transfers door is **types-only** (0V/5T) — the door exists for lazy-fragment type imports while values are composed at the root (documented in door header).
- **7 doorless houses:** direct-sales, financial-analysis, formatting, identity, owner, profile, recurring (formatting/identity/recurring have no UI page consumers at all — PSC/internal only; direct-sales and financial-analysis have baselined UI deep edges).

### 4b. Boundary guard (`scripts/check-module-boundaries.mjs`, 431 nbLOC WATCH, 7 rules)

Rules extracted from source (lines 1–59 + baselines): R1 deep domain imports (3-key baseline); R2 UI→domain value (15-key baseline, STR-106 frozen); R3 application→presentation value (0-key baseline, closed by Wave B); R4 domain cross-area deep (3-pair baseline); R5 UI→storage value resolution-based (2-key baseline: StartupGate/PrototypeServicesContext with UI-path removal conditions); R6 UI→application-interior deep (file-based ratchet `scripts/ui-application-import-baseline.json`, monotonic shrink with same-PR documented exceptions); R7 component→page (all import forms, resolution-based; **explicit empty owner-reviewed exception list** — no drift-baseline).

### 4c. Live deep-import census (my independent text census, INFERRED; guard is authoritative)

- UI-layer `@/application/*` import statements: **253 total = 190 door + 63 deep** (excl. tests; door imports cover all 29 doors).
- The 63 deep statements resolve to exactly the **52 baselined keys** (PSC keys appear as both static and dynamic statements) → **0 undocumented deep imports** in text census.
- Classification of the 52 keys:
  - **Allowed (door rule)**: 190 door import statements — no action.
  - **Documented exception — DI composition root (36 keys)**: `app/PrototypeServicesContext.tsx` → implementations (documented in registry §3M doors row + door headers; budget-isolated lazy construction).
  - **Documented exception — presentation shims (3 keys)**: `presentation/{formatters,activityLabels,orderAgreementPresentation}` → application houses (Wave B/ADR-011 §2; removal = T track).
  - **Baselined legacy page edges (4 keys)**: G5DecisionPanel→financialAnalysisService; Finance→financialAnalysisService; G5DeclarationEditor→financialAnalysisService; DirectSaleEditor→directSaleEditorModel (STR-615-era keys; owner decision pending).
  - **R7-added page edges (9 keys)**: Finance→financeState; FinancialEventEditor→financialEventEditorModel; InventoryMaterials→inventoryMaterialsViewModel; InventoryMovementEditor→inventoryMovementEditorModel; OrderDetail→orderDetailViewModel; OwnerEntitlement→ownerEntitlementViewModel; Schedule→scheduleViewModel; Statement→statementViewModel; SupplierPurchaseEditor→supplierPurchaseEditorModel (each documented in the R7 execution reports and the register's per-page dated notes; same-PR baseline updates per guard protocol).
- **Forbidden:** 0 live edges in the census; component→page = **0** (rg over components for `@/pages/` — empty; matches R7 rule and registry §5 "أُغلقت R7/P02"); application→presentation value = **0**.

---

## 5. Change locality assessment

**Clean boundaries (evidence):**

1. **Domain layer:** 18 self-contained areas with barrels; cross-area deep imports frozen at 3 documented pairs (R4 baseline); no domain→UI/application/storage dependencies (layer rule; INFERRED from import census — domain imports only within `src/domain`).
2. **Snapshot write path (PA-1):** exactly 2 production consumers of readSnapshot/replaceSnapshot, both in application/transfers — VERIFIED.
3. **Application→presentation inversion:** 0 value edges; formatting vocabulary lives in application houses with 3 presentation shims re-exporting (correct direction) — VERIFIED.
4. **Component→page:** 0 edges; the Finance-cycle regression class is guarded (R7) and the former cycle is dissolved (FinancePeriodResultSection.tsx:11 consumes FinanceState via the finance door) — VERIFIED.
5. **Storage port discipline:** one 130-method port interface; 16 narrow capability stores; 9 pure commit guards; adapters parity-proven via conformance suites — VERIFIED.
6. **Money/date text cores:** `persistedMoneyTextMinor` (currency.ts:31) and `localDateInAmman` (businessTime.ts:47) are single canonical sources with dedicated guards (`check-date-arithmetic-ownership.mjs`; money-layer count guard per §8-6) — VERIFIED.
7. **Door surfaces:** 29 doors exporting only UI-consumed symbols; surface widening = fail (PC-3) — VERIFIED (guard + baseline).

**Remaining mixed-responsibility / unfinished surfaces (evidence):**

1. **7 doorless houses** force deep imports (16 non-PSC baselined keys); door migration or documented door-less design decision outstanding.
2. **15 frozen UI→domain value edges** (STR-106; ADR-011 §1 target 13→0 on the UI track) — pages still call domain functions directly.
3. **3 presentation shims** awaiting T-track consumer migration (67 files still import `presentation/formatters`).
4. **Large pages remain**: OrderDetail 1,869 / Finance 1,500 / FinancialEventEditor 1,205 raw lines — R7 extracted state/decision logic, but page-level composition splitting is explicitly out of structural scope (UI track); `index.css` 6,778 nbLOC SPLIT_NOW governed by design-token guards.
5. **`storage/local/types.ts`** (884 raw, 97 prod importers) — Wave O owner decision pending on any split.
6. **finance + transfers houses carry the heaviest coupling**: 29+11 prod files, cross-house deep reads (documented), transferFamilyValidators 1,745 raw PRESERVE-by-decision.
7. **Documentation-layer staleness** (this review's findings A–E, register dead rows) — the records themselves are now the largest reconciliation debt for R9.

**Could not verify (UNVERIFIED):**

- Actual guard execution results on this head (I did not run `node scripts/check-*.mjs` per read-only constraints; PASS evidence is cited from R8 execution reports and CI runs recorded on main).
- `tests/domain/` per-area test-file attribution for a few areas (owner-entitlement, catalog) — registry names files I did not individually open; file existence of the named suites is VERIFIED via directory listing.
- Exact `nbLOC` (non-blank) values for spot-checked files (I measured raw `wc -l`; nbLOC comparisons rely on register's own raw column and the ratchet baseline values).
- The precise file whose band differs between the R8-2 note (414/51) and the shipped baseline (413/52).

---

## 6. Recommended R9 inputs (for the consolidator)

1. Treat the **live guard baselines** (`application-door-surfaces-baseline.json`, `ui-application-import-baseline.json`, `file-size-ratchet-baseline.json` + reanchors) as ground truth; reconcile the three documentation artifacts to them: OWNERSHIP registry §3M doors row (43→52, doorless 4→7), §3M house counts (13 rows), §7 line inventory (supersede with §8-6 refs); FILE-SIZE register §1 re-sum (757→759 or regenerate), 9+2 dead/moved §2 rows, missing §2 rows for 10 R7 files, R8-2 band-split note.
2. The R7-5 shim removal is fully executed in code and baselines but only partially in the file-size register — a dated-corrections pass (same protocol as R6-W1) would close it.
3. No architectural blockers found for R9: no undocumented boundary edges, no ownership gaps (every concept row has an owner), protected constants intact (schema 38 / export 30).
