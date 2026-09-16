# Agent 2-b — Accounting & Reconciliation Specialist — Working Notes (READ-ONLY audit 2026-09-16)

Baseline: `main` @ `37319ca6439746e8ab1946e891c849decca04e5d` (verified clean, no modifications made).
All file paths repo-relative to `/home/z/my-project/micro-repo-readonly`.

## 1. Reconciliation machinery inventory (ACC-001)

### Equation model (domain core)
- **8-column delta table**: `src/domain/financial-event/policies.ts:271-306` — [cash, payables, ownerCapital, operatingExpense, amanah, asset, loan, depositRevenue] per event type. `deltas()` 308-333 (asset_disposal special branch: cash by amount, asset by frozen bookValueMinor). Unallocated-shared expense zeroes the operatingExpense column (318-320).
- **Reversal negates all 8 deltas**: `createFinancialReversal` `src/domain/financial-event/policies.ts:393-428`; never reversible twice (399-400). `reversedEventIds` 431-437; `activeSettlementsMinor` 440-451.
- **Totals reducer**: `summarizeFinancialEvents` 453-478.

### Position (application)
- `readPosition()`: `apps/prototype-web/client/src/application/finance/projectFinancialService.ts:357-509`.
  - unallocated = orderCollections + eventsCash − supplierPaid + directSalesCash − activeAllocations (416-421; reversed allocations excluded 408-415, comment: reversal returns value to unallocated).
  - walletCash = Σ all continuity entry deltas (422) — includes opening_balance, transfers, adjustments, allocations, reversals.
  - **recordedCash = unallocated + walletCash (489)** — identity by construction; runtime-proven below.
  - receivables = registered order debt + partial_debt direct sales (445); payables = event payables + supplier material payables (491); ownerCapital = event ownerCapital + movement ownerCapital (423-426, 492); assetBookValue = Σ assetDelta (503); loansOutstanding = Σ loanDelta (504); amanah (501); pendingRetainedDeposits (429-436).
- **Period result**: `readRecordedPeriodResult` 539-793; formula at 774-785 (revenue + directSaleRevenue − effectiveDirectCost − known direct-sale cost − operatingExpense − depreciation − writeOff + disposalResult + retainedDepositRevenue; null ⟺ unknown direct-sale cost). COGS policy `derivePeriodCogs` 288-349 (qualified consumption replaces snapshot material component once; snapshot fallback announced; reversals excluded). Group-4 items active-only 701-722.
- **Canonical reader lock**: MIC-1 `integrityCheckService.ts:191-251` + `periodResultCanonical.test.ts` (statement + insights consume the same object; spy-proven).

### Integrity checks (MIC-1..16) — `integrityCheckService.ts`
MIC-1 period-result cross-surface (191-251) · MIC-2 cash/wallet structure (256-354) · MIC-4 event re-derivation through domain factories (360-478) · MIC-7 amanah read-back (483-512) · MIC-8 inventory structure (593-706) · MIC-9 knowledge honesty: result-null ⟺ unknown-cost-declared (517-586) · MIC-10 assets ↔ events, depreciation ≤ acquisition, status consistency, ghost contexts (710-810) · MIC-11 loans ↔ events, repayments ≤ principal (814-892) · MIC-12 retained-deposit classification (896-995) · MIC-13 delivery-consumption linkage (1002-1066) · MIC-14 unallocated truth, negative = WARN (1072-1109) · MIC-15 idempotency-key uniqueness (1114-1133) · MIC-16 owner-money separation (1139-1167).
- Contract: `docs/contracts/35-integrity-continuity-checks-contract.md` (read-only, consistency-not-correctness, pending = WARN).
- UI: `pages/ToolsIntegrity.tsx` (أدواتي → فحص السلامة; honest status words; no auto-fix).
- Tests: `integrityCheckService.test.ts` 29 tests (clean-store zero-write snapshot proof; tamper detection per check; ghost contexts; TOOL-001 dynamic count).

### Single-source discipline
- Home facts: `homeControlCenterService.ts:70` uses `projectFinance.readPosition()` (same source).
- Statement: `statementService.ts:131-160` consumes canonical reader + readPosition; deep-finance layers from canonical reader only (63-76).
- No competing period-result computation found in pages (MIC-1 guards it).

