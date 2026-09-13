import { describe, expect, it } from "vitest";
import { LocalTransferService } from "./localTransferService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { syncSha256Hex } from "@/lib/syncSha256";
import { localExportVersion, localSchemaVersion, type LocalExportFile } from "@/storage/local/types";

/* المجموعة ٢ (التحصين الكامل — HIGH-002/D-1): زوج ٨/١٧ صدر فعلًا مع الالتزام
 * 570eba1 (2026-08-23) ويُعامل كمحتمل الاستخدام الميداني. العهدة هنا مؤصَّلة من
 * أشكال أنواع 570eba1 نفسها (git show 570eba1:.../types.ts + أنواع النطاق
 * حينها) — لا من قصّ ملف حالٍ: كل مفتاح في كل سجل يجب أن يكون من سطح الزوج
 * التاريخي (تدقيق آلي أدناه)، والملف خالٍ عمدًا من مظروف التكامل والعدادات
 * (لم يظهر المظروف إلا مع نسخة ٢٧). القيود المالية داخلية متسقة: المدفوع =
 * مجموع الدفعات، ودلتات الحدث المالي كما ينتجها النطاق، والمحفظة بقيد افتتاح
 * واحد موجب. */

const now = () => "2026-08-24T10:00:00.000Z";

/* ─── عهدة ٨/١٧: الأشكال كما كانت عند 570eba1 ─── */

const profile817 = {
  id: "local-profile",
  activityName: "ورشة أم جهاد",
  currency: "JOD",
  activityType: "custom_craft",
  createdAt: "2026-08-20T08:00:00.000Z",
  updatedAt: "2026-08-23T18:00:00.000Z",
};

const preferences817 = {
  id: "local-preferences",
  theme: "light" as const,
  dailyScheduleCapacityMinutes: 240,
  updatedAt: "2026-08-23T18:00:00.000Z",
};

const draft817 = {
  id: "draft-817-1",
  intent: "customer_order" as const,
  customerName: "سعاد",
  itemName: "طقم وسائد مطرز",
  catalogItemId: null,
  specifications: "قماش قطني، تطريز يدوي ذهبي",
  quantity: 4,
  costSnapshots: [
    {
      id: "draft-cost-817-1",
      revision: 1,
      currency: "JOD",
      materialItems: [
        {
          name: "قماش قطني",
          quantity: 6,
          unit: "متر",
          unitPriceMinor: 350,
          confidence: "known" as const,
        },
      ],
      time: null,
      packagingMinor: 200,
      deliveryMinor: 300,
      wasteMinor: 100,
      safetyBufferMinor: 250,
      quantity: 4,
      createdAt: "2026-08-22T09:30:00.000Z",
    },
  ],
  activeCostSnapshotId: "draft-cost-817-1",
  linkedOrderId: null,
  createdAt: "2026-08-22T09:30:00.000Z",
  updatedAt: "2026-08-22T09:30:00.000Z",
};

const orderCostSnapshot817 = {
  id: "order-817-1:cost-1",
  currency: "JOD",
  materialCostMinor: 2100,
  timeCostMinor: 0,
  packagingMinor: 200,
  deliveryMinor: 300,
  wasteMinor: 100,
  safetyBufferMinor: 250,
  plannedCostMinor: 2950,
  unitCostMinor: 738,
  priceFloorMinor: 3500,
  quantity: 4,
  knowledgeState: "known" as const,
  input: {
    currency: "JOD",
    materialItems: [
      {
        name: "قماش قطني",
        quantity: 6,
        unit: "متر",
        unitPriceMinor: 350,
        priceDate: "2026-08-20",
        source: "user_input" as const,
        confidence: "known" as const,
      },
    ],
    time: null,
    packagingMinor: 200,
    deliveryMinor: 300,
    wasteMinor: 100,
    safetyBufferMinor: 250,
    quantity: 4,
    createdAt: "2026-08-22T10:00:00.000Z",
    source: "order_confirmation" as const,
  },
  createdAt: "2026-08-22T10:00:00.000Z",
};

