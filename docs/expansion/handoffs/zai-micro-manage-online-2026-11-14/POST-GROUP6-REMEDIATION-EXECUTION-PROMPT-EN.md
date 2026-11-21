# Z AI — Micro Post-Group 6 Remediation and Completion Prompt

**Status:** Owner-authorized continuous repository execution, 2026-11-21. This is a new, bounded continuation after the completed Manage Online M1–M6 work. It does not accept prior work, approve a release, or authorize a merge.

**Repository:** `Qays7753/Micro`
**Only write branch:** `zai/micro-manage-online-20261114`
**Starting-head hint:** `f5305e59a25471542fde2eee810f444cd4a5cb9e` — verify live before acting.
**Read-only owner-decision source:** branch `docs/micro-final-decisions-20261121`, last observed head `b04ba6efb634e89a06ee23c7a62dab33ae8c6081`. PR #385 is open against `main`; read its branch only. Do not edit, retarget, approve, or merge PR #385.

## 1. Mission and authority

Continue the existing Micro implementation on the existing Manage Online branch. Reconcile the current code with the owner’s final decisions dated 2026-11-21, implement the safe, code-level gaps and applicable open security fixes, improve affected user journeys against the existing UX KPI framework, and deliver evidence for every result. Work continuously through the authorized waves below without pausing for routine approval. Send short Arabic progress updates only at meaningful milestones; updates are informational and must not pause work.

The M1–M6 Manage Online implementation is reported complete in `MANAGE-ONLINE-IMPLEMENTATION-REPORT-2026-11-14.md`. Verify the actual branch and preserve that evidence; do not redo M1–M6 or mark DOC-040 accepted. The report’s earlier code/commit evidence remains historical and must not be treated as proof of the current final-decision gaps.

This prompt supersedes the 2026-11-14 implementation prompt only where the owner’s 2026-11-21 decisions or the explicit restrictions below differ. Existing contracts and financial invariants remain binding unless a later owner decision explicitly changes them. Never silently resolve a conflict in financial meaning, privacy, security, or legal retention.

## 2. Live-state preflight — preserve first

Before editing:

1. Verify repository URL, target branch, full local and remote SHAs, `main` SHA, merge base, worktree status, untracked/stashed files, active Z AI jobs/writers, open PRs, recent Actions, and the current Operations Control records. Treat every SHA above as a hint until verified live. Do not infer live deployment or runtime behavior from a code report.
2. Preserve the untracked Post-Group 6 structure/architecture/code-organization scan report in the current Z AI workspace. Record its exact path and SHA-256. Do not delete, overwrite, stage, publish, or replace it. Do not switch or reset the existing worktree; use a separate worktree for the target branch if needed. If a backup is necessary, copy to a unique path, verify the copy, and keep the original untouched.
3. Never run `git reset`, `git clean`, destructive checkout, force-push, rebase, history rewrite, or branch pruning. Do not overwrite another writer’s work. If the target branch, worktree, active process, or remote state differs materially, record `STATE_DRIFT` and stop only the affected work until it is safe to continue.
4. Inspect Operations Control before code. The last observed records are WS-250 on this branch (`IN_PROGRESS`) and DOC-040 (`IN_REVIEW`); WS-249 is `REVIEW_REQUIRED` on its separate Market/Delivery branch. Re-read live JSON and generated views. Keep DOC-040 and WS-249’s review evidence intact; do not mark either `VERIFIED`, accepted, merged, or complete on the owner’s behalf. Continue under WS-250 only if the validator permits it; otherwise use a legal source-JSON transition and a new item/claim on this same branch. Never edit generated views manually. If a specific overlap cannot be resolved without violating Control, mark only that slice `BLOCKER` and continue independent work.
5. Fetch the owner-decision branch read-only (`git fetch origin docs/micro-final-decisions-20261121`) and read `docs/product/decisions/final-decisions.md` and `docs/product/decisions/gap-analysis.md` from that branch/head using `git show`. Do not merge, cherry-pick, or push to that branch; do not modify PR #385.

