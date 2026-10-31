# Micro S10 — Owner-Authorized Execution Order

- **Date:** 2026-10-31 (Amman)
- **Repository:** `Qays7753/Micro`
- **Only implementation branch:** `components/integration-20261027`
- **Only pull request:** #383 — keep Draft
- **Expected starting GitHub head:** `474a1d35ecf13117912cd3557247c2e01edcfdfd`
- **Program base (`main`, read-only):** `3584aa1d08cea3e0a00623b719fed7f991ce187f`
**Order:** Reconcile the two owner-authorized S09 dependency-audit advisories, then execute S10 (UNIT-030/031/032 + SH-14) to completion in the same ZAI conversation and on the same branch/PR. Do not wait for an intermediate owner review or approval between these parts.

## 1. Authorization and exact boundaries

The owner expressly authorized, in this conversation on 2026-10-31, recording **only** these two S09-reported advisories as owner-approved exceptions and proceeding directly to S10:

- `GHSA-g3hv-75wg-m249` — `minimatch`
- `GHSA-3g3m-2fjr-6pw4` — `glob`

This authorization is limited to these exact advisory IDs and to the development-only, no-safe-in-range-remediation facts described in S09’s final delivery, **only if revalidation at execution time confirms those facts**. It is not permission to accept any other advisory, broaden affected surfaces, weaken audit/CI, modify dependency policy, change financial or product rules, accept S08/S09, or merge to `main`.

S09 (`DOC-018` / `WS-234`) remains delivered for independent review and owner acceptance. S08 (`DOC-017` / `WS-233`) likewise remains unaccepted. The owner’s authorization to proceed with S10 is not acceptance of either stage. Keep both histories and evidence truthful; never mark either stage `VERIFIED`, accepted, merged, or complete on `main`.

This is one continuous execution order, not a request for a plan or a pause. Five reviewer passes are required at the end, but they are internal read-only quality work, not intermediate approval gates. Do not stop for routine documentation, Control, test, CI, Cloudflare, formatting, or other fixable issues. Repair them at root, record the evidence, and continue. Do not ask the owner to approve continuation again.

Stop only if a genuine non-repairable safety blocker exists: a material financial/product/data/security contract conflict that prevents a coherent approved implementation; a required external capability is unavailable after reasonable recovery; or a security finding outside this exact owner authorization cannot be safely remediated and prevents truthful green final gates. Even then, first preserve all work and complete any independent safe S10 work; report the precise blocker and evidence without claiming completion. Do not invent policy to avoid a real blocker.

## 2. Required first reply in this same conversation

Continue in the current ZAI conversation; do not start over or discard its context. Before doing more work, send one concise status reply that states:

1. the live local branch, HEAD, upstream relation, dirty/untracked work, unpushed commits, and whether local work matches GitHub;
2. the ZAI computer’s current disk/memory/load state and whether it contains disposable leftovers; identify any available skills/tools relevant to this order;
3. why this task may take time and a realistic time range for the remaining work, clearly labeled an estimate rather than a promise.

Then continue immediately without waiting for a response. Inspect before cleanup. Preserve all valuable local or unpushed work; do not reset, discard, clean, rebase, force-push, or delete repositories/branches. Remove only clearly disposable generated artifacts that are proven unrelated, untracked, unused, and safe to remove; record what was removed. Never print, paste, commit, or log credentials or secrets.

## 3. Live preflight and safe recovery

