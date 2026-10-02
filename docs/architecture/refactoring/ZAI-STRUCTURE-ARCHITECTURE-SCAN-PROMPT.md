# Z AI — Micro Current-to-Target Architecture and Migration Plan

## Mission

You are the execution agent for **Phase 1 of Micro’s architecture/refactoring program**.

Perform a **read-only, comprehensive current-state and architecture review** of the live `main` repository. The purpose is to understand the current application accurately, compare it with the approved architectural direction, and produce one owner-reviewable **system-wide target architecture and migration/refactoring plan** before any structural refactoring begins.

The review is a means, not the final goal. The primary deliverable is a practical `CURRENT → TARGET → MIGRATION WAVES` plan based on `REFACTORING-PLAN-A-TO-Z.md`. Do not produce a generic bug-audit or a list of isolated defects. Mention a problem only when it is evidence for a boundary, ownership, dependency, duplication, discoverability, test/documentation, or migration decision, and connect it to the proposed target boundary and safe wave.

**Fresh-analysis rule:** Start from the current live repository and analyze it from the ground up according to `REFACTORING-PLAN-A-TO-Z.md`. Do not reuse, summarize, or treat any previous structural scan, old report, old branch, or historical agent conclusion as a shortcut or source of current truth. The deliverable must be a new system-wide migration plan based on the current tree, current dependencies, current tests, current documentation, and current boundaries. If historical material is encountered, classify it as historical and do not use it to replace live inspection.

This is **not** a refactoring task, not a cleanup task, not a UI task, and not a financial remediation task.

> **AI investigates. The owner reviews and decides. Only an explicitly accepted wave may change structure.**

## Repository and authoritative inputs

- Repository: `https://github.com/Qays7753/Micro`
- Target branch: `main`
- Expected setup baseline when this control space was created: `9271a85dc29934096297f24cfe9d729f9af65b10`
- Do not trust that SHA as the current head. Fetch and record the actual live `origin/main` SHA before doing anything.
- Refactoring control directory: `docs/architecture/refactoring/`
- Control file: `docs/architecture/refactoring/REFACTORING-CONTROL.md`
- Approved architectural reference: `docs/architecture/refactoring/REFACTORING-PLAN-A-TO-Z.md`
- Directory README: `docs/architecture/refactoring/README.md`
- Required live-state source: `docs/operations/current-state.md`
- Required entry rules: `AGENTS.md`
- Required document authority catalog: `docs/00-document-index.md`
- Required coordination brief: `docs/operations/control/generated/AGENT-BRIEF.md`

The files in `docs/architecture/refactoring/` are a control surface for this program. They do not override contracts, financial policies, `AGENTS.md`, or the live state.

## Secure credential rule

If GitHub write access is needed, use the secure credential field only:

```text
GITHUB_ACCESS_TOKEN=<SECURE_SECRET_FIELD_ONLY>
```

Never request, print, echo, save, commit, paste, or report a raw token, cookie, authorization header, private key, or secret URL. If permission is missing, report the permission class and stop at that boundary.

## Mandatory first actions

Before inspecting findings:

1. Read `AGENTS.md`.
2. Read `docs/operations/current-state.md`.
3. Read `README.md`.
4. Read `docs/operations/micro-thinking-charter-v1.md`.
5. Read `docs/00-document-index.md`.
6. Read `docs/implementation/03-pre-build-alignment-v1.md`.
7. Read `docs/operations/control/generated/AGENT-BRIEF.md`.
8. Read `docs/architecture/refactoring/README.md`, `REFACTORING-CONTROL.md`, and `REFACTORING-PLAN-A-TO-Z.md`.
9. Fetch `origin/main` and record the exact full SHA, tree state, open PRs, and active Workstreams.
10. Check whether the live state differs from the expected setup baseline. If it differs, do not treat that as an error by itself; record `STATE_DRIFT`, re-anchor every finding to the live SHA, and do not overwrite unrelated work.

At the start of your report, state:

- what you read;
- the live repository and SHA;
- what you will inspect;
- what you will not inspect or change;
- the evidence and acceptance standard;
- unknowns that may limit the scan.

## Write boundary

This phase has a **REPORT_ONLY_PR** write boundary.

### Allowed writes

You may create or update only the following documentation artifacts on a dedicated branch from the verified live `origin/main`:

1. `docs/architecture/refactoring/REFACTORING-ARCHITECTURE-AND-MIGRATION-PLAN.md` — the single complete current-to-target plan and evidence record;
2. `docs/architecture/refactoring/REFACTORING-CONTROL.md` — only the phase status and report pointer, if needed;
3. `docs/architecture/refactoring/FILE-SIZE-AND-RESPONSIBILITY-REGISTER.md` — the complete file-size, responsibility, and growth inventory described below;
4. a minimal Operations Control record only if the repository’s existing control protocol requires one for the report-only Workstream.

