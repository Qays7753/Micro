# UI/AUX Architecture — Micro Standard v2 Integration

**Status:** Active · **Owner:** Micro repository (operational source of truth) · **Applies to:** `apps/prototype-web/client/src`
**Supersedes:** nothing (first canonical architecture doc for the Standard integration; decision history in `ADRs/`).

---

## Phase 0 visual authority (2026-09-23)

Bold Modular V2 (`Qays7753/Micro-Bold-Modular-Design-Handoff-V1`, `main` at `026541d9ac10c8d8df9999c4cd85653c4231ff43`) is the **approved visual direction** for Micro's next UI: shape, typography, identity/color roles, composition, components, states and visible interaction. This document describes the **existing runtime architecture**, not proof that V2 has reached the application. Existing Micro Standard contracts and `styles/vf-tokens.css` remain the implementation bridge; their older visual definitions must not silently outrank V2 when planning migration. The next gate is a read-only mapping of V2 into this architecture, reviewed before code; this Phase 0 changes no Standard package, tokens, primitives or product screen.

V2 is Light-only in this wave. The existing explicit, persisted Dark Mode is already active (ADR-009 supersedes ADR-007); preserve it without redesign or V2 token migration now. A future Dark redesign needs its own owner decision and wave. The current financial/domain, persistence, export and product behavior contracts remain Micro-owned. No studio fixtures, JSX/CSS or review chrome enter production and no second visual token namespace is allowed.

---

## 1. The fixed strategy (non-negotiable)

```
Contract-first → Token-driven → Component-driven → Feature-oriented → Composition-based
```

Every visual or behavioral rule has ONE authoritative definition. Other layers consume it through mapping or composition; they never redefine it.

## 2. The authority ladder

| # | Layer | Location | Owns | Never owns |
|---|---|---|---|---|
| 1 | Current Standard contracts / approved new visual target | `Documents/main micro-standard-v2/` (31 external files) describes the **current** runtime contract; Bold Modular V2 decisions/color standard define the **target** visual direction | existing roles/tokens and the future visual target respectively; reconcile in read-only mapping before implementation | claiming current Standard already contains all V2 values, or treating current UI as target |
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
- A new semantic color for the current runtime → it does NOT enter production until the governing Standard and V2-to-Micro mapping are reconciled in an authorized later wave; then update the existing `vf-tokens.css` bridge and its consumers. This Phase 0 authorizes no new runtime colors. (ADR-002)
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

Dark Mode is **already active**, explicit and persisted in Micro (ADR-009 and `styles/theme-dark.css`); ADR-009 superseded ADR-007, and `DARK_MODE_BOUNDARY.md` describes the older preparation stage. Bold Modular V2 currently covers Light Mode only. Preserve today's Dark implementation during this documentation phase and do not apply V2 visual tokens to it or claim it is the V2 design. A future visual redesign of Dark requires a separate owner decision and wave; later production changes must guard against regressions in the existing theme.

## 8. Related documents

`SOURCE_OF_TRUTH.md` (where every concept lives) · `EXTENSION_PLAYBOOK.md` (how to add things) · `CHANGE_PROTOCOL.md` (how to change things) · `COMPONENT_CONTRACTS.md` (primitive contracts) · `ADRs/` (decision records) · `MIGRATION_STATUS.md` (current per-surface status).
