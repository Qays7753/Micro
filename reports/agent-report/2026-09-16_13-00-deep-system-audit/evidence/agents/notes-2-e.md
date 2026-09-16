# Agent 2-e — Product Architecture, Mobile UX, Discoverability (notes)

Baseline: main @ 37319ca6439746e8ab1946c849decca04e5d (clean). All paths repo-relative to `/home/z/my-project/micro-repo-readonly`.
Diagnostics run: `navigationContract.test.ts` 14/14 PASS; `routeKnowledgeSync.test.ts` 5/5 + `navigation.test.ts` 4/4 PASS; `python3 scripts/text-density-count.py` all surfaces PASS (documented below).

## SHR-001 — sharing capabilities without production entrance

Share surface inventory:
- `apps/prototype-web/client/src/lib/textDelivery.ts` — `shareTextManually` (navigator.share text-only, clipboard fallback, AbortError=unsupported), `copyTextManually`, `canShareText`, `downloadTextFile` (blob + 30s deferred revoke).
- `apps/prototype-web/client/src/application/share/shareMessageService.ts` — 5 draft builders: `orderShareDraft` (:42), `collectionShareDraft` (:65), `deliveryShareDraft` (:82), `reminderShareDraft` (:97), `statementShareDraft` (:118).
- `apps/prototype-web/client/src/pages/SharePreview.tsx` — `/share/preview` deep editor; draft via `window.history.state` (:23); honest empty state when no draft (:26-39).
- `apps/prototype-web/client/src/pages/Statement.tsx:228-248,574` — "ولّد ونزّل التقرير": always downloads markdown; shares via `shareTextManually(rendered.value.markdown)` only when `canShareText()`.

Production entrances (VERIFIED):
- OrderDetail.tsx:1471-1486 — button "شارك رسالة مع الزبون" → `/share/preview` with draft picked contextually: delivered/settled→deliveryShareDraft (:1477); receivable>0→reminderShareDraft (:1479); else orderShareDraft (:1480).
- Statement.tsx:574 — report download/share.

NOT reachable (VERIFIED by exhaustive grep of client/src):
- `collectionShareDraft` — imported OrderDetail.tsx:36 but NEVER called in production (only shareMessageService.test.ts:73). No share action after recording a collection (OrderDetail debt section :1443-1462 and Collect.tsx have no share).
- `statementShareDraft` — imported by NO page (tests only). Statement shares full markdown instead.
- Contract 33 (`docs/contracts/33-manual-share-preview-contract.md`) §1/§3 lists all five kinds incl. "قبضة" (collection) and "كشف فترة" (statement) and is marked "منفذ ونافذ" (implemented & open) — over-claims vs code.

Extra observations: share button in OrderDetail rendered unconditionally (:1471 — outside status conditionals), incl. cancelled orders → orderShareDraft text "طلبك … جاهز للمتابعة" for a cancelled order.

## NAV-003 — focus params

