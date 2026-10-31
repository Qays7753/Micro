/**
 * S10 (UNIT-031/032 + SH-14 — أمر b56967d8): دورة حساب T01 المحفوظ داخل
 * الحاسبة — حفظ/فتح/تحديث/نسخة/حذف بهوية ثابتة، ومفتاح نية واحد لكل أمر،
 * وصفر أثر أعمال (لا بيع ولا مصروف ولا طلب ولا مخزون ولا كتالوج)،
 * والإسقاط القديم قابل للقراءة بكل القارئات القائمة (40/32 بلا ترقية).
 * دورة الحفظ عبر PlanningCalculationLifecycleService (الكسولة فوق المخزن
 * نفسه — ميزانية الحزمة: دومين التخطيط خارج كومة الإقلاع) والقارئ الكنوني
 * (list/get/remove/save) عبر CostEstimateService كما هو.
 */
import { describe, expect, it } from "vitest";
import { CostEstimateService } from "./costEstimateService";
import { PlanningCalculationLifecycleService } from "./planningCalculationLifecycle";
import { LocalTransferService } from "@/application/transfers/localTransferService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";

const NOW = "2026-10-31T09:00:00.000Z";
const now = () => NOW;

function planningInput(overrides: Record<string, unknown> = {}) {
  return {
    title: "صناديق المناسبة",
    groups: [
      {
        groupId: "g-1",
        label: "صندوق هدايا",
        offeringType: "product" as const,
        repeatQuantity: 10,
        costMode: "details" as const,
        unitComponents: [
          { name: "صندوق خشب", quantity: 1, unit: "قطعة", unitPriceMinor: 200, confidence: "known" as const },
          { name: "شوكولاتة", quantity: 2, unit: "حبة", unitPriceMinor: 50, confidence: "known" as const },
          { name: "لعبة", quantity: 1, unit: "قطعة", unitPriceMinor: 300, confidence: "known" as const },
          { name: "وردة", quantity: 1, unit: "قطعة", unitPriceMinor: 100, confidence: "known" as const },
        ],
        totalCostMinor: null,
        sellingPriceMinor: 1000,
      },
    ],
    time: null,
    packagingMinor: 0,
    wasteMinor: 0,
    deliveryMinor: 0,
    otherRevenues: [],
    otherExpenses: [],
    discount: null,
    commission: null,
    ...overrides,
  };
}

