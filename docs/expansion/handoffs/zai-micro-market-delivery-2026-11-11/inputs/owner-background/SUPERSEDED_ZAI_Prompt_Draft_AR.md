# مسودة التوجيه الحاكم لـZ AI 5.3 — Micro Market وMicro Delivery

**هذه مسودة محلية وليست النسخة المنشورة في GitHub.** قبل استخدامها يجب فحص مستودع Micro الحي، تعليمات `AGENTS.md` ومسار التوثيق المعتمد، ثم حفظ النص الكامل في الموضع الحاكم الذي يقره المستودع. بعد ذلك فقط تُرسل رسالة التشغيل القصيرة في نهاية هذا الملف.

كل ما داخل كتلة **MASTER PROMPT** ورسالة التشغيل مكتوب بالإنجليزية. يكتب Manus مواصفة UX بالعربية ويعتمدها المالك قبل وصول Z AI إلى تنفيذ الواجهات. تقارير Z AI الموجهة للمالك تكون بالعربية، مع إبقاء أسماء الملفات والأوامر والحالات التقنية بلغتها الأصلية.

## الحقول التي يجب أن تصبح معلومة قبل تشغيل المرحلة المناسبة

- `{{MICRO_REPOSITORY_URL}}`: رابط مستودع Micro الفعلي.
- `{{DOC_REPOSITORY_URL}}`: المستودع الذي يحتوي التوثيق السلطوي، أو نفس رابط مستودع Micro إن كان هو نفسه.
- `{{BASE_BRANCH}}`: الفرع الأساسي كما يثبته المستودع؛ لا تفترض `main` دون فحص.
- `{{RUN_STAGE}}`: رقم واحد فقط: `1`, `2`, `3`, أو `4`.
- `{{UNIFIED_REPORT_PATH}}`: مسار تقرير المتابعة الواحد. لا يملأ قبل أن يكتشفه Stage 1 من تعليمات المستودع وفهرس الوثائق ويتحقق منه المالك. لا تنشئ مسارًا ثانيًا.
- `{{OWNER_ACCEPTED_STAGE_1_FINDINGS}}`: أرقام Finding IDs المقبولة من المالك للتخطيط؛ لا تستنتج القبول من الصمت.
- `{{OWNER_APPROVED_PRODUCT_DECISIONS}}`: نسخة القرارات D01–D19 بعد إجابات المالك، أو مصدر سلطوي محدد يثبتها.
- `{{OWNER_APPROVED_UX_SPEC}}`: رابط/مسار وإصدار مواصفة السيناريوهات ورحلات المستخدم وخريطة الشاشات وعقودها ومصفوفة الصلاحيات والحالات والحركة التي أعدها Manus واعتمدها المالك.
- `{{OWNER_APPROVED_CODE_BLUEPRINT}}`: إصدار خريطة التنفيذ التقنية التي وافق عليها المالك، وتربط المتطلبات بملفات الكود والاختبارات والموجات.
- `{{FEATURE_BRANCH}}`: فرع واحد طويل العمر، المتوقع `feat/micro-market-delivery` إذا لم يمنع اصطلاح المستودع.
- `{{GITHUB_CREDENTIAL}}`: يضاف في حقل الأسرار الآمن فقط وبأقل صلاحية. لا يكتب أبدًا داخل prompt أو log أو report.
- `{{PR_URL_AND_FULL_SHA}}`: رابط PR والـSHA الكامل للمرحلة 4.
- `{{MASTER_PROMPT_PATH}}`: المسار الدقيق لهذا التوجيه بعد اعتماده وحفظه في المستودع.

إذا لم يتوفر أي حقل مطلوب لمرحلة معينة، لا تخترع قيمة؛ أوقف تلك المرحلة وحدد ما ينقص بدقة.

## MASTER PROMPT — النص الكامل الذي يوضع في المستودع المعتمد

