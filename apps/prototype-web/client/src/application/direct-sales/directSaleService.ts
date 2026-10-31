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
import { createCashContinuityEntry, type CashContinuityEntry } from "@micro-domain/cash-continuity/index.js";
import { localDateInAmman } from "@micro-domain/shared/index.js";
import type { PrototypeLocalStore } from "@/storage/local/types";
import type { DirectSaleStore } from "@/storage/local/capabilities/directSaleStore";

/** R3 (R3-SC-04): عدسة الخدمة — قدرة البيع المباشر حصرًا مع قناة السيولة
 * النقدية المستخدمة بالضبط (عائلة KEEP R3-SC-19).
 * S11 (UNIT-026 sale-slice): التزام الكتابة المحروس (commitDirectSaleWrite)
 * يكتب البيع وسطر قيمة النقد معًا، وقائمة المحافظ تفحص الوجهة قبل الحد. */
export type DirectSaleServiceStore = DirectSaleStore &
  Pick<PrototypeLocalStore, "listCashContinuityEntries" | "commitCashContinuity" | "listCashWallets">;
import {
  CONFLICT,
  NOT_FOUND,
  STORAGE_ERROR,
  STORAGE_STALE,
  VALIDATION_ERROR,
  errorMessageOf,
  notFoundFailure,
  storageFailure,
  validationFailure,
} from "@/application/resultCodes";
import { systemClock, type Clock } from "@/application/time/clock";

export type DirectSaleRecordInput = {
  itemName: string;
  quantity: number;
  revenueMinor: number;
  /* X-06 (و٤) + F-013 (W2-A): المقبوض الآن عند التسجيل — غيابه عقدُ البيع النقدي
   * السريع: يُحل هنا مرة واحدة صراحةً، والمجال لا يفترض القبض الكامل أبدًا. */
  collectedMinor?: number;
  collectionStatus?: DirectSaleCollectionStatus;
  /** ربط مرجع اختياري (القيد التاسع — R-1). */
  catalogItemId?: string | null;
  /* D-001: زبون البيع الآجل كبيانات مستقلة — لا اسم مدفون في الملاحظة. */
  customerName?: string | null;
  /* S05 (DOC-014 / UNIT-037): ربط طرف محفوظ صريح إن اختير — لقطة الاسم
   * تبقى customerName كما سُجلت وقت الحفظ. */
  customerPartyId?: string | null;
  costMinor: number | null;
  occurredOn: string;
  note: string;
  idempotencyKey: string;
  /** عند اختيار «خفّضتُ السعر»: يسجّل تخفيضًا موثّقًا يحط السعر إلى المقبوض ويحفظ الأصل. */
  priceCut?: boolean;
  /* S11 (UNIT-005 §6 — الذرية): وجهة القبض الابتدائي المختارة — التخصيص
   * يُكتب مع البيع في حد واحد أو لا شيء؛ الغياب = غير موزع صريح. */
  wallet?: { walletId: string; note?: string | null } | null;
};
export type DirectSaleUpdateInput = UpdateDirectSaleInput & {
  idempotencyKey: string;
  /* و٦ (§٥-٩): عدد المراجعات الذي رآه المحرر عند الفتح — إن تقدّم السجل فالتعديل
   * من نافذة أخرى أحدث، ولا يُطمس بصمت. */
  expectedRevisionCount?: number;
  /* عقد الإغلاق العميق (FC-09 — العقد ٤): سبب المراجعة يفرّق التحصيل عن
   * التصحيح في سجل التسويات — «تحصيل دفعة» ليس «تصحيح بيانات». */
  revisionReason?: string;
};

/** S11 (UNIT-026 sale-slice): تحصيل دفعة على بيع آجل حي — الكاتب مالك المصدر. */
export type DirectSaleCollectInput = {
  amountMinor: number;
  occurredOn: string;
  operationKey: string;
  note?: string | null;
  /** وجهة الكاش: محفظة محددة أو «غير موزع» صريح (null). */
  walletId?: string | null;
};

