/** @vitest-environment jsdom */

/* Wave 4.2 — P-4.2-5: حارس نقل السياسات + destinationWalletId (فحوص DOM).
 * - سياسات الربح والتوزيع: سطحها المالي «FinancePoliciesSection» يحفظ
 *   ويوقف ويراجع من بيت المالية (F02) — الكاتب القانوني نفسه عبر السياق.
 * - T7: «وزّع على هذه المحفظة» — يظهر عند وجود كاش غير موزع فقط، ويفتح
 *   التوزيع بالمحفظة مختارة مسبقًا بreturnTo إلى الدفتر، ولا زر ميت بدونه. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { CatalogService } from "@/application/catalog/catalogService";
import { RecurringWorkService } from "@/application/finance/recurringWorkService";
import { FinancePoliciesSection } from "@/components/finance/FinancePoliciesSection";
import WalletLedger from "@/pages/WalletLedger";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({ navigate: vi.fn(), location: "/finance" }));

vi.mock("wouter", () => ({
  useSearch: () => {
    const query = wouterMocks.location.split("?")[1] ?? "";
    return query ? `?${query}` : "";
  },
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => ({ id: wouterMocks.location.split("/").pop()?.split("?")[0] ?? "" }),
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-09-17T09:00:00.000Z";

describe("P-4.2-5 — سطح السياسات المالي (F02) والفعل السياقي للمحفظة (T7)", () => {
  let store: MemoryLocalStore;
  let catalog: CatalogService;
  let recurringWork: RecurringWorkService;

  beforeEach(() => {
    store = new MemoryLocalStore();
    catalog = new CatalogService(store, () => NOW);
    recurringWork = new RecurringWorkService(store, () => NOW);
    wouterMocks.location = "/finance";
    wouterMocks.navigate.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("سطح السياسات المالي: يحفظ سياسة من بيت المالية بالكاتب القانوني نفسه", async () => {
    const created = await catalog.create({
      kind: "product",
      name: "صابون غار",
      unitLabel: "قطعة",
      defaultPriceMinor: 700,
      defaultUnitCostMinor: 300,
      operationKey: "w42-policy-1",
    });
    if (!created.ok) throw new Error(created.message);

    mockedUsePrototypeServices.mockReturnValue({
      catalog,
      recurringWork,
      dataVersion: 0,
      notifyDataChanged: vi.fn(),
    } as unknown as ReturnType<typeof usePrototypeServices>);

    render(<FinancePoliciesSection />);
    /* إفصاح تدريجي: الطبقة تقرأ عند فتحها — نفتحها كما يفعل المستخدم. */
    fireEvent.click(screen.getByText("سياسات الربح والتوزيع"));
    await waitFor(() => expect(screen.getByText("اختر مرجعًا")).toBeTruthy());

    /* طبقة سياسات الربح والتوزيع — عنوان السطح بعد النقل. */
    expect(screen.getByText("سياسات الربح والتوزيع")).toBeTruthy();

    /* اختيار المرجع ثم حفظ سياسة يدوية كاملة المصدر والسبب والملاحظة.
     * Wave 4.3 (جذر السبب): خيارات المرجع تُحمَّل قراءةً غير متزامنة عند فتح
     * الطبقة — تغيير القائمة قبل ظهور الخيار يُفقد الاختيار صامتًا (القيمة
     * تصير فارغة) فلا يُرسم النموذج أبدًا. ننتظر الخيار نفسه قبل التغيير،
     * ثم ننتظر أول حقل من النموذج — تحديد القفل الزمني الحقيقي بدل قراءة
     * متزامنة سببت انقلابين عابرين في CI (#172 و#174). */
    await waitFor(() => expect(screen.getByRole("option", { name: /صابون غار/ })).toBeTruthy());
    fireEvent.change(screen.getByLabelText(/مرجع العمل/), { target: { value: created.item.id } });
    await waitFor(() => expect(screen.getByLabelText("المصدر")).toBeTruthy());
    fireEvent.change(screen.getByLabelText("المصدر"), { target: { value: "فاتورة كهرباء" } });
    fireEvent.change(screen.getByLabelText("السبب"), { target: { value: "تكلفة تشغيل مشتركة" } });
    fireEvent.change(screen.getByLabelText("ملاحظة القرار"), { target: { value: "أساس الشهر" } });
    fireEvent.change(screen.getByLabelText("مبلغ سياسة التوزيع"), { target: { value: "25.00" } });
    fireEvent.click(screen.getByRole("button", { name: /احفظ السياسة/ }));

    await waitFor(() => expect(screen.getByText(/تم حفظ سياسة التوزيع كقراءة تفسيرية مؤرخة/)).toBeTruthy());
    /* السياسة قائمة فعلًا في المخزن عبر الخدمة المالية — لا كاتب موازٍ. */
    const readings = await recurringWork.readRecurringWork("2026-09-01", "2026-09-30");
    if (!readings.ok) throw new Error("readings should succeed");
    const reading = readings.value.items.find(entry => entry.catalogItemId === created.item.id);
    expect(reading?.policies.length).toBe(1);
    expect(reading?.policies[0]?.status).toBe("active");

    /* سياسة المرجع تُعرض في السطح المالي مع فعل الإيقاف الموثق (F-082 انتقل مع السطح). */
    await waitFor(() => expect(screen.getByText("سياسات هذا المرجع")).toBeTruthy());
    expect(screen.getByRole("button", { name: "إيقاف" })).toBeTruthy();
    /* الطبقة ما تزال مفتوحة بعد الحفظ — الحالة محفوظة عبر onToggle. */
    expect(screen.getByText("أضف توزيعًا واضحًا")).toBeTruthy();
  });

  it("T7: «وزّع على هذه المحفظة» يفتح التوزيع بالمحفظة مختارة مسبقًا والرجوع إلى الدفتر", async () => {
    mockedUsePrototypeServices.mockReturnValue({
      walletLedger: {
        read: vi.fn(async () => ({
          ok: true,
          value: {
            wallet: { id: "wallet-t7", name: "درج الكاش", kind: "cash_drawer" },
            balanceMinor: 5000,
            openingUnknown: false,
            entryCount: 0,
            rows: [],
          },
        })),
      },
      projectFinance: {
        readPosition: vi.fn(async () => ({
          ok: true,
          value: { unallocatedCashMinor: 5000 },
        })),
      },
      dataVersion: 0,
    } as unknown as ReturnType<typeof usePrototypeServices>);

    wouterMocks.location = "/cash/wallet/wallet-t7";
    render(<WalletLedger />);
    const action = await screen.findByRole("button", { name: /وزّع على هذه المحفظة/ });
    fireEvent.click(action);
    expect(wouterMocks.navigate).toHaveBeenCalledWith(
      "/cash/distribute?destinationWalletId=wallet-t7&returnTo=%2Fcash%2Fwallet%2Fwallet-t7",
    );
  });

  it("T7: بلا كاش غير موزع قابل للتوزيع — لا زر ميت على الدفتر", async () => {
    mockedUsePrototypeServices.mockReturnValue({
      walletLedger: {
        read: vi.fn(async () => ({
          ok: true,
          value: {
            wallet: { id: "wallet-empty", name: "حساب بنكي", kind: "bank_account" },
            balanceMinor: 0,
            openingUnknown: true,
            entryCount: 0,
            rows: [],
          },
        })),
      },
      projectFinance: {
        readPosition: vi.fn(async () => ({
          ok: true,
          value: { unallocatedCashMinor: 0 },
        })),
      },
      dataVersion: 0,
    } as unknown as ReturnType<typeof usePrototypeServices>);

    wouterMocks.location = "/cash/wallet/wallet-empty";
    render(<WalletLedger />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "حساب بنكي" })).toBeTruthy());
    expect(screen.queryByRole("button", { name: /وزّع على هذه المحفظة/ })).toBeNull();
  });
});
