# Financial Trust Fixes — FIN-001..FIN-005 Implementation Report

## 1. Title and timestamp

**Micro — Implement and Merge Financial Trust Fixes (FIN-001, FIN-002, FIN-003, FIN-004, FIN-005)**

- Run started: 2026-09-15 ~23:21 Asia/Amman (branch creation)
- Run completed: 2026-09-16 ~00:25 Asia/Amman (report + evidence)
- Implementation branch: `fix/financial-trust-fin001-fin005-20260915-2321`
- All times in this report are `Asia/Amman` (UTC+3).

## 2. Reason for the work

The financial-trust validation audit (previous run, chat report) confirmed three
defects (FIN-001, FIN-002, FIN-004), one owner-policy gap (FIN-003), and one
intended-but-confusing default (FIN-005) in the Micro prototype. The owner
approved a single implementation package with fourteen final decisions covering
truth states for unknown values, People-Ledger visibility from the first
transaction, supplier-payment cash sources, committed-state refresh, and
quick-expense source rules. This run implements those decisions, adds automated
coverage, verifies the corrected journeys on emulated mobile viewports, and
merges the result to `main` through the required safety workflow.

## 3. Original research brief

The audit brief required, for each of FIN-001..FIN-005: live black-box testing
on https://micro-prototype.pages.dev/ in an isolated session at 390×844 with
fictitious test data; storage inspection (IndexedDB / localStorage); a read-only
code trace (routes → components → services → domain → storage) after the live
results were locked; and a reconciliation verdict per issue with a six-value
classification. The audit found:

- **FIN-001** — Finance rendered `0.00` for metrics with no recorded evidence
  (empty-store sums through non-nullable numeric fields) while Home showed
  «غير مسجل» for the same reads. CONFIRMED_DEFECT.
- **FIN-002** — A first debt under a new name existed in storage, entered
  Finance totals, was promised by the receipt, and was hidden from the People
  Ledger until the name appeared twice (`repeatedOnly: true` +
  `distinctSourceCount >= 2`); ledger totals diverged from Finance receivables
  (18.00 vs 22.00 in the test session). CONFIRMED_DEFECT (the hiding rule was
  an owner decision; the receipts/consistency failures were defects).
- **FIN-003** — Supplier purchases and payments carried no wallet source;
  payments reduced total cash through negative unallocated while wallet
  balances stayed untouched, requiring a manual cover step. INTENDED design,
  OWNER_POLICY_REQUIRED for entry-time source selection.
- **FIN-004** — `notifyDataChanged()` fired between the expense-event write and
  the wallet-allocation write; Home (mounted under the sheet) read the
  intermediate state and kept a false negative-unallocated breakdown until
  navigation/reload. CONFIRMED_DEFECT.
- **FIN-005** — Quick expense defaulted to unallocated cash even when a funded
  wallet existed and never remembered the previous wallet. INTENDED_BUT_CONFUSING.

## 4. Approved owner decisions

Implemented exactly as approved (2026-09-16 package):

1. Unknown financial values must not appear as confirmed zero.
2. A real zero appears only from an explicit recording or sufficient recorded evidence.
3. The People Ledger shows every person and every real debt from the first recorded transaction.
4. A person is never hidden because their name occurred only once.
5. Repeated customers carry a badge; non-repeated customers remain visible.
6. Debt totals are consistent across Home, Finance, and People Ledger.
7. Receipts and success messages describe what actually happens.
8. Supplier purchases and payments allow identifying the cash source during the transaction.
9. Unallocated cash remains an explicit fallback when the source is unknown.
10. Unallocated cash is never the silent default when a usable wallet exists.
11. Quick-expense wallet rules: none → unallocated + visible warning; one → preselect visibly; multiple → explicit choice required; unallocated stays explicitly selectable.
12. No automatic memory of the last wallet in this package.
13. Home and Finance show the same committed state immediately after saving, without navigation or reload.
14. The accounting equation (`recorded cash = wallets + unallocated`) and duplicate-effect protection are preserved.

