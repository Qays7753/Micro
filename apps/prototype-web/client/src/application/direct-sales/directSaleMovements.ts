/**
 * S11 (UNIT-005/026 sale-slice — أمر b33a8877 §6): حركات البيع المالية —
 * التحصيل المؤرخ والمرتجع الكامل PD-02 ودفع الرد، بمالك المصدر داخل حد
 * كتابة واحد (commitDirectSaleWrite). بيت مستقل يُحمَّل كسولًا بعد الإقلاع
 * (نمط transfers/planning نفسه — بروتوكول FIN-001/OPS-003): المستهلك المباشر
 * صفحة المحرر الكسولة وورقة التحصيل، فلا تدخل حركات البيع كومة الإقلاع
 * وسقف gzip المحروس لا يُرفع.
 */
import {
  applyFullReturn,
  collectDirectSalePayment,
  payDirectSaleRefund,
} from "@micro-domain/direct-sale/index.js";
import { createCashContinuityEntry, type CashContinuityEntry } from "@micro-domain/cash-continuity/index.js";
import type { DirectSale } from "@micro-domain/direct-sale/index.js";
import type { PrototypeLocalStore } from "@/storage/local/types";
import type {
  DirectSaleCollectInput,
  DirectSaleFullReturnServiceInput,
  DirectSaleRefundInput,
  DirectSaleResult,
} from "./directSaleService";
import {
  CONFLICT,
  STORAGE_STALE,
  errorMessageOf,
  notFoundFailure,
  storageFailure,
  validationFailure,
} from "@/application/resultCodes";
import { systemClock, type Clock } from "@/application/time/clock";

/** S11 (تصحيح المراجعة R1 — مبدأ القدرة «ما يحتاجه المستهلك لا أكثر»):
 * عدسة حركات البيع الضيقة بالضبط — قراءة الأصل، والالتزام المحروس الواحد،
 * وفحص المحافظ؛ لا حفظ مباشر ولا عكس ولا دفتر كاش بيد الخدمة. */
export type DirectSaleMovementsStore = Pick<
  PrototypeLocalStore,
  "listDirectSales" | "commitDirectSaleWrite" | "listCashWallets"
>;

/** S11: نتيجة الالتزام الذرّي — البيع وأثر الكاش المكتوب معه (أو المعاد). */
export type DirectSaleCommitOutcome = {
  sale: DirectSale;
  cashEntry: CashContinuityEntry | null;
  reused: boolean;
};

export class DirectSaleMovementsService {
  constructor(
    private readonly store: DirectSaleMovementsStore,
    private readonly now: Clock = systemClock,
  ) {}

  /* S11 (UNIT-026 sale-slice): قراءة الأصل قبل أي حركة. */
  private async loadBase(saleId: string): Promise<DirectSale | null | { readFailed: true }> {
    const current = await this.store.listDirectSales();
    if (!current.ok) return { readFailed: true };
    return current.value.find(sale => sale.id === saleId) ?? null;
  }

  /* S11: فحص الوجهة قبل الحد — محفظة غائبة رفض صادق بلا أي كتابة. */
  private async requireWallet(walletId: string): Promise<{ ok: true } | { ok: false; message: string }> {
    const wallets = await this.store.listCashWallets();
    if (!wallets.ok) return { ok: false, message: "تعذر قراءة المحافظ قبل الحركة." };
    if (!wallets.value.some(wallet => wallet.id === walletId))
      return { ok: false, message: "اختر محفظة موجودة أو اترك المبلغ غير موزع." };
    return { ok: true };
  }

  /* S11: بناء سطر قيمة النقد المرتبط بسطر الحركة القائم — تخصيص القبض
   * (موجب) أو صرف الرد (سالب) بصيغة واحدة. */
  private movementCashEntry(input: {
    direction: 1 | -1;
    entryId: string;
    walletId: string;
    amountMinor: number;
    occurredOn: string;
    recordedAt: string;
    note: string | null | undefined;
    operationKey: string;
    saleId: string;
    spend: boolean;
  }): CashContinuityEntry {
    return createCashContinuityEntry({
      id: input.spend ? `sale-refund-spend:${input.entryId}` : `sale-alloc:${input.entryId}`,
      walletId: input.walletId,
      type: "allocation",
      occurredOn: input.occurredOn,
      recordedAt: input.recordedAt,
      cashDeltaMinor: input.direction * input.amountMinor,
      note: input.note?.trim() || (input.spend ? "صرف رد من المحفظة" : "تحصيل دفعة إلى المحفظة"),
      operationKey: input.spend ? `${input.operationKey}:spend` : `${input.operationKey}:attribute`,
      sourceRefId: input.saleId,
      sourceRefKind: "sale",
      sourceRefLineId: input.entryId,
    });
  }

