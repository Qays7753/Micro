/**
 * المجموعة ٢ (§9.2 — StatementView): كشف فترة بسيط بالعربية — يفصل الكاش عن
 * النتيجة عن الأمانات عن الذمم عن مال المالك، ويصل كل سطر بمصدره. قراءة فقط
 * من السجلات القائمة؛ لا يُنشئ شيئًا ولا يعيد تفسير الماضي.
 */
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";
import type { DirectSale } from "@micro-domain/direct-sale/index.js";
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

export type StatementBlocks = {
  cashIn: readonly StatementLine[];
  cashOut: readonly StatementLine[];
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
  truthLines: readonly string[];
};

export type StatementResult =
  | { ok: true; value: StatementReading }
  | { ok: false; code: "storage_error" | "validation_error"; message: string };

const ammanDate = (timestamp: string): string => {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Amman",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const value = (type: string) => parts.find(part => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
};

const money = (minor: number) => `${(minor / 100).toFixed(2)} د.أ`;

export class StatementService {
  constructor(
    private readonly store: PrototypeLocalStore,
    private readonly projectFinance: ProjectFinancialService,
  ) {}

  async read(from: string, to: string): Promise<StatementResult> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to)
      return { ok: false, code: "validation_error", message: "اختر نطاق كشف يبدأ قبل نهايته." };
    const [eventsResult, salesResult, ordersResult, purchasesResult, periodResult, positionResult] =
      await Promise.all([
        this.store.listFinancialEvents(),
        this.store.listDirectSales(),
        this.store.listOrders(),
        this.store.listSupplierPurchases(),
        this.projectFinance.readRecordedPeriodResult(from, to),
        this.projectFinance.readPosition(),
      ]);
    if (
      !eventsResult.ok ||
      !salesResult.ok ||
      !ordersResult.ok ||
      !purchasesResult.ok ||
      !periodResult.ok ||
      !positionResult.ok
    )
      return { ok: false, code: "storage_error", message: "تعذر قراءة سجلات الكشف المحلية." };

    const inPeriod = (date: string) => date >= from && date <= to;
    const events = eventsResult.value as readonly FinancialEvent[];
    const activeEvents = events.filter(event => inPeriod(event.occurredOn));

    /* ١) قبض الطلبات (عربون + تحصيل) داخل الفترة — بتاريخ تسجيل القبضة. */
    const orderCollectionSources: StatementLineSource[] = [];
    let orderCollectionsMinor = 0;
    for (const stored of ordersResult.value as readonly StoredCraftOrder[]) {
      for (const event of stored.order.events) {
        if (event.type !== "collection_recorded" && event.type !== "deposit_collected") continue;
        const date = ammanDate(event.createdAt);
        if (!inPeriod(date)) continue;
        const amount = event.amountMinor ?? 0;
        if (amount <= 0) continue;
        orderCollectionsMinor += amount;
        orderCollectionSources.push({
          label: `${event.type === "deposit_collected" ? "عربون" : "تحصيل"} — ${stored.order.itemName || "طلب"}`,
          href: `/orders/${stored.id}`,
          amountMinor: amount,
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

    const cashEventLines = (types: readonly FinancialEvent["type"][]) => {
      /* أحداث التراجع تحمل نوع الأصل — تُستبعد هنا وتُحسب في كتلة التصحيحات وحدها
       * فلا يُحسب الأثر مرتين ولا يُطمس تصحيح وقع في الفترة. */
      const matched = activeEvents.filter(
        event => types.includes(event.type) && event.correctionType !== "reverse",
      );
      const total = matched.reduce((sum, event) => sum + event.cashDeltaMinor, 0);
      return { matched, total };
    };

    const investment = cashEventLines(["owner_investment_cash"]);
    const withdrawal = cashEventLines(["owner_withdrawal_cash"]);
    const amanahHeld = activeEvents.filter(
      event => event.type === "amanah_held_cash" && event.correctionType !== "reverse",
    );
    const amanahReleased = activeEvents.filter(
      event => event.type === "amanah_released_cash" && event.correctionType !== "reverse",
    );
    const expensePaid = activeEvents.filter(
      event => event.type === "operating_expense_cash" && event.correctionType !== "reverse",
    );
    const payableSettled = activeEvents.filter(
      event => event.type === "payable_settlement_cash" && event.correctionType !== "reverse",
    );

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
    }

    /* تصحيحات الكاش داخل الفترة: أحداث التراجع للكاش (بأنواع أصلها) — أثر موقّع
     * صافٍ يُعرض وحده فلا يُحسب مع عائلاته الأصلية ولا يُخفى. */
    const cashCorrectionEvents = activeEvents.filter(
      event =>
        event.correctionType === "reverse" &&
        (event.type === "owner_investment_cash" ||
          event.type === "owner_withdrawal_cash" ||
          event.type === "operating_expense_cash" ||
          event.type === "payable_settlement_cash" ||
          event.type === "amanah_held_cash" ||
          event.type === "amanah_released_cash"),
    );
    const correctionsNetMinor = cashCorrectionEvents.reduce(
      (sum, event) => sum + event.cashDeltaMinor,
      0,
    );

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
        qualifier: "يُنسب لتاريخ البيع المسجل",
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
    ].filter(line => line.amountMinor !== 0);

    const cashNetMinor =
      cashIn.reduce((sum, line) => sum + line.amountMinor, 0) +
      cashOut.reduce((sum, line) => sum + line.amountMinor, 0) +
      correctionsNetMinor;

    const position = positionResult.value;
    const reading: StatementReading = {
      from,
      to,
      blocks: {
        cashIn,
        cashOut,
        owner: {
          investedMinor: investment.total,
          withdrawnMinor: -withdrawal.total,
          sources: [...investment.matched, ...withdrawal.matched].map(event => ({
            label: event.note,
            href: `/finance?event=${encodeURIComponent(event.id)}`,
            amountMinor: event.amountMinor,
          })),
        },
        amanah: {
          heldInPeriodMinor: amanahHeld.reduce((sum, event) => sum + event.amountMinor, 0),
          releasedInPeriodMinor: amanahReleased.reduce((sum, event) => sum + event.amountMinor, 0),
          heldNowMinor: position.amanahHeldMinor,
          trustLine: `أمانات بأمانتك: ${money(position.amanahHeldMinor)} — هذا كاش موجود، لكنه مش ربحك ولا مالك.`,
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
      truthLines: [
        "الكاش ليس النتيجة: القبض يظهر أعلاه كحركة كاش، والإيراد يُعرف عند التسليم أو البيع.",
        `نطاق الكشف: من ${from} إلى ${to} — حسب تواريخ الحركات المسجلة لا وقت فتح الشاشة.`,
        "أي مجهول يبقى مجهولًا: لا يُعرض صفر مكان رقم لم يُدخل.",
        "صافي الكاش أعلاه لا يشمل أرصدة محافظ افتُتحت في الفترة ولا تسويات عدّ الصندوق — مصادرها في محافظ الكاش.",
      ],
    };
    return { ok: true, value: reading };
  }
}
