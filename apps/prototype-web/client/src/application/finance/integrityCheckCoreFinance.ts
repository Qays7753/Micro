/**
 * المجموعة ١ (فحص سلامة مالي — الأساس): فحوص النواة المالية — MIC-1/MIC-2/
 * MIC-4/MIC-7/MIC-9 (تطابق نتيجة الفترة، بنية الكاش، سلامة الأحداث والتوزيع،
 * الأمانات، صدق حالة الرقم — قاموس 08:103). انتقلت حرفيًا من
 * integrityCheckService.ts في Wave F (ADR-013 — تقسيم مسؤولية داخلي) —
 * الخدمة المُنسِّقة هي التي تحفظ الترتيب والسياق.
 *
 * الوعد ملزم معماريًا: كل استدعاء هنا يستعمل مسارات قراءة فقط (list و read
 * فقط). الفحص لا يخترع قواعد جديدة: كل قاعدة مشتقة من عقد مجال مُختبر
 * (قاعدة الدلتا الخماسية، إعادة اشتقاق النسبة، قواعد المصدر والتوزيع).
 */
import {
  createFinancialEvent,
  createFinancialReversal,
  reversedEventIds,
  summarizeFinancialEvents,
} from "@micro-domain/financial-event/index.js";
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";
import type { CashContinuityEntry } from "@micro-domain/cash-continuity/index.js";
/* EXE-003 (AUD-NEW-03): القائمة القانونية لأنواع مصادر التخصيص تُستورد من
 * الدومين نفسه — لا نسخة مكررة داخل الفاحص تنحرف عنه (المسار الذي جعل MIC-2
 * يفشل زائفًا على دفعة مورد من محفظة بعد إصلاح FIN-003). */
import { SOURCE_REF_KINDS } from "@micro-domain/cash-continuity/index.js";
import {
  EVENTS_DEEP_LINK,
  eventDeepLink,
  fail,
  unavailable,
  type IntegrityCheckContext,
  type IntegrityCheckResult,
} from "./integrityCheckModel";

/* EXE-003: النوع مشتق من ثابت الدومين المستورد — أي إضافة نوع مستقبلي تظهر
 * تلقائيًا في الفحص بلا تحديث يدوي هنا. */
type SourceRefKind = (typeof SOURCE_REF_KINDS)[number];

/* ─── MIC-1: تطابق نتيجة الفترة عبر الأسطح (القارئ الكنوني) ───
 * القارئ الواحد `readRecordedPeriodResult` هو المنتج الوحيد لرقم الفترة؛
 * الكشف والمؤشرات يستهلكانه. null قيمة معلنة: كل سطح يعرض «غير متاح + أسباب». */
