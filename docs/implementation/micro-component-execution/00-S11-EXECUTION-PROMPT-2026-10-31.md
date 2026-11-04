# Micro S11 — Owner-Directed Execution Order

- **Date:** 2026-10-31 (Amman)
- **Repository:** `Qays7753/Micro`
- **Only implementation branch:** `components/integration-20261027`
- **Only pull request:** #383 — keep Draft
- **S11 preparation base / last verified remote head before publishing this order:** `5423980722a3a0251bc8a033d5d7b2afba698356`
- **Program base (`main`, read-only):** `3584aa1d08cea3e0a00623b719fed7f991ce187f`
- **S10 code candidate:** `c73dacb2bac3aa5b24726f82751f3bf326a91a8d`
- **S10 tested code tree reported by ZAI:** `3c69c6db9144a5d373a31cde55a7346e60ed732e`
- **S10 result record:** `docs/implementation/micro-component-execution/15-S10-RESULT-2026-10-31.md`

**Order:** In this same ZAI conversation and on the same integration branch/PR, first resolve the independently confirmed S10 finding `S10-MR-001` at its root and record a durable regression. Then proceed directly to S11 (UNIT-004/005/026 sale slice + SH-15) and complete it. Do not wait for an intermediate owner review or approval between the fix-first work and S11. The owner’s order to execute this prompt is not acceptance of S10, S11, S08, or S09, and is not permission to merge.

Publishing this file is documentation only. Execution starts only when the owner sends ZAI the short start message referencing this file; once received, do not pause for another approval between the S10 fix and S11.

## 1. Owner direction, stage truth, and execution boundaries

1. The owner directed this connected repair-then-S11 execution. Do not ask for routine clarification or another approval between the repair and S11. Do not stop for fixable documentation, tracker, test, formatting, local CI, GitHub Actions, Cloudflare Pages, bundle-surface, or ordinary implementation defects; repair them at root and continue.
2. S10 remains `DELIVERED_FOR_REVIEW / REVIEW_REQUIRED` and pending independent review plus owner acceptance. Record the S10 finding and its resolution in an append-only S10 review addendum and the official Control records. Do **not** mark S10 accepted, verified, merged, or complete on `main`.
3. S08 and S09 also remain pending their own independent review and owner acceptance. Do not rewrite their history or change their state to accepted.
4. S11 is a separate phase with its own commits, Control claim, evidence, result, and review status. Do not combine the S10 fix and S11 product work into a single commit. Do not change the S10 code candidate’s history; append new commits only.
5. Stop only for a genuine blocker that cannot be safely resolved within the approved contracts: an irreconcilable financial/product/data/security-contract conflict, loss or corruption risk that cannot be contained, or a required external capability unavailable after reasonable recovery. If one occurs, preserve and commit safe completed work, continue any independent safe S11 work, and report exact evidence and next action. Do not self-approve a stage or claim green checks that did not run on the exact head.

## 2. Mandatory repository and branch boundaries

- Use only `components/integration-20261027` and PR #383. No additional branch or PR.
- Never write to `main`, merge, rebase, force-push, delete branches, close the PR, or change its Draft state. Commits append to the same branch; no intra-branch merge is needed.
- Before any write, load the repository instructions from `AGENTS.md`, current-state and Operations Control sources, the generated agent brief, and `02-PROGRESS-AND-HANDOFF.md`. Read the relevant CORE+FIN, CORE+STORAGE, CORE+UI, CORE+QUALITY, and CORE+OPS context packs as routed by the current `AGENTS.md`; read only the relevant sections of each source.
- **Post-Group 6 structural gate:** do not perform structural refactoring, bulk moves, broad file splits, mass renaming, or code-organization work in this execution. The mandatory read-only comprehensive Structure/Architecture/Code Organization Scan and owner decision gate must precede any such work. If a structural change appears necessary, document the reason and stop that structural change; do not smuggle it into S11.
- No semantic/financial changes hidden in structural work. Preserve existing dependency and layer guards; do not weaken tests, guards, thresholds, budgets, allowlists, or bundle ceilings.
- Never paste, print, commit, or log access tokens, credentials, or other secrets.

