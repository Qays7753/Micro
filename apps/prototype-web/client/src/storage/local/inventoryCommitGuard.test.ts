import { describe, expect, it } from "vitest";
import {
  INVENTORY_OPERATION_KEY_CONFLICT_MESSAGE,
  INVENTORY_STATE_CHANGED_MESSAGE,
  decideInventoryCommit,
  inventoryFinancialEventsFingerprint,
  inventoryMaterialsFingerprint,
  inventoryMovementsFingerprint,
  inventoryPurchasesFingerprint,
  inventoryShortagesFingerprint,
} from "./inventoryCommitGuard";
import type {
  InventoryMovement,
  InventoryShortage,
  Material,
} from "@micro-domain/inventory-material/index.js";
import type { SupplierPurchase } from "@micro-domain/supplier-purchase/index.js";
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";

/* S07-MR-001 (أمر S08 — القسم ١): اختبارات الحارس النقي مباشرة — أذرع
 * الحالة المتوقعة (CAS) والحتمية داخل الحد، وسمات البصمات (الحتمية
 * والتقاط التغيير وعدم الانكسار بالعرضيات)، وسلوك البذر بلا توقع كما
 * كان حرفيًا. الاختبارات التطبيقية الحية على المهايئين في
 * inventoryConcurrency.s07mr001.test.ts. */

const movement = (overrides: Partial<InventoryMovement>): InventoryMovement => ({
  id: "movement-1",
  materialId: "material-1",
  type: "purchase_receipt",
  occurredOn: "2026-10-20",
  recordedAt: "2026-10-30T10:00:00.000Z",
  quantityDeltaMilli: 1000,
  valueDeltaMinor: 500,
  note: "استلام",
  reason: null,
  operationKey: "op-1",
  purchaseId: "purchase-1",
  purchaseLineId: null,
  orderId: null,
  saleId: null,
  reversesMovementId: null,
  wasteContext: null,
  costKnowledge: "known",
  ...overrides,
});

const material = (overrides: Partial<Material>): Material => ({
  id: "material-1",
  name: "خشب",
  unit: "piece",
  createdAt: "2026-10-01T00:00:00.000Z",
  createdOperationKey: "open-1",
  tracking: { status: "tracked", decidedOn: "2026-10-01", reason: null },
  opening: {
    quantityState: "confirmed",
    quantityMilli: 0,
    costState: "unknown",
    valueMinor: null,
    confirmedOn: "2026-10-01",
    sourceNote: null,
  },
  ...overrides,
});

const purchase = (overrides: Partial<SupplierPurchase>): SupplierPurchase =>
  ({
    id: "purchase-1",
    supplierName: "المورد",
    note: "",
    purchasedOn: "2026-10-20",
    dueOn: null,
    totalMinor: 3000,
    initialPaidMinor: 0,
    recordedAt: "2026-10-20T00:00:00.000Z",
    idempotencyKey: "purchase-1",
    payments: [],
    createdAt: "2026-10-20T00:00:00.000Z",
    ...overrides,
  }) as SupplierPurchase;

const shortage = (overrides: Partial<InventoryShortage>): InventoryShortage => ({
  id: "shortage-1",
  materialId: "material-1",
  requestedQuantityMilli: 9000,
  availableQuantityMilli: 0,
  shortageQuantityMilli: 9000,
  occurredOn: "2026-10-27",
  recordedAt: "2026-10-30T10:00:00.000Z",
  note: "نقص",
  orderId: null,
  operationKey: "shortage-op-1",
  status: "open",
  resolvedOn: null,
  resolutionNote: null,
  ...overrides,
});

const event = (overrides: Partial<FinancialEvent>): FinancialEvent =>
  ({
    id: "event-1",
    type: "loss_non_cash",
    amountMinor: 500,
    currency: "JOD",
    occurredOn: "2026-10-27",
    recordedAt: "2026-10-30T10:00:00.000Z",
    idempotencyKey: "op-1:loss",
    note: "خسارة",
    counterparty: null,
    relatedEventId: null,
    cashDeltaMinor: 0,
    payableDeltaMinor: 0,
    ownerCapitalDeltaMinor: 0,
    operatingExpenseDeltaMinor: 0,
    correctionType: null,
    correctionOfEventId: null,
    correctionReason: null,
    ...overrides,
  }) as FinancialEvent;

