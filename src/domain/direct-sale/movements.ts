/**
 * S11 (UNIT-005/026 sale-slice — أمر b33a8877 §6): حركات البيع المباشر
 * المالية — التحصيل المؤرخ والمرتجع الكامل PD-02 ودفع الرد. بيت مستقل
 * داخل عائلة البيع (ملف واحد مسؤولية واحدة): مدخل المحرر وورقة التحصيل
 * يستهلكانه عبر السطح العام نفسه، والإنشاء/التصحيح/الإلغاء القائمة
 * تبقى في policies.ts؛ حتمية البيع ومعينات المتبقي مشتركة بين البيتين.
 */
import { isValidTimestamp } from "../shared/index.js";
import type {
  CollectDirectSalePaymentInput,
  DirectSale,
  DirectSaleCollectionStatus,
  DirectSaleCollectionEntry,
  DirectSaleFullReturnInput,
  DirectSaleRefundPaymentEntry,
  PayDirectSaleRefundInput,
  ReverseDirectSaleCollectionInput,
} from "./types.js";
import {
  assertLocalDate,
  assertPositiveInteger,
  assertText,
  directSaleOutstandingMinor,
  revisionList,
} from "./policies.js";

/* S11 (UNIT-026 sale-slice / SDF-054): حق الرد القائم — ما ثبت رده دون ما
 * رُدّ فعليًا؛ معيّن المجال الواحد الذي تقرأه الواجهة والقارئات (لا مرايا
 * حساب في TSX). */
export function directSaleRefundOutstandingMinor(sale: DirectSale): number {
  if (!sale.return) return 0;
  return Math.max(sale.return.refundDueMinor - (sale.refundedMinor ?? 0), 0);
}

/* S11 (UNIT-026 sale-slice): أهلية التحصيل ومقداره — مصدر حي بمتبقى مؤكد
 * دَينًا (الفرق غير المحسوم يُحسم أولًا بفعل تحديد الفرق، والنقدي الكامل لا
 * متبقى له) والمبلغ لا يتجاوز المتبقي الحي فلا يكون الحق سالبًا أبدًا. */
function assertCollectEligibility(sale: DirectSale, amountMinor: number): void {
  if ((sale.status ?? "active") === "cancelled") throw new Error("بيع مباشر ملغى لا يُحصّل منه.");
  if (sale.return) throw new Error("بيع مُرتجع كاملًا لا يُحصّل منه — حقه أُلغي بالمرتجع.");
  if (sale.collectionStatus !== "partial_debt")
    throw new Error("التحصيل يخص بيعًا آجل مؤكد المتبقي — حدّد الفرق أولًا إن كان يحتاج مراجعة.");
  assertPositiveInteger(amountMinor, "amountMinor");
  if (amountMinor > directSaleOutstandingMinor(sale))
    throw new Error("التحصيل يتجاوز المتبقي الحي على هذا البيع — حصّل المتبقي أو أقل منه.");
}

export function collectDirectSalePayment(sale: DirectSale, input: CollectDirectSalePaymentInput): DirectSale {
  assertCollectEligibility(sale, input.amountMinor);
  assertText(input.entryId, "entryId");
  assertText(input.operationKey, "operationKey");
  if (!isValidTimestamp(input.recordedAt)) throw new Error("أدخل وقت الحركة وقتًا صحيحًا.");
  assertLocalDate(input.occurredOn);
  assertMovementKeyUnused(sale, input.operationKey);
  const collectedMinor = sale.collectedMinor + input.amountMinor;
  const entry: DirectSaleCollectionEntry = Object.freeze({
    id: input.entryId.trim(),
    amountMinor: input.amountMinor,
    occurredOn: input.occurredOn,
    operationKey: input.operationKey.trim(),
    recordedAt: input.recordedAt,
    note: input.note?.trim() || null,
    allocationEntryId: input.allocationEntryId?.trim() || null,
  });
  return Object.freeze({
    ...sale,
    collectedMinor,
    /* التحصيل لا يخلق إيرادًا ولا ربحًا — الحالة الصادقة للمتبقي فقط. */
    collectionStatus: collectedMinor >= sale.revenueMinor ? "collected_in_full" : "partial_debt",
    collections: [...(sale.collections ?? []), entry],
  });
}

