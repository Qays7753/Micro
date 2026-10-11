# R9 Preflight — Reviewer 3: UI/Runtime and Boundary Review

- **Task ID:** R9-PF-R3
- **Agent:** general-purpose (Reviewer 3 — UI/Runtime/Boundary)
- **Repo:** /home/z/my-project/work/micro/repo @ 8b3c9aeb09ca33ed66f0a929c157b668839d0463 (detached == origin/main; worktree clean — VERIFIED)
- **Mode:** READ-ONLY. No file under the repo was created/modified/deleted; no checkout/commit; no pnpm/vitest/build runs; only Read/Grep/Glob/LS and read-only git (`show`, `diff --name-only`, `log`, `merge-base --is-ancestor`). Analysis scripts were run from /tmp or inline Python reading the tree.
- **Evidence discipline:** every claim tagged VERIFIED (file:line), INFERRED (basis), or UNVERIFIED (why).

---

## §1 Page inventory and coverage

### 1.1 Live inventory (VERIFIED)

- `apps/prototype-web/client/src/pages/` contains **73 files = 60 page components (`*.tsx`, non-test) + 13 in-directory test files** (VERIFIED by LS + filtered listing).
- Router: **`apps/prototype-web/client/src/app/MicroRouter.tsx`** (wouter `Switch`; VERIFIED lines 115–240). All pages are `lazy()` imports (lines 15–94).
- **66 `<Route>` elements** total (VERIFIED count):
  - **64 page-rendering routes** covering **all 60 unique pages** — 0 pages without a route.
  - **2 redirect routes** (no page): `/finance/new/owner_withdrawal_cash` → `OwnerWithdrawalLegacyRedirect` → `/finance/withdraw` (MicroRouter.tsx:98–102, 146–148; EXE-009/OWN-002 documented) and `/review` → `/finance` (MicroRouter.tsx:233–235; §2.2 documented). Both are intentional, commented, and covered by `Nav003.exe016` route governance.
  - 4 pages have 2 routes each: DirectSaleEditor (`/direct-sales/new`, `/direct-sales/:id`), SupplierPurchaseEditor (`/suppliers/purchase/:id/payment`, `/suppliers/purchase/:id`), MaterialEditor (`/inventory/material/new`, `/inventory/material/:id/confirm`), RecurringExpenseEditor (`/finance/recurring/new`, `/finance/recurring/:id/edit`).
  - `NotFound` is the pathless fallback route (MicroRouter.tsx:239).
- No second router / route table exists (grep for `createBrowserRouter|<Routes>|useRoutes` found only MicroRouter + its test — VERIFIED).

### 1.2 Canonical map (VERIFIED)

`docs/architecture/refactoring/TEST-AND-DOCUMENTATION-MAP.md` (14,444 B) §2: **60 pages = 55 `direct` + 5 `named-reference` + 0 without evidence**; the six formerly route-classified pages became `direct` via `SmokeOnlyPagesJourneys.dom.test.tsx` (dated correction in the doc, lines 29–33, 44–49). The generated source `docs/architecture/refactoring/generated/test-map.json` agrees: `pages.total = 60`, kinds {direct: 55, named-reference: 5}, `withoutDirectEvidence: []`.

### 1.3 Live verification of every evidence claim (100% spot-check, not a sample)

- **All 55 direct pages:** each named evidence file exists under `client/src` **and** references the page (script-checked import/name reference; 0 missing files, 0 pages without a reference — VERIFIED).
- **Independent cross-check:** live grep of `from '@/pages/…'` across all test files finds **78 test files importing exactly the same 55 unique page basenames** as the map's direct set — set difference both ways empty (VERIFIED). 13 of those test files live inside `pages/`, 65 elsewhere in `client/src`; no root `tests/` file imports a page (VERIFIED).
- **All 5 named-reference pages:** evidence files exist and mention the page by name — AgreementEditor & CashAdjustmentEditor in `moneyLayerGuard.contract.test.ts`; CashOpeningLaterEditor & CashWallets in `StateRecovery.w44.dom.test.tsx`; NotFound in `Nav003.exe016.dom.test.tsx` (VERIFIED, 1 mention each).
- **Zero-direct-test pages: 5** (AgreementEditor, CashAdjustmentEditor, CashOpeningLaterEditor, CashWallets, NotFound) — all classified named-reference with documented reason (map §2 table; full behavioral coverage deferred to UI track T with owner gate).
- Map head pin `4d60d1bc` is an ancestor of HEAD (VERIFIED `git merge-base --is-ancestor`). Known generator self-reference artifact (R3-era HAF-4 pattern): only one commit after the pin touched `pages/` (bfa48d44, R7-5 shim-closure import migrations) and none touched test files; map content independently verified live-accurate → no drift (VERIFIED).

