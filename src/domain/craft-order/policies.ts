import type {
  CostSnapshot,
  CostSnapshotInput,
  CraftOrder,
  CreateCraftOrderInput,
  DepositSettlementDecision,
  KnowledgeGap,
  KnowledgeState,
  MaterialCostItem,
  MoneyMinor,
  OrderEvent,
  OrderEventType,
  OrderStatus,
  OrderTransitionInput,
  ResultStatus,
  ReviseAgreedPriceInput,
  ReverseCollectionInput,
  SettlementStatus,
} from "./types.js";
import {
  JOD,
  assertNonNegativeInteger,
  fieldLabelAr,
  quantityMilliExact,
  roundHalfUp,
} from "../shared/index.js";

const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  draft: ["provisional_agreement", "postponed", "needs_review"],
  provisional_agreement: ["confirmed", "postponed", "needs_review"],
  confirmed: ["in_progress", "postponed", "needs_review"],
  in_progress: ["ready", "postponed", "needs_review"],
  ready: ["delivered", "postponed", "needs_review"],
  delivered: ["settled", "needs_review"],
  settled: [],
  postponed: ["provisional_agreement", "confirmed", "needs_review"],
  cancelled: [],
  needs_review: ["provisional_agreement", "confirmed"],
};

/** Arabic names of the order statuses as contract 02 §الحالات defines them, so transition refusals reach the owner in their own words. */
const ORDER_STATUS_AR: Record<OrderStatus, string> = {
  draft: "مسودة",
  provisional_agreement: "اتفاق مبدئي",
  confirmed: "مؤكد",
  in_progress: "قيد التنفيذ",
  ready: "جاهز",
  delivered: "تم التسليم",
  settled: "تمت التسوية",
  postponed: "مؤجل",
  cancelled: "ملغى",
  needs_review: "يحتاج مراجعة",
};

function assertPositiveInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`أدخل ${fieldLabelAr(field)} رقمًا صحيحًا موجبًا بالوحدات الصغرى.`);
  }
}

function assertValidQuantity(value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("أدخل الكمية رقمًا أكبر من صفر.");
  }
  if (quantityMilliExact(value) === null) {
    throw new Error("أدخل الكمية بدقة أجزاء من ألف؛ الدقة الأعلى غير ممثلة في هذا الإصدار.");
  }
}

function assertValidDate(value: string, field: string): void {
  if (!value.trim() || Number.isNaN(Date.parse(value))) {
    throw new Error(`أدخل ${fieldLabelAr(field)} تاريخًا صحيحًا.`);
  }
}

function ammanLocalDate(isoTimestamp: string): string | null {
  if (Number.isNaN(Date.parse(isoTimestamp))) return null;
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Amman",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(isoTimestamp));
  const part = (type: string) => parts.find(entry => entry.type === type)?.value ?? null;
  const year = part("year");
  const month = part("month");
  const day = part("day");
  return year && month && day ? `${year}-${month}-${day}` : null;
}
function localDateMinusDays(localDate: string, days: number): string {
  const [year, month, day] = localDate.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! - days)).toISOString().slice(0, 10);
}

function assertFreshnessDays(value: number | null | undefined): void {
  if (value !== null && value !== undefined && (!Number.isInteger(value) || value < 0)) {
    throw new Error("أدخل أيام صلاحية السعر رقمًا صحيحًا غير سالب.");
  }
}

function assertIdempotencyKey(value: string): void {
  if (!value.trim()) throw new Error("أكمل مفتاح العملية قبل الحفظ.");
}

function cloneCostSnapshotInput(input: CostSnapshotInput): CostSnapshotInput {
  return {
    ...input,
    materialItems: input.materialItems.map(item => ({ ...item })),
    time: input.time ? { ...input.time } : null,
  };
}

function freezeCostSnapshot(snapshot: CostSnapshot): CostSnapshot {
  const input = cloneCostSnapshotInput(snapshot.input);
  input.materialItems.forEach(item => Object.freeze(item));
  Object.freeze(input.materialItems);
  if (input.time) Object.freeze(input.time);
  Object.freeze(input);
  return Object.freeze({ ...snapshot, input }) as CostSnapshot;
}

function assertSnapshotSelfConsistency(snapshot: CostSnapshot): void {
  if (snapshot.quantity !== snapshot.input.quantity) {
    throw new Error("كمية نسخة التكلفة يجب أن تطابق كمية الإدخال.");
  }
}

