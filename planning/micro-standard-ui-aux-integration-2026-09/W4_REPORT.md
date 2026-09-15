# WAVE 4 REPORT — Pilot Screens (Home, then Finance)

**Commit:** 8598cba (+ visual-review captures in this docs commit) · **Scope:** two pilots with explicit screen contracts; local duplication removed only where the shared replacement passed tests; financial meaning unchanged.

## What was done

1. **Screen contracts written before edits** (`SCREEN_COMPOSITION_MAP.md`): goal, primary action, hierarchy, scroll ownership, states, error/loading/empty cases, keyboard behavior, exit paths, and the exact primitives/patterns each pilot consumes — for both pilots.
2. **Home pilot (first):**
   - Error-retry button → `Button action="save"` (ordinary action; was filled-primary).
   - Finance-unit and catalog-unit section-navigation buttons → `Button action="save"` (navigation is not creation — correct action-ladder classification).
   - `MoneyValue` compositions and the honest-void fact triad preserved (Micro-owned pattern — richer than the Standard's void presentation; U-20).
3. **Finance pilot (high-sensitivity):**
   - Unallocated-cash note adopts `MoneyWithUnit` (unit beside the bidi-isolated number — the value-zone contract).
   - All layer structure, decision grammar, correction trails, and copy untouched.
4. **Visual review artifact** (owner-facing, W4 gate): real Chromium captures of the production build at 320px and 390px for both pilots, after completing first-run setup programmatically. Verified per capture: zero horizontal overflow, zero console/page errors, four distinct screens, Clay identity present in the FAB. Files under `visual-review/` with `capture-log.json`. Labeled review evidence — not product truth.

## Gate check

| Criterion | Status |
|---|---|
| Pilots visually and behaviorally reviewed | ✅ captures + programmatic checks; journey/DOM suites assert unchanged copy and flows |
| Financial meaning unchanged | ✅ no service call, formula, or copy change; suites green |
| Usable at 320–430px | ✅ measured 0px horizontal overflow at 320/390; guard ladders enforce geometry |
| Owner-facing visual review artifact | ✅ `visual-review/` (4 captures + log) |

## Honest record

- The Home `MoneyWithUnit` adoption was reverted after the text-density gate flagged the unit string as a new distinct at-rest literal on that screen (it was previously uncounted JSX text there — the same pre-existing counter desync registered in W2). The composition contract is demonstrated on Finance; Home keeps its literal composition with a documenting comment. No cap was raised.
- The capture driver completes the app's real first-run setup (3 steps + foundation exit) with the project name «مشروع المراجعة» — a real user journey, not a mocked state.

**W4 gate: PASS.**
