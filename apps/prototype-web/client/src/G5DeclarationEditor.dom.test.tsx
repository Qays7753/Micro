/** @vitest-environment jsdom */
/*
 * R9-W3 (WS-216/ARCH-007): اختبار مباشر لحدود صفحة سجل G5 المتوقع — بوابات
 * المبلغ والملاحظة (مع فتح التفاصيل تلقائيًا)، اتجاه الالتزام مقابل
 * التحصيل، وإنشاء السجل عبر الخدمة الحقيقية بقراءة أثر مجتزأة. لا يُثبَّت
 * عيب مفتاح الحتمية المكتشف (إسقاط knowledge) أُصلح جذريًا في استمرار R9
 * (R9-GA-F3.4): الهوية الآن JSON لكل المدخلات الدلالية الثمانية — تُختبر
 * هنا مشاركة knowledge وصمود الفصل بين المصادر والملاحظات الحرة.
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

describe("G5DeclarationEditor — direct page-boundary behavior (R9-W3 + R9 continuation)", () => {
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

  /* ─── استمرار R9 (R9-GA-F3.4): هوية الحتمية السيمانطية الكاملة ─── */

  it("a genuinely identical retry persists exactly one declaration and reuses it truthfully", async () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("مبلغ السجل المتوقع"), { target: { value: "25" } });
    fireEvent.change(screen.getByPlaceholderText("مثال: رسالة العميلة أو فاتورة المورد"), {
      target: { value: "مصدر ثابت" },
    });
    fireEvent.change(screen.getByPlaceholderText("ما الذي يجعلك تتوقع هذا القبض أو الدفع؟"), {
      target: { value: "ملاحظة ثابتة" },
    });
    fireEvent.click(screen.getByRole("button", { name: /حفظ المتوقع/ }));
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalled());
    /* إعادة المحاولة نفسها بالمدخلات نفسها (navigate مُحاكى فتبقى الصفحة):
     * مفتاح واحد ⇒ سجل واحد وإعادة استخدام صادقة لا كتابة ثانية. */
    fireEvent.click(screen.getByRole("button", { name: /حفظ المتوقع/ }));
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalledTimes(2));
    const projectFinance = new ProjectFinancialService(store, () => NOW);
    const g5 = new FinancialAnalysisService(store, projectFinance);
    const declarations = await g5.listDeclarations();
    if (!declarations.ok) throw new Error(declarations.message);
    expect(declarations.value).toHaveLength(1);
    expect(declarations.value[0]?.knowledge).toBe("known");
  });

  it("a save differing only in knowledge persists a second declaration — removing knowledge from the identity fails this test (R9-GA-F3.4)", async () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("مبلغ السجل المتوقع"), { target: { value: "25" } });
    fireEvent.change(screen.getByPlaceholderText("مثال: رسالة العميلة أو فاتورة المورد"), {
      target: { value: "مصدر ثابت" },
    });
    fireEvent.change(screen.getByPlaceholderText("ما الذي يجعلك تتوقع هذا القبض أو الدفع؟"), {
      target: { value: "ملاحظة ثابتة" },
    });
    fireEvent.click(screen.getByRole("button", { name: /حفظ المتوقع/ }));
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalled());
    /* تغيير درجة المعرفة وحدها (مؤكد → يحتاج مراجعة): سجل دلالي مختلف —
     * قبل الإصلاح كان المفتاح يتطابق فيُبتلع التعديل كـreused. */
    fireEvent.change(screen.getByLabelText("حالة الرقم"), { target: { value: "needs_review" } });
    fireEvent.click(screen.getByRole("button", { name: /حفظ المتوقع/ }));
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalledTimes(2));
    const projectFinance = new ProjectFinancialService(store, () => NOW);
    const g5 = new FinancialAnalysisService(store, projectFinance);
    const declarations = await g5.listDeclarations();
    if (!declarations.ok) throw new Error(declarations.message);
    expect(declarations.value).toHaveLength(2);
    expect(declarations.value.filter(declaration => declaration.knowledge === "known")).toHaveLength(1);
    expect(declarations.value.filter(declaration => declaration.knowledge === "needs_review")).toHaveLength(
      1,
    );
  });

  it("a save differing in another semantic field (amount) persists a second declaration", async () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("مبلغ السجل المتوقع"), { target: { value: "10" } });
    fireEvent.change(screen.getByPlaceholderText("مثال: رسالة العميلة أو فاتورة المورد"), {
      target: { value: "مصدر المبلغ الأول" },
    });
    fireEvent.change(screen.getByPlaceholderText("ما الذي يجعلك تتوقع هذا القبض أو الدفع؟"), {
      target: { value: "ملاحظة موحدة" },
    });
    fireEvent.click(screen.getByRole("button", { name: /حفظ المتوقع/ }));
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText("مبلغ السجل المتوقع"), { target: { value: "11" } });
    fireEvent.click(screen.getByRole("button", { name: /حفظ المتوقع/ }));
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalledTimes(2));
    const projectFinance = new ProjectFinancialService(store, () => NOW);
    const g5 = new FinancialAnalysisService(store, projectFinance);
    const declarations = await g5.listDeclarations();
    if (!declarations.ok) throw new Error(declarations.message);
    expect(declarations.value).toHaveLength(2);
  });

  it("free text containing the delimiter no longer collides: two declarations whose colon-joined keys were identical both persist (R9-GA-F3.4 serialization)", async () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("مبلغ السجل المتوقع"), { target: { value: "20" } });
    fireEvent.change(screen.getByPlaceholderText("مثال: رسالة العميلة أو فاتورة المورد"), {
      target: { value: "أ:ب" },
    });
    fireEvent.change(screen.getByPlaceholderText("ما الذي يجعلك تتوقع هذا القبض أو الدفع؟"), {
      target: { value: "ج" },
    });
    fireEvent.click(screen.getByRole("button", { name: /حفظ المتوقع/ }));
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalled());
    /* بالوصل القديم كان المفتاحان متطابقين نصيًا (أ:ب + ج == أ + ب:ج)
     * فيُبتلع السجل الثاني؛ بتسلسل JSON يظلان سجلين مستقلين. */
    fireEvent.change(screen.getByPlaceholderText("مثال: رسالة العميلة أو فاتورة المورد"), {
      target: { value: "أ" },
    });
    fireEvent.change(screen.getByPlaceholderText("ما الذي يجعلك تتوقع هذا القبض أو الدفع؟"), {
      target: { value: "ب:ج" },
    });
    fireEvent.click(screen.getByRole("button", { name: /حفظ المتوقع/ }));
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalledTimes(2));
    const projectFinance = new ProjectFinancialService(store, () => NOW);
    const g5 = new FinancialAnalysisService(store, projectFinance);
    const declarations = await g5.listDeclarations();
    if (!declarations.ok) throw new Error(declarations.message);
    expect(declarations.value).toHaveLength(2);
    expect(declarations.value.find(declaration => declaration.source === "أ:ب")).toBeDefined();
    expect(declarations.value.find(declaration => declaration.source === "أ")).toBeDefined();
  });
});
