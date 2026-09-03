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
import type { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import type { StatementService } from "@/application/finance/statementService";
import type { CashContinuityService } from "@/application/cash/cashContinuityService";
import type { PrototypeLocalStore } from "@/storage/local/types";
import { localDateInAmman as ammanDate } from "@/presentation/formatters";

export type IntegrityCheckStatus = "PASS" | "WARN" | "FAIL";
export type IntegrityCheckId = "MIC-1" | "MIC-2" | "MIC-4" | "MIC-7" | "MIC-9";
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
    const mic9 = this.checkKnowledgeHonesty(
      mic1.readerResultMinor,
      mic1.readerStatus,
      mic1.readerReasons,
      mic1.readerUnknownCostCount,
      events,
      from,
      to,
    );
    return this.report(from, to, [mic1.result, mic2, mic4, mic7, mic9]);
  }

  private report(from: string, to: string, checks: readonly IntegrityCheckResult[]): IntegrityCheckReport {
    const overall: IntegrityCheckStatus = checks.some(check => check.status === "FAIL")
      ? "FAIL"
      : checks.some(check => check.status === "WARN")
        ? "WARN"
        : "PASS";
    return { runAt: this.now(), from, to, overall, checks };
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
            JSON.stringify(rebuilt.expenseContext ?? null) !== JSON.stringify(event.expenseContext ?? null)
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
        });
        if (
          rebuilt.cashDeltaMinor !== event.cashDeltaMinor ||
          rebuilt.payableDeltaMinor !== event.payableDeltaMinor ||
          rebuilt.ownerCapitalDeltaMinor !== event.ownerCapitalDeltaMinor ||
          rebuilt.operatingExpenseDeltaMinor !== event.operatingExpenseDeltaMinor ||
          (rebuilt.amanahDeltaMinor ?? 0) !== (event.amanahDeltaMinor ?? 0)
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
        detailAr: `${events.length} حدثًا ماليًا طابق كلٌّ منها أثره الخماسي وحصصه عند إعادة الاشتقاق من عقد المجال.`,
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
  "MIC-9": "صدق درجة المعرفة",
};
