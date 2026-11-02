# Micro S14 Execution Prompt — Fix S12/S13 Review Findings, Then Implement S14

**Status:** Owner-authorized execution instruction. Publishing this file records the instruction; ZAI begins only when the owner sends the short start message. This is not stage acceptance, a merge authorization, or permission to change `main`.

## 0. Required outcome and execution sequence

Continue the existing Micro component program on its **single long-lived integration branch** and its **single Draft PR**. Preserve all work already present. Execute the following sequential workstreams, with only one active Operations Control claim at a time:

1. Resolve the confirmed residual S12 Memory atomicity evidence/implementation gap (`S12-ATOMIC-001`), and close the narrowly identified S12 test-evidence caveats below.
2. Fix the seven confirmed S13 review findings (`S13-MR-001` through `S13-MR-007`) at their roots.
3. Without waiting for a routine intermediate review or owner approval, proceed directly to the complete S14 implementation: **UNIT-002 / ACC-01 / JRN-010 / SH-18**.
4. Deliver one auditable handoff covering the S12 correction, the S13 corrections, and S14, with exact code and final-head SHAs, tests, five sequential independent reviewers, CI and Cloudflare evidence, Control status, and any genuine unresolved blocker.

Do not declare S11, S12, or S13 accepted. Their prior review states remain pending owner acceptance; after fixing the cited findings, return their records to their legal review-required states. S14 execution is authorized by this instruction, but this authorization is not a self-acceptance of any prior or current stage.

## 1. Repository, branch, and preservation rules

- Repository: `Qays7753/Micro`.
- The only permitted working branch is `components/integration-20261027`.
- The only permitted PR is Draft PR #383.
- Known starting point at prompt preparation: integration head `efca90d6297421322269ac1e81c3376e01a96cae`; program `main` base `3584aa1d08cea3e0a00623b719fed7f991ce187f`. Re-fetch and verify both refs, PR, checks, and PR comments at execution start. If the branch has advanced, work from the **actual live head** after inspecting its diff; this SHA is a checkpoint, not permission to reset or overwrite later work.
- Continue in the existing ZAI conversation/environment when available. Before editing, inspect branch, remote status, uncommitted/untracked files, stashes, and unpushed commits. Preserve every useful local change; never reset, clean, stash-drop, revert, or redo completed work blindly. If local changes are already part of the remote head, do not recreate them.
- Make separate, reviewable commits for the S12 correction, S13 corrections, and S14 implementation/documentation. Do not rewrite accepted history. No new branch or PR, no rebase/force-push, no branch cleanup, no direct `main` write, and no merge.
- Never put access tokens, credentials, or secrets in chat text, prompts, files, commands, logs, commit messages, URLs, or PR comments. Use the environment’s secure credential mechanism only; never echo a secret.
- Keep bundle hard limits unchanged: raw **650,000 bytes** and gzip **155,300 bytes**. Do not raise limits, ratchets, or tolerances. Measure and re-anchor only from real CI measurements on the exact final PR head using the repository’s established process.

## 2. Mandatory source reading and scope discipline

At the live starting head, read the root `AGENTS.md`, applicable nested `AGENTS.md` files, `docs/operations/current-state.md`, the current program instructions and handoff, the current Operations Control records, and the exact code/tests implicated below. Then read the S14 authority sources in the repository—not a chat summary:

- `docs/implementation/micro-component-execution/01-STAGES.md` — S14 card and acceptance boundary.
- `docs/implementation/micro-component-execution/02-SPECIFICATIONS/03-New-Design/UNIT-002-استكمال-بيانات-المشروع.md` — the complete current UNIT-002 P3 and applicable A/B and acceptance content.
- `docs/implementation/micro-component-execution/02-SPECIFICATIONS/05-Data-and-Implementation/02-Shared-Data-and-Financial-Contract-AR.md` — especially §§3, 5–7, 14, and 16, plus relevant later clauses.
- `docs/implementation/micro-component-execution/02-SPECIFICATIONS/05-Data-and-Implementation/03-Shared-Data-Acceptance-Cases-AR.md` and `DEPENDENCIES-AND-TRACEABILITY.md`.
- ACC-01, JRN-010, DATA-01, the relevant component ownership records, financial policies, and the existing source-owner specifications for every writer actually touched. Read UNIT-044 for the boundary between opening import and full backup/restore.
- The current source, storage adapters, import/export/migration validators, existing tests, router/navigation contracts, and relevant financial, storage, UI, bundle, and Operations Control guards.

