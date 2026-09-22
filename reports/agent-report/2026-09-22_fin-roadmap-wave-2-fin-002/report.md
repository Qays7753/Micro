# Financial Roadmap — Wave 2 Delivery Report (FIN-002, WS-174)

**Branch:** `feat/fin-002-budgets-goals-20260922` (base: verified main `e7c7b1c20890e64f98ad420ac008ef6578601c0f` — Wave 1 closed)
**Scope:** optional expense budgets — plan-not-event. **Schema/export 36/28 → 37/29** (guarded, D-037 pattern); new `expense-budgets` store; no FinancialEvent ever written by budgets.

## What was built

1. **Contract 42** (`docs/contracts/42-optional-expense-budgets-goals-contract.md`, 109 lines): owner-approved §4.3 policy in repo-contract form (four separated concepts; month-only YYYY-MM Amman calendar with explicit periodKind extensible to week/custom; scope = general or ONE explicit categoryLabel — overlap = double counting = rejected; idempotency per operation type; derived states within/exceeded/under_review; dismissible goals; storage 37/29; mandated UI vocabulary; 10-scenario acceptance). Undecided details recorded as explicit deferred owner decisions (category spent rule — documented in the service header; UI entry; standalone goal entity).
2. **Pure domain** (`src/domain/budget/`): frozen ExpenseBudgetRecord (active/superseded/closed, supersededById, goalDismissed), create (validation + non-overlap), revise → atomic {successor, supersededPrevious} pair (history verbatim), close (mandatory reason, idempotent replay), dismissGoal/restoreGoal, evaluateBudgetStatus (integer minors, spent|null → under_review honest), findOverlappingBudgets, isValidBudgetPeriodKey. Zero financial-event imports (barrel-surface lock test).
3. **Storage** (`expense-budgets` store): guarded creation; listExpenseBudgets / saveExpenseBudget(record, expected?) — CAS for documented in-place transitions, byte-identity reuse, loud storage_stale otherwise / saveExpenseBudgetRevisionPair (successor+superseded in ONE IndexedDB transaction via expenseBudgetCommitGuard); migration v36→v37 seeds empty budgets only; export family + counters + validation (ids/operationKeys/periodKey/superseded-links — rejected BEFORE any replaceSnapshot); released-legacy pair 28/36; touchpoints registered; docs-binding tests updated to 37/29.
4. **Service** (`application/finance/expenseBudgetService.ts`, 374 lines): budget-record writes only; idempotent operation keys; readBudgetStatuses — spent per the documented aggregation rule (general scope mirrors the canonical reader's operating-expense inclusion exactly — same source, predicate, month-bounds, net of reversals; category scope = explicit label equality; empty month → spent unknown, never zero).
5. **UI** (Finance «ميزانيات اختيارية» collapsed section, dynamically-loaded service per EXE-014/D-034 — NOT in the services context, entry bundle protected): honest overrun display («تجاوزت خطتك هذا الشهر بمبلغ…» — never blocks), add/revise/close forms, dismissible goal, no-budgets world = one optional entry. Section in components/finance/ExpenseBudgetsSectionBody.tsx (details-rooted wrapper).

## Tests (36 new: 20 domain + 11 storage/transfer + 5 DOM)

- Domain: creation/validation/overlap both directions; revise pair preserves history verbatim; close mandatory-reason + idempotent replay; goal flip; evaluate integer math + null honesty; barrel lock; frozen inputs.
- Storage/transfer: adapter conformance (Memory/IndexedDB parity); atomic pair + retry reuse; migration from a real legacy v36 DB; released pair 28/36; round-trip deep-equal; 8 malformed-array rejections with data untouched; version-binding 37/29.
- DOM (core acceptance): **full financial-world deep-equality (5 families) before/after create + revise + close + dismiss + overrun — plans never move money**; overrun display; overlap error inline; no-budgets optional-only; read retry idiom; w173 bridge regression re-scoped.

## Gates

- Full `pnpm check` **EXIT 0**: root 38 files / 454 (+20); prototype 257 files / 1836 (+16); lint ≤37; prettier; density all caps OK (Finance 318/318 documented raise); design-guards/guards; build+PWA; bundle **647,937/650,000 raw + 153,769/155,000 gzip — PASS** (dynamic load held entry growth to ~2.8KB — storage-layer methods only; the service itself excluded).
- Independent review: **PASS_WITH_NOTES** — 10/10 acceptance; CAS / spent-rule / lazy-race risk points verified sound; findings: LOW unused type aliases in Finance.tsx (cleanup candidate, toolchain-green), NIT D-038→D-037 typo (fixed), INFO per-click operation keys (intent semantics, acceptable).

## Owner-review items (vetoable)

1. Density cap Finance **300→318** documented (mandated contract-42 vocabulary inside the collapsed details subtree; lexical counter limitation across function boundaries).
2. Schema/export **36/28 → 37/29** (guarded-entity rules for a new persistent store; D-037 precedent; recorded for owner review).
3. Category spent-aggregation rule (service header; includes the declared consequence that uncategorized reversals don't deduct from category budgets).

## Coordinator verification notes

Recovered and fixed during verification: lazy-load effect race (terminal loading state — active-guard discarded the import result); CAS gap (in-place transitions rejected as stale — now `expected` parameter); scope narrowing for the category filter; jsdom details-toggle test idiom; duplicate month-range regression in the w173 bridge test. Two sub-agent deadline recoveries (storage + UI layers) verified and completed by the coordinator.

## Rollback boundary

`e7c7b1c20890e64f98ad420ac008ef6578601c0f`. Revert = single revert of the wave squash merge (self-contained). A rollback also lowers the schema/export pair back to 36/28 (v37 files import with empty budgets — forward-compatible if re-landed).
