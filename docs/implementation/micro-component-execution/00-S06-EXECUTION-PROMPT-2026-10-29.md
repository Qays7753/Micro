# Z AI — S05 Contract Fixes Then S06 Complete Execution

## Mission

Continue the Micro component-execution program from the live single integration branch and the existing Draft PR.

You must do two things in one uninterrupted execution:

1. **First, fix the two confirmed S05 contract defects below, at their root, before doing any S06 implementation.**
2. **After those fixes are proven by focused regression tests and the required gates, execute S06 completely:** UNIT-015 (Financial Operations / Expenses) and UNIT-019 (Recurring Expense) within the exact scope of the canonical specifications and current contracts.

ZAI is the only product-code writer and execution agent. Manus is the independent reviewer after delivery. The owner controls stage acceptance and the eventual merge. This prompt authorizes you to continue from the S05 fixes directly into S06; do not wait for an intermediate Manus review, an owner confirmation, or a new chat message between the two parts.

Do not declare S05 accepted, do not declare S06 accepted, and do not merge anything. Deliver the branch in a truthful `REVIEW_REQUIRED` state with complete evidence for the independent review and owner decision.

Routine documentation corrections, generated Tracker updates, normal test failures, ordinary reviewer findings, and ordinary CI/Cloudflare retries are not stop conditions: diagnose, repair, rerun, and continue. Stop only for a genuine unresolvable contract/financial/security/data-integrity conflict, unavailable secure credentials, unsafe ancestry/worktree drift, or a gate that cannot be repaired without an owner decision. Use the repository's stop vocabulary and preserve a safe checkpoint in that case.

## Live baseline and write boundary

- Repository: `https://github.com/Qays7753/Micro`
- Only allowed branch: `components/integration-20261027`
- Only allowed PR: `https://github.com/Qays7753/Micro/pull/383`
- PR state: Draft; keep it Draft
- Base branch: `main`
- Last verified published head when this prompt was prepared: `7ff10d5d72c5db75eb4a32c46f95c35c02e2f7b7`
- Last verified `main`: `3584aa1d08cea3e0a00623b719fed7f991ce187f`
- S05 code candidate containing the confirmed defects: `bee053363d2c7e9ae2d92f8f0695508525414a5a`
- S05 documentation head above that candidate: `7ff10d5d72c5db75eb4a32c46f95c35c02e2f7b7`
- This prompt's publication commit is documentation only and must not be treated as S06 execution.

Verify every value live before writing. If the branch is a safe descendant of the published head, continue from the actual live head. If the branch has moved, re-anchor all evidence to the actual live head and preserve the new ancestry. If there is genuine ancestry drift, lost work, an unexpected writer, an uncommitted conflicting worktree, or an unsafe reset would be required, preserve all work and stop with `STATE_DRIFT`; never reset, force-push, rebase, overwrite, or guess.

Authorized write boundary:

- write commits only to `components/integration-20261027`;
- update only PR #383;
- never write `main`;
- never merge, rebase, force-push, delete branches, close the PR, or create another branch or PR;
- never rewrite accepted history;
- never clean up branches or unrelated files.

## Mandatory reading order

Read the live GitHub versions, not an old chat transcript:

