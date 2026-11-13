# Z AI 5.3 — Whole Micro Online Readiness Analysis (READ-ONLY)

**Status:** Current owner-authorized task for the existing Z AI conversation (2026-11-13). Follow `ONLINE-READINESS-ANALYSIS-PROMPT-EN.md` for this invocation. The prior implementation instructions retained below are suspended until the owner separately authorizes implementation.<br>
**Repository:** `Qays7753/Micro`<br>
**Branch:** `zai/micro-market-delivery-handoff-20261111` — verify the live branch before acting.<br>
**Last observed branch SHA:** `e8cf476836c75895112a9b6f8536c79ccc8f9374` (reference only; verify live).<br>
**Current owner direction:** analyze Micro as one connected product including Manage, Market, and Delivery; treat older conflicting local-only/feature-limited assumptions as prior decisions to assess, not as blockers.<br>
**Source of truth:** GitHub files in this repository only. No Google Drive or external-file-service links/IDs.

## HISTORICAL IMPLEMENTATION PROMPT — SUSPENDED FOR THIS ANALYSIS

The following 2026-11-12 continuation and its implementation phases are retained for history only. Do not implement code, modify earlier documents/Control, rerun prior work, configure providers, or follow any write/test/deploy instruction below during this task. The only current task is the read-only analysis in `ONLINE-READINESS-ANALYSIS-PROMPT-EN.md`; the only permitted repository write is the single report file named there, pushed to this existing branch only if safe.

### Resume without repeating work

1. Verify the live branch, full SHAs, `main`, worktree/untracked/stashed changes, active processes, commits, PRs, CI/Pages checks, Control records, and current report. Treat the SHA above as a hint only. Preserve all work; never reset, clean, overwrite, reclone over work, force-push, or start a duplicate process. If material drift or a collision exists, report `STATE_DRIFT` and stop before writing.
2. Continue from the first genuinely incomplete item. W05/Control reconciliation, the selected Cloudflare architecture, existing feature implementation, prior tests, and earlier report sections are completed historical work to verify and retain, not tasks to repeat. Do not rerun W05's historical test suite or any unchanged passing suite merely for reassurance.
3. Use only this GitHub repository and existing branch. Do not access Google Drive or another external file service; do not change `main`, create another branch, open a PR, merge, deploy, enter Cloudflare/Google accounts, provision or modify provider resources, or write credentials/secrets. No credential is needed for this task. If a later provider action needs a credential, use the provider's secure secret field; never ask the owner to paste a token or secret into chat, a prompt, a repository file, command, log, or report. Use synthetic data only. Owner and Manus will configure providers after your code handoff.
4. Respect Section 2's post-Group-6 structure gate and additive-only boundary. No structural refactor, mass move, rename, new app/package, or code-organization remediation. If a necessary fix crosses that gate, finish independent safe work and report the exact blocker and smallest proposal; do not start the structural change.

### Owner-approved remaining work — verify every finding before fixing

The owner approved completing all applicable outstanding work from the latest readiness review. Canonical decisions, contracts, scenarios, and approved UX specifications are authoritative; the audit findings below are leads to verify against live code, not substitutes for inspection. Do not reopen settled product decisions or weaken a canonical contract to match existing code.