Param matrix (producer → consumer):
- `focus=capacity`: produced homeControlCenterService.ts:335 (today item kind capacity_warning, only when >1 appointment today) → rendered Home.tsx TodayItemRow (priority block :394 / today list) → consumed Schedule.tsx:88-97 (opens capacity/recurrence layer). WIRED.
- `focus=recurrence`: consumed Schedule.tsx:93 — NO producer anywhere (grep `focus=recurrence` → only Schedule + contract doc). HALF-WIRED (documented alias, contract 26 §3.1:99).
- `focus=guided-import`: produced Foundation.tsx:310 (`/settings?focus=guided-import&from=%2Ffoundation`) → consumed Settings.tsx:163-175 (opens guided layer + scrollIntoView). WIRED (test Foundation.ui.test.tsx:111).
- `focus=export`: in KNOWN_FOCUS_VALUES navigationContract.ts:44 — NO producer, NO consumer (Settings.tsx:168 checks only `guided-import`). Contract 26 §3.1:101 marks it "محجوز".
- `focus=today`: navigationContract.ts:45 — no producer/consumer (Home.tsx:152 reads only `setup`). Reserved, contract 26 §3.1:102.
- `focus=priority`: navigationContract.ts:46 — no producer/consumer (Orders.tsx reads no search params at all; Orders.ui.test.tsx:18 mocks useSearch `""`). Reserved, contract 26 §3.1:103. Orders DOES have a permanent "الأولوية الآن" DecisionPanel (Orders.tsx:117-119) the param could target.
- `?created=1`: produced AgreementEditor.tsx:344 → consumed OrderDetail.tsx:84-88. WIRED (OrdJourneys.dom.test.tsx:128-131).
- `?setup=1`: produced Setup.tsx:184 → consumed Home.tsx:152. WIRED (Setup.ui.test.tsx:72).
- `?event`/`?layer`: many producers (activityService.ts:119,281; statementService.ts:323-545; correctionHistoryService.ts:218-242; integrityCheckService.ts:75-77; QuickExpenseForm.tsx:143; FinancialEventEditor.tsx:718; FinancePeriodResultSection.tsx:109; Finance.tsx:420) → consumed Finance.tsx:119-122 + EventsLayer.tsx:778-804 with scroll (:136-137) + `data-focused` (:336) + CSS :4198. WIRED.
- `?mode=cover`: produced Finance.tsx:347 → consumed CashDistribution.tsx:35,43-45. WIRED.
- `?to`: consumed CashDistribution.tsx:36,64-69 (wallet preselect, id must match a wallet) — NO producer. SEMANTIC CONFLICT: navigationContract.ts:82,97 parses `to` as internal PATH (isSafeInternalPath) per contract 26:86 "وجهة داخلية (محجوز)"; parseDeepLink's `to` output consumed nowhere.
- `?purchase`: produced SupplierPurchaseEditor.tsx:651 → consumed InventoryMovementEditor.tsx:57-60. WIRED.
- `?material`: consumed InventoryMovementEditor.tsx:61-64 — NO producer (grep: only comments/tests).
- `?product`: produced CatalogItemsSection.tsx:315 → consumed DirectSaleEditor.tsx:34-36,49. WIRED.
- `?intent`: produced quickRecording.tsx:47-48, Home.tsx:262,269, Tools.tsx:265, NewDraft.tsx:10-16 → consumed DraftEditor.tsx:45-47. WIRED.
- `?estimate`: produced Tools.tsx:265 (bridge), OrderDetail.tsx:1726 → consumed CostCalculator.tsx:46-49,133; DraftEditor.tsx:52. WIRED.
- `?source=order:|sale:`: produced OrderDetail.tsx:702,1455; Parties.tsx:39,42; homeControlCenterService.ts:220,242; quickRecording.tsx:49; Home.tsx:278 → consumed Collect.tsx:34-41 (own regex; not in parseDeepLink vocabulary). WIRED.
- `?entry`: produced correctionHistoryService.ts:297 → consumed WalletLedger.tsx:37 (+scroll :41, data-focused :145, CSS :4203). WIRED.
- `?view=period`: produced only by Finance's own switchView replace-navigation (Finance.tsx:128-135) — state persistence for cold start; no external entrance (by design, comment :123-125).
- `?order`, `?sale`: InventoryMovementEditor.tsx:48-56; `?sale` produced DirectSaleEditor.tsx:523; `?order` produced from OrderDetail (consume deep link) — verified consumption.

Architecture note: `parseDeepLink` (navigationContract.ts:65-101) is only used by `resolveReturnPath` (:131, reads `from`). Every page parses its own params via `URLSearchParams` with local validation. The "closed vocabulary" (navigationContract.ts:8-9) is nominal; the operative vocabulary is the union of per-page reads (documented in contract 26 §3). `export/today/priority` are accepted as KNOWN focus values yet ignored by every page — silently, with no test locking "reserved = ignored".

## OWN-003 — owner money types/policies without UI

Domain (`src/domain/owner-entitlement/types.ts`, `policies.ts`):
- Policy kinds (10): policies.ts:19-30. UI-selectable (9): `supportedOwnerEntitlementPolicyKinds` ownerEntitlementPresentation.ts:50-60. Missing: `fixed_shift`.
  - fixed_shift exclusion is INTENTIONAL: label "مبلغ ثابت للوردية (غير متاح بلا دليل وردية)" presentation:28; domain guard returns honest incomplete + nextAction "لا يوجد في النموذج الحالي سجل ورديات موثق…" policies.ts:758-769; test locks exclusion OwnerEntitlement.ui.test.ts:11; OwnerEntitlement.tsx:320 blocks it in successor form too.
