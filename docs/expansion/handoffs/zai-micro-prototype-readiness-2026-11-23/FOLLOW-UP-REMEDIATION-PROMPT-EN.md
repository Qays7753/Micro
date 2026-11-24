# Z AI — Micro Follow-up Remediation for Limited-Live-Pilot Code Readiness

**Status:** Owner-requested execution prompt, prepared 2026-11-24. This is the successor to the completed `OPEN-FINDINGS-AND-PROTOTYPE-CODE-PROMPT-EN.md` for the follow-up items below only. It does not authorize deployment, database work, or real-data use.

## 1. Mission and authority

Continue code remediation on the existing repository and the existing dedicated branch only:

- Repository: `https://github.com/Qays7753/Micro`
- Branch: `manus/zai-prompt-open-findings-20261123`
- Recorded remote head at prompt preparation: `e2b82afd1f721f1847c83beade8fa3ca01f1fbba`
- Last code commit at prompt preparation: `fe2b1b5a0676373a5c1078278733d34efbc944cc`
- Recorded `main`: `5a9064e657a40041ebe63c8f107d57a802f6b93f`

These SHAs are preflight hints. Verify the live repository, refs, PRs, worktree, stashes, processes, Operations Control state, and the latest report before changing anything. Preserve all work. Never reset, clean, force-push, rewrite history, or change `main`. If the live state differs, report `STATE_DRIFT`, preserve it, and continue only where safe and unambiguous.

The owner’s current product strategy is a limited trial on the actual Micro system with selected partners, followed by gradual expansion; the owner does not want a separate Preview environment. That decision is **not** authorization to change Cloudflare, Neon, R2, production bindings, database schema/data, deploy, or use real data. This task is code-only readiness work and ends at owner review.

## 2. Authoritative sources — read before changes

Read the current versions on the live branch of:

1. `AGENTS.md`, especially its Operations Control, post-Group-6 scan, and security-continuity sections.
2. `docs/operations/current-state.md`, `docs/operations/control/generated/AGENT-BRIEF.md`, `docs/operations/control/generated/ACTIVE-WORK.md`, `docs/operations/control/README.md`, `docs/operations/control/authority-map.md`, `DOC-044`, and `WS-254`.
3. `docs/expansion/security-findings-status.md` and the prior report `docs/expansion/handoffs/zai-micro-prototype-readiness-2026-11-23/EXECUTION-REPORT-AR.md`.
4. The source-pinned security audit, if available to you. If it is not available, say so; use the repository mirror and the owner-reviewed report `Micro — مراجعة فرع ZAI وتجهيز التجربة الحية المحدودة 2026-11-23.md` as supporting context, not as a replacement for the source audit.
5. The exact Q270 text in `docs/product/decisions/questions-293.md`, relevant financial/network contracts, existing request-body limits/tests, bundle/precache checks, and CI workflow.
6. The owner-reviewed post-Group-6 scan and decisions under `docs/architecture/refactoring/post-group6-scan-20261123/`.

Use the recorded review as a starting point, not as a substitute for live source inspection. The review identified `SRV-02`, `MNG-LOCAL-02`, and `MNG-LOCAL-06` as still open on `fe2b1b5a`, and identified a failed Pages build on `e2b82afd`. Verify each against the actual current tree before relying on it.

## 3. Operations Control and agent limits

Before code changes, inspect for overlaps and make the existing Workstream legal under repository rules. The current record at prompt preparation is `DOC-044 = IN_REVIEW` and `WS-254 = IN_REVIEW`. Reopen/continue that claim with the new evidence if Operations Control permits; otherwise create a properly linked successor item/claim on this same branch, with no area/contract overlap. Do not hand-edit generated Operations Control files. If an active conflicting claim cannot be resolved safely, stop and report it before touching overlapping files.

Use one primary implementation agent. At most one additional agent may perform a read-only final review on the exact final candidate; no parallel writers and no broad multi-agent fan-out.

Provide brief Arabic progress updates at meaningful milestones. Updates are informational and must not pause execution or request routine approval.

## 4. Authorized implementation scope

Implement the smallest root-cause fixes and regression coverage for the following:

### A. `SRV-02` — bounded streaming request-body reads

The current issue is not solved by checking `Content-Length` alone or by checking `text.length`/`arrayBuffer.byteLength` after buffering. Enforce a hard **byte** limit while consuming the request stream, stop/cancel reading as soon as the byte cap would be exceeded, and retain `Content-Length` only as an early-rejection hint.

