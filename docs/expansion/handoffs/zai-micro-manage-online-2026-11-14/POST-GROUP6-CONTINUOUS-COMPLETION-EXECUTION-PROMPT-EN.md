# Z AI — Micro Remaining Software Completion — Execution Prompt

**Status:** Owner-authorized continuous execution for remaining, explicitly specified software work (2026-11-21). This is the controlling successor for the next Z AI run. Earlier prompts and reports are historical evidence and must not be overwritten.

**Repository:** `Qays7753/Micro`
**Only write branch:** `zai/micro-manage-online-20261114`
**Pre-publication branch-head hint:** `efa5df84e164a9abcaaae0c2135577e6756d170b` (documentation/control-only checkpoint). This prompt/index publication may add a later documentation-only commit.
**Latest reported code-tested SHA:** `61fabca9a131eaf785a954c36c7c4edad2883af5`; CI run `44928224134` was reported successful on that exact code SHA. This is evidence to verify and reuse only if the code tree and relevant test inputs remain unchanged.
**Read-only decision source:** branch `docs/micro-final-decisions-20261121`, observed at `b04ba6efb634e89a06ee23c7a62dab33ae8c6081`; PR #385 is open against `main`. Verify live. Read only; do not modify, retarget, approve, or merge it.

## 1. Mission, authority, and execution cadence

Continue implementation on the existing branch from its actual live state. The owner explicitly authorizes Z AI to execute all remaining safe, specified software work continuously, without routine approval pauses, intermediate review requests, or waiting for the owner between waves. Do not ask the owner to inspect a proposed structure or approve ordinary code/UI choices. Send brief Arabic progress summaries only at meaningful milestones; they are informational and must never pause work.

This authorization covers only the software/documentation scope in this prompt. It does not accept previous or current work, set Operations Control to `VERIFIED`, approve a release, or authorize a PR, merge, `main` change, deployment, live provider/database write, real-data use, spending, or cleanup. If a decision with material financial, privacy, security, legal, destructive, or product meaning is genuinely unresolved, do not guess: mark only the affected slice `BLOCKER`/`DEFERRED`, record the exact missing decision, and continue every independent authorized slice. Use one writer/integrator; do not launch a large agent fan-out or parallel writers.

The purpose is to finish all remaining implementation that is already specified and safe, not to repeat M1–M6 or the completed W0–W5 work. Reports are checkpoints, not proof of the current tree. Verify each claimed completion against live files/tests before relying on it.

## 2. Mandatory live-state preflight — preserve before writing

Before any edit:

1. Inventory the current Z AI workspace and relevant existing files; inspect repository URL, branch, local/remote full SHAs, `main` SHA and merge base, worktree/untracked/stashed changes, active Z AI jobs/writers, open PRs, recent Actions, and the current Operations Control source records. List the relevant files and actual state briefly; do not dump the whole repository or repeat the 293-question review.
2. Fetch/read the actual remote state and compare it with the hints above. The expected branch may now contain this prompt/index publication commit. Preserve all work and continue from the actual remote head. Never reset, clean, rebase, force-push, rewrite history, prune branches, reclone over a worktree, overwrite another writer, or stage unrelated/untracked files. If another writer is active or state differs materially, record `STATE_DRIFT`; pause only the affected write until safe, while continuing independent read-only/reconciliation work.
3. Verify the prior CI run `44928224134` and its SHA `61fabca9a131eaf785a954c36c7c4edad2883af5`. Do not rerun it if the code/test tree is unchanged. Do not describe a documentation-only head as newly code-tested. Any new code change requires affected focused checks; the final candidate requires the final gate specified below.
4. Inspect `docs/operations/control/` and its generated views. The latest report records DOC-041 `IN_REVIEW` and WS-251 `REVIEW_REQUIRED`; verify the live JSON first. The owner’s current message authorizes this continuous software continuation, not acceptance. Use only legal Operations Control transitions to reopen/activate the existing scope before code, updating JSON sources and regenerating views. Do not mark DOC-041/WS-251 accepted, merged, or `VERIFIED`. If a valid transition is impossible, do not bypass the validator or make an overlapping claim; record the Control blocker and continue independent read-only/reconciliation work.
5. PR #385 and its decision branch are read-only. Do not change that PR or branch. Do not write to `main`.

