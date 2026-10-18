# R11 — UNIT-001 Component Specification and Architecture Review + Controlled Implementation

**Mode:** one-component, controlled remediation and implementation
**Repository:** `Qays7753/Micro`
**Authoritative component specification:** `docs/product/components/UNIT-001-PROJECT-SETUP-SPEC-V2.md`
**Required implementation branch:** `feature/r11-unit001-project-setup-20261018`
**Required target:** one new PR from that branch to `main`
**Write boundary:** `BRANCH_AND_PR_ONLY`
**Merge boundary:** `NO_MERGE`
**Cleanup boundary:** `NO_CLEANUP`
**Current status:** the component specification is published for execution; implementation has not started.

## Mission

Execute the complete `UNIT-001 — إعداد المشروع لأول استخدام` component specification from the GitHub copy named above. First verify the live repository state and the specification against the current code, contracts, tests, and neighboring components. Then implement the approved component behavior, its root architectural fix, its tests, evidence, tracker records, and final PR-ready documentation in one controlled component PR.

Do not treat this prompt as permission to redesign the whole product, to start UNIT-002 or any other component, to perform general New Design work, to modify visual tokens/layout/navigation globally, to merge, or to delete branches. The component may be made smaller and more correct where the specification requires it, but every deletion or ownership change must be proved by a consumer census and an explicit replacement/retirement record.

## Non-negotiable project principles

1. Micro is still in development. There are no users and no authoritative production data to preserve. Therefore, when a defect or duplicated implementation is inside the approved UNIT-001 boundary, prefer the durable root fix now rather than a superficial compatibility workaround.
2. “No users” is not permission to silently change protected meaning. Do not silently change financial semantics, historical meaning, `localSchemaVersion=38`, `localExportVersion=30`, import/export wire formats, rejection precedence, security boundaries, or established contracts. If the component specification requires a protected semantic change, record the exact change, evidence, impact, and owner decision boundary; do not hide it inside cleanup.
3. Do not add arbitrary validation limits, financial defaults, dates, money records, wallet records, opening balances, or user-data assumptions. Preserve the distinction between “no record” and zero.
4. One source of truth only. Read the GitHub specification in this repository. Do not access Google Drive, do not require an attachment, and do not create a second external specification. If a later revision is needed, create a versioned GitHub document and update the index rather than editing an untracked copy.
5. One writer only. Use read-only specialist reviewers sequentially after implementation; reviewers must not write application code or rewrite one another’s work.
6. Every new finding must receive a durable ID and one of: `FIX_NOW`, `PRESERVE`, `DEFERRED_WITH_EXACT_TRIGGER`, or `OUT_OF_SCOPE`. “Generic defer” is forbidden. An issue that is inside UNIT-001 and can be safely fixed now is `FIX_NOW`.
7. Use the secure credential field only for GitHub access. Never print, paste, store, echo, or commit the credential, and never place it in a report, comment, file, URL, shell history, or test fixture.

## Phase 0 — Live baseline and continuation safety

Before writing anything:

1. Verify repository, `origin`, live `origin/main`, working tree, installed toolchain, open PRs, and remote branches. Do not trust the historical SHA in the specification as the current base.
2. Read `AGENTS.md`, `README.md`, `CONTRIBUTING.md`, `docs/operations/current-state.md`, `docs/operations/control/README.md`, generated `AGENT-BRIEF.md`, `generated/ACTIVE-WORK.md`, the current component specification, `docs/architecture/COMPONENT_CONTRACTS.md`, and the relevant contracts for Setup, profile identity, startup, drafts, storage, restore/import, and neighboring components.
3. Confirm that the only active workstream for this task is the new UNIT-001 claim. If another active claim overlaps the proposed `areas` or `contracts`, STOP and report the exact overlap before writing.
4. Create the required new branch from the verified live `origin/main`: `feature/r11-unit001-project-setup-20261018`. Do not work on `main`. Do not reuse a historical or documentation-only branch.
5. Record a baseline evidence file and an initial comment containing: live base SHA, branch SHA, open PR list, relevant current files, current tests, current ownership/duplication surfaces, and the exact specification SHA.

The baseline must distinguish verified facts, inferences, unverified items, not-executed items, and blockers. A stale historical SHA is evidence of history only, not current code.

