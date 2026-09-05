/**
 * المجموعة ٦ (البند ١ — إتمام S2-04أ): التراجع المزدوج الموثق عن قبضة مع
 * تخصيصها المطابق بنقرة واحدة. هذه الخدمة منسّق فقط: لا تضيف مسار كتابة ثانيًا
 * لأي مفهوم — التراجع عن القبضة يمر بدالة النطاق القائمة reverseOrderCollection،
 * والتراجع عن التخصيص يُبنى بمصنع النطاق القائم createCashContinuityEntry
 * (عكس مطابق تمامًا)، والكتابة ذرّية عبر commitOrderCollectionReversal في المخزن.
 *
 * قاعدة المطابقة: التخصيص المرشّد يرتبط بالطلب (sourceRefId + kind "order")
 * وغير متراجَع. الإشارة الأساسية: جذر مفتاح العملية (sheetKey:attribute —
 * توقيع ورقة التحصيل منذ المجموعة ٢) أو سطر المصدر sourceRefLineId (المجموعة ٦).
 * التراجع المزدوج يُعرض فقط عند «مطابقة كاملة»: مرشّد وحيد، مبلغ التخصيص يساوي
 * مبلغ القبضة، تراجع بالمبلغ الكامل، ولا تراجعات سابقة على القبضة. أي حالة
 * غير ذلك → رفض صريح برسالة عربية صادقة، ويبقى مسار «التراجع عن القبضة لحالها».
 * لا تخمين ولا تقسيم متناسب ولا تراجع عن تخصيص غير مطابق أبدًا.
 */