1. Read `AGENTS.md`, `docs/operations/current-state.md`, `docs/operations/control/README.md`, `docs/operations/control/generated/AGENT-BRIEF.md`, and `docs/implementation/micro-component-execution/02-PROGRESS-AND-HANDOFF.md`. Run the repository-required Control validation before changing Control records.
2. Fetch and verify live `origin/main`, `components/integration-20261027`, PR #383 state/base/head, open PRs, checks and recent PR comments. Confirm `main` is still the stated read-only base and PR #383 is open, Draft, and based on it. Verify the exact commit graph and identify the prompt-publication commit separately from all code candidates.
3. Compare the ZAI local worktree with GitHub. If GitHub has advanced by this prompt publication or a later authorized commit, safely fast-forward only when possible and preserve local work. If histories diverge, inspect and reconcile; never overwrite or guess. Record the actual full execution-start SHA.
4. Use current repository files and current code as the authority for implementation. Historical audit maps and earlier reports are navigation/evidence only. Re-read the S10 card in `01-STAGES.md`, all normative A/B/P3/acceptance sections in UNIT-030, UNIT-031, UNIT-032, the current shared data/financial contract, shared acceptance cases, applicable approved decisions, financial P0 policies, and the live S09 result. Use the current `AGENTS.md` routing to read the relevant CORE/UI/QUALITY/STORAGE/FIN context packs and the applicable repository skills; do not bulk-read unrelated docs.
5. Inspect the actual current `package.json` scripts, test configs/helpers, schema/export versions, S09 calculation kernel/public APIs, `cost-estimates` model/storage/transfers, and the corresponding routes before choosing implementation paths. Do not infer current code from old file maps.

## 4. Part 1 — reconcile only the two owner-approved advisories

The current recorded S09 final head is `474a1d35ecf13117912cd3557247c2e01edcfdfd`; its delivery reports Cloudflare Pages success and GitHub Actions blocked only at dependency audit by the two advisories above. Revalidate at the live starting state:

1. Run the exact repository audit/checker flow. Capture the machine-readable advisory records and human-readable output. Use `pnpm why` (or the repository-supported equivalent) to confirm the current dependency chains, severity, production/dev classification, and whether an in-range safe remediation is now available.
2. If either advisory is no longer present, do **not** add a stale exception for it; follow the repository’s documented stale-entry procedure if a prior approved entry exists. If a safe upstream version/upgrade path now removes it without weakening protected gates or changing unrelated product behavior, prefer that root remediation and do not record a stale acceptance.
3. If the exact advisory remains and revalidation confirms the same development-only/no-safe-in-range-remediation scope on which the owner based approval, add one `OWNER_ACCEPTED` entry for that advisory in `docs/quality/security-exception-register.json`, with the owner approval date `2026-10-31`, current exact dependency chain/evidence, affected and unaffected surfaces, monitoring, review/reopening trigger, removal condition, and rollback boundary. Mirror the decision in `docs/quality/security-exceptions.md` in the same commit. Follow the current schema and the existing deepmerge entry’s format; do not omit required fields or copy outdated chains/evidence.
4. Record exactly these IDs and no others. Do not alter `scripts/ci-audit-check.mjs`, audit severities, CI workflows, lockfile, overrides, protected guard behavior, or unrelated exception rows merely to produce a green run. Run the focused security-audit tests/checks after this records-only change and commit it separately before product implementation.
5. If the actual exposure, severity, or remediation facts materially differ from the owner-approved basis, do not stretch the authorization. Continue independent S10 work that is safe, but preserve an exact security blocker and do not claim a green final gate.

Do not wait for remote checks on this intermediate security-record commit. After its focused checks pass, proceed directly to S10. Exact-head GitHub Actions and Cloudflare verification is mandatory on the final pushed S10 head.

## 5. Operations Control transition and S10 claim

Before S10 product-code edits:

1. Update the official source JSON records only. Keep `DOC-018` / `WS-234` visibly pending independent review and owner acceptance; update their `next_action`/notes to reflect the owner’s newly authorized S10 continuation and remove the obsolete statement that S10 cannot start without another owner decision. Do not rewrite the historical S09 result or any prior history.
2. Transition S09 from `IN_REVIEW` to `REVIEW_REQUIRED` through the validator’s legal transition **only if needed to release the completed implementation claim for sequential S10 work**. This is a status for required review, not acceptance or closure; state that explicitly in both records and retain the pending review/owner acceptance next action. If the current validator/Control model indicates another legal route, use that route without editing the validator or hiding a claim.
3. Verify the next unused IDs. Use `DOC-019` and `WS-235` only if still available; otherwise use the next valid unused IDs and explain why. Create the S10 claim with a narrow, accurate implementation scope and exact base SHA. Reflect single ownership: S10 owns SH-14 and the T01 saved-estimate feature; S09’s SH-13 kernel remains the existing shared engine that S10 consumes. Do not claim or rebuild S09-owned core files just to create a new engine.
4. Run `python3 scripts/operations-control/generate_tracker.py`, `python3 scripts/operations-control/validate.py`, and `python3 scripts/operations-control/generate_tracker.py --check` after JSON changes. Update other workbook metadata only if the official procedure requires it. Never edit generated views manually. Resolve every fixable overlap or stale Control claim at source; do not bypass the validator or invent `VERIFIED`/owner acceptance.

