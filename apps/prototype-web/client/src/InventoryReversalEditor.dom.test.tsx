/** @vitest-environment jsdom */
/*
 * R9-W3 (WS-216/ARCH-007): اختبار مباشر لحدود صفحة تراجع حركة المادة —
 * حالات التحميل والعدم والبوابة والعكس الموثق عبر الخدمة الحقيقية.
 * R9 استمرار (R9-GA-F3.2/.3/.5 + R9-W3-F1): آلة حالة القراءة الصريحة
 * أصبحت منفذة — سطح «لم نجد» يُختبر الآن عبر مسار النجاح، وفشل القراءة
 * يُعرض برسالته الفعلية مع إعادة محاولة، والخروج بعد الحفظ يعود للمصدر
 * (?returnTo) وفق عقد ٢٦ قاعدة ٣ مع البديل القانوني، ورسائل الخطأ
 * تُعلن بصفة alert.
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

/* R9-GA-F3.2 (اختبار فشل القراءة): مخزن حقيقي فوق MemoryLocalStore يُفشل
 * قراءة الحركات مرة واحدة برسالة الخدمة الفعلية نفسها، ثم ينجح عند
 * إعادة المحاولة — العلم داخل الاختبار وحده لا في الصفحة. */
class FailingMovementsReadStore extends MemoryLocalStore {
  failReads = true;
  override async listInventoryMovements() {
    if (this.failReads)
      return {
        ok: false as const,
        code: "storage_error" as const,
        message: "تعذر قراءة حركات المواد المحلية.",
      };
    return super.listInventoryMovements();
  }
}

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

