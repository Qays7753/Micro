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

Implement confirmed non-structural UX improvements on the existing branch, preferably in cohesive, reversible commits. Maintain server-side authorization and all financial/business behavior. For Web, distinguish WCAG 2.2 AA’s 24 × 24 CSS-pixel target-size criterion and its exceptions from larger comfort targets. Use the current Micro comfort target of at least 44 × 44 CSS px for touch controls and 48 × 48 CSS px for primary actions only as a **Micro product target**, not as a universal or WCAG-mandated threshold. Apple point values and Android dp values are native-platform guidance; never equate them directly with CSS pixels. Do not treat the prior 32px automated threshold alone as proof of accessibility.

Use the real rendered application and existing browser/RTL tools. Capture before/after evidence for representative flows at phone widths 320/360/390/430 CSS px where the tools support them, including long Arabic and relevant states. A no-overflow automated check is not a visual UX acceptance. If no vision-capable review is available, attach the rendered screenshots to the report and mark visual review `UNVERIFIED` rather than claiming it passed. Run relevant accessibility/RTL/UI tests, then the required final checks after the changes.

### UX KPI framework — required for every page and component

Build the inventory from the actual application routes and component code, not a shortlist. Include every production page/route by role and Workspace context, and every reusable component, variant, and meaningful interactive state. Target **100% inventory coverage**. A sample screenshot set may support visual proof, but it does not replace full page/component KPI rows.

Score each criterion `0 = fail`, `1 = partial`, `2 = pass`, `N/A = not applicable with a written reason`; use `NOT_MEASURED` for outcomes that require real users or unavailable assistive technology. This is an internal audit rubric, not a standard-issued score. Never use an average score to hide a failed accessibility, security, authorization, data-integrity, or financial-truth gate. For every row record the role/context, user need/task, criterion and source class, metric and threshold, actual result, test method/environment, evidence link or screenshot, score, severity, and fix/status. Use explicit denominator and numerator for rates.

Use these severity bands as Micro prioritization, not as a universal industry scale: `P0` = privacy/security exposure, unauthorized financial access/action, data loss, duplicate/false financial save, or materially false consequential status; `P1` = core task blocked, unsafe, inaccessible on the critical path, or impossible to recover; `P2` = material confusion, repeated effort, or a reliable workaround; `P3` = minor visual/copy polish. Do not mark the phase UX-ready with an unresolved P0/P1 in an in-scope critical flow; identify any blocked fix and its required owner decision.

| KPI dimension | Page-level measure | Component-level measure | Verification and Micro target |
|---|---|---|---|
| Coverage and purpose | Each route has an identified role, Workspace, user need, primary task, entry, exit, and applicable states. | Each component/variant has one stated purpose, context, and intended action/output. | 100% inventory rows have evidence and a result; explain every N/A. |
| Information priority and sequence | Order value/status, decision-critical information, required input, and next action according to the task; do not bury information needed before a consequential action. | Label, value, state, hint, and action appear in an order that supports recognition before reading. | Every page has a content map and a reason for sequence; critical information is available before confirmation. No arbitrary universal word or line cap. |
| Action clarity | Each task context has one dominant primary action, or a documented reason for a different hierarchy; read-only pages may have no primary action. | Every actionable control has an unambiguous visible or accessible name and a distinct primary/secondary/destructive treatment. | 100% of actions are identified and tested; prefer verb + object and state the consequence where ambiguity or risk exists. For frequent tasks, target primary action visibility in the initial 360 × 800 CSS-pixel view unless necessary decision content or the task sequence justifies otherwise. |
| Content and note preservation | Every user-facing text block is classified as `act now`, `decision-critical`, `supporting note`, `reference/detail`, or `internal/test`. | Labels, hints, helper text, and error copy each have a clear purpose and do not duplicate one another. | 100% of existing useful notes are traced and retained in the right hierarchy; move secondary detail to progressive disclosure when appropriate. Delete only confirmed internal/test/duplicate content with source evidence. Zero raw implementation IDs/enums or test-only copy in normal customer-facing states. |
| States, feedback, and recovery | Critical task flows define initial, pending/loading, success, failure, denied, and network/server-failure states where applicable. | Each applicable component state (focus, pressed, disabled, loading, selected, error, success) is rendered and announced appropriately. | 100% of critical async actions have truthful pending/result/failure feedback, a next step, and retry/cancel recovery where applicable; preserve user input on validation failure. Zero false “saved” states. |
| Accessibility | Each route is evaluated for keyboard access, focus, reflow, text/background contrast, labels, errors, and status messages. | Every interactive component has an accessible name, keyboard/focus behavior, correct semantics, and non-color state cues where applicable. | Record criterion-level WCAG results and exceptions; do not claim full conformance from a partial checklist. See the scoped WCAG thresholds below. |
| Arabic RTL and responsive behavior | Check reading/order, numeric and Latin isolation, navigation/back behavior, long Arabic, zoom/text scaling, and supported widths. | Check hit area, icon direction, focus/reading order, wrapping, clipping, contrast, and touch/keyboard operation. | 0 unintended clipping, overlap, inaccessible action, or horizontal scroll on supported phone widths 320/360/390/430 CSS px, except genuinely two-dimensional content. Record exact viewport, state, locale, and zoom. |
| Navigation, roles, and trust | Every route has a valid entry/return path and only the right role/Workspace sees its destinations. | Back, cancel, close, and submit controls return to a truthful and predictable state. | 0 dead ends or role-leaking entry points; verify the server/API denies unauthorized access—hiding a menu alone is not a pass. |
| Human service outcomes | Define task start/completion, errors, retries, time-on-task, and satisfaction for each critical user journey. | Observe task-level confusion/error around the component in context, not as an isolated visual score. | Use real representative participants to measure outcomes. Report numerator, denominator, sample, role, device, and period. Do not invent a universal completion-rate or satisfaction target; if no participants were tested, mark `NOT_MEASURED` and provide a short pilot test script. |

