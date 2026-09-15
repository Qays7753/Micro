# WAVE 3 REPORT — AUX Shell

**Commit:** 7e76e63 · **Scope:** harden the existing shell (preserved where correct), separate QuickActionSheet shell from Finance feature forms. No generic overlay conversion.

## Changes

| Item | Change | Contract source |
|---|---|---|
| Route transition | 260ms → `var(--vf-motion-normal)` (200ms) + `--vf-ease-out` | `motion-interaction.md` route/content transition row |
| Bottom-nav labels | 11px → 13px (`--vf-text-label-size`), `min-width: 44px`, ellipsis guard | `typography.md` label floor + the Standard's bottomnav 320px fix |
| FAB label | 11px → 13px + line-height 1.1 (in-grid labeled FAB preserved per U-09) | `typography.md` + `navigation-shell.md` |
| `.micro-wordmark` | duplicate rules consolidated (18px+20px competing → single 20px) | latent-override hazard (Agent 2 finding) |
| `.micro-header-context` | duplicate rules consolidated (12px+11px competing → single 12px/600, caption floor for non-financial metadata) | `typography.md` caption floor |
| QuickActionSheet | **shell/feature separation** (below) | W3 mandate; ownership rules |

## QuickActionSheet separation (the core W3 deliverable)

Before: one 762-line component owning chrome dispatch **and** both financial forms (fields, validation, submission, wallet attribution, idempotency). After:

- `components/layout/QuickActionSheet.tsx` — shell only: mode dispatch, titles, open/close lifecycle, the forms-protection discard question, receipt display, wallets/suggestions prefetch (read-only), and delegation to the active form via a `QuickActionFormHandle` (`isDirty()` / `submit()`).
- `components/finance/QuickSaleForm.tsx` + `QuickExpenseForm.tsx` — Finance feature patterns: own their fields, validation, submission (`directSales.record` / `projectFinance.record`), wallet attribution, category chips, and idempotency keys. `quickActionFormTypes.ts` (Receipt + handle + wallet-option types) and `quickFormHelpers.ts` (`cashNow`, `attributeToWallet`) support them.
- **Behavior preservation measures:** forms stay mounted for the whole sheet session (`hidden` attribute) so menu ↔ form navigation never silently resets typed input; the drawer-wallet default flows via a `defaultWalletId` prop applied inside the sale form (same `current || drawer` semantics); the confirm-discard button's disabled state flows via `onSavingChange`; receipt construction and attribution notes are byte-for-byte the previous strings.
- Boundary check: feature forms import presentation + domain-typed service calls through the established context — they do not import the shell or pages; the shell imports the forms (dispatch direction only). `check-runtime-cycles` green.

## Verified

- Typecheck green; all 15 QuickActionSheet tests pass **unchanged** (copy, guard flows, category chips, honest effect lines); journey suites green.
- Full gate: 391 root + 1,224 client tests; design-guards + stylelint green (nav/FAB labels now via `var(--vf-text-label-size)` — on-ladder); bundle budget PASS (633,400 raw / 150,674 gzip).
- `getByRole`-based tests are unaffected by the hidden-mounted forms (role queries exclude inaccessible elements by default; verified against the actual query patterns used).

## Registered follow-ups

1. Remaining 11px/12px declarations in feature CSS (≈150 across index.css families) are per-surface W5/W6 migration items tracked in MIGRATION_MATRIX.csv — the shell-level floors are now enforced where the Standard's AUX/label contract applies.
2. Icon RTL mirroring: role-based markers are direction-neutral by design; directional chevrons at call sites already choose semantically correct glyphs (RTL "back" = rightward arrow) — this is the adapter approach the Standard permits; a systematic mirror-flag pass stays registered (not required for conformance).
3. Overlay convergence (one sheet system) — W6, behind per-surface tests.

## Rollback boundary

`git revert 7e76e63` — shell CSS floors revert, QuickActionSheet returns to the monolithic form (the finance form files become unreferenced and can be removed in the same revert).

**W3 gate: PASS.**