## 3. Required sources

Read the current versions of these sources before implementation:

- `AGENTS.md`, `docs/operations/current-state.md`, `docs/operations/micro-thinking-charter-v1.md`, `docs/operations/agent-handoff-protocol-v1.md`, `docs/operations/control/README.md`, `docs/operations/control/generated/AGENT-BRIEF.md`, and `docs/operations/control/generated/ACTIVE-WORK.md`.
- `docs/expansion/handoffs/zai-micro-manage-online-2026-11-14/MANAGE-ONLINE-IMPLEMENTATION-PROMPT-EN.md` and `MANAGE-ONLINE-IMPLEMENTATION-REPORT-2026-11-14.md`.
- `docs/expansion/handoffs/zai-micro-manage-readiness-2026-11-14/MANAGE-READINESS-CI-UX-PROMPT-EN.md` and `evidence/UX-KPI-MATRIX-2026-11-14.md`.
- `docs/architecture/refactoring/s13-manage-online-readiness-20261114/S13-MANAGE-STRUCTURE-ARCHITECTURE-CODE-ORGANIZATION-SCAN-REPORT-2026-11-14.md` (historical evidence only; it is not permission for new structural work).
- `docs/expansion/MANAGE-NETWORK-MIGRATION-EXPORT-GATE.md`, `docs/expansion/ROLE-ACCESS-MATRIX.md`, relevant contracts 04, 05, 18, 21, 22, 23, and 25, financial P0 policies, `docs/expansion/handoffs/zai-micro-market-delivery-2026-11-11/EXECUTION-REPORT.md`, and the relevant source/tests.
- From the read-only owner-decision branch: `docs/product/decisions/final-decisions.md` and `docs/product/decisions/gap-analysis.md`. The latter’s §4 contains the repository-accessible, 30-row security findings register.
- The project-shared source `Micro — تقرير التدقيق الأمني 2026-11-19.md` is the open, source-pinned register. Read it if it is available in the current Z AI project context. If it is not available, use the complete §4 register in the decision-branch `gap-analysis.md` as the accessible mirror and state that limitation honestly; do not claim to have read the unavailable source file. Do not copy the full source audit into this public repository.
- `docs/expansion/handoffs/zai-micro-market-delivery-2026-11-11/inputs/owner-background/Micro_UX_Principles_Supplementary_AR.md`.

The 2026-11-21 final-decision files are authoritative over earlier D1–D8 and earlier product decisions where they conflict. The complete current gap analysis is the scope index; do not re-run the 293-question review or redo already completed M1–M6 work.

## 4. Binding owner decisions and hard boundaries

Apply the final-decision document literally, including:

- Micro remains one responsive Web application with the four product contexts Manage, Market, Delivery, and Ask Micro. The intended launch is one invitation-only launch across Jordan’s 12 governorates; no component is to be represented as independently launched or production-ready.
- The owner’s launch threshold is at least 10 suppliers with published listings and at least 5 approved drivers, distributed across the 12 governorates as far as practical. Do not claim this gate is met from synthetic data, and do not count suppliers until the unresolved counting rule in `gap-analysis.md` §1 is decided.
- One Google account; registration creates no role and no project automatically. Project creation is explicit, one project per owner account, one owner per project, and no team/multiple-project feature. Do not activate or expose member invitations. A driver context is limited to its authorized Delivery and Ask Micro data. Admin is a separate server-granted account, not a user-selectable role, with required two-step verification and least privilege.
- Multiple devices are allowed. Implement the owner-approved session list and server-side “sign out all devices” behavior; do not reinstate the earlier one-device rule.
- No SMS. Web Push is best-effort and must never be described as guaranteed delivery. Server time governs deadlines.
- Supplier activation follows profile completion and terms acceptance, without profile-level moderation. Each listing is reviewed before publication; the first listing includes the owner-required verification call. Drivers require admin approval. Never use a “verified/approved” badge that implies an undefined check; do not collect optional supplier documents until their purpose, access, and retention are decided.
- Apply the final Market variant/category/filter requirements and Delivery load, period-booking, capacity, overlap, privacy, and status rules in `final-decisions.md`. Capacity/overlap checks and consequential state changes must be atomic on the server. Do not reveal other customers’ booking details.
- Recipient data follows the exact final-decision access, cancellation, 48-hour driver cutoff, one-year database deletion, and backup deletion-within-30-days rules, subject to the stated legal review before real data. Implement and test only against synthetic data; do not configure or execute a real retention job or backup operation.
- Market and Delivery never create Manage financial records automatically. No last-write-wins, no false saved state, and no financial write without server confirmation.
- Ask Micro remains a required product surface but its AI provider is explicitly deferred by the owner for now. Do not connect, select, configure, call, or pay any AI provider. Preserve a truthful, permission-scoped, read-only, not-configured state; do not invent answers or claim Ask Micro is launch-ready.
- No spending or paid provider/service is authorized. Use synthetic fixtures only. No real user, business, recipient, or financial data may be read, created, transferred, or used.

