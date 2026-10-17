# Micro R11 — Continue From Lock Remediation Through All Remaining Approved Waves
## Unified ZAI Continuation and Execution Contract — 2026-10-15

## 1. Mission

Continue the Micro R11 program from the live state of the existing lock-remediation PR and complete **all remaining approved R11 work that can be executed within the owner-approved contracts**, on the **same long-lived branch and the same PR #368**, without merging it.

Do not stop after correcting the report. Do not stop after the lock-remediation records are reconciled. Continue sequentially through the remaining R11 workstreams, with coherent commits, a checkpoint comment after every wave, focused tests after every wave, and the full verification gate at the end. At the end, leave one reviewable PR containing the complete evidence package for the owner and stop at `PR_READY`.

The required order is:

1. reconcile the lock report and final-head evidence;
2. complete `ARCH-010` Diagnostics Storage hardening;
3. complete W2a Transfer characterization, registry-driven count evidence, and Preserve P-05 evidence;
4. complete W2b current-pair unknown-key enforcement only after its exact error payload and corpus gates are satisfied;
5. complete W3 Application boundary/source-of-truth guards without mass moves or barrels;
6. complete W4 accessibility semantics-only work in the approved order;
7. perform the W5/MoneyMinor trigger audit and close W5 by policy unless a real approved trigger is proven;
8. run the final hostile verification, five sequential read-only reviews, records reconciliation, and final PR-ready report.

**Do not merge. Do not delete branches or PRs. Do not clean up. Do not write directly to `main`.** The owner will review the complete result only after this unified execution reaches its final report.

This is a controlled remediation program, not permission for blind mass refactoring. Every wave must stay within its contract, use a separate commit boundary, and preserve all protected semantics.

## 2. Live repository and continuation baseline

Repository:

```text
https://github.com/Qays7753/Micro
```

Existing implementation branch:

```text
security/r11-lock-fail-closed-20261015
```

Existing implementation PR:

```text
https://github.com/Qays7753/Micro/pull/368
```

Base branch:

```text
main
```

Last live-verified PR head when this contract was prepared:

```text
09c31887525cff4d118c20c277830c98946e0b62
```

Last live-verified base SHA:

```text
9303ea445cc4f3ee87d7a4514e3e9d47d608d339
```

The PR was live-verified as `OPEN`, `MERGEABLE`, and `CLEAN`, with CI and Cloudflare Pages successful on `09c31887525cff4d118c20c277830c98946e0b62`.

Verify all of these values live before writing. The prompt values are checkpoints, not permission to ignore drift.

If PR #368 has already been merged, closed, or materially changed by another actor, stop with `STATE_DRIFT` and report the exact state. Do not create a replacement PR or silently switch branches. If the branch has new commits, preserve them and continue from the latest verified remote head; never reset, discard, force-push, or overwrite work.

## 3. Governing documents and owner decisions

Before any write, read the current versions of:

```text
AGENTS.md
docs/00-document-index.md
docs/operations/current-state.md
docs/operations/current-state-log.md
docs/operations/control/README.md
docs/operations/control/generated/AGENT-BRIEF.md
docs/architecture/refactoring/AGENT-SEQUENTIAL-WORKLOG.md
docs/architecture/refactoring/r11-wave0-20261013/R11-W0-STRUCTURE-ARCHITECTURE-CONTRACT-SCAN-REPORT-2026-10-13.md
docs/architecture/refactoring/r11-s0-w1a-20261013/R11-OWNER-DECISION-PACKAGE-2026-10-13.md
docs/architecture/refactoring/r11-s0-w1a-20261013/R11-S0-W1A-EXECUTION-REPORT-2026-10-13.md
docs/architecture/refactoring/r11-w1b-20261014/R11-W1B-EXECUTION-REPORT-2026-10-14.md
docs/contracts/37-local-app-lock-contract.md
docs/quality/security-boundaries.md
docs/architecture/refactoring/r11-lock-fail-closed-20261015/R11-LOCK-FAIL-CLOSED-EXECUTION-REPORT-2026-10-15.md
docs/architecture/refactoring/r11-lock-fail-closed-20261015/R11-LOCK-FIVE-REVIEWER-RECORD-2026-10-15.md
docs/operations/control/items/ARCH-010.json
docs/operations/control/items/ARCH-011.json
docs/operations/control/workstreams/WS-218.json
docs/operations/control/workstreams/WS-219.json
```

