/**
 * Wave 4C (بطاقة RC-7): عقد قدرة «دورة حياة الطلب» — القدرة الطيار
 * لاستخراج قدرات التخزين. ثلاث طبقات إثبات، بلا أي تعديل إنتاج:
 *
 *  1) العضوية: المحوّلان يكشفان طرق القدرة التسع كلها كدوال — والقائمة
 *     نفسها محكومة النوع (Pick من الواجهة التوافقية) فلا تزد ولا تنقص
 *     بصمت.
 *  2) السلوك عبر عدسة القدرة: نفس عقود الكتابة المحروسة للمحوّلين
 *     (الذاكرة وIndexedDB/fake-indexeddb) — إنشاء وقراءة، إعادة تشغيل
 *     حتمية = إعادة استخدام صادقة لا تكرارًا، قاعدة قديمة = رفض
 *     storage_stale بلا كتابة، وقراءة مرجعة تُثبت النتيجة. السيناريو
 *     يستقبل النوع الضيق `OrderLifecycleStore` حصرًا — أي ما يستطيع
 *     مستهلك القدرة ملاحظته، لا أكثر؛ الآثار العابرة للحدود (حركات
 *     المخزون وقيود الكاش) تبقى محروسة في مصفوفة المطابقة الكاملة
 *     (adapterConformance.group10.test.ts).
 *  3) الأنواع: tsc على ملف المراسي زمن التشغيل — إثبات أن المحوّلين
 *     والواجهة التوافقية ما زالوا يحققون القدرة (نمط Wave 3B).
 */
import "fake-indexeddb/auto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  calculateCostSnapshot,
  cancelOrder,
  collectDeposit,
  collectRemaining,
  createCraftOrder,
  reverseDelivery,
  reverseOrderCollection,
  settleDepositRefund,
  transitionOrder,
} from "@micro-domain/craft-order/index.js";
import { createInventoryMovement } from "@micro-domain/inventory-material/index.js";
import { IndexedDbLocalStore } from "../IndexedDbLocalStore";
import { MemoryLocalStore } from "../MemoryLocalStore";
import type { OrderDraft, StoredCraftOrder } from "../types";
import { orderLifecycleStoreMethods, type OrderLifecycleStore } from "./orderLifecycleStore";

const databaseName = "micro-prototype-local";
function clearDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

const TS = "2026-09-08T09:00:00.000Z";

function snapshot(id: string) {
  return calculateCostSnapshot(id, {
    currency: "JOD",
    materialItems: [],
    time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
    packagingMinor: 0,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 1,
    createdAt: TS,
    source: "draft",
  });
}

function storedOrder(id: string): StoredCraftOrder {
  return {
    id,
    order: createCraftOrder({
      id,
      customerName: "سارة",
      itemName: "صندوق",
      specifications: "نقش",
      quantity: 1,
      agreedPriceMinor: 5000,
      costSnapshot: snapshot(`snap-${id}`),
      createdAt: TS,
    }),
    catalogItemId: null,
    deliveryDate: "2026-09-12",
    agreementSource: null,
    createdAt: TS,
    updatedAt: TS,
  };
}

function advancedStored(id: string, to: "ready" | "delivered"): StoredCraftOrder {
  let order = storedOrder(id).order;
  const chain = [
    ["provisional_agreement", `${id}:agree`],
    ["confirmed", `${id}:confirm`],
    ["in_progress", `${id}:start`],
    ["ready", `${id}:ready`],
    ...(to === "delivered" ? ([["delivered", `${id}:deliver`]] as const) : []),
  ] as const;
  for (const [target, key] of chain) {
    order = transitionOrder(order, { to: target, idempotencyKey: key, createdAt: TS });
  }
  return { ...storedOrder(id), order, updatedAt: TS };
}

function collectedStored(id: string): StoredCraftOrder {
  const delivered = advancedStored(id, "delivered").order;
  const collected = collectRemaining(delivered, 5000, `${id}:collect`, TS);
  return { ...storedOrder(id), order: collected, updatedAt: TS };
}

function pendingDepositStored(id: string): StoredCraftOrder {
  let order = storedOrder(id).order;
  order = collectDeposit(order, 2000, `${id}:dep`, TS);
  order = cancelOrder(order, "إلغاء", `${id}:cancel`, TS);
  return { ...storedOrder(id), order, updatedAt: TS };
}

