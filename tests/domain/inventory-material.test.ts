import { describe, expect, it } from "vitest";
import {
  applyInventoryShortageResolution,
  assertInventoryRemainsNonNegative,
  consumptionValueMinor,
  createInventoryMovement,
  createInventoryShortage,
  createMaterial,
  isCostBackedConsumption,
  positionCostKnowledge,
  summarizeMaterialInventory,
  type MaterialTrackingState,
} from "../../src/domain/inventory-material/index.js";

describe("inventory material domain", () => {
  const material = createMaterial({
    id: "wood",
    name: "خشب",
    unit: "piece",
    createdAt: "2026-08-23T00:00:00.000Z",
    createdOperationKey: "material-wood",
  });
  const opening = createInventoryMovement({
    id: "opening",
    materialId: material.id,
    type: "opening",
    occurredOn: "2026-08-01",
    recordedAt: "2026-08-23T00:00:00.000Z",
    quantityDeltaMilli: 10000,
    valueDeltaMinor: 4000,
    note: "افتتاح",
    operationKey: "opening-wood",
  });
  it("keeps opening material out of cash and derives a position", () => {
    expect(summarizeMaterialInventory(material.id, [opening])).toEqual({
      materialId: "wood",
      quantityMilli: 10000,
      valueMinor: 4000,
      movementCount: 1,
    });
    expect(consumptionValueMinor(2000, summarizeMaterialInventory(material.id, [opening]))).toBe(800);
  });
  it("requires a purchase for receipt, an order for consumption, and reason for waste", () => {
    expect(() =>
      createInventoryMovement({
        ...opening,
        id: "receipt",
        type: "purchase_receipt",
        operationKey: "receipt",
        quantityDeltaMilli: 1000,
        valueDeltaMinor: 400,
      }),
    ).toThrow("مرجع شراء");
    expect(() =>
      createInventoryMovement({
        ...opening,
        id: "consume",
        type: "consumption",
        operationKey: "consume",
        quantityDeltaMilli: -1000,
        valueDeltaMinor: -400,
      }),
    ).toThrow("مرجع طلب");
    expect(() =>
      createInventoryMovement({
        ...opening,
        id: "waste",
        type: "waste",
        operationKey: "waste",
        quantityDeltaMilli: -1000,
        valueDeltaMinor: -400,
      }),
    ).toThrow("سبب الحركة");
  });
  it("marks only valued order-linked consumption as COGS evidence", () => {
    const consumption = createInventoryMovement({
      ...opening,
      id: "consume-backed",
      type: "consumption",
      operationKey: "consume-backed",
      quantityDeltaMilli: -1000,
      valueDeltaMinor: -400,
      orderId: "completed-order",
    });
    const receipt = createInventoryMovement({
      ...opening,
      id: "receipt-backed",
      type: "purchase_receipt",
      operationKey: "receipt-backed",
      quantityDeltaMilli: 1000,
      valueDeltaMinor: 400,
      purchaseId: "purchase",
    });
    const waste = createInventoryMovement({
      ...opening,
      id: "waste-backed",
      type: "waste",
      operationKey: "waste-backed",
      quantityDeltaMilli: -1000,
      valueDeltaMinor: -400,
      reason: "اختبار",
    });
    expect(isCostBackedConsumption(consumption)).toBe(true);
    expect(isCostBackedConsumption(receipt)).toBe(false);
    expect(isCostBackedConsumption(waste)).toBe(false);
  });
  it("does not permit overspend or a negative remaining material position", () => {
    const position = summarizeMaterialInventory(material.id, [opening]);
    expect(() => consumptionValueMinor(11000, position)).toThrow("غير كافية");
    const broken = createInventoryMovement({
      id: "broken",
      materialId: material.id,
      type: "waste",
      occurredOn: "2026-08-02",
      recordedAt: "2026-08-23T00:00:00.000Z",
      quantityDeltaMilli: -11000,
      valueDeltaMinor: -4400,
      note: "تلف",
      reason: "اختبار",
      operationKey: "broken",
    });
    expect(() => assertInventoryRemainsNonNegative(material.id, [opening, broken])).toThrow("سالبة");
  });
});

