/* REM-006 (WS-203 — المعالجة المنطقية النهائية 2026-09-29): حارس قرارات المالك
 * المعتمدة D-03/D-08/D-09/D-11 في حدودها غير المرئية.
 *
 * الجزء الأول (وثائق): يثبّت أن التصحيح المؤرخ لعقد 05 §3.2.1 (D-03) موجودًا
 * بجمله الملزمة وأن وسم «معلق عمدًا» زال من فقرة F-008، وأن الخريطة الدلالية
 * لـneeds_review (D-09) موجودة في عقد 05 §8.1 وقاموس 08 بأربع دلالاتها، وأن
 * «تمت التسوية» (D-08) مسجلة في القاموس مع منع «مغلق» كاسم حالة مالية —
 * الإزالة الصامتة لأي منها = فشل بالاسم.
 *
 * الجزء الثاني (سلوك): يثبت أن رفض الانتقال من الحالة المسوّاة يسمّيها
 * باسمها الكنوني «تمت التسوية» (D-08)، وأن خدمة التكرار ترفض الطلب
 * المنتهي بلا أي تغيير سجل (تصحيح المرحلة أ بتاريخ 2026-09-29: نص رسالة
 * الرفض نسخة عرض تصل المستخدم من صفحة Schedule.tsx — أُعيدت إلى نصها
 * على main؛ نطاق D-08 غير المرئي لا يشمل نصوص العرض).
 *
 * الجزء الثالث (حدود): يثبت أن كل ما سبق حدث بلا أي تغيير مخطط/تصدير —
 * الزوج 38/30 كما هو (D-09/D-03 حرفيًا: لا ترحيل لأجل صياغة). */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { localExportVersion, localSchemaVersion } from "@/storage/local/types";
import {
  calculateCostSnapshot,
  collectDeposit,
  createCraftOrder,
  transitionOrder,
} from "@micro-domain/craft-order/index.js";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { ScheduleService } from "@/application/scheduling/scheduleService";

function readRepoFile(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
}

describe("REM-006 — قرار المالك D-03: تصحيح مؤرخ في عقد 05 §3.2.1 (كلفة توصيل المشروع)", () => {
  it("the dated resolution is present with its binding rules (doc freeze)", () => {
    const contract05 = readRepoFile("../../../../docs/contracts/05-financial-p0-policies.md");
    const f008 = contract05.slice(
      contract05.indexOf("إعلان كلفة توصيل المشروع"),
      contract05.indexOf("جدول مفردات الهدر"),
    );
    expect(f008).toContain("قرار المالك D-03، 2026-09-29");
    expect(f008).toContain("حقل تحلل تفسيري");
    expect(f008).toContain("لا يُطرح ثانية");
    expect(f008).toContain("مرة واحدة عندما تُسجل ضمن لقطة التكلفة");
    expect(f008).toContain("قيمة الطلب القابلة للتحصيل مرة واحدة");
    expect(f008).toContain("معلومة سياقية فقط");
    expect(f008).toContain("حصة المشروع وحصة الزبون");
    expect(f008).toContain("«غير مسجلة بعد» ولا تُعامل صفرًا");
    /* وسم التعليق زال: القرار لم يبقَ معلقًا في النص الكنوني. */
    expect(f008).not.toContain("معلق عمدًا");
  });

  it("the nine-term period-result equation survives the correction untouched (W4-F freeze)", () => {
    const contract05 = readRepoFile("../../../../docs/contracts/05-financial-p0-policies.md");
    const equation = contract05.slice(
      contract05.indexOf("### 3.2.1"),
      contract05.indexOf("تاريخ إدخال الطلب في الفترة"),
    );
    for (const term of [
      "recognizedRevenueMinor",
      "directSaleRevenueMinor",
      "effectiveDirectCostMinor",
      "directSaleCostKnownMinor",
      "recordedOperatingExpenseMinor",
      "nonCashLossMinor",
      "assetDepreciationMinor",
      "assetWriteOffLossMinor",
      "assetDisposalResultMinor",
      "retainedDepositRevenueMinor",
    ]) {
      expect(equation).toContain(term);
    }
    expect(contract05).toContain("لا تدخل الاستثمارات أو السحوبات الشخصية أو الكاش أو الذمم");
  });
});

