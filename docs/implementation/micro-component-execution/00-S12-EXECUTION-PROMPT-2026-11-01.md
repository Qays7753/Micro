# Micro S11 Review Fix → S12 — Owner-Directed Connected Execution Order

- **Date:** 2026-11-01 (Amman)
- **Repository:** `Qays7753/Micro`
- **Only implementation branch:** `components/integration-20261027`
- **Only pull request:** #383 — keep Draft
- **Program base (`main`, read-only):** `3584aa1d08cea3e0a00623b719fed7f991ce187f`
- **Verified integration head before publishing this order:** `21d5a2d9a495d59920a140805b12621aa62e91b0`
- **Current S11 result:** `docs/implementation/micro-component-execution/16-S11-RESULT-2026-10-31.md`
- **Current S11 structural scan:** `docs/architecture/refactoring/s11-structure-scan-20261031/S11-STRUCTURE-ARCHITECTURE-CODE-ORGANIZATION-SCAN-REPORT-2026-10-31.md`

## Owner authorization and sequence

The owner authorizes one connected execution in the current ZAI conversation and on the existing integration branch / PR:

1. Fix the two independently identified S11 direct-sale UI/specification gaps below, add durable regression coverage, and record the correction without claiming S11 acceptance.
2. Once the S11 correction is implemented and its focused tests pass, proceed directly—without an intermediate owner-review or approval pause—to implement the complete S12 scope (UNIT-009, UNIT-010, UNIT-011, and the order-payment adapter slice of UNIT-026, owned by SH-16).
3. Finish both work items, run the required local and exact-head remote gates, complete five sequential read-only reviews, repair every confirmed in-scope issue, and deliver the full evidence package.

This authorization is **not** acceptance of S08, S09, S10, S11, or S12; it is not permission to merge; and it does not authorize any `main` write, structural remediation, unresolved financial-policy decision, or change to project-wide visual foundations. Do not pause for routine clarification, intermediate review, documentation cleanup, or a fixable test/CI/Cloudflare failure. If a truly unresolved owner decision or irreconcilable contract/data/security risk makes a specific S12 behavior unsafe, preserve completed work, continue independent safe work, and report the exact blocker; never invent a financial/product decision to avoid reporting it.

Publishing this order is documentation only. Execution begins when the owner sends the short start message referencing this file. After that message, continue this full sequence in the same ZAI conversation without waiting for another approval between the S11 correction and S12.

## 1. Non-negotiable repository, safety, and architecture boundaries

- Work only on `components/integration-20261027` and PR #383. Keep the PR Draft.
- Never write to `main`, merge, rebase, force-push, delete branches, close the PR, change its Draft state, or create another branch/PR. Appending separate commits to the existing integration branch requires no intra-branch merge.
- Preserve all existing local, uncommitted, untracked, and unpushed work in the ZAI environment. Inspect before cleanup. Never reset, discard, `git clean`, or remove a repository. Remove only generated temporary artifacts proved unrelated and safe to remove; list anything removed.
- Load and follow the current repository instructions before acting: `AGENTS.md`, the routed CORE context packs, `docs/operations/current-state.md`, `docs/operations/control/generated/AGENT-BRIEF.md`, `docs/operations/control/generated/ACTIVE-WORK.md`, Operations Control sources, `docs/implementation/micro-component-execution/02-PROGRESS-AND-HANDOFF.md`, and the source specs listed below. Run the official Control validator and inspect all open PRs and active Workstreams before creating a claim.
- **Post-Group 6 / S11 scan gate:** the S11 Structure/Architecture/Code Organization Scan is read-only, owner decision pending, and its proposed waves are `NOT_EXECUTED`. Do not do structural refactoring, broad file splits, bulk moves, mass renaming, new `features/` layer, or code-organization changes as part of the S11 UI correction or S12. Preserve the already implemented and documented lazy-loading pattern. Do not interpret the existence of the scan as authorization to execute any wave. If a genuinely required structural action emerges, document it and leave it for an explicit owner decision; continue independent work where safe.
- No semantic, financial, date, source-ownership, rejection-precedence, persistence, export/import, or security change may be hidden inside a UI cleanup or structural change. Do not weaken tests, guards, thresholds, baselines, allowlists, lint limits, bundle budgets, or size ceilings.
- Never paste, print, commit, or log tokens, credentials, or secrets. Use only a secure credential facility if the environment requires authentication; do not request a token in prompt text.

