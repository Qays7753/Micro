# MICRO — Full System Review — Findings

- **Date:** 29 August 2026
- **Reviewed commit:** `main @ 8ee0832` ("merge: system review remediation — B-01, B-03, U-03, P-01 layer 0")
- **Review team:** Review Coordinator + five specialist agents (Code, Accounting, UX, Language, Expansion)
- **Inputs:** source repository `https://github.com/Qays7753/Micro.git` (main branch) and live deployment `https://micro-prototype.pages.dev/`
- **Companion document:** `MICRO-REMEDIATION-PLAN.md`

> **Finding IDs in this report (`C-##`, `A-##`, `U-##`, `L-##`, `E-##`) are NEW findings of this review.** Prior-review codes (`B-01`, `D-01`, `P-01`, `X-01`, …) appear only in §3 and in one-line `PRIOR-STATUS` verdicts — they are never restated as findings. Where two agents found the same defect, the finding appears once under its primary agent, with the other ID listed alongside.

---

## 1. Scope and method

**What was read.** The full `src/domain/` (11 modules), `apps/prototype-web/client/src/` (pages, components, application services, storage adapter, app shell, presentation), `docs/contracts/` (30 contracts — 01–17, 20-agreement, 21-guided-opening, 22-bounded, 23-general-correction verified in depth by the accounting agent; network contracts 18–24 cross-referenced by the expansion agent), `docs/expansion/` (all 28 items including historical-source), `docs/operations/current-state.md`, `AGENTS.md`, and `docs/quality/system-review-remediation-plan-v1.md` (the prior review, read first by every agent).

**What was run.**

- `pnpm install --frozen-lockfile` — clean install.
- `pnpm check` — full gate (typecheck + lint + tests + build). Result in §2.
- `pnpm lint` — captured and ranked all 48 warnings; the four largest complexity clusters (contribution margin, short-cash, owner entitlement, allocation policy) were traced line-by-line by the code agent; none concealed a demonstrable defect, so none is reported.
- **Live deployment walked end-to-end in a real headless browser** (360/390/430 viewports): first-run Setup, draft → cost → agreement → order lifecycle, collection, financial-event recording and reversal, Finance period layers, G5 declarations, Settings, export/import surfaces. Touch targets measured with bounding boxes across 17 routes; interruption behaviour tested with real browser-back mid-form.
- **Executed numeric reproducers.** The accounting and code agents ran throwaway scripts (outside the repo) against the real services on `MemoryLocalStore` to confirm A-01, A-02, A-03, A-04, A-05, A-06, C-01, C-02 with actual numbers. The coordinator independently re-verified the source of C-01, A-01, A-02, and the U-01/L-06 guard gap before accepting them.

**What could not be accessed.** Nothing. Both inputs were reachable:

- Repository — **reachable** (cloned, `main` at `8ee0832`).
- Live deployment — **reachable** (HTTP 200; the Arabic RTL app renders and is fully walkable; first-run Setup observed in a fresh profile).

Consequently **no finding in this report is marked `SOURCE: code-only` for lack of access**; the few `code-only` markings mean the specific behaviour was verified in code (often by execution against the domain/services) rather than observed on the deployed screen. No screenshot or screen was invented.

**Method per finding.** Every finding below satisfies all four evidence requirements: located (path:line or document+section), demonstrated (excerpt, worked numeric example with hand-computed expectation, or reproduction steps), consequential (a specific failure scenario), and classified (severity + confidence per the fixed rubrics). Agents were instructed to reject any suspicion they could not turn into a failure scenario; the coordinator merged duplicates and re-verified every CRITICAL/HIGH finding's source location.

**Honest limits.** (1) Mobile Safari/Android real-device behaviour (PWA install, standalone mode, offline reload) was not tested — consistent with the project's own "no field acceptance claim" rule. (2) The 48 lint complexity warnings were risk-ranked, not exhaustively line-traced for the low-ranked half. (3) Arabic copy judgements are labelled as judgements where they are judgements; the owner's own «إعلان» example anchors the language review.

---

## 2. Baseline verification

| Check | Command | Result |
|---|---|---|
| Full gate | `pnpm check` | **PASS — exit 0** |
| Typecheck | (part of check) | clean |
| Lint | `pnpm lint` | **0 errors, 48 warnings** — exactly the expected baseline (complexity + max-lines-per-function; no new warning classes appeared) |
| Root test suite | (part of check) | 10 files, **87 tests passed** |
| Prototype test suite | (part of check) | 49 files, **264 tests passed** |
| Build | (part of check) | succeeds; vendor chunk split working (B-01 fix confirmed in output) |

The baseline is green. All runtime-behaviour claims in this report stand on this verified foundation; the two executed CRITICAL reproducers (A-01, C-01) also ran against the same commit.

---

## 3. Prior-review status

The prior review (`docs/quality/system-review-remediation-plan-v1.md`, 24 findings) was read first by every agent. Each code below was re-verified against `main @ 8ee0832`. **No prior finding is restated as a new finding.**

| Prior code | Status | Verified by / evidence |
|---|---|---|
| B-01 (bundle splitting broken) | **Fixed** | Code agent — `vite.config.ts:266` function-form `manualChunks(id)`; vendor chunk visible in build output |
| B-02 (dependency vulnerabilities) | **Fixed** | Code agent — vitest `^4.1.11`, vite `^7.3.6`; CI audit green |
| B-03 (build tooling in product bundle) | **Fixed** | Code agent — dev plugins isolated in `devOnlyPlugins(mode)` (`vite.config.ts:242–249`) |
| D-01 (no linter/formatter) | **Fixed** | Code agent — `.prettierrc.json` + `eslint.config.js`; 48-warning baseline as planned |
| D-02 (two rounding policies in one repo) | **Partially fixed** | Code + accounting agents — `src/domain/shared/` exists and newer modules use it, but `craft-order/policies.ts:134,147` still uses raw `Math.round`, `owner-entitlement/policies.ts:520,586,618,662` uses `Math.floor`/hand-rolled half-up, a page re-implements the policy (`Catalog.tsx:158`), and the promised ESLint `no-restricted-syntax` guard was never added. See new finding **A-07** |
| D-03 (unit cost vs planned cost reconciliation) | **Fixed** | Accounting agent — contract 03 documents the 100÷3=34 example; `tests/domain/shared.test.ts:69-71` asserts it; `plannedCostMinor` is never rendered adjacent to `unitCostMinor` |
| D-04 (single knowledge state, multiple deficiencies) | **Still open** | Accounting agent — no `knowledgeGaps` field exists anywhere; `determineKnowledgeState` (`craft-order/policies.ts:81-112`) still returns one most-severe state (`incomplete` masks `stale`). The masking is now contract-sanctioned (contract 03 §update-rules), but the surfaced-deficiency-list remedy was never built |
| D-05 (`Currency` defined then ignored) | **Fixed** | Code + accounting agents — `Currency`/`MoneyMinor` in `shared/currency.ts`; zero `"JOD"` literals in `src/domain` outside shared |
| G-01 (governance reading volume) | **Open — owner decision** (group C, no code) | unchanged by design |
| G-02 (AGENTS.md numbering broken) | **Fixed** | Code agent — numbering sequential |
| G-03 (financial rules as CI architecture tests) | **Open — owner decision** (group C, no code) | unchanged by design |
| P-01 (no backup path independent of user discipline) | **Partially fixed** | UX agent — layer 0 shipped (`requestPersistentStorage()` at boot, `StartupGate.tsx:42-44`, honest Settings row observed live); **layers 1–3 absent** (no `lastExportAt` anywhere; export is 3 taps behind an icon-only affordance — new UX aspects carded as **U-11**, cadence/reminder layers not re-carded) |
| P-03 (migration cursors without error handler) | **Fixed** | Code agent — `guardUpgradeCursor` sets `cursor.onerror` → aborts upgrade; covered by `IndexedDbLocalStore.test.ts:718` |
| P-04 (second tab disables storage) | **Fixed** | Code agent — `onversionchange` closes connection, `storage_stale` surfaced, StartupGate recovery screen with 3 tests |
| U-01-prior (zero rendering tests) | **Fixed** | UX agent — `U01.dom.test.tsx` with jsdom, the 5 planned tests, green in baseline |
| U-03-prior (fragile route ordering) | **Fixed** | UX agent — `path="/"` last before NotFound (`MicroRouter.tsx:74-75`) |
| X-01 (`activityType` blocks any second profile, breaks exports) | **Still open** | Code + accounting agents — `"custom_craft"` remains a fixed literal (`storage/local/types.ts:36`) and a hard rejection in `guidedOpeningImportService.ts:109` / `localTransferService.ts:797`. Contract 21 now documents the Prototype limit, but the export-breakage risk on a second profile is unchanged |
| X-02 (coverage reading before any profile) | **Still open** | Coordinator — «التغطية» appears nowhere in `docs/product/activity-profiles-and-hybrid-projects-v1.md`; the documentation change was never made (consistent with Profiles being deliberately stopped) |
| X-03 (per-profile gap analysis before sector choice) | **Still open** | Expansion agent — the First-Wedge card §1 is an empty template; `DECISIONS` EX-O01/O02 keep sector/region undecided |
| X-04 (profile exit gate: disable ≠ delete) | **Still open** | Expansion agent — no document addresses profile exit or withdrawn-profile data |
| X-05 (supplier acquisition + revenue model) | **Partially answered** | Expansion agent — `COMMERCIAL-LIQUIDITY-AND-MODEL-DECISION-CARD` frames options honestly with consequences; fees banned until evidence; decision itself still open |
| X-06 (courier never responds state) | **Still open** | Expansion agent — contract 21 defines no no-response/timeout state; grep for timeout/«لم ترد»/«مهلة» across expansion + contracts 18–24 returns zero matches. See new finding **E-01** |
| X-07 (post-publish moderation review) | **Answered in docs** | Expansion agent — contract 20 §3.3 (`approved_for_publish → paused | archived | update_required`) + contract 22 §2 report decisions |
| X-08 (navigation + privacy) | **Answered in docs** | Expansion agent — E-00.14 IA contract (السوق in BottomNav, no central services page), contract 21 §4 preview/consent, contract 24 §2 classification, ROLE-ACCESS-MATRIX §3 |

**Protected strengths re-verified intact** (prior review §7): S-01 KnowledgeState, S-02 ResultStatus, S-03 reversal functions (store-enforced transactionally for financial events — `IndexedDbLocalStore.ts:698-788`), S-04 layer separation (one exception → new finding C-06/A-07 page-level computation), S-05 integer minor-unit arithmetic guards, S-06 export/import validation rigour. P-02 (cursor migrations) and B-04 (repo hygiene) unchanged and healthy.

---

## 4. Findings by agent

### 4.1 Agent 1 — Code review (`C-##`)

Scope: `src/domain/` and `apps/prototype-web/client/src/`. Six findings reported; three are merged into accounting findings where the same defect was traced deeper (C-02 → A-02; C-04 and C-05 → A-07). Standalone findings below, ordered by severity.

#### [C-01] Reversed operating expenses never leave the G5 break-even / contribution-margin reading
- Severity: CRITICAL
- Confidence: CONFIRMED
- Location: `apps/prototype-web/client/src/application/g5/g5Service.ts:176-201` (`expenseInputs`)
- Source: code-only (executed reproducer)

**What happens**
`expenseInputs()` filters financial events to `event.operatingExpenseDeltaMinor > 0 || unallocatedShared`. A reversal event carries `operatingExpenseDeltaMinor = -amount`, so the reversal is always filtered out — while the original expense (delta `+amount`) is still included. Net effect: reversing an operating expense has **zero** effect on the G5 reading (contribution margin, fixed expenses, break-even units). The same file's `payables()` (line 229) and `listLinkOptions()` (line 293) *do* exclude reversed originals, and `projectFinancialService.readRecordedPeriodResult` nets reversals in — G5 is the odd one out, an oversight rather than a policy.

**Evidence**
Executed repro (throwaway test on `MemoryLocalStore`, tree left clean). One delivered final order (revenue 5000, cost 1800), one `operating_expense_cash` of 1000 minor recorded then reversed via `finance.reverse`:
```
BEFORE: { fixed: 1000, margin: 3200, status: 'available', breakEven: 1 }
AFTER : { fixed: 1000, margin: 3200, status: 'available', breakEven: 1 }   // identical
```
Same result for an allocated shared-percentage expense. For an *unallocated* shared expense the reversal copies `expenseContext` with `allocation: "unallocated"`, so both original and reversal pass the filter and the unallocated total is counted twice (gap reasons duplicated). Coordinator re-verified the filter at source (`sed -n '170,205p'`): the `> 0` predicate is exactly as described.

**Failure scenario**
Owner records a 10 JOD fixed expense, then reverses it as a mistake ("خطأ في الإدخال"). The G5 screen (نقطة التعادل) continues to show the same fixed expense, margin, and break-even units as before the reversal — while the G3 period result on the Finance screen correctly drops it. Two screens the owner compares disagree, and the break-even the owner prices against is wrong.

**User impact**
The owner makes pricing/volume decisions on a break-even that still contains an expense they explicitly cancelled. This is exactly the "materially wrong decision" Micro exists to prevent, and it silently contradicts the G3 reading shown next to it.

---

#### [C-03] Break-even formula re-implemented in the application layer without the domain's safe-integer honesty guards
- Severity: MEDIUM
- Confidence: LIKELY
- Location: `apps/prototype-web/client/src/application/finance/projectFinancialService.ts:601-604`

**What happens**
`breakEvenUnits = Math.ceil((fixedExpenseMinor * finalDeliveredQuantity) / directMarginMinor)` duplicates the domain's `calculateBreakEven` (`src/domain/g5/policies.ts:440-477`), which computes the same ratio via `ceilRatio` with explicit `Number.MAX_SAFE_INTEGER` guards and returns `null` + a reason on overflow. The application copy silently computes with floats beyond safe precision and drops the honesty behaviour. This is also a layering violation — financial meaning (break-even) computed in an application service instead of `src/domain/` (fact, not judgement).

**Evidence**
Domain (`g5/policies.ts:452-463`): numerator/denominator each checked against `MAX_SAFE_INTEGER` before `ceilRatio`; overflow → `status: "invalid"` + reason «تعذر حساب وحدات التعادل ضمن الدقة الآمنة». Application (line 601-604): single unguarded float multiply/divide + `Math.ceil`. Example: `fixedExpenseMinor = 9_007_199_254_740_993`, `finalDeliveredQuantity = 2`, `directMarginMinor = 4` → numerator = 1.8014…e16 > 2^53; float division silently loses units where the domain deliberately says "not computable".

**Failure scenario**
Two rules with the same name live in two layers. Today they agree numerically; the next change to either (rounding basis, overflow policy) drifts them apart, and the coverage card and the G5 card will show different break-even numbers for the same period. At extreme-but-accepted inputs the app-layer number is silently imprecise.

**User impact**
No wrong number today; the cost is a second, weaker copy of the system's most sensitive formula that can drift from the guarded one and already violates the "financial meaning lives only in src/domain/" contract.

---

#### [C-06] Settings page imports a storage-layer module directly
- Severity: LOW
- Confidence: CONFIRMED
- Location: `apps/prototype-web/client/src/pages/Settings.tsx:15`

**What happens**
`import { ... } from "@/storage/local/persistentStorage"` is a runtime import inside a page. The ESLint boundary guard bans only `IndexedDbLocalStore` and `createBrowserLocalStore`, so this passes lint, but the architecture states pages never touch the storage layer directly. The module itself is benign (a `navigator.storage.persist` wrapper).

**Evidence**
`Settings.tsx:15-16` imports `requestPersistentStorage`-family functions; `StartupGate.tsx` (app shell) does the same defensibly as boot wiring; the page import is the outlier.

**Failure scenario**
None financial. The concrete cost is precedent: the next contributor copies this import pattern into a page for a module that *does* hold data, and lint will not stop them.

**User impact**
None today.

---

*Merged findings from this agent:* **C-02** (HIGH, CONFIRMED — purchase-receipt quota counts reversed receipts, `inventoryMaterialService.ts:296-304`) is the same defect as **A-02**, reported there with the deeper trace. **C-04** and **C-05** (MEDIUM, LIKELY — percentage-share rounding and per-output-unit rounding duplicated outside `src/domain/shared/`) are instances of **A-07**.

