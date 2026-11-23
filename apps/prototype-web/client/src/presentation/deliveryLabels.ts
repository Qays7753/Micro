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
  "execution:instructions_transit": "تعليمات المشروع: تابع التوصيل",
  "execution:instructions_return": "تعليمات المشروع: ابدأ الإرجاع",
  "execution:instructions_holding": "تعليمات المشروع: احتفظ بالأغراض",
  "execution:retry_agreed": "اتُفق على محاولة جديدة (بقبول صريح من المشروع)",
  "execution:holding_agreed": "اتُفق على الاحتفاظ (بقبول صريح من المشروع)",
  "execution:return_agreed": "اتُفق على الإرجاع — إرجاع الأغراض لا استرداد مال (بقبول صريح من المشروع)",
  "execution:retry_started_pickup": "بدأ محاولة الاستلام",
  "execution:retry_started_transit": "استأنف الطريق",
  "execution:return_started": "بدأ الإرجاع",
  "execution:transit_resumed": "استأنف التوصيل",
  "execution:return_declared": "أبلغ الإرجاع",
  "agreement:consent_proposed": "اقتراح موافقة قيد انتظار قرار الطرف الآخر",
  "agreement:consent_accepted": "قبل الطرف الآخر الاقتراح صراحة",
  "agreement:consent_rejected": "رفض الطرف الآخر الاقتراح — لا تنفيذ تلقائي",
  "agreement:consent_withdrawn": "سحب مقدم الاقتراح اقتراحه — لا شيء تغير",
  "agreement:change_proposed": "اقتراح تعديل مؤثر قيد موافقة الطرف الآخر",
  "agreement:change_accepted": "قُبل التعديل — نسخة اتفاق جديدة",
  "agreement:change_rejected": "رُفض التعديل — الاتفاق السابق سارٍ",
  "agreement:change_withdrawn": "سحب مقدم التعديل اقتراحه — الاتفاق السابق سارٍ",
  "contact:attempt_no_answer": "محاولة اتصال دون رد",
  "contact:contact_reported": "تم التواصل",
  "contact:contact_confirmed": "أكد المشروع التواصل",
  "contact:contact_denied": "نفى المشروع التواصل",
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

/** محور محاولة الاتصال كما يراه صاحب المشروع (OD15) — خريطة كاملة؛ لا كود خام. */
export const CONTACT_STATUS_LABELS: Record<string, string> = {
  not_attempted: "لا محاولة اتصال بعد",
  attempt_no_answer: "السائق حاول الاتصال بك دون رد — أجب بصفتك صاحب المشروع",
  contact_reported: "السائق أفاد بالتواصل معك — أكّد أو نفِ",
  contact_confirmed: "التواصل مؤكد منك",
  contact_denied: "التواصل منفي منك",
};

/* ── Stage C (S13 — أمر المالك 2026-11-14 «جاهزية Manage + إغلاق CI/UX»):
 * عرض شروط الموافقة واقتراحات التعديل المؤثر بحقول عربية مسماة بدل JSON
 * الخام — لا تتغير أي قيمة ولا أي معنى مالي/تعاقدي، فقط التسمية الصادقة
 * للطرف القارئ قبل قراره (مصدر واحد لطرفي الحجز). ── */

/** حالات الطلب كما يراها السائق — خريطة كاملة؛ القيمة الخام لا تصل المستخدم. */
export const DRIVER_REQUEST_STATUS_LABELS: Record<string, string> = {
  draft: "مسودة عند صاحب المشروع",
  awaiting_driver_response: "طلب جديد ينتظر ردك",
  awaiting_requester_decision: "عرضك ينتظر قرار المشروع",
  confirmed: "حجز مؤكد — نفّذ وصرّح",
  driver_declined: "رفضتَ الطلب",
  quote_rejected: "رفض المشروع عرضك",
  withdrawn: "سحب المشروع الطلب",
  response_expired: "انتهت مهلة الرد",
  cancelled: "ألغى المشروع الحجز",
};

/** بديل التسمية عند غياب الحالة عن الخريطة — صادق بلا كود خام. */
export const UNKNOWN_STATUS_LABEL = "حالة غير معروفة — أعد المحاولة";

/** قيمة قاصر (فلس) إلى نص دنانير بخانتين — للعرض المعزول بـ bdi فقط. */
export function minorToJodText(minor: string | null): string {
  if (minor === null) return "—";
  const value = BigInt(minor);
  return `${(value / 100n).toString()}.${(value % 100n).toString().padStart(2, "0")}`;
}

