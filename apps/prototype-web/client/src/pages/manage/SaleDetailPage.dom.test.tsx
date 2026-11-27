/** @vitest-environment jsdom */

/*
 * M5.3 (UX P-21 «تفاصيل الطلب» + §6): الحالات الحرفية — الرأس (الاسم أو
 * «بدون اسم» + الحالة + تعديل + ⋯)، الدفع بصيغتيه وخط الرد المفتوح
 * S-REFUND-DUE، الربح المتوقع مخفيًا عند فراغه، التواريخ الأربعة مع
 * «آخر تعديل»، البنود بوصفها وكميتها وسعر وحدتها، السعر النهائي، قسم
 * التوصيل (بلا ملغى) مع زر «+»، الملاحظة بعنوانها، السجل المالي (نوعه
 * ومبلغه وصندوقه مع صندوقين)، المتتبّع بحذفه وإضافته، وشريط الإجراءات:
 * الأساسي حسب الحالة والباقي بقائمة ⋯، و404 الخادم.
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SaleDetailPage from "@/pages/manage/SaleDetailPage";
import { MANAGE_STRINGS_AR } from "@/application/manage/strings";
import * as api from "@/application/manage/api";
import type { SaleDetailsResponse } from "@/application/manage/api";

const navigate = vi.fn();
let routeId = "s1";
vi.mock("wouter", () => ({
  useLocation: () => ["/manage/sale/s1", navigate],
  useParams: () => ({ id: routeId }),
}));

vi.mock("@/application/manage/api", async importOriginal => {
  const actual = await importOriginal<typeof import("@/application/manage/api")>();
  return {
    ...actual,
    fetchSaleDetails: vi.fn(),
    hideSaleFromTracker: vi.fn().mockResolvedValue({}),
    addSaleToTracker: vi.fn().mockResolvedValue({}),
  };
});

const detailsApi = vi.mocked(api.fetchSaleDetails);
const hideApi = vi.mocked(api.hideSaleFromTracker);
const addApi = vi.mocked(api.addSaleToTracker);

function details(
  saleOverrides: Partial<SaleDetailsResponse["sale"]> = {},
  responseOverrides: Partial<SaleDetailsResponse> = {},
): SaleDetailsResponse {
  return {
    sale: {
      id: "s1",
      status: "scheduled",
      customerName: "أبو أحمد",
      registeredOn: "2026-11-25",
      plannedDeliveryOn: "2026-11-29",
      deliveredOn: null,
      finalPriceFils: 36_000,
      finalPriceText: "36.000 د",
      tracked: true,
      hiddenFromTracker: false,
      note: null,
      prepaymentFils: 0,
      expectedProfitFils: 12_000,
      netSaleRevenueFils: 0,
      fullAmountFils: 36_000,
      paidFils: 10_000,
      paidOfFils: 36_000,
      customerRefundDueFils: null,
      customerRefundDueText: null,
      lastEditOn: null,
      ...saleOverrides,
    },
    boxesCount: 1,
    lines: [
      {
        id: "l1",
        productId: "p1",
        description: "مقلوبة",
        quantityMilli: 2000,
        unitPriceFils: 18_000,
        unitLabel: "صينية",
      },
    ],
    deliveryCosts: [
      {
        operationId: "o-dc",
        amountFils: 2_000,
        amountText: "2.000 د",
        source: "cash",
        effectiveOn: "2026-11-27",
      },
    ],
    history: [
      {
        operationId: "o-deliver",
        kind: "OP-DELIVER",
        effectiveOn: "2026-11-27",
        amountFils: 36_000,
        amountText: "36.000 د",
        status: "active",
        corrected: false,
        boxKind: "cash",
        category: null,
      },
    ],
    ...responseOverrides,
  };
}

beforeEach(() => {
  routeId = "s1";
  vi.clearAllMocks();
});
afterEach(() => cleanup());

describe("M5.3 — P-21 تفاصيل الطلب: القراءة", () => {
  it("مجدول: الرأس والدفع «المدفوع X من Y» والربح المتوقع والتواريخ والبنود والسعر النهائي", async () => {
    detailsApi.mockResolvedValue(details());
    render(<SaleDetailPage />);
    await waitFor(() => expect(screen.getByText("أبو أحمد")).toBeTruthy());
    /* الحالة شارة بجوار الاسم. */
    expect(screen.getByText(MANAGE_STRINGS_AR["st.scheduled"])).toBeTruthy();
    /* المدفوع X من Y بصيغة الدخول (R-21 للوحة الحقلية). */
    expect(screen.getByText(/المدفوع 10\.000 د من 36\.000 د/)).toBeTruthy();
    /* الربح المتوقع. */
    expect(screen.getByText(new RegExp(MANAGE_STRINGS_AR["l.expected_profit"]))).toBeTruthy();
    /* التواريخ: المخطط والتسجيل؛ الفعلي غائب قبل التسليم؛ آخر تعديل غائب
     * إذا لم يُعدّل قط. */
    expect(screen.getByText(`${MANAGE_STRINGS_AR["f.planned_date"]}: 29/11/2026`)).toBeTruthy();
    expect(screen.getByText(`${MANAGE_STRINGS_AR["f.registered"]}: 25/11/2026`)).toBeTruthy();
    expect(screen.queryByText(MANAGE_STRINGS_AR["f.actual_date"])).toBeNull();
    expect(screen.queryByText(new RegExp("آخر تعديل"))).toBeNull();
    /* البنود: الوصف والكمية بالوحدة وسعر الوحدة. */
    expect(screen.getByText("مقلوبة")).toBeTruthy();
    expect(screen.getByText(`${MANAGE_STRINGS_AR["f.quantity"]}: 2.000 صينية`)).toBeTruthy();
    /* السعر النهائي. */
    expect(screen.getByText(`${MANAGE_STRINGS_AR["f.final_price"]}: 36.000 د`)).toBeTruthy();
  });

  it("«آخر تعديل» يظهر بتاريخه بعد تعديل حقول (R-17/D-14)", async () => {
    detailsApi.mockResolvedValue(details({ lastEditOn: "2026-11-27" }));
    render(<SaleDetailPage />);
    await waitFor(() =>
      expect(screen.getByText(MANAGE_STRINGS_AR["l.last_edit"].replace("{date}", "27/11/2026"))).toBeTruthy(),
    );
  });

  it("قبل التسليم بلا سعر نهائي: «المدفوع {X}» فقط؛ والربح المتوقع يسقط عند فراغه", async () => {
    detailsApi.mockResolvedValue(
      details({
        finalPriceFils: null,
        finalPriceText: null,
        paidOfFils: null,
        expectedProfitFils: null,
        fullAmountFils: null,
      }),
    );
    render(<SaleDetailPage />);
    await waitFor(() => expect(screen.getByText(/المدفوع 10\.000 د/)).toBeTruthy());
    expect(screen.queryByText(/من 36/)).toBeNull();
    expect(screen.queryByText(new RegExp(MANAGE_STRINGS_AR["l.expected_profit"]))).toBeNull();
    expect(screen.queryByText(new RegExp(MANAGE_STRINGS_AR["f.final_price"]))).toBeNull();
  });

  it("خط رد لعميل مفتوح: جملة S-REFUND-DUE بمبلغ الخادم؛ والملاحظة بعنوانها", async () => {
    detailsApi.mockResolvedValue(
      details({
        note: "يفضّل التسليم مساءً",
        customerRefundDueFils: 8_000,
        customerRefundDueText: "8.000 د",
      }),
    );
    render(<SaleDetailPage />);
    await waitFor(() =>
      expect(screen.getByText(MANAGE_STRINGS_AR["S-REFUND-DUE"].replace("{amount}", "8.000 د"))).toBeTruthy(),
    );
    expect(screen.getByText(MANAGE_STRINGS_AR["f.note"])).toBeTruthy();
    expect(screen.getByText("يفضّل التسليم مساءً")).toBeTruthy();
  });

  it("قسم التوصيل مع زر «+» حتى بلا حركات (غير الملغى)؛ ويسقط كله للملغى", async () => {
    detailsApi.mockResolvedValue(details({}, { deliveryCosts: [] }));
    const { unmount } = render(<SaleDetailPage />);
    /* العنوان وزر «+» بنص القسم نفسه — حتى بلا حركات. */
    await waitFor(() =>
      expect(screen.getAllByText(MANAGE_STRINGS_AR["f.sale_delivery"]).length).toBeGreaterThanOrEqual(2),
    );
    expect(screen.queryByText("2.000 د")).toBeNull();
    unmount();

    /* الملغى: القسم كله يسقط (بلا إجراءات مالية) — تركيب جديد لا إعادة رسم. */
    detailsApi.mockResolvedValue(details({ status: "cancelled" }));
    render(<SaleDetailPage />);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["st.cancelled"])).toBeTruthy());
    expect(screen.queryByText(MANAGE_STRINGS_AR["f.sale_delivery"])).toBeNull();
  });

  it("السجل المالي: النوع والمبلغ والتاريخ؛ والصندوق مع صندوقين فقط", async () => {
    detailsApi.mockResolvedValue(details());
    const { unmount } = render(<SaleDetailPage />);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["s.sale_history"])).toBeTruthy());
    expect(screen.getByText(MANAGE_STRINGS_AR["op.deliver"])).toBeTruthy();
    expect(screen.getByText("36.000 د")).toBeTruthy();
    /* صندوق واحد: التاريخان (صف التوصيل وصف السجل) بلا الصندوق إطلاقًا. */
    expect(screen.getAllByText("27/11/2026").length).toBe(2);
    expect(screen.queryByText(`27/11/2026 · ${MANAGE_STRINGS_AR["f.cash"]}`)).toBeNull();
    unmount();

    /* صندوقان: الصندوق يظهر بصف السجل. */
    detailsApi.mockResolvedValue(details({}, { boxesCount: 2 }));
    render(<SaleDetailPage />);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["s.sale_history"])).toBeTruthy());
    expect(screen.getByText(`27/11/2026 · ${MANAGE_STRINGS_AR["f.cash"]}`)).toBeTruthy();
  });
});