1. `AGENTS.md` and all applicable instruction files.
2. `README.md`.
3. `docs/operations/current-state.md`.
4. `docs/operations/current-state-log.md` only when an append-only historical entry is required.
5. `docs/00-document-index.md`.
6. `docs/operations/agent-development-sop-v1.md`.
7. `docs/operations/agent-handoff-protocol-v1.md`.
8. `docs/operations/control/README.md`, schemas, and the generated active-work brief.
9. `docs/implementation/micro-component-execution/00-PROGRAM.md`.
10. `docs/implementation/micro-component-execution/01-STAGES.md`.
11. `docs/implementation/micro-component-execution/02-PROGRESS-AND-HANDOFF.md`.
12. `docs/implementation/micro-component-execution/10-S05-RESULT-2026-10-29.md`.
13. `docs/operations/control/items/DOC-014.json` and `docs/operations/control/workstreams/WS-230.json`.
14. `docs/implementation/micro-component-execution/02-SPECIFICATIONS/03-New-Design/UNIT-037-العملاء-والموردون.md`.
15. `docs/implementation/micro-component-execution/02-SPECIFICATIONS/03-New-Design/UNIT-015-تسجيل-العمليات-المالية.md`.
16. `docs/implementation/micro-component-execution/02-SPECIFICATIONS/03-New-Design/UNIT-019-تكرار-المصروف.md`.
17. `docs/implementation/micro-component-execution/02-SPECIFICATIONS/05-Data-and-Implementation/01-Current-vs-Approved-Components-AR.md`.
18. `docs/implementation/micro-component-execution/02-SPECIFICATIONS/05-Data-and-Implementation/02-Shared-Data-and-Financial-Contract-AR.md`.
19. `docs/implementation/micro-component-execution/02-SPECIFICATIONS/05-Data-and-Implementation/03-Shared-Data-Acceptance-Cases-AR.md`.
20. `docs/contracts/05-financial-p0-policies.md`.
21. `docs/contracts/06-financial-event-prototype-contract.md`.
22. `docs/contracts/08-expense-classification-prototype-contract.md`.
23. `docs/contracts/41-recurring-expense-reminders-contract.md`.
24. The current linked contracts for UNIT-004, UNIT-013B, UNIT-014, UNIT-020, UNIT-022, UNIT-024, UNIT-026, UNIT-027, UNIT-033, UNIT-037, and UNIT-044 only where the S06 source/reference relationship requires them.

GitHub is the operational source of truth. Google Drive is provenance only and is not an execution dependency. Do not wait for Drive or reproduce an old report when the live repository contains the canonical source.

## Existing S05 review findings — mandatory preflight fixes

The following findings were independently reproduced on the live S05 candidate with a focused probe on both the Memory and IndexedDB adapters. They are real contract/data-integrity defects, not documentation observations. They must be fixed before S06 code work begins.

### S05-MR-001 — broken saved-party references are accepted during import/restore

Current behavior confirmed on both Memory and IndexedDB:

- a current `40/32` snapshot contains a direct sale with a non-null `customerPartyId` that is absent from `counterparties`, or a supplier purchase with a non-null `supplierPartyId` absent from `counterparties`;
- `prepareImport` does not reject the snapshot before preview;
- the restore/confirmation path can proceed and write a source record carrying a party ID that has no saved party.

Root evidence in the current code includes the source-family validators and `transferSnapshotValidation.ts`: the snapshot builds the saved-party ID set, but does not enforce the cross-reference invariant for `customerPartyId` and `supplierPartyId`. Do not assume that shape validation or name snapshots provide referential integrity.

Required root fix:

- enforce the invariant in the shared import/restore validation path used by all relevant entry points, not only in a UI or one adapter;
- a non-null `customerPartyId` must resolve to a saved party in the imported `counterparties` family;
- a non-null `supplierPartyId` must resolve to a saved party in the imported `counterparties` family;
- `null` remains valid when the source contract permits an unlinked operation;
- archived saved parties remain valid identities if they are present in the imported family;
- do not infer or synthesize a party from a name, phone, amount, or source label;
- reject before preview/commit and prove that the target store is unchanged after rejection;
- preserve the existing error/rejection precedence unless a focused contract test proves that the current precedence is itself unsafe;
- do not change the export/import wire format, the `40/32` current versions, or historical source meaning merely to implement this guard.

Permanent regression evidence is mandatory for both Memory and IndexedDB and must cover at least:

1. direct sale with a missing `customerPartyId`;
2. supplier purchase with a missing `supplierPartyId`;
3. rejection before preview and no write after an attempted confirmation;
4. a valid linked source with an existing active party;
5. a valid linked source with an existing archived party if the current contract allows it;
6. an unlinked `null` reference that remains valid where the source contract allows it.

### S05-MR-002 — a fully paid supplier purchase without a supplier is wrongly rejected

The current UNIT-037/SDF-010 contract permits a fully paid supplier purchase with no saved supplier and no supplier name. The existing domain policy already permits this case, and S05's party tests cover creation, but the transfer-family validator still requires a non-empty `supplierName`.

Current confirmed failure on both Memory and IndexedDB:

- a valid purchase has `supplierName: null`, `supplierPartyId: null`, and `initialPaidMinor === totalMinor`;
- export can produce the record, but import preparation rejects it before preview;
- verified export/round-trip therefore fails for a valid contract case.

Required root fix:

- align `validSupplierPurchase` and the shared transfer/import/restore path with the current domain policy and SDF-010;
- permit `supplierName: null` and `supplierPartyId: null` for a fully paid purchase exactly where the current contract permits it;
- retain the current requirement for a meaningful supplier identity/reference when an unpaid obligation or other source rule requires one;
- do not accept arbitrary null/empty supplier data for an unpaid purchase by weakening validation;
- preserve `supplierPartyId` semantics, name snapshots, financial amounts, dates, and current wire format;
- prove `export → prepareImport → restore` for the valid fully paid/no-supplier case on both Memory and IndexedDB;
- prove that an invalid unpaid/no-supplier case remains rejected with the correct precedence;
- prove `createVerifiedExport` succeeds for the valid case and does not silently downgrade validation.

Do not solve either finding with a test-only exception, a UI-only check, a broad validator bypass, a tolerance increase, a guard removal, or a name-based fallback.

## Phase 0 — live preflight and ownership map

Before changing product code:

1. Verify the live branch, PR, base, exact head, ancestry, worktree, and existing commits.
2. Confirm there is no active competing writer and no uncommitted work to overwrite.
3. Read the current S05 result and Control records. Keep S05 truthful as `IN_REVIEW`; do not self-accept it.
4. Create or update the next unused S06 Control Item and Workstream identifiers only after inspecting the live repository. Do not guess, reuse, or edit generated views directly.
5. Build a concise owner/consumer map for:
   - saved party identity and source snapshots;
   - direct-sale and supplier-purchase source records;
   - import/restore validation and commit boundaries;
   - financial-event domain types/policies and canonical writer;
   - recurring series, rule revisions, occurrences, and their financial event;
   - Memory and IndexedDB adapters;
   - schema/export versions, migration registry, transfer validators, and touchpoint registry;
   - UI routes, application services, and source-of-truth readers.
6. Write a short phase-understanding record before the first S06 code line. It must state the user problem, scope, non-goals, invariants, expected failures, acceptance criteria, and rollback boundary. Store it where the live SOP/Control structure requires; do not invent a competing document system.

## Phase A — fix S05-MR-001 first

Implement the smallest root correction at the shared validation boundary. Add permanent tests before or together with the correction so the old behavior is characterized and the new invariant is explicit.

The acceptance condition is strict: a malformed cross-reference is rejected before preview and cannot mutate the target store, while valid linked, archived-linked, and valid null-unlinked records retain their existing behavior.

Use separate phase-labelled commits. Keep this finding's code/tests separate from S05-MR-002 and separate from S06 implementation. Do not rewrite the original S05 commits.

## Phase B — fix S05-MR-002 second

Implement the smallest root correction to the supplier-purchase transfer validator and any shared validation path it correctly owns. Derive the condition from the live domain policy and UNIT-037/SDF-010; do not invent a new financial rule.

The acceptance condition is strict: fully paid/no-supplier round-trip succeeds, unpaid/no-supplier remains rejected, and no amounts, dates, IDs, snapshots, or wire keys are changed.

Use a separate phase-labelled commit from S05-MR-001. Run both focused finding suites together after the second fix. Do not begin S06 until both findings have permanent regression coverage and pass on both adapters.

## S06 scope — UNIT-015 and UNIT-019 only

After the two S05 fixes pass, execute S06 completely. S06 owns:

- UNIT-015 — recording financial operations, with one canonical expense writer and the current approved financial boundaries;
- UNIT-019 — local recurring-expense reminders and explicit recording, without turning reminders into money;
- the direct shared contracts and acceptance cases named by those specifications;
- the required application, domain, storage, transfer, migration, UI, and test integration needed to make those contracts real.

S06 does not own S07 purchasing/inventory, S08 assets, S11 direct sale, S12 order delivery, S15 financial reporting/budgets, or a broad refactor. It may add the narrow adapter/reader contract needed for S06, but it must not build a second ledger or duplicate a neighboring writer.

## S06 non-negotiable financial and domain rules

Implement the current live contracts, not historical summaries:

- JOD amounts remain integer minor units; use the established rounding helpers and never introduce floating-point financial policy.
- A paid operating expense decreases recorded cash and increases recorded operating expense once.
- A payable operating expense increases the payable and recorded operating expense without changing cash.
- Settling an existing payable decreases cash and the payable but does not record the operating expense again.
- Personal withdrawal, owner investment, loan, purchase, inventory, asset, deposit, order payment, and customer collection retain their own source meanings and are not silently reclassified as an operating expense.
- A shared expense records only the project share in this current contract; do not invent a full-household invoice allocation, automatic order allocation, or a new accounting policy.
- `relationship`, `behavior`, `purpose`, `knowledge`, category, source reference, and dates retain their contract meanings. `estimated`, `incomplete`, `needs_review`, and unknown are not silently converted to zero or known.
- Existing source-owned financial events remain the source of truth. Do not create a parallel expense ledger.
- A saved party name is not a financial reference by itself. If S06 offers a party selector, use the stable ID and preserve the S05 reference invariant.
- A recurring reminder is not a financial event, payable, debt, cash movement, or expense merely because its due date has arrived.
- No automatic recording at due time, no debt from lateness, no automatic payment, no automatic backfill after pause, and no hidden financial write from opening a reminder or list.
- A recurring series, rule revision, occurrence, and FinancialEvent are distinct concepts. A recorded event is created only after explicit review and confirmation through the canonical financial writer.
- `dueOn`, `occurredOn`, and `confirmedAt`/`recordedAt` are distinct. Use `businessTime` and `Asia/Amman` as required by the live contract; do not replace them with browser-local or UTC-prefix arithmetic.
- The deterministic recurring operation key must prevent duplicate events. Replaying the same key with the same payload returns the existing result; the same key with a different payload is an idempotency conflict with no overwrite.
- `recorded`, `reused`, `record_failed`, and `result_unknown` are different outcomes. Do not turn an unknown outcome into a blind retry with a new key or claim failure when the result is unknown.
- A successful event plus failed later cash attribution is a truthful partial result; retry the attribution only with its own deterministic key and never record the financial event again.
- Skipping or snoozing a recurring occurrence writes no financial event and no zero amount. Cancellation/archiving must not delete historical financial events.
- Future rule changes create a new immutable revision and must not rewrite already decided occurrences or past financial events.
- For short months, implement only the current contract's explicit `last_valid_day`, `skip`, and `ask` behavior. Do not invent a fourth policy.
- Do not activate unsupported recurrence types, cloud sync, push notifications, multi-user behavior, budgets, taxes, inventory allocation, or a general ledger.

## S06 implementation boundaries

Preserve the established architecture:

`UI → Application → Domain → Storage Port → Memory/IndexedDB`

The UI must not own financial policy, idempotency, migration, or direct storage calls. The canonical financial writer must remain the single owner of the event effect. The recurring layer must call that writer rather than reimplementing event math.

Inspect the current code before editing. Likely affected surfaces include, but are not limited to:

- `src/domain/financial-event/`;
- `src/domain/recurring-expense/`;
- `apps/prototype-web/client/src/application/finance/`;
- `apps/prototype-web/client/src/application/financial-records/`;
- `apps/prototype-web/client/src/application/recurring/`;
- `apps/prototype-web/client/src/pages/FinancialEventEditor.tsx`;
- `apps/prototype-web/client/src/pages/RecurringExpenseEditor.tsx`;
- `apps/prototype-web/client/src/pages/RecurringExpenseDetail.tsx`;
- `apps/prototype-web/client/src/RecurringExpenseEditor.dom.test.tsx`;
- `apps/prototype-web/client/src/RecurringExpenseSurfaces.dom.test.tsx`;
- `apps/prototype-web/client/src/application/finance/financialEventEditorModel.test.ts`;
- `apps/prototype-web/client/src/application/recurring/recurringExpenseService.test.ts` and `recurringExpenseService.fin006.test.ts`;
- `apps/prototype-web/client/src/storage/local/IndexedDbLocalStore.recurringExpense.test.ts`;
- `apps/prototype-web/client/src/storage/local/adapterConformance.recurringExpense.test.ts`;
- `apps/prototype-web/client/src/storage/local/capabilities/financialEventCapability.contract.test.ts`;
- `apps/prototype-web/client/src/storage/local/capabilities/recurringExpenseCapability.contract.test.ts`;
- `apps/prototype-web/client/src/storage/local/recurringExpenseCommitGuard.test.ts`;
- `apps/prototype-web/client/src/application/transfers/localTransferService.recurringExpense.test.ts`;
- `tests/domain/financial-event.test.ts` and `tests/domain/recurring-expense.test.ts`;
- migration, transfer, touchpoint, route, and current-state files that the live code proves are affected.