## 5. Baseline findings

Re-verified before implementation (read-only): repository identity
`https://github.com/Qays7753/Micro`, default branch `main`, baseline SHA
`f21f777` — identical to the audit baseline — clean working tree, no unrelated
changes. Baseline quality gates: 391 domain tests + 1280 prototype tests, all
passing; typecheck clean. The audit's live findings were re-confirmed in the
fixed-journey smoke runs after implementation (see §10–§12).

## 6. Implemented changes

### FIN-001 — unknown values no longer render as confirmed zero

- `ProjectFinancialService.readPosition()` computes a per-metric evidence state
  (`recorded` | `not_recorded`) for cash, customer receivables, supplier
  payables, owner capital, wallet cash, unallocated cash, and operating
  expenses, alongside the unchanged numeric values (no broad nullable changes).
- `HomeControlCenterService` consumes the same single evidence source instead
  of its local predicates; direct-sale collections now count as cash evidence
  (closing the receipt-vs-Home mismatch observed in the audit).
- `Finance.tsx` renders «غير مسجل» for position cards, cash-decision metrics,
  review-pulse values, the truth line, the owner-decision metrics, and the
  assets/loans layer summaries when evidence is absent. A calculated zero over
  real records still renders `0.00`.

### FIN-002 — every named debt visible from the first transaction

- `PartyLedgerService.read()` no longer filters by repeated-only; each entry
  carries a `repeated` badge flag (two or more distinct source records).
- `Parties.tsx` reads unfiltered, renders the «متكرر» badge, and labels the
  receivable total with its precise scope (named debts).
- The party-suggestion pickers (`OrderDetail`, `AgreementEditor`) now list all
  recorded names (most-active first).
- Disclosure texts (`OrderDetail`, `AgreementEditor`) and the Conflict B
  decision documentation
  (`docs/decisions/final-continuation-conflict-resolutions-v1.md`,
  `docs/contracts/02-order-lifecycle-contract.md`) reflect the new rule. The
  sale receipts that promise ledger visibility are now truthful. Conservative
  name matching (trim + whitespace collapse only) is preserved.

### FIN-003 — supplier payments carry their cash source

- Domain: `CashAllocationSourceKind` gains `supplier_purchase`;
  `SupplierPurchasePayment` gains an optional `walletId` (backward compatible —
  historical payments without it remain unallocated and are never retroactively
  reassigned).
- `SupplierPurchaseService.recordPurchase` / `recordPayment` accept a wallet
  source, pre-validate wallet existence and balance **before any write** (clear
  validation, no silent switch, no partial state), then create exactly one
  negative `allocation` cash-continuity entry («تغطية دفعة مورد من رصيد
  المحفظة») with a derived idempotent operation key — the wallet is reduced
  once, unallocated is not double-subtracted, and the recorded-cash identity
  holds. A late attribution failure surfaces honestly via `attributionNote`.
- `SupplierPurchaseEditor` shows the source selector for the initial payment
  (when something is paid now) and for later payments, with the approved
  0/1/N-wallet rules, a pre-save warning when no wallet exists, honest success
  copy naming the actual source, and per-payment source display in the
  purchase detail.
- Documented limitation: editing a purchase rebuilds the initial payment
  without a wallet link; the cash delta of the edit flows through unallocated
  exactly as before this package.

### FIN-004 — refresh only from the committed state

- `QuickExpenseForm`, `QuickSaleForm`, and `FinancialEventEditor` now call
  `notifyDataChanged()` exactly once **after** all writes of the flow complete
  (financial event / sale, then the wallet attribution). `DirectSaleEditor`
  receives the same shared fix for its sale-then-attribution sequence.
- Error paths never announce completion (a failed record leaves data unchanged
  with no notification); a failed late attribution is announced after the
  event-committed state, with the money honestly reported as unallocated.

