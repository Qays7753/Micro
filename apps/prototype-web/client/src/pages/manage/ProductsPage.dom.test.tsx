/** @vitest-environment jsdom */

/*
 * M5.3 (UX P-22 «منتجاتي»): الحالات الحرفية — قائمة النشطة (الاسم والوحدة
 * وسعر البيع وتكلفة الوحدة أو «غير معروفة»)، قسم مطوي للمؤرشفة بنفس
 * الصفوف مع «مؤرشفة»، الفراغ الحرفي مع زر «إضافة منتج»، وكبسة الصف تفتح
 * المحرر P-23 معبّأ.
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProductsPage from "@/pages/manage/ProductsPage";
import { MANAGE_STRINGS_AR } from "@/application/manage/strings";
import * as api from "@/application/manage/api";
import type { ProductItem } from "@/application/manage/api";

const navigate = vi.fn();
vi.mock("wouter", () => ({
  useLocation: () => ["/manage/products", navigate],
}));

vi.mock("@/application/manage/api", async importOriginal => {
  const actual = await importOriginal<typeof import("@/application/manage/api")>();
  return {
    ...actual,
    fetchManageProducts: vi.fn(),
  };
});

const productsApi = vi.mocked(api.fetchManageProducts);

function product(overrides: Partial<ProductItem> = {}): ProductItem {
  return {
    productId: "p1",
    name: "منسف",
    unitLabel: "صينية",
    unitPriceFils: 25_000,
    unitCostFils: 18_000,
    archived: false,
    components: [{ name: "لحم", costFils: 18_000 }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => cleanup());

describe("M5.3 — P-22 منتجاتي", () => {
  it("قائمة النشطة: الاسم والوحدة وسعر البيع وتكلفة الوحدة من الخادم (D-5)", async () => {
    productsApi.mockResolvedValue({
      active: [
        product(),
        product({
          productId: "p2",
          name: "شاي",
          unitLabel: null,
          unitPriceFils: 500,
          unitCostFils: null,
          components: [],
        }),
      ],
      archived: [],
    });
    render(<ProductsPage />);
    await waitFor(() => expect(screen.getByText("منسف")).toBeTruthy());
    expect(screen.getByText(/صينية · 25\.000 د/)).toBeTruthy();
    expect(screen.getByText("18.000 د")).toBeTruthy();
    /* بلا مكوّنات: «غير معروفة» — لا صفر أبدًا (§3.3). */
    expect(screen.getByText(MANAGE_STRINGS_AR["l.unit_cost_unknown"])).toBeTruthy();
    /* كبسة الصف ← المحرر معبّأ. */
    fireEvent.click(screen.getByText("منسف"));
    expect(navigate).toHaveBeenCalledWith("/manage/products/p1");
  });

  it("قسم مطوي للمؤرشفة: نفس الصفوف مع «مؤرشفة» ويفتح ويغلق", async () => {
    productsApi.mockResolvedValue({
      active: [product()],
      archived: [product({ productId: "p3", name: "كنافة", archived: true })],
    });
    render(<ProductsPage />);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["t.archived_section"])).toBeTruthy());
    /* مطوي افتراضيًا. */
    expect(screen.queryByText(/كنافة/)).toBeNull();
    fireEvent.click(screen.getByText(MANAGE_STRINGS_AR["t.archived_section"]));
    await waitFor(() => expect(screen.getByText(`كنافة · ${MANAGE_STRINGS_AR["l.archived"]}`)).toBeTruthy());
    /* كبسة صف المؤرشفة تفتح المحرر كذلك (P-23 معبّأة). */
    fireEvent.click(screen.getByText(`كنافة · ${MANAGE_STRINGS_AR["l.archived"]}`));
    expect(navigate).toHaveBeenCalledWith("/manage/products/p3");
  });

  it("الفراغ الحرفي مع زر «إضافة منتج»؛ وزر الرأس يفتح المحرر الفارغ", async () => {
    productsApi.mockResolvedValue({ active: [], archived: [] });
    render(<ProductsPage />);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["e.empty_products"])).toBeTruthy());
    const addButtons = screen.getAllByText(MANAGE_STRINGS_AR["a.add_product"]);
    expect(addButtons.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(addButtons[0]!);
    expect(navigate).toHaveBeenCalledWith("/manage/products/new");
  });

  it("فشل الشبكة: فراغ صادق لا انفجارًا (T56)", async () => {
    productsApi.mockRejectedValue(new Error("offline"));
    render(<ProductsPage />);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["e.empty_products"])).toBeTruthy());
  });
});
