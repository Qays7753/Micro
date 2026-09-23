import { describe, expect, it } from "vitest";
import {
  createAssetRecord,
  firstChargeMonth,
  monthlyDepreciationMinor,
  planAssetDepreciation,
  residualOf,
  reviseAssetContract,
  scheduledAccumulatedMinor,
} from "../../src/domain/asset/index.js";
import { createFinancialEvent } from "../../src/domain/financial-event/index.js";

/* عقد ٤٣ (WS-179 — Wave 7 — FIN-008): مصفوفة قبول شريحة القيمة المتبقية
 * والمرجع/الملاحظة — الرياضيات على (القيمة − المتبقية)، السقف عندها،
 * الدفتري يستقر عندها، التوافق مع الأصول القديمة، والمراجعة الموثقة. */

const residualBase = {
  id: "asset-r1",
  name: "ماكينة خياطة صناعية",
  acquisitionAmountMinor: 60000,
  acquisitionKind: "cash" as const,
  purchaseDate: "2026-01-15",
  acquisitionEventId: "event-acq",
  operationKey: "asset-r1:create",
  createdAt: "2026-01-15T08:00:00.000Z",
};

function depreciationEvent(assetId: string, name: string, amountMinor: number, id: string) {
  return createFinancialEvent({
    id,
    type: "asset_depreciation",
    amountMinor,
    occurredOn: "2026-06-30",
    recordedAt: "2026-06-30T08:00:00.000Z",
    idempotencyKey: `${id}:key`,
    note: "إهلاك مسجل",
    assetContext: { assetId, name },
  });
}

describe("asset residual straight-line math (contract 43)", () => {
  it("depreciates (cost − residual) straight-line with floor rounding", () => {
    const asset = createAssetRecord({
      ...residualBase,
      lifeMonths: 36,
      depreciationStartOn: "2026-02-10",
      residualValueMinor: 6000,
    });
    /* (60000 − 6000) ÷ 36 = 1500 بالضبط. */
    expect(monthlyDepreciationMinor(asset)).toBe(1500);
    expect(residualOf(asset)).toBe(6000);
  });

  it("caps scheduled accumulated at (cost − residual) and settles the book at residual", () => {
    const asset = createAssetRecord({
      ...residualBase,
      lifeMonths: 24,
      depreciationStartOn: "2026-01-20",
      residualValueMinor: 12000,
    });
    /* (60000 − 12000) ÷ 24 = 2000 شهريًا. */
    expect(monthlyDepreciationMinor(asset)).toBe(2000);
    /* قبل اكتمال العمر: أشهر كاملة × شهري فقط — حتى 2026-07-09 مضى ٥ أشهر
     * كاملة (اليوم ٩ < ٢٠ فالشهر السادس لم يكتمل). */
    expect(scheduledAccumulatedMinor(asset, "2026-07-09")).toBe(10000);
    /* عند/بعد اكتمال العمر (٢٤ شهرًا كاملًا من 2026-01-20): السقف
     * (القيمة − المتبقية) بالضبط — فيستقر الدفتري عند المتبقية (12000) لا
     * عند الصفر (عقد ٤٣ §٣). */
    expect(scheduledAccumulatedMinor(asset, "2028-01-20")).toBe(48000);
    expect(scheduledAccumulatedMinor(asset, "2029-12-31")).toBe(48000);
  });

  it("keeps legacy assets identical: absent/null residual reads zero and math is unchanged", () => {
    const legacy = createAssetRecord({
      ...residualBase,
      lifeMonths: 24,
      depreciationStartOn: "2026-01-20",
    });
    expect(residualOf(legacy)).toBe(0);
    expect(legacy.residualValueMinor ?? null).toBeNull();
    expect(monthlyDepreciationMinor(legacy)).toBe(2500);
    /* ١٢ شهرًا كاملًا: ٣٠٠٠٠؛ والسقف الكامل (٦٠٠٠٠) عند ٢٤ شهرًا. */
    expect(scheduledAccumulatedMinor(legacy, "2027-01-20")).toBe(30000);
    expect(scheduledAccumulatedMinor(legacy, "2028-01-20")).toBe(60000);
    const explicitZero = createAssetRecord({
      ...residualBase,
      lifeMonths: 24,
      depreciationStartOn: "2026-01-20",
      residualValueMinor: 0,
    });
    expect(monthlyDepreciationMinor(explicitZero)).toBe(monthlyDepreciationMinor(legacy));
  });
});