### FIN-005 — explicit quick-expense cash source

- Quick expense and the full expense editor share one rule set: no wallets →
  unallocated with a visible pre-save warning and the later cover action; one
  wallet → visibly preselected with the explicit unallocated option; multiple
  wallets → neutral placeholder «اختر مصدر الصرف» requiring an explicit wallet
  or explicit «الكاش غير الموزع» choice before saving.
- The selector term is unified to «مصدر الصرف» across expense surfaces
  (collection keeps «وجهة القبض»); the last wallet is never remembered;
  reopening re-applies the rule; unsaved drafts carry only explicit choices;
  the rule-driven preselection does not falsely mark the form dirty.

## 7. Files changed

Domain (`src/domain/`):

- `cash-continuity/types.ts`, `cash-continuity/policies.ts` — `supplier_purchase` source kind.
- `supplier-purchase/types.ts`, `supplier-purchase/policies.ts` — payment `walletId` + inputs.

Application (`apps/prototype-web/client/src/application/`):

- `finance/projectFinancialService.ts` — evidence states in `readPosition()`.
- `home/homeControlCenterService.ts` — consumes the shared evidence.
- `parties/partyLedgerService.ts` — no repeated-only filter; `repeated` flag.
- `suppliers/supplierPurchaseService.ts` — wallet source, pre-validation, single attribution.

UI (`apps/prototype-web/client/src/`):

- `pages/Finance.tsx` — «غير مسجل» truth states across the surface.
- `pages/Parties.tsx`, `pages/OrderDetail.tsx`, `pages/AgreementEditor.tsx` — ledger visibility + copy.
- `pages/SupplierPurchaseEditor.tsx` — payment source selectors, warnings, receipts.
- `components/finance/QuickExpenseForm.tsx`, `components/finance/QuickSaleForm.tsx` — notify ordering + source rules.
- `pages/FinancialEventEditor.tsx` — notify ordering + source rules + draft handling.
- `pages/DirectSaleEditor.tsx` — notify ordering.
- `components/layout/QuickActionSheet.tsx` — policy comment.
- `application/collections/collectionService.ts` — comment alignment.

Styles and tooling:

- `index.css` — `.micro-party-repeat-mark` badge.
- `scripts/text-density-count.py` — documented cap raises: Finance 257→258,
  SupplierPurchaseEditor 77→81, FinancialEventEditor 143→145.

Docs:

- `docs/decisions/final-continuation-conflict-resolutions-v1.md` — §باء updated.
- `docs/contracts/02-order-lifecycle-contract.md` — Conflict B boundary updated.

Tests (new): `projectFinancialService.evidence.test.ts`,
`FinanceEmptyTruth.dom.test.tsx`, `partyLedgerService.visibility.test.ts`,
`PartiesLedger.dom.test.tsx`, `supplierPurchaseService.wallet.test.ts`,
`QuickFormsNotify.dom.test.tsx`, `QuickExpenseSource.dom.test.tsx`.
Tests (updated): `SupplierPurchaseEditor.ui.test.tsx`,
`FinancialEventEditor.guided.test.tsx`, `group2InventorySurfaces.test.tsx`.

## 8. Data-model or migration impact

- **No new IndexedDB stores; no schema version bump.** `localSchemaVersion`
  stays 35; the entity-touchpoints manifest is unchanged.
- `SupplierPurchasePayment.walletId` is an optional field: records written
  before this package simply lack it and read as "from unallocated cash" —
  no migration, no retroactive reassignment, no rewriting of historical
  financial records.
- The attribution entry is a standard `allocation` cash-continuity entry with
  the new `supplier_purchase` source-ref kind; older readers ignore unknown
  source kinds (the field is optional by design, same pattern as previous
  source-ref additions).
- Unallocated cash remains a derived value; the accounting identity
  `recordedCash = unallocated + wallets` is unchanged and re-verified in every
  new test scenario.

