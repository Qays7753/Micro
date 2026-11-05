/** @vitest-environment jsdom */

/* F-002 (UXR-03 — أمر W02/UXR-D09): مدخل المصروف الموحد — سؤال حالة الدفع
 * الصريح قبل الحفظ، ثم التوجيه لمحرري المدفوع/المستحق القائمين
 * (operating_expense_cash / operating_expense_payable) بreturnTo=/finance.
 *
 * العطل المُثبت (المسح الشامل 2026-11-04): الزر العام من الجذر ومن اللوحة
 * كان ينقل إلى النوع المركب operating_expense الذي لا يعرفه محرر الأحداث
 * (يقبل _cash/_payable فقط) فيصل المستخدم «نوع الحدث غير متاح» — طريق
 * مسدود. توصية V1 «وجه للنقدي الأقرب» ممنوعة: لا يوجد سؤال دفع داخل المحرر
 * النقدي، وتوجيه الزر العام إلى _cash يفرض «مدفوع» على نية عامة.
 *
 * العقد الجديد (UXR-D09): مدخل واحد واضح يحدد حالة الدفع قبل الحفظ —
 * خيار صريح «دفعت الآن»/«لم أدفع بعد» يعيد استخدام المحررين ودفعاتهما
 * القائمين (لا كاتب ثالث ولا تحويل تلقائي لمدفوع)؛ الإلغاء لا يكتب ولا
 * ينتقل. الرابط الفعلي يُفحص من الصفحة نفسها (لا location مُسخرًا). */
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { withReturnTo } from "@/app/navigationContract";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { CorrectionHistoryService } from "@/application/financial-records/correctionHistoryService";
import { OwnerEntitlementService } from "@/application/owner-money/ownerEntitlementService";
import { G5Service } from "@/application/financial-analysis/financialAnalysisService";
import { FinancialPulseService } from "@/application/financial-pulse/financialPulseService";
import { ProfitToCashBridgeService } from "@/application/finance/profitToCashBridgeService";
import { ProfileService } from "@/application/profile/profileService";
import Finance from "@/pages/Finance";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/finance",
  params: {} as Record<string, string>,
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => wouterMocks.params,
  useSearch: () => "",
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-09-12T09:00:00.000Z";

let store: MemoryLocalStore;

function buildServices() {
  const projectFinance = new ProjectFinancialService(store, () => NOW);
  return {
    projectFinance,
    correctionHistory: new CorrectionHistoryService(store),
    ownerEntitlement: new OwnerEntitlementService(
      store,
      (from, to) => projectFinance.readRecordedPeriodResult(from, to),
      () => NOW,
    ),
    g5: new G5Service(store, projectFinance, () => NOW),
    financialPulse: new FinancialPulseService(store),
    inventory: new InventoryMaterialService(store, () => NOW),
    profitToCashBridge: new ProfitToCashBridgeService(store, () => NOW),
    cashContinuity: new CashContinuityService(store, () => NOW),
    dataVersion: 0,
    notifyDataChanged: () => {},
  } as unknown as ReturnType<typeof usePrototypeServices>;
}

