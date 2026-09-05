/** @vitest-environment jsdom */
/* المجموعة ٢ — قراءات أسطح المخزون: رحلة المادة الموجهة، أقسام المتابعة،
 * حوار إيقاف المتابعة وعواقبه، إفصاح النقص وحلّه، جسر الاستلام بمعاينة
 * الحالة، سؤال وجهة الاستهلاك، وسطر هدر الفترة غير النقدي. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { AssetService } from "@/application/assets/assetService";
import { LoanService } from "@/application/loans/loanService";
import { RetainedDepositService } from "@/application/finance/retainedDepositService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { FormDraftService } from "@/application/drafts/formDraftService";
import MaterialEditor from "@/pages/MaterialEditor";
import InventoryMaterials from "@/pages/InventoryMaterials";
import InventoryMovementEditor from "@/pages/InventoryMovementEditor";
import { createSupplierPurchase } from "@micro-domain/supplier-purchase/index.js";
import { SupplierPurchaseService } from "@/application/suppliers/supplierPurchaseService";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import SupplierPurchaseEditor from "@/pages/SupplierPurchaseEditor";
import CostEditor from "@/pages/CostEditor";
import Finance from "@/pages/Finance";
import { CorrectionHistoryService } from "@/application/finance/correctionHistoryService";
import { OwnerEntitlementService } from "@/application/finance/ownerEntitlementService";
import { G5Service } from "@/application/g5/g5Service";
import { FinancialPulseService } from "@/application/financial-pulse/financialPulseService";
import { FulfillmentService } from "@/application/fulfillment/fulfillmentService";
import type { OrderDraft } from "@/storage/local/types";

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
      formDrafts: new FormDraftService(store),
      inventory,
      dataVersion: version,
      notifyDataChanged: () => setVersion(current => current + 1),
    };
    return <UnsavedChangesProvider navigate={wouterState.navigate}>{node}</UnsavedChangesProvider>;
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
    options: {
      name: string;
      confirmed: boolean;
      quantityMilli: number | null;
      valueMinor: number | null;
      key: string;
    },
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
    await waitFor(() => expect(screen.getByTestId("untracked-material-قماش")).toBeTruthy());
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
    fireEvent.change(screen.getByLabelText("بيان مختصر"), {
      target: { value: "استهلاك المتاح والباقي نقص" },
    });
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
      /* حد إدخال المال قاعدة التطبيق: منزلتان دائمًا — 60.00 لا 60. */
      expect(valueInput.value).toBe("60.00");
    });
  });
});

