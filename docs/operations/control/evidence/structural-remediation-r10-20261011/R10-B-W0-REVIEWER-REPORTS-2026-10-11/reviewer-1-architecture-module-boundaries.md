# R10-B Reviewer 1 (RV1) — Architecture / Module Boundaries / Sources of Truth

- **Role:** RV1 — architecture, module boundaries, duplicated types/unions/interfaces, IDs, policies, literals, calculations, responsibility leaks, deep imports, cycles, shims, large-file seams, target module map.
- **Repository:** `/home/z/my-project/r10b/clone`, branch `main`.
- **SHA verified:** `git -C /home/z/my-project/r10b/clone rev-parse HEAD` → **`ffc54eb1150932c9bba88b48a7c38275f2a3effa`** (matches the expected HEAD exactly). Working tree clean (`git status --short` empty), branch `main`.
- **Date:** 2026-10-11 (14:29 UTC).
- **Read-only statement:** This review was performed exclusively with Read/Grep/Glob and read-only `python3`/`rg`/`git log`/`sed`/`ls` one-liners. No file inside the clone was created, modified, deleted, staged, installed, built, or tested. The only writes were this report under `/home/z/my-project/r10b/scratch/reviewers/`.
- **Context hygiene:** the R10-A package at `scratch/r10a-package/…/structural-remediation-r10-20261011/` was touched only to enumerate claim IDs (`R10-A-EVIDENCE-LEDGER…json`, one listing + one JSON key scan). Every conclusion below comes from my own inspection of the live code at the verified HEAD.

---

## 2. Commands actually executed (all read-only)

1. `git -C …/clone rev-parse HEAD`; `git status --short`; `git branch --show-current`
2. `git log --oneline/--format --diff-filter=D -- <path>` for `application/finance/recurringExpenseService{,.test}.ts`, `src/domain/g5/index.ts` (deletion-commit verification)
3. `ls` / `ls -d` over repo root, `src/domain`, `apps/prototype-web/client/src/{application,storage/local,storage/local/capabilities,application/*/}`, `scripts/`, `docs/`
4. `Read` (full-file) of: `src/domain/inventory-material/types.ts`, `application/inventory/inventoryMovementEditorModel.ts`, `app/useDisabledCapabilities.ts`, `components/settings/SettingsCapabilitiesSection.tsx`, `apps/prototype-web/ARCHITECTURE.md`, `scripts/ui-application-import-baseline.json`, `scripts/check-module-boundaries.mjs`, `scripts/check-type-cycles.mjs` (header+baseline), `scripts/check-runtime-cycles.mjs` (header), `src/domain/shared/currency.ts`, `docs/architecture/ADRs/ADR-018-public-doors-terminal-architecture.md`, `FILE-SIZE-AND-RESPONSIBILITY-REGISTER.md` (targeted ranges), `application/suppliers/supplierPurchaseEditorModel.ts`, `components/finance/expenseFormModel.ts`, `application/inventory/materialSuggestions.ts`, `application/inventory/inventoryMaterialModel.ts` (head), `application/inventory/inventoryMaterialWaste.ts` (head), `storage/local/capabilities/inventoryMaterialStore.ts` (head), `application/preferences/preferenceService.ts` (targeted), `storage/local/types.ts` (targeted), `application/resultCodes.ts`, `storage/local/resultCodes.ts`, `scripts/check-date-arithmetic-ownership.mjs` (header), `moneyLayerGuard.contract.test.ts` (head), `pages/InventoryMovementEditor.tsx` (targeted), `contexts/ThemeContext.tsx` (head)
5. `Grep`/`rg` searches: `readDisabledCapabilities|saveDisabledCapabilities|disabledCapabilities`; `randomUUID|nanoid|generateId|createId|newId|crypto.` (src/domain, client/src); `Date.now()`; `RECURRENCE_STALE_MESSAGE`; `ADR-018`; `@micro-domain` in storage; `eslint.config.js` storage rules; `MoneyMinor` census; `WasteContext`; `ThemePreference`; `PeriodRange`; `"قطعة"`; `purchase_receipt:` label maps; Arabic-literal duplication scans
6. Read-only `python3` analyses (no repo writes): production storage→domain edge count (75); PSC import-specifier census (39 deep / 36 unique); R6 live-key vs baseline set comparison (52==52, no unsanctioned, no stale); type-only UI→storage census (17); cross-house deep imports inside application layer (108); independent Tarjan over type-only graph (1 SCC) and runtime-value graph (0 SCCs); duplicated exported type declarations across 421 production files (2 names); unbranded primitive alias scan (1); exported string-constant duplication by value/name (`__unset__`); register-row vs disk existence audit (21 absent-file rows, 2 without removal notes)
7. `sed -n` targeted ranges for ID-generator sites, unit-label mappings, doorless-house loop

---

## 3. Files / symbols / line-ranges inspected (key table)