## 2. Runtime proofs executed (all exit code 0 unless noted)

Repo tests (read-only runs):
1. `node_modules/.bin/vitest run tests/domain/cash-allocation.test.ts tests/domain/cash-continuity.test.ts` → 2 files, 7 tests PASS.
2. `node_modules/.bin/vitest run tests/domain/financial-event.test.ts tests/domain/complex-six.characterization.test.ts tests/domain/exact-values.characterization.test.ts tests/domain/loan.test.ts tests/domain/asset.test.ts` → 5 files, 83 tests PASS.
3. (in apps/prototype-web) `vitest run client/src/application/finance/projectFinancialService.test.ts client/src/application/finance/periodResultCanonical.test.ts` → 2 files, 50 tests PASS.
4. `vitest run client/src/application/finance/integrityCheckService.test.ts client/src/application/finance/ownerEntitlementService.test.ts client/src/application/cash/cashContinuityService.test.ts` → 3 files, 47 tests PASS.
5. `vitest run client/src/ToolsIntegrity.ui.test.tsx` → 2 tests PASS; `client/src/pages/OwnerEntitlement.ui.test.ts` → 3 tests PASS; `client/src/G6.dom.test.tsx` → 7 tests PASS.
6. `vitest run client/src/application/suppliers/supplierPurchaseService.wallet.test.ts client/src/application/finance/unallocatedDistribution.test.ts client/src/application/finance/statementService.test.ts` (+ownerEntitlementService again) → 43 tests PASS.

Audit diagnostics (my own files, OUTSIDE repo, under agents/2-b/diagnostics/, config `vitest.audit.config.ts`):
7. `acc001-full-chain.audit.test.ts` — **the full 10-link chain in one MemoryLocalStore**: wallet opening 200.00 → craft order price 50.00 with deposit 20.00 + delivery + debt 30.00 + debt collection 10.00 → operating expense 3.00 → supplier purchase 12.00 paid 4.00 → supplier wallet payment 5.00 → owner investment 100.00 (event) + owner draw 15.00 (ledger movement, wallet) → loan 20.00 + repayment 8.00 → material consumption 9.00 linked to order → asset 60.00 + one month depreciation 5.00.
   **All equations hold (VERIFIED)**: recordedCash 231.00 = wallets 180.00 + unallocated 51.00 = sources walk (200+30+100−3−9−20+8−60−15); receivables 20.00; payables 3.00; ownerCapital 85.00 (100 event − 15 movement, both models summed); assets 55.00; loans 12.00; amanah 0; period result Sep = 280.00 (5000−1400−300−500), status `incomplete` reason «إهلاك مسجّل» (depreciation marks period incomplete by design — projectFinancialService.ts:731).
   Integrity over the same store: **overall FAIL — MIC-2 FAIL** «اختلال بنيوي في 1 حركة كاش» (false positive; see NEW-001). MIC-1/4/7/8/9/10/11/12/13/14/15/16 all PASS.
8. `mic2-supplier-purchase.audit.test.ts` — minimal repro: wallet 100.00 + purchase 50.00 + wallet payment 20.00 → cash equation intact (recorded 80.00 = wallets 80.00 + unallocated 0.00) but **MIC-2 FAIL, overall FAIL**.
9. `debug-components.audit.test.ts` — store dumps used to verify the algebra (allocation −500 with sourceRefKind supplier_purchase; recordedCash by sources ✓).

## 3. NEW-001 — MIC-2 false structural FAIL on wallet-attributed supplier payments (VERIFIED)

