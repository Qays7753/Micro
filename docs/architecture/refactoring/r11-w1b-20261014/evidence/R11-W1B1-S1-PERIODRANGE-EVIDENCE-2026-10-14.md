# R11 W1b-1 — S-1 `PeriodRange` Exact-Name Gate and Type-Only Rename — Evidence

**Artifact ID:** R11-W1B1-S1-PERIODRANGE-EVIDENCE-2026-10-14 | **Slice:** W1b-1 | **Date:** 2026-10-14 (UTC) | **Executor:** ZAI (single W1b writer)
**Decision authority:** S-1 (`OWNER_APPROVED — RENAME_PAGE_LOCAL_MEANING`, exact-name validation gate) in the R11 owner decision package §4; executed under the canonical W1b execution prompt slice W1b-1.
**Base SHA:** `0ede6e941a7ec276baf1594febb34e2d4ebf14ee` (branch base; live `main` at slice start)

---

## 0. Status

```text
W1B1_S1_PERIODRANGE — VERIFIED
COLLISION_RESOLVED — zero ambiguous declarations under the old name
EMITTED_JS — byte-identical (entry assets/index-CPVmJmgX.js 631,903 / 155,290)
```

## 1. Caller census (performed before any write — the exact-name gate)

Exact-token census (`git grep -w PeriodRange` over `src/**`, `apps/**`, `tests/**`), 11 production occurrences, 0 test occurrences, 0 import statements of either symbol anywhere:

