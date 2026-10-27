# Micro — S02 Execution Prompt — 2026-10-27

**Status:** `READY_FOR_ZAI` — owner-authorized execution prompt.
**Program:** Micro Component Execution.
**Stage:** S02 — write protection, restore safety, and PIN/lock removal.
**Repository:** `Qays7753/Micro`.
**Integration branch:** `components/integration-20261027`.
**PR:** #383 (Draft; keep it Draft).
**Verified pre-publication branch head:** `a8b640c1e2de3c3d1962d01d1795947b59c87b77`.
**Execution baseline rule:** the commit that publishes this prompt is the documentation checkpoint immediately after the verified pre-publication head. Before any product-code write, fetch the live branch and record the exact full SHA of the current prompt-containing head as `S02_BASE_SHA`. Do not execute from an older copy or from the pre-publication SHA if the live branch has advanced coherently.
**Main:** do not write, merge, rebase, force-push, or clean up `main`.

> This is the only S02 execution prompt. ZAI reads the GitHub copy at the live commit that contains this file. Google Drive is provenance only and is not an execution input. The previous file `00-S02-TASK-DRAFT-2026-10-27.md` is preserved as a historical review record and is not an executable authority.

## 1. Mission

Execute S02 completely within its approved boundary. Deliver a safe, explicit implementation for:

1. removing the obsolete in-app PIN/application-lock behavior from startup, settings, restore, return, and action paths without introducing a replacement authentication product; and
2. making backup/restore a truthful, protected, durable, atomic local replacement flow with correct revision, generation, draft, concurrency, rollback, and unknown-outcome handling.

Complete the shared S02 contracts owned by this stage: `SH-02` intent/outcome/revision/generation, `SH-03` snapshot replacement and draft generation, and `SH-04` PIN removal while preserving non-lock protections.

If you find an additional defect inside this S02 boundary, investigate it to root cause, fix it in this same PR, add regression evidence, and assign a stable finding ID. Do not use a generic defer for an in-scope defect. If a matter is genuinely outside S02, record the exact trigger, owner, and blocking boundary and stop before silently expanding the scope.

## 2. Authority and required reading

Read the live repository first, in this order:

1. `AGENTS.md` and the task-specific reading bundle required by it.
2. `docs/operations/current-state.md`, the relevant current-state log entry, Operations Control records `DOC-011`/`WS-227`, and the S02 stage card in `docs/implementation/micro-component-execution/01-STAGES.md`.
3. `docs/implementation/micro-component-execution/02-PROGRESS-AND-HANDOFF.md` and `DEPENDENCIES-AND-TRACEABILITY.md` for the current handoff and ownership map.
4. `docs/implementation/micro-component-execution/02-SPECIFICATIONS/03-New-Design/UNIT-042-قفل-التطبيق.md` in full.
5. `docs/implementation/micro-component-execution/02-SPECIFICATIONS/03-New-Design/UNIT-044-النسخ-الاحتياطي-والاستعادة.md` in full.
6. `docs/implementation/micro-component-execution/02-SPECIFICATIONS/05-Data-and-Implementation/02-Shared-Data-and-Financial-Contract-AR.md` and `03-Shared-Data-Acceptance-Cases-AR.md` in the sections relevant to S02.
7. The affected portions only of UNIT-038, UNIT-001, UNIT-002, JRN-001, and JRN-008, plus the live contracts and tests named by the stage card.
8. `docs/implementation/micro-component-execution/S02-DRIVE-GITHUB-RECONCILIATION-2026-10-27.md` only as provenance. The GitHub specification files above are the authority.

Do not read or use Drive. Do not use the historical UNIT-001/UNIT-002 implementation prompts as current instructions. Do not treat the old S02 draft, a prior chat message, or a report claim as authority over this prompt and the live repository.

## 3. Roles and permissions

- The owner authorizes this execution and remains the only authority for merge to `main` and final program transition.
- Manus owns orchestration, prompt design, independent review, and documentation reconciliation.
- ZAI is the only product-code writer for this S02 wave. Use one sequential implementation writer and five sequential read-only reviewers after each coherent implementation set.
- ChatGPT is not an active S02 reviewer or gate. Do not wait for ChatGPT and do not attribute a new review to ChatGPT.
- Internal reviewers are read-only. One writer may apply the approved in-scope fixes after reviewer findings; reviewers must not edit the repository.

<!-- WRITE_BOUNDARY: BRANCH_AND_PR_ONLY -->
## 4. Write boundary

All writes must remain on `components/integration-20261027` and PR #383.

Allowed:

- product code, tests, migrations, adapters, fixtures, generated maps, Control records, result/handoff records, current-state append-only evidence, and the document index only when required by S02 and supported by evidence;
- separate understandable commits for S02-A, S02-B, S02-C, S02-D, and later correction commits that remain clearly attributable to S02;
- official generation of Tracker views from JSON Control sources.

Forbidden:

- direct writes or merges to `main`;
- creating another implementation branch or another PR;
- branch deletion, cleanup, rebasing, force-pushing, or rewriting accepted history;
- CI-policy changes, guard weakening, tolerance/ceiling increases, or deployment configuration changes;
- bulk file moves, structural refactoring, global module reorganization, or architecture cleanup;
- starting S03 or any later stage;
- claiming S02 accepted, `VERIFIED`, or merge-ready merely because CI is green.

<!-- NO_MAIN_WRITES -->
<!-- NO_BRANCH_CLEANUP -->
<!-- SECURE_CREDENTIALS: use only the secure credential field; never print, store, paste, or commit tokens -->

## 5. Scope and invariants

### 5.1 UNIT-042 — remove PIN and lock behavior

Remove the actual lock-only consumers after inventory and characterization, including the application lock cover, idle lock timers, lock configuration, PIN setup/change/disable flows, PIN gates, and lock-only session state.

Preserve all protections that are about data safety rather than user identity: explicit confirmation, file validation, integrity checks, revision/concurrency checks, rollback protection, ordinary error handling, financial write guards, and safe pending-action behavior. A previously enabled lock must not block startup, restore, or return after the change. A pending gated action must never execute automatically after refresh, migration, navigation, or lock retirement; it requires a new explicit user intent and confirmation.

Do not replace PIN with fingerprint, device code, account login, cloud authentication, roles, or another in-app security product. Do not delete identities, profiles, transactions, saved business drafts, financial data, historical records, or independent integrity/encryption behavior. Retire or migrate obsolete lock-only records only with a known outcome and evidence.

### 5.2 UNIT-044 — backup and restore

Keep one clear local settings entry for backup and restore. Do not add a cloud-sync, account, or parallel restore product.

Backup must read a consistent snapshot and distinguish preparing a file from platform-confirmed retention. A browser `link.click()` is not proof that a user retained the file.

Restore must:

- select one file without writing business data on selection;
- validate schema/export versions, supported families, relationships, knowledge, and coverage;
- show a review/preview;
- require one confirmation bound to the same file and current revision;
- reject malformed, unsupported, corrupt, changed-after-preview, conflicting, cancelled, quota, and late-failure cases with truthful outcomes;
- establish and durably verify an independent rollback copy or equivalent recovery mechanism before destructive replacement. An object store destroyed by the same replacement, an in-memory value, or `download.click()` is not sufficient;
- replace the supported snapshot atomically as one bounded operation, never merge files, replay business events, create sales/collections/opening balances, or expose partial writes;
- preserve transient drafts with protected old state before atomically clearing/invalidating old-generation drafts, while keeping saved business drafts distinct from transient form drafts;
- issue a new local generation in the same atomic replacement boundary;
- reject an old command even when `projectId` is unchanged;
- resolve interruption/unknown outcomes using durable replacement markers, generation, receipts, or equivalent evidence. Do not claim that nothing changed, retry blindly, restore old state automatically, or create a new command key merely because a response timed out.

A confirmed cancellation or rejection before commitment performs no business write. A confirmed abort leaves the complete old state. A confirmed commit yields the complete new state, never a mixture. An unresolved required destructive-write outcome blocks a new replacement intent until resolved.

Treat `localSchemaVersion=38` and `localExportVersion=30` as protected baselines. Do not change them or the protected wire contract under this general authorization. If live evidence proves that such a change is required, stop before implementing it and report the exact before/after representation, affected families, paired Memory/IndexedDB adapters, migrations, import/export compatibility, fixtures, counters, guards, and recovery plan for explicit owner authorization.

### 5.3 Shared ownership

Produce a writer-adaptation matrix before writes. For every affected writer/capability, record: current owner, source of truth, revision/generation check inside the commit, shared replacement coordination, outcome recovery, tests, and disposition (`adapt now`, `already compliant with evidence`, or `later stage owner`). No newly exposed or affected writer may run outside its guard.

Within one qualified transaction, check the live project/generation, original receipt/result when present, live revisions/invariants, then write the qualified source/dependencies and receipt together. The same intent, payload, and context returns the original outcome without a second effect. The same intent with a changed payload is rejected without silently generating a replacement key. A stale generation is rejected before treating an imported historical receipt as permission.

