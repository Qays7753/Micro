# Zed AI — Micro UNIT-001 V3 Controlled Review and Remediation

## Mission

Execute one controlled UNIT-001 V3 review and remediation wave on the existing long-lived component-program branch. The objective is to reconcile the newly published GitHub-canonical V3 specification with the already implemented UNIT-001 behavior, prove what is already correct, fix every verified in-scope defect at its root, update tests and canonical records, and deliver one reviewable PR state. Do not restart UNIT-001 from zero and do not begin UNIT-002 or a general redesign program.

## Exact repository state

- Repository: `Qays7753/Micro`
- Existing integration branch: `components/integration-20261018`
- Existing PR: `https://github.com/Qays7753/Micro/pull/378`
- Pre-publication branch head: `50343728c63059a85eec7d9bdd886bf83c3f1cd4`
- Known base at publication: `main` at `fd5d7ce689d32d8dcc462bcea2ff1c006256f064`
- Current source specification: `docs/product/components/UNIT-001-PROJECT-SETUP-SPEC-V3.md`
- Historical specification: `docs/product/components/UNIT-001-PROJECT-SETUP-SPEC-V2.md`
- This prompt: `docs/architecture/refactoring/r11-unit001-20261018/R11-UNIT001-V3-EXECUTION-PROMPT-2026-10-18.md`
- The current branch is the only long-lived component-program branch. Do not create another feature branch.

The remote state is authoritative. The listed SHAs are checkpoints, not permission to reset. A publication commit may make the live head newer than the pre-publication head.

## Source-of-truth and provenance rule

Read the V3 specification from GitHub only. Do not access or require Google Drive. The Drive file is provenance only; it has already been transcribed into the GitHub V3 file. Do not invent a second copy of the specification, do not edit the historical V2 file, and do not treat any external copy as an execution authority.

## Write boundary

`BRANCH_AND_EXISTING_PR_ONLY`

Allowed writes:

- commits and pushes to `components/integration-20261018`;
- updates to PR #378 description/checkpoint comments when necessary;
- UNIT-001 production, test, evidence, tracker, and documentation changes explicitly required by V3.

Forbidden writes:

- direct writes to `main`;
- merge, rebase of `main`, force-push, branch deletion, or PR closing;
- changes to PR #376 or #377;
- deployment creation, deployment retry, Cloudflare settings, domains, secrets, or environment variables;
- token requests in chat, token printing, or token storage in any file/log/comment/URL;
- UNIT-002 implementation, unrelated component implementation, global New Design/UI/UX redesign, or bulk structural refactoring.

Use the secure credential field only if GitHub write access is needed. Refer to it only by its secure field name. Never echo or reconstruct it.

## Non-negotiable Micro principles

1. Micro is in development and has no external users or authoritative production data, so a verified defect inside UNIT-001 is fixed durably now rather than hidden behind a workaround.
2. That does not authorize silent semantic changes. Preserve financial meaning, historical meaning, `localSchemaVersion=38`, `localExportVersion=30`, import/export wire formats, rejection precedence, security boundaries, date semantics, and protected contracts.
3. UNIT-001 must create and edit identity only through the existing ownership boundary. It must not create wallets, opening balances, cash events, owner investment, debt, or any financial record. Missing is not zero.
4. One writer only: the main Zed AI execution writes code and documents. All five specialists below are sequential read-only reviewers and must not edit, commit, push, merge, or delete.
5. Every finding receives a stable ID and exactly one classification: `FIX_NOW`, `PRESERVE`, `DEFERRED_WITH_EXACT_TRIGGER`, or `OUT_OF_SCOPE`. Generic defer is forbidden. A safe in-scope root defect is `FIX_NOW`.
6. No structural refactoring, bulk file move, or code-organization change is allowed. If one is genuinely required, stop at that boundary and report it; the Micro post-Group-6 structure gate requires a separate read-only scan, owner decision, and controlled wave.
7. Do not claim that a document decision, CI pass, or local test proves phone behavior or human understanding. Separate `VERIFIED`, `INFERRED`, `UNVERIFIED`, `NOT_EXECUTED`, `DEFERRED`, and `BLOCKER` evidence.

## Phase 0 — safe continuation and live baseline

Before writing:

1. Inspect the current remote branch, worktree, commits, PR #378, open PRs, and the live `main` ref. Do not reset, reclone over existing work, or discard uncommitted work.
2. Confirm that the live branch is `components/integration-20261018` and that the V3 specification and this prompt are present.
3. Read `AGENTS.md`, `README.md`, `CONTRIBUTING.md`, `docs/operations/current-state.md`, `docs/operations/control/README.md`, generated coordination views, `docs/architecture/COMPONENT_CONTRACTS.md`, the V3 specification, the historical V2 specification for context only, and the relevant contracts for identity, Setup, drafts, startup, restore/import, navigation, storage, ownership, schema, and export.
4. Inspect the existing UNIT-001 implementation and tests before deciding what remains. The existing implementation is not presumed incomplete or complete; prove it against V3.
5. Record the exact live base SHA, live branch SHA, PR state, and any state drift. If the branch is not the expected branch or contains unexpected work, stop with `STATE_DRIFT` before modifying anything.

