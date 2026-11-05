# UXR-W01 — Connected Execution Prompt (UXR-01 + UXR-02)

**Status:** Owner-approved five-wave grouping; this file authorizes Wave 01 only after the launch message. It does not authorize later waves or a merge.

## Mission and authority

You are ZAI, the sole product-code implementation writer for Micro Wave 01. Work in `Qays7753/Micro` on the existing branch `uxr/integration-20261105` and existing Draft PR #384 only. Do not create another branch or PR, write to `main`, make the PR ready, merge, rebase, force-push, delete branches, or discard existing work.

The owner accepted UXR-00 and approved this five-wave administrative grouping. The original UXR stages remain intact for traceability; Wave 01 combines only UXR-01 and UXR-02, in that order. The remaining mapping is W02=UXR-03, W03=UXR-04, W04=UXR-05+UXR-06, W05=UXR-07+UXR-08. Do not create claims or execute later waves.

1. **UXR-01:** Home startup/service readiness and genuine failure/retry behavior, per its card and the accepted order.
2. **UXR-02:** Shared shell, navigation, primitives, content patterns, bottom/focus safety, and measured asset/font behavior, within the limits below.

Complete UXR-01, its focused tests and handoff evidence, then proceed directly to UXR-02 without an intermediate owner-approval pause. Commit each substage separately. After the entire wave, stop for Manus’s independent review of one exact candidate SHA and the owner’s acceptance decision. Do not self-accept.

## Cold start and preservation

Before touching files, safely inspect `git status`, `git log`, remotes, `origin/main`, the actual branch/PR head, open PRs, and Operations Control. Fetch first. Preserve all local and remote work; never reset, clean, overwrite, or redo existing changes. Read `AGENTS.md` first and follow its CORE+UI routing; read current state, the thinking charter, document index, pre-build alignment, active claims, the relevant architecture/ADR authority, and only the UXR package sections needed below. Confirm that no active area/contract overlap exists. If DOC-029/WS-245 are absent, create the W01 Item and Workstream in Control before product-code edits, after checking IDs, schemas, dependencies, and overlap; record the owner's UXR-00 acceptance and release DOC-028/WS-244 from their old review action. Do not treat absent records as a reason to pause for owner approval. If the current head differs from the prompt’s publication baseline, use the actual current head and record it; do not assume or restore an old SHA.

Before code, write a concise understanding card in the wave report: user/task, scope and exclusions, exact files/functions/tests, relevant product/data invariants, evidence and unknowns, acceptance criteria, and rollback boundary. Never change `main`.

## Required sources

Use the current versions on the branch, not copies from memory:

- `docs/implementation/micro-product-remediation-20261105/01-PROGRAM-AND-AUTHORITY-AR.md`
- `02-PAGE-CONTRACTS-AR.md`, `03-CONTENT-AND-SOP-AR.md`, `04-WORK-ORDERS-AR.md`, `05-SOURCE-AND-PAGE-COVERAGE-AR.md`, and `06-ACCEPTANCE-AND-EVIDENCE-AR.md`
- `stages/UXR-01-STAGE-CARD-AR.md` and `stages/UXR-02-STAGE-CARD-AR.md`. The old standalone `UXR-01-EXECUTION-PROMPT-AR.md` is superseded and must not be used.
- `docs/operations/current-state.md`, Control records DOC-029/WS-245 and their generated brief, `docs/operations/agent-handoff-protocol-v1.md`, and `docs/operations/agent-development-sop-v1.md`
- The exact relevant UI contracts and current implementation files found through `AGENTS.md`; do not read or change unrelated product areas.

The report sources and design references are supporting material, not authority over live contracts, owner decisions, ADRs, or `AGENTS.md`.

## Scope and acceptance

### UXR-01 — Home startup

Reproduce the cold-start path on an isolated browser profile with synthetic data and no financial writes. Trace service setup, context publication, Home read, first trustworthy content, and first usable action. Investigate the observed memo/service dependency and lazy-import rejection paths; do not assume a single root cause for every reported delay. Fix only the proven Home setup/readiness/failure path. A failure must be distinct from an empty result and expose a real retry/recovery action; stale results after unmount or a newer attempt must be ignored. Avoid eager-loading every service, fake-ready states, artificial delays, duplicate reads, clearing data, financial writes, or raw exception/PII logging.

Acceptance must cover a cold empty and populated launch, service/import rejection, failed read, successful retry, stale-result/unmount behavior, return to the SPA, and the declared offline/update conditions where relevant. Use the same environment and synthetic dataset for before/after timing; report attempts, median/range, and limits. Do not claim device-level readiness without a real device test.

### UXR-02 — shared shell and patterns

