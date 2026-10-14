# Micro R11 — Local Lock Fail-Closed Remediation
## ZAI Controlled Implementation Prompt — 2026-10-15

## 1. Mission

You are the single implementation writer for one narrowly bounded Micro security-remediation wave.

Implement the owner-approved root fix for the local lock contract on a dedicated branch from the live `main`, open or update exactly one implementation PR, run the required tests and CI gates, use five sequential read-only reviewers plus one synthesizer, update the canonical evidence and Operations Control records, and stop at `PR_READY`.

This is **not** a structural refactor, a bulk move, a cleanup task, a redesign, a schema migration, or a W2/W3/W4 task. Do not merge the implementation PR.

The product is still in development with no users and no authoritative production data. Therefore, within the approved boundary, choose the durable, correct, fail-closed solution rather than a superficial workaround. Do not silently change protected financial, historical, Schema/Export/Import, Legacy, Transfer, rejection-precedence, or visual UI semantics.

## 2. Verified baseline and current state

Repository:

```text
https://github.com/Qays7753/Micro
```

Target base:

```text
main
```

Verified live base SHA at the time this contract was prepared:

```text
9303ea445cc4f3ee87d7a4514e3e9d47d608d339
```

The live base includes:

- R10-B verified on `main`.
- R11 S0 + W1A verified on `main`.
- R11 W1b merged by PR #365 at merge commit `df85d5cef4d11df1e0b4dfe826bce9814c8478f8`, with CI and Cloudflare Pages successful on that exact merge SHA.
- R11 W1b post-merge Operations Control reconciliation merged by PR #366 at merge commit `9303ea445cc4f3ee87d7a4514e3e9d47d608d339`, with CI and Cloudflare Pages successful on that exact merge SHA.
- W1b findings `R11-W1B4-NF-001..004` are durable and owner-approved for this separate lock-remediation wave.
- `ARCH-010` Diagnostics Storage is a separate follow-up and is **not** part of this wave.
- W2a/W2b Transfer characterization and behavior changes are separate and are **not** part of this wave.

Before any write, verify the live values yourself. If `main` is not exactly the expected SHA, if the repository has drifted, if an unexpected PR or active workstream overlaps this surface, or if the worktree contains unknown work, stop with `STATE_DRIFT` and report it. Do not reset, discard, reclone over, or hide existing work.

## 3. Owner-approved decisions — exact execution authority

The owner has approved the following decisions:

### `OD-LOCK-ROLLBACK = A`

Fix both device-clock rollback weaknesses fail-closed:

1. A clock earlier than `lastActiveAt` must never keep the protected application open indefinitely.
2. A clock earlier than `lastFailedAt` must never bypass the wrong-PIN backoff window.

When time is inconsistent, prefer protecting the data over silently accepting an unverifiable state. The exact implementation shape may be the smallest sound representation (`locked: true`, an explicit safe-lock result, or an equivalent contract-preserving result), but the observable invariant is mandatory: **clock rollback cannot produce an open or less-protected state**.

### `OD-LOCK-STORAGE = A`

Separate these states honestly:

- successful read with no lock configured;
- successful read with an enabled lock;
- storage read failure / unreadable lock state.

A storage read failure must not be converted into `open`. For protected application content, it must fail closed, keep the protected content inaccessible/inert, and show an honest recoverable error state without changing data. Do not treat an unavailable lock record as proof that no lock exists.

Preserve the existing public recovery-route boundary (`/setup` and `/settings`) only where the existing contract explicitly makes those routes public. Destructive actions inside recovery/settings remain protected by their own gate. Do not create a silent bypass through the route exception.

### `OD-LOCK-SEMANTICS = A`

The verified source-of-truth contract is **real user-input inactivity**:

- while the app is visible, recent real input may keep the session active;
- when the user has not produced real input for `autoLockMinutes`, the protected app must lock;
- passive visibility, an evaluation tick, or the mere fact that the tab remains open must not refresh `lastActiveAt` indefinitely;
- hide/show behavior remains characterized and must remain truthful;
- the lock remains an overlay so loaded form state is not destroyed.

