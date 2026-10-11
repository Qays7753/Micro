# R10-B — Specialist Reviewer Report (RV3: UI structure / runtime / accessibility / journeys)

- **Role:** R10-B Reviewer 3 — page states, error/not-found/loading separation, ErrorBoundary behavior, ARIA semantics, direct-page tests, smoke & route coverage, UI duplication of domain derivations. Structure/semantics only — no visual redesign judgments.
- **SHA verified:** `git -C /home/z/my-project/r10b/clone rev-parse HEAD` → **`ffc54eb1150932c9bba88b48a7c38275f2a3effa`** (matches expected HEAD; commit dated 2026-10-11 13:23:04 +0300).
- **Date:** 2026-10-11 (UTC).
- **Read-only statement:** No file inside the clone was modified, created, deleted, or staged. No git write commands, no installs, no builds, no test runs, no network. All python/rg invocations were read-only scans. The only writes were to `/home/z/my-project/r10b/scratch/reviewers/` (this report + `rv3-coverage-matrix.txt`). The prior R10-A package under `scratch/r10a-package/` was read only as an untrusted list of claims to re-verify; every conclusion below comes from my own live inspection of the clone at the SHA above.

---

## 1. Commands actually executed

```
git -C /home/z/my-project/r10b/clone rev-parse HEAD
ls / Grep/Glob/Read over: apps/prototype-web/client/src/**, scripts/check-application-readwrite.mjs,
  docs/contracts/40-*.md, docs/architecture/refactoring/**, docs/operations/current-state-log.md
python3 (read-only) — counts of smoke ROUTES, page→test import mapping, application-file
  read/write classification, role=/aria-live inventory, moneyLayerGuard frozen-surface reproduction,
  3-way coverage matrix generation
sed -n (read-only) over specific line ranges cited below
```

No builds, no `pnpm`, no vitest runs, no browser, no network. All evidence is static reading plus read-only script reproduction of guard logic.

## 2. Files / symbols / line-ranges inspected (principal)

| File | Lines/what |
|---|---|
| `apps/prototype-web/client/src/components/ErrorBoundary.tsx` | 1–83 (whole file; `componentDidMount` 27–29, `getDerivedStateFromError` 30–32, `componentDidCatch` 33–53, fallback render 54–79, `role="alert"` 57, `tabIndex={-1}` h1 62) |
| `apps/prototype-web/client/src/components/ErrorBoundary.dom.test.tsx` | 1–153 (all 4 tests render `<Bomb/>` at mount; focus assertion line 62) |
| `apps/prototype-web/client/src/App.tsx` | 1–26 (single top-level boundary at 11) |
| `apps/prototype-web/client/src/main.tsx` | 1–8 |
| `apps/prototype-web/client/src/R2.renderSmoke.test.tsx` | 1–215 (comment "(55)" at 56–57; ROUTES 58–116; `assertRoutePainted` 130–142; keyboard test 180–213) |
| `apps/prototype-web/client/src/app/MicroRouter.tsx` | 1–258 (all 65 `<Route path>` + catch-all 239; `RouteLoadingState` 251–257) |
| `apps/prototype-web/client/src/components/layout/MicroAppShell.tsx` | 1–97 (`<main … key={location}>` at 86) |
| `apps/prototype-web/client/src/app/StartupGate.tsx` | 1–99 |
| `apps/prototype-web/client/src/components/primitives/Notice.tsx` | 1–102 (`Notice` 22–32, `QuietCompletion` 39–50, `InlineError` 52–66, `FeedbackNote` 93–101) |
| `apps/prototype-web/client/src/components/primitives/markers.tsx` | 1–39 (`StateMarker` 22–39) |
| `apps/prototype-web/client/src/components/primitives/Field.tsx` | 1–65 (wiring 34–44; error paragraph `role="status"` 55–59) |
| `apps/prototype-web/client/src/components/primitives/StatusChip.tsx`, `Button.tsx`, `EmptyState.tsx`, `BrandMark.tsx` | whole files (ARIA forwarding / naming) |
| `apps/prototype-web/client/src/presentation/stateAdapter.ts` | 1–168 (`StateMarkerRole` 21–32) |
| `apps/prototype-web/client/src/ErrorAnnouncementSemantics.r9.dom.test.tsx` | 1–225 (R9 inventory scope 86–99, 122–156, 158–194; behavioral 199–224) |
| `apps/prototype-web/client/src/StateRecovery.w44.dom.test.tsx` | 1–248 (retry 53–94; gated loading 96–134; 27-page census 140–189; double-submit 191–207) |
| `apps/prototype-web/client/src/Accessibility.w44.dom.test.tsx` | 1–~200 (names/aria-invalid/describedby/keyboard/static) |
| `apps/prototype-web/client/src/SmokeOnlyPagesJourneys.dom.test.tsx` | 1–246 (W7 six pages) |
| `apps/prototype-web/client/src/moneyLayerGuard.contract.test.ts` | 1–254 (FROZEN_SURFACE 48–67; view-model zero-arith 96–123) |
| `scripts/check-application-readwrite.mjs` | 1–153 (READER_FILES 41–60; PC4_FAMILIES 63; WRITE_CALL 38; limits 15–23) |
| `scripts/generate-test-map.mjs` + `docs/architecture/refactoring/generated/test-map.json` | classification logic 159–207; JSON head/`withoutDirectEvidence`/4 pages |
| `docs/contracts/40-technical-ownership-map-contract.md` | 1–96 (stale citation at **line 18**) |
| Pages (state machines / roles / arithmetic): `OrderDetail.tsx` (230–260, 300–346, 580–620, 930–974, 1225–1254, 1340–1399, + money-guard lines), `SupplierPurchaseEditor.tsx` (505–564), `Statement.tsx` (745–774), `DirectSaleEditor.tsx` (220–254), `DeliveryReview.tsx` (425–464), `AgreementEditor.tsx` (270–350), `CashWallets.tsx` (60–120), `CashOpeningLaterEditor.tsx` (60–130), `Finance.tsx` (1440–1500), `FinanceUpcoming.tsx` (1–70, 195–215), `FinanceRecurring.tsx`, `RecurringExpenseDetail.tsx` (230–260, 490–560), `LoanEditor.tsx` (95–120), `ReceivedLoanDetail.tsx` (45–100), `Tools.tsx` (70–100, 185–225), `CashCount.tsx`, `Catalog.tsx` (645–655, FeedbackNote 810), `DraftEditor.tsx` (470–482) |
| Components: `UnsavedChangesGuard.tsx` (180–303), `AppHeader.tsx` (1–321), `QuickActionSheet.tsx` (1–351), `ui/drawer.tsx`, `AppLockGate.tsx` (130–200), `DataActionPinGate.tsx` (1–100), `BrandLaunchSplash.tsx` (60–110), `BottomNav.tsx`, `FinancialEventRow.tsx` (300–330), `WalletLedger.tsx` (40–60, 180), `PwaRuntimeNotice.tsx` (50–100), `EventEffectPreview.tsx` (130–160), `QuickSaleForm.tsx` (325–355) |
| Application read-like spot checks: `home/homeControlCenterService.ts`, `parties/partyLedgerService.ts`, `financial-pulse/financialPulseService.ts`, `cash/walletLedgerService.ts`, `follow-up/dailyFollowUpService.ts`, `activity/activityService.ts` |
| Docs: `current-state-log.md` §125 (W7), `R0-LIVE-BASELINE-AND-FINDING-RECONCILIATION-2026-10-07.md:138` (F-12 CLOSED), `FILE-SIZE-AND-RESPONSIBILITY-REGISTER.md:356` (R7-5 removal note), `R7-5-SHIM-CLOSURE-EXECUTION-REPORT`, R9 repair-card/report lines for F3.6 inventory scope |