## 2. First response and safe continuation (no wait)

Continue in the current ZAI conversation; do not restart the task from scratch. First send one concise Arabic status update containing:

1. Local branch, full HEAD, upstream relation, dirty/untracked files, unpushed commits, and whether the local machine contains work not yet on GitHub.
2. Live `main`, integration branch head, PR #383 state/base/head, latest PR comments, and GitHub Actions / Cloudflare status for the exact live head.
3. A brief machine load/space/temporary-leftovers and available-tool assessment, plus why remaining work may take time and a realistic time estimate labeled as an estimate, not a promise.

Then continue immediately without waiting for a reply. Preserve local work. Fetch and inspect before reconciling; fast-forward only when safe. If histories diverge, preserve both and resolve without rewriting history. Do not repeat completed tests unless the tested code or its dependencies changed; any test evidence must identify its exact SHA.

## 3. Live provenance and Control claim sequence

1. Re-verify that `main` remains `3584aa1d08cea3e0a00623b719fed7f991ce187f`, and verify the live integration branch, sole PR #383 (open/Draft/base/head), open PR inventory, comments, and exact-head check/deployment SHAs. The pinned `21d5a2d9…` is the head verified before this order was published, **not** a substitute for rechecking the prompt-publication head and execution-start head.
2. Record the full prompt-publication SHA and actual execution-start SHA separately. If GitHub has advanced, inspect and preserve the newer head; never overwrite or assume it matches the pin.
3. S11 currently remains delivered for review, not accepted. DOC-020 / WS-236 are pending independent review/owner acceptance. Reopen the S11 review item only through legal Control transitions before recording the UI correction; after correction, return S11 to an honest review-pending state. Never mark it accepted, `VERIFIED`, or merged.
4. Before S12 code, create the S12 Item and Workstream from JSON source only. `DOC-021` / `WS-237` are the next expected identifiers **only if still unused and legal**; check live files, history, schemas, and overlap first. If unavailable, select the next unused valid IDs and state why. Use `SH-16` and S12’s exact live scope. WS-236 in `REVIEW_REQUIRED` is not an active claim under the validator, but verify the actual active-claim set and every area/contract overlap at execution time. Resolve through legal lifecycle; never bypass validation by editing a generated view or weakening overlap checks.
5. After each JSON change, run `python3 scripts/operations-control/generate_tracker.py`, `python3 scripts/operations-control/validate.py`, and `python3 scripts/operations-control/generate_tracker.py --check`; refresh Excel metadata only if the official source procedure requires it. Do not edit generated tracker views manually.

## 4. Fix first — S11-MR-001 and S11-MR-002 (UNIT-005 direct-sale UI)

### Evidence and scope

The independent review of final S11 code at `21d5a2d9a495d59920a140805b12621aa62e91b0` found two UI/specification gaps. The relevant canonical design is in `UNIT-005` itself, especially `A2 — شاشة «تسجيل بيع مباشر»` (lines 381–398), `A3` (400–410), `B3 — الحقول` (500–523), and `B5 — الحفظ والمسودات والقراءة والأخطاء` (554–588). This is a component-level screen/flow specification, not approval to restyle Micro globally.

