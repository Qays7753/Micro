# R9-W3 — Direct Page Coverage Execution Report (2026-10-10)

**Program:** WS-216 / ARCH-007 — Structural Remediation R0–R10, wave R9 (W3).
**Executor:** Z AI (primary, single writer). **Branch:**
`refactoring/r9-complete-w1-w2-w3-20261010`; W3 builds on the Gate-C-approved W2
head `3b4875cb48c3f5ae5841865b8cd0eac535ae5e31`.
**Mission:** direct behavioral tests for the five named-reference pages, with **no
visual UI change** — tests only; every discovered page defect recorded, none
enshrined.

---

## 1. Page-by-page direct coverage table

| Page | Test file (new) | Tests | Boundary proven |
|---|---|---|---|
| `pages/CashWalletEditor.tsx` | `pages/CashWalletEditor.dom.test.tsx` | 3 | (1) the full write journey through the real page over `CashContinuityService`/`MemoryLocalStore` with the declared opening balance **value** verified by a second service instance (75 → 7,500 minor — closes the preflight Reviewer-3 depth note) plus the `?returnTo` exit contract and the change notification; (2) the validation gate blocks the save with the honest message, zero store writes, no navigation, no notification; (3) the selected wallet `kind` flows into the persisted record |
| `pages/CashReversalEditor.tsx` | `pages/CashReversalEditor.dom.test.tsx` | 4 | (1) unknown id → the honest no-impact boundary (no navigation/write; the unreachable not-found surface is the recorded defect R9-W3-F1, not enshrined); (2) the reason-required gate with zero reversals written; (3) the reversal journey through the page: `reversesEntryId` link + persisted reason + navigation + notification; (4) the already-reversed case: the service's exact honest message displayed, no second reversal, no navigation |
| `pages/G5DeclarationEditor.tsx` | `pages/G5DeclarationEditor.dom.test.tsx` | 4 | (1) the collection declaration journey: amount conversion (40 → 4,000 minor), persisted source/direction verified through a second service instance; (2) the empty-amount gate with zero writes; (3) the note-required gate **auto-opens the details layer** (`details.open === true`) with the honest message; (4) the direction switch to `commitment` produces a persisted commitment declaration |
| `pages/InventoryReversalEditor.tsx` | `pages/InventoryReversalEditor.dom.test.tsx` | 4 | (1) unknown movement id → the honest no-impact boundary (R9-W3-F1 not enshrined); (2) the reason gate with zero writes; (3) the reversal journey: `reversesMovementId` link + `type: "reversal"` + persisted reason + notification (navigation asserted as *occurred*, destination NOT asserted — the hardcoded `/inventory` exit is the recorded defect R9-GA-F3.3); (4) the already-reversed case: single reversal enforced through the service boundary |
| `pages/ReceivedLoanDetail.tsx` | `pages/ReceivedLoanDetail.dom.test.tsx` | 4 | (1) the live derived reading for a created loan (outstanding = principal, status overline) with the dynamic service load (EXE-014 pattern over `getPrototypeLocalStore`); (2) the honest error surface with a retry action for an unknown loan id; (3) the documented **correction** journey (reverse-and-replace): new lender name live in the heading, `notifyDataChanged`, and the history preserved (≥3 events: original + reversal + replacement) verified through a second service read; (4) the inline **repayment reversal** journey: outstanding restored (5,000 → 8,000), "معكوسة موثقة" surfaced, the reversal reason persisted on the repayment record |

Total: **5 new test files, 19 tests, all green.** Each file follows the established
`.dom.test.tsx` conventions (jsdom docblock; `MemoryLocalStore` + the context mock
supplying **real** services; hoisted wouter mocks with a **configurable `search`**
— the Gate-B correction enabling the first real `?returnTo` assertions;
`UnsavedChangesProvider` harness; per-test cleanup).

## 2. SharePreview — surface-only rationale (explicit, per the mission)

`pages/SharePreview.tsx` is a **presentation/share surface**: it reads the share
draft from `window.history.state`, renders an editable body, and performs copy/share
through the `textDelivery` channel (`canShareText` gating; copy outcome surfaced;
honest empty state without a draft). It performs **no service calls, no store
reads/writes, and owns no stateful journey** beyond the draft lifecycle already
exercised by the existing W7 journey (body, copy outcome, empty state — the copy
lane end-to-end; the share lane is unit-covered at `textDelivery`). Adding a
page-test file would re-render the same presentation with no new boundary to prove;
the surface-only classification in the map therefore stands, with this rationale
recorded as its evidence. No map classification change was needed for SharePreview.

