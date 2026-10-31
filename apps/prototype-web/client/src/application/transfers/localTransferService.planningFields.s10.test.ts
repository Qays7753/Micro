import { describe, expect, it } from "vitest";
import { LocalTransferService } from "./localTransferService";
import { CostEstimateService } from "@/application/estimates/costEstimateService";
import { PlanningCalculationLifecycleService } from "@/application/estimates/planningCalculationLifecycle";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";

const now = () => "2026-10-31T09:00:00.000Z";

/* S10 (UNIT-032/SH-14 — أمر b56967d8): دورة النقل لحقول حساب T01 المحفوظ —
 * الحقل الاختياري يعبر تصديرًا وواردًا واستعادة حرفيًا على المهايئين
 * (40/32 بلا ترقية — نمط S06/S09)، والملف القديم بلا الحقل يبقى مقبولًا،
 * والملف المُلاعب بحقل تخطيط ناقص الشكل يُرفض قبل أي كتابة هدف والهدف
 * لا يُمس (رفض ما قبل المعاينة). */

const planningInput = {
  title: "صناديق المناسبة",
  groups: [
    {
      groupId: "g-1",
      label: "صندوق هدايا",
      offeringType: "product" as const,
      repeatQuantity: 10,
      costMode: "details" as const,
      unitComponents: [
        { name: "شوكولاتة", quantity: 2, unit: "حبة", unitPriceMinor: 50, confidence: "known" as const },
      ],
      totalCostMinor: null,
      sellingPriceMinor: 1000,
    },
    {
      groupId: "g-2",
      label: "صندوق فخم",
      offeringType: "service" as const,
      repeatQuantity: 2,
      costMode: "total" as const,
      unitComponents: [],
      totalCostMinor: 1600,
      sellingPriceMinor: 1200,
    },
  ],
  time: { minutes: 30, hourlyRateMinor: 4000, confidence: "estimated" as const },
  packagingMinor: 100,
  wasteMinor: 0,
  deliveryMinor: 300,
  otherRevenues: [{ rowId: "r-1", amountMinor: 500, description: "خدمة إضافية" }],
  otherExpenses: [{ rowId: "e-1", amountMinor: 200, description: null }],
  discount: { mode: "percent" as const, percentCenti: 1000 },
  commission: { mode: "percent" as const, percentCenti: 500, basis: "order_total" as const },
};