## 6. S10 scope — implement UNIT-030, UNIT-031, UNIT-032 and SH-14 only

S10’s authorized stage card is `docs/implementation/micro-component-execution/01-STAGES.md` §S10. Read and apply the full current specifications, not just the summary below. Implement the five tools only:

- T01: cost and pricing calculator;
- T02: value of an hour of work;
- T03: quantity of sales needed;
- T04: the project’s share of an invoice;
- T05: a simple preliminary idea review.

Implement the approved experience in the existing Micro application. The tools are planning-only, are not a sixth bottom-navigation tab, and must not become writers of orders, sales, agreements, cash, expenses, owner rights, inventory, catalog records, or any other actual business event. Retain the exact final navigation migration for S16; provide the currently specified secondary access from Home without a broad navigation redesign. UNIT-032 is integrated into T01, not a separate product page or generic estimates library.

### 6.1 Ownership and reuse

- Build owner: S10 for SH-14 (`cost-estimates` and optional saved T01 calculations). S10 consumes the existing SH-13/S09 pure calculation kernel through its supported public boundary. There must be one calculation source of truth, not a React-local or duplicate domain engine.
- Keep order cost snapshots owned by UNIT-008/S09 and saved offering/catalog behavior owned by UNIT-029/S09. An estimate is not an order, offering, sale, agreement, expense, or promise.
- Use the established UI → Application → Domain → storage port → adapters composition. UI calls the composed application service; no direct page-to-storage calls, deep-import bypass, new generic store, or layer/allowlist escape.
- Do not modify S09-owned calculation semantics or files unless the live contract and a failing characterization test prove a minimal compatible change is necessary. If one shared file must change, preserve the single-writer ownership record, test both order-cost and T01 results, update the Control scope accurately, and avoid a second implementation.

### 6.2 Calculation and financial invariants

Implement only the formulas and policy explicitly present in UNIT-030/031 and approved decisions. In particular:

- Preserve exact aggregate amounts in safe integer minor units. The approved example of total 10.00 across 3 units remains `1000` minor units; display-rounding a unit price must never multiply back into a changed stored/calculated total such as `1002`.
- Keep one active input mode per scope: total versus detail never add together. Apply group quantity once. Keep units, periods, scope, assumptions, and cost knowledge attached to the result; do not label an estimate complete when material inputs are unknown or excluded.
- Distinguish margin on sale price from markup on cost. User-entered price remains free within the approved policy: do not add a mandatory profit floor, minimum margin, target percentage, below-cost prohibition, or a new free-sale path. Do not imply guaranteed profit.
- Work time, rent, delivery and operating estimates are planning inputs only. They do not create salary, expense, cash movement, owner payable/entitlement, inventory consumption, or recognized period cost. Count project-side delivery and any approved add-ons once at their defined scope.
- T02 must not turn a time valuation into wages or a financial liability. T03 must use the approved positive-contribution/period assumptions and round required quantity upward as specified; unknown/zero denominator or missing knowledge must be truthful and non-computable, not zero or a fabricated result. T04 must use only the approved explicit basis; do not invent a percentage. T05 is a preliminary structured review with missing inputs and next validation steps, not an AI verdict, loan recommendation, guaranteed feasibility, or market-price claim.
- T04’s computed share is only an estimate. It changes no invoice, payment, or expense; actual recording remains with the expense owner under its explicit workflow.
- No material reference lookup may consume stock or create an expense. No automatic catalog save, request creation, financial event, or silent bridge from a tool result to a transaction.
- Recalculate deterministically from the same valid inputs. Unknown, omitted, not applicable, estimated, excluded-by-choice, and explicit zero remain distinct wherever the governing contract distinguishes them.

### 6.3 Saved T01 calculations and old data

