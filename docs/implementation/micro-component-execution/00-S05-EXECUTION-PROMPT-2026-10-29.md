# Z AI — S05 Customers and Suppliers Execution

## Mission

Continue the Micro component-execution program on the existing single integration branch and existing Draft PR.

Execute S05 only: UNIT-037 — Customers and Suppliers when needed. Before and during S05, reconcile the two carry-forward findings from the independent light review of S04. Do not redo S04, do not restart completed work, and do not remove or rewrite existing commits.

ZAI is the only product-code writer and executor. Manus performs the independent review after delivery. The owner decides stage acceptance and the eventual merge. Do not infer acceptance from green tests or from this prompt.

Continue from A to Z without waiting for another message. Routine documentation corrections, generated Tracker updates, normal reviewer findings, and ordinary test reruns are not stop conditions. Repair them and continue.

## Live baseline

- Repository: `https://github.com/Qays7753/Micro`
- Integration branch: `components/integration-20261027`
- Existing Draft PR: `https://github.com/Qays7753/Micro/pull/383`
- Base branch: `main`
- Last verified published head: `eab7b6a9b6a2440c0d8b4a8ded851c6aca258016`
- S04 code candidate reviewed inside that head: `9d7d2aee2d21fa560ea81f78f7de13103628f5b5`
- S04 records commit: `73f083480b49083783b09761dfa4d34167a012bd`
- S04 final bundle-surface correction: `eab7b6a9b6a2440c0d8b4a8ded851c6aca258016`
- Base `main` at the last verification: `3584aa1d08cea3e0a00623b719fed7f991ce187f`

Verify every value live before writing. These are checkpoints, not permission to reset history. Preserve all existing commits and local work. If the current head is a safe descendant of the published head, continue from it. If genuine ancestry drift, lost work, an unexpected writer, or an unsafe reset is detected, preserve everything and stop with `STATE_DRIFT`; do not reset, force-push, overwrite, or guess.

## S04 carry-forward review findings

The independent light review found no confirmed S04 code, financial, storage, migration, or security blocker. S04 local checks and exact-head GitHub Actions/Cloudflare evidence were green. The S04 result remains `S04_EXECUTION_COMPLETE — REVIEW_REQUIRED` until owner acceptance.

Carry these items into the S05 run:

### S04-CF-001 — manual phone evidence gap

The S04 result records the physical-device RTL/portrait check as `NOT_EXECUTED`. Automated DOM, accessibility, and density evidence exists, but a human-device check was not proven.

At S05 preflight, perform a focused manual phone/portrait/RTL check of the affected S04 CashCount and CashTransfer surfaces only if an authorized browser/device environment is available. Do not rerun the full S04 suite. Record URL/build identity, viewport, actions, expected result, actual result, and PASS/FAIL/NOT_EXECUTED. If the environment cannot perform a real device check, preserve the honest `NOT_EXECUTED` or `UNVERIFIED` classification and continue; do not claim it passed and do not invent a failure.

If the focused check exposes a real S04 defect that is safe and in scope to correct during S05, fix it at the root in a clearly labeled S04 carry-forward commit, add the focused regression test, and rerun only the affected checks. If it exposes no defect, do not change S04 code.

### S04-CF-002 — stale control wording

Reconcile the current summaries of `docs/operations/control/items/DOC-013.json` and `docs/operations/control/workstreams/WS-229.json` if they still describe S04 as not implemented or still say that S05 must not start after S05 has been authorized. Preserve the append-only historical entries; update only the current summary, next action, evidence, and dependency fields from the JSON sources. Regenerate official Tracker views. Do not mark S04 as `VERIFIED_ON_MAIN`, merged, or owner-accepted unless that has actually happened.

These are documentation/evidence corrections, not permission to reopen or redo S04.

## Secure credentials

Use only the GitHub and Cloudflare credentials already available through the editor's secure credential fields. Never request a token in chat. Never print, echo, store, commit, comment, or report a token, token prefix, cookie, authorization header, or private credential value. If the secure credential channel is unavailable, stop with `CREDENTIAL_CHANNEL_UNAVAILABLE` and preserve all work.

## Canonical sources

Read the live GitHub versions before editing:

1. `AGENTS.md` and all applicable instruction files.
2. `docs/operations/agent-development-sop-v1.md`.
3. `docs/operations/agent-handoff-protocol-v1.md`.
4. `docs/operations/control/README.md` and the Control schemas.
5. `docs/operations/current-state.md` and `docs/operations/current-state-log.md`.
6. `docs/implementation/micro-component-execution/00-PROGRAM.md`.
7. `docs/implementation/micro-component-execution/01-STAGES.md`.
8. `docs/implementation/micro-component-execution/02-PROGRESS-AND-HANDOFF.md`.
9. `docs/implementation/micro-component-execution/09-S04-RESULT-2026-10-28.md`.
10. `docs/operations/control/items/DOC-013.json` and `docs/operations/control/workstreams/WS-229.json`.
11. `docs/implementation/micro-component-execution/02-SPECIFICATIONS/03-New-Design/UNIT-037-العملاء-والموردون.md`.
12. `docs/implementation/micro-component-execution/02-SPECIFICATIONS/05-Data-and-Implementation/01-Current-vs-Approved-Components-AR.md`.
13. `docs/implementation/micro-component-execution/02-SPECIFICATIONS/05-Data-and-Implementation/02-Shared-Data-and-Financial-Contract-AR.md`.
14. `docs/implementation/micro-component-execution/02-SPECIFICATIONS/05-Data-and-Implementation/03-Shared-Data-Acceptance-Cases-AR.md`.
15. The linked contracts for UNIT-005, UNIT-007, UNIT-009, UNIT-015, UNIT-026, UNIT-027, UNIT-029, UNIT-034, UNIT-038, and UNIT-044 where S05 reads or extends their source/reference relationships.

GitHub is the operational source of truth. Google Drive is not an execution dependency for ZAI. Historical reports and old SHAs are evidence only when the current canonical file explicitly cites them.

## Scope and non-goals

S05 owns the optional local identity and explicit selection of a customer or supplier when the user needs it. It must preserve source-owned financial meaning and must not create a parallel receivables/payables ledger.

In scope:

- UNIT-037 P3 requirements and its A/B/B-DUP/C acceptance obligations where applicable;
- optional saved counterparty identity with explicit user intent;
- inline party definition on a source operation when a new right needs a simple identity;
- explicit selection of an existing saved customer or supplier;
- editing and archiving a saved identity without deleting historical snapshots or breaking source references;
- source-anchored reads of related sale, order, purchase, payment, and qualified opening-right records;
- required storage, Memory/IndexedDB parity, export/import/restore, migration, and touchpoint changes if the implementation truly introduces a durable counterparty record;
- SDF-009, SDF-010, SDF-011, SDF-027, SDF-028, and SDF-041;
- relevant existing UI, service, domain, storage, route, and capability surfaces listed by the live S05 stage card.

Explicitly out of scope:

- CRM, marketing, leads, phone-book management, authentication, cloud sync, roles, or server data;
- loans or lender management;
- a manually editable customer or supplier balance ledger;
- automatic creation of a saved party for every historical or new operation;
- automatic merging of people with similar names;
- automatic allocation of a payment to the oldest or any guessed claim;
- turning an old loan, historical payment, or name-only record into a customer debt by inference;
- creating a new sale, purchase, payment, expense, receipt, cash event, or claim merely to demonstrate a party screen;
- broad structural refactoring, bulk file moves, global redesign, unrelated cleanup, or starting S06.

## Non-negotiable domain and data rules

Implement the current UNIT-037 specification, not an older interpretation:

- The visible product name is “Customers and Suppliers”; do not revive “People Ledger” or equivalent wording.
- A fully paid sale or purchase may exist without a saved customer or supplier.
- A new unpaid right needs a simple identity or source reference as required by its owner, but does not require a phone number or a permanent CRM profile.
- Saving a party for reuse is explicit and optional. Opening a selector does not create a party or a financial command.
- Two parties with the same name remain distinct unless the user explicitly selects the existing saved identity; name similarity never authorizes merging.
- A saved party has a stable identity. Renaming changes the current label only; historical source snapshots remain unchanged.
- Archiving must not delete historical snapshots, source references, rights, payments, or valid relations.
- A source-owned claim or balance is derived from the original sale, order, purchase, payment, return, correction, or qualified opening-right source. S05 must not create an editable parallel balance.
- An historical payment with an unknown original debtor remains limited-knowledge. Do not attach it to a guessed party or settle an arbitrary claim.
- A qualified opening right for a known party is an old right, not a sale made today and not a loan substitute.
- If saving an optional party fails after the source sale or purchase succeeds, do not repeat, roll back, or duplicate the successful business operation merely to retry party saving. Report the optional-save failure honestly.
- Financial amounts remain integer minor units; dates remain actual business dates; knowledge state and source references are preserved.
- Any durable-field change must preserve Memory/IndexedDB parity, export/import/restore behavior, migration compatibility, and idempotent retry semantics.
- Preserve UI → Application → Domain → Storage Port → IndexedDB. UI must not contain financial policy or direct storage calls.

