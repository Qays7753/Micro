/** U-001: «السجل» — سطح قراءة واحد لكل تصحيح موثق عبر أنواع السجلات المدعومة.
 * لا يكتب شيئًا ولا يعيد تفسير الماضي؛ يجمع ما سُجّل فعلًا من مصادر كل مخزن.
 * المجموعة ٢: توسّع بعائلات الشراء/الدفعات وتعديل سعر الطلب والتراجع عن القبض. */
import type { FinancialEvent, FinancialEventType } from "@micro-domain/financial-event/index.js";
import type { DirectSale } from "@micro-domain/direct-sale/index.js";
import type { CashContinuityEntry } from "@micro-domain/cash-continuity/index.js";
import type { StoredCraftOrder, PrototypeLocalStore } from "@/storage/local/types";
import { formatMoneyWithUnit } from "@/presentation/formatters";

export type CorrectionHistoryKind =
  | "event_reversal"
  | "event_edit"
  | "event_restore"
  | "sale_edit"
  | "sale_cancel"
  | "sale_price_cut"
  | "cash_reversal"
  /* المجموعة ٢ (§10.4): تصحيحات المشتريات والدفعات. */
  | "purchase_edit"
  | "payment_reversal"
  /* المجموعة ٢ (§10.5/§10.3): تعديل سعر الطلب بعد الاتفاق والتراجع عن قبض. */
  | "order_price_revision"
  | "order_collection_reversal"
  /* المجموعة ٥ (عقد ٣٤ — مسار التدقيق): عائلات عقد ٢٩ وأصحاب التصحيح
   * المفقودة — تصحيح الأصل/القرض/العربون، عكس التسليم، تصنيف العربون،
   * عكس حركة مخزون/حركة مال المالك، ومراجعة عقد الأصل (المدة/البداية). */
  | "asset_correction"
  | "loan_correction"
  | "deposit_reclassification"
  | "delivery_reversal"
  | "deposit_classification"
  | "inventory_reversal"
  | "owner_reversal"
  | "asset_contract_revision";

export type CorrectionHistoryGroup = "all" | "events" | "sales" | "cash" | "purchases" | "orders";

export type CorrectionHistoryEntry = {
  id: string;
  kind: CorrectionHistoryKind;
  /** متى سُجّل التصحيح نفسه (وقت التسجيل، لا تاريخ الأثر). */
  recordedAt: string;
  /** التاريخ الفعال للتصحيح حيث له معنى؛ null حين لا ينطبق. */
  occurredOn: string | null;
  /** أثر مالي موقّع حيث يمكن التعبير عنه برقم واحد صادق؛ null حين لا يمكن. */
  amountEffectMinor: number | null;
  reason: string | null;
  /** وصف السجل الأصلي (نوع · تاريخ · مبلغ) كما سُجّل. */
  originalLabel: string | null;
  /** وصف البديل في التعديلات الذرّية (تراجع + بديل). */
  replacementLabel: string | null;
  /** رابط عميق حيث يوجد للسجل مسار حقيقي. */
  deepLink: string | null;
};

export type CorrectionHistoryResult =
  | { ok: true; value: readonly CorrectionHistoryEntry[] }
  | { ok: false; code: "storage_error"; message: string };

/* المجموعة ٦ (البند ٣ — S2-09): خلاصة أثر التصحيحات على سطح/نطاق واحد —
 * عدد وصافي قابل للعرض الصادق (null حين لا يمكن اختزاله برقم واحد) وسطور
 * لفتح الأصل والتصحيح. طبقة قراءة صرفة فوق list()؛ لا تخزين جديد. */
export type CorrectionDigest = {
  count: number;
  netAmountMinor: number | null;
  entries: readonly CorrectionHistoryEntry[];
};
export type CorrectionDigestResult =
  | { ok: true; value: CorrectionDigest }
  | { ok: false; code: "storage_error"; message: string };