- Make save optional and explicit inside T01 only. Provide the specified in-calculator “saved calculations” access when one exists; no separate UNIT-032 page, general archive, automatic save, save for T02–T05, product save, order creation, or share/message bridge.
- A saved calculation retains its stable identity, input/calculation version, assumptions, knowledge, and historical result as specified. Reopening an old calculation must not silently reprice it with today’s catalog/material prices. Updating an existing saved calculation updates the same record only when that is the specified intent; creating another copy is an explicit action with a new identity. No new record for a no-op or each keystroke.
- Preserve valid existing `cost-estimates` and their historical links. Removing/redirecting the old standalone route must not delete the underlying estimates, erase references used by orders/products, or lose user input. Route old eligible links to T01 with a valid identity and reliable return path, according to UNIT-032.
- Deletion of a saved calculation affects only that calculation. It does not delete a product, order, agreement, or historical snapshot. Confirm destructive actions with accurate wording; preserve edits on cancel/failure.

### 6.4 Data, storage, migration, and transfer

At the live start, record the actual schema/export version pair and the current storage/transfer contract. Do not assume a version or bump it for convenience. If S10 makes no permanent-shape change, keep the live pair unchanged. If a permanent shape or transfer behavior truly changes, complete the compatible migration, both Memory and IndexedDB adapters, constraints/atomicity/idempotency, snapshot/export/import/restore validation, touchpoint registry, guard/capability records, compatibility and golden tests, and documentation in this same S10 execution. Do not defer S10’s changed data to S17.

For every persistent write, prove intent, identity, validation, retry/idempotency, stale-state behavior, and no partial effects within the existing write boundary. Test parity across Memory and IndexedDB. If both adapters and actual transfer application paths are relevant, cover both; do not substitute only a validator-shape test for an end-to-end round trip. Rejected or malformed import/restore must happen before preview/target writes and leave target data unchanged. Do not replay business/financial effects when opening or restoring a saved calculation. Do not introduce localStorage/sessionStorage as authoritative storage.

## 7. S10 acceptance and regression evidence

Read all applicable ACD and acceptance sections in the three UNIT specifications. Map each S10-owned item to a durable test/evidence row, preserving existing IDs. At minimum explicitly cover:

- `U030-ACD01` through `U030-ACD08`;
- `U031-ACD01` through `U031-ACD12`;
- `U032-ACD01` through `U032-ACD06`;
- `SDF-002`, `SDF-059`, and `SDF-065`.

For each case, provide direct permanent test evidence or a precise, evidence-based reason the S10 slice does not trigger it. Do not mark an unrun/uncovered case as passed. Reuse IDs; never renumber them. Also prove the S10 stage-card requirements:

1. Exactly five tools, no sixth tool/tab, and no standalone UNIT-032 destination.
2. Same valid cost inputs through order-cost calculation (UNIT-008/S09) and T01 produce the same calculation from the shared kernel; do not mutate the order when using the tool.
3. Exact aggregate example: `10.00 ×/for 3 units` keeps the source total at 1000 minor despite any rounded unit display; total and detailed modes do not double count.
4. Save/open/update/explicit-copy/delete T01 without sale/order/expense/cash/stock/owner effect; preserve unknown/partial states, historical inputs and old estimate links; opening or deleting does not mutate another record.
5. T02/T03/T04/T05 edge states: missing inputs, zero or invalid denominator, non-positive contribution, rounding upward where specified, period mismatch, unknown values, cancel/back, and retry. No false zero, fabricated share, guaranteed profit, or financial posting.
6. Local storage, migrations and transfer round-trip for every permanent changed field/family; valid legacy, malformed/newer input, identity/reference integrity, rejection precedence, and no-write behavior as applicable.
7. RTL Arabic-first phone UI using the live approved design system: 320/360/390/430 CSS-pixel viewports, long Arabic, zoom/text enlargement, keyboard/scroll ownership, empty/loading/error/saved/dirty/conflict and return states, accessible labels/errors, 0–9 numeric entry, Light Mode, and repeated-tap/cancel behavior. Test what the browser harness can prove; label simulated browser checks accurately and never claim native-device validation without actually doing it.

Add focused domain, application, storage, transfer and UI tests for changed contracts. Assert behavior and no side effects, not only implementation details. No `.skip`/`.only`, no weakened expected assertions, and no changes to test thresholds to force success.

