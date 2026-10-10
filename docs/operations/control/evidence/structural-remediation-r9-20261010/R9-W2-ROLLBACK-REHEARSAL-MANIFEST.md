# R9-W2 — Rollback Rehearsal Manifest (2026-10-10)

**Program:** WS-216 / ARCH-007 — R9 complete remediation, wave W2.
**Branch/head:** `refactoring/r9-complete-w1-w2-w3-20261010` (W2 commits on top of the
Gate-B-approved W1 head `5bf1a327`). **Environment:** linux/x64, node v24.21.0,
zlib 1.3.2.1-motley-8002e91, fake-indexeddb 6.2.5 (the repository's own test
IndexedDB engine), vitest via `pnpm --filter @micro/prototype-web exec vitest run`.

---

## RB-1 — snapshot backup / replace / failure / restore

| Field | Value |
|---|---|
| Rehearsal ID | RB-1 (legs 1 and 2) |
| Test file | `apps/prototype-web/client/src/storage/local/rollbackRehearsal.r9.test.ts` (describe "R9-W2 RB-1") |
| Exact fixture identity | Deterministic state A seeded through real adapter writes: profile (`local-profile`, "ورشة رحلة الاستعادة", JOD, custom_craft), preferences (`local-preferences`, dark), draft `rb1-draft` (OrderDraft, intent customer_order), wallet `rb1-wallet` (cash_drawer) + opening entry `rb1-opening` (opening_balance, +25,000 minor, 2026-10-01) via `commitCashContinuity`, financial event `rb1-event` (operating_expense_cash, 1,250 minor, expenseContext project/fixed/period/known) via `createFinancialEvent` + `saveFinancialEvent`, direct sale `rb1-sale` (4,500/4,500 minor, idempotencyKey `rb1-sale-op`) via `createDirectSale` + `saveDirectSale` |
| Initial state/hash | `readSnapshot()` over the seeded store; stable hash = canonical-JSON (recursive sorted keys) + dual FNV-1a digest + payload length; per-family read-backs through the adapter's own readers (getProfile/getPreferences/getDraft/listCashWallets/listCashContinuityEntries/listFinancialEvents/listDirectSales) |
| Backup identity | The `readSnapshot()` result object itself (the supported backup artifact; the same shape `localTransferService.confirmImport` verifies before any replace) |
| Operation and failure injection | **Leg 1 (R9-GA-F1 regression, synchronous):** `replaceSnapshot` with a poisoned snapshot — the `rb1-sale` record carries a function-valued property → structured-clone `DataCloneError` thrown synchronously by `put()` after the 35 store `clear()`s and the earlier family puts are queued. **Leg 2 (async request error, engine-native):** `replaceSnapshot` with two direct sales sharing the unique `idempotencyKey` index (`direct-sales.idempotencyKey` unique, `indexedDbMigrations.ts:114`) but different ids → `ConstraintError` on the second `put()` inside the same readwrite transaction → the documented `transaction.onerror` path (no test doubles) |
| Observed error/status | Both legs: `{ ok: false, code: "storage_error" }` — honest failure, no partial success |
| Restore operation | `replaceSnapshot(backup.value)` — the supported restore path |
| Final state/hash | Both legs: post-failure hash == hashA (full-snapshot equality) AND post-restore hash == hashA; leg 1 additionally re-verified through a **fresh adapter instance** (durability across connections) |
| Relationship/integrity comparison | Per-family counts (1 wallet / 1 entry / 1 event / 1 sale), values (cashDeltaMinor 25,000; amountMinor 1,250; revenueMinor 4,500), and relationships (entry.walletId == wallet.id) asserted through the adapter's readers after every leg |
| Actual commands and exit codes | `pnpm --filter @micro/prototype-web exec vitest run client/src/storage/local/rollbackRehearsal.r9.test.ts` → 4/4 passed, exit 0. **Negative proof:** with the R9-GA-F1 abort temporarily disabled (`if (false) transaction.abort()`), leg 1 FAILS (state A destroyed — hash mismatch) while legs 2–4 still pass → the regression test detects exactly the fixed defect; fix restored and re-verified 4/4 |
| What this proves | On the fake-indexeddb engine (spec-conformant structured clone and transaction rollback): (1) a synchronous queueing failure inside `replaceSnapshot` now aborts the transaction and leaves the previous state byte-shape intact (the R9-GA-F1 fix); (2) an asynchronous request failure (unique-index collision) fails honestly with full rollback through the documented `transaction.onerror` path; (3) the backup → restore cycle reproduces the exact snapshot hash |
| What this does NOT prove | Real-browser IndexedDB behavior (the engine is fake-indexeddb; the R9-GA-F7 card records the one known engine divergence — put-inside-onsuccess methods — with its exact trigger); multi-tab/versionchange interleavings during replace; QuotaExceeded-style storage-pressure failures |
| Owner/module | storage/local — `indexedDbSnapshot.ts` (`replaceIndexedDbSnapshot`), `IndexedDbLocalStore.ts` (wiring) |
| Acceptance criteria | Honest failure + previous state intact + restore-to-hash for both failure shapes — all asserted green; the regression leg proven able to fail |
| Rollback boundary | Revert the W2 fix commit — the latent non-atomic behavior returns (documented in R9-GA-F1); no data migration involved |