const eventKindLabel: Record<FinancialEventType, string> = {
  owner_investment_cash: "استثمار المالك",
  owner_withdrawal_cash: "سحب شخصي",
  operating_expense_cash: "مصروف مدفوع",
  operating_expense_payable: "مصروف مستحق",
  payable_settlement_cash: "تسديد التزام",
  amanah_held_cash: "أمانة قُبضت",
  amanah_released_cash: "أمانة سُلّمت",
  loss_non_cash: "هالك بلا خروج نقد",
  /* المجموعة ٤ (عقد ٢٩): تسميات قراءة للأنواع الجديدة — تعرض في السجلات والتصحيحات. */
  asset_purchase_cash: "شراء أصل نقدًا",
  asset_purchase_payable: "شراء أصل بالذمم",
  asset_depreciation: "إهلاك أصل",
  asset_disposal_cash: "تخلص من أصل",
  asset_writeoff: "شطب أصل",
  loan_outgoing_cash: "قرض لشخص",
  loan_repayment_cash: "سداد قرض",
  deposit_retained_revenue: "عربون محتفظ به كإيراد",
  deposit_retained_owner: "عربون محتفظ به كمال مالك",
};


/** استرجاع الحدث المالي يُوسَم بمفتاح «restore:<id>» من واجهة التصحيح — علامة صريحة لا تخمين. */
const RESTORE_KEY_PREFIX = "restore:";
/** تعديل الحدث الذرّي يُنشئ تراجعًا بمفتاح «<key>:reversal» والبديل بمفتاح «<key>». */
const EDIT_REVERSAL_SUFFIX = ":reversal";
/* المجموعة ٥ (عقد ٣٤): إصلاح اقتران تعديلات المجموعة ٤ — مفاتيحها النمطية
 * «<base>-reversal:<stamp>» مع بديل «<base>-replacement:<stamp>» بالختم نفسه؛
 * التحويل هنا يجد البديل فتُعرض رحلة «من → إلى» بدل تراجعٍ أعمى. */
const G4_REVERSAL_MARKER = "-reversal:";
const G4_REPLACEMENT_MARKER = "-replacement:";
const KIND_FOR_G4_KEY: Record<string, CorrectionHistoryKind> = {
  ":acquisition-": "asset_correction",
  ":principal-": "loan_correction",
  ":deposit-reclassify-": "deposit_reclassification",
};
function g4ReplacementKey(reversalKey: string): string | null {
  const markerAt = reversalKey.indexOf(G4_REVERSAL_MARKER);
  if (markerAt === -1) return null;
  return (
    reversalKey.slice(0, markerAt) +
    G4_REPLACEMENT_MARKER +
    reversalKey.slice(markerAt + G4_REVERSAL_MARKER.length)
  );
}

export class CorrectionHistoryService {
  constructor(private readonly store: PrototypeLocalStore) {}

  /** المجموعة ٦ (البند ٣): التصحيحات المؤثرة داخل نطاق (occurredOn) — بلا
   * نطاق: كل التاريخ. الصافي مجموع الآثار الموقعة، وnull إن تعذر أي رقم. */
  async affecting(from?: string, to?: string): Promise<CorrectionDigestResult> {
    const list = await this.list();
    if (!list.ok)
      return { ok: false, code: "storage_error", message: list.message };
    const entries = list.value.filter(entry => {
      if (!entry.occurredOn) return from === undefined && to === undefined;
      if (from !== undefined && entry.occurredOn < from) return false;
      if (to !== undefined && entry.occurredOn > to) return false;
      return true;
    });
    const amounts = entries.map(entry => entry.amountEffectMinor);
    const netAmountMinor = amounts.some(amount => amount === null)
      ? null
      : (amounts as readonly number[]).reduce((sum, amount) => sum + amount, 0);
    return { ok: true, value: { count: entries.length, netAmountMinor, entries } };
  }

