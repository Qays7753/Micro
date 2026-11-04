/**
 * S14 (DOC-023 / UNIT-002 + ACC-01/JRN-010 — أمر ba2ce7b4 §5): منسق استكمال
 * الحسابات — رحلة اختيارية تنظم الأسئلة والمعاينة والمراجعة والعودة، لا
 * دفترًا ماليًا ثانٍ ولا كاتبًا موازيًا:
 *
 *  • القراءة والمعاينة بلا مال (ACC-A/§7.2): readContext/buildPlan خالصان —
 *    لا كتابة قبل الالتزام الصريح، ولا command-receipt لحساب فتح صفحة.
 *  • المعرفة مستقلة (§3.2): كل بعد بحالته؛ المجهول لا يصير صفرًا ولا
 *    «لا يوجد» ولا اليوم (SDF-007/024).
 *  • التغطية (§7.1): التفصيل يخصم من الملخص لا يجمع فوقه (SDF-023)،
 *    والتجاوز يُرفض قبل الكتابة (SDF-025)، والمسجل سابقًا يُعلن في المعاينة
 *    ويُصحح نطاقه صراحة قبل الحفظ (SDF-026).
 *  • القياس ليس تمويلًا (§6.1): رصد النقد الحالي بقطعه وتغطيته؛ القبض
 *    القديم الذي يغطيه القياس لا يضاف إلى النقد الحالي مرة ثانية
 *    (SDF-017)؛ والحدث في يوم القياس نفسه بلا دليل وقت يبقى مغطى/غير
 *    محسومًا صراحة (SDF-018)؛ والمجموع العابر لقطع القياس لا يوزع على
 *    الأيام بل يُعلن نقصه الزمني (SDF-019).
 *  • الحق الافتتاحي المؤهل من مصدره لا مبيعات اليوم (SDF-027)، والقبض
 *    التاريخي مجهول المدين يبقى محدود المعرفة لا دينًا لعميل عشوائي
 *    (SDF-028).
 *  • الالتزام منسق في حد كتابة واحد (SH-18): خطط المصادر (الملخصات
 *    بتغطيتها) والقياس والإيصال معًا عبر commitAccountCompletion — الفشل
 *    بلا أثر (SDF-030)، والحتمية داخل الحد (نفس القصد يعيد نتيجته)،
 *    والجيل الحي يختم القصد فالأمر القديم فوق جيل جديد يُرفض (SDF-050).
 */
import {
  applyCoverageLink,
  createPeriodSummary,
  type CoverageLink,
  type PeriodSummary,
  type PeriodSummaryKind,
  type SummaryDimension,
  type DimensionValue,
} from "@micro-domain/shared/index.js";
import { createCashObservation, type CashObservation } from "@micro-domain/cash-continuity/index.js";
import { syncSha256Hex } from "@/lib/syncSha256";
import { systemClock, type Clock } from "@/application/time/clock";
import type { AccountCompletionCommit, PrototypeLocalStore } from "@/storage/local/types";

/** إجابة بعد واحد بمعرفته — نفس اتحاد العقد §3.2 في حقول الرحلة. */
export type CompletionAnswer = DimensionValue;

/** سؤال مجموع واحد في الرحلة (ACC-C): النوع والمدة والأبعاد بأجوبتها. */
export type SummaryAnswer = {
  kind: PeriodSummaryKind;
  from: string;
  to: string;
  dimensions: Readonly<Partial<Record<SummaryDimension, CompletionAnswer>>>;
  /** تفاصيل يغطيها هذا المجموع من أبعاده (تفصيل اليوم مثلًا داخل مجموع شهر). */
  coverage: ReadonlyArray<{ detailRef: string; dimension: SummaryDimension; amountMinor: number }>;
};

/** مدخلات الرحلة — المسار الجديد أو العائد (ACC-B). */
export type AccountCompletionInput = {
  /** الفترة المختارة — ليست آخر زيارة ولا يومًا مختلقًا. */
  from: string;
  to: string;
  summaries: readonly SummaryAnswer[];
  /** رصد النقد الحالي إن اختير — قياس مؤرخ بنطاقه لا تمويل (§6.1). */
  cashObservation: { countedMinor: number; knowledge: "known" | "estimated"; observedOn: string } | null;
};

