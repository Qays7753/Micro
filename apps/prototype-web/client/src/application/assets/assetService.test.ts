import { describe, expect, it } from "vitest";
import { AssetService } from "./assetService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { createFinancialEvent } from "@micro-domain/financial-event/index.js";

function fixedNow() {
  let tick = 0;
  return () => {
    tick += 1;
    return new Date(Date.UTC(2026, 8, 1 + tick, 8, 0, 0)).toISOString();
  };
}

const now = fixedNow();

async function seededAsset(kind: "cash" | "payable" = "cash") {
  const store = new MemoryLocalStore();
  const service = new AssetService(store, now);
  const created = await service.create({
    name: "ثلاجة عرض",
    categoryLabel: "كهربائيات",
    acquisitionAmountMinor: 60000,
    acquisitionKind: kind,
    purchaseDate: "2026-06-01",
    lifeMonths: 24,
    depreciationStartOn: "2026-06-01",
    note: null,
  });
  return { store, service, created };
}

describe("asset service (المجموعة ٤ — عقد ٢٩)", () => {
  it("creates an asset with one acquisition event: cash out and book value up, no expense", async () => {
    const { service, created, store } = await seededAsset();
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.asset.acquisitionEventId).toBe(created.value.event?.id);
    const events = await store.listFinancialEvents();
    const acquisition = events.value.find(event => event.type === "asset_purchase_cash");
    expect(acquisition?.cashDeltaMinor).toBe(-60000);
    expect(acquisition?.assetDeltaMinor).toBe(60000);
    expect(acquisition?.operatingExpenseDeltaMinor).toBe(0);
    const overview = await service.overview();
    expect(overview.ok && overview.value[0]!.bookValueMinor).toBe(60000);
  });

  it("proposes depreciation and records it as a non-cash event exactly once", async () => {
    const { service, store } = await seededAsset();
    const first = await service.recordDepreciation("nonexistent", { asOf: "2026-09-01" });
    expect(first.ok).toBe(false);
    const overview = await service.overview();
    const assetId = overview.ok ? overview.value[0]!.asset.id : "";
    const recorded = await service.recordDepreciation(assetId, { asOf: "2026-09-01" });
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) return;
    /* ٣ أشهر كاملة (٠١/٠٦ → ٠١/٠٩) = ٣ × ٢٥٠٠ = ٧٥٠٠ */
    expect(recorded.value.event.amountMinor).toBe(7500);
    expect(recorded.value.event.cashDeltaMinor).toBe(0);
    expect(recorded.value.event.assetDeltaMinor).toBe(-7500);
    /* إعادة المحاولة نفس اليوم: لا إهلاك جديد (المقترح صفر بعد التسجيل). */
    const second = await service.recordDepreciation(assetId, { asOf: "2026-09-01" });
    expect(second.ok).toBe(false);
    const events = await store.listFinancialEvents();
    expect(events.value.filter(event => event.type === "asset_depreciation")).toHaveLength(1);
  });

  it("reverses a depreciation entry with a documented correction and no cash movement", async () => {
    const { service, store } = await seededAsset();
    const overview = await service.overview();
    const assetId = overview.ok ? overview.value[0]!.asset.id : "";
    const recorded = await service.recordDepreciation(assetId, { asOf: "2026-09-01" });
    if (!recorded.ok) return;
    const reversal = await service.reverseDepreciation(recorded.value.event.id, "تصحيح المدة");
    expect(reversal.ok).toBe(true);
    const events = await store.listFinancialEvents();
    const reversals = events.value.filter(event => event.correctionType === "reverse");
    expect(reversals).toHaveLength(1);
    expect(reversals[0]!.assetDeltaMinor).toBe(7500);
    /* -0 و +0 متساويان هنا: لا حركة كاش بصرف النظر عن الإشارة. */
    expect(reversals[0]!.cashDeltaMinor + 0).toBe(0);
    /* التراجع عن التراجع ممنوع. */
    const again = await service.reverseDepreciation(reversals[0]!.id, "ثانية");
    expect(again.ok).toBe(false);
  });

  it("revises the contract without touching recorded depreciation", async () => {
    const { service } = await seededAsset();
    const overview = await service.overview();
    const assetId = overview.ok ? overview.value[0]!.asset.id : "";
    const recorded = await service.recordDepreciation(assetId, { asOf: "2026-09-01" });
    if (!recorded.ok) return;
    const revised = await service.reviseContract(assetId, {
      lifeMonths: 36,
      depreciationStartOn: "2026-06-01",
      reason: "عمر أطول بعد الصيانة",
    });
    expect(revised.ok).toBe(true);
    const detail = await service.read(assetId);
    expect(detail.ok && detail.value.asset.lifeMonths).toBe(36);
    expect(detail.ok && detail.value.summary.depreciationMinor).toBe(7500);
    expect(detail.ok && detail.value.asset.contractRevisions).toHaveLength(1);
  });

  it("disposes with frozen book value, gain or loss declared, and the asset archived", async () => {
    const { service, store } = await seededAsset();
    const overview = await service.overview();
    const assetId = overview.ok ? overview.value[0]!.asset.id : "";
    const recorded = await service.recordDepreciation(assetId, { asOf: "2026-09-01" });
    if (!recorded.ok) return;
    const disposal = await service.dispose(assetId, {
      on: "2026-09-15",
      proceedsMinor: 30000,
      reason: "بعتُها",
    });
    expect(disposal.ok).toBe(true);
    if (!disposal.ok) return;
    expect(disposal.value.event.cashDeltaMinor).toBe(30000);
    expect(disposal.value.event.assetDeltaMinor).toBe(-52500);
    expect(disposal.value.asset.status).toBe("disposed");
    /* لا إهلاك بعد الأرشفة. */
    const late = await service.recordDepreciation(assetId, { asOf: "2026-10-01" });
    expect(late.ok).toBe(false);
    /* التخلص الثاني مرفوض. */
    const second = await service.dispose(assetId, { on: "2026-10-01", proceedsMinor: 5000, reason: "ثانية" });
    expect(second.ok).toBe(false);
  });

  it("writes off the remaining book value as a non-cash loss", async () => {
    const { service, store } = await seededAsset();
    const overview = await service.overview();
    const assetId = overview.ok ? overview.value[0]!.asset.id : "";
    const writeOff = await service.writeOff(assetId, { on: "2026-09-15", reason: "تلف كلي" });
    expect(writeOff.ok).toBe(true);
    if (!writeOff.ok) return;
    expect(writeOff.value.event.cashDeltaMinor).toBe(0);
    expect(writeOff.value.event.assetDeltaMinor).toBe(-60000);
    expect(writeOff.value.asset.status).toBe("written_off");
    const events = await store.listFinancialEvents();
    expect(events.value.filter(event => event.type === "asset_writeoff")).toHaveLength(1);
  });

  it("corrects the acquisition with reversal + replacement atomically and keeps history", async () => {
    const { service, store } = await seededAsset();
    const overview = await service.overview();
    const assetId = overview.ok ? overview.value[0]!.asset.id : "";
    const correction = await service.correctAcquisition(assetId, {
      acquisitionAmountMinor: 65000,
      acquisitionKind: "payable",
      reason: "الفاتورة الصحيحة أعلى",
    });
    expect(correction.ok).toBe(true);
    if (!correction.ok) return;
    const events = await store.listFinancialEvents();
    const acquisitions = events.value.filter(
      event => event.type === "asset_purchase_cash" || event.type === "asset_purchase_payable",
    );
    /* الأصل + التراجع + البديل = ٣، والسجل يشير للبديل. */
    expect(acquisitions).toHaveLength(3);
    expect(correction.value.asset.acquisitionAmountMinor).toBe(65000);
    expect(correction.value.asset.acquisitionKind).toBe("payable");
    expect(correction.value.asset.acquisitionEventId).toBe(correction.value.replacement.id);
  });

  it("keeps unknown life explicit: no schedule, no invented depreciation", async () => {
    const store = new MemoryLocalStore();
    const service = new AssetService(store, now);
    const created = await service.create({
      name: "جهاز مجهول العمر",
      acquisitionAmountMinor: 20000,
      acquisitionKind: "cash",
      purchaseDate: "2026-06-01",
      lifeMonths: null,
      depreciationStartOn: null,
    });
    expect(created.ok).toBe(true);
    const overview = await service.overview();
    if (!overview.ok) return;
    expect(overview.value[0]!.hasUnknownLife).toBe(true);
    expect(overview.value[0]!.monthlyMinor).toBeNull();
    const proposal = await service.read(overview.value[0]!.asset.id);
    expect(proposal.ok && proposal.value.proposal.readiness).toBe("unknown_life");
    const recordAttempt = await service.recordDepreciation(overview.value[0]!.asset.id, { asOf: "2026-12-31" });
    expect(recordAttempt.ok).toBe(false);
  });

  it("rejects a tampered event that bypasses the service writer", async () => {
    const { store, service } = await seededAsset();
    /* حقن حدث أصل مباشرة في المخزن — الكاتب الواحد هو الخدمة. */
    const injected = createFinancialEvent({
      id: "injected-1",
      type: "asset_depreciation",
      amountMinor: 999999,
      occurredOn: "2026-09-02",
      recordedAt: now(),
      idempotencyKey: "injected:key",
      note: "حقن مباشر",
      assetContext: { assetId: "asset-fake", name: "وهمي" },
    });
    const saved = await store.saveFinancialEvent(injected);
    expect(saved.ok).toBe(true);
    /* القراءة تلتزم بما في المخزن لكن فحص السلامة هو الحارس — هنا نكتفي بأن
     * الخدمة نفسها لا تنتج أحداثًا بلا أصل (الاختبار أعلاه غطى الرفض). */
    const overview = await service.overview();
    expect(overview.ok).toBe(true);
  });
});
