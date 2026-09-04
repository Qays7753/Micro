/** @vitest-environment jsdom */
/* المجموعة ٢ — قراءات أسطح المخزون: رحلة المادة الموجهة، أقسام المتابعة،
 * حوار إيقاف المتابعة وعواقبه، إفصاح النقص وحلّه، جسر الاستلام بمعاينة
 * الحالة، سؤال وجهة الاستهلاك، وسطر هدر الفترة غير النقدي. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import MaterialEditor from "@/pages/MaterialEditor";
import InventoryMaterials from "@/pages/InventoryMaterials";
import InventoryMovementEditor from "@/pages/InventoryMovementEditor";
import { createSupplierPurchase } from "@micro-domain/supplier-purchase/index.js";
import { SupplierPurchaseService } from "@/application/suppliers/supplierPurchaseService";
import { MaterialSheet } from "@/components/cost/MaterialSheet";
import type { DraftCostMaterial } from "@/storage/local/types";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterState = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: "",
  params: {} as Record<string, string | undefined>,
  path: "/inventory",
}));

vi.mock("wouter", () => ({
  useLocation: () => [wouterState.path, wouterState.navigate],
  useParams: () => wouterState.params,
  useSearch: () => wouterState.search,
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-09-06T09:00:00.000Z";

type Harness = {
  store: MemoryLocalStore;
  inventory: InventoryMaterialService;
};

function makeContext(store: MemoryLocalStore) {
  const inventory = new InventoryMaterialService(store, () => NOW);
  return { inventory, projectFinance: new ProjectFinancialService(store, () => NOW) };
}

function renderWithHarness(node: React.ReactNode, store: MemoryLocalStore): Harness {
  const { inventory } = makeContext(store);
  const contextRef: { current: Record<string, unknown> } = { current: {} };
  mockedUsePrototypeServices.mockImplementation(
    () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
  );
  function Harness() {
    const [version, setVersion] = React.useState(0);
    contextRef.current = {
      inventory,
      dataVersion: version,
      notifyDataChanged: () => setVersion(current => current + 1),
    };
    return (
      <UnsavedChangesProvider navigate={wouterState.navigate}>{node}</UnsavedChangesProvider>
    );
  }
  render(<Harness />);
  return { store, inventory };
}

describe("MaterialEditor guided journey (المجموعة ٢ — عقد ٢٨)", () => {
  beforeEach(() => {
    wouterState.navigate.mockClear();
    wouterState.params = {};
    wouterState.search = "";
    wouterState.path = "/inventory/material/new";
    vi.clearAllMocks();
  });
  afterEach(() => cleanup());

  it("asks the tracking question with both paths before anything else", async () => {
    const store = new MemoryLocalStore();
    renderWithHarness(<MaterialEditor />, store);
    expect(await screen.findByTestId("material-tracking-question")).toBeTruthy();
    expect(screen.getByText("بدك تتابع كميات هذه المادة؟")).toBeTruthy();
    expect(screen.getByText(/أيوه، تابع الكمية/)).toBeTruthy();
    expect(screen.getByText(/لا، للتكلفة فقط/)).toBeTruthy();
  });
  it("the untracked path shows the cost-only card and hides opening questions", async () => {
    const store = new MemoryLocalStore();
    renderWithHarness(<MaterialEditor />, store);
    await screen.findByTestId("material-tracking-question");
    fireEvent.click(screen.getByLabelText(/لا، للتكلفة فقط/));
    expect(screen.getByText("بلا رصيد ولا حركة مخزون")).toBeTruthy();
    expect(screen.queryByTestId("material-opening-question")).toBeNull();
    expect(screen.getByText("حفظ المادة")).toBeTruthy();
  });
  it("the tracked path asks for the opening state; «غير محدد بعد» hides date and value", async () => {
    const store = new MemoryLocalStore();
    renderWithHarness(<MaterialEditor />, store);
    await screen.findByTestId("material-tracking-question");
    fireEvent.click(screen.getByLabelText(/أيوه، تابع الكمية/));
    expect(screen.getByTestId("material-opening-question")).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/غير محدد بعد/));
    expect(screen.queryByLabelText("تاريخ تأكيد الرصيد")).toBeNull();
    expect(screen.queryByLabelText("قيمة الرصيد الافتتاحي بالدينار الأردني")).toBeNull();
    expect(screen.getByText("حفظ المادة")).toBeTruthy();
    /* المعاينة تصرح بالمجهول — لا صفر واثق. */
    expect(screen.getByTestId("material-effect-preview").textContent).toContain("غير محدد بعد");
  });
  it("confirmed quantity with unknown cost saves a marked-zero opening and shows it in the surface", async () => {
    const store = new MemoryLocalStore();
    const harness = renderWithHarness(<MaterialEditor />, store);
    await screen.findByTestId("material-tracking-question");
    fireEvent.change(screen.getByLabelText("اسم المادة"), { target: { value: "سكر" } });
    fireEvent.click(screen.getByLabelText(/أيوه، تابع الكمية/));
    fireEvent.click(screen.getByLabelText(/نعم، معلوم — أدخل الكمية/));
    const quantityField = screen.getByLabelText("الكمية الافتتاحية");
    fireEvent.change(quantityField, { target: { value: "20" } });
    /* الإدخال الكمي يلتزم عند التمويه (blur) لا عند الكتابة — سلوك المكوّن. */
    fireEvent.blur(quantityField);
    fireEvent.click(screen.getByLabelText(/لا، غير معروفة بعد/));
    fireEvent.click(screen.getByText("حفظ المادة ورصيد البداية"));
    await waitFor(() => expect(wouterState.navigate).toHaveBeenCalled());
    const overview = await harness.inventory.overview();
    if (!overview.ok) throw new Error(overview.message);
    expect(overview.value.materials[0]?.quantityMilli).toBe(20000);
    expect(overview.value.materials[0]?.costKnowledge).toBe("unknown");
    expect(overview.value.materials[0]?.quantityKnowledge).toBe("known");
  });
});