These are navigation leads, not permission to modify every file. Do not perform bulk moves, introduce a new `features/` layer, split oversized files, or perform structural refactoring. If a structural change appears necessary, keep the smallest safe local change or record it as a `DEFER` with evidence; do not expand this prompt into a refactor wave.

If S06 introduces a durable entity or local store, update `docs/quality/persistent-entity-touchpoints.json` in the same phase with both adapters, tests, transfer behavior or a precise documented exception, compatibility, and documentation. Do not use `LocalPreferences` for financial meaning.

## Required S06 behavioral coverage

Add or update real tests, not mock-only claims. At minimum cover:

### UNIT-015 / financial operations

- simplest paid operating expense with valid amount, description, date, and source context;
- payable operating expense and later partial/full settlement without a second expense;
- cancellation before save with no financial write;
- paid versus payable preview changing intent only, not writing hidden effects;
- shared expense recording only the project share with truthful knowledge;
- fixed, percentage, and deferred shared-expense paths according to the currently approved decision boundary, without inventing unsupported compound behavior;
- invalid amount, unsafe amount, invalid date, missing description, invalid category/context, invalid source, and invalid wallet states;
- source/reference validation and rejection before write;
- duplicate submit, repeated click, reload, unknown result, partial result, and retry behavior;
- same idempotency key with same payload returns/reuses the original event;
- same key with different type or payload returns `idempotency_conflict` with no overwrite;
- two concurrent settlement windows cannot settle more than the live remaining balance;
- source correction/reversal remains with the source owner and does not create a second expense;
- historical dates and snapshots remain unchanged through reload/export/import/restore;
- old events without new optional context remain readable and are not silently reclassified;
- Arabic RTL, mobile portrait, keyboard, focus, zoom/text-size, labels, errors, loading, confirmation, and truthful result messaging.

### UNIT-019 / recurring expense

- manual expense without recurrence creates one event and no series;
- selecting then cancelling recurrence before save does not activate a series;
- record-now-plus-monthly-reminder creates one event and one recurrence identity, without a second current reminder recording;
- reminder-only creates no financial event, no debt, and no zero event;
- explicit review and confirmation create the event only through the canonical writer;
- same occurrence confirmed twice concurrently produces one event and an honest `reused` result;
- same deterministic key with different amount/type fails safely without overwrite;
- `record_failed` and `result_unknown` are distinct and recoverable without a new blind key;
- occurrence states and illegal transitions are rejected without partial writes;
- snooze changes attention only; skip writes no financial event and preserves the before/after financial snapshot;
- series activation, pause, resume, cancellation, archive, and restore preserve historical decisions and do not backfill money automatically;
- future rule revision does not rewrite decided/past occurrences and takes effect only where the contract permits;
- due day 28/29/30/31 across short months exercises `last_valid_day`, `skip`, and `ask` exactly;
- `dueOn`, `occurredOn`, and `confirmedAt`/`recordedAt` remain separate and use the canonical business-time implementation;
- manually recorded expense in the same period is not automatically merged or blocked solely by matching month/amount;
- linked existing event behavior, if the current implementation supports it, uses stable source identity and cannot create a second event;
- Memory/IndexedDB adapter conformance, idempotency, stale-state/CAS behavior, export/import/restore, migration, and failure recovery;
- Arabic RTL mobile DOM flows, long text, keyboard and screen-reader labels, focus, loading, empty, error, unknown, partial, recorded, reused, and cancellation states.

Do not claim every historical acceptance ID is executed merely because a specification lists it. Map each executed test to its exact ID, mark unexecuted or unavailable evidence honestly, and do not expand into decisions explicitly deferred by the contracts.

## Data, migration, export, and compatibility gate

Before changing any durable shape:

1. Determine the actual live `localSchemaVersion` and `localExportVersion` and the current accepted pairs. The live S05 baseline is `40/32`; do not copy stale historical numbers from UNIT-019.
2. Decide from the current code and contract whether S06 requires a new store or durable fields. Do not bump a version merely for a UI rename.
3. If a bump is required, update domain/types, Memory, IndexedDB upgrade path, transfer/export/import/restore validators, migration registry, compatibility tests, golden fixtures, persistent-entity touchpoints, and documentation together. Keep all previously accepted pairs required by the live compatibility contract.
4. Prove old supported snapshots open safely and that unsupported or malformed files are rejected before any destructive write.
5. Prove export/import/restore preserves money, event identity, occurrence identity, rule revisions, source references, dates, knowledge states, idempotency keys, and historical snapshots without replaying financial effects.
6. Prove import rejection for broken S05 party references remains enforced after any S06 transfer changes.
7. Do not change wire-format keys, rejection precedence, financial dates, or current versions unless the complete compatible implementation and regression evidence exists.
8. Record the exact final pair and every accepted legacy pair in the result report. Never claim “no migration impact” without checking the actual transfer paths.

## Test and gate protocol

Run focused tests after each coherent checkpoint and keep going; do not wait for a review message between checkpoints. At minimum inspect and run the relevant existing suites around:

- S05 transfer validation and counterparties;
- `localTransferService.prepareImport.rejection.test.ts`;
- `localTransferService.counterparties.test.ts`;
- `transferFamilyValidators.characterization.test.ts`;
- `localTransferService.schema32.test.ts` and all directly affected schema/export tests;
- financial event model, UI, guided UI, domain, capability, and IndexedDB tests;
- recurring service, recurring DOM, recurring capability, commit guard, adapter conformance, IndexedDB, and transfer tests.

Use the repository's actual package scripts and record the exact command, exit code, test count, environment, and SHA. Do not invent command results. After the final code candidate is stable, run the canonical full check once:

```bash
pnpm check
```

Run the required control/document checks as applicable, with JSON sources first and generated views only through the generator:

```bash
python3 scripts/operations-control/validate.py
python3 scripts/operations-control/generate_tracker.py
python3 scripts/operations-control/generate_tracker.py --check
node scripts/check-doc-index-coverage.mjs
node scripts/check-current-state-size.mjs
node scripts/check-agent-document-contract.mjs
git diff --check
```

Do not weaken a guard, raise a tolerance, increase a warning/bundle ceiling, disable a test, add `.skip`/`.only`, or change CI policy to make a gate green. Fix the cause.

## Five sequential read-only reviewers

After the final S06 candidate is implemented and the full relevant checks pass, run exactly five distinct sequential read-only reviewers. One writer only; reviewers do not edit files.

1. **Architecture and ownership:** layer direction, canonical writers, module boundaries, duplication, source-of-truth, public doors, and structural-scope compliance.
2. **Domain/data/storage:** financial deltas, recurring state machine, idempotency, concurrency, CAS, source references, snapshots, migration, export/import/restore, Memory/IndexedDB parity, and rollback safety.
3. **UI/runtime/accessibility:** Arabic RTL, mobile portrait, states, navigation, focus, keyboard, cancellation, repeated actions, unknown/partial results, and truthful error/status channels.
4. **Tests/CI/security/operations:** real behavior coverage, focused regressions, full check, secrets, dependency/security posture, bundle/lint guards, exact-head CI, Cloudflare, and operational records.
5. **Documentation/product contract:** UNIT-015/019 traceability, SDF/AC evidence, Control JSON, generated Tracker, current-state size, provenance, limitations, and handoff consistency.

Every finding must include a stable ID, exact evidence, impact, classification (`FIX_NOW`, `PRESERVE`, `DEFER`, or `OUT_OF_SCOPE`), root correction or protected trigger, tests, acceptance criteria, and rollback boundary. Fix every confirmed in-scope finding at its root on the same branch and PR, add focused regression coverage, rerun affected checks, and have the relevant read-only reviewer reread the corrected diff. Do not hide a real defect as a generic defer.

## Commit and history rules

- Keep S05-MR-001 fix, S05-MR-002 fix, S06 implementation, reviewer corrections, and documentation/Control updates distinguishable in phase-labelled commits.
- Do not mix unrelated cleanup or bulk moves into any commit.
- Do not rewrite earlier S05/S04/S03 history.
- Do not write a self-referential SHA into the commit being created; record the final SHA afterward in the result and PR evidence.
- Do not edit generated Tracker views manually.

## Operations Control, result, and handoff requirements

Before product-code changes, create/update the correct S06 JSON Control Item and Workstream using the next unused identifiers discovered live. Include the branch, PR, base SHA, current head, scope, contracts, findings, rollback boundary, and ownership. Keep S05's current review status truthful; record the two findings as fixed-delivered but still pending independent review/owner acceptance.

