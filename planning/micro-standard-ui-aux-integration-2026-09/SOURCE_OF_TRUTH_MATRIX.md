# SOURCE OF TRUTH MATRIX — Micro Standard v2 ↔ Micro runtime

**Layer 2 binding record (W1, commit c81489a).** The single owner of Standard hex values in Micro is `apps/prototype-web/client/src/styles/vf-tokens.css`. Micro runtime names in `index.css :root` bind to those contracts. The `.dark` block remains Micro-local legacy (register U-03; see DARK_MODE_BOUNDARY.md) — it intentionally still carries the retired v0 dark palette until the Dark wave's owner gate.

## A. Standard token → Micro runtime binding (light layer)

| Standard contract (`--vf-*`) | Value | Micro runtime name | Binding | Visual delta vs v0 | Notes |
|---|---|---|---|---|---|
| canvas | #FAF9F5 | `--color-bg-canvas` | `var(--vf-canvas)` | none (was equal) | |
| recessed | #F0EEE6 | `--color-bg-well` | `var(--vf-recessed)` | none (was equal) | |
| surface | #FFFFFF | `--color-surface` | `var(--vf-surface)` | none (was equal) | |
| tint | #E8E6DC | `--color-border` | `var(--vf-tint)` | near-invisible (was #eae6dc) | quiet hairline tier = `--vf-border-soft` |
| soft | #D1CFC5 | `--color-divider` | `var(--vf-soft)` | slightly darker divider (was #dad5c8) | |
| ink | #141413 | `--color-text-primary` | `var(--vf-ink)` | darker ink (was #1f1e1d) | 17.5:1 on canvas |
| ink | #141413 | `--color-text-strong` | `var(--vf-ink)` | merged with primary ink (was #33322e) | one ink tier fewer |
| ink-secondary | #4D4C48 | `--color-text-secondary` | `var(--vf-ink-secondary)` | darker (was #6e6a60) | 7.4:1 — stronger contrast |
| — | #B7B2A6 | `--color-text-tertiary` | kept hex | none | **dead token** (0 consumers) — W6 inventory |
| clay | #D97757 | `--color-brand-primary` | `var(--vf-clay)` | identity hue change (was #cc785c) | identity/create role |
| clay-interactive | #C96442 | `--color-brand-pressed` | `var(--vf-clay-interactive)` | pressed/hover (was #b4613f) | |
| ink (text-safe) | #141413 | `--color-brand-text` | `var(--vf-ink)` | brand text neutral (was #964e33 retired) | wordmark/eyebrows; brand hue lives on the mark + create surfaces |
| tint | #E8E6DC | `--color-brand-soft` | `var(--vf-tint)` | neutral quiet surface (was #f4e4db) | no clay tint exists in the Standard; no new palette allowed |
| clay-interactive | #C96442 | `--color-accent-primary` | `var(--vf-clay-interactive)` | chosen/current edge (was teal #079fa0) | selection borders/fills, checkbox accent, today marks |
| ink | #141413 | `--color-accent-text` | `var(--vf-ink)` | interactive ink + focus (was teal #057b7c) | U-02: teal retired; links/focus per Standard |
| tint | #E8E6DC | `--color-accent-soft` | `var(--vf-tint)` | quiet selected/hover surface (was #e3f5f5) | |
| — | #256B4A | `--color-success-text` | kept hex | none | **Micro-owned text-safe success ink (5.5:1)** — Standard #629987 is a non-text mark; W2 StatusChip adopts word-in-ink + marker-hue grammar |
| — | #E4F2EA | `--color-success-bg` | kept hex | none | Micro-owned tint pair — W2+ migration |
| error | #B53333 | `--color-danger-text` | `var(--vf-error)` | near-identical hue (was #b42318) | text-safe 6.02:1 |
| ground | #F5F4ED | `--color-danger-bg` | `var(--vf-ground)` | warm ground (was #fbe7e6) | Standard tint grammar: warm ground + semantic ink |
| — | #7A5C20 | `--color-warning-text` | kept hex | none | **Micro-owned knowledge/attention pair** (68 consumers) — per-surface migration W5 per U-05/U-11/U-12 |
| — | #F6ECCF | `--color-warning-bg` | kept hex | none | Micro-owned — W5 migration |
| — | #3E5C76 / #E8EEF3 | `--color-withdrawal-*` | kept hex | none | **dead tokens** (0 consumers) — W6 inventory |
| ink | #141413 | `--color-ink-on-color` | `var(--vf-ink)` | drawer scrim base (was #1f1e1d) | drawer scrim now = Standard scrim by construction |
| action-create | #D97757 | `--primary` | `var(--vf-action-create)` | FAB + primary button become Clay | 2 consumers only (`.micro-button-primary`, `.micro-fab`) |
| action-create-ink | #141413 | `--primary-foreground` | `var(--vf-action-create-ink)` | dark ink on Clay (was white) | text-bearing create class (FAB is labeled → text-bearing) |
| btn-secondary-bg | #E8E6DC | `--secondary` | `var(--vf-btn-secondary-bg)` | neutral tint (was teal fill) | 1 consumer (`.micro-button-secondary`) |
| btn-secondary-ink | #141413 | `--secondary-foreground` | `var(--vf-btn-secondary-ink)` | dark ink (was white) | |
| focus | #141413 | `--ring` | `var(--vf-focus)` | warm-ink ring (was teal) | bridge var; base focus outline follows `--color-accent-text` → ink |
| scrim | rgba(20,20,19,.45) | `.micro-dialog-overlay` | `var(--vf-scrim)` | base ink #141413 (was #1f1e1d) | guard exception removed |
| radius set | 12/16/20 | `--radius-control/card/sheet` | `var(--vf-radius-*)` | none (values equal) | |
| elevation E1–E3 | recorded | `--elevation-1/2/3` | `var(--vf-shadow-e*)` | none (values equal) | |
| spacing grid 4–32 | — | `--space-1..7` | kept (values conform) | none | `--space-7` dead — W6 inventory |

