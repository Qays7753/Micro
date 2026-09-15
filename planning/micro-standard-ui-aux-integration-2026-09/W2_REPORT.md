# WAVE 2 REPORT — Shared Primitives

**Commit:** 825df4b · **Scope:** only proven-repeated primitives, one at a time, with contracts, tests, and real consumers before broad adoption.

## What was built

`components/primitives/` (leaf-only; inside the existing `components/**` eslint boundary globs):
- **StateMarker** — role→glyph mapping; CSS shapes for dot/partial/tilde (no icon-library mandate per the Standard's adapter guidance).
- **StatusChip** — word (children, product-owned) + marker + tone from the State Adapter; **white-Surface-backed marks** so success/status/info meet the 3:1 non-text minimum (3.27/3.25/3.87); knowledge states and honest voids render neutral; 13px label floor.
- **Button** — the owner-approved action ladder: create (Clay + ink), save (warm ground + ink + **2px inset clay-interactive pressed edge — pressing is never success**), commit (filled warm ink + white, reserved for high-consequence), secondary/outline/ghost, destructive (error ink + confirmation at the consuming surface); loading keeps the label, swaps in a spinner, sets `aria-busy`, and blocks duplicate submission; reduced-motion collapse.
- **Notice / QuietCompletion / InlineError** — the ratified inline/quiet feedback regime (U-07): `role="status"`, word + marker; quiet completion check renders in ink on the warm ground per the Standard's warm-surface rule.
- **Row / RowList** — operational slot grid (lead/title+caption/state/trailing), inset dividers, and the ≤3px inline-start edge stripe that renders **only** when a state slot exists (word + marker are the primary signal).
- **Field** — label association (htmlFor, ≥13px), warm-ink focus, inline error recovery (error wins the hint slot).
- **EmptyState** — no-data is not failure; symbol aria-hidden; one action.
- **MoneyWithUnit** (added to the proven `DisplayValue` module) — unit beside the bidi-isolated number, never inside it; unit is a required prop so the shared module stays string-free.

`styles/primitives.css` — all values through `--vf-*` tokens; no raw hex (guard-verified); reduced-motion block.

State Adapter additions: `no-data` / `no-results` void keys; `MicroActivityStatus` local union with a compile-time sync test (keeps the adapter leaf-pure so it cannot drag application services into screens' text-density counts).

## Defect fixed (no decision needed — Flash GAP-11/12)

`.micro-status-chip` had **no tone variants**: `data-status="warn"` was silently ignored and warn-intent chips rendered success-green; Orders/Schedule empty-state labels also rendered green. The four consumer sites now use `StatusChip` with the correct presentations: shortage count → `incomplete` (half-filled marker, neutral), «غير محدد بعد» → `unconfirmed` (question marker, neutral), empty-state labels → `no-data` (no marker, neutral). Words unchanged (verified by the existing journey tests, which assert the copy).

## Adoption (real consumers before broad adoption)

| Site | Before | After |
|---|---|---|
| `InventoryMaterials.tsx` ×2 | green "warn" chips | `StatusChip` knowledge presentations |
| `Orders.tsx` | green empty chip + `micro-button-primary` | `StatusChip no-data` + `Button action="create"` |
| `Schedule.tsx` | green empty chip + `micro-button-primary` | `StatusChip no-data` + `Button action="create"` |

Legacy `.micro-status-chip` now has **zero consumers** — retirement registered in the W6 inventory.

## Verification

- 31 new tests this wave (primitives 30 + adapter sync; suite totals: 391 root + **1,224 client**, up from 1,193).
- `pnpm check` fully green: typecheck, lint (within the 37-warning budget, all pre-existing), format, **text-density within caps** (after the children-API correction below), design-guards, all guard scripts, build, bundle budget PASS (633,400 raw / 150,651 gzip — +203 bytes for the primitives).
- Boundary check: no primitive imports pages/app/application/storage; `check-runtime-cycles` green.

## Engineering notes (honest record)

1. **StatusChip API correction:** the first implementation passed the word as a string prop, which surfaced a pre-existing `text-density-count.py` undercount (its JSX state machine misses one at-rest string in each of the three touched files — verified empirically against HEAD). Moving to the idiomatic children API kept measurement consistent with baseline; the counter bug itself is registered as a finding (not fixed here — changing counter behavior would shift many pages' counts and belongs to a dedicated guard wave).
2. **TS prop conflicts:** `title` (ReactNode) vs DOM `title` resolved via `Omit<…, "title">` on Row/EmptyState.
3. **Button docblock hex:** the TSX hex scanner does not strip comments; the comment was reworded (no value change).

## Deferred (with rationale, registered in COMPONENT_CATALOG.md)

Sheet/Dialog convergence (one overlay owner) → W6 behind per-surface tests + AUX_CONTRACT.md; AmountInput → W5; ScreenState skeleton tier → per U-18.

## Rollback boundary

`git revert 825df4b` — primitives and their adoption revert together; W1 tokens are unaffected.

**W2 gate: PASS.**
