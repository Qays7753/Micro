/**
 * Project financial Application layer. It combines recorded project events with existing order-only
 * collections and receivables without turning either into project profit or unrecorded cash.
 *
 * Wave F (ADR-013 عنقود ٣ — تقسيم مسؤولية داخلي، 2026-10-04): هذا الصنف هو
 * القارئ الكنوني (عقد ٤٠ §8 — «القارئ الكنوني في بيته المالي») وواجهته
 * العامة وهيّته لا تتغيران؛ صار المُنسِّق الذي يحفظ الحقن والساعة ويفوّض
 * مسارات العمل إلى ملفات أشقاء في البيت المالي نفسه، انتقلت كلها حرفيًا
 * بلا أي تغيير صيغة أو تقريب أو تصنيف:
 *   - projectFinancialTypes — بيت نموذج القارئ الكامل (الأنواع؛ أُكمل في Wave F
 *     فوق أساس Wave E الورقي الذي فك دورة الأنواع مع financialAnalysisService).
 *   - projectFinancialReads — قراءات الأساس: المركز وقوائم الأحداث والالتزامات.
 *   - projectFinancialPeriodReads — عائلة نتيجة الفترة: اشتقاق COGS وتصنيف
 *     المصروفات المشتركة والاعتراف بآخر تسليم ساري.
 *   - projectFinancialInsights — قراءة المؤشرات (التركيب المعياري والتغطية
 *     والسيولة)؛ الاستيراد العميق الموثق D-034 (operatingBreakEven — خارج
 *     حزمة الدخول عمدًا) انتقل معها.
 *   - projectFinancialEventWrites — مسار كتابة الأحداث المحروس (التسجيل/
 *     التراجع/التعديل الذرّي/الحذف/الاسترجاع بكل حراسها).
 *   - projectFinancialEventWrites يتضمن توزيع الكاش غير الموزع (PA-002) ضمنه.
 *     (تصحيح مؤرخ بتدقيق W10 — 2026-10-05: كان السطر يسمي projectFinancialDistribution
 *     ملفًا مستقلًا ولا وجود له؛ التوزيع مسار داخل EventWrites.)
 *
 * W3 (برنامج الإكمال ما بعد المسح، 2026-10-05) — عقد نموذج القراءة (PC-4/الخطة §4.2):
 * المدخلات المالكة = أحداث المال والسجلات المخزنة (طلبات/مواعيد/تحصيلات) عبر
 * PrototypeLocalStore وحده؛ الاشتقاق = إعادة حساب عند كل قراءة (لا كاش ولا حالة
 * مشتقة مخزنة — كل read* يستعلم المخزن مباشرة)؛ الإبطال = غير مطلوب بنيويًا
 * لغياب الكاش، والاتساق عند حدود الكتابة تحرسه كتابة الحالة الحية داخل حد
 * الكتابة (رفض storage_stale) ومفاتيح الحتمية. القارئ ليس مصدر سلطة ثانيًا —
 * كل رقم هنا مشتق من المدخلات المالكة ولا يُكتب أبدًا.
 */
import { systemClock, type Clock } from "@/application/time/clock";
import type { PrototypeLocalStore } from "@/storage/local/types";
import type { ProjectFinancialEventWritesStore } from "./projectFinancialEventWrites";
import type { ProjectFinancialReadsStore } from "./projectFinancialReads";
import type { ProjectFinancialPeriodReadsStore } from "./projectFinancialPeriodReads";
import type { ProjectFinancialInsightsStore } from "./projectFinancialInsights";

/** R3 (بطاقة R3-SC-01/11): عدسة الخدمة — منسّق القارئ الكنوني — اتحاد عدسات
 * أخويه (القراءات الثلاث + الكتابة) حصرًا؛ لا شيء خارج احتياجهم. */
export type ProjectFinancialServiceStore = ProjectFinancialReadsStore &
  ProjectFinancialPeriodReadsStore &
  ProjectFinancialInsightsStore &
  ProjectFinancialEventWritesStore;
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";
import { listEvents, listSettleablePayables, readPosition } from "./projectFinancialReads";
import { readRecordedPeriodResult } from "./projectFinancialPeriodReads";
import { readFinancialInsights } from "./projectFinancialInsights";
import {
  deleteFinancialEvent,
  distributeUnallocatedCash,
  editFinancialEvent,
  recordFinancialEvent,
  restoreFinancialEvent,
  reverseFinancialEvent,
} from "./projectFinancialEventWrites";
import type {
  CoverageIndicator,
  FinanceResult,
  FinancialEditInput,
  FinancialInsights,
  FinancialRecordInput,
  FinancialReversalInput,
  ProjectFinancialPosition,
  RecordedPeriodResult,
  SettleablePayable,
  UnallocatedDistributionInput,
} from "./projectFinancialTypes";

