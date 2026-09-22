/** @vitest-environment jsdom */

/* FIN-002 (WS-174 — Wave 2): مسارات DOM لقسم «ميزانيات اختيارية» على ملخص
 * الفترة — الخطة لا حدثًا ماليًا أبدًا. القسم المطوي يحمّل خدمته ديناميكيًا
 * عند أول فتح (سابقة EXE-014): الاستيراد الديناميكي يُترك حقيقيًا فوق
 * MemoryLocalStore يوفره mock جذر التركيب، فتُختبر الخدمة والواجهة معًا من
 * خارج الوحدة كما يفعل مستخدم حقيقي. المعيار الأثقل: لقطة عميقة للعالم
 * المالي كله (الأحداث والطلبات والبيع المباشر ومشتريات الموردين وقيود
 * استمرارية الكاش) قبل إنشاء الميزانية ومراجعتها وإغلاقها وإظهار تجاوزها
 * = نفس اللقطة بعدها بالضبط — الميزانية خطة، لا حدثًا ماليًا واحدًا. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { CorrectionHistoryService } from "@/application/finance/correctionHistoryService";
import { OwnerEntitlementService } from "@/application/finance/ownerEntitlementService";
import { G5Service } from "@/application/g5/g5Service";
import { FinancialPulseService } from "@/application/financial-pulse/financialPulseService";
import { FulfillmentService } from "@/application/fulfillment/fulfillmentService";
import { ScheduleService } from "@/application/scheduling/scheduleService";
import { AssetService } from "@/application/assets/assetService";
import { LoanService } from "@/application/loans/loanService";
import { RetainedDepositService } from "@/application/finance/retainedDepositService";
import { ProfitToCashBridgeService } from "@/application/finance/profitToCashBridgeService";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { SupplierPurchaseService } from "@/application/suppliers/supplierPurchaseService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { AgreementContextService } from "@/application/agreements/agreementContextService";
import { ActivityService } from "@/application/activity/activityService";
import Finance from "@/pages/Finance";
import {
  calculateCostSnapshot,
  collectDeposit,
  collectRemaining,
  createCraftOrder,
  transitionOrder,
  type CraftOrder,
} from "@micro-domain/craft-order/index.js";
import { createExpenseBudget, type BudgetScope } from "@micro-domain/budget/index.js";
import { createFinancialEvent } from "@micro-domain/financial-event/index.js";
import type { StoredCraftOrder } from "@/storage/local/types";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
  /* الخدمة تُبنى داخل الصفحة فوق هذا المخزن عند أول فتح — كما في الإنتاج
   * تمامًا لكن فوق مخزن الذاكرة هنا (الإغلاق على المتغير المتأخر متعمد). */
  getPrototypeLocalStore: () => store,
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/finance",
  search: "view=period",
  params: {} as Record<string, string>,
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => wouterMocks.params,
  useSearch: () => wouterMocks.search,
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
/* ساعة الصفحة داخل آب (2026-08-20) فشهر «ملخص الفترة» الافتراضي هو آب نفسه. */
const NOW = "2026-08-20T09:00:00.000Z";
const RECORDED_AT = "2026-10-05T09:00:00.000Z";
const MONTH = "2026-08";

let store: MemoryLocalStore;
let dataVersion = 0;

