# Migration Status — Micro Standard v2 UI/AUX integration

**Last updated:** 2026-09-14 (completion run, branch `micro-standard-ui-aux-integration-20260914`)
**Live evidence:** `planning/micro-standard-ui-aux-integration-2026-09/MIGRATION_MATRIX.csv` (52/52 routes) + `client/src/legacyClassCensus.test.ts` (repo-wide guard, all source roots).

## Route/screen status — 52/52 migrated

All 52 routes render their actions through the shared primitives with per-action classification, and the app shell + pwa controls too. Census scope: `pages/` + `components/` + `app/` + `pwa/` + `contexts/` (the all-roots rule). Per-action totals: 17 create · 8 commit + 1 conditional destructive|commit · 1 destructive · 72 save + 1 StartupGate retry · 45 navigation→secondary + 113 legacy secondary→primitive secondary · 36 quiet entries → primitive quiet · 8 danger → primitive destructive · 9 choice toggles → ChoiceRow (AssetEditor ×4, OrderDepositPanels ×2, G5DeclarationEditor ×2, + ActualTimePanel guided/unguided weight split). **Zero legacy button/status classes remain in non-test source** — enforced by the census guard test, not just by claim.

Per-route adoption and honest test evidence: see the matrix (12 routes carry `none-found` dedicated test files — covered by typecheck/lint/suites, declared not claimed).

## Intentionally preserved (with reasons)

| Item | Reason |
|---|---|
| Loans in-flow load-error container (`micro-empty-state` as geometry) | error ≠ empty per the Standard; a dedicated error-container contract needs an owner decision |
| Statement in-section quiet void lines (`micro-empty-copy`) | quiet in-flow voids inside list sections; EmptyState's card scale would mislabel them |
| Conditional save-note/error ternaries (~22 surfaces) | per-surface message-kind logic; each needs its own restructure decision (unconditional ones migrated to QuietCompletion) |
| Finance-event card rows (Finance/Statement/FinanceActivity/WalletLedger) vs Row primitive | card presentation is a documented Micro pattern; convergence to Row changes the most sensitive screens' visuals — owner-approved wave required |
| Field primitive not yet adopted by forms | existing `label.micro-field` + input family is proven; convergence is an owner visual decision |
| `.dark` legacy block | Dark Mode boundary — not activated (ADR-007) |
| `micro-text-action` link actions | ratified quiet link pattern, not a button class |
| `.micro-owner-page .micro-prim-button svg { 17px }` | documented divergence: dense owner-page rows; icon size only, meaning/contrast unaffected (registered for the next visual pass) |
| Raw positive-only money compositions (~30 sites, EventsLayer/QuickSaleForm/Home/etc.) | render acceptably as single LTR islands today; the negative-capable site (CorrectionsLayer) is isolated; mass `MoneyValue` adoption belongs to the Row-convergence visual wave (registered) |
| Settings.tsx success text containing a literal ✓ beside QuietCompletion's marker | cosmetic double glyph; the word is product-owned and frozen — removing the literal is an owner copy decision (registered) |
| FinanceActivity empty scope wording without a no-results chip | wording is scope-honest and invites widening the range; a filtered-vs-empty chip split is a product copy decision (registered) |
| Setup wizard «التالي» (steps 1–2) wearing save | validates and advances only; final step is the real save — weight-only, documented |
| Schedule «حفظ سعة اليوم» / recurrence-stop confirm wearing secondary | deliberate de-emphasis of optional preferences inside open panels; consequence paths exist (documented) |
| `quiet` openers for record-entry panels (DirectSaleEditor consumption link, OrderDetail extra deposit) | panel openers adjacent to correction/reversal entries; reclassifying to secondary is a weight-only tweak deferred to the next visual pass |

## Deferred to owner decisions (registered, not silently skipped)

1. Dark Mode activation wave (boundary documented; separate gate).
2. Finance-event → Row convergence wave (visual).
3. Field-primitive form convergence wave.
4. Conditional feedback-line restructure per surface.
5. Charts: none exist in the live product; chart floors recorded as acceptance criteria for the first chart (U-16).
6. Link-ink ratification and warning/withdrawal ink fate (documented divergences).
7. Commit-class expansion: one-tap lifecycle transitions without independent confirmation paths stay `save` — adding confirmation dialogs is a product decision (recorded, not taken).
8. Partial-overlap CSS families (non-byte-identical near-duplicates): need computed-style equality + visual review — registered wave; the 75 byte-identical duplicates were removed in this run.

## Retired (verified dead, this run)

`.micro-button` base + svg + active · primary/secondary/danger/quiet(×2)/block/save-cost/full-action/choice-row rules · `.micro-status-chip` · `.micro-g5-choice`(×2) · `.micro-agreement-page .micro-save-cost` · `.micro-cash-actions` disabled override (redundant) — all with 0-consumer proof before removal; 20 descendant context selectors retargeted to `.micro-prim-button`; 75 exact-duplicate rule blocks deduplicated (first occurrence kept).
