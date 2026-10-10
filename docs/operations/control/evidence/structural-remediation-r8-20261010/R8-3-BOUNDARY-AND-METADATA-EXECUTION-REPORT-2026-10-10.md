# R8-3 — Module-Boundary Regression Class and Guard Metadata (Execution Report)

**Program:** WS-216 / ARCH-007 — Structural Remediation R8, slice R8-3
**Date:** 2026-10-10 · **Executor:** Z AI · **Findings closed:** R8-F-019, R8-F-021
**Commit:** this slice's commit on `refactoring/r8-bundle-file-growth-guards-20261010`

---

## 1. The component→page regression rule (R8-F-019)

`scripts/check-module-boundaries.mjs` gains rule **R7**: any import from a module under `client/src/components/**` resolving to a module under `client/src/pages/**` is rejected. Design decisions, each tied to the R8-0 card §5.4:

- **Canonical owner:** the boundary guard (not a companion guard, not a cycle guard) — it already owns directional layer rules R1–R6 with the same AST/resolution infrastructure (`collectAllImports`: static value, static type, dynamic `import()`, `ImportTypeNode`, re-export forms; `resolveSpecifier` for aliases and relative paths). No overlapping guard, no second source of truth.
- **All import kinds fail:** value, type, dynamic, import-type position, and re-export — the exact former Finance-cycle form (`import type { FinanceState } from "@/pages/Finance"`, STR-204c/R6-SCAN-F-019) is a named negative test.
- **The legal direction stays free:** page→component imports pass (proven by a positive test on a synthetic tree and by the live tree — pages import their sections).
- **Exceptions are explicit and bounded:** `COMPONENT_TO_PAGE_BASELINE = []` at establishment — an owner-reviewed list, not an unbounded drift baseline. Any future entry requires an ownership-registry row and a decision reference.
- **Live verification:** the guard reports **0 component→page edges** on the live tree (the R7 outcome is now continuously guarded), and the full boundary guard passes with all six prior baselines intact (3/15/0/3/2/57).

Tests added (8; suite total 25/25 passed): component→page value / type (the former Finance pattern) / dynamic / relative-after-resolution / re-export / import-type-position each rejected; page→component passes; unrelated legal UI imports unaffected; the baseline is an explicit empty owner-reviewed list; the live repository has zero violations.

## 2. Guard metadata reconciliation (R8-F-021)

`REFACTORING-PLAN-A-TO-Z.md §4.3.1` — the canonical table, corrected in place with dated notes (no second metadata table created):

- **Title:** "17 permanent guards" → "19 documented guards" with the dated R8/F-021 correction note explaining the previously silent omission of build-only guards.
- **Two rows added** (previously omitted because they are not in `pnpm guards` — the exact prohibited omission): `check-bundle-budget` (entry ceilings 650,000/155,300, manifest entry selection, in-build closeBundle + build-chain execution surfaces, D-034/ADR-017 change classification) and `check-bundle-surfaces` (post-entry surfaces, manifest classification, per-environment anchoring with provenance, tolerance caps enforced by the guard itself).
- **Two rows updated with dated notes:** `check-file-size-ratchet` (v2 within-band semantics, ledger authorization, merge-base drift audit) and `check-module-boundaries` (R1..R7 coverage).
- Every row now states: what it proves / what it does not prove / source of truth / execution surface / baseline policy / owner-review trigger / change classification.

Cross-references checked: `TEST-AND-DOCUMENTATION-MAP.md` already counts the two bundle-guard test files in the app-suite census (§1: "two additional files in `apps/prototype-web/scripts`"); the file count is unchanged by R8 (both suites replaced in place), and the map's drift pin reports `no drift`. `REFACTORING-CONTROL.md`, `OWNERSHIP-AND-TRUTH-REGISTRY.md`, and `current-state.md` contain no stale guard-count statements (verified by search; the remaining "17th guard" mentions are historical worklog entries, correct as history).

## 3. Dogfooding the R8-2 mechanism

The boundary guard's growth (398 → 431 nbLOC, crossing the WATCH threshold that register §7 had documented as "two lines away") is the **first real re-anchor ledger entry** (`R8-3-RULE-R7` in `scripts/file-size-ratchet-reanchors.json`): chained from/to values, reason, and owner-review reference. The v2 ratchet caught the growth before the ledger entry existed and passes with it — the authorization path works end-to-end inside the same PR that introduces it.

## 4. Verification record

| Command | Result | Environment |
|---|---|---|
| `npx vitest run scripts/check-module-boundaries.test.mjs` | 25/25 passed (17 prior + 8 new) | local |
| `node scripts/check-module-boundaries.mjs` | PASS — 389 files; 0 component→page edges; all baselines intact | local |
| `node scripts/check-runtime-cycles.mjs` / `node scripts/check-type-cycles.mjs` | PASS (0 runtime cycles; 1 documented type SCC) | local |
| `node scripts/check-file-size-ratchet.mjs` | PASS with the R8-3-RULE-R7 re-anchor reported | local |
| `node scripts/generate-test-map.mjs --check` | no drift | local |

## 5. Exit-criteria status

- [x] The former Finance cycle has a durable regression guard with direct negative tests (all import forms) and a positive test for the legal direction.
- [x] No current violation exists (live tree: 0).
- [x] Guard metadata is canonical, complete, and consistent with actual commands and execution surfaces (19 documented; build-only execution surfaces explicit).
- [x] No duplicate source of truth or contradictory baseline (one boundary-rules owner; one metadata table; exceptions explicit).
- [x] R8-F-019 and R8-F-021 closed with evidence.

**Status after R8-3:**

```text
R8_3_COMPLETE — BOUNDARY_REGRESSION_CLASS_AND_METADATA_VERIFIED
NO_GUARD_WEAKENED
NO_UNAPPROVED_FINANCIAL_OR_SEMANTIC_CHANGE
NO_UNAPPROVED_SCHEMA_OR_EXPORT_IMPORT_CHANGE
NO_UNAPPROVED_VISUAL_UI_CHANGE
```