function buildServices() {
  const schedules = new ScheduleService(store, () => NOW);
  const projectFinance = new ProjectFinancialService(store, () => NOW);
  const ownerEntitlement = new OwnerEntitlementService(
    store,
    (from: string, to: string) => projectFinance.readRecordedPeriodResult(from, to),
    () => NOW,
  );
  const g5 = new G5Service(store, projectFinance, () => NOW);
  const fulfillment = new FulfillmentService(store, () => NOW);
  return {
    projectFinance,
    correctionHistory: new CorrectionHistoryService(store),
    ownerEntitlement,
    g5,
    financialPulse: new FinancialPulseService(store),
    fulfillment,
    inventory: new InventoryMaterialService(store, () => NOW),
    assets: new AssetService(store, () => NOW),
    loans: new LoanService(store, () => NOW),
    retainedDeposits: new RetainedDepositService(store, () => NOW),
    profitToCashBridge: new ProfitToCashBridgeService(store, () => NOW),
    cashContinuity: new CashContinuityService(store, () => NOW),
    supplierPurchases: new SupplierPurchaseService(store, () => NOW),
    schedules,
    activity: new ActivityService(store),
    agreements: new AgreementContextService(store, () => NOW),
    dataVersion,
    notifyDataChanged: () => {
      dataVersion += 1;
    },
  } as unknown as ReturnType<typeof usePrototypeServices>;
}

function Harness() {
  const services = React.useMemo(() => buildServices(), []);
  mockedUsePrototypeServices.mockImplementation(() => services);
  return (
    <UnsavedChangesProvider navigate={wouterMocks.navigate}>
      <Finance />
    </UnsavedChangesProvider>
  );
}

function knownSnapshot(id: string, timeRateMinor: number) {
  return calculateCostSnapshot(`${id}-cost`, {
    currency: "JOD",
    materialItems: [],
    time: { minutes: 60, hourlyRateMinor: timeRateMinor, confidence: "known" },
    packagingMinor: 0,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 1,
    createdAt: "2026-08-01T09:00:00.000Z",
    freshnessDays: null,
    source: "price_approval",
  });
}

async function saveEvent(store: MemoryLocalStore, input: Parameters<typeof createFinancialEvent>[0]) {
  const saved = await store.saveFinancialEvent(createFinancialEvent(input));
  if (!saved.ok) throw new Error("event should save");
  return saved.value;
}

/** طلب نهائي مسلّم بعربون وتحصيل متبقٍ — كما في اختبار الجسر (w173). */
async function saveCollectedOrder(store: MemoryLocalStore): Promise<void> {
  let order: CraftOrder = createCraftOrder({
    id: "w174-order",
    customerName: "عميلة",
    itemName: "قطعة",
    specifications: "ميزانية اختيارية",
    quantity: 1,
    agreedPriceMinor: 10_000,
    costSnapshot: knownSnapshot("w174-order", 500),
    createdAt: "2026-08-01T08:00:00.000Z",
  });
  order = collectDeposit(order, 2_000, "w174-deposit", "2026-08-03T09:00:00.000Z");
  for (const [to, stamp] of [
    ["provisional_agreement", "2026-08-01T08:30:00.000Z"],
    ["confirmed", "2026-08-01T09:00:00.000Z"],
    ["in_progress", "2026-08-10T09:30:00.000Z"],
    ["ready", "2026-08-10T09:45:00.000Z"],
    ["delivered", "2026-08-10T10:00:00.000Z"],
  ] as const)
    order = transitionOrder(order, { to, idempotencyKey: `w174-${to}`, createdAt: stamp });
  order = collectRemaining(order, 8_000, "w174-remaining", "2026-08-12T09:00:00.000Z");
  const stored: StoredCraftOrder = {
    id: order.id,
    order,
    deliveryDate: "2026-08-10",
    agreementSource: "test",
    catalogItemId: null,
    createdAt: order.createdAt,
    updatedAt: "2026-08-12T09:00:00.000Z",
  };
  const saved = await store.saveOrder(stored);
  if (!saved.ok) throw new Error("order should save");
}

/** بذرة ميزانية عبر المخزن مباشرة — سجل دومين حرفي كما كتبه مالك الخطة. */
async function seedBudget(input: {
  id: string;
  scope: BudgetScope;
  amountMinor: number;
  knowledge?: "known" | "estimated";
  periodKey?: string;
}) {
  const record = createExpenseBudget(
    {
      id: input.id,
      periodKind: "month",
      periodKey: input.periodKey ?? MONTH,
      scope: input.scope,
      amountMinor: input.amountMinor,
      knowledge: input.knowledge ?? "known",
      note: null,
      operationKey: `seed-${input.id}`,
      createdAt: NOW,
    },
    [],
  );
  const saved = await store.saveExpenseBudget(record);
  if (!saved.ok) throw new Error(saved.message);
}

