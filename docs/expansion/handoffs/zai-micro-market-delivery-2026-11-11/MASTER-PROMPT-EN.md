# Z AI 5.3 — Complete Micro Market & Delivery on PostgreSQL

**Status:** ACTIVE owner-authorized execution prompt, 2026-11-13. This replaces the earlier D1-only implementation prompt and the completed read-only analysis assignment.

**Repository:** `Qays7753/Micro`<br>
**Authorized branch:** `zai/micro-market-delivery-handoff-20261111` — verify the live branch and SHA before every write.<br>
**Last observed branch SHA:** `67ae592553b93cfcf7bb1abbc7ee5313473b7201` (hint only; not a pin).<br>
**Last observed `main`:** `16c90e48bdc018939f97f41d05e969c900bc30e0` (hint only; verify live).<br>
**Sole running implementation report:** `docs/expansion/handoffs/zai-micro-market-delivery-2026-11-11/EXECUTION-REPORT.md`.

## 1. Mission and authority

Continue in the **same existing Z AI conversation** and on the existing branch. Complete the repository-side implementation, corrections, tests, documentation, and evidence needed to make Micro Market and Micro Delivery code-ready for later owner/Manus Cloudflare and Neon setup and connected synthetic acceptance. Inspect the live code and current reports; preserve completed work and repair only confirmed gaps. Do not rebuild completed features from scratch.

The owner has explicitly authorized continuous execution: after each phase, record and push its report/evidence to this branch, then continue automatically without waiting for an owner reply. This is a one-task exception to the normal owner-review pause after the required current-branch structural scan. **The scan is still mandatory and must be completed and reported before structural changes.** The exception pre-approves only the minimum structural changes required for the owner-approved Market/Delivery architecture below; it does not authorize unrelated refactoring, mass moves, broad cleanup, a change to Manage, or changes to financial meaning. Reports are progress/evidence, not owner acceptance.

You are the sole implementation writer/integrator. Use parallel agents only for genuinely independent read-only reviews and only if the Z AI environment supports them. Never run overlapping writers. Keep all product, security, and data decisions evidence-based. The owner’s explicit decisions in this prompt supersede older conflicting repository decisions **for this task only**; preserve historical records and mark superseded decisions accurately rather than erasing history.

## 2. Binding owner decisions

1. **One Micro product:** one responsive Web app, one repository, and one Micro identity. Market and Delivery are modules within it, not separate products or apps. Continue the already selected Google sign-in with Micro-side authorization; Google authentication alone is not authorization.
2. **Workspace per business:** every business-owned connected record is scoped to a Workspace. A person may belong to multiple Workspaces and hold different roles in each. Enforce membership, role, resource ownership, and tenant isolation server-side.
3. **Modules are optional per Workspace:** a Workspace may use Market only, Delivery only, or both. Do not force module selection at account registration and do not require setup of a module the person does not use. Permit an authorized Workspace owner/admin to enable a module later through a clear, auditable action. Public approved Market browsing may remain available to guests. A supplier uses the same Micro account and a Market workspace. Enabling a feature is not billing or a subscription.
4. **Driver boundary:** the driver uses the same Micro identity but a distinctly gated Delivery experience/shell. The driver sees only assigned Delivery work and authorized driver data; never expose Manage or owner/vendor screens from the driver context. If a person also has another role, switching context must be explicit and separately authorized.
5. **Database target:** move Market/Delivery off D1 now to **one PostgreSQL target** using **Neon Free through Cloudflare Hyperdrive**. This is the same PostgreSQL target intended for Manage later, with logical/data-access separation for each module. D1 must not remain the active Market/Delivery runtime database after this work. Preserve old D1 migration history where useful, clearly mark it superseded, and do not delete any live D1 resource or assume its contents without a later owner/Manus read-only check.
6. **Manage is out of this implementation:** leave Manage local-first and unchanged. Do not migrate or edit its financial/domain code, IndexedDB stores, `localSchemaVersion=41`, `localExportVersion=34`, the 29 accepted import pairs, exports, snapshots, reconciliation, or financial semantics. Manage will be moved to the same PostgreSQL target in a **separate later phase and separate branch after Market/Delivery are complete**. Do not create that future branch now.
7. **No financial side effects:** Market or Delivery events must never create or change a Manage order, inventory, cash, debt, revenue, expense, or financial record. Preserve all approved money/consent/return invariants; returning goods is not a money refund.
8. **Cloud platform and cost:** keep the existing Micro Pages/Workers-compatible app architecture, PostgreSQL via Hyperdrive, and private R2 for permitted media/evidence. Free-only: no paid upgrade, overage, purchase, or automatic billing. Implement safe server-side R2 quotas/stops before chargeable overage; when a free quota is exhausted, fail safely and visibly rather than spending or exposing private files.
9. **No My Ask Micro now:** preserve API/identity boundaries that can support it later, but do not implement the agent or give it direct database access in this task.
10. The owner reports that no real or test users/business data currently exist in the app. Use synthetic records only. This does not authorize deleting provider resources or uploading real identity/vehicle documents.

