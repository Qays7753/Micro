# Z AI — Micro Manage Readiness Scan + CI/UX Closeout

**Status:** Owner-authorized follow-up task. This is a bounded readiness/remediation phase, **not** the implementation of Manage Online.

**Repository:** `Qays7753/Micro`
**Only authorized branch for this task:** `zai/micro-market-delivery-handoff-20261111`
**Last verified code/report head before this prompt-only handoff:** `702fbe627a8fe745c6f33f2c915fe6fe00561a36` (hint only; verify live).
**Controlling outputs:** one Manage scan/readiness report and one concise update to the existing execution report. Do not create a competing master prompt.

## 1. Mission and permission boundary

In the existing Z AI conversation, preserve all work and complete these three bounded workstreams on the authorized branch:

1. Perform a comprehensive, **read-only** Manage Structure/Architecture/Code Organization Scan against a pinned, verified code SHA, then produce the required evidence-based findings and Manage Online migration plan.
2. Diagnose and fix the confirmed GitHub Actions/CI runtime failure and any directly related test-harness issue, without weakening tests or changing product behavior.
3. Conduct a genuine, whole-app Arabic/RTL/mobile UX review and implement confirmed, in-scope improvements—not merely report them—using the current Micro product/UI contracts and rendered evidence.

The owner authorizes continuing from the completed scan into the CI and non-structural UX fixes without an approval pause. **This does not authorize Manage Online implementation, structural refactoring, bulk file moves, code-organization changes, schema/storage/domain changes, financial changes, or changes to product semantics.** The owner must review and accept the Manage scan findings before any structural or Manage Online implementation wave. Stop at that handoff.

## 2. Live-state preflight — preserve first

Before editing anything, verify the live repository, current branch and full SHA, `origin/main`, merge-base, worktree/untracked/stashed changes, active Z AI process/task, open PRs, recent Actions runs, and Operations Control claims. The SHA above is only a hint. Check whether another writer is still active; do not start a duplicate task or overwrite its work.

If the branch is not the authorized branch, there is uncommitted work, an overlapping writer, or material state drift, preserve everything and report `STATE_DRIFT` with evidence. Do not reset, clean, rebase, force-push, rewrite history, create a branch, open/update/merge a PR, or touch `main`. Keep CI and UX remediation on this existing branch. A separate Manage implementation branch is a later owner-approved step, not part of this task.

Read and follow `AGENTS.md`, its relevant CORE, CORE+ARCH, CORE+UI and CORE+QUALITY reading packs, the current Operations Control brief/state, and the canonical documents they point to. In particular, inspect the current `EXECUTION-REPORT.md`, `ONLINE-READINESS-ANALYSIS-REPORT-2026-11-13.md`, the existing S12 scan, Manage migration/export gate, relevant financial/storage/identity/Workspace contracts, `ai-skills/micro-web-native-ux/`, `ai-skills/micro-design-system/`, `docs/architecture/` and its ADRs, current design tokens, UI code/tests, `apps/prototype-web/scripts/pg-test-server.mjs`, and `.github/workflows/ci.yml`. Revalidate old findings against live code; do not repeat completed work or assume an old report describes the final tree.

The previous S12 report is useful evidence but was made at `0d4ae258f774b7f99457c0f18420440f7e971847`, before the Phase F final code. It is not a current Manage scan and does not approve Manage Online structural work. The older `MASTER-PROMPT-EN.md` authorizes continuous work only within its stated Market/Delivery scope; this follow-up explicitly does not extend its structural authorization to Manage.

## 3. Current owner decisions for this task

Treat the following as the latest owner-approved requirements where older documents conflict; report conflicts for later canonical-document alignment rather than silently rewriting history:

- Micro is one Web app with one shared identity/session, Workspace-aware access, and Manage, Market, Delivery, and Ask Micro contexts. Authorization remains server-side and Workspace/role/resource scoped.
- Each Workspace has one Manage Owner only. No employee, accountant, cashier, driver, supplier, reviewer, or platform admin receives Manage financial access.
- Manage is used from one regular device per Owner. Account recovery from another device is allowed; it is not multi-device data sync.
- After migration, Manage financial reading/writing is online-only. Do not build offline financial writes, sync queues, last-write-wins, or a false “saved” state. The server must confirm a save before the UI reports it as saved.
- The intended shared database is PostgreSQL via Neon Free/Cloudflare Hyperdrive; no D1 production path, paid plan, paid provider, or overage is authorized. Do not access provider accounts or use provider secrets.
- No real/test users, business records, or phone installations currently exist according to the owner. Verify this again before a future migration; do not infer it from an empty test database.
- Market/Delivery actions never create Manage financial entries. Ask Micro remains read-only and permission-scoped; do not choose/configure a paid AI provider or invent answers.
- No Manage records, financial/domain logic, local storage, exports/imports, snapshots, schema versions, or accepted legacy import pairs may be changed in this phase. Verify current version values from code; do not assume them.

