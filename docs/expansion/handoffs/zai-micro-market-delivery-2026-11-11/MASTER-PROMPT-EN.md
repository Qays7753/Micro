# Z AI 5.3 — Micro Market + Micro Delivery Control Reconciliation and Decision Sync

**Status:** Controlling execution prompt for the handoff branch named below.  
**Owner authorization:** The current invocation authorizes an independent read-only A-to-Z analysis of the actual Micro system, followed by Control reconciliation, synchronization of the approved Market/Delivery decisions into canonical GitHub docs, and an evidence-based integration/implementation report. It does not authorize feature-code implementation, structural refactoring, provider-account changes, deployment, merge, or work on `main`; stop for owner review before feature-code execution.  
**Repository:** `https://github.com/Qays7753/Micro`  
**Documentation repository:** same repository: `https://github.com/Qays7753/Micro`  
**Branch:** `zai/micro-market-delivery-handoff-20261111`  
**Expected base SHA (verify live; this is not authority if state has changed):** `16c90e48bdc018939f97f41d05e969c900bc30e0`  
**GitHub credential:** `<RESTRICTED_GITHUB_TOKEN — supply only through Z AI's secure credential field; never paste it into this file, chat, logs, or reports>`

## 1. Mission

You are the sole accountable repository executor for this handoff. Work only on the existing handoff branch and preserve its handoff commit. First perform the independent read-only system analysis required in Phase 0. Then complete the Control reconciliation and Market/Delivery documentation synchronization in separate commits. Finish with the full evidence-based report and stop before feature-code work.

1. Reconcile the stale Operations Control/current-state records caused by PR #384 being merged into `main` while `WS-248` still says `IN_REVIEW`.
2. Synchronize every owner-approved Market decision `OD-01` through `OD-21` and Delivery decision `OD01` through `OD31` from the six approved specifications committed under `docs/expansion/handoffs/zai-micro-market-delivery-2026-11-11/inputs/approved-feature-specs/` into the existing canonical E-00 documentation in this repository.
3. Run the repository-required and change-relevant checks, record exact evidence, and deliver one unified execution report on the same branch.
4. Give a professional, evidence-based implementation and integration recommendation for the later code phase, including exact action items for the owner and Manus. Do not perform that later code or infrastructure work now.

Micro is **one application and one product**. Market and Delivery are features within Micro, not separate applications or repositories. The vendor workspace belongs in Market. The driver experience is separately gated and contextually distinct, while using the Micro identity with explicit role/membership/authorization boundaries. Treat these as context; verify exact OD language in the committed specifications before changing canonical documents.

## 2. Authority, inputs, and source-of-truth rules

Read this file and `README-AR.md` first. Then read repository `AGENTS.md`, the live Git state, current-state/Operations Control sources, `docs/00-document-index.md` (especially its distinction among similarly numbered contracts), `docs/expansion/README.md`, and the exact E-00 sources listed in Section 7.

For this task, the six files under `inputs/approved-feature-specs/` are the owner's approved product-decision inputs and are available in GitHub. Use only these committed copies and repository files. **Do not access, connect to, search, link to, or request credentials for any external file service.** Do not include any external file-service URL, document ID, or access instruction in changed files or reports. The repository is the only source of truth for this execution.

Authority order for this task:

1. Current GitHub `main`, PRs, checks, and actual source files establish live repository state.
2. `AGENTS.md`, the applicable E-00 contracts, and canonical Expansion documents govern repository process and existing behavior.
3. The six committed, owner-approved feature specifications govern the latest Market/Delivery product decisions. If an older E-00 statement conflicts with a clear decision in these files, update the repository's canonical E-00 documentation to match the approved input; do not ask the owner to repeat a decision already stated there. After the complete sync, the canonical documents selected by `docs/00-document-index.md` become the operative source of truth; the frozen inputs remain read-only provenance and must not become a competing live decision source.
4. Technical recommendations, proposed provider choices, or unresolved statements in the input files are not automatically owner-approved architecture or permission to configure a provider.
5. The structural scan report in `inputs/owner-background/` is read-only evidence. No structural finding or remediation wave is authorized by this task. The `Micro_Other_Issues_Tracker_AR.md` is a reminder list only; do not execute its unrelated items.
6. The prior A-to-Z plan and prior prompt in `inputs/owner-background/` are historical context only. They are superseded wherever they conflict with this prompt or the six approved specifications. Do not execute the historical prompt and do not treat its older D01-D19 questions as open if the committed specifications resolve them.
7. The supplementary UX file is context only. Current repository UX/architecture authority and the approved feature UX specifications remain controlling.

