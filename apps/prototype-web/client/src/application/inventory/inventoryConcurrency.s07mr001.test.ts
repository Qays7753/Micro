import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { IndexedDbLocalStore } from "@/storage/local/IndexedDbLocalStore";
import type { PrototypeLocalStore } from "@/storage/local/types";
import { InventoryMaterialService } from "./inventoryMaterialService";
import { createSupplierPurchase } from "@micro-domain/supplier-purchase/index.js";
import type { SupplierPurchaseLine } from "@micro-domain/supplier-purchase/index.js";
import { summarizeMaterialInventory } from "@micro-domain/inventory-material/index.js";
import { INVENTORY_STATE_CHANGED_MESSAGE } from "@/storage/local/inventoryCommitGuard";

/* S07-MR-001 (أمر S08 — القسم ١): الدليل الدائم على الإصلاح الجذري لعيب
 * القراءة-ثم-الكتابة في المخزون — كل رحلة هنا على المسار التطبيقي الحقيقي
 * (الخدمة فوق المهايئ الحقيقي) لا على تقريب mock: نيتا استلام متزامنتان
 * تقرآن الحالة نفسها فتجتاز كلتاهما حد الشراء نظريًا — واحدة فقط تلتزم،
 * والخاسرة تعود بstorage_stale صادق بلا أي كتابة جزئية (لا حركة ولا كمية
 * ولا نقص ولا أثر مالي)، والمخزون لا يتجاوز الحد أبدًا، والسالب لا يولد،
 * والمفتاح المتطابق ماليًا يُعاد بأمانة، والمختلف يتعارض بلا استبدال، وكل
 * عائلات الكتابة القائمة (استهلاك/ضبط/هدر/نقص/تراجع/دورة حياة) متكافئة
 * على المهايئين، والعملية الصالحة غير المتعارضة تنجح، والتعافي بعد الفشل
 * يمر عبر الحالة الحية لا حولها. */

const NOW = "2026-10-30T10:00:00.000Z";
const DATABASE_NAME = "micro-prototype-local";