const order817 = {
  id: "order-817-1",
  order: {
    id: "order-817-1",
    customerName: "سعاد",
    itemName: "طقم وسائد مطرز",
    specifications: "قماش قطني، تطريز يدوي ذهبي",
    quantity: 4,
    currency: "JOD",
    agreedPriceMinor: 12000,
    costSnapshot: orderCostSnapshot817,
    costSnapshots: [orderCostSnapshot817],
    status: "delivered" as const,
    settlementStatus: "paid" as const,
    depositCollectedMinor: 3000,
    depositSettlement: null,
    collectedMinor: 12000,
    receivableMinor: 0,
    recognizedRevenueMinor: 12000,
    recognizedCostMinor: 2950,
    profitIndicatorMinor: 9050,
    resultStatus: "final" as const,
    nextAction: "راجع النتيجة والخطوة التالية",
    events: [
      {
        id: "order-817-1:created",
        type: "created" as const,
        idempotencyKey: "order-817-1:created",
        createdAt: "2026-08-22T10:00:00.000Z",
      },
      {
        id: "order-817-1:status:confirm-817",
        type: "status_changed" as const,
        idempotencyKey: "status:confirm-817",
        createdAt: "2026-08-22T11:00:00.000Z",
        fromStatus: "provisional_agreement" as const,
        toStatus: "confirmed" as const,
      },
      {
        id: "order-817-1:status:deliver-817",
        type: "status_changed" as const,
        idempotencyKey: "status:deliver-817",
        createdAt: "2026-08-23T12:00:00.000Z",
        fromStatus: "confirmed" as const,
        toStatus: "delivered" as const,
      },
    ],
    createdAt: "2026-08-22T10:00:00.000Z",
  },
  catalogItemId: null,
  deliveryDate: "2026-08-23",
  agreementSource: "in_person",
  createdAt: "2026-08-22T10:00:00.000Z",
  updatedAt: "2026-08-23T12:00:00.000Z",
};

const schedule817 = {
  id: "schedule-order-817-1",
  orderId: "order-817-1",
  kind: "delivery" as const,
  scheduledFor: "2026-08-23",
  scheduledTime: null,
  durationMinutes: null,
  status: "scheduled" as const,
  postponeReason: null,
  events: [
    {
      id: "order-817-1:schedule-created",
      type: "created" as const,
      idempotencyKey: "order-817-1:schedule-created",
      createdAt: "2026-08-22T10:00:00.000Z",
      previousScheduledFor: null,
      scheduledFor: "2026-08-23",
      previousScheduledTime: null,
      scheduledTime: null,
      previousDurationMinutes: null,
      durationMinutes: null,
      reason: null,
    },
  ],
  createdAt: "2026-08-22T10:00:00.000Z",
  updatedAt: "2026-08-22T10:00:00.000Z",
};

const financialEvent817 = {
  id: "fin-817-1",
  type: "owner_investment_cash" as const,
  currency: "JOD",
  amountMinor: 20000,
  occurredOn: "2026-08-21",
  recordedAt: "2026-08-21T09:00:00.000Z",
  idempotencyKey: "owner-invest-817",
  note: "استثمار افتتاحي نقدي",
  counterparty: null,
  relatedEventId: null,
  cashDeltaMinor: 20000,
  payableDeltaMinor: 0,
  ownerCapitalDeltaMinor: 20000,
  operatingExpenseDeltaMinor: 0,
};

const supplierPurchase817 = {
  id: "purchase-817-1",
  supplierName: "مؤسسة النسيج",
  note: "قماش قطني للمخزون",
  purchasedOn: "2026-08-21",
  dueOn: null,
  totalMinor: 8400,
  paidMinor: 2100,
  payableMinor: 6300,
  status: "partially_paid" as const,
  idempotencyKey: "purchase-817",
  payments: [
    {
      id: "purchase-817-1:initial",
      amountMinor: 2100,
      occurredOn: "2026-08-21",
      recordedAt: "2026-08-21T10:00:00.000Z",
      idempotencyKey: "purchase-817:initial",
      note: "دفعة عند تسجيل الشراء",
    },
  ],
  createdAt: "2026-08-21T10:00:00.000Z",
  updatedAt: "2026-08-21T10:00:00.000Z",
};