The following owner decisions are already approved and must be executed exactly within their boundaries:

- `OD-LOCK-ROLLBACK=A`: device-clock rollback or unverifiable active-backoff time fails closed.
- `OD-LOCK-STORAGE=A`: storage-read uncertainty at `AppLockGate` is unreadable, inert, recoverable, and never open.
- `OD-LOCK-SEMANTICS=A`: only real recent input renews visible-app activity; passive evaluation never renews it.
- `OD-GUARD=A`: guards/ratchets for D-01, D-03, D-04, and D-05; no ceiling increase.
- `OD-MONEY=A`: keep `MoneyMinor = number` for now; enforce monitoring/guards; W5 is trigger-gated and not opened by hypothetical risk.
- `OD-10=A`: narrow leaf/shared infrastructure exemptions plus house-pair ratchet and cycle checks; no barrels or blanket allowlists.
- `OD-KEYS=A`: current `(Schema 38, Export 30)` unknown top-level keys may be rejected only after characterization, allowed-set proof, exact error contract, and precedence proof; Legacy remains unchanged.
- `OD-COUNTS`: registry-driven test-side oracle for all 31 families over IndexedDB and Memory; no Export 30 changes.
- `OD-TIME`: AST-bound effect-class guard; no broad clock injection; lock behavior is handled by the separate lock-remediation contract already in this PR.
- `OD-SEC=A+C`: one-time history scan plus scheduled/manual non-blocking workflow where the approved scope requires it; no history rewrite.
- `OD-LABEL=A`: keep `fieldLabelAr` in Domain and migrate only byte-identical consumers; no Arabic copy change.
- `OD-A11Y=B`: classify interaction models, then D-14, D-13, D-15; semantics/focus/inert/restore only; no visual redesign; `AppLockGate` remains the lock oracle and is not reworked in W4.
- `OD-PRESERVE=A`: preserve P-01..P-05; pay evidence debt with tests/docs only; no split/move/transaction/rejection/schema changes.
- `OD-RECORD=A`: append-only evidence governance; never silently rewrite old findings or historical records.
- `S-1`: rename only the non-financial/page-local meaning after caller census, preserving the financial/date-owned meaning.
- `S-2`: opaque/phantom `PreparedImport` brand with one mint boundary and compile-time negative tests; no runtime wire change.

Do not reopen R2 D11/D13, R10-B, Schema 38, Export 30, Legacy/Current/Golden compatibility, financial semantics, Transfer rejection precedence, or the completed architecture-scan owner gate.

## 4. Security and write boundary

Use exactly one writer: the ZAI executor. Use five sequential read-only reviewers only after the implementation slices are complete. Reviewers MUST NOT edit, commit, push, merge, delete, or rerun workflows.

All writes are restricted to the existing branch and PR #368. Never write directly to `main`.

Credential boundary: `GITHUB_ACCESS_TOKEN=<SECURE_SECRET_FIELD_ONLY>`.

Use the secure GitHub credential field only. Never print, paste, store, commit, echo, or report the real token, token prefix, cookie, authorization header, or any secret value.

Do not merge PR #368. Do not delete branches, PRs, evidence, history, or worktrees. Do not force-push. Do not reset or discard work. Do not hide a behavior change in a documentation-only commit.

The product has no users and no authoritative production data, so choose durable root fixes within the approved boundaries. That does **not** authorize silently changing protected financial, historical, Schema/Export/Import, Legacy, Transfer, rejection-precedence, security, or UI semantics.

## 5. Global non-negotiable invariants

The following must remain unchanged unless a separate owner decision is explicitly recorded and the prompt explicitly authorizes it:

- `localSchemaVersion = 38`.
- `localExportVersion = 30`.
- all supported Legacy pairs.
- Current/Golden/MANIFEST compatibility.
- 130 storage methods and IndexedDB/Memory parity.
- transaction atomicity and `storage_stale` identity.
- Transfer multi-fault/rejection precedence.
- financial calculations, snapshots, money representations, and historical meaning.
- PWA/build identity D1 behavior.
- bundle ceilings: raw `650000`, normalized gzip `155300`.
- lint ceiling `37`; never raise it.
- no silent secret/history changes.
- no Arabic copy, RTL, layout, tokens, navigation, or visual redesign.
- no generic `DEFER`.
- no blanket allowlists.
- no barrels or blind bulk moves.
- no untracked new finding.

