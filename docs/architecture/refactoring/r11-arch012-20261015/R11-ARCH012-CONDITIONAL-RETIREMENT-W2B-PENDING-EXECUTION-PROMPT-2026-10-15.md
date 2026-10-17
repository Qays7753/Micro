# Micro R11 — ARCH-012 Conditional Retirement / Legacy Draft Storage Boundary

## Mission

You are the ZAI repository executor for Micro. Execute one controlled follow-up wave for `ARCH-012`, the confirmed legacy form-draft storage finding discovered by the complete ARCH-010 web-storage census.

The owner has authorized this precise policy:

1. Investigate the repository and the real product reachability first.
2. If the legacy migration path is no longer required for the product and can be retired safely, perform the radical removal of that legacy migration component.
3. If the investigation proves that legacy compatibility is still required by an active contract or supported input, do not delete it; move it behind an explicit storage boundary and remove direct browser-storage knowledge from pages/application callers.
4. In either case, preserve the current draft system and all current storage behavior.
5. Keep W2B pending. Do not invent or implement the W2B exact error code or Arabic payload in this wave.
6. Keep W5 closed by policy. Do not reopen MoneyMinor branding unless a new, independently proven trigger exists.

This is a conditional remediation contract, not permission to delete blindly.

## Repository and live-state requirements

Repository: `https://github.com/Qays7753/Micro`

Credential boundary: `GITHUB_ACCESS_TOKEN=<SECURE_SECRET_FIELD_ONLY>`. Use the secure credential field only for the minimum required repository/PR operations. Never request, print, paste, store, or echo the token; report only permission status or redacted HTTP status. Read-only preflight is mandatory. If the repository, branch, PR, SHA, or target state differs from the verified baseline, stop. Do not perform adjacent writes.

Before any write, verify live state using the secure GitHub credential only:

- fetch `origin --prune`;
- inspect `main`, all open PRs, and the current PR #368;
- inspect the current worktree, branch, uncommitted files, and recent commits;
- read `AGENTS.md`, the current-state contract, the ARCH-012 record, the ARCH-010 report, the R11 unified report, the owner decision package, and the current PR description/comments;
- do not trust any SHA in this prompt without live verification.

Current known checkpoint (must be reverified, not assumed):

- Repository: `Qays7753/Micro`.
- PR #368 is the R11 continuation PR on branch `security/r11-lock-fail-closed-20261015`.
- Its latest documented state is `OPEN / MERGEABLE / CLEAN`, with the R11 implementation and records complete, and W2B still owner-gated.
- ARCH-012 is recorded in `docs/operations/control/items/ARCH-012.json` as `BACKLOG` and `OWNER_DECISION_REQUIRED`.
- The relevant legacy implementation is expected at:
  `apps/prototype-web/client/src/application/drafts/legacyFormDraftMigration.ts`.
- The legacy keys are expected to include:
  `micro.finance-draft.<type>.v1` and `micro.setup-draft.v1`.
- The current draft system (`FormDraftService`, current local storage path, IndexedDB/Memory parity, and current draft behavior) is protected and must remain.

## Execution boundary

### Allowed

- Read-only repository investigation and reachability analysis.
- A dedicated ARCH-012 implementation branch and PR only after the correct base is available.
- Changes strictly required for one of the two outcomes below:
  - **RETIRE:** remove the obsolete legacy migration component and its now-dead callers/exports/tests/docs/guard exception; or
  - **BOUNDARY_REMEDIATE:** preserve the required migration behavior but move browser storage behind an explicit storage adapter/boundary and make pages call an application-level service rather than a browser-storage accessor.
- Tests, guards, Operations Control records, evidence, current-state append-only records, worklog append-only entry, and document-index updates directly required by this wave.

### Forbidden

- Do not modify `main` directly.
- Do not merge any PR.
- Do not delete branches or perform repository cleanup.
- Do not force-push.
- Do not add ARCH-012 production code into PR #368 unless the owner explicitly changes the integration boundary in a later instruction. Prefer a dedicated ARCH-012 branch/PR from the verified post-#368 `origin/main`.
- If PR #368 is still open and the required post-merge base is not available, perform the read-only investigation and prepare evidence only; stop with `WAITING_FOR_POST_R11_BASE — NO_ARCH012_CODE_WRITTEN` rather than mixing this wave into PR #368.
- Do not touch W2B behavior, exact error codes, Arabic error copy, rejection precedence, Current/Legacy/Golden import compatibility, Schema 38, or Export 30.
- Do not touch W5 MoneyMinor representation, branding, financial semantics, or its policy closure.
- Do not delete `FormDraftService`, current drafts, IndexedDB, MemoryLocalStore, current export/import, financial data, or any current storage adapter.
- Do not automatically clear users' browser `localStorage` at runtime. Removing obsolete code is not permission to run a destructive storage wipe.
- Do not change visual UI, CSS, tokens, layout, navigation, Arabic copy, RTL behavior, or accessibility semantics except if a direct caller removal is mechanically necessary and behavior remains equivalent.
- Do not make unrelated structural moves, mass file moves, barrels, blanket allowlists, ceiling changes, baseline weakening, or generic defers.
- Never print, paste, store, or commit any token or credential.