*Areas checked and found clean (Agent 1):* all 11 domain policy modules (no inverted conditions, sign errors, or missing≠zero violations; `addSafe`/`roundHalfUp`/`ceilRatio` used consistently in money paths); `IndexedDbLocalStore.ts` (all migration cursors guarded; commit paths resolve exactly once; no unawaited promises or double-resolves); data-loading effects (active-flag cleanup present); idempotency keys sound across fulfillment/supplier/actual-time/cash/pulse/recurrence services; presentation formatters (null → «غير متاح» everywhere; numbers isolated in `bdi dir="ltr"`); English-numeric input boundary (safe-integer-guarded); guided-opening import validation. The 48 lint warnings were ranked by defect-danger; the four largest complexity clusters were traced line-by-line and none conceals a demonstrable bug.

---

### 4.2 Agent 2 — Accounting and financial correctness (`A-##`)

Scope: `src/domain/`, `apps/prototype-web/client/src/application/`, `docs/contracts/`. Governing question: *can this system display a number the user will believe is a fact when it is not?* Ten findings. This agent also produced the contract conformance table (§4.2.1) and the five-boundary trace (§4.2.2).

#### [A-01] Reversing a payable settlement poisons the recorded remaining on that commitment — three surfaces show three different numbers, and the commitment becomes unsettleable
- Severity: CRITICAL
- Confidence: CONFIRMED
- Location: `apps/prototype-web/client/src/application/finance/projectFinancialService.ts:828-836` (also `FinancialEventEditor.tsx:107-124`; `application/g5/g5Service.ts:216-246, 277-299`)
- Source: code-only (executed reproducer)

**What happens**
`createFinancialReversal` (`src/domain/financial-event/policies.ts:256-264`) copies the source event's `type` (`payable_settlement_cash`) and `relatedEventId` onto the reversal. Every "remaining on this commitment" computation then counts wrongly: `record()` sums **all** settlement-type events including the reversal itself; the G5/`listLinkOptions` computations exclude the reversal event but still count the **reversed settlement** as paid.

**Evidence**
Executed with real services + `MemoryLocalStore`. Record `operating_expense_payable` 10,000 minor (100.00 د.أ) → settle 6,000 → reverse the settlement with a reason (the documented correction path, offered in the Finance ledger UI):
- `record()` computes `paid = 6000 + 6000 = 12,000` → remaining `= 10,000 − 12,000 = −2,000` → **every** new settlement rejected: settling 4,000 → «لا يمكن أن يتجاوز التسديد المتبقي المسجل على هذا الالتزام»; settling 10,000 → same rejection.
- `g5.listLinkOptions()` shows remaining **4,000** (correct value: 10,000 — the reversal restored the payable; the Position surface, which sums deltas, correctly shows 100.00).
- `FinancialEventEditor` computes remaining −2,000 → filtered out (`remaining > 0`) → **the commitment disappears from the settlement dropdown entirely**.

Coordinator re-verified at source: the `paid` reduction at `projectFinancialService.ts:827-830` filters only by `type` and `relatedEventId`, with no reversal handling.

**Failure scenario**
Owner records a 100.00 supplier commitment, mistakenly records a 60.00 payment against it, corrects it with the documented «اعكس» action, then tries to record the real payment → the commitment is not selectable in the editor, and direct recording fails. G5 short-cash simultaneously understates undated commitments by 60.00, while Finance position says 100.00.

**User impact**
The same commitment displays as 100.00 (Finance position), 40.00 (G5), and non-existent (settlement editor). The owner believes they owe 40.00 when the record supports 100.00, and can never settle the commitment again through the app. Contract 06 acceptance («لا يسمح بأن يتجاوز التسديد المتبقي المسجل») is broken in both directions.

---

#### [A-02] Reversing a purchase receipt permanently blocks receiving the corrected goods against that purchase *(also found as C-02)*
- Severity: HIGH
- Confidence: CONFIRMED
- Location: `apps/prototype-web/client/src/application/inventory/inventoryMaterialService.ts:296-304` (`receivePurchase`)
- Source: code-only (executed reproducer)

**What happens**
The quota check sums all `purchase_receipt` movements linked to the purchase without excluding receipts that were later reversed. A reversal is written as type `"reversal"` (with `purchaseId: null` — `reverse()` at line 432-444), so the reversed original still consumes the purchase's value quota forever.

**Evidence**
Executed: purchase `totalMinor = 10,000` → receipt of 10,000 recorded → reversed with a reason → re-receiving 10,000 against the same purchase returns `false: «قيمة الاستلام تتجاوز إجمالي شراء المواد المرجعي»`; even a partial 20.00 re-receipt is rejected. Every other reversal-aware reader in the same file (`readOrderActualMaterialComparison` line 147-156, `summarizeMaterialInventory` netting) handles reversals correctly; this quota check does not. Coordinator re-verified the filter at source.

**Failure scenario**
Owner receives a full purchase against the wrong material, reverses the receipt (the only correction path the contract offers), then tries to receive the correct material against the same purchase → rejected. The only workaround is a value-only `adjustment` movement, which loses the purchase linkage the inventory contract exists to preserve.

**User impact**
Money left the project (cash paid) but the material is unrecordable in inventory forever through the purchase path; the material balance and any COGS evidence for those goods are permanently understated relative to reality, with a misleading error message.

---

#### [A-03] Settlement accepts reversal records and already-reversed payables as sources — producing negative supplier payables and phantom cash-out
- Severity: HIGH
- Confidence: CONFIRMED
- Location: `apps/prototype-web/client/src/application/finance/projectFinancialService.ts:824-836`
- Source: code-only (executed reproducer)

**What happens**
`record()` validates the settlement source only by `source.type !== "operating_expense_payable"`. A reversal of a payable **keeps** that type, so both the reversal record itself and the already-reversed original payable pass as valid settlement sources.

**Evidence**
Executed with domain functions: payable 10,000 → reverse it («سجل بالخطأ») → "settle" the reversal record for 10,000 passes validation; `summarizeFinancialEvents([payable, payableReversal, settlement])` → `payableMinor: −10,000`, `cashMinor: −10,000`. Hand expectation: with zero net economic activity, both must be 0.

**Failure scenario**
Owner reverses a mistaken commitment, then picks the wrong entry from the settlement dropdown (both the reversal and the reversed original appear selectable) and records a payment against it → «عليّ للموردين» shows −100.00 and recorded cash drops 100.00 with no corresponding real payment.

**User impact**
Negative supplier liability and understated recorded cash — numbers with no economic meaning presented as recorded fact.

---

#### [A-04] Material cost rounding uses float `Math.round`, violating the documented round-to-nearest-minor policy in confirmed cases
- Severity: MEDIUM
- Confidence: CONFIRMED
- Location: `src/domain/craft-order/policies.ts:134` (material), `:147` (time)
- Source: code-only (executed reproducer)

**What happens**
`Math.round(item.quantity * item.unitPriceMinor)` multiplies a decimal quantity by an integer price in floating point; when the exact product is `x.5` but the float lands below it, the item cost is understated by 1 minor unit versus contract 05 §5.3 («تُقرّب تكلفة كل بند مادي ووقت إلى أقرب وحدة صغرى»).

**Evidence**
Executed `calculateCostSnapshot`: `1.005 m × 100 minor` → float `100.49999999999999` → **100** (hand: 100.5 → half-up 101). `0.29 × 50` → `14.499999999999998` → **14** (hand: 15). The wrong value is frozen into `plannedCostMinor`, `unitCostMinor` and `priceFloorMinor`.

**Failure scenario**
Owner prices 1.005 meters at 1.00 د.أ/meter → the protective price floor is 1 qirsh lower than the policy intends; with several affected items the snapshot cost — and therefore the final profit when `known` — is silently understated.

**User impact**
A small but real understatement of cost inside the number the user is told is `known`/final.

---

#### [A-05] G5 short-cash lists draft and un-agreed orders as «دين عميل» (customer debt)
- Severity: MEDIUM
- Confidence: CONFIRMED
- Location: `apps/prototype-web/client/src/application/g5/g5Service.ts:203-213` (`receivables`)
- Source: code-only (executed reproducer)

**What happens**
`receivables()` filters only `order.receivableMinor > 0`. Every order — including `draft` — has `receivableMinor = agreedPriceMinor` from creation, so un-agreed quotes enter the short-cash reading labelled «دين عميل: <name>», contrary to contract 17 §3 («الطلبات ذات الدين»). `financialPulseService` correctly counts debt only when `settlementStatus === "debt"`.

**Evidence**
Executed: a draft order for customer سارة at 30.00 with no agreement → G5 input `{direction: "collection", amountMinor: 3000, source: "دين عميل: سارة"}` → appears in `undatedReceivablesMinor` and forces `status: incomplete` with reason «ذمة بلا تاريخ كافٍ: دين عميل: سارة».

**Failure scenario**
Owner creates a draft quote that was never agreed → the liquidity surface tells them a customer debt exists and blocks a complete short-cash forecast because of it.

**User impact**
The owner believes an un-agreed quote is a receivable; two surfaces (Finance position vs G5) disagree about what a debt is.

---

#### [A-06] Inventory consumption "dust trap": after a partial consumption, remaining low-value stock can never be partially consumed
- Severity: MEDIUM
- Confidence: CONFIRMED
- Location: `src/domain/inventory-material/policies.ts:132-140` (`consumptionValueMinor` guard `result <= 0 || result >= position.valueMinor`)
- Source: code-only (executed reproducer)

**What happens**
`consumptionValueMinor` refuses any partial consumption whose rounded value equals the whole remaining value or zero. With small remaining values, every possible partial quantity lands in the refused band.

**Evidence**
Executed: position 1000 milli / 3 minor: consume 500 → value 2 (OK, remaining 500 milli / 1 minor). Then consume 400 → `roundHalfUp(400·1/500)=1 ≥ 1` → **THROWN**; consume 250 → `roundHalfUp(0.5)=1` → **THROWN**; consume 100 → `0 ≤ 0` → **THROWN**; consume 1 → **THROWN**. Single-step case: 1.000 kg / 5.00 د.أ, consuming 999 g → exact 4.995 → rounds to 500 = full value → **THROWN** («لا يمكن توزيع قيمة المادة المتاحة بهذه الكمية») while 940/950/990 g all succeed.

**Failure scenario**
Owner consumes half a cheap material, then tries to record any further real partial usage → every attempt fails with an unexplained error; only consuming 100% of the remainder works.

**User impact**
Real consumption goes unrecorded (or is forced into a fake full consumption), starving the optional COGS evidence and the material balance; the error message gives no reason or next action.

---

#### [A-07] Rounding-policy fragmentation persists (D-02 residue): three idioms outside `shared/`, a page-level money computation, and an undeclared floor policy for owner entitlements *(also found as C-04 and C-05)*
- Severity: MEDIUM
- Confidence: CONFIRMED
- Location: `src/domain/craft-order/policies.ts:134,147` (`Math.round`); `src/domain/owner-entitlement/policies.ts:520,586` (`Math.floor`), `:618,662` (hand-rolled half-up `floor((x·bps+5000)/10000)`); `apps/prototype-web/client/src/pages/Catalog.tsx:158` (page-level `Math.floor((rawMinor+500)/1000)`); `eslint.config.js` (no `no-restricted-syntax` guard)
- Source: code-only (executed comparisons)

**What happens**
The single-rounding-policy decision (D-02) was implemented only for the newer modules. The older modules keep their own idioms, a page re-implements the policy for a preview (a fact-level violation of "financial meaning lives only in src/domain/"), and the promised ESLint guard that would prevent drift was never added.

**Evidence**
Executed: `roundHalfUp(-5,2) = −3` while `Math.round(-5/2) = −2` — the two live idioms already disagree for negatives (all current inputs are validated non-negative, so no numeric divergence today). Executed: hourly entitlement `100 minor/hr × 91 min` → `Math.floor(9100/60) = 151`, while the repo-wide half-up policy gives 152 — an undeclared 1-qirsh deviation in the owner's recorded entitlement. `Catalog.tsx:158`'s preview matches `roundHalfUp` numerically for non-negative inputs but duplicates the policy outside the domain.

**Failure scenario**
The next negative or boundary input routed through one of the unguarded `Math.round`/`Math.floor` sites silently rounds the wrong way; nothing in CI catches it because the ESLint rule was never added. Any future change to one copy of the percentage/allocation rule leaves the other behind: two numbers the owner compares ("the owner's cut of profit" vs "the project's share of an expense"; preview vs saved reading) drift apart with no test comparing them.

**User impact**
No wrong number today, but the exact drift D-02 was written to prevent remains possible, and owner-entitlement amounts follow an undocumented rounding policy.

---

#### [A-08] `draft → postponed` transition is impossible although the order-lifecycle contract allows postponement from any pre-delivery state
- Severity: LOW
- Confidence: CONFIRMED
- Location: `src/domain/craft-order/policies.ts:17-18` vs `docs/contracts/02-order-lifecycle-contract.md` (transition table row «أي حالة قبل التسليم → مؤجل»)

**What happens**
`ALLOWED_TRANSITIONS.draft = ["provisional_agreement", "needs_review"]` — a draft order cannot be postponed; the contract's table permits postponement from every pre-delivery state.

**Evidence**
`transitionOrder(order, { to: "postponed" })` on a draft throws `invalid transition: draft -> postponed` (reproduced during harness construction).

**Failure scenario**
Owner wants to park a draft order with a follow-up date → must first move it to `provisional_agreement`, misrepresenting an un-agreed order.

**User impact**
Minor friction and a status that doesn't match reality; no money effect.

---

#### [A-09] Freshness check compares a local date parsed at UTC midnight against a UTC instant — same-day prices are flagged `stale`
- Severity: LOW
- Confidence: CONFIRMED
- Location: `src/domain/craft-order/policies.ts:102-107`
- Source: code-only (executed reproducer)

**What happens**
`Date.parse(priceDate)` (UTC midnight of the Amman local date) is compared with `createdAt − freshnessDays·86400000` (a UTC instant). With `freshnessDays = 0`, any snapshot created after 03:00 Amman flags a price dated *today* as stale.

**Evidence**
Executed: priceDate `2026-05-10`, createdAt `2026-05-10T01:30:00.000Z` (= 04:30 Amman, same day), freshnessDays 0 → `knowledgeState: "stale"` (hand: `known` — the price is from today).

**Failure scenario**
Currently latent: no UI surface sets `freshnessDays` (all null), but the field survives export/import round-trips, so a false staleness claim (wrong knowledge-state label, conservative direction) becomes reachable once any surface starts setting freshness.

**User impact**
None reachable today.

---

#### [A-10] Negative cash-transfer amount is accepted by domain and service, silently reversing the transfer direction
- Severity: LOW
- Confidence: CONFIRMED
- Location: `src/domain/cash-continuity/policies.ts:44-45,58-61`; `apps/prototype-web/client/src/application/cash/cashContinuityService.ts:189-213`

**What happens**
Contract 10 barrier 2 forbids transfers «بمبلغ صفر أو سالب». `createCashContinuityEntry` only requires a non-zero integer, and `transfer()` passes `−amountMinor` through: a negative amount creates `transfer_out +X` / `transfer_in −X` — a transfer in the opposite direction — instead of being rejected.

**Evidence**
Trace: `amountMinor = −30` → out entry `cashDeltaMinor = −(−30) = +30`, in entry `−30`; both pass validation. Net cash unchanged (sum zero), so the import validator's balanced-transfer check also passes such a pair.

**Failure scenario**
Only reachable via a non-UI caller or crafted import today (`CashTransferEditor` guards `amountMinor <= 0` at line 37); if reached, the money moves B→A while the user asked A→B.

**User impact**
None through current UI; a contract barrier exists on paper but is not enforced where the contract says «لا يسمح».

---

#### 4.2.1 Contract conformance table (accounting agent)