Every new finding must receive a durable ID and one of `FIX_NOW`, `PRESERVE`, `OWNER_DECISION_REQUIRED`, `OUT_OF_SCOPE`, `FALSE_POSITIVE`, `DUPLICATE`, or `DEEPENS`, with evidence, root cause, affected surfaces, acceptance, and rollback. `DEFER` alone is forbidden.

## 6. Phase 0 — live continuation inventory and lock-report correction

Before any new implementation:

1. Fetch the current PR branch and verify the exact remote head.
2. Inspect worktree status, unpushed commits, PR comments, checks, and changed files.
3. Confirm that the lock code and all lock records are present and no new work has been overwritten.
4. Reconcile the canonical lock report so every statement about the final PR head uses the actual current head. In particular, replace stale references to `97b31af78e1ae8bd810a4991248e4edc65693a8a` as the final PR head with the actual final head after the correction commit. Keep `469aba03...` as the code-head used for the full implementation gate where that is factually correct, but distinguish:
   - code verification head;
   - final PR/documentation head;
   - exact CI head;
   - exact Cloudflare head.
5. Verify the exact CI and Cloudflare check URLs for the final head. At the time of this contract, the verified final head is `09c31887525cff4d118c20c277830c98946e0b62`, CI is `checks` run `38652888640`, and Cloudflare Pages is successful on that exact SHA. Re-query rather than copying these values blindly.
6. Update only the relevant canonical report, checkpoint comment, and live state/evidence references. Preserve all historical heads as historical evidence.
7. Run the documentation/Operations Control checks and commit this correction as a clearly named checkpoint.

Exit condition:

```text
R11_LOCK_REPORT_RECONCILED — VERIFIED
```

Do not stop here. Continue automatically to Phase 1 after this phase passes.

## 7. Phase 1 — ARCH-010 Diagnostics Storage hardening

Execute `ARCH-010` as the next independent remediation slice. The current finding is `R11-W1A-NF-001`: `localDiagnosticsService.ts` directly obtains browser `localStorage` outside a registered storage boundary.

### Required investigation

1. Build a complete repository-wide web-storage census before writing:
   - `localStorage`;
   - `sessionStorage`;
   - IndexedDB and wrappers;
   - direct `globalThis.*Storage` access;
   - tests, tooling, workers, browser-only adapters, and documentation references.
2. Record exact method, scope, parser/tool version, command, base SHA, date, output hash, and reviewer.
3. Distinguish financial/local domain storage from non-financial diagnostics storage. Do not route diagnostics through `PrototypeLocalStore`, financial adapters, export/import, or the 130-method financial/local storage contract merely to silence the guard.

### Root fix

Implement an explicit, narrow Diagnostics Storage boundary:

- the application diagnostics service consumes its injected `DiagnosticStorage` port;
- the browser adapter is located in an explicit diagnostics/infrastructure boundary rather than being an unregistered direct storage access inside the application service;
- the boundary is registered in the dedicated diagnostics storage guard;
- the guard is fail-closed and permits only the exact registered entry/adapter, not a generic `localStorage` allowlist;
- storage unavailable, malformed, quota, or read/write failure remains fail-safe and preserves the existing diagnostic contract: no throw, no network, no automatic upload, no sensitive data.

First inspect the live architecture and choose the smallest root-correct location consistent with existing module boundaries. Do not move unrelated files or perform structural cleanup.

### Required tests and evidence

- registered-entry positive test for the intended diagnostics adapter;
- negative tests for a new unregistered direct `localStorage`/`sessionStorage` access;
- path/alias/formatting variants that try to bypass the guard;
- storage unavailable and quota/failure behavior;
- proof that diagnostics remain local and non-financial;
- proof that no Schema/Export/Import/Legacy/Transfer behavior changed;
- no sensitive payload, stack, name, amount, PIN, salt, or raw exception text enters the record.

