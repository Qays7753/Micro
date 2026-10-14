# Micro R11 — S0 + W1A Controlled Execution Prompt
## One-branch, one-PR execution contract for ZAI

**Date:** 2026-10-13
**Mode:** Controlled repository remediation — evidence-first, branch-and-PR only
**Executor:** ZAI only
**Coordinator/Reviewer:** Manus
**Owner:** Micro repository owner

> This is the canonical execution prompt for the currently approved R11 scope. Read this file completely before making any repository write. Do not infer permission to merge, deploy, delete, clean up, or expand scope.

---

## 1. Mission

Execute the approved **R11 S0 + W1A** scope for Micro on one dedicated feature branch and one pull request, with separate coherent commits and checkpoint comments.

The work has two controlled parts:

1. **S0 — one-time Git-history secret scan:** evidence-only, sanitized output, no history rewrite, no rotation, no secret exposure.
2. **W1A — pure guard and monitor completion:** D-01, D-04, D-05, D-07, D-03, and D-02 only; no runtime, financial, Schema, Export, Import, UI, visual, or bulk-organization changes.

The goal is to close the approved guard/evidence gaps **without weakening any existing ceiling, guard, invariant, rejection rule, or compatibility contract**.

This is not a general cleanup task. Do not perform structural refactoring, bulk file moves, barrel creation, application reorganization, or unrelated bug fixing in this execution.

---

## 2. Live baseline and repository

The known live baseline at prompt publication is:

- **Repository:** `https://github.com/Qays7753/Micro`
- **Owner/repository:** `Qays7753/Micro`
- **Target branch:** `main`
- **Verified main SHA at prompt publication:** `5ef4ce08841bcd4ff7c5fb185a0fe2eeef6852fd`
- **Existing open documentation PR:** #358, `docs/r11-wave0-prompt-20261013`; do not modify, close, merge, or repurpose it.
- **Execution branch:** `refactoring/r11-s0-w1a-20261013`
- **Execution PR:** create exactly one PR from that branch into `main`; do not create additional implementation branches or PRs.

You MUST verify the live state before writing:

```text
git fetch --all --prune
gh pr view 358 --repo Qays7753/Micro
origin/main SHA
execution branch existence and worktree state
open PRs and their head/base SHAs
```

If `origin/main` is not the stated baseline, do not reset or overwrite anything. Determine whether it is a safe descendant and report the exact drift before proceeding. If there is a conflicting unmerged implementation branch, uncommitted work, or an existing execution branch with work, preserve it and stop for a controlled continuation decision. Never use `git reset --hard`, force-push, or blind branch deletion.

Use the secure GitHub credential mechanism available to the session. Never request, print, paste, store, echo, or include a token in any prompt, file, commit, report, command output, or PR comment.

---

## 3. Owner-approved decisions already made

The owner has accepted the best Cloud Code recommendations. Do not reopen these policy decisions during this execution:

### OD-GUARD — Option A

Approved:

- D-01: type-only UI→Storage edge ratchet, full baseline 19.
- D-03: AST-bound date fallback exemption, not text matching.
- D-04: read-like Application corpus property plus membership guard, baseline 63.
- D-05: exact lint warning tripwire at 35, with lint ceiling 37 unchanged.

### OD-MONEY — Option A

Approved:

- Keep `MoneyMinor = number` for now.
- Add a syntactic cast/unit-mixing monitor outside approved kernels/formatter zones.
- Do not introduce partial or full branding now.
- Do not change runtime or persisted representation.
- W5 remains closed and trigger-gated.

### OD-10 — Option A

Approved:

- Use narrow, verified leaf/shared exemptions only for `time`, `formatting`, `identity`, and `resultCodes.ts` if all invariants hold.
- Add house-pair ratcheting with separate value/type caps.
- Add a house-level value-cycle check.
- Preserve the full 128-edge census: 80 value edges and 48 type edges.
- No barrels, mass moves, blanket per-edge allowlists, or moving `materialUnitLabels` or `paymentSourcePolicy`.

### OD-KEYS — Option A, later W2 gate

Approved but explicitly out of S0/W1A:

- Reject unknown top-level keys only for current `(Schema 38, Export 30)` after characterization.
- Preserve Legacy, Goldens, MANIFEST, Schema, Export, and rejection precedence.
- Do not implement OD-KEYS in this prompt. It belongs to W2-1/W2-2.

### OD-COUNTS — test-side oracle, later W2 gate

Approved but explicitly out of S0/W1A:

- Registry-driven oracle for all 31 families over IndexedDB and Memory.
- No Export 30, Golden, MANIFEST, or Legacy changes.
- Do not implement this in W1A. It belongs to W2-1.

### OD-TIME — AST guard, no ID clock injection

Approved:

- AST-bound effect-class guard for the 21 ID-fallback sites and one parse site.
- No clock injection into opaque ID fallback values.
- Lock-idle characterization is evidence-only in W1A/W1b boundary; do not change lock-idle behavior in W1A.
- Do not reopen R2 D11/D13.

### OD-SEC — S0 plus later recurring workflow

Approved:

- Execute S0 now: one-time full-history scan with sanitized fingerprint-only evidence.
- The recurring workflow belongs to W1b, not this W1A implementation. Do not add it here unless a separate explicit scope change is recorded.
- No history rewrite, automatic rotation, or working-tree guard rewrite.

### OD-LABEL — later W3 gate

Approved but out of S0/W1A:

- Keep `fieldLabelAr` in Domain.
- Move only byte-identical consumers later, with R2/R6 edge neutrality.
- Do not touch labels in this prompt.

### OD-A11Y — later W4 gate

Approved but out of S0/W1A:

- W4-0 classification, then D-14, D-13, D-15.
- Semantics/focus only; no visual redesign or copy change.
- AppLockGate remains the oracle.
- Do not touch Accessibility/UI in this prompt.

### OD-PRESERVE — preserve all five

Approved:

- P-01 through P-05 remain Preserve.
- Tests/docs/evidence are allowed only where explicitly listed below.
- No split, move, transaction-boundary change, rejection-precedence change, or 130-method contract change.
- Do not edit the five Preserve production surfaces in W1A.

### OD-RECORD, S-1, S-2

Approved but mostly later:

- OD-RECORD is an append-only evidence addendum in W1b; do not rewrite R10-B history in W1A.
- S-1 is a W1b type-only rename after caller census; do not implement in W1A.
- S-2 is a W1b phantom/opaque `PreparedImport` brand; do not implement in W1A.

---

## 4. Non-negotiable invariants

The following MUST remain unchanged and must be tested or diff-guarded as applicable:

- `localSchemaVersion = 38`.
- `localExportVersion = 30`.
- 24 Legacy pairs.
- Current 38/30 import/export contract.
- 27 Golden files and MANIFEST.
- 130 `PrototypeLocalStore` methods and IndexedDB/Memory parity.
- Transaction atomicity and `storage_stale` identity.
- Rejection precedence and multi-fault behavior.
- PWA/build identity D1.
- Raw bundle ceiling `650000`.
- Gzip bundle ceiling `155300`.
- Lint ceiling `37`; warning baseline is exactly `35` for D-05.
- Arabic copy, RTL behavior, visual UI, CSS, tokens, layout, navigation, and accessibility semantics outside this scope.
- R2 D11/D13 behavior and guard files.
- No history rewrite.
- No direct `main` writes.
- No merge.
- No branch deletion or repository cleanup.

No guard may be weakened, normalized away, renamed to evade measurement, or re-anchored to a more permissive baseline without a new owner decision and a durable finding.

---

## 5. Required execution model

### 5.1 One writer, five sequential read-only reviewers

Use five specialized sub-agents/reviewers sequentially. They are read-only and MUST NOT commit, push, edit, or run destructive commands. They may inspect the branch, files, tests, and evidence relevant to their role.

1. **Architecture and boundary reviewer**
   - D-01, D-04, D-07, OD-10, import graph, house exemptions, cycles, layer boundaries.
2. **Data, storage, domain, and contract reviewer**
   - OD-MONEY, preserved storage/domain surfaces, Schema/Export/Legacy/Goldens, accidental financial or persistence impact.
3. **Runtime, time, and security reviewer**
   - D-03, D-02, S0 scan design, secret redaction, ambient time classifications, no clock injection.