## Phase 1 — Component and architecture review before code

Perform a bounded but complete review of UNIT-001. This is not a general repository refactor and not a visual New Design review.

### 1.1 Required maps

Produce these maps before implementation:

- `Feature → Module → Contract → Test → Owner` for Setup, identity creation, existing-project opening, draft save/restore/discard, restore/import entry, startup routing, and the success handoff to Home.
- A file-responsibility map for every changed or candidate file, including `pages/Setup.tsx`, `app/StartupGate.tsx`, `application/profile/profileService.ts`, the existing draft/storage services, the existing restore/import owner, `pages/Home.tsx`, shared dialog/input primitives, and all direct tests.
- A duplication/ownership map for the five B-DUP surfaces: initial cash setup, project identity and later rename, restore/import entry, draft lifecycle, and shared vocabulary/controls/dates.
- A storage/application/domain/UI composition map proving that UI does not reach IndexedDB directly and that UNIT-001 uses the existing application/service and contract boundaries.
- A test and documentation map for every rule U001-R01..R15, field U001-F01, text U001-T01..T16, state row in B4, neighbor contract in B5, acceptance case U001-AC01..AC11, and B-DUP acceptance checks U001-ACD001, U001-ACD002, U001-ACD005, U001-ACD023, and U001-ACD024.

### 1.2 Questions that must be resolved from repository evidence

Resolve these before implementation; do not invent paths or behavior:

- `U001-Q01`: identify the actual restore/import entry, its owner, its navigation/return contract, and the exact cancellation context back to Setup. UNIT-001 may delegate to the existing restore/import owner; it must not create a second import page or bypass the existing protection.
- `U001-Q02`: identify the actual UI components and draft/storage files affected by removing duplicated initial-cash fields. Prove that no old draft value is silently converted into money, that the canonical cash setup component remains the owner, and that no existing financial record, export, import, or historical contract is changed.

If either question cannot be proven from live repository evidence, record a precise blocker and continue with independent non-blocked work; do not guess.

### 1.3 Review findings

Every discrepancy between the specification, current implementation, contracts, tests, and neighboring components must be recorded with:

- stable ID, title, exact file/line or contract reference;
- observed behavior and expected behavior;
- root cause and affected surfaces;
- classification (`FIX_NOW`, `PRESERVE`, `DEFERRED_WITH_EXACT_TRIGGER`, or `OUT_OF_SCOPE`);
- implementation wave and dependencies;
- tests and evidence required;
- rollback boundary and acceptance criteria.

If a finding is a real defect inside the UNIT-001 scope, fix it in this PR. Do not hide it as “cleanup,” and do not postpone it merely because it was not named in the original specification.

## Phase 2 — Controlled implementation

Implement the specification with the smallest coherent set of production changes, preserving established architecture and making ownership explicit.

### 2.1 Required behavior

The implementation must satisfy all of the following, with tests proving each item:

- First open with no project shows the Setup surface with the project-name field and primary action; a successful read with no project is not treated as a storage failure.
- A read failure enters the existing recovery path; it must not become “empty data,” a new project, or a silent fallback.
- An existing project opens the existing project; Setup must not create a second identity or edit an existing identity. Later rename remains owned by its existing component.
- Empty or whitespace-only name is rejected after `trim`, with the specified error near the field and correct focus. Do not invent a maximum length or language restriction absent from the current profile contract.
- A valid name uses the single identity source, trims only as specified, announces progress, prevents duplicate concurrent submission, and does not create a project while the user is typing.
- Successful save opens Home directly with the specified success message and clears only the completed Setup draft after success is proven. There is no mandatory cash setup and no receipt screen.
- Save failure or an uncertain write result preserves the entered name, shows the correct recovery action, verifies existing identity before any retry/create path, and never reports success early.
- Information dialog uses the existing component/library semantics, exact approved text, correct modal focus/return behavior, keyboard and back-button handling, and does not save or mutate the form merely by opening or closing.
- Draft persistence is explicit and separate from the final project identity. A valid draft can be continued or explicitly discarded; discard removes only the draft. No old financial values are applied automatically.
- Restore delegates to the existing restore/import owner, preserves cancellation context, and never creates a second project or bypasses its confirmation/protection contract.
- Loading blocks duplicate submission and conflicting data-changing actions without making read-only information unavailable unnecessarily.
- Setup creates no wallet, opening balance, cash movement, owner investment, debt, or other financial event. Missing cash is not zero.
- Refresh, browser back, and phone back do not replay save or silently complete the flow.
- RTL, ASCII digits `0-9`, accessible labels, touch targets, focus visibility, keyboard behavior, and the specified accessibility constraints are preserved. This is semantics/accessibility correctness, not a global visual redesign.
- Neighbor contracts remain intact: UNIT-002 owns optional financial completion; UNIT-003 receives truthful identity state; sales/expense flows remain usable without an artificially required wallet; cash setup remains owned by its existing components; rename remains owned by its existing component; restore remains owned by the existing restore/import component.