describe("REM-006 — قرار المالك D-08: «تمت التسوية» الاسم الكنوني للحالة settled", () => {
  it("the glossary registers the canonical name and forbids «مغلق» as a financial-state name", () => {
    const glossary = readRepoFile("../../../../docs/08-glossary.md");
    const entry = glossary.slice(glossary.indexOf("| «تمت التسوية» (`settled`) |"));
    expect(entry).toContain("قرار المالك D-08");
    expect(entry).toContain("الاسم الكنوني");
    expect(entry).toContain("«مغلق»");
    expect(entry).toContain("اسم منافس لحالة مالية");
  });

  it("a transition refusal out of the settled state names it by its canonical Arabic name", () => {
    const cost = calculateCostSnapshot("d08-cost", {
      currency: "JOD",
      materialItems: [],
      time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
      packagingMinor: 0,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 0,
      quantity: 1,
      createdAt: "2026-09-01T00:00:00.000Z",
      freshnessDays: null,
    });
    let order = createCraftOrder({
      id: "d08-order",
      customerName: "أمينة",
      itemName: "طلب مستقر",
      specifications: "اختبار",
      quantity: 1,
      agreedPriceMinor: 5000,
      costSnapshot: cost,
      createdAt: "2026-09-01T00:00:00.000Z",
    });
    order = collectDeposit(order, 5000, "d08-deposit", "2026-09-01T01:00:00.000Z");
    for (const [to, key] of [
      ["provisional_agreement", "d08-agreement"],
      ["confirmed", "d08-confirmed"],
      ["in_progress", "d08-progress"],
      ["ready", "d08-ready"],
      ["delivered", "d08-delivered"],
    ] as const) {
      order = transitionOrder(order, { to, idempotencyKey: key, createdAt: "2026-09-01T02:00:00.000Z" });
    }
    /* الدفع الكامل قبل التسليم → التسليم ينقل إلى settled مباشرة (عقد 05 §3.2). */
    expect(order.status).toBe("settled");
    expect(() =>
      transitionOrder(order, {
        to: "in_progress",
        idempotencyKey: "d08-refused",
        createdAt: "2026-09-01T03:00:00.000Z",
      }),
    ).toThrow("تمت التسوية");
  });

  it("recurrence on a finished lifecycle order is rejected without changing any record (behavior only)", async () => {
    const store = new MemoryLocalStore();
    const cost = calculateCostSnapshot("d08b-cost", {
      currency: "JOD",
      materialItems: [],
      time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
      packagingMinor: 0,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 0,
      quantity: 1,
      createdAt: "2026-08-22T00:00:00.000Z",
      freshnessDays: null,
    });
    const order = createCraftOrder({
      id: "d08b-order",
      customerName: "سارة",
      itemName: "طلب منتهٍ",
      specifications: "اختبار",
      quantity: 1,
      agreedPriceMinor: 2000,
      costSnapshot: cost,
      createdAt: "2026-08-22T00:00:00.000Z",
    });
    await store.saveOrder({
      id: "d08b-order",
      /* بذر اختبار مباشر للحالة المنتهية — المسار الكامل مغطى في اختبار
       * الانتقال أعلاه؛ هنا مقصوده استدعاء الخدمة نفسها. */
      order: { ...order, status: "cancelled", nextAction: "راجع إغلاق الطلب" },
      deliveryDate: "2026-08-23",
      agreementSource: null,
      createdAt: "2026-08-22T00:00:00.000Z",
      updatedAt: "2026-08-22T00:00:00.000Z",
    });
    await new ScheduleService(store, () => "2026-08-23T08:00:00.000Z").overview();
    const source = await store.getSchedule("schedule-d08b-order");
    if (!source.ok || !source.value) throw new Error("source schedule should exist");
    const { ScheduleRecurrenceService } = await import("@/application/scheduling/recurrenceService");
    const service = new ScheduleRecurrenceService(store, () => "2026-08-23T08:00:00.000Z");
    const result = await service.create({
      sourceScheduleId: source.value.id,
      frequency: "weekly",
      occurrenceCount: 2,
    });
    expect(result).toMatchObject({ ok: false, code: "validation_error" });
    /* تصحيح المرحلة أ (2026-09-29): نص الرسالة نسخة عرض يعرضها
     * Schedule.tsx — عاد إلى نصه على main، فلا يُحرس محتواه هنا؛
     * المحروس غير المرئي هو الرفض نفسه وعدم تغيير أي سجل. */
    const recurrences = await store.listRecurrences();
    if (recurrences.ok) {
      expect(
        recurrences.value.every(recurrence => recurrence.id !== `recurrence-${source.value?.id}-weekly-2`),
      ).toBe(true);
    }
  });
});

describe("REM-006 — قرار المالك D-09: الخريطة الدلالية الكنونية لـneeds_review", () => {
  it("contract 05 §8.1 carries the four named meanings with the no-schema rule (doc freeze)", () => {
    const contract05 = readRepoFile("../../../../docs/contracts/05-financial-p0-policies.md");
    const mapping = contract05.slice(contract05.indexOf("### 8.1"));
    expect(mapping).toContain("قرار المالك D-09 — 2026-09-29");
    expect(mapping).toContain("«موقوف للمراجعة»");
    expect(mapping).toContain("«بانتظار قرارك»");
    expect(mapping).toContain("«يوجد فرق يحتاج تسوية»");
    expect(mapping).toContain("«البيانات غير مكتملة»");
    expect(mapping).toContain("لا تغيير مخطط ولا تصدير ولا ترحيل");
    expect(mapping).toContain("DEFERRED_UI");
  });

  it("the glossary carries the needs_review entry with the same four meanings", () => {
    const glossary = readRepoFile("../../../../docs/08-glossary.md");
    const entry = glossary.slice(glossary.indexOf("| «يحتاج مراجعة» (`needs_review`) |"));
    expect(entry).toContain("قرار المالك D-09");
    expect(entry).toContain("موقوف للمراجعة");
    expect(entry).toContain("بانتظار قرارك");
    expect(entry).toContain("فرق يحتاج تسوية");
    expect(entry).toContain("البيانات غير مكتملة");
    expect(entry).toContain("عقد 05 §8.1");
  });
});

describe("REM-006 — حدود التنفيذ: لا مخطط ولا تصدير ولا ترحيل لأجل الصياغة", () => {
  it("the version pair stays 38/30 (D-03/D-09 applied documentation-first)", () => {
    expect(localSchemaVersion).toBe(38);
    expect(localExportVersion).toBe(30);
  });
});
