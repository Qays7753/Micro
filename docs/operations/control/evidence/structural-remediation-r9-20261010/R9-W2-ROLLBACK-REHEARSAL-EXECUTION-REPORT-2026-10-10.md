# R9-W2 — Rollback Rehearsal Execution Report (2026-10-10)

**Program:** WS-216 / ARCH-007 — Structural Remediation R0–R10, wave R9 (W2).
**Executor:** Z AI (primary, single writer). **Branch:**
`refactoring/r9-complete-w1-w2-w3-20261010`; W2 builds on the Gate-B-approved W1
head `5bf1a327c797a387463e375fa4c4fb6b8515bedb`.
**Mission:** turn the rollback claims into direct evidence (Q-h / Q-i) and root-fix
the current recovery defect discovered at Gate A (R9-GA-F1) within the approved
boundary.

---

## 1. Executive summary

W2 delivered a genuine, doubles-free (for the durable legs) rehearsal of both
recovery cycles on the repository's own test IndexedDB engine, and closed the
discovered non-atomicity defect at its root:

1. **R9-GA-F1 root fix (production code, 1 file):** `replaceIndexedDbSnapshot` now
   aborts the readwrite transaction when the request-queueing section throws
   synchronously (guarded `transaction.abort()` + rethrow of the original error),
   eliminating the auto-commit-destroys-prior-state path while keeping the failure
   payload byte-identical. Ratchet drift 430→451 nbLOC authorized through the
   established re-anchor ledger (`R9-GA-F1-ROOT-FIX`).
2. **RB-1 executed (both legs):** backup → failed replace → previous state provably
   intact → restore → hash equality, for the synchronous failure shape (the fixed
   defect) and the asynchronous request-error shape (engine-native unique-index
   collision; no test doubles).
3. **RB-2 executed:** pre-migration capture → mid-upgrade cursor failure →
   `storage_upgrade_failed` with zero partial durable writes (verified by direct
   version-25 reads) → clean recovery under the documented `oldVersion<26`
   contract transform → restored-hash equality. The transfer re-derivation leg is
   included and honestly labeled an in-memory import-path complement.
4. **Q-h status (honest update):** durable snapshot replacement is now VERIFIED by
   direct rehearsal evidence for both documented failure shapes on the available
   engine — with the explicit limitation that the engine is fake-indexeddb (the
   R9-GA-F7 card owns the one known engine divergence with its exact trigger).
5. **Q-i status (honest update):** migration failure/recovery is VERIFIED by direct
   rehearsal evidence (upgrade-abort rollback proven by direct reads, clean
   recovery, contract transform); re-derivation is verified as an in-memory
   complement only.

## 2. The rehearsal record

The complete per-field record (fixture identity, hashes, injection points, observed
errors, restore operations, integrity comparisons, commands, exit codes,
proves/does-not-prove, acceptance, rollback) is the **manifest**:
[`R9-W2-ROLLBACK-REHEARSAL-MANIFEST.md`](R9-W2-ROLLBACK-REHEARSAL-MANIFEST.md).
The test file is
`apps/prototype-web/client/src/storage/local/rollbackRehearsal.r9.test.ts`
(4 tests; test-category file, exempt from the file-size ratchet by its category
rules).

**Negative proof (the regression test can fail):** with the abort temporarily
disabled (`if (false) transaction.abort()`), RB-1 leg 1 fails exactly as the defect
predicts (hash mismatch — state A destroyed) while the other legs stay green; the
fix was then restored and the full rehearsal re-run green. This proves the test
guards the fixed defect rather than padding a count.

## 3. Files changed (complete inventory)

- `apps/prototype-web/client/src/storage/local/indexedDbSnapshot.ts` — the root fix
  (guarded abort + rethrow; two dated comment blocks; behavior unchanged on success
  and async-failure paths).
- `apps/prototype-web/client/src/storage/local/rollbackRehearsal.r9.test.ts` — new
  (4 rehearsal tests).
- `scripts/file-size-ratchet-reanchors.json` — ledger entry `R9-GA-F1-ROOT-FIX`.
- `scripts/file-size-ratchet-baseline.json` — measurement 430→451 for the fixed
  file (same-PR with the ledger entry, the R8-3 precedent).