- `S11-MR-001 — DIRECT_SALE_FORM_FLOW_MISMATCH`: `DirectSaleEditor.tsx` currently places item/quantity before the total, represents full payment by leaving the collected amount blank, and lacks the concise sale/collected/remainder preview beside save. This does not follow the explicit A2 hierarchy and visible payment choices.
- `S11-MR-002 — OPTIONAL_CUSTOMER_HIDDEN_FOR_FULL_PAYMENT`: the optional party/customer block in `DirectSaleEditor.tsx` is rendered only when there is a difference or a name is already entered (current condition near lines 1023–1024). A user cannot initiate optional customer entry for a fully paid sale, although UNIT-005 A2/B3 requires the optional customer to remain available even for a fully paid sale.

The current code locations cited above were verified at the pinned review head. Re-check the live code and exact line locations at execution; if intervening work has already fixed one issue, verify it, retain its evidence, and do not redo it.

### Required root correction

Implement the UNIT-005 A2 flow in the existing direct-sale editor, reusing the current design primitives and preserving the established financial/source contracts:

1. For **new sale creation**, put the sale total first and make the payment intent explicit in the UI: full payment; partial payment with the remainder explicitly treated as debt; or no payment with the remainder explicitly treated as debt. A2’s separately specified “different case?” path must remain available only where needed for the already supported `price_cut` / `needs_review` meanings. Do not ask a redundant second debt question after the user explicitly chose a debt mode. Preserve the current supported meanings and precedence of `remaining_debt`, `price_cut`, and `needs_review`; never silently infer a debt, price reduction, or review state.
2. Map these modes to existing storage/service fields without changing their meaning: full receipt equals the entered sale total; partial receipt must pass the existing exact validation; no receipt is zero only because the user explicitly selected “لم أستلم”; blank/unknown input must not be reinterpreted as a financial zero. Preserve the distinction between sale revenue, actual dated collection, remaining claim, and unknown versus known-zero cost.
3. Show wallet/cash destination only when an actual positive collection is being recorded; preserve explicit “غير موزع” and loading/error/ready distinctions. Do not create a new wallet or assign one silently.
4. Keep cost knowledge and sale date visible as specified, with cost unknown remaining distinct from known zero. Put description, quantity, product/service, and optional customer data in the appropriate optional/details grouping from A2, without dropping any currently required field, draft value, source context, or accessibility label.
5. Make optional saved/new customer entry available to a fully paid sale even when no name or difference exists yet. It must remain optional, must not force creation of a permanent party, and must not infer identity from a matching name. Preserve the selected `customerPartyId`/snapshot behavior and the existing optional-save isolation from the financial sale write.
6. Add a short, truthful preview adjacent to the save action showing the sale total, amount collected, and remaining amount; show a customer name only where applicable and already entered. The preview must derive from the active valid intent and match the persisted command, not from stale or invalid text. Do not present a review paragraph as a substitute for the required concise preview.
7. Keep the existing view-first/edit/cancel/return/refund behaviors for saved sales. Do not apply creation-mode defaults to an existing record; do not resuggest current catalog values into historical sales; do not change the direct-sale domain rules, collection policy, return/refund policy, financial dates, or data model unless an independently proven requirement makes a change necessary and the full compatibility path is completed.
8. Preserve and compatibly restore existing S11 drafts and operation identity. Explicitly test migration/interpretation of any pre-existing draft shape (including the existing `collectedEmpty` meaning) so drafts are not lost, overwritten, or silently assigned a new payment meaning. Keep `operationKey` stable for retries and do not create financial writes while switching modes, expanding/collapsing details, restoring/discarding a draft, or navigating away.
9. Use the current Micro component/tokens only. Do not implement the future system-wide visual redesign, create a second design system, change global styling/tokens, or restructure files. UNIT-005 A2 explicitly defines screen structure, not a new visual identity.
10. Add durable focused UI regression tests for: required field order; all three explicit payment modes; exact amount validation and preview; no redundant debt-choice prompt; separate price-cut/review choices when applicable; optional customer availability for fully paid sales; required party identity only for confirmed debt according to the accepted contract; existing draft restoration/legacy mapping; no writes on mode change or expansion; saving/loading/unknown/error states; Arabic RTL, keyboard/focus, and return behavior. Extend nearby existing tests rather than creating a parallel harness.
11. Review the remaining S11 owner-visible notes in `16-S11-RESULT` §5. Only close a note when its current evidence is verified. In particular, check whether the `جارٍ…` labels and empty/conflict UI coverage are still deficient; fix them within S11 if confirmed and local to this slice, otherwise record a precise reason and leave the note visibly open. Do not claim these secondary notes are resolved by the two findings above.