const cashWallet817 = {
  id: "wallet-817-1",
  name: "درج النقد",
  kind: "cash_drawer" as const,
  createdAt: "2026-08-21T09:00:00.000Z",
  createdOperationKey: "wallet-open-817",
};

const cashEntry817 = {
  id: "cash-entry-817-1",
  walletId: "wallet-817-1",
  type: "opening_balance" as const,
  occurredOn: "2026-08-21",
  recordedAt: "2026-08-21T09:00:00.000Z",
  cashDeltaMinor: 20000,
  note: "رصيد افتتاحي",
  reason: null,
  operationKey: "wallet-open-817:balance",
  transferId: null,
  reversesEntryId: null,
};

const material817 = {
  id: "material-817-1",
  name: "قماش قطني",
  unit: "meter" as const,
  createdAt: "2026-08-21T10:30:00.000Z",
  createdOperationKey: "material-open-817",
};

const inventoryMovement817 = {
  id: "movement-817-1",
  materialId: "material-817-1",
  type: "opening" as const,
  occurredOn: "2026-08-21",
  recordedAt: "2026-08-21T10:30:00.000Z",
  quantityDeltaMilli: 12000,
  valueDeltaMinor: 4200,
  note: "افتتاح مخزون القماش",
  reason: null,
  operationKey: "movement-open-817",
  purchaseId: null,
  orderId: null,
  reversesMovementId: null,
};

const catalogItem817 = {
  id: "catalog-817-1",
  kind: "product" as const,
  name: "طقم وسائد مطرز",
  unitLabel: "طقم",
  active: true,
  createdAt: "2026-08-22T09:00:00.000Z",
  updatedAt: "2026-08-22T09:00:00.000Z",
  createdOperationKey: "catalog-open-817",
};

const snapshot817 = {
  profile: profile817,
  preferences: preferences817,
  drafts: [draft817],
  orders: [order817],
  schedules: [schedule817],
  financialEvents: [financialEvent817],
  supplierPurchases: [supplierPurchase817],
  cashWallets: [cashWallet817],
  cashContinuityEntries: [cashEntry817],
  materials: [material817],
  inventoryMovements: [inventoryMovement817],
  catalogItems: [catalogItem817],
};

const file817 = {
  format: "micro-prototype-local-export",
  version: 8,
  schemaVersion: 17,
  exportedAt: "2026-08-24T10:00:00.000Z",
  data: snapshot817,
};

/* ─── تدقيق آلي: سطح مفاتيح ٨/١٧ كما كانت عند 570eba1 ─── */

