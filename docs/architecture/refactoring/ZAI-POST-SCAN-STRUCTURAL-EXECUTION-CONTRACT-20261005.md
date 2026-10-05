# Micro — Post-Scan Structural Completion Execution Contract

**Status:** `OWNER_ACCEPTED — EXECUTION_NOT_STARTED`

**Purpose:** This is the canonical execution contract for the owner-approved post-scan structural remediation program. It is stored in the repository so Z AI can read one pinned, reviewable source instead of relying on a long chat message.

**This file is not a second architecture authority.** It operationalizes the owner-approved plan against the live repository. Its authority chain is:

```text
AGENTS.md and applicable contracts
  → REFACTORING-PLAN-A-TO-Z.md
    → current-state.md and REFACTORING-CONTROL.md
      → this execution contract
        → wave cards, worklog, Operations Control, and PR evidence
```

If this contract conflicts with `AGENTS.md`, a financial/domain contract, schema/export/import contract, historical-data rule, security rule, or current live code, STOP and report the conflict. Do not choose the easier interpretation.

---

## 1. Owner authorization and mission

The owner has accepted the complete plan and eight grouped decisions for this program:

1. Execute the complete applicable structural program, not only the first hygiene wave.
2. Preserve historical money notes and never rewrite persisted historical text silently.
3. Use an explicit formatting-kernel ownership boundary without moving business rules into the UI.
4. Measure entry, lazy-route, and PWA-precache bundle surfaces; never raise a bundle ceiling automatically.
5. Review every large or mixed-responsibility file: split by responsibility or preserve it with a proven long-term exception, owner, growth bound, guard, review trigger, and exit condition.
6. Complete independent storage capability work while preserving IndexedDB/Memory parity and schema/export/import compatibility.
7. Separate permanent principles from governance policy, program plan, and runbook procedures.
8. Do not seek another general architecture consultation; request one only for a newly exposed protected decision involving financial meaning, historical data, schema/export/import, ownership, security, or a new trigger.

### Mission

Complete the currently applicable structural, architectural, module-boundary, ownership, discoverability, code-organization, storage-composition, test/documentation-mapping, and growth-control objectives identified by the owner-reviewed Structure/Architecture/Code Organization Scan and the independent principles review.

The goal is **root-cause closure**, not the largest possible number of file moves. Micro must remain a modular monolith. The result must make the next UI replacement, feature addition, debugging task, and rule change safer without changing financial meaning or historical compatibility.

### Execution mode

This is an implementation program after the mandatory post-Group-6 read-only gate and owner review. It is not another broad discovery assignment.

Z AI MUST:

- verify the live repository before acting;
- preserve all work already merged to `main`;
- execute the accepted waves sequentially, one writer at a time;
- use one long-lived implementation branch and independently reviewable commits/PR phase boundaries;
- continue automatically through all routine waves after each wave passes its gate;
- run focused checks and the required CI for every wave;
- keep a live completion ledger so a pilot is never reported as full completion;
- stop only for the protected conditions in Section 14 or the final merge gate;
- finish with a hostile audit, a complete final matrix, and a Merge Manifest.

No routine approval is required for individual files, methods, imports, tests, commits, or accepted wave transitions. A green test alone never authorizes a semantic, schema, security, deletion, or merge decision.

---

## 2. Live baseline and completed work

The values below are checkpoints only. Re-verify them live; never trust this text over GitHub or the working tree.

```text
Repository: https://github.com/Qays7753/Micro
Base branch: main
Last observed main SHA when this contract was prepared: 084b989f1dab1ed4254636e30f70c1d2a2d2f03c
Open PRs when this contract was prepared: 0
Remote branches when this contract was prepared:
  main
  docs/ux-ui-zed-handoff-20260921
Live schema/export pair: localSchemaVersion=38 / localExportVersion=30
```

The previous structural programs are already merged and verified on `main`. In particular:

- PRs #299–#308: the earlier controlled remediation program, including transfer goldens, drift guards, naming, Owner Money, the Order Lifecycle capability pilot, compatibility hardening, boundary observation, finance follow-up, and final audit.
- PR #311: A-to-Z structural completion code and guards.
- PR #312: post-merge reconciliation.
- PR #313: final main-pointer reconciliation.

Do not redo those waves. Do not recreate their reports. Do not merge or cherry-pick PR #309, #310, or any historical execution branch merely because it contains related text. The current task is the owner-approved post-scan completion program defined here.

The UI branch `docs/ux-ui-zed-handoff-20260921` is intentionally preserved. Do not delete, modify, or merge it in this program.

---

## 3. Mandatory reading order

Before R0, read the live versions of:

1. `AGENTS.md`.
2. `docs/operations/current-state.md`.
3. `README.md`.
4. `docs/operations/micro-thinking-charter-v1.md`.
5. `docs/00-document-index.md`.
6. `docs/operations/control/README.md`.
7. `docs/operations/control/generated/AGENT-BRIEF.md`.
8. `docs/operations/control/generated/ACTIVE-WORK.md`.
9. `docs/architecture/refactoring/README.md`.
10. `docs/architecture/refactoring/REFACTORING-CONTROL.md`.
11. `docs/architecture/refactoring/REFACTORING-PLAN-A-TO-Z.md`.
12. `docs/architecture/refactoring/REFACTORING-ARCHITECTURE-AND-MIGRATION-PLAN.md`.
13. `docs/architecture/refactoring/OWNERSHIP-AND-TRUTH-REGISTRY.md`.
14. `docs/architecture/refactoring/FILE-SIZE-AND-RESPONSIBILITY-REGISTER.md`.
15. `docs/architecture/refactoring/TEST-AND-DOCUMENTATION-MAP.md`.
16. `docs/architecture/refactoring/A-TO-Z-CLOSURE-RECORD.md`.
17. `docs/architecture/refactoring/INDEPENDENT-TRACKS-RECORD.md`.
18. `docs/architecture/refactoring/skills/micro-a-to-z-structural-refactoring/SKILL.md`.
19. Contract 40 and every contract directly named by a finding.
20. The source, tests, scripts, fixtures, generated artifacts, and configuration referenced by the active wave only.

Do not load historical `reports/`, `planning/`, or archived evidence as default authority. Read them only when a live authoritative file explicitly points to them and record why.

Before each wave, re-read the relevant contract and this contract's wave section. Do not reread the entire repository or repeat the completed scan without a material drift reason.

---

## 4. Evidence and authority rules

Every material claim in every report must be classified as one of:

```text
VERIFIED
INFERRED
UNVERIFIED
NOT_EXECUTED
DEFERRED_BY_OWNER
PRESERVE_BY_DESIGN
OWNER_DECISION_REQUIRED
CLOSED_OUT_OF_SCOPE_NO_TRIGGER
BLOCKER
```

The authority order is:

1. financial, domain, historical, schema, export/import, security, and other applicable contracts;
2. `AGENTS.md`;
3. the canonical A-to-Z principles plan;
4. active owner decisions and ADRs;
5. live code and tests;
6. ownership registries after live reconciliation;
7. generated views, guides, and worklogs;
8. historical reports.

A registry is not a source of truth merely because it says it is. Reconcile it against live code. A guard proves only what its assertions actually test. A report recommendation is not an executed action.

### Root-cause standard

For every accepted finding, the implementation record must state:

```text
ROOT_CAUSE
SHORT_TERM_SAFETY_MEASURE
LONG_TERM_REMEDIATION
WHY_THIS_BOUNDARY_IS_THE_RIGHT_OWNER
WHAT_PREVENTS_REGRESSION
EXIT_EVIDENCE
```

The following are not sufficient final remediation when an existing problem remains:

