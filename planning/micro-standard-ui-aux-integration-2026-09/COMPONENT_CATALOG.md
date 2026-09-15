# COMPONENT CATALOG — Shared Primitives (W2)

Owner: shared-primitives layer (Agent 3 role). Location: `apps/prototype-web/client/src/components/primitives/`. Leaf-only dependency rule: domain/shared types, presentation utilities, sibling primitives — never pages, never app/, never application/ runtime, never storage. No Arabic at-rest strings in primitive sources (text-density caps).

| Primitive | Contract (Standard source) | Anatomy | States | Ownership boundary | Tests | Adopted by |
|---|---|---|---|---|---|---|
| `StateMarker` | Non-color state signal (`component-states.md`) | icon by role (check/clock/alert/close/return/eye/question) or CSS shape (dot/partial/tilde) | role-driven | presentation of markers only; no words, no tones | via StatusChip | StatusChip, Notice, Field |
| `StatusChip` | State presentation matrix + knowledge-state contract (`component-states.md`) | marker + word (children; product-owned) on white Surface, hairline border | `data-tone` success/error/info/status/neutral; `data-family` outcome/knowledge/void/activity | words are PASSED IN — never generated/renamed; tone grammar per adapter | 6 chip tests + adapter truth tests | InventoryMaterials ×2 (knowledge), Orders, Schedule (no-data) |
| `Button` | Action classes (`button-system.md`) | label (children) + optional leading spinner; 48px, radius-control, 600 | default/pressed(class-specific)/focused/disabled/loading; `aria-busy`; duplicate-submit blocked | action semantics chosen by the consuming screen; no financial meaning inside | 5 tests | Orders + Schedule create buttons (empty states) |
| `Notice` / `QuietCompletion` / `InlineError` | Quiet feedback variant, U-07 ratification (`component-states.md`) | word + marker, `role="status"` (aria-live polite) | neutral/info/error; quiet completion = check in INK on warm ground (Standard warm-surface rule) | inline feedback region only; Snackbar stays optional, not default | 3 tests | W4/W5 pilot adoption (registered in migration matrix) |
| `Row` / `RowList` | Operational row slots + edge-stripe contract (`component-contracts.md`) | lead / title+caption (wraps Arabic) / state / trailing slots; inset dividers | optional ≤3px inline-start stripe in success/error/info — rendered ONLY when a state slot exists | product meaning lives in the slots' content, never in the Row | 4 tests | W4 pilots (registered) |
| `Field` | Input system (`input-system.md`) | label (≥13px, htmlFor) + control (children) + hint (12px, non-financial) / error (word + alert marker, error ink) | default/focus(warm-ink outline)/error(`data-invalid`)/disabled(native) | currency/rounding policy stays in product truth; aria-invalid/aria-describedby wiring documented as consumer responsibility | 3 tests | W4/W5 pilots (registered) |
| `EmptyState` | Empty taxonomy (`empty-loading-error-states.md`) | symbol (aria-hidden) + title + description + one action | no-data vs no-results distinguished by the screen's copy | copy and the single action are the screen's | 1 test | W4/W5 pilots (registered) |
| `MoneyWithUnit` (`components/presentation/DisplayValue.tsx`) | Financial value zone (`component-contracts.md`) | bidi-isolated `MoneyValue` + unit span beside it (never inside the number) | honest unavailable dash for null | unit is a required prop (product decides د.أ/دأ); no invented numbers | 2 tests | W5 finance value-zone pattern (registered) |

## Deferred with rationale

- **Sheet/Dialog overlay primitive (one overlay owner)**: three sheet systems currently work (micro-sheet family, micro-dialog, vaul drawer) and convergence mid-run without visual review would be risky. The overlay CONTRACT (scrim, focus containment, one active modal, staged filters, safe dismissal) is documented in `AUX_CONTRACT.md`; convergence is a W6 migration-matrix item behind per-surface tests.
- **AmountInput primitive**: `EnglishNumberInput` (28.7 KB chunk exists) already owns LTR-isolated numeric entry; extraction is W5 feature-pattern work.
- **ScreenState (loading)**: honest-text loading is the ratified default (U-18); a skeleton tier is optional and deferred per the register.

## Registered findings (from W2 work)

1. `text-density-count.py` `jsx_text_nodes` has a pre-existing state-machine desync in regions of `Orders.tsx`/`InventoryMaterials.tsx`/`Schedule.tsx` — one at-rest string per file was historically undercounted (verified empirically). The children-based StatusChip API keeps measurement consistent with baseline; the undercount itself is a counter bug to fix in a dedicated guard wave (not this run).
2. RTL icon mirroring: directional lucide icons currently render unmirrored. The Standard's mirror-flag guidance is implemented at the adapter level (roles are non-directional); wiring mirror flags into the icon layer is registered for the W3/W5 AUX pass (chevron mirroring is the visible case).
