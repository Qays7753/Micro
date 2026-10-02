/**
 * عهدة ٨/١٧ التاريخية الأمينة (التزام 570eba1 — 2026-08-23) كمصدر بيانات مشترك.
 * مستخرجة حرفيًا من اختبارها الأصلي (Wave 3A — ARCH-002: مصدر واحد للعهدة
 * بين اختبار الأزواج واختبار الذهبيات؛ نقلة ميكانيكية بلا أي تغيير قيم).
 * المستند: أشكال أنواع 570eba1 نفسها — لا قصّ ملف حالٍ.
 */

/* ─── عهدة ٨/١٧: الأشكال كما كانت عند 570eba1 ─── */

export const profile817 = {
  id: "local-profile",
  activityName: "ورشة أم جهاد",
  currency: "JOD",
  activityType: "custom_craft",
  createdAt: "2026-08-20T08:00:00.000Z",
  updatedAt: "2026-08-23T18:00:00.000Z",
};

export const preferences817 = {
  id: "local-preferences",
  theme: "light" as const,
  dailyScheduleCapacityMinutes: 240,
  updatedAt: "2026-08-23T18:00:00.000Z",
};

export const draft817 = {
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

export const orderCostSnapshot817 = {
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

export const order817 = {
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

export const schedule817 = {
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

export const financialEvent817 = {
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

export const supplierPurchase817 = {
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

export const cashWallet817 = {
  id: "wallet-817-1",
  name: "درج النقد",
  kind: "cash_drawer" as const,
  createdAt: "2026-08-21T09:00:00.000Z",
  createdOperationKey: "wallet-open-817",
};

export const cashEntry817 = {
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

export const material817 = {
  id: "material-817-1",
  name: "قماش قطني",
  unit: "meter" as const,
  createdAt: "2026-08-21T10:30:00.000Z",
  createdOperationKey: "material-open-817",
};

export const inventoryMovement817 = {
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

export const catalogItem817 = {
  id: "catalog-817-1",
  kind: "product" as const,
  name: "طقم وسائد مطرز",
  unitLabel: "طقم",
  active: true,
  createdAt: "2026-08-22T09:00:00.000Z",
  updatedAt: "2026-08-22T09:00:00.000Z",
  createdOperationKey: "catalog-open-817",
};

export const snapshot817 = {
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

export const file817 = {
  format: "micro-prototype-local-export",
  version: 8,
  schemaVersion: 17,
  exportedAt: "2026-08-24T10:00:00.000Z",
  data: snapshot817,
};