/* ── SA-5 (F6): سياق محرر الشراء — الخدمتان الحقيقيتان فوق مخزن الذاكرة ── */
function renderPurchaseEditorHarness(store: MemoryLocalStore, inventory: InventoryMaterialService) {
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
      formDrafts: new FormDraftService(store),
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
}

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
    renderPurchaseEditorHarness(store, inventory);
    const card = await screen.findByTestId("purchase-receipt-card");
    expect(card.textContent).toContain("قيمة مستلمة");
    /* صفر استلام مع متبقٍ: سطر الكمية صادق، والفعل الظاهر هو الجسر. */
    expect(card.textContent).toContain("كمية مستلمة");
    const cta = screen.getByText("استلم المواد في المخزون");
    fireEvent.click(cta);
    expect(wouterState.navigate).toHaveBeenCalledWith(
      expect.stringMatching(/\/inventory\/movement\/receipt\?purchase=g2-bridge-purchase&from=/),
    );
  });
  it("F6: a fully received purchase states «استُلمت قيمة هذا الشراء كاملة.» and hides the bridge CTA", async () => {
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
      operationKey: "f6b-material",
    });
    if (!opened.ok) throw new Error(opened.message);
    await store.saveSupplierPurchase(
      createSupplierPurchase({
        id: "g2-bridge-purchase",
        supplierName: "مورد السكر",
        note: "سكر أبيض",
        purchasedOn: "2026-09-02",
        dueOn: null,
        totalMinor: 9000,
        initialPaidMinor: 0,
        recordedAt: "2026-09-02T00:00:00.000Z",
        idempotencyKey: "f6b-key",
        materialId: opened.value.material.id,
        expectedQuantityMilli: 15000,
      }),
    );
    const received = await inventory.receivePurchase({
      materialId: opened.value.material.id,
      purchaseId: "g2-bridge-purchase",
      quantityMilli: 15000,
      valueMinor: 9000,
      occurredOn: "2026-09-03",
      note: "استلام كامل",
      operationKey: "f6b-receipt",
    });
    if (!received.ok) throw new Error(received.message);
    renderPurchaseEditorHarness(store, inventory);
    const card = await screen.findByTestId("purchase-receipt-card");
    expect(card.textContent).toContain("استُلمت قيمة هذا الشراء كاملة.");
    /* منع الاستلام المكرر بالحالة لا بالنسخ: لا فعل جسر بعد اكتمال الاستلام. */
    expect(screen.queryByText("استلم المواد في المخزون")).toBeNull();
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
    const movementsBefore = await inventory.movements();
    if (!movementsBefore.ok) throw new Error(movementsBefore.message);
    /* السطح الحقيقي (السيناريو G): محرر التكلفة يشتق المقترحات من المخزن نفسه
     * عبر الخدمة الحقيقية — التعبئة بلمسة، والحفظ وحده يوثّق بندًا. */
    const contextRef: { current: Record<string, unknown> } = { current: {} };
    const drafts = {
      get: vi.fn().mockResolvedValue({ ok: true, value: G2_COST_DRAFT }),
    };
    const costs = {
      preview: vi.fn().mockReturnValue({
        ok: true,
        snapshot: {
          knowledgeState: "incomplete",
          priceFloorMinor: null,
          unitCostMinor: null,
          knowledgeGaps: [{ id: "time_incomplete", mandatory: true }],
        },
      }),
      saveSnapshot: vi.fn(),
    };
    mockedUsePrototypeServices.mockImplementation(
      () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
    );
    wouterState.params = { id: G2_COST_DRAFT.id };
    wouterState.path = `/orders/draft/${G2_COST_DRAFT.id}/cost`;
    function CostHarness() {
      const [version, setVersion] = React.useState(0);
      contextRef.current = {
        drafts,
        costs,
        inventory,
        dataVersion: version,
        notifyDataChanged: () => setVersion(current => current + 1),
      };
      return (
        <UnsavedChangesProvider navigate={wouterState.navigate}>
          <CostEditor />
        </UnsavedChangesProvider>
      );
    }
    render(<CostHarness />);
    fireEvent.click(await screen.findByRole("button", { name: "إضافة مادة" }));
    const chips = await screen.findByTestId("material-suggestions");
    /* المصدر صادق: السعر من آخر استلام غير معكوس — 2000 د.أ على 5 متر = 4.00. */
    expect(chips.textContent).toContain("خيط");
    expect(chips.textContent).toContain("4.00");
    fireEvent.click(screen.getByRole("button", { name: /خيط/ }));
    /* التعبئة في الحقول أنفسها — بلا أي كتابة مخزون. */
    expect((screen.getByLabelText("المادة") as HTMLInputElement).value).toBe("خيط");
    expect((screen.getByLabelText("الوحدة") as HTMLInputElement).value).toBe("متر");
    expect((screen.getByLabelText(/تكلفة الوحدة/) as HTMLInputElement).value).toBe("4.00");
    expect((screen.getByLabelText("حالة الرقم") as HTMLSelectElement).value).toBe("known");
    fireEvent.click(screen.getByText("حفظ بند المادة"));
    expect(await screen.findByRole("button", { name: "تعديل مادة خيط" })).toBeTruthy();
    /* التقدير لا يستهلك مخزونًا ولا ينشئ حدثًا — الرصيد والحركات كما هي. */
    const overview = await inventory.overview();
    if (!overview.ok) throw new Error(overview.message);
    expect(overview.value.materials[0]?.quantityMilli).toBe(10000);
    const movementsAfter = await inventory.movements();
    if (!movementsAfter.ok) throw new Error(movementsAfter.message);
    expect(movementsAfter.value).toHaveLength(movementsBefore.value.length);
    const events = await store.listFinancialEvents();
    if (!events.ok) throw new Error(events.message);
    expect(events.value).toHaveLength(0);
  });
});