/* ── المجموعة ٢ (عقد ٢٨): متابعة المادة ومعرفة الرصيد والتكلفة وسجل النقص ── */
describe("inventory material domain — Group 2 selective tracking", () => {
  it("accepts tracking and opening knowledge with valid shapes, absent = legacy tracked/known", () => {
    const tracked = createMaterial({
      id: "sugar",
      name: "سكر",
      unit: "kilogram",
      createdAt: "2026-09-01T00:00:00.000Z",
      createdOperationKey: "material-sugar",
      tracking: { status: "tracked", decidedOn: "2026-09-01", reason: null },
      opening: {
        quantityState: "confirmed",
        quantityMilli: 20000,
        costState: "unknown",
        valueMinor: null,
        confirmedOn: "2026-09-01",
        sourceNote: "جرد",
      },
    });
    expect(tracked.tracking?.status).toBe("tracked");
    expect(tracked.opening?.quantityMilli).toBe(20000);
    expect(tracked.opening?.costState).toBe("unknown");
    const untracked = createMaterial({
      id: "bags",
      name: "أكياس تغليف",
      unit: "piece",
      createdAt: "2026-09-01T00:00:00.000Z",
      createdOperationKey: "material-bags",
      tracking: { status: "untracked", decidedOn: "2026-09-01", reason: "للتكلفة فقط" },
      opening: null,
    });
    expect(untracked.tracking?.status).toBe("untracked");
    const legacy = createMaterial({
      id: "legacy",
      name: "قديم",
      unit: "piece",
      createdAt: "2026-08-01T00:00:00.000Z",
      createdOperationKey: "material-legacy",
    });
    expect(legacy.tracking).toBeNull();
    expect(legacy.opening).toBeNull();
  });
});

describe("inventory material domain — Group 2 selective tracking: malformed shapes rejected", () => {
  it("rejects malformed tracking and opening knowledge shapes", () => {
    expect(() =>
      createMaterial({
        id: "bad-tracking",
        name: "س",
        unit: "piece",
        createdAt: "2026-09-01T00:00:00.000Z",
        createdOperationKey: "material-bad-tracking",
        tracking: { status: "maybe", decidedOn: null, reason: null } as unknown as MaterialTrackingState,
      }),
    ).toThrow("متابعة");
    expect(() =>
      createMaterial({
        id: "bad-opening",
        name: "س",
        unit: "piece",
        createdAt: "2026-09-01T00:00:00.000Z",
        createdOperationKey: "material-bad-opening",
        opening: {
          quantityState: "confirmed",
          quantityMilli: -5,
          costState: "known",
          valueMinor: 500,
          confirmedOn: "2026-09-01",
          sourceNote: null,
        },
      }),
    ).toThrow("معرفة");
    expect(() =>
      createMaterial({
        id: "bad-opening-2",
        name: "س",
        unit: "piece",
        createdAt: "2026-09-01T00:00:00.000Z",
        createdOperationKey: "material-bad-opening-2",
        opening: {
          quantityState: "unconfirmed",
          quantityMilli: 5,
          costState: "unknown",
          valueMinor: null,
          confirmedOn: null,
          sourceNote: null,
        },
      }),
    ).toThrow("معرفة");
  });
});

describe("inventory material domain — Group 2 selective tracking: cost-knowledge rules", () => {
  it("allows a zero value only when the cost is explicitly unknown", () => {
    const movement = createInventoryMovement({
      id: "unknown-open",
      materialId: "sugar",
      type: "opening",
      occurredOn: "2026-09-01",
      recordedAt: "2026-09-01T00:00:00.000Z",
      quantityDeltaMilli: 20000,
      valueDeltaMinor: 0,
      note: "جرد بلا فاتورة",
      operationKey: "unknown-open",
      costKnowledge: "unknown",
    });
    expect(movement.costKnowledge).toBe("unknown");
    expect(movement.valueDeltaMinor).toBe(0);
    expect(() =>
      createInventoryMovement({
        id: "zero-known",
        materialId: "sugar",
        type: "opening",
        occurredOn: "2026-09-01",
        recordedAt: "2026-09-01T00:00:00.000Z",
        quantityDeltaMilli: 20000,
        valueDeltaMinor: 0,
        note: "بلا وسم",
        operationKey: "zero-known",
      }),
    ).toThrow("غير صفريتين");
  });
});