## 3. Required first reply and safe continuation

Continue in the current ZAI conversation; do not restart from scratch or discard local context. Before continuing, send one concise status update with:

1. Current local branch, full HEAD, upstream relation, dirty/untracked files, unpushed commits, and whether the local tree contains valuable work not present on GitHub.
2. Current remote `main`, integration-branch head, PR #383 state/base/head, and exact-head GitHub Actions/Cloudflare status.
3. A short computer load/space/leftovers assessment, relevant tools/skills available, why remaining work may take time, and a realistic time range labeled as an estimate, not a promise.

Then continue immediately without waiting for a response. Inspect before cleanup. Preserve all valuable local/unpushed work. Never reset, discard, `git clean`, rebase, force-push, or delete repositories/branches. Remove only generated, untracked, unused artifacts proved unrelated and safe to remove; report what was removed. If local and remote differ, fetch and inspect. Fast-forward only when safe; if histories diverge, preserve both and reconcile without rewriting history.

## 4. Live provenance and exact starting point

1. Verify that `main` is still `3584aa1d08cea3e0a00623b719fed7f991ce187f`; it is read-only. Verify the integration branch, PR #383 open/Draft/base/head, open PR inventory, and latest PR comments.
2. The last verified remote head before this prompt was `5423980722a3a0251bc8a033d5d7b2afba698356`. This head includes S10 delivery/re-anchoring records; it is **not** the S10 code-candidate SHA. Fetch the live branch after this prompt publication and record the actual full execution-start SHA and the prompt-publication SHA separately. If the branch advanced, inspect and preserve the newer work; never assume this pinned SHA is still the current head.
3. Verify S10’s candidate, tested tree, final records head, local test evidence, and exact remote gate evidence from the current result and PR. Do not attribute the local suite run to a later documentation-only or surface re-anchor commit unless the evidence says it ran there.
4. Verify the status of `DOC-019`/`WS-235`; preserve their review-required state and the owner-acceptance pending action. Before starting S11 code, verify whether `DOC-020`/`WS-236` are free and legal to use. If not, choose the next valid unused IDs and explain. Resolve any genuine Control overlap through its legal procedure; never bypass validation or edit generated tracker views manually.

## 5. Fix first — `S10-MR-001` saved-T01 idempotency race

### Independent finding and evidence

The S10 implementation claims that repeating the same T01 save operation returns the same saved calculation without a second record. The current code has a check-then-write gap:

- `apps/prototype-web/client/src/application/estimates/planningCalculationLifecycle.ts`: `savePlanning` calls `listCostEstimates()`, searches `createdOperationKey`, then separately calls `saveCostEstimate()` with a new estimate ID.
- `apps/prototype-web/client/src/storage/local/MemoryLocalStore.ts`: `saveCostEstimate` writes by estimate ID only.
- `apps/prototype-web/client/src/storage/local/IndexedDbLocalStore.ts`: `saveCostEstimate` delegates to a primary-key `writeOne` by estimate ID; the operation key is not an atomic uniqueness guard.
- `apps/prototype-web/client/src/application/estimates/costEstimateService.s10.test.ts`: the existing `op-dup` regression awaits the first save before making the second call; it proves sequential retry only, not overlapping calls.

Two simultaneous `savePlanning(input, sameOperationKey)` calls can both complete the listing before either has written, each see no prior record, then persist separate IDs. Therefore the no-duplicate property is not protected at the persistence boundary. Treat this as a confirmed code-level concurrency gap, not a test failure already observed. Do not call S10 accepted merely because its existing sequential test and CI passed.

### Required root fix and acceptance

