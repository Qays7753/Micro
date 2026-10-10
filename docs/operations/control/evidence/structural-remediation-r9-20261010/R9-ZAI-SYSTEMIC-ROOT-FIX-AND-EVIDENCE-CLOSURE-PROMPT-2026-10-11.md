# Z AI — Micro R9 Systemic Root-Fix Investigation, Remediation, and Evidence Closure

## Mission

Continue Micro R9 on the **existing R9 feature branch and existing PR #347**. Do not restart completed work. Perform an independent, system-wide investigation of every defect family connected to the R9 findings, trace each finding to its root cause and recurrence surface, implement the complete safe root fixes, repair the browser-evidence package, update the permanent tracker/evidence, run all required tests and checks, and leave the same PR genuinely ready for owner review and merge.

This is not a superficial patch and not a mechanical search-and-replace exercise. The objective is to remove the defect families from the system, not merely to make the named tests green.

The owner has explicitly authorized comprehensive continuation on the existing PR. The owner will review the final report and approve merge separately.

**You MUST NOT merge PR #347, modify `main`, delete branches, clean up unrelated branches, or perform production deployment.**

---

## 1. Live starting point — verify before any write

Repository:

```text
https://github.com/Qays7753/Micro
```

Existing PR:

```text
PR #347
https://github.com/Qays7753/Micro/pull/347
```

Expected feature branch:

```text
refactoring/r9-complete-w1-w2-w3-20261010
```

Target branch:

```text
main
```

Last verified baseline:

```text
PR head: 762541c39c3ef6e03983ba28d80e04923f5c4537
Base main: 8b3c9aeb09ca33ed66f0a929c157b668839d0463
PR state: OPEN / MERGEABLE / CLEAN
Checks at that baseline: CI SUCCESS; Cloudflare Pages SUCCESS
```

These values are a checkpoint only. They MUST be verified live before editing.

### Mandatory preflight

Before changing any file, you MUST:

1. Verify the live repository, PR number, PR state, source branch, target branch, exact full head SHA, exact full base SHA, mergeability, required checks, and open PR list.
2. Inspect the current worktree, branch, uncommitted files, recent commits, complete PR diff, PR comments, and all existing R9 reports/evidence.
3. Read `AGENTS.md`, `docs/operations/current-state.md`, the live Operations Control brief, and the R9 contract/evidence paths before implementation.
4. Determine whether the head is still the checkpoint above or has advanced. A normal new commit on the same branch is expected; an unexpected branch/base/worktree change is not.
5. Confirm that no other writer is changing this branch or the same files.
6. Preserve all existing commits, reports, evidence, and local work. Do not reset, force-push, rebase, reclone over work, delete files blindly, or rewrite history.
7. Announce the exact resume point and the files you will change and will not change.

If the branch, base, PR, worktree, or writer state differs materially from the checkpoint, stop with:

```text
STATE_DRIFT — <exact difference and safe next action>
```

Do not guess or restart.

---

## 2. Credential and write boundary

If GitHub write access is needed, use only the secure credential field already supplied by the owner:

```text
GITHUB_ACCESS_TOKEN=<SECURE_SECRET_FIELD_ONLY>
```

Never request, print, echo, copy, store, commit, paste, or include the token in chat, this prompt, files, PR comments, command output, screenshots, or reports. Report only whether access is valid, invalid, expired, or missing permission.

You are authorized for this task to:

- inspect the repository, history, PR, CI, and evidence;
- run five read-only specialist reviews;
- modify the existing R9 feature branch only;
- commit and push the remediation commits to that existing branch;
- update PR #347 and its report/comments;
- run and inspect required checks.

You are **not** authorized to:

- merge PR #347;
- modify or push `main`;
- create a competing PR for this work;
- delete branches or perform repository cleanup;
- change branch protection, repository settings, secrets, billing, or permissions;
- deploy production or create/retry unrelated deployments;
- perform a destructive data reset;
- silently change financial meaning, historical meaning, Schema, Export, Import, rejection semantics, or compatibility contracts.

---

## 3. Independent-analysis rule

The existing ZAI report and the Manus review are **inputs and historical evidence, not the source of truth for implementation**.

