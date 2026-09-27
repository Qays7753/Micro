# Z AI — Micro Master Operational Remediation

## 0. Mission

You are the implementation agent for the Micro repository. Execute the approved operational, financial-integrity, terminology, consistency, guard, and maintainability remediation program described below.

This is **not** a screen-migration task, not a UI redesign task, not a rewrite, and not a request to copy code from another design repository. Micro’s existing domain contracts, components, storage boundaries, financial invariants, and working baseline are protected. Improve Micro from the inside by removing conflicting sources of truth and fixing root causes across all affected consumers.

The owner has already approved the product and financial decisions in this prompt. Do not reopen them as routine questions. Stop only for a genuinely new financial meaning, an incompatible data-format change, an unproven historical-data compatibility issue, an unapproved structural refactor, or an unexpected scope/security problem.

**Executor:** Z AI.  
**Coordinator/reviewer:** Manus.  
**Owner:** Product owner.  
**Repository:** `https://github.com/Qays7753/Micro`  
**Base branch:** `main`  
**Known preparation baseline:** `2ebb435334dd69da0273d592ec8bffac5e70c1cf` — verify live before work.  
**Canonical execution charter in the repository:**

```text
docs/operations/control/evidence/micro-master-remediation-2026-09-27/MICRO-MASTER-REMEDIATION-CHARTER-AR.md
```

The Arabic charter is the authoritative owner-facing scope companion to this prompt. Read it completely before implementation.

---

## 1. Secure fields and write boundary

Use the following only as secure credential fields supplied by the owner or the Z AI environment. Never paste, print, commit, upload, or include a real token in a prompt, command, report, issue, PR comment, screenshot, or repository file.

```text
GITHUB_ACCESS_TOKEN=<SECURE_SECRET_FIELD_ONLY>
```

The token is for this Micro task only and only for the minimum repository operations required by the approved workflow. Do not request, store, or use credentials for any other repository, deployment, billing, account, or settings operation.

Allowed repository writes:

- create or update a dedicated feature branch;
- create/update PRs for the approved remediation slices;
- commit approved code, tests, evidence, and required Tracker/current-state updates;
- merge a PR only after its exact acceptance gate, CI, scope review, and Merge Manifest are complete and the workflow permits the merge;
- update Micro’s canonical Tracker source JSON and regenerate its views when the slice requires it.

Forbidden writes:

- direct pushes to `main`;
- force-pushes unless separately approved in a new decision;
- deletion or cleanup of branches, PRs, files, data, snapshots, fixtures, or history;
- changes to repository settings, branch protection, secrets, billing, domains, deployments, or Cloudflare configuration;
- writes to any design/documentation repository outside Micro;
- embedding or echoing the token;
- bulk file moves or structural refactoring outside the explicit structure gate.

If the current repository state, branch, PR, permissions, or baseline differs from the verified state, stop and report `STATE_DRIFT` before writing.

---

## 2. Mandatory reading and live preflight

Before touching code:

1. Read `AGENTS.md`.
2. Read `docs/operations/current-state.md`.
3. Read `README.md`.
4. Read `docs/operations/micro-thinking-charter-v1.md`.
5. Read `docs/00-document-index.md`.
6. Read `docs/implementation/03-pre-build-alignment-v1.md`.
7. Read `docs/operations/control/generated/AGENT-BRIEF.md`.
8. Read `docs/operations/control/generated/ACTIVE-WORK.md`.
9. Run:

```bash
python3 scripts/operations-control/validate.py
python3 scripts/operations-control/generate_tracker.py --check
```

10. Inspect live GitHub state:

```bash
git fetch origin --prune
git rev-parse origin/main
gh pr list --repo Qays7753/Micro --state open
git status --short --branch
```

11. Inspect current PRs #244 and #245 as evidence and possible work to reuse. Do not assume either PR is merged or correct merely because it exists. Verify its diff, tests, contracts, and scope.
12. Check active Claims/Workstreams and do not overlap an existing area or contract reservation.
13. Read the contracts relevant to the current slice before editing. For financial/domain work, at minimum read:

```text
docs/contracts/02-order-lifecycle-contract.md
docs/contracts/05-financial-p0-policies.md
docs/contracts/06-financial-event-prototype-contract.md
docs/implementation/02-domain-contract-coverage.md
docs/product/financial-operating-model-v1.md
docs/architecture/SOURCE_OF_TRUTH.md
docs/architecture/CHANGE_PROTOCOL.md
docs/architecture/EXTENSION_PLAYBOOK.md
docs/architecture/COMPONENT_CONTRACTS.md
docs/operations/agent-handoff-protocol-v1.md
.github/pull_request_template.md
```

At the start of the report, state:

- exact `origin/main` SHA;
- open PRs and whether they were reused, corrected, or left untouched;
- active claims and reserved areas;
- files/documents read;
- what will change in the current slice;
- what will not change;
- the acceptance gate and rollback boundary.

Do not reset, reclone over work, discard uncommitted work, or repeat completed work blindly. If you are continuing from an existing Z AI conversation, inspect the current branch, worktree, commits, PR diff, and last report first.

---

## 3. Five coordinated sub-agents

Use between **3 and 7** sub-agents according to the size of the current slice. The default is **five**. They work toward the same milestone and use one shared evidence ledger; they must not create conflicting parallel implementations or five duplicated reports.

The primary agent remains responsible for synthesis, branch ownership, implementation, tests, and final evidence. Sub-agents are read-only by default. During a controlled implementation slice they may review the working diff or propose exact changes, but they must not independently push, merge, alter Tracker source, or modify runtime code without the primary agent’s explicit coordination.

### Specialist 1 — Source-of-truth and contract mapper

Map each affected rule to its authoritative contract/domain source, every writer and reader, projections, UI surfaces, reports, export/import, fixtures, snapshots, and tests. Identify duplicate or competing definitions and classify them as canonical, historical, duplicate, conflict requiring decision, or unaffected.

### Specialist 2 — Domain and financial-integrity reviewer

Review equations, settlement, debt, collection, reversal, delivery responsibility, period result, break-even, direct sales, cost completeness, inventory, owner money, and cash/result separation. Distinguish implementation consistency from accounting-policy validity. Do not describe Micro’s internal indicators as official financial statements.

### Specialist 3 — Persistence, history, and compatibility reviewer

Review Local Storage, snapshots, event identity, append-only history, export/import, fixtures, versions, calculationVersion, stale writes, idempotency, and read compatibility. Prove that a new rule does not silently reinterpret old data. Identify whether a safe forward fix, compatibility reader, explicit reinitialization, or owner decision is required.

### Specialist 4 — Application, semantic-surface, and user-control reviewer

Trace application services, pages, messages, badges, forms, and actions that display or act on the affected meaning. Ensure the user can understand, cancel, correct through an approved path, and is not forced into a false financial state. Do not perform broad visual redesign; review UI only for semantic truth, affected interaction, RTL, and safe control behavior.

### Specialist 5 — Tests, guards, security, and operability reviewer

Review existing tests and add the smallest independent contract/behavior tests needed. Check guard coverage, secret scanning, test-focus scanning, entity touchpoints, lint boundaries, bundle limits, CI, Tracker, current-state, and rollback evidence. Ensure tests assert behavior rather than copying the implementation’s equation as an oracle.

After each specialist response, the primary agent must reconcile disagreements with evidence. Do not silently select the most convenient interpretation.

---

## 4. Non-negotiable product and financial decisions

These are owner-approved decisions. Implement them as written unless a genuinely new conflict is discovered.

### Delivery responsibility and contribution model

The business owner chooses:

- delivery paid by the customer;
- delivery paid by the project;
- delivery shared.

The user-facing model is simple:

- `Project delivery contribution` — amount borne by the project;
- `Customer delivery contribution` — amount charged to the customer;
- if the customer contribution is positive, record whether it is collected by the project or paid directly to the courier/company.

Values are non-negative. In the shared case, the two contributions must equal the actual delivery charge. `null` means unknown/not set; `0` means explicitly zero. Do not convert `null` to zero silently. Do not make the word `shared` an independent calculation source; derive the display label from the two numeric contributions.

Example for product price 50 and delivery 5:

- customer bears 5, project collects it, project pays courier: customer due 55; delivery fee +5 and delivery cost -5;
- project bears 5 and pays courier: customer due 50; project delivery cost -5;
- customer 2, project 3, project collects 2 and pays courier 5: customer due 52; delivery effect +2/-5;
- customer pays courier directly: Micro does not record that 5 as project cash, debt, revenue, or project cost;
- customer pays courier 2 directly and project pays 3: customer due 50; project cost -3.