---

## 3. Part A — R10-A findings re-verified from live source

### R10A-F-016 (S2) — ErrorBoundary focus management dead for post-mount crashes → **CONFIRMED**

- `components/ErrorBoundary.tsx:27-29` — `componentDidMount() { if (this.state.hasError) this.headingRef.current?.focus(); }` is the **only** focus call in the boundary.
- Lifecycle trace: constructor sets `hasError:false` (25). If a child throws **during the initial mount render**, React calls `getDerivedStateFromError` (30–32) *before commit*, the fallback commits, and then `componentDidMount` runs with `hasError===true` → focus works. This is the only path the DOM tests exercise (`ErrorBoundary.dom.test.tsx:46-64` renders `<Bomb/>` as initial children; assertion at line 62 passes for exactly this reason).
- If a child throws **after mount** (a state/prop update re-render — the realistic runtime-crash case for a long-lived SPA session): `componentDidMount` has already run once (with `hasError===false` at that time) and is **never re-invoked**. `getDerivedStateFromError` flips state and the fallback commits, but `componentDidCatch` (33–53) only records the incident (`setState({incidentId})` at 52 — a re-render of the *same* fallback elements, which does not re-run any focus logic). **No focus movement occurs.**
- How a post-mount crash is currently announced: the fallback root is `<main … role="alert">` (line 57). Because the boundary's output changes type (children subtree → `<main>`), React unmounts the old subtree and **inserts a new alert element into the DOM**; per ARIA live-region semantics this is an assertive announcement of the fallback content (browser/AT-dependent — see E-UNV-002). So: announced best-effort, **focused never**. The previously focused element is destroyed with the old subtree, so keyboard focus silently falls back to `document.body`.
- Single boundary note: `App.tsx:11` wraps the whole app in one `ErrorBoundary` — any post-mount page crash replaces the entire shell (header/nav included) with the recovery card.
- Root-fix design options (no visual change to the fallback): see §7/F-016 options.

### R10A-F-015 (S3) — stale smoke list → **CONFIRMED**

- `R2.renderSmoke.test.tsx:56` comment: "كل مسارات الموجّه المسجّلة **(55)**" — but the `ROUTES` array (58–116) contains **56 URLs** (programmatic count = 56; the `/market` entry at 106 carries its own NAV-001 note, likely the un-counted addition).
- Router patterns absent from the smoke list (**9 explicit** patterns + the catch-all), from `MicroRouter.tsx`:
  1. `/finance/new/owner_withdrawal_cash` (legacy redirect, :146-148)
  2. `/finance/more` (:218)
  3. `/finance/upcoming` (:219)
  4. `/finance/recurring/new` (:223)
  5. `/finance/recurring/:id/edit` (:224)
  6. `/finance/recurring/:id` (:225)
  7. `/finance/recurring` (:226)
  8. `/loans/received/new` (:210)
  9. `/loans/received/:id` (:211)
  - plus the **NotFound catch-all** (:239) — no unknown URL in the smoke list (covered App-level by `Nav003.exe016.dom.test.tsx:111-116`).
- Direct page tests for the absent patterns: exactly **7 page components** — FinanceMore (`FinanceMore.w42.dom.test.tsx:21`), FinanceUpcoming (`FinanceUpcoming.dom.test.tsx:29`), FinanceRecurring + RecurringExpenseDetail + RecurringExpenseEditor (`RecurringExpenseSurfaces.dom.test.tsx:21-23`, `RecurringExpenseEditor.dom.test.tsx:17`), ReceivedLoanEditor (`ReceivedLoanEditor.w178.dom.test.tsx:17`), ReceivedLoanDetail (`ReceivedLoanDetail.dom.test.tsx:15` + `SmokeOnlyPagesJourneys.dom.test.tsx:28`). The remaining 2 are the legacy redirect (component-tested at `pages/OwnerJourneysExe009.dom.test.tsx:281-291`) and NotFound (App-level only). R10-A's "7 of 9" is exact under this reading.
- Net residual risk: smoke-only drift for the redirect target chain (redirect smoke would catch router-order regressions like the documented `/loans/received` before `/loans/:id` trap at MicroRouter.tsx:208-209) and the NotFound surface itself.