You MUST first inspect the live code, tests, contracts, and Git history independently. Do not blindly implement the previously named list. After the independent scan, cross-check the earlier reports, explain agreements and disagreements, and use reproducible live evidence to decide.

The target is not only the named defects. The target is the complete recurrence family and all coupled surfaces that can reintroduce the same class of failure.

The application is still in development and has no production customers or required production dataset. This makes root correction preferable now. It does **not** authorize silent destruction of local data, silent historical reinterpretation, or an unversioned Schema/Export/Import contract change.

---

## 4. Non-negotiable Micro rules

These rules apply to every finding and every phase:

- Prefer a complete root-cause fix over the smallest or easiest patch.
- Do not stop at the first named occurrence. Search for the same invariant violation across the entire relevant application.
- Trace each issue through: source/state → producer → application service → storage/domain boundary → UI surface → test → documentation/control record.
- Every current defect discovered during this task MUST receive a permanent finding ID, classification, evidence, owner, acceptance criteria, and rollback boundary.
- `FIX_NOW` is the default for ordinary current defects within this task boundary.
- `PRESERVE` is allowed only with complete semantic evidence that the behavior is intentional, plus an owner, guard, growth bound, review trigger, exit criteria, tests, and rollback boundary.
- `DEFER` is allowed only for an exact protected decision or an exact dependency. “Later”, “future card”, “out of scope for convenience”, or “not named in the prompt” is invalid.
- `OUT_OF_SCOPE` is allowed only for a genuinely unrelated product/feature area; prove why it is unrelated and identify the correct owner/wave.
- Do not hide a semantic, financial, historical, security, Schema, Export, Import, compatibility, or rejection change inside a UI, test, structural, or documentation change.
- Do not change `localSchemaVersion=38` or `localExportVersion=30` silently.
- Do not change persisted money values, units, rounding, classifications, dates, historical records, Transfer behavior, legacy acceptance, backup/import/export behavior, or rejection semantics silently.
- No visual redesign: no CSS redesign, tokens, layout redesign, navigation redesign, visual-system change, or unrelated copy rewrite.
- Accessibility, truthful loading/error state, and evidence-tooling corrections are allowed when they fix the verified defect and preserve the visual/product contract.
- No bulk moves, mass renames, file-per-function fragmentation, new barrel layers, or unrelated code organization work.
- Keep one writer, one existing branch, one existing PR. Reviewers are read-only.
- Run focused tests after every coherent repair group and the full canonical checks on the final head.
- Never claim a test or browser check was run if it was not run.

If a proposed fix changes a protected contract, stop only at that exact boundary and report:

```text
PROTECTED_DECISION_REQUIRED — <exact contract, exact proposed change, exact alternatives, exact impact>
```

Do not silently choose a protected semantic/schema/history/financial decision.

---

## 5. Five sequential read-only specialist reviewers

Before any implementation, run five distinct specialist reviews **sequentially**. They may inspect code, history, tests, CI, and evidence, but MUST NOT edit files, commit, push, merge, or rewrite reports.

After implementation, run the same five reviewers again on the final diff and require them to verify that every finding is closed or has a valid protected disposition.

### Reviewer 1 — Storage, transaction, and adapter integrity

Inspect the complete IndexedDB and Memory storage boundary, not only the previously named methods.

Required coverage:

- every `onsuccess`, `onerror`, `onabort`, `oncomplete`, `put`, `add`, `delete`, `clear`, snapshot replacement, and multi-store transaction path;
- all synchronous exceptions inside asynchronous callbacks;
- `DataCloneError`, `DataError`, `TransactionInactiveError`, malformed-record guards, partial writes, false success, and original-error fidelity;
- whether every write path is protected by the correct shared primitive or an equivalent local guard;
- IndexedDB/Memory behavior parity and whether divergence is intentional and documented;
- idempotency, concurrency, stale-read rejection, atomicity, and rollback behavior.

Produce an exhaustive affected-method inventory and a recurrence guard, not only a patch list.

### Reviewer 2 — UI state machines and accessibility semantics

Inspect the whole application for the defect family around truthful error/loading/not-found/status behavior.

Required coverage:

- all `micro-field-error` surfaces;
- all proximity patterns involving `role="status"`, `role="alert"`, `aria-live`, loading surfaces, not-found surfaces, retry surfaces, and mixed success/error messages;
- all page/component states: loading, ready, not-found, read-error, validation-error, save-failure, success, warning, and retry;
- message producers and whether the role matches the semantic meaning;
- stale error leakage, mixed-tone rendering, unreachable states, and retry transitions;
- direct tests that prove the semantic role and do not depend on CSS or snapshots.

Do not mechanically replace every `role="status"`; classify each occurrence semantically.

### Reviewer 3 — Domain, application, identity, and compatibility

Inspect G5 declaration identity and every related idempotency/identity convention across the system.

Required coverage:

- all persisted semantic fields that distinguish a declaration or operation;
- current JSON key derivation and any legacy key derivation;
- exact retry, knowledge-only changes, free-text delimiter collisions, null/optional links, direction, date, amount, source, and note;
- Memory and IndexedDB behavior;
- existing local records, old exports, import validation, and whether old opaque keys can be handled safely without changing Schema/Export versions;
- whether a compatibility bridge, semantic lookup, one-time safe migration, or explicit versioned decision is the correct root solution;
- all sibling identity builders with the same concatenation/omission risk.

Do not accept “development only” as a reason to leave a currently reproducible identity defect unresolved when a safe root fix is possible.

### Reviewer 4 — Tests, CI, browser evidence, and negative proof

Inspect all existing tests and the browser-evidence package independently.

Required coverage:

- whether each test fails when the root defect is reintroduced;
- whether tests cover only fake IndexedDB or also a real browser;
- whether the F7 evidence is reproducible from committed files;
- whether `f7-harness.mjs.txt` references missing or generated inputs;
- whether the exact committed adapter/source SHA, build command, generated entry, hash, and browser verdict can be independently connected;
- CI workflow, Cloudflare Pages check, final-head pinning, and no stale-SHA claims;
- coverage gaps that could allow recurrence.

If the repository lacks a repeatable real-browser harness, do not invent a PASS. Either create the smallest explicitly authorized reproducible evidence chain for this defect family, or report the precise limitation and keep the PR non-ready.

### Reviewer 5 — Documentation, Operations Control, and source-of-truth consistency

Inspect all permanent control records and evidence paths.

Required coverage:

- `WS-216`, `ARCH-007`, `current-state.md`, `current-state-log.md`, `AGENT-SEQUENTIAL-WORKLOG.md`;
- Repair Cards, R9 reports, browser evidence, test/documentation maps, and document index;
- generated Markdown/CSV/XLSX views and their JSON source;
- stale SHAs, unsupported completion claims, missing findings, duplicate IDs, generic deferrals, and claims not pinned to the final head;
- current-state size guard and append-only history.

The reviewer must ensure that the permanent tracker reflects every new finding and its final disposition.

### Reviewer synthesis

After all five reviews, synthesize one implementation matrix before editing. Reconcile contradictions using live code, contracts, tests, and reproducible evidence. A reviewer recommendation is not an owner decision.

---

## 6. Mandatory investigation deliverables before code changes

Before implementation, create or update a working repair matrix in the existing branch worktree. It must contain at least:

| Field | Required content |
|---|---|
| Finding ID | Stable ID, for example `R9-GA-F3.6`, `R9-GA-F7.x`, or `R9-GA-G5.x` |
| Family | UI/error semantics, storage, identity, browser evidence, documentation, or cross-cutting |
| Evidence | Exact file/line, test, command, history, or browser artifact |
| Root cause | Why the defect exists and why a superficial fix would recur |
| Blast radius | All affected pages, services, adapters, records, tests, and docs |
| Classification | `FIX_NOW`, `PRESERVE`, `DEFER`, or `OUT_OF_SCOPE` |
| Remediation | Exact root fix and shared guard/contract to prevent recurrence |
| Tests | Focused, negative, adapter-parity, browser, and full-suite tests as applicable |
| Acceptance | Observable condition proving closure |
| Rollback | Exact commit or boundary restoring the prior safe state |

The matrix MUST explicitly include:

1. `R9-GA-F3.6-ERROR-ROLE-INVENTORY`: a complete semantic inventory of all `micro-field-error` and equivalent error surfaces, including the 26 proximity matches already observed and any additional matches found by the new scan.
2. A complete inventory of all IndexedDB write-listener patterns and their protection status.
3. A complete inventory of all G5/idempotency identity builders and legacy/current formats.
4. A browser-evidence artifact chain proving what was actually executed and from which committed source.
5. A list of every finding from the earlier R9 reports and whether it is fixed, deepened, duplicated, false-positive, preserved, or still open.

Do not begin editing code until the matrix and the five-review synthesis exist and are included in the final evidence package.

---

## 7. Sequential implementation groups

The following groups are sequential. **Do not start the next group until the current group’s focused tests, diff review, finding classification, and acceptance gate pass.** Do not stop between groups for routine implementation choices; use the established contracts and proceed.

### Group A — Complete semantic error-surface inventory and root correction

Investigate every confirmed error/read-failure/validation-failure surface across the application.

At minimum, re-evaluate:

```text
apps/prototype-web/client/src/pages/CashAdjustmentEditor.tsx
apps/prototype-web/client/src/pages/InventoryMovementEditor.tsx
apps/prototype-web/client/src/pages/DirectSaleEditor.tsx
apps/prototype-web/client/src/pages/EstimateDetail.tsx
apps/prototype-web/client/src/pages/MaterialEditor.tsx
apps/prototype-web/client/src/pages/Tools.tsx
apps/prototype-web/client/src/pages/ToolsIntegrity.tsx
apps/prototype-web/client/src/components/finance/CorrectionsLayer.tsx
apps/prototype-web/client/src/components/direct-sales/SaleCollectionReversalSection.tsx
```

Also scan every other page/component found by the semantic inventory.

Required decisions:

- Actual error/read-failure/validation failure → canonical error announcement behavior, normally `role="alert"`.
- Loading/success/informational status → retain `role="status"` only when semantically correct.
- Mixed-tone message → split the states/elements rather than assigning one role to contradictory meanings.
- Warning or review notice → classify intentionally; do not mislabel it as an error merely to silence the inventory.

Required root behavior:

- no infinite loading after a completed read;
- no not-found label for a storage failure;
- no error hidden as a status-only announcement;
- retry returns to loading/ready truthfully;
- no save/navigation/data notification on a failed or missing record;
- no stale error/success message after a state transition;
- no visual redesign or unrelated copy change.

Add direct regression tests for every changed family. Include positive and negative assertions so a future role regression fails.

**Group A acceptance gate:** complete semantic inventory, every confirmed current defect fixed or protected with evidence, focused tests pass, no scope drift, and finding matrix updated.

### Group B — G5 identity and legacy compatibility closure

Perform an independent full audit of G5 identity and all sibling identity builders. Then implement the strongest safe root solution.

Required scenarios:

1. identical complete input → one record and truthful reuse;
2. difference only in `knowledge` → no incorrect reuse;
3. difference in amount, date, direction, source, note, or link → no incorrect reuse;
4. free-text delimiter/collision inputs → no incorrect reuse;
5. explicit null versus populated relationship values → no incorrect reuse;
6. Memory and IndexedDB adapters behave consistently;
7. old-format records/keys, if present, are handled intentionally and safely;
8. old-format collision cases cannot silently reuse the wrong semantic record;
9. export/import and accepted legacy formats remain correct unless a protected versioned decision is required.

You MUST determine whether the old-key issue can be closed without a schema/export version change using a safe compatibility lookup, canonical semantic comparison, migration-safe adapter, or another root approach. Do not merely document that old keys will duplicate.

If the only correct solution requires changing `localSchemaVersion`, `localExportVersion`, accepted import versions, or historical interpretation, stop at that exact protected decision and report the complete alternatives and impact. Do not silently change them.

**Group B acceptance gate:** identity matrix complete, legacy/current behavior intentional and tested, collision and knowledge regressions fail when the fix is removed, adapter parity proven, and no silent compatibility change exists.

### Group C — Complete IndexedDB transaction and Memory parity closure

Audit the entire recurrence family behind F7, not only the already changed methods.

Required actions:

- enumerate all request callbacks and write queueing paths;
- identify every synchronous throw point inside asynchronous callbacks;
- use one shared guard or an equivalent consistent pattern where appropriate;
- preserve original error payloads and result-code contracts;
- guarantee no false `ok:true` after an unwritten or partially written operation;
- guarantee snapshot replacement is atomic;
- guard `transaction.abort()` only while active;
- test already-committed/reused paths and failure paths;
- compare Memory and IndexedDB behavior and fix ordinary parity defects now;
- add static/contract guards so new unsafe listeners cannot be added silently.

Required negative proofs:

- revert/disable each family’s guard in a temporary controlled check and prove the relevant test fails;
- restore the fix and prove the test passes;
- do not commit a broken tree or leave temporary reverts in history.

**Group C acceptance gate:** all affected transaction paths inventoried, root guard coverage proven, negative proof recorded, adapter parity classified, and focused/full storage tests pass.

### Group D — Browser evidence package closure

Repair the browser-evidence package completely and honestly.

The current evidence package contains `r9c-browser-evidence/f7-harness.mjs.txt`, which imports `./adapter-entry.ts`, while that adapter entry is not currently present in the committed evidence directory.

Required actions:

1. Prefer a reproducible evidence chain: preserve the exact adapter entry or a deterministic builder/source manifest, the exact committed source SHA, generation command, tool versions, SHA-256 hashes, browser engine/version, URL/serve command, and machine-readable verdict.
2. Ensure a clean checkout can understand exactly what was executed and which committed source produced it.
3. Re-run the real-browser scenario if the approved environment is available, including native IndexedDB poisoned-write behavior and persisted-state integrity.
4. If no repeatable in-repo harness is allowed or available, do not claim a repeatable CI test. State precisely what was executed once, what source it used, and what remains unverified.
5. Do not fabricate screenshots, verdicts, source files, or browser results.
6. Update `README.md`, `f7-harness.mjs.txt`, `f7-verdict.json`, and the R9 report so that “all artifacts preserved” is true or is removed and replaced with an accurate limitation.

**Group D acceptance gate:** browser evidence is reproducible from committed artifacts or the limitation is precise and non-misleading; no stale source claim remains; documentation gates pass.

### Group E — Cross-cutting recurrence and final closure audit

After Groups A–D, perform one final system-wide closure scan:

- search again for all resolved defect patterns and their siblings;
- compare the new inventory with the pre-implementation matrix;
- confirm every finding has a final classification and evidence;
- confirm no ordinary current defect is left as a generic defer;
- confirm no test merely enshrines the bug;
- confirm no financial, historical, Schema/Export/Import, rejection, security, or visual behavior changed silently;
- confirm no unrelated files or branches were touched;
- confirm all reports and trackers describe the final head, not an earlier commit.

If the closure audit finds another ordinary current defect in the same recurrence family, fix it before proceeding. Do not end with a recommendation-only report.

**Group E acceptance gate:** finding matrix and code/tests/docs agree, all current in-scope defects are closed or have exact protected dispositions, and the final diff is reviewable.

---

## 8. Operations Control and documentation rules

Preserve historical reports and old entries. Do not rewrite history to make earlier claims look correct.

Use JSON as the source of truth and regenerate derived views. Never edit generated views or Excel manually.

Create a new dated execution report rather than overwriting the prior report:

```text
docs/operations/control/evidence/structural-remediation-r9-20261010/R9-SYSTEMIC-ROOT-FIX-AND-EVIDENCE-CLOSURE-EXECUTION-REPORT-2026-10-11.md
```

Update the existing evidence/control records as applicable:

```text
docs/operations/control/evidence/structural-remediation-r9-20261010/R9-REPAIR-CARDS.md
docs/operations/control/evidence/structural-remediation-r9-20261010/R9-COMPLETE-PR-READINESS-REPORT-2026-10-10.md
docs/operations/control/evidence/structural-remediation-r9-20261010/R9-POST-REVIEW-ROOT-FIX-EXECUTION-REPORT-2026-10-10.md
docs/operations/control/evidence/structural-remediation-r9-20261010/r9c-browser-evidence/README.md
docs/operations/control/evidence/structural-remediation-r9-20261010/r9c-browser-evidence/f7-harness.mjs.txt
docs/operations/control/evidence/structural-remediation-r9-20261010/r9c-browser-evidence/f7-verdict.json
docs/operations/control/workstreams/WS-216.json
docs/operations/control/items/ARCH-007.json
docs/operations/current-state.md
docs/operations/current-state-log.md
docs/architecture/refactoring/AGENT-SEQUENTIAL-WORKLOG.md
docs/architecture/refactoring/TEST-AND-DOCUMENTATION-MAP.md
```

