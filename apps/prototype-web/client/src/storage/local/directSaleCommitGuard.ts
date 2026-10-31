/**
 * S11 (UNIT-005/026 sale-slice — أمر b33a8877 §6): حارس التزام كتابة البيع
 * المباشر — نواة قرار نقية واحدة يستهلكها المهايئان معًا (ذاكرة وIndexedDB)
 * فتطابقهما الدلالي بنيويّ لا بالترجمة (نمط orderCommitGuard/decideCounterpartyCommit).
 *
 * عقد الحد (معاملة readwrite واحدة على مخزني البيع وقيد الكاش في IndexedDB،
 * وخطوة متزامنة واحدة في الذاكرة) — الإنجاز أو التسليم معًا أو لا شيء:
 *  1. الإنشاء (base=null): عهدة مفتاح التسجيل — بيع حي يحمل المفتاح نفسه
 *     يُعاد كما هو (reuse) بلا سجل ثانٍ أيًّا كان معرّف المحاولة الجديد؛
 *     حمولة مختلفة بالمفتاح نفسه تعارض صادق (SDF-038)؛ ومعرّف مشغول بسجل
 *     آخر تعارض كتابة.
 *  2. التحديث (base!=null) — تحصيل/مرتجع/رد/تصحيح/إلغاء: فحص النسخة
 *     والمتبقي الحيين داخل الحد (سلطة القراءة الحية لا نسخة الخدمة):
 *     أي تقدم في السجل الحي على الأساس الذي بُني عليه القرار (مراجعات أو
 *     مجموع مقبوض أو مجموع مردود أو حالة أو مرتجع) = storage_stale بلا
 *     أي كتابة — نافذتا تحصيل للمتبقي نفسه تنجح واحدة وتراجع الأخرى بلا
 *     حق سالب ولا قبض مزدوج (SDF-039).
 *  3. عهدة مفتاح الحركة: حركة حية بمفتاح النية نفسه تُعاد كما هي (reuse)
 *     بأثر الكاش المطابق إن وجد؛ وحمولة قبض مختلفة بالمفتاح نفسه تعارض
 *     صادق بلا كتابة ولا استبدال صامت (SDF-037/038).
 */
import type { CashContinuityEntry } from "@micro-domain/cash-continuity/index.js";
import type { DirectSale } from "@micro-domain/direct-sale/index.js";
import { STORAGE_ERROR, STORAGE_STALE } from "./resultCodes";

/** رسالة تعارض النسخة الحية — نمط RECURRENCE_STALE الموحد للحد المحروس. */
export const DIRECT_SALE_STALE_MESSAGE =
  "هذا البيع تغيّر من مسار آخر بعد فتحك له — لم يُسجَّل شيء؛ أعد الفتح ثم أعد المحاولة.";
/** رسالة تعارض الحمولة بالمفتاح نفسه — لا استبدال صامت ولا نتيجة مجهولة تُتجاوز بمفتاح جديد. */
export const DIRECT_SALE_INTENT_CONFLICT_MESSAGE =
  "حُفظت حركة بهذا الأمر سابقًا بحمولة مختلفة — لم يُسجَّل شيء ولم يُستبدل شيء؛ تحقق من الحركة المحفوظة ثم أعد المحاولة بأمر جديد.";
const DIRECT_SALE_MISSING_MESSAGE = "لم نجد البيع المباشر المحلي لهذه الكتابة.";
const DIRECT_SALE_ID_COLLISION_MESSAGE = "معرّف البيع مشغول بسجل آخر — لم يُكتب شيء.";

export type DirectSaleWriteDecision =
  | { kind: "reuse"; sale: DirectSale }
  | { kind: "reject"; code: "storage_stale" | "storage_error"; message: string }
  | { kind: "commit" };

/** نية إنشاء واحدة: الحمولة المالية الجوهرية للبيع (لا المعرفات ولا الأزمنة). */
function sameCreatePayload(live: DirectSale, next: DirectSale): boolean {
  return (
    live.revenueMinor === next.revenueMinor &&
    live.collectedMinor === next.collectedMinor &&
    live.occurredOn === next.occurredOn &&
    live.itemName.trim() === next.itemName.trim()
  );
}

/** الأساس الحي: هل السجل الحي ما زال هو الأساس الذي بُني عليه القرار؟ —
 * فحص النسخة والمتبقي الحيين (S11 §6: داخل حد الكتابة لا قبله). */
