# Micro — Full Financial Logic, UI/UX, Runtime, and Interaction Investigation
**Date:** 2026-09-25 (Asia/Amman) · **Commit audited:** `c02fb458b1c97d30f67ca7f5a82de82bbc77325d` · **Type:** READ-ONLY audit + design-repository report publication
**This is an investigation report for owner review. It is NOT an implementation approval, does not authorize any code change, and does not advance Pilot readiness.**

Artifacts in this package: `COMPREHENSIVE-FINANCIAL-LOGIC-UIUX-AUDIT.md` (this file) · `FINDINGS.tsv` (40-row canonical register) · `FINANCIAL-TRACE-MATRIX.tsv` (26 traces) · `ROUTE-FEATURE-COVERAGE.tsv` (75 rows) · `INTERACTION-REPRODUCTION-MATRIX.tsv` (22 rows) · `COMPONENT-BUTTON-INVENTORY.tsv` (73 rows) · `STRUCTURE-RECONCILIATION.tsv` (25 rows) · `EVIDENCE-MANIFEST.tsv` (36 sha256-verified files) · `AUDIT-CORRIGENDUM.md` · `evidence/`.
Previous evidence (immutable, linked, not modified): design repo branch `audit/micro-comprehensive-uiux-architecture-20260924` @ `159e3d57785cfb1e1c876f093593be4466d2d81b`.

---

## 1. Executive conclusion

The financial core of Micro is **sound**. All eleven unbreakable financial rules from `AGENTS.md` §6 were traced end-to-end through UI → application service → domain → storage → displayed result, and **every one passes in code**: receipt is not profit; deposits are cash but not profit; debt is a receivable, not cash; delivery does not auto-collect; inventory purchase is not COGS; owner money and loans never masquerade as sales or expenses; a missing cost stays `null`/unknown and blocks a final result instead of becoming zero; snapshots are frozen; `needs_review` is **domain-enforced** (seven guarded operations, sole documented exit `reverseDelivery` with mandatory reason, `reversesEventId`, and determinism); cancellation runs only through `cancelOrder` with reason and explicit deposit settlement; full prepayment + delivery settles. The write path is additionally safe at runtime: an invalid submission writes **nothing** (browser-proven by storage census diff), a 53.8ms double-click produces **exactly one** record, and reload-mid-submit is either committed or absent — never duplicated.

Where the product actually fails today is the **explanation and interaction layer sitting on top of a correct engine**, and the failures are small, cheap, and precisely located:

1. **FI-001 (F1)** — the statement's own equation line does not reconcile with its own result. With the synthetic probe (sale 12.75, known cost 5.50, expense 2.50) the page prints «إيراد معترف به 12.75 − تكلفة مباشرة 0.00 − مصروف موزّع 2.50» — operands that sum to 10.25 — directly above «نتيجة الفترة المسجلة 4.75». The direct-sale known cost is subtracted in the canonical result formula (`projectFinancialService.ts:811-820`) but never displayed as an operand. The owner cannot audit their own result from the page.
2. **FI-002 (F2)** — the period comparison displays **previous − current** while the service's own tests define delta as growth-oriented; a +4.75 improvement over an empty previous period renders as «الفرق -4.75» with no direction label.
3. **FI-003 (F3)** — the quick-expense sheet header says «مبلغ وبند اختياري» while the field it calls optional is required and blocks saving.
4. **FI-004 (F14)** — the unsaved-changes guard promises «لن يُحفظ شيء تلقائيًا» while draft-backed editors demonstrably autosave and the draft survives «اخرج دون حفظ» (browser-proven, twice).
5. **FI-005 (AUD-005)** — the three money-input sheets (repayment, received-loan repayment, material) discard typed money on **all thirteen** dismissal paths tried without asking a single question, while the quick-expense sheet asks exactly the right one.
6. **FI-006/FI-007** — the shared bottom-sheet wrapper does not trap keyboard focus (X-close drops focus to `<body>`), and a setup-draft race can silently delete a saved setup draft on reload.

Several owner-supplied Flash-walkthrough concerns did **not** reproduce as defects and are now closed with evidence: F4 (no premature writes; honest receipt), F11 (the «سجّل أول بيع» CTA genuinely navigates to the sale writer), F13 (delete confirmation fits at 390px and 320px), F15 (one editor session produces one draft, updated in place), F16 (both browser-back and in-app back are guarded, stay-first, Escape-safe).

Nothing in this report requires touching domain math, storage schema, tokens, components, routes, or architecture to fix the FIX_NOW items: five are one-line/one-string changes, two are single-component changes, one is a CSS rule. All remediation remains gated behind owner review and the repo's own change protocol.

## 2. Exact scope and credential mode

- **Micro repository:** read-only. One-time anonymous verification of `origin/main` (no credential used or needed for reading). No Micro write credential was authorized or employed. A pristine local clone (`work/micro-audit`, 0 dirty files, verified before and after every specialist pass) served as the static source; a second clone with `node_modules` (`work/micro-visual`) served exclusively for running focused tests, with `git status --porcelain | wc -l = 0` proven before and after each run.
- **Design repository:** the owner-supplied fine-grained PAT (delivered in the secure field/chat, never printed, echoed, stored in any committed file, or screenshot) was used **only** to create the new branch `audit/micro-full-financial-logic-uiux-20260925`, commit this report package, and push that branch. No PR was opened, merged, commented on, or closed (token lacks Pull-requests:Write — same class as both prior publications; if the push also fails, status becomes `PUBLICATION_PARTIAL`). No existing branch — including the previous audit branch — was modified. The token file was `chmod 600` outside all repositories and shredded after use.
- **Browser:** live deployment `https://micro-prototype.pages.dev` in fresh disposable Playwright Chromium profiles (two, one per browser specialist) with synthetic data only, prefix `UXFLASH-INVESTIGATION-20260925`. Network silence was proven **before** any data entry (§6). Profiles deleted after census backup (7.3MB and the S4 profile respectively).
- **Excluded:** Micro code/tests/Tracker/Documents/deployment/settings changes; PR operations; cleanup; force-anything; real data of any kind.