### R10A-F-017 (S3) — two error-announcement channels, polite channel outside the R9 inventory → **CONFIRMED (and REFINED: the polite channel has two members, not one)**

- Assertive channel: 127 static `role="alert"` sites in non-test sources + 11 tone-driven dynamic sites (`role={message.tone === "error" ? "alert" : "status"}` — CostCalculator.tsx:557, FinancialEventEditor.tsx:964, Schedule.tsx:356/565, CashCount.tsx:221, CashDistribution.tsx:261, Profile.tsx:307, SupplierPurchaseEditor.tsx:1142, ScheduleEditor.tsx:345, ActualTimePanel.tsx:394; plus inverted `success ? "status" : "alert"` at OwnerEntitlement.tsx:622 and AgreementContextPanel.tsx:182).
- Polite error channel (errors announced `role="status"`):
  1. `Notice.tsx:52-66` — `InlineError` renders `role="status"` with error styling + alert *icon*; it is the `kind:"error"` arm of `FeedbackNote` (Notice.tsx:93-101). Used for form/save errors in DraftEditor.tsx:477, Catalog.tsx:810, InventoryMaterials.tsx:265, FinancePoliciesSection.tsx:492, Settings sections (SettingsDataProtectionSection.tsx:471/551, SettingsOperatingModeSection.tsx:133), CostEditor.tsx:614. Tested as deliberate at `primitives.test.tsx:215-219` ("InlineError renders the error word…" asserts `getByRole("status")`).
  2. **(New instance R10-A did not cite)** `Field.tsx:56` — the Field primitive's own validation-error paragraph `micro-prim-field__error` also renders `role="status"`, while page-level `micro-field-error` elements were flipped to `role="alert"` by R9.
- Live inconsistency example: the same event class (form save/validation error) is **assertive** in `QuickSaleForm.tsx:352` (`micro-field-error` + `role="alert"`, id `quick-sale-form-error`) but **polite** in `DraftEditor.tsx:477` (`FeedbackNote id="draft-form-error" kind={feedback.kind}` → `role="status"`). Both are aria-describedby-wired to their inputs.
- R9 inventory scope check: `ErrorAnnouncementSemantics.r9.dom.test.tsx` pins `micro-field-error`-class surfaces (ERROR_ONLY_FILES 86–99), tone-split pages (122–156), preserved informational sites (158–172), and 8 read-error sections (174–194). `Notice.tsx`/`InlineError`/`Field.tsx` (classes `micro-prim-notice--error-inline`, `micro-prim-field__error`) appear **nowhere** in the inventory or its 99-element scan scope (R9 repair cards: inventory = `micro-field-error` + read-error sections). The polite channel is un-inventoried and un-pinned → future role regressions there are invisible.

### R10A-F-018 (S3) — StateMarker `role` prop never renders an ARIA role → **CONFIRMED**

- `markers.tsx:22` — `export function StateMarker({ role }: { role: StateMarkerRole })`. `StateMarkerRole` (stateAdapter.ts:21–32) is an icon-kind union (`check|clock|alert|close|return|eye|question|tilde|partial|dot|none`) — not ARIA.
- Every render path returns `aria-hidden="true"` content only (lines 23–38): a `~` glyph, CSS dots, or a lucide icon. **No `role` attribute is ever emitted to the DOM.**
- Consumers writing code that *reads* like ARIA: `Notice.tsx:62` (`<StateMarker role="alert" />` inside InlineError) and `Field.tsx:57` (same inside the field-error paragraph) — both currently announce politely (see F-017) while their source *looks* like it requests an alert. Third consumer `StatusChip.tsx:61` passes `presentation.markerRole` (correct intent: icon kind).
- This is the prop-name collision that makes the F-017 polite channel *look* fixed when read casually.

### R10A-F-019 (S3) — read-like application files outside readwrite-guard families → **CONFIRMED, count REFINED (62 by my reproduction, R10-A said 64)**

- Guard scope (scripts/check-application-readwrite.mjs): `READER_FILES` = 18 registered (41–60) + auto-enrolled `PC-4 read-model:`-tagged files, but the family scan (`PC4_FAMILIES`, line 63) only walks **finance, owner-money, financial-records, budgets, transfers**. Ban vocabulary = `^(save|commit|delete|replace|clear)[A-Z]` (line 38), with three documented limits (15–23), incl. limit 1: writer-*service* calls are not in the vocabulary.
- My independent count (read-only python, same vocabulary, non-test `.ts` under `application/`): 146 non-test files total; 51 inside the 5 families; 95 outside; **62 of the 95 have zero write-vocabulary calls** ("read-like"); 33 outside-family files contain write-vocab calls (they are the by-design writers of other families: inventory/cash/agreements/suppliers/…). The 2-file delta vs R10-A's 64 is a counting-method difference (barrels/type-only files), not a disagreement in kind.
- Spot-check of 5 (+1) read-like files for unsanctioned writes — **all clean** (only `list*`/`get*`/`read*` store calls, type-only storage imports): `home/homeControlCenterService.ts` (store.getProfile/listSchedules/listFinancialEvents/getPreferences/listDirectSales), `parties/partyLedgerService.ts` (listOrders/listDirectSales/listSupplierPurchases/listFinancialEvents), `financial-pulse/financialPulseService.ts` (listOrders), `cash/walletLedgerService.ts` (listCashWallets/listCashContinuityEntries), `follow-up/dailyFollowUpService.ts` (listDrafts/listOrders), `activity/activityService.ts` (7× list*).
- Residual: the "reader does not write" invariant is *unproven* (not violated) for these ~62 files; a reader calling a writer service (documented limit 1) would pass both the guard and my vocabulary scan.

### R10A-F-020 (S3) — three pages remain smoke-only after W7 retired the class → **CONFIRMED**