### Forbidden actions

- No writes to `main`; no new branch; no merging or re-merging the Market/Delivery branch; no PR creation or changes; no merge, force-push, branch deletion, cleanup, or history rewrite. The only Git write destination is the existing `zai/micro-manage-online-20261114` branch.
- No Cloudflare, Neon, R2, OAuth, or other provider API calls or settings/resource/schema writes; no live database connection, migration application, real-data transfer, backup, deployment, or cleanup. Repository migration files and ephemeral/local PostgreSQL tests using synthetic data are permitted.
- No AI-provider wiring for Ask Micro.
- No structural refactoring, bulk file moves, module reorganization, oversized-file splitting, new generic architecture layer, or code-organization changes. The Post-Group 6 scan/owner-review gate remains in force. If a proposed fix requires structural work, classify it `DEFER` and leave the report untouched.
- No dark-mode feature or global token/color redesign. Do not silently remove useful notes or safety/price/status/consent/recovery content to shorten screens.

**Cloudflare Pages safeguard:** the live `micro-prototype` Pages project has previews enabled for non-production branches. Every commit pushed to this branch must begin with the documented `[CF-Pages-Skip]` commit-message prefix so the push does not create a preview. Verify each commit message before pushing. Do not change Cloudflare settings. If the skip behavior cannot be relied upon or a preview deployment is created from this work, stop further pushes and report it; do not attempt a provider-side fix.

## 5. Execution waves — continue without routine approval

First verify each gap against the live target-branch code and tests. Do not implement a gap merely because it appears in an older report. Keep each wave narrow, reversible, and within existing architecture; add regression tests with each code change. Continue to later independent work after a blocker in one slice.

### Wave 0 — baseline and traceability

Complete the preflight, preserve the scan report, reconcile the 14 functional groups G01–G14 and all 30 security findings against the live branch, and record current status, affected paths, dependencies, and first incomplete actions. Do not re-run broad discovery already covered by the existing reports. Do not begin code until branch/claim state and the current gap set are clear.

### Wave 1 — identity, roles, admin, sessions, and explicit context

Address applicable portions of G01, G02, and G06 and related AUTHZ findings. Enforce explicit active context, role, project/workspace, and membership server-side; do not select the first workspace or create a project implicitly. Implement the final role lifecycle, one-project/one-owner constraints, separate least-privilege Admin with two-step verification, audit of admin decisions, multi-device session visibility, and server-side revoke-all. Reject unauthorized direct API requests, not only hidden navigation. Add positive and negative tests across guest, owner, supplier, driver, Admin, and cross-account/context cases.

### Wave 2 — Market, public data, privacy, and moderation

Address applicable portions of G04 and related security findings. Implement the final variant limit and per-variant price/minimum quantity/availability; hierarchical categories and allowed filters; category administration; accurate operational counts; supplier/listing lifecycle; contact reveal with authenticated access, server-side daily limits and audit; report/support entry points; and allowlisted public DTOs. Preserve the exact distinction between supplier activation and listing moderation. Do not add ambiguous trust badges or collect optional documents pending the owner decisions in gap-analysis §1.

