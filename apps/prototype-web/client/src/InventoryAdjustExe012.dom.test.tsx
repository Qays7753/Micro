/** @vitest-environment jsdom */
/** EXE-012 (AUD-NEW-06): ضبط المخزون الموثق — مدخل صريح من صفحة المخزون
 * بخطوة واحدة مفصول عن الهدر (اسم/سبب/أثر)، قرار مالك موثق بسبب إلزامي،
 * زيادة ونقص صريحان، المجهول لا يصير صفرًا واثقًا، والعكس يعيد الكمية بلا
 * حذف الحركة الأصلية، وإعادة الإرسال لا تضاعف (operationKey). */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { FormDraftService } from "@/application/drafts/formDraftService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import InventoryMaterials from "@/pages/InventoryMaterials";
import InventoryMovementEditor from "@/pages/InventoryMovementEditor";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/inventory",
  params: {} as Record<string, string | undefined>,
  search: "",
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => wouterMocks.params,
  useSearch: () => wouterMocks.search,
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-09-16T12:00:00.000Z";

let store: MemoryLocalStore;
const contextRef: { current: Record<string, unknown> } = { current: {} };

function Harness({ page }: { page: React.ReactNode }) {
  const [version, setVersion] = React.useState(0);
  contextRef.current = {
    inventory: new InventoryMaterialService(store, () => NOW),
    formDrafts: new FormDraftService(store),
    dataVersion: version,
    notifyDataChanged: () => setVersion(current => current + 1),
  };
  return <UnsavedChangesProvider navigate={wouterMocks.navigate}>{page}</UnsavedChangesProvider>;
}

mockedUsePrototypeServices.mockImplementation(
  () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
);

async function seedTrackedMaterial(name: string, quantityMilli: number): Promise<string> {
  const inventory = new InventoryMaterialService(store, () => NOW);
  const opened = await inventory.openMaterial({
    name,
    unit: "meter",
    tracking: "tracked",
    opening: {
      quantityState: "confirmed",
      quantityMilli,
      costState: "known",
      valueMinor: 1600,
      confirmedOn: "2026-09-01",
      sourceNote: null,
    },
    note: "رصيد معلوم",
    operationKey: `exe012-${name}`,
  });
  if (!opened.ok) throw new Error(opened.message);
  return opened.value.material.id;
}

