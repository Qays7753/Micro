/** @vitest-environment jsdom */
/**
 * S13 (DOC-022 / UNIT-018 — أمر 2158b0fc §6): سطح «المتابعة» الموحدة —
 * المجموعات متأخر/اليوم/قادم/لم يحدد موعدها بعدد صادق، والفعل يفتح صاحبه
 * ولا يكتب من هنا (SDF-013)، وفشل مصدر يعزل نفسه بإعلان باسمه والسليم
 * باقيًا، والدورة غير المؤكدة تذكيرًا موسومًا «مقترحًا» لا دينًا.
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices, getPrototypeLocalStore } from "@/app/PrototypeServicesContext";
import FinanceUpcoming from "@/pages/FinanceUpcoming";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { calculateCostSnapshot, createCraftOrder } from "@micro-domain/craft-order/index.js";
import type { StoredCraftOrder } from "@/storage/local/types";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
  getPrototypeLocalStore: vi.fn(),
}));

const wouterMocks = { navigate: vi.fn(), search: "" };

vi.mock("wouter", () => ({
  useSearch: () => wouterMocks.search,
  useLocation: () => ["/finance/upcoming", wouterMocks.navigate],
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const mockedGetStore = vi.mocked(getPrototypeLocalStore);

const NOW = "2026-11-02T09:00:00.000Z";

function makeStoredOrder(
  id: string,
  options: { status?: string; deliveryDate?: string | null; receivableMinor?: number } = {},
): StoredCraftOrder {
  const cost = calculateCostSnapshot(`${id}-cost`, {
    source: "draft",
    currency: "JOD",
    materialItems: [],
    time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
    packagingMinor: 0,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 1,
    createdAt: NOW,
    freshnessDays: null,
  });
  const order = createCraftOrder({
    id,
    customerName: "سارة",
    itemName: `طلب ${id}`,
    specifications: "اختبار",
    quantity: 1,
    agreedPriceMinor: 2000,
    costSnapshot: cost,
    createdAt: NOW,
  });
  const receivableMinor = options.receivableMinor ?? 0;
  return {
    id,
    order: {
      ...order,
      status: (options.status ?? "in_progress") as never,
      settlementStatus: receivableMinor > 0 ? ("debt" as never) : order.settlementStatus,
      receivableMinor,
    },
    catalogItemId: null,
    deliveryDate: options.deliveryDate ?? null,
    agreementSource: null,
    followUpSummary: null,
    followUpDate: null,
    followUpReason: null,
    followUpEvents: [],
    createdAt: NOW,
    updatedAt: NOW,
  } as unknown as StoredCraftOrder;
}

/** خدمات مصدر حقيقية فوق مخزن حقيقي — القراءة عبر القارئ الحي نفسه. */
async function realStoreServices(
  orders: readonly StoredCraftOrder[],
  schedules: Array<{ id: string; orderId: string; date: string; time?: string | null }> = [],
) {
  const store = new MemoryLocalStore();
  for (const order of orders) void store.saveOrder(order);
  for (const schedule of schedules)
    void store.saveSchedule({
      id: schedule.id,
      orderId: schedule.orderId,
      kind: "delivery",
      scheduledFor: schedule.date,
      scheduledTime: schedule.time ?? null,
      durationMinutes: null,
      status: "scheduled",
      postponeReason: null,
      events: [],
      recurrenceId: null,
      recurrenceIndex: null,
      createdAt: NOW,
      updatedAt: NOW,
    } as never);
  const { CollectionService } = await import("@/application/collections/collectionService");
  const { DueDatesService } = await import("@/application/finance/dueDatesService");
  const { ProjectFinancialService } = await import("@/application/finance/projectFinancialService");
  const { FulfillmentService } = await import("@/application/fulfillment/fulfillmentService");
  const { DirectSaleService } = await import("@/application/direct-sales/directSaleService");
  const projectFinance = new ProjectFinancialService(store, () => NOW);
  const directSales = new DirectSaleService(store, () => NOW);
  const fulfillment = new FulfillmentService(store, () => NOW);
  const collections = new CollectionService(store, fulfillment, directSales, projectFinance);
  const dueDates = new DueDatesService(store, collections, () => NOW);
  return { store, collections, dueDates, projectFinance };
}

async function mockPage(services: Awaited<ReturnType<typeof realStoreServices>>) {
  mockedUsePrototypeServices.mockReturnValue({
    collections: services.collections,
    dueDates: services.dueDates,
    projectFinance: services.projectFinance,
    dataVersion: 0,
  } as unknown as ReturnType<typeof usePrototypeServices>);
  mockedGetStore.mockReturnValue(services.store as never);
}

