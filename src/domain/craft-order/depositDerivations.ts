/**
 * R10-B4/F-021 (2026-10-12): اشتقاقات قراءة صرفة لعائلة العربون — ملكية
 * الدومين حيث تكتب مسارات السياسات الشقيقة (policies.ts)، في وحدة شقيقة
 * منفصلة عمدًا: الصفحات الكسولة وحدها تستهلكها فتُحزم مع chunk الطلب لا
 * مع حزمة الدخول (policies.js نفسها فوق خدمات الإقلاع). تقرأ الاشتقاقات
 * بالقارئات الكنسية نفسها التي تكتب بها المسارات (retainedDepositMinor /
 * classifiedSumsOf — بما فيه التوافق الرجعي للبيانات القديمة)؛ لا صيغة
 * ثانية تتباعد ولا كتابة أبدًا.
 */
import type { CraftOrder } from "./types.js";
import type { MoneyMinor } from "../shared/index.js";
import { classifiedSumsOf, retainedDepositMinor } from "./policies.js";

/* العربون القائم القابل للعكس (سقف عكس العربون النشط) — مقيدومًا بالصفر
 * للعرض الآمن؛ مسار الكتابة يرفض السالب بنفسه. */
export function standingDepositMinorOf(order: CraftOrder): MoneyMinor {
  return Math.max(order.depositCollectedMinor - retainedDepositMinor(order), 0);
}

/* العربون المعلق لتسوية الملغى — نفس نواة سقف الرد/الاحتفاظ في المسار. */
export function pendingDepositSettlementMinorOf(order: CraftOrder): MoneyMinor {
  return order.depositCollectedMinor - retainedDepositMinor(order);
}

/* المحتفظ به غير المصنَّف — سقف التصنيف نفسه الذي يفرضه المسار الكاتب. */
export function unclassifiedRetainedDepositMinorOf(order: CraftOrder): MoneyMinor {
  const retained = retainedDepositMinor(order);
  const sums = classifiedSumsOf(order);
  return retained - sums.ownerMinor - sums.revenueMinor;
}

/* معاينة اقتراح تسوية عربون الملغى (Conflict E): التغطية حتى التكلفة
 * الموثقة والرد المقترح للباقي — اقتراح قرار لا قرارًا؛ المبلغ الصريح
 * للمالك يعلو دائمًا. */
export function cancelledDepositProposalOf(order: CraftOrder): {
  coverProposalMinor: MoneyMinor;
  refundProposalMinor: MoneyMinor;
} {
  const pendingMinor = pendingDepositSettlementMinorOf(order);
  const coverProposalMinor = Math.min(pendingMinor, order.costSnapshot.plannedCostMinor);
  return { coverProposalMinor, refundProposalMinor: pendingMinor - coverProposalMinor };
}