const SURFACE_817: Record<string, string[]> = {
  file: ["format", "version", "schemaVersion", "exportedAt", "data"],
  snapshot: [
    "profile",
    "preferences",
    "drafts",
    "orders",
    "schedules",
    "financialEvents",
    "supplierPurchases",
    "cashWallets",
    "cashContinuityEntries",
    "materials",
    "inventoryMovements",
    "catalogItems",
  ],
  profile: ["id", "activityName", "currency", "activityType", "createdAt", "updatedAt"],
  preferences: ["id", "theme", "dailyScheduleCapacityMinutes", "updatedAt"],
  draft: [
    "id",
    "intent",
    "customerName",
    "itemName",
    "catalogItemId",
    "specifications",
    "quantity",
    "costSnapshots",
    "activeCostSnapshotId",
    "linkedOrderId",
    "createdAt",
    "updatedAt",
  ],
  draftCostSnapshot: [
    "id",
    "revision",
    "currency",
    "materialItems",
    "time",
    "packagingMinor",
    "deliveryMinor",
    "wasteMinor",
    "safetyBufferMinor",
    "quantity",
    "createdAt",
  ],
  draftCostMaterial: ["name", "quantity", "unit", "unitPriceMinor", "confidence"],
  storedOrder: ["id", "order", "catalogItemId", "deliveryDate", "agreementSource", "createdAt", "updatedAt"],
  order: [
    "id",
    "customerName",
    "itemName",
    "specifications",
    "quantity",
    "currency",
    "agreedPriceMinor",
    "costSnapshot",
    "costSnapshots",
    "status",
    "settlementStatus",
    "depositCollectedMinor",
    "depositSettlement",
    "collectedMinor",
    "receivableMinor",
    "recognizedRevenueMinor",
    "recognizedCostMinor",
    "profitIndicatorMinor",
    "resultStatus",
    "nextAction",
    "events",
    "createdAt",
  ],
  orderEvent: ["id", "type", "idempotencyKey", "createdAt", "note", "amountMinor", "fromStatus", "toStatus"],
  costSnapshot: [
    "id",
    "currency",
    "materialCostMinor",
    "timeCostMinor",
    "packagingMinor",
    "deliveryMinor",
    "wasteMinor",
    "safetyBufferMinor",
    "plannedCostMinor",
    "unitCostMinor",
    "priceFloorMinor",
    "quantity",
    "knowledgeState",
    "input",
    "createdAt",
  ],
  costSnapshotInput: [
    "currency",
    "materialItems",
    "time",
    "packagingMinor",
    "deliveryMinor",
    "wasteMinor",
    "safetyBufferMinor",
    "quantity",
    "createdAt",
    "source",
    "freshnessDays",
  ],
  materialCostItem: ["name", "quantity", "unit", "unitPriceMinor", "priceDate", "source", "confidence"],
  schedule: [
    "id",
    "orderId",
    "kind",
    "scheduledFor",
    "scheduledTime",
    "durationMinutes",
    "status",
    "postponeReason",
    "events",
    "createdAt",
    "updatedAt",
  ],
  scheduleEvent: [
    "id",
    "type",
    "idempotencyKey",
    "createdAt",
    "previousScheduledFor",
    "scheduledFor",
    "previousScheduledTime",
    "scheduledTime",
    "previousDurationMinutes",
    "durationMinutes",
    "reason",
  ],
  financialEvent: [
    "id",
    "type",
    "currency",
    "amountMinor",
    "occurredOn",
    "recordedAt",
    "idempotencyKey",
    "note",
    "counterparty",
    "relatedEventId",
    "expenseContext",
    "cashDeltaMinor",
    "payableDeltaMinor",
    "ownerCapitalDeltaMinor",
    "operatingExpenseDeltaMinor",
  ],
  supplierPurchase: [
    "id",
    "supplierName",
    "note",
    "purchasedOn",
    "dueOn",
    "totalMinor",
    "paidMinor",
    "payableMinor",
    "status",
    "idempotencyKey",
    "payments",
    "createdAt",
    "updatedAt",
  ],
  supplierPayment: ["id", "amountMinor", "occurredOn", "recordedAt", "idempotencyKey", "note"],
  cashWallet: ["id", "name", "kind", "createdAt", "createdOperationKey"],
  cashEntry: [
    "id",
    "walletId",
    "type",
    "occurredOn",
    "recordedAt",
    "cashDeltaMinor",
    "note",
    "reason",
    "operationKey",
    "transferId",
    "reversesEntryId",
  ],
  material: ["id", "name", "unit", "createdAt", "createdOperationKey"],
  inventoryMovement: [
    "id",
    "materialId",
    "type",
    "occurredOn",
    "recordedAt",
    "quantityDeltaMilli",
    "valueDeltaMinor",
    "note",
    "reason",
    "operationKey",
    "purchaseId",
    "orderId",
    "reversesMovementId",
  ],
  catalogItem: ["id", "kind", "name", "unitLabel", "active", "createdAt", "updatedAt", "createdOperationKey"],
};

function assertKeysWithin(label: string, value: Record<string, unknown>, allowed: string[]): void {
  const extra = Object.keys(value).filter(key => !allowed.includes(key));
  if (extra.length > 0) throw new Error(`عهدة ٨/١٧: مفاتيح حديثة مهربة في ${label}: ${extra.join(", ")}`);
}