If the new report is catalogued, update `docs/00-document-index.md` through the established documentation process.

For every new or changed finding, record:

- exact ID;
- `NEW`, `DEEPENS`, `DUPLICATE`, `REOPENED`, or `FALSE_POSITIVE` relationship to earlier records;
- evidence class: `VERIFIED`, `INFERRED`, `UNVERIFIED`, `NOT_EXECUTED`, `DEFERRED`, or `BLOCKER`;
- classification: `FIX_NOW`, `PRESERVE`, `DEFER`, or `OUT_OF_SCOPE`;
- root cause and blast radius;
- exact remediation;
- tests and acceptance criteria;
- rollback boundary;
- owner/trigger if protected.

Run the official sequence after JSON edits:

```bash
python3 scripts/operations-control/generate_tracker.py
python3 scripts/operations-control/validate.py
python3 scripts/operations-control/generate_tracker.py --check
```

Also run:

```bash
node scripts/check-doc-index-coverage.mjs
node scripts/check-current-state-size.mjs
git diff --check
```

Do not write a live status of complete/verified while the new current defect remains open.

---

## 9. Commit and branch protocol

Use the existing branch and existing PR only. Keep commits coherent and reviewable. Do not squash, rebase, force-push, or rewrite existing R9 history.

A recommended sequence is:

```text
fix(r9): close systemic error-surface semantics
fix(r9): close g5 identity and legacy compatibility
fix(r9): close indexeddb recurrence and adapter parity
test(r9): add negative and cross-adapter regression proof
docs(r9): close browser evidence and reconcile systemic findings
```

After each coherent group:

1. run the focused tests;
2. inspect changed paths and diff;
3. verify no protected contract changed;
4. update finding cards;
5. commit and push to the existing branch;
6. record exact SHA and evidence.

Do not create a second PR. Do not merge.

---

## 10. Required verification before declaring PR-ready

Read the live root `package.json`, application package scripts, CI workflow, and `AGENTS.md`. Run the exact canonical commands required by the repository.

### Hard merge-readiness gate — mandatory final delivery contract

The final delivery MUST be a **complete merge-ready package for `main`**, not merely a code-complete report, a local-test result, or a recommendation. Do not stop after implementing the fixes. Continue through the final verification, evidence reconciliation, PR update, and final-head check completion.

You MUST NOT declare `PR_READY` unless all of the following are true on the **same exact final PR head SHA**:

- every ordinary current defect found within the investigated recurrence families is fixed or has a complete evidence-backed protected disposition;
- all focused tests, all required full suites, typecheck, lint, formatting, guards, build, bundle, Operations Control, and documentation checks pass;
- CI has completed successfully for that exact final head;
- Cloudflare Pages has completed successfully for that exact final head when it is a required PR check;
- no required check is pending, skipped without an approved reason, stale, or tied to an earlier SHA;
- the PR is still open, targets `main`, is mergeable/clean, and contains only the approved changes;
- the final report, PR body, Repair Cards, tracker, and evidence all reference the final head and do not claim completion from an earlier commit;
- an exact Merge Manifest is present with repository, PR, source branch, source full SHA, target branch, target SHA, merge method, checks/URLs, changed commits/files, semantic impact, and rollback method;
- the report explicitly states that the owner must approve the merge and that no merge was performed.

If any item is missing, failing, stale, unverified, or still pending, you MUST continue working when it is an ordinary repair or verification task. If it cannot be completed because of a genuine protected decision or unavailable required environment, use `R9_SYSTEMIC_REMEDIATION_INCOMPLETE` or `R9_SYSTEMIC_REMEDIATION_BLOCKED` with the exact reason. Never use `R9_SYSTEMIC_REMEDIATION_COMPLETE — PR_READY` in that case.

