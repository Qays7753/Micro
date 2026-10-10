# R7-1 — Finance Structural Boundary (P02) + EventsLayer Separation (P10) — Execution Report

**Program:** WS-216 / ARCH-007 — R7 wave, slice R7-1
**Date:** 2026-10-10 · **Executor:** Z AI · **Base:** `e01d5605…` + R7-0 commit `db0921d5…` · **Mode:** BRANCH_AND_PR_ONLY

---

## 1. Scope executed

Per the approved cards and the review-gate amendments (R7-0 §8):

- **R6-F17-P02** — FinanceState state/query ownership boundary + F-019 mixed-cycle root fix.
- **R6-F17-P10** — EventsLayer orchestration separated from its parallel presentation section.

## 2. What changed (files)

| File | Change |
|---|---|
| `application/finance/financeState.ts` | **NEW (270 nbLOC, NORMAL)** — application-owned Finance view-model/query surface: `FinanceBlockId`, `FinanceState`, `BridgeState`, `CashHorizonState` types; `BlockRead`/`safeBlock`; `monthBounds`; `readFinanceOverview(deps, from, to)`; `readProfitToCashBridge`; `readShortCashHorizonBlock`. Services injected; React-free; no storage access; no financial rule (moneyLayerGuard pins it at 0 money-compute lines). |
| `application/finance/financeState.test.ts` | **NEW** — 9 unit tests: ready/error mapping, core-failure isolation, advanced-block `failedBlocks` classification, loans-null honest-block, read-start order pin (pulse IIFE then left-to-right), bridge/horizon contracts, `monthBounds`. |
| `application/finance/index.ts` | Door widening — **type-only** +4 (`BridgeState`, `CashHorizonState`, `FinanceBlockId`, `FinanceState`) with dated note. Value surface unchanged. |
| `pages/Finance.tsx` | Types/helpers/assembly removed (1640 → 1498 raw lines); imports the surface (types via door, readers via documented deep import); the three effects are thin bindings (active-flag setState boundary preserved); `useState` glue, range UI, FIN-002 lazy sites, rendering untouched; orphaned type imports removed (12); a domain-g5 type import left with the page's other g5 imports — shim migration is R7-5 scope. |
| `components/finance/FinancePeriodResultSection.tsx` | Import line only: `FinanceState` now from `@/application/finance` (was `@/pages/Finance`) — **the F-019 type edge is gone**. |
| `components/finance/FinancialEventRow.tsx` | **NEW (742 nbLOC, WATCH)** — verbatim move of `eventLabel`, `expenseContextLabel`, `CorrectionMode`, `familyEventOwner`, `FinancialEventRow` from EventsLayer. |
| `components/finance/EventsLayer.tsx` | Layer orchestrator only (844 → 101 raw lines; SPLIT_CANDIDATE → NORMAL — ratchet gain); imports the row from the sibling. |
| `moneyLayerGuard.contract.test.ts` | Amendment-4 extension: `VIEW_MODEL_MODULES` pinned at zero money-compute lines (financeState.ts first) + stale-pin liveness test (8 → 10 tests). |
| `scripts/file-size-ratchet-baseline.json` | +FinancialEventRow.tsx WATCH (legitimate new-band entry, dated register row same-PR); EventsLayer SPLIT_CANDIDATE → NORMAL. |
| `scripts/application-door-surfaces-baseline.json` | finance door type surface 25 → 29 symbols. |
| `scripts/ui-application-import-baseline.json` | +1 documented key: `pages/Finance.tsx -> application/finance/financeState.ts` (dated reason recorded in the file). |
| `scripts/check-module-boundaries.test.mjs` | Baseline-count pin updated same-PR: otherKeys 6 → 7 with dated note + new-key assertion. |
| `docs/architecture/refactoring/FILE-SIZE-AND-RESPONSIBILITY-REGISTER.md` | §2: Finance.tsx row re-measured + dated closure; EventsLayer row re-measured + dated closure; new FinancialEventRow row. §3: P02/P10 cards carry dated closure notes. |
| `docs/architecture/refactoring/generated/test-map.json` | Regenerated (head field only; no mapping drift — the new test is a module test, not a page test). |

## 3. F-019 mixed-cycle dissolution proof (amendment-8 protocol)