Audit every request-body consumer, including JSON routes, idempotency/hash wrappers, Manage migration envelopes, and raw media uploads. Preserve the intentionally larger documented migration envelope only where needed; ensure it too has a hard streaming ceiling. Do not introduce a second unbounded clone/read path. Preserve current validation, error-code, authentication, rate-limit, and business behavior except the resource-exhaustion fix.

Add focused tests that demonstrate at minimum: declared oversize rejected before body consumption; missing/lying length and chunked streams are capped during streaming; byte-counting is correct for multi-byte text; the stream is cancelled/closed at the limit; and representative JSON, command/idempotency, migration, and media paths cannot bypass the cap. Include boundary sizes and ordinary valid requests.

### B. `MNG-LOCAL-02` — enforce Q270 exactly

The reviewed code currently treats `503 network_not_configured` as proof that local financial saving is allowed. That conflicts with the owner-approved Q270: financial saving requires connectivity; no financial write while offline; show the truthful “لم يُحفظ” state and keep the user’s entered values in the form.

Correct the classification and all affected write paths so an absent backend, unknown/stale online mode, offline state, failed mode read, or unavailable server cannot silently fall back to a local financial write. Preserve the form contents and return an explicit non-saved outcome. Cover the `503 network_not_configured` case specifically, along with relevant fetch/network failures and stale state, and ensure non-financial behavior changes only if Q270 or another approved contract requires it.

Do not change amounts, calculations, posting rules, or financial record meaning. This is enforcement of the existing owner decision, not a new financial policy. If exact Q270 scope or a contract materially conflicts with this instruction, stop only that change, document the precise conflict, and continue independent work.

### C. `MNG-LOCAL-06` — limits and honest device evidence

Review the existing size, depth, family-count, and total-record limits and their tests. Keep or strengthen bounded checks only where the code shows a concrete gap and the fix is within this task. Do not increase limits or move work to a new architecture layer without evidence and approval.

Do not claim the finding is closed without a measurement on the actual lowest-spec supported physical device. If such a device is not available to you, keep the finding `open`, mark the physical-device measurement `NOT_EXECUTED`, and provide a short, reproducible owner-side measurement procedure and the exact device/browser/build details required. Do not substitute browser emulation, a desktop run, or CI timing for physical-device evidence.

### D. Failed Pages precache/bundle check

The reported Pages check on `e2b82afd` failed before deploy: actual precache total `3,151,638` bytes versus baseline `3,151,606` bytes and an 8-byte allowance. Diagnose the exact source and current live check before changing anything.

Fix the actual cause with the smallest safe change (for example, reduce/avoid unnecessary generated bytes or correct a demonstrable measurement defect). Do **not** lower a budget, widen tolerance, update a baseline to hide the regression, disable the guard, or remove essential/security/product behavior merely to make the build green. Measure again with the repository’s canonical build/check commands and report before/after byte counts. If the only possible fix requires a product or owner tradeoff, report the alternatives and continue other independent work.

### E. Other defects found during this work

Fix any additional concrete defects that are directly in the affected request-body, financial-save/offline, import-resource, or build/CI paths, and any new test/CI failure caused by your changes. Diagnose root cause; do not mask checks or alter baselines to manufacture success. Do not expand into a general cleanup or unrelated backlog. Report unrelated/pre-existing failures separately with exact evidence.

## 5. Hard exclusions and safety boundaries

- `MNG-LOCAL-03` remains technically open and `deferred-by-owner`. Do not add encryption, invent key management/recovery, change local storage/export format, or reclassify the finding as fixed.
- No production or Preview database access, SQL, schema inspection, migrations, backup creation, restore, DB/R2/API writes, or reading user rows/objects.
- No real or partner data. Use synthetic fixtures only in automated tests.
- No Workers AI/Gemini/other provider configuration, requests, credentials, or paid fallback.
- No Cloudflare/Neon/R2 setting or binding changes, manual deploy/retry, production promotion, Preview testing, PR creation, merge, branch deletion, or cleanup.
- No direct `main` changes. No unrelated security-finding closure from a green CI run alone.
- No structural refactor, bulk moves, or code organization changes outside an owner-approved post-Group-6 wave. The structural scan gate remains in force. Do not hide behavior, financial, schema, or export-format changes inside a structural patch.
- No secrets in repository files, prompt, chat, command output, screenshots, or reports. If authentication is needed, use Z AI’s secure credential field only (`GITHUB_ACCESS_TOKEN=<SECURE_SECRET_FIELD_ONLY>`); never paste or echo a token.

### Prevent a separate Preview

The latest owner decision is **no separate Preview**, and the existing Preview binding was found to point at the only Neon branch named `production`. Therefore no commit from this feature branch may create or refresh a Cloudflare Pages Preview.

