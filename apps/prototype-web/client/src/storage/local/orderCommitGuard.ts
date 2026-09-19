import type { OrderEvent } from "@micro-domain/craft-order/index.js";
import type { StoredCraftOrder } from "./types";

/* G-003 (تدقيق الإدارة المالية المتدرجة 2026-09-19): مسارات كتابة الطلب
 * العائلية (fulfillment/agreement/سياق الاتفاق) كانت تكتب عبر saveOrder
 * كتابةً عمياء — آخر كاتب يفوز — فيسمح لمسارين متزامنين بإسقاط أثر أحدهما
 * بصمت (تحصيل يختفي أو حالة تُردّ فوق مسار أحدث). هذا الحارس النقي يُستدعى
 * داخل حد الكتابة نفسه في المحوّلين: فحص مفتاح الحتمية أولًا (إعادة تشغيل
 * العملية نفسها إعادة استخدام صادقة بلا كتابة)، ثم يجب أن يطابق السجل الحي
 * «القاعدة» التي قرأتها الخدمة وبنت عليها الحمولة — أي تغيّر بين القراءة
 * والكتابة يعني مسارًا آخر كتب بينهما: يُرفض الالتزام بـ storage_stale ولا
 * يُكتب شيء، فلا يُطمر أثر الفائز ولا يُدمج حقول مالية/مخزنية بصمت. */

export type OrderCommitGuardResult = { ok: true; reused: boolean } | { ok: false; message: string };

const STALE_MESSAGE = "سجل الطلب تغيّر من مسار آخر بعد فتحك له — لم يُسجَّل شيء؛ أعد المحاولة.";
const MISSING_MESSAGE = "سجل الطلب لم يعد موجودًا محليًا؛ لم يُسجَّل شيء.";

/* مقارنة بنيوية عميقة — النسخ الواردة منخفضة المرجع دائمًا (clone/structured
 * clone) فالمساواة بالمرجع ترفض كل التزام مشروع؛ null/undefined متكافئان هنا
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

/* القاعدة مقابل السجل الحي: مطابقة كاملة بالقيمة (بما فيها updatedAt — أي
 * كتابة أخرى تلمس السجل تظهر هنا)، والغلاف والأحداث معًا فلا يمر تغيّر
 * متابعة/مصدر اتفاق متزامن فوق كتابة الطلب ولا العكس. */
export function orderRecordIdentical(live: StoredCraftOrder, base: StoredCraftOrder): boolean {
  return deepEqual(live, base);
}

/* ذيل الأحداث الوارد يجب أن يبدأ بأحداث القاعدة نفسها حرفيًا ثم يضيف —
 * دفاع في العمق: الحمولة التي تُسقط حدثًا تاريخيًا أو تعيد كتابته ليست
 * امتدادًا مشروعًا للقراءة التي بُنيت عليها. */
function eventsExtendBase(baseEvents: readonly OrderEvent[], nextEvents: readonly OrderEvent[]): boolean {
  if (nextEvents.length < baseEvents.length) return false;
  return baseEvents.every((event, index) => sameOrderEvent(event, nextEvents[index]!));
}

/** فحص علاقة التزام كتابة الطلب: إعادة الاستخدام بالمفتاح أولًا (نجاح بلا
 * كتابة)، ثم مطابقة السجل الحي للقاعدة المقروءة، ثم امتداد الأحداث فوقها
 * حرفيًا — وإلا رفض صريح بلا كتابة. دالة كلية لا ترمي أبدًا. */
export function validateOrderCommit(
  live: StoredCraftOrder | undefined,
  base: StoredCraftOrder,
  next: StoredCraftOrder,
  idempotencyKeys: readonly string[],
): OrderCommitGuardResult {
  try {
    if (live === undefined) return { ok: false, message: MISSING_MESSAGE };
    if (next.id !== base.id || live.id !== base.id) return { ok: false, message: STALE_MESSAGE };
    /* ١. إعادة تشغيل العملية نفسها: حدث يحمل مفتاحها ملتزم سلفًا في السجل
     * الحي — يُعاد السجل الحي كما هو بلا كتابة ولا مقارنة (المفتاح هو
     * العملية)، فتميّز إعادة المحاولة الصادقة عن التعارض. */
    if (
      idempotencyKeys.length > 0 &&
      live.order.events.some(
        event => event.idempotencyKey != null && idempotencyKeys.includes(event.idempotencyKey),
      )
    ) {
      return { ok: true, reused: true };
    }
    /* ٢. السجل الحي يجب أن يطابق القاعدة المقروءة — أي كتابة أخرى بين قراءة
     * الخدمة وبناء الحمولة والالتزام تعني قدمًا يُرفض بلا كتابة، فيبقى أثر
     * الفائز محفوظًا كما هو. */
    if (!orderRecordIdentical(live, base)) return { ok: false, message: STALE_MESSAGE };
    /* ٣. الحمولة تمتد فوق القاعدة حدثًا حدثًا (أو غلافًا فقط بلا أحداث
     * جديدة كسياق المتابعة) — لا تُسقط تاريخًا ولا تعيد كتابته. */
    if (!eventsExtendBase(base.order.events, next.order.events)) return { ok: false, message: STALE_MESSAGE };
    return { ok: true, reused: false };
  } catch {
    return { ok: false, message: STALE_MESSAGE };
  }
}
