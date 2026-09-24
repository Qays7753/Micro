# UI/UX V2 — Phase 2 implementation wave evidence

**Date:** 2026-09-24
**Workstream:** `WS-182` (branch `feat/ux-001-v2-micro-uiux-evolution-20260924`)
**Base SHA:** `bbac8525b567312ceae0642da8921c88035711bc` (verified live `origin/main` after `git fetch --prune`; the commissioning prompt's 38-char reference `bbac8525b567312ce0642da8921c88035711bc` is a transcription that resolves to no object — live `origin/main` was used per the commission's own rule)
**Visual reference:** Bold Modular V2 @ `1c990544c5f45744187072076f4dc87877c9f3c4` (read-only; `reports/micro-phase1-v2-integration-mapping-2026-09-23/PHASE-1-INTEGRATION-MAPPING.md` with the OD-01..OD-12 owner addendum is the controlling map)

## What this wave did

Implemented the approved V2 visual direction through Micro's existing layers only — no screen TSX was modified, no new component was created, no second token source exists:

1. **Token bridge** (`styles/vf-tokens.css`): light palette now carries V2 — cool surface ladder (`#F0F3F4/#EDF1F2/#E4EAEC/#FFFFFF/#DCE3E5/#CFD8DB`), V2 ink family (`#1D2930/#53616A/#5E6B74`), solid action `#A94630` + white ink + pressed `#8F3B27` (OD-01), semantic pairs moved into the bridge (attention `#95590C/#FFF0D7`, success `#16765A/#DFF3E9`, danger `#B0324F/#FFE7EB`, brand-soft `#FBE9E2`, partial `#5B6770`), status merged into info `#305968`, focus = information role, V2 radii (control 16 / sheet 24 / dialog 20), V2 type tokens (screen title 24, section 18, card title 16, button 16), V2 motion timings + easing, cool elevation tone, V2 overlay scrim. **Identity unchanged: `#D97757` + `#C96442`.**
2. **Alias layer** (`index.css :root`): carries zero literal hexes now — the four Micro-owned pairs rebind to the new tokens; divider/accent-soft/brand-soft follow the V2 roles; Alexandria leads `--font-arabic` with IBM Plex Sans Arabic fallback (OD-03); screen titles 24px; nine section-heading rules 17→18px; bottom nav 70px / 24px icons / ink-2 unselected / action-ink selected without a pill; field focus **and the global `button:focus-visible`/`a:focus-visible` ring** use `--vf-focus` (one Information-role focus system; dark resolves through its own `--vf-focus: #f2eee6` rebind); dialog radius 20px.
3. **State semantics** (OD-02): `stateAdapter` partial tone `info`→`partial` (own neutral tone, same string length — zero bundle delta); pending/reversed/due/overdue/needs_review mappings and all frozen words unchanged; `primitives.css` gained the partial chip-marker and row-stripe rules plus the 16px button type token.
4. **Typography payload** (OD-03): Alexandria VF subsetted to one 59,800-byte woff2 (weights 100–900, Arabic+Latin+digits, GSUB init/medi/fina preserved) from the 1,177,164-byte TTF delivery; IBM Plex Mono remains the numeric-slot contract; precache grows by ~60KB (fonts are outside the JS budget).
5. **Brand assets** (F-01): all 19 SVGs regenerated on the approved palette (light quad: `#1D2930/#305968/#5B6770/#D97757` on `#F0F3F4`; dark twins on dark's own active values `#F2EEE6/#D97757/#A59E8F/#6AA6EC` on `#211D18`); manifest + meta theme-color follow the V2 canvas; `design-token-guards.py` now scans `public/brand` SVGs for retired values.
6. **Guards**: contrast matrix extended from 82 to **92 pairs** (partial/attention/nav-selected), all passing in both themes; `vf-tokens.test.ts` approved set re-baselined to the V2 palette as the authorization artifact (dark identity freeze untouched); `R2.keyboardFocus.test.tsx` focus-ring freeze re-baselined from `--color-accent-text` to `--vf-focus` (sanctioned WS-182 re-baseline documenting the global/field focus unification; the `--color-accent-text` alias itself is unchanged and still freezes as interactive ink in `vf-tokens.test.ts`).

## What this wave did NOT do (deliberate)

- **Dark Mode**: preserved, not redesigned. `theme-dark.css` received only three preservation rebinds for tokens that did not exist before this wave (`--vf-partial`, `--vf-attention`, `--vf-nav-selected-ink`) so light literals cannot cascade into dark; every existing dark value is byte-identical.
- **V2 Shell structural replacement** (no-logo header + account panel), SnapshotDeck / OVR-SNAPSHOT-ALL / «عرض الكل», page-swipe: deferred to their owner-recorded later waves (OD-10, OD-12, UX-001 owner_decision).
- Skeletons/StructuralLoad (D-11 bundle strategy), Field/Row convergence (D-08), AnchoredMenu/filter panel, chart system (D-01), pending-send/offline axis (D-02): deferred with reasons.
- No domain/storage/export/schema change (`localSchemaVersion=38`, `localExportVersion=30` unchanged); no frozen word or money format touched; no state word, formatter, or financial meaning altered; no cap raised (lint 37, bundle 650,000/155,000).
- PNG/ICO brand twins are binary and were NOT regenerated (no rasterizer in this environment) — favicon.ico, favicon-16/32/48.png, apple-touch-icon, android/web PWA PNGs remain on the old palette until an asset pass with a raster tool.

## Verification (executed)

- `pnpm check` full chain (final PR-boundary run, includes the global focus unification and the `R2.keyboardFocus` re-baseline): **EXIT 0** — ops-control tests+validate (64 items, 24 workstreams, 1 active claim = WS-182, origin/main `bbac8525…`), typecheck, lint (37/37 warnings, 0 errors), format, text-density (all surfaces within caps), design-guards (tokens + contrast 92/92 both themes + stylelint), guards (secrets/test-focus/entity-touchpoints/runtime-cycles), domain+scripts 483 tests, prototype 1,904 tests (271 files), production build + bundle budget **PASS** (raw 649,628 = identical to the pre-wave baseline; gzip 154,067).
- Baseline before any code change: full `pnpm check` EXIT 0 at `bbac8525` (bundle 649,628/154,072; lint 37; 2,387 tests) — run once, not repeated per file.
- Operations Control: `validate.py` PASS with the WS-182 claim active (64 items, 24 workstreams); `generate_tracker.py --check` PASS after regeneration.
- Live visual evidence: production build served and captured at 360×760 through the real first-run journey and the real dark toggle; VLM-verified (cool light theme, preserved warm dark theme, terracotta action system, no glitches) — `planning/ux-001-v2-evolution-2026-09-24/visual-review/` (12 captures + README). No console errors.
- NOT_EXECUTED: real-device verification, TalkBack/VoiceOver, 320–412 × 150/200% device matrix, daylight, UAT (external gates per Phase 1 map; `DEVICE-001`/`UAT-001`).

## Rollback boundary

Base `bbac8525`; the wave lands as revertible commits (ops-control claim → foundation → docs). Reverting the foundation commit restores the previous palette, fonts, and assets; the dark layer is independently revertible; the claim/tracker commit is documentation-only.

`UI_V2_PHASE_2_FOUNDATION_IMPLEMENTED`
`LIGHT_FIRST_THROUGH_EXISTING_BRIDGE`
`DARK_MODE_PRESERVED_WITH_PROVEN_REBINDS`
`IDENTITY_UNCHANGED_D97757`
`ACTION_A94630_ADOPTED_OD_01`
`STATE_MEANING_SEPARATED_FROM_URGENCY_OD_02`
`ALEXANDRIA_SUBSET_59KB_OD_03`
`MONEY_AND_WORDS_FROZEN`
`NO_CAP_RAISED`
`REAL_DEVICE_AND_UAT_REMAIN_EXTERNAL_GATES`