## 9. Automated tests

Commands run and results (full gate `pnpm check`, 2026-09-16 ~00:20 Amman):

| Command                                                                    | Result | Count                                                   |
| -------------------------------------------------------------------------- | ------ | ------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                                           | PASS   | —                                                       |
| `pnpm typecheck` (root `tsc --noEmit`)                                     | PASS   | 0 errors                                                |
| `pnpm --filter @micro/prototype-web check`                                 | PASS   | 0 errors                                                |
| `pnpm lint`                                                                | PASS   | 0 errors, 36 warnings (pre-existing baseline; limit 37) |
| `pnpm format:check`                                                        | PASS   | —                                                       |
| `pnpm text-density`                                                        | PASS   | all surfaces within §10 caps                            |
| `pnpm design-guards`                                                       | PASS   | —                                                       |
| `pnpm guards` (secrets / test-focus / entity-touchpoints / runtime-cycles) | PASS   | —                                                       |
| `pnpm test` (domain suite)                                                 | PASS   | 391 tests / 35 files                                    |
| `pnpm prototype:test` (web suite)                                          | PASS   | 1311 tests / 185 files                                  |
| `pnpm prototype:build` (production build + bundle budget)                  | PASS   | entry 638,963 B < 650,000 B; gzip 152,320 B < 155,000 B |

- New tests added: 28 (5 + 2 + 4 + 3 + 6 + 3 + 5, including the Home-equals-
  Finance journey assertion). Three existing tests were updated to encode the
  newly approved behavior (FinancialEventEditor guided defaults ×3 → re-pinned
  to the explicit-choice rules; SupplierPurchaseEditor harness gained the real
  cash-continuity service; group2 harness fixed for the new wallet-options
  read). No test was weakened to obtain a passing result.
- Unrelated pre-existing failures: none — the baseline was fully green before
  and after.
- Merge-blocking conditions checked: typecheck ✓, build ✓, financial tests ✓,
  totals reconcile ✓ (asserted in tests), idempotency ✓ (replay test), no
  reload-only behavior ✓ (notify-ordering + Home-equality tests).

## 10. Mobile verification

Emulated viewports (real viewport emulation, not browser zoom):

- **Primary: 390 × 844** (iPhone 14 device profile) — full corrected journeys:
  - FIN-001: empty project Finance shows «غير مسجل» in all four position
    cards; invest 50 + expense 50 shows «الكاش المسجل 0.00» (recorded zero).
  - FIN-002: first deferred sale (عميل-FIN002, 15/5) appears in the People
    Ledger immediately («لك 10.00 · 1 حركة», no badge); ledger total 10.00 =
    Finance «لي عند العملاء» 10.00.
  - FIN-003: purchase form (10.00 total, 4.00 now) shows the source selector
    with the required placeholder over two wallets; saving from «الدرج» leaves
    unallocated at 0.00 and wallets at 96.00 + 50.00; a later 2.00 payment
    from «الدرج» keeps the equation exact (144.00 wallets / 0.00 unallocated);
    the payment row displays «من الدرج»; the explicit unallocated option is
    selectable and screenshotted.
  - FIN-004: after a 3.00 wallet-funded quick expense, closing the receipt
    shows Home «الكاش المسجل 97.00» immediately — no unallocated card, no
    «فرق سالب» warning, no reload.
  - FIN-005: no-wallet warning visible before saving; one-wallet form opens
    with the wallet preselected; two-wallet form opens on «اختر مصدر الصرف»
    and blocks saving until an explicit choice (error message verified).
- **Secondary: 360 × 800** — source selectors fully inside the viewport
  (328×49 box at x=16), zero clipped selects, all options present, save
  action scrolls into view and works, success receipt fits, RTL Arabic
  readable throughout.
- Arabic RTL readability confirmed on every captured screen.