| Contract | Verdict |
|---|---|
| 01 financial-result | **conforms** — profit only at delivery/settlement from `known` snapshot; revenue recognized on delivery not collection; deposit ≠ profit; full prepayment → settled with two events; delivered-order review lock enforced |
| 02 order-lifecycle | **diverges (low)** — `draft → postponed` forbidden although the contract allows postponement from any pre-delivery state (A-08); `settled/cancelled → needs_review` also blocked (arguably intentional lock) |
| 03 cost-snapshot | **conforms** — ceil-documented + tested; missing craft time → `incomplete` before `stale` (contract-sanctioned); frozen snapshots + append-only history; revision quantity match enforced |
| 04 limited-sync | **not-implemented by design** — contract itself declares `local_only`; consistent |
| 05 financial-p0-policies | **diverges (medium)** — all five boundaries hold and JOD=100-minor is consistent, but §5.3 "round each material/time item to nearest minor" is violated by float `Math.round` in edge cases (A-04) |
| 06 financial-event | **diverges (critical)** — acceptance "settlement must not exceed the recorded remaining on that commitment" breaks after any settlement reversal: remaining computed wrong in three places (A-01), and settlement sources are under-validated (A-03) |
| 07 schedule-capacity | **conforms** (shallow check; conflicts are warnings, capacity optional, no money touched) |
| 08 expense-classification | **conforms** — operating expenses require context; deltas derived only from type; withdrawal/investment/purchase correctly excluded from expense |
| 09 supplier-purchase | **conforms** — purchase affects cash/payable only; payments append-only, idempotent, cannot exceed remaining; no COGS; no purchase reversal is contract-conformant (barrier 5 defers corrections) |
| 10 cash-continuity | **diverges (low)** — barrier 2 forbids zero/negative transfer amounts; domain/service accept a negative amount and silently reverse direction (A-10); everything else conforms |
| 11 inventory-material | **diverges (high)** — barrier 4 "receipts must not exceed the purchase total across all linked receipts" is computed including reversed receipts (A-02); moving-average value policy implements a refusal trap on low-value remainders (A-06) |
| 12 financial-insights (legacy) | **conforms** (retained reference; conservative surfaces still present) |
| 13 actual-material-per-order | **conforms** — planned from snapshot, actual from non-reversed consumptions only, variance explicitly "not final profit" |
| 14 period-result-allocation | **conforms** — share rounding matches §3.4 exactly; COGS substitutes only the material component once; unallocated shared expense excluded AND surfaced with count + `incomplete`; invalid period → `resultMinor: null`; reversal lands in its own period per §6 |
| 15 catalog-reference | **conforms** — conversion is exact-only, dimension-guarded, disable-not-delete |
| 16 optional-operating-mode-and-actual-time | **conforms** — `per_output_unit` sums quantity first then one `roundHalfUp(raw, 1000)`; `actual_time` is integer minor-per-minute; zero-after-rounding is declared known-computed |
| 17 contribution-break-even-short-cash | **diverges (medium)** — break-even math, statuses, ceil-once, unit unification, and declaration reversal all conform (verified numerically), but `receivables()` feeds non-debt orders into the short-cash reading labelled «دين عميل» contrary to §3 (A-05), and commitments inherit the A-01 understatement |
| 18 derived-monthly-order-schedule (G6-A) | skipped — operational scheduling, no financial semantics |
| 18 network-identity | skipped-for-Agent-5 |
| 19 bounded-local-schedule-recurrence (G6-B) | skipped — operational scheduling |
| 19 services-notification | skipped-for-Agent-5 |
| 20 agreement-source-follow-up (G7-A) | **conforms** — source enum + date validation, reason required on change, no money touched |
| 20 market-need-response | skipped-for-Agent-5 |
| 21 delivery-request-quote | skipped-for-Agent-5 |
| 21 guided-opening-import | **conforms** — preview writes nothing, `non_empty_store` guard, idempotent re-import, opening balances never become sales/COGS; the `custom_craft` pin is contract-documented (X-01 tracks the risk) |
| 22 bounded-operating-capacity (G9.1) | **conforms** — `unknown`/`needs_review`/`within_limit`/`over_limit`; unknown duration never counted as zero |
| 22 network-moderation | skipped-for-Agent-5 |
| 23 general-financial-event-correction (C1) | **diverges (indirect)** — reversal mechanics conform fully (full-reverse only, reason, key-collision rejection, double-reversal blocked, store-enforced), but C1's own table requires settlement reversal to stay «مع الالتزام المصدر وبلا تجاوز للرصد» — the reading side breaks that accounting (A-01/A-03) |
| 23 network-data-lifecycle | skipped-for-Agent-5 |
| 24 network-data-classification | skipped-for-Agent-5 |

#### 4.2.2 Five-boundary trace verdicts (accounting agent)

- **collection ≠ profit — HOLDS.** Profit computed only in `transitionOrder` at delivery/settlement as `agreedPriceMinor − plannedCostMinor`, never from `collectedMinor`; revenue in period result is delivery-based; Home facts carry no profit surface. Executed example: order 30.00, deposit 10.00 collected, delivery → profit 15.00 independent of the 10.00.
- **debt ≠ cash — HOLDS.** `registerDebt` changes no cash field; `operating_expense_payable` has `cashDeltaMinor: 0`; G5 short-cash treats undated debt as excluded-from-projection with an explicit reason. Caveat: A-01 makes the *displayed remaining commitment* wrong after corrections, but debt never converts into cash anywhere.
- **purchase ≠ COGS — HOLDS in derivation.** Purchases touch only cash/payable; COGS derives exclusively from cost-backed consumption linked to `final` orders with the snapshot fallback announced. Caveat: A-02 breaks the *inventory side* of the chain after a receipt reversal (goods paid for can never be received → never consumed), starving COGS evidence without fabricating it.
- **owner money ≠ sale/expense — HOLDS.** Investment/withdrawal deltas isolated from period result; `profit_share` refuses any G3 status other than `recorded_only`; owner capital appears nowhere in the period-result equation.
- **missing ≠ zero — HOLDS in display and computation.** `formatMoneyMinor(null) → «غير متاح»`; Home forces null for non-known facts; OrderDetail refuses numeric results when profit is null; G5 refuses zero-substitution with reasons. The wrong-number defects found (A-01, A-05) are incorrect remainders/mislabelled debt, not zero-substitutions.

*Areas checked and found clean (Agent 2):* profit recognition math end-to-end; G5 arithmetic (three hand-computed break-even vectors; division-by-zero and non-positive margin structurally prevented); shared-expense percentage rounding ≡ contract 14 §3.4; period-result assembly (COGS substitution once, unallocated surfaced, legacy flagged, invalid period → null); reversal/idempotency enforcement (financial-event reversal validated transactionally at the store; cash reversal reverses both legs atomically; all five families block double-reversal); time handling (`Intl` with `timeZone: "Asia/Amman"`, no DST assumptions; contract-mandated boundary test exists and passes; invalid calendar days rejected); display formatters; owner-entitlement structure (dated successors, no history rewrite); export/import validation (duplicates, unbalanced transfers, reversal mismatches, dangling references all rejected).

---

### 4.3 Agent 3 — User experience and flow (`U-##`)

Scope: `apps/prototype-web/client/src/pages/`, `components/`, `app/navigation.ts`, `app/MicroRouter.tsx`, plus the live deployment. Target user: a home business owner in Jordan, on a phone, between customers. All findings below were verified on the live app (fresh profile, 360×800 primary, 390/430 spot checks) except where marked code-only.

#### 4.3.1 Core-task tap-count table (measured live)

| Task | Steps (screens) | Taps | Verdict |
|---|---|---|---|
| Record order w/ cost + agreement | FAB → sheet → NewDraft → DraftEditor → CostEditor → AgreementEditor → OrderDetail | **11** taps + ~6 typed fields / 6 screens | Acceptable; 1 tap + 1 screen wasted on re-asked intent (U-06) |
| Collect a payment | Orders → order row → «تحصيل المتبقي الآن» | **2** | Clean |
| Record an expense | Home → Finance → open actions layer → «سجل مصروفًا مدفوعًا» → save | **4** | Hidden behind collapsed layer; FAB doesn't offer it (U-07) |
| Add material/inventory | Home → Finance → actions layer → «المواد والمخزون» → «مادة ورصيد بداية» → save | **5** | Not reachable from Home while empty (module hidden); not in FAB (U-07) |
| "What did I make" | المراجعة (bottom nav) — or Home → Finance → «قراءة الفترة» | **1–3** | Clean, layered |
| Schedule work | Auto-created from agreement delivery date; edit via Home → Schedule → entry | **1–2** | Clean |
| Export/backup | Settings → open data layer → export icon | **3** | Works; icon-only affordance (U-11); cadence = P-01 open |
| Change a wrong entry | Financial event: 5 taps. **Order: no path exists. Draft: no delete.** | 5 / ∞ / ∞ | Event/cash/inventory/G5/owner reversals excellent; order correction missing (U-03), drafts undeletable (U-08) |

#### [U-01] Browser/system back mid-form silently discards unsaved cost/agreement entries
- Severity: HIGH
- Confidence: CONFIRMED
- Location: Live app (`/orders/draft/:id/cost`, `/orders/draft/:id/agreement`); `components/forms/UnsavedChangesGuard.tsx:60-71`; `components/layout/MicroAppShell.tsx:20`
- Source: verified-in-app

**What happens**
The UnsavedChangesGuard only wraps in-app navigation issued through `requestNavigation` (BottomNav, editor back buttons). Browser back — on Android the system back gesture, the primary way an interrupted phone user leaves a screen — bypasses the guard entirely and destroys the component state holding the unsaved entry. No popstate/beforeunload interception exists in shipped code (coordinator grep: zero matches for `popstate|beforeunload|pagehide` in `client/src`).

**Evidence**
Live, 360×800: (1) CostEditor with material «خشب زان» 2×3.50 + time 90min @4.00 unsaved → browser `back` → DraftEditor **with no prompt** → `forward` → CostEditor rendered empty. (2) AgreementEditor with price 20.00 + deposit 3.00 unsaved → `back` → CostEditor, no prompt, values lost. Control: the in-app «العودة للمسودة» button on the same dirty form correctly fires the 3-choice drawer — so the guard works for taps, never for history navigation.

**Failure scenario**
Owner is mid-cost-entry when a customer calls; they swipe the Android system-back gesture and return → the material list and time they typed are gone with zero warning. They re-enter from memory — exactly where a rushed owner enters a wrong number the second time.

**User impact**
Silent loss of financial data entry on the most common interruption pattern of the target user.

---

#### [U-02] Saving an edited financial event again keeps the OLD amount while showing a success-class message
- Severity: HIGH
- Confidence: CONFIRMED
- Location: `pages/FinancialEventEditor.tsx:100` (mount-scoped idempotency key), `:207` (reused message); `application/finance/projectFinancialService.ts:729-732` (reused returns the stored event regardless of new payload)
- Source: verified-in-app

**What happens**
The editor generates one idempotency key per component mount and never navigates away after a successful save. A second tap of «حفظ الحدث» with **changed** values is treated as a retry: `record()` returns the previously stored event with `reused: true`, and the screen shows «هذا الحدث محفوظ سابقًا؛ لم نكرر أثره.» — a message styled as a save note that most owners will read as "my edit is saved". The new values are discarded.

**Evidence**
Live: `/finance/new/owner_investment_cash` → amount 5.00, save → «تم حفظ الحدث المالي محليًا.» → changed amount to 8.00, save → «هذا الحدث محفوظ سابقًا؛ لم نكرر أثره.» → Finance ledger shows 5.00. The 8.00 was never persisted. Contrast: `G5DeclarationEditor.tsx:71` derives its key from content and `SupplierPurchaseEditor.tsx:67` navigates away on first success — both avoid the trap; FinancialEventEditor is the outlier.

**Failure scenario**
Owner records a paid expense 2.50, immediately notices it was 25.00, edits the amount, taps save, reads «محفوظ سابقًا» and moves on. The ledger keeps 2.50; the owner believes 25.00 is recorded. Cash, period result, and every derived number now disagree with the owner's mental model.

**User impact**
Materially wrong money belief produced by a UI success-path message. (Fix must not auto-overwrite — the immutability contract stands; the fix is honest messaging and/or navigate-away-on-success.)

---

#### [U-03] No UI path to cancel or correct a wrong order (price, deposit, delivery date)
- Severity: HIGH
- Confidence: CONFIRMED
- Location: `pages/OrderDetail.tsx:155-215` (only start/ready/deliver/collect/debt actions); zero client callers of `cancelOrder`; domain exports it at `src/domain/craft-order/index.ts:4`; contract `docs/contracts/02-order-lifecycle-contract.md:31` documents cancellation as the pre-delivery path
- Source: verified-in-app

**What happens**
Every other record family has a documented correction path in the UI (financial events, cash entries, inventory movements, G5 declarations, owner entitlement — all verified with reversal editors). Orders do not: no cancel, no price revision, no deposit correction, no delete. The domain supports `cancelOrder` (with deposit settlement handling) and the lifecycle contract names it as THE path from any pre-delivery state.

**Evidence**
Live walk of OrderDetail through all statuses shows only: ابدأ التنفيذ → الطلب جاهز للتسليم → تم التسليم → تحصيل المتبقي/تسجيله دينًا. Static: `agreementService` exposes only list/get/createFromDraft/startExecution; `fulfillmentService` only markReady/deliver/collectFullRemaining/registerRemainingDebt.

**Failure scenario**
Customer cancels after the agreement was fixed, or the owner typed price 13 instead of 31, or recorded a deposit that was never paid. Nothing can be done from the app: the wrong order stays «in progress»/«delivered» forever, keeps surfacing in Home attention and Orders, and its wrong receivable sits in Finance «لي عند العملاء» with no correction or closure.

**User impact**
A permanently uncorrectable wrong entry in the ledger trains the owner that the app's numbers can't be trusted — the opposite of the financial-honesty promise. (Scope decision for the owner: expose `cancelOrder` in OrderDetail per contract 02, or document the deferral explicitly.)

---

#### [U-04] "note is required" — raw English validation error in the all-Arabic expense editor
- Severity: MEDIUM
- Confidence: CONFIRMED
- Location: Live on `/finance/new/operating_expense_cash` with empty «ما الذي حدث؟»; source chain `src/domain/financial-event/policies.ts:13` (`assertNonBlank` throws `` `${field} is required` ``) → `projectFinancialService.ts:859-864` (passes `error.message` through) → `FinancialEventEditor.tsx:330-340` (renders it)
- Source: verified-in-app

**What happens**
The note field is required by the domain but not marked required in the UI. Submitting with an empty note shows the English string "note is required" as the only guidance, in an app where every other string is Arabic.

**Evidence**
Live: amount 2.50 + payee filled, note empty, save → «note is required» observed. The same `assertNonBlank` family exists in 4 more domain modules (supplier-purchase, owner-entitlement, cash-continuity, shared/numeric), and the application layer passes `error.message` through raw in multiple services.

**Failure scenario**
A non-English-speaking owner taps save, sees «note is required», doesn't connect "note" with «ما الذي حدث؟», retries twice, concludes the app is broken and records the expense nowhere — the paid expense stays out of the ledger.

**User impact**
Friction + broken-trust moment at exactly the moment the app asks for recording discipline.

---

#### [U-05] Inverted month range collapses the entire Finance screen with no in-place recovery
- Severity: MEDIUM
- Confidence: CONFIRMED
- Location: `pages/Finance.tsx:124-129` (range validation sets whole-page error state), `:163-172` (full-page error render); live on `/finance`
- Source: verified-in-app

**What happens**
Setting the period «من» month after the «إلى» month (free `type="month"` inputs) makes the component return a whole-page error screen — «تعذر قراءة الوضع المالي / اختر نطاقًا صحيحًا…» — that removes the month inputs themselves. The only button navigates Home.

**Evidence**
Live: opened «قراءة الفترة» layer → «من» = 2026-09 while «إلى» = 2026-08 → entire screen replaced by the error card; recovery required leaving Finance and returning (which resets the months).

**Failure scenario**
Owner exploring period filters inverts the range by one tap; the headline «تعذر قراءة الوضع المالي» reads like a data failure, not a filter typo; they leave believing their data has a problem.

**User impact**
A filter mistake presented as a data failure, escapable only by abandoning the screen. Alternative: validate inline next to the two inputs and keep the page live.

---

#### [U-06] Quick-action sheet discards the chosen intent and the next screen asks the same question again
- Severity: MEDIUM
- Confidence: CONFIRMED
- Location: `components/layout/MicroAppShell.tsx:32-45` ("order" and "estimate" both navigate to `/orders/new`); `pages/NewDraft.tsx:32-63`
- Source: verified-in-app

