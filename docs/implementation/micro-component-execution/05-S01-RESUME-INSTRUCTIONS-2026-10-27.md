# Micro — S01 Resume Instructions — 2026-10-27

**Branch:** `components/integration-20261027`
**Base SHA:** `3584aa1d08cea3e0a00623b719fed7f991ce187f`
**Scope:** S01 documentation only

## Resume order

1. Read `AGENTS.md`, the SOP, the Handoff Protocol, Operations Control README, this package's `00-S01-APPROVED-TASK-2026-10-27.md`, `03-S01-RESULT-2026-10-27.md`, and `docs/operations/current-state.md`.
2. Fetch GitHub refs and inspect the existing branch, PR, worktree, and commits. Do not reclone/reset over existing work and do not create a second branch or PR.
3. Confirm the last verified candidate SHA and the exact uncommitted state before any write. If it differs from the result record, stop with `STATE_DRIFT`.
4. Continue only the first incomplete S01 action. Do not repeat completed package copying, generated-view generation, or checks without a reason recorded in the result.
5. Keep all writes on `components/integration-20261027` and keep the PR Draft. Never write `main`, merge, rebase, force-push, delete, or start S02.
6. If a guard fails, fix the documentation/control root cause only. A product-code, financial, schema, export/import, or CI-policy failure is a blocker, not a reason to weaken a guard.
7. Before stopping, update the result and Control records with the last confirmed action, exact candidate SHA, checks and their head, unknown write outcomes, and the next exact action.

## Safe stop

Stop and report `S01_DOCUMENTATION_PUBLICATION_BLOCKED` for state drift, an unexpected branch/PR, a conflicting Claim, an unknown package hash, a schema/validator failure that cannot be explained, an out-of-scope file, or any need to modify product code or `main`.