Commit the S11 UI code/tests as an S11-specific commit. Append `docs/implementation/micro-component-execution/16a-S11-REVIEW-ADDENDUM-2026-11-01.md` (or the next unused ordered S11 addendum name) with finding IDs, evidence, exact root cause, fix, regression tests, code/test SHAs, remaining owner-visible notes, Control transitions, and explicit statement that S11 remains pending independent review and owner acceptance. Update DOC-020 / WS-236 source records legally and regenerate views. Do not overwrite `16-S11-RESULT` or alter its historical tested SHAs.

After the focused S11 regression passes and the correction is safely checkpointed/committed, proceed immediately to S12. Do not wait for a separate S11 owner acceptance between these two tasks.

## 5. S12 source authority, goal, and ownership (SH-16)

Before S12 implementation, read the current versions at the actual execution-start head, not merely from this prompt:

- `docs/implementation/micro-component-execution/01-STAGES.md` — live S12 card, dependency and acceptance gates.
- `docs/implementation/micro-component-execution/DEPENDENCIES-AND-TRACEABILITY.md` — owner SH-16 and dependency boundaries.
- `UNIT-009-الاتفاق-والعربون.md`, `UNIT-010-تفاصيل-الطلب.md`, `UNIT-011-مراجعة-التسليم.md`, and `UNIT-026-تسجيل-دفعة-على-مستحق.md` — read each current P3, A/B, B-DUP/ACD, acceptance, exclusions, and decision-status sections.
- `02-Shared-Data-and-Financial-Contract-AR.md`, `03-Shared-Data-Acceptance-Cases-AR.md`, applicable approved-decision source(s), relevant financial contracts, current architecture/storage/transfer code, test files, and routed repository packs.

S12 is **agreement, order execution, delivery, and settlement**. Its user-facing flow and data truth are defined by the component design files’ A/B sections. Implement that approved component flow; do not replace it with a generic redesign or treat current code as the design authority.

Ownership boundaries:

- UNIT-009 owns creation of the order agreement and initial deposit intent within the order source.
- UNIT-010 owns order-detail coordination, order state, eligible next action, corrections, cancellation, and source-consistent return behavior.
- UNIT-011 owns the delivery-review/fulfillment command and its event, snapshot, qualified consumption, and any explicitly chosen delivery collection within one safe write boundary.
- UNIT-026’s **S12 order adapter only** supports a later payment against an eligible live order source. It must not rebuild the shared collection core or the direct-sale adapter completed in S11. Preserve UNIT-009 initial deposit and UNIT-011 delivery collection as their owners; do not send the same payment through UNIT-026 again.
- Domain calculations/types stay in their owning domain; UI does not own financial policy or write storage directly. Follow UI → application → domain → storage capability/adapter. Use existing source-specific commit guards/capabilities where possible; add only the narrowest required source-owned capability if the contract requires it. Memory and IndexedDB must have the same observable behavior.
- Use existing readers/view models and update only those whose source contract changes. No parallel order ledger, payment source of truth, delivery writer, inventory writer, or financial summary.

## 6. S12 required product/data behavior

Implement every in-scope requirement in the live stage card and component specifications, including at minimum:

### Agreement and initial deposit — UNIT-009

