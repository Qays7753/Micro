import type { CraftOrder, OrderEvent } from "@micro-domain/craft-order/index.js";
import type { InventoryMovement } from "@micro-domain/inventory-material/index.js";
import type { StoredCraftOrder } from "./types";

/* رقعة إغلاق المجموعة ٣ (D-031، مراجعة مستقلة): عكس التسليم الموثق كان يُكتب
 * فوق السجل الحي كتابة عمياء — تحصيلٌ متزامن يختفي، وعكسان بمفتاحين مختلفين
 * يُعيدان كتابة التاريخ. هذا الحارس النقي يُستدعى داخل حد الكتابة نفسه في
 * المحوّلين: فحص مفتاح الحتمية أولًا (إعادة التشغيل تُعاد كما هي)، ثم يجب أن
 * تطابق العلاقة بين السجل المخزّن والسجل الوارد عملية مجال واحدة بالضبط —
 * ذيل عكس التسليم كما يبنيه النطاق (حدثان من مسلّم/مسدَّد، أو حدث واحد من
 * الحالة المقفلة «يحتاج مراجعة» لأن appendStatusChanged لا يضيف حدث حالة
 * حين لا تتغير الحالة). أي علاقة أخرى تعني أن مسارًا آخر كتب بين قراءة
 * الخدمة وكتابتها — يُرفض الالتزام بـ storage_stale ولا يُكتب شيء. */

export type DeliveryReversalGuardResult =
  { ok: true; reused: boolean; deliveryEventId: string } | { ok: false; message: string };

const STALE_MESSAGE = "سجل الطلب تغيّر من مسار آخر بعد فتحك له — لم يُسجَّل شيء؛ أعد المحاولة.";
const REVERSAL_NEXT_ACTION = "راجع الطلب بعد التراجع الموثق عن التسليم — أعِد التنفيذ أو ألغِ موثقًا";

/* مقارنة بنيوية عميقة — النسخ الواردة منخفضة المرجع دائمًا (clone/structured
 * clone) فالمساواة بالمرجع ترفض كل عكس مشروع؛ null/undefined متكافئان هنا
 * لأن الحقول الاختيارية تُقرأ غائبة أو null عبر تطور المخطط لا فرق بينهما. */
function deepEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (left == null || right == null) return left == null && right == null;
  if (typeof left !== "object" || typeof right !== "object") return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => deepEqual(item, right[index]));
  }
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const keys = new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)]);
  return Array.from(keys).every(key => deepEqual(leftRecord[key], rightRecord[key]));
}

/* الحدث: كل حقوله العشرة — أي انحراف في حدث تاريخي يعني كتابة متزامنة. */
function sameOrderEvent(left: OrderEvent, right: OrderEvent): boolean {
  return (
    left.id === right.id &&
    left.type === right.type &&
    left.idempotencyKey === right.idempotencyKey &&
    left.createdAt === right.createdAt &&
    (left.note ?? null) === (right.note ?? null) &&
    (left.amountMinor ?? null) === (right.amountMinor ?? null) &&
    (left.fromStatus ?? null) === (right.fromStatus ?? null) &&
    (left.toStatus ?? null) === (right.toStatus ?? null) &&
    (left.fromPriceMinor ?? null) === (right.fromPriceMinor ?? null) &&
    (left.toPriceMinor ?? null) === (right.toPriceMinor ?? null) &&
    (left.reversesEventId ?? null) === (right.reversesEventId ?? null)
  );
}

function eventsIdentical(stored: readonly OrderEvent[], incoming: readonly OrderEvent[]): boolean {
  return (
    stored.length === incoming.length &&
    stored.every((event, index) => sameOrderEvent(event, incoming[index]!))
  );
}

/* كل حقول الطلب خارج الأحداث والحقول الستة التي يصفّرها العكس نفسه —
 * مقارنة عميقة عامة تُغطي كل حقل قائم ومستقبلي (الم snapshots/المتابعة/الكاش). */
