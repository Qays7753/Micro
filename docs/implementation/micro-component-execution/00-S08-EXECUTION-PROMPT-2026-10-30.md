# Z AI — Finish S07 Review Repair, Then Execute S08 Uninterrupted

## Mission

Continue the Micro component-execution program from the live single integration branch and the existing Draft PR.

This is one uninterrupted, ordered execution with two mandatory parts:

1. Finish the confirmed S07 review/integrity work at its root: reconcile the remote bundle-surface gates and fix the confirmed inventory write-boundary/CAS defect.
2. Only after Part 1 is proven on the exact final pushed head, continue directly into S08 for UNIT-034 (Assets and Equipment) and complete S08 end to end.

Do not wait for an intermediate Manus review, owner confirmation, or another chat message between Part 1 and Part 2. The owner has authorized this continuous execution. However, starting S08 after the S07 gates pass is not the same as accepting S07: keep S07 marked `REVIEW_REQUIRED` until the later independent review and owner decision.

ZAI is the only product-code writer and execution agent. Manus will perform the independent review after delivery. The owner controls stage acceptance and the eventual merge.

Do not declare S07 accepted, do not declare S08 accepted, do not merge anything, and do not write `main`.

Routine documentation corrections, generated Tracker updates, ordinary test failures, ordinary reviewer findings, and ordinary CI/Cloudflare retries are not stop conditions. Diagnose, repair, rerun, and continue. Stop only for a genuine unresolvable contract/financial/security/data-integrity conflict, unavailable secure credentials, unsafe ancestry/worktree drift, or a gate that cannot be repaired without an owner decision. If a genuine blocker occurs, preserve a safe checkpoint and use the blocked delivery contract at the end of this prompt.

Work in bounded, phase-labelled checkpoints so an interrupted session can resume from the last committed boundary. Do not reset, discard, or repeat completed work merely because the conversation or tool output was interrupted.

## Live repository and write boundary

- Repository: `https://github.com/Qays7753/Micro`
- Only allowed branch: `components/integration-20261027`
- Only allowed PR: `https://github.com/Qays7753/Micro/pull/383`
- PR state: Draft; keep it Draft
- Base branch: `main`
- Last verified `main`: `3584aa1d08cea3e0a00623b719fed7f991ce187f`
- Last verified branch head when this prompt was prepared: `6eaa5fa19c8a8718bca3ee62dd496951cefdb40a`
- The branch head is a live starting reference, not an instruction to ignore later commits. Verify it again before writing.

Authorized writes:

- commits only to `components/integration-20261027`;
- updates only to PR #383;
- phase-labelled commits, without rewriting accepted history;
- ordinary documentation, Operations Control, result, handoff, and generated-view updates required by this execution.

Strictly forbidden:

- any write to `main`;
- merge, rebase, force-push, branch deletion, PR closure, branch cleanup, or creation of another branch or PR;
- rewriting S03–S06 or earlier accepted history;
- unrelated cleanup, bulk moves, broad structural refactoring, or a new `features/` layer;
- weakening guards, increasing bundle ceilings/tolerances, disabling tests, adding `.skip`/`.only`, or changing CI policy to hide a failure;
- printing, requesting, storing, committing, commenting, or reporting tokens or private credentials.

Use only the secure GitHub/Cloudflare credential channels already available in the editor. Never put a token in this prompt or any repository artifact.

If the active branch has advanced safely beyond the starting head, continue from the actual live head and re-anchor all evidence to it. If there is unexpected ancestry drift, an unknown competing writer, uncommitted work that would be overwritten, or an unsafe reset would be required, preserve all work and stop with `STATE_DRIFT`; never guess or overwrite.

### Local ZAI environment preservation gate

The previous ZAI session may have completed work in its local environment without pushing every commit or without leaving a clean worktree. Do not assume that GitHub is the whole state until the local environment has been inspected.

Before any reset, checkout, pull, clean, or new edit:

1. Inspect the current worktree, current branch, local HEAD, `git status --short --branch`, reflog, local branches, stashes, and commits that are ahead of or absent from `origin/components/integration-20261027`.
2. Check for an active ZAI process/session or another writer and do not overwrite its files.
3. Inventory unpushed commits and uncommitted files. Read the diffs and classify each item as completed S07/S08 work, the current prompt/documentation work, unrelated work, or unknown work.
4. Preserve every non-empty work item before proceeding. Do not run `reset --hard`, `git clean`, checkout-overwrite, rebase, force-push, or deletion to make the worktree convenient.
5. If local commits are a safe descendant of the live integration branch and belong to this program, retain them, push them normally to the same allowed branch, and re-anchor all later evidence to the resulting exact head.
6. If commits are not descendants but can be reconciled without rewriting history, preserve them and use a normal ancestry-preserving continuation. If reconciliation would require rewriting, dropping, or guessing about work, stop with `STATE_DRIFT` and report the exact local commits/files and safe checkpoint.
7. If uncommitted changes belong to this authorized S07/S08 work, inspect and complete them in place, then commit them with a phase-labelled commit. If they are unrelated or unknown, preserve them and do not mix them into this execution.
8. If the prior session already completed a required test or code change, do not redo it merely because its chat output is missing; verify the actual commit/files and rerun only checks needed for the exact final head.

The local environment is not disposable. The safe objective is to recover and continue the strongest existing work, not to recreate it from the prompt.

## Mandatory reading and live preflight

Read the live GitHub versions, not an old chat transcript. Before product-code edits, read:

1. `AGENTS.md` and all applicable instruction files.
2. `README.md`.
3. `docs/operations/current-state.md` and the append-only current-state log only when an entry is required.
4. `docs/00-document-index.md`.
5. `docs/operations/agent-development-sop-v1.md`.
6. `docs/operations/agent-handoff-protocol-v1.md`.
7. `docs/operations/control/README.md`, schemas, active-work brief, and the live JSON records for the current S07 workstream.
8. `docs/implementation/micro-component-execution/00-PROGRAM.md`.
9. `docs/implementation/micro-component-execution/01-STAGES.md`.
10. `docs/implementation/micro-component-execution/02-PROGRESS-AND-HANDOFF.md`.
11. `docs/implementation/micro-component-execution/00-S07-EXECUTION-PROMPT-2026-10-29.md`.
12. `docs/implementation/micro-component-execution/12-S07-RESULT-2026-10-30.md`.
13. `docs/implementation/micro-component-execution/10a-S05-ADDENDUM-2026-10-30.md` if present and relevant to transfer behavior.
14. The live financial, inventory, supplier-purchase, asset, storage, transfer, migration, and export/import contracts required by the actual affected code.
15. `docs/implementation/micro-component-execution/02-SPECIFICATIONS/03-New-Design/UNIT-034-الأصول-والمعدات.md` in full.
16. `docs/implementation/micro-component-execution/02-SPECIFICATIONS/05-Data-and-Implementation/02-Shared-Data-and-Financial-Contract-AR.md` for the relevant asset, purchase, cash, payment, source, date, knowledge, and ownership rules.
17. `docs/implementation/micro-component-execution/02-SPECIFICATIONS/05-Data-and-Implementation/03-Shared-Data-Acceptance-Cases-AR.md` for every SDF actually executed.
18. `docs/contracts/05-financial-p0-policies.md`.
19. `docs/contracts/06-financial-event-prototype-contract.md`.
20. `docs/contracts/29-group4-deep-finance-contract.md`.
21. `docs/contracts/43-asset-depreciation-prototype-contract.md`.
22. The live source and tests before editing, including the current inventory write paths and existing asset implementation.

GitHub is the operational source of truth. Google Drive is provenance only and is not an execution dependency.

Record a preflight checkpoint with the live branch, PR, base, head, ancestry, worktree state, current schema/export pair, current S07 state, current S08 state, and the safe rollback boundary. Discover Control Item and Workstream identifiers from live JSON sources; never guess or reuse identifiers.