async function seedAugustExpenses() {
  /* حدثان تشغيليان في آب: واحد موسوم بفئة صريحة وآخر بلا فئة — النطاق العام
   * يجمعهما (30.00) وفتحة «تغليف» تجمع الأول وحده (12.00). */
  await saveEvent(store, {
    id: "w174-ev-packaging",
    type: "operating_expense_cash",
    amountMinor: 1_200,
    occurredOn: "2026-08-15",
    recordedAt: RECORDED_AT,
    idempotencyKey: "w174-packaging",
    note: "أكياس تغليف",
    counterparty: null,
    relatedEventId: null,
    expenseContext: {
      relationship: "project",
      behavior: "variable",
      purpose: "project_general",
      knowledge: "known",
      categoryLabel: "تغليف",
    },
  });
  await saveEvent(store, {
    id: "w174-ev-misc",
    type: "operating_expense_cash",
    amountMinor: 1_800,
    occurredOn: "2026-08-18",
    recordedAt: RECORDED_AT,
    idempotencyKey: "w174-misc",
    note: "مستلزمات متنوعة",
    counterparty: null,
    relatedEventId: null,
    expenseContext: {
      relationship: "project",
      behavior: "variable",
      purpose: "project_general",
      knowledge: "known",
    },
  });
}

/** لقطة العالم المالي كله — الأسر الخمس التي يملكها الحدث المالي ورفاقه. */
async function financialWorldSnapshot() {
  const snap = await store.readSnapshot();
  if (!snap.ok) throw new Error(snap.message);
  const { financialEvents, orders, directSales, supplierPurchases, cashContinuityEntries } = snap.value;
  return { financialEvents, orders, directSales, supplierPurchases, cashContinuityEntries };
}

async function budgetsCount() {
  const budgets = await store.listExpenseBudgets();
  if (!budgets.ok) throw new Error(budgets.message);
  return budgets.value.length;
}

async function eventsCount() {
  const events = await store.listFinancialEvents();
  if (!events.ok) throw new Error(events.message);
  return events.value.length;
}

/** فتح القسم المطوي كما يفعل المستخدم — التحميل الديناميكي يبدأ من هنا. */
async function openBudgetsSection() {
  const summary = await screen.findByText("ميزانيات اختيارية");
  /* jsdom لا ينفّذ سلوك <summary> الافتراضي (تبديل open)، فيُعيين open
   * ويُطلق حدث toggle يدويًا كما تفعل المتصفحات عند فتح التفاصيل. */
  const details = summary.closest("details")!;
  details.open = true;
  fireEvent(details, new Event("toggle", { bubbles: true }));
  const section = document.querySelector<HTMLElement>("details.micro-expense-budgets");
  if (!section) throw new Error("budgets section should exist");
  return section;
}

/** انتظار جاهزية الجسم: قراءة الخدمة الديناميكية اكتملت والقائمة رسمت. */
async function waitForBudgetsBody() {
  await waitFor(() => {
    expect(document.querySelector(".micro-expense-budgets .micro-budget-add")).toBeTruthy();
  });
  return document.querySelector("details.micro-expense-budgets")!;
}

