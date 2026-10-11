# Z AI — Micro R10-B Complete Systemic Remediation

## Single-branch execution contract for Waves B1–B6

You are the primary implementation agent for the Micro repository. Execute the complete owner-authorized R10-B remediation program from Wave B1 through Wave B6 on **one dedicated feature branch**, with one writer at a time, separate reviewable commits, and one final PR ready for owner review and merge.

This prompt is the execution authority for this continuation. Do not restart historical R0–R9 work, do not recreate already-merged work, and do not treat an old report as proof that a current defect is fixed. Verify the live repository first.

---

## 1. Repository, branch, and starting point

- Repository: `https://github.com/Qays7753/Micro`
- Target branch: `main`
- Dedicated implementation branch: `refactoring/r10b-complete-b1-b6-20261011`
- Known branch-base checkpoint when this prompt was prepared: `2f78fba2e3d980590c75912345c1ea4d3a094efa`
- Canonical R10-B evidence directory:
  `docs/operations/control/evidence/structural-remediation-r10-20261011/`
- Canonical input files:
  - `R10-B-FINDINGS-MATRIX-2026-10-11.json`
  - `R10-B-REPAIR-CARDS-2026-10-11.md`
  - `R10-B-OWNER-DECISION-PACKAGE-2026-10-11.md`
  - `R10-B-W0-FINDINGS-RECONCILIATION-AND-RESEARCH-REPORT-2026-10-11.md`
  - `R10-B-W0-REVIEWER-SYNTHESIS-2026-10-11.md`
  - `R10-B-W0-REVIEWER-REPORTS-2026-10-11/`
  - `R10B-FULL-REPAIR-BACKLOG-SUMMARY-2026-10-11.md` if present; treat it as a supporting index, not a competing source of truth.

The branch is intentionally pre-created for this work. Continue on this exact branch. Do not create a second implementation branch, do not work directly on `main`, and do not force-push.

Before any write:

1. Fetch `origin/main` and all relevant refs.
2. Record the live full SHA of `origin/main`.
3. Inspect this branch, its worktree, commits, uncommitted files, and ancestry.
4. Verify whether the branch is based on the live `origin/main`. If `main` advanced, do not silently reset or rebase away work. Record `STATE_DRIFT`, preserve the branch, and use the safest non-destructive resolution; stop only if the drift creates a real conflict or would overwrite work.
5. Inspect open PRs, active Workstreams, `current-state.md`, `AGENT-BRIEF.md`, and `ACTIVE-WORK.md`.
6. Run the Operations Control validator before claiming or modifying a Workstream.

Known starting state: R0–R9 are already verified on `main`; R10-B W0 is accepted and the 54-item B1–B5 repair backlog is approved in the repository records. R10-B implementation has not been completed. Do not repeat R0–R9 unless a live check proves that a finding has reopened or the baseline has drifted.

---

## 2. Mission and quality bar

Close every current defect in the approved R10-B backlog at root cause, not by hiding symptoms, changing only numbers, weakening guards, or documenting an unresolved problem as complete.

The required outcome is a repository that is easier and safer to extend, review, debug, test, and replace at the UI layer while preserving Micro's financial and historical truth.

The standard is:

- **Root-cause repair**, not a cosmetic patch.
- **Short-term and long-term correctness**, not the easiest local workaround.
- **One source of truth per concept**, with boundary copies explicitly labeled and justified.
- **Complete consumer and impact inventory** before moving or deleting anything.
- **Evidence-based closure** for every finding.
- **No unowned current defect** and no generic `DEFER`.
- **No hidden behavior change** inside structural, documentation, guard, or test work.
- **No false claim of verification**: distinguish `VERIFIED`, `INFERRED`, `UNVERIFIED`, `NOT_EXECUTED`, `DEFERRED_BY_OWNER`, `PRESERVE_BY_DESIGN`, `OWNER_DECISION_REQUIRED`, and `BLOCKER`.