Touch status (reported separately as required):

- `MOBILE_VIEWPORT_VERIFIED`
- `TOUCH_NOT_VERIFIED` — the automation CLI drives interactions with mouse
  events; it exposes no tap primitive, and a physical keyboard cannot be
  attached in this headless environment, so the keyboard-over-save behavior
  and real touch input could not be exercised here.

## 11. Before and after evidence

Each pair below is taken with the same fictitious test data pattern
(`مشروع-FINxxx`, `درج-FINxxx`, …) — "before" from the audit run (pre-fix
baseline `f21f777`, captured on the then-live system), "after" from the fixed
production build served locally and exercised at 390×844:

- **FIN-001** — before: Finance rendered 19× `0.00` on an empty project
  (`before-fin001-finance-zeros.png`). After: all four position cards read
  «غير مسجل» (`fin001-empty-finance.png`), and a calculated zero over real
  records renders `0.00` (`fin001-confirmed-zero.png`).
- **FIN-002** — before: the first debt was absent from the People Ledger
  (`before-fin002-first-debt-hidden.png`) and totals diverged
  (`before-fin002-ledger-totals-diverged.png` vs
  `before-fin002-finance-receivables-22.png`). After: the first debt appears
  immediately (`fin002-first-debt-in-ledger.png`) and ledger and Finance agree
  at 10.00 (`fin002-ledger-totals.png`, `fin002-finance-receivables.png`).
- **FIN-003** — before: no source selector on either form
  (`before-fin003-purchase-no-selector.png`,
  `before-fin003-payment-no-selector.png`) and payments left wallets untouched
  with negative unallocated
  (`before-fin003-wallet-untouched-negative-unallocated.png`). After: selectors
  present on both forms (`fin003-initial-payment-selector.png`,
  `fin003-later-payment-selector.png`), explicit unallocated selectable
  (`fin003-explicit-unallocated.png`), wallet-funded payments keep the equation
  exact (144.00 / 0.00 — verified inline during the run, receipt in
  `fin003-payment-receipt.png`).
- **FIN-004** — before: Home showed the false negative-unallocated breakdown
  after a wallet expense (`before-fin004-home-false-negative-unallocated.png`).
  After: Home reads 97.00 immediately after closing the receipt
  (`fin004-home-immediate-after-expense.png`).
- **FIN-005** — before: the quick expense defaulted to unallocated with one
  wallet and with two wallets (`before-fin005b-default-unallocated.png`,
  `before-fin005c-default-unallocated.png`). After: no-wallet warning
  (`fin005a-no-wallet-warning.png`, receipt `fin005a-receipt.png`), one-wallet
  preselection (`fin005b-one-wallet-preselect.png`), two-wallet required
  choice (`fin005c-multi-wallet-required.png`).

No screenshot is annotated or altered; captures show exactly what the
interface displayed. All captured data is fictitious test data.

## 12. Screenshot index

