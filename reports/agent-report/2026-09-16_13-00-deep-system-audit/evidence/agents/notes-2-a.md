# Agent 2-a — Financial Event & Ledger Architect — Working Notes

Baseline: main @ 37319ca (verified `git log --oneline -1`). Read-only audit; no repo modifications.
Diagnostics run (focused, all PASS): `vitest run tests/domain/loan.test.ts tests/domain/cash-continuity.test.ts` (8 tests);
app vitest `src/application/loans/loanService.test.ts`, `src/storage/local/IndexedDbLocalStore.group4.test.ts` (13 tests),
`src/QuickExpenseSource.dom.test.tsx` (5 — FIN-005 fix holds), `src/CashJourneys.dom.test.tsx` (7).

## FIN-006 — expense recording surfaces
- Surfaces that create `operating_expense_cash` (exhaustive grep, non-test):
  1. QuickExpenseForm — QuickActionSheet.tsx:297 (mounted in sheet; opened from Home.tsx:253 quick button / sheet menu QuickActionSheet.tsx:67-70). Submit: QuickExpenseForm.tsx:90-107.
  2. FinancialEventEditor — route /finance/new/:type (MicroRouter.tsx:113); entrance Finance.tsx:724. Submit: FinancialEventEditor.tsx:581-591.
- Both → `projectFinance.record` (application/finance/projectFinancialService.ts:1259) → `createFinancialEvent` (src/domain/financial-event/policies.ts) → `store.saveFinancialEvent` → `financial-events` store. Same event type, same delta policy (deltas derived in domain, not UI).
- Wallet handling identical (FIN-005 rules): QuickExpenseForm.tsx:51-60, 79-83 vs FinancialEventEditor.tsx:303-309, 566-574; both attribute via `distributeUnallocated` with derived key `…:attribute` (QuickExpenseForm.tsx:128 / quickFormHelpers.ts:27; FinancialEventEditor.tsx:616-623).
- Differences (metadata/validation only):
  - note optional in quick (canned default "مصروف مدفوع في لحظته" QuickExpenseForm.tsx:94) vs REQUIRED in editor (FinancialEventEditor.tsx:562-565).
  - occurredOn = today only in quick (QuickExpenseForm.tsx:93) vs editable LocalDateField in editor.
  - counterparty always null in quick vs optional in editor.
  - classification hardcoded in quick: {relationship:"project", behavior:"unknown", purpose:"project_general", knowledge:"known"} (QuickExpenseForm.tsx:97-105) vs full classification + shared modes in editor (lines 448-499).
  - quick cannot record shared expenses / payables.
- Financial-number divergence: NONE (same event type, same deltas). Classification divergence: quick expenses can never be `needs_review` (knowledge hardcoded "known") — affects expenseNeedsReview counts (projectFinancialService.ts:261-269) only.
- Intent documented: QuickActionSheet.tsx:5-11 (W3 quick transient action; full form remains "باب التصحيح والعمق"); FinancialEventEditor.tsx:40-42 (contract 29).
- VERDICT: PARTIALLY_CONFIRMED. Two full recording surfaces exist (both persist a real event), but one source of truth for the write; differences are metadata/validation. Quick = contextual quick action by design.

## CASH-001 — wallet creation / opening balance entrances
- Wallet creation:
  1. Setup.tsx:158 `cashContinuity.openWallet` (operationKey `setup-wallet-${profile.id}` — Setup.tsx:169; profile id constant `localProfileId` profileService.ts:29 → re-run of /setup dedups via cashContinuityService.ts:121-124).
  2. CashWalletEditor.tsx:40 `cashContinuity.openWallet` (entrances: CashWallets.tsx:157 `/cash/wallet/new`; Foundation.tsx:126 same route — Foundation has NO own wallet form).
  3. Guided opening import: guidedOpeningImportService.ts:246-268 (Settings only; refuses non-empty store lines 225-229, dedup by importId lines 218-235/341-348).