1. **Delivery mutual consent for retry, holding goods, and return.** Verify Contract 21 §3.2-3. The audit found that the driver can declare `retry_agreed`, `holding_agreed`, or `return_agreed` without a distinct requester/project-owner acceptance path. If confirmed, implement proposal plus explicit other-party acceptance/rejection so none of those actions becomes effective before required mutual agreement. Silence or disagreement must leave a clear pending state and must not trigger an automatic action. “Return” means return of goods, not a money refund. Preserve actor, timestamp, reason, prior agreement, and event history; add API/domain/UI and negative-authorization tests.
2. **Material change to a confirmed Delivery booking.** Contract 21 §3.2-2 requires a change proposal for material fields (including time, price, load, address, vehicle, or collection amount) and explicit acceptance by the other party. If the audit's reported gap is confirmed, implement the versioned proposal/acceptance flow: the accepted agreement remains effective and immutable until the other party accepts; reject/cancel paths and history remain explicit. Never silently overwrite agreed terms.
3. **Market pagination.** Verify the reported 50-result cap and missing cursor. Implement stable cursor pagination for approved public listings, preserving filters and ordering, with safe page-size limits and no exposure of drafts/private data. Test next page, final page, malformed/stale cursor, filter stability, and authorization.
4. **Market direct updates.** Contract 20 §3.3 permits validated direct updates to numeric price within the same pricing mode, availability, declared quantity, and pause state. Verify the reported fixed-price-only path and missing tier/quantity support; implement the approved tiered-price and quantity updates without changing pricing mode. Keep content, category, media, and other review-required edits in moderation. Test validation, ownership, audit history, and moderation boundaries.
5. **Approved in-app reminders.** Inspect canonical requirements and actual code. Complete missing internal/in-app reminders, including Market's 30-day availability reminder, Delivery's 24-hour requester-confirmation reminder, and the 7-day driver-evidence-expiry reminder where applicable. Use the existing in-app notification boundary and a supported, idempotent scheduled/due-processing design with local Cloudflare emulation tests. Do not invent timing or policy values and do not add email, SMS, push, WhatsApp, or a new vendor. If external account configuration is later required, implement repository-side code/config only and document the exact owner/Manus step; do not provision it.
6. **Rendered app UX review and fixes.** Review the actual running Market and Delivery UI in Arabic RTL at 360, 390, and 430 CSS-pixel widths; DOM/source tests alone are not visual acceptance. Cover critical journeys for guest/buyer, listing owner/vendor, project owner, driver, and authorized reviewer, including loading, empty, error, denied, waiting, success, retry, and exception states. Check clarity of hierarchy/actions/statuses, touch targets, overflow, navigation/back, forms, accessibility, and consistency with the frozen Micro UX principles and approved feature UX specifications. Fix confirmed in-scope UX defects without inventing product behavior. Use synthetic data only. Record route, role, viewport, result, and available visual evidence. If rendered browser review is unavailable, mark it `NOT_RUN` and do not claim UX acceptance; continue all other work.
7. **Miniflare bundled dependency/security finding.** The latest audit reports that ordinary dependency audit passes after the Miniflare upgrade while older Zod copies remain bundled in Miniflare's distribution and are not visible in the resolvable dependency graph. No owner security exception has been accepted. Re-verify upstream/version evidence and resolve the finding without suppressing checks, misrepresenting graph-only removal, or accepting risk on the owner's behalf. Prefer a supported patched upstream release or a safe, non-paid, repository-compatible alternative that preserves Worker/D1/R2 test coverage. If a solution requires a broad test-platform replacement, paid service, or other high-impact/unapproved change, complete independent work and report the exact residual blocker and options; do not silently choose an exception.
8. **Truthful canonical documentation.** Reconcile the one existing `EXECUTION-REPORT.md`, canonical `docs/expansion/TRACKER.md`, and only directly affected canonical documents with verified final state. Correct stale/conflicting claims about implementation versus absence of code, known gaps versus “no code gap,” pre-code tracker status, old D1/Cloudflare wording versus the accepted direction, and branch preview versus production. Preserve earlier evidence as dated history; do not erase it or create a competing report. For Operations Control, edit source JSON and regenerate views only through approved tools.
9. **Code readiness for later connected setup.** Verify and complete repository-side readiness for the selected Cloudflare direction: the actual Pages/Workers-compatible entry and routing for the existing Micro app; D1 schema and ordered migrations; binding names and local emulation; private R2 paths and authorization; Google OAuth/Micro identity code and exact callback/origin requirements; reminder scheduling; build/runtime configuration; safe secret-name documentation (never secret values); and owner/Manus instructions for setup, smoke/UAT, backup/restore, cost guard, and rollback. Add or correct only repository-side code/config/docs that fit existing conventions and the structure gate. Do not provision resources, enter provider accounts, write secrets, deploy, or claim a live connection/UAT. State exactly what is ready in code and what remains for owner/Manus.

### Continuous execution, verification, and handoff

- Work through all safe, authorized items continuously. Do not pause for ordinary implementation details already settled by the canonical contracts. If a genuinely new product, financial, legal, privacy, security, structural, or paid-service decision is unavoidable, do not invent it: finish independent work and report the precise owner decision needed.
- Keep coherent remediation commits on this branch; do not recreate completed implementation commits. The main Z AI is the sole writer. If supported, use the five distinct read-only reviewer scopes in Section 10, including an actual rendered-UX reviewer; reviewers must not edit or run duplicate tests.
- Run focused regression tests once per changed behavior. Reuse prior evidence only when the tested tree is unchanged. After changes, run the required final repository gate once, applicable security/secret checks, and relevant Worker/D1/R2 emulation tests. Report commands, counts, exit codes, and exact tested SHA. Obtain/report checks for the exact final pushed SHA; checks on an earlier SHA do not prove new code. Do not rerun historical W05 tests.
- Update the single existing Arabic `EXECUTION-REPORT.md` with a dated continuation section, verified findings and paths/symbols, fixes, per-item status, tests/CI/visual evidence, unresolved blockers, code-readiness checklist, exact final SHA, changed files/commit SHAs, and concrete owner/Manus Cloudflare and connected-UAT steps. Keep the final status consistent with all remaining code and UX gaps. Push completed commits to this same branch only if safe and confirmed not to trigger production deployment.
- Stop before PR creation, merge, production deployment, provider setup, or any real-user pilot. Distinguish code/UX completion from provider configuration, connected acceptance, pilot, and production. Do not choose pilot duration, location, participant count, or recruit users in this task.

## 0. Owner authorization and outcome

The owner authorizes you to finish the remaining GitHub work for Micro Market and Micro Delivery on the existing branch, including the documentation/Control updates below, additive application code, tests, and a final evidence report. Work through the phases in order without pausing for approval between ordinary implementation waves. Stop only for a material unresolved owner decision, a failed mandatory gate, a structural-change gate, a cost/provider action, state drift that cannot safely be reconciled on this branch, or a security/privacy/financial ambiguity that cannot be safely contained.

The owner has explicitly accepted the completed W05 outcome and authorizes closing its Operations Control records using the already committed W05 result report and the successful checks on the exact merge SHA. Do not make the owner repeat this decision and do not rerun W05's historical test suite merely to duplicate existing evidence. Apply only a legal Control transition and record the owner's acceptance with the supporting evidence. Never claim a test was run on `main` if it was not.

