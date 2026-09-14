# MICRO LIGHT + DARK EXECUTION REPORT — Remediation Closure (ZAI 5.3 resume)

**Run:** 2026-09-15 · **Branch:** `micro-standard-ui-aux-integration-20260914` · **Type:** resume of an interrupted execution, re-executed from the highest verified remote commit
**Restore point (global):** `ece7be3630739d551b9ba7caf37d30a9a63c872f` — mechanically rehearsed (see ROLLBACK_MANIFEST.json)

## 1. Resume disposition (what was recovered vs re-executed)

The interrupted run's local workspace was **unavailable** — its reported commits (W0 `3e5f58a`, W1 `e617781`, W3 `fcabad0`, W4 `4e83a0e`) exist in no local clone and never reached the remote (verified via `git cat-file` across every local repo + live `ls-remote`; remote branch was still at `ece7be3`). Per the resume instruction, execution resumed from `ece7be3` only, and the entire remediation-closure scope was **re-executed and re-verified** — nothing from the lost run was assumed, reused, or claimed. Full details: `RESUME_STATE_REPORT.md`.

## 2. Commits produced by this resume run

| Commit | Wave | Content |
|---|---|---|
| `4d631d954dbfa04e2842f103b5390d0ec557b96a` | R0 | Resume-state report; baseline verified green on `ece7be3` |
| `d44f91340c949965e3403168363f92f4cd904cd9` | R1 | Explicit typed feedback channels (D6) + OrderDetail error/not-found separation; density-guard channel registration; cap 171→174 documented |
| `9b4f02ce7d777a010c462d66587bf0f414fba8ad` | R2 | FinanceActivity no-data/no-results (D8); aria-pressed explicit presentation (D7); eslint primitive-leaf guard; SURFACE_TONE_SYNTAX.md (D4); render-smoke (55 routes × 2 themes, real services); keyboard/focus contract tests |
| `0f01842` + `218bd2c` (full SHAs in CHANGED_FILES_MANIFEST.json) | R3+R4/W5 | Permanent Dark Mode implementation: theme-dark.css single owner, color-scheme, light default + persisted dark, contrast guard (D5), retired-value bans, ADR-009 |
| `218bd2c` | R4/W5 | Pixel-level verification + the cascade fix (`:root.dark` specificity) + 70 captures + parity/state matrices |
| `c3a2142cfb1e59425de11050e4e6e6b2a1d1056b` | R5a | Revert of out-of-scope prettier normalization (scope hygiene) |
| `3de91eabcd39464564caef6c628126615d36026b` | R6 | Evidence pack + permanent docs (this commit) |

## 3. What was implemented and verified

### 3.1 Feedback truth — explicit typed channels (D6)
`FeedbackNote` now requires `kind: "completion" | "advisory" | "error"`, declared at the event source; the prefix-guessing classifier (`/^تم[ت ]/` + per-screen advisory regexes) is deleted. All consumers migrated with wording untouched: InventoryMaterials (12 sites), Catalog (44 sites), CostEditor (unified onto the primitive), DraftEditor (including the bespoke `startsWith("تم ")` renderer), DirectSaleEditor (advisory product notice), Settings + 3 settings sections (typed notice + diagnostic-copy channels). Concrete defects fixed by this: the completions «سُجّل إخراج الهدر…», «أُوقفت المتابعة…», «عادت المتابعة…», «حُلّ سجل النقص…» previously rendered as **errors**; the mixed reset outcome («تمت إعادة التعيين، لكن تعذر مسح…») previously rendered with a **success check**; the export completion previously carried a literal `✓` beside the primitive's marker (removed — D9: markers come from primitive semantics).

### 3.2 OrderDetail: error ≠ not-found
A failed read renders «تعذر قراءة الطلب» with a working retry (repeats the read; nothing created); a successful read of a missing id renders «الطلب غير متاح محليًا» with return only. Distinct `data-void` slots. Behavioral tests: `R1.orderDetailVoid.test.tsx` (3).

### 3.3 Honest voids in FinanceActivity (D8)
A silent unfiltered census read (limit 1) distinguishes **no-data** (empty ledger → «لا نشاط مسجّل بعد» + first-recording guidance) from **no-results** (filter excludes → «لا نتائج في هذا النطاق» + filter-removal guidance). Read-only, presentation layer only. Tests: `R2.financeActivityVoid.test.tsx` (3).

### 3.4 Chosen states (D7) + mechanical boundaries
`.micro-text-action[aria-pressed="true"]` renders a 2px clay-interactive underline (token-bound, both themes; asserted in U09.css.test.ts). Primitives are now **mechanically** leaves: eslint `no-restricted-imports` bans `@/pages/*`, `@/app/*`, `@/application/*`, `@/storage/*`, `@/components/*` in production primitive files (violation-tested).