### 1.4 Consolidated table (page | route(s) | direct evidence file(s) | canonical class | verified live?)

All 60 rows verified live: evidence file exists + references page (direct) or mentions page (named). "✅" = verified this review.

| Page | Route(s) | Direct test file(s) (map evidence) | Class | Live? |
|---|---|---|---|---|
| AgreementEditor | `/orders/draft/:id/agreement` | moneyLayerGuard.contract.test.ts (named) | named-reference | ✅ |
| AssetDetail | `/assets/:id` | G4Assets.dom.test.tsx | direct | ✅ |
| AssetEditor | `/assets/new` | G4Assets.dom.test.tsx | direct | ✅ |
| Assets | `/assets` | G4Assets.dom.test.tsx; StateRecovery.w44.dom.test.tsx | direct | ✅ |
| CashAdjustmentEditor | `/cash/wallet/:id/adjust` | moneyLayerGuard.contract.test.ts (named) | named-reference | ✅ |
| CashCount | `/cash/count` | CashJourneys.dom.test.tsx | direct | ✅ |
| CashDistribution | `/cash/distribute` | CashJourneys.dom.test.tsx; CashVocabulary.w43.dom.test.tsx | direct | ✅ |
| CashOpeningLaterEditor | `/cash/wallet/:id/opening-later` | StateRecovery.w44.dom.test.tsx (named) | named-reference | ✅ |
| CashReversalEditor | `/cash/entry/:id/reverse` | SmokeOnlyPagesJourneys.dom.test.tsx | direct | ✅ |
| CashTransferEditor | `/cash/transfer` | G3Cash.dom.test.tsx | direct | ✅ |
| CashWalletEditor | `/cash/wallet/new` | SmokeOnlyPagesJourneys.dom.test.tsx | direct | ✅ |
| CashWallets | `/cash` | StateRecovery.w44.dom.test.tsx + 7 service/storage evidence files (named) | named-reference | ✅ |
| Catalog | `/catalog` | CatalogPlannedCost.dom.test.tsx; G3.dom.test.tsx | direct | ✅ |
| Collect | `/collect` | G2.dom.test.tsx; WorkShare.w43.dom.test.tsx | direct | ✅ |
| CostCalculator | `/tools/calculator` | G3.dom.test.tsx; G3Delivery.dom.test.tsx | direct | ✅ |
| CostEditor | `/orders/draft/:id/cost` | U01.dom.test.tsx; group2InventorySurfaces.test.tsx | direct | ✅ |
| DeliveryReview | `/orders/:id/deliver` | G3Delivery.dom.test.tsx; OrdJourneys.dom.test.tsx | direct | ✅ |
| DirectSaleEditor | `/direct-sales/new`, `/direct-sales/:id` | G3.dom.test.tsx; ReversalSurfacesExe010; U005.dom.test.tsx; pages/DirectSaleEditor.ui.test.tsx | direct | ✅ |
| DraftEditor | `/orders/draft/:id` (gated) | U004.dom.test.tsx; U06.dom.test.tsx | direct | ✅ |
| EstimateDetail | `/tools/estimate/:id` | G3.dom.test.tsx | direct | ✅ |
| Finance | `/finance` | 15 files (D005, EventsLayer.familyGuard, FinanceBridge.w173, FinanceBudgets.w174, FinanceEmptyTruth, FinanceJourneys, FinanceObligations.w43, FinanceSafeWithdrawal.w176, FinanceShortCashHorizon.w175, G005FinanceReadIsolation, U001, U05, U07, group1Surfaces, group2InventorySurfaces) | direct | ✅ |
| FinanceActivity | `/finance/activity` | G5Activity.dom.test.tsx; R2.financeActivityVoid.test.tsx | direct | ✅ |
| FinanceMore | `/finance/more` | FinanceMore.w42.dom.test.tsx | direct | ✅ |
| FinanceRecurring | `/finance/recurring` | RecurringExpenseSurfaces.dom.test.tsx | direct | ✅ |
| FinanceUpcoming | `/finance/upcoming` | FinanceUpcoming.dom.test.tsx | direct | ✅ |
| FinancialEventEditor | `/finance/new/:type` | DeepScreens.w43; pages/FinancialEventEditor.guided.test.tsx; pages/FinancialEventEditor.ui.test.tsx; pages/OwnerJourneysExe009.dom.test.tsx | direct | ✅ |
| Foundation | `/foundation` | pages/Foundation.ui.test.tsx | direct | ✅ |
| G5DeclarationEditor | `/finance/g5/declaration` | SmokeOnlyPagesJourneys.dom.test.tsx | direct | ✅ |
| Home | `/` | 6 files (G004CapabilityGuard, Home.dom, HomeRedesign.w43, Nav001, ReadLayerParity.w44, Set003Capabilities) | direct | ✅ |
| InventoryMaterials | `/inventory` | 5 files (G004CapabilityGuard, InventoryAdjustExe012, InventoryLowStock, PurchasingBridgeExe011, group2InventorySurfaces) | direct | ✅ |
| InventoryMovementEditor | `/inventory/movement/:type` (gated) | InventoryAdjustExe012; Ops001MovementSelection; group2InventorySurfaces | direct | ✅ |
| InventoryReversalEditor | `/inventory/movement/:id/reverse` | SmokeOnlyPagesJourneys.dom.test.tsx | direct | ✅ |
| LoanDetail | `/loans/:id` | G4Loans.dom.test.tsx | direct | ✅ |
| LoanEditor | `/loans/new` | G4Loans.dom.test.tsx | direct | ✅ |
| Loans | `/loans` | Accessibility.w44; ArabicRtlContent.w44; DeepScreens.w43; G4Loans | direct | ✅ |
| Market | `/market` | Clean001.surfaceAudit; Nav001.dom.test.tsx | direct | ✅ |
| MaterialEditor | `/inventory/material/new` (gated), `/inventory/material/:id/confirm` | group2InventorySurfaces.test.tsx | direct | ✅ |
| NewDraft | `/orders/new` | U06.dom.test.tsx | direct | ✅ |
| NotFound | (pathless fallback) | Nav003.exe016.dom.test.tsx (named) | named-reference | ✅ |
| OrderDetail | `/orders/:id` | 11 files (ArabicRtlContent.w44, G3, G3Delivery, G3Hardening, G4RetainedDeposit, G6, OrdJourneys, OrderDetail.ui, OrderShare.exe015, R1.orderDetailVoid, ReversalSurfacesExe010) | direct | ✅ |
| Orders | `/orders` | WorkShare.w43.dom.test.tsx; pages/Orders.ui.test.tsx | direct | ✅ |
| OwnerEntitlement | `/finance/owner-entitlement` | G6.dom.test.tsx | direct | ✅ |
| OwnerWithdrawalEditor | `/finance/withdraw` | G6.dom; pages/OwnerJourneysExe009.dom; pages/OwnerWithdrawalEditor.ui.test | direct | ✅ |
| Parties | `/parties` | PartiesLedger.dom.test.tsx | direct | ✅ |
| Profile | `/profile` | ArabicRtlContent.w44; pages/Profile.ui.test.tsx | direct | ✅ |
| ReceivedLoanDetail | `/loans/received/:id` | SmokeOnlyPagesJourneys.dom.test.tsx | direct | ✅ |
| ReceivedLoanEditor | `/loans/received/new` | ReceivedLoanEditor.w178.dom.test.tsx | direct | ✅ |
| RecurringExpenseDetail | `/finance/recurring/:id` | RecurringExpenseSurfaces.dom.test.tsx | direct | ✅ |
| RecurringExpenseEditor | `/finance/recurring/new`, `/finance/recurring/:id/edit` | RecurringExpenseSurfaces.dom.test.tsx | direct | ✅ |
| Schedule | `/schedule` | G004CapabilityGuard; ScheduleJourneys.dom.test.tsx | direct | ✅ |
| ScheduleEditor | `/schedule/:id` | G3Hardening.dom.test.tsx | direct | ✅ |
| Settings | `/settings` | Set003SettingsSection; Settings.lockGate; SettingsDataBackupSection.w42; U11.dom.test.tsx | direct | ✅ |
| Setup | `/setup` | pages/Setup.ui.test.tsx | direct | ✅ |
| SharePreview | `/share/preview` | SmokeOnlyPagesJourneys.dom.test.tsx | direct | ✅ |
| Statement | `/finance/statement` | G2.dom.test.tsx; StatementPeriod.w173.dom.test.tsx | direct | ✅ |
| SupplierPurchaseEditor | `/suppliers/purchase/:id/payment`, `/suppliers/purchase/:id` (gated) | 5 files (G004CapabilityGuard, G3Hardening, PurchasingBridgeExe011, group2InventorySurfaces, pages/SupplierPurchaseEditor.ui.test.tsx) | direct | ✅ |
| Suppliers | `/suppliers` | G004CapabilityGuard; SuppliersDueAging.dom.test.tsx | direct | ✅ |
| Tools | `/tools` | G3.dom; ToolsCleanup.w42; U04.dom.test.tsx | direct | ✅ |
| ToolsIntegrity | `/tools/integrity` | FinanceMore.w42; IntegrityReadable.w43; ReadLayerParity.w44; ToolsIntegrity.ui.test.tsx | direct | ✅ |
| WalletLedger | `/cash/wallet/:id` | FinancePoliciesWallet.w42; G2.dom.test.tsx | direct | ✅ |

