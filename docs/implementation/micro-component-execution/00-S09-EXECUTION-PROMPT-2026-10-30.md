# Z AI — S08 Review-Fix First, Then Complete S09 (UNIT-007 / UNIT-008 / UNIT-029)

## 1. Mission, authority, and continuous-execution rule

### First response in this same ZAI conversation — answer, then continue immediately

Continue in this existing ZAI conversation/session. Do not ask the owner to start a new chat, do not reclone/restart unnecessarily, and do not wait for a reply to this first status note. Before implementation, send one brief preflight update answering all of the following from live evidence: (a) does the prior final report correspond to work fully pushed, and what are the actual local branch/HEAD, remote branch HEAD, ahead/behind count, uncommitted/untracked changes, and stashes; (b) are there any local-only commits/files that must be preserved or reconciled; (c) what is the available environment capacity (free disk, memory/pressure, active relevant processes, and repository/workspace size) and is there safe, demonstrably disposable residue from this task; (d) what is your evidence-based estimate for the remaining end-to-end time, with a realistic range, assumptions, and confidence; and (e) what measurable factors explain the observed slowness (for example, required source reads, serial review agents, full checks, remote CI/deployment latency, or constrained environment resources). Distinguish measured causes from hypotheses; do not guess or promise an exact duration. Keep this initial report short, then continue execution immediately without asking the owner to authorize the already-approved S08-fix → S09 sequence. Do not spend time trying to diagnose unrelated system folders or processes.

This is one owner-authorized, continuous execution assignment with two strictly ordered parts:

1. **First:** correct the two confirmed S08 review findings `S08-MR-001` and `S08-MR-002` from their root causes, without reimplementing S08.
2. **Immediately afterward:** proceed to implement S09 in full for UNIT-007, UNIT-008, UNIT-029 and their owned shared contract `SH-13`.

The owner explicitly authorized this sequence on 2026-10-30 and directed that there be **no intermediate pause for Manus review, owner approval, a new prompt, or a human gate between the S08 corrections and S09**. Do not ask the owner whether to continue after Part 1. Do not stop after the S08 correction to wait for remote CI or Cloudflare; finish the sequence and verify both remote gates on the exact final S09 head. Run the focused S08 correction tests before starting S09, then continue immediately when they pass. Run the canonical full local check once on the final combined code state, avoiding duplicate full suites when no code has changed.

This authorization is execution permission for this exact sequence only. It does **not** mean that S08 or S09 is accepted, does not authorize merging, and does not waive financial/data-integrity contracts, tests, security controls, or final review evidence. Keep S08 recorded as `REVIEW_REQUIRED` until the later independent review and owner acceptance. S09 is also delivered for review, not self-accepted.

Stop only for a real, evidenced blocker that cannot be resolved within already approved contracts: unsafe repository state/unknown writer, unavailable secure credential path, an irreconcilable financial or data-integrity contract conflict, a migration/restore conflict that cannot be fixed without an unapproved semantic decision, or a required gate that remains unrepairable after root-cause remediation. Do not stop for missing commentary, stale summaries, a documentation/index/Control omission, an ordinary test failure that can be fixed, or the absence of an intermediate approval. Resolve routine documentation and process defects yourself and continue.

## 2. Repository boundary and live starting point

