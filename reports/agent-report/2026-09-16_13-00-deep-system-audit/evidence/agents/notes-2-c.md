# 2-c Notes — Orders/Purchasing/Inventory/Collections audit (2026-09-16)

Baseline main @ 37319ca, worktree clean. Focused diagnostics run (all PASS):
- vitest tests/domain/inventory-material.test.ts (12) + tests/domain/supplier-purchase-corrections.test.ts (9) — 21 passed
- vitest (web) client/src/application/collections/collectionReversalService.test.ts — 10 passed

## PUR-001 verdict: INTENTIONAL_DESIGN (documented, coherent) + 2 discoverability gaps (NEW)

Policy as-is (VERIFIED):
1. Buying does NOT create inventory. `createSupplierPurchase` writes only SupplierPurchase (cash/payable) — src/domain/supplier-purchase/policies.ts:93-132; types.ts:1 header comment. Governing decision: docs/contracts/09:11 («شراء المواد يخرج كاشًا أو ينشئ التزامًا...»); contract 28 §2 table separates شراء/استلام/استهلاك/هدر (docs/contracts/28:22-32) + «الشراء لا يصبح استلامًا بمجرد تسجيله» (28:32).
2. NO FinancialEventType for purchases (src/domain/financial-event/types.ts:10-27). Cash effect read-side: projectFinancialService.ts:400-421 (unallocated -= paidMinor), payables at :491. Wallet attribution via cash-continuity allocation (supplierPurchaseService.ts:122-159) with FIN-003 pre-validation (94-116).
3. Linking step optional: SupplierPurchase.materialId + expectedQuantityMilli (types.ts:60-64). Bridge card in purchase detail (edit mode): SupplierPurchaseEditor.tsx:605-664 → /inventory/movement/receipt?purchase=<id> (prefill only, TR-07 no silent write). Second entrance: InventoryMaterials.tsx:313-320 «استلام شراء».
4. Inventory recording independent: material opening (service:502-587, atomic commitInventory(material,[opening])); manual adjustment (1093-1156); confirm-opening (633-713). No purchaseId needed for opening/adjustment — by design.
5. Double count analysis: receipts cumulative value ≤ purchase.totalMinor (service:764-769), qty ≤ expected (772-780), link match enforced (746-751), tracked-material guard (736-741), operationKey idempotency (730-731). Cash never written by receipts (commitInventory(null,[movement]) :795). Consumption cost = moving average (domain consumptionValueMinor policies:203-222) → COGS read via isCostBackedConsumption (projectFinancialService:296-317) + G6 order comparison (docs/decisions/actual-material-cost-per-order-g6-scope.md).
6. Corrections: purchase edit revision with receipt guards (service:312-400); payment reversal one-per-payment (domain policies:257-289); movement reversal one-per-movement + waste loss_non_cash atomic reversal (service:1157-1224).

Gaps → NEW-001 (create-mode no receipt CTA; Suppliers settled list slice(0,4); awaiting text not linked), NEW-002 (adjust editor unreachable).

## COL-001 verdict: PARTIALLY_CONFIRMED

Capability map (all VERIFIED unless noted):
- Order collection reversal EXISTS: domain reverseOrderCollection (craft-order/policies.ts:916-959); compound grip+allocation via CollectionReversalService.reverse (collectionReversalService.ts:243-365, atomic commitOrderCollectionReversal); single via FulfillmentService.reverseCollection (fulfillmentService.ts:307-331).
- UI entry: ONLY OrderDetail corrections <details> (OrderDetail.tsx:833-837 summary «تصحيحات موثقة على الطلب» naming «تراجع عن قبضة» at :365-373; per-grip buttons :1378-1391; CorrectionPreview :1255-1371). Locked in delivered-review (1211-1215).
- Collect sheet success screen: NO undo (Collect.tsx:200-249 — «افتح السجل»/«تم» only).
- DeliveryReview success receipt: NO undo (DeliveryReview.tsx:520-562 — «فتح تفاصيل الطلب» only). Delivery collect = collection_recorded; its allocation matched via sourceRefLineId=deliveryEvent.id (deliveryReviewService.ts:519-531; match collectionReversalService.ts:130).
- Direct sale collection: NO reversal concept — only sale edit (DirectSaleEditor.tsx:350-364 edits collectedMinor) which does NOT reverse wallet allocation (directSaleService.ts:128-169 no cash writes); cancel mirrors allocations (171-273) but voids sale; manual wallet fix via WalletLedger.tsx:172 (/cash/entry/:id/reverse). → NEW-003.
- Deposit (عربون): NO reversal on active orders — deposit_collected excluded from reverseOrderCollection (policies.ts:928; OrderDetail.tsx:1207 lists collection_recorded only); refund only for cancelled orders (OrderDepositPanels.tsx:115; fulfillmentService.ts:410-446). Delivered orders not cancellable (cancellableStatuses OrderDetail.tsx:71) → over-recorded deposit dead-end → NEW-004.
- CorrectionsLayer/Finance «السجل» = read-only history (CorrectionsLayer.tsx:139; contract 34 §2.4). EventsLayer corrections = general financial events only (EventsLayer.tsx:206). OrderEventLog read-only.
- Delivery reversal (canonical for delivered→needs_review): OrderDetail.tsx:927-983 button inside same collapsed corrections details; NOT named in correctionsSummary (365-373) — minor disclosure gap.
- NEW-005: deposit partial refund idempotency key hour-granularity (fulfillmentService.ts:417 `${id}:refund-deposit:${amount}:${reason.length}:${now.slice(0,13)}`) + silent replay (MemoryLocalStore.ts:209-218) → same-amount same-hour second partial refund silently swallowed.

## Write-path matrix evidence (entrances etc.) — see final message table
Routes: MicroRouter.tsx:95-168. Entrances verified via rg across pages/components (listed in final message).

## Not verified
- Runtime behavior on deployed PWA (static only). No DOM tests run for Collect/DirectSaleEditor/OrderDetail reversal panels (existing tests cover services; UI claims from code reading).
- IndexedDbLocalStore transaction internals for commitOrderDelivery/commitOrderCollectionReversal (read MemoryLocalStore as reference; adapter conformance tests cover parity).
