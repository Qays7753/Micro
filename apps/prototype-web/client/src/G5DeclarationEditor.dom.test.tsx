/** @vitest-environment jsdom */
/*
 * R9-W3 (WS-216/ARCH-007): اختبار مباشر لحدود صفحة سجل G5 المتوقع — بوابات
 * المبلغ والملاحظة (مع فتح التفاصيل تلقائيًا)، اتجاه الالتزام مقابل
 * التحصيل، وإنشاء السجل عبر الخدمة الحقيقية بقراءة أثر مجتزأة. لا يُثبَّت
 * عيب مفتاح الحتمية المكتشف (إسقاط knowledge) — مسجل بقرار محمي R9-GA-F3.4.
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { FinancialAnalysisService } from "@/application/financial-analysis/financialAnalysisService";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import G5DeclarationEditor from "@/pages/G5DeclarationEditor";

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
  const projectFinance = new ProjectFinancialService(store, () => NOW);
  return {
    g5: new FinancialAnalysisService(store, projectFinance),
    notifyDataChanged: bumpVersion,
    dataVersion: 0,
  };
}

function Harness() {
  return (
    <UnsavedChangesProvider navigate={wouterMocks.navigate}>
      <G5DeclarationEditor />
    </UnsavedChangesProvider>
  );
}

beforeEach(() => {
  store = new MemoryLocalStore();
  currentStore = store;
  wouterMocks.search = "";
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

describe("G5DeclarationEditor — direct page-boundary behavior (R9-W3)", () => {
  it("records a collection declaration through the page with the converted amount and readable persisted effect", async () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("مبلغ السجل المتوقع"), { target: { value: "40" } });
    fireEvent.change(screen.getByPlaceholderText("مثال: رسالة العميلة أو فاتورة المورد"), {
      target: { value: "وعدت العميلة بالتحصيل مباشرة" },
    });
    fireEvent.change(screen.getByPlaceholderText("ما الذي يجعلك تتوقع هذا القبض أو الدفع؟"), {
      target: { value: "ملاحظة مباشرة" },
    });
    fireEvent.click(screen.getByRole("button", { name: /حفظ المتوقع/ }));
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalled());
    expect(bumpVersion).toHaveBeenCalled();
    const projectFinance = new ProjectFinancialService(store, () => NOW);
    const g5 = new FinancialAnalysisService(store, projectFinance);
    const declarations = await g5.listDeclarations();
    if (!declarations.ok) throw new Error(declarations.message);
    const found = declarations.value.find(
      declaration =>
        declaration.kind === "declaration" && declaration.source === "وعدت العميلة بالتحصيل مباشرة",
    );
    expect(found).toBeDefined();
    expect(found?.amountMinor).toBe(4_000);
    expect(found?.direction).toBe("collection");
  });

  it("blocks an empty amount at the gate without writing anything", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /حفظ المتوقع/ }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText("أدخل مبلغًا موجبًا بصيغة واضحة قبل الحفظ.")).toBeTruthy();
    const projectFinance = new ProjectFinancialService(store, () => NOW);
    const g5 = new FinancialAnalysisService(store, projectFinance);
    const declarations = await g5.listDeclarations();
    if (!declarations.ok) throw new Error(declarations.message);
    expect(declarations.value).toHaveLength(0);
    expect(wouterMocks.navigate).not.toHaveBeenCalled();
  });

  it("requires the context note and auto-opens the details layer to expose it", async () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("مبلغ السجل المتوقع"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: /حفظ المتوقع/ }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText("أضف ملاحظة قصيرة داخل تفاصيل المتوقع قبل الحفظ.")).toBeTruthy();
    const details = document.querySelector("details.micro-g5-details") as HTMLDetailsElement | null;
    expect(details?.open).toBe(true);
  });

  it("records a commitment declaration when the flow direction is switched", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "التزام قريب" }));
    fireEvent.change(screen.getByLabelText("مبلغ السجل المتوقع"), { target: { value: "30" } });
    fireEvent.change(screen.getByPlaceholderText("مثال: رسالة العميلة أو فاتورة المورد"), {
      target: { value: "فاتورة المورد المباشرة" },
    });
    fireEvent.change(screen.getByPlaceholderText("ما الذي يجعلك تتوقع هذا القبض أو الدفع؟"), {
      target: { value: "التزام مباشر" },
    });
    fireEvent.click(screen.getByRole("button", { name: /حفظ المتوقع/ }));
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalled());
    const projectFinance = new ProjectFinancialService(store, () => NOW);
    const g5 = new FinancialAnalysisService(store, projectFinance);
    const declarations = await g5.listDeclarations();
    if (!declarations.ok) throw new Error(declarations.message);
    const found = declarations.value.find(
      declaration => declaration.kind === "declaration" && declaration.source === "فاتورة المورد المباشرة",
    );
    expect(found).toBeDefined();
    expect(found?.direction).toBe("commitment");
    expect(found?.amountMinor).toBe(3_000);
  });
});