You may push the dedicated branch and open **one report-only PR** for owner review.

### Forbidden writes

You MUST NOT:

- push directly to `main`;
- merge the report PR;
- edit, move, rename, delete, or reformat production files;
- edit `apps/`, `src/`, `tests/`, or runtime `scripts/`;
- edit React, TSX, CSS, tokens, DOM, navigation, copy, or visual assets;
- change financial meaning, formulas, policies, terminology, or accounting claims;
- change storage, IndexedDB, schema, migrations, snapshots, export/import, or historical interpretation;
- add Ports, Facades, Shared Kernel modules, `features/`, `common/`, or `utils/` directories;
- change dependencies, build configuration, CI workflows, security settings, or deployment settings;
- delete branches, close old PRs, merge old PRs, or clean up reports/artifacts;
- create a second architecture authority or a second ownership registry;
- rewrite or “fix” an existing report while scanning.

Do not use a green check, a good-looking folder tree, or an agent recommendation as permission to refactor.

## Five read-only specialists

Use five genuinely independent read-only specialists, then act as the synthesizer. If the platform cannot start all five, continue with the available roles and mark the missing role `UNVERIFIED`; do not pretend it ran.

### Specialist 1 — Current module and responsibility boundaries

Inspect the current tree, packages, features, modules, oversized files, mixed responsibilities, public entry points, and discoverability from the live repository. Produce a current module map and candidate target boundaries. Do not propose final folder names without evidence.

### Specialist 2 — Dependencies and architectural conformance

Inspect import/dependency direction, layer violations, deep imports, cycles, barrel files, hidden coupling, duplicated adapters, and boundary exceptions. Distinguish measured violations from inferred risk. Do not modify guards or configuration.

### Specialist 3 — Domain, application, storage, and data boundaries

Trace representative flows through Domain, Application Services, UI consumers, LocalStore/IndexedDB, Memory adapters, transfer/export/import, clocks, diagnostics, and persistent entities. Identify where policy, orchestration, persistence, and presentation are mixed. Do not change financial or data behavior.

### Specialist 4 — Tests, documentation, contracts, and sources of truth

Map tests, contracts, decision records, current-state documents, generated views, fixtures, and feature discoverability to the actual code. Find duplicate definitions, stale references, undocumented public surfaces, and missing coverage maps. Treat old reports as historical evidence only, not live truth.

### Specialist 5 — Future evolution and operational risk

Evaluate how the current boundaries affect future changes and possible Android/iOS, Dart/Flutter, Python/API, Sync, Auth, or service extraction. Use triggers and contracts; do not recommend building those platforms now. Identify structural risks, migration hazards, rollback/data-compatibility risks, and the smallest safe sequence of future waves.

Each specialist must return:

- exact scope;
- exact files and commands inspected;
- evidence-backed observations;
- confidence/evidence class;
- findings with stable IDs;
- conflicts with other specialists;
- files or behavior deliberately not touched.

## Scan scope

The synthesized scan MUST cover all of the following, without drifting into implementation:

### A. Current module and feature boundaries

- package/workspace boundaries;
- domain areas and business capabilities;
- application use-case/service boundaries;
- adapters and infrastructure boundaries;
- UI composition boundaries at dependency level only;
- public entry points and internal files;
- oversized files and mixed responsibilities;
- feature discoverability for a new developer or agent.
- a complete file inventory, including production code, tests, scripts, generated artifacts, fixtures, snapshots, and configuration files in scope;
- file size, responsibility count, growth risk, and the reason each file is preserved, watched, split-candidate, split-now, generated/fixture, UI-out-of-scope, or review-required.

### B. Dependency and layer integrity

- actual dependency direction;
- Presentation → Application → Domain direction;
- Application-to-Port and Adapter relationships;
- imports from UI to storage or domain;
- domain imports from React/browser/storage;
- deep imports and barrel-file leakage;
- cycles and strongly connected components;
- duplicated boundary abstractions;
- exceptions that are intentional versus accidental.

Also inspect and classify side effects and import-time initialization, public API/contract exposure, configuration/environment/secret boundaries (without exposing secrets), dependency/toolchain constraints, concurrency/retry/partial-failure/recovery behavior, performance/resource and bundle implications, generated-artifact ownership, test determinism, migration/rollback compatibility, error identity/diagnostics, and branch/PR/report provenance.

### C. Responsibility and ownership