describe("InventoryReversalEditor — direct page-boundary behavior (R9-W3 + R9 continuation)", () => {
  it("an unknown movement id renders the not-found surface, ends loading, and neither navigates nor writes anything (R9-W3-F1 closed)", async () => {
    wouterMocks.params = { id: "missing-movement" };
    render(<Harness />);
    expect(screen.getByRole("status")).toBeTruthy();
    /* R9-GA-F3.2/W3-F1: سطح «لم نجد حركة المادة» صار قابلًا للوصول عبر
     * مسار النجاح — التحميل ينتهي والعدم يظهر والحد الصادق بلا أثر ثابت. */
    expect(await screen.findByRole("heading", { name: "لم نجد حركة المادة" })).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByText("ارجع إلى المواد واختر حركة محفوظة.")).toBeTruthy();
    expect(wouterMocks.navigate).not.toHaveBeenCalled();
    expect(bumpVersion).not.toHaveBeenCalled();
    const inventory = new InventoryMaterialService(store, () => NOW);
    const movements = await inventory.movements();
    if (!movements.ok) throw new Error(movements.message);
    expect(movements.value).toHaveLength(0);
  });

  it("a storage/read failure renders the actual error message with an alert role and a retry — never the not-found surface (R9-GA-F3.2 closed)", async () => {
    const failing = new FailingMovementsReadStore();
    /* الزرع يمر أولًا بمسار ناجح (failReads=false) حتى تكتمل الكتابات
     * والقراءات الوسيطة، ثم يُفعل الفشل قبل عرض الصفحة. */
    failing.failReads = false;
    store = failing;
    currentStore = failing;
    const seededMovementId = await seedOpeningMovement();
    failing.failReads = true;
    mockedUsePrototypeServices.mockReturnValue(
      services() as unknown as ReturnType<typeof usePrototypeServices>,
    );
    wouterMocks.params = { id: seededMovementId };
    render(<Harness />);
    const error = await screen.findByRole("alert");
    expect(error.textContent).toBe("تعذر قراءة حركات المواد المحلية.");
    expect(screen.queryByText("لم نجد حركة المادة")).toBeNull();
    expect(screen.queryByRole("heading", { name: "لم نجد حركة المادة" })).toBeNull();
    expect(wouterMocks.navigate).not.toHaveBeenCalled();
    expect(bumpVersion).not.toHaveBeenCalled();

    /* إعادة المحاولة تعيد القراءة عبر الخدمة الحقيقية — وعند نجاحها
     * يُعرض المحرر (المادة مزروعة سلفًا). */
    failing.failReads = false;
    fireEvent.click(screen.getByRole("button", { name: "إعادة المحاولة" }));
    expect(await screen.findByRole("textbox")).toBeTruthy();
    const inventory = new InventoryMaterialService(store, () => NOW);
    const movements = await inventory.movements();
    if (!movements.ok) throw new Error(movements.message);
    expect(movements.value).toHaveLength(1);
  });

  it("requires a reason before any reversal is written (the error is announced as an alert)", async () => {
    const movementId = await seedOpeningMovement();
    wouterMocks.params = { id: movementId };
    render(<Harness />);
    await screen.findByRole("textbox");
    fireEvent.click(screen.getByRole("button", { name: /حفظ التراجع/ }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText("أدخل سبب التراجع عن حركة المادة.")).toBeTruthy();
    const inventory = new InventoryMaterialService(store, () => NOW);
    const movements = await inventory.movements();
    if (!movements.ok) throw new Error(movements.message);
    expect(movements.value.some(candidate => candidate.reversesMovementId === movementId)).toBe(false);
  });

  it("archives the reversal through the page, and the successful save returns to the ?returnTo source (S1-07 / R9-GA-F3.3 closed)", async () => {
    const movementId = await seedOpeningMovement();
    wouterMocks.params = { id: movementId };
    wouterMocks.search = "?returnTo=/finance";
    render(<Harness />);
    const reason = await screen.findByRole("textbox");
    fireEvent.change(reason, { target: { value: "عكس جرد مباشر" } });
    fireEvent.click(screen.getByRole("button", { name: /حفظ التراجع/ }));
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalled());
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/finance");
    expect(bumpVersion).toHaveBeenCalled();
    const inventory = new InventoryMaterialService(store, () => NOW);
    const movements = await inventory.movements();
    if (!movements.ok) throw new Error(movements.message);
    const reversal = movements.value.find(candidate => candidate.reversesMovementId === movementId);
    expect(reversal).toBeDefined();
    expect(reversal?.type).toBe("reversal");
    expect(reversal?.reason).toBe("عكس جرد مباشر");
  });

  it("without a return source the successful save uses the documented legal fallback /inventory", async () => {
    const movementId = await seedOpeningMovement();
    /* المسار الحقيقي للصفحة حتى يكون البديل القانوني الموثّق (/inventory/*)
     * هو المشتق من الموقع الفعلي لا من جذر الاختبار. */
    wouterMocks.location = "/inventory/movement/" + movementId + "/reverse";
    wouterMocks.params = { id: movementId };
    wouterMocks.search = "";
    render(<Harness />);
    const reason = await screen.findByRole("textbox");
    fireEvent.change(reason, { target: { value: "عكس بلا مصدر رجوع" } });
    fireEvent.click(screen.getByRole("button", { name: /حفظ التراجع/ }));
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalled());
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/inventory");
    expect(bumpVersion).toHaveBeenCalled();
  });

  it("rejects a second reversal of the same movement honestly through the service boundary (alert role, no second record)", async () => {
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
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    const movements = await inventory.movements();
    if (!movements.ok) throw new Error(movements.message);
    expect(movements.value.filter(candidate => candidate.reversesMovementId === movementId)).toHaveLength(1);
    expect(wouterMocks.navigate).not.toHaveBeenCalled();
  });

  it("protects unsaved changes behind the guard dialog on back navigation", async () => {
    const movementId = await seedOpeningMovement();
    wouterMocks.params = { id: movementId };
    render(<Harness />);
    const reason = await screen.findByRole("textbox");
    fireEvent.change(reason, { target: { value: "سبب غير محفوظ" } });
    fireEvent.click(screen.getByRole("button", { name: /المواد والمخزون/ }));
    expect(await screen.findByTestId("unsaved-changes-drawer")).toBeTruthy();
    expect(wouterMocks.navigate).not.toHaveBeenCalled();
    /* «ابقَ في الصفحة» يغلق الحوار وتبقى الصفحة كما هي. */
    fireEvent.click(screen.getByRole("button", { name: "ابقَ في الصفحة" }));
    await waitFor(() => expect(screen.queryByTestId("unsaved-changes-drawer")).toBeNull());
    expect(await screen.findByRole("textbox")).toBeTruthy();
    const movements = await new InventoryMaterialService(store, () => NOW).movements();
    if (!movements.ok) throw new Error(movements.message);
    expect(movements.value.some(candidate => candidate.reversesMovementId === movementId)).toBe(false);
  });
});
