/**
 * S14 (DOC-023 / UNIT-002 — أمر ba2ce7b4 §5): إثبات المجال النقي لملخص
 * الفترة وتغطيته — الأبعاد مستقلة المعرفة (SDF-007)، والتفصيل يحل مكان
 * أبعاده من الملخص دون مضاعفة الإجماليات (SDF-023)، والمجهول لا يُستنتج
 * تناسبًا (SDF-024)، والتجاوز يُرفض قبل الكتابة (SDF-025)، والحق الافتتاحي
 * المؤهل نوع مستقل لا مبيعات اليوم (SDF-027)، والمدة المعكوسة مرفوضة.
 */
import { describe, expect, it } from "vitest";
import {
  applyCoverageLink,
  createPeriodSummary,
  dimensionsOfKind,
  remainingOf,
  type CoverageLink,
  type DimensionValue,
  type PeriodSummary,
  type PeriodSummaryDraft,
} from "./periodSummary.js";

const NOW = "2026-11-02T09:00:00.000Z";
const entered = (amountMinor: number, knowledge: "known" | "estimated" = "known"): DimensionValue => ({
  state: "entered",
  amountMinor,
  knowledge,
});

function salesSummary(
  dimensions: PeriodSummaryDraft["dimensions"],
  coverageLinks: readonly CoverageLink[] = [],
): PeriodSummary {
  return createPeriodSummary(
    "summary-sales-1",
    {
      kind: "direct_sales",
      ownerDomain: "direct-sale",
      from: "2026-09-01",
      to: "2026-10-31",
      currency: "JOD",
      coverageMode: "unrecorded_only",
      dimensions,
      coverageLinks,
      supersedesRef: null,
      supersedesReason: null,
      operationKey: "sdf-summary-sales-1",
    },
    NOW,
  );
}

describe("S14 SDF-023 — التفصيل يخصم من الملخص لا يجمع فوقه", () => {
  it("SDF-023: تفصيل 80/30/20 يخصم من ملخص 200/120/80 — الباقي 120/90/60 والإجماليات كما هي", () => {
    const summary = salesSummary({
      revenue: entered(20_000),
      received: entered(12_000),
      cost: entered(8_000),
    });
    const withRevenue = applyCoverageLink(summary, {
      detailRef: "direct_sale:detail-1",
      dimension: "revenue",
      amountMinor: 8_000,
      revision: 1,
    });
    if (!withRevenue.ok) throw new Error(withRevenue.message);
    const withReceived = applyCoverageLink(withRevenue.value, {
      detailRef: "direct_sale:detail-1",
      dimension: "received",
      amountMinor: 3_000,
      revision: 1,
    });
    if (!withReceived.ok) throw new Error(withReceived.message);
    const withCost = applyCoverageLink(withReceived.value, {
      detailRef: "direct_sale:detail-1",
      dimension: "cost",
      amountMinor: 2_000,
      revision: 1,
    });
    if (!withCost.ok) throw new Error(withCost.message);
    const covered = withCost.value;
    /* الباقي 120/90/60 بالقيمة الصحيحة — ولا مجموع 280 أبدًا. */
    expect(remainingOf(covered, "revenue")).toEqual({ state: "partial", amountMinor: 12_000 });
    expect(remainingOf(covered, "received")).toEqual({ state: "partial", amountMinor: 9_000 });
    expect(remainingOf(covered, "cost")).toEqual({ state: "partial", amountMinor: 6_000 });
    /* الإجماليات لم تتغير بالتغطية — التفصيل يحل مكانه من الملخص لا يضاف فوقه. */
    expect(covered.dimensions.revenue).toEqual(entered(20_000));
    expect(covered.dimensions.received).toEqual(entered(12_000));
    expect(covered.dimensions.cost).toEqual(entered(8_000));
    /* والحق المتبقي للمبيعات بعد تفصيل 80 قبضًا من 30 و80 إيرادًا و20 تكلفة:
     * الحق = الإيراد المتبقي 120 (لا 200−80 ثانية ولا ازدواج). */
    expect(remainingOf(covered, "remainingClaim")).toEqual({ state: "not_entered" });
  });
});

describe("S14 SDF-024 — المجهول لا يُستنتج تناسبًا", () => {
  it("SDF-024: القبض والتكلفة المجهولان لا يُستنتجان تناسبًا — الباقي غير رقمي لا 48/32", () => {
    const summary = salesSummary({
      revenue: entered(8_000),
      received: { state: "unknown" },
      cost: { state: "unknown" },
    });
    /* تفصيل البيع 80 مع مجهولية القبض/التكلفة: لا يُفترض قبض 48 ولا تكلفة 32. */
    expect(remainingOf(summary, "received")).toEqual({ state: "not_entered" });
    expect(remainingOf(summary, "cost")).toEqual({ state: "not_entered" });
    /* ومحاولة تغطية بعد مجهول تُرفض صادقة — لا رقم يُخترع ليغطى. */
    const rejected = applyCoverageLink(summary, {
      detailRef: "direct_sale:detail-2",
      dimension: "received",
      amountMinor: 4_800,
      revision: 1,
    });
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.code).toBe("dimension_not_entered");
  });
});

