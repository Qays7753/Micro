# Z AI — S03 Concurrency Remediation and S04 Execution

## Mission

Continue the Micro component-execution program on the existing single integration branch and existing Draft PR only.

First, independently revalidate the latest S03 implementation and fix the confirmed concurrent-preference-write defect at its root. Do not redo S03 from the beginning and do not remove or rewrite work that is already present.

Immediately after the S03 remediation is implemented, tested, reviewed, and its exact-head evidence is recorded, continue directly to S04 on the same branch and PR. Execute S04 completely within the approved scope, including code, focused regression tests, full repository checks, five sequential read-only specialist reviews, root fixes for confirmed in-scope findings, canonical records, and exact-head GitHub Actions and Cloudflare evidence.

Do not wait for routine confirmation, ordinary test completion, normal reviewer handoffs, documentation cleanup, or progress questions. Stop only for a genuine safety blocker defined in this prompt. Do not stop merely because a documentation record is stale or because a normal in-scope documentation correction is needed; repair it and continue.

ZAI is the only code writer and executor. Manus reviews the resulting candidate independently. The owner decides the eventual merge. ChatGPT is not an execution gate for this run.

## Repository and live baseline

- Repository: `https://github.com/Qays7753/Micro`
- Integration branch: `components/integration-20261027`
- Existing Draft PR: `https://github.com/Qays7753/Micro/pull/383`
- Base branch: `main`
- Last verified review context: S03 candidate was reviewed at `081edc39f16acefe36be928ae8f0f3e0dc30e761`; verify the live branch and PR before every write because the head may have changed.
- Expected base head before the component program: `3584aa1d08cea3e0a00623b719fed7f991ce187f`.

The values above are checkpoints, not permission to reset history. Before writing, inspect the live branch, PR, worktree, ancestry, uncommitted files, existing commits, and current records. Preserve every existing commit and every existing worktree change. Never reset, force-push, overwrite, or recreate the branch.

If the live head is not the expected head or a safe descendant, determine whether the difference is an existing safe continuation. If there is genuine state drift, an unexpected writer, lost work, or an unsafe ancestry change, preserve all work and report `STATE_DRIFT`; do not reset or guess. If the difference is only a normal descendant on this same branch, continue from it without repeating completed work.

## Secure credentials

Use only the GitHub and Cloudflare credentials already supplied through the editor's secure credential fields:

```text
GITHUB_ACCESS_TOKEN=<SECURE_SECRET_FIELD_ONLY>
CLOUDFLARE_API_TOKEN=<SECURE_SECRET_FIELD_ONLY>
```

Never request, print, echo, paste, store, commit, comment, or report a real token, token prefix, cookie, authorization header, private session URL, or secret environment value. Never put a real token in this prompt or in normal chat. If the secure credential channel is unavailable, stop with `CREDENTIAL_CHANNEL_UNAVAILABLE`; do not ask for the token in plain text.

## Authoritative repository sources

Read the current live-branch versions before acting. GitHub is the operational source of truth; Google Drive is not required by ZAI and must not be used as an execution dependency.

