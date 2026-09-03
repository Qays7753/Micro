/** @vitest-environment jsdom */
/* المجموعة ١ (فحص سلامة مالي — السطح): تشغيل الفحص من الصفحة يعرض الخلاصة
 * وبطاقات الفحوص بكلمة وأيقونة، والروابط العميقة تُبنى، والمخزن لا يتغير
 * (صفر كتابات) — الخدمات حقيقية فوق مخزن الذاكرة نفسه. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { IntegrityCheckService } from "@/application/finance/integrityCheckService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { StatementService } from "@/application/finance/statementService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import ToolsIntegrity from "@/pages/ToolsIntegrity";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);

const now = () => "2026-09-03T09:00:00.000Z";

function buildRealServices(store: MemoryLocalStore) {
  const projectFinance = new ProjectFinancialService(store, now);
  const statement = new StatementService(store, projectFinance);
  const cashContinuity = new CashContinuityService(store, now);
  const integrityCheck = new IntegrityCheckService(store, projectFinance, statement, cashContinuity, now);
  return { projectFinance, statement, cashContinuity, integrityCheck };
}

describe("ToolsIntegrity page (فحص سلامة مالي)", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("idle state promises read-only, run renders the verdict and check cards, and the store is untouched", async () => {
    const store = new MemoryLocalStore();
    const services = buildRealServices(store);
    await services.projectFinance.record({
      type: "owner_investment_cash",
      amountMinor: 100000,
      occurredOn: "2026-09-01",
      note: "استثمار",
      counterparty: null,
      relatedEventId: null,
      idempotencyKey: "page-integrity-inv",
    });
    const snapshotBefore = await store.readSnapshot();
    mockedUsePrototypeServices.mockReturnValue({
      ...services,
      dataVersion: 0,
      notifyDataChanged: vi.fn(),
    } as unknown as ReturnType<typeof usePrototypeServices>);
    render(<ToolsIntegrity />);

    /* الحالة الابتدائية: الوعد المعلن + لم يُجرَ الفحص بعد. */
    expect(screen.getByText("يقرأ أرقامك ولا يغيّر شيئًا.")).toBeTruthy();
    expect(screen.getByText(/لم يُجرَ الفحص بعد/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /افحص الآن/ }));
    expect(await screen.findByText(/الأرقام متسقة/)).toBeTruthy();
    /* الحالة كلمة لا لونًا: سليم ظاهرة نصًّا لكل فحص ناجح. */
    expect(screen.getAllByText("سليم").length).toBeGreaterThanOrEqual(5);
    expect(screen.getByText("تطابق نتيجة الفترة")).toBeTruthy();
    expect(screen.getByText("بنية الكاش والمحافظ")).toBeTruthy();
    expect(screen.getByText("سلامة الأحداث والتوزيع")).toBeTruthy();
    expect(screen.getByText("رصيد الأمانات")).toBeTruthy();
    expect(screen.getByText("صدق درجة المعرفة")).toBeTruthy();

    /* صفر كتابات: اللقطة قبل وبعد متطابقة تمامًا. */
    const snapshotAfter = await store.readSnapshot();
    if (!snapshotBefore.ok || !snapshotAfter.ok) throw new Error("snapshot reads should succeed");
    expect(JSON.stringify(snapshotAfter.value)).toBe(JSON.stringify(snapshotBefore.value));
  });

  it("a failing check renders its deep link to the focused event row", async () => {
    const store = new MemoryLocalStore();
    const services = buildRealServices(store);
    const recorded = await services.projectFinance.record({
      type: "operating_expense_cash",
      amountMinor: 2500,
      occurredOn: "2026-09-02",
      note: "بنزين",
      counterparty: null,
      relatedEventId: null,
      expenseContext: {
        relationship: "project",
        behavior: "variable",
        purpose: "project_general",
        knowledge: "known",
        sharedProjectShare: null,
      },
      idempotencyKey: "page-integrity-expense",
    });
    if (!recorded.ok) throw new Error(recorded.message);
    /* تلف مزروع: تعديل الدلتا مباشرة في المخزن (تجاوز المسار الحي). */
    await store.saveFinancialEvent({ ...recorded.value, cashDeltaMinor: -999 });
    mockedUsePrototypeServices.mockReturnValue({
      ...services,
      dataVersion: 0,
      notifyDataChanged: vi.fn(),
    } as unknown as ReturnType<typeof usePrototypeServices>);
    render(<ToolsIntegrity />);
    fireEvent.click(screen.getByRole("button", { name: /افحص الآن/ }));
    expect(await screen.findByText(/يوجد خلل يحتاج تصحيحًا موثقًا/)).toBeTruthy();
    expect(screen.getAllByText("خلل").length).toBeGreaterThan(0);
    const openLink = screen.getByRole("button", { name: "افتح السجل المعني" });
    expect(openLink).toBeTruthy();
    expect(screen.getByText(/أعرض السجلات المتأثرة/)).toBeTruthy();
  });
});