const noLive = {
  liveMaterials: null,
  liveShortages: null,
  livePurchases: null,
  liveEvents: null,
};

describe("S07-MR-001 inventoryCommitGuard — fingerprints", () => {
  it("movement fingerprint is order-independent, deterministic, and unaffected by display-only edits", () => {
    const a = movement({});
    const b = movement({ id: "movement-2", note: "نص آخر", recordedAt: "2026-10-31T00:00:00.000Z" });
    /* ترتيب مختلف + تعديلات عرضية فقط — البصمة نفسها (نفس الهوية الحرجة). */
    expect(inventoryMovementsFingerprint([a, movement({ id: "m-x" })])).toBe(
      inventoryMovementsFingerprint([movement({ id: "m-x" }), a]),
    );
    expect(inventoryMovementsFingerprint([a])).not.toBe(inventoryMovementsFingerprint([b]));
    /* أي تغيير حرجة (كمية/قيمة/مرجع) يكسر البصمة. */
    expect(inventoryMovementsFingerprint([a])).not.toBe(
      inventoryMovementsFingerprint([movement({ quantityDeltaMilli: 1001 })]),
    );
    expect(inventoryMovementsFingerprint([a])).not.toBe(
      inventoryMovementsFingerprint([movement({ purchaseLineId: "line-9" })]),
    );
  });

  it("material fingerprint captures tracking and opening knowledge; purchase fingerprint captures receipt bounds only", () => {
    const base = material({});
    expect(inventoryMaterialsFingerprint([base])).toBe(inventoryMaterialsFingerprint([material({})]));
    expect(inventoryMaterialsFingerprint([base])).not.toBe(
      inventoryMaterialsFingerprint([
        material({ tracking: { status: "untracked", decidedOn: null, reason: "why" } }),
      ]),
    );
    expect(inventoryMaterialsFingerprint([base])).not.toBe(
      inventoryMaterialsFingerprint([material({ opening: { ...base.opening!, quantityMilli: 5 } })]),
    );
    const purchaseBase = purchase({});
    expect(inventoryPurchasesFingerprint([purchaseBase])).toBe(inventoryPurchasesFingerprint([purchase({})]));
    /* دفعة جديدة لا تكسر بصمة حدود الاستلام (خارج حقول الحدود عمدًا). */
    expect(inventoryPurchasesFingerprint([purchaseBase])).toBe(
      inventoryPurchasesFingerprint([
        purchase({
          payments: [
            {
              id: "p1",
              amountMinor: 100,
              occurredOn: "2026-10-21",
              recordedAt: "2026-10-21T00:00:00.000Z",
              idempotencyKey: "pay-1",
              note: null,
              walletId: null,
            },
          ] as never[],
        }),
      ]),
    );
    /* تغيير الإجمالي أو البنود يكسرها — هذه حدود الاستلام الحية. */
    expect(inventoryPurchasesFingerprint([purchaseBase])).not.toBe(
      inventoryPurchasesFingerprint([purchase({ totalMinor: 3001 })]),
    );
    expect(inventoryPurchasesFingerprint([purchaseBase])).not.toBe(
      inventoryPurchasesFingerprint([
        purchase({
          lines: [
            {
              lineId: "line-1",
              materialId: "material-1",
              expectedQuantityMilli: null,
              valueMinor: 3000,
              costKnowledge: "known",
              treatment: "tracked_material",
            },
          ],
        }),
      ]),
    );
  });

  it("shortage and financial-event fingerprints capture the decision-relevant state", () => {
    expect(inventoryShortagesFingerprint([shortage({})])).toBe(inventoryShortagesFingerprint([shortage({})]));
    expect(inventoryShortagesFingerprint([shortage({})])).not.toBe(
      inventoryShortagesFingerprint([shortage({ status: "resolved", resolvedOn: "2026-10-28" })]),
    );
    expect(inventoryFinancialEventsFingerprint([event({})])).toBe(
      inventoryFinancialEventsFingerprint([event({})]),
    );
    expect(inventoryFinancialEventsFingerprint([event({})])).not.toBe(
      inventoryFinancialEventsFingerprint([event({ idempotencyKey: "op-2:loss" })]),
    );
  });
});

