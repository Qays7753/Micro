/**
 * المجموعة ٢ (§9.2 — StatementView): كشف فترة بسيط بالعربية — يفصل الكاش عن
 * النتيجة عن الأمانات عن الذمم عن مال المالك، ويصل كل سطر بمصدره. قراءة فقط
 * من السجلات القائمة؛ لا يُنشئ شيئًا ولا يعيد تفسير الماضي.
 */
import { reversedEventIds } from "@micro-domain/financial-event/index.js";
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";
import type { DirectSale } from "@micro-domain/direct-sale/index.js";
import type { OwnerMovement } from "@micro-domain/owner-entitlement/index.js";
import type { StoredCraftOrder, PrototypeLocalStore } from "@/storage/local/types";
import type {
  ProjectFinancialPosition,
  ProjectFinancialService,
  RecordedPeriodResult,
} from "@/application/finance/projectFinancialService";

export type StatementLineSource = {
  label: string;
  href: string;
  amountMinor: number;
};

export type StatementLine = {
  id: string;
  label: string;
  amountMinor: number;
  qualifier: string | null;
  sources: readonly StatementLineSource[];
};

/** سطر تصحيح واحد (تراجع) كما يظهر في كتلة التصحيحات — لا مع عائلته الأصلية.
 * netEffectMinor = أثر التراجع + أثر الأصل إن كان الأصل داخل الفترة نفسها:
 * صفر عندما دخلا معًا (صافي صادق)، وأثر التراجع وحده عندما الأصل خارج الفترة. */
export type StatementCorrectionLine = {
  id: string;
  occurredOn: string;
  familyLabel: string;
  reason: string;
  netEffectMinor: number;
  sourceHref: string;
  sourceLabel: string;
};

export type StatementBlocks = {
  cashIn: readonly StatementLine[];
  cashOut: readonly StatementLine[];
  corrections: { lines: readonly StatementCorrectionLine[]; netMinor: number };
  owner: { investedMinor: number; withdrawnMinor: number; sources: readonly StatementLineSource[] };
  amanah: {
    heldInPeriodMinor: number;
    releasedInPeriodMinor: number;
    heldNowMinor: number;
    trustLine: string;
  };
  receivablesPayables: {
    receivablesNowMinor: number;
    payablesNowMinor: number;
    collectionsInPeriodMinor: number;
    payableEventsInPeriodMinor: number;
    supplierPurchasesInPeriodMinor: number;
    supplierPaymentsInPeriodMinor: number;
  };
};

export type StatementReading = {
  from: string;
  to: string;
  blocks: StatementBlocks;
  result: RecordedPeriodResult;
  position: ProjectFinancialPosition;
  cashNetMinor: number;
  /* المجموعة ١ (قراءة الفترة الواحدة): مجموع الإيراد المعترف به — مشتقّ في
   * الخدمة لا في الصفحة؛ لا حساب فترة داخل أي واجهة. */
  recognizedRevenueTotalMinor: number;
  /* المجموعة ١ (تصنيفي للمصاريف): «مصاريفي حسب تصنيفي» — بُعد قراءة وتجميع
   * فقط؛ لا يغير أي دلتا ولا النتيجة. المجموعة غير المصنفة آخر القائمة
   * بصدق (وسم غائب = غير مصنّف، لا صفر ولا اختفاء). */
  expenseCategories: readonly StatementExpenseCategoryGroup[];
  truthLines: readonly string[];
};

export type StatementExpenseCategoryLine = {
  eventId: string;
  occurredOn: string;
  note: string;
  amountMinor: number;
  kind: "paid" | "payable";
  href: string;
};
export type StatementExpenseCategoryGroup = {
  label: string;
  classified: boolean;
  totalMinor: number;
  lines: readonly StatementExpenseCategoryLine[];
};

export type StatementResult =
  | { ok: true; value: StatementReading }
  | { ok: false; code: "storage_error" | "validation_error"; message: string };


import { formatLocalDate, formatMoneyWithUnit, localDateInAmman as ammanDate } from "@/presentation/formatters";

export class StatementService {
  constructor(
    private readonly store: PrototypeLocalStore,
    private readonly projectFinance: ProjectFinancialService,
  ) {}

