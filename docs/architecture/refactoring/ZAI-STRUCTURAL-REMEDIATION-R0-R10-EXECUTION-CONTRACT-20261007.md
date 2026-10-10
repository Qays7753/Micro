# Micro — Structural Remediation R0–R10 Execution Contract

**Status:** `OWNER_ACCEPTED — R0–R8_VERIFIED_ON_MAIN; R9_PREFLIGHT_GATE`

**Owner authorization:** On 2026-10-07 the owner accepted the updated Arabic execution plan and its explicit traceability matrix, and authorized this program to start with the contract publication followed by R0. This contract operationalizes that plan. It does not replace `AGENTS.md`, financial/domain contracts, the canonical architecture plan, or live Operations Control.

**Canonical plan:** `docs/architecture/refactoring/STRUCTURAL-REMEDIATION-PLAN-20261007.md`

**Program:** Root-cause structural remediation and controlled reorganization of the existing Micro modular monolith after the owner-approved read-only Structure/Architecture/Code Organization gate.

**Repository:** `https://github.com/Qays7753/Micro`

**Base branch:** `main`

**Implementation branch:** `refactoring/structural-remediation-r0-r10-20261007`

**Initial verified base:** `25594773a83ec5eb1e9dde5feaf1c808c0ff686f`

**Current verified main (2026-10-10):** `87274cf91a9d27b9b5f9c3cee3f980218ae6aa0e` — R8 Merge commit from PR #345; post-merge CI run `38060781329` succeeded on this exact SHA.

**Current phase:** R0–R8 are verified on main. R9 has not started. Its next operation is the R9 preflight/read-only evidence reconciliation: maps, parity/boundary matrices, guard claims, journey/test evidence, and rollback-rehearsal scope; no R9 implementation write starts before the scoped package is owner-accepted.

**Workstream:** `WS-216`

**Control item:** `ARCH-007`

---

## 1. Mission

Close every current structural, ownership, discoverability, code-organization, storage-composition, testing, documentation, guard, and growth-control defect identified by the owner-approved Structure Scan and Flash principles review.

The target is root-cause closure, not a high count of moved files. Micro remains a local-first modular monolith. The work must make future UI replacement, feature development, financial-rule maintenance, debugging, and storage evolution safer without hiding a semantic, financial, historical, schema, export/import, security, permission, or visual-UI change inside structural work.

The complete finding matrix is in the canonical plan. The contract requires explicit traceability for every `F-*`, `CON-*`, `STR-*`, `FIN-*`, `AV-*`, `EXE-*`, `PA-*`, `PC-*`, `PG-*`, `RS-*`, `C*`, `L-*`, `V*`, and `Q-*` identifier present in the two owner-reviewed reports.

---

## 2. Authority and reading order

Read these live from the verified checkout before any phase:

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
11. `docs/architecture/refactoring/REFACTORING-PLAN-A-TO-Z.md`
12. `docs/architecture/refactoring/REFACTORING-ARCHITECTURE-AND-MIGRATION-PLAN.md`
13. `docs/architecture/refactoring/OWNERSHIP-AND-TRUTH-REGISTRY.md`
14. `docs/architecture/refactoring/FILE-SIZE-AND-RESPONSIBILITY-REGISTER.md`
15. `docs/architecture/refactoring/TEST-AND-DOCUMENTATION-MAP.md`
16. `docs/architecture/refactoring/A-TO-Z-CLOSURE-RECORD.md`
17. `docs/architecture/refactoring/INDEPENDENT-TRACKS-RECORD.md`
18. `docs/architecture/refactoring/skills/micro-a-to-z-structural-refactoring/SKILL.md`
19. Contract 40 and every contract named by the active Repair Card
20. The active source, tests, scripts, fixtures, generated artifacts, and configuration only

The old `ZAI-POST-SCAN-STRUCTURAL-EXECUTION-CONTRACT-20261005.md` is a historical completed program. Do not reopen it and do not treat its W0–W10 closure as this program's closure.