describe("S10 planning fields transfer round-trip", () => {
  it("الحقول التخطيطية تعبر تصديرًا وواردًا واستعادة حرفيًا — بلا ترقية مخطط (40/32)", async () => {
    const store = new MemoryLocalStore();
    const planning = new PlanningCalculationLifecycleService(store, now);
    const saved = await planning.savePlanning(planningInput, "op-transfer");
    if (!saved.ok) throw new Error(saved.message);

    const service = new LocalTransferService(store, now);
    const exported = await service.createExport();
    if (!exported.ok) throw new Error(exported.message);
    expect(exported.value.version).toBe(32);
    expect(exported.value.schemaVersion).toBe(40);
    const text = JSON.stringify(exported.value);

    const target = new MemoryLocalStore();
    const targetService = new LocalTransferService(target, now);
    const preview = await targetService.prepareRestore(text);
    if (!preview.ok) throw new Error(preview.message);
    expect(preview.value.summary.costEstimates).toBe(1);
    const confirmed = await targetService.confirmImport(preview.value);
    if (!confirmed.ok) throw new Error(confirmed.message);
    const roundTripped = await new CostEstimateService(target, now).list();
    if (!roundTripped.ok) throw new Error(roundTripped.message);
    expect(roundTripped.value).toHaveLength(1);
    const restored = roundTripped.value[0];
    if (!restored?.planning) throw new Error("planning fields lost in transfer");
    /* المساواة العميقة: المجموعات بأساسها ونطاقها والأسعار والإضافات
     * والخصم والعمولة والنتيجة التاريخية تعبر كما دخلت. */
    expect(restored.planning.groups).toEqual(saved.value.planning?.groups);
    expect(restored.planning.otherRevenues).toEqual(saved.value.planning?.otherRevenues);
    expect(restored.planning.otherExpenses).toEqual(saved.value.planning?.otherExpenses);
    expect(restored.planning.discount).toEqual(saved.value.planning?.discount);
    expect(restored.planning.commission).toEqual(saved.value.planning?.commission);
    expect(restored.planning.savedResult).toEqual(saved.value.planning?.savedResult);
    expect(restored.planning.time).toEqual(saved.value.planning?.time);
    expect(restored.createdOperationKey).toBe("op-transfer");
  });

  it("الملف القديم بلا حقل التخطيط يبقى مقبولًا كما هو (توافق رجعي)", async () => {
    const store = new MemoryLocalStore();
    const estimates = new CostEstimateService(store, now);
    const planning = new PlanningCalculationLifecycleService(store, now);
    const legacy = await estimates.save({
      title: "تقدير قديم",
      materialItems: [{ name: "دقيق", quantity: 1, unit: "كيلو", unitPriceMinor: 1200, confidence: "known" }],
      time: null,
      packagingMinor: 0,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 0,
      quantity: 1,
      note: null,
    });
    if (!legacy.ok) throw new Error(legacy.message);

    const service = new LocalTransferService(store, now);
    const exported = await service.createExport();
    if (!exported.ok) throw new Error(exported.message);
    const text = JSON.stringify(exported.value);

    const target = new MemoryLocalStore();
    const targetService = new LocalTransferService(target, now);
    const preview = await targetService.prepareRestore(text);
    if (!preview.ok) throw new Error(preview.message);
    const confirmed = await targetService.confirmImport(preview.value);
    if (!confirmed.ok) throw new Error(confirmed.message);
    const roundTripped = await new CostEstimateService(target, now).list();
    if (!roundTripped.ok) throw new Error(roundTripped.message);
    expect(roundTripped.value[0]?.planning ?? null).toBeNull();
  });

  it("حقل تخطيط ناقص الشكل يُرفض قبل أي كتابة هدف — والهدف بايت-متطابق", async () => {
    const source = new MemoryLocalStore();
    const planning = new PlanningCalculationLifecycleService(source, now);
    const saved = await planning.savePlanning(planningInput, "op-tamper");
    if (!saved.ok) throw new Error(saved.message);

    const service = new LocalTransferService(source, now);
    const exported = await service.createExport();
    if (!exported.ok) throw new Error(exported.message);
    const file = JSON.parse(JSON.stringify(exported.value)) as {
      data: { costEstimates: { planning: Record<string, unknown> }[] };
    };
    /* ملف مُلاعب: مجموعة بلا تكرار صحيح (الشكل الكامل يُفحص قبل المعاينة). */
    const tamperedGroup = file.data.costEstimates[0]?.planning;
    if (!tamperedGroup) throw new Error("expected planning fields");
    (tamperedGroup.groups as { repeatQuantity: unknown }[])[0]!.repeatQuantity = "عشرة";

    const target = new MemoryLocalStore();
    const targetService = new LocalTransferService(target, now);
    /* R3-N2: الدليل حرفي — لقطة كاملة للهدف قبل الرفض وبعده تُقارن
     * بالمساواة العميقة (لا تكفي قائمة التقديرات وحدها لدعوى «بلا كتابة»). */
    const targetBefore = await targetService.createExport();
    if (!targetBefore.ok) throw new Error(targetBefore.message);
    const outcome = await targetService.prepareRestore(JSON.stringify(file));
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    const targetAfter = await targetService.createExport();
    if (!targetAfter.ok) throw new Error(targetAfter.message);
    expect(targetAfter.value.data).toEqual(targetBefore.value.data);
    /* الرفض قبل أي كتابة: الهدف فارغ تمامًا. */
    const targetEstimates = await new CostEstimateService(target, now).list();
    if (!targetEstimates.ok) throw new Error(targetEstimates.message);
    expect(targetEstimates.value).toHaveLength(0);
  });

  it("حساب تخطيط بمفتاح نية فقط بلا شكل صحيح يُرفض — بوابة الشكل الكاملة", async () => {
    const source = new MemoryLocalStore();
    const service = new LocalTransferService(source, now);
    const exported = await service.createExport();
    if (!exported.ok) throw new Error(exported.message);
    const file = JSON.parse(JSON.stringify(exported.value)) as {
      data: { costEstimates: Record<string, unknown>[] };
    };
    file.data.costEstimates = [
      {
        id: "estimate-fake",
        title: "ملف مُلاعب",
        currency: "JOD",
        materialItems: [],
        time: null,
        packagingMinor: 0,
        deliveryMinor: 0,
        wasteMinor: 0,
        safetyBufferMinor: 0,
        quantity: 1,
        plannedCostMinor: 0,
        unitCostMinor: 0,
        priceFloorMinor: 0,
        knowledgeState: "known",
        note: null,
        createdAt: "2026-10-31T09:00:00.000Z",
        updatedAt: "2026-10-31T09:00:00.000Z",
        planning: { inputSchemaVersion: 1 },
      },
    ];
    const target = new MemoryLocalStore();
    const targetService = new LocalTransferService(target, now);
    const outcome = await targetService.prepareRestore(JSON.stringify(file));
    expect(outcome.ok).toBe(false);
  });

  it("R2-F1: حساب بخسارة متوقعة صادقة (ربح وهامش سالبان) يعبر التصدير والاستعادة — لا قفل نسخة احتياطية", async () => {
    /* «سعر البيع حر بلا حد أدنى»: بيع 1000+200=1200 على تكلفة
     * 2600+2000 وقت+100+300 = 5000 ⇒ ربح −3800 وهامش سالب — حالة عقدية
     * مشروعة (U031-AC23) لا تُرفض بوابة النقل. */
    const store = new MemoryLocalStore();
    const planning = new PlanningCalculationLifecycleService(store, now);
    const saved = await planning.savePlanning(
      {
        ...planningInput,
        groups: [
          { ...planningInput.groups[0]!, sellingPriceMinor: 100 },
          { ...planningInput.groups[1]!, sellingPriceMinor: 100 },
        ],
        discount: null,
        commission: null,
        otherRevenues: [],
        otherExpenses: [],
      },
      "op-honest-loss",
    );
    if (!saved.ok) throw new Error(saved.message);
    expect(saved.value.planning?.savedResult.expectedProfitMinor ?? 0).toBeLessThan(0);
    expect(saved.value.planning?.savedResult.marginPercentCenti ?? 0).toBeLessThan(0);

    const service = new LocalTransferService(store, now);
    const exported = await service.createExport();
    if (!exported.ok) throw new Error(exported.message);
    const target = new MemoryLocalStore();
    const targetService = new LocalTransferService(target, now);
    const restored = await targetService.prepareRestore(JSON.stringify(exported.value));
    if (!restored.ok) throw new Error(restored.message);
    const confirmed = await targetService.confirmImport(restored.value);
    if (!confirmed.ok) throw new Error(confirmed.message);
    const roundTripped = await new CostEstimateService(target, now).list();
    if (!roundTripped.ok) throw new Error(roundTripped.message);
    expect(roundTripped.value[0]?.planning?.savedResult.expectedProfitMinor).toBeLessThan(0);
    expect(roundTripped.value[0]?.planning?.savedResult.marginPercentCenti).toBeLessThan(0);
  });
});
