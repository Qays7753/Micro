# Z AI — Micro S02 Revalidation and S03 Execution

## Mission

Continue the existing Micro component-execution program on the single long-lived integration branch. First independently revalidate the completed S02 work, remediate any confirmed S02 defect within the same branch and PR, and only then execute S03. Do not restart S02, do not repeat completed work without evidence, and do not begin S03 while an S02 acceptance gate or blocker remains open.

ZAI is the only code executor. Manus is the program coordinator and independent reviewer. ChatGPT is not an active execution gate. Google Drive is provenance only; use the GitHub repository as the operational source of truth.

## Repository and current state

- Repository: `https://github.com/Qays7753/Micro`
- Integration branch: `components/integration-20261027`
- Existing Draft PR: `https://github.com/Qays7753/Micro/pull/383`
- Base branch: `main`
- Expected pre-publication checkpoint: `1d9a837847c264315bcca0a55a82c132f3b5e1a9`; the documented prompt-publication commit and its descendants are expected to be present above this checkpoint.
- Expected base head: `3584aa1d08cea3e0a00623b719fed7f991ce187f`
- The branch is the only work branch. Do not create another branch or PR.

The checkpoint is not permission to reset history. Before any write, inspect the live branch, PR, worktree, ancestry, existing commits, and all current records. The prompt-publication commit `06e6bfcc8fb7482d4fe553d3ccb19d4de0b0a2e7` is expected on top of the checkpoint; preserve it and any later descendant. If the live head is neither that expected publication line nor a safe descendant, do not reset, force-push, overwrite, or assume the difference is harmless. Report `STATE_DRIFT`, identify the live head and the delta, and continue only if the existing work can be safely preserved and the phase boundary remains valid.

## Secure credentials

Use only the GitHub and Cloudflare credentials already supplied through secure credential fields. Refer to them only by variable name, for example:

- `GITHUB_ACCESS_TOKEN=<SECURE_SECRET_FIELD_ONLY>`
- `CLOUDFLARE_API_TOKEN=<SECURE_SECRET_FIELD_ONLY>`

Never print, echo, paste, store, commit, or include any secret, token prefix, cookie, authorization header, or private session URL in a command, file, report, PR comment, or final response.

Do not replace the placeholders above with a real token in this prompt or in a normal chat message. The actual credential must be supplied through the editor's secure credential mechanism. If that secure channel is unavailable, stop with `CREDENTIAL_CHANNEL_UNAVAILABLE`; never request or expose the token in plain text.

## Mandatory repository sources

Read the current versions on the live branch before acting:

1. `AGENTS.md` and all applicable repository instruction files.
2. `docs/operations/agent-development-sop-v1.md`.
3. `docs/operations/agent-handoff-protocol-v1.md`.
4. `docs/operations/control/README.md`, the live Control JSON sources, generated Tracker views, and `pre-pilot.json` where applicable.
5. `docs/operations/current-state.md` and `docs/operations/current-state-log.md`.
6. `docs/implementation/micro-component-execution/00-PROGRAM.md`.
7. `docs/implementation/micro-component-execution/01-STAGES.md`.
8. `docs/implementation/micro-component-execution/02-PROGRESS-AND-HANDOFF.md`.
9. `docs/implementation/micro-component-execution/00-S02-EXECUTION-PROMPT-2026-10-27.md`.
10. The latest S02 result, evidence, and review records, including `07-S02-RESULT-2026-10-27.md` or the current successor path.
11. The canonical S03 component specifications and their linked contracts:
    - `02-SPECIFICATIONS/03-New-Design/UNIT-001-إعداد-المشروع.md`
    - `02-SPECIFICATIONS/03-New-Design/UNIT-038-الإعدادات.md`
    - `02-SPECIFICATIONS/03-New-Design/UNIT-039-بيانات-المشروع-والمالك.md`
    - `02-SPECIFICATIONS/05-Data-and-Implementation/02-Shared-Data-and-Financial-Contract-AR.md`
    - `02-SPECIFICATIONS/05-Data-and-Implementation/03-Shared-Data-Acceptance-Cases-AR.md`
    - the relevant navigation/journey and current-system references linked by those files.