- Preserve one order/agreement source, the price, cost knowledge, due-date knowledge, customer/reference snapshots, delivery-charge assumptions, and all source revisions as distinct facts.
- Keep an unknown cost/date/delivery amount different from zero, a date, or an empty successful read. Use exact safe integer minor units; do not add float arithmetic or new rounding rules.
- A saved agreement alone does not create delivery, recognized revenue, profit, material consumption, or a payment. An initial deposit is a dated actual receipt only when explicitly entered. It must not be added twice, treated as revenue, or mistaken for the post-delivery remainder.
- Apply only owner-approved PD-01/PD-02 and the live decision log within their stated limits. Do not infer approval of a proposal from its presence in A/B or P3. No new delivery-fee allocation, profit, tax, refund, retained deposit, or debt policy may be invented.
- Preserve source snapshots and history; do not reprice a historical agreement from a current catalog or cost estimate.

### Order detail and correction — UNIT-010

- The order detail reader must derive status, recorded amount, actually collected amount, remaining claim, eligible next action, and event/correction history from the authoritative saved order and its events.
- Viewing, refreshing, changing display, opening/closing disclosures, navigating, or reading must not write agreement, payment, delivery, or consumption data.
- Keep delivery status distinct from money status. `ready`, `delivered`, `settled`, or a date alone must not imply collection, full payment, or profit. A confirmed post-delivery collection is not new sale revenue.
- Preserve raw user inputs and drafts through validation errors, conflicts, cancellation, reload/recovery, and unknown outcomes. Recheck source versions and eligibility at the storage write boundary; same-intent retry returns the same result, changed-payload reuse conflicts honestly, and concurrent commands cannot double-write.
- Correction, cancellation, delivery reversal, actual refund, and commercial return are distinct operations. Keep the original history and use only approved full-return behavior. Do not invent partial commercial returns, automatic cash refunds, or automatic inventory/material restoration.
- Only expose the existing eligible next action for the live state. If a contract or decision leaves an action ineligible, show an honest reason and preserve other safe actions; do not add a competing writer.

### Delivery and fulfillment — UNIT-011

- A delivery command requires an eligible live order state and an explicit confirmation. A screen open, date change, draft save, ready state, or failed read does not deliver.
- Revalidate order revision, current remaining amount, delivery eligibility, selected receipt destination, and relevant inventory/material state inside the atomic write boundary. Do not rely on a UI-disabled button for concurrency protection.
- Delivery event, order transition, correct source snapshot/recognition, eligible selected consumption/shortage movements, explicit delivery collection and allocation if selected, and receipt/result must obey the spec’s all-or-nothing boundary. No false partial-success message for the core transaction.
- Keep planned quantity, available quantity, prior un-reversed consumption, actual consumption, shortage, skipped/unknown, and non-tracked material distinct. Use the specification’s exact `consume`, `consume_with_shortage`, `record_shortage`, and `skip` semantics; no shortage is inferred from unknown quantity and no negative remaining quantity is created.
- Actual delivery cash increases cash once and does not create a second revenue. Initial deposit and delivery collection stay separate dated receipts. A payment after delivery goes through UNIT-026’s order adapter only when eligible.
- A delivery reversal preserves dated cash and manual movements; only reverse eligible delivery-owned effects. A full return does not automatically restore raw materials or reverse consumed labor/cost. Do not add partial delivery/backdating/multi-shipment/transport-company payment features outside the approved contract.

### Later payment against an order — UNIT-026 order adapter