describe("S07-MR-001 inventoryCommitGuard — decision", () => {
  const liveMovements = [movement({})];

  it("guarded commit with a matching expectation applies; any drifted fingerprint rejects with storage_stale", () => {
    const expectation = {
      movementsFingerprint: inventoryMovementsFingerprint(liveMovements),
      materialsFingerprint: inventoryMaterialsFingerprint([material({})]),
    };
    const commitMovement = movement({ id: "movement-2", operationKey: "op-2" });
    const applied = decideInventoryCommit({
      expectation,
      liveMovements,
      liveMaterials: [material({})],
      liveShortages: null,
      livePurchases: null,
      liveEvents: null,
      material: null,
      movements: [commitMovement],
      events: [],
      shortage: null,
    });
    expect(applied).toMatchObject({ kind: "apply", reused: false });
    /* انجراف الحركات (كاتب آخر سبق الحد) — رفض كامل. */
    const drifted = decideInventoryCommit({
      expectation,
      liveMovements: [movement({}), movement({ id: "movement-2", operationKey: "op-x" })],
      ...noLive,
      liveMaterials: [material({})],
      material: null,
      movements: [commitMovement],
      events: [],
      shortage: null,
    });
    expect(drifted).toMatchObject({
      kind: "reject",
      code: "storage_stale",
      message: INVENTORY_STATE_CHANGED_MESSAGE,
    });
    /* انجراف سجل المادة (إيقاف متابعة متزامن) — رفض كامل. */
    const materialDrift = decideInventoryCommit({
      expectation,
      liveMovements,
      ...noLive,
      liveMaterials: [material({ tracking: { status: "untracked", decidedOn: null, reason: null } })],
      material: null,
      movements: [commitMovement],
      events: [],
      shortage: null,
    });
    expect(materialDrift).toMatchObject({ kind: "reject", code: "storage_stale" });
    /* بصمة حاضرة بلا قراءة حية للمهايئ — فشل مغلق لا كتابة عمياء. */
    const failClosed = decideInventoryCommit({
      expectation: { materialsFingerprint: "x" },
      liveMovements: [],
      ...noLive,
      material: null,
      movements: [commitMovement],
      events: [],
      shortage: null,
    });
    expect(failClosed).toMatchObject({ kind: "reject", code: "storage_error" });
  });

  it("in-boundary idempotency: identical financial payload reuses the stored movement; different payload conflicts without overwrite", () => {
    const expectation = { movementsFingerprint: inventoryMovementsFingerprint(liveMovements) };
    /* نفس المفتاح ونفس الحملة المالية بمعرّف/وقت/نص مختلفين — إعادة استخدام. */
    const replay = decideInventoryCommit({
      expectation,
      liveMovements,
      ...noLive,
      material: null,
      movements: [
        movement({
          id: "movement-replay",
          recordedAt: "2026-10-31T00:00:00.000Z",
          note: "إعادة إرسال",
        }),
      ],
      events: [],
      shortage: null,
    });
    expect(replay).toMatchObject({ kind: "apply", reused: true, newMovements: [] });
    if (replay.kind === "apply") expect(replay.resultMovements[0]!.id).toBe("movement-1");
    /* نفس المفتاح بحملة مالية مختلفة — تعارض بلا استبدال. */
    const conflict = decideInventoryCommit({
      expectation,
      liveMovements,
      ...noLive,
      material: null,
      movements: [movement({ id: "movement-conflict", valueDeltaMinor: 999 })],
      events: [],
      shortage: null,
    });
    expect(conflict).toMatchObject({
      kind: "reject",
      code: "storage_stale",
      message: INVENTORY_OPERATION_KEY_CONFLICT_MESSAGE,
    });
  });

  it("shortage update-in-place (same id) writes through the CAS arm; a same-key different record with a different payload conflicts", () => {
    const liveShortages = [shortage({})];
    const expectation = { shortagesFingerprint: inventoryShortagesFingerprint(liveShortages) };
    /* حل النقص: نفس السجل بهويته — تحديث في موضعه يعبر (CAS يحرس تقادمه). */
    const resolve = decideInventoryCommit({
      expectation,
      liveMovements: [],
      liveMaterials: null,
      liveShortages,
      livePurchases: null,
      liveEvents: null,
      material: null,
      movements: [],
      events: [],
      shortage: shortage({ status: "resolved", resolvedOn: "2026-10-28", resolutionNote: "وصل" }),
    });
    expect(resolve).toMatchObject({ kind: "apply", reused: false });
    if (resolve.kind === "apply") {
      expect(resolve.newShortage?.status).toBe("resolved");
      expect(resolve.resultShortage?.status).toBe("resolved");
    }
    /* سجل جديد بنفس مفتاح سجل قائم وحملة مالية مختلفة — تعارض. */
    const foreign = decideInventoryCommit({
      expectation,
      liveMovements: [],
      liveMaterials: null,
      liveShortages,
      livePurchases: null,
      liveEvents: null,
      material: null,
      movements: [],
      events: [],
      shortage: shortage({ id: "shortage-2", requestedQuantityMilli: 8000, shortageQuantityMilli: 8000 }),
    });
    expect(foreign).toMatchObject({ kind: "reject", code: "storage_stale" });
    /* إعادة إرسال مكررة بحملة مالية متطابقة ومعرّف جديد — إعادة استخدام. */
    const replay = decideInventoryCommit({
      expectation,
      liveMovements: [],
      liveMaterials: null,
      liveShortages,
      livePurchases: null,
      liveEvents: null,
      material: null,
      movements: [],
      events: [],
      shortage: shortage({ id: "shortage-2", note: "نص آخر" }),
    });
    expect(replay).toMatchObject({ kind: "apply", reused: true });
    if (replay.kind === "apply") {
      expect(replay.newShortage).toBeNull();
      expect(replay.resultShortage?.id).toBe("shortage-1");
    }
  });

  it("unguarded seeding path keeps the literal current semantics (direct write; events reuse by key)", () => {
    const direct = decideInventoryCommit({
      expectation: null,
      liveMovements: [],
      ...noLive,
      material: material({}),
      movements: [movement({})],
      events: [],
      shortage: shortage({}),
    });
    expect(direct).toMatchObject({ kind: "apply", reused: false });
    if (direct.kind === "apply") {
      expect(direct.newMovements).toHaveLength(1);
      expect(direct.newShortage?.id).toBe("shortage-1");
    }
    /* معاملة الحركة+الحدث بلا توقع تحافظ على منطق إعادة الاستخدام بالمفتاح
     * القائم حرفيًا (أول-كتابة-يفوز) — عقد البذر/المطابقة القائم. */
    const liveEvents = [event({})];
    const withEvents = decideInventoryCommit({
      expectation: null,
      liveMovements,
      liveMaterials: null,
      liveShortages: null,
      livePurchases: null,
      liveEvents,
      material: null,
      movements: [movement({ id: "movement-again" })],
      events: [event({ id: "event-again" })],
      shortage: null,
    });
    expect(withEvents).toMatchObject({ kind: "apply", reused: true });
    if (withEvents.kind === "apply") {
      expect(withEvents.newMovements).toHaveLength(0);
      expect(withEvents.newEvents).toHaveLength(0);
      expect(withEvents.resultMovements[0]!.id).toBe("movement-1");
      expect(withEvents.resultEvents[0]!.id).toBe("event-1");
    }
  });
});
