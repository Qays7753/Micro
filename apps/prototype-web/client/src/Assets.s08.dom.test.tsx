/** @vitest-environment jsdom */

/* S08 (UNIT-034 / DOC-017 — أمر S08): رحلات الدفع الجزئي المعتمد وسداد
 * المتبقي في الأسطح الحقيقية (RTL/عربي): المحرر يعرض الدفعة الأولى عند
 * مسار الذمم ويصدّقها قبل الحفظ، والتفاصيل تعرض المدفوع/المتبقي المشتقين
 * وتسدد من مصدر الالتزام بلا تجاوز، والقائمة لا تعرض الدفتري كسعر سوق. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { AssetService } from "@/application/assets/assetService";
import { PartyDirectoryService } from "@/application/parties/partyLedgerService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { FormDraftService } from "@/application/drafts/formDraftService";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import AssetEditor from "@/pages/AssetEditor";
import AssetDetail from "@/pages/AssetDetail";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/assets",
  params: {} as Record<string, string>,
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => wouterMocks.params,
  useSearch: () => "",
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-10-30T12:00:00.000Z";

let store: MemoryLocalStore;
let assets: AssetService;
let partyDirectory: PartyDirectoryService | null;
const contextRef: { current: Record<string, unknown> } = { current: {} };

function Harness({ page }: { page: React.ReactNode }) {
  const [version, setVersion] = React.useState(0);
  contextRef.current = {
    formDrafts: new FormDraftService(store),
    assets,
    partyDirectory,
    dataVersion: version,
    notifyDataChanged: () => setVersion(current => current + 1),
  };
  return <UnsavedChangesProvider navigate={wouterMocks.navigate}>{page}</UnsavedChangesProvider>;
}

beforeEach(() => {
  store = new MemoryLocalStore();
  assets = new AssetService(store, () => NOW);
  partyDirectory = new PartyDirectoryService(store, () => NOW);
  mockedUsePrototypeServices.mockImplementation(() => contextRef.current as never);
  wouterMocks.location = "/assets";
  wouterMocks.navigate.mockClear();
});

afterEach(cleanup);

describe("S08 asset partial payment surfaces (RTL)", () => {
  it("the payable path reveals the paid-now field, validates its bounds, and the preview shows the split honestly", async () => {
    const { unmount } = render(<Harness page={<AssetEditor />} />);
    fireEvent.change(screen.getByLabelText("اسم الأصل"), { target: { value: "ماكينة خياطة" } });
    fireEvent.change(screen.getByLabelText("قيمة الشراء (د.أ)"), { target: { value: "100" } });
    /* مسار الذمم يكشف حقل الدفعة الأولى — النقدي لا يعرضه أصلًا. */
    fireEvent.click(screen.getByRole("button", { name: "على الذمم (أدفع لاحقًا)" }));
    expect(screen.getByLabelText(/المدفوع الآن/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/المدفوع الآن/), { target: { value: "40" } });
    await waitFor(() => {
      expect(screen.getByText(/يخرج 40/i)).toBeTruthy();
      expect(screen.getByText(/حق 60/i)).toBeTruthy();
    });
    /* تجاوز الدفعة للقيمة يُرفض صادرًا قبل أي حفظ. */
    fireEvent.change(screen.getByLabelText(/المدفوع الآن/), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: /احفظ الأصل/ }));
    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("أصغر من قيمة الأصل");
    });
    unmount();
  });

  it("SDF-066 journey: create 100 paid 40, then the detail shows paid/remaining and settles the live right", async () => {
    const created = await assets.create({
      name: "فرن",
      acquisitionAmountMinor: 10000,
      acquisitionKind: "payable",
      purchaseDate: "2026-10-01",
      paidAtCreationMinor: 4000,
      note: null,
    });
    if (!created.ok) throw new Error(created.message);
    wouterMocks.location = `/assets/${created.value.asset.id}`;
    window.history.pushState({}, "", `/assets/${created.value.asset.id}`);
    const { rerender } = render(<Harness page={<AssetDetail />} />);
    await waitFor(() => {
      expect(screen.getByText(/مدفوع نقدًا/i)).toBeTruthy();
    });
    expect(screen.getByText(/متبقي حق/i)).toBeTruthy();
    /* تسديد جزئي 20 ثم قراءة المتبقي الحي 40 — النص المشتق مجزأ بين
     * عناصر فتُقرأ القيمة من تلميح الحقل الصادق (وحدات صغرى). */
    fireEvent.change(screen.getByLabelText(/سدد الآن/), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: /سجّل التسديد/ }));
    await waitFor(() => {
      expect(screen.getByText(/المتبقي الحي 4,000/i)).toBeTruthy();
    });
    /* تجاوز المتبقي يُرفض برسالة الأعمال الصادقة داخل السطح نفسه. */
    fireEvent.change(screen.getByLabelText(/سدد الآن/), { target: { value: "41" } });
    fireEvent.click(screen.getByRole("button", { name: /سجّل التسديد/ }));
    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("المتبقي");
    });
    rerender(<Harness page={<AssetDetail />} />);
  });

  it("a fully-paid cash asset shows no payable card — the states stay distinct", async () => {
    const created = await assets.create({
      name: "ميز خشبي",
      acquisitionAmountMinor: 5000,
      acquisitionKind: "cash",
      purchaseDate: "2026-10-01",
      note: null,
    });
    if (!created.ok) throw new Error(created.message);
    wouterMocks.location = `/assets/${created.value.asset.id}`;
    window.history.pushState({}, "", `/assets/${created.value.asset.id}`);
    render(<Harness page={<AssetDetail />} />);
    await waitFor(() => {
      expect(screen.getByText(/القيمة الدفترية اليوم/i)).toBeTruthy();
    });
    expect(screen.queryByText(/متبقي حق/i)).toBeNull();
  });
});
