/** @vitest-environment jsdom */
/* Wave 4.3 — P-4.3-3 (D9): سلامة الحسابات المقروءة.
 * ---------------------------------------------------------------------------
 * السجلات المتأثرة تُعرض بأسماء عملياتها وتواريخها ومبالغها وروابطها،
 * لا بمعرّفات تقنية خام — عبر إثراء قراءة فقط في الخدمة (لا فحص يتغير
 * ولا عدد ولا منطق)، والمعرّف الخام يبقى احتياطًا لما لا يمكن حلّه.
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { IntegrityCheckService } from "@/application/finance/integrityCheckService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { StatementService } from "@/application/finance/statementService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { FormDraftService } from "@/application/drafts/formDraftService";
import { ProfileService } from "@/application/profile/profileService";
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

/* تسجيل التزام سليم ثم إفساد أثره المالي مباشرة في المخزن — يكسر MIC-4
 * (حدث لا يطابق أثره المسجل عقد المجال) فينشأ متأثرون حقيقيون للعرض. */
async function seedCorruptedEvent(store: MemoryLocalStore, services: ReturnType<typeof buildRealServices>) {
  const recorded = await services.projectFinance.record({
    type: "operating_expense_payable",
    amountMinor: 12000,
    occurredOn: "2026-09-01",
    note: "فاتورة مورد",
    counterparty: "المورد",
    relatedEventId: null,
    expenseContext: {
      relationship: "project",
      behavior: "fixed",
      purpose: "project_general",
      knowledge: "known",
      sharedProjectShare: null,
      categoryLabel: "مواد",
    },
    idempotencyKey: "w43-corrupt-payable",
  });
  if (!recorded.ok) throw new Error(recorded.message);
  const events = await store.listFinancialEvents();
  if (!events.ok) throw new Error(events.message);
  const target = events.value.find(event => event.id === recorded.value.id);
  if (!target) throw new Error("seeded event missing");
  /* تزوير الأثر المحفوظ (لا المبلغ) يكسر تطابق الاشتقاق — فحص القراءة يلتقطه. */
  const saved = await store.saveFinancialEvent({ ...target, amountMinor: 99000 });
  if (!saved.ok) throw new Error(saved.message);
  return target;
}

describe("Wave 4.3 — P-4.3-3 (D9): readable integrity offenders", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("the service enriches offender ids into readable summaries without changing check logic", async () => {
    const store = new MemoryLocalStore();
    const services = buildRealServices(store);
    await new ProfileService(store, now).save("مشغل سلامة مقروءة");
    const target = await seedCorruptedEvent(store, services);
    const report = await services.integrityCheck.run();
    const mic4 = report.checks.find(check => check.id === "MIC-4");
    expect(mic4?.status).toBe("FAIL");
    /* العدد والمنطق كما هما — الملخص المقروء إضافة عرض فقط. */
    expect(mic4?.offenderCount).toBe(1);
    const summary = mic4?.offenderSample?.[0];
    expect(summary).toMatchObject({
      id: target.id,
      kind: "financial_event",
      dateLocal: "2026-09-01",
      amountMinor: 99000,
      href: `/finance?layer=events&event=${encodeURIComponent(target.id)}`,
    });
    expect(summary?.eventType).toBe("operating_expense_payable");
  });

  it("the surface renders offender rows by operation name, date, and amount — not raw ids", async () => {
    const store = new MemoryLocalStore();
    const services = buildRealServices(store);
    await new ProfileService(store, now).save("مشغل سلامة مقروءة");
    const target = await seedCorruptedEvent(store, services);
    mockedUsePrototypeServices.mockReturnValue({
      ...services,
      formDrafts: new FormDraftService(store),
      dataVersion: 0,
      notifyDataChanged: vi.fn(),
    } as unknown as ReturnType<typeof usePrototypeServices>);
    render(<ToolsIntegrity />);
    fireEvent.click(screen.getByRole("button", { name: /افحص الآن/ }));
    const offender = await screen.findByTestId("integrity-offender-summary");
    /* اسم العملية من خريطة العرض القائمة + التاريخ (نسق العرض المحلي) + المبلغ — لا معرّف خام. */
    expect(offender.textContent).toContain("مصروف مستحق");
    expect(offender.textContent).toContain("01/09/2026");
    expect(offender.textContent).toContain("990.00");
    expect(offender.textContent).not.toContain(target.id);
    /* رابط السجل المتأثر موجود ويحمل وصلة الحدث العميقة القانونية. */
    const openButton = offender.querySelector("button");
    expect(openButton?.getAttribute("class")).toContain("micro-text-action");
  });
});
