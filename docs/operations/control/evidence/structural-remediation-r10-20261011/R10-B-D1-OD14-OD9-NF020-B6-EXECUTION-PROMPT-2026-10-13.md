# Z AI Execution Prompt — OD-14 D1 Root Fix, OD-9 Separation, NF-020 and B6 Completion

## Mission

Continue the existing Micro R10-B execution from the verified B5/OD-14 checkpoint. Do not restart completed work. Execute the owner-approved OD-14 D1 root fix first, then the separately revertible OD-9=C cleanup, then complete the remaining NF-020 part 2 work and B6 closure on the same long-lived branch and the same PR.

The target is a complete, evidence-backed, merge-ready PR. Do not merge it. The owner will review the final report and approve the merge separately.

The owner has approved the following decisions based on the Cloud Code second opinion:

- `OD-14 = D1`, with the hard gates and stop conditions in this prompt.
- `OD-9 = C`, as a separate commit after the D1 gate and after the no-consumer check.
- Do not raise or weaken any protected ceiling or guard.
- Do not use lucky re-pushes to obtain a passing gzip result.
- The correct long-term root fix is preferred because Micro has no production users and no authoritative production data, but financial, historical, schema, export/import, security, and permission semantics remain protected.

Do not ask routine clarification questions. Continue automatically through every safe phase. Stop only for an explicit stop condition, a protected semantic/security/permission decision not covered here, a permission failure, destructive workspace drift, or an acceptance gate that cannot be corrected safely.

---

## Canonical baseline and continuation contract

Repository: `https://github.com/Qays7753/Micro`

Existing branch: `refactoring/r10b-complete-b1-b6-20261011`

Existing PR: `#356` — `https://github.com/Qays7753/Micro/pull/356`

Reported current branch head at prompt preparation: `e6157c3e1b8a9e4e4b892227a2f74e0ccde8a22a`

Base branch: `main`

At the start, verify live:

1. `main` SHA;
2. the branch full HEAD SHA;
3. PR #356 state, base, head, mergeability, and checks;
4. current worktree status, staged files, untracked files, and local commits;
5. the latest PR comments and the latest R10-B report;
6. the live B5, NF-038, OD-14, and Operations Control records.

Do not trust the supplied SHA if the remote branch has advanced. Preserve valid local or remote work. Never reset, discard, overwrite, or redo completed B1–B5 work blindly.

Do not:

- create another implementation branch;
- create another PR;
- push directly to `main`;
- force-push;
- merge PR #356;
- delete branches;
- perform repository cleanup;
- start the separate post-merge exploratory audit/research phase;
- claim that a local-only change is complete before it has a coherent commit, focused evidence, and a pushed remote commit on this same branch.

If the live state differs from this baseline, reconcile it safely and record the exact difference before continuing. Resume from the first incomplete checkpoint rather than restarting.

Read before writing:

- `AGENTS.md`;
- `docs/architecture/refactoring/ZAI-STRUCTURAL-REMEDIATION-R0-R10-EXECUTION-CONTRACT-20261007.md`;
- `docs/architecture/refactoring/STRUCTURAL-REMEDIATION-PLAN-20261007.md`;
- `docs/operations/control/evidence/structural-remediation-r10-20261011/R10-B-REPAIR-CARDS-2026-10-11.md`;
- `docs/operations/control/evidence/structural-remediation-r10-20261011/R10-B-FINDINGS-MATRIX-2026-10-11.json`;
- `docs/operations/control/evidence/structural-remediation-r10-20261011/R10-B-COMPLETE-B1-B6-EXECUTION-REPORT-2026-10-11.md`;
- `docs/operations/control/evidence/structural-remediation-r10-20261011/R10-B-OWNER-DECISION-PACKAGE-2026-10-11.md`;
- `docs/operations/control/evidence/structural-remediation-r10-20261011/R10-B-UNVERIFIED-RESEARCH-REPORT-2026-10-11.md`;
- `docs/operations/control/workstreams/WS-216.json`;
- `docs/operations/control/items/ARCH-007.json`;
- `docs/operations/current-state.md`;
- `docs/operations/current-state-log.md`;
- `docs/architecture/refactoring/AGENT-SEQUENTIAL-WORKLOG.md`;
- the active ownership, file-size, test, and documentation maps.