function linkedDraft(orderId: string): OrderDraft {
  return {
    id: `draft-${orderId}`,
    intent: "customer_order",
    customerName: "سارة",
    itemName: "صندوق",
    specifications: "نقش",
    quantity: 1,
    costSnapshots: [],
    activeCostSnapshotId: null,
    linkedOrderId: orderId,
    createdAt: TS,
    updatedAt: TS,
  };
}

function deliveryConsumption(stored: StoredCraftOrder) {
  const deliveryEventId = [...stored.order.events]
    .reverse()
    .find(event => event.type === "status_changed" && event.toStatus === "delivered")!.id;
  return createInventoryMovement({
    id: `mv-${stored.id}-deliver`,
    materialId: "mat-1",
    type: "consumption",
    occurredOn: "2026-09-08",
    recordedAt: TS,
    quantityDeltaMilli: -2000,
    valueDeltaMinor: -1000,
    note: `استهلاك تسليم الطلب ${stored.id}`,
    operationKey: `${stored.id}:deliver:${deliveryEventId}:mat-1`,
    orderId: stored.id,
    costKnowledge: "known",
  });
}

async function getOrderValue(store: OrderLifecycleStore, id: string): Promise<StoredCraftOrder | null> {
  const result = await store.getOrder(id);
  if (!result.ok) throw new Error(result.message);
  return result.value;
}