The repository currently has no production users and no production data. This gives us permission to correct defective internal design aggressively now, even when the change is larger. It does **not** permit silently deleting historical fixtures, weakening legacy acceptance, changing persisted meaning, or changing a protected contract without an explicit versioned decision. “No users” means repair the root cause now; it does not mean erase evidence or invent a new contract.

---

## 3. Non-negotiable Micro invariants

Read and obey `AGENTS.md`, the live contracts, the current state, and the active Repair Cards. The following constraints are mandatory:

1. Do not write directly to `main`.
2. One writer at a time. The five reviewers below are read-only and must not mutate the branch.
3. Do not perform blind mass moves, bulk renames, generic barrels, or cleanup unrelated to an active Repair Card.
4. Do not create `features/`, `common/`, `shared/`, or `utils/` dumping-ground modules.
5. Do not change financial meaning, formulas, rounding, classification, accounting terms, rejection behavior, historical interpretation, or persisted money text silently.
6. Do not silently change `localSchemaVersion=38` or `localExportVersion=30`.
7. Do not silently change export/import bytes, legacy acceptance, migration behavior, snapshot meaning, or tamper rejection.
8. Preserve IndexedDB/Memory parity, transaction safety, CAS, idempotency, `storage_stale`, error identity, backup-before-replace, and rollback behavior.
9. Do not change visual UI, CSS, design tokens, visual layout, copy, navigation, or UX redesign. B4 may change only explicitly scoped runtime semantics, accessibility semantics, focus behavior, document titles if accepted, and tests. Every such change requires behavioral tests and must be visually neutral.
10. Preserve the bundle ceilings `650,000 raw` and `155,300 gzip`. Never raise a ceiling to make a check pass.
11. Do not delete a shim, fixture, historical artifact, PR, branch, generated evidence, or compatibility path inside this task. Cleanup is a separate owner-authorized operation.
12. Do not expose, print, paste, commit, or report tokens, cookies, headers, or private credentials.
13. Update Operations Control JSON sources first; regenerate Markdown/CSV/XLSX views; never edit generated views manually.
14. Preserve all historical evidence. Do not rewrite old reports to make them appear current. Add dated corrections or appendices when needed.
15. Keep the protected UI branch `docs/ux-ui-zed-handoff-20260921` untouched if it exists.
16. Do not merge the PR. Leave the implementation branch and PR ready for the owner’s separate merge decision.

---

## 4. Mandatory context hygiene and continuation behavior

This task may be resumed in a browser session with old context. Before starting:

- If your environment supports task/context reset, discard irrelevant prior task state and load only this prompt, the live repository, and the canonical R10-B evidence. Do not delete repository work.
- Do not restart completed work merely because the conversation context is large.
- At every checkpoint, persist the exact phase, commit, files, tests, findings, and next action in the PR and canonical report.
- If interrupted, inspect the remote branch, PR, worktree, commits, and report. Continue from the first incomplete action. Never reset, overwrite, reclone over, or repeat completed work.
- If the branch state differs from a checkpoint, report `STATE_DRIFT`, preserve evidence, and resolve safely or stop with a precise blocker.
- Do not ask routine questions. Make implementation choices inside the approved scope using the repository contracts and best practices. Stop only for a protected semantic/data/schema/export/history/security/permission decision, irreconcilable state drift, destructive deletion, or a check that cannot be repaired within the active card.

---

## 5. Required reading order before implementation

Read the live versions from the checked-out branch, not copied text from chat:

1. `AGENTS.md`
2. `docs/operations/current-state.md`
3. `README.md`
4. `docs/operations/micro-thinking-charter-v1.md`
5. `docs/00-document-index.md`
6. `docs/operations/control/README.md`
7. `docs/operations/control/generated/AGENT-BRIEF.md`
8. `docs/operations/control/generated/ACTIVE-WORK.md`
9. `docs/architecture/refactoring/README.md`
10. `docs/architecture/refactoring/REFACTORING-CONTROL.md`
11. `docs/architecture/refactoring/ZAI-STRUCTURAL-REMEDIATION-R0-R10-EXECUTION-CONTRACT-20261007.md`
12. `docs/architecture/refactoring/STRUCTURAL-REMEDIATION-PLAN-20261007.md`
13. `docs/architecture/refactoring/OWNERSHIP-AND-TRUTH-REGISTRY.md`
14. `docs/architecture/refactoring/FILE-SIZE-AND-RESPONSIBILITY-REGISTER.md`
15. `docs/architecture/refactoring/TEST-AND-DOCUMENTATION-MAP.md`
16. `docs/contracts/40-technical-ownership-map-contract.md`
17. The R10-B W0 matrix, Repair Cards, Owner Decision Package, W0 report, and five reviewer reports.
18. Only the active source files, tests, scripts, fixtures, workflows, and contracts named by the active Repair Card.

Before code, publish a concise **understanding card** in the PR body or report containing:

- objective and user/system problem;
- exact active wave and finding IDs;
- in-scope and out-of-scope items;
- financial, historical, Schema/Export/Import, security, UI, and compatibility invariants;
- expected failure modes;
- tests and acceptance criteria;
- rollback boundary;
- what is already implemented on `main` versus only described in evidence.

---

## 6. Five specialized read-only reviewers

Use five distinct sequential read-only reviewers before implementation and at each wave gate. They may inspect code, history, tests, reports, and diffs, but they must not edit files, commit, push, merge, delete, or create competing reports.

### Reviewer 1 — Architecture, boundaries, and ownership

Review module and feature boundaries, responsibility seams, large-file decisions, public doors, deep imports, ownership, consumer inventories, source-of-truth duplication, and whether the proposed repair actually improves change locality. Challenge file-per-function splits and generic barrels.

### Reviewer 2 — Domain, storage, Transfer, and data integrity

Review financial invariants, domain/application ownership, IndexedDB/Memory parity, transactions, CAS, idempotency, `storage_stale`, snapshots, Transfer, Schema 38, Export 30, legacy acceptance, goldens, tamper rejection, migration, backup-before-replace, and rollback. This reviewer must reject any accidental semantic or historical change.

### Reviewer 3 — Runtime, UI semantics, accessibility, and journeys

Review runtime behavior, error channels, ErrorBoundary, focus, roles, route/title behavior when explicitly in scope, page state machines, direct page tests, smoke routes, and the prohibition on visual redesign. Verify that a semantic repair has a behavioral test and does not change DOM styling, copy, tokens, or navigation.

### Reviewer 4 — Guards, CI, security, and operations

Review guard logic, positive/negative coverage, CI semantics, action pinning, Node/toolchain consistency, secrets coverage, test focus, typecheck/lint/prettier scope, generated artifacts, Operations Control, baseline/re-anchor behavior, and the difference between what a guard proves and does not prove.

### Reviewer 5 — Hostile closure reviewer

Try to disprove every closure claim. Look for duplicate truth, false-positive fixes, changed baselines hiding growth, tests that assert the bug rather than the fix, untested branches, missing consumers, hidden compatibility changes, stale report language, unclassified findings, generic DEFER, and claims based only on documentation or a green intermediate check.

At each gate, reconcile the five reports into one decision record. Do not silently discard disagreement. Record the evidence source and resolution for each material disagreement.

---

## 7. The complete approved FIX_NOW backlog

The following 54 IDs are the minimum required implementation scope. Use the canonical matrix and Repair Cards for the exact file locations, evidence, dependencies, and acceptance criteria. Do not drop, merge away, or silently rename an ID.

### Wave B1 — tracker, evidence, documentation, and source-of-truth hygiene

`R10A-F-001`, `R10A-F-002`, `R10A-F-005`, `R10A-F-007`, `R10A-F-022`, `R10A-F-032`, `R10A-F-033`, `R10B-NF-008`, `R10B-NF-027`, `R10B-NF-028`, `R10A-F-034`, `R10A-F-035`, `R10A-F-036`, `R10A-F-037`, `R10B-NF-030`, `R10B-NF-031`, `R10B-NF-032`, `R10B-NF-033`, `R10B-NF-034`, `R10B-NF-029`.