Do not use an older copy, a Drive copy, a chat excerpt, or a historical SHA as a current implementation contract when the live GitHub file differs.

## Required skills and five specialist sub-agents

Use the available repository-agent skills and tools for code review, repository orchestration, planning, data/domain/storage analysis, UI/accessibility review, security/CI/deployment verification, and documentation/Operations Control. If a named skill is unavailable in the ZAI environment, apply the same method manually and state that limitation; do not silently omit the responsibility.

After the single writer completes each implementation checkpoint, run five distinct **sequential, read-only specialist sub-agents**. They may inspect and report, but they must not commit, push, merge, delete, edit the repository, or act as a second writer:

1. Architecture, ownership, module boundaries, layer direction, deletion safety, and dependency impact.
2. Domain, data, storage, concurrency, idempotency, migration, rollback, schema, and financial-semantic safety.
3. UI, runtime, mobile portrait, Arabic RTL, accessibility, navigation, loading, empty, error, cancel, and repeated-action behavior.
4. Tests, CI, dependency/security, Cloudflare evidence, operability, budgets, and regression coverage.
5. Documentation, Control JSON, generated Tracker, evidence provenance, acceptance state, and handoff consistency.

Each sub-agent must return findings with exact evidence and a classification. The single writer then resolves every confirmed in-scope finding at the root, adds or updates the focused regression test, and asks the relevant read-only sub-agent to re-review the corrected diff. Preserve the attribution of each sub-agent; never write a review under Manus, ChatGPT, or the owner's name.

# Phase A — S02 revalidation and remediation gate

### A1. Revalidate without assuming the previous report is correct

Inspect the exact current S02 diff and its evidence. Verify, at minimum:

- the protected replacement boundary, rollback/protection database, generation fence, draft handling, and idempotency/concurrency behavior;
- the complete removal of the retired PIN/app-lock behavior without introducing replacement authentication;
- preservation of business data, profile data, financial records, drafts, schema 38, export 30, import wire format, and existing non-lock guards;
- Memory and IndexedDB parity where the contract changed;
- the documented `GHSA-gcqx-w48m-w2h4` owner-accepted dev-only exception and the actual dependency-audit behavior;
- the bundle-surface re-anchor evidence and exact-head GitHub Actions and Cloudflare evidence;
- consistency of `DOC-011`, `WS-227`, the S02 result, progress/handoff, current state, Tracker generated views, and PR description;
- whether the repository's documented S02 transition gate is actually clear.

Classify every finding as `FIX_NOW`, `PRESERVE`, `DEFER`, or `OUT_OF_SCOPE`. Any S02 finding inside the approved scope must be fixed at its root on this same branch and PR. Do not hide it as a workaround, do not weaken a guard, do not raise a ceiling, and do not downgrade or override a dependency to silence an advisory.

### A2. S02 stop rule

If any S02 blocker remains, if the owner-accepted exception is missing or inconsistent, if exact-head remote evidence is not green, if a required record is contradictory, or if the S02 acceptance gate is not formally clear, stop after the S02 remediation/evidence commit(s). Do not start S03. Return:

`S02_REVALIDATION_BLOCKED — <exact blocker>`
`NO_S03_STARTED`
`NO_MAIN_WRITES`
`NO_MERGE`
`NO_BRANCH_CLEANUP`

Do not declare S02 accepted as ZAI. Do not write a Manus or owner PASS under another name. If S02 is objectively clear, its records are consistent, its exact-head required checks are green, and the documented owner/Manus transition permission is already present in the repository, record the revalidation as verified evidence and continue to Phase B.

# Phase B — S03 implementation

## S03 scope

Execute only S03: project first-use, project data, and core settings, covering UNIT-001, UNIT-038, and UNIT-039. Implement the latest GitHub specifications and their linked contracts, not an old V2/V3/V9 interpretation.

### Required behavior

