import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { IndexedDbLocalStore } from "./IndexedDbLocalStore";
import { AssetService } from "@/application/assets/assetService";
import { LoanService } from "@/application/loans/loanService";
import { RetainedDepositService } from "@/application/financial-records/retainedDepositService";
import {
  calculateCostSnapshot,
  cancelOrder,
  collectDeposit,
  createCraftOrder,
  settleDepositRetain,
} from "@micro-domain/craft-order/index.js";
/* UNIT-035 (تنفيذ S15 بالأمر الموحد §5): إنشاء الإقراض ملغى — بذرة القرض
 * التاريخي بالمصنعين الكنونيين عند حد المخزن (نفس مسار توافق النقل). */
import { createLoanRecord } from "@micro-domain/loan/index.js";
import { createFinancialEvent } from "@micro-domain/financial-event/index.js";
import type { StoredCraftOrder } from "./types";
import { assertOk } from "@/testing/resultAssertions";

/* المجموعة ٤ (عقد ٢٩): معاملات الأصول والقروض وتصنيف العربون ذرّية على مستوى
 * IndexedDB نفسه — السجل وحدثه المالي معًا أو لا شيء، وإعادة المحاولة تعيد
 * الاستخدام الصادق لا التكرار. */

const databaseName = "micro-prototype-local";
const NOW = "2026-09-04T08:00:00.000Z";
function clearDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
afterEach(clearDatabase);

function cancelledRetainedOrder(): StoredCraftOrder {
  const snapshot = calculateCostSnapshot("snap-g4", {
    currency: "JOD",
    materialItems: [
      {
        name: "خيط",
        quantity: 1,
        unit: "متر",
        unitPriceMinor: 300,
        priceDate: "2026-09-01",
        source: "user_input",
        confidence: "known",
      },
    ],
    time: null,
    packagingMinor: 0,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 1,
    createdAt: NOW,
    source: "price_approval",
  });
  let order = createCraftOrder({
    id: "order-idb",
    customerName: "ليلى",
    itemName: "فستان",
    specifications: "قياس مخصص",
    quantity: 1,
    agreedPriceMinor: 10000,
    costSnapshot: snapshot,
    createdAt: NOW,
  });
  order = collectDeposit(order, 5000, "order-idb:dep", NOW);
  order = cancelOrder(order, "إلغاء", "order-idb:cancel", NOW);
  order = settleDepositRetain(order, 5000, "احتفاظ", "order-idb:retain", NOW);
  return {
    id: "order-idb",
    order,
    catalogItemId: null,
    deliveryDate: "2026-09-01",
    agreementSource: "whatsapp",
    createdAt: NOW,
    updatedAt: NOW,
  };
}