## Phase 1 — V3 reconciliation review before implementation

Produce a bounded evidence map before changing production code. Cover:

- `Feature → Module → Contract → Test → Owner` for Setup, identity creation, existing-project opening, draft save/restore/discard, restore/import entry, startup routing, and the Home success handoff.
- responsibility and ownership for `Setup`, `StartupGate`, `ProfileService`, draft services, local storage adapters, restore/import owner, Settings/044 entry, Home, shared dialog/input/button primitives, and direct tests;
- the five V3 neighbor surfaces: initial cash ownership (022), identity/later rename ownership (039), restore/import ownership (044), optional later completion (002), and shared vocabulary/controls/storage/date contracts;
- storage/application/domain/UI composition, proving UI does not bypass the application boundary or access IndexedDB directly;
- a requirement-to-evidence map for V2 rules `U001-R01..R15`, `U001-F01`, the defined T/AC/B4/B5/B-DUP rows, and the new V3 gates `U001-ORG-AC01..03`.

Resolve from live repository evidence:

- `Q01`: actual restore/import owner, exact route and `returnTo` contract, cancel/back behavior, failure/recovery behavior, replacement protection, and proof that a successful restore cannot create a second identity;
- the actual relationship between Setup and later cash setup, proving that removing initial-cash UI did not delete or bypass the canonical cash owner;
- whether V3’s `ORG-001`, `ORG-002`, `ORG-009`, and `ORG-024` are documentation/ownership constraints for this wave or require a minimal integration change.

Do not guess missing component files. If a neighbor document does not exist, record that fact and inspect the actual repository contract/code owner.

## Phase 2 — controlled root remediation

Implement only what the V3 reconciliation proves is required. Preserve already-correct V2 behavior. In particular:

- keep the name-only first-use task;
- keep the existing identity source and create-only behavior for a missing identity;
- never edit an existing identity from Setup;
- keep read failure distinct from successful empty storage;
- keep draft data separate from final identity and never apply legacy financial values automatically;
- keep restore delegated to its existing owner and preserve cancel/back context;
- prove `U001-ORG-AC01` and `U001-ORG-AC02` with deterministic tests;
- implement or repair `U001-ORG-AC03` and Q01 only if the live review identifies a real gap;
- if Q01 or device behavior cannot be proven with available tools, record the exact blocker and do not fabricate a PASS;
- use exact approved copy and accessibility semantics; do not perform visual token/layout/navigation redesign.

Before deleting or relocating any field, helper, route, or draft value, run a repository-wide consumer census covering imports, dynamic references, tests, fixtures, snapshots, deep links, schema, export/import, and documentation. Prove the replacement owner and add negative tests. Never delete shared storage, restore/import protection, schema/export fixtures, or historical compatibility merely because Setup no longer displays a field.

If an in-scope defect is found in a neighbor boundary, fix only the minimum root cause needed for UNIT-001 and document the cross-component impact. Do not implement the neighbor component as a separate feature.

## Phase 3 — tests and repository gates

For each meaningful implementation commit, run focused tests first and record the result. At minimum, discover and run all applicable tests for:

- Setup UI and lifecycle;
- ProfileService and atomic create-only identity;
- draft save/restore/discard/conflict behavior;
- StartupGate read failure and recovery;
- restore/import and navigation return/cancel behavior;
- Home handoff and success banner;
- IndexedDB/Memory parity where the changed contract requires it;
- accessibility, focus, keyboard/back, RTL, and narrow viewport behavior.

Then run the canonical repository checks without weakening any guard, tolerance, budget, or ceiling:

```bash
python3 scripts/operations-control/generate_tracker.py
python3 scripts/operations-control/validate.py
python3 scripts/operations-control/generate_tracker.py --check
pnpm check
node scripts/check-doc-index-coverage.mjs
node scripts/check-current-state-size.mjs
node scripts/check-agent-document-contract.mjs
git diff --check
```

If a command is not applicable, record `NOT_EXECUTED` with the reason. If it fails, fix the root cause when inside this scope; otherwise stop with a precise blocker. Do not raise baselines, loosen tolerances, disable guards, or retry randomly.

## Phase 4 — five sequential read-only reviewers

After implementation and focused verification, run five sequential read-only specialists against the exact final branch head and diff. They must inspect the repository and evidence, not merely restate this prompt:

1. **Architecture and ownership reviewer:** Setup/profile/draft/restore boundaries, V3 neighbor ownership, duplication retirement, dependency direction, and no structural-scan bypass.
2. **Data/storage/domain/financial reviewer:** identity lifecycle, atomicity, draft isolation, IndexedDB/Memory parity, no-money/no-zero semantics, restore protection, schema 38/export 30, and no hidden data loss.
3. **UI/runtime/accessibility reviewer:** state machine, loading/failure/recovery, exact copy, RTL, focus, keyboard/back behavior, narrow viewport/phone evidence, and no global visual redesign.
4. **Tests/CI/security/operability reviewer:** deterministic tests, negative cases, guards, budgets, CI evidence, secrets, rollback, and deployment side effects.
5. **Documentation/product-contract reviewer:** V3-to-code-to-test-to-owner traceability, ORG-AC/Q01 status, tracker source/generated views, current-state truth, provenance, and stale claims.