1. **First use / UNIT-001**
   - The project name is the only required first-use input.
   - Offering preference is optional and neutral: products, services, both, or unselected; it must not be confused with `workMode` or `activityType`.
   - Create exactly one local project identity. Repeated submission, uncertain write outcome, or concurrent windows must not create a second identity or silently overwrite the first.
   - A profile read failure is not an empty state and must not open a new project.
   - If identity creation succeeds but an optional preference write fails, report the partial result truthfully and do not recreate the identity.
   - No wallet, opening balance `0`, cash opening, inventory opening, owner financing, financial event, login, PIN, or authentication is created by setup.
   - Preserve the existing S02 restore flow. Restore is handled by UNIT-044, uses the restored identity/preferences, and must not create a new identity or replay financial work.
   - Preserve draft intent and generation semantics; an unknown outcome must be resolved by reading the live state before retrying.

2. **Settings / UNIT-038**
   - Maintain one source of truth for preferences.
   - Settings may link to UNIT-039 project data, optional UNIT-002 completion, UNIT-033 maintenance, and UNIT-044 backup/restore without copying their writers or stores.
   - Do not add or reintroduce mandatory account, PIN, currency, dark-mode, layer, cloud, sharing, WhatsApp, or future-service setup.
   - Update only the changed preference fields and preserve unrelated values.
   - Do not remove a capability key or old field until its readers, writers, guards, migration, export/import impact, and replacement are proven.
   - Keep Light Mode and the existing Arabic RTL/0–9 conventions within the approved scope; do not perform a global visual redesign.

3. **Project data / UNIT-039**
   - Keep one project identity and one stable `projectId`.
   - Allow project-name editing from its owner surface within Settings, with clear save and cancel behavior.
   - A rename changes the name, not the identity, owner account, financial meaning, or historical references.
   - Preserve optional owner-profile data and old values unless a real consumer audit proves a safe removal. Do not require owner name, email, or phone without an independently verified purpose.
   - Handle concurrent edits honestly; do not let a stale form silently overwrite a newer saved value.
   - Do not create a separate Profile/Settings source, duplicate preference, duplicate project, or parallel storage model.

## S03 architecture and write boundaries

Respect the existing direction:

`UI → Application → Domain → Storage Port → IndexedDB`

- UI components do not own financial policy or call storage directly.
- Use existing service composition and public house doors; do not deep-import around an allowlist.
- Keep domain code pure.
- Use the existing guarded `commit*` paths for sensitive writes; do not bypass them with an unguarded `save*` call.
- Preserve Memory and IndexedDB adapter parity.
- Do not create new stores, ORM layers, auth/cloud services, or a global `features/` restructure merely to implement S03.
- Do not perform bulk moves, structural refactoring, or code-organization changes as part of this phase.
- If a durable type or storage contract changes, update all required adapters, migrations, snapshot/export/import paths, persistent-entity touchpoints, and focused tests in the same phase. Do not guess schema/export numbers from the component file.
- Do not change financial semantics, historical dates, transaction meaning, rejection precedence, schema 38, export 30, or import wire format unless the exact S03 contract demonstrably requires a durable field change and all compatibility evidence is supplied.

## Required implementation workflow and continuous execution

1. Inspect the exact live branch, PR, worktree, and S02 gate.
2. Build a concise S03 consumer/owner map before editing: current writers, readers, storage ports, Memory/IndexedDB adapters, restore/export/import consumers, routes, and tests.
3. Preserve the existing S02 work and the already accepted UNIT-001 historical scope. Do not redo completed work; implement only the missing or changed S03 contract.
4. Execute continuously from A to Z on the authorized branch. Do not stop for routine confirmations, progress questions, ordinary test completion, or normal reviewer handoffs. Continue through inspection, implementation, focused tests, five sub-agent reviews, root fixes, canonical checks, records, PR update, and final report without waiting for another message.
5. Use one writer at a time. The five specialist sub-agents defined above are sequential and read-only after implementation; they are not additional writers.
6. If a reviewer finds an in-scope defect, the single writer fixes it on the same branch, adds the focused regression test, and reruns the affected checks. Reviewers must re-read the corrected diff; do not silently defer an in-scope defect.
7. Keep S02 remediation commits clearly S02-tagged and S03 implementation commits clearly S03-tagged. Do not combine two stages in one commit. Never rewrite accepted history and never force-push.
8. Add or update focused tests for the actual behavior, not only mocks or function names. Cover S03 acceptance and relevant S02 regression cases.
9. Run the repository's canonical checks from the exact final candidate SHA. Do not claim success from another SHA.
10. Update JSON Control sources first, then regenerate official Tracker views. Do not edit generated views by hand.
11. Record the S03 result, evidence, exact tested SHA, findings, acceptance status, rollback boundary, and resume point. Create the next unused Control Item/Workstream identifiers according to the repository schema; do not guess or collide with existing IDs.
12. Update the document index, current-state within its size guard, append-only state log, sequential worklog, and PR description as required by the repository rules.