- Accept payment only against one explicitly identified, eligible, live order source with a freshly verified outstanding amount. Never select by customer name alone, distribute across orders, choose the oldest debt implicitly, or create a generic debt ledger.
- For amount `M` and live remaining claim `R`, require `0 < M <= R`; cash and source collections increase exactly once by `M`, and the remaining claim decreases once by `M`. No new sale revenue, profit, order, agreement, or delivery event is created by this later payment.
- Use a stable operation/idempotency identity bound to the exact source ID/revision and payload. Recheck source version and claim within the atomic owner write. Concurrent attempts against the same remaining amount: exactly one succeeds; the other returns a truthful stale/conflict result with no extra cash and no negative claim.
- Wallet/place allocation is a separate attribution of that same receipt, not a second receipt. Preserve explicit unallocated choice, existing wallet, receipt/result recovery, and `outcome_unknown` semantics. A failed attribution must not make a committed payment look uncommitted or allow a duplicate payment.
- Keep the payment’s actual date separate from order date, delivery date, and edit timestamp. Preserve historical aggregate payments without fabricating dated entries.

## 7. S12 acceptance, evidence, and exclusions

Read and map **all** in-scope acceptance criteria from the four specifications and the live S12 stage card. Retain canonical IDs; every in-scope ID must point to a durable test/evidence. For any criterion owned by a later stage or not triggered by S12, state `NOT_TRIGGERED_BY_S12` and the exact reason—do not mark it passed.

At minimum, cover the stage-card and component-owned shared cases below, adding any further cases required by the current specs:

- `SDF-033`: tracked purchase/material consumption and actual cost context without treating purchase quantity/cost as consumed quantity/cost.
- `SDF-034`: repeated/bundled cost and delivery-on-project included exactly once.
- `SDF-035`: actual material evaluation replaces only the matching estimate portion; labor is not lost and cost snapshots are not double-counted.
- `SDF-039`: two concurrent attempts against the same remaining order claim; one success only, no extra cash and no negative claim.
- `SDF-040`: delivery with prior deposit 5, explicit delivery collection 10, and failing consumption rolls back the delivery, recognition, new collection, and consumption together.
- `SDF-052`: order 50 + approved addition 5 + received 20 gives recorded total 55 and remaining 35; revenue is recognized only at eligible delivery.
- `SDF-054`: concurrent attempts to pay a refund of 5 produce one payment at most, within live refund due and receipt identity.
- `SDF-055`: a returned box with consumed labor/delivery does not automatically restore materials or reverse consumed cost; only actually returned/evaluable goods follow their authorized path.

The stage card may list a narrower shared-case subset; report the mapping from each case to its owning specification and explain any relevant additional UNIT-owned case rather than silently dropping it. In particular, include the order adapter’s subset of `U026-AC01..AC48` and mark direct-sale/opening-right adapters outside S12. Map relevant UNIT-009, UNIT-010, and UNIT-011 `AC`/`ACD` sets in full as required by their current versions.

Explicit exclusions include, unless the live owner-approved sources say otherwise: a global debt/payment ledger; multi-order payment allocation; automatic oldest-debt selection; automatic customer/transport-company payments; duplicate collection of a deposit or delivery receipt; external messaging/WhatsApp; new delivery-provider booking; automatic refund on cancellation; partial commercial-return policy; automatic inventory restoration; unapproved expenses/fees/taxes/profit recognition; broad S15 reporting redesign; schema/export upgrades without a justified compatible contract; and any structural wave from the S11 scan.

## 8. Storage, import/export, migration, and compatibility

1. At execution start, measure and record the live `localSchemaVersion` and `localExportVersion`, the exact order/agreement/delivery/collection/material data shapes, IndexedDB stores/indexes, storage capabilities, snapshot validators, transfer versions, and existing supported import/export pairs. Do not blindly assume the previously reported 40/32 pair remains current.
2. Preserve the existing order as the authoritative source. Avoid a new permanent store or duplicate source of truth. If no persistent wire-format change is necessary, keep schema/export versions unchanged and prove why.
3. If a persistent shape or wire-format change is genuinely required, complete in this same connected execution the justified version decision, compatible migration/defaults, Memory/IndexedDB parity, entity touchpoints, snapshot normalization/validation, all supported import/export/restore pairs, rejection precedence, reference integrity, no-write rejection before preview/restore, and rollback/restore evidence. Test that rejection leaves the target unchanged. Do not defer S12-owned transfer work to a later stage or hide it in generated docs.
4. Any required version bump must be justified against owner-approved data contracts and the repository’s explicit change procedure; never bump or alter the wire format for convenience. Do not raise pinned baselines or relax validators.
5. Do not fabricate business dates for historical records; no destructive migration or record deletion. Update JSON source, regenerate canonical views, and never manually edit generated outputs.