- Import scan over all 341 test files in `client/src` (verified count): **60 page components**; 4 with **no direct test import**: `AgreementEditor`, `CashOpeningLaterEditor`, `CashWallets`, `NotFound`.
- NotFound is covered at App level (`Nav003.exe016.dom.test.tsx:111-116` — unknown route → heading + back button). The remaining **three** are render-smoke-only: their routes appear in `R2.renderSmoke.test.tsx` (`/orders/draft/draft-x/agreement` :65, `/cash/wallet/wallet-x/opening-later` :80, `/cash` :74) and nowhere else.
- The generated test map masks this: `docs/architecture/refactoring/generated/test-map.json` classifies all three as `named-reference` (AgreementEditor ← `moneyLayerGuard.contract.test.ts`, a *static source check*; CashOpeningLaterEditor/CashWallets ← `StateRecovery.w44.dom.test.tsx`, a *static census*; CashWallets also "cited" by `CashAdjustmentEditor.dom.test.tsx` only via a `listCashWallets()` method name — false-positive evidence). `pages.withoutDirectEvidence` is `[]`, so nothing surfaces the distinction.
- What W7/R9 claimed: `current-state-log.md` §125 (W7, 2026-10-05) added journeys for exactly the six F-12 pages (CashReversalEditor, CashWalletEditor, G5DeclarationEditor, InventoryReversalEditor, ReceivedLoanDetail, SharePreview — verified present in `SmokeOnlyPagesJourneys.dom.test.tsx`); `R0-LIVE-BASELINE-AND-FINDING-RECONCILIATION-2026-10-07.md:138` closed F-12 on that basis. The *class* (pages with no direct behavioral test) still has 3 members + NotFound(App-level only). Note the three were never in the six-page F-12 list — the closure was true for its stated scope and over-broad as a class-retirement claim.

### R10A-F-021 (S3) — UI preview arithmetic duplicates Domain derivations → **CONFIRMED, scope REFINED (family is 18 files / 45 lines, frozen by a guard R10-A under-cited)**

- All 7 R10-A-cited sites verified live:
  - `OrderDetail.tsx:596` `remainingMinor = agreedPriceMinor - collectedMinor` (deposit ceiling validation)
  - `OrderDetail.tsx:941,961` `Math.max(newPriceMinor - collectedMinor, 0)` (price-revision preview)
  - `OrderDetail.tsx:1237` `Math.max(agreedPrice - collected - extraDeposit, 0)` (deposit preview)
  - `OrderDetail.tsx:1349-1394` reversal preview rows (`collected - reversal`, `receivable + reversal`; wallet/unallocated rows come from the service `preview.*`)
  - `SupplierPurchaseEditor.tsx:517-518` `paidAfter = initial + laterPayments - reversed`; `payable = total - paidAfter`
  - `SupplierPurchaseEditor.tsx:553-555` reversal preview (`payable + amount`, `paid - amount`)
  - `Statement.tsx:760-761` sum of two already-derived reading fields; `DirectSaleEditor.tsx:235` `difference = revenue - resolvedCollected`; `DeliveryReview.tsx:442` `Math.abs(finalPrice - agreed)`
- **Refinement:** `moneyLayerGuard.contract.test.ts:48-67` (W5-A, family F-049) freezes the *entire* UI money-arithmetic surface at **18 files / 45 lines** (OrderDetail 13, OrderDepositPanels 7, SupplierPurchaseEditor 5, CatalogReadingsSection 3, DirectSaleEditor 2, QuickSaleForm 2, OwnerEntitlement 2, + 11 files at 1 each). I reproduced the guard's regexes read-only: **observed == frozen (45/45, no file missing, no unaccounted file)** — the guard is green at HEAD and any *new* site fails by file. Contract 40 §8 (line 91) also documents the OrderDetail 13 mirrors.
- Per-site drift risk (existing mirrors can silently diverge from domain kernels — the guard pins line *counts*, not *values*):
  - **High:** SupplierPurchaseEditor 510-518 (re-implements the paid/payable allocation kernel: initial + later − reversals); OrderDepositPanels 94/230/233/297 (standing-deposit math incl. `?? 0` null-coalescing semantics).
  - **Medium:** OrderDetail 596/941/961/1237/1349-1394 (owner-facing previews; wrong preview erodes trust though writes stay service-side); CorrectionsLayer 233, WalletLedger 153, OwnerEntitlement 1000-1003 (reduce-based mirrors).
  - **Low:** Statement 760 (presentational sum of two reader fields), DeliveryReview 442, DirectSaleEditor 235/886, CashCount 96, Collect 419, sign-flips (CashAdjustmentEditor 79, CashDistribution 127, OwnerWithdrawalEditor 151), AgreementEditor 171 (qty multiplication for a default value).

### R10A-F-022 (S3) — contract 40 cites a removed compat module as live → **CONFIRMED (citation is at line 18, not ~89)**

- `docs/contracts/40-technical-ownership-map-contract.md:18` — owner-entitlement row says the live owner is `application/owner-money/ownerEntitlementService.ts` **"(التاريخي `application/finance/ownerEntitlementService.ts` بقي وحدة توافق للواجهة المجمدة)"** — "the historical … remained as a compatibility unit for the frozen interface".
- Live tree: `application/finance/` contains **no** `ownerEntitlementService.ts` (full directory listing checked). The module was removed by R7-5: `FILE-SIZE-AND-RESPONSIBILITY-REGISTER.md:356` carries the dated correction ("أزيل بقرار R7-5 (bfa48d44) — الصف تاريخي؛ المالك الحي `application/owner-money/ownerEntitlementService.ts`"), and `R7-5-SHIM-CLOSURE-EXECUTION-REPORT-2026-10-10.md:12` documents the `finance/ownerEntitlementService` → `owner-money` migration. R9's reviewer-1 already flagged the register rows; the **binding contract 40 §2 row itself** still asserts the shim is alive.
- Note: line ~89 of contract 40 is the IndexedDbLocalStore row — unrelated. The R10-A pointer was off by 71 lines; substance confirmed.

---

## 4. Part B — Mandatory analogous-pattern inventories

### B.1 — All focus-management paths