- Movement reasons (6): policies.ts:39-46. UI-writable via `ownerMovementReasonsForKind` presentation:64-67:
  - draw → entitlement_settlement, opening_balance_settlement (ledger form OwnerLedgerFormsSection.tsx:342-354)
  - return → opening_balance_settlement, settlement_of_prior_draw, new_capital_investment
  - `pre_entitlement_draw`: reachable via unified withdrawal editor OwnerWithdrawalEditor.tsx:101 (G6-U2-1 note :21-23 — was "موجود بالنطاق وغير مستدعى", now wired when policy exists but no settleable entitlement).
  - `owner_draw`: NO UI writer anywhere (grep: only tests + presentation label :46 + service aggregation). X-05 design note presentation:61-63 — ledger layer deliberately excludes "السحب الحر"; free draw goes to financial event `owner_withdrawal_cash` (OwnerWithdrawalEditor.tsx:105-113) when no active policy.
  - Residue: `ownerDrawMinor` computed in overview (ownerEntitlementService.ts:227,256) but NOT displayed in any metric (OwnerEntitlement.tsx:619-624 shows only 4 metrics; ownerDrawMinor/drawnBeforeEntitlementMinor never rendered); movement rows would show the label (OwnerEntitlement.tsx:990) only if such a movement existed — unreachable state in production.

## CAT-001 — financial logic inside Catalog

- `src/domain/catalog/` contains NO financial computation. Money-shaped fields exist as validated suggestions: `defaultPriceMinor`/`defaultUnitCostMinor` (types.ts:15-21; policies.ts:43-51,71-84) — "a proposal, never the actual sale price"; `CatalogTemplateExtras` (types.ts:99-109) mirrors cost-snapshot structure, validation-only (policies.ts:153-173).
- Distribution/margin/reading logic lives in `src/domain/recurring-margin/` (AllocationPolicy 4 kinds incl. `completed_revenue_percentage`; AllocationCalculation.resultMinor) + `RecurringWorkService` — its ONLY UI surface is the Catalog page (Catalog.tsx:72,182,324,427-428; CatalogPoliciesSection.tsx:108-316 policy CRUD; CatalogReadingsSection.tsx:44-246 readings incl. "الربح بعد التوزيع" :131-135). No Finance entrance to allocation policies exists (grep Finance.tsx for توزيع/allocation → only cash-distribution strings :447 and margin reading label :615).
- Readings are derived from final orders (recurringWorkService.ts:418-447: recognizedRevenueMinor − recognizedCostMinor) — display-only; policy CRUD writes AllocationPolicy records only (:152-269); no financial events written. The Catalog page itself declares "لا تُنشئ السياسة قيدًا ماليًا ولا تعيد كتابة الماضي" (CatalogPoliciesSection.tsx:147).
- README claim (README.md:33 "قوالب مكونات/yield تخطيطية بلا أثر مالي أو مخزني"; :41 "لا ينشئ أي منها سعرًا أو Purchase أو Inventory أو Consumption أو COGS أو إيرادًا أو كاشًا"):
  - Units/converters: no ledger writes; `convertQuantityMilli` consumed by g5Service.ts:63-94 to normalize order quantities for G5 decision readings (reading effect, not money movement). Literal claim holds.
  - Templates: components/extras/yield planning-only — but `autoConsumeOnDelivery` (types.ts:131-135, Group 4/contract 29) is read by deliveryReviewService.ts:279-288 to pre-arm inventory consumption rows inside the delivery atomic transaction (flag itself creates nothing; DeliveryReview.tsx:294 discloses it). README sentence predates the flag and was not updated — nuance, literal claim still defensible.
  - `CatalogTemplateExtras`: stored/validated/exported/migrated (transferFamilyValidators.ts:1184-1207; transferSnapshotMigrations.ts:160) but NO production consumer — only the template's own edit form loads them (Catalog.tsx:597-618). The design comment "حتى يتطابق القالب مع المسودة بلا ترجمة" (types.ts:99-101) has no wired consumer (DraftEditor/CostEditor never read templates; delivery consumption rows come from `order.costSnapshot.input.materialItems` deliveryReviewService.ts:197-222, not template components). Missing wiring.

## Sweep (new findings evidence)