## 9. Tests and quality gates

- First run focused S11 UI tests for the finding fixes. Continue to S12 only after those focused tests pass and the S11 correction is committed/checkpointed. This is a sequencing condition, not an owner approval pause.
- For each S12 product slice, run the relevant focused domain, application, storage-capability/adapter, transfer, and UI tests before proceeding to the next slice. Add deterministic concurrency/idempotency/failure tests; do not rely on manually clicking the UI.
- Cover both `MemoryLocalStore` and IndexedDB/fake IndexedDB parity for all new/changed writes; include retry, changed payload, concurrent windows, stale source, failed transaction rollback, `outcome_unknown`, no incidental writes, and restore paths where applicable.
- Test approved financial examples with exact minor-unit arithmetic and real business dates. Ensure unknown vs known-zero, agreement vs receipt, deposit vs delivery collection, revenue vs cash, post-delivery payment vs revenue, and planned vs consumed materials remain distinct.
- Run the repository’s canonical full `pnpm check` on the stable combined S11 correction + S12 code tree. Record exact command, output/counts, exit code, and SHA. If code changes after it, rerun the affected focused tests and full check on the new stable tree.
- Run applicable official documentation and Control checks, including `python3 scripts/operations-control/validate.py`, `python3 scripts/operations-control/generate_tracker.py --check`, document-index coverage, current-state size, agent-document contract, `git diff --check`, and all relevant tests/guards required by `AGENTS.md`. Do not weaken any guard to make it pass.
- Preserve bundle ceilings `650000` raw / `155300` gzip and existing other thresholds. Measure remote surfaces from actual CI/Cloudflare outputs in the same PR; never invent or manually lower/raise anchors.

## 10. Five sequential read-only reviews

After the combined S11 correction + S12 final candidate exists, perform five distinct **sequential, read-only** reviews against the exact final diff. Do not let a reviewer edit. If ZAI supports subagents, use five specialized reviewers one at a time; otherwise run five distinct read-only passes and report that accurately:

1. **Ownership / architecture / scope:** SH-15 vs SH-16, UI→application→domain→storage, no duplicate writer/source, no unauthorized structural change.
2. **Financial and date correctness:** agreement/deposit/delivery/revenue/cash/remaining claim, exact amounts, dates, unknown/zero, return/refund and no unintended inventory/cost reversal.
3. **Concurrency / atomicity / retry:** CAS/version checks at commit boundary, idempotency and changed payload, parallel writes, rollback, Memory/IndexedDB parity, `outcome_unknown`.
4. **Data transfer / security / Control:** schema/export compatibility, migrations, reference integrity, no-write restore rejection, security, legal Control status and provenance.
5. **Arabic RTL phone UX / accessibility:** UNIT-005 fix acceptance, A/B flows for S12, 320–430px RTL, long Arabic labels, keyboard/focus, loading/error/empty/success/unknown/conflict, navigation/return, no broad system reskin.

For every confirmed in-scope finding: assign an ID, cite file/line and contract evidence, identify root cause, fix at root, add a permanent regression, have the relevant reviewer reread, and rerun impacted tests. Do not accept a report-only workaround or defer an in-scope correctness issue. Distinguish a genuine out-of-scope decision from an implementation defect.

## 11. Commits, records, remote gates, and truthful delivery

