/**
 * EXE-010 (AUD-NEW-04): عكس تحصيل البيع المباشر — إجراء صريح باسم «عكس
 * التحصيل» بسبب إلزامي، يصحح سجل البيع وتخصيص المحفظة والذمم في معاملة
 * ذرّية واحدة. هذه الخدمة منسّق فقط: تعديل البيع يمر بدالة النطاق القائمة
 * updateDirectSale (مراجعة موثقة بسبب العكس)، وعكس التخصيص يُبنى بمصنع النطاق
 * القائم createCashContinuityEntry (مرآة مطابقة مع رابط التراجع)، والكتابة
 * ذرّية عبر commitDirectSaleCollectionReversal في المخزن.
 *
 * قاعدة المطابقة (COL-001): التحصيل المرشّد يرتبط بالبيع (sourceRefId +
 * kind "sale") وغير متراجَع — والمرجع القانوني هو التخصيص نفسه المدرج من
 * دفتر المحفظة؛ لا مطابقة بالمبلغ وحده ولا تخمين. العكس بكامل مبلغ التخصيص
 * المطابق فقط (نمط «المطابقة الكاملة» في تراجع القبضة)؛ التحصيلات غير
 * المخصصة على محفظة تُعكس بتعديل المقبوض من محرر البيع — المسار الآمن
 * أصلًا لأن الكاش كله في غير الموزع.
 */
