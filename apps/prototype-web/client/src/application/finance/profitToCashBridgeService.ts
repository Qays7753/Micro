/**
 * FIN-003 (WS-173 — Wave 1): جسر النتيجة المسجلة إلى تغير الكاش المسجل —
 * «لماذا يختلف ربحي المسجل عن تغير الكاش؟» قراءة فقط فوق السجلات القائمة:
 * لا Writer ولا كتابة ولا إعادة تفسير الماضي. رقم النتيجة يأتي من القارئ
 * الكنوني `readRecordedPeriodResult` وحده (مسار واحد — لا تُعاد هنا أي
 * معادلة نتيجة)، وتغير الكاش المقيس يجمع كل حركة كاش مسجلة بتاريخها
 * المحلي (Asia/Amman): قبض الطلبات (عربون/تحصيل/رد)، قبض البيع المباشر،
 * كاش الأحداث المالية (استثمار/سحب/مصروف مدفوع/تسديد/أمانات/أصول/قروض)،
 * دفع الموردين، وحركات استمرارية الكاش المؤثرة في الإجمالي (افتتاح/تسوية
 * وتراجعاتها) — التحويلات والتخصيصات حركات داخلية صافيها صفر فتُستبعد.
 *
 * كل بنود الجسر صحيحة الإشارة بحيث يتوازن الجسر بالبناء على البيئة
 * النظيفة: النتيجة + (تعديلات البنود غير النقدية داخل النتيجة) + (توقيت
 * الذمم) + (توقيت المواد) + (ذمم دائنة: استحقاق/تسديد/موردون) + (تدفقات
 * المالك والأصول والقروض والأمانات) + (تسويات الكاش) = تغير الكاش المقيس.
 * ما تعذّر تفسيره (مثل تراجع محفظة بلا حركة أصل معروفة) يظهر سطر «فرق
 * غير مطابق» صريحًا وحالة incomplete — لا يُصفَّر بصمت ولا يُخفى.
 *
 * ملاحظة سياسة: بنود عقد 29/31 غير النقدية تُشتق من حقول القارئ الكنوني
 * نفسها (إهلاك/شطب/تخلص/عربون محتفظ) — تعريف واحد لكل رقم؛ و«نتيجة
 * التخلص» تُستبدل بمقابلها النقدي لأن المقابل يدخل بند تدفقات الأصول.
 */
import { localDateInAmman } from "@micro-domain/shared/index.js";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import type { FinanceResult } from "@/application/finance/projectFinancialService";
import type { PrototypeLocalStore, StoredCraftOrder } from "@/storage/local/types";
import type { CashContinuityEntry } from "@micro-domain/cash-continuity/index.js";
import type { DirectSale } from "@micro-domain/direct-sale/index.js";
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";
import type { OwnerMovement } from "@micro-domain/owner-entitlement/index.js";
import type { SupplierPurchase } from "@micro-domain/supplier-purchase/index.js";

export type ProfitToCashBridgeStatus = "recorded_only" | "incomplete" | "invalid";

export type ProfitToCashBridgeLine = {
  id: string;
  /** تسمية العرض العربية للبند. */
  label: string;
  /** مصدر البند/عائلته — تتبع كل فرق إلى سجله. */
  source: string;
  amountMinor: number;
};

export type ProfitToCashBridgeReading = {
  from: string;
  to: string;
  /** نتيجة الفترة المسجلة من القارئ الكنوني — null عند نطاق غير صالح أو معرفة ناقصة. */
  resultMinor: number | null;
  /** تغير الكاش المسجل المقيس في الفترة — null فقط عند نطاق غير صالح. */
  recordedCashDeltaMinor: number | null;
  /** مجموع بنود الجسر (بدون سطر الفرق) — من النتيجة إلى الكاش؛ null حين تتعذر البداية. */
  bridgedTotalMinor: number | null;
  /** الفرق غير المفسَّر = المقيس − مجموع البنود؛ يظهر كسطر صريح إن لم يكن صفرًا. */
  remainderMinor: number | null;
  lines: readonly ProfitToCashBridgeLine[];
  status: ProfitToCashBridgeStatus;
  reasons: readonly string[];
};

const OWNER_MOVEMENT_ENTRY_PREFIX = "owner-movement:";

