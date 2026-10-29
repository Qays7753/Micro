# Z AI — S06 Review Fix Then S07 Complete Execution

## Mission

Continue the Micro component-execution program from the live single integration branch and the existing Draft PR.

You must perform one uninterrupted execution with two ordered parts:

1. First, verify and fix the confirmed S06 review finding below at its root, before starting S07 product work.
2. After the fix is proven, execute S07 completely for UNIT-027 (Purchasing) and UNIT-028 (Optional Inventory / Materials), within the canonical specifications and the live shared contracts.

ZAI is the only product-code writer and execution agent. Manus is the independent reviewer after delivery. The owner controls stage acceptance and the eventual merge. This prompt authorizes you to continue from the S06 review fix directly into S07; do not wait for an intermediate Manus review, an owner confirmation, or a new chat message between the two parts.

Do not declare S06 accepted, do not declare S07 accepted, and do not merge anything. Deliver the branch in a truthful `REVIEW_REQUIRED` state with complete evidence for independent review and owner decision.

Routine documentation corrections, generated Tracker updates, ordinary test failures, ordinary reviewer findings, and ordinary CI/Cloudflare retries are not stop conditions: diagnose, repair, rerun, and continue. Stop only for a genuine unresolvable contract/financial/security/data-integrity conflict, unavailable secure credentials, unsafe ancestry/worktree drift, or a gate that cannot be repaired without an owner decision. Use the repository stop vocabulary and preserve a safe checkpoint if that occurs.

## Live baseline and write boundary

- Repository: `https://github.com/Qays7753/Micro`
- Only allowed branch: `components/integration-20261027`
- Only allowed PR: `https://github.com/Qays7753/Micro/pull/383`
- PR state: Draft; keep it Draft
- Base branch: `main`
- Last verified published head when this prompt was prepared: `e1dd31eae4639853211d03f888b98b2cf44eaa63`
- Last verified `main`: `3584aa1d08cea3e0a00623b719fed7f991ce187f`
- S06 code candidate reviewed by the delivery report: `0a728d146fd3cabe5c5abfbdc3ccd647574a8e52`
- S06 final documentation/anchoring lineage is above that candidate and is represented by the live head stated above; verify the exact ancestry live before writing.
- This prompt's publication commit is documentation only and is not S07 execution.

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
12. `docs/implementation/micro-component-execution/11-S06-RESULT-2026-10-29.md`.
13. `docs/implementation/micro-component-execution/10a-S05-ADDENDUM-2026-10-30.md` if present at the live head.
14. The live S06 Control Item and Workstream discovered from the records; do not guess identifiers.
15. `docs/implementation/micro-component-execution/02-SPECIFICATIONS/03-New-Design/UNIT-027-المشتريات.md` in full.
16. `docs/implementation/micro-component-execution/02-SPECIFICATIONS/03-New-Design/UNIT-028-المواد-والمخزون.md` in full.
17. `docs/implementation/micro-component-execution/02-SPECIFICATIONS/05-Data-and-Implementation/01-Current-vs-Approved-Components-AR.md` for the affected rows and ownership map.
18. `docs/implementation/micro-component-execution/02-SPECIFICATIONS/05-Data-and-Implementation/02-Shared-Data-and-Financial-Contract-AR.md` for the relevant sections.
19. `docs/implementation/micro-component-execution/02-SPECIFICATIONS/05-Data-and-Implementation/03-Shared-Data-Acceptance-Cases-AR.md` for every SDF used in the result.
20. The live financial, storage, inventory, supplier-purchase, asset, transfer, and recurring contracts required by the actual affected code, using the repository's CORE+FIN and CORE+STORAGE reading boundaries.
21. The current tests and source implementation before editing. Treat path lists in specifications as navigation leads, not permission to modify every listed file.

GitHub is the operational source of truth. Google Drive is provenance only and is not an execution dependency. Do not wait for Drive or reproduce an old report when the live repository contains the canonical source.

## Phase 0 — live preflight and ownership map

Before changing product code:

1. Verify the live branch, PR, base, exact head, ancestry, worktree, and existing commits.
2. Confirm there is no active competing writer and no uncommitted work to overwrite.
3. Keep S06 truthful as `IN_REVIEW`; do not self-accept S06.
4. Discover the next unused S07 Control Item and Workstream identifiers from the live JSON sources. Do not guess, reuse, or edit generated views directly.
5. Create/update the S07 ownership record before product-code edits, with the actual base SHA, current head, branch, PR, scope, contracts, findings, owner/consumer map, and rollback boundary.
6. Write a concise S07 phase-understanding record in the repository's existing Control/SOP location before the first S07 code line. It must state:
   - the user problem and decision question;
   - exact scope and explicit non-goals;
   - financial, data, source, time, and unit invariants;
   - expected failure and unknown-result states;
   - acceptance criteria and required evidence;
   - the last safe rollback boundary and data-compatibility limit.
7. Build the owner/consumer/source-of-truth map for:
   - purchase header, optional purchase lines, payments, payable balance, receipt state, and correction history;
   - supplier identity and optional saved-party reference;
   - material identity, tracking preference, units, quantity, valuation knowledge, movements, shortages, waste, and corrections;
   - canonical financial writers and canonical period/summary readers;
   - cash-place attribution and supplier payment ownership;
   - Memory and IndexedDB adapters;
   - schema/export versions, transfer validators, migrations, touchpoint registry, and snapshot relationships;
   - UI routes, application services, domain modules, public doors, and tests.

## Confirmed S06 review finding — mandatory preflight fix

### S06-MR-001 — owner-part confirmation can become stale after the current financial input changes

The S06 delivery report records a deferred concern that the explicit owner-part confirmation for a shared bill is not sufficiently bound to the current derived financial value. The current flow derives the owner contribution from the canonical shared-bill inputs, but the confirmation state can remain present when the relevant project share, paid amount, or other owner-part input changes before the final save. This risks accepting an old confirmation for a new financial amount.

Treat this as an in-scope contract/integrity finding, not as a cosmetic UI issue.

Required root fix:

- Inspect the live S06 implementation and reproduce the exact stale-confirmation path using the current domain/application writer and the real form model.
- Bind the confirmation to the canonical derived owner-part value and the complete current intent inputs that determine whether the confirmation is required. Prefer a deterministic value/intent fingerprint or an equally strong existing project pattern; do not invent a second financial calculation in React.
- If any input that changes the required owner-part confirmation changes, invalidate the prior confirmation before the write. The final application/domain write boundary must reject an unconfirmed changed value even if the UI is bypassed.
- Keep the current approved financial meaning unchanged: the project share remains the project share; an explicitly confirmed owner part remains an owner withdrawal; no new allocation or accounting policy may be invented.
- Preserve the existing no-owner-part path: when no extra owner contribution is required, no unnecessary confirmation is introduced.
- Preserve `paidAmountMinor` validation, the canonical writer, idempotency, partial-result behavior, unknown-result behavior, and existing rejection precedence.
- Add permanent regression coverage for at least: unchanged confirmed intent succeeds; changing the project share invalidates confirmation; changing the paid amount/derived owner part invalidates confirmation; replay with the same unchanged intent remains idempotent; bypassing the UI cannot write a changed unconfirmed owner part; both Memory and IndexedDB behavior remain equivalent where the write path is durable.
- If the live head already contains an equivalent root protection, do not duplicate it. Prove it with focused tests and record the evidence as `PRESERVE` rather than changing semantics.

Do not solve this with a UI-only reset, a broader confirmation bypass, a tolerance increase, a test-only exception, a new financial rule, or a second ledger.

Use a separate phase-labelled commit for this S06 correction. Do not rewrite S06 history and do not mix it with unrelated S07 work.

After this correction, run its focused regression suite and the existing S05/S06 financial and transfer tests that the changed path can affect. Continue directly into S07 when the evidence is green; do not wait for a reviewer message.

## S07 scope — UNIT-027 Purchasing and UNIT-028 Optional Inventory / Materials

After S06-MR-001 is proven, execute S07 completely. S07 owns:

- `UNIT-027` — one canonical supplier purchase, optional purchase lines, explicit payments, payable balance, optional supplier identity, explicit receipt, correction/restore behavior, and the current approved financial boundaries;
- `UNIT-028` — optional per-material tracking, material movements, quantity and unit semantics, valuation knowledge, explicit usage/waste/count/correction flows, and the approved recognition/coverage boundaries;
- the direct shared contracts and acceptance cases named by those specifications;
- the required domain, application, storage, transfer, migration, UI, and test integration needed to make those contracts real;
- exact Memory/IndexedDB parity and truthful local-first recovery behavior.

S07 does not own or activate:

- UNIT-034 asset accounting beyond the narrow source/reference integration required to keep an asset purchase distinct;
- UNIT-005/UNIT-011 automatic consumption from sale or delivery;
- UNIT-008/UNIT-029/UNIT-031 automatic recipes, product inventory, or pricing-derived financial writes;
- UNIT-013/UNIT-016/UNIT-017/UNIT-013B/S15 reporting writers or a second summary/ledger;
- UNIT-041 Market ordering, cart, payment, messaging, or cloud behavior;
- cloud sync, authentication, authorization, multi-user behavior, SaaS, push notifications, or server-side inventory;
- broad refactoring, bulk moves, a new `features/` layer, or splitting oversized stores/services.

If a neighboring contract must be touched, change only the smallest source-owned adapter/reader/writer boundary required by S07, preserve its owner, test the integration, and document why the neighboring surface was touched. Do not rebuild the neighboring component.

## S07 non-negotiable product, financial, and data rules

Implement the live contracts, not a historical summary:

- A purchase is one real purchase. Do not create one purchase or invoice per material, one expense per payment, or a second financial event for the same fact.
- Purchase header, optional lines, payments, payable balance, receipt state, source references, and corrections retain distinct meanings.
- Payment reduces cash and payable for the eligible purchase only. Payment does not silently create a second operating expense, inventory receipt, sale, or asset.
- A purchase with no saved supplier is valid when the live contract permits it, including the fully paid/no-supplier case established by UNIT-037/SDF-010. An unpaid obligation must retain a meaningful supplier identity/reference according to the live validator and contract; do not weaken that rule.
- Saved supplier identity uses the stable party ID. A historical supplier-name snapshot is display history, not a substitute for a broken ID and not permission to merge parties by name.
- Purchase receipt is explicit. Payment does not imply receipt, and receipt does not imply payment.
- A purchase of an asset remains an asset-source fact; it is not silently reclassified as a materials expense or a generic operating expense.
- Material tracking is optional per material. A user who does not want to track every small use must not be forced to create a material, quantity, or per-cup movement merely to record a purchase.
- A non-tracked material follows the approved current recognition/coverage contract; do not add a second expense or deduct it again from a recipe, sale, order, or delivery.
- A tracked material records explicit receipt/use/waste/count/correction movements with source identity, unit, quantity, date, valuation knowledge, and coverage. A saved definition or pricing estimate is not an inventory movement.
- Count is measurement. A count difference is not automatically usage, waste, loss, or a financial adjustment. Unknown valuation is not zero and must not be presented as known.
- Do not sum incompatible units such as `kg` and `piece`, and do not infer a weight conversion from a cup, amount of money, or a name.
- Do not create a financial loss merely because a value is unknown or a quantity is untracked. Do not turn rounding into fictitious waste.
- Use integer minor units for JOD money and the repository's established safe arithmetic/helpers. Do not introduce floating-point financial policy.
- Preserve `occurredOn`, `recordedAt`, `effectiveOn`, and historical snapshots as distinct where the contract requires them. Never use `updatedAt` or browser-local arithmetic as a historical business date.
- Every sensitive write validates the live state inside its write boundary and rejects stale/conflicting state without a blind overwrite. Every retryable sensitive operation has a deterministic operation key and honest `recorded`, `reused`, `conflict`, `failed`, or `result_unknown` outcome.
- A successful purchase/receipt/payment/movement must not be duplicated because a later enrichment, cleanup, navigation, or reload failed. Resolve unknown outcomes before retrying and never use a new key to bypass uncertainty.
- Corrections and reversals preserve the original fact, mirror, reason, source IDs, dates, coverage, and knowledge. They must not replay cash, payment, receipt, or cost silently.
- Existing historical snapshots and source references remain stable through export/import/restore. Do not merge or repair identities by name during import.
- `MemoryLocalStore` and `IndexedDbLocalStore` are both production-relevant conformance targets; a green Memory-only test is insufficient.

