/** @vitest-environment jsdom */

/* D-005: أفعال التصحيح الثلاثة (تعديل ذرّي / حذف موثق / استرجاع) تصل الواجهة من صف
 * الحدث نفسه، بأثر معروض قبل التأكيد وسبب مطلوب حيث يلزم. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { AssetService } from "@/application/assets/assetService";
import { LoanService } from "@/application/loans/loanService";
import { RetainedDepositService } from "@/application/finance/retainedDepositService";
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
    /* المجموعة ٢ (عقد ٢٨): خدمة المخزون الحقيقية فوق مخزن الذاكرة. */
    inventory: new InventoryMaterialService(store, () => NOW),
    /* المجموعة ٤ (عقد ٢٩): خدمات الأصول والقروض والعربون فوق مخزن الذاكرة. */
    assets: new AssetService(store, () => NOW),
    loans: new LoanService(store, () => NOW),
    retainedDeposits: new RetainedDepositService(store, () => NOW),
    dataVersion: version,
    notifyDataChanged: () => setVersion(current => current + 1),
  };
  return <Finance />;
}

async function openEventsLayer() {
  render(<FinanceHarness />);
  await waitFor(() => expect(screen.queryByText("جارٍ قراءة الوضع المالي المحلي…")).not.toBeTruthy());
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
    fireEvent.click(screen.getByRole("button", { name: "تعديل العملية" }));
    /* مراجعة الأثر قبل التأكيد ظاهرة. */
    expect(screen.getByText("مراجعة قبل التعديل")).toBeTruthy();
    /* النموذج معبّأ بقيم الحدث الحالية. */
    const amountInput = screen.getByLabelText("المبلغ الجديد") as HTMLInputElement;
    expect(amountInput.value).not.toBe("");
    /* سبب فارغ: يُرفض ولا يتغير السجل. */
    fireEvent.click(screen.getByRole("button", { name: "أكّد تعديل العملية" }));
    await waitFor(() =>
      expect(
        screen.getByText("سبب التعديل مطلوب؛ التصحيح المالي يوثَّق بسبب واضح لا يُترك فارغًا."),
      ).toBeTruthy(),
    );
    /* تعبئة السبب وتغيير المبلغ ثم التأكيد. */
    fireEvent.change(screen.getByPlaceholderText("مثال: المبلغ الصحيح 12 دينارًا لا 21"), {
      target: { value: "الفاتورة 45 لا 50" },
    });
    fireEvent.change(amountInput, { target: { value: "45.00" } });
    fireEvent.click(screen.getByRole("button", { name: "أكّد تعديل العملية" }));
    await waitFor(() =>
      expect(
        screen.getByText("تم تعديل العملية — أرقامك تعرض القيم الجديدة، والقديمة محفوظة في السجل."),
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
    fireEvent.click(screen.getByRole("button", { name: "حذف العملية" }));
    expect(screen.getByText("حذف العملية", { selector: "strong" })).toBeTruthy(); /* عنوان المعاينة */
    /* سبب الحذف إلزامي. */
    fireEvent.click(screen.getByRole("button", { name: "أكّد حذف العملية" }));
    await waitFor(() =>
      expect(
        screen.getByText("سبب الحذف مطلوب؛ «حذف العملية» يُلغي الأثر ويبقى مع سببه في السجل — لا محو."),
      ).toBeTruthy(),
    );
    fireEvent.change(screen.getByPlaceholderText("مثال: حدث اختباري سُجّل بالخطأ"), {
      target: { value: "حدث اختباري" },
    });
    fireEvent.click(screen.getByRole("button", { name: "أكّد حذف العملية" }));
    await waitFor(() =>
      expect(screen.getByText("حُذفت العملية — أثرها صار خارج أرقامك، وأصلها باقٍ في السجل.")).toBeTruthy(),
    );
    /* الاسترجاع يعيد القيم الأصلية حدثًا جديدًا بعد التراجع. */
    await waitFor(() => expect(screen.getByRole("button", { name: "التراجع عن التصحيح" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "التراجع عن التصحيح" }));
    expect(screen.getByText("مراجعة قبل التراجع عن التصحيح")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "أكّد التراجع عن التصحيح" }));
    await waitFor(() =>
      expect(
        screen.getByText("تم التراجع عن التصحيح — عادت أرقام العملية كما كانت قبل التصحيح."),
      ).toBeTruthy(),
    );
    const events = await store.listFinancialEvents();
    if (!events.ok) throw new Error("events should list");
    const restored = events.value.find(event => event.idempotencyKey === `restore:${expense.id}`);
    expect(restored).toMatchObject({ type: "operating_expense_cash", amountMinor: 7000 });
  });

  /* Conflict H (WF-04): تصنيف المصروف يُصحَّح بعد الحفظ من نفس مسار «تعديل العملية»
   * — البديل يحمل الوسم الجديد، والأصل والتراجع يحتفظان بالقديم. */
  it("corrects the expense classification after save through the edit flow", async () => {
    const expense = await recordExpense(4200, "d005-expense-classify");
    await openEventsLayer();
    fireEvent.click(screen.getByText("عرض الأثر الكامل"));
    fireEvent.click(screen.getByRole("button", { name: "تعديل العملية" }));
    /* قسم تصحيح التصنيف يظهر لأحداث المصروف فقط ويبدأ من التصنيف الحالي. */
    const classificationToggle = await screen.findByRole("button", { name: "صحّح تصنيف المصروف" });
    fireEvent.click(classificationToggle);
    const labelInput = screen.getByLabelText("وسم تصنيف المصروف") as HTMLInputElement;
    expect(labelInput.value).toBe("");
    fireEvent.change(labelInput, { target: { value: "وقود" } });
    fireEvent.change(screen.getByLabelText("غرض المصروف"), { target: { value: "campaign" } });
    fireEvent.change(screen.getByLabelText("معرفة تكلفة المصروف"), { target: { value: "estimated" } });
    fireEvent.change(screen.getByPlaceholderText("مثال: المبلغ الصحيح 12 دينارًا لا 21"), {
      target: { value: "هذا وقود حملة لا توصيل" },
    });
    fireEvent.click(screen.getByRole("button", { name: "أكّد تعديل العملية" }));
    await waitFor(() =>
      expect(
        screen.getByText("تم تعديل العملية — أرقامك تعرض القيم الجديدة، والقديمة محفوظة في السجل."),
      ).toBeTruthy(),
    );
    const events = await store.listFinancialEvents();
    if (!events.ok) throw new Error("events should list");
    const replacement = events.value.find(event => event.idempotencyKey === `edit:${expense.id}`);
    expect(replacement?.expenseContext?.categoryLabel).toBe("وقود");
    expect(replacement?.expenseContext?.purpose).toBe("campaign");
    expect(replacement?.expenseContext?.knowledge).toBe("estimated");
    expect(replacement?.cashDeltaMinor).toBe(-4200);
    const source = events.value.find(event => event.id === expense.id);
    expect(source?.expenseContext?.categoryLabel ?? null).toBeNull();
    expect(source?.expenseContext?.purpose).toBe("order");
  });
});