Continuous execution does not override safety. Stop only for genuine state drift, unavailable secure credentials, an unresolved security or data-integrity blocker, a missing owner decision required by an explicit contract, a merge conflict that cannot be resolved without guessing, an unexpected write outside the authorized branch, or a required check that fails and cannot be repaired within scope. If you stop, preserve all work, record the exact checkpoint, and report the first incomplete action; do not restart from the beginning.

## Required tests and evidence

At minimum, provide evidence for:

- first use with name only and no financial side effects;
- two concurrent first-use attempts and idempotent/reused identity behavior;
- profile-read failure distinguished from confirmed empty state;
- identity success plus optional-preference failure without duplicate creation;
- rename preserving `projectId`, identity, unrelated preferences, and historical references;
- save, cancel, validation, loading, empty, read-error, write-error, unknown-outcome, stale-form, and concurrent-edit paths;
- restore open/cancel/success/invalid-file paths without PIN reintroduction or financial replay;
- Memory/IndexedDB parity for every changed persistent contract;
- export/restore or migration evidence for any durable field change;
- Arabic RTL, mobile portrait, keyboard/focus, 0–9 input, Light Mode, accessible names, error association, and repeated-click behavior;
- relevant regression coverage for S02's protected replacement, rollback, generation, and lock-removal behavior.

Run the canonical commands specified by the live repository and package manifests, including the full `pnpm check` chain when the repository requires it. Also run the focused S03 tests and all relevant S02 regression tests. Do not rerun expensive work merely for repetition if an exact-head result is already directly verified and still applicable; document reused evidence with its exact SHA and reason.

## Forbidden actions

- No write to `main`.
- No merge, branch deletion, cleanup, force-push, or PR closure.
- No new branch or parallel PR.
- No S04 or any later stage.
- No global redesign, bulk file move, structural refactor, or unrelated cleanup.
- No CI-policy change, guard weakening, tolerance increase, budget-ceiling increase, dependency downgrade, or silent advisory suppression.
- No Drive dependency for ZAI.
- No token exposure.
- No claim that S02 or S03 is accepted, VERIFIED on `main`, or merge-ready unless the exact repository evidence and the authorized owner transition support that claim.

## Delivery report

Update the existing Draft PR #383 and the canonical GitHub records on the same integration branch. The report must include:

- exact base SHA, S02 revalidation SHA, S03 code candidate SHA, and final documentation head SHA;
- files changed grouped by S02 remediation and S03 implementation;
- every finding with ID, classification, evidence, impact, dependency, root remediation, tests, acceptance criteria, and rollback boundary;
- what was preserved and why;
- schema/export/import and financial-impact statement;
- local commands, exit codes, environment, exact SHA, and remote GitHub Actions/Cloudflare evidence;
- five reviewer results and any corrections they caused;
- current Control Item/Workstream states and generated Tracker status;
- limitations, unverified device/browser evidence, and remaining blockers;
- exact resume point if the run stops.

If both gates are truly clear and S03 is complete, end with:

`S02_REVALIDATED — NO_OPEN_S02_BLOCKER`
`S03_EXECUTION_COMPLETE — REVIEW_REQUIRED`
`NO_MAIN_WRITES_PERFORMED`
`NO_MERGE_PERFORMED`
`NO_BRANCH_CLEANUP_PERFORMED`
`NO_REPOSITORY_WRITES_OUTSIDE_ALLOWED_BRANCH`

If S02 cannot be cleared, end with:

`S02_REVALIDATION_BLOCKED — <exact reason>`
`NO_S03_STARTED`
`NO_MAIN_WRITES_PERFORMED`
`NO_MERGE_PERFORMED`
`NO_BRANCH_CLEANUP_PERFORMED`
`NO_REPOSITORY_WRITES_OUTSIDE_ALLOWED_BRANCH`
