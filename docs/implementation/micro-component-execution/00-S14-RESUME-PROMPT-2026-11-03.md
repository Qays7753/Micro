# Micro S14 → S15 Resume and Execution Prompt — Fixed Bundle Ceilings

**Status:** Owner-authorized continuous execution instruction, dated 2026-11-03. Publishing this file records the instruction; ZAI begins when the owner sends the short start message. Execute S14 first, then proceed directly to S15 under the gates below. Do not wait for an intermediate Manus review, owner approval, or another start message between these stages. This instruction is not acceptance of either stage, permission to change `main`, or merge authorization.

## 0. Required outcome

Resume the existing Micro program from its actual live/local state, preserve all useful work, complete S14, and then immediately implement and complete S15 on the same integration branch and PR. Deliver both stages with exact-head evidence for review. Do not stop after S14 merely to request approval to begin S15. Do not self-accept either stage.

S12 and S13 are already **accepted by the owner on the integration branch** and must not be reopened, re-reviewed, or re-executed. Their acceptance record is at `f21bec241c8cf9e0836735a12c971927491780d0`. Only investigate accepted S12/S13 code if needed to diagnose a newly demonstrated regression caused by S14/S15; make only the narrowly necessary compatibility correction and preserve their acceptance records.

## 1. Binding owner decisions and non-negotiable limits

1. Keep the bundle hard ceilings unchanged: **650,000 raw bytes and 155,300 gzip bytes**. Do not raise, relax, re-anchor upward, bypass, or edit a checker to pass either ceiling. Do not raise any other guard, threshold, tolerance, lint limit, file-size ratchet, or test floor.
2. No structural refactoring, bulk moves, broad file splitting/renaming, layer reorganization, or code-organization cleanup without a separate explicit owner decision. The read-only scan at `docs/architecture/refactoring/s11-structure-scan-20261031/S11-STRUCTURE-ARCHITECTURE-CODE-ORGANIZATION-SCAN-REPORT-2026-10-31.md` remains authoritative; its proposed waves are not approved for execution. Make only narrowly scoped, contract-required changes in existing homes. A new file is allowed only for one direct S14/S15 responsibility when the existing home is unsuitable; this is not permission for a structural wave.
3. Preserve the already authorized S14 storage contract at **local schema 41 / export 34**, including `period-summaries` and `command-receipts`, their touchpoints, and their transfer compatibility. Keep imports for `33/40`, `32/40`, and every other previously supported legacy pair. Do not roll back S14's 41/34 change. Make a further version change only if an additional persistent delta is truly required by an approved S14/S15 contract, and complete the full migration, import/export, golden, and compatibility evidence in this program run.
4. Use only branch `components/integration-20261027` and Draft PR #383, based on `main` at `3584aa1d08cea3e0a00623b719fed7f991ce187f`. No main writes, merge, rebase, force-push, branch/PR creation, or branch deletion.
5. Never put access tokens, credentials, or secrets in this prompt, chat, files, commands, logs, commits, URLs, or PR comments. Use only the secure credential mechanism available in your environment; never echo a secret.
6. Keep S14 and S15 changes attributable in separate implementation commits, with documentation/Control commits separate where practical. Never rewrite accepted history or discard local work.

## 2. Repository state, checkpoints, and preservation

- Repository: `Qays7753/Micro`.
- Work branch: `components/integration-20261027`.
- Only program PR: Draft PR #383.
- At preparation, live branch head and local review checkout both matched `f21bec241c8cf9e0836735a12c971927491780d0`; `main` was `3584aa1d08cea3e0a00623b719fed7f991ce187f`. Re-fetch and verify refs, PR metadata, comments, and exact-head checks before proceeding. If the head advanced, inspect and preserve all later work; never reset to this recorded SHA.
- S14's last identified code-bearing checkpoint is `6af8f2db29628b9d7396e7a8907e7d37c0d17d79`; later checkpoint records include `e4c17f296ca170f306dc13c2cb1f11d3d7f960e0` and owner acceptance record `f21bec241c8cf9e0836735a12c971927491780d0`. These are provenance only, not rollback targets.
- Continue in this same ZAI conversation/environment when available. Before any edit, inspect branch, remote divergence, staged/unstaged/untracked files, stashes, and unpushed commits. Preserve and reconcile every useful local artifact. Do not reset, revert, delete, stash-drop, clean, or repeat completed work blindly. If context/runtime limits interrupt you, first save a durable checkpoint on this same branch where safe, then resume from that checkpoint without redoing completed tasks.

## 3. State and failures to revalidate before coding

The last confirmed remote checks on `f21bec241c8cf9e0836735a12c971927491780d0` were both failing:

- GitHub Actions run `41527099746` reported 12 failing tests in `apps/prototype-web/client/src/FinanceUpcoming.dom.test.tsx`, including queries for visible labels such as `اليوم (1)` and `اليوم (2)`.
- Cloudflare Pages was reported as failed on the same SHA; its cause was not yet independently classified.
- The last S14 measurement was `634,593 raw / 155,688 gzip` at code checkpoint `6af8f2db29628b9d7396e7a8907e7d37c0d17d79`, exceeding the fixed gzip ceiling by 388 bytes. The documented S13 comparison was `633,144 / 155,254`.

These are historical observations, not claims about a later head. Re-fetch and inspect current logs. Diagnose the UI failures and Cloudflare failure independently. Reproduce the focused UI failures on the actual current tree, inspect actual rendered text and the accepted S13 behavior, and identify the root cause. If needed, compare the focused test against accepted S13 code candidate `0ce9100a8c01cd304f3792d86feb1bd43d161786` in a safe isolated temporary checkout; do not disturb the active workspace or rewrite accepted history. Fix genuine regressions at root. Change a test only when the contract proves the test expectation is wrong; never weaken assertions or skip tests to obtain green.

## 4. Phase A — resume and finish S14

### A1. Preserve and establish state

1. Confirm branch and live PR/base; fetch without destructive changes. Record local dirty/unpushed work and preserve it.
2. Read current `AGENTS.md`, nested instructions that apply, `docs/operations/current-state.md`, the original S14 prompt, this continuation prompt, S14's DOC-023/WS-239, S14 stage card, progress/handoff, implementation and result evidence, and exact current CI/Cloudflare logs. Confirm DOC-023/WS-239 remain the single active S14 claim; do not reopen the accepted DOC-021/022 or WS-237/238.
3. Record a concise checkpoint: actual live SHA, local state, completed S14 work, remaining requirements, and current gate failures.

### A2. Fix failing remote gates first

1. Reproduce and diagnose the focused `FinanceUpcoming.dom.test.tsx` failures and Cloudflare Pages failure separately.
2. Make the smallest correct, non-structural fix that preserves accepted S13 behavior and the approved S14 contract. Add durable regression coverage.
3. Run focused tests and applicable type/build checks; commit the correction separately on the same branch. Do not proceed with a known unresolved test/build regression.

### A3. Meet the fixed bundle limits without changing them

1. Measure the actual current production entry and inspect budget scripts, import reachability, and reports. Reconfirm raw and gzip measurements on the live resumed tree.
2. Bring the entry under **both 650,000 raw and 155,300 gzip** with a minimal, correct, non-structural change. Preserve all S14 behavior, storage, runtime failure paths, accessibility, and tests. Only use evidence-supported optimizations within existing module boundaries, such as removing a genuinely unused eager import or preventing unnecessary entry-point reachability.
3. Do not remove required features, create a new architecture layer, perform broad splitting/moves, weaken checks, alter baselines, or disguise measurements. If no safe in-scope solution exists, exhaust and document alternatives and report a genuine blocker; do not raise the ceiling or silently expand authority.
4. Run the budget and applicable surface guards. Surface measurements must be real and tied to the exact PR head; no threshold may increase.

### A4. Complete S14 contract and acceptance

Continue the existing implementation; do not rebuild completed work. S14 owns UNIT-002 / ACC-01 / JRN-010 / SH-18. Re-read the canonical S14 prompt and full P3/A/B requirements. Preserve, at minimum:

- One optional completion coordinator that delegates writes to source owners; no second ledger, balance source, or competing writer.
- `known`, `estimated`, `unknown`, `skipped`, `none`, and `not_applicable` remain distinct. Never infer zero, today, a financial event, a debtor, or proportional historical values.
- Preview/read/date selection/navigation/cancel are read-only. Coordinated commit is all-or-nothing and idempotent, with Memory/IndexedDB parity, stale-generation protection, honest recovery, and no partial financial success.
- Complete versioned drafts and truthful handling above 32 KB; no truncation and no financial `localStorage`.
- Preserve schema/export 41/34 and compatibility for 33/40, 32/40, and every previously supported pair. Restore must not re-execute financial effects. Verify identity, generation, coverage, and history.
- Durable evidence for the 17 S14-owned cases: `SDF-007`, `SDF-017`, `SDF-018`, `SDF-019`, `SDF-023`, `SDF-024`, `SDF-025`, `SDF-026`, `SDF-027`, `SDF-028`, `SDF-029`, `SDF-030`, `SDF-036`, `SDF-050`, `SDF-066`, `SDF-071`, and `SDF-072`. Mark a case not triggered only with a reason; do not call it passed. Run `SDF-015` as a companion regression only if shared cash-observation code is touched; do not claim S14 owns it.
- Arabic-first RTL phone flow with honest loading/empty/partial/failure states and recoverable input preservation; no general redesign outside approved component journeys.