function orderBasicsIdentical(stored: CraftOrder, incoming: CraftOrder): boolean {
  const strip = (order: CraftOrder) => {
    const {
      events: _events,
      status: _status,
      recognizedRevenueMinor: _recognizedRevenueMinor,
      recognizedCostMinor: _recognizedCostMinor,
      profitIndicatorMinor: _profitIndicatorMinor,
      resultStatus: _resultStatus,
      nextAction: _nextAction,
      ...rest
    } = order;
    return rest;
  };
  return deepEqual(strip(stored), strip(incoming));
}

/* غلاف السجل (StoredCraftOrder) عدا updatedAt الذي يكتبه الالتزام نفسه —
 * تعديل متابعة/مصدر اتفاق متزامن يُمسك هنا. */
function wrapperIdentical(stored: StoredCraftOrder, incoming: StoredCraftOrder): boolean {
  const strip = (record: StoredCraftOrder) => {
    const { updatedAt: _updatedAt, order: _order, ...rest } = record;
    return rest;
  };
  return deepEqual(strip(stored), strip(incoming));
}

/* ذيل عكس التسليم كما يبنيه النطاق: حدث حالة (مفتاحه status:K:status) ثم
 * حدث العكس، أو حدث العكس وحده من الحالة المقفلة. */
type ReversalTail = {
  key: string;
  deliveryEventId: string;
  tailLength: number;
  statusFrom: string | null;
};

function decodeReversalTail(order: CraftOrder): ReversalTail | null {
  const events = order.events;
  const last = events.length > 0 ? events[events.length - 1]! : null;
  if (!last || last.type !== "delivery_reversed" || !last.reversesEventId) return null;
  const key = last.idempotencyKey;
  if (last.id !== `${order.id}:${key}`) return null;
  const secondLast = events.length > 1 ? events[events.length - 2]! : null;
  const statusEvent =
    secondLast !== null &&
    secondLast.type === "status_changed" &&
    secondLast.idempotencyKey === `status:${key}:status`
      ? secondLast
      : null;
  if (statusEvent) {
    if (
      statusEvent.id !== `${order.id}:status:${key}:status` ||
      statusEvent.toStatus !== "needs_review" ||
      !statusEvent.fromStatus ||
      statusEvent.fromStatus === "needs_review"
    )
      return null;
    return {
      key,
      deliveryEventId: last.reversesEventId,
      tailLength: 2,
      statusFrom: statusEvent.fromStatus,
    };
  }
  return { key, deliveryEventId: last.reversesEventId, tailLength: 1, statusFrom: null };
}

/* الحقول الستة التي يعيّنها العكس حرفيًا — أي انحراف يعني حمولة ليست من
 * دالة النطاق (مزوّرة أو من نسخة أخرى). */
function reversalPostValuesIntact(order: CraftOrder): boolean {
  return (
    order.status === "needs_review" &&
    order.recognizedRevenueMinor === 0 &&
    order.recognizedCostMinor === 0 &&
    order.profitIndicatorMinor === null &&
    order.resultStatus === "review_required" &&
    order.nextAction === REVERSAL_NEXT_ACTION
  );
}

function lastDeliveredEventId(events: readonly OrderEvent[]): string | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]!;
    if (event.type === "status_changed" && event.toStatus === "delivered") return event.id;
  }
  return null;
}

function isReversalStatusEvent(event: OrderEvent): boolean {
  return event.type === "status_changed" && event.toStatus === "needs_review";
}