- Opening balance later: CashOpeningLaterEditor.tsx:75 `recordOpeningBalanceLater` — button only for openingUnknown wallets (CashWallets.tsx:247-254); service blocks 2nd opening_balance per wallet (cashContinuityService.ts:175-180); "already-known" page redirects to adjust (CashOpeningLaterEditor.tsx:112-133).
- All writes → `commitCashContinuity` single IDB transaction with in-transaction operationKey dedup (IndexedDbLocalStore.ts:1388-1422).
- Duplicate opening balance per wallet: NOT possible via these paths (verified). Duplicate wallet with same NAME: possible (no name uniqueness — domain createCashWallet policies.ts:30-45) — by design "declared places", P3 observation.
- VERDICT: PARTIALLY_CONFIRMED (multiple entrances; single source of truth; no duplicate/conflicting opening balance; Foundation does not add a parallel form). Mostly INTENTIONAL_DESIGN.

## OWN-001 — owner money increase paths
1. Event: `owner_investment_cash` via FinancialEventEditor `/finance/new/owner_investment_cash`; entrances Foundation.tsx:178, OwnerEntitlement.tsx:631 ("أدخل مالًا للمشروع"), Home road homeControlCenterService.ts:110. → financial-events; cash+ unallocated; ownerCapital+.
2. Ledger movement: kind=return reason=new_capital_investment via OwnerLedgerFormsSection (OwnerEntitlement.tsx:471 `ownerEntitlement.recordMovement`) → owner-movements + cash_adjustment in chosen wallet (ownerEntitlementService.ts:871-883); ownerCapital+ (domain policies.ts:377-384), cash+ wallet.
3. Opening balance (claim, no cash): OwnerEntitlement "رصيد افتتاحي" → setOpeningBalance (ownerEntitlementService.ts:680-711; one active layer only, lines 687-692).
- Unified read (single formula both readers): readPosition ownerCapitalRecordedMinor = project.ownerCapitalMinor + ownerCapitalFromMovementsMinor (projectFinancialService.ts:492, 423-426); readOwnerMoneyOverview same (ownerEntitlementService.ts:332-334). Unified ledger rows source event|ledger (lines 286-331).
- Cross-path duplicate (same injection recorded in both models) possible; idempotency keyspaces differ per store; NO cross-model detection; but duplicate IS visible as two rows in the unified ledger. Cash pools differ (unallocated vs wallet).
- Dual model documented as intentional (S2-07 comment ownerEntitlementService.ts:54-57; X-05 OwnerWithdrawalEditor.tsx:1-5 for the withdrawal mirror).
- VERDICT: CONFIRMED multiplicity / PARTIALLY_CONFIRMED as defect (Design Gap, duplicate-write exposure without cross-path guard; visible in ledger; owner decision worth asking).

## CASH-002 — cash modification paths
Wallet-cash writers (all → cash-continuity-entries via commitCashContinuity, typed entries):
- opening_balance (openWallet / recordOpeningBalanceLater)
- cash_adjustment: CashAdjustmentEditor.tsx:53; CashCount settle CashCount.tsx:101-109 (operationKey `cash-count-${wallet}-${Date.now()}` — fresh per call); owner movements (ownerEntitlementService.ts:872-882, reason prefix "حركة مالك: …"; reversals 925-935).
- transfer pair: CashTransferEditor → cashContinuityService.transfer (240-288).
- allocation ±: distributeUnallocated — callers: quickFormHelpers.ts:27 (quick sale/expense), FinancialEventEditor.tsx:616, DirectSaleEditor.tsx:406, AgreementEditor.tsx:299, OrderDetail.tsx:613, collectionService.ts:201, supplierPurchaseService.ts:140-152 (sourceRefKind supplier_purchase), CashDistribution.tsx:115.
- reversal: CashReversalEditor → cashContinuityService.reverse (290-346); directSaleService.ts:266 (sale cancel).
Unallocated-cash writers: financial events (projectFinance record/reverse/edit/restore; loanService create/repay/reverse/correct; assetService; fulfillment/order collections; directSales; supplier purchases).
- Unified audit trails: WalletLedger (walletLedgerService.ts — typed rows + source links), CorrectionsLayer (correctionHistoryService reads 8 stores, 20 kinds), integrity checks MIC-2/4/11/14/15/16. Entry types distinguish operations; same net result via different paths leaves different typed entries (adjust needs reason; transfer has transferId pair; allocation links sourceRef).
- NEW DEFECT (NEW-001): CashDistribution keeps ONE operationKey per page mount and does NOT rotate it after success nor check `reused` → 2nd distribution in same visit is silently swallowed with success message. CashDistribution.tsx:50, 113-134; service reuse path projectFinancialService.ts:1045-1051. Code-level proof; existing tests never cover a second distribution in one mount (CashJourneys.dom.test.tsx:150-176 single distribution only).
- VERDICT: PARTIALLY_CONFIRMED (paths many by design, typed and trailed; "no unified audit trail" part is FALSE_POSITIVE; one new P1 defect found).

