import type { AgreementContextService } from "@/application/agreements/agreementContextService";
import type { DailyFollowUpService } from "@/application/follow-up/dailyFollowUpService";
import type { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import type { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import type { SupplierPurchaseService } from "@/application/suppliers/supplierPurchaseService";
import type { PrototypeLocalStore, StoredCraftOrder } from "@/storage/local/types";
import { formatArabicPlural, formatLocalDateLong, formatMoneyMinor } from "@/presentation/formatters";

/* مبدأ Micro: جمع النص يشرح عدد المواعيد فقط؛ لا يغيّر قرار السعة أو حالة الموعد. */
import {
  buildHomeControlCenterViewModel,
  type HomeAction,
  type HomeAttentionItem,
  type HomeControlCenterViewModel,
  type HomeFinancialFact,
  type HomeOptionalModule,
  type HomeRecentChange,
  type HomeTodayItem,
  type HomeTodaySection,
} from "./homeControlCenterModel";

export type HomeControlCenterResult =
  { ok: true; value: HomeControlCenterViewModel } | { ok: false; code: "storage_error"; message: string };

function localDate(iso: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Amman",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function action(id: string, label: string, href: string, reason: string) {
  return { id, label, href, reason };
}
function isOpenOrder(stored: StoredCraftOrder) {
  return !["delivered", "settled", "cancelled"].includes(stored.order.status);
}
function hasIncompleteCost(stored: StoredCraftOrder) {
  return stored.order.costSnapshot.knowledgeState !== "known";
}
function hasIncompleteResult(stored: StoredCraftOrder) {
  return !["cancelled"].includes(stored.order.status) && stored.order.resultStatus !== "final";
}
function orderChange(stored: StoredCraftOrder): HomeRecentChange {
  return {
    id: `order:${stored.id}`,
    occurredOn: stored.updatedAt.slice(0, 10),
    title: `طلب: ${stored.order.itemName || "طلب بلا وصف"}`,
    detail: stored.order.nextAction,
    href: `/orders/${stored.id}`,
  };
}

export class HomeControlCenterService {
  constructor(
    private readonly store: PrototypeLocalStore,
    private readonly dailyFollowUp: DailyFollowUpService,
    private readonly projectFinance: ProjectFinancialService,
    private readonly supplierPurchases: SupplierPurchaseService,
    private readonly inventory: InventoryMaterialService,
    private readonly agreementContext: AgreementContextService,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async read(): Promise<HomeControlCenterResult> {
    const [profile, followUp, position, schedules, events, purchases, inventory, dueFollowUps] =
      await Promise.all([
        this.store.getProfile(),
        this.dailyFollowUp.read(),
        this.projectFinance.readPosition(),
        this.store.listSchedules(),
        this.store.listFinancialEvents(),
        this.supplierPurchases.readSummary(),
        this.inventory.overview(),
        this.agreementContext.dueFollowUps(),
      ]);
    if (
      !profile.ok ||
      !followUp.ok ||
      !position.ok ||
      !schedules.ok ||
      !events.ok ||
      !purchases.ok ||
      !inventory.ok ||
      !dueFollowUps.ok ||
      !profile.value
    )
      return { ok: false, code: "storage_error", message: "تعذر قراءة بيانات مشروعك المحلية." };

    const today = localDate(this.now());
    const orders = followUp.orders;
    const openDrafts = followUp.drafts;
    const positionValue = position.value;
    const orderEvidence =
      orders.length > 0 ||
      positionValue.orderCollectionsMinor !== 0 ||
      positionValue.customerReceivablesMinor !== 0;
    const financeEvidence = positionValue.projectEventCount > 0;
    const cashEvidence =
      financeEvidence ||
      positionValue.orderCollectionsMinor !== 0 ||
      positionValue.supplierPurchaseCount > 0 ||
      positionValue.cashWalletCount > 0;
    const capitalEvidence = events.value.some(
      event => event.type === "owner_investment_cash" || event.type === "owner_withdrawal_cash",
    );
    const payableEvidence =
      positionValue.supplierPurchaseCount > 0 ||
      events.value.some(
        event => event.type === "operating_expense_payable" || event.type === "payable_settlement_cash",
      );
    const period = `حتى ${formatLocalDateLong(today) ?? today}`;
    /* §2.7: كل حقيقة غير مسجلة تعرض طريقها — «غير مسجل — سجّله (نقرة)» — لا «غير مهيأ» عاجزة. */
    const factRoads: Record<HomeFinancialFact["id"], HomeAction> = {
      cash: action("road-cash", "سجّله", "/cash/wallet/new", "محفظة ورصيد بداية"),
      receivables: action("road-receivables", "سجّله", "/orders", "الدين يسجل من طلب بعد تسليمه"),
      payables: action(
        "road-payables",
        "سجّله",
        "/finance/new/operating_expense_payable",
        "سجل التزامًا لمورد",
      ),
      owner_capital: action(
        "road-owner-capital",
        "سجّله",
        "/finance/new/owner_investment_cash",
        "سجل استثمارًا",
      ),
    };
    const facts: HomeFinancialFact[] = [
      {
        id: "cash",
        label: "الكاش المسجل",
        state: cashEvidence ? "known" : "not_initialized",
        valueMinor: cashEvidence ? positionValue.recordedCashMinor : null,
        currency: "JOD",
        source: "السجل المحلي",
        period,
        helper: "يشمل ما سُجل من محافظ وكاش الطلبات والأحداث؛ ليس ربحًا.",
        road: cashEvidence ? null : factRoads.cash,
      },
      {
        id: "receivables",
        label: "لي عند العملاء",
        state: orderEvidence ? "known" : "not_initialized",
        valueMinor: orderEvidence ? positionValue.customerReceivablesMinor : null,
        currency: "JOD",
        source: "طلبات محلية مسجلة",
        period,
        helper: "دين عميل مسجل، وليس كاشًا محصلًا.",
        road: orderEvidence ? null : factRoads.receivables,
      },
      {
        id: "payables",
        label: "عليّ للموردين",
        state: payableEvidence ? "known" : "not_initialized",
        valueMinor: payableEvidence ? positionValue.supplierPayablesMinor : null,
        currency: "JOD",
        source: "أحداث المصروف وشراء المواد",
        period,
        helper: "التزام مسجل، وليس دفعة كاش جديدة.",
        road: payableEvidence ? null : factRoads.payables,
      },
      {
        id: "owner_capital",
        label: "مال المالك المسجل",
        state: capitalEvidence ? "known" : "not_initialized",
        valueMinor: capitalEvidence ? positionValue.ownerCapitalRecordedMinor : null,
        currency: "JOD",
        source: "أحداث مالية عامة",
        period,
        helper: "استثمار/سحب مسجل؛ لا يتحول إلى بيع أو مصروف.",
        road: capitalEvidence ? null : factRoads.owner_capital,
      },
    ];

    const attention: HomeAttentionItem[] = [];
    openDrafts.forEach(draft =>
      attention.push({
        id: `draft:${draft.id}`,
        priority: 10,
        kind: "draft",
        title: draft.itemName || "مسودة تحتاج وصفًا",
        reason: "مسودة محلية لم تتحول إلى اتفاق بعد.",
        action: action(
          `draft:${draft.id}`,
          "استئناف المسودة",
          `/orders/draft/${draft.id}`,
          "أكمل ما تعرفه ثم احفظه.",
        ),
      }),
    );
    orders.filter(isOpenOrder).forEach(stored => {
      if (hasIncompleteCost(stored)) {
        attention.push({
          id: `cost:${stored.id}`,
          priority: 20,
          kind: "cost",
          title: `أكمل تكلفة ${stored.order.itemName || "الطلب"}`,
          reason: "نسخة التكلفة غير مكتملة؛ لا تُعرض نتيجة نهائية مكتملة المعرفة.",
          action: action(
            `cost:${stored.id}`,
            "مراجعة الطلب",
            `/orders/${stored.id}`,
            "راجع البنود الناقصة قبل الاعتماد.",
          ),
        });
      } else {
        attention.push({
          id: `order:${stored.id}`,
          priority: 30,
          kind: "order",
          title: stored.order.itemName || "طلب قيد المتابعة",
          reason: stored.order.nextAction,
          action: action(
            `order:${stored.id}`,
            "فتح الطلب",
            `/orders/${stored.id}`,
            "أكمل الخطوة التالية الظاهرة في الطلب.",
          ),
        });
      }
    });
    orders
      .filter(stored => !isOpenOrder(stored) && hasIncompleteResult(stored))
      .forEach(stored =>
        attention.push({
          id: `result-review:${stored.id}`,
          priority: 20,
          kind: "result_review",
          title: `راجع نتيجة ${stored.order.itemName || "الطلب"}`,
          reason: "نتيجة الطلب غير مكتملة؛ راجع التكلفة أو الوقت قبل الاعتماد على رقم نهائي.",
          action: action(
            `result-review:${stored.id}`,
            "مراجعة النتيجة",
            `/orders/${stored.id}`,
            "افتح الطلب وراجع ما ينقص النتيجة.",
          ),
        }),
      );
    orders
      .filter(
        stored =>
          stored.order.settlementStatus === "debt" &&
          stored.order.receivableMinor > 0 &&
          !["cancelled"].includes(stored.order.status),
      )
      .forEach(stored =>
        attention.push({
          id: `debt:${stored.id}`,
          priority: 15,
          kind: "debt",
          title: `دين مسجل: ${stored.order.itemName || "طلب"}`,
          reason: "الدين مسجل بعد التسليم وليس كاشًا محصلًا.",
          action: action(
            `debt:${stored.id}`,
            "مراجعة الدين",
            `/orders/${stored.id}`,
            "راجع التحصيل أو الدين المسجل.",
          ),
        }),
      );
    orders
      .filter(
        stored =>
          stored.followUpDate &&
          stored.followUpDate <= today &&
          !["settled", "cancelled"].includes(stored.order.status),
      )
      .forEach(stored =>
        attention.push({
          id: `follow-up:${stored.id}`,
          priority: 25,
          kind: "follow_up",
          title: `متابعة: ${stored.order.itemName || "طلب"}`,
          reason: stored.followUpSummary || "يوجد موعد متابعة محفوظ لهذا الطلب.",
          action: action(
            `follow-up:${stored.id}`,
            "فتح المتابعة",
            `/orders/${stored.id}`,
            "راجع المتابعة المسجلة دون اختراع موعد جديد.",
          ),
        }),
      );
    const activeSchedules = schedules.value.filter(schedule =>
      ["scheduled", "postponed"].includes(schedule.status),
    );
    if (activeSchedules.length > 0) {
      const capacity = activeSchedules.filter(schedule => schedule.scheduledFor === today).length;
      if (capacity > 1)
        attention.push({
          id: "capacity:today",
          priority: 40,
          kind: "capacity",
          title: "راجع ازدحام مواعيد اليوم",
          reason: `يوجد ${formatArabicPlural(capacity, {
            zero: "لا مواعيد تشغيلية",
            one: "موعد واحد تشغيلي",
            two: "موعدان تشغيليان",
            few: "مواعيد تشغيلية",
            many: "موعدًا تشغيليًا",
            other: "موعد تشغيلي",
          })} اليوم؛ السعة تحذير فقط، وليست رفضًا تلقائيًا.`,
          action: action("capacity:today", "فتح الجدول", "/schedule", "راجع التوقيت والسعة المعلنة."),
        });
    }

    const criticalAttention = attention
      .filter(item => item.kind === "cost" || item.kind === "debt" || item.kind === "result_review")
      .sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id, "ar"))[0];
    const primary = criticalAttention
      ? criticalAttention.action
      : action(
          `primary:${followUp.followUp.kind}`,
          followUp.followUp.actionLabel,
          followUp.followUp.href,
          followUp.followUp.nextAction,
        );
    /* القرار ١١: تُفكّ المالية كلها. الوحدة الدائمة تفتح المسارين: مالي ← المحافظ والموردون
     * والمواد ودفتر المالك، بلا شرط بيانات وبلا نقل أي قدرة (§2.1 من وثيقة التوزيع). */
    const financeUnit = {
      action: action(
        "finance",
        "افتح مالي",
        "/finance",
        "قراءة يومية دائمة: كم عندي الآن ومن أين.",
      ),
      truth:
        "المحافظ والموردون والمواد ودفتر المالك على مسارين من فتح التطبيق؛ ونتيجة الفترة تظهر في وحدتها حين توجد نتيجة.",
    };

    /* قسم «اليوم» — موطن F-078 (رحلة ٢): متابعات مستحقة ومواعيد اليوم وديون
     * مستحقة، بلا إنشاء موعد أو تحصيل. الحالة الفارغة صادقة: «لا متابعات بعد». */
    const todayItems: HomeTodayItem[] = [];
    dueFollowUps.value.due.forEach(stored =>
      todayItems.push({
        id: `today-follow-up:${stored.id}`,
        kind: "follow_up_due",
        title: `متابعة مستحقة: ${stored.order.itemName || "طلب بلا وصف"}`,
        detail: stored.followUpSummary ?? stored.followUpReason ?? null,
        dateLocal: stored.followUpDate ?? null,
        timeLocal: null,
        href: `/orders/${stored.id}`,
        actionLabel: "فتح المتابعة",
      }),
    );
    schedules.value
      .filter(
        schedule =>
          ["scheduled", "postponed"].includes(schedule.status) && schedule.scheduledFor === today,
      )
      .forEach(schedule => {
        const linkedOrder = orders.find(candidate => candidate.id === schedule.orderId);
        todayItems.push({
          id: `today-appointment:${schedule.id}`,
          kind: "appointment_today",
          title: `موعد اليوم: ${linkedOrder?.order.itemName || "موعد تسليم"}`,
          detail: linkedOrder ? linkedOrder.order.nextAction : null,
          dateLocal: schedule.scheduledFor,
          timeLocal: schedule.scheduledTime,
          href: `/schedule/${schedule.id}`,
          actionLabel: "فتح الموعد",
        });
      });
    orders
      .filter(
        stored =>
          stored.order.settlementStatus === "debt" &&
          stored.order.receivableMinor > 0 &&
          !["cancelled"].includes(stored.order.status),
      )
      .forEach(stored =>
        todayItems.push({
          id: `today-due-amount:${stored.id}`,
          kind: "due_amount",
          title: `مستحق عليك متابعته: ${stored.order.itemName || "طلب"}`,
          detail: `دين مسجل: ${formatMoneyMinor(stored.order.receivableMinor)} د.أ — دين لا كاش محصل.`,
          dateLocal: null,
          timeLocal: null,
          href: `/orders/${stored.id}`,
          actionLabel: "مراجعة الدين",
        }),
      );
    const upcoming = dueFollowUps.value.upcoming;
    const todaySection: HomeTodaySection = {
      items: todayItems,
      upcomingCount: upcoming.length,
      nextUpcomingDate: upcoming[0]?.followUpDate ?? null,
      nextUpcomingHref: upcoming[0] ? `/orders/${upcoming[0].id}` : null,
      truth: "قراءة صباحية من سجلاتك: متابعات ومواعيد وديون مستحقة. لا تنشئ موعدًا ولا تحصيلًا.",
    };
    const optionalModules: HomeOptionalModule[] = [
      {
        id: "inventory",
        label: "المادة والمخزون",
        state:
          inventory.value.materials.length > 0 || inventory.value.movementCount > 0 ? "available" : "empty",
        action: action("inventory", "فتح المخزون", "/inventory", inventory.value.truth),
      },
      {
        id: "schedule",
        label: "جدول المواعيد",
        state: schedules.value.length > 0 ? "available" : orders.length > 0 ? "needs_setup" : "empty",
        action: action(
          "schedule",
          schedules.value.length > 0 ? "فتح الجدول" : "إعداد الجدول",
          "/schedule",
          "الجدول تشغيلي ولا ينشئ أثرًا ماليًا.",
        ),
      },
      {
        id: "supplier_commitments",
        label: "التزامات الموردين",
        state: purchases.value.purchaseCount > 0 ? "available" : "empty",
        action: action("suppliers", "فتح الموردين", "/suppliers", purchases.value.truth),
      },
      {
        id: "period_result",
        label: "نتيجة الفترة",
        state:
          orders.some(stored => ["delivered", "settled"].includes(stored.order.status)) ||
          events.value.length > 0
            ? "available"
            : "empty",
        action: action(
          "period-result",
          "فتح الوضع المالي",
          "/finance",
          "نتيجة مسجلة محدودة وليست صافي ربح للمشروع.",
        ),
      },
    ];

    const recentChanges: HomeRecentChange[] = [
      ...orders.map(orderChange),
      ...openDrafts.map(draft => ({
        id: `draft:${draft.id}`,
        occurredOn: draft.updatedAt.slice(0, 10),
        title: `مسودة: ${draft.itemName || "بلا وصف"}`,
        detail: "مسودة محلية محفوظة.",
        href: `/orders/draft/${draft.id}`,
      })),
      ...events.value.map(event => ({
        id: `finance:${event.id}`,
        occurredOn: event.occurredOn,
        title: `حدث مالي: ${event.note || event.type}`,
        detail: "حدث مالي مسجل؛ راجع مصدره وسياقه.",
        href: "/finance",
      })),
      ...schedules.value.map(schedule => ({
        id: `schedule:${schedule.id}`,
        occurredOn: schedule.scheduledFor,
        title: `موعد: ${formatLocalDateLong(schedule.scheduledFor) ?? schedule.scheduledFor}`,
        detail: schedule.status === "completed" ? "موعد مكتمل مستبعد من التشغيل." : "موعد تشغيلي محفوظ.",
        href: "/schedule",
      })),
    ].sort(
      (left, right) => right.occurredOn.localeCompare(left.occurredOn) || left.id.localeCompare(right.id),
    );

    return {
      ok: true,
      value: buildHomeControlCenterViewModel({
        activityName: profile.value.activityName,
        todayLocal: today,
        truthLine:
          "هذه قراءة محلية مشتقة من سجلات Micro القائمة. لا تحول الرقم إلى ربح مشروع ولا تستبدل الصفحات التفصيلية.",
        primaryAction: primary,
        financeUnit,
        todaySection,
        facts,
        attention,
        optionalModules,
        recentChanges,
      }),
    };
  }
}
