/**
 * EXE-015 (الموجة ٣ — SHR-001) فوق المجموعة ٥ (عقد ٣٣ — المشاركة اليدوية):
 * عقد المشاركة الموحد — مصدر واحد قانوني يبني نص المشاركة من **حقيقة محفوظة**
 * لا من نجاح بصري مؤقت.
 *
 * قواعد العقد الملزمة:
 * - «إشعار القبض» لا يُبنى إلا من حدث قبض/عربون **محفوظ وقائم** مرتبط بالطلب
 *   (المبلغ والتاريخ من الحدث نفسه؛ المتبقي من السجل الحي). لا مسودة قبض من
 *   State مؤقت أو حقول نموذج أبدًا.
 * - التحصيل المعكوس كاملًا لا يبقى تحصيلًا قائمًا: يخرج من الاختيار فيسقط
 *   النص إلى تذكير الذمة (الصادق) لا إلى إشعار قبض.
 * - الطلب الملغى لا يوصف بأنه «جاهز للمتابعة» ولا يشارك بمتابعة غير صالحة —
 *   نصه يذكر الإلغاء وتسوية العربون من السجل فقط.
 * - إعادة إرسال نجاح سابق تشير إلى الحدث نفسه: البناء حتمي من السجل، بلا
 *   مسودة تُخزَّن ولا سجل مشاركة يُنشأ (عقد ٣٣ §4: لا تخزين أبدًا).
 * - أقل تفاصيل ممكنة: لا هامش ولا تكلفة ولا معرفات داخلية في نص الزبون —
 *   مرجع العملية والحدث يُحمل في `origin` داخل المسودة وحده.
 */
import { localDateInAmman } from "@micro-domain/shared/index.js";
import type { OrderEvent } from "@micro-domain/craft-order/index.js";
import { formatLocalDate, formatMoneyWithUnit } from "@/presentation/formatters";
import type { StoredCraftOrder } from "@/storage/local/types";

export type ShareDraftKind = "order" | "collection" | "delivery" | "reminder";

export type ShareDraft = {
  kind: ShareDraftKind;
  title: string;
  body: string;
  /**
   * EXE-015: مرجع العملية والحدث المثبت الذي بُني منه الإشعار — يُحمل في
   * المسودة (payload) ولا يظهر في نص الزبون. غيابه في أنواع الرسائل غير
   * المرتبطة بحدث قبض مقصود.
   */
  origin?: { orderId: string; eventId: string };
};

/**
 * أحدث حدث قبض قائم: القبضة أو العربون المحصل الذي ما يزال قائمًا.
 * - القبضات (`collection_recorded`): العلاقة فردية موثقة — الحدث قائم ما لم
 *   يستهلكه عكسٌ كامل عبر `reversesEventId` (نفس منطق لوحة التراجع في صفحة
 *   الطلب)، فلا يبقى تحصيل معكوس قابلًا للمشاركة كتحصيل قائم.
 * - العربون (`deposit_collected`): العكس في الدومين على مستوى المجموع
 *   (ينقص `depositCollectedMinor` مباشرة بلا رابط حدث)، فالمعيار الصادق
 *   للقائم هو بقاء رصيد العربون الحي موجبًا — عكس كامل يفرّغ الرصيد فيخرج
 *   العربون من الاختيار، والإشعار يبقى من آخر قبض يدٍ حقيقية بتاريخها.
 */
export function standingCollectionEvent(stored: StoredCraftOrder): OrderEvent | null {
  const events = stored.order.events;
  const remainingOf = (eventId: string) => {
    const source = events.find(event => event.id === eventId);
    const reversed = events
      .filter(event => event.type === "collection_reversed" && event.reversesEventId === eventId)
      .reduce((sum, event) => sum + (event.amountMinor ?? 0), 0);
    return (source?.amountMinor ?? 0) - reversed;
  };
  const standingDepositMinor = stored.order.depositCollectedMinor - (stored.order.depositRetainedMinor ?? 0);
  const standing = events.filter(
    event =>
      (event.type === "collection_recorded" && remainingOf(event.id) > 0) ||
      (event.type === "deposit_collected" && standingDepositMinor > 0),
  );
  return standing.length > 0 ? standing[standing.length - 1] : null;
}

export function orderShareDraft(stored: StoredCraftOrder): ShareDraft {
  const order = stored.order;
  const itemName = order.itemName || "الطلب";
  /* الطلب الملغى: نص الإلغاء الصادق — لا «جاهز للمتابعة» ولا وعد متابعة،
   * وتسوية العربون (إن وجدت) من حالة التسوية المحفوظة حرفيًا. */
  if (order.status === "cancelled") {
    const lines: string[] = [
      `طلبك من ${itemName}${order.quantity > 1 ? ` (عدد ${order.quantity})` : ""} أُلغي.`,
    ];
    if (order.depositCollectedMinor > 0) {
      const depositLine = formatMoneyWithUnit(order.depositCollectedMinor);
      if (order.settlementStatus === "cancelled_refunded") {
        lines.push(`ورُدّ إليك عربون البالغ ${depositLine} عند الإلغاء.`);
      } else if (order.settlementStatus === "cancelled_retained") {
        lines.push(`واحتُفظ بعربون البالغ ${depositLine} عند الإلغاء.`);
      } else {
        lines.push(`وعربونك البالغ ${depositLine} بانتظار حسم تسويته بيننا.`);
      }
    }
    if (order.customerName) lines.push(`مع تحياتي — طلب ${order.customerName}.`);
    return {
      kind: "order",
      title: `رسالة طلب — ${itemName}`,
      body: lines.join("\n"),
    };
  }
  const lines: string[] = [];
  lines.push(`طلبك من ${itemName}${order.quantity > 1 ? ` (عدد ${order.quantity})` : ""} جاهز للمتابعة.`);
  lines.push(`السعر المتفق عليه: ${formatMoneyWithUnit(order.agreedPriceMinor)}.`);
  if (order.depositCollectedMinor > 0) {
    lines.push(`العربون المدفوع: ${formatMoneyWithUnit(order.depositCollectedMinor)}.`);
    lines.push(
      `المتبقي: ${formatMoneyWithUnit(Math.max(0, order.agreedPriceMinor - order.depositCollectedMinor))}.`,
    );
  }
  if (stored.deliveryDate)
    lines.push(`موعد التسليم المتفق: ${formatLocalDate(stored.deliveryDate) ?? stored.deliveryDate}.`);
  if (order.customerName) lines.push(`مع تحياتي — طلب ${order.customerName}.`);
  return {
    kind: "order",
    title: `رسالة طلب — ${itemName}`,
    body: lines.join("\n"),
  };
}

