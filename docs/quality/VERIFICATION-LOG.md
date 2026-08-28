# Remediation Verification Log — Agent 1 (Verifier)

- **Date:** 29 August 2026
- **Verified commit:** `remediation/full-2026` branch head == `main @ 8ee0832bcbf142c586474a900c476bbc07d48986` (no fixes applied yet at verification time)
- **Inputs:** `docs/quality/MICRO-REVIEW-FINDINGS.md` (64 findings), `docs/quality/MICRO-REMEDIATION-PLAN.md`
- **Baseline re-confirmed before verification:** `pnpm install --frozen-lockfile` OK; `pnpm check` exit 0 (typecheck clean, lint 0 errors / 48 warnings, root suite 10 files / 87 tests, prototype suite 49 files / 264 tests, build succeeds)

## Method

- **Code and accounting findings (C-01, C-03, C-06, A-01–A-10):** reproduced by executing assertion-correct test harnesses against the real domain functions and application services (`MemoryLocalStore` + real services) via the repository's own vitest. Every reproducer asserted the **correct** behaviour and **failed** on the unfixed tree — each failure is the finding confirmed. Source locations were re-read at the cited lines.
- **UX findings (U-01–U-11):** every code anchor cited in the finding was re-verified today (grep/read at the exact file:line). The interactive behaviours (tap counts, drawer behaviour, silent loss, banner persistence) were verified live on `https://micro-prototype.pages.dev/` during the review against this same commit; `main` has not moved since and the deployment is built from `main`.
- **Language findings (L-01–L-19):** the exact strings were located at the cited file:line today (counts re-measured).
- **Expansion findings (E-01–E-21):** both cited locations of every contradiction were opened today and the disagreement confirmed; absence claims (timeout state, dictionary entities) confirmed by grep returning zero matches.

## Verdicts

