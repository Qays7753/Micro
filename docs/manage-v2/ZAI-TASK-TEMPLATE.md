# ZAI Task Template — Manage v2

> **How to use:** the full instruction lives in the repository (this file's sections copied into a task prompt under `docs/manage-v2/tasks/`), and the owner sends ZAI only a short launcher naming the path. One phase at a time. Never all phases at once.
> **Language:** the prompt body is English (Z AI working language); owner-facing reports stay Arabic.

---

## TEMPLATE (copy from here)

### 0. Header

- **Task id:** `M<phase>.<n>` — `<short title>`
- **Phase:** `<phase number and name>` (see `docs/manage-v2/PLAN.md`)
- **Spec:** `docs/manage-v2/micro-manage-spec-final.md` **v1.1** (binding). UX: `docs/manage-v2/micro-manage-ux-final.md`. Impact: `docs/manage-v2/IMPACT.md`.
- **Branch:** `feature/manage-v2` only. `main` is forbidden.
- **Base:** verify live; do not trust the SHA written here.

### 1. Live-state preflight (do this first, report it)

1. `git fetch` and report: current branch, `git log -1 --format=%H`, `git status --short`, untracked files, stashes.
2. Read `docs/manage-v2/TRACKER.md` and report the exact status of this task and of the previous task in the same phase.
3. If the working tree is not clean or the state differs from the tracker, **stop and report `STATE_DRIFT`**. Never reset, checkout, clean, or overwrite existing work.
4. Confirm the spec version constant in code matches `1.1` (once it exists).

### 2. Context

Micro Manage is being rebuilt from scratch as a **fixed double-entry ledger** inside the Micro monorepo. All old Manage financial code is being deleted. You implement only what this task names. The ledger is the only way any number changes: entry types `Q1`–`Q20` (§4), per-entry balance rule (§3.8), invariants `I1`–`I9` (§9). Money is **fils = 1/1000 JOD**, integer `BIGINT`, rounding `round_half_up` once per multiply/divide. Quantities are milli-integers. Dates are Amman local dates (`Asia/Amman`), week Sunday–Saturday. UI never computes a financial figure; every displayed number comes from the §8/§8.2 read module.

### 3. Tasks (exact)

Number every task and attach its rule ids. Example shape:

1. `<verb> <exact artifact>` — rules: `§3.2, Q1, R-12`.
2. `<verb> <exact artifact>` — rules: `OP-DELIVER, Q5, T57`.
3. Tests for the above — rules: `T1, T2, INV-1`.

**Do not add scope.** If a needed rule is missing from the spec, stop and ask (§7).

### 4. Write boundary

**Allowed to modify (exhaustive):**
- `<exact paths>`

**Forbidden — always, in every task:**
- `main` branch, force-push, history rewrite, merge, deploy.
- Micro Market: `client/src/application/market/**`, `client/src/pages/Market*`, `worker/routes.market.ts`, `worker/domain/market.ts`, market tables.
- Micro Delivery: `client/src/application/delivery/**`, `client/src/pages/Delivery*`, `worker/routes.delivery.ts`, `worker/domain/delivery.ts`, delivery tables.
- Ask Micro: `client/src/components/ask/**`, `client/src/application/ask/**` (unless this task is the approved separation task `M1.3`).
- App-level surfaces: auth, session, workspace, project lifecycle, bottom navigation, online-only mode (unless the task explicitly names them).
- Shared money functions used by other components: `formatMoneyMinor`, `formatMoneyWithUnit`, `persistedMoneyTextMinor`, `parseEnglishNumericText("money")`, `EnglishNumberInput` — **must not change semantics**.
- Any file outside the allowed list.

If deleting old code would break Market, Delivery, or Ask Micro, **do not fix it there** — record it and report.

### 5. Tests first (mandatory order)

1. Write the failing tests for this task (rule ids in test names).
2. Run them; paste the failure output; confirm they fail for the right reason.
3. Implement.
4. Run: `<exact commands>`; paste results.
5. Every acceptance test ends with `assert INV-1` and `assert INV-2`.

No task is `DONE` on a code claim: only on command output.

### 6. Fixed prohibitions

- No financial calculation in the UI layer.
- No Arabic string outside the strings catalog (keys from §10/§11).
- No decimals, floats, or `number` arithmetic for money; no `/100` or `*100` in new Manage code.
- No dead code, no commented-out blocks, no unused exports.
- No new dependency without asking.
- No product decision, no invented state, no silent interpretation. Unspecified state = stop and ask.
- No data migration, no legacy compatibility layer, no "user-data protection" constraint (deferred by the owner). The mandatory parts remain: immutable entries, one transaction per operation, request-id idempotency (R-11, R-12, R-23, R-25).

### 7. Stop conditions

Stop and report `BLOCKED` with the exact question when: a spec case is missing or contradictory; a required file is outside the allowed list; a test cannot pass without touching a forbidden area; a security finding applies and its handling is unclear; the live state drifted.

### 8. Tracker update (same commit)

Update **your section only** in `docs/manage-v2/TRACKER.md` for this task: status, commit SHA, tests (command + result), notes/questions. One task may produce several small commits; every commit message carries the rule ids, e.g. `OP-DELIVER, Q5, T57`.

### 9. Report (Arabic, at the end)

- What was done, file by file.
- Tests: exact commands, counts, results, and the commit SHA tested.
- What was **not** done / deferred.
- Any question or blocker.
- Confirmation that no forbidden file was touched.

---


### 10. Autonomous Self-Correction & Verification (MANDATORY)
As the sole execution agent, you are responsible for end-to-end delivery and verification. 
- **No sub-agents:** Do not spawn external sub-agents for testing or reviewing; handle everything sequentially in this main agent to prevent hangs.
- **Self-Fix Loop:** If `pnpm test`, `typecheck`, or `pnpm guards` fails, DO NOT stop and report the failure. Read the error, identify the root cause, and fix it yourself. Repeat the verification loop until the wave gate is 100% green. 
- **Baseline/Registry Hygiene:** If your valid code triggers a hygienic guard (e.g., `registry-coverage`, `door-surfaces`, `readwrite`, `label-vocabulary`, `test-map`), you are explicitly authorized to update the corresponding registry file, baseline JSON, or whitelist in the same commit to make the guard pass. You do not need to ask permission to fix a guard that your own changes broke.
- **Zero-Defect Delivery:** Never deliver a red state. Only report `BLOCKED` if there is a fundamental spec contradiction or an architectural conflict that cannot be solved via code or baseline updates.

## Short chat launcher (owner → ZAI)

> Repo: https://github.com/Qays7753/Micro — branch `feature/manage-v2`. Read and follow `docs/manage-v2/tasks/<PHASE-PROMPT>` from the current remote head. Verify live state first, preserve existing work, execute only the named wave (its tasks in order, one commit and one tracker entry per task), tests first. Run the wave gate (guards / test / typecheck) at the end, deliver the report as a committed file and give me its full GitHub link — no chat attachments. Then stop at the wave boundary.

## Quality checklist before sending any task

- [ ] One wave, tasks in order, exact paths per task.
- [ ] Wave gate defined (guards / test / typecheck) with a no-weakening rule.
- [ ] Rule ids on every instruction and every test.
- [ ] Forbidden list present verbatim.
- [ ] Tests-first order explicit with commands.
- [ ] Tracker rule present.
- [ ] No secret, token, or credential anywhere.
- [ ] Delivery rule present: report committed to `docs/manage-v2/reports/`, full SHA-pinned link, no chat attachments.
- [ ] Stop point explicit.
- [ ] Nothing that belongs to a later phase.