1. `AGENTS.md` and all applicable repository instruction files.
2. `docs/operations/agent-development-sop-v1.md`.
3. `docs/operations/agent-handoff-protocol-v1.md`.
4. `docs/operations/control/README.md`, Control JSON sources, generated Tracker views, and `pre-pilot.json` where applicable.
5. `docs/operations/current-state.md` and `docs/operations/current-state-log.md`.
6. `docs/implementation/micro-component-execution/00-PROGRAM.md`.
7. `docs/implementation/micro-component-execution/01-STAGES.md`.
8. `docs/implementation/micro-component-execution/02-PROGRESS-AND-HANDOFF.md`.
9. `docs/implementation/micro-component-execution/08-S03-RESULT-2026-10-28.md` and the current successor result if the path has changed.
10. `docs/implementation/micro-component-execution/00-S03-EXECUTION-PROMPT-2026-10-28.md` for the completed S03 contract and preserved decisions.
11. This prompt: `docs/implementation/micro-component-execution/00-S03-REVALIDATION-S04-EXECUTION-PROMPT-2026-10-28.md`.
12. The S04 stage card and all linked canonical specifications:
    - `02-SPECIFICATIONS/03-New-Design/UNIT-020-مال-المالك.md`
    - `02-SPECIFICATIONS/03-New-Design/UNIT-022-إدارة-النقد.md`
    - `02-SPECIFICATIONS/03-New-Design/UNIT-023-التحويل-بين-أماكن-النقد.md`
    - `02-SPECIFICATIONS/03-New-Design/UNIT-024-تحديد-مكان-النقد.md`
    - `02-SPECIFICATIONS/03-New-Design/UNIT-025-مطابقة-رصيد-الصندوق.md`
    - `02-SPECIFICATIONS/05-Data-and-Implementation/02-Shared-Data-and-Financial-Contract-AR.md`
    - `02-SPECIFICATIONS/05-Data-and-Implementation/03-Shared-Data-Acceptance-Cases-AR.md`
    - the relevant P3, A/B, current-system, navigation, and journey references linked by those files.

Do not treat a historical report, old chat excerpt, old Drive copy, or stale SHA as a current contract when the live GitHub file differs.

## Write boundary and forbidden actions

Authorized write boundary: `BRANCH_AND_PR_ONLY` on `components/integration-20261027` and PR #383.

MUST NOT:

- write to `main`;
- merge, rebase, force-push, delete branches, close the PR, or clean up branches;
- create a new branch or a second PR;
- start S05 or any later stage;
- perform global redesign, bulk moves, structural refactoring, or unrelated cleanup;
- change CI policy, weaken a guard, raise a ceiling or tolerance, downgrade a dependency, or silence an advisory;
- change Schema 38, Export 30, import wire format, historical dates, rejection precedence, or financial meaning unless an explicit current S04 contract requires a durable change and the complete compatibility/migration evidence is implemented in the same scope;
- introduce authentication, users, cloud sync, server data, or authoritative external data;
- use Drive as a required execution source;
- claim acceptance on `main`, merge completion, or owner approval.

Keep S03 remediation commits clearly S03-tagged and S04 implementation commits clearly S04-tagged. Do not mix S03 remediation and S04 implementation in one commit. Never rewrite accepted history.

## Required five specialist sub-agents

Use the available repository skills for planning, code review, data/domain/storage analysis, UI/accessibility, security/CI/deployment, and Operations Control. If a named skill is unavailable, apply the same responsibility manually and state the limitation.

After the single writer completes the S03 remediation checkpoint and again after the S04 candidate is implemented, run five distinct sequential read-only specialist sub-agents:

1. Architecture, ownership, module boundaries, layer direction, dependency impact, deletion safety, and public-door compliance.
2. Domain, data, storage, concurrency, idempotency, rollback, migration, schema/export/import, and financial-semantic safety.
3. UI, runtime, Arabic RTL, mobile portrait, accessibility, navigation, loading, empty, error, cancel, and repeated-action behavior.
4. Tests, CI, dependency/security, Cloudflare evidence, budgets, performance, and regression coverage.
5. Documentation, Control JSON, generated Tracker, provenance, acceptance state, and handoff consistency.

Each sub-agent is read-only. It must not edit, commit, push, merge, delete, or act as a second writer. Each finding must include exact evidence and one classification: `FIX_NOW`, `PRESERVE`, `DEFER`, or `OUT_OF_SCOPE`.

The single writer must fix every confirmed in-scope finding at the root on this same branch, add or update a focused regression test, and have the relevant read-only reviewer re-read the corrected diff. Do not hide an in-scope defect as a workaround or generic defer.

## Phase 0 — Live preflight and resume

1. Verify the live branch, PR #383, exact head, base, worktree, ancestry, status, and existing commits.
2. Read the current S03 result and identify the already completed S03 work. Do not repeat it.
3. Locate all current preference writers/readers and the existing guarded storage paths in Memory and IndexedDB.
4. Locate the S04 owners, consumers, existing cash/owner-money services, storage ports, domain policies, pages, guards, and tests listed by the S04 card.
5. Create a concise consumer/owner map and record it in the run report before implementation.
6. Reuse exact-head evidence when it remains directly applicable; do not rerun expensive checks only for repetition. State the reused SHA and why it remains valid.