Update `ARCH-010` and its Workstream with the actual IDs and evidence. Do not falsely mark it closed until the census, guard, negative tests, and CI are complete.

Commit boundary:

```text
R11-ARCH010-DIAGNOSTICS-STORAGE-ROOT-FIX
```

Run focused tests, all relevant guards, Operations Control validation, and `git diff --check` before proceeding.

## 8. Phase 2 — W2a Transfer characterization and evidence closure

Execute W2a before any behavior flip. W2a is evidence-first and must not silently change the wire format.

### Required corpus

Build and record a complete matrix for:

- Current `(Schema 38, Export 30)` valid files;
- all supported Legacy pairs;
- all 27 Golden files and MANIFEST;
- exporter-generated files;
- importer fixtures;
- unknown top-level keys;
- non-family top-level keys emitted by any exporter;
- malformed values;
- multi-fault inputs and first-rejection precedence;
- IndexedDB and Memory round-trips where the contract requires it;
- Transfer family validator coverage;
- `confirmImport` callers and PreparedImport flow;
- P-05 `transferFamilyValidators` and ADR-017 evidence.

### OD-COUNTS

Implement the owner-approved test-side registry-driven oracle:

- cover all 31 families;
- exercise IndexedDB and Memory;
- prove `registry == oracle` with a meta-test;
- record the current 22/31 asymmetry in ADR-017 as evidence, not as an Export field;
- do not add count fields to Export 30;
- do not modify Goldens, MANIFEST, Legacy, or Schema 38.

### OD-KEYS characterization

Derive the allowed top-level set from the canonical 31-family registry plus any legitimate non-family keys emitted by the current exporter. Prove the set against the complete exporter corpus. Characterize the current behavior and all rejection precedence interactions before enabling strict rejection.

Commit boundary:

```text
R11-W2A-TRANSFER-CHARACTERIZATION-AND-EVIDENCE
```

Exit condition:

```text
R11_W2A_CHARACTERIZATION_COMPLETE — OWNER_PAYLOAD_GATE_RECORDED
```

The evidence phase must be completed even if a later exact error payload is missing.

## 9. Phase 3 — W2b current-pair unknown-key enforcement

The owner-approved behavior direction is strict rejection only for the declared Current `(Schema 38, Export 30)` pair. Legacy remains unchanged.

Before changing behavior, prove all of the following:

1. the complete Current exporter corpus produces no unintended unknown keys;
2. all Legacy pairs and Goldens remain accepted exactly as before;
3. validation order and first-rejection precedence remain unchanged for all pre-existing faults;
4. the allowed set is generated from the registry and is not a hand-maintained broad allowlist;
5. the exact error code and Arabic copy are recorded in the canonical owner-decision addendum and evidence before the user-visible behavior flip;
6. negative tests prove an unknown key in Current is rejected and that Legacy behavior is unchanged;
7. no key name or sensitive payload is echoed in the error;
8. round-trip preservation of unknown keys is not introduced.

The owner package contains a draft Arabic message, not an automatically approved final payload. Do not invent or silently approve a new user-visible error code/copy. If the exact payload is absent, record:

```text
R11_W2B_BEHAVIOR_BLOCKED — EXACT_ERROR_PAYLOAD_OWNER_DECISION_REQUIRED
```

Then continue all independent safe phases and evidence work; do not stop the whole run for a routine question. Do not claim W2b behavior is complete until the payload gate is satisfied.

If the exact payload is already present and approved in the live canonical records, implement it in a separate behavior commit and prove the full matrix again.

Commit boundary:

```text
R11-W2B-CURRENT-PAIR-UNKNOWN-KEY-GATE
```

## 10. Phase 4 — W3 Application boundaries and label source of truth

Execute only the approved guard/source-of-truth scope. This phase is not permission for a broad structural refactor.

### OD-10 boundary guard

- Recompute the complete live Application house-edge graph and SCCs.
- Preserve the visible census, including any legitimate new edge introduced by prior approved work.
- Keep only the narrow owner-approved exemptions for `time`, `formatting`, `identity`, and `resultCodes.ts` after invariant checks.
- Apply house-pair ratchets to governed edges.
- Keep value/type caps separate.
- Add value-cycle checks at house level.
- Do not use barrels, mass import rewrites, blanket per-edge allowlists, or cosmetic moves.
- Do not move `materialUnitLabels` or `paymentSourcePolicy` merely to make a count pass.