## S07 implementation boundaries

Preserve the established architecture:

`UI → Application → Domain → Storage Port → Memory/IndexedDB`

The UI must not own financial policy, stock valuation, import validation, migration, idempotency, or direct storage calls. Domain policy stays in the appropriate pure domain family. Application services own orchestration. Storage ports own atomic/CAS boundaries. Memory and IndexedDB implement the same contract.

Inspect the live code before editing. Likely affected surfaces include, but are not limited to:

- `src/domain/supplier-purchase/`;
- `src/domain/inventory-material/`;
- `src/domain/financial-event/` and the canonical financial writers/readers only where S07 integration requires them;
- `src/domain/asset/` only for a narrow source distinction if proven necessary;
- `apps/prototype-web/client/src/application/suppliers/`;
- `apps/prototype-web/client/src/application/inventory/`;
- `apps/prototype-web/client/src/application/finance/` and `financial-records/` only for owned readers/integration;
- `apps/prototype-web/client/src/pages/Suppliers.tsx`;
- `apps/prototype-web/client/src/pages/SupplierPurchaseEditor.tsx`;
- `apps/prototype-web/client/src/pages/InventoryMaterials.tsx` and the existing material/movement editors;
- `apps/prototype-web/client/src/storage/local/` supplier, inventory, transfer, migration, and capability boundaries;
- `src/domain/` and application tests for supplier purchase, inventory materials, financial readers, and source corrections;
- `apps/prototype-web/client/src/application/transfers/` and snapshot validators if durable S07 data changes;
- `docs/quality/persistent-entity-touchpoints.json`, route contracts, current-state, Control, and documentation only where the live diff proves they are affected.

These are navigation leads, not permission to modify every file. Do not perform bulk moves, introduce a new layer, split `IndexedDbLocalStore`/`MemoryLocalStore`/large services, or reorganize code during S07. The post-Group-6 structural gate forbids structural refactoring here. If a structural change appears necessary, keep the smallest safe local change or record a specific `DEFER` with evidence and rollback boundary; do not turn S07 into a structure wave.

Do not remove Memory because it looks duplicated. Do not alter allowlists, baselines, warning ceilings, bundle ceilings, or guards to hide a violation. Do not create a parallel writer or a parallel source of truth. Use existing public doors and extension patterns; add a public door only when the live architecture requires it and update its exact guard with evidence.

If a durable entity, store, field, movement, purchase line, payment, or transfer shape changes, update all required domain types, both adapters, migrations, transfer/export/import/restore validators, compatibility tests, golden fixtures, persistent-entity touchpoints, documentation, and rollback evidence in the same phase. A new field alone is not a complete data implementation.

## Required S07 behavioral coverage

Add or update real tests, not mock-only claims. Map every executed test to its exact acceptance ID and report unexecuted evidence honestly.

### UNIT-027 / Purchasing

At minimum cover:

- simplest paid purchase with valid description, amount, date, and no saved supplier when the live contract permits it;
- fully paid/no-supplier `supplierName: null` and `supplierPartyId: null` export → prepareImport → restore → confirmImport → re-export round trip;
- unpaid purchase with meaningful supplier identity and stable party reference;
- unpaid/no-supplier rejection before write with the live rejection precedence;
- supplier selection by stable ID, historical name snapshot preservation, archived-party identity behavior where allowed, and no name-based party merge;
- one purchase with optional lines rather than duplicate purchases or invoices;
- line totals, whole-purchase totals, integer minor-unit arithmetic, safe bounds, and rejection of inconsistent/negative/unsafe values;
- partial and full payments: cash and payable deltas exactly once, no second expense, no duplicate payment on repeated submit;
- payment date and source/place attribution preserve their meaning and can be corrected only through the source-owned path;
- payment does not imply receipt; receipt does not imply payment;
- optional material association and explicit receipt with a purchase line, including no receipt from merely naming a material;
- old single-line purchase migration/compatibility preserves the purchase ID, line identity, payment IDs, dates, snapshots, and no new financial event;
- idempotent create, payment, receipt, correction, and retry behavior; same key/same payload reuses, same key/different payload conflicts without overwrite;
- concurrent payment/receipt windows cannot exceed the live purchase/line bounds;
- correction/reversal with downstream receipt, usage, coverage, cash attribution, and supplier reference either updates all eligible dependencies atomically or rejects with a truthful reason and no partial write;
- missing/unknown result recovery, failed cleanup/enrichment, reload, repeated click, back navigation, and cancellation;
- Arabic RTL mobile flows for create, pay, receive, correct, error, loading, empty, unknown, partial, success, and no-supplier states.

### UNIT-028 / Optional Inventory and Materials

At minimum cover:

- purchase of a non-tracked daily material records the approved period recognition once, without requiring every small use and without a second deduction from sale/order/recipe;
- tracked purchase with payment and later receipt: payment changes cash/payable, receipt changes quantity, and usage cost is recognized only according to the approved coverage contract;
- material definition/reference without tracking does not create a purchase, receipt, quantity zero, or cost zero by itself;
- existing material reuse is explicit and does not silently merge by name;
- unit semantics and safe conversion boundaries; incompatible units cannot be silently summed;
- quantity known with valuation unknown remains `unknown`, not zero, free, or fully known;
- exact small usage/rounding behavior preserves total value and does not instruct the user to create fictitious waste;
- explicit aggregate usage is supported where the contract allows it, without forcing a per-cup movement;
- count/observation with a difference records measurement and knowledge, not automatic waste/usage/loss or hidden financial adjustment;
- count with zero delta creates no movement/financial effect unless the contract explicitly requires a no-op receipt;
- explicit waste and its eligible effect use one canonical command and preserve the source, reason, knowledge, and reversal relationship;
- over-available usage and shortage flows reject or record an explicit shortage according to the contract; no negative stock and no automatic purchase/receipt/payment;
- usage from a sale/order/delivery preserves `saleId`/`orderId` source context in normal and shortage paths;
- concurrent receipt/use/count/reversal operations enforce live version, quantity, source bounds, and operation-key guards inside the atomic write boundary on both adapters;
- success followed by failed draft cleanup or failed read enrichment does not duplicate the movement or financial effect;
- correction/reversal preserves original movement, mirror, coverage, valuation knowledge, dates, and downstream links;
- SDF-031, SDF-033, SDF-035, SDF-036, SDF-055, SDF-067, and SDF-071 cases are executed where S07 owns the behavior, with exact evidence and no claim beyond the tested scope;
- Arabic RTL mobile flows for add, receive, use, count, waste, shortage, correction, empty, loading, error, unknown, cancellation, long text, keyboard/focus, and truthful knowledge/value states.

### Cross-cutting S07 compatibility and transfer coverage

- Memory/IndexedDB adapter conformance for every changed capability;
- old supported snapshots and current `40/32` snapshots remain readable unless a complete versioned migration is truly required;
- import rejects malformed purchase/material/party/source relationships before preview and before any target write;
- valid fully paid/no-supplier purchase remains accepted after any S07 transfer change;
- broken S05 saved-party references remain rejected;
- export → prepareImport → restore → confirmImport → re-export preserves purchase/material IDs, line/payment/movement identities, source references, dates, snapshots, unit/knowledge/coverage state, idempotency keys, and historical meaning without replaying financial effects;
- migration, rollback, and failure recovery preserve the original store if the operation is rejected or unknown;
- no secrets, token values, personal data, financial values, or raw credentials appear in logs, errors, reports, comments, or fixtures.

