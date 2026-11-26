/**
 * M2.3 (§9/INV-1 وINV-2 + §13 — مانج-في₂، الموجة E): التأكيد المفرد
 * الذي تختم به كل اختبارات القبول من هنا فصاعدًا — «كل اختبار ينتهي بـ
 * assert INV-1 وassert INV-2» (نص المهمة + §13/§2 قاعدة 5): فحص الثابتين
 * في نداء واحد، يرمي برسالة عربية تسمّي كل خرق، ويعيد النتيجتين لمن أراد
 * التحقق من حالة «مجهول» صراحة.
 *
 * INV-1 بحالة فتح مجهول نشط تُعيد `unknown` ولا ترمي — حالة مشروعة قبل
 * أول مطابقة (§7.3، والتفسير المُلزم 6 في أمر المرحلة 2)، والاختبار الذي
 * يريد تسميتها يستدعي `checkInv1` مباشرة ويتحقق من النتيجة.
 */
import { checkInv1, checkInv2 } from "./stateChecks.js";
import type { CoreInvariantResults, LedgerCheckState } from "./types.js";

/** تأكيد INV-1 وINV-2 في نداء واحد: يرمي عند أي خرق، ويعيد النتيجتين دومًا. */
export function assertLedgerCoreInvariants(state: LedgerCheckState): CoreInvariantResults {
  const inv1 = checkInv1(state);
  const inv2 = checkInv2(state);
  const failures: string[] = [];
  if (inv1.outcome === "violation") {
    failures.push(...inv1.violations.map(v => `INV-1: ${v}`));
  }
  if (inv2.outcome === "violation") {
    failures.push(...inv2.violations.map(v => `INV-2: ${v}`));
  }
  if (failures.length > 0) {
    throw new Error(`فشل تأكيد ثابتي القبول على حالة الدفتر:\n- ${failures.join("\n- ")}`);
  }
  return { inv1, inv2 };
}