function hasNoCostComponentInput(input: CostSnapshotInput): boolean {
  return (
    input.materialItems.length === 0 &&
    input.time === null &&
    input.packagingMinor === 0 &&
    input.deliveryMinor === 0 &&
    input.wasteMinor === 0
  );
}
function hasEstimateInput(input: CostSnapshotInput): boolean {
  return (
    input.materialItems.some(item => item.confidence === "estimated") ||
    input.time?.confidence === "estimated"
  );
}
function hasVariableCostInput(input: CostSnapshotInput): boolean {
  return input.materialItems.some(item => item.source === "estimate");
}
function hasIncompleteTimeInput(input: CostSnapshotInput): boolean {
  return (
    input.time === null ||
    input.time.minutes === null ||
    input.time.hourlyRateMinor === null ||
    input.time.minutes === 0 ||
    input.time.hourlyRateMinor === 0
  );
}
function hasStaleMaterialInput(input: CostSnapshotInput): boolean {
  if (input.freshnessDays === null || input.freshnessDays === undefined) return false;
  // Freshness is a calendar-date question in the owner's day (Asia/Amman), not an instant comparison:
  // a price dated today stays fresh even when the snapshot was recorded after Amman midnight.
  const createdLocalDate = ammanLocalDate(input.createdAt);
  if (createdLocalDate === null) return false;
  const oldestAllowed = localDateMinusDays(createdLocalDate, input.freshnessDays);
  return input.materialItems.some(item => item.priceDate < oldestAllowed);
}

function determineKnowledgeState(input: CostSnapshotInput): KnowledgeState {
  if (hasNoCostComponentInput(input)) return "incomplete";
  if (hasIncompleteTimeInput(input)) return "incomplete";
  if (hasStaleMaterialInput(input)) return "stale";
  if (hasVariableCostInput(input)) return "variable";
  if (hasEstimateInput(input)) return "estimated";
  return "known";
}

/** القرار ٢٢: القائمة الكاملة للنقص دفعة واحدة، وكل نقص يحمل علامته —
 * إلزامي (يمنع نتيجة صادقة) أو اختياري (يحسّن الدقة). */
export function deriveKnowledgeGaps(input: CostSnapshotInput): readonly KnowledgeGap[] {
  const gaps: KnowledgeGap[] = [];
  if (hasNoCostComponentInput(input)) gaps.push({ id: "no_cost_components", mandatory: true });
  if (hasIncompleteTimeInput(input)) gaps.push({ id: "time_incomplete", mandatory: true });
  if (hasStaleMaterialInput(input)) gaps.push({ id: "stale_material_price", mandatory: false });
  if (hasEstimateInput(input)) gaps.push({ id: "estimated_item", mandatory: false });
  if (hasVariableCostInput(input)) gaps.push({ id: "variable_cost_source", mandatory: false });
  return gaps;
}

/** النسخ القديمة بلا حقل knowledgeGaps تُشتق فجواتها من مدخلاتها المحفوظة عند القراءة. */
export function knowledgeGapsOf(snapshot: CostSnapshot): readonly KnowledgeGap[] {
  return snapshot.knowledgeGaps ?? deriveKnowledgeGaps(snapshot.input);
}

function materialItemCostMinor(item: MaterialCostItem): number {
  if (!item.name.trim() || !item.unit.trim()) {
    throw new Error("أكمل اسم المادة ووحدتها قبل الحساب.");
  }
  if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
    throw new Error(`أدخل كمية المادة ${item.name} رقمًا أكبر من صفر.`);
  }
  assertNonNegativeInteger(item.unitPriceMinor, `سعر وحدة ${item.name}`);
  assertValidDate(item.priceDate, `تاريخ سعر ${item.name}`);
  const quantityMilli = quantityMilliExact(item.quantity);
  if (quantityMilli === null) throw new Error(`أدخل كمية المادة ${item.name} بدقة أجزاء من ألف.`);
  const itemCostMinor = roundHalfUp(quantityMilli * item.unitPriceMinor, 1000);
  if (itemCostMinor === null)
    throw new Error(`تكلفة المادة ${item.name} تتجاوز الدقة الآمنة للأرقام الصحيحة.`);
  return itemCostMinor;
}