4. **Tests, CI, and operability reviewer**
   - Fixtures, mutation drills, guard registration, CI commands, bundle/lint ceilings, rollback and failure behavior.
5. **Documentation, governance, and traceability reviewer**
   - findings IDs, owner decisions, evidence paths, document index, current-state/worklog rules, report completeness.

After all five read-only reviews, the main ZAI writer MUST synthesize conflicts into one implementation plan and record the reviewers’ findings in the unified report. No reviewer may silently change scope. No parallel writers.

### 5.2 Continuation and worktree safety

Before doing anything:

- inspect current branch and worktree;
- inspect uncommitted changes;
- inspect existing commits and PRs;
- inspect the latest R11 report and this prompt;
- preserve existing useful work;
- never reset blindly;
- never redo R0–R10 or R11 Wave 0;
- never repeat already completed R10-B work.

If ZAI is resuming an interrupted conversation, resume from the last verified checkpoint. Do not restart S0 or W1A if their evidence/commits already exist; verify first.

### 5.3 One feature branch and one PR

All implementation writes MUST be on:

```text
refactoring/r11-s0-w1a-20261013
```

Create or continue exactly one PR into `main`. Use separate coherent commits for S0, each guard, W1a-1, and W1a-2 as appropriate. Do not merge the PR. Do not create a second implementation PR.

---

# 6. Phase S0 — One-time Git-history secret scan

## 6.1 Scope

S0 is evidence-only. It may read the repository history through a fresh mirror, but it must not change repository history or credentials.

Scan, as available and explicitly recorded:

- all reachable branches;
- tags;
- `refs/pull/*/head` refs;
- every reachable blob using a streaming approach;
- commit messages and tag messages.

The preferred shape is equivalent to:

```text
rev-list --objects --all
cat-file --batch
```

Use the existing working-tree guard’s pattern table or a shared, mechanically verified source. Do not invent a weaker pattern table.

## 6.2 Security rules

- Never print match text.
- Never print secret values.
- Never put secret values in the report, logs, artifacts, PR comments, or test output.
- Store only rule ID, object/commit SHA, path where safe, and a non-reversible fingerprint or redacted locator.
- Use a temporary synthetic repository for self-tests.
- Plant a fake secret, add it, remove it in a later commit, and verify the history scan detects it.
- Run a redaction test proving the report cannot contain the planted value.
- Document scanned refs, object count, scanner commit, pattern-table source, date, and blind spots.
- Do not rotate or revoke credentials automatically.
- Do not rewrite history.
- If a likely real credential is found, STOP safely, write only a sanitized incident marker, and report `SECURITY_INCIDENT_REQUIRES_OWNER_RUNBOOK`. Do not continue as if S0 passed.

## 6.3 S0 acceptance

S0 passes only if:

- all intended refs are enumerated and scanned;
- the self-test detects the planted synthetic secret;
- the redaction test passes;
- no secret text appears in the output;
- the result is either `ZERO_FINDINGS` or a sanitized incident report;
- no history or credential mutation occurred.

S0 evidence path:

```text
docs/architecture/refactoring/r11-s0-w1a-20261013/evidence/R11-S0-GIT-HISTORY-SECRET-SCAN-2026-10-13.md
```

The report must explicitly list blind spots such as unreachable server-side objects, deleted PR refs, Actions logs/artifacts, Pages logs, issue/PR text, and forks when they are not scanned.

---

# 7. Phase W1A-1 — Pure guards

W1A-1 contains D-01, D-04, D-05, and D-07. It is guard-only. Do not change production runtime behavior.

## 7.1 D-01 — type-only UI→Storage edge ratchet

Implement the approved 19-key baseline ratchet.

Required behavior:

- count only genuinely type-only imports;
- all-type specifiers count as type-only;
- mixed imports count as value imports;
- cover `export type ... from` and `import("...")` type nodes;
- fail on a new key;
- fail on a stale key or silent shrink;
- preserve the old 17-key subset as a named historical comparison, not as the full baseline;
- include fixtures for growth, shrink, swap, mixed imports, export-type, and import-type cases;
- prove the guard cannot be bypassed by changing import spelling.