- a growth ratchet without resolving an existing oversized or mixed-responsibility file;
- a guard that leaves an existing violation unexplained and unowned;
- documentation of duplicate truth without canonicalization or drift protection;
- one successful capability pilot while accepted capabilities remain unimplemented;
- a broad contract used to avoid deciding an independent cluster's ownership;
- a compatibility shim without consumer inventory and removal trigger;
- raising a bundle ceiling without profiling and reducing avoidable cost first;
- an unowned `DEFER`, `WATCH`, `PRESERVE`, or `FUTURE_WAVE`.

A safe checkpoint is not completion. Continue until root-cause closure evidence exists or the item has an explicit owner-accepted long-term exception with owner, reason, growth bound, review trigger, exit condition, and rollback boundary.

---

## 5. Security and credentials

Use only the platform's secure credential field or existing authenticated GitHub integration:

```text
GITHUB_ACCESS_TOKEN=<SECURE_SECRET_FIELD_ONLY>
```

Never ask the owner to paste a raw token into chat. Never print, echo, save, commit, upload, or report a token, cookie, authorization header, private key, or secret URL. Use minimum required permissions. If secure access is unavailable, report the permission class and STOP; do not ask for the secret in plain text.

---

## 6. Branch, PR, and writer model

After R0 confirms the baseline, create or reuse exactly one long-lived implementation branch from the verified `origin/main`:

```text
refactoring/post-scan-structural-completion-20261005
```

Do not write directly to `main`.

Use one writer at a time. Read-only reviewers may inspect in parallel, but no two agents may mutate the same branch concurrently. Keep each wave independently reviewable through isolated commits and clearly marked PR/phase boundaries. A single long-lived program does not mean one unreadable commit.

The owner has authorized branch and PR creation, updates, focused checks, and CI. Z AI MUST NOT merge into `main` or delete branches/PRs in this program. At the final gate it must provide one exact Merge Manifest for owner approval. This is the only routine external transition intentionally held for owner confirmation.

No cleanup is part of this program. Do not delete files, tests, fixtures, reports, historical records, branches, or PRs unless a separate explicit cleanup item is approved.

---

## 7. R0 — live preflight and state reconciliation (READ_ONLY)

R0 is mandatory and must happen first. It is a short live verification, not a second full scan.

### R0 actions

1. `git fetch origin --prune` and verify the full `origin/main` SHA.
2. Inspect current branch, worktree, uncommitted files, existing commits, and remote branches.
3. Inspect open PRs, active Workstreams, `ACTIVE-WORK.md`, and current Operations Control state.
4. Verify that no local or remote work is silently being overwritten.
5. Verify the contract's live existence and commit identity.
6. Verify the previous A-to-Z completion and the current moratorium/authorization records.
7. Verify schema/export `38/30`, bundle constants, guard baseline, and file register.
8. Compare owner-approved findings with live code and mark changed, already closed, reopened, or still open.
9. Confirm the UI branch remains untouched.
10. Inspect environment health before expensive work:

```text
ENVIRONMENT_HEALTH: NORMAL | HIGH_LOAD | LOW_DISK | PROCESS_LIMIT | UNKNOWN
```

Only remove temporary artifacts created by this session when they are proven disposable. Never use `git clean -fdx` or `git reset --hard` as a performance measure.

### R0 restrictions

No edit, move, rename, delete, commit, push, PR, merge, workflow rerun, or cleanup.

### R0 report

Record:

- `BASELINE_SHA` full;
- current branch and worktree status;
- open PRs and active claims;
- exact state drift from this contract;
- findings already closed on `main`;
- findings still open;
- local/remote work that must be preserved;
- the next safe wave.

If state drift affects the intended base, preserve work and report `STATE_DRIFT`. Do not restart or overwrite work.

End R0 with:

```text
R0_COMPLETE — CURRENT_BASELINE_VERIFIED
NO_REPOSITORY_WRITES_PERFORMED
```

After R0 succeeds, continue automatically to W0. Do not ask for routine approval again.

---

## 8. Targeted five-role quality model

Do not relaunch the completed five-specialist gap scan. Use these roles as targeted read-only reviewers at R0, relevant wave gates, and the final audit:

1. **Boundaries reviewer:** modules, features, responsibilities, public doors, large files, ownership, discoverability.
2. **Data/domain/storage reviewer:** financial/domain invariants, storage capabilities, adapter parity, transfer, schema/export/import, rollback.
3. **Dependency/growth reviewer:** layers, deep imports, cycles, shims, guards, size ratchets, bundle surfaces, runtime channels.
4. **Tests/operations reviewer:** direct test evidence, contracts, fixtures, generated artifacts, CI, Operations Control, PR provenance.
5. **Hostile reviewer:** challenges pilot claims, hidden second truth, unexplained exceptions, false guard claims, and semantic changes hidden in moves.

All reviewers are read-only. They must not write competing reports. The primary executor synthesizes one worklog and one final report.

---

## 9. Findings execution matrix

Every item below must end in one final state:

```text
CLOSED_WITH_EVIDENCE
PRESERVED_WITH_OWNER_ACCEPTED_LONG_TERM_EXCEPTION
SEPARATE_TRACK_OPENED_WITH_EXACT_TRIGGER
OUT_OF_SCOPE_BY_PROJECT_RULE
BLOCKED_WITH_ONE_CONSOLIDATED_DECISION_PACKAGE
```

`DEFER`, `WATCH`, `PRESERVE`, `PILOT_COMPLETE`, or `FUTURE_WAVE` alone are not final closure states.

### F-01 to F-05 — documentation, registry, and guard hygiene

Execute as the first implementation batch unless R0 proves a specific item already closed:

- F-01: reconcile all live architecture status labels and tables without rewriting historical evidence.
- F-02: update stale `current-state.md` SHA/date wording from live Git evidence.
- F-03: replace stale registry cycle names with live canonical names while preserving the type-only/runtime distinction.
- F-04: replace the Owner Money import through the old Finance shim with the canonical sibling path before any shim deletion.
- F-05a: align guard headers with actual assertions or implement the missing assertion if it is genuinely the accepted rule.
- F-05b: align fixture exclusion semantics across the relevant guards and add a focused regression test.
- F-05c: remove duplicate lint execution while retaining one real lint check.

Acceptance: live docs agree, generated views are regenerated from source JSON, guard names match their checks, no financial/schema/export/UI behavior changes, and focused checks plus required CI pass.

### PA-1 to PA-4 — permanent principle additions

Make the following executable or explicitly recorded in the correct canonical document:

- PA-1: one owned write path per durable truth; future external/sync proposals must enter through the owner.
- PA-2: Context, events, BroadcastChannel, storage listeners, and other non-import channels are owned public surfaces with admission and contracts.
- PA-3: feature retirement must declare Preserve, Migrate, or Tombstone for data and export fields.
- PA-4: financial meaning is independent of locale; one owner governs locale, digits, dates, calendar, and RTL presentation.

### PC-1 to PC-4 — precision rules

- PC-1: Domain cannot read ambient clock, randomness, or locale; use explicit owned injection.
- PC-2: every future track has an observable trigger and owner certification.
- PC-3: public doors expose the minimum needed API; widening a door is a reviewed change.
- PC-4: every read model identifies owner inputs, derivation, and invalidation; it is not a second authority.

### PG-1 to PG-6 — governance mechanisms

- PG-1: registries record last reconciliation and correction direction.
- PG-2: each guard records what it proves, does not prove, and how changes are classified.
- PG-3: standing decisions and decision-rights prevent repeated owner questions.
- PG-4: contracts > principles > active ADRs > registries > guides/worklogs.
- PG-5: every governance artifact has owner, review trigger, and staleness state.
- PG-6: data rollback procedure and rehearsal evidence exist whenever a new durable format is written; do not claim rehearsal without proof.

### RS-1 to RS-5 — reference separation

Reorganize documentation only, without creating a second business authority:

- RS-1: combine reversibility and data rollback policy.
- RS-2: separate historical integrity from correction/append-only boundaries.
- RS-3: place size bands and completion checklist in policy/runbook.
- RS-4: keep changing guard inventory in CI/runbook and permanent guard metadata in principles.
- RS-5: keep freeze, wave, and handoff procedures in the program plan.

### STR-608 — bundle policy

Profile real contributors first. Reduce avoidable duplicate/import/bundle cost where safe. Never raise the ceiling silently. Any ceiling change requires exact before/after raw and gzip measurements, double-diff, written rationale, owner record, preserved ratchet, and a hard maximum; otherwise return one protected decision package. A split that is architecturally correct must not be undone solely to save a tiny compression delta, but a budget is not a permission to keep adding cost.

### STR-609 — direction policies

Do not convert an existing edge into a permanent exemption just because it is inconvenient. For each accepted edge, create a concise ADR with owner, reason, affected edge, review trigger, and measurable migration condition. Remove or redirect it when that does not enter a protected semantic or visual UI track.

### STR-610 — ADR provenance

Create concise retrospective ADRs, or explicitly designate the accepted wave card as the ADR artifact, for prior boundary, source-of-truth, port, and exception decisions that otherwise lack provenance.

### STR-611 — Contract-40 clusters

Evaluate `Integrity & Diagnostics`, `Recurring Planning`, and `Financial Read Models` independently. Do not use Contract 40 as a blanket preservation excuse. For each, either perform a safe responsibility-focused move or preserve it with proven cohesive ownership, owner, growth bound, review trigger, and exit condition.

### STR-612 — inventory material responsibility

Resolve the `SPLIT_NOW` classification of `inventoryMaterialService` through responsibility-focused splitting/moving, or a strong owner-accepted cohesion exception with a growth guard, review trigger, and exit condition. It must not remain unexplained.

### STR-613 — storage capability extraction

Execute all currently extraction-ready groups in dependency order, not just a pilot. At minimum re-evaluate live readiness for:

1. recurring expenses;
2. expense budgets;
3. loans/received loans;
4. distribution policies;
5. short-cash declarations;
6. owner entitlement with the EXE-017 review.

For each: Repair Card, authoritative type, consumer inventory, IndexedDB/Memory implementation, parity tests, transfer touchpoints, and rollback. If R0 shows a group is already complete, prove it on the live tree instead of repeating it.

### STR-614 — withdrawal wallet guard

Use the live consumer inventory. Prefer the mechanical migration and shim removal when parity is proven. Otherwise correct the lifecycle statement and record the exact remaining consumer and removal trigger. Never delete the shim on assumption.

### STR-615 — Public Doors and Import Consolidation

Create only real-consumer public doors. Migrate consumers mechanically. Remove deep imports only with inventory and parity evidence. Do not create generic `common`, `utils`, `shared`, or dumping-ground barrels. Protected visual UI boundaries remain outside this structural wave.

### STR-616 — guarded-union values

Process every live guarded-union set and explicitly deferred acceptance list. Derive values from authoritative Domain sources when behavior remains identical, or add executable drift coverage with owner and removal condition. Do not leave local acceptance sets unregistered.

### STR-617 — guard gaps

Implement and negatively test every applicable accepted gap, including qualitative SCC coverage, Domain deep-import coverage, resolution-based UI-to-storage protection where allowed, presentation-layer coverage, registry coverage, file-responsibility enforcement, shim-lifecycle enforcement, the safe `g5` matcher, and STR-623 anchors. A growth guard alone does not close an existing violation.

### STR-618 — remaining Port inventory

Classify every unused method, Clock boundary, and named side channel. Remove only with proof of no production consumers, or extract the boundary with conformance tests. Every inventory row gets an action or an owner-accepted long-term exception.

### STR-619 — test and documentation map

Build and maintain the page-to-test map, contract-to-control links, test-location convention, missing ownership rows, generated coverage evidence, and Feature → Module → Contract → Test → Owner mapping. Every accepted unit needs direct evidence or a documented reason.

