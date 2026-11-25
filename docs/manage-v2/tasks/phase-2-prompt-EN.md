# Phase 2 — Schema, ledger, and server operations (ZAI wave prompt) — DRAFT

> **Status: DRAFT, prepared 26/11/2026 while wave A runs.** Do not execute from this file until phase 1 closes and Manus confirms it against the phase-1 output (folder names from M1.6, money unit from M1.7, guards from M1.10). Any path below that differs from what phase 1 actually created is corrected in this file before the first launcher — never silently in code.
> **Execute ONE wave per run**, tasks in the listed order, one commit and one tracker entry per task.
> Canonical sources: `docs/manage-v2/micro-manage-spec-final.md` (v1.1, binding) — §3 data, §4 entry types, §5 operations, §8 formulas, §9 invariants, §12 order, §13 tests, §14 architecture; `docs/manage-v2/IMPACT.md`; `docs/manage-v2/PLAN.md`; `docs/manage-v2/TRACEABILITY.md`; `docs/manage-v2/REVIEW.md`.
> Branch: `feature/manage-v2` only. **`main` is forbidden.** No merge, no force-push, no history rewrite.
> Delivery: no chat attachments. Reports are committed under `docs/manage-v2/reports/` and linked by full SHA URL.

## Waves

| Wave | Tasks (in order) | Scope | Status |
|---|---|---|---|
| E | M2.1 → M2.2 → M2.3 | §3 schema + append-only enforcement; Q1–Q20 entry registry and balance rule; I1–I9 as executable checks | pending phase-1 gate |
| F | M2.4 | The single operation handler: load → domain → one transaction → atomic idempotency reservation (SRV-03) | pending E |
| G | M2.5 → M2.6 → M2.7 | OP-SETUP / OP-ADD-BOX / OP-ADD-PRIOR-BALANCE; OP-EXPENSE; owner deposit/withdrawal/transfer | pending F |
| H | M2.8 → M2.9 → M2.10 | OP-COLLECT / OP-PAY / allocation by name; OP-WRITE-OFF; OP-CORRECT / OP-CANCEL-OPERATION (Q20) | pending G |
| I | M2.11 | The one server read module for every §8 / §8.2 figure | pending H |
| J | M2.12 → M2.13 | Project export/delete over the new tables (SRV-07); transfer envelope v2 that rejects v1 | pending I |

## Execution model (same as phase 1)

- One wave per run; tasks in order without pausing between them; each task keeps its own **Allowed files**, its own commit, its own tracker entry.
- No transitions between waves. Wave gate at the end: `corepack pnpm guards` zero `FAIL`, `corepack pnpm test` zero failures, `corepack pnpm typecheck` clean. A red wave is not finished: fix inside the wave's allowed files or stop with `BLOCKED` — never weaken a guard, threshold, or exemption.
- Tests first in every task: write the failing test, paste the failure, implement, run again.
- Execution is not acceptance; Manus reviews each task against `REVIEW.md`, only the owner accepts.
- Resume: continue the same wave from the first task whose tracker entry is not `DONE`; never reset, clean, or reclone over work.
- No sub-agents, no parallel edits, no branch or PR per task.
- Every path outside the current task's allowed list is read-only.
- Unspecified state or a spec contradiction → stop and report `BLOCKED` with the exact question. No product decisions.
- `NO_REPOSITORY_WRITES` beyond the wave's commits; `NO_CLEANUP` (no deletions, formatting sweeps, dependency updates) unless a task authorizes it.

## 0. Preflight (every wave)

1. `git fetch`; report branch, `git log -1 --format=%H`, `git status --short`, untracked files.
2. Read `docs/manage-v2/TRACKER.md`; report the status of every task in the named wave.
3. Dirty tree or a state the tracker does not explain → `STATE_DRIFT`, stop. Never reset/clean/overwrite.
4. Confirm the phase-1 gate is green on the current head before starting wave E; later waves confirm the previous wave's gate.
5. Confirm the wave exists in the table above and its task ids match sections below.

## 1. Global boundary (every task)