## B. Action-class bindings now live in the mapping layer

| Class | Tokens | Current consumers | Migration state |
|---|---|---|---|
| Create/add/FAB | `--vf-action-create/-pressed/-ink/-icon-ink` | FAB, `.micro-button-primary` (transitional), PWA mark | W1 bound; per-action reclassification W2–W6 |
| Ordinary save/confirm | `--vf-action-save-bg/-ink/-pressed-edge` | none yet | W2 Button primitive |
| High-consequence commit | `--vf-action-commit-bg/-ink/-pressed` | none yet | W2 Button primitive + W4 pilots |
| Destructive | `--vf-btn-destructive-ink/-border` | `.micro-button-danger` still uses `--color-danger-text` fill (auto-updated to #B53333) | W2 destructive variant per contract |
| Secondary | `--vf-btn-secondary-*` | `.micro-button-secondary` | W1 bound |

## C. Deliberate divergences (documented, not silent)

1. **Z-ladder:** Micro keeps its §1.8 guard-enforced ladder (0/1/20/30/40/50/60/70) instead of the Standard's gallery-relative 250/300/400/500 — same layering contract (scrim < overlay < fab < snackbar), denser steps, enforced by `design-token-guards.py` + stylelint.
2. **Success/warning text-safe inks:** Micro keeps #256B4A / #7A5C20 word inks (both pass 4.5:1 on their grounds) because the Standard's #629987 / #1490FF are explicitly non-text marks. Words remain text-safe; markers adopt Standard hues in W2. (Standard: "Words always render in a text-safe ink"; Micro's inks qualify.)
3. **Dark layer:** untouched legacy (U-03). Primitives that need mode-adaptive surfaces resolve through the Micro alias names (`--color-*`), not raw `--vf-*`.
4. **Hex casing:** prettier normalizes hex to lowercase (repo format gate); values verified programmatically (case-insensitive exact match) — no value deviation.
5. **FAB geometry/label:** Micro's labeled in-grid FAB preserved (U-09). Label size 11px is below the 13px floor — registered as a W3 work item with the geometry check.

## D. Dead/legacy inventory (verified 0 consumers; retirement only in W6 after migration proof)

`--space-7`, `--motion-in-out`, `--color-text-tertiary`, `--color-withdrawal-text`, `--color-withdrawal-bg`; shadcn bridge vars with zero consumers: `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--destructive-foreground`, `--border`, `--input` (CSS side; the `@theme inline` bridge itself stays for Tailwind's `bg-background`/`bg-muted`/`text-foreground`/`text-muted-foreground` used by drawer/tooltip).

## E. Ownership

- `styles/vf-tokens.css` — Standard contracts (single hex owner). Owner: runtime token mapping (Agent 2 role).
- `index.css :root` — Micro runtime aliases. Owner: runtime token mapping.
- `presentation/stateAdapter.ts` — state→presentation contracts (markers/tone only, no words). Owner: presentation layer.
- Product words, labels, and financial meaning — domain/application + existing label maps. Untouched.