### 3.5 Permanent Dark Mode (W5/D1)
- **One semantic-role mapping layer**: `styles/theme-dark.css` is the single owner of dark values; it rebinds the SAME `--vf-*` contracts + Micro aliases under `:root.dark`. No dark components, no second alias grammar, no duplicated primitives — verified by tests + guards.
- **Light untouched and default**: the 18 approved light hexes unchanged (byte-for-byte test); `defaultTheme="light"`; the unset preference (service default `"system"`) resolves to light — the app never follows the OS.
- **Dark explicit + persisted**: settings toggle → `.dark` + `data-theme` + runtime meta theme-color rewrite; verified to persist across a full reload and to persist the return to light.
- **`color-scheme`**: `:root` light / `:root.dark` dark — native controls follow; asserted mechanically (design-token-guards) and observed live (`colorScheme: "dark"` in the real-browser probe).
- **Retired values removed from the runtime path**: the entire v0 `.dark` block deleted from index.css; `#1c1917` removed from the dark meta twin; the ban list (v0 identity `#CC785C/#964E33/#5F3120/#079FA0` + the retired v0 dark set) is enforced everywhere in runtime CSS by design-token-guards.
- **Identity preserved**: clay `#D97757` (identity/create/FAB) and `#C96442` (pressed/chosen) are the exact same values in dark; `#141413` keeps the Warm-Ink commitment role via the single documented inversion (commit fill → warm paper `#F2EEE6` + dark ink, highest-contrast fill in both themes).
- **Contrast floors (D5)**: `scripts/theme-contrast-guard.py` verifies 82 WCAG pairs mechanically in BOTH themes (text ≥ 4.5:1, non-text marks ≥ 3:1), wired into `pnpm design-guards`. The approved Light palette passes unchanged.
- **Cascade defect found and fixed by the capture phase**: index.css `:root` literals beat the `.dark` layer at equal specificity (import order), silently keeping `color-scheme`, the Micro tint pairs, and `ink-on-color` light inside dark. Fixed with `:root.dark` (0,2,0) + a regression test asserting the specificity contract.

### 3.6 Pixel/capture verification (the interrupted run's stopping point)
Real production build (`vite preview`) + real Chromium (390×844, `ar-JO`, Asia/Amman, mobile/touch, fresh profile with completed first-run setup):
- **70 route captures** (35 route families × both themes) + state captures (sheet open light/dark, discard question, no-data, pressed filters, not-found, dark-toggled settings).
- **Zero horizontal overflow, zero console errors, all routes painted content** in both themes.
- **Dark renders dark at pixel level**: computed canvas `rgb(33, 29, 24)` (#211d18) AND PNG pixel analysis — every sampled background matches an approved surface of its theme (PIL decode of the actual screenshots); ink inverts correctly (orders-light: 19,475 light / 199 dark-ink px; orders-dark: 19,341 dark / 155 light-ink px).
- **Identity at pixel level**: clay-family pixels present in home captures in both themes (357 light / 356 dark sampled) — the FAB/create identity renders identically.
- **No retired canvas, no teal**: forensic probe proved the suspicious `(28,25,23)` strip reading was `#1b1814` (approved recessed) + AA rounding noise — `#1c1917` exists in no runtime CSS and no computed element color; a teal-family scan of identity-bearing captures found none.
- **Theme behavior**: light default (even with OS dark), dark toggle rewrites meta theme-color (#faf9f5 ⇄ #211d18), persistence across reload, return-to-light persists. Behavioral tests: `R3.themeBehavior.test.tsx` (3).

### 3.7 Render-smoke + keyboard/focus coverage
`R2.renderSmoke.test.tsx` mounts the FULL real app (real services over fake-indexeddb, real router) and walks **all 55 registered routes in light AND dark** via the real preference path — no mocks. `R2.keyboardFocus.test.tsx` verifies Escape-close (clean), Escape-asks-discard (dirty form — no silent loss), native-controls-only operability, Tab reaching the create FAB, and the token-bound focus ring.

## 4. Verification totals (all green, this run, this machine)

| Gate | Result |
|---|---|
| typecheck (root + prototype) | PASS |
| lint | PASS (36 warnings ≤ 37 cap) |
| format:check | PASS |
| text-density | PASS — all surfaces within §10 caps (OrderDetail 174/174; channel registration documented) |
| design-token-guards (§9 + retired ban + single-source + color-scheme) | PASS |
| theme-contrast-guard (D5, both themes) | PASS — 82 pairs |
| stylelint | PASS |
| check-secrets | PASS — 944 files, 0 patterns |
| check-test-focus | PASS — 210 test files, 0 .only/.skip |
| check-entity-touchpoints | PASS |
| check-runtime-cycles | PASS — 259 production files, 0 cycles |
| root tests | 391/391 (35 files) |
| prototype tests | 1258/1258 (175 files; +25 vs baseline: new R1/R2/R3 files + extended token/channel tests) |
| production build + bundle budget | PASS — 150,932 gzip ≤ 155,000 |
| rollback rehearsal | PASS — `ece7be3` reachable, clean, pre-dark state intact; scratch worktree removed; branch untouched |

## 5. Protected boundaries — verified untouched

`git diff --name-only ece7be3..HEAD` contains **zero** files under `src/domain/`, `src/application/`, `src/storage/`, and zero Documents/micro-standard-v2 paths. No financial formula, posting, reversal, persistence, sync, permission, or state meaning was modified. `Micro/main` unchanged at `c0469e2` (verified live). One cosmetic exception, self-reverted: a prettier sweep briefly reformatted three guard scripts + their tests; commit `c3a2142` restored them byte-for-byte to `ece7be3` (guards re-verified green after the revert).

## 6. Files changed (summary)

29 production/test/doc files + 2 guard scripts + 1 new guard + 1 new token layer + the planning evidence pack (this folder). Full inventory with per-file classification: `CHANGED_FILES_MANIFEST.json`.

## 7. NOT_RUN (kept honest)

Physical-device capture, screen-reader capture, real-notch testing, hardware-keyboard testing, and OS 130%/200% text-scaling captures were NOT performed — see `FINAL_LIMITATIONS.md`. All claims above are desktop-Chromium or jsdom evidence, labeled as such.
