# Micro R11 — W1b Controlled Execution Prompt

## One-phase execution contract for ZAI

**Repository:** `https://github.com/Qays7753/Micro`

**Target branch:** create and use exactly `refactoring/r11-w1b-20261014` from the live `main` head.

**Target PR:** open exactly one PR for the W1b execution branch. Keep it open for owner review. Do not merge it.

**Canonical owner package and crosswalk:**

`docs/architecture/refactoring/r11-s0-w1a-20261013/R11-OWNER-DECISION-PACKAGE-2026-10-13.md`

**Canonical Wave 0 report:**

`docs/architecture/refactoring/r11-wave0-20261013/R11-W0-STRUCTURE-ARCHITECTURE-CONTRACT-SCAN-REPORT-2026-10-13.md`

**Canonical completed S0/W1A report:**

`docs/architecture/refactoring/r11-s0-w1a-20261013/R11-S0-W1A-EXECUTION-REPORT-2026-10-13.md`

**Current baseline hint:** `main` was verified at `0ede6e941a7ec276baf1594febb34e2d4ebf14ee` when this contract was published. Verify the live value before doing anything; never trust this hint if GitHub has advanced.

---

## 1. Mission

Execute **R11 W1b only** as a controlled, evidence-first remediation phase after the completed and merged R11 Wave 0, S0, and W1A work.

W1b is a bounded phase for:

1. the canonical `R11-W0-NF-001` record-quality addendum;
2. the approved `S-1` `PeriodRange` caller census and type-only rename;
3. the approved `S-2` opaque `PreparedImport` provenance contract;
4. the approved application-layer ambient-time policy guard and evidence;
5. the approved secrets-guard limitation documentation and recurring workflow;
6. the approved preservation/evidence work for `P-01` through `P-04`;
7. the approved direct characterization evidence for the P-03 protected policy surface;
8. the approved lock-idle characterization-only slice, with no behavior fix;
9. durable reports, tracker entries, exact-head evidence, and reviewable rollback boundaries.

The objective is a **root-correct, maintainable, test-protected result**, not a superficial wording change. Micro has no production users or authoritative user data yet, so do the correct long-term repair where the approved boundary permits it. Do not use that fact as permission to alter protected financial, historical, schema, export/import, rejection, security, or UI semantics without a separate explicit gate.

---

## 2. Mandatory operating model

- **One writer:** only the primary ZAI executor writes repository changes.
- **Five sequential read-only reviewers:** use five specialists, one at a time, after the implementation slices are complete and before the final readiness claim:
  1. architecture/module boundaries and structural safety;
  2. domain, finance, storage, Transfer, parity, and preserved contracts;
  3. runtime, UI, accessibility, time, and performance boundaries;
  4. tests, CI, security, workflow permissions, and operability;
  5. documentation, tracker, source-of-truth, contract, and owner-decision consistency.
- Reviewers MUST be read-only. They may produce findings and recommendations but MUST NOT edit, commit, push, merge, delete, or rewrite history.
- A synthesizer MUST reconcile all reviewer results. Disagreement must be recorded, not averaged away.
- If any reviewer finds a real issue, assign a durable ID and classify it as `FIX_NOW`, `PRESERVE`, `OWNER_DECISION_REQUIRED`, `DEFER_WITH_EXACT_TRIGGER`, `OUT_OF_SCOPE`, or `DISPROVED`. Never use generic `DEFER`.
- Any issue in W1b scope must be fixed in W1b or the phase stops with an exact owner decision and evidence. Do not silently carry an open defect to W2.

---

## 3. Live-state preflight — mandatory before any write

Inspect the live repository, not this prompt alone:

1. Verify repository, authenticated GitHub identity, current `main` SHA, open PRs, branch names, and whether another W1b branch already exists.
2. Verify that PRs #358 and #360 are merged and that `main` contains the owner package, its crosswalk, the Wave 0 report, and the final S0/W1A records.
3. Verify the worktree is clean before creating `refactoring/r11-w1b-20261014`.
4. Read `AGENTS.md`, `CONTRIBUTING.md`, the owner package, the Wave 0 report, the S0/W1A report, and the current-state documents required by those files.
5. Confirm that the existing S0/W1A implementation is already on `main`; do not redo S0 or W1A.
6. Record a baseline manifest containing repository, branch, exact base SHA, Node/pnpm versions, relevant guard baselines, package-lock state, and the pre-change file list.
7. If the live state differs materially, local work is uncommitted, a branch is already in use, or a required canonical document is absent, STOP and report the exact drift. Do not reset, delete, overwrite, or force-push.

Required preflight marker in the report:

```text
R11_W1B_PREFLIGHT_COMPLETE — BASELINE_RECORDED
```

---

## 4. Scope and non-goals

### 4.1 In scope

- `R11-W0-NF-001` method-recorded evidence addendum and canonical R11 tracking.
- `D-06 / NF-004 / S-1`: `PeriodRange` caller census and type-only rename, only after exact-name validation.
- `D-10 / NF-012 / S-2`: opaque/type-level `PreparedImport` provenance contract.
- `D-12 / NF-014 / OD-TIME`: application ambient-time AST/effect-class policy guard, after the existing D-03 helper is verified.
- `D-16 / NF-025 / OD-SEC`: known-limit documentation and a separate least-privilege recurring history-scan workflow, without weakening the existing nine-pattern scanner.
- `P-01` IndexedDB adapter evidence, `P-02` Memory adapter evidence, `P-03` direct characterization/mutation evidence, and `P-04` storage types/method/schema evidence.
- Lock-idle characterization only: forward/backward time, suspend/resume, expiry, lock/unlock, and real-device or equivalent browser evidence where available.
- Source JSON updates first for Operations Control, followed by generated views and all required document/index/state records.

### 4.2 Explicitly out of scope

- No direct writes to `main`.
- No merge of the W1b PR.
- No branch deletion, cleanup, force-push, history rewrite, or unrelated formatting sweep.
- No structural refactoring, bulk file moves, mass renames, barrel creation, or module reorganization. The post-Group-6 structural gate is satisfied by the accepted Wave 0 scan; this phase executes only the approved narrow contracts and guards.
- No W2 Transfer behavior change. Do not implement unknown-key rejection, modify rejection precedence, regenerate goldens, alter Legacy acceptance, or change `Schema 38` / `Export 30`.
- No W3 label migration, application-house policy changes, D-07 redo, door changes, or internal graph rewrite.
- No W4 accessibility implementation or visual/UI redesign.
- No W5 `MoneyMinor` branding. W5 remains closed and trigger-gated.
- No runtime behavior change to lock-idle. A fail-open characterization result becomes a new finding and stops the phase.
- No movement of diagnostics into the financial/local storage port. Diagnostics remain non-financial and local unless a separate owner decision explicitly authorizes a different product contract.
- No change to financial invariants, money rounding, persisted money text, historical records, import/export wire semantics, rejection precedence, security pattern precision, Arabic copy, routes, navigation, layout, CSS, tokens, or visual design.

---

## 5. Protected invariants

The following must remain byte/behavior-equivalent unless a separate owner decision is explicitly opened and approved:

- `localSchemaVersion = 38`.
- `localExportVersion = 30`.
- The 130-method `PrototypeLocalStore` surface.
- IndexedDB/Memory parity and transaction/atomicity behavior.
- Legacy import acceptance and released-pair compatibility.
- Goldens and their MANIFEST, except no regeneration is permitted in W1b.
- Transfer rejection precedence and current validation ordering.
- MoneyMinor integer discipline, sole persisted formatter, frozen writer surface, and zero production money `parseFloat`.
- S0 secret-pattern precision and first-match/redaction behavior.
- Existing W1A guard baselines and negative fixtures.
- PWA/build identity and bundle ceilings.
- UI semantics, copy, routes, layout, and accessibility behavior outside the lock-idle characterization evidence.

Any observed change to a protected invariant is an immediate STOP, not a test update.

---

## 6. Implementation slices and gates

Use separate coherent commits and preferably separate PRs inside the W1b branch when a slice has an independent rollback boundary. Do not hide unrelated changes in one commit. Every slice must pass its focused tests before the next slice begins.

### Slice W1b-0 — NF-001 evidence and tracker closure

1. Locate the canonical R11 findings/evidence source; do not create a competing tracker.
2. Record `R11-W0-NF-001` as a documentation/record-quality gap, not a production-code defect.
3. Preserve the historical R10-B matrix unchanged. Add an append-only evidence artifact containing:
   - the two historical quantities;
   - the reproducible Wave 0 quantities;
   - exact method/command or script;
   - scope and exclusions;
   - tool and runtime versions;
   - base and live SHAs;
   - date;
   - raw-output or sanitized-output hash where appropriate;
   - reviewer and reconciliation result;
   - explicit statement that qualitative findings remain valid.
4. Update only canonical JSON sources first if Operations Control records this item. Regenerate official Markdown/CSV/XLSX views; never hand-edit generated views.
5. Update the owner package only append-only if a live status correction is required. Do not rewrite history.

**Acceptance:** a future reviewer can reproduce the counts and understand the variance without relying on this conversation.

### Slice W1b-1 — S-1 `PeriodRange` exact-name gate