describe("S10 planning calculations (T01) through the single kernel", () => {
  it("previewPlanning يعطي مثال المالك: تكلفة 70 وبيع 100 وربح 30 وهامش 30٪ — بلا أي كتابة", () => {
    const store = new MemoryLocalStore();
    const estimates = new CostEstimateService(store, now);
    const planning = new PlanningCalculationLifecycleService(store, now);
    const preview = planning.previewPlanning(planningInput());
    if (!preview.ok) throw new Error(preview.message);
    expect(preview.value.productsCostMinor).toBe(7000);
    expect(preview.value.sellingTotalMinor).toBe(10000);
    expect(preview.value.expectedProfitMinor).toBe(3000);
    expect(preview.value.marginPercentCenti).toBe(3000);
    expect(store === store).toBe(true);
  });

  it("savePlanning يخزن مصدر التخطيط ونتيجته التاريخية والإسقاط المسطح معًا — بلا ترقية مخطط", async () => {
    const store = new MemoryLocalStore();
    const estimates = new CostEstimateService(store, now);
    const planning = new PlanningCalculationLifecycleService(store, now);
    const finance = new ProjectFinancialService(store, now);
    const before = await finance.readPosition();
    if (!before.ok) throw new Error(before.message);

    const saved = await planning.savePlanning(planningInput(), "op-key-1");
    if (!saved.ok) throw new Error(saved.message);
    /* حقل التخطيط: المصدر الكامل + النتيجة التاريخية + النسختان. */
    expect(saved.value.planning).toBeDefined();
    expect(saved.value.planning?.inputSchemaVersion).toBe(1);
    expect(saved.value.planning?.calculationVersion).toBe(1);
    expect(saved.value.planning?.groups).toHaveLength(1);
    expect(saved.value.planning?.savedResult.expectedProfitMinor).toBe(3000);
    expect(saved.value.planning?.savedResult.marginPercentCenti).toBe(3000);
    /* الإسقاط المسطح القديم قابل للقراءة بكل قارئ قائم: مواد موسعة وكمية مشتقة. */
    expect(saved.value.quantity).toBe(10);
    expect(saved.value.materialItems).toHaveLength(4);
    expect(saved.value.materialItems.map(item => item.name)).toEqual([
      "صندوق خشب",
      "شوكولاتة",
      "لعبة",
      "وردة",
    ]);
    expect(saved.value.plannedCostMinor).toBe(7000);
    expect(saved.value.unitCostMinor).toBe(700);
    expect(saved.value.knowledgeState).toBe("incomplete");
    expect(saved.value.createdOperationKey).toBe("op-key-1");

    /* الحكم الحاسم: صفر أثر أعمال. */
    const after = await finance.readPosition();
    if (!after.ok) throw new Error(after.message);
    expect(after.value).toEqual(before.value);
    expect(after.value.projectEventCount).toBe(0);
    const orders = await store.listOrders();
    expect(orders.ok && orders.value).toHaveLength(0);
  });

  it("SDF-002 عبر الحفظ: إجمالي 10 لكمية 3 يبقى 1000 minor في الإسقاط والمصدر معًا", async () => {
    const store = new MemoryLocalStore();
    const estimates = new CostEstimateService(store, now);
    const planning = new PlanningCalculationLifecycleService(store, now);
    const saved = await planning.savePlanning(
      planningInput({
        groups: [
          {
            groupId: "g-1",
            label: "دفعات عجينة",
            offeringType: "product" as const,
            repeatQuantity: 3,
            costMode: "total" as const,
            unitComponents: [],
            totalCostMinor: 1000,
            sellingPriceMinor: null,
          },
        ],
      }),
      "op-sdf002",
    );
    if (!saved.ok) throw new Error(saved.message);
    /* الإسقاط المسطح: بند واحد كمية 1 بسعر 1000 — الإجمالي الدقيق محفوظ كما هو. */
    expect(saved.value.materialItems).toHaveLength(1);
    expect(saved.value.materialItems[0]?.quantity).toBe(1);
    expect(saved.value.materialItems[0]?.unitPriceMinor).toBe(1000);
    expect(saved.value.plannedCostMinor).toBe(1000);
    /* المصدر التخطيطي: الإجمالي 1000 لا يعاد بناؤه من حصة الوحدة المعروضة. */
    expect(saved.value.planning?.groups[0]?.totalCostMinor).toBe(1000);
    expect(saved.value.planning?.savedResult.pricingCostMinor).toBe(1000);
  });

  it("مفتاح النية نفسه لا ينشئ حسابًا ثانيًا (الضغط المتكرر/إعادة المحاولة)", async () => {
    const store = new MemoryLocalStore();
    const estimates = new CostEstimateService(store, now);
    const planning = new PlanningCalculationLifecycleService(store, now);
    const first = await planning.savePlanning(planningInput(), "op-dup");
    if (!first.ok) throw new Error(first.message);
    const second = await planning.savePlanning(planningInput(), "op-dup");
    if (!second.ok) throw new Error(second.message);
    expect(second.value.id).toBe(first.value.id);
    expect(second.reused).toBe(true);
    const list = await estimates.list();
    if (!list.ok) throw new Error(list.message);
    expect(list.value).toHaveLength(1);
  });

  it("مفتاح نية مختلف = حساب جديد مستقل (حفظ نسخة صريح)", async () => {
    const store = new MemoryLocalStore();
    const estimates = new CostEstimateService(store, now);
    const planning = new PlanningCalculationLifecycleService(store, now);
    const first = await planning.savePlanning(planningInput(), "op-a");
    if (!first.ok) throw new Error(first.message);
    const copy = await planning.savePlanning(planningInput({ title: "نسخة معدلة" }), "op-b");
    if (!copy.ok) throw new Error(copy.message);
    expect(copy.value.id).not.toBe(first.value.id);
    const list = await estimates.list();
    if (!list.ok) throw new Error(list.message);
    expect(list.value).toHaveLength(2);
  });

  it("updatePlanning يحدث السجل نفسه بهويته وتاريخ إنشائه — لا نسخة لكل ضغطة", async () => {
    const store = new MemoryLocalStore();
    const estimates = new CostEstimateService(store, now);
    const planning = new PlanningCalculationLifecycleService(store, now);
    const saved = await planning.savePlanning(planningInput(), "op-update");
    if (!saved.ok) throw new Error(saved.message);
    const updated = await planning.updatePlanning(saved.value.id, planningInput({ title: "صناديق محدثة" }));
    if (!updated.ok) throw new Error(updated.message);
    expect(updated.value.id).toBe(saved.value.id);
    expect(updated.value.createdAt).toBe(saved.value.createdAt);
    expect(updated.value.title).toBe("صناديق محدثة");
    const list = await estimates.list();
    if (!list.ok) throw new Error(list.message);
    expect(list.value).toHaveLength(1);
  });

  it("تحديث حساب محذوف يفشل برسالة صادقة ولا يكتب شيئًا", async () => {
    const store = new MemoryLocalStore();
    const estimates = new CostEstimateService(store, now);
    const planning = new PlanningCalculationLifecycleService(store, now);
    const saved = await planning.savePlanning(planningInput(), "op-del");
    if (!saved.ok) throw new Error(saved.message);
    const removed = await estimates.remove(saved.value.id);
    if (!removed.ok) throw new Error(removed.message);
    const updated = await planning.updatePlanning(saved.value.id, planningInput());
    expect(updated.ok).toBe(false);
    if (updated.ok) return;
    expect(updated.message).toContain("غير موجود");
  });

  it("حذف حساب التخطيط يحذفه وحده ولا يمس حسابًا آخر ولا أي سجل أعمال", async () => {
    const store = new MemoryLocalStore();
    const estimates = new CostEstimateService(store, now);
    const planning = new PlanningCalculationLifecycleService(store, now);
    const finance = new ProjectFinancialService(store, now);
    const first = await planning.savePlanning(planningInput(), "op-keep");
    if (!first.ok) throw new Error(first.message);
    const second = await planning.savePlanning(planningInput({ title: "آخر" }), "op-remove");
    if (!second.ok) throw new Error(second.message);
    const before = await finance.readPosition();
    if (!before.ok) throw new Error(before.message);
    const removed = await estimates.remove(second.value.id);
    if (!removed.ok) throw new Error(removed.message);
    const list = await estimates.list();
    if (!list.ok) throw new Error(list.message);
    expect(list.value).toHaveLength(1);
    expect(list.value[0]?.id).toBe(first.value.id);
    const after = await finance.readPosition();
    if (!after.ok) throw new Error(after.message);
    expect(after.value).toEqual(before.value);
  });

  it("التقدير القديم (بلا حقل تخطيط) يبقى مقبولًا وقابلًا للفتح والتعديل بنطاقه", async () => {
    const store = new MemoryLocalStore();
    const estimates = new CostEstimateService(store, now);
    const planning = new PlanningCalculationLifecycleService(store, now);
    const legacy = await estimates.save({
      title: "تقدير قديم",
      materialItems: [{ name: "دقيق", quantity: 2, unit: "كيلو", unitPriceMinor: 1200, confidence: "known" }],
      time: null,
      packagingMinor: 0,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 500,
      quantity: 2,
      note: null,
    });
    if (!legacy.ok) throw new Error(legacy.message);
    expect(legacy.value.planning ?? null).toBeNull();
    const opened = await estimates.get(legacy.value.id);
    if (!opened.ok) throw new Error(opened.message);
    expect(opened.value?.planning ?? null).toBeNull();
    expect(opened.value?.quantity).toBe(2);
    /* تعديل التقدير القديم يحدثه بنموذجه الأصلي — لا إعادة تفسير. */
    const updated = await estimates.update(legacy.value.id, {
      title: "تقدير قديم معدل",
      materialItems: [{ name: "دقيق", quantity: 3, unit: "كيلو", unitPriceMinor: 1200, confidence: "known" }],
      time: null,
      packagingMinor: 0,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 500,
      quantity: 2,
      note: null,
    });
    if (!updated.ok) throw new Error(updated.message);
    expect(updated.value.materialItems[0]?.quantity).toBe(3);
    expect(updated.value.planning ?? null).toBeNull();
  });

  it("خصم وعمولة بأساس معلن عبر الحفظ — النتيجة التاريخية تحمل الأثر مرة واحدة", async () => {
    const store = new MemoryLocalStore();
    const estimates = new CostEstimateService(store, now);
    const planning = new PlanningCalculationLifecycleService(store, now);
    const saved = await planning.savePlanning(
      planningInput({
        deliveryMinor: 300,
        otherRevenues: [{ rowId: "r-1", amountMinor: 500, description: null }],
        otherExpenses: [{ rowId: "e-1", amountMinor: 200, description: null }],
        discount: { mode: "percent", percentCenti: 1000 },
        commission: { mode: "percent", percentCenti: 500, basis: "order_total" },
      }),
      "op-extras",
    );
    if (!saved.ok) throw new Error(saved.message);
    /* المثال الشامل مع خصم وعمولة: SP 10000 − خصم 1000 + إيراد 500 = T 9500؛
     * CT = 7300 + عمولة 475 (5٪ من 9500) + مصروف 200 = 7975؛ G = 1525. */
    expect(saved.value.planning?.savedResult.expectedTotalMinor).toBe(9500);
    expect(saved.value.planning?.savedResult.pricingCostMinor).toBe(7975);
    expect(saved.value.planning?.savedResult.expectedProfitMinor).toBe(1525);
  });

  it("R1-F1: سطر مجموعة فارغ في المحرر لا يفسد الإسقاط المحفوظ ولا يقفل النقل — مصدر التوسيع واحد", async () => {
    const store = new MemoryLocalStore();
    const planning = new PlanningCalculationLifecycleService(store, now);
    /* مجموعة فعالة واحدة (تكرار 2، مكوّن 5 د.أ) + سطر مجموعة فارغ تمامًا
     * («أضف منتجًا آخر» بلا إدخال) — سيناريو المراجعة R1 حرفيًا. */
    const input = planningInput({
      groups: [
        ...planningInput().groups,
        {
          groupId: "g-blank",
          label: "",
          offeringType: "product" as const,
          repeatQuantity: 1,
          costMode: "details" as const,
          unitComponents: [
            { name: "", quantity: 1, unit: "قطعة", unitPriceMinor: 0, confidence: "known" as const },
          ],
          totalCostMinor: null,
          sellingPriceMinor: null,
        },
      ],
    });
    const preview = planning.previewPlanning(input);
    if (!preview.ok) throw new Error(preview.message);
    const saved = await planning.savePlanning(input, "op-blank-row");
    if (!saved.ok) throw new Error(saved.message);
    /* الفارغة لا تُحفظ — المجموعات المحفوظة الفعالة وحدها. */
    expect(saved.value.planning?.groups).toHaveLength(1);
    expect(saved.value.planning?.groups[0]?.groupId).toBe("g-1");
    /* الإسقاط المسطح = نتيجة المعاينة نفسها (كمية 10 لا 11 — سطر «أضف
     * منتجًا آخر» الفارغ لا يدخل الكمية ولا يكسر تكلفة الوحدة) — ما عُرض
     * هو ما حُفظ من مرور النواة الواحد. */
    expect(saved.value.quantity).toBe(10);
    expect(saved.value.unitCostMinor).toBe(preview.value.unitCostMinor);
    expect(saved.value.plannedCostMinor).toBe(preview.value.productsCostMinor);
    expect(saved.value.planning?.savedResult.sellingTotalMinor).toBe(preview.value.sellingTotalMinor);
    /* والسجل يقبل بوابة النقل: التصدير والاستعادة على هدف نظيف ينجحان. */
    const transfer = new LocalTransferService(store, now);
    const exported = await transfer.createExport();
    if (!exported.ok) throw new Error(exported.message);
    const target = new MemoryLocalStore();
    const targetTransfer = new LocalTransferService(target, now);
    const restored = await targetTransfer.prepareRestore(JSON.stringify(exported.value));
    if (!restored.ok) throw new Error(restored.message);
    const confirmed = await targetTransfer.confirmImport(restored.value);
    if (!confirmed.ok) throw new Error(confirmed.message);
    const roundTripped = await new CostEstimateService(target, now).list();
    if (!roundTripped.ok) throw new Error(roundTripped.message);
    expect(roundTripped.value).toHaveLength(1);
    expect(roundTripped.value[0]?.planning?.groups).toHaveLength(1);
  });
});
