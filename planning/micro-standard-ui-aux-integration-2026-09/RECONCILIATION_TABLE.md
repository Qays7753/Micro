# RECONCILIATION TABLE — every audit finding → disposition

Lead (Agent 1) classification per the five-agent protocol. **Fixed** = code changed + tests green. **Preserved** = intentional, reason recorded. **Deferred** = registered wave/owner decision, reason recorded. **Blocked-by-owner** = requires an owner product decision before any change. Paths are relative to `apps/prototype-web/client/src` unless noted.

## Agent 2 — Route & workflow coverage (run against the lost attempt; findings re-verified against the live tree)

| # | Sev | Finding (path) | Disposition | Evidence/Action |
|---|---|---|---|---|
| F1 | HIGH | `app/StartupGate.tsx:82` legacy dead-class retry button (pages-only census missed `app/`) | **Fixed** | `<Button action="save">` (Home pilot precedent); all-roots census rule + `legacyClassCensus.test.ts` guard (W2, `131992c`) |
| F2 | MED | `pages/Catalog.tsx` failure text via success styling | **Fixed** | 3-way classification; later unified into `FeedbackNote` (`db03aaf`) |
| F3 | MED | `pages/LoanEditor.tsx:44` swallowed overview() error | **Fixed** | routed to message channel (`69bfe3a`) |
| F4 | MED-LOW | `pages/FinancialEventEditor.tsx` 4 swallowed option-load errors | **Fixed** | routed to message channel (`69bfe3a`) |
| F5 | LOW-MED | `pages/G5DeclarationEditor.tsx` choice buttons bypass primitive, no aria-pressed | **Fixed** | ChoiceRow/ChoiceButton (`69bfe3a`) |
| F6 | LOW | `pages/Catalog.tsx` no loading gate | **Fixed** | honest first-load gate (`69bfe3a`) |
| F7 | LOW | `pages/CashTransferEditor.tsx` no loading gate | **Fixed** | gate (`69bfe3a`); error branch deepened (`db03aaf`, Agent-4 HIGH-2) |
| F8 | LOW | `pages/G5DeclarationEditor.tsx:42` swallowed link-options error | **Fixed** | routed to message (`69bfe3a`) |
| F9 | LOW | `pages/DeliveryReview.tsx:448` validation error without role | **Fixed** | `role="alert"` (`69bfe3a`) |
| F10 | LOW | dead `.micro-agreement-page .micro-save-cost` rule | **Fixed** | removed (`69bfe3a`) |
| F11 | INFO | two empty-state patterns coexist | **Preserved** | EmptyState adopters vs honest inline voids — both ratified; convergence registered with the Row wave |

## Agent 3 — Strategy & architecture (run against the lost attempt; re-verified against the live tree)

| # | Sev | Finding | Disposition | Evidence/Action |
|---|---|---|---|---|
| F1 | HIGH | StartupGate (same as A2-F1) + falsified zero-legacy claim | **Fixed** | as A2-F1; docs corrected to guard-provable claims |
| F2 | MED | 44 exact-duplicate rule definitions (75 blocks) in index.css | **Fixed** | span-deletion dedup, first occurrence kept; brace-balance + guard + suite verified (`69bfe3a`) |
| F3 | MED | UI_AUX_ARCHITECTURE §2 layer-7 wording vs enforced rule (presentation leaf imports) | **Fixed** | doc amended to match the eslint-enforced boundary + IMPORT_BOUNDARIES cross-ref (`11cbf37`) |
| F4 | LOW | "guards enforce downward-only" overstatement (AUX sanctioned imports) | **Fixed** | ADR-004 sanctioned-imports precision added |
| F5 | LOW | sub-contract overrides: 12px supplier-balance font; 17px owner-page icons | **Fixed / Preserved** | 12px → 13px floor (`69bfe3a`); 17px icons preserved — dense-row divergence registered in MIGRATION_STATUS |
| F6 | LOW | design-token-guards.py misses rgb/hsl in CSS | **Fixed** | COLOR_FUNC applied to CSS scan; clean (`69bfe3a`) |
| F7 | INFO | OrderDetail.tsx 1,417 lines | **Deferred** | extraction wave registered (patterns to `components/order/`); migration was mechanical (+5 net lines), coherence maintained |