This decision corrects the previously observed contradiction between the formal contract, the SP-03 comment, and the old characterization test. Do not preserve the old “visible forever without input” behavior by merely changing documentation. Implement the contract and update the characterization evidence to prove it.

### Separate approved boundaries

- `OD-DIAGNOSTICS`: implement `ARCH-010` later in a separate PR. Do not touch `localDiagnosticsService.ts` or create a general storage migration here.
- `OD-W2A`: Transfer evidence/characterization later in a separate wave. Do not change Transfer validators, current-pair rejection behavior, Legacy acceptance, goldens, MANIFEST, or rejection precedence here.

## 4. Findings in scope

Implement and close all four findings below with root fixes and evidence:

| ID | Finding | Required disposition |
|---|---|---|
| `R11-W1B4-NF-001` | Device-clock rollback can make elapsed idle time negative and prevent locking indefinitely | `FIX_NOW` — fail-closed clock-rollback handling |
| `R11-W1B4-NF-002` | Device-clock rollback can bypass the wrong-PIN backoff early-rejection window | `FIX_NOW` — fail-closed backoff handling |
| `R11-W1B4-NF-003` | `AppLockGate` opens when the lock service reports a storage read failure | `FIX_NOW` — separate unreadable from no-lock; fail closed |
| `R11-W1B4-NF-004` | SP-03 comment/characterization contradicts the real-input inactivity contract | `FIX_NOW` — make runtime, tests, contract, and evidence agree |

If investigation discovers another issue directly required to make these four invariants true, classify it with a durable ID as `NEW`, `DEEPENS`, `DUPLICATE`, `REOPENED`, or `FALSE_POSITIVE`; fix it in this wave only when it is inside the same lock boundary and does not expand into another subsystem. Otherwise stop at the exact boundary and record an owner decision. Never use a generic `DEFER`.

## 5. Allowed implementation boundary

Create one dedicated branch from the verified live `main`:

```text
security/r11-lock-fail-closed-20261015
```

Open or update exactly one implementation PR targeting `main` with a title equivalent to:

```text
security(r11): make local lock fail closed on rollback and storage uncertainty
```

The allowed production surface is limited to the local-lock service, `AppLockGate`, their focused tests, the governing lock/security contract, and the required Operations Control/evidence records. First inspect exact paths on the live tree; do not assume a path moved.

Likely relevant files include:

```text
apps/prototype-web/client/src/application/security/localLockService.ts
apps/prototype-web/client/src/components/security/AppLockGate.tsx
apps/prototype-web/client/src/application/security/localLockService.test.ts
apps/prototype-web/client/src/application/security/localLockService.idleCharacterization.test.ts
apps/prototype-web/client/src/AppLockGate.idleCharacterization.dom.test.tsx
apps/prototype-web/client/src/Settings.lockGate.dom.test.tsx
docs/contracts/37-local-app-lock-contract.md
docs/quality/security-boundaries.md
docs/operations/current-state.md
docs/operations/current-state-log.md
docs/operations/control/items/<new-or-existing-lock-item>.json
docs/operations/control/workstreams/<new-lock-workstream>.json
```

Use the next available canonical Operations Control IDs; do not collide with an existing item/workstream. A reasonable expected allocation is `ARCH-011` / `WS-219`, but verify availability first and use the actual next available IDs if those are occupied.

### Explicitly forbidden in this wave

- direct writes to `main`;
- merging the implementation PR;
- deleting branches, PRs, evidence, or history;
- force-push;
- changing `localSchemaVersion=38` or `localExportVersion=30`;
- changing export/import wire shape, Legacy acceptance, released pairs, goldens, MANIFEST, or rejection precedence;
- changing financial calculations, money types, snapshots, historical records, or Transfer semantics;
- implementing `ARCH-010` Diagnostics Storage;
- implementing W2a/W2b, W3, W4, W5, or structural refactoring;
- bulk file moves, barrels, layer reorganization, or unrelated helper extraction;
- visual redesign, CSS/layout/navigation/copy redesign, or changing the lock overlay’s visual system;
- weakening a guard, raising a ceiling, deleting tests/comments to make a gate pass, or re-anchoring a baseline without a measured and documented reason;
- hiding a behavior change inside “documentation only” work.

