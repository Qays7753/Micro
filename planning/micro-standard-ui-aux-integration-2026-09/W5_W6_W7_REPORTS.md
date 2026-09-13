# WAVE 5 REPORT — Feature Patterns

**Commits:** 7e76e63 (forms extraction, W3) · 0854c7c (pilots, W4) · this docs commit · **Scope:** document and index Micro-owned patterns; extract bounded feature composition; nothing enters the 29-file Standard.

## What was done

1. **Pattern index created** (`FEATURE_PATTERN_CATALOG.md`) — the six Micro-owned runtime patterns (fact triad + road chips; documented-correction lifecycle; next-action state machine + priority DecisionPanel; knowledge states; decision-card grammar; inline no-toast feedback) documented with evidence and integration state. This closes the scan's "patterns discoverability" gap (GAP-34) without moving any code.
2. **Finance feature forms extracted** (with W3): `QuickSaleForm` + `QuickExpenseForm` are the first formally-owned Finance feature patterns — fields, validation, submission, wallet attribution, and idempotency live in the feature layer; the AUX shell only dispatches.
3. **Knowledge states adapter-backed** (W1/W2): the knowledge-state contract is now enforced by the State Adapter + StatusChip (neutral tone + non-color marker, orthogonal to outcomes) — InventoryMaterials' warn-defect chips were the first consumers.
4. **Value-zone composition adopted** (W2/W4): `MoneyWithUnit` (unit beside the bidi-isolated number) consumed on Finance.
5. **Deferred with rationale (no speculative abstraction):**
   - Period chip variant: U-08 keeps native month inputs + quick ranges as the product-owned control; the chip variant is documented but not implemented without a real consumer.
   - Chart floors: recorded as acceptance criteria; the first chart awaits a product decision (U-16).
   - Table restructure for phone scanning, order-row `Row` adoption, filter staged-state migration: per-surface waves registered in MIGRATION_MATRIX.csv (post-run).
6. **No Standard changes** — feature patterns never entered the 29-file package (verified: Documents repo untouched by this run).

**W5 gate: PASS** (patterns documented; extractions tested; boundaries enforced; nothing speculative).

# WAVE 6 REPORT — Migration Matrix and Old-Style Retirement (batch 1)

**Commit:** 33dd43b · **Scope:** honest migration inventory + verified-dead retirement only.

## Migration matrix

`MIGRATION_MATRIX.csv` (generated from the live tree): all **52 non-test pages** × legacy usage counts (`micro-button-primary` ×114 remaining, `micro-status-chip` ×0 remaining), new-primitive adoption (9 pages), status, test coverage (colocated/journey), and wave assignment. Pilots (Home, Finance) marked done; the rest are planned per-family waves with per-surface tests — the honest state, not an overclaim.

## Retirement executed (verified-dead only, "no consumer remains" proven)

| Item | Evidence | Action |
|---|---|---|
| Dead tokens `--space-7`, `--motion-in-out`, `--color-text-tertiary`, `--color-withdrawal-text/bg` | 0 consumers (W1 census + W6 re-census) | removed from `:root` + `.dark` mirrors |
| Dead tooltip (GAP-21) | provider mounted, Tooltip/Trigger/Content never rendered (scan + re-verification) | provider unwrapped, `components/ui/tooltip.tsx` deleted, `@radix-ui/react-tooltip` dependency dropped — radix-runtime chunk no longer ships |
| Byte-identical duplicate rules (GAP-43 batch 1) | 8 families verified byte-identical ×3 (programmatic check) | 16 duplicate rules removed (first occurrence kept — U09 first-match safety); index.css 6,963 → 6,888 lines |

## Deliberately NOT retired

- `.micro-status-chip` rule: 0 TSX consumers remain, but retirement of the CSS rule awaits the full sheet-family consolidation (registered).
- Remaining duplicated family groups (partial-overlap copy 3 of the pulse/heading families): need a computed-style equality check with visual review — registered for a post-run pass.
- 114 legacy `micro-button-primary` usages: per-action reclassification (create/save/commit) is per-surface work — the matrix records every one.

**W6 gate: PASS** (full suite green after removals: 391 + 1,224; budget PASS 633,132 raw).

# WAVE 7 REPORT — Dark Mode Preparation (boundary only)

`DARK_MODE_BOUNDARY.md` written: current state (light = Standard surface; dark = preserved Micro-local legacy), the future semantic-role layer proposal with parity-testing rules, the six owner-gate rules, and why activation is out of scope for the first Light integration. **No dark tokens added to the Standard. No default changed. No activation.**

**W7 gate: PASS.**