  /* S11: خريطة نتيجة الالتزام الموحدة — التعارض تعارض والفشل التخزيني فشل. */
  private settleCommit(
    committed: Awaited<ReturnType<DirectSaleMovementsStore["commitDirectSaleWrite"]>>,
  ): DirectSaleResult<DirectSaleCommitOutcome> {
    if (!committed.ok) {
      if (committed.code === STORAGE_STALE) return { ok: false, code: CONFLICT, message: committed.message };
      return storageFailure(committed.message || "تعذر حفظ الحركة محليًا؛ لم يتغير شيء.");
    }
    return { ok: true, value: committed.value };
  }

  /* S11 (UNIT-026 sale-slice — أمر b33a8877 §6): تحصيل دفعة على بيع آجل حي
   * مؤكد المتبقي — الكاتب مالك المصدر داخل حد كتابة واحد: فحص النسخة
   * والمتبقي الحيين عند المخزن، وسطر قبض مؤرخ بهوية ومفتاح، وتخصيص المحفظة
   * المختار يرتبط بسطر القبض نفسه؛ التحصيل يزيد الكاش مرة وينقص الحق مرة
   * ولا يخلق إيرادًا ولا ربحًا. */
  async collectPayment(
    saleId: string,
    input: DirectSaleCollectInput,
  ): Promise<DirectSaleResult<DirectSaleCommitOutcome>> {
    const base = await this.loadBase(saleId);
    if (base === null) return notFoundFailure("بيع مباشر غير موجود؛ لم يتغير شيء.");
    if ("readFailed" in base) return storageFailure("تعذر قراءة سجل البيع؛ لم يتغير شيء.");
    if (input.walletId) {
      const walletCheck = await this.requireWallet(input.walletId);
      if (!walletCheck.ok) return validationFailure(walletCheck.message);
    }
    const timestamp = this.now();
    const entryId = `${base.id}:col:${input.operationKey}`;
    /* إعادة نية التحصيل نفسها: القبضة نفّذت فعلًا — نية الإعادة تصل حد
     * الكتابة كاملة (الحمولة الجديدة في سطر الظل) فيقرر الحارس الموحد:
     * حمولة مطابقة = إعادة استخدام صادقة للمحفوظ وأثر الكاش المطابق؛
     * حمولة مختلفة بالمفتاح نفسه = تعارض صادق بلا كتابة ولا عودة صامتة
     * لسجل قديم (تصحيح المراجعة R3-001 — SDF-037/038). */
    const existingMovement = (base.collections ?? []).some(
      entry => entry.operationKey === input.operationKey,
    );
    let cashEntry: CashContinuityEntry | null = null;
    if (input.walletId)
      cashEntry = this.movementCashEntry({
        direction: 1,
        entryId,
        walletId: input.walletId,
        amountMinor: input.amountMinor,
        occurredOn: input.occurredOn,
        recordedAt: timestamp,
        note: input.note,
        operationKey: input.operationKey,
        saleId: base.id,
        spend: false,
      });
    if (existingMovement) {
      /* سطر الظل يحل محل السطر القائم في نسخة النية (لا يُكتب أبدًا في
       * مسار إعادة الاستخدام) فترى مقارنة الحارس الحمولة الجديدة فعلًا. */
      const retryShadow: DirectSale = {
        ...base,
        collections: (base.collections ?? []).map(entry =>
          entry.operationKey === input.operationKey
            ? {
                ...entry,
                amountMinor: input.amountMinor,
                occurredOn: input.occurredOn,
                note: input.note?.trim() || null,
              }
            : entry,
        ),
      };
      return this.settleCommit(
        await this.store.commitDirectSaleWrite(base, retryShadow, [input.operationKey], cashEntry),
      );
    }
    let next: DirectSale;
    try {
      next = collectDirectSalePayment(base, {
        entryId,
        amountMinor: input.amountMinor,
        occurredOn: input.occurredOn,
        operationKey: input.operationKey,
        recordedAt: timestamp,
        note: input.note ?? null,
      });
    } catch (error) {
      return validationFailure(errorMessageOf(error, "بيانات الحركة غير صالحة."));
    }
    if (cashEntry)
      next = {
        ...next,
        collections: (next.collections ?? []).map(candidate =>
          candidate.id === entryId ? { ...candidate, allocationEntryId: cashEntry!.id } : candidate,
        ),
      };
    return this.settleCommit(
      await this.store.commitDirectSaleWrite(base, next, [input.operationKey], cashEntry),
    );
  }

