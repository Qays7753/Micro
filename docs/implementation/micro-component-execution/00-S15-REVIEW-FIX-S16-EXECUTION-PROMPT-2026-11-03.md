# Micro — S15-MR-001 Root Fix, then S16 Connected Execution Prompt

**Status:** `READY_FOR_ZAI — OWNER_AUTHORIZED_CONNECTED_EXECUTION`

**Owner authorization:** The owner explicitly directed Manus to record the already-given owner acceptance of S10 and S14, fix the confirmed S15 phone-Back finding first, and then proceed directly into S16 on the existing integration branch and Draft PR, without an intermediate approval pause. This authorization permits the connected work described below. It does **not** accept S15 or S16, authorize self-acceptance, authorize a merge, or authorize any write to `main`.

## 1. Fixed repository and safety boundary

- Repository: `Qays7753/Micro`.
- The only permitted branch is `components/integration-20261027`.
- The only permitted PR is #383, which must remain Open and Draft against `main`.
- At prompt publication, the verified branch/PR head is `37f81d9a0d089621ec14a99f0c26b457bcf6fb0e`; `main` is `3584aa1d08cea3e0a00623b719fed7f991ce187f`. These are checkpoints, not assumptions about the head at execution time. Re-fetch and verify the live state before acting; if the branch advanced, continue from its actual head and preserve all work.
- Do not create, switch to, or delete another branch or PR. Do not modify `main`, merge, rebase, reset, force-push, clean, stash-drop, discard, overwrite, or regenerate away local work. Do not delete any branch or historical record. Never put an access token or other secret in prompts, files, logs, commits, comments, or URLs; use only the secure credential field provided by the environment.
- Keep product/code authorship with ZAI. Manus coordinates and reviews; do not attribute reviewer judgments to Manus or the owner.
- Keep bundle hard limits unchanged: 650,000 raw / 155,300 gzip. Do not weaken checks, tolerance, counters, ratchets, or guards. Preserve schema/export at 41/34 and all accepted legacy pairs unless a S16 contract genuinely requires a permanent-data change; if so, prove the need and complete the full compatibility/export/import/restore evidence within the same work. Do not bundle unrelated financial, historical, security, copy, or product-rule changes.
- **Post-Group 6 structural gate:** no structural refactor, mass file moves, file splitting, or organization wave. The S11 structure scan remains read-only and its remediation waves remain unexecuted pending a separate owner decision.

## 2. Required cold-start reading and live preflight

Start a new ZAI conversation if needed; this document is self-contained but does not replace repository authority. Before writing, follow the exact reading order in `AGENTS.md` §2. Read the CORE files first: `docs/operations/current-state.md`, `README.md`, `docs/operations/micro-thinking-charter-v1.md`, `docs/00-document-index.md`, and `docs/implementation/03-pre-build-alignment-v1.md`. Then load the `CORE+UI` set defined by that live authority (the seven top-level `docs/architecture/` files, its applicable ADR set, and the relevant concrete mobile-UX/prototype references and UI quality material). If its stated ADR count conflicts with the live files, use the current authority map/document index to select applicable ADRs and note the discrepancy; do not turn this into an architecture refactor or broad design audit. Then read the additional live operational and stage-specific sources below:

1. `AGENTS.md`, `docs/operations/current-state.md`, `docs/operations/current-state-log.md`, `docs/operations/control/README.md`, `docs/operations/control/generated/AGENT-BRIEF.md`, and `docs/operations/control/generated/ACTIVE-WORK.md`.
2. `docs/implementation/micro-component-execution/MANIFEST.md`, `01-STAGES.md`, `02-PROGRESS-AND-HANDOFF.md`, and this prompt.
3. `docs/implementation/micro-component-execution/20-S15-RESULT-2026-11-03.md` and `20a-S15-REVIEW-ADDENDUM-2026-11-03.md`; `19-S14-RESULT-2026-11-03.md`; `15-S10-RESULT-2026-10-31.md` and `15a-S10-REVIEW-ADDENDUM-2026-10-31.md`. S10 and S14 are already accepted by the owner on the integration branch as recorded in Control; do not re-review or reopen them absent new evidence. S12/S13 are also accepted and must not be re-reviewed or changed absent new evidence.
4. S16 contracts: `02-SPECIFICATIONS/03-New-Design/UNIT-003-مشروعي-الآن.md`, `UNIT-014-أدوات-وسجلات-المالية.md`, `UNIT-041-السوق.md`, `UNIT-043-الخدمات-القادمة.md`, `DEPENDENCIES-AND-TRACEABILITY.md` (SH-21), the applicable shared financial/data contract and shared acceptance cases, and `02-SPECIFICATIONS/04-System-Navigation/00-System-Navigation-Master-AR.md` plus the applicable journey/spec references identified by those sources.
5. For the phone-back repair, read the current `FinanceFunctionsBoard.tsx`, its owning `Finance.tsx`, `FinanceFunctionsBoard.unit013.dom.test.tsx`, `Setup.tsx`, and `UnsavedChangesGuard.tsx`. Use the latter two only as behavioral references; do not import unsaved-change semantics into the board.

For S16, the UNIT specs and navigation/shared-data contracts outrank supplemental design guidance; apply Micro Calm/UX rules only when consistent with those canonical product contracts and `AGENTS.md`.

Then safely inspect `git status`, branch, local commits, unpushed commits, remote refs, PR #383 state/head/base, and current check runs/comments. Fetch without changing the worktree. Preserve all existing local/uncommitted work. If a writer is still active or a command is running, inspect it instead of duplicating it. Never assume the publication head remains current. If there is unknown work, preserve it and establish what completed before repeating any action.

Before creating the S16 claim, verify the current Control ownership set and run its validator. Do not create DOC-025/WS-241 if an overlapping active claim exists; first resolve only the claim lifecycle legally and document the evidence. Do not invent IDs if either identifier already exists: inspect and resume/reconcile its actual record.

## 3. Part A — fix confirmed finding S15-MR-001 first

### Finding and accepted root cause

`S15-MR-001` is confirmed: the S15 result says the Finance Functions board closes on phone/browser Back, but the delivered board and its `Finance.tsx` parent do not own a `popstate`/history path for the open board. The existing DOM regression test proves close-button and Escape behavior, not phone Back. Escape, close-button behavior, and focus restoration do exist; do not erase or weaken them. The finding, evidence, and discovery-head status are recorded in `20a-S15-REVIEW-ADDENDUM-2026-11-03.md`.

### Legal Control transition before the fix

DOC-024 and WS-240 were legally reopened in the published tracker to record this confirmed finding. Before making product edits, verify their live records and transition them through the repository's legal path to `IN_PROGRESS` (`DOC-024: REOPENED -> IN_PROGRESS`; `WS-240: REOPENED -> IN_PROGRESS`), appending the exact reason and current head. If their actual states differ, use only a legal transition from the actual state and preserve history. Do not mark S15 accepted.

### Root repair and regression proof

1. First extend the existing DOM test with a focused failing characterization of phone Back while the board is open. Run it against the current implementation and record the actual failing assertion before changing production code; do not simulate success by mocking away the missing behavior.
2. Implement the narrowest lifecycle-safe board-owned history behavior that matches existing Micro navigation conventions:
   - Opening the board creates at most one same-page sentinel/history state for this board instance.
   - One phone/browser Back while open closes only the board. It must not change the `/finance` route, selected period, any financial data, or another navigation context.
   - The close button and Escape still close the board and restore focus to the actual opener.
   - Non-Back close, navigating through a board entry, repeated open/close cycles, route changes, and unmount cleanup must not leave stale/duplicate sentinels or make a later Back unexpectedly close/navigate another surface.
   - Handle event listeners and history state with explicit lifecycle cleanup and idempotent guards. Do not add a generic navigation abstraction or change route contracts.