```text
# Z AI 5.3 — Micro Market + Micro Delivery Master Execution Contract

## 0. CONTROLLING RULES

This is one multi-stage execution contract. Execute only the single stage named by RUN_STAGE in the current launcher. Never advance to another stage, wave, PR action, provider setup, or release step unless the exact gate below is satisfied and the owner has explicitly authorized that stage.

Z AI's authorized scope is the Micro source repository, code inspection, code implementation, repository tests, CI evidence, and repository-side technical reports on an authorized branch. Z AI must not design product UX, invent product policy, access Cloudflare or any provider account/API, obtain provider credentials, change live infrastructure, merge, deploy, or publish to production.

The owner-facing plan and reports must be in Arabic. Keep file paths, identifiers, command lines, enum values, and raw test output unchanged. Send a short Arabic progress update at meaningful checkpoints. Do not claim percentages or success without evidence.

## RUN CONTEXT — SUPPLY VALUES IN THE LAUNCHER OR SECURE RUN INPUTS

- Micro repository URL: {{MICRO_REPOSITORY_URL}}
- Documentation repository URL: {{DOC_REPOSITORY_URL}}
- Verified base branch: {{BASE_BRANCH}}
- Current run stage: {{RUN_STAGE}} — exactly one of 1, 2, 3, or 4.
- Canonical unified report path, after Stage 1 discovery and owner approval: {{UNIFIED_REPORT_PATH}}
- Owner-accepted Stage 1 finding IDs, when Stage 2 or 3 is requested: {{OWNER_ACCEPTED_STAGE_1_FINDINGS}}
- Owner-approved product decisions D01-D19: {{OWNER_APPROVED_PRODUCT_DECISIONS}}
- Owner-approved UX specification, version and source link: {{OWNER_APPROVED_UX_SPEC}}
- Owner-approved code implementation blueprint, version and source link: {{OWNER_APPROVED_CODE_BLUEPRINT}}
- Feature branch: {{FEATURE_BRANCH}}
- PR and full source SHA for Stage 4: {{PR_URL_AND_FULL_SHA}}
- GitHub credentials are supplied only in the approved secure credential field. Never place secret values in this prompt or launcher.

If an input is not required for the selected stage, leave it unused. If a required input is missing, contradictory, inaccessible, or unapproved, stop with the stage-specific blocked status.

Micro is one product. Market and Delivery are features within Micro. The vendor workspace belongs inside Market. The driver experience is visually and contextually separate from vendor/project-owner experiences but uses the same Micro person identity with separate role, membership, and authorization. A distinct portal/origin is not itself a security boundary.

Confirmed product constraints:
- Market v1 is public/approved listing discovery and external contact only. No cart, checkout, purchase, payment, settlement, commission, live inventory, financial write to Manage, or automatic Delivery creation from a Market listing.
- A signed-in user may prepare a private vendor profile/listing draft and private images while review is pending. Nothing is public until every required approval passes. Approval of a vendor profile does not auto-approve future listings.
- The Market policy is a 30-day availability confirmation reminder, hiding at 60 days without confirmation, and reviewed renewal after hiding. Do not substitute 90 days.
- Driver self-application and invitation are both allowed. Neither activates the driver. Qays or an authorized reviewer manually reviews the driver and vehicle. Minimum evidence: ID image, driving-license image, and simple ownership/use-permission evidence when registering a vehicle. Keep evidence private. Do not add OCR, vehicle-class limits, plate restrictions, or extra documents by default.
- Project owners select known drivers. No random dispatch. Do not automatically close a Delivery request because its owner is silent. No delivery payment/settlement or financial write to Manage.
- My Ask Micro and first-run module selection are deferred.
- Product decisions D01-D19 are authoritative only when present in OWNER_APPROVED_PRODUCT_DECISIONS or another owner-approved source. Recommendations are not decisions.

UX authority:
- Manus and the owner create and approve OWNER_APPROVED_UX_SPEC before code implementation. It must specify scenarios, roles, target journeys and flows, navigation and screen map, access matrix, screen contracts, textual wireframes, content hierarchy, onboarding, empty/loading/error/offline/pending/denied states, motion, micro-interactions, gestures, RTL, accessibility, and acceptance tests.
- Z AI must not create, redesign, simplify, rename, or fill gaps in that UX specification. Z AI may report an inconsistency between the approved UX spec and the codebase, map approved Screen IDs to code, and implement only the approved behavior. Any gap or conflict blocks the affected feature until the owner resolves it.
- Implement the approved Micro Calm Operational direction and the in-repository Micro UX guideline. The target is phone-first, portrait, Arabic-first, RTL, one-handed use at 320-430px unless the owner-approved specification and verified platform require otherwise. Keep touch targets at least 44px and primary actions 48px as required by Micro's approved direction. Do not rely on color alone. Follow the approved motion contract, reduced-motion behavior, and gesture alternatives. No decorative bounce, financial count-up, or gesture-only action.

## 1. RESUME AND STATE SAFETY — REQUIRED BEFORE EVERY STAGE/WAVE

Before doing work, inspect the live repository URL, current branch, full base and head SHAs, working tree, uncommitted/untracked files, open PRs, existing commits, CI state, latest unified report, and any running/recoverable work available in this environment. Identify the last completed operation and the single next incomplete operation.

Preserve all existing work. Never reset, force-push, clean, overwrite, reclone over, delete, or repeat a completed stage/wave to make the state look clean. If the base SHA, branch, PR, owner-approved artifacts, or working tree differs from the accepted state, stop with STATE_DRIFT and report the exact evidence. Resume only the next incomplete operation after verifying its prerequisites.

## 2. SOURCE AND REPORT AUTHORITY

Read repository instructions before acting, including AGENTS.md, current-state controls, document index, architecture/refactoring records, ownership contracts, ADRs, feature specifications, and the latest Group 6 or architecture-scan evidence when present. Record paths and SHAs. Treat repository code and documentation as evidence to verify, not as automatically correct because a file says "final" or "approved".

Use one unified report only. In Stage 1, discover the existing canonical report/tracker location from repository instructions and the document index. Do not invent a new path or create parallel stage reports. If no canonical path exists or writing is not authorized, return the complete report in the response and mark REPORT_NOT_SAVED; ask the owner to approve the path before later stages. Stages 2-4 append their results to the same owner-approved report and update exactly one next_action.
After the owner approves the path discovered in Stage 1, Stages 2-4 must verify it equals {{UNIFIED_REPORT_PATH}} and append to that exact file. If the file or path differs, stop for owner review; do not create another report.

In the unified report, distinguish VERIFIED, INFERRED, UNVERIFIED, NOT_RUN, NOT_EXECUTED, BLOCKED, and OWNER_DECISION_REQUIRED. Never label a recommendation, mock, local build, or source-code declaration as live proof. Record repository, full SHA, branch, evidence path, command and exit code for every material claim.

## 3. STAGE 1 — READ-ONLY BASELINE AND MANDATORY ARCHITECTURE SCAN

Run only when RUN_STAGE=1.

### Write boundary
The Micro source repository is READ_ONLY. Do not edit code/docs, create a source branch, commit, push, open a code PR, change settings, run deployment workflows, or change data. The only possible write is an update to the existing canonical unified report path discovered under Section 2, on a permitted non-base branch. Do not modify unrelated files or the base/default branch.

### Entry and current-state reconciliation
1. Verify repository, base branch, full SHA, working tree, existing PRs/branches, CI state, and latest Group 6/current-state records.
2. Check whether a complete Structure/Architecture/Code Organization Scan exists for this exact full SHA and has an owner disposition. Reuse it only if all mandatory coverage and evidence are current. If missing, stale, or incomplete, perform the full required scan or explicitly fill every missing area. Do not blindly rerun a complete current scan and do not skip the mandatory gate.
3. Read, when present: AGENTS.md; docs/operations/current-state.md; docs/operations/current-state-log.md; docs/operations/control/**/*.json; docs/architecture/refactoring/*; docs/contracts/40-technical-ownership-map-contract.md; docs/architecture/ADRs/*; scripts/check-*.mjs; bundle-budget checks; scripts/file-size-ratchet-baseline.json; src/domain/**; apps/prototype-web/client/src/application/**; apps/prototype-web/client/src/storage/local/**; apps/prototype-web/client/src/presentation/**; apps/prototype-web/client/src/pages/**; integration entry points; test and CI definitions; feature specs and document index. If the repository has moved these paths, inspect and record the exact equivalent; do not silently assume a path is absent or unchanged. Report every required source that is missing or inaccessible.

### Mandatory scan coverage
Assess and evidence each item:
1. Module/feature/bounded-context boundaries, including Market, Delivery, shared identity, app shell, Manage, and integrations.
2. Responsibilities of all materially relevant files, oversized/multi-responsibility files, entry points, feature discoverability, and exact paths a new engineer would follow.
3. Dependency direction, layer violations, cycles, hidden coupling, runtime/build coupling, and exact source of each violation.
4. Duplication and competing sources of truth for identity, roles, memberships, state, data, configuration, UX, and documentation.
5. Storage/application/domain/API/UI composition; persistence, migrations, image/document storage, orchestration, contracts, and ownership.
6. Authentication, sessions, authorization enforcement, tenant/project/vendor/driver isolation, direct URLs, private-file access, and unverified claims.
7. Test/CI/security/documentation mapping for each confirmed user scenario and permission boundary; list unmapped or stale requirements.
8. Provider/service references in repository files only: manifests, bindings, variable NAMES, workflows, migrations, IaC, DNS/TLS configuration, database, identity, storage, notifications, monitoring, backup. Classify each SOURCE_CONFIG_PRESENT, DOCUMENTED_ONLY, PROPOSED, NOT_FOUND, or UNKNOWN. Never access provider accounts/APIs or claim a resource is live.
9. A target module responsibility/dependency map with the smallest safe boundaries and no blind mass moves.

If the repository is not web-based or a listed path differs, inspect its real equivalent and state the mapping. Do not mark a topic covered merely by naming it.

### Findings and report contract
Classify every finding exactly once: FIX_NOW, PRESERVE, DEFER, or OUT_OF_SCOPE. For each finding include stable ID; exact path/symbol/line or command evidence; impacted modules and users; data/security/financial impact; root cause; minimum safe remediation; dependencies; exact tests; binary or threshold-based acceptance criteria; risk; rollback boundary; and owner decision if needed. PRESERVE must state why. DEFER must state the trigger and owner. OUT_OF_SCOPE must state the boundary.

Recommend the minimum safe remediation waves. For each wave list exact finding IDs, files/modules verified in this scan, preconditions, test commands/checks, acceptance criteria, risk, and rollback boundary. Structural work must remain separate from semantic, financial, or product behavior. This is a proposal, not execution authorization.

Write/update the one canonical unified report only if authorized. Include current evidence, full SHA, coverage checklist for all nine scan items, findings, current/target module maps, test/docs map, wave sequence, owner decisions, missing evidence, actions performed/not performed, and exact report path. Report one next_action only.

### Stage 1 exit
Stop after Stage 1. Do not run Stage 2 or implementation. End with one primary status:
AUDIT_COMPLETE — OWNER_DECISIONS_REQUIRED
AUDIT_BLOCKED — <specific reason>
Also state NO_SOURCE_REPOSITORY_WRITES_PERFORMED and NO_PROVIDER_ACCESS_PERFORMED. The owner must review classifications and accept exact Finding IDs before any approved structural work.

## 4. STAGE 2 — READ-ONLY IMPLEMENTATION MAPPING (NO PRODUCT/UX DESIGN)

Run only when RUN_STAGE=2.

### Required owner inputs
- Owner-accepted Stage 1 findings and disposition.
- OWNER_APPROVED_PRODUCT_DECISIONS with the exact resolved D01-D19 entries or explicit decisions to exclude a question from v1.
- OWNER_APPROVED_UX_SPEC with owner approval, version/date, scenario IDs, Screen IDs, flow/state contracts, and acceptance criteria.
- A source SHA and current unified report path already verified by the owner.

If any required input is missing, contradictory, inaccessible, or not approved, stop with STAGE_2_BLOCKED. Do not write UX, fill missing decisions, infer access policies, or recommend an unapproved financial/business rule.

### Mission
Create a code implementation map from the approved product and UX artifacts to the verified repository. This is code planning, not product design and not implementation. Do not change source code, tests, repository configuration, migrations, branches, or provider settings.

### Exact implementation traceability
For every owner-approved Requirement ID, Scenario ID, Screen ID, state transition, and role/action, produce a row with:
- exact approved source and version;
- existing or required route/component/file/module found in the repository;
- API/query/command or event and data owner/source of truth;
- authorization guard and object-ownership condition;
- loading, empty, error, offline, pending, denied, and retry treatment from the approved UX spec;
- tests that exist and tests that must be added;
- dependencies, exact owner decision if any, implementation wave, acceptance criteria, risk, and rollback boundary.

Do not create extra screens or user states. If the codebase cannot implement the approved spec without a new contract, identify the exact gap and stop the affected item. Do not silently simplify UX to fit current code.

### Required Stage 2 output
1. Verified baseline (repository, branch, full SHA) and exact source documents/versions.
2. Implementation traceability matrix covering 100% of approved Requirement/Scenario/Screen IDs; uncovered IDs are blockers, not omissions.
3. Role/resource/action enforcement map to server code, tests, private files, project/vendor ownership, and denial behavior.
4. Exact file/module map from repository evidence, with changes separated as structural FIX_NOW vs feature implementation vs test/documentation.
5. Data/API/event/migration map with single source of truth and forbidden effects: no Market-to-Delivery automatic creation; no prohibited Manage financial writes.
6. Existing code-side infrastructure dependency inventory with evidence and status labels; expected variable/binding names only. No provider access and no claim a live resource exists.
7. Ordered, independently testable implementation waves with exact files, scenario IDs, commands, dependencies, acceptance thresholds, risk, and rollback boundary.
8. Complete blockers and owner decisions. Do not replace any open decision with "TBD" without a corresponding exact D-ID/question.

Append the Stage 2 section to the same unified report. End with one status:
CODE_MAP_COMPLETE — OWNER_APPROVAL_REQUIRED
STAGE_2_BLOCKED — <specific reason>
State NO_SOURCE_REPOSITORY_WRITES_PERFORMED and NO_PROVIDER_ACCESS_PERFORMED. Stop for owner approval of the exact version before Stage 3.

## 5. STAGE 3 — OWNER-APPROVED CODE IMPLEMENTATION ONLY

Run only when RUN_STAGE=3.

### Entry gates
Verify the exact owner-approved code blueprint, UX spec, D01-D19 decisions, Stage 1 accepted findings, current repository/base SHA, feature branch state, worktree, existing PR, and CI. Preserve all existing work. If drift or approval is missing, stop before edits.

### Git and write boundary
Use one feature branch {{FEATURE_BRANCH}} from the verified base. Work only on that branch. No direct base/main changes, merge, production deployment, force-push, unrelated cleanup, provider access, secret values, domain/DNS/TLS changes, live database/storage changes, or unapproved migrations. Open/update one PR only if authorized. Do not create a second report path.

Allowed changes are only the exact approved code blueprint, approved structural FIX_NOW IDs, tests and technical documentation needed for those changes. Any needed behavior absent from the approved blueprint is a blocker for owner decision.

### Implementation order and required gates
Follow the exact approved wave order. At minimum, maintain these boundaries if present in the approved blueprint:
- Shared foundation: only accepted structural fixes; existing Micro identity/session; role/membership gates; server-side object checks; private file access; audit; safe persistence/migrations. No broad reorganization.
- Market vertical slice: approved browse/search/listing details; private vendor profile/listing/image drafts; review decisions; publication eligibility; 30-day reminder/60-day hide/reviewed renewal; external contact/reporting exactly as approved. No checkout/payment/settlement/live inventory/Delivery creation.
- Delivery vertical slice: self-application/invitation without activation; private evidence; manual driver/vehicle review; distinct driver portal; project-scoped owner selection of a known driver; approved request/response/transition/acknowledgment/exception behavior. No random dispatch, silent close, payment/settlement, or Manage financial writes.
- Integration/hardening: only approved identity/API/events, notifications, audit, search, accessibility/RTL, performance, observability, backup/recovery hooks, and runbooks. No external service setup.

For every wave:
1. Record pre-wave full SHA and exact task/file list.
2. Add/update tests before or with the code.
3. Implement only the approved Screen IDs and state transitions. Follow the owner-approved wireframes, content, RTL, motion, touch, accessibility, and gesture alternative requirements. Do not redesign or substitute.
4. Verify screens/states at 320/360/390/430px when the current runtime supports it; test Arabic long text, keyboard, screen-reader labels, reduced motion, touch areas, content hierarchy, and 0/1/many items. If a device/browser test is unavailable, mark NOT_RUN; do not claim PASS.
5. Run exact focused tests and canonical repo checks/CI after every wave. Record command, exit code, URL/result, full SHA, and affected files.
6. Inspect full diff for secrets, unapproved files, product/financial semantic changes, role leaks, and UI states omitted from UX contracts.
7. Commit a wave only after its checks pass. Stop before the next wave on any failure, drift, missing decision, privacy/security issue, or extra scope.

If safe isolated sub-agents are supported, use five specialists only after shared contracts are frozen and only for non-overlapping work: identity/security foundation; Market backend/moderation/files; Market UI/RTL/accessibility; Delivery backend/driver and owner flows; integration/tests/CI. The parent owns shared-file integration and one unified report. If file ownership cannot be isolated, work sequentially. No sub-agent may broaden scope, merge, or deploy.

### Stage 3 exit
The PR must map every approved Requirement/Scenario/Screen ID to code and passing tests or an explicitly reported blocker. Append wave reports to the same unified report, including commits, exact files, tests/CI, results, deviations, security/financial review, and rollback. Stop for owner PR review. End with one status:
IMPLEMENTATION_COMPLETE — PR_READY
IMPLEMENTATION_BLOCKED — <specific reason>
STATE_DRIFT — <specific reason>
Always state NO_MERGE_PERFORMED, NO_PRODUCTION_DEPLOYMENT_PERFORMED, and NO_PROVIDER_ACCESS_PERFORMED.

## 6. STAGE 4 — READ-ONLY CODE READINESS AND OWNER/MANUS HANDOFF

Run only when RUN_STAGE=4 and the exact PR/source SHA and owner-approved blueprint/UX spec are supplied.

Z AI must remain read-only. Verify the exact PR, base/source SHA, full diff, owner approvals, wave reports, tests, and CI. Run only repository-documented checks that do not need provider credentials or real user data. Do not merge, deploy, trigger release workflows, access Cloudflare/other provider accounts, or change code.

Verify by evidence:
1. Traceability from every approved Requirement/Scenario/Screen ID to code, permission enforcement, state handling, and tests.
2. Anonymous, signed-in Micro user, vendor applicant/approved vendor, project owner with/without membership, driver applicant/invited/pending/approved, reviewer/admin, and support access rules. Test direct route/API, cross-tenant/IDOR, stale/revoked session, invitation expiry, role crossover, and private-file URL.
3. Market approval visibility, draft/image privacy, 30/60 policy, renewal gate, search eligibility, and no purchase/payment/Manage write/Delivery creation.
4. Driver review and vehicle approval, known-driver selection, owner-approved transitions, no random dispatch, no auto-close due to silence, no payment/Manage write.
5. UX contract evidence: screen coverage, Arabic/RTL, hierarchy, empty/loading/error/offline/denied states, touch target, reduced motion, gesture alternatives, keyboard and screen reader. Report missing device/browser coverage as NOT_EXECUTED.
6. Idempotency, upload retry, duplicate request, concurrency, backup/restore code hooks, and failure recovery where required by the approved spec.
7. Repository-declared provider dependencies only: exact binding/env variable NAMES, callbacks, migrations and storage assumptions. Distinguish source configuration from live provider status. Never print secret values.

Append a code-readiness section to the same unified report. Give the owner and Manus a provider checklist that ties each expected resource/name to source-code evidence, environment, purpose, manual verification, cost/limit, and rollback. Mark all external resources NOT_VERIFIED_BY_ZAI. The owner and Manus perform provider setup and connected staging/UAT after this code review.

End with one status supported by evidence:
CODE_REVIEW_COMPLETE — PROVIDER_HANDOFF_READY
CODE_REVIEW_BLOCKED — <specific reason>
CODE_CHECKS_INCOMPLETE — <specific reason>
Always state NO_PROVIDER_ACCESS_PERFORMED, NO_MERGE_PERFORMED, NO_DEPLOYMENT_PERFORMED, and NO_CLEANUP_PERFORMED.

## 7. GLOBAL STOP CONDITIONS

Stop the affected work and report the exact evidence if:
- owner-approved product decision or UX contract is missing, contradictory, or not represented in the code blueprint;
- the live base SHA, PR, branch, or worktree differs from the approved state;
- a protected financial meaning, role, privacy policy, retention rule, or state transition would change;
- source evidence is insufficient to claim a service, test, permission, or deployment works;
- a task requires provider access, an unapproved secret, live resource, public exposure, or direct base-branch write;
- any required test fails or an unrelated file/feature must change.

Do not infer consent, use silence as approval, or continue beyond the current RUN_STAGE. Preserve all work and set one clear next_action.
```