function sameLiveBasis(live: DirectSale, base: DirectSale): boolean {
  return (
    (live.revisions?.length ?? 0) === (base.revisions?.length ?? 0) &&
    live.collectedMinor === base.collectedMinor &&
    (live.refundedMinor ?? 0) === (base.refundedMinor ?? 0) &&
    (live.status ?? "active") === (base.status ?? "active") &&
    (live.return?.operationKey ?? null) === (base.return?.operationKey ?? null)
  );
}

export function decideDirectSaleWrite(
  base: DirectSale | null,
  next: DirectSale,
  idempotencyKeys: readonly string[],
  liveById: DirectSale | null,
  liveByIdempotencyKey: DirectSale | null,
): DirectSaleWriteDecision {
  /* ١) الإنشاء: العهدة بمفتاح التسجيل ثم تعارض المعرف ثم الكتابة. */
  if (base === null) {
    if (liveByIdempotencyKey) {
      if (!sameCreatePayload(liveByIdempotencyKey, next))
        return { kind: "reject", code: STORAGE_STALE, message: DIRECT_SALE_INTENT_CONFLICT_MESSAGE };
      return { kind: "reuse", sale: liveByIdempotencyKey };
    }
    if (liveById) return { kind: "reject", code: STORAGE_ERROR, message: DIRECT_SALE_ID_COLLISION_MESSAGE };
    return { kind: "commit" };
  }
  /* ٢) التحديث: السجل الحي غائب = فشل صادق (لا كتابة فوق لا شيء). */
  if (!liveById) return { kind: "reject", code: STORAGE_ERROR, message: DIRECT_SALE_MISSING_MESSAGE };
  /* ٣) عهدة مفتاح الحركة: الحركة موجودة سلفًا — إعادة استخدام أو تعارض حمولة. */
  for (const key of idempotencyKeys) {
    const liveHasRevision = (liveById.revisions ?? []).some(revision => revision.idempotencyKey === key);
    const liveHasReturn = liveById.return?.operationKey === key;
    const liveCollection = (liveById.collections ?? []).find(entry => entry.operationKey === key);
    const liveRefund = (liveById.refundPayments ?? []).find(entry => entry.operationKey === key);
    if (liveHasRevision || liveHasReturn || liveCollection || liveRefund) {
      /* حمولة القبض/الرد المختلفة بالمفتاح نفسه تعارض صادق لا استبدال صامت. */
      const nextCollection = (next.collections ?? []).find(entry => entry.operationKey === key);
      const nextRefund = (next.refundPayments ?? []).find(entry => entry.operationKey === key);
      const livePayload = liveCollection ?? liveRefund ?? null;
      const nextPayload = nextCollection ?? nextRefund ?? null;
      if (livePayload && nextPayload) {
        if (
          livePayload.amountMinor !== nextPayload.amountMinor ||
          livePayload.occurredOn !== nextPayload.occurredOn
        )
          return { kind: "reject", code: STORAGE_STALE, message: DIRECT_SALE_INTENT_CONFLICT_MESSAGE };
      }
      /* S11 (تصحيح المراجعة R3-001): حمولة المرتجع الكامل بالمفتاح نفسه —
       * التاريخ والسبب الموثق جوهر الواقعة؛ اختلافهما تعارض صادق لا عودة
       * صامتة لسجل قديم (نمط SDF-037/038 نفسه). */
      if (liveHasReturn && next.return?.operationKey === key) {
        if (
          liveById.return?.occurredOn !== next.return.occurredOn ||
          liveById.return?.reason !== next.return.reason
        )
          return { kind: "reject", code: STORAGE_STALE, message: DIRECT_SALE_INTENT_CONFLICT_MESSAGE };
      }
      return { kind: "reuse", sale: liveById };
    }
  }
  /* ٤) فحص النسخة والمتبقي الحيين داخل الحد — الحي تقدم على أساس القرار. */
  if (!sameLiveBasis(liveById, base))
    return { kind: "reject", code: STORAGE_STALE, message: DIRECT_SALE_STALE_MESSAGE };
  return { kind: "commit" };
}

/** البحث الحتمي عن أثر الكاش المطابق لمفتاح العملية عند إعادة الاستخدام —
 * المهايئان يستدعيه داخل الحد نفسه فيعيدان الأثر نفسه. */
export function findCashEntryByOperationKey(
  entries: readonly CashContinuityEntry[],
  operationKey: string,
): CashContinuityEntry | null {
  return entries.find(entry => entry.operationKey === operationKey) ?? null;
}