export function calculateCostSnapshot(id: string, input: CostSnapshotInput): CostSnapshot {
  if (!id.trim()) throw new Error("أكمل معرّف نسخة التكلفة قبل الحساب.");
  if (input.currency !== JOD) throw new Error("العملة المدعومة في هذا الإصدار هي الدينار الأردني فقط.");
  assertValidQuantity(input.quantity);
  assertValidDate(input.createdAt, "createdAt");
  assertFreshnessDays(input.freshnessDays);
  assertNonNegativeInteger(input.packagingMinor, "packagingMinor");
  assertNonNegativeInteger(input.deliveryMinor, "deliveryMinor");
  assertNonNegativeInteger(input.wasteMinor, "wasteMinor");
  assertNonNegativeInteger(input.safetyBufferMinor, "safetyBufferMinor");

  const materialCostMinor = input.materialItems.reduce(
    (total, item) => total + materialItemCostMinor(item),
    0,
  );

  const timeCostMinor = input.time
    ? (() => {
        const { minutes, hourlyRateMinor } = input.time!;
        if (minutes !== null && (!Number.isFinite(minutes) || minutes < 0)) {
          throw new Error("أدخل دقائق الوقت رقمًا غير سالب.");
        }
        if (hourlyRateMinor !== null) {
          assertNonNegativeInteger(hourlyRateMinor, "hourlyRateMinor");
        }
        if (minutes === null || hourlyRateMinor === null) return 0;
        const timeCostMinor = roundHalfUp(minutes * hourlyRateMinor, 60);
        if (timeCostMinor === null) throw new Error("تكلفة الوقت تتجاوز الدقة الآمنة للأرقام الصحيحة.");
        return timeCostMinor;
      })()
    : 0;

  const plannedCostMinor =
    materialCostMinor + timeCostMinor + input.packagingMinor + input.deliveryMinor + input.wasteMinor;
  const unitCostMinor = Math.ceil(plannedCostMinor / input.quantity);
  const priceFloorMinor = unitCostMinor + input.safetyBufferMinor;

  return freezeCostSnapshot({
    id,
    currency: input.currency,
    materialCostMinor,
    timeCostMinor,
    packagingMinor: input.packagingMinor,
    deliveryMinor: input.deliveryMinor,
    wasteMinor: input.wasteMinor,
    plannedCostMinor,
    unitCostMinor,
    priceFloorMinor,
    quantity: input.quantity,
    knowledgeState: determineKnowledgeState(input),
    knowledgeGaps: deriveKnowledgeGaps(input),
    input: cloneCostSnapshotInput(input),
    createdAt: input.createdAt,
  });
}

function eventExists(order: CraftOrder, idempotencyKey: string, eventType: OrderEventType): boolean {
  return order.events.some(event => event.idempotencyKey === idempotencyKey && event.type === eventType);
}

function assertNotLockedDeliveredReview(order: CraftOrder): void {
  if (order.status === "needs_review" && hasDeliveredEvent(order)) {
    throw new Error("الطلب المسلّم لا يخرج من «يحتاج مراجعة» إلا بتصحيح موثق صريح.");
  }
}

function hasDeliveredEvent(order: CraftOrder): boolean {
  return order.events.some(event => event.type === "status_changed" && event.toStatus === "delivered");
}

function appendEvent(order: CraftOrder, event: OrderEvent): CraftOrder {
  if (eventExists(order, event.idempotencyKey, event.type)) return order;
  return { ...order, events: [...order.events, event] };
}

function appendStatusChanged(
  order: CraftOrder,
  fromStatus: OrderStatus,
  toStatus: OrderStatus,
  idempotencyKey: string,
  createdAt: string,
  note?: string,
): CraftOrder {
  if (fromStatus === toStatus) return order;
  return appendEvent(order, {
    id: `${order.id}:status:${idempotencyKey}`,
    type: "status_changed",
    idempotencyKey: `status:${idempotencyKey}`,
    createdAt,
    ...(note ? { note } : {}),
    fromStatus,
    toStatus,
  });
}

function withSettlement(order: CraftOrder): CraftOrder {
  const receivableMinor = Math.max(order.agreedPriceMinor - order.collectedMinor, 0);
  const settlementStatus =
    order.collectedMinor === 0 ? "unpaid" : receivableMinor === 0 ? "paid" : "partially_paid";

  return { ...order, receivableMinor, settlementStatus };
}

function resultStatusForKnowledge(knowledgeState: KnowledgeState): ResultStatus {
  if (knowledgeState === "known") return "final";
  if (knowledgeState === "incomplete" || knowledgeState === "partial") {
    return "incomplete";
  }
  if (knowledgeState === "stale" || knowledgeState === "variable") {
    return "review_required";
  }
  return "estimated";
}