### STR-620 — qualitative SCC

Resolve the `projectFinancialService` ↔ `financialAnalysisService` type-only cycle mechanically when safe, or record an explicit owner-accepted exception with removal condition. Correct stale names at the same time.

### STR-623 — duplicate acceptance values

Register both locations immediately, add executable drift anchors, and canonicalize to the authoritative Domain/registry source whenever behavior-preserving. If a local copy must remain, it needs owner, exact reason, source relationship, drift test, and removal trigger. Documentation alone does not close STR-623.

---

## 10. Wave program and dependencies

### W0 — baseline and adoption manifest

- Complete R0.
- Classify prior work as `EXISTING`, `ADOPT`, `REIMPLEMENT`, `REJECT`, or `NEEDS_REVIEW`.
- Create the one long-lived branch only from verified `origin/main`.
- Create/claim the Operations Control Workstream before implementation.
- Record the consolidated owner decision ledger.

### W1 — control, principles, and F-01…F-05

- Execute the hygiene findings.
- Encode PA/PC/PG/RS in the correct canonical documents.
- Add decision-rights, precedence, trigger, staleness, and guard metadata.
- Update JSON sources first, then generate views.

### W2 — formatting, locale, and message ownership

- Establish the formatting-kernel ownership boundary.
- Inventory all 15 money-message locations.
- Separate message-only, persisted-note, and semantic rules.
- Preserve historical persisted text.
- Add characterization and money-layer protection.
- Do not move business rules into UI.

### W3 — Reader/Writer and financial boundaries

- Build consumer inventory and characterization tests for `projectFinancialService`.
- Split read and write surfaces mechanically where evidence supports it.
- Keep financial formulas and policy ownership unchanged.
- Define read-model derivation and invalidation.
- Preserve Contract-40 invariants.

### W4 — application public doors

- Start with a feature that has real consumers.
- Create a narrow door, migrate consumers, update boundary evidence, and measure bundle impact.
- No mass barrel creation.

### W5 — storage capabilities

- Reconcile all 131 methods and capability groups.
- Execute every currently ready independent group in dependency order.
- Keep IndexedDB and Memory in parity.
- Keep the legacy port/facade until zero consumers and a separate removal proof.
- Preserve schema, migrations, snapshots, write guards, transaction semantics, error identity, and history.

### W6 — non-UI large and mixed-responsibility files

Review every in-scope `SPLIT_NOW`, `SPLIT_CANDIDATE`, and changed `WATCH` file, including:

- `IndexedDbLocalStore.ts`;
- `MemoryLocalStore.ts`;
- `projectFinancialService.ts`;
- `integrityCheckService.ts`;
- `inventoryMaterialService.ts`;
- `transferFamilyValidators.ts`;
- `src/domain/craft-order/policies.ts`;
- and any file that crosses its live responsibility or growth threshold.

For each file: responsibility seam, owner, consumers, tests, source of truth, growth bound, split/preserve evidence, and rollback. Do not split by function count alone and do not leave an existing risk hidden behind a ratchet.

### W7 — UI structural boundaries (not visual redesign)

- Create application query surfaces and application-owned view models where justified.
- Reduce UI typing against persistence records only when the boundary evidence supports it.
- Migrate canonical specifiers and remove shims only at consumer count zero.
- Add journey tests for Smoke-only pages when inside accepted structural scope.
- Do not edit CSS, DOM, tokens, navigation, copy, or visual behavior.

### W8 — bundle, growth, and guards

- Measure entry, lazy, and PWA-precache surfaces.
- Establish a real baseline and growth bounds.
- Add guard metadata and positive/negative tests.
- Correct F-14 gaps that are in the accepted scope.
- Never weaken a guard or raise a ceiling to pass CI.

### W9 — tests, contracts, generated artifacts, and operations mapping

- Complete accepted direct test evidence.
- Map contracts, fixtures, snapshots, generated artifacts, modules, and owners.
- Verify round-trip and historical compatibility wherever touched.
- Update Operations Control source JSON and regenerate Markdown/CSV/XLSX views.
- Complete Q-a through Q-j.