Do not claim every historical ACD/SDF ID is complete merely because it appears in a specification. Map the exact executed cases, mark unavailable or deferred evidence honestly, and state the owning later stage for behavior outside S07.

## Data, migration, export, and compatibility gate

Before changing any durable shape:

1. Determine the actual live `localSchemaVersion` and `localExportVersion` and all accepted pairs. The current live baseline is `40/32`; do not copy stale historical numbers from a specification.
2. Decide from the live code and contract whether S07 needs new durable fields, a new store, a migration, or only an existing optional path. Do not bump a version for a UI rename.
3. If a bump is required, update domain/types, Memory, IndexedDB upgrade path, transfer/export/import/restore validators, migration registry, compatibility tests, fixtures, persistent-entity touchpoints, and documentation together. Preserve every previously accepted pair required by the live compatibility contract.
4. Prove old supported snapshots open safely and malformed/unsupported files are rejected before destructive writes.
5. Prove export/import/restore preserves money, purchase/payment/line/movement/source identities, supplier references, dates, snapshots, units, coverage, knowledge states, idempotency keys, and historical records without replaying financial effects.
6. Keep S05 party-reference validation and S06 `paidAmountMinor`/financial validation active after any transfer change.
7. Do not change wire-format keys, rejection precedence, financial dates, current versions, or bundle/guard ceilings unless the complete compatible implementation and regression evidence exists.
8. Record the exact final schema/export pair and every accepted legacy pair in the result report. Never claim “no migration impact” without checking the actual transfer paths.

## Test and gate protocol

Run focused tests after each coherent checkpoint and keep going; do not wait for a review message between checkpoints. Use the repository's actual package scripts and record the exact command, exit code, test count, environment, and SHA.

At minimum inspect and run the relevant existing suites around:

- the S06 shared-bill confirmation, financial writer, import, and adapter tests;
- S05 party-reference and fully-paid/no-supplier transfer tests;
- supplier-purchase domain, service, UI, attribution, guard, correction, and adapter-conformance tests;
- inventory-material domain, reads, writes, waste, shortage, UI, capability, migration, and adapter-conformance tests;
- financial period/summary readers and source-ownership tests;
- `localTransferService.prepareImport` rejection, schema/export, migration, and restore tests;
- route, touchpoint, snapshot, and current-state guards directly affected by the final diff.

After the final code candidate and corrections are stable, run the canonical full check once:

```bash
pnpm check
```

Run required control/document checks as applicable, with JSON sources first and generated views only through the generator:

```bash
python3 scripts/operations-control/validate.py
python3 scripts/operations-control/generate_tracker.py
python3 scripts/operations-control/generate_tracker.py --check
node scripts/check-doc-index-coverage.mjs
node scripts/check-current-state-size.mjs
node scripts/check-agent-document-contract.mjs
git diff --check
```

Also run the relevant prototype test/build and bundle/surface gates from the live package scripts. Record remote Actions and Cloudflare results on the exact final pushed head. Do not weaken a guard, raise a tolerance, increase a warning/bundle ceiling, disable a test, add `.skip`/`.only`, or change CI policy to make a gate green. Fix the cause.

## Five sequential read-only reviewers

After the final S07 candidate is implemented and the full relevant checks pass, run exactly five distinct sequential read-only reviewers. One writer only; reviewers do not edit files.

1. **Architecture and ownership:** layer direction, canonical purchase/material writers, module boundaries, duplication, source-of-truth, public doors, and structural-scope compliance.
2. **Domain/data/storage:** purchase/payment/receipt/material/movement financial deltas, supplier identity, units, valuation knowledge, coverage, idempotency, concurrency, CAS, correction, migration, export/import/restore, Memory/IndexedDB parity, and rollback safety.
3. **UI/runtime/accessibility:** Arabic RTL, mobile portrait, states, navigation, focus, keyboard, cancellation, repeated actions, unknown/partial results, truthful error/status channels, and no-supplier/unknown-value comprehension.
4. **Tests/CI/security/operations:** real behavior coverage, focused regressions, full check, secrets, dependency/security posture, bundle/lint guards, exact-head CI, Cloudflare, and operational records.
5. **Documentation/product contract:** UNIT-027/028 traceability, SDF/ACD evidence, Control JSON, generated Tracker, current-state size, provenance, limitations, ownership, and handoff consistency.