/** ما سيُعرض في المعاينة قبل أي كتابة — صادق عن المعرفة والتغطية. */
export type AccountCompletionPreview = {
  summaries: readonly PeriodSummary[];
  cashObservation: CashObservation | null;
  /** ما بقي مجهولًا — يعرض للمالك، لا يتحول إلى صفر ولا «لا يوجد». */
  unknownDimensions: ReadonlyArray<{ summaryKind: PeriodSummaryKind; dimension: SummaryDimension }>;
  /** SDF-026: مدخلات داخل مجموع جديد تُغطيها ملخصات قائمة — تصحيح النطاق
   * قبل الحفظ صراحة لا إضافة فوق الأصل ولا حذف تلقائي للتشابه. */
  alreadyRepresented: ReadonlyArray<{ operationKey: string; from: string; to: string }>;
  /** SDF-017: المجاميع التي تنتهي قبل يوم الرصد — يغطيها الرصد الحالي
   * فلا تضاف إلى النقد الحالي أبدًا؛ تبقى تاريخًا في كشف فترتها. */
  coveredByObservation: readonly string[];
  /** SDF-018/019 (العقد §3.3/§6.1): المجاميع التي يقع يوم الرصد داخل مدتها
   * أو يعبر قطعها — بلا دليل وقت لا تُحسم قبل/بعد بـrecordedAt وحده، ولا
   * توزع على الأيام؛ تبقى غير محسومة زمنيًا معلنة، والنقص الزمني ظاهر. */
  timingUnresolved: readonly string[];
  command: { commandId: string; generation: string; payloadDigest: string };
};

export type AccountCompletionPlan = {
  preview: AccountCompletionPreview;
  commit: AccountCompletionCommit;
};

export type AccountCompletionServiceResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: "validation_error" | "storage_error" | "over_coverage"; message: string };

const fail = <T>(
  code: "validation_error" | "storage_error" | "over_coverage",
  message: string,
): AccountCompletionServiceResult<T> => ({ ok: false, code, message });

const ownerDomainOf: Record<PeriodSummaryKind, string> = {
  direct_sales: "direct-sale",
  purchases: "supplier-purchase",
  expenses: "financial-event",
  owner_transfer: "owner-money",
  opening_commercial_right: "owner-entitlement",
};

