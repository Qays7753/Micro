/** @vitest-environment jsdom */

/*
 * M5.3 (UX P-23 «المنتج» + P-24 «تأكيد الأرشفة»): الحالات الحرفية — الحقول
 * الثلاثة (الاسم إجباري E-NAME-REQUIRED، الوحدة اختياري، السعر إجباري
 * E-UNIT-PRICE-REQUIRED بحقل C-01)، المكوّنات (إضافة وحذف وصف ناقص يُشال
 * عند الحفظ)، «تكلفة الوحدة» تتحدث مع الكتابة (§8.2) أو «غير معروفة»،
 * الحفظ يرجع للقائمة (R-17: بلا عملية)، الأرشفة بتأكيدها الحرفي، وإلغاء
 * الأرشفة فوري، وتحميل منتج موجود بمكوّناته (P-23 معبّأة).
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProductEditorPage from "@/pages/manage/ProductEditorPage";
import { MANAGE_STRINGS_AR } from "@/application/manage/strings";
import * as api from "@/application/manage/api";
import type { ProductItem } from "@/application/manage/api";

const navigate = vi.fn();
let routeId = "new";
vi.mock("wouter", () => ({
  useLocation: () => ["/manage/products/new", navigate],
  useParams: () => ({ id: routeId }),
}));

vi.mock("@/application/manage/api", async importOriginal => {
  const actual = await importOriginal<typeof import("@/application/manage/api")>();
  return {
    ...actual,
    fetchManageProducts: vi.fn(),
    saveManageProduct: vi.fn().mockResolvedValue({}),
    archiveManageProduct: vi.fn().mockResolvedValue({}),
  };
});

const productsApi = vi.mocked(api.fetchManageProducts);
const saveApi = vi.mocked(api.saveManageProduct);
const archiveApi = vi.mocked(api.archiveManageProduct);

function product(overrides: Partial<ProductItem> = {}): ProductItem {
  return {
    productId: "p1",
    name: "منسف",
    unitLabel: "صينية",
    unitPriceFils: 25_000,
    unitCostFils: 20_500,
    archived: false,
    components: [
      { name: "لحم", costFils: 18_000 },
      { name: "رز", costFils: 2_500 },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  routeId = "new";
  vi.clearAllMocks();
});
afterEach(() => cleanup());

/** سطر «تكلفة الوحدة» (نصه مجزأ بعناصر JSX) — نصه الكامل للفحص. */
function unitCostLineText(): string {
  const lines = [...document.querySelectorAll(".micro-manage-card__line--secondary")];
  return (
    lines.find(node => (node.textContent ?? "").includes(MANAGE_STRINGS_AR["f.unit_cost"]))?.textContent ?? ""
  );
}

describe("M5.3 — P-23 منتج جديد", () => {
  it("الحقول فارغة و«تكلفة الوحدة: غير معروفة» قبل أي مكوّن", async () => {
    render(<ProductEditorPage />);
    await waitFor(() => expect(screen.getByLabelText(MANAGE_STRINGS_AR["f.name"])).toBeTruthy());
    /* تكلفة الوحدة قبل أي مكوّن: «غير معروفة» (النص مجزأ بعنصرين). */
    expect(unitCostLineText()).toContain(MANAGE_STRINGS_AR["l.unit_cost_unknown"]);
    /* لا زر أرشفة لمنتج غير موجود بعد. */
    expect(screen.queryByText(MANAGE_STRINGS_AR["a.archive"])).toBeNull();
  });

  it("E-NAME-REQUIRED تحت الاسم وE-UNIT-PRICE-REQUIRED تحت السعر — لا كتابة عند الخطأ", async () => {
    render(<ProductEditorPage />);
    await waitFor(() => expect(screen.getByLabelText(MANAGE_STRINGS_AR["f.name"])).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: MANAGE_STRINGS_AR["a.save"] }));
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["E-NAME-REQUIRED"])).toBeTruthy());
    expect(saveApi).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(MANAGE_STRINGS_AR["f.name"]), {
      target: { value: "محاشي" },
    });
    fireEvent.click(screen.getByRole("button", { name: MANAGE_STRINGS_AR["a.save"] }));
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["E-UNIT-PRICE-REQUIRED"])).toBeTruthy());
    expect(saveApi).not.toHaveBeenCalled();
  });

  it("الحفظ الصحيح: فلس صحيح من C-01 والرجوع للقائمة؛ الصف الناقص يُشال", async () => {
    render(<ProductEditorPage />);
    await waitFor(() => expect(screen.getByLabelText(MANAGE_STRINGS_AR["f.name"])).toBeTruthy());
    fireEvent.change(screen.getByLabelText(MANAGE_STRINGS_AR["f.name"]), { target: { value: "محاشي" } });
    fireEvent.change(screen.getByLabelText(MANAGE_STRINGS_AR["f.unit_label"]), {
      target: { value: "صحن" },
    });
    fireEvent.change(screen.getByTestId("manage-product-price"), { target: { value: "15" } });
    /* مكوّنان: كامل وناقص (اسم بلا تكلفة — يُشال عند الحفظ). */
    fireEvent.click(screen.getByRole("button", { name: MANAGE_STRINGS_AR["a.add_component"] }));
    const nameInputs = screen.getAllByLabelText(MANAGE_STRINGS_AR["f.component_name"]);
    const costInputs = screen.getAllByLabelText(MANAGE_STRINGS_AR["f.component_cost"]);
    fireEvent.change(nameInputs[0]!, { target: { value: "ورق عنب" } });
    fireEvent.change(costInputs[0]!, { target: { value: "6" } });
    fireEvent.click(screen.getByRole("button", { name: MANAGE_STRINGS_AR["a.add_component"] }));
    const nameInputs2 = screen.getAllByLabelText(MANAGE_STRINGS_AR["f.component_name"]);
    fireEvent.change(nameInputs2[1]!, { target: { value: "ناقص" } });
    /* تكلفة الوحدة تتحدث مع الكتابة: 6.000 د وحدها (الصف الناقص لا يدخل). */
    expect(unitCostLineText()).toContain("6.000 د");
    fireEvent.click(screen.getByRole("button", { name: MANAGE_STRINGS_AR["a.save"] }));
    await waitFor(() => expect(saveApi).toHaveBeenCalledTimes(1));
    const call = saveApi.mock.calls[0]![0];
    expect(call.name).toBe("محاشي");
    expect(call.unitPriceFils).toBe(15_000);
    expect(call.components).toEqual([{ name: "ورق عنب", costFils: 6_000 }]);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/manage/products"));
  });

  it("حذف صف مكوّن بأيقونته؛ والخطأ من الخادم يظهر أعلى الورقة", async () => {
    saveApi.mockRejectedValueOnce(
      Object.assign(new Error("conflict"), { statusCode: 409, code: "E-AMOUNT", body: { code: "E-AMOUNT" } }),
    );
    render(<ProductEditorPage />);
    await waitFor(() => expect(screen.getByLabelText(MANAGE_STRINGS_AR["f.name"])).toBeTruthy());
    fireEvent.change(screen.getByLabelText(MANAGE_STRINGS_AR["f.name"]), { target: { value: "منسف" } });
    fireEvent.change(screen.getByTestId("manage-product-price"), { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: MANAGE_STRINGS_AR["a.add_component"] }));
    const nameInputs = screen.getAllByLabelText(MANAGE_STRINGS_AR["f.component_name"]);
    fireEvent.change(nameInputs[0]!, { target: { value: "لحم" } });
    /* حذف الصف. */
    fireEvent.click(screen.getAllByLabelText(MANAGE_STRINGS_AR["a.delete_line"])[0]!);
    expect(screen.queryByLabelText(MANAGE_STRINGS_AR["f.component_name"])).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: MANAGE_STRINGS_AR["a.save"] }));
    /* الخادم رفض — رسالة الخطأ ظاهرة ولا رجوع. */
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(navigate).not.toHaveBeenCalledWith("/manage/products");
  });
});