## Part 1 — mandatory S07 repair before S08

S07 remains `REVIEW_REQUIRED`. Do not erase the original finding. Update its result and Control evidence with the correction commit and the final evidence.

### S07-MR-001 — confirmed inventory stale-read/write defect

The confirmed finding is not documentation-only. The current `receivePurchase` path reads materials, movements, and purchase state, validates purchase/line receipt limits, then calls `commitInventory`. The current inventory commit implementations in Memory and IndexedDB write material/movements without checking that the live state still matches the state used for the validation.

This permits two distinct receipt operations to read the same state, both pass a limit check, and both write. It can over-receive a purchase or purchase line and violates the project rule that sensitive writes validate live state inside the write boundary.

Treat this as `S07-MR-001 — FIX_NOW`.

#### Required root correction

1. Reproduce the stale-read scenario using the real application/domain writer path, not a mock-only approximation.
2. Map every affected inventory read-then-write path, including receipt, use, adjustment, reversal, waste, shortage, and any material lifecycle path that reads a live position before committing a movement. Do not fix only the first UI path.
3. Design the smallest safe expected-state/CAS contract that covers the exact state used by each business guard. Reuse the repository’s established `storage_stale`/conflict conventions and existing guarded write patterns. Do not invent a second inventory calculation in the UI.
4. Enforce the comparison inside the actual atomic write boundary in both `MemoryLocalStore` and `IndexedDbLocalStore`. For IndexedDB, the live read, comparison, and all puts must belong to the same read-write transaction. For Memory, preserve equivalent observable behavior and no-partial-write semantics.
5. The guard must cover the purchase and line bounds used by `receivePurchase`, not merely the movement ID being inserted. A movement created by another operation after the application read must cause a truthful stale/conflict result when it changes the relevant bound.
6. Preserve idempotency:
   - same operation key and same payload reuses the committed result truthfully;
   - same operation key with a different payload conflicts without overwrite;
   - a different operation key based on stale state returns `storage_stale` or the repository’s equivalent conflict result without any partial write;
   - failed or unknown writes do not permit a new key to bypass uncertainty.
7. Preserve existing direct storage test-seeding and conformance contracts where they are intentionally low-level. Do not weaken the production application writer. If the port shape must change, update all callers, both adapters, capability contracts, and affected test fixtures in the same phase.
8. Do not solve this with a UI-only reset, a lock timeout, a tolerance, a retry loop that silently rereads and changes the business result, a test-only exception, or a second source of truth.
9. Do not change approved financial meanings, date meanings, quantity/unit semantics, rejection precedence, or schema/export wire keys merely to implement the guard.

#### Permanent regression evidence required before S08

Add or update real tests on both adapters and the real application path for at least:

- two distinct concurrent receipt intents read the same state;
- only one may commit when both would exceed the live purchase or line bound;
- the losing operation returns the established stale/conflict result and writes no movement, no quantity, no shortage, and no financial side effect;
- inventory never exceeds the allowed purchase/line bound;
- no negative stock, duplicate movement, or duplicate financial event is created;
- same-key replay remains idempotent;
- same-key/different-payload conflict remains protected;
- existing use, adjustment, waste, shortage, reversal, and material lifecycle guards remain equivalent on Memory and IndexedDB;
- a valid non-conflicting operation still succeeds;
- failure/unknown-result recovery cannot bypass the live-state guard.

Map every regression to a stable acceptance/finding ID in the S07 result. Do not claim a concurrency test passed if it only exercises Memory or only mocks the storage port.

Use a separate phase-labelled commit for `S07-MR-001`. Do not rewrite S07 history or mix unrelated cleanup into the fix.

### S07 bundle-surface remote gate repair

The last published S07 head failed both remote build gates because the environment records were stale after the final S07 code candidate. The failure was not the hard entry budget:

- entry budget passed at raw `620369` and gzip `151675`, within the unchanged hard limits `650000` and `155300`;
- CI run `40967827533` on head `6eaa5fa19c8a8718bca3ee62dd496951cefdb40a` failed only at `check-bundle-surfaces` because the recorded cloud baseline was still the earlier S06 baseline;
- CI directly measured `lazyRawTotal=1314905`, `lazyGzipNormTotal=394004`, `precacheBytesTotal=2772246`, and `swRuntimeRawTotal=26642`, with counts `109/2/75/164/2`;
- the exact Cloudflare measurement must be verified from the live Cloudflare build, not assumed from CI.

After the S07-MR-001 code correction is complete:

1. Build the actual final S07 candidate locally and record the local surface measurements.
2. Push only to the allowed branch.
3. Wait for and inspect the exact-head GitHub Actions and Cloudflare Pages builds.
4. If the environments measure growth, determine whether it is caused by the S07-MR-001 code and reduce the actual cost when practical. If the documented same-PR re-anchor protocol is the correct remedy, update only the appropriate environment baseline records with truthful provenance from the actual measured build.
5. Never update a baseline using an old SHA, an assumed Cloudflare value, or a self-referential SHA. Never raise `raw`/`gzip` tolerance caps, entry ceilings, bundle budgets, or guard limits.
6. Record the local, GitHub Actions, and Cloudflare SHA/deployment and measurements separately. A green local build does not prove the remote environments.

The final S07 repair candidate must have green exact-head CI and Cloudflare before Part 2 begins.

### S07 transition gate

Before starting S08, all of the following must be true:

- S07-MR-001 has a root fix, permanent regression tests, and reviewer evidence.
- The S07 result and Control records classify the finding as fixed/delivered but keep S07 `REVIEW_REQUIRED`.
- The full relevant S07/S06/S05 transfer, inventory, financial, and adapter tests pass.
- `pnpm check` passes on the final S07 repair candidate, unless an explicitly documented genuine environment failure is repaired before proceeding.
- Required document/control guards pass.
- Exact-head GitHub Actions and Cloudflare Pages are green.
- The final S07 head and all evidence are recorded.

If any ordinary test, documentation, or remote gate fails, repair it and continue. Do not wait for a human message. Do not start S08 with a red gate.

## Part 2 — execute S08: UNIT-034 Assets and Equipment

Start S08 automatically once the S07 transition gate is green. Create/update the correct S08 Control Item and Workstream from live JSON sources before S08 product-code edits. The S08 execution may begin even though S07 remains pending independent review and owner acceptance because this prompt explicitly authorizes continuous execution. Do not call that acceptance.

### S08 objective

Implement the narrow, truthful Assets and Equipment capability described by UNIT-034 and the live asset contracts:

- an asset/equipment record with a clear acquisition source;
- cash or payable acquisition where the existing approved source contract supports it;
- the approved partial-payment case where applicable: asset cost `100`, cash paid `40`, remaining payable/right `60`, with each effect recorded exactly once;
- optional depreciation with explicit knowledge and an explicit recording action;
- residual value and note semantics from Contract 43 where the live implementation requires them;
- disposal/write-off and correction/reversal behavior with preserved history;
- exact Memory/IndexedDB parity and export/import/restore compatibility.

### S08 non-negotiable financial and data rules