describe("S14 SDF-025 — التجاوز يُرفض قبل الكتابة", () => {
  it("SDF-025: تفصيل يتجاوز المتبقي يُرفض قبل الكتابة — لا باقٍ سالب صامت", () => {
    const summary = salesSummary({ revenue: entered(10_000), received: entered(3_000) });
    const partial = applyCoverageLink(summary, {
      detailRef: "direct_sale:detail-3",
      dimension: "revenue",
      amountMinor: 8_000,
      revision: 1,
    });
    if (!partial.ok) throw new Error(partial.message);
    /* المتبقي 2,000 — تفصيل 3,000 فوقه رفض صريح. */
    const rejected = applyCoverageLink(partial.value, {
      detailRef: "direct_sale:detail-4",
      dimension: "revenue",
      amountMinor: 3_000,
      revision: 1,
    });
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.code).toBe("over_coverage");
      expect(rejected.message).toContain("لا باقٍ سالب صامت");
    }
    /* والملخص الأصلي لم يتغير بالرفض — الروابط كما كانت. */
    expect(partial.value.coverageLinks).toHaveLength(1);
  });
});

describe("S14 SDF-007 — حالات المعرفة مستقلة", () => {
  it("SDF-007: حالات المعرفة الخمس مستقلة — لا تسقط إلى رقم ولا العكس", () => {
    const summary = salesSummary({
      revenue: entered(5_000, "estimated"),
      received: { state: "none" },
      cost: { state: "unknown" },
      remainingClaim: { state: "skipped" },
    });
    /* التقدير رقم موسوم لا يقين — وnone جواب «لا عمليات» لا صفرًا وهميًا. */
    expect(summary.dimensions.revenue).toEqual(entered(5_000, "estimated"));
    expect(summary.dimensions.received).toEqual({ state: "none" });
    /* المجهول والمتخطى لا يحملان مبلغًا أبدًا ولا يغطيان. */
    expect(remainingOf(summary, "cost")).toEqual({ state: "not_entered" });
    expect(remainingOf(summary, "remainingClaim")).toEqual({ state: "not_entered" });
    /* غير المنطبق بسبب صالح — وليس وسيلة إخفاء بلا سبب. */
    const na = salesSummary({ revenue: { state: "not_applicable", reason: "فترة قبل بدء النشاط" } });
    expect(na.dimensions.revenue).toEqual({ state: "not_applicable", reason: "فترة قبل بدء النشاط" });
    expect(() =>
      createPeriodSummary(
        "bad-na",
        {
          kind: "expenses",
          ownerDomain: "financial-event",
          from: "2026-09-01",
          to: "2026-09-30",
          currency: "JOD",
          coverageMode: "unrecorded_only",
          dimensions: { paid: { state: "not_applicable", reason: "  " } },
          coverageLinks: [],
          supersedesRef: null,
          supersedesReason: null,
          operationKey: "bad-na",
        },
        NOW,
      ),
    ).toThrow("سببًا صالحًا");
  });
});

describe("S14 SDF-027 — الحق الافتتاحي نوع مستقل", () => {
  it("SDF-027: الحق الافتتاحي التجاري نوع مستقل — لا مبيعات اليوم ولا قرضًا", () => {
    const right = createPeriodSummary(
      "summary-right-1",
      {
        kind: "opening_commercial_right",
        ownerDomain: "owner-entitlement",
        from: "2026-08-01",
        to: "2026-08-31",
        currency: "JOD",
        coverageMode: "unrecorded_only",
        dimensions: { remainingClaim: entered(5_000) },
        coverageLinks: [],
        supersedesRef: null,
        supersedesReason: null,
        operationKey: "sdf-right-1",
      },
      NOW,
    );
    /* نوعه مستقل بأبعاده — لا إيراد ولا قبض ولا تكلفة لحقل قديم. */
    expect(dimensionsOfKind.opening_commercial_right).toEqual(["remainingClaim"]);
    expect(right.kind).toBe("opening_commercial_right");
    /* وتغطيته تخصم من حقه المتبقي لا من مبيعات ولا قرض. */
    const covered = applyCoverageLink(right, {
      detailRef: "owner_entitlement:right-detail-1",
      dimension: "remainingClaim",
      amountMinor: 2_000,
      revision: 1,
    });
    if (!covered.ok) throw new Error(covered.message);
    expect(remainingOf(covered.value, "remainingClaim")).toEqual({
      state: "partial",
      amountMinor: 3_000,
    });
  });
});

describe("S14 إنشاء الملخص — المدة والبعد والمبلغ", () => {
  it("المدة المعكوسة والبعد الدخيل والمبلغ الفاسد تُرفض عند الإنشاء", () => {
    /* الحالات الثلاث بنية واحدة — مساعد واحد يحفظ الاختبار تحت حد الأسطر. */
    const rejects = (dimensions: PeriodSummaryDraft["dimensions"], from: string, word: string) => {
      expect(() =>
        createPeriodSummary(
          "bad-summary",
          {
            kind: "expenses",
            ownerDomain: "financial-event",
            from,
            to: "2026-09-30",
            currency: "JOD",
            coverageMode: "unrecorded_only",
            dimensions,
            coverageLinks: [],
            supersedesRef: null,
            supersedesReason: null,
            operationKey: "bad-summary",
          },
          NOW,
        ),
      ).toThrow(word);
    };
    rejects({ paid: entered(1_000) }, "2026-10-31", "معكوسة");
    rejects({ revenue: entered(1_000) }, "2026-09-01", "لا ينطبق");
    rejects({ paid: entered(-500) }, "2026-09-01", "غير سالب");
  });
});