Implement only the confirmed UXR-02 findings and surfaces: F-004/F-015 (actual bottom obstruction, scroll ownership, keyboard/focus visibility; measure geometry and fix the proven owner rather than adding blind padding), F-006/F-007/F-008 (shared wording/tone/one clear page destination, with a consumer inventory; do not rewrite unrelated pages assigned to later waves), PERF-008 (measure asset cache behavior on first visit, return, update, and offline after initialization; change asset policy only if evidence requires it), and PERF-011 (measure current Arabic font/fallback use and cost; do not remove a useful fallback without evidence). Preserve current navigation meaning, return context, and all financial/product rules.

### Theme, visual authority, and structural gate

Before any UXR-02 visual change, add a concise “Design Authority and Theme Gate” note to the W01 report: identify the live authority in ADR-009 and the current token source, record the owner's explicit decision to preserve current theme behavior, and list the visual changes that are therefore out of scope. This is a required internal execution artifact, not a request for another owner approval. Preserve ADR-009’s current behavior, including dark mode if present, and preserve current product color/token semantics. Apply phone-first Arabic RTL, accessibility, content hierarchy, and interaction improvements only where compatible with that authority. Do not implement a conflicting Light-only policy; do not add/remove a theme, alter color tokens or typography roles, or redesign the brand. If a direct conflict remains after applying the owner's decision, stop only that conflicting change, report exact evidence, and continue independent safe work.

The post-Group-6 comprehensive read-only structure scan already exists at `docs/architecture/refactoring/s11-structure-scan-20261031/S11-STRUCTURE-ARCHITECTURE-CODE-ORGANIZATION-SCAN-REPORT-2026-10-31.md`. Use it and inspect only directly relevant differences. No broad refactor, file moves, file splitting, architecture reorganization, new design-system project, or S-1..S-5 execution. Any newly necessary structural change requires a specific owner decision before that change; continue independent in-scope work where safe.

## Hard exclusions and invariants

No financial/domain semantics, accounting formulas, operation side effects, data model, `localSchemaVersion`/`localExportVersion`, import/export contract, security policy, business capability, or broad copy redesign. Keep schema/export 41/34 and all 28 accepted legacy pairs plus current pair (29 total) unchanged. Do not alter bundle ceilings, CI/test budgets, or guards; do not suppress failures. No credentials or secrets in prompts, files, commits, logs, URLs, or PR comments.

## Execution cadence and verification

- Provide short Arabic milestone updates in chat, with approximate **Wave 01-only** progress percentages. These are informational and must not pause execution or ask for approval.
- Run focused tests immediately after each substage. At the final Wave 01 candidate, run the relevant complete checks required by `AGENTS.md`/package scripts, including full `pnpm check` once on the final stable tree; do not repeat a full suite without a failure or material change.
- Include UXR-01 startup/retry tests and UXR-02 DOM/accessibility/scroll/focus tests, plus phone-width evidence at the package’s required widths and relevant text scaling. Provide before/after evidence for changed screens/components; report precisely what was not tested.
- Run the repository documentation/Control generators and validators after updating source JSON. Never edit generated views by hand. Finish with `git diff --check`, relevant focused checks, and the full required local gates.
- Run the five sequential read-only reviews only if the active Control/order explicitly requires them; the accepted UXR protocol calls for one independent Manus review after the exact final candidate. Do not add subagents or duplicate review gates.
- Verify GitHub Actions and Cloudflare status only against the exact final PR head. Do not attribute checks to an earlier SHA. Do not merge or mark the Draft PR ready.

## Control, commits, and final delivery

Maintain DOC-029/WS-245 legally: update Item/Workstream source JSON, then regenerate views and validate. UXR-01 and UXR-02 must have separate commits and clear result evidence; the wave is not complete if either substage is missing. Do not create claims for W02–W05.

At Wave 01 completion, update the live current state and append-only log, wave tracker, reports, and DOC-029/WS-245 with exact base/candidate SHAs, commit list, changed files, findings and root causes, test commands/results, before/after evidence, theme/structure decisions, schema/export impact (expected none), rollback boundary, and the next permitted step. Keep PR #384 Draft. Deliver the exact final head, PR URL, checks’ actual state, and a concise resume note. Then stop for Manus review and the owner’s decision; do not start W02.

## Stop conditions

Stop and report the exact blocking evidence if a financial or data contract conflict appears, a security boundary would change, a required runtime/asset is missing, a necessary theme decision falls outside the owner’s explicit preservation instruction, or a relevant required check cannot be root-fixed without scope expansion. Do not stop for a routine documentation omission or ask for approval between UXR-01 and UXR-02.
