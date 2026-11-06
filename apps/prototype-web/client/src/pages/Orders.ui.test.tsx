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
    expect(await screen.findByRole("heading", { name: "لا طلبات بعد" })).toBeTruthy();
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
    /* بحث لا يطابق شيئًا في الحالية الفارغة — COPY-15 (UXR-03): «لا
     * نتائج تطابق بحثك» مع «مسح البحث»، ومدخل السابق باقٍ كقدرة. */
    fireEvent.change(screen.getByLabelText("ابحث في الطلبات"), { target: { value: "ليان" } });
    expect(await screen.findByText("لا نتائج تطابق بحثك")).toBeTruthy();
    const pastHint = await screen.findByRole("button", { name: /الطلبات السابقة \(1\)/ });
    fireEvent.click(pastHint);
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
    await screen.findByText("لا مواعيد لهذا اليوم");
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
    expect(await screen.findByText(/الطلبات الحالية · 2/)).toBeTruthy();
    /* الجيل القديم يُفتح الآن متأخرة — استجابته تُهمل ولا تستبدل الأحدث. */
    releaseStale();
    await waitFor(() => expect(screen.getByText("طلب order-fresh")).toBeTruthy());
    expect(screen.getByText(/الطلبات الحالية · 2/)).toBeTruthy();
    expect(screen.queryByText(/الطلبات الحالية · 1/)).toBeNull();
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
    fireEvent.click(screen.getByRole("radio", { name: /القائمة/ }));
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

  it("فشل قراءة الطلبات معلن بإعادة محاولة — التقويم السليم لا يُخفى (S13-MR-001)", async () => {
    mockedUsePrototypeServices.mockReturnValue({
      dailyFollowUp: { read: vi.fn().mockResolvedValue({ ok: false, message: "تعذر القراءة." }) },
      dataVersion: 0,
    } as unknown as ReturnType<typeof usePrototypeServices>);
    mockedGetStore.mockReturnValue(makeStore([]) as never);
    render(<Orders />);
    /* الصفحة تُعرض والفشل معلن باسمه مع إعادة محاولة خاصة به — لا صفحة
     * خطأ شاملة تخفي التقويم السليم (عقد MR-001). */
    await screen.findByRole("heading", { name: "الطلبات" });
    expect((await screen.findByRole("alert")).textContent).toContain("تعذر القراءة.");
    expect(screen.getByRole("button", { name: /أعد قراءة الطلبات/ })).toBeTruthy();
  });

  /* ─── S13-MR-001 (أمر ba2ce7b4 §4): عزل قراءتي القائمة والتقويم ─── */

  it("S13-MR-001: فشل قراءة المواعيد وحدها — القائمة السليمة باقية والتقويم يعلن حقيقته وإعادة المحاولة لمصدره", async () => {
    const orders = [savedOrder("order-healthy")];
    const realStore = makeStore(orders, []);
    const dailyRead = vi.fn().mockResolvedValue({ ok: true, followUp: null, drafts: [], orders });
    const listSchedules = vi.fn().mockRejectedValue(new Error("تعثر قراءة المواعيد المخزنة"));
    const failingSchedulesStore = new Proxy(realStore, {
      get(target, prop: string) {
        if (prop === "listSchedules") return listSchedules;
        const value = Reflect.get(target, prop, target) as unknown;
        return typeof value === "function" ? (value as CallableFunction).bind(target) : value;
      },
    });
    mockedUsePrototypeServices.mockReturnValue({
      dailyFollowUp: { read: dailyRead },
      dataVersion: 0,
    } as unknown as ReturnType<typeof usePrototypeServices>);
    mockedGetStore.mockReturnValue(failingSchedulesStore as never);
    /* عرض التقويم مباشرة — الفشل في وجهته لا في القائمة. */
    wouterMocks.search = "?listing=calendar";
    render(<Orders />);
    /* القائمة السليمة متاحة: تبديل العرض يعمل والفشل معزول في التقويم. */
    await screen.findByRole("alert");
    expect(screen.getByRole("alert").textContent).toContain("تعثر قراءة المواعيد المخزنة");
    expect(screen.getByRole("alert").textContent).toContain("القائمة السليمة متاحة");
    /* إعادة المحاولة تعيد المصدر المتعذر وحده — قراءة الطلبات لم تُستدع ثانية. */
    const readsBefore = dailyRead.mock.calls.length;
    const schedulesReadsBefore = listSchedules.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: /أعد قراءة مواعيد التقويم/ }));
    await waitFor(() => {
      expect(listSchedules.mock.calls.length).toBe(schedulesReadsBefore + 1);
    });
    expect(dailyRead.mock.calls.length).toBe(readsBefore);
    /* التبديل إلى القائمة يظهر الطلب السليم — لا فراغًا مضللًا. */
    fireEvent.click(screen.getByRole("radio", { name: /القائمة/ }));
    await screen.findByText("طلب order-healthy");
  });

  it("S13-MR-001: فشل قراءة الطلبات وحدها — القائمة تعلن حقيقتها والتقويم السليم يعمل", async () => {
    const dailyRead = vi.fn().mockRejectedValue(new Error("تعثر قراءة الطلبات المخزنة"));
    mockedUsePrototypeServices.mockReturnValue({
      dailyFollowUp: { read: dailyRead },
      dataVersion: 0,
    } as unknown as ReturnType<typeof usePrototypeServices>);
    mockedGetStore.mockReturnValue(
      makeStore(
        [savedOrder("order-calendar", { deliveryDate: "2026-11-15" })],
        [{ id: "schedule-15", orderId: "order-calendar", date: "2026-11-15" }],
      ) as never,
    );
    /* عرض التقويم — يعمل من مصدر المواعيد رغم فشل قراءة الطلبات. */
    wouterMocks.search = "?listing=calendar&canchor=2026-11-15&cday=2026-11-15";
    render(<Orders />);
    /* التقويم السليم يعرض موعد يومه — لا صفحة خطأ شاملة. */
    await screen.findByText(/مواعيد 15\/11\/2026/);
    expect(await screen.findByText("طلب order-calendar")).toBeTruthy();
    /* والقائمة تعلن حقيقتها عند التبديل إليها — لا فراغ صامت. */
    fireEvent.click(screen.getByRole("radio", { name: /القائمة/ }));
    await screen.findByRole("alert");
    expect(screen.getByRole("alert").textContent).toContain("تعثر قراءة الطلبات المخزنة");
    expect(screen.getByRole("button", { name: /أعد قراءة الطلبات/ })).toBeTruthy();
  });

  /* ─── S13-MR-004 (أمر ba2ce7b4 §4): الموعد النشط الفاسد ظاهر في التقويم ─── */

  it("S13-MR-004: موعد نشط بقيمة غير صالحة يظهر في مدخل إصلاح مستقل — لا يختفي من التقويم", async () => {
    mockServices([savedOrder("order-bad-schedule", { deliveryDate: "2026-11-15" })], []);
    mockedGetStore.mockReturnValue(
      makeStore(
        [savedOrder("order-bad-schedule", { deliveryDate: "2026-11-15" })],
        [{ id: "schedule-bad", orderId: "order-bad-schedule", date: "2026-13-45" }],
      ) as never,
    );
    wouterMocks.search = "?listing=calendar";
    render(<Orders />);
    const section = await screen.findByLabelText("مواعيد نشطة تحتاج تصحيحًا");
    expect(section.textContent).toContain("طلب order-bad-schedule");
    expect(section.textContent).toContain("2026-13-45");
    /* مدخل الإصلاح يفتح مصدره — الطلب نفسه. */
    fireEvent.click(screen.getByRole("button", { name: /موعد نشط بقيمة غير صالحة/ }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith(expect.stringContaining("/orders/order-bad-schedule"));
  });

  /* ─── S13-MR-006 (أمر ba2ce7b4 §4): دلالات شبكة التقويم الشهري الحقيقية ─── */

  it("S13-MR-006: بنية الشبكة سليمة — صفوف أسابيع ومسار تجوال واحد وإعلان المختار بصدق", async () => {
    mockServices([savedOrder("order-grid", { deliveryDate: "2026-11-15" })], []);
    mockedGetStore.mockReturnValue(
      makeStore(
        [savedOrder("order-grid", { deliveryDate: "2026-11-15" })],
        [{ id: "schedule-grid", orderId: "order-grid", date: "2026-11-15" }],
      ) as never,
    );
    wouterMocks.search = "?listing=calendar&cmode=month&canchor=2026-11-15&cday=2026-11-15";
    render(<Orders />);
    const grid = await screen.findByRole("grid");
    /* صفوف الشبكة: صف الرؤوس + صفوف الأسابيع — لا خلايا يتيمة مباشرة. */
    const rows = grid.querySelectorAll('[role="row"]');
    expect(rows.length).toBeGreaterThanOrEqual(5);
    expect(grid.querySelectorAll('[role="columnheader"]').length).toBe(7);
    const dayButtons = Array.from(grid.querySelectorAll<HTMLButtonElement>('[role="gridcell"]'));
    expect(dayButtons.length).toBe(30);
    /* مسار تجوال واحد — يوم واحد فقط في مسار التاب. */
    const tabbables = dayButtons.filter(button => button.tabIndex === 0);
    expect(tabbables.length).toBe(1);
    /* اليوم المختار معلن اختيارًا (aria-selected) لا ضغطًا. */
    const selected = dayButtons.find(button => button.getAttribute("data-date") === "2026-11-15");
    expect(selected?.getAttribute("aria-selected")).toBe("true");
    expect(selected?.getAttribute("aria-pressed")).toBeNull();
  });

  it("S13-MR-006: الأسهم بلغة RTL — اليسار اليوم التالي واليمين السابق، والصعود/الهبوط أسبوعيًا، وHome/End طرفا الأسبوع", async () => {
    mockServices([savedOrder("order-grid", { deliveryDate: "2026-11-11" })], []);
    mockedGetStore.mockReturnValue(
      makeStore(
        [savedOrder("order-grid", { deliveryDate: "2026-11-11" })],
        [{ id: "schedule-grid", orderId: "order-grid", date: "2026-11-11" }],
      ) as never,
    );
    wouterMocks.search = "?listing=calendar&cmode=month&canchor=2026-11-15&cday=2026-11-11";
    const { container } = render(<Orders />);
    const grid = await screen.findByRole("grid");
    const buttonOf = (date: string) => grid.querySelector<HTMLButtonElement>(`[data-date="${date}"]`)!;
    /* التركيز الأولي على المختار (مسار التاب الوحيد). */
    expect(buttonOf("2026-11-11").tabIndex).toBe(0);
    /* RTL: السهم الأيسر = اليوم التالي. */
    fireEvent.keyDown(grid, { key: "ArrowLeft" });
    await waitFor(() => {
      expect(document.activeElement).toBe(buttonOf("2026-11-12"));
    });
    /* RTL: السهم الأيمن = اليوم السابق (من 12 إلى 11). */
    fireEvent.keyDown(grid, { key: "ArrowRight" });
    await waitFor(() => {
      expect(document.activeElement).toBe(buttonOf("2026-11-11"));
    });
    /* الصعود أسبوعًا (−7) والهبوط أسبوعًا (+7). */
    fireEvent.keyDown(grid, { key: "ArrowDown" });
    await waitFor(() => {
      expect(document.activeElement).toBe(buttonOf("2026-11-18"));
    });
    fireEvent.keyDown(grid, { key: "ArrowUp" });
    await waitFor(() => {
      expect(document.activeElement).toBe(buttonOf("2026-11-11"));
    });
    /* Home/End: طَرَفا الأسبوع (الأحد..السبت) — 2026-11-11 أربعاء. */
    fireEvent.keyDown(grid, { key: "Home" });
    await waitFor(() => {
      expect(document.activeElement).toBe(buttonOf("2026-11-08"));
    });
    fireEvent.keyDown(grid, { key: "End" });
    await waitFor(() => {
      expect(document.activeElement).toBe(buttonOf("2026-11-14"));
    });
    /* مسار التاب الوحيد انتقل مع التركيز — لا مساران. */
    const tabbables = Array.from(grid.querySelectorAll<HTMLButtonElement>('[role="gridcell"]')).filter(
      button => button.tabIndex === 0,
    );
    expect(tabbables.length).toBe(1);
    expect(tabbables[0]).toBe(buttonOf("2026-11-14"));
    expect(container).toBeTruthy();
  });

  it("S13-MR-006: عبور حد الشهر ينقل الشهر والتركيز معًا — والانتقال بين شهر/أسبوع/يوم يحفظ العمل", async () => {
    mockServices([savedOrder("order-boundary", { deliveryDate: "2026-11-30" })], []);
    mockedGetStore.mockReturnValue(
      makeStore(
        [savedOrder("order-boundary", { deliveryDate: "2026-11-30" })],
        [{ id: "schedule-boundary", orderId: "order-boundary", date: "2026-11-30" }],
      ) as never,
    );
    wouterMocks.search = "?listing=calendar&cmode=month&canchor=2026-11-15&cday=2026-11-30";
    render(<Orders />);
    const grid = await screen.findByRole("grid");
    const buttonOf = (date: string) => grid.querySelector<HTMLButtonElement>(`[data-date="${date}"]`)!;
    expect(buttonOf("2026-11-30").tabIndex).toBe(0);
    /* RTL: السهم الأيسر من آخر يوم في الشهر = أول يوم في الشهر التالي. */
    fireEvent.keyDown(grid, { key: "ArrowLeft" });
    await waitFor(() => {
      expect(screen.getByText("12/2026")).toBeTruthy();
    });
    /* التركيز انتقل إلى اليوم الأول من ديسمبر في الشبكة الجديدة. */
    const decemberGrid = screen.getByRole("grid");
    const decemberFirst = decemberGrid.querySelector<HTMLButtonElement>('[data-date="2026-12-01"]');
    await waitFor(() => {
      expect(document.activeElement).toBe(decemberFirst);
    });
    /* الانتقال إلى الأسبوع ثم اليوم — العرض يعمل والموعد ظاهر. */
    fireEvent.click(screen.getByRole("radio", { name: "أسبوع" }));
    await screen.findByRole("list");
    fireEvent.click(screen.getByRole("radio", { name: "يوم" }));
    /* وضع اليوم يعرض اليوم المختار (لم يتغير بالأسهم — الأسهم تحرك التركيز) */
    expect(await screen.findByText(/مواعيد 30\/11\/2026/)).toBeTruthy();
  });
});