## 3. What the tests deliberately do NOT assert (no-enshrinement record)

- The **unreachable not-found surface** in both reversal editors (R9-W3-F1, found by
  direct execution during this wave — DEEPENS R9-GA-F3.1/.2; PROTECTED_DECISION_REQUIRED):
  the tests assert the honest no-impact boundary instead.
- The **swallowed storage failure** rendering (R9-GA-F3.1/.2) — not asserted.
- The **hardcoded `/inventory` save-exit** (R9-GA-F3.3) — navigation occurrence
  asserted, destination not.
- The **G5 idempotency key omitting `knowledge`** (R9-GA-F3.4) — the tests vary
  amount/source/note/direction only.
- Error-paragraph `role` differences (R9-GA-F3.5) — message text asserted, not roles.

## 4. Map and generator reconciliation

`node scripts/generate-test-map.mjs` regenerated (the five pages' evidence lists now
include their per-page direct files; classification stays `direct` — the evidence
deepened, the class did not change); `--check` = no drift; the drift-pin test
`scripts/generate-test-map.test.mjs` green. The map doc's §2 note about the five
pages carrying W7-journey evidence remains historically true; the generated JSON is
the live evidence source (the doc's own rule).

## 5. Verification record (commands and exit codes)

| Command | Result |
|---|---|
| `pnpm --filter @micro/prototype-web exec vitest run client/src/pages/CashWalletEditor.dom.test.tsx client/src/pages/CashReversalEditor.dom.test.tsx client/src/pages/G5DeclarationEditor.dom.test.tsx client/src/pages/InventoryReversalEditor.dom.test.tsx client/src/pages/ReceivedLoanDetail.dom.test.tsx` | **19/19 passed** |
| `pnpm --filter @micro/prototype-web exec vitest run client/src/SmokeOnlyPagesJourneys.dom.test.tsx client/src/pages` | full pages suite green (incl. the W7 journeys + the nine pre-existing page-adjacent files + the five new files) |
| `pnpm --filter @micro/prototype-web check` (tsc) | exit 0 |
| `pnpm --filter @micro/prototype-web test` | full app suite green (recorded in the final full check) |
| `node scripts/generate-test-map.mjs` + `--check` + drift-pin test | wrote / no drift / 3/3 |
| `node scripts/check-test-focus.mjs` | 0 `.only/.skip` |
| text-density | page basenames only; `.test.` names excluded — the new files cannot affect it |
| Full `pnpm check` on the final W3 tree | exit 0 (the canonical aggregate — recorded in the final report) |

## 6. Files changed

Added: the five `pages/*.dom.test.tsx` files above. Regenerated:
`docs/architecture/refactoring/generated/test-map.json`. Docs/evidence: this report,
the repair-cards additions (R9-W3-F1), the Operations Control records, state-log
§168 + worklog Entry 82 (in the same commit), current-state live fields.
**Explicitly not changed:** every page/component/presentation source file; CSS;
DOM; copy; navigation design; product behavior; CI; guards; baselines.

## 7. Acceptance gate (W3)

- [x] all five target pages have meaningful direct tests (real page + real service
      + read/write effect + honest-error and gate paths; no shallow render-counts)
- [x] SharePreview's surface-only status explicitly explained (§2)
- [x] focused tests pass (19/19; pages suite green)
- [x] map generation + drift check pass
- [x] application typecheck passes
- [x] root tests and guards pass (full `pnpm check` exit 0 on the W3 tree)
- [x] production build + bundle guards pass (unchanged surfaces — tests only)
- [x] no visual UI / product behavior changed (diff proves tests+docs only)
- [x] this report records exact files, tests, exits, and limitations

## 8. Rollback boundary

Revert the W3 commit — five test files + regenerated map + docs. No production,
guard, or data impact; the map regenerates from the tree.

## 9. Status

`R9-W3 COMPLETE — GATE D NEXT (five reviewers, then the final report + PR)`
