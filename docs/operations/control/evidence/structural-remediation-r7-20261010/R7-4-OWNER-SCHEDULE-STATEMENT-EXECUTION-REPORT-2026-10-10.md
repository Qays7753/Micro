# R7-4 — Owner, Schedule, and Statement Boundaries (P05 + P06 + P11) — Execution Report

**Program:** WS-216 / ARCH-007 — R7 wave, slice R7-4
**Date:** 2026-10-10 · **Executor:** Z AI · **Base:** R7-3 head `c0fe0df2…` · **Mode:** BRANCH_AND_PR_ONLY

## 1. Scope executed

- **R6-F17-P05** OwnerEntitlement — active-record derivations behind an owner-money view-model (the PC-4 service untouched).
- **R6-F17-P06** Schedule — three-way page query + capacity-layer param behind a scheduling view-model + **new journey coverage** (card requirement).
- **R6-F17-P11** Statement — statement query + comparison side-B + week bounds behind a finance view-model; markdown renderer injected as an explicit parameter (review amendment 6).

## 2. What changed

| File | Change |
|---|---|
| `application/owner-money/ownerEntitlementViewModel.ts` (+test) | **NEW** — `readOwnerMoneyOverviewBlock`, `deriveActiveOwnerRecords` (reversal-aware active entitlements/opening balances/prior draws — verbatim filter logic). 3 unit tests. |
| `application/scheduling/scheduleViewModel.ts` (+test) | **NEW** — `ScheduleState`, `readSchedulePage` (three-way Promise.all with original error-message precedence + catch fallback), `capacityLayerParam`. 3 unit tests. |
| `application/finance/statementViewModel.ts` (+test) | **NEW** — `StatementState`/`ComparisonState`, `readStatementBlock`, `resolveComparisonSideB`, `readPeriodComparisonBlock`, `shiftDate`/`weekBounds`. 4 unit tests. |
| `client/src/ScheduleJourneys.dom.test.tsx` | **NEW** — two schedule journeys over the real canonical services on MemoryLocalStore: ready-without-flicker + Sunday→Saturday work week; honest failure with retry message (placed at client/src root per the page-journey convention; pages/ tests cannot value-import the store by ESLint rule). |
| `pages/OwnerEntitlement.tsx` | 1165→1159 raw lines: owner-money load + active-record derivations via the model; the two F-049 mirrors and all write channels untouched; PC-4 service untouched. |
| `pages/Schedule.tsx` | 1032→1009 raw lines: state type + load effect + capacity param via the model; sections and write channels untouched. |
| `pages/Statement.tsx` | 825→814 raw lines: state types + both reads + side-B + week bounds via the model; `markdownRenderer` stays instantiated at :167 and is passed explicitly; report download/share untouched. |
| `moneyLayerGuard` | VIEW_MODEL_MODULES += 3. |
| `ui-application-import-baseline.json` | +3 documented keys (terminal state 52 keys: 36 PSC + 16 wave keys — dated note records the R7 terminal set). |
| `check-module-boundaries.test.mjs` | Count pin 13→16 with the R7-terminal dated note. |
| `bundle-surfaces-baseline.json` | Third documented same-PR update (lazy +890 raw / precache +890 for the three modules; entry ceilings untouched — 629,300 raw / 154,683 gzip local). |
| register §2/§3 | Rows re-measured + dated closures P05/P06/P11; test-map regenerated (61 pages incl. ScheduleJourneys mapping). |

## 3. Verification

Typecheck clean; lint 0/35; format clean. Focused: G6 (7), G2+StatementPeriod+G004 (22), ScheduleJourneys (2), model tests (10). Full: **root 730/730; app 333 files / 2,449 tests** (+4 files over R7-3). Guards 17/17; build PASS (budget 629,300/154,683; surfaces within updated baseline).

## 4. Impact

**None** across financial/semantic (PC-4 service untouched; derivations verbatim), schema/export/import (38/30), historical/rejection, security, visual UI (no CSS/DOM/copy change; DOM pinned by journeys).

## 5. Rollback

Revert the R7-4 commits only. No data effect.

## 6. Status

R7-4_COMPLETE (P05 + P06 + P11). **All eleven packages P01–P11 are now executed.** Remaining: R7-5 (shim closure), R7-6 (closure evidence + PR).