describe("inventory material domain — Group 2 selective tracking: contradictory knowledge rejected", () => {
  it("rejects a marked-unknown value that carries an amount, and any zero quantity", () => {
    expect(() =>
      createInventoryMovement({
        id: "unknown-valued",
        materialId: "sugar",
        type: "opening",
        occurredOn: "2026-09-01",
        recordedAt: "2026-09-01T00:00:00.000Z",
        quantityDeltaMilli: 20000,
        valueDeltaMinor: 500,
        note: "وسم متناقض",
        operationKey: "unknown-valued",
        costKnowledge: "unknown",
      }),
    ).toThrow("غير معروفة");
    expect(() =>
      createInventoryMovement({
        id: "zero-qty",
        materialId: "sugar",
        type: "opening",
        occurredOn: "2026-09-01",
        recordedAt: "2026-09-01T00:00:00.000Z",
        quantityDeltaMilli: 0,
        valueDeltaMinor: 0,
        note: "كمية صفر",
        operationKey: "zero-qty",
        costKnowledge: "unknown",
      }),
    ).toThrow("كمية");
  });
});

describe("inventory material domain — Group 2 selective tracking: consumption statement", () => {
  it("consumption requires an order reference or an explicit statement", () => {
    const materialId = "wood";
    const base = {
      id: "consume-probe",
      materialId,
      type: "consumption" as const,
      occurredOn: "2026-09-02",
      recordedAt: "2026-09-02T00:00:00.000Z",
      quantityDeltaMilli: -500,
      valueDeltaMinor: -200,
      note: "استهلاك",
      operationKey: "consume",
    };
    expect(createInventoryMovement({ ...base, orderId: "order-1" }).orderId).toBe("order-1");
    expect(createInventoryMovement({ ...base, reason: "تجربة لون لطلب قادم" }).reason).toBe(
      "تجربة لون لطلب قادم",
    );
    /* المجموعة ٣ (عقد D6): الرسالة توسعت لتشمل مرجع البيع المباشر — القاعدة لم تتغير. */
    expect(() => createInventoryMovement(base)).toThrow("مرجع طلب أو بيع مباشر أو بيانًا");
  });
  it("a pure-unknown-cost position consumes at a zero marked unknown; known positions keep Decision 20", () => {
    const materialId = "sugar";
    const unknownOpening = createInventoryMovement({
      id: "open-unknown",
      materialId,
      type: "opening",
      occurredOn: "2026-09-01",
      recordedAt: "2026-09-01T00:00:00.000Z",
      quantityDeltaMilli: 20000,
      valueDeltaMinor: 0,
      note: "جرد",
      operationKey: "open-unknown",
      costKnowledge: "unknown",
    });
    const unknownPosition = summarizeMaterialInventory(materialId, [unknownOpening]);
    expect(consumptionValueMinor(5000, unknownPosition, true)).toBe(0);
    expect(consumptionValueMinor(20000, unknownPosition, true)).toBe(0);
    /* المخلوط يبقى تحت الرياضيات: افتتاح مجهول + استلام معلوم. */
    const receipt = createInventoryMovement({
      id: "receipt-known",
      materialId,
      type: "purchase_receipt",
      occurredOn: "2026-09-05",
      recordedAt: "2026-09-05T00:00:00.000Z",
      quantityDeltaMilli: 10000,
      valueDeltaMinor: 5000,
      note: "استلام",
      operationKey: "receipt-known",
      purchaseId: "purchase-1",
    });
    const mixed = summarizeMaterialInventory(materialId, [unknownOpening, receipt]);
    expect(consumptionValueMinor(3000, mixed)).toBe(500);
    expect(positionCostKnowledge([unknownOpening], materialId)).toBe("unknown");
    expect(positionCostKnowledge([unknownOpening, receipt], materialId)).toBe("partial");
    expect(positionCostKnowledge([receipt], materialId)).toBe("known");
  });
});

