# Zed AI — Micro UNIT-002 Specification and Authorization Review

## Mission

Perform one controlled, read-only specification/architecture/ownership review for UNIT-002 on the existing Micro component-program branch. Do not implement UNIT-002 in this phase. The source specification is explicitly a proposal for review, and owner decisions plus a controlled execution contract are required before application-code writes.

The objective is to verify whether the GitHub-canonical V5 proposal is internally coherent and implementable, map its requirements to the current repository, identify every evidence-backed blocker or safe-preserve item, and return an exact owner decision packet. Do not silently turn a recommendation into authorization.

## Known state — verify live before reading or writing

- Repository: `Qays7753/Micro`
- Long-lived branch: `components/integration-20261018`
- PR: #378
- Verified branch head when this contract was published: `f51f63cd5e192da9a89fffb75b156bbb73632603`
- Verified `main` base: `fd5d7ce689d32d8dcc462bcea2ff1c006256f064`
- Canonical specification: `docs/product/components/UNIT-002-PROJECT-DATA-COMPLETION-SPEC-V5.md`
- Provenance record: `docs/architecture/components/unit002-20261019/evidence/UNIT-002-V5-DRIVE-GITHUB-PROVENANCE-2026-10-19.md`
- This contract: `docs/architecture/components/unit002-20261019/UNIT-002-ZAI-AUTHORIZATION-REVIEW-PROMPT-2026-10-19.md`

Run a live preflight. If the repository, PR, branch, base, head, worktree, or existing files differ unexpectedly, stop with `STATE_DRIFT` and do not reset, force-push, merge, close PRs, delete branches, or overwrite work.

## Source-of-truth and provenance

Read UNIT-002 from GitHub only. Do not read Google Drive and do not use Drive links as execution inputs. The GitHub V5 file preserves the source proposal and its status. Read the repository contracts and governance entry points required by `AGENTS.md` before any review.

## Credentials and secrets

`SECURE_SECRET_FIELD`: if GitHub access is needed, use only the platform secure credential field. Never ask for, print, paste, commit, store, or include a token or secret in chat, files, logs, URLs, comments, reports, or command output. This review does not require a new credential.

## Write boundary

`BRANCH_AND_PR_ONLY`, documentation-only if a written artifact is necessary.

Allowed:

- read-only repository and code inspection;
- a review report, decision matrix, evidence map, or tracker note on `components/integration-20261018` / PR #378;
- generated Operations Control views regenerated from JSON sources only;
- exact comments/evidence on PR #378.

Forbidden in this phase:

- any application, domain, storage, financial, schema, export/import, historical, security, or UI implementation change;
- deletion or relocation of Foundation entries, controls, records, or routes;
- changes to `main`;
- merge, force-push, branch deletion, PR closing, or cleanup;
- UNIT-003 or any other component implementation;
- global UI/UX redesign, structural refactoring, bulk moves, or new neighbor specifications;
- changing a ceiling, guard, baseline, tolerance, or rejection precedence to make a finding disappear.

If the review discovers a confirmed production defect, record it as `FIX_NOW_CANDIDATE` with exact evidence and stop for owner authorization. Do not implement it under this review contract.

## Review phases

### Phase 0 — safe preflight and source reading

1. Verify live refs, PR #378, current worktree, existing claims, and `origin/main`.
2. Read `AGENTS.md`, the Operations Control README/brief, current-state, relevant contracts, and the complete GitHub V5 specification.
3. Confirm that V5 says review-required and that no implementation authorization is implied.

### Phase 1 — requirement and ownership matrix

Build a complete matrix for every material requirement:

- U002-ORG-20261018 and decisions U002-D01..D05/U002-DINT01;
- user flow A and rules U002-R01..R13;
- U002-F01 and text U002-T01..T13;
- U002-AC01..AC10;
- every B-DUP item, including DUP-001, DUP-003, DUP-004, DUP-005, DUP-019, and DUP-024;
- Q01, Q02, and Q03 integration points;
- all removal/retirement preconditions.

For each row state: `VERIFIED`, `INFERRED`, `UNVERIFIED`, `NOT_EXECUTED`, `DEFERRED`, or `BLOCKER`, with exact file/symbol/test evidence or the exact missing evidence.