### 2.2 Root-fix and deletion rules

- Before removing any duplicated initial-cash UI, legacy draft field, helper, or route, run a repository-wide consumer census covering imports, dynamic references, tests, fixtures, snapshots, exports, deep links, and documentation.
- Remove or relocate only code proven to be dead or duplicated and only after the replacement owner and negative tests exist. Record before/after consumer counts.
- Do not delete shared storage, `FormDraftService`, protected restore/import logic, or any schema/export/legacy fixture merely because UNIT-001 no longer displays a field.
- Do not perform bulk file moves, structural refactoring, or unrelated code organization. If the root fix requires a structural change, keep it minimal, document the exact boundary, and stop for owner review if it crosses beyond UNIT-001.
- Do not change global copy, design tokens, navigation architecture, financial policy, export/import format, or historical records. Component-local approved text and accessibility semantics are allowed.

### 2.3 Commit and checkpoint rules

Use coherent commits on the same implementation branch, for example:

1. `docs(unit001): record baseline and implementation claim`
2. `feat(unit001): implement project setup ownership and flow`
3. `test(unit001): cover setup states drafts restore and neighbor contracts`
4. `docs(unit001): finalize evidence tracker and review records`

After each meaningful commit, run the focused tests for the changed area and add a short PR checkpoint comment naming the commit, scope, tests, and remaining gate. Do not force-push.

## Phase 3 — Verification contract

At minimum, run and record:

### Focused behavior and contract checks

- all existing Setup, StartupGate, profile, draft, restore/import, Home handoff, and relevant component tests;
- new tests for U001-AC01..U001-AC11;
- new or updated tests for U001-ACD001, U001-ACD002, U001-ACD005, U001-ACD023, and U001-ACD024;
- negative tests proving no duplicate identity, no automatic money record, no accidental legacy-draft application, no second restore/import owner, no bypass of protection, and no direct UI-to-IndexedDB access;
- keyboard/focus/RTL/viewport checks using the project’s existing test tools where applicable;
- typecheck and lint for every changed package.

### Repository gates

Run the repository’s canonical commands without weakening guards or changing ceilings:

```bash
pnpm operations-control:test
pnpm operations-control:check
pnpm typecheck
pnpm lint
pnpm format:check
pnpm text-density
pnpm design-guards
pnpm guards
pnpm test
pnpm prototype:check
pnpm prototype:test
pnpm prototype:build
pnpm check
node scripts/check-doc-index-coverage.mjs
node scripts/check-current-state-size.mjs
git diff --check
```

If a command is not applicable, explain why and record `NOT_EXECUTED`; do not claim PASS. If a gate fails, fix the root cause in this PR when it is in scope. Never raise a baseline, disable a guard, increase a ceiling, or retry randomly to win a measurement.

## Phase 4 — Five sequential read-only reviewers

After implementation and focused verification, run five sequential read-only reviews. They must inspect the final implementation diff and evidence, not merely the prompt. They must not edit files or push commits.

- **RV1 — architecture and ownership:** Setup/Startup/profile/draft/restore boundaries, duplication retirement, module responsibility, dependency direction, and neighbor contracts.
- **RV2 — data, storage, domain, and financial safety:** identity lifecycle, draft isolation, no-money/no-zero semantics, IndexedDB/Memory parity where relevant, restore/import protection, schema 38/export 30, and no hidden data loss.
- **RV3 — UI runtime and accessibility:** state machine, loading/failure/recovery, RTL, focus, keyboard/back behavior, touch targets, exact approved copy, and no global visual redesign.
- **RV4 — tests, CI, security, and operability:** test quality, negative cases, guard coverage, secrets, deterministic commands, failure evidence, and rollback rehearsal.
- **RV5 — documentation, product contract, and traceability:** spec-to-code-to-test-to-owner mapping, tracker status, current-state accuracy, generated views, PR checkpoints, and absence of stale claims.

