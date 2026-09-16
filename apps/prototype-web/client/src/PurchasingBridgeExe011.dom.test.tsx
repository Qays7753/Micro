/** @vitest-environment jsdom */
/** EXE-011 (PUR-001 / AUD-NEW-08): جسر الشراء → الاستلام — حفظ شراء مرتبط
 * بمادة متتبَّعة يعرض استمرارًا صريحًا «استلام المخزون» بدل الخروج الصامت
 * (المادة غير المرتبطة أو غير المتتبَّعة تحافظ على عقد ٢٦ قاعدة ٣)، وحالة
 * «بانتظار الاستلام» في صفحة المخزون تصبح رحلة لا نصًا ساكنًا. الآلة القائمة
 * (Idempotency، الاستلام الجزئي، السقوف) مغطاة باختبارات الخدمة وF6 — لا
 * تكرار هنا. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { SupplierPurchaseService } from "@/application/suppliers/supplierPurchaseService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { FormDraftService } from "@/application/drafts/formDraftService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import SupplierPurchaseEditor from "@/pages/SupplierPurchaseEditor";
import InventoryMaterials from "@/pages/InventoryMaterials";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/suppliers/purchase/new",
  params: { id: "new" } as Record<string, string | undefined>,
  search: "?from=%2Fsuppliers",
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => wouterMocks.params,
  useSearch: () => wouterMocks.search,
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-09-16T11:00:00.000Z";

let store: MemoryLocalStore;
const contextRef: { current: Record<string, unknown> } = { current: {} };

function Harness({ page }: { page: React.ReactNode }) {
  const [version, setVersion] = React.useState(0);
  const inventory = new InventoryMaterialService(store, () => NOW);
  contextRef.current = {
    inventory,
    supplierPurchases: new SupplierPurchaseService(store, () => NOW),
    cashContinuity: new CashContinuityService(store, () => NOW),
    formDrafts: new FormDraftService(store),
    dataVersion: version,
    notifyDataChanged: () => setVersion(current => current + 1),
  };
  return <UnsavedChangesProvider navigate={wouterMocks.navigate}>{page}</UnsavedChangesProvider>;
}

mockedUsePrototypeServices.mockImplementation(
  () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
);

async function seedMaterial(name: string, tracking: "tracked" | "untracked"): Promise<string> {
  const inventory = new InventoryMaterialService(store, () => NOW);
  const opened = await inventory.openMaterial({
    name,
    unit: "kilogram",
    tracking,
    opening: {
      quantityState: "unconfirmed",
      quantityMilli: null,
      costState: "unknown",
      valueMinor: null,
      confirmedOn: null,
      sourceNote: null,
    },
    note: "بلا رصيد",
    operationKey: `exe011-${tracking}-${name}`,
  });
  if (!opened.ok) throw new Error(opened.message);
  return opened.value.material.id;
}

async function fillAndSavePurchase(materialLabel: string | null, materialName?: string) {
  fireEvent.change(screen.getByLabelText("اسم المورد"), { target: { value: "مورد الأقمشة" } });
  fireEvent.change(screen.getByLabelText("ماذا اشتريت؟"), { target: { value: "قماش قطني للمشروع" } });
  if (materialLabel) {
    /* خيارات المادة تُحمّل من المراجع بشكل غير متزامن — ننتظر الخيار نفسه
     * قبل التعيين حتى لا يرتد التحديد الصامت إلى «بلا ربط مادة». */
    if (materialName) await screen.findByText(materialName, { selector: "option" });
    fireEvent.change(screen.getByLabelText(/المادة المشتراة/), { target: { value: materialLabel } });
  }
  const total = screen.getByLabelText("إجمالي الشراء بالدينار الأردني");
  fireEvent.change(total, { target: { value: "40.00" } });
  /* الإدخال الرقمي يلتزم عند التمويه (blur) لا عند الكتابة — سلوك المكوّن. */
  fireEvent.blur(total);
  await waitFor(() => {
    fireEvent.click(screen.getByRole("button", { name: /حفظ شراء المواد/ }));
  });
}

