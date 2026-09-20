/** @vitest-environment jsdom */
/* Stage 2 — OPS-001 (tracker): مواعيد الاستحقاق والتقادم الأساسي على سطح
 * الموردين — المتأخر والمستحق اليوم والحالي من قراءة التقادم، والمفقود يبقى
 * «لا يوجد تاريخ استحقاق مسجل» كما هو؛ لا اختراع تاريخ اليوم ولا صفر، وفتح
 * السطح لا يكتب سجلًا واحدًا، وفشل القراءة بطاقة خطأ صادقة بلا كتابة. */
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { SupplierPurchaseService } from "@/application/suppliers/supplierPurchaseService";
import { DueDatesService } from "@/application/finance/dueDatesService";
import { CollectionService } from "@/application/collections/collectionService";
import { FulfillmentService } from "@/application/fulfillment/fulfillmentService";
import { DirectSaleService } from "@/application/direct-sales/directSaleService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import type { SupplierPurchase } from "@micro-domain/supplier-purchase/index.js";
import type { StorageResult } from "@/storage/local/types";
import Suppliers from "@/pages/Suppliers";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({ navigate: vi.fn(), location: "/suppliers" }));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useSearch: () => "",
  useParams: () => ({}),
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-09-16T09:00:00.000Z";

function buildServices(store: MemoryLocalStore) {
  const projectFinance = new ProjectFinancialService(store, () => NOW);
  const fulfillment = new FulfillmentService(store, () => NOW);
  const directSales = new DirectSaleService(store, () => NOW);
  const collections = new CollectionService(store, fulfillment, directSales, projectFinance, () => NOW);
  const dueDates = new DueDatesService(store, collections, () => NOW);
  return {
    supplierPurchases: new SupplierPurchaseService(store, () => NOW),
    dueDates,
    dataVersion: 0,
    notifyDataChanged: () => undefined,
  } as unknown as ReturnType<typeof usePrototypeServices>;
}

async function seedPurchase(
  store: MemoryLocalStore,
  input: { key: string; name: string; dueOn: string | null; total: number; paid: number },
) {
  const result = await new SupplierPurchaseService(store, () => NOW).recordPurchase({
    supplierName: input.name,
    note: "اختبار سطح",
    purchasedOn: "2026-09-01",
    dueOn: input.dueOn,
    totalMinor: input.total,
    initialPaidMinor: input.paid,
    idempotencyKey: input.key,
  });
  if (!result.ok) throw new Error(result.message);
}

class FailingSupplierReads extends MemoryLocalStore {
  async listSupplierPurchases(): Promise<StorageResult<readonly SupplierPurchase[]>> {
    return { ok: false, code: "storage_error", message: "فشل قراءة مفتعل" };
  }
}

let store: MemoryLocalStore;

beforeEach(() => {
  store = new MemoryLocalStore();
  wouterMocks.navigate.mockReset();
  mockedUsePrototypeServices.mockReturnValue(buildServices(store));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Stage 2 — OPS-001: سطح الموردين يعرض التقادم الأساسي بصدق", () => {
  it("يميز المتأخر عن الحالي عن المستحق اليوم، والموعد المفقود لا يتحول إلى تاريخ اليوم", async () => {
    await seedPurchase(store, {
      key: "dom-overdue",
      name: "مورد الأقمشة",
      dueOn: "2026-09-10",
      total: 20000,
      paid: 0,
    });
    await seedPurchase(store, {
      key: "dom-current",
      name: "مورد الخيوط",
      dueOn: "2026-09-20",
      total: 15000,
      paid: 0,
    });
    await seedPurchase(store, {
      key: "dom-today",
      name: "مورد الأصباغ",
      dueOn: "2026-09-16",
      total: 5000,
      paid: 0,
    });
    await seedPurchase(store, { key: "dom-unset", name: "مورد الحروف", dueOn: null, total: 8000, paid: 0 });

    render(<Suppliers />);

    expect(await screen.findByText("متأخر عن موعده")).toBeTruthy();
    expect(screen.getByText("لم يحن بعد")).toBeTruthy();
    expect(screen.getByText("مستحق اليوم")).toBeTruthy();
    /* الموعد المفقود يبقى صريحًا — والمبلغ يظهر؛ غياب التاريخ ليس غياب الدين. */
    const missingNote = screen.getByText("لا يوجد تاريخ استحقاق مسجل");
    expect(missingNote.closest("article")?.textContent).toContain("مورد الحروف");
    expect(missingNote.closest("article")?.textContent).toContain("80.00");
    /* لا اختراع تاريخ اليوم في سطر الموعد المفقود. */
    expect(missingNote.textContent).not.toContain("16/09/2026");
    /* المتأخر يعرض تاريخه المخزّن نفسه — لا تاريخًا مبدّلًا. */
    expect(screen.getByText("10/09/2026")).toBeTruthy();
  });

  it("فتح السطح لا يكتب أي سجل — مطابقة اللقطة قبل/بعد", async () => {
    await seedPurchase(store, {
      key: "dom-no-write",
      name: "مورد القراءة",
      dueOn: "2026-09-10",
      total: 4000,
      paid: 0,
    });
    const before = await store.readSnapshot();
    render(<Suppliers />);
    expect(await screen.findByText("متأخر عن موعده")).toBeTruthy();
    const after = await store.readSnapshot();
    expect(after.ok && before.ok ? after.value : after).toEqual(before.ok ? before.value : before);
  });

  it("فشل القراءة يعرض بطاقة الخطأ الصادقة — لم يتغير أي سجل", async () => {
    const failing = new FailingSupplierReads();
    mockedUsePrototypeServices.mockReturnValue(buildServices(failing));
    const before = await failing.readSnapshot();
    render(<Suppliers />);
    expect(await screen.findByText("تعذر قراءة الموردين والمشتريات")).toBeTruthy();
    expect(screen.getByText("لم يتغير أي سجل.")).toBeTruthy();
    expect(screen.getByText("إعادة المحاولة")).toBeTruthy();
    const after = await failing.readSnapshot();
    expect(after.ok && before.ok ? after.value : after).toEqual(before.ok ? before.value : before);
  });
});