### Post-Group 6 structural gate — absolute for this task

Do **not** begin structural refactoring, bulk file moves, code-organization changes, module reorganization, oversized-file splitting, or a new generic architecture layer. The project-level owner instruction requires a read-only comprehensive Structure/Architecture/Code Organization Scan followed by the owner’s review and acceptance before any structural work. A separate 2026-11-21 scan report is preserved in the Z AI workspace and is not to be staged, published, rewritten, reconstructed, or deleted. Its earlier accidental appearance in Git history does not authorize re-publication or history rewriting.

`AGENTS.md §11` describes an earlier 2026-09 scan and an older accepted plan. It does not satisfy or override the current project-level gate for the separate 2026-11-21 scan. Until the owner has reviewed and accepted the current findings, classify any fix that requires structural work as `DEFER` and keep the scan itself untouched. Continue non-structural, minimal, behavior-preserving fixes without waiting for that review.

## 3. Required sources — read current versions, then work narrowly

Follow `AGENTS.md` and its authority order. Read the applicable current versions of:

- `AGENTS.md`; `docs/operations/current-state.md` (main-based status only, not proof of feature-branch state); `docs/operations/micro-thinking-charter-v1.md`; `docs/operations/agent-handoff-protocol-v1.md`; `docs/operations/control/README.md`; `docs/operations/control/context.md`; `docs/operations/control/generated/AGENT-BRIEF.md`; and `docs/operations/control/generated/ACTIVE-WORK.md`.
- `docs/expansion/handoffs/zai-micro-manage-online-2026-11-14/POST-GROUP6-REMEDIATION-EXECUTION-PROMPT-EN.md`, `POST-GROUP6-REMEDIATION-REPORT-2026-11-21.md`, and `POST-GROUP6-REMAINING-WAVES-REPORT-2026-11-21.md` (historical checkpoints; do not overwrite them).
- On the read-only decision branch, verify the live head and read `docs/product/decisions/final-decisions.md` and `docs/product/decisions/gap-analysis.md` using read-only Git operations. These carry owner decisions and the repository mirror of the security register. Do not merge/cherry-pick this branch.
- The project-shared source `Micro — تقرير التدقيق الأمني 2026-11-19.md` is the source-pinned security register. Read it if available in this Z AI context. If unavailable, use the complete repository-accessible mirror in `gap-analysis.md §4`, state that limitation, and do not claim to have read the unavailable file. Do not copy the full private/shared audit into the repository.
- The existing approved feature specifications, contracts, scenario matrix, source code/tests, and UX KPI matrix at `docs/expansion/handoffs/zai-micro-manage-readiness-2026-11-14/evidence/UX-KPI-MATRIX-2026-11-14.md`. Read only the relevant material required for each slice; never use historical reports as authority over current contracts/owner decisions.

The owner’s current Ask Micro requirements in §5 below supplement earlier decisions. Where an exact role-removal, Admin-operation, retention, security, or product rule remains unspecified, do not invent it.

## 4. Scope — complete only verified, still-open software work

First reconcile G01–G14 and the 30 security findings against the actual branch and tests. Build a short status-to-path/dependency map; do not repeat broad discovery or redo work already verified on the current tree. Then execute the following only where implementation is both incomplete and supported by an approved source:

- **G01 — role lifecycle:** the remaining role-removal, supplier-listing archival, active-driver-booking protection, and owner-account export/delete flows are not automatically authorized by the phrase “continue to completion.” Implement only behavior explicitly specified in owner-approved decisions/contracts. Never silently delete financial/history data or invent cancellation, retention, or recovery semantics. Non-destructive, fully specified portions may proceed; unresolved destructive transitions remain blocked and do not stop independent work.
- **G02 — Platform Admin:** implement only the explicitly defined Admin queues/search/actions. Enforce server-side least privilege and audit; Admin must not gain Manage financial access by default. MFA verification on the Google/Admin account is an operator check, not something to claim from code. Do not invent suspension, cancellation, impersonation, or data-access powers.
- **G03 — Ask Micro:** build only provider-neutral, mock-testable software that is supported by §5. Do not choose, benchmark, connect, configure, call, or pay any AI provider now. The owner wants to discuss the provider after Z AI has begun implementation; do not wait for that discussion to do independent work.
- **G04, G05, G06, G08, G09, G10:** the latest report marks their in-scope behavior implemented (Market, Delivery, sessions, contextual links, best-effort Web Push, and core transactional/idempotency paths). Verify current code/tests and preserve it. Do not redo or broaden it; fix only a concrete regression or remaining gap proven against the governing requirement.
- **G07 — recipient data:** preserve the implemented consent/access/cancellation/48-hour rules. Legal retention and database/backup deletion remain operator/legal gates. Synthetic tests are allowed; do not configure or run a live retention/deletion/backup job.
- **G11/G12:** R2/Cloudflare configuration and live test-database separation are later operator tasks. Do not call provider APIs or inspect/change live resources here; keep them explicitly `UNVERIFIED`/operator-owned.
- **G13 — no automatic financial effect:** add/complete a focused synthetic integration test proving Market/Delivery/Ask Micro cannot create or alter Manage financial records without the owner’s explicit confirmation through the normal financial flow and server acceptance. Do not introduce financial writes or change financial meaning while adding the test.
- **G14 — membership:** preserve the one-owner/no-member-invitation boundary; do not add invitations or delete membership schema absent a separate accepted structural/product decision.
- **UX:** for genuinely changed flows only, use the existing page/component KPI inventory and preserve prior evidence. Keep text direct and concise, make the primary action and priority/order obvious, preserve necessary safety/price/status/consent/recovery notes, and avoid unnecessary system-level text. Use RTL/mobile behavior. Keep WCAG 2.2 web minimum criteria separate from Micro comfort targets (24×24 CSS px minimum criterion where applicable; 44×44 comfort targets and 48×48 primary actions). No dark-mode feature or global token/color redesign. Do not claim all 73 pages/71 components were re-audited unless they actually were. Capture representative before/after screenshots for modified critical journeys only where tooling permits; otherwise report `NOT_RUN`/`UNVERIFIED` honestly. Human usability results remain `NOT_MEASURED` unless people tested them.

For all G groups, use existing reports only as a starting point. Report what is `VERIFIED`, `PARTIAL`, `NOT_EXECUTED`, `DEFERRED`, `UNVERIFIED`, or `BLOCKER` with current-branch evidence; do not force every group to “complete” when an owner/operator decision remains.

## 5. Binding Ask Micro behavior — provider not selected

Ask Micro is a required eventual Micro surface, but its AI provider is deferred. Implement and test provider-neutral contracts/UI/mocks only; keep its real runtime state truthful as `not configured` wherever an actual model is required. Do not claim the product is AI-ready or launch-ready.

1. Ask Micro may answer only from data the signed-in user is authorized to access in the explicitly selected role/project/workspace. Retrieve only the minimum required fields/aggregates through approved server/application services; never send a whole database, cross-workspace data, or unauthorized personal/financial information to a model.
2. Financial facts and calculations must come from the application’s trusted domain/server results, not model arithmetic, guesses, or invented values. State the time period, source, assumptions, and uncertainty where the existing contracts require it.
3. If a message implies “record/sell/register this,” Ask Micro may propose a typed, editable draft form/card with clickable controls. It must not decide missing quantity, price, date, party, or other values; unknown required values stay visibly unknown/blank and require user input. The proposal is not a saved transaction.
4. No financial/operational record may be written directly by a model or merely by producing a suggestion. A write is permitted only after the user reviews and explicitly confirms the completed draft through the normal approved application financial flow, and the server accepts it. Show success only after server confirmation. Cancel/edit must remain possible before confirmation. No last-write-wins or false “saved” state.
5. Add mock/contract tests proving: authorized read scope only; no answer from unauthorized data; no guessed financial values; no write before explicit confirmation; no write on cancellation, rejection, timeout, or server failure; and a successful write can occur only via the existing canonical use case after server acceptance.
6. Do not decide the provider, privacy terms, retention of chat history, daily usage cap, spending cap, or fallback-to-paid behavior. Those remain for the owner/Manus provider discussion after implementation has started. No live model calls or real-data evaluation in this task.