  /* S11 (UNIT-005/PD-02): إثبات المرتجع الكامل داخل حد واحد — يلغي الحق
   * المتبقي ويثبت رد المقبوض فعليًا فقط؛ لا نقص نقد ولا عكس تكلفة. */
  async fullReturn(
    saleId: string,
    input: DirectSaleFullReturnServiceInput,
  ): Promise<DirectSaleResult<DirectSaleCommitOutcome>> {
    const base = await this.loadBase(saleId);
    if (base === null) return notFoundFailure("بيع مباشر غير موجود؛ لم يتغير شيء.");
    if ("readFailed" in base) return storageFailure("تعذر قراءة سجل البيع؛ لم يتغير شيء.");
    /* إعادة نية المرتجع نفسها: نفّذ فعلًا — النية تصل الحد كاملة (تاريخ وسبب
     * المراجعة في ظل المرتجع) فيقرر الحارس: مطابقة = إعادة استخدام صادقة؛
     * اختلاف التاريخ أو السبب = تعارض صادق بلا كتابة (تصحيح R3-001). */
    if (base.return?.operationKey === input.operationKey) {
      const retryShadow: DirectSale = {
        ...base,
        return: {
          occurredOn: input.occurredOn,
          refundDueMinor: base.return.refundDueMinor,
          operationKey: input.operationKey,
          recordedAt: base.return.recordedAt,
          reason: input.reason.trim(),
        },
      };
      return this.settleCommit(
        await this.store.commitDirectSaleWrite(base, retryShadow, [input.operationKey], null),
      );
    }
    let next: DirectSale;
    try {
      next = applyFullReturn(base, {
        occurredOn: input.occurredOn,
        operationKey: input.operationKey,
        recordedAt: this.now(),
        reason: input.reason,
      });
    } catch (error) {
      return validationFailure(errorMessageOf(error, "بيانات الحركة غير صالحة."));
    }
    return this.settleCommit(await this.store.commitDirectSaleWrite(base, next, [input.operationKey], null));
  }

  /* S11 (UNIT-026 sale-slice / SDF-054): دفع رد فعلي مؤرخ داخل حد واحد —
   * لا يتجاوز حق الرد القائم ولا يُدفع مرتين؛ الصرف من محفظة مختارة حركة
   * سالبة مرتبطة بسطر الدفع نفسه، ومن غير الموزع يخصم من مصدره الواحد. */
  async payRefund(
    saleId: string,
    input: DirectSaleRefundInput,
  ): Promise<DirectSaleResult<DirectSaleCommitOutcome>> {
    const base = await this.loadBase(saleId);
    if (base === null) return notFoundFailure("بيع مباشر غير موجود؛ لم يتغير شيء.");
    if ("readFailed" in base) return storageFailure("تعذر قراءة سجل البيع؛ لم يتغير شيء.");
    if (input.walletId) {
      const walletCheck = await this.requireWallet(input.walletId);
      if (!walletCheck.ok) return validationFailure(walletCheck.message);
    }
    const timestamp = this.now();
    const entryId = `${base.id}:refund:${input.operationKey}`;
    /* إعادة نية الدفع نفسها: نفّذ فعلًا — النية تصل الحد كاملة (الحمولة
     * الجديدة في سطر الظل) فيقرر الحارس الموحد (تصحيح R3-001). */
    const existingMovement = (base.refundPayments ?? []).some(
      entry => entry.operationKey === input.operationKey,
    );
    let cashEntry: CashContinuityEntry | null = null;
    if (input.walletId)
      cashEntry = this.movementCashEntry({
        direction: -1,
        entryId,
        walletId: input.walletId,
        amountMinor: input.amountMinor,
        occurredOn: input.occurredOn,
        recordedAt: timestamp,
        note: input.note,
        operationKey: input.operationKey,
        saleId: base.id,
        spend: true,
      });
    if (existingMovement) {
      /* سطر الظل يحل محل السطر القائم في نسخة النية (لا يُكتب أبدًا في
       * مسار إعادة الاستخدام) فترى مقارنة الحارس الحمولة الجديدة فعلًا. */
      const retryShadow: DirectSale = {
        ...base,
        refundPayments: (base.refundPayments ?? []).map(entry =>
          entry.operationKey === input.operationKey
            ? {
                ...entry,
                amountMinor: input.amountMinor,
                occurredOn: input.occurredOn,
                note: input.note?.trim() || null,
              }
            : entry,
        ),
      };
      return this.settleCommit(
        await this.store.commitDirectSaleWrite(base, retryShadow, [input.operationKey], cashEntry),
      );
    }
    let next: DirectSale;
    try {
      next = payDirectSaleRefund(base, {
        entryId,
        amountMinor: input.amountMinor,
        occurredOn: input.occurredOn,
        operationKey: input.operationKey,
        recordedAt: timestamp,
        note: input.note ?? null,
      });
    } catch (error) {
      return validationFailure(errorMessageOf(error, "بيانات الحركة غير صالحة."));
    }
    if (cashEntry)
      next = {
        ...next,
        refundPayments: (next.refundPayments ?? []).map(candidate =>
          candidate.id === entryId ? { ...candidate, allocationEntryId: cashEntry!.id } : candidate,
        ),
      };
    return this.settleCommit(
      await this.store.commitDirectSaleWrite(base, next, [input.operationKey], cashEntry),
    );
  }
}
