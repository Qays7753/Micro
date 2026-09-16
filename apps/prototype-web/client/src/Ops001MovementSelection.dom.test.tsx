/** @vitest-environment jsdom */
/* OPS-001 — منع الاختيار الصامت لأول سجل في محرر حركة المخزون:
 * لا تعيين مسبق إلا من وصلة عميقة صالحة أو سياق صريح؛ المعرّف الغائب يبدأ
 * بلا اختيار، والمعرّف غير الصالح يُعلن برسالة ولا يُعوّض بسجل آخر،
 * والحركة لا تُكتب إلا باختيار صريح وحفظ مؤكد. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { FormDraftService } from "@/application/drafts/formDraftService";
import InventoryMovementEditor from "@/pages/InventoryMovementEditor";
import { calculateCostSnapshot, createCraftOrder } from "@micro-domain/craft-order/index.js";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import type { StoredCraftOrder } from "@/storage/local/types";

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

function makeInventory(store: MemoryLocalStore) {
  return new InventoryMaterialService(store, () => NOW);
}

function renderWithHarness(node: React.ReactNode, store: MemoryLocalStore) {
  const inventory = makeInventory(store);
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

async function seedWorld(store: MemoryLocalStore): Promise<{ firstMaterialId: string; orderId: string }> {
  const inventory = makeInventory(store);
  const first = await inventory.openMaterial({
    name: "خشب",
    unit: "piece",
    tracking: "tracked",
    opening: {
      quantityState: "confirmed",
      quantityMilli: 5000,
      costState: "known",
      valueMinor: 2500,
      confirmedOn: "2026-09-01",
      sourceNote: null,
    },
    note: "رصيد أول",
    operationKey: "ops001-material-1",
  });
  if (!first.ok) throw new Error(first.message);
  const second = await inventory.openMaterial({
    name: "قصدير",
    unit: "kilogram",
    tracking: "tracked",
    opening: {
      quantityState: "confirmed",
      quantityMilli: 3000,
      costState: "known",
      valueMinor: 900,
      confirmedOn: "2026-09-01",
      sourceNote: null,
    },
    note: "رصيد ثانٍ",
    operationKey: "ops001-material-2",
  });
  if (!second.ok) throw new Error(second.message);
  const cost = calculateCostSnapshot("ops001-cost", {
    currency: "JOD",
    source: "draft",
    materialItems: [],
    time: { minutes: 30, hourlyRateMinor: 500, confidence: "known" },
    packagingMinor: 0,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 1,
    createdAt: NOW,
    freshnessDays: null,
  });
  const order = createCraftOrder({
    id: "ops001-order-1",
    customerName: "سارة",
    itemName: "قطعة",
    specifications: "طلب اختبار",
    quantity: 1,
    agreedPriceMinor: 2000,
    costSnapshot: cost,
    createdAt: NOW,
  });
  const stored: StoredCraftOrder = {
    id: order.id,
    order,
    catalogItemId: null,
    deliveryDate: "2026-09-10",
    agreementSource: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
  const saved = await store.saveOrder(stored);
  if (!saved.ok) throw new Error(saved.message);
  return { firstMaterialId: first.value.material.id, orderId: order.id };
}

/* حركات الاستهلاك فقط — الرصيد الافتتاحي للمواد المزروعة ليس حركة محرر. */
async function consumptionCount(inventory: InventoryMaterialService): Promise<number> {
  const movements = await inventory.movements();
  if (!movements.ok) throw new Error(movements.message);
  return movements.value.filter(movement => movement.type === "consumption").length;
}