---

## Protected invariants

Preserve exactly:

- `localSchemaVersion = 38`;
- `localExportVersion = 30`;
- financial meaning, rounding, classification, and rejection behavior;
- historical interpretation;
- persisted money text;
- IndexedDB/Memory parity;
- CAS and idempotency behavior;
- `storage_stale` behavior;
- backup-before-replace behavior;
- transfer, legacy, import, and golden acceptance contracts;
- raw bundle ceiling `650,000`;
- gzip bundle ceiling `155,300`.

Do not modify financial/domain behavior, storage, routing, visual UI, Schema 38, Export 30 serialization, or historical behavior as part of D1 or OD-9. If a necessary change would affect any protected semantic, stop that slice and create an exact owner-decision package rather than hiding the change.

---

## Phase 0 — Read-only D1 preflight hard gate

Before modifying any file, perform a fresh read-only investigation on the live branch. Use five sequential read-only reviewers and reconcile their results before implementation.

The five reviewer roles are:

1. build/Vite/bundle determinism and gzip measurement;
2. PWA/Service Worker/cache-busting/CSP/Cloudflare;
3. application consumers, diagnostics, Export 30, and semantic compatibility;
4. CI, guards, security, Node/test environments, and reproducibility;
5. architecture, baselines, Operations Control, documentation, rollback, and hostile closure.

Inventory every consumer of build identity, including:

- `VITE_APP_VERSION`, `GITHUB_SHA`, `CF_PAGES_COMMIT_SHA`, and any fallback;
- Vite `define` and HTML transformation;
- `buildIdentity` and all application/UI consumers;
- Export 30 metadata and import preservation;
- diagnostics and error reports;
- workers, Service Worker, Workbox, `cacheId`, revisions, manifests, source maps, and generated assets;
- Node tooling, tests, Vitest environments, and non-DOM execution;
- CI and Cloudflare Pages build paths;
- bundle budget and surfaces guards;
- any whole-object `import.meta.env` use or second identity define.

Verify whether any consumer requires the identity to be an immutable JavaScript constant. If such a consumer exists and cannot be safely mapped to the HTML carrier, STOP and report it as an owner decision blocker.

Verify the NF-038 causal mechanism using the existing guard method and exact production tree where safe:

- same identity and same tree rebuild must be byte-identical;
- differing identities on the same tree must produce identity-independent JS entry/chunk bytes after D1;
- the budget guard must measure the actual manifest-selected `isEntry` JS;
- distinguish identity footprint from identity-driven cascade variance;
- record Node version, gzip method, tree SHA, build command, and artifact SHA.

Verify baselines before writing. If any baseline, ledger, surfaces record, ratchet row, or guard pins the entry or `index.html` size/hash, STOP. Do not silently re-anchor or edit the baseline. Continue only through the existing machine-verifiable reanchor authorization and record the exact owner-approved reanchor.

Phase 0 must produce a report and checkpoint comment before implementation. If the hard gate passes, continue automatically. If it fails, stop with:

`OD14_D1_PREFLIGHT_BLOCKED — OWNER_DECISION_REQUIRED`

---

## Phase 1 — Implement OD-14 D1 as one revertible commit

Implement the root fix, not a size workaround:

- remove build/commit identity from the JavaScript entry;
- carry the same identity value through `index.html` at the release/build boundary, preferably as a meta tag;
- use a small guarded identity getter for the application consumers;
- preserve the existing identity value, formatting, fallback semantics, diagnostics, and Export 30 value;
- keep the source of truth for the identity resolution order explicit and singular.