beforeEach(() => {
  store = new MemoryLocalStore();
  vi.useFakeTimers({ now: new Date(NOW), toFake: ["Date"] });
  dataVersion = 0;
  wouterMocks.search = "view=period";
  wouterMocks.navigate.mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("FIN-002 — ميزانيات اختيارية على ملخص الفترة (WS-174)", () => {
  it("يعرض القسم ساكنًا مطويًا، وفتحه يحمّل الخدمة ديناميكيًا ويسرد الميزانيتين بحالتَيهما الصادقتين", async () => {
    await seedBudget({ id: "w174-b-general", scope: { kind: "general_expense" }, amountMinor: 5_000 });
    await seedBudget({
      id: "w174-b-packaging",
      scope: { kind: "category", categoryLabel: "تغليف" },
      amountMinor: 2_000,
      knowledge: "estimated",
    });
    render(<Harness />);
    const summary = await screen.findByText("ميزانيات اختيارية");
    /* السكون: القسم مطوي وجسمه غير محمّل — لا شيء إلزامي على الصفحة. */
    expect(summary.closest("details")!.querySelector(".micro-budget-add")).toBeNull();
    const section = await openBudgetsSection();
    await waitForBudgetsBody();
    /* الميزانيتان مسجلتان بشهر الفترة المعروض نفسه — حالة مجهول المنصرف. */
    await waitFor(() =>
      expect(section.querySelectorAll('li[data-budget-state="under_review"]')).toHaveLength(2),
    );
    const generalLi = section.querySelectorAll<HTMLLIElement>('li[data-budget-state="under_review"]')[0]!;
    const categoryLi = section.querySelectorAll<HTMLLIElement>('li[data-budget-state="under_review"]')[1]!;
    expect(generalLi.textContent).toContain("مصروف عام");
    expect(generalLi.textContent).toContain(MONTH);
    expect(categoryLi.textContent).toContain("فئة: تغليف");
    /* شهر بلا أي مصروف تشغيلي مسجل → المنصرف مجهول لا صفرًا زائفًا. */
    expect(within(section).getAllByText("المنصرف غير معلوم بعد")).toHaveLength(2);
    /* الخطة التقديرية تعلن تقديريتها بصدق. */
    expect(categoryLi.textContent).toContain("تقديرية");
    expect(generalLi.textContent).toContain("50.00");
    expect(categoryLi.textContent).toContain("20.00");
    /* قراءة فقط: لا حدثًا ماليًا كُتب ولا ميزانية جديدة. */
    expect(await eventsCount()).toBe(0);
    expect(await budgetsCount()).toBe(2);
  });

  it("الخطة لا حدثًا ماليًا: إنشاء ومراجعة وإغلاق وإخفاء هدف وتجاوز — العالم المالي متطابق قبل/بعد", async () => {
    await saveCollectedOrder(store);
    await saveEvent(store, {
      id: "w174-ev-expense",
      type: "operating_expense_cash",
      amountMinor: 3_000,
      occurredOn: "2026-08-18",
      recordedAt: RECORDED_AT,
      idempotencyKey: "w174-expense",
      note: "مصروف آب المسجل",
      counterparty: null,
      relatedEventId: null,
      expenseContext: {
        relationship: "project",
        behavior: "variable",
        purpose: "project_general",
        knowledge: "known",
      },
    });
    const before = await financialWorldSnapshot();
    const user = userEvent.setup();
    render(<Harness />);
    const section = await openBudgetsSection();
    await waitForBudgetsBody();
    /* إنشاء من النموذج: ميزانية عامة 20.00 والمنصرف المسجل 30.00 → تجاوز 10.00. */
    fireEvent.click(within(section).getByText("أضف ميزانية اختيارية"));
    fireEvent.change(await within(section).findByLabelText("مبلغ الميزانية"), { target: { value: "20.00" } });
    await user.click(within(section).getByRole("button", { name: "أنشئ الميزانية" }));
    await waitFor(() => expect(section.querySelector('li[data-budget-state="exceeded"]')).toBeTruthy());
    const budgetLi = section.querySelector<HTMLLIElement>('li[data-budget-state="exceeded"]')!;
    expect(budgetLi.textContent).toContain("تجاوزت خطتك هذا الشهر بمبلغ");
    expect(budgetLi.textContent).toContain("10.00");
    /* التجاوز ظاهر لا حاجب: مدخل الإنشاء باقٍ ولا بطاقة إنذار على القسم. */
    expect(within(section).getByText("أضف ميزانية اختيارية")).toBeTruthy();
    expect(section.querySelector('[role="alert"]')).toBeNull();
    /* إخفاء الهدف واستعادته — انقلاب علم خالص بدلالة خطة. */
    fireEvent.click(within(budgetLi).getByRole("button", { name: "إخفاء الهدف" }));
    await waitFor(() => expect(within(section).getAllByText("أخفيت الهدف — استعده متى شئت")).toBeTruthy());
    await waitFor(() => expect(within(budgetLi).getByRole("button", { name: "إظهار الهدف" })).toBeTruthy());
    fireEvent.click(within(budgetLi).getByRole("button", { name: "إظهار الهدف" }));
    await waitFor(() => expect(within(budgetLi).getByRole("button", { name: "إخفاء الهدف" })).toBeTruthy());
    /* مراجعة موثقة: نسخة خلف 40.00 تحفظ القديمة — الحد نفسه محتل بالخلف. */
    fireEvent.click(within(budgetLi).getByRole("button", { name: "نسخة جديدة" }));
    fireEvent.change(await within(section).findByLabelText("مبلغ النسخة الجديدة"), {
      target: { value: "40.00" },
    });
    await user.click(within(section).getByRole("button", { name: "احفظ النسخة الجديدة" }));
    await waitFor(() =>
      expect(within(section).getAllByText("راجعت الميزانية: نسخة جديدة تحفظ القديمة")).toBeTruthy(),
    );
    await waitFor(() => expect(section.querySelector('li[data-budget-state="within"]')).toBeTruthy());
    const revisedLi = section.querySelector<HTMLLIElement>('li[data-budget-state="within"]')!;
    expect(revisedLi.textContent).toContain("40.00");
    expect(revisedLi.textContent).toContain("ضمن خطتك هذا الشهر");
    /* إغلاق موثق بعلة إلزامية — السجل يغادر النافذة ويبقى في التاريخ. */
    fireEvent.click(within(revisedLi).getByRole("button", { name: "إغلاق موثق" }));
    fireEvent.change(await within(section).findByLabelText("علّة إغلاق الميزانية"), {
      target: { value: "ألغيت خطة الشهر لظروف شخصية" },
    });
    await user.click(within(section).getByRole("button", { name: "أغلق الميزانية" }));
    await waitFor(() => expect(within(section).getAllByText("أغلقت الميزانية بسبب موثق")).toBeTruthy());
    await waitFor(() => expect(section.querySelector("li[data-budget-state]")).toBeNull());
    fireEvent.click(within(section).getByText(/ميزانيات مغلقة ومستبدلة/));
    await waitFor(() =>
      expect(
        within(section).getAllByText(/أغلقت الميزانية بسبب موثق: ألغيت خطة الشهر لظروف شخصية/),
      ).toBeTruthy(),
    );
    expect(await budgetsCount()).toBe(2);
    /* المعيار الأثقل: الميزانيات كلها خطط — العالم المالي لم يتحرك أبدًا. */
    const after = await financialWorldSnapshot();
    expect(after).toEqual(before);
  });

  it("التجاوز ظاهر بمبلغه الصحيح ولا يحجب تسجيل مصروف أبدًا", async () => {
    await saveEvent(store, {
      id: "w174-ev-overrun",
      type: "operating_expense_cash",
      amountMinor: 3_000,
      occurredOn: "2026-08-09",
      recordedAt: RECORDED_AT,
      idempotencyKey: "w174-overrun",
      note: "مصروف يتجاوز الخطة",
      counterparty: null,
      relatedEventId: null,
      expenseContext: {
        relationship: "project",
        behavior: "variable",
        purpose: "project_general",
        knowledge: "known",
      },
    });
    await seedBudget({ id: "w174-b-low", scope: { kind: "general_expense" }, amountMinor: 2_000 });
    render(<Harness />);
    const section = await openBudgetsSection();
    await waitForBudgetsBody();
    await waitFor(() => expect(section.querySelector('li[data-budget-state="exceeded"]')).toBeTruthy());
    const li = section.querySelector<HTMLLIElement>('li[data-budget-state="exceeded"]')!;
    expect(li.textContent).toContain("تجاوزت خطتك هذا الشهر بمبلغ");
    expect(li.textContent).toContain("10.00");
    expect(li.textContent).toContain("30.00");
    /* لا حظر: مدخل تسجيل المصروف خارج القسم حي، ولا إنذار داخل القسم. */
    expect(screen.getByText("سجّل مصروفًا مدفوعًا")).toBeTruthy();
    expect(within(section).getByText("أضف ميزانية اختيارية")).toBeTruthy();
    expect(section.querySelector('[role="alert"]')).toBeNull();
    expect(await eventsCount()).toBe(1);
  });

  it("الإنشاء من النموذج يضيف ميزانية الفئة ويحدّث القائمة، والتداخل يُرفض صادرًا قبل أي كتابة", async () => {
    await seedAugustExpenses();
    const user = userEvent.setup();
    render(<Harness />);
    const section = await openBudgetsSection();
    await waitForBudgetsBody();
    fireEvent.click(within(section).getByText("أضف ميزانية اختيارية"));
    fireEvent.change(within(section).getByLabelText("نطاق الميزانية"), { target: { value: "category" } });
    fireEvent.change(await within(section).findByLabelText("نص فئة الميزانية"), {
      target: { value: "تغليف" },
    });
    fireEvent.change(within(section).getByLabelText("مبلغ الميزانية"), { target: { value: "25.00" } });
    await user.click(within(section).getByRole("button", { name: "أنشئ الميزانية" }));
    /* مطابقة الفئة النصية الصريحة: المنصرف 12.00 وحدها لا 30.00. */
    await waitFor(() => expect(section.querySelector('li[data-budget-state="within"]')).toBeTruthy());
    const li = section.querySelector<HTMLLIElement>('li[data-budget-state="within"]')!;
    expect(li.textContent).toContain("فئة: تغليف");
    expect(li.textContent).toContain(MONTH);
    expect(li.textContent).toContain("25.00");
    expect(li.textContent).toContain("12.00");
    expect(li.textContent).toContain("ضمن خطتك هذا الشهر");
    expect(li.textContent).toContain("13.00");
    /* تداخل الحدود (عام + فئة في الشهر نفسه): الرفض الصادر يظهر كما هو. */
    fireEvent.change(within(section).getByLabelText("نطاق الميزانية"), { target: { value: "general" } });
    fireEvent.change(within(section).getByLabelText("مبلغ الميزانية"), { target: { value: "15.00" } });
    await user.click(within(section).getByRole("button", { name: "أنشئ الميزانية" }));
    await waitFor(() => expect(within(section).getByText(/تداخل حدود الميزانيات/)).toBeTruthy());
    /* الرفض وقع قبل أي كتابة — الميزانية الثانية لم تُخزَّن. */
    expect(await budgetsCount()).toBe(1);
  });

  it("عالم بلا ميزانيات: جسم القسم مدخل واحد فقط — لا إلزام ولا مطالبة أبدًا", async () => {
    render(<Harness />);
    const section = await openBudgetsSection();
    await waitForBudgetsBody();
    /* المدخل الوحيد داخل الجسم: «أضف ميزانية اختيارية» — لا صفوف ولا تاريخ. */
    expect(within(section).getByText("أضف ميزانية اختيارية")).toBeTruthy();
    expect(section.querySelectorAll("details")).toHaveLength(1);
    expect(section.querySelectorAll("li")).toHaveLength(0);
    expect(within(section).queryByText("المنصرف غير معلوم بعد")).toBeNull();
    expect(section.querySelector('[role="alert"]')).toBeNull();
    /* الصفحة نفسها حية كما كانت — تجاهل الميزانيات كلي ممكن. */
    expect(screen.getByText("ملخص الفترة")).toBeTruthy();
    expect(await eventsCount()).toBe(0);
    expect(await budgetsCount()).toBe(0);
  });
});
