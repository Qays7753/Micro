/** @vitest-environment jsdom */
/* S07 (UNIT-027 / DOC-016): رحلات DOM لبنود الفاتورة في محرر الشراء —
 * المسار البسيط (بند ضمني واحد يغطي الفاتورة)، والمسار متعدد البنود
 * (بنود إضافية بقيمها ومعرفتها ومجموعها الصادق)، والمعالجة تتبع حالة تتبع
 * المادة (متتبعة → عند الاستلام)، وحدود القيم، واستمرار الاستلام الصريح
 * للبند المتتبع (EXE-011)، وحالات الخطأ الصادقة. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { FormDraftService } from "@/application/drafts/formDraftService";
import { createFormDraftHarness } from "@/application/drafts/formDraftTestHarness";
import type { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import SupplierPurchaseEditor from "./SupplierPurchaseEditor";
import type { SupplierPurchase } from "@micro-domain/supplier-purchase/index.js";
import type { Material } from "@micro-domain/inventory-material/index.js";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({ navigate: vi.fn() }));
const routeParams = vi.hoisted(() => ({ mode: "new", id: "new" }));

vi.mock("wouter", () => ({
  useSearch: () => "",
  useLocation: () => ["/suppliers/purchase/new", wouterMocks.navigate],
  useParams: () => ({ mode: routeParams.mode, id: routeParams.id }),
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);

const trackedMaterial: Material = {
  id: "material-tracked-1",
  name: "قماش قطني",
  unit: "meter",
  createdAt: "2026-10-01T09:00:00.000Z",
  createdOperationKey: "material-open-1",
  tracking: { status: "tracked", trackedSince: "2026-10-01" },
  opening: null,
};

const untrackedMaterial: Material = {
  id: "material-untracked-1",
  name: "طحين الخبز",
  unit: "kilogram",
  createdAt: "2026-10-01T09:00:00.000Z",
  createdOperationKey: "material-open-2",
  tracking: null,
  opening: null,
};

function renderEditor(
  overrides: {
    recordPurchase?: ReturnType<typeof vi.fn>;
    materials?: readonly Material[];
    store?: MemoryLocalStore;
  } = {},
) {
  const recordPurchase = overrides.recordPurchase ?? vi.fn();
  const store = overrides.store ?? createFormDraftHarness().store;
  mockedUsePrototypeServices.mockReturnValue({
    formDrafts: new FormDraftService(store),
    supplierPurchases: {
      list: vi.fn().mockResolvedValue({ ok: true, value: [] as readonly SupplierPurchase[] }),
      recordPurchase,
      recordPayment: vi.fn(),
      editPurchase: vi.fn(),
      reversePayment: vi.fn(),
    } as unknown as ReturnType<typeof usePrototypeServices>["supplierPurchases"],
    inventory: {
      references: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          materials: overrides.materials ?? [trackedMaterial, untrackedMaterial],
          allMaterials: overrides.materials ?? [trackedMaterial, untrackedMaterial],
          purchases: [],
          orders: [],
          sales: [],
        },
      }),
      purchaseReceiptStatus: vi.fn().mockResolvedValue({ ok: true, value: null }),
    } as unknown as ReturnType<typeof usePrototypeServices>["inventory"],
    cashContinuity: {
      overview: vi.fn().mockResolvedValue({ ok: true, value: { wallets: [] } }),
    },
    dataVersion: 0,
    notifyDataChanged: vi.fn(),
  } as unknown as ReturnType<typeof usePrototypeServices>);
  render(
    <UnsavedChangesProvider navigate={() => undefined}>
      <SupplierPurchaseEditor />
    </UnsavedChangesProvider>,
  );
  return { recordPurchase };
}

async function fillBasics() {
  await userEvent.setup().type(screen.getByLabelText("ماذا اشتريت؟"), "فاتورة البيت والمحل");
  fireEvent.change(screen.getByLabelText("إجمالي الشراء بالدينار الأردني"), { target: { value: "30" } });
  fireEvent.change(screen.getByLabelText("ما دُفع الآن"), { target: { value: "0" } });
  /* تاريخ الشراء يبقى على اليوم الحي (todayInAmman) — لا تاريخًا مفبركًا. */
}