### A5. S14 gates and immediate handoff to S15

1. Run focused regressions, then the repository-required full `pnpm check` and all applicable current guards from `AGENTS.md`/package manifests on the exact S14 candidate. Include Operations Control validation, generated tracker check, doc-index coverage, current-state size, agent-document contract, bundle budget/surfaces, storage/transfer/security gates, and `git diff --check`, using the actual script names. Record command, exit code, counts, warnings, and exact tested SHA.
2. Conduct five **sequential, independent, read-only** reviews on the same exact S14 candidate: (i) financial/knowledge/coverage semantics; (ii) storage, migration, import/export and compatibility; (iii) atomicity, concurrency, rollback, stale generation and test adequacy; (iv) Arabic RTL mobile flow and accessibility; (v) scope, Control, architecture-scan boundary, bundle and cross-stage compatibility. Reviewers do not edit, commit, test, or comment. Resolve each confirmed in-scope finding, run relevant regressions and required checks, and have the relevant reviewer reread the corrected SHA. Do not pause for routine review rounds.
3. Push only to the existing branch and update only PR #383. Wait for GitHub Actions and Cloudflare Pages on the **exact S14 final head**. If either fails, diagnose and fix the root cause, run applicable checks, push a new same-branch commit, and recheck both exact-head gates.
4. Once S14 meets its gates, record S14 as delivered for review using the established legal pair: DOC-023 `IN_PROGRESS` → `IN_REVIEW` and WS-239 `IN_PROGRESS` → `REVIEW_REQUIRED`. This releases the active S14 workstream claim without accepting S14. Update DOC-023/WS-239 JSON first and generate tracker views. Then immediately create/claim the S15 workstream with the next unused IDs, verify no active-claim overlap, and start S15 in this same run. **Do not wait for Manus or owner review/approval between S14 delivery and S15 start.** The owner has directly authorized this continuation.

## 5. Phase B — execute S15 immediately after S14 gates

S15 is `UNIT-013`, `UNIT-013B`, `UNIT-016`, `UNIT-017`, `UNIT-021`, `UNIT-035`, `UNIT-036`, and `UNIT-040`, with shared contracts `SH-19` and `SH-20`. Its canonical card is in `docs/implementation/micro-component-execution/01-STAGES.md`; ownership and dependency map is in `DEPENDENCIES-AND-TRACEABILITY.md`. Read the full relevant P3/A/B/acceptance sections for these units, the shared data/financial contract, shared acceptance cases, current financial policies, and applicable UI/local-first instructions. Follow those sources over summaries in this prompt if more detail is needed; do not invent a conflicting product/financial decision.

### S15 goals and hard boundaries

1. Complete the shared, consistent financial-result reader, period summary, financial entry surface, statement/report and activity history according to UNIT-013/016/017. Keep source ownership: readers consume owners' records; registration and correction delegate to the canonical source owner. Do not add a second ledger, balance store, financial writer, or duplicated formula in UI.
2. Implement optional expense budgets per UNIT-013B as plans only. A budget is not an expense, payment, or cash event; creating, exceeding, hiding, or viewing a budget must not create financial activity.
3. Preserve confidence, period, scope, generation, coverage, and source provenance in derived results. A known portion must not be presented as a complete result. Keep unknown/estimated/known and covered/uncovered dimensions honest and consistent across financial overview and statement.
4. Implement UNIT-021's current release decision: advanced cash forecasts and “safe withdrawal” recommendations remain deferred/hidden; do not build a substitute recommendation or imply it exists. Preserve relevant historic records and compatible transfer semantics.
5. Enforce UNIT-035: lending creation is cancelled in the current product. Remove/hide all active creation entry points and writer paths that would bypass that decision; do not delete or reinterpret historical records.
6. Enforce UNIT-036: borrowing remains deferred. Do not create borrowing or a replacement loan under a customer/other party name. Preserve historical meaning and compatibility.
7. Enforce UNIT-040: sharing is cancelled; do not replace it with WhatsApp, share-message, copy-text, or another sharing route. Keep the separately approved UNIT-016 report download and UNIT-044 backup/copy behavior intact.
8. Follow the approved component designs/flows in the canonical specifications, Arabic-first RTL and phone-first. Do not turn S15 into a system-wide visual redesign, and do not use this work as a structural refactoring wave.

### S15 required acceptance

Cover the five primary S15-owned shared cases `SDF-006`, `SDF-045`, `SDF-058`, `SDF-061`, and `SDF-062` with durable tests and evidence; mark a genuinely untriggered case with the reason. Also satisfy each applicable UNIT acceptance case from the canonical specs. At minimum prove:

- The finance, period summary, statement and activity log agree on the same scope, period, source, generation and knowledge; partial knowledge is not reported as complete profit.
- A budget remains a plan and does not create expense/payment/cash; e.g. a 10-unit expense with 3 paid and a 100-unit asset must not become a 113-unit budget expense.
- UNIT-016 report/download remains available while UNIT-040 sharing is absent; UNIT-044 backup/copy is unaffected.
- Lending/borrowing/advanced-forecast entry routes are absent as required, while existing history retains its meaning and remains compatible with transfer/restore.
- Readers do not write; an edit action returns to the owning workflow; loading, empty, partial, error, retry, and inaccessible states remain truthful and usable.

Do not change schema/export merely for convenience. If S15 genuinely requires a persistent format delta under its canonical contract, document why, update every adapter/touchpoint, preserve all supported legacy pairs, prove round-trip/restore and rejection behavior, and include the complete compatibility evidence in this same S15 slice. Do not assume a schema change is authorized merely because it is technically easy.

### S15 execution, tests, reviewers, and exact-head gates

1. Before S15 code, verify the S14 claim has been legally moved out of active status, create the next unused DOC/WS records, record the true branch/base SHA, scope and dependencies, and verify no active Control overlap. Update JSON sources first; generate views; never hand-edit generated files. If an ID has become used, choose the next unused one.
2. Make S15 implementation commits separate from S14 and from S15 Control/report commits. Test each meaningful slice with focused tests. Run repository-required full `pnpm check` and all applicable guards on the exact S15 candidate. Do not rely on the S14 test run as proof for changes added in S15.
3. Conduct five sequential independent read-only reviews against the exact S15 candidate: (i) financial semantics, source ownership and knowledge; (ii) reader/query consistency, scope and generation; (iii) budgets, deferred/cancelled capabilities and preserved history; (iv) transfer/restore and backward compatibility; (v) Arabic RTL mobile UX, accessibility, scope, Control and cross-stage integration. Reviewers do not edit, test, commit or comment. Do not re-review accepted S12/S13. Fix confirmed in-scope findings, run relevant regressions and the required full checks, and reread the corrected SHA with the relevant reviewer.
4. Push only to `components/integration-20261027`; update only PR #383. After the final S15 code/docs/Control/budget-record commit, verify the exact live SHA and wait for GitHub Actions and Cloudflare Pages on that same SHA. If either fails, fix the root cause, rerun applicable checks, push a new commit to the same branch, and wait for both exact-head checks again.
5. If S15 changes shared code used by S14, rerun the affected S14 regression and compatibility checks on the final S15 head. Report which earlier exact-head evidence remains valid and what was rerun.

## 6. Records and final delivery for both stages

For S14 and S15, update the canonical JSON/control sources first, generate tracker views, and update the stage card, progress/handoff, Manifest, document index, PR #383 description/comment, and current-state only within its size guard. Append dated owner decisions to `current-state-log.md`; do not rewrite historical records. Keep S12/S13 acceptance unchanged. Do not hand-edit generated tracker files.

Create S14 result `19-S14-RESULT-2026-11-03.md` if unused (otherwise next unused result identifier), and an S15 result with the next free identifier. Each report must identify its exact base/code candidate/final docs-control SHA; commit responsibilities; files changed; requirements and SDF dispositions; test commands/results/counts/warnings and tested SHA; reviewer scopes/findings/dispositions; schema/export and legacy compatibility evidence or explicit no-change rationale; bundle raw/gzip evidence proving both ceilings stayed fixed; current and resolved CI/Cloudflare failures; legal Control state; and remaining limitations.

At the end, deliver both stages for independent owner review, not self-acceptance. S14 and S15 must be in their legal review-required states. Include a concise copyable status block with exact final SHA, S14 delivery status, S15 delivery status, local and remote gate results on the exact final S15 head, proof the limits remain `650,000 / 155,300`, and the next owner action. Do not claim the program is merge-ready.

## 7. No routine pauses; genuine blocker boundary

Do not pause to ask for routine coding choices, test selection, formatting, explanatory prose, or permission to start S15 after S14 has passed the gates specified here. The owner has authorized direct continuation through S15. Continue in the same conversation/environment and preserve checkpoints; a status update is not a reason to stop.

Repository rules still prohibit inventing financial/product/security policy or bypassing a quality gate. Stop only for a genuine unresolved contract/security/financial decision, an active claim conflict that cannot be resolved legally, unsafe migration, unavailable authorization, or a required gate that cannot be fixed safely within this authority. Never bypass the fixed ceiling, structural-scan gate, or Control validator. If genuinely blocked, preserve all completed work and report exact evidence, blocked scope, safe completed work, and the smallest decision needed. Do not ask whether to raise the bundle ceiling; that option is explicitly declined.
