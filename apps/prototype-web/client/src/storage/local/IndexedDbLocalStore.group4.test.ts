import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { IndexedDbLocalStore } from "./IndexedDbLocalStore";
import { AssetService } from "@/application/assets/assetService";
import { LoanService } from "@/application/loans/loanService";
import { RetainedDepositService } from "@/application/finance/retainedDepositService";
import {
  calculateCostSnapshot,
  cancelOrder,
  collectDeposit,
  createCraftOrder,
  settleDepositRetain,
} from "@micro-domain/craft-order/index.js";
import type { StoredCraftOrder } from "./types";

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
    const acquisitions = events.value.filter(event => event.type === "asset_purchase_cash");
    expect(acquisitions).toHaveLength(1);
    const assets = await store.listAssets();
    expect(assets.value).toHaveLength(1);
    /* إعادة المحاولة عبر المخزن مباشرة: إعادة استخدام لا تكرار. */
    const commit = await store.commitAssetRecord(assets.value[0]!, acquisitions[0]!);
    expect(commit.ok && commit.value.reused).toBe(true);
    const after = await store.listAssets();
    expect(after.value).toHaveLength(1);
    const afterEvents = await store.listFinancialEvents();
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
    /* اقتناء + إهلاك + تخلص = ٣ أحداث مترابطة بسياق الأصل نفسه. */
    expect(events.value.filter(event => event.assetContext?.assetId === assetId)).toHaveLength(3);
    const assets = await store.listAssets();
    expect(assets.value[0]!.status).toBe("disposed");
    expect(assets.value[0]!.disposal?.eventId).toBeTruthy();
  });

  it("commits a loan with its principal event and a repayment atomically", async () => {
    const store = new IndexedDbLocalStore();
    const service = new LoanService(store, () => NOW);
    const created = await service.create({
      borrowerName: "أحمد",
      principalMinor: 15000,
      loanDate: "2026-07-01",
    });
    if (!created.ok) return;
    const loanId = created.value.loan.id;
    const repaid = await service.recordRepayment(loanId, { amountMinor: 5000, date: "2026-08-01" });
    expect(repaid.ok).toBe(true);
    const events = await store.listFinancialEvents();
    expect(events.value.filter(event => event.loanContext?.loanId === loanId)).toHaveLength(2);
    const loans = await store.listLoans();
    expect(loans.value[0]!.repayments).toHaveLength(1);
    /* إعادة استخدام عبر المخزن: الحدث موجود → لا كتابة ثانية. */
    const commit = await store.commitLoanRecord(loans.value[0]!, repaid.value.event);
    expect(commit.ok && commit.value.reused).toBe(true);
    const after = await store.listLoans();
    expect(after.value[0]!.repayments).toHaveLength(1);
    const afterEvents = await store.listFinancialEvents();
    expect(afterEvents.value.filter(event => event.type === "loan_repayment_cash")).toHaveLength(1);
  });

  it("commits deposit classification with the order atomically; retry reuses", async () => {
    const store = new IndexedDbLocalStore();
    await store.saveOrder(cancelledRetainedOrder());
    const service = new RetainedDepositService(store, () => NOW);
    const classified = await service.classify("order-idb", "revenue", "تعويض الإلغاء");
    expect(classified.ok).toBe(true);
    const events = await store.listFinancialEvents();
    expect(events.value.filter(event => event.type === "deposit_retained_revenue")).toHaveLength(1);
    const orders = await store.listOrders();
    expect(orders.value[0]!.order.retainedMeaning).toBe("revenue");
    /* إعادة المحاولة عبر المخزن — إعادة استخدام صادقة. */
    const commit = await store.commitDepositClassification(
      orders.value[0]!,
      events.value.find(event => event.type === "deposit_retained_revenue")!,
    );
    expect(commit.ok && commit.value.reused).toBe(true);
    const after = await store.listOrders();
    expect(after.value[0]!.order.events.filter(event => event.type === "deposit_classified")).toHaveLength(1);
  });

  it("readSnapshot and replaceSnapshot carry the new collections", async () => {
    const store = new IndexedDbLocalStore();
    const assets = new AssetService(store, () => NOW);
    const loans = new LoanService(store, () => NOW);
    await assets.create({
      name: "ثلاجة عرض",
      acquisitionAmountMinor: 60000,
      acquisitionKind: "cash",
      purchaseDate: "2026-06-01",
    });
    await loans.create({ borrowerName: "أحمد", principalMinor: 15000, loanDate: "2026-07-01" });
    const snapshot = await store.readSnapshot();
    expect(snapshot.ok).toBe(true);
    if (!snapshot.ok) return;
    expect(snapshot.value.assets).toHaveLength(1);
    expect(snapshot.value.loans).toHaveLength(1);
    const replaced = await store.replaceSnapshot({ ...snapshot.value, loans: [] });
    expect(replaced.ok).toBe(true);
    const loansAfter = await store.listLoans();
    expect(loansAfter.value).toHaveLength(0);
    const assetsAfter = await store.listAssets();
    expect(assetsAfter.value).toHaveLength(1);
  });
});