Separate accrued cost from cash movement. Do not invent cash when a courier has not yet been paid. If the owner pays a project cost personally, preserve the project cost and owner-financing meaning under the existing contract; do not hide or duplicate it.

### Money scale and time

- Micro’s current Jordanian dinar internal unit is the **qirsh/penny at two decimal places (`1/100`)**.
- Reject a third decimal place rather than silently rounding it.
- Do not mass-change stored values.
- Use `Asia/Amman` for financial business-day and period semantics. Device time may be displayed as secondary information only.

### Product scope

Micro currently provides internal operational-management indicators. Do not claim official accounting statements, tax compliance, or professional accounting correctness without qualified review. Keep cash, result, debt, deposit, owner money, loan, inventory purchase, and operating cost semantically separate.

---

## 5. Execution waves

Work sequentially. One active slice at a time. Each slice requires its own Claim/Workstream reservation, repair card, branch, PR boundary, focused tests, and evidence. A later wave may not begin until the prior wave is merged and verified on `main`.

### Wave D15-A — Settlement-basis safety (`FIN-009`)

Goal: eliminate the mismatch where debt/collection/remainder/reversal uses `agreedPriceMinor` while the collectible order value includes customer delivery contribution.

Required behavior:

- when customer delivery contribution is known, outside the product price, and collected through the project:
  - `orderValueMinor = agreedPriceMinor + customerContributionMinor`;
  - `outstandingMinor = max(orderValueMinor - collectedMinor, 0)`;
  - collection and debt registration use the same basis;
  - `paid` is impossible while the correct outstanding amount is positive;
  - over-collection is rejected before any write;
  - reversing a collection is capped by the un-reversed portion of that original collection event, not by order value;
  - after reversal, outstanding is recalculated from the collectible order basis;
  - idempotent retries do not double-apply.

The two delivery contribution inputs and the save summary are part of the approved D15 behavior. The save summary must never claim money was collected just because terms were saved.

Historical-conflict behavior:

- detect conflicts read-only;
- do not rewrite old records;
- do not set `needs_review` automatically;
- block the ordinary collection path before writing when a historical conflict is detected;
- show the basis, recorded collection, and difference clearly;
- allow collection only through a separately approved correction use case;
- preserve original events and snapshots.

Before merge, inspect PR #244. Reuse only code that satisfies this contract. If a required behavior is missing, correct it in the D15 PR rather than merging and declaring it complete.

Acceptance scenarios must include:

1. price 50, no billable delivery;
2. price 50 + customer contribution 5 through project;
3. project 10/customer 0;
4. project 0/customer 10;
5. project 5/customer 5;
6. customer pays courier directly;
7. collect 50 then 5;
8. over-collect 6 when 5 remains;
9. partial and full reversal;
10. repeated idempotent collection/reversal;
11. null versus explicit zero;
12. historical conflicting record with no write.

Do not change period-result policy, schema, export/import, or broad visual design in this wave.

### Wave 1 — Cross-surface reconciliation

Cover F-002, F-003, F-004, F-005, F-006, F-007, F-026, F-027, F-049, and F-050.

- remove local equations from share messages, OrderDetail previews, deposit/price/delivery previews, reports, and related services;
- use one domain-owned calculation/summary or a derived read model with one owner;
- add a read-only consistency checker aware of order state, events, deposits, collection, reversals, cancellation, price corrections, and delivery knowledge;
- make import validation layered: schema, range, cross-field relations, then round-trip export/import; reject before atomic write;
- prove event history and derived state agree;
- separate order lifecycle completion from payment completion;
- keep React/UI from owning financial rules.

### Wave 2 — Financial policy and calculation meaning

Cover F-008 through F-019 and F-061, plus their linked equation/conflict identifiers.

- separate customer delivery fee, project delivery cost, and direct courier payment;
- implement one honest break-even model with explicit fixed costs, variable costs, selling price, product mix, period, and assumptions;
- do not call a direct margin a contribution margin unless the required variable costs are actually included;
- make direct-sale collection explicit for new operations; unknown is not fully collected;
- do not show a final complete period result when material cost is unknown; use a clearly marked partial/unknown state;
- generate result explanations from the actual calculation decomposition;
- distinguish material consumption, inventory waste, order loss, and non-cash write-off;
- keep implementation-consistency claims separate from accounting-policy claims.