describe("M5.3 — P-21 تفاصيل الطلب: الإجراءات والمتتبّع", () => {
  it("مجدول: «تم التسليم» أساسي والباقي بقائمة ⋯", async () => {
    detailsApi.mockResolvedValue(details());
    render(<SaleDetailPage />);
    await waitFor(() => expect(screen.getByText("أبو أحمد")).toBeTruthy());
    /* الأساسي ظاهر مباشرة. */
    expect(screen.getByRole("button", { name: MANAGE_STRINGS_AR["a.deliver"] })).toBeTruthy();
    /* الثانوي مخفي قبل فتح ⋯. */
    expect(screen.queryByText(MANAGE_STRINGS_AR["a.prepayment"])).toBeNull();
    fireEvent.click(screen.getByLabelText("⋯"));
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["a.prepayment"])).toBeTruthy());
    expect(screen.getByText(MANAGE_STRINGS_AR["a.cancel"])).toBeTruthy();
  });

  it("مُسلَّم بانتظار الدفع: «تحصيل» أساسي و«لن يُحصَّل» و«مرتجع» بالقائمة", async () => {
    detailsApi.mockResolvedValue(details({ status: "delivered_unpaid", deliveredOn: "2026-11-28" }));
    render(<SaleDetailPage />);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["st.delivered_unpaid"])).toBeTruthy());
    expect(screen.getByRole("button", { name: MANAGE_STRINGS_AR["a.collect_now"] })).toBeTruthy();
    fireEvent.click(screen.getByLabelText("⋯"));
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["f.short_writeoff"])).toBeTruthy());
    expect(screen.getByText(MANAGE_STRINGS_AR["a.return"])).toBeTruthy();
    expect(screen.getByText(MANAGE_STRINGS_AR["a.undo_delivery"])).toBeTruthy();
  });

  it("مكتمل بخط رد مفتوح: «سداد» هو الأساسي؛ وبلا خط رد لا أساسي", async () => {
    detailsApi.mockResolvedValue(
      details({
        status: "completed",
        deliveredOn: "2026-11-28",
        customerRefundDueFils: 8_000,
        customerRefundDueText: "8.000 د",
      }),
    );
    render(<SaleDetailPage />);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["st.completed"])).toBeTruthy());
    expect(screen.getByRole("button", { name: MANAGE_STRINGS_AR["op.pay"] })).toBeTruthy();

    /* بلا خط رد: مكتمل بلا زر أساسي. */
    detailsApi.mockResolvedValue(details({ status: "completed", deliveredOn: "2026-11-28" }));
    cleanup();
    render(<SaleDetailPage />);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["st.completed"])).toBeTruthy());
    expect(screen.queryByRole("button", { name: MANAGE_STRINGS_AR["op.pay"] })).toBeNull();
    expect(screen.queryByRole("button", { name: MANAGE_STRINGS_AR["a.deliver"] })).toBeNull();
  });

  it("المتتبّع: «حذف من المتتبّع» للمتتبَّع و«إضافة إلى متتبّع الطلبات» لغيره (بلا أثر مالي)", async () => {
    detailsApi.mockResolvedValue(details());
    render(<SaleDetailPage />);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["a.hide_tracker"])).toBeTruthy());
    fireEvent.click(screen.getByText(MANAGE_STRINGS_AR["a.hide_tracker"]));
    await waitFor(() => expect(hideApi).toHaveBeenCalledWith("s1"));

    /* مخفي: زر الإضافة. */
    detailsApi.mockResolvedValue(details({ hiddenFromTracker: true }));
    cleanup();
    render(<SaleDetailPage />);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["a.add_to_tracker"])).toBeTruthy());
    fireEvent.click(screen.getByText(MANAGE_STRINGS_AR["a.add_to_tracker"]));
    await waitFor(() => expect(addApi).toHaveBeenCalledWith("s1"));
  });

  it("طلب غير موجود (404 الخادم): فراغ صادق مع زر رجوع", async () => {
    detailsApi.mockRejectedValue(new Error("not found"));
    render(<SaleDetailPage />);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["e.empty_search"])).toBeTruthy());
    expect(screen.getByRole("button", { name: MANAGE_STRINGS_AR["a.back"] })).toBeTruthy();
  });
});