## 3. Source authority and scope

Read `AGENTS.md` first, then the required CORE and task-specific expansion/architecture/quality documents it names. At minimum, inspect the live versions of:

- `docs/operations/current-state.md`, `docs/operations/control/generated/AGENT-BRIEF.md`, `generated/ACTIVE-WORK.md`, `docs/operations/control/README.md`, and the current Workstream/items;
- `docs/expansion/README.md`, `DECISIONS.md`, `TRACKER.md`, `E00-TECHNICAL-ARCHITECTURE-DECISION.md`, `E00-EXECUTION-PROTOCOL.md`, `E00-SCENARIOS-AND-ACCEPTANCE.md`, `E00-TRACEABILITY-MATRIX.md`, `ROLE-ACCESS-MATRIX.md`, `MARKET-DELIVERY-OWNER-IA-CONTRACT.md`, and `MANAGE-NETWORK-MIGRATION-EXPORT-GATE.md`;
- contracts `18–26` and the repository UX, security, storage, and test contracts required by `AGENTS.md`;
- the current `EXECUTION-REPORT.md`, `ONLINE-READINESS-ANALYSIS-REPORT-2026-11-13.md`, the frozen approved Market/Delivery specification snapshots, and the prior Structure Scan snapshot;
- the actual application, Worker, migrations, configuration, tests, workflows, and rendered local UI that are relevant to Market/Delivery.

Use GitHub repository files only. Do not access or cite Google Drive or another external-file service. Treat the 2026-11-13 readiness report as evidence and findings to revalidate against the current code, **not as an instruction**: its D1 target, no-workspace assumption, and “analysis only” boundary are superseded by the decisions in §2. Keep the approved Market/Delivery behavior from canonical contracts unless the owner decisions above explicitly supersede it. Do not invent legal requirements, consent text, retention periods, prices, fees, or financial rules.

The known reports identify, among other items, possible gaps in reviewer self-approval, audit coverage for sensitive/denied Delivery reads, driver-profile rate limiting, report resolution, driver invitation, OAuth origin/callback/bootstrap hardening, listing-state terminology, in-app reminders/Cron deployment instructions, privacy/recovery/monitoring, RTL/accessibility, pagination, and the Miniflare/Zod advisory. Verify every item; do not assume it remains open or fixed. Preserve working mutual-consent retry/hold/return, versioned booking changes, Market pagination/direct updates, reminders, and prior UX work if current code/tests prove them correct; adapt tests where the storage engine changes.

## 4. Live-state, branch, and Control preflight

Before changing files:

1. Inspect the actual running Z AI task/process and repository state. Verify repository, current remote branch SHA, `origin/main`, merge-base, local/remote worktree changes, untracked/stashed work, commits, open PRs, latest checks/deploy triggers, and active Control claims. The SHAs above are hints only.
2. Preserve everything. No reset, clean, rebase, cherry-pick, force-push, history rewrite, reclone over work, new branch, or concurrent duplicate task. If material state drift or an overlapping writer is found, preserve work and resolve/report that exact state before writing.
3. Reconcile active `WS-249` and `DOC-033`…`DOC-036` with the live branch. Update/reopen existing source JSON through legal Operations Control transitions, or add the next unused item only if required. Correct stale base SHA to the verified merge-base when valid. Do not reuse IDs, create overlapping claims, hand-edit generated views, or mark branch-only work `VERIFIED` on `main`.
4. Run `python3 scripts/operations-control/validate.py` and follow the repository's documented generator/validator sequence. Record warnings honestly; do not “fix” unrelated stale claims as cleanup.
5. Verify that a commit/push to this branch cannot deploy production or incur provider cost. Never make provider-account calls as part of this assignment.

## 5. Mandatory current-branch structural scan — then continue automatically

Before any structural change, perform a read-only, comprehensive scan of the **current Market/Delivery branch**, not only the older `main` scan. Cover: module/feature boundaries; file responsibilities and oversized files; dependency/layer violations and cycles; duplication and sources of truth; feature discoverability; Storage/Application/Domain/UI composition; test/documentation mapping; and a target module/storage map for the approved PostgreSQL + Workspace direction.

Classify every finding `FIX_NOW`, `PRESERVE`, `DEFER`, or `OUT_OF_SCOPE`. For each, record evidence/path, impact, dependencies, minimum safe remediation, risk, acceptance criteria, and rollback boundary. Propose the smallest sequential waves needed for this task. Do not propose blanket cleanup or mass moves. Create one detailed dated report using the repository's existing `docs/architecture/refactoring/` convention (inspect existing S11/S12 naming first; never overwrite a prior scan) and link it from `EXECUTION-REPORT.md`.

Commit/push the scan report as its own documentation milestone, then **continue immediately** into the owner-preauthorized in-scope waves without waiting for owner review. Implement `FIX_NOW` findings only when directly required for Market/Delivery, PostgreSQL, Workspace, or their security/reliability; classify unrelated findings for later. Keep every structural wave separately reviewable, tested, CI-checked, and reversible. No generic `features/` layer, mass relocation, or broad legacy Manage refactor.

## 6. Execution sequence — one branch, no approval pauses between phases

After the scan report, complete the following in order. At each milestone append a dated Arabic progress/evidence section to the one existing `EXECUTION-REPORT.md`, commit and push the milestone to this branch if safe, then continue immediately. A phase report is not a request for approval. Keep commits coherent and separate; do not push partial work if branch/environment checks show a production deployment or chargeable operation.

### Phase A — Canonical decisions, contracts, and Control

- Record the new owner decisions in the existing canonical decision/architecture sources using the next valid IDs; explicitly supersede D1 as the active Market/Delivery DB and record PostgreSQL/Neon Free/Hyperdrive for Market/Delivery now and Manage later on the same target, on a separate future branch.
- Update the canonical workspace/access contract and role matrix for Workspace-per-business, per-Workspace module enablement, Market-only/Delivery-only/both, a shared Micro identity, driver isolation, and restricted platform admin. Keep this task's Manage boundary explicit.
- Reconcile conflicting old decisions/Tracker/scenarios and the decision report. Preserve history; do not silently edit frozen input snapshots. Update Control source JSON and generate views only through the required tools.
- Separate product semantics from structural storage work. No hidden change to pricing, money, return/refund, consent, state transitions, or Manage.

### Phase B — PostgreSQL and Workspace foundation