Do not treat a document as proof that a capability is implemented. The current task is documentation and Operations Control only.

## 3. Authorized write boundary

### Allowed on the handoff branch

- The minimum necessary source records for the PR #384 Control reconciliation, including the relevant Operations Control JSON source(s), `docs/operations/current-state.md`, and its append-only history if required by repository protocol.
- Regenerated views only through the repository's documented generator. Never hand-edit anything under `docs/operations/control/generated/` or generated spreadsheets.
- Existing canonical Expansion decisions, tracker, contracts, role/access matrix, scenarios, traceability, owner IA, and execution-gate documents only where the OD crosswalk demonstrates an update is needed.
- A single unified `EXECUTION-REPORT.md` at this handoff directory, plus minimal navigation/index changes only if existing repository conventions require them.
- Separate commits for distinct accomplishments/phases on this same branch, with meaningful commit messages. Push each completed commit to this same branch. Never rewrite or force-push history.

### Forbidden

- Any change to `main`; merge; branch deletion; force-push; unrelated cleanup; or work on another branch/PR.
- Any application source-code, test-code, migration, runtime configuration, database, schema, local storage, or UI implementation changes.
- Structural refactoring, module/file moves, `features/` creation, code-organization work, or implementation of any finding in the scan report.
- Any access to a Cloudflare, identity, database, storage, notification, hosting, DNS, or other provider account/API; no resource creation or modification, deployments, DNS/TLS, secrets, or live OAuth configuration.
- Any external file-service access. No links to such services in the branch.
- Any claim that Market/Delivery, authentication, access control, private file storage, Cloudflare resources, a connected environment, or Pilot is implemented/verified merely because documentation describes it.
- Any hidden change to financial or product semantics beyond the approved OD decisions. Do not connect a network event to Manage money, inventory, or order fulfillment unless the approved specifications expressly authorize that behavior.

If a source or feature gap requires code or a provider decision, record it as a blocker/recommendation for a later authorized phase; do not solve it now.

## 4. Execution model and specialists

Z AI is the sole accountable analyst and writer. For the comprehensive read-only assessment, if internal subagents are available and the incremental token cost is reasonable, use five non-overlapping read-only scopes on the same verified base SHA: (1) current app architecture, stack, persistence, and data flows; (2) Market decisions and fit to current code; (3) Delivery, driver roles, evidence privacy, and fit to current code; (4) identity, authorization, security, privacy, and cross-cutting UX; (5) Cloudflare/other integration evidence, tests/CI, and release operations. Do not have subagents write or repeat whole documents. Each returns concise paths/symbols, findings, gaps, and risks; the parent independently reconciles evidence and is the only writer. If subagents are unavailable or wasteful, perform the same scopes sequentially without blocking.

## 5. Phase 0 — Live-state preflight (read-only)

Before editing:

1. Verify `Qays7753/Micro`, default branch `main`, current full `origin/main` SHA, the current handoff branch, its base, local and remote worktree status, handoff commit, untracked/modified files, existing branches, open PRs, and any work already present on this branch. Do not trust the expected SHA in this file without checking.
2. Verify repository visibility and access are adequate for the owner's intended branch work; do not change repository settings.
3. Verify the six specification snapshots exist and that `SOURCE-MANIFEST.json`/`SHA256SUMS.txt` match them. Do not alter these frozen inputs.
4. Reconfirm PR #384's actual merged state and exact merge SHA. Inspect required check-runs and the evidence relevant to DOC-032/WS-248. Separate merge, check success, item acceptance, and verification.
5. Confirm there are no active conflicting claims/PRs and read `generated/AGENT-BRIEF.md` and `generated/ACTIVE-WORK.md` as evidence only; generated files are not editable sources.