describe("inventory material domain — Group 2 selective tracking: consumption and pure-unknown math", () => {
  it("shortage records carry positive declared quantities and resolve exactly once", () => {
    const shortage = createInventoryShortage({
      id: "shortage-1",
      materialId: "wood",
      requestedQuantityMilli: 10000,
      availableQuantityMilli: 6000,
      shortageQuantityMilli: 4000,
      occurredOn: "2026-09-06",
      recordedAt: "2026-09-06T00:00:00.000Z",
      note: "نقص لتجربة طلبي",
      orderId: null,
      operationKey: "shortage-1",
    });
    expect(shortage.status).toBe("open");
    expect(shortage.shortageQuantityMilli).toBe(4000);
    expect(() =>
      createInventoryShortage({
        id: "shortage-bad",
        materialId: "wood",
        requestedQuantityMilli: 10000,
        availableQuantityMilli: 6000,
        shortageQuantityMilli: 5000,
        occurredOn: "2026-09-06",
        recordedAt: "2026-09-06T00:00:00.000Z",
        note: "كسر الحساب",
        orderId: null,
        operationKey: "shortage-bad",
      }),
    ).toThrow("الفرق");
    expect(() =>
      createInventoryShortage({
        id: "shortage-blank",
        materialId: "wood",
        requestedQuantityMilli: 10000,
        availableQuantityMilli: 6000,
        shortageQuantityMilli: 4000,
        occurredOn: "2026-09-06",
        recordedAt: "2026-09-06T00:00:00.000Z",
        note: "   ",
        orderId: null,
        operationKey: "shortage-blank",
      }),
    ).toThrow("بيان النقص");
    const resolved = applyInventoryShortageResolution(shortage, {
      resolvedOn: "2026-09-10",
      resolutionNote: "استلمت بديلًا من المورد",
    });
    expect(resolved.status).toBe("resolved");
    expect(() =>
      applyInventoryShortageResolution(resolved, {
        resolvedOn: "2026-09-11",
        resolutionNote: "مرة ثانية",
      }),
    ).toThrow("محسول سابقًا");
  });
});

describe("inventory material domain — Group 2 selective tracking: shortage records and reversal mirror", () => {
  it("the reversal mirrors the source cost knowledge, and a zero-value reversal stays marked", () => {
    const materialId = "wood";
    const unknownWaste = createInventoryMovement({
      id: "waste-unknown",
      materialId,
      type: "waste",
      occurredOn: "2026-09-03",
      recordedAt: "2026-09-03T00:00:00.000Z",
      quantityDeltaMilli: -1000,
      valueDeltaMinor: 0,
      note: "هدر بلا تكلفة معلومة",
      reason: "تلف",
      operationKey: "waste-unknown",
      costKnowledge: "unknown",
    });
    const reversal = createInventoryMovement({
      id: "reverse-unknown",
      materialId,
      type: "reversal",
      occurredOn: "2026-09-04",
      recordedAt: "2026-09-04T00:00:00.000Z",
      quantityDeltaMilli: 1000,
      valueDeltaMinor: 0,
      note: "تراجع عن هدر",
      reason: "خطأ",
      operationKey: "reverse-unknown",
      reversesMovementId: unknownWaste.id,
      costKnowledge: "unknown",
    });
    expect(reversal.costKnowledge).toBe("unknown");
    expect(() =>
      createInventoryMovement({
        id: "reverse-bad",
        materialId,
        type: "reversal",
        occurredOn: "2026-09-04",
        recordedAt: "2026-09-04T00:00:00.000Z",
        quantityDeltaMilli: 1000,
        valueDeltaMinor: 0,
        note: "مرآة بلا وسم",
        reason: "خطأ",
        operationKey: "reverse-bad",
        reversesMovementId: unknownWaste.id,
      }),
    ).toThrow("غير صفريتين");
  });
});
