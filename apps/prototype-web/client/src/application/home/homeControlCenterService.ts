import type { AgreementContextService } from "@/application/agreements/agreementContextService";
import type { DailyFollowUpService } from "@/application/follow-up/dailyFollowUpService";
import type { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import type { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import type { SupplierPurchaseService } from "@/application/suppliers/supplierPurchaseService";
import type { ActivityService } from "@/application/activity/activityService";
import type { PrototypeLocalStore, StoredCraftOrder } from "@/storage/local/types";
import { formatMoneyMinor } from "@/presentation/formatters";
import { activityEffectLabel, activityFamilyLabel } from "@/presentation/activityLabels";

/* مبدأ Micro: جمع النص يشرح عدد المواعيد فقط؛ لا يغيّر قرار السعة أو حالة الموعد. */
import {
  buildHomeControlCenterViewModel,
  type HomeAction,
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
export class HomeControlCenterService {
  constructor(
    private readonly store: PrototypeLocalStore,
    private readonly dailyFollowUp: DailyFollowUpService,
    private readonly projectFinance: ProjectFinancialService,
    private readonly supplierPurchases: SupplierPurchaseService,
    private readonly inventory: InventoryMaterialService,
    private readonly agreementContext: AgreementContextService,
    private readonly activity: ActivityService,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async read(): Promise<HomeControlCenterResult> {
    const [
      profile,
      followUp,
      position,
      schedules,
      events,
      purchases,
      inventory,
      dueFollowUps,
      preferences,
      directSales,
    ] = await Promise.all([
      this.store.getProfile(),
      this.dailyFollowUp.read(),
      this.projectFinance.readPosition(),
      this.store.listSchedules(),
      this.store.listFinancialEvents(),
      this.supplierPurchases.readSummary(),
      this.inventory.overview(),
      this.agreementContext.dueFollowUps(),
      this.store.getPreferences(),
      this.store.listDirectSales(),
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
      !preferences.ok ||
      !directSales.ok ||
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
    /* §2.7: كل حقيقة غير مسجلة تعرض طريقها — «غير مسجل — سجّله (نقرة)» — لا «غير مهيأ» عاجزة. */
    const factRoads: Record<"cash" | "receivables" | "payables" | "owner_capital", HomeAction> = {
      cash: action("road-cash", "سجّله", "/cash/wallet/new", ""),
      receivables: action("road-receivables", "سجّله", "/orders", ""),
      payables: action("road-payables", "سجّله", "/finance/new/operating_expense_payable", ""),
      owner_capital: action("road-owner-capital", "سجّله", "/finance/new/owner_investment_cash", ""),
    };
    /* المجموعة ١ (§7.1): مؤهل الأمانات — الكاش المسجل يشمل أمانات ليست مالك ولا ربحًا. */
    const cashQualifier =
      positionValue.amanahHeldMinor > 0
        ? `منها أمانات بأمانتي ${formatMoneyMinor(positionValue.amanahHeldMinor)} د.أ — ليست مالك ولا ربحًا`
        : null;
    const facts: HomeFinancialFact[] = [
      {
        id: "cash",
        label: "الكاش المسجل",
        state: cashEvidence ? "known" : "not_initialized",
        valueMinor: cashEvidence ? positionValue.recordedCashMinor : null,
        currency: "JOD",
        qualifier: cashQualifier,
        source: null,
        period: null,
        helper: null,
        road: cashEvidence ? null : factRoads.cash,
      },
      {
        id: "receivables",
        label: "لي عند العملاء",
        state: orderEvidence ? "known" : "not_initialized",
        valueMinor: orderEvidence ? positionValue.customerReceivablesMinor : null,
        currency: "JOD",
        qualifier: null,
        source: null,
        period: null,
        helper: null,
        road: orderEvidence ? null : factRoads.receivables,
      },
      {
        id: "payables",
        label: "عليّ للموردين",
        state: payableEvidence ? "known" : "not_initialized",
        valueMinor: payableEvidence ? positionValue.supplierPayablesMinor : null,
        currency: "JOD",
        qualifier: null,
        source: null,
        period: null,
        helper: null,
        road: payableEvidence ? null : factRoads.payables,
      },
      {
        id: "owner_capital",
        label: "مال المالك المسجل",
        state: capitalEvidence ? "known" : "not_initialized",
        valueMinor: capitalEvidence ? positionValue.ownerCapitalRecordedMinor : null,
        currency: "JOD",
        qualifier: null,
        /* المجموعة ٦ (البند ٢): الحالة المعروفة تفتح الدفتر الموحد «مال المالك» —
         * الحقيقة المعروفة لها وجه تنقّل، والطريق يبقى للتسجيل الأول. */
        source: capitalEvidence ? "/finance/owner-entitlement" : null,
        period: null,
        helper: null,
        road: capitalEvidence ? null : factRoads.owner_capital,
      },
    ];
    /* المجموعة ١ (§7.1): الكاش غير الموزع يظهر عند وجوده فقط — قبض لم يُنسب لمحفظة؛
     * الصفر أو الغياب لا بطاقة له. */
    if (cashEvidence && positionValue.unallocatedCashMinor !== 0) {
      facts.push({
        id: "unallocated",
        label: "كاش غير موزع",
        state: "known",
        valueMinor: positionValue.unallocatedCashMinor,
        currency: "JOD",
        qualifier: positionValue.unallocatedCashMinor < 0 ? "فرق سالب — راجع مصدره" : null,
        source: null,
        period: null,
        helper: null,
        road: null,
      });
    }

    /* دمج بند ١٠ (قرار المالك): «اليوم» يستوعب ما كان في «ما يحتاج فعلًا الآن» —
     * لا إلغاء ولا تكرار: كل مسودة ودين وتكلفة ونتيجة وطلب وسعة بندٌ واحد هنا،
     * والمتابعة والدين يُبنيان مرة واحدة من مصدرهما (لا من القسمين معًا). */
    const todayItems: HomeTodayItem[] = [];
    openDrafts.forEach(draft =>
      todayItems.push({
        id: `today-draft:${draft.id}`,
        kind: "draft",
        title: `مسودة: ${draft.itemName || "بلا وصف"}`,
        detail: null,
        dateLocal: draft.updatedAt.slice(0, 10),
        timeLocal: null,
        href: `/orders/draft/${draft.id}`,
        /* المجموعة ١ (§7.1): أفعال محددة لا «افتح» العامة. */
        actionLabel: "أكمل",
        priority: 10,
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
        todayItems.push({
          id: `today-due-amount:${stored.id}`,
          kind: "due_amount",
          title: `دين: ${stored.order.itemName || "طلب"}`,
          detail: `${formatMoneyMinor(stored.order.receivableMinor)} د.أ`,
          dateLocal: null,
          timeLocal: null,
          /* المجموعة ٢ (§6.3): بند الدين يفتح ورقة التحصيل في نقرة واحدة — لا قائمة عامة. */
          href: `/collect?source=order:${stored.id}`,
          actionLabel: "حصّل",
          priority: 15,
        }),
      );
    /* المجموعة ٢ (§6.3): ديون البيع الآجل بند تحصيل كأخواتها — لا تختفي لأنها ليست
     * من طلب؛ ورقة التحصيل نفسها تكتبها عبر مسارها الصحيح. */
    directSales.value
      .filter(
        sale =>
          (sale.status ?? "active") === "active" &&
          sale.collectionStatus === "partial_debt" &&
          sale.revenueMinor - sale.collectedMinor > 0,
      )
      .forEach(sale =>
        todayItems.push({
          id: `today-due-amount:${sale.id}`,
          kind: "due_amount",
          title: `دين بيع: ${sale.itemName || "بيع"}`,
          detail: `${formatMoneyMinor(sale.revenueMinor - sale.collectedMinor)} د.أ`,
          dateLocal: null,
          timeLocal: null,
          href: `/collect?source=sale:${sale.id}`,
          actionLabel: "حصّل",
          priority: 15,
        }),
      );
    orders.filter(isOpenOrder).forEach(stored => {
      if (hasIncompleteCost(stored)) {
        todayItems.push({
          id: `today-cost:${stored.id}`,
          kind: "cost_incomplete",
          title: `أكمل تكلفة ${stored.order.itemName || "الطلب"}`,
          detail: null,
          dateLocal: null,
          timeLocal: null,
          href: `/orders/${stored.id}`,
          actionLabel: "أكمل",
          priority: 20,
        });
      } else {
        todayItems.push({
          id: `today-order:${stored.id}`,
          kind: "open_order",
          title: stored.order.itemName || "طلب",
          detail: stored.order.nextAction,
          dateLocal: stored.deliveryDate ?? null,
          timeLocal: null,
          href: `/orders/${stored.id}`,
          /* المجموعة ١: الجاهز للتسليم «سلّم»، وغيره «راجع» — فعل يطابق الخطوة التالية. */
          actionLabel: stored.order.status === "ready" ? "سلّم" : "راجع",
          priority: 30,
        });
      }
    });
    orders
      .filter(stored => !isOpenOrder(stored) && hasIncompleteResult(stored))
      .forEach(stored =>
        todayItems.push({
          id: `today-result-review:${stored.id}`,
          kind: "result_review",
          title: `راجع نتيجة ${stored.order.itemName || "الطلب"}`,
          detail: null,
          dateLocal: null,
          timeLocal: null,
          href: `/orders/${stored.id}`,
          actionLabel: "راجع",
          priority: 20,
        }),
      );
    dueFollowUps.value.due.forEach(stored =>
      todayItems.push({
        id: `today-follow-up:${stored.id}`,
        kind: "follow_up_due",
        title: `متابعة مستحقة: ${stored.order.itemName || "بلا وصف"}`,
        detail: stored.followUpSummary ?? stored.followUpReason ?? null,
        dateLocal: stored.followUpDate ?? null,
        timeLocal: null,
        href: `/orders/${stored.id}`,
        actionLabel: "راجع",
        priority: 25,
      }),
    );
    schedules.value
      .filter(
        schedule => ["scheduled", "postponed"].includes(schedule.status) && schedule.scheduledFor === today,
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
          actionLabel: "سلّم",
          priority: 25,
        });
      });
    const activeSchedules = schedules.value.filter(schedule =>
      ["scheduled", "postponed"].includes(schedule.status),
    );
    if (activeSchedules.length > 0) {
      const capacity = activeSchedules.filter(schedule => schedule.scheduledFor === today).length;
      if (capacity > 1)
        todayItems.push({
          id: "today-capacity:today",
          kind: "capacity_warning",
          title: `مواعيد اليوم: ${capacity}`,
          detail: null,
          dateLocal: today,
          timeLocal: null,
          /* المجموعة ١: وصلة عميقة تفتح قراءة السعة نفسها لا الصفحة العامة. */
          href: "/schedule?focus=capacity",
          actionLabel: "راجع",
          priority: 40,
        });
    }
    const upcoming = dueFollowUps.value.upcoming;
    const todaySection: HomeTodaySection = {
      items: todayItems,
      upcomingCount: upcoming.length,
      nextUpcomingDate: upcoming[0]?.followUpDate ?? null,
      nextUpcomingHref: upcoming[0] ? `/orders/${upcoming[0].id}` : null,
      truth: null,
    };

    /* القرار ١١: تُفكّ المالية كلها. الوحدة الدائمة تفتح المسارين: مالي ← المحافظ والموردون
     * والمواد ودفتر المالك، بلا شرط بيانات وبلا نقل أي قدرة (§2.1 من وثيقة التوزيع). */
    const financeUnit = {
      action: action("finance", "افتح", "/finance", ""),
      truth: null,
    };
    /* قرار المالك على بند ١١: «منتجاتي وخدماتي» كتلة دائمة مستقلة مثل «مالي» —
     * سؤالها (§2.3): ما أكرره وبكم؟ وهل هو رابح؟ */
    const catalogUnit = {
      action: action("catalog", "افتح", "/catalog", ""),
      truth: null,
    };

    /* قرار المالك على بند ١٢: بطاقتا المخزون والموردين المشروطتان أُزيلتا —
     * المسار الدائم عبر «مالي» يكفي. القسم القديم يبقى صادقًا على ما تحته:
     * مسارات مرتبطة ببياناتها فقط (الجدول ونتيجة الفترة). */
    const optionalModules: HomeOptionalModule[] = [
      {
        id: "schedule",
        label: "المواعيد",
        state: schedules.value.length > 0 ? "available" : orders.length > 0 ? "needs_setup" : "empty",
        action: action("schedule", "افتح", "/schedule", ""),
      },
      {
        id: "period_result",
        label: "نتيجة الفترة",
        state:
          orders.some(stored => ["delivered", "settled"].includes(stored.order.status)) ||
          events.value.length > 0
            ? "available"
            : "empty",
        action: action("period-result", "افتح", "/finance", ""),
      },
    ];

    /* المجموعة ٥ (عقد ٣٠): «آخر ما حدث» يُبنى من القارئ الموحّد وحده — قراءة
     * واحدة لكل العائلات مع كلمة أثر ورابط مصدر لكل صف؛ لا قصّات منفصلة بعد
     * اليوم (الأحداث وحدها/المواعيد المستقبلية/مسودة بلا أثر). عائلة المحفظة
     * تُستثنى من نافذة الرئيس (دفتر المحفظة أبوابها في «مالي»). */
    const activityRead = await this.activity.read({ limit: 5, perFamilyLimit: 3 });
    const recentChanges: HomeRecentChange[] = activityRead.ok
      ? activityRead.value.map(record => ({
          id: record.id,
          occurredOn: record.occurredOn ?? record.recordedAt.slice(0, 10),
          title: activityFamilyLabel[record.family],
          detail: record.detail,
          href: record.sourceHref,
          effectWord: activityEffectLabel[record.effect],
          amountMinor: record.amountMinor,
        }))
      : [];

    /* «أثناء غيابك» (التدفق ٢٣): تظهر بعد ٧ أيام بلا تسجيل، وتختفي بالنشاط.
     * تذكير النسخة (P-01 طبقة ١): بعد ٧ أيام من آخر تصدير مُتحقق مع وجود بيانات.
     * U-002 (دورة التدقيق النهائي): «آخر تسجيل» يُحسب من أوقات التسجيل الفعلية
     * (recordedAt/createdAt/updatedAt) — لا من تواريخ الأثر (occurredOn) ولا من
     * المواعيد المستقبلية (scheduledFor): قيدٌ مؤرَّخ لا يوهم غيابًا، وموعدٌ قادم
     * لا يخفي البطاقة، والبيع المباشر تسجيلٌ كغيره فلا تناقض داخل البطاقة. */
    const recordedActivityDates = [
      ...orders.map(stored => localDate(stored.updatedAt)),
      ...openDrafts.map(draft => localDate(draft.updatedAt)),
      ...events.value.map(event => localDate(event.recordedAt)),
      ...directSales.value.map(sale => localDate(sale.recordedAt)),
      ...schedules.value.map(schedule => localDate(schedule.updatedAt)),
    ].sort((left, right) => right.localeCompare(left));
    const lastActivityDate = recordedActivityDates[0] ?? null;
    const daysSinceLastActivity = lastActivityDate
      ? Math.max(
          0,
          Math.round(
            (Date.parse(`${today}T12:00:00.000Z`) - Date.parse(`${lastActivityDate}T12:00:00.000Z`)) /
              86_400_000,
          ),
        )
      : null;
    const lastExport = preferences.value?.lastVerifiedExportAt ?? null;
    const daysSinceLastExport = lastExport
      ? Math.max(
          0,
          Math.round(
            (Date.parse(`${today}T12:00:00.000Z`) - Date.parse(lastExport.slice(0, 10))) / 86_400_000,
          ),
        )
      : null;
    const hasAnyData =
      recentChanges.length > 0 || positionValue.cashWalletCount > 0 || positionValue.projectEventCount > 0;
    const awaySection =
      daysSinceLastActivity !== null && daysSinceLastActivity >= 7 && hasAnyData
        ? {
            daysSinceLastActivity,
            overdueDebtCount: orders.filter(
              stored =>
                stored.order.settlementStatus === "debt" &&
                stored.order.receivableMinor > 0 &&
                stored.followUpDate != null &&
                stored.followUpDate < today,
            ).length,
            daysSinceLastExport,
            /* U-002 (دورة التدقيق النهائي): الملخص الصادق الوحيد الممكن لبطاقة الغياب
             * هو «آخر يوم تسجيل» — ماذا دوّن المالك في آخر جلسة تسجيل فعلية؟ لا شيء
             * يتحرك «خلال» الغياب نفسه في تطبيق محلي أحادي المستخدم، فالملخص يصف آخر
             * جلسة صادقًا بأرقام مشتقة من البيانات لا من التوقعات. */
            digest: (() => {
              const lastDay = lastActivityDate ?? today;
              const activeSales = directSales.value.filter(
                sale => (sale.status ?? "active") === "active" && localDate(sale.recordedAt) === lastDay,
              );
              const expenseEvents = events.value.filter(
                event =>
                  event.operatingExpenseDeltaMinor > 0 &&
                  event.correctionType !== "reverse" &&
                  localDate(event.recordedAt) === lastDay,
              );
              return {
                lastRecordedOn: lastDay,
                salesCount: activeSales.length,
                salesRevenueMinor: activeSales.reduce((total, sale) => total + sale.revenueMinor, 0),
                expenseCount: expenseEvents.length,
                expenseMinor: expenseEvents.reduce(
                  (total, event) => total + event.operatingExpenseDeltaMinor,
                  0,
                ),
                newOrderCount: orders.filter(stored => localDate(stored.order.createdAt) === lastDay).length,
                upcomingFollowUpCount: dueFollowUps.value.upcoming.filter(
                  stored => stored.followUpDate != null,
                ).length,
              };
            })(),
          }
        : null;
    /* O-001: تذكير النسخة الدوري اختياري — افتراضيًا مفعّل (السلوك القائم)، وإطفاؤه
     * من الإعدادات يخفي سطر التذكير فقط، لا عمر النسخة في بطاقة الغياب. */
    const backupReminderEnabled = preferences.value?.backupReminderEnabled ?? true;
    const backupReminderDue =
      backupReminderEnabled && hasAnyData && (daysSinceLastExport === null || daysSinceLastExport >= 7);

    return {
      ok: true,
      value: buildHomeControlCenterViewModel({
        activityName: profile.value.activityName,
        todayLocal: today,
        truthLine: backupReminderDue
          ? "بياناتك على هذا الجهاز فقط — انسخ نسخة احتياطية من الإعدادات لتصبح جاهزة للطوارئ."
          : null,
        financeUnit,
        catalogUnit,
        todaySection,
        facts,
        optionalModules,
        recentChanges,
        awaySection,
      }),
    };
  }
}