Treat present code as the compatibility baseline and current head as the truth about implementation. Treat documented proposals as semantic requirements only where their approval state permits; do not invent store names, schema/export versions, migration contracts, transaction APIs, financial policies, or owner decisions.

## 3. Fix-first A — S12 residual review finding

Re-open DOC-021 / WS-237 only through legal Operations Control transitions and only for this bounded correction. Check the current histories and overlap validator first. Preserve the existing S12 result and add a dated review addendum (suggested path: `17b-S12-REVIEW-ADDENDUM-2026-11-02.md`; verify it is unused before creation).

### S12-ATOMIC-001 — prove/fix Memory post-write atomicity

The independent read-only review at `efca90d6297421322269ac1e81c3376e01a96cae` found that `MemoryLocalStore` clones the delivery bundle before the first `Map.set`; the poisoned-wallet test therefore proves **pre-write cloning failure**, not rollback after a Memory mutation has begun. The IndexedDB transaction-abort path is supported by the inspected transaction and test. Do not treat the earlier addendum’s claim as sufficient proof, and do not weaken the contract to make the test pass.

- Re-trace the exact live `commitOrderDelivery` implementation and existing atomicity test before changing anything.
- Implement the smallest root-level Memory storage design that guarantees all-or-nothing visibility for the order, inventory movements, shortages, cash entry, and wallet. A staged immutable bundle/state swap or a compensation/rollback design is acceptable only if it fits current architecture and handles every committed field; choose based on the actual code, not this illustrative wording.
- Add deterministic fault injection **after at least one actual Memory mutation has started**. Assert complete before/after snapshot equality across all affected stores, including existing records, IDs, operation keys, and financial/material values. A clone/validation failure before mutation is not an acceptable substitute. Keep the production API free of a public test-only feature switch; use the narrowest internal test seam or adapter technique that proves the real boundary.
- Keep and re-run the IndexedDB post-queue failure/abort regression and verify the exact same all-or-nothing invariant there. Do not claim a result for an SHA on which the test did not run.

### Small S12 evidence closures (not newly observed product defects)

- Add the symmetric `feeIncludedInPrice`-only changed-creation-payload regression for `S12-FIN-001`; the current canonical comparator appears to include it, but the review identified the isolated test as missing. Assert `idempotency_conflict` and no writes on both adapters where the existing test harness supports it.
- Strengthen `S12-TRANSFER-001` rejection proof with a seeded non-empty target and at least one IndexedDB restore/preparation case for malformed-present `followUpEvents`, asserting byte/record-equivalent target state after rejection. Existing implementation and current/legacy pair behavior passed static review; do not alter accepted transfer pairs or migration semantics merely to adjust the test fixture.

Required S12 evidence: focused tests on Memory and IndexedDB as applicable, plus the repository-required relevant checks. Update DOC-021/WS-237 through legal state transitions, preserving the “review required / not owner-accepted” meaning. Record exact tested code SHA and exact addendum SHA.

## 4. Fix-first B — seven confirmed S13 findings

After closing the S12 workstream, legally reopen DOC-022 / WS-238, verify no active overlapping claim exists, and address every item below in the same integration branch/PR. Preserve S13’s result and add a dated review addendum (suggested `18a-S13-REVIEW-ADDENDUM-2026-11-02.md`; verify the path is unused). Use focused characterization/regression tests that fail on the current behavior and pass after the root correction.