- Domain source-ref kinds (FIN-003): `src/domain/cash-continuity/policies.ts:48-50` = ["sale","expense","collection","order","supplier_purchase"]; types.ts:13 `CashAllocationSourceKind` includes supplier_purchase.
- Supplier wallet payment writes allocation entry `sourceRefKind: "supplier_purchase"`: `apps/prototype-web/client/src/application/suppliers/supplierPurchaseService.ts:139-149`.
- Integrity checker has a STALE duplicate list WITHOUT supplier_purchase: `apps/prototype-web/client/src/application/finance/integrityCheckService.ts:72` = ["sale","expense","collection","order"]; MIC-2 flags unknown kind as STRUCTURAL at :324.
- Runtime proof (diagnostics 7+8): MIC-2 FAIL + overall FAIL on a perfectly consistent store.
- No test coverage intersection: `supplierPurchaseService.wallet.test.ts` never runs the integrity service; `integrityCheckService.test.ts` has no supplier_purchase case (grep = 0 hits).
- Impact: after the FIN-003 fix, any owner who pays a supplier from a wallet and then runs فحص السلامة sees «خلل — اختلال بنيوي في حركة كاش» for a legal flow → trust erosion in the very tool meant to prove reconciliation; also makes MIC-2 unusable as a regression gate for that flow.

## 4. OWN-002 — two withdrawal models (INTENTIONAL_DESIGN, unified entrance implemented)

- Model A (financial event): `owner_withdrawal_cash` DELTA [−cash, −ownerCapital] (`src/domain/financial-event/policies.ts:277`); recorded via general editor; money leaves UNALLOCATED pool.
- Model B (owner ledger movement): `createOwnerMovement` reason `owner_draw` → ownerCapitalDelta −amount, cashDelta −amount from a WALLET (`src/domain/owner-entitlement/policies.ts:377-384, 400-438`); `OwnerEntitlementService.recordMovement` (`ownerEntitlementService.ts:763-894`) requires an existing wallet (:784-789), settles against entitlement/opening when linked (791-869), writes atomic movement + `cash_adjustment` continuity entry with key `owner-movement:<idemKey>` (870-883).
- **Documented owner decision**: `docs/quality/remediation-open-decisions-v1.md:5-9` (X-05: «يُوحَّد المدخل ويبقى المساران في المجال… التفريق تقني والمالك لا يعرفه»). Implemented in `pages/OwnerWithdrawalEditor.tsx`: `unifiedWithdrawalPath()` :24-28 (active policy ⇒ ledger_movement, else financial_event); save() :69-123 routes accordingly; **the decision card explains the model BEFORE recording** :154-169 («عندك سياسة حق مالك فعالة، فيُسجَّل السحب تسويةً لحقك من محفظة محددة…» / «يُسجَّل السحب حدثًا ماليًا عامًا ينقص الكاش ومال المالك معًا»).
- Ledger forms disclose the split: `components/owner/OwnerLedgerFormsSection.tsx:316-318` («السحب الشخصي العادي له مدخل واحد من «مالي»… ما هنا مرتبط بسجلات الدفتر»).
- **Reconcilable (VERIFIED)**: readPosition ownerCapital = events + movements (projectFinancialService.ts:423-426, 492); unified owner-money ledger shows both row types with the same equation (`readOwnerMoneyOverview` ownerEntitlementService.ts:269-344, esp. 287-334); runtime proof in full-chain diagnostic (ownerCapital 85.00 = 100.00 event − 15.00 movement).
- Residual gaps (minor):
  a. Route `/finance/new/owner_withdrawal_cash` still registered (`app/MicroRouter.tsx:113`) and FinancialEventEditor still accepts the type (`pages/FinancialEventEditor.tsx:46,64`) — URL-only parallel entrance with NO in-app link (grep of all navigate() calls = only operating_expense/payable_settlement/amanah/loss + owner_investment). Using it while a policy is active records the event model, bypassing the routing; accounting equation still balances (same columns), but the owner-ledger linkage/wallet requirement is skipped.
  b. Unified path dead end: active policy + zero wallets → «اختر المحفظة التي يخرج منها السحب» with no fallback (`OwnerWithdrawalEditor.tsx:79-81`, wallet select shows «لا محفظة معلنة بعد» :187).
  c. Direct-sale-style receipts promise... (N/A here).
- No interest on loans: principal-only model, repayments capped at outstanding (`src/domain/loan/policies.ts:67-93`); documented as «ذمّة لصالح المشروع» contract 29 §2.5; wallet-source label informational only by contract 29 §5 («لا حركة محفظة من الإقراض») — INTENTIONAL.