## 6. Mandatory preflight — read-only before first write

1. Read `AGENTS.md`, `docs/operations/current-state.md`, `docs/00-document-index.md`, `docs/operations/control/generated/AGENT-BRIEF.md`, `docs/operations/control/README.md`, the owner decision package, the W1b report, Contract 37, and `docs/quality/security-boundaries.md`.
2. Run `git fetch origin --prune` and verify `origin/main` against the exact live API SHA.
3. Inspect branch, worktree, open PRs, active claims, and the exact diff/history of PR #365 and PR #366.
4. Run `python3 scripts/operations-control/validate.py` before creating or updating a workstream.
5. Build a lock-surface census: all callers of `LocalLockService.status`, `shouldLockNow`, `unlock`, `touchActivity`, `runWhenProtected`, `AppLockGate`, and any storage error/result discriminants. Include tests, recovery routes, worker/Node usage if any, and documentation references.
6. Record a written understanding card before implementation: user/security question, in-scope files, non-goals, protected invariants, failure states, acceptance criteria, and rollback boundary.
7. If any immutable consumer, contract contradiction, or unexpected semantic dependency cannot be mapped safely, stop and report `STATE_DRIFT` or `OWNER_DECISION_REQUIRED` rather than guessing.

## 7. Required implementation behavior

### 7.1 Clock rollback and idle lock

Implement a single, explicit policy for invalid time ordering. It must cover:

- `now < lastActiveAt` in `shouldLockNow`;
- `now < lastFailedAt` in wrong-PIN backoff;
- exact boundary, forward time, backward time, reload/session boundary, and repeated lock/unlock cycles;
- malformed or missing timestamps if the service can receive them.

The policy must fail closed, be deterministic, and not disclose secrets. Keep ID fallback and unrelated ambient-time policy unchanged. Do not introduce broad clock injection outside the lock tests/service boundary.

### 7.2 Storage failure at the application gate

Change the gate state model as needed so it distinguishes at least:

- `checking`;
- `open` only after a successful, trusted evaluation;
- `locked`;
- an honest protected error/unreadable state, which cannot expose the children.

During `checking` and unreadable/error states:

- protected children must not be interactable or focusable;
- the gate must not set `open` from `!status.ok` or `!shouldLock.ok`;
- no destructive or financial action may be triggered;
- no data may be changed;
- the user-facing state must be truthful and recoverable within the existing product language/boundary, without a visual redesign.

Preserve the overlay/no-remount property and preserve public recovery-route semantics exactly where Contract 37 allows them.

### 7.3 Real-input inactivity

Ensure that the visible-app heartbeat cannot perpetually refresh `lastActiveAt` solely because the tab remains open or because `evaluate()` runs. Real input may refresh activity. Passive evaluation must only evaluate. The tests must prove:

- recent pointer/keyboard/touch/wheel input keeps the session active;
- no input beyond `autoLockMinutes` locks the visible app;
- a visibility hide/show sequence remains correct;
- the overlay keeps children mounted and preserves unsaved form state;
- the initial `checking` phase does not expose protected children.

Update the contradictory SP-03 comment and all affected characterization comments so they describe the implemented contract, not the old behavior.

## 8. Test-first and evidence contract

Before implementation, add or update focused failing tests for the four findings. Then implement the smallest correct change and make the tests pass.

At minimum, tests must cover:

1. service-level backward-clock idle lock;
2. service-level backward-clock wrong-PIN backoff, including failed-attempt count and no weaker protection;
3. service-level forward clock, exact threshold, missing timestamp, malformed timestamp if reachable, and repeated cycles;
4. gate-level storage read failure with no child interaction/focus/data action;
5. gate initial `checking` state with children inert/non-interactable;
6. successful no-lock read opening normally;
7. enabled lock and correct/incorrect PIN paths;
8. visible app with recent real input staying active;
9. visible app with no input locking after the configured threshold;
10. hide/show and reload/session behavior;
11. recovery routes remaining within Contract 37 boundaries;
12. negative tests proving a neutered fail-open branch fails;
13. the existing Settings destructive-action gates remaining fail-closed.