Also execute the approved B1 additions: precise Trigger and Detection specifications for the 14 canonical `PILOT_EVIDENCE_REQUIRED` items, plus the SOP and evidence/source-of-truth views, without creating a second source of truth.

### Wave B2 — protected Transfer, Export/Import, and data integrity

`R10A-F-009`, `R10B-NF-009`, `R10A-F-008`, `R10A-F-010`.

This includes RC-1 owner-money tamper-evidence gates. Do not regenerate or change current-pair goldens until the live Owner Decision Package confirms the OD-8 scope. Preserve legacy optional-if-absent behavior and Schema 38 / Export 30.

### Wave B3 — source of truth, IDs, messages, and module boundaries

`R10A-F-003`, `R10A-F-011`, `R10A-F-012`, `R10B-NF-006`, `R10B-NF-001`, `R10B-NF-002`, `R10B-NF-003`, `R10B-NF-010`, `R10A-F-004`.

This includes RC-2 WasteContext single-source repair and the bounded message/identity/capability/source-of-truth work described in the Repair Cards.

### Wave B4 — runtime semantics, UI boundaries, and journey coverage

`R10A-F-015`, `R10A-F-016`, `R10A-F-017`, `R10A-F-018`, `R10A-F-020`, `R10A-F-021`, `R10B-NF-015`, `R10B-NF-016`.

This includes RC-3 ErrorBoundary post-mount focus. Route focus and `document.title` are included only if the live Owner Decision Package explicitly accepts OD-12. Do not perform visual redesign, navigation redesign, copy changes, token changes, or broad UI cleanup.

### Wave B5 — guards, CI, security-adjacent operability, and toolchain coverage

`R10A-F-024`, `R10A-F-025`, `R10A-F-027`, `R10A-F-028`, `R10A-F-029`, `R10A-F-030`, `R10A-F-031`, `R10B-NF-020`, `R10B-NF-021`, `R10B-NF-022`, `R10B-NF-023`, `R10B-NF-024`, `R10B-NF-026`.

This includes RC-4 Replit hook handling. Do not choose A/B/C by convenience. Apply the live owner decision for OD-9. If OD-9 is not explicitly accepted in the live control records, prepare one exact decision package and do not silently choose. Preserve fail-closed behavior in every option.

### Wave B6 — final systemic sweep and closure evidence

B6 has no new shortcut list. It must repeat the relevant W0-C family searches on the final tree and prove that every finding is either closed with evidence, preserved by an accepted long-term exception, carried by an exact protected decision/trigger, or genuinely out of scope/disproved. B6 must discover and classify additional defects, not only reprint the original 54 IDs.

---

## 8. The 16 precise DEFER cards are not forgotten

The W0 matrix contains 16 non-generic DEFER cards. They are not automatically accepted forever. Re-evaluate all of them in B6 and whenever their active wave touches the affected surface:

`R10A-F-006`, `R10A-F-013`, `R10A-F-014`, `R10A-F-019`, `R10A-F-026`, `R10B-NF-004`, `R10B-NF-005`, `R10B-NF-007`, `R10B-NF-011`, `R10B-NF-012`, `R10B-NF-013`, `R10B-NF-014`, `R10B-NF-017`, `R10B-NF-018`, `R10B-NF-019`, `R10B-NF-025`.

For every one:

- verify whether its trigger is already met on the current branch;
- if the trigger is met, promote it into the active wave and fix it now;
- if it is a current defect that can be fixed without a protected decision, do not leave it as DEFER;
- if it genuinely requires a protected owner decision or a future platform not present in this repository, preserve the exact blocker, owner, trigger, detection method, review date/event, exit criteria, affected files, and rollback boundary;
- never use a generic “later”, “future wave”, or “not enough time” disposition;
- never claim R10-B complete while a current defect is hidden behind a generic DEFER.

The one disproved item `R10A-F-023` must remain recorded as `DISPROVED / OUT_OF_SCOPE` with its evidence. Do not implement a fix for a disproved finding.