If `main` has advanced from the expected base or the handoff branch differs materially from the expected state, preserve everything and stop with `STATE_DRIFT`; do not reset, recreate, rebase, cherry-pick, or force-push. Report exact SHAs and the minimum owner decision needed. If the known Control discrepancy is the only expected failure, proceed to Phase 1 because resolving it is expressly authorized.

### Independent A-to-Z baseline analysis (read-only; complete before any writes)

After the live-state preflight and before editing repository sources, independently inspect the actual repository/codebase and the six approved feature specifications committed in this handoff. The existing scan report, prior A-to-Z plan, and old Z AI prompt are cross-check inputs only; do not adopt their findings without independently confirming the relevant current files and state. Record your own findings first, then compare them with the supplied report and explicitly show agreements, disagreements, and new findings.

Cover, with exact repository paths/symbols and bounded evidence: current stack and entry points; app shell/navigation and feature boundaries; UI-to-domain-to-storage/API composition; identity/session/workspace/role authorization; current persistence and data flow; network/API capabilities; image/document storage and privacy; offline, retry, idempotency, and failure behavior; notifications/background tasks; observability/audit; tests, CI, generated docs, deployment/workflows, environment and secrets; and what actually exists versus is only specified for Market and Delivery. Do not read out or paste large source files; provide evidence and concise maps. Do not modify code, architecture, or provider configuration.

Inventory Cloudflare and every other relevant integration from repository evidence only. Classify each as `SOURCE_CONFIG_PRESENT`, `DOCUMENTED_ONLY`, `PROPOSED`, `NOT_FOUND`, or `UNKNOWN`; cite the repository file and setting/binding name, not a provider-console URL. Distinguish prototype needs from connected-pilot and production needs. Evaluate the owner's preference for an initial standalone prototype using local/mock data and manual role management before automated third-party APIs; compare it with the approved OD specifications, and flag any conflict rather than assuming automation or selecting a provider.

Before proceeding to Control/doc edits, produce a concise internal findings matrix: confirmed current behavior; Market/Delivery gaps; integration evidence and unknowns; security/privacy and operational risks; owner decisions still genuinely missing; and the smallest safe phases from design through prototype, connected pilot, and production, each with dependencies and acceptance evidence. Do not perform structural remediation or ask again about decisions already explicit in the committed specs.

## 6. Phase 1 — Operations Control reconciliation

Known baseline discrepancy (must be reverified live): PR #384 was merged into `main` at `16c90e48bdc018939f97f41d05e969c900bc30e0`, while `WS-248` remains `IN_REVIEW`; `current-state.md` still describes the former head and PR #384 as Draft. The required `python3 scripts/operations-control/validate.py` previously failed on this mismatch. `DOC-032` and `WS-248` source JSON and generated views may therefore be stale.

1. Read the actual Workstream and Item JSON schemas, state-transition rules, Control README/authority map, current-state contract, and generator/validator implementations before editing.
2. Verify the merge commit and exact check-runs on that SHA. Use the state transitions required by the repository. After merge, use `MERGED_UNVERIFIED` unless the item-specific criteria and evidence support `VERIFIED` on the exact relevant `main` SHA. Do not infer `VERIFIED` solely from a merged PR, passing generic CI, or historical branch reports.
3. Update only the source records needed to reconcile PR #384, `WS-248`, `DOC-032`, and the live current-state/history. Preserve unrelated workstreams and decisions. Do not alter unrelated stale claims or historical records.
4. Run the documented generator from source JSON. Do not edit generated Markdown, CSV, or workbook manually. If the repository's workbook workflow requires a tool unavailable to you, do not bypass it with an arbitrary rewrite; document the exact blocker for Manus and stop before Phase 2 if the required validator cannot pass safely.
5. Run and record at minimum:
   - `python3 scripts/operations-control/validate.py`
   - `python3 -m unittest discover -s scripts/operations-control -p 'test_*.py'`
   - `python3 scripts/operations-control/generate_tracker.py --check`
   - `git diff --check`

**Phase 1 gate:** The source JSON and live state must agree with verified GitHub facts; generated views must match their sources; the validator must pass. If validation still fails, do not continue to decision synchronization until the exact cause is understood and either fixed within this narrow scope or reported as a blocker. Commit this accomplishment separately on the handoff branch.