The owner has approved **Cloudflare as the platform direction** for the connected Market/Delivery prototype, with a **free-tier-first / no-paid-upgrade** constraint. Implement Cloudflare-compatible code and configuration in the repository; do not create or change provider resources. The owner and Manus will handle Cloudflare and Google provider accounts after your code handoff.

The required final outcome is **code and documentation ready for owner/Manus Cloudflare setup and connected acceptance**, not a claim that a live Cloudflare environment, OAuth tenant, real-user pilot, or production release exists. State this distinction prominently.

## 1. Decisions that are binding for this task

1. **One product and one repository:** Micro remains one application. Market and Delivery are features within Micro, not separate products, repositories, or independently branded apps.
2. **Owner's Cloudflare direction:** use the existing Cloudflare Pages host for the Micro UI and, if compatible with the repository's actual deployment root, a same-product Pages Functions / Workers-compatible API (BFF); use Cloudflare D1 for Market/Delivery network data and Cloudflare R2 for images and private evidence files. Keep the backend a modular monolith. Do not introduce Supabase, Firebase, another database vendor, or microservices. If repository evidence proves this topology impossible without a separate paid service or unapproved structural change, stop and provide the smallest options and cost/impact instead of silently substituting.
3. **No paid commitment:** target Cloudflare free services and local emulation. Do not enable, purchase, or recommend an automatic paid upgrade. If a required behavior cannot safely operate within the free-tier-first constraint, document the exact quota/feature and stop for owner choice before spending.
4. **Identity:** use the already approved Micro identity flow: continue with Google, then Micro applies its own server-side membership and role authorization. Google identity is not itself authorization. Cloudflare Access is not a substitute for customer/vendor/driver roles. The owner/Manus will later configure Google OAuth credentials and Cloudflare secrets. Never create, request, commit, or expose real credentials.
5. **Roles and portals:** supplier workspace is inside Market and uses the same Micro account. Any registered Micro user may prepare a supplier/listing submission, but submission is not public approval. The driver has a distinctly gated experience and navigation that does not expose Manage, Market, or owner/vendor screens; it uses the same Micro identity, not a second account or app. Do not invent a separate domain/host for the driver. A distinct route/shell in the same Micro app is the default; explain any required deviation.
6. **Product decisions:** `docs/expansion/DECISIONS.md` and the canonical E-00 contracts now contain the 52 approved product decisions (Market OD-01…OD-21; Delivery OD01…OD31). Treat those canonical GitHub documents as operative. The frozen snapshots under this handoff's `inputs/approved-feature-specs/` are provenance, must remain byte-for-byte unchanged, and must not be treated as a competing live source. Do not ask the owner to repeat a decision recorded there.
7. **Future Manage is not in this task:** never migrate Manage financial or inventory data to D1/R2, connect a network event to a financial event, or modify existing financial meaning, local storage, export/restore, snapshots, or reconciliation. D1 is approved here for Market/Delivery only. Any future cloud Manage decision remains a separate owner gate.
8. **Deferred scope stays deferred:** no My Ask Micro, first-run module selection, employees, fees/commissions, payment processing, public ratings/reviews beyond the approved Delivery task-rating rule, broadcast/random driver assignment, live GPS, chat, WhatsApp/SMS, maps, push provider, external AI, or automated Manage updates.

## 2. Authority and mandatory gates

Read `AGENTS.md`, `docs/operations/current-state.md`, the relevant Micro architecture/security/UX contracts, `docs/00-document-index.md`, `docs/expansion/README.md`, `DECISIONS.md`, `TRACKER.md`, `E00-TECHNICAL-ARCHITECTURE-DECISION.md`, scenarios/traceability, role/access matrix, network contracts 18–25, the current `EXECUTION-REPORT.md`, the included 2026-11-11 structure scan, and the exact approved feature specifications before coding. Keep the read scoped to these sources and the implementation paths/tests you actually touch.

The owner's current Cloudflare and code authorization supersedes the prior pre-gate ban on adding Auth/Cloud/network capabilities **only for Market/Delivery**. It does not waive the structural gate, financial invariants, required Control claim, security/privacy constraints, or the ban on provider-account operations.

### Post-Group-6 structure gate

The 2026-11-11 comprehensive read-only Structure/Architecture/Code Organization Scan is present under `inputs/owner-background/`. The owner has not yet approved its individual remediation findings/waves for execution in this task. Therefore:

- Do not refactor existing modules, move/rename files, split oversized legacy files, create a new root application/package, create a generic `features/` layer, weaken a boundary guard, or implement any scan remediation wave.
- Additive feature files and a narrowly scoped Pages Function entry point may be created only where existing repository/deployment conventions support them and no existing file organization is changed.
- Before any proposed new code boundary, map it to the actual existing code and the scan's target module map. If the change would count as code-organization remediation or requires a new repository/package boundary, stop before that change and report the precise finding, smallest proposed delta, dependencies, risks, acceptance criteria, and rollback boundary for owner review.
- Do not conceal a refactor inside a feature commit. Keep each product change additive and separately reviewable.

### Data and privacy gate