import { createCashContinuityEntry, type CashContinuityEntry } from "@micro-domain/cash-continuity/index.js";
import { reverseOrderCollection } from "@micro-domain/craft-order/index.js";
import type { PrototypeLocalStore, StoredCraftOrder } from "@/storage/local/types";
import type { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { localDateInAmman } from "@/presentation/formatters";

export type CollectionAllocationMatchStatus =
  | "full_match"
  | "no_allocation"
  | "ambiguous"
  | "amount_mismatch"
  | "allocation_already_reversed"
  | "partial_only";

export type CollectionReversalPreview = {
  status: CollectionAllocationMatchStatus;
  collectionEventId: string;
  collectionAmountMinor: number;
  remainingMinor: number;
  allocation: {
    entryId: string;
    walletId: string;
    walletName: string;
    amountMinor: number;
  } | null;
  refusalReason: string | null;
  orderCollectedBeforeMinor: number;
  orderReceivableBeforeMinor: number;
  walletBalanceBeforeMinor: number | null;
  walletBalanceAfterMinor: number | null;
  unallocatedBeforeMinor: number | null;
  unallocatedAfterMinor: number | null;
  recordedCashBeforeMinor: number | null;
  recordedCashAfterMinor: number | null;
  walletWarning: string | null;
};

export type CompoundReverseCollectionInput = {
  orderId: string;
  collectionEventId: string;
  amountMinor: number;
  reason: string;
  operationKey: string;
  /** false → دلالات اليوم نفسها: التراجع عن القبضة وحدها عبر المسار الذرّي نفسه. */
  alsoReverseAllocation: boolean;
};

export type CollectionReversalOutcome = {
  stored: StoredCraftOrder;
  allocationReversal: CashContinuityEntry | null;
  reused: boolean;
};

export type CollectionReversalResult<T> =
  | { ok: true; value: T; reused?: boolean }
  | { ok: false; code: "validation_error" | "storage_error" | "not_found"; message: string };

const id = (prefix: string) =>
  globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export class CollectionReversalService {
  constructor(
    private readonly store: PrototypeLocalStore,
    private readonly projectFinance: ProjectFinancialService,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  /** المعاينة الصادقة قبل التأكيد: مطابقة التخصيص + أرقام قبل/بعد لكل بُعد مالي. */
  async preview(input: {
    orderId: string;
    collectionEventId: string;
  }): Promise<CollectionReversalResult<CollectionReversalPreview>> {
    const [orderResult, entriesResult, walletsResult, positionResult] = await Promise.all([
      this.store.getOrder(input.orderId),
      this.store.listCashContinuityEntries(),
      this.store.listCashWallets(),
      this.projectFinance.readPosition(),
    ]);
    if (!orderResult.ok || !entriesResult.ok || !walletsResult.ok)
      return { ok: false, code: "storage_error", message: "تعذر قراءة سجلات التراجع محليًا." };
    const stored = orderResult.value;
    if (!stored) return { ok: false, code: "not_found", message: "الطلب غير متاح محليًا." };
    const order = stored.order;
    const source = order.events.find(event => event.id === input.collectionEventId);
    if (!source || source.type !== "collection_recorded")
      return { ok: false, code: "validation_error", message: "اختر قبضة مسجلة على هذا الطلب قبل التراجع." };

    const entries = entriesResult.value;
    const reversedEntryIds = new Set(
      entries
        .filter(entry => entry.type === "reversal" && entry.reversesEntryId)
        .map(e => e.reversesEntryId!),
    );
    /* المرشّحون يشملون المُتراجَع سابقًا — كشف حالة «التخصيص مُتراجَع» يتطلب
     * النظر في الكل قبل استبعاد المتراجَع من المطابقة. */
    const orderAllocations = entries.filter(
      entry =>
        entry.type === "allocation" &&
        entry.cashDeltaMinor > 0 &&
        entry.sourceRefId === stored.id &&
        entry.sourceRefKind === "order",
    );
    const candidates = orderAllocations.filter(entry => !reversedEntryIds.has(entry.id));
    const reversedSoFar = order.events
      .filter(event => event.type === "collection_reversed" && event.reversesEventId === source.id)
      .reduce((sum, event) => sum + (event.amountMinor ?? 0), 0);
    const collectionAmountMinor = source.amountMinor ?? 0;
    const remainingMinor = collectionAmountMinor - reversedSoFar;

    /* المطابقة: الإشارة الأساسية جذر مفتاح العملية، ثم سطر المصدر، ثم fallback
     * القديم (المصدر + تطابق المبلغ) الذي يرفض عند التعدد بلا تخمين. */
    const keyMatch = orderAllocations.find(
      entry => entry.operationKey === `${source.idempotencyKey}:attribute`,
    );
    const lineMatch = orderAllocations.find(entry => entry.sourceRefLineId === source.id);
    const amountMatches = candidates.filter(entry => entry.cashDeltaMinor === collectionAmountMinor);
    const primary: CashContinuityEntry | null = keyMatch ?? lineMatch ?? null;
    const ambiguous = !primary && amountMatches.length > 1;
    const matched: CashContinuityEntry | null =
      primary ?? (amountMatches.length === 1 ? amountMatches[0] : null);

    const wallets = walletsResult.value;
    const walletOf = (walletId: string) => wallets.find(wallet => wallet.id === walletId) ?? null;
    const position = positionResult.ok ? positionResult.value : null;

    let status: CollectionAllocationMatchStatus;
    let refusalReason: string | null = null;
    let allocationInfo: CollectionReversalPreview["allocation"] = null;

    if (reversedSoFar > 0 || remainingMinor < collectionAmountMinor) {
      status = "partial_only";
      refusalReason =
        "التراجع المزدوج بيدعم القبضة كاملة بس — للتراجع الجزئي، تراجع عن القبضة لحالها وبعدين عدّل التخصيص من دفتر المحفظة.";
    } else if (candidates.length === 0) {
      if (primary && reversedEntryIds.has(primary.id)) {
        status = "allocation_already_reversed";
        refusalReason = "التخصيص المطابق مُتراجَع سابقًا؛ يتبقى التراجع عن القبضة نفسها.";
      } else {
        status = "no_allocation";
        refusalReason =
          "هذي القبضة ما إلها تخصيص بمحفظة — الكاش تابع لغير الموزع؛ التراجع بيكون عن القبضة لحالها.";
      }
    } else if (ambiguous) {
      status = "ambiguous";
      refusalReason =
        "في أكتر من تخصيص مرتبط بنفس الطلب وما نقدر نحدد المطابق — راجع دفتر المحفظة وتراجع يدويًا.";
    } else if (!matched) {
      status = "amount_mismatch";
      refusalReason =
        "مبلغ التخصيص بالمحفظة ما عاد يساوي مبلغ القبضة — ما نتراجع عنه تلقائيًا مشان ما نخسر رقم.";
    } else if (matched.cashDeltaMinor !== collectionAmountMinor) {
      status = "amount_mismatch";
      refusalReason =
        "مبلغ التخصيص بالمحفظة ما عاد يساوي مبلغ القبضة — ما نتراجع عنه تلقائيًا مشان ما نخسر رقم.";
    } else if (reversedEntryIds.has(matched.id)) {
      status = "allocation_already_reversed";
      refusalReason = "التخصيص المطابق مُتراجَع سابقًا؛ يتبقى التراجع عن القبضة نفسها.";
    } else {
      status = "full_match";
    }

    if (status === "full_match" && matched) {
      const wallet = walletOf(matched.walletId);
      const walletEntries = entries.filter(entry => entry.walletId === matched.walletId);
      const walletBalanceBeforeMinor = walletEntries.reduce((sum, entry) => sum + entry.cashDeltaMinor, 0);
      const walletBalanceAfterMinor = walletBalanceBeforeMinor - matched.cashDeltaMinor;
      allocationInfo = {
        entryId: matched.id,
        walletId: matched.walletId,
        walletName: wallet?.name ?? "محفظة",
        amountMinor: matched.cashDeltaMinor,
      };
      const unallocatedBeforeMinor = position ? position.unallocatedCashMinor : null;
      const recordedCashBeforeMinor = position ? position.recordedCashMinor : null;
      return {
        ok: true,
        value: {
          status,
          collectionEventId: source.id,
          collectionAmountMinor,
          remainingMinor,
          allocation: allocationInfo,
          refusalReason: null,
          orderCollectedBeforeMinor: order.collectedMinor,
          orderReceivableBeforeMinor: order.receivableMinor,
          walletBalanceBeforeMinor,
          walletBalanceAfterMinor,
          /* التراجع المزدوج: غير الموزع صافي صفر (−قبضة +فك تخصيص). */
          unallocatedBeforeMinor,
          unallocatedAfterMinor: unallocatedBeforeMinor,
          recordedCashBeforeMinor,
          recordedCashAfterMinor:
            recordedCashBeforeMinor === null ? null : recordedCashBeforeMinor - collectionAmountMinor,
          walletWarning:
            walletBalanceAfterMinor < 0
              ? `رصيد محفظة «${allocationInfo.walletName}» راح يصير سالب — يعني في مصاريف مسجلة عليها أكتر من الموجود فعليًا.`
              : null,
        },
      };
    }

    return {
      ok: true,
      value: {
        status,
        collectionEventId: source.id,
        collectionAmountMinor,
        remainingMinor,
        allocation: null,
        refusalReason,
        orderCollectedBeforeMinor: order.collectedMinor,
        orderReceivableBeforeMinor: order.receivableMinor,
        walletBalanceBeforeMinor: null,
        walletBalanceAfterMinor: null,
        unallocatedBeforeMinor: position ? position.unallocatedCashMinor : null,
        unallocatedAfterMinor: null,
        recordedCashBeforeMinor: position ? position.recordedCashMinor : null,
        recordedCashAfterMinor: null,
        walletWarning: null,
      },
    };
  }

  /** التنفيذ: كشف إعادة الاستخدام أولًا (بمفتاح الجذر)، ثم تحقق كامل قبل أي
   * كتابة، ثم كتابة ذرّية واحدة عبر المخزن. القيود المزدوجة (مطابقة كاملة ومبلغ
   * كامل) تخص مسار المزدوج حصرًا — التراجع المفرد يبقى بدلالات اليوم نفسها
   * بما فيها التراجع الجزئي الموثق. */
  async reverse(
    input: CompoundReverseCollectionInput,
  ): Promise<CollectionReversalResult<CollectionReversalOutcome>> {
    if (!input.reason.trim())
      return { ok: false, code: "validation_error", message: "أكمل سبب التراجع قبل الحفظ." };

    const [orderResult, entriesResult, walletsResult] = await Promise.all([
      this.store.getOrder(input.orderId),
      this.store.listCashContinuityEntries(),
      this.store.listCashWallets(),
    ]);
    if (!orderResult.ok || !entriesResult.ok || !walletsResult.ok)
      return { ok: false, code: "storage_error", message: "تعذر قراءة سجلات التراجع محليًا." };
    const stored = orderResult.value;
    if (!stored) return { ok: false, code: "not_found", message: "الطلب غير متاح محليًا." };

    const timestamp = this.now();
    const reversalEventKey = `${input.orderId}:reverse-collection:${input.operationKey}`;
    /* إعادة الاستخدام: نفس مفتاح الجذر نفّذ فعلًا — أثر الكاش المطابق موجود أو
     * الحالة نصفية تُعلن بصدق؛ لا تكرار ولا إكمال صامت. */
    if (
      stored.order.events.some(
        event => event.type === "collection_reversed" && event.idempotencyKey === reversalEventKey,
      )
    ) {
      const matchingCash = entriesResult.value.find(
        entry => entry.operationKey === `${input.operationKey}:unattribute`,
      );
      if (input.alsoReverseAllocation && !matchingCash)
        return {
          ok: false,
          code: "storage_error",
          message: "وجدت تراجع قبضة بلا أثر تخصيص مطابق؛ لم يتغير السجل.",
        };
      return {
        ok: true,
        value: {
          stored,
          allocationReversal: matchingCash ?? null,
          reused: true,
        },
        reused: true,
      };
    }

    const preview = await this.preview({
      orderId: input.orderId,
      collectionEventId: input.collectionEventId,
    });
    if (!preview.ok) return preview;
    if (input.alsoReverseAllocation) {
      if (preview.value.status !== "full_match")
        return {
          ok: false,
          code: "validation_error",
          message: preview.value.refusalReason ?? "ما نقدر نتراجع عن التخصيص المطابق لهذي القبضة.",
        };
      if (input.amountMinor !== preview.value.collectionAmountMinor)
        return {
          ok: false,
          code: "validation_error",
          message: "التراجع المزدوج بيدعم مبلغ القبضة كاملًا بس — عدّل المبلغ أو تراجع عن القبضة لحالها.",
        };
    }
    try {
      /* نصف الطلب: دالة النطاق القائمة — لا مسار ثانٍ للتراجع عن القبضة. */
      const order = reverseOrderCollection(stored.order, {
        collectionEventId: input.collectionEventId,
        amountMinor: input.amountMinor,
        reason: input.reason,
        idempotencyKey: reversalEventKey,
        createdAt: timestamp,
      });
      const nextStored: StoredCraftOrder = { ...stored, order, updatedAt: timestamp };

      /* نصف الكاش: مصنع النطاق القائم بعكس مطابق تمامًا — لا مسار ثانٍ لفك التخصيص. */
      let allocationReversal: CashContinuityEntry | null = null;
      if (input.alsoReverseAllocation && preview.value.allocation) {
        const matched = entriesResult.value.find(entry => entry.id === preview.value.allocation!.entryId);
        if (!matched)
          return { ok: false, code: "validation_error", message: "لم نجد أثر التخصيص المطابق للتراجع." };
        allocationReversal = createCashContinuityEntry({
          id: id("allocation-reversal"),
          walletId: matched.walletId,
          type: "reversal",
          occurredOn: localDateInAmman(timestamp),
          recordedAt: timestamp,
          cashDeltaMinor: -matched.cashDeltaMinor,
          note: `تراجع: ${matched.note}`,
          reason: input.reason,
          operationKey: `${input.operationKey}:unattribute`,
          reversesEntryId: matched.id,
        });
      }

      const committed = await this.store.commitOrderCollectionReversal(
        nextStored,
        allocationReversal,
        reversalEventKey,
      );
      if (!committed.ok)
        return {
          ok: false,
          code: committed.code === "storage_stale" ? "storage_error" : "storage_error",
          message: committed.message ?? "تعذر حفظ التراجع ذريًا. بقي السجل دون تغيير؛ جرّب مرة ثانية.",
        };
      return {
        ok: true,
        value: {
          stored: committed.value.order,
          allocationReversal: committed.value.cashEntry,
          reused: committed.value.reused,
        },
        reused: committed.value.reused,
      };
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "تعذر التراجع عن القبضة.",
      };
    }
  }
}