function clearDatabase(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

type StoreFactory = () => Promise<PrototypeLocalStore> | PrototypeLocalStore;

const adapters: ReadonlyArray<{ readonly label: string; readonly make: StoreFactory }> = [
  { label: "Memory", make: () => new MemoryLocalStore() },
  {
    label: "IndexedDB",
    make: async () => {
      await clearDatabase();
      return new IndexedDbLocalStore();
    },
  },
];

const clock = () => NOW;

async function seedTrackedMaterial(store: PrototypeLocalStore, materialId: string) {
  const inventory = new InventoryMaterialService(store, clock);
  const opened = await inventory.openMaterial({
    name: "خشب زان",
    unit: "piece",
    tracking: "tracked",
    opening: {
      quantityState: "confirmed",
      quantityMilli: 0,
      costState: "unknown",
      valueMinor: null,
      confirmedOn: "2026-10-01",
      sourceNote: null,
    },
    note: "افتتاح",
    operationKey: `${materialId}-open`,
  });
  if (!opened.ok) throw new Error(opened.message ?? "material should open");
  return opened.value.material;
}

async function seedPurchase(
  store: PrototypeLocalStore,
  purchaseId: string,
  totalMinor: number,
  lines?: readonly SupplierPurchaseLine[],
) {
  const purchase = createSupplierPurchase({
    id: purchaseId,
    supplierName: "المورد",
    note: "ألواح",
    purchasedOn: "2026-10-20",
    dueOn: null,
    totalMinor,
    initialPaidMinor: 0,
    recordedAt: NOW,
    idempotencyKey: purchaseId,
    ...(lines ? { lines } : {}),
  });
  const saved = await store.saveSupplierPurchase(purchase);
  if (!saved.ok) throw new Error("purchase should save");
  return purchase;
}

async function movementsOf(store: PrototypeLocalStore) {
  const result = await store.listInventoryMovements();
  if (!result.ok) throw new Error("movements should list");
  return result.value;
}

async function shortagesOf(store: PrototypeLocalStore) {
  const result = await store.listInventoryShortages();
  if (!result.ok) throw new Error("shortages should list");
  return result.value;
}

async function eventsOf(store: PrototypeLocalStore) {
  const result = await store.listFinancialEvents();
  if (!result.ok) throw new Error("events should list");
  return result.value;
}

describe.each(adapters)("S07-MR-001 inventory write-boundary CAS ($label)", ({ make }) => {
  afterEach(async () => {
    await clearDatabase();
  });

  it("two concurrent receipts over the purchase bound: exactly one commits; the loser is stale with zero partial write", async () => {
    const store = await make();
    const material = await seedTrackedMaterial(store, "wood");
    await seedPurchase(store, "purchase-race", 3000);
    const service = new InventoryMaterialService(store, clock);
    /* نيتا استلام متزامنتان — كلتاهما تقرأ «لا إيصالات بعد» فتجتاز الحد
     * نظريًا (2500 ≤ 3000)؛ الحارس داخل حد الكتابة يُسقط الثانية. */
    const [first, second] = await Promise.all([
      service.receivePurchase({
        materialId: material.id,
        purchaseId: "purchase-race",
        quantityMilli: 10000,
        valueMinor: 2500,
        occurredOn: "2026-10-21",
        note: "استلام أول",
        operationKey: "receipt-race-1",
      }),
      service.receivePurchase({
        materialId: material.id,
        purchaseId: "purchase-race",
        quantityMilli: 10000,
        valueMinor: 2500,
        occurredOn: "2026-10-21",
        note: "استلام ثانٍ",
        operationKey: "receipt-race-2",
      }),
    ]);
    const results = [first, second];
    const winners = results.filter(result => result.ok);
    const losers = results.filter(result => !result.ok);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect(losers[0]).toMatchObject({
      ok: false,
      code: "storage_stale",
      message: INVENTORY_STATE_CHANGED_MESSAGE,
    });
    /* لا كتابة جزئية للخاسر: حركة واحدة فقط، والاستلام لا يتجاوز حد الشراء. */
    const movements = await movementsOf(store);
    const receipts = movements.filter(movement => movement.type === "purchase_receipt");
    expect(receipts).toHaveLength(1);
    const receivedTotal = receipts.reduce((sum, movement) => sum + movement.valueDeltaMinor, 0);
    expect(receivedTotal).toBeLessThanOrEqual(3000);
    expect(receivedTotal).toBe(2500);
    /* لا أثر مالي جانبي ولا نقص من عملية الاستلام إطلاقًا. */
    expect((await eventsOf(store)).filter(event => event.idempotencyKey.includes("receipt"))).toHaveLength(0);
    expect(await shortagesOf(store)).toHaveLength(0);
    /* المخزون نفسه يطابق الإيصال الوحيد. */
    const position = summarizeMaterialInventory(material.id, movements);
    expect(position.quantityMilli).toBe(10000);
    expect(position.valueMinor).toBe(2500);
  });

  it("two concurrent receipts over a purchase LINE bound: the line bound holds inside the write boundary", async () => {
    const store = await make();
    const material = await seedTrackedMaterial(store, "cloth");
    const lines: readonly SupplierPurchaseLine[] = [
      {
        lineId: "line-1",
        materialId: material.id,
        expectedQuantityMilli: 5000,
        valueMinor: 2000,
        costKnowledge: "known",
        treatment: "tracked_material",
      },
    ];
    await seedPurchase(store, "purchase-lines", 2000, lines);
    const service = new InventoryMaterialService(store, clock);
    const [first, second] = await Promise.all([
      service.receivePurchase({
        materialId: material.id,
        purchaseId: "purchase-lines",
        purchaseLineId: "line-1",
        quantityMilli: 4000,
        valueMinor: 1500,
        occurredOn: "2026-10-22",
        note: "بند أول",
        operationKey: "line-race-1",
      }),
      service.receivePurchase({
        materialId: material.id,
        purchaseId: "purchase-lines",
        purchaseLineId: "line-1",
        quantityMilli: 4000,
        valueMinor: 1500,
        occurredOn: "2026-10-22",
        note: "بند ثانٍ",
        operationKey: "line-race-2",
      }),
    ]);
    const winners = [first, second].filter(result => result.ok);
    expect(winners).toHaveLength(1);
    const receipts = (await movementsOf(store)).filter(movement => movement.type === "purchase_receipt");
    expect(receipts).toHaveLength(1);
    expect(receipts[0]!.valueDeltaMinor).toBeLessThanOrEqual(2000);
    /* الحد الحي بعد السباق: الكمية المستلمة لا تتجاوز متوقع البند. */
    const lineReceivedQuantity = receipts.reduce((sum, movement) => sum + movement.quantityDeltaMilli, 0);
    expect(lineReceivedQuantity).toBeLessThanOrEqual(5000);
  });

  it("same-key replay after success is an honest reuse; same key with a different financial payload conflicts without overwrite", async () => {
    const store = await make();
    const material = await seedTrackedMaterial(store, "paint");
    await seedPurchase(store, "purchase-idem", 5000);
    const service = new InventoryMaterialService(store, clock);
    const first = await service.receivePurchase({
      materialId: material.id,
      purchaseId: "purchase-idem",
      quantityMilli: 3000,
      valueMinor: 2000,
      occurredOn: "2026-10-23",
      note: "الأصل",
      operationKey: "receipt-idem",
    });
    if (!first.ok) throw new Error(first.message);
    /* نفس المفتاح ونفس الحملة المالية (النص العرضي وحده اختلف) — إعادة
     * استخدام صادقة للحركة المخزنة، لا ثانية تُكتب. */
    const replay = await service.receivePurchase({
      materialId: material.id,
      purchaseId: "purchase-idem",
      quantityMilli: 3000,
      valueMinor: 2000,
      occurredOn: "2026-10-23",
      note: "إعادة إرسال بنص مختلف",
      operationKey: "receipt-idem",
    });
    expect(replay).toMatchObject({ ok: true, reused: true, value: { id: first.value.id } });
    expect(
      (await movementsOf(store)).filter(movement => movement.operationKey === "receipt-idem"),
    ).toHaveLength(1);
    /* نفس المفتاح بحملة مالية مختلفة في نافذة متزامنة — تعارض داخل الحد
     * بلا استبدال ولا ازدواج. */
    const [conflictWinner, conflictLoser] = await Promise.all([
      service.receivePurchase({
        materialId: material.id,
        purchaseId: "purchase-idem",
        quantityMilli: 1000,
        valueMinor: 1000,
        occurredOn: "2026-10-24",
        note: "نية أولى",
        operationKey: "receipt-conflict",
      }),
      service.receivePurchase({
        materialId: material.id,
        purchaseId: "purchase-idem",
        quantityMilli: 1000,
        valueMinor: 3000,
        occurredOn: "2026-10-24",
        note: "نية مختلفة بنفس المفتاح",
        operationKey: "receipt-conflict",
      }),
    ]);
    const winners = [conflictWinner, conflictLoser].filter(result => result.ok);
    expect(winners).toHaveLength(1);
    expect(
      (await movementsOf(store)).filter(movement => movement.operationKey === "receipt-conflict"),
    ).toHaveLength(1);
  });

  it("concurrent consumption cannot create negative stock; a valid non-conflicting operation still succeeds", async () => {
    const store = await make();
    const inventory = new InventoryMaterialService(store, clock);
    const opened = await inventory.openMaterial({
      name: "خيط",
      unit: "meter",
      tracking: "tracked",
      opening: {
        quantityState: "confirmed",
        quantityMilli: 10000,
        costState: "known",
        valueMinor: 5000,
        confirmedOn: "2026-10-01",
        sourceNote: null,
      },
      note: "افتتاح",
      operationKey: "thread-open",
    });
    if (!opened.ok) throw new Error(opened.message);
    const materialId = opened.value.material.id;
    const [first, second] = await Promise.all([
      inventory.consume({
        materialId,
        orderId: null,
        reason: "استهلاك متزامن أول",
        quantityMilli: 8000,
        occurredOn: "2026-10-25",
        note: "أول",
        operationKey: "consume-race-1",
      }),
      inventory.consume({
        materialId,
        orderId: null,
        reason: "استهلاك متزامن ثانٍ",
        quantityMilli: 8000,
        occurredOn: "2026-10-25",
        note: "ثانٍ",
        operationKey: "consume-race-2",
      }),
    ]);
    expect([first, second].filter(result => result.ok)).toHaveLength(1);
    const movements = await movementsOf(store);
    /* لا رصيد سالب أبدًا — الرصيد الحي 2000 بعد استهلاك واحد فقط. */
    const position = summarizeMaterialInventory(materialId, movements);
    expect(position.quantityMilli).toBe(2000);
    expect(position.quantityMilli).toBeGreaterThanOrEqual(0);
    /* عملية صالحة غير متعارضة (2000 المتبقية كلها) تنجح فوق الواقع الحي. */
    const valid = await inventory.consume({
      materialId,
      orderId: null,
      reason: "استهلاك المتبقي",
      quantityMilli: 2000,
      occurredOn: "2026-10-26",
      note: "المتبقي",
      operationKey: "consume-valid",
    });
    expect(valid).toMatchObject({ ok: true });
    /* والتجاوز فوق الواقع الحي يُرفض برسالة الأعمال الصادقة لا بتعارض. */
    const over = await inventory.consume({
      materialId,
      orderId: null,
      reason: "تجاوز",
      quantityMilli: 1,
      occurredOn: "2026-10-26",
      note: "فوق الصفر",
      operationKey: "consume-over",
    });
    expect(over).toMatchObject({ ok: false, code: "validation_error" });
  });

  it("concurrent waste with profit impact: one movement and one loss event exactly; the loser writes neither", async () => {
    const store = await make();
    const inventory = new InventoryMaterialService(store, clock);
    const opened = await inventory.openMaterial({
      name: "إسفنج",
      unit: "piece",
      tracking: "tracked",
      opening: {
        quantityState: "confirmed",
        quantityMilli: 6000,
        costState: "known",
        valueMinor: 6000,
        confirmedOn: "2026-10-01",
        sourceNote: null,
      },
      note: "افتتاح",
      operationKey: "sponge-open",
    });
    if (!opened.ok) throw new Error(opened.message);
    const materialId = opened.value.material.id;
    const [first, second] = await Promise.all([
      inventory.waste({
        materialId,
        quantityMilli: 5000,
        occurredOn: "2026-10-27",
        note: "هدر متزامن",
        reason: "تلف",
        operationKey: "waste-race-1",
        profitImpact: true,
      }),
      inventory.waste({
        materialId,
        quantityMilli: 5000,
        occurredOn: "2026-10-27",
        note: "هدر متزامن",
        reason: "تلف",
        operationKey: "waste-race-2",
        profitImpact: true,
      }),
    ]);
    expect([first, second].filter(result => result.ok)).toHaveLength(1);
    const movements = await movementsOf(store);
    expect(movements.filter(movement => movement.type === "waste")).toHaveLength(1);
    /* حدث خسارة واحد لا اثنان — ولا حدث للخاسر إطلاقًا. */
    const lossEvents = (await eventsOf(store)).filter(event => event.type === "loss_non_cash");
    expect(lossEvents).toHaveLength(1);
    expect(lossEvents[0]!.amountMinor).toBe(5000);
  });

  it("concurrent shortage records and concurrent resolutions keep the shortage ledger single-entry and CAS-guarded", async () => {
    const store = await make();
    const inventory = new InventoryMaterialService(store, clock);
    const opened = await inventory.openMaterial({
      name: "غراء",
      unit: "liter",
      tracking: "tracked",
      opening: {
        quantityState: "confirmed",
        quantityMilli: 1000,
        costState: "known",
        valueMinor: 4000,
        confirmedOn: "2026-10-01",
        sourceNote: null,
      },
      note: "افتتاح",
      operationKey: "glue-open",
    });
    if (!opened.ok) throw new Error(opened.message);
    const materialId = opened.value.material.id;
    /* نقتطع المتاح أولًا (استهلاك كامل) ثم نسجل نقصين متزامنين. */
    const consumed = await inventory.consume({
      materialId,
      orderId: null,
      reason: "تفريغ",
      quantityMilli: 1000,
      occurredOn: "2026-10-27",
      note: "كل المتاح",
      operationKey: "glue-drain",
    });
    if (!consumed.ok) throw new Error(consumed.message);
    const [firstShortage, secondShortage] = await Promise.all([
      inventory.recordShortage({
        materialId,
        requestedQuantityMilli: 9000,
        orderId: null,
        occurredOn: "2026-10-27",
        note: "نقص متزامن",
        operationKey: "shortage-race-1",
      }),
      inventory.recordShortage({
        materialId,
        requestedQuantityMilli: 9000,
        orderId: null,
        occurredOn: "2026-10-27",
        note: "نقص متزامن",
        operationKey: "shortage-race-2",
      }),
    ]);
    expect([firstShortage, secondShortage].filter(result => result.ok)).toHaveLength(1);
    expect(await shortagesOf(store)).toHaveLength(1);
    /* حلّان متزامنان للسجل الوحيد: أحدهما يلتزم والآخر تعارض CAS —
     * والسجل النهائي محلول مرة واحدة. */
    const shortage = (await shortagesOf(store))[0]!;
    const [firstResolve, secondResolve] = await Promise.all([
      inventory.resolveShortage({
        shortageId: shortage.id,
        resolutionNote: "وصل بديل",
        resolvedOn: "2026-10-28",
      }),
      inventory.resolveShortage({
        shortageId: shortage.id,
        resolutionNote: "وصل بديل",
        resolvedOn: "2026-10-28",
      }),
    ]);
    expect([firstResolve, secondResolve].filter(result => result.ok)).toHaveLength(1);
    const finalShortage = (await shortagesOf(store))[0]!;
    expect(finalShortage.status).toBe("resolved");
  });

  it("material lifecycle writes are CAS-guarded: a concurrent record change drops the stale writer, and reversal cannot double-land", async () => {
    const store = await make();
    const inventory = new InventoryMaterialService(store, clock);
    const opened = await inventory.openMaterial({
      name: "خرز",
      unit: "piece",
      tracking: "tracked",
      opening: {
        quantityState: "confirmed",
        quantityMilli: 4000,
        costState: "known",
        valueMinor: 8000,
        confirmedOn: "2026-10-01",
        sourceNote: null,
      },
      note: "افتتاح",
      operationKey: "bead-open",
    });
    if (!opened.ok) throw new Error(opened.message);
    const materialId = opened.value.material.id;
    /* إيقاف متابعة متزامن مع تأكيد رصيد على السجل نفسه — كاتبان فوق
     * القراءة نفسها؛ واحد فقط يلتزم والآخر تعارض بلا دمج صامت. */
    const [untrack, confirm] = await Promise.all([
      inventory.untrackMaterial({ materialId, reason: "لا نتابعها", operationKey: "bead-untrack" }),
      inventory.confirmMaterialOpening({
        materialId,
        actualQuantityMilli: 5000,
        costKnown: false,
        valueMinor: null,
        occurredOn: "2026-10-28",
        note: "عدّ فعلي",
        sourceNote: null,
        operationKey: "bead-confirm",
      }),
    ]);
    const winners = [untrack, confirm].filter(result => result.ok);
    expect(winners).toHaveLength(1);
    const materialsResult = await store.listMaterials();
    if (!materialsResult.ok) throw new Error("materials should list");
    const material = materialsResult.value.find(candidate => candidate.id === materialId)!;
    /* السجل متسق مع الفائز وحده: إن فاز إيقاف المتابعة بقي رصيد البداية
     * كما كان (4000) ولم تصل حركة تسوية العدّ؛ وإن فاز تأكيد الرصيد صار
     * الرصيد المؤكد 5000 بحركة تسوية واحدة — لا دمج صامت للكاتبين. */
    const untracked = material.tracking?.status === "untracked";
    if (untracked) {
      expect(material.opening?.quantityMilli).toBe(4000);
    } else {
      expect(material.opening?.quantityState).toBe("confirmed");
      expect(material.opening?.quantityMilli).toBe(5000);
    }
    const adjustmentCount = (await movementsOf(store)).filter(
      candidate => candidate.materialId === materialId && candidate.type === "adjustment",
    ).length;
    expect(adjustmentCount).toBe(untracked ? 0 : 1);
    /* تراجع مزدوج متزامن عن الحركة الأولى: أحدهما فقط يعكس. */
    const movement = (await movementsOf(store)).find(candidate => candidate.type === "opening")!;
    const [firstReverse, secondReverse] = await Promise.all([
      inventory.reverse({
        movementId: movement.id,
        occurredOn: "2026-10-29",
        reason: "خطأ إدخال",
        operationKey: "bead-reverse-1",
      }),
      inventory.reverse({
        movementId: movement.id,
        occurredOn: "2026-10-29",
        reason: "خطأ إدخال",
        operationKey: "bead-reverse-2",
      }),
    ]);
    expect([firstReverse, secondReverse].filter(result => result.ok)).toHaveLength(1);
    const reversals = (await movementsOf(store)).filter(
      candidate => candidate.reversesMovementId === movement.id,
    );
    expect(reversals).toHaveLength(1);
  });

  it("recovery after a stale rejection goes through the live state: a within-bounds retry succeeds and an over-bound retry gets the honest business rejection", async () => {
    const store = await make();
    const material = await seedTrackedMaterial(store, "wire");
    await seedPurchase(store, "purchase-recovery", 3000);
    const service = new InventoryMaterialService(store, clock);
    /* سباق أول: الفائز يأخذ 2500 من 3000. */
    const [winner, loser] = await Promise.all([
      service.receivePurchase({
        materialId: material.id,
        purchaseId: "purchase-recovery",
        quantityMilli: 10000,
        valueMinor: 2500,
        occurredOn: "2026-10-29",
        note: "الأولى",
        operationKey: "recovery-1",
      }),
      service.receivePurchase({
        materialId: material.id,
        purchaseId: "purchase-recovery",
        quantityMilli: 10000,
        valueMinor: 2500,
        occurredOn: "2026-10-29",
        note: "الثانية",
        operationKey: "recovery-2",
      }),
    ]);
    expect(winner.ok || loser.ok).toBe(true);
    expect([winner, loser].filter(result => result.ok)).toHaveLength(1);
    /* التعافي بمفتاح جديد: فوق المتبقي الحي (600 > 500) يُرفض برسالة
     * الأعمال الصادقة (لا بتعارض صامت ولا بتجاوز)، وضمن المتبقي ينجح. */
    const overBound = await service.receivePurchase({
      materialId: material.id,
      purchaseId: "purchase-recovery",
      quantityMilli: 2000,
      valueMinor: 600,
      occurredOn: "2026-10-29",
      note: "فوق الحد الحي",
      operationKey: "recovery-3",
    });
    expect(overBound).toMatchObject({ ok: false, code: "validation_error" });
    const withinBound = await service.receivePurchase({
      materialId: material.id,
      purchaseId: "purchase-recovery",
      quantityMilli: 2000,
      valueMinor: 500,
      occurredOn: "2026-10-29",
      note: "ضمن الحد الحي",
      operationKey: "recovery-4",
    });
    expect(withinBound).toMatchObject({ ok: true });
    const receipts = (await movementsOf(store)).filter(movement => movement.type === "purchase_receipt");
    expect(receipts.reduce((sum, movement) => sum + movement.valueDeltaMinor, 0)).toBe(3000);
  });
});