The implementation may touch only the smallest necessary set of files identified by Phase 0, normally:

- `vite.config.ts` for build identity resolution and HTML injection;
- the existing identity bridge/getter module;
- focused identity tests and static wiring tests;
- the relevant evidence, matrix, ledger, file-size register, and Operations Control source records.

Do not add a runtime-fetched metadata file. Do not add an inline script. Do not change CSP. Do not edit bundle guard logic, ceilings, tolerances, CI workflow, Cloudflare dashboard, financial/domain code, storage, routing, or visual UI.

The implementation MUST include:

1. strict build-time validation of the injected identity;
2. failure on empty, malformed, or unreplaced placeholder values in a production build;
3. safe HTML escaping/allowlist handling before insertion;
4. a guarded DOM read that works in browser runtime and does not throw in Node/Vitest contexts;
5. a fallback equal to the existing test/development identity value, never a real-looking SHA;
6. memoization/read-once behavior where appropriate;
7. a permanent negative test proving the identity is absent from generated JS, CSS, and source-map assets and present exactly once in `index.html`;
8. protection against whole-object `import.meta.env`, a second define, or another identity leak.

Do not allow silent runtime fallback for a missing production meta tag. The production build must fail before artifacts are accepted.

Commit this implementation and its focused tests as one independently revertible D1 commit. Before pushing, inspect the diff and run the local go/no-go measurements below.

---

## Phase 2 — D1 measurement and go/no-go gate

Measure using the guard's own method, the CI-pinned Node version, the exact final D1 tree, and the exact production build command.

Required evidence:

1. raw entry size and gzip entry size;
2. exact entry path selected by the manifest and HTML cross-check;
3. Node version and gzip configuration;
4. tree SHA and identity value;
5. generated artifact SHA/digest;
6. comparison against the pre-D1 artifact;
7. at least 10 differing identities on the same tree proving byte-identical JS entry and chunk sets;
8. at least 30 controlled same-content identity draws to estimate the post-D1 distribution and `σ̂`, using temporary untracked configuration/output only;
9. same-identity rebuild byte identity;
10. a later test-only or documentation-only build showing the D1 entry remains byte-identical.

Hard stop rules:

- If the exact final D1 gzip is greater than `155,300`, do not push the D1 implementation and do not attempt a lucky rerun. Return `OD14_D1_GO_NO_GO — OWNER_DECISION_REQUIRED` with the exact measurement.
- If the measured headroom is below `2σ̂` from the controlled post-D1 distribution, stop before conditional A. Return `OD14_D1_COMPLETE — OWNER_DECISION_REQUIRED — CONDITIONAL_A`.
- Do not treat “approximately 70 bytes” as a requirement or a guess. Any later A decision must be based on measured post-D1 evidence and must be separately authorized.
- If the entry is not deterministic across identity draws, stop: there is another identity leak or build nondeterminism.
- If any unexpected red result appears, diagnose it; do not re-push solely to obtain a green draw.

If D1 passes the hard gate and the statistical headroom gate, push the D1 commit to PR #356 and continue.

---

## Phase 3 — PWA, identity, and contract verification

After D1 passes the measurement gate, prove:

- Export 30 `appVersion` is unchanged for the same identity;
- diagnostics and error reports preserve the same value and format;
- Schema 38 and Export 30 constants and serialization remain unchanged;
- browser runtime can read the meta value;
- Node/Vitest fallback remains stable;
- identity is not present in JS/CSS/source maps;
- identity is present exactly once in `index.html`;
- two builds with different identities have identical JS/chunk content and only the expected HTML/Service Worker revision differences;
- installing build 1, replacing it with build 2, and activating the Service Worker updates the shell correctly;
- an identity-only change triggers the expected PWA update;
- offline reload after activation retains the correct build-2 identity;
- Cloudflare preview/build evidence for the exact pushed head is recorded, and the deployed entry is compared with the CI artifact when the environment makes that possible;
- `index.html` and `sw.js` keep the required revalidation/no-store behavior.