**What happens**
The FAB sheet «ماذا تريد أن تسجّل؟» offers «طلب مخصص» and «مسودة تصميم» as distinct choices, but both handlers navigate to the same `/orders/new` without passing the intent; NewDraft then asks the identical question.

**Evidence**
Live: FAB → «مسودة تصميم» → landed on «اختر نقطة البداية» with the same two options again. Code: both branches of `handleQuickAction` return `/orders/new`.

**Failure scenario**
Owner answers the question once, is asked again, doubts whether the first tap registered, and taps a different option by accident — creating the wrong draft type, which then cannot be deleted (U-08).

**User impact**
One wasted tap + one wasted screen on the app's most-used entry path, plus avoidable doubt.

---

#### [U-07] The global "+" sheet covers only order-family actions; expense, purchase, and material recording have no quick entry
- Severity: MEDIUM
- Confidence: CONFIRMED
- Location: `components/layout/QuickActionSheet.tsx:29-43` (3 actions, all order-related); contrast `pages/Finance.tsx:433-499` (the real record-actions list lives behind a collapsed layer)
- Source: verified-in-app

**What happens**
The sheet's title asks «ماذا تريد أن تسجّل؟» but offers only: طلب مخصص، مسودة تصميم، عربون أو تحصيل. Recording an expense (4 taps via Finance's hidden layer), a supplier purchase, or a material has no representation, while Home hides the inventory/suppliers modules until data exists (chicken-and-egg for a fresh user).

**Evidence**
Live: FAB sheet contents as listed; expense path measured at 4 taps; `/inventory` reachable pre-data only via Finance → actions layer → «المواد والمخزون». All needed deep routes already exist (`/finance/new/operating_expense_cash`, `/suppliers/purchase/new`, `/inventory/material/new`).

**Failure scenario**
Owner pays 2 JOD for a delivery right after finishing a customer; opens "+" expecting to record the expense; finds only order actions; closes the sheet and the expense never gets recorded — period result and cash silently diverge from reality.

**User impact**
The recording surface biases toward orders and makes the app's other honest-ledger disciplines harder to reach.

---

#### [U-08] Abandoned drafts can never be deleted or dismissed and occupy the top Home attention slots
- Severity: MEDIUM
- Confidence: CONFIRMED
- Location: `application/drafts/draftService.ts:36-51` (only create/save, no delete); `application/home/homeControlCenterService.ts:153-167` (draft attention priority 10 — above debt 15 and cost 20); `homeControlCenterModel.ts:54-66` (attention sliced to 3)
- Source: verified-in-app

**What happens**
Creating a draft is instant (one tap creates the record immediately), but there is no delete, archive, or «not pursuing» action anywhere. Each lingering draft becomes a permanent Home attention item with the highest priority, ahead of debt and cost-completion reminders, and the attention list shows at most 3 items.

**Evidence**
Live: an abandoned «تصميم إطار خشبي» draft (created in one tap, never continued) occupies attention slot 1 on Home with «استئناف المسودة»; nothing in Orders, DraftEditor, or Home can remove it. Static: priorities drafts=10 < debt=15 < cost=20, slice(0,3).

**Failure scenario**
Owner starts three speculative drafts over a month, then delivers an order and registers the remainder as debt. Home's «ما يحتاج فعلًا الآن» shows only the three dead drafts; the debt reminder — the item with real money attached — is pushed off the surface.

**User impact**
The control center permanently prioritizes dead records over live money, and the owner has no lever to fix it.

---

#### [U-09] Sub-44px touch targets: Finance month inputs (35px tall) and CostEditor «إضافة وقت» (33px wide)
- Severity: MEDIUM
- Confidence: CONFIRMED
- Location: `index.css:4788-4792` (`.micro-period-range-fields input` — no min-height) → measured 132×35 @360, 87×35 @390, 97×35 @430 on `/finance`; `index.css:499-504` (`.micro-text-action` width:fit-content) → «إضافة وقت» on CostEditor measured 33×44 @360, 36×44 @390, 41×44 @430
- Source: verified-in-app

**What happens**
Two real interactive controls fall below the 44×44 target the project's own QA standard names: the period-range month pickers on Finance, and the text-action button that is the ONLY entry point to the work-time block on CostEditor — the block whose absence keeps a cost «ناقصة».

**Evidence**
Measured bounding boxes at all three viewport widths. A full sweep of 17 routes (every button, input, select, summary, checkbox, all layers/details opened) found no other sub-44 element; checkboxes are 20×20 visuals inside 294×86 label touch areas, which pass.

**Failure scenario**
Owner with large/wet fingers tries to tap «إضافة وقت» on a 360px phone, misses the 33px strip, taps the heading instead, believes time entry isn't available, saves a cost without time — and the order result stays «غير مكتملة» with no price floor.

**User impact**
The single most important optional field on the cost screen is gated by the smallest target measured in the app.

---

#### [U-10] PWA install banner reappears on every cold load despite dismissal and pushes the primary action down
- Severity: MEDIUM
- Confidence: CONFIRMED
- Location: `pwa/PwaInstallControl.tsx:14,55` (`isDismissed` is component state only — not persisted)
- Source: verified-in-app

**What happens**
The install banner renders above all page content (151px tall at 360px) whenever `beforeinstallprompt` fires; dismissing survives only until the next reload, with no "don't ask again" persistence.

**Evidence**
Live: banner 328×151; first h1 at y=276 and the Home primary CTA at y=586 of an 800px viewport with the banner (vs ~435 without). «ليس الآن» → reload → banner back.

**Failure scenario**
An owner using Micro in a browser tab re-dismisses the banner at every session start; on a small phone the «الأولوية الآن» card starts below thumb-reach.

**User impact**
Recurring friction + displacement of the primary surface on the control-center screen.

---

#### [U-11] Backup export/import actions are icon-only buttons inside a collapsed layer
- Severity: LOW
- Confidence: CONFIRMED
- Location: `pages/Settings.tsx:247-262` (rows) + `:557-592` (`StorageRow` renders an icon-only `micro-icon-button` with aria-label); the containing `<details>` (line 211) is closed by default while the lower-stakes «تفضيلات العمل اليومية» layer (line 272) is open
- Source: verified-in-app

**What happens**
The two most safety-critical actions in the app («تصدير البيانات المحلية», «اختيار ملف استيراد») render as bare download/upload glyphs with no visible text, inside a layer that starts collapsed.

**Evidence**
Live at 360px: rows end in a single 44×44 icon button with no text (verified innerText empty; only aria-label). The DecisionPanel warning about exporting is visible at the top of Settings, but its action is 2 layers down.

**Failure scenario**
A non-technical owner reads «صدّر نسخة محلية قبل الحذف أو تغيير الهاتف», opens the layer, doesn't recognize the download glyph as the action, and exports nothing before switching phones.

**User impact**
The known P-01 data-loss risk gets one more small barrier: recognition of an icon.

---

*Areas checked and found clean (Agent 3):* first run (Setup self-explanatory, single question, autofocus, honest «ما يعرفه Micro الآن» panel; all targets ≥44px); core flow linearity (one primary action per screen; protection price «غير متاح بعد» until knowable; below-floor acknowledgment works); honest empty/needs-review states with next actions across Orders/Inventory/Suppliers/Schedule/Review; reversal UX where it exists (full effect review, reason required, immutability explained, idempotent); Arabic error recovery cases (empty agreement, zero amount, Arabic-digit quantity, empty reversal reason — all state the problem AND the fix); visual priority (decision-first hierarchy consistent across Home/Finance/CostEditor/Orders — judgement, backed by DOM order); touch targets overall (only 2 violations in a full 17-route sweep — an unusually strong baseline); density (Home 259 words/12 buttons; Finance's 326 words behind 4 collapsed layers — G20–G23 layering works as intended); five boundaries in UI state («غير مهيأ» for unknown payables/capital rather than 0; collection-vs-profit truth lines present).

---

### 4.4 Agent 4 — Language and on-screen copy (`L-##`)

Scope: every Arabic string the user can see across `apps/prototype-web/client/src/`, verified against live app and underlying code behaviour. Standard: every word understood by a small shop owner in Jordan on first reading. **Hard constraint honoured: no proposal widens what the system claims; several rows exist specifically to keep claims narrower than today.** Prior review contained no language findings — territory fresh. 19 findings: 0 CRITICAL, 6 HIGH, 11 MEDIUM, 2 LOW. The full change table and unified glossary follow the finding blocks.

#### [L-01] «إعلان» — the owner's own example, live in the G5 short-cash flow
- Severity: HIGH
- Confidence: CONFIRMED
- Location: `pages/Finance.tsx:107-114,632,1024,1029,1036` · `pages/G5DeclarationEditor.tsx:92,95,157,182,195,202,219` · `application/g5/g5Service.ts:270,363,371,384,389,401,404,419,435,441` (plus metric label «بعد المعلن» `Finance.tsx:615`)
- Source: verified-in-app

**What happens**
Micro calls a reversible, dated expectation of incoming/outgoing cash an «إعلان» everywhere in the G5 liquidity flow.

**Evidence**
Live on Finance: button «أعلن تحصيلًا أو التزامًا قريبًا», section «الإعلانات المحلية», empty state «لا توجد إعلانات فعالة», chips «تحصيل معلن / التزام معلن», status «إعلان غير صالح». Live on the declaration editor: overline «إعلان لا يتحول إلى حركة مالية», «حفظ الإعلان المحلي», «تفاصيل الإعلان». Service errors: «تعذر حفظ إعلان السيولة محليًا». The cryptic metric «بعد المعلن» compounds it. Behaviour verified: it records an expectation (separate from cash, reversible with a reason, never converts to cash) — an «إعلان» is not what happened.

**Failure scenario**
A first-time Jordanian shop owner reads «إعلان» as *advertisement* («لا أريد أن أنشر إعلان») and avoids the feature, or opens it expecting marketing. With «بعد المعلن» misread as "after the ad", the projected-cash number loses its meaning entirely.

**User impact**
The one forward-looking cash screen becomes unusable or ignored; the owner cannot register «العميل قال يدفع الجمعة» in a way they understand.

---

#### [L-02] Latin/English words written into Arabic sentences the owner must read
- Severity: HIGH
- Confidence: CONFIRMED
- Location (all user-visible): `Snapshot`: `Finance.tsx:105,106,307,379,941,942` · `agreementService.ts:106,112` · `projectFinancialService.ts:245,249,257,502,503,591,650` · `inventoryMaterialService.ts:125,195,196` · `recurringWorkService.ts:376,405,527` · `homeControlCenterService.ts:175` · `ActualTimePanel.tsx:42,215` · `InventoryMovementEditor.tsx:231` · `Catalog.tsx:594,1294` · `Settings.tsx:515`. `COGS`: `Finance.tsx:103,105,106,377,942` + `projectFinancialService.ts:254,502,503,650` + `InventoryMovementEditor.tsx:301` + `Catalog.tsx:1294,1605` + `recurringWorkService.ts:376,415,487`. `final`: `Review.tsx:100` · `Catalog.tsx:142,1293,1426,1514` · `recurringWorkService.ts:527`. `yield`: `Catalog.tsx:369,1033,1209`. `basis points`: `OwnerEntitlement.tsx:725`. `immutable`: `Finance.tsx:790`. `G5`/`G3`/`O1`: `Finance.tsx:414` · `G5DeclarationEditor.tsx:95` · `g5Service.ts:338` · `OwnerEntitlement.tsx:36,326,725,871` · `projectFinancialService.ts:650` · `recurringWorkService.ts:527`. `Home/Finance/Orders` route names: `Home.tsx:224` · `homeControlCenterService.ts:329`. `ProjectFinancialService`: `homeControlCenterService.ts:116`. `Prototype`: `OrderDetail.tsx:278,365` · `Settings.tsx:250` · `NotFound.tsx:10` · `localTransferService.ts:1659`. `JSON`: `Settings.tsx:250`. `milli`: `Settings.tsx:436`. `Store`: `Settings.tsx:447`. `Purchase/Inventory/Consumption`: `Catalog.tsx:1222`
- Source: verified-in-app (Snapshot, COGS, final, G5, Prototype, JSON, ProjectFinancialService, Home/Finance/Orders seen live)

**What happens**
Dozens of protective truth-lines mix English technical/accounting tokens into Arabic sentences. The sentences carrying the honesty guarantees are the ones the owner cannot read.

**Evidence**
Live: «لا توجد COGS مؤهلة؛ Snapshot هو المصدر البديل المعلن», «تكلفة مباشرة من Snapshot», «الإيراد والتكلفة المتغيرة مأخوذان من الطلبات النهائية ذات Snapshot المسجل… وليست صافي ربح نهائيًا ولا COGS فعليًا», «هذه قراءة قيادة محلية… لا تعرض صافي ربح المشروع ولا تستبدل Finance أو Orders», «ProjectFinancialService والسجل المحلي», «ينشئ ملف JSON لبيانات Prototype الحالية», «سيبقى الأصل immutable كما هو», «لا Purchase ولا Inventory ولا Consumption ولا COGS ولا إيراد ولا هامش ينشأ منه», «تحفظ النسبة basis points صحيحة… من نتيجة G3».

**Failure scenario**
Owner reads the COGS/Snapshot truth-line as "system words", ignores it, and trusts the period number as pure profit — exactly the misunderstanding the line exists to prevent.

**User impact**
Every honesty disclaimer written with English tokens is functionally missing for the target user.

---

#### [L-03] Raw record IDs and English enum values pasted into user sentences
- Severity: HIGH
- Confidence: CONFIRMED
- Location: `src/domain/g5/policies.ts:193,196,215,218` (domain builds UI copy) · `pages/Finance.tsx:749,753` (correctionOfEventId / reversal.id) · `pages/OwnerEntitlement.tsx:649,656,1268,1314,1383,1388` (seriesId.slice(0,8), successorOfPolicyId.slice(0,8), reversalOfId, relatedOpeningBalanceId)
- Source: verified-in-app

**What happens**
Users are shown UUIDs and enum values inside Arabic explanations instead of the record's name/status.

**Evidence**
Live on Finance → G5 panel: «الطلب order-0ae036b5-17c1-4826-ae97-655dc4421683 مستبعد لأن نتيجته estimated.» Code: `excluded.push(\`الطلب ${order.id} مستبعد لأن نتيجته ${order.resultStatus}.\`)`. OwnerEntitlement ledger shows «السلسلة a3f2b1c4» and «الأصل محفوظ: <full uuid>».

**Failure scenario**
Owner cannot tell *which* order was excluded or *why* («estimated» is English), so the exclusion warning is dead text; the owner may "fix" the wrong record.

**User impact**
Exclusion/reversal audit trail unreadable; trust in «الأصل محفوظ» claims drops because the sentence around it is noise.

---

#### [L-04] «الإيراد المعترف به» / «التكلفة المعترف بها» — accounting-recognition jargon on money
- Severity: HIGH
- Confidence: CONFIRMED
- Location: `pages/OrderDetail.tsx:307-310` · `pages/Review.tsx:85,92` · `application/recurring-work/recurringWorkService.ts:527`
- Source: verified-in-app

**What happens**
The delivered-order result card uses «اعتراف» (recognition) wording no shop owner uses.

**Evidence**
Live: «الإيراد المعترف به (د.أ): 15.00 · التكلفة المعترف بها (د.أ): 10.00». Semantics verified in contract 05 §3.2: the agreed price and the planned-snapshot cost counted **at full delivery** (not at cash collection). The boundary to preserve is *counted-at-delivery ≠ collected-cash*.

**Failure scenario**
Owner reads «معترف به» as "confirmed/approved" — i.e., believes 15.00 is money received, or an official "audited" figure.

**User impact**
The collection ≠ recognition boundary — one of Micro's five — is stated in a dialect that hides it.

---

#### [L-05] Finance G5/period headings use textbook accounting vocabulary
- Severity: HIGH
- Confidence: CONFIRMED
- Location: `pages/Finance.tsx:260` («صافي الربح التشغيلي المسجل للفترة»), `:932` («هامش المساهمة — قراءة ثانوية»), `:973` («نقطة التعادل المفككة من المزيج المسجل»), `:951` («التكلفة المتغيرة»), `:955` («الثابت المسجل»), `:593` («لا وعد بتدفق نقدي»), `:337-346` + `:58,70` («محمل/غير محمل»), `:70` («حصة مشروع مشتركة»), `Catalog.tsx:416` («قيد مالي») · `projectFinancialService.ts:502,503,650` · `recurringWorkService.ts:588`
- Source: verified-in-app

**What happens**
The Finance page's secondary layers are named with accounting-course terms.

**Evidence**
Live: «صافي الربح التشغيلي المسجل للفترة», «هامش المساهمة — قراءة ثانوية», «نقطة التعادل المفككة من المزيج المسجل», «التكلفة المتغيرة», «الثابت المسجل», «هذه قراءة معلنة، لا وعد بتدفق نقدي», «حصص مشروع مشتركة محملة», «مصروف مشترك غير محمل», «استهلاك عام غير محمل». Note: the contract itself names the period surface «نتيجة الفترة المسجلة» — the heading contradicts Micro's own naming rule.

**Failure scenario**
«صافي الربح التشغيلي» reads as *net profit*; the owner quotes it as profit. «التكلفة المتغيرة/الثابت المسجل» are not words a home-business owner uses, so the break-even line is never understood as a question they can act on.

**User impact**
The most dangerous numbers on the app (period result, margin, break-even) wear their honesty qualifiers in a foreign register. «المفككة» and «المحمل» add pure noise.

---

#### [L-06] Unsaved-changes drawer promises protection the code does not provide
- Severity: HIGH
- Confidence: CONFIRMED
- Location: `components/forms/UnsavedChangesGuard.tsx:117`
- Source: code-only (string read in code; guard wiring verified)

**What happens**
The drawer says: «اختر كيف تتابع. لن يُحفظ شيء تلقائيًا، ولن يُفقد عملك ما لم تختر الخروج.»

**Evidence**
Verified in code: the guard only intercepts in-app navigation (`requestNavigation` used by `MicroAppShell.tsx:59`, back buttons). There is **no** `beforeunload`/`pagehide`/`popstate` handler anywhere in `client/src` (coordinator grep: zero matches). Closing the tab, swiping the PWA away, or browser-back loses unsaved financial input with no prompt — and on phone-first usage that is the most common exit (see U-01, same root).

**Failure scenario**
Owner mid-way through a cost sheet sees this sentence once, closes the app to answer a call, reopens — the entered materials/time are gone. The app had *told them* this cannot happen.

**User impact**
Broken promise on data entry = direct hit to Micro's core promise of financial honesty. (Convergence with U-01 — see §5.2.)

---

#### [L-07] «تحميل» used for expense allocation — reads as "download"
- Severity: MEDIUM
- Confidence: CONFIRMED
- Location: `pages/Catalog.tsx:346,362,416,1268,1278,1300,1345,1426,1558,1569` · `pages/FinancialEventEditor.tsx:470` · `pages/Finance.tsx:58,70,331,337,343,403` · `projectFinancialService.ts` (multiple)
- Source: verified-in-app (Finance labels) / code-only (Catalog)

**What happens**
Recurring-work and shared-expense allocation is called «تحميل»/«محمل».

**Evidence**
«سياسة تحميل», «أساس التحميل», «أضف تحميلًا واضحًا», «الربح بعد التحميل», «معاينة التحميل», «حصص مشروع مشتركة محملة», «مصروف مشترك غير محمل». In Jordanian everyday Arabic «تحميل» = downloading a file.

**Failure scenario**
Owner thinks the feature downloads something, or reads «غير محمل» as "not loaded (error)". The shared-bill boundary (unallocated ≠ zero) is stated in a word that signals the wrong domain.

**User impact**
Confusion around the shared-expense honesty rules; friction without wrong outcome.

---

#### [L-08] «استحقاق» vs «حق المالك» — same concept, two names, one is jargon
- Severity: MEDIUM
- Confidence: CONFIRMED
- Location: `pages/OwnerEntitlement.tsx` (≈20 occurrences: 49,243,619,621,631,932,940-1016,1237…) · `pages/Finance.tsx:488,558,567` · `ownerEntitlementService.ts:253,255,257`
- Source: verified-in-app (Finance card) / code-only (OwnerEntitlement page)

**What happens**
The Finance card says «حق المالك» (good, everyday), while the page behind it says «دفتر الاستحقاق», «سياسات الاستحقاق», «الاستحقاق المعتمد», «تسوية استحقاق».

**Evidence**
Live: «حق المالك · دفتر منفصل عن الربح» then button «فتح دفتر الاستحقاق والحركات», metric «استحقاق مسجل». «استحقاق» is MSA/accounting; a Jordanian says «حقي».

**Failure scenario**
Owner taps «حق المالك», lands on a page about «الاستحقاق», concludes it's a different/official thing and backs out.

**User impact**
The owner-money ≠ profit boundary is correct in both wordings, but one wording hides it behind vocabulary.

---

#### [L-09] «ذمة» survives in four user-visible strings although the app elsewhere says «دين»
- Severity: MEDIUM
- Confidence: CONFIRMED
- Location: `homeControlCenterService.ts:128,229` · `ActualTimePanel.tsx:215` · `g5Service.ts:461`
- Source: verified-in-app (Home fact helper live: «ذمة عميل مسجلة، وليست كاشًا محصلًا»)

**What happens**
«ذمة/ذمم» (accounting receivables) appears beside the app's own canonical «دين مسجل» (Orders, Finance position cards).

**Evidence**
Live Home card: «ذمة عميل مسجلة، وليست كاشًا محصلًا» while the Finance card for the same concept says «دين مسجل بعد التسليم».

**Failure scenario**
Two names for the same money concept on two adjacent screens; «ذمة» is not daily Jordanian vocabulary (الدين/عليه هي).

**User impact**
Inconsistent naming weakens the debt ≠ cash boundary's recognizability.

---

#### [L-10] «الفعل التالي» vs «الخطوة التالية» — same concept, two labels, both heavy
- Severity: MEDIUM
- Confidence: CONFIRMED
- Location: «الفعل التالي»: `Orders.tsx:99,142` · `OrderDetail.tsx:230` · `Finance.tsx:389,403,1155` · «الخطوة التالية»: `components/presentation/DecisionPanel.tsx:21`
- Source: verified-in-app

**What happens**
The single most repeated guiding label in the app exists in two variants.

**Evidence**
Live: Orders rows «الفعل التالي: أكمل ما تعرفه الآن.», OrderDetail card «الفعل التالي / ابدأ التنفيذ», Finance «الفعل التالي: …», but DecisionPanel says «الخطوة التالية». «الفعل التالي» is also philosophers' MSA — a shop owner says «الخطوة الجاية».

**Failure scenario**
None severe — friction and the feeling that screens were written by different people.

**User impact**
Mild; canonicalize on «الخطوة التالية».

---

#### [L-11] «درجة المعرفة» + option «معروف» — jargon label on an honesty control
- Severity: MEDIUM
- Confidence: CONFIRMED
- Location: `pages/CostEditor.tsx:474,491-493,689,696-698` · `pages/FinancialEventEditor.tsx:475,480-482` · `pages/G5DeclarationEditor.tsx:163,168-171` · `pages/OrderDetail.tsx:286`
- Source: verified-in-app (CostEditor select live)

**What happens**
The confidence selector that powers Micro's knowledge-honesty is labelled «درجة المعرفة» with options «معروف / تقديري».

**Evidence**
Live on CostEditor: «درجة المعرفة: تقديري». A number is not «معروف» — a number is «مؤكد» or «تقديري». The label «درجة المعرفة» sounds like a school grade.

**Failure scenario**
Owner leaves it on default because the question is unclear; the estimate/known distinction — which decides whether a final result shows — is under-declared.

**User impact**
Weaker knowledge declarations → the known/estimated honesty axis gets noisier.

---

#### [L-12] «عكس / العكس الموثق» — reversal vocabulary a shop owner doesn't use
- Severity: MEDIUM
- Confidence: CONFIRMED
- Location: `pages/Finance.tsx:711,725,738,778,788,790,838,1049,1074` · `pages/CashWallets.tsx:33,218` · `pages/CashReversalEditor.tsx` (passim) · `pages/InventoryMaterials.tsx:26,214` · `pages/InventoryReversalEditor.tsx` (passim) · `ActualTimePanel.tsx:169,248,251,337,372` · `pages/OwnerEntitlement.tsx:285,1291,1350,1412,1465` · `g5Service.ts:406,419`
- Source: verified-in-app (Finance reversal dialog)

**What happens**
Documented correction-by-opposite-entry is called «عكس» throughout («أكّد العكس الموثق», «عكس كامل», «عُكست», «صحح بعكس موثق», «تنفيذ العكس بسبب موثق»).

**Evidence**
Everyday «عكس» = opposite/inverse (اتجاه معاكس). The action a Jordanian names is «تراجع» / «صحّح».

**Failure scenario**
Owner hesitates to press «عكس» because they can't tell whether it deletes history (the app's biggest stated fear) — the word carries no meaning of "keep the original, cancel the effect".