/* S11 (UNIT-005/PD-02 — أمر b33a8877 §6): المرتجع الكامل المؤهل في تاريخه —
 * يُبقي البيع الأصل وتاريخه وسجل تغييراته، ويلغي الحق المتبقي (لا يُحصّل
 * بعده)، ويثبت حق رد المقبوض فعليًا فقط؛ لا نقص نقد ولا عكس تكلفة ولا
 * إرجاع مخزون تلقائي — الرد الفعلي فعل مؤرخ لاحق بمالكه. */
export function applyFullReturn(sale: DirectSale, input: DirectSaleFullReturnInput): DirectSale {
  if ((sale.status ?? "active") === "cancelled")
    throw new Error("لا يمكن إرجاع بيع ملغى — استعمل أفعال الإلغاء.");
  if (sale.return) throw new Error("سُجّل المرتجع الكامل لهذا البيع مسبقًا.");
  if (!input.reason.trim()) throw new Error("أكمل سبب المرتجع قبل الحفظ.");
  assertText(input.operationKey, "operationKey");
  if (!isValidTimestamp(input.recordedAt)) throw new Error("أدخل وقت الحركة وقتًا صحيحًا.");
  assertLocalDate(input.occurredOn);
  assertMovementKeyUnused(sale, input.operationKey);
  return Object.freeze({
    ...sale,
    /* الحق المتبقي يُلغى: لا يظهر في الذمم ولا يُحصّل — الحالة الصادقة. */
    collectionStatus: "returned_full",
    return: {
      occurredOn: input.occurredOn,
      /* حق الرد = المقبوض فعليًا فقط (لا الإيراد كله) — SDF-053: قبض 5
       * وباقي 10 ← حق رد 5 لا 15. */
      refundDueMinor: sale.collectedMinor,
      operationKey: input.operationKey.trim(),
      recordedAt: input.recordedAt,
      reason: input.reason.trim(),
    },
  });
}

/* S11 (UNIT-026 sale-slice — SDF-054): دفع رد فعلي مؤرخ — لا يتجاوز حق الرد
 * القائم، ولا يُدفع مرتين؛ النقد ينقص بقدره من مصدره الواحد عند القراءة. */
export function payDirectSaleRefund(sale: DirectSale, input: PayDirectSaleRefundInput): DirectSale {
  if ((sale.status ?? "active") === "cancelled") throw new Error("بيع ملغى لا يُردّ منه.");
  if (!sale.return) throw new Error("دفع الرد يخص بيعًا مُرتجعًا كاملًا — سجّل المرتجع أولًا.");
  assertText(input.entryId, "entryId");
  assertText(input.operationKey, "operationKey");
  if (!isValidTimestamp(input.recordedAt)) throw new Error("أدخل وقت الحركة وقتًا صحيحًا.");
  assertLocalDate(input.occurredOn);
  assertPositiveInteger(input.amountMinor, "amountMinor");
  const refundedMinor = (sale.refundedMinor ?? 0) + input.amountMinor;
  if (refundedMinor > sale.return.refundDueMinor)
    throw new Error("دفع الرد يتجاوز حق الرد القائم — لا يُردّ أكثر مما قُبض فعلًا.");
  assertMovementKeyUnused(sale, input.operationKey);
  const entry: DirectSaleRefundPaymentEntry = Object.freeze({
    id: input.entryId.trim(),
    amountMinor: input.amountMinor,
    occurredOn: input.occurredOn,
    operationKey: input.operationKey.trim(),
    recordedAt: input.recordedAt,
    note: input.note?.trim() || null,
    allocationEntryId: input.allocationEntryId?.trim() || null,
  });
  return Object.freeze({
    ...sale,
    refundedMinor,
    refundPayments: [...(sale.refundPayments ?? []), entry],
  });
}

/* S11 (تصحيح المراجعة R2-003): الحالة الصادقة بعد العكس — العكس يتراجع عن
 * القبض لا عن قرار الفرق: بيع مراجعةٍ يبقى في مراجعته (الفرق غير المحسوم
 * لا يصير دينًا مؤكدًا بصمت بفعل العكس)، وما عداه يُشتق من المجموع. */
function collectionStatusAfterReversal(sale: DirectSale, collectedAfter: number): DirectSaleCollectionStatus {
  if (sale.collectionStatus === "partial_needs_review") return "partial_needs_review";
  return collectedAfter >= sale.revenueMinor ? "collected_in_full" : "partial_debt";
}