Forbidden:

- changing application imports to make the guard pass;
- changing the baseline downward or upward without an owner decision;
- runtime behavior changes;
- broad refactoring.

## 7.2 D-04 — read-like corpus property and membership guard

Implement a mechanically recorded predicate for the full read-like Application corpus, baseline 63.

Required behavior:

- record the exact predicate, file scope, exclusions, and counting method;
- classify every in-scope file exactly once;
- enforce the read-only property across the entire corpus, not just named families;
- ratchet membership by file key, not by a bare count;
- fail when a new read-like file appears outside the governed corpus;
- fail when a baseline file becomes stale or disappears;
- fail on a property violation;
- audit all 63 current files and record the result;
- investigate the 63rd file (`materialUnitLabels.ts`) according to the evidence, without moving it.

The guard must not rely only on family names or directory names. A bare count is insufficient because it allows swaps.

## 7.3 D-05 — exact lint warning tripwire

Implement an exact tripwire around the current warning baseline:

- exact expected warning count: `35`;
- per-rule counts must not increase;
- a decrease is not banked as future headroom; if the baseline changes, the same PR must document and re-anchor it explicitly;
- ceiling `37` remains unchanged and must not be weakened;
- include synthetic `+1` and `-1` warning drills with distinct failure messages;
- do not alter lint rules to make the count pass.

## 7.4 D-07 — OD-10 house-pair deep-import ratchet

Implement the approved Application internal graph guard using a verified import-graph method.

Required baseline evidence:

- 128 file-level cross-house edges;
- 80 value edges;
- 48 type edges;
- the two known R10-B growth edges recorded with provenance;
- current value-cycle count is zero if verified;
- current type SCC state is recorded.

Required behavior:

- enforce house-pair caps, with value and type tracked separately;
- maintain the full 128-edge listing as a census artifact;
- verify leaf exemptions on every run and auto-revoke an exemption if its invariants fail;
- permitted candidates are only `time`, `formatting`, `identity`, and `resultCodes.ts`, subject to all invariants;
- candidate invariants: zero outgoing cross-house edges, no storage/UI/IO imports, no import-time side effects or mutable module state, and vocabulary/pure-function exports rather than feature policy;
- add a house-level value-cycle check;
- prevent new type SCCs beyond the recorded baseline;
- fail on a new pair, cap growth, stale/shrunk listing, exemption violation, or new cycle;
- report `inventory/materialUnitLabels` as a review candidate if the live graph confirms the supplied context.

Do not create barrels, door layers, blanket per-edge allowlists, or mass moves. Do not move `materialUnitLabels` or `paymentSourcePolicy`.

If the required graph extractor or baseline cannot be verified without inventing numbers, STOP before implementation and report an evidence blocker. Do not guess or silently re-anchor.

## 7.5 W1A-1 acceptance

W1A-1 passes only if:

- every guard passes its live baseline;
- every negative fixture fails for the intended reason;
- all baselines and census definitions are recorded;
- no protected production file was changed;
- raw/gzip bundle output is byte-identical or the exact cause is proven to be docs/test-only;
- lint remains within `35` warnings and ceiling `37`;
- all required project checks pass;
- a checkpoint comment names the commit SHA, files, tests, and report path.

---

# 8. Phase W1A-2 — AST time guard and MoneyMinor monitor

W1A-2 contains D-03 and D-02 only. It depends on the verified AST helper and the completed W1A-1 baseline.

## 8.1 D-03 — AST-bound `??` exemption

Replace the approved textual exemption mechanism with a syntax-bound guard.

Required implementation shape:

- use the TypeScript parse-only API (`createSourceFile` or the repository’s equivalent);
- do not require a Program, type checker, module resolution, or runtime execution;
- fail closed on parse diagnostics;
- ensure the scanned file set is a superset of the previous text guard’s file set;
- bind each exemption to the exact `??` BinaryExpression and its operand, not to a line or substring;
- preserve only the five currently approved legitimate sites after verification;
- add fixtures proving comments, strings, neighboring expressions, and `||` cannot satisfy the exemption;
- add a stale-entry fixture and a parse-error fixture.