## 5. CASH-001 — reconciliation aspect (opening balance ↔ wallet ↔ unallocated)

- Single write funnel: all 4 opening-balance writers construct via the same domain factories and commit via `commitCashContinuity`:
  1. Setup wizard: `pages/Setup.tsx:158` → `cashContinuity.openWallet`.
  2. Wallet editor: `pages/CashWalletEditor.tsx:40` → `openWallet`.
  3. Later opening: `pages/CashOpeningLaterEditor.tsx:75` → `recordOpeningBalanceLater`.
  4. Guided opening import: `application/transfers/guidedOpeningImportService.ts:247-266` (deterministic keys `guided-opening:<importId>:wallet:<id>`; skip opening entry when openingMinor = 0).
- `openWallet` (`application/cash/cashContinuityService.ts:113-159`): opening 0 or «unknown» ⇒ NO entry + `openingStatus` stamp (5.1 unknown ≠ zero); positive opening ⇒ exactly one `opening_balance` entry; idempotent by operationKey (121-124).
- `recordOpeningBalanceLater` (162-205, PA-007): one opening per wallet enforced (:175-180 — second opening rejected: later corrections must be `cash_adjustment` with reason); unknown-stamp lift atomic with the entry (194-196).
- Equation integrity: opening enters `walletCashMinor` only (never subtracts from unallocated) — verified at runtime (full-chain: wallets 180.00 includes the 200.00 opening minus later outflows; sources walk matches).
- Balances always derived: `overview()` per-wallet `summarizeCashContinuity` (84-91); no stored balance anywhere.
- Corrections: `adjust` (207-238, reason mandatory), `transfer` balanced pair (240-288), `reverse` (290-346, double-reversal and unbalanced-transfer guards). MIC-2 re-validates structure (with the NEW-001 exception).
- Transfer/adjustment/reversal keep total cash unchanged — proven by `cash-continuity-g3-scenario-validation.md` (manual QA table) and my runtime chain.

## 6. OWN-003 — domain vs UI capability matrix (owner money)

Domain kinds (`src/domain/owner-entitlement/types.ts:4-14`): monthly, weekly, daily, hourly, fixed_period, **fixed_shift**, per_completed_work, profit_share, sale_percentage, per_unit.
UI-selectable (`presentation/ownerEntitlementPresentation.ts:50-60` `supportedOwnerEntitlementPolicyKinds`): all EXCEPT **fixed_shift** (label :28 «مبلغ ثابت للوردية (غير متاح بلا دليل وردية)»). Domain itself returns an honest incomplete for fixed_shift (`policies.ts` fixed_shift guard: «لا يوجد في النموذج الحالي سجل ورديات موثق») → **deferred capability awaiting shift-evidence records**, not missing wiring.
Movement reasons (types.ts:93-99): 6 in domain. UI ledger forms (`ownerEntitlementPresentation.ts:64-67`): draw → [entitlement_settlement, opening_balance_settlement]; return → [opening_balance_settlement, settlement_of_prior_draw, new_capital_investment]. **`pre_entitlement_draw`** reachable only via the unified withdrawal editor (`OwnerWithdrawalEditor.tsx:101`). **`owner_draw`** NOT reachable from any surface (grep: only presentation label :46 + overview metric `ownerDrawMinor` `ownerEntitlementService.ts:227`) → dead capability at UI level (domain + metric exist; nothing writes it).
Evidence wiring for calculations (`ownerEntitlementService.calculate` :482-560): orders + actual-time records + canonical period reader for profit_share (wired in `PrototypeServicesContext.tsx:161-163`). All 9 UI kinds computable.
Store support: policies/records/openingBalances/movements stores all wired.

## 7. Sweep results

