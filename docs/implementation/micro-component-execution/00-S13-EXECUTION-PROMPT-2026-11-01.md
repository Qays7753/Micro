# Micro S11/S12 Review Fixes → S13 — Owner-Directed Connected Execution Order

- **Date:** 2026-11-01 (Amman)
- **Repository:** `Qays7753/Micro`
- **Only implementation branch:** `components/integration-20261027`
- **Only pull request:** #383 — keep Draft
- **Program base (`main`, read-only):** `3584aa1d08cea3e0a00623b719fed7f991ce187f`
- **Live integration head verified before publishing this order:** `ac4429efdf494d61ef980476ed0ec4f8f344bf57`
- **Current stage results:** `16-S11-RESULT-2026-10-31.md`, `16a-S11-REVIEW-ADDENDUM-2026-11-01.md`, and `17-S12-RESULT-2026-11-01.md`
- **Current S11 structure scan:** `docs/architecture/refactoring/s11-structure-scan-20261031/S11-STRUCTURE-ARCHITECTURE-CODE-ORGANIZATION-SCAN-REPORT-2026-10-31.md`

## 0. Owner authorization and required uninterrupted sequence

The owner authorizes this single connected execution on the existing ZAI conversation, integration branch, and Draft PR:

1. Correct the two independently confirmed S11 findings below, with permanent regressions and truthful Control/report updates.
2. Correct the four independently confirmed S12 correctness/coverage findings below and reconcile the two baseline-history records without rewriting historical approvals or measurements.
3. Proceed directly, without an intermediate owner-review or approval pause, to implement the complete S13 scope: UNIT-006, UNIT-012, UNIT-018, and SH-17.
4. Run the required focused tests, final `pnpm check`, repository guards, five sequential read-only reviews, and exact-final-head GitHub Actions/Cloudflare verification; repair every confirmed in-scope defect and rerun affected gates before delivery.

This is execution authorization only. It is **not** acceptance of S11 or S12, not acceptance of S13, not `VERIFIED` on `main`, and not permission to merge. Do not pause for routine clarification, intermediate review, documentation polish, fixable test failures, or pending CI/deployment runs. Continue through S13 after the fix-first work without waiting for a new owner message. If a real unresolved financial/product/security decision or irreconcilable contract conflict would require inventing policy, preserve the completed work, continue independent safe work, and report the exact blocked decision; never guess or silently change its meaning.

Publishing this file is documentation only. Start only after the owner sends the short start message referencing this file. Once started, carry out the full sequence in this same ZAI conversation. Do not restart from scratch, discard local work, or stop after a plan or partial code slice.

## 1. Repository, safety, and architecture boundaries

- Work only on `components/integration-20261027` and PR #383. Keep #383 open and Draft.
- Never write to `main`, merge, rebase, force-push, delete branches, close the PR, change Draft status, or create another branch or PR. Stage-specific commits append to the same branch; no intra-branch merge is needed.
- Preserve every existing local, uncommitted, untracked, and unpushed file/commit. Inspect before any cleanup. Never reset, discard, `git clean`, reclone over work, or delete a repository. Remove only temporary artifacts proven unrelated and safe to remove; list them in the report.
- At execution start reread current repository instructions, including `AGENTS.md`, `docs/operations/current-state.md`, `docs/00-document-index.md`, the relevant CORE+FIN / CORE+STORAGE / CORE+UI / CORE+OPS routed packs, `docs/operations/control/generated/AGENT-BRIEF.md`, `generated/ACTIVE-WORK.md`, the Control JSON sources, `02-PROGRESS-AND-HANDOFF.md`, the current S11/S12 results/addendum, all listed specifications, and tests/code at the actual live head. Run the Control validator and inspect all open PRs and active Workstreams before creating or reopening claims.
- **Post-Group-6 structure gate:** do not perform structural refactoring, bulk file moves, mass renaming, broad file splits, a new `features/` layer, or any wave from the S11 scan. Its recommendations remain `NOT_EXECUTED` and require owner review/decision first. Preserve the current lazy-loading pattern. A functional fix may touch the smallest files necessary, but may not smuggle in code-organization changes.
- No broad system-wide visual reskin, global token/theme/shell rewrite, or second design system. Implement the screen structures and flows explicitly specified in the current component A/B sections, using current approved Micro foundations.
- No semantic changes beyond the findings and approved S13 contracts. No silent change to money, dates, cost/collection/debt meaning, rejection precedence, ownership, persistent schema, export/import wire format, or security policy. Do not weaken tests, guards, thresholds, allowlists, lint limits, bundle budgets, or size ceilings.
- Never paste, print, commit, or log tokens, credentials, or secrets. Use a secure credential facility only; never ask the owner to place a token in this prompt or in repository text.