Use one synthesizer after RV1–RV5. Every finding must include ID, evidence, affected files, impact, dependencies, minimum fix, tests, acceptance criteria, rollback boundary, and classification. If a reviewer finds an in-scope defect, fix it at the root, rerun the affected reviewer, and update the report. Reviewers never write.

## Phase 5 — canonical records and PR delivery

Update only the relevant canonical records, preserving historical facts and using source JSON before generated views:

- V3 specification and this V3 prompt remain the execution sources;
- `docs/architecture/refactoring/r11-unit001-20261018/R11-UNIT001-V3-EXECUTION-REPORT-2026-10-18.md`;
- `docs/architecture/refactoring/r11-unit001-20261018/R11-UNIT001-V3-FIVE-REVIEWER-RECORD-2026-10-18.md`;
- `docs/operations/control/items/DOC-008.json`;
- `docs/operations/control/workstreams/WS-224.json`;
- `docs/operations/current-state.md` live fields only;
- `docs/operations/current-state-log.md` append-only entry;
- `docs/architecture/refactoring/AGENT-SEQUENTIAL-WORKLOG.md` append-only entry;
- `docs/00-document-index.md`;
- generated Operations Control views regenerated from JSON only.

Keep `DOC-008` and `WS-224` honest. `IN_REVIEW` is valid before an owner-approved merge; `MERGED_UNVERIFIED` and `VERIFIED` are forbidden before the owner’s explicit merge and exact post-merge proof on `main`. Do not close or delete PRs or branches.

The V3 report must include:

1. exact repository, branch, PR, base SHA, final head SHA, and all commit SHAs;
2. GitHub V3 specification path and commit SHA, with Drive provenance clearly separated;
3. V2-to-V3 reconciliation and the list of genuinely new requirements;
4. Feature → Module → Contract → Test → Owner map;
5. Q01 and ORG-AC01..03 evidence matrix;
6. every finding and durable classification;
7. files changed and responsibility of each;
8. consumer census for every deletion or ownership change;
9. focused tests, full checks, CI state, and exact counts/exit codes;
10. five reviewer scopes, findings, reruns, and synthesizer reconciliation;
11. financial, historical, schema/export/import, security, accessibility, and visual-scope statement;
12. device/phone evidence with URL/build/viewport/action/result when executed, or explicit `NOT_EXECUTED`/`UNVERIFIED` reason;
13. rollback boundary and rehearsal result;
14. changes made, changes deliberately not made, unresolved blockers, and exact owner next action.

Update PR #378 with a checkpoint or final comment containing the exact final SHA, scope, checks, reviewer result, and what remains. Do not claim readiness merely because CI is green; all V3 acceptance gates and records must agree.

## Stop conditions

STOP before writing if:

- branch, PR, base, or specification state drifts unexpectedly;
- a required owner decision is missing;
- Q01 cannot be proven and implementation would require guessing;
- a deletion has unresolved consumers or data/history implications;
- a change would alter protected finance, date, schema, export/import, security, or rejection semantics;
- the work requires structural refactoring, bulk moves, global redesign, or another component’s full implementation;
- required access or a test environment is unavailable;
- CI/deployment evidence cannot identify the exact commit.

Continue through independent non-blocked work, but report the blocker precisely rather than hiding it.

## Final report markers

If every required V3 gate is proven:

```text
UNIT001_V3_RECONCILIATION_COMPLETE — PR_READY
UNIT001_V3_SPEC_TO_CODE_TEST_OWNER_TRACEABILITY — COMPLETE
UNIT001_FIVE_READ_ONLY_REVIEWERS — COMPLETE
NO_MAIN_WRITE
NO_MERGE_PERFORMED
NO_BRANCH_CLEANUP_PERFORMED
NO_REPOSITORY_WRITES_OUTSIDE_ALLOWED_BRANCH_AND_PR_SCOPE
NO_CLEANUP_PERFORMED
NO_SECRETS_EXPOSED
```

If any V3 gate remains unproven or blocked:

```text
UNIT001_V3_RECONCILIATION_INCOMPLETE — OWNER_REVIEW_REQUIRED
NO_MAIN_WRITE
NO_MERGE_PERFORMED
NO_BRANCH_CLEANUP_PERFORMED
NO_REPOSITORY_WRITES_OUTSIDE_ALLOWED_BRANCH_AND_PR_SCOPE
NO_CLEANUP_PERFORMED
NO_SECRETS_EXPOSED
```

Never convert `NOT_EXECUTED`, `UNVERIFIED`, or `BLOCKER` into `PR_READY`.