async function runOrderLifecycleCapabilityContracts(store: OrderLifecycleStore): Promise<void> {
  /* ١. الإنشاء والقراءة: saveOrder → getOrder دورة كاملة؛ المجهول null؛
   *    listOrders يرى السجل. (saveOrder للإنشاء والبذور فقط — عقد G-003.) */
  const base = advancedStored("cap-1", "ready");
  const saved = await store.saveOrder(base);
  expect(saved.ok).toBe(true);
  expect((await getOrderValue(store, "cap-1"))?.order.customerName).toBe("سارة");
  expect(await getOrderValue(store, "cap-unknown")).toBeNull();
  const listed = await store.listOrders();
  expect(listed.ok).toBe(true);
  if (listed.ok) expect(listed.value.some(stored => stored.id === "cap-1")).toBe(true);

  /* ٢. commitOrderUpdate: إلحاق حدث موثق؛ إعادة التشغيل بالمفتاح نفسه
   *    إعادة استخدام صادقة؛ القاعدة القديمة ترفض storage_stale بلا كتابة. */
  const withDeliveryEvent = advancedStored("cap-1", "delivered");
  const committed = await store.commitOrderUpdate(base, withDeliveryEvent, ["cap-1:deliver"]);
  expect(committed.ok).toBe(true);
  if (committed.ok) expect(committed.value.reused).toBe(false);
  const replay = await store.commitOrderUpdate(base, withDeliveryEvent, ["cap-1:deliver"]);
  expect(replay.ok).toBe(true);
  if (replay.ok) expect(replay.value.reused).toBe(true);
  expect(
    (await getOrderValue(store, "cap-1"))!.order.events.filter(event => event.type === "status_changed"),
  ).toHaveLength(5);
  const stale = await store.commitOrderUpdate(base, advancedStored("cap-1", "delivered"), [
    "cap-1:another-path",
  ]);
  expect(stale.ok).toBe(false);
  if (!stale.ok) expect(stale.code).toBe("storage_stale");

  /* ٣. commitOrderFromDraft: الطلب ومسودته المرتبطة معًا؛ إعادة التشغيل
   *    بالمحتوى الحتمي نفسه لا تكرر الأثر (كتابة مطابقة لا تراكم) — العقد
   *    المرصود عبر عدسة القدرة: نجاح مستقر وقراءة مرجعة بلا تضاعف أحداث. */
  const fromDraftOrder = storedOrder("cap-2");
  const fromDraft = await store.commitOrderFromDraft(fromDraftOrder, linkedDraft("cap-2"));
  expect(fromDraft.ok).toBe(true);
  const fromDraftReplay = await store.commitOrderFromDraft(fromDraftOrder, linkedDraft("cap-2"));
  expect(fromDraftReplay.ok).toBe(true);
  const rereadFromDraft = (await getOrderValue(store, "cap-2"))!;
  expect(rereadFromDraft.order.itemName).toBe("صندوق");
  expect(rereadFromDraft.order.events).toHaveLength(1);

  /* ٤. commitOrderDelivery: التسليم الذرّي ثم إعادة التشغيل بالمفتاح نفسه. */
  const deliveryReady = advancedStored("cap-3", "ready");
  await store.saveOrder(deliveryReady);
  const delivered = advancedStored("cap-3", "delivered");
  const movement = deliveryConsumption(delivered);
  const delivery = await store.commitOrderDelivery(deliveryReady, delivered, [movement], [], null, null);
  expect(delivery.ok).toBe(true);
  if (delivery.ok) expect(delivery.value.reused).toBe(false);
  const deliveryReplay = await store.commitOrderDelivery(
    deliveryReady,
    delivered,
    [movement],
    [],
    null,
    null,
  );
  expect(deliveryReplay.ok).toBe(true);
  if (deliveryReplay.ok) expect(deliveryReplay.value.reused).toBe(true);
  expect((await getOrderValue(store, "cap-3"))!.order.status).toBe("delivered");

  /* ٥. commitOrderDeliveryReversal: عكس التسليم ثم إعادة التشغيل. */
  const storedAfterDelivery = (await getOrderValue(store, "cap-3"))!;
  const reversed = reverseDelivery(storedAfterDelivery.order, {
    reason: "سُلّم للزبون الخطأ",
    idempotencyKey: "cap-3:rev",
    createdAt: TS,
  });
  const mirror = createInventoryMovement({
    id: `delivery-reversal-${movement.id}`,
    materialId: movement.materialId,
    type: "reversal",
    occurredOn: "2026-09-08",
    recordedAt: TS,
    quantityDeltaMilli: -movement.quantityDeltaMilli,
    valueDeltaMinor: -movement.valueDeltaMinor,
    note: "مرآة التراجع",
    reason: "عكس التسليم",
    operationKey: `${movement.operationKey}:reversal`,
    reversesMovementId: movement.id,
    costKnowledge: "known",
  });
  const reversal = await store.commitOrderDeliveryReversal({ ...storedAfterDelivery, order: reversed }, [
    mirror,
  ]);
  expect(reversal.ok).toBe(true);
  const reversalReplay = await store.commitOrderDeliveryReversal(
    { ...storedAfterDelivery, order: reversed },
    [mirror],
  );
  expect(reversalReplay.ok).toBe(true);
  if (reversalReplay.ok) expect(reversalReplay.value.reused).toBe(true);
  expect((await getOrderValue(store, "cap-3"))!.order.status).toBe("needs_review");

  /* ٦. commitOrderCollectionReversal: تراجع القبضة ثم إعادة التشغيل. */
  const collected = collectedStored("cap-4");
  await store.saveOrder(collected);
  const collectionEvent = collected.order.events.find(event => event.type === "collection_recorded")!;
  const afterCollectionReversal = reverseOrderCollection(collected.order, {
    collectionEventId: collectionEvent.id,
    amountMinor: 5000,
    reason: "خطأ قبض",
    idempotencyKey: "cap-4:collrev",
    createdAt: TS,
  });
  const collectionReversal = await store.commitOrderCollectionReversal(
    { ...collected, order: afterCollectionReversal, updatedAt: TS },
    null,
    "cap-4:collrev",
  );
  expect(collectionReversal.ok).toBe(true);
  const collectionReversalReplay = await store.commitOrderCollectionReversal(
    { ...collected, order: afterCollectionReversal, updatedAt: TS },
    null,
    "cap-4:collrev",
  );
  expect(collectionReversalReplay.ok).toBe(true);
  if (collectionReversalReplay.ok) expect(collectionReversalReplay.value.reused).toBe(true);
  expect(
    (await getOrderValue(store, "cap-4"))!.order.events.filter(event => event.type === "collection_reversed"),
  ).toHaveLength(1);

  /* ٧. commitDepositRefundSettlement: رد العربون المعلق بعد الإلغاء ثم
   *    إعادة التشغيل. */
  const pending = pendingDepositStored("cap-5");
  await store.saveOrder(pending);
  const refunded = settleDepositRefund(pending.order, 2000, "رد العربون", "cap-5:refund", TS);
  const refundCommit = await store.commitDepositRefundSettlement(
    { ...pending, order: refunded, updatedAt: TS },
    [],
    "cap-5:refund",
  );
  expect(refundCommit.ok).toBe(true);
  const refundReplay = await store.commitDepositRefundSettlement(
    { ...pending, order: refunded, updatedAt: TS },
    [],
    "cap-5:refund",
  );
  expect(refundReplay.ok).toBe(true);
  if (refundReplay.ok) expect(refundReplay.value.reused).toBe(true);
  expect(
    (await getOrderValue(store, "cap-5"))!.order.events.filter(event => event.type === "deposit_refunded"),
  ).toHaveLength(1);
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../../../../../../");
const ANCHORS_FILE = path.join(HERE, "orderLifecycleCapabilityAnchors.ts");
const APP_TSCONFIG = path.join(REPO_ROOT, "apps", "prototype-web", "tsconfig.json");

describe("Wave 4C — order lifecycle capability: membership (both adapters)", () => {
  it("the capability method list is exactly the pilot scope: 9 unique names", () => {
    expect(orderLifecycleStoreMethods).toHaveLength(9);
    expect(new Set(orderLifecycleStoreMethods).size).toBe(9);
  });

  for (const [label, makeStore] of [
    ["MemoryLocalStore", () => new MemoryLocalStore()],
    ["IndexedDbLocalStore", () => new IndexedDbLocalStore()],
  ] as const) {
    it(`${label} exposes every capability method as a function`, async () => {
      const store = makeStore();
      for (const method of orderLifecycleStoreMethods) {
        expect(
          typeof (store as unknown as Record<string, unknown>)[method],
          `${label}: طريقة القدرة مفقودة: ${method}`,
        ).toBe("function");
      }
    });
  }
});

describe("Wave 4C — order lifecycle capability: behavioral contracts (both adapters)", () => {
  it("MemoryLocalStore satisfies the guarded order lifecycle contracts through the capability lens", async () => {
    await runOrderLifecycleCapabilityContracts(new MemoryLocalStore());
  });

  it("IndexedDbLocalStore (fake-indexeddb) satisfies the same contracts through the capability lens", async () => {
    await clearDatabase();
    try {
      await runOrderLifecycleCapabilityContracts(new IndexedDbLocalStore());
    } finally {
      await clearDatabase();
    }
  });
});

describe("Wave 4C — order lifecycle capability: type layer", () => {
  it(
    "both adapters and the compatibility facade still satisfy the capability (tsc on the anchors file)",
    { timeout: 120_000 },
    () => {
      /* ملفات الاختبار مستثناة من فحص أنواع الـapp — لذا يُفرض هنا فحص المراسي
       * وحدها بامتداد tsconfig الـapp نفسه (نمط مراسي Wave 3B). أي كسر
       * للتحقيق (توقيع/إسقاط implements/انحراف الواجهة) يفشل هنا فورًا. */
      const tmp = mkdtempSync(path.join(tmpdir(), "micro-capability-"));
      try {
        const tmpConfig = path.join(tmp, "tsconfig.capability.json");
        writeFileSync(
          tmpConfig,
          JSON.stringify({
            extends: APP_TSCONFIG,
            include: [ANCHORS_FILE],
            exclude: [],
            compilerOptions: { types: [] },
          }),
          "utf8",
        );
        const tscEntry = path.join(REPO_ROOT, "node_modules", "typescript", "bin", "tsc");
        let output = "";
        try {
          output = execFileSync(process.execPath, [tscEntry, "--noEmit", "--project", tmpConfig], {
            cwd: REPO_ROOT,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
          });
        } catch (error) {
          const err = error as { stdout?: string; stderr?: string };
          throw new Error(
            `كسر تحقيق قدرة دورة حياة الطلب — راجع orderLifecycleCapabilityAnchors.ts وواجهة القدرة:\n${
              err.stdout ?? err.stderr ?? "لا مخرجات"
            }`,
          );
        }
        expect(output).toBe("");
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
    },
  );
});

afterEach(async () => {
  await clearDatabase();
});
