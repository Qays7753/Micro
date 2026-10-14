# R11 W1b-4 — Lock-Idle Characterization (Only) — Evidence

**Artifact ID:** R11-W1B4-LOCK-IDLE-CHARACTERIZATION-2026-10-14 | **Slice:** W1b-4 | **Date:** 2026-10-14 (UTC) | **Executor:** ZAI (single W1b writer)
**Decision authority:** OD-TIME (`OWNER_APPROVED — AST_GUARD_NO_ID_INJECTION` — the lock-idle characterization slice); executed under the canonical W1b execution prompt slice W1b-4.
**Base SHA:** `0ede6e941a7ec276baf1594febb34e2d4ebf14ee` (branch base)

---

## 0. Status

```text
W1B4_LOCK_IDLE — CHARACTERIZATION_COMPLETE
RUNTIME_BEHAVIOR — UNCHANGED (zero production lines touched by this slice)
NEW_FINDINGS — 3 (R11-W1B4-NF-001/002/003 — all OWNER_DECISION_REQUIRED; none patched)
```

## 1. The characterized surface

- **Clock source (service):** `LocalLockService` (`application/security/localLockService.ts`) — an injected `Clock` (default `systemClock`, STR-618); idle decisions compute `Date.parse(this.now()) - Date.parse(record.lastActiveAt)`; unlock/disable backoffs compute the same against `record.lastFailedAt`.
- **Gate (component):** `AppLockGate` (`components/security/AppLockGate.tsx`) — `visibilitychange` hidden→`touchActivity`, visible→`evaluate`; a 30-second heartbeat while open that touches activity when the last real input is ≤ 30s and re-evaluates otherwise; the overlay is a full-screen dialog with `inert` content underneath; recovery routes (`/setup`, `/settings`) are exempt by contract 37.
- **No behavior was changed.** This slice adds tests and evidence only.

## 2. Deterministic characterization matrix (service level — injected fake clock; real MemoryLocalStore)

`application/security/localLockService.idleCharacterization.test.ts` — **13/13 green**:

| # | Condition | Observed behavior | Classification |
|---|---|---|---|
| 1 | Forward time: 9.99 min (< threshold) / exactly 10 min / 45 min (threshold 10) | no lock / **locks** / locks — the boundary is inclusive (`>=`) | **FAIL_CLOSED** |
| 2 | Forward time beyond any threshold | always locks | **FAIL_CLOSED** |
| 3 | **Backward clock** (now < lastActiveAt, 2h and 10k min behind) | `shouldLockNow` returns **false** — the negative elapsed never reaches the threshold; the idle lock is postponed indefinitely under device-clock rollback | **FAIL_OPEN — R11-W1B4-NF-001 (new finding)** |
| 4 | Suspend/resume model (hidden→touch, +35 min real, visible→evaluate) | locks on re-evaluation | **FAIL_CLOSED** |
| 5 | Short suspension (+20 s, threshold 1 min) | stays open | as designed |
| 6 | Reactivation (correct PIN after 3 failures + expiry) | `failedAttempts` reset to 0; `lastActiveAt` = unlock instant; immediate re-check open; a full new idle window locks again | as designed |
| 7 | Repeated lock→unlock→idle→lock cycles ×2 | deterministic | as designed |
| 8 | Unknown activity (`lastActiveAt: null`) | locks immediately | **FAIL_CLOSED** |
| 9 | `autoLockMinutes: null` | never idle-locks (the documented manual-only choice) | AS_DESIGNED |
| 10 | Backoff window: inside (1 s of a 3 s window) / at the edge (3 s) | early-reject **without** incrementing (counter stays 3, `retryInMs` reported) / proceeds and increments to 4 | as designed |
| 11 | **Backward clock during the backoff window** (now < lastFailedAt) | the `elapsed >= 0` guard fails → no early reject → the attempt is verified and the counter increments immediately | **FAIL_OPEN (limited) — R11-W1B4-NF-002 (new finding)**: clock rollback bypasses the enforced waiting period; each guess still costs a real PBKDF2 (120k iterations) and the counter stays honest |
| 12 | Storage read failure | the service returns an honest `storage_error` (it does not decide) | service honest; see the gate row below |
| 13 | Correct-PIN verification result independent of clock position | unlock succeeds even with the clock rewound | as designed |

## 3. Deterministic characterization matrix (gate level — jsdom, one fake clock driving the injected service clock, the heartbeat interval, and the input-idle measurement; real LocalLockService + real PBKDF2)

`components/security/AppLockGate.idleCharacterization.test.tsx` — **9/9 green**:

| # | Condition | Observed behavior | Classification |
|---|---|---|---|
| 1 | Hidden → real elapsed 10 min (threshold 1) → visible | full-screen lock overlay appears | **FAIL_CLOSED** |
| 2 | Hidden → 20 s → visible | stays open | as designed |
| 3 | Continuous use: input every ~25 s, heartbeats tick | session stays alive across the nominal threshold (touch on input) | as designed |
| 4 | **Visible idle, gradual clock** (8×31 s heartbeats, no input) | **never locks** — each heartbeat evaluates, finds elapsed < threshold, and touches, renewing the idle clock indefinitely | **AS_DESIGNED (important characterization)** — the visible app cannot idle-lock; the lock engages on hidden duration, exactly as contract 37 documents («نبض ٣٠ ثانية أثناء الظهور يمنع قفلًا أثناء الاستخدام المتواصل») |
| 5 | Visible idle, single large time jump (+5 min between heartbeats) | locks at the next heartbeat | **FAIL_CLOSED** (the catch-up path: device sleep/clock correction) |
| 6 | Locked + correct PIN | overlay removed; content stays mounted underneath (no state loss) | as designed |
| 7 | Locked + wrong PIN | overlay stays; honest message (single attempt shows the plain form; the counted form appears from the 3rd attempt with the enforced delay) | as designed |
| 8 | Recovery route (`/settings`) beyond threshold | no overlay (emergency paths are exempt; destructive actions inside Settings remain PIN-gated per the existing `Settings.lockGate.dom` suite) | AS_DESIGNED |
| 9 | **Storage read failure at the gate** | `status()` not-ok → the gate sets **open** directly | **FAIL_OPEN — R11-W1B4-NF-003 (new finding)**: a storage-layer failure (e.g. blocked IndexedDB) opens the app without the lock overlay; the service itself reports honestly |

## 4. Real-browser proof (equivalent browser evidence — executed and green)

`evidence/R11-W1B4-LOCK-IDLE-BROWSER-PROOF-2026-10-14.json` — real Chromium driving the **exact production bundle** (`dist/public`, entry `index-CPVmJmgX.js` 631,903/155,290), locale `ar-JO`, timezone `Asia/Amman`:

1. The real setup wizard was completed through the UI; the local lock was enabled through the real Settings card with **auto-lock = 1 minute** (PIN 4179).
2. The app was hidden (visibilitychange; see the documented headless limitation below) for a **real 70-second wall-clock duration**.
3. On becoming visible, the real evaluation ran and the **full-screen lock overlay appeared** (t≈91.5 s on the run timeline).
4. The **correct PIN unlocked it** through the real PBKDF2 verification (t≈91.6 s); content stayed mounted.
5. The run also re-confirms the design note: the proof had to move off `/settings` to a gated route first — the recovery-route exemption is real.

**Documented limitation (`UNVERIFIED` aspect):** headless Chromium does not switch `document.visibilityState` on tab switches, so the `visibilitychange` event was dispatched synthetically; the production handler, the real 30-second timers, the real wall clock, the real IndexedDB persistence, and the real PBKDF2 all ran for real. A physical device test (real tab switch / screen lock) remains `NOT_EXECUTED` (no device available in this environment) — the standing environment pair limitation. The final screenshot is kept outside the repository per the repo image policy (report screenshots are not allowed in `docs/`).

## 5. New findings (durable IDs — none patched; all owner decisions)

| ID | Finding | Severity | Classification | Disposition |
|---|---|---|---|---|
| **R11-W1B4-NF-001** | Idle-lock bypass via device-clock rollback: `shouldLockNow` computes a signed elapsed; a clock set before `lastActiveAt` makes the elapsed negative and the idle lock never engages (including on re-visibility after real idle) | Medium (local glance-protection threat model; requires device clock control) | `VERIFIED_FROM_REPOSITORY` (deterministic reproduction, test 3) | `OWNER_DECISION_REQUIRED` — options: clamp negative elapsed to "lock" (fail-closed), or accept and document (the lock is contract-37 glance protection, not encryption). No silent fix in W1b. |
| **R11-W1B4-NF-002** | Wrong-PIN backoff bypass via clock rollback: the `elapsed >= 0` guard makes a backward clock skip the early-reject window, accelerating guesses (each still costs PBKDF2-120k and increments the honest counter) | Low-Medium | `VERIFIED_FROM_REPOSITORY` (test 11) | `OWNER_DECISION_REQUIRED` — same option family as NF-001. |
| **R11-W1B4-NF-003** | Gate fail-open on storage read failure: `status()`/`shouldLockNow()` not-ok → the gate opens without the overlay | Medium (availability-over-lock trade-off) | `VERIFIED_FROM_REPOSITORY` (test 9) | `OWNER_DECISION_REQUIRED` — options: distinguish "no lock configured" from "lock unreadable" (fail-closed overlay with an honest error), or accept the availability trade-off and document it in contract 37. |

## 6. Verification matrix

| Check | Result |
|---|---|
| Service characterization suite | **13/13 PASS** |
| Gate characterization suite | **9/9 PASS** |
| Existing lock suites unchanged | service 9/9 + `Settings.lockGate.dom` 14 — all green (45 total across the four lock files) |
| Real-browser proof | **ok: true** (locked at t≈91.5 s, unlocked t≈91.6 s; JSON committed) |
| Production behavior | **zero production lines changed** in this slice — the lock files are untouched (diff-scope) |
| Emitted JS | unchanged from the W1b-2 proof (`index-CPVmJmgX.js`) — no production file touched since |

## 7. Rollback boundary

This slice's commit contains only the two new test files, the browser-proof JSON, and records — reverting it removes the characterization evidence and changes nothing else.