## 6. Security register continuity — all 30 rows remain visible

The source audit is pinned to the 2026-11-19 report and its three branch SHAs; those SHAs are not current code proof. Preserve and reconcile every finding individually, including those outside the slice. IDs:

`MNG-LOCAL-01`, `AUTHZ-01`, `AUTHZ-02`, `MD-01`, `MD-02`, `SRV-02`, `SRV-03`, `MD-03`, `SRV-05`, `SRV-06`, `MD-04`, `MD-05`, `SRV-07`, `WEB-01`, `API-01`, `MNG-LOCAL-02`, `MNG-LOCAL-03`, `MNG-LOCAL-04`, `PUBLIC-DRIVER-PROFILE`, `AUTHZ-05`, `AUTHZ-04`, `DEP-001`, `DEP-002`, `CI-001`, `SEC-GIT-001`, `CI-002`, `WEB-02`, `AUTH-03`, `MNG-LOCAL-05`, `MNG-LOCAL-06`.

**Required count correction:** the W1 checkpoint table actually contains **12** `fixed-verified` rows, although its summary says 11. The later report lists 17 additional closures. The reconciled expected arithmetic is therefore **12 + 17 = 29 fixed-verified, plus 1 open (`MNG-LOCAL-03`)**. Verify every row and its direct evidence; do not propagate the old “11” summary. Do not rewrite either historical report. Record the discrepancy and the corrected, row-by-row reconciliation in a new dated final report.

For each of all 30 rows, assign exactly one current state: `open`, `fixed-verified`, `deferred-by-owner`, or `not-applicable`. `fixed-verified` requires (a) the fix is present on the final candidate full SHA, and (b) direct test evidence exercises the risky behavior. Record finding ID, relevant file/line, direct test and command, result/run URL when available, tested full SHA, and evidence that the fix/test remain present on the final candidate. Reuse existing trustworthy direct-test evidence if the relevant code/test tree is unchanged; do not rerun broad tests redundantly. If evidence cannot be tied to the candidate, do not close the row. Green CI alone is never closure. `deferred-by-owner` requires a specific dated owner decision; otherwise leave the finding `open`. `not-applicable` requires evidence and scope reasoning.

`MNG-LOCAL-03` (local device/encryption policy) remains `open` unless the owner makes a separate explicit decision. Do not invent cryptographic/device policy or change local storage/export formats. Keep provider/environment/operator findings visible and `UNVERIFIED`; do not use them to claim release readiness. No deployment or real-data approval is part of this work, so do not claim a release-blocking recheck has occurred.

## 7. Forbidden actions and write boundary

- The only Git write destination is `zai/micro-manage-online-20261114`. No new branch, PR creation/change, merge, re-merge, `main` write, branch deletion, force-push, history rewrite, pruning, or cleanup. Commit/push only fast-forward. Every pushed commit message must start exactly with `[CF-Pages-Skip]`; verify the target and prefix before each push. If the skip safeguard cannot be relied upon or a preview deployment appears, stop further pushes and report it; do not change Cloudflare settings.
- No Cloudflare/Pages/Workers, Neon/PostgreSQL live, R2, OAuth, or other provider API calls/settings/resource/schema writes. No live database, migration application, real-data read/write/transfer, backup/restore, deployment, or cleanup. Repository migration files and disposable local PostgreSQL tests with synthetic fixtures are allowed.
- No AI-provider connection/configuration/model call/evaluation and no spending. No credentials in prompts, code, shell arguments, logs, commits, screenshots, or reports; use secure credential fields only if later explicitly authorized.
- No structural work as defined in §2. No dark-mode/global design-token change. No hidden financial/product/legal semantic changes.
- Do not modify the source-pinned security audit, earlier execution prompt, earlier checkpoint reports, PR #385, or the preserved scan report.