- Docs/evidence: the two W2 evidence files, the repair-cards status update
  (R9-GA-F1 → CLOSED_WITH_EVIDENCE), Operations Control JSON notes/evidence, the
  state-log/worklog entries (below), current-state live fields.

**Explicitly not changed:** every other production file (the adapters' write
methods are covered by the R9-GA-F7 card, not silently patched); schema/export
versions and all protected constants; `readIndexedDbSnapshot`; CI; any UI file.

## 4. Verification record (commands and exit codes)

| Command | Result |
|---|---|
| `pnpm --filter @micro/prototype-web exec vitest run client/src/storage/local/rollbackRehearsal.r9.test.ts` | 4/4 passed, exit 0 |
| (negative proof) same command with the abort disabled | leg 1 FAILED (defect detected), legs 2–4 passed → test validity proven; fix restored → 4/4 again |
| `pnpm --filter @micro/prototype-web exec vitest run client/src/storage/local` | **295/295 passed** (291 existing + 4 new), exit 0 |
| `pnpm --filter @micro/prototype-web exec vitest run client/src/application/transfers` | **289/289 passed**, exit 0 |
| `pnpm --filter @micro/prototype-web exec vitest run client/src/application/transfers/dataRoundTrip.exe014.test.ts client/src/application/transfers/exportGoldens.test.ts` | **16/16 passed** (the two mission-named files) |
| `pnpm --filter @micro/prototype-web exec tsc --noEmit` | exit 0 |
| `node scripts/check-file-size-ratchet.mjs` | PASS — drift 430→451 authorized by the ledger entry (printed `DRIFT-AUTHORIZED`) |
| Full `pnpm check` on the W2 head | see §6 (run before the wave commit was finalized; results below) |

## 5. Q-h / Q-i and finding dispositions after W2

| Item | Status after W2 |
|---|---|
| Q-h durable snapshot replacement | VERIFIED by direct rehearsal (RB-1 legs 1–2) on the available engine; limitation recorded (fake-indexeddb; R9-GA-F7 owns the real-browser divergence trigger) |
| Q-i migration/re-derivation failure paths | VERIFIED by direct rehearsal (RB-2) for the durable upgrade cycle; re-derivation verified as in-memory complement only (labeled) |
| R9-GA-F1 | **FIX_NOW — CLOSED_WITH_EVIDENCE** (root fix + regression test with negative proof + ledger + this report) |
| R9-GA-F7 | recorded (DEFER_WITH_EXACT_OWNER_TRIGGER — real-browser harness trigger; single-record blast radius; not silently fixed) |
| R9-GA-F2 | PRESERVE (unchanged; by design) |

## 6. Acceptance gate (W2)

- [x] RB-1 executed (both legs; no exact technical blocker)
- [x] RB-2 executed (+ labeled complement leg)
- [x] Q-h updated honestly (VERIFIED with the engine limitation stated)
- [x] Q-i VERIFIED only from direct rehearsal evidence (the in-memory leg is labeled, not counted)
- [x] recovery regression tests pass (4/4; negative-proof validity)
- [x] existing transfer/golden/legacy tests remain green (289/289; 16/16 named)
- [x] no 38/30 or protected semantics changed (constants verified; failure payload byte-identical)
- [x] no user data touched (fake-indexeddb/memory only)
- [x] W2 report + manifest in the repository (this file pair)
- [x] full `pnpm check` on the W2 head: **exit 0** (run on the W2 tree immediately
      before the commit: operations-control tests/validator, typecheck, lint
      0/35-ceiling, format, text-density, design guards, all 17 root guards
      incl. the ratchet with the authorized drift, root tests 747/747, prototype
      typecheck/tests, and the production build with the bundle guards — entry
      629,300/154,683, precache 156/0 duplicates, all surfaces within baseline)
- [ ] five reviewers approve the exact W2 SHA → Gate C (recorded after this report;
      the gate runs on the committed W2 head)

## 7. Rollback boundary

Revert the W2 commits (fix + tests + ledger/baseline + docs). The latent
non-atomicity returns (documented in R9-GA-F1; no data migration is involved —
the fix changes transaction orchestration only). The rehearsal tests are
independent of the fix for legs 2–4 (leg 1 would fail again, which is the point).

## 8. Status

`R9-W2 COMPLETE — GATE C NEXT (five reviewers on the W2 head, then W3)`