  async list(): Promise<CorrectionHistoryResult> {
    const [eventsResult, salesResult, cashResult, purchasesResult, ordersResult, movementsResult, assetsResult, ownerMovementsResult] =
      await Promise.all([
        this.store.listFinancialEvents(),
        this.store.listDirectSales(),
        this.store.listCashContinuityEntries(),
        this.store.listSupplierPurchases(),
        this.store.listOrders(),
        this.store.listInventoryMovements(),
        this.store.listAssets(),
        this.store.listOwnerMovements(),
      ]);
    if (
      !eventsResult.ok ||
      !salesResult.ok ||
      !cashResult.ok ||
      !purchasesResult.ok ||
      !ordersResult.ok ||
      !movementsResult.ok ||
      !assetsResult.ok ||
      !ownerMovementsResult.ok
    )
      return { ok: false, code: "storage_error", message: "تعذر قراءة سجل التصحيحات المحلي." };

    const events = eventsResult.value;
    const byId = new Map(events.map(event => [event.id, event] as const));
    const byKey = new Map(events.map(event => [event.idempotencyKey, event] as const));
    const entries: CorrectionHistoryEntry[] = [];

    for (const event of events) {
      /* تراجع/تعديل: كل حدث تراجع موثق يشير للأصل بـ correctionOfEventId. */
      if (event.correctionType === "reverse" && event.correctionOfEventId) {
        const source = byId.get(event.correctionOfEventId) ?? null;
        const isEdit = event.idempotencyKey.endsWith(EDIT_REVERSAL_SUFFIX);
        /* المجموعة ٥ (عقد ٣٤): تعديلات المجموعة ٤ الذرّية — البديل بنفس الختم
         * عبر تحويل المفتاح، فيقترن التراجع ببديله وتُعرض «من → إلى». */
        const g4Key = g4ReplacementKey(event.idempotencyKey);
        const g4Replacement = g4Key !== null ? byKey.get(g4Key) ?? null : null;
        const replacement = isEdit
          ? events.find(
              candidate =>
                candidate.idempotencyKey === event.idempotencyKey.slice(0, -EDIT_REVERSAL_SUFFIX.length),
            ) ?? null
          : g4Replacement;
        let kind: CorrectionHistoryKind = isEdit && replacement ? "event_edit" : "event_reversal";
        if (g4Replacement) {
          for (const [marker, g4Kind] of Object.entries(KIND_FOR_G4_KEY)) {
            if (event.idempotencyKey.includes(marker)) kind = g4Kind;
          }
        }
        entries.push({
          id: event.id,
          kind,
          recordedAt: event.recordedAt,
          occurredOn: event.occurredOn,
          amountEffectMinor:
            replacement && source ? replacement.amountMinor - source.amountMinor : -event.amountMinor,
          reason: event.correctionReason ?? null,
          originalLabel: source
            ? `${eventKindLabel[source.type]} · ${source.occurredOn} · ${formatMoneyWithUnit(source.amountMinor)}`
            : null,
          replacementLabel:
            replacement && source
              ? `${eventKindLabel[replacement.type]} · ${replacement.occurredOn} · ${formatMoneyWithUnit(replacement.amountMinor)}`
              : null,
          /* U-001 (دورة التدقيق النهائي): وصول عميق للحدث في «السجل والأثر» — التعديل
           * يفتح البديل النشط (حيث التصحيح/الحذف)، والتراجع يفتح الأصل (حيث الاسترجاع). */
          deepLink:
            replacement || event.assetContext?.assetId
              ? event.assetContext?.assetId
                ? `/assets/${encodeURIComponent(event.assetContext.assetId)}`
                : replacement
                  ? `/finance?event=${encodeURIComponent(replacement.id)}`
                  : `/finance?event=${encodeURIComponent(event.correctionOfEventId)}`
              : event.loanContext?.loanId
                ? `/loans/${encodeURIComponent(event.loanContext.loanId)}`
                : event.depositContext?.orderId
                  ? `/orders/${encodeURIComponent(event.depositContext.orderId)}`
                  : `/finance?event=${encodeURIComponent(event.correctionOfEventId)}`,
        });
      }
      /* استرجاع: إعادة تسجيل قيم أصل متراجع عنه — موسّمة بمفتاح صريح. */
      if (event.idempotencyKey.startsWith(RESTORE_KEY_PREFIX)) {
        const source = byId.get(event.idempotencyKey.slice(RESTORE_KEY_PREFIX.length)) ?? null;
        entries.push({
          id: `${event.id}-restore`,
          kind: "event_restore",
          recordedAt: event.recordedAt,
          occurredOn: event.occurredOn,
          amountEffectMinor: event.amountMinor,
          reason: source
            ? `استرجاع بعد تراجع: ${eventKindLabel[source.type]} · ${source.occurredOn} · ${formatMoneyWithUnit(source.amountMinor)}`
            : "استرجاع حدث سابق",
          originalLabel: null,
          replacementLabel: null,
          /* حدث الاسترجاع هو السجل النشط الحالي — تصحيحه من صفّه. */
          deepLink: `/finance?event=${encodeURIComponent(event.id)}`,
        });
      }
    }

    for (const sale of salesResult.value) {
      for (const revision of sale.revisions ?? []) {
        /* U-001 (دورة التدقيق النهائي): الأثر الموقّع هو فرق التعديل نفسه لا قيمة
         * السجل القديمة — إلغاء بيع يُظهر الإيراد المستبعد بالسالب. */
        const signedEffectMinor =
          revision.kind === "cancel"
            ? -sale.revenueMinor
            : revision.kind === "price_cut" && revision.beforeRevenueMinor != null
              ? sale.collectedMinor - revision.beforeRevenueMinor
              : revision.beforeRevenueMinor != null
                ? sale.revenueMinor - revision.beforeRevenueMinor
                : null;
        entries.push({
          id: `${sale.id}:${revision.idempotencyKey}`,
          kind:
            revision.kind === "edit"
              ? "sale_edit"
              : revision.kind === "cancel"
                ? "sale_cancel"
                : "sale_price_cut",
          recordedAt: revision.createdAt,
          occurredOn: sale.occurredOn,
          amountEffectMinor: signedEffectMinor,
          reason: revision.reason ?? null,
          originalLabel:
            revision.beforeRevenueMinor != null
              ? `بيع مباشر «${sale.itemName}» · السعر قبل التصحيح ${formatMoneyWithUnit(revision.beforeRevenueMinor)}`
              : `بيع مباشر «${sale.itemName}» · ${formatMoneyWithUnit(sale.revenueMinor)}`,
          replacementLabel:
            revision.kind === "cancel"
              ? "ملغى — مستبعد من الإيراد والكاش، والسجل باقٍ"
              : `السعر بعد التصحيح ${formatMoneyWithUnit(sale.revenueMinor)}`,
          deepLink: `/direct-sales/${encodeURIComponent(sale.id)}`,
        });
      }
    }

    for (const entry of cashResult.value) {
      if (entry.type !== "reversal") continue;
      entries.push({
        id: entry.id,
        kind: "cash_reversal",
        recordedAt: entry.recordedAt,
        occurredOn: entry.occurredOn,
        amountEffectMinor: entry.cashDeltaMinor,
        reason: entry.reason ?? entry.note,
        originalLabel: `قيد كاش · ${entry.note}`,
        replacementLabel: null,
        /* S1-08: يفتح دفتر المحفظة نفسه مع تركيز صف التراجع (?entry=) —
         * لا مسار كتابة ثانٍ من هنا؛ تصحيح القيود يُنفّذ من سطحه الأصلي. */
        deepLink: `/cash/wallet/${encodeURIComponent(entry.walletId)}?entry=${encodeURIComponent(entry.id)}`,
      });
    }

    /* المجموعة ٢ (§10.4): تعديلات المشتريات وتراجعات الدفعات — من سجل الشراء نفسه. */
    for (const purchase of purchasesResult.value) {
      for (const revision of purchase.revisions ?? []) {
        entries.push({
          id: `${purchase.id}:revision:${revision.idempotencyKey}`,
          kind: "purchase_edit",
          recordedAt: revision.createdAt,
          occurredOn: revision.createdAt.slice(0, 10),
          amountEffectMinor: revision.beforeTotalMinor - purchase.totalMinor,
          reason: revision.reason,
          originalLabel: `شراء من ${revision.beforeSupplierName} · الإجمالي قبل التصحيح ${formatMoneyWithUnit(revision.beforeTotalMinor)}`,
          replacementLabel: `الإجمالي بعد التصحيح ${formatMoneyWithUnit(purchase.totalMinor)} · المدفوع ${formatMoneyWithUnit(purchase.paidMinor)}`,
          deepLink: `/suppliers/purchase/${encodeURIComponent(purchase.id)}`,
        });
      }
      for (const reversal of purchase.paymentReversals ?? []) {
        const payment = purchase.payments.find(candidate => candidate.id === reversal.paymentId);
        entries.push({
          id: `${purchase.id}:reversal:${reversal.idempotencyKey}`,
          kind: "payment_reversal",
          recordedAt: reversal.recordedAt,
          occurredOn: reversal.occurredOn,
          amountEffectMinor: reversal.amountMinor,
          reason: reversal.reason,
          originalLabel: `دفعة ${payment ? formatMoneyWithUnit(payment.amountMinor) : formatMoneyWithUnit(reversal.amountMinor)} لـ${purchase.supplierName}`,
          replacementLabel: `استُعيد المتبقي للمورد — المتبقي الآن ${formatMoneyWithUnit(purchase.payableMinor)}`,
          deepLink: `/suppliers/purchase/${encodeURIComponent(purchase.id)}`,
        });
      }
    }

    /* المجموعة ٢ (§10.5/§10.3): تعديل سعر الطلب بعد الاتفاق والتراجع عن قبضة. */
    for (const stored of ordersResult.value as readonly StoredCraftOrder[]) {
      for (const event of stored.order.events) {
        if (event.type === "price_revised") {
          entries.push({
            id: `${stored.id}:price:${event.idempotencyKey}`,
            kind: "order_price_revision",
            recordedAt: event.createdAt,
            occurredOn: ammanDateOf(event.createdAt),
            amountEffectMinor: (event.toPriceMinor ?? 0) - (event.fromPriceMinor ?? 0),
            reason: event.note ?? null,
            originalLabel: `سعر «${stored.order.itemName || "طلب"}» قبل التصحيح ${formatMoneyWithUnit(event.fromPriceMinor ?? 0)}`,
            replacementLabel: `السعر بعد التصحيح ${formatMoneyWithUnit(event.toPriceMinor ?? 0)} · المتبقي ${formatMoneyWithUnit(stored.order.receivableMinor)}`,
            deepLink: `/orders/${encodeURIComponent(stored.id)}`,
          });
        }
        if (event.type === "collection_reversed") {
          entries.push({
            id: `${stored.id}:reverse-collection:${event.idempotencyKey}`,
            kind: "order_collection_reversal",
            recordedAt: event.createdAt,
            occurredOn: ammanDateOf(event.createdAt),
            amountEffectMinor: -(event.amountMinor ?? 0),
            reason: event.note ?? null,
            originalLabel: `قبضة على «${stored.order.itemName || "طلب"}» · ${formatMoneyWithUnit(event.amountMinor ?? 0)}`,
            replacementLabel: `المتبقي الآن ${formatMoneyWithUnit(stored.order.receivableMinor)} — الإيراد لم يتغير`,
            deepLink: `/orders/${encodeURIComponent(stored.id)}`,
          });
        }
      }
    }

    /* المجموعة ٥ (عقد ٣٤ — مسار التدقيق): عائلات عقد ٢٩ والأصحاب المفقودة. */

    /* عكس التسليم وتصنيف العربون — من خط زمن الطلب نفسه؛ أصل السجل باقٍ دائمًا. */
    for (const stored of ordersResult.value as readonly StoredCraftOrder[]) {
      for (const event of stored.order.events) {
        if (event.type === "delivery_reversed") {
          entries.push({
            id: `${stored.id}:reverse-delivery:${event.idempotencyKey}`,
            kind: "delivery_reversal",
            recordedAt: event.createdAt,
            occurredOn: ammanDateOf(event.createdAt),
            amountEffectMinor: null,
            reason: event.note ?? null,
            originalLabel: `تسليم «${stored.order.itemName || "طلب"}» — الإيراد والنتيجة حُيّدا، وحركات المواد عُكست مرآةً`,
            replacementLabel: "الكاش المقبوض لم يُمس — راجع الطلب قبل تسليم جديد",
            deepLink: `/orders/${encodeURIComponent(stored.id)}`,
          });
        }
        if (event.type === "deposit_classified") {
          entries.push({
            id: `${stored.id}:classify-deposit:${event.idempotencyKey}`,
            kind: "deposit_classification",
            recordedAt: event.createdAt,
            occurredOn: ammanDateOf(event.createdAt),
            amountEffectMinor: null,
            reason: event.note ?? null,
            originalLabel: `عربون محتفظ به من «${stored.order.itemName || "طلب"}» · ${formatMoneyWithUnit(stored.order.depositCollectedMinor)} — كان معلقًا بلا معنى`,
            replacementLabel:
              stored.order.retainedMeaning === "owner"
                ? "صُنّف مال مالك — ليس نتيجة"
                : stored.order.retainedMeaning === "revenue"
                  ? "صُنّف إيراد مشروع — يدخل نتيجة الفترة"
                  : "معناه الآن: بانتظار قرار",
            deepLink: `/orders/${encodeURIComponent(stored.id)}`,
          });
        }
      }
    }

    /* عكس حركة مخزون — المرآة السالبة تحيّد الكمية والقيمة معًا. */
    for (const movement of movementsResult.value) {
      if (movement.type !== "reversal" || !movement.reversesMovementId) continue;
      entries.push({
        id: `movement-reversal:${movement.id}`,
        kind: "inventory_reversal",
        recordedAt: movement.recordedAt,
        occurredOn: movement.occurredOn,
        amountEffectMinor: null,
        reason: movement.note || movement.reason,
        originalLabel: `حركة مخزون · ${movement.occurredOn} · الكمية ${movement.quantityDeltaMilli / 1000}`,
        replacementLabel: "حُيّد أثر الحركة — الكمية والقيمة عادا كما كانا",
        deepLink: movement.orderId
          ? `/orders/${encodeURIComponent(movement.orderId)}`
          : "/inventory",
      });
    }

    /* مراجعة عقد الأصل (المدة/بداية الإهلاك) — التاريخ لا يُعاد كتابته. */
    for (const asset of assetsResult.value) {
      for (const revision of asset.contractRevisions ?? []) {
        entries.push({
          id: `asset-contract:${asset.id}:${revision.revision}`,
          kind: "asset_contract_revision",
          recordedAt: revision.changedAt,
          occurredOn: revision.changedAt.slice(0, 10),
          amountEffectMinor: null,
          reason: revision.reason,
          originalLabel: `عقد الأصل «${asset.name}» قبل المراجعة — العمر ${revision.lifeMonths ?? "?"} شهرًا`,
          replacementLabel: `بعد المراجعة: العمر ${revision.lifeMonths ?? "?"} · بداية الإهلاك ${revision.depreciationStartOn ?? "غير محددة"}`,
          deepLink: `/assets/${encodeURIComponent(asset.id)}`,
        });
      }
    }

    /* تراجع موثق عن حركة مال المالك — الأصل باقٍ والصافي أثرهما معًا. */
    for (const movement of ownerMovementsResult.value) {
      if (!movement.reversalOfId) continue;
      entries.push({
        id: `owner-reversal:${movement.id}`,
        kind: "owner_reversal",
        recordedAt: movement.recordedAt,
        occurredOn: movement.occurredOn,
        amountEffectMinor: null,
        reason: movement.reversalReason,
        originalLabel: `حركة مال مالك (${movement.kind === "draw" ? "سحب" : "إرجاع"}) · ${formatMoneyWithUnit(movement.amountMinor)}`,
        replacementLabel: "التراجع موثق — صافي أثر الحركتين معًا هو الرصيد القائم",
        deepLink: "/finance/owner-entitlement",
      });
    }

    entries.sort((left, right) => right.recordedAt.localeCompare(left.recordedAt));
    return { ok: true, value: entries };
  }
}

/* تاريخ محلي (عمّان) من طابع زمني — لأحداث الطلب التي تسجل وقت التنفيذ. */
function ammanDateOf(timestamp: string): string | null {
  if (Number.isNaN(Date.parse(timestamp))) return null;
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Amman",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const value = (type: string) => parts.find(part => part.type === type)?.value;
  const year = value("year");
  const month = value("month");
  const day = value("day");
  return year && month && day ? `${year}-${month}-${day}` : null;
}