1. Census all declarations, imports, type references, runtime references, tests, comments, and documentation references.
2. Prove which symbol is finance/date-owned and which is page-local. Do not decide from filename or a two-line grep alone.
3. If the exact approved page-local replacement is confirmed, perform a type-only rename to the selected name, currently proposed as `FinanceActivityPeriodKey` only as a hypothesis.
4. Update all consumers, tests, comments, index/evidence references, and no unrelated symbols.
5. Prove there is no wire-format, runtime, financial, or UI-copy change.

**Acceptance:** zero ambiguous declarations under the old collision; typecheck and focused tests pass; the census and exact chosen name are recorded.

**STOP:** if the census shows the preliminary name is wrong, the meaning is not separable, or a runtime/wire semantic would change.

### Slice W1b-2 — S-2 `PreparedImport` provenance contract

1. Census every `prepareImport` and `confirmImport` caller, test, export, and type path.
2. Introduce an opaque/phantom provenance type minted only by `prepareImport` and accepted by `confirmImport`.
3. Preserve the existing single-validation runtime contract and backup-first behavior. Do not add a second runtime validation pass in W1b.
4. Add a type-level negative test proving an unvalidated ordinary object cannot be passed to `confirmImport`.
5. Prove the only minting path is the intended `prepareImport` path, with no unsafe public cast or broad escape hatch.

**Acceptance:** the current caller compiles and passes unchanged behavior tests; a future bypass fails typecheck; Schema 38, Export 30, Legacy, goldens, and rejection precedence remain unchanged.

### Slice W1b-3 — OD-TIME application ambient-time policy

1. Verify the existing D-03 AST helper and its test contract before extending it.
2. Re-census the application layer and classify every ambient-time site. The expected family is the 21 ID-fallback sites using `crypto.randomUUID ?? Date.now()`; do not assume the count without live evidence.
3. Design an AST/effect-class guard that distinguishes the approved ID fallback family from real clock reads, parsing, lock-idle, and unrelated text.
4. Add explicit allowlist entries only when each site is proven to be the approved ID fallback family. Bind exemptions structurally to syntax and surrounding semantics, not comments or string proximity.
5. Add adversarial negatives for comments, strings, `||`, wrong receiver, wrong fallback, renamed variables, and out-of-family clock reads.
6. Keep lock-idle behavior outside the guard change and outside any clock-injection refactor.

**Acceptance:** the guard passes the exact baseline, rejects each adversarial negative, and documents the boundary. No production behavior changes.

**STOP:** if a site is a true clock read, lock-idle source, or semantically ambiguous. Record a new finding and do not hide it in the allowlist.

### Slice W1b-4 — Lock-idle characterization only

1. Identify the lock-idle clock source and its existing AppLockGate contract.
2. Build a deterministic characterization matrix for forward time, backward time, suspend/resume, expiry, reactivation, lock, unlock, and repeated events.
3. Run the matrix with fake clock/time controls and, where available, a browser/device proof for the real timer path.
4. Record whether behavior is fail-closed, fail-open, or indeterminate under each condition.
5. Do not change runtime behavior in this slice.

**Acceptance:** evidence is complete and the existing behavior is honestly classified.

**STOP:** any fail-open or indeterminate security result creates a durable new finding and owner decision; do not patch it silently.

### Slice W1b-5 — OD-SEC documentation and recurring history workflow

1. Document in the guard header and the appropriate security documentation that the routine scanner is working-tree-only and does not prove absence from Git history/packfiles.
2. Preserve all nine high-precision pattern families, first-match behavior, redaction, and output sanitization.
3. Add a separate recurring/manual history-scan workflow only if the repository's existing workflow conventions support it without broad permissions. Use least privilege, pinned action references consistent with the repository, no write token, no secret printing, and fingerprint-only or count-only output.
4. Add adversarial self-tests for aliases, raw tree paths, deleted files, unusual commit-message bytes, and redaction. Do not include secret material in fixtures or reports.
5. Define explicit notification semantics and failure behavior; a scan failure must not appear as success.
6. Keep the S0 one-time scan evidence intact and reference it; do not rerun it merely to create a new claim unless the workflow proof requires a controlled dry run.

**Acceptance:** the limit is documented; workflow permissions are reviewable; output cannot expose secrets; a deliberate fixture proves detection and redaction; CI syntax and security checks pass.

### Slice W1b-6 — P-01..P-04 preservation evidence

Produce evidence, not decomposition:

- **P-01 IndexedDbLocalStore:** parity, transaction/atomicity, error behavior, and 130-method conformance evidence.
- **P-02 MemoryLocalStore:** parity with IndexedDB for the same selected contract vectors and explicit limitations of in-memory behavior.
- **P-03 craft-order policy surface:** direct characterization and mutation evidence for the highest-risk policy clusters, without moving or rewriting policy logic, messages, rounding, or invariants.
- **P-04 `storage/local/types.ts`:** method count, schema/export constants, record/type ownership, and compatibility evidence without splitting or moving the file.

Use existing suites and add only focused tests required to close the stated evidence gap. Do not convert evidence work into a structural split.

**Acceptance:** each protected surface has an evidence row with source, contract, test anchor, owner, preserved behavior, and rollback boundary; all selected tests pass; no Preserve trigger is invented.

---

## 7. New-finding and stop policy

For every newly discovered issue:

1. assign a durable ID immediately;
2. classify it precisely;
3. identify affected files/symbols and root cause;
4. determine whether it is in W1b scope;
5. fix it now if in scope and safe;
6. otherwise record an exact owner decision, trigger, evidence requirement, and rollback boundary;
7. never use a generic DEFER and never claim closure from documentation alone when enforcement is required.

Mandatory STOP conditions:

- live baseline or branch drift that cannot be reconciled;
- missing owner package, crosswalk, or canonical report;
- uncommitted or unrelated work that would be overwritten;
- any change to Schema 38, Export 30, Legacy, goldens, rejection precedence, financial semantics, or UI semantics;
- any new runtime/security behavior change not explicitly authorized;
- a test or guard failure that is hidden by changing a ceiling, baseline, tolerance, allowlist, or assertion;
- inability to prove exact-head evidence;
- secret exposure or credential leakage;
- a reviewer disagreement that the synthesizer cannot resolve from repository evidence.

---

## 8. Documentation and Operations Control contract

- Read and obey the repository's source-of-truth rules.
- Update JSON source records first. Then run the canonical generator and validation commands.
- Never hand-edit generated tracker Markdown, CSV, or XLSX metadata.
- Keep `docs/operations/current-state.md` concise and live; append history only to `current-state-log.md`.
- Append to `docs/architecture/refactoring/AGENT-SEQUENTIAL-WORKLOG.md`; do not rewrite prior entries.
- Add or update the document-index row for every new authoritative prompt, report, evidence artifact, and workflow record.
- Every evidence document must state exact commit SHA, commands, environment, result, limitations, and whether the result is `VERIFIED`, `UNVERIFIED`, `NOT_EXECUTED`, or `BLOCKED`.
- Do not update a historical report to pretend that W1b was part of S0/W1A. Add dated appendices or a new W1b report.

---

## 9. Verification contract

After each slice, run the focused tests and `git diff --check`. Before final PR readiness, run the complete required checks for the exact final head, including as applicable:

```bash
pnpm check
python3 scripts/operations-control/generate_tracker.py --check
python3 scripts/operations-control/validate.py
node scripts/check-doc-index-coverage.mjs
node scripts/check-current-state-size.mjs
git diff --check
```

Also run:

- S-1 caller census and typecheck;
- S-2 type-level negative test and import/confirm caller tests;
- OD-TIME AST guard unit tests and adversarial negatives;
- lock-idle characterization matrix;
- secret workflow parser/self-tests and sanitized positive/negative fixtures;
- diagnostics web-storage census and dedicated guard tests;
- P-01/P-02 parity and atomicity tests;
- P-03 direct characterization/mutation tests;
- P-04 method/schema/export evidence tests;
- any prototype/app test command required by `AGENTS.md` and `package.json`.

If a command is unavailable, report the exact command, environment, and limitation. Do not substitute a weaker command and call it equivalent.

For every new commit, record the commit SHA and the checks run at that SHA. Do not rerun unchanged green checks gratuitously, but every changed commit needs its own focused verification.

---

## 10. GitHub, credentials, and PR rules

- Use the secure credential field already available in the ZAI environment. Never ask the owner to paste a token into chat, a file, a prompt, a command, a commit, a log, or a PR comment.
- Never print, echo, inspect, or store the credential value.
- Use the minimum GitHub permissions needed to create the branch, push, open/update the PR, and write checkpoint comments.
- Push only `refactoring/r11-w1b-20261014`; never push directly to `main`.
- No force-push.
- No merge button/action.
- No branch deletion or repository cleanup.
- Keep PR commits coherent: documentation/evidence, S-1, S-2, OD-TIME, lock-idle evidence, OD-SEC, diagnostics guard, and Preserve evidence must have understandable boundaries. If a slice is safer as a separate PR, stop the W1b PR before mixing it and report the reason.
- Post a concise checkpoint comment after each accepted slice containing scope, exact commit SHA, tests, evidence paths, and remaining scope. Do not claim merge or deployment.