Use synthetic accounts, listings, images, vehicle data, and driver-evidence files only. Never use the owner's or a real driver's personal documents/data. Keep driver identity/license/vehicle evidence private by default and visible only to the subject and explicitly authorized reviewers. Never place documents in a public bucket, public URL, logs, test artifacts, or Git history. Enforce authorization server-side for every API, query, search, export, and file path; hiding UI is not authorization.

The current owner decisions do not constitute legal approval of retention, deletion, restoration, or disclosure of real customer/driver personal data. Implement safe code paths and the exact approved product behaviors, but keep real-person data and pilot activation blocked until the owner/Manus completes the required policy/legal/provider steps. Do not invent legal rules, consent wording, retention duration, or a new numeric policy. If the unresolved customer disclosure/consent question affects a real-data path, do not release that path; identify the owner action in the report.

## 3. Branch, Control, and change discipline

- Work only on the existing handoff branch. Never modify `main`, create another branch, open a PR, mark a PR ready, merge, delete a branch, reset, rebase, cherry-pick, force-push, or rewrite history.
- Check the live remote branch, `main`, worktree, open PRs, CI/deployment triggers, and active Operations Control claims first. Preserve any unexpected work. Do not overwrite a newer remote commit. If state has moved, fast-forward only when the worktree is clean and there is no history rewrite; otherwise stop and report the exact SHAs.
- Before code, create/update the appropriate source JSON Workstream/Items using the next unused IDs, exact branch/base SHA, actual areas/contracts, and dependencies. Check for area/contract overlap first. Use the valid state transitions in `docs/operations/control/README.md` and `AGENTS.md`; update JSON sources and regenerate views only through the prescribed tools. Never edit generated views or Excel manually.
- Keep separate, meaningful commits for (a) W05 closure, (b) architecture/contracts, (c) shared connected foundation, (d) Market, (e) Delivery, and (f) final acceptance/report, as applicable. Push ordinary commits only to this existing branch; never force-push. Prefer one final push after the local phases are complete to avoid redundant CI runs. If a branch push would cause an unintended production deployment or paid resource operation, do not push until it is safely excluded; report the exact blocker.
- Do not install dependencies unless repository policy and a specific implementation need require it. Any added dependency must be necessary, compatible with the actual Workers runtime, pinned, license-checked, and disclosed.
- Preserve all frozen input hashes. Do not add secrets, sample real personal data, external-file-service links/IDs, or credentials to the repository.

## 4. Phase 0 — Read-only preflight and independent implementation review

Before modifying files:

1. Verify the current branch, live `origin/main`, live handoff-branch SHA, merge-base, worktree status, existing commits, open PRs, GitHub checks, and active Control claims. Record exact SHAs. Do not trust the reference SHA in this prompt or stale `current-state.md` without checking live state.
2. Read the existing unified `EXECUTION-REPORT.md` and confirm the actual files/commits it lists exist on the live branch. The previous Z AI report is evidence to reconcile, not permission to skip inspecting implementation paths.
3. Independently form a concise current-code map for the exact Market/Delivery touchpoints: app entry/navigation and route ownership; existing UI/layers; package/deployment root; local Manage store and transfer boundaries; Cloudflare Pages indicators; test/CI conventions; and the absence or presence of server/Auth/DB/R2 code. Cite actual paths and symbols in the final report. Do not rescan unrelated legacy modules.
4. Build an implementation readiness table for all 52 approved OD decisions and every mandatory scenario in the canonical acceptance/traceability documents. Mark each as code requirement, already implemented (with code/test proof), blocked on owner/Manus/provider, or out of scope. This is not an invitation to reopen approved product decisions.
5. Compare the proposed additive paths with the structure scan target map. Apply the structural gate in Section 2 before writing code.
6. Record a short Arabic progress update in the report (not a user pause): what you read, what you will change, what you will not change, acceptance criteria, and genuine unknowns.

If the repository reveals a material contradiction in approved product decisions, a required structural change, an active overlapping claim, a security/legal blocker, or an unavoidable paid service, stop at that boundary. Do not silently decide it. Complete any safe, independent documentation/reporting and state what cannot proceed.

## 5. Phase 1 — Close W05 using the owner's explicit acceptance

The owner has selected the acceptance path already recorded in `DOC-032`/`WS-248`: accept the committed `docs/implementation/UXR-W05-RESULT-2026-11-06.md` and successful GitHub checks on exact merge SHA `16c90e48bdc018939f97f41d05e969c900bc30e0`; no re-run of the historical W05 suite is requested.

The latest required `python3 scripts/operations-control/validate.py` run on this branch failed specifically because PR #384 is merged while `WS-248` remains `MERGED_UNVERIFIED`. This is the first blocking item. The explicit owner-acceptance route already recorded in `DOC-032.next_action` is authorized; record it with valid `VERIFIED` evidence on `16c90e48bdc018939f97f41d05e969c900bc30e0`, then rerun the Control validator. Do not begin feature code or create a new code Workstream until this validation passes. If the documented transition rejects the accepted evidence, stop and report the exact rule; do not invent a workaround.

