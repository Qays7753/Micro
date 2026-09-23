# Extension Playbook — how to add things without duplicating definitions

Read `UI_AUX_ARCHITECTURE.md` and `SOURCE_OF_TRUTH.md` first. This playbook is operational: follow the steps in order and do not skip the verification gates.

**V2 Phase 0 boundary:** Bold Modular V2 is the approved **future visual direction**, not an already migrated Micro runtime. Existing Standard/`vf-tokens.css` remain the single implementation bridge. The next V2-to-Micro mapping is read-only and precedes token/component work; nothing in this playbook permits a second token source, studio-code copy, or a token-only recoloring of every existing screen.

## A. Add a new screen (route)

1. **Identify the feature boundary** — which feature family owns it (`components/<family>/`)? If none fits, that is a design decision to raise, not a folder to invent casually.
2. **Map the screen before coding:** one goal, primary action, hierarchy, scroll owner, states (loading/error/empty/no-data/pending/unknown/measured-zero where honest), exit paths.
3. **Reuse primitives:** actions → `Button` with the correct action class (§5 of the architecture doc); states → `StatusChip`/`EmptyState`/`Notice` family; money → `MoneyValue`/`MoneyWithUnit`; choices → `ChoiceRow`.
4. **Declare composition:** write the screen as composition — no new CSS unless the screen has a genuinely new layout need; then the CSS lives in `index.css` under a `.micro-<screen>-` prefix using `--vf-*` tokens only.
5. **Add the route** in `app/MicroRouter.tsx` (deep routes before generic `:id` patterns — follow the existing ordering comments), classify it in `app/routeClassifier.ts` if it is a new route kind, and register it in `application/diagnostics/routeTemplate.ts` ROUTE_TEMPLATES (the inventory is kept in sync).
6. **Async data?** Add an honest first-load gate (`micro-route-loading`) and route load failures into an announced error (`role="alert"` or the message channel) — loading is not no-data, and failure is never silent.
7. **Tests:** route + workflow + state coverage (journey/dom style). Update the text-density expectations if you added strings (caps are enforced; loading labels with «جارٍ» are excluded; prefer text-node JSX and regex literals over new string literals when classifying).
8. **Update the maps:** `MIGRATION_STATUS.md`, the run-folder matrix if a run is active, and the screen composition map when a new composition contract emerges.

## B. Add a new shared component

1. **Prove repeated behavior** — at least 2–3 real usages with the SAME meaning and lifecycle. Visual similarity alone is NOT enough (architecture rule 5).
2. **Define the contract** in `docs/architecture/COMPONENT_CONTRACTS.md`: responsibility, inputs, states, accessibility rules, supported composition, forbidden dependencies, examples.
3. **Place it in the correct layer** — primitives (no product meaning) vs feature pattern (product composition) vs AUX (chrome). Wrong layer = rejected in review.
4. **States & accessibility tests** in `components/primitives/primitives.test.tsx` (or colocated feature tests): every documented state, marker/word contract, touch floor.
5. **Styles** in `styles/primitives.css` (or feature CSS for feature patterns) using `--vf-*` only.
6. **Record** in the source-of-truth matrix and the component catalog.

## C. Change a token or visual rule

1. **Establish which decision applies.** For V2 work, the Bold Modular V2 decisions/color standard govern the intended Light visual result; the current Documents Standard governs the *existing* runtime until its authorized reconciliation. Record differences in the separate read-only integration mapping and obtain its owner review before a production change. This Phase 0 does not modify Documents or `vf-tokens.css`.
2. **Change the existing implementation bridge once in a later authorized wave** — align governing Standard documentation when permitted, then `styles/vf-tokens.css` and the affected components/screen composition. Do not introduce raw colors outside the sanctioned token zone, a second namespace or a blanket token-only palette swap. A Documents change is never silently assumed from V2 approval.
3. **Inventory consumers** — grep the token name; list every consumer in the PR description.
4. **Run visual + responsive checks** — 320/390 widths, capture evidence for affected surfaces in Light and regression-check the existing Dark theme; design-token guard must stay green (it checks hex AND rgb/hsl in CSS and TSX).
5. **Record migration/rollback** — note the old value, the new value, the date, and the rollback SHA in the change note; update `SHA256SUMS` artifacts if a run folder is active.

## D. Change a state or label

1. **Preserve Micro product words** unless the owner decides otherwise (words are frozen by tests — a rename fails the suite).
2. **Update the State Adapter** (`presentation/stateAdapter.ts`) if the semantic mapping changes; never bypass it with a direct tone.
3. **Update all consumers** of the word (grep the exact word).
4. **Test** pending/unknown/zero/error semantics around the change; keep honest voids distinct.

## E. Change AUX or navigation

1. Verify: safe areas (top/bottom), keyboard-open behavior, back/Escape, overlay focus and restoration, scroll ownership, route chrome classification, 320px width.
2. Run the shell-adjacent suites: QuickActionSheet (15 tests), navigation contracts, lock gates, unsaved-changes.
3. Update `AUX_CONTRACT.md` (run folder) and the architecture doc §6 if an invariant changed.

## F. Add a feature pattern

1. Keep product meaning inside the feature/domain boundary; the pattern composes primitives.
2. Define all data/loading/empty/error/pending/unknown states — a pattern without its state matrix is incomplete.
3. NEVER add feature implementations to the Standard package (`micro-standard-v2/` is contracts only).
4. Document in the feature-pattern catalog: contract, state matrix, consumers, tests.

## G. Preserve current Dark Mode; redesign only in a separate future wave

1. The user-selected Dark Mode is already active in Micro (`styles/theme-dark.css`, ADR-009); ADR-007 and `DARK_MODE_BOUNDARY.md` describe its historical preparation, not today's activation state.
2. V2's present visual scope is Light only: preserve existing Dark behavior and test it for regressions when shared Light foundations change. No Dark deletion, redesign or V2 token migration is authorized in this phase.
3. A later V2 Dark redesign needs an explicit owner decision and separate wave with surface/state/overlay parity checks; do not infer permission from the existing activation.

## Verification gates (every extension)

`pnpm check` must pass end-to-end: typecheck · lint (0 errors) · format · text-density (§10 caps) · design-token guards (hex + rgb/hsl) · secrets/test-focus/entity-touchpoints/runtime-cycles · root suite · client suite (includes the legacy-class census guard) · build + bundle budget. Physical-device, screen-reader, and OS text-scaling claims must be executed, not inferred — mark NOT_RUN honestly when unavailable.
