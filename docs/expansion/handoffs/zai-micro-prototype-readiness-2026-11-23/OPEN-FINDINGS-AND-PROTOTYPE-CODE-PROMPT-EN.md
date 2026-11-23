# Z AI — Micro Open Security Findings and Prototype Code Remediation

**Owner-authorized task.** Continue on the existing branch `manus/zai-prompt-open-findings-20261123`; do not create another branch. The owner authorized pushing this branch and accepts that an ordinary push may trigger an automatic Cloudflare Pages preview. This is not permission for a manual deployment/retry, production promotion, settings changes, PR creation, merge, branch deletion, or real-data use.

## Mission

Fix the eight currently open code-level security findings listed below and any other clear, directly related code defects found in those journeys. Preserve completed work, avoid repeating verified work, and provide a complete Arabic report. The owner's goal remains a private partner prototype using real people and real operational data eventually; synthetic data is for automated tests only. This code task itself does not authorize live service access or real-data operations.

## Before coding

1. Read the mandatory CORE sources in `AGENTS.md` §2, `docs/operations/current-state.md`, `docs/operations/control/generated/AGENT-BRIEF.md`, `docs/operations/control/generated/ACTIVE-WORK.md`, `docs/operations/control/README.md`, and this prompt.
2. Read `docs/expansion/security-findings-status.md`, relevant owner decisions/contracts, and the source-pinned audit (`Micro — تقرير التدقيق الأمني 2026-11-19.md`) if available. The private audit may not be available in the Z AI workspace; if so, use the safe repository mirror plus the findings below and say so in the report.
3. Verify the live `origin/main` SHA, this exact branch and its remote head, worktree changes/stashes, open PRs, and `WS-254`/`DOC-044`. The recorded starting point `main@5a9064e657a40041ebe63c8f107d57a802f6b93f` is only a hint. Preserve all existing work. Never reset, clean, force-push, rewrite history, or change `main`.
4. Continue under the existing `WS-254`/`DOC-044` claim. Do not open a second branch or parallel writer. If state differs materially, preserve it, report `STATE_DRIFT`, and continue only with independent work that remains safe.

## Security baseline and work

The direct review at `74d74cbedf63d6f3ae07b8ca26a229b07cdfaec4` recorded 22 `fixed-verified` and 8 `open`. The later PR #385/#387 changes were documentation/operations-only; verify relevant code paths before carrying evidence forward. Keep all 30 findings visible on the final candidate. Recheck every affected finding on the final SHA; for unchanged findings, carry forward prior direct evidence only with evidence that the relevant paths did not change. CI alone never closes a finding.

Fix the root causes for these eight open findings where a safe, contract-supported code fix exists:

- `MNG-LOCAL-02`: fail closed when Manage mode is unknown or cannot be freshly read; prevent sensitive local writes in that state.
- `MNG-LOCAL-03`: **deferred by the owner**. Keep its status `deferred-by-owner`; the technical exposure remains open. Do not implement encryption, key creation/recovery, or a new storage/export format, and do not treat the future real-data trial goal as a change to this decision.
- `MNG-LOCAL-04`: state and enforce the actual checksum guarantee; never describe an embedded checksum as proof of authenticity.
- `AUTHZ-04`: require the correct active owner role and explicit workspace context when creating a delivery request.
- `AUTHZ-05`: enforce membership role/status, module, and explicit workspace authorization server-side; no implicit first-workspace fallback.
- `SRV-02`: enforce request-body byte limits before full buffering/parsing, including media routes.
- `MNG-LOCAL-05`: replace raw exception text in import flows with safe user-facing errors.
- `MNG-LOCAL-06`: apply defensible import count/depth/resource limits and test boundaries; do not claim weakest-device performance without device evidence.

Also implement only missing code required by already-recorded owner decisions for the affected prototype journeys, including Ask Micro where directly in scope. Do not configure or call an AI provider, use credentials, or create paid fallbacks. Fix other concrete defects only when the fix is clear and does not change financial meaning or require a new owner policy. Record unresolved findings and continue independent work.

## Boundaries

- No structural refactoring, bulk moves, new architecture layer, or code-organization changes. If a fix appears to require structural work, leave it for owner review; do not bypass the Post-Group-6 scan/owner-review gate.
- No financial-semantic changes, unapproved schema/export-version changes, live migrations, database/R2/API writes, real-data access, provider calls, or secrets in files/chat/logs.
- The owner's current authorization supersedes older `[CF-Pages-Skip]` instructions **for this branch only**: do not use that prefix or change Cloudflare settings. Ordinary pushes to this branch may create an automatic Pages preview; report its URL, deployment ID, and source SHA if it appears. Do not manually deploy or test against preview bindings/data. Production was last documented without DB/MEDIA bindings, with `/api/*` returning `503`; a preview is not proof of connected services or release readiness.
- Do not create a PR, merge, delete branches, or modify settings. Do not claim the code is ready for real data or a public launch.

## Execution and verification

Work in small, focused fixes. Add a regression test for each implemented fix; run relevant focused tests/guards after changes and one final repository gate on the exact final code SHA. Do not rerun successful suites on an unchanged tree. If a check fails, diagnose and fix the root cause, then rerun the affected check. Keep progress updates brief and in Arabic; they are informational and must not pause work.

Before handoff, update the safe security-status mirror and `DOC-044`/`WS-254` with evidence. Write the complete Arabic report to `docs/expansion/handoffs/zai-micro-prototype-readiness-2026-11-23/EXECUTION-REPORT-AR.md` and index it as the next available 12-series entry. The report must include:

- repository, branch, base and final full SHAs; changed files and commits;
- one row for each of the 30 security findings, with exactly one status (`open`, `fixed-verified`, `deferred-by-owner`, or `not-applicable`), current-SHA evidence, tests, and residual risk; keep `MNG-LOCAL-03` deferred-by-owner and technically open;
- each additional finding and its fix/disposition; actual test commands/results and exact SHA;
- financial, privacy, schema/export, and structural impact (or evidence-backed “none”);
- Actions and any automatic Pages preview status tied to its source SHA;
- what was not done, limitations, rollback boundary, and remaining Manus/owner actions before any real-data or connected-service trial.

Commit and push the completed work to this same branch with ordinary commits. Stop after the report and handoff; no PR, merge, manual deployment, live service/data access, or cleanup.