Use the new plan and this contract as execution documents, not as competing business or financial authorities. If live code, tests, contracts, `AGENTS.md`, or Operations Control contradicts this contract, `STOP` and report the exact conflict.

---

## 3. Non-negotiable constraints

- `MUST NOT` write directly to `main`.
- `MUST NOT` perform blind mass moves, bulk renames, or cleanup.
- `MUST` use one writer at a time on the implementation branch.
- `MUST` create a Repair Card and consumer inventory before every structural move.
- `MUST` split every existing `SPLIT_NOW` or mixed-responsibility file, or produce a complete `PRESERVE_BY_DESIGN` card with owner, reason, growth bound, guard, review trigger, exit condition, tests, and rollback boundary.
- `MUST` resolve current defects; an unowned generic `DEFER` is not a final state.
- `MUST` preserve IndexedDB/Memory parity, transaction safety, idempotency, CAS, `storage_stale`, migration behavior, error identity, and backup-before-replace behavior.
- `MUST NOT` change `localSchemaVersion=38` or `localExportVersion=30` silently or within a structural PR without a protected versioned manifest and owner decision.
- `MUST NOT` change financial meaning, formulas, rounding, classification, accounting terms, rejection behavior, historical interpretation, or persisted money text silently.
- `MUST NOT` touch visual UI, CSS, tokens, DOM, navigation, copy, or UX behavior. Structural UI boundaries and type/import migration are allowed only where explicitly included in the active wave.
- `MUST NOT` delete a compatibility shim, facade, branch, PR, fixture, historical record, or generated evidence without a separate explicit cleanup authorization and zero-consumer evidence.
- `MUST NOT` create generic `features/`, `common/`, `shared/`, or `utils/` dumping-ground modules.
- `MUST NOT` raise the bundle ceiling to pass a check.
- `MUST` keep `650,000 raw` and `155,300 gzip` as the current bundle ceilings unless a protected owner decision explicitly changes policy.
- `MUST` update Operations Control JSON first and regenerate generated Markdown/CSV/XLSX views.
- `MUST` preserve the UI branch `docs/ux-ui-zed-handoff-20260921` untouched.
- `MUST` keep secrets in secure fields only; never print, paste, save, or report tokens.

---

## 4. Evidence and final states

Every material claim is classified as `VERIFIED`, `INFERRED`, `UNVERIFIED`, `NOT_EXECUTED`, `DEFERRED_BY_OWNER`, `PRESERVE_BY_DESIGN`, `OWNER_DECISION_REQUIRED`, `CLOSED_OUT_OF_SCOPE_NO_TRIGGER`, or `BLOCKER`.

Every finding must end in one of:

```text
CLOSED_WITH_EVIDENCE
PRESERVED_WITH_OWNER_ACCEPTED_LONG_TERM_EXCEPTION
SEPARATE_TRACK_OPENED_WITH_EXACT_TRIGGER
OUT_OF_SCOPE_BY_PROJECT_RULE
BLOCKED_WITH_ONE_CONSOLIDATED_DECISION_PACKAGE
```

`DEFER`, `WATCH`, `PRESERVE`, `PILOT_COMPLETE`, and `FUTURE_WAVE` alone are not closure states for a current defect.

Each Repair Card must state:

```text
ID
Category
Classification
Evidence
Affected files/modules
Root cause
Canonical source of truth
Consumer inventory
User/data/financial/security/UI impact
Dependencies
Short-term safety measure
Long-term remediation
Tests and commands
Acceptance criteria
Rollback boundary
Final state
```

---

## 5. Execution sequence

Execute sequentially. Do not repeat completed historical programs.

### R0 — Live preflight and baseline reconciliation — READ ONLY

No repository writes are allowed in R0. Verify:

- `git fetch origin --prune` and the full `origin/main` SHA;
- current branch, worktree, uncommitted files, local commits, and remote branches;
- open PRs and active Workstreams;
- `ACTIVE-WORK.md`, `AGENT-BRIEF.md`, `current-state.md`, and Operations Control validity;
- this contract and the canonical plan's commit identity;
- `localSchemaVersion=38` and `localExportVersion=30`;
- bundle ceilings, file-size baseline, module-boundary baseline, test map, and current register;
- all previous A-to-Z and post-scan work already merged on `main`;
- UI branch preservation;
- environment state: `NORMAL`, `HIGH_LOAD`, `LOW_DISK`, `PROCESS_LIMIT`, or `UNKNOWN`;
- each report finding against the live tree: already closed, partially closed, open, reopened, duplicate, false positive, or protected decision.

R0 must produce one report at:

```text
docs/architecture/refactoring/R0-LIVE-BASELINE-AND-FINDING-RECONCILIATION-2026-10-07.md
```

R0 must end with:

```text
R0_COMPLETE — CURRENT_BASELINE_VERIFIED
NO_REPOSITORY_WRITES_PERFORMED
```

If the live base, worktree, PRs, active claims, or source of truth cannot be reconciled, end with `STATE_DRIFT` and stop. Do not reset or overwrite work.

### R1 — Truth, governance, documentation, and guard hygiene

Close F-01..F-05, CON-1..CON-4, PA-1..PA-4, PG-1..PG-6, RS-1..RS-5, and applicable stale-record findings. Update live JSON sources, generate views, and fix guard/CI contradictions without changing product behavior.

### R2 — Money, formatting, input, date, and message ownership

Characterize before changing. Establish one owner for rounding, parsing, display formatting, locale, dates, and money messages. Separate message-only, persisted-note, and semantic rules. Preserve historical text unless a protected decision and versioned behavior change is explicitly accepted.

### R3 — Storage capability extraction