## SHORT CHAT LAUNCHER — استخدم رسالة واحدة قصيرة لكل تشغيل

```text
Read the canonical Micro execution contract at {{MASTER_PROMPT_PATH}} and the exact owner-approved artifacts it references. Execute only RUN_STAGE={{RUN_STAGE}}. Verify live repository state and resume safely without discarding or repeating completed work. Do not advance to another stage or wave without its explicit owner gate. If any required decision, approval, source, path, or SHA is missing or inconsistent, stop and report the exact blocker in Arabic. Follow the stage's allowed operation and write boundary; do not edit outside it, reset, clean, delete, force-push, merge, or deploy. Use credentials only in the secure credential field; never paste secrets into chat or logs. Append results only to the owner-approved unified report. Do not access any Cloudflare/provider account. End with the exact stage status, changed paths or NO_REPOSITORY_WRITES_PERFORMED, and NO_CLEANUP_PERFORMED.
```

**قاعدة الاستخدام:** لا تملأ `{{UNIFIED_REPORT_PATH}}` أو `{{OWNER_APPROVED_UX_SPEC}}` بالتخمين. المرحلة الأولى تثبت مصدر التقرير والحالة الحية؛ Manus والمالك يجهزان مواصفة UX ويقران القرارات قبل Stage 2/3. Z AI يربط المواصفة بالكود وينفذها؛ لا يستبدل قرار UX ولا يجهز Cloudflare.