1. First add a deterministic characterization/regression that invokes the same operation key concurrently (`Promise.all` or an equivalent controlled barrier) through separate application-service instances against **both** `MemoryLocalStore` and `IndexedDbLocalStore`/fake IndexedDB. Before the fix, the test must demonstrate the race or otherwise show the missing invariant; do not fabricate an expected failure if a live code path proves otherwise.
2. Implement the smallest correct fix at the application/storage commit boundary so a single operation key cannot create two T01 estimate records under concurrent calls. Use the existing architecture and the narrowest suitable capability/transaction. Memory and IndexedDB must implement the same observable contract. Do not add a generic store or structural refactor. Do not add a schema/export version bump or a new persistent family merely for convenience; if an actual permanent-format change proves indispensable, complete and document the full compatible migration and all supported import/export pairs in this same execution before proceeding.
3. Keep same-key/same-input retries returning the one saved record. Also test same-key/different-input behavior: it must not silently return an old saved record as though the changed input had been saved. Return the existing contract’s explicit conflict/failure or otherwise use a new explicit intention only after the prior outcome is known. Preserve form input and never create a second record to evade an unresolved/unknown result.
4. Verify focused tests on Memory and IndexedDB, including sequential retry, concurrent retry, changed-input retry, no-op, and storage failure behavior. Add durable tests and report exact commands/results. Do not weaken tests or rely on a UI disabled button as the only duplicate guard.
5. Commit the S10 root fix separately. Add `docs/implementation/micro-component-execution/15a-S10-REVIEW-ADDENDUM-2026-10-31.md` (or the next unused clearly ordered S10 addendum name) recording finding ID, evidence, root cause, behavior before/after, regression tests, exact code/test SHAs, and that S10 remains pending independent review/owner acceptance. Keep `DOC-019` at `IN_REVIEW` and `WS-235` at `REVIEW_REQUIRED` unless the official validator requires another legal review-pending transition; any legal transition must still preserve pending independent review and owner acceptance. Update only JSON source and regenerate views through official procedures; never mark `VERIFIED` or accepted.
6. Run the applicable Control/tracker validators after JSON changes. Then proceed directly to S11; do not wait for an interim S10 acceptance gate.

## 6. S11 authority and exact scope — UNIT-004, UNIT-005, UNIT-026 sale slice, SH-15

Use the live S11 card in `docs/implementation/micro-component-execution/01-STAGES.md` and fully read the current normative sections of UNIT-004, UNIT-005, UNIT-026 (A/B, P3, B-DUP, acceptance), the shared financial/data contract, shared SDF cases, approved decisions, and the current source code. Do not rely on old source-SHA file maps as proof of current behavior.

S11 owns the shared collection contract/core and the direct-sale adapter only. It does **not** implement the order-payment adapter, opening/legacy receivable adapter, or a general debt ledger; those belong to later authorized stages (including S12’s order adapter and S14’s opening-right work). Do not treat an unapproved proposal in UNIT-026 as permission to invent policy. Implement only the S11 owner-approved sale slice described by the stage card and contracts.

### Required outcomes