## 7. Phase 2 — Complete, canonical OD synchronization

After the independent analysis and successful Phase 1 Control gate, continue on the same branch to the already-authorized Market and Delivery documentation sync. Do not pause between approved decisions to re-ask the owner. Stop for a genuine contradiction in the committed specifications, a missing material owner decision, unresolved security/privacy concern, failed mandatory gate, or scope drift. After the final report, stop before any application-code or provider-account work and wait for owner review/authorization.

### Required repository sources

At minimum inspect and reconcile only as needed:

- `docs/expansion/README.md`
- `docs/expansion/DECISIONS.md`
- `docs/expansion/TRACKER.md`
- `docs/expansion/E00-EXECUTION-PROTOCOL.md`
- `docs/expansion/E00-TECHNICAL-ARCHITECTURE-DECISION.md`
- `docs/expansion/E00-SCENARIOS-AND-ACCEPTANCE.md`
- `docs/expansion/E00-TRACEABILITY-MATRIX.md`
- `docs/expansion/ROLE-ACCESS-MATRIX.md`
- `docs/expansion/MARKET-DELIVERY-OWNER-IA-CONTRACT.md`
- `docs/expansion/FOUR-PARTY-IMPLEMENTATION-GATE-MAP.md`
- `docs/expansion/FOUR-PARTY-PORTAL-AND-ACCESS-RECOVERY-GATE.md`
- `docs/expansion/SEVEN-AGENT-EXPANSION-OPERATING-CHECKLIST.md`
- The E-00 network contracts listed below, using `docs/00-document-index.md` to disambiguate their numbering.

Exact E-00 network contract filenames:

- `docs/contracts/18-network-identity-workspace-access-contract.md`
- `docs/contracts/19-services-notification-manage-boundary-contract.md`
- `docs/contracts/20-market-need-response-listing-moderation-contract.md`
- `docs/contracts/21-delivery-request-quote-status-privacy-contract.md`
- `docs/contracts/22-network-moderation-consent-audit-contract.md`
- `docs/contracts/23-network-data-lifecycle-recovery-contract.md`
- `docs/contracts/24-network-data-classification-field-dictionary-contract.md`
- `docs/contracts/25-network-money-representation-contract.md` when MarketPrice or a related money representation is affected.

**Numbering trap:** The repository has other contracts with the same leading numbers (including local schedule, recurrence, agreement, import, capacity, and general-financial-event contracts). Do not modify those by numeric prefix. Use the exact E-00 network filenames above and the document index.

### Decision coverage and resolution rules

1. Build one 52-row crosswalk before writing: all `OD-01`…`OD-21` for Market and all `OD01`…`OD31` for Delivery. For each row record the exact source file/heading, concise accepted decision, current GitHub target path/section, status (`ALIGNED`, `UPDATE_REQUIRED`, `TECHNICAL_FOLLOW_UP`, or `OWNER_DECISION_REQUIRED`), and evidence. Do not omit a decision because another file repeats it.
2. Preserve already aligned decisions. Update only contradictory or missing canonical text. Keep the current application-vs-future-capability distinction explicit.
3. Ensure the full product model is consistent across decisions, tracker, contracts, roles, scenarios, notifications, technical architecture notes, portal/recovery gates, and traceability. A single approval in one contract must not leave conflicting language elsewhere.
4. Explicitly reconcile the decisions that the previous scan identified as high-risk, while checking the exact approved text rather than relying on this list:
   - Market Listing-first versus legacy Need/Response and pilot-wedge text; national/category scope versus pilot-slice selection; `My Ask Micro` deferral; and any unit/first-run choice deferral.
   - Market listing freshness/confirmation: the approved 30-day reminder, 60-day hide, and reviewed renewal must not be mixed with the old 90-day rule; distinguish owner confirmation from moderator suspension.
   - The approved Micro/Google identity product flow, guest browsing/contact boundaries, vendor applicant/draft/approval boundaries, public-vs-private data, and the technical provider still needing verification.
   - Driver as a distinct experience/role inside the single Micro identity, including application/invitation, manual person/vehicle review, evidence privacy/expiration, known-driver selection, and prohibition on random assignment or silent closure where specified.
   - The limited task-rating/feedback decision (including the OD-17 exception if confirmed in the approved files) must not become a general public ratings/reviews system; eligibility and moderation must remain explicit.
   - Notifications/reminders (including the relevant Delivery OD) must be represented in the E-00 notification boundary contract and scenario traceability without implying a live provider.
   - Market price representation/`MarketPrice` must remain consistent with contract 25 and must not silently become a `MoneyMinor` or Manage financial write.