Forbidden always: `main`, force-push, merge, deploy, tags; Micro Market (`client/src/application/market/**`, `client/src/pages/Market*`, `worker/routes.market.ts`, `worker/domain/market.ts`, market tables); Micro Delivery (`client/src/application/delivery/**`, `client/src/pages/Delivery*`, `worker/routes.delivery.ts`, `worker/domain/delivery.ts`, delivery tables); Ask Micro (`client/src/components/ask/**`, `client/src/application/ask/**`, `client/src/pages/AskMicro.tsx`); app-level auth/session/workspace/project lifecycle/bottom navigation/online-only mode; shared money helpers used by Delivery, Market and Tools (`formatMoneyMinor`, `formatMoneyWithUnit`, `persistedMoneyTextMinor`, `parseEnglishNumericText("money")`, `EnglishNumberInput`); any file outside the task's allowed list.

Required always: Manage money is `MoneyFils` (integer, 1/1000 JOD) — no `number` decimals, no `/100`, no `*100`; quantities are milli-integers; dates are Amman local dates; every number a client shows comes from the server read module; no financial formula in client code; no Arabic literal outside the strings catalog for new Manage surfaces; no dead code; no new dependency without asking.

Repository paths: worker code is `apps/prototype-web/worker/**`; client is `apps/prototype-web/client/src/**`; shared domain is `src/domain/**`; migrations are `apps/prototype-web/worker/db/migrations-pg/` (next free number is `0018`).

---

## M2.1 — §3 schema migrations + append-only enforcement

**Why:** nothing can be built before the tables exist, and the ledger must be immutable at the database level, not by convention.

**Rules:** §3 (all subsections), §14.4, R-12.

**Do:**
- One migration `0018_manage_v2_schema.sql` creating every §3 table with the exact fields, types, keys, and constraints of the spec: `project`, `box`, `product`, `product_component`, `sale`, `sale_line`, `balance_line`, `operation`, `ledger_entry`, `ledger_posting`, `absence_event`, `reconciliation`, `reconciliation_box`.
- Money columns are `BIGINT` fils; quantities are integer milli; dates are `date`; timestamps `timestamptz`.
- Append-only: `UPDATE`/`DELETE` on `ledger_entry` and `ledger_posting` rejected at the database level (trigger or revoked grants — choose one and document why).
- Per-entry balance: no committed entry may have postings that do not sum to zero (§3.8). Enforce in the same migration where the engine allows it, otherwise in M2.2 with a test proving the database rejects a bad entry.
- Indexes for the read paths the spec implies (project + date, sale + status, balance_line + party, operation + project + date).

**Allowed files:** `apps/prototype-web/worker/db/migrations-pg/0018_manage_v2_schema.sql`, its migration test, `docs/manage-v2/TRACKER.md`, the wave report.

**Tests first:** a migration test that applies the schema to an empty database and asserts every table and column exists, then asserts `UPDATE ledger_entry` and `DELETE ledger_posting` fail.

**Acceptance:** migration applies cleanly on an empty database and is idempotent under the repo's migration runner; the rejection test passes; no legacy table touched.

**Stop if:** the spec leaves a column type or nullability genuinely ambiguous, or the migration runner cannot express the append-only rule.

---

## M2.2 — Entry type registry Q1–Q20 and the balance rule

**Why:** the entry types are the only way any number changes; if a type is wrong here, every later figure is wrong.

**Rules:** §4, §3.8, §9.

**Do:**
- A typed registry for `Q1`–`Q20`: id, name, direction, the accounts it may post to, the sign rules, and whether it is reversible.
- One function that builds and validates an entry: refuses an unknown type, a posting to a disallowed account, a non-zero sum, or a reversal of a reversal.
- No formula from §8 here — this task only writes entries correctly.

**Allowed files:** `src/domain/manage/ledger/**` (registry + validation), its tests, `docs/manage-v2/TRACKER.md`, the wave report.

**Tests first:** one test per entry type asserting the exact postings it produces and that the sum is zero; one negative test per refusal rule.

**Acceptance:** all 20 types covered by a test; a table-driven test proves every type's postings sum to zero; no §8 figure computed in this module.

**Stop if:** a §4 row cannot be expressed without inventing an account or a rule.

---

## M2.3 — Invariants I1–I9 as executable checks