function validateDeliveryReversalCommitInternal(
  stored: StoredCraftOrder | undefined,
  incoming: StoredCraftOrder,
): DeliveryReversalGuardResult {
  if (stored === undefined) return { ok: false, message: STALE_MESSAGE };
  const tail = decodeReversalTail(incoming.order);
  if (tail === null) return { ok: false, message: STALE_MESSAGE };
  if (!reversalPostValuesIntact(incoming.order)) return { ok: false, message: STALE_MESSAGE };
  const storedEvents = stored.order.events;
  const incomingEvents = incoming.order.events;
  const baseLength = incomingEvents.length - tail.tailLength;

  /* ١. إعادة التشغيل بالمفتاح نفسه: العكس ملتزم سلفًا — يُعاد كما هو بلا
   * كتابة ولا مقارنة حقول (المفتاح هو العملية). */
  if (storedEvents.some(event => event.type === "delivery_reversed" && event.idempotencyKey === tail.key)) {
    return { ok: true, reused: true, deliveryEventId: tail.deliveryEventId };
  }

  const storedTargetsSameDelivery = storedEvents.some(
    event => event.type === "delivery_reversed" && event.reversesEventId === tail.deliveryEventId,
  );

  if (storedTargetsSameDelivery) {
    /* ٢. علاقة التصحيح نفسها (نفس حدث التسليم) ملتزمة بمفتاح آخر: إعادة
     * استخدام صادقة فقط إذا كان المخزّن «القاعدة + عكس ملتزم واحد» بالضبط —
     * أي تغيّر آخر بعده يعني قدمًا يجب أن يُرفض لا أن يُطمر. */
    if (baseLength < 0 || storedEvents.length !== incomingEvents.length)
      return { ok: false, message: STALE_MESSAGE };
    if (!eventsIdentical(storedEvents.slice(0, baseLength), incomingEvents.slice(0, baseLength)))
      return { ok: false, message: STALE_MESSAGE };
    const storedLast = storedEvents[storedEvents.length - 1]!;
    if (storedLast.type !== "delivery_reversed" || storedLast.reversesEventId !== tail.deliveryEventId)
      return { ok: false, message: STALE_MESSAGE };
    if (tail.tailLength === 2 && !isReversalStatusEvent(storedEvents[storedEvents.length - 2]!))
      return { ok: false, message: STALE_MESSAGE };
    if (!orderBasicsIdentical(stored.order, incoming.order)) return { ok: false, message: STALE_MESSAGE };
    if (!wrapperIdentical(stored, incoming)) return { ok: false, message: STALE_MESSAGE };
    return { ok: true, reused: true, deliveryEventId: tail.deliveryEventId };
  }

  /* ٣. عكس أول: القاعدة متطابقة حدثًا حدثًا، وذيل العكس يخرج من حالة
   * المخزّن نفسها، والعلاقة تستهدف آخر حدث تسليم حي، ولا عكس سابق على
   * التسليم نفسه (مرآة رفض النطاق) — وإلا رفض بلا كتابة. */
  if (baseLength !== storedEvents.length) return { ok: false, message: STALE_MESSAGE };
  if (baseLength >= 0 && !eventsIdentical(storedEvents, incomingEvents.slice(0, baseLength)))
    return { ok: false, message: STALE_MESSAGE };
  if (tail.tailLength === 2) {
    if (tail.statusFrom !== stored.order.status) return { ok: false, message: STALE_MESSAGE };
    if (stored.order.status !== "delivered" && stored.order.status !== "settled")
      return { ok: false, message: STALE_MESSAGE };
  } else if (stored.order.status !== "needs_review") {
    return { ok: false, message: STALE_MESSAGE };
  }
  if (lastDeliveredEventId(storedEvents) !== tail.deliveryEventId)
    return { ok: false, message: STALE_MESSAGE };
  if (!orderBasicsIdentical(stored.order, incoming.order)) return { ok: false, message: STALE_MESSAGE };
  if (!wrapperIdentical(stored, incoming)) return { ok: false, message: STALE_MESSAGE };
  return { ok: true, reused: false, deliveryEventId: tail.deliveryEventId };
}

/** فحص علاقة التزام عكس التسليم — دالة كلية (لا ترمي أبدًا): أي خلل
 * بنية يعني رفضًا مطبوعًا لا استثناءً يفلت من معاملة IndexedDB. */
