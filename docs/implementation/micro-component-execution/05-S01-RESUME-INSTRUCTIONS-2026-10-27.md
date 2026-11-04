# Micro — S01 Resume Instructions — 2026-10-27

**Branch:** `components/integration-20261027`
**Base SHA:** `3584aa1d08cea3e0a00623b719fed7f991ce187f`
**Scope:** S01 accepted record and S02 draft handoff only; no product code
**Last review head before correction:** `fd265351d44ab5b32ae69a0c51c53082e1e875ee` (the initial publication checkpoint was `b67e249ae59e7a3982e3877afeca95e7a04a9321`).

## Resume order

1. Read `AGENTS.md`, the SOP, the Handoff Protocol, Operations Control README, this package's `00-S01-APPROVED-TASK-2026-10-27.md`, `03-S01-RESULT-2026-10-27.md`, and `docs/operations/current-state.md`.
2. Fetch GitHub refs and inspect the existing branch, PR, worktree, and commits. Do not reclone/reset over existing work and do not create a second branch or PR.
3. Confirm the live PR head. The accepted reviewed candidate is `3b1b24b508edb68996fa0ac33418a96ee05957ad`; the later documentation-only review record is `424c6fd59c4ce91ef7fa52324110abecb35b10e7`. If the live head differs for an unexplained reason, stop with `STATE_DRIFT`.
4. Do not repeat S01 or product tests. For this handoff, review the S02 draft only; no S02 implementation is permitted. Regenerate official views after source JSON changes and run only the required documentation/control gates with the reason recorded in the result.
5. Keep all writes on `components/integration-20261027` and keep the PR Draft. Never write `main`, merge, rebase, force-push, delete, run ZAI, or start S02 implementation.
6. The S01 acceptance is on the integration branch only. Review `00-S02-TASK-DRAFT-2026-10-27.md`; do not treat it as an execution command. If a guard fails, fix the documentation/control root cause only. A product-code, financial, schema, export/import, or CI-policy failure is a blocker, not a reason to weaken a guard.
7. Before stopping, update the result and Control records with the last confirmed action, exact candidate SHA, checks and their head, unknown write outcomes, and the next exact action.

## Safe stop

Stop and report `S02_DRAFT_REVIEW_REQUIRED` for any attempt to execute the draft, or `S01_DOCUMENTATION_PUBLICATION_BLOCKED` for state drift, an unexpected branch/PR, a conflicting Claim, an unknown package hash, a schema/validator failure that cannot be explained, an out-of-scope file, or any need to modify product code or `main`.
