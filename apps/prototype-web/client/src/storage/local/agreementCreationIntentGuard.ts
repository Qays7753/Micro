/**
 * S12-FIN-001 (أمر S13 2158b0fc §5 — موجدة المراجعة المستقلة عند ac4429ef):
 * نواة قرار نقية واحدة لنية إنشاء الاتفاق — يستهلكها المهايئان معًا
 * (ذاكرة وIndexedDB) داخل حد الكتابة الواحد، والخدمة قبل مسارها السريع،
 * فتطابقهما الدلالي بنيويّ لا بالترجمة (نمط directSaleCommitGuard/
 * orderCommitGuard).
 *
 * عقد المقارنة الكنونية — كل حقل إنشاء فعال مُصرَّح به، ولا شيء غيره:
 *  - هوية المصدر/المسودة: العميل واسم الطلب والقطعة والمواصفات والكمية
 *    ومرجع الكتالوج ومصدر الاتفاق (لقطة المصدر كما حُفظت عند الإنشاء)؛
 *  - السعر المتفق عند الإنشاء: يُفكّ عنه أي تعديل سعر لاحق بسلسلة
 *    fromPriceMinor لأول تعديل — إعادة محاولة الأمر نفسه بعد تطور السجل
 *    إعادةُ استخدام صادقة لا تعارضًا (حفظ دلالة outcome_unknown)؛
 *  - العربون الابتدائي: مبلغه بهوية نيته الحتمية `${id}:initial-deposit`
 *    (زمن الكتابة ليس نية — تاريخ العربون عند الإنشاء هو لحظة الإنشاء
 *    نفسها فلا يُقارن)؛
 *  - ثلاثية موعد التسليم: null (مجهول صريح) أو تاريخ محلي صحيح؛
 *  - نمط التكلفة ومرجعها: `costSnapshots[0]` — لقطة الإنشاء المجمدة (id
 *    + بصمة المحتوى دون createdAt؛ مرجع التكلفة المجهولة حتمي والمعروف
 *    بمعرف نسخته المحفوظة)؛
 *  - شروط النقل الابتدائية: حدثها الحتمي `${id}:initial-delivery-terms`
 *    (المسؤولية بنصها والمبلغ) وعلمانها الماليان الفعّالان
 *    (costIncludedInProductCost وfeeIncludedInPrice) من الشروط الحية
 *    ما دام حدث الشروط الابتدائية آخر أحداث الشروط — S13-R2-F01
 *    (تصحيح المراجعة الثانية): العلم مُصرَّح ماليًا عند الإنشاء (يصفر كلفة
 *    توصيل المشروع أو يبقيها) فنيّته جزء من المقارنة الكنونية؛ التعديلات
 *    اللاحقة بمفاتيحها الخاصة لا تمس نية الإنشاء، وبعد أول تعديل شروط
 *    صريح تصبح قيمة العلمين عند الإنشاء غير قابلة للاسترجاع (الحدث لا
 *    يحملهما والتعديل لا يحمل سابقه) فلا يميز المقارنة — حد موثق لا
 *    تساهل: استرجاعهما يستلزم شكلًا جديدًا على السلك بقرار مالك؛
 *  - مستبعد عمدًا (بيانات كتابة/تطور لاحق لا نية): createdAt/updatedAt،
 *    الحالة والأحداث اللاحقة، العربونات/التحصيلات اللاحقة، المتابعات.
 *
 * القرار: نية متطابقة = إعادة استخدام صادقة للسجل القائم نفسه بلا أي
 * كتابة ثانية؛ والمفتاح نفسه بحمولة إنشاء مختلفة = تعارض صريح بلا كتابة
 * ولا أثر جدول/قبض/مصروف جانبي — لا يُطمَر الأول ولا يُبلَّغ عن الثاني
 * كنجاح (نمط SDF-037/038 نفسه).
 */
import type { StoredCraftOrder } from "./types";
import { STORAGE_STALE } from "./resultCodes";