/* الواجهة العامة محفوظة حرفيًا — كل أنواع السطح تعاد من بيتها الورقي
 * (نمط Wave E المجرّب) فلا يتغير أي مستورد من المئة والخمسة عشر قائمة. */
export type {
  CogsStatus,
  CoverageIndicator,
  FinanceResult,
  FinancialEditInput,
  FinancialInsightStatus,
  FinancialInsights,
  FinancialMetricEvidence,
  FinancialRecordInput,
  FinancialReversalInput,
  ProjectFinancialEvidence,
  ProjectFinancialPosition,
  RecordedCostComposition,
  RecordedLiquidity,
  RecordedPeriodResult,
  SettleablePayable,
  UnallocatedDistributionInput,
  WorkNameProfitability,
} from "./projectFinancialTypes";
/* المجموعة ١ (معاينة الأثر): نوع خيارات الحصة مصدره وحدة التوسيع النقية —
 * يُعاد تصديره هنا للتوافق مع المستوردين القائمين. */
export type { SharedExpenseRecordInput } from "@/application/financial-records/expenseRecordIntent";

/* REM-007 (تصحيح تكافؤ المستهلكين — 2026-09-30): حارسا التجميع السلبيان —
 * قراءة المؤشرات المالية بلا سطح هدف أصلًا. أي إضافة مستقبلية لحقل هدف في
 * عقد التغطية أو لوسيط هدف في قراءة المؤشرات تُفشل التجميع فورًا (توجيه
 * ts-expect-error غير المستخدم خطأ تجميعي). */
// @ts-expect-error — عقد التغطية لا يعلن قراءة هدف أصلًا (Pick بلا هدف)
type _CoverageDeclaresNoTarget = CoverageIndicator["targetOperatingResult"];
type _InsightsParams = Parameters<typeof ProjectFinancialService.prototype.readFinancialInsights>;
// @ts-expect-error — قراءة المؤشرات لا تقبل وسيطًا ثالثًا (لا وسيط هدف)
type _InsightsThirdParam = _InsightsParams[2];

export class ProjectFinancialService {
  constructor(
    private readonly store: ProjectFinancialServiceStore,
    private readonly now: Clock = systemClock,
  ) {}

  async readPosition(): Promise<FinanceResult<ProjectFinancialPosition>> {
    return readPosition(this.store);
  }

  async listEvents(): Promise<FinanceResult<readonly FinancialEvent[]>> {
    return listEvents(this.store);
  }

  async listSettleablePayables(): Promise<FinanceResult<readonly SettleablePayable[]>> {
    return listSettleablePayables(this.store);
  }

  async readRecordedPeriodResult(from: string, to: string): Promise<FinanceResult<RecordedPeriodResult>> {
    return readRecordedPeriodResult(this.store, from, to);
  }

  async readFinancialInsights(from: string, to: string): Promise<FinanceResult<FinancialInsights>> {
    return readFinancialInsights(this.store, this, from, to);
  }

  async reverse(input: FinancialReversalInput): Promise<FinanceResult<FinancialEvent>> {
    return reverseFinancialEvent(this.store, this.now, input);
  }

  /** توزيع صريح من الكاش غير الموزع (PA-002): لا تخصيص صامت ولا كاش بلا طريق حل. */
  async distributeUnallocated(
    input: UnallocatedDistributionInput,
  ): Promise<FinanceResult<{ unallocatedAfterMinor: number; walletBalanceAfterMinor: number }>> {
    return distributeUnallocatedCash(this.store, this, this.now, input);
  }

  /** تعديل بسيط موثق (مبدأ ٥.٦): تراجع + بديل في معاملة ذرّية واحدة — الأثر يتجدد والسجل يبقى. */
  async editEvent(input: FinancialEditInput): Promise<FinanceResult<FinancialEvent>> {
    return editFinancialEvent(this.store, this.now, input);
  }

  /** حذف بسيط (مبدأ ٥.٦): التراجع الموثق هو الآلية — الأثر يتلاشى والسجل يبقى. */
  async deleteEvent(input: {
    sourceEventId: string;
    reason?: string | null;
    idempotencyKey: string;
  }): Promise<FinanceResult<FinancialEvent>> {
    return deleteFinancialEvent(this.store, this.now, input);
  }

  /** تراجع عن الحذف (Undo): يعاد تسجيل القيم الأصلية كحدث جديد — لا يُلمس الماضي. */
  async restoreEvent(input: {
    sourceEventId: string;
    idempotencyKey: string;
  }): Promise<FinanceResult<FinancialEvent>> {
    return restoreFinancialEvent(this.store, this.now, input);
  }

  async record(input: FinancialRecordInput): Promise<FinanceResult<FinancialEvent>> {
    return recordFinancialEvent(this.store, this.now, input);
  }
}