describe("EXE-012 documented inventory adjustment (AUD-NEW-06)", () => {
  beforeEach(() => {
    wouterMocks.navigate.mockClear();
    wouterMocks.params = {};
    wouterMocks.location = "/inventory";
    wouterMocks.search = "";
    vi.clearAllMocks();
    store = new MemoryLocalStore();
  });
  afterEach(() => cleanup());

  it("the inventory page offers a distinct owner-action adjust entry separate from waste", async () => {
    await seedTrackedMaterial("قماش", 4000);
    render(<Harness page={<InventoryMaterials />} />);
    const adjustEntry = await screen.findByTestId("inventory-adjust-entry");
    expect(adjustEntry.textContent).toContain("ضبط جرد");
    expect(adjustEntry.textContent).toContain("قرار مالك");
    /* فصل الاسم: زر الهدر مستقل بمعناه الخاص. */
    const wasteEntry = screen.getByRole("button", { name: /هدر مادة/ });
    expect(wasteEntry).not.toBe(adjustEntry);
    fireEvent.click(adjustEntry);
    await waitFor(() => {
      expect(wouterMocks.navigate).toHaveBeenCalledWith("/inventory/movement/adjust?returnTo=%2Finventory");
    });
  });

  it("an increase adjustment with unknown cost records a marked movement — never a confident zero, never waste", async () => {
    const materialId = await seedTrackedMaterial("قماش", 4000);
    wouterMocks.params = { type: "adjust" };
    wouterMocks.location = "/inventory/movement/adjust";
    wouterMocks.search = `?material=${encodeURIComponent(materialId)}`;
    render(<Harness page={<InventoryMovementEditor />} />);
    /* الوصلة العميقة تعبّئ المادة الصحيحة — لا اختيار أول سجل. */
    await waitFor(() => {
      expect((screen.getByLabelText("المادة") as HTMLSelectElement).value).toBe(materialId);
    });
    fireEvent.change(screen.getByLabelText("اتجاه الضبط"), { target: { value: "increase" } });
    fireEvent.click(screen.getByLabelText(/لا، غير معروفة بعد/));
    const quantity = screen.getByLabelText("كمية حركة المادة");
    fireEvent.change(quantity, { target: { value: "2" } });
    fireEvent.blur(quantity);
    fireEvent.change(screen.getByLabelText("السبب"), { target: { value: "جرد فعلي أعلى من المسجل" } });
    fireEvent.change(screen.getByLabelText("بيان مختصر"), { target: { value: "فرق جرد إيجابي" } });
    fireEvent.click(screen.getByRole("button", { name: /حفظ حركة المادة/ }));
    await waitFor(() => {
      expect(wouterMocks.navigate).toHaveBeenCalled();
    });
    const inventory = new InventoryMaterialService(store, () => NOW);
    const overview = await inventory.overview();
    if (!overview.ok) throw new Error(overview.message);
    expect(overview.value.materials[0]?.quantityMilli).toBe(6000);
    const movements = await store.listInventoryMovements();
    if (!movements.ok) throw new Error(movements.message);
    const adjustment = movements.value.find(movement => movement.type === "adjustment");
    expect(adjustment).toBeTruthy();
    expect(adjustment?.quantityDeltaMilli).toBe(2000);
    /* المجهول موسوم — لا يتحول إلى صفر تكلفة واثق. */
    expect(adjustment?.costKnowledge).toBe("unknown");
    /* الضبط ليس هدرًا: لا حركة هدر إطلاقًا في هذه الرحلة. */
    expect(movements.value.filter(movement => movement.type === "waste")).toHaveLength(0);
  });

  it("a decrease adjustment with a reason then its documented reversal restore the quantity without deleting history", async () => {
    const materialId = await seedTrackedMaterial("سلك نحاسي", 5000);
    const inventory = new InventoryMaterialService(store, () => NOW);
    const adjusted = await inventory.adjust({
      materialId,
      quantityDeltaMilli: -1000,
      valueMinorWhenIncrease: null,
      increaseCostKnowledge: "known",
      occurredOn: "2026-09-16",
      note: "فرق جرد سالب",
      reason: "جرد فعلي أقل من المسجل",
      operationKey: "exe012-decrease",
    });
    if (!adjusted.ok) throw new Error(adjusted.message);
    /* إعادة الإرسال بالمفتاح نفسه لا تضاعف الأثر. */
    const replay = await inventory.adjust({
      materialId,
      quantityDeltaMilli: -1000,
      valueMinorWhenIncrease: null,
      increaseCostKnowledge: "known",
      occurredOn: "2026-09-16",
      note: "فرق جرد سالب",
      reason: "جرد فعلي أقل من المسجل",
      operationKey: "exe012-decrease",
    });
    expect(replay).toMatchObject({ ok: true, reused: true });
    let overview = await inventory.overview();
    if (!overview.ok) throw new Error(overview.message);
    expect(overview.value.materials[0]?.quantityMilli).toBe(4000);
    /* العكس الموثق يعيد الكمية ويبقي الحركة الأصلية في السجل. */
    const reversed = await inventory.reverse({
      movementId: adjusted.value.id,
      reason: "خطأ في قراءة الجرد",
      occurredOn: "2026-09-16",
      operationKey: "exe012-reverse",
    });
    if (!reversed.ok) throw new Error(reversed.message);
    overview = await inventory.overview();
    if (!overview.ok) throw new Error(overview.message);
    expect(overview.value.materials[0]?.quantityMilli).toBe(5000);
    const movements = await store.listInventoryMovements();
    if (!movements.ok) throw new Error(movements.message);
    expect(movements.value.some(movement => movement.id === adjusted.value.id)).toBe(true);
    expect(movements.value.some(movement => movement.type === "reversal")).toBe(true);
  });

  it("the adjust page states the owner-action positioning and the waste separation", async () => {
    await seedTrackedMaterial("قماش", 4000);
    wouterMocks.params = { type: "adjust" };
    wouterMocks.location = "/inventory/movement/adjust";
    wouterMocks.search = "";
    render(<Harness page={<InventoryMovementEditor />} />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: /اضبط كمية مادة/ })).toBeTruthy();
    });
    expect(screen.getByText(/ضبط الجرد قرار مالك موثق بسبب إلزامي/)).toBeTruthy();
    expect(screen.getByText(/الضبط ليس هدرًا/)).toBeTruthy();
  });
});
