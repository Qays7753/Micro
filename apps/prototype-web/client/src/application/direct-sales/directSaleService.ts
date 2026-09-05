/** Application boundary for direct sales. Order collections never enter this service. */
import {
  applyPriceCut,
  cancelDirectSale,
  createDirectSale,
  updateDirectSale,
  type DirectSale,
  type DirectSaleCollectionStatus,
  type UpdateDirectSaleInput,
} from "@micro-domain/direct-sale/index.js";
import { createCashContinuityEntry } from "@micro-domain/cash-continuity/index.js";
import { localDateInAmman } from "@/presentation/formatters";
import type { PrototypeLocalStore } from "@/storage/local/types";

export type DirectSaleRecordInput = {
  itemName: string;
  quantity: number;
  revenueMinor: number;
  /* X-06 (و٤): المقبوض الآن — غيابه يعني قبضًا كاملًا (سلوك السجلات القديمة). */
  collectedMinor?: number;
  collectionStatus?: DirectSaleCollectionStatus;
  /** ربط مرجع اختياري (القيد التاسع — R-1). */
  catalogItemId?: string | null;
  /* D-001: زبون البيع الآجل كبيانات مستقلة — لا اسم مدفون في الملاحظة. */
  customerName?: string | null;
  costMinor: number | null;
  occurredOn: string;
  note: string;
  idempotencyKey: string;
  /** عند اختيار «خفّضتُ السعر»: يسجّل تخفيضًا موثّقًا يحط السعر إلى المقبوض ويحفظ الأصل. */
  priceCut?: boolean;
};
export type DirectSaleUpdateInput = UpdateDirectSaleInput & {
  idempotencyKey: string;
  /* و٦ (§٥-٩): عدد المراجعات الذي رآه المحرر عند الفتح — إن تقدّم السجل فالتعديل
   * من نافذة أخرى أحدث، ولا يُطمس بصمت. */
  expectedRevisionCount?: number;
};

export type DirectSaleResult<T> =
  | { ok: true; value: T; reused?: boolean; allocationReversalNotice?: string }
  | {
      ok: false;
      code: "validation_error" | "storage_error" | "not_found" | "conflict";
      message: string;
    };