Reconcile the complete live capability registry, not only the prior pilot. For every capability, inspect the 131-method port *(dated correction 2026-10-07 — R1/TG-01: the live port is **130** methods after STR-618 removed `getActualTimeRecord` on 2026-10-04, before this contract was written; R3 cards must inventory the live interface, not this line's number)*, IndexedDB, Memory, conformance tests, write guards, migrations, transfer touchpoints, and rollback. Execute every extraction-ready independent group. A pilot is not completion.

### R4 — Transfer, Schema, Export/Import, and history

Canonicalize current acceptance values. Keep historical acceptance only when necessary and isolated. Verify goldens, MANIFEST, SHA/counters, round-trip, tamper rejection, backup-before-replace, migration gates, and legacy pairs. Any actual Schema/Export/Import/rejection behavior change requires an explicit versioned manifest and protected decision.

### R5 — Application boundaries, Reader/Writer, public doors, and deep imports

Inventory consumers first. Separate readers and writers where evidence supports it. Create narrow doors only for real consumers. Migrate mechanically. Do not create generic barrels. Register and resolve every accepted deep import and runtime channel.

### R6 — Every large or mixed-responsibility file

Review all live `SPLIT_NOW`, `SPLIT_CANDIDATE`, and changed `WATCH` files, including storage adapters, `projectFinancialService`, `integrityCheckService`, `inventoryMaterialService`, `transferFamilyValidators`, `craft-order/policies.ts`, and large pages. Split by responsibility or produce a complete long-term exception card. A ratchet alone does not close an existing risk.

**Mandatory post-Group-6 entry gate:** Before any R6 structural write, perform a comprehensive read-only Structure/Architecture/Code Organization Scan. It must cover module and feature boundaries; file responsibilities and oversized files; dependency/layer violations and cycles; duplication and sources of truth; feature discoverability; storage/application/domain/UI composition; test and documentation mapping; and a target module map. Produce one detailed findings report. Classify every item as `FIX_NOW`, `PRESERVE`, `DEFER`, or `OUT_OF_SCOPE`; for each item include evidence, root cause, minimum safe remediation, dependencies, risks, acceptance criteria, rollback boundary, and owner. The report must propose the minimum safe remediation waves and their order. Review and owner acceptance of that report are mandatory gates; until then, do not split, move, rename, delete, or reorganize code. A current defect may not be hidden in a generic defer; `PRESERVE` requires complete long-term evidence and `DEFER` requires an exact owner-approved trigger/package.

### R7 — Structural UI boundaries and compatibility shims

Only structural work is allowed: application-owned view models, query surfaces, import/type migration, and shim removal after zero-consumer proof. Add journey tests for the six smoke-only pages when in accepted scope. No visual or navigation redesign.

### R8 — Bundle, file growth, and guards

Measure entry, lazy-route, PWA-precache, raw, and gzip surfaces. Add guard metadata and positive/negative tests. Prevent within-band file growth and boundary regression. Do not weaken a guard or change a baseline to hide growth.

### R9 — Test, contract, documentation, and rollback evidence

Complete Feature → Module → Contract → Test → Owner mapping; storage parity; Transfer/Legacy/Golden matrix; Guard proves/does-not-prove matrix; direct page evidence; generated-artifact evidence; and an actual rollback rehearsal wherever a durable format is written. Answer Q-a through Q-j with direct evidence.

### R10 — Hostile final audit and closure

An independent reviewer must re-check every finding ID, every principle, every decision, every large-file classification, every public surface, deep import, cycle, runtime channel, shim, registry, capability, adapter parity result, test, guard, generated view, bundle measure, and rollback boundary. No executor may self-certify the final hostile audit.

The program may close only when the final matrix is complete and the exact merge commit is verified on `main`.

---

## 6. Five-role quality model

Use read-only targeted reviewers at R0, wave gates, and R10:

1. boundaries, modules, responsibilities, public doors, large files, ownership;
2. data/domain/storage, financial invariants, adapters, Transfer, Schema/Export/Import, rollback;
3. dependencies, layers, cycles, shims, guards, growth, bundle, runtime channels;
4. tests, CI, security, Operations Control, generated artifacts, provenance;
5. hostile reviewer challenging pilot claims, duplicate truth, unexplained exceptions, false guards, and hidden semantics.

They must not create competing reports or mutate the branch. The primary executor produces one consolidated worklog and one final matrix.

---

## 7. Branch, PR, and merge policy

- The contract and plan are published through a documentation-only PR.
- R0 remains read-only and produces a report through a separate controlled documentation commit/PR boundary after the contract is available on `main`.
- Every implementation wave or coherent slice has an independently reviewable commit boundary and PR evidence.
- Z AI may create/update branches, commits, PRs, focused checks, and CI within the authorized scope.
- Z AI must not merge `main`, delete branches, delete PRs, or perform cleanup.
- The owner reviews the exact Merge Manifest before any merge.
- After merge, verify the exact merge SHA on `main`, run the required checks for that SHA, reconcile Operations Control, and only then mark the Workstream `VERIFIED`.

Merge Manifest fields:

```text
Repository
PR URL and number
Source branch and full SHA
Target branch and full SHA before merge
Merge method
All required checks and exact CI URLs
Changed files and commits
Financial/semantic impact
Schema/export/import/migration impact
Historical-data impact
UI/visual impact
Rollback method
Final finding matrix
```

---

## 8. Protected stop conditions

`STOP` and present one consolidated decision/blocker package if:

- live SHA, branch, PR, worktree, or active claim cannot be reconciled;
- unknown local work could be overwritten;
- a financial formula, classification, rounding, error policy, historical interpretation, or persisted text would change;
- Schema, migration, export/import bytes, snapshot, rejection behavior, or legacy acceptance would change;
- IndexedDB/Memory parity, transaction semantics, idempotency, CAS, or recovery cannot be preserved;
- owner/source of truth/consumer is unknown;
- a shim cannot be proven safe to remove;
- a door requires exports beyond real consumer need;
- bundle/file limits are exceeded without behavior-preserving recovery;
- a new platform, API, Sync, Auth, permission, security, billing, deployment, or external service is required;
- deletion, cleanup, branch deletion, PR closure, or merge is required;
- a required check or CI fails and cannot be repaired within the active card;
- the diff expands beyond the active card;
- a report contradicts the live tree.

The package must state the exact choice, affected files, alternatives, evidence, impact, tests, rollback boundary, and safe stopping point.

---

## 9. Report and continuation contract

At the end of every phase:

- record exact full SHAs;
- state what was performed, reused, not performed, and remains;
- list files and commands with exit codes;
- separate local, PR-CI, and post-merge-main evidence;
- state financial/schema/export/import/history/UI/security/performance impact;
- update the canonical Worklog;
- update Operations Control source JSON and regenerate views;
- update `current-state.md` only with live fields;
- state the rollback boundary.

If interrupted, inspect branch, worktree, commits, PR, report, and last ledger checkpoint. Do not reset, overwrite, reclone over work, or repeat a completed phase.

Allowed statuses:

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

## 10. Final closure status

A complete program must end with:

```text
POST_SCAN_STRUCTURAL_REMEDIATION_R0_R10 — VERIFIED_ON_MAIN
ALL_APPLICABLE_FINDINGS_CLOSED_OR_OWNER_ACCEPTED
NO_UNAPPROVED_FINANCIAL_OR_SEMANTIC_CHANGE
NO_UNAPPROVED_SCHEMA_OR_EXPORT_IMPORT_CHANGE
NO_UNAPPROVED_HISTORICAL_DATA_CHANGE
NO_UNAPPROVED_UI_OR_VISUAL_CHANGE
NO_UNRELATED_CLEANUP_PERFORMED
NO_SECRETS_EXPOSED
```

An incomplete program must end with:

```text
POST_SCAN_STRUCTURAL_REMEDIATION_INCOMPLETE — OWNER_DECISIONS_REQUIRED
EXACT_REMAINING_ITEMS_REPORTED
NO_UNAPPROVED_STRUCTURAL_WRITES
```

Never report completion for R0, a pilot, a green intermediate wave, a recommendation, or a partial implementation.

---

## 11. Immediate continuation instruction — 2026-10-09

R0–R5 are already verified on `main` at `092c933bdcdf1666f8f8cf83bb7d5f030b8d4e6d`; do not repeat them. Start the next continuation by verifying that live SHA, then perform only the mandatory R6 read-only Structure/Architecture/Code Organization Scan and produce the one consolidated findings report. Stop for owner review and acceptance of the classifications, target map, minimum remediation waves, dependencies, risks, acceptance criteria, and rollback boundaries. Do not perform R6 implementation writes before that acceptance. Do not ask for routine approval inside an accepted implementation wave; stop only for the protected conditions above or the applicable merge gate.


## 12. Immediate continuation after R6 — 2026-10-10

R6 W1/W2/W3 is `VERIFIED_ON_MAIN` at `8f7ba482c92b33fd1565df3284b992c6b28a128b` (PR #338 merge `5ff733dd7d12e27136d3d191e117f48bf29fbb8c`; PR #339 merge `6106497b34e0de63ba6f7514725c2811fe3fd0cb`; PR #340 merge `8f7ba482c92b33fd1565df3284b992c6b28a128b`; post-merge CI `37998261599` succeeded). No R7 implementation has started.

The next authorized operation is **R7 preflight and Repair Card reconciliation only**: read the R6 scan/decision package and R6-F17-P01..P11 routing records from `main`, verify live `main`, inspect open claims/PRs, create the R7 scope and consumer inventories, and prepare the R7 execution prompt. Do not perform R7 structural writes in the preflight. Preserve the UI branch, all historical evidence, compatibility shims until zero-consumer proof, Schema/Export/Import 38/30, bundle ceilings 650,000/155,300, and all financial/historical/rejection/UI invariants.

Terminal gate:

```text
R6_VERIFIED_ON_MAIN
R7_PREFLIGHT_READY
R7_IMPLEMENTATION_NOT_STARTED
NO_UNAPPROVED_SEMANTIC_OR_FINANCIAL_CHANGE
NO_UNAPPROVED_SCHEMA_OR_EXPORT_IMPORT_CHANGE
```