## 4. Stage A — frozen, read-only comprehensive Manage scan

Pin and record the exact candidate SHA. On that immutable snapshot, perform the full scan before any code, test, workflow, or configuration edits. The scan may write its report only; it must not change source code, tests, CI configuration, generated files, Control state, database/provider state, or deployment state.

Cover all of the following, with concrete paths and evidence:

- Manage, Market, Delivery, Ask Micro, shared shell, identity/session, Workspace, and authorization boundaries.
- Module/feature boundaries; file responsibilities and oversized files; dependency/layer violations and cycles; duplication and sources of truth; feature discoverability; Storage/Application/Domain/UI composition.
- Manage’s actual local storage, data model, schema/export/import compatibility, snapshots, backup/restore/export paths, and every dependency on local-only behavior. Verify counts and versions from current code.
- Mapping from Manage UI/use cases through Application/domain/storage and the shared identity/Workspace/server boundary; identify what must be preserved and what must change for Online.
- Test, CI, documentation, scenario and contract coverage, including gaps and stale/conflicting documents.
- Security/privacy, tenant isolation, Owner-only authorization, session recovery, idempotency, auditability, network failure behavior, backup/restore, data retention/legal questions to be resolved before real partner data, free-tier limits and safe stop behavior.
- A target module/access/storage map for the single Micro app and the eventual shared PostgreSQL target. Do not propose microservices or broad restructuring without evidence.

Create one detailed dated report using the repository’s existing architecture-scan convention, without overwriting S12:

`docs/architecture/refactoring/s13-manage-online-readiness-20261114/S13-MANAGE-STRUCTURE-ARCHITECTURE-CODE-ORGANIZATION-SCAN-REPORT-2026-11-14.md`

For each finding include: ID, category, classification (`FIX_NOW`, `PRESERVE`, `DEFER`, `OUT_OF_SCOPE`), severity, evidence/path, user/data/financial/security impact, dependencies, minimum safe remediation, risk, acceptance criteria, and rollback boundary. Include the target module map and the minimum sequential remediation waves, with dependencies, risks, measurable acceptance criteria, and rollback boundaries. Explicitly state the pinned SHA and that no code/provider writes occurred during Stage A. This report does **not** grant permission to execute its structural recommendations.

## 5. Stage B — CI/test root-cause repair

After Stage A’s read-only report is saved, continue without waiting for owner review on this independent CI repair. Recheck the live result rather than assuming it is unchanged.

Known evidence: Actions run `43519977749` on `4c93e04c719cab110d199ce3b367c0653bc26d9e` failed in `pnpm prototype:test` because embedded PostgreSQL `initdb` could not load `libicuuc.so.60`; the report records the same runner failure on an earlier SHA. Local checks were reported green, but that does not make CI green.

Find the root cause and choose the least brittle fix. The report says the test harness supports `MICRO_TEST_PG_CONNECTION`; evaluate a PostgreSQL service container in CI before considering downloads of an old ICU package. Do not weaken, skip, relabel, or re-anchor tests merely to get green. Keep any fix isolated from application/domain behavior. Run the focused test first, then the required full check on the final candidate. If supported and required, dispatch the documented workflow on this authorized branch only; record the exact run URL, SHA, status, and failure details. Do not run or alter production deployment workflows.

## 6. Stage C — whole-app UX review and implementation

After the frozen baseline scan is recorded, review and improve the **actual current Micro screens and critical flows**, including Manage’s existing local UI, common shell/sign-in states, guest Market, supplier/owner Market, Delivery owner, driver portal, and Ask Micro. Do not limit the work to the attached examples. Be an active senior UX designer: make and justify the best choice within approved Micro product rules; do not return only a list of generic suggestions or ask the owner about routine layout/copy decisions.

Allocate roughly 20% of UX effort to establishing the actual current state and 80% to designing, implementing, and validating better task flows. Use the current in-repository Micro contracts, UX/design skills, approved tokens, and reliable platform/accessibility guidance as the authority. Do not import, merge, copy from, or inspect the separate UI-components repository the owner is developing elsewhere. Do not change brand tokens, typography system, financial meaning, consent, status transitions, data ownership, or permissions merely for visual polish. If a UX improvement requires structural refactoring, a new component architecture, a new design-token decision, a financial/domain change, or an unresolved product/legal decision, record it as a finding and wait for owner review; continue with independent safe fixes.

