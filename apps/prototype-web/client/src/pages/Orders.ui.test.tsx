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

const wouterMocks = { navigate: vi.fn(), search: "" };

vi.mock("wouter", () => ({
  useSearch: () => wouterMocks.search,
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
    wouterMocks.search = "";
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

  it("S13-R5-F01: حالة التحميل معلنة — لا فراغ صامت", async () => {
    mockedUsePrototypeServices.mockReturnValue({
      dailyFollowUp: {
        read: () => new Promise<never>(() => undefined),
      },
      dataVersion: 0,
    } as unknown as ReturnType<typeof usePrototypeServices>);
    mockedGetStore.mockReturnValue(makeStore([]) as never);
    render(<Orders />);
    expect(screen.getByRole("status").textContent).toContain("جارٍ تحميل الطلبات");
  });

  it("S13-R5-F01: الفراغ الصادق الكامل — لا طلبات ولا مسودات مع مدخل البدء", async () => {
    mockServices([], []);
    render(<Orders />);
    expect(await screen.findByRole("heading", { name: "لا طلبات بعد — ابدأ أول طلب" })).toBeTruthy();
    expect(screen.getByText(/«طلب جديد» يفتح مسودة الطلب مباشرة/)).toBeTruthy();
    /* زرا الطلب جديد (الترويسة والفراغ) معًا — مدخل البدء ظاهر دائمًا. */
    expect((await screen.findAllByRole("button", { name: /طلب جديد/ })).length).toBeGreaterThanOrEqual(2);
  });

  it("S13-R5-F01: بحث بلا نتائج في الحالية — تلميح الانتقال للسابق يحفظ البحث", async () => {
    mockServices([savedOrder("order-past", { status: "delivered", customer: "ليان" })], []);
    render(<Orders />);
    /* الحالية فارغة والسابق فيه طلب — مدخل السابق ظاهر. */
    const pastEntry = await screen.findByText(/الطلبات السابقة/);
    expect(pastEntry.closest("button")?.textContent).toContain("1");
    /* بحث لا يطابق شيئًا في الحالية الفارغة — التلميح يقترح السابق. */
    fireEvent.change(screen.getByLabelText("ابحث في الطلبات"), { target: { value: "ليان" } });
    const hint = await screen.findByRole("button", { name: /ابحث في الطلبات السابقة/ });
    fireEvent.click(hint);
    /* النطاق تحول للسابق والبحث باقٍ — الطلب ظهر. */
    expect(await screen.findByText("طلب order-past")).toBeTruthy();
  });

  it("S13-R5-F01: يوم تقويم بلا مواعيد — الفراغ الصادق لا ينفي وجود الطلبات", async () => {
    const orders = [savedOrder("order-cal", { deliveryDate: "2026-11-20" })];
    mockedUsePrototypeServices.mockReturnValue({
      dailyFollowUp: {
        read: vi.fn().mockResolvedValue({ ok: true, followUp: null, drafts: [], orders }),
      },
      dataVersion: 0,
    } as unknown as ReturnType<typeof usePrototypeServices>);
    mockedGetStore.mockReturnValue(
      makeStore(orders, [{ id: "s-cal", orderId: "order-cal", date: "2026-11-20" }]) as never,
    );
    render(<Orders />);
    await screen.findByText("طلب order-cal");
    fireEvent.click(screen.getByRole("radio", { name: /التقويم/ }));
    await screen.findByRole("grid");
    /* اختر أول يوم في الشبكة (رأس الشهر بلا مواعيد) — الفراغ الصادق مع
     * بقاء مدخل بلا موعد. */
    fireEvent.click(screen.getAllByRole("gridcell")[0]!);
    await screen.findByText("لا مواعيد في هذا اليوم — لا يعني خلو المشروع من الطلبات.");
    expect(screen.getByText(/طلبات بلا موعد/)).toBeTruthy();
  });

  it("S13-R5-F02 (ACD032): سياق العرض يُكتب في الوصل ويُستعاد منه — التقويم والنطاق", async () => {
    mockServices([savedOrder("order-a"), savedOrder("order-past", { status: "delivered" })], []);
    render(<Orders />);
    await screen.findByText("طلب order-a");
    /* التبديل للتقويم يكتب السياق في الوصل (replace). */
    fireEvent.click(screen.getByRole("radio", { name: /التقويم/ }));
    await screen.findByRole("grid");
    await waitFor(() =>
      expect(wouterMocks.navigate).toHaveBeenCalledWith("/orders?listing=calendar", { replace: true }),
    );
    /* الفتح من وصل يحمل السياق يعيد النطاق نفسه في القائمة (ACD032). */
    wouterMocks.search = "?scope=past";
    cleanup();
    render(<Orders />);
    await screen.findByText("طلب order-past");
    expect(screen.queryByText("طلب order-a")).toBeNull();
    /* ووصل التقويم يعيد عرض التقويم نفسه. */
    wouterMocks.search = "?listing=calendar";
    cleanup();
    render(<Orders />);
    await screen.findByRole("grid");
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
    /* لا مسار كتابة في الصفحة أصلًا — التنقل الوحيد هو كتابة سياق العرض في
     * الوصل (ACD032: replace بلا تكديس تاريخ)، لا كتابة تخزين ولا فتح صف:
     * كل الاستدعاءات بـ replace:true على وصل الطلبات نفسه. */
    const calls = wouterMocks.navigate.mock.calls as unknown as Array<[string, { replace?: boolean }]>;
    expect(calls.length).toBeGreaterThan(0);
    for (const [href, options] of calls) {
      expect(href.startsWith("/orders")).toBe(true);
      expect(options?.replace).toBe(true);
    }
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
    /* التصفية «له موعد معلن» تستبعد الفاسد — المعلن صالح فقط. */
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
