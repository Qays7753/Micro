/**
 * UNIT-003 (تنفيذ S16 بالأمر الموحد §4): قارئ الرئيسية — قراءة واحدة تُجمَّع
 * في Promise.all فوق المصادر الكنونية القائمة فقط:
 * - الهوية والاسم من المخزن (getProfile) وتاريخ اليوم من عقد وقت الأعمال.
 * - لمحة المالية من القارئ الكنوني للفترة نفسه (readRecordedPeriodResult
 *   لليوم والشهر) والنقد المسجل الآن من قراءة الوضع (readPosition) — لا
 *   قارئ ثانٍ ولا معادلة في الواجهة (المبيعات بالتعريف الرسمي نفسه الذي
 *   يعرضه كشف الفترة: إيراد الطلبات المحتسب + البيع المباشر).
 * - متابعتك من القارئ الموحد للمتابعة (S13) + مسودات الإكمال من قراءة
 *   اليوم القائمة (HOME-X03: الامتداد الكامل للمسودة/التكلفة عند القارئ
 *   المشترك بابه لاحقًا؛ العرض القديم اللازم لا يُحذف).
 * - حالة النسخة المتحققة من التفضيلات (044 عبر 038) — لا تاريخ نسخة ناجحة
 *   من مجرد بدء تنزيل.
 * الفتح والقراءة لا يكتبان شيئًا (القراء لا يكتبون).
 */