/** صف عرض مسمى: القيمة المالية تُعزل بـ bdi من الصفحة (F-11). */
export type LabeledRow = { label: string; value: string; money?: boolean };

/* R1-17 (أمر المالك 2026-11-14 — Workstream A): سطرا ملخص بطاقة الحجز
 * انتقلا إلى وحدة عرض مستقلة صغيرة (bookingSummaryText.ts) — الصفحات التي
 * لا تستورد بقية تسميات التوصيل (نظرة المالك) لا تسحبها عدويا إلى كثافة
 * نصها المحروسة. */

/** شروط اقتراح الموافقة (retry/holding/return) إلى صفوف عربية — الحقول
 * المعروفة فقط، والقيم كما هي بلا اختراع؛ لا حقل يُعرض خامًا أبدًا. */
export function consentTermRows(kind: string, terms: unknown): LabeledRow[] {
  const t = (terms ?? {}) as Record<string, unknown>;
  const rows: LabeledRow[] = [];
  if (kind === "retry") {
    if (t.attempts !== undefined) rows.push({ label: "عدد المحاولات", value: String(t.attempts) });
    if (typeof t.priceMinor === "string" && t.priceMinor !== "")
      rows.push({ label: "أجرة المحاولة", value: minorToJodText(t.priceMinor), money: true });
    return rows;
  }
  if (kind === "holding") {
    if (typeof t.durationText === "string" && t.durationText !== "")
      rows.push({ label: "مدة الاحتفاظ", value: t.durationText });
    if (typeof t.place === "string" && t.place !== "") rows.push({ label: "مكان الاحتفاظ", value: t.place });
    if (typeof t.costMinor === "string" && t.costMinor !== "")
      rows.push({ label: "تكلفة الاحتفاظ", value: minorToJodText(t.costMinor), money: true });
    return rows;
  }
  if (kind === "return") {
    if (t.destination === "requester") rows.push({ label: "جهة الإرجاع", value: "صاحب المشروع" });
    else if (t.destination === "original_supplier")
      rows.push({ label: "جهة الإرجاع", value: "المورد الأصلي" });
    if (typeof t.costMinor === "string" && t.costMinor !== "")
      rows.push({ label: "تكلفة الإرجاع", value: minorToJodText(t.costMinor), money: true });
    return rows;
  }
  return rows;
}

/** تغييرات اقتراح التعديل المؤثر إلى صفوف عربية — البنية نفسها التي
 * يكتبها نموذجا الطرفين (fareMinor/schedule/pickup/dropoff/load/collectionMinor). */
export function changeFieldRows(changes: unknown): LabeledRow[] {
  const source = changes ?? {};
  const c = ((source as { changes?: Record<string, unknown> }).changes ??
    (source as Record<string, unknown>)) as Record<string, unknown>;
  const rows: LabeledRow[] = [];
  if (typeof c.fareMinor === "string" && c.fareMinor !== "")
    rows.push({ label: "الأجرة الجديدة", value: minorToJodText(c.fareMinor), money: true });
  const schedule = c.schedule as { date?: string } | undefined;
  if (schedule && typeof schedule.date === "string" && schedule.date !== "")
    rows.push({ label: "الموعد الجديد", value: schedule.date });
  const pickup = c.pickup as { area?: string } | undefined;
  if (pickup && typeof pickup.area === "string" && pickup.area !== "")
    rows.push({ label: "منطقة الاستلام الجديدة", value: pickup.area });
  const dropoff = c.dropoff as { area?: string } | undefined;
  if (dropoff && typeof dropoff.area === "string" && dropoff.area !== "")
    rows.push({ label: "منطقة التسليم الجديدة", value: dropoff.area });
  const load = c.load as { description?: string; parcels?: number } | undefined;
  if (load) {
    if (typeof load.description === "string" && load.description !== "")
      rows.push({ label: "الحمولة الجديدة", value: load.description });
    if (load.parcels !== undefined && load.parcels !== null)
      rows.push({ label: "عدد الطرود الجديد", value: String(load.parcels) });
  }
  if (typeof c.collectionMinor === "string" && c.collectionMinor !== "")
    rows.push({ label: "مبلغ التحصيل الجديد", value: minorToJodText(c.collectionMinor), money: true });
  return rows;
}

/** يترجم حدث خط الزمن أو يعيد التركيب الخام المصون عند غياب التسمية. */
export function deliveryEventLabel(axis: string, type: string): string {
  return DELIVERY_EVENT_LABELS[`${axis}:${type}`] ?? `${axis}: ${type}`;
}
