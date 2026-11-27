/** @vitest-environment jsdom */

/*
 * M5.3 (UX P-20 «متتبّع الطلبات» + الكونسبت §11): الحالات الحرفية —
 * الافتراضي تقويم وذكر آخر وضع، شريط الأسبوع من الأحد (R-5) بعنوان الشهر
 * بصيغة R-21 مع منتقي التاريخ، زر «اليوم» بشرطه، النقطة تحت الأيام ذات
 * الطلبات، الملغى يبقى ظاهرًا بتاريخ تسليمه المخطط، المسلَّم بتاريخه الفعلي،
 * المخفي والمضاف لاحقًا خارجها، وضع القائمة (المتأخرة أولًا ثم التواريخ
 * تصاعديًا بلا تكرار)، والفراغات الحرفية.
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TrackerPage from "@/pages/manage/TrackerPage";
import { MANAGE_STRINGS_AR } from "@/application/manage/strings";
import * as api from "@/application/manage/api";
import type { SaleRow } from "@/application/manage/api";

const navigate = vi.fn();
let search = "";
vi.mock("wouter", () => ({
  useLocation: () => ["/manage/tracker", navigate],
  useSearch: () => search,
}));
vi.mock("@/application/time", () => ({
  todayInAmman: () => "2026-11-29",
}));

vi.mock("@/application/manage/api", async importOriginal => {
  const actual = await importOriginal<typeof import("@/application/manage/api")>();
  return {
    ...actual,
    fetchManageSaleRows: vi.fn(),
  };
});

const rowsApi = vi.mocked(api.fetchManageSaleRows);

function saleRow(overrides: Partial<SaleRow> = {}): SaleRow {
  return {
    id: "s1",
    status: "scheduled",
    customerName: "أبو أحمد",
    firstLineDescription: "مقلوبة",
    plannedDeliveryOn: "2026-11-29",
    deliveredOn: null,
    tracked: true,
    hiddenFromTracker: false,
    paidFils: 10_000,
    ofFils: 36_000,
    fullAmountFils: 26_000,
    ...overrides,
  };
}

beforeEach(() => {
  search = "";
  vi.clearAllMocks();
});
afterEach(() => cleanup());

describe("M5.3 — P-20 المتتبّع: التقويم", () => {
  it("يفتح على التقويم افتراضيًا: عنوان الشهر R-21 وشريط الأسبوع من الأحد وزر «اليوم» مخفي عند اكتماله", async () => {
    rowsApi.mockResolvedValue({ sales: [] });
    render(<TrackerPage />);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["e.empty_orders_day"])).toBeTruthy());
    /* عنوان الشهر بصيغة R-21 — 29/11/2026 أحد (اليوم) فالأسبوع كله 11/2026. */
    expect(screen.getByText("11/2026")).toBeTruthy();
    /* الأسبوع يبدأ بالأحد 2026-11-29 (اليوم أحد) — اليوم الأول 29. */
    expect(screen.getByText("29")).toBeTruthy();
    /* اليوم ظاهر ومختار: زر «اليوم» لا يظهر (شرط ظهوره). */
    expect(screen.queryByText(MANAGE_STRINGS_AR["a.today"])).toBeNull();
  });

  it("زر «اليوم» يظهر عند اختيار يوم آخر ويعيد إليه", async () => {
    rowsApi.mockResolvedValue({ sales: [] });
    render(<TrackerPage />);
    await waitFor(() => expect(screen.getByText("11/2026")).toBeTruthy());
    /* سهم الأسبوع التالي: اليوم لم يعد ظاهرًا — الزر يظهر. */
    fireEvent.click(screen.getByLabelText(MANAGE_STRINGS_AR["a.next"]));
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["a.today"])).toBeTruthy());
    fireEvent.click(screen.getByText(MANAGE_STRINGS_AR["a.today"]));
    await waitFor(() => expect(screen.queryByText(MANAGE_STRINGS_AR["a.today"])).toBeNull());
    expect(screen.getByText("11/2026")).toBeTruthy();
  });

  it("نقطة تحت كل يوم ذي طلبات؛ طلبات اليوم المختار صفوف C-09", async () => {
    rowsApi.mockResolvedValue({
      sales: [saleRow(), saleRow({ id: "s2", customerName: "سلمى", plannedDeliveryOn: "2026-11-30" })],
    });
    render(<TrackerPage />);
    await waitFor(() => expect(screen.getByText("أبو أحمد")).toBeTruthy());
    /* يومان بطلبات: نقطتان — تحت 29 و30. */
    const dots = document.querySelectorAll(".micro-manage-week__dot");
    expect(dots).toHaveLength(2);
    expect(screen.getByText("مقلوبة")).toBeTruthy();
    expect(screen.queryByText("سلمى")).toBeNull();
    /* كبسة يوم الغد (30): تظهر طلباته. */
    fireEvent.click(screen.getByText("30"));
    await waitFor(() => expect(screen.getByText("سلمى")).toBeTruthy());
    expect(screen.queryByText("أبو أحمد")).toBeNull();
  });

  it("الملغى يبقى ظاهرًا بتاريخ تسليمه المخطط (§11: لا حذف تلقائي)؛ المخفي خارج القائمة", async () => {
    rowsApi.mockResolvedValue({
      sales: [
        saleRow({ id: "s-cancel", status: "cancelled", customerName: "ملغى عميل" }),
        saleRow({ id: "s-hidden", hiddenFromTracker: true, customerName: "مخفي عميل" }),
        saleRow({ id: "s-untracked", tracked: false, customerName: "غير متتبع" }),
      ],
    });
    render(<TrackerPage />);
    await waitFor(() => expect(screen.getByText("ملغى عميل")).toBeTruthy());
    expect(screen.queryByText("مخفي عميل")).toBeNull();
    expect(screen.queryByText("غير متتبع")).toBeNull();
  });

  it("المسلَّم يعرض بتاريخ تسليمه الفعلي لا المخطط", async () => {
    rowsApi.mockResolvedValue({
      sales: [
        saleRow({
          id: "s-delivered",
          status: "completed",
          customerName: "مسلَّم عميل",
          plannedDeliveryOn: "2026-11-25",
          deliveredOn: "2026-11-29",
        }),
      ],
    });
    render(<TrackerPage />);
    /* اليوم المختار 29 (تاريخ التسليم الفعلي) — الطلب تحته لا تحت 25. */
    await waitFor(() => expect(screen.getByText("مسلَّم عميل")).toBeTruthy());
    expect(document.querySelectorAll(".micro-manage-week__dot")).toHaveLength(1);
  });

  it("معامل ?day= يفتح التقويم على يومه (وصول «عرض الكل» من P-10)", async () => {
    search = "?day=2026-12-02";
    rowsApi.mockResolvedValue({
      sales: [saleRow({ id: "s-far", plannedDeliveryOn: "2026-12-02", customerName: "بعيد عميل" })],
    });
    render(<TrackerPage />);
    await waitFor(() => expect(screen.getByText("12/2026")).toBeTruthy());
    await waitFor(() => expect(screen.getByText("بعيد عميل")).toBeTruthy());
  });
});