describe("OPS-001 — no silent first-record selection in the movement editor", () => {
  beforeEach(() => {
    wouterState.navigate.mockClear();
    wouterState.params = { type: "consume" };
    wouterState.search = "";
    wouterState.path = "/inventory/movement/consume";
    vi.clearAllMocks();
  });
  afterEach(() => cleanup());

  it("a missing identifier starts without any selection and blocks saving until an explicit choice", async () => {
    const store = new MemoryLocalStore();
    await seedWorld(store);
    const { inventory } = renderWithHarness(<InventoryMovementEditor />, store);
    await waitFor(() => expect(screen.queryByText("جارٍ فتح حركة المادة…")).toBeNull());
    const materialSelect = screen.getByLabelText("المادة") as HTMLSelectElement;
    expect(materialSelect.value).toBe("");
    expect(screen.getByText("اختر مادة…")).toBeTruthy();
    /* لا وصلة — لا رسالة مرجع مفقود أيضًا. */
    expect(screen.queryByTestId("movement-link-issue")).toBeNull();
    fireEvent.change(screen.getByLabelText("كمية حركة المادة"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("بيان مختصر"), { target: { value: "بيان" } });
    fireEvent.click(screen.getByText("حفظ حركة المادة"));
    expect(await screen.findByText("أدخل المادة والكمية والبيان بالأرقام 0–9 قبل الحفظ.")).toBeTruthy();
    expect(await consumptionCount(inventory)).toBe(0);
  });

  it("a valid order deep link preselects that order only", async () => {
    const store = new MemoryLocalStore();
    const { orderId } = await seedWorld(store);
    wouterState.search = `order=${orderId}`;
    const { inventory } = renderWithHarness(<InventoryMovementEditor />, store);
    await waitFor(() => expect(screen.queryByText("جارٍ فتح حركة المادة…")).toBeNull());
    const orderSelect = await screen.findByLabelText("الطلب الذي استهلك المادة");
    expect((orderSelect as HTMLSelectElement).value).toBe(orderId);
    expect(screen.queryByTestId("movement-link-issue")).toBeNull();
    expect(await consumptionCount(inventory)).toBe(0);
  });

  it("an invalid order identifier announces the missing reference and never falls back to another record", async () => {
    const store = new MemoryLocalStore();
    const { orderId } = await seedWorld(store);
    wouterState.search = "order=ops001-order-deleted";
    renderWithHarness(<InventoryMovementEditor />, store);
    await waitFor(() => expect(screen.queryByText("جارٍ فتح حركة المادة…")).toBeNull());
    const issue = await screen.findByTestId("movement-link-issue");
    expect(issue.textContent).toContain("لم نجد المرجع المطلوب في الوصلة");
    const orderSelect = screen.getByLabelText("الطلب الذي استهلك المادة") as HTMLSelectElement;
    expect(orderSelect.value).toBe("");
    expect(orderSelect.value).not.toBe(orderId);
    fireEvent.click(screen.getByText("حفظ حركة المادة"));
    expect(await screen.findByText("أدخل المادة والكمية والبيان بالأرقام 0–9 قبل الحفظ.")).toBeTruthy();
  });

  it("an unlinked movement is permitted for consume-project with a note, and blocked for consume-order without a choice", async () => {
    const store = new MemoryLocalStore();
    const { firstMaterialId } = await seedWorld(store);
    const { inventory } = renderWithHarness(<InventoryMovementEditor />, store);
    await waitFor(() => expect(screen.queryByText("جارٍ فتح حركة المادة…")).toBeNull());
    /* الهدف «طلب محدد» بلا اختيار — ممنوع. */
    fireEvent.change(screen.getByLabelText("المادة"), { target: { value: firstMaterialId } });
    fireEvent.change(screen.getByLabelText("كمية حركة المادة"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("بيان مختصر"), { target: { value: "بيان صريح" } });
    fireEvent.click(screen.getByText("حفظ حركة المادة"));
    expect(await screen.findByText("اختر طلبًا موجودًا لاستهلاك المادة.")).toBeTruthy();
    expect(await consumptionCount(inventory)).toBe(0);
    /* الهدف «لعمل المشروع» ببيان — مسموح صراحة. */
    fireEvent.click(screen.getByText("لعمل المشروع"));
    fireEvent.click(screen.getByText("حفظ حركة المادة"));
    await waitFor(() => expect(wouterState.navigate).toHaveBeenCalled());
    expect(await consumptionCount(inventory)).toBe(1);
  });

  it("reopening (remount) with the same missing context still starts without a selection", async () => {
    const store = new MemoryLocalStore();
    await seedWorld(store);
    const first = renderWithHarness(<InventoryMovementEditor />, store);
    await waitFor(() => expect(screen.queryByText("جارٍ فتح حركة المادة…")).toBeNull());
    expect((screen.getByLabelText("المادة") as HTMLSelectElement).value).toBe("");
    cleanup();
    renderWithHarness(<InventoryMovementEditor />, first.store);
    await waitFor(() => expect(screen.queryByText("جارٍ فتح حركة المادة…")).toBeNull());
    expect((screen.getByLabelText("المادة") as HTMLSelectElement).value).toBe("");
    expect(await consumptionCount(first.inventory)).toBe(0);
  });
});