/** رسالة تعارض حمولة الإنشاء بالمفتاح نفسه — لا استبدال صامت ولا نجاح كاذب. */
export const AGREEMENT_CREATION_CONFLICT_MESSAGE =
  "سُجّل اتفاق لهذه المسودة سابقًا بحمولة مختلفة — لم يُكتب شيء ولم يُستبدل شيء؛ راجع الاتفاق المحفوظ ثم أعد المحاولة بقصد جديد.";

/** نية إنشاء الاتفاق الكنونية — الحقول الفعالة وحدها (انظر العقد أعلاه). */
export type AgreementCreationIntent = {
  customerName: string;
  orderName: string | null;
  itemName: string;
  specifications: string;
  quantity: number;
  catalogItemId: string | null;
  agreementSource: string | null;
  creationAgreedPriceMinor: number;
  deliveryDate: string | null;
  costSnapshotId: string;
  costSnapshotFingerprint: string;
  initialDepositMinor: number;
  initialDeliveryTerms: {
    responsibilityNote: string | null;
    amountMinor: number | null;
    /* العلمان الفعّالان عند الإنشاء — null = بعد تعديل شروط صريح (قيمة
     * الإنشاء غير قابلة للاسترجاع) فلا يميزا المقارنة. */
    costIncludedInProductCost: boolean | null;
    feeIncludedInPrice: boolean | null;
  } | null;
};

/** بصمة كنونية لقيمة JSON بمفاتيح مرتبة — تسقط كل createdAt أينما ورد
 * (زمن الكتابة ليس نية) وتثبت المحتوى المالي كله. */
function canonicalFingerprint(value: unknown): string {
  const walk = (input: unknown): unknown => {
    if (input === null || typeof input !== "object") return input ?? null;
    if (Array.isArray(input)) return input.map(walk);
    const record: Record<string, unknown> = {};
    for (const key of Object.keys(input as Record<string, unknown>).sort())
      if (key !== "createdAt") record[key] = walk((input as Record<string, unknown>)[key]);
    return record;
  };
  return JSON.stringify(walk(value));
}

/** استخراج نية الإنشاء من سجل مُصرَّح — يعمل على الإنشاء الطازج والسجل
 * الحي المتطور معًا: الحقول اللاحقة تُفكّ إلى قيمها عند الإنشاء بمفاتيح
 * النية الحتمية، دالة كلية لا ترمي أبدًا. */
export function agreementCreationIntentOf(stored: StoredCraftOrder): AgreementCreationIntent {
  const { order } = stored;
  /* السعر عند الإنشاء: أول تعديل سعر يحمل سعر ما قبله؛ بلا تعديلات فالسعر
   * الحالي هو سعر الإنشاء. */
  const firstPriceRevision = order.events.find(event => event.type === "price_revised");
  const creationAgreedPriceMinor = firstPriceRevision?.fromPriceMinor ?? order.agreedPriceMinor;
  /* العربون الابتدائي ونيته الحتمية. */
  const initialDeposit = order.events.find(event => event.idempotencyKey === `${order.id}:initial-deposit`);
  /* شروط النقل الابتدائية وحدثها الحتمي (التعديلات اللاحقة مفاتيحها أخرى).
   * S13-R2-F01: علماء الشروط الفعّالان مقروءان من الشروط الحية ما دام
   * الحدث الابتدائي آخر أحداث الشروط؛ بعد تعديل صريح تصبح القيمة الحية
   * للتعديل لا للإنشاء فلا تُقارن (null موثق في العقد أعلاه). */
  const initialTerms = order.events.find(
    event => event.idempotencyKey === `${order.id}:initial-delivery-terms`,
  );
  const termsRevisedAfterCreation = order.events.some(
    event =>
      event.type === "delivery_terms_recorded" &&
      event.idempotencyKey !== `${order.id}:initial-delivery-terms`,
  );
  /* لقطة تكلفة الإنشاء: أول لقطة مجمدة عند الإنشاء (المراجعات تُلحق لا تستبدل). */
  const creationSnapshot = order.costSnapshots[0] ?? order.costSnapshot;
  return {
    customerName: order.customerName,
    orderName: order.orderName ?? null,
    itemName: order.itemName,
    specifications: order.specifications,
    quantity: order.quantity,
    catalogItemId: stored.catalogItemId ?? null,
    agreementSource: stored.agreementSource ?? null,
    creationAgreedPriceMinor,
    deliveryDate: stored.deliveryDate ?? null,
    costSnapshotId: creationSnapshot.id,
    costSnapshotFingerprint: canonicalFingerprint(creationSnapshot),
    initialDepositMinor: initialDeposit?.amountMinor ?? 0,
    initialDeliveryTerms: initialTerms
      ? {
          responsibilityNote: initialTerms.note ?? null,
          amountMinor: initialTerms.amountMinor ?? null,
          costIncludedInProductCost: termsRevisedAfterCreation
            ? null
            : (order.deliveryTerms?.costIncludedInProductCost ?? null),
          feeIncludedInPrice: termsRevisedAfterCreation
            ? null
            : (order.deliveryTerms?.feeIncludedInPrice ?? null),
        }
      : null,
  };
}