describe("InventoryMaterials sections and lifecycle (المجموعة ٢ — عقد ٢٨)", () => {
  beforeEach(() => {
    wouterState.navigate.mockClear();
    wouterState.params = {};
    wouterState.search = "";
    wouterState.path = "/inventory";
    vi.clearAllMocks();
  });
  afterEach(() => cleanup());

  async function seedMaterial(
    inventory: InventoryMaterialService,
    options: { name: string; confirmed: boolean; quantityMilli: number | null; valueMinor: number | null; key: string },
  ) {
    const opened = await inventory.openMaterial({
      name: options.name,
      unit: "kilogram",
      tracking: "tracked",
      opening: {
        quantityState: options.confirmed ? "confirmed" : "unconfirmed",
        quantityMilli: options.quantityMilli,
        costState: options.valueMinor !== null ? "known" : "unknown",
        valueMinor: options.valueMinor,
        confirmedOn: options.confirmed ? "2026-09-01" : null,
        sourceNote: null,
      },
      note: "رصيد",
      operationKey: options.key,
    });
    if (!opened.ok) throw new Error(opened.message);
    return opened.value.material.id;
  }

  it("separates tracked from cost-only materials with honest knowledge states", async () => {
    const store = new MemoryLocalStore();
    const { inventory } = makeContext(store);
    await seedMaterial(inventory, {
      name: "سكر",
      confirmed: true,
      quantityMilli: 20000,
      valueMinor: 12000,
      key: "g2-sugar",
    });
    await inventory.openMaterial({
      name: "أكياس تغليف",
      unit: "piece",
      tracking: "untracked",
      opening: {
        quantityState: "unconfirmed",
        quantityMilli: null,
        costState: "unknown",
        valueMinor: null,
        confirmedOn: null,
        sourceNote: null,
      },
      note: "للتكلفة",
      operationKey: "g2-bags",
    });
    renderWithHarness(<InventoryMaterials />, store);
    expect(await screen.findByTestId("tracked-material-سكر")).toBeTruthy();
    expect(screen.getByTestId("untracked-material-أكياس تغليف")).toBeTruthy();
    expect(screen.getByText("للتكلفة فقط")).toBeTruthy();
    expect(screen.getByText("بلا رصيد متبع")).toBeTruthy();
  });
  it("shows «غير محدد بعد» with a dash for an unconfirmed opening, and a confirm action", async () => {
    const store = new MemoryLocalStore();
    const { inventory } = makeContext(store);
    await seedMaterial(inventory, {
      name: "دقيق",
      confirmed: false,
      quantityMilli: null,
      valueMinor: null,
      key: "g2-flour",
    });
    renderWithHarness(<InventoryMaterials />, store);
    const row = await screen.findByTestId("tracked-material-دقيق");
    expect(row.textContent).toContain("غير محدد بعد");
    const confirm = screen.getByText("أكّد الرصيد");
    fireEvent.click(confirm);
    expect(wouterState.navigate).toHaveBeenCalledWith(
      expect.stringMatching(/\/inventory\/material\/[^/]+\/confirm\?from=/),
    );
  });
  it("untracking states the four consequences, cancels safely, then confirms and moves the row", async () => {
    const store = new MemoryLocalStore();
    const { inventory } = makeContext(store);
    const materialId = await seedMaterial(inventory, {
      name: "قماش",
      confirmed: true,
      quantityMilli: 3000,
      valueMinor: 1500,
      key: "g2-cloth",
    });
    renderWithHarness(<InventoryMaterials />, store);
    fireEvent.click(await screen.findByText("أوقف المتابعة"));
    const dialog = await screen.findByTestId("untrack-dialog");
    expect(dialog.textContent).toContain("أوقف متابعة قماش");
    expect(dialog.textContent).toContain("لا يُحذف شيء");
    expect(dialog.textContent).toContain("لن تظهر المادة في نماذج الاستلام والاستهلاك والهدر");
    expect(dialog.textContent).toContain("«غير محدد بعد» حتى تؤكده من جديد");
    /* الإلغاء الآمن: لا تغيير. */
    fireEvent.click(screen.getByText("إلغاء"));
    expect(screen.queryByTestId("untrack-dialog")).toBeNull();
    expect(screen.getByTestId("tracked-material-قماش")).toBeTruthy();
    fireEvent.click(screen.getByText("أوقف المتابعة"));
    fireEvent.click(await screen.findByText("أوقف المتابعة", { selector: "button.micro-button-danger" }));
    await waitFor(() =>
      expect(screen.getByTestId("untracked-material-قماش")).toBeTruthy(),
    );
    /* الحركات محفوظة — لا حذف. */
    const movements = await inventory.movements();
    if (!movements.ok) throw new Error(movements.message);
    expect(movements.value.length).toBeGreaterThanOrEqual(1);
    /* إعادة التفعيل متاحة من صف «للتكلفة فقط». */
    fireEvent.click(screen.getByText("فعّل المتابعة"));
    await waitFor(() => expect(screen.getByTestId("tracked-material-قماش")).toBeTruthy());
    const overview = await inventory.overview();
    if (!overview.ok) throw new Error(overview.message);
    const cloth = overview.value.materials.find(material => material.id === materialId);
    expect(cloth?.quantityKnowledge).toBe("unconfirmed");
  });
  it("discloses open shortages inside the material row and resolves them with a note", async () => {
    const store = new MemoryLocalStore();
    const { inventory } = makeContext(store);
    const materialId = await seedMaterial(inventory, {
      name: "مسمار",
      confirmed: true,
      quantityMilli: 6000,
      valueMinor: 2400,
      key: "g2-nails",
    });
    const shortage = await inventory.recordShortage({
      materialId,
      requestedQuantityMilli: 10000,
      orderId: null,
      occurredOn: "2026-09-05",
      note: "نقص لتجربة طلبي",
      operationKey: "g2-dom-shortage",
    });
    if (!shortage.ok) throw new Error(shortage.message);
    renderWithHarness(<InventoryMaterials />, store);
    const row = await screen.findByTestId("tracked-material-مسمار");
    expect(row.textContent).toContain("نقص مفتوح: 1");
    const details = await screen.findByTestId("shortage-details-مسمار");
    fireEvent.click(details.querySelector("summary") as HTMLElement);
    expect(details.textContent).toContain("نقص لتجربة طلبي");
    fireEvent.click(screen.getByText("سجّل الحل", { selector: "button" }));
    fireEvent.change(screen.getByLabelText("بيان الحل"), {
      target: { value: "استلمت بديلًا من المورد" },
    });
    fireEvent.click(screen.getByText("سجّل الحل", { selector: "button" }));
    await waitFor(() => {
      const detailsAfter = screen.getByTestId("shortage-details-مسمار");
      expect(detailsAfter.textContent).toContain("حُلّ");
    });
  });
});

