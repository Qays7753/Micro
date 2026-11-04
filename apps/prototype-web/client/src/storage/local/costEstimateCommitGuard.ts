/**
 * S10-MR-001 (أمر S11 — القسم ٥، b33a8877): حارس التزام إنشاء حساب التخطيط
 * T01 — نواة قرار نقية واحدة يستهلكها المهايئان معًا (ذاكرة وIndexedDB)
 * فتطابقهما الدلالي بنيويّ لا بالترجمة (نمط decideCounterpartyCommit).
 *
 * المكتشف المستقل: مسار الحفظ القديم كان يقرأ قائمة الحسابات ثم يكتب سجلًا
 * بمعرّف جديد في خطوتين منفصلتين، فنداءان متزامنان بمفتاح النية نفسه
 * (createdOperationKey) يكملان القراءة قبل أي كتابة فينشئان حسابين — عهدة
 * «النية نفسها لا تنشئ حسابًا ثانيًا» لم تكن محروسة عند حد الكتابة.
 *
 * عقد الحد (معاملة readwrite واحدة على مخزن التقديرات في IndexedDB —
 * getAll كامل داخل الحد لأن للمخزن فهرس updatedAt وحده ولا فهرس
 * operationKey فلا ترقية مخطط؛ وخطوة متزامنة واحدة في الذاكرة):
 *  1. العهدة — مفتاح النية نفسه بمدخلات مطابقة يعيد السجل المحفوظ نفسه
 *     (reuse) بلا أي كتابة ثانية، أيًا كان معرّف المحاولة الجديد.
 *  2. مدخلات مختلفة بمفتاح نية مقيم = تعارض صادق (reject بلا أي كتابة):
 *     لا يُعاد السجل القديم كأنه حفظ للمدخلات الجديدة ولا يُنشأ حساب ثانٍ
 *     للتحايل على نتيجة غير محسومة؛ المتصل يفشل صراحةً وتُصان مدخلاته.
 *  3. لا مفتاح نية (createdOperationKey غائب/null) = كتابة مباشرة
 *     (commit) — نفس عقد saveCostEstimate الحتمي بالمعرّف.
 */
import type { CostEstimate } from "./types";
import { STORAGE_STALE } from "./resultCodes";

/** تعارض نية الحفظ المقيمة — الرسالة الكنونية الموحدة للحد المحروس. */
export const COST_ESTIMATE_INTENT_CONFLICT_MESSAGE =
  "حُفظ حساب بهذه النية سابقًا بمدخلات مختلفة — لم يُحفظ تعديلك ولم يُنشأ حساب ثانٍ؛ افتح الحساب المحفوظ لتعديله أو استخدم «حفظ نسخة» لنية جديدة.";

/* مقارنة بنيوية عميقة — النسخ الواردة منخفضة المرجع دائمًا (clone/structured
 * clone) فالمساواة بالمرجع ترفض كل عهدة مشروعة؛ null/undefined متكافئان هنا
 * لأن الحقول الاختيارية تُقرأ غائبة أو null عبر تطور المخطط لا فرق بينهما
 * (نمط deliveryReversalCommitGuard نفسه). */
function deepEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (left == null || right == null) return left == null && right == null;
  if (typeof left !== "object" || typeof right !== "object") return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => deepEqual(item, right[index]));
  }
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const keys = new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)]);
  return Array.from(keys).every(key => deepEqual(leftRecord[key], rightRecord[key]));
}

/** نفس نية الحفظ = العنوان ومصدر التخطيط المحفوظ (المدخلات ونتيجتها
 * التاريخية المشتقة بالنواة الواحدة الحتمية) متطابقان بنيويًا — حقلان
 * تُشتق حتميًا من PlanningSaveInput نفسه فلا يتذبذب القرار بين محاولتين
 * بالمدخلات نفسها، وأي تغيير حقيقي في المدخلات يكسر التطابق فيُرفض صادقًا. */
function samePlanningIntent(live: CostEstimate, candidate: CostEstimate): boolean {
  return live.title === candidate.title && deepEqual(live.planning ?? null, candidate.planning ?? null);
}

/** البحث الحتمي عن سجل مفتاح النية — الأقدم إنشاءً هو الأصل (النية
 * الأولى) ثم المعرّف قاطعًا للتعادل؛ المهايئان يستخدمان القاعدة نفسها
 * فيعيدان السجل نفسه مهما تعددت السجلات التاريخية للمفتاح الواحد. */
export function findCostEstimateByOperationKey(
  records: readonly CostEstimate[],
  operationKey: string,
): CostEstimate | null {
  const matches = records.filter(record => record.createdOperationKey === operationKey);
  if (matches.length === 0) return null;
  matches.sort(
    (left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
  );
  const original = matches[0];
  return original ?? null;
}

export type CostEstimateCreateDecision =
  | { kind: "reuse"; estimate: CostEstimate }
  | { kind: "reject"; code: typeof STORAGE_STALE; message: string }
  | { kind: "commit" };

export function decideCostEstimateCreate(
  liveByOperationKey: CostEstimate | null,
  candidate: CostEstimate,
): CostEstimateCreateDecision {
  /* ١) لا سجل بالمفتاح (أو لا مفتاح أصلًا): كتابة جديدة بالمعرّف. */
  if (!liveByOperationKey) return { kind: "commit" };
  /* ٢) العهدة: المفتاح نفسه بمدخلات مطابقة — إعادة الاستخدام بلا كتابة. */
  if (samePlanningIntent(liveByOperationKey, candidate))
    return { kind: "reuse", estimate: liveByOperationKey };
  /* ٣) مدخلات مختلفة بمفتاح مقيم: تعارض صادق بلا أي كتابة. */
  return { kind: "reject", code: STORAGE_STALE, message: COST_ESTIMATE_INTENT_CONFLICT_MESSAGE };
}
