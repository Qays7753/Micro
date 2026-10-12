/**
 * EXE-007 (FIN-006): مواصفة إدخال المصروف الموحدة — ملكية واحدة للقواعد.
 *
 * المدخلان (المحرر الموجه في «المالية» والاختصار السريع في الرئيسية) يشتركان
 * هذه المواصفة نفسها: قاعدة مصدر الصرف، إلزامية الوصف، مفردات الرسائل،
 * تصنيف الوضع المختصر، وتوقيع التغطية من المحفظة. النموذج السريع «وضع مختصر
 * للرحلة نفسها»: نفس الخدمة (projectFinance.record + distributeUnallocated)
 * ونفس القواعد — الفروق المقصودة موثقة هنا وفي مكان واحد فقط:
 *   • الوضع المختصر يثبت التصنيف (مشروع/غير معروف/عام/معروف) — التصنيف
 *     الكامل والمصروف المشترك يبقيان في المحرر الموجه.
 *   • الوضع المختصر لا يعرض حقل الجهة المقابلة (اختياري في الأصل — null قيمة
 *     صالحة، لا تجاوز لقاعدة إلزامية).
 * ما ليس فروقًا مقصودة أبدًا: الوصف إلزامي في المدخلين (لا نص مصنع)، والتاريخ
 * قابل للتحرير في المدخلين، ومفتاح العملية لكل نموذج مفتوح بلا تكرار.
 */
import type { OperatingExpenseContext } from "@micro-domain/financial-event/index.js";
import type { usePrototypeServices } from "@/app/PrototypeServicesContext";

type Services = ReturnType<typeof usePrototypeServices>;

/* R10-B3/R10B-NF-001 (2026-10-11): القيمة الحارسة صارت ملكية واحدة في
 * application/finance/paymentSourcePolicy.ts (كانت منسوختين هنا وفي
 * application/suppliers باسمين) — الاستيراد هنا عبر باب البيت المالي
 * `@/application/finance` (المسار الكنوني للواجهة — STR-615/R6؛ لا
 * استيراد عميقًا لدواخل بيوت التطبيق)؛ الاسم أدناه إعادة تسمية توافقًا
 * لمستهلكي هذه الوحدة. */
import { PAYMENT_SOURCE_UNSET } from "@/application/finance";
export const EXPENSE_SOURCE_UNSET = PAYMENT_SOURCE_UNSET;

/** رسالة إلزامية الوصف — نفس الحرفية في المدخلين؛ الوصف جزء من السجل المالي. */
export const EXPENSE_NOTE_REQUIRED_MESSAGE = "اكتب ما حدث قبل الحفظ؛ الوصف جزء من السجل المالي.";

/** تلميح سؤال مصدر الصرف حسب عدد المحافظ — مصدر واحد للنص. */
export function expenseSourceHint(walletCount: number): string {
  return walletCount === 1
    ? "المحفظة الوحيدة معيَّنة مسبقًا — الكاش غير الموزع خيار صريح"
    : "اختر محفظة أو الكاش غير الموزع";
}

/** قاعدة محفظة المصروف الموحدة: محافظ متعددة تطلب اختيارًا صريحًا — وإلا رفض.
 *  تعاد رسالة الرفض نفسها من المدخلين؛ القاعدة واحدة في مكان واحد. */
export function expenseSourceRuleViolation(walletCount: number, walletId: string): string | null {
  if (walletCount > 1 && walletId === EXPENSE_SOURCE_UNSET) {
    return "اختر مصدر الصرف: محفظة أو الكاش غير الموزع.";
  }
  return null;
}

/** تصنيف الوضع المختصر — التقييد الواعي الموثق (مشروع/غير معروف/عام/معروف).
 *  التصنيف الكامل والمصروف المشترك يبقيان في المحرر الموجه وحده. */
export function compactExpenseClassification(categoryLabel: string | null): OperatingExpenseContext {
  return {
    relationship: "project",
    behavior: "unknown",
    purpose: "project_general",
    knowledge: "known",
    sharedProjectShare: null,
    categoryLabel: categoryLabel || null,
  };
}

/** تعيين مصدر الصرف بالقاعدة الموحدة (FIN-005): بلا محافظ = غير الموزع،
 *  محفظة واحدة = معيَّنة مسبقًا، متعددة = لم يُختر بعد. لا تُذكر آخر محفظة.
 *  (R10-B3/NF-001: تفويض للقاعدة الكنونية الموحدة.) */
export { resolveDefaultPaymentSource as defaultExpenseSource } from "@/application/finance";

/** تغطية المصروف من المحفظة المختارة — التوقيع الموحد للمدخلين: قيد تخصيص
 *  سالب بمصدر «expense» ومفتاح مشتق من مفتاح الحدث فلا تخصيص مزدوج عند
 *  الإعادة. تعاد النتيجة للفاعل لا تُبتلع. */
export async function coverExpenseFromWallet(
  projectFinance: Services["projectFinance"],
  input: {
    walletId: string;
    amountMinor: number;
    eventId: string;
    operationKey: string;
  },
): Promise<{ ok: boolean; message: string | null }> {
  const result = await projectFinance.distributeUnallocated({
    walletId: input.walletId,
    deltaMinor: -input.amountMinor,
    note: "تغطية مصروف من رصيد المحفظة",
    sourceRefId: input.eventId,
    sourceRefKind: "expense",
    operationKey: `${input.operationKey}:attribute`,
  });
  return result.ok ? { ok: true, message: null } : { ok: false, message: result.message };
}