If the AST implementation finds a site that the old text guard allowed incorrectly, do not exempt it silently. Record a new durable finding, stop the affected commit, and report the evidence.

## 8.2 D-02 — MoneyMinor cast/unit-mixing monitor

Implement the approved policy monitor only:

- keep `MoneyMinor = number`;
- do not introduce a brand;
- do not change arithmetic kernels, formatter, writer, persistence, Schema, Export, or runtime behavior;
- record the exact census method and baseline for assertions/casts entering or leaving the `*Minor` family;
- exclude the explicitly approved kernel/formatter zones;
- add a mutation fixture that introduces an unauthorized `as MoneyMinor` or equivalent unit-mixing assertion outside the approved zones;
- fail on growth or unapproved cast patterns;
- prove emitted JS is unchanged.

Do not solve this by adding blanket casts. Do not use a name-suffix heuristic as the only protection. Do not open W5.

## 8.3 W1A-2 acceptance

W1A-2 passes only if:

- D-03 is AST-bound and fail-closed;
- D-02 is a monitor only, with no branding or runtime change;
- all negative fixtures fail for the intended reason;
- the five approved AST sites are proven, not assumed;
- emitted JavaScript, persisted bytes, Schema/Export, Goldens, and protected guards remain unchanged;
- required tests and CI pass;
- final checkpoint evidence is published on the same PR.

---

## 9. Required test and verification contract

Discover the repository’s canonical commands from `AGENTS.md`, `CONTRIBUTING.md`, package scripts, and CI. Run the exact required commands and report them verbatim. At minimum, cover the applicable checks below:

```text
pnpm check
operations-control tests/checks and tracker validation
TypeScript typecheck
lint and exact warning tripwire
format checks
design/text-density guards where required
all registered guard tests
prototype check/test/build
doc-index coverage check
current-state size/guard checks
git diff --check
focused S0 scanner self-test and redaction test
focused D-01/D-03/D-04/D-05/D-07/D-02 fixtures
```

For every commit:

- run the smallest focused tests;
- run the required wave gate;
- record command, exit code, duration if available, and exact SHA;
- run the full required suite before declaring the PR ready.

After every implementation wave:

- verify the diff scope;
- verify bundle raw/gzip ceilings;
- verify lint warning count and ceiling;
- verify no protected file changed;
- verify docs/index/tracker state;
- run CI and preview checks as available;
- add a PR checkpoint comment.

Do not re-run a green unchanged SHA gratuitously, but every new commit must have its required checks. Do not use repeated random gzip retries or weaken a guard to obtain a green result.

---

## 10. Documentation and evidence contract

Create one unified final report at:

```text
docs/architecture/refactoring/r11-s0-w1a-20261013/R11-S0-W1A-EXECUTION-REPORT-2026-10-13.md
```

Store focused evidence under:

```text
docs/architecture/refactoring/r11-s0-w1a-20261013/evidence/
```

The unified report MUST include:

1. Executive status and exact baseline/head/PR SHAs.
2. Live-state inventory and drift check.
3. Five reviewer names/roles, read-only findings, and synthesis.
4. S0 method, refs scanned, object counts, scanner SHA, pattern-table source, self-test, redaction test, result, and blind spots.
5. Each W1A finding ID, root cause, files changed, tests, evidence, and acceptance.
6. Baselines: 19, 63, 35, 128/80/48, five AST sites, and D-02 cast census method.
7. Invariant matrix proving no Schema/Export/Legacy/Golden/financial/UI/visual change.
8. Per-commit and per-wave test matrix.
9. Bundle and lint measurements.
10. New findings, if any, with durable ID and classification.
11. Explicit list of files not changed because they are out of scope.
12. Rollback boundary for every commit and safe-stop state.
13. Exact PR URL, branch, head SHA, checks, and checkpoint comments.
14. Limitations and `UNVERIFIED` evidence.
15. Final Merge Manifest marked **NOT EXECUTED** because merge is not authorized.

Update `docs/00-document-index.md` for the final prompt/report/evidence according to the repository’s document-index rules. Update operational-control source JSON before generated views; never hand-edit generated views. Keep `current-state.md` concise and update append-only logs only with dated entries.

Every numeric claim must include its definition, scope, tool/script, command, base/live SHA, date, raw-output hash when applicable, and reviewer.