The owner’s screenshots raised these concrete leads; verify them in the actual code and rendered app before fixing:

- Driver booking/detail screens display raw `dlv_…` identifiers and a product-rule reference such as `OD10`, alongside long explanatory paragraphs and dense controls.
- The Market listing screen displays the raw enum `packaging`, test-like copy (“وصف مادة كافٍ للطول المطلوب لأجل هذا الفحص المرئي”), and a “المالية” bottom-navigation item in a guest context.
- These may be test fixtures. Trace their data source. Keep fixtures isolated from normal/public states, and do not merely delete test data or important user information. Confirm that guests cannot open Manage or retrieve financial data; fix only within the existing authorization contract.

Review all screens/flows for unnecessary implementation/specification text, untranslated enums, ambiguous or repetitive copy, hierarchy and density, primary actions, back/navigation/dead ends, loading/empty/no-results/error/denied/offline/server-failure states, keyboard/long Arabic text, RTL/numeric bidi, accessibility announcements/focus, and responsive behavior. Keep copy direct, concise, user-facing, and truthful; preserve information needed for consent, safety, price, status, or a consequential decision. Apply progressive disclosure rather than shrinking or hiding essential information.

Implement confirmed non-structural UX improvements on the existing branch, preferably in cohesive, reversible commits. Maintain server-side authorization and all financial/business behavior. Use current Micro touch-target requirements; do not treat the prior 32px automated threshold alone as proof of accessibility. Verify against the canonical UI documents, with at least the applicable 44px minimum and larger primary-action target where required by the approved standard.

Use the real rendered application and existing browser/RTL tools. Capture before/after evidence for representative flows at phone widths 320/360/390/430 CSS px where the tools support them, including long Arabic and relevant states. A no-overflow automated check is not a visual UX acceptance. If no vision-capable review is available, attach the rendered screenshots to the report and mark visual review `UNVERIFIED` rather than claiming it passed. Run relevant accessibility/RTL/UI tests, then the required final checks after the changes.

## 7. Stage D — Manage-specific handoff; no Manage implementation

Produce a clear, owner-readable Manage Online plan from the scan: current verified state; what remains local; which shared foundations already exist; precise target architecture and module/access/storage map; migration path; data-emptiness recheck and safe export/import branch if data exists; identity/account linking (never by email alone); online-only write behavior; backup/restore and recovery gates; privacy/legal questions; cost/free-tier stop conditions; tests; minimum waves; dependencies; acceptance criteria; risks; and rollback boundaries.

This is analysis and planning only. Do not implement Manage Online, create/change PostgreSQL schema or migrations, move Manage data, change Manage storage/domain/services, configure OAuth, modify Cloudflare/Neon, deploy, or create the future Manage branch. Clearly separate `VERIFIED`, `INFERRED`, `UNVERIFIED`, `NOT_EXECUTED`, `DEFERRED`, and `BLOCKER`. The report must not describe Micro as live-connected or production-ready unless independently evidenced.

## 8. Final evidence and stop point

Create one final task report in Arabic:

`docs/expansion/handoffs/zai-micro-manage-readiness-2026-11-14/MANAGE-READINESS-CI-UX-REPORT-2026-11-14.md`

It must link the S13 scan and record: exact repository/branch/base SHA/final SHA; active-work and Control findings; files/commits changed; CI root cause/fix and Actions run; commands, exit codes and counts for targeted/full checks; each UX finding and fix with before/after screenshots or reproducible routes; any issue intentionally not changed and why; the complete Manage migration plan; risks and rollback boundaries; owner decisions still required; and what was explicitly not performed. Add only a concise, linked follow-up note to the existing `EXECUTION-REPORT.md` if repository conventions require it; never rewrite earlier evidence or mark owner acceptance/Control `VERIFIED` on the owner’s behalf.

Then stop and hand the reports to the owner. Do not begin Manage structural refactoring or implementation until the owner has reviewed and accepted the S13 findings and waves. Do not merge, open a PR, modify `main`, create a Manage branch, deploy, access Google Drive, use provider credentials, or perform Cloudflare/Neon account operations. Report progress briefly at meaningful milestones in Arabic; updates are informational and must not pause the authorized CI/UX work.

**Credential boundary:** Never place real credentials, tokens, cookies, connection strings, or secret values in GitHub, prompts, reports, logs, screenshots, commands, or chat. Future provider credentials must be entered by the owner through the secure credential field (`SECURE_SECRET_FIELD`), never pasted into this task.

**NO_CLEANUP:** Preserve existing reports, migrations, provider resources, branches, and worktree state. Do not delete or clean anything; no provider-account writes or Manage Online writes are authorized.
