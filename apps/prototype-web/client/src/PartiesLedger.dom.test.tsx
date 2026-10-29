/** @vitest-environment jsdom */

/* S05 (DOC-014 / UNIT-037 A4/A5/A6): رحلة «العملاء والموردون» — دليل الأطراف
 * المحفوظة فقط: الطرف المحفوظ يظهر بحسابه من مصادره المرتبطة، والفارغ
 * صادق، والبحث يجد، والمؤرشف يقرأ ولا يقترح. تقاعدت هنا رحلة دفتر الناس
 * (FIN-002) بقرار UNIT-037 P3 الأحدث: لا تجميع بالاسم أبدًا (SDF-009). */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { PartyDirectoryService } from "@/application/parties/partyLedgerService";
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
const NOW = "2026-10-29T09:00:00.000Z";

let store: MemoryLocalStore;
let directory: PartyDirectoryService;
let dataVersion = 0;

beforeEach(() => {
  store = new MemoryLocalStore();
  directory = new PartyDirectoryService(store, () => NOW);
  dataVersion = 0;
  mockedUsePrototypeServices.mockReturnValue({
    partyDirectory: directory,
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

async function savePartyWithDebt(label: string, revenueMinor: number, collectedMinor: number) {
  const party = await directory.save({ label, phone: null, note: null, operationKey: `op-${label}` });
  if (!party.ok) throw new Error(party.message);
  const saved = await store.saveDirectSale(
    createDirectSale({
      id: `sale-${label}`,
      itemName: "قطعة",
      quantity: 1,
      revenueMinor,
      collectedMinor,
      collectionStatus: "partial_debt",
      catalogItemId: null,
      customerName: label,
      customerPartyId: party.value.party.id,
      costMinor: null,
      occurredOn: "2026-10-20",
      recordedAt: NOW,
      note: "بيع آجل لاختبار الرحلة",
      idempotencyKey: `sale-${label}-key`,
    }),
  );
  if (!saved.ok) throw new Error(saved.message);
  return party.value.party;
}

function renderParties() {
  return render(
    <UnsavedChangesProvider navigate={wouterMocks.navigate}>
      <Parties />
    </UnsavedChangesProvider>,
  );
}

describe("Parties directory journey (S05 — DOC-014 / UNIT-037)", () => {
  it("shows the honest empty state for a fresh project — no forced parties", async () => {
    renderParties();
    expect(await screen.findByText("لم تحفظ عملاء أو موردين بعد.")).toBeTruthy();
    expect(screen.getByText("من تتعامل معه عند الحاجة")).toBeTruthy();
  });

  it("shows a saved party with its source-anchored account and exact amount", async () => {
    await savePartyWithDebt("عميل-S05", 1500, 500);
    renderParties();
    expect(await screen.findByText("عميل-S05")).toBeTruthy();
    expect(screen.getAllByText("10.00").length).toBeGreaterThan(0);
    expect(screen.getByText("لك عند المحفوظين")).toBeTruthy();
  });

  it("finds a saved party through search and hides the others", async () => {
    await savePartyWithDebt("خالد-S05", 900, 0);
    await savePartyWithDebt("سامي", 500, 0);
    renderParties();
    expect(await screen.findByText("خالد-S05")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("بحث بالاسم"), { target: { value: "خالد" } });
    expect(screen.getByText("خالد-S05")).toBeTruthy();
    expect(screen.queryByText("سامي")).toBeNull();
  });

  it("archived parties move to the archived section and stop being suggested", async () => {
    const party = await savePartyWithDebt("أم أحمد", 700, 0);
    const archived = await directory.setArchived({
      partyId: party.id,
      archived: true,
      expectedUpdatedAt: party.updatedAt,
      operationKey: "op-archive",
    });
    if (!archived.ok) throw new Error(archived.message);
    renderParties();
    /* المؤرشف يُفتح عرضه بالزر الصريح ثم يُقرأ في قسمه ولا يظهر ضمن
     * النشطين — لا حذف ولا حجب مصدر. */
    fireEvent.click(await screen.findByText(/المؤرشفون \(1\)/));
    const archivedSection = await screen.findByRole("region", { name: "الأطراف المؤرشفة" });
    expect(archivedSection.textContent).toContain("أم أحمد");
    expect(screen.getByText("مؤرشف")).toBeTruthy();
    expect(screen.queryByText("لم تحفظ عملاء أو موردين بعد.")).toBeTruthy();
  });

  it("saving a new party from the page keeps it explicit — no debt invented", async () => {
    renderParties();
    fireEvent.click(await screen.findByText("احفظ طرفًا جديدًا"));
    fireEvent.change(screen.getByLabelText("الاسم أو الوصف"), { target: { value: "مورد الجوارب" } });
    fireEvent.click(screen.getByText("حفظ الطرف"));
    await waitFor(() => expect(screen.getByText("مورد الجوارب")).toBeTruthy());
    /* الحفظ لا يستحدث دينًا ولا ذمة — الحساب فارغ صادق. */
    expect(
      screen.getByText("لا تعاملات مرتبطة بهذا الطرف بعد — الحفظ لا يستحدث دينًا ولا ذمة."),
    ).toBeTruthy();
  });
});