For every page, attach a content-disposition map so notes are not silently removed: preserve original note/meaning, category, location before/after, rationale, and test/evidence. Essential safety, price, status, consent, financial, or recovery information must remain visible at the point it is needed; secondary explanation may move to a concise hint or details disclosure. GOV.UK’s short-hint pattern is a platform recommendation, not a universal Arabic word limit. There is no global “right number of words” for a page: assess relevance, repetition, hierarchy, visible lines before the primary decision, and observed comprehension.

Apply these exact evidence distinctions for Web:

- **Normative Web checks:** WCAG 2.2 AA SC 2.5.8 uses a 24 × 24 CSS-pixel minimum pointer target subject to its listed exceptions, including a defined spacing test; this is a conformance floor, not a comfort guarantee. SC 1.4.10 reflow covers 320 CSS px width for vertical content and 256 CSS px height for horizontal content, subject to scope/exceptions. SC 1.4.3 requires 4.5:1 for ordinary text and 3:1 for large text, subject to exceptions. SC 2.4.7 requires visible keyboard focus but does not set the AAA numeric geometry. Check SC 3.3.2 labels/instructions, 3.3.1 textual error identification, and 4.1.3 programmatic status messages where applicable.
- **Separate AAA check:** WCAG 2.2 SC 2.4.13 Focus Appearance is Level AAA; its 2 CSS-pixel-perimeter-equivalent and 3:1 focused/unfocused contrast must not be misreported as the AA SC 2.4.7 threshold.
- **Platform guidance:** Android’s 48 dp and Apple’s 44 pt control guidance, and Material’s navigation/breakpoint patterns, apply in their respective platform systems. They are useful comparative references, not universal Web CSS requirements. If a platform-specific rule is used, name the platform and unit.
- **Heuristics and service measures:** Nielsen Norman heuristics guide expert review, and GOV.UK completion-rate guidance defines a service-measurement method. Neither supplies a universal pass score or Micro task-success target. State each local Micro target separately and justify its numerator, denominator, user/task, and consequence.

Use the source register below (all opened and checked on 2026-11-14); cite the criterion/source beside each KPI, and re-verify only if a source has materially changed:

- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/), including [Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), [Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html), [Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html), [Labels or Instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html), [Error Identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html), and [Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html).
- [Android accessibility guidance](https://developer.android.com/guide/topics/ui/accessibility/apps) and [Material Design navigation bar](https://m3.material.io/components/navigation-bar/overview), [adaptive design](https://m3.material.io/foundations/layout/layout-overview/adaptive-design), and [structure and touch targets](https://m3.material.io/foundations/designing/structure).
- [Apple HIG Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility), [Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons), [Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars), and [Layout](https://developer.apple.com/design/human-interface-guidelines/layout).
- [GOV.UK user needs](https://www.gov.uk/guidance/content-design/user-needs), [content design](https://www.gov.uk/guidance/content-design/what-is-content-design), [text input](https://design-system.service.gov.uk/components/text-input/), [validation and error recovery](https://design-system.service.gov.uk/patterns/validation/), and [completion-rate measurement](https://www.gov.uk/service-manual/measuring-success/measuring-completion-rate).
- [Nielsen Norman Group usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) and [heuristic evaluation method](https://www.nngroup.com/articles/how-to-conduct-a-heuristic-evaluation/). Its 3–5 evaluator suggestion is a review-process recommendation, not a Micro pass threshold.

If Z AI confirms its parallel sub-agent feature is available, use five **read-only** UX reviewers on the same final candidate SHA: (1) user tasks/information hierarchy/action priority, (2) Arabic content and note preservation, (3) WCAG/accessibility/keyboard/RTL, (4) component states/error/recovery, and (5) responsive visual review/role-scoped navigation. One integrator owns all writes; no parallel writers or overlapping edits. If sub-agents are unavailable, perform the same five-lens review in sequence and state that no sub-agents were used. Do not create extra open-ended task checklists.

## 7. Stage D — Manage-specific handoff; no Manage implementation

Produce a clear, owner-readable Manage Online plan from the scan: current verified state; what remains local; which shared foundations already exist; precise target architecture and module/access/storage map; migration path; data-emptiness recheck and safe export/import branch if data exists; identity/account linking (never by email alone); online-only write behavior; backup/restore and recovery gates; privacy/legal questions; cost/free-tier stop conditions; tests; minimum waves; dependencies; acceptance criteria; risks; and rollback boundaries.

This is analysis and planning only. Do not implement Manage Online, create/change PostgreSQL schema or migrations, move Manage data, change Manage storage/domain/services, configure OAuth, modify Cloudflare/Neon, deploy, or create the future Manage branch. Clearly separate `VERIFIED`, `INFERRED`, `UNVERIFIED`, `NOT_EXECUTED`, `DEFERRED`, and `BLOCKER`. The report must not describe Micro as live-connected or production-ready unless independently evidenced.

## 8. Final evidence and stop point

Create one final task report in Arabic:

`docs/expansion/handoffs/zai-micro-manage-readiness-2026-11-14/MANAGE-READINESS-CI-UX-REPORT-2026-11-14.md`

It must link the S13 scan and record: exact repository/branch/base SHA/final SHA; active-work and Control findings; files/commits changed; CI root cause/fix and Actions run; commands, exit codes and counts for targeted/full checks; the complete per-page/per-component UX KPI matrix with source class, threshold, actual result, evidence and score; each UX finding and fix with before/after screenshots or reproducible routes; content/notes preserved or repositioned and rationale; any issue intentionally not changed and why; human outcomes marked `NOT_MEASURED` unless real participants were tested; the complete Manage migration plan; risks and rollback boundaries; owner decisions still required; and what was explicitly not performed. Add only a concise, linked follow-up note to the existing `EXECUTION-REPORT.md` if repository conventions require it; never rewrite earlier evidence or mark owner acceptance/Control `VERIFIED` on the owner’s behalf.

Then stop and hand the reports to the owner. Do not begin Manage structural refactoring or implementation until the owner has reviewed and accepted the S13 findings and waves. Do not merge, open a PR, modify `main`, create a Manage branch, deploy, access Google Drive, use provider credentials, or perform Cloudflare/Neon account operations. Report progress briefly at meaningful milestones in Arabic; updates are informational and must not pause the authorized CI/UX work.

**Credential boundary:** Never place real credentials, tokens, cookies, connection strings, or secret values in GitHub, prompts, reports, logs, screenshots, commands, or chat. Future provider credentials must be entered by the owner through the secure credential field (`SECURE_SECRET_FIELD`), never pasted into this task.

**NO_CLEANUP:** Preserve existing reports, migrations, provider resources, branches, and worktree state. Do not delete or clean anything; no provider-account writes or Manage Online writes are authorized.