export function createCraftOrder(input: CreateCraftOrderInput): CraftOrder {
  if (!input.id.trim()) throw new Error("أكمل معرّف الطلب قبل الحفظ.");
  if (!input.customerName.trim()) throw new Error("أكمل اسم العميل قبل الحفظ.");
  if (!input.itemName.trim()) throw new Error("أكمل اسم العمل قبل الحفظ.");
  if (!input.specifications.trim()) throw new Error("أكمل المواصفات قبل الحفظ.");
  assertValidQuantity(input.quantity);
  assertPositiveInteger(input.agreedPriceMinor, "agreedPriceMinor");
  assertSnapshotSelfConsistency(input.costSnapshot);
  if (input.costSnapshot.quantity !== input.quantity) {
    throw new Error("كمية نسخة التكلفة يجب أن تطابق كمية الطلب.");
  }
  const safeCostSnapshot = freezeCostSnapshot(input.costSnapshot);

  const order: CraftOrder = {
    id: input.id,
    customerName: input.customerName,
    itemName: input.itemName,
    specifications: input.specifications,
    quantity: input.quantity,
    currency: input.costSnapshot.currency,
    agreedPriceMinor: input.agreedPriceMinor,
    costSnapshot: safeCostSnapshot,
    costSnapshots: Object.freeze([safeCostSnapshot]) as unknown as CostSnapshot[],
    status: "draft",
    settlementStatus: "unpaid",
    depositCollectedMinor: 0,
    depositSettlement: null,
    collectedMinor: 0,
    receivableMinor: input.agreedPriceMinor,
    recognizedRevenueMinor: 0,
    recognizedCostMinor: 0,
    profitIndicatorMinor: null,
    resultStatus: "incomplete",
    nextAction: "سجل الاتفاق أو راجع المواصفات",
    events: [],
    createdAt: input.createdAt,
  };

  return appendEvent(order, {
    id: `${input.id}:created`,
    type: "created",
    idempotencyKey: `${input.id}:created`,
    createdAt: input.createdAt,
  });
}

export function transitionOrder(order: CraftOrder, input: OrderTransitionInput): CraftOrder {
  assertIdempotencyKey(input.idempotencyKey);
  if (eventExists(order, input.idempotencyKey, "status_changed")) return order;
  assertNotLockedDeliveredReview(order);
  if (!ALLOWED_TRANSITIONS[order.status].includes(input.to)) {
    throw new Error(
      `انتقال غير مسموح من «${ORDER_STATUS_AR[order.status]}» إلى «${ORDER_STATUS_AR[input.to]}».`,
    );
  }
  if (input.to === "settled" && order.receivableMinor > 0 && order.settlementStatus !== "debt") {
    throw new Error("لا تُسوّى الطلب إلا بمتبقٍ صفري أو دين مسجل.");
  }

  const deliveredAction =
    order.receivableMinor > 0 ? "حصّل المتبقي أو سجل الدين" : "راجع النتيجة والخطوة التالية";
  const nextActionByStatus: Record<OrderStatus, string> = {
    draft: "سجل الاتفاق أو راجع المواصفات",
    provisional_agreement: "أكد السعر والموعد",
    confirmed: "ابدأ التنفيذ",
    in_progress: "سجل الجاهزية أو سبب التأجيل",
    ready: "سجل التسليم",
    delivered: deliveredAction,
    settled: "راجع النتيجة والخطوة التالية",
    postponed: "حدد موعد متابعة",
    cancelled: "راجع إغلاق الطلب وتسوية العربون إن وجدت",
    needs_review: "راجع التعارض أو النقص",
  };

  const next = {
    ...order,
    status: input.to,
    nextAction: nextActionByStatus[input.to],
  };
  const reviewSafe =
    input.to === "needs_review"
      ? { ...next, resultStatus: "review_required" as const, profitIndicatorMinor: null }
      : next;

  const recognized =
    input.to === "delivered" || input.to === "settled"
      ? (() => {
          const resultStatus = resultStatusForKnowledge(reviewSafe.costSnapshot.knowledgeState);
          const profitIndicatorMinor =
            resultStatus === "final"
              ? reviewSafe.agreedPriceMinor - reviewSafe.costSnapshot.plannedCostMinor
              : null;
          return {
            ...reviewSafe,
            recognizedRevenueMinor: reviewSafe.agreedPriceMinor,
            recognizedCostMinor: reviewSafe.costSnapshot.plannedCostMinor,
            profitIndicatorMinor,
            resultStatus,
          };
        })()
      : reviewSafe;

  const shouldSettleAfterDelivery =
    input.to === "delivered" && recognized.receivableMinor === 0 && recognized.settlementStatus === "paid";
  const statusAfterDelivery = shouldSettleAfterDelivery
    ? { ...recognized, status: "settled" as const, nextAction: "راجع النتيجة والخطوة التالية" }
    : recognized;
  const withDeliveryStatusEvent = shouldSettleAfterDelivery
    ? appendEvent(statusAfterDelivery, {
        id: `${order.id}:status:${input.idempotencyKey}`,
        type: "status_changed",
        idempotencyKey: `status:${input.idempotencyKey}`,
        createdAt: input.createdAt,
        fromStatus: "delivered",
        toStatus: "settled",
      })
    : statusAfterDelivery;

  return appendEvent(withDeliveryStatusEvent, {
    id: `${order.id}:${input.idempotencyKey}`,
    type: "status_changed",
    idempotencyKey: input.idempotencyKey,
    createdAt: input.createdAt,
    ...(input.note ? { note: input.note } : {}),
    fromStatus: order.status,
    toStatus: input.to,
  });
}