---

## 11. Five-reviewer final gate

After the writer has completed all W1b slices and exact-head tests, run five read-only reviews sequentially. Each reviewer must read the live PR diff and canonical files, not only the writer report.

Each review must return:

- findings with durable IDs;
- severity/classification;
- exact file and line evidence;
- whether the issue is in W1b scope;
- recommended fix or precise owner decision;
- test/evidence gap;
- rollback boundary;
- verdict `PASS`, `PASS_WITH_REMEDIATION`, or `BLOCK`.

The writer may fix findings only in a new controlled commit. Re-run the affected reviewer and the final synthesizer after each remediation. Reviewers never write.

The final synthesizer must verify:

- crosswalk consistency;
- no duplicate or stale status claims;
- no generic DEFER;
- no protected semantic/financial/schema/export/import/UI changes;
- all W1b findings either closed with evidence or stopped with exact owner decisions;
- all exact-head checks and CI are green;
- the PR diff contains no unrelated files.

---

## 12. Final report contract

Write or update one canonical W1b execution report under:

`docs/architecture/refactoring/r11-w1b-20261014/R11-W1B-EXECUTION-REPORT-2026-10-14.md`

The report MUST include:

1. live baseline and drift reconciliation;
2. branch, PR, base SHA, final SHA, and all commit SHAs;
3. owner decisions used, with a link to the crosswalk;
4. files changed and files explicitly not changed;
5. one section per W1b slice with root cause, implementation, tests, evidence, acceptance, and rollback;
6. NF-001 method-recorded addendum details;
7. S-1 exact census and final name;
8. S-2 provenance proof and negative test;
9. OD-TIME classification and adversarial guard proof;
10. lock-idle characterization and any fail-open result;
11. OD-SEC workflow permissions, tests, and redaction proof;
12. diagnostics storage census and guard proof;
13. P-01..P-04 evidence matrix;
14. explicit `R11-W1A-NF-002` preserve/owner-gate record showing no split was executed;
15. all new findings and their classifications;
16. five reviewer reports and synthesizer verdict;
17. complete test/CI table tied to exact commits;
18. protected invariants re-verified;
19. limitations and `UNVERIFIED` claims;
20. Merge Manifest marked `NOT_EXECUTED`;
21. exact next-step owner gate for W2a.

Never write `COMPLETE` for a slice whose required evidence was not executed. Distinguish `VERIFIED`, `UNVERIFIED`, `NOT_EXECUTED`, `BLOCKED`, `PRESERVE`, and `OWNER_DECISION_REQUIRED`.

Required final markers:

```text
R11_W1B_EXECUTION_COMPLETE — PR_READY
W1B_NF001_EVIDENCE_ADDENDUM — VERIFIED
W1B_S1_PERIODRANGE — VERIFIED|BLOCKED|OWNER_DECISION_REQUIRED
W1B_S2_PREPARED_IMPORT — VERIFIED|BLOCKED|OWNER_DECISION_REQUIRED
W1B_OD_TIME — VERIFIED|BLOCKED|OWNER_DECISION_REQUIRED
W1B_LOCK_IDLE — CHARACTERIZATION_COMPLETE|NEW_FINDING_STOP
W1B_OD_SEC — VERIFIED|BLOCKED|OWNER_DECISION_REQUIRED
W1B_PRESERVE_EVIDENCE — VERIFIED|BLOCKED|OWNER_DECISION_REQUIRED
FIVE_REVIEWERS — COMPLETE
ALL_REQUIRED_CHECKS — PASS|BLOCKED
W2A_NOT_STARTED — OWNER_GATE_REQUIRED
NO_MERGE_PERFORMED
NO_BRANCH_CLEANUP_PERFORMED
NO_REPOSITORY_WRITES_OUTSIDE_APPROVED_W1B_SCOPE
NO_CLEANUP
NO_SECRETS_EXPOSED
NO_GENERIC_DEFER_USED
```

If any required marker cannot honestly be emitted, stop with the exact blocker and do not present the PR as ready.

---

## 13. Continuation rule

If work already exists when this prompt is opened:

1. inspect the current branch, worktree, commits, PR, comments, report, and uncommitted files;
2. compare the live state with this contract;
3. preserve valid existing work;
4. resume from the last verified slice;
5. do not redo completed S0/W1A work;
6. do not reset or delete work to make the prompt fit;
7. report any divergence before writing.

The correct end state is an open, reviewable W1b PR with exact evidence. It is not a merge, deployment, branch cleanup, or claim that later W2–W5 work is complete.
