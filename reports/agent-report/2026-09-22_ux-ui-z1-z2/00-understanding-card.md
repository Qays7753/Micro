# UX/UI Reports 1–2 (Z1/Z2) — Understanding Card (Phase 0, pre-edit)

- **Task ID:** WS-172 · **Branch:** `feat/ux-ui-z1-z2-20260921` · **Baseline:** `b0b4cea66a06c295c65eb895dc2b9067c8b732cf` (verified = origin/main)
- **Scope authority:** `MICRO-REPORT-1-2-ZED-IMPLEMENTATION-PACKAGE.md` (package branch `docs/ux-ui-zed-handoff-20260921` @ `f28b0fa`, read-only input)
- **Credential mode:** owner-supplied fine-grained PAT used only for push/PR/comment/merge via a local credential file; never printed, echoed, committed, or included in any report/URL. `NO_TOKEN_EXPOSURE` enforced.
- **Language of implementation:** product copy stays Arabic (frozen dictionaries); reports in English per the task prompt.

## In scope

**Z1 — Home as a daily decision surface:** hierarchy recomposition (state → priority+CTA → upcoming/overdue → fixed actions → numbers → insights → finance/activity); an explicit daily-status region (priority day / normal day / empty day / incomplete data); one priority with ONE primary CTA; fixed actions exactly {سجّل بيعًا, سجّل مصروفًا, طلب من عميل}; collection contextual only (due/overdue rows + priority CTA); truthful states (loading/error with safe retry that preserves prior content when safely available/first-use/empty); de-duplication of amounts across adjacent regions; Card-overload reduction (open Sections + Rows; Card only for independent priority/decision/receipt).

**Z2 — work/order clarity + outcome grammar:** work-list stage + next-action clarity; order-detail journey clarity (completed, missing, next action, estimated vs final, collection completeness, review-impact as follow-up); quick-sale/full-sale truthful outcome grammar incl. `reused` and visible partial-success attribution failure; quick-expense recurring-occurrence warning (visible, non-blocking) + retained input on failure + safe retry; contextual-collection source identity and partial/complete settlement clarity; correction/reversal/delete-draft vocabulary cleanup on allowlisted surfaces; read-only verification of supporting touchpoints.

## Out of scope (non-goals)

Sixth destination or any navigation change; new routes; standalone cash/debt/expense/collection/inventory/reports destinations; new fixed Home Quick Action; recurring expense anywhere on Home; full redesigns (Finance, Tools, Market, Catalog, Parties, Inventory, Suppliers, Settings, OPS-003 recurring screens); final identity/palette/typography/radius/shadow/motion; Dark Mode; charts/goals/gamification; tablet/desktop; architecture/refactor/file moves; dependency/toolchain/Vite repair; Domain/Storage/DB/API/Auth/schema/migration/snapshot/export/writer/calculation/accounting/event-meaning/transition-legality changes; hidden functional expansion behind visual changes.

## Invariants (must hold)

1. Five destinations and their order/labels/routes unchanged (مشروعي الآن/العمل/المالية/أدواتي/السوق).
2. Financial meaning frozen: collection ≠ profit; debt ≠ cash; unknown ≠ zero; `dueOn` ≠ `occurredOn`; reversal documented and history-preserving; no deletion of completed history; delete applies only to eligible drafts.
3. `recorded` / `reused` / `record_failed` / `result_unknown` stay distinct; `reused` is neither Error nor Partial Success; a dependent attribution failure never re-records the event; no new `result_unknown` state/writer/flow is invented.
4. Home service stays a reader (no new writes/financial meaning); model changes are presentation ordering/de-duplication only.
5. All routes in package §2.4 remain valid; legal `returnTo` preserved on every Home link.
6. No recurring-expense action/Card/CTA/KPI on Home; manual expense remains directly available (no manual/recurring chooser).
7. Text-density caps unchanged (Home 78; Orders 86; OrderDetail 183; CostEditor 60; AgreementEditor 63; DeliveryReview 53; DraftEditor 49; DirectSaleEditor 87; Collect 58; FinancialEventEditor 175) — composition must be density-neutral or density-reducing.
8. Schema/export stay 36/28; zero new writers; lint warning ceiling 37; bundle budgets 650,000/155,000.
9. Primitives/tokens only: Button action classes, Row/RowList, Notice/QuietCompletion/InlineError, EmptyState, MoneyValue; no hex/rgb/hsl literals; no legacy classes.

## Failure conditions (stop conditions)

