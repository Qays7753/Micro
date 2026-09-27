import type { MoneyMinor } from "../shared/index.js";

/* D-15 (FIN-009): الوصف البسيط لمن يدفع التوصيل — يستنتج من مساهمتي
 * الطرفين المسجلتين لا من خيار «مشترك» مستقل: مساهمة مشروع موجبة مع عميل
 * صفر/غير مسجل → «على المشروع»؛ والعكس → «على العميل»؛ الموجبان معًا →
 * «مشترك»؛ الصريحان صفرًا → «لا توجد مساهمة»؛ وغياب القيمتين معًا → لم
 * تُسجل بعد. قيمة صريحة صفر مع أخرى غير مسجلة تبقى معرفة ناقصة معلنة.
 *
 * مثل DELIVERY_RESPONSIBILITY_AR في policies: مفردات عرض يملكها الدومين
 * وتُقرأ حيث تُعرض؛ وحدة مستقلة كي تُحزم مع مستهلكيها لا مع نواة السياسات. */
export function describeDeliveryContribution(contribution: {
  projectMinor: MoneyMinor | null;
  customerMinor: MoneyMinor | null;
  customerPaysCourierDirect: boolean;
}): string {
  if (contribution.customerPaysCourierDirect) {
    return "الزبون يدفع لشركة التوصيل مباشرة — لا مستحق للمشروع من التوصيل.";
  }
  const project = contribution.projectMinor;
  const customer = contribution.customerMinor;
  if (project === null && customer === null) return "لم تُسجَّل مساهمة توصيل بعد.";
  const projectBears = (project ?? 0) > 0;
  const customerBears = (customer ?? 0) > 0;
  if (projectBears && customerBears) return "التوصيل مشترك بين المشروع والعميل.";
  if (projectBears) return "التوصيل على المشروع.";
  if (customerBears) return "التوصيل على العميل.";
  if (project === 0 && customer === 0) return "لا توجد مساهمة توصيل — التوصيل مجاني.";
  /* حالة مختلطة: قيمة صريحة صفر مع قيمة غير مسجلة — معرفة ناقصة معلنة. */
  return "مساهمة التوصيل غير محددة بالكامل بعد.";
}