Run the focused suites through the repository’s established Vitest runner. The expected direct command is:

```bash
pnpm exec vitest run \
  apps/prototype-web/client/src/application/security/localLockService.test.ts \
  apps/prototype-web/client/src/application/security/localLockService.idleCharacterization.test.ts \
  apps/prototype-web/client/src/AppLockGate.idleCharacterization.dom.test.tsx \
  apps/prototype-web/client/src/Settings.lockGate.dom.test.tsx
```

If the current workspace requires the prototype package runner instead, use the equivalent repository-defined command and report the exact command; do not silently skip a suite.

Preserve the existing PBKDF2 behavior, lock overlay architecture, local-only boundary, and no-secret-in-output rule. Do not weaken test assertions to fit the implementation.

## 9. Wave checkpoints and commits

Use coherent, reviewable commits. A safe minimum shape is:

1. characterization tests and understanding-card/evidence setup;
2. local-lock service fail-closed time policy;
3. AppLockGate storage/checking/error and real-input inactivity behavior;
4. contract, tracker, current-state, evidence, and final report reconciliation.

After each implementation commit:

- run the focused tests relevant to the commit;
- inspect `git diff --check` and the changed-file list;
- verify no protected surface changed unexpectedly;
- record the commit SHA and result in the PR checkpoint comment/report.

Do not proceed past a failing checkpoint by suppressing, skipping, or reclassifying the failure.

## 10. Full verification gate