| ID | Confirmed finding and required root correction | Minimum regression evidence |
|---|---|---|
| `S13-MR-001` | `Orders.tsx` couples the order/draft read and calendar/schedule-community read through one `Promise.all` and one error state. Isolate these states so a schedule/calendar read failure does not hide otherwise readable orders or drafts. Provide a localized calendar/source error and retry without discarding healthy content. | Reject only the schedule reader while orders/drafts succeed; assert the list remains usable. Reject the order reader while schedule succeeds; assert each surface reports its own truth. Verify source-local retry does not reload healthy sources. |
| `S13-MR-002` | `UnifiedFollowUpService.read()` handles returned `{ok:false}` results but an actually thrown/rejected source Promise can reject the aggregate; `FinanceUpcoming` then replaces healthy sources with a full-page error, and its current retry reloads all sources. Catch both synchronous throws and rejected Promises per source, preserve healthy source results, expose failed-source state, and retry only failed sources. | Make one source throw/reject and other sources return tasks; assert healthy tasks remain visible, error count/source identity is truthful, and retry invocation counts show only failed readers were called again. Cover an error object and a rejected Promise separately. |
| `S13-MR-003` | Custom finance date filters validate `YYYY-MM-DD` shape but not a real calendar date, both when initialized from URL (`since`/`until`) and when applied. Use the repository’s real local-date validator and surface a field-level invalid-period state without silently projecting an empty result or erasing the URL/context. | Cover impossible month/day values (for example `2026-13-45`), valid leap day, missing boundary, reversed interval, initial deep link, and user-entered values. Assert invalid filters are not applied. |
| `S13-MR-004` | Schedule reads allow a malformed active `scheduledFor` to disappear from the calendar/appear as `—` rather than a repairable invalid-date state. Also, canceled schedules currently count toward `scheduledOrderIds` and may hide an active order’s “needs scheduling” state. Distinguish malformed-present, absent, canceled, completed, and active schedule states; surface invalid data honestly and do not let canceled records mask a live scheduling need. | Test malformed active schedule visibility/repair affordance in Orders and Finance; active order with only a canceled schedule appears as needing scheduling; completed/delivered and genuinely unscheduled cases keep their specified behavior. |
| `S13-MR-005` | CAL-C `?propose=` parsing accepts a shaped but impossible date, presents a proposal that later fails silently when stored. Validate the date at the deep-link boundary using the shared local-date policy; show an honest invalid-context state or safely ignore the proposal with a clear message. Keep the proposal in-memory only and one-time. | Page-level tests for valid, impossible, missing, and stale proposal query values; invalid input must not be shown as a valid proposal or create a schedule; retain one-time in-memory consumption and zero browser-storage calls. |
| `S13-MR-006` | Month calendar declares `role="grid"`/`gridcell` but has no corresponding roving focus or grid keyboard behavior. Implement accessible grid semantics (including correct row/column structure, roving tab stop, arrow-key movement and focus/selection behavior appropriate to RTL, Home/End and month boundaries), **or** use accurate non-grid semantics if retaining simpler button behavior. Never leave a grid role that falsely promises unsupported keyboard behavior. | DOM/accessibility tests for keyboard-only month navigation, focus visibility and order, RTL direction, selected day announcement, and transition between month/week/day. Test with the chosen semantic contract, not only role presence. |
| `S13-MR-007` | The supplier-payable action is labeled “تسجيل دفعة” but links to the generic purchase route instead of the registered payment route. Route to the specific payment owner/action, preserving `returnTo` and existing authorization/ownership boundaries. | Assert the supplier row action resolves to the registered payment route for the right purchase and includes safe return context; do not invoke a write merely by opening it. |

These findings are in the existing S13 scope. Do not change financial meanings, create a financial writer, weaken dates/accessibility/source-isolation guards, or expand into S15. Keep the already-supported S13 boundaries: read-only financial/scheduling projections, no new persistent proposal storage, current schema/export unchanged unless the source contract truly requires a separately justified change, Amman local-date semantics, and existing return context.

After all seven corrections, update S13 evidence and return DOC-022/WS-238 to legal review-required states. Do not mark S13 accepted or VERIFIED. Record the exact code SHA and the addendum SHA separately.

## 5. S14 — complete implementation scope

Proceed directly to S14 after the S12 and S13 corrections above have been implemented, tested, committed, and returned to review-required status. Create the S14 item/workstream **before product code changes**, using the current Control schema and only if the IDs remain free (DOC-023 / WS-239 were unused at prompt preparation). Use the existing single branch, PR #383, live branch head as `base_sha`, and the exact current stage/reference paths. Check generated active-work and overlap rules; REVIEW_REQUIRED records are not permission to falsify history. If a genuine active overlapping claim exists, resolve it only through the legal Control process before proceeding. Update JSON sources first, regenerate tracker views, and validate; never hand-edit generated views.

### User outcome and core journey

Implement UNIT-002 as an **optional completion coordinator**, not a mandatory setup gate and not a second ledger:

- A new project owner can choose “from today” or freely select a valid earlier date using the established calendar/date behavior.
- A returning owner can choose an unrecorded period and add only what is not already represented. “Last visit” is not a financial close or a presumed missing period.
- Ask only the questions needed for the chosen route. Show a concise truthful preview, allow the specified details to expand when useful, and let the owner review/cancel before commitment.
- Preserve safe entry, return, cancellation, and history context. Choose the smallest existing navigation owner/surface consistent with UNIT-002, UNIT-001/038 and the live navigation contracts; do not add a duplicate menu, independent ledger page, or competing route.
- Entry, reading, date selection, preview, expansion, navigation, retry, and cancellation are read-only. No financial or inventory write occurs before the explicit final commit.

### SH-18 / data and financial invariants

1. **Source ownership:** UNIT-002 coordinates plans and source-owned commands. It does not become a financial writer. Preserve owner boundaries for direct sales and collections, purchases/payments/receipts, expenses/payments, owner intent, cash and stock observations, assets, optional parties, agreements/orders, drafts, and transfer/restore. Reuse existing writers and guarded commit boundaries; do not create a second ledger or parallel balance source.
2. **PeriodSummary and coverage:** Represent only the dimensions applicable to each source (revenue, received, paid, cost, quantity, remaining claim, etc.), each with independent knowledge. Preserve period, source/owner, revision, recorded timestamp, and coverage links. Existing totals remain totals when detail is added; detail covers the relevant dimensions and is never added twice.
3. **Knowledge is not zero:** Keep `known`, `estimated`, `unknown`, `skipped`, `none`, and `not_applicable` distinct wherever the source contract requires them. Missing answer, failed read, unsupported history, or unknown date/amount never becomes zero, “none,” or today. Never create an unknown-amount financial event.
4. **No invented time/history:** Preserve actual `occurredOn` and `recordedAt`; time is optional only if actually known. Historical totals remain period totals, not fabricated day-level events. Do not assign today’s date or proportionally distribute old receipts/costs. A prior aggregate receipt without known dates remains historically under-specified.
5. **Observation semantics:** Cash/stock observations have explicit scope, cutoff, coverage, and knowledge. An observation is not financing, waste, purchase, consumption, or an automatic adjustment. Never sum overlapping project/wallet observations; never let an old receipt already covered by a current measurement inflate current cash.
6. **Opening commercial right:** A qualified, identified prior commercial right remains an opening right from its real source, not revenue today, a new loan, a duplicate receivable, or a free-standing editable party balance. Unknown debtor remains limited-knowledge historical information, not an arbitrary customer claim. New policy for prior-owner-right access or a new balance method must not be invented.
7. **Atomicity and intent:** Build a truthful read snapshot and preview. Commit the coordinated source plans, coverage, observations, and command receipt atomically, or use only an explicitly specified safe split with declared resumable outcome before any write. Carry command identity, canonical payload/generation, source revisions, stale-state checks, idempotency, and retry semantics. A confirmed failure leaves no half-success; outcome-unknown resumes the same intent and blocks a second intent. Memory and IndexedDB must satisfy the same observable contract.
8. **Draft and size:** Drafts preserve `kind`, schema version, project ID, generation, full payload, and update metadata. Prove refresh/close/resume and stale-generation behavior. Current 32 KB limit cannot be silently exceeded, truncated, or bypassed with financial `localStorage`. If larger storage is truly needed, choose an explicit schema/size plan with boundaries and tests, or a declared resumable batch design before implementation.
9. **Coverage arithmetic / required acceptance:** Prove the stage-card-owned SDF cases `SDF-007, 017, 018, 019, 023, 024, 025, 026, 027, 028, 029, 030, 036, 050, 066, 071, 072`. In particular:
   - Summary 200 revenue / 120 received / 80 cost plus detail 80 / 30 / 20 leaves 120 / 90 / 60; original totals remain unchanged.
   - Unknown receipt/cost is not inferred proportionally (never infer 48/32); a detail beyond the remaining covered amount is refused before write; an already-recorded operation is not duplicated by similar amount.
   - A current observation of 200 and an old receipt of 30 already covered by it do not become current cash 230; the receipt remains historical in its own period.
   - Same-day event/observation without enough time evidence stays explicitly covered or unresolved; a period crossing a measurement cutoff is not distributed across days.
   - A qualified prior right of 50 is not today’s sale, is not duplicated with a live source, and is not treated as a loan; unknown debtor is not assigned to an arbitrary party.
   - Five units with unknown value remain quantity-known/value-unknown; tracking-mode change creates no invented waste/consumption or silent past reclassification.
   - Draft survives refresh/close; stale generation is rejected; multi-source failure rolls back; >32 KB behavior is proven without truncation or fallback.
   - Existing asset with missing history is not treated as a purchase today or given invented age; correction with dependent consumption, coverage, and cash assignment is fully bounded or refused with a clear reason.
