# R11 W1b-6 — P-01..P-04 Preservation Evidence — Evidence Matrix

**Artifact ID:** R11-W1B6-PRESERVE-EVIDENCE-2026-10-14 | **Slice:** W1b-6 | **Date:** 2026-10-14 (UTC) | **Executor:** ZAI (single W1b writer)
**Decision authority:** OD-PRESERVE (`OWNER_APPROVED — PRESERVE_ALL_FIVE — EVIDENCE_ONLY`) in the R11 owner decision package; P-01..P-04 in the crosswalk; executed under the canonical W1b execution prompt slice W1b-6.
**Base SHA:** `0ede6e941a7ec276baf1594febb34e2d4ebf14ee` (branch base)

---

## 0. Status

```text
W1B6_PRESERVE_EVIDENCE — VERIFIED
DECOMPOSITION — NONE (zero split/move; the five Preserve cards hold)
NEW_FOCUSED_TESTS — 19 (5 port-surface + 14 craft-order characterization/mutation)
EXISTING_SUITES_USED — the parity/atomicity/error anchors below (all re-run green)
```

## 1. Evidence matrix (per the acceptance contract: source · contract · test anchor · owner · preserved behavior · rollback boundary)

| # | Surface | Source | Contract | Test anchor (this wave) | Test anchor (existing, re-run green) | Owner | Preserved behavior | Rollback boundary |
|---|---|---|---|---|---|---|---|---|
| **P-01** | `IndexedDbLocalStore` | `storage/local/IndexedDbLocalStore.ts` (892-line `types.ts` port; adapter 130 methods) | 130-method `PrototypeLocalStore`; transaction atomicity; `storage_stale`; parity with Memory | **new** `portSurfaceEvidence.test.ts` — prototype exposes **exactly the 130 pinned names** | `adapterConformance.*` (7 files), `IndexedDbLocalStore.*` (6 files), commit guards (9 files), `rollbackRehearsal.r9`, `persistentStorage` — **48 files / 326 tests green** | Micro owner | IndexedDB/Memory parity, atomic replace, guarded commits — untouched (no adapter line changed in this wave) | Revert the new test file alone; nothing else references it |
| **P-02** | `MemoryLocalStore` | `storage/local/MemoryLocalStore.ts` | same 130-method port; in-memory semantics with **documented limitations** | **new** `portSurfaceEvidence.test.ts` — prototype = the 130 names **+ exactly one documented TS-private helper** (`checkRecurrenceSchedule`; runtime-visible because TS `private` is compile-time) + **the in-memory limitation pinned**: each instance is independent state, a fresh instance starts empty, no cross-instance leakage | same conformance families as P-01 (the parity vectors) | Micro owner | parity for the selected contract vectors; no persistence (test-only surface) — unchanged | same single-file revert |
| **P-03** | craft-order policy surface | `src/domain/craft-order/policies.ts` (+ `settlementInvariant`, `depositDerivations`, `deliveryContribution`) | contracts 20/23/40; the AGENTS §6 financial rules | **new** `tests/domain/craftOrderPolicyCharacterization.mutation.test.ts` — **14/14**: (١) review-lock cluster with **full Arabic code-point pins** for every financial write path (collectRemaining/registerDebt/collectDeposit/reverseOrderCollection + the distinct reviseAgreedPrice message), the no-delivery-event boundary (not locked), the reverse-then-reconfirm unlock path; (٢) settlement boundaries — exact-zero settles, one-minor-short does not, over-collection refused with the contract message, **full prepayment + delivery = direct settled** (the documented rule), non-positive amounts refused verbatim, deposit-on-delivered and premature collection refused verbatim; (٣) **mutation/weakening drills** — raw status tampering opens the lock (the lock is state-derived inside the pure-function contract; the compensating control against tampered inputs is the storage layer: `storage_stale` + commit guards — documented, not a new defect), delivery-event removal drops the lock **but the independent status check still refuses collection (layered defense)**, idempotency replay returns the same reference, second-key over-limit refused while in-limit passes to the ceiling | `craft-order*.test.ts` family (review-lock, d031, d15-settlement, deposit-derivations, corrections, delivery-terms, g3) + `reviewLockBoundary` — **114 tests green across the re-run set** | Micro owner | policy logic, messages, rounding, invariants — **zero production lines changed** | single-file revert |
| **P-04** | `storage/local/types.ts` | the 892-line file itself | 130 methods; schema 38 / export 30; record/type ownership | **new** `portSurfaceEvidence.test.ts` — **AST-extracted** interface method count = **130** with the pinned sorted name list (bidirectional membership; any add/remove fails until a documented re-anchor); `localSchemaVersion === 38` and `localExportVersion === 30` pinned by value; ownership evidence = the persistent-entity registry guarded by `check-entity-touchpoints.mjs` (live guard, PASS) | entity-touchpoints guard + the transfer suites that pin wire compatibility (goldens/releasedPairs — re-run green in W1b-2: 303 tests) | Micro owner | the file is not split, not moved, not rewritten — read-only census | single-file revert |

**P-05** (`transferFamilyValidators` + ADR-017) remains W2 scope per the crosswalk (`PRESERVE_WITH_W2_EVIDENCE`) — untouched here, as the W1b contract requires.

## 2. What this slice changed

Exactly two new test files and records — **zero production lines**:

1. `apps/prototype-web/client/src/storage/local/portSurfaceEvidence.test.ts` (5 tests) — the P-04/P-01/P-02 method-count + membership + constants + in-memory-limitation evidence.
2. `tests/domain/craftOrderPolicyCharacterization.mutation.test.ts` (14 tests) — the P-03 direct characterization + boundary values + Arabic message code points + mutation/weakening drills.

One transcription slip during development (a phantom `saveOwnerMovement` in the pinned list) was caught **by the test itself** against the AST extraction and removed before commit — the pin works exactly as designed (bidirectional membership, no hand-copied drift).

## 3. Verification matrix

| Check | Result |
|---|---|
| New port-surface suite | **5/5 PASS** |
| New craft-order characterization suite | **14/14 PASS** |
| Full storage suites (P-01/P-02 anchors) | **48 files / 326 tests PASS** |
| Craft-order suites (P-03 anchors) | **114 tests PASS** (re-run set) |
| Transfers suites (P-04 wire anchors — from W1b-2) | 32 files / 303 tests PASS |
| Entity-touchpoints guard (ownership) | PASS (live, in the guards chain) |
| Typecheck (root + app) | PASS |
| Production files touched | **zero** — no split, no move, no rewrite of any Preserve surface |
| Emitted JS | unchanged (`index-CPVmJmgX.js` — no production change since W1b-2) |

## 4. Honest boundary notes (documented, not new findings)

- The Memory adapter's single TS-private helper is runtime-visible on the prototype (TypeScript `private` is compile-time); it is pinned by name in the evidence test so any new helper — private or public — fails until documented (no hidden surface behind the contract).
- The P-03 mutation drills characterize the domain's trust boundary: the review-lock is a state-derived policy inside pure functions; defense against externally-tampered input state is the storage layer's contract (`storage_stale` identity + commit guards + idempotency keys). This is the documented division of responsibility, recorded here as characterization — not a defect, not a fix.

## 5. Rollback boundary

Both new test files are independently revertable (delete the file); no other slice or production code references them. The evidence matrix and records travel with this slice's commit.
