/** @vitest-environment jsdom */

/* D-005: أفعال التصحيح الثلاثة (تعديل ذرّي / حذف موثق / استرجاع) تصل الواجهة من صف
 * الحدث نفسه، بأثر معروض قبل التأكيد وسبب مطلوب حيث يلزم. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { G5Service } from "@/application/g5/g5Service";
import { OwnerEntitlementService } from "@/application/finance/ownerEntitlementService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { CorrectionHistoryService } from "@/application/finance/correctionHistoryService";
import { FinancialPulseService } from "@/application/financial-pulse/financialPulseService";
import { FulfillmentService } from "@/application/fulfillment/fulfillmentService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import Finance from "@/pages/Finance";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock("wouter", () => ({
  useLocation: () => ["/finance", wouterMocks.navigate],
  useParams: () => ({}),
  useSearch: () => "",
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-08-29T09:00:00.000Z";
let store: MemoryLocalStore;
let projectFinance: ProjectFinancialService;
/* حامل ديناميكي: notifyDataChanged يرفع dataVersion فيعيد Finance التحميل —
 * كما يفعل المزود الحقيقي، كي يظهر زر الاسترجاع بعد التراجع فعلًا. */
const contextRef: { current: Record<string, unknown> } = { current: {} };
function FinanceHarness() {
  const [version, setVersion] = React.useState(0);
  contextRef.current = {
    projectFinance,
    correctionHistory: new CorrectionHistoryService(store),
    ownerEntitlement: new OwnerEntitlementService(
      store,
      (from: string, to: string) => projectFinance.readRecordedPeriodResult(from, to),
      () => NOW,
    ),
    g5: new G5Service(store, projectFinance, () => NOW),
    financialPulse: new FinancialPulseService(store),
    fulfillment: new FulfillmentService(store, () => NOW),
    dataVersion: version,
    notifyDataChanged: () => setVersion(current => current + 1),
  };
  return <Finance />;
}

async function openEventsLayer() {
  render(<FinanceHarness />);
  await waitFor(() =>
    expect(screen.queryByText("جارٍ قراءة الوضع المالي المحلي…")).not.toBeTruthy(),
  );
  const summary = Array.from(document.querySelectorAll("summary")).find(node =>
    node.textContent?.includes("السجل والأثر"),
  );
  if (!summary) throw new Error("events layer summary should exist");
  fireEvent.click(summary);
  await waitFor(() => expect(screen.getByText("أحدث الأحداث العامة")).toBeTruthy());
}

async function recordExpense(amountMinor: number, key: string) {
  const result = await projectFinance.record({
    type: "operating_expense_cash",
    amountMinor,
    occurredOn: "2026-08-10",
    note: "مصروف توصيل",
    counterparty: "ناقل",
    relatedEventId: null,
    expenseContext: {
      relationship: "project",
      behavior: "variable",
      purpose: "order",
      knowledge: "known",
    },
    idempotencyKey: key,
  });
  if (!result.ok) throw new Error("expense should save");
  return result.value;
}

describe("D-005 corrections reach the UI from the event row", () => {
  beforeEach(() => {
    store = new MemoryLocalStore();
    projectFinance = new ProjectFinancialService(store, () => NOW);
    mockedUsePrototypeServices.mockImplementation(
      () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
    );
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("edits an event atomically from a prefilled form and requires a reason", async () => {
    await recordExpense(5000, "d005-expense-edit");
    await openEventsLayer();
    fireEvent.click(screen.getByText("عرض الأثر الكامل"));
    fireEvent.click(screen.getByText("عدّل بقيم جديدة"));
    /* مراجعة الأثر قبل التأكيد ظاهرة. */
    expect(screen.getByText("مراجعة قبل التعديل")).toBeTruthy();
    /* النموذج معبّأ بقيم الحدث الحالية. */
    const amountInput = screen.getByLabelText("المبلغ الجديد") as HTMLInputElement;
    expect(amountInput.value).not.toBe("");
    /* سبب فارغ: يُرفض ولا يتغير السجل. */
    fireEvent.click(screen.getByText("أكّد التعديل الذرّي"));
    await waitFor(() =>
      expect(screen.getByText("سبب التعديل مطلوب؛ التصحيح المالي يوثَّق بسبب واضح لا يُترك فارغًا.")).toBeTruthy(),
    );
    /* تعبئة السبب وتغيير المبلغ ثم التأكيد. */
    fireEvent.change(screen.getByPlaceholderText("مثال: المبلغ الصحيح ١٢ دينارًا لا ٢١"), {
      target: { value: "الفاتورة ٤٥ لا ٥٠" },
    });
    fireEvent.change(amountInput, { target: { value: "45.00" } });
    fireEvent.click(screen.getByText("أكّد التعديل الذرّي"));
    await waitFor(() =>
      expect(
        screen.getByText(
          "تم التعديل بتراجع موثق وبديل جديد في معاملة واحدة؛ القيم القديمة باقية في السجل.",
        ),
      ).toBeTruthy(),
    );
    const events = await store.listFinancialEvents();
    if (!events.ok) throw new Error("events should list");
    /* تراجع + بديل موجودان، والبديل بالقيمة الجديدة. */
    expect(events.value.some(event => event.correctionType === "reverse")).toBe(true);
    expect(events.value.some(event => event.amountMinor === 4500 && event.note.includes("مصروف"))).toBe(true);
  });

  it("deletes an event as a documented reversal and restores the original values on demand", async () => {
    const expense = await recordExpense(7000, "d005-expense-delete");
    await openEventsLayer();
    fireEvent.click(screen.getByText("عرض الأثر الكامل"));
    fireEvent.click(screen.getByText("حذف موثق"));
    expect(screen.getByText("حذف موثق (تراجع كامل)")).toBeTruthy();
    /* سبب الحذف إلزامي. */
    fireEvent.click(screen.getByText("أكّد الحذف الموثق"));
    await waitFor(() =>
      expect(
        screen.getByText("سبب الحذف مطلوب؛ «حذف» في هذا النظام تراجع موثق باقٍ في السجل لا محوه."),
      ).toBeTruthy(),
    );
    fireEvent.change(screen.getByPlaceholderText("مثال: حدث اختباري سُجّل بالخطأ"), {
      target: { value: "حدث اختباري" },
    });
    fireEvent.click(screen.getByText("أكّد الحذف الموثق"));
    await waitFor(() =>
      expect(
        screen.getByText("تم حذف الأثر بتراجع موثق؛ السجل الأصلي باقٍ والقيمة صارت خارج الحساب."),
      ).toBeTruthy(),
    );
    /* الاسترجاع يعيد القيم الأصلية حدثًا جديدًا بعد التراجع. */
    await waitFor(() => expect(screen.getByText("استرجع القيم الأصلية")).toBeTruthy());
    fireEvent.click(screen.getByText("استرجع القيم الأصلية"));
    expect(screen.getByText("مراجعة قبل الاسترجاع")).toBeTruthy();
    fireEvent.click(screen.getByText("أكّد استرجاع القيم الأصلية"));
    await waitFor(() =>
      expect(
        screen.getByText("أُعيد تسجيل القيم الأصلية كحدث جديد؛ التراجع السابق باقٍ في السجل."),
      ).toBeTruthy(),
    );
    const events = await store.listFinancialEvents();
    if (!events.ok) throw new Error("events should list");
    const restored = events.value.find(
      event => event.idempotencyKey === `restore:${expense.id}`,
    );
    expect(restored).toMatchObject({ type: "operating_expense_cash", amountMinor: 7000 });
  });
});