### Wave 3 — Delivery, recipient privacy, transactions, and reminders

Address applicable portions of G05, G07, G09, and G10, including AUTHZ-01/02, MD-01..05, SRV-02/03/05/06, and any relevant API/authz findings. Implement load classes/weights, route-match ordering and truthful outside-coverage behavior, period bookings, separate overlapping bookings within driver capacity, and atomic capacity/state transitions. Enforce party consent and minimum-field disclosure, exact 48-hour driver cutoff and immediate cancellation cutoff, owner access, Admin access only for an open case, and synthetic-only retention tests. Add best-effort Web Push behavior, server-clock deadlines, reject/no-show/cancel handling, and report/support flows. Require stable idempotency keys for consequential operations; reservation, state transition, effect, and result must be atomic. Add focused true-concurrency PostgreSQL tests.

### Wave 4 — Manage boundaries and contextual links

Address G08 and applicable MNG-LOCAL-01/02 and SRV-07 findings. Add the approved “request delivery” and “search Market” contextual paths without copying records or creating financial effects. Ensure every financial mutation is blocked from local writes when online-only mode is active and that a stale/unknown mode cannot silently fall back to local financial writes. Make concurrent synthetic migrations safe. Preserve Manage local data semantics and the exact local schema/export `41/34`, all accepted legacy pairs, stores, snapshots, and export/recovery. Do not run a live migration or change actual workspace configuration.

### Wave 5 — remaining security hardening, UX evidence, and final gate

Review every security finding not closed by Waves 1–4, including dependency advisories, CI/audit behavior, Git history scanning, PostgreSQL image pinning, CSP/frame protections, OAuth return validation, safe Markdown rendering, safe import errors/limits, and the remaining Manage-local findings. Make only minimal, directly tested fixes that do not alter protected local formats, cryptographic policy, financial meaning, or provider settings. Findings needing legal/product/provider decisions remain open or explicitly deferred only if an owner decision supports that status.

Reconcile the complete UX matrix for its existing 73 production pages and 71 reusable components. Preserve the inventory and prior evidence. Update stale or affected rows with task-specific purpose, role/context, source class, measurable threshold, observed result, verification method, evidence, score/severity, and status. Do not claim a renewed 100% pass unless every applicable row was actually checked. For modified critical flows, capture representative before/after evidence at supported phone widths where tools permit. Keep human outcomes `NOT_MEASURED` unless people actually tested them; keep visual review `UNVERIFIED` when no visual review was performed. Use WCAG 2.2 web criteria and Micro comfort targets as distinct measures; do not treat 32px alone as proof of accessibility.

## 6. Security register — mandatory continuity

The decision-branch `gap-analysis.md` §4 records all 30 findings as open at the 2026-11-21 baseline. Recheck that baseline against the live report/context before work. Track every finding individually, even when unrelated to the current code slice; do not silently drop any item:

`MNG-LOCAL-01`, `AUTHZ-01`, `AUTHZ-02`, `MD-01`, `MD-02`, `SRV-02`, `SRV-03`, `MD-03`, `SRV-05`, `SRV-06`, `MD-04`, `MD-05`, `SRV-07`, `WEB-01`, `API-01`, `MNG-LOCAL-02`, `MNG-LOCAL-03`, `MNG-LOCAL-04`, `PUBLIC-DRIVER-PROFILE`, `AUTHZ-05`, `AUTHZ-04`, `DEP-001`, `DEP-002`, `CI-001`, `SEC-GIT-001`, `CI-002`, `WEB-02`, `AUTH-03`, `MNG-LOCAL-05`, `MNG-LOCAL-06`.

