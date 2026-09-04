import { describe, expect, it } from "vitest";
import {
  applyAssetDisposal,
  applyAssetWriteOff,
  assetEventSummary,
  createAssetRecord,
  firstChargeMonth,
  fullMonthsElapsed,
  monthlyDepreciationMinor,
  planAssetDepreciation,
  prepareAssetDisposal,
  prepareAssetWriteOff,
  recordedDepreciationMinor,
  reviseAssetContract,
  scheduledAccumulatedMinor,
} from "../../src/domain/asset/index.js";
import { createFinancialEvent } from "../../src/domain/financial-event/index.js";

const assetBase = {
  id: "asset-1",
  name: "ثلاجة العرض",
  acquisitionAmountMinor: 60000,
  acquisitionKind: "cash" as const,
  purchaseDate: "2026-01-15",
  acquisitionEventId: "event-acq",
  operationKey: "asset-1:create",
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

describe("asset domain core", () => {
  it("creates an active asset with unknown life and unknown start preserved explicitly", () => {
    const asset = createAssetRecord({ ...assetBase, lifeMonths: null, depreciationStartOn: null });
    expect(asset.status).toBe("active");
    expect(asset.lifeMonths).toBeNull();
    expect(asset.depreciationStartOn).toBeNull();
    expect(monthlyDepreciationMinor(asset)).toBeNull();
    expect(scheduledAccumulatedMinor(asset, "2026-12-31")).toBeNull();
  });

  it("rejects blank names, non-positive amounts, and a start before purchase", () => {
    expect(() => createAssetRecord({ ...assetBase, name: "   " })).toThrow();
    expect(() => createAssetRecord({ ...assetBase, acquisitionAmountMinor: 0 })).toThrow();
    expect(() => createAssetRecord({ ...assetBase, depreciationStartOn: "2026-01-14" })).toThrow();
    expect(() => createAssetRecord({ ...assetBase, lifeMonths: 0 })).toThrow();
    expect(() => createAssetRecord({ ...assetBase, lifeMonths: 601 })).toThrow();
  });

  it("computes straight-line monthly depreciation from full elapsed months", () => {
    const asset = createAssetRecord({
      ...assetBase,
      acquisitionAmountMinor: 60000,
      lifeMonths: 24,
      depreciationStartOn: "2026-01-15",
    });
    expect(monthlyDepreciationMinor(asset)).toBe(2500);
    /* أشهر كاملة باليوم: ١٥/١ → ٣١/١ = ٠، → ١٥/٢ = ١ */
    expect(fullMonthsElapsed("2026-01-15", "2026-01-31")).toBe(0);
    expect(fullMonthsElapsed("2026-01-15", "2026-02-14")).toBe(0);
    expect(fullMonthsElapsed("2026-01-15", "2026-02-15")).toBe(1);
    expect(scheduledAccumulatedMinor(asset, "2026-02-15")).toBe(2500);
  });

  it("sweeps the last month so accumulated depreciation reaches acquisition exactly", () => {
    /* ١٠٠٠٠ وحدة على ٣ أشهر: ٣٣٣٣، ٣٣٣٣، ثم ٣٣٣٤ بالشهر الأخير. */
    const sweep = createAssetRecord({
      ...assetBase,
      purchaseDate: "2026-01-01",
      acquisitionAmountMinor: 10000,
      lifeMonths: 3,
      depreciationStartOn: "2026-01-01",
    });
    expect(scheduledAccumulatedMinor(sweep, "2026-02-01")).toBe(3333);
    expect(scheduledAccumulatedMinor(sweep, "2026-03-01")).toBe(6666);
    /* بعد ٣ أشهر كاملة (٠١/٠١ → ٠١/٠٤) يجمع الشهر الأخير الباقي ليصل التراكمي
     * لقيمة الشراء بالضبط: ٦٦٦٦ + ٣٣٣٤ = ١٠٠٠٠. */
    expect(scheduledAccumulatedMinor(sweep, "2026-04-01")).toBe(10000);
    expect(firstChargeMonth(sweep)).toBe("2026-02");
  });
});

/* المجموعة ٤: وصف ثانٍ — جدول الإهلاك واقتراحه تحت سقف الأسطر. */
describe("asset depreciation proposal", () => {
  it("proposes only the unrecorded remainder and never silently records", () => {
    const asset = createAssetRecord({
      ...assetBase,
      lifeMonths: 24,
      depreciationStartOn: "2026-01-15",
    });
    const recorded = [depreciationEvent(asset.id, asset.name, 2500, "dep-1")];
    const proposal = planAssetDepreciation(asset, recorded, "2026-03-15");
    expect(proposal.readiness).toBe("ready");
    expect(proposal.scheduledMinor).toBe(5000);
    expect(proposal.recordedMinor).toBe(2500);
    expect(proposal.proposedMinor).toBe(2500);
    expect(recordedDepreciationMinor(asset.id, recorded)).toBe(2500);
  });

  it("keeps unknown life and unknown start as explicit unresolved states", () => {
    const unknownLife = createAssetRecord({ ...assetBase, depreciationStartOn: "2026-01-15" });
    expect(planAssetDepreciation(unknownLife, [], "2026-06-30").readiness).toBe("unknown_life");
    const unknownStart = createAssetRecord({ ...assetBase, lifeMonths: 24 });
    expect(planAssetDepreciation(unknownStart, [], "2026-06-30").readiness).toBe("unknown_start");
  });

  it("records a contract revision with history preserved and depreciation untouched", () => {
    const asset = createAssetRecord({ ...assetBase, lifeMonths: 24, depreciationStartOn: "2026-01-15" });
    const revised = reviseAssetContract(
      asset,
      { lifeMonths: 36, depreciationStartOn: "2026-01-15", reason: "عمر أطول بعد الصيانة" },
      "2026-07-01T08:00:00.000Z",
    );
    expect(revised.lifeMonths).toBe(36);
    expect(revised.contractRevisions).toHaveLength(1);
    expect(revised.contractRevisions[0]!.revision).toBe(1);
    expect(() =>
      reviseAssetContract(
        asset,
        { lifeMonths: 36, depreciationStartOn: "2026-01-15", reason: " " },
        "2026-07-01T08:00:00.000Z",
      ),
    ).toThrow();
  });
});

/* المجموعة ٤: وصف ثالث — نهاية العمر والتخلص والشطب والتصحيحات. */
describe("asset lifecycle and corrections", () => {
  it("summarizes book value from active events only", () => {
    const asset = createAssetRecord({
      ...assetBase,
      lifeMonths: 24,
      depreciationStartOn: "2026-01-15",
    });
    const events = [
      createFinancialEvent({
        id: "acq",
        type: "asset_purchase_cash",
        amountMinor: 60000,
        occurredOn: "2026-01-15",
        recordedAt: "2026-01-15T08:00:00.000Z",
        idempotencyKey: "acq:key",
        note: "شراء نقدي",
        assetContext: { assetId: asset.id, name: asset.name },
      }),
      depreciationEvent(asset.id, asset.name, 2500, "dep-1"),
    ];
    const summary = assetEventSummary(asset.id, events);
    expect(summary.acquisitionMinor).toBe(60000);
    expect(summary.depreciationMinor).toBe(2500);
    expect(summary.bookValueMinor).toBe(57500);
  });
});

/* المجموعة ٤: وصف رابع — نهاية العمر: التخلص والشطب. */
/* المجموعة ٤: بذرة مشتركة للتخلص والشطب — اقتصاد الأسطر داخل الوصف. */
function lifecycleEvents(assetId: string, name: string, depreciationMinor = 0, depId = "dep-1") {
  const events = [
    createFinancialEvent({
      id: "acq",
      type: "asset_purchase_cash",
      amountMinor: 60000,
      occurredOn: "2026-01-15",
      recordedAt: "2026-01-15T08:00:00.000Z",
      idempotencyKey: "acq:key",
      note: "شراء نقدي",
      assetContext: { assetId, name },
    }),
  ];
  if (depreciationMinor > 0) events.push(depreciationEvent(assetId, name, depreciationMinor, depId));
  return events;
}

describe("asset disposal and write-off", () => {
  it("prepares disposal with frozen book value and declared gain or loss", () => {
    const asset = createAssetRecord({
      ...assetBase,
      lifeMonths: 24,
      depreciationStartOn: "2026-01-15",
    });
    const events = lifecycleEvents(asset.id, asset.name, 2500);
    const prepared = prepareAssetDisposal(asset, events, {
      on: "2026-08-01",
      proceedsMinor: 30000,
      reason: "بيع الأصل",
    });
    expect(prepared.bookValueMinor).toBe(57500);
    expect(prepared.gainLossMinor).toBe(-27500);
    const disposed = applyAssetDisposal(
      asset,
      {
        on: "2026-08-01",
        proceedsMinor: 30000,
        bookValueMinor: 57500,
        eventId: "event-disposal",
        reason: "بيع الأصل",
      },
      "2026-08-01T08:00:00.000Z",
    );
    expect(disposed.status).toBe("disposed");
    expect(() =>
      prepareAssetDisposal(disposed, events, { on: "2026-09-01", proceedsMinor: 5000, reason: "ثانية" }),
    ).toThrow();
  });

  it("prepares write-off as a non-cash loss of the remaining book value", () => {
    const asset = createAssetRecord({
      ...assetBase,
      lifeMonths: 24,
      depreciationStartOn: "2026-01-15",
    });
    const events = lifecycleEvents(asset.id, asset.name);
    const prepared = prepareAssetWriteOff(asset, events, { on: "2026-08-01", reason: "تلف كلي" });
    expect(prepared.bookValueMinor).toBe(60000);
    const writtenOff = applyAssetWriteOff(
      asset,
      { on: "2026-08-01", bookValueMinor: 60000, eventId: "event-writeoff", reason: "تلف كلي" },
      "2026-08-01T08:00:00.000Z",
    );
    expect(writtenOff.status).toBe("written_off");
    expect(() => prepareAssetWriteOff(writtenOff, events, { on: "2026-09-01", reason: "ثانية" })).toThrow();
  });
});
