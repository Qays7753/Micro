# UI/UX V2 — WS-183 full-surface adaptation evidence

**Date:** 2026-09-24
**Workstream:** `WS-183` (branch `feat/ux-001-v2-micro-full-surface-20260924`)
**Base SHA:** `f2d5aa60cd6805ff4f9acc104fd65f94bfb8d5a2` (verified live `origin/main` after PR #235 squash-merge; tree identical to the tested foundation branch head `75ee9ef` — empty diff)
**Visual reference:** Bold Modular V2 @ `1c990544c5f45744187072076f4dc87877c9f3c4` (read-only)

## What this wave did (real component/surface adaptation over the merged foundation)

CSS-layer implementation with zero TSX change (bundle raw identical to baseline: 649,628 B) — every change lands in the shared grammar all 60 pages consume:

1. **V2 field control boundary (biggest visual surface — 370+ inline `.micro-field` usages across 65 files + the primitive field):** inputs/selects/textareas now use the structural boundary `--vf-border-interactive` (#78868D light / #8F897C dark) per the V2 field spec (`--p-boundary`), instead of the decorative divider value. One field grammar across both field systems.
2. **V2 focus halo:** `--vf-info-surface: #dfedf1` added to the bridge (exact V2 value, source tokens.css line 36/164 `--c-focus-ring`) and used as the 3px field focus halo; Dark Mode keeps its current warm halo through a documented preservation rebind (`color-mix(--vf-focus 18%)`).
3. **Icon-button cascade fix:** `.micro-icon-button` was accidentally re-styled by a grouped rule (`.micro-icon-button, .micro-delete-row`) into an accent-soft chip for EVERY instance — header actions, sheet close, month navigation, tools. The group is now scoped to `.micro-delete-row` only; the single quiet base definition (transparent + ink + 44px + radius 16 + hover-well) rules. Verified live: sheet close computed `rgba(0,0,0,0)` / `#1D2930` / 16px / 44px.
4. **Unified list base (row-group pattern):** `.micro-list` / `.micro-list-item` — 8 TSX consumers (Catalog sections ×4, EstimateDetail, CorrectionsLayer) rendered with NO base CSS at all. Now: grid container + internal 1px dividers + 56px min rows + 13px captions (V2 row-group / supporting text). The `compact` variant stays quiet inside cards (top divider only, no card-in-card).
5. **`.micro-field-hint` defined** — 12 TSX consumers had no CSS rule; now 13px secondary (label floor, V2 hint spec).
6. **Six dual-definition selectors consolidated** (single base rule each, final computed values preserved exactly — verified by a new guard test): `.micro-sheet-form`, `.micro-section-title`, `.micro-finance-event-list`, `.micro-local-truth`, `.micro-setup-page`, `.micro-setup-heading`.
7. **Header geometry tokenized:** the three 56px header-height literals now resolve through `--vf-topbar-height` (same value, one source).
8. **Nine dead rule families removed** (proven 0 TSX consumers by census + re-verified before removal): `.micro-eyebrow`, `.micro-priority-panel/-texture/-content/-truth` (+ dark variants), `.micro-guidance-grid`, `.micro-review-intro/-pattern/-copy`, `.micro-review-result/-empty`, `.micro-truth-banner` (+ dark + flex-group entry). Live counterparts untouched (`.micro-overline`, `.micro-decision-panel`, `.micro-period-result`, `.micro-local-truth`, `.micro-deposit-truth`, `.micro-review-exclusions`).
9. **New guard suite:** `V2Surface.w183.surfaceAudit.test.ts` — 21 assertions freezing this wave's contracts (boundary token in both field systems, info-surface halo + dark rebind, list base + dividers, icon-button not grouped with delete-row, dead rules stay out, header token, single base definitions).
10. **Sanctioned re-baseline:** `#DFEDF1` added to the approved token set in `vf-tokens.test.ts` (the authorization artifact; CHANGE_PROTOCOL §1.4/§4 — same PR as the value it authorizes).

## Screen coverage matrix (60 pages, all inherit the shared grammar)

| # | Surface family | Pages | Status | Evidence |
|---|---|---|---|---|
| 1 | Shell / navigation / quick sheet | AppHeader, BottomNav, MicroAppShell, QuickActionSheet | `IMPLEMENTED_AND_VERIFIED` | foundation wave + icon-button fix; captures 16/17/18; computed-style check |
| 2 | First-run setup | Setup | `IMPLEMENTED_AND_VERIFIED` | captures 01–03 (boundary select/inputs) |
| 3 | Home / overview | Home | `IMPLEMENTED_AND_VERIFIED` | captures 04 (light) / 10 (dark) |
| 4 | Finance surfaces | Finance, FinanceActivity, FinanceMore, FinanceRecurring, FinanceUpcoming, Statement, Collect, CashCount, CashDistribution, CashWallets, WalletLedger | `IMPLEMENTED_AND_VERIFIED` | captures 05 (light, full) / 11 (dark); shared grammar + DOM suites |
| 5 | Cash/finance editors | CashWalletEditor, CashAdjustmentEditor, CashReversalEditor, CashTransferEditor, CashOpeningLaterEditor, OwnerWithdrawalEditor, FinancialEventEditor | `IMPLEMENTED_AND_VERIFIED` | shared field/form grammar (this wave's boundary+halo); per-page DOM suites |
| 6 | Operation creation/editing | DirectSaleEditor, AgreementEditor, DraftEditor, NewDraft, CostEditor, CostCalculator, MaterialEditor, InventoryMovementEditor, InventoryReversalEditor, SupplierPurchaseEditor, RecurringExpenseEditor, LoanEditor, ReceivedLoanEditor, AssetEditor, G5DeclarationEditor, ScheduleEditor | `IMPLEMENTED_AND_VERIFIED` | captures 07 (light) / 12 (dark) deep form; shared grammar; per-page DOM suites |
| 7 | Orders & detail flows | Orders, OrderDetail, DeliveryReview, EstimateDetail | `IMPLEMENTED_AND_VERIFIED` | capture 06; shared grammar; OrdJourneys/R1 suites |
| 8 | Catalog & inventory | Catalog, InventoryMaterials, Assets, AssetDetail, Loans, LoanDetail, ReceivedLoanDetail, RecurringExpenseDetail | `IMPLEMENTED_AND_VERIFIED` | captures 13–15 (list base fix verified with a real item) |
| 9 | Parties / relationships | Parties, Suppliers, OwnerEntitlement, Profile, Foundation | `IMPLEMENTED_AND_VERIFIED` | shared grammar; PartiesLedger/OwnerEntitlement suites; logo-menu capture 16 (account entry) |
| 10 | Tools & settings | Tools, ToolsIntegrity, Settings, SharePreview | `IMPLEMENTED_AND_VERIFIED` | captures 08/09 (real theme toggle) |
| 11 | Market | Market | `IMPLEMENTED_AND_VERIFIED` | shared grammar; DOM suites |
| 12 | Not-found | NotFound | `PRESERVED_INTENTIONALLY` | honest 404, no V2 reference exists |
| 13 | V2 Shell structural variant (no-logo header + account panel) | — | `DEFERRED_WITH_REASON` | OD-10/UX-001 owner record: later wave; Micro's NAV-001 header + logo-menu account entry is the implemented owner-approved shell |
| 14 | SnapshotDeck / OVR-SNAPSHOT-ALL / «عرض الكل» | — | `DEFERRED_WITH_REASON` | owner-recorded later waves (new composition, needs owner review of information architecture) |
| 15 | Skeletons / StructuralLoad | — | `DEFERRED_WITH_REASON` | D-11: bundle strategy first; existing honest loading (route tile + spinners) preserved |
| 16 | Field/Row TSX convergence (226 inline → Field component) | — | `DEFERRED_WITH_REASON` | D-08: broad structural refactor outside this wave's boundary; the CSS GRAMMAR is now unified (one boundary/halo/focus contract both systems) |
| 17 | Charts system | — | `DEFERRED_WITH_REASON` | D-01: owner gate |
| 18 | Pending-send / offline sync axis | — | `DEFERRED_WITH_REASON` | D-02: product axis, not visual |
| 19 | PNG/ICO brand twins | — | `IMPLEMENTED_WITH_LIMITATION` | no rasterizer in this environment; SVGs all on the approved palette (foundation wave); binaries remain old until an asset pass |
| 20 | Real-device / TalkBack / UAT | — | `NOT_EXECUTED` | external gates `DEVICE-001` / `UAT-001` — not claimable from this environment |

**State-word / money / semantic invariants (unchanged, frozen):** «نتيجة الفترة المسجلة» wording, two-decimal display, formatters, stateAdapter words + tones (partial neutral per OD-02), negative ≠ danger, zero/no-data/unknown/partial distinctions, due-today rules — no financial, semantic, storage, export, schema, or route change (`localSchemaVersion=38`, `localExportVersion=30` unchanged).

## Verification (executed at the WS-183 wave boundary)

- `pnpm check` full chain: **EXIT 0** — ops-control validate (64 items, 25 workstreams, 1 active claim WS-183), typecheck, lint 37/37, format, text-density, design-guards (tokens + contrast 92/92 both themes + stylelint), guards, domain+scripts 483 tests, prototype **1,925 tests (272 files — +21 new guard assertions)**, production build, bundle budget **PASS raw 649,628 / gzip 154,067 — byte-identical to the merged baseline** (CSS-only wave; JS untouched).
- Focused suites during development: V2Surface.w183.surfaceAudit (21), vf-tokens.test (approved set + #DFEDF1), primitives.test, R2.keyboardFocus, R2.renderSmoke, U09, legacyClassCensus, R3.themeBehavior, Accessibility.w44, Nav001 — all PASS.
- Live visual evidence: 18 captures (360×760) through the real first-run journey + real dark toggle + a real catalog item created through the product form — `planning/ux-001-v2-evolution-2026-09-24/visual-review-w183/` + README (VLM results per capture, two false positives resolved by definitive computed-style inspection, honest limitations recorded). No console errors.
- Post-merge foundation verification (this session, before the wave): full `pnpm check` EXIT 0 on the actual merged `main` `f2d5aa6` (WS-182 → VERIFIED).
- NOT_EXECUTED: real-device matrix, TalkBack/VoiceOver, 320–412 × 150/200% device matrix, daylight, UAT.

## Rollback boundary

Base `f2d5aa6` (merged foundation). The wave lands as revertible commits on `feat/ux-001-v2-micro-full-surface-20260924`; reverting the implementation commit restores the pre-wave CSS exactly (all consolidated rules preserve final computed values; dead-rule removal is restorable from git). The tracker/docs commit is documentation-only.

`WS_183_FULL_SURFACE_ADAPTATION_IMPLEMENTED`
`V2_FIELD_BOUNDARY_AND_FOCUS_HALO`
`ICON_BUTTON_CASCADE_FIXED`
`LIST_BASE_ROW_GROUP`
`DEAD_RULES_REMOVED_PROVEN`
`BUNDLE_BYTE_IDENTICAL`
`ALL_FINANCIAL_WORDS_FROZEN`
`DARK_MODE_PRESERVED`
`DEVICE_AND_UAT_REMAIN_EXTERNAL_GATES`