## RB-2 — migration / re-derivation / failure / restore

| Field | Value |
|---|---|
| Rehearsal ID | RB-2 (+ the import-path complement leg) |
| Test file | Same file (describe "R9-W2 RB-2") |
| Exact fixture identity | Historical v25 database seeded with one legacy per-unit allocation policy `rb2-legacy` (rateMinor 50, kind per_output_unit, the same fixture shape as the migration suite's `seedVersionTwentyFiveLegacyPolicy`) |
| Initial state/hash | Direct durable read at version 25 (bypassing the adapter): `rateMinor == 50`, `rateMinorPerWholeUnit` absent; stable-hash captured |
| Backup identity | The direct v25 read (pre-migration capture) |
| Operation and failure injection | Open through the adapter (triggers the real upgrade chain to schema 38) with the upgrade cursor over `allocation-policies` erroring — `vi.spyOn(IDBObjectStore.prototype, "openCursor")` + `queueMicrotask(() => request.onerror?.(new Event("error")))` — the exact documented `guardUpgradeCursor` boundary (`indexedDbMigrations.ts:49-92`) |
| Observed error/status | `{ ok: false, code: "storage_upgrade_failed" }` with the "ترقية التخزين المحلي" message — honest failure, database not opened |
| Restore operation | Direct re-open at v25 (rollback verification), then a clean adapter open (recovery) |
| Final state/hash | After failure: the DB still opens at 25 with the legacy record hash-equal to the pre-migration capture (no partial durable state — the v26 rate-split field was never half-written). After recovery: `rateMinorPerWholeUnit == 50`, `rateMinor == null` — **intentionally transformed under the documented `oldVersion < 26` contract** (not byte-preserving; contract-transforming by design). Full cycle on the recovered store: `readSnapshot` → `replaceSnapshot(same)` → identical hash |
| Relationship/integrity comparison | Policy identity preserved (same id/seriesId/idempotencyKey); the rate value moved to the contract-mandated field and the legacy field nulled exactly as the migration gate defines |
| Actual commands and exit codes | Same vitest invocation → 4/4 passed, exit 0 (the RB-2 legs included) |
| What this proves | A mid-upgrade cursor failure aborts the upgrade transaction with zero partial durable writes (verified by direct version-25 reads, not adapter claims); the clean re-open completes the documented migration; the snapshot backup/restore path is healthy on the recovered database |
| What this does NOT prove | Real-browser upgrade interleavings (multi-tab versionchange races are covered separately by the existing "closes an old connection on versionchange" test); migrations of stores not exercised by the v25 fixture (the migration suite covers each gate individually — this rehearsal proves the failure/recovery cycle, not every gate) |
| Import-path complement (labeled) | `migrateTransferSnapshot` on a malformed legacy raw (non-array drafts, orders with missing follow-up fields, bare schedules) → total null-coalescing normalization, no throw. **In-memory re-derivation only** — the function performs no durable I/O; it is the import-path complement, NOT durable-recovery evidence (Gate-B storage reviewer's labeling requirement honored) |
| Owner/module | storage/local — `indexedDbMigrations.ts` (upgrade gates + failure bookkeeping); application/transfers — `transferSnapshotMigrations.ts` (complement leg) |
| Acceptance criteria | storage_upgrade_failed + rollback-verified-by-direct-read + clean recovery with the contract-mandated transform + restored-hash equality — all asserted green |
| Rollback boundary | No production change in RB-2 (tests only); the RB-1 fix commit's revert does not affect these legs |

## Root fix carried by W2 (R9-GA-F1 — FIX_NOW, within the authorized boundary)

`apps/prototype-web/client/src/storage/local/indexedDbSnapshot.ts` —
`replaceIndexedDbSnapshot`: the queueing section (store handles, clears, puts) is now
wrapped in `try { … } catch (error) { try { transaction.abort(); } catch { /* already finished */ } throw error; }`.
The guarded abort enrolls every queued request into the engine's rollback log before
the auto-commit could destroy the previous state; the original error is rethrown so
the outer catch produces the exact same failure payload (code + message) as before —
no failure-contract change. Growth 430 → 451 nbLOC (WATCH→WATCH) authorized by ledger
entry `R9-GA-F1-ROOT-FIX` in `scripts/file-size-ratchet-reanchors.json` (chained
from/to, owner-review reference = the owner-authorized R9 execution contract §9 +
Gate-B storage reviewer design approval) with the baseline updated in the same PR.
`readIndexedDbSnapshot` deliberately unchanged (readonly transaction; no write blast
radius — Gate-B reviewer's design ruling). The related engine-divergence finding in
the adapter's put-inside-onsuccess methods is recorded as **R9-GA-F7**
(DEFER_WITH_EXACT_OWNER_TRIGGER: real-browser harness trigger) — not silently fixed,
not silently dropped.

## Invariants verified on the W2 tree

`localSchemaVersion=38` / `localExportVersion=30` (`storage/local/types.ts:55,71`)
untouched; no export/import byte change (goldens suite green); no rejection-behavior
change (the failure code/message contract of `replaceSnapshot` is byte-identical —
the fix only adds the abort); no real user data touched (fake-indexeddb + memory
stores only); no visual UI change; entry ceilings untouched.