**User impact**
Friction on the correction path; no wrong outcome (the confirm dialog explains well).

---

#### [L-13] Owner-entitlement page wall of system vocabulary: «خليفة», «السلسلة», «إصدار», «قفل الفترة»
- Severity: MEDIUM
- Confidence: LIKELY
- Location: `pages/OwnerEntitlement.tsx:304,320,326,335,336,341,345,369,370,636,637,648,649,651,654,656,798,826,832,843,852,863,889,907,916,925,945,946,1023,1035,1068`
- Source: code-only (page strings read in code)

**What happens**
The page describes policy versioning with successor-chain vocabulary: «خليفة مؤرخة», «نوع الخليفة», «مبلغ الخليفة», «تاريخ نفاذ الخليفة», «السلسلة <uuid8>», «خليفة لـ <uuid8>», «الفترة والمصدر مقفولان ضد تكرار الحق», «قفل الفترة متاح لإعادة تسجيل صحيحة».

**Evidence**
Read in code. The page elsewhere explains the same thing well: «تنشأ نسخة جديدة بإعداداتك الجديدة».

**Failure scenario**
Owner wants to change their monthly amount and cannot find it: the edit drawer is named «تعديل سياسة» with «خليفة» inside. They fear editing will rewrite history and stop.

**User impact**
The owner-pay area is effectively locked behind vocabulary; no wrong money, but likely no use.

---

#### [L-14] «مركز القيادة / قراءة قيادة» and split home naming
- Severity: MEDIUM
- Confidence: CONFIRMED
- Location: `pages/Home.tsx:68,74,89,224` · `homeControlCenterService.ts:84,175,278,329,348,369` · nav label `app/navigation.ts:11` («مشروعي الآن»)
- Source: verified-in-app

**What happens**
Home is called «مشروعي الآن» in nav, «مشروعي اليوم» in its own overline, and «مركز قيادة المشروع» in loading/error/truth copy.

**Evidence**
Live: loading «جارٍ تجهيز مركز قيادة المشروع…», truth line «هذه قراءة قيادة محلية مشتقة من سجلات Micro…», heading overline «مشروعي اليوم», nav «مشروعي الآن». «مركز قيادة» is military/corporate register. Also live: «السعة غير حكم رفض تلقائي» (`homeControlCenterService.ts:278`) — ungrammatical.

**Failure scenario**
No wrong action — the register signals "this app is for professionals, not me", the exact anti-goal of Micro's audience.

**User impact**
Tone mismatch on the very first screen after setup.

---

#### [L-15] Raw ISO dates and months rendered to the user
- Severity: MEDIUM
- Confidence: CONFIRMED
- Location: `pages/Home.tsx:93` (todayLocal) · `homeControlCenterService.ts:108` («حتى 2026-08-28»), `:47,341,347,352,355` (occurredOn) · `pages/Finance.tsx:284` («النطاق المحدد: 2026-08 — 2026-08») · `pages/Catalog.tsx:1488,1582,1583`
- Source: verified-in-app

**What happens**
Dates appear as ISO `2026-08-28` / `2026-08` in Home heading, fact cards' period line, recent-changes rows, Finance period label, and Catalog policy rows — while the app already ships `formatLocalDate`, `formatLocalDateLong` («28 آب 2026» — live in date fields), and `formatMonthLabel`.

**Evidence**
Live Home: `<time>2026-08-28</time>`, «حتى 2026-08-28», recent change «موعد: 2026-09-04». Live Finance: «النطاق المحدد: 2026-08 — 2026-08». The agreement editor's date field meanwhile shows «التاريخ المحدد: 4 أيلول 2026» — two date languages in one app. RTL rendering of `2026-08-28` inside Arabic lines is also bidi-fragile (these spots lack `<bdi dir="ltr">`).

**Failure scenario**
Owner reads `2026-08` as a code or an ID; misreading risk on dates that drive decisions (delivery day, follow-up).

**User impact**
Friction and misreading risk on decision dates.

---

#### [L-16] Concept-name inconsistencies across screens
- Severity: MEDIUM
- Confidence: CONFIRMED
- Location: «طلب مخصص» vs «طلب عميل» vs «طلب من عميل»: `QuickActionSheet.tsx:30` · `Orders.tsx:120` · `dailyFollowUpService.ts:107` vs `NewDraft.tsx:43` vs `DraftEditor.tsx:165`. «تثبيت» doing four jobs: `Setup.tsx:81` (save name) · `CostEditor.tsx:595`/`AgreementEditor.tsx:304` (create order) · `OrderDetail.tsx:42` («تثبيت السعر» event) · `PwaInstallControl.tsx:66,82` (install app). «مراجعة» = Review page vs template revision: `Catalog.tsx:557,1029,1176,1184,1235,1594` · `InventoryMovementEditor.tsx:353`. «الواقعة» vs «حدث مالي/حدث عام»: `Finance.tsx:692,795,818` · `G5DeclarationEditor.tsx:202` · `FinancialEventEditor.tsx:274` vs Finance headings/Settings
- Source: verified-in-app (طلب مخصص live in quick sheet; تثبيت الاتفاق live; مراجعة read in code)

**What happens**
The same action/concept wears different names on different screens.

**Evidence**
Live: quick-action sheet offers «طلب مخصص» but the next screen's heading is «طلب من عميل»; Setup button «ثبّت الاسم…» vs Agreement button «تثبيت الاتفاق» vs PWA «تثبيت Micro» (only the last is standard Arabic for install). Catalog uses «مراجعة»/«أنشئ مراجعة» for template *revisions*, colliding with the «المراجعة» tab.

**Failure scenario**
Owner cannot build a stable map of the app; «تثبيت الاسم» suggests something permanent/official when it is a local save; template «مراجعة» suggests the Review screen. Mild risk of pressing «تثبيت الاتفاق» believing it's a save, when it actually creates the order.

**User impact**
Navigation confidence drops; the irreversible-ish transition in the order flow wears a vague verb.

---

#### [L-17] Invented or internal system words leaked into copy
- Severity: MEDIUM
- Confidence: CONFIRMED
- Location: «ظهورات» (×12): `pages/Schedule.tsx:456,472,483,522,533,564,598,619,640,647` · «الشريحة»: `InventoryMovementEditor.tsx:244` · «الحارس» + «لم يُخترع لها انتقال جديد»: `presentation/orderAgreementPresentation.ts:118,125` · «أُرشف»: `CashReversalEditor.tsx:62` · «حرفة مخصصة»: `Setup.tsx:35`
- Source: code-only

**What happens**
Copy contains words from the internal architecture («الشريحة» = slice, «الحارس» = guard) and literal coinages («ظهورات» for occurrences; «أُرشف» for an archive feature that does not exist).

**Evidence**
«لا تسمح الشريحة بخروج كمية أكبر من المتاح», «الحالة محجوبة للمراجعة؛ لا تتجاوز الحارس بفعل مالي عام», «ربما أُرشف السجل أو عُكس سابقًا» (there is no archive), «أُنشئت 5 ظهورات مستقلة», Setup «حرفة مخصصة» (user cannot map it to anything they chose).

**Failure scenario**
Owner meets words that exist nowhere in their life; the sentence's real warning (can't overdraw stock; status blocked pending review) is lost.

**User impact**
Confusion without wrong outcome, except «أُرشف» which invents a nonexistent capability — a mild honesty issue.

---

#### [L-18] Hard-coded plurals bypass the Arabic plural helper
- Severity: LOW
- Confidence: CONFIRMED
- Location: `pages/CashWallets.tsx:149` (`${n} محافظ كاش`), `:168` (`${n} آثار محفوظة`) · `pages/InventoryMaterials.tsx:167` (`${n} حركات محفوظة`) · `pages/Catalog.tsx:1061,1206` (`${n} مكوّن`)
- Source: code-only