/** علم شروط ابتدائي: قيمتان معلومتان تُقارنان؛ وnull في أي جهة (بعد تعديل
 * صريح — قيمة الإنشاء غير قابلة للاسترجاع) لا يميز المقارنة (موثق أعلاه). */
function termsFlagMatches(left: boolean | null | undefined, right: boolean | null | undefined): boolean {
  if (left === null || left === undefined || right === null || right === undefined) return true;
  return left === right;
}

/** مطابقة نيتَي إنشاء — كل الحقول الفعالة بالقيمة (null/undefined متكافئان). */
export function sameAgreementCreationIntent(
  left: AgreementCreationIntent,
  right: AgreementCreationIntent,
): boolean {
  const norm = <T>(value: T | null | undefined) => value ?? null;
  return (
    norm(left.customerName) === norm(right.customerName) &&
    norm(left.orderName) === norm(right.orderName) &&
    norm(left.itemName) === norm(right.itemName) &&
    norm(left.specifications) === norm(right.specifications) &&
    left.quantity === right.quantity &&
    norm(left.catalogItemId) === norm(right.catalogItemId) &&
    norm(left.agreementSource) === norm(right.agreementSource) &&
    left.creationAgreedPriceMinor === right.creationAgreedPriceMinor &&
    norm(left.deliveryDate) === norm(right.deliveryDate) &&
    left.costSnapshotId === right.costSnapshotId &&
    left.costSnapshotFingerprint === right.costSnapshotFingerprint &&
    left.initialDepositMinor === right.initialDepositMinor &&
    norm(left.initialDeliveryTerms?.responsibilityNote) ===
      norm(right.initialDeliveryTerms?.responsibilityNote) &&
    norm(left.initialDeliveryTerms?.amountMinor) === norm(right.initialDeliveryTerms?.amountMinor) &&
    termsFlagMatches(
      left.initialDeliveryTerms?.costIncludedInProductCost,
      right.initialDeliveryTerms?.costIncludedInProductCost,
    ) &&
    termsFlagMatches(
      left.initialDeliveryTerms?.feeIncludedInPrice,
      right.initialDeliveryTerms?.feeIncludedInPrice,
    )
  );
}

/** قرار حد الكتابة للإنشاء من المسودة: سجل قائم بنفس المفتاح — نية
 * متطابقة إعادة استخدام (لا كتابة)، ونية مختلفة تعارض صريح (لا كتابة). */
export type AgreementCreationDecision =
  { kind: "reuse" } | { kind: "conflict"; code: typeof STORAGE_STALE; message: string };

export function decideAgreementCreationCommit(
  incoming: StoredCraftOrder,
  existing: StoredCraftOrder,
): AgreementCreationDecision {
  if (sameAgreementCreationIntent(agreementCreationIntentOf(incoming), agreementCreationIntentOf(existing)))
    return { kind: "reuse" };
  return { kind: "conflict", code: STORAGE_STALE, message: AGREEMENT_CREATION_CONFLICT_MESSAGE };
}