function auditFixture817(file: typeof file817): void {
  assertKeysWithin("file", file as Record<string, unknown>, SURFACE_817.file!);
  assertKeysWithin("snapshot", file.data as Record<string, unknown>, SURFACE_817.snapshot!);
  assertKeysWithin("profile", file.data.profile, SURFACE_817.profile!);
  assertKeysWithin("preferences", file.data.preferences, SURFACE_817.preferences!);
  for (const draft of file.data.drafts) {
    assertKeysWithin("draft", draft as Record<string, unknown>, SURFACE_817.draft!);
    for (const snapshot of draft.costSnapshots) {
      assertKeysWithin(
        "draftCostSnapshot",
        snapshot as unknown as Record<string, unknown>,
        SURFACE_817.draftCostSnapshot!,
      );
      for (const item of snapshot.materialItems)
        assertKeysWithin(
          "draftCostMaterial",
          item as Record<string, unknown>,
          SURFACE_817.draftCostMaterial!,
        );
    }
  }
  for (const stored of file.data.orders) {
    assertKeysWithin("storedOrder", stored as unknown as Record<string, unknown>, SURFACE_817.storedOrder!);
    assertKeysWithin("order", stored.order as unknown as Record<string, unknown>, SURFACE_817.order!);
    for (const event of stored.order.events)
      assertKeysWithin("orderEvent", event as unknown as Record<string, unknown>, SURFACE_817.orderEvent!);
    for (const snapshot of stored.order.costSnapshots) {
      assertKeysWithin(
        "costSnapshot",
        snapshot as unknown as Record<string, unknown>,
        SURFACE_817.costSnapshot!,
      );
      assertKeysWithin(
        "costSnapshotInput",
        snapshot.input as unknown as Record<string, unknown>,
        SURFACE_817.costSnapshotInput!,
      );
      for (const item of snapshot.input.materialItems)
        assertKeysWithin("materialCostItem", item as Record<string, unknown>, SURFACE_817.materialCostItem!);
    }
  }
  for (const schedule of file.data.schedules) {
    assertKeysWithin("schedule", schedule as unknown as Record<string, unknown>, SURFACE_817.schedule!);
    for (const event of schedule.events)
      assertKeysWithin(
        "scheduleEvent",
        event as unknown as Record<string, unknown>,
        SURFACE_817.scheduleEvent!,
      );
  }
  for (const event of file.data.financialEvents)
    assertKeysWithin(
      "financialEvent",
      event as unknown as Record<string, unknown>,
      SURFACE_817.financialEvent!,
    );
  for (const purchase of file.data.supplierPurchases) {
    assertKeysWithin(
      "supplierPurchase",
      purchase as unknown as Record<string, unknown>,
      SURFACE_817.supplierPurchase!,
    );
    for (const payment of purchase.payments)
      assertKeysWithin("supplierPayment", payment as Record<string, unknown>, SURFACE_817.supplierPayment!);
  }
  for (const wallet of file.data.cashWallets)
    assertKeysWithin("cashWallet", wallet as unknown as Record<string, unknown>, SURFACE_817.cashWallet!);
  for (const entry of file.data.cashContinuityEntries)
    assertKeysWithin("cashEntry", entry as unknown as Record<string, unknown>, SURFACE_817.cashEntry!);
  for (const material of file.data.materials)
    assertKeysWithin("material", material as unknown as Record<string, unknown>, SURFACE_817.material!);
  for (const movement of file.data.inventoryMovements)
    assertKeysWithin(
      "inventoryMovement",
      movement as unknown as Record<string, unknown>,
      SURFACE_817.inventoryMovement!,
    );
  for (const item of file.data.catalogItems)
    assertKeysWithin("catalogItem", item as unknown as Record<string, unknown>, SURFACE_817.catalogItem!);
}

/* الملف الأدنى الصالح لكل زوج مقبول — بوابة الزوج وحدها هي المفحوصة هنا:
 * البيانات تعبر الترحيل والتحقق كاملين فتنجح المعاينة. زوج الإصدار الحالي
 * يحمل مظروفه الإلزامي (بصمة + عدادات) كما ينتجه المصدر الحقيقي. */