**Why:** the invariants are the safety net for every later task; they must exist before operations are written.

**Rules:** §9.

**Do:**
- Implement each of `I1`–`I9` as a pure check over a ledger state, callable from tests and from the operation handler where cheap.
- `INV-1` and `INV-2` must be callable in a single assertion used by every acceptance test from here on.

**Allowed files:** `src/domain/manage/invariants/**`, its tests, `docs/manage-v2/TRACKER.md`, the wave report.

**Tests first:** one failing-then-passing test per invariant, including a deliberately corrupted state proving the check catches it.

**Acceptance:** nine invariants, nine tests, each proving both the healthy and the corrupted case; no invariant silently returns true.

**Stop if:** an invariant needs data the schema does not hold.

---

## M2.4 — The operation handler: one transaction, atomic idempotency (SRV-03)

**Why:** this is the security-critical core. Idempotency that is checked outside the transaction lets the same request apply twice under concurrency.

**Rules:** §14.1, R-11, R-12, R-23, R-25, SRV-03, T55.

**Do:**
- One server-side handler shape used by every operation: validate input → load state in the transaction → run the domain function → write operation + entries + postings → commit.
- Idempotency: reserve the request id **inside the same transaction** as the writes, with a uniqueness constraint doing the arbitration; a duplicate request must return the original result, never apply twice, never leave a half-applied state.
- Failure of any step rolls back everything, including the reservation.
- The client never computes or decides a figure; it sends intent and receives the result.

**Allowed files:** `apps/prototype-web/worker/application/manage/operationHandler.ts` (or the equivalent single file created by M1.6), the idempotency table migration if the schema needs it (`0019_*`), its tests, `docs/manage-v2/TRACKER.md`, the wave report.

**Tests first:**
1. T55: the same request id twice → one operation, one set of entries, identical response.
2. Concurrency: two parallel requests with the same id → exactly one applies.
3. A failure injected after the first write → no operation, no entries, no reservation left behind.