| # | Site (file:line) | Pattern | A11y-correct? |
|---|---|---|---|
| 1 | `components/ErrorBoundary.tsx:28` | focus h1 (tabIndex=-1, :62) on crash | ❌ Only on mount-time crashes — dead for post-mount (F-016). Announced via inserted `role="alert"`; focus falls to body. |
| 2 | `components/forms/UnsavedChangesGuard.tsx:227-234, 235-257` | dialog: focus in → stay button; Tab trap (buttons only); restore to trigger on unmount; Esc=stay | ✅ Correct (trap enumerates only `button:not([disabled])` — sufficient here, all focusables are buttons). |
| 3 | `components/layout/AppHeader.tsx:121-129` | soon-panel: focus first focusable on open (setTimeout 0) | ✅ |
| 4 | `AppHeader.tsx:90-118` | soon-panel Tab trap + Esc→restore trigger | ✅ (panel is `aria-modal="false"` yet trapped — deliberate non-modal "honest" panel; minor semantic mismatch, see B.1 note below) |
| 5 | `AppHeader.tsx:71-74, 76-85` | menu/panel close → restore focus to trigger | ✅ (pointer-outside closes without restore — correct) |
| 6 | `AppHeader.tsx:154-166, 211-217` | menu arrow/Home/End navigation; ArrowDown/Enter from trigger | ✅ (focus stays on trigger after *click*-open; arrows move in — acceptable menu idiom) |
| 7 | `components/ui/drawer.tsx` (vaul/Radix) + `QuickActionSheet.tsx` | Drawer portal: focus management delegated to Radix Dialog (focus in/trap/restore) | ✅ by delegation (not verifiable in jsdom — E-UNV-002) |
| 8 | `components/security/AppLockGate.tsx:130-200` | lock overlay: `role="dialog"` + `aria-modal` + veil `aria-hidden` + content `inert` when locked + `autoFocus` pin input (:177) | ✅ strongest dialog in the codebase |
| 9 | `components/security/DataActionPinGate.tsx:55-98` | alertdialog + autoFocus input (:83) | ⚠️ focus-in via autoFocus only; no trap, no restore (embedded in Settings flow) |
| 10 | `pages/Settings.tsx:691-712` | `protectionBlocked` `role="alertdialog"` + `aria-modal="true"` + OK button | ⚠️ no focus move-in, no trap, no restore, background not inert/hidden |
| 11 | `pages/RecurringExpenseDetail.tsx:246, 498, 544` | inline `role="dialog"` panels (cancel/snooze/skip) | ⚠️ non-modal inline panels labeled "dialog": no aria-modal, no focus move — misleading SR semantics (see NF-3) |
| 12 | `pages/WalletLedger.tsx:49-53` + `:180` | `?entry=` deep-link → `scrollIntoView` + `focus()` on row (tabIndex=-1) | ✅ focus-target pattern |
| 13 | `components/finance/FinancialEventRow.tsx:112-117, 316` | `focused` prop → scrollIntoView + focus (preventScroll), aria-label "focused event from corrections log" | ✅ |
| 14 | `MaterialSheet.tsx:112`, `CorrectionPreview.tsx:142`, `FinancialEventRow.tsx:638`, `Setup.tsx:312/326`, `OwnerEntitlement.tsx:1127`, `AppLockGate.tsx:177`, `DataActionPinGate.tsx:83` | `autoFocus` on primary input in sheets/gates/forms | ✅ (single-shot; acceptable) |
| 15 | **Route changes** — `MicroAppShell.tsx:86` `<main … key={location}>` | full remount of main per navigation | ❌ **No route-change focus management at all** (focus silently falls to `<body>` on every navigation) and **no per-route `document.title`** anywhere in `client/src` (zero matches). New finding NF-1. |
| 16 | Loading→content transitions (54 `micro-route-loading` blocks, all `role="status"`) | no focus move on settle | ✅ (correct: loading regions are announcements, not focus targets) |
| 17 | Toasts | none — Toaster removed (App.tsx:2-3, Q-003); feedback is inline | ✅ n/a |

### B.2 — Error-announcement / live-region inventory (non-test sources)

- **`role="alert"` — 125 DOM sites** (127 matches minus 2 that are `<StateMarker role="alert"/>` icon calls at Notice.tsx:62 and Field.tsx:57, which render **no** DOM role — F-018). Full list by file captured in scan; distribution: ~70 pages sites + ~30 component sites, incl. read-error paragraphs, `micro-field-error` messages, lock-gate errors, storage boot error (StartupGate.tsx:86), ErrorBoundary fallback (ErrorBoundary.tsx:57), finance block fallbacks (Finance.tsx:1491, FinanceUpcoming.tsx:203, FinanceRecurring.tsx:87, RecurringExpenseDetail.tsx:132).
- **`role="status"` — 124 sites**: loading texts (54), quiet completions, advisory notices, effect previews (EventEffectPreview.tsx:143), receipt (QuickActionSheet.tsx:308), offline card (PwaRuntimeNotice.tsx:93), route loading (MicroRouter.tsx:253), splash status (BrandLaunchSplash.tsx:86). **Includes the two polite *error* channels** (InlineError Notice.tsx:58; Field error Field.tsx:56) — the F-017 inconsistency.
- **Dynamic role sites — 11**: `tone === "error" ? "alert" : "status"` family (9) + inverted success/alert (OwnerEntitlement.tsx:622, AgreementContextPanel.tsx:182). These implement the R9 canonical "tone carried in state" pattern.
- **`aria-live="polite"` without role — 17 sites**: all advisory/neutral content (selected-date echo LocalDateField.tsx:36; effect previews MaterialEditor.tsx:231, InventoryMovementEditor.tsx:941, ActualMaterialPanel.tsx:15, ActualTimePanel.tsx:100; settings copy diagnostics SettingsDataProtectionSection.tsx:198/360/508; PWA notices PwaInstallControl.tsx:86, PwaRuntimeNotice.tsx:55). **No error is announced via bare aria-live.**
- **Redundancy**: 9 sites carry both `role="status"` and `aria-live="polite"` (harmless duplication; cosmetic).
- **Other roles**: `note` ×10, `group` ×10, `dialog` ×6, `alertdialog` ×3 (Settings.tsx:691, QuickActionSheet.tsx:228, DataActionPinGate.tsx:55), `tab` ×2 + `tablist` ×1 (Finance.tsx:336), `presentation` ×2, `region` ×1, `grid`+`gridcell` (Schedule.tsx:773), `menu`+`menuitem` (AppHeader.tsx:262ff), `img` dynamic (BrandMark.tsx:42).
- **Uniqueness of channel per surface**: page-level field errors and read-error sections = assertive (R9-pinned); primitive-level field/feedback errors (Field, InlineError) = polite (**un-pinned**); validation-vs-save distinction tested (Accessibility.w44: error raises aria-invalid, save failure does not).
- **Nested live region**: PwaRuntimeNotice.tsx:55 container `aria-live="polite"` with a nested `role="alert"` dirty-warning (:65) — valid but AT-queueing behavior unverifiable statically (E-UNV-002).

