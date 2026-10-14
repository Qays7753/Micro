# R11 W1b-3 — OD-TIME Application Ambient-Time Effect-Class Guard — Evidence

**Artifact ID:** R11-W1B3-OD-TIME-EVIDENCE-2026-10-14 | **Slice:** W1b-3 | **Date:** 2026-10-14 (UTC) | **Executor:** ZAI (single W1b writer)
**Decision authority:** OD-TIME (`OWNER_APPROVED — AST_GUARD_NO_ID_INJECTION`, option A with stance D) in the R11 owner decision package; D-12 / R10B-NF-014 in the crosswalk; executed under the canonical W1b execution prompt slice W1b-3.
**Base SHA:** `0ede6e941a7ec276baf1594febb34e2d4ebf14ee` (branch base)

---

## 0. Status

```text
W1B3_OD_TIME — VERIFIED
GUARD_BASELINE — exact: 148 files scanned; 21 approved regions / 21 exempted calls; 1 clock boundary; 7 parse calls; 0 violations
PRODUCTION_BEHAVIOR — unchanged (no src/apps file touched in this slice)
```

## 1. D-03 helper verification (precondition — verified before extending the approach)

`scripts/check-date-arithmetic-ownership.mjs` (R4, the W1A D-03 AST-bound exemption) re-verified before writing: its test suite **19/19 green**; its AST approach (parse-only `ts.createSourceFile`, fail-closed on `parseDiagnostics`, position-pinned exemptions, exact-text operand binding) is the design template this guard follows. No D-03 rule was modified.

## 2. Live census (performed before writing — count not assumed)

Full production scan of `apps/prototype-web/client/src/application/**` (148 files) for every ambient-time token (`Date.now()`, `Date.now` references, `new Date`, `Date.parse`, `performance.now`, `.getTime`, timers):

| Class | Count | Sites |
|---|---|---|
| **Approved ID-fallback family** | **21 — exactly the OD-TIME count** | 17 nullish shape `globalThis.crypto?.randomUUID?.() ?? <fallback>` (assets, budgets, cash, collections, direct-sales, estimates, finance/projectFinancialEventWrites, finance/recurringWork, financial-analysis, financial-records, inventory, loans, loans/received, owner-money, owner, recurring, suppliers) + 4 ternary shape gated on `typeof crypto !== "undefined" && "randomUUID" in crypto` (catalog, cost, drafts, time/actualTimeService) |
| Documented ambient clock boundary | 1 | `application/time/clock.ts` — `systemClock = () => new Date().toISOString()` (STR-618: the only active ambient clock) |
| Explicit parsing (not ambient) | 7 calls | `formatters.ts:211` `new Date(value)`; `localLockService.ts:198/231/263` `Date.parse(this.now())` (+ 2 further explicit-input parses in the layer) |
| `performance.now` / cloaked `Date.now` references / timers | 0 | none live |

**The census reproduced the owner-approved 21-site count exactly** (17 + 4), including the two sub-shapes and the nested-template variants (`${prefix}-${… ?? \`${Date.now()}-…\`}`). Lock-idle sources (`components/security/AppLockGate.tsx`, `application/security/localLockService.ts`) are outside this guard by decision: AppLockGate is a UI component (UI timers stay outside the Application guard), and localLockService's `Date.parse(this.now())` calls are explicit parsing of the injected clock — its behavior is characterized separately in W1b-4 and is untouched here.

## 3. The guard (`scripts/check-application-ambient-time.mjs`, AST-bound, fail-closed)