## 3. Baseline, build identity, and state-drift proof

```
Micro repository: https://github.com/Qays7753/Micro
Micro ref and full SHA: main = c02fb458b1c97d30f67ca7f5a82de82bbc77325d (2026-09-24 20:16:07 +0300)
Previous audit ref and full SHA: audit/micro-comprehensive-uiux-architecture-20260924 = 159e3d57785cfb1e1c876f093593be4466d2d81b (verified on remote, all artifacts intact)
Design repository ref and full SHA: main = 1c990544c5f45744187072076f4dc87877c9f3c4 (audit branch cut from this SHA)
Preview/live URL: https://micro-prototype.pages.dev
Build identity: live bundle embeds function dp(){return"c02fb458b1c97d30f67ca7f5a82de82bbc77325d"} — the deployed main chunk, all 98 lazy chunks (87/87 differing content-hashes resolve to identical content after cross-reference normalization), the CSS chunk (index-DeKn-51T.css) and react-runtime chunk are content-identical to a local production build of c02fb458; the only byte-level difference is the build-id injection (local fallback "micro-local-dev"). The live site IS commit c02fb458.
Browser and profile: Playwright Chromium 1.63 (chromium-1243), fresh disposable userDataDirs (ar locale, Asia/Amman, mobile emulation, DPR 2), deleted after census backup
Date/time/timezone: 2026-09-25, Asia/Amman (UTC+3)
State drift: NONE — Micro main matches the owner checkpoint and the previous audit baseline exactly; Operations Control validator EXIT 0 (64 items, 25 workstreams closed, 0 active claims, UX-001 IN_PROGRESS)
Micro writes performed: NONE
Design-repository report writes: branch audit/micro-full-financial-logic-uiux-20260925, commit <filled at publication — see Final status>
```

**Build-identity method (reproducible):** fetched live `index.html` → extracted asset names → downloaded all chunks → normalized `-[hash8].js` cross-references → byte-compared against the local `vite build` of `c02fb458`. CSS and react-runtime md5-identical; the 112-byte main-bundle delta decomposes to (a) the embedded commit-SHA function and (b) cascading minifier identifier renames triggered by it. No source difference exists.

## 4. Repositories and canonical files read

Recorded as actually read (full reads unless noted): **Micro governance** — `AGENTS.md` (complete), `docs/operations/current-state.md` (§3.1, §31-41, §62, §72-74 + header/merge records), `README.md`, `docs/operations/micro-thinking-charter-v1.md`, `docs/00-document-index.md`, `docs/implementation/03-pre-build-alignment-v1.md`, `docs/operations/control/generated/AGENT-BRIEF.md`, `ACTIVE-WORK.md`, `docs/operations/control/authority-map.md`, `.github/pull_request_template.md`, `docs/operations/control/validate.py` (logic read; read-only execution EXIT 0). **Architecture/contracts** — all five `docs/architecture/` authority files, relevant ADRs (UI/shell/tokens/dark-mode/navigation), `MIGRATION_STATUS.md`, `CHANGE_PROTOCOL.md`, `COMPONENT_CONTRACTS.md`, `SOURCE_OF_TRUTH.md`, `EXTENSION_PLAYBOOK.md`, `UI_AUX_ARCHITECTURE.md`, `apps/prototype-web/ARCHITECTURE.md`, `DARK_MODE_BOUNDARY` canonical path (theme files + boundary doc). **Financial** — `docs/contracts/05-financial-p0-policies.md` + related contracts (02, 03, 04, 05, 06, 08, 10, 11, 13, 14, 21, 27, 29, 31, 32, 34, 36, 38 as cited per trace), `docs/implementation/02-domain-contract-coverage.md`, `docs/product/financial-operating-model-v1.md`, `docs/scenarios/scenario-test-set-v1.md`, `docs/quality/scenario-coverage-matrix-v1.md`, `docs/contracts/04-limited-sync-contract.md`. **Code** — the shell/navigation/button/form/sheet/dialog/row/card/state component set, all 26 financial paths' page+service+domain+store sources (see FINANCIAL-TRACE-MATRIX for file:line citations), `MicroRouter.tsx`, `eslint.config.js`, `.github/workflows/ci.yml`, token bridge and theme files. **Previous evidence** — all 11 artifacts of the previous audit (COMPREHENSIVE-AUDIT.md, FINDINGS.tsv, VISUAL-FINDINGS.tsv, VISUAL-INTERACTION-REVIEW.md, HOME-DEEP-AUDIT.md, AUDIT-CORRIGENDUM-2026-09-25.md, ROUTE-COVERAGE.tsv, INTERACTIVE-COMPONENT-INVENTORY.tsv, TOKEN-CONSUMER-INVENTORY.tsv, STRUCTURE-SCAN.tsv, EVIDENCE-MANIFEST.tsv). **Design reference** — V2 handoff files as classified in the previous audit (approved-direction vs integration-spec vs historical), re-consulted only for the V2-comparison columns; no V2 content was copied toward Micro. The owner-supplied Flash walkthrough was available only through its F-item definitions embedded in the task brief (F12/F22/F5-F10/F17-F21/F23 definitions absent — see FI-040).

## 5. Specialist assignments and synthesis method

Five read-only specialists ran in parallel (Task IDs FI-1..FI-5), each with the shared briefing (baselines, write boundaries, evidence classes, invariant yardstick, prior findings), separate output directories, and a mandatory worklog section (merged into `/home/z/my-project/worklog.md`):