Map each action and datum to its true owner. At minimum inspect the current live ownership of Foundation/entry surfaces, navigation/returnTo, Settings/044 guided import, cash/022, owner/020, suppliers/027, inventory/028, Home/AppHeader, capabilities/preferences, and the existing guards. Do not infer ownership from filenames alone.

### Phase 2 — structure and architecture gate

Perform a read-only Structure/Architecture/Code Organization scan for the UNIT-002 boundary before any structural change is proposed. Cover:

- module and feature boundaries;
- file responsibilities and oversized files;
- dependency/layer violations and cycles;
- duplication and sources of truth;
- feature discoverability;
- storage/application/domain/UI composition;
- test and documentation mapping;
- a target module map only if needed.

Classify every finding as `FIX_NOW_CANDIDATE`, `PRESERVE`, `DEFER_WITH_EXACT_TRIGGER`, or `OUT_OF_SCOPE`. Do not refactor during this scan. Any future structural wave must wait for owner review and accepted findings.

### Phase 3 — decision packet, not implementation

Produce explicit owner decisions for every unresolved choice, including at least:

1. whether the optional gateway remains a distinct page/surface or is owned by Settings 038;
2. whether the current Foundation surface is replaced, redirected, or preserved until neighbor readiness;
3. whether and exactly when the misleading operating-expense-payable entry is removed from UNIT-002;
4. the allowed returnTo chain and maximum safe depth for Q01–Q03;
5. the exact distinction between guided initial import and full backup restore;
6. capability-state behavior when the source is unknown or unavailable;
7. whether any old entry may be removed now, with replacement, consumer census, data/intent/return preservation, and rollback proof;
8. any decision that could change financial meaning, historical meaning, schema 38, export 30, import/export wire format, security, or rejection precedence.

For each decision use:

```text
Decision required:
Exact payload:
Allowed side effects:
Forbidden side effects:
Dependencies:
Acceptance evidence:
Rollback boundary:
If declined:
```

### Phase 4 — five sequential read-only reviewers

Run five sequential read-only reviews with one synthesizer and no reviewer writes:

1. architecture, ownership, boundaries, and discoverability;
2. storage, domain, financial, historical, and restore safety;
3. UI, navigation, RTL, accessibility, and runtime behavior;
4. tests, CI, security, guards, and operability;
5. documentation, tracker, contract, and source-of-truth traceability.

A reviewer must not convert an inference into a verified fact and must not edit code. Reconcile conflicts explicitly.

### Phase 5 — documentation-only handoff

If documentation updates are needed, update only the UNIT-002 review report/decision matrix, DOC-009/WS-225 notes, current-state live fields/log, document index, and generated views from JSON. Keep DOC-009/WS-225 in `REVIEW_REQUIRED` while owner decisions or evidence are open. Do not create an implementation claim or mark the component ready.

## Verification contract

At minimum run and record exact exit codes for the documentation and control gates:

```bash
python3 scripts/operations-control/validate.py
python3 scripts/operations-control/generate_tracker.py --check
node scripts/check-doc-index-coverage.mjs
node scripts/check-current-state-size.mjs
node scripts/check-agent-document-contract.mjs
git diff --check
```

Do not claim application test coverage or implementation readiness from these documentation checks. If no code is changed, say so explicitly. If code is changed unexpectedly, stop and report `STATE_DRIFT`.

## Report contract

The report must include:

1. exact live baseline and final head;
2. source files and provenance used;
3. complete requirement-to-owner-to-evidence matrix;
4. structure/architecture scan findings and target map;
5. every finding with ID, classification, evidence, affected area, impact, dependencies, minimum safe remediation, tests, acceptance criteria, and rollback boundary;
6. explicit owner decision payloads;
7. files and writes actually made, plus files not changed;
8. unresolved blockers and exact triggers;
9. whether an implementation prompt may be authorized next.

Final markers:

```text
UNIT002_SPEC_AUTHORIZATION_REVIEW_COMPLETE — OWNER_DECISIONS_REQUIRED
UNIT002_IMPLEMENTATION_NOT_AUTHORIZED
NO_APPLICATION_WRITES
NO_REPOSITORY_WRITES_TO_APPLICATION_OR_MAIN
NO_MAIN_WRITE
NO_MERGE_PERFORMED
NO_BRANCH_CLEANUP_PERFORMED
NO_SECRETS_EXPOSED
```