## Phase 0 — preflight and ownership map

1. Verify the live branch, PR, exact head, base, ancestry, worktree, and existing commits.
2. Read the S04 result and apply the two carry-forward rules above without redoing S04.
3. Inspect the current party/ledger UI, `partyLedgerService`, domain types/policies, direct-sale and supplier-purchase consumers, payment/source references, storage capabilities, import/export/restore paths, and existing tests.
4. Build a concise owner/consumer map before writing. Identify which source owns each sale, purchase, payment, claim, snapshot, party identity, and derived read.
5. Determine whether the existing code already has a durable counterparty store or only derived name reads. Do not create a store merely because the stage card lists it as a candidate.
6. Use the next unused Control Item and Workstream identifiers after inspecting the live repository; do not guess or reuse identifiers.

## Phase A — implement UNIT-037 at the existing ownership boundaries

Implement the smallest coherent solution that satisfies the specification and the existing architecture.

The implementation must support, where the current contracts require it:

1. An optional saved customer/supplier identity with stable ID, current label, type/role, archive state, and only the additional optional details explicitly supported by the current contract.
2. An inline name/reference when the user does not want to save a reusable party.
3. Explicit selection of a saved party on a source-owned operation.
4. Honest empty, unknown, archived, missing, read-failure, write-failure, cancel, retry, and stale-state behavior.
5. Source-anchored reads with explicit relation/reference, not name-only aggregation.
6. Editing and archiving while retaining snapshots and historical source semantics.
7. Optional party-save failure that does not duplicate or undo a successful source operation.
8. Correct Memory and IndexedDB behavior if durable storage is changed.
9. Export/import/restore and schema migration evidence if a durable family or field is added.
10. Accessible Arabic RTL mobile UI using existing primitives and visual language; no global visual redesign.

Do not modify every path named by the stage card automatically. Change only the owner and consumers whose contract actually changes, and document why adjacent paths were preserved.

If the current code cannot safely satisfy a detail without a missing policy decision, isolate that path and report the exact decision, impact, and safe state. Do not invent financial semantics.

## Phase B — required behavioral evidence

Add or update real behavioral tests. Do not claim success from a mock-only test.

At minimum prove:

- SDF-009: two parties with the same name and two different rights do not merge; explicit selection keeps the source correct.
- SDF-010: fully paid sale and purchase without a saved party remain valid and do not force a party or phone number.
- SDF-011: renaming or archiving a used party preserves source labels, snapshots, rights, payments, and historical references.
- SDF-027: a qualified opening right for a known party is not a current sale and not a loan substitute; it does not duplicate an existing source.
- SDF-028: a historical payment with unknown debtor remains limited-knowledge and is not assigned to an arbitrary party or claim.
- SDF-041: source operation succeeds while optional party persistence fails; the source operation is not repeated, rolled back, or duplicated.
- duplicate submit/retry/idempotency for party save and source selection;
- stale revision/concurrent edit behavior for party rename/archive/selection;
- Memory/IndexedDB parity where durable storage exists;
- export/import/restore and migration preservation for any changed durable field;
- read failure, write failure, unknown outcome, cancel, reload, empty state, archived state, and missing relation;
- Arabic RTL, mobile portrait, accessible labels, focus, loading/preparing status, error tone, repeated clicks, and truthful result channels.

Run focused S05 tests after each coherent implementation checkpoint. After implementation is stable, run the full canonical check once on the final code candidate. Re-run only affected focused checks after later fixes; do not repeat the full suite for documentation-only changes.

## Five sequential read-only reviewers

After the S05 candidate is implemented, run five distinct sequential read-only reviewers:

1. Architecture and ownership: module boundaries, layer direction, source-of-truth duplication, public doors, and deletion safety.
2. Domain/data/storage: party identity, source references, snapshots, archive semantics, concurrency, idempotency, migration, export/import, and financial integrity.
3. UI/runtime/accessibility: Arabic RTL, mobile portrait, states, navigation, focus, cancellation, repeated actions, and truthful errors.
4. Tests/CI/security/operations: behavior coverage, dependency/security, budgets, guards, CI, Cloudflare evidence, and performance.
5. Documentation/product contract: UNIT-037 traceability, SDF evidence, Control JSON, generated Tracker, provenance, and handoff consistency.