1. Verify that PR #384 is merged at that exact SHA and that the stored W05 report and check evidence are present. Use no test run unless the Control state machine reveals a specific missing item-specific proof that cannot be satisfied by the accepted evidence.
2. Record the owner's explicit acceptance (dated 2026-11-12) in the source JSON and append-only history. Use `VERIFIED` only if the documented transition permits the explicit-owner-acceptance path and the required `merge_sha`, `verified_on_main_sha`, and evidence fields are populated from facts on `main`. Do not fabricate evidence or say generic checks proved a test they did not run. If the legal terminal state is not `VERIFIED`, preserve the valid state and document why; do not leave a false status.
3. Regenerate Control views via the canonical generator and run only the Control validations required for this source-record change. Record commands, exit codes, and tested SHA.
4. Preserve unrelated workstreams and historical records. Do not run the rest of W05 again or modify W05 product code.

Commit this reconciliation separately.

## 6. Phase 2 — Resolve the authorized Cloudflare architecture and necessary contracts

Update the canonical GitHub documents before implementation so the repository no longer describes the selected provider as undecided. Keep the 52 approved product decisions unchanged.

1. Record a dated, attributable owner architecture decision: Cloudflare Pages for the existing UI; Pages Functions/Workers-compatible API/BFF where compatible with the actual Pages project; D1 for Market/Delivery network data; R2 for images and private driver evidence; Google sign-in through Micro's application identity; no Supabase; no provider account access or paid upgrade. D1/R2 are not Manage storage and do not receive Manage financial data.
2. Amend `docs/expansion/E00-TECHNICAL-ARCHITECTURE-DECISION.md`, the necessary existing canonical architecture/decision/tracker references, and the report so they distinguish (a) owner-selected direction, (b) code implemented on this branch, (c) Cloudflare resources still unprovisioned, and (d) future Manage decisions still open. Do not invent or reuse an EX/OD identifier; use the next valid identifier only if repository convention requires one, and update its single canonical record consistently.
3. Close the known E-00 execution gaps required to implement the approved behavior: in particular the guided-booking lifecycle/state-transition matrix in network contract 21 and safe navigation/return behavior for `/market`, `/delivery`, and the driver route in contract 26. Derive states and exits strictly from approved OD decisions. Do not add a new business state or legal consent assumption.
4. Preserve the existing Manage local-first architecture, PWA, financial invariants, and explicit separation between local delivery/fulfillment in Manage and network Delivery.
5. Reconcile the relevant acceptance scenarios and traceability rows to code/test work. Do not rewrite unrelated contracts or stale architecture docs unless directly required; classify unrelated scan findings for later follow-up in the final report.

Commit the owner architecture/contract changes separately from feature code.

## 7. Phase 3 — Build the shared Cloudflare-compatible connected foundation

Implement only the minimum additive network foundation needed by both features within the existing Micro repository and established layer boundaries.

### Required implementation capabilities

- A server-side API/BFF compatible with Cloudflare Pages/Workers and the actual repository deployment root; same-origin by default. Keep it in the existing Micro deployment/repository rather than a second product/service.
- D1 schema and versioned migrations for network-owned Market and Delivery entities only. Include foreign keys, constraints, ownership, idempotency, timestamps, moderation/status history, and safe indexes as required by the contracts. Do not put image/document bytes in D1; store object metadata/keys only.
- Google OIDC sign-in integrated with Micro identity. Validate issuer, audience, state, nonce, and callback; use a maintained Workers-compatible library if one is needed. Use secure, HttpOnly, SameSite cookies and CSRF/origin protection appropriate to the implemented flow. Do not implement cryptography/token validation by hand if a suitable maintained library exists. Store role/membership state server-side; never accept a client-supplied role as authority.
- First-owner/admin bootstrap that does not hard-code a real email, subject, secret, or role in source. Document the one-time owner/Manus action and required binding/secret names. No self-granting admin endpoint.
- D1-backed server-side authorization on each operation, with distinct account, role, and resource ownership boundaries for guest, owner, vendor applicant/vendor, driver applicant/approved driver, and Micro reviewer/admin. Use the canonical role/access matrix. One identity may have multiple roles, but each role's data and UX context remains separated.
- Private R2 object handling for Market draft/review images and Delivery driver evidence. Enforce authorization before upload/download/delete; random non-guessable object keys; type/size validation; safe metadata; no public bucket/custom public domain; no long-lived public URLs. Prefer same-origin Worker-mediated reads or short-lived signed access only after authorization. Redact PII and tokens from logs/errors.
- In-app notifications/attention using the existing E-00 boundary. Do not add email, SMS, push, WhatsApp, or third-party notification vendors. Implement retry/idempotency and failure visibility where specified.
- Rate/abuse controls at the server boundary. Treat numbers described as engineering references in the approved specs as configurable, not a new owner-approved policy; list the final pilot values as an owner action if they remain undecided.
- Cloudflare local-development setup and tests using repository-compatible Wrangler/D1/R2 emulation where available. No production database ID, account ID, zone ID, domain, OAuth secret, or provider resource value in Git.
- Update CSP, service-worker/API caching rules, same-origin headers, and error behavior only as needed; never cache authenticated/private API or driver evidence responses.

### Foundation acceptance

Before Market/Delivery UI wiring, prove locally through focused tests that unauthenticated, wrong-role, cross-account, and wrong-resource reads/writes are rejected; authenticated allowed operations succeed; retries do not duplicate state; D1 transaction failures do not leave partial state; private R2 objects are not publicly accessible; no API route can write to Manage local storage or create financial events. If any of these tests fail, fix the root cause before continuing.

