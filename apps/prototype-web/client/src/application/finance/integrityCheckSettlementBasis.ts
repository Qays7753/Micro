/* MIC-18 (Group 1 — الميثاق الرئيسي، F-004/F-005): ثابت أساس التسوية —
 * انتقل حرفيًا من integrityCheckService.ts في Wave F (ADR-013 — تقسيم
 * مسؤولية داخلي)؛ الفحص قراءة فقط بلا إصلاح تلقائي كإخوته.
 *
 * الاشتقاق ومفردات التفصيل يملكهما الدومين (settlementInvariant.ts — عقد ٢
 * وحارس D-15 مصدر القاعدة) ويُحمَّلان عند الفحص فقط فلا يدخلان حزمة الدخول
 * (سقف D-034)؛ والعنوان من سجل فحوص التطبيق فيبقى مصدر المفردات واحدًا لكل
 * طبقة. الاستيراد العميق الموثق (STR-205/STR-313 — استثناء مقيس في سجل
 * الملكية §5) انتقل مع الفحص إلى هذا البيت نفسه؛ تحديث الأساس تم في نفس
 * الـPR (حارس الحدود R1). */
import {
  INTEGRITY_TITLES,
  type IntegrityCheckContext,
  type IntegrityCheckResult,
  unavailable,
} from "./integrityCheckModel";

export async function checkSettlementBasisInvariant(
  ctx: IntegrityCheckContext,
): Promise<IntegrityCheckResult> {
  const ordersResult = await ctx.store.listOrders();
  if (!ordersResult.ok) return unavailable("MIC-18", "تعذر قراءة الطلبات المحلية — أعد المحاولة.");
  const { settlementInvariantResult } = await import("@micro-domain/craft-order/settlementInvariant.js");
  return settlementInvariantResult(ordersResult.value, INTEGRITY_TITLES["MIC-18"]);
}