5. Do not elevate implementation recommendations to decisions. Do not fill gaps in privacy retention, legal review, provider selection, OAuth/session design, database/RLS, image storage, notifications, or connected deployment by guessing. Mark each as a precisely scoped technical follow-up and assign it to Z AI (repository code only), owner, or Manus as appropriate.
6. Make sure `DECISIONS.md` and `TRACKER.md` distinguish (a) approved product decisions, (b) documentation actions completed on this branch, (c) code not implemented, (d) technical choices still open, and (e) the later implementation gates. Do not mark Market or Delivery implemented or ready for real users. Update `README-AR.md` at completion to state clearly that canonical repository documents are now the operative source of truth and the included approved-input snapshots are frozen provenance only.
7. Update the canonical document index only if repository policy requires it for the newly staged handoff or changed canonical documents. Do not create a competing product decision registry or another tracker. Keep the handoff input snapshots immutable.
8. Never edit files under `docs/expansion/historical-source/` to make them look current. If a historical file conflicts, cite it as historical and update the canonical current document instead.

### Phase 2 outputs

- Minimal, consistent changes to existing canonical documents.
- The complete 52-ID crosswalk inside `EXECUTION-REPORT.md` (not a new source-of-truth file).
- A short changed-file index in the report showing why each file changed and which OD IDs it covers.
- A separate commit after the Control reconciliation commit.

## 8. Phase 3 — Verification and final report

After all canonical documentation edits, run the checks applicable to the exact final tree. At minimum:

- `python3 scripts/operations-control/validate.py`
- `python3 -m unittest discover -s scripts/operations-control -p 'test_*.py'`
- `python3 scripts/operations-control/generate_tracker.py --check`
- `git diff --check`
- `node scripts/check-secrets.mjs`
- Run `pnpm check` only if repository policy explicitly requires it for these documentation/Control-only changes; otherwise do not run a broad application suite with no code changes. Do not install dependencies. If required but unavailable, mark `NOT_RUN` and give the exact reason.
- Any focused repository documentation/consistency check that the canonical docs require.

Run applicable checks after each phase/commit and again on the final exact SHA. Do not report a command as passed unless you ran it and recorded exit status and tested SHA. If a check fails, identify whether it is caused by this branch or is a baseline/unrelated failure; fix only in-scope root causes. Do not claim unrelated test coverage or runtime readiness from a docs-only change. Do not trigger workflows or deployments that create external side effects.

Create/update only this report path:

`docs/expansion/handoffs/zai-micro-market-delivery-2026-11-11/EXECUTION-REPORT.md`

The report must be written in Arabic for the owner, with technical paths, IDs, command lines, and raw statuses preserved. Include:

1. Repository, branch, base SHA, final full SHA, handoff commit, phase commits, and worktree state.
2. Exact Control issue and resolution: PR #384 merge SHA, `WS-248`/`DOC-032` transitions, current-state update, generated artifacts, and evidence supporting each status.
3. An independent current-system map based on repository code and canonical docs, with exact paths/symbols; its findings must be written before and compared against the older scan report. Include verified architecture, feature fit/gaps, and any differences from that report.
3. All 52 OD crosswalk rows, with exact source paths/sections and target paths/sections; aligned decisions preserved, changed sections listed, unresolved items labeled.
4. Changed and unchanged files; explicit `NO_APPLICATION_CODE_CHANGES` and `NO_PROVIDER_ACCESS` statements.
5. Commands, exit codes, and exact tested SHA for every test/check; unavailable or failing checks labeled honestly.
6. Any true conflicts, technical follow-ups, risks, security/privacy considerations, and rollback boundary per commit.
7. Professional future-stage plan to reach real operation, separated into code work by Z AI versus account/service work by owner and Manus.
8. An integration inventory derived from repository evidence only. For each relevant item (hosting/Cloudflare, identity/Google sign-in, API/backend, database and isolation, private image/document storage, notifications, DNS/TLS/origin/CORS, rate limiting/abuse controls, logs/monitoring, backups/restore, environments/secrets, legal/privacy, connected UAT), label `SOURCE_CONFIG_PRESENT`, `DOCUMENTED_ONLY`, `PROPOSED`, `NOT_FOUND`, or `UNKNOWN`; cite exact repository path/symbol/setting **name** and what remains to verify. Do not claim an account or resource is live.
9. A clear action table for **Z AI**, **owner**, and **Manus** with prerequisites, order, acceptance evidence, and what requires a future explicit owner authorization. Include no secret values.
10. One next action and one final evidence-supported status.

