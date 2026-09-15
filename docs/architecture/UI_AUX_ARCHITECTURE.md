# UI/AUX Architecture — Micro Standard v2 Integration

**Status:** Active · **Owner:** Micro repository (operational source of truth) · **Applies to:** `apps/prototype-web/client/src`
**Supersedes:** nothing (first canonical architecture doc for the Standard integration; decision history in `ADRs/`).

---

## 1. The fixed strategy (non-negotiable)

```
Contract-first → Token-driven → Component-driven → Feature-oriented → Composition-based
```

Every visual or behavioral rule has ONE authoritative definition. Other layers consume it through mapping or composition; they never redefine it.

## 2. The authority ladder

| # | Layer | Location | Owns | Never owns |
|---|---|---|---|---|
| 1 | Standard contracts | `Documents/main micro-standard-v2/` (31 files, external) | visual roles, tokens, action classes, states, geometry, accessibility, RTL, motion, composition guidance | Micro implementation |
| 2 | Runtime token mapping | `client/src/styles/vf-tokens.css` | the ONLY place Standard hex values live; `--vf-*` namespace; action-class bindings; Micro legacy names rebound as aliases | product meaning, words |
| 3 | Shared primitives | `client/src/components/primitives/` + `styles/primitives.css` | Button (8 action classes), StatusChip, ChoiceRow/ChoiceButton, Notice/QuietCompletion/InlineError, Row/RowList, Field, EmptyState, markers | financial meaning, product policy |
| 4 | AUX shell | `client/src/components/layout/` + `.micro-app-*` rules | Header, BottomNav, FAB, safe areas, keyboard chrome, route chrome, scroll ownership, overlay z-ladder, QuickActionSheet shell | sale/expense business workflows |
| 5 | Feature patterns | `client/src/components/{finance,orders,order,cost,catalog,owner,loans,settings,security,presentation}/` | Micro-specific compositions: finance forms, correction preview, deposit panels, actual-time, catalog sections | generic styling, token values |
| 6 | Screen composition | `client/src/pages/` (52 routes) | composition, data connection, product meaning, screen-specific copy | shared CSS, token definitions, reusable behavior duplication |
| 7 | Domain/application/storage | `src/domain`, `client/src/application`, `client/src/storage` | financial meaning, formulas, posting/reversal, persistence, sync, permissions | UI or React components/pages/CSS |

**Boundary precision (matches the enforced eslint rule, `eslint.config.js` boundary globs):** layer 7 must not import UI — no React, no `@/components`, no `@/pages`, no CSS. Pure presentation format utilities (`@/presentation/*` leaf modules like `formatters`) are permitted leaf dependencies by design (see `IMPORT_BOUNDARIES.md` rule 2); they contain no JSX and no styling. The runtime-cycle guard plus these rules are the mechanical enforcement; the AUX shell's sanctioned imports are defined in ADR-004 (shell imports feature forms for composition and application helpers for read-only prefetch — dispatch only, never policy).

Import direction is downward for values (a lower number never imports from a higher number at runtime). `scripts/check-runtime-cycles.mjs` and the eslint boundary rules enforce the mechanical part.

## 3. Correct and incorrect placement — examples

**Correct**
- A new semantic color is needed → it does NOT exist until the Standard defines it; then it enters `vf-tokens.css` as `--vf-*` and consumers use `var(--vf-*)`. (ADR-002)
- A save button on a new screen → `<Button action="save">` from `@/components/primitives`; the screen passes its own label. No legacy class and no local CSS.
- A selected/unselected choice pair → `<ChoiceRow><ChoiceButton selected>…` — 2px clay-interactive edge + heavier weight, never a fill.
- A financial quick-entry sheet → AUX owns open/close/discard guard; the feature layer (`components/finance/QuickSaleForm`) owns fields, validation, idempotency, submission.

**Incorrect (forbidden)**
- A hex value in a page, component, or `index.css` outside the mapping zone → the design-token guard (hex AND rgb/hsl, CSS and TSX) fails the build.
- A second token file, a Tailwind color literal, or a "competing palette" → hard stop.
- A primitive that knows a financial rule (e.g., a Button that decides what a "sale" is).
- A screen that redefines spacing/typography already owned by a primitive or the Standard.
- Renaming a Micro state word to match a Standard example — words are owned by Micro dictionaries and frozen by tests.
- A legacy button/status class in any source root → the `legacyClassCensus.test.ts` guard fails the build (it scans `pages/`, `components/`, `app/`, `pwa/`, `contexts/`).

## 4. State presentation (the honest-state contract)

- The word is the carrier of meaning; color and markers reinforce only.
- `presentation/stateAdapter.ts` maps Micro states (existing words untouched) to marker + tone + family. Pending is never success; unknown is never failure; knowledge states are always neutral.
- Honest voids stay distinct: unrecorded ≠ unavailable ≠ measured zero ≠ no-data ≠ no-results.
- StatusChip renders word-as-children + adapter presentation; it never generates words.
- Loading is not no-data: async screens show an honest first-load gate (`micro-route-loading`) and keep error paths announced (`role="alert"`).

## 5. Action classes (button-system.md)

| Class | Use | Visual |
|---|---|---|
| `create` | opens a new-record journey / add | Clay fill + dark ink |
| `save` | ordinary save/confirm/retry/run; in-flow section actions | warm ground + ink + 2px clay-interactive pressed edge |
| `commit` | high-consequence confirmation behind an independent path (delivery confirm, correction confirm, data replacement, reversal editors) | filled warm ink + white text |
| `secondary` | neutral choices and navigation | neutral tint |
| `outline` | quiet boundary action | white surface + interactive border |
| `ghost` | tertiary text-weight action | transparent |
| `quiet` | documented correction/reversal entry points (MR-03/U09 touch floor) | hairline border, transparent |
| `destructive` | error-ink entry; its confirmation uses `commit` | error ink + outline |

One-tap lifecycle transitions without an independent confirmation path use `save`, never `commit` — the commit class requires a separate confirmation step per the Standard. Adding a confirmation dialog where the product has none is a product decision, not a styling change.

## 6. Geometry, RTL, and motion invariants

Arabic-first RTL · phone-first 320–430px · light-first · English digits in isolated bidi slots (`bdi dir="ltr"`, `--font-numeric`) · currency `د.أ`/`دأ` · 44px touch floor (48px control base) · 13px label floor · safe-area insets on header/main/nav/sheets · keyboard hides chrome, never content · route transitions at `--vf-motion-normal` 200ms · one overlay at a time · z-ladder content 0 / in-panel 1 / sticky 20 / nav+FAB 30 / header 40 / cover 50 / sheet 60 / toast 70.

## 7. Dark Mode boundary

Dark Mode is a **separate semantic boundary, not activated** (see `DARK_MODE_BOUNDARY.md` in the run folder and ADR-007). The legacy `.dark` block is preserved Micro-local until its own owner-approved wave.

## 8. Related documents

`SOURCE_OF_TRUTH.md` (where every concept lives) · `EXTENSION_PLAYBOOK.md` (how to add things) · `CHANGE_PROTOCOL.md` (how to change things) · `COMPONENT_CONTRACTS.md` (primitive contracts) · `ADRs/` (decision records) · `MIGRATION_STATUS.md` (current per-surface status).
