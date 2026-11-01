/**
 * S12-ATOMIC-001 (أمر S13 2158b0fc §5 — موجدة المراجعة المستقلة عند ac4429ef):
 * الإثبات الدائم أن فشل حزمة كتابة التسليم **بعد بدئها عند حد الالتزام**
 * يتدحرج كله — على المهايئين معًا:
 *  - الذاكرة: فشل استنساخ متزامن في عمق تسلسل الالتزام (محفظة مسمومة)
 *    يُرجَع فشلًا صادقًا قبل أول تعديل (الإصلاح الجذري: استنساخ الحزمة كلها
 *    قبل أي تغيير) — لا كتابة نصفية.
 *  - IndexedDB: خطأ DataCloneError حقيقي داخل مستمع onsuccess بعد اصطفاف
 *    كتابات الحزمة (الطلب/الحركات/القبض) في المعاملة يُحبِط المعاملة
 *    ويتدحرج كل المصروف (نمط RB-3/R9-GA-F7 نفسه) — لا كتابة نصفية.
 * والفحوص تشمل حالة الطلب والإيراد المعترف والقبض/الكاش وتخصيص المحفظة
 * وحركات المواد والنقص والمراجع المشتقة كلها: إما لا شيء مكتوب، أو فشل
 * صادق — لا نصف نجاح ولا مآل يتيم. حقن الفشل اختباري بحت (محفظة تحمل
 * خاصية غير قابلة للاستنساخ) — لا مفتاح فشل إنتاجي إطلاقًا.
 */
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { AgreementService } from "@/application/agreements/agreementService";
import { CostService, type CostEditorInput } from "@/application/cost/costService";
import { DeliveryReviewService } from "@/application/fulfillment/deliveryReviewService";
import { DraftService } from "@/application/drafts/draftService";
import { FulfillmentService } from "@/application/fulfillment/fulfillmentService";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { IndexedDbLocalStore } from "@/storage/local/IndexedDbLocalStore";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import type { DeliveryReviewServiceStore } from "@/application/fulfillment/deliveryReviewService";
import { createCashWallet } from "@micro-domain/cash-continuity/index.js";
import type { CashWallet } from "@micro-domain/cash-continuity/index.js";
import type { PrototypeLocalStore } from "@/storage/local/types";