## 9. Later implementation recommendations — report only, do not execute

After the documentation is consistent, recommend the smallest safe implementation stages needed for both features to work as a real part of Micro. The plan must be concrete and evidence-based, but it is not authorization to code now. Cover shared identity/session and role membership; Market browse, vendor/listing moderation, private images and freshness; Delivery driver onboarding/review, protected evidence, owner selection, request/response lifecycle, notifications/reminders; API/data isolation; accessibility/RTL/mobile UX; auditing, idempotency, backup/restore, operational monitoring; integration and acceptance testing; staged rollout and rollback.
 Separate the standalone prototype, limited connected pilot, and production readiness. Evaluate a manual/local/mock prototype with owner-managed roles before automated third-party APIs as the owner-preferred starting point, subject to the explicit approved OD decisions; do not silently override an OD or choose a provider. For any exception, explain the evidence and decision needed.

For each future stage give: exact product outcome; repository evidence and likely areas to inspect (do not guess changed files); upstream decisions; dependency; code owner (Z AI); external-service/account owner (owner + Manus); test/acceptance evidence; privacy/security/financial risk; and rollback. Do not invent an architecture, provider, timeline, cost, or legal conclusion. Label estimates as estimates and state the evidence needed to confirm them.

The integration recommendation must explicitly answer:

- What does the repository prove is already configured or merely referenced for Cloudflare and other providers?
- Which resources might be required to make the approved behavior real, and what is not yet proven (identity, API, database, private files, notifications, DNS/TLS/origins, abuse controls, logs, backup/restore, staging/production)?
- Which exact steps are for Z AI to implement in code later, and which are manual steps for the owner and Manus in provider accounts?
- What should be decided/verified before spending money or using real driver/vendor identity documents?
- What minimal connected acceptance should be demonstrated before a pilot or production claim?

Do not browse or access provider accounts. Do not output provider-console links. Use repository paths and setting/binding names only.

## 10. Stop, resume, and final boundary

Stop and report `BLOCKED` if live repository state differs materially, the Control validator cannot be made to pass safely within the allowed scope, an approved specification contradicts itself on a material product/privacy/financial rule, a necessary owner decision is absent, or a required operation would touch code/provider settings/`main`/merge.

For the current invocation, complete the independent read-only analysis, Control reconciliation, Market documentation sync, Delivery/cross-cutting documentation sync, and the unified A-to-Z/integration report on this one branch. Use a separate commit for each accomplishment, run only the checks required for the changed Control/docs, then push and stop for owner review before code. Do not re-ask decisions already approved in the committed specs. Checkpoints never authorize scope expansion.

At the end, push the completed commits to `zai/micro-market-delivery-handoff-20261111` and report the branch URL, each commit SHA, final full SHA, exact changed paths, checks and results, report path, and one next action. Do not merge, deploy, access external providers, or perform cleanup. End with exactly one status:

- `ANALYSIS_CONTROL_AND_DECISION_SYNC_COMPLETE — OWNER_REVIEW_REQUIRED_BEFORE_CODE`
- `BLOCKED — <specific cause>`
- `STATE_DRIFT — <specific cause>`

Always state whether any item remains `NOT_RUN`, `UNVERIFIED`, or `OWNER_DECISION_REQUIRED`. A successful documentation sync does not mean the two features are implemented or ready for real users.


**NO_CLEANUP:** Do not delete, rename, or reorganize repository files outside the exact authorized writes above.