- (a) **Census:** zero production files import `@/pages/Finance` except its own value consumers (`MicroRouter.tsx:33` lazy route + 15 dom-test files, all one-directional). `FinancePeriodResultSection.tsx:11` now imports `FinanceState` from `@/application/finance`. **VERIFIED.**
- (b) The value edge `Finance.tsx:70 → FinancePeriodResultSection` is unchanged (one-directional page→component). **VERIFIED.**
- (c) `check-type-cycles.mjs` PASS (1 SCC = the STR-307 storage baseline pair — unchanged); `check-runtime-cycles.mjs` PASS (0 runtime cycles across 421 production files, +2 = the two new modules). **VERIFIED.**
- (d) The STR-204c row retirement in OWNERSHIP-AND-TRUTH-REGISTRY §5 is recorded for R7-6 records closure (per amendment 9). **SCHEDULED.**

## 4. Behavior-equivalence evidence

- The assembly is a restructure (useEffect body → injected-deps async function), with the exact same read set, read-start order (pinned by unit test), failure-isolation mapping, error message, and state shape. The `active`-flag cleanup semantics are preserved at the setState boundary; reads are pure/idempotent local reads.
- **15/15 direct Finance test files green (73 tests)** — FinanceJourneys (journey), G005FinanceReadIsolation, Bridge/Budgets/EmptyTruth/Obligations/SafeWithdrawal/ShortCashHorizon, D005, U001, U05, U07, group1Surfaces, group2InventorySurfaces, EventsLayer.familyGuard.
- group1Surfaces + EventsLayer.familyGuard + FinanceJourneys + D005 re-run green after the P10 split (13 tests).
- Full suites: **root 730/730; app 324 files / 2,399 tests (+1 file, +11 tests = financeState unit suite)**.
- No CSS/DOM/token/copy/navigation line was touched in any page/component (diff-verified: the only component changes are import lines, the verbatim row move, and module boundaries).

## 5. Bundle evidence (ADR-012 discipline)

- Entry: raw **629,300** (identical to the R5/R6 record), gzip **154,690** (+7 bytes = the door's type-only re-export line). Ceilings 650,000/155,300 hold.
- Lazy: 101 chunks, 1,410,072 raw / 433,029 gzip — below the check-bundle-surfaces baseline (1,425,371/438,553). Precache: 187 entries / 2,741,656 bytes — below baseline. `check-bundle-budget.mjs` + `check-bundle-surfaces.mjs` both PASS.

## 6. Guard chain (all exit 0)

`check-secrets` (1,561 files/0), `check-test-focus` (387/0), entity-touchpoints, module-boundaries (48 UI→application deep keys = 42+R7's 1 documented… 43 total pinned), type-cycles (baseline 1), registry-coverage, acceptance-value-anchors, file-size-ratchet (488 measured / 409 baseline), vendored-braces, date-arithmetic-ownership, application-door-surfaces (29 doors), application-readwrite, runtime-cycles (0), lint (0 errors / 35 warnings ≤ 37), format:check clean, text-density PASS, design-guards PASS, test-map no drift.

## 7. Impact statements

- **Financial/semantic:** none — no rule moved anywhere; the module orchestrates the same canonical readers (spy `periodResultCanonical` untouched and green).
- **Schema/Export/Import:** none — 38/30 untouched; no storage/domain/transfer file changed.
- **Historical/rejection:** none.
- **Visual UI:** none — no CSS/DOM/copy/navigation change; DOM output pinned by the journey text assertions listed in §4.
- **Security:** none; NO_SECRETS_EXPOSED.

## 8. Rollback boundary

Revert the R7-1 commits only: Finance.tsx/FinancePeriodResultSection/EventsLayer return to their pre-slice units, financeState.ts(+test)/FinancialEventRow.tsx are deleted, the three baselines + register rows revert with the slice. No data effect.

## 9. Status

R7-1_COMPLETE (P02 + P10) — P11 was **not** pulled into this slice: the Statement seam is a separate page boundary (R7-4), not the same safe boundary as the Finance cycle fix. Remaining: R7-2 (P01/P03/P07), R7-3 (P04/P08/P09), R7-4 (P05/P06/P11), R7-5 (shims), R7-6 (closure).