## Phase A — S03 concurrent-preference-write remediation

### A1. Reproduce and characterize the actual defect

Revalidate the finding independently. Inspect the current implementation of `updateLocalPreferences` and every relevant preference writer, port, service, Memory adapter, IndexedDB adapter, and test.

Prove or disprove the following race with a deterministic behavioral test:

1. Two writers read the same preference revision.
2. Writer A changes one preference field.
3. Writer B changes a different preference field from the stale snapshot.
4. Both writes overlap.
5. The final record must not silently lose either valid update.

Also characterize same-field races, stale revisions, read failures, write failures, unknown outcomes, repeated commands, and adapter parity. Do not treat sequential field-preservation tests as proof of concurrent safety.

### A2. Implement the root fix

If the race is confirmed, implement the smallest existing-architecture fix at the guarded application/storage boundary. Use the repository's established revision/CAS/transaction patterns where applicable. The fix must:

- prevent silent lost updates;
- preserve unrelated preference fields;
- have deterministic and truthful conflict behavior;
- preserve Memory and IndexedDB semantic parity;
- preserve idempotency and unknown-outcome handling;
- keep UI free of storage and financial policy;
- avoid an unguarded read-then-full-write path as the source of truth;
- avoid a UI-only mutex or timing workaround;
- avoid a new store, ORM, cloud service, or structural refactor;
- preserve Schema 38, Export 30, import wire format, and all existing financial semantics.

Do not assume that serializing calls in one JavaScript event loop solves cross-window or cross-context races. Prove the chosen boundary with a behavioral test.

### A3. Required S03 remediation tests and evidence

At minimum add or update focused tests for:

- two concurrent writers changing different fields with no lost update;
- same-field conflict with explicit deterministic outcome;
- stale revision or CAS rejection and truthful UI/service result;
- Memory/IndexedDB parity;
- read failure, write failure, and unknown write outcome;
- preservation of unrelated fields;
- no schema/export/import change;
- no financial write, duplicate identity, or historical-data mutation.

Run the focused S03 tests and the relevant existing S03 regression tests. Then run the five sequential read-only reviewers. Fix confirmed in-scope findings and rerun affected checks.

### A4. S03 transition rule

If the S03 race is fixed, the focused tests pass, the five reviews are resolved, and no genuine data-integrity/security blocker remains, continue directly to Phase B without waiting for another message.

A stale tracker line, outdated current-state wording, missing index row, or normal documentation mismatch is not a stop condition: update the JSON source first, regenerate official views, and continue.

Stop only if there is genuine state drift, an unavailable secure credential, an unresolved data-integrity/security blocker, a required owner decision explicitly demanded by the live contract, an unresolvable merge conflict, an unauthorized write, or a required check that fails and cannot be repaired within this scope. If one S04 sub-policy is explicitly unapproved, continue every safe S04 sub-part and report that exact sub-policy as the only blocker; do not invent its semantics.

## Phase B — S04 implementation

Execute only S04, covering UNIT-020, UNIT-022, UNIT-023, UNIT-024, and UNIT-025, their linked shared data/financial contract, SDF-001/SDF-015/SDF-016/SDF-020/SDF-021, and the existing consumers required by the stage card.

### B1. Build the S04 ownership and consumer map

Before editing, identify the actual current owner and consumer of each shared concept:

- cash continuity and wallet identity;
- owner money and owner entitlement/withdrawal;
- transfer pair and reversal/correction relationship;
- assignment of an existing payment to a cash location;
- cash observation/count and reconciliation;
- Memory and IndexedDB commit boundaries;
- activity/ledger readers;
- export/import/restore consumers;
- routes, pages, public application doors, and focused tests.

Do not duplicate a writer, ledger, store, or source of truth. Extend existing guarded commit paths where they exist.

### B2. Implement the approved S04 behavior and invariants

Implement the latest GitHub specifications, not an older interpretation. At minimum prove these invariants:

- `100 JOD = 10000 minor units`; never store `100` as `10000` or reinterpret an existing amount by guesswork.
- A transfer writes both legs and the transfer relationship atomically, or writes neither leg. A second-leg failure must not leave a one-sided transfer.
- A transfer preserves identities, source/destination, operation key, dates, revision/concurrency checks, reversal/correction links, and knowledge state.
- Assigning a recorded payment to a cash location does not receive or collect the money a second time.
- Owner withdrawal/owner money is not an expense, sale, revenue, or automatic financing of an unexplained difference.
- A cash observation/count is a measurement with scope, cutoff, coverage, and knowledge; it does not create cash, erase a transaction, or reinterpret an old reconciliation as a new measurement.
- Unknown is not zero. Failed reading is not unknown. Incomplete coverage remains explicitly incomplete.
- Do not combine a project-level amount and a wallet-level amount merely because both are called cash.
- Do not record a cash transfer, sale, payment, or expense from a cash-count screen unless the exact S04 contract explicitly owns that action.
- Repeated submission, retry, reload, concurrent windows, and stale revisions are idempotent or rejected truthfully; no lost update or duplicate financial effect.
- Preserve old records, identities, historical dates, and valid references. Do not silently restate or delete financial history.
- Keep UI → Application → Domain → Storage Port → IndexedDB direction and Memory/IndexedDB parity.

If a specification marks a policy decision as explicitly unapproved, do not silently choose a value. Implement the approved portions, isolate the undecided path, record the exact decision and impact, and stop only that path if it would otherwise create a real financial or data-integrity risk.

### B3. S04 implementation boundaries

Use focused, understandable commits such as:

1. S03 concurrency remediation and regression evidence.
2. S04 shared cash/owner-money contracts and guarded write boundaries.
3. S04 transfer, assignment, measurement, reconciliation, and UI integration.
4. S04 focused tests, reviewer corrections, and canonical evidence/records.

The exact file split may follow the existing repository ownership map. Do not create a broad new architecture or move files merely for organization.

### B4. Required S04 acceptance tests

Add or update behavioral tests for the S04 acceptance cases, including at minimum:

- JOD minor-unit conversion: `100 → 10000`;
- known ledger 100 and count 90: no unexplained automatic shortage of 20;
- unknown balance with observation 90: no comparison against assumed zero;
- transfer of 10 where the second side fails: zero partial financial effect and truthful failure;
- transfer success with both legs and one shared relation;
- duplicate retry and same operation key behavior;
- two concurrent transfers from a known source: at most one succeeds when coverage is insufficient;
- assigning an existing payment without a second receipt/cash event;
- owner withdrawal not classified as expense;
- observation does not create or erase cash;
- stale form/revision conflict and recovery;
- Memory/IndexedDB parity;
- export/import/restore preservation for every durable-field change;
- Arabic RTL, mobile portrait, accessible labels, focus, loading, empty, read failure, write failure, cancellation, repeated clicks, and truthful error/unknown-result states.

Do not claim an acceptance case passed from a mock-only test. Tests must assert behavior at the service/storage boundary and, where applicable, through a real UI integration path.

## Continuous execution and real-blocker policy

After each coherent implementation checkpoint:

1. run the focused tests;
2. run the five sequential read-only specialist reviews;
3. fix every confirmed in-scope finding at the root;
4. rerun affected checks;
5. continue to the next checkpoint without waiting for user confirmation.

Do not stop because:

- documentation needs a normal correction;
- a generated Tracker view must be regenerated;
- a normal reviewer reports a fixable finding;
- a remote check is pending;
- a local command needs to be rerun after a fix;
- a report needs its SHA or evidence updated;
- a test exposes an in-scope defect that can be fixed safely.

Stop and preserve all work only for:

- genuine branch/ancestry drift or lost work;
- unavailable secure credentials;
- unresolved data loss, financial-semantic, security, or migration risk;
- a policy decision explicitly required by the live contract and impossible to implement safely without it;
- an unresolvable conflict requiring a guess;
- an unauthorized write or unexpected branch;
- a required check that cannot be repaired within S03/S04 scope.