- **Period result semantics**: recognition at delivery (last effective delivery event, Amman date) for orders (:630-643); direct sales at sale date (F-005 :617-629); correction-period semantics for reversals (tested projectFinancialService.test.ts:839); depreciation marks `incomplete` with reason (by design, disclosed). «النتيجة المتاحة» = level-1 Finance card (Finance.tsx:381-397) — null shown as «غير متاح» with reasons; NAV-002 owner decision (CHANGELOG.md:7).
- **Depreciation consistency**: floor rounding keeps cumulative ≤ acquisition (`asset/policies.ts:131-136, 162-170`); proposal-based explicit recording (never auto); disposal freezes book value; write-off requires positive book value; MIC-10 re-validates (depreciation ≤ acquisition, disposal/writeoff ↔ status). Period result treats depreciation as separate line, never in operating expenses (contract 29 + code :699-713).
- **Loan interest**: no interest model (principal-only); repayment capped; documented design. No defect.
- **Corrections/reversals double-counting**: reversal negates all 8 deltas and is never double-applied (domain guard + MIC-4 re-derivation + tests 1422-1707 in projectFinancialService.test.ts); settlement-after-reversal surfaces kept consistent (A-01 tests :1981-2140); stale settlement reference = WARN not FAIL (MIC-4 SA-5). Restatement note surfaces corrections count + net (Finance.tsx:412-418 RestatementNote).
- **FIN-002 fix re-verified** (receivables surface reconciliation): ledger now includes ALL names with `متكرر` badge only (`partyLedgerService.ts:200`, `Parties.tsx:106,156`) — filter removed. (Tracker said fixed; confirmed still in place.)
- **Owner equity consistency**: MIC-16 enforces owner-capital deltas only in owner types and owner types never touch expense/revenue (1139-1167).