describe("asset residual schedule boundaries (contract 43)", () => {
  it("applies the first-full-month rule unchanged with a residual", () => {
    const asset = createAssetRecord({
      ...residualBase,
      lifeMonths: 12,
      depreciationStartOn: "2026-02-10",
      residualValueMinor: 5000,
    });
    /* أول شهر حمل = شهر البداية + ١ (شهر كامل أول بعد البداية — عقد ٤٣ §٣). */
    expect(firstChargeMonth(asset)).toBe("2026-03");
    /* يوم البداية نفسه: صفر أشهر كاملة — لا تحميل في شهر البداية. */
    expect(scheduledAccumulatedMinor(asset, "2026-02-10")).toBe(0);
    expect(scheduledAccumulatedMinor(asset, "2026-03-09")).toBe(0);
    /* أول شهر كامل مكتمل: تحميل واحد. */
    expect(scheduledAccumulatedMinor(asset, "2026-03-10")).toBe(
      monthlyDepreciationMinor(asset as never) ?? 0,
    );
  });

  it("crosses a month boundary with two synthetic dates (injectable asOf — no real waiting)", () => {
    const asset = createAssetRecord({
      ...residualBase,
      lifeMonths: 24,
      depreciationStartOn: "2026-01-15",
      residualValueMinor: 9000,
    });
    const monthly = monthlyDepreciationMinor(asset);
    expect(monthly).toBe(2125);
    /* وقتان اصطناعيان يعبران شهرًا: 2026-04-14 (أشهر كاملة ٢) ثم 2026-04-15 (٣). */
    expect(scheduledAccumulatedMinor(asset, "2026-04-14")).toBe(2 * 2125);
    expect(scheduledAccumulatedMinor(asset, "2026-04-15")).toBe(3 * 2125);
  });
});

describe("asset residual input validation (contract 43)", () => {
  it("rejects out-of-bounds residual and over-long notes at creation (fail before write)", () => {
    expect(() => createAssetRecord({ ...residualBase, residualValueMinor: -1, lifeMonths: 12 })).toThrow();
    expect(() => createAssetRecord({ ...residualBase, residualValueMinor: 60000, lifeMonths: 12 })).toThrow();
    expect(() => createAssetRecord({ ...residualBase, residualValueMinor: 60001, lifeMonths: 12 })).toThrow();
    expect(() => createAssetRecord({ ...residualBase, note: "ن".repeat(501), lifeMonths: 12 })).toThrow();
    /* الحدود الصالحة: صفر مقبول، والمتبقية الأصغر من القيمة مقبولة. */
    expect(createAssetRecord({ ...residualBase, residualValueMinor: 59999, lifeMonths: 12 }).status).toBe(
      "active",
    );
  });

  it("stores the reference/note as a display-only label", () => {
    const asset = createAssetRecord({
      ...residualBase,
      note: "فاتورة رقم ٢٠٢٦-٧٧١ من محل الجملة",
    });
    expect(asset.note).toBe("فاتورة رقم ٢٠٢٦-٧٧١ من محل الجملة");
    const trimmed = createAssetRecord({ ...residualBase, note: "   " });
    expect(trimmed.note).toBeNull();
  });
});