describe("EXE-011 purchase → receipt continuation (PUR-001 / AUD-NEW-08)", () => {
  beforeEach(() => {
    wouterMocks.navigate.mockClear();
    wouterMocks.params = { id: "new" };
    wouterMocks.location = "/suppliers/purchase/new";
    wouterMocks.search = "?from=%2Fsuppliers";
    vi.clearAllMocks();
    store = new MemoryLocalStore();
  });
  afterEach(() => cleanup());

  it("saving a tracked-material purchase shows the receipt continuation instead of a silent exit", async () => {
    const materialId = await seedMaterial("قماش قطني", "tracked");
    render(
      <Harness page={<SupplierPurchaseEditor />} />,
    );
    await fillAndSavePurchase(materialId, "قماش قطني");
    const panel = await screen.findByTestId("purchase-receipt-continuation");
    expect(panel.textContent).toContain("استلام المخزون");
    /* لا عرض حفظ ثانٍ بعد النجاح — الخطوة التالية أو العودة الصريحة. */
    expect(screen.queryByRole("button", { name: /حفظ شراء المواد/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /استلام المخزون/ }));
    /* الوصلة العميقة تمر بالشراء الصحيح نفسه لا أول سجل، والعودة لتفاصيله. */
    await waitFor(() => {
      expect(wouterMocks.navigate).toHaveBeenCalledWith(
        expect.stringMatching(/^\/inventory\/movement\/receipt\?purchase=[^&]+&from=%2Fsuppliers%2Fpurchase%2F.+$/),
      );
    });
  });

  it("the explicit return action still honours S1-07 (?from) after the continuation appears", async () => {
    const materialId = await seedMaterial("قماش قطني", "tracked");
    render(
      <Harness page={<SupplierPurchaseEditor />} />,
    );
    await fillAndSavePurchase(materialId, "قماش قطني");
    await screen.findByTestId("purchase-receipt-continuation");
    fireEvent.click(screen.getByRole("button", { name: /عودة إلى المصدر/ }));
    await waitFor(() => {
      expect(wouterMocks.navigate).toHaveBeenCalledWith("/suppliers");
    });
  });

  it("a purchase without a material keeps the classic S1-07 exit — no continuation panel", async () => {
    render(
      <Harness page={<SupplierPurchaseEditor />} />,
    );
    await fillAndSavePurchase(null);
    await waitFor(() => {
      expect(wouterMocks.navigate).toHaveBeenCalledWith("/suppliers");
    });
    expect(screen.queryByTestId("purchase-receipt-continuation")).toBeNull();
  });

  it("an untracked (cost-only) material link does not offer a misleading receipt continuation", async () => {
    const materialId = await seedMaterial("خيط تطريز", "untracked");
    render(
      <Harness page={<SupplierPurchaseEditor />} />,
    );
    await fillAndSavePurchase(materialId);
    await waitFor(() => {
      expect(wouterMocks.navigate).toHaveBeenCalledWith("/suppliers");
    });
    expect(screen.queryByTestId("purchase-receipt-continuation")).toBeNull();
  });
});

describe("EXE-011 awaiting-receipt status leads to the journey (InventoryMaterials)", () => {
  beforeEach(() => {
    wouterMocks.navigate.mockClear();
    wouterMocks.params = {};
    wouterMocks.location = "/inventory";
    wouterMocks.search = "";
    vi.clearAllMocks();
    store = new MemoryLocalStore();
  });
  afterEach(() => cleanup());

  it("the material card awaiting line opens the receipt journey prefilled with that material", async () => {
    const materialId = await seedMaterial("سكر", "tracked");
    const purchases = new SupplierPurchaseService(store, () => NOW);
    const saved = await purchases.recordPurchase({
      supplierName: "مورد السكر",
      note: "سكر أبيض",
      purchasedOn: "2026-09-15",
      dueOn: null,
      totalMinor: 9000,
      initialPaidMinor: 0,
      idempotencyKey: "exe011-await-key",
      materialId,
      expectedQuantityMilli: 15000,
      initialPaymentWalletId: null,
    });
    if (!saved.ok) throw new Error(saved.message);
    render(
      <Harness page={<InventoryMaterials />} />,
    );
    const link = await screen.findByTestId("awaiting-receipt-link-سكر");
    expect(link.textContent).toContain("بانتظار الاستلام");
    expect(link.textContent).toContain("شراء");
    fireEvent.click(link);
    /* الرحلة محضّرة بالمادة الصحيحة، والشراء المرجعي يبقى اختيارًا صريحًا. */
    await waitFor(() => {
      expect(wouterMocks.navigate).toHaveBeenCalledWith(
        `/inventory/movement/receipt?material=${encodeURIComponent(materialId)}&from=%2Finventory`,
      );
    });
  });
});