1. An asset acquisition is one source fact. Do not create an additional operating expense, materials purchase, inventory receipt, generic income/expense, or duplicate payment for the same acquisition.
2. A cash acquisition reduces cash exactly once and increases the asset source exactly once. A payable acquisition creates the asset and the payable exactly once and does not create cash movement until an actual payment from the payable source occurs.
3. For the approved partial-payment acceptance case, preserve the distinction between asset cost, cash paid, and remaining payable/right. Do not label the full acquisition as fully paid, do not create a second purchase to represent the balance, and do not hide the unpaid part as an unknown zero.
4. Payment, receipt, acquisition, depreciation, disposal, and write-off are distinct meanings. Opening a page or changing a label has no financial effect.
5. A saved supplier/party reference is optional where the live contract permits it, uses a stable ID, and preserves a historical name snapshot. Never merge parties by name or create a duplicate supplier merely to save an asset.
6. An existing asset with incomplete historical evidence remains explicitly incomplete/unknown. Do not invent a purchase date, current market value, useful life, residual value, financing, cash outflow, or depreciation history.
7. The asset remains separate from tracked materials, saleable products, recipes, and ordinary operating expenses. Do not classify an asset by name or price alone.
8. Depreciation is optional and explicit:
   - missing/unknown life or start date remains unknown and produces no invented schedule;
   - a proposal is a read-only calculation and does not change events or results;
   - recording requires an explicit user action;
   - recording creates one deterministic non-cash event;
   - replay is idempotent;
   - depreciation does not create a new cash payment or operating expense event;
   - residual value follows the live Contract 43 semantics: valid residual is `0 <= residual < acquisition`, the depreciable base is acquisition minus residual, and completed depreciation settles book value at residual rather than below it;
   - already-recorded history is never silently rewritten by a later contract revision.
9. Use the repository’s established integer minor-unit arithmetic, local business dates, injected clocks, and safe date helpers. Never use floating-point money or browser time for financial dates.
10. Disposal freezes the book value at the event, records proceeds and gain/loss according to the asset contract, and does not treat all proceeds as revenue. Write-off is a distinct non-cash outcome. No general delete may erase an asset with financial history.
11. Corrections and reversals preserve the original event, source, reason, date, idempotency key, and relationships. No correction may create a second cash movement or silently rewrite prior depreciation.
12. Every sensitive write validates live state inside its write boundary and has an honest `recorded`, `reused`, `conflict`, `failed`, or `result_unknown` outcome as applicable. Memory and IndexedDB must implement the same contract.
13. Preserve the current supported schema/export pair unless a durable shape change is genuinely required. If a bump is required, implement the complete migration and compatibility matrix in the same phase. Do not bump versions for a UI-only change.

### S08 scope and non-goals

In scope:

- the canonical asset domain model and policies;
- asset acquisition/service orchestration and source ownership;
- cash/payable/partial-payment integration only through the existing canonical writers and contracts;
- explicit depreciation proposal/record/reversal and residual-value behavior;
- disposal/write-off and acquisition correction where the live contract requires it;
- Asset list/detail/editor flows and all meaningful states;
- storage port, Memory adapter, IndexedDB adapter, capability conformance, idempotency, conflict handling, and rollback behavior;
- export/import/restore/migration compatibility for assets, financial events, source references, revisions, and historical snapshots;
- relevant period/summary readers only where required to prevent a second writer or a false financial classification;
- permanent domain, application, adapter, transfer, and UI regression tests;
- documentation, Control, result, handoff, and exact-head evidence.

Out of scope unless the live contract explicitly proves it is already part of the current S08 slice:

- loans as a replacement for payable acquisition;
- a new commercial-return system for assets;
- tax depreciation, revaluation, component depreciation, intangible assets, capitalized interest, or automatic monthly posting;
- cloud sync, authentication, authorization, multi-user state, SaaS, push, or server-side storage;
- automatic allocation of depreciation to every order, sale, recipe, or pricing calculator;
- a new global financial ledger or second summary source;
- broad refactoring, bulk file moves, splitting large stores/services, or reorganizing module boundaries;
- implementing unresolved opening/legacy-asset policy by inventing a financial value or cash event.

If a neighboring contract must be touched, change only the smallest source-owned boundary needed, preserve its owner, add integration tests, and record why it was touched. Do not rebuild S04–S07 components.

### S08 required acceptance coverage

Map each executed test to an acceptance ID and report unexecuted evidence honestly. At minimum, cover:

#### Asset acquisition and source integrity