**Acceptance:** all three tests pass against a real Postgres instance (the repo's test harness), not a mock; the reservation is provably inside the transaction (show the code path and the failing test that proves the old outside-transaction check would double-apply).

**Stop if:** the test harness cannot run two concurrent transactions, or the schema cannot express the uniqueness needed.

---

## M2.5 — OP-SETUP, OP-ADD-BOX, OP-ADD-PRIOR-BALANCE

**Rules:** §5 (OP-SETUP, OP-ADD-BOX, OP-ADD-PRIOR-BALANCE), Q1, Q2, OPEN entries. Tests: S1, T4, T38.

**Do:** the three opening-state operations. `OP-ADD-PRIOR-BALANCE` records a prior receivable/payable **for tracking only**: it moves no box, changes no profit, and posts the OPEN entry the spec names.

**Allowed files:** `src/domain/manage/operations/setup.ts`, `addBox.ts`, `addPriorBalance.ts`, `apps/prototype-web/worker/api/manage/*` for these three routes only, their tests, tracker, report.

**Tests first:** S1 opening state; T4 (unknown opening cash, first reconciliation fixes Q1); T38 (prior receivable 40 → AR 40, OPEN +40, box unchanged, profit 0).

**Acceptance:** the three tests pass; each ends with `assert INV-1` and `assert INV-2`; the unknown-opening path is explicit, not guessed.

**Stop if:** "unknown opening" needs a product rule the spec does not state.

---

## M2.6 — OP-EXPENSE (full, partial, credit, personal, delivery)

**Rules:** §5 OP-EXPENSE, Q8–Q10. Tests: T8, T15, T16, T29, T30.

**Do:** every expense variant the spec lists, including the personal-money case (expense paid by the owner) and the delivery-cost attribution, with the exact postings of §4.

**Allowed files:** `src/domain/manage/operations/expense.ts`, its route, its tests, tracker, report.

**Tests first:** T8 (expense 50 from a 20 box → accepted, cash −30, warning `w.negative_box`), T15 (gas 15 from personal money → EXP +15, OWN_IN +15, boxes unchanged, profit −15), T16 (materials 120, partial 50 cash → supplier payable 70), T29 (correcting a credit expense to 40 → `E-CORRECTION-BREAKS-BALANCES`), T30 (materials 12 + delivery 2 → EXP[materials_packaging] 14, operation shows delivery 2).

**Acceptance:** the five tests pass; negative box is a warning, not a rejection; no rounding outside the money unit.

**Stop if:** a variant's account mapping is not stated in §4.

---

## M2.7 — Owner deposit, withdrawal, transfer

**Rules:** §5 OP-OWNER-DEPOSIT / OP-OWNER-WITHDRAWAL / OP-TRANSFER, Q10–Q14. Tests: S6, S9, T9, T10.

**Do:** owner money movements and transfers between boxes, with the borrowed-money case (deposit that creates a payable) exactly as §5 describes.

**Allowed files:** `src/domain/manage/operations/ownerMoney.ts`, `transfer.ts`, their routes, tests, tracker, report.

**Tests first:** S6 (borrow 50 → cash +50, payable 50, profit 0; pay → cash −50, payable 0), S9 (withdrawal 200 → cash −200, profit unchanged), T9/T10 (merge and split effects on Q14).

**Acceptance:** four tests pass; profit never moves on an owner movement; transfers keep totals.

**Stop if:** the spec does not say which box pays a transfer fee or a rounding remainder.

---

## M2.8 — OP-COLLECT, OP-PAY, allocation by name

**Rules:** §5 OP-COLLECT / OP-PAY, Q6–Q7. Tests: S5, T6, T7, T13, T27, T36, T51.

**Do:** collection and payment with allocation by name, oldest-first, the "remains outstanding" choice, and every rejection the spec names (`E-OVERPAY`, `E-NO-OPEN-BALANCE`, `E-NAME-REQUIRED-FOR-DEBT`).

**Allowed files:** `src/domain/manage/operations/collect.ts`, `pay.ts`, `allocation.ts`, their routes, tests, tracker, report.

**Tests first:** S5 (prior receivable 100 → cash +100, profit 0, OPEN +100), T6 (unnamed same-day sale then collect 20 → rejected), T7 (collect 80 on 50 outstanding → `E-OVERPAY`), T13 (prior payable 70 paid → cash −70, profit 0, OPEN −70), T27 (three remainders 30/40/50, collect 100 → 30/40/30, no shortfall question), T36 (collect 20 of 25, keep outstanding → remainder 5, no revenue change), T51 (collect from a name with no open lines → `E-NO-OPEN-BALANCE`).

**Acceptance:** seven tests pass; allocation order is asserted, not assumed; no shortfall prompt when multiple lines exist.

**Stop if:** the allocation order for equal dates is not specified.

---

## M2.9 — OP-WRITE-OFF

**Rules:** §5 OP-WRITE-OFF, Q17. Tests: T22, T25, T39.

**Do:** write-off on any open `to_me` line, with the owner-withdrawal treatment the spec states, and the overpay rejection.

**Allowed files:** `src/domain/manage/operations/writeOff.ts`, its route, tests, tracker, report.

**Tests first:** T22 (deliver 25, collect 22 + write off 3 → remainder 0, status completed, returns & discounts 3), T25 (lend 50 then write off → receivable 0, withdrawals +50, profit unchanged), T39 (write off 30 on 20 outstanding → `E-OVERPAY`).

**Acceptance:** three tests pass; write-off never touches profit.

**Stop if:** the spec does not say whether a partial write-off is allowed.

---

## M2.10 — OP-CORRECT and OP-CANCEL-OPERATION (Q20)

**Rules:** §5 OP-CORRECT / OP-CANCEL-OPERATION, Q20, §9. Tests: T5, T29, T35, T52.

**Do:** correction by reversal-and-repost (Q20), with the balance validation that refuses a correction which would break a settled figure, and the rule that a Q20 entry cannot itself be reversed.

**Allowed files:** `src/domain/manage/operations/correct.ts`, `cancelOperation.ts`, their routes, tests, tracker, report.

**Tests first:** T5 (October expense 50 corrected to 5 → October profit +45, November unchanged), T29 (credit expense correction breaking balances → rejected), T35 (correcting a prepayment of a delivered sale → rejected, undo delivery first), T52 (correct a collection to 25 → Q6 22 and Q17 3 reversed, new Q6 25).

**Acceptance:** four tests pass; the original entry is never edited, only reversed; the reversal chain is visible in the operation log.

**Stop if:** the spec does not define which figures count as "settled" for the rejection.

---

## M2.11 — The one server read module for §8 and §8.2

**Why:** every displayed number comes from here; a second implementation anywhere is the defect this phase exists to prevent.

**Rules:** §8, §8.2, §14.2, R-23.

**Do:** one server module computing every §8 figure (profit, revenue, expenses, cash, receivables, payables, net worth, period figures, owner entitlement, expected profit) and the §8.2 entity-level derived values the UI may show. The response is ready to display: formatted amounts and labels come from the server, the client only renders.

**Allowed files:** `apps/prototype-web/worker/application/manage/readModel.ts` (single file), `src/domain/manage/figures/**` if pure helpers are needed, its routes, tests, tracker, report.

**Tests first:** one test per §8 formula with a hand-computed expected value from the spec's own worked examples; a test asserting the module is the only place these formulas exist (source scan: no `/ 1000`, no profit formula outside this module).

**Acceptance:** every §8 and §8.2 figure has a test with an exact expected integer; a source scan proves no second implementation; T54's formatting expectations are produced by the server response, not the client.

**Stop if:** a §8 formula is ambiguous for an edge case (zero boxes, no sales, negative net worth).

---

## M2.12 — Project export and delete over the new tables (SRV-07)

**Why:** deleting a project must not leave orphan rows in any Manage table, and two concurrent imports must not interleave.

**Rules:** §14.6, S5 (export/delete surface), SRV-07, owner decision on deletion without migration.

**Do:** export and delete for the new schema in one transaction with the locking the spec requires; deletion covers every Manage table including entries and postings, and leaves no orphan; export produces a v2 envelope.

**Allowed files:** `apps/prototype-web/worker/api/projectLifecycle.ts` (Manage branch only), `apps/prototype-web/worker/application/manage/exportDelete.ts`, its tests, tracker, report.

**Tests first:** export → delete → assert zero rows in every Manage table and no orphan; two concurrent deletes/imports → exactly one wins, the other gets the documented error; a project with entries cannot be deleted halfway.

**Acceptance:** orphan-check query returns zero after deletion; concurrency test proves one winner; no legacy table touched.

**Stop if:** the existing lifecycle route cannot host the Manage branch without changing behaviour for other components.

---

## M2.13 — Transfer envelope v2 that rejects v1

**Rules:** S6, §14.6, no migration of old data.

**Do:** a v2 envelope over the new tables, with an explicit rejection of any v1 envelope (`E-ENVELOPE-V1-UNSUPPORTED` or the spec's equivalent), and a round-trip test.

**Allowed files:** `apps/prototype-web/client/src/application/manage/transfers/**` or the server-side equivalent created by M1.6, its tests, tracker, report.

**Tests first:** round-trip export → import into an empty project produces identical figures; a v1 envelope is rejected with the documented error and writes nothing.

**Acceptance:** both tests pass; no v1 reader remains in the new path.

**Stop if:** the spec does not name the rejection error for v1.

---

## Phase-2 gate (after wave J)

- §12 phase-1 test set passes: S2, S5, S6, S9, T5, T7, T8, T13, T15, T16, T25, T26, T27, T29, T30 — plus T55, T38, T35, T36, T6, T41 where the owning task lives here.
- `INV-1` and `INV-2` asserted in every acceptance test.
- No §8 formula outside the read module (source scan).
- `pnpm guards`, `pnpm test`, `pnpm typecheck` green.
- Report: `docs/manage-v2/reports/PHASE-2-report-AR.md`, one section per task plus the gate evidence.

## Report format (Arabic) — `docs/manage-v2/reports/WAVE-<X>-report-AR.md`

Per task: task id and commit; what changed file by file; tests (command, counts, result, SHA); what was not done or deferred; any question or `BLOCKED`/`STATE_DRIFT`; confirmation that no forbidden file was touched; tracker updated in the same commit. Then the wave gate results on the final SHA. The chat carries a ten-line summary and the link.
