# DARK MODE BOUNDARY — Preparation Only (W7)

**Status: NOT activated. NOT the default. The Standard package is untouched.** This document is the isolated semantic-layer proposal required by W7; a full Dark Mode release requires its own owner gate and complete matrix testing (register U-03).

## Current state after this run

- The Light layer is the Micro Standard v2 integration surface: `styles/vf-tokens.css` owns the 18 approved values; `:root` Micro names bind to them (W1).
- The `.dark` block remains **Micro-local legacy**: it still carries the retired v0 dark palette values (e.g. canvas `#1c1917`, brand `#d59172`, teal-family accents) and re-declares the Micro runtime names. It was intentionally NOT re-bound by this run; only three verified-dead token mirrors were removed with it in W6.
- The theme toggle and `ThemeContext` behavior are preserved (`.dark` class + `data-theme` + runtime meta theme-color rewrite). No default changed.
- Primitives added in W2 consume `--vf-*` contracts for class-critical bindings (action classes, marks on white surfaces) and the Micro alias names for mode-adaptive surfaces — so dark mode continues to resolve through the legacy alias layer exactly as before this run.

## The future semantic layer (proposal — not implemented)

A Dark wave would introduce a **separate semantic mapping file** (e.g. `styles/semantic-roles.css`) declaring mode-independent roles that both themes feed:

`surface / surface-raised / text / text-secondary / text-tertiary / border / border-interactive / state-success / state-error / state-info / state-status / identity / identity-interactive / commitment / focus / scrim / elevation / chart-1..n`

Rules for that wave (owner-gated):
1. Light values come from `--vf-*` (already in place); dark values derive from a deliberate dark palette decision — no silent inversion, no reuse of retired v0 values without ratification.
2. The 18-value light palette and the no-new-palette rule stay untouched; dark values are a separate, explicitly approved set.
3. Parity testing: a computed-style matrix (role × surface × state) asserted equal in information (contrast floors: text ≥4.5:1, non-text marks ≥3:1, focus visible) across both themes.
4. Word + non-color marker redundancy makes theme independence testable independently of color.
5. PWA twins (manifest theme_color, meta theme-color) get dark equivalents via the existing ThemeContext rewrite path.
6. Rollback: the semantic layer is additive; disabling dark reverts to light-only with zero light-layer change.

## Why not now

The execution prompt's fixed decision: "Do not activate or implement a full production Dark Mode in the first Light integration." The Light integration (W1–W6) must stabilize and pass owner review first. This document is the required preparation boundary — nothing more.