export function reviseOrderCost(
  order: CraftOrder,
  specifications: string,
  nextCostSnapshot: CostSnapshot,
  idempotencyKey: string,
  createdAt: string,
): CraftOrder {
  assertIdempotencyKey(idempotencyKey);
  if (eventExists(order, idempotencyKey, "specification_revised")) return order;
  assertNotLockedDeliveredReview(order);
  if (!specifications.trim()) throw new Error("أكمل المواصفات المعدلة قبل الحفظ.");
  assertSnapshotSelfConsistency(nextCostSnapshot);
  if (nextCostSnapshot.quantity !== order.quantity) {
    throw new Error("كمية نسخة التكلفة المعدلة يجب أن تطابق كمية الطلب.");
  }
  if (order.status === "delivered" || order.status === "settled" || order.status === "cancelled") {
    throw new Error(`لا يمكن تعديل مواصفات الطلب وهو في حالة «${ORDER_STATUS_AR[order.status]}».`);
  }
  const safeCostSnapshot = freezeCostSnapshot(nextCostSnapshot);

  const next: CraftOrder = {
    ...order,
    specifications,
    costSnapshot: safeCostSnapshot,
    costSnapshots: Object.freeze([...order.costSnapshots, safeCostSnapshot]) as unknown as CostSnapshot[],
    status: "needs_review",
    resultStatus: "review_required",
    profitIndicatorMinor: null,
    nextAction: "راجع السعر والمواصفات مع الزبون",
  };

  const withStatusEvent = appendStatusChanged(
    next,
    order.status,
    "needs_review",
    idempotencyKey,
    createdAt,
    "specification revision requires review",
  );
  return appendEvent(withStatusEvent, {
    id: `${order.id}:${idempotencyKey}`,
    type: "specification_revised",
    idempotencyKey,
    createdAt,
    note: `cost snapshot: ${safeCostSnapshot.id}`,
  });
}

export function collectDeposit(
  order: CraftOrder,
  amountMinor: MoneyMinor,
  idempotencyKey: string,
  createdAt: string,
): CraftOrder {
  assertIdempotencyKey(idempotencyKey);
  if (eventExists(order, idempotencyKey, "deposit_collected")) return order;
  assertNotLockedDeliveredReview(order);
  if (order.status === "delivered" || order.status === "settled" || order.status === "cancelled") {
    throw new Error(`لا يمكن تسجيل العربون والطلب في حالة «${ORDER_STATUS_AR[order.status]}».`);
  }
  assertPositiveInteger(amountMinor, "العربون");
  if (amountMinor + order.collectedMinor > order.agreedPriceMinor) {
    throw new Error("العربون لا يمكن أن يتجاوز السعر المتفق عليه.");
  }

  const next = withSettlement({
    ...order,
    depositCollectedMinor: order.depositCollectedMinor + amountMinor,
    collectedMinor: order.collectedMinor + amountMinor,
    nextAction: "نفذ الطلب ثم سجل التسليم",
  });

  return appendEvent(next, {
    id: `${order.id}:${idempotencyKey}`,
    type: "deposit_collected",
    idempotencyKey,
    createdAt,
    amountMinor,
  });
}

export function collectRemaining(
  order: CraftOrder,
  amountMinor: MoneyMinor,
  idempotencyKey: string,
  createdAt: string,
): CraftOrder {
  assertIdempotencyKey(idempotencyKey);
  if (eventExists(order, idempotencyKey, "collection_recorded")) return order;
  assertNotLockedDeliveredReview(order);
  if (order.status !== "delivered") {
    throw new Error("تحصيل المتبقي يتطلب طلبًا مسلّمًا.");
  }
  assertPositiveInteger(amountMinor, "مبلغ التحصيل");
  if (amountMinor + order.collectedMinor > order.agreedPriceMinor) {
    throw new Error("التحصيل لا يمكن أن يتجاوز السعر المتفق عليه.");
  }

  const next = withSettlement({
    ...order,
    collectedMinor: order.collectedMinor + amountMinor,
    nextAction: "راجع النتيجة والخطوة التالية",
  });
  const settled = next.receivableMinor === 0 ? { ...next, status: "settled" as const } : next;
  const withStatusEvent = appendStatusChanged(
    settled,
    order.status,
    settled.status,
    idempotencyKey,
    createdAt,
  );

  return appendEvent(withStatusEvent, {
    id: `${order.id}:${idempotencyKey}`,
    type: "collection_recorded",
    idempotencyKey,
    createdAt,
    amountMinor,
  });
}

/** A customer debt exists only when the owner explicitly registered the remainder as debt; a receivable on a draft or un-agreed order is not one. */
export function isRegisteredCustomerDebt(order: CraftOrder): boolean {
  return order.settlementStatus === "debt" && order.receivableMinor > 0;
}

