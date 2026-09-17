/** @vitest-environment jsdom */

/* Wave 4.2 — P-4.2-4 (F01/F05 + REV-003): حارس سطح «المالية ← المزيد».
 * - سطح قراءة يبقي الشريط (routeClassifier: surface لا deep).
 * - مداخل منظمة: سلامة الحسابات أولًا، ثم الملخصات والتقارير، ثم الأدوات
 *   المالية المتقدمة، ثم المالك والسياسات في مواضعها المعتمدة.
 * - كل مدخل يفتح بيته المالك بreturnTo=/finance/more (عقد ٢٦ قاعدة ٤).
 * - REV-003 (الخيار أ — التوافق): الروابط العميقة القائمة ?layer=/?event=
 *   تُنتج من السطح الجديد كما هي — بلا ترحيل ولا كسر.
 * - فحص السلامة: مساره التقني /tools/integrity يبقى، ورجوعه ديناميكي حسب
 *   المصدر، وبديله الكنوني صار /finance/more. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { IntegrityCheckService } from "@/application/finance/integrityCheckService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { StatementService } from "@/application/finance/statementService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import FinanceMore from "@/pages/FinanceMore";
import ToolsIntegrity from "@/pages/ToolsIntegrity";
import { canonicalReturnFor } from "@/app/navigationContract";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({ navigate: vi.fn(), location: "/finance/more" }));

vi.mock("wouter", () => ({
  useSearch: () => {
    const query = wouterMocks.location.split("?")[1] ?? "";
    return query ? `?${query}` : "";
  },
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => ({}),
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);

function renderAt(location: string) {
  wouterMocks.location = location;
  wouterMocks.navigate.mockClear();
  return render(<FinanceMore />);
}

describe("P-4.2-4 — سطح «المالية ← المزيد» وREV-003", () => {
  beforeEach(() => {
    mockedUsePrototypeServices.mockReturnValue({
      integrityCheck: new IntegrityCheckService(
        new MemoryLocalStore(),
        new ProjectFinancialService(new MemoryLocalStore()),
        new StatementService(new MemoryLocalStore(), new ProjectFinancialService(new MemoryLocalStore())),
        new CashContinuityService(new MemoryLocalStore()),
      ),
    } as unknown as ReturnType<typeof usePrototypeServices>);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("البداية الباردة: سطح قراءة منظم — سلامة الحسابات أولًا ثم المجموعات الأربع بترتيبها", () => {
    renderAt("/finance/more");
    expect(screen.getByRole("heading", { name: "المزيد من المالية" })).toBeTruthy();
    expect(screen.getByText(/قراءات وتنظيم أعمق — كل رقم يفتح مصدره/)).toBeTruthy();

    /* سلامة الحسابات أولًا دائمًا (بطاقة القرار قبل أي مجموعة). */
    const integrityCard = screen.getByRole("button", { name: /افتح سلامة الحسابات/ }).closest("section");
    const firstGroupHeading = screen.getByRole("heading", { name: "ملخصات وتقارير" });
    expect(integrityCard).not.toBeNull();
    expect(
      (integrityCard as HTMLElement).compareDocumentPosition(firstGroupHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    /* المجموعات الأربع المنظمة. */
    expect(screen.getByRole("heading", { name: "ملخصات وتقارير" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "أدوات مالية متقدمة" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "المالك والسياسات" })).toBeTruthy();

    /* الرجوع: بديل قانوني = المالية؛ من الرئيسية يسميها. */
    expect(screen.getByRole("button", { name: /رجوع/ })).toBeTruthy();
  });

  it("الرجوع من السطح: البديل الكنوني المالية، ومن الرئيسية يسمي وجهتها", () => {
    const { unmount } = renderAt("/finance/more");
    fireEvent.click(screen.getByRole("button", { name: /رجوع|المالية/ }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/finance");
    unmount();

    renderAt("/finance/more?returnTo=%2F");
    expect(screen.getByRole("button", { name: "مشروعي الآن" })).toBeTruthy();
  });

  it("كل مدخل يفتح بيته المالك بreturnTo=/finance/more (عقد ٢٦ قاعدة ٤)", () => {
    renderAt("/finance/more");
    /* زر الفعل داخل بطاقة/صف المدخل: أول زر في حاوية العنوان (article أو section). */
    const clickEntry = (label: string) => {
      const labelNode = screen.getByText(label);
      const container = labelNode.closest("article") ?? labelNode.closest("section");
      const button = container?.querySelector("button");
      expect(button, `زر مدخل «${label}» غير موجود`).toBeTruthy();
      fireEvent.click(button as HTMLElement);
    };
    const entries: readonly [string, string][] = [
      ["سلامة الحسابات", "/tools/integrity"],
      ["كشف الفترة", "/finance/statement"],
      ["آخر ما حدث", "/finance/activity"],
      ["سجل الأحداث المالية", "/finance?layer=events"],
      ["سجل التصحيحات الموثقة", "/finance?layer=corrections"],
      ["عدّ الصندوق", "/cash/count"],
      ["مال المالك — الدفتر الموحد", "/finance/owner-entitlement"],
      ["اسحب لنفسك", "/finance/withdraw"],
      ["أدخل مالًا للمشروع", "/finance/new/owner_investment_cash"],
      ["سياسات الربح والتوزيع", "/catalog"],
    ];
    for (const [label] of entries) clickEntry(label);
    const calls = wouterMocks.navigate.mock.calls.map(call => call[0]);
    for (const [, target] of entries) {
      expect(calls).toContain(`${target}${target.includes("?") ? "&" : "?"}returnTo=%2Ffinance%2Fmore`);
    }
  });

  it("REV-003 (خيار أ): الروابط العميقة القائمة تُنتج كما هي — ?layer و?event بلا ترحيل", () => {
    renderAt("/finance/more");
    const clickEntry = (label: string) => {
      const labelNode = screen.getByText(label);
      const container = labelNode.closest("article") ?? labelNode.closest("section");
      fireEvent.click(container?.querySelector("button") as HTMLElement);
    };
    clickEntry("سجل الأحداث المالية");
    clickEntry("سجل التصحيحات الموثقة");
    const calls = wouterMocks.navigate.mock.calls.map(call => call[0]);
    expect(calls).toContain("/finance?layer=events&returnTo=%2Ffinance%2Fmore");
    expect(calls).toContain("/finance?layer=corrections&returnTo=%2Ffinance%2Fmore");
  });

  it("البدائل القانونية: /finance/more → /finance و/tools/integrity → /finance/more (تحديث موثق واحد)", () => {
    expect(canonicalReturnFor("/finance/more")).toBe("/finance");
    expect(canonicalReturnFor("/tools/integrity")).toBe("/finance/more");
    /* وجهة غير صالحة تسقط للبديل العام — لا حلقة (قاعدة §2.1-6). */
    expect(canonicalReturnFor("/finance/more?returnTo=/finance/more")).toBe("/finance");
  });

  it("فحص السلامة: الرجوع ديناميكي حسب المصدر — لا «أدواتي» لمن دخل من المالية", async () => {
    /* من سطح «المزيد»: الزر يسمي وجهته. */
    wouterMocks.location = "/tools/integrity?returnTo=%2Ffinance%2Fmore";
    const { unmount } = render(<ToolsIntegrity />);
    expect(screen.getByRole("heading", { name: "سلامة الحسابات" })).toBeTruthy();
    const backButton = screen.getByRole("button", { name: /المزيد من المالية/ });
    fireEvent.click(backButton);
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/finance/more");
    unmount();

    /* البدء البارد بلا مصدر: البديل الكنوني الجديد (سطح «المزيد»). */
    wouterMocks.location = "/tools/integrity";
    render(<ToolsIntegrity />);
    fireEvent.click(screen.getByRole("button", { name: /المزيد من المالية/ }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/finance/more");

    /* من الإعدادات (رابط نتيجة الاستعادة): يرجع للإعدادات لا لأدواتي. */
    cleanup();
    wouterMocks.location = "/tools/integrity?returnTo=%2Fsettings";
    render(<ToolsIntegrity />);
    fireEvent.click(screen.getByRole("button", { name: "الإعدادات" }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/settings");
    await waitFor(() => expect(screen.getByRole("heading", { name: "سلامة الحسابات" })).toBeTruthy());
  });
});
