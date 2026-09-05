import type {
  ActivityEffectClass,
  ActivityFamily,
  ActivityStatus,
} from "@/application/activity/activityService";

/*
 * المجموعة ٥ (عقد ٣٠): خريطة تسميات واحدة لقارئ النشاط — الرئيس والمالي
 * وصفوف «آخر ما حدث» يقرؤون من هنا فقط، فلا تتفرّق ثلاث نظامات تسمية.
 * الصيغة: اسم عائلة قصير + كلمة أثر واحدة (نقدي/غير نقدي/معلّق...) — لا صف
 * بلا تصنيف أثر، ولا رقم حيث لا يوجد رقم صادق.
 */
export const activityFamilyLabel: Record<ActivityFamily, string> = {
  sale: "بيع مباشر",
  order: "طلب",
  delivery: "تسليم",
  expense: "مصروف",
  purchase_payment: "دفعة مورد",
  loan: "قرض",
  asset: "أصل",
  depreciation: "إهلاك",
  deposit: "عربون",
  collection: "تحصيل",
  wallet_transfer: "تحويل محفظة",
  inventory_receipt: "استلام مخزون",
  inventory_consumption: "صرف مخزون",
  waste: "هدر مخزون",
  correction: "تصحيح",
};

export const activityEffectLabel: Record<ActivityEffectClass, string> = {
  cash_in: "نقدي داخل",
  cash_out: "نقدي خارج",
  non_cash: "غير نقدي",
  payable: "التزام",
  owner_money: "مال مالك",
  trust: "أمانة",
  pending: "معلّق",
  informational: "توثيق",
};

export const activityStatusLabel: Record<ActivityStatus, string> = {
  active: "ساري",
  reversed: "متراجع موثقًا",
  cancelled: "ملغى",
  pending: "بانتظار قرار",
};

/* تأهيل الأثر عند الحاجة: السطر الهادئ الذي يشرح لماذا هذا الرقم ليس ربحًا —
 * نفس مفردات الكشف (statementService) لا مفردات جديدة. */
export const activityEffectNote: Partial<Record<ActivityEffectClass, string>> = {
  owner_money: "ليس نتيجة — مال المالك",
  trust: "كاش بأمانتك — ليس ملكك",
  pending: "لم يُقرَّر بعد — لا رقم نهائي",
  non_cash: "يؤثر على النتيجة لا على الكاش",
  informational: "توثيق فقط — لا حركة مالية",
};