export function registerDebt(order: CraftOrder, idempotencyKey: string, createdAt: string): CraftOrder {
  assertIdempotencyKey(idempotencyKey);
  if (eventExists(order, idempotencyKey, "debt_registered")) return order;
  assertNotLockedDeliveredReview(order);
  if (order.status !== "delivered") {
    throw new Error("تسجيل الدين يتطلب طلبًا مسلّمًا.");
  }
  if (order.receivableMinor <= 0) {
    throw new Error("لا يمكن تسجيل دين بلا مبلغ متبقٍ.");
  }

  const next: CraftOrder = {
    ...order,
    status: "settled",
    settlementStatus: "debt",
    nextAction: "تابع تحصيل الدين",
  };
  const withStatusEvent = appendStatusChanged(next, order.status, "settled", idempotencyKey, createdAt);

  return appendEvent(withStatusEvent, {
    id: `${order.id}:${idempotencyKey}`,
    type: "debt_registered",
    idempotencyKey,
    createdAt,
    amountMinor: order.receivableMinor,
  });
}

/** §٥-١٦ (المرحلة أ — رحلة ٢): الدين المسجل يبقى قابلًا للتحصيل — المال الذي حدث يجب أن
 * يكون قابلًا للتسجيل. التحصيل يقلل الدين بواقعته، ولا يعيد فتح الطلب ولا يغير حالته،
 * وحين يكتمل يصير الدين مقبوضًا كاملًا. */
export function collectRegisteredDebt(
  order: CraftOrder,
  amountMinor: MoneyMinor,
  idempotencyKey: string,
  createdAt: string,
): CraftOrder {
  assertIdempotencyKey(idempotencyKey);
  if (eventExists(order, idempotencyKey, "collection_recorded")) return order;
  if (!isRegisteredCustomerDebt(order)) throw new Error("تحصيل الدين المسجل يتطلب دينًا مسجلًا بعد التسليم.");
  assertPositiveInteger(amountMinor, "مبلغ التحصيل");
  if (amountMinor + order.collectedMinor > order.agreedPriceMinor)
    throw new Error("التحصيل لا يمكن أن يتجاوز السعر المتفق عليه.");

  const collectedMinor = order.collectedMinor + amountMinor;
  const receivableMinor = Math.max(order.agreedPriceMinor - collectedMinor, 0);
  const next: CraftOrder = {
    ...order,
    collectedMinor,
    receivableMinor,
    settlementStatus: receivableMinor === 0 ? "paid" : "debt",
    nextAction: receivableMinor === 0 ? "راجع النتيجة والخطوة التالية" : "تابع تحصيل الدين",
  };
  return appendEvent(next, {
    id: `${order.id}:${idempotencyKey}`,
    type: "collection_recorded",
    idempotencyKey,
    createdAt,
    amountMinor,
  });
}

/** المجموعة ٢ (§10.5 — أمر التنفيذ): تعديل السعر بعد الاتفاق تصحيحًا موثقًا داخل
 * الطلب نفسه. السعر الجديد يعيد فتح المتبقي (العربون والقبضات المسجلة تبقى كما
 * هي — لا يُمس الماضي)، والإيراد المعروف يتجدد فقط إن كان التسليم مسجلًا لأن
 * الإيراد يُعرف عند التسليم بالسعر المتفق يومها. الاتفاق الأصلي يبقى في الأحداث. */
/* حالة تسوية الطلب بعد تصحيح السعر: الدين المسجل يبقى دينًا حتى يسدد، وغيره
 * يوصف من المقبوض والمتبقي لا من الماضي. معيّن واحد تشترك فيه مسارات التصحيح. */
const settlementAfterPriceRevision = (order: CraftOrder, receivableMinor: number): SettlementStatus =>
  order.settlementStatus === "debt"
    ? receivableMinor === 0
      ? "paid"
      : "debt"
    : order.collectedMinor === 0
      ? "unpaid"
      : receivableMinor === 0
        ? "paid"
        : "partially_paid";

/* حالات الطلب التي يُسمح فيها بتصحيح السعر — الاتفاق قائم لا مسودة ولا تعارض. */
const assertPriceRevisionState = (order: CraftOrder) => {
  if (order.status === "draft") throw new Error("تعديل السعر بعد الاتفاق يتطلب اتفاقًا مسجلًا لا مسودة.");
  if (order.status === "cancelled") throw new Error("لا يُعدَّل سعر طلب ملغى؛ افتح طلبًا جديدًا إن لزم.");
  if (order.status === "needs_review") throw new Error("راجع تعارض الطلب أولًا ثم عدّل السعر بعدها.");
};