- **UNIT-005 direct sale:** one source-owned sale record; distinguish agreed sale revenue from actual dated collections, remaining claim, cost/knowledge/coverage, correction, price reduction, and commercial return. Preserve historical records and prior aggregate collections without inventing payment dates or duplicate cash events. Money remains exact safe integer minor units; dates are real business dates in the accepted local timezone; unknown cost is not zero.
- **UNIT-026 sale collection:** collect against exactly one eligible live direct-sale source. The source owner writes the collection; the shared service/UI coordinates it. Recheck source revision and remaining claim inside the atomic write boundary. A collection increases cash once and reduces the claim once; it creates no new sale revenue or profit. Never distribute one payment across multiple claims or collect by name alone. Preserve operation identity, payload, source identity/revision, generation, receipt/result recovery, and `outcome_unknown` semantics; same-key retry must not double-write. Cash-place assignment, if selected, references the existing collection and does not create another receipt or cash event.
- **UNIT-004 quick registration:** route the shortcut to the existing sale/expense owners and their ordinary command path; do not create a second writer or parallel quick-record store. Preserve intent/draft/input/return context through expansion, cancellation, retry, and failure. Expense entry delegates to the already-owned S06 expense service; do not reimplement or alter expense policy in S11.
- **Return/correction distinction:** a mistaken input correction, agreed price reduction, and actual commercial return are distinct linked actions. Apply the already approved PD-02 full-return behavior only: keep the original sale/history; cancel its remaining receivable; establish a refund due only for cash actually collected; do not record cash outflow until an actual refund payment is made through its authorized owner. Do not invent partial-return policy, automatically reverse consumed cost/materials, or restore inventory unless a real eligible returned item and its authorized stock workflow are explicitly evidenced and covered. Do not make a return a disguised price edit or delete the original.
- **Atomicity:** the sale, initial collection when explicitly selected, derived claim, any selected cash-place assignment, and command receipt/result must succeed together or leave no partial effects within the existing source boundary. Collection retries and concurrent windows must be protected at the owner’s write boundary, not only disabled in the UI. A saved optional party is separate when its contract says so: failure to save an optional party must not repeat or falsely fail a committed sale.
- **Read/summary consistency:** update only the existing readers that S11’s altered source contract actually touches. Keep sale revenue on the sale date and collection/refund cash on each actual transaction date. Do not count collections as revenue again; do not add purchase-period material cost a second time. Do not implement the broad S15 finance/report redesign.

### Required financial examples

Prove from permanent tests/evidence, without changing the approved semantics:

1. Sale `15`, actual initial collection `5`, eligible cost `6` → cash `+5`, sale revenue `15`, contribution `9`, remaining customer claim `10`; collection of the remaining `10` later → cash `+10`, claim `0`, and no new revenue/contribution.
2. Two concurrent attempts to collect the same live remaining `10` → exactly one collection succeeds; the other is stale/conflict/rejected with no extra cash and no negative claim.
3. Full return of the prior sale after collecting `5` and leaving `10` due → cancel the `10` claim and create refund due `5`; cash remains unchanged until a real refund payment occurs. A later actual refund is dated when it occurs and cannot be paid twice.
4. Sale month and collection month remain separate. Historical aggregate collections without dated entries remain historical aggregates; do not fabricate dates.
5. Unknown cost and known zero cost remain distinct. Same-name customers remain distinct by IDs/explicit choice. No optional party/catalog action creates a second financial write.

### Data and transfer

- At execution start, record actual `localSchemaVersion`/`localExportVersion`, current direct-sale/collection structures, IndexedDB store/index boundaries, event and transfer contracts. Revalidate; do not blindly hardcode S10’s reported 40/32 pair.
- Preserve the existing direct-sales source and historic meaning. Do not create a global collection ledger or a second source of truth.
- If persistent fields/structure/export behavior change, include the migration, Memory and IndexedDB parity, defaults/rejection semantics, touchpoint registry, snapshots, validators, export/import/restore compatibility, identity/reference integrity, generation behavior, and all previously supported schema/export pairs in the same S11 execution. Test no-write rejection before preview/restore and prove target data remains unchanged. Do not defer S11-owned data work to S17.
- If no persistent wire-format change is required, keep schema/export versions unchanged and prove why. Never manually edit generated views.

## 7. Required source mapping and test evidence

Read all current applicable acceptance sections and retain their existing IDs. Map every in-scope acceptance row to a durable test or precise non-triggered reason. At minimum account for:

- UNIT-004: `U004-ACD006`, `U004-ACD007`, `U004-ACD008`, `U004-ACD011`, `U004-ACD012`, `U004-ACD013`, `U004-ACD018`, `U004-ACD020`, `U004-ACD021`, `U004-ACD022`, `U004-ACD023`, `U004-ACD024`.
- UNIT-005: `U005-ACD006`, `U005-ACD008`, `U005-ACD011`, `U005-ACD012`, `U005-ACD013`, `U005-ACD015`, `U005-ACD018`, `U005-ACD019`, `U005-ACD021`, `U005-ACD022`, `U005-ACD023`, `U005-ACD024`.
- UNIT-026 sale slice: `U026-ACD018`, `U026-ACD019`, `U026-ACD020`, `U026-ACD021`, `U026-ACD022`, `U026-ACD023`, `U026-ACD024`, `U026-ACD026`, `U026-ACD027`, `U026-ACD030`, `U026-ACD032`, `U026-ACD033`; clearly mark the order/opening-right adapters as outside S11, not as passed.
- Shared cases intersecting S11: `SDF-003`, `SDF-004`, `SDF-005`, `SDF-009`, `SDF-010`, `SDF-011`, `SDF-012`, `SDF-014`, `SDF-022`, `SDF-024`, `SDF-028`, `SDF-037`, `SDF-038`, `SDF-039`, `SDF-041`, `SDF-042`, `SDF-052`, `SDF-053`, `SDF-054`, `SDF-056`, `SDF-068`, plus any additional cases required by the live specifications after source mapping. For SDF cases owned by the order adapter, opening-right adapter, or non-S11 return behavior, give a precise `NOT_TRIGGERED_BY_S11` rationale and do not mark them passed.

Add or extend focused domain, application, storage capability, transfer, and UI tests for changed behavior. Cover Memory/IndexedDB parity, stale concurrent collections, duplicate/changed-payload retries, `outcome_unknown`, correction versus return, no-write rollback, historical aggregate preservation, import/export/restore, and no incidental writes. Avoid repeating unrelated suites; run the relevant focused tests after each code slice and the repository’s canonical full `pnpm check` once on the stable combined S10-fix + S11 code tree. If code changes after that, rerun affected tests and the full canonical check on the new stable tree.

For UI, follow the current repository-owned Micro design and UI rules; do not introduce a new brand system or broad redesign. Verify Arabic RTL, keyboard/scroll ownership, form preservation, clear sale/paid/remaining labels, states (empty/loading/error/saving/saved/conflict/unknown), return path, accessibility, and repeated taps at the repository’s supported phone widths. Do not claim native-device testing if only a browser harness ran.

## 8. Operations Control and documentation sequence

1. Before product-code edits, validate current Control and inspect all active claims. Keep DOC-019/WS-235 review/owner acceptance pending while recording the S10-MR-001 fix and its evidence. Create the S11 claim using the next valid unused IDs (DOC-020/WS-236 if still free), exact branch and base SHA, `SH-15`, UNIT-004/005/026 sale-slice scope, file/contract areas, dependencies, and narrow acceptance. Resolve overlap only through the legal Control lifecycle.
2. Source JSON first; run `python3 scripts/operations-control/generate_tracker.py`, `python3 scripts/operations-control/validate.py`, and `python3 scripts/operations-control/generate_tracker.py --check`. Run any required Excel metadata refresh only if the official procedure requires it. Never hand-edit generated tracker views.
3. Update the S11 card only for truthful delivery status/evidence and scoped findings; update progress/handoff, append-only work log, allowed current-state summary, Manifest, and document index. Do not overwrite prior stage results or represent acceptance/verification that has not happened.
4. Create `docs/implementation/micro-component-execution/16-S11-RESULT-2026-10-31.md` with: full execution-start/prompt/code/test/final/documentation SHAs; `S10-MR-001` evidence and root fix/addendum; S11 scope and ownership; exact source files grouped by responsibility; all acceptance mapping; financial examples and no-side-effect proof; schema/export pair before/after; migration/transfer/parity evidence; exact focused and full commands/counts/exit codes; five reviewer passes and fixes/rereads; bundle measurements; exact-head GitHub Actions and Cloudflare URLs and terminal results; Control statuses; S08/S09/S10/S11 acceptance states; PR #383 remains Draft and no main writes/merge/rebase/force-push/cleanup/second branch/PR.
5. Update PR #383 description only as needed and add one concise factual delivery comment with exact final SHA, stage code/test/docs SHAs, fix finding, local test evidence, reviewer passes, and exact remote gate URLs. Do not post secrets.