## 2. Safe continuation and live provenance

Before changing anything, send one concise status update in the current conversation: local branch/full HEAD/upstream, dirty and untracked files, ahead/behind counts, any local work not on GitHub, live `main`, live integration head, PR #383 state/base/head, latest relevant PR comment, exact-head GitHub Actions and Cloudflare status, and the actual next action. Do not disclose credentials or output secrets.

Reverify live values; the pinned SHA above is only the pre-publication reference. Record separately:

- prompt-publication commit SHA;
- execution-start full SHA;
- each S11 and S12 fix/code/test SHA;
- S13 code candidate, tested SHA, and final documentation/head SHA.

At the time this order was prepared, live `main` was `3584aa1d08cea3e0a00623b719fed7f991ce187f`, PR #383 was open/Draft with that base, the branch head was `ac4429efdf494d61ef980476ed0ec4f8f344bf57`, and GitHub Actions plus Cloudflare Pages were successful on that exact SHA. Recheck all of them at execution start. Do not attribute a test or deployment to a different SHA.

If the local history is safely behind the verified remote and clean, fast-forward only. If there is divergence, dirty work, or unpushed work, preserve and inspect both sides before reconciling. Do not overwrite any newer remote or local work.

## 3. Control lifecycle and exact sequencing

Use Operations Control JSON as the source of truth. Never edit generated tracker views manually.

1. Start with the S11 review item/workstream `DOC-020` / `WS-236`. Verify their current status and legal transition path. Reopen them legally before the S11 fixes, move them through the required in-progress state, and return them to truthful review-pending states after the fixes. Do not mark S11 accepted or verified.
2. Only after S11 fix commits and its legal return to review-pending, reopen `DOC-021` / `WS-237` legally for the S12 corrections; then return S12 to truthful review-pending states. Do not mark S12 accepted or verified.
3. Before S13 code, verify whether `DOC-022` / `WS-238` remain unused and legal. Use them only if available; otherwise select the next unused valid IDs and document why. Create S13 Item and Workstream from JSON source before code, using SH-17 and the exact scope below. Resolve any overlapping active claim through legal Control transitions; never bypass the validator.
4. After every source JSON change run `python3 scripts/operations-control/generate_tracker.py`, `python3 scripts/operations-control/validate.py`, and `python3 scripts/operations-control/generate_tracker.py --check`. Refresh Excel metadata only if the canonical procedure requires it. Do not claim a generated view was manually edited.
5. Preserve the prior S11/S12 result files and their historical test SHAs. Append ordered review addenda (use `16b-S11-REVIEW-ADDENDUM-2026-11-01.md` and `17a-S12-REVIEW-ADDENDUM-2026-11-01.md` only if these names are still unused; otherwise use the next unused ordered names). Do not overwrite historical results to make them appear to have covered this review.

## 4. Fix first — S11 findings from the independent review at `ac4429ef`

The previous `S11-MR-001` and `S11-MR-002` have already been corrected and must not be reopened or duplicated. These are **new findings** from a separate focused read-only review of `ac4429ef`.

### `S11-LR-001 — NEW_CONFIRMED_DEBT_WITHOUT_SIMPLE_IDENTITY`

**Evidence:** `DirectSaleEditor.tsx` displays an error for a confirmed debt with no identity, but the save validation path shown at `DirectSaleEditor.tsx:481-577` does not pass or validate `customerName` / `customerPartyId`; the writer call can therefore still be reached. The domain/application save path must be traced again at execution start.

**Authoritative intent:** UNIT-037 and SDF-010 require a simple identity for a new receivable while keeping the saved customer/party profile optional. UNIT-005 B3 U005-F05 and U005-AC09 refer to the unresolved D03 detail; do not claim D03 itself grants approval for phone, mandatory saved-party creation, or broader identity policy. Use the already approved simple local identity direction only.

**Required root correction:**

