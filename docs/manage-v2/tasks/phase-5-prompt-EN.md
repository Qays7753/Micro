# Phase 5: Screens and Texts (M5.1 – M5.11)
> **Execution Mode:** CONTINUOUS & AUTONOMOUS. Do not stop at task boundaries. Execute from the first incomplete task all the way to M5.11, committing and pushing after each task.

## 0. Header & Context
- **Phase:** 5 — Screens and Texts (M5.1 to M5.11)
- **Spec:** `docs/manage-v2/micro-manage-spec-final.md` **v1.1** (binding). UX: `docs/manage-v2/micro-manage-ux-final.md`.
- **Branch:** `feature/manage-v2` only. `main` is strictly forbidden.
- **The Golden Rule for UI:** Every screen consumes the server response AS-IS. **NO EQUATIONS, NO UNIT CONVERSION, NO ROUNDING ON THE CLIENT.** The client cache is for display only. All numbers displayed must exactly match the §8/§8.2 read module.

## 1. Live-state Preflight & Resumption (DO THIS FIRST)
1. Run `git fetch` and `git status`. Ensure the working tree is clean.
2. Pull the latest from remote (`git pull --rebase origin feature/manage-v2`).
3. Read `docs/manage-v2/TRACKER.md`. Identify the first task in Phase 5 (M5.1–M5.11) that is NOT marked as `DONE`.
4. If there is uncommitted WIP, **preserve it**, review against the tracker, and continue. Never reset or discard existing work.
5. Stop and report `STATE_DRIFT` if the live state drastically differs from the tracker.

## 2. The Iron Rules of Execution (UI Strictness)
- **Zero Frontend Math:** Running a regex search for `/100`, `*100`, or `Math.round` in the `pages/manage/**` and `components/manage/**` directories MUST yield 0 results for financial logic.
- **Zero Literal Arabic Text:** No hardcoded Arabic strings in the new Manage code. You MUST use keys from the strings catalog (§10/§11).
- **Granular Spec Adherence:** Map every UX component and API call granularly to the exact specs required. Do not invent UI fields that are not in the spec.
- **Continuous Execution:** Proceed to the next task automatically. Do not pause.
- **Autonomous Self-Fixing:** If `test`, `typecheck`, or `guards` fail, fix the root cause yourself. Update hygiene baselines in the same commit.
- **Sub-agents:** You may deploy specialized sub-agents (up to 5 distinct roles, e.g., UI mapping, Translation checking, Guard verification). The Main Agent must orchestrate, commit, and produce the unified report.

## 3. Task List (Execute sequentially)
*Execute starting from the first incomplete task in Phase 5.*

1. **M5.1:** P-01 Start. Rules: `§5 OP-SETUP, UX P-01`.
2. **M5.2:** P-10 My Project Now + P-11 + Change tab name to "مشروعي الآن". Rules: `§8, UX, Decision 11`. (This is the ONLY allowed change to the bottom navigation bar).
3. **M5.3:** P-20 Tracker (calendar/list) + P-21 + P-22/23/24. Rules: `§6, UX`.
4. **M5.4:** P-30 Finance + P-31…P-36. Rules: `§8, UX`.
5. **M5.5:** P-37…P-40 Boxes. Rules: `§5, UX`.
6. **M5.6:** P-41…P-46 Movements and Dues. Rules: `§5, UX`.
7. **M5.7:** P-50…P-53 Reconciliation. Rules: `§7.1, UX`.
8. **M5.8:** P-60…P-68 Operation Forms + online-only guard (T56). Rules: `§5, UX, T56`.
9. **M5.9:** P-70…P-80 Situation windows. Rules: `§5, §6, UX`.
10. **M5.10:** Quick buttons C-07 + Formatting R-20…R-22. Rules: `§9, T54`.
11. **M5.11:** All texts from catalog, NO literal text. Rules: `§10, §11`.

## 4. Phase Gates & Final Unified Report
- After M5.11, run the **Full Phase 5 Regression Gate**: `corepack pnpm guards`, `corepack pnpm test`, `corepack pnpm typecheck`, `corepack pnpm format:check`, and `corepack pnpm knip`.
- Run an automated grep/search to prove **zero financial math** and **zero literal Arabic strings** exist in the client folders.
- **Report:** Write the final Phase 5 report in Arabic at `docs/manage-v2/reports/PHASE-5-report-AR.md`.
- The report MUST be a single unified document detailing all tasks, test commands and counts, SHAs, UI constraint validations, and confirmation of boundaries respected.
- Provide the full GitHub URL to the committed report. No chat attachments.
- Stop and await owner acceptance before moving to Phase 6.