### W10 — independent hostile final audit

A reviewer who did not implement the last wave must verify:

- every F finding, PA/PC/PG/RS item, STR item, and Q-a…Q-j item;
- every in-scope file and large-file classification;
- all public surfaces, deep imports, cycles, runtime channels, shims, and registries;
- storage capability and adapter parity;
- tests, contracts, generated artifacts, and worklog provenance;
- bundle surfaces and growth guards;
- no active duplicate source of truth;
- no hidden financial, schema, export/import, historical, security, permission, or UI change;
- exact merge and CI evidence.

### Final closure

Do not report completion until the final matrix says every applicable item is one of the five final states in Section 9 and the exact merge commit has passed CI on `main`. The moratorium and future triggers must be recorded after closure.

---

## 11. Required per-wave card and tests

Every wave or slice must include:

```text
Wave ID
Repair Card / finding ID
Purpose
Base full SHA
Branch and PR
Exact allowed files
Exact forbidden files
Consumer inventory
Owner and source of truth
Root cause
Short-term safety measure
Long-term remediation
Financial/schema/export/import/history/UI/security/performance impact
Focused commands and exit codes
Tests and CI URLs
Bundle delta when applicable
Acceptance criteria
Rollback boundary
Remaining work
Final status
```

Minimum checks, selected by the wave and recorded with exit codes:

- `python3 scripts/operations-control/validate.py`;
- `python3 scripts/operations-control/generate_tracker.py --check`;
- `pnpm check` for code waves, unless a documented narrower gate is accepted;
- focused typecheck/test/guard commands;
- `git diff --check`;
- `node scripts/check-secrets.mjs`;
- `node scripts/check-test-focus.mjs`;
- `node scripts/check-entity-touchpoints.mjs` when storage is touched;
- doc-index, skill-reference, boundary, file-size, bundle, and generated-view guards when affected.

Do not rerun a successful check for the same unchanged commit merely for ceremony. Run all required checks for the new commit and distinguish local evidence from PR CI and post-merge `main` evidence.

---

## 12. Permanent non-goals and protected boundaries

MUST NOT:

- write directly to `main`;
- perform blind mass moves;
- invent or change financial meaning, formulas, rounding, classification, accounting terminology, result states, or error semantics;
- change `localSchemaVersion=38` or `localExportVersion=30` in this program;
- change migrations, snapshots, export/import bytes, historical acceptance, or rejection behavior;
- rewrite persisted historical money messages silently;
- delete a shim before consumer proof and removal condition;
- delete branches, PRs, historical records, reports, tests, fixtures, or generated evidence as cleanup;
- touch visual UI, CSS, tokens, DOM, navigation, copy, or UX behavior;
- create generic dumping-ground modules;
- add Dart, Flutter, Kotlin, Swift, Python backend, API, Sync, Auth, Cloud, multi-user, multi-currency, telemetry, or service extraction without a new trigger and owner decision;
- weaken, bypass, or remove a guard/test to make a wave pass;
- claim a test, CI run, merge, or deployment not actually verified;
- print or store secrets.

---

## 13. Protected stop conditions

STOP and present **one consolidated decision/blocker package**, not a chain of small questions, if:

- live `main`, branch, PR, or SHA cannot be reconciled;
- unknown uncommitted work would be overwritten;
- an accepted finding requires a new financial meaning, formula, rounding, classification, or error policy;
- a persisted historical text or interpretation would change;
- schema, migration, export/import bytes, snapshot, or rejection behavior would change;
- IndexedDB/Memory parity or transaction semantics cannot be preserved;
- a consumer, owner, or source of truth is unknown;
- a shim cannot be proven safe to remove;
- a public door requires exports beyond real consumer need;
- an existing violation cannot be resolved without a protected semantic/UI/security change;
- bundle or raw/gzip limits are exceeded and no behavior-preserving recovery is evidenced;
- a new platform, API, Sync, Auth, permission, security, billing, deployment, or external service is needed;
- a deletion, branch deletion, PR closure, or merge is required;
- a required check or CI fails and cannot be repaired inside the accepted wave;
- the diff expands beyond the wave card;
- a report contradicts the live tree.