1. For a newly created or explicitly newly introduced `partial_debt`, require a non-empty simple local identity on the source (trimmed `customerName` or an explicitly selected valid `customerPartyId`) before any writer call. Add the validation at the actual application/domain command boundary as well as the UI boundary where appropriate; an inline warning alone is insufficient.
2. A simple name/description on the sale is sufficient. Do **not** require a saved permanent party, phone number, additional profile, or automatic party creation. Do not merge by name.
3. Apply the guard only to a new confirmed receivable or a transition that newly creates one. Keep legacy unnamed debt visible and preserve its amount/history; do not block a non-financial correction merely because an old record is unnamed. A `partial_needs_review`, full-payment, or other non-confirmed-debt case must not acquire a name requirement through this fix.
4. Add model and DOM/service regression tests proving the exact confirmed-debt case is rejected before any writer call, and tests proving the allowed non-debt, review, saved-party, and legacy-read/correction cases remain intact.

If execution-time source evidence disproves the finding because a genuine service/domain boundary already rejects the case, verify that boundary with a focused characterization test and record it as already protected; do not duplicate guards unnecessarily.

### `S11-LR-002 — LEGACY_DRAFT_OVER_COLLECTION_SILENTLY_BECOMES_FULL`

**Evidence:** `directSaleEditorModel.ts:64-79` maps `collectedMinor >= revenueMinor` to `full`. In the editor restore path, the raw legacy draft amount is also loaded, but the full-mode resolver uses the sale total. A legacy draft such as revenue 1,200 / collected 1,300 can therefore be presented and submitted as full collection of 1,200, silently hiding the invalid raw amount. Existing tests cover equality but not greater-than-total.

**Required root correction:**

1. Preserve the legacy draft’s raw `collectedMinor` and its validity. Only exact equality may migrate to `full`; a greater-than-total value must never be clamped, replaced with the total, or interpreted as full.
2. Restore the over-total value in a state that visibly remains invalid and prevents save until the owner explicitly corrects the amount or deliberately chooses a different payment mode. Preserve the raw value during validation/error recovery. A later explicit user choice may change intent; migration itself may not.
3. Add durable model and UI regression tests for total below/equal/above collected, exact raw restoration, truthful validation, no write before explicit correction, and the existing `collectedEmpty` legacy semantics.

Re-check the live source first. If already fixed on a newer head, prove it and do not repeat the work.

After S11 fixes, commit S11 code/tests separately from its addendum/Control records. Record IDs, root cause, exact source clauses, evidence, tests and SHA, what remained open, and that S11 is still pending review/owner acceptance.

## 5. Fix next — S12 findings from the independent review at `ac4429ef`

S12 is complete in implementation but still pending independent review/owner acceptance. The following findings must be fixed before S13; they are not reasons to abandon the connected execution.

### `S12-FIN-001 — SAME_CREATION_KEY_ACCEPTS_CHANGED_AGREEMENT_PAYLOAD`

**Evidence:** `agreementService.ts:101-113` returns `draft.linkedOrderId` without comparing the incoming effective creation payload. Both Memory and IndexedDB creation boundaries return an existing order as `reused` when its ID exists, without checking whether the retry carries the same intent. Existing write-boundary tests exercise the date/null first-writer case and currently expect reuse.

**Required root correction:**

- Define a canonical comparison over every effective persisted agreement-creation field: source/draft identity; price; initial deposit and its date/identity; due-date tri-state; cost unknown/known mode and reference; delivery terms; customer/source snapshot; item/quantity/other persisted fields. Exclude UI-only/transient metadata.
- Compare inside the single owner write boundary in both adapters and before the service linked-draft fast path. Identical intent/payload returns the exact persisted agreement as a true reuse with no second write. The same operation/source key with a changed effective payload returns an explicit conflict with no write and no schedule/collection side effect. Do not overwrite the first agreement or report the changed payload as successful reuse.
- Keep schedule reuse tied to the persisted agreement, not the incoming conflicting payload. Preserve `outcome_unknown` and retry recovery semantics.
- Add deterministic tests for same payload reuse and changed price, deposit, date (including known↔unknown), cost mode/reference, delivery terms, and snapshot on both Memory and IndexedDB, including concurrent same-key attempts. Assert no duplicate cash, no altered order, and no unrelated writes.

### `S12-ATOMIC-001 — SDF-040 TEST ONLY PROVES PRE-WRITE REJECTION`

**Evidence:** the current SDF-040 test passes an over-limit quantity and fails at the service validation guard before the commit boundary. It does not prove rollback after a delivery transaction has begun.

