# Financial Roadmap — Wave 4 Delivery Report (FIN-004, WS-176)

**Branch:** `feat/fin-004-safe-withdrawal-20260923` (base: verified main `dacade91dc5e9a4de3971a2d30d040c79bebacc6` — Wave 3 closed)
**Scope:** advisory owner safe-withdrawal reading ONLY. **Schema/export unchanged 37/29**; no new persistent entity; the reading writes nothing and executes nothing.

## What was built

1. **Pure domain policy** (`src/domain/owner-safe-withdrawal/`): `calculateSafeWithdrawal` composes the FIN-005 horizon result (type-only dependency on the g5 domain — no second math path): **headroom = projected cash − explicit reserve**. Statuses `available / needs_review / incomplete` with always-visible reasons and next actions: no number when the reserve is unset (**no invented percentage or months-of-expense rule**), when the owner explicitly disabled the reading, when recorded cash is not recorded, or when the short-cash forecast itself is incomplete/invalid (its reasons carried verbatim). Negative headroom shown unclamped with its reason. **Loans are disclosure-only context** (outgoing loans already sit outside recorded cash — never inflow, never double-subtracted); the **profit-is-not-cash assumption is permanently present**; every next action avoids command/guarantee wording by test.
2. **Surface** (`pages/Finance.tsx` `CashDecisionSurface`): an advisory sub-section on the same cash-decision card, over the **same 7/30/90 horizon selector** (Wave 3): explicit fixed-reserve money input (`EnglishNumberInput kind="money"`), explicit disable/enable toggle owned by the user, headroom + outstanding-loans metrics with honest «غير متاح» states, the advisory-only disclaimer («لا تنفّذ سحبًا ولا تضمن سيولة، والربح ليس كاشًا»), and the reading's reasons/next action from the domain. **No withdrawal button, no blocking, no guarantee language.**
3. **Reserve persistence decision (documented)**: the reserve is **session state only**. LocalPreferences is forbidden for money-valued content (preferences charter — contracts 41 §8 / 42 §8); a durable store requires the guarded schema/export bump 37/29 → 38/30 with a specific owner decision (D-037/D-038 model). The owner-approved execution map says "unchanged" for this wave, so durability is recorded as an **explicit deferred owner decision** rather than silently bumped. The UI says «جلسة فقط» next to the reserve label.
4. **Composition economy**: the reading composes state the page already holds (Wave-3 horizon reading, position cash evidence, loans overview) — no additional store reads, no new service, no new effect. The domain module lands in the Finance route chunk: **entry bundle byte-identical (649,292/650,000)**.

## Tests (16 new: 11 domain + 5 DOM)

- **Domain** (`tests/domain/owner-safe-withdrawal.test.ts`): headroom derivation; needs_review propagation with assumptions; negative unclamped with reason; unset → no number (no invented rule); disabled → no number (owner's choice); cash-not-recorded → no number; short-cash incompleteness inherited with visible reasons; invalid short cash → incomplete (never zero); loans context disclosed but never in math; zero loans without disclosure; next actions carry no command/guarantee wording.
- **DOM** (`FinanceSafeWithdrawal.w176.dom.test.tsx`): advisory section renders with no number until a reserve is entered (reason visible, no «اسحب» button, disclaimer present); headroom = projected − reserve once entered (10000 − 4000 commitments − 3000 reserve → 30.00) with `notifyDataChanged` never called; horizon movement honesty (7-day window excludes the later commitment → headroom rises to 50.00); owner disable → no number with honest reason; profit separation disclaimer + loans line.

## Gates

- Full CI-equivalent pipeline green: typecheck; lint 0 errors / **37 warnings (budget 37)**; prettier; **text-density Finance 330/330 (documented raise 322→330 — 8 mandated strings, D-038 model)**; design-guards; guards (secrets 1712/0, test-focus 300/0, entity-touchpoints PASS, cycles 0); root suite **465/465** (+11); prototype suite **261 files / 1857/1857** (+5); build + PWA; bundle **649,292/650,000 raw + 154,160/155,000 gzip — PASS (entry byte-identical)**.
- Operations Control: validator PASS (64 items, 18 workstreams, 1 active claim).

## Owner-review items (vetoable)

1. **Density cap Finance 322→330** (8 mandated strings: section title, advisory disclaimer, reserve label + session-only note, enable/disable toggle labels, headroom + outstanding-loans metric labels).
2. **Reserve durability deferred**: session-scoped reserve by design this wave (charter + map); a durable reserve needs a guarded 38/30 bump — recorded for the owner decision register (D-039 candidate) rather than silently implemented.

## Not changed (intentionally)

`withdrawalWalletGuard` and every withdrawal execution path (the reading never touches them); the FIN-005 horizon resolver and `g5Service.readShortCashHorizon` (byte-identical); all G5 domain policies; every storage writer; the period view; the declarations editor. No cleanup, no structural refactor.

## Rollback boundary

`dacade91dc5e9a4de3971a2d30d040c79bebacc6` (verified main immediately before this wave). Revert = single revert of the wave squash merge (self-contained: domain module + surface wiring + tests + density ledger entry + tracker updates).
