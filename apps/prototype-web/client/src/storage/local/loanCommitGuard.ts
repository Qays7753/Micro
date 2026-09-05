import type { LoanRecord } from "@micro-domain/loan/index.js";
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";

/* المجموعة ٦ (AV-02 — تزامن تسديد القروض): الكتابة العمياء للسجل (آخر كاتب
 * يفوز) تسمح لدفعتين متزامنتين بتخزين حدثين ماليين بينما يحمل سجل القرض دفعة
 * واحدة فقط — انفصام دائم بين السجل والأحداث. هذا الحارس النقي يُستدعى داخل
 * معاملة الكتابة نفسها: العلاقة بين السجل المخزّن والسجل الوارد يجب أن تطابق
 * عملية مجال واحدة (إنشاء، أو إضافة دفعة واحدة، أو تراجع عن دفعة واحدة).
 * أي علاقة أخرى تعني أن مسارًا آخر كتب بين قراءة المستخدم وكتابته —
 * يُرفض الالتزام ويبقى السجل متسقًا. */

const STALE_CONFLICT_MESSAGE = "سجل القرض تغيّر من مسار آخر بعد فتحك له — لم يُسجَّل شيء؛ أعد المحاولة.";

export type LoanCommitGuardResult = { ok: true } | { ok: false; message: string };

export function validateLoanCommitRelation(
  stored: LoanRecord | undefined,
  record: LoanRecord,
  event: FinancialEvent,
): LoanCommitGuardResult {
  if (stored === undefined) {
    /* لا سجل قائم: إنشاء جديد فقط يُقبل — دفعة أو تراجع على قرض غير موجود
     * هو انفصام، لا يُبعث السجل من مسار دفعة. */
    if (event.type === "loan_outgoing_cash" && !event.correctionType) return { ok: true };
    return { ok: false, message: "القرض لم يعد موجودًا محليًا؛ لم يُسجَّل شيء." };
  }
  const storedRepaymentIds = new Set(stored.repayments.map(repayment => repayment.id));
  if (event.type === "loan_repayment_cash" && !event.correctionType) {
    /* إضافة دفعة واحدة بالضبط: الطول يزيد بواحد والدفعة المضافة تحمل
     * حدث هذه الكتابة نفسه — دفعة متزامنة سبقتنا تكسر العلاقة فتُرفض. */
    const added = record.repayments.filter(repayment => !storedRepaymentIds.has(repayment.id));
    const valid =
      record.repayments.length === stored.repayments.length + 1 &&
      added.length === 1 &&
      added[0]!.eventId === event.id;
    return valid ? { ok: true } : { ok: false, message: STALE_CONFLICT_MESSAGE };
  }
  if (event.correctionType === "reverse") {
    /* تراجع موثق عن دفعة واحدة بالضبط: القيد يبقى ويُعلَّم بتراجعٍ يشير إلى
     * حدث هذه الكتابة نفسه — علامة ثانية أو مسار متزامن يكسر العلاقة. */
    const storedById = new Map(stored.repayments.map(repayment => [repayment.id, repayment]));
    const newlyReversed = record.repayments.filter(
      repayment =>
        repayment.reversal !== null &&
        repayment.reversal.reversalEventId === event.id &&
        (storedById.get(repayment.id)?.reversal ?? null) === null,
    );
    const valid =
      record.repayments.length === stored.repayments.length &&
      newlyReversed.length === 1 &&
      record.repayments.every(repayment => storedRepaymentIds.has(repayment.id));
    return valid ? { ok: true } : { ok: false, message: STALE_CONFLICT_MESSAGE };
  }
  /* أنواع أخرى (إعادة إنشاء بمفتاح جديد مثلًا) — مفتاح الحتمية للحارس
   * الأساسي يلتقطها قبل الوصول هنا؛ الوصول هنا مع سجل قائم غير متوقع. */
  return { ok: false, message: STALE_CONFLICT_MESSAGE };
}

/** عهدة مفتاح الحدث: إعادة تشغيل بنفس مفتاح الحتمية (تراجع مُعاد بعد نجاح)
 *  تعاد كما هي — لا حدث ثانٍ بنفس المفتاح. */
export function findLoanEventByKey(
  events: readonly FinancialEvent[],
  idempotencyKey: string,
  excludeId: string,
): FinancialEvent | undefined {
  return events.find(candidate => candidate.id !== excludeId && candidate.idempotencyKey === idempotencyKey);
}