Reviewers are read-only. One writer only. Every finding must contain exact evidence and one classification: `FIX_NOW`, `PRESERVE`, `DEFER`, or `OUT_OF_SCOPE`.

Fix every confirmed in-scope finding at the root on the same branch and PR, add the focused regression test, and have the relevant reviewer re-read the corrected diff. Do not hide a real defect as a generic defer.

## Safety and write boundary

Authorized write boundary: `BRANCH_AND_PR_ONLY` on `components/integration-20261027` and PR #383.

MUST NOT:

- write to `main`;
- merge, rebase, force-push, delete branches, close the PR, or clean up;
- create a new branch or second PR;
- start S06 or any later stage;
- weaken guards, raise budgets/tolerances, change CI policy, or suppress advisories;
- create CRM, cloud, auth, user, or server data;
- change financial meaning, historical dates, Schema, Export, Import wire format, or rejection precedence without complete in-scope compatibility evidence;
- edit generated Tracker views by hand;
- claim S04 owner acceptance, main verification, merge, or program completion.

Keep S04 carry-forward documentation and any S05 code/configuration commits clearly separate. Do not rewrite accepted history.

## Exact-head checks and delivery

Verify exact-head local and remote evidence. Run the repository's canonical checks and focused tests from the exact candidate SHA. Wait for GitHub Actions and Cloudflare Pages on the exact final head. Diagnose and repair failures; do not retry randomly or claim success from another SHA.

Update JSON Control sources first, then regenerate official Tracker views. Update only the records required for this run:

- S04 carry-forward documentation/evidence if needed;
- S05 Control Item and Workstream;
- S05 result report;
- progress/handoff;
- current-state within its size guard;
- append-only current-state log;
- sequential worklog;
- document index and Manifest;
- PR #383 description and checkpoint comment.

Distinguish code candidate SHA, final documentation head SHA, locally tested SHA, GitHub Actions SHA, Cloudflare SHA/deployment, review status, owner acceptance, and merge status.

## Final report contract

Publish one complete S05 result report containing:

1. live starting SHA, base SHA, and ancestry;
2. S04 carry-forward findings and their verified/NOT_EXECUTED/UNVERIFIED status;
3. S05 code candidate and final documentation head SHAs;
4. changed files grouped by carry-forward documentation and S05 implementation;
5. owner/consumer/source-of-truth map;
6. every finding with ID, classification, evidence, impact, dependency, root fix, tests, acceptance criteria, and rollback boundary;
7. durable data, migration, Schema, Export, Import, restore, and financial-impact statement;
8. exact commands, exit codes, test counts, and affected checks;
9. exact GitHub Actions and Cloudflare evidence for the final SHA;
10. five reviewer results and corrections;
11. Control/Workstream states and generated Tracker status;
12. limitations, unverified evidence, deferred decisions, and remaining blockers;
13. exact resume point only if genuinely blocked.

If S05 is complete, all confirmed in-scope findings are fixed, the S04 carry-forward is honestly recorded, exact-head checks are green, and the branch is ready for independent review, end with exactly:

```text
S04_LIGHT_REVIEW — PASS_WITH_LIMITATIONS
S05_EXECUTION_COMPLETE — REVIEW_REQUIRED
PR_READY_FOR_EXPLICIT_MERGE_REVIEW — <FULL_FINAL_HEAD_SHA>
NO_MAIN_WRITES_PERFORMED
NO_MERGE_PERFORMED
NO_BRANCH_CLEANUP_PERFORMED
NO_REPOSITORY_WRITES_OUTSIDE_ALLOWED_BRANCH
```

If a genuine blocker remains, end with exactly:

```text
EXECUTION_BLOCKED — <EXACT_BLOCKER>
S04_CARRY_FORWARD — <VERIFIED_OR_NOT_EXECUTED_OR_UNVERIFIED>
S05_STATUS — <COMPLETE_PARTIAL_OR_NOT_STARTED>
SAFE_CHECKPOINT — <FULL_SHA>
NO_MAIN_WRITES_PERFORMED
NO_MERGE_PERFORMED
NO_BRANCH_CLEANUP_PERFORMED
NO_REPOSITORY_WRITES_OUTSIDE_ALLOWED_BRANCH
```