## LOAN-001 — loan repayment surfaces
- Repayment entrances: Loans.tsx:87/103 and LoanDetail.tsx:163/307 — BOTH render the SAME RepaymentSheet component (components/loans/RepaymentSheet.tsx) → `loans.recordRepayment` (loanService.ts:131-165). No quick-action loan entry (QuickActionSheet.tsx:58-84: sale/expense/order/estimate/collection only). Finance loans layer read-only → navigates /loans (Finance.tsx:590).
- Single logic: addLoanRepayment domain guard (over-payment, settled loan — src/domain/loan/policies.ts:67-93); atomic commitLoanRecord (IndexedDbLocalStore.ts:2538-2669) with in-transaction: event-id replay, idempotency-key replay (findLoanEventByKey), AV-02 concurrency relation guard (loanCommitGuard.ts:16-57). Double-submit guarded by saveInFlightRef (RepaymentSheet.tsx:36-39) + saving state.
- No interest concept in domain (LoanRecord types.ts — principal + repayments only). Principal/cash effect from single event `loan_repayment_cash` (cash+ unallocated, loanDelta−).
- Reversal/correction: reverseRepayment (marks repayment + reversal event atomically), correctLoan (reversal+replacement atomic, guards principal ≥ active repayments policies.ts:131-133, no-op correction rejected loanService.ts:221-222).
- General EventsLayer cannot reverse loan events (family owner redirect EventsLayer.tsx:93-96 + 403-413); service-level familyCorrectionGuard does NOT cover loans (projectFinancialService.ts:241-248 — intentional per AV-03 comment) but MIC-11 detects event/loan-record divergence (integrityCheckService.ts:852-868 "دفعة-حالة-متناقضة"). Defense-in-depth note only (P3).
- Note: loan wallet "source" is informational only (LoanEditor.tsx:4-5 comment; loanService.create writes no wallet entry) — loans move only unallocated cash; wallet correction via distribution page. Design decision.
- VERDICT: FALSE_POSITIVE for "two different repayment logics/duplicate risk" (two entrances, one shared component+service+guards). PARTIALLY_CONFIRMED only in the trivial sense that two list surfaces exist.

## Write-path matrix rows — see final message.

## New findings
- NEW-001 CashDistribution operationKey reuse (P1) — see card.
- NEW-002 (P3, defense-in-depth): ProjectFinancialService.reverse/editEvent accept loan/asset family events (guard only covers deposit types) — unreachable from UI (EventsLayer redirects), MIC-11 nets it. 
- NEW-003 (P3): duplicate wallet names possible (no uniqueness) — user-model risk only.
- (Checked, NOT findings: no direct store writes from pages/components; all writes via services. Export snapshot includes all stores in my rows — types.ts:305-339.)

## Could not verify
- Runtime behavior of second-distribution swallow (static code-level proof only; no UI test exists and writing repo tests is out of scope).
- Whether real users double-record owner injections across the two models (needs product telemetry — N/A in local-first app).
- Multi-tab concurrent writes in a real browser (AV-02 guard logic read; IDB transaction semantics relied upon from code + tests).