export function validateDeliveryReversalCommit(
  stored: StoredCraftOrder | undefined,
  incoming: StoredCraftOrder,
): DeliveryReversalGuardResult {
  try {
    return validateDeliveryReversalCommitInternal(stored, incoming);
  } catch {
    return { ok: false, message: STALE_MESSAGE };
  }
}

/* ─── عقد حركات مرآة العكس ─── */

export type DeliveryReversalMovementsResult = { ok: true } | { ok: false; message: string };

/** حركات المرآة يجب أن تعكس استهلاك تسليم هذا الطلب نفسه الذي يستهدفه
 * العكس، بمفاتيح ومعرفات النطاق الحتمية وبقيم معكوسة بالضبط — أي انحراف
 * يعني أن المخزون تغيّر منذ قراءة الخدمة أو أن الحمولة مزوّرة: رفض بلا
 * كتابة (فشل مغلق داخل حد الكتابة، كعقد رفض دفعة المورد). */
export function validateDeliveryReversalMovements(
  orderId: string,
  deliveryEventId: string,
  incoming: readonly InventoryMovement[],
  storedMovements: readonly InventoryMovement[],
): DeliveryReversalMovementsResult {
  try {
    const seenKeys = new Set<string>();
    for (const movement of incoming) {
      /* هوية الحركة المرآة علاقتها بمصدرها (reversesMovementId + مفتاح
       * الاشتقاق) — حقل orderId ليس جزءًا من عقد مرايا الخدمة القائم فلا
       * يُفحص على الواردة؛ الربط بالطلب يتحقق على المصدر نفسه أدناه. */
      if (movement.type !== "reversal") return { ok: false, message: STALE_MESSAGE };
      if (!movement.reversesMovementId) return { ok: false, message: STALE_MESSAGE };
      const target = storedMovements.find(candidate => candidate.id === movement.reversesMovementId);
      if (!target) return { ok: false, message: STALE_MESSAGE };
      if (
        target.type !== "consumption" ||
        target.orderId !== orderId ||
        !target.operationKey.startsWith(`${orderId}:deliver:${deliveryEventId}:`)
      ) {
        return { ok: false, message: STALE_MESSAGE };
      }
      if (
        movement.operationKey !== `${target.operationKey}:reversal` ||
        movement.id !== `delivery-reversal-${target.id}` ||
        movement.materialId !== target.materialId ||
        movement.quantityDeltaMilli !== -target.quantityDeltaMilli ||
        movement.valueDeltaMinor !== -target.valueDeltaMinor ||
        (movement.costKnowledge ?? "known") !== (target.costKnowledge ?? "known")
      ) {
        return { ok: false, message: STALE_MESSAGE };
      }
      if (seenKeys.has(movement.operationKey)) return { ok: false, message: STALE_MESSAGE };
      seenKeys.add(movement.operationKey);
    }
    return { ok: true };
  } catch {
    return { ok: false, message: STALE_MESSAGE };
  }
}

/* حركات النتيجة الصادقة: عند الالتزام الأولى كل حركة واردة إما كُتبت كما
 * هي أو كانت موجودة بمفتاحها — تُعاد من المخزّن إن وُجدت ومن الواردة إن
 * كُتبت الآن؛ وعند إعادة الاستخدام لا يُبلَّغ عن حركة ليست في المخزّن. */
export function committedReversalMovements(
  incoming: readonly InventoryMovement[],
  stored: readonly InventoryMovement[],
): readonly InventoryMovement[] {
  const byKey = new Map(stored.map(movement => [movement.operationKey, movement]));
  return incoming.map(movement => byKey.get(movement.operationKey) ?? movement);
}

export function storedReversalMovementsFor(
  incoming: readonly InventoryMovement[],
  stored: readonly InventoryMovement[],
): readonly InventoryMovement[] {
  const byKey = new Map(stored.map(movement => [movement.operationKey, movement]));
  return incoming.flatMap(movement => {
    const matching = byKey.get(movement.operationKey);
    return matching ? [matching] : [];
  });
}