/**
 * إشعار القبض — من الحدث المحفوظ نفسه: المبلغ والتاريخ من `event.amountMinor`
 * و`event.createdAt`، والمتبقي من السجل الحي، ومرجع العملية/الحدث في `origin`.
 * لا يقبل أرقامًا من خارج السجل (التوقيع القديم بأرقام حرّة حُذف مع EXE-015).
 */
export function collectionShareDraft(stored: StoredCraftOrder, event: OrderEvent): ShareDraft {
  const order = stored.order;
  const occurredOn = localDateInAmman(event.createdAt);
  return {
    kind: "collection",
    title: `إشعار قبض — ${order.customerName || "زبون"}`,
    body: [
      `استلمت منك مبلغ ${formatMoneyWithUnit(event.amountMinor ?? 0)} بتاريخ ${formatLocalDate(occurredOn) ?? occurredOn}.`,
      `طلبيته: ${order.itemName || "طلب"}.`,
      `المتبقي حتى الآن: ${formatMoneyWithUnit(Math.max(0, order.receivableMinor))}.`,
      "شكرًا لثقتك.",
    ].join("\n"),
    origin: { orderId: stored.id, eventId: event.id },
  };
}

/** إشعار التسليم — بتاريخ التسليم الفعلي من حدث التسليم المحفوظ، لا «اليوم». */
export function deliveryShareDraft(stored: StoredCraftOrder, deliveredOn?: string | null): ShareDraft {
  const order = stored.order;
  const deliveredDate = deliveredOn ?? localDateInAmman();
  return {
    kind: "delivery",
    title: `إشعار تسليم — ${order.itemName || "طلب"}`,
    body: [
      `طلبك «${order.itemName || "الطلب"}» سُلّم ${formatLocalDate(deliveredDate) ?? deliveredDate}.`,
      order.receivableMinor > 0
        ? `المتبقي عليك: ${formatMoneyWithUnit(order.receivableMinor)} — تسعدني تسويته متى ما جهزت.`
        : "حُسم كامل المبلغ — شكرًا لك.",
      "أي ملاحظة على الطلب أخبرني بها اليوم قبل نسيان التفاصيل.",
    ].join("\n"),
  };
}

export function reminderShareDraft(
  stored: StoredCraftOrder,
  dueMinor: number,
  followUpDate: string | null,
): ShareDraft {
  const order = stored.order;
  return {
    kind: "reminder",
    title: `تذكير ذمم — ${order.customerName || "زبون"}`,
    body: [
      "سلام عليكم،",
      `أتذكر لك ${formatMoneyWithUnit(dueMinor)} من طلب «${order.itemName || "طلب"}».`,
      followUpDate
        ? `اتفاقنا كان على تسويتها بتاريخ ${formatLocalDate(followUpDate) ?? followUpDate}.`
        : null,
      "خبرني متى تناسبك التسوية، وأسعد بتحضيرها.",
    ]
      .filter(line => line !== null)
      .join("\n"),
  };
}

/**
 * EXE-015: نقطة القرار الواحدة لمسودة مشاركة الزبون — تُختار الحالة من
 * السجل المحفوظ وحده (لا State مؤقت):
 * ١. الملغى ← نص الإلغاء الصادق (لا جاهزية ولا متابعة).
 * ٢. المسلّم/المسدد ← إشعار التسليم بتاريخ التسليم الفعلي.
 * ٣. القائم النشط وفيه قبضة/عربون قائم ← إشعار القبض من الحدث نفسه.
 * ٤. الذمة القائمة بلا قبض قائم ← تذكير الذمة.
 * ٥. غير ذلك (نشط بلا دين ولا قبض) ← رسالة الطلب «جاهز للمتابعة».
 */
export function customerShareDraft(stored: StoredCraftOrder, deliveredOn?: string | null): ShareDraft {
  const order = stored.order;
  if (order.status === "cancelled") return orderShareDraft(stored);
  if (order.status === "delivered" || order.status === "settled")
    return deliveryShareDraft(stored, deliveredOn);
  const standing = standingCollectionEvent(stored);
  if (standing) return collectionShareDraft(stored, standing);
  if (order.receivableMinor > 0)
    return reminderShareDraft(stored, order.receivableMinor, stored.followUpDate ?? null);
  return orderShareDraft(stored);
}