- empty list and read failure are truthful; no zero-valued fallback;
- create an asset without forcing depreciation inputs;
- cash acquisition records one asset source and one cash delta, with no operating expense duplicate;
- payable acquisition records one asset source and one payable/right, with no cash movement until payment;
- partial-payment acceptance: asset `100`, cash `-40`, remaining payable/right `60`, exactly once;
- a valid supplier/party reference is stable and a historical name snapshot is preserved;
- no supplier/party is duplicated by name;
- an existing asset with incomplete evidence does not create a new purchase or cash movement;
- repeated create/payment/acquisition submissions reuse or conflict truthfully and never duplicate events;
- concurrent acquisition/payment windows cannot overpay, overwrite, or create two source events;
- failed cleanup, reload, back navigation, cancellation, and unknown-result recovery do not duplicate the acquisition.

#### Depreciation and asset lifecycle

- unknown life and unknown start remain explicit and produce no schedule;
- first-full-month and day-boundary behavior follows the live Contract 43 rules;
- residual values validate before any write;
- monthly depreciation uses integer floor arithmetic over acquisition minus residual;
- final scheduled amount reaches acquisition minus residual exactly and leaves book value at residual;
- a proposal changes nothing until explicit recording;
- recording creates one non-cash event and repeated recording is idempotent;
- changing the contract records a reasoned revision without rewriting recorded depreciation;
- reversal is documented, linked, non-cash, and cannot be reversed twice;
- disposal freezes book value and distinguishes proceeds from gain/loss;
- write-off is non-cash and preserves the record;
- no depreciation is recorded after disposal/write-off;
- an asset at residual or zero book value is not deleted and does not create an invented loss;
- correction after depreciation/disposal either updates eligible dependencies atomically or rejects with no partial write.

#### Storage, transport, and compatibility

- Memory/IndexedDB capability conformance for every changed asset operation;
- same-key/same-payload reuse and same-key/different-payload conflict;
- live-state/CAS protection for sensitive asset and source writes;
- old supported asset records without newer optional fields remain readable with their historical knowledge preserved;
- export → prepareImport → restore → confirmImport → re-export preserves asset IDs, event IDs, source references, dates, snapshots, revisions, residual/note knowledge, idempotency keys, and financial meaning without replaying effects;
- malformed or broken asset/event/source relationships are rejected before preview and before target writes;
- rejected or unknown restore leaves the target store unchanged;
- current S05 party-reference and S06 financial protections remain active after S08 changes;
- no schema/export wire-key or rejection-precedence change without complete compatibility evidence.

#### UI and mobile behavior

Test the actual product flows in Arabic RTL and portrait/mobile constraints, including:

- empty, loading, read failure, create, edit, cancel, back, success, error, partial-payment, payable, unknown, and archived states;
- asset detail with acquisition source, paid/remaining meaning, book value, depreciation proposal versus recorded amount, and disposal/write-off context;
- repeated tap, reload, navigation interruption, focus/keyboard, long text, validation, and recovery;
- clear distinction between asset value, cash paid, payable remaining, book value, depreciation proposal, recorded depreciation, and sale proceeds;
- no false claim that unknown information equals zero;
- RTL, Arabic text, 0–9 numeric input, Light Mode, named accessible controls, dialog/sheet focus, and available error/status announcements.

A Showcase/mockup is not product evidence. Record simulated browser checks separately from any real device check.

## Implementation and architecture constraints

Preserve the established layering:

`UI → Application → Domain → Storage Port → Memory/IndexedDB`

- UI does not own financial policy, depreciation math, import validation, idempotency, CAS, or direct storage calls.
- Domain policies remain pure and receive `asOf`/clock inputs instead of reading browser time.
- Application services orchestrate canonical writers and source references.
- Storage ports define atomic/CAS boundaries; both adapters implement the same behavior.
- Do not create a parallel asset writer, financial ledger, supplier ledger, or summary source.
- Use existing public application doors and touchpoint registries. Add or update a door only when required by the actual architecture, and update its exact guard with evidence.
- Do not remove Memory because it appears duplicated.
- Keep structural work out of S07/S08. The post-Group-6 structural gate forbids broad structural refactoring here; make the smallest local change and record any unrelated structural issue as a specific `DEFER` with evidence and rollback boundary.