10. **SDF list reconciliation:** The stage card and canonical SDF ownership table assign the 17 cases listed above to S14. UNIT-002 P3.6 also mentions `SDF-015` while omitting `018/019/026/066/071`; the canonical ownership table assigns `SDF-015` to S04 and assigns those five omitted cases to S14. Treat the 17 stage-card/canonical-owner cases as S14’s required acceptance set. If S14 touches the shared cash observation code, run the `SDF-015` companion regression as a cross-stage safety check, but do not claim S14 owns/accepts SDF-015.

### S14 implementation and compatibility boundaries

- Start from the live code at the actual execution head. Inspect existing `Foundation.tsx`, `guidedOpeningImportService`, route/context handling, profile/generation, financial/source-owned capabilities, `FormDraft` constraints, Memory/IndexedDB adapters, and current export/import validators.
- The existing `guidedOpeningImportService` is an empty-store opening import, not a complete S14 completion flow. Do not silently broaden its wire/file format or conflate it with full backup/restore (UNIT-044/S17). Decide and document a bounded integration that preserves both contracts.
- No schema/export version change by assumption. If persistent shapes change, first document the exact required delta; update the storage type, both adapters, migrations, snapshots, import/export validators, compatibility/golden tests, and `persistent-entity-touchpoints.json` in the same stage. Keep current released transfer pairs and older supported imports. Prove round-trip preserves identity, generation, knowledge, coverage, history, and does **not** re-execute financial effects. Never silently drop fields or downgrade data.
- Before cross-source writes, prove a consistent read snapshot and source revision boundary. Extend existing guarded commit machinery rather than bypassing it from UI. Include stale/concurrent updates, replay with same intent, conflicting intent, confirmed failure, unknown outcome, rollback, and recovery/resume.
- UI: Arabic-first, RTL, phone-first at 320–430 px, vertical layout, clear amount/date/knowledge labels, digits 0–9 via existing numeric components, JOD formatting, visible field-level errors, accessible `!` help, focus/keyboard behavior, and truthful loading/empty/partial/failure states. Preserve user inputs on recoverable error; cancel means no write. Do not perform a general visual redesign beyond this journey’s specified design.

### Explicit S14 out of scope

No S15 financial reports/budgets/readers/capability retirement, S17 comprehensive backup/restore migration, S18 final acceptance, cloud/auth/sync, new 002 ledger, second financial writer, automatic reconciliation/adjustment, last-visit close, speculative loan/market/PIN/share feature, or broad redesign/refactor.

**Structural scan gate:** The existing S11 structure/architecture/code-organization scan has proposed waves marked `NOT_EXECUTED` pending owner review. Do not perform structural refactoring, bulk moves, broad file splitting/renaming, layer reorganization, or code-organization cleanup in this connected task. You may create a narrowly scoped feature-owned file only when S14’s approved behavior cannot be implemented cleanly in existing homes and the new file has one direct S14 responsibility. If a proposed structural-scan item is genuinely required, do not execute it under this prompt; report the exact item, dependency, risk, and smallest alternative for owner review.

## 6. Control, records, and no-stop behavior

- Use Operations Control as a real guard, not paperwork to bypass. Before each sequential workstream, validate current IDs/status history, active claims, areas/contracts, branch, base SHA, and PR. DOC-023/WS-239 were free at prompt preparation; re-check before use and never re-use an ID if another actor has created it.
- Keep only one active claim at a time: S12 correction, then S13 corrections, then S14. Reopen DOC-021/WS-237 and DOC-022/WS-238 only through legal transitions, with each claim’s actual areas/contracts. On completion of each correction, return it to review-required status and release the active claim without marking it accepted. Then establish S14’s own claim before S14 product edits. Preserve all `status_history`; never edit generated tracker files by hand.
- For routine implementation questions, use the best answer supported by the approved source contracts and continue; do not pause for cosmetic preference, missing explanatory prose, or a correctable documentation issue. Do not ask the owner to re-approve already approved policy. **Stop only** for a genuine unresolved financial/product/security/compatibility decision that cannot be implemented without inventing policy, an active claim overlap that cannot be legally resolved, a required unapproved structural refactor, an unsafe/unresolved migration, unavailable authorization, or a failing required gate that cannot be safely repaired. State the exact evidence and smallest owner decision needed; never hide, defer generically, or work around it.
- Before any planned context/session limit, save a durable checkpoint commit on the same branch where safe, update the result/handoff with completed vs remaining tasks, exact local/remote SHAs, and next command. Do not say “done” based on uncommitted local work. If interrupted, resume from the live branch and preserved environment state; inspect first, do not redo completed work.