  async read(from: string, to: string): Promise<StatementResult> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to)
      return { ok: false, code: "validation_error", message: "اختر نطاق كشف يبدأ قبل نهايته." };
    const [eventsResult, salesResult, ordersResult, purchasesResult, movementsResult, periodResult, positionResult] =
      await Promise.all([
        this.store.listFinancialEvents(),
        this.store.listDirectSales(),
        this.store.listOrders(),
        this.store.listSupplierPurchases(),
        this.store.listOwnerMovements(),
        this.projectFinance.readRecordedPeriodResult(from, to),
        this.projectFinance.readPosition(),
      ]);
    if (
      !eventsResult.ok ||
      !salesResult.ok ||
      !ordersResult.ok ||
      !purchasesResult.ok ||
      !movementsResult.ok ||
      !periodResult.ok ||
      !positionResult.ok
    )
      return { ok: false, code: "storage_error", message: "تعذر قراءة سجلات الكشف المحلية." };

    const inPeriod = (date: string) => date >= from && date <= to;
    const events = eventsResult.value as readonly FinancialEvent[];
    const activeEvents = events.filter(event => inPeriod(event.occurredOn));
    /* الأصول التي جرى تراجع داخل هذه الفترة تُعرض مرة واحدة في كتلة التصحيحات
     * لا مع عائلاتها — فلا يظهر الأثر مرتين ولا يُطمس تصحيح وقع. */
    const reversedInPeriodIds = reversedEventIds(activeEvents);

    /* ١) قبض الطلبات (عربون + تحصيل) داخل الفترة — بتاريخ تسجيل القبضة.
     * G6-F1-3: التراجع الموثق عن قبضة أو رد عربون داخل الفترة يسترد كاشًا خرج
     * فعلًا — بلا خصمه يتضخم «قبض الطلبات» ويفترق صافي الكشف عن الكاش المسجل
     * (نفس صنيع تراجعات دفعات الموردين G5-S7: الخصم بتاريخ التراجع، والأصل
     * يبقى بسطره، فيظهران معًا قابلين للتتبع بلا إخفاء). */
    const orderCollectionSources: StatementLineSource[] = [];
    let orderCollectionsMinor = 0;
    for (const stored of ordersResult.value as readonly StoredCraftOrder[]) {
      for (const event of stored.order.events) {
        const isCashIn =
          event.type === "collection_recorded" || event.type === "deposit_collected";
        const isCashReturned =
          event.type === "collection_reversed" || event.type === "deposit_refunded";
        if (!isCashIn && !isCashReturned) continue;
        const date = ammanDate(event.createdAt);
        if (!inPeriod(date)) continue;
        const amount = event.amountMinor ?? 0;
        if (amount <= 0) continue;
        orderCollectionsMinor += isCashIn ? amount : -amount;
        orderCollectionSources.push({
          label: `${isCashIn
            ? event.type === "deposit_collected"
              ? "عربون"
              : "تحصيل"
            : event.type === "deposit_refunded"
              ? "رد عربون"
              : "تراجع عن قبضة"} — ${stored.order.itemName || "طلب"}`,
          href: `/orders/${stored.id}`,
          amountMinor: isCashIn ? amount : -amount,
        });
      }
    }
    /* ٢) قبض البيع المباشر داخل الفترة — يُنسب لتاريخ البيع (السياسة المسجلة). */
    const sales = salesResult.value as readonly DirectSale[];
    const activeSalesInPeriod = sales.filter(
      sale => (sale.status ?? "active") === "active" && inPeriod(sale.occurredOn),
    );
    const directSalesCollectedMinor = activeSalesInPeriod.reduce(
      (sum, sale) => sum + sale.collectedMinor,
      0,
    );

    const familyEvent = (event: FinancialEvent) =>
      event.correctionType !== "reverse" && !reversedInPeriodIds.has(event.id);

    const cashEventLines = (types: readonly FinancialEvent["type"][]) => {
      const matched = activeEvents.filter(
        event => types.includes(event.type) && familyEvent(event),
      );
      const total = matched.reduce((sum, event) => sum + event.cashDeltaMinor, 0);
      return { matched, total };
    };

    const investment = cashEventLines(["owner_investment_cash"]);
    const withdrawal = cashEventLines(["owner_withdrawal_cash"]);
    const amanahHeld = activeEvents.filter(
      event => event.type === "amanah_held_cash" && familyEvent(event),
    );
    const amanahReleased = activeEvents.filter(
      event => event.type === "amanah_released_cash" && familyEvent(event),
    );
    const expensePaid = activeEvents.filter(
      event => event.type === "operating_expense_cash" && familyEvent(event),
    );
    const payableSettled = activeEvents.filter(
      event => event.type === "payable_settlement_cash" && familyEvent(event),
    );
    /* المجموعة ٤ (تصحيح مراجعة 4-c): الكشف كان يخفي حركات الكاش الجديدة —
     * شراء أصل نقدي وتخلص وتقديم قرض واسترداده. تظهر الآن بعائلاتها الصريحة
     * بلا إعادة تفسير: شراء الأصل خرج ليس مصروفًا، القرض خرج ليس سحبًا ولا
     * مصروفًا، التخلص والاسترداد قبض ليس إيرادًا. المصدر يوصل لصفحة الأصل/القرض. */
    const assetPurchasePaid = cashEventLines(["asset_purchase_cash"]);
    const assetDisposalReceived = cashEventLines(["asset_disposal_cash"]);
    const loanGiven = cashEventLines(["loan_outgoing_cash"]);
    const loanRepaid = cashEventLines(["loan_repayment_cash"]);

    /* مشتريات الموردين داخل الفترة: الدفع الابتدائي بتاريخ الشراء والدفعات بتواريخها. */
    let supplierPurchasesInPeriodMinor = 0;
    let supplierPaymentsInPeriodMinor = 0;
    const supplierSources: StatementLineSource[] = [];
    for (const purchase of purchasesResult.value) {
      const initial = purchase.payments.find(payment => payment.id === `${purchase.id}:initial`);
      if (initial && inPeriod(initial.occurredOn)) {
        supplierPurchasesInPeriodMinor += initial.amountMinor;
        supplierSources.push({
          label: `شراء — ${purchase.supplierName}`,
          href: `/suppliers/purchase/${purchase.id}`,
          amountMinor: initial.amountMinor,
        });
      }
      for (const payment of purchase.payments) {
        if (payment.id === `${purchase.id}:initial`) continue;
        if (!inPeriod(payment.occurredOn)) continue;
        supplierPaymentsInPeriodMinor += payment.amountMinor;
        supplierSources.push({
          label: `دفعة مورد — ${purchase.supplierName}`,
          href: `/suppliers/purchase/${purchase.id}`,
          amountMinor: payment.amountMinor,
        });
      }
      /* G5-S7: التراجع الموثق عن دفعة داخل الفترة يسترد كاشًا دخل فعلًا — بلا خصمه
       * يتضخم «دفع للموردين» ويفترق صافي الكشف عن الكاش المسجل. يُعرض بسطر مصدر
       * مستقل حتى يبقى الأثر الأصلي والاسترداد معًا قابلين للتتبع بلا إخفاء. */
      for (const reversal of purchase.paymentReversals ?? []) {
        if (!inPeriod(reversal.occurredOn)) continue;
        supplierPaymentsInPeriodMinor -= reversal.amountMinor;
        supplierSources.push({
          label: `تراجع عن دفعة — ${purchase.supplierName}`,
          href: `/suppliers/purchase/${purchase.id}`,
          amountMinor: -reversal.amountMinor,
        });
      }
    }

    /* تصحيحات الكاش داخل الفترة: أحداث التراجع (بأنواع أصلها) تُعرض مرة واحدة
     * في كتلة التصحيحات — بسطر يبين السبب والأثر الصافي على هذا الكشف. */
    const familyLabelOf = (type: FinancialEvent["type"]): string =>
      type === "owner_investment_cash"
        ? "مال أدخلته"
        : type === "owner_withdrawal_cash"
          ? "سحب شخصي"
          : type === "amanah_held_cash"
            ? "أمانة قُبضت"
            : type === "amanah_released_cash"
              ? "أمانة سُلّمت"
              : type === "payable_settlement_cash"
                ? "تسديد التزام"
                : type === "asset_purchase_cash"
                  ? "شراء أصل"
                  : type === "asset_disposal_cash"
                    ? "تخلص من أصل"
                    : type === "loan_outgoing_cash"
                      ? "قرض أعطيته"
                      : type === "loan_repayment_cash"
                        ? "استرداد قرض"
                        : "مصروف مدفوع";
    const cashMovingTypes: readonly FinancialEvent["type"][] = [
      "owner_investment_cash",
      "owner_withdrawal_cash",
      "operating_expense_cash",
      "payable_settlement_cash",
      "amanah_held_cash",
      "amanah_released_cash",
      "asset_purchase_cash",
      "asset_disposal_cash",
      "loan_outgoing_cash",
      "loan_repayment_cash",
    ];
    const cashCorrectionLines: StatementCorrectionLine[] = activeEvents
      .filter(
        event => event.correctionType === "reverse" && cashMovingTypes.includes(event.type),
      )
      .map(event => {
        const original = event.correctionOfEventId
          ? events.find(candidate => candidate.id === event.correctionOfEventId)
          : undefined;
        const originalInPeriod = original ? inPeriod(original.occurredOn) : false;
        return {
          id: event.id,
          occurredOn: event.occurredOn,
          familyLabel: familyLabelOf(event.type),
          reason: event.correctionReason ?? "",
          netEffectMinor:
            event.cashDeltaMinor + (originalInPeriod && original ? original.cashDeltaMinor : 0),
          sourceHref: original ? `/finance?event=${encodeURIComponent(original.id)}` : `/finance`,
          sourceLabel: original ? original.note || "الحدث الأصلي" : "الحدث الأصلي",
        };
      });
    const correctionsNetMinor = cashCorrectionLines.reduce(
      (sum, line) => sum + line.netEffectMinor,
      0,
    );

    /* G6-U2-2 (المجموعة ٦ — البند ٢): مسار المحفظة لحركات المالك يدخل كتلة
     * المالك — الإدخال/الإرجاع في «الملك» والسحب في «سحب»، بسطور مصدرها دفتر
     * المحفظة نفسه. حركة التراجع نوعها معاكس فتنجّح الأرقام تلقائيًا؛ لا يُخفى
     * سحبُ مسار المحفظة بعد اليوم ولا يُعدَّل حد «مال المالك لا يدخل النتيجة». */
    const ownerMovements = movementsResult.value as readonly OwnerMovement[];
    const inPeriodMovements = ownerMovements.filter(movement => inPeriod(movement.occurredOn));
    const ledgerInvestedMinor = inPeriodMovements
      .filter(movement => movement.kind === "return")
      .reduce((sum, movement) => sum + movement.amountMinor, 0);
    const ledgerWithdrawnMinor = inPeriodMovements
      .filter(movement => movement.kind === "draw")
      .reduce((sum, movement) => sum + movement.amountMinor, 0);
    const ownerMovementSources: StatementLineSource[] = inPeriodMovements.map(movement => ({
      label: `${movement.kind === "draw" ? "سحب مالك" : "إرجاع مالك"} — دفتر المحفظة`,
      href: `/cash/wallet/${movement.walletId}`,
      amountMinor: movement.kind === "draw" ? movement.amountMinor : -movement.amountMinor,
    }));

    const cashIn: StatementLine[] = [
      {
        id: "order-collections",
        label: "قبض الطلبات (عربون وتحصيل)",
        amountMinor: orderCollectionsMinor,
        qualifier: "قبض لدين أو متبقٍ — ليس إيرادًا",
        sources: orderCollectionSources,
      },
      {
        id: "direct-sales-cash",
        label: "قبض البيع المباشر",
        amountMinor: directSalesCollectedMinor,
        qualifier: "كاش نقدي دخل بتاريخ البيع المسجل — لا إيرادًا عند التحصيل",
        sources: activeSalesInPeriod.map(sale => ({
          label: `بيع — ${sale.itemName || "بيع"}`,
          href: `/direct-sales/${sale.id}`,
          amountMinor: sale.collectedMinor,
        })),
      },
      {
        id: "owner-investment",
        label: "مال أدخلته للمشروع",
        amountMinor: investment.total,
        qualifier: "ليس إيرادًا",
        sources: investment.matched.map(event => ({
          label: event.note,
          href: `/finance?event=${encodeURIComponent(event.id)}`,
          amountMinor: event.amountMinor,
        })),
      },
      {
        id: "amanah-held",
        label: "أمانات قُبضت",
        amountMinor: amanahHeld.reduce((sum, event) => sum + event.amountMinor, 0),
        qualifier: "أمانات بأمانتك — كاش موجود، لكنه مش ربحك",
        sources: amanahHeld.map(event => ({
          label: event.note,
          href: `/finance?event=${encodeURIComponent(event.id)}`,
          amountMinor: event.amountMinor,
        })),
      },
      {
        id: "asset-disposal-cash",
        label: "متصل تخلص من أصل",
        amountMinor: assetDisposalReceived.total,
        qualifier: "مبلغ تخلص نقدي — ليس إيرادًا تشغيليًا",
        sources: assetDisposalReceived.matched.map(event => ({
          label: event.assetContext ? `تخلص — ${event.assetContext.name}` : event.note,
          href: event.assetContext ? `/assets/${event.assetContext.assetId}` : `/finance`,
          amountMinor: event.cashDeltaMinor,
        })),
      },
      {
        id: "loan-repaid-cash",
        label: "استرداد قروض",
        amountMinor: loanRepaid.total,
        qualifier: "رجوع مالك أقرضته — ليس إيرادًا",
        sources: loanRepaid.matched.map(event => ({
          label: event.loanContext ? `سداد — ${event.loanContext.borrower}` : event.note,
          href: event.loanContext ? `/loans/${event.loanContext.loanId}` : `/finance`,
          amountMinor: event.cashDeltaMinor,
        })),
      },
    ].filter(line => line.amountMinor !== 0);

    const cashOut: StatementLine[] = [
      {
        id: "expenses-paid",
        label: "مصاريف مدفوعة",
        amountMinor: -expensePaid.reduce((sum, event) => sum + event.amountMinor, 0),
        qualifier: null,
        sources: expensePaid.map(event => ({
          label: event.note,
          href: `/finance?event=${encodeURIComponent(event.id)}`,
          amountMinor: event.amountMinor,
        })),
      },
      {
        id: "payables-settled",
        label: "تسديد التزامات",
        amountMinor: -payableSettled.reduce((sum, event) => sum + event.amountMinor, 0),
        qualifier: null,
        sources: payableSettled.map(event => ({
          label: event.note,
          href: `/finance?event=${encodeURIComponent(event.id)}`,
          amountMinor: event.amountMinor,
        })),
      },
      {
        id: "owner-withdrawal",
        label: "سحب شخصي",
        amountMinor: withdrawal.total,
        qualifier: "ليس مصروفًا",
        sources: withdrawal.matched.map(event => ({
          label: event.note,
          href: `/finance?event=${encodeURIComponent(event.id)}`,
          amountMinor: event.amountMinor,
        })),
      },
      {
        id: "amanah-released",
        label: "أمانات سُلّمت",
        amountMinor: -amanahReleased.reduce((sum, event) => sum + event.amountMinor, 0),
        qualifier: "ليست خسارة",
        sources: amanahReleased.map(event => ({
          label: event.note,
          href: `/finance?event=${encodeURIComponent(event.id)}`,
          amountMinor: event.amountMinor,
        })),
      },
      {
        id: "supplier-payments",
        label: "دفع للموردين",
        amountMinor: -(supplierPurchasesInPeriodMinor + supplierPaymentsInPeriodMinor),
        qualifier: "شراء مواد — ليس مصروفًا حتى الاستهلاك",
        sources: supplierSources,
      },
      {
        id: "asset-purchase-cash",
        label: "شراء أصول (دفع نقدي)",
        amountMinor: assetPurchasePaid.total,
        qualifier: "أصل طويل الاستخدام — ليس مصروفًا",
        sources: assetPurchasePaid.matched.map(event => ({
          label: event.assetContext ? `شراء — ${event.assetContext.name}` : event.note,
          href: event.assetContext ? `/assets/${event.assetContext.assetId}` : `/finance`,
          amountMinor: event.cashDeltaMinor,
        })),
      },
      {
        id: "loan-given-cash",
        label: "قروض أعطيتها",
        amountMinor: loanGiven.total,
        qualifier: "قرض لشخص — ليس مصروفًا ولا سحبًا شخصيًا",
        sources: loanGiven.matched.map(event => ({
          label: event.loanContext ? `قرض — ${event.loanContext.borrower}` : event.note,
          href: event.loanContext ? `/loans/${event.loanContext.loanId}` : `/finance`,
          amountMinor: event.cashDeltaMinor,
        })),
      },
    ].filter(line => line.amountMinor !== 0);

    const cashNetMinor =
      cashIn.reduce((sum, line) => sum + line.amountMinor, 0) +
      cashOut.reduce((sum, line) => sum + line.amountMinor, 0) +
      correctionsNetMinor;

    /* المجموعة ١ (تصنيفي للمصاريف): تجميع مصاريف الفترة حسب وسم المالك —
     * مدفوعة ومستحقة معًا (كلاهما «وين راح المصروف»)؛ المصروف المشترك غير
     * الموزّع يظهر هنا لكنه لا يدخل النتيجة (دلتاه صفر) — التوضيح في سطر
     * الحقيقة داخل الكتلة. */
    const expenseCategoryEvents = activeEvents.filter(
      event =>
        (event.type === "operating_expense_cash" || event.type === "operating_expense_payable") &&
        familyEvent(event),
    );
    const unclassifiedKey = "__unclassified__";
    const categoryGroups = new Map<string, StatementExpenseCategoryLine[]>();
    for (const event of expenseCategoryEvents) {
      const key = event.expenseContext?.categoryLabel ?? unclassifiedKey;
      const lines = categoryGroups.get(key) ?? [];
      lines.push({
        eventId: event.id,
        occurredOn: event.occurredOn,
        note: event.note,
        amountMinor: event.amountMinor,
        kind: event.type === "operating_expense_cash" ? "paid" : "payable",
        href: `/finance?event=${encodeURIComponent(event.id)}`,
      });
      categoryGroups.set(key, lines);
    }
    const expenseCategories: readonly StatementExpenseCategoryGroup[] = [...categoryGroups.entries()]
      .map(([key, lines]) => ({
        label: key === unclassifiedKey ? "غير مصنّف" : key,
        classified: key !== unclassifiedKey,
        totalMinor: lines.reduce((sum, line) => sum + line.amountMinor, 0),
        lines,
      }))
      .sort((a, b) =>
        a.classified === b.classified ? b.totalMinor - a.totalMinor : a.classified ? -1 : 1,
      );

    const position = positionResult.value;
    const reading: StatementReading = {
      from,
      to,
      blocks: {
        cashIn,
        cashOut,
        corrections: { lines: cashCorrectionLines, netMinor: correctionsNetMinor },
        owner: {
          investedMinor: investment.total + ledgerInvestedMinor,
          withdrawnMinor: -withdrawal.total + ledgerWithdrawnMinor,
          sources: [
            ...investment.matched.map(event => ({
              label: event.note,
              href: `/finance?event=${encodeURIComponent(event.id)}`,
              amountMinor: event.amountMinor,
            })),
            ...withdrawal.matched.map(event => ({
              label: event.note,
              href: `/finance?event=${encodeURIComponent(event.id)}`,
              amountMinor: event.amountMinor,
            })),
            ...ownerMovementSources,
          ],
        },
        amanah: {
          heldInPeriodMinor: amanahHeld.reduce((sum, event) => sum + event.amountMinor, 0),
          releasedInPeriodMinor: amanahReleased.reduce((sum, event) => sum + event.amountMinor, 0),
          heldNowMinor: position.amanahHeldMinor,
          trustLine: `أمانات بأمانتك: ${formatMoneyWithUnit(position.amanahHeldMinor)} — هذا كاش موجود، لكنه مش ربحك ولا مالك.`,
        },
        receivablesPayables: {
          receivablesNowMinor: position.customerReceivablesMinor,
          payablesNowMinor: position.supplierPayablesMinor,
          collectionsInPeriodMinor: orderCollectionsMinor,
          payableEventsInPeriodMinor: activeEvents
            .filter(event => event.type === "operating_expense_payable")
            .reduce((sum, event) => sum + event.amountMinor, 0),
          supplierPurchasesInPeriodMinor,
          supplierPaymentsInPeriodMinor,
        },
      },
      result: periodResult.value,
      position,
      cashNetMinor,
      recognizedRevenueTotalMinor:
        periodResult.value.recognizedRevenueMinor + periodResult.value.directSaleRevenueMinor,
      expenseCategories,
      truthLines: [
        "الكاش ليس النتيجة: القبض يظهر أعلاه كحركة كاش، والإيراد يُعرف عند التسليم أو البيع.",
        `نطاق الكشف: من ${formatLocalDate(from) ?? from} إلى ${formatLocalDate(to) ?? to} — حسب تواريخ الحركات المسجلة لا وقت فتح الشاشة.`,
        "أي مجهول يبقى مجهولًا: لا يُعرض صفر مكان رقم لم يُدخل.",
        "صافي الكاش أعلاه لا يشمل أرصدة محافظ افتُتحت في الفترة ولا تسويات عدّ الصندوق — مصادرها في محافظ الكاش.",
        "«مصاريفي حسب تصنيفي» قراءة تجميعية لوسمك البشري: المستحق منها لم يُدفع بعد، والغير موزّع لا يدخل نتيجة الفترة حتى توزيعه.",
      ],
    };
    return { ok: true, value: reading };
  }
}