/** أحداث قبض الطلبات التي تحرك الكاش (بإشارة القبض) — نفس اصطلاح كشف الفترة الحي. */
const ORDER_CASH_IN_TYPES: ReadonlySet<string> = new Set(["collection_recorded", "deposit_collected"]);
/** أحداث استرداد كاش الطلبات — بخصمها يظل صافي الكشف مطابقًا للكاش المسجل (G6-F1-3). */
const ORDER_CASH_RETURN_TYPES: ReadonlySet<string> = new Set([
  "collection_reversed",
  "deposit_refunded",
  "deposit_reversed",
]);

function invalidReading(from: string, to: string, reasons: readonly string[]): ProfitToCashBridgeReading {
  return {
    from,
    to,
    resultMinor: null,
    recordedCashDeltaMinor: null,
    bridgedTotalMinor: null,
    remainderMinor: null,
    lines: [],
    status: "invalid",
    reasons,
  };
}

export class ProfitToCashBridgeService {
  private readonly finance: ProjectFinancialService;

  constructor(
    private readonly store: PrototypeLocalStore,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {
    /* القارئ الكنوني نفسه مصدر رقم النتيجة — لا مسار حساب ثانٍ هنا أبدًا. */
    this.finance = new ProjectFinancialService(store, now);
  }

  async readProfitToCashBridge(period: { from: string; to: string }): Promise<FinanceResult<ProfitToCashBridgeReading>> {
    const [
      periodResult,
      ordersResult,
      eventsResult,
      salesResult,
      purchasesResult,
      continuityResult,
      movementsResult,
    ] = await Promise.all([
      this.finance.readRecordedPeriodResult(period.from, period.to),
      this.store.listOrders(),
      this.store.listFinancialEvents(),
      this.store.listDirectSales(),
      this.store.listSupplierPurchases(),
      this.store.listCashContinuityEntries(),
      this.store.listOwnerMovements(),
    ]);
    if (
      !periodResult.ok ||
      !ordersResult.ok ||
      !eventsResult.ok ||
      !salesResult.ok ||
      !purchasesResult.ok ||
      !continuityResult.ok ||
      !movementsResult.ok
    )
      return { ok: false, code: "storage_error", message: "تعذر قراءة سجلات الجسر المحلية." };
    const from = period.from;
    const to = period.to;
    const periodReading = periodResult.value;
    if (periodReading.status === "invalid")
      return { ok: true, value: invalidReading(from, to, periodReading.reasons) };

    const inPeriod = (date: string) => date >= from && date <= to;
    const events = eventsResult.value as readonly FinancialEvent[];
    const periodEvents = events.filter(event => inPeriod(event.occurredOn));

    /* ═══ ١) المقيس: كل حركة كاش مسجلة بتاريخها المحلي ═══ */
    /* قبض الطلبات (عربون/تحصيل) وردوده — بتاريخ حدث القبضة بتوقيت عمّان
     * (نفس اصطلاح كشف الفترة الحي). */
    let orderCollectionsMinor = 0;
    for (const stored of ordersResult.value as readonly StoredCraftOrder[]) {
      for (const event of stored.order.events) {
        const cashIn = ORDER_CASH_IN_TYPES.has(event.type);
        const cashReturned = ORDER_CASH_RETURN_TYPES.has(event.type);
        if (!cashIn && !cashReturned) continue;
        if (!inPeriod(localDateInAmman(event.createdAt))) continue;
        const amount = event.amountMinor ?? 0;
        if (amount <= 0) continue;
        orderCollectionsMinor += cashIn ? amount : -amount;
      }
    }
    /* قبض البيع المباشر — يُنسب لتاريخ البيع المسجل (سياسة F-005 الحية). */
    const directSalesCollectedMinor = (salesResult.value as readonly DirectSale[])
      .filter(sale => (sale.status ?? "active") === "active" && inPeriod(sale.occurredOn))
      .reduce((sum, sale) => sum + sale.collectedMinor, 0);
    /* كاش الأحداث المالية (كل الأنواع بإشاراتها، ومعكوساتها بتاريخ التراجع). */
    const eventCashMinor = periodEvents.reduce((sum, event) => sum + event.cashDeltaMinor, 0);
    /* دفع الموردين: الدفعات بتواريخها وتراجعاتها (G5-S7) — بلا ازدواج مع
     * تخصيصات المحافظ (حركات داخلية صافيها صفر). */
    let supplierPaymentsMinor = 0;
    for (const purchase of purchasesResult.value as readonly SupplierPurchase[]) {
      for (const payment of purchase.payments) {
        if (inPeriod(payment.occurredOn)) supplierPaymentsMinor += payment.amountMinor;
      }
      for (const reversal of purchase.paymentReversals ?? []) {
        if (inPeriod(reversal.occurredOn)) supplierPaymentsMinor -= reversal.amountMinor;
      }
    }
    /* استمرارية الكاش: ما يؤثر في إجمالي الكاش المسجل فقط — الافتتاح (داخل
     * الفترة) والتسوية وتراجعاتهما (المصنّفة أو بلا أصل معروف). التحويلات
     * والتخصيصات وتراجعاتهما حركات داخلية صافي صفر فتُستبعد من المقيس. */
    const continuity = continuityResult.value as readonly CashContinuityEntry[];
    const entryById = new Map(continuity.map(entry => [entry.id, entry]));
    const isOwnerMovementEntry = (entry: CashContinuityEntry) =>
      entry.operationKey.startsWith(OWNER_MOVEMENT_ENTRY_PREFIX);
    const reversalAffectsTotalCash = (entry: CashContinuityEntry): boolean => {
      const target = entry.reversesEntryId ? entryById.get(entry.reversesEntryId) : undefined;
      /* أصل غير معروف: الكاش تحرك فعلًا ولا نعرف عائلته — يُقاس ويظهر فرقًا غير مطابق. */
      if (!target) return true;
      return target.type === "opening_balance" || target.type === "cash_adjustment";
    };
    const reversalExplainsTotalCash = (entry: CashContinuityEntry): boolean => {
      const target = entry.reversesEntryId ? entryById.get(entry.reversesEntryId) : undefined;
      if (!target) return false;
      return target.type === "opening_balance" || target.type === "cash_adjustment";
    };
    let continuityTotalCashMinor = 0;
    let continuityExplainedMinor = 0;
    let orphanReversalCount = 0;
    for (const entry of continuity) {
      if (!inPeriod(entry.occurredOn)) continue;
      if (entry.type === "opening_balance") {
        continuityTotalCashMinor += entry.cashDeltaMinor;
        continuityExplainedMinor += entry.cashDeltaMinor;
      } else if (entry.type === "cash_adjustment") {
        continuityTotalCashMinor += entry.cashDeltaMinor;
        if (!isOwnerMovementEntry(entry)) continuityExplainedMinor += entry.cashDeltaMinor;
      } else if (entry.type === "reversal" && reversalAffectsTotalCash(entry)) {
        continuityTotalCashMinor += entry.cashDeltaMinor;
        if (!entry.reversesEntryId || !entryById.get(entry.reversesEntryId)) orphanReversalCount += 1;
        if (reversalExplainsTotalCash(entry)) continuityExplainedMinor += entry.cashDeltaMinor;
      }
    }
    const recordedCashDeltaMinor =
      orderCollectionsMinor +
      directSalesCollectedMinor +
      eventCashMinor -
      supplierPaymentsMinor +
      continuityTotalCashMinor;

    /* ═══ ٢) بنود الجسر — كل بند بمصدره، والإشارات صحيحة بالبناء ═══ */
    const lines: ProfitToCashBridgeLine[] = [];
    const push = (id: string, label: string, source: string, amountMinor: number) => {
      lines.push({ id, label, source, amountMinor });
    };
    const familyEventCash = (types: readonly FinancialEvent["type"][]) =>
      periodEvents.filter(event => types.includes(event.type)).reduce((sum, event) => sum + event.cashDeltaMinor, 0);

    if (periodReading.resultMinor === null) {
      /* النتيجة غير متاحة (تكلفة بيع مباشر مجهولة مثلًا) — المقيس يُعرض،
       * والجسر لا يبدأ من رقم مجهول: incomplete بأسباب القارئ نفسها. */
      return {
        ok: true,
        value: {
          from,
          to,
          resultMinor: null,
          recordedCashDeltaMinor,
          bridgedTotalMinor: null,
          remainderMinor: null,
          lines: [],
          status: "incomplete",
          reasons: [
            ...periodReading.reasons,
            "نتيجة الفترة غير متاحة — لا يُبنى الجسر من رقم مجهول؛ الكاش المقيس ظاهر كما هو.",
          ],
        },
      };
    }

    /* ١) نقطة البداية: النتيجة المسجلة (القارئ الكنوني). */
    push(
      "period_result",
      "نتيجة الفترة المسجلة",
      "القارئ الكنوني readRecordedPeriodResult — عقد 05 §3.2.1 و14 §5",
      periodReading.resultMinor,
    );
    /* ٢–٥) بنود غير نقدية داخل النتيجة — من حقول القارئ الكنوني نفسها:
     * إضافة ما خفض النتيجة بلا كاش، واستبعاد ما رفعها بلا كاش. */
    push(
      "addback_depreciation",
      "إضافة: إهلاك مسجّل (غير نقدي داخل النتيجة)",
      "القارئ الكنوني — بند عقد 31/29 المستقل؛ لا كاش مرّ به",
      periodReading.assetDepreciationMinor,
    );
    push(
      "addback_writeoff_loss",
      "إضافة: خسارة شطب أصل (غير نقدي داخل النتيجة)",
      "القارئ الكنوني — بند عقد 31/29؛ دفتري مفقود صراحةً",
      periodReading.assetWriteOffLossMinor,
    );
    push(
      "remove_disposal_result",
      "استبعاد: نتيجة تخلص من أصل (غير نقدي — مقابلها النقدي في تدفقات الأصول)",
      "القارئ الكنوني — الفرق (نتيجة التخلص − مقابلها النقدي) غير نقدي؛ المقابل النقدي يدخل بند الأصول",
      -periodReading.assetDisposalResultMinor,
    );
    push(
      "remove_retained_deposit_revenue",
      "استبعاد: إيراد عربون محتفظ مصنّف (كاشه دخل بقبضة سابقة)",
      "القارئ الكنوني — يُعترف مرة واحدة بتاريخ التصنيف بلا كاش جديد",
      -periodReading.retainedDepositRevenueMinor,
    );
    push(
      "addback_loss_non_cash",
      "إضافة: خسارة غير نقدية مسجلة (داخل المصروف التشغيلي)",
      "أحداث loss_non_cash داخل الفترة بتاريخ occurredOn — تخفض النتيجة ولا تمس الكاش",
      periodEvents
        .filter(event => event.type === "loss_non_cash")
        .reduce((sum, event) => sum + event.operatingExpenseDeltaMinor, 0),
    );
    /* ٦) توقيت الذمم: قبض الفترة (طلبات + بيع مباشر) مقابل الإيراد المعترف به. */
    push(
      "receivables_timing",
      "توقيت الذمم: قبض الفترة مقابل الإيراد المعترف به",
      "أحداث قبض الطلبات بتاريخ عمّان + قبض البيع المباشر بتاريخ البيع − إيراد القارئ الكنوني المعترف به",
      orderCollectionsMinor +
        directSalesCollectedMinor -
        periodReading.recognizedRevenueMinor -
        periodReading.directSaleRevenueMinor,
    );
    /* ٧) توقيت المواد: تكلفة معترف بها في النتيجة مقابل مواد دخلت الفترة. */
    const purchasesTotalMinor = (purchasesResult.value as readonly SupplierPurchase[])
      .filter(purchase => inPeriod(purchase.purchasedOn))
      .reduce((sum, purchase) => sum + purchase.totalMinor, 0);
    push(
      "materials_timing",
      "توقيت المواد: تكلفة دخلت النتيجة مقابل مشتريات الفترة",
      "التكلفة المباشرة المستخدمة + تكلفة البيع المباشر المعروفة (القارئ الكنوني) − إجمالي مشتريات الفترة (سجلات الموردين)",
      periodReading.effectiveDirectCostMinor + periodReading.directSaleCostKnownMinor - purchasesTotalMinor,
    );
    /* ٨) الذمم الدائنة: التزامات تشغيلية وموردون — استحقاق بلا كاش مقابل تسديد/دفع نقدي. */
    push(
      "operating_payables",
      "ذمم تشغيلية: استحقاق جديد بلا كاش مقابل تسديد نقدي",
      "أحداث المصروف المستحق (بمقدار ما دخلت نتيجته) + كاش تسديد الالتزامات + ذمم الموردين الجديدة − دفع الفترة",
      periodEvents
        .filter(event => event.type === "operating_expense_payable")
        .reduce((sum, event) => sum + event.operatingExpenseDeltaMinor, 0) +
        familyEventCash(["payable_settlement_cash"]) +
        purchasesTotalMinor -
        supplierPaymentsMinor,
    );
    /* ٩) مصروف مدفوع لم يدخل النتيجة بعد (مشترك غير محمل) — كاش خرج بلا مصروف معترف. */
    push(
      "unallocated_shared_paid",
      "مصروف مدفوع غير محمّل في النتيجة (مصروف مشترك بلا حصة)",
      "أحداث المصروف النقدي غير المحملة — كاش دفع والنتيجة لم تخصمه بعد",
      periodEvents
        .filter(event => event.type === "operating_expense_cash")
        .reduce((sum, event) => sum + event.cashDeltaMinor + event.operatingExpenseDeltaMinor, 0),
    );
    /* ١٠) تدفقات المالك: أحداث الاستثمار/السحب + حركات دفتر المالك (سحب/إرجاع). */
    const ownerMovementsMinor = (movementsResult.value as readonly OwnerMovement[])
      .filter(movement => inPeriod(movement.occurredOn))
      .reduce((sum, movement) => sum + movement.cashDeltaMinor, 0);
    push(
      "owner_flows",
      "تدفقات المالك: استثمار وسحب (أحداث مالية) وحركات دفتر المالك",
      "أحداث owner_investment/withdrawal_cash بتاريخ occurredOn + حركات المالك من محافظه (كاشها مسجل بتسوية المحفظة المقترنة)",
      familyEventCash(["owner_investment_cash", "owner_withdrawal_cash"]) + ownerMovementsMinor,
    );
    /* ١١) تدفقات الأصول: شراء نقدي وتخلص بمقابل نقدي. */
    push(
      "asset_flows",
      "تدفقات الأصول: شراء نقدي وتخلص بمقابل",
      "أحداث asset_purchase_cash/asset_disposal_cash بتاريخ occurredOn — ليس مصروفًا تشغيليًا",
      familyEventCash(["asset_purchase_cash", "asset_disposal_cash"]),
    );
    /* ١٢) تدفقات القروض: صادرة فقط (إقراض وسداد) — الاقتراض الداخلي غير موجود بعد. */
    push(
      "loan_flows",
      "تدفقات القروض الصادرة: إقراض وسداد (لا اقتراض داخلي مسجل بعد)",
      "أحداث loan_outgoing_cash/loan_repayment_cash بتاريخ occurredOn — صفر صادق حين لا أحداث",
      familyEventCash(["loan_outgoing_cash", "loan_repayment_cash"]),
    );
    /* ١٣) تدفقات الأمانات: قبض وتسليم — ليست ربحًا ولا ملكًا. */
    push(
      "amanah_flows",
      "تدفقات الأمانات: قبض وتسليم",
      "أحداث amanah_held_cash/amanah_released_cash بتاريخ occurredOn",
      familyEventCash(["amanah_held_cash", "amanah_released_cash"]),
    );
    /* ١٤) تسويات الكاش وأرصدة الافتتاح داخل الفترة (غير حركات المالك). */
    push(
      "cash_adjustments",
      "تسويات الكاش وأرصدة الافتتاح داخل الفترة",
      "حركات استمرارية الكاش المؤثرة في الإجمالي: افتتاح داخل الفترة + تسويات عدّ وتراجعات المصنّف منها — التحويل والتخصيص حركات داخلية صافيها صفر",
      continuityExplainedMinor,
    );

    const bridgedTotalMinor = lines.reduce((sum, line) => sum + line.amountMinor, 0);
    const remainderMinor = recordedCashDeltaMinor - bridgedTotalMinor;
    const reasons: string[] = [...periodReading.reasons];
    if (orphanReversalCount > 0)
      reasons.push("تراجع محفظة بلا حركة أصل معروفة داخل الفترة — أثره في الفرق غير المطابق أدناه");
    if (remainderMinor !== 0) {
      push(
        "remainder",
        "فرق غير مطابق بين النتيجة المسجلة وتغير الكاش المقيس",
        "التسوية النهائية: المقيس − مجموع البنود أعلاه — يظهر كما هو ولا يُصفَّر بصمت",
        remainderMinor,
      );
      reasons.push("فرق غير مطابق بين النتيجة المسجلة وتغير الكاش المسجل — راجع مصادره قبل الاعتماد على أي طرف");
    }
    const status: ProfitToCashBridgeStatus =
      remainderMinor !== 0 || periodReading.status === "incomplete" || reasons.length > 0
        ? "incomplete"
        : "recorded_only";
    return {
      ok: true,
      value: {
        from,
        to,
        resultMinor: periodReading.resultMinor,
        recordedCashDeltaMinor,
        bridgedTotalMinor,
        remainderMinor,
        lines,
        status,
        reasons,
      },
    };
  }
}