| ID | Verdict | Evidence |
|---|---|---|
| C-01 | CONFIRMED | Executed reproducer: expense 1000 minor recorded then reversed in-period → `readDecision` keeps `fixedExpenseMinor: 1000`, margin and break-even identical pre/post reversal (test failed as expected). Filter at `g5Service.ts:176-183` re-read: `operatingExpenseDeltaMinor > 0` admits the reversed original, excludes the negative-delta reversal; unallocated reversals copy the share context and double-count. |
| C-03 | CONFIRMED | `projectFinancialService.ts:601-604` re-read: `Math.ceil((fixedExpenseMinor * finalDeliveredQuantity) / directMarginMinor)` — unguarded float re-implementation; domain `calculateBreakEven` (`g5/policies.ts:440-477`) carries the `MAX_SAFE_INTEGER` guards + invalid-status honesty the copy drops. |
| C-06 | CONFIRMED | `Settings.tsx:15` imports `requestPersistentStorage`-family from `@/storage/local/persistentStorage` (runtime import in a page); lint boundary rule bans only the two adapter names. |
| A-01 | CONFIRMED | Executed reproducer (payable 10,000 → settle 6,000 → reverse settlement): re-settling the true remaining 10,000 rejected; `listLinkOptions` shows 4,000; both test assertions failed as expected. `record()` paid-reduction at `projectFinancialService.ts:827-830` counts the reversal event as a second settlement; editor `payableOptions` (`FinancialEventEditor.tsx:107-124`) same computation → remaining −2,000 → commitment filtered out. |
| A-02 | CONFIRMED | Executed reproducer: purchase 10,000 → receive 10,000 → reverse receipt → re-receive 10,000 returns `validation_error` «قيمة الاستلام تتجاوز إجمالي شراء المواد المرجعي» (test failed as expected). Quota filter at `inventoryMaterialService.ts:296-304` counts reversed receipts; in-file convention (`readOrderActualMaterialComparison:147-156`) shows the correct reversal-aware pattern. |
| A-03 | CONFIRMED | Executed reproducer: reverse a payable → "settle" the reversal record for 10,000 is accepted; net totals `{cash: −10,000, payable: −10,000}` (expected reject + `{0, 0}`; test failed as expected). Source validation at `projectFinancialService.ts:824-826` checks only `type !== "operating_expense_payable"`. |
| A-04 | CONFIRMED | Executed: `1.005 × 100` → 100 (contract 05 §5.3 half-up: 101); `0.29 × 50` → 14 (hand: 15). Both reproducer assertions failed as expected. `Math.round` float products at `craft-order/policies.ts:134,147`. |
| A-05 | CONFIRMED | Executed: draft order (سارة, 30.00, never agreed) → `shortCash.undatedReceivablesMinor: 3000` (expected 0; test failed as expected). Filter at `g5Service.ts:203-213` uses `receivableMinor > 0` only. |
| A-06 | CONFIRMED | Executed: consuming 400 of a 500-milli/1-minor remainder throws «لا يمكن توزيع قيمة المادة المتاحة بهذه الكمية» (expected allowed; test failed as expected). Guard at `inventory-material/policies.ts:132-140`. |
| A-07 | CONFIRMED | All cited sites re-read: `craft-order/policies.ts:134,147` (Math.round), `owner-entitlement/policies.ts:520,586,618,662` (Math.floor / hand-rolled half-up), `Catalog.tsx:158` (page-level `Math.floor((rawMinor+500)/1000)`). ESLint config re-read: no rounding guard exists. One additional non-money `Math.round` found at `owner-entitlement/policies.ts:108` (calendar day-span; exact UTC-midnight arithmetic — must be handled by the guard design, recorded in the A-07 commit). |
| A-08 | CONFIRMED | Executed: `transitionOrder(draft → postponed)` throws `invalid transition: draft -> postponed` (expected allowed; test failed as expected). `ALLOWED_TRANSITIONS.draft = ["provisional_agreement", "needs_review"]`. |
| A-09 | CONFIRMED | Executed: priceDate `2026-05-10` + createdAt `2026-05-10T01:30Z` (04:30 Amman, same day) + freshnessDays 0 → `stale` (expected `known`; test failed as expected). Comparison at `craft-order/policies.ts:102-107`. |
| A-10 | CONFIRMED | Executed: `transfer_out` entry with `cashDeltaMinor: +30` (i.e. a negative-amount transfer reversing direction) is accepted by `createCashContinuityEntry` (expected throw; test failed as expected). Guard requires only non-zero integer (`cash-continuity/policies.ts:44-45`); service passes `−input.amountMinor` through (`cashContinuityService.ts:197`). |
| U-01 | CONFIRMED | `rg "popstate\|beforeunload\|pagehide"` over `client/src` → **0 matches** today; `UnsavedChangesGuard` intercepts only `requestNavigation` (BottomNav/editor back buttons via `MicroAppShell.tsx:59`). Live loss of unsaved CostEditor/AgreementEditor input on browser back verified during review at this commit. |
| U-02 | CONFIRMED | `FinancialEventEditor.tsx:100` — `idempotencyKey = useRef(...)` (one key per mount); `:207` — reused branch shows «هذا الحدث محفوظ سابقًا؛ لم نكرر أثره.» styled as a save note; no navigation away after success. Live 5.00→8.00 sequence verified during review. |
| U-03 | CONFIRMED | `rg cancelOrder apps/prototype-web/client/src` → **0 callers**; domain exports it (`craft-order/index.ts:4`) with deposit-settlement handling; OrderDetail exposes only start/ready/deliver/collect/debt. |
| U-04 | CONFIRMED | English throw family re-read: `financial-event/policies.ts:13` `` `${field} is required` ``, same `assertNonBlank` in supplier-purchase, owner-entitlement, cash-continuity, shared/numeric, plus `must be a positive integer` variants; `projectFinancialService` passes `error.message` through. |
| U-05 | CONFIRMED | `Finance.tsx:124-129` re-read: inverted/invalid month range sets whole-page `error` phase rendering the full-screen error card (only escape navigates Home). |
| U-06 | CONFIRMED | `MicroAppShell.tsx:32-45` re-read: both `order` and `estimate` branches call `requestNavigation("/orders/new")` with no intent parameter; NewDraft re-asks. |
| U-07 | CONFIRMED | `QuickActionSheet.tsx` re-read: exactly 3 actions (طلب مخصص / مسودة تصميم / عربون أو تحصيل), all order-family; no expense/purchase/material entry. |
| U-08 | CONFIRMED | `draftService.ts` re-read: create/save only — no delete/archive/dismiss (grep: 0 matches); draft attention priority 10 above debt 15 (`homeControlCenterService.ts:153-167`). |
| U-09 | CONFIRMED | `index.css:4788-4792` — `.micro-period-range-fields input` has no min-height (measured 35px live during review); `.micro-text-action` (`:499-504`) has `min-height: 44px` but `width: fit-content` with no min-width («إضافة وقت» measured 33px wide at 360). |
| U-10 | CONFIRMED | `PwaInstallControl.tsx:14` — `isDismissed` is `useState` only; no persistence (grep localStorage: 0 matches in file). |
| U-11 | CONFIRMED | `Settings.tsx:557-592` — `StorageRow` renders an icon-only `micro-icon-button` (aria-label, no visible text) inside the collapsed data `<details>` (line 211). |
| L-01 | CONFIRMED | «إعلان» family counts re-measured today: g5Service 13, G5DeclarationEditor 9, Finance 5 occurrences; «بعد المعلن» at `Finance.tsx:615`. |
| L-02 | CONFIRMED | COGS/Snapshot truth-lines re-read at `Finance.tsx:103-106` («لا توجد COGS مؤهلة؛ Snapshot هو المصدر البديل المعلن»); `basis points` + G3 at `OwnerEntitlement.tsx:725`; final/yield/immutable/JSON/Store/milli/Prototype/G5/O1/route-name leaks located at the cited lines. |
| L-03 | CONFIRMED | `g5/policies.ts:193,196,215,218` builds user sentences with `${order.id}` + raw `resultStatus`; `Finance.tsx:749,753` prints `correctionOfEventId`/`reversal.id`; OwnerEntitlement UUID fragments located. |
| L-04 | CONFIRMED | «الإيراد المعترف به (د.أ)» located at `OrderDetail.tsx:307-310`; `Review.tsx:85,92`; `recurringWorkService.ts:527`. |
| L-05 | CONFIRMED | «صافي الربح التشغيلي المسجل للفترة» (`Finance.tsx:260`), «هامش المساهمة» (:932), «نقطة التعادل المفككة من المزيج المسجل» (:973), «التكلفة المتغيرة» (:951), «الثابت المسجل» (:955), «لا وعد بتدفق نقدي» (:593), «محمل/غير محمل» (:331-346) all located. |
| L-06 | CONFIRMED | Drawer sentence at `UnsavedChangesGuard.tsx:117`: «…لن يُفقد عملك ما لم تختر الخروج.» with zero `beforeunload`/`pagehide` handlers in the codebase (see U-01). |
| L-07 | CONFIRMED | «تحميل/محمل» counts: Catalog 15, Finance 6, FinancialEventEditor 1 + service-side occurrences located. |
| L-08 | CONFIRMED | «استحقاق» counts: OwnerEntitlement 38, Finance 7 (card labels say «حق المالك» — the split confirmed). |
| L-09 | CONFIRMED | «ذمة/ذمم» located at `homeControlCenterService.ts:128,229`, `ActualTimePanel.tsx:215`, `g5Service.ts:461`. |
| L-10 | CONFIRMED | «الفعل التالي» counts: Orders 3, OrderDetail 2, Finance 3; DecisionPanel uses «الخطوة التالية». |
| L-11 | CONFIRMED | «درجة المعرفة» at `CostEditor.tsx:474,689`, `FinancialEventEditor.tsx:475`, `G5DeclarationEditor.tsx:163`, `OrderDetail.tsx:286`. |
| L-12 | CONFIRMED | «عكس» family counts: Finance 15, CashWallets 2, plus reversal editors/ActualTime/OwnerEntitlement/g5Service occurrences at the cited lines. |
| L-13 | CONFIRMED | «خليفة/السلسلة» count: OwnerEntitlement 18 occurrences at the cited lines. |
| L-14 | CONFIRMED | «مركز قيادة المشروع» (`Home.tsx:68`, `homeControlCenterService.ts:84`), «مشروعي اليوم» (`Home.tsx:89`), nav «مشروعي الآن», «السعة غير حكم رفض تلقائي» (`homeControlCenterService.ts:278`) all located. |
| L-15 | CONFIRMED | `<time>{todayLocal}</time>` (`Home.tsx:93`) renders raw ISO; `حتى 2026-08-28` style strings and Finance `النطاق المحدد: 2026-08 — 2026-08` located at cited lines; `formatLocalDateLong` exists and is used elsewhere. |
| L-16 | CONFIRMED | «طلب مخصص» (`QuickActionSheet.tsx:30`) vs «طلب من عميل» (NewDraft/DraftEditor); «تثبيت» in four jobs (Setup:81, CostEditor:595/AgreementEditor:304, PwaInstallControl:66,82); «مراجعة» for template revisions (Catalog cited lines). |
| L-17 | CONFIRMED | «ظهور» count in Schedule: 9 lines; «الشريحة» (`InventoryMovementEditor.tsx:244`); «الحارس» (`orderAgreementPresentation.ts:118`); «أُرشف» (CashReversalEditor.tsx:62); «حرفة مخصصة» (Setup.tsx:35). |
| L-18 | CONFIRMED | `${n} محافظ كاش` / `${n} آثار محفوظة` (`CashWallets.tsx:149,168`), `${n} حركات محفوظة` (InventoryMaterials:167), `${n} مكوّن` (Catalog:1061,1206) located; `formatArabicPlural` exists. |
| L-19 | CONFIRMED | «إيقاف الظهورات المستقبلية بسبب مكتوب» (`Schedule.tsx:640`, 38 chars), «دفتر استحقاق المالك والسحب الفعلي» (`Finance.tsx:483`, 33), «أعلن تحصيلًا أو التزامًا قريبًا» (`Finance.tsx:632`, 31) located. |
| E-01 | CONFIRMED | `rg "لم ترد\|timeout\|مهلة" docs/contracts/21` → 0 matches; §3 happy chain + 11 exception states re-read — none matches courier silence. |
| E-02 | CONFIRMED | Contract 21 §2–§3 re-read: exceptions listed with no transitions/exits/actors; `arrived_or_completed` terminal with no dispute exit; historical re-request loop absent from current contract. |
| E-03 | CONFIRMED | Contract 21 §7 («لا يفترض العقد وجود شركة واحدة أو أكثر…»), ROLE-ACCESS-MATRIX §2 («يرى ما وصل لجهته بعد Scope»), contract 24 §3 `network_workspace` fields re-read — no routing field, no courier profile entity. |
| E-04 | CONFIRMED | Contract 21 §2 quote row («مدة سريان» as field only), no `expired` state for `delivery_quote`; ROLE-ACCESS-MATRIX withdrawal wording; single-`quote_submitted` chain re-read — the four questions have no documented answers. |
| E-05 | CONFIRMED | `TRACKER.md:95` (L-04.2) cites `dispatched / arrived / completed / failed / cancelled`; contract 21 §3 defines `booked/source_ready/picked_up/in_transit/arrived_or_completed` — both re-read today; `dispatched` appears in no contract. |
| E-06 | CONFIRMED | `TRACKER.md:88` (L-03.3) cites `draft → submitted → under_review → approved/rejected → paused/archived`; contract 20 §3.3 defines `submitted_for_review/approved_for_publish/changes_requested/update_required` — both re-read today. |
| E-07 | CONFIRMED | `E00-EXECUTION-PROTOCOL.md` §2 table re-read (E-00.2 = 18+19+23+matrix; E-00.3 = 20+22; …E-00.6) vs `TRACKER.md` §2 (E-00.2 = 18/23/24+matrix; E-00.3 = 19; …E-00.7) — assignments differ; protocol stops at E-00.6 while tracker runs to E-00.14. |
| E-08 | CONFIRMED | `HISTORICAL-SOURCES.md:21-23` re-read: column «القرار الحالي» row says «Market/Delivery قدرات تحت `الخدمات`» — contradicts IA contract §1 + DECISIONS EX-D02 + current-state §14. |
| E-09 | CONFIRMED | `rg "network_invitation\|delivery_exception\|market_decision" docs/contracts/24` → 0 matches; contract 19 §2 requires «مستوى إلحاح مبرر» on attention; dictionary §3 lacks it. |
| E-10 | CONFIRMED | Contract 20 §1.1/§2/§3.2 re-read: `accepted_for_external_follow_up` has no contact channel on `market_response`; contact opening specified only for listings; moderation scope (contract 22 §2) covers listings/media/reports only. |
| E-11 | CONFIRMED | Contract 21 §4 («يظهر له معاينة…ويقرها قبل الإرسال» — Owner only) + contract 24 §2 («موافقة Owner أو طالب الحركة») re-read; no customer-side consent mention anywhere. |
| E-12 | CONFIRMED | `rg` for rate-limit/quota concepts across expansion + contracts 18–24 → absent; contract 22 §4 audit list re-read — no read events for `delivery_scoped` contact data. |
| E-13 | CONFIRMED | Contract 22 §3 re-read: consent is a process table; contract 24 §3 has no consent entity row. |
| E-14 | CONFIRMED | Contract 24 §4 re-read: «يحدد عقد العملة/التقريب لاحقًا تمثيلًا دقيقًا قبل الكود» — deferral verbatim. |
| E-15 | CONFIRMED | Migration gate §1 («لا يشمل local export/import بيانات Market/Delivery المتصلة…») vs TRACKER L-01.2 (IndexedDB persistence for network domain) vs Home-Trial SOP §3 (drafts must survive Export/Restore drills) re-read — drafts' export scope stated nowhere. |
| E-16 | CONFIRMED | Contract 20 §3.1 re-read: closure reasons exist without a closure mechanism; no `expired` transition for needs or responses. |
| E-17 | CONFIRMED | Contract 20 §3.3 diagram re-read: no exits drawn from `rejected`/`paused`/`update_required`; `listing_media` has no state machine; contract 22 §1 builds no queue. |
| E-18 | CONFIRMED | OR-O04 (ACTIVATION gate §8) re-read: generic «مراجعة قانونية محلية» with no domain enumeration. |
| E-19 | CONFIRMED | Contract 19 §3 re-read: five example situations, no completeness claim; contract 24 `network_notification.type` has no enumeration. |
| E-20 | CONFIRMED | `TRACKER.md` L-00.4 («التوصيل/طلب أو عرض أو استثناء») vs IA contract §3 («تحتاج إجراء» و«طلباتي») re-read — both verbatim. |
| E-21 | CONFIRMED | `EXPANSION-GLOSSARY.md:16` Owner row includes «أو ممثل مخول له داخل Workspace»; contract 18 §7 defers delegation — both re-read. |