import { createCashContinuityEntry, type CashContinuityEntry } from "@micro-domain/cash-continuity/index.js";
import { updateDirectSale } from "@micro-domain/direct-sale/index.js";
import type { DirectSale } from "@micro-domain/direct-sale/index.js";
import type { PrototypeLocalStore } from "@/storage/local/types";
import type { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { localDateInAmman } from "@micro-domain/shared/index.js";

export type SaleCollectionReversalStatus =
  "full_match" | "sale_cancelled" | "allocation_already_reversed" | "amount_exceeds_collected";

export type ReversibleSaleCollection = {
  allocationEntryId: string;
  walletId: string;
  walletName: string;
  amountMinor: number;
  recordedAt: string;
  note: string;
};

export type SaleCollectionReversalPreview = {
  status: SaleCollectionReversalStatus;
  refusalReason: string | null;
  allocation: ReversibleSaleCollection | null;
  collectedBeforeMinor: number;
  collectedAfterMinor: number | null;
  receivableBeforeMinor: number;
  receivableAfterMinor: number | null;
  walletBalanceBeforeMinor: number | null;
  walletBalanceAfterMinor: number | null;
  unallocatedBeforeMinor: number | null;
  unallocatedAfterMinor: number | null;
  recordedCashBeforeMinor: number | null;
  recordedCashAfterMinor: number | null;
  walletWarning: string | null;
};

export type ReverseSaleCollectionInput = {
  saleId: string;
  allocationEntryId: string;
  reason: string;
  operationKey: string;
};

export type SaleCollectionReversalOutcome = {
  sale: DirectSale;
  allocationReversal: CashContinuityEntry | null;
  reused: boolean;
};

export type SaleCollectionReversalResult<T> =
  | { ok: true; value: T; reused?: boolean }
  | { ok: false; code: "validation_error" | "storage_error" | "not_found"; message: string };

export class SaleCollectionReversalService {
  constructor(
    private readonly store: PrototypeLocalStore,
    private readonly projectFinance: ProjectFinancialService,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  /** التحصيلات القابلة للعكس: تخصيصات محفظة مرتبطة بالبيع وغير متراجَعة —
   *  المرجع القانوني هو التخصيص نفسه، لا البيع ولا المبلغ. */
  async listReversibleCollections(
    saleId: string,
  ): Promise<SaleCollectionReversalResult<readonly ReversibleSaleCollection[]>> {
    const [salesResult, entriesResult, walletsResult] = await Promise.all([
      this.store.listDirectSales(),
      this.store.listCashContinuityEntries(),
      this.store.listCashWallets(),
    ]);
    if (!salesResult.ok || !entriesResult.ok || !walletsResult.ok)
      return { ok: false, code: "storage_error", message: "تعذر قراءة سجلات العكس محليًا." };
    const sale = salesResult.value.find(candidate => candidate.id === saleId);
    if (!sale) return { ok: false, code: "not_found", message: "البيع المباشر غير متاح محليًا." };
    const entries = entriesResult.value;
    const reversedEntryIds = new Set(
      entries
        .filter(entry => entry.type === "reversal" && entry.reversesEntryId)
        .map(entry => entry.reversesEntryId as string),
    );
    const wallets = new Map(walletsResult.value.map(wallet => [wallet.id, wallet.name] as const));
    const collections = entries
      .filter(
        entry =>
          entry.type === "allocation" &&
          entry.cashDeltaMinor > 0 &&
          entry.sourceRefId === saleId &&
          entry.sourceRefKind === "sale" &&
          !reversedEntryIds.has(entry.id),
      )
      .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt))
      .map(entry => ({
        allocationEntryId: entry.id,
        walletId: entry.walletId,
        walletName: wallets.get(entry.walletId) ?? "محفظة",
        amountMinor: entry.cashDeltaMinor,
        recordedAt: entry.recordedAt,
        note: entry.note,
      }));
    return { ok: true, value: collections };
  }

  /** المعاينة الصادقة قبل التأكيد: حالة المطابقة + أرقام قبل/بعد لكل بُعد. */
  async preview(input: {
    saleId: string;
    allocationEntryId: string;
  }): Promise<SaleCollectionReversalResult<SaleCollectionReversalPreview>> {
    const [salesResult, entriesResult, walletsResult, positionResult] = await Promise.all([
      this.store.listDirectSales(),
      this.store.listCashContinuityEntries(),
      this.store.listCashWallets(),
      this.projectFinance.readPosition(),
    ]);
    if (!salesResult.ok || !entriesResult.ok || !walletsResult.ok)
      return { ok: false, code: "storage_error", message: "تعذر قراءة سجلات العكس محليًا." };
    const sale = salesResult.value.find(candidate => candidate.id === input.saleId);
    if (!sale) return { ok: false, code: "not_found", message: "البيع المباشر غير متاح محليًا." };
    if (sale.status === "cancelled")
      return {
        ok: true,
        value: this.refusedPreview(
          "sale_cancelled",
          "البيع ملغى — تخصيصاته عُكست تلقائيًا عند الإلغاء؛ لا تحصيلًا يُعكس هنا.",
          sale,
          positionResult.ok ? positionResult.value.recordedCashMinor : null,
        ),
      };
    const entries = entriesResult.value;
    const reversedEntryIds = new Set(
      entries
        .filter(entry => entry.type === "reversal" && entry.reversesEntryId)
        .map(entry => entry.reversesEntryId as string),
    );
    const matched = entries.find(entry => entry.id === input.allocationEntryId);
    if (
      !matched ||
      matched.type !== "allocation" ||
      matched.sourceRefId !== input.saleId ||
      matched.sourceRefKind !== "sale"
    )
      return {
        ok: false,
        code: "validation_error",
        message: "اختر تخصيص تحصيل مرتبطًا بهذا البيع قبل العكس.",
      };
    if (reversedEntryIds.has(matched.id) || matched.cashDeltaMinor <= 0)
      return {
        ok: true,
        value: this.refusedPreview(
          "allocation_already_reversed",
          "تخصيص هذا التحصيل مُتراجَع سابقًا — لا يُعكس مرتين.",
          sale,
          positionResult.ok ? positionResult.value.recordedCashMinor : null,
        ),
      };
    const amountMinor = matched.cashDeltaMinor;
    if (amountMinor > sale.collectedMinor)
      return {
        ok: true,
        value: this.refusedPreview(
          "amount_exceeds_collected",
          "مبلغ التخصيص يتجاوز المقبوض المسجل على البيع — راجع سجل التصحيحات قبل العكس.",
          sale,
          positionResult.ok ? positionResult.value.recordedCashMinor : null,
        ),
      };
    const wallets = walletsResult.value;
    const wallet = wallets.find(candidate => candidate.id === matched.walletId);
    const walletEntries = entries.filter(entry => entry.walletId === matched.walletId);
    const walletBalanceBeforeMinor = walletEntries.reduce((sum, entry) => sum + entry.cashDeltaMinor, 0);
    const walletBalanceAfterMinor = walletBalanceBeforeMinor - amountMinor;
    const position = positionResult.ok ? positionResult.value : null;
    const unallocatedBeforeMinor = position ? position.unallocatedCashMinor : null;
    const recordedCashBeforeMinor = position ? position.recordedCashMinor : null;
    const collectedAfterMinor = sale.collectedMinor - amountMinor;
    return {
      ok: true,
      value: {
        status: "full_match",
        refusalReason: null,
        allocation: {
          allocationEntryId: matched.id,
          walletId: matched.walletId,
          walletName: wallet?.name ?? "محفظة",
          amountMinor,
          recordedAt: matched.recordedAt,
          note: matched.note,
        },
        collectedBeforeMinor: sale.collectedMinor,
        collectedAfterMinor,
        receivableBeforeMinor: Math.max(sale.revenueMinor - sale.collectedMinor, 0),
        receivableAfterMinor: Math.max(sale.revenueMinor - collectedAfterMinor, 0),
        walletBalanceBeforeMinor,
        walletBalanceAfterMinor,
        /* العكس المزدوج: غير الموزع صافي صفر (−مقبوض +فك تخصيص). */
        unallocatedBeforeMinor,
        unallocatedAfterMinor: unallocatedBeforeMinor,
        recordedCashBeforeMinor,
        recordedCashAfterMinor:
          recordedCashBeforeMinor === null ? null : recordedCashBeforeMinor - amountMinor,
        walletWarning:
          walletBalanceAfterMinor < 0
            ? `رصيد محفظة «${wallet?.name ?? "محفظة"}» راح يصير سالب — يعني في مصاريف مسجلة عليها أكتر من الموجود فعليًا.`
            : null,
      },
    };
  }

  /** التنفيذ: كشف إعادة الاستخدام أولًا (مفتاح المراجعة)، ثم معاينة كاملة،
   *  ثم كتابة ذرّية واحدة — البيع المعدل وقيد العكس معًا أو لا شيء. */
  async reverse(
    input: ReverseSaleCollectionInput,
  ): Promise<SaleCollectionReversalResult<SaleCollectionReversalOutcome>> {
    if (!input.reason.trim())
      return { ok: false, code: "validation_error", message: "أكمل سبب عكس التحصيل قبل الحفظ." };
    const [salesResult, entriesResult] = await Promise.all([
      this.store.listDirectSales(),
      this.store.listCashContinuityEntries(),
    ]);
    if (!salesResult.ok || !entriesResult.ok)
      return { ok: false, code: "storage_error", message: "تعذر قراءة سجلات العكس محليًا." };
    const sale = salesResult.value.find(candidate => candidate.id === input.saleId);
    if (!sale) return { ok: false, code: "not_found", message: "البيع المباشر غير متاح محليًا." };

    const timestamp = this.now();
    const revisionKey = `sale-collect-reverse:${input.operationKey}`;
    /* إعادة الاستخدام: مراجعة العكس نفسها نفّذت فعلًا — عودة صادقة مع أثر
     * الكاش المطابق، والحالة النصفية تُعلن لا تُكمل بصمت. */
    const alreadyReversed = (sale.revisions ?? []).some(revision => revision.idempotencyKey === revisionKey);
    if (alreadyReversed) {
      const matchingCash = entriesResult.value.find(
        entry => entry.operationKey === `${input.operationKey}:unattribute`,
      );
      if (!matchingCash)
        return {
          ok: false,
          code: "storage_error",
          message: "وجدت عكس تحصيل بلا أثر تخصيص مطابق؛ لم يتغير السجل.",
        };
      return {
        ok: true,
        value: { sale, allocationReversal: matchingCash, reused: true },
        reused: true,
      };
    }

    const preview = await this.preview({ saleId: input.saleId, allocationEntryId: input.allocationEntryId });
    if (!preview.ok) return preview;
    if (preview.value.status !== "full_match" || !preview.value.allocation)
      return {
        ok: false,
        code: "validation_error",
        message: preview.value.refusalReason ?? "ما نقدر نعكس هذا التحصيل بأمان.",
      };

    const matched = entriesResult.value.find(entry => entry.id === input.allocationEntryId);
    if (!matched)
      return { ok: false, code: "validation_error", message: "لم نجد أثر التخصيص المطابق للعكس." };
    const amountMinor = matched.cashDeltaMinor;

    try {
      /* نصف البيع: دالة النطاق القائمة — مراجعة موثقة بسبب العكس، والمقبوض
       * ينقص فيعود الدين بقوته وحالته الصادقة تعاد اشتقاقًا. */
      const corrected = updateDirectSale(
        sale,
        {
          itemName: sale.itemName,
          quantity: sale.quantity,
          revenueMinor: sale.revenueMinor,
          collectedMinor: sale.collectedMinor - amountMinor,
          collectionStatus:
            sale.collectedMinor - amountMinor >= sale.revenueMinor ? "collected_in_full" : "partial_debt",
          catalogItemId: sale.catalogItemId,
          customerName: sale.customerName ?? undefined,
          costMinor: sale.costMinor,
          occurredOn: sale.occurredOn,
          note: sale.note,
        },
        {
          kind: "edit",
          idempotencyKey: revisionKey,
          createdAt: timestamp,
          reason: `عكس تحصيل: ${input.reason.trim()}`,
        },
      );
      /* نصف الكاش: مصنع النطاق القائم بعكس مطابق تمامًا — رابط التراجع
       * (reversesEntryId) يصل قيد العكس بالقيد الأصلي في دفتر المحفظة. */
      const allocationReversal = createCashContinuityEntry({
        id: `sale-collect-reverse-${input.operationKey}-${matched.id}`,
        walletId: matched.walletId,
        type: "reversal",
        occurredOn: localDateInAmman(timestamp),
        recordedAt: timestamp,
        cashDeltaMinor: -matched.cashDeltaMinor,
        note: `عكس تحصيل: ${matched.note}`,
        reason: input.reason.trim(),
        operationKey: `${input.operationKey}:unattribute`,
        reversesEntryId: matched.id,
      });
      const committed = await this.store.commitDirectSaleCollectionReversal(
        corrected,
        allocationReversal,
        revisionKey,
      );
      if (!committed.ok)
        return {
          ok: false,
          code: "storage_error",
          message: committed.message ?? "تعذر حفظ عكس التحصيل ذريًا؛ بقي السجل دون تغيير.",
        };
      return {
        ok: true,
        value: {
          sale: committed.value.sale,
          allocationReversal: committed.value.cashEntry,
          reused: committed.value.reused,
        },
        reused: committed.value.reused,
      };
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "تعذر عكس تحصيل البيع المباشر.",
      };
    }
  }

  private refusedPreview(
    status: SaleCollectionReversalStatus,
    refusalReason: string,
    sale: DirectSale,
    recordedCashBeforeMinor: number | null,
  ): SaleCollectionReversalPreview {
    return {
      status,
      refusalReason,
      allocation: null,
      collectedBeforeMinor: sale.collectedMinor,
      collectedAfterMinor: null,
      receivableBeforeMinor: Math.max(sale.revenueMinor - sale.collectedMinor, 0),
      receivableAfterMinor: null,
      walletBalanceBeforeMinor: null,
      walletBalanceAfterMinor: null,
      unallocatedBeforeMinor: null,
      unallocatedAfterMinor: null,
      recordedCashBeforeMinor,
      recordedCashAfterMinor: null,
      walletWarning: null,
    };
  }
}