**Required correction:**

- Keep the current guard-rejection test but label it as pre-write validation only.
- Add a deterministic test-only fault-injection/failing-adapter or transaction-abort scenario that fails after the delivery write bundle has begun at the commit boundary. Exercise Memory and IndexedDB paths (including a real IndexedDB transaction abort/error path where supported).
- Assert that order/delivery state, recognized result, cash/collection, wallet allocation, inventory/material movement, and any derived references are either all absent/unchanged or the repository’s explicitly documented resumable outcome is returned. If the test exposes a partial-write defect, fix the commit boundary at its root; do not settle for stronger assertions around the earlier validator.
- Keep fault hooks test-only; do not add a production fault switch or weaken production behavior.

### `S12-TRANSFER-001 — MALFORMED_PRESENT_FOLLOWUP_EVENTS_SILENTLY_ERASED`

**Evidence:** `transferSnapshotMigrations.ts:42-53` converts a present non-array `order.followUpEvents` value to `[]`; later validation sees a valid empty array. A properly resealed current `33/40` or supported legacy transfer can therefore pass preparation after losing malformed-present event data.

**Required root correction:**

- Default only a genuinely absent/undefined optional field. Preserve a present malformed value so snapshot validation rejects it; do not sanitize, coerce, or erase malformed-present nested data.
- Add tests with valid envelope digest/counts and malformed `followUpEvents` values (at least string/object/null where the contract distinguishes them) for current `33/40` and a supported legacy pair. Prove rejection occurs before import preview/restore write and the target database/store remains byte/record-equivalent after rejection.

### `S12-TRANSFER-002 — RELEASED_PAIR_CHARACTERIZATION_OMITS_32_40`

**Evidence:** the explicit released-pair test list omits the S11 frozen legacy pair `[32, 40]`, although the authoritative runtime set and golden loop include it.

**Required correction:** add `[32, 40]` to the explicit characterization, keep list/count synchronized with the authoritative pair set, and explicitly prove it is accepted and normalized to current `33/40`. Do not remove or alter any other released pair.

### `S12-RECORD-001 — CURRENT_VS_HISTORICAL_40_32_WORDING`

The read-only review noticed `40/32` in the owner-accepted S09 security-exception record and the S05 re-anchor reason in the file-size-ratchet register, while current runtime is `40/33`. Do **not** blindly rewrite history, owner approval, re-anchor values, hashes, or baselines.

- For each exact occurrence, establish whether it states the current baseline or the historical baseline at that event. If historical, preserve the original value and add a minimal explicit historical qualifier/date where needed. If current-scoped, update only the factual current statement to `40/33` while preserving the historical `40/32` context and the original exception approval.
- Do not change exception status, accepted-by, scope, expiry, security policy, re-anchor hashes/limits, or numeric thresholds. If the surrounding record already makes the historical scope unambiguous, document `PRESERVE_BY_DESIGN` rather than altering it.
- Add the outcome and exact file/line evidence to the S12 review addendum; any text correction must be generated/validated under the repository’s document and security-record contracts.

Re-check every finding on the actual live head. If already fixed on an intervening commit, verify it and record the proof rather than redoing it. Keep each S12 code fix in S12-specific commits, separately from S12 addendum/Control and S13 commits. Do not claim S12 acceptance.

## 6. S13 scope and source authority — UNIT-006 / UNIT-012 / UNIT-018 / SH-17

Before S13 code, read the **current live** versions at the actual execution-start SHA; this prompt does not replace them:

- `01-STAGES.md` S13 card and `DEPENDENCIES-AND-TRACEABILITY.md` SH-17 ownership.
- UNIT-006 `P3.1–P3.6`, ORD-A through ORD-F, ORD-E acceptance list, B-DUP, decision-status and evidence sections.
- UNIT-012 `P3.1–P3.6`, approved `CAL-01`, A/B, `U012-ACD` acceptance sections, B-DUP, decision-status and evidence sections.
- UNIT-018 current P3/A/B, `U018-ACD` and read-only/source ownership clauses.
- Shared financial/data contract, shared acceptance cases, relevant approved decisions (including CAL-01 and owner-approved navigation/consistency decisions), financial/time/storage contracts, `AGENTS.md` routed packs, existing source/readers/writers, tests, and visual/RTL standards.

Implement the component-level approved new design and flows in those files; do not treat the old implementation as design authority. The approved screen/flow redesign is part of S13, but it does not authorize a global system redesign.