- **AT-1 — out-of-family `Date.now()`:** rejected unless the call is positionally inside an approved fallback region: the right operand of `??` whose left operand is exactly `globalThis.crypto?.randomUUID?.()` (shape أ), or the alternate branch of a conditional whose condition is exactly `typeof crypto !== "undefined" && "randomUUID" in crypto` and whose consequent actually contains a zero-arg `crypto.randomUUID()` call (shape ب — the consequent may embed the call in a template, the costService variant). **The binding is syntactic, not textual proximity**: comments, strings, `||` instead of `??`, wrong receivers (`randomXUUID`, `foo.randomUUID`), wrong slot (left operand), aliased receivers (`const c = globalThis.crypto`), and bare reads are all rejected — each pinned by a test.
- **AT-2 — 21-site ratchet:** the pinned census (`APPROVED_ID_FALLBACK_SITES`, 17 nullish + 4 ternary) is compared to the live regions per file: a new site in an unlisted file → `AT-new-id-fallback-site` (documented re-anchor required, R9/D-07 pattern); a departed site → `AT-stale-id-fallback-site`; per-file count mismatch → `AT-id-fallback-census-mismatch`.
- **AT-3 — ambient construction:** zero-arg `new Date()` allowed only as the `new Date().toISOString()` shape in `application/time/clock.ts`; anything else (including a second rogue construction inside clock.ts itself) is rejected.
- **AT-4 — cloaked references:** `Date.now` in non-call position (a clock passed as a value) is rejected.
- **AT-5 — performance clocks:** `performance.now()` is rejected in the application layer.
- **Explicit parsing is allowed and counted** (`new Date(value)`, `Date.parse(value)`) — parsing an explicit input is not ambient time.
- **Fail-closed:** parse diagnostics produce `AT-parse-error` violations, never a pass.
- **No clock injection** into the ID family (OD-TIME stance D); **no production file was touched** in this slice — the guard observes, it does not modify.

## 4. Adversarial test suite (`scripts/check-application-ambient-time.test.mjs` — 17/17 green)

Live-census pin (0 violations; 21 regions / 21 exempted calls / 1 boundary / parseCalls > 0) · comment non-exemption · string non-exemption · `||` rejection · wrong receivers ×2 · wrong slot · aliased receiver · bare out-of-family read · deficient ternary condition ×2 (missing `"randomUUID" in crypto`; consequent without a randomUUID call) · ambient `new Date()` outside clock.ts AND a rogue second construction inside it (only the systemClock shape passes) · explicit parsing allowed + counted · `performance.now()` · cloaked `Date.now` reference · new-site ratchet (approved shape at an unlisted file = census violation, not out-of-family) · both approved shapes at their pinned files · parse-error fail-closed · test files out of scan.

## 5. Verification matrix

| Check | Result |
|---|---|
| Guard on live tree | **PASS** — 148 files; 21/21/1/7; zero violations |
| Guard test suite | **17/17 PASS** |
| Full `pnpm guards` chain (now 22 guards) | **GREEN** |
| Door-surfaces ratchet (post W1b-2 re-anchor, separate commit `2eb1c017`) | PASS — 29 doors + 1 root file exact |
| File-size ratchet | PASS (new guard file in NORMAL band; documented reanchors only) |
| Prettier / eslint (ceiling 37) | PASS |
| Typecheck | unchanged from W1b-2 head (no production file touched in this slice; scripts are not in the app tsc program; root tsc covers tests only) — verified green at the wave gate |
| test-map | no drift (scripts tests are outside the map's scope) |
| Production behavior | **unchanged** — the slice touches `scripts/`, `package.json` (guards chain), and records only; the emitted-JS identity from W1b-2 (`index-CPVmJmgX.js` 631,903/155,290) is unaffected |

## 6. Boundary documentation (what this guard deliberately does NOT do)

- It does not govern UI layers (`pages/`, `components/`) — OD-TIME keeps UI timers outside the Application guard; the lock-idle clock (AppLockGate) is characterized in W1b-4 with no behavior change here.
- It does not inject clocks into the ID-fallback family (stance D): the family stays exactly as approved.
- It does not parse types (no Program/typechecker): the binding is syntactic; aliased receivers are conservatively rejected and require a documented re-anchor if a legitimate new site ever appears.
- It does not treat explicit parsing as ambient time.

## 7. Rollback boundary

Revert the W1b-3 commits (guard + test + package.json chain line; the formatting fix travels with them) to restore the 21-guard chain. The re-anchor fix commit `2eb1c017` is independently revertable (it would re-expose the door-surfaces ratchet failure from W1b-2 — so in practice revert W1b-2 first or together).