## 8. What could NOT be verified
- Full `pnpm check` (forbidden by rules — too slow); bundle/CI re-run; live deployed-site behavior (Agent 1's domain).
- IndexedDB (browser) store parity with MemoryLocalStore for the chain (adapter conformance tests exist: `storage/local/IndexedDbLocalStore.group4.test.ts`, `adapterConformance.group10.test.ts` — not run here; MemoryLocalStore used for all runtime proofs).
- No proof was attempted for export/import round-trip fidelity of the whole chain (DATA-001 is another agent's scope; contract 39 exists).
- The ToolsIntegrity UI was verified by its own test file (2 tests) — I did not drive the live PWA.

## 9. Artifacts
- `agents/2-b/diagnostics/vitest.audit.config.ts` — config (outside repo).
- `agents/2-b/diagnostics/acc001-full-chain.audit.test.ts` — full-chain proof (PASS).
- `agents/2-b/diagnostics/mic2-supplier-purchase.audit.test.ts` — MIC-2 false-positive repro (PASS test; FAILing MIC-2 inside).
- `agents/2-b/diagnostics/debug-components.audit.test.ts` — component dump.
Commands: see §2 (all exit 0).

## 10. Retry verification run (Agent 2-b retry, 2026-09-16) — fresh commands, fresh exit codes

Previous attempt completed the analysis but its final report was never delivered. This retry re-ran every key diagnostic and refined the ACC-001 proof map. Repo verified clean at 37319ca before/after (`git status --porcelain` empty).

Re-executed (all exit 0):
1. `vitest run --config vitest.audit.config.ts` (agents/2-b/diagnostics, outside repo) → 3 files, 3 tests PASS. Re-confirmed: full 10-link chain holds ALL equations (recordedCash 231.00 = wallets 180.00 + unallocated 51.00; receivables 20.00; payables 3.00; ownerCapital 85.00; assets 55.00; loans 12.00; amanah 0; period result 2800 minor, status incomplete «إهلاك مسجّل») AND MIC-2 FAILs on the legal supplier-wallet flow (NEW-001) while MIC-1/4/7/8/9/10/11/12/13/14/15/16 PASS.
2. Root: `node_modules/.bin/vitest run tests/domain/{complex-six.characterization,exact-values.characterization,cash-allocation,cash-continuity,rounding-boundaries.characterization,asset,g5}.test.ts` → 7 files, 85 tests PASS.
3. App: `cd apps/prototype-web && vitest run client/src/application/finance/{projectFinancialService,periodResultCanonical,integrityCheckService,ownerEntitlementService,unallocatedDistribution,statementService}.test.ts client/src/application/cash/cashContinuityService.test.ts client/src/application/suppliers/supplierPurchaseService.wallet.test.ts client/src/application/loans/loanService.test.ts` → 9 files, 134 tests PASS.

New verification details (for the proof map / unproven-links list):
- `assetDepreciationMinor` in ANY test: only literal fixture input `statementMarkdownService.test.ts:37` — zero references in `projectFinancialService.test.ts` (grep "depreciation|disposal" = 0 hits). The depreciation→period-result subtraction (`projectFinancialService.ts:711,731,766,782`) is proven ONLY by my external diagnostic (real AssetService chain → period.assetDepreciationMinor 500 → result 2800).
- `disposalResultMinor` (period result line): asserted only in `statementMarkdownService.test.ts:124` fixture. `assetService.test.ts:104` proves the disposal EVENT deltas only. NOT derived from a real chain by any test — including my own diagnostic (chain had no disposal). UNPROVEN at computation level.
- `retainedDepositRevenueMinor` (period result line): only fixture literals (`statementMarkdownService.test.ts:40,125`); G4RetainedDeposit.dom.test.tsx has no resultMinor assertion. Derivation from a real retained-deposit decision → period result UNPROVEN in-repo.
- `position.assetBookValueMinor` / `position.loansOutstandingMinor` from real service chains: no in-repo assertion (markdown fixture literal only); my diagnostic proves both (5500 / 1200).
- In-repo multi-service chaining: only 3 DOM files construct all services (FinanceJourneys.dom, FinanceEmptyTruth.dom, group2InventorySurfaces) — each tests a single journey (wallet opening on position view; unallocated surfacing; empty-truth rendering). NO in-repo test chains all 10 links.
- OWN-002 decision trail nuance: X-05 recommendation = `docs/quality/remediation-open-decisions-v1.md:5-9`; `docs/operations/agent-handoff-2026-08-30.md:54,140` records it as suspended AWAITING owner signature; implementation landed in squash f21f777 (2026-09-15) with in-code "X-05 (وحدة ٣)" citations (`OwnerWithdrawalEditor.tsx:2`, `MicroRouter.tsx:34`, `ownerEntitlementPresentation.ts:61-63`); `docs/product/owner-decisions-v1.md` items 19-23 do NOT include X-05; CHANGELOG has no X-05 entry. So: documented recommendation + implemented + UI-disclosed, but no explicit owner-signature record found for this X-05 (note: docs contain a SECOND unrelated "X-05" = supplier acquisition — do not confuse).
- OWN-002 anchors re-verified this run: `unifiedWithdrawalPath` OwnerWithdrawalEditor.tsx:24-28; save() routing :69-123 (reason `entitlement_settlement` vs `pre_entitlement_draw` :101); pre-recording disclosure decision card :154-169; zero-wallet dead end :79-81 + «لا محفظة معلنة بعد» :187; G6-U2-1 no-entitlement fallback to pre_entitlement_draw :21-23; parallel URL entrance `/finance/new/:type` MicroRouter.tsx:113 + FinancialEventEditor.tsx:46,64 accepts `owner_withdrawal_cash`, zero in-app navigate() to it.
- Position equation anchors re-verified: unallocated formula projectFinancialService.ts:416-421, walletCash :422, ownerCapitalFromMovements :423-426, recordedCash identity :489, ownerCapitalRecorded :492, supplierPayables :491.
- NEW-001 anchors re-verified: domain kinds `src/domain/cash-continuity/policies.ts:48-50` (5 kinds incl. supplier_purchase); writer `supplierPurchaseService.ts:139-149` (sourceRefKind "supplier_purchase"); stale checker list `integrityCheckService.ts:72` (4 kinds) → structural FAIL at :324. Runtime re-proven (diagnostic 1 + mic2 repro).
- Receivables cross-surface equality proven in-repo: `partyLedgerService.visibility.test.ts:129` (ledger totalReceivableMinor === position.customerReceivablesMinor). Supplier payables at position level: `supplierPurchaseService.test.ts:26,86`.
- readOwnerMoneyOverview ownerCapital formula re-verified: `ownerEntitlementService.ts:332-334` (events + movements Σ) — same equation as readPosition:492, asserted at ownerEntitlementService.test.ts:736,788.