### OD-LABEL source of truth

- Census every relevant label consumer.
- Compare UTF-8 bytes and code points, not visual similarity only.
- Keep `fieldLabelAr` in Domain.
- Migrate only consumers whose strings are byte-identical and whose edge remains contract-neutral.
- Preserve every intentional variant and record it as a separate owner decision instead of normalizing it.
- Add DOM text and duplicate-literal tests.
- No Arabic copy, RTL, layout, token, or navigation changes.

Because the post-Group-6 structural gate is mandatory, do not perform structural refactoring, bulk moves, or code-organization changes unless the already accepted Wave 0 findings explicitly authorize the exact change. If a proposed change exceeds guard-only or byte-identical source-of-truth work, record it as a new precisely scoped owner gate instead of guessing.

Commit boundary:

```text
R11-W3-BOUNDARIES-AND-LABEL-SOURCE-OF-TRUTH
```

## 11. Phase 5 — W4 accessibility semantics-only track

Execute the approved sequence:

```text
W4-0 interaction-model classification
→ D-14 overlay focus/inert/restore
→ D-13 inline dialog semantics
→ D-15 itemization and disposition
```

Rules:

- semantics, focus, inertness, restore, Escape, accessible name/description, and tests only;
- focus trap only for a true modal;
- no focus trap for non-modal panels, disclosure, regions, or inline surfaces;
- classify every surface before changing it;
- preserve Arabic copy and visible headings unless a separate exact payload is approved;
- preserve RTL tab order;
- use browser/DOM tests where required;
- do not modify `AppLockGate` as part of W4; the lock remediation is already handled in this PR and remains the oracle;
- no CSS, layout, tokens, navigation, visual redesign, or third-party modal library;
- every residual receives `FIX_NOW`, `PRESERVE`, `OUT_OF_SCOPE`, or an exact owner decision; never generic `DEFER`.

Commit boundaries:

```text
R11-W4-0-INTERACTION-MODEL-CENSUS
R11-W4-D14-OVERLAY-SEMANTICS
R11-W4-D13-INLINE-SEMANTICS
R11-W4-D15-RESIDUAL-DISPOSITIONS
```

Run focused browser/DOM tests after each commit and the full application suite before leaving W4.

## 12. Phase 6 — W5/MoneyMinor trigger audit and closure

Execute the W5 gate audit even if no branding wave opens.

- Re-run the complete MoneyMinor casts/unit-mixing/persisted-writer census.
- Confirm integer kernels, sole persisted formatter, frozen writer surface, and money-layer guard.
- Confirm there is no proven unit-confusion defect, second currency/unit, raw number reaching a persisted money writer, or mixing that existing guards fail to prevent.
- If no approved trigger exists, record `W5_CLOSED_BY_POLICY — NO_TRIGGER_PROVEN` and do not create a branding wave.
- If a real trigger is proven, do not silently implement branding. Record the exact owner gate and scope; do not change runtime/persisted representation or Schema/Export without a separate approved contract.

This phase is complete when W5 is either closed by evidence-backed policy or held by a precise owner decision, never when it is silently ignored.

## 13. Per-phase verification and checkpoint protocol

After every phase or commit boundary:

1. run the smallest focused tests for the changed surface;
2. run relevant guard/validator checks;
3. run `git diff --check`;
4. inspect changed files and compare against the allowed boundary;
5. record exact SHA, commands, exit codes, and evidence class;
6. post one concise PR checkpoint comment;
7. continue automatically to the next independent phase.

Do not rerun unchanged green checks gratuitously, but every new commit must receive the checks required by its changed surface. Never suppress, skip, weaken, or re-anchor a guard merely to continue.

If a phase encounters a true protected decision gate, record the exact gate and continue independent work. Do not ask routine questions. Do not infer owner approval from the instruction to continue.

## 14. Final verification gate

On the final PR head, run and record the exact exit code for all applicable commands:

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

Also run focused suites for:

- lock remediation;
- diagnostics storage guard and failure behavior;
- Transfer Current/Legacy/Golden and registry oracle;
- PreparedImport and confirmImport;
- Application boundary graph/cycle guard;
- label source-of-truth and DOM text;
- W4 accessibility semantics;
- MoneyMinor trigger audit.