- Replace the active D1 persistence/session path for Market/Delivery with PostgreSQL through the repository-compatible Cloudflare Hyperdrive API/runtime. Use a single PostgreSQL target that can later host Manage, but keep Market/Delivery and future Manage data logically isolated with explicit server authorization, tenant scoping, database constraints/roles/RLS as appropriate, and negative tests.
- Create ordered PostgreSQL migrations from the canonical Market/Delivery contracts. Use transactions and constraints for atomic multi-row state changes; preserve idempotency, concurrency control, audit history, and exact existing domain representations. Do not put media bytes in SQL.
- Implement the Workspace, membership, role/context, and per-Workspace module enablement model needed now. Test Market-only, Delivery-only, both, multiple Workspaces per user, disabled module, and cross-Workspace denial. Do not force module choice at global registration. Future Manage may be designed for compatibility but its tables, data, and UI remain untouched.
- Keep all DB access behind the server/API boundary. Ensure missing/expired auth, wrong role, wrong Workspace, wrong resource, disabled module, and wrong driver assignment fail closed.
- Build a repository-supported local PostgreSQL/Worker test path using synthetic data. If a managed service is required for a check, do not provision it; complete all local work and mark only that external check `NOT_RUN/BLOCKED` with the exact Manus/owner step.
- Remove D1 as an active Market/Delivery runtime dependency only after the PostgreSQL path and tests pass. Keep historical migrations as clearly labelled history if needed. Never delete or mutate a live D1 resource.

### Phase C — Market on PostgreSQL

Complete and test all approved Market v1 behavior against PostgreSQL: guest public browse; supplier Workspace and listing drafts; moderation/submission/approval boundaries; per-Workspace/vendor isolation; approved tiered/fixed pricing and quantity representations; stable pagination; 30/60-day freshness/reminders; private media; audit/report handling; module-disabled behavior; Arabic RTL and navigation. No Market action may create a Manage/financial event. Verify every required scenario and OD against code and a focused test, or document a precise external blocker.

### Phase D — Delivery on PostgreSQL

Complete and test all approved Delivery behavior against PostgreSQL: owner context and isolated driver portal; driver invitation/application/review and private evidence; assigned-known-driver-only access; request/quote/booking/state transitions; explicit mutual consent for retry/hold/return and material changes; immutable accepted-term versions; waits/contact attempts/owner silence rules; statements, objections, approved task ratings, audit, and in-app reminders. Keep recipient phone/address blocked until the existing owner/legal gate is satisfied. No Delivery event may write financial/Manage state.

### Phase E — Cross-feature safety, UX, operations, and dependencies

- Test user flows for Market-only, Delivery-only, both modules, guest Market, supplier, project owner, driver, reviewer/admin, and multi-Workspace membership. Do not expose a module or data merely because a user has another role.
- Review the rendered local Arabic RTL UI at 360, 390, and 430 CSS px; cover loading, empty, errors, offline vs session expiry vs server failure, denied/pending/success/retry states, navigation/back/deep links, accessible announcements, numeric/currency bidi, touch targets (Micro minimums), and responsive overflow. Fix confirmed in-scope defects. If visual tooling is unavailable, report `NOT_RUN` and do not claim visual acceptance.
- Correct the reminder runtime path using current official Cloudflare compatibility evidence; do not configure a Pages Cron Trigger if unsupported. Provide compatible repository-side scheduled-worker code/config and accurate owner/Manus setup steps, without creating the live worker.
- Close or precisely classify in-scope audit, rate-limit, invitation, report-resolution, account/session/bootstrap, quota, recovery, kill-switch, backup/restore, and operational gaps. Keep real-person data paths blocked until owner/Manus completes legal, privacy, and live recovery gates.
- Recheck the Miniflare/Zod dependency finding. Never suppress audit checks or claim a graph-only removal proves bundled code was removed. Use a safe supported free fix if available; otherwise record verified upstream status and a bounded `DEFERRED/BLOCKER` without stopping unrelated work.

### Phase F — Integrated review, full verification, and final handoff