/** بصمة الحمولة المعيارية — الشكل الثابت المفروز لا الاسم الظاهر. */
function payloadDigestOf(summaries: readonly PeriodSummary[], observation: CashObservation | null): string {
  const canonical = {
    summaries: summaries
      .map(summary => ({
        id: summary.id,
        kind: summary.kind,
        from: summary.from,
        to: summary.to,
        dimensions: Object.keys(summary.dimensions).sort(),
        coverage: summary.coverageLinks.map(link => `${link.dimension}:${link.amountMinor}`).sort(),
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    observation: observation
      ? { id: observation.id, counted: observation.countedMinor, on: observation.observedOn }
      : null,
  };
  return syncSha256Hex(JSON.stringify(canonical));
}

export class AccountCompletionService {
  constructor(
    private readonly store: Pick<
      PrototypeLocalStore,
      "listPeriodSummaries" | "commitAccountCompletion" | "getDataGeneration" | "readSnapshot"
    >,
    private readonly now: Clock = systemClock,
  ) {}

  /**
   * بناء خطة الاستكمال — خالص بلا أي كتابة: يبني الملخصات بتغطيتها (رفض
   * التجاوز قبل الكتابة)، ويكشف ما يسجل سابقًا (SDF-026)، ويعلن تغطية
   * القياس للقبض القديم (SDF-017)، ويختم القصد بجيل البيانات الحي (SDF-050).
   */
  async buildPlan(
    input: AccountCompletionInput,
    commandId: string,
  ): Promise<AccountCompletionServiceResult<AccountCompletionPlan>> {
    if (input.from > input.to)
      return fail("validation_error", "الفترة المختارة معكوسة — «من» قبل «إلى» إلزامي.");
    const generation = await this.store.getDataGeneration();
    if (!generation.ok) return fail("storage_error", generation.message);
    const existing = await this.store.listPeriodSummaries();
    if (!existing.ok) return fail("storage_error", existing.message);

    const recordedAt = this.now();
    const summaries: PeriodSummary[] = [];
    const unknownDimensions: Array<{ summaryKind: PeriodSummaryKind; dimension: SummaryDimension }> = [];
    /* SDF-026: مدخلات المستخدم تقارن بالملخصات القائمة قبل البناء —
     * المفتاح/المدة المطابقة تُعلن «مسجلة سابقًا» فتصحح النطاق صراحة. */
    const alreadyRepresented = existing.value
      .filter(stored =>
        input.summaries.some(
          answer => answer.kind === stored.kind && answer.from === stored.from && answer.to === stored.to,
        ),
      )
      .map(stored => ({ operationKey: stored.operationKey, from: stored.from, to: stored.to }));

    let index = 0;
    for (const answer of input.summaries) {
      const operationKey = `account-completion:${generation.value}:${commandId}:${answer.kind}:${index}`;
      let summary = createPeriodSummary(
        `summary-${commandId}-${answer.kind}-${index}`,
        {
          kind: answer.kind,
          ownerDomain: ownerDomainOf[answer.kind],
          from: answer.from,
          to: answer.to,
          currency: "JOD",
          coverageMode: "unrecorded_only",
          dimensions: answer.dimensions,
          coverageLinks: [],
          supersedesRef: null,
          supersedesReason: null,
          operationKey,
        },
        recordedAt,
      );
      for (const dimension of Object.keys(summary.dimensions) as SummaryDimension[]) {
        if (summary.dimensions[dimension]?.state === "unknown")
          unknownDimensions.push({ summaryKind: answer.kind, dimension });
      }
      /* تغطية التفاصيل داخل المجموع — البعد يُخصم لا يُجمع (SDF-023)،
       * والتجاوز يُرفض قبل أي كتابة بلا باقٍ سالب (SDF-025). */
      for (const detail of answer.coverage) {
        const link: CoverageLink = {
          detailRef: detail.detailRef,
          dimension: detail.dimension,
          amountMinor: detail.amountMinor,
          revision: 1,
        };
        const applied = applyCoverageLink(summary, link);
        if (!applied.ok)
          return fail(
            applied.code === "over_coverage" ? "over_coverage" : "validation_error",
            applied.message,
          );
        summary = applied.value;
      }
      summaries.push(summary);
      index += 1;
    }

    let observation: CashObservation | null = null;
    if (input.cashObservation) {
      observation = createCashObservation({
        id: `observation-${commandId}`,
        scopeKind: "project_total",
        walletId: null,
        countedMinor: input.cashObservation.countedMinor,
        knowledge: input.cashObservation.knowledge,
        cutoff: recordedAt,
        observedOn: input.cashObservation.observedOn,
        recordedAt,
        operationKey: `account-completion-observation:${generation.value}:${commandId}`,
        note: "رصد النقد الحالي من رحلة الاستكمال — قياس لا تمويل",
      });
    }

    /* SDF-017: المجاميع المنتهية قبل يوم الرصد يغطيها الرصد — لا تضاف
     * إلى النقد الحالي أبدًا؛ تبقى تاريخًا في كشف فترتها. */
    const coveredByObservation = observation
      ? summaries.filter(summary => summary.to < observation!.observedOn).map(summary => summary.id)
      : [];
    /* SDF-018/019: المجاميع التي يقع يوم الرصد داخل مدتها (نفس اليوم بلا
     * دليل وقت) أو تعبر قطعها — غير محسومة زمنيًا بصراحة؛ لا توزيع أيام
     * ولا حسم بوقت التسجيل. */
    const timingUnresolved = observation
      ? summaries
          .filter(summary => summary.from <= observation!.observedOn && summary.to >= observation!.observedOn)
          .map(summary => summary.id)
      : [];

    const payloadDigest = payloadDigestOf(summaries, observation);
    return {
      ok: true,
      value: {
        preview: {
          summaries,
          cashObservation: observation,
          unknownDimensions,
          alreadyRepresented,
          coveredByObservation,
          timingUnresolved,
          command: { commandId, generation: String(generation.value), payloadDigest },
        },
        commit: {
          command: {
            commandId,
            commandType: "account-completion",
            generation: String(generation.value),
            payloadVersion: 1,
            payloadDigest,
          },
          summaries,
          cashObservation: observation,
          recordedAt,
        },
      },
    };
  }

  /**
   * الالتزام المنسق — تفويض إلى حد الكتابة المحروس في المخزن: الملخصات
   * والقياس والإيصال معًا أو لا شيء (SDF-030)، والحتمية داخل الحد،
   * والفشل بلا أثر. لا كتابة من الخدمة نفسها أبدًا.
   */
  async commit(plan: AccountCompletionPlan): Promise<AccountCompletionServiceResult<{ reused: boolean }>> {
    /* SDF-026: النطاق المسجل سابقًا لا يُضاف فوقه — التصحيح صريح قبل الحفظ:
     * يعود المالك فيصحح مدة المجموع أو يزيله؛ لا حذف تلقائي للتشابه. */
    if (plan.preview.alreadyRepresented.length > 0)
      return fail(
        "over_coverage",
        "هذا النطاق مسجل سابقًا في ملخص قائم — صحّح مدة المجموع أو أزله قبل الحفظ؛ لا تُضاف القيمة فوق الأصل ولا يُحذف المتشابه تلقائيًا.",
      );
    const committed = await this.store.commitAccountCompletion(plan.commit);
    if (!committed.ok)
      return fail(committed.code === "storage_stale" ? "over_coverage" : "storage_error", committed.message);
    return { ok: true, value: { reused: committed.value.reused } };
  }
}
