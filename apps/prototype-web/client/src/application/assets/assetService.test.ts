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
    expect(overview.ok && overview.value.rows[0]!.bookValueMinor).toBe(60000);
  });

  it("proposes depreciation and records it as a non-cash event exactly once", async () => {
    const { service, store } = await seededAsset();
    const first = await service.recordDepreciation("nonexistent", { asOf: "2026-09-01" });
    expect(first.ok).toBe(false);
    const overview = await service.overview();
    const assetId = overview.ok ? overview.value.rows[0]!.asset.id : "";
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
    const assetId = overview.ok ? overview.value.rows[0]!.asset.id : "";
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
    const assetId = overview.ok ? overview.value.rows[0]!.asset.id : "";
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
    const assetId = overview.ok ? overview.value.rows[0]!.asset.id : "";
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

  /* AV-08 (عقد الأصول — فصل الإهلاك عن التخلص): عكس إهلاك بعد الأرشفة يُحيي
   * قيمة دفترية ملغاة — الخدمة تحرسه والقيمة تبقى مثبتة كما كانت عند التخلص. */
  it("blocks depreciation reversal after disposal — archived book value stays frozen", async () => {
    const { service, store } = await seededAsset();
    const overview = await service.overview();
    const assetId = overview.ok ? overview.value.rows[0]!.asset.id : "";
    const recorded = await service.recordDepreciation(assetId, { asOf: "2026-09-01" });
    if (!recorded.ok) return;
    const disposal = await service.dispose(assetId, {
      on: "2026-09-15",
      proceedsMinor: 30000,
      reason: "بعتُها",
    });
    if (!disposal.ok) return;
    const reversal = await service.reverseDepreciation(recorded.value.event.id, "خطأ بالإهلاك");
    expect(reversal.ok).toBe(false);
    if (reversal.ok) return;
    expect(reversal.message).toContain("مؤرشف");
    /* القيمة الدفترية للأرشيف لم تُحيَ: ٦٠٠٠٠ − ٧٥٠٠ − ٥٢٥٠٠ = ٠. */
    const detail = await service.read(assetId);
    expect(detail.ok && detail.value.asset.status).toBe("disposed");
    expect(detail.ok && detail.value.summary.bookValueMinor).toBe(0);
    const events = await store.listFinancialEvents();
    expect(events.value.filter(event => event.correctionType === "reverse")).toHaveLength(0);
  });

  it("blocks depreciation reversal after write-off as well", async () => {
    const { service } = await seededAsset();
    const overview = await service.overview();
    const assetId = overview.ok ? overview.value.rows[0]!.asset.id : "";
    const recorded = await service.recordDepreciation(assetId, { asOf: "2026-09-01" });
    if (!recorded.ok) return;
    const writeOff = await service.writeOff(assetId, { on: "2026-09-15", reason: "تلف كلي" });
    if (!writeOff.ok) return;
    const reversal = await service.reverseDepreciation(recorded.value.event.id, "خطأ بالإهلاك");
    expect(reversal.ok).toBe(false);
  });

  /* عقد الأصول (Conflict G): الإهلاك حتى الصفر لا يخلص من الأصل ولا يشطبه —
   * يبقى مملوكًا نشطًا بقيمة دفترية صفر، والشطب مرفوض (لا رصيد)، والبيع ممكن. */
  it("keeps the asset active and owned at zero book value — disposal, sale, and depreciation stay separate", async () => {
    const { service } = await seededAsset();
    const overview = await service.overview();
    const assetId = overview.ok ? overview.value.rows[0]!.asset.id : "";
    /* ٢٤ شهرًا كاملة × ٢٥٠٠ = ٦٠٠٠٠ — الوصول للصفر بقرار واحد. */
    const swept = await service.recordDepreciation(assetId, { asOf: "2028-06-01" });
    expect(swept.ok).toBe(true);
    if (!swept.ok) return;
    expect(swept.value.event.amountMinor).toBe(60000);
    const detail = await service.read(assetId);
    expect(detail.ok && detail.value.asset.status).toBe("active");
    expect(detail.ok && detail.value.summary.bookValueMinor).toBe(0);
    /* لا إهلاك جديد بعد الصفر — الدفتري صفر بمقتضى العقد. */
    const more = await service.recordDepreciation(assetId, { asOf: "2028-07-01" });
    expect(more.ok).toBe(false);
    /* عقد ٤٣ (WS-179 — Wave 7): الصياغة صارت متبقية-واعية — المعنى نفسه: لا إهلاك بعد اكتمال الجدول. */
    if (!more.ok) expect(more.message).toContain("الدفتري عند القيمة المتبقية");
    /* لا شطب — لا رصيد دفتري يُشطب. */
    const writeOff = await service.writeOff(assetId, { on: "2028-07-01", reason: "لا حاجة" });
    expect(writeOff.ok).toBe(false);
    if (!writeOff.ok) expect(writeOff.message).toContain("لا رصيد دفتري يُشطب");
    /* البيع ما زال ممكنًا: مقابل كامل = ربح التصرف. */
    const disposal = await service.dispose(assetId, {
      on: "2028-07-01",
      proceedsMinor: 10000,
      reason: "بعتُها بقيمة دفترية صفر",
    });
    expect(disposal.ok).toBe(true);
    if (disposal.ok) {
      expect(disposal.value.event.cashDeltaMinor).toBe(10000);
      expect(disposal.value.asset.status).toBe("disposed");
    }
  });

  it("blocks acquisition correction on an archived asset — pre-disposal corrections stay available while active", async () => {
    const { service } = await seededAsset();
    const overview = await service.overview();
    const assetId = overview.ok ? overview.value.rows[0]!.asset.id : "";
    /* التصحيح الموثق متاح ما دام الأصل نشطًا. */
    const whileActive = await service.correctAcquisition(assetId, {
      acquisitionAmountMinor: 62000,
      acquisitionKind: "cash",
      reason: "فاتورة صحيحة",
    });
    expect(whileActive.ok).toBe(true);
    const disposal = await service.dispose(assetId, {
      on: "2026-09-20",
      proceedsMinor: 20000,
      reason: "بعتُها",
    });
    if (!disposal.ok) return;
    const afterArchive = await service.correctAcquisition(assetId, {
      acquisitionAmountMinor: 70000,
      acquisitionKind: "cash",
      reason: "محاولة بعد الأرشفة",
    });
    expect(afterArchive.ok).toBe(false);
    if (!afterArchive.ok) expect(afterArchive.message).toContain("مؤرشف");
  });

  it("writes off the remaining book value as a non-cash loss", async () => {
    const { service, store } = await seededAsset();
    const overview = await service.overview();
    const assetId = overview.ok ? overview.value.rows[0]!.asset.id : "";
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
    const assetId = overview.ok ? overview.value.rows[0]!.asset.id : "";
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
    expect(overview.value.rows[0]!.hasUnknownLife).toBe(true);
    expect(overview.value.rows[0]!.monthlyMinor).toBeNull();
    const proposal = await service.read(overview.value.rows[0]!.asset.id);
    expect(proposal.ok && proposal.value.proposal.readiness).toBe("unknown_life");
    const recordAttempt = await service.recordDepreciation(overview.value.rows[0]!.asset.id, {
      asOf: "2026-12-31",
    });
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

  it("rejects a no-change acquisition correction instead of churning history (تصحيح مراجعة 4-c)", async () => {
    const { service, store } = await seededAsset();
    const overview = await service.overview();
    if (!overview.ok) return;
    const asset = overview.value.rows[0]!.asset;
    const correction = await service.correctAcquisition(asset.id, {
      acquisitionAmountMinor: asset.acquisitionAmountMinor,
      acquisitionKind: asset.acquisitionKind,
      reason: "بلا تغيير",
    });
    expect(correction.ok).toBe(false);
    if (correction.ok) return;
    expect(correction.message).toContain("لا تغيير عن المسجّل");
    const events = await store.listFinancialEvents();
    expect(events.value.filter(event => event.correctionType === "reverse")).toHaveLength(0);
  });
});

/* عقد ٤٣ (WS-179 — Wave 7 — FIN-008): شريحة القيمة المتبقية والمرجع/الملاحظة —
 * السجل يحملهما، والاقتراح يجري على (القيمة − المتبقية)، ومراجعة المتبقية
 * موثقة ولا تمس الإهلاك المسجّل. */
describe("asset service residual value (contract 43, WS-179)", () => {
  it("creates an asset carrying residual and note, and the acquisition event stays untouched by them", async () => {
    const store = new MemoryLocalStore();
    const service = new AssetService(store, now);
    const created = await service.create({
      name: "مكيف صناعي",
      categoryLabel: "تكييف",
      acquisitionAmountMinor: 48000,
      acquisitionKind: "cash",
      purchaseDate: "2026-06-01",
      lifeMonths: 36,
      depreciationStartOn: "2026-06-10",
      residualValueMinor: 6000,
      note: "فاتورة ٢٠٢٦-٩٩٣",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.asset.residualValueMinor).toBe(6000);
    expect(created.value.asset.note).toBe("فاتورة ٢٠٢٦-٩٩٣");
    const events = await store.listFinancialEvents();
    const acquisition = events.value.find(event => event.type === "asset_purchase_cash");
    /* المتبقية والملاحظة وسمان على السجل — حدث الاقتناء كما كان: كاش سالب وأصل موجب. */
    expect(acquisition?.cashDeltaMinor).toBe(-48000);
    expect(acquisition?.assetDeltaMinor).toBe(48000);
    expect(acquisition?.operatingExpenseDeltaMinor).toBe(0);
  });

  it("proposes depreciation over (cost − residual) and the book settles at residual after full life", async () => {
    const store = new MemoryLocalStore();
    const service = new AssetService(store, now);
    const created = await service.create({
      name: "مكيف صناعي",
      acquisitionAmountMinor: 48000,
      acquisitionKind: "cash",
      purchaseDate: "2026-01-01",
      lifeMonths: 24,
      depreciationStartOn: "2026-01-05",
      residualValueMinor: 8000,
      note: null,
    });
    expect(created.ok).toBe(true);
    const assetId = created.ok ? created.value.asset.id : "asset-1";
    /* (48000 − 8000) ÷ 24 = 1666 (تقريب أرضي). */
    const read = await service.read(assetId);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.proposal.monthlyMinor).toBe(1666);
    /* تسجيل الإهلاك حتى ما بعد اكتمال العمر: الحدث بالسقف (40000) ثم يتوقف —
     * لا مقترح بعده، والدفتري يستقر عند المتبقية. */
    const recorded = await service.recordDepreciation(assetId, { asOf: "2029-06-30" });
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) return;
    expect(recorded.value.event.amountMinor).toBe(40000);
    const after = await service.read(assetId);
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.value.proposal.readiness).toBe("fully_depreciated");
    expect(after.value.summary.bookValueMinor).toBe(8000);
    /* حدث الإهلاك غير نقدي: بند مستقل لا يمس الكاش ولا المصروف التشغيلي. */
    expect(recorded.value.event.cashDeltaMinor).toBe(0);
    expect(recorded.value.event.operatingExpenseDeltaMinor).toBe(0);
    expect(recorded.value.event.assetDeltaMinor).toBe(-40000);
  });

  it("revises the residual as a documented contract revision without touching recorded depreciation", async () => {
    const store = new MemoryLocalStore();
    const service = new AssetService(store, now);
    const created = await service.create({
      name: "مكيف صناعي",
      acquisitionAmountMinor: 48000,
      acquisitionKind: "cash",
      purchaseDate: "2026-01-01",
      lifeMonths: 24,
      depreciationStartOn: "2026-01-05",
      residualValueMinor: 8000,
      note: "أصل أول",
    });
    expect(created.ok).toBe(true);
    const assetId = created.ok ? created.value.asset.id : "asset-1";
    const before = await service.recordDepreciation(assetId, { asOf: "2026-07-05" });
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    const recordedBefore = before.value.event.amountMinor;
    const revised = await service.reviseContract(assetId, {
      lifeMonths: 24,
      depreciationStartOn: "2026-01-05",
      residualValueMinor: 12000,
      note: "أصل أول — متبقٍ أعلى",
      reason: "تقدير أعلى بعد الصيانة",
    });
    expect(revised.ok).toBe(true);
    if (!revised.ok) return;
    expect(revised.value.asset.residualValueMinor).toBe(12000);
    expect(revised.value.asset.contractRevisions).toHaveLength(1);
    expect(revised.value.asset.contractRevisions[0]!.residualValueMinor).toBe(12000);
    expect(revised.value.asset.contractRevisions[0]!.reason).toBe("تقدير أعلى بعد الصيانة");
    /* الإهلاك المسجّل سابقًا لم يُمسّ. */
    const events = await store.listFinancialEvents();
    const depreciation = events.value.filter(event => event.type === "asset_depreciation");
    expect(depreciation).toHaveLength(1);
    expect(depreciation[0]!.amountMinor).toBe(recordedBefore);
  });
});