The five `PRESERVE_BY_DESIGN` cards from the owner package must also be rechecked against their owner, growth bound, guard, review trigger, exit condition, tests, and rollback evidence. A preserve card is not a silent exemption.

---

## 9. Wave execution protocol

Execute waves strictly in this order: **B1 → B2 → B3 → B4 → B5 → B6**. Do not start a later wave while the current wave has an unclassified current defect, failed acceptance check, missing evidence, or unresolved protected decision affecting that wave.

A wave may contain several coherent commits on the same branch. Use one commit per coherent repair slice or per logically indivisible part. Do not create one giant opaque commit. After each commit:

1. inspect the diff;
2. run focused tests;
3. run relevant guards;
4. update the canonical report and Repair Card status;
5. add a concise PR comment/checkpoint with the commit SHA, scope, tests, evidence class, and remaining work.

At the end of each wave:

1. run the five read-only reviewers sequentially;
2. reconcile their findings;
3. update `R10-B-FINDINGS-MATRIX-2026-10-11.json` and the active Workstream/Item JSON first;
4. regenerate generated Markdown/CSV/XLSX views;
5. run validators and documentation guards;
6. update `current-state.md` only with live current fields;
7. append to `current-state-log.md` and `AGENT-SEQUENTIAL-WORKLOG.md` without rewriting history;
8. update the single unified execution report;
9. record exact commit SHA, tests, CI state, semantic impact, and rollback boundary;
10. leave the branch in a coherent, buildable state before starting the next wave.

If a wave reveals a new issue:

- classify it as `NEW`, `DEEPENS`, `DUPLICATE`, `REOPENED`, or `FALSE_POSITIVE`;
- assign a durable finding ID in the canonical matrix;
- record exact evidence, affected files, root cause, impact, owner, dependencies, acceptance, and rollback;
- fix it in the current wave when it is a current defect within scope;
- otherwise create one exact protected decision package and continue independent work;
- never bury it only in a PR comment or final prose.

---

## 10. Wave-specific implementation requirements

### R10-B1 — documentation and tracker closure

Repair the authoritative records, not only the generated views. Resolve stale file counts, deleted-service references, reversed ownership arrows, stale `todo.md` routing, duplicate phase truth, stale blockers, generator escaping, dangling pointers, BE wording, R10-A record corrections, and `context.md` live-state drift.

Create the required B1 package without a second source of truth:

- one clear SOP for future Agents;
- one storage-parity view;
- one Transfer/Legacy/Golden view;
- one Guard proves/does-not-prove view;
- precise per-item Trigger and Detection for the 14 pilot items;
- source/owner/review/staleness metadata for each registry;
- generated views regenerated from JSON.

Required B1 checks include, at minimum:

```bash
python3 scripts/operations-control/generate_tracker.py --refresh-excel-meta
python3 scripts/operations-control/generate_tracker.py --check
python3 scripts/operations-control/validate.py
node scripts/check-doc-index-coverage.mjs
node scripts/check-current-state-size.mjs
git diff --check
```

Run the repository's canonical documentation, control, and guard checks as applicable. Do not mark B1 complete if a generated view is stale or if a current-state claim is not supported by the live tree.

### R10-B2 — Transfer and data-integrity root fix

Implement RC-1 and the approved B2 cards only after confirming the live OD-8 decision. The recommended default is the minimal four owner-money families plus a compile-complete registry mechanism, unless the owner package explicitly records uniform scope.

Required safeguards:

- current-pair owner-money families are counted and required-array validated;
- present-but-non-array values are rejected, never coerced silently to `[]`;
- missing owner families in a re-sealed current-pair file are rejected;
- legacy pairs remain accepted under their existing optional-if-absent contract;
- digest tests use an independent expected-value path and FIPS/cross-check vectors;
- IndexedDB/Memory parity is preserved;
- Schema 38 and Export 30 remain unchanged;
- no financial meaning or historical acceptance changes;
- goldens are regenerated only through the official path and recorded in MANIFEST.

Minimum focused checks:

```bash
pnpm --filter @micro/prototype-web test -- --run transfers
pnpm --filter @micro/prototype-web test -- --run export
pnpm --filter @micro/prototype-web test -- --run migration
pnpm --filter @micro/prototype-web test -- --run tamper
pnpm --filter @micro/prototype-web test -- --run adapterConformance
pnpm typecheck
node scripts/check-entity-touchpoints.mjs
```

If any byte, rejection, legacy, snapshot, or financial result changes unexpectedly, stop with a `SEMANTIC_CHANGE_MANIFEST` and one consolidated decision package. Do not hide it by updating goldens.

### R10-B3 — source-of-truth and module-boundary root fix

Remove duplicate declarations and untruthful casts only after inventorying all consumers. Repair WasteContext, CapabilityId, message identity and conformance, insecure-context guard families, `__unset__`, MaterialUnit labels, ThemePreference, and the actual ID-generator family as specified by the cards.

Rules:

- use canonical domain/application ownership;
- use type-only imports where that is the real sanctioned dependency direction;
- do not move financial meaning into UI or formatters;
- do not create a broad message registry if it becomes a second business source of truth;
- preserve error identity and persisted text unless a protected versioned decision is explicit;
- add duplicate-symbol and module-boundary regression tests;
- update door-surface and registry baselines only when the code change is real and documented.

Minimum checks:

```bash
pnpm typecheck
pnpm lint
pnpm format:check
node scripts/check-module-boundaries.mjs
node scripts/check-type-cycles.mjs
node scripts/check-registry-coverage.mjs
pnpm test -- --run
```

### R10-B4 — runtime semantics and journey coverage

Repair runtime behavior and test coverage without visual redesign:

- reconcile the smoke list with the actual router and direct page coverage;
- implement RC-3 post-mount ErrorBoundary focus behavior with mount-time and post-mount tests;
- inventory and normalize error announcement channels (`alert` versus `status`) based on semantic role, not blind replacement;
- ensure StateMarker actually propagates its accepted role to the DOM;
- add direct tests for the three uncovered pages;
- eliminate or centralize the highest-drift UI financial mirrors only where the canonical application/domain owner is proven;
- add route focus and `document.title` only if OD-12 is explicitly accepted and only with behavioral tests;
- repair AgreementEditor state distinctions between read-error and cost-unavailable, including retry and correct announcement role.

Do not change CSS, tokens, layout, visual copy, navigation, or route structure. The six required smoke/journey surfaces are:

- `CashReversalEditor`
- `CashWalletEditor`
- `G5DeclarationEditor`
- `InventoryReversalEditor`
- `ReceivedLoanDetail`
- `SharePreview`

If a name or route changed on the live branch, reconcile it against the router and record the evidence instead of inventing a seventh list.

Minimum checks:

```bash
pnpm --filter @micro/prototype-web test -- --run
pnpm typecheck
pnpm lint
node scripts/check-module-boundaries.mjs
node scripts/check-test-focus.mjs
```

### R10-B5 — guard, CI, and operability root fix

Repair the guard and CI findings without weakening enforcement:

- apply the live OD-9 decision for the Replit hook; preserve fail-closed unknown-environment behavior;
- pin floating Actions and Node minor versions according to the accepted policy;
- make secrets guard output a complete family inventory rather than first-match-only;
- make merge-base/re-anchor authorization machine-verifiable, not dependent only on human-readable text;
- remove or correct ineffective dependency overrides only after checking real dependency reachability;
- add negative tests for Python design-token and contrast guards;
- include the relevant `scripts/`, `tools/`, and `vite.config.ts` surfaces in the intended lint/typecheck/format contracts;
- close the 226-test-file typecheck gap;
- unify CI handling of file-size and bundle values without changing ceilings;
- add a guard for Python skip behavior and Vitest `.fails()` focus coverage;
- execute the scheduled live mutation drill for build-dependent guards where it is available and appropriate.

Do not replace an invalid guard with a weaker regex. Every guard must document:

- what it proves;
- what it does not prove;
- its change class;
- its fixtures and exclusions;
- its positive and negative tests;
- its rollback boundary.