### B.3 — Components accepting ARIA-related props

| Component | ARIA-ish prop | Rendered to DOM? |
|---|---|---|
| `StateMarker` (markers.tsx:22) | `role: StateMarkerRole` | ❌ **No** — icon-kind prop; all output `aria-hidden` (F-018) |
| `Notice`/`QuietCompletion`/`InlineError` (Notice.tsx) | `markerRole` (icon), rest `HTMLAttributes` | ✅ aria-* via `{...rest}`; role hardcoded `status` *before* `{...rest}` (consumer could override — unused escape hatch) |
| `Field` (Field.tsx) | `controlId` wiring | ✅ auto `aria-invalid` + `aria-describedby` on child control (34–44); wrapper rest forwarded |
| `Button` (Button.tsx:48) | `aria-busy` on loading; rest forwarded | ✅ (`aria-busy` before `{...rest}` — overridable; unused) |
| `StatusChip`, `EmptyState`, `Row`, `ChoiceRow` | rest `HTMLAttributes` | ✅ forwarded via `{...rest}` |
| `BrandMark` (BrandMark.tsx:34-49) | `label` | ✅ decorative ⇒ `alt=""`+`aria-hidden`; labeled ⇒ `role="img"` |
| Everything else | via HTMLAttributes spreads | ✅ systematic scan found **no other custom ARIA-named prop** in pages/components/app/pwa/presentation |

### B.4 — Router × smoke × direct-test × a11y-semantics coverage matrix

Full 66-row matrix generated read-only and saved to `scratch/reviewers/rv3-coverage-matrix.txt` (route pattern → smoke? → direct page test → R9-error-roles / W44-state-census). Summary:

- **Router:** 65 explicit `<Route path>` + 1 catch-all (NotFound); 2 redirect holders (`/review`→`/finance`, `/finance/new/owner_withdrawal_cash`→`/finance/withdraw`); 60 lazy page components, all routed (0 orphans — set-diff verified via test-map import scan).
- **Smoke:** 56 URLs × 2 themes + keyboard operability test (R2.renderSmoke).
- **Direct page tests:** 56/60 pages imported by ≥1 test file; **3 smoke-only** (AgreementEditor, CashOpeningLaterEditor, CashWallets — F-020); NotFound App-level only.
- **Absent from smoke:** 9 explicit patterns + catch-all; of those, 7 page components have direct tests (recurring ×4, received-loans ×2, finance/more+upcoming), the legacy redirect has a redirect-component test, NotFound has the Nav003 unknown-route test.
- **A11y-semantics tests per page:** R9 error-role contract covers 21 pages (8 read-error + 9 tone-split incl. CostCalculator overlap + 8 error-only files + OwnerEntitlement special); W44 state census covers 27 pages (static regex); Accessibility.w44 behaviorally covers Loans/QuickSaleForm/Field. Not covered by any a11y-semantics test: the 3 smoke-only pages, FinanceMore, FinanceRecurring family, ReceivedLoanEditor/Detail (state machine) — i.e., the same routes absent from smoke mostly lack a11y-semantics pins too.

### B.5 — All UI copies of Domain calculations (F-021 family, beyond the 7 known)

Complete frozen family (moneyLayerGuard FROZEN_SURFACE, reproduced 45/45 at HEAD): OrderDetail.tsx (13 lines: 596, 941, 961, 1099, 1103, 1196, 1237, 1294, 1349, 1354, 1376, 1381, 1394), OrderDepositPanels.tsx (7: 94, 230, 233, 297, 373, 388, 423), SupplierPurchaseEditor.tsx (5: 512, 517, 518, 553, 555), CatalogReadingsSection.tsx (3: 150, 151, 156), DirectSaleEditor.tsx (2: 235, 886), QuickSaleForm.tsx (2: 195, 337), OwnerEntitlement.tsx (2: 1000, 1003), and 1 each: Statement.tsx:760, OwnerWithdrawalEditor.tsx:151, DeliveryReview.tsx:442, Collect.tsx:419, CashDistribution.tsx:127, CashCount.tsx:96, CashAdjustmentEditor.tsx:79, AgreementEditor.tsx:171, WalletLedger.tsx:153, AllocationReviewCard.tsx:40, CorrectionsLayer.tsx:233. **No site exists outside the frozen table** (my scan found zero unaccounted files). Mitigations: view-model modules extracted in R7 are pinned at zero money-arithmetic (guard lines 96-123). Residual risk = value-drift of existing mirrors only (see F-021 per-site assessment).

### B.6 — Page state machine consistency (sample of 10+ pages incl. known-gap pages)

Canonical pattern: `loading` ⇒ `<div|p class="micro-route-loading" role="status">` (**54/54 elements carry role=status — zero misses**); read-error ⇒ `role="alert"` paragraph + retry; not-found ⇒ separate state/`data-void` with back action; per-block isolation (G-005) for composed readers.