Do not create the four candidate stores merely because the shared contract mentions them. Decide receipt representation only at the first proven need from the live source and document the decision.

S02 closes only the current protection boundary and PIN-dependent paths. It does not claim full UNIT-044 closure for future families owned by later stages. State the completed boundary, remaining family, owner, and evidence explicitly.

## 6. Required execution phases

### Phase 0 — live preflight and safe resume

Fetch refs and verify the live `main`, integration branch, PR #383, worktree status, current Control records, and the exact prompt-containing head. Record `S02_BASE_SHA`. Inspect existing commits and uncommitted work without resetting or recloning over unknown work. Stop on unexplained drift, another writer, a conflicting claim, or an unexpected file.

### Phase 1 — consumer, ownership, and contract inventory

Before changing code, produce a machine-checkable inventory of every reader and writer of lock/PIN/local-security state; startup, settings, restore, import, reset, background/idle, return, and pending-action paths; every supported snapshot family, adapter, migration, export/import fixture, form-draft store, generation/revision field, and rollback path touched by the live implementation; every test, guard, generated map, and documentation record asserting the old behavior; exact current schema/export versions and whether each proposed change is wire-visible or local-only; and the writer-adaptation matrix with no uncovered writer capable of racing replacement.

For every deletion, name its replacement owner or state why no replacement is correct. Do not call a feature fixed merely because a button or route disappeared.

### Phase 2 — characterization and root design

Characterize enabled legacy lock startup/return after idle or background, restore with and without legacy lock state, invalid/unsupported/corrupt/changed/cancelled/quota/late-failure/unknown-outcome restores, concurrent windows, stale drafts, rollback durability across reload/crash boundaries, and Memory/IndexedDB parity.

Classify every result as `VERIFIED`, `INFERRED`, `UNVERIFIED`, `NOT_EXECUTED`, `DEFERRED`, or `BLOCKER`. Never invent a result the environment cannot prove.

### Phase 2-A — UNIT-044 gates

Map U044-D01..D05 to concrete source evidence: supported families and owners/validators/adapters/migrations/round-trip; transaction, cross-window writer fence, durable replacement outcome, independent rollback protection, and draft preservation/invalidation/recovery including interruption and quota injection; existing supported-format/version limits and measured size/memory/time boundary without altering the guarded 32KB draft boundary; first-use/settings/identity and PIN retirement with existing data, drafts, and independent cryptographic material; and approved financial meanings and historical compatibility without reopening settled decisions or implementing later financial fields.

A required unresolved safety gate blocks its affected destructive write. These are engineering evidence gates, not a new approval round for already-settled product decisions.

### Phase 3 — controlled implementation waves

Use separate commits in this order unless live evidence proves a safer equivalent:

1. **S02-A — restore protection boundary:** implement and test the real snapshot/revision/rollback/restore boundary without depending on PIN.
2. **S02-B — PIN/lock removal:** remove lock-only consumers, gates, timers, and obsolete lock state after the restore boundary is protected; keep non-lock protections.
3. **S02-C — integration and compatibility:** update affected first-use/settings/restore/return flows, drafts, Memory/IndexedDB parity, migrations, import/export, fixtures, generated maps, and documentation only for proven contract changes.
4. **S02-D — acceptance evidence:** add deterministic tests for the complete S02 matrix, update JSON Control sources and generated views, update result/handoff/current-state/index/worklog records, and prepare the exact candidate for review.

Do not hide semantic, financial, schema, export/import, security, or deletion changes inside a documentation or cleanup commit.

## 7. Required acceptance coverage

The mandatory S02 primary cases are `SDF-037`, `SDF-038`, `SDF-042`, `SDF-043`, `SDF-049`, `SDF-051`, and `SDF-057`.

Map evidence for same command and payload after a lost response producing one outcome/effect; changed payload on the same key rejected without writes; unknown outcome retaining the same intent and blocking another until resolved; quota/late failure not exposing partial replacement; independent durable prior-state protection before destruction; marker/generation evidence resolving unknown outcome to complete old or complete new state; no PIN at startup/settings/return/import/reset; legacy enabled/failed-retirement paths not re-locking or erasing business data; pending gated actions requiring new intent; consistent snapshot, no write on selection/cancel, supported/invalid files, preview binding, rollback, restart/recovery, draft preservation, retry/window fences, first-use/settings/return, truthful copy, accessibility, and offline behavior; applicable malformed/version/size/generation/history and currently supported round-trip cases; and Memory/IndexedDB parity with all affected adapters/migrations/fixtures.