export async function checkPeriodResultConsistency(
  ctx: IntegrityCheckContext,
  from: string,
  to: string,
): Promise<{
  result: IntegrityCheckResult;
  readerResultMinor: number | null;
  readerStatus: string;
  readerReasons: readonly string[];
  readerUnknownCostCount: number;
}> {
  const reader = await ctx.projectFinance.readRecordedPeriodResult(from, to);
  const statement = await ctx.statementService.read(from, to);
  const insights = await ctx.projectFinance.readFinancialInsights(from, to);
  if (!reader.ok || !statement.ok || !insights.ok)
    return {
      result: unavailable("MIC-1", "تعذر قراءة نتيجة الفترة من السجلات المحلية — أعد المحاولة."),
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
        detailAr:
          readerValue.resultMinor === null
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
    result: fail(
      "MIC-1",
      `اختلاف بين أسطح نتيجة الفترة: القارئ الكنوني ${readerValue.resultMinor === null ? "غير متاح" : readerValue.resultMinor} والكشف ${statementResult.resultMinor === null ? "غير متاح" : statementResult.resultMinor} — راجع ولا يُعدّل شيء تلقائيًا.`,
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
export async function checkCashStructure(ctx: IntegrityCheckContext): Promise<IntegrityCheckResult> {
  const [overview, entriesResult] = await Promise.all([
    ctx.cashContinuity.overview(),
    ctx.cashContinuity.entries(),
  ]);
  if (!overview.ok || !entriesResult.ok)
    return unavailable("MIC-2", "تعذر قراءة محافظ الكاش — أعد المحاولة.");
  const entries = entriesResult.value;
  const structural: string[] = [];
  const review: string[] = [];

  for (const wallet of overview.value.wallets)
    if (wallet.balanceMinor < 0)
      review.push(
        wallet.openingUnknown ? `محفظة ${wallet.name} — رصيد افتتاحي غير معلن بعد` : `محفظة ${wallet.name}`,
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
    if (!isTransferPair && !isReversalPair) structural.push(...group.map(entry => entry.id));
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
    if (!original || original.type === "reversal" || entry.cashDeltaMinor !== -original.cashDeltaMinor)
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
    return fail(
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
export function checkEventAndAllocationIntegrity(events: readonly FinancialEvent[]): IntegrityCheckResult {
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
          /* FIN-001 (WS-178 — Wave 6): عمود التزام الاقتراض يُفحص كإخوته —
           * أي فرق بين المعاد والمسجل = تلف أو تلاعب. */
          (rebuilt.loanPayableDeltaMinor ?? 0) !== (event.loanPayableDeltaMinor ?? 0) ||
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
        /* FIN-001 (WS-178 — Wave 6): عمود التزام الاقتراض يُفحص كإخوته. */
        (rebuilt.loanPayableDeltaMinor ?? 0) !== (event.loanPayableDeltaMinor ?? 0) ||
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
  return fail(
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
export async function checkAmanahReadBack(
  ctx: IntegrityCheckContext,
  events: readonly FinancialEvent[],
): Promise<IntegrityCheckResult> {
  const amanahMinor = summarizeFinancialEvents(events).amanahMinor;
  const position = await ctx.projectFinance.readPosition();
  if (!position.ok) return unavailable("MIC-7", "تعذر قراءة الموقف المالي — أعد المحاولة.");
  if (amanahMinor < 0)
    return fail(
      "MIC-7",
      `رصيد الأمانات سالب (${amanahMinor}) — سلّمت أكثر مما قبضت: مستحيل بالكتابة الحية، راجع الاستيراد أو السجل.`,
      [],
      Math.abs(amanahMinor),
      "/finance",
    );
  if (position.value.amanahHeldMinor !== amanahMinor)
    return fail(
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

/* ─── MIC-9: صدق حالة الرقم (قاموس 08:103 — «درجة المعرفة» ممنوعة) ───
 * null قيمة: النتيجة غير المتاحة يجب أن تقابل تكلفة غير معروفة معلنة، والعكس.
 * الحالات المعلقة (حصص مؤجلة/تحتاج مراجعة) قرار موثق = تحذير، ليس خطأً. */
export function checkKnowledgeHonesty(
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
      titleAr: "صدق حالة الرقم",
      status: "WARN",
      detailAr: "نافذة الفترة غير صالحة — لا يُستنتج شيء عن صدق حالة الرقم حتى تُقرأ فترة صالحة.",
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
    return fail(
      "MIC-9",
      resultIsNull
        ? "النتيجة غير متاحة مع تكاليف معروفة بالكامل — مجهول بلا سبب."
        : "النتيجة معلنة مع تكلفة غير معروفة مسجلة — رقم يخفي مجهولًا.",
      [],
      null,
      "/finance",
    );
  if (resultIsNull && reasons.length === 0)
    return fail("MIC-9", "النتيجة غير متاحة بلا أسباب معلنة — مجهول بلا تفسير.", [], null, "/finance");
  if (pendingCount > 0)
    return {
      id: "MIC-9",
      titleAr: "صدق حالة الرقم",
      status: "WARN",
      detailAr: `${pendingCount} مصروفًا معلقًا (حصة مؤجلة أو تحتاج مراجعة) — قرار معلق، ليس خطأً؛ تصرّح به النتيجة ضمن أسبابها.`,
      offenderCount: pendingCount,
      deepLink: EVENTS_DEEP_LINK,
    };
  if (resultIsNull)
    return {
      id: "MIC-9",
      titleAr: "صدق حالة الرقم",
      status: "PASS",
      detailAr: "النتيجة غير متاحة لأسباب معلنة (تكلفة غير معروفة) — المجهول يُصرَّح به ولا يُعرض صفرًا.",
    };
  return {
    id: "MIC-9",
    titleAr: "صدق حالة الرقم",
    status: "PASS",
    detailAr: "نتيجة الفترة معلنة مع تكاليف معروفة، ولا مصاريف معلقة بلا قرار موثق.",
  };
}