describe("M5.3 — P-20 المتتبّع: القائمة والوضع", () => {
  it("يذكر آخر اختيار (قائمة) ويفتح على المتأخرة أولًا ثم التواريخ تصاعديًا بلا تكرار", async () => {
    search = "?mode=list";
    rowsApi.mockResolvedValue({
      sales: [
        saleRow({
          id: "s-late",
          status: "overdue",
          plannedDeliveryOn: "2026-11-20",
          customerName: "متأخر عميل",
        }),
        saleRow({ id: "s-today", customerName: "اليوم عميل" }),
        saleRow({ id: "s-tomorrow", plannedDeliveryOn: "2026-11-30", customerName: "الغد عميل" }),
      ],
    });
    const { unmount } = render(<TrackerPage />);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["s.overdue_orders"])).toBeTruthy());
    /* المتأخرة مجموعة أولى مثبتة. */
    expect(screen.getByText("متأخر عميل")).toBeTruthy();
    /* مجموعات التواريخ بعدها: اليوم ثم الغد (تصاعديًا). */
    const groups = [...document.querySelectorAll(".micro-manage-section__title")].map(
      node => node.textContent,
    );
    expect(groups[0]).toBe(MANAGE_STRINGS_AR["s.overdue_orders"]);
    expect(groups[1]).toBe("29/11/2026");
    expect(groups[2]).toBe("30/11/2026");
    /* المتأخر لا يتكرر داخل مجموعات التاريخ. */
    expect(groups.filter(g => g === "20/11/2026")).toHaveLength(0);
    unmount();

    /* الذاكرة: بلا معامل — يفتح على القائمة (آخر اختيار). */
    search = "";
    rowsApi.mockResolvedValue({ sales: [] });
    render(<TrackerPage />);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["e.empty_tracker"])).toBeTruthy());
  });

  it("القائمة الفارغة كلها: النص الحرفي للكتالوج", async () => {
    search = "?mode=list";
    rowsApi.mockResolvedValue({ sales: [] });
    render(<TrackerPage />);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["e.empty_tracker"])).toBeTruthy());
  });

  it("زر الصف حسب الحالة: «تم التسليم» للمجدول/المتأخر و«تحصيل» للمسلَّم غير المدفوع", async () => {
    rowsApi.mockResolvedValue({
      sales: [
        saleRow({ id: "s-ovd", status: "overdue", customerName: "متأخر عميل" }),
        saleRow({ id: "s-dup", status: "delivered_unpaid", customerName: "بانتظار عميل" }),
      ],
    });
    render(<TrackerPage />);
    await waitFor(() => expect(screen.getByText("متأخر عميل")).toBeTruthy());
    expect(screen.getAllByText(MANAGE_STRINGS_AR["a.deliver"])).toHaveLength(1);
    expect(screen.getAllByText(MANAGE_STRINGS_AR["a.collect_now"])).toHaveLength(1);
  });

  it("الرأس: «منتجاتي» و«طلب جديد» بوجهتيهما القانونية", async () => {
    rowsApi.mockResolvedValue({ sales: [] });
    render(<TrackerPage />);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["s.tracker"])).toBeTruthy());
    fireEvent.click(screen.getByText(MANAGE_STRINGS_AR["s.products"]));
    expect(navigate).toHaveBeenCalledWith("/manage/products");
    fireEvent.click(screen.getByText(MANAGE_STRINGS_AR["t.new_order"]));
    expect(navigate).toHaveBeenCalledWith("/manage/op/sale");
  });
});