- Keep stage-owned commits separate. At minimum: (a) S11 UI correction + tests; (b) S11 addendum/Control updates; (c) S12 claim/records; (d) S12 code commits by coherent product slice; (e) S12 result/handoff and final Control updates. Never combine S11 correction and S12 product code in one commit. Do not rewrite previously accepted or reviewed history; append commits only.
- Write `docs/implementation/micro-component-execution/17-S12-RESULT-2026-11-01.md` (or the next unused ordered result name) with full start/prompt/code/test/final/documentation SHAs; S11 findings and repair evidence; S12 scope/ownership; file map by responsibility; complete AC/ACD/SDF traceability; financial examples; concurrency/atomicity; schema/export/migration result; tests and exact commands/counts/exit codes; reviewer outcomes and fixes; bundle measurements; Control IDs/statuses; and unresolved decisions/limitations.
- Update `01-STAGES.md`, `02-PROGRESS-AND-HANDOFF.md`, DOC/WS source JSON and generated views, `current-state.md`, Manifest, document index, append-only work log, and PR description/comment only as allowed by repository policy and only with factual current evidence. Do not change prior results to claim checks ran on a later SHA.
- S11 and S12 must remain pending independent review/owner acceptance. At final delivery use legal Control states (`IN_REVIEW` / `REVIEW_REQUIRED` as applicable); do not use `VERIFIED`, `MERGED_UNVERIFIED`, accepted, or main-verified language before the actual authorized conditions.
- Push only to `components/integration-20261027`. Wait for GitHub Actions and Cloudflare Pages to reach terminal success on the exact final remote SHA; verify each run/deployment commit SHA and URL. If a fix is needed, add a stage-specific commit, rerun affected checks and required full check, then wait for both remote gates on the new exact head. An earlier green SHA is not evidence for the final SHA.
- Keep PR #383 Draft and do not merge. No main writes, rebase, force-push, branch cleanup, second branch/PR, or secret in PR text.

## 12. Final response and interruption/resume contract

Deliver one concise but complete Arabic response, with links to the S11 addendum and S12 result, and include:

```text
S11-MR-001 — <FIXED_AND_REGRESSION_PROVEN | BLOCKED + evidence>
S11-MR-002 — <FIXED_AND_REGRESSION_PROVEN | BLOCKED + evidence>
S11_ACCEPTANCE — PENDING_INDEPENDENT_REVIEW_AND_OWNER
S12_EXECUTION — <COMPLETE | BLOCKED + exact reason> | REVIEW_REQUIRED
PROMPT_PUBLICATION_HEAD — <full SHA>
EXECUTION_START_HEAD — <full SHA>
S11_FIX_COMMIT / S11_ADDENDUM_COMMIT — <full SHA each>
S12_CODE_CANDIDATE / TESTED_HEAD / FINAL_HEAD — <full SHA each>
LOCAL_CHECK — <exact command, result/counts, exit code, SHA>
GITHUB_ACTIONS — <terminal status, exact SHA, run URL>
CLOUDFLARE_PAGES — <terminal status, exact SHA, deployment/check URL>
FIVE_REVIEWS — <five sequential read-only outcomes, fixes and rereads>
SCHEMA_EXPORT — <exact before/after pair and compatibility evidence, or unchanged proof>
CONTROL — <IDs and truthful review-pending states>
PR — #383 OPEN / DRAFT
NO_MAIN_WRITES / NO_MERGE / NO_REBASE / NO_FORCE_PUSH / NO_SECOND_BRANCH_OR_PR
```

If context, machine load, or an external service interrupts execution, preserve local and remote work, save a durable checkpoint with exact last completed step and full SHA, tests already run, dirty/unpushed files, and next action. Resume this same connected order in the current ZAI conversation without repeating completed work or discarding anything. Do not stop after a plan, a code slice, or a draft report; complete all safe in-scope S12 work and deliver the evidence. Never claim both stages are accepted or ready to merge.
