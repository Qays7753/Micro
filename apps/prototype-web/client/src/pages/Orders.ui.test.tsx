/** @vitest-environment jsdom */
/**
 * S13 (DOC-022 / UNIT-006 — أمر 2158b0fc §6): وجهة «الطلبات» — قائمة
 * افتراضية وتقويم بديل من المصادر نفسها: لا بيع مباشر هنا (ORD-D01)،
 * والمسودة غير المرتبطة تظهر مرة، والبحث والتصفية على المجتمع المقروء،
 * والسابق بمدخل واضح حتى في فراغ الحالية، والتقويم شهر/أسبوع/يوم بقائمة
 * يوم و«طلبات بلا موعد» وطلبًا جديدًا يحمل اليوم المختار اقتراحًا (CAL-C)
 * — وكل التفاعلات عرض لا كتابة (SDF-013).
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices, getPrototypeLocalStore } from "@/app/PrototypeServicesContext";
import Orders from "@/pages/Orders";
import { createScheduleReadsHarness } from "@/application/scheduling/scheduleReadsTestHarness";
import type { OrderDraft, StoredCraftOrder } from "@/storage/local/types";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
  getPrototypeLocalStore: vi.fn(),
}));

const wouterMocks = { navigate: vi.fn() };

vi.mock("wouter", () => ({
  useSearch: () => "",
  useLocation: () => ["/orders", wouterMocks.navigate],
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const mockedGetStore = vi.mocked(getPrototypeLocalStore);

function savedOrder(
  id: string,
  options: { status?: string; deliveryDate?: string | null; customer?: string } = {},
): StoredCraftOrder {
  return {
    id,
    catalogItemId: null,
    deliveryDate: options.deliveryDate === undefined ? "2026-11-20" : options.deliveryDate,
    agreementSource: null,
    followUpSummary: null,
    followUpDate: null,
    followUpReason: null,
    followUpEvents: [],
    createdAt: "2026-08-29T08:00:00.000Z",
    updatedAt: "2026-08-29T08:00:00.000Z",
    order: {
      id,
      itemName: `طلب ${id}`,
      customerName: options.customer ?? "عميل اختبار",
      specifications: "مواصفة اختبار",
      quantity: 1,
      agreedPriceMinor: 10000,
      status: (options.status ?? "provisional_agreement") as never,
      settlementStatus: "unpaid",
      receivableMinor: 10000,
      collectedMinor: 0,
      nextAction: "راجع السعر",
    },
  } as unknown as StoredCraftOrder;
}

function unlinkedDraft(id: string): OrderDraft {
  return {
    id,
    intent: "customer_order",
    customerName: "",
    itemName: "مسودة اختبار",
    specifications: "",
    quantity: 1,
    catalogItemId: null,
    costSnapshots: [],
    activeCostSnapshotId: null,
    linkedOrderId: null,
    createdAt: "2026-08-28T08:00:00.000Z",
    updatedAt: "2026-08-28T08:00:00.000Z",
  } as unknown as OrderDraft;
}

function makeStore(
  orders: readonly StoredCraftOrder[],
  schedules: Array<{ id: string; orderId: string; date: string }> = [],
) {
  /* الصفحات لا تستورد طبقة التخزين (حدود المجموعة ٦) — العدة التطبيقية تبني المخزن. */
  const store = createScheduleReadsHarness().store;
  for (const order of orders) void store.saveOrder(order);
  for (const schedule of schedules)
    void store.saveSchedule({
      id: schedule.id,
      orderId: schedule.orderId,
      kind: "delivery",
      scheduledFor: schedule.date,
      scheduledTime: null,
      durationMinutes: null,
      status: "scheduled",
      postponeReason: null,
      events: [],
      recurrenceId: null,
      recurrenceIndex: null,
      createdAt: "2026-08-29T08:00:00.000Z",
      updatedAt: "2026-08-29T08:00:00.000Z",
    } as never);
  return store;
}

function mockServices(orders: readonly StoredCraftOrder[], drafts: readonly OrderDraft[] = []) {
  mockedUsePrototypeServices.mockReturnValue({
    dailyFollowUp: {
      read: vi.fn().mockResolvedValue({ ok: true, followUp: null, drafts, orders }),
    },
    dataVersion: 0,
  } as unknown as ReturnType<typeof usePrototypeServices>);
  mockedGetStore.mockReturnValue(makeStore(orders) as never);
}