- **FI-1 Repository/structure/source-of-truth** — route census, layer map, oversized files, dependency direction, duplication species, token fan-out spot-verification, structural gate status, reconciliation against the previous STRUCTURE-SCAN (39 rows re-checked).
- **FI-2 Financial/domain/application/storage logic** — 26 end-to-end traces covering every high-risk path; the 11 invariants; F1/F2/F3/F4/F14/F15 code-side analysis.
- **FI-3 Browser runtime/visual/interaction** — live-app reproduction of the F-series and AUD-005 with the exact synthetic dataset; setup journey; populated states; viewport matrix; storage censuses before/after every probe; network silence proof. (Execution completed across 18 scripted runs + 164 screenshots; synthesis reconstructed from its evidence after a tooling deadline — provenance documented in FI-3-WORKLOG.md.)
- **FI-4 Accessibility/platform/performance/component semantics** — 73-row component-button inventory (static, file:line-cited) + runtime a11y/perf probes (focus, keyboard, scaling, reduced motion, touch targets, FOUT, cold/warm/route timing, duplicate-submit).
- **FI-5 Tests/CI/security/docs/Operations Control** — 313-file test census, renderSmoke exact lists, focused test runs (29/29 PASS), doc-pin drift analysis, ESLint boundary census, secret scans (source/dist/live bundle), validator run, finding-dedup mapping.

**Synthesis method:** every headline finding required **two independent mechanisms** (e.g., F1 = browser screenshot + census + first-hand source read of both the equation line and the result formula; F2 = rendered string + page wiring + service `lineOf` delta definition + service-test order convention). Browser observations were never promoted to code-cause claims without a source citation, and static observations were never promoted to user-facing failure claims without runtime evidence — where one half was missing, the evidence class was downgraded (all such items are labeled in FINDINGS.tsv). Contradictions between specialists were resolved by re-reading the primary source (e.g., the "12-14 vs 14 files" reverse-import counts reconciled to 12 files / 14 statements). The main agent re-verified F1 and F2 citations byte-level before publication.

## 6. Route and feature coverage

Full matrix in `ROUTE-FEATURE-COVERAGE.tsv` (75 rows). Summary:

| Coverage dimension | Count | Meaning |
|---|---|---|
| Registered route patterns (router) | 65 (+1 catch-all) | 60 pages render routes; 2 redirect-only; 4 pages serve 2 routes each; zero orphan pages, zero orphan routes |
| Statically inspected | 65/65 (100%) | source read by FI-1/FI-2 |
| renderSmoke-covered | 56/65 | 9 unsmoked: `/finance/recurring` ×4, `/finance/more`, `/finance/upcoming`, `/loans/received` ×2, `owner_withdrawal_cash` redirect (FI-015; recurring-family count corrected vs prior record) |
| Browser-opened (this investigation) | 29 registered patterns + 9 concrete dynamic instances | representative, not exhaustive — stated explicitly |
| Populated with synthetic data | 4 surfaces + 6 deep routes | first populated-state evidence in any audit wave (VIS-015 closed) |
| Interaction-tested | 22 reproduction items (F-series + AUD-005 + setup/estimate/NotFound) | INTERACTION-REPRODUCTION-MATRIX.tsv |
| Logic-traced to domain/storage | 26 financial paths | FINANCIAL-TRACE-MATRIX.tsv |
| Blocked / not executed | TalkBack/VoiceOver, Android Back, real swipe physics, real-device scaling, real spinner | DEVICE-001/UAT-001 gates preserved (FI-039) |