| Screenshot                                                | Issue       | Before/after    | What it proves                                                        | How it helped                                                |
| --------------------------------------------------------- | ----------- | --------------- | --------------------------------------------------------------------- | ------------------------------------------------------------ |
| `before-fin001-finance-zeros.png`                         | FIN-001     | Before          | Empty project rendered 0.00 as confirmed values on Finance            | Locked the baseline defect for the truth-state fix           |
| `fin001-empty-finance.png`                                | FIN-001     | After           | All four position cards show «غير مسجل» with no evidence              | Confirms the empty-state truth fix on the real build         |
| `fin001-confirmed-zero.png`                               | FIN-001     | After           | Calculated zero over real records renders 0.00                        | Confirms real zeros remain distinguishable from missing data |
| `before-fin002-first-debt-hidden.png`                     | FIN-002     | Before          | First debt absent from the People Ledger                              | Locked the ≥2-occurrence hiding baseline                     |
| `before-fin002-ledger-totals-diverged.png`                | FIN-002     | Before          | Ledger total (18.00) missed single-record debts                       | Locked the totals-divergence baseline                        |
| `before-fin002-finance-receivables-22.png`                | FIN-002     | Before          | Finance receivables (22.00) included all debts                        | Paired the two read models' divergence                       |
| `fin002-first-debt-in-ledger.png`                         | FIN-002     | After           | First debt «لك 10.00 · 1 حركة» visible immediately                    | Confirms first-transaction visibility, no badge              |
| `fin002-ledger-totals.png`                                | FIN-002     | After           | Ledger total 10.00 with precise scope label                           | Confirms totals over the full visible population             |
| `fin002-finance-receivables.png`                          | FIN-002     | After           | Finance «لي عند العملاء» 10.00                                        | Confirms cross-surface consistency                           |
| `before-fin003-purchase-no-selector.png`                  | FIN-003     | Before          | Purchase form had no payment-source selector                          | Locked the missing-feature baseline                          |
| `before-fin003-payment-no-selector.png`                   | FIN-003     | Before          | Later-payment form had no source selector                             | Same, for the payment flow                                   |
| `before-fin003-wallet-untouched-negative-unallocated.png` | FIN-003     | Before          | Wallets untouched while unallocated went negative                     | Locked the two-step cover journey baseline                   |
| `fin003-initial-payment-selector.png`                     | FIN-003     | After           | Initial payment carries the source selector with required placeholder | Confirms entry-time source selection on purchase             |
| `fin003-later-payment-selector.png`                       | FIN-003     | After           | Later payment carries the same selector                               | Confirms parity between both payment flows                   |
| `fin003-explicit-unallocated.png`                         | FIN-003     | After           | «الكاش غير الموزع» selectable explicitly                              | Confirms the honest fallback stays available                 |
| `fin003-payment-receipt.png`                              | FIN-003     | After           | Receipt after a wallet-funded later payment                           | Confirms successful save path on mobile                      |
| `before-fin004-home-false-negative-unallocated.png`       | FIN-004     | Before          | Home showed negative unallocated + stale wallet after wallet expense  | Locked the intermediate-read baseline                        |
| `fin004-home-immediate-after-expense.png`                 | FIN-004     | After           | Home reads 97.00 right after closing the receipt                      | Confirms committed-state refresh without reload              |
| `before-fin005b-default-unallocated.png`                  | FIN-005     | Before          | One wallet existed yet default was unallocated                        | Locked the silent-default baseline                           |
| `before-fin005c-default-unallocated.png`                  | FIN-005     | Before          | Two wallets existed yet default was unallocated                       | Same, multi-wallet case                                      |
| `fin005a-no-wallet-warning.png`                           | FIN-005     | After           | Visible pre-save warning with no wallets                              | Confirms the explained unallocated fallback                  |
| `fin005a-receipt.png`                                     | FIN-005     | After           | Honest receipt (−2.00) after the warned save                          | Confirms receipt matches the warned outcome                  |
| `fin005b-one-wallet-preselect.png`                        | FIN-005     | After           | Single wallet preselected visibly                                     | Confirms the one-wallet rule                                 |
| `fin005c-multi-wallet-required.png`                       | FIN-005     | After           | Neutral placeholder with explicit options                             | Confirms the required-choice rule                            |
| `viewport-360-fin005c-selector.png`                       | FIN-005     | After (360×800) | Selector fits the secondary viewport                                  | Confirms no clipping at 360 px                               |
| `viewport-360-fin003-payment-selector.png`                | FIN-003     | After (360×800) | Payment selector reachable by scroll                                  | Confirms usability at 360 px                                 |
| `viewport-360-success-receipt.png`                        | FIN-004/005 | After (360×800) | Success receipt fits and reads 143.00                                 | Confirms success states at 360 px                            |

## 13. Known limitations