If Cloudflare-side parity cannot be proven from the available environment, label it `UNVERIFIED` and do not claim parity. Continue independent local work only if no protected gate is affected; the final report must identify the exact evidence gap.

Run the five sequential read-only reviewers again on the D1 implementation and reconcile every finding. Fix any current D1-scope defect at root cause before closing the phase.

---

## Phase 4 — OD-9=C as a separate commit

After D1 is accepted by its gates, implement OD-9=C in a separate, independently revertible commit.

Before changing anything:

- search the repository, workflows, deployment configuration, runbooks, and documentation for consumers of the Replit post-merge hook;
- inspect the live OD-9 decision package;
- determine whether the platform itself invokes the hook, not only whether the repository references it;
- preserve fail-closed behavior for unknown or unanchored environments;
- do not convert missing verification into success.

If the no-consumer condition is proven, retire the hook and its register/ratchet rows only through the existing machine-verifiable reanchor authorization. Record exact before/after row counts and map every removed row to the retired hook.

Add or preserve a negative test proving an unrecognized or unanchored environment still fails. Re-run the applicable E-UNV-008 mutation drill and record the expected `6/6` behavior where applicable.

If the Replit platform-side consumer cannot be proven, do not silently claim OD-9 complete. Record `OWNER_DECISION_REQUIRED` with the precise missing evidence, while continuing independent NF-020 work if safe.

Run focused tests and the five sequential reviewers after this separate commit.

---

## Phase 5 — Complete remaining NF-020 part 2

After D1 has passed, continue NF-020 part 2 from the first incomplete item in the live matrix and existing worktree. Do not redo completed B1–B5 work.

For every item:

- inspect the real current state first;
- preserve valid local work;
- fix the root cause, not only the reported symptom;
- maintain the existing contracts and source-of-truth rules;
- record every new finding with a durable ID, evidence, affected consumers, acceptance criteria, and rollback;
- fix current in-scope defects now;
- use an exact protected decision package only for a genuine protected boundary;
- never use generic DEFER, “later,” or “not enough time.”

If NF-020 changes entry-reachable production code, rerun the final D1 bundle measurement after that slice. Do not rely on a prior D1 measurement.

Use coherent commits with focused tests and checkpoint comments. Update source JSON first and regenerate all derived Operations Control views; never edit generated views manually.

---

## Phase 6 — B6 final closure and PR readiness

Complete B6 only after D1 and NF-020 are complete.

B6 MUST:

1. mechanically re-check all 54 `FIX_NOW` IDs, all 16 precise `DEFER` cards, the disproved item, and the five `PRESERVE_BY_DESIGN` cards against the final tree;
2. detect unclassified, duplicate, stale, reopened, or generically deferred findings;
3. verify defect families across their affected consumers;
4. verify every changed file is tested or has a documented owner-backed reason;
5. verify no second source of truth was introduced;
6. verify no protected financial, historical, Schema/Export/Import, rejection, security, permission, or visual change slipped into the PR;
7. close every current defect in active scope with evidence or one exact protected decision package;
8. run five sequential read-only verification agents on the final head;
9. run the full final test and guard chain;
10. measure the final bundle on the exact final head;
11. produce the final PR-ready report and Merge Manifest;
12. leave PR #356 open for owner review.

Do not start a new repository-wide exploratory audit in B6. That is a separate post-merge owner-approved phase.

---

## Five-agent reviewer contract

At each major gate and on the final head, run five sequential read-only reviewers:

1. **Architecture and build boundaries:** source of truth, identity transport, dependency direction, baseline integrity, no hidden scope expansion.
2. **Domain/storage/financial/semantic integrity:** Schema 38, Export 30, financial meaning, history, rejection, IndexedDB/Memory parity, transfer/legacy behavior.
3. **UI/runtime/accessibility/PWA:** DOM fallback, meta availability, Service Worker updates, offline behavior, visual neutrality, runtime errors.
4. **Tests/CI/security/operability:** guard strength, negative proofs, identity leak detection, deterministic measurements, CSP, CI/Cloudflare evidence.
5. **Documentation/Operations Control/hostile closure:** matrix completeness, live pointers, append-only history, exact findings, rollback boundaries, false-closure risks.

Reviewers MUST be read-only. No parallel writers. Reconcile their findings before declaring the gate passed.

---

## Verification commands and evidence

Run focused tests after each slice and the complete repository-required chain on the exact final pushed head. Do not rerun an unchanged green suite merely for appearance, but every new commit must receive the checks required by the repository.

At minimum, record exact commands, exit codes, full SHAs, and limitations for:

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

Also run all focused commands required by the active Repair Cards, including:

- D1 identity consumer and leak tests;
- D1 deterministic multi-identity tests;
- PWA/Service Worker browser tests;
- Export 30 and diagnostics parity tests;
- OD-9 negative guard and mutation tests;
- remaining NF-020 tests;
- final bundle and surfaces measurements;
- Operations Control generation and validation.

For every command report the exact command, exit code, commit SHA, local/CI source, relevant output, and limitations. Do not use a prior SHA's evidence as evidence for the final head.

---

## Operations Control and documentation

Use the canonical source of truth. Update source JSON first, then run the official generator and validator. Do not manually edit generated Markdown, CSV, or XLSX views.

Preserve append-only logs. Do not rewrite historical entries. Every new finding, decision, reanchor, commit, test, and stop condition must be recorded durably.

The final report must state separately:

- verified facts;
- inferences;
- unverified claims;
- not executed work;
- intentionally deferred work;
- blockers;
- exact files and commits changed;
- exact rollback boundaries;
- remaining owner decisions.

---

## Final delivery contract

When all permitted work is complete:

1. push all implementation, test, record, and evidence commits to the existing branch;
2. keep PR #356 open;
3. do not merge PR #356;
4. do not create another branch or PR;
5. do not delete branches;
6. do not begin the post-merge exploratory audit;
7. post a concise checkpoint comment for every coherent commit;
8. return one unified final report and exact Merge Manifest.

The report must include:

- repository, branch, PR, base SHA, and final full HEAD SHA;
- all commits and their scopes;
- Phase 0 findings and five-reviewer reconciliation;
- D1 implementation and go/no-go measurements;
- identity consumer inventory;
- PWA/Service Worker/Cloudflare evidence;
- OD-9 consumer check and separate commit status;
- NF-020 remaining work and closure;
- B6 matrix reconciliation;
- all tests, exit codes, CI runs, and Cloudflare status;
- final raw/gzip bundle measurements;
- confirmation that Schema 38 and Export 30 are unchanged;
- confirmation of no visual redesign, financial, historical, storage, routing, or rejection changes;
- rollback boundaries for D1, OD-9, NF-020, and the full PR;
- all remaining owner decisions.

Use the appropriate final status:

```text
R10B_D1_OD9_NF020_B6_COMPLETE — PR_READY
```

or:

```text
R10B_D1_COMPLETE — OWNER_DECISION_REQUIRED — CONDITIONAL_A
```

or:

```text
R10B_D1_OD9_NF020_B6_COMPLETE — PR_READY — OWNER_DECISION_REQUIRED — OD-9
```

Do not claim PR readiness if a current defect, failed gate, missing evidence, or protected decision remains hidden.

After the final report, stop with:

`NO_FURTHER_WRITES — NO_MERGE — NO_CLEANUP`

---

## Secure credential rule

Use the GitHub access credential available through the secure credential field associated with this conversation only for required repository operations and push operations.

Never print, paste, store, commit, log, expose, or include the credential in chat, prompts, files, URLs, commands, PR comments, reports, screenshots, or test output.