describe("IndexedDbLocalStore Group 4 atomic commits (المجموعة ٤ — عقد ٢٩)", () => {
  it("commits an asset and its acquisition event atomically; retry reuses honestly", async () => {
    const store = new IndexedDbLocalStore();
    const service = new AssetService(store, () => NOW);
    const created = await service.create({
      name: "ثلاجة عرض",
      acquisitionAmountMinor: 60000,
      acquisitionKind: "cash",
      purchaseDate: "2026-06-01",
      lifeMonths: 24,
      depreciationStartOn: "2026-06-01",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const events = await store.listFinancialEvents();
    assertOk(events);
    const acquisitions = events.value.filter(event => event.type === "asset_purchase_cash");
    expect(acquisitions).toHaveLength(1);
    const assets = await store.listAssets();
    assertOk(assets);
    expect(assets.value).toHaveLength(1);
    /* إعادة المحاولة عبر المخزن مباشرة: إعادة استخدام لا تكرار. */
    const commit = await store.commitAssetRecord(assets.value[0]!, acquisitions[0]!);
    expect(commit.ok && commit.value.reused).toBe(true);
    const after = await store.listAssets();
    assertOk(after);
    expect(after.value).toHaveLength(1);
    const afterEvents = await store.listFinancialEvents();
    assertOk(afterEvents);
    expect(afterEvents.value.filter(event => event.type === "asset_purchase_cash")).toHaveLength(1);
  });

  it("commits depreciation and disposal without leaving a half state", async () => {
    const store = new IndexedDbLocalStore();
    const service = new AssetService(store, () => NOW);
    const created = await service.create({
      name: "ماكينة",
      acquisitionAmountMinor: 30000,
      acquisitionKind: "payable",
      purchaseDate: "2026-06-01",
      lifeMonths: 12,
      depreciationStartOn: "2026-06-01",
    });
    if (!created.ok) return;
    const assetId = created.value.asset.id;
    const recorded = await service.recordDepreciation(assetId, { asOf: "2026-09-01" });
    expect(recorded.ok).toBe(true);
    const disposed = await service.dispose(assetId, {
      on: "2026-09-10",
      proceedsMinor: 15000,
      reason: "بيع",
    });
    expect(disposed.ok).toBe(true);
    const events = await store.listFinancialEvents();
    assertOk(events);
    /* اقتناء + إهلاك + تخلص = ٣ أحداث مترابطة بسياق الأصل نفسه. */
    expect(events.value.filter(event => event.assetContext?.assetId === assetId)).toHaveLength(3);
    const assets = await store.listAssets();
    assertOk(assets);
    expect(assets.value[0]!.status).toBe("disposed");
    expect(assets.value[0]!.disposal?.eventId).toBeTruthy();
  });

  it("commits a loan with its principal event and a repayment atomically", async () => {
    const store = new IndexedDbLocalStore();
    const service = new LoanService(store, () => NOW);
    /* UNIT-035: البذرة عند حد المخزن بالمصنعين الكنونيين — التسديد يبقى
     * عبر مساره الحي (صيانة التاريخ) فيبقى البرهان ذرّيًا كما هو. */
    const principalEvent = createFinancialEvent({
      id: "g4-loan-principal-event",
      type: "loan_outgoing_cash",
      amountMinor: 15000,
      occurredOn: "2026-07-01",
      recordedAt: NOW,
      idempotencyKey: "g4-loan:principal",
      note: "قرض تاريخي",
      counterparty: "أحمد",
      loanContext: { loanId: "g4-loan", borrower: "أحمد" },
    });
    const committed = await store.commitLoanRecord(
      createLoanRecord({
        id: "g4-loan",
        borrowerName: "أحمد",
        principalMinor: 15000,
        loanDate: "2026-07-01",
        purposeNote: null,
        sourceWalletId: null,
        principalEventId: principalEvent.id,
        operationKey: "g4-loan:create",
        createdAt: NOW,
      }),
      principalEvent,
    );
    assertOk(committed);
    const loanId = committed.value.record.id;
    const repaid = await service.recordRepayment(loanId, { amountMinor: 5000, date: "2026-08-01" });
    assertOk(repaid);
    expect(repaid.ok).toBe(true);
    const events = await store.listFinancialEvents();
    assertOk(events);
    expect(events.value.filter(event => event.loanContext?.loanId === loanId)).toHaveLength(2);
    const loans = await store.listLoans();
    assertOk(loans);
    expect(loans.value[0]!.repayments).toHaveLength(1);
    /* إعادة استخدام عبر المخزن: الحدث موجود → لا كتابة ثانية. */
    const commit = await store.commitLoanRecord(loans.value[0]!, repaid.value.event);
    expect(commit.ok && commit.value.reused).toBe(true);
    const after = await store.listLoans();
    assertOk(after);
    expect(after.value[0]!.repayments).toHaveLength(1);
    const afterEvents = await store.listFinancialEvents();
    assertOk(afterEvents);
    expect(afterEvents.value.filter(event => event.type === "loan_repayment_cash")).toHaveLength(1);
  });

  it("commits deposit classification with the order atomically; retry reuses", async () => {
    const store = new IndexedDbLocalStore();
    await store.saveOrder(cancelledRetainedOrder());
    const service = new RetainedDepositService(store, () => NOW);
    const classified = await service.classify("order-idb", "revenue", "تعويض الإلغاء");
    expect(classified.ok).toBe(true);
    const events = await store.listFinancialEvents();
    assertOk(events);
    expect(events.value.filter(event => event.type === "deposit_retained_revenue")).toHaveLength(1);
    const orders = await store.listOrders();
    assertOk(orders);
    expect(orders.value[0]!.order.retainedMeaning).toBe("revenue");
    /* إعادة المحاولة عبر المخزن — إعادة استخدام صادقة. */
    const commit = await store.commitDepositClassification(
      orders.value[0]!,
      events.value.find(event => event.type === "deposit_retained_revenue")!,
    );
    expect(commit.ok && commit.value.reused).toBe(true);
    const after = await store.listOrders();
    assertOk(after);
    expect(after.value[0]!.order.events.filter(event => event.type === "deposit_classified")).toHaveLength(1);
  });

  it("readSnapshot and replaceSnapshot carry the new collections", async () => {
    const store = new IndexedDbLocalStore();
    const assets = new AssetService(store, () => NOW);
    await assets.create({
      name: "ثلاجة عرض",
      acquisitionAmountMinor: 60000,
      acquisitionKind: "cash",
      purchaseDate: "2026-06-01",
    });
    /* UNIT-035: القرض التاريخي عند حد المخزن — الزوج يظل يسافر في اللقطة. */
    const snapshotEvent = createFinancialEvent({
      id: "g4-snapshot-loan-event",
      type: "loan_outgoing_cash",
      amountMinor: 15000,
      occurredOn: "2026-07-01",
      recordedAt: NOW,
      idempotencyKey: "g4-snapshot-loan:principal",
      note: "قرض تاريخي",
      counterparty: "أحمد",
      loanContext: { loanId: "g4-snapshot-loan", borrower: "أحمد" },
    });
    const snapshotLoan = await store.commitLoanRecord(
      createLoanRecord({
        id: "g4-snapshot-loan",
        borrowerName: "أحمد",
        principalMinor: 15000,
        loanDate: "2026-07-01",
        purposeNote: null,
        sourceWalletId: null,
        principalEventId: snapshotEvent.id,
        operationKey: "g4-snapshot-loan:create",
        createdAt: NOW,
      }),
      snapshotEvent,
    );
    assertOk(snapshotLoan);
    const snapshot = await store.readSnapshot();
    expect(snapshot.ok).toBe(true);
    if (!snapshot.ok) return;
    expect(snapshot.value.assets).toHaveLength(1);
    expect(snapshot.value.loans).toHaveLength(1);
    const replaced = await store.replaceSnapshot({ ...snapshot.value, loans: [] });
    expect(replaced.ok).toBe(true);
    const loansAfter = await store.listLoans();
    assertOk(loansAfter);
    expect(loansAfter.value).toHaveLength(0);
    const assetsAfter = await store.listAssets();
    assertOk(assetsAfter);
    expect(assetsAfter.value).toHaveLength(1);
  });
});