### Wave 3 — Semantic truth, statuses, and user-facing wording without redesign

Cover F-020 through F-032.

- distinguish recorded sales from collected cash;
- separate order completion from payment state;
- establish one checked terminology/catalog source for financial and operational copy;
- use `next step`, not the conflicting legacy wording;
- distinguish `reviewReasons`, `blockedOperations`, `decisionPending`, and missing knowledge; do not create six storage states without a verified need;
- label non-cash depreciation proposals honestly;
- separate overdue debt from operational attention/reminders;
- make model requirements match validation and copy;
- distinguish local draft persistence from financial-event recording;
- keep the user in control and provide a safe cancel/correction path where applicable.

Do not introduce broad card, shell, color, token, or screen redesign here.

### Wave 4 — Documentation, authority, persistence, history, and guards

Cover F-033 through F-042, F-044, F-046, F-047, and F-051 through F-060.

- make version and architecture counts verifiable and date/SHA scoped;
- correct current-state duplication and stale historical assertions;
- maintain an authoritative document index and changelog with evidence;
- keep visual Standard references explicit without creating a competing token source;
- extend the playbook across domain, application, storage, export/import, tests, UI, and docs;
- preserve two-decimal money scale and Amman financial time semantics;
- add `calculationVersion` to new financial snapshots only, with known reading behavior for old snapshots;
- prevent event identity collisions and unsafe raw persistence writes;
- harden secret/test-focus/route/entity/contract guards;
- add small independent contract tests without copying production equations as the test oracle;
- protect historical data from silent reinterpretation.

### Wave 5 — Maintainability and future evolution, under the structural gate

Cover F-043, F-045, F-048, and structural ST items only where the approved scan classifies a narrow fix as safe now.

Allowed now:

- directional boundary guards;
- removal of dead or duplicate CSS only after consumer inventory and computed-style protection;
- route registry synchronization or a strict synchronization guard;
- documenting responsibility and discoverability of oversized files;
- removing a duplicate financial calculation when it is part of an approved cross-surface root-cause fix.

Forbidden without a new structural gate and owner decision:

- bulk file moves;
- creating a `features/` tree;
- splitting `policies.ts`, Finance, OrderDetail, Catalog, stores, or transfer services;
- mass CSS reorganization;
- changing module ownership solely to make the tree look cleaner.

The post-Group-6 Structure/Architecture/Code Organization Scan is a mandatory gate for any structural refactor. No structural code edit may be hidden inside a financial, UI, or guard PR.

### Mapping of all report identifiers

Every F-001 through F-062 must appear in the final coverage matrix with exactly one current disposition: fixed, preserved, deferred, out of scope, duplicate, reopened, or false positive, plus evidence.

- F-001..F-007: D15-A and Wave 1 according to the actual root cause;
- F-008..F-019: Wave 2;
- F-020..F-032: Wave 3;
- F-033..F-042: Wave 4;
- F-043..F-050: Wave 1/4/5 according to the actual root cause;
- F-051..F-060: Wave 4;
- F-061: Wave 2;
- F-062: deferred product capability, not a current defect;
- ST-01..ST-24: map to the corresponding F item or preserve/defer/gate classification; do not create duplicate tickets.

If the report’s original classification is wrong, classify it as `DEEPENS`, `DUPLICATE`, `REOPENED`, or `FALSE_POSITIVE` with evidence. Do not invent a new identifier merely to avoid reconciliation.

---

## 6. Engineering quality and maintainability rules

For every slice:

- domain owns financial meaning; React does not calculate financial rules;
- application orchestrates use cases; storage adapters do not own policy;
- presentation formats values but does not decide what they mean;
- one canonical function/source per shared calculation;
- explicit typed names for unknown/zero/partial/complete states;
- no hidden side effects in formatting or selectors;
- no blind reads/writes or stale overwrites;
- stable idempotency for sensitive retries;
- no new durable entity without `docs/quality/persistent-entity-touchpoints.json` updates and its required consumers;
- no secrets, personal identifiers, raw money, or unredacted sensitive values in diagnostics;
- use established naming, TypeScript style, import direction, error conventions, and test patterns;
- keep each change easy to locate, review, revert, and extend;
- do not use a refactor to hide a semantic change;
- do not preserve duplicate code merely because the system is experimental when the duplicate is the root cause of a financial inconsistency;
- do not over-engineer a future platform or add frameworks without a stage decision.