## Notes and amendments surfaced during verification

1. **A-07 scope amendment (recorded):** the acceptance grep (`Math.round|Math.floor` in `src/domain` outside `shared/` and tests) additionally catches `owner-entitlement/policies.ts:108` — a calendar day-span `Math.round` over exact UTC-midnight differences, not money. The A-07 commit must handle this line (exact-division rewrite with a comment, behaviour unchanged) or the acceptance criterion cannot be met verbatim. Recorded here before implementation; will be documented in the commit message and style report.
2. **A-01 family has a fifth consumer:** `g5Service.validateRelation` (declaration linkage, ~lines 460-472) computes "paid against payable" with the same reversal-blind pattern (excludes reversal events but counts reversed settlements) → understates remaining after a settlement reversal. The root-cause fix (single domain derivation) must cover it; the plan card listed four consumers, this is the fifth found at verification. Recorded as an amendment, not a new finding — same defect, same root cause, same fix.
3. **A-07 ESLint guard design constraint:** `craft-order/policies.ts:153` uses `Math.ceil` for the contract-documented unit-cost ceiling (contract 03, verified tested) — the guard bans `Math.round`/`Math.floor` only (matching the card's acceptance grep); `Math.ceil` stays permitted and the decision is recorded in the style report.
4. No finding was `NOT-REPRODUCIBLE`, `ALREADY-FIXED`, or `INVALID`. `main` has not moved since the review (same commit 8ee0832), which is why nothing changed state.