function minimalFileForPair(version: number, schemaVersion: number): string {
  const data = {
    profile: null,
    preferences: null,
    drafts: [],
    orders: [],
    schedules: [],
    financialEvents: [],
    /* زوج الإصدار الحالي يصدر دائمًا بعائلة الوقت الفعلي (readSnapshot)؛
     * مسار الترحيل يتركها undefined للملف الحالي فتفشل البنية إن غابت. */
    actualTimeRecords: [] as unknown[],
  };
  const isCurrent = version === localExportVersion && schemaVersion === localSchemaVersion;
  return JSON.stringify({
    format: "micro-prototype-local-export",
    version,
    schemaVersion,
    exportedAt: "2026-08-24T10:00:00.000Z",
    data,
    ...(isCurrent
      ? {
          integrity: { algorithm: "sha256", digest: syncSha256Hex(JSON.stringify(data)) },
          counts: {
            orders: 0,
            directSales: 0,
            financialEvents: 0,
            supplierPurchases: 0,
            cashWallets: 0,
            cashContinuityEntries: 0,
            materials: 0,
            inventoryMovements: 0,
            inventoryShortages: 0,
            assets: 0,
            loans: 0,
            schedules: 0,
            drafts: 0,
          },
        }
      : {}),
  });
}

const ACCEPTED_PAIRS: [number, number][] = [
  [27, 35],
  [26, 34],
  [25, 33],
  [24, 32],
  [23, 31],
  [22, 30],
  [21, 29],
  [20, 28],
  [19, 27],
  [18, 27],
  [17, 26],
  [16, 25],
  [15, 24],
  [14, 23],
  [13, 22],
  [12, 21],
  [11, 20],
  [10, 19],
  [9, 18],
  [8, 17],
  [7, 15],
  [6, 14],
];

const REJECTED_PAIRS: [number, number][] = [
  [8, 16],
  [27, 34],
  [28, 35],
  [5, 12],
  [4, 10],
  [3, 7],
  [2, 6],
  [1, 5],
  [99, 99],
];

const transfers = () => new LocalTransferService(new MemoryLocalStore(), now);

describe("released export pair gate — one authoritative source", () => {
  it("accepts every released pair with a minimal valid snapshot (gate + migration + validation)", () => {
    for (const [version, schemaVersion] of ACCEPTED_PAIRS) {
      const prepared = transfers().prepareImport(minimalFileForPair(version, schemaVersion));
      if (!prepared.ok)
        throw new Error(`الزوج ${version}/${schemaVersion} رُفض رغم أنه صدر فعلًا: ${prepared.message}`);
      expect(prepared.value.file.schemaVersion).toBe(localSchemaVersion);
      expect(prepared.value.file.version).toBe(localExportVersion);
    }
  });

  it("rejects never-released and unknown pairs before touching stored data", () => {
    for (const [version, schemaVersion] of REJECTED_PAIRS) {
      const prepared = transfers().prepareImport(minimalFileForPair(version, schemaVersion));
      expect(prepared.ok).toBe(false);
      if (prepared.ok) continue;
      expect(prepared.message).toContain("إصدار الملف غير مدعوم");
    }
  });

  it("rejects string-coerced pair values instead of matching them against the released set", () => {
    const text = minimalFileForPair(8, 17).replace('"version":8', '"version":"8"');
    const prepared = transfers().prepareImport(text);
    expect(prepared.ok).toBe(false);
    if (prepared.ok) return;
    expect(prepared.message).toContain("إصدار الملف غير مدعوم");
  });
});

