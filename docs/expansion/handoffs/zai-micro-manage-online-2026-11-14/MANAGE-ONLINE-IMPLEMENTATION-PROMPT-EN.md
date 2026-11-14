# Z AI — Approved UX Follow-ups + Micro Manage Online Implementation

**Status:** Owner-authorized repository execution, 2026-11-14. This prompt supersedes the completed readiness prompt only for the follow-ups and Manage implementation explicitly listed below.

**Repository:** `Qays7753/Micro`
**Market/Delivery branch:** `zai/micro-market-delivery-handoff-20261111`
**Manage implementation branch:** `zai/micro-manage-online-20261114` (create from the finalized Market/Delivery branch head; never branch from or write to `main`).
**Last observed source head:** `c5d68215b6c8dca2a5d96eaf2b59c26515603791` (hint only; verify live).
**Owner decision:** The owner accepted S13 and the recommendations on 2026-11-14, except dark-mode work: the owner confirms Micro has no dark mode. The work below is authorized to proceed continuously within the stated boundaries.

## 1. Mission and execution boundary

Complete only the owner-approved, still-open Market/Delivery UX follow-ups on the existing branch, then implement the Manage Online repository work on the dedicated Manage branch using S13 waves M1–M6. Preserve completed work and reuse valid evidence; do not repeat completed CI, UX fixes, or the S13 scan.

Continue automatically through the approved repository-only stages without asking for routine approvals. A progress report is not owner acceptance. This authorization does **not** permit a production deployment, applying a migration to Neon, changing Cloudflare/Neon settings, transferring real data, merging, opening a PR, or modifying `main`.

## 2. Live-state preflight — mandatory

Before writing:

1. Verify the repository, authorized source branch, full remote SHA, `main` SHA/merge-base, worktree and untracked/stashed changes, active Z AI process/writer, open PRs, GitHub Actions, and Operations Control claim. Inspect the actual workspace before resuming; do not start duplicate work.
2. Preserve all work. If the branch moved, a writer is active, a required state is unclear, or there is material drift, report `STATE_DRIFT` with evidence and stop before writing. Never reset, clean, rebase, force-push, rewrite history, or overwrite another writer.
3. Reuse the existing full CI result only if its tested code tree is unchanged: workflow run `43544701361` succeeded on code SHA `4365019a963bdebef42fee0e17e8652626296179`; `c5d68215b6c8dca2a5d96eaf2b59c26515603791` is the subsequent documentation-only evidence commit. Verify this against live GitHub first. Do not rerun tests just to repeat unchanged evidence.
4. Resolve DOC-038/WS-249 through legal Operations Control transitions after recording the owner's acceptance. Create the next valid Control item/workstream for this execution before code; inspect IDs and status sources first, update JSON sources only, and regenerate generated views using repository tools.

## 3. Authoritative sources

Read `AGENTS.md`, `docs/operations/current-state.md`, and the current versions of:

- `docs/architecture/refactoring/s13-manage-online-readiness-20261114/S13-MANAGE-STRUCTURE-ARCHITECTURE-CODE-ORGANIZATION-SCAN-REPORT-2026-11-14.md`
- `docs/expansion/handoffs/zai-micro-manage-readiness-2026-11-14/MANAGE-READINESS-CI-UX-PROMPT-EN.md`
- `docs/expansion/handoffs/zai-micro-manage-readiness-2026-11-14/MANAGE-READINESS-CI-UX-REPORT-2026-11-14.md`
- `docs/expansion/handoffs/zai-micro-manage-readiness-2026-11-14/evidence/UX-KPI-MATRIX-2026-11-14.md`
- `docs/expansion/MANAGE-NETWORK-MIGRATION-EXPORT-GATE.md`, contracts 04, 18, 23, and 25, the role/access matrix, financial P0 policies, and the existing Market/Delivery execution report.

S13 was reviewed and accepted by the owner. Do not repeat the scan. Its accepted classifications and target map govern this work.

## 4. Binding owner decisions

