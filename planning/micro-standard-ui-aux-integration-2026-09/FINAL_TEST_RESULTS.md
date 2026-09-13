# FINAL TEST RESULTS — micro-standard-ui-aux-integration-20260914

Run date: 2026-09-14 (Asia/Amman). All results below are from the actual execution of the repository's own gates on this branch (`pnpm check`, the full pipeline), plus the run's own tests.

## Full pipeline (`pnpm check`) — PASS end-to-end

| Gate | Result |
|---|---|
| `typecheck` (tsc --noEmit, root + prototype) | PASS |
| `lint` (eslint, --max-warnings 37) | PASS — 0 errors, 36 warnings (all pre-existing complexity warnings; none from run files) |
| `format:check` (prettier) | PASS |
| `text-density` (§10.1 caps, 52 pages) | PASS — all surfaces within caps |
| `design-guards` (design-token-guards.py + stylelint) | PASS — "no raw hex, all values on scale"; **zero sanctioned raw-color exceptions remain** (the §3.3 scrim exception was removed in W1) |
| `guards` — check-secrets | PASS — 816 files scanned, 0 secret patterns |
| `guards` — check-test-focus | PASS — 204 test files, 0 `.only`/`.skip` |
| `guards` — check-entity-touchpoints | PASS |
| `guards` — check-runtime-cycles | PASS — no import cycles |
| Root test suite (vitest) | **35 files / 391 tests — all passed** |
| Prototype test suite (vitest + jsdom) | **169 files / 1,224 tests — all passed** |
| Production build (vite) | PASS |
| Bundle budget (D-034) | PASS — entry 633,132 raw (limit 650,000) · 150,595 gzip (limit 155,000) |

## Test evolution across the run (net +67 tests, +4 files)

| Point | Root | Client |
|---|---|---|
| Baseline (W0) | 35 / 391 | 166 / 1,166 |
| W1 (+token & adapter tests) | 35 / 391 | 168 / 1,193 |
| W2 (+primitives & chip tests) | 35 / 391 | 169 / 1,224 |
| Final (W6) | 35 / 391 | 169 / 1,224 |

No existing test was modified or deleted at any wave. All pre-existing suites (journeys, navigation contract, lock gates, QuickActionSheet 15, unsaved-changes, exact-values, docs-state) pass unchanged.

## Visual / runtime verification (production build, real Chromium)

| Check | Home | Finance |
|---|---|---|
| Horizontal overflow @320px | 0px | 0px |
| Horizontal overflow @390px | 0px | 0px |
| Console/page errors | 0 | 0 |
| Clay identity present (FAB region, #D97757) | yes | yes |
| Four distinct screens captured | yes (`visual-review/`) | yes |

First-run setup was completed by the driver (a real user journey) before capturing.

## What was NOT tested (honest limits)

- **Physical-device testing: not performed** (no device available). Not claimed.
- **Screen-reader testing: not performed.** Not claimed. (Aria/role contracts are asserted in DOM tests only.)
- **Real keyboard/notch/safe-area hardware: not exercised** (software-keyboard hiding is driven by the visualViewport heuristic; asserted via existing chrome tests).
- **Dark-mode visual parity: not re-verified visually** (dark layer intentionally preserved as legacy; documented in DARK_MODE_BOUNDARY.md).
- **130/200% text-scale on device: not screenshot-verified**; the 100%-level no-overflow checks and guard ladders passed. 200% zoom overflow was not separately captured.
