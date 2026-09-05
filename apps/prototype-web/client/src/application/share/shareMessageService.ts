/**
 * المجموعة ٥ (عقد ٣٣ — المشاركة اليدوية): توليد نص عربي قصير من سجل مختار
 * (طلب/قبضة/تسليم/تذكير/كشف فترة) — يُعرض قبل أي شيء، ويُعدَّل يدويًا،
 * ويسافر عبر نظام المشاركة بقرار المستخدم وحده.
 *
 * عقد المشاركة:
 * - لا إرسال تلقائي أبدًا؛ لا قراءة جهات اتصال؛ لا مكتبة ملاحظات دائمة
 *   (الميزة المستثناة من البرنامج كله).
 * - النص من السجل نفسه لا من تقدير: أرقام إنجليزية بد.أ بتاريخ DD/MM/YYYY.
 * - أقل تفاصيل ممكنة: لا هامش ولا تكلفة ولا أي رقم خاص في نص الزبون.
 * - تطبيع رقم أردني اختياري: يُطبَّق فقط على رقم أدخله المستخدم صراحةً.
 */
import { formatLocalDate, formatMoneyWithUnit, localDateInAmman } from "@/presentation/formatters";
import type { StoredCraftOrder } from "@/storage/local/types";

export type ShareDraftKind = "order" | "collection" | "delivery" | "reminder" | "statement";

export type ShareDraft = {
  kind: ShareDraftKind;
  title: string;
  body: string;
};

export type StatementShareSummary = {
  from: string;
  to: string;
  cashNetMinor: number;
  resultMinor: number | null;
};

/** تطبيع رقم هاتف أردني: +9627XXXXXXXX أو 07XXXXXXXX — إن لم يكن أردنيًا يُعاد كما وصل. */
export function normalizeJordanianPhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (/^\+9627\d{8}$/.test(digits)) return digits;
  if (/^9627\d{8}$/.test(digits)) return `+${digits}`;
  if (/^07\d{8}$/.test(digits)) return `+962${digits.slice(1)}`;
  if (/^7\d{8}$/.test(digits)) return `+962${digits}`;
  return digits;
}

export function orderShareDraft(stored: StoredCraftOrder): ShareDraft {
  const order = stored.order;
  const lines: string[] = [];
  lines.push(
    `طلبك من ${order.itemName || "الطلب"}${order.quantity > 1 ? ` (عدد ${order.quantity})` : ""} جاهز للمتابعة.`,
  );
  lines.push(`السعر المتفق عليه: ${formatMoneyWithUnit(order.agreedPriceMinor)}.`);
  if (order.depositCollectedMinor > 0) {
    lines.push(`العربون المدفوع: ${formatMoneyWithUnit(order.depositCollectedMinor)}.`);
    lines.push(
      `المتبقي: ${formatMoneyWithUnit(Math.max(0, order.agreedPriceMinor - order.depositCollectedMinor))}.`,
    );
  }
  if (stored.deliveryDate)
    lines.push(`موعد التسليم المتفق: ${formatLocalDate(stored.deliveryDate) ?? stored.deliveryDate}.`);
  if (stored.order.customerName) lines.push(`مع تحياتي — طلب ${order.customerName}.`);
  return {
    kind: "order",
    title: `رسالة طلب — ${order.itemName || "طلب"}`,
    body: lines.join("\n"),
  };
}

export function collectionShareDraft(
  stored: StoredCraftOrder,
  amountMinor: number,
  occurredOn: string,
): ShareDraft {
  return {
    kind: "collection",
    title: `إشعار قبض — ${stored.order.customerName || "زبون"}`,
    body: [
      `استلمت منك مبلغ ${formatMoneyWithUnit(amountMinor)} بتاريخ ${formatLocalDate(occurredOn) ?? occurredOn}.`,
      `طلبيته: ${stored.order.itemName || "طلب"}.`,
      `المتبقي حتى الآن: ${formatMoneyWithUnit(Math.max(0, stored.order.receivableMinor))}.`,
      "شكرًا لثقتك.",
    ].join("\n"),
  };
}

export function deliveryShareDraft(stored: StoredCraftOrder): ShareDraft {
  const order = stored.order;
  return {
    kind: "delivery",
    title: `إشعار تسليم — ${order.itemName || "طلب"}`,
    body: [
      `طلبك «${order.itemName || "الطلب"}» سُلّم اليوم ${formatLocalDate(localDateInAmman()) ?? ""}.`,
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
  return {
    kind: "reminder",
    title: `تذكير ذمم — ${stored.order.customerName || "زبون"}`,
    body: [
      "سلام عليكم،",
      `أتذكر لك ${formatMoneyWithUnit(dueMinor)} من طلب «${stored.order.itemName || "طلب"}».`,
      followUpDate
        ? `اتفاقنا كان على تسويتها بتاريخ ${formatLocalDate(followUpDate) ?? followUpDate}.`
        : null,
      "خبرني متى تناسبك التسوية، وأسعد بتحضيرها.",
    ]
      .filter(line => line !== null)
      .join("\n"),
  };
}

export function statementShareDraft(summary: StatementShareSummary): ShareDraft {
  return {
    kind: "statement",
    title: `كشف فترة ${formatLocalDate(summary.from) ?? summary.from} – ${formatLocalDate(summary.to) ?? summary.to}`,
    body: [
      "كشف فترة موجز من سجلي المحلي:",
      `صافي حركة الكاش: ${formatMoneyWithUnit(summary.cashNetMinor)} (حركة قبض ودفع — ليس ربحًا).`,
      summary.resultMinor === null
        ? "نتيجة الفترة: غير متاحة بعد — بيانات ناقصة تمنع رقمًا نهائيًا صادقًا."
        : `نتيجة الفترة المسجلة: ${formatMoneyWithUnit(summary.resultMinor)}.`,
      "نسخة قراءة لحظة لا تغيّر أي رقم.",
    ].join("\n"),
  };
}
