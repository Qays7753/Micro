# S15 review addendum — S15-MR-001 confirmed phone-back gap — 2026-11-03

**Status:** `S15_MR_001_REPAIRED — ROOT_FIX_DELIVERED — REDELIVERED_FOR_INDEPENDENT_REVIEW` (finding root-repaired with a durable red/green regression and redelivered for independent review; this addendum does not claim S15 acceptance. The pre-repair record below is preserved as history).

**Branch / PR:** `components/integration-20261027` / Draft PR #383. At discovery, the live branch and PR head were `37f81d9a0d089621ec14a99f0c26b457bcf6fb0e`; `main` remained `3584aa1d08cea3e0a00623b719fed7f991ce187f`. The exact head must be rechecked before implementation.

## Finding

`S15-MR-001 — FinanceFunctionsBoard does not implement the phone/browser Back behavior claimed in the S15 result.`

The S15 result (`20-S15-RESULT-2026-11-03.md`, §2-b item 2, §5 R5) says closing the Finance Functions board with the phone Back button is supported. The delivered implementation does support Escape, the close button, and focus restoration, but neither `FinanceFunctionsBoard.tsx` nor its parent `Finance.tsx` installs a `popstate` handler or owns a history entry for the open board. The DOM test `apps/prototype-web/client/src/FinanceFunctionsBoard.unit013.dom.test.tsx` tests close-button and Escape behavior only; it does not exercise `popstate`/phone Back. Its opening comment and the result therefore overstate the delivered behavior.

Evidence inspected on the discovery head:

- `apps/prototype-web/client/src/components/finance/FinanceFunctionsBoard.tsx`: opening/closing behavior and Escape listener are present; no board-owned `history`/`popstate` path exists.
- `apps/prototype-web/client/src/pages/Finance.tsx`: the board's parent has no `popstate`/history handler covering it.
- `apps/prototype-web/client/src/FinanceFunctionsBoard.unit013.dom.test.tsx`: AF-AC07 covers close button and Escape plus trigger focus restoration, but not phone Back.
- `apps/prototype-web/client/src/pages/Setup.tsx` and `apps/prototype-web/client/src/components/forms/UnsavedChangesGuard.tsx`: existing same-URL sentinel/popstate patterns are available as behavioral references; the board must not inherit unsaved-change semantics that do not apply to it.

## Required root-cause repair

Implement one board-owned, lifecycle-safe Back path using the existing application history conventions. Opening the board must create at most one safe same-page history state for the board. One phone/browser Back action while it is open must close only the board, preserve `/finance` and the selected period and all financial data, and restore focus to the control that opened it. Escape and the close button must continue to close the board and restore focus without leaving stale or duplicate history entries. Repeated open/close cycles, route changes, and unmount cleanup must not accumulate sentinels or cause a later Back action to navigate unexpectedly.

Add a durable DOM regression test in the existing test file. It must reproduce the missing behavior before the repair and prove the repaired phone-Back path, unchanged route/period/data, focus restoration, existing Escape/close behavior, repeated cycles, and listener/history cleanup. Follow the established Setup pattern where suitable, with a narrow solution rather than a general navigation refactor.

## Required record and release boundary

The finding is confirmed and in scope; it is not `PRESERVE`, `DEFER`, or a reason to raise a bundle ceiling or weaken a guard. Keep the old result's historical statement visible but correct its current status in this addendum and the final S15 report. S15 remains unaccepted until the owner reviews the corrected delivery. After the fix and evidence are complete, return DOC-024/WS-240 to their legal review states; do not self-accept them. The owner has authorized the next execution order to continue directly into S16 after this fix is complete and S15 has been released back to review, without an intermediate approval pause.

**Allowed scope for this fix:** `FinanceFunctionsBoard.tsx`, its owning `Finance.tsx` wiring if needed, the existing DOM test, and the minimum linked result/Control evidence. No financial, period, route contract, schema/export, broad UI, or structural changes are authorized by this finding.

**Review state:** `ROOT_FIX_DELIVERED` — repaired at commit `c788b09f` (legal IN_PROGRESS transition `11edf9f3` over `8c0361b9`): the board owns one lifecycle-safe same-page history sentinel on the standing Setup.tsx pattern; phone/browser Back closes only the board (no route/period/money change, focus restored), non-Back closes and unmount consume the entry idempotently. Regression written red first on `8c0361b9`: 4 failed | 7 passed (`expected false to be true` at open; `back` called 0 times on non-Back close and unmount; popstate left the dialog open); green after: 11/11 board file, 119/119 across 21 finance-mounting files, 88/88 popstate-adjacent. jsdom only — no physical-device test; the browser's asynchronous back-pop is emulated explicitly per the documented Setup.ui.test.tsx convention. DOC-024/WS-240 returned legally to IN_REVIEW/REVIEW_REQUIRED at `c788b09f` — re-delivery for independent review, not acceptance.