For each finding, report exactly one current status: `open`, `fixed-verified`, `deferred-by-owner`, or `not-applicable`. A `fixed-verified` status requires the actual fix on the final candidate SHA and a test directly exercising the risky behavior; record file/line, test/command, result, and full SHA. Green CI or a code claim alone is not closure. Use `deferred-by-owner` only when an explicit owner decision supports it, with the decision/source/date. Use `not-applicable` only with evidence and scope reasoning. Before any later deployment or real-data approval, re-check every release-blocking finding; this task authorizes neither action.

For provider/environment-only findings such as actual R2 privacy, Neon separation, live backups/restores, live secrets, or account security settings, do not access providers. Keep them `open`/`UNVERIFIED`/`BLOCKER` as appropriate and list the precise later operator check. Do not assert release readiness while any required gate remains open.

## 7. Tests, CI, and token-efficient verification

- Add focused regression tests with each code change. After each wave, run only the smallest meaningful local tests/type checks/guards for that wave; record exact command, result, count, and candidate SHA. Do not repeat green checks on an unchanged tree or run broad exploratory suites without a finding that requires them.
- After the final integrated candidate, run the complete repository gate once. Prefer one verified test-only `CI` workflow dispatch on the exact final SHA if the current workflow definition remains non-deploying; otherwise run the complete local `pnpm check` once. Do not run both full gates redundantly. Re-run affected checks after any later code change.
- Inspect workflows before dispatch. Never run a deployment/publish workflow. The current CI can upload a test build artifact; that is not authorization to deploy.
- No agent fan-out by default. Use one Z AI writer/integrator. At most one additional read-only reviewer is allowed, only for a bounded independent review on the same final SHA. No parallel writers.
- Never weaken, skip, re-anchor, or inflate a guard/baseline merely to pass. Any required baseline update must follow its documented evidence and approval pattern; otherwise classify it as blocked/deferred.

## 8. Unresolved owner decisions and safe continuation

The four questions in `gap-analysis.md` §1 remain explicit decision points unless the live owner-decision source has since resolved them: supplier badge meaning; optional supplier documents and their purpose/access/retention; supplier phone-reveal eligibility beyond the literal logged-in/button/rate-limit rule; and the exact counting rule for “10 approved suppliers.” Do not fabricate claims, collect optional documents, or claim the launch threshold is satisfied. Apply the explicit logged-in/button/server-limit rule as written; do not invent an additional role gate or broader access rule. Continue independent implementation; record dependent behavior or launch evidence as `BLOCKER` rather than stopping unrelated waves.

The Ask Micro provider is explicitly deferred by the owner even though Ask Micro remains required for the eventual single launch. Therefore the resulting repository may be materially closer to the final product but must not be called fully launch-ready, live, or production-ready.

## 9. Commits, report, and exact stop point

Use only the existing target branch and fast-forward pushes. Each pushed commit must start with `[CF-Pages-Skip]`. Never publish without verifying the marker, target branch, and remote head. Do not create or modify PR #385, create another PR, merge, deploy, or clean up.

Create one new Arabic report without rewriting prior reports:

`docs/expansion/handoffs/zai-micro-manage-online-2026-11-14/POST-GROUP6-REMEDIATION-REPORT-2026-11-21.md`

The report must include repository/branch/base/full final SHA; Operations Control states and legal transitions; each G01–G14 result; all 30 security statuses and direct evidence; changed files/commits and rollback boundaries; tests/CI commands, counts, URLs, exact SHAs and failures; UX matrix coverage and representative visual evidence; schema/export/financial/privacy impact; unresolved decisions; provider/environment checks not performed; all writes explicitly not performed; and the next owner/operator action. Distinguish `VERIFIED`, `INFERRED`, `UNVERIFIED`, `NOT_EXECUTED`, `DEFERRED`, and `BLOCKER`. Do not edit the earlier M1–M6 report to make it appear to cover this work.

Stop after the final code/documentation handoff on the existing branch. Preserve all branches, reports, and worktrees. No owner acceptance, PR, merge, `main` change, real-data activity, provider write, or deployment is included in this authorization. `NO_CLEANUP`.