Commit the foundation separately. Do not deploy or connect a Cloudflare account.

## 8. Phase 4 — Implement Micro Market v1 end-to-end

Implement all approved, in-scope Market behavior from the canonical specs/contracts/scenarios, not a demo-only screen. Use real D1/R2-backed application paths in local Cloudflare emulation; no fake in-memory data as the acceptance implementation.

Required journeys and rules:

1. Guest can browse approved public listings and use only the approved contact action. Guest cannot submit/edit a listing or view private drafts, applicant data, moderation notes, or private images.
2. A signed-in Micro user can enter the Market supplier workspace within the same app/account, create/edit a private supplier-profile draft, listing draft, and draft images, then submit for manual review. Submission is not supplier approval or public listing publication.
3. The authorized reviewer can review supplier profile, listing content, and required images; approve/reject/request changes with actor, timestamp, reason/status history. Only the required approved components become public. Prevent approval bypass by direct API call.
4. A user/vendor can see and modify only their own authorized profile/listings. Enforce the one-person activity constraint in v1 without adding employees or a second account. A normal buyer stays a normal Micro user unless they start the supplier path.
5. Implement the approved listing-first model for the full Jordan-wide product scope, with owner-managed categories/branches as specified. Do not implement Need/Response feeds, ranking, chat, purchase reviews, or a preselected city/category wedge that contradicts the approved decisions.
6. Implement the approved 30-day availability confirmation reminder, 60-day hide, and reviewed renewal behavior. Distinguish owner availability confirmation from moderator suspension; no 90-day rule. Make transitions auditable and idempotent.
7. Use the approved `MarketPrice` representation and JOD rule. It is not `MoneyMinor`, not a Manage price, and must never produce a financial, cash, inventory, purchase, or order update.
8. Respect the approved free v1 behavior. No fee, commission, subscription, payment processing, or automatic upgrade.
9. Update the `/market` entry, route ownership, mobile Arabic RTL flows, empty/loading/error/offline/retry states, deep-link/back behavior, and notification surfaces without changing unrelated Manage workflows.
10. Do not create an automatic Market-to-Delivery link. Any future handoff is a separate explicit user action and out of this implementation unless an OD expressly requires it.

Provide focused API/domain/UI tests for guest access, applicant/draft privacy, moderation/publication boundaries, cross-vendor isolation, listing lifecycle 30/60, image privacy, idempotent edits, and absence of Manage side effects.

Commit Market separately.

## 9. Phase 5 — Implement Micro Delivery v1 end-to-end

Implement the owner and driver experiences as separate, fully gated contexts inside the same Micro application/identity. Use real D1-backed state and private R2 evidence paths in local Cloudflare emulation.

Required journeys and rules:

1. Owner UI is reached from the approved Delivery tab/route. Driver entry is separately gated and opens only the driver portal/onboarding/dashboard. A driver must never see Manage, Market, owner/vendor navigation, or another driver's records. Same Google/Micro identity; role and session authorization is server-side.
2. Support driver self-application and owner invitation. The driver cannot accept new bookings until the authorized reviewer approves both driver and required vehicle/evidence state. Invitation or complete form alone is not approval.
3. Enforce the exact three evidence categories in the approved spec: driver identity, driver license, and vehicle ownership/permission evidence when applicable. Keep files private to the driver and explicitly authorized reviewer. Manual review only; no OCR, automated authenticity claim, or invented expiry date. Record expiry only when clear. Expired evidence blocks new acceptances only; it never silently closes/cancels existing work.
4. Owner selects a known driver and vehicle; no broadcast, random matching, dispatch automation, or automatic fallback to another driver. Driver-defined service areas, availability, capacity, and terms remain visible and are snapshotted into each accepted booking.
5. Implement the guided request/quote/booking/state transitions in reconciled contract 21: one directed request, 30-minute response window, one final quote where needed, accept/reject, agreed appointment, pickup/drop-off, delays/waiting, contact attempt and explicit recorded outcome before the specified failure/cancellation route, confirmation/objection, daily statement, and unresolved silence. Preserve the 10-minute pickup and 10-minute delivery wait rules and the requirement that owner silence does not auto-close a job.
6. Preserve price/terms snapshots in the booking; later profile edits cannot rewrite accepted terms. Material changes need the other party's approval. No automatic cancellation, return, retry, retention, partial financial settlement, or booking closure beyond approved rules.
7. Implement declarations, full-confirmation daily statement, objections, evidence/status history, in-app reminders, and the approved limited eligible task stars shown immediately with text comments moderated by the owner. Do not create general public reviews or claim that a declaration independently proves customer receipt/payment.
8. No Micro fee, commission, wallet, escrow, payment, discount, or automatic Manage money/order/inventory change. Money arrangements remain directly between parties; the app records agreed statements only.
9. Ensure customer phone/address disclosure is blocked or controlled until the unresolved owner/legal consent requirement is satisfied. Use synthetic data only. Do not invent consent language or expose real customer data.
10. Implement expiry reminders without hard-coding an owner decision that does not exist: any suggested numeric reminder window must be configurable and labeled operational, not a settled product rule.
11. Add mobile-first Arabic RTL screens and all loading/empty/error/permission-denied/offline/retry/expiry/review states. Apply contract 26 for direct links and returning from every Delivery route.