const createId = () =>
  globalThis.crypto?.randomUUID?.() ?? `direct-sale-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const CONFLICT_MESSAGE =
  "هذا البيع عُدّل من نافذة أخرى بعد فتحك له؛ لم يُحفظ تعديلك. راجع ثم أعد الحفظ.";

export class DirectSaleService {
  constructor(
    private readonly store: PrototypeLocalStore,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async list(): Promise<DirectSaleResult<readonly DirectSale[]>> {
    const result = await this.store.listDirectSales();
    return result.ok
      ? { ok: true, value: result.value }
      : { ok: false, code: "storage_error", message: "تعذر قراءة المبيعات المباشرة المحلية." };
  }

  async get(id: string): Promise<DirectSaleResult<DirectSale | null>> {
    const result = await this.store.listDirectSales();
    if (!result.ok)
      return { ok: false, code: "storage_error", message: "تعذر قراءة المبيعات المباشرة المحلية." };
    return { ok: true, value: result.value.find(sale => sale.id === id) ?? null };
  }

  async record(input: DirectSaleRecordInput): Promise<DirectSaleResult<DirectSale>> {
    const existing = await this.store.listDirectSales();
    if (!existing.ok)
      return { ok: false, code: "storage_error", message: "تعذر قراءة سجل المبيعات قبل الحفظ." };
    const reused = existing.value.find(sale => sale.idempotencyKey === input.idempotencyKey);
    if (reused) return { ok: true, value: reused, reused: true };

    let sale: DirectSale;
    try {
      sale = createDirectSale({
        id: createId(),
        /* معيار القبول §٥.٣: الحقل الإلزامي الوحيد هو المبلغ — الاسم الفارغ يأخذ اسمًا
         * عامًا صادقًا بدل رفض الحفظ، والسجل يبقى موسومًا بلا وصف صريح. */
        itemName: input.itemName.trim() || "بيع نقدي",
        quantity: input.quantity,
        revenueMinor: input.revenueMinor,
        collectedMinor: input.collectedMinor,
        collectionStatus: input.collectionStatus,
        catalogItemId: input.catalogItemId ?? null,
        customerName: input.customerName ?? null,
        costMinor: input.costMinor,
        occurredOn: input.occurredOn,
        recordedAt: this.now(),
        note: input.note,
        idempotencyKey: input.idempotencyKey,
      });
      /* X-06 (و٤): «خفّضتُ السعر» — تخفيض موثّق لحظة التسجيل: السعر يصير المقبوض،
       * ولا دين ولا تتبّع، والأصل يبقى في السجل. */
      if (input.priceCut)
        sale = applyPriceCut(sale, {
          idempotencyKey: `${input.idempotencyKey}:cut`,
          createdAt: this.now(),
          reason: "خفّضتُ السعر — السعر صار ما قُبض فعلًا",
        });
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "بيانات البيع المباشر غير صالحة.",
      };
    }

    const saved = await this.store.saveDirectSale(sale);
    return saved.ok
      ? { ok: true, value: saved.value }
      : {
          ok: false,
          code: "storage_error",
          message: "تعذر حفظ البيع المباشر محليًا. بقيت بيانات النموذج أمامك؛ أعد المحاولة.",
        };
  }

  async update(id: string, input: DirectSaleUpdateInput): Promise<DirectSaleResult<DirectSale>> {
    const existing = await this.store.listDirectSales();
    if (!existing.ok)
      return { ok: false, code: "storage_error", message: "تعذر قراءة سجل البيع قبل التصحيح." };
    const source = existing.value.find(sale => sale.id === id);
    if (!source) return { ok: false, code: "not_found", message: "بيع مباشر غير موجود؛ لم يتغير شيء." };
    /* و٦: لا طمس صامت لتعديل أحدث — المراجعات تتقدم مع كل تصحيح أو إلغاء. */
    if (
      input.expectedRevisionCount !== undefined &&
      input.expectedRevisionCount !== (source.revisions?.length ?? 0)
    )
      return { ok: false, code: "conflict", message: CONFLICT_MESSAGE };
    const repeated = source.revisions?.find(revision => revision.idempotencyKey === input.idempotencyKey);
    if (repeated) return { ok: true, value: source, reused: true };
    if (
      existing.value.some(
        sale =>
          sale.idempotencyKey === input.idempotencyKey ||
          sale.revisions?.some(revision => revision.idempotencyKey === input.idempotencyKey),
      )
    )
      return { ok: false, code: "validation_error", message: "مفتاح التصحيح مستخدم مسبقًا؛ لم يتغير شيء." };
    let corrected: DirectSale;
    try {
      corrected = updateDirectSale(source, input, {
        kind: "edit",
        idempotencyKey: input.idempotencyKey,
        createdAt: this.now(),
        reason: "تصحيح بيانات البيع المباشر",
      });
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "بيانات تصحيح البيع المباشر غير صالحة.",
      };
    }
    const saved = await this.store.saveDirectSale(corrected);
    return saved.ok
      ? { ok: true, value: saved.value }
      : { ok: false, code: "storage_error", message: "تعذر حفظ تصحيح البيع المباشر محليًا؛ لم يتغير الأصل." };
  }

  async cancel(
    id: string,
    reason: string,
    idempotencyKey: string,
    expectedRevisionCount?: number,
  ): Promise<DirectSaleResult<DirectSale>> {
    const existing = await this.store.listDirectSales();
    if (!existing.ok)
      return { ok: false, code: "storage_error", message: "تعذر قراءة سجل البيع قبل الإلغاء." };
    const source = existing.value.find(sale => sale.id === id);
    if (!source) return { ok: false, code: "not_found", message: "بيع مباشر غير موجود؛ لم يتغير شيء." };
    /* و٦: الإلغاء من نافذة متأخرة لا يطمس تعديلًا أحدث وصل قبله. */
    if (
      expectedRevisionCount !== undefined &&
      expectedRevisionCount !== (source.revisions?.length ?? 0)
    )
      return { ok: false, code: "conflict", message: CONFLICT_MESSAGE };
    const repeated = source.revisions?.find(revision => revision.idempotencyKey === idempotencyKey);
    if (repeated) return { ok: true, value: source, reused: true };
    if (
      existing.value.some(
        sale =>
          sale.idempotencyKey === idempotencyKey ||
          sale.revisions?.some(revision => revision.idempotencyKey === idempotencyKey),
      )
    )
      return { ok: false, code: "validation_error", message: "مفتاح التصحيح مستخدم مسبقًا؛ لم يتغير شيء." };
    let cancelled: DirectSale;
    try {
      cancelled = cancelDirectSale(source, {
        kind: "cancel",
        idempotencyKey,
        createdAt: this.now(),
        reason,
      });
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "بيانات إلغاء البيع المباشر غير صالحة.",
      };
    }
    const saved = await this.store.saveDirectSale(cancelled);
    if (!saved.ok)
      return {
        ok: false,
        code: "storage_error",
        message: "تعذر حفظ إلغاء البيع المباشر محليًا؛ بقي الأصل دون تغيير.",
      };
    /* المجموعة ٦ (تدقيق A1 — FT-02): الإلغاء ينقض القبض — تخصيصات المحفظة
     * المرتبطة بهذا البيع (sourceRefKind=sale) تُعكس مرآةً في معاملة كاش واحدة
     * ذات مفتاح حتمي (معرّف العكس مشتق من معرّف التخصيص نفسه) فبقاء محفظة
     * «تُظهر» مبلغًا لبيعٍ ملغى يستحيل، والقيمة تعود إلى «غير الموزع» حيث
     * مصيرها قرار المالك (ردّ فعلي أو ضبط). فشل هذه الكتابة لا يُفقد مالًا:
     * النتيجة أثر صادق في غير الموزع يظهر لفحص MIC-14 — نبلغه في الرسالة. */
    const mirror = await this.reverseAllocationsForCancelledSale(cancelled, reason);
    if (!mirror.ok) return { ok: true, value: saved.value, allocationReversalNotice: mirror.message };
    return { ok: true, value: saved.value };
  }

  private async reverseAllocationsForCancelledSale(
    sale: DirectSale,
    reason: string,
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    const entriesResult = await this.store.listCashContinuityEntries();
    if (!entriesResult.ok)
      return { ok: false, message: "تعذر قراءة تخصيصات المحفظة لهذا البيع — راجع غير الموزع يدويًا." };
    const entries = entriesResult.value;
    const alreadyReversedIds = new Set(
      entries
        .filter(entry => entry.type === "reversal" && entry.reversesEntryId)
        .map(entry => entry.reversesEntryId as string),
    );
    const targets = entries.filter(
      entry =>
        entry.type === "allocation" &&
        entry.sourceRefId === sale.id &&
        (entry.sourceRefKind ?? null) === "sale" &&
        !alreadyReversedIds.has(entry.id) &&
        entry.cashDeltaMinor !== 0,
    );
    if (targets.length === 0) return { ok: true };
    try {
      const reversals = targets.map(entry =>
        createCashContinuityEntry({
          id: `sale-cancel:${entry.id}`,
          walletId: entry.walletId,
          type: "reversal",
          occurredOn: localDateInAmman(this.now()),
          recordedAt: this.now(),
          cashDeltaMinor: -entry.cashDeltaMinor,
          note: `إلغاء بيع مباشر — عكس تخصيص: ${entry.note}`,
          reason: reason.trim() || "إلغاء بيع مباشر",
          operationKey: `sale-cancel:${sale.id}:${entry.id}`,
          transferId: null,
          reversesEntryId: entry.id,
        }),
      );
      const saved = await this.store.commitCashContinuity(null, reversals);
      if (!saved.ok)
        return { ok: false, message: "تعذر عكس تخصيصات المحفظة بعد الإلغاء — راجع غير الموزع يدويًا." };
      return { ok: true };
    } catch {
      return { ok: false, message: "تعذر عكس تخصيصات المحفظة بعد الإلغاء — راجع غير الموزع يدويًا." };
    }
  }
}