- Repository: `Qays7753/Micro`
- Only branch: `components/integration-20261027`
- Only PR: [PR #383](https://github.com/Qays7753/Micro/pull/383), which must remain **Draft** and open.
- `main` is read-only. Last verified program base: `3584aa1d08cea3e0a00623b719fed7f991ce187f`.
- Live integration head before the first publication of this prompt: `2602a03d7fe1bd68442d003f68644f8f658cf7d7`; the first prompt publication was `2f5aac023657c35063eb61c3b344838707bea27d`. This amendment has a newer documentation-only publication head: fetch the branch and use the actual live head if it descends safely from `2f5aac023657c35063eb61c3b344838707bea27d`.
- At preparation, PR #383 was open/Draft and both GitHub Actions and Cloudflare Pages were successful on `2602a03d7fe1bd68442d003f68644f8f658cf7d7`. Re-verify live; never attribute a check to another SHA.
- Current S08 result: `docs/implementation/micro-component-execution/13-S08-RESULT-2026-10-30.md`.
- Existing S08 review-correction draft, useful as evidence but **not** as the governing stop instruction for this combined assignment: `docs/implementation/micro-component-execution/00-S08-REVIEW-FIX-PROMPT-2026-10-30.md`. This prompt supersedes its instruction to stop before S09; retain its two finding definitions and technical evidence.
- S08 Control: `DOC-017` / `WS-233`; keep the same records and follow their legal state lifecycle. S09 Control should use `DOC-018` / `WS-234` if those IDs remain available after live validation; otherwise use the next valid IDs from the repository's Control rules and record the actual IDs. Do not create duplicate claims.

Before changing anything, verify the live refs, PR state/base/head, ancestry, status/checks, local branch, working tree, local and remote commits, unpushed/uncommitted files, stashes/reflog where available, and whether another writer is active. Preserve all local work. If there is unrelated local work or unsafe drift, do not overwrite or mix it; save a safe checkpoint and report the exact blocker. Never use `reset --hard`, `git clean`, destructive checkout, rebase, force-push, history rewrite, or blind mass moves.

### Environment inspection and safe cleanup

Inspect only the ZAI execution workspace you are authorized to access. Report repository/workspace size, available disk, memory pressure, and relevant active processes. If an environment limit is actually affecting progress, state the measured evidence and practical impact. Identify leftover artifacts from this or earlier task runs, but remove only items that are demonstrably disposable (for example, this task's own temporary probe/build output that no active process or uncommitted work references). Preserve every repository clone with uncommitted/unpushed work, all source/test files, Git metadata/stashes/reflog, credentials/configuration, browser profiles, and user or unrelated project data. Do not delete caches or dependencies merely because they are large if they would needlessly slow the required checks. No broad recursive deletion, `git clean`, or cleanup of GitHub content is allowed. If ownership or disposability is uncertain, leave it untouched and report it.

All code, documentation, records, and commits in this assignment stay on the single integration branch and PR. No `main` write, merge, second branch, second PR, branch deletion/cleanup, or PR closure. Use the secure credential field/channel only. Never include, print, paste, commit, log, or report access tokens or private credentials. Do not change CI policy, security exceptions, warning/bundle ceilings, test tolerances, or guards to make a check pass.

## 3. Required sources and authority order

GitHub at the verified live head is the operational source of truth. Drive is provenance-only and is not required or available to this executor. A local checkout is usable only after it is proven to match the live GitHub branch. Do not rely on conversational summaries when the repository has the governing source.

Read the repository’s current instructions and operation state before code, including `AGENTS.md`, `docs/operations/current-state.md`, `docs/operations/control/generated/AGENT-BRIEF.md`, `docs/00-document-index.md`, `docs/operations/control/README.md`, the applicable SOP/handoff protocol, `docs/implementation/micro-component-execution/01-STAGES.md`, `02-PROGRESS-AND-HANDOFF.md`, `MANIFEST.md`, the current `DOC-017`/`WS-233`, and active-work views. Validate Control sources before and after the relevant updates. JSON is authoritative: update JSON first and regenerate views only with official generators.

Read these governing S09 sources at the live head, including the relevant full A/B/P3, ownership, dependencies, acceptance, and decision sections—not just summaries:

- `docs/implementation/micro-component-execution/01-STAGES.md` — S09 card and its prerequisites/acceptance.
- `docs/implementation/micro-component-execution/DEPENDENCIES-AND-TRACEABILITY.md` — `SH-13`, build owners, readers, and stage boundaries.
- `docs/implementation/micro-component-execution/02-SPECIFICATIONS/03-New-Design/UNIT-007-مسودة-الطلب.md`.
- `docs/implementation/micro-component-execution/02-SPECIFICATIONS/03-New-Design/UNIT-008-التكلفة.md`.
- `docs/implementation/micro-component-execution/02-SPECIFICATIONS/03-New-Design/UNIT-029-المنتجات-والخدمات.md`.
- `docs/implementation/micro-component-execution/02-SPECIFICATIONS/05-Data-and-Implementation/02-Shared-Data-and-Financial-Contract-AR.md` — especially §§2–5, 7, 9–11, 14, 18 and `PD-01`.
- `docs/implementation/micro-component-execution/02-SPECIFICATIONS/05-Data-and-Implementation/03-Shared-Data-Acceptance-Cases-AR.md` — all S09-linked cases.
- `docs/implementation/micro-component-execution/02-SPECIFICATIONS/04-System-Navigation/02-Consistency-Review-and-Decisions-AR.md` — `CONS-DEC01`, `CONS-DEC02`, `CONS-DEC07`, and `PD-01` approval and boundaries.
- `docs/implementation/micro-component-execution/02-SPECIFICATIONS/04-System-Navigation/01-Journeys/02-Customer-Order-Lifecycle-AR.md` — `J002-DEC01/02`, `J002-G01/G02`, and relevant acceptance cases.
- The applicable financial policies and contracts, including `docs/contracts/05-financial-p0-policies.md`, the current financial event/cost contracts, and `docs/quality/persistent-entity-touchpoints.json`.
- Existing current implementation, tests, adapters, migrations, transfer validators, and result records for S02–S08 only where the S09 contract or the two S08 findings require them. Historical file maps at older SHAs are navigation evidence, not claims about live code.

At the start, create/update a concise understanding card in the S09 Control claim before product-code edits: user/problem, scope/non-goals, owners, approved invariants, expected failure states, acceptance IDs, baseline and rollback boundary. Record the owner's explicit continuous-execution authorization and its limit: proceed S08-fix → S09 without intermediate approval, while acceptance and merge remain separate.

## 4. Part 1 — mandatory S08 corrections before S09

Do not redo UNIT-034 or previously completed S08 work. Correct only these two confirmed findings, preserving the existing schema/export pair `40/32` and existing wire format unless a live, proven contract requires otherwise. The test and fix must be permanent; no temporary probe-only evidence.

### S08-MR-001 — dangling saved acquisition-party reference can enter through import

**Evidence:** `transferFamilyValidators.ts` validates the shape of optional `asset.acquisitionParty`; `transferSnapshotValidation.ts` builds the saved-party ID set from `counterparties` and checks direct-sale/supplier-purchase party references, but the asset validation path does not enforce that a non-null saved `partyId` resolves in the same imported snapshot. `AssetService.create` checking the chosen party during ordinary creation does not protect the separate import/restore trust boundary.

**Root fix:** at the canonical transfer snapshot-validation boundary, require every non-null saved `asset.acquisitionParty.partyId` to resolve to a valid party in that same snapshot. Preserve absent/null as allowed where the asset contract permits it. Never reconstruct a party from `labelSnapshot`, name, phone, or other text; never merge by name. An archived party remains a valid historical reference if it is present and passes the existing party validator—do not add an active-only rule without a contract. Preserve rejection precedence and existing S05 source-reference checks. Reject malformed references during `prepareImport` before preview and during `prepareRestore` before any target write.

Add focused regressions that prove both rejection paths and unchanged target data. Include valid null/absent and valid saved/archived party references where permitted, and a dangling ID. Keep one canonical invariant, not a parallel validator.

### S08-MR-002 — permanent transfer round-trip evidence is missing for S08 fields

S08 added asset fields `acquisitionParty` and `paidAtCreationMinor`. Validator-shape checks and normalization of absence are not a real transfer round trip. Add a permanent end-to-end regression using the actual `LocalTransferService` sequence:

`create asset through the real application service → createVerifiedExport → prepareImport of that exact export → prepareRestore on a clean target → confirmImport → re-export target`.

Assert preserved asset identity, the saved party ID and historical label snapshot, `paidAtCreationMinor`, acquisition/event references and dates, and relevant financial events. Prove that restore does not replay cash, asset, payable, or other financial effects. Exercise Memory and IndexedDB persistence/application paths where the existing transfer harness supports them; if pure transfer preparation is adapter-independent, document that fact and prove persistence/application parity through both adapters rather than duplicating pure parser tests.

Include a legacy asset with both new fields absent, using the live supported `40/32` pair: migration gives only the documented nullable/absent meaning, invents neither a party nor a payment, and preserves the original acquisition meaning. Include malformed dangling-party and invalid `paidAtCreationMinor` cases against the live contract (for example zero, negative, unsafe, or an invalid relationship to acquisition amount). Preserve any valid fully-paid path permitted by the actual contract; do not reject a valid paid-in-full asset merely because a partial-payment example exists. Prove rejection precedes preview/target writes and target data remains unchanged. Add an archived-party case if supported by the existing fixture APIs.

Update the S08 result addendum (`13a-S08-REVIEW-FIX-ADDENDUM-2026-10-30.md`) and DOC-017/WS-233 to record the findings, root fixes, tests, exact tested SHA, and status. Correct the previous round-trip claim to match the new evidence. Keep S08 `IN_REVIEW` / `REVIEW_REQUIRED`; do not mark it accepted. Update progress/handoff, current program summary where appropriate, indexes/Manifest, append-only work log, and generated views according to repository rules. Do not rewrite S08 history or silently change its original result.

Create an S08 correction commit (or narrowly separated S08 code and S08 evidence commits) on the existing branch. Run the targeted transfer, asset, and party-reference regressions now. **As soon as those focused tests pass, continue directly into S09. Do not wait for human review or remote checks between parts.** If a focused test fails, fix the cause and rerun it before proceeding; ordinary fixable failures are not blockers.

## 5. Part 2 — implement S09 completely within its owned boundary

S09 implements `UNIT-007` + `UNIT-008` + `UNIT-029`, shared build `SH-13`, on the existing branch. This is not permission for a general redesign of adjacent stages or broad repository restructuring. Do not start S10, S11, or S12; implement only the S09-owned behavior and the minimum compatible contracts/readers/transfers that S09 changes.

### 5.1 Required product outcome and ownership

Deliver a coherent, phone-first order-draft and cost flow that:

- lets a user start a custom product/service directly in the order draft without first creating a catalog item;
- allows an optional saved product/service reference, imported as an independent, versioned snapshot;
- composes distinct order groups/components with each quantity/scope applied exactly once;
- stores an order-cost snapshot with truthful mode, scope, knowledge, coverage, provenance, version, and revision semantics;
- shares one pure calculation kernel with later UNIT-031 tooling without creating a second engine or merging tool estimates with order records;
- lets the user enter a suggested/actual-for-the-operation sale price under the existing owner-approved freedom; a suggestion is never an agreement;
- allows explicit, optional “save for reuse” of a suitable custom offering, separate from saving the order or cost;
- preserves draft identity, all inputs, context, and recovery across save/update/reload/return paths; and
- remains financially non-posting: a draft, estimate, cost calculation, catalog save, or saved-offering selection creates no sale, agreement, cash, deposit, revenue, expense, owner payable, receipt, consumption, waste, or inventory movement.

One owner per shared part: UNIT-007 owns draft identity/description/intent/quantity and draft lifecycle; UNIT-008 owns order-cost snapshots, scope/knowledge/coverage/revisions and the order-cost writer; UNIT-029 owns reusable saved offerings and their explicit save intent. Use existing established homes and service composition. A reader may consume an owned contract but may not become a second writer or source of truth.

### 5.2 Financial and data decisions already settled — do not re-ask or change

Treat the following as approved within their written limits: `CONS-DEC01`, `CONS-DEC02`, `CONS-DEC07`, `J002-DEC01/02`, and `PD-01`. In particular:

- Unknown cost is allowed as a truthful state, not numeric zero. An agreement with unknown cost and/or no due date is an approved later capability, but S09 itself does not create the agreement.
- Preserve exact order totals in safe integer minor units. For 10.00 over 3 units, the order amount remains `1000` minor; a displayed rounded unit value must never be multiplied back into `1002` minor.
- Distinguish known, estimated, unknown, partial, excluded-by-choice, not applicable, unresolved, and already-covered meanings as the governing contracts define them. Empty or unvisited is not zero and is not “not applicable.”
- One active input mode per cost scope; never add total plus its detail lines. Apply group repeat quantity exactly once. Project-side delivery cost is counted once at order scope; the PD-01 customer order add-on is a different, explicit order-level amount and is not third-party income or a customer delivery fee.
- Cost knowledge/coverage remains attached to snapshots and readers. Name/amount similarity cannot infer coverage. Never count the same material/period cost twice. A partial or unknown result must not be called full cost, guaranteed profit, or full-period result.
- Price is user-controlled. Do not add a mandatory floor, profit percentage, below-cost prohibition, or free-sale path. Margin on sale price is not markup on cost. Keep current approved rounding and decimal policies.
- Owner time/electricity/operating-share inputs used for pricing are not cash, salary, payable, expense, owner entitlement, or recognized period cost.
- Saved-offering edits/archives never rewrite past order snapshots or agreements. No automatic catalog save from a draft, calculation, estimate, sale, or use of a saved offering.

Do not silently implement proposals that their owning source explicitly labels unapproved or requiring coordination (including unapproved details of D06/D07, reader recognition, below-floor behavior, or a new export/storage interpretation). First determine the actual current authority and live code. Implement the already-approved behavior and preserve existing valid behavior. If a proposed optional detail cannot be implemented without inventing a business/financial rule, leave that isolated detail non-operative with a precise `BLOCKED_BY_CONTRACT` record and complete the independent S09 work; do not stop the whole assignment for it. Stop the whole assignment only if the unresolved conflict prevents a safe coherent implementation of the required S09 core. Never fake a zero, placeholder, or green result to work around it.

### 5.3 S09 acceptance coverage

Map every S09-owned acceptance case to a test/evidence row. At minimum, cover all applicable S09 cases explicitly, not only happy paths:

- Stage-owned `SDF-002`, `SDF-032`, `SDF-034`.
- Linked cost/data cases where affected: `SDF-031`, `SDF-035`, `SDF-052` (PD-01 amount semantics only, without posting agreement/revenue/cash in S09), `SDF-059`, `SDF-065`, `SDF-029`, `SDF-050`, and `SDF-072` where the changed draft/storage scope invokes them.
- UNIT-007’s `U007-AC01..AC23` and its in-scope `U007-ACD009/010/011/012/014/015/019/020/023/024`.
- UNIT-008’s `U008-AC01..AC28` and `U008-ACD012/014/015/016/023/024`.
- UNIT-029’s `U029-AC01..AC56` and `U029-ACD012/014/015/018/019/020/023/024/026/027/030/032/033/038`.

For each item, either give direct durable test evidence or state the exact, evidence-based reason it is not triggered by this slice; do not mark an unrun case as passed. Reuse stable acceptance IDs; do not renumber them. These tests supplement, not replace, the critical scenarios below.

### 5.4 Critical behavior matrix

**Draft and recovery (UNIT-007):** prove open/first keystroke/default quantity creates no persisted order; meaningful partial content can be intentionally saved; default quantity 1 alone cannot. Save creates one stable ID, later saves patch the same record, and a double click/retry/unknown outcome cannot duplicate it. Keep raw invalid quantity/text and validity recoverable without committing invalid data. Preserve intent, source proposal, return/search context, and navigation state without putting financial/customer data in URLs. Distinguish temporary `FormDraft` from legal `OrderDraft`; recovery is not an order/agreement. Test reopen/reload, two windows, data-version updates, unknown outcome, newer editor vs stale writer, linked order, delete-vs-save and update-vs-delete. Verify conditional checks occur inside the atomic write boundary and use existing `storage_stale`/idempotency patterns. Do not use `localStorage`/`sessionStorage` as a financial or authoritative replacement. Preserve user input on failure and after return from cost.

**Cost (UNIT-008):** exercise the actually approved representation for total, detailed, explicit unknown, partial/estimated, and deliberate exclusions. Validate safe `MoneyMinor`, quantity/unit identity and accepted precision. Prove total and detailed inputs do not combine; unknown does not become 0; explicitly entered valid zero stays distinguishable; source date is not replaced with snapshot time; a changed order quantity invalidates/requires review of the old snapshot without rewriting it; no-op save creates no revision; a meaningful save creates one immutable revision; retry/reload cannot create another revision; stale draft/snapshot cannot overwrite newer data. Exercise material cost, labor `minutes × hourlyRate`, project delivery/add-ons, group scope, and coverage without double counting. Read-only material/quote references must not consume inventory or create expense. Share the pure calculation kernel; do not add a React-local calculation engine.

**Saved offerings and reuse (UNIT-029):** a simple product/service can be saved with only the required basic identity; saved-item access is optional; a custom order can proceed without catalog creation; “save for reuse” is explicit and idempotent. Choosing a saved offering creates an independently editable versioned order snapshot; editing/archiving the source later does not change the old snapshot. Test product/service preference from UNIT-038 only (neutral if absent), local per-operation override, no conversion of `workMode` into offering kind, no reclassification of existing records, no name-based identity merge, no duplicate on retry, no automatic stock/expense/sale effects, and no selection of “latest/first active template” where a specific revision was chosen. Free cost lines do not require tracked inventory.

**Transfer, migration, and adapter parity:** every permanent shape changed in S09 must be included in applicable snapshot/backup/export/import/restore flows in the same phase. Test valid round trips, legacy values, malformed references, unsupported/newer versions, rejection precedence, and no target write on rejected restore. Test Memory and IndexedDB conformance for reads, writes, idempotency, stale-write/atomic-rollback, and migration behavior where applicable. Do not defer a changed family’s transfer work to S17. Do not bump schema/export versions unless the live contract requires it; if a version change is required by the actual permanent contract, make the complete version/migration/compatibility/golden-test/documentation update within this assignment without dropping data or weakening gates, and record exact before/after versions and rationale. Do not change versions merely for convenience.

**Phone and accessibility:** implement the approved Arabic-first RTL flow in the existing visual system. Cover empty/loading/read error/not found/dirty/saving/saved/conflict/unknown outcome/archived reference states truthfully; field-specific accessible errors; 0–9 numeric input; return and cancel paths; help that does not hide errors/effects; repeated taps; 320 CSS px and 360/390/430 px, long Arabic, 200% zoom/text resizing, keyboard/scroll behavior, RTL, and light mode according to current repository gates. DOM/browser simulation is not a real-device test: label it accurately and do not claim actual phone validation unless performed.

### 5.5 Architecture and implementation boundaries

- Preserve `UI → Application → Domain → storage port → adapters` and repository import boundaries. Business/financial rules and arithmetic belong in domain/application ownership, never in React pages.
- Pages/components call application services through the established service context. No direct page-to-storage access, no local/session storage for authoritative records, no deep import or allowlist bypass.
- All sensitive writes use existing `commit*`/capability patterns with live-state checks in the same transaction/atomic boundary and deterministic idempotency. Add real concurrent retry/stale-state regressions for every new sensitive path.
- Keep Memory and IndexedDB behavior semantically equivalent. A generic `save`/blind `put` is not an atomic fix.
- Register any persistent entity/touchpoint and update both adapters, schema/migrations, snapshot/transfer, capability guards, and documentation in the same slice. Do not create a new store merely because a screen exists; prove ownership and need first.
- No structural refactor, feature-folder introduction, broad file move, or file organization project is authorized by S09. Do not split large files or change module topology unless a separately approved structural-remediation wave allows that exact change.
- Preserve current hard limits, baseline policy, security exceptions, and all prior accepted history. Bundle-surface re-anchoring is allowed only when required, measured from a real run on this same PR/head, and documented by the repository’s existing procedure. Never raise a ceiling to hide a regression.

## 6. Execution sequence, commits, and continuous progress

Use one writer (ZAI). Work in small, independently testable slices; keep the phase commits separate:

1. Live preflight and safe checkpoint; create/update S08 and S09 Control claims before corresponding product-code work.
2. S08 characterization/regression tests, root corrections, focused tests, and a separate S08 code commit; then S08 result/Control/progress addendum commit(s). Do not pause for review. Proceed when focused tests pass.
3. S09 shared domain/data contract and pure calculation kernel; add domain tests and commit the completed coherent slice.
4. S09 draft persistence/recovery/identity/concurrency and adapter work; test each changed write path and commit separately.
5. S09 cost snapshots, scope/coverage/knowledge, cost editor and draft handoff; add exact numeric and failure tests and commit separately.
6. S09 saved offering, revision/snapshot/explicit-save behavior, context reuse, and relevant UI; add service/adapter/UI tests and commit separately.
7. S09 transfer/migration/compatibility, persistent-entity records, and any necessary reader contracts; test round trips and compatibility and commit separately.
8. Run the final complete verification and five sequential read-only review passes on the stable final candidate. Fix all confirmed in-scope findings on the same branch with additional clearly labeled commits; rerun affected tests and the final full check on the final code state. No silent semantic change or unrelated cleanup.

After each slice, record its exact tested commit and results. Do not run the full `pnpm check` repeatedly without code changes; one full canonical check on the final combined code state is required. Run focused tests during development and after relevant fixes. Resolve ordinary failures and proceed without asking the owner.

## 7. Tests and final gates

First inspect the current `package.json` scripts, test configs, applicable test helpers, and repository-specific gates; use the actual canonical commands. Required at minimum:

- focused S08 transfer/asset/party-reference tests for `S08-MR-001/002` before S09 code;
- focused S09 domain, service, adapter, transfer/migration, and UI tests for each touched contract;
- repository canonical `pnpm check` once on the stable final code candidate, with exit code, counts, warnings, measured surfaces and exact SHA recorded;
- all applicable quality/security/Control/documentation guards mandated by `AGENTS.md`, including test-focus/secrets/entity-touchpoint, generated-doc consistency, `git diff --check`, and bundle gates where applicable;
- GitHub Actions and Cloudflare Pages status on the **exact final pushed HEAD**. Wait for both to reach terminal success, inspect exact run/deployment SHA, and repair any failure at its root cause. Do not claim a green result from an earlier head. Do not stop after publishing while checks remain pending.

Never use `.skip`/`.only`, lower coverage, change precedence, disable a guard, or alter an approved security exception. A failing automated gate is a repair task, not a reason to ask the owner to continue.

## 8. Five sequential read-only reviews

Run five distinct specialist reviewer subagents **one at a time, sequentially**, read-only, on the final candidate diff; they must not edit code or records. If the ZAI environment does not support subagents, perform five clearly separated read-only reviewer passes yourself and do not claim subagent execution. Preserve each reviewer’s scope and include all five reports in one unified final report. This is a final quality step, not an intermediate user/owner approval gate. Avoid rerunning full suites in reviewers; ZAI owns tests and records their exact evidence.

- **R1 — Ownership and architecture:** S09 boundaries, SH-13 ownership, layers, duplication/source of truth, no structural refactor.
- **R2 — Financial/domain correctness:** money/quantity/scope/rounding, knowledge/coverage, no double count, PD-01 and no financial side effects.
- **R3 — Storage and lifecycle:** CAS/atomicity, idempotency, draft recovery, stale writes, Memory/IndexedDB parity, rollback/no partial write.
- **R4 — Transfer/security:** S08 fixes, S09 export/import/restore, migrations, malformed references, no secrets, rejection/no-write behavior.
- **R5 — UI/accessibility and evidence:** user flow, Arabic/RTL/mobile states, accurate result/Control/progress/index/Manifest claims and SHA provenance.

If a reviewer identifies a possible issue, triage it with direct evidence. Fix every confirmed in-scope issue from root cause, add a permanent regression, and have the relevant reviewer reread the correction. Then rerun affected tests and the final full check if code changed. Do not claim an unverified reviewer pass.

## 9. Documentation, Control, PR, and final handoff

Update S08 evidence without rewriting its historical result. Create `13a-S08-REVIEW-FIX-ADDENDUM-2026-10-30.md`. Create `14-S09-RESULT-2026-10-30.md` with an acceptance/evidence matrix, files and responsibility changes, what was preserved/removed and why, data and financial effects, transfer/migration details, adapter parity, tests, review results, remote checks, known non-blocking limitations, and exact resume/checkpoint details.

Update DOC-017/WS-233 through the legal lifecycle and keep S08 `IN_REVIEW` / `REVIEW_REQUIRED` until independent review and owner acceptance. Create or update the valid S09 `DOC`/`WS` claim (expected `DOC-018`/`WS-234` only if confirmed available); track S09 as executing, then delivered for review, never accepted. Update `01-STAGES.md`, `02-PROGRESS-AND-HANDOFF.md`, append-only work log, `MANIFEST.md`, document index, current-state program summary only where repository policy permits, and other official JSON sources needed. Generate derived views using official scripts only. Do not invent reviewer identities or owner acceptance. Include the exact owner authorization and clarify that it authorized uninterrupted execution only.

Update the PR description and add one concise, factual delivery comment with the complete final head, separate S08 and S09 code candidates/commits, exact tested SHA, final CI/Cloudflare evidence, and next action. Do not paste credentials. Keep PR #383 Draft.

Final report must state:

- start live head, prompt-publication head, final full SHA, S08 corrected code SHA, S09 code candidate SHA, and any documentation-only heads;
- S08-MR-001/002 root fixes, regression tests, and proof that the previous overclaim was corrected;
- S09 scope, changed files grouped by owner, acceptance IDs and test evidence, and all out-of-scope work preserved;
- schema/export versions before/after and compatibility/round-trip evidence;
- exact commands, pass/fail counts, exit codes and SHA for focused and full checks;
- five reviewers’ findings and their closure/re-read evidence;
- exact GitHub Actions and Cloudflare run/deployment URLs and final SHA;
- S08/S09 Control states, owner-authorized continuous-execution note, and remaining independent-review/owner-acceptance obligations;
- confirmation: PR remains Draft; `main` was not written; no merge/rebase/force-push/branch cleanup/second branch/second PR occurred.

End with exactly one truthful status block (replace placeholders; do not claim acceptance):

```text
S08_REVIEW_FIXES — COMPLETE | <S08-MR-001,S08-MR-002 or exact blocker>
S09_EXECUTION — COMPLETE | REVIEW_REQUIRED
FINAL_HEAD — <FULL_SHA>
LOCAL_CHECK — <PASS/FAIL + EXACT_SHA>
GITHUB_ACTIONS — <SUCCESS/FAIL + EXACT_SHA + RUN_URL>
CLOUDFLARE_PAGES — <SUCCESS/FAIL + EXACT_SHA + DEPLOYMENT_URL>
S08_ACCEPTANCE — PENDING_INDEPENDENT_REVIEW_AND_OWNER
S09_ACCEPTANCE — PENDING_INDEPENDENT_REVIEW_AND_OWNER
PR — 383 DRAFT
NO_MAIN_WRITES_PERFORMED
NO_MERGE_PERFORMED
NO_REBASE_PERFORMED
NO_FORCE_PUSH_PERFORMED
NO_BRANCH_CLEANUP_PERFORMED
NO_SECOND_BRANCH_OR_PR_CREATED
```

If a genuine blocker prevents completion, first preserve a safe checkpoint and all existing work. Report the exact blocker, evidence, completed portion, last tested/pushed SHA, and precise next action. Do not falsely mark S09 complete or accepted.