describe("S13 — سطح المتابعة الموحدة (UNIT-018)", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    wouterMocks.navigate.mockReset();
    wouterMocks.search = "";
  });

  it("المجموعات الأربع بعدد صادق — والفعل يفتح مصدره بلا كتابة (SDF-013)", async () => {
    const services = await realStoreServices(
      [
        makeStoredOrder("order-overdue", { deliveryDate: "2026-11-01" }),
        makeStoredOrder("order-today", { deliveryDate: "2026-11-02" }),
        makeStoredOrder("order-upcoming", { deliveryDate: "2026-11-20" }),
        makeStoredOrder("order-debt", {
          status: "delivered",
          deliveryDate: "2026-10-20",
          receivableMinor: 1000,
        }),
      ],
      [
        { id: "schedule-overdue", orderId: "order-overdue", date: "2026-11-01" },
        { id: "schedule-today", orderId: "order-today", date: "2026-11-02", time: "14:00" },
        { id: "schedule-upcoming", orderId: "order-upcoming", date: "2026-11-20" },
      ],
    );
    await mockPage(services);
    const before = await services.store.readSnapshot();
    render(<FinanceUpcoming />);
    await screen.findByRole("heading", { name: "المتابعة" });
    expect(await screen.findByText("متأخر (1)")).toBeTruthy();
    expect(screen.getByText("اليوم (1)")).toBeTruthy();
    expect(screen.getByText("القادم (1)")).toBeTruthy();
    expect(screen.getByText("لم يُحدد موعدها (1)")).toBeTruthy();
    /* فتح صف التحصيل يفتح مصدره — لا كتابة من العرض أبدًا. */
    const receivableRow = screen.getByText(/تحصيل من عميل — طلب order-debt/);
    fireEvent.click(receivableRow.closest("button")!);
    expect(wouterMocks.navigate).toHaveBeenCalledWith(expect.stringContaining("/orders/order-debt"));
    const after = await services.store.readSnapshot();
    expect(after.ok && JSON.stringify(after.value)).toBe(before.ok ? JSON.stringify(before.value) : "");
  });

  it("بلا موعد لا يسمى متأخرًا — والوقت المعلوم يظهر وبلا وقت لا يصير 00:00", async () => {
    const services = await realStoreServices(
      [
        makeStoredOrder("order-today", { deliveryDate: "2026-11-02" }),
        /* دين بلا تاريخ استحقاق مخزن — «لم يحدد موعدها» لا «متأخر». */
        makeStoredOrder("order-debt", {
          status: "delivered",
          deliveryDate: "2026-10-20",
          receivableMinor: 800,
        }),
      ],
      [{ id: "schedule-today", orderId: "order-today", date: "2026-11-02", time: "14:00" }],
    );
    await mockPage(services);
    render(<FinanceUpcoming />);
    await screen.findByText("اليوم (1)");
    /* الوقت بفترة عربية (٢:٠٠ م) — المعروض عرض فقط والتخزين 24 ساعة. */
    expect(screen.getByText(/2:00 م/)).toBeTruthy();
    expect(screen.queryByText("00:00")).toBeNull();
    /* التحصيل بلا تاريخ مخزن — «لم يحدد موعدها» لا «متأخر». */
    expect(screen.getByText(/لم يحدد موعدها/)).toBeTruthy();
  });

  it("فشل مصدر يعزل نفسه — إعلان باسمه والسليم باقيًا وإعادة المحاولة فعل واعٍ", async () => {
    const services = await realStoreServices(
      [makeStoredOrder("order-today", { deliveryDate: "2026-11-02" })],
      [{ id: "schedule-today", orderId: "order-today", date: "2026-11-02" }],
    );
    /* الخدمة المتعذرة: قراءة الاستحقاقات تفشل وحدها — لا Promise.all ينسف البقية. */
    const failingDueDates = {
      readPayablesAging: vi.fn().mockResolvedValue({ ok: false, message: "قاعدة المورد مقفلة" }),
    };
    mockedUsePrototypeServices.mockReturnValue({
      collections: services.collections,
      dueDates: failingDueDates,
      projectFinance: services.projectFinance,
      dataVersion: 0,
    } as unknown as ReturnType<typeof usePrototypeServices>);
    mockedGetStore.mockReturnValue(services.store as never);
    render(<FinanceUpcoming />);
    await screen.findByRole("heading", { name: "المتابعة" });
    expect(await screen.findByText(/تعذرت قراءة استحقاقات الموردين/)).toBeTruthy();
    expect(screen.getByText("اليوم (1)")).toBeTruthy();
    expect(screen.getByRole("button", { name: /أعد قراءة المتابعة/ })).toBeTruthy();
  });

  it("S13-R5-F01: حالة التحميل معلنة — لا فراغ صامت", async () => {
    const services = await realStoreServices(
      [makeStoredOrder("order-today", { deliveryDate: "2026-11-02" })],
      [],
    );
    /* قراءة معلقة أبدًا — الصفحة في حالة التحميل الصادقة. */
    const parked = new Promise<never>(() => undefined);
    const slowStore = Object.assign(Object.create(Object.getPrototypeOf(services.store)), services.store, {
      listSchedules: () => parked,
    }) as typeof services.store;
    await mockPage({ ...services, store: slowStore });
    render(<FinanceUpcoming />);
    expect(screen.getByRole("status").textContent).toContain("جارٍ تحميل المتابعة");
  });

  it("S13-R5-F01: فشل السطح الكامل معلن مع إعادة محاولة — لا فراغ ناجح كاذب", async () => {
    const services = await realStoreServices(
      [makeStoredOrder("order-today", { deliveryDate: "2026-11-02" })],
      [],
    );
    /* مصدر يرمي (لا يعيد فشلًا) — الوعد الكامل يُرفض فتعلن الصفحة الخطأ
     * الحقيقي للسطح كله، لا فراغًا ناجحًا. */
    mockedUsePrototypeServices.mockReturnValue({
      collections: {
        listReceivableSources: () => Promise.reject(new Error("انقطع الاتصال بالمخزن")),
      },
      dueDates: services.dueDates,
      projectFinance: services.projectFinance,
      dataVersion: 0,
    } as unknown as ReturnType<typeof usePrototypeServices>);
    mockedGetStore.mockReturnValue(services.store as never);
    render(<FinanceUpcoming />);
    expect(await screen.findByRole("heading", { name: "تعذر تحميل المتابعة" })).toBeTruthy();
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("انقطع الاتصال بالمخزن");
    expect(screen.getByRole("button", { name: /إعادة المحاولة/ })).toBeTruthy();
  });

  it("S13-R5-F01: تصفية بلا نتائج — الحالة الفارغة الصادقة مع عدّ جاهز", async () => {
    const services = await realStoreServices(
      [makeStoredOrder("order-today", { deliveryDate: "2026-11-02" })],
      [{ id: "schedule-today", orderId: "order-today", date: "2026-11-02" }],
    );
    await mockPage(services);
    render(<FinanceUpcoming />);
    await screen.findByText("اليوم (1)");
    fireEvent.click(screen.getByRole("button", { name: /تصفية/ }));
    fireEvent.click(screen.getByRole("radio", { name: "تحصيل" }));
    fireEvent.click(screen.getByRole("button", { name: "تطبيق" }));
    await screen.findByRole("heading", { name: "لا مهام متابعة بهذه التصفية" });
    expect(screen.getByText(/عدّل التصفية أو امسحها/)).toBeTruthy();
  });

  it("S13-R5-F02 (ACD032): التصفية المطبقة تُكتب في الوصل — والرجوع يستعيدها منه", async () => {
    const services = await realStoreServices(
      [
        makeStoredOrder("order-today", { deliveryDate: "2026-11-02" }),
        makeStoredOrder("order-debt", {
          status: "delivered",
          deliveryDate: "2026-10-20",
          receivableMinor: 900,
        }),
      ],
      [{ id: "schedule-today", orderId: "order-today", date: "2026-11-02" }],
    );
    await mockPage(services);
    render(<FinanceUpcoming />);
    await screen.findByText("اليوم (1)");
    fireEvent.click(screen.getByRole("button", { name: /تصفية/ }));
    fireEvent.click(screen.getByRole("radio", { name: "تحصيل" }));
    fireEvent.click(screen.getByRole("button", { name: "تطبيق" }));
    /* الوصل يحمل التصفية (replace) — رجوع صف يعيدها. */
    await waitFor(() =>
      expect(wouterMocks.navigate).toHaveBeenCalledWith("/finance/upcoming?kind=receivable", {
        replace: true,
      }),
    );
    /* الوصل يحملها عند الفتح أيضًا — إعادة التحميل بالسياق نفسه (ACD032). */
    wouterMocks.search = "?kind=receivable";
    cleanup();
    render(<FinanceUpcoming />);
    await screen.findByRole("heading", { name: "المتابعة" });
    expect(await screen.findByText(/تحصيل من عميل — طلب order-debt/)).toBeTruthy();
    expect(screen.queryByText(/تسليم طلب/)).toBeNull();
  });

  it("S13-R5-F03: الفترة غير الصالحة تُعلن — لا تعطيل صامت للتطبيق", async () => {
    const services = await realStoreServices(
      [makeStoredOrder("order-today", { deliveryDate: "2026-11-02" })],
      [{ id: "schedule-today", orderId: "order-today", date: "2026-11-02" }],
    );
    await mockPage(services);
    render(<FinanceUpcoming />);
    await screen.findByText("اليوم (1)");
    fireEvent.click(screen.getByRole("button", { name: /تصفية/ }));
    fireEvent.change(screen.getByLabelText("من (YYYY-MM-DD)"), { target: { value: "2026-11-30" } });
    fireEvent.change(screen.getByLabelText("إلى (YYYY-MM-DD)"), { target: { value: "2026-11-01" } });
    fireEvent.click(screen.getByRole("button", { name: "تطبيق" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("الفترة المخصصة غير صالحة");
    /* التصفية السابقة باقية — الرفض لا يطبق شيئًا. */
    expect(screen.getByText("اليوم (1)")).toBeTruthy();
  });

  it("SDF-061: استجابة الجيل القديم تُهمل — لا خلط بين أجيال القراءة", async () => {
    const services = await realStoreServices(
      [makeStoredOrder("order-today", { deliveryDate: "2026-11-02" })],
      [{ id: "schedule-today", orderId: "order-today", date: "2026-11-02" }],
    );
    /* بوابة مواعيد مضبوطة يدويًا: كل قراءة تقف عند بوابتها — الأولى (القديمة)
     * تبقى معلقة بينما تكتمل الثانية (الأحدث) قبلها ثم تُفتح الأولى متأخرة. */
    const gates: Array<() => void> = [];
    const liveListSchedules = services.store.listSchedules.bind(services.store);
    (services.store as unknown as { listSchedules: () => Promise<unknown> }).listSchedules = async () => {
      await new Promise<void>(resolve => gates.push(resolve));
      return liveListSchedules();
    };
    let dataVersion = 0;
    /* هوية الخدمات ثابتة عبر الرسم — dataVersion وحده يتغير عبر getter —
     * فلا تتغير اعتماديات الأثر إلا بالجيل، لا بكل رسم (وإلا دارت حلقة). */
    const stableServices = {
      collections: services.collections,
      dueDates: services.dueDates,
      projectFinance: services.projectFinance,
      get dataVersion() {
        return dataVersion;
      },
    };
    mockedUsePrototypeServices.mockImplementation(
      () => stableServices as unknown as ReturnType<typeof usePrototypeServices>,
    );
    mockedGetStore.mockReturnValue(services.store as never);
    const view = render(<FinanceUpcoming />);
    /* الجيل الأول معلق عند بوابته وقرأ الطلبات قبل الإضافة. */
    await waitFor(() => expect(gates.length).toBe(1));
    await services.store.saveOrder(makeStoredOrder("order-added", { deliveryDate: null }));
    await services.store.saveSchedule({
      id: "schedule-added",
      orderId: "order-added",
      kind: "delivery",
      scheduledFor: "2026-11-02",
      scheduledTime: null,
      durationMinutes: null,
      status: "scheduled",
      postponeReason: null,
      events: [],
      recurrenceId: null,
      recurrenceIndex: null,
      createdAt: NOW,
      updatedAt: NOW,
    } as never);
    dataVersion = 1;
    view.rerender(<FinanceUpcoming />);
    await waitFor(() => expect(gates.length).toBe(2));
    /* الجيل الأحدث يكتمل أولًا ويُعرض: موعدان اليوم. */
    gates[1]!();
    await screen.findByText("اليوم (2)");
    /* الجيل القديم يُفتح الآن متأخرة — استجابته تُهمل ولا تُخلط بالأحدث. */
    gates[0]!();
    await waitFor(() => expect(screen.getByText("اليوم (2)")).toBeTruthy());
    expect(screen.queryByText("اليوم (1)")).toBeNull();
  });

  it("تصفية النوع تعمل على المجتمع كله — وإعادة الضبط تعيد الكل", async () => {
    const services = await realStoreServices(
      [
        makeStoredOrder("order-today", { deliveryDate: "2026-11-02" }),
        makeStoredOrder("order-debt", {
          status: "delivered",
          deliveryDate: "2026-10-20",
          receivableMinor: 1000,
        }),
      ],
      [{ id: "schedule-today", orderId: "order-today", date: "2026-11-02" }],
    );
    await mockPage(services);
    render(<FinanceUpcoming />);
    await screen.findByText("اليوم (1)");
    fireEvent.click(screen.getByRole("button", { name: /تصفية/ }));
    fireEvent.click(screen.getByRole("radio", { name: "تحصيل" }));
    fireEvent.click(screen.getByRole("button", { name: "تطبيق" }));
    await waitFor(() => expect(screen.queryByText("اليوم (1)")).toBeNull());
    expect(screen.getByText("لم يُحدد موعدها (1)")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /تصفية/ }));
    fireEvent.click(screen.getByRole("button", { name: "إعادة ضبط" }));
    await screen.findByText("اليوم (1)");
  });
});
