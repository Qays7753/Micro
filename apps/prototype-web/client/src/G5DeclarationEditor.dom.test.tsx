/** @vitest-environment jsdom */

/* G5DeclarationEditor (R9-W3) ثم UNIT-021 (تنفيذ S15 بالأمر الموحد §5):
 * تسجيل التوقعات النقدية اليدوية مؤجل خارج الإصدار الأول قرارًا معتمدًا —
 * الوصلة العميقة القديمة تبقى مسجلة لترفض رفضًا صادقًا: لا نموذج ولا زر
 * حفظ ولا بديل توصية يوحي بوجود القدرة، ولا كتابة تحت أي تفاعل. السجل
 * التاريخي المزروع عند حد المخزن يظل مقروءًا من صفحة المالية. */
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { FinancialAnalysisService } from "@/application/financial-analysis/financialAnalysisService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import G5DeclarationEditor from "@/pages/G5DeclarationEditor";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
  /* الإغلاق على المتغير المتأخر متعمد — كما في الإنتاج فوق مخزن الذاكرة. */
  getPrototypeLocalStore: () => store,
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/finance/g5/declaration",
  params: {} as Record<string, string>,
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => wouterMocks.params,
  useSearch: () => "",
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-09-23T10:00:00.000Z";

let store: MemoryLocalStore;
let dataVersion = 0;

function Harness() {
  const services = React.useMemo(
    () =>
      ({
        dataVersion,
        g5: new FinancialAnalysisService(store, new ProjectFinancialService(store, () => NOW), () => NOW),
        notifyDataChanged: () => {
          dataVersion += 1;
        },
      }) as unknown as ReturnType<typeof usePrototypeServices>,
    [],
  );
  mockedUsePrototypeServices.mockImplementation(() => services);
  return (
    <UnsavedChangesProvider navigate={wouterMocks.navigate}>
      <G5DeclarationEditor />
    </UnsavedChangesProvider>
  );
}

beforeEach(() => {
  store = new MemoryLocalStore();
  dataVersion = 0;
  wouterMocks.location = "/finance/g5/declaration";
  wouterMocks.navigate.mockClear();
  vi.clearAllMocks();
});
afterEach(cleanup);

describe("G5DeclarationEditor — UNIT-021: التوقعات اليدوية مؤجلة", () => {
  it("the legacy deep link refuses honestly — decision card, no form, no coming-soon", async () => {
    render(<Harness />);
    expect(await screen.findByRole("heading", { name: "تسجيل توقع نقدي مؤجل" })).toBeTruthy();
    expect(screen.getByText("لا يُسجل توقع قبض أو دفع جديد في هذا الإطلاق.")).toBeTruthy();
    expect(screen.getByText(/التوقعات النقدية اليدوية والسحب الاستشاري مؤجلان/)).toBeTruthy();
    /* حفظ التاريخ صريح — لا حذف ولا إعادة تفسير للسجل القائم. */
    expect(screen.getByText(/ما سُجل سابقًا محفوظ كما هو ويُقرأ مع تصحيحه الموثق/)).toBeTruthy();
    /* لا نموذج إدخال أصلًا: لا مبلغ ولا اتجاه ولا معرفة ولا زر حفظ. */
    expect(screen.queryByLabelText("مبلغ السجل المتوقع")).toBeNull();
    expect(screen.queryByPlaceholderText("مثال: رسمة العميلة أو فاتورة المورد")).toBeNull();
    expect(screen.queryByRole("button", { name: /حفظ المتوقع/ })).toBeNull();
    expect(screen.queryByRole("option", { name: "قبض متوقع" })).toBeNull();
  });

  it("nothing is ever written — the declarations store stays empty after the visit", async () => {
    render(<Harness />);
    await screen.findByRole("heading", { name: "تسجيل توقع نقدي مؤجل" });
    const g5 = new FinancialAnalysisService(store, new ProjectFinancialService(store, () => NOW), () => NOW);
    const declarations = await g5.listDeclarations();
    expect(declarations.ok && declarations.value).toHaveLength(0);
  });

  it("the service boundary refuses too — repeated attempts never write (writer-level guard)", async () => {
    render(<Harness />);
    await screen.findByRole("heading", { name: "تسجيل توقع نقدي مؤجل" });
    const g5 = new FinancialAnalysisService(store, new ProjectFinancialService(store, () => NOW), () => NOW);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const refused = await g5.createDeclaration({
        direction: attempt % 2 === 0 ? "collection" : "commitment",
        amountMinor: 1000 + attempt,
        dueOn: "2026-10-01",
        source: `محاولة ${attempt}`,
        knowledge: "known",
        note: "محاولة كتابة",
        relatedOrderId: null,
        relatedEventId: null,
        idempotencyKey: `refused-${attempt}`,
      });
      expect(refused.ok).toBe(false);
      if (!refused.ok) expect(refused.message).toContain("مؤجل");
    }
    const declarations = await g5.listDeclarations();
    expect(declarations.ok && declarations.value).toHaveLength(0);
  });

  it("the refusal surface returns honestly to the finance page", async () => {
    render(<Harness />);
    const back = await screen.findByRole("button", { name: "المالية" });
    fireEvent.click(back);
    expect(wouterMocks.navigate).toHaveBeenCalled();
  });
});