export function reviseAgreedPrice(order: CraftOrder, input: ReviseAgreedPriceInput): CraftOrder {
  assertIdempotencyKey(input.idempotencyKey);
  if (eventExists(order, input.idempotencyKey, "price_revised")) return order;
  assertPriceRevisionState(order);
  assertPositiveInteger(input.newPriceMinor, "السعر الجديد");
  if (input.newPriceMinor === order.agreedPriceMinor)
    throw new Error("السعر الجديد يطابق السعر الحالي؛ لا تصحيح بلا تغيير.");
  if (!input.reason.trim()) throw new Error("أكمل سبب تعديل السعر قبل الحفظ.");
  if (input.newPriceMinor < order.collectedMinor)
    throw new Error("السعر الجديد لا يمكن أن يقل عمّا قُبض فعليًا (بما فيه العربون).");

  const receivableMinor = Math.max(input.newPriceMinor - order.collectedMinor, 0);
  const wasDelivered = hasDeliveredEvent(order);
  const next: CraftOrder = {
    ...order,
    agreedPriceMinor: input.newPriceMinor,
    receivableMinor,
    settlementStatus: settlementAfterPriceRevision(order, receivableMinor),
    nextAction:
      receivableMinor > 0
        ? order.settlementStatus === "debt"
          ? "تابع تحصيل الدين وفق السعر المعدل"
          : "حصّل المتبقي أو سجّل الدين وفق السعر المعدل"
        : order.nextAction,
    recognizedRevenueMinor: wasDelivered ? input.newPriceMinor : order.recognizedRevenueMinor,
    profitIndicatorMinor:
      wasDelivered && order.resultStatus === "final"
        ? input.newPriceMinor - order.recognizedCostMinor
        : order.profitIndicatorMinor,
  };
  return appendEvent(next, {
    id: `${order.id}:${input.idempotencyKey}`,
    type: "price_revised",
    idempotencyKey: input.idempotencyKey,
    createdAt: input.createdAt,
    note: input.reason.trim(),
    amountMinor: input.newPriceMinor,
    fromPriceMinor: order.agreedPriceMinor,
    toPriceMinor: input.newPriceMinor,
  });
}

/** المجموعة ٢ (§10.3): التراجع الموثق عن قبضة مسجلة — الكاش المقبوض يعود للعميل
 * والمتبقي يعود مبلغًا مستحقًا؛ الإيراد المعروف والنتيجة لا يتأثران لأن التحصيل
 * لم يكن إيرادًا أصلًا (الإيراد يُعرف عند التسليم). علاقة التدقيق صريحة عبر
 * reversesEventId، والتراجع التراكمي لا يتجاوز القبضة المصدر. لا يُتراجع هنا عن
 * العربون (له مسار التسوية) ولا عن طلب ملغى. */
/* حالة التسوية بعد إرجاع قبضة: طلب مقفول عاد له متبقٍ يصبح دينًا، وغيره يوصف
 * من المقبوض الجديد والمتبقي. معيّن واحد — لا صياغة مزدوجة تتباعد. */
const settlementAfterCollectionReversal = (
  order: CraftOrder,
  collectedMinor: number,
  receivableMinor: number,
): SettlementStatus =>
  order.status === "settled"
    ? receivableMinor === 0
      ? "paid"
      : "debt"
    : collectedMinor === 0
      ? "unpaid"
      : receivableMinor === 0
        ? "paid"
        : "partially_paid";

export function reverseOrderCollection(order: CraftOrder, input: ReverseCollectionInput): CraftOrder {
  assertIdempotencyKey(input.idempotencyKey);
  if (eventExists(order, input.idempotencyKey, "collection_reversed")) return order;
  if (order.status === "cancelled")
    throw new Error("لا يُتراجع عن قبض في طلب ملغى؛ العربون له مسار تسويته الخاص.");
  const source = order.events.find(event => event.id === input.collectionEventId);
  if (!source || source.type !== "collection_recorded")
    throw new Error("اختر قبضة مسجلة على هذا الطلب قبل التراجع.");
  assertPositiveInteger(input.amountMinor, "مبلغ التراجع");
  const sourceAmount = source.amountMinor ?? 0;
  const reversedSoFar = order.events
    .filter(event => event.type === "collection_reversed" && event.reversesEventId === source.id)
    .reduce((sum, event) => sum + (event.amountMinor ?? 0), 0);
  if (reversedSoFar + input.amountMinor > sourceAmount)
    throw new Error("التراجع التراكمي لا يمكن أن يتجاوز مبلغ القبضة المسجلة.");
  if (!input.reason.trim()) throw new Error("أكمل سبب التراجع قبل الحفظ.");
  if (input.amountMinor > order.collectedMinor)
    throw new Error("مبلغ التراجع يتجاوز الكاش المقبوض على الطلب.");

  const collectedMinor = order.collectedMinor - input.amountMinor;
  const receivableMinor = Math.max(order.agreedPriceMinor - collectedMinor, 0);
  const next: CraftOrder = {
    ...order,
    collectedMinor,
    receivableMinor,
    settlementStatus: settlementAfterCollectionReversal(order, collectedMinor, receivableMinor),
    nextAction: receivableMinor > 0 ? "تابع تحصيل المتبقي" : order.nextAction,
  };
  return appendEvent(next, {
    id: `${order.id}:${input.idempotencyKey}`,
    type: "collection_reversed",
    idempotencyKey: input.idempotencyKey,
    createdAt: input.createdAt,
    note: input.reason.trim(),
    amountMinor: input.amountMinor,
    reversesEventId: source.id,
  });
}