At minimum, run:

```bash
pnpm check
```

Also run all focused tests for:

- every changed error/state/accessibility family;
- every changed G5 identity/legacy/compatibility path;
- every affected IndexedDB transaction and snapshot path;
- Memory/IndexedDB parity;
- negative proofs for each root fix;
- the browser-evidence scenario, if the approved mechanism is available.

Run all required guards and documentation checks, including:

```bash
python3 scripts/operations-control/validate.py
python3 scripts/operations-control/generate_tracker.py --check
node scripts/check-doc-index-coverage.mjs
node scripts/check-current-state-size.mjs
git diff --check
```

Run the current CI-equivalent typecheck, lint, formatting, text-density, design, module-boundary, file-size, bundle, registry, acceptance-anchor, storage-door, and application read/write guards. Do not skip a required guard because the change looks small.

After the final push:

1. capture the exact final full head SHA;
2. verify PR #347 still targets `main`;
3. confirm only the approved scope changed;
4. wait for CI and Cloudflare Pages checks on the **final head**, not an earlier green SHA;
5. confirm zero required checks are failing or pending;
6. update the final report and PR body with exact final-head URLs;
7. do not merge or clean up branches.

Do not rerun an unchanged green check without reason. Every new commit must receive the required checks.

---

## 11. Required final report

Return one complete final report after all groups, not a partial “mostly done” note. It must include:

1. Executive summary and honest final decision.
2. Exact starting and final full SHAs.
3. PR/branch/base state and all writes performed.
4. Resume checkpoint and work reused.
5. The five reviewer reports, conclusions, and conflict resolution.
6. The complete finding matrix, including findings not present in the original prompt.
7. Semantic error-surface inventory with every occurrence classified.
8. IndexedDB listener/transaction inventory with coverage proof.
9. G5 identity matrix, current/legacy compatibility decision, and migration impact.
10. Browser evidence chain, source SHA, build command, hashes, engine/version, verdict, and limitations.
11. Exact changed files and commits.
12. Focused tests, negative proofs, full-suite tests, exit codes, and CI/Pages URLs.
13. Schema, Export, Import, financial, historical, security, rejection, compatibility, and UI impact statement.
14. Memory/IndexedDB parity statement.
15. Operations Control and documentation changes.
16. Unverified, not executed, deferred, blocked, preserved, or out-of-scope items, each with exact reason.
17. Acceptance criteria and rollback boundary for each repaired group.
18. Exact owner action required next.
19. Merge Manifest marked **NOT EXECUTED**.
20. No cleanup performed.

Every material claim MUST be clearly classified as `VERIFIED`, `INFERRED`, `UNVERIFIED`, `NOT_EXECUTED`, `DEFERRED`, or `BLOCKER`.

### Final-status rules

Use exactly one of these final statuses:

```text
R9_SYSTEMIC_REMEDIATION_COMPLETE — PR_READY
```

Only if:

- the independent system scan is complete;
- every ordinary current in-scope defect found in the recurrence families is fixed;
- every preserved/deferred item has a complete evidence-backed disposition;
- browser evidence is complete or its limitation is explicitly non-blocking and accurately documented;
- all final tests and required checks pass on the final head;
- documentation and tracker agree with the final head.

Use:

```text
R9_SYSTEMIC_REMEDIATION_INCOMPLETE — <exact remaining item>
```

if any ordinary current defect remains open or any evidence/acceptance requirement is incomplete.

Use:

```text
R9_SYSTEMIC_REMEDIATION_BLOCKED — PROTECTED_DECISION_REQUIRED — <exact decision>
```

only when a protected financial, historical, Schema/Export/Import, security, compatibility, or other owner decision is genuinely required.

Do not use `PR_READY` merely because CI is green.

End the report with exactly:

```text
NO_MERGE_PERFORMED
NO_MAIN_CHANGES_PERFORMED
NO_REPOSITORY_CLEANUP_PERFORMED
NO_TOKEN_EXPOSURE
NO_ADDITIONAL_WRITES_AFTER_FINAL_REPORT
NO_REPOSITORY_WRITES_AFTER_FINAL_REPORT
```