- Micro is one responsive Web app with one Google sign-in/account/session and Workspace-scoped access. Keep the common product entry points for authenticated users: Manage, Market, Delivery, and Ask Micro. Access to a module never grants access to another Workspace or role's data.
- Manage is for the single Workspace owner only. Platform Admin, driver, supplier, and other members have no Manage financial access. Keep the driver context limited to Delivery and Ask Micro; switching to another authorized role must remain explicit.
- Use the existing shared PostgreSQL target (Neon Free through Hyperdrive) as the eventual source of truth. Do not use D1 for production Manage, Market, or Delivery. No paid plan, service, or overage is authorized; preserve the $0 target.
- Google identity does not automatically prove ownership of local Manage data. Never link by matching email alone; require the approved proof/confirmation flow in the migration gate.
- The owner uses one regular device for Manage. Financial writes are online-only after migration: no offline financial writes, sync queue, or last-write-wins. Display “saved” only after server confirmation. Account recovery from another device is not a multi-device sync feature.
- Preserve local Manage data contracts and export/recovery: schema/export `41/34`, accepted legacy import pairs, local stores, snapshots, and all financial/domain semantics. Do not delete or silently rewrite the local database.
- Use synthetic data only. The owner reports there are currently no users or business records; recheck at the actual migration gate. No real partner or financial data may be introduced until retention/deletion, export, privacy, and recovery requirements are explicitly resolved.
- Ask Micro remains present in every authorized context, read-only and permission-scoped. No provider is approved; keep its unconfigured state truthful. It must not write financial or operational records.
- Do not inspect, copy, or import from the owner's separate UI-components repository or Google Drive.

## 5. Workstream A — approved follow-ups on the existing branch

First verify each item is still open at the live head; skip already-fixed items and record why. Keep changes narrow and non-structural.

1. **NAV-001 / R1-15 — guest navigation:** Hide owner-only Finance and Orders destinations from unauthenticated guests. Do not remove common product entry points from authenticated Micro users or alter the driver's restricted context. Verify server/API denial as well as navigation visibility; hiding a tab alone is not authorization.
2. **R1-17 — delivery booking overview:** Ensure a driver can see the minimum decision-critical booking details before accepting an offer, including route and timing and any assigned-driver/status detail that is applicable. Add only fields needed by the existing flow. Enforce server-side recipient/assignment authorization; never expose unrelated drivers' identities, private data, or owner-only data. Add positive and negative tests. Do not create financial side effects.
3. **UX evidence/KPI matrix:** Keep the 73-page + 71-component inventory. Replace generic repeated descriptions with specific page/component purpose and task. For each row record applicable criterion and source class, metric/threshold, observed result, method/environment, evidence, score, severity, status, and a justified `N/A` where appropriate. Preserve useful notes using a content-disposition map; do not remove content silently. Report human-participant outcomes as `NOT_MEASURED` and visual review as `UNVERIFIED` if not actually performed.
   - Measure Web target sizes separately: WCAG 2.2 AA SC 2.5.8 minimum 24×24 CSS px and its exceptions versus Micro comfort goals of 44×44 px touch controls and 48×48 px primary actions. The existing “no target below 32px” result does not prove either target. Record exceptions and exact viewport; fix only verified, in-scope failures without broad design-token changes.
   - Capture before/after for the two changed flows at supported 320/360/390/430 CSS-pixel widths where applicable. Do not create a screenshot for every row or repeat the full visual audit.
4. **R3-2 dark mode:** The owner confirms there is no user-facing dark mode. Mark this item `NOT_APPLICABLE` with that owner decision. Do not add dark mode or change tokens/colors to address it. Continue to preserve contrast in the actual supported appearance.
5. **Baseline test typing issue:** Inspect the reported `worker/tests/auth.session.test.ts` `Uint8Array`/`BodyInit` error. If it remains and a minimal test-only typing correction preserves runtime behavior, fix it with a focused test/type check. Otherwise document the exact toolchain/error and leave it explicitly unresolved; do not expand into unrelated cleanup.

Keep other deferred findings deferred unless already resolved by a prior accepted decision. In particular, do not change OD01/R5-9 role-switch behavior, R5-2 financial-page no-project prompts, or unrelated P2/P3 items in this workstream.

Run focused regression tests for changed paths. After this coherent code wave, run the required repository gate and obtain CI on its exact final SHA. Do not repeat previously green checks on an unchanged tree. Update the execution evidence and Control records.

## 6. Workstream B — Manage Online on the dedicated branch

After Workstream A is complete and reported, create or resume `zai/micro-manage-online-20261114` from the verified final SHA of the Market/Delivery branch. If that branch already exists, inspect and preserve it; never overwrite it. Keep all Manage implementation commits on this branch, separate from the Market/Delivery branch and `main`.

Implement S13 M1–M6 in dependency order. The owner's accepted decisions authorize continuous repository implementation through the code/test phases; report each wave and continue without a routine approval pause. Each wave must remain independently reviewable and reversible. No generic `features/` layer, mass file moves, splitting oversized files, or unrelated structural refactor. Preserve M-P1…M-P6. M-O1…M-O4 remain prohibited.