3. Prove the regression: the new test fails before the fix and passes after it. Cover phone Back, unchanged route/period/data, focus restoration, Escape, close button, repeated cycles, and cleanup/listener behavior in the existing DOM test or the smallest relevant test arrangement. Run the focused test and any directly affected tests.
4. Update the S15 result/addendum truthfully: the old statement is historical and was inaccurate at delivery; state the exact repair commit, regression evidence, and what was not tested (for example, no physical-device test if only jsdom was available). Do not rewrite history to imply the original delivery had the feature.
5. Update DOC-024/WS-240 evidence and `next_action`, returning them legally after the repair to `DOC-024 IN_REVIEW` and `WS-240 REVIEW_REQUIRED`. This is re-delivery for independent review, not S15 acceptance. Keep the finding classification and its fixed status/evidence auditable.
6. Commit the root fix and its regression separately from the later S16 implementation. Do not pause for an owner/Manus approval between the completed S15 repair and S16; proceed directly under this owner-authorized connected order.

## 4. Part B — create the S16 claim legally, then implement S16

After S15-MR-001 is fixed, evidenced, and DOC-024/WS-240 have returned to their legal review/release states:

1. Recheck active claims/overlaps and run Control validation. Create DOC-025 and WS-241 using the current JSON schema, transition rules, generated-view workflow, and conventions only if these IDs do not already exist and no conflicting active claim remains. Add the claim before any S16 product-code change. Update JSON sources first, generate tracker views using `python3 scripts/operations-control/generate_tracker.py`, then validate. Never edit generated Control views by hand.
2. Begin S16 directly under this prompt. S16 scope is **UNIT-003 (home), UNIT-014 (unified finance tools/records entry), UNIT-041 (market), UNIT-043 (future services), and SH-21**. Complete the in-scope contracts; do not treat an item as complete because a page already exists.

### S16 product boundaries

- Implement the specified home/dashboard and top-level navigation only. Follow the authoritative UNIT and navigation contracts for destinations, labels, context, and return behavior. Home is the default only as specified. Preserve working deep links and return context; prepare valid replacement/redirect behavior before removing or changing a legacy entry.
- Home consumes the existing canonical S15 financial reader and existing source services; do not introduce a second financial reader, duplicate calculations, a new financial writer, or a home-specific store/table. Navigation or moving an entry creates no business record, balance, reservation, payment, or financial event.
- UNIT-014 unifies the entry to finance tools and records. Keep `/finance/more` compatibility/redirect behavior coherent with the S15 implementation and all existing inbound links. Do not recreate the independent “More” page, a second catalogue, or parallel reader/writer surfaces. Preserve access to required records and tools through the canonical finance surface.
- UNIT-041 market remains an honest informational/advertising surface: no in-app purchase, supplier, product-order, basket, checkout, payment, or fabricated transaction state.
- UNIT-043 future delivery/AskMicro services remain clearly “coming later” as specified. Do not add fake functional actions, a release date, launch claim, live status, service request, delivery booking, AI response, or hidden API integration.
- Preserve existing product meanings and the financial invariants in `AGENTS.md` and the shared contracts. No semantic, financial, historical, ownership, permission, schema, export, or security change may be hidden inside UI/navigation work.
- Apply the approved Micro Calm Operational rules only as needed by the S16 contracts: Arabic-first, RTL-first, phone/portrait-first, 320–430px, touch-appropriate controls, clear hierarchy, honest states, accessible labels/focus, reduced-motion respect, no desktop-dashboard treatment, no rejected Ledger Plane patterns, and no new visual-system project or broad showcase/redesign beyond these units.
- Cover meaningful loading, error, empty, partial/unavailable, and success states where those states exist in the specified flows. Back, Escape, focus return, in-app navigation, refresh/deep links, and return context must remain coherent. Tests must verify behavior and no duplicate writes, not merely component presence.
- Do not expand into S17, S18, unrelated components, or any structural S-1..S-5 wave. S16 is followed by S17 data/backup validation and S18 final integration; do not start either here.

