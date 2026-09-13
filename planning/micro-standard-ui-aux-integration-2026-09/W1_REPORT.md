# WAVE 1 REPORT — Runtime Token Mapping + State Adapter

**Commit:** c81489a · **Scope:** one central mapping layer + State Adapter. No legacy deletion. No scattered values.

## Scope and file boundary

| File | Change |
|---|---|
| `client/src/styles/vf-tokens.css` | NEW — the single owner of the 18 approved Standard hex values; action contracts, geometry, type scale, motion, scrim, documented divergences |
| `client/src/index.css` | `:root` re-bound to `var(--vf-*)` (import added; aliases preserved); dialog overlay scrim tokenized |
| `scripts/design-token-guards.py` | §3.3 sanctioned scrim exception REMOVED (strictly stronger guard) |
| `apps/prototype-web/vite.config.ts` | PWA `theme_color` #CC785C → #FAF9F5 (canvas chrome, matching ThemeContext runtime behavior) |
| `client/public/micro-mark.svg` + `-192.png` + `-512.png` | identity twins: Clay #D97757 body, #C96442 dot, canvas stroke; PNGs regenerated (verified: corners transparent, body = 217,119,87) |
| `client/src/presentation/stateAdapter.ts` | NEW — central State Adapter (markers + tone only; never words) |
| `client/src/styles/vf-tokens.test.ts` | NEW — 12 tests |
| `client/src/presentation/stateAdapter.test.ts` | NEW — 15 tests |

Not touched: `.dark` block (Micro-local legacy, U-03), any domain/application/storage file, any page/component, `--space-*` values, Micro's easing tokens, existing label maps.

## Binding decisions (traceable to the register)

- **D-01/U-01 (palette adoption):** all 18 approved hexes land via `--vf-*`; shared roles re-bound; retired v0 palette (#cc785c/#964e33/#079fa0/#057b7c/#b4613f) no longer feeds the light layer anywhere.
- **U-02 (teal/link ink):** `--color-accent-text` → ink (links + interactive ink; text affordances may use warm ink per the Standard's constraint clause); focus (`--ring`, base outline) → warm ink `--vf-focus`; selected/current surfaces (`--color-accent-primary` borders/fills) → `--vf-clay-interactive` chosen/current edge; `--color-accent-soft` → tint.
- **Action ladder:** `--primary`/`--primary-foreground` = text-bearing CREATE class (Clay + #141413 ink) — exactly 2 consumers (FAB + primary button), both text-bearing; `--secondary` = neutral tint + ink. Save/commit/destructive classes defined and tested for W2 adoption. Per-action reclassification (which buttons are create vs save vs commit) is W2–W6 work with per-surface tests.
- **Text-safe inks:** success/warning word inks kept as documented Micro-owned extensions (the Standard's #629987/#1490FF are non-text marks — words must stay text-safe); danger ink → #B53333 (text-safe); danger bg → warm ground (Standard tint grammar).
- **Honest voids / state truth:** encoded in the State Adapter and tested (pending ≠ success; unknown ≠ failure; knowledge neutral; three voids distinct; no invented numbers).

## Verification

- **Token tests (12):** 18 approved values present (case-insensitive exact match — prettier lowercases hex; documented); no retired value in the mapping layer; `:root` hex set ⊆ approved ∪ documented Micro-kept; every `var(--vf-*)` resolves (index.css and internal chains); no duplicate token declarations; binding spot-checks; scrim tokenized; `.dark` untouched; U09 selectors intact.
- **State Adapter tests (15):** Micro words preserved exactly (`activityStatusLabel` frozen); adapter returns presentation only; pending tone = info (never success); unknown = neutral outcome; overdue ≠ due; all 5 knowledge states neutral + non-color markers; knowledge orthogonal to outcome; honest voids distinct; only measured-zero displays a value; permissible-tone contract holds for every presentation; numeric slot contract (mono/LTR/isolate/15px floor).
- **Full gate:** `pnpm check` green — typecheck, lint (36 pre-existing warnings, 0 errors, budget 37), format, text-density, **design-guards (now stricter — zero sanctioned raw-color exceptions)**, guards (secrets/test-focus/entity-touchpoints/runtime-cycles), root tests 35/391, client tests 168/1193 (+27), build ✓, bundle budget PASS (633,197 raw / 150,602 gzip).
- **Palette-safety:** no test asserted palette values at baseline (verified census), and none needed changes.

## Risk register

1. Visual deltas are intentional and confined to the light layer: identity hue (Clay), ink darkening (contrast improvement), teal → warm ink/clay-interactive, secondary button neutralized, danger surfaces warm-ground. All revert by reverting c81489a.
2. `.micro-button-primary`/FAB now render the CREATE class; screens where the primary button is semantically a save/commit get their correct class in W2–W4 (registered in MIGRATION_MATRIX).
3. Dark mode renders legacy values (unchanged behavior) — documented divergence, owner gate pending.

## Rollback boundary

`git revert c81489a` — tokens return to v0 values; guard exception returns; twins revert; adapter files removed. No other wave depends on this commit being present except W2+ (which build on it by design).

**W1 gate: PASS.**
