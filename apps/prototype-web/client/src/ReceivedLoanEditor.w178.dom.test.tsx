/** @vitest-environment jsdom */

/* FIN-001 (WS-178 — Wave 6) ثم UNIT-036 (تنفيذ S15 بالأمر الموحد §5):
 * الاقتراض مؤجل خارج نطاق الإطلاق قرارًا معتمدًا — لا زر إنشاء في أي سطح،
 * والوصلة العميقة القديمة /loans/received/new تبقى مسجلة لترفض رفضًا صادقًا:
 * لا نموذج ولا نوع مُقرض ولا حفظ ولا «قريبًا» لقدرة مؤجلة، ولا قرض بديل باسم
 * عميل أو طرف خارجي. لا كتابة تحت أي تفاعل — المخزن يبقى فارغًا. */
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import ReceivedLoanEditor from "@/pages/ReceivedLoanEditor";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
  /* الإغلاق على المتغير المتأخر متعمد — كما في الإنتاج فوق مخزن الذاكرة. */
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

describe("ReceivedLoanEditor (FIN-001 → UNIT-036 — الاقتراض مؤجل)", () => {
  it("UNIT-036: the legacy deep link refuses honestly — decision card, no form, no coming-soon", async () => {
    render(<Harness />);
    expect(await screen.findByRole("heading", { name: "تسجيل الاقتراض مؤجل" })).toBeTruthy();
    expect(screen.getByText("لا يُسجل قرض جديد أخذته في هذا الإطلاق.")).toBeTruthy();
    expect(screen.getByText(/الاقتراض مؤجل قرارًا معتمدًا ولا تمويل بديل باسم/)).toBeTruthy();
    /* ما سُجل سابقًا محفوظ — رسالة الحفظ صريحة لا حذف للتاريخ. */
    expect(screen.getByText(/ما سُجل سابقًا محفوظ كما هو ويُقرأ من صفحة القروض/)).toBeTruthy();
    /* لا نموذج إدخال أصلًا: لا اسم مُقرض ولا مبلغ ولا نوع اقتصادي ولا زر حفظ. */
    expect(screen.queryByLabelText(/نوع المُقرض/)).toBeNull();
    expect(screen.queryByLabelText("مبلغ القرض")).toBeNull();
    expect(screen.queryByPlaceholderText("مثال: أحمد، أم خالد، مؤسسة التمويل الأهلية")).toBeNull();
    expect(screen.queryByRole("button", { name: /احفظ القرض المستلم/ })).toBeNull();
    expect(screen.queryByRole("option", { name: "قرض من المالك" })).toBeNull();
  });

  it("UNIT-036: nothing is ever written — the store stays empty after the visit", async () => {
    render(<Harness />);
    await screen.findByRole("heading", { name: "تسجيل الاقتراض مؤجل" });
    const events = await store.listFinancialEvents();
    expect(events.ok && events.value).toHaveLength(0);
    const loans = await store.listReceivedLoans();
    expect(loans.ok && loans.value).toHaveLength(0);
  });

  it("UNIT-036: the refusal surface returns honestly to the loans page", async () => {
    render(<Harness />);
    const back = await screen.findByRole("button", { name: "القروض" });
    fireEvent.click(back);
    expect(wouterMocks.navigate).toHaveBeenCalled();
  });
});