Keep U044 ACD ownership/dependency traceability distinct from acceptance cases. Preserve the relevant existing transfer round-trip, asset residual, adapter conformance, rollback rehearsal, lock characterization, and domain/shared suites. Derive exact commands from live package scripts and record exit codes and tested heads. Phone/RTL checks cover 360x800, 390x844, and 430x932; distinguish browser emulation from a physical device and mark unavailable device evidence `NOT_EXECUTED`.

## 8. Financial, data, security, and architecture invariants

- No new financial event, amount/date reinterpretation, cash/profit/debt/owner-money rewrite, historical replay, or silent restatement.
- No deletion of business stores, profiles, transactions, saved business drafts, historical records, or export/import fields merely because the project currently has no users.
- No `localStorage` fallback for authoritative or financial data.
- Removing PIN must not weaken file validation, revision/concurrency guards, rollback protection, integrity checks, or financial write guards.
- Preserve schema 38 and export 30 unless the specific stop-and-owner-authorization procedure above is completed.
- Do not perform structural refactoring, bulk moves, global module reorganization, or architecture cleanup. If one becomes necessary, stop and invoke the mandatory read-only Structure/Architecture/Code Organization Scan gate before proceeding.

## 9. Five sequential read-only reviewers

After each coherent S02 implementation set, run five sequential read-only reviews on the exact candidate SHA:

1. architecture, ownership, layer boundaries, and deletion safety;
2. storage, data integrity, rollback, migration, and financial invariants;
3. UI/runtime, navigation, RTL, accessibility, and failure states;
4. tests, CI, security, concurrency, and operability;
5. documentation, Control, evidence, and specification consistency.

Each reviewer must report every finding with ID, classification (`FIX_NOW`, `PRESERVE`, `DEFER`, or `OUT_OF_SCOPE`), exact evidence, affected paths, impact, root remediation, tests, acceptance criteria, and rollback boundary. Reviewers are read-only. The single writer may fix in-scope findings in additional S02 commits.

## 10. Verification and delivery contract

<!-- REPORT_CONTRACT -->
For the final candidate, record the exact `S02_BASE_SHA`, candidate SHA, branch, PR, changed files, and commit grouping by S02 sub-wave; schema/export/import/migration and financial impact including explicit `NONE` where proven; all local, GitHub CI, Cloudflare Pages, and device commands, environments, exit codes, links, and exact tested heads; the acceptance matrix with `VERIFIED`, `INFERRED`, `UNVERIFIED`, `NOT_EXECUTED`, `DEFERRED`, or `BLOCKER` per case; every finding and final classification; what was not changed including `main`, branch structure, cleanup, CI policy, and unrelated components; and the recovery/rollback boundary and exact resume point.

Update JSON Control sources first, then run the official generator and checks. Never hand-edit generated Tracker views. Keep `current-state.md` below its size guard and append a dated event to `current-state-log.md`. Update the document index and sequential worklog. Do not claim acceptance, `VERIFIED`, or merge readiness from a green CI result alone.

## 11. Stop conditions and final markers

<!-- STOP_CONDITIONS -->
Stop immediately and report a blocker for unexplained head drift, unknown write outcome, missing/conflicting authority, an unexpected file, a required financial/schema/export/import decision, a need for structural refactoring, a failed guard, a partial/unknown restore outcome, or any test/CI failure that cannot be root-fixed within S02.

Do not ask for routine clarification. Continue from the last safe checkpoint when the path is authorized and unambiguous. Ask the owner only when this prompt explicitly requires a new authorization or when a hard stop is reached.

The execution must stop at review delivery. It must not merge, write `main`, delete branches, start S03, or change CI policy.

Required success markers:

```text
S02_EXECUTION_DELIVERED — REVIEW_REQUIRED
NO_MAIN_WRITES_PERFORMED
NO_MERGE_PERFORMED
NO_BRANCH_CLEANUP_PERFORMED
NO_S03_STARTED
```

A later owner acceptance of S02 on the integration branch remains separate from `VERIFIED` on `main` and from final program merge approval at S18.

<!-- NO_MAIN_WRITES_PERFORMED -->
<!-- NO_MERGE_PERFORMED -->
<!-- NO_BRANCH_CLEANUP_PERFORMED -->
<!-- NO_S03_STARTED -->

FINAL_WRITE_BOUNDARY: NO_MAIN_WRITES, NO_MERGE, NO_BRANCH_CLEANUP, NO_BRANCH_CREATION, NO_S03, NO_CI_POLICY_CHANGES.