- **Touch input** was not verified (`TOUCH_NOT_VERIFIED`): the automation CLI
  has no tap primitive and no physical keyboard can be attached in this
  headless environment; the keyboard-over-save behavior remains to be spot
  checked on a real device.
- **Deployment verification** — see §15; the live URL must be re-checked after
  the Cloudflare Pages build finishes for the merged `main`.
- Editing a supplier purchase rebuilds its initial payment without a wallet
  link (the cash delta flows through unallocated, as before this package);
  documented in §6.
- Supplier payment reversals return cash to unallocated (the wallet cover
  entry stays); redistributing back to a wallet remains the existing explicit
  distribution action, unchanged by this package.
- The People-Ledger receivable total covers named debts; debts without a name
  remain visible in Finance only — the total card carries the precise scope
  label instead of merging scopes silently.
- Name grouping remains trim + whitespace-collapse only (hamza/tied-ta
  normalization and hyphen/space equivalence stay out of scope, per the
  documented decision).

## 14. Git and merge result

- Baseline `origin/main`: `f21f777` (recorded before any change; fast-forward
  only).
- Branch: `fix/financial-trust-fin001-fin005-20260915-2321`, created from the
  baseline; commits (in order):
  1. `c6f596a` — `fix: preserve unknown financial states` (FIN-001)
  2. `e7d4e0f` — `fix: show all debts in people ledger` (FIN-002)
  3. `f94054a` — `fix: assign supplier payments to cash sources` (FIN-003)
  4. `ad9095a` — `fix: refresh financial state after wallet allocation` (FIN-004)
  5. `2452466` — `fix: require explicit quick-expense cash source` (FIN-005)
  6. `3271cfb` — `test: cover financial trust journeys`
  7. `f95b424` — `test: cover financial trust journeys` (harness fix; suite-wide clean run)
- No force push, no history rewrite, no destructive resets, no unrelated files
  touched. `git status` clean at merge time.
- Final verification of the remote `main` SHA after merge and push is recorded
  in §15 (deployment verification) — the merge itself is a fast-forward of the
  branch onto `main`.

## 15. Deployment verification

Pushing `main` triggered the Cloudflare Pages deployment for
https://micro-prototype.pages.dev/. Verified on the live deployment with a
clean browser session and fictitious test data only:

- Final `main` SHA (local and remote, re-verified via `git ls-remote`):
  `f3333e4fdc302916953892578eb4f6a2dce9e19e` (fast-forward from `f21f777`;
  the entry chunk hash is environment-dependent, so the new build was
  identified by content markers — the live quick-sheet chunk serves
  «مصدر الصرف» / «اختر مصدر الصرف» / «لا محافظ معلنة بعد», strings that exist
  only in this package).
- Deployed URL: https://micro-prototype.pages.dev/
- Verification time: 2026-09-16 ~00:50 Asia/Amman.
- Live smoke results (clean session, 390×844 device emulation):
  - **Empty-state truth** — a brand-new project's Finance shows «غير مسجل» in
    all four position cards. PASS.
  - **First debt visibility** — a first deferred sale (عميل-دخان, 15/5)
    appears immediately in the live People Ledger («لك 10.00 · 1 حركة»). PASS.
  - **Supplier wallet selection** — the purchase form shows the source
    selector with the single wallet preselected; a 4.00 wallet-funded initial
    payment leaves wallets at 96.00 and unallocated at 5.00 (no negative
    unallocated, exact total). PASS.
  - **Immediate Home refresh** — after a 3.00 wallet-funded quick expense and
    closing the receipt (no reload), Home reads «الكاش المسجل 98.00» with no
    false negative-unallocated warning. PASS.
  - **Quick-expense wallet rule** — the quick expense opens with the single
    wallet preselected («درج-دخان — تغطية من رصيدها»). PASS.

`FINANCIAL_TRUST_FIXES_MERGED_TO_MAIN — DEPLOYMENT_VERIFIED`