describe("historical 8/17 pair (commit 570eba1) — faithful fixture", () => {
  it("fixture passes the machine keys-audit against the 570eba1 type surface", () => {
    auditFixture817(file817);
  });

  it("accepts, migrates, and round-trips the faithful 8/17 fixture without inventing values", async () => {
    auditFixture817(file817);
    const prepared = transfers().prepareImport(JSON.stringify(file817));
    if (!prepared.ok) throw new Error(prepared.message);
    const migrated = prepared.value.file;
    expect(migrated.version).toBe(localExportVersion);
    expect(migrated.schemaVersion).toBe(localSchemaVersion);
    /* الترحيل بلا اختراع: العائلات الغائبة في ٨/١٧ فراغ/null لا قيم مزعومة. */
    expect(migrated.data.assets).toEqual([]);
    expect(migrated.data.loans).toEqual([]);
    expect(migrated.data.inventoryShortages).toEqual([]);
    expect(migrated.data.ownerMovements).toEqual([]);
    expect(migrated.data.directSales).toEqual([]);
    expect(migrated.data.costEstimates).toEqual([]);
    /* الحقول المستحدثة على السجلات القائمة = قيم «غير معلن» فقط. */
    expect(migrated.data.orders[0]?.followUpSummary).toBeNull();
    expect(migrated.data.orders[0]?.followUpEvents).toEqual([]);
    expect(migrated.data.financialEvents[0]?.amanahDeltaMinor).toBe(0);
    expect(migrated.data.financialEvents[0]?.assetDeltaMinor).toBe(0);
    expect(migrated.data.supplierPurchases[0]?.materialId).toBeNull();
    expect(migrated.data.schedules[0]?.recurrenceId).toBeNull();
    expect(migrated.data.materials[0]?.tracking).toBeNull();
    expect(migrated.data.inventoryMovements[0]?.costKnowledge).toBe("known");
    /* الأصل التاريخي محفوظ كما هو — لا حذف ولا تعديل. */
    expect(migrated.data.orders[0]?.order.collectedMinor).toBe(12000);
    expect(migrated.data.orders[0]?.order.events.length).toBe(3);
    expect(migrated.data.financialEvents[0]?.amountMinor).toBe(20000);
    expect(migrated.data.supplierPurchases[0]?.paidMinor).toBe(2100);
    /* دورة كاملة: الاستيراد ثم التصدير ثم معاينة الملف الخارج. */
    const store = new MemoryLocalStore();
    const targetTransfers = new LocalTransferService(store, now);
    const confirmed = await targetTransfers.confirmImport(prepared.value);
    if (!confirmed.ok) throw new Error(confirmed.message);
    expect(confirmed.value.orders).toBe(1);
    expect(confirmed.value.financialEvents).toBe(1);
    expect(confirmed.value.supplierPurchases).toBe(1);
    const exported = await targetTransfers.createVerifiedExport();
    if (!exported.ok) throw new Error(exported.message);
    const rePrepared = transfers().prepareImport(JSON.stringify(exported.value.file));
    if (!rePrepared.ok) throw new Error(rePrepared.message);
    expect(rePrepared.value.summary.orders).toBe(1);
    expect(rePrepared.value.summary.financialEvents).toBe(1);
  });

  it("accepts an 8/17 file carrying a spurious modern envelope by regenerating honest values", () => {
    /* العهدة ٨/١٧ بلا مظروف؛ لو حمل ملف معدل يدويًا عدادات زائفة تُتجاهل
     * وتُعاد من البيانات المُرحَّلة نفسها — البصمة غير موجودة أصلًا فلا
     * تلاعب يمر من هذا الطريق (تثبيت السلوك لا تخفيفه). */
    const tampered = {
      ...JSON.parse(JSON.stringify(file817)),
      counts: { orders: 999, financialEvents: 1 },
      appVersion: "fake-app",
    };
    const prepared = transfers().prepareImport(JSON.stringify(tampered));
    if (!prepared.ok) throw new Error(prepared.message);
    expect(prepared.value.file.counts?.orders).toBe(1);
    expect(prepared.value.file.appVersion).toBe("fake-app");
  });

  it("rejects an 8/17 file with duplicated payment idempotency keys inside one purchase", () => {
    const tampered = JSON.parse(JSON.stringify(file817)) as typeof file817;
    const purchase = tampered.data.supplierPurchases[0]!;
    purchase.payments = [
      ...purchase.payments,
      {
        id: "purchase-817-1:extra",
        amountMinor: 500,
        occurredOn: "2026-08-22",
        recordedAt: "2026-08-22T09:00:00.000Z",
        idempotencyKey: "purchase-817:initial",
        note: "دفعة مكررة المفتاح",
      },
    ];
    purchase.paidMinor = 2600;
    purchase.payableMinor = 5800;
    const prepared = transfers().prepareImport(JSON.stringify(tampered));
    expect(prepared.ok).toBe(false);
  });

  it("rejects an 8/17 file with a duplicated order event (idempotencyKey, type) pair", () => {
    const tampered = JSON.parse(JSON.stringify(file817)) as typeof file817;
    const events = tampered.data.orders[0]!.order.events as unknown[];
    events.push(JSON.parse(JSON.stringify(events[0]!)));
    const prepared = transfers().prepareImport(JSON.stringify(tampered));
    expect(prepared.ok).toBe(false);
  });

  it("accepts the same event id under two different types (collection and its reversal signature)", () => {
    /* نطاق التفرُّد (المفتاح، النوع) داخل الطلب — نفس المفتاح بنوعين مسموح
     * كما يسمح مسار الكتابة (مفتاح العملية الواحد للقبضة وتراجعها)؛ التفرد
     * الأعمى على الهوية وحدها كان سيرفض ملفات صادقة. */
    const tampered = JSON.parse(JSON.stringify(file817)) as typeof file817;
    const events = tampered.data.orders[0]!.order.events as {
      id: string;
      type: string;
      idempotencyKey: string;
      createdAt: string;
    }[];
    const first = events[0]!;
    events.push({ ...first, type: "price_approved" });
    const prepared = transfers().prepareImport(JSON.stringify(tampered));
    if (!prepared.ok) throw new Error(prepared.message);
    expect(prepared.value.file.data.orders[0]?.order.events.length).toBe(4);
  });
});