**What happens**
`formatArabicPlural` exists and is used well elsewhere, but these spots template the count directly, producing «2 آثار محفوظة» / «2 محافظ كاش» — wrong Arabic for 2 and 11+.

**Evidence**
`{wallet.entryCount} آثار محفوظة` — for 2 entries the correct form is «أثران محفوظان».

**Failure scenario**
None functional — cosmetic grammar.

**User impact**
Polish; signals non-native copy on money screens.

---

#### [L-19] Button labels over 30 characters crowd a 360px phone
- Severity: LOW
- Confidence: CONFIRMED
- Location: `pages/Schedule.tsx:640` «إيقاف الظهورات المستقبلية بسبب مكتوب» (38 chars) · `pages/Finance.tsx:483` «دفتر استحقاق المالك والسحب الفعلي» (33) · `pages/Finance.tsx:632` «أعلن تحصيلًا أو التزامًا قريبًا» (31) · `pages/CostEditor.tsx:548` «لا ينطبق الآن — احتسبه صفرًا» (27, text-action)
- Source: code-only (measured programmatically)

**What happens**
The longest primary buttons wrap to two lines on 360px, pushing the button row height and neighbours.

**Evidence**
Measured character counts; these four exceed every other button in the app (next longest: «سجل التزامًا لمورد», 18).

**Failure scenario**
Two-line wrapped primary button; tap target shifts as labels change between states.

**User impact**
Cosmetic/ergonomic.

---

#### 4.4.1 Unified glossary (proposed canonical terms)

| Concept | Canonical term | Rejected variants (found) | Why |
|---|---|---|---|
| Expected incoming/outgoing cash (G5 declarations) | **«متوقع»** — «قبض متوقع» / «دفع متوقع» / «المتوقعات المحلية» | «إعلان», «إعلان السيولة», «تحصيل معلن», «التزام معلن», «بعد المعلن» | «إعلان» reads as advertisement; «متوقع» names the epistemic status honestly |
| Cost snapshot (CostSnapshot) | **«نسخة التكلفة»** | «Snapshot», «Snapshot التكلفة», «لقطة» | Already CostEditor's own term; one name everywhere |
| COGS (recorded consumption cost) | **«تكلفة البيع المسجلة»** | «COGS», «تكلفة البضاعة المباعة» | Matches Finance.tsx:313 wording; operational |
| Recognized revenue / cost (at delivery) | **«المحتسب عند التسليم»** | «الإيراد/التكلفة المعترف به(ـا)» | Keeps counted-at-delivery ≠ collected-cash exact, drops recognition jargon |
| Period result | **«نتيجة الفترة المسجلة»** | «صافي الربح التشغيلي المسجل للفترة» | The contract's own public name; removes «صافي ربح» framing |
| Contribution margin | **«الهامش بعد الكلفة المباشرة»** | «هامش المساهمة» | Textbook term → arithmetic description |
| Break-even | **«كم وحدة تغطي المصاريف الثابتة»** | «نقطة التعادل المفككة من المزيج المسجل» | The owner's own question; «المزيج المسجل» stays only as the fallback scale note |
| Variable / fixed expense | **«الكلفة المباشرة للطلبات النهائية» / «المصاريف الثابتة المسجلة»** | «التكلفة المتغيرة», «الثابت المسجل» | Operational, same numbers |
| Shared-expense allocation | **«توزيع»** («موزّع / غير موزّع») | «تحميل», «محمل», «أساس التحميل» | «تحميل» = download in daily usage |
| Documented correction (reverse entry) | **«تراجع موثق»** | «عكس موثق», «عكس كامل», «عكس أثر» | Everyday verb matching "undo effect, keep original" |
| Owner entitlement | **«حق المالك»** («حق مسجل», «تسوية حق») | «استحقاق المالك», «دفتر الاستحقاق», «سياسات الاستحقاق» | «حقي» is the living word; page heading already uses it |
| Customer debt / receivable | **«دين»** («لي عند العملاء») | «ذمة», «ذمم» | Everyday Jordanian; app already canonical on Orders/Finance |
| Cash collection | **«قبض»** (verb-first) — accept existing «تحصيل» only as secondary noun; never mix both on one screen | «تحصيل» + «قبض» mixed today | «قبض» is the daily verb; mixing two names on adjacent screens is the defect |
| Wallet | **«محفظة»** | «صندوق» (not found — good) | Consistent today |
| Knowledge/confidence of a number | **«حالة الرقم: مؤكد / تقديري / يحتاج مراجعة»** | «درجة المعرفة», option «معروف» | A number is مؤكد or تقديري; label asks the real question |
| Next action | **«الخطوة التالية»** | «الفعل التالي» | Already used in DecisionPanel; lighter MSA |
| Financial event | **«حدث مالي»** | «الواقعة», «حدث عام», «أحداث عامة» | One name |
| New-order intent | **«طلب من عميل»** / **«مسودة تصميم»** | «طلب مخصص», «طلب عميل» | One name per intent, matching DraftEditor headings |
| Agreement confirmation | **«تسجيل الاتفاق»** | «تثبيت الاتفاق», «تثبيت الاسم» | «تثبيت» reserved exclusively for app install |
| Catalog template revision | **«نسخة جديدة»** | «مراجعة» (for revision) | «مراجعة» reserved for the Review tab |
| Recurring occurrence | **«موعد»** («مواعيد قادمة») | «ظهور», «ظهورات» | «ظهورات» is not a word anyone says |
| App version / internal slices | **«هذا الإصدار»** | «Prototype», «G5», «G3», «O1», «Snapshot», «final», «yield», «basis points», «immutable», «Store», «milli», «JSON», route names, raw UUIDs | Internal codes never reach the user |
| Money display | **«د.أ»** (after the LTR number) | «JOD» (only in types — clean) | Consistent today — keep |
| Price floor | **«سعر الحماية»** — KEEP | «الحد الأدنى للسعر» | Coined Micro term, used consistently and always explained nearby; alternatives weaken the protective framing |
| Deposit / payables / balance / settlement | **«عربون» / «عليّ للموردين» / «رصيد» / «تسوية»** — KEEP | — | Already living Jordanian usage |
| Home screen | **«مشروعي الآن»** | «مركز القيادة», «مشروعي اليوم», «قراءة قيادة» | Matches nav; drops corporate register |

*(The per-string change table — one row per proposed change with location, current text, problem, proposed text, and rationale — contains 60+ rows; it is reproduced in full in `MICRO-REMEDIATION-PLAN.md` where each row is traceable to its finding card. The rows honour the hard constraint: no proposal widens what the system claims.)*

*Areas checked and found clean (Agent 4):* currency display («د.أ» consistent, zero JOD/JD leakage, numbers isolated in `<bdi dir="ltr">`); «غير متاح» discipline (null/unknown never renders 0.00 — exemplary); Setup/NewDraft/DraftEditor/CostEditor/AgreementEditor truth lines («الصفر ليس بديلًا عن وقت أو تكلفة لا تعرفها» etc. — excellent); Orders/OrderDetail status grammar; Suppliers copy («ما عليك للموردين» — clean); cash pages' «حد الحقيقة» cards; FinancialEventEditor effect descriptions (best-written copy in the app); InventoryMaterials/MaterialEditor; Settings honesty block + persistentStorage states; PWA copy (truthful and calm); StartupGate recovery copy; LocalDateField readable dates; Arabic plural helper usage where applied. Watch-list terms checked and NOT present: «مسيّر», «عهدة», «مصالحة», «لقطة», «ضريبة», «ضمان/مضمون», «محمي», «بدون فقدان». Over-promise scan («تلقائي») found only honest *negations* except L-06.

---

### 4.5 Agent 5 — Expansion audit: Micro Market and Micro Delivery (`E-##`)

Scope: `docs/expansion/` (all 28 items) plus contracts 20 (market) and 21 (delivery), cross-referenced against contracts 18–24. State: documentation only, no code exists. 21 findings: 9 HIGH, 10 MEDIUM, 2 LOW. The prior review's group-C cards X-03..X-08 were re-verified (see §3) and not restated.

#### 4.5.1 Readiness table

| Capability | Verdict | Reason |
|---|---|---|
| Need posting (Owner) | NEEDS DECISION + SPEC | EX-O01/O02 gate category/area/unit taxonomies; window auto-expiry actor undefined; no honest "zero responses" state (E-16) |
| Supplier responses | NEEDS SPECIFICATION | No contact channel on `market_response` for external follow-up; unlisted-supplier policy undefined; revision semantics vague (E-10) |
| Listing moderation | NEEDS SPECIFICATION | State names contradict TRACKER (E-06); `rejected`/`paused`/`update_required` exits undrawn; media has no state machine; backlog unbounded (E-17) — decision content itself answered (X-07) |
| Delivery request | NEEDS DECISION + SPEC | X-06 no-response state absent (E-01); routing/courier targeting undefined (E-03); supplier-requested flows under-specified (E-11) |
| Quote | NEEDS SPECIFICATION | Expiry behaviour, withdrawal after acceptance, multi-quote cardinality, post-acceptance price change all undefined (E-04); money representation deferred by contract 24 §4 (E-14) |
| Assignment | NEEDS SPECIFICATION | Exception transitions and post-completion dispute representation undefined (E-02) |
| Completion / status events | READY at boundary level / NEEDS SPEC at semantics | The financial no-effect rules are airtight (contract 21 §5); `arrived` vs `completed` semantics and dispute exit are not (E-02) |
| Notifications / Attention | NEEDS SPECIFICATION | Entity fields exist (contract 19 §2) but no type/trigger enumeration; urgency field contradicts contract 24 (E-19, C5) |
| Consent | NEEDS SPECIFICATION | No consent entity/fields/duration/revocation; retention explicitly deferred (E-13); third-party data subject unaddressed (E-11) |
| Admin / moderation tooling | DEFER | Documented deferral (contract 22 §1) — acceptable, but backlog policy absent (E-17) |
| Supplier acquisition | NEEDS DECISION | EX-O07 open; card frames options honestly (X-05) |
| Revenue model | DEFER | EX-O08; fees/commission/payment banned until post-evidence gate — honestly deferred, correctly fenced away from owner money |

**Overall:** documentation-only status is accurate; governance and financial-boundary writing is unusually strong (all five boundaries verified to hold in every documented flow — see positive verification below); but **nothing is READY TO BUILD end-to-end** — an engineer would have to invent state transitions, routing, contact loops, and six entities' fields.

#### 4.5.2 Contradictions (with both locations)

| # | A | B | Subject |
|---|---|---|---|
| C1 | `docs/expansion/TRACKER.md` L-04.2: courier events `dispatched / arrived / completed / failed / cancelled` | `docs/contracts/21-delivery-request-quote-status-privacy-contract.md` §3: `booked → source_ready → picked_up → in_transit → arrived_or_completed` + 11 exception states | `dispatched` exists nowhere in contract 21; `failed` ≠ `delivery_failed`; happy-path states missing from tracker (→ E-05) |
| C2 | `docs/expansion/TRACKER.md` L-03.3: `draft → submitted → under_review → approved/rejected → paused/archived` | `docs/contracts/20-market-need-response-listing-moderation-contract.md` §3.3: `draft → submitted_for_review → approved_for_publish | changes_requested | rejected`; `approved_for_publish → paused | archived | update_required` | Different state names; tracker invents `under_review`, drops `changes_requested`/`update_required` (→ E-06) |
| C3 | `docs/expansion/E00-EXECUTION-PROTOCOL.md` §2 (E-00.2 = contracts 18+19+23+matrix; E-00.3 = 20+22; E-00.4 = 21; E-00.5 = scenarios) | `docs/expansion/TRACKER.md` §2 (E-00.2 = 18/23/24+matrix; E-00.3 = 19; E-00.4 = 20; E-00.5 = 21; E-00.6 = 22; E-00.7 = scenarios) | Work-package numbering re-assigned; protocol never updated (→ E-07) |
| C4 | `docs/expansion/HISTORICAL-SOURCES.md` §2 «القرار الحالي» column: «Market/Delivery قدرات تحت `الخدمات`» | `docs/expansion/MARKET-DELIVERY-OWNER-IA-CONTRACT.md` §1 + DECISIONS EX-D02 + current-state.md §14: «لا توجد صفحة خدمات مركزية», `السوق` in BottomNav | Stale "current decision" resurrects the central services page — and falsifies the E-00.14 review's sweep claim (→ E-08) |
| C5 | `docs/contracts/19-services-notification-manage-boundary-contract.md` §2: attention carries «مستوى إلحاح مبرر» | `docs/contracts/24-network-data-classification-field-dictionary-contract.md` §3 `network_attention`: no urgency field; "do not add" bans «urgency مصطنع» | Field required by 19 absent from the dictionary that exists to prevent field guessing (→ E-09) |
| C6 | `docs/expansion/TRACKER.md` L-00.4: «التوصيل/طلب أو عرض أو استثناء» | `docs/expansion/MARKET-DELIVERY-OWNER-IA-CONTRACT.md` §3: «`تحتاج إجراء` و`طلباتي`» | Second delivery section named differently in the two wireframe sources (→ E-20) |

#### [E-01] «الشركة لم ترد»: no state, timeout, or next action for a courier that never responds
- Severity: HIGH
- Confidence: CONFIRMED
- Location: `docs/contracts/21-delivery-request-quote-status-privacy-contract.md` §3; prior review §8 (X-06)
- Source: code-only (docs)

**What happens**
A `delivery_request` that reaches `submitted_for_quote`/`courier_reviewing` and receives no quote has no exit. The contract defines quote expiry («مدة سريان») but no request-level expiry, no timeout, no auto-cancel, and no honest "no response yet" state. Grep across all expansion docs and contracts 18–24 for timeout/«لم ترد»/«مهلة» returns nothing.

**Evidence**
Contract 21 §3: happy chain `draft → … → arrived_or_completed`; exceptions list `needs_clarification`, `courier_declined`, `requester_declined_quote`, `cancelled`, `reschedule_requested`, `source_not_ready`, `no_vehicle_available`, `pickup_failed`, `delivery_failed`, `recipient_unavailable`, `package_issue` — every one requires the courier to have acted; silence matches none.

**Failure scenario**
An engineer building L-04 must invent the most consequential state in the flow. The requester (a home-business owner who needed a pickup *today*) stares at a request that is neither alive nor dead, with no nudge, no expiry, no retry, and no honest explanation — exactly the «missing ≠ zero» sin the product exists to prevent.

**User impact**
Requester waits indefinitely or learns to distrust the Delivery section; the liquidity failure E-00.13 explicitly names («علامة عدم السيولة | لا رد…») is invisible in-product.

---

#### [E-02] Delivery exceptional states have no transitions, exits, or actors — multiple waiting-forever states
- Severity: HIGH
- Confidence: CONFIRMED
- Location: `docs/contracts/21-delivery-request-quote-status-privacy-contract.md` §2–§3; `TRACKER.md` L-04.2

**What happens**
Contract 21 documents a linear happy path plus a flat list of 11 exception states, with no transition matrix: no entry condition, no actor, and — critically — **no exit** for `needs_clarification`, `reschedule_requested`, `source_not_ready`, `recipient_unavailable`, `package_issue`, `pickup_failed`, `no_vehicle_available`. `arrived_or_completed` is terminal with no dispute exit. The `delivery_exception` entity has no enum for classifications or statuses. The historical spec even contained a recovery the current contract dropped: «يمكن إعادة المهمة إلى «تحتاج عرضًا جديدًا» أو إلغاؤها» (historical-source/03-micro-delivery.md §6) — contract 21 has no `requester_declined_quote → submitted_for_quote` return path.

**Evidence**
§3 lists exceptions in one sentence with zero arrows; §2 defines `delivery_exception` fields as prose only. As documented:
```
draft → submitted_for_quote → courier_reviewing → quote_submitted
      → requester_accepted_quote → booked → source_ready → picked_up
      → in_transit → arrived_or_completed          [terminal, no dispute exit]
exceptions (entry/exit/actor all undefined):
  needs_clarification, courier_declined, requester_declined_quote,
  cancelled, reschedule_requested, source_not_ready, no_vehicle_available,
  pickup_failed, delivery_failed, recipient_unavailable, package_issue
GAPS: no courier-silence state; no re-request loop; no dispute-of-completed;
      source_ready actor unstated; no exception→exception or exception→happy returns
```

