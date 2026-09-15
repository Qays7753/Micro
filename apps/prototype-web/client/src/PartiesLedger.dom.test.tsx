/** @vitest-environment jsdom */

/* FIN-002 (قرار المالك المعتمد ٢٠٢٦-٠٩-١٦): رحلة دفتر الناس — أول دين مسمّى
 * يظهر فورًا في الدفتر ويجده البحث، وشارة «متكرر» تظهر عند سجلين مختلفين،
 * ولا يُخفى أحد لأن اسمه لم يتكرر. */
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { PartyLedgerService } from "@/application/parties/partyLedgerService";
import { createDirectSale } from "@micro-domain/direct-sale/index.js";
import Parties from "@/pages/Parties";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/parties",
  params: {} as Record<string, string>,
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => wouterMocks.params,
  useSearch: () => "",
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-09-16T09:00:00.000Z";

let store: MemoryLocalStore;
let dataVersion = 0;

beforeEach(() => {
  store = new MemoryLocalStore();
  dataVersion = 0;
  mockedUsePrototypeServices.mockReturnValue({
    partyLedger: new PartyLedgerService(store),
    dataVersion,
    notifyDataChanged: () => {
      dataVersion += 1;
    },
  } as unknown as ReturnType<typeof usePrototypeServices>);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function saveCreditSale(input: {
  id: string;
  customerName: string;
  revenueMinor: number;
  collectedMinor: number;
}) {
  const saved = await store.saveDirectSale(
    createDirectSale({
      id: input.id,
      itemName: "قطعة",
      quantity: 1,
      revenueMinor: input.revenueMinor,
      collectedMinor: input.collectedMinor,
      collectionStatus: "partial_debt",
      catalogItemId: null,
      customerName: input.customerName,
      costMinor: null,
      occurredOn: "2026-09-16",
      recordedAt: NOW,
      note: "بيع آجل لاختبار رحلة الدفتر",
      idempotencyKey: `${input.id}-key`,
    }),
  );
  if (!saved.ok) throw new Error(saved.message);
}

function renderParties() {
  return render(
    <UnsavedChangesProvider navigate={wouterMocks.navigate}>
      <Parties />
    </UnsavedChangesProvider>,
  );
}

describe("Parties ledger journey (FIN-002)", () => {
  it("shows the first named debt immediately with its exact amount", async () => {
    await saveCreditSale({
      id: "dom-first",
      customerName: "عميل-FIN002",
      revenueMinor: 1500,
      collectedMinor: 500,
    });
    renderParties();
    /* العنوان الجاهز: مين عليه إلَي، وعليّ لمين؟ */
    expect(await screen.findByRole("heading", { level: 1, name: /مين عليه إلَي/ })).toBeTruthy();
    /* أول دين باسم جديد يظهر فورًا — لا انتظار لسجل ثانٍ. */
    expect(screen.getByText("عميل-FIN002")).toBeTruthy();
    expect(screen.getAllByText("10.00").length).toBeGreaterThan(0);
    /* المجموع الكلي للدين الواحد: 10.00 د.أ. */
    expect(screen.getByText("لك عند الناس")).toBeTruthy();
  });

  it("finds a single-transaction person through search", async () => {
    await saveCreditSale({
      id: "dom-search-1",
      customerName: "خالد-FIN002",
      revenueMinor: 900,
      collectedMinor: 0,
    });
    await saveCreditSale({ id: "dom-search-2", customerName: "سامي", revenueMinor: 500, collectedMinor: 0 });
    renderParties();
    expect(await screen.findByText("خالد-FIN002")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("بحث بالاسم"), { target: { value: "خالد" } });
    /* البحث يجد صاحب الحركة الواحدة — لم يعد محجوبًا خلف شرط التكرار. */
    expect(screen.getByText("خالد-FIN002")).toBeTruthy();
    expect(screen.queryByText("سامي")).toBeNull();
  });

  it("marks a repeated name with the repeat mark and keeps one-time names visible", async () => {
    await saveCreditSale({
      id: "dom-rep-1",
      customerName: "عميل-FIN002",
      revenueMinor: 1500,
      collectedMinor: 500,
    });
    await saveCreditSale({
      id: "dom-rep-2",
      customerName: "عميل-FIN002",
      revenueMinor: 800,
      collectedMinor: 0,
    });
    await saveCreditSale({
      id: "dom-rep-3",
      customerName: "زبونمرةواحدة",
      revenueMinor: 300,
      collectedMinor: 0,
    });
    renderParties();
    expect(await screen.findByText("عميل-FIN002")).toBeTruthy();
    /* شارة «متكرر» على من تكرر اسمه عبر سجلين مختلفين. */
    expect(screen.getAllByText("متكرر").length).toBeGreaterThan(0);
    /* وصاحب الحركة الواحدة يبقى مرئيًا بلا شارة. */
    expect(screen.getByText("زبونمرةواحدة")).toBeTruthy();
    const oneTime = screen.getByText("زبونمرةواحدة").closest("details");
    expect(oneTime?.querySelector(".micro-party-repeat-mark")).toBeNull();
  });
});