| File | Symbol / range | What was verified |
|---|---|---|
| `src/domain/inventory-material/types.ts` | `WasteContext` :39-44; `materialUnits` :1 | Domain union members & order |
| `apps/…/application/inventory/inventoryMovementEditorModel.ts` | `WasteContext` :114-119; `wasteContextKind` literal unions :63, :122; whole file :1-145 | Duplicate union, zero imports, order divergence |
| `apps/…/application/inventory/inventoryMaterialModel.ts` | imports :10-17; `wasteContext` field :146 | Sibling imports canonical domain `WasteContext` |
| `apps/…/application/inventory/index.ts` | door surface :20-29 | Door does not export `WasteContext`/`deriveWasteContext` |
| `apps/…/app/useDisabledCapabilities.ts` | `CapabilityId` :11; `DisabledCapabilitiesState` :13-18; hook :20-40 | First declaration; honest `readonly string[]` |
| `apps/…/components/settings/SettingsCapabilitiesSection.tsx` | `CapabilityId` :25; casts :57, :101; imports :8-13 | Second declaration; unsound casts; no import link |
| `apps/…/application/preferences/preferenceService.ts` | `readDisabledCapabilities` :117-122; `saveDisabledCapabilities` :124-134 | Persisted/read-back as plain `string[]`, unvalidated |
| `apps/…/storage/local/types.ts` | `LocalPreferences.theme` :179; `disabledCapabilities?: string[]` :193 | Persistence schema |
| `docs/architecture/refactoring/FILE-SIZE-AND-RESPONSIBILITY-REGISTER.md` | rows :63, :413; dated-note rows :350-:362; §F-006 table :1490-1505 | Missing removal notes vs established pattern |
| `apps/prototype-web/ARCHITECTURE.md` | responsibility chain :20-26 (esp. :23, :24) | "19 paths incl. g5 barrel"; Domain→LocalStore arrow |
| `docs/architecture/ADRs/ADR-018-public-doors-terminal-architecture.md` | :11-:15 (esp. :15), :21, :19 | "43 documented keys (36 CR + 7 shims)"; dated corrections present for bundle numbers only |
| `scripts/ui-application-import-baseline.json` | `allowed` :4-57; `notes` :58-71 | 52 keys; R7/R7-5 swap-key documentation |
| `apps/…/app/PrototypeServicesContext.tsx` | all `@/application` specifiers | 53 specifiers = 39 deep (36 unique) + 14 door |
| `scripts/check-module-boundaries.mjs` | R5 :369-379; R6 :380-395; baselines :224-:280; `UI_LAYERS` :87 | R5 value-only; R6 covers type imports; sanctioned baselines |
| `eslint.config.js` | :137-:139, :162-:164, :291-:293 | "type imports stay allowed" policy for UI→storage |
| `scripts/check-type-cycles.mjs` | `TYPE_SCC_BASELINE` :27-:31; Tarjan :33+ | Single pair baseline |
| ID-generator sites | see §4.8 inventory | 5 behavioral shapes, ~60 sites |
| `src/domain/shared/currency.ts` | `MoneyMinor` :2; `persistedMoneyTextMinor` :31-40 | Unbranded alias |
| `apps/…/application/suppliers/supplierPurchaseEditorModel.ts` | `UNSET_PAYMENT_SOURCE` :21; `resolveDefaultPaymentSource` :25-29 | Sentinel + policy copy #1 |
| `apps/…/components/finance/expenseFormModel.ts` | `EXPENSE_SOURCE_UNSET` :24; `defaultExpenseSource` :60-62 | Sentinel + policy copy #2 |
| `storage/local/indexedDbStores.ts` / `MemoryLocalStore.ts` | :23 / :84 | `RECURRENCE_STALE_MESSAGE` exported vs private copy |
| `src/domain/shared/numeric.ts` | `fieldLabelAr` :188-190; rounding :227-:241 | Canonical kernel + label owner |
| `apps/…/application/inventory/materialSuggestions.ts` | :56-:95 | Unit-price derivation + unit-label mapping |
| `contexts/ThemeContext.tsx` / `application/preferences/preferenceService.ts` | :5-:6 / :20 | `ThemePreference` duplication |
| `pages/FinanceActivity.tsx` / `application/finance/periodPresets.ts` | :43 / :33 | `PeriodRange` name collision (different shapes) |

---

## 4. Part A — re-verification of R10-A findings (from live source at HEAD)

### R10A-F-003 (S2) — WasteContext union duplicated — **CONFIRMED (line numbers refined)**

- Domain declaration: `src/domain/inventory-material/types.ts:39-44` (R10-A said 39-45; line 45 is the start of `InventoryMovement`). Members in order: `order` → `catalog_item` → `catalog_template` → `general_project` → `unallocated`.
- Duplicate: `apps/prototype-web/client/src/application/inventory/inventoryMovementEditorModel.ts:114-119` (R10-A said 113-120). Members in order: `order` → `catalog_item` → `catalog_template` → `unallocated` → `general_project`. **Member order diverges today** (last two variants swapped) — confirmed.
- The editor-model file has **zero import statements** (whole file read, :1-145) — no import link, confirmed.
- Semantic equivalence: both unions are structurally identical five-member discriminated unions; TS union order is semantically irrelevant, so the page's `deriveWasteContext(...)` result is assignable to the domain-typed `wasteContext` field (`inventoryMaterialModel.ts:146`, typed via `import { type WasteContext } from "@micro-domain/inventory-material/index.js"` at `:14`).
- Aggravating context found: the same file repeats the kind vocabulary **three times** — the local union (:114-119) plus inline literal unions at :63 (`MovementSubmissionInput.wasteContextKind`) and :122 (`deriveWasteContext` input) — while the *sibling* `inventoryMaterialModel.ts:14` in the same house imports the canonical domain type. The domain barrel also exports a validator `isValidWasteContext` (`src/domain/inventory-material/policies.ts:39`) the editor model does not use.
- Drift exposure: a domain change to `WasteContext` (new kind, renamed field) would not error at the editor-model declaration; it would surface only at the `inventory.recordWaste(...)` call boundary in `pages/InventoryMovementEditor.tsx:296` — one indirect compile checkpoint instead of a direct one.

### R10A-F-004 (S3) — CapabilityId duplicated + persisted unvalidated — **CONFIRMED**