**Failure scenario**
Partial delivery (`package_issue`?), recipient absent (retry or dead?), owner disputes `completed` (which state? who wins? what evidence?) — every implementer answers differently. "Both parties claim completion" is literally unrepresentable: the courier's `arrived_or_completed` cannot be contested in the state machine.

**User impact**
Owner cannot contest a false "completed"; exceptions become silent dead ends; disputes degrade to out-of-band WhatsApp arguments — the exact damage Micro set out to remove.

---

#### [E-03] No specification of how a delivery request reaches a courier; no courier-company profile entity
- Severity: HIGH
- Confidence: CONFIRMED
- Location: `docs/contracts/21` §2/§7; `docs/contracts/24` §3 (`network_workspace`); `ROLE-ACCESS-MATRIX.md` §2

**What happens**
`delivery_request` has no courier/workspace target field; nothing says whether a request goes to one courier, all couriers in the wedge, or is targeted by the owner. There is also no courier-company profile entity: `network_workspace` carries only «نوع الجهة، اسم عرض، حالة، tenant key» — no coverage area, service description, or anything an owner could use to choose a company.

**Evidence**
Contract 21 §7: «لا يفترض العقد وجود شركة واحدة أو أكثر؛ اختيار شركاء Beta قرار Pilot منفصل.» ROLE-ACCESS-MATRIX §2 Courier row: «يرى ما وصل لجهته بعد Scope» — *what reaches it* is never defined. Contract 24 §3 has no courier-profile/directory entity.