describe("asset residual documented revision (contract 43)", () => {
  it("documents residual/note revisions in contract history without touching recorded events", () => {
    const asset = createAssetRecord({
      ...residualBase,
      lifeMonths: 24,
      depreciationStartOn: "2026-01-20",
      residualValueMinor: 6000,
      note: "أصل أول",
    });
    const events = [depreciationEvent(asset.id, asset.name, 2250, "dep-1")];
    const revised = reviseAssetContract(
      asset,
      {
        lifeMonths: 24,
        depreciationStartOn: "2026-01-20",
        residualValueMinor: 12000,
        note: "أصل أول — مراجعة المتبقية",
        reason: "تقدير متبقٍ أعلى بعد الصيانة",
      },
      "2026-07-01T09:00:00.000Z",
    );
    expect(revised.residualValueMinor).toBe(12000);
    expect(revised.note).toBe("أصل أول — مراجعة المتبقية");
    expect(revised.contractRevisions).toHaveLength(1);
    expect(revised.contractRevisions[0]!.residualValueMinor).toBe(12000);
    expect(revised.contractRevisions[0]!.note).toBe("أصل أول — مراجعة المتبقية");
    expect(revised.contractRevisions[0]!.reason).toBe("تقدير متبقٍ أعلى بعد الصيانة");
    /* الإهلاك المسجّل سابقًا لا يُمسّ — الاقتراح فقط يتغير. */
    const proposal = planAssetDepreciation(revised, events, "2026-07-01");
    expect(proposal.recordedMinor).toBe(2250);
    /* (60000 − 12000) ÷ 24 = 2000 شهريًا بعد المراجعة. */
    expect(monthlyDepreciationMinor(revised)).toBe(2000);
  });
});

describe("asset residual revision semantics (contract 43)", () => {
  it("keeps undefined residual/note unchanged in revisions (null resets to zero/none)", () => {
    const asset = createAssetRecord({
      ...residualBase,
      lifeMonths: 24,
      depreciationStartOn: "2026-01-20",
      residualValueMinor: 6000,
      note: "أصل أول",
    });
    const untouched = reviseAssetContract(
      asset,
      { lifeMonths: 30, depreciationStartOn: "2026-01-20", reason: "تمديد العمر" },
      "2026-07-01T09:00:00.000Z",
    );
    expect(untouched.residualValueMinor).toBe(6000);
    expect(untouched.note).toBe("أصل أول");
    const reset = reviseAssetContract(
      asset,
      {
        lifeMonths: 30,
        depreciationStartOn: "2026-01-20",
        residualValueMinor: null,
        note: null,
        reason: "إسقاط المتبقية المعلنة",
      },
      "2026-07-01T09:00:00.000Z",
    );
    expect(reset.residualValueMinor).toBeNull();
    expect(residualOf(reset)).toBe(0);
    expect(reset.note).toBeNull();
    /* مراجعة بمتبقية خارج الحدود مرفوضة صادرًا. */
    expect(() =>
      reviseAssetContract(
        asset,
        {
          lifeMonths: 24,
          depreciationStartOn: "2026-01-20",
          residualValueMinor: 60000,
          reason: "خارج الحدود",
        },
        "2026-07-01T09:00:00.000Z",
      ),
    ).toThrow();
  });
});

describe("asset residual unknown inputs stay explicit (contract 43)", () => {
  it("keeps the unknown explicit: unknown life or start never produces a schedule", () => {
    const unknownLife = createAssetRecord({
      ...residualBase,
      lifeMonths: null,
      depreciationStartOn: "2026-02-01",
      residualValueMinor: 5000,
    });
    expect(monthlyDepreciationMinor(unknownLife)).toBeNull();
    expect(scheduledAccumulatedMinor(unknownLife, "2026-12-31")).toBeNull();
    expect(planAssetDepreciation(unknownLife, [], "2026-12-31").readiness).toBe("unknown_life");
    const unknownStart = createAssetRecord({
      ...residualBase,
      lifeMonths: 24,
      depreciationStartOn: null,
      residualValueMinor: 5000,
    });
    expect(planAssetDepreciation(unknownStart, [], "2026-12-31").readiness).toBe("unknown_start");
  });
});