- **M1 — contracts and scenarios:** Record the binding decisions above in the canonical contracts/decision sources and add Manage Online scenarios/acceptance criteria. Do not invent legal retention periods or claim a production backup policy. Record that real-data use remains blocked until those requirements are explicitly resolved.
- **M2 — server foundation:** Implement the Manage capability and one-owner-per-Workspace enforcement, verified identity-link flow, and server-side `requireManageOwner`/equivalent gate using existing Worker/PostgreSQL patterns. Add negative tests for guests, unlinked identities, email-only matches, other roles, Platform Admin, and cross-Workspace access. Keep Manage capability disabled by default until the operator applies and verifies the schema; do not change local schema/export versions or local stores.
- **M3 — reads:** Add owner-scoped Manage read APIs and connect the existing screens through the smallest compatible application boundary. The Worker is the authorization boundary; the browser must not connect directly to PostgreSQL. Preserve truthful states when not linked, not configured, or unavailable. Do not enable Manage against the shared preview database before its schema is applied and verified by the operator.
- **M4 — writes:** Add transactional, idempotent, owner-only server writes. Reuse the existing idempotency/conflict conventions. Reject writes while offline or when the server fails; show success only after server acknowledgement. Prove retries/concurrency do not duplicate financial effects. Preserve every approved financial invariant and exact money representation.
- **M5 — migration implementation, not live data transfer:** Build and test an export-to-PostgreSQL migration path with validation, counts, exact-value checks, checksums, idempotent recovery, and rollback using synthetic fixtures. Preserve the local export as the recovery source. Do not read or mutate the owner's browser/IndexedDB data, assume the data-empty state remains true, or execute a migration against Neon.
- **M6 — online-only cutover code, not operational cutover:** Implement the guarded online-only mode and retain local export/recovery. Do not activate it for a real Workspace, disable the owner's current local writing, transfer actual data, or claim cutover complete. Those actions require a later exact owner/Manus operator gate after final migration and recovery review.

Use only local/ephemeral PostgreSQL in tests/CI with synthetic data. Repository PostgreSQL migration files and test fixtures are allowed; applying them to the shared Neon project/branch is not.

## 7. Tests, CI, and change control

- Follow `AGENTS.md`: add regression tests with each code change; after each code wave, run the smallest relevant local suites and the required full CI gate once on that wave's candidate. Do not rerun a green check on the same SHA. Tie every result to its exact SHA and workflow URL.
- Use the existing PostgreSQL service-container test path; no remote database or credentials are needed for this work.
- One writer/integrator only. No parallel writers. Update source Operations Control JSON through valid transitions and regenerate derived views with the documented scripts.
- **No-write to external providers:** no Cloudflare/Neon API calls or changes, bindings, resource/schema changes, live migrations, secrets, deployments, or provider costs. Z AI needs no provider credentials. If any credential is ever explicitly required for a later operator action, use the platform's secure credential field only; never paste tokens, passwords, cookies, or connection strings into this prompt, chat, repository, or logs.
- No PR creation, merge, branch deletion, or `main` changes. Do not manually deploy. A normal push may create only the already-configured, nonproduction `micro-prototype` Pages preview, and only if it is confirmed to be preview-only, free, and uses synthetic data with Manage disabled by default. If a push could deploy production, change provider settings, apply a schema, expose real data, or incur a charge, stop before pushing and report why.

## 8. Stop conditions and final handoff

Stop before the specific blocked action and report it if the implementation requires an unapproved financial/domain or privacy decision, a structural refactor outside the accepted map, real-data retention/deletion policy, actual Neon/Cloudflare write, real-data transfer, production deployment, or material state drift. Continue independent approved repository work where safe.

Publish one Arabic final report under this handoff directory and update the existing execution report with a concise link/summary. Include verified source/base/final SHAs for both branches; commits/files; each wave's acceptance evidence; tests and CI URLs; financial/schema/export/auth/privacy impact; what was intentionally not executed; blockers; rollback boundaries; and operator steps for Manus. Label claims `VERIFIED`, `INFERRED`, `UNVERIFIED`, `NOT_EXECUTED`, `DEFERRED`, or `BLOCKER` as appropriate. Do not call the app live, production-ready, or migrated until those facts are independently verified.

**Hard stop:** leave both branches unmerged and stop after the repository implementation/evidence handoff. Do not clean up branches or files. `NO_CLEANUP`.