**Statement of honesty per the mission:** static coverage is complete (every route pattern's source was read); browser coverage is representative (the four surfaces, the highest-risk writers and readers, all F-item surfaces, and six deep routes were opened; not all 65 patterns were individually rendered in a browser this wave). No claim of "all screens tested" is made.

## 7. Financial logic traces and invariant results

The complete 26-trace matrix (user input → UI source → application service → domain function → storage write → computed output → explanation/receipt → contract reference → match/mismatch) is `FINANCIAL-TRACE-MATRIX.tsv`. Invariant verdicts:

| # | Invariant (AGENTS.md §6 / contract 05) | Verdict | Key evidence |
|---|---|---|---|
| 1 | Receipt ≠ profit | **PASS** | `direct-sale/policies.ts` profitMinor only when cost known; truth card «التحصيل ليس ربحًا»; statement separates cashIn from result |
| 2 | Deposit = cash collected, not profit | **PASS** | `collectDeposit` caps at order value; qualifier «قبض لدين أو متبقٍ — ليس إيرادًا»; retained deposit needs explicit classification event |
| 3 | Debt = receivable, not cash | **PASS** | partial collection → `partial_debt` + «دين على … يظهر في لي عند العملاء»; parties ledger signs documented |
| 4 | Delivery does not auto-record receipt | **PASS** | `transitionOrder` recognizes values at delivery only; collection is a separate guarded act |
| 5 | Inventory purchase ≠ full COGS at purchase | **PASS** | materials moving-average; period COGS only from evidenced consumption (`derivePeriodCogs`); «شراء مواد — ليس مصروفًا حتى الاستهلاك» |
| 6 | Owner draw / injection / loan ≠ sales/expenses | **PASS** | DELTA_TABLE owner/loan vectors touch cash + ownerCap/loan layers only; «مال المالك لا يدخل النتيجة» |
| 7 | Missing cost = unknown, never zero | **PASS** | costKnown=لا → `profitMinor null`, result `null` with reason «بيع مباشر بتكلفة غير معروفة»; displayed «غير متاح» + «لا يُعرض صفر مكان رقم لم يُدخل» |
| 8 | Snapshot frozen + quantity match | **PASS** | cost snapshot saved at value with inputs; `exact-values` battery re-run 6/6 PASS |
| 9 | needs_review blocks all ordinary state-changers | **PASS (domain-enforced)** | `assertNotLockedDeliveredReview` guards 7 ops; sole exit `reverseDelivery` (reason + reversesEventId + determinism + revenue/cost neutrality); `reviewLockBoundary.test.ts` 3/3 PASS re-run; one documented owner-approved gap (D-031 `reverseOrderCollection`) recorded as deferral, not defect |
| 10 | Cancellation only via cancelOrder with reason + deposit settlement | **PASS** | reason mandatory; deposit → refund/retain decision; retained classified explicitly; sale-cancel mirrors cash allocations with op key |
| 11 | Full prepay + delivery → settled | **PASS** | remainder zero → `settled`, review shown instead of collect action |

**Write-safety verdicts:** invalid submissions write nothing at any layer (page guards → service guards → domain-in-try → store-only-after); the only artifact is the declared non-financial form draft (contract 36), cleared on success. Idempotency is triple-layer (service reuse checks, domain `eventExists` per key+type, store `writeOneIdempotent` in-transaction). Runtime proofs: 53.8ms double-click → 1 record; reload-mid-submit → committed-or-absent; «الضغط مرتين لا يضاعف أثرًا» receipts.

**Where the UI displays a service-derived value vs inventing math:** no UI component re-derives money math. The statement explanation, finance period view, event-effect preview, and receipts all render service/domain outputs (explicit code comments confirm; preview reuses the domain function). The two display defects (FI-001/FI-002) are **omission and mislabeling inside service-derived display strings**, not parallel math — the engine's numbers are correct everywhere.

## 8. F1–F23 reproduction results

Reproduced on the live deployment with the synthetic dataset (sale 12.75 / cost 5.50 / cash 12.75 / expense 2.50 / estimate 2×3.25÷4). Full detail: `INTERACTION-REPRODUCTION-MATRIX.tsv` (22 rows), evidence under `evidence/browser-reproduction/`.

| Item | Reproduction status | Verdict & register ID |
|---|---|---|
| **F1** statement equation components | **REPRODUCED (defect)** | Equation line omits the direct-sale known cost: renders 12.75 − 0.00 − 2.50 while the same card shows net 4.75; `/finance?view=period` shows the 5.50 as a row but its formula sentence omits it too. **FI-001, FIX_NOW, NEW** |
| **F2** comparison value / period identity / −4.75 meaning | **REPRODUCED (defect)** | «الفرق -4.75» = previous(0) − current(4.75); service defines delta as B−A and its own tests treat + as growth; no direction label; period identity labels themselves are correct («الحالية 4.75 · السابقة 0.00»). **FI-002, FIX_NOW, NEW** |
| **F3** optional/required expense wording + validation | **REPRODUCED (defect)** | Header «مبلغ وبند اختياري» vs field marker «البند مطلوب» + blocking errors on empty note and zero amount; zero writes on all invalid attempts. **FI-003, FIX_NOW, NEW** |
| **F4** preview / error / success-receipt; record written after invalid submit? | **NOT_REPRODUCED (no defect)** | Invalid submit → blocking error, census diff = zero records; valid submit → success receipt with wallet attribution and «الضغط مرتين لا يضاعف أثرًا»; preview reuses the domain function. **FI-025 PRESERVE** |
| **F11** «سجّل أول بيع» action vs scroll | **NOT_REPRODUCED (no defect)** | Real navigation `/orders` → `/direct-sales/new?returnTo=%2Forders`; sale heading present; zero writes en route. **FI-026 PRESERVE** |
| **F13** delete-confirmation layout at 390px | **NOT_REPRODUCED (layout)** | Fits at 390 (content zone 324px) and 320 (254px), no overflow, no horizontal scroll. The *ink* defect (secondary instead of destructive) did reproduce → tracked as AUD-006 duplicate **FI-014**. |
| **F14** draft dialog wording vs local autosave | **REPRODUCED (defect)** | Guard says «لن يُحفظ شيء تلقائيًا…» yet the order draft materialized on first input and survived «اخرج دون حفظ»; direct-sale form draft («بيع متروك ٢» @9.00) also survived discard-exit with restore banner on reopen; post-materialization edits are not autosaved. **FI-004, FIX_NOW, DEEPENS** |
| **F15** one edit → one draft or multiple | **REPRODUCED (working as designed)** | Round-1 single input → 1 draft; re-edit same draft → still 1 (updatedAt unchanged); new session → 2; delete → 1. One draft per editor session, created on first real input, updated in place. **FI-028 PRESERVE** |
| **F16** browser back / in-app back / history guard | **REPRODUCED (working)** | Both paths guarded; 3-choice dialog, stay-first focused; Escape = stay; stay preserves typed 9.00; discard exits to /orders with data restorable via the autosaved draft (ties FI-004 wording). **FI-029 PRESERVE** |
| **AUD-005** three money sheets dismissal guards | **REPRODUCED (defect)** | 0/13 paths (X, outside click, Escape, swipe attempt, cancel) across RepaymentSheet / ReceivedLoanRepaymentSheet / MaterialSheet asked a discard question; repayments stayed `[]`, costSnapshots 0 — typed money silently lost. QuickActionSheet contrast asks «في رقم مكتوب — تسجّله أو تتجاهله؟». **FI-005, FIX_NOW, DUPLICATE(AUD-005) now runtime-proven** |
| Estimate flow (2×3.25÷4) | **REPRODUCED (pass)** | 2×3.25=6.50 planned, unit 1.63 (ceiling), knowledge «ناقصة», «أداة تفكير — لا حدث مالي», cost-estimates +1 only. **FI-030 PRESERVE** |
| Unknown routes | **REPRODUCED (pass)** | «مسار غير متاح» + safe return, deep `/finance/*` miss caught. |
| Setup journey | **REPRODUCED (pass)** | 3-step wizard honest; skip path zero financial writes; unknown opening → «غير محدد» not zero. (A setup-draft reload race found en route → **FI-007**.) |
| F5–F10, F12, F17–F21, F22, F23 | **DEFINITION_MISSING** | Not defined in the available Flash-walkthrough evidence; adjacent observations recorded under FI-037/FI-040 with the caveat. **FI-040 VERIFICATION_GAP** |

## 9. Buttons and interactive-component findings

The complete 73-row inventory (`COMPONENT-BUTTON-INVENTORY.tsv`) covers 8 Button action classes (393 uses / 95 files: secondary 177, save 125, quiet 40, create 30, destructive 12, commit 8, outline 1, ghost 0), chips/choice rows, quick tiles, sheets, forms, state behaviors, and floors, with file:line citations. Key findings:

- **All 13 icon-only buttons carry aria-label** (re-verified statically + runtime header transform) — PASS.
- **Dead/near-dead variants**: `ghost` 0 usages, `outline` 1 — recorded as hygiene debt (FI-011), folding into the AUD-013/022 token/CSS cleanup wave, owner-gated.
- **AUD-004 confirmed** (FI-013): suggest-chip `[aria-pressed=true]` is background/color-identical to its own `:hover` rule — selection is color-only, violating the component's own non-color-cue comment. CSS-only fix per the ChoiceRow contract.
- **AUD-006 confirmed** (FI-014): the permanent-delete confirm («احذف المسودة نهائيًا») wears secondary ink while irreversible; runtime-captured at 390 and 320.
- **W4/NAV-SAVE-CLASS tension re-confirmed** (FI-037, explicitly NOT AUD-012): Home's priority CTAs use `action="save"` ink for navigation targets. Standing owner decision, unchanged.
- **Loading idiom split** (FI-010): the Button `loading` prop (aria-busy + spinner + stable layout + detached onClick) exists but has only 3 real usages; most surfaces use text-only `role=status` loading. Honest, but inconsistent; defer to the D-11 loading-idiom decision.
- **Duplicate-press protection verified at runtime** (FI-025/FI-033): 53.8ms double-click → exactly one record; `saveInFlightRef` + service reuse checks + store idempotency triple-layer.
- **F22-adjacent quick tiles** (F22 undefined — caveat recorded): Home quick tiles are 3 fixed + secondary row; primary tile treatment confusion (VIS-005) remains an owner decision interacting with W4 (FI-037/FI-038 register rows).
- **Focus trap absence in the shared sheet wrapper** (FI-006, NEW FIX_NOW): 16 consecutive Tab presses from an open QuickActionSheet never entered the sheet (0/16); X-close drops focus to `<body>`; `role=dialog` present but no `aria-modal`; Escape-close restores focus correctly (inconsistency proves it is a wrapper gap, not a design choice).
- **Error association PASSES** on the probed form: `aria-invalid` + `aria-describedby` + `role=alert` with id linkage; invalid submit focuses nothing and writes nothing. Late validations on non-amount fields set formError without fieldError → aria-invalid missing there (FI-009, DEFER).

## 10. Visual composition, cards, color roles, borders, typography, and density

This wave adds **populated-state** evidence to the previous first-use-only visual record (all four surfaces captured at 320/360/390/412/430 + dark 360 with 12 synthetic records):

- **VIS-001 (seat-name duplication)** re-verified on populated Home: «مشروعي الآن» renders in header context + page overline + bottom-nav simultaneously. Standing FIX_NOW (AUD-009/VIS-001), owner decision on per-surface seat-name ownership.
- **VIS-003 (peach/border grammar)** unchanged: brand-soft carries ≥3 semantic roles (primary tile / decision panels / warning card); side-border has 4 parameter variants. Standing owner decision (AUD-014). No new roles observed in populated states.
- **VIS-004 (two h2 tiers on Work)** re-verified on populated captures (24px decision-surface h2 vs 18px sibling section h2). Standing record.
- **VIS-010/VIS-011 (Finance density + unknown honesty)** both re-verified populated: Finance remains the density outlier; unknown values render «غير مسجل»/«غير محدد» with honest road actions; computed sums render mono 0.00 with registered-period wording. No fake zeros anywhere.
- **VIS-008 (targets/overflow)** re-verified at 320 AND 412 across five surfaces: zero sub-44px interactive elements, zero horizontal overflow, header 61px + nav 71px identical geometry light vs dark.
- **Money rendering** (new populated evidence): all money values in `<bdi dir="ltr">` IBM Plex Mono; long Arabic + amounts + dates at 320–430 clean; no mirrored icons.
- **200% text scaling** (new, FI-008): bottom-nav labels clip (overflow 99px @320, 30px @390) — CSS-contained fix (allow wrap/shrink or drop min-width at large text). 125% remains clean (VIS-009 re-verified).
- **Dark mode**: geometry identical to light on populated captures; only real-theme toggle used (no forced class); dark regression risk unchanged from previous PASS.

## 11. Navigation, return paths, sheets, dialogs, and recovery

- **F16 guards verified working** (FI-029): browser Back and in-app back both trigger the 3-choice guard (stay-first, focused); Escape = stay; stay preserves typed data; discard exits with the autosaved draft restorable (wording contradiction → FI-004).
- **AUD-007 stands** (Foundation back affordance) — unchanged this wave (Foundation not re-probed in browser; static status unchanged).
- **Sheet dismissal safety**: QuickActionSheet asks the dirty-discard question (X + Escape both verified); the three money sheets ask nothing (FI-005/AUD-005, runtime-proven money loss). The shared drawer wrapper lacks focus trap/aria-modal (FI-006).
- **Dialog semantics**: confirmation panels order stay-first; destructive action present where expected (OrderDetail/QuickActionSheet/UnsavedChangesGuard) except DraftEditor delete (FI-014/AUD-006).
- **Recovery paths**: reload-mid-submit → committed-or-absent (idempotent single put); draft restore banners work in the two probed editors (DirectSaleEditor, DraftEditor) EXCEPT the setup draft race (FI-007: reload with saved setup draft silently deletes it — the only genuine data-loss bug found this wave, and it is non-financial).
- **Return-context**: Finance honors returnTo («مشروعي الآن» back); 53/60 pages honor it (static); F11's `returnTo=%2Forders` honored on the writer.

## 12. RTL, Arabic, phone widths, accessibility, Android/iOS adaptation, and performance

- **RTL/bidi**: money isolated in `bdi dir=ltr` + Plex Mono (4/4 surfaces populated); no overflow or mirroring issues at any tested width; Arabic-first layout intact.
- **Phone widths**: 320/360/390/412/430 all clean (zero horizontal overflow, zero sub-44px targets) — except the 200%-scaling nav-label clip (FI-008, simulated; real-device scaling NOT_EXECUTED).
- **Keyboard/focus**: visible focus ring (2px, offset 2) PASS; logical tab order on Home + forms; logo-menu full keyboard pattern (Enter/ArrowUp/Down cycle, Enter activates, Esc closes) PASS; **sheet focus trap FAIL** (FI-006).
- **Screen readers (proxy evidence)**: exactly one `aria-current=page` per surface; icon buttons labeled; error association wired. TalkBack/VoiceOver NOT_EXECUTED (gate preserved).
- **Reduced motion**: `prefers-reduced-motion: reduce` collapses all transitions/animations to ~0s at runtime — fully honored.
- **Safe areas / keyboard**: `env(safe-area-inset-*)` used in header/main/nav (viewport-fit=cover); a real `visualViewport` mechanism hides header+nav when the viewport shrinks >120px (keyboard-open simulation works; real keyboard NOT_EXECUTED).
- **Performance (live, phone-class emulation)**: cold FP 116ms / FCP 220-232ms / usable ~1.5-2.1s (splash ~1.85s); warm FCP 108ms with transferSize 0 (SW); route change ~440ms with honest `role=status` loading text; main JS 649,740B → 153,744B gzip (within the pinned 650k/155k budget); CSS 168,692B → 24,213B gzip. **FOUT not observed** (Alexandria VF loads ~281ms, before visible text) → AUD-011 reclassified DEFER (C-04/FI-034).
- **Android/iOS adaptation**: Android Back, iOS dismissal physics, TalkBack/VoiceOver, real swipe-dismiss — NOT_EXECUTED (no device); static evidence: history-guard registration exists; vaul swipe physics not genuinely synthesizable in headless touch (synthetic attempts either no-op or full-close — recorded honestly).

## 13. Structure/Architecture/Code Organization reconciliation

Full reconciliation in `STRUCTURE-RECONCILIATION.tsv` (25 rows) against the previous 39-row scan. Headlines:

- **Route registry healthy**: 66 `<Route>` elements = 65 path-bearing + catch-all; zero orphan pages/routes; 4 create routes behind CapabilityCreateGate. **No structural remediation is authorized by this audit** — the Group 8-11 gate plan is exhausted; every structural item requires a fresh owner decision.
- **NEW (FI-016, FIX_NOW)**: diagnostics `ROUTE_TEMPLATES` frozen at 2026-09-11 — lags the router by 10 routes (the 9 renderSmoke gaps **plus `/market`**); crashes on those routes attribute as `/unknown`; `SOURCE_OF_TRUTH.md:38` claims a sync that no test enforces.
- **Root cause found (FI-019/FI-024)**: the application⇄presentation reverse imports (12 files / 14 statements, 5 production) trace to the pure leaf helper `englishNumeric` housed in `application/` — a one-file move plus ESLint globs + declared direction closes AUD-012's mechanical half.
- **Domain purity intact**: zero domain→client imports; 0 runtime cycles across 258 files (2 documented type-only cycles).
- **Duplication census sharpened**: empty-state family = 5 species (2 documented); row family = 4 species; Field primitive 0 production consumers vs 495 inline `.micro-field` usages across 75 files; index.css 6,837 lines with the dual `.micro-field-error` definitions (1052 + 4219) intact — AUD-015/016 DEEPENS, owner-gated.
- **NEW latent (FI-022, PRESERVE+register)**: circular token alias `--color-border: var(--border)` (index.css:38) vs `:root` redefinition (:69) — no visual effect today; register in the token inventory.
- **Docs counters (FI-017, DEEPENS AUD-003)**: ARCHITECTURE.md 13→18 domain modules, 32→37 stores, 44→53 services; AGENTS.md 36/28 vs 38/30; current-state 4 waves stale + §31-40 still claim PR #159 open while it merged 241 commits ago; CHANGELOG missing 11 merged waves.

## 14. Test, CI, documentation, and Operations Control mapping

- **Test census**: 313 test files (dom 81 / ui 12 / characterization 6 / surfaceAudit 2 / docs-pin 5 / contract 1 / unit-other 206). 11 page components have zero direct test imports (10 of 11 renderSmoke-covered; ReceivedLoanDetail doubly uncovered).
- **Focused runs (all PASS, 29/29, disposable clone, 0 tracked changes before/after)**: renderSmoke 3/3 · reviewLockBoundary 3/3 · exact-values.cross-surface 6/6 · group6Docs 8/8 · QuickActionSheet.guard 5/5 · U09.css 4/4.
- **Doc-pin tests freeze stale history** (FI-017): they pin code 38/30 AND simultaneously pin current-state's «٣٥/٢٧» claim; they pin «PR #159 مفتوح وغير مدموج» although `c0469e2` is an ancestor of main. The re-baseline must land as one docs+tests wave per CHANGE_PROTOCOL.
- **AUD-010 still open** (FI-020): OD-02 partial tone only swept via `isPermissibleTone`, never directly asserted.
- **CI**: single full-chain job (`checks`) on push/PR/tag — `operations-control:test` → check chain → vitest → lint; audit-retry ×3; artifact upload. RETRACTED-R2 upheld (od -c proof of `branches: [main]`).
- **Security**: zero secrets in source, local dist, and the live bundle; diagnostics local-only (25 entries / 48kB cap, 8 fields, zero network calls in production code); network silence at runtime (2,953 requests, 100% GET, 0 data-bearing, 0 synthetic leaks).
- **Operations Control**: validator EXIT 0 — 64 items (37 VERIFIED / 20 DEFERRED / 3 BLOCKED / 1 IN_PROGRESS / 2 BACKLOG / 1 REVIEW_REQUIRED), 25 workstreams closed, **0 active claims**, UX-001 IN_PROGRESS (stage 5, FIX_BEFORE_PILOT), WS-182/183 VERIFIED on main, Pilot gated behind `releases/pre-pilot.json`.
- **Finding-dedup mapping**: every register row carries its prior-ID relation. Net new-vs-existing: 14 NEW (FI-001/002/003/006/007/008/009/010/011/012/016/022 + positive results FI-024..033 class), 9 DUPLICATE (standing findings re-proven), 5 DEEPENS_EXISTING, 0 REOPENED, 0 FALSE_POSITIVE this wave (two prior retractions upheld), 1 VERIFICATION_GAP (F-definitions missing, FI-040).

## 15. Complete finding register

`FINDINGS.tsv` — 40 rows, no omitted items: FI-001..FI-040 with category, source reports, evidence class, reproduction status, affected surface, user impact, financial/data/security impact, classification (FIX_NOW ×13, PRESERVE ×11, DEFER ×9, OUT_OF_SCOPE ×2, plus reclassifications), owner-decision flag, minimum safe next step, dependencies, acceptance criteria, rollback boundary, and prior-ID relation. Positive verification results (the sound core, write safety, security silence, performance, platform passes) are registered as PRESERVE rows so that "what is correct" is as traceable as "what is broken".

## 16. What is verified, inferred, unverified, not executed, deferred, preserved, and retracted

- **VERIFIED (both mechanisms)**: FI-001, FI-002, FI-003, FI-004, FI-005, FI-006, FI-007, FI-013, FI-014, FI-015, FI-016, FI-017, FI-018, FI-019, FI-020, FI-021, FI-022, and all PRESERVE rows FI-024..FI-034.
- **VERIFIED (static-only, clearly labeled)**: FI-008 (runtime-simulated scaling, real device NOT_EXECUTED), FI-009, FI-010, FI-011, FI-012, FI-023, FI-037, FI-038.
- **INFERRED**: received-loan editor route label (concrete `/loans/received/{id}` instance reached via UI; pattern label inferred — noted in ROUTE-VISITED provenance); S3's multi-execution overwrite notes on two late scripts (marked INFERRED in FI-3-WORKLOG.md).
- **UNVERIFIED**: none promoted as findings.
- **NOT_EXECUTED**: TalkBack/VoiceOver; Android Back; real swipe physics; real-device font scaling; real spinner state; external users (FI-039; DEVICE-001/UAT-001 gates preserved).
- **DEFERRED (owner-gated)**: FI-008 fix pending device verification is still CSS-safe now; FI-009; FI-010; FI-011; FI-012; FI-022 (register); FI-023; FI-034 (AUD-011 reclass); FI-037 (W4); FI-038 (standing AUD register).
- **PRESERVED**: the financial core (FI-024), write safety (FI-025), F4/F11/F13/F15/F16 positive verdicts, estimate honesty, security/local-first, platform passes, performance.
- **RETRACTED this wave**: none. Both prior retractions (RETRACTED-R1 EstimateDetail syntax error; RETRACTED-R2 ci.yml corruption) were independently upheld with `od -c`/md5 proof. Two measurement-artifact classes were caught BEFORE publication this wave (8/8 harness pageerrors; content-visibility text reads) and are documented as audit-integrity notes (FI-035, C-07) rather than product findings.

## 17. Minimum safe remediation waves, dependencies, risks, acceptance criteria, and rollback boundaries

Ordered by safety (cheapest + most isolated first). Nothing below is authorized by this report — each wave needs its own owner approval, ops-control claim, and CHANGE_PROTOCOL pass.

**Wave A — explanation-layer truth (5 changes, all display-only, no domain/storage touch):**
FI-003 (one string in QuickActionSheet header) · FI-001 (one equation line in Statement.tsx, optionally plus the period-view formula sentence) · FI-002 (one call-order swap OR one direction label — owner picks the shape) · FI-004 (guard wording scoping) · FI-012 (setup-complete account label).
Dependencies: none. Risks: wording regressions pinned by existing fixture tests. Acceptance: displayed operands reconcile to displayed result (fixture with known-cost direct sale); comparison renders growth-positive semantics; guard text never claims zero autosave on draft-backed forms; header matches validation. Rollback: single-line/string reverts per item.

**Wave B — interaction safety (3 changes, single-component each):**
FI-005 (reuse QuickActionSheet isDirty discard pattern in the 3 money sheets — the standing AUD-005 remediation, now with runtime proof) · FI-006 (focus trap + aria-modal + onCloseAutoFocus in the shared drawer wrapper) · FI-007 (setup-draft discard gated on readSettled).
Dependencies: FI-005 benefits from its own ops-control claim; FI-006 touches one shared component consumed by 4+ sheets (regression surface = all sheet consumers). Acceptance: dismissal-with-dirty-input asks in all three sheets; tab cycles inside open sheet; focus returns to trigger on every close path; reload-with-setup-draft restores the banner. Rollback: per-component TSX reverts.

**Wave C — test/doc truth (one combined wave per CHANGE_PROTOCOL):**
FI-015 (add 9 renderSmoke patterns + fix "(55)" comment) · FI-016 (regenerate ROUTE_TEMPLATES + drift test) · FI-017 (docs re-baseline: AGENTS/ARCHITECTURE/current-state/CHANGELOG + doc-pin re-baseline in the same PR) · FI-020 (one-line OD-02 assertion).
Dependencies: FI-015 and FI-016 share the router-lag family — do together. Risks: doc-pin re-baseline is the only step that touches guarded tests; must assert current truth, not delete guards. Rollback: docs/test commits revert.

**Wave D — CSS/lint hygiene (owner-gated family waves, standing AUD-012/013/016/022):**
FI-019 (englishNumeric leaf move + ESLint globs + direction declaration) · FI-008 (nav-label wrap at large text) · FI-018 (dual .micro-field-error consolidation with computed-style guard) · FI-011 (dead variant pruning inside the token cleanup wave).
Risks: CSS-only visual deltas guarded by snapshot/computed-style tests. Rollback: CSS/config commits.

**Not scheduled (owner decisions, not defects):** FI-022 (register only), FI-023, FI-037 (W4), FI-038 standing register, FI-040 (awaiting Flash definitions).

## 18. Owner decisions required (excluding decisions already recorded)

1. **FI-002 fix shape**: swap the page's argument order to match the service's growth convention, or keep the order and add an explicit direction label («تحسّن/تراجع»)? (Both safe; the decision is presentational.)
2. **FI-001 scope**: add the missing operand to the equation line only, or also surface group-4 components (depreciation/write-off/disposal/retained deposit) in the sentence when nonzero (they currently live in the separate deep-finance block)?
3. **Wave sequencing approval** (A→B→C→D or a different order), and whether FI-005/FI-006 land as one "sheet safety" claim.
4. **FI-008 timing**: fix now on simulation evidence, or wait for a real-device font-scaling session (DEVICE-001)?
5. **Optional supply**: the Flash-walkthrough definitions for F5–F10/F12/F17–F21/F22/F23 so FI-040 can be resolved against existing or new IDs.

## 19. What must not change

- The domain core, its invariants, and every `policies.ts` computation — all 11 verified passing.
- Storage schema, `localSchemaVersion`/`localExportVersion` guards, idempotency keys, and the LocalStore port.
- The approved V2 direction remains **visual direction only**; no V2 Studio JSX/CSS/fixtures/money wording may be copied into Micro; no second token namespace or design-system source.
- Existing working component contracts and baseline behavior unless a verified defect (this register) proves otherwise.
- Financial wording semantics: any fix to FI-001/FI-002/FI-003/FI-004 must not change what a number **means** — only what the page **shows** about it.
- The needs_review lock, reverseDelivery as sole documented exit, cancelOrder semantics, and the review-lock test suite.
- Dark mode as shipped (this wave only regression-verified it; no redesign).
- The recorded owner decisions (AUD-001 reading order, D-02/D-08/D-11/D-12, OD-10, W4 pending, D-031) — not reopened by this audit.
- Pilot gates: DEVICE-001, UAT-001, `releases/pre-pilot.json` — untouched.

## 20. What this audit does not prove

- It does not prove the product is Pilot-ready or usable by external users — the owner is the only operator tested (via automated probes), no external users were involved, and Pilot readiness is not asserted.
- It does not prove real-device behavior: TalkBack/VoiceOver, Android Back, iOS sheet physics, real swipe-dismiss, system font scaling, and physical keyboards remain unexecuted.
- It does not prove absence of defects on the 36 route patterns not opened in a browser this wave (their sources were read statically; renderSmoke covers 56/65).
- It does not prove correctness of any number merely because it looked plausible — every financial verdict required a full trace to domain source plus, where browser-reproduced, a storage-census diff.
- It does not verify the F-items whose definitions were not supplied (F5–F10, F12, F17–F21, F22, F23).
- It does not audit the expansion domains (Market/Delivery/Supplier/Courier/Admin portals) beyond the routes incidentally opened.
- Performance numbers are from one emulated environment; they bound, not guarantee, real-phone behavior.

## 21. Exact writes performed and explicitly not performed

**Performed:**
- Design repository ONLY: new branch `audit/micro-full-financial-logic-uiux-20260925` (from main `1c990544`), one commit adding this report package (10 files + 36 evidence files), pushed via the owner-supplied fine-grained PAT used solely for this branch/commit/push. Exact commit SHA recorded in §22.
- Local workspace (outside all repositories): specialist outputs, evidence captures, censuses, scripts, and this package under `/home/z/my-project/work/full-investigation-20260925/`; a copy under `/home/z/my-project/download/` for owner retrieval; the shared worklog `worklog.md` appended.
- Disposable browser profiles (2): synthetic data writes ONLY (prefix `UXFLASH-INVESTIGATION-20260925`; final synthetic census: 12 records across 11 stores — setup profile, owner profile, 1 wallet, 1 direct sale, 3 financial events [expense 2.50, loan_out 20.00, loan_received 10.00], 2 cash-continuity entries, 1 loan, 1 received loan, 1 order draft, 1 form draft, 1 cost estimate). Classification: **DISPOSABLE_LOCAL_ONLY** — no real data, no server-side persistence (network silence proven: 2,953 requests, 100% GET, 0 data-bearing), both profiles deleted after census backup. One synthetic draft deleted via the app's own delete UI as part of the F13 probe.
- Focused test runs in the disposable clone (29/29 PASS, zero tracked-file changes, proven before/after).

**Explicitly NOT performed:** no Micro edit/commit/push/branch/merge/delete/cleanup (Micro clones verified 0-dirty; origin/main unchanged at `c02fb458`); no Tracker/Documents/current-state/todo changes; no source-design-repo content changes; no PR opened/merged/commented/closed; no token printing/storage in committed artifacts (shredded after use); no real personal/financial data; no PIN/security/settings changes (dark-mode appearance toggle only, in a disposable profile); no export/import of real data; no structural remediation; no test modifications; no deployment changes.

## 22. Final status

```
COMPREHENSIVE_AUDIT_COMPLETE — OWNER_REVIEW_REQUIRED
REPORT_PACKAGE_PUBLISHED — Qays7753/Micro-Bold-Modular-Design-Handoff-V1/audit/micro-full-financial-logic-uiux-20260925 (branch head full SHA recorded in the investigation session's final status line; a commit cannot embed its own hash — the package content commit is verifiable via git log of this branch)
NO_MICRO_WRITES_PERFORMED
NO_MICRO_CODE_OR_TEST_CHANGES_PERFORMED
NO_TRACKER_WRITES_PERFORMED
NO_DOCUMENTS_WRITES_PERFORMED
NO_SOURCE_DESIGN_WRITES_PERFORMED
NO_MERGE_PERFORMED
NO_CLEANUP_PERFORMED
PILOT_READINESS_NOT_ASSERTED
```

(The full SHA is filled at publication; if publication is blocked, the status block becomes `COMPREHENSIVE_AUDIT_COMPLETE — PUBLICATION_PARTIAL — <exact reason>` with the same NO-write lines. The branch was pre-verified non-existent on the remote before cutting, so no branch collision path applies.)