## 5. Implementation discipline and verification

- ZAI is the sole code writer. Keep changes focused on the finding and S16 contracts. Use separate commits for the S15 finding repair and the S16 implementation/review corrections, plus minimal delivery records where useful. Do not bundle semantic/financial changes into structural work.
- Run the focused regression first, then relevant tests as changes are made. Once the combined final tree is stable, run the complete required `pnpm check` once in the documented sequence. Run all relevant Control tests/validation, generated-view freshness (`generate_tracker.py --check`), documentation-index coverage, current-state size, agent-document contract, bundle-budget/surface checks, and `git diff --check` as applicable. Do not rerun a passing suite without a concrete change or failure that warrants it.
- Conduct **five sequential, read-only reviews** on the same final candidate, covering: (1) product semantics/data ownership and finance non-regression; (2) routes, link/return context, and SH-21; (3) phone UX, Arabic/RTL, accessibility, Back/focus; (4) honest market/future-service behavior and absence of fake actions; (5) tests, Control/docs, bundle/schema compatibility, and integration. Reviewers do not write code or edit records. Fix every confirmed in-scope finding at its root, add durable regression coverage, and re-read the corrected finding. Do not silently expand into unrelated scope; record any out-of-scope observation with evidence and why it is not a blocker.
- Preserve the S15 and S16 checkpoints, last safe commit, latest validated commit, exact full SHAs, changed files, tests run, active claim status, remaining work, and next exact action. After any interruption, inspect state and running processes first; resume from the verified next action without resetting, discarding, or redoing completed work.
- Push only to the existing branch, without force. After the last push, verify the exact final branch/PR head. GitHub Actions and Cloudflare Pages must both be successful on that exact final SHA; earlier green runs do not prove a later head. If a check is still running, inspect/wait according to the normal GitHub process; do not mark success prematurely. Keep PR #383 Draft and do not merge.
- Update result reports, DOC-024/WS-240 and DOC-025/WS-241, `01-STAGES.md`, `02-PROGRESS-AND-HANDOFF.md`, `MANIFEST.md`, `docs/00-document-index.md`, `current-state.md`, and append-only `current-state-log.md` with exact evidence and statuses. For Control, edit JSON source, generate official views, then validate. Do not claim S15 or S16 owner acceptance; both remain for owner review. Do not change the previously accepted S10/S12/S13/S14 records beyond the acceptance/decision note already made by the owner and do not reopen them.

## 6. Progress updates, stop conditions, and final handoff

During execution, post short Arabic progress updates in the ZAI chat at meaningful milestones. Include an approximate percentage for the **current stage only** (first S15 repair, then reset to S16 progress); updates are informational and must not pause work or request a response.

Do not stop for routine documentation, reviewer disagreement that can be resolved from contracts, a transient recoverable check, or an ordinary implementation choice. Diagnose and root-fix failures within scope. Stop only if there is a genuine unresolvable conflict affecting financial semantics, permanent data/schema compatibility, security/privacy, or an owner-only product decision, or if a required gate remains failing after root-cause work and cannot be safely resolved within this authorization. If stopping is unavoidable, preserve all work and provide a precise checkpoint and evidence; never discard work.

At completion, provide one report in Arabic with:

- S15-MR-001 root cause, repair commit, test red/green evidence, S15 report/Control return-to-review status, and explicit statement that S15 is not owner-accepted.
- S16 scope completed by UNIT/SH-21 with a concise changed-file responsibility map and acceptance evidence.
- Exact commit SHAs, final branch and PR #383 head, and confirmation that `main` stayed unchanged and no merge occurred.
- Full `pnpm check`, relevant tests and guard results, the five reviewers' findings and fixes, current schema/export and legacy compatibility facts, and exact-head Actions/Cloudflare links.
- Remaining limitations (including physical-device testing if unavailable), active claim statuses, and the next owner-facing review step. Do not claim any unverified result or treat this prompt's publication as execution.