Use the repository’s already documented `[CF-Pages-Skip]` commit-message convention on every commit pushed to this feature branch. This applies to this branch only; it does not authorize adding the prefix to any future `main` merge/deployment commit. Do not change Cloudflare settings. If you cannot reliably ensure that the push will be skipped, do not push: preserve the local work, finish code/tests, and report the exact blocker for owner review. If a Pages run nevertheless appears, do not retry or interact with it; report its URL/ID/source SHA and stop any operation that could reach its bindings.

## 6. Execution and verification sequence

1. **Preflight:** verify branch/base/head, PR state, repository rules, clean/dirty worktree, active work, and the exact current failed checks. Do not reset or overwrite anything. Record the first incomplete action.
2. **Implement `SRV-02`:** write regression tests, implement streaming byte caps across all body-read paths, then run only the directly affected tests and required guards. Record commands and results at this stage.
3. **Implement `MNG-LOCAL-02`:** write regression tests for Q270 behavior, fix the root cause across financial write paths, and run the focused tests/guards affected.
4. **Review `MNG-LOCAL-06`:** perform only evidence-supported code work; mark physical device measurement honestly as `NOT_EXECUTED` if unavailable.
5. **Fix the Pages build issue:** reproduce using the canonical local build/check path, fix root cause without weakening the gate, and verify the exact resulting measurement.
6. **Final candidate:** review the diff for scope, security, financial semantics, schema/export effects, generated artifacts, and accidental secrets. Run one final repository CI/check gate on the exact integrated final code SHA, reusing prior successful checks only where the exact tree and SHA are unchanged. If a check fails, diagnose and fix the root cause; rerun affected checks and the final gate on the new final SHA as necessary. Do not claim passing without actual output.
7. **Push once, only after the local final gate:** commit/push only to `manus/zai-prompt-open-findings-20261123`, with the required `[CF-Pages-Skip]` prefix so no Preview is created. If this cannot be guaranteed, do not push. Never create a PR or merge.
8. **Handoff:** update the safe 30-finding mirror and Operations Control source records; generate/validate their views using the repository’s canonical tools. Add one Arabic follow-up report at `docs/expansion/handoffs/zai-micro-prototype-readiness-2026-11-23/FOLLOW-UP-REMEDIATION-REPORT-2026-11-24.md`, and add it to `docs/00-document-index.md` using the next available 12-series identifier. Do not overwrite the earlier prompt or execution report.

## 7. Acceptance and stop conditions

Deliver a code candidate on the same feature branch, with focused regression evidence for each code fix, a truthful Pages-size result, and the final required CI/check evidence. If a no-preview push cannot be guaranteed, deliver the preserved local diff and stop without pushing. Leave unresolved physical-device or owner-only items open; do not wait on the owner for routine coding decisions that are already settled.

Stop and request a decision only if an implementation requires a new financial meaning, data-retention/privacy policy, schema/export-format change, structural wave outside accepted scope, a live provider/environment write, or a tradeoff that cannot be resolved from approved contracts. Continue safe independent tasks and report the blocker precisely.

Do not describe the prototype as live-ready or approved for partner data. This is code-readiness work only; live trial steps remain subject to Manus’s separate read-only environment review and the owner’s exact authorization for any Cloudflare/Neon/R2 change, migration, deployment, or real-data operation.

## 8. Final report contract

Report in Arabic and distinguish `VERIFIED`, `INFERRED`, `UNVERIFIED`, `NOT_EXECUTED`, `DEFERRED`, and `BLOCKER`. Include:

- repository, branch, `main` SHA, starting/final full SHAs, PR state, and any state drift;
- changed files and commits; whether push occurred, and evidence that Pages was skipped or that no push was made;
- one row for each of all 30 security findings, with exactly one status (`open`, `fixed-verified`, `deferred-by-owner`, or `not-applicable`), evidence on the final SHA, test evidence, and residual risk; `MNG-LOCAL-03` stays `deferred-by-owner` and technically open;
- for `MNG-LOCAL-06`, explicitly state whether a lowest-supported physical device was tested; never imply emulation is equivalent;
- exact commands, exit codes, counts, CI run URLs, and SHAs for tests/checks actually run; distinguish local checks, GitHub CI, and Pages status;
- the diagnosed Pages-size root cause and before/after bytes; never claim success if the check was not run;
- evidence-based financial/domain, privacy, schema/export, and structural impact; call out any behavior change and its existing owner decision;
- all other concrete findings, fixes or dispositions, and what was not done;
- rollback boundary per commit/wave, remaining owner/Manus actions, and why this report does not authorize a live trial.

Stop at this handoff. No PR, merge, deployment, Preview, production/DB change, real-data use, or cleanup.
