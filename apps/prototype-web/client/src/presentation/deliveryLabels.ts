/**
 * تسميات عرض التوصيل (التوسعة الشبكية EX-D18، 2026-11-12): الخرائط الكانونية
 * لعرض أحداث الحجز ومحاور التنفيذ وحالات الكشف بالعربية لطرفي الحجز — صفحة
 * المالك وصفحة السائق تستهلكان المصدر الواحد (لا ازدواج تسميات بين السطحين
 * ولا أكواد داخلية تصل المستخدم).
 */

/** خط زمني الحجز: «المحور:الحدث» → نص عربي صادق للطرف المعروض له. */
export const DELIVERY_EVENT_LABELS: Record<string, string> = {
  "request:driver_accepted": "قبل السائق",
  "request:driver_declined": "رفض السائق",
  "request:quote_submitted": "أرسل السائق عرضًا",
  "request:quote_accepted": "قبل المشروع العرض",
  "request:quote_rejected": "رفض المشروع العرض",
  "request:withdrawn": "سحب المشروع الطلب",
  "request:cancelled_by_requester": "ألغى المشروع الحجز",
  "execution:start": "بدأ التوجه",
  "execution:arrive": "وصل للاستلام",
  "execution:pickup_declared": "استلم الأغراض",
  "execution:pickup_failed": "تعذر الاستلام",
  "execution:transit_started": "بدأ الطريق",
  "execution:delivery_declared": "أبلغ التسليم",
  "execution:delivery_failed": "تعذر التسليم",
  "execution:awaiting_instructions": "طلب تعليمات",
  "execution:retry_agreed": "اتُفق على محاولة جديدة",
  "execution:holding_agreed": "اتُفق على الاحتفاظ",
  "execution:return_agreed": "اتُفق على الإرجاع",
  "execution:retry_started_pickup": "بدأ محاولة الاستلام",
  "execution:retry_started_transit": "استأنف الطريق",
  "execution:return_started": "بدأ الإرجاع",
  "execution:transit_resumed": "استأنف التوصيل",
  "execution:return_declared": "أبلغ الإرجاع",
  "contact:attempt_no_answer": "محاولة اتصال دون رد",
  "contact:contact_reported": "تم التواصل",
  "money:collection_declared": "صرّح بالتحصيل",
  "money:statement_submitted": "أرسل كشفًا",
  "money:full_receipt_confirmed": "أكد المشروع الاستلام كاملًا",
  "confirmation:confirmed_by_requester": "أكد المشروع النتيجة",
  "confirmation:objected": "اعترض المشروع",
};

/** محور التنفيذ كما يراه السائق. */
export const DRIVER_EXECUTION_STATUS_LABELS: Record<string, string> = {
  not_started: "لم يبدأ",
  heading_to_pickup: "باتجاه الاستلام",
  arrived_at_source: "في نقطة الاستلام",
  picked_up: "استلمت الأغراض",
  in_transit: "قيد التوصيل",
  delivered_declared: "أبلغت التسليم — بانتظار تأكيد المشروع",
  undeliverable_declared: "تعذر مصرح به",
  retry_scheduled: "محاولة جديدة مجدولة",
  holding_agreed: "احتفاظ متفق عليه",
  awaiting_instructions: "بانتظار تعليمات المشروع",
  returning: "قيد الإرجاع",
  return_declared: "أبلغت الإرجاع",
};

/** حالات الكشف اليومي كما تُعرض للطرفين. */
export const STATEMENT_STATUS_LABELS: Record<string, string> = {
  awaiting_confirmation: "تنتظر تأكيد المشروع",
  full_receipt_confirmed: "مؤكد كامل الاستلام",
  difference_recorded: "فيه فرق مسجل",
};

/** يترجم حدث خط الزمن أو يعيد التركيب الخام المصون عند غياب التسمية. */
export function deliveryEventLabel(axis: string, type: string): string {
  return DELIVERY_EVENT_LABELS[`${axis}:${type}`] ?? `${axis}: ${type}`;
}