---

## §2 The six smoke-only-page journeys (`SmokeOnlyPagesJourneys.dom.test.tsx`, read in full)

**Common harness (VERIFIED, lines 11–95):**
- `vi.mock("@/app/PrototypeServicesContext")` (31–34): the *context hook* is mocked, but its returned value is a **real composition of real application services** over a **real `MemoryLocalStore`** (lines 59–73: `CashContinuityService`, `ProjectFinancialService`, `FinancialAnalysisService`, `InventoryMaterialService`, `AgreementService`+`CostService`), with `notifyDataChanged: bumpVersion` (spy) and `dataVersion: 0`.
- `vi.mock("wouter")` (46–50): navigation is a spy (`wouterMocks.navigate`); `useParams` returns a controlled object.
- `vi.mock("@/lib/textDelivery")` (35–39): share/copy primitives faked.
- `fake-indexeddb/auto` is imported (line 11) but the store actually used is `MemoryLocalStore` (line 80) — storage effects are REAL but against the **memory adapter**, not IndexedDB (IndexedDB adapter equivalence is separately covered by `storage/local/adapterConformance*` / `IndexedDbLocalStore*` suites — INFERRED from map §2 evidence listing for CashWallets).
- The real `UnsavedChangesProvider` wraps each page (Harness, 75–77).