## 8. Execution and verification — continuous, narrow, token-aware

1. Reconcile live state, legal Operations Control claim, G01–G14, and all 30 security rows. Record the first incomplete actions and dependencies. Do not start code until a valid claim exists and the exact non-structural scope is clear.
2. Work through small, independent, non-structural implementation waves. Add a focused regression test with each code change. After each wave, run the smallest meaningful tests/type checks/guards and record command, result/count, and full candidate SHA. If one item is blocked by a genuine owner/operator/legal decision, mark it precisely and continue all independent work.
3. Avoid repeating a successful test on an unchanged tree. Never weaken/skip/re-anchor/inflate a guard or baseline to make a check pass. Any needed baseline change must follow its documented protocol and remain within owner-approved scope; otherwise defer it.
4. At the end, inspect CI workflow definitions. Run the complete non-deploying repository gate once on the final code candidate (prefer one test-only `ci.yml` dispatch on its exact full SHA if available; otherwise run the complete local `pnpm check` once). Never run a deployment/publish workflow. Re-run only checks affected by a later code change. Separate code SHA from later docs-only commits in the report.
5. Do not update `docs/operations/current-state.md` as though feature-branch work were merged to `main`. Update Operations Control JSON sources and regenerate/validate generated views according to project rules. Record branch execution evidence in the report and Control. Do not hand-edit generated files.

## 9. Acceptance and final report

Finish all safe, specified in-scope work without routine owner pauses. Do not describe unresolved owner/operator/legal decisions as complete. Create a **new**, separate Arabic report in the same handoff directory using the actual completion date, e.g. `POST-GROUP6-CONTINUOUS-COMPLETION-REPORT-YYYY-MM-DD.md`. Do not overwrite either previous report. Add the new prompt/report paths to `docs/00-document-index.md` as repository conventions require; update Operations Control from JSON sources, regenerate views, and run its validator.

The report must include:

- repository, exact branch, base/full final code SHA, later docs-only head if different, source/target state, PR #385 read-only status, and Operations Control legal transitions;
- a concise G01–G14 table with actual status, current evidence, remaining blockers, and the party responsible for the next action;
- all 30 security findings exactly once with status, direct evidence and tested/full final SHA; explicitly correct the 12+17+1 count discrepancy;
- changed files/commits, rollback boundary per code wave, local schema/export and migration impact, financial/privacy/security impact (or evidenced no change), and writes explicitly not performed;
- each test/check/CI command, result/count, exact full SHA, Actions run URL, failures and corrections; distinguish a code-tested SHA from docs-only commits;
- Ask Micro provider-neutral implementation and safety-test evidence, while stating no provider was selected/connected/called and no real data used;
- affected UX KPI rows and before/after evidence, or honest `NOT_RUN`/`UNVERIFIED`/`NOT_MEASURED` limitations;
- operator/legal/provider steps still outstanding (including G11/G12, MFA, retention, MNG-LOCAL-03, real-data gate); no false claim of release readiness;
- the preserved scan report and its history incident without re-publishing it; all PR/merge/main/provider/database/deployment/real-data operations not performed; and the exact next owner/operator action.

Use `VERIFIED`, `INFERRED`, `UNVERIFIED`, `NOT_EXECUTED`, `DEFERRED`, and `BLOCKER` precisely. Keep DOC-041 at the valid review state and WS-251 at its valid owner-review state after execution; do not mark either accepted or verified on the owner’s behalf. Stop after the final code/documentation handoff on the existing branch. No owner acceptance, PR, merge, `main` change, deployment, live provider write, real-data activity, or cleanup is included. `NO_CLEANUP`.