The package must state the exact choice, affected files, alternatives, evidence, impact, tests, rollback boundary, and safe stopping point.

---

## 14. Reporting and continuation contract

At the end of every wave, update the canonical worklog and applicable Operations Control source JSON, regenerate official views, and update `current-state.md` only with live fields. Never hand-edit generated views.

Reports must distinguish:

- completed work;
- reused prior work;
- work not performed;
- remaining root causes;
- owner-accepted exceptions;
- blockers;
- local, PR, and `main` SHAs;
- exact commands and CI URLs;
- financial/schema/export/import/history/UI/security impact;
- rollback.

If the session stops unexpectedly, resume by inspecting branch, worktree, commits, PR, report, and last ledger checkpoint. Do not reset, reclone over work, or repeat completed waves. Continue from the first incomplete action only after state comparison.

Use these status values only:

```text
VERIFIED
IN_PROGRESS
PR_READY
MERGED_UNVERIFIED
VERIFIED_ON_MAIN
DEFERRED_BY_OWNER
OUT_OF_SCOPE
OWNER_DECISION_REQUIRED
BLOCKED
STATE_DRIFT
```

---

## 15. Final Merge Manifest and closure

Z AI may prepare and update PRs, but must not merge `main`. At the end, provide:

```text
Repository
PR number and URL
Source branch
Source full SHA
Target branch: main
Target full SHA before merge
Proposed merge method
All required CI checks and exact run URLs
Files and commits changed
Financial/semantic impact
Schema/export/import/migration impact
Historical-data impact
UI/visual impact
Deployment state
Rollback method
Final matrix of every finding
```

After owner-approved merge, the post-merge verification must prove the exact merge SHA on `main`, rerun required checks for that SHA, reconcile Operations Control, and record the moratorium and future triggers.

If complete, the final report must end with:

```text
POST_SCAN_STRUCTURAL_COMPLETION — VERIFIED_ON_MAIN
ALL_APPLICABLE_FINDINGS_CLOSED_OR_OWNER_ACCEPTED
NO_UNAPPROVED_FINANCIAL_OR_SEMANTIC_CHANGE
NO_UNAPPROVED_SCHEMA_OR_EXPORT_IMPORT_CHANGE
NO_UNAPPROVED_HISTORICAL_DATA_CHANGE
NO_UNAPPROVED_UI_OR_VISUAL_CHANGE
NO_UNRELATED_CLEANUP_PERFORMED
NO_SECRETS_EXPOSED
```

If incomplete, it must end with:

```text
POST_SCAN_STRUCTURAL_COMPLETION_INCOMPLETE — OWNER_DECISIONS_REQUIRED
EXACT_REMAINING_ITEMS_REPORTED
NO_UNAPPROVED_STRUCTURAL_WRITES
NO_UNAPPROVED_FINANCIAL_OR_SEMANTIC_CHANGE
NO_UNAPPROVED_SCHEMA_OR_EXPORT_IMPORT_CHANGE
NO_UNAPPROVED_UI_OR_VISUAL_CHANGE
```

Never use a completion status for a pilot, a report, a recommendation, a green intermediate wave, or a partial implementation.

---

## 16. Single consolidated authorization

The owner has explicitly authorized the plan represented by this contract. After live R0 verification succeeds, treat that authorization as effective for all routine structural work within Sections 9–10. Do not ask for task-by-task approval.

The only exceptions requiring a stop are the protected conditions in Section 13 and the final merge gate in Section 15.

This contract authorizes execution on the dedicated branch and PRs. It does not authorize direct writes to `main`, deletion, secret handling in chat, or semantic/financial/schema/export/import/UI/security changes.