describe("current envelope counters — strict tamper detection", () => {
  async function currentFileWithOneEvent(): Promise<LocalExportFile> {
    const store = new MemoryLocalStore();
    const transfers = new LocalTransferService(store, now);
    const saved = await store.saveFinancialEvent({
      ...financialEvent817,
    });
    if (!saved.ok) throw new Error(saved.message);
    const exported = await transfers.createExport();
    if (!exported.ok) throw new Error(exported.message);
    return exported.value;
  }

  const tamperCounts = (file: LocalExportFile, mutate: (counts: Record<string, unknown>) => void): string => {
    const copy = JSON.parse(JSON.stringify(file)) as LocalExportFile & { counts: Record<string, unknown> };
    mutate(copy.counts);
    return JSON.stringify(copy);
  };

  it("accepts an untampered current export", async () => {
    const file = await currentFileWithOneEvent();
    const prepared = transfers().prepareImport(JSON.stringify(file));
    if (!prepared.ok) throw new Error(prepared.message);
    expect(prepared.value.summary.financialEvents).toBe(1);
  });

  it.each([
    ["missing key", (counts: Record<string, unknown>) => delete counts.orders],
    ["string value", (counts: Record<string, unknown>) => (counts.orders = "1")],
    ["NaN", (counts: Record<string, unknown>) => (counts.orders = Number.NaN)],
    ["Infinity", (counts: Record<string, unknown>) => (counts.orders = Number.POSITIVE_INFINITY)],
    ["float", (counts: Record<string, unknown>) => (counts.orders = 1.5)],
    ["negative", (counts: Record<string, unknown>) => (counts.orders = -1)],
    ["mismatched", (counts: Record<string, unknown>) => (counts.orders = 7)],
    ["unknown extra key", (counts: Record<string, unknown>) => (counts.somethingElse = 0)],
  ])("rejects a current file with counters tampered by %s", async (_label, mutate) => {
    const file = await currentFileWithOneEvent();
    const text = tamperCounts(file, mutate as (counts: Record<string, unknown>) => void);
    const prepared = transfers().prepareImport(text);
    expect(prepared.ok).toBe(false);
    if (prepared.ok) return;
    expect(prepared.message).toContain("عدادات الملف");
  });

  it("pins negative-zero as equal to zero (JSON number identity, not tamper)", async () => {
    const file = await currentFileWithOneEvent();
    const text = tamperCounts(file, counts => (counts.orders = -0));
    const prepared = transfers().prepareImport(text);
    expect(prepared.ok).toBe(true);
  });
});