### Required product and ownership behavior

1. **Orders — UNIT-006:** provide the specified clear orders list and calendar entry/view structure from the same authoritative order sources. No duplicate order store, second order list with independent facts, or write-on-view behavior. Include the exact statuses, grouping, filters, search, due/return behavior, order details/entry points, and acceptance from current UNIT-006.
2. **Schedule and follow-up — UNIT-012:** list/month/week/day views come from the same schedule entries and recurrence sources. Preserve links to the owning order/expense and source version. A date-only appointment has no invented `00:00` time. Do not create a second schedule/calendar source or duplicate recurrences.
3. **Financial follow-up — UNIT-018:** integrate its financial reminders/receivable/payable follow-up as a reader over the owning financial sources. Keep due/appointment/reminder status distinct from actual receipt, payment, delivery, consumption, expense confirmation, profit, or settlement. Time passing, a list row, reminder, filter, or calendar display causes no financial write.
4. **Ownership:** reads, filtering, opening, refreshing, and switching list/calendar modes are read-only. Route any explicitly supported next action to the existing authoritative owner (including UNIT-010/011/026/015 as appropriate). Do not implement a second writer or confirm a recurring expense from the reminder view. Keep the recurring-expense owner’s operation at its existing boundary.
5. **Completeness and partial reads:** apply search/filter to the complete relevant source community before any presentation cap; show truthful totals/counts when a source is partially loaded; stale generation/period results must not be mixed with newer results (cover SDF-061 when the S13 reader uses that boundary). A source error must not be rendered as an empty successful source or hide other readable sources.
6. **Dates and states:** use the approved Amman/business-date rules and the exact date basis from the specs. `past/today/upcoming` is organizational only and must not move money. Preserve unknown vs known date/time, recurrence, cancellation, completion, delivered/returned, and financial source states. Returning after delivery/cancellation must show the actual source state, not resurrect an eligible action.
7. **Phone UX and RTL:** implement the UNIT A/B hierarchy for 320–430px phone widths, Arabic RTL, one primary scroll owner per screen unless the spec justifies an exception, usable focus/keyboard/back/return paths, long Arabic labels, and empty/loading/error/partial/success/conflict states. Use approved existing visual tokens and components; no broad reskin, desktop-dashboard layout, drag-and-drop, external confirmation messaging, or unapproved off-app reminders.
8. **Acceptance mapping:** map every current S13-owned UNIT-006/012/018 AC/ACD/DUP criterion and the relevant shared cases to durable tests/evidence. Include `SDF-013` explicitly: a future delivery date or expense reminder is organization only—no cash, material consumption, or expense commitment from time passing. Include `SDF-061` where generation/period consistency is in scope. Include `SDF-063` only where S13 actually crosses the recurrence writer boundary; otherwise mark `NOT_TRIGGERED_BY_S13` and state why. Do not mark planned, non-triggered, or later-stage criteria passed.

### Explicit exclusions

No schedule drag-and-drop; no external contact/confirmation or off-app reminders; no new calendar financial ledger; no auto-confirmation of a payment, delivery, expense, recurrence, or material use; no change to debt, collection, delivery, expense, cost, or revenue policy; no general reports/financial-summary redesign owned by S15; no new platform capability or new permanent store unless a current contract explicitly requires it and the full entity/compatibility path is completed.

## 7. Persistent data, compatibility, and security

- Measure and record the live schema/export pair and the exact current `schedule-entries`, `recurrences`, order, and financial-source shapes at execution start. Do not assume a prior version pair without checking.
- Current S12 wire baseline is `localSchemaVersion=40`, `localExportVersion=33`; the frozen legacy `[32,40]` pair remains accepted. Preserve all supported historical pairs and their rejection precedence. S13 is expected to require no schema/export change; prove unchanged if so.
- No schema/export bump for convenience. If a persistent shape or wire change is truly required by an approved S13 contract, complete the exact version decision, migration/defaults, Memory/IndexedDB parity, entity touchpoints, snapshot validation, every supported import/export/restore pair, malformed-data rejection before preview/write, no-write proof, and rollback evidence within this execution. Never lower versions or erase data on rollback.
- Do not create a new persistent source of truth for a derived view. Update `docs/quality/persistent-entity-touchpoints.json` for any genuinely new persistent entity and run its guard; otherwise record “no new persistent entity” with evidence.
- Do not alter security exception policy or accepted security records except for the narrow historical/current wording reconciliation defined in `S12-RECORD-001`.