---

## 7. Repair Card and PR contract

Before each PR, create/update one repair card for the root cause. It must state:

1. finding IDs and classification;
2. verified evidence and exact paths/lines/tests;
3. authoritative source and all writers/readers/consumers;
4. user/data/financial/security impact;
5. policy decision versus implementation consistency;
6. in-scope files and explicit non-goals;
7. null/zero/unknown/history/snapshot/export behavior;
8. success, failure, edge, retry, cancellation, and correction scenarios;
9. focused tests and why a full suite is not repeated at every action;
10. exact rollback boundary and post-write compatibility boundary;
11. exact files/commits changed and what intentionally did not change.

Use the repository PR template and complete every relevant field. Do not mark an item `VERIFIED` before the change is merged and checked on `main`.

---

## 8. Verification budget and required checks

Use targeted checks during development. Do not repeatedly run the entire suite for every small edit.

At the minimum, run the checks appropriate to the touched layers:

```bash
python3 scripts/operations-control/validate.py
python3 scripts/operations-control/generate_tracker.py --check
git diff --check
node scripts/check-secrets.mjs
node scripts/check-test-focus.mjs
```

For financial/domain changes, run the focused domain/application/contract tests and the affected consumer tests. For storage/export/import changes, run released-pair/round-trip/compatibility tests. For UI-semantic changes, run focused DOM/runtime checks and perform the required real-device/RTL check when the PR changes touch or visible semantics. Run the full `pnpm check` at the appropriate integration/PR boundary or when required by the repository gate, not as an unbounded loop.

Record exact command, exit code, and result. A green CI check does not prove that an unreviewed semantic change is correct.

---

## 9. Stop conditions

STOP and report `REMEDIATION_BLOCKED` if:

- baseline or branch state drifts;
- a required file or contract is missing;
- PR #244 or #245 contains a conflict not resolved by evidence;
- the implementation would change an unapproved financial meaning;
- a new schema/export/import version, migration, or historical rewrite is needed;
- old data cannot be read safely after the change;
- a new financial state or correction use case is required but not specified;
- the diff requires bulk moves or a structural refactor outside the gate;
- a test or guard fails and the workaround would hide it;
- write permission is broader than the approved secure field or unexpected credentials are requested;
- unrelated files or adjacent product capabilities appear in the diff.

When stopping, provide the exact example, evidence, alternatives, impact, and safe next state. Do not ask the owner to re-approve decisions already stated here.

---

## 10. Report and final-state contract

After every slice, publish/update a report in the approved Micro evidence location. The report must include:

- scope and credentials mode;
- exact baseline, branch, PR, and commit SHAs;
- actions actually performed;
- files changed and files intentionally unchanged;
- source-of-truth map and consumer inventory;
- finding disposition matrix;
- tests and exact exit codes;
- CI and merge evidence separated by PR head and merge SHA;
- schema/export/history/financial/semantic impact;
- limitations and unresolved questions;
- rollback/recovery boundary;
- next gate only — never start the next wave automatically.

Every material statement must be clearly one of: `VERIFIED`, `INFERRED`, `UNVERIFIED`, `NOT_EXECUTED`, `DEFERRED`, or `BLOCKER`.

Update the Tracker source JSON and regenerate views only when the slice actually changes its state. Update `current-state.md` and `todo.md` only to describe facts that are already merged and verified on `main`.

Use these exact endings:

```text
REMEDIATION_COMPLETE — PR_READY
```

or:

```text
REMEDIATION_BLOCKED — <exact reason>
```

After a successful merge and verification of one slice:

```text
POST_MERGE_VERIFICATION: PASS
NO_UNAUTHORIZED_CLEANUP
NO_TOKEN_EXPOSURE
```

At the end of the entire approved operational program, only after all covered waves are merged and verified:

```text
MICRO_OPERATIONAL_REMEDIATION_COMPLETE — OWNER_REVIEW_REQUIRED
NO_UNAUTHORIZED_CLEANUP
NO_UNAUTHORIZED_REPOSITORY_WRITES
NO_REPOSITORY_WRITES_OUTSIDE_APPROVED_PR_FLOW
NO_TOKEN_EXPOSURE
```

Do not call the full program complete if a finding is merely documented, a PR is merely open, CI ran only on a PR head, or the change was not verified on the actual target `main`.