### Journey-by-journey

1. **CashWalletEditor (98–113)** — REAL page boundary (real component rendered, real DOM interaction via `fireEvent` on labeled Arabic fields); REAL service boundary (`cashContinuity.openWallet` — page save path VERIFIED at pages/CashWalletEditor.tsx:40, notify at :53, navigate at :55); REAL storage effect — read-back through a **second** `CashContinuityService` over the same store finds the wallet by name (108–112); navigation MOCKED (wouter spy — asserted called, 106); notification SPIED (`bumpVersion`, 107). Minor gap (INFO): the opening amount (75 → 7500 minor) is not re-asserted on read-back, only the wallet name.
2. **CashReversalEditor (115–146)** — seed via real `openWallet` + `adjust` writes; page renders with mocked `params.id`; REAL service (`CashContinuityService` reversal path); REAL storage effect — read-back finds the entry with `reversesEntryId === adjusted.id` (142–145); navigation mocked; notification spied.
3. **G5DeclarationEditor (148–169)** — REAL page + REAL service (`g5.createDeclaration` — page path VERIFIED at pages/G5DeclarationEditor.tsx:82, notify :98, navigate :100); REAL storage effect with **exact value verification** (`amountMinor === 4000` for input "40", 168); navigation mocked; notification spied.
4. **InventoryReversalEditor (171–204)** — seed via real `InventoryMaterialService.openMaterial` (confirmed opening movement); REAL page/service (`inventory` reversal); REAL storage effect — read-back finds the reversal movement linked by `reversesMovementId` (198–203); navigation mocked; notification spied.
5. **ReceivedLoanDetail (206–228)** — seed via real `ReceivedLoanService.create`; page reads loan id from `window.location.pathname` (pages/ReceivedLoanDetail.tsx:46–49, real browser history in jsdom) and constructs a **real `ReceivedLoanService` over `getPrototypeLocalStore()`** (mocked to the same real store — page lines 57–63); REAL derived reading: heading "سارة", status "قرض مستلم قائم", amount /80(\.00)?/ (221–224); `dataVersion` invalidation dependency exercised (page line 87). No write effect — correct for a reader page. Navigation mocked.
6. **SharePreview (230–245)** — REAL page boundary (draft arrives via `window.history.state` — the page's real channel, pages/SharePreview.tsx:23); real render + real copy-outcome UI ("نُسخ النص للحافظة…", 238) and real empty state after state clear (241). **No storage effect at all** (page is a text editor over history state — by design); copy channel MOCKED (`textDelivery` mock, 35–39). This journey is surface+state-channel only — acceptable for this page's nature, but it is the weakest of the six (no service/storage boundary exists to exercise).

**Verdict:** 5 of 6 journeys exercise the real page→service→store boundary with read-back verification (REAL boundary evidence); all six render the real page component. Navigation is uniformly mocked (spy) and notification uniformly spied — these channels are *asserted*, not end-to-end. SharePreview has no storage effect by nature; its copy effect is mocked. No journey fakes the page component or the service class.

---

## §3 Boundary and door matrix

| # | Edge | Rule & enforcement (file:line) | Live count | Baseline / exceptions | Verdict |
|---|---|---|---|---|---|
| 1 | **Domain→UI** | ESLint `eslint.config.js:26–68` — domain may import only relative modules (no React/aliases/app layers, incl. dynamic); browser globals banned | **0** React/UI imports in `src/domain` (the single grep hit "react" was the substring in `reactivation`, recurring-expense/policies.ts:333 — VERIFIED false positive) | none | **CLEAN / enforced** |
| 2 | **UI page/component→storage (value)** | ESLint pages `eslint.config.js:123–146`, components `:147–171` (`no-restricted-imports @/storage/local/*`, `allowTypeImports: true`); guard R5 resolution-based (check-module-boundaries.mjs:367–379) | **0** value edges in pages/components; **2** live value edges total, both app-shell: `StartupGate → persistentStorage`, `PrototypeServicesContext → createBrowserLocalStore` | R5 baseline `UI_TO_STORAGE_VALUE_BASELINE` = same 2 (mjs:272–275); ESLint waivers for both with **removal conditions** (eslint.config.js:301–332: StartupGate — move persist request behind an Application service; composition root — move store construction out of the shell); registry §5 rows 194–195, 204 | **enforced; 2 documented exceptions with owner+reason+exit condition** |
| 3 | **UI→storage (type-only)** | Policy: type imports allowed (STR-305, owner-deferred; registry §5 row 200 "17 UI files") | **17** non-test pages/components files with `@/storage` imports, **all verified type-only** (statement-level scan) | documented as owner-deferred decision (STR-305, registry §6 #5) | **matches documentation exactly (17)** |
| 4 | **UI→application (doors)** | Doors = `application/<house>/index.ts` (29 live == 29 in `scripts/application-door-surfaces-baseline.json` — exact match, VERIFIED); surface guard `check-application-door-surfaces.mjs` (exact value+type symbols, no `export *`) | **182** door-level import statements from UI layers (allowed path) | door surfaces baseline: 29 doors, rootFiles `[resultCodes.ts]`, notes `unconsumed-type-symbols` | **allowed + guarded** |
| 5 | **Deep imports bypassing doors (R6)** | `check-module-boundaries.mjs:380–395` + `R6-baseline-stale` cleanup (:415–425); baseline `scripts/ui-application-import-baseline.json` | **52 live deep edges == 52 baseline keys** (independently recounted with a resolution-equivalent script: 0 violations, 0 stale) | 36 composition-root (PrototypeServicesContext) + 16 wave keys; **12 dated notes** (10 × r7 view-model notes with owner/reason/consumer; `r7-5-shim-removal`; `r7-5-swap-keys`); description documents shrink-only ratchet + same-PR removal protocol | **ratcheted, fully documented; in sync** |
| 6 | **application→domain** | Allowed; deep-domain imports frozen by R1 (mjs:307–320) | 3 baseline deep imports (settlementInvariant ×1, operatingBreakEven ×2) — STR-205/D-034 documented budget-gate exceptions (registry §5 rows 187–188, 190) | DEEP_DOMAIN_IMPORT_BASELINE (mjs:224–228) | **enforced, 3 documented exceptions w/ reason (bundle budget)** |
| 7 | **presentation→domain** | presentation is inside `UI_LAYERS` (mjs:87, Wave H) → its domain VALUE edges are under R2 freeze | 2 value edges (ownerEntitlementPresentation→owner-entitlement; catalogPresentation→recurring-margin) + 2 type-only (catalogPresentation→catalog; financialEventLabels→financial-event) | both value edges in R2 baseline (registry §5 row 202 with dated Wave H note) | **enforced** |
| 8 | **UI→domain (value, R2)** | `check-module-boundaries.mjs:321–332`; STR-106/ADR-011 §1 (temporary guarded exception, migration condition 13→0 at UI track) | **15 live value edges == 15 baseline keys** (statement-accurate recount; +48 type-only edges, allowed) | UI_TO_DOMAIN_VALUE_BASELINE (mjs:233–249) | **enforced, in sync** |
| 9 | **application→presentation (R3)** | `check-module-boundaries.mjs:333–349`; closed in Wave B (ADR-011 §2) | **0** | baseline `[]` | **CLEAN** |
| 10 | **component→page (rule R7 of the guard — R8-F-019)** | `check-module-boundaries.mjs:44–52, 396–413`: all import forms (value/type/dynamic/ImportTypeNode/re-export), resolution-based; reverse direction free; exceptions only via explicit owner-reviewed list | **0 live edges** (grep of static + dynamic imports from `components/` resolving to `pages/` — VERIFIED) | `COMPONENT_TO_PAGE_BASELINE = []` (mjs:280, "empty at founding… not a drift baseline") | **enforced; 0 edges; 0 exceptions** |
| 11 | **domain cross-area deep (R4)** | mjs:350–366 | 3 pairs | baseline (mjs:263–267) = STR-030 documented | **enforced** |
| 12 | **application/storage UI-free** | ESLint `eslint.config.js:211–248` — no React, no `@/components`/`@/pages` even type-only | 0 violations reported by CI history (worklog R8-FULL: `pnpm check` exit 0) — INFERRED green; not independently executed (no-run constraint) | — | **enforced (inferred green)** |
| 13 | **reader→writer separation** | `scripts/check-application-readwrite.mjs`: 18 registered reader files (mjs:41–60; all 18 exist — VERIFIED) + PC-4 header auto-enrollment in 5 families (10 tagged files, all inside the 18); bans AST calls `/^(save\|commit\|delete\|replace\|clear)[A-Z]/` | 0 write-calls in the 18 readers (independent regex scan — VERIFIED) | 3 documented limits in header (writer-service vocabulary not covered; snapshot+tag enrollment gap — dated residual, owner successor; 7 writers deliberately outside roster) | **enforced within documented vocabulary** |
| 14 | **primitives are leaves** | ESLint `eslint.config.js:177–202` — no `@/pages|@/app|@/application|@/storage|@/components` (even types) | not independently executed (no-run) — INFERRED green via CI record | — | **enforced (inferred)** |

**Documented-exception register completeness (owner / reason / consumer / review trigger / exit condition):**
- ESLint waivers (StartupGate, PrototypeServicesContext storage; app Math ×4 files; test-file localStorage; domain-test vitest; shared Math): each carries reason + **removal/exit condition** in `eslint.config.js` comments (301–332, 359–399, 434–437) and registry §5 rows 194–200. Owner = owner-decision records (STR-037/STR-038). ✅ complete.
- R1/R2/R4/R5 guard baselines: registry §5 rows 187–204 carry reason + classification + dated corrections; R2/R5 have owner decisions (ADR-011 §1, STR-106) with measurable exit conditions (13→0 / UI-path migration). ✅ complete.
- R6 keys: baseline `notes` (12 dated notes) give reason + consumer + what removal requires; R7-4 report records the terminal set ("36 PSC + 16 wave keys"). ✅ complete.
- **Minor drift (finding F-3, INFO):** registry §5's inline headline still reads "43 keys [ADR-018] — 47 live sites… (dated 2026-10-09: 42 keys)" while the live baseline is 52 keys; the authoritative current state lives in the baseline notes + R7-4 report, but the registry headline was not re-dated after R7's view-model additions.

---

## §4 Runtime channels (non-import)

All are inventoried and governed by **OWNERSHIP-AND-TRUTH-REGISTRY.md §8-1** ("الأسطح التشغيلية المملوكة والقنوات غير الاستيرادية", PA-1..PA-4, added R1/TG-04 2026-10-07) — VERIFIED at lines 253–268:

| Channel | Owner file | What it invalidates/carries | Admission contract | Live consumers (non-test) | Documented |
|---|---|---|---|---|---|
| React Context `PrototypeServicesContext` | app/PrototypeServicesContext.tsx:160 | the canonical service graph + dataVersion | `PrototypeServices` interface (:87–159); provider rebuilds wrapper only | `usePrototypeServices` in **72** files; `getPrototypeLocalStore` in **6** files | registry §8-1 row 1 |
| `dataVersion` counter | same file :157/:165/:247 | monotonic invalidation counter; re-composes context wrapper, never rebuilds services | never read as semantic value | **62** files reference it | §8-1 row 2 |
| `BroadcastChannel "micro-data-changed"` | same file :162/:171–178 | cross-tab "data changed" ping (no payload) | frozen: channel name + payload-less message; second channel needs registry row + owner decision | writer window → all same-origin windows | §8-1 row 3 |
| React Context `QuickRecordingContext` | app/quickRecording.tsx:23 | quick-recording sheet state | `QuickRecordingContextValue` | **3** files | §8-1 row 4 |
| React Context `UnsavedChangesContext` | components/forms/UnsavedChangesGuard.tsx:15 | dirty-form guard registration | `UnsavedChangesContextValue` | **30** files | §8-1 row 5 |
| React Context `ThemeContext` | contexts/ThemeContext.tsx:18 | theme/direction | `ThemeContextType` | **5** files | §8-1 row 6 |
| Browser events (popstate/beforeunload/keydown/visibilitychange/resize/pointerdown/beforeinstallprompt) | component-local owners | local UI subscriptions | documented as **not** inter-unit channels | — | §8-1 row 7 |
| PWA SW registration/update | pwa/register.ts (registerSW, visibility handler, listener set) | service-worker lifecycle; does not broadcast between units | UI-local; incidents recorded via `localDiagnostics` | PwaRuntimeNotice etc. | covered under browser-events row + map §3 contract 38 (conceptual) |
| **Negative verification** | — | no production `CustomEvent`/`EventTarget`/`dispatchEvent`, no `storage` event listeners, no second BroadcastChannel | — | **0 matches** (VERIFIED by grep) | §8-1 row 8 (negative row) |

`notifyDataChanged` = `setDataVersion+1` + `channelRef.postMessage("changed")` (PrototypeServicesContext.tsx:179–182) — the single write-invalidation admission; exercised (spied) by all six journeys.

---

## §5 Compatibility shims

- **The 9 application/ compatibility shims are GONE** (R7/R7-5, commit bfa48d44 "compatibility-shim closure — 9 units removed with zero-consumer proof (26 consumers migrated…; bundle byte-identical)"): none of the 9 files (g5Service, finance/{ownerEntitlement, correctionHistory, retainedDeposit, recurringExpense}, expenseBudget, expenseRecordIntent, expenseCategorySuggestions…) exists in the live tree (VERIFIED by file checks). Registry §8-3 row 280 records **REMOVED_WITH_ZERO_CONSUMER_PROOF** with owner, trigger ("R7 order: migrate all consumers to canonical paths"), and evidence (R7-5 report + zero-consumer import scan + same-PR baseline cleanup).
- Case-insensitive `shim|compat` sweep over live client src (non-test) finds only **3 genuine items**, none a re-export shim:
  1. `application/transfers/transferCompatibilityValues.ts` — canonical **historical-compatibility value registry** for the transfer/import envelope (contract 39); consumed by `transferFamilyValidators.ts:25,84`, `agreementService.ts:26`, `agreementContextService.ts:19`. This is domain knowledge, not an import shim; guarded by `transferCompatibilityRegistry.test.ts` (self-cited :64–69). Not on a removal track (canonical).
  2. `application/finance/recurringWorkService.ts:7–12` — a documented **Compatibility Surface**: the *consumer surface* (`CatalogPoliciesSection`) keeps its visible location until Wave 4 (owner-approved); the service is owned by Finance; catalog files may not import it by value — guarded by `app/ownershipBoundaries.exe017.test.ts`. Owner/reason/guard documented in the file header; trigger = Wave 4.
  3. Presentation display-model compatibility interfaces (presentation re-exporting application modules: `formatters.ts:5`, `activityLabels.ts:5`, `orderAgreementPresentation.ts:5`) — counted separately in registry §8-3 ("واجهات عرض توافقية… مسار T"); direction is presentation→application (allowed; R3 governs the reverse).
- **Zero-consumer shims still existing: 0** (no finding).
- Plan policy for temporary facades/shims with owner+reason+removal conditions: REFACTORING-PLAN-A-TO-Z.md:339 (VERIFIED citation).

---

## §6 No-visual-UI-change boundary (git evidence)

### R7 merge `74908e13` "Merge R7 structural UI boundaries and shim closure" (parents e01d5605 + db78225d)

- Diff `e01d5605..74908e13`: **100 files**. By category: **0 `.css`, 0 `styles/`, 0 design-token files** (styles/ contains vf-tokens.css, theme-dark.css, primitives.css, brand-launch-splash.css — none touched); 39 `.tsx`; 33 `.ts`; 17 `.md`; 8 `.json`; 2 `.mjs`; 1 `.txt` (docs/fixtures golden); 1 `.py` (scripts/text_density_policy.py — measurement policy); 1 `.csv` (generated tracker).
- 16 production `.tsx` changed (1 app shell, 4 components, 11 pages). DOM-structure churn heuristic (`className=`/aria/JSX tags) flags only **EventsLayer.tsx ↔ FinancialEventRow.tsx** — verified a **pure verbatim move**: 65 removed DOM lines in EventsLayer == 65 added DOM lines in FinancialEventRow, byte-identical (diff of sorted line sets: identical). All other 14 production `.tsx` diffs: 0 DOM-structure lines (type/import/view-model rewiring only).
- Arabic-copy scan of the same diffs: non-comment copy changes are (a) OrderDetail action-menu labels — **identical strings**, only the condition source moved to `sections.canEditPrice/canReverseCollection/canCancel` (deriveOrderSectionDecisions); (b) Finance error message `"لم يتم تغيير بياناتك. أعد فتح التطبيق للمحاولة."` — **moved verbatim** to application/finance/financeState.ts:178; DirectSaleEditor: 0 non-comment copy changes.
- **Verdict: R7 visual boundary HELD** (no CSS/token/DOM-structure/copy change; the only DOM churn is a verified verbatim component move; entry bundle byte-stability independently recorded in R7 evidence).

### R8 merge `87274cf9` "Merge R8 bundle and guard remediation" (parents 1e267864 + 7a928fac)

- Diff `1e267864..87274cf9`: **27 files — 0 `.tsx`, 0 `.css`, 0 pages/components**: apps/prototype-web build/guard files (bundle-surfaces-baseline.json, check-bundle-surfaces.mjs + test, vite.config.ts), root guard scripts (check-file-size-ratchet.mjs + test, check-module-boundaries.mjs + test, ratchet baselines/reanchors), 13 docs/operations files (incl. generated csv/xlsx-meta/json).
- **Verdict: R8 visual boundary HELD trivially** — no UI production code of any kind was touched.

---

## Findings

- **F-1 (INFO, gap):** CashWalletEditor journey read-back asserts only the wallet's name, not the declared opening balance (75 → 7500 minor). Suggest one extra assertion if that file is ever touched again. (SmokeOnlyPagesJourneys.dom.test.tsx:108–112)
- **F-2 (INFO, inherent):** All six journeys mock wouter navigation (spy) and spy `notifyDataChanged`; the channels are asserted, not exercised end-to-end; SharePreview's copy channel is mocked (no clipboard in jsdom). Acceptable for DOM-level journeys; the real notification path is covered by the provider wiring (PrototypeServicesContext.tsx:179–182) which the journeys deliberately bypass via the context mock.
- **F-3 (INFO, doc drift):** OWNERSHIP-AND-TRUTH-REGISTRY.md §5 headline still cites the R6 baseline as "43 keys / 47 live sites → 42 keys (dated 2026-10-09)" while the live baseline is 52 keys (36 PSC + 16 wave keys, 12 dated notes). Current truth is documented in the baseline file itself + R7-4 report; a dated registry correction would remove the ambiguity.
- **F-4 (INFO, pin artifact):** test-map.json `head` pin (4d60d1bc, an R7-4 commit) predates HEAD; content independently verified live-accurate (55/55/5/60 all match live tree), and no test file changed since the pin — the known generator self-reference pattern (HAF-4), no action needed beyond awareness.
- **No CLEAN/blocking findings.** Zero undocumented boundary edges; zero component→page edges; zero UI→storage value edges beyond the 2 documented app-shell exceptions; zero shims remaining; zero-consumer shims: 0.

## Summary counts

- Pages: **60** (all routed; 64 page routes + 2 redirects = 66 Route elements). Routes without a page: **2** (both intentional redirects, documented).
- Evidence classes (canonical map, live-verified): **55 direct + 5 named-reference + 0 missing**; zero-direct-test pages: **5**.
- Six journeys: **5/6 REAL page→service→storage boundary evidence with read-back; 1/6 (SharePreview) surface + state-channel only (by nature)**; overall verdict: genuine boundary journeys, not mocked theater.
- Boundary edges: component→page **0**; UI→storage value **0** (pages/components) + **2** documented app-shell exceptions; UI→domain value **15** (baseline 15); deep UI→application **52** (baseline 52, 12 dated notes); application→presentation **0**; domain deep-imports from outside **3**; domain cross-area **3**; reader files guarded **18** (+PC-4 auto-enrollment; 0 write calls).
- Doors: **29 live == 29 baseline**; 182 door-level UI→application imports.
- Runtime channels: **6 registered + browser-events row + negative row**; all documented in registry §8-1; 0 unregistered channels found (no storage listeners, no CustomEvent, single BroadcastChannel).
- Shims: **9 removed (R7-5, zero-consumer proof)**; live compat surfaces: 1 canonical value registry + 1 documented consumer-surface exception + presentation re-export layer; **0 zero-consumer shims**.
- R7/R8 visual boundary: **HELD / HELD** (0 CSS/token/DOM-structure/copy changes; EventsLayer→FinancialEventRow proven verbatim move; R8 touched no UI code at all).