Baseline SHA drift; dirty worktree at a checkpoint; a required file outside the allowlist (beyond the documented §10.6 exception below); protected-file change without approved exception; conditional supporting-file edit without separate owner approval; current-diff test failure unresolvable within the allowlist; a required command failing without documented cause; any change touching financial meaning/domain legality/storage/API/schema/export/route ownership/OPS-003 behavior; contradictory requirement or missing decision; unexpected untracked file/secret/dependency/generated artifact; any scope broadening or history rewrite or direct main work.

## Acceptance criteria

Package §9.1 (Z1) and §9.2 (Z2) checklists, verbatim, verified at the Z1/Z2 gates; full definition of done per package §12.

## Agent assignments (five-agent team)

- **Agent 1 — Z1 Home:** Home.tsx, homeControlCenterModel.ts, homeControlCenterService.ts, Home-specific index.css selectors, and the four allowlisted Home test files.
- **Agent 2 — Z2 work/order:** Orders.tsx, OrderDetail.tsx, NewDraft.tsx, DraftEditor.tsx, AgreementEditor.tsx, CostEditor.tsx, DeliveryReview.tsx + corresponding UI tests.
- **Agent 3 — Z2 sale/expense + OPS-003 intersection:** QuickSaleForm.tsx, QuickExpenseForm.tsx, DirectSaleEditor.tsx, resultFeedback.ts + tests; FinancialEventEditor/QuickActionSheet protected (exception protocol only; current analysis: exception NOT required).
- **Agent 4 — Z2 collection + outcome grammar:** Collect.tsx, OrderDetail collection actions, resultFeedback.ts + tests; correction/reversal/delete-draft vocabulary within allowlisted surfaces.
- **Agent 5 — integration/QA/scope/tracker (read-only):** full-diff review at each checkpoint, route/nav invariants, OPS-003 non-regression, RTL/mobile/a11y checks, CI evidence, Tracker mapping, rollback readiness.

## Documented out-of-allowlist exception (package §10.6 — presentation-only, non-protected, NOT silent)

- `client/src/Nav001.dom.test.tsx` L111 — the label array `["سجّل بيعًا", "سجّل مصروفًا", "طلب من عميل", "عربون أو تحصيل"]` pins the pre-Z1 fixed-four composition. Minimal diff: remove `"عربون أو تحصيل"` from the array (the test's purpose — quick-recording row exists + sale sheet opens in place — is preserved).
- `client/src/Set003Capabilities.dom.test.tsx` L111 — `expect(row.textContent).toContain("عربون أو تحصيل")` asserts the fixed collection action survives orders-capability disablement. Minimal diff: remove this single obsolete assertion (the test's purpose — capability gating of order/estimate entries with the sale/expense core unaffected — is preserved).
- Classification: presentation-only DOM test assertions; files are NOT in the protected list (§4.2); the assertions contradict the owner-approved fixed product decision (§1.2: fixed actions = sale/expense/order; collection is contextual) and Z1 acceptance criteria §9.1. Recorded per §10.6 steps 1–3; not silently added to the allowlist. G004CapabilityGuard.dom.test.tsx requires NO edit (its assertions remain true under Z1).

## Rollback boundary

Checkpoints: baseline branch point (b0b4cea) → Z1 contract tests → Z1 complete → Z1 verified (Z1 CHECKPOINT push) → Z2 contract tests → Z2 complete → Z2 verified (Z2 CHECKPOINT push) → merge. Z1 reverts by reverting Z1 commits before Z2 begins; Z2 reverts independently (Z1 files untouched by Z2 except explicitly added test-only non-regression assertions). No force-push; no branch/PR deletion; no shared-history manual rollback without a clean checkpoint.

## Evidence class key for this run

VERIFIED / INFERRED / UNVERIFIED / NOT_EXECUTED / DEFERRED / BLOCKER — per the task contract.

---

## Z1 checkpoint append (2026-09-22)

Z1 complete at branch HEAD `de9c513`: targeted 104/104, prototype:check PASS, design-guards PASS, full `pnpm check` EXIT 0 (bundle 625,542/650,000 raw, 148,559/155,000 gzip), text-density Home 77→71, live visual QA VERIFIED at 320/360/390/430 (zero horizontal overflow, zero console errors) covering first-use/empty/incomplete/attention days, fixed-three actions, contextual collection end-to-end with partial settlement, and five-destination nav. Full detail: `01-z1-delivery-report.md`. Status: `Z1_COMPLETE — Z2_READY`.
