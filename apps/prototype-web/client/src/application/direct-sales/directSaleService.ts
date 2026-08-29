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
  costMinor: number | null;
  occurredOn: string;
  note: string;
  idempotencyKey: string;
  /** عند اختيار «خفّضتُ السعر»: يسجّل تخفيضًا موثّقًا يحط السعر إلى المقبوض ويحفظ الأصل. */
  priceCut?: boolean;
};
export type DirectSaleUpdateInput = UpdateDirectSaleInput & { idempotencyKey: string };

export type DirectSaleResult<T> =
  | { ok: true; value: T; reused?: boolean }
  | { ok: false; code: "validation_error" | "storage_error" | "not_found"; message: string };

const createId = () =>
  globalThis.crypto?.randomUUID?.() ?? `direct-sale-${Date.now()}-${Math.random().toString(36).slice(2)}`;

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

  async cancel(id: string, reason: string, idempotencyKey: string): Promise<DirectSaleResult<DirectSale>> {
    const existing = await this.store.listDirectSales();
    if (!existing.ok)
      return { ok: false, code: "storage_error", message: "تعذر قراءة سجل البيع قبل الإلغاء." };
    const source = existing.value.find(sale => sale.id === id);
    if (!source) return { ok: false, code: "not_found", message: "بيع مباشر غير موجود؛ لم يتغير شيء." };
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
    return saved.ok
      ? { ok: true, value: saved.value }
      : { ok: false, code: "storage_error", message: "تعذر حفظ إلغاء البيع المباشر محليًا؛ بقي الأصل دون تغيير." };
  }
}