# Component Contracts — shared primitive catalog

Authoritative contracts for `components/primitives/`. Styles live in `styles/primitives.css` (tokens from `styles/vf-tokens.css`). Tests live in `primitives.test.tsx`. The run-folder `COMPONENT_CATALOG.md` holds the historical adoption census.

## Button (`Button.tsx`)

- **Responsibility:** render the owner-approved action classes with the shared control baseline (48px, radius-control, 600, visible focus, duplicate-submit protection, loading without layout shift).
- **Inputs:** `action` (create | save | commit | secondary | outline | ghost | quiet | destructive, default save), `loading`, `block`, plus all button HTML attributes; React 19 `ref` passthrough.
- **States:** default, hover (quiet/secondary), pressed (per class contract — save shows the 2px clay-interactive inset edge and never turns success), disabled (`aria-disabled` styling + not-allowed), loading (spinner + persistent label + blocked duplicates + `aria-busy`).
- **Accessibility:** type defaults to `button` (no implicit submit); focus-visible ring; icon sizing 20px inside the label slot.
- **Forbidden:** financial meaning, product policy, success-vs-pressed conflation, generated labels.
- **Consumers:** every route (52/52) + the app shell (StartupGate) + pwa controls, after the completion run.

## ChoiceRow / ChoiceButton (`ChoiceRow.tsx`)

- **Responsibility:** the selection contract — chosen/current uses a 2px clay-interactive inset edge + heavier weight + dot cue; never a black or identity fill.
- **Inputs:** `selected`, `onClick`, `disabled`, `name`.
- **Accessibility:** `aria-pressed` toggle semantics; grouped by the surrounding `fieldset`+`legend` at the consumer.
- **Consumers:** AssetEditor (payment kind, long-use), OrderDepositPanels (classification), G5DeclarationEditor (flow direction).

## StatusChip (`StatusChip.tsx`)

- **Responsibility:** word (product-owned, passed as children) + non-color marker from the State Adapter + semantic tone. Surface-backed marks (3:1 on white); 13px floor.
- **Forbidden:** generating or renaming words; knowledge states with outcome colors; color as the sole carrier.
- **Consumers:** InventoryMaterials, Orders, Schedule (+ EmptyState state slot).

## Notice / QuietCompletion / InlineError (`Notice.tsx`)

- **Responsibility:** the ratified inline feedback regime (U-07) — no toasts. Quiet completion: ink check + past-tense word on recessed ground; the button returning to rest is never the proof. InlineError: error ink + alert marker for failure text.
- **Accessibility:** `role="status"` (polite); errors may override to `role="alert"` at the consumer when assertiveness is the existing behavior.
- **Classification ownership:** the primitives render; the consuming screen classifies its message (success/advisory/error) — e.g. Catalog's prefix regexes following the CostEditor/Schedule precedent.
- **Consumers:** OwnerEntitlement (Notice), 9 surfaces (QuietCompletion), Catalog (InlineError).

## Row / RowList (`Row.tsx`)

- **Responsibility:** operational row slots — lead, title, caption, state, trailing; ≤3px start stripe only with a state slot (word is the primary signal); divider-separated list.
- **Status:** tested primitive; family convergence (finance-event card rows) is deferred to an owner-approved visual wave — see MIGRATION_STATUS.md.

## Field (`Field.tsx`)

- **Responsibility:** label (≥13px) + control children + optional hint (12px, non-financial metadata) + inline error recovery (error visible while inputs persist).
- **Status:** tested primitive; adoption deferred — existing field compositions (`label.micro-field` + `EnglishNumberInput`/`LocalDateField`) are proven and their convergence is an owner visual decision.

## EmptyState (`EmptyState.tsx`)

- **Responsibility:** the void contract — quiet symbol + optional honest-state slot (e.g., no-data chip) + guiding title + description + one action. No-data is never failure; no-results gets a clearing action.
- **Consumers:** Orders, Schedule, Assets, Loans, FinanceActivity, OwnerEntitlement.

## StateMarker (`markers.tsx`)

- **Responsibility:** non-color marker glyphs (check/clock/alert/close/return/eye/question/tilde/partial/dot) bound to adapter roles; the marker carries the meaning shape, tone reinforces.

## MoneyValue / MoneyWithUnit (`components/presentation/DisplayValue.tsx`)

- **Responsibility:** bidi-isolated English-digit money rendering; `MoneyWithUnit` places the unit beside the isolated number, never inside it. 15px financial floor where applicable.

## Census guard (`legacyClassCensus.test.ts`)

- **Responsibility:** repo-wide regression guard — no retired legacy button/status class may appear in any non-test source root (`pages/components/app/pwa/contexts`), and no style definition for them may return to `index.css`. Born from the StartupGate audit lesson.