- `apps/…/app/useDisabledCapabilities.ts:11` and `apps/…/components/settings/SettingsCapabilitiesSection.tsx:25` both declare `export type CapabilityId = "orders" | "inventory" | "suppliers" | "catalog";` — identical members and order, **no import link** (the settings section's imports at :8-13 do not include `useDisabledCapabilities`).
- Casts confirmed at exactly `SettingsCapabilitiesSection.tsx:57` (`preference.disabled as CapabilityId[]`) and `:101` (`result.disabled as CapabilityId[]`).
- Persistence path: `saveDisabledCapabilities(disabled: readonly string[])` (`preferenceService.ts:124-134`) merges into `LocalPreferences.disabledCapabilities?: string[]` (`storage/local/types.ts:193`). Read-back: `readDisabledCapabilities()` (`preferenceService.ts:117-122`) returns `result.value?.disabledCapabilities ?? []` — **no member validation** of the persisted strings.
- Mitigating facts found: the hook itself stays honest (`disabled: readonly string[]`, `useDisabledCapabilities.ts:14`) and all gating pages compare against the closed literal set (`disabledCapabilities.includes("orders")` etc. — e.g. `pages/Home.tsx:279`, `pages/Orders.tsx:374`, `pages/InventoryMaterials.tsx:75`), so a tampered/imported bogus value simply matches nothing and the capability stays enabled (fail-open, consistent with the documented "disable hides entry points only" semantics — `docs/operations/current-state.md:25`). The unsound casts affect only the settings section's local state (aria-pressed/labels).
- Residual risk: adding a 5th capability requires synchronized edits to two declarations, and nothing (guard or test) pins their equality.

### R10A-F-001 (S3) — Register rows for deleted finance/recurringExpenseService files lack dated removal notes — **CONFIRMED**

- `docs/architecture/refactoring/FILE-SIZE-AND-RESPONSIBILITY-REGISTER.md:63` — row for `apps/…/application/finance/recurringExpenseService.ts` (the 12-line Wave-E compatibility stub). Its note describes the *removal condition* ("إزالته بشروط مسار UI الموثقة") but carries **no dated removal record**.
- `:413` — row for `apps/…/application/finance/recurringExpenseService.test.ts` — note is only "TEST — judged as test asset, not production" — **no removal note**.
- Both files are absent from disk (`ls apps/…/application/finance/` shows no `recurringExpenseService*`).
- Deletion commits verified: stub deleted at **`bfa48d44`** (2026-10-10, "compatibility-shim closure — 9 units removed…"), test deleted at **`07a8b7e4`** (2026-10-03, "Wave E — recurring home move + shim removal…").
- Pattern inconsistency proven: nine other deleted-file rows (lines 350, 353-356, 359-362) each carry the dated marker "(تصحيح مؤرخ 2026-10-10 — R9/W1 [R9-PF-N1]: الملف **أزيل بقرار R7-5** …الصف تاريخي)". A whole-register audit found exactly these 2 absent-file rows without removal notes (lines 1492-1503 are a differently-scoped §F-006 table with relative paths whose files exist under `client/src/`).

### R10A-F-002 (S3) — ARCHITECTURE.md "19 paths incl. g5 barrel" stale — **CONFIRMED**

- `apps/prototype-web/ARCHITECTURE.md:23`: "Micro Domain Core في ../../src/domain (19 مسارًا نطاقيًا = 18 منطقة + برميل التوافق `g5` — `ls src/domain`)".
- Live disk: `ls src/domain` = **18 directories** (actual-time … supplier-purchase, incl. `shared`), and **`src/domain/g5/` does not exist** — deleted at `bfa48d44` (verified via `git log --diff-filter=D -- src/domain/g5/index.ts`). The doc's own instruction ("`ls src/domain`") invites the contradiction: it claims 19 paths = 18 areas + g5, reality is 18 paths with no g5.

### R10A-F-005 (S3) — ADR-018 "43 keys" vs live 52; composition root 36→39 — **CONFIRMED (composition-root figure REFINED)**

- `docs/architecture/ADRs/ADR-018-public-doors-terminal-architecture.md:15`: "terminal state **43 documented keys (36 composition root + 7 frozen shims)**". `:21` reiterates "the 36-key pin".
- Live `scripts/ui-application-import-baseline.json`: **52 allowed keys** (36 `PrototypeServicesContext.tsx` keys + 16 non-PSC keys). My independent census of live UI→application-interior imports: **57 sites / 52 unique keys**, and the live key set **equals** the baseline set exactly (no unsanctioned, no stale).
- Composition root refined: `PrototypeServicesContext.tsx` contains **39 deep-interior import specifiers resolving to 36 unique files** (the three duplicates are `loans/loanService`, `transfers/localTransferService`, `transfers/guidedOpeningImportService`, each imported both statically and dynamically). So the *key* pin (36) is still accurate; the *site* count moved 36→39, and the "43 = 36 + 7 shims" terminal-state framing is stale (the 7 shims were removed by R7-5/`bfa48d44`; 16 non-PSC keys were added by R7 view-model extractions — documented per-key in the baseline `notes`, and reconciled in `R9-PREFLIGHT-CONSOLIDATED-FINDINGS…:39`).
- Nuance: `docs/architecture/refactoring/OWNERSHIP-AND-TRUTH-REGISTRY.md:210` already carries the dated correction to "52 مفتاحًا / 57 موقعًا" (2026-10-10), but **ADR-018 itself received no key-count correction** — its only dated correction (:19) concerns the lazy-chunk measurement artifact (R0-N1), not the 43-key claim.
- Also noted: ADR-018:14 names 4 doorless houses; live there are **7** doorless houses (`direct-sales, financial-analysis, formatting, identity, owner, profile, recurring`) of 36 application houses with 29 doors — the decision rule stands, the enumeration drifted.

### R10A-F-006 (S3) — 17 type-only UI→storage imports ungoverned — **CONFIRMED**

- Independent census (production files only, resolver mirroring the guard): **exactly 17 type-only imports** from `ui` layer (pages/components) into `storage/`, and **0 value imports**. All 17 resolve to `storage/local/types.ts`:
  - pages (12): `CostCalculator.tsx:19`, `EstimateDetail.tsx:16`, `Tools.tsx:22`, `Orders.tsx:17`, `OrderDetail.tsx:43`, `NewDraft.tsx:11`, `AgreementEditor.tsx:16`, `Settings.tsx:33`, `DraftEditor.tsx:13`, `Finance.tsx:59`, `CostEditor.tsx:13`, `ScheduleEditor.tsx:11`
  - components (5): `forms/useFormDraft.ts:12`, `order/AgreementContextPanel.tsx:5`, `settings/SettingsOperatingModeSection.tsx:8`, `settings/SettingsDataProtectionSection.tsx:31`, `cost/MaterialSheet.tsx:14`
- R5 guard is value-only, confirmed at `scripts/check-module-boundaries.mjs:369` (`imp.kind === "value"`); its baseline holds only the two app-shell value edges (`PrototypeServicesContext.tsx → createBrowserLocalStore`, `StartupGate.tsx → persistentStorage`, :273-274).
- Refinement: ESLint (`eslint.config.js:137-139, 162-164, 291-293`) **deliberately allows** UI type imports from `@/storage/local/*` ("type imports stay allowed"). So "ungoverned" is precise in the ratchet sense (no baseline, silent growth possible) but the edges are policy-sanctioned, not rule violations. The architectural exposure: 12 pages + 5 components bind directly to persistence record shapes (`StoredCraftOrder`, `OrderDraft`, `LocalPreferences`, `ScheduleEntry`…) rather than to door-owned view types.

### R10A-F-007 (S3) — ARCHITECTURE.md "Domain→LocalStore" arrow inverts actual import direction — **CONFIRMED**

- Doc: `apps/prototype-web/ARCHITECTURE.md:20-26` presents the chain `React UI → Application services → Micro Domain Core → LocalStore port (PrototypeLocalStore) → IndexedDB adapter`.
- Live code: **75 production import edges from `client/src/storage/**` into `@micro-domain/*`** (IndexedDbLocalStore 15, MemoryLocalStore 15, types.ts 16, indexedDbSnapshot 15, 8 commit guards 13, cashContinuityCommitGuard 1), **all barrel imports** (zero deep, verified). Domain→storage: **0 edges** (no `storage|LocalStore|prototype-web` reference anywhere under `src/domain`).
- So the compile-time dependency is storage→domain (adapters consume domain types), the inverse of the doc's arrow. The doc line is a runtime *responsibility* chain (UI delegates to services, domain concepts persist through the port), which is defensible prose, but as written it misstates the static dependency direction and the file nowhere records that the storage layer imports domain types.

### R10A-F-012 (S3) — "three divergent ID generators" — **REFINED (direction confirmed; magnitude materially understated)**

Live inventory (production files only; `randomUUID` sites: 26 UI files/41 sites + 21 application files/25 sites; **0 in `src/domain`**):

**Shape A — no fallback at all (breaks in insecure contexts):**
- `application/assets/assetService.ts:127-129`, `application/loans/loanService.ts:87-89`, `application/loans/receivedLoanService.ts:95-97`, `application/financial-records/retainedDepositService.ts:64-66` — `` `${prefix}-${crypto.randomUUID()}` `` with no guard. The repo's own documentation treats insecure contexts as supported (`presentation/catalogPresentation.ts:102-105`; `pages/Catalog.operationKey.test.ts:47` "falls back when randomUUID is not a function (older embedded webviews)"), so these four are inconsistent with the house pattern and would throw `TypeError` where `crypto.randomUUID` is absent.

**Shape B — `globalThis.crypto?.randomUUID?.() ?? Date.now()` (fallback with NO entropy):** ~30 UI sites, e.g. `components/finance/QuickSaleForm.tsx:61`, `QuickExpenseForm.tsx:72`, `orders/OrderDepositPanels.tsx:51,53`, `direct-sales/SaleCollectionReversalSection.tsx:21`, `pages/CashReversalEditor.tsx:45`, `InventoryMovementEditor.tsx:86`, `OwnerWithdrawalEditor.tsx:55`, `DirectSaleEditor.tsx:125,127,130`, `SupplierPurchaseEditor.tsx:105-107,457,490`, `MaterialEditor.tsx:57`, `CashTransferEditor.tsx:33`, `CashWalletEditor.tsx:28`, `InventoryMaterials.tsx:89,127`, `OrderDetail.tsx:172,183,190,280,377,1265`, `CashDistribution.tsx:57,174`, `FinancialEventEditor.tsx:210`, `OwnerEntitlement.tsx:51`, `CashAdjustmentEditor.tsx:46`, `CashOpeningLaterEditor.tsx:36`, `InventoryReversalEditor.tsx:39`.

**Shape C — `?? \`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}\`` (base-36 entropy):** `application/suppliers/supplierPurchaseService.ts:97-99`, `finance/recurringWorkService.ts:148`, `owner-money/ownerEntitlementService.ts:190`, `finance/projectFinancialEventWrites.ts:51`, `recurring/recurringExpenseService.ts:115`, `financial-analysis/financialAnalysisService.ts:101`, `cash/cashContinuityService.ts:77`, `collections/collectionReversalService.ts:91`, `inventory/inventoryMaterialModel.ts:231`, `estimates/costEstimateService.ts:35`, `direct-sales/directSaleService.ts:70`, `budgets/expenseBudgetService.ts:115`, `presentation/catalogPresentation.ts:107-108`, `pages/DeliveryReview.tsx:83`, `pages/Collect.tsx:84`, `components/finance/ExpenseBudgetsSectionBody.tsx:49`.

**Shape D — `?? \`${Date.now()}-${Math.random().toString(16).slice(2)}\`` (base-16 entropy):** `application/owner/ownerProfileService.ts:53-56`, `pages/CostEditor.tsx:20-21`, `components/presentation/ActualTimePanel.tsx:31-32`.

**Shape E — `typeof crypto !== "undefined" && "randomUUID" in crypto ? … : …` (different guard; prefix applied inconsistently — only on the fallback path in 3 of 4):** `application/cost/costService.ts:25-28` (prefix on both paths), `drafts/draftService.ts:43-46` (prefix only on fallback), `catalog/catalogService.ts:82-85` (prefix only on fallback), `time/actualTimeService.ts:50-53` (prefix only on fallback).

Additional divergences: prefix-on-UUID vs prefix-only-on-fallback (Shapes C/D always prefix both; Shape E mixes); UI-local no-`randomUUID` keys (`InventoryMaterials.tsx:156,174`, `CashCount.tsx:121` use bare `…-${Date.now()}`). Verdict: the R10-A claim of divergence is correct but "three generators" understates the live state — **~19 distinct application-layer generator implementations plus ~41 UI inline sites in ≥5 behavioral shapes**, none shared, none in domain, none pinned by any guard.

### R10A-F-013 (S3) — MoneyMinor unbranded — **CONFIRMED**

- `src/domain/shared/currency.ts:2`: `export type MoneyMinor = number;` — unbranded alias, sole exported primitive alias in the whole production tree (full scan).
- Usage: **59 production files, 326 references** (domain types/policies, storage records, application services, UI components/pages).
- Branding feasibility: a nominal brand (`number & { readonly __kind: "MoneyMinor" }`) with constructors at the parse boundaries (`englishNumeric.ts` money parse, storage read/JSON import revive, `persistedMoneyTextMinor`) is technically straightforward but touches all 326 sites or requires per-boundary conversions; the adjacent protected concepts (`quantityMilli`, `valueDeltaMinor`, timestamps, entity IDs) are **raw inline primitives** (no aliases at all), so branding `MoneyMinor` alone protects one member of a family and creates an inconsistency. The repo's current protection is instead: integer-safe kernel (`sumSafeIntegers`/`addSafe`/`roundHalfUp`, `numeric.ts:129-241`), `assertPositiveMinor`/`assertId` (`numeric.ts:192-201`), the moneyLayerGuard (freezes UI money-arithmetic surface), and field-naming convention (`*Minor`/`*Milli`). Branding is a large migration for marginal gain at Micro's current size; a documented owner decision (PRESERVE-with-rationale or DEFER) fits the house style better than a rushed brand.

---

## 5. Part B — analogous-pattern search results (whole-repo, production files)

### B1. Duplicated exported type/interface declarations

Full AST-name sweep of **421 production files** (src/ + client/src, tests excluded) → **820 exported type/interface names**, of which exactly **2 names are declared in ≥2 production files**:

| Name | Declarations | Disposition |
|---|---|---|
| `WasteContext` | `src/domain/inventory-material/types.ts:39` (canonical) + `application/inventory/inventoryMovementEditorModel.ts:114` | **Real duplication (defect)** — = R10A-F-003 |
| `CapabilityId` | `app/useDisabledCapabilities.ts:11` + `components/settings/SettingsCapabilitiesSection.tsx:25` | **Real duplication (defect)** — = R10A-F-004 |

No documented re-export pairs exist among exported type names (checked: no same-name exported twice; `application/resultCodes.ts` re-export of storage codes is a *value* re-export with a single definition — benign, documented ADR-012). Shadow/local (non-exported) declarations of exported names — 2 additional cases:

| Name | Declarations | Disposition |
|---|---|---|
| `ThemePreference` | `contexts/ThemeContext.tsx:6` (local: `Theme \| "system"`) vs `application/preferences/preferenceService.ts:20` (exported: `LocalPreferences["theme"]` = `"light"\|"dark"\|"system"`, `storage/local/types.ts:179`) | **Real duplication (new, NF-3)** — structurally identical, no import link |
| `PeriodRange` | `pages/FinanceActivity.tsx:43` (local: `"this_week"\|"last_week"\|"this_month"\|"all"\|"custom"`) vs `application/finance/periodPresets.ts:33` (exported: object type `{start,end}`-style) | **Name collision, different shapes (new, NF-4)** — grep/reader hazard, not type duplication |

Guarded-duplication context: `scripts/check-acceptance-value-anchors.mjs` already pins six cross-layer union families three-way (domain == transfer validator == documented staff: inventoryMovementType, catalogItemKind, scheduleStatus, yieldReadiness, shortCashDeclaration, expenseContext — guard PASS text :373). **Neither `WasteContext` nor `CapabilityId` is covered by that guard**, confirming both as ungoverned duplications.

### B2. Duplicated string-literal constants across module boundaries

| Literal | Sites | Disposition |
|---|---|---|
| `"__unset__"` | `UNSET_PAYMENT_SOURCE` `application/suppliers/supplierPurchaseEditorModel.ts:21` vs `EXPENSE_SOURCE_UNSET` `components/finance/expenseFormModel.ts:24`; plus near-identical policy twins `resolveDefaultPaymentSource` (:25-29) vs `defaultExpenseSource` (:60-62) | **Real architectural duplication (new, NF-1)** — one FIN-003/FIN-005 sentinel+rule concept, two owners, two layers |
| `RECURRENCE_STALE_MESSAGE` | exported `storage/local/indexedDbStores.ts:23` + private copy `storage/local/MemoryLocalStore.ts:84` (identical value, comment asserts deliberate byte-parity) | RV2 territory (storage-internal); noted here because it is the same family as the register's "vocabulary" pattern |
| `'سجل الطلب تغيّر من مسار آخر بعد فتحك له — لم يُسجَّل شيء؛ أعد المحاولة.'` | 4 storage files (IndexedDbLocalStore, MemoryLocalStore, deliveryReversalCommitGuard, orderCommitGuard) | RV2 territory (stale-message family) |
| `'وجدت تراجع قبضة بلا أثر تخصيص مطابق؛ لم يتغير السجل.'`, `'لا يمكن التراجع عن حدث تراجع سابق.'` | application (collections/finance) + both storage adapters | RV2 territory; cross-layer message ownership |
| `'الدفعة غير موجودة في هذا القرض.'` | `src/domain/loan/policies.ts` + `src/domain/received-loan/policies.ts` + both application loan services | Domain-internal message duplication (two domain areas + two services) — RV2, architectural note |
| `'أدخل وقت التسجيل وقتًا صحيحًا.'`, `'أكمل سبب التراجع قبل الحفظ.'`, `'بيانات الدفعة غير صالحة.'` | 3 production files each (domain + application mix) | RV2 territory |
| `'السعر المتفق عليه'`, `'إجمالي المصروف المشترك'` | hardcoded in `application/agreements/agreementPresentation.ts`, `pages/DirectSaleEditor.tsx`, `components/finance/AllocationReviewCard.tsx`, `pages/FinancialEventEditor.tsx` although the domain owns the label vocabulary (`fieldLabelAr`, `src/domain/shared/numeric.ts:188-190`) | **Source-of-truth bypass (new, NF-8)** — domain label owner exists, surfaces re-hardcode |
| MaterialUnit Arabic label mapping (`piece→قطعة, meter→متر, kilogram→كيلوغرام, liter→لتر, other→وحدة أخرى`) | **6 full mappings + 2 partial**: `application/inventory/materialSuggestions.ts:66-73`, `pages/InventoryMaterials.tsx:46-54` (`unitWord`), `pages/MaterialEditor.tsx:19-27` (`unitLabel`), `pages/InventoryMovementEditor.tsx:27-35` (`unitWord`), `pages/Catalog.tsx:205-213` (inline), `application/fulfillment/deliveryReviewService.ts:146-152` (`UNIT_LABELS` Record); partial defaults `pages/CostEditor.tsx:26`, `pages/CostCalculator.tsx:56,67` | **Real duplication (new, NF-2)** — domain owns `materialUnits` vocabulary (`src/domain/inventory-material/types.ts:1`), display mapping has no owner |
| UI-only copy ('جارٍ حفظ التعديل…', 'تراجع موثق عن التسليم', 'سداد أصل قرض مستلم' etc.) | 3 files each, all within UI/presentation layer | Benign presentation copy repetition (RV3/RV2 territory) |

### B3. Unbranded aliases where branding would protect a protected concept

- **Only one exported primitive alias exists in production:** `MoneyMinor = number` (`src/domain/shared/currency.ts:2`) — = R10A-F-013, confirmed above.
- `quantityMilli` quantities, `valueDeltaMinor`/`*Minor` money fields, `occurredOn`/`recordedAt` dates, and entity IDs (`id: string`) are **raw inline primitives** everywhere (no aliases to brand). Consequence: branding `MoneyMinor` alone would protect 326 sites of one concept while its sibling concepts stay raw — a partial wall. Full-family branding (Minor/Milli/Date/Id) would be a repo-wide migration far beyond a review remediation; the existing mitigations (integer kernel + asserts + moneyLayerGuard + naming convention) are the live protection. No *additional* unbranded aliases found beyond `MoneyMinor`.

### B4. Deep-import status quo — **zero unsanctioned deep imports at HEAD (verified independently)**

| Seam | Live count | Sanctioned baseline | Match |
|---|---|---|---|
| application → domain interior (`@micro-domain/<area>/<non-index>`) | 3, all `await import(...)` dynamic: `finance/integrityCheckSettlementBasis.ts:23 → craft-order/settlementInvariant.js`; `finance/projectFinancialInsights.ts:145 → financial-analysis/operatingBreakEven.js`; `financial-analysis/financialAnalysisService.ts:403 → financial-analysis/operatingBreakEven.js` | `DEEP_DOMAIN_IMPORT_BASELINE` (check-module-boundaries.mjs:224-228) | ✅ exact |
| domain → domain cross-area deep (non-barrel) | 3: `recurring-expense/policies.ts:37 → ../financial-event/types.js`; `recurring-margin/policies.ts:16 → ../inventory-material/policies.js`; `recurring-margin/types.ts:98 → ../inventory-material/types.js` | `DOMAIN_CROSS_AREA_DEEP_BASELINE` (:263-267) | ✅ exact |
| UI layers → application interiors | 57 sites / 52 unique keys | `ui-application-import-baseline.json` 52 keys | ✅ set-equal (no unsanctioned, no stale) |
| composition root (`PrototypeServicesContext.tsx`) | 39 deep specifiers → 36 unique files (+14 door imports) | 36 PSC keys in baseline | ✅ (key pin accurate; site count 36→39 as in F-005) |
| UI → storage value | 2 (`PSC → createBrowserLocalStore`, `StartupGate → persistentStorage`) | `UI_TO_STORAGE_VALUE_BASELINE` (:272-275) | ✅ |
| storage → domain | 75 edges, **all barrel** (0 deep) | barrel imports unrestricted by design | ✅ |
| UI → domain deep | 0 | — | ✅ |
| **application → application cross-house interior** | **108 edges** (e.g. `@/application/time/clock` ×~40, `@/application/formatting/formatters` ×~10, `finance/projectFinancialService` ×5, `fulfillment/deliveryAttribution` ×4, `preferences/updateLocalPreferences` ×2 …) | **none — R6 scope is UI layers only (R6_LAYERS, :92)** | ⚠️ ungoverned seam (new, NF-5) |

### B5. Runtime/type cycle baselines

- **Runtime (value) cycles: 0.** Independent Tarjan over the runtime-value import graph (mirroring `check-runtime-cycles.mjs` semantics: static value imports + dynamic imports + value re-exports; type-only excluded) finds zero SCCs of size ≥2. Matches the guard's zero-tolerance contract.
- **Type-only cycles: exactly 1 SCC**, `apps/…/storage/local/supplierScheduleCommitGuard.ts <-> apps/…/storage/local/types.ts` — verified bidirectionally (`supplierScheduleCommitGuard.ts:7` imports `ScheduleEntry, ScheduleEvent` from `./types`; `types.ts:39` imports `SupplierPurchaseCommit` from `./supplierScheduleCommitGuard`). Matches `TYPE_SCC_BASELINE` (check-type-cycles.mjs:27-31). **No new cycles.**
- Known related guard: R7 (`R7-component-to-page`, :400-413) prevents the former Finance cycle class from returning (baseline empty; my UI scan shows no components→pages edges).

### B6. Responsibility leaks (application-layer files with domain-policy-like logic)

| Candidate | Evidence | Assessment |
|---|---|---|
| `components/finance/expenseFormModel.ts` | FIN-005 payment-source policy (`expenseSourceRuleViolation` :38-43, `defaultExpenseSource` :60-62) + Arabic rule strings live in a **UI component** file; twin FIN-003 logic sits in `application/suppliers/supplierPurchaseEditorModel.ts:25-52` | **Leak (part of NF-1)** — one policy concept, two owners, two layers; the EXE-007 header documents "ownership" but of the *spec*, and the duplication across layers is the defect |
| `application/inventory/materialSuggestions.ts:56-95` | Derives unit price (`roundHalfUp(valueDeltaMinor*1000, quantityDeltaMilli)`) and the "latest unreversed receipt = known price" rule in the application layer | **Gray / acceptable**: money *math* delegates to the domain kernel; the rule is a documented read-model suggestion (EXACT_VALUES policy cited in comment :56-60); domain `policies.ts` owns the invariants (`consumptionValueMinor` :262, `positionCostKnowledge` :284). DEFER note only |
| `application/finance/periodPresets.ts:101` | Comment states integer division is "ممنوع في طبقة التطبيق" — enforced by `check-date-arithmetic-ownership.mjs` | No leak: date kernel ownership guarded (R1-R6 rules verified in header) |
| UI money arithmetic | Frozen F-049 surface (39 lines / 12 files) pinned by `moneyLayerGuard.contract.test.ts` (FROZEN_SURFACE table) incl. `pages/Collect.tsx:419` `Math.floor(outstandingMinor/2)` | Known/documented/frozen — not a new finding |
| Domain policy messages re-emitted by application services | e.g. 'أكمل سبب التراجع قبل الحفظ.' in `domain/craft-order/policies.ts` + `application/collections/…` + `application/fulfillment/…` | Message-level leak — RV2 territory, noted in B2 |
| ID generation | 0 generators in domain; ~19 implementations across application houses + ~41 UI sites | Ownership vacuum rather than a leak (NF-6); no single owner, no guard |

---

## 6. New findings (not in the R10-A list I was given)

### NF-1 — `'__unset__'` sentinel + default-payment-source policy duplicated across two layers — S3 — **FIX_NOW (small) or DEFER to the UI-boundary wave**
`application/suppliers/supplierPurchaseEditorModel.ts:21,25-29,49-50,64-65` vs `components/finance/expenseFormModel.ts:24,38-43,60-62`. Same sentinel value, same 0/1/multi-wallet default rule (FIN-003/FIN-005), two constant names, two layers (application vs components). Short-term correctness: identical values today, both tested. Long-term: a change to the sentinel or the multi-wallet rule in one copy silently diverges the other; the components copy cannot import the application interior without a new R6 baseline key. Recommended: consolidate the rule into one application-owned module and expose it through an existing door (deliberate same-PR door-surface update), or record a DEFER card. Reviewability cost of the duplication is real (two policy vocabularies for one owner decision).

### NF-2 — MaterialUnit Arabic label mapping duplicated 6× (+2 partial) — S3 — **FIX_NOW (small)**
Full mapping sites listed in B2. The domain owns the unit vocabulary (`materialUnits`, `types.ts:1`); the display mapping has no owner and is re-implemented per surface, including once in the application layer (`materialSuggestions.ts:66-73`) and once as a `Record` in `deliveryReviewService.ts:146-152`. A new unit (e.g. "square_meter") would require touching 6+ files with no compile or guard signal. One shared label helper (presentation- or door-owned) removes the family. Low risk: pure display strings, tests pin behavior per surface.

### NF-3 — `ThemePreference` duplicated (contexts vs application) — S3 (LOW) — **FIX_NOW (one line + door type export) or PRESERVE**
`contexts/ThemeContext.tsx:6` (local `Theme | "system"`) vs `application/preferences/preferenceService.ts:20` (exported `LocalPreferences["theme"]`). Structurally identical today; if the preference schema ever widens, the context copy drifts silently. Cheapest fix: export the type from the existing `@/application/preferences` door and import it in ThemeContext (type-only UI→door import is the sanctioned pattern).

### NF-4 — `PeriodRange` name collision with different shapes — S3 (LOW) — **DEFER (rename at next touch)**
`pages/FinanceActivity.tsx:43` (string union) vs `application/finance/periodPresets.ts:33` (object type). No type-level confusion (different modules, no import relation), but same-name-different-meaning across layers is a grep/review hazard. Rename the page-local one at next touch.

### NF-5 — 108 ungoverned cross-house deep imports inside the application layer — S3 — **DEFER (owner decision required)**
Inventory in B4. ADR-018's R6 ratchet deliberately scopes UI→application edges; application-internal cross-house coupling (dominated by the `time/clock` infrastructure seam, `formatting/formatters`, and service-to-service reads like `finance/projectFinancialService`) is entirely open — a new house boundary violation class would be invisible to CI. This is the same seam class R6 closed for UI, one layer down. Recommendation: owner decision to either (a) declare shared-infrastructure houses (`time`, `formatting`, `resultCodes`, `identity`) exempt-by-design and ratchet the rest, or (b) accept and document the open internal graph. Not FIX_NOW: 108 edges, no current defect, and the "doors" decision (ADR-018) explicitly scoped itself to feature consumers.

### NF-6 — ID-generator divergence is far larger than "three" — S3 (with an S2-flavored edge) — **FIX_NOW for the 4 no-fallback services; DEFER the consolidation**
Full inventory in §4.8. The four services calling bare `crypto.randomUUID()` (`assetService.ts:128`, `loanService.ts:88`, `receivedLoanService.ts:96`, `retainedDepositService.ts:65`) contradict the repo's own documented insecure-context support (catalogPresentation :102-105; `Catalog.operationKey.test.ts:47` "older embedded webviews") — on such origins loan/asset/retained-deposit creation would throw `TypeError`. Short-term correctness: latent environment-dependent failure. Long-term: ~60 sites, 5 shapes, no owner, no guard; every new feature re-invents the fallback. Recommended: align the 4 services to the established `globalThis.crypto?.randomUUID?.() ?? …` guard now (behavior-preserving in secure contexts, 4 small edits + tests), and record a DEFER card for a single shared ID helper (owner decision on its home — application infrastructure house vs domain-adjacent port).

### NF-7 — `RECURRENCE_STALE_MESSAGE` exported + privately re-declared — S3 (LOW) — **RV2 territory, noted**
`indexedDbStores.ts:23` (exported) vs `MemoryLocalStore.ts:84` (private, value identical, comment documents deliberate parity). Listed for reconciliation with RV2; architecturally it is the "one vocabulary, two adapters" pattern the register already uses elsewhere.

### NF-8 — Domain-owned label vocabulary bypassed by hardcoding — S3 (LOW) — **DEFER (bundle with RV2 message-ownership work)**
`fieldLabelAr` (`src/domain/shared/numeric.ts:188-190`) owns 'السعر المتفق عليه' / 'إجمالي المصروف المشترك', yet `agreementPresentation.ts`, `DirectSaleEditor.tsx`, `AllocationReviewCard.tsx`, `FinancialEventEditor.tsx` hardcode the same strings. Source of truth exists and is bypassed; drift would desynchronize validation messages from display labels.

### NF-9 — ADR-018 enumeration drift (doorless houses 4→7) — S3 (LOW) — **FIX_NOW (doc note, can ride the F-005 correction)**
ADR-018:14 names `direct-sales, financial-analysis, owner, profile` as doorless; live there are 7 doorless houses of 36 (`+ formatting, identity, recurring`), each legitimate (composition-root-only or R6-baselined view-model consumers, e.g. baseline note `r7-p07`: "direct-sales has no door and the model is page-scoped"). The decision rule is intact; the enumeration is stale. Fold into the same dated correction as F-005.

---

## 7. Unverified limits (could NOT be proven read-only)

1. **Runtime behavior of the 4 no-fallback ID services on insecure origins** — asserted from code shape (`crypto.randomUUID()` unguarded) and the repo's own insecure-context documentation; actual failure requires executing in such an environment (forbidden here). Severity of NF-6's edge depends on whether real usage ever hits non-secure origins (PWA installs are HTTPS; LAN/IP and some embedded webviews are not).
2. **Whether `disabledCapabilities` can carry arbitrary strings through the import/transfer path** — the import validator (`LocalTransferService`) is RV2's territory; I verified only the preference read-back (`preferenceService.ts:117-122`) performs no member validation.
3. **Bundle-size effects of any recommended consolidation** (NF-1/NF-2/NF-3) — ADR-012 requires measuring before merge; not measurable read-only.
4. **File-size/large-file seam truth at row level** — I verified the register's deletion-note hygiene and the dated v2-baseline note (488 measurements: 413 NORMAL / 52 WATCH / 14 SPLIT_CANDIDATE / 9 SPLIT_NOW per register :1516) but did not re-measure nbLOC per file; the ratchet guard's green state is asserted by CI history, not re-run here.
5. **`check-module-boundaries` / cycle guards actually passing at HEAD** — I reproduced their logic independently (set-parity for R6, Tarjan for cycles) rather than executing them; execution is a test run and was out of bounds. My independent results match the baselines exactly, which is strong but not identical evidence.
6. **R10-A severity labels for F-003 (S2)** — I could not validate the original S2 justification beyond what live code shows; my own assessment is S3 (no runtime defect today; drift-risk only), and I flag the disagreement for reconciliation.

---

## 8. Recommended classification for each re-verified finding

| Finding | Verdict | Severity (my call) | Disposition | Rationale (short-term correctness ↔ long-term cost) |
|---|---|---|---|---|
| R10A-F-003 WasteContext duplication | **CONFIRMED** (lines refined: domain :39-44, model :114-119) | S3 (R10-A said S2) | **FIX_NOW** | No runtime defect (unions structurally equal); but the same house already imports the canonical type (`inventoryMaterialModel.ts:14`) — the fix is a 2-line `import type` + delete, with an existing test file (`inventoryMovementEditorModel.test.ts`). Leaving it multiplies drift surfaces (3 copies of the kind vocabulary in one file). |
| R10A-F-004 CapabilityId duplication + unvalidated persistence | **CONFIRMED** (:11/:25; casts :57/:101; read-back :117-122) | S3 | **FIX_NOW (type link) / DEFER (validation)** | The duplication fix is one `import type` from `@/app/useDisabledCapabilities` (UI-internal, no R6 impact) plus replacing the two `as` casts with honest `string[]` or a filter. Persistence validation is fail-open-benign today (literal-set gating) — defer unless the transfer validator (RV2) proves arbitrary strings reachable. |
| R10A-F-001 register rows 63/413 missing dated removal notes | **CONFIRMED** (deletions bfa48d44 / 07a8b7e4 verified) | S3 | **FIX_NOW** | Pure documentation truth debt; two dated notes, house style already established by nine sibling rows. Zero code risk. |
| R10A-F-002 ARCHITECTURE.md "19 paths incl. g5" | **CONFIRMED** (live 18 dirs, g5 deleted) | S3 | **FIX_NOW** | One-line doc edit; the doc itself cites `ls src/domain` as its authority and is wrong against it. |
| R10A-F-005 ADR-018 "43 keys" vs live 52 | **CONFIRMED** (PSC figure refined: 36 keys / 39 sites) | S3 | **FIX_NOW (dated correction in ADR-018)** | Registry already corrected (2026-10-10) but the ADR — the decision record future changes are reviewed against — still states 43/36+7. A dated correction preserving the original text matches the R0-N1 precedent in the same file (:19). |
| R10A-F-006 17 type-only UI→storage imports ungoverned | **CONFIRMED** (17 sites listed; R5 value-only :369; ESLint sanctions type imports) | S3 | **DEFER (guard card, R8-class)** | Not a rule violation — deliberate ESLint policy. The gap is the missing ratchet (silent growth of UI↔persistence-schema coupling). Adding a type-edge baseline is a guard change with test negatives; schedule with the guards owner. |
| R10A-F-007 "Domain→LocalStore" arrow inverts import direction | **CONFIRMED** (75 storage→domain edges, 0 reverse) | S3 | **FIX_NOW (one clarifying line) or PRESERVE** | The chain is defensible as runtime responsibility prose, but the file never states the static direction; one sentence ("المحوّلات تستورد أنواع المجال؛ الاتجاق الكتابي معاكس") removes the ambiguity at trivial cost. |
| R10A-F-012 "three divergent ID generators" | **REFINED — understated** (~19 app implementations + ~41 UI sites, ≥5 shapes; 4 services with no insecure-context fallback) | S3 (edge: S2-shaped) | **FIX_NOW (the 4 no-fallback guards) + DEFER (shared helper consolidation)** | Aligning assetService/loanService/receivedLoanService/retainedDepositService to the established optional-chain guard is behavior-preserving and removes an environment-dependent crash class. Full consolidation needs an owner decision on the helper's home and touches ~60 sites — card it. |
| R10A-F-013 MoneyMinor unbranded | **CONFIRMED** (:2; 59 files / 326 refs) | S3 | **DEFER (documented owner decision)** | Branding is feasible but touches 326 sites while sibling concepts (`*Milli`, dates, IDs) remain raw — a partial wall with real migration cost. Current protections (integer kernel, asserts, moneyLayerGuard, naming) are live. Decide deliberately, don't drift. |

---

## 9. Final statement

**No writes performed to the repository.** All inspection was read-only against the verified HEAD `ffc54eb1150932c9bba88b48a7c38275f2a3effa`; the only file created is this report at `/home/z/my-project/r10b/scratch/reviewers/reviewer-1-architecture-module-boundaries.md`.