const databaseName = "micro-prototype-local";
function clearDatabase(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
afterEach(clearDatabase);

const NOW = "2026-11-01T09:00:00.000Z";

const costInput: CostEditorInput = {
  materialItems: [{ name: "قماش", quantity: 2, unit: "متر", unitPriceMinor: 500, confidence: "known" }],
  time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
  packagingMinor: 0,
  deliveryMinor: 0,
  wasteMinor: 0,
  safetyBufferMinor: 0,
  quantity: 1,
};

/* رحلة كاملة حتى الجاهزية (نمط s12SharedAcceptance) فوق أي مهايئ. */
async function readyOrder(store: PrototypeLocalStore, agreedPriceMinor: number, depositMinor: number) {
  const inventory = new InventoryMaterialService(store as never, () => NOW);
  const opened = await inventory.openMaterial({
    name: "قماش قطنية",
    unit: "meter",
    tracking: "tracked",
    opening: {
      quantityState: "confirmed",
      quantityMilli: 20_000,
      costState: "known",
      valueMinor: 4_000,
      confirmedOn: "2026-10-01",
      sourceNote: "جرد أول المدة",
    },
    note: "مادة فحص الذرية",
    operationKey: "sdf040-atomic-open",
  });
  if (!opened.ok) throw new Error(opened.message);
  /* محفظة حية واحدة حتى يكون لقبض التسليم وجهة — تُنشأ عبر حد الكاش
   * الحقيقي فيكون تخصيصها آخر كتابة في حزمة التسليم. */
  const drawer = createCashWallet({
    id: "sdf040-atomic-drawer",
    name: "درج فحص الذرية",
    kind: "cash_drawer",
    createdAt: NOW,
    createdOperationKey: "sdf040-atomic-drawer-open",
  });
  const walletOpened = await store.commitCashContinuity(drawer, []);
  if (!walletOpened.ok) throw new Error("wallet open failed");
  const drafts = new DraftService(store as never, () => NOW);
  const created = await drafts.create("customer_order");
  if (!created.ok) throw new Error(created.message);
  const saved = await drafts.save({
    ...created.draft,
    customerName: "سارة",
    itemName: "صندوق هدايا",
    specifications: "تغليف فاخر",
    quantity: 1,
  });
  if (!saved.ok) throw new Error(saved.message);
  const costs = new CostService(store as never, () => NOW);
  /* المادة المخططة مرتبطة بالمادة المتتبعة بهويتها — المتبقي للاستهلاك
   * من لقطة التسعير الحية (2 متر مخططة) فتجتاز الصفوفُ تحققَ الحد. */
  const withCost = await costs.saveSnapshot(saved.draft, {
    ...costInput,
    materialItems: [
      {
        name: "قماش قطنية",
        quantity: 2,
        unit: "متر",
        unitPriceMinor: 500,
        confidence: "known",
        materialId: opened.value.material.id,
      },
    ],
  });
  if (!withCost.ok) throw new Error(withCost.message);
  const agreements = new AgreementService(store as never, costs, () => NOW);
  const agreed = await agreements.createFromDraft(withCost.draft, {
    agreedPriceMinor,
    deliveryDate: "2026-11-20",
    depositMinor,
    agreementSource: null,
  });
  if (!agreed.ok) throw new Error(agreed.message);
  await agreements.startExecution(agreed.stored.id);
  const fulfillment = new FulfillmentService(store as never, () => NOW);
  await fulfillment.markReady(agreed.stored.id);
  return { orderId: agreed.stored.id, trackedMaterialId: opened.value.material.id, walletId: drawer.id };
}

/** عدسة فحص الذرية: كل ما يجب ألا يتغير بعد فشل الحزمة. */
async function atomicitySnapshot(store: PrototypeLocalStore, orderId: string) {
  const order = await store.getOrder(orderId);
  if (!order.ok || !order.value) throw new Error("order should exist");
  const movements = await store.listInventoryMovements();
  const cashEntries = await store.listCashContinuityEntries();
  const wallets = await store.listCashWallets();
  return {
    status: order.value.order.status,
    recognizedRevenueMinor: order.value.order.recognizedRevenueMinor,
    collectedMinor: order.value.order.collectedMinor,
    receivableMinor: order.value.order.receivableMinor,
    events: order.value.order.events.length,
    movements: (movements.ok ? movements.value : []).filter(entry => entry.orderId === orderId).length,
    cashEntries: (cashEntries.ok ? cashEntries.value : []).filter(entry => entry.sourceRefId === orderId)
      .length,
    /* المحفظة سجل ثابت الشكل — تخصيصها كله في القيود؛ تُقارن اللقطة كلها. */
    wallets: JSON.stringify(wallets.ok ? wallets.value : []),
  };
}

/** غلاف اختباري بحت: يفوّض كل شيء للمهايئ الحقيقي ويحمّل المحفظة بخاصية
 * غير قابلة للاستنساخ — الفشل ينطلق بعد بدء حزمة الكتابة عند الحد
 * (الطلب/الحركات/القبض اصطفت قبل المحفظة) ولا مفتاح فشل إنتاجي هنا. */
function withPoisonedWallet(store: PrototypeLocalStore): DeliveryReviewServiceStore {
  /* Proxy يفوّض كل شيء للمهايئ الحقيقي (أساليبه على النموذج الأولي) ويحمّل
   * المحفظة وحدها بالخاصية غير القابلة للاستنساخ. */
  return new Proxy(store as unknown as DeliveryReviewServiceStore, {
    get(target, prop: string) {
      if (prop === "commitOrderDelivery")
        return (
          base: never,
          order: never,
          movements: never,
          shortages: never,
          wallet: CashWallet | null,
          cashEntry: never,
        ) =>
          Reflect.apply(target.commitOrderDelivery as unknown as (...args: unknown[]) => unknown, target, [
            base,
            order,
            movements,
            shortages,
            wallet ? ({ ...wallet, uncloneable: () => "poison" } as unknown as CashWallet) : wallet,
            cashEntry,
          ]);
      const value = Reflect.get(target, prop, target) as unknown;
      return typeof value === "function" ? (value as CallableFunction).bind(target) : value;
    },
  });
}

const adapters = [
  ["الذاكرة", () => new MemoryLocalStore()],
  ["IndexedDB", () => new IndexedDbLocalStore()],
] as const;

describe("S12-ATOMIC-001 — فشل حزمة التسليم بعد بدئها عند حد الالتزام يتدحرج كله", () => {
  for (const [label, makeStore] of adapters) {
    it(`${label}: محفظة غير قابلة للاستنساخ في عمق الحزمة — فشل صادق ولا كتابة نصفية`, async () => {
      if (label === "IndexedDB") await clearDatabase();
      const store = makeStore();
      const { orderId, trackedMaterialId, walletId } = await readyOrder(store, 15_000, 5_000);
      const before = await atomicitySnapshot(store, orderId);
      /* محفظة القبض لازمة حتى تكون المحفظة آخر كتابة في الحزمة بعد اصطفاف
       * الطلب والحركات والقبض — فشلها يقع بعد بدء الحزمة فعليًا. */
      const review = new DeliveryReviewService(withPoisonedWallet(store), () => NOW);

      const failed = await review.commitDelivery(orderId, {
        rows: [{ materialId: trackedMaterialId, quantityMilli: 2_000, action: "consume" }],
        finalPriceMinor: null,
        priceRevisionReason: null,
        collectNow: walletId ? { amountMinor: 10_000, walletId } : null,
        operationKey: "sdf040-atomic-poison",
      });

      /* فشل صادق محسوم — لا نصف نجاح ولا مآل يتيم. */
      expect(failed.ok).toBe(false);
      if (failed.ok) throw new Error("unreachable");
      expect(failed.code).toBe("storage_error");
      expect(failed.message).toContain("could not be cloned");

      /* كل مصادر الحزمة كما كانت بالبايت: الحالة والإيراد والقبض والمتبقي
       * والأحداث وحركات المواد وقيد الكاش وتخصيص المحفظة. */
      const after = await atomicitySnapshot(store, orderId);
      expect(after).toEqual(before);
      expect(after.status).toBe("ready");
      expect(after.recognizedRevenueMinor).toBe(0);
      expect(after.movements).toBe(0);
      expect(after.cashEntries).toBe(0);
    });
  }

  it("الذاكرة: الاستنساخ المسبق للحزمة كلها يمنع الكتابة النصفية حتى داخل التسلسل", async () => {
    /* نفس الحقنة على الذاكرة تثبت الإصلاح الجذري: الاستنساخ الكامل قبل أول
     * set — فشل المحفظة لا يترك طلبًا مسلمًا ولا حركات يتيمة خلفه. */
    const store = new MemoryLocalStore();
    const { orderId, trackedMaterialId, walletId } = await readyOrder(store, 15_000, 5_000);
    const before = await atomicitySnapshot(store, orderId);
    const review = new DeliveryReviewService(withPoisonedWallet(store), () => NOW);
    const failed = await review.commitDelivery(orderId, {
      rows: [{ materialId: trackedMaterialId, quantityMilli: 2_000, action: "consume" }],
      finalPriceMinor: null,
      priceRevisionReason: null,
      collectNow: walletId ? { amountMinor: 10_000, walletId } : null,
      operationKey: "sdf040-atomic-poison-memory",
    });
    expect(failed.ok).toBe(false);
    const after = await atomicitySnapshot(store, orderId);
    expect(after).toEqual(before);
  });
});
