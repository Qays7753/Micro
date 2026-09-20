/** @vitest-environment jsdom */

/* Stage 2 — OPS-008 (عقد ١٦): بطاقة «وقت التنفيذ المحلي» — حالات المعرفة الصادقة:
 * الفعلي الغائب «غير مسجل» لا صفر؛ الفرق «غير متاح» عند نقص أي طرف؛ وسبب
 * needs_review من مصدره الصادق (الوقت المخطط تقديري/غير معروف) لا «الفرق كبير»
 * المصنوع الذي لا يحسبه الدومين أبدًا. العرض صرف فوق خدمة حقيقية فوق
 * MemoryLocalStore — بلا أي كتابة مالية. */
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActualTimePanel } from "@/components/presentation/ActualTimePanel";
import { ActualTimeService } from "@/application/time/actualTimeService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { calculateCostSnapshot, createCraftOrder } from "@micro-domain/craft-order/index.js";

type SeedTime = { minutes: number | null; hourlyRateMinor: number; confidence: "known" | "estimated" } | null;

async function seedPanel(time: SeedTime) {
  const store = new MemoryLocalStore();
  const cost = calculateCostSnapshot("ops8-dom-cost", {
    currency: "JOD",
    materialItems: [],
    time,
    packagingMinor: 0,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 1,
    createdAt: "2026-08-23T09:00:00.000Z",
    source: "draft",
    freshnessDays: null,
  });
  const order = createCraftOrder({
    id: "ops8-dom-order",
    customerName: "سارة",
    itemName: "طرحة",
    specifications: "اختبار DOM",
    quantity: 1,
    agreedPriceMinor: 3000,
    costSnapshot: cost,
    createdAt: "2026-08-23T09:00:00.000Z",
  });
  await store.saveOrder({
    id: order.id,
    order,
    catalogItemId: null,
    deliveryDate: "2026-09-01",
    agreementSource: null,
    createdAt: "2026-08-23T09:00:00.000Z",
    updatedAt: "2026-08-23T09:00:00.000Z",
  });
  const service = new ActualTimeService(store, () => "2026-08-23T10:00:00.000Z");
  return { store, service, orderId: order.id };
}

function renderPanel(orderId: string, service: ActualTimeService) {
  return render(
    <ActualTimePanel
      orderId={orderId}
      actualTime={service}
      dataVersion={0}
      notifyDataChanged={() => undefined}
    />,
  );
}

afterEach(() => {
  document.body.replaceChildren();
  vi.clearAllMocks();
});

describe("Stage 2 — OPS-008: بطاقة الوقت الفعلي تعرض حالات المعرفة بصدق", () => {
  it("not_recorded مع مخطط معروف: «لا يوجد وقت فعلي مسجل» والفعلي «غير مسجل» لا صفر", async () => {
    const { service, orderId } = await seedPanel({ minutes: 60, hourlyRateMinor: 500, confidence: "known" });
    renderPanel(orderId, service);
    expect(await screen.findByText("لا يوجد وقت فعلي مسجل")).toBeTruthy();
    expect(await screen.findByText("غير مسجل")).toBeTruthy();
    expect(/(^|[^0-9])0 دقيقة/.test(document.body.textContent ?? "")).toBe(false);
    expect(screen.getByText("غير متاح")).toBeTruthy();
  });

  it("not_recorded مع مخطط غائب: المخطط «غير متاح» والفرق «غير متاح»", async () => {
    const { service, orderId } = await seedPanel(null);
    renderPanel(orderId, service);
    expect(await screen.findByText("لا يوجد وقت فعلي مسجل")).toBeTruthy();
    const plannedCells = await screen.findAllByText("غير متاح");
    expect(plannedCells.length).toBeGreaterThanOrEqual(2);
    expect(/(^|[^0-9])0 دقيقة/.test(document.body.textContent ?? "")).toBe(false);
  });

  it("recorded: الفرق الظاهر بخطه الصادق وإعلان أثر القراءة فقط", async () => {
    const { service, orderId } = await seedPanel({ minutes: 60, hourlyRateMinor: 500, confidence: "known" });
    await service.record({
      orderId,
      minutes: 75,
      recordedOn: "2026-08-23",
      note: "تنفيذ",
      operationKey: "ops8-dom-record",
    });
    renderPanel(orderId, service);
    expect((await screen.findAllByText("فرق وقت مسجل")).length).toBeGreaterThanOrEqual(1);
    expect((await screen.findAllByText("+75 دقيقة")).length).toBeGreaterThanOrEqual(1);
    expect(await screen.findByText("+15 دقيقة")).toBeTruthy();
    expect(screen.getByText("الفرق معلن للقراءة فقط ولا يغيّر النتيجة المالية.")).toBeTruthy();
  });

  it("needs_review بمخطط تقديري: السبب الصادق من مصدره — لا «الفرق كبير» المصنوع", async () => {
    const { service, orderId } = await seedPanel({
      minutes: 60,
      hourlyRateMinor: 500,
      confidence: "estimated",
    });
    await service.record({
      orderId,
      minutes: 75,
      recordedOn: "2026-08-23",
      note: "تنفيذ",
      operationKey: "ops8-dom-record-est",
    });
    renderPanel(orderId, service);
    expect(await screen.findByText("فرق الوقت يحتاج مراجعة")).toBeTruthy();
    expect(
      screen.getByText("سبب المراجعة: الوقت المخطط في لقطة التكلفة تقديري أو غير معروف بالكامل."),
    ).toBeTruthy();
    expect(document.body.textContent).not.toContain("الفرق كبير");
  });

  it("needs_review بمخطط صفري: المخطط «غير متاح» والفرق «غير متاح» لا صفر واثق", async () => {
    const { service, orderId } = await seedPanel({ minutes: 0, hourlyRateMinor: 500, confidence: "known" });
    await service.record({
      orderId,
      minutes: 45,
      recordedOn: "2026-08-23",
      note: "تنفيذ",
      operationKey: "ops8-dom-record-zero",
    });
    renderPanel(orderId, service);
    expect(await screen.findByText("فرق الوقت يحتاج مراجعة")).toBeTruthy();
    expect((await screen.findAllByText("+45 دقيقة")).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("غير متاح").length).toBeGreaterThanOrEqual(2);
    expect(/(^|[^0-9])0 دقيقة/.test(document.body.textContent ?? "")).toBe(false);
  });

  it("التراجع الموثق يبقي الأصل ظاهرًا مع سببه وتاريخه", async () => {
    const { service, orderId } = await seedPanel({ minutes: 60, hourlyRateMinor: 500, confidence: "known" });
    const record = await service.record({
      orderId,
      minutes: 75,
      recordedOn: "2026-08-23",
      note: "تنفيذ أولي",
      operationKey: "ops8-dom-record-rev",
    });
    if (!record.ok) throw new Error("record should save");
    await service.reverse({
      targetId: record.value.id,
      recordedOn: "2026-08-24",
      reason: "خطأ في التسجيل",
      operationKey: "ops8-dom-reverse",
    });
    renderPanel(orderId, service);
    /* حاشية التراجع نصها مقسوم بين عناصر — نطابق على نص الجسم الكامل. */
    await screen.findByText("تم التراجع", { exact: true });
    expect(document.body.textContent).toContain("بسبب:");
    expect(document.body.textContent).toContain("خطأ في التسجيل");
    /* الأصل لا يُحذف — السجل المعكوس يبقى ظاهرًا مع تاريخه. */
    expect(document.body.textContent).toMatch(/23\/08\/2026|2026-08-23/);
  });
});
