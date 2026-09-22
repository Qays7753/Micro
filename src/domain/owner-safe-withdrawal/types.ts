/* FIN-004 (WS-176 — Wave 4): قراءة السحب الآمن الاستشارية للمالك —
 * نموذج مجال نقي فوق نتيجة أفق الكاش القصير (عقد 17 §7). الاحتياطي
 * الصريح مُدخل مستدعٍ (session-scoped) لا قيمة مخزنة: التفضيلات يحرم
 * них ميثاقها المحتوى المالي (عقد 41 §8 / عقد 42 §8)، والدوام عبر مخزن
 * جديد يحتاج قرار مالك مفصلًا (ترحيل 38/30 محروسًا) — مؤجل بنص واضح. */
import type { ShortCashResult } from "../g5/index.js";

/** أفق القراءة — نفس عائلة FIN-005 (7/30/90 يومًا، الافتراضي 30). */
export type SafeWithdrawalHorizon = {
  horizonDays: 7 | 30 | 90;
  from: string;
  to: string;
};

/** سياسة الاحتياطي الصريحة: مفعّل بمبلغ موجب، أو معطّل بطلب المالك، أو
 * غير مُدخل بعد. لا نسبة مخترعة ولا قاعدة «شهور مصاريف» إطلاقًا. */
export type SafeWithdrawalReserve =
  { mode: "enabled"; amountMinor: number } | { mode: "disabled" } | { mode: "unset" };

export type SafeWithdrawalInput = {
  horizon: SafeWithdrawalHorizon;
  /** نتيجة المحرك الكنوني نفسه لأفق الكاش القصير (FIN-005) — لا مسار
   * حساب ثاني هنا ولا إعادة اشتقاق للتوقع. */
  shortCash: ShortCashResult;
  /** حالة دليل الكاش المسجل من المركز (recorded / not_recorded). */
  cashRecorded: boolean;
  reserve: SafeWithdrawalReserve;
  /** القروض الصادرة القائمة — سياق معلن فقط: ليست كاشًا محصلًا ولا
   * تُضاف للفائض أبدًا؛ null يعني تعذر قراءتها لا صفرًا. */
  loansOutstandingMinor: number | null;
};

export type SafeWithdrawalReading = {
  /** available: رقم فائض قائم على توقع مكتمل واحتياطي مفعّل.
   * needs_review: الرقم قائم لكن التوقع يحمل افتراضات معلنة.
   * incomplete: لا رقم — الاحتياطي غير مُدخل/معطّل، أو الكاش غير مسجل،
   * أو توقع الكاش نفسه ناقص/غير صالح؛ الأسباب ظاهرة دائمًا. */
  status: "available" | "needs_review" | "incomplete";
  horizon: SafeWithdrawalHorizon;
  recordedCashMinor: number;
  projectedCashMinor: number | null;
  reserveMinor: number | null;
  /** الفائض = التوقع − الاحتياطي؛ سالب يُعرض كما هو بلا قصّ إلى صفر،
   * وnull يعني «لا قراءة» لا صفرًا. */
  headroomMinor: number | null;
  loansOutstandingMinor: number | null;
  reasons: readonly string[];
  assumptions: readonly string[];
  sources: readonly string[];
  nextAction: string;
};