## 8. Tests and quality gates

Do not rerun a full suite just to duplicate a passing run on unchanged code. Use current exact-SHA evidence for unchanged work; every new/changed code path must have focused tests and the final stable combined code tree must run the canonical full check.

### Fix-first focused coverage

- **S11:** model, application/domain writer-boundary, and UI/DOM tests for new confirmed debt identity (including zero writer calls on rejection, saved-party path, non-debt/review cases, and legacy unnamed existing debt), plus old-draft migration for `collectedEmpty`, partial, equality, and over-total raw preservation/no-write.
- **S12 idempotency:** both adapters; same intent reuse, changed effective payload conflict; concurrent same-key retries; no schedule/cash/order side effects on conflict.
- **S12 atomicity:** actual injected commit-boundary failure/transaction abort after the operation begins for Memory and IndexedDB; every affected source/store remains unchanged or returns the defined resumable result. Keep the prior pre-validation rejection test separate.
- **S12 transfers:** current `33/40` and supported legacy pair fixtures with valid resealed envelope integrity and malformed-present nested events; rejection before preview/write; target unchanged. Explicit released-pair characterization includes `[32,40]` and conversion to `33/40`.
- **S13:** all in-scope source projections and actions; list/month/week/day parity from one source; filters before caps and truthful totals; date-only schedule; past/today/upcoming no financial writes; source/partial/error isolation; stale generation/period rejection where applicable; repeat/reminder owner routing; delivered/cancelled return path; RTL/accessibility/phone states.

For all changed writes, test deterministic retry, changed payload, concurrent windows, stale source, rollback/failure, `outcome_unknown` where applicable, no incidental writes, and Memory/IndexedDB parity. Test exact integer minor-unit behavior and approved real dates; no float arithmetic or invented rounding.

### Required final local checks

1. Run focused tests after each coherent fix/slice.
2. On the final stable code candidate, run the repository’s canonical `pnpm check`; record exact command, exit code, counts, thresholds/measurements, environment, and full SHA.
3. Run all required repository/document/Control guards, including `python3 scripts/operations-control/validate.py`, `python3 scripts/operations-control/generate_tracker.py --check`, `node scripts/check-doc-index-coverage.mjs`, `node scripts/check-current-state-size.mjs`, `node scripts/check-agent-document-contract.mjs`, applicable transfer/entity/security/boundary/surface/text-density/file-size guards, and `git diff --check`.
4. Do not edit generated views by hand; do not raise surface anchors, lint warnings, test tolerances, text-density ceilings, file-size ratchets, or bundle budgets. Preserve raw/gzip ceilings `650000 / 155300`.
5. If any code changes after `pnpm check`, rerun affected focused tests and rerun the full canonical check on the new stable code tree.

## 9. Five sequential final read-only reviews

After the final combined S11 fixes + S12 fixes + S13 candidate exists, run five distinct **sequential, read-only** specialist reviews against the exact final diff. Reviewers do not edit. If ZAI supports subagents, use five separate reviewers one at a time; otherwise run five separate read-only passes and report that limitation honestly.

1. **S11 source/financial intent:** new debt identity boundary, historical unnamed debts, legacy draft over-collection, no hidden amount/name reinterpretation, regression quality.
2. **S12 idempotency and atomicity:** agreement payload equality/conflict at service and both adapters; SDF-040 true failure rollback in both adapters; no double cash or partial write.
3. **Transfer/security/compatibility:** malformed nested-event rejection, current/legacy pairs, 32/40 golden characterization, historical security-record wording, no-write restore, exact versions.
4. **S13 data ownership and date/financial correctness:** one authoritative source per order/schedule/financial event; no writes from time/view/reminder; no duplicate writer/ledger; Amman dates, source state, unknown values, SDF mapping.
5. **S13 Arabic phone UX/accessibility and architecture gate:** actual A/B component flow, 320–430px RTL, long labels, keyboard/focus/back/return, empty/loading/error/partial/stale states, no global reskin, no unapproved structural work.

For every newly confirmed in-scope finding: assign a stable ID; cite file/line and the governing contract; state root cause and impact; fix at the root; add permanent regression coverage; have the relevant reviewer reread; rerun affected focused tests and the required final check. Do not defer a real in-scope correctness defect as “future cleanup.” Preserve `PRESERVE_BY_DESIGN` items with evidence and distinguish them from open defects.