describe("S13 — وجهة الطلبات (UNIT-006)", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    wouterMocks.navigate.mockReset();
  });

  it("القائمة الافتراضية: عنوان الطلبات وزر طلب جديد — ولا قسم بيع مباشر هنا (ORD-D01)", async () => {
    mockServices([savedOrder("order-1")], []);
    render(<Orders />);
    await screen.findByRole("heading", { name: "الطلبات" });
    expect(screen.getByRole("button", { name: /طلب جديد/ })).toBeTruthy();
    /* البيع المباشر عند المالية — لا قائمة مبيعات داخل وجهة الطلبات. */
    expect(screen.queryByText("مبيعاتي")).toBeNull();
    expect(screen.getByText("طلب order-1")).toBeTruthy();
  });

  it("المسودة غير المرتبطة تظهر مرة بوصف مسودة — ومدخلها محررها", async () => {
    mockServices([savedOrder("order-1")], [unlinkedDraft("draft-1")]);
    render(<Orders />);
    await screen.findByText("مسودة اختبار");
    expect(screen.getAllByText(/مسودة اختبار/)).toHaveLength(1);
    fireEvent.click(screen.getByText("مسودة اختبار"));
    expect(wouterMocks.navigate).toHaveBeenCalledWith(expect.stringContaining("/orders/draft/draft-1"));
  });

  it("السابق بمدخل واضح حتى مع وجود حالية — والفراغ الصادق لا ينفي السابق", async () => {
    mockServices([savedOrder("order-past", { status: "delivered" })], []);
    render(<Orders />);
    await screen.findByText(/الطلبات السابقة/);
    /* الحالية فارغة: الفراغ يقال بصدق مع مدخل السابق ظاهرًا. */
    expect(screen.getByText(/لا طلبات حالية/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /الطلبات السابقة/ }));
    await screen.findByText("طلب order-past");
  });

  it("SDF-061: استجابة الجيل القديم تُهمل — لا خلط بين أجيال القراءة", async () => {
    /* قراءة المتابعة اليومية مضبوطة يدويًا: الأولى (القديمة) تبقى معلقة
     * بينما تكتمل الثانية (الأحدث) قبلها ثم تُفتح الأولى متأخرة. */
    const staleRead = new Promise<{
      ok: true;
      followUp: null;
      drafts: [];
      orders: readonly StoredCraftOrder[];
    }>(resolve => {
      releaseStale = () =>
        resolve({ ok: true, followUp: null, drafts: [], orders: [savedOrder("order-stale")] });
    });
    let releaseStale: () => void = () => undefined;
    let dataVersion = 0;
    const readCalls: Array<unknown> = [];
    /* هوية الخدمة ثابتة عبر الرسم — dataVersion وحده يتغير عبر getter —
     * فلا تتغير اعتماديات الأثر إلا بالجيل، لا بكل رسم (وإلا دارت حلقة). */
    const stableServices = {
      dailyFollowUp: {
        read: () => {
          readCalls.push(null);
          /* النداء الأول (الجيل القديم) يعلق؛ الثاني (الأحدث) يكتمل فورًا. */
          if (readCalls.length === 1) return staleRead;
          return Promise.resolve({
            ok: true,
            followUp: null,
            drafts: [],
            orders: [savedOrder("order-stale"), savedOrder("order-fresh")],
          });
        },
      },
      get dataVersion() {
        return dataVersion;
      },
    };
    mockedUsePrototypeServices.mockImplementation(
      () => stableServices as unknown as ReturnType<typeof usePrototypeServices>,
    );
    mockedGetStore.mockReturnValue(makeStore([]) as never);
    const view = render(<Orders />);
    await waitFor(() => expect(readCalls.length).toBe(1));
    dataVersion = 1;
    view.rerender(<Orders />);
    /* الجيل الأحدث يكتمل أولًا ويُعرض: الطلبان معًا. */
    await screen.findByText("طلب order-fresh");
    expect(screen.getByText("طلب order-stale")).toBeTruthy();
    expect(await screen.findByText(/2 طلبًا مقروءًا/)).toBeTruthy();
    /* الجيل القديم يُفتح الآن متأخرة — استجابته تُهمل ولا تستبدل الأحدث. */
    releaseStale();
    await waitFor(() => expect(screen.getByText("طلب order-fresh")).toBeTruthy());
    expect(screen.getByText(/2 طلبًا مقروءًا/)).toBeTruthy();
    expect(screen.queryByText(/1 طلبًا مقروءًا/)).toBeNull();
  });

  it("البحث يصفّي على النطاق المعلن — ولا يوسع النطاق بصمت", async () => {
    mockServices([savedOrder("order-a"), savedOrder("order-b", { customer: "ليان" })], []);
    render(<Orders />);
    await screen.findByText("طلب order-a");
    fireEvent.change(screen.getByLabelText("ابحث في الطلبات"), { target: { value: "ليان" } });
    await waitFor(() => expect(screen.queryByText("طلب order-a")).toBeNull());
    expect(screen.getByText("طلب order-b")).toBeTruthy();
  });

  it("لوحة التصفية: تطبيق النطاق «بلا موعد» يفلتر قبل العرض — وإعادة الضبط تعلن", async () => {
    mockServices([savedOrder("order-dated"), savedOrder("order-undated", { deliveryDate: null })], []);
    render(<Orders />);
    await screen.findByText("طلب order-dated");
    fireEvent.click(screen.getByRole("button", { name: /تصفية/ }));
    fireEvent.click(screen.getByRole("radio", { name: "بلا موعد" }));
    fireEvent.click(screen.getByRole("button", { name: "تطبيق" }));
    await waitFor(() => expect(screen.queryByText("طلب order-dated")).toBeNull());
    expect(screen.getByText("طلب order-undated")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /تصفية/ }));
    fireEvent.click(screen.getByRole("button", { name: "إعادة ضبط" }));
    await screen.findByText("طلب order-dated");
  });

  it("فتح صف أو تبديل عرض لا يكتب شيئًا — التصفية والعرض قراءة فقط (SDF-013)", async () => {
    mockServices([savedOrder("order-1")], []);
    render(<Orders />);
    await screen.findByText("طلب order-1");
    fireEvent.click(screen.getByRole("radio", { name: /التقويم/ }));
    await screen.findByRole("grid");
    fireEvent.click(screen.getByRole("radio", { name: /قائمة الطلبات/ }));
    await screen.findByText("طلب order-1");
    /* لا مسار كتابة في الصفحة أصلًا — الاستدعاء الوحيد للتنقل فقط. */
    expect(wouterMocks.navigate).not.toHaveBeenCalled();
  });

  it("التقويم: شهر/أسبوع/يوم من المصدر نفسه وقائمة يوم بلا 00:00 ومدخل طلبات بلا موعد", async () => {
    const orders = [
      savedOrder("order-cal", { deliveryDate: "2026-11-20" }),
      savedOrder("order-none", { deliveryDate: null }),
    ];
    mockedUsePrototypeServices.mockReturnValue({
      dailyFollowUp: {
        read: vi.fn().mockResolvedValue({ ok: true, followUp: null, drafts: [], orders }),
      },
      dataVersion: 0,
    } as unknown as ReturnType<typeof usePrototypeServices>);
    const store = makeStore(orders, [{ id: "schedule-cal", orderId: "order-cal", date: "2026-11-20" }]);
    mockedGetStore.mockReturnValue(store as never);
    render(<Orders />);
    await screen.findByText("طلب order-cal");
    fireEvent.click(screen.getByRole("radio", { name: /التقويم/ }));
    await screen.findByRole("grid");
    /* اختيار اليوم يعرض مواعيده — بلا وقت محدد لا 00:00. */
    const day2020 = screen.getByRole("gridcell", { name: /20\/11\/2026/ });
    fireEvent.click(day2020);
    await screen.findByText("طلب order-cal");
    expect(screen.getByText(/دون وقت محدد/)).toBeTruthy();
    /* طلبات بلا موعد مدخل واضح بعدد صادق. */
    expect(screen.getByText("طلبات بلا موعد")).toBeTruthy();
    expect(screen.getByText(/1 طلبًا مؤكدًا لم يُحدد له موعد/)).toBeTruthy();
    /* الأسبوع واليوم بدائل عرض من المجتمع نفسه. */
    fireEvent.click(screen.getByRole("radio", { name: "أسبوع" }));
    await screen.findAllByRole("listitem");
    fireEvent.click(screen.getByRole("radio", { name: "يوم" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "التالي" })).toBeTruthy());
  });

  it("طلب جديد من يوم مختار يحمل الاقتراح ظاهرًا — لا حفظ من الفتح (CAL-C)", async () => {
    const orders = [savedOrder("order-cal", { deliveryDate: "2026-11-20" })];
    mockedUsePrototypeServices.mockReturnValue({
      dailyFollowUp: {
        read: vi.fn().mockResolvedValue({ ok: true, followUp: null, drafts: [], orders }),
      },
      dataVersion: 0,
    } as unknown as ReturnType<typeof usePrototypeServices>);
    mockedGetStore.mockReturnValue(
      makeStore(orders, [{ id: "schedule-cal", orderId: "order-cal", date: "2026-11-20" }]) as never,
    );
    render(<Orders />);
    await screen.findByText("طلب order-cal");
    fireEvent.click(screen.getByRole("radio", { name: /التقويم/ }));
    await screen.findByRole("grid");
    fireEvent.click(screen.getByRole("gridcell", { name: /20\/11\/2026/ }));
    /* زران باسم «طلب جديد» (رأس الصفحة وزر التقويم) — زر التقويم هو حامل
     * الاقتراح؛ كلاهما قراءة، والاقتراح في وصلة زر التقويم وحده. */
    const calendarNewOrder = screen
      .getAllByRole("button", { name: /طلب جديد/ })
      .find(button => button.closest("section[aria-labelledby='calendar-day-title']") !== null);
    expect(calendarNewOrder).toBeTruthy();
    fireEvent.click(calendarNewOrder!);
    expect(wouterMocks.navigate).toHaveBeenCalledWith(expect.stringContaining("propose=2026-11-20"));
  });

  it("S13-R4-F02: الموعد غير الصالح حقيقة معلنة — مدخل خاص في التقويم ولا يدخل «له موعد معلن»", async () => {
    mockServices([
      savedOrder("order-valid", { deliveryDate: "2026-11-20" }),
      savedOrder("order-invalid", { deliveryDate: "2026-13-45" }),
    ]);
    render(<Orders />);
    await screen.findByText("طلب order-valid");
    /* القائمة تعرض الصفين — القيمة الفاسدة لا تُستبدل بتاريخ ولا تخفى. */
    expect(screen.getByText("طلب order-invalid")).toBeTruthy();
    /* التصفية «له موعد معلن» ت排除 الفاسد — المعلن صالح فقط. */
    fireEvent.click(screen.getByRole("button", { name: /تصفية/ }));
    fireEvent.click(screen.getByRole("radio", { name: "له موعد معلن" }));
    fireEvent.click(screen.getByRole("button", { name: "تطبيق" }));
    await waitFor(() => expect(screen.queryByText("طلب order-invalid")).toBeNull());
    expect(screen.getByText("طلب order-valid")).toBeTruthy();
    /* التقويم: مدخل صريح باسم الحقيقة — لا يُخلط بمدخل «بلا موعد». */
    fireEvent.click(screen.getByRole("button", { name: /تصفية/ }));
    fireEvent.click(screen.getByRole("button", { name: /إعادة ضبط/ }));
    fireEvent.click(screen.getByRole("radio", { name: /التقويم/ }));
    await screen.findByText(/طلبات بموعد يحتاج تصحيحًا/);
    expect(screen.getByText(/قيمة موعد غير صالحة/)).toBeTruthy();
  });

  it("فشل القراءة: رسالة المنطقة وإعادة محاولة — لا فراغ شامل كاذب", async () => {
    mockedUsePrototypeServices.mockReturnValue({
      dailyFollowUp: { read: vi.fn().mockResolvedValue({ ok: false, message: "تعذر القراءة." }) },
      dataVersion: 0,
    } as unknown as ReturnType<typeof usePrototypeServices>);
    render(<Orders />);
    await screen.findByRole("heading", { name: "تعذر تحميل الطلبات" });
    expect(screen.getByRole("alert").textContent).toContain("تعذر القراءة.");
    expect(screen.getByRole("button", { name: "إعادة المحاولة" })).toBeTruthy();
  });
});