Then run one synthesizer/reconciliation pass. Record each reviewer’s scope, commit SHA, findings, classification, and PASS/REMEDIATION result. If a reviewer finds an in-scope defect, fix it, rerun the affected reviewer, and update the final report.

## Phase 5 — Canonical records and PR delivery

Create or update only the following canonical records on the implementation branch:

- `docs/architecture/refactoring/r11-unit001-20261018/R11-UNIT001-EXECUTION-REPORT-2026-10-18.md`
- `docs/architecture/refactoring/r11-unit001-20261018/R11-UNIT001-FIVE-REVIEWER-RECORD-2026-10-18.md`
- `docs/operations/control/items/DOC-008.json`
- `docs/operations/control/workstreams/WS-224.json`
- `docs/operations/current-state.md` (live fields only)
- `docs/operations/current-state-log.md` (append-only entry)
- `docs/architecture/refactoring/AGENT-SEQUENTIAL-WORKLOG.md` (append-only entry)
- generated Operations Control views, regenerated from JSON source only
- `docs/00-document-index.md`

Use `DOC-008` for the component specification/implementation claim and `WS-224` for the single active UNIT-001 workstream. Keep their state honest: `IN_REVIEW` before merge, `MERGED_UNVERIFIED` only after an owner-approved merge, and `VERIFIED` only after post-merge proof on the exact `main` SHA. Do not mark them verified in this PR.

The final report must include:

1. exact repository, branch, PR, base SHA, final head SHA, and all commit SHAs;
2. specification path and SHA;
3. files changed and responsibility of each;
4. before/after consumer census for any deletion or ownership change;
5. Feature → Module → Contract → Test → Owner map;
6. complete requirement-to-test matrix for R01–R15, F01, T01–T16, B4, B5, B-DUP, and AC cases;
7. all findings and their durable classifications;
8. commands with exit codes and exact test counts;
9. reviewer records and synthesizer reconciliation;
10. semantic, financial, schema/export/import, security, accessibility, and visual-scope statement;
11. rollback boundary and rehearsal result;
12. explicit list of not executed, unverified, blocked, preserved, or future-gated items;
13. exact next action for the owner.

The PR description must say that this is UNIT-001 only, that no merge or branch cleanup was performed, and that no New Design UI/UX program was started.

## Stop conditions

STOP and report a precise blocker if any of the following occurs:

- the live base or branch/PR state differs from the recorded baseline;
- an overlapping active Claim is found;
- the existing restore/import owner or contract cannot be proven;
- a proposed deletion has an unresolved consumer, fixture, deep-link, schema, export/import, or historical dependency;
- a change would alter protected financial, historical, schema, export/import, security, or rejection semantics without an explicit owner decision;
- a required test or guard cannot run and no honest alternative evidence exists;
- the diff expands into unrelated components, global UI redesign, or structural mass moves;
- the credential is unavailable through the secure field.

Do not stop for routine confirmation. Continue through all independent non-blocked phases, record the blocker precisely, and deliver the strongest PR-ready result possible within the authorized boundary.

## Final required status markers

End the report and final PR checkpoint with exact, truthful markers:

```text
UNIT001_COMPONENT_IMPLEMENTATION_COMPLETE — PR_READY
UNIT001_SPEC_TO_CODE_TEST_OWNER_TRACEABILITY — COMPLETE
UNIT001_FIVE_READ_ONLY_REVIEWERS — COMPLETE
NO_MERGE_PERFORMED
NO_BRANCH_CLEANUP_PERFORMED
NO_SECRETS_EXPOSED
```

If any required acceptance criterion is not met, replace the first marker with:

```text
UNIT001_IMPLEMENTATION_INCOMPLETE — OWNER_REVIEW_REQUIRED
```

Never claim `PR_READY` merely because CI is green; the evidence, tracker, reviewer records, and exact final head must all agree.
