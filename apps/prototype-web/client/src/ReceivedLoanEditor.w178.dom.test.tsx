/** @vitest-environment jsdom */

/* FIN-001 (WS-178 — Wave 6): مسارات DOM لمحرر القرض المستلم — «أخذت هذا
 * المبلغ قرضًا؟» الاختيار الاقتصادي صريح لا افترائي (ثلاثة أنواع بلا تحديد
 * مبدئي)، والصياغة الصادقة ظاهرة («ليس دخلًا ولا ربحًا»)، وتاريخ الاستحقاق
 * للعرض فقط، والحفظ محجوب بلا نوع مُقرض. الخدمة تُحمَّل ديناميكيًا (سابقة
 * EXE-014): الاستيراد الديناميكي يُترك حقيقيًا فوق MemoryLocalStore يوفره
 * mock جذر التركيب — كما في FinanceBudgets.w174.dom.test.tsx — فتُختبر
 * الخدمة والواجهة معًا من خارج الوحدة كما يفعل مستخدم حقيقي. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import ReceivedLoanEditor from "@/pages/ReceivedLoanEditor";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
  /* الخدمة تُبنى داخل الصفحة فوق هذا المخزن عند أول فتح — كما في الإنتاج
   * تمامًا لكن فوق مخزن الذاكرة هنا (الإغلاق على المتغير المتأخر متعمد). */
  getPrototypeLocalStore: () => store,
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/loans/received/new",
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
        cashContinuity: new CashContinuityService(store, () => NOW),
        dataVersion,
        notifyDataChanged: () => {
          dataVersion += 1;
        },
      }) as unknown as ReturnType<typeof usePrototypeServices>,
    [],
  );
  mockedUsePrototypeServices.mockImplementation(() => services);
  return (
    <UnsavedChangesProvider navigate={wouterMocks.navigate}>
      <ReceivedLoanEditor />
    </UnsavedChangesProvider>
  );
}

beforeEach(() => {
  store = new MemoryLocalStore();
  dataVersion = 0;
  wouterMocks.location = "/loans/received/new";
  wouterMocks.navigate.mockClear();
  vi.clearAllMocks();
});
afterEach(cleanup);

async function fillBasics() {
  fireEvent.change(await screen.findByPlaceholderText("مثال: أحمد، أم خالد، مؤسسة التمويل الأهلية"), {
    target: { value: "أحمد" },
  });
  const amount = await screen.findByLabelText("مبلغ القرض");
  fireEvent.change(amount, { target: { value: "200" } });
  fireEvent.blur(amount);
}

describe("ReceivedLoanEditor (FIN-001 — WS-178 Wave 6)", () => {
  it("renders the three explicit economic types with NO default selection", async () => {
    render(<Harness />);
    const selector = await screen.findByLabelText(/نوع المُقرض \(اختيارك الصريح\)/);
    expect((selector as HTMLSelectElement).value).toBe("");
    /* الخيارات الثلاثة صريحة، والخيار الفارغ هو التحديد المبدئي — لا افتراضي. */
    for (const label of ["قرض من المالك", "قرض من فرد", "قرض من مؤسسة"]) {
      expect(screen.getByRole("option", { name: label })).toBeTruthy();
    }
    expect(screen.getByRole("option", { name: "اختر نوع المُقرض صراحةً" })).toBeTruthy();
  });

  it("shows the honest non-income wording and the display-only due date", async () => {
    render(<Harness />);
    expect(
      await screen.findByText("القرض المستلم يرفع الكاش ويرفع التزامًا — ليس دخلًا ولا ربحًا."),
    ).toBeTruthy();
    expect(screen.getByText("تاريخ الاستحقاق (للمعلومة فقط — لا ينشئ مصروفًا ولا تنبيهًا)")).toBeTruthy();
    expect(screen.getByText(/لا يُخمَّن نيابةً عنك بين قرض وتحويل ورأس مال/)).toBeTruthy();
  });

  it("blocks submission without an explicit lender type — nothing written", async () => {
    render(<Harness />);
    await fillBasics();
    fireEvent.click(await screen.findByRole("button", { name: /احفظ القرض المستلم/ }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("اختر نوع المُقرض صراحةً: مالك / فرد / مؤسسة — لا يُخمَّن");
    /* لا كتابة ولا تنقل — الاختيار الصريح شرط الحفظ. */
    expect(wouterMocks.navigate).not.toHaveBeenCalled();
    const events = await store.listFinancialEvents();
    expect(events.ok && events.value).toHaveLength(0);
    const loans = await store.listReceivedLoans();
    expect(loans.ok && loans.value).toHaveLength(0);
  });

  it("saves through the real journey after the explicit choice: cash and loan payable up — never revenue", async () => {
    render(<Harness />);
    await fillBasics();
    const selector = await screen.findByLabelText(/نوع المُقرض \(اختيارك الصريح\)/);
    fireEvent.change(selector, { target: { value: "institution" } });
    /* معاينة الأثر قبل الحفظ — إعلان المبدأ بالنص نفسه. */
    expect(await screen.findByText(/يدخل 200\.00 د\.أ إلى الكاش ويرتفع التزام بمثلها/)).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: /احفظ القرض المستلم/ }));
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalled());
    const events = await store.listFinancialEvents();
    if (!events.ok) throw new Error(events.message);
    const principal = events.value.find(event => event.type === "loan_received_cash");
    expect(principal).toBeTruthy();
    expect(principal!.cashDeltaMinor).toBe(20_000);
    expect(principal!.loanPayableDeltaMinor).toBe(20_000);
    expect(principal!.revenueDeltaMinor ?? 0).toBe(0);
    expect(principal!.operatingExpenseDeltaMinor).toBe(0);
    const loans = await store.listReceivedLoans();
    if (!loans.ok) throw new Error(loans.message);
    expect(loans.value).toHaveLength(1);
    expect(loans.value[0]!.lenderType).toBe("institution");
    expect(loans.value[0]!.lenderName).toBe("أحمد");
  });
});
