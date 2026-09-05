/**
 * المجموعة ١ (فحص سلامة مالي — الأساس): خدمة قراءة فقط تفحص اتساق الأرقام
 * المالية المحلية وتعرض النتيجة بلا أي كتابة ولا إصلاح تلقائي أبدًا.
 * «يقرأ أرقامك ولا يغيّر شيئًا» — الوعد ملزم معماريًا: كل استدعاء هنا يستعمل
 * مسارات قراءة فقط (list و read فقط).
 *
 * معرّفات الفحوص ثابتة (MIC-*) وسجلها محجوز للمجموعات اللاحقة التي ستوسّع
 * المجموعة نفسها — MIC-1/MIC-2/MIC-4/MIC-7/MIC-9 هي فحوص نطاق المجموعة ١
 * (تطابق نتيجة الفترة، بنية الكاش، سلامة الأحداث والتوزيع، الأمانات، صدق
 * درجة المعرفة). الفحص لا يخترع قواعد جديدة: كل قاعدة مشتقة من عقد مجال
 * مُختبر (قاعدة الدلتا الخماسية، إعادة اشتقاق النسبة، قواعد المصدر والتوزيع).
 */
import {
  createFinancialEvent,
  createFinancialReversal,
  reversedEventIds,
  summarizeFinancialEvents,
} from "@micro-domain/financial-event/index.js";
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";
import type { CashContinuityEntry } from "@micro-domain/cash-continuity/index.js";
import type { InventoryMovement } from "@micro-domain/inventory-material/index.js";
import type { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import type { StatementService } from "@/application/finance/statementService";
import type { CashContinuityService } from "@/application/cash/cashContinuityService";
import type { PrototypeLocalStore } from "@/storage/local/types";
import { localExportVersion, localSchemaVersion } from "@/storage/local/types";
import { localDateInAmman as ammanDate } from "@/presentation/formatters";

export type IntegrityCheckStatus = "PASS" | "WARN" | "FAIL";
export type IntegrityCheckId =
  | "MIC-1"
  | "MIC-2"
  | "MIC-4"
  | "MIC-7"
  | "MIC-8"
  | "MIC-9"
  /* المجموعة ٤ (عقد ٢٩): الأصول والقروض والعربون المحتفظ وربط استهلاك التسليم. */
  | "MIC-10"
  | "MIC-11"
  | "MIC-12"
  | "MIC-13"
  /* المجموعة ٥ (عقد ٣٥): صحة الكاش غير الموزّع، تفرّد مفاتيح الأحداث،
  * وفصل مال المالك عن النتيجة والمصروف. */
  | "MIC-14"
  | "MIC-15"
  | "MIC-16";
export type IntegrityCheckResult = {
  id: IntegrityCheckId;
  titleAr: string;
  status: IntegrityCheckStatus;
  detailAr: string;
  driftMinor?: number | null;
  offenderCount?: number;
  offenderSampleIds?: readonly string[];
  deepLink?: string | null;
};
export type IntegrityCheckReport = {
  runAt: string;
  from: string;
  to: string;
  overall: IntegrityCheckStatus;
  checks: readonly IntegrityCheckResult[];
  /* المجموعة ٥ (عقد ٣٥): ختم إصدار الفحص — إصدار المخطط وإصدار التصدير
   * لحظة التشغيل، فيعرف المالك أي جيل من القواعد فحص أرقامه. */
  schemaVersion: number;
  exportVersion: number;
};

const SOURCE_REF_KINDS = ["sale", "expense", "collection", "order"] as const;
type SourceRefKind = (typeof SOURCE_REF_KINDS)[number];

const EVENTS_DEEP_LINK = "/finance?layer=events";
const eventDeepLink = (ids: readonly string[]): string =>
  ids.length > 0 ? `${EVENTS_DEEP_LINK}&event=${encodeURIComponent(ids[0]!)}` : EVENTS_DEEP_LINK;

const PASS_TEXT = "سليم";
const WARN_TEXT = "تحذير";
const FAIL_TEXT = "خلل";
export const integrityStatusWord: Record<IntegrityCheckStatus, string> = {
  PASS: PASS_TEXT,
  WARN: WARN_TEXT,
  FAIL: FAIL_TEXT,
};

export class IntegrityCheckService {
  constructor(
    private readonly store: PrototypeLocalStore,
    private readonly projectFinance: ProjectFinancialService,
    private readonly statementService: StatementService,
    private readonly cashContinuity: CashContinuityService,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  /** الفحص كله قراءة — لا يكتب ولا يصلح؛ إعادة التشغيل قراءة جديدة كل مرة. */
  async run(): Promise<IntegrityCheckReport> {
    const to = ammanDate(this.now());
    const from = `${to.slice(0, 7)}-01`;
    const eventsResult = await this.store.listFinancialEvents();
    if (!eventsResult.ok)
      return this.report(from, to, [
        this.fail("MIC-4", "تعذر قراءة سجل الأحداث المالية — أعد المحاولة.", []),
      ]);
    const events = eventsResult.value;

    /* MIC-1 أولًا (يستعمل القارئ الكنسي) ثم بقية الفحوص — قراءات متسلسلة كي لا
     * يتغير شيء تحت أيدينا أثناء الفحص (SA-3: تسلسل لا توازٍ). */
    const mic1 = await this.checkPeriodResultConsistency(from, to);
    const mic2 = await this.checkCashStructure();
    const mic4 = this.checkEventAndAllocationIntegrity(events);
    const mic7 = await this.checkAmanahReadBack(events);
    const mic8 = await this.checkInventoryStructure();
    const mic9 = this.checkKnowledgeHonesty(
      mic1.readerResultMinor,
      mic1.readerStatus,
      mic1.readerReasons,
      mic1.readerUnknownCostCount,
      events,
      from,
      to,
    );
    /* المجموعة ٤ (عقد ٢٩): فحوص القراءة المتسلسلة نفسها — الأصول ثم القروض ثم
     * تصنيف العربون ثم ربط استهلاك التسليم بمصدره. */
    const mic10 = await this.checkAssetIntegrity(events);
    const mic11 = await this.checkLoanIntegrity(events);
    const mic12 = await this.checkRetainedDepositIntegrity(events);
    const mic13 = await this.checkDeliveryConsumptionIntegrity();
    /* المجموعة ٥ (عقد ٣٥): فحوص الاستمرارية الثلاثة — قراءة متسلسلة كإخوتها. */
    const mic14 = await this.checkUnallocatedCashTruth();
    const mic15 = this.checkEventKeyUniqueness(events);
    const mic16 = this.checkOwnerMoneySeparation(events);
    return this.report(from, to, [
      mic1.result,
      mic2,
      mic4,
      mic7,
      mic8,
      mic9,
      mic10,
      mic11,
      mic12,
      mic13,
      mic14,
      mic15,
      mic16,
    ]);
  }

  private report(from: string, to: string, checks: readonly IntegrityCheckResult[]): IntegrityCheckReport {
    const overall: IntegrityCheckStatus = checks.some(check => check.status === "FAIL")
      ? "FAIL"
      : checks.some(check => check.status === "WARN")
        ? "WARN"
        : "PASS";
    return {
      runAt: this.now(),
      from,
      to,
      overall,
      checks,
      schemaVersion: localSchemaVersion,
      exportVersion: localExportVersion,
    };
  }

  /* ─── MIC-1: تطابق نتيجة الفترة عبر الأسطح (القارئ الكنسي) ───
   * القارئ الواحد `readRecordedPeriodResult` هو المنتج الوحيد لرقم الفترة؛
   * الكشف والمؤشرات يستهلكانه. null قيمة معلنة: كل سطح يعرض «غير متاح + أسباب». */
  private async checkPeriodResultConsistency(
    from: string,
    to: string,
  ): Promise<{
    result: IntegrityCheckResult;
    readerResultMinor: number | null;
    readerStatus: string;
    readerReasons: readonly string[];
    readerUnknownCostCount: number;
  }> {
    const reader = await this.projectFinance.readRecordedPeriodResult(from, to);
    const statement = await this.statementService.read(from, to);
    const insights = await this.projectFinance.readFinancialInsights(from, to);
    if (!reader.ok || !statement.ok || !insights.ok)
      return {
        result: this.fail("MIC-1", "تعذر قراءة نتيجة الفترة من السجلات المحلية — أعد المحاولة.", []),
        readerResultMinor: null,
        readerStatus: "invalid",
        readerReasons: [],
        readerUnknownCostCount: 0,
      };
    const readerValue = reader.value;
    const statementResult = statement.value.result;
    const insightsPeriod = insights.value.period;
    const readerJson = JSON.stringify(readerValue);
    const statementMatches = JSON.stringify(statementResult) === readerJson;
    const insightsMatches = JSON.stringify(insightsPeriod) === readerJson;
    if (statementMatches && insightsMatches)
      return {
        result: {
          id: "MIC-1",
          titleAr: "تطابق نتيجة الفترة",
          status: "PASS",
          detailAr: readerValue.resultMinor === null
            ? `نتيجة الفترة غير متاحة (تكلفة غير معروفة) في كل الأسطح ولنفس الأسباب — مجهول لا يُعرض صفرًا.`
            : `نفس نتيجة الفترة تظهر في مالي والكشف والمؤشرات من قارئ واحد.`,
        },
        readerResultMinor: readerValue.resultMinor,
        readerStatus: readerValue.status,
        readerReasons: readerValue.reasons,
        readerUnknownCostCount: readerValue.directSaleCostUnknownCount,
      };
    const driftMinor =
      readerValue.resultMinor !== null && statementResult.resultMinor !== null
        ? Math.abs(readerValue.resultMinor - statementResult.resultMinor)
        : null;
    return {
      result: this.fail(
        "MIC-1",
        `اختلاف بين أسطح نتيجة الفترة: القارئ الكنسي ${readerValue.resultMinor === null ? "غير متاح" : readerValue.resultMinor} والكشف ${statementResult.resultMinor === null ? "غير متاح" : statementResult.resultMinor} — راجع ولا يُعدّل شيء تلقائيًا.`,
        [],
        driftMinor,
        "/finance/statement",
      ),
      readerResultMinor: readerValue.resultMinor,
      readerStatus: readerValue.status,
      readerReasons: readerValue.reasons,
      readerUnknownCostCount: readerValue.directSaleCostUnknownCount,
    };
  }

  /* ─── MIC-2: بنية الكاش والمحافظ ───
   * الرصيد السالب حالة معلنة قابلة للمراجعة (سحب مالك/ضبط) = تحذير؛ أما الكسر
   * البنيوي (تحويل بلا قرين، تراجع معلق، محفظة مجهولة، مفتاح مكرر) = خلل. */
  private async checkCashStructure(): Promise<IntegrityCheckResult> {
    const [overview, entriesResult] = await Promise.all([
      this.cashContinuity.overview(),
      this.cashContinuity.entries(),
    ]);
    if (!overview.ok || !entriesResult.ok)
      return this.fail("MIC-2", "تعذر قراءة محافظ الكاش — أعد المحاولة.", []);
    const entries = entriesResult.value;
    const structural: string[] = [];
    const review: string[] = [];

    for (const wallet of overview.value.wallets)
      if (wallet.balanceMinor < 0)
        review.push(
          wallet.openingUnknown
            ? `محفظة ${wallet.name} — رصيد افتتاحي غير معلن بعد`
            : `محفظة ${wallet.name}`,
        );

    const walletIds = new Set(overview.value.wallets.map(wallet => wallet.id));
    const transferGroups = new Map<string, CashContinuityEntry[]>();
    const reversedEntryIds = new Set<string>();
    /* مفتاح العملية وحدة إيداع قد تكتب زوجًا مقترنًا (تحويل/عكس تحويل) — التفرد
     * على الوحدات لا الأسطر (نفس قاعدة فحص الاستيراد). */
    const entriesByOperationKey = new Map<string, CashContinuityEntry[]>();
    for (const entry of entries) {
      if (!walletIds.has(entry.walletId)) structural.push(entry.id);
      entriesByOperationKey.set(entry.operationKey, [
        ...(entriesByOperationKey.get(entry.operationKey) ?? []),
        entry,
      ]);
      if (entry.type === "reversal") {
        if (reversedEntryIds.has(entry.reversesEntryId ?? "")) structural.push(entry.id);
        reversedEntryIds.add(entry.reversesEntryId ?? "");
      }
      if (typeof entry.transferId === "string" && entry.type !== "reversal" && entry.transferId)
        transferGroups.set(entry.transferId, [...(transferGroups.get(entry.transferId) ?? []), entry]);
    }
    for (const group of entriesByOperationKey.values()) {
      if (group.length === 1) continue;
      const sameTransferId =
        group.length === 2 && group.every(entry => entry.transferId === group[0]?.transferId);
      const isTransferPair =
        sameTransferId &&
        group.some(entry => entry.type === "transfer_out") &&
        group.some(entry => entry.type === "transfer_in");
      const isReversalPair = sameTransferId && group.every(entry => entry.type === "reversal");
      if (!isTransferPair && !isReversalPair)
        structural.push(...group.map(entry => entry.id));
    }
    for (const group of transferGroups.values()) {
      const balanced =
        group.length === 2 &&
        group.reduce((sum, entry) => sum + entry.cashDeltaMinor, 0) === 0 &&
        group.some(entry => entry.type === "transfer_out") &&
        group.some(entry => entry.type === "transfer_in");
      if (!balanced) structural.push(...group.map(entry => entry.id));
    }
    for (const entry of entries) {
      if (entry.type !== "reversal") continue;
      const original = entries.find(candidate => candidate.id === entry.reversesEntryId);
      /* SA-5 (4): التراجع عن تراجع غير مشروع في المسار الحي — يُكتشف هنا أيضًا. */
      if (
        !original ||
        original.type === "reversal" ||
        entry.cashDeltaMinor !== -original.cashDeltaMinor
      )
        structural.push(entry.id);
    }
    for (const entry of entries) {
      /* قواعد المصدر (عقد استمرارية الكاش): الاقتران والنوع والسطر. */
      const sourceRefId = entry.sourceRefId ?? null;
      const sourceRefKind = (entry.sourceRefKind as SourceRefKind | null | undefined) ?? null;
      const sourceRefLineId = entry.sourceRefLineId ?? null;
      if ((sourceRefId && !sourceRefKind) || (!sourceRefId && sourceRefKind)) structural.push(entry.id);
      if (sourceRefKind && !SOURCE_REF_KINDS.includes(sourceRefKind)) structural.push(entry.id);
      if (sourceRefLineId && !sourceRefId) structural.push(entry.id);
      if (entry.type !== "allocation" && (sourceRefId || sourceRefKind || sourceRefLineId))
        structural.push(entry.id);
    }
    if (structural.length === 0 && review.length === 0)
      return {
        id: "MIC-2",
        titleAr: "بنية الكاش والمحافظ",
        status: "PASS",
        detailAr: `التحويلات أزواج متوازنة والتراجعات تشير لأصول قائمة والمفاتيح غير مكررة${
          overview.value.wallets.length === 0 ? " — لا محافظ معلنة بعد" : ""
        }.`,
      };
    if (structural.length > 0)
      return this.fail(
        "MIC-2",
        `اختلال بنيوي في ${structural.length} حركة كاش (تحويل بلا قرينه أو تراجع معلق أو محفظة/مفتاح غير صالح) — راجعها من دفتر المحفظة.`,
        structural,
        null,
        "/cash",
      );
    return {
      id: "MIC-2",
      titleAr: "بنية الكاش والمحافظ",
      status: "WARN",
      detailAr: `${review.join(" · ")} — رصيد محفظة سالب حالة قابلة للمراجعة لا خللًا محاسبيًا؛ راجع سحوبات المالك والتسويات.`,
      offenderCount: review.length,
      deepLink: "/cash",
    };
  }

  /* ─── MIC-4: سلامة الأحداث والتوزيع ───
   * كل حدث يُعاد بناؤه عبر دوال المجال نفسها من حقوله المسجلة، ثم يقارن أثره
   * الخماسي: أي فرق = تلف أو تلاعب. الحصة تُعاد مشتقة بالقاعدة نفسها (نقاط
   * الأساس والتقريب نصف الأعلى) — لا قاعدة جديدة تُخترع هنا. */
  private checkEventAndAllocationIntegrity(events: readonly FinancialEvent[]): IntegrityCheckResult {
    const offenders: string[] = [];
    /* SA-5 (1): تسديد يشير لالتزام عُدّل/حُذف بتراجع موثق بعد التسديد — حالة
     * مسار قائم وموثق (الأثر الإجمالي سليم والمرجع قديم): مراجعة لا خللًا. */
    const staleSettlements: string[] = [];
    const byId = new Map(events.map(event => [event.id, event] as const));
    const reversedIds = reversedEventIds(events);
    for (const event of events) {
      try {
        if (event.correctionType === "reverse") {
          const original = event.correctionOfEventId ? byId.get(event.correctionOfEventId) : undefined;
          if (!original) {
            offenders.push(event.id);
            continue;
          }
          const rebuilt = createFinancialReversal({
            id: event.id,
            sourceEvent: original,
            occurredOn: event.occurredOn,
            recordedAt: event.recordedAt,
            idempotencyKey: event.idempotencyKey,
            reason: event.correctionReason ?? "تعديل موثق",
          });
          /* SA-5 (2): سياق المصروف من الحقول الحتمية أيضًا — تراجع بعلاقة/معرفة/
           * وسم مغاير لأصله يُكتشف كما تُكتشف الدلتا. */
          if (
            rebuilt.type !== event.type ||
            rebuilt.amountMinor !== event.amountMinor ||
            rebuilt.counterparty !== event.counterparty ||
            rebuilt.relatedEventId !== event.relatedEventId ||
            rebuilt.cashDeltaMinor !== event.cashDeltaMinor ||
            rebuilt.payableDeltaMinor !== event.payableDeltaMinor ||
            rebuilt.ownerCapitalDeltaMinor !== event.ownerCapitalDeltaMinor ||
            rebuilt.operatingExpenseDeltaMinor !== event.operatingExpenseDeltaMinor ||
            (rebuilt.amanahDeltaMinor ?? 0) !== (event.amanahDeltaMinor ?? 0) ||
            (rebuilt.assetDeltaMinor ?? 0) !== (event.assetDeltaMinor ?? 0) ||
            (rebuilt.loanDeltaMinor ?? 0) !== (event.loanDeltaMinor ?? 0) ||
            (rebuilt.revenueDeltaMinor ?? 0) !== (event.revenueDeltaMinor ?? 0) ||
            JSON.stringify(rebuilt.expenseContext ?? null) !== JSON.stringify(event.expenseContext ?? null) ||
            JSON.stringify(rebuilt.assetContext ?? null) !== JSON.stringify(event.assetContext ?? null) ||
            JSON.stringify(rebuilt.loanContext ?? null) !== JSON.stringify(event.loanContext ?? null) ||
            JSON.stringify(rebuilt.depositContext ?? null) !== JSON.stringify(event.depositContext ?? null)
          )
            offenders.push(event.id);
          continue;
        }
        const rebuilt = createFinancialEvent({
          id: event.id,
          type: event.type,
          amountMinor: event.amountMinor,
          occurredOn: event.occurredOn,
          recordedAt: event.recordedAt,
          idempotencyKey: event.idempotencyKey,
          note: event.note,
          counterparty: event.counterparty,
          relatedEventId: event.relatedEventId,
          expenseContext: event.expenseContext ?? null,
          /* المجموعة ٥ (إصلاح إيجابيات كاذبة في MIC-4): أحداث الأصول/القروض/
           * تصنيف العربون تتطلب سياقها المرتبط في عقد المجال — دون تمريره
           * كان إعادة الاشتقاق يرمي خطأً فيُوسَم كل حدث أصل/قرض/عربون سليم
           * «خللًا». السياقات المسجلة تُمرّر فتُعاد التطبيع بنفس عقد المجال،
           * وتُقارن نصيًا كسياق المصروف — تلاعب السياق يُكتشف لا يُخفى. */
          assetContext: event.assetContext ?? null,
          loanContext: event.loanContext ?? null,
          depositContext: event.depositContext ?? null,
        });
        if (
          rebuilt.cashDeltaMinor !== event.cashDeltaMinor ||
          rebuilt.payableDeltaMinor !== event.payableDeltaMinor ||
          rebuilt.ownerCapitalDeltaMinor !== event.ownerCapitalDeltaMinor ||
          rebuilt.operatingExpenseDeltaMinor !== event.operatingExpenseDeltaMinor ||
          (rebuilt.amanahDeltaMinor ?? 0) !== (event.amanahDeltaMinor ?? 0) ||
          (rebuilt.assetDeltaMinor ?? 0) !== (event.assetDeltaMinor ?? 0) ||
          (rebuilt.loanDeltaMinor ?? 0) !== (event.loanDeltaMinor ?? 0) ||
          (rebuilt.revenueDeltaMinor ?? 0) !== (event.revenueDeltaMinor ?? 0) ||
          JSON.stringify(rebuilt.expenseContext ?? null) !== JSON.stringify(event.expenseContext ?? null) ||
          JSON.stringify(rebuilt.assetContext ?? null) !== JSON.stringify(event.assetContext ?? null) ||
          JSON.stringify(rebuilt.loanContext ?? null) !== JSON.stringify(event.loanContext ?? null) ||
          JSON.stringify(rebuilt.depositContext ?? null) !== JSON.stringify(event.depositContext ?? null)
        )
          offenders.push(event.id);
        /* قيد المصروف: غياب المرجل أو مرجع ليس التزامًا = خلل؛ أما مرجع التزام
         * عُدّل/حُذف موثقًا بعد التسديد = مراجعة — المسار القائم سليم. */
        if (event.type === "payable_settlement_cash") {
          const source = event.relatedEventId ? byId.get(event.relatedEventId) : undefined;
          if (!event.relatedEventId || !source || source.type !== "operating_expense_payable")
            offenders.push(event.id);
          else if (reversedIds.has(event.relatedEventId)) staleSettlements.push(event.id);
        }
      } catch {
        /* أي رفض من المجال = سجل لا يطابق عقده: خلل موثق بمعرّفه لا انهيار فحص. */
        offenders.push(event.id);
      }
    }
    if (offenders.length === 0 && staleSettlements.length === 0)
      return {
        id: "MIC-4",
        titleAr: "سلامة الأحداث والتوزيع",
        status: "PASS",
        detailAr: `${events.length} حدثًا ماليًا طابق كلٌّ منها أثره المالي وحصصه عند إعادة الاشتقاق من عقد المجال.`,
      };
    if (offenders.length === 0)
      return {
        id: "MIC-4",
        titleAr: "سلامة الأحداث والتوزيع",
        status: "WARN",
        detailAr: `${staleSettlements.length} تسديدًا يشير لالتزام جرى تعديله أو حذفه بتراجع موثق — الأثر الإجمالي سليم والمرجع قديم؛ راجع الالتزام الحالي واربط التسديد به عند الحاجة.`,
        offenderCount: staleSettlements.length,
        offenderSampleIds: staleSettlements.slice(0, 5),
        deepLink: eventDeepLink(staleSettlements),
      };
    return this.fail(
      "MIC-4",
      `${offenders.length} حدثًا لا يطابق أثره أو حصته المسجلة عقد المجال عند إعادة الاشتقاق — راجع السجل المصدر ولا يُعدّل شيء تلقائيًا.`,
      offenders,
      null,
      eventDeepLink(offenders),
    );
  }

  /* ─── MIC-7: رصيد الأمانات ───
   * الكتابة الحية تحرس الحد أصلًا؛ هذه قراءة راجعة تلتقط الاستيراد/التلف —
   * سالب = ملك زائف ونقص كاش كاذب. التطابق مع الموقف يفحص انجراف الصيغة. */
  private async checkAmanahReadBack(events: readonly FinancialEvent[]): Promise<IntegrityCheckResult> {
    const amanahMinor = summarizeFinancialEvents(events).amanahMinor;
    const position = await this.projectFinance.readPosition();
    if (!position.ok)
      return this.fail("MIC-7", "تعذر قراءة الموقف المالي — أعد المحاولة.", []);
    if (amanahMinor < 0)
      return this.fail(
        "MIC-7",
        `رصيد الأمانات سالب (${amanahMinor}) — سلّمت أكثر مما قبضت: مستحيل بالكتابة الحية، راجع الاستيراد أو السجل.`,
        [],
        Math.abs(amanahMinor),
        "/finance",
      );
    if (position.value.amanahHeldMinor !== amanahMinor)
      return this.fail(
        "MIC-7",
        `رصيد الأمانات في الموقف (${position.value.amanahHeldMinor}) لا يطابق مجموع الأحداث (${amanahMinor}) — انجراف صيغة، لا يُعدّل تلقائيًا.`,
        [],
        Math.abs(position.value.amanahHeldMinor - amanahMinor),
        "/finance",
      );
    return {
      id: "MIC-7",
      titleAr: "رصيد الأمانات",
      status: "PASS",
      detailAr:
        amanahMinor === 0
          ? "لا أمانات محتجزة الآن — الرصيد صفر معلن لا مجهولًا."
          : `رصيد الأمانات المحتجز متطابق مع مجموع الأحداث: ${amanahMinor} — كاش موجود ليس مالك ولا ربحك.`,
    };
  }

  /* ─── MIC-9: صدق درجة المعرفة ───
   * null قيمة: النتيجة غير المتاحة يجب أن تقابل تكلفة غير معروفة معلنة، والعكس.
   * الحالات المعلقة (حصص مؤجلة/تحتاج مراجعة) قرار موثق = تحذير، ليس خطأً. */
  private checkKnowledgeHonesty(
    resultMinor: number | null,
    status: string,
    reasons: readonly string[],
    unknownCostCount: number,
    events: readonly FinancialEvent[],
    from: string,
    to: string,
  ): IntegrityCheckResult {
    if (status === "invalid")
      return {
        id: "MIC-9",
        titleAr: "صدق درجة المعرفة",
        status: "WARN",
        detailAr: "نافذة الفترة غير صالحة — لا يُستنتج شيء عن صدق المعرفة حتى تُقرأ فترة صالحة.",
      };
    /* SA-5 (8): المعلق يُعد داخل نافذة الفحص لا عبر كل التاريخ — تحذير هذا
     * الشهر لأسباب هذا الشهر. */
    const pendingCount = events.filter(
      event =>
        event.occurredOn >= from &&
        event.occurredOn <= to &&
        (event.expenseContext?.sharedProjectShare?.allocation === "unallocated" ||
          event.expenseContext?.knowledge === "needs_review"),
    ).length;
    const resultIsNull = resultMinor === null;
    const unknownDeclared = unknownCostCount > 0;
    /* المعادلة الملزمة: غياب الرقم ⟺ تكلفة غير معروفة معلنة — لا صفر يخفي
     * مجهولًا ولا مجهولًا يُعرض رقمًا (SA-3: نفس صيغة القارئ ٦٢٤–٦٣١). */
    if (resultIsNull !== unknownDeclared)
      return this.fail(
        "MIC-9",
        resultIsNull
          ? "النتيجة غير متاحة مع تكاليف معروفة بالكامل — مجهول بلا سبب يخالف صدق المعرفة."
          : "النتيجة معلنة مع تكلفة غير معروفة مسجلة — رقم يخفي مجهولًا يخالف صدق المعرفة.",
        [],
        null,
        "/finance",
      );
    if (resultIsNull && reasons.length === 0)
      return this.fail(
        "MIC-9",
        "النتيجة غير متاحة بلا أسباب معلنة — مجهول بلا تفسير يخالف صدق المعرفة.",
        [],
        null,
        "/finance",
      );
    if (pendingCount > 0)
      return {
        id: "MIC-9",
        titleAr: "صدق درجة المعرفة",
        status: "WARN",
        detailAr: `${pendingCount} مصروفًا معلقًا (حصة مؤجلة أو تحتاج مراجعة) — قرار معلق، ليس خطأً؛ تصرّح به النتيجة ضمن أسبابها.`,
        offenderCount: pendingCount,
        deepLink: EVENTS_DEEP_LINK,
      };
    if (resultIsNull)
      return {
        id: "MIC-9",
        titleAr: "صدق درجة المعرفة",
        status: "PASS",
        detailAr: "النتيجة غير متاحة لأسباب معلنة (تكلفة غير معروفة) — المجهول يُصرَّح به ولا يُعرض صفرًا.",
      };
    return {
      id: "MIC-9",
      titleAr: "صدق درجة المعرفة",
      status: "PASS",
      detailAr: "نتيجة الفترة معلنة مع تكاليف معروفة، ولا مصاريف معلقة بلا قرار موثق.",
    };
  }

  /* ─── MIC-8 (المجموعة ٢ — عقد ٢٨): سلامة المخزون والمواد ───
   * قراءة فقط للمواد والحركات وسجلات النقص. FAIL = انكسار بنيوي (مراجع معلقة،
   * طيّ سالب، تكرار مفاتيح، كسر قاعدة القيمة-الصفرية ⟺ غير-معروفة). WARN = حالة
   * مراجعة مشروعة (نقص مفتوح، رصيد بداية غير مؤكد صراحةً). الإرث بلا وسم المتابعة
   * أو بلا حقل معرفة البداية = متتبَّع/معروف (لا إنذارات كاذبة على المواد القديمة). */
  private async checkInventoryStructure(): Promise<IntegrityCheckResult> {
    const [materialsResult, movementsResult, shortagesResult, purchasesResult, ordersResult] =
      await Promise.all([
        this.store.listMaterials(),
        this.store.listInventoryMovements(),
        this.store.listInventoryShortages(),
        this.store.listSupplierPurchases(),
        this.store.listOrders(),
      ]);
    if (
      !materialsResult.ok ||
      !movementsResult.ok ||
      !shortagesResult.ok ||
      !purchasesResult.ok ||
      !ordersResult.ok
    )
      return this.fail("MIC-8", "تعذر قراءة سجل المخزون والمواد — أعد المحاولة.", []);
    const materials = materialsResult.value;
    const movements = movementsResult.value;
    const shortages = shortagesResult.value;
    const materialIds = new Set(materials.map(material => material.id));
    const purchaseIds = new Set(purchasesResult.value.map(purchase => purchase.id));
    const orderIds = new Set(ordersResult.value.map(stored => stored.id));
    const structuralOffenders: string[] = [];
    const reversedTargets = new Set<string>();
    const operationKeys = new Set<string>();
    const structural = (movement: InventoryMovement) => {
      if (!materialIds.has(movement.materialId)) {
        structuralOffenders.push(`حركة-بلا-مادة:${movement.id}`);
        return;
      }
      if (movement.purchaseId !== null && !purchaseIds.has(movement.purchaseId))
        structuralOffenders.push(`استلام-بلا-شراء:${movement.id}`);
      if (movement.orderId !== null && !orderIds.has(movement.orderId))
        structuralOffenders.push(`حركة-بلا-طلب:${movement.id}`);
      /* القيمة الصفرية ⇐ تكلفة غير معروفة — ولا وسم غير معروفة على قيمة معلنة. */
      const costKnowledge = movement.costKnowledge ?? "known";
      if (movement.valueDeltaMinor === 0 && costKnowledge !== "unknown")
        structuralOffenders.push(`قيمة-صفرية-بلا-وسم:${movement.id}`);
      if (movement.valueDeltaMinor !== 0 && costKnowledge === "unknown")
        structuralOffenders.push(`وسم-غير-معروفة-بقيمة:${movement.id}`);
      if (movement.type === "reversal") {
        const target = movement.reversesMovementId ?? "";
        if (target === "" || !movements.some(candidate => candidate.id === target))
          structuralOffenders.push(`تراجع-بلا-أصل:${movement.id}`);
        if (reversedTargets.has(target)) structuralOffenders.push(`تراجع-مزدوج:${target}`);
        reversedTargets.add(target);
      }
    };
    for (const movement of movements) {
      structural(movement);
      if (operationKeys.has(movement.operationKey))
        structuralOffenders.push(`مفتاح-مكرر:${movement.operationKey}`);
      operationKeys.add(movement.operationKey);
    }
    const openShortages = shortages.filter(shortage => shortage.status === "open");
    for (const shortage of shortages) {
      if (!materialIds.has(shortage.materialId)) {
        structuralOffenders.push(`نقص-بلا-مادة:${shortage.id}`);
        continue;
      }
      /* SA-5 (F11): مرجع طلب النقص موصول — إن وُجد. */
      if (shortage.orderId !== null && !orderIds.has(shortage.orderId))
        structuralOffenders.push(`نقص-بلا-طلب:${shortage.id}`);
      if (operationKeys.has(shortage.operationKey))
        structuralOffenders.push(`مفتاح-نقص-مكرر:${shortage.operationKey}`);
      operationKeys.add(shortage.operationKey);
    }
    /* طيّ غير سالب لكل مادة — نتيجة الكتابة المحروسة، كاشنة هنا فقط. */
    for (const material of materials) {
      const selected = movements.filter(movement => movement.materialId === material.id);
      const quantityMilli = selected.reduce((sum, movement) => sum + movement.quantityDeltaMilli, 0);
      const valueMinor = selected.reduce((sum, movement) => sum + movement.valueDeltaMinor, 0);
      if (quantityMilli < 0 || valueMinor < 0) structuralOffenders.push(`طيّ-سالب:${material.id}`);
    }
    if (structuralOffenders.length > 0)
      return this.fail(
        "MIC-8",
        `بنية المخزون مكسورة في ${structuralOffenders.length} موضعًا — راجع المواد والحركات قبل أي تصحيح.`,
        structuralOffenders,
        null,
        "/inventory",
      );
    if (openShortages.length > 0) {
      const sample = openShortages[0]!;
      const sampleMaterial = materials.find(material => material.id === sample.materialId);
      return {
        id: "MIC-8",
        titleAr: INTEGRITY_TITLES["MIC-8"],
        status: "WARN",
        detailAr: `نقص مخزون مفتوح: ${openShortages.length} سجلًا — أقربها «${sampleMaterial?.name ?? sample.materialId}» بتاريخ ${sample.occurredOn}. سجلات النقص تُحلّ صراحةً عند وصول البديل، ولا تُغلق تلقائيًا.`,
        offenderCount: openShortages.length,
        deepLink: "/inventory",
      };
    }
    const unconfirmedOpening = materials.filter(
      material => material.opening?.quantityState === "unconfirmed",
    );
    if (unconfirmedOpening.length > 0)
      return {
        id: "MIC-8",
        titleAr: INTEGRITY_TITLES["MIC-8"],
        status: "WARN",
        detailAr: `مواد متتبَّعة برصيد بداية غير مؤكد: ${unconfirmedOpening.length} — أرصدتها معروضة «غير محدد بعد» حتى تؤكدها؛ ليست صفرًا ولا خطأً.`,
        offenderCount: unconfirmedOpening.length,
        deepLink: "/inventory",
      };
    return {
      id: "MIC-8",
      titleAr: INTEGRITY_TITLES["MIC-8"],
      status: "PASS",
      detailAr: "بنية المخزون والمواد سليمة: المراجع موصولة، والطيّ غير سالب، ولا نقص مفتوح.",
    };
  }


  /* ─── MIC-10 (المجموعة ٤): الأصول — الاقتناء مقابل الكاش/الذمم، والإهلاك
   * مقابل الدفتري، والتخلص/الشطب مقابل حالة السجل. كل عدم تطابق خلل صريح. */
  private async checkAssetIntegrity(events: readonly FinancialEvent[]): Promise<IntegrityCheckResult> {
    const assetsResult = await this.store.listAssets();
    if (!assetsResult.ok)
      return this.fail("MIC-10", "تعذر قراءة سجل الأصول — أعد المحاولة.", []);
    const assets = assetsResult.value;
    const reversed = reversedEventIds(events);
    const offenders: string[] = [];
    const warnOffenders: string[] = [];
    for (const asset of assets) {
      const acquisition = events.find(event => event.id === asset.acquisitionEventId);
      if (!acquisition || acquisition.assetContext?.assetId !== asset.id) {
        offenders.push(`أصل-بلا-اقتناء:${asset.id}`);
        continue;
      }
      const acquisitionActive = acquisition.correctionType !== "reverse" && !reversed.has(acquisition.id);
      /* جولة الاستئناف (F-2b): الاسترجاع يعيد القيم الأصلية حدثًا جديدًا — حين
       * يوجد حدث استرجاع فعّال لنفس الاقتناء (مفتاح restore: الحتمي) فأثر
       * الاقتناء قائم وإن بقي رابط سجل الأصل يشير إلى الحدث المعكوس. الفحص
       * يقرأ الأثر الفعلي لا الرابط التاريخي. */
      const restoredAcquisition = acquisitionActive
        ? null
        : (events.find(
            event =>
              event.idempotencyKey === `restore:${asset.acquisitionEventId}` &&
              event.assetContext?.assetId === asset.id &&
              event.type === acquisition.type &&
              event.correctionType !== "reverse" &&
              !reversed.has(event.id),
          ) ?? null);
      const effectiveAcquisition = acquisitionActive ? acquisition : restoredAcquisition;
      if (!effectiveAcquisition) offenders.push(`اقتناء-معكوس:${asset.id}`);
      else if (
        effectiveAcquisition.amountMinor !== asset.acquisitionAmountMinor ||
        effectiveAcquisition.type !==
          (asset.acquisitionKind === "cash" ? "asset_purchase_cash" : "asset_purchase_payable")
      )
        offenders.push(`اقتناء-لا-يطابق:${asset.id}`);
      const active = events.filter(
        event => event.assetContext?.assetId === asset.id && event.correctionType !== "reverse" && !reversed.has(event.id),
      );
      let bookValue = 0;
      for (const event of active) bookValue += event.assetDeltaMinor ?? 0;
      if (bookValue < 0) offenders.push(`دفتري-سالب:${asset.id}`);
      const depreciation = active
        .filter(event => event.type === "asset_depreciation")
        .reduce((sum, event) => sum + event.amountMinor, 0);
      if (effectiveAcquisition && depreciation > asset.acquisitionAmountMinor)
        offenders.push(`إهلاك-فوق-القيمة:${asset.id}`);
      if (asset.status === "disposed" && !active.some(event => event.type === "asset_disposal_cash"))
        offenders.push(`تخلص-بلا-حدث:${asset.id}`);
      if (asset.status === "written_off" && !active.some(event => event.type === "asset_writeoff"))
        offenders.push(`شطب-بلا-حدث:${asset.id}`);
      if (asset.status === "active" && (asset.disposal || asset.writeOff)) offenders.push(`حالة-متناقضة:${asset.id}`);
      if (asset.disposal && active.some(event => event.id === asset.disposal!.eventId && event.correctionType === "reverse"))
        warnOffenders.push(`تخلص-معكوس:${asset.id}`);
      /* تحذير: مستحق غير مسجّل — اقتراح ظاهر لا يخصم نفسه. */
      if (asset.status === "active" && asset.lifeMonths === null) warnOffenders.push(`عمر-مجهول:${asset.id}`);
    }
    if (offenders.length > 0)
      return this.fail(
        "MIC-10",
        `سلامة الأصول مكسورة في ${offenders.length} موضعًا — راجع الأصل وحدثه قبل أي تصحيح.`,
        offenders,
        null,
        "/assets",
      );
    if (warnOffenders.length > 0)
      return {
        id: "MIC-10",
        titleAr: INTEGRITY_TITLES["MIC-10"],
        status: "WARN",
        detailAr: `أصول بحاجة انتباه: ${warnOffenders.length} — منها أصول بعمر نافع مجهول لا يُهلك منها شيء حتى تُحدده، وأصول معكوس تخلصها. كلها حالات معلنة لا أرقام مخفية.`,
        offenderCount: warnOffenders.length,
        offenderSampleIds: warnOffenders.slice(0, 5),
        deepLink: "/assets",
      };
    return {
      id: "MIC-10",
      titleAr: INTEGRITY_TITLES["MIC-10"],
      status: "PASS",
      detailAr:
        assets.length === 0
          ? "لا أصول مسجلة بعد — سجل أول أصل من «مالي ← الأصول»."
          : "الأصول سليمة: كل اقتناء بحادثه، والإهلاك ضمن قيمة الشراء، والحالة تطابق الأحداث.",
    };
  }

  /* ─── MIC-11 (المجموعة ٤): القروض — الأصل مقابل الكاش والرصيد القائم،
   * والسداد مقابل الكاش والدفعات، وتراجع الدفعات مقابل علاماتها. */
  private async checkLoanIntegrity(events: readonly FinancialEvent[]): Promise<IntegrityCheckResult> {
    const loansResult = await this.store.listLoans();
    if (!loansResult.ok)
      return this.fail("MIC-11", "تعذر قراءة سجل القروض — أعد المحاولة.", []);
    const loans = loansResult.value;
    const reversed = reversedEventIds(events);
    const offenders: string[] = [];
    for (const loan of loans) {
      const principal = events.find(event => event.id === loan.principalEventId);
      if (!principal || principal.loanContext?.loanId !== loan.id) {
        offenders.push(`قرض-بلا-أصل:${loan.id}`);
        continue;
      }
      const principalActive = principal.correctionType !== "reverse" && !reversed.has(principal.id);
      if (!principalActive) offenders.push(`أصل-معكوس:${loan.id}`);
      else if (principal.amountMinor !== loan.principalMinor) offenders.push(`أصل-لا-يطابق:${loan.id}`);
      for (const repayment of loan.repayments) {
        const event = events.find(candidate => candidate.id === repayment.eventId);
        if (!event || event.loanContext?.loanId !== loan.id) {
          offenders.push(`دفعة-بلا-حدث:${repayment.id}`);
          continue;
        }
        const active = event.correctionType !== "reverse" && !reversed.has(event.id);
        const markedReversed = repayment.reversal !== null;
        if (active !== !markedReversed) offenders.push(`دفعة-حالة-متناقضة:${repayment.id}`);
        if (active && event.amountMinor !== repayment.amountMinor)
          offenders.push(`دفعة-لا-تطابق:${repayment.id}`);
        if (markedReversed) {
          const reversalExists = events.some(
            candidate => candidate.id === repayment.reversal!.reversalEventId,
          );
          if (!reversalExists) offenders.push(`تراجع-بلا-حدث:${repayment.id}`);
        }
      }
      const repaidActive = loan.repayments
        .filter(repayment => repayment.reversal === null)
        .reduce((sum, repayment) => sum + repayment.amountMinor, 0);
      if (repaidActive > loan.principalMinor) offenders.push(`سداد-فوق-الأصل:${loan.id}`);
    }
    if (offenders.length > 0)
      return this.fail(
        "MIC-11",
        `سلامة القروض مكسورة في ${offenders.length} موضعًا — راجع القرض ودفعاته قبل أي تصحيح.`,
        offenders,
        null,
        "/loans",
      );
    return {
      id: "MIC-11",
      titleAr: INTEGRITY_TITLES["MIC-11"],
      status: "PASS",
      detailAr:
        loans.length === 0
          ? "لا قروض صادرة مسجلة بعد — سجلها من «مالي ← القروض»."
          : "القروض سليمة: كل أصل بحادثه، وكل دفعة بحادثها، والمتبقي مشتق بلا رصيد مخزن.",
    };
  }

  /* ─── MIC-12 (المجموعة ٤): تصنيف العربون المحتفظ — القرار مقابل الحدث،
   * ولا تصنيف مزدوج ولا إيراد معترف مرتين. المعلق تحذير ظاهر لا خلل. */
  private async checkRetainedDepositIntegrity(events: readonly FinancialEvent[]): Promise<IntegrityCheckResult> {
    const ordersResult = await this.store.listOrders();
    if (!ordersResult.ok)
      return this.fail("MIC-12", "تعذر قراءة الطلبات المحلية — أعد المحاولة.", []);
    const reversed = reversedEventIds(events);
    const offenders: string[] = [];
    let pendingCount = 0;
    let pendingMinor = 0;
    const activeClassificationEventIds = new Set(
      events
        .filter(
          event =>
            (event.type === "deposit_retained_revenue" || event.type === "deposit_retained_owner") &&
            event.correctionType !== "reverse" &&
            !reversed.has(event.id),
        )
        .map(event => event.depositContext?.orderId ?? `بلا-طلب:${event.id}`),
    );
    for (const stored of ordersResult.value) {
      const order = stored.order;
      if (order.status !== "cancelled") continue;
      if (order.depositSettlement === "retain_deposit") {
        const hasActiveEvent = activeClassificationEventIds.has(stored.id);
        const meaning = order.retainedMeaning ?? null;
        if (meaning !== null && !hasActiveEvent) offenders.push(`تصنيف-بلا-حدث:${stored.id}`);
        if (meaning === null && hasActiveEvent) offenders.push(`حدث-بلا-تصنيف:${stored.id}`);
        if (meaning === null) {
          pendingCount += 1;
          pendingMinor += order.depositCollectedMinor;
        }
      } else if (activeClassificationEventIds.has(stored.id)) {
        offenders.push(`تصنيف-بلا-احتفاظ:${stored.id}`);
      }
    }
    for (const orderId of activeClassificationEventIds) {
      if (orderId.startsWith("بلا-طلب")) offenders.push(orderId);
    }
    if (offenders.length > 0)
      return this.fail(
        "MIC-12",
        `سلامة تصنيف العربون مكسورة في ${offenders.length} موضعًا — راجع طلب الإلغاء وقراره قبل أي تصحيح.`,
        offenders,
        null,
        "/finance",
      );
    if (pendingCount > 0)
      return {
        id: "MIC-12",
        titleAr: INTEGRITY_TITLES["MIC-12"],
        status: "WARN",
        detailAr: `عربونات محتفظة بانتظار قرارك: ${pendingCount} بقيمة ${Math.round(pendingMinor / 100)} د.أ — الكاش محتفظ به بلا معنى حتى تصنّفه (مال مالك أو إيراد مشروع) من صفحة الطلب.`,
        offenderCount: pendingCount,
        driftMinor: pendingMinor,
        deepLink: "/finance",
      };
    return {
      id: "MIC-12",
      titleAr: INTEGRITY_TITLES["MIC-12"],
      status: "PASS",
      detailAr: "تصنيف العربون المحتفظ سليم: كل قرار بحادثه، ولا إيراد مزدوج ولا كاش جديد.",
    };
  }

  /* ─── MIC-13 (المجموعة ٤): استهلاك التسليم مقابل مصدره — كل حركة استهلاك
   * بمفتاح تسليم تخص حدث تسليم فعلًا، وكل تسليم معكوس جرى عكس حركاته.
   * تصحيح مراجعة 4-c: الاستخراج القديم split(":")[2] كان يعيد معرف الطلب لا
   * معرف حدث التسليم (المعرف نفسه يحوي فواصل) فلم يتحقق الربط أبدًا، وفرع
   * المرآة الأول كان ميتًا لا يفعل شيئًا — هنا يتحققان فعليًا. */
  private async checkDeliveryConsumptionIntegrity(): Promise<IntegrityCheckResult> {
    const [ordersResult, movementsResult] = await Promise.all([
      this.store.listOrders(),
      this.store.listInventoryMovements(),
    ]);
    if (!ordersResult.ok || !movementsResult.ok)
      return this.fail("MIC-13", "تعذر قراءة بيانات استهلاك التسليم — أعد المحاولة.", []);
    const movements = movementsResult.value;
    const offenders: string[] = [];
    for (const stored of ordersResult.value) {
      const order = stored.order;
      const deliveryEvents = order.events.filter(
        event => event.type === "status_changed" && event.toStatus === "delivered",
      );
      const reversedDeliveryEventIds = new Set(
        order.events
          .filter(event => event.type === "delivery_reversed")
          .map(event => (event as { reversesEventId?: string }).reversesEventId)
          .filter((id): id is string => typeof id === "string"),
      );
      const prefix = `${stored.id}:deliver:`;
      const deliveryLinked = movements.filter(
        movement =>
          movement.orderId === stored.id &&
          movement.type === "consumption" &&
          movement.operationKey.startsWith(prefix),
      );
      for (const movement of deliveryLinked) {
        /* معرف حدث التسليم مضمّن بين البادئة الحتمية وآخر فاصل قبل المادة. */
        const withoutPrefix = movement.operationKey.slice(prefix.length);
        const lastColon = withoutPrefix.lastIndexOf(":");
        const deliveryEventId = lastColon > 0 ? withoutPrefix.slice(0, lastColon) : null;
        const knownDelivery =
          deliveryEventId !== null && deliveryEvents.some(event => event.id === deliveryEventId);
        if (!knownDelivery) {
          offenders.push(`حركة-بلا-تسليم:${movement.id}`);
          continue;
        }
        /* تسليم معكوس: كل حركة استهلاك مرتبطة به تستلزم مرآة عكسها. */
        if (deliveryEventId !== null && reversedDeliveryEventIds.has(deliveryEventId)) {
          const mirrored = movements.some(
            candidate =>
              candidate.type === "reversal" &&
              candidate.reversesMovementId === movement.id &&
              candidate.operationKey === `${movement.operationKey}:reversal`,
          );
          if (!mirrored) offenders.push(`عكس-ناقص-مرآة:${movement.id}`);
        }
      }
    }
    if (offenders.length > 0)
      return this.fail(
        "MIC-13",
        `ربط استهلاك التسليم بمصدره مكسور في ${offenders.length} موضعًا — راجع الطلب وحركات المواد قبل أي تصحيح.`,
        offenders,
        null,
        "/orders",
      );
    return {
      id: "MIC-13",
      titleAr: INTEGRITY_TITLES["MIC-13"],
      status: "PASS",
      detailAr: "استهلاك التسليم مربوط بمصدره: كل حركة بمفتاح حتمي، وكل عكس بمرآته.",
    };
  }

  /* ─── MIC-14 (المجموعة ٥): صحة الكاش غير الموزّع — الكاش الكلي مسجل
   * المصادر، وما لم يخصص بعد ليس خطأً بل حالة معلنة (عربونات اتفاق، قبض لم
   * يوزّع). السالب وحده تحذير صادق: إنفاق فوق مصادر مسجلة. عربونات الطلبات
   * الملغاة بلا تسوية (needs_review) تدخل المعلق ذاته — قرار معلق لا رقم مختفي. */
  private async checkUnallocatedCashTruth(): Promise<IntegrityCheckResult> {
    const [positionResult, ordersResult] = await Promise.all([
      this.projectFinance.readPosition(),
      this.store.listOrders(),
    ]);
    if (!positionResult.ok || !ordersResult.ok)
      return this.fail("MIC-14", "تعذر قراءة مركز الكاش غير الموزّع — أعد المحاولة.", []);
    const unallocated = positionResult.value.unallocatedCashMinor;
    const needsReview = ordersResult.value.filter(
      stored => stored.order.status === "cancelled" && stored.order.depositSettlement === "needs_review",
    );
    const needsReviewMinor = needsReview.reduce((sum, stored) => sum + stored.order.depositCollectedMinor, 0);
    if (unallocated < 0) {
      return {
        id: "MIC-14",
        titleAr: INTEGRITY_TITLES["MIC-14"],
        status: "WARN",
        detailAr: `الكاش غير الموزّع سالب (${Math.round(-unallocated / 100)} د.أ) — أنفقت أو خصّصت أكثر من مصادر الكاش المسجلة؛ راجع مصدر الفرق قبل الاعتماد على أي رصيد محفظة.`,
        driftMinor: -unallocated,
        deepLink: "/cash",
      };
    }
    const pendingNote =
      needsReview.length > 0
        ? ` وفيها ${needsReview.length} طلبًا ملغى بعربون بلا تسوية (${Math.round(needsReviewMinor / 100)} د.أ) — قراري الرد/الاحتفاظ بانتظارك من صفحة الطلب.`
        : "";
    return {
      id: "MIC-14",
      titleAr: INTEGRITY_TITLES["MIC-14"],
      status: "PASS",
      detailAr:
        unallocated === 0
          ? "لا كاش غير موزّع — كل ما سُجل مصادرّه وتخصيصاته متسقة."
          : `كاش غير موزّع: ${Math.round(unallocated / 100)} د.أ — حالة معلنة لا خطأً: عربونات اتفاق وقبض لم يوزّع بعد؛ وزّعه للمحافظ حين تجهز.${pendingNote}`,
      driftMinor: unallocated,
      deepLink: "/cash",
    };
  }

  /* ─── MIC-15 (المجموعة ٥): تفرّد مفاتيح الحتمية — طبقة التحقق نفسها التي
   * يفرضها الاستيراد على الملفات، لكن على المخزن الحيّ: نسخة معدّلة يدويًا
   * بمعرّف جديد ومفتاح مكرر تمرّ من كل الفحوص الأخرى وتُمسك هنا فقط. */
  private checkEventKeyUniqueness(events: readonly FinancialEvent[]): IntegrityCheckResult {
    const seen = new Map<string, number>();
    for (const event of events) seen.set(event.idempotencyKey, (seen.get(event.idempotencyKey) ?? 0) + 1);
    const duplicates = events.filter(event => (seen.get(event.idempotencyKey) ?? 0) > 1);
    if (duplicates.length > 0) {
      return this.fail(
        "MIC-15",
        `مفاتيح حتمية مكررة في ${duplicates.length} حدثًا — قد يكرّر أثرًا ماليًا؛ راجع السجل والتصحيح الموثق قبل الاعتماد على أي رقم.`,
        duplicates.map(event => event.id),
        null,
        EVENTS_DEEP_LINK,
      );
    }
    return {
      id: "MIC-15",
      titleAr: INTEGRITY_TITLES["MIC-15"],
      status: "PASS",
      detailAr: "كل حدث مفتاحه فريد — لا أثر مالي مكرر في سجلك الحي.",
    };
  }

  /* ─── MIC-16 (المجموعة ٥): فصل مال المالك — قاعدة جدول الدلتا نفسها:
   * دلتا رأس مال المالك لا تسكن إلا أنواع المالك (استثمار/سحب/عربون-مالك)،
   * وأنواع المالك لا تحمل مصروفًا ولا إيرادًا معلنًا. أي خلط = تسريب مال
   * المالك إلى النتيجة أو العكس — يُعرض لا يُصلح. */
  private checkOwnerMoneySeparation(events: readonly FinancialEvent[]): IntegrityCheckResult {
    const OWNER_TYPES = new Set([
      "owner_investment_cash",
      "owner_withdrawal_cash",
      "deposit_retained_owner",
    ]);
    const offenders: string[] = [];
    for (const event of events) {
      const ownerDelta = event.ownerCapitalDeltaMinor;
      const isOwnerType = OWNER_TYPES.has(event.type);
      if (ownerDelta !== 0 && !isOwnerType) offenders.push(`مال-مالك-في-غير-نوعه:${event.id}`);
      if (isOwnerType && ownerDelta === 0 && event.correctionType !== "reverse")
        offenders.push(`نوع-مالك-بلا-أثر:${event.id}`);
      if (isOwnerType && (event.operatingExpenseDeltaMinor !== 0 || (event.revenueDeltaMinor ?? 0) !== 0))
        offenders.push(`مالك-يخالط-النتيجة:${event.id}`);
    }
    if (offenders.length > 0) {
      return this.fail(
        "MIC-16",
        `فصل مال المالك مكسور في ${offenders.length} موضعًا — مال المالك أو عربونه اختلط بالمصروف/الإيراد؛ صحّح بالتراجع الموثق من سطحه.`,
        offenders,
        null,
        EVENTS_DEEP_LINK,
      );
    }
    return {
      id: "MIC-16",
      titleAr: INTEGRITY_TITLES["MIC-16"],
      status: "PASS",
      detailAr:
        "مال المالك مفصول: الاستثمار والسحب والعربون-المالك لا يدخلون نتيجة الفترة ولا مصاريفها أبدًا.",
    };
  }

  private fail(
    id: IntegrityCheckId,
    detailAr: string,
    offenders: readonly string[],
    driftMinor: number | null = null,
    deepLink: string | null = null,
  ): IntegrityCheckResult {
    return {
      id,
      titleAr: INTEGRITY_TITLES[id],
      status: "FAIL",
      detailAr,
      driftMinor,
      offenderCount: offenders.length,
      offenderSampleIds: offenders.slice(0, 5),
      deepLink,
    };
  }
}

export const INTEGRITY_TITLES: Record<IntegrityCheckId, string> = {
  "MIC-1": "تطابق نتيجة الفترة",
  "MIC-2": "بنية الكاش والمحافظ",
  "MIC-4": "سلامة الأحداث والتوزيع",
  "MIC-7": "رصيد الأمانات",
  "MIC-8": "سلامة المخزون والمواد",
  "MIC-9": "صدق درجة المعرفة",
  "MIC-10": "سلامة الأصول والإهلاك",
  "MIC-11": "سلامة القروض والسداد",
  "MIC-12": "تصنيف العربون المحتفظ",
  "MIC-13": "ربط استهلاك التسليم",
  /* المجموعة ٥ (عقد ٣٥): فحوص الاستمرارية الثلاثة. */
  "MIC-14": "صحة الكاش غير الموزّع",
  "MIC-15": "تفرّد مفاتيح الأحداث",
  "MIC-16": "فصل مال المالك",
};