**Failure scenario**
The request-to-quote handoff — the core of the Delivery wedge — cannot be built without inventing the routing model, the courier list UI, and the courier-facing discovery surface. Whether competitors see the same request (and each other's prices) is a privacy question no doc answers.

**User impact**
Owner can't direct a request to the company they trust; or, if broadcast is guessed, couriers see demand volumes and each other's quotes — an undeclared marketplace the contracts never consented to.

---

#### [E-04] Quote lifecycle underspecified: expiry behaviour, withdrawal after acceptance, multiple quotes, post-acceptance price change
- Severity: HIGH
- Confidence: CONFIRMED
- Location: `docs/contracts/21` §2–§3; `ROLE-ACCESS-MATRIX.md` §2

**What happens**
Four unanswered quote questions: (1) what happens when «مدة سريان» lapses — no `expired` state for `delivery_quote` (unlike `market_response` which has one); (2) ROLE-ACCESS-MATRIX lets the courier «يسحب Quote جهته» — withdrawal *after* `requester_accepted_quote`/`booked` is undefined; (3) cardinality: UI copy shows «عروض» plural, but the state machine has a single `quote_submitted` and `delivery_assignment` references «مرجع Quote مقبول» — no rule for multiple simultaneous quotes; (4) a courier raising the price after acceptance has no state or rule.

**Evidence**
§2 quote row: «عرض سعر/نطاق إن اختار، نافذة متاحة، ملاحظة، ومدة سريان» — expiry exists as a field, never as behaviour. Grep for «عروض متعددة/عدة عروض/جميع الشركات» across contracts: zero matches.

**Failure scenario**
The most common real-world sequence — quote expires overnight; owner accepts a stale quote; courier says price changed — has no documented path. Engineers will silently allow or block accepting expired quotes.

**User impact**
Owner may "book" a delivery that doesn't exist, or lose a booking with no recourse state.

---

#### [E-05] CONTRADICTION: TRACKER L-04.2 courier event list vs contract 21 state machine
- Severity: HIGH
- Confidence: CONFIRMED
- Location: `docs/expansion/TRACKER.md` L-04.2 vs `docs/contracts/21` §3

**What happens**
TRACKER — which README Action Point 1 names «المصدر التنفيذي التفصيلي» — specifies a different delivery state vocabulary than the governing contract.

**Evidence**
TRACKER L-04.2: «أحداث `dispatched / arrived / completed / failed / cancelled`». Contract 21 §3: `booked / source_ready / picked_up / in_transit / arrived_or_completed` + `courier_declined / delivery_failed / …`. `dispatched` appears in no current contract; `failed` is not `delivery_failed`.

**Failure scenario**
An agent executing L-04 from the tracker builds `dispatched` and omits `source_ready`/`picked_up`/`in_transit`, violating contract 21's explicit gating rules («لا ينتقل إلى `picked_up` قبل حالة جاهزية مصدر معلنة»).

**User impact**
Two Micro builds would disagree about what a delivery *is*; QA scenarios S-05/S-06/S-09 map to contract states, not tracker states, so acceptance silently diverges.

---

#### [E-06] CONTRADICTION: TRACKER L-03.3 listing states vs contract 20 §3.3
- Severity: HIGH
- Confidence: CONFIRMED
- Location: `docs/expansion/TRACKER.md` L-03.3 vs `docs/contracts/20-market-need-response-listing-moderation-contract.md` §3.3

**What happens**
The tracker's state machine invents `under_review` and `submitted`, renames `approved` (vs `approved_for_publish`), and drops `changes_requested`/`update_required`.

**Evidence**
TRACKER L-03.3: «تمر `draft → submitted → under_review → approved/rejected → paused/archived`». Contract 20 §3.3: «draft → submitted_for_review → approved_for_publish | changes_requested | rejected» plus «approved_for_publish → paused | archived | update_required» and «changes_requested → submitted_for_review».

**Failure scenario**
Building L-03.3 as written produces a moderation loop with no `changes_requested` path — Admin can only approve/reject, breaking the documented supplier correction loop (S-11).

**User impact**
Suppliers lose the repair path the contract promised; rejections become dead ends; moderation degrades to binary.

---

#### [E-07] CONTRADICTION: E-00 execution protocol's work-package numbering vs TRACKER
- Severity: MEDIUM
- Confidence: CONFIRMED
- Location: `docs/expansion/E00-EXECUTION-PROTOCOL.md` §2 vs `docs/expansion/TRACKER.md` §2

**What happens**
The anti-conflict handoff protocol assigns contracts to the wrong tracker items (C3 above) and stops at E-00.6 while the tracker runs to E-00.14.

**Evidence**
Protocol §2 table vs tracker §2 table, quoted in the contradiction table.

**Failure scenario**
An agent following the protocol (mandatory reading) scopes a PR to the wrong contracts and mis-links acceptance evidence — the exact failure mode the protocol exists to prevent.

**User impact**
Indirect but real: governance drift; acceptance records pointing at the wrong governing documents.

---

#### [E-08] CONTRADICTION: HISTORICAL-SOURCES §2 still presents «قدرات تحت الخدمات» as the current decision
- Severity: MEDIUM
- Confidence: CONFIRMED
- Location: `docs/expansion/HISTORICAL-SOURCES.md` §2 (line 23) vs `MARKET-DELIVERY-OWNER-IA-CONTRACT.md` §1 + DECISIONS EX-D02 + current-state.md §14; also `E00-14-INDEPENDENT-ACCEPTANCE-REVIEW-2026-08-28.md` §2

**What happens**
In a table whose column header is «القرار الحالي» (the current decision), the navigation registry says the current decision is «Market/Delivery قدرات تحت `الخدمات`» — the superseded IA. It contradicts the accepted E-00.14 decision and falsifies that review's contradiction-sweep claim: «مسح التناقضات | لا يبقى افتراض Canonical عن لوحة خدمات مركزية».

**Evidence**
HISTORICAL-SOURCES.md line 23 vs IA contract lines 12–14: «يحل **`السوق`** محل `الخدمات` في BottomNav… لا توجد صفحة أو dashboard مركزية باسم `الخدمات`».

**Failure scenario**
An agent researching "why" (which §1 of that doc invites) reads the *current-decision* column and rebuilds a services hub — the exact regression E-00.14 was accepted to prevent.

**User impact**
Owner sees a three-product chooser screen — the experience the whole IA decision exists to avoid.

---

#### [E-09] Field dictionary (contract 24) omits six defined entities plus a field contract 19 requires
- Severity: HIGH
- Confidence: CONFIRMED
- Location: `docs/contracts/24-network-data-classification-field-dictionary-contract.md` §3 vs contracts 18 §2, 19 §2, 20 §2, 21 §2

**What happens**
Contract 24 is the single «قاموس الحقول الأدنى» whose stated purpose is that no field enters schema without classification — yet six entities defined by contracts 18–21 have no field dictionary at all: `network_invitation`, `network_access_decision`, `external_reference`, `recording_suggestion`, `delivery_exception`, `market_decision`. Additionally `network_attention` lacks the «مستوى إلحاح مبرر» that contract 19 §2 requires.

**Evidence**
Contract 24 §3 entity list (verified by grep) contains 14 entities; the six above are absent. Contract 19 §2: attention's minimal info includes «ومستوى إلحاح مبرر».

**Failure scenario**
The six missing entities include the failure-path record (`delivery_exception`) and the decision record (`market_decision`) — precisely the entities E-01/E-02 showed are underspecified. Engineers must invent their fields with zero classification, defeating contract 24's own rule: «الحقل الذي لا يملك هذه الأجازات يبقى خارج Schema».

**User impact**
Privacy/classification guarantees (who sees a rejection reason, what an exception stores) become per-implementation accidents rather than contract.

---

#### [E-10] The accepted-response contact loop is closed only for listings — not for responses
- Severity: HIGH
- Confidence: LIKELY
- Location: `docs/contracts/20` §1.1, §2, §3.2; `docs/contracts/24` §3 (`network_workspace`)

**What happens**
`accepted_for_external_follow_up` means «Owner يختار متابعة خارج Micro» — but the `market_response` entity carries no contact field, and the supplier workspace entity has only a display name. External contact is specified only on *listings* («فتح وسيلة اتصال خارجية معلنة», §1.1). Nothing states whether a supplier without an approved listing may respond to needs at all — and moderation (contract 22) reviews listings/media only, never responses.

**Evidence**
Contract 20 §3.2 vs §2 response row; contract 22 §2 decision table covers `supplier_listing`/`listing_media`/بلاغ only.

**Failure scenario**
The Market wedge's minimum result («Need → Response → قرار Owner بلا شراء تلقائي») ends in a decision the owner cannot act on: no phone, no channel, nothing to open. Or — worse guess — an engineer puts a free-text contact field in the response, unmoderated, which becomes the spam/scraping surface.

**User impact**
Owner accepts a response and the trail goes cold inside the app; suppliers who answer needs get no reachable follow-up unless they also maintain a listing.

---

#### [E-11] The end customer is a data subject with no documented consent path; supplier-requested deliveries can disclose the owner's address without the owner's preview
- Severity: HIGH
- Confidence: CONFIRMED
- Location: `docs/contracts/21` §4; `docs/contracts/24` §2 (`delivery_scoped`); `ROLE-ACCESS-MATRIX.md` §3; contracts 22 §3, 23 §5

**What happens**
Contact data of a third party — the owner's customer — moves to the courier on the strength of the *owner's* preview and approval only; no document mentions the customer's awareness or consent. Contract 24's rule is «موافقة Owner **أو طالب الحركة»**: when the *supplier* is the requester (contract 21 §2 allows it) shipping *to the owner*, the supplier's consent suffices and the owner — now the data subject — never previews. After closure, retention is explicitly deferred («بحسب سياسة الاحتفاظ», contract 21 §4; contract 23 §5 pushes retention to a future legal review).

**Evidence**
Contract 21 §4: «يظهر له معاينة «ما ستراه جهة التوصيل» ويقرها قبل الإرسال» (him = Owner). Contract 24 §2: «لا يكشف قبل Scope وPreview وموافقة Owner أو طالب الحركة». No occurrence anywhere of customer-side consent.

**Failure scenario**
Built as documented, a courier company accumulates a customer address/phone database with per-task consent from the *seller* only — a data-protection exposure the moment a real party joins, in a jurisdiction whose review is still a generic TBD (OR-O04).

**User impact**
The owner's customer gets calls/visits they never agreed to; the owner bears the reputational damage; the platform bears the legal exposure.

---

#### [E-12] No abuse, spam, or scraping controls anywhere — and courier reads of contact data are not audited
- Severity: MEDIUM
- Confidence: LIKELY
- Location: `docs/contracts/22` §2; `ACTIVATION-OPERATIONAL-READINESS-AND-SAFETY-GATE.md` §4 (OR-03); all contracts 18–24

**What happens**
Fake needs (harvesting supplier responses), response spam against every published need, quote spam, and courier address-book accumulation have no documented mitigation: no rate limits, quotas, duplicate detection, or velocity checks anywhere. Moderation is post-hoc only. The audit-event list in contract 22 §4 covers disclosures, quotes, and status changes — **not reads** of `delivery_scoped` contact data by courier members.

**Evidence**
Grep for rate-limiting concepts across expansion + contracts: absent. Contract 22 §4: «يوثق الأفعال الحساسة، ومنها محاولة وصول مرفوضة… إرسال/قبول Quote، وتحديث Status استثنائي» — no read events.

**Failure scenario**
At Pilot with two real suppliers, one competitor with a browser can answer every need with junk; a courier with bookings can systematically copy customer numbers. This graduates from MEDIUM to blocking exactly at gate A/B.

**User impact**
Suppliers waste effort on fake demand; customers receive unsolicited contact; trust collapses before liquidity is ever tested.

---

#### [E-13] Consent is an action pattern, not a record — no entity, duration, or revocation semantics
- Severity: MEDIUM
- Confidence: CONFIRMED
- Location: `docs/contracts/22` §3; `docs/contracts/23` §5; `docs/contracts/24` §3

**What happens**
Contract 22 (titled «الموافقة…») defines consent as preview-and-confirm actions whose trace lives in audit events; there is no consent entity, no fields (who consented, to which scope, when, until when), no revocation flow beyond «قبل الحجز يعدل/يلغي؛ بعده يسجل تغييرًا أو استثناءً», and retention is expressly deferred.

**Evidence**
Contract 24 §3 has no consent row; contract 22 §3 is a process table only.

**Failure scenario**
When gate A requires proving "this address was disclosed under consent X at time T with scope S", the only reconstructable evidence is an audit-event format that contract 24 doesn't define for this purpose.

**User impact**
Owners cannot see or revoke what they consented to per task; compliance at Pilot rests on archaeology.

---

#### [E-14] Money representation for network amounts is deferred to an unwritten contract
- Severity: MEDIUM
- Confidence: CONFIRMED
- Location: `docs/contracts/24` §4; `docs/contracts/21` §2 (quote fields)

**What happens**
Quotes/responses may carry amounts, but the representation contract — allowed currencies, rounding, minor units — is explicitly deferred: «يحدد عقد العملة/التقريب لاحقًا تمثيلًا دقيقًا قبل الكود». The existing domain money model is JOD minor units; nothing states network amounts reuse it.

**Evidence**
Contract 24 §4, verbatim above; contract 21 §2 quote row.

**Failure scenario**
The first engineer to write the `delivery_quote` DTO picks float, string, or minor units by taste; a second currency silently breaks assumptions downstream.

**User impact**
None today; a re-spec tax and possible comparison/display errors the moment quotes become comparable.

---

#### [E-15] L-phase network storage location and export/restore scope for local drafts are undefined — and the two governing docs pull in opposite directions
- Severity: MEDIUM
- Confidence: CONFIRMED
- Location: `docs/expansion/MANAGE-NETWORK-MIGRATION-EXPORT-GATE.md` §1–§2; `docs/expansion/TRACKER.md` L-01.2/L-01.3; `docs/contracts/23` §2; `LOCAL-FIRST-HOME-TRIAL-SOP.md` §3

**What happens**
TRACKER L-01.2 says to add IndexedDB persistence for the network domain. The migration gate forbids `localSchemaVersion`/`localExportVersion` changes «بسبب E-00 أو L-01 أو E-01» — only reconcilable if network data lives in a *separate* store, and no doc says that. Separately, the gate excludes *connected* Market/Delivery data from export; contract 23 §2 makes local drafts device-resident; yet the Home-Trial SOP requires verifying that drafts survive Export/Restore drills. Whether local drafts are inside the local export is stated nowhere.

**Evidence**
Gate §1: «لا يشمل `local export/import` بيانات Market/Delivery **المتصلة**…» (connected — drafts unaddressed). TRACKER L-01.2: «ثم `PrototypeLocalStore` وIndexedDB». SOP §3: «كل أسبوعين | Export ثم Restore في بيئة اختبار والتحقق من المسودات والتاريخ».

**Failure scenario**
Engineer A adds object stores to the existing DB (schema 26→27, violating the gate); engineer B puts drafts in a separate DB excluded from export — then the owner's phone dies mid-trial and every draft is gone despite "passed" weekly restore drills.

**User impact**
Either the core's compatibility promise breaks, or the owner loses a month of trial drafts believing they were backed up.

---

#### [E-16] Market need lifecycle: no auto-expiry, no honest no-response state, undefined response expiry trigger
- Severity: MEDIUM
- Confidence: CONFIRMED
- Location: `docs/contracts/20` §2–§3.2; `COMMERCIAL-LIQUIDITY-AND-MODEL-DECISION-CARD.md` §3

**What happens**
The need's time window is optional; nothing auto-closes a need whose window elapsed («انتهت نافذة النشر» exists only as a *close reason*, with no transition, actor, or timing). A published need with zero responses sits `published` forever with no honest state — even though E-00.13 names «لا رد» as the liquidity-failure signal to measure. `market_response → expired` has no defined trigger.

**Evidence**
Contract 20 §3.1: «يمكن أن يظل الاحتياج `published` مع ردود متعددة… كل إغلاق يوضح هل السبب قرار خارجي أو لم يعد الاحتياج قائمًا أو انتهت نافذة النشر» — closure reasons without a closure mechanism.

**Failure scenario**
L-03 ships with immortal needs; the trial's most important signal (nobody responded) is invisible; suppliers browse a market of ghost demands from last month.

**User impact**
Owner can't distinguish "no supply exists" from "nobody saw it" — the exact ambiguity the honesty policy forbids elsewhere.

---

#### [E-17] Listing/media lifecycle exits and moderation backlog are unbounded
- Severity: MEDIUM
- Confidence: CONFIRMED
- Location: `docs/contracts/20` §3.3; `docs/contracts/22` §1–§2

**What happens**
`rejected` has no documented exit (resubmit? new listing?); `paused` has no resume transition; `update_required`'s return path is implied but never drawn; «انتهاء صلاحية» appears in prose only — there is no `expired` state. `listing_media` has no state machine at all. No queue policy, review-time expectation, or escalation exists — contract 22 §1 explicitly builds none — so a listing can sit `submitted_for_review` forever with the supplier blind.

**Evidence**
§3.3 diagram shows no exits from `rejected`/`paused`/`update_required`; contract 22 §1: «لا ينشئ هذا العقد فريقًا أو Queue أو مزود تخزين».

**Failure scenario**
Cold-start moderation by a part-time owner-operator: three suppliers onboard, all listings await review, nothing ships, nothing tells anyone.

**User impact**
Suppliers see their storefront frozen in review-limbo with no ETA; owners see an empty market that isn't actually empty.

---

#### [E-18] Jordan-specific legal exposure is deferred generically; no domain is ever named
- Severity: MEDIUM
- Confidence: CONFIRMED
- Location: `ACTIVATION-OPERATIONAL-READINESS-AND-SAFETY-GATE.md` §8 (OR-O04); contracts 22 §6, 23 §5; `ACTIVATION-PRIVACY-ETHICS-SOP.md` §2

**What happens**
Multiple docs require «مراجعة قانونية محلية» before real data — a correct gate — but no document enumerates the domains that review must cover: consumer protection, e-commerce law, personal data protection, licensing of courier/delivery activity, or tax implications for suppliers earning through the marketplace.

**Evidence**
OR-O04: «مراجعة الخصوصية والالتزامات القانونية واللغة المناسبة في الأردن/السوق الفعلي… لا يحق للـAgent حسمه» — no domain list; grep across the corpus finds only the generic deferral.

**Failure scenario**
A single "legal review" tick-box gets filled by one opinion on privacy terms while courier licensing and supplier tax exposure remain unexamined until they surface as incidents.

**User impact**
Suppliers could face tax/registration surprises; the platform could discover a licensing requirement after onboarding real couriers.

---

#### [E-19] Notification types and triggers are never enumerated
- Severity: MEDIUM
- Confidence: CONFIRMED
- Location: `docs/contracts/19` §2, §3; `docs/contracts/24` §3

**What happens**
`network_notification` is defined as an entity and contract 19 §3 gives display rules for five example situations — but no document lists the complete set of notification types, their triggers, dedup rules, or which state transitions emit them.

**Evidence**
Contract 19 §3 table is examples («وصل رد مورد», «عرض Courier ينتظر Owner», …) with no completeness claim; contract 24's `type` field has no enumeration.

**Failure scenario**
Each screen invents its own badge sources; S-15A (stale notification link) becomes untestable because no spec says which links notifications must carry.

**User impact**
Inconsistent badges across Market/Delivery; some decisions (an expiring quote) may never notify at all.

---

#### [E-20] Delivery section naming differs between the two wireframe sources
- Severity: LOW
- Confidence: CONFIRMED
- Location: `docs/expansion/TRACKER.md` L-00.4 vs `docs/expansion/MARKET-DELIVERY-OWNER-IA-CONTRACT.md` §3

**What happens**
L-00.4 requires wireframes for «`التوصيل/طلب أو عرض أو استثناء`» while the IA contract defines the delivery page as «`تحتاج إجراء` و`طلباتي` وسجل حالة مختصر».

**Evidence**
Both quotes verbatim (contradiction C6).

**Failure scenario**
Two agents produce two wireframe sets with different information architecture for the same screen.

**User impact**
None directly; QA churn.

---

#### [E-21] Glossary grants Owner a «ممثل مخول» the identity contract explicitly excludes
- Severity: LOW
- Confidence: CONFIRMED
- Location: `docs/expansion/EXPANSION-GLOSSARY.md` (Owner row) vs `docs/contracts/18` §7

**What happens**
The glossary defines Owner as «صاحب مشروع أو ممثل مخول له داخل Workspace» while contract 18 defers any delegation («مشاركة حساب أو Delegation واسع | يحتاج نموذج مسؤولية وتدقيق… | بعد دليل استخدام حقيقي»).

**Evidence**
Both quotes verbatim.

**Failure scenario**
A spec-reader builds multi-member owner workspaces ahead of any audit/recovery model.

**User impact**
None now; a vocabulary seed for scope creep.

---

#### 4.5.3 Smallest buildable vertical slice (expansion agent's proposal)

**Market: Need → Response → Owner decision** (matches First-Wedge card §2's minimum Market Beta result; requires the owner to first fill the Wedge card — EX-O01/O02/O03 — and the E-10/E-15 storage decision):

- **Entities (local, network context):** `market_need`, `market_response`, `network_attention` (local), `network_audit_event` (local) — with the field minimum from contract 24 §3 plus the fields E-09/E-10 require (contact channel on response; decision record).
- **States:** need `draft → published → responses_received → owner_decision_recorded → closed` (+ `published|responses_received → cancelled`); response `draft → submitted → owner_reviewed → accepted_for_external_follow_up | rejected | withdrawn | expired` (define the `expired` trigger in this slice).
- **Screens:** `السوق/استكشف` (honest `empty`/`no_results`/`error`), `السوق/احتياجاتي` (drafts + published + responses + badge), Need draft with publish preview («ما سيُرى»), Response review with accept/reject/close, optional pointer «سجل ما حدث في مشروعي» that opens *existing* Manage recording flows with zero prefill.
- **Role simulator:** supplier persona submits/withdraws a response, labeled «بيئة اختبار محلية — ليست حسابات محمية».
- **Acceptance tests:** S-01…S-04, S-12, S-13; truth-table rows 1–2 (accept response ⇒ no cash/debt/COGS/inventory change); gate §4 guardian test (acceptance writes no Manage record); draft survives refresh *and* restore (per the storage decision); idempotent publish (same key ⇒ one need); permission negatives (supplier persona cannot see owner's other needs; no cross-workspace reads in simulator policy).

#### 4.5.4 What to defer, and why

- **All Delivery-scope building** if Market is the chosen wedge (or vice versa) — the docs mandate one slice; delivery cannot pass E-05/E-01/E-02/E-03 gaps without decisions first.
- **Moderation tooling/queue/backlog** — documented deferral to gate A; acceptable, but card the backlog risk (E-17) now.
- **Revenue model, payments, commissions** — correctly fenced (EX-O08); nothing to do until post-evidence.
- **Push notifications, external integrations, identity provider** — correctly deferred to A-01; keep in-app attention only.
- **Consent/retention policy content** — needs the legal review (OR-O04); but the *consent record entity* (E-13) should be specified now, cheaply, inside contract 24.
- **Abuse controls implementation** — defer building, but the rate-limit/audit-read *decision* must land before gate A (E-12), or Pilot runs exposed.

**Positive verification (expansion agent, for the record):** all five financial boundaries hold in *every* documented expansion flow — «قبولها أو رفضها أو انتهاءها لا ينشئ Purchase أو التزامًا أو كاشًا أو COGS أو حركة مخزون» (contract 20 §1); «لا تثبت `completed` أن العميل قبض…» (contract 21 §1); «لا تسجل مصروف نقل أو تسوية كاش» (21 §5); «لا يثبت دفعًا أو التزامًا محاسبيًا» (21 §5); fees/commissions banned from touching Manage (E-00.13 card §4); `missing ≠ zero` extended to network money («لا يستعمل Float في Domain ولا `0` بدل عدم المعرفة», contract 24 §4); the migration gate's guardian test (§4) requires a regression test proving acceptance of Response/Quote/Status changes nothing financial. **Zero violations found.**

---

## 5. Cross-cutting convergences

### 5.1 The reversal-blind read paths (strongest technical convergence)

Four findings from two agents, one root cause: **the write side of the correction system is exemplary, and the read side forgets reversals exist.**

- **A-01** (CRITICAL): after reversing a settlement, three surfaces compute three different "remaining payable" values (100.00 / 40.00 / hidden), and the commitment becomes unsettleable.
- **A-03** (HIGH): the settlement source picker offers the reversal record and the reversed payable as valid sources → negative payables, phantom cash-out.
- **A-02 / C-02** (HIGH): the purchase-receipt quota counts reversed receipts forever → paid goods can never be received.
- **C-01** (CRITICAL): G5 fixed expenses ignore reversals entirely → cancelled expenses still drive break-even; unallocated reversals double-count.

Prior review S-03 verified the reversal *functions* are a protected strength — and they are: full-reverse only, reason, idempotency, store-enforced. But every aggregation that *reads* events by type (`type === "payable_settlement_cash"`, `operatingExpenseDeltaMinor > 0`, `type === "purchase_receipt"`) treats the reversal event and the reversed original as if they were ordinary records. The system records corrections perfectly and then forgets them when computing what the owner sees. All four are read-path derivation defects — fixable without touching a single stored value.

### 5.2 The promise/behaviour gap on interruption (UX + language convergence)

**U-01** (browser/system back silently discards unsaved cost/agreement entry — verified live) and **L-06** (the guard's own drawer says «لن يُفقد عملك ما لم تختر الخروج») converge on the same defect from two directions: the app's *words* promise data safety that its *code* does not deliver, on the single most common interruption pattern of the target user (between customers, interrupted mid-task). Two agents independently flagged that no `beforeunload`/`pagehide`/`popstate` handler exists anywhere in `client/src`. This is the strongest honesty violation in the current product: not a wrong number, but a broken promise about the user's own data entry.

### 5.3 The G5 liquidity surface: weakest numerically AND linguistically (three-agent convergence)

- **Numerically:** C-01 (reversals ignored in fixed expenses), A-05 (draft/un-agreed orders counted as «دين عميل»), A-01's understatement inherited by `payables()` (undated commitments understated after corrections).
- **Linguistically:** L-01 (the entire feature is named «إعلان» — read as *advertisement*; the metric «بعد المعلن» is cryptic), plus L-05's textbook labels on the same screen.

Three agents reached the same screen from three directions. The one surface whose entire job is *the future* — projected cash, break-even, commitments — is simultaneously the least trustworthy in its numbers and the least readable in its words. Any fix that addresses only one dimension (rename the feature, or fix the arithmetic) leaves the other dimension undermining it. They should be fixed together, and the fix should precede any expansion work that builds on G5 semantics.

### 5.4 Honesty guarantees written in a register the audience cannot read (accounting + language + UX convergence)

Agent 2 verified the five financial boundaries **hold** in code — the honesty architecture is real. Agent 4 found that the sentences carrying those guarantees are written with English tokens («لا توجد COGS مؤهلة؛ Snapshot هو المصدر البديل المعلن»), raw UUIDs («الطلب order-0ae036b5… مستبعد لأن نتيجته estimated»), and recognition jargon («الإيراد المعترف به»). Agent 3 found even the domain's validation errors surface verbatim in English («note is required»). Convergence: **the honesty system is code-level excellent and communication-level broken for its exact audience** — a Jordanian shop owner with no accounting vocabulary. L-02/L-03/L-04/L-05/U-04 are one problem wearing five IDs.

### 5.5 Asymmetric correction paths (UX + accounting convergence)

Five record families have exemplary correction UX (effect preview, reason required, immutability explained, idempotent). Orders — the central record — have none in the UI (U-03: no cancel/price/deposit correction, though the domain and contract 02 support `cancelOrder`), and drafts cannot be removed at all while occupying the top Home attention slots (U-08). A-08 compounds it: even the domain forbids `draft → postponed`. The correction discipline the product teaches on events is silently unavailable where the owner most needs it — after agreeing a wrong price with a customer.

### 5.6 Duplicated financial meaning escaping the domain (code + accounting convergence)

C-03 (break-even re-implemented without guards in the application layer), C-05/Catalog preview and A-07 (page-level rounding duplication), C-06 (page importing storage) — the architecture rule "financial meaning lives only in `src/domain/`" holds in the large and leaks at the edges. Each leak is small; together they are the exact drift mechanism the layering rule exists to prevent, and none is caught by the current ESLint boundary guard, which bans only the storage adapters by name.

---

## 6. Statistics

**Unique findings: 64** (67 reported; 3 merged as duplicates across agents).

### By severity

| Severity | Count | IDs |
|---|---|---|
| CRITICAL | 2 | C-01, A-01 |
| HIGH | 20 | A-02(+C-02), A-03, U-01, U-02, U-03, L-01, L-02, L-03, L-04, L-05, L-06, E-01, E-02, E-03, E-04, E-05, E-06, E-09, E-10, E-11 |
| MEDIUM | 33 | C-03, A-04, A-05, A-06, A-07(+C-04, C-05), U-04, U-05, U-06, U-07, U-08, U-09, U-10, L-07, L-08, L-09, L-10, L-11, L-12, L-13, L-14, L-15, L-16, L-17, E-07, E-08, E-12, E-13, E-14, E-15, E-16, E-17, E-18, E-19 |
| LOW | 9 | C-06, A-08, A-09, A-10, U-11, L-18, L-19, E-20, E-21 |

### By agent (as reported / after merge)

| Agent | Reported | Standalone after merge | Merged into |
|---|---|---|---|
| 1 — Code (C) | 6 | 3 | C-02 → A-02; C-04, C-05 → A-07 |
| 2 — Accounting (A) | 10 | 10 (+3 absorbed) | — |
| 3 — UX (U) | 11 | 11 | — |
| 4 — Language (L) | 19 | 19 | — |
| 5 — Expansion (E) | 21 | 21 | — |

### Prior review

24 prior findings re-verified: 13 fixed, 2 partially fixed (D-02, P-01), 1 still open beyond the known set (D-04, plus X-02 by coordinator grep), 4 still open as known owner-decisions (X-01, X-03, X-04, X-06), 2 answered-in-docs (X-07, X-08), 1 partially answered (X-05), 2 open owner-decisions unchanged (G-01, G-03). All six protected strengths (S-01..S-06) intact.

### Confidence distribution (unique findings)

CONFIRMED: 58 · LIKELY: 5 (C-03, C-04, C-05 → A-07 carries CONFIRMED via execution, L-13, E-10, E-12) · NEEDS-CHECK: 0. Both CRITICAL findings are CONFIRMED by executed numeric reproducers and re-verified at source by the coordinator.