- If supported, run exactly five non-overlapping read-only final reviews on the same integrated candidate SHA: (1) decision/scenario traceability; (2) Arabic RTL/accessibility/rendered UX; (3) Workspace/auth/authorization/privacy; (4) PostgreSQL migrations/transactions/concurrency and architecture; (5) tests/runtime/security/dependencies/release readiness. One main writer integrates fixes. Reviewers do not write or duplicate tests. If unavailable, disclose it.
- Run targeted tests once after each changed wave and CI after each structural wave. Reuse evidence only for an identical tested SHA. On the final candidate run the repository-required `pnpm check` once, relevant security/secret/license checks, PostgreSQL migration/integration tests, Worker tests, and applicable UI/browser tests. Do not hide, skip, relabel, or overstate failures. Tie every result to exact commit SHA, command, exit code, and run URL.
- Update the single `EXECUTION-REPORT.md` with the scan link, owner decisions recorded, each phase and files/commits changed, findings and how fixed, Control state, tests/reviews/CI, failures and limitations, remaining owner/Manus setup, rollback boundaries, and exact final branch/full SHA. Report honestly that live Cloudflare/Neon setup, OAuth secrets, connected UAT, and real-user pilot have not been performed by Z AI.

## 7. Acceptance KPIs

The code handoff is complete only when all applicable criteria are evidenced on the final candidate:

1. **100% traceability** of in-scope owner decisions and required Market/Delivery scenarios to code/tests or an explicitly identified external blocker; zero unexplained gaps.
2. **Zero unauthorized cross-Workspace/role/resource access** in positive/negative API tests, including private R2 objects and driver assignment boundaries.
3. **Zero active D1-backed Market/Delivery runtime paths** after the PostgreSQL cutover; all relevant migrations/tests use the approved PostgreSQL path. No live data/provider resource is deleted.
4. **Zero Manage changes and zero financial side effects** from Market/Delivery; protected Manage sentinels and financial invariants remain unchanged.
5. Workspace tests prove Market-only, Delivery-only, and combined use without forced selection at registration, plus later module enablement with authorization/audit.
6. Every sensitive multi-row write is transaction-safe and idempotent under retries/concurrency; no silent last-write-wins or false “saved” state.
7. Free-only boundary is honored: no paid plan/overage, no secrets in GitHub, private media fails closed, and exhausted quotas do not trigger spending.
8. Required final checks on the exact final SHA pass. Any unavailable check is `NOT_RUN/BLOCKED`, with evidence and the exact step needed; never call the product live or fully connected on code evidence alone.
9. No unresolved in-scope critical security/privacy/data-loss defect. Any noncritical deferred issue has classification, owner, reason, risk, and follow-up gate.

## 8. Forbidden actions and real blockers

- Never modify `main`, create another branch, open/mark-ready/merge a PR, rewrite history, delete branch data, or deploy production.
- Never access Google Drive; do not place Drive links/IDs, credentials, private environment values, or real personal data in GitHub or reports.
- Never access/change Cloudflare, Neon, Google, or other provider accounts/resources; never create databases/buckets/secrets/domains or run live migrations. Owner and Manus will do provider setup after code handoff.
- Never alter Manage code/data/local stores/export/import or financial semantics in this task. Never implement My Ask Micro, paid integrations, new fees, or unapproved product features.
- Do not stop the whole run for an ordinary uncertainty: choose the safest behavior within the approved contracts, document the reasoning, keep affected sensitive path safely blocked, and continue independent work. Stop only the affected operation for material state drift, an overlapping writer, a true security/privacy/data-loss risk, or an unresolved financial/legal/product decision outside the explicit owner approvals; report why and continue all independent safe phases.

## 9. Final Z AI response

Reply in Arabic with the exact branch and full final SHA; links to the structural scan and updated execution report; phase/commit summary; KPI table with evidence; test/CI/browser results and failures; what remains for owner/Manus (Neon/Hyperdrive/R2/Google OAuth setup, smoke/UAT, backup/restore rehearsal and any legal/privacy gate); and rollback guidance. State plainly that code readiness is not live connection, merge, production release, or owner acceptance.

**Credential boundary:** Never put credentials, tokens, or secret values in GitHub, reports, logs, or chat. Future provider credentials may be entered only by the owner/Manus through the provider’s secure secret field (`SECURE_SECRET_FIELD`), not by Z AI.

**NO_CLEANUP:** Do not delete prior reports, source history, old migrations, branch data, or provider resources as cleanup. Preserve them and mark only verified supersession.