describe("M5.3 — P-23 معبّأة + P-24 تأكيد الأرشفة", () => {
  it("منتج موجود: الحقول معبّأة بمكوّناته وتكلفته تتحدث مع الكتابة", async () => {
    routeId = "p1";
    productsApi.mockResolvedValue({ active: [product()], archived: [] });
    render(<ProductEditorPage />);
    await waitFor(() =>
      expect((screen.getByLabelText(MANAGE_STRINGS_AR["f.name"]) as HTMLInputElement).value).toBe("منسف"),
    );
    expect((screen.getByLabelText(MANAGE_STRINGS_AR["f.unit_label"]) as HTMLInputElement).value).toBe(
      "صينية",
    );
    expect((screen.getByTestId("manage-product-price") as HTMLInputElement).value).toBe("25.000");
    /* المكوّنان المخزنان معبّآن. */
    expect(
      (screen.getAllByLabelText(MANAGE_STRINGS_AR["f.component_name"])[0]! as HTMLInputElement).value,
    ).toBe("لحم");
    expect(unitCostLineText()).toContain("20.500 د");
  });

  it("الأرشفة: بطاقة التأكيد الحرفية ثم الأرشفة ترجع للقائمة", async () => {
    routeId = "p1";
    productsApi.mockResolvedValue({ active: [product()], archived: [] });
    render(<ProductEditorPage />);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["a.archive"])).toBeTruthy());
    fireEvent.click(screen.getByText(MANAGE_STRINGS_AR["a.archive"]));
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["d.archive_product"])).toBeTruthy());
    /* «رجوع» بطاقة التأكيد يلغيها (لا يغلق الورقة — رجوعها داخل البطاقة). */
    const confirmCard = screen.getByText(MANAGE_STRINGS_AR["d.archive_product"]).closest("section")!;
    fireEvent.click(within(confirmCard).getByRole("button", { name: MANAGE_STRINGS_AR["a.back"] }));
    await waitFor(() => expect(screen.queryByText(MANAGE_STRINGS_AR["d.archive_product"])).toBeNull());
    /* «تأكيد» يؤرشف ويرجع. */
    fireEvent.click(screen.getByText(MANAGE_STRINGS_AR["a.archive"]));
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["a.confirm"])).toBeTruthy());
    fireEvent.click(screen.getByText(MANAGE_STRINGS_AR["a.confirm"]));
    await waitFor(() => expect(archiveApi).toHaveBeenCalledWith("p1", true));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/manage/products"));
  });

  it("منتج مؤرشف: «إلغاء الأرشفة» فوري بلا تأكيد", async () => {
    routeId = "p1";
    productsApi.mockResolvedValue({
      active: [],
      archived: [product({ archived: true })],
    });
    render(<ProductEditorPage />);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["a.unarchive"])).toBeTruthy());
    expect(screen.queryByText(MANAGE_STRINGS_AR["a.archive"])).toBeNull();
    fireEvent.click(screen.getByText(MANAGE_STRINGS_AR["a.unarchive"]));
    await waitFor(() => expect(archiveApi).toHaveBeenCalledWith("p1", false));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/manage/products"));
  });

  it("معرّف غير موجود: فراغ صادق مع زر رجوع (R-24)", async () => {
    routeId = "no-such-product";
    productsApi.mockResolvedValue({ active: [product()], archived: [] });
    render(<ProductEditorPage />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: MANAGE_STRINGS_AR["a.back"] })).toBeTruthy(),
    );
  });
});