At the end, update JSON sources first and regenerate official views. Update only the records required for this execution:

- S05 result/addendum or linked finding record for `S05-MR-001` and `S05-MR-002`;
- S06 Control Item and Workstream;
- S06 result report;
- `02-PROGRESS-AND-HANDOFF.md`;
- `docs/operations/current-state.md` within its size guard;
- append-only current-state log and sequential worklog where required;
- document index/Manifest if the new prompt/result requires it;
- PR #383 description or checkpoint comment with exact final evidence.

The result report must contain:

1. live starting head, base SHA, ancestry, and worktree state;
2. exact evidence and root fixes for S05-MR-001 and S05-MR-002;
3. S05 fix commits and S06 code candidate SHA;
4. final documentation head SHA;
5. changed files grouped by each S05 fix, S06 domain/application/storage/UI work, reviewer corrections, and documentation;
6. owner/consumer/source-of-truth map;
7. financial, date, schema, export, import, restore, migration, and compatibility impact;
8. exact focused and full commands, exit codes, counts, environment, and SHA;
9. exact GitHub Actions and Cloudflare evidence for the exact final pushed head;
10. five reviewer results and every finding/correction;
11. Control/Workstream states and generated Tracker status;
12. what is verified, unverified, deferred, preserved, and out of scope;
13. the exact safe resume point only if a genuine blocker remains;
14. explicit statement that no `main` write, merge, rebase, force-push, branch deletion, or second PR occurred.

Distinguish clearly between:

- S05 fix code candidate;
- S06 code candidate;
- final documentation head;
- locally tested SHA;
- GitHub Actions SHA;
- Cloudflare deployment SHA;
- reviewer status;
- owner acceptance status;
- merge status.

## Secure credentials

Use only the GitHub and Cloudflare credentials already available through the editor's secure credential fields. Never request, print, echo, store, commit, comment, or report a token, token prefix, cookie, authorization header, or private credential value. Do not place a token in this prompt, a commit, a PR comment, a log, or a result report. If the secure credential channel is unavailable, preserve work and stop with `CREDENTIAL_CHANNEL_UNAVAILABLE`.

## Final delivery contract

Do not stop after the two S05 fixes. Continue into S06 in the same execution unless a genuine blocker defined above occurs. Do not stop for routine findings, ordinary failing tests, generated-document corrections, or the absence of an intermediate reviewer message.

When all authorized work is complete, the final delivery must end with exactly this block, replacing the placeholder with the real full final documentation head SHA:

```text
S05_CONTRACT_FIXES_DELIVERED — S05-MR-001,S05-MR-002 — REVIEW_REQUIRED
S06_EXECUTION_COMPLETE — REVIEW_REQUIRED
PR_READY_FOR_INDEPENDENT_REVIEW — <FULL_FINAL_DOCUMENTATION_HEAD_SHA>
NO_MAIN_WRITES_PERFORMED
NO_MERGE_PERFORMED
NO_REBASE_PERFORMED
NO_FORCE_PUSH_PERFORMED
NO_BRANCH_CLEANUP_PERFORMED
NO_SECOND_BRANCH_OR_PR_CREATED
NO_REPOSITORY_WRITES_OUTSIDE_ALLOWED_BRANCH
```

If a genuine blocker remains, finish with exactly:

```text
EXECUTION_BLOCKED — <EXACT_BLOCKER_ID_AND_REASON>
S05_CONTRACT_FIXES — <COMPLETE_PARTIAL_OR_NOT_STARTED>
S06_STATUS — <COMPLETE_PARTIAL_OR_NOT_STARTED>
SAFE_CHECKPOINT — <FULL_SHA>
NO_MAIN_WRITES_PERFORMED
NO_MERGE_PERFORMED
NO_REBASE_PERFORMED
NO_FORCE_PUSH_PERFORMED
NO_BRANCH_CLEANUP_PERFORMED
NO_SECOND_BRANCH_OR_PR_CREATED
NO_REPOSITORY_WRITES_OUTSIDE_ALLOWED_BRANCH
```

The final state is ready for independent review and explicit owner acceptance on the integration branch. It is not a merge authorization and is not `VERIFIED_ON_MAIN`.