## 9. Commits, checks, five reviews, and final remote gates

- Use ZAI as the only code/product writer. Make separate stage-owned commits: (a) S10-MR-001 code/regression; (b) S10 addendum and required Control records; (c) S11 claim/records; (d) S11 product slices; (e) S11 result/handoff records. No commit combines S10 repair with S11 product implementation.
- Run focused tests for each slice, then the exact root `pnpm check` once on the stable final combined code tree. Record exact outputs and SHA. Do not weaken any assertion, skip/only guard, lint baseline, count guard, budget, size ceiling, security audit, or architecture guard to get green.
- Perform five distinct sequential read-only final reviews on the exact final S11 diff: (1) source ownership/layers/SH-15 and no structural refactor; (2) financial correctness, dates, amounts, knowledge, return/refund; (3) concurrency, idempotency, atomicity, Memory/IndexedDB and no partial effects; (4) transfer/security/compatibility/Control/evidence; (5) Arabic RTL phone UX/accessibility and UI scope. Reviewers must not edit. Fix each confirmed in-scope finding at root, add a permanent regression, have the relevant reviewer reread it, then rerun affected tests and the full check if required. If five subagents are unavailable, perform five separate read-only passes yourself and state that accurately.
- Push only to `components/integration-20261027`. Fetch the exact final remote SHA and wait for GitHub Actions and Cloudflare Pages to reach terminal success on that exact SHA. Verify each run/deployment commit SHA and URL. Repair every fixable failure at root with a new phase-specific commit, rerun required checks, then wait for both remote gates on the new exact final SHA. Earlier green status is not evidence for a later SHA.
- Keep PR #383 Draft. Never merge. Do not mark any stage `VERIFIED` on `main`; owner acceptance remains separate.

## 10. Final delivery and resume contract

The final ZAI response must be in Arabic and truthfully include:

```text
S10_MR_001 — <FIXED_AND_REGRESSION_PROVEN | BLOCKED + exact reason>
S10_ACCEPTANCE — PENDING_INDEPENDENT_REVIEW_AND_OWNER
S11_EXECUTION — <COMPLETE | BLOCKED + exact reason> | REVIEW_REQUIRED
EXECUTION_START_HEAD — <full SHA>
PROMPT_PUBLICATION_HEAD — <full SHA>
S10_FIX_COMMIT — <full SHA>
S10_ADDENDUM_COMMIT — <full SHA>
S11_CODE_CANDIDATE — <full SHA>
TESTED_HEAD — <full SHA>
LOCAL_CHECK — <PASS/FAIL + exact command/counts/exit code/SHA>
GITHUB_ACTIONS — <SUCCESS/FAIL + exact SHA + run URL>
CLOUDFLARE_PAGES — <SUCCESS/FAIL + exact SHA + deployment/check URL>
FIVE_REVIEWS — <five separate read-only results and any fix/reread>
SCHEMA_EXPORT — <exact before/after or unchanged evidence>
CONTROL — <DOC/WS IDs and truthful pending/review statuses>
FINAL_HEAD — <full SHA>
PR — 383 DRAFT
NO_MAIN_WRITES / NO_MERGE / NO_REBASE / NO_FORCE_PUSH
NO_BRANCH_DELETION / NO_SECOND_BRANCH_OR_PR
```

If context, machine load, or an external service interrupts the work, preserve local and remote work, record the last completed step and exact SHA, and resume this same order from the checkpoint without repeating completed tests or overwriting work. Never stop merely after writing a plan or result draft; complete fix-first and S11, then deliver the exact evidence. Do not self-accept any stage or say the program is ready to merge.