beforeEach(() => {
  store = new MemoryLocalStore();
  mockedUsePrototypeServices.mockReturnValue(buildServices());
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function seedProfile() {
  const result = await new ProfileService(store, () => NOW).create("مشغل مدخل المصروف");
  if (!result.ok) throw new Error(result.message);
}

function renderFinance() {
  return render(
    <UnsavedChangesProvider navigate={wouterMocks.navigate}>
      <Finance />
    </UnsavedChangesProvider>,
  );
}

describe("F-002 — مدخل المصروف الموحد بحالة الدفع (UXR-03/UXR-D09)", () => {
  it("زر «تسجيل مصروف» من الجذر يفتح سؤال حالة الدفع — لا انتقال للنوع الميت", async () => {
    await seedProfile();
    renderFinance();
    expect(await screen.findByRole("heading", { level: 1, name: "المالية" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "مصروف" }));
    /* السؤال الصريح يفتح فوق الصفحة — لا كتابة ولا انتقال بعد. */
    const chooser = screen.getByRole("dialog", { name: "حالة دفع المصروف" });
    expect(within(chooser).getByRole("button", { name: /دفعت الآن/ })).toBeTruthy();
    expect(within(chooser).getByRole("button", { name: /لم أدفع بعد/ })).toBeTruthy();
    expect(wouterMocks.navigate).not.toHaveBeenCalled();
  });

  it("«دفعت الآن» يوجه لمحرر المصروف المدفوع القائم بreturnTo=/finance — الرابط الفعلي لا نوع مركب", async () => {
    await seedProfile();
    renderFinance();
    expect(await screen.findByRole("heading", { level: 1, name: "المالية" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "مصروف" }));
    fireEvent.click(screen.getByRole("button", { name: /دفعت الآن/ }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith(
      withReturnTo("/finance/new/operating_expense_cash", "/finance"),
    );
    /* النوع الميت لا يُنتج أبدًا من أي مسار. */
    expect(
      wouterMocks.navigate.mock.calls.some(call => String(call[0]).includes("/finance/new/operating_expense?")),
    ).toBe(false);
    expect(screen.queryByRole("dialog", { name: "حالة دفع المصروف" })).toBeNull();
  });

  it("«لم أدفع بعد» يوجه لمحرر المصروف المستحق القائم — لا افتراض مدفوع على نية عامة", async () => {
    await seedProfile();
    renderFinance();
    expect(await screen.findByRole("heading", { level: 1, name: "المالية" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "مصروف" }));
    fireEvent.click(screen.getByRole("button", { name: /لم أدفع بعد/ }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith(
      withReturnTo("/finance/new/operating_expense_payable", "/finance"),
    );
  });

  it("الإلغاء (زر/Escape/الخلفية) يغلق السؤال بلا انتقال ولا كتابة ويعيد التركيز للزر الظاهر", async () => {
    await seedProfile();
    renderFinance();
    expect(await screen.findByRole("heading", { level: 1, name: "المالية" })).toBeTruthy();
    const trigger = screen.getByRole("button", { name: "مصروف" });
    /* الإلغاء بالزر. */
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("dialog", { name: "حالة دفع المصروف" }).querySelector("button")!);
    expect(screen.queryByRole("dialog", { name: "حالة دفع المصروف" })).toBeNull();
    expect(wouterMocks.navigate).not.toHaveBeenCalled();
    /* Escape بعد إعادة الفتح — يعيد التركيز للزر الظاهر. */
    fireEvent.click(trigger);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "حالة دفع المصروف" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(wouterMocks.navigate).not.toHaveBeenCalled();
    /* النقر على الخلفية يغلق بلا انتقال. */
    fireEvent.click(trigger);
    fireEvent.click(document.querySelector(".micro-soon-backdrop")!);
    expect(screen.queryByRole("dialog", { name: "حالة دفع المصروف" })).toBeNull();
    expect(wouterMocks.navigate).not.toHaveBeenCalled();
  });

  it("مدخل اللوحة نفسه يفتح السؤال الصريح بعد إغلاق اللوحة — لا وجهة ميتة ولا كاتب ثالث", async () => {
    await seedProfile();
    renderFinance();
    expect(await screen.findByRole("heading", { level: 1, name: "المالية" })).toBeTruthy();
    /* فتح الفهرس من زره الظاهر ثم مدخل «مصروف» منه (02-FIN). */
    const boardButton = screen.getByRole("button", { name: "كل الوظائف" });
    fireEvent.click(boardButton);
    const board = screen.getByRole("dialog", { name: "وظائف المالية" });
    fireEvent.click(within(board).getByRole("button", { name: /^مصروف/ }));
    /* اللوحة أغلقت والسؤال مفتوح — ثم الخيار يوجه للمحرر القائم نفسه. */
    expect(screen.queryByRole("dialog", { name: "وظائف المالية" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /دفعت الآن/ }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith(
      withReturnTo("/finance/new/operating_expense_cash", "/finance"),
    );
  });
});