## Protected project principles

- The application has no users and no authoritative production data, so radical root fixes are preferred when they are proven safe and within this exact scope.
- “No users” is not evidence by itself that a compatibility contract is unused. Prove reachability, contracts, fixtures, routes, tests, docs, and supported import/export paths before deleting.
- Every new finding must receive a durable ID, classification, evidence, root cause, disposition, acceptance criteria, and rollback boundary.
- Use `FIX_NOW`, `PRESERVE`, `DEFER`, or `OUT_OF_SCOPE` only with a specific reason. Never use generic `DEFER`.
- Historical/legacy behavior may be retired only through an explicit owner decision and evidence-backed compatibility analysis.
- Financial, historical, Schema, Export/Import, security, and UI semantics must not be changed silently.

## Exact ARCH-012 investigation

Before writing code, perform a complete census of the legacy draft path:

1. Locate every definition, export, import, caller, test, fixture, documentation reference, guard exception, and key prefix related to:
   - `legacyFormDraftMigration`;
   - `browserLegacyFormDraftStorage`;
   - `clearLegacyFormDraftStorage`;
   - `legacyFinanceDraftKey`;
   - `LEGACY_SETUP_DRAFT_KEY`;
   - `migrateLegacyFormDraft`;
   - `micro.finance-draft.`;
   - `micro.setup-draft.v1`.
2. Trace all callers from `Setup.tsx`, `FinancialEventEditor.tsx`, `Settings.tsx`, and any other page or service.
3. Determine whether the migration path is reachable from the current product routes and whether any current workflow still creates or depends on the legacy keys.
4. Inspect `FormDraftService` and the current draft persistence path. Prove what must remain after removal.
5. Inspect current export/import and transfer contracts to prove whether legacy draft keys are part of a supported file format. Do not change those contracts.
6. Inspect tests and documentation that characterize Group 5 legacy draft migration. Distinguish historical characterization from an active compatibility requirement.
7. Inspect `docs/quality/persistent-entity-touchpoints.json`, `docs/quality/security-boundaries.md`, `scripts/check-diagnostics-storage.mjs`, and the ARCH-010 evidence.
8. Check whether the legacy keys are used by any test harness, demo route, fixture, migration script, or release path that would become silently broken.
9. Produce a decision table with one row per consumer:
   `path | role | runtime reachability | active contract? | current replacement | deletion risk | disposition`.
10. Do not infer “unused” from a single `rg` result. Use the graph of exports, imports, routes, tests, and contracts.

## Conditional decision gate

After the investigation, choose exactly one disposition and explain it with evidence.

### Outcome A — `ARCH012_RETIRE_LEGACY_DRAFT_MIGRATION`

Choose this only if all of the following are true:

- no active product route requires reading the legacy keys;
- no supported current export/import contract depends on them;
- no maintained fixture or golden requires the migration;
- current `FormDraftService` and current draft behavior fully cover the supported workflow;
- deletion will not alter financial records, current drafts, Schema 38, Export 30, or current storage behavior;
- the owner-approved development-stage policy is recorded as the reason to retire historical draft compatibility before launch.

If these conditions are proven, remove the obsolete path completely and coherently:

- delete the legacy migration implementation or remove all obsolete portions;
- remove its exports from the drafts barrel and application-door contracts;
- remove direct callers from pages and replace them with no-op/current-flow behavior only where needed;
- remove obsolete legacy-key helpers and clear functions;
- remove obsolete tests and rewrite retained tests so they prove the current draft path, not the deleted path;
- remove the ARCH-012 legacy exception from the storage guard in the same PR;
- update Group 5 documentation and canonical evidence to say legacy draft compatibility was intentionally retired before launch;
- keep current `FormDraftService` and current draft clearing behavior intact;
- do not add a runtime `localStorage.clear()` or delete arbitrary browser keys.

Add negative tests/guards proving that new direct browser-storage access cannot reappear outside approved storage adapters.

### Outcome B — `ARCH012_BOUNDARY_REMEDIATED`

Choose this if any supported compatibility or active contract requires the migration.

The minimum safe remediation is:

- move the browser-storage adapter out of `application/drafts/` into an explicit, narrowly named storage boundary following the repository’s existing adapter pattern;
- keep the migration policy `write → verify → remove` and all failure-safe behavior;
- make pages call an application-level migration service, not `browserLegacyFormDraftStorage()` directly;
- preserve current draft behavior and all legacy-key semantics required by the contract;
- add adapter, migration, failure, retry, corruption, size, and idempotency tests;
- remove the old application-layer direct-storage exception and replace it with a precise boundary rule;
- update evidence and Operations Control with the exact boundary and remaining compatibility rationale.

Do not use Outcome B merely because deletion is inconvenient. Use it only when the investigation proves a real supported compatibility requirement.

## Implementation waves and commits