/* S11 (UNIT-026 sale-slice — تصحيح المراجعة R1): عكس تحصيل مؤرخ موثق —
 * دالة نطاق واحدة تمسك النصفين معًا دائمًا: المجموع المحروس (collectedMinor
 * ينقص) والتفصيل المؤرخ (سطر سالب بهوية ومفتاح) داخل نداء واحد؛ المفتاح
 * نفسه للمراجعة والحركة لأنهما واقعة عكس واحدة، وعهدة المفتاح تمنع أي
 * استخدام لاحق له. لا يعكس بيعًا ملغى أو مُرتجعًا ولا يعكس أكثر من
 * المقبوض الفعلي. */
export function reverseDirectSaleCollection(
  sale: DirectSale,
  input: ReverseDirectSaleCollectionInput,
): DirectSale {
  if ((sale.status ?? "active") === "cancelled")
    throw new Error("بيع مباشر ملغى لا يُعكس تحصيله — استعمل أفعال الإلغاء.");
  if (sale.return) throw new Error("بيع مُرتجع كاملًا لا يُعكس تحصيله — حقه أُلغي بالمرتجع.");
  assertPositiveInteger(input.amountMinor, "amountMinor");
  assertText(input.operationKey, "operationKey");
  if (!isValidTimestamp(input.recordedAt)) throw new Error("أدخل وقت الحركة وقتًا صحيحًا.");
  assertLocalDate(input.occurredOn);
  if (input.amountMinor > sale.collectedMinor)
    throw new Error("عكس التحصيل يتجاوز المقبوض الفعلي على هذا البيع — لا يكون المقبوض سالبًا.");
  assertMovementKeyUnused(sale, input.operationKey);
  const collectedAfter = sale.collectedMinor - input.amountMinor;
  const statusAfter = collectionStatusAfterReversal(sale, collectedAfter);
  /* واقعة العكس تُبنى مباشرة في هذه الدالة الواحدة (لا تمر بـupdateDirectSale
   * كي لا يُكتب سطر تسوية إضافي فوق السطر السالب — الحركة واحدة)؛ المراجعة
   * الموثقة عبر revisionList بحراسها، والمجموع والسطر يسيران معًا هنا حصرًا. */
  const corrected = revisionList(sale, {
    kind: "edit",
    idempotencyKey: input.operationKey,
    createdAt: input.recordedAt,
    reason: input.reason,
  });
  /* السطر السالب المؤرخ بنفس مفتاح الواقعة — المراجعة والحركة واقعة عكس
   * واحدة بعهدة مفتاح واحدة. */
  const entry: DirectSaleCollectionEntry = Object.freeze({
    id: `${sale.id}:reverse:${input.operationKey}`,
    amountMinor: -input.amountMinor,
    occurredOn: input.occurredOn,
    operationKey: input.operationKey,
    recordedAt: input.recordedAt,
    note: input.note?.trim() || null,
    allocationEntryId: input.allocationEntryId?.trim() || null,
  });
  return Object.freeze({
    ...sale,
    collectedMinor: collectedAfter,
    collectionStatus: statusAfter,
    collections: [...(sale.collections ?? []), entry],
    revisions: corrected,
  });
}

/* S11: مفتاح حركة واحد لكل نية — لا يُعاد استخدامه عبر القبض والرد والمراجعات
 * ومفتاح الإنشاء؛ إعادة المحاولة بالنية نفسها تُحسم عند حد الكتابة (إعادة
 * استخدام صادقة أو تعارض حمولة)، أما داخل النطاق فالمفتاح المكرر خطأ مباشر. */
function assertMovementKeyUnused(sale: DirectSale, operationKey: string): void {
  const key = operationKey.trim();
  const usedByMovement =
    sale.idempotencyKey === key ||
    (sale.collections ?? []).some(entry => entry.operationKey === key) ||
    (sale.refundPayments ?? []).some(entry => entry.operationKey === key) ||
    (sale.revisions ?? []).some(revision => revision.idempotencyKey === key) ||
    sale.return?.operationKey === key;
  if (usedByMovement) throw new Error("تم تنفيذ هذه الحركة سابقًا.");
}