## Agent 4 — UI/UX, state, responsive (fresh on the fixed tree)

| # | Sev | Finding | Disposition | Evidence/Action |
|---|---|---|---|---|
| H1 | HIGH | QuietCompletion renders failure text in 6 consumers (+M6: 3 more advisory/soft-failure) | **Fixed** | `FeedbackNote` primitive (prefix classification) adopted by 8 consumers + Catalog; contract test asserts failure never wears the check (`db03aaf`) |
| H2 | HIGH | CashTransferEditor failure masked as "add a wallet" | **Fixed** | explicit error branch + retry (`db03aaf`) |
| M1 | MED | OrderDetail cancel panel: one act, three inks | **Fixed** | all execute paths destructive (`db03aaf`) |
| M2 | MED | Navigation wearing save (OrderDetail:536; Home CTAs) | **Preserved (ratified)** | navigation weight convention documented in ADR-008 — weight never commit semantics |
| M3 | MED | 11px interactive labels at ≤380px | **Fixed** | 13px floor (`db03aaf`) |
| M4 | MED | label-bearing selectors below 13px (field small, period labels, chip, event toggle) | **Fixed** | 13px floors; field qualifier to documented 12px metadata tier (`db03aaf`) |
| M5 | MED | raw un-isolated money; negative-capable CorrectionsLayer:89 | **Fixed / Deferred** | negative site isolated with bdi; ~30 positive-only sites registered for the Row-convergence wave |
| M6 | MED | advisory/soft-failure notices as QuietCompletion | **Fixed** | with H1 (FeedbackNote) |
| L1 | LOW | retry class inconsistent (Orders/Tools/Loans secondary) | **Fixed** | unified to save (`db03aaf`) |
| L2 | LOW | recurrence-stop confirm secondary inside reason panel | **Preserved** | consequence path exists; de-emphasis documented |
| L3 | LOW | «حفظ سعة اليوم» secondary though persisting | **Preserved** | deliberate de-emphasis of optional preference; documented |
| L4 | LOW | Setup «التالي» (steps 1–2) wears save | **Preserved** | validates-and-advances; final step is the real save; documented |
| L5 | LOW | quiet openers for record-entry panels (DirectSaleEditor:513, OrderDetail:1038) | **Deferred** | weight-only tweak registered for next visual pass |
| L6 | LOW | Settings success text literal ✓ doubles the marker | **Blocked-by-owner** | product-owned copy; removing the literal is an owner decision |
| L7 | LOW | FinanceActivity empty without no-results chip | **Blocked-by-owner** | product copy decision (scope-honest wording today) |
| L8 | INFO | census deltas (create 21 vs 17; ChoiceButton 8 vs 9) | **Closed (informational)** | final report cites executed counts: 299 Button usages, 8 ChoiceButtons |

## Agent 5 — QA/release/rollback (final gate, fresh on the fixed tree)

| # | Sev | Finding | Disposition | Evidence/Action |
|---|---|---|---|---|
| 1 | BLOCKER | `.micro-g5-choice` retirement claim false — surviving copies in the triplicated family | **Fixed** | all copies removed (0 refs verified); `micro-g5-choice` added to census guard; doc claims corrected (`db03aaf`) |
| 2 | INFO-LOW | FAB pointer hover dropped with the legacy rule | **Fixed** | hover rule restored via `--vf-clay-interactive` (`db03aaf`) |
| 3 | INFO-LOW | FINAL_TEST_RESULTS.md stale counts | **Fixed** | refreshed with executed numbers (this run's docs) |

## Lead re-gate (after all fixes)

`pnpm check` exit 0 (391 + 1,233 tests; lint 0 errors/36 warnings; density 52/52; guards green; budget 633,666/150,996 PASS) · census grep 0 · `git diff --check` exit 0 · tree clean · rollback boundary re-proven in a clean worktree · mains unchanged. **No blocker or high finding remains open; no finding was closed by explanation alone.**