## 10. Commits, evidence, remote gates, and delivery

- Use separate stage/finding-specific commits: S11 fix code/tests; S11 addendum/Control; S12 code/tests; S12 addendum/Control; S13 claim/records; S13 implementation by coherent ownership slice; and final result/handoff. Do not mix S11/S12 repair commits with S13 product code. Never rewrite previously reviewed history.
- Append S11 and S12 review addenda and create `18-S13-RESULT-2026-11-01.md` (or the next unused ordered result name). The result must identify: prompt-publication/start/code/test/final SHAs; each finding status/evidence/fix/test; exact Control transitions and IDs; S13 ownership map and files by responsibility; all AC/ACD/DUP/SDF mapping; source-read/write boundaries; dates/financial examples; transfer/schema result; tests/commands/counts/exit codes and exact SHAs; five review outcomes and rereads; bundle/surface measurements; unresolved decisions/limitations; final PR and deployment links.
- Update JSON source records first, then generate tracker views. Update stage/progress/handoff, index, and Manifest as required. Update `current-state.md` only in the way its live contract permits; never make a branch-only result appear merged, current on `main`, or verified there. Append factual PR #383 delivery evidence; do not expose secrets.
- Keep S11 and S12 in truthful review-pending states and S13 delivered/review-pending at handoff. Never self-accept any stage, use `VERIFIED`, or claim merge/main status.
- Push only to `components/integration-20261027`. Wait for GitHub Actions and Cloudflare Pages to reach terminal success on the exact final remote SHA. Verify that each check/deployment identifies that same SHA and record the URLs. If a fix is needed, commit it on the same branch, rerun affected tests and required full check, then wait for both remote gates on the new exact head. Green on an earlier SHA is not final evidence.
- Keep PR #383 Draft. No `main` writes, merge, rebase, force-push, branch cleanup, second branch/PR, or secret in PR text.

## 11. Interruption, resume, and final response

If context, machine load, or an external service interrupts the run, preserve local and remote work and create a durable checkpoint with full current SHA, completed findings/stages, tests already run and their SHAs, dirty/unpushed files, Control state, and the single next action. Resume this exact order in the same conversation. Do not repeat completed work or discard anything. Do not stop after a repair, a passing local suite, S11, or S12; finish all safe in-scope S13 work and exact-head remote gates. If a true owner-only decision is the sole blocker, continue independent safe work and state only that exact blocker.

At delivery, provide a concise Arabic summary with links to both review addenda and the S13 result, plus:

```text
S11-LR-001 — <FIXED_AND_REGRESSION_PROVEN | ALREADY_PROTECTED_WITH_EVIDENCE | BLOCKED + exact reason>
S11-LR-002 — <FIXED_AND_REGRESSION_PROVEN | ALREADY_FIXED_ON_LIVE_HEAD | BLOCKED + exact reason>
S12-FIN-001 — <status + evidence>
S12-ATOMIC-001 — <status + evidence>
S12-TRANSFER-001 — <status + evidence>
S12-TRANSFER-002 — <status + evidence>
S12-RECORD-001 — <PRESERVE_BY_DESIGN or corrected, with historical/current explanation>
S11_ACCEPTANCE / S12_ACCEPTANCE — PENDING_INDEPENDENT_REVIEW_AND_OWNER
S13_EXECUTION — COMPLETE | REVIEW_REQUIRED (or BLOCKED + exact reason)
PROMPT_PUBLICATION_HEAD / EXECUTION_START_HEAD — full SHAs
S11_FIX / S11_ADDENDUM / S12_FIX / S12_ADDENDUM / S13_CODE / TESTED_HEAD / FINAL_HEAD — full SHAs
LOCAL_CHECK — exact command, counts, exit code, SHA
GITHUB_ACTIONS / CLOUDFLARE_PAGES — terminal status, exact final SHA, run/deployment URL
FIVE_REVIEWS — five ordered outcomes, fixes, and rereads
SCHEMA_EXPORT — exact current/legacy pairs, compatibility proof, or unchanged proof
CONTROL — IDs, legal transitions, truthful review-pending states
PR — #383 OPEN / DRAFT
NO_MAIN_WRITES / NO_MERGE / NO_REBASE / NO_FORCE_PUSH / NO_SECOND_BRANCH_OR_PR
```