If stopping is required, do not revert completed work. Commit or preserve the safe checkpoint on the authorized branch where possible, record the exact first incomplete action and exact SHA, and report the blocker. Do not restart from the beginning.

## Canonical verification and remote gates

Run the repository's canonical commands from the exact final candidate SHA, including the required `pnpm check` chain and the focused S03/S04 tests. Do not claim success from another SHA.

Verify exact-head GitHub Actions and Cloudflare Pages evidence. If a remote check is pending, wait and inspect it. If it fails, diagnose and repair within scope; do not retry randomly, raise ceilings, weaken guards, or call a different head green.

For every remote result record the exact full SHA, run/deployment identifier, URL, status, and conclusion. If provider evidence cannot prove the target SHA, mark it `UNVERIFIED` rather than claiming success.

## Records and source-of-truth updates

Update JSON Control sources first, then regenerate official Tracker views. Never edit generated views by hand.

On the same integration branch and PR, update only the records required for this run:

- S03 remediation result and evidence;
- S04 Control Item and Workstream using the next unused identifiers after inspection;
- `00-PROGRESS-AND-HANDOFF.md`;
- `01-STAGES.md` status only where the live program rules allow it;
- `current-state.md` within its size guard;
- append-only `current-state-log.md`;
- sequential worklog;
- document index and Manifest;
- PR #383 description and a concise checkpoint comment.

Do not create contradictory duplicate statuses. Distinguish clearly between:

- code candidate SHA;
- final documentation/evidence head SHA;
- exact SHA tested locally;
- exact SHA checked by GitHub Actions;
- exact SHA deployed/checked by Cloudflare;
- review status;
- owner acceptance status;
- merge status.

## Required final report

Publish one unified report in the canonical S04 result path chosen from the live repository. It must include:

1. exact base SHA and live starting SHA;
2. S03 revalidation SHA, S03 remediation commit(s), and exact race evidence;
3. S04 code candidate SHA and final documentation head SHA;
4. changed files grouped by S03 remediation and S04 implementation;
5. consumer/owner map and layer-boundary statement;
6. every finding with ID, classification, evidence, impact, dependency, root fix, tests, acceptance criteria, and rollback boundary;
7. all preserved behavior and why it was preserved;
8. schema 38, export 30, import wire-format, migration, and financial-impact statement;
9. exact local commands and exit codes;
10. exact GitHub Actions and Cloudflare evidence for the final SHA;
11. five reviewer results and every correction they caused;
12. Control/Workstream states and generated Tracker status;
13. limitations, unverified evidence, explicit deferred decisions, and remaining blockers;
14. exact resume point only if the run stops.

If S03 remediation and S04 are complete, all in-scope findings are fixed, exact-head local/remote gates are green, and the branch is ready for owner/Manus merge review, end with exactly:

```text
S03_CONCURRENCY_REMEDIATED — VERIFIED_ON_INTEGRATION_BRANCH
S04_EXECUTION_COMPLETE — REVIEW_REQUIRED
PR_READY_FOR_EXPLICIT_MERGE_REVIEW — <FULL_FINAL_HEAD_SHA>
NO_MAIN_WRITES_PERFORMED
NO_MERGE_PERFORMED
NO_BRANCH_CLEANUP_PERFORMED
NO_REPOSITORY_WRITES_OUTSIDE_ALLOWED_BRANCH
```

This means ready for independent review and explicit merge approval; it does not authorize ZAI to merge.

If a genuine blocker remains, end with:

```text
EXECUTION_BLOCKED — <exact blocker>
S03_STATUS — <complete or blocked>
S04_STATUS — <complete, partial, or not started>
SAFE_CHECKPOINT — <FULL_SHA>
NO_MAIN_WRITES_PERFORMED
NO_MERGE_PERFORMED
NO_BRANCH_CLEANUP_PERFORMED
NO_REPOSITORY_WRITES_OUTSIDE_ALLOWED_BRANCH
```

Do not claim that a documentation-only issue is a blocker when it can be repaired within this authorized run.