| Dimension | Finance/date-owned symbol | Page-local symbol |
|---|---|---|
| Declaration | `apps/prototype-web/client/src/application/finance/periodPresets.ts:33` — `export type PeriodRange = { from: string; to: string }` (inclusive local-date bounds `YYYY-MM-DD`, from ≤ to; documented in the module's Arabic doc comment) | `apps/prototype-web/client/src/pages/FinanceActivity.tsx:43` — `type PeriodRange = "this_week" \| "last_week" \| "this_month" \| "all" \| "custom"` (quick-period selection key) |
| Shape | object type (date pair) | string union (5 UI selection keys) |
| Exported / imported | exported; **imported by no file** (module-internal uses only); **not re-exported by the house door** (`application/finance/index.ts` exports only `isPeriodActive`, `previousEqualPeriod`, `resolvePeriodPreset`) | not exported (file-local) |
| Uses | 7 in-module references: `periodPresets.ts:40` (`PeriodPresetResolution` ok-branch), `:88` `monthRange`, `:97` `previousMonth`, `:106` `quarterRange`, `:115` `previousQuarter` (return types), `:178` `previousEqualPeriod` (param + return), `:185` `isPeriodActive` (param) | 3 in-file references: `FinanceActivity.tsx:141` `useState<…>("this_week")`, `:148` `applyQuick(value: …)`, `:252` `readonly […, string][]` quick-options tuple |
| Tests | `periodPresets.test.ts` exercises the module's functions; the type name itself is never referenced | none |
| Nearby-but-distinct symbols | `PeriodPresetId` (periodPresets.ts:29) — a third, finance preset-id union (`"last_month"`/`"last_quarter"`, no `"all"`); `fixedPeriodRangeGuard` (`src/domain/owner-entitlement/policies.ts:810/815`) — a function name containing the token as substring, not the symbol (no word-boundary match) | — |

**Separability proof:** the two meanings are fully separable — different files, different shapes (date-pair object vs selection-key string union), zero shared references, zero imports, zero re-exports through the house door, and the page-local union is not even equal to the finance `PeriodPresetId` family (it has `"all"`, lacks `"last_month"`/`"last_quarter"`). No wire-format, runtime, financial, or UI-copy semantics are attached to either type name (both are compile-time only).

## 2. Name validation (the exact-name gate)

The owner-approved preliminary name **`FinanceActivityPeriodKey`** is **confirmed by the census**: the page-local symbol is exactly the period-selection key of the FinanceActivity page — it keys the quick-period buttons (`aria-pressed={range === value}`, `[value, label]` tuples) and the page's range state. The name names the file-local meaning precisely, contains no financial/date-range semantics, and cannot be confused with the finance `PeriodRange`. No evidence surfaced that the meaning is "radically different" — the hypothesis stands.

## 3. The type-only rename (executed)

`apps/prototype-web/client/src/pages/FinanceActivity.tsx` — 4 lines changed, 0 lines added/removed (`git diff --stat`: 4 insertions / 4 deletions):

| Line | Before | After |
|---|---|---|
| 43 | `type PeriodRange = "this_week" \| …` | `export type FinanceActivityPeriodKey = "this_week" \| …` |
| 141 | `useState<PeriodRange>("this_week")` | `useState<FinanceActivityPeriodKey>("this_week")` |
| 148 | `applyQuick = (value: PeriodRange)` | `applyQuick = (value: FinanceActivityPeriodKey)` |
| 252 | `readonly [PeriodRange, string][]` | `readonly [FinanceActivityPeriodKey, string][]` |

`periodPresets.ts` is **unchanged** — the name `PeriodRange` stays on the finance/date-owned semantic, per the owner decision. No other symbol, comment, or file was touched. The `export` keyword added on line 43 is type-only (fully erased at emit; the page module's runtime exports are unchanged).

**Post-rename exact-token census:** `PeriodRange` now occurs only inside `periodPresets.ts` (8 sites, all the finance symbol) — **zero ambiguous declarations**. `FinanceActivityPeriodKey` occurs only in `FinanceActivity.tsx` (4 sites).

## 4. Type-level collision/assignability test (new)

`apps/prototype-web/client/src/pages/FinanceActivity.periodKey.test.ts` (4 tests, all green):

1. **Exact-membership pin (compile-pinned both directions):** `const keyOf: Record<FinanceActivityPeriodKey, true> = { …five keys… }` — a missing key or an excess key fails compilation; plus `as const satisfies readonly FinanceActivityPeriodKey[]` on the key tuple.
2. **Mutual non-assignability:** `// @ts-expect-error` on `const asRange: PeriodRange = quickKeys[0]` (a page key is not a finance date-range) and on `const asKey: FinanceActivityPeriodKey = { from, to }` (a finance date-range is not a page key) — the collision is resolved, not relocated. Unused-directive protection: `tsc` fails on an unused `@ts-expect-error` (TS2578), so these two lines are guaranteed to keep suppressing genuine errors.
3. **Positive control:** `PeriodRange` remains the `{ from, to }` date pair and compiles without suppression.
4. **Family distinctness (runtime):** the page keys include `"all"` and exclude `"last_quarter"`; `PERIOD_PRESET_IDS` is the inverse — the page-local family is not the finance preset family.

## 5. Verification matrix (all at the working tree of this slice)

| Check | Command | Result |
|---|---|---|
| Focused type-level test | `pnpm --filter @micro/prototype-web exec vitest run client/src/pages/FinanceActivity.periodKey.test.ts` | **4/4 PASS** |
| Typecheck (root) | `pnpm typecheck` | PASS |
| Typecheck (app, tests included — NF-020 part 2) | `tsc --noEmit -p apps/prototype-web/tsconfig.json` + `check-test-typecheck-coverage` (355 files) | PASS |
| Lint (changed files) | `eslint … --max-warnings 37` | PASS (exit 0) |
| Prettier | `prettier --check` on both files | PASS (after one `--write` on the new test file) |
| File-size ratchet | `node scripts/check-file-size-ratchet.mjs` | PASS — FinanceActivity.tsx nbLoc **unchanged at 311** (rename adds no lines; no ledger entry needed) |
| Module boundaries | `node scripts/check-module-boundaries.mjs` | PASS — 19 type edges / 128 house edges (80v/48t) exact, no new edges (test files are outside the production census) |
| Emitted-JS identity | `pnpm prototype:build` | **entry `assets/index-CPVmJmgX.js` raw 631,903 / gzip 155,290 — byte-identical to the recorded S0/W1A baseline entry**; budget PASS under 650,000/155,300; surfaces PASS (102/2/70/157/2 exact) |
| Whitespace | `git diff --check` | PASS |

## 6. No-change proofs

- **Wire format:** no storage/transfer/persistence file touched; schema 38 / export 30 untouched (no storage file in the diff).
- **Runtime:** types are erased; the emitted entry hash is identical — no runtime change of any kind.
- **Financial semantics:** no domain file touched.
- **UI copy:** the visible labels (`"الأسبوع الماضي"`, `"منذ البداية"`, …) are untouched; only the compile-time type name changed.
- **Goldens/Legacy/rejection precedence:** no transfer/golden file in the diff.

## 7. Rollback boundary

Revert this slice's single commit to restore the pre-rename page (the old local name and its 3 usages return; the test file is deleted with the same revert). The revert does not affect any other slice: nothing else references `FinanceActivityPeriodKey`, and `periodPresets.ts` was never touched.

## 8. STOP-gate review

The census did not show the preliminary name to be wrong, the meanings are separable (§1), and no runtime/wire semantic changes (§5–§6) — the STOP conditions of slice W1b-1 did not trigger.