Use one dedicated ARCH-012 branch and one PR, based on the verified post-R11 `origin/main`. Keep commits coherent:

1. `arch012: record legacy draft census and decision` — evidence and decision record only if needed before code.
2. `arch012: retire legacy draft migration` **or** `arch012: move legacy draft adapter behind storage boundary` — the minimal implementation.
3. `arch012: add guards and regression evidence` — tests/guards required for future prevention.
4. `docs(arch012): reconcile records` — current-state, append-only log/worklog, Operations Control source JSON first, generated views second, report and index.

Do not create empty commits. Run the relevant test cycle after each implementation commit. If the decision changes during investigation, stop before code, record the reason, and use the correct outcome.

## Required verification

At minimum, run and record commands appropriate to the actual changed files, including:

- `git diff --check`;
- the complete legacy-draft test suite and all directly affected page tests;
- current `FormDraftService` tests and current draft reset/clear tests;
- diagnostics/storage-boundary guard and adversarial negative tests;
- `pnpm check` on the final implementation head;
- Operations Control generation/check/validation using JSON source first;
- `node scripts/check-doc-index-coverage.mjs`;
- `node scripts/check-current-state-size.mjs`;
- relevant typecheck, lint, format, text-density, design, security, and prototype build checks;
- a source census proving no obsolete legacy migration caller remains for Outcome A, or no unauthorized direct browser-storage caller remains for Outcome B;
- current/legacy/golden compatibility checks proving W2B was not changed;
- Schema 38 and Export 30 byte/semantic preservation checks;
- a negative guard test proving a future direct `globalThis.localStorage` access is rejected unless explicitly registered in an approved storage boundary.

If a full command is unavailable because dependencies or provider access are missing, report `UNVERIFIED` with the exact command and reason. Never call it passed.

## Five sequential read-only reviewers

After implementation, use five sequential read-only reviewers, then one synthesizer. They must not edit, commit, push, merge, or rerun workflows:

1. architecture and module/storage boundary reviewer;
2. current-draft, legacy-compatibility, domain, and data-integrity reviewer;
3. runtime/page behavior and accessibility reviewer;
4. tests, guards, CI, security, and operability reviewer;
5. documentation, Operations Control, contract, and owner-decision reviewer.

The synthesizer must reconcile disagreements and classify every issue as `FIX_NOW`, `PRESERVE`, `DEFER_WITH_TRIGGER`, or `OUT_OF_SCOPE` with evidence. Any reviewer blocker must be fixed before PR readiness or recorded as a precise owner decision; no generic defer.

## Required evidence and report

Create or update one canonical report under the ARCH-012 evidence directory. It must contain:

1. live baseline and exact final SHA;
2. full census and consumer table;
3. deletion-vs-boundary decision and proof;
4. files changed and files deliberately preserved;
5. current draft and storage compatibility proof;
6. tests and commands with exact exit statuses;
7. guard/negative-test evidence;
8. Schema 38 / Export 30 / W2B non-interference proof;
9. five reviewer records and synthesizer result;
10. findings registry and Operations Control references;
11. rollback boundary;
12. unresolved items, exact triggers, and owner decisions;
13. final PR readiness statement.

The report must distinguish `VERIFIED`, `INFERRED`, `UNVERIFIED`, `NOT_EXECUTED`, `OWNER_DECISION_REQUIRED`, and `BLOCKER`.

## Continuation and interruption rule

If the previous session or agent stopped unexpectedly:

1. inspect whether work actually completed;
2. inspect current branch, worktree, commits, PR, report, and check runs;
3. do not redo completed waves;
4. state explicitly whether the interrupted work was completed and provide a detailed summary of all actions and modifications;
5. resume only from the last verified checkpoint.

## Final status rules

For a successful deletion path:

```text
ARCH012_RETIREMENT_COMPLETE — PR_READY
LEGACY_DRAFT_MIGRATION_REMOVED
CURRENT_DRAFT_STORAGE_PRESERVED
W2B_REMAINS_PENDING — NO_BEHAVIOR_CHANGE
W5_CLOSED_BY_POLICY — NO_TRIGGER_PROVEN
NO_MERGE_PERFORMED
NO_CLEANUP_PERFORMED
NO_SECRETS_EXPOSED
```

For a successful boundary-remediation path:

```text
ARCH012_BOUNDARY_REMEDIATED — PR_READY
CURRENT_DRAFT_STORAGE_PRESERVED
W2B_REMAINS_PENDING — NO_BEHAVIOR_CHANGE
W5_CLOSED_BY_POLICY — NO_TRIGGER_PROVEN
NO_MERGE_PERFORMED
NO_CLEANUP_PERFORMED
NO_SECRETS_EXPOSED
```

If PR #368 has not yet been merged and the correct independent base is unavailable:

```text
WAITING_FOR_POST_R11_BASE — NO_ARCH012_CODE_WRITTEN
```

Do not claim completion merely because tests are green. Return the exact PR URL, branch, full SHA, changed-file list, decision outcome, evidence paths, checks, limitations, and the final status marker.