## 8. Architecture, quality, and scope protections

- No structural refactor, bulk file move, feature-folder migration, broad file split, repository organization project, architecture cleanup, or mass renaming. The mandatory post-Group 6 structural scan remains a separate owner-review gate; this order does not authorize it.
- Modify only product/documentation/control files necessary for S10 and the two approved security records. No unrelated S08/S09 rewrites, no broad cleanup, no Showcase/product-brand redesign, and no changed product or financial policy hidden in tests or UI.
- Keep hard budget ceilings and existing guards unchanged. If a legitimate bundle-surface change requires re-anchoring, measure it on a real run on this same PR/head and follow the existing documented procedure. Never guess measurements or raise raw/gzip ceilings/tolerances/count baselines.
- Preserve all prior accepted history and the S02 deepmerge exception. Do not add or alter any security exception beyond the two expressly approved IDs.
- Do not create any branch or pull request. Do not write to `main`, merge, rebase, force-push, delete branches, or change PR #383 from Draft.

## 9. Commit and execution sequence — uninterrupted

Use ZAI as the sole implementation writer. Make small, clearly phase-owned commits; do not combine distinct security, S10 implementation, and result-record changes into one commit. Continue through this sequence without asking for intermediate approval:

1. Live preflight, safe preservation of local work, source/Control audit, owner-approved advisory revalidation and (if still applicable) the exact two-entry security-register/prose update; focused security checker tests; separate governance commit.
2. Correct S09 Control next-action/status only as required for sequential S10 execution, retaining S09 review/owner acceptance pending. Create the valid S10 DOC/WS claim before product-code changes; run Control validation and commit the official JSON/generated-view changes.
3. Characterize current T01/SH-13 and existing `cost-estimates`; write failing tests for S10 gaps first. Do not redo S09. Commit only when the first S10 domain/kernel consumer slice is coherent and tested.
4. Implement the five-tool experience and T01 integration using the existing calculation kernel, then focused domain/UI tests. Keep the T01 planning result separate from transaction records.
5. Implement optional saved-T01 lifecycle, preserving existing estimates and stable identity; add focused persistence, parity, concurrency/retry, cancellation, and migration/transfer regressions for every changed persistent contract.
6. Complete and map all SDF/ACD evidence and inspect the scoped diff for accidental out-of-scope financial, route, schema, data, or design changes. Fix confirmed in-scope issues at root and add permanent regressions.
7. Update S10 result, Control, stage card, progress/handoff, append-only work log, MANIFEST, document index, and allowed current-state summary. Generate views from JSON sources only. Keep result status delivered for independent review, never accepted.
8. Run focused tests after relevant changes. Run the repository’s canonical full `pnpm check` **once on the stable final combined code tree** (use the actual current root script). Record exact command, exit code, counts, warnings, budget/surface measurements, and SHA. If code changes after this run, rerun affected tests and the full canonical check on the new stable code tree.
9. Perform the five sequential, clearly distinct, read-only final reviews on the final diff. If subagents are unavailable, perform five separate read-only passes yourself and do not claim they were subagents. Reviewers must not edit code, records, or branches. Record findings; fix every confirmed in-scope issue at root, add regression tests, have the relevant reviewer reread the correction, and rerun affected tests/full check as required.
10. Commit and push all S10-owned result records to the existing branch. Re-fetch the exact remote final head and wait for GitHub Actions and Cloudflare Pages to reach terminal status on that exact SHA. Verify run/deployment commits, URLs, and results. Repair every fixable failure at root, make an additional stage-specific commit, rerun required checks, and wait for both remote gates on the new exact final head. Never claim green from an earlier SHA.
11. Update PR #383’s description and add one concise factual delivery comment with the exact final head, code/tested/documentation SHAs, the two advisory decisions and scope, local results, all five reviews, and exact remote gate URLs. Keep PR #383 Draft. Do not merge.

### Five final review scopes