/** S11 (UNIT-005/PD-02): إثبات المرتجع الكامل المؤهل. */
export type DirectSaleFullReturnServiceInput = {
  occurredOn: string;
  reason: string;
  operationKey: string;
};

/** S11 (UNIT-026 sale-slice / SDF-054): دفع رد فعلي مؤرخ. */
export type DirectSaleRefundInput = {
  amountMinor: number;
  occurredOn: string;
  operationKey: string;
  note?: string | null;
  /** المحفظة التي خرج منها الرد — الغياب = من غير الموزع. */
  walletId?: string | null;
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

const CONFLICT_MESSAGE = "هذا البيع عُدّل من نافذة أخرى بعد فتحك له؛ لم يُحفظ تعديلك. راجع ثم أعد الحفظ.";

export class DirectSaleService {
  constructor(
    private readonly store: DirectSaleServiceStore,
    private readonly now: Clock = systemClock,
  ) {}

  async list(): Promise<DirectSaleResult<readonly DirectSale[]>> {
    const result = await this.store.listDirectSales();
    return result.ok
      ? { ok: true, value: result.value }
      : storageFailure("تعذر قراءة المبيعات المباشرة المحلية.");
  }

  async get(id: string): Promise<DirectSaleResult<DirectSale | null>> {
    const result = await this.store.listDirectSales();
    if (!result.ok) return storageFailure("تعذر قراءة المبيعات المباشرة المحلية.");
    return { ok: true, value: result.value.find(sale => sale.id === id) ?? null };
  }

  /* S11 (UNIT-026 sale-slice): فحص الوجهة قبل الحد — محفظة غائبة رفض صادق
   * بلا أي كتابة (البيع وتخصيصه ينجحان معًا أو لا شيء). */
  private async requireWallet(walletId: string): Promise<{ ok: true } | { ok: false; message: string }> {
    const wallets = await this.store.listCashWallets();
    if (!wallets.ok) return { ok: false, message: "تعذر قراءة المحافظ قبل حفظ البيع." };
    if (!wallets.value.some(wallet => wallet.id === walletId))
      return { ok: false, message: "اختر محفظة موجودة لقبض البيع — أو اتركه غير موزع." };
    return { ok: true };
  }

  async record(input: DirectSaleRecordInput): Promise<DirectSaleResult<DirectSale>> {
    if (input.wallet) {
      const walletCheck = await this.requireWallet(input.wallet.walletId);
      if (!walletCheck.ok) return validationFailure(walletCheck.message);
    }
    let sale: DirectSale;
    try {
      sale = createDirectSale({
        id: createId(),
        /* معيار القبول §٥.٣: الحقل الإلزامي الوحيد هو المبلغ — الاسم الفارغ يأخذ اسمًا
         * عامًا صادقًا بدل رفض الحفظ، والسجل يبقى موسومًا بلا وصف صريح. */
        itemName: input.itemName.trim() || "بيع نقدي",
        quantity: input.quantity,
        revenueMinor: input.revenueMinor,
        /* F-013 (W2-A): الحل الوحيد المسموح — «بيع نقدي فوري = قُبض كاملًا الآن» عقدُ
         * مسار البيع السريع، يُصرَّح هنا عند حد التطبيق لا داخل المجال. */
        collectedMinor: input.collectedMinor ?? input.revenueMinor,
        collectionStatus: input.collectionStatus,
        catalogItemId: input.catalogItemId ?? null,
        customerName: input.customerName ?? null,
        /* S05 (DOC-014 / UNIT-037): الرابط الصريح للمحفوظ المختار. */
        customerPartyId: input.customerPartyId ?? null,
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
      return validationFailure(errorMessageOf(error, "بيانات البيع المباشر غير صالحة."));
    }

    /* S11 (UNIT-005 §6 — الذرية): البيع والقبض الابتدائي والحق المشتق وتخصيص
     * المحفظة المختار والتزام واحد — كلها داخل حد كتابة واحد أو لا شيء؛
     * تخصيص المحفظة يرتبط بسطر القبض الابتدائي القائم لا بقبض آخر. */
    let cashEntry: CashContinuityEntry | null = null;
    const initialEntry = sale.collections?.[0] ?? null;
    if (input.wallet && sale.collectedMinor > 0 && initialEntry) {
      try {
        cashEntry = createCashContinuityEntry({
          id: `sale-alloc:${initialEntry.id}`,
          walletId: input.wallet.walletId,
          type: "allocation",
          occurredOn: sale.occurredOn,
          recordedAt: this.now(),
          cashDeltaMinor: sale.collectedMinor,
          note: input.wallet.note?.trim() || "توزيع قبض البيع إلى المحفظة",
          operationKey: `${sale.idempotencyKey}:attribute`,
          sourceRefId: sale.id,
          sourceRefKind: "sale",
          sourceRefLineId: initialEntry.id,
        });
        sale = {
          ...sale,
          collections: [{ ...initialEntry, allocationEntryId: cashEntry.id }],
        };
      } catch (error) {
        return validationFailure(errorMessageOf(error, "بيانات تخصيص القبض غير صالحة."));
      }
    }

    const committed = await this.store.commitDirectSaleWrite(null, sale, [sale.idempotencyKey], cashEntry);
    if (!committed.ok) {
      if (committed.code === STORAGE_STALE) return { ok: false, code: CONFLICT, message: committed.message };
      return storageFailure(
        committed.message || "تعذر حفظ البيع المباشر محليًا. بقيت بيانات النموذج أمامك؛ أعد المحاولة.",
      );
    }
    return committed.value.reused
      ? { ok: true, value: committed.value.sale, reused: true }
      : { ok: true, value: committed.value.sale };
  }

  async update(id: string, input: DirectSaleUpdateInput): Promise<DirectSaleResult<DirectSale>> {
    const existing = await this.store.listDirectSales();
    if (!existing.ok) return storageFailure("تعذر قراءة سجل البيع قبل التصحيح.");
    const source = existing.value.find(sale => sale.id === id);
    if (!source) return notFoundFailure("بيع مباشر غير موجود؛ لم يتغير شيء.");
    /* و٦: لا طمس صامت لتعديل أحدث — المراجعات تتقدم مع كل تصحيح أو إلغاء،
     * ويعاد فحصها حيًّا داخل حد الكتابة (commitDirectSaleWrite). */
    if (
      input.expectedRevisionCount !== undefined &&
      input.expectedRevisionCount !== (source.revisions?.length ?? 0)
    )
      return { ok: false, code: CONFLICT, message: CONFLICT_MESSAGE };
    /* مفتاح التصحيح ملك للبيع واحد — استخدامه على بيع آخر رفض صادق. */
    if (
      existing.value.some(
        sale =>
          sale.id !== id &&
          (sale.idempotencyKey === input.idempotencyKey ||
            sale.revisions?.some(revision => revision.idempotencyKey === input.idempotencyKey)),
      )
    )
      return validationFailure("مفتاح التصحيح مستخدم مسبقًا؛ لم يتغير شيء.");
    /* إعادة نية التصحيح نفسها: المراجعة نفّذت فعلًا — عودة صادقة قبل بناء
     * السجل (دالة النطاق ترفض المفتاح المكرر) وبلا أي كتابة ثانية. */
    const repeated = source.revisions?.find(revision => revision.idempotencyKey === input.idempotencyKey);
    if (repeated) return { ok: true, value: source, reused: true };
    let corrected: DirectSale;
    try {
      corrected = updateDirectSale(source, input, {
        kind: "edit",
        idempotencyKey: input.idempotencyKey,
        createdAt: this.now(),
        reason: input.revisionReason?.trim() || "تصحيح بيانات البيع المباشر",
      });
    } catch (error) {
      return validationFailure(errorMessageOf(error, "بيانات تصحيح البيع المباشر غير صالحة."));
    }
    /* S11: التصحيح داخل حد الكتابة المحروس — النسخة الحية تفحص عند المخزن
     * فلا يُطمس تعديل وصل بين قراءة الخدمة وكتابتها. */
    const committed = await this.store.commitDirectSaleWrite(source, corrected, [input.idempotencyKey], null);
    if (!committed.ok) {
      if (committed.code === STORAGE_STALE) return { ok: false, code: CONFLICT, message: committed.message };
      return storageFailure(committed.message || "تعذر حفظ تصحيح البيع المباشر محليًا؛ لم يتغير الأصل.");
    }
    return committed.value.reused
      ? { ok: true, value: committed.value.sale, reused: true }
      : { ok: true, value: committed.value.sale };
  }

  async cancel(
    id: string,
    reason: string,
    idempotencyKey: string,
    expectedRevisionCount?: number,
  ): Promise<DirectSaleResult<DirectSale>> {
    const existing = await this.store.listDirectSales();
    if (!existing.ok) return storageFailure("تعذر قراءة سجل البيع قبل الإلغاء.");
    const source = existing.value.find(sale => sale.id === id);
    if (!source) return notFoundFailure("بيع مباشر غير موجود؛ لم يتغير شيء.");
    /* و٦: الإلغاء من نافذة متأخرة لا يطمس تعديلًا أحدث وصل قبله. */
    if (expectedRevisionCount !== undefined && expectedRevisionCount !== (source.revisions?.length ?? 0))
      return { ok: false, code: CONFLICT, message: CONFLICT_MESSAGE };
    /* مفتاح الإلغاء ملك للبيع واحد كالتصحيح تمامًا. */
    if (
      existing.value.some(
        sale =>
          sale.id !== id &&
          (sale.idempotencyKey === idempotencyKey ||
            sale.revisions?.some(revision => revision.idempotencyKey === idempotencyKey)),
      )
    )
      return validationFailure("مفتاح التصحيح مستخدم مسبقًا؛ لم يتغير شيء.");
    /* إعادة نية الإلغاء نفسها: نفّذ فعلًا — عودة صادقة بلا كتابة ثانية. */
    const repeated = source.revisions?.find(revision => revision.idempotencyKey === idempotencyKey);
    if (repeated) return { ok: true, value: source, reused: true };
    let cancelled: DirectSale;
    try {
      cancelled = cancelDirectSale(source, {
        kind: "cancel",
        idempotencyKey,
        createdAt: this.now(),
        reason,
      });
    } catch (error) {
      return validationFailure(errorMessageOf(error, "بيانات إلغاء البيع المباشر غير صالحة."));
    }
    /* S11: الإلغاء داخل حد الكتابة المحروس — والنصف التابع (عكس التخصيصات)
     * يبقى بخطوته الموثقة كما سلف (إشعار صادق عند تعذره لا إخفاء). */
    const committed = await this.store.commitDirectSaleWrite(source, cancelled, [idempotencyKey], null);
    if (!committed.ok) {
      if (committed.code === STORAGE_STALE) return { ok: false, code: CONFLICT, message: committed.message };
      return storageFailure(committed.message || "تعذر حفظ إلغاء البيع المباشر محليًا؛ بقي الأصل دون تغيير.");
    }
    if (committed.value.reused) return { ok: true, value: committed.value.sale, reused: true };
    /* المجموعة ٦ (تدقيق A1 — FT-02): الإلغاء ينقض القبض — تخصيصات المحفظة
     * المرتبطة بهذا البيع (sourceRefKind=sale) تُعكس مرآةً في معاملة كاش واحدة
     * ذات مفتاح حتمي (معرّف العكس مشتق من معرّف التخصيص نفسه) فبقاء محفظة
     * «تُظهر» مبلغًا لبيعٍ ملغى يستحيل، والقيمة تعود إلى «غير الموزع» حيث
     * مصيرها قرار المالك (ردّ فعلي أو ضبط). فشل هذه الكتابة لا يُفقد مالًا:
     * النتيجة أثر صادق في غير الموزع يظهر لفحص MIC-14 — نبلغه في الرسالة. */
    const mirror = await this.reverseAllocationsForCancelledSale(committed.value.sale, reason);
    if (!mirror.ok)
      return { ok: true, value: committed.value.sale, allocationReversalNotice: mirror.message };
    return { ok: true, value: committed.value.sale };
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