| Page | loading=status | read-error=alert+retry | not-found ≠ error | Notes |
|---|---|---|---|---|
| OrderDetail.tsx:308/314-331/333-346 | ✅ | ✅ | ✅ (`data-void="error"` vs `"no-data"`) | gold standard |
| Finance.tsx:292-300 + block fallbacks 1487-1497 | ✅ | ✅ (page + per-block `role="alert"` + retry) | n/a (composed reader) | G-005 pattern |
| FinanceUpcoming.tsx:64-69 + 203-209 | ✅ | ✅ per-block only (top-level `readOverview()` is infallible by service design — blocks carry failures; verified `upcomingService.ts:90-156`) | n/a | consistent |
| CashWallets.tsx:69-89 (smoke-only) | ✅ | ✅ (alert + retry + finance exit) | ✅ | consistent; only test coverage missing |
| CashOpeningLaterEditor.tsx:101-120 (smoke-only) | ✅ | ✅ (+ `already_known` honest state) | ✅ | consistent; only test coverage missing |
| **AgreementEditor.tsx:320-339 (smoke-only)** | ✅ | ❌ **no `role="alert"` on message; `state==="error"` merged with `!draft || !preview?.ok` ("cost unavailable") under one heading**; recovery = navigate to cost editor (a real path, but no retry) | ⚠️ merged | **new finding NF-2**; outside R9's 8 read-error sites AND the W44 27-page census |
| WalletLedger.tsx:74-92 | ✅ | ✅ | ✅ (honest "wallet unavailable" split) | R9-pinned |
| ReceivedLoanDetail.tsx:84-100 | ✅ (service-loading + data-loading phases) | ✅ (both phases) | ✅ (not_found rendering path exists) | honest lazy-service design |
| LoanEditor.tsx:104-110 | ✅ | n/a (create form; lazy-service null ⇒ honest "preparing service" message, save blocked) | n/a | documented honest null |
| Tools.tsx:80-96 | ✅ | ✅ (alert + reload-token retry) | n/a | |
| Catalog.tsx:649-653 | ✅ | form errors via FeedbackNote (polite — F-017) | n/a | |
| CashCount/CashDistribution/Schedule/Profile/etc. | ✅ | ✅ tone-driven (R9-pinned) | ✅ | |

---

## 5. Part C — E-UNV research input

### E-UNV-002 (visual parity / UX quality / screen-reader)

**Static analysis CAN prove (and largely has proofs in-repo):**
- Presence and wiring of ARIA semantics: roles (`alert`/`status`/`dialog`/`alertdialog`/`menu`/…), `aria-live`, `aria-modal`, `aria-invalid`/`aria-describedby` (Accessibility.w44, ErrorAnnouncementSemantics, primitives tests).
- DOM structure: landmarks (`nav[aria-label]` BottomNav.tsx:15, `main`, `header`), heading levels, `aria-current="page"` (BottomNav.tsx:49), accessible-name presence for icon buttons (Accessibility.w44:71).
- Focus *movability* (tabIndex=-1 + refs) and jsdom-level focus positions after events (ErrorBoundary test:62; R2 keyboard test; UnsavedChangesGuard trap logic is jsdom-testable).
- Keyboard handler presence (Esc/Tab/arrows) and no fake-clickable non-buttons (R2.renderSmoke:188-193).
- Loading never renders zeros (StateRecovery gated test), not-found ≠ error split, per-block isolation.

**Static analysis CANNOT prove (needs real AT + real browser):**
1. Whether dynamically **inserted** `role="alert"` elements (ErrorBoundary fallback; Tools delete-confirm Tools.tsx:193; message swaps) are actually announced — insertion-vs-mutation live-region behavior differs by browser/AT (notably Safari/VoiceOver).
2. Politeness queueing: with 124 `role="status"` + polite regions on screen, which announcement wins/gets suppressed when several fire together (e.g., route-loading status + save-note + PWA notice).
3. Whether `focus()` on `tabIndex=-1` headings/rows moves the SR **virtual cursor** in lockstep (NVDA/JAWS/VoiceOver differ), and what is read on focus landing.
4. Actual Arabic TTS pronunciation/verbosity of mixed RTL text with `bdi dir="ltr"` numerals/IDs (e.g., `MIC-…` incident reference, ErrorBoundary.tsx:69).
5. Whether `inert` (AppLockGate.tsx:200) is honored by the AT/browser matrix in use.
6. vaul/Radix drawer focus-trap + touch-gesture behavior (delegated; unverifiable in jsdom).
7. Reduced-motion behavior of BrandLaunchSplash layers under screen-reader "disable animations" settings (static `prefers-reduced-motion` CSS check exists — behavior does not).
8. Anything visual: dark/light parity, contrast of computed values, zoom/reflow at 200–400%, touch-target sizes, RTL layout mirroring.
9. Route-change experience for SR users with NF-1 (no focus/title management): whether anything usable is announced after SPA navigation.

### E-UNV-004 (other OS/browsers)