On the final implementation head, run and record exact exit codes for:

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
python3 scripts/operations-control/generate_tracker.py --check
python3 scripts/operations-control/validate.py
node scripts/check-doc-index-coverage.mjs
node scripts/check-current-state-size.mjs
git diff --check
```

The final build must remain under the protected ceilings:

```text
raw <= 650000
normalized gzip <= 155300
lint warnings <= 37, with the exact baseline preserved unless a separately justified measured change is approved
```

Do not raise, weaken, or lottery these gates. If the final head changes an existing bundle or baseline, record the exact before/after measurement and root cause; stop if an unauthorized re-anchor would be required.

Run the focused lock suites again on the exact final head. If a production browser proof is needed, record URL/build identity/viewport/actions/expected/actual/console/network result and distinguish `VERIFIED`, `UNVERIFIED`, and `NOT_EXECUTED`. Do not claim a physical-device test that was not run.

## 11. Five sequential read-only reviewers

After the single writer completes the implementation, run exactly five sequential read-only reviewers. They must not edit files, commit, push, merge, delete, or rerun workflows. Use one synthesizer after them.

- **RV1 — Security and application architecture:** fail-closed state machine, caller census, no bypass, no layer violation.
- **RV2 — Storage/domain/financial/Transfer integrity:** local-only boundary, no Schema/Export/Import/Legacy/Transfer/financial drift, no data mutation on read failure.
- **RV3 — Runtime/UI/accessibility/time:** checking/error inertness, overlay/no-remount, real-input inactivity, visibility/reload behavior, no visual redesign.
- **RV4 — Tests/CI/security/operability:** adversarial tests, no weakened guards, exact ceilings/baselines, workflow/secret safety, reproducible commands.
- **RV5 — Documentation/contracts/Operations Control:** Contract 37, security boundaries, current-state, W1b finding closure, item/workstream/status transitions, evidence completeness, next-wave boundaries.

The synthesizer must reconcile disagreements explicitly and must not average them away. Any unresolved blocker remains a blocker.

## 12. Records that must be updated

Update sources before generated views:

- canonical owner-decision addendum with the exact approved `OD-LOCK-ROLLBACK`, `OD-LOCK-STORAGE`, and `OD-LOCK-SEMANTICS` decisions;
- durable records for `R11-W1B4-NF-001..004`, including evidence, root cause, classification, tests, acceptance, and rollback;
- one lock-remediation Workstream and one Item with the actual IDs selected after collision check;
- `docs/operations/current-state.md` with the live next action and explicit exclusions;
- `docs/operations/current-state-log.md` append-only entry;
- `docs/architecture/refactoring/AGENT-SEQUENTIAL-WORKLOG.md` append-only entry;
- canonical lock/security contract and evidence artifacts;
- generated Operations Control views only through `generate_tracker.py`.

Do not rewrite or erase historical W1b entries. Preserve prior characterization results as historical evidence and append the remediation result.

## 13. PR and credential rules

Use the secure GitHub credential field only, by its configured name. Never print, paste, store, commit, or report any token, token prefix, cookie, authorization header, or private secret value.

Credential boundary: `GITHUB_ACCESS_TOKEN=<SECURE_SECRET_FIELD_ONLY>`; never place the real value in this prompt, chat, command arguments, files, commits, PR comments, or reports.

The implementation PR must contain:

- exact scope and non-goals;
- commit list and full SHAs;
- focused and full test commands/results;
- CI and Cloudflare check URLs for the exact final head;
- five reviewer verdicts and synthesizer reconciliation;
- files changed and files intentionally untouched;
- Schema/Export/Import/financial/historical/Transfer impact statement;
- browser evidence and limitations;
- exact rollback boundary;
- final Merge Manifest marked `NOT_EXECUTED` because this prompt forbids merge.

Do not merge, close, delete, or clean up anything. Leave the implementation PR open for owner review.

## 14. Stop conditions

Stop immediately and report a blocker if:

- `main` or the worktree differs from the verified baseline unexpectedly;
- a required change touches an out-of-scope protected surface;
- the formal contract and code cannot be reconciled without a new owner decision;
- storage failure still has any fail-open path;
- the visible app can remain open forever without real input;
- a test, guard, typecheck, lint, format, build, bundle budget, Operations Control validator, or CI check fails;
- Cloudflare cannot prove the exact final commit when proof is required;
- a token or permission is missing; never request or echo the secret in chat;
- a reviewer finds an unresolved security, data, financial, semantic, or evidence blocker.

## 15. Final report contract

Produce one canonical report at a path under:

```text
docs/architecture/refactoring/r11-lock-fail-closed-20261015/
```

The report must contain:

1. executive summary;
2. verified baseline and exact final head;
3. owner decisions and how each was implemented;
4. findings matrix for NF-001..004 and any new IDs;
5. files and commits changed;
6. test/guard/CI/Cloudflare table with exact commands, SHAs, URLs, exit codes, and evidence class;
7. browser/runtime evidence and limitations;
8. protected-surface impact matrix;
9. five reviewer verdicts and synthesizer reconciliation;
10. acceptance criteria and rollback boundary;
11. unresolved items: ARCH-010 and W2a must remain explicitly separate;
12. final Merge Manifest marked `NOT_EXECUTED`;
13. exact next owner action.

Every material statement must distinguish `VERIFIED`, `INFERRED`, `UNVERIFIED`, `NOT_EXECUTED`, `DEFERRED`, and `BLOCKER`.

End the report and final PR checkpoint with exactly one of these outcomes:

```text
R11_LOCK_REMEDIATION_COMPLETE — PR_READY
```

or:

```text
R11_LOCK_REMEDIATION_BLOCKED — <precise reason>
```

Also include, when applicable:

```text
NO_MERGE_PERFORMED
NO_CLEANUP_PERFORMED
NO_SECRETS_EXPOSED
ARCH-010_NOT_EXECUTED — SEPARATE_SCOPE
W2A_NOT_STARTED — OWNER_GATE_REQUIRED
```

Do not stop for routine questions. Continue through implementation, focused tests, full gates, five sequential read-only reviews, records reconciliation, push, and PR checkpoint. Stop only for a real state drift, permission failure, protected-surface conflict, failed gate, or missing owner decision.