Protected measurements must remain within:

```text
raw <= 650000
gzip <= 155300
lint warnings <= 37
```

No baseline or surface re-anchor is valid unless the guard’s own documented protocol is followed, the exact before/after measurement and root cause are recorded, and the change remains inside an approved phase.

Verify CI and Cloudflare against the exact final PR SHA. Do not claim provider parity from a generic successful URL or from an older SHA.

## 15. Five sequential read-only reviewers at the end

After all executable phases are complete, run exactly five sequential read-only reviewers over the complete PR diff and evidence:

- `RV1` — architecture/module boundaries and structural-gate compliance;
- `RV2` — storage/domain/financial/Transfer/Schema/Export/Import integrity;
- `RV3` — runtime/UI/accessibility/security/time behavior;
- `RV4` — tests/CI/guards/bundle/security/operability;
- `RV5` — contracts/documentation/Operations Control/owner-decision traceability.

Each reviewer must state `PASS`, `PASS_WITH_REMEDIATION`, or `BLOCKER`, with file/line/evidence references. The synthesizer must reconcile disagreements explicitly. Any unresolved blocker prevents `PR_READY`.

## 16. Required final records

Update canonical sources before generated views:

- R11 unified execution report with all phases and exact final-head references;
- lock report correction showing the real final PR SHA;
- `ARCH-010` and its Workstream;
- W2a/W2b findings, ADR-017, Transfer evidence, and exact payload decision if implemented;
- W3 boundary/label evidence and censuses;
- W4 classification and evidence;
- W5 trigger audit;
- `docs/operations/current-state.md` with only live state and next action;
- `docs/operations/current-state-log.md` append-only;
- `docs/architecture/refactoring/AGENT-SEQUENTIAL-WORKLOG.md` append-only;
- Operations Control source JSON first, then generated Markdown/CSV/XLSX views;
- `docs/00-document-index.md` for every new authoritative report/evidence file.

Never rewrite or erase historical records. Preserve old SHAs as historical evidence and distinguish them from the final PR SHA.

## 17. Final report contract

Produce one unified canonical report under:

```text
docs/architecture/refactoring/r11-complete-20261015/
```

The report must include:

1. continuation baseline and exact live state;
2. lock report correction and final-head reconciliation;
3. phase-by-phase scope, commits, files, tests, gates, and evidence;
4. ARCH-010 census, root fix, guard, negative tests, and outcome;
5. W2a complete Transfer matrix and OD-COUNTS evidence;
6. W2b behavior outcome or exact payload blocker;
7. W3 boundary/label census and evidence;
8. W4 interaction model and semantics-only evidence;
9. W5 trigger audit and closure status;
10. all findings and newly discovered IDs with classification and disposition;
11. protected-surface impact matrix;
12. exact CI and Cloudflare URLs for the final SHA;
13. five reviewer verdicts and synthesizer reconciliation;
14. rollback boundary for every phase and the whole PR;
15. all not-executed/owner-gated items stated honestly;
16. final Merge Manifest marked `NOT_EXECUTED`;
17. exact owner action after review.

Every material statement must be labeled as one of:

```text
VERIFIED
INFERRED
UNVERIFIED
NOT_EXECUTED
OWNER_DECISION_REQUIRED
BLOCKER
```

Do not claim `R11_COMPLETE` if a required executable phase failed or an unapproved protected behavior remains hidden. If W2b cannot legally be flipped without the exact payload, state the precise blocker while still reporting all independent phases that were completed.

The final PR checkpoint must contain one honest status:

```text
R11_ALL_APPROVED_WAVES_COMPLETE — PR_READY
```

or:

```text
R11_EXECUTION_BLOCKED — <precise blocker>
```

Also include:

```text
NO_MERGE_PERFORMED
NO_CLEANUP_PERFORMED
NO_SECRETS_EXPOSED
```

Do not stop for routine questions. Continue from the live checkpoint through every executable phase on the same branch and PR, with tests and evidence after every phase. Stop only for real state drift, missing permission, failed required gate, protected-surface conflict, or an owner decision that materially changes user-visible, financial, historical, Schema/Export/Import, Transfer, or security semantics.