Testable **in this Linux sandbox only**: static source/DOM-contract analysis; jsdom-level assertions (the repo's own suites); read-only reproduction of guard regexes. No real browser rendering, no accessibility tree, no layout engine.
Not testable here, requires other environments: NVDA/JAWS on Windows; VoiceOver on macOS/iOS; TalkBack on Android; real Chromium/Firefox/Safari differences in `aria-live`/alert insertion handling; iOS PWA install/update flows (`PwaRuntimeNotice`, service-worker dirty-safe update) vs Android; `visualViewport` keyboard-open heuristics (MicroAppShell.tsx:69-76) on real mobile keyboards; Arabic font rendering/shaping across OSes; hardware keyboard Tab traversal on desktop browsers. (R9's "F8 browser chain" evidence used a real-Chromium run — that artifact is historical evidence, not reproducible in this read-only audit.)

---

## 6. New findings (not in R10-A)

| ID | Site | Severity | Finding | Disposition |
|---|---|---|---|---|
| **NF-1** | `components/layout/MicroAppShell.tsx:86`; no `document.title` anywhere in `client/src` | **S3** | No route-change focus management and no per-route document title: `<main key={location}>` force-remounts the content on every navigation, focus silently falls to `<body>`, and the tab/SR context never changes. Common SPA a11y gap; affects every journey. | **FIX_NOW (cheap, non-visual)**: focus the new `main` (or its `h1`) with `tabIndex={-1}` on location change and maintain a route→title map (both jsdom-testable); alternatively DEFER to an a11y repair card if owner prefers batch. Long-term: pair with route announcer. |
| **NF-2** | `pages/AgreementEditor.tsx:326-339` | **S3** | Read-error branch: no `role="alert"` on the message paragraph; `state==="error"` merged with cost-unavailable conditions under one heading; no retry action (navigation to cost editor only). Outside both the R9 8-site inventory and the W44 27-page census. Compounds F-020 (page is smoke-only). | **FIX_NOW**: add `role="alert"` paragraph + split error vs unready branches; add AgreementEditor to both censuses; journey test while touching it. |
| **NF-3** | `pages/RecurringExpenseDetail.tsx:246, 498, 544` | S4 | Inline, non-modal panels (cancel/snooze/skip) carry `role="dialog"` with no `aria-modal`, no focus management — SR announces "dialog" for what is an expanding inline section. | **DEFER** (semantics-only rename to region/disclosure or drop role); note in a11y repair card. |
| **NF-4** | `pages/Settings.tsx:691-712`; `components/security/DataActionPinGate.tsx:55-98` | S4 | Two lock-styled overlays miss parts of the AppLockGate gold standard: Settings `protectionBlocked` has no focus-in/trap/restore and no background inert; DataActionPinGate has autoFocus but no trap/restore. | **DEFER** with a repair card to align on the AppLockGate pattern (veil + inert + restore). |
| **NF-5** | 9 sites (e.g., Tools.tsx:81, MicroRouter.tsx:253, StartupGate.tsx:79, Catalog.tsx:650, EventEffectPreview.tsx:143) | S5/cosmetic | Redundant `aria-live="polite"` next to `role="status"` (role already implies it). Harmless. | **PRESERVE** (or cosmetic cleanup in a doc-wave). |
| **NF-6** | `R2.renderSmoke.test.tsx:58-116` | S5/informational | Param routes are smoke-tested with fake tokens only (`movement-x` as `:type`, `order-x` as `:id`) — exercises the honest-invalid state by contract (comment :56-57) but never a real type/id happy-path at App level. | **PRESERVE** (documented contract; direct page tests carry the real-value journeys). |
| **NF-7** | `scripts/generate-test-map.mjs:180-206` | S4 | Test-map "named-reference"/"route-reference" kinds can mask no-direct-test pages (F-020) — `CashWallets`' evidence includes a false positive (method name `listCashWallets` in CashAdjustmentEditor test). | **DEFER**: add a `withoutDirectRendering` report field or a strict `direct`-only ratchet for pages. |

### R10A-F-016 root-fix design options (no fallback visual change)

All options keep the existing fallback DOM (`<main role="alert">`, `h1 tabIndex={-1} ref`) byte-identical; only *when focus fires* changes:

- **Option A (minimal diff, recommended):** keep `componentDidMount` (mount-time path) **and add** `componentDidUpdate(_props, prevState) { if (this.state.hasError && !prevState.hasError) this.headingRef.current?.focus(); }` — fires exactly once on the false→true transition of a post-mount crash. `componentDidCatch`'s later `setState({incidentId})` re-renders the same elements, so focus is not disturbed (verified: h1 element identity persists across that update).
- **Option B (single uniform path):** delete `componentDidMount` focus and extract the fallback into a small child component (`<RecoveryCard headingRef>`) whose `useEffect(() => headingRef.current?.focus(), [])` runs on its mount — the fallback subtree mounts fresh in *both* the mount-time and post-mount cases, so one effect covers both. Slightly larger structural change; removes the dual lifecycle reasoning.
- **Option C (keyed effect on `incidentId`):** focusing when `incidentId` lands would also cover post-mount crashes (the id is set in `componentDidCatch` after the fallback commit), **but** it re-moves focus after the owner may already have Tabbed to the reload button when recording is slow — disruptive; and when the recorder fails (`incidentId` stays null, an explicitly supported case per ErrorBoundary.dom.test.tsx:117-136) focus would never fire. **Not recommended** as the primary key; at most a secondary no-op guard.
- **Test additions (required either way):** a post-mount crash case — child that throws on a state update after initial successful mount — asserting `document.activeElement` is the heading; plus an "incidentId arrives later does not steal focus" assertion. These are jsdom-testable without visual change.
- Out of scope for the fix: fallback content/styling, the announcement channel (role=alert insertion is the existing assertive channel and stays), adding more boundaries (per-route boundaries would be a structural change worth its own card).

---

## 7. Unverified limits

- No test execution, no browser, no screen reader: all a11y conclusions are DOM-contract-level (jsdom-provable subset); real AT behavior per E-UNV-002 is unproven.
- vaul/Radix drawer focus internals were assessed by delegation (library behavior), not verified.
- The readwrite-guard spot check covers 6 of ~62 outside-family read-like files; writer-service smuggling (guard limit 1) unproven for the rest.
- R10-A's "64 read-like files" vs my 62: ±2 from counting method (barrels/type-only files); not resolved further because both support the same conclusion.
- `exact-values.characterization/cross-surface` golden behavior, CI ratchets, and bundle guards were read as documentation only, not run.
- Smoke-route ↔ router equivalence assumes wouter pattern semantics (`:param` single-segment); `/inventory/movement/:type` is treated as smoke-covered via the fake token per the smoke contract comment.

## 8. No writes performed

**No writes performed to the repository.** The clone at `/home/z/my-project/r10b/clone` (HEAD `ffc54eb1150932c9bba88b48a7c38275f2a3effa`) was only read. All outputs of this review live under `/home/z/my-project/r10b/scratch/reviewers/` (this report and `rv3-coverage-matrix.txt`).