## 7. Tests, review, CI, and delivery requirements

### Tests and local gates

- Add failing-first characterization tests for each S12/S13 finding, fix at the root, and retain durable regressions.
- For S14, add focused domain/application tests, Memory/IndexedDB parity and transactional/fault-injection/concurrency/replay tests where applicable, schema/export/import compatibility tests if persistent data changed, and page/navigation/accessibility tests. Exercise every applicable SDF and explicitly mark genuinely not-triggered cases with reason; do not claim an untriggered case passed.
- Run the relevant focused suites after each correction/workstream. Then run the repository-mandated full `pnpm check` on the exact final S14 code candidate and all prescribed guards from the current `AGENTS.md`/package scripts. Record exact commands, exit statuses, counts, warnings, and SHA. Do not weaken tests, guards, ceilings, baselines, or tolerances to obtain green results.
- Update Operations Control JSON sources first, regenerate tracker views using the prescribed scripts, then run the validator and generated-view checks. Run `git diff --check`, document index/size/agent contracts, bundle-surface guards, and any applicable schema/transfer/security gates.

### Five sequential read-only reviewers

After implementation and local tests, run five **sequential**, independent, read-only specialist reviews against the same exact code candidate: (1) UNIT-002/financial/knowledge/coverage semantics; (2) transaction, storage parity, migration/export/import and command recovery; (3) S14 failure, concurrency, rollback, stale-generation and test adequacy; (4) mobile RTL navigation, accessibility, keyboard and return-context behavior; (5) cross-stage scope/Control/architecture/bundle/compatibility audit. Reviewers must not edit, test, commit, or comment. Capture each reviewer’s scope, exact SHA, findings, and disposition. Fix every confirmed in-scope finding at its root, run the relevant regression and full applicable gates again, then have the relevant reviewer re-read the exact corrected SHA. Do not stop for a routine review round; continue until there are no confirmed in-scope findings or a genuine stop condition above.

### Exact remote gates

Push only to `components/integration-20261027` and update only PR #383. After the **last** code, documentation, control, or bundle-baseline commit, wait for GitHub Actions and Cloudflare Pages to finish on that exact final head. Fetch and verify the live SHA before reading status; report each status and URL/SHA. If either gate fails, diagnose and fix the cause without raising limits or changing `main`, push a new commit to the same branch, rerun applicable local tests, and wait for both remote gates on the new exact head. A green check on a prior SHA is not evidence for a later SHA.

## 8. Final artifacts and truthful handoff

Preserve original stage reports and add, if needed, the dated S12/S13 review addenda proposed above. Create the S14 result at `19-S14-RESULT-2026-11-02.md` if free; if occupied, choose the next unused result identifier and update all links. Update the document index, Manifest, S14 stage card, program progress/handoff, and relevant Control JSON/generated views only with verified facts.

The final result must include:

- exact original start head, S12-fix code SHA, S13-fix code SHA, S14 code candidate SHA, and final documentation/control head (distinguish each);
- commits and file/responsibility summary per sequential workstream;
- each review finding’s evidence, root cause, fix, regression, exact retest SHA, and disposition; specifically disclose the S12 Memory post-write atomicity test mechanism;
- complete S14 coverage matrix for UNIT-002 P3/A/B, ACC-01, JRN-010, SH-18, all 17 owned SDF cases, cross-stage tests, exclusions, migration/export status, and remaining unsupported behavior;
- focused and full local tests with exact commands/results, five reviewer reports, bundle measurements, Control transitions, and exact-head GitHub Actions/Cloudflare evidence;
- the current states of DOC-020/WS-236, DOC-021/WS-237, DOC-022/WS-238, and S14’s new records. S11/S12/S13 remain pending review/owner acceptance; S14 is delivered for review, not self-accepted.

Update PR #383’s description/comment with a concise delivery pointer and final exact head, without creating another PR. End with one copyable status block stating what is complete, what remains, and the exact next owner action (review/acceptance or the specific genuine decision). No merge, no main write, and no claim that the program is ready to merge.