describe("InventoryMovementEditor receipt bridge and shortage panel (المجموعة ٢ — عقد ٢٨)", () => {
  beforeEach(() => {
    wouterState.navigate.mockClear();
    wouterState.params = { type: "receipt" };
    wouterState.search = "";
    wouterState.path = "/inventory/movement/receipt";
    vi.clearAllMocks();
  });
  afterEach(() => cleanup());

  it("a ?purchase deep link prefills the purchase, its material, and the received/remaining card", async () => {
    const store = new MemoryLocalStore();
    const { inventory } = makeContext(store);
    const opened = await inventory.openMaterial({
      name: "خشب",
      unit: "piece",
      tracking: "tracked",
      opening: {
        quantityState: "unconfirmed",
        quantityMilli: null,
        costState: "unknown",
        valueMinor: null,
        confirmedOn: null,
        sourceNote: null,
      },
      note: "بلا رصيد",
      operationKey: "g2-bridge-wood",
    });
    if (!opened.ok) throw new Error(opened.message);
    await store.saveSupplierPurchase(
      createSupplierPurchase({
        id: "g2-bridge-purchase",
        supplierName: "مورد الخشب",
        note: "خشب زان",
        purchasedOn: "2026-09-02",
        dueOn: null,
        totalMinor: 10000,
        initialPaidMinor: 0,
        recordedAt: "2026-09-02T00:00:00.000Z",
        idempotencyKey: "g2-bridge-key",
        materialId: opened.value.material.id,
        expectedQuantityMilli: 10000,
      }),
    );
    wouterState.search = `purchase=g2-bridge-purchase&from=/suppliers/purchase/g2-bridge-purchase`;
    renderWithHarness(<InventoryMovementEditor />, store);
    await waitFor(() => expect(screen.queryByText("جارٍ فتح حركة المادة…")).toBeNull());
    const statusCard = await screen.findByTestId("receipt-status-card");
    expect(statusCard.textContent).toContain("قيمة مستلمة");
    expect(statusCard.textContent).toContain("كمية مستلمة");
    expect(statusCard.textContent).toContain("10");
    /* التعبئة المسبقة لا تكتب شيئًا — الحفظ فعل صريح. */
    const movements = await inventory.movements();
    if (!movements.ok) throw new Error(movements.message);
    expect(movements.value).toHaveLength(0);
  });
  it("consume mode asks for the target, and a shortage offer appears when quantity exceeds the position", async () => {
    const store = new MemoryLocalStore();
    const { inventory } = makeContext(store);
    const opened = await inventory.openMaterial({
      name: "سكر",
      unit: "kilogram",
      tracking: "tracked",
      opening: {
        quantityState: "confirmed",
        quantityMilli: 6000,
        costState: "known",
        valueMinor: 2400,
        confirmedOn: "2026-09-01",
        sourceNote: null,
      },
      note: "رصيد",
      operationKey: "g2-shortage-wood",
    });
    if (!opened.ok) throw new Error(opened.message);
    wouterState.params = { type: "consume" };
    wouterState.path = "/inventory/movement/consume";
    renderWithHarness(<InventoryMovementEditor />, store);
    await waitFor(() => expect(screen.queryByText("جارٍ فتح حركة المادة…")).toBeNull());
    expect(screen.getByTestId("consume-target-question")).toBeTruthy();
    fireEvent.click(screen.getByText("لعمل المشروع"));
    fireEvent.change(screen.getByLabelText("كمية حركة المادة"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("بيان مختصر"), { target: { value: "استهلاك المتاح والباقي نقص" } });
    await screen.findByTestId("shortage-panel");
    expect(screen.getByText("الكمية المطلوبة أكبر من المتاحة")).toBeTruthy();
    expect(screen.getByText("سجّل نقصًا بدل الاستهلاك")).toBeTruthy();
    expect(screen.getByText("استهلك المتاح")).toBeTruthy();
    /* الحفظ الذري: استهلاك المتاح + نقص الباقي في معاملة واحدة. */
    fireEvent.click(screen.getByText("استهلك المتاح"));
    await waitFor(() => expect(wouterState.navigate).toHaveBeenCalled());
    const overview = await inventory.overview();
    if (!overview.ok) throw new Error(overview.message);
    expect(overview.value.materials[0]?.quantityMilli).toBe(0);
    expect(overview.value.materials[0]?.openShortageCount).toBe(1);
  });
});

/* ── SA-5 (F1/F6): تعبئة الجسر الرقمية + سطحا الجسر والمقترحات ── */
describe("Group 2 bridge prefill and remaining surfaces (SA-5 fixes)", () => {
  beforeEach(() => {
    wouterState.navigate.mockClear();
    wouterState.params = { type: "receipt" };
    wouterState.search = "";
    wouterState.path = "/inventory/movement/receipt";
    vi.clearAllMocks();
  });
  afterEach(() => cleanup());

  it("F1: a ?purchase deep link prefills the remaining quantity and value into the inputs", async () => {
    const store = new MemoryLocalStore();
    const { inventory } = makeContext(store);
    const opened = await inventory.openMaterial({
      name: "خشب",
      unit: "piece",
      tracking: "tracked",
      opening: {
        quantityState: "unconfirmed",
        quantityMilli: null,
        costState: "unknown",
        valueMinor: null,
        confirmedOn: null,
        sourceNote: null,
      },
      note: "بلا رصيد",
      operationKey: "f1-material",
    });
    if (!opened.ok) throw new Error(opened.message);
    await store.saveSupplierPurchase(
      createSupplierPurchase({
        id: "f1-purchase",
        supplierName: "مورد الخشب",
        note: "خشب زان",
        purchasedOn: "2026-09-02",
        dueOn: null,
        totalMinor: 10000,
        initialPaidMinor: 0,
        recordedAt: "2026-09-02T00:00:00.000Z",
        idempotencyKey: "f1-key",
        materialId: opened.value.material.id,
        expectedQuantityMilli: 10000,
      }),
    );
    await inventory.receivePurchase({
      materialId: opened.value.material.id,
      purchaseId: "f1-purchase",
      quantityMilli: 4000,
      valueMinor: 4000,
      occurredOn: "2026-09-03",
      note: "استلام أول",
      operationKey: "f1-receipt-1",
    });
    wouterState.search = "purchase=f1-purchase&from=/suppliers/purchase/f1-purchase";
    renderWithHarness(<InventoryMovementEditor />, store);
    await waitFor(() => expect(screen.queryByText("جارٍ فتح حركة المادة…")).toBeNull());
    await screen.findByTestId("receipt-status-card");
    /* التعبئة الرقمية: المتبقي 6000 وحدة و6000 د.أ في الحقول أنفسها. */
    await waitFor(() => {
      const quantityInput = screen.getByLabelText("كمية حركة المادة") as HTMLInputElement;
      expect(quantityInput.value).toBe("6");
    });
    await waitFor(() => {
      const valueInput = screen.getByLabelText("قيمة استلام الشراء") as HTMLInputElement;
      expect(valueInput.value).toBe("60");
    });
  });
});

describe("Group 2 supplier bridge card and estimate suggestions (SA-5 F6)", () => {
  beforeEach(() => {
    wouterState.navigate.mockClear();
    wouterState.params = { id: "g2-bridge-purchase" };
    wouterState.search = "";
    wouterState.path = "/suppliers/purchase/g2-bridge-purchase";
    vi.clearAllMocks();
  });
  afterEach(() => cleanup());

  it("F6: the purchase detail shows the received card with the bridge CTA and a safe return", async () => {
    const store = new MemoryLocalStore();
    const { inventory } = makeContext(store);
    const opened = await inventory.openMaterial({
      name: "سكر",
      unit: "kilogram",
      tracking: "tracked",
      opening: {
        quantityState: "unconfirmed",
        quantityMilli: null,
        costState: "unknown",
        valueMinor: null,
        confirmedOn: null,
        sourceNote: null,
      },
      note: "بلا رصيد",
      operationKey: "f6-material",
    });
    if (!opened.ok) throw new Error(opened.message);
    const purchaseResult = await store.saveSupplierPurchase(
      createSupplierPurchase({
        id: "g2-bridge-purchase",
        supplierName: "مورد السكر",
        note: "سكر أبيض",
        purchasedOn: "2026-09-02",
        dueOn: null,
        totalMinor: 9000,
        initialPaidMinor: 0,
        recordedAt: "2026-09-02T00:00:00.000Z",
        idempotencyKey: "f6-key",
        materialId: opened.value.material.id,
        expectedQuantityMilli: 15000,
      }),
    );
    if (!purchaseResult.ok) throw new Error(purchaseResult.message);
    /* سياق الخدمات: المحرر يقرأ supplierPurchases وinventory معًا. */
    const contextRef: { current: Record<string, unknown> } = { current: {} };
    const supplierPurchases = new SupplierPurchaseService(store, () => NOW);
    mockedUsePrototypeServices.mockImplementation(
      () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
    );
    function EditorHarness() {
      const [version, setVersion] = React.useState(0);
      contextRef.current = {
        supplierPurchases,
        inventory,
        dataVersion: version,
        notifyDataChanged: () => setVersion(current => current + 1),
      };
      return (
        <UnsavedChangesProvider navigate={wouterState.navigate}>
          <SupplierPurchaseEditor />
        </UnsavedChangesProvider>
      );
    }
    render(<EditorHarness />);
    const card = await screen.findByTestId("purchase-receipt-card");
    expect(card.textContent).toContain("قيمة مستلمة");
    expect(card.textContent).toContain("استُلمت");
    /* لا CTA قبل وجود متبقٍ: صفر استلام → «استُلمت قيمة هذا الشراء كاملة.» على
     * قيمة كاملة؟ المتبقي 9000 > 0 → CTA ظاهر مع رجوع آمن. */
    const cta = screen.getByText("استلم المواد في المخزون");
    fireEvent.click(cta);
    expect(wouterState.navigate).toHaveBeenCalledWith(
      expect.stringMatching(/\/inventory\/movement\/receipt\?purchase=g2-bridge-purchase&from=/),
    );
  });
  it("F6 (Scenario G): material suggestions fill the estimate row without creating any movement or event", async () => {
    const store = new MemoryLocalStore();
    const { inventory } = makeContext(store);
    const opened = await inventory.openMaterial({
      name: "خيط",
      unit: "meter",
      tracking: "tracked",
      opening: {
        quantityState: "confirmed",
        quantityMilli: 5000,
        costState: "known",
        valueMinor: 2000,
        confirmedOn: "2026-09-01",
        sourceNote: null,
      },
      note: "رصيد",
      operationKey: "f6-thread",
    });
    if (!opened.ok) throw new Error(opened.message);
    await store.saveSupplierPurchase(
      createSupplierPurchase({
        id: "f6-thread-purchase",
        supplierName: "مورد الخيط",
        note: "خيط",
        purchasedOn: "2026-09-02",
        dueOn: null,
        totalMinor: 2000,
        initialPaidMinor: 2000,
        recordedAt: "2026-09-02T00:00:00.000Z",
        idempotencyKey: "f6-thread-key",
        materialId: opened.value.material.id,
        expectedQuantityMilli: 5000,
      }),
    );
    const received = await inventory.receivePurchase({
      materialId: opened.value.material.id,
      purchaseId: "f6-thread-purchase",
      quantityMilli: 5000,
      valueMinor: 2000,
      occurredOn: "2026-09-03",
      note: "استلام كامل",
      operationKey: "f6-thread-receipt",
    });
    if (!received.ok) throw new Error(received.message);
    renderWithHarness(<MaterialSheet value={{ index: null, draft: EMPTY_DRAFT }} message={null} validity={{}} />, store);
    const chips = await screen.findByTestId("material-suggestions");
    expect(chips.textContent).toContain("خيط");
    fireEvent.click(screen.getByText(/خيط/));
    /* التقدير لا يستهلك مخزونًا ولا ينشئ حدثًا — الرصيد كما هو. */
    const overview = await inventory.overview();
    if (!overview.ok) throw new Error(overview.message);
    expect(overview.value.materials[0]?.quantityMilli).toBe(10000);
    const events = await store.listFinancialEvents();
    if (!events.ok) throw new Error(events.message);
    expect(events.value).toHaveLength(0);
  });
});

const EMPTY_DRAFT: DraftCostMaterial = {
  name: "",
  quantity: 1,
  unit: "متر",
  unitPriceMinor: 0,
  confidence: "estimated",
};