Before changing any durable shape, inspect the actual schema/export versions and accepted pairs. If a durable field, event, store, relationship, or transfer shape changes, update all required types, both adapters, migrations, transfer/export/import/restore validators, fixtures, conformance tests, touchpoints, documentation, and rollback evidence in the same phase.

## Execution sequence and no-pause rule

Use this exact sequence and continue without asking for confirmation between steps:

1. Live preflight and checkpoint.
2. S07-MR-001 characterization.
3. S07 CAS/root fix in phase-labelled commit(s).
4. Focused S07 regression suites and adapter conformance.
5. S07 documentation/Control/Tracker updates from JSON sources.
6. S07 final local build, bundle measurements, and exact-head remote CI/Cloudflare verification.
7. If remote baselines require re-anchoring, perform only the documented same-PR re-anchor with measured provenance, then rerun the remote gates.
8. Run the five sequential read-only reviewers for the final S07 repair candidate. Reviewers do not edit. Fix every confirmed in-scope finding and rerun affected checks.
9. Confirm S07 is delivered but `REVIEW_REQUIRED`; do not self-accept it.
10. Create/update S08 Control Item and Workstream from live JSON sources.
11. Read and map UNIT-034, Contract 43, the shared financial contract, and all actual affected source/tests.
12. Implement S08 in coherent phase-labelled commits with focused tests after each coherent checkpoint.
13. Run focused S08 and affected S04–S07 compatibility tests.
14. Run the canonical full check once on the stable S08 candidate:

```bash
pnpm check
```

15. Run the required JSON-first control and documentation checks:

```bash
python3 scripts/operations-control/validate.py
python3 scripts/operations-control/generate_tracker.py
python3 scripts/operations-control/generate_tracker.py --check
node scripts/check-doc-index-coverage.mjs
node scripts/check-current-state-size.mjs
node scripts/check-agent-document-contract.mjs
git diff --check
```

16. Run all relevant prototype build, bundle-budget, and bundle-surface gates. Do not change their ceilings or tolerances.
17. Run exactly five distinct sequential read-only reviewers on the final S08 candidate:
   - architecture/ownership/layer boundaries;
   - domain/financial/data/storage/CAS/concurrency/Memory-IndexedDB parity;
   - UI/runtime/RTL/mobile/accessibility/states;
   - tests/CI/security/transfer/operations;
   - documentation/product contract/Control/Tracker/provenance/handoff.
18. Fix every confirmed in-scope finding at its root on the same branch and PR, add regression coverage, rerun affected checks, and have the relevant reviewer reread the corrected diff.
19. Push only the final S08 candidate to `components/integration-20261027`, wait for exact-head GitHub Actions and Cloudflare Pages, and verify both are green on that exact final head.
20. Finish with S07 and S08 delivered for independent review. Do not start S09.

If a command is long, record its start and checkpoint state before running it. If the agent/tool session is interrupted, inspect the live branch and commits first, determine what completed, and resume from the last exact checkpoint. Do not redo completed commits or claim completion from an unfinished command.

## Operations Control, result, and handoff requirements

Update JSON sources first; regenerate official views through the repository generator; never edit generated views manually.

For S07, update the existing live S07 result/Control/Workstream with:

- `S07-MR-001` evidence, root cause, fix commit(s), tests, classification, and rollback boundary;
- bundle-surface failure, actual measurements, exact CI/Cloudflare evidence, and any same-PR re-anchor provenance;
- S07 status `REVIEW_REQUIRED`, not accepted;
- exact final S07 repair head and transition evidence.

For S08, create/update its own live Control Item and Workstream and result report with:

- live base and final candidate/documentation SHAs;
- exact ancestry and worktree state;
- implementation scope and explicit non-goals;
- owner/consumer/source-of-truth map;
- changed files grouped by domain, application, storage, transfer, UI, tests, documentation, and reviewer corrections;
- financial, date, quantity, knowledge, schema, export, import, restore, migration, compatibility, and rollback impact;
- exact acceptance IDs executed and evidence for each;
- exact commands, exit codes, test counts, environment, and SHA;
- exact GitHub Actions and Cloudflare evidence for the exact final pushed head;
- all five reviewer results and every finding/correction;
- what is verified, unverified, preserved, deferred, and out of scope;
- S08 status `REVIEW_REQUIRED` and the exact independent-review handoff;
- explicit statement that no `main` write, merge, rebase, force-push, branch deletion, cleanup, second branch, or second PR occurred.

Update `docs/implementation/micro-component-execution/02-PROGRESS-AND-HANDOFF.md`, `docs/operations/current-state.md`, the required append-only worklog, document index/Manifest, and PR #383 evidence only when required by the live repository contract. Keep the current-state file within its size guard.

Do not put a self-referential SHA into the commit that is being created. Record the resulting full SHA afterward in the result and PR evidence.

## Stop/resume conditions

Do not stop for:

- routine documentation mismatch;
- generated-view mismatch that can be regenerated;
- ordinary failing tests;
- ordinary reviewer findings;
- ordinary CI/Cloudflare surface drift that can be repaired by measured same-PR re-anchoring;
- the need to continue from S07 into S08;
- lack of an intermediate human response.

Stop only for:

- `STATE_DRIFT`: unsafe ancestry, competing writer, or worktree conflict;
- `CREDENTIAL_CHANNEL_UNAVAILABLE`: secure credential channel unavailable;
- a genuine unresolved conflict between approved financial/data contracts that cannot be resolved without an owner decision;
- a destructive migration or wire-format change with no compatible implementation and no owner authorization;
- a gate that cannot be repaired without weakening a guard or changing an approved contract.

When stopped, preserve a safe commit checkpoint, update the relevant JSON/result/handoff records, and report the exact next command/action. Never reset or hide the partial work.

## Final delivery contract

When both parts complete, the final response must end with exactly this block, replacing placeholders with real full SHAs and actual statuses:

```text
S07_REVIEW_REPAIR_DELIVERED — S07-MR-001 — REVIEW_REQUIRED
S07_REMOTE_GATES_GREEN — <FULL_FINAL_S07_OR_SHARED_GATE_HEAD_SHA>
S08_EXECUTION_COMPLETE — REVIEW_REQUIRED
PR_READY_FOR_INDEPENDENT_REVIEW — <FULL_FINAL_DOCUMENTATION_HEAD_SHA>
S08_NEXT_ACTION — MANUS_INDEPENDENT_REVIEW_AND_OWNER_ACCEPTANCE
NO_MAIN_WRITES_PERFORMED
NO_MERGE_PERFORMED
NO_REBASE_PERFORMED
NO_FORCE_PUSH_PERFORMED
NO_BRANCH_CLEANUP_PERFORMED
NO_SECOND_BRANCH_OR_PR_CREATED
NO_REPOSITORY_WRITES_OUTSIDE_ALLOWED_BRANCH
```

If a genuine blocker remains, the final response must end with exactly:

```text
EXECUTION_BLOCKED — <EXACT_BLOCKER_ID_AND_REASON>
S07_STATUS — <COMPLETE_PARTIAL_OR_NOT_STARTED>
S08_STATUS — <COMPLETE_PARTIAL_OR_NOT_STARTED>
SAFE_CHECKPOINT — <FULL_SHA>
NEXT_ACTION — <EXACT_RESUME_ACTION>
NO_MAIN_WRITES_PERFORMED
NO_MERGE_PERFORMED
NO_REBASE_PERFORMED
NO_FORCE_PUSH_PERFORMED
NO_BRANCH_CLEANUP_PERFORMED
NO_SECOND_BRANCH_OR_PR_CREATED
NO_REPOSITORY_WRITES_OUTSIDE_ALLOWED_BRANCH
```

The final state is ready for independent review and explicit owner acceptance on the integration branch. It is not a merge authorization and is not `VERIFIED_ON_MAIN`.