- **R1 — Ownership/architecture:** S10 boundaries, SH-14 ownership, reuse of SH-13, single source of calculation truth, layer rules, no structural refactor.
- **R2 — Financial/domain correctness:** formulas and numeric precision from source, minor units, scope/quantity, margin vs markup, assumptions/knowledge, no double count or financial side effects.
- **R3 — Persistence/lifecycle:** T01 save identity/version, no-op/idempotency, conflict/retry, atomicity, Memory/IndexedDB parity, historical links, migration/transfer/no-write guarantees.
- **R4 — Security/compatibility/evidence:** exact two advisory IDs and exception scope, no new security-policy weakening, import/restore integrity, secret checks, SDF/ACD evidence and exact SHA provenance.
- **R5 — UI/UX/accessibility:** five-tool flow, Arabic/RTL phone behavior, states/help/errors/return, route transition limits, accessibility, truthful browser-vs-device claims, and documentation/control consistency.

## 10. Required deliverables and truthful final report

Create `docs/implementation/micro-component-execution/15-S10-RESULT-2026-10-31.md`. Include:

- execution start SHA, prompt-publication SHA, S10 code candidate SHA, tested SHA, final pushed SHA, and documentation-only SHAs, all full;
- the exact two approved advisories’ current audit evidence, verified dependency chains, whether entries were added or remediation made them stale/unnecessary, both register/prose paths, and proof no other advisory was accepted;
- S10 scope, architecture/ownership, files grouped by responsibility, what was preserved/removed and why, and what remained outside scope;
- a traceable acceptance matrix for all applicable UNIT ACD and SDF IDs, with direct test evidence or precise not-triggered reasons;
- calculation examples and proof of no financial side effects; saved-T01 lifecycle and data/transfer/migration behavior;
- schema/export versions before/after, or proof unchanged, plus Memory/IndexedDB parity and compatibility evidence as applicable;
- exact focused/full commands, counts and exit codes tied to exact SHAs; the five reviews and any findings/fixes/rereads;
- exact GitHub Actions run URL and Cloudflare deployment/check URL, terminal result and exact final SHA;
- S08/S09 remain pending independent review and owner acceptance; S10 delivered for review only; PR #383 remains Draft; no main writes/merge/rebase/force push/branch deletion/new PR.

Update official Control JSON first, then run the official tracker generator and validator. Update `01-STAGES.md`, `02-PROGRESS-AND-HANDOFF.md`, append-only work log, current-state summary only where permitted, MANIFEST and document index. Do not overwrite historical result evidence or edit generated views by hand. Do not put secrets in reports, comments, URLs, test fixtures, or terminal output.

Final response must be in this exact truthful structure, with no missing/guessed values and no acceptance claim:

```text
SECURITY_EXCEPTIONS — <RECORDED_FOR_EXACT_TWO_IDS | NOT_NEEDED_AFTER_VERIFIED_REMEDIATION | BLOCKED + exact reason>
S08_ACCEPTANCE — PENDING_INDEPENDENT_REVIEW_AND_OWNER
S09_ACCEPTANCE — PENDING_INDEPENDENT_REVIEW_AND_OWNER
S10_EXECUTION — <COMPLETE | BLOCKED + exact reason> | REVIEW_REQUIRED
EXECUTION_START_HEAD — <FULL_SHA>
S10_CODE_CANDIDATE — <FULL_SHA>
LOCAL_CHECK — <PASS/FAIL + exact command, counts, exit code, SHA>
GITHUB_ACTIONS — <SUCCESS/FAIL + exact SHA + RUN_URL>
CLOUDFLARE_PAGES — <SUCCESS/FAIL + exact SHA + DEPLOYMENT_OR_CHECK_URL>
FIVE_REVIEWS — <5 sequential read-only passes + concise result, or exact limitation>
FINAL_HEAD — <FULL_SHA>
PR — 383 DRAFT
NO_MAIN_WRITES_PERFORMED
NO_MERGE_PERFORMED
NO_REBASE_PERFORMED
NO_FORCE_PUSH_PERFORMED
NO_BRANCH_CLEANUP_PERFORMED
NO_SECOND_BRANCH_OR_PR_CREATED
```

If anything remains incomplete, state precisely what, why, evidence, last tested/pushed SHA, what was preserved, and the next exact action. Do not stop early after merely publishing this prompt; do not self-accept S10 or call the branch ready to merge.