describe("S07 — بنود الفاتورة في محرر الشراء (UNIT-027 D01)", () => {
  beforeEach(() => {
    wouterMocks.navigate.mockClear();
    routeParams.mode = "new";
    routeParams.id = "new";
    window.localStorage.clear();
  });
  afterEach(() => cleanup());

  it("المسار البسيط بلا بنود إضافية: بند ضمني واحد يغطي الفاتورة بقيمتها — تكلفة فترة بلا متابعة", async () => {
    const { recordPurchase } = renderEditor({});
    await fillBasics();
    /* المورد: المسدد كاملًا جاء 0 هنا (دفع أولي 0 < إجمالي) — نحتاج تعريفًا. */
    await userEvent.setup().type(screen.getByLabelText(/اسم المورد/), "مؤسسة النسيج");
    recordPurchase.mockResolvedValueOnce({
      ok: true,
      value: {
        id: "purchase-1",
        status: "unpaid",
        lines: null,
        materialId: null,
      } as unknown as SupplierPurchase,
      reused: false,
    });
    await userEvent.setup().click(screen.getByRole("button", { name: "حفظ شراء المواد" }));
    await waitFor(() => expect(recordPurchase).toHaveBeenCalledOnce());
    const payload = recordPurchase.mock.calls[0]?.[0] as {
      lines?: { treatment: string; valueMinor: number | null; costKnowledge: string }[];
    };
    expect(payload.lines?.length).toBe(1);
    expect(payload.lines?.[0]?.treatment).toBe("period_material");
    expect(payload.lines?.[0]?.valueMinor).toBe(3_000);
    expect(payload.lines?.[0]?.costKnowledge).toBe("known");
  });

  it("المسار البسيط بمادة متتبعة: معالجة البند tracked_material — تكلفة عند الاستلام لا عند الشراء", async () => {
    const { recordPurchase } = renderEditor({});
    await fillBasics();
    await userEvent.setup().type(screen.getByLabelText(/اسم المورد/), "مؤسسة النسيج");
    fireEvent.change(screen.getByLabelText(/المادة المشتراة/), { target: { value: "material-tracked-1" } });
    fireEvent.change(screen.getByLabelText(/الكمية المتوقعة/), { target: { value: "4" } });
    recordPurchase.mockResolvedValueOnce({
      ok: true,
      value: {
        id: "purchase-1",
        status: "unpaid",
        lines: null,
        materialId: "material-tracked-1",
      } as unknown as SupplierPurchase,
      reused: false,
    });
    await userEvent.setup().click(screen.getByRole("button", { name: "حفظ شراء المواد" }));
    await waitFor(() => expect(recordPurchase).toHaveBeenCalledOnce());
    const payload = recordPurchase.mock.calls[0]?.[0] as {
      lines?: {
        treatment: string;
        valueMinor: number | null;
        expectedQuantityMilli: number | null;
        materialId: string | null;
      }[];
    };
    expect(payload.lines?.[0]?.treatment).toBe("tracked_material");
    expect(payload.lines?.[0]?.valueMinor).toBe(3_000);
    expect(payload.lines?.[0]?.expectedQuantityMilli).toBe(4_000);
    expect(payload.lines?.[0]?.materialId).toBe("material-tracked-1");
    /* EXE-011: استمرار صريح إلى الاستلام بعد الحفظ — الجسر هو الرحلة. */
    await waitFor(() => expect(screen.getByText(/استلام المخزون/)).toBeTruthy());
  });

  it("فاتورة بعدة بنود: قيم البنود ومعرفتها ومجموعها الصادق، والتجاوز فوق الإجمالي يُرفض قبل أي كتابة", async () => {
    const { recordPurchase } = renderEditor({});
    await fillBasics();
    await userEvent.setup().type(screen.getByLabelText(/اسم المورد/), "مؤسسة النسيج");
    fireEvent.change(screen.getByLabelText(/المادة المشتراة/), { target: { value: "material-tracked-1" } });
    fireEvent.change(screen.getByLabelText(/الكمية المتوقعة/), { target: { value: "4" } });
    /* تفعيل وضع البنود: البند الأول (المادة المتتبعة) بقيمة، وبند إضافي. */
    fireEvent.click(screen.getByText("فاتورة بعدة مواد — أضف بندًا"));
    fireEvent.change(screen.getByLabelText("قيمة بند المادة الأولى (د.أ)"), {
      target: { value: "20" },
    });
    fireEvent.click(screen.getByText("بلا ربط مادة — مواد فترة"));
    fireEvent.change(screen.getByLabelText("قيمة البند 2 (د.أ)"), { target: { value: "8" } });
    /* مجموع معلوم 28 من إجمالي 30 — والباقي غير الموزّع ليس تكلفة. */
    await waitFor(() => expect(screen.getByText(/مجموع قيم البنود المعلومة/)).toBeTruthy());
    recordPurchase.mockResolvedValueOnce({
      ok: true,
      value: {
        id: "purchase-2",
        status: "unpaid",
        lines: null,
        materialId: "material-tracked-1",
      } as unknown as SupplierPurchase,
      reused: false,
    });
    await userEvent.setup().click(screen.getByRole("button", { name: "حفظ شراء المواد" }));
    await waitFor(() => expect(recordPurchase).toHaveBeenCalledOnce());
    const payload = recordPurchase.mock.calls[0]?.[0] as {
      totalMinor: number;
      lines?: { lineId: string; treatment: string; valueMinor: number | null }[];
    };
    expect(payload.lines?.length).toBe(2);
    expect(payload.lines?.[0]?.treatment).toBe("tracked_material");
    expect(payload.lines?.[0]?.valueMinor).toBe(2_000);
    expect(payload.lines?.[1]?.treatment).toBe("period_material");
    expect(payload.lines?.[1]?.valueMinor).toBe(800);
    /* التجاوز: 25+8 > 30 يُرفض قبل أي كتابة برسالة صادقة. */
    cleanup();
    renderEditor({ recordPurchase });
    await fillBasics();
    await userEvent.setup().type(screen.getByLabelText(/اسم المورد/), "مؤسسة النسيج");
    fireEvent.click(screen.getByText("فاتورة بعدة مواد — أضف بندًا"));
    fireEvent.change(screen.getByLabelText("قيمة بند المادة الأولى (د.أ)"), {
      target: { value: "25" },
    });
    fireEvent.change(screen.getByLabelText("قيمة البند 2 (د.أ)"), { target: { value: "8" } });
    await userEvent.setup().click(screen.getByRole("button", { name: "حفظ شراء المواد" }));
    await waitFor(() =>
      expect(screen.getByText(/مجموع قيم البنود المعلومة يتجاوز إجمالي الشراء/)).toBeTruthy(),
    );
    expect(recordPurchase).toHaveBeenCalledTimes(1);
  });

  it("قيمة مجهولة للبند تبقى مجهولة (null) لا صفرًا معلومًا — SDF-036 في نموذج الشراء", async () => {
    const { recordPurchase } = renderEditor({});
    await fillBasics();
    await userEvent.setup().type(screen.getByLabelText(/اسم المورد/), "مؤسسة النسيج");
    fireEvent.click(screen.getByText("فاتورة بعدة مواد — أضف بندًا"));
    /* البند الأول بقيمة معلومة 10 ثم إلغاء «معروفة» — يبقى مجهولًا بلا قيمة. */
    fireEvent.change(screen.getByLabelText("قيمة بند المادة الأولى (د.أ)"), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByText("قيمة بند المادة الأولى معروفة"));
    fireEvent.change(screen.getByLabelText("قيمة البند 2 (د.أ)"), { target: { value: "7" } });
    recordPurchase.mockResolvedValueOnce({
      ok: true,
      value: { id: "purchase-3", status: "unpaid", lines: null } as unknown as SupplierPurchase,
      reused: false,
    });
    await userEvent.setup().click(screen.getByRole("button", { name: "حفظ شراء المواد" }));
    await waitFor(() => expect(recordPurchase).toHaveBeenCalledOnce());
    const payload = recordPurchase.mock.calls[0]?.[0] as {
      lines?: { costKnowledge: string; valueMinor: number | null }[];
    };
    expect(payload.lines?.[0]?.costKnowledge).toBe("unknown");
    expect(payload.lines?.[0]?.valueMinor).toBeNull();
    expect(payload.lines?.[1]?.valueMinor).toBe(700);
  });
});