1. Foundation entrance misdirection: Home.tsx:229 (SET-002 banner) says "وصفحة الأساس عمق اختياري تكمله لاحقًا من «المالية»" — but the ONLY production entrance to /foundation is Home.tsx:456 (inside Home's "مالي" block, h2 at :450); Finance.tsx contains zero foundation/الأساس references (grep). Seat name «المالية» (navigation.ts:18) ≠ block name "مالي".
2. Template extras dead surface (see CAT-001).
3. Market back navigation: Market.tsx:17,44-51 uses `window.history.back()` twice; `returnPath` used only for the label (:18). All other surfaces navigate(returnPath). Cold start on /market (PWA deep link) → empty history → button may no-op/exit. Needs runtime proof for actual behavior; code inconsistency verified.
4. AppHeader soon-panel (AppHeader.tsx:97-122): role="dialog" aria-modal="false", closes on backdrop click/X button — no Escape handler, no focus management (non-modal, minor).
5. Catalog naming: same route /catalog labeled "منتجاتي وخدماتي" (Home.tsx:472 section + Catalog.tsx:773 h1), "الكتالوج والقوالب" (Tools.tsx:111), "الكتالوج" (navigation.ts:43 header context).
6. OrderDetail share button unconditional (:1471) incl. cancelled orders.
7. Future-scope honesty VERIFIED: Market.tsx:21-42 ("قريبًا" badge, explicit "لا موردين معروضين ولا طلبات شراء من هنا", no financial effect), AppHeader.tsx:18-29 (transport/assistant panels state what does NOT work + where current paths live), Tools.tsx:134 "السوق والتوصيل" not_available → disabled button (:338).
8. RTL/mobile code-level VERIFIED good: touch targets 44px+ (index.css:729-732 nav 44×56; :227-229 icon-button 44×44; :458-461 text-action min-height 44; :1100-1106 back-button 44); BottomNav aria-current="page" (BottomNav.tsx:49); central ASCII formatters en-US + د.أ + DD/MM/YYYY (formatters.ts:4-9,50-60,113-117; product rule comment :19-22); bdi dir="ltr" around numbers in lists (e.g., OwnerLedgerFormsSection.tsx:365); Drawer = vaul/Radix primitive (focus/ESC handled by primitive); QuickActionSheet dirty-guard two-option question (QuickActionSheet.tsx:225-249) + receipt with "افتح السجل" (:323-335).
9. Density guard (run this session, all PASS): Finance 261/261, Statement 205/205, OrderDetail 179/179, FinancialEventEditor 145/145, Catalog 91/91, Schedule 99/99, CashWallets 76/76, Orders 77/79 — largest screens sit exactly AT cap (ratchet).
10. Loading/error/empty patterns consistent: role="status" loading, role="alert" errors with "لم يتم تغيير شيء" + explicit retry (Orders.tsx:86-99, Tools.tsx:180-192, Home.tsx:184-194, StartupGate.tsx:83-91).

## Route/entrance map (production entrances; tests excluded)

| Route | Entrances | Verdict |
|---|---|---|
| / (Home) | seat 1 navigation.ts:16; Setup.tsx:184 (/?setup=1) | reachable |
| /orders | seat 2 navigation.ts:17; DraftEditor:307,323,337; CostEditor:334; Schedule:176,209; dailyFollowUpService:98 | reachable |
| /orders/new | none (legacy compat redirect → /orders/draft/new, NewDraft.tsx:14-16) | intentional compat |
| /orders/draft/new | quickRecording:47-48; Home:262,269; Schedule:249; dailyFollowUpService:108; Tools:263-268 (estimate bridge) | reachable |
| /orders/draft/:id | Orders:228; Home today rows (homeControlCenterService hrefs) | reachable |
| /orders/draft/:id/cost, /agreement | from DraftEditor flow (DraftEditor:307 area) | reachable (journey) |
| /orders/:id | Orders rows; Finance:338,533 (EventsLayer/deposits); AgreementEditor:136,344; DraftEditor:352; CashReversalEditor:145; EventsLayer:105; activity/statement services deepLinks; Home rows | reachable |
| /orders/:id/deliver | OrderDetail:673 only | reachable (single, contextual) |
| /direct-sales/new | Orders:312; CatalogItemsSection:315 (?product=); CashTransferEditor:110 → /cash/wallet/new (n/a) | reachable |
| /direct-sales/:id | edit links from orders/sales lists | reachable |
| /schedule | Home optional module (homeControlCenterService:370); Orders:304; Tools:122; ScheduleEditor:198; nav label :24 | reachable |
| /schedule/:id | Orders:270; Schedule rows:208,221,230,239,268,284; Home today rows (:316) | reachable |
| /finance | seat 3 navigation.ts:18; many back-links (CashWallets:85, Suppliers:53, InventoryMaterials:234, Parties:87, partyLedgerService:182, FinancialEventEditor:440) | reachable |
| /finance?view/layer/event | internal + many service deepLinks (see NAV-003) | reachable |
| /finance/new/:type | Finance:724-773 (8 buttons); Foundation:178,239; FinancialEventEditor:858 (suppliers); OwnerEntitlement:631 | reachable |
| /finance/withdraw | OwnerEntitlement:639 ONLY | reachable (single entrance by design X-05/S2-07) |
| /finance/owner-entitlement | Finance:354,405,740; Foundation:185; OwnerEntitlement internal | reachable |
| /finance/g5/declaration | Finance:345,622 | reachable |
| /finance/statement | Finance:511,684 | reachable |
| /finance/activity | Finance:785; Home:559 | reachable |
| /share/preview | OrderDetail:1481 (with history state) | reachable; no-draft state honest |
| /suppliers | Finance:494; Suppliers back-links; FinancialEventEditor:858 | reachable |
| /suppliers/purchase/:id(/payment) | Suppliers:132,141,176 | reachable |
| /cash | Finance:703; nav label:26 | reachable |
| /cash/wallet/new | CashWallets:157; Foundation:126; Finance:473; CashTransferEditor:110 | reachable |
| /cash/wallet/:id | CashWallets:243 | reachable |
| /cash/wallet/:id/opening-later | CashWallets:251 | reachable |
| /cash/wallet/:id/adjust | CashWallets (adjust action) | reachable |
| /cash/entry/:id/reverse | correctionHistoryService:297 deepLink (?entry=) | reachable |
| /cash/transfer | CashWallets:188 | reachable |
| /cash/distribute | CashWallets:179; Finance:347 (mode=cover),460 | reachable |
| /cash/count | CashWallets:165; Finance:502 | reachable |
| /collect | quickRecording:49; Home:278; OrderDetail:702,1455; Parties:39,42; homeControlCenterService:220,242 | reachable |
| /inventory | Finance:717; Tools:108; InventoryMaterials back | reachable |
| /inventory/material/new | InventoryMaterials:309; Foundation:295; InventoryMovementEditor:442 | reachable |
| /inventory/material/:id/confirm | inventory rows | reachable |
| /inventory/movement/:type | InventoryMaterials:317,334,341; SupplierPurchaseEditor:651; DirectSaleEditor:523 | reachable |
| /inventory/movement/:id/reverse | InventoryMaterials:713 | reachable |
| /catalog | Home:480; Tools:117; DraftEditor:414 | reachable (3 entrances, 3 names) |
| /tools | seat 4 navigation.ts:19; EstimateDetail:72,104 | reachable |
| /tools/calculator | Tools:89,214 | reachable |
| /tools/estimate/:id | Tools:246; CostCalculator:581,593,611; OrderDetail:1726 | reachable |
| /tools/integrity | Tools:103; Finance:524; SettingsGuidedOpeningSection:254 | reachable |
| /assets(/new/:id) | Finance:558; Assets:74,84 | reachable |
| /loans(/new/:id) | Finance:590; Loans:86,97 | reachable |
| /parties | Finance:486; Tools:132; Home:352 | reachable |
| /profile | Home:218 ONLY | reachable (topbar-adjacent single entrance) |
| /settings | AppHeader settings button (MicroAppShell); Tools:96; Home:369,379; StartupGate public route :9 | reachable |
| /setup | StartupGate:67 (first run); Settings:386,458 (reset) | reachable |
| /foundation | Home:456 ONLY | reachable but banner misdirects (NEW-2E-01) |
| /market | seat 5 navigation.ts:20 | reachable (honest قريبًا) |
| /review | none — Redirect to /finance (MicroRouter:162-164) | intentional legacy redirect |

## Could not verify (needs runtime)
- Market cold-start back behavior (history empty) — live browser needed.
- navigator.share / clipboard actual outcomes on devices — code paths only.
- Visual density/scroll perception, layer open animations.
- focus=capacity: whether opening the layer lands user attention correctly (runtime UX).
