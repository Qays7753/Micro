# Phase 4: Boxes, Reconciliation, and Absence (M4.1 – M4.5)
> **Execution Mode:** CONTINUOUS & AUTONOMOUS. Do not stop at task boundaries. Do not ask for permission to proceed. Execute from the first incomplete task all the way to M4.5, committing and pushing after each task.

## 0. Header & Context
- **Phase:** 4 — Boxes, Reconciliation, and Absence (M4.1 to M4.5)
- **Spec:** `docs/manage-v2/micro-manage-spec-final.md` **v1.1** (binding). UX: `micro-manage-ux-final.md`.
- **Branch:** `feature/manage-v2` only. `main` is strictly forbidden.
- **Money:** `MoneyFils` (BIGINT). All financial math is strictly on the server. Client is display/cache only.

## 1. Live-state Preflight & Resumption (DO THIS FIRST)
1. Run `git fetch` and `git status`. Ensure the working tree is clean.
2. Pull the latest from remote (e.g. `git pull --rebase origin feature/manage-v2`) to ensure you have the final Phase 3 code.
3. Read `docs/manage-v2/TRACKER.md`. Identify the first task in Phase 4 (M4.1–M4.5) that is NOT marked as `DONE`.
4. If there is uncommitted WIP, **preserve it**, review against the tracker, and continue. Never reset or discard existing work.
5. Stop and report `STATE_DRIFT` if the live state drastically differs from the tracker.

## 2. The Iron Rules of Execution
- **Continuous Execution:** Proceed to the next task automatically. Do not pause for routine permission.
- **Commit & Push per Task:** Commit code and tracker updates together, then push immediately.
- **Autonomous Self-Fixing:** If verifications (`test`, `typecheck`, `guards`) fail, fix the root cause yourself. Update hygiene baselines (ratchets, knip doors) if needed in the same commit.
- **Sub-agents:** You may deploy specialized sub-agents (up to 5 distinct roles, e.g., implementation, verification, security) if helpful, but the Main Agent must orchestrate, integrate, verify, commit, and produce the unified final report.
- **Tests First:** Write tests -> Fail -> Implement -> Pass. Append `assert INV-1` and `assert INV-2` to all acceptance tests.
- **Strict Scope:** Implement ONLY M4.1 through M4.5. Do not modify Market, Delivery, or Ask Micro.

## 3. Task List (Execute sequentially)
*Execute starting from the first incomplete task in Phase 4.*

1. **M4.1:** Merge/split boxes (`OP-MERGE-BOXES` / `OP-SPLIT-BOXES`). Rules: `§5, Q14`. Tests: `T9, T10, T41, T46, T47, T53, T59`.
2. **M4.2:** Reconciliation (`OP-RECONCILE`): balances, opposing diffs, questions, Q19. Rules: `§7.1, Q19`. Tests: `S7, S8, T34, T42, T45`.
3. **M4.3:** Absence (`OP-RETURN-AFTER-ABSENCE`): statement, return, completion. Rules: `§7.2`. Tests: `T33, T58`.
4. **M4.4:** Anonymous opening. Rules: `§7.3`. Tests: `T4, T28`.
5. **M4.5:** Reconciliation log. Rules: `§3.10`.

## 4. Phase Gates & Final Unified Report
- After M4.5, run the **Full Phase 4 Regression Gate**: `corepack pnpm guards`, `corepack pnpm test`, `corepack pnpm typecheck`, `corepack pnpm format:check`, and `corepack pnpm knip`.
- Fix any cross-task regressions autonomously.
- **Report:** Write the final Phase 4 report in Arabic at `docs/manage-v2/reports/PHASE-4-report-AR.md`.
- The report MUST be a single unified document detailing all tasks, test commands and counts, SHAs, any deferred items, security status, and confirmation of boundaries respected.
- Do NOT use chat attachments. Provide the full GitHub URL to the committed report.
- Stop and await owner acceptance before moving to Phase 5.
