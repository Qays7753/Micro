# Phase 3: Sales and Orders (M3.1 – M3.11)
> **Execution Mode:** CONTINUOUS & AUTONOMOUS. Do not stop at task boundaries. Do not ask for permission to proceed. Execute from the first incomplete task all the way to M3.11, committing and pushing after each task.

## 0. Header & Context
- **Phase:** 3 — Sales and Orders (M3.1 to M3.11)
- **Spec:** `docs/manage-v2/micro-manage-spec-final.md` **v1.1** (binding). UX: `micro-manage-ux-final.md`.
- **Branch:** `feature/manage-v2` only. `main` is strictly forbidden.
- **Money:** `MoneyFils` (BIGINT). No decimals, floats, or `/100` in UI. All financial math is strictly on the server.

## 1. Live-state Preflight & Resumption (DO THIS FIRST)
1. Run `git fetch` and `git status`. Ensure the working tree is clean.
2. Read `docs/manage-v2/TRACKER.md`. Identify the first task in Phase 3 (M3.1–M3.11) that is NOT marked as `DONE`.
3. If there is uncommitted WIP from an interrupted session, **preserve it**, review it against the tracker, and continue from that point. Never reset, discard, or overwrite existing work.
4. If the live state drastically differs from the tracker, report `STATE_DRIFT` and stop. Otherwise, begin execution.

## 2. The Iron Rules of Execution (Lessons Learned)
- **Continuous Execution:** Do not stop and ask "Should I proceed to the next task?". Just proceed.
- **Commit & Push per Task:** Once a task passes tests and the tracker is updated, commit and push to remote immediately.
- **Tracker Updates:** Update the ZAI section of `TRACKER.md` in the **exact same commit** as the task code.
- **Autonomous Self-Fixing:** If `pnpm test`, `typecheck`, or `guards` fail, DO NOT stop and ask for help. Read the error, find the root cause, and fix it yourself. You are authorized to update hygiene baselines (ratchets, knip doors, index files) in the same commit to make the guards pass.
- **Sub-agents:** Use sub-agents ONLY if genuinely useful (max 5), with strict non-overlapping boundaries. The Main Agent remains entirely responsible for integration, testing, committing, and reporting.
- **Tests First:** Write failing tests -> Run them to prove they fail (Red) -> Implement -> Run to pass (Green). Every acceptance test must end with `assert INV-1` and `assert INV-2`.
- **No Scope Creep:** Implement exactly what is asked. Do not hide structural or financial changes inside hygiene tasks. Do not touch Market, Delivery, or Ask Micro unless explicitly authorized.

## 3. Task List (Execute sequentially)
*Execute starting from the first incomplete task.*

1. **M3.1:** `product` + `product_component` + item snapshot. Rules: `§3.3, §3.5, Decision 5`. Tests: `T12, T14, T19`.
2. **M3.2:** `OP-SALE-CREATE` + derived state. Include direct non-financial updates (customer name, notes, date, tracker tags) without creating financial operations. Rules: `§3.4, §5, §6, R-17`. Tests: `S1, T20, T21, T44, T48`.
3. **M3.3:** `OP-PREPAYMENT`. Rules: `§5, Q4`. Tests: `S1, T1, T40`.
4. **M3.4:** `OP-DELIVER` + allocation. Rules: `§5, Q5`. Tests: `S1, T2, T3, T17, T49, T57`.
5. **M3.5:** `OP-SALE-DELIVERY-COST`. Rules: `§5, Q8`. Tests: `S1, T30, T43`.
6. **M3.6:** `OP-CANCEL-SALE` (Q15). Rules: `§5`. Tests: `S3, T11, T24, T50`.
7. **M3.7:** `OP-RETURN` (Q16). Rules: `§5`. Tests: `S4, T2, T3`.
8. **M3.8:** `OP-PRICE-CORRECTION` (Q20+Q5). Rules: `§5`. Tests: `T18`.
9. **M3.9:** `OP-UNDO-DELIVERY`. Rules: `§5`. Tests: `T17, T37`.
10. **M3.10:** Collected excess (Q18). Rules: `§5`. Tests: `T23`.
11. **M3.11:** Tracker add/hide (`OP-TRACKER-HIDE` / `OP-TRACKER-ADD`). Rules: `§5`. Tests: `T31, T32`.

## 4. Phase Gates & Final Report
- After M3.11 is complete, run the **Full Phase 3 Regression**: `corepack pnpm guards`, `corepack pnpm test` (root and prototype), `corepack pnpm typecheck`, `corepack pnpm format:check`, and `corepack pnpm knip`.
- Fix any cross-task regressions autonomously.
- **Report:** Once the gate is green, write the final Phase 3 report in Arabic at `docs/manage-v2/reports/PHASE-3-report-AR.md`.
- Include: Exact final SHA, tests run (commands + counts), tasks completed, deferred items (if any), security findings status, and a confirmation that no forbidden boundaries were crossed.
- Do NOT output chat attachments. Provide the full GitHub URL to the committed report.
- Stop and await owner acceptance. Do NOT proceed to Phase 4.