Every finding must include a stable ID, exact evidence, impact, classification (`FIX_NOW`, `PRESERVE`, `DEFER`, or `OUT_OF_SCOPE`), root correction or protected trigger, tests, acceptance criteria, and rollback boundary. Fix every confirmed in-scope finding at its root on the same branch and PR, add focused regression coverage, rerun affected checks, and have the relevant read-only reviewer reread the corrected diff. Do not hide a real defect as a generic defer. Routine reviewer findings do not stop the execution or require an owner message.

## Commit and history rules

- Keep the S06 review-fix commit, S07 Control/understanding documentation, S07 domain/application/storage/UI implementation, reviewer corrections, and documentation/Control updates distinguishable in phase-labelled commits.
- Do not mix unrelated cleanup, bulk moves, or structural refactoring into any commit.
- Do not rewrite earlier S06/S05/S04/S03 history.
- Do not write a self-referential SHA into the commit being created; record the final SHA afterward in the result and PR evidence.
- Do not edit generated Tracker views manually.
- Use the repository's required Manus attribution only if the active environment and repository rules require it; never add arbitrary attribution or secrets.

## Operations Control, result, and handoff requirements

Before product-code changes, create/update the correct S07 JSON Control Item and Workstream using the next unused identifiers discovered live. Include the branch, PR, base SHA, current head, scope, contracts, S06 finding, rollback boundary, and ownership. Keep S06's review status truthful; record its correction as delivered but still pending independent review and owner acceptance.

At the end, update JSON sources first and regenerate official views. Update only the records required for this execution:

- the S06 result/addendum or linked finding record for `S06-MR-001`;
- the S07 Control Item and Workstream;
- the S07 result report;
- `docs/implementation/micro-component-execution/02-PROGRESS-AND-HANDOFF.md`;
- `docs/operations/current-state.md` within its size guard;
- append-only current-state log and sequential worklog where required;
- document index/Manifest if the new prompt/result requires it;
- PR #383 description or checkpoint comment with exact final evidence.

The result report must contain:

1. live starting head, base SHA, ancestry, and worktree state;
2. characterization, root fix, tests, and classification for `S06-MR-001`;
3. exact S07 base, implementation candidate, correction commits, and final documentation head;
4. changed files grouped by S06 review fix, UNIT-027, UNIT-028, cross-component integration, reviewer corrections, and documentation;
5. owner/consumer/source-of-truth map;
6. financial, date, unit, schema, export, import, restore, migration, compatibility, and rollback impact;
7. exact focused and full commands, exit codes, counts, environment, and SHA;
8. exact GitHub Actions and Cloudflare evidence for the exact final pushed head;
9. five reviewer results and every finding/correction;
10. Control/Workstream states and generated Tracker status;
11. what is verified, unverified, deferred, preserved, and out of scope;
12. the exact safe resume point only if a genuine blocker remains;
13. explicit statement that no `main` write, merge, rebase, force-push, branch deletion, or second PR occurred.

Distinguish clearly between:

- S06 review-fix code candidate;
- S07 code candidate;
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

Do not stop after the S06 review fix. Continue into S07 in the same execution unless a genuine blocker defined above occurs. Do not stop for routine findings, ordinary failing tests, generated-document corrections, or the absence of an intermediate reviewer message.

When all authorized work is complete, the final delivery must end with exactly this block, replacing placeholders with real full SHAs and the actual S07 status:

```text
S06_REVIEW_FIX_DELIVERED — S06-MR-001 — REVIEW_REQUIRED
S07_EXECUTION_COMPLETE — REVIEW_REQUIRED
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
S06_REVIEW_FIX — <COMPLETE_PARTIAL_OR_NOT_STARTED>
S07_STATUS — <COMPLETE_PARTIAL_OR_NOT_STARTED>
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