export function cancelOrder(
  order: CraftOrder,
  reason: string,
  idempotencyKey: string,
  createdAt: string,
): CraftOrder {
  assertIdempotencyKey(idempotencyKey);
  if (eventExists(order, idempotencyKey, "cancelled")) return order;
  assertNotLockedDeliveredReview(order);
  if (order.status === "delivered" || order.status === "settled" || order.status === "cancelled") {
    throw new Error(`لا يمكن إلغاء الطلب وهو في حالة «${ORDER_STATUS_AR[order.status]}».`);
  }
  if (!reason.trim()) throw new Error("أكمل سبب الإلغاء قبل الحفظ.");

  const hasDeposit = order.depositCollectedMinor > 0;
  const next: CraftOrder = {
    ...order,
    status: "cancelled",
    settlementStatus: hasDeposit ? "cancelled_pending" : "cancelled",
    depositSettlement: hasDeposit ? "needs_review" : null,
    receivableMinor: 0,
    resultStatus: "review_required",
    profitIndicatorMinor: null,
    nextAction: hasDeposit ? "راجع قرار رد العربون أو الاحتفاظ به" : "أرشف سبب الإلغاء وراجع أي مواد مرتبطة",
  };

  const withStatusEvent = appendStatusChanged(
    next,
    order.status,
    "cancelled",
    idempotencyKey,
    createdAt,
    reason,
  );

  return appendEvent(withStatusEvent, {
    id: `${order.id}:${idempotencyKey}`,
    type: "cancelled",
    idempotencyKey,
    createdAt,
    note: reason,
  });
}

function settleDeposit(
  order: CraftOrder,
  decision: Exclude<DepositSettlementDecision, "needs_review">,
  eventType: Extract<OrderEventType, "deposit_refunded" | "deposit_retained">,
  amountMinor: MoneyMinor,
  reason: string,
  idempotencyKey: string,
  createdAt: string,
): CraftOrder {
  assertIdempotencyKey(idempotencyKey);
  if (eventExists(order, idempotencyKey, eventType)) return order;
  if (order.status !== "cancelled") {
    throw new Error("تسوية العربون تتطلب طلبًا ملغى.");
  }
  if (order.depositSettlement !== "needs_review") {
    throw new Error("تسوية هذا العربون محسومة سابقًا.");
  }
  if (!reason.trim()) throw new Error("أكمل سبب تسوية العربون قبل الحفظ.");
  assertPositiveInteger(amountMinor, "مبلغ التسوية");
  if (amountMinor !== order.depositCollectedMinor) {
    throw new Error("مبلغ التسوية يجب أن يساوي العربون المحصل.");
  }

  const isRefund = decision === "refund_deposit";
  const next: CraftOrder = {
    ...order,
    depositSettlement: decision,
    settlementStatus: isRefund ? "cancelled_refunded" : "cancelled_retained",
    collectedMinor: isRefund ? order.collectedMinor - amountMinor : order.collectedMinor,
    receivableMinor: 0,
    nextAction: "أرشف قرار تسوية الإلغاء",
  };

  return appendEvent(next, {
    id: `${order.id}:${idempotencyKey}`,
    type: eventType,
    idempotencyKey,
    createdAt,
    amountMinor,
    note: reason,
  });
}

export function settleDepositRefund(
  order: CraftOrder,
  amountMinor: MoneyMinor,
  reason: string,
  idempotencyKey: string,
  createdAt: string,
): CraftOrder {
  return settleDeposit(
    order,
    "refund_deposit",
    "deposit_refunded",
    amountMinor,
    reason,
    idempotencyKey,
    createdAt,
  );
}

export function settleDepositRetain(
  order: CraftOrder,
  amountMinor: MoneyMinor,
  reason: string,
  idempotencyKey: string,
  createdAt: string,
): CraftOrder {
  return settleDeposit(
    order,
    "retain_deposit",
    "deposit_retained",
    amountMinor,
    reason,
    idempotencyKey,
    createdAt,
  );
}
