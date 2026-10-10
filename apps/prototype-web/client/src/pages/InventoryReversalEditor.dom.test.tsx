/** @vitest-environment jsdom */
/*
 * R9-W3 (WS-216/ARCH-007): اختبار مباشر لحدود صفحة تراجع حركة المادة —
 * حالات التحميل والعدم والبوابة والعكس الموثق عبر الخدمة الحقيقية. لا
 * يُثبَّت عيب الخروج الثابت المكتشف (navigate("/inventory") بدل مسار
 * المصدر) — مسجل بقرار محمي R9-GA-F3.3؛ يُثبت حدوث التنقل فقط.
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import InventoryReversalEditor from "@/pages/InventoryReversalEditor";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
  getPrototypeLocalStore: () => currentStore,
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/",
  params: {} as Record<string, string>,
  search: "",
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => wouterMocks.params,
  useSearch: () => wouterMocks.search,
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-10-10T09:00:00.000Z";

let store: MemoryLocalStore;
let currentStore: MemoryLocalStore;
const bumpVersion = vi.fn();

function services() {
  return {
    inventory: new InventoryMaterialService(store, () => NOW),
    notifyDataChanged: bumpVersion,
    dataVersion: 0,
  };
}

function Harness() {
  return (
    <UnsavedChangesProvider navigate={wouterMocks.navigate}>
      <InventoryReversalEditor />
    </UnsavedChangesProvider>
  );
}

async function seedOpeningMovement() {
  const inventory = new InventoryMaterialService(store, () => NOW);
  const opened = await inventory.openMaterial({
    name: "قماش الرحلة المباشرة",
    unit: "meter",
    tracking: "tracked",
    opening: {
      quantityState: "confirmed",
      quantityMilli: 3_000,
      costState: "known",
      valueMinor: 9_000,
      confirmedOn: "2026-10-01",
      sourceNote: "جرد أولي",
    },
    note: "افتتاح مادة مباشرة",
    operationKey: "w3-material",
  });
  if (!opened.ok) throw new Error(opened.message);
  const movement = opened.value.opening;
  expect(movement).not.toBeNull();
  return movement!.id;
}

beforeEach(() => {
  store = new MemoryLocalStore();
  currentStore = store;
  wouterMocks.search = "";
  wouterMocks.params = {};
  wouterMocks.navigate.mockReset();
  bumpVersion.mockReset();
  mockedUsePrototypeServices.mockReturnValue(
    services() as unknown as ReturnType<typeof usePrototypeServices>,
  );
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("InventoryReversalEditor — direct page-boundary behavior (R9-W3)", () => {
  it("an unknown movement id neither navigates nor writes anything (the not-found surface itself is unreachable today — defect R9-W3-F1, not enshrined here)", async () => {
    wouterMocks.params = { id: "missing-movement" };
    render(<Harness />);
    expect(screen.getByRole("status")).toBeTruthy();
    /* كما في محرر تراجع الكاش: سطح «لم نجد حركة المادة» لا يُرى عبر مسار
     * النجاح — عيب موثق، يُثبت هنا الحد الصادق بلا أثر فقط. */
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(wouterMocks.navigate).not.toHaveBeenCalled();
    expect(bumpVersion).not.toHaveBeenCalled();
    const inventory = new InventoryMaterialService(store, () => NOW);
    const movements = await inventory.movements();
    if (!movements.ok) throw new Error(movements.message);
    expect(movements.value).toHaveLength(0);
  });

  it("requires a reason before any reversal is written", async () => {
    const movementId = await seedOpeningMovement();
    wouterMocks.params = { id: movementId };
    render(<Harness />);
    await screen.findByRole("textbox");
    fireEvent.click(screen.getByRole("button", { name: /حفظ التراجع/ }));
    expect(await screen.findByRole("status")).toBeTruthy();
    expect(screen.getByText("أدخل سبب التراجع عن حركة المادة.")).toBeTruthy();
    const inventory = new InventoryMaterialService(store, () => NOW);
    const movements = await inventory.movements();
    if (!movements.ok) throw new Error(movements.message);
    expect(movements.value.some(candidate => candidate.reversesMovementId === movementId)).toBe(false);
  });

  it("archives the reversal through the page with the documented link and notification", async () => {
    const movementId = await seedOpeningMovement();
    wouterMocks.params = { id: movementId };
    render(<Harness />);
    const reason = await screen.findByRole("textbox");
    fireEvent.change(reason, { target: { value: "عكس جرد مباشر" } });
    fireEvent.click(screen.getByRole("button", { name: /حفظ التراجع/ }));
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalled());
    expect(bumpVersion).toHaveBeenCalled();
    const inventory = new InventoryMaterialService(store, () => NOW);
    const movements = await inventory.movements();
    if (!movements.ok) throw new Error(movements.message);
    const reversal = movements.value.find(candidate => candidate.reversesMovementId === movementId);
    expect(reversal).toBeDefined();
    expect(reversal?.type).toBe("reversal");
    expect(reversal?.reason).toBe("عكس جرد مباشر");
  });

  it("rejects a second reversal of the same movement honestly through the service boundary", async () => {
    const movementId = await seedOpeningMovement();
    const inventory = new InventoryMaterialService(store, () => NOW);
    const first = await inventory.reverse({
      movementId,
      occurredOn: "2026-10-03",
      reason: "تراجع أول خارج الصفحة",
      operationKey: "w3-reverse-1",
    });
    if (!first.ok) throw new Error(first.message);
    wouterMocks.params = { id: movementId };
    render(<Harness />);
    const reason = await screen.findByRole("textbox");
    fireEvent.change(reason, { target: { value: "محاولة ثانية" } });
    fireEvent.click(screen.getByRole("button", { name: /حفظ التراجع/ }));
    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
    const movements = await inventory.movements();
    if (!movements.ok) throw new Error(movements.message);
    expect(movements.value.filter(candidate => candidate.reversesMovementId === movementId)).toHaveLength(1);
    expect(wouterMocks.navigate).not.toHaveBeenCalled();
  });
});