Provide focused API/domain/UI tests for the complete driver lifecycle, owner-known-driver selection, no broadcast/fallback, exact state transitions and timers, private evidence denial across roles/accounts, expiry behavior, statement/objection behavior, contact-attempt guard, no auto-close on silence, PWA/API cache behavior, retries/idempotency, and no Manage side effects.

Commit Delivery separately.

## 10. Phase 6 — Integrated readiness review, tests, and report

### Review model

After both code paths are integrated, use exactly five non-overlapping read-only reviewers if the Z AI environment supports them: (1) OD/scenario traceability and product behavior; (2) Arabic RTL/mobile UX/accessibility; (3) domain/financial separation; (4) identity/authorization/privacy/D1/R2 security; (5) runtime, performance, migrations, tests, and handoff readiness. The main Z AI remains the sole writer. Reviewers must not edit, commit, run tests, or duplicate each other's source scans. Each returns confirmed findings separately from suggestions with severity, exact path/line, requirement/source, impact, and smallest safe fix. Fix confirmed in-scope defects; do not implement optional style suggestions as defects. Recheck affected scopes on the final candidate SHA. If reviewers are unavailable, state that and do not pretend review occurred.

### Tests and checks — do not waste runs

- Run targeted tests for each implementation wave once after that wave; do not rerun a passing suite unless code materially changes or a failure needs diagnosis.
- On the integrated final tree, run the repository-required `pnpm check` exactly once, plus any required security/secret check and Cloudflare local-emulation tests not included in that check. Do not install dependencies unless necessary and authorized by repository policy.
- If a fix follows final verification, rerun only the affected focused tests and the required final gate once. Never hide, skip, or relabel a failing required check. A mandatory check unavailable in the environment is `NOT_RUN`, not PASS.
- Wait for GitHub Actions on the exact final pushed branch SHA. Report each required check, exact SHA, conclusion, and URL/status identifier. Do not create a PR or merge. Do not run or trigger a production deployment. If a Pages preview check runs automatically, identify it as a preview/check only and do not claim production readiness.
- Preserve the current financial/local compatibility sentinels: `localSchemaVersion=41`, `localExportVersion=34`, the 29 accepted import pairs, bundle/lint limits, and all generated baselines. Do not adjust them to make checks pass.

### Owner acceptance KPIs (all required for `CODE_READY_FOR_CLOUDFLARE_SETUP`)

| KPI | Pass threshold | Evidence required in final report |
|---|---|---|
| Decision traceability | 52/52 OD IDs mapped to canonical section, implementation path, and test/evidence or explicit external blocker | 52-row matrix updated/linked; no approved decision omitted or contradicted |
| Mandatory product behavior | 100% of in-scope mandatory Market and Delivery scenarios in the canonical acceptance/traceability documents have passing evidence; zero unimplemented in-scope code requirements | Scenario IDs, test names, test result counts, candidate SHA |
| Authorization/isolation | 100% of required allow/deny cases pass; zero confirmed cross-account/role/resource access | Guest/vendor/owner/driver/admin matrix covering API, D1 query, search, and R2 object access |
| Private evidence | 100% unauthorized access tests deny; zero public driver-evidence objects/URLs | R2 local-emulation evidence and exact route tests; no real documents used |
| Manage non-interference | 0 financial or inventory semantic changes; 0 local schema/export/legacy-pair changes; 100% relevant Manage regression tests pass | Changed-path audit and explicit unchanged versions/pairs; tests and final diff summary |
| Mobile Arabic UX | All critical journeys pass at 360, 390, and 430 CSS-pixel widths in `ar-JO` RTL; zero horizontal overflow on required screens; zero unresolved blocker-level accessibility issue | Browser/test evidence, screen/route IDs, responsive and directionality results |
| Reliability/security | All required retry/idempotency/failure/migration tests pass; no confirmed Critical/High security finding; secret scanner passes | Command, counts, exact SHA, review findings and disposition |
| Repository checks | Focused wave tests pass; one final `pnpm check` passes; all applicable GitHub required checks pass on exact final SHA; zero required check silently omitted | Raw command, exit code, tested SHA, CI check status |
| Handoff completeness | Owner/Manus setup steps cover every required binding/secret name, D1 migration, R2 private bucket, OAuth callback, domains/origins, bootstrap admin, backup/restore, monitoring, cost guard, smoke/UAT, and rollback; no secret values | Ordered checklist with responsible party and evidence/acceptance per step |

If any KPI is not met, the status must be `BLOCKED` or `CODE_READY_WITH_GAPS`, never `CODE_READY_FOR_CLOUDFLARE_SETUP`. A passing code check does not prove a live Cloudflare-connected acceptance.

## 11. Required owner/Manus Cloudflare handoff

In the final report, provide a concrete ordered checklist—not a generic recommendation—of what the owner and Manus must do after your code work. Derive exact names and callbacks from the implemented source/config; never invent account/domain IDs. At minimum cover:

1. Confirm the existing Cloudflare Pages project/build root and whether the selected Pages Functions/Worker entrypoint is enabled for preview and production.
2. Create/bind the D1 database and apply the checked-in migrations first in a non-production environment, then after approval in production; record backup/restore and rollback commands.
3. Create/bind a private R2 bucket; verify no public access; set lifecycle/deletion/retention policy only after owner/legal approval; test authorized upload/read/delete and denied access.
4. Configure Google OAuth consent/client and exact callback/allowed-origin values from code; place client secret/session secret only in Cloudflare secret storage, never GitHub. Document how the first owner-admin is safely bootstrapped.
5. Configure environment bindings by name, CSP/CORS/origin and cookie settings, staging/production separation, and preview branch restrictions. No real configuration is performed by Z AI.
6. Explain the free-tier operating boundary, current expected incremental cost as `USD 0 only while staying within the applicable free allowances`, and the explicit stop-before-paid-upgrade rule. If a feature would require a paid plan, present the measured reason and wait for owner approval.
7. Run connected smoke/UAT with at least separate owner, vendor, and driver accounts on separate sessions/devices using synthetic data; test negative isolation, private file access, recovery, audit, and the approved Market/Delivery scenarios. Do not invite real drivers or use real documents before consent/retention/legal gates.
8. List any remaining owner decisions: customer-data disclosure/consent, retention/deletion/recovery policy, pilot participants/duration and rate-control values, driver/admin bootstrap/reviewer allocation, actual OAuth/domain values, and any paid-service request. Do not reopen the 52 settled product decisions.

## 12. Final report contract

Update the existing single report `docs/expansion/handoffs/zai-micro-market-delivery-2026-11-11/EXECUTION-REPORT.md`; do not create a competing report or replace earlier historical evidence. Add dated implementation sections and refresh its current conclusion/status. Write the owner-facing report in Arabic and retain exact paths, identifiers, commands, and raw statuses.

The report must include:

1. Repository, branch, base/merge-base SHA, final full SHA, clean/dirty state, and each separate commit SHA.
2. W05 owner acceptance, legal Control transition, `DOC-032`/`WS-248` state, exact `verified_on_main_sha` if applicable, and the accepted report/check evidence; explicitly say no redundant W05 rerun was done.
3. The independent implementation map and readiness table for 52/52 decisions plus mandatory scenario traceability; mark implemented, blocked, deferred, or not applicable with exact evidence.
4. The Cloudflare architecture choice and its repository implementation: Pages/Functions or justified alternative, D1 migrations/bindings, R2 private paths, Google OIDC/Micro roles, configured-vs-unconfigured distinction, free-tier guard, and why no Supabase/Cloudflare Access end-user auth was added.
5. A short change inventory by commit and exact path, plus explicit `NO_MANAGE_FINANCIAL_MIGRATION`, `NO_PAID_UPGRADE`, `NO_PROVIDER_ACCOUNT_ACCESS`, `NO_PRODUCTION_DEPLOYMENT`, and any valid exception.
6. The results table for every KPI in Section 10: threshold, actual result, PASS/FAIL/NOT_RUN/BLOCKED, exact evidence, and unresolved caveat. Never assert 100% from an aggregate command alone if the route/scenario evidence is missing.
7. All focused/full tests, build/checks, security scans, reviewers, and CI evidence with commands, counts, exit codes, exact SHAs, and actual results. Distinguish tests run locally from GitHub checks and from connected Cloudflare tests not run.
8. Any confirmed defects and fixes; separate optional suggestions; residual risks; rollback boundary per commit; no invented test results.
9. Ordered owner/Manus Cloudflare handoff from Section 11 and the connected UAT acceptance criteria.
10. Deferred unrelated findings from the scan/report (for example stale documentation, unrelated Manage export privacy, or validator portability) clearly marked for the existing Other Issues follow-up after Market/Delivery; do not implement unrelated fixes or modify the frozen reference snapshot.
11. One next action and one final evidence-backed status.

## 13. Stop and status rules

Stop and report the precise blocker before the affected change if any of these occurs: state/worktree collision; active overlapping claim; structural refactor/new application boundary required; a required paid service; no safe Google session/auth approach compatible with Workers; unresolved critical privacy/legal disclosure/retention choice affecting live data; test or security gate failure that cannot be fixed safely; product/financial ambiguity; or an operation would access a provider account, change a provider resource, deploy, touch `main`, open a PR, merge, or rewrite history.

Do not call the product `live`, `connected-accepted`, `pilot-ready`, or `production-ready` until the owner/Manus has configured Cloudflare/Google, completed two-or-more-account connected tests on separate sessions/devices, and passed all applicable activation gates. The expected best-case final status here is `CODE_READY_FOR_CLOUDFLARE_SETUP — LIVE_CONNECTED_ACCEPTANCE_PENDING`.

At the end, push the separate commits to the existing handoff branch if safe, provide the branch and report links, all requested evidence, every KPI result, remaining owner/Manus actions, and one next action. End with exactly one status:

- `CODE_READY_FOR_CLOUDFLARE_SETUP — LIVE_CONNECTED_ACCEPTANCE_PENDING`
- `CODE_READY_WITH_GAPS — <specific gaps>`
- `BLOCKED — <specific cause>`
- `STATE_DRIFT — <specific cause>`

**NO_CLEANUP:** Do not delete, rename, or reorganize any repository file outside the exact authorized additive changes and necessary canonical documentation updates described above.