---

## 11. New-finding and stop policy

Any newly discovered issue MUST be handled as follows:

1. assign a durable finding ID;
2. classify it as fix now, preserve, out of scope, disproved, or precise owner-gated trigger;
3. record root cause, affected family, evidence, and acceptance;
4. fix it only if it belongs to this approved S0/W1A scope;
5. otherwise stop at the boundary and report the exact owner decision required.

Never use a generic `DEFER`.

STOP immediately and do not push the affected commit if any of the following occurs:

- main or branch drift cannot be reconciled safely;
- uncommitted work would be overwritten;
- a protected financial, historical, Schema, Export, Import, Legacy, Golden, security, or UI semantic would change;
- a baseline must be raised, lowered, normalized, or weakened;
- a required evidence method cannot be reproduced;
- a guard discovers a previously allowed violation;
- a real or likely secret is found;
- a test/CI failure cannot be explained within scope;
- the diff includes unrelated files or bulk moves;
- a reviewer disagrees on a protected contract and the conflict cannot be resolved from this prompt.

Do not ask routine questions. Stop only for a real owner decision, protected semantic conflict, permission failure, or evidence blocker, and report the exact payload needed.

---

## 12. GitHub and PR rules

- Use the secure credential field only.
- Never print or store the credential.
- Push only the dedicated execution branch.
- Use one PR into `main`.
- Add checkpoint comments after S0, W1A-1, W1A-2, and final readiness.
- Each comment must include the exact commit SHA, scope, tests, evidence paths, and known limitations.
- Keep the PR open.
- Do not merge.
- Do not close or delete branches.
- Do not clean up old branches.
- Do not modify PR #358.
- Do not create a second implementation PR.

The final PR comment must state exactly:

```text
R11_S0_W1A_EXECUTION_COMPLETE — PR_READY
NO_MERGE_PERFORMED
NO_BRANCH_CLEANUP_PERFORMED
NO_SECRETS_EXPOSED
NO_GENERIC_DEFER_USED
```

If blocked, use one of:

```text
R11_S0_W1A_BLOCKED — OWNER_DECISION_REQUIRED
R11_S0_W1A_BLOCKED — EVIDENCE_GAP
R11_S0_SECURITY_INCIDENT — OWNER_RUNBOOK_REQUIRED
```

Never claim `PR_READY` if any required check, evidence item, or acceptance criterion is missing.

---

## 13. Final report contract

The final response and unified report must distinguish every statement as one of:

- `VERIFIED_FROM_REPOSITORY`
- `INFERRED`
- `UNVERIFIED`
- `NOT_EXECUTED`
- `OWNER_DECISION_REQUIRED`
- `BLOCKER`
- `RECOMMENDED_FINAL_DISPOSITION`

The report must state:

- what was inspected;
- what was changed;
- what was not changed;
- exact commits and files;
- exact tests and CI results;
- security scan outcome without secret material;
- evidence limitations;
- rollback boundaries;
- whether the PR is ready for owner review.

Do not merge, deploy, delete, or claim production success. Stop with the PR open and wait for the owner’s separate merge decision.

---

## 14. Required final markers

End the unified report and final ZAI response with exactly one applicable status block.

Success:

```text
R11_S0_W1A_EXECUTION_COMPLETE — PR_READY
S0_COMPLETE
W1A_1_COMPLETE
W1A_2_COMPLETE
ALL_REQUIRED_TESTS_GREEN
NO_MERGE_PERFORMED
NO_BRANCH_CLEANUP_PERFORMED
NO_SECRETS_EXPOSED
NO_UNAUTHORIZED_REPOSITORY_WRITES
NO_REPOSITORY_WRITES_OUTSIDE_APPROVED_BRANCH_AND_PR
NO_GENERIC_DEFER_USED
```

Blocked:

```text
R11_S0_W1A_BLOCKED — <OWNER_DECISION_REQUIRED|EVIDENCE_GAP|SECURITY_INCIDENT>
NO_UNAUTHORIZED_SCOPE_EXPANSION
NO_MERGE_PERFORMED
NO_BRANCH_CLEANUP_PERFORMED
```
