# Z2 Delivery Report — Work/Order Clarity and Outcome Grammar (WS-172, Z2.0–Z2.8)

- **Scope & credential mode:** Z2 only (package §6 steps Z2.0–Z2.7 + Z2.8 gate); owner PAT used exclusively for branch push / PR comment via local credential file; never printed, echoed, committed, or embedded.
- **Baseline SHA:** `b0b4cea66a06c295c65eb895dc2b9067c8b732cf`. **Branch:** `feat/ux-ui-z1-z2-20260921`. **Z2 commits (order):** `ae639dd` (Z2.0 orders tests) → `663692e` (Z2.1–Z2.2) → `da165d7` (Z2.0 sale/expense tests) → `af7cb16` (Z2.3–Z2.4) → `70accca` (Z2.0 collection tests) → `47e1668` (Z2.5) → `fd9a5f9` (Z2.6) → `326324f` (views regen) → `46196e4` (visual evidence). **PR:** #207 (draft).

## Files changed and why

| File | Why |
|---|---|
| `pages/Orders.tsx` | Rows use the domain `order.nextAction` (map as fallback); delivered/settled rows qualify with «سُلّم في …» (actual delivery moment) instead of a stale due date; pre-delivery rows keep «موعد التسليم: …». Draft rows name the concrete missing step (وصف/ملاحظات التخصيص/نسخة التكلفة — تكفي تقديرية/سجّل الاتفاق). |
| `pages/OrderDetail.tsx` | Decision card next action = domain `nextAction`; new collapsed journey composition `order-journey-composition` (ما أُنجز / التحصيل مع «تحصيل جزئي حتى الآن» مقابل «تحصيل كامل» والمتبقي / ما ينقص / الخطوة التالية / النتيجة عند التسليم: نهائية/تقديرية/غير مكتملة/تحتاج مراجعة); standing delivery shows «سُلّم في …»; dismiss-only buttons renamed to «إغلاق» (Z2.6) while documented-reversal wording («تراجع موثق…», «عكس …») is preserved verbatim. |
| `pages/DraftEditor.tsx` | Delete-confirm back-out button: dismiss vocabulary «إغلاق» (Z2.6); delete-draft copy and eligibility untouched. |
| `components/finance/QuickSaleForm.tsx` | `result.reused` → neutral protection receipt («سجل موجود سابقًا» + protection note + open-record action); no notify, no re-attribution. |
| `components/finance/QuickExpenseForm.tsx` | Read-only recurring-occurrence warning (visible, non-blocking, `role="status"`, guided-editor wording via shared helper, null-guarded, effect-scoped); `reused` neutral handling; failure ARIA aligned to `role="alert"` with retained input + same-key safe retry. |
| `pages/DirectSaleEditor.tsx` | Attribution-failure reason carried into the done screen: explicit Partial Success composition (completed sale vs failed attribution; money safe in unallocated; next action opens the record; NO re-record path). |
| `pages/Collect.tsx` | Done screen repeats the full source identity (qualifier + item name beside the person) for success and partial settlement. |
| `app/resultFeedback.ts` | Shared truthful-outcome constants: `REUSED_RECORD_RECEIPT_TITLE`, `REUSED_RECORD_PROTECTION_NOTE`, `saleDonePartialAttributionNote()`, `recurringOccurrenceWarningNote()`, `DISMISS_PANEL_CLOSE_LABEL`. |
| Tests (Z2 allowlist): `Orders.ui.test.tsx` (+4), NEW `OrderDetail.ui.test.tsx` (+7), `G3.dom.test.tsx`, `G2.dom.test.tsx`, `U06.dom.test.tsx`, `DirectSaleEditor.ui.test.tsx`, `QuickExpenseSource.dom.test.tsx`, `QuickFormsEnter.w43.dom.test.tsx`, `QuickFormsNotify.dom.test.tsx` | Contract coverage for stage/next action, estimated vs final, collection completeness, reused-neutral, partial-success visibility, recurring warning visible/non-blocking, vocabulary boundaries. |
| `index.css` | Unchanged in Z2 (Z1's four Home-only selectors remain the only additions). |

NewDraft/AgreementEditor/CostEditor/DeliveryReview: verified unchanged — the required grammar already existed (knowledge copy, final-price wording, receipt next-action); the allowlist is permission, not obligation.

## Visible behavior changed

Work list rows expose stage + one relevant qualifier + next action everywhere; delivered rows stop showing a stale due date; drafts name their concrete missing step. OrderDetail shows a compact journey composition (completed / collection state incl. partial vs complete / missing / next action / result marker) collapsed after the decision card, and the decision card matches the domain next action. Quick sale/expense render `reused` as a neutral protection receipt; quick expense shows the recurring-occurrence warning beside the date (non-blocking); expense failures announce as alerts with input retained and safe retry; the direct-sale done screen makes a failed wallet attribution an explicit Partial Success. Collect's done screen identifies its source (kind + item + person). Dismiss-only panel buttons read «إغلاق» — «تراجع» is reserved for documented reversals.

## Contracts and invariants preserved

`recorded`/`reused`/`record_failed`/`result_unknown` distinct; `reused` neutral (not error/partial); dependent attribution failure never re-records (per-mount + `:attribute` derived keys untouched); no new `result_unknown` flows; `dueOn` ≠ `occurredOn`; reversal/correction documented and history-preserving; delete only eligible unlinked drafts; partial collection never presented complete; over-remaining refusal/cumulative/reason/D-031 lock/idempotency untouched; journey flexible (no wizard; review impact non-blocking); manual expense directly available; warning is read-only over `findUnhandledOccurrenceForDate` (no writer, no gate, no navigation change); OPS-003 pages/service/routes untouched; five destinations and all §2.4 routes valid; schema/export 36/28; no new writers/reads (one additional read of existing `stored.order.events` for the delivery moment); primitives/tokens only.

## Exact commands, tests, and checks (Z2 HEAD)

1. Z2 targeted gate (§7.3, 19 files): **148/148 PASS** (orchestrator run); Agent 5 independent re-run (18-file subset): **141/141 PASS**.
2. OPS-003 non-regression gate (§7.4 exact command): **5 files / 57/57 PASS** (run twice — orchestrator + Agent 5).
3. `pnpm prototype:check`: **PASS**. `pnpm design-guards`: **PASS** (tokens, 82/82 contrast, stylelint). `pnpm guards`: **PASS** (Agent 5).
4. Full `pnpm check`: **EXIT 0** at the Z2 implementation head (incl. root 434 + prototype suite, lint 37/37, format, text-density, build + bundle budget **625,551/650,000 raw · 148,571/155,000 gzip PASS**); re-run at final evidence head recorded in the Z2 CHECKPOINT PR comment.
5. Z1 regression re-run: **68/68 PASS** (Agent 5).
6. Z2.0 red-state record: orders 9F/10P; sale/expense 7F/24P; collection 4F/27P — all approved gaps, then green.
7. `pnpm text-density` (final): Home 71/78 · Orders 85/86 · OrderDetail 181/183 · NewDraft 0/30 · DraftEditor 48/49 · AgreementEditor 63/63 · CostEditor 60/60 · DeliveryReview 53/53 · DirectSaleEditor 86/87 · Collect 58/58 · FinancialEventEditor 175/175 · FinanceMore 39/39 — every surface ≤ cap, three ratchet gains vs baseline.

## Visual QA (live, production build; §8.3 subset)

**VERIFIED live:** draft row with concrete missing step («احفظ نسخة التكلفة أولًا — تكفي تقديرية»); executing/agreement row with stage + delivery date + remaining + next action; OrderDetail journey composition contents (ما أُنجز/التحصيل/ما ينقص/الخطوة التالية/النتيجة غير محسوبة قبل التسليم); quick-expense sheet renders warning infrastructure + no-wallets advisory; no horizontal overflow at 320/360/390/430 on Orders and OrderDetail; zero console/page errors. Screenshots: `z2-orders-draft-row-390.png`, `z2-orderdetail-journey-390.png`, `z2-orders-executing-row-390.png`.

**NOT_EXECUTED (live):** quick-expense recurring-warning live replay (requires choosing an October date; native date-input automation could not drive React state — the warning is DOM-test-covered incl. visible+non-blocking assertions, and the guided-editor equivalent is OPS-003's own tested behavior; the September period correctly had no occurrence — honest no-warning); delivery/partial-collection order states live (DOM-covered); keyboard/focus/Safe Area/real-device (no physical device — `REAL_DEVICE_QA_NOT_PERFORMED`).

## Evidence classes

Gates and test results above: **VERIFIED** (run by orchestrator; key subsets independently re-run by Agent 5). Live visual claims: **VERIFIED** where listed; environment-limited items: **NOT_EXECUTED** with reasons. Necessity-note drafts (OrderDepositPanels «عكس عربون نشط», SaleCollectionReversalSection «عكس تحصيل», EventsLayer «إلغاء/حذف العملية»): **DEFERRED** — recorded, not executed, owner approval required before any edit.

## Failures and classification

- Excel meta/views staleness failing `operations-control` tests after agent commits: **current-diff** — fixed via the official generator (`326324f`).
- No pre-existing/environmental/outside-wave failures remain.

## Protected-file exceptions

None (FinancialEventEditor/QuickActionSheet/navigation/OPS-003 untouched). Out-of-allowlist exceptions remain exactly the two Z1 §10.6 single-line test edits.

## Deferred work

The three necessity-note drafts above (owner decision); optional «افتح السجل» item suffix on Collect; guided editor's error-styled reused message (protected, cosmetic); real-device QA; Dark Mode/tablet/desktop (out of scope).

## Rollback boundary

Revert Z2 commits in reverse order (`46196e4` → `326324f` → `fd9a5f9` → `47e1668` → `70accca` → `af7cb16` → `da165d7` → `663692e` → `ae639dd`) without touching Z1; Z1 files unchanged by Z2 except OrderDetail/DraftEditor presentation (revert restores Z1 state exactly).

## Owner decision required

`NONE` for Z2 as specified — pending owner veto rights on: (1) the two Z1 §10.6 test-assertion exceptions; (2) the three Z2.7 necessity-note drafts (deferred, unimplemented).

**Status: `Z2_COMPLETE — PR_READY`** (after the Z2 CHECKPOINT push below).