import { localDateInAmman as ammanLocalDate } from "@micro-domain/shared/index.js";
import { ammanDateOrNull, localDateDayNumber } from "@micro-domain/shared/index.js";
import type { PrototypeLocalStore } from "@/storage/local/types";
import { systemClock, type Clock } from "@/application/time/clock";
import type { DailyFollowUpService } from "@/application/follow-up/dailyFollowUpService";
import type { UnifiedFollowUpService } from "@/application/follow-up/unifiedFollowUpService";
import { projectFollowUp } from "@/application/follow-up/unifiedFollowUpService";
import type { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { buildHomeControlCenterViewModel, selectFollowUpBrief } from "./homeControlCenterModel";
import type {
  HomeBackupState,
  HomeFinancialGlimpse,
  HomeGlimpsePeriodNumbers,
} from "./homeControlCenterModel";

export type HomeControlCenterServiceStore = Pick<PrototypeLocalStore, "getProfile" | "getPreferences">;

export type HomeControlCenterResult =
  | { ok: true; value: ReturnType<typeof buildHomeControlCenterViewModel> }
  | { ok: false; code: "storage_error"; message: string }
  /* Stage C (S13/R5-1 — أمر المالك 2026-11-14): لا مشروع بعد
   * حالة صادقة مستقلة عن فشل القراءة — الضيف/الحساب
   * المتصل بلا إعداد Manage يرى دعوة
   * إعداد لا شاشة خطأ مزيفة. */
  | { ok: false; code: "no_project"; message: string };

const localDate = ammanLocalDate;

function storageFailure(message: string) {
  return { ok: false as const, code: "storage_error" as const, message };
}

/* P-4.3-2 (D7): التسمية الصادقة للنتيجة الناقصة — لا «ربحًا نهائيًا» بلا
 * تكلفة مكتملة؛ الوصف يتبع حالة المعرفة من القراءة الرسمية. */
function honestResultNote(period: { resultMinor: number | null; cogsStatus: string }): string | null {
  if (period.resultMinor !== null) return null;
  if (period.cogsStatus === "not_available") return "تحتاج بيانات تكلفة";
  if (period.cogsStatus === "partial") return "نتيجة تقديرية — تكلفة ناقصة";
  return "النتيجة غير مكتملة";
}

/* F-020 (W3-B): المبيعات بالتعريف الرسمي نفسه الذي يعرضه كشف الفترة
 * (recognizedRevenueTotalMinor في statementService): إيراد الطلبات المحتسب
 * عند التسليم + البيع المباشر — «مسجلة» تميز المسجل (أساس التسليم) عن
 * المقبوض؛ لا معادلة جديدة هنا. */
function totalSales(period: { recognizedRevenueMinor: number; directSaleRevenueMinor: number }) {
  return period.recognizedRevenueMinor + period.directSaleRevenueMinor;
}

export class HomeControlCenterService {
  constructor(
    private readonly store: HomeControlCenterServiceStore,
    private readonly dailyFollowUp: DailyFollowUpService,
    private readonly projectFinance: ProjectFinancialService,
    private readonly unifiedFollowUp: UnifiedFollowUpService,
    private readonly now: Clock = systemClock,
  ) {}

  async read(): Promise<HomeControlCenterResult> {
    const today = localDate(this.now());
    const monthStart = `${today.slice(0, 7)}-01`;
    const [profile, preferences, position, todayPeriod, monthPeriod, unified, daily] = await Promise.all([
      this.store.getProfile(),
      this.store.getPreferences(),
      this.projectFinance.readPosition(),
      /* D7: أرقام اليوم والشهر من قراءة الفترة الرسمية وحدها — قراءة واحدة
       * للاثنين والصفحة تعرض المختار (لا قراءة عند التبديل). */
      this.projectFinance.readRecordedPeriodResult(today, today),
      this.projectFinance.readRecordedPeriodResult(monthStart, today),
      this.unifiedFollowUp.read(),
      /* HOME-X03: مسودات الإكمال من قراءة اليوم القائمة — الامتداد الكامل
       * عند القارئ المشترك بابه لاحقًا؛ العرض اللازم لا يُحذف. */
      this.dailyFollowUp.read(),
    ]);
    if (!profile.ok) return storageFailure("تعذر قراءة بيانات مشروعك المحلية.");
    /* Stage C (S13/R5-1): قراءة ناجحة ولا مشروع — ليس خطأً؛ دعوة
     * إعداد صادقة تمامًا كمثال الإعداد في StartupGate. */
    if (!profile.value)
      return {
        ok: false as const,
        code: "no_project" as const,
        message: "لم يؤسس مشروع بعد — أنشئ مشروعك من صفحة الإعداد.",
      };
    if (!preferences.ok || !position.ok || !todayPeriod.ok || !monthPeriod.ok)
      return storageFailure("تعذر قراءة بيانات مشروعك المحلية.");
    if (!unified.ok) return storageFailure(unified.message);
    if (!daily.ok) return storageFailure(daily.message);

    const positionValue = position.value;
    /* ── لمحة مالية (HOME-B1): فترة أداء واحدة معروضة والنقد الآن منفصل. ── */
    const statementHref = (from: string, to: string) => `/finance/statement?since=${from}&until=${to}`;
    const periodNumbers = (
      kind: "today" | "month",
      label: string,
      from: string,
      to: string,
      period: { resultMinor: number | null; cogsStatus: string },
      salesValueMinor: number,
    ): HomeGlimpsePeriodNumbers => ({
      period: { kind, from, to, label },
      sales: {
        id: "sales",
        label: "المبيعات المسجلة",
        state: "known",
        valueMinor: salesValueMinor,
        honestNote: null,
        sourceHref: statementHref(from, to),
      },
      result: {
        id: "result",
        label: "نتيجة الفترة",
        state: period.resultMinor === null ? "incomplete" : "known",
        valueMinor: period.resultMinor,
        honestNote: honestResultNote(period),
        sourceHref: statementHref(from, to),
      },
    });
    const glimpse: HomeFinancialGlimpse = {
      today: periodNumbers("today", "اليوم", today, today, todayPeriod.value, totalSales(todayPeriod.value)),
      month: periodNumbers(
        "month",
        "هذا الشهر",
        monthStart,
        today,
        monthPeriod.value,
        totalSales(monthPeriod.value),
      ),
      /* النقد المسجل الآن — قراءة الوضع الحالية 022، منفصلة عن فترة الأداء. */
      cashNow: {
        label: "النقد المسجل الآن",
        state: positionValue.evidence.cash === "recorded" ? "known" : "not_initialized",
        valueMinor: positionValue.evidence.cash === "recorded" ? positionValue.recordedCashMinor : null,
        qualifier:
          positionValue.evidence.cash === "recorded" && positionValue.amanahHeldMinor > 0
            ? `منها أمانات بأمانتي — ليست مالك ولا ربحًا`
            : null,
        sourceHref: "/cash",
      },
    };

    /* ── متابعتك (HOME-A4/3D-C2): المختصر من القارئ الموحد + المسودات. ── */
    const reading = unified.value;
    const projection = projectFollowUp(reading, { taskKind: "all", period: null });
    const complete = projection.errorSources.length === 0;
    const failedMessage =
      projection.errorSources.length > 0 ? "تعذرت قراءة بعض المتابعات — أعد المحاولة" : null;
    const followUp = selectFollowUpBrief(projection, daily.drafts, complete, failedMessage);

    /* ── حالة النسخة المتحققة (HOME-F10) والتذكير الهادئ (O-001). ── */
    const lastExport = preferences.value?.lastVerifiedExportAt ?? null;
    const lastExportDate = lastExport !== null ? ammanDateOrNull(lastExport) : null;
    const lastExportNumber = lastExportDate !== null ? localDateDayNumber(lastExportDate) : null;
    const todayNumber = localDateDayNumber(today);
    const daysSinceExport =
      todayNumber !== null && lastExportNumber !== null ? Math.max(0, todayNumber - lastExportNumber) : null;
    const backupReminderEnabled = preferences.value?.backupReminderEnabled ?? true;
    const hasAnyData = positionValue.cashWalletCount > 0 || positionValue.projectEventCount > 0;
    const backup: HomeBackupState = {
      lastVerifiedExportAt: lastExport,
      daysSinceExport,
      reminderEnabled: backupReminderEnabled,
    };
    const backupReminderDue =
      backupReminderEnabled && hasAnyData && (daysSinceExport === null || daysSinceExport >= 7);

    return {
      ok: true,
      value: buildHomeControlCenterViewModel({
        activityName: profile.value.activityName,
        todayLocal: today,
        truthLine: backupReminderDue
          ? "بياناتك على هذا الجهاز فقط — انسخ نسخة احتياطية من الإعدادات لتصبح جاهزة للطوارئ."
          : null,
        glimpse,
        followUp,
        backup,
      }),
    };
  }
}