For each major concept, identify as far as evidence allows:

- the owner module;
- the authoritative definition;
- the calculation or policy location;
- the write path;
- the read models and consumers;
- storage and export/import touchpoints;
- tests and fixtures;
- documentation and decision references;
- historical or compatibility constraints.

Do not change any financial policy. If ownership and policy are entangled, classify the result rather than solving it.

### D. Data and persistence composition

Inspect the composition of:

- Domain;
- Application;
- LocalStore/IndexedDB;
- Memory/test adapters;
- transfer/export/import;
- snapshots and historical values;
- clocks and diagnostics;
- persistent entity touchpoints.

The scan must explicitly state what is structural and what would be semantic or data-sensitive.

### E. Tests and documentation mapping

Map:

- domain tests;
- application tests;
- storage/round-trip tests;
- contract and characterization tests;
- guard tests;
- fixtures and test data;
- operational records;
- authoritative contracts;
- historical reports;
- generated views.

Identify coverage gaps and discoverability problems, but do not add tests or edit docs beyond the allowed report/control files.

## File-size and responsibility review bands

Use non-blank LOC as a review signal for production files unless the measured baseline justifies a documented adjustment:

- `NORMAL`: below 400 — no size action by itself;
- `WATCH`: 400–799 — monitor growth and do not add unrelated responsibility without review;
- `SPLIT_CANDIDATE`: 800–1,199 — analyze responsibilities and define growth control before adding scope;
- `SPLIT_NOW`: 1,200+ with multiple responsibilities, or any size with a severe ownership/layer violation — require a split card and consumer inventory before implementation.

These bands do not authorize mass splitting. A large cohesive file may be `PRESERVE` with an evidence-based reason, owner, and growth rule; a small mixed-responsibility file may be `SPLIT_NOW`. Tests, fixtures, generated artifacts, snapshots, and configuration files must be classified separately.

The register must include at least: path, category, raw LOC, non-blank LOC, bytes, exports, imports, consumers, responsibilities, change reasons, side effects, initialization, public API role, source-of-truth role, tests, growth status, owner, action, rollback impact, and exception/waiver.

### F. Target module map

Produce a target map that is deliberately logical rather than a blind folder prescription:

| Current boundary | Responsibility | Candidate target boundary | Evidence | Consumers | Proposed action | Prerequisites | Risk |
|---|---|---|---|---|---|---|---|

Allowed proposed actions are `PRESERVE`, `REFRAME`, `MERGE`, `SPLIT`, `MOVE_LATER`, `GUARD_ONLY`, `DEFER`, and `OWNER_DECISION_REQUIRED`.

Do not recommend a move unless the consumer inventory, public surface, tests, and rollback boundary are named.

## Evidence and classification rules

Every material statement MUST be one of:

- `VERIFIED` — directly observed from the live tree, command, API, test, or file;
- `INFERRED` — supported interpretation that is not directly proven;
- `UNVERIFIED` — could not be checked;
- `NOT_EXECUTED` — intentionally not run;
- `DEFERRED` — deliberately postponed;
- `BLOCKER` — prevents completion of the current scan.

Every finding MUST also have one owner-facing classification:

- `FIX_NOW`;
- `PRESERVE`;
- `DEFER`;
- `OUT_OF_SCOPE`;
- `OWNER_DECISION_REQUIRED`.

Do not convert an inference into a verified fact. Do not count a historical report as evidence of the current tree unless the live tree confirms it.

## Required finding format

For every finding, use this exact structure:

```text
ID: STR-<number>
Title:
Evidence class: VERIFIED | INFERRED | UNVERIFIED | NOT_EXECUTED | DEFERRED | BLOCKER
Owner classification: FIX_NOW | PRESERVE | DEFER | OUT_OF_SCOPE | OWNER_DECISION_REQUIRED
Severity: Critical | High | Medium | Low
Current evidence: exact paths, symbols, commands, and/or SHAs
Affected boundaries:
Why it matters: development / extensibility / change isolation / debugging / data / financial / security / performance
Root cause or uncertainty:
Minimum safe remediation:
Dependencies and ordering:
Acceptance criteria:
Rollback boundary:
Explicit non-goals:
```

Use one finding per independent root cause. Link duplicates rather than repeating the same problem in multiple IDs.

## Required plan/report structure

Write exactly one complete Markdown plan/report at:

```text
docs/architecture/refactoring/REFACTORING-ARCHITECTURE-AND-MIGRATION-PLAN.md
```

The report MUST contain:

1. Title, date, live SHA, report version, and final status.
2. Executive answer in simple Arabic or clear bilingual wording: what is healthy, what is risky, and what must not be touched yet.
3. Scope, non-goals, credentials mode, and exact actions performed.
4. Baseline table: repository, branch, full SHA, worktree state, package/tooling, open PRs, active Workstreams, and known drift.
5. Evidence legend and limitations.
6. Current module/feature map.
7. Oversized-file and responsibility map.
8. Dependency/layer/cycle/deep-import findings.
9. Domain/application/storage/UI composition map, with UI limited to architecture/dependency boundaries and no visual critique.
10. Sources-of-truth and duplication map.
11. Test, fixture, contract, and documentation map.
12. Feature discoverability assessment.
13. Future-evolution assessment for mobile and other platforms using triggers, without proposing immediate platform implementation.
14. Complete findings register using the required finding format. Findings are evidence for the plan, not the final deliverable by themselves.
15. Target module map using the required table.
16. Minimum safe migration/refactoring waves. For every wave state:
    - objective;
    - exact scope;
    - dependencies;
    - allowed and forbidden files;
    - risks;
    - acceptance criteria;
    - rollback boundary;
    - whether owner approval is required;
    - whether tests/CI are required after that wave.
17. Owner decision table: decision, why it matters, options, recommendation, and what remains safe if deferred.
18. Explicit list of items preserved, deferred, out of scope, and requiring owner decision.
19. Reconciliation table showing where specialists agreed or disagreed and how the disagreement was resolved.
20. Final recommendation: the smallest safe next wave, not a mass move.
21. Exact list of files and lines changed by this report-only phase.
22. Exact list of files and behavior not changed.
23. Rollback/recovery boundary for the report-only PR.

The report must be detailed enough for the owner to decide, but must not create a second permanent encyclopedia. Do not copy whole source files or paste long historical reports into it. Link to exact paths and summarize only the evidence needed for a decision.

## Report-only PR contract

After the report is complete:

1. Re-read the entire report from the saved file.
2. Verify the file exists, is non-empty, and contains every required section.
3. Run only focused documentation/report checks needed to prove the report artifact and repository control files are valid. Do not run the full product test suite for a read-only audit unless a repository guard is specifically required and you report it.
4. Inspect `git diff --check` and the complete diff.
5. Reconfirm that no forbidden path changed.
6. Commit on a dedicated branch from the verified live `origin/main`.
7. Push the branch and open one report-only PR to `main`.
8. Do **not** merge the PR. Do **not** delete branches. Do **not** close old PRs.
9. Stop for owner review.

The PR description must include:

- report path;
- exact base SHA and report-branch SHA;
- files changed;
- evidence classes and limitations;
- statement that no structural refactoring occurred;
- statement that no product, financial, UI, schema, export/import, or historical behavior changed;
- focused checks actually run and their exit codes;
- rollback boundary: close/revert the report-only PR; no runtime rollback is needed because runtime files were not changed.

## Stop conditions

STOP immediately and report `BLOCKER` or `STATE_DRIFT` if:

- the live `main` cannot be verified;
- the current Workstream/Tracker state conflicts with the control files;
- there is uncommitted or unrelated work that would be overwritten;
- the requested report requires changing forbidden files;
- a finding would require a financial, semantic, schema, export/import, UI, security, or historical decision;
- you cannot determine whether a file is current or historical;
- a specialist makes a claim without evidence;
- a proposed move lacks a consumer inventory or rollback boundary;
- permissions are insufficient;
- a token or secret would need to be exposed.

Do not solve a stop condition silently. Record it and stop at the safe boundary.

## Continuation rule

If this task is resumed:

1. fetch the live repository and inspect the current branch, worktree, existing PR, report, and control file;
2. compare them with the last report checkpoint;
3. preserve existing work;
4. do not reset, reclone over work, repeat completed analysis, or overwrite the report blindly;
5. if the state differs, report `STATE_DRIFT` and resume only after reconciling the difference.

## Final response contract

Return a short summary plus the complete plan/report path and PR URL. Do not paste a huge report instead of saving it. State exactly what was written and what was not written. Do not create separate sub-agent reports or duplicate planning files; synthesize all work into the single canonical plan/report.

End with exactly:

```text
PLAN_COMPLETE — OWNER_DECISIONS_REQUIRED
NO_STRUCTURAL_REFACTORING_PERFORMED
NO_PRODUCT_OR_FINANCIAL_SEMANTICS_CHANGED
NO_SCHEMA_OR_EXPORT_IMPORT_CHANGED
REPORT_ONLY_PR_OPEN — DO_NOT_MERGE
NO_REPOSITORY_WRITES_BEYOND_REPORT_ONLY_PR
```
