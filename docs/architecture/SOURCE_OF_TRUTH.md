# Source of Truth — where every UI/AUX concept is defined and consumed

**Rule:** for every important concept below, `Defined in` is the ONLY authoritative definition. Everything else consumes it through mapping or composition. If you find yourself redefining any of these elsewhere, stop — you are creating a second source of truth.

## Bold Modular V2 direction versus current runtime (Phase 0, 2026-09-23)

**Approved visual target:** `Qays7753/Micro-Bold-Modular-Design-Handoff-V1` at `026541d9ac10c8d8df9999c4cd85653c4231ff43`: `DESIGN-DECISIONS-V2.md` defines the new visual direction, `COLOR-STANDARD-V2.md` its color roles, and the studio foundations/catalogs illustrate them. This approval covers visual identity, composition, typography, shape, components, visible interaction and states; it does **not** declare Micro production migrated or its older visual values reapproved. Lead brand is `#D97757`, never a synonym for profit, loss, cash or collection. The action role is distinct from the brand role.

**Current implementation, until a separately approved integration mapping:** `Documents/main micro-standard-v2/` remains the existing Standard contract consumed by Micro; `apps/prototype-web/client/src/styles/vf-tokens.css` remains the **single** runtime token bridge. The Documents package and production tokens have not been rewritten for V2 by this Phase 0. Their present palette, typography and component classifications describe the existing runtime, not the new visual target. Resolve differences through the next *read-only* V2-to-Micro mapping, then implement through the existing bridge and shared components in a later authorized wave. Do not copy studio fixtures, JSX/CSS or review chrome into production, create a second token namespace, or use old Micro screens to override V2 composition. Product functionality, domain calculations, data, storage and export remain Micro-owned.

**Visual roles that the next mapping must keep separate:** Brand; Action; Canvas; Surface; Ink; Information; Success; Attention; Danger; Partial/Unknown; Focus; Disabled. No financial truth follows from a color alone. Distinguish known zero from missing or partial data using the existing financial contracts and visible words/markers. `#CC785C` in legacy comparisons or ADR histories is a retired historical value, never a current runtime or V2 direction; current brand token and V2 lead both use `#D97757`.

**Theme boundary:** V2's current visual scope is Light Mode only. Micro's existing user-selected Dark Mode is already active under ADR-009; preserve that implementation without deleting, redesigning or applying V2 tokens to it in this phase. Any later dark redesign requires a separate owner decision and wave. `UX-001` stays `DEFERRED`: visual approval is not screen migration, physical-device verification or user testing. The V2 coverage CSV has **46 entries**, not 46 completed screens; the three principal product screens are visual references, not production templates.

| Concept | Defined in (authoritative) | Consumed by | Never defined in |
|---|---|---|---|
| Current runtime palette (18 values + disclosed derivatives; pending V2 mapping) | `Documents/main micro-standard-v2/design-tokens.css` | `styles/vf-tokens.css` (the only bridge) | pages, components, index.css |
| Approved **new visual direction** (not yet production tokens) | Bold Modular V2 `DESIGN-DECISIONS-V2.md` and `COLOR-STANDARD-V2.md` at the revision above | V2-to-Micro read-only mapping, then authorized changes through existing layers | the current palette, legacy screenshots, or studio JSX/CSS copied into Micro |
| `--vf-*` runtime tokens + action-class bindings | `styles/vf-tokens.css` | `index.css` `:root` aliases, `styles/primitives.css`, all surfaces | any other CSS or TSX |
| Legacy Micro names (`--primary`, `--color-*`) | `index.css` `:root` — bound to `var(--vf-*)` aliases | legacy CSS rules still live in `index.css` | new code (use `--vf-*` or primitives) |
| Raw-color prohibition (hex AND rgb/hsl, CSS and TSX) | `scripts/design-token-guards.py` + `.stylelintrc.json` | enforced repo-wide at `pnpm design-guards` | — |
| Legacy button/status classes prohibition | `client/src/legacyClassCensus.test.ts` (scans pages/components/app/pwa/contexts) | enforced at `pnpm prototype:test` | — |
| Button action classes (create/save/commit/secondary/outline/ghost/quiet/destructive) | `components/primitives/Button.tsx` + `styles/primitives.css` + Standard `button-system.md` | every action in the product (52/52 routes + app shell + pwa) | screens (no local button CSS) |
| Choice/selection presentation | `components/primitives/ChoiceRow.tsx` (2px clay-interactive edge + weight) | AssetEditor, OrderDepositPanels, G5DeclarationEditor | inline ternary class toggles |
| Status marker + tone + family | `presentation/stateAdapter.ts` | StatusChip, markers, surfaces | pages (no direct data-tone) |
| State words (Arabic product words) | Micro product dictionaries (`activityLabels`, page copy) — FROZEN by tests | screens pass them as children | the adapter or any component (never generates words) |
| Success/advisory/error feedback classification | per-screen message channels (e.g. Catalog's prefix regexes, following the CostEditor/Schedule precedent) | Notice/QuietCompletion/InlineError consumers | the primitives (they render, never classify) |
| Quiet completion / inline feedback | `components/primitives/Notice.tsx` (U-07 inline regime) | surfaces with action feedback | toasts/snackbars (not ratified) |
| Empty / no-data / no-results presentation | `components/primitives/EmptyState.tsx` | Orders, Schedule, Assets, Loans, FinanceActivity, OwnerEntitlement | per-screen empty CSS |
| Operational row slots + stripe contract | `components/primitives/Row.tsx` | (family convergence deferred — see MIGRATION_STATUS) | — |
| Money display (bidi isolation, English digits) | `components/presentation/DisplayValue.tsx` (`MoneyValue`, `MoneyWithUnit`) + `presentation/formatters.ts` | every financial value | inline formatting |
| AUX shell (header/nav/FAB/chrome/keyboard) | `components/layout/MicroAppShell.tsx`, `BottomNav.tsx`, `AppHeader.tsx` + `.micro-app-*` rules + AUX_CONTRACT | all routes | feature components |
| QuickActionSheet boundary | `components/layout/QuickActionSheet.tsx` (shell) ↔ `components/finance/Quick{Sale,Expense}Form.tsx` (feature) | global FAB | — |
| Overlay z-ladder & scrim | `--vf-scrim` + z-ladder in UI_AUX_ARCHITECTURE §6 | drawers/dialogs | per-surface z values |
| Route classification (chrome visibility) | `app/routeClassifier.ts` | MicroRouter/MicroAppShell | per-route ad-hoc logic |
| Return navigation contract | `app/navigationContract.ts` (`withFrom`), `useReturnNavigation` | every deep link | manual hrefs without from |
| Text density caps (§10.1) | `scripts/text-density-count.py` (+ caps table) | enforced per surface | — |
| Route inventory sync | `application/diagnostics/routeTemplate.ts` ROUTE_TEMPLATES ↔ `app/MicroRouter.tsx` | diagnostics | — |
| Financial meaning / posting / reversal | `src/domain` + `client/src/application` (services) | screens via `usePrototypeServices` | UI layers (never) |
| Persistence / export / sync | `client/src/storage` | application services | UI layers (never) |
| Migration status per surface | `docs/architecture/MIGRATION_STATUS.md` (+ run folder matrix) | planning/review | chat history (never) |
| Current Dark Mode runtime | ADR-009 + `styles/theme-dark.css` | existing user-selected theme (preserved during V2 Light work) | historical `DARK_MODE_BOUNDARY.md` / superseded ADR-007 as current activation authority |

**The three questions before any UI change:** Where is this concept authoritatively defined? Am I consuming it or redefining it? Which consumers must I inventory before changing it?