/* ── SA-5 (F6): سطر هدر الفترة في مالي — غير نقدي، والمجهول لا يُعرض صفرًا واثقًا ── */
describe("Finance period waste row (المجموعة ٢ — عقد ٢٨)", () => {
  beforeEach(() => {
    wouterState.navigate.mockClear();
    wouterState.params = {};
    wouterState.search = "view=period";
    wouterState.path = "/finance";
    vi.clearAllMocks();
  });
  afterEach(() => cleanup());

  function renderFinanceHarness(store: MemoryLocalStore, inventory: InventoryMaterialService) {
    const projectFinance = new ProjectFinancialService(store, () => NOW);
    const contextRef: { current: Record<string, unknown> } = { current: {} };
    mockedUsePrototypeServices.mockImplementation(
      () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
    );
    function FinanceHarness() {
      const [version, setVersion] = React.useState(0);
      contextRef.current = {
        projectFinance,
        correctionHistory: new CorrectionHistoryService(store),
        ownerEntitlement: new OwnerEntitlementService(
          store,
          (from: string, to: string) => projectFinance.readRecordedPeriodResult(from, to),
          () => NOW,
        ),
        g5: new G5Service(store, projectFinance, () => NOW),
        financialPulse: new FinancialPulseService(store),
        fulfillment: new FulfillmentService(store, () => NOW),
        inventory,
        /* المجموعة ٤ (عقد ٢٩): خدمات الأصول والقروض والعربون فوق مخزن الذاكرة. */
        assets: new AssetService(store, () => NOW),
        loans: new LoanService(store, () => NOW),
        retainedDeposits: new RetainedDepositService(store, () => NOW),
        dataVersion: version,
        notifyDataChanged: () => setVersion(current => current + 1),
      };
      return <Finance />;
    }
    render(<FinanceHarness />);
  }

  it("shows the period's known-cost waste beside the period cost list as strictly non-cash", async () => {
    const store = new MemoryLocalStore();
    const { inventory } = makeContext(store);
    const opened = await inventory.openMaterial({
      name: "خيط",
      unit: "meter",
      tracking: "tracked",
      opening: {
        quantityState: "confirmed",
        quantityMilli: 4000,
        costState: "known",
        valueMinor: 1000,
        confirmedOn: "2026-09-01",
        sourceNote: null,
      },
      note: "رصيد",
      operationKey: "g2-finance-waste-material",
    });
    if (!opened.ok) throw new Error(opened.message);
    const wasted = await inventory.waste({
      materialId: opened.value.material.id,
      quantityMilli: 1000,
      occurredOn: "2026-09-03",
      note: "هدر قص",
      reason: "قص خاطئ",
      operationKey: "g2-finance-waste-1",
    });
    if (!wasted.ok) throw new Error(wasted.message);
    renderFinanceHarness(store, inventory);
    await waitFor(() => expect(screen.queryByText("جارٍ قراءة الوضع المالي المحلي…")).not.toBeTruthy());
    const label = await screen.findByText("هدر مخزون هذه الفترة");
    const row = label.closest("div");
    expect(row?.textContent).toContain("2.50");
    expect(row?.textContent).toContain("لا يخرج كاش ولا يدخل نتيجة الفترة");
    expect(row?.textContent).not.toContain("غير معروفة بعد");
    /* الهدر حركة مخزون لا حدث نقدي — الكاش والنتيجة لا يتأثران. */
    const events = await store.listFinancialEvents();
    if (!events.ok) throw new Error(events.message);
    expect(events.value).toHaveLength(0);
  });

  it("shows unknown-cost waste as «قيمة الهدر غير معروفة بعد» — never a confident 0.00", async () => {
    const store = new MemoryLocalStore();
    const { inventory } = makeContext(store);
    const opened = await inventory.openMaterial({
      name: "غراء",
      unit: "liter",
      tracking: "tracked",
      opening: {
        quantityState: "confirmed",
        quantityMilli: 2000,
        costState: "unknown",
        valueMinor: 0,
        confirmedOn: "2026-09-01",
        sourceNote: null,
      },
      note: "رصيد بتكلفة غير معروفة",
      operationKey: "g2-finance-waste-unknown",
    });
    if (!opened.ok) throw new Error(opened.message);
    const wasted = await inventory.waste({
      materialId: opened.value.material.id,
      quantityMilli: 500,
      occurredOn: "2026-09-03",
      note: "هدر انسكاب",
      reason: "انسكاب",
      operationKey: "g2-finance-waste-2",
    });
    if (!wasted.ok) throw new Error(wasted.message);
    renderFinanceHarness(store, inventory);
    await waitFor(() => expect(screen.queryByText("جارٍ قراءة الوضع المالي المحلي…")).not.toBeTruthy());
    const label = await screen.findByText("هدر مخزون هذه الفترة");
    const row = label.closest("div");
    expect(row?.textContent).toContain("قيمة الهدر غير معروفة بعد");
    expect(row?.textContent).toContain("لا يخرج كاش ولا يدخل نتيجة الفترة");
    expect(row?.textContent).not.toContain("0.00");
  });
});

const G2_COST_DRAFT: OrderDraft = {
  id: "g2-cost-draft",
  intent: "customer_order",
  customerName: "",
  itemName: "قطعة اختبار",
  catalogItemId: null,
  specifications: "",
  quantity: 1,
  costSnapshots: [],
  activeCostSnapshotId: null,
  linkedOrderId: null,
  createdAt: "2026-09-02T08:00:00.000Z",
  updatedAt: "2026-09-02T08:00:00.000Z",
};