Minimum checks:

```bash
pnpm operations-control:test
pnpm operations-control:check
pnpm typecheck
pnpm lint
pnpm format:check
pnpm guards
pnpm design-guards
pnpm test -- --run
pnpm prototype:check
pnpm prototype:test
pnpm prototype:build
```

### R10-B6 — final systemic sweep

Run a fresh, hostile, repository-wide verification after the final B5 commit. Do not simply trust earlier reports.

The final sweep must:

1. repeat the W0-C family searches for all 54 FIX_NOW IDs, all 16 precise DEFER cards, the disproved item, and the five PRESERVE cards;
2. search for unclassified findings, duplicate IDs, stale IDs, reopened defects, and generic DEFER language;
3. search for the same defect family beyond the originally named files;
4. verify every changed file is tested or has a documented reason and owner;
5. verify no second source of truth was introduced;
6. verify no protected financial, historical, Schema/Export/Import, rejection, security, permission, or visual change slipped in;
7. verify every current defect is closed with evidence or represented by one exact protected decision package;
8. re-run the five read-only reviewers on the final tree;
9. produce the final PR-ready report and Merge Manifest;
10. leave the PR open for the owner; do not merge or clean up branches.

---

## 11. Protected owner decisions

Use the live Owner Decision Package as the only source for decisions. Do not silently infer acceptance from an old chat message or from a recommendation in a report.

The known protected decisions include:

- baseline differential policy;
- ratification of the five `PRESERVE_BY_DESIGN` cards;
- exact B1 trigger/detection treatment for out-of-scope and blocked items;
- W0 acceptance and B1–B6 authorization;
- OD-8 RC-1 minimal versus uniform scope and compile-complete registry mechanism;
- OD-9 Replit option A/B/C;
- OD-10 application-internal seam policy;
- OD-11 MoneyMinor branding policy;
- OD-12 route focus and document-title addition;
- OD-13 pilot detection-method specifications.

If a decision is already explicitly accepted in the live Owner Decision Package or current Operations Control, use it and do not ask again. If it is not accepted and the active wave needs it, create one consolidated decision package containing:

- exact decision sentence;
- affected files and findings;
- alternatives considered;
- evidence and impact;
- tests required;
- exact allowed side effects;
- forbidden side effects;
- rollback boundary;
- safe stopping state.

Continue all independent work that does not depend on the decision. Do not falsely claim full completion while the protected decision remains open.

---

## 12. Required tests and final verification

Run focused tests after each commit and wave. At the final gate, run the canonical full suite at least once on the final branch head unless the exact same SHA already has a verified successful run that covers the required checks. Do not rerun an unchanged successful suite merely for appearance.

At minimum, final evidence must include:

```bash
pnpm check
pnpm operations-control:test
pnpm operations-control:check
pnpm typecheck
pnpm lint
pnpm format:check
pnpm text-density
pnpm design-guards
pnpm guards
pnpm test -- --run
pnpm prototype:check
pnpm prototype:test
pnpm prototype:build
node scripts/check-doc-index-coverage.mjs
node scripts/check-current-state-size.mjs
git diff --check
```

Also run every focused command required by the active cards, including Transfer, export, migration, tamper, adapter parity, direct page, ErrorBoundary, guard-negative, CI-semantic, and Operations Control tests.

For every command report:

- exact command;
- exit code;
- branch and full SHA;
- whether it was local, PR-CI, or post-merge evidence;
- relevant output summary;
- known limitations.

A green test that did not execute the changed code is not sufficient evidence. A changed baseline is not a fix unless the reason and differential proof are explicit.

---

## 13. Required files and PR evidence

Maintain one unified report at:

`docs/operations/control/evidence/structural-remediation-r10-20261011/R10-B-COMPLETE-B1-B6-EXECUTION-REPORT-2026-10-11.md`

The report must be updated at each wave checkpoint and finalized at the end. It must contain:

1. executive summary;
2. exact live baseline and final branch SHA;
3. branch, PR, commit, and wave lineage;
4. understanding card and scope boundaries;
5. five-reviewer synthesis per gate;
6. one row for every original finding ID;
7. one row for every new finding ID;
8. evidence class for every material claim;
9. affected files/modules and consumer inventory;
10. root cause and canonical source of truth;
11. implementation and test evidence;
12. financial, semantic, historical, Schema/Export/Import, rejection, security, permission, and UI impact statement;
13. protected decisions and their exact status;
14. precise DEFER/PRESERVE/OUT_OF_SCOPE records, if any remain;
15. acceptance criteria and rollback boundary per wave;
16. list of files changed and files intentionally not changed;
17. CI links and exact check status;
18. limitations and unresolved blockers;
19. final Merge Manifest.

The PR body and comments must include a concise checkpoint after each wave. Each checkpoint must state:

- `R10-B1` / `B2` / `B3` / `B4` / `B5` / `B6`;
- commit SHA(s);
- findings closed;
- findings newly discovered and classification;
- tests and exit codes;
- reviewer gate result;
- protected decisions used or still required;
- next wave;
- rollback boundary.

Do not rely on chat output as the only report. The repository and PR must contain the evidence.

---

## 14. Final PR-ready gate

The task is complete only when all of the following are true:

- all applicable B1–B5 FIX_NOW findings are closed with evidence;
- B6 has completed the fresh systemic sweep;
- no current defect is hidden by generic DEFER;
- every remaining DEFER has an exact owner, trigger, detection, review, exit, and rollback boundary;
- every PRESERVE card has complete long-term evidence and an explicit review trigger;
- the single disproved finding remains correctly recorded as disproved;
- Schema 38 and Export 30 are unchanged unless an explicit protected versioned decision says otherwise;
- no unapproved financial, semantic, historical, rejection, security, permission, or visual change exists;
- all relevant focused tests pass;
- the final canonical suite and guards pass on the final branch head, or any limitation is explicitly recorded as a blocker;
- Operations Control JSON and generated views are synchronized;
- current-state and append-only logs are accurate and historical records are preserved;
- the PR diff contains only approved R10-B work;
- the source branch is pushed and the PR targets `main`;
- the PR is open and ready for owner review;
- no merge, branch deletion, PR closure, or cleanup has been performed.

Use exactly one final status:

```text
R10B_COMPLETE — PR_READY
```

Only if a protected decision or genuine blocker prevents completion, use:

```text
R10B_BLOCKED — OWNER_DECISION_REQUIRED
```

or

```text
R10B_BLOCKED — <exact technical blocker>
```

A blocked status must list exact remaining IDs, evidence, affected files, attempted repairs, tests, and the safe next action. Never report partial completion as `R10B_COMPLETE`.

---

## 15. Secure GitHub credential and upload instruction

Use the GitHub credential already configured in the external agent’s secure credential field, referenced only as:

`GITHUB_ACCESS_TOKEN=<SECURE_SECRET_FIELD_ONLY>`

Use it only for the repository operations required by this task: fetch, branch push, PR creation/update, PR comments, and reading CI/checks. Do not print it, echo it, put it in a URL, commit it, paste it into the report, or include it in any command log. If access is unavailable or returns `401/403`, report the permission class only and stop the affected operation without exposing the secret.

Push the completed branch and create or update one PR targeting `main`. Keep all wave commits and checkpoint comments on this same branch/PR. Do not merge the PR. Do not delete any branch or close any PR. The owner will review the final Merge Manifest and decide the merge separately.

The owner expects the final report and PR to make it possible to merge safely without another discovery pass. Therefore, do not stop after a partial wave, do not omit newly discovered related defects, and do not use a broad “defer” to shorten the task.

Final execution invariants:

```text
NO_MERGE_PERFORMED
NO_BRANCH_DELETION_PERFORMED
NO_PR_CLOSURE_PERFORMED
NO_UNRELATED_CLEANUP_PERFORMED
NO_CLEANUP_PERFORMED
NO_WRITES_AFTER_FINAL_REPORT
NO_TOKEN_EXPOSURE
```
