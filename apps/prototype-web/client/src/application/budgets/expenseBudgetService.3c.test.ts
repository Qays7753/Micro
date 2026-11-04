/**
 * Wave 3C (ARCH-002/WS-212 — STR-406): أول تغطية مباشرة لخدمة الميزانيات.
 *
 * الخدمة كانت بلا أي اختبار وحدة مباشر (تغطيتها غير مباشرة عبر أسطح UI
 * فقط) رغم أنها مطلوبة قبل أي حركة بنيوية على عنقود المالية (Wave 4B).
 *
 * يثبت هذا الملف: الإنشاء والحتمية (operationKey)، المراجعة بزوج النسخ
 * الخلف مع حفظ (الفترة × النطاق)، الإغلاق بعلة وإعادة الإغلاق الحتمي،
 * تقسيم القوائم الشهرية، قواعد spentMinor الموثقة أعلى الخدمة (مجهول لا
 * يصير صفرًا؛ الفئة مطابقة نصية صريحة؛ التراجع يُخصم صافيًا)، والثابت
 * الأهم: **لا تكتب الخدمة أي FinancialEvent أبدًا** (الخطة ليست حدثًا).
 */
import { describe, expect, it } from "vitest";
import { ExpenseBudgetService } from "./expenseBudgetService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { okValue } from "@/testing/resultAssertions";

const NOW = () => "2026-10-03T10:00:00.000Z" as const;

async function seeded() {
  const store = new MemoryLocalStore();
  const budgets = new ExpenseBudgetService(store, NOW);
  const finance = new ProjectFinancialService(store, NOW);
  return { store, budgets, finance };
}

describe("Wave 3C — ExpenseBudgetService direct coverage (STR-406)", () => {
  it("creates a general-expense budget and a category budget with honest shapes", async () => {
    const { budgets } = await seeded();
    const general = await budgets.createBudget({
      periodKey: "2026-09",
      scope: { kind: "general_expense" },
      amountMinor: 40_000,
      note: "ميزانية عامة",
      operationKey: "eb-3c-general",
    });
    if (!general.ok) throw new Error(general.message);
    expect(general.value.periodKey).toBe("2026-09");
    expect(general.value.scope).toEqual({ kind: "general_expense" });
    expect(general.value.amountMinor).toBe(40_000);
    expect(general.value.status).toBe("active");

    /* النطاقان لا يشتركان الشهر نفسه (قاعدة منع العدّ المزدوج أدناه). */
    const category = await budgets.createBudget({
      periodKey: "2026-10",
      scope: { kind: "category", categoryLabel: "إيجار" },
      amountMinor: 25_000,
      operationKey: "eb-3c-rent",
    });
    if (!category.ok) throw new Error(category.message);
    expect(category.value.scope).toEqual({ kind: "category", categoryLabel: "إيجار" });
  });

  it("blocks overlapping scopes in the same month — no double counting", async () => {
    const { budgets } = await seeded();
    await budgets.createBudget({
      periodKey: "2026-09",
      scope: { kind: "general_expense" },
      amountMinor: 30_000,
      operationKey: "eb-3c-overlap-general",
    });
    const overlapping = await budgets.createBudget({
      periodKey: "2026-09",
      scope: { kind: "category", categoryLabel: "إيجار" },
      amountMinor: 5_000,
      operationKey: "eb-3c-overlap-rent",
    });
    expect(overlapping.ok).toBe(false);
    if (!overlapping.ok) expect(overlapping.message).toContain("تداخل");
    /* الشهر التالي حر — الحدود شهرية لا مطلقة. */
    const nextMonth = await budgets.createBudget({
      periodKey: "2026-10",
      scope: { kind: "category", categoryLabel: "إيجار" },
      amountMinor: 5_000,
      operationKey: "eb-3c-overlap-next",
    });
    expect(nextMonth.ok).toBe(true);
  });

  it("is idempotent on operationKey: replay returns the same record, not a copy", async () => {
    const { budgets } = await seeded();
    const first = await budgets.createBudget({
      periodKey: "2026-09",
      scope: { kind: "general_expense" },
      amountMinor: 10_000,
      operationKey: "eb-3c-replay",
    });
    if (!first.ok) throw new Error(first.message);
    const replay = await budgets.createBudget({
      periodKey: "2026-09",
      scope: { kind: "general_expense" },
      amountMinor: 10_000,
      operationKey: "eb-3c-replay",
    });
    if (!replay.ok) throw new Error(replay.message);
    expect(replay.value.id).toBe(first.value.id);
    const list = await budgets.listBudgets("2026-09");
    if (!list.ok) throw new Error(list.message);
    expect(list.value.active.length).toBe(1);
  });

  it("rejects invalid period keys and non-positive amounts before any write", async () => {
    const { budgets } = await seeded();
    const badPeriod = await budgets.listBudgets("2026-9");
    expect(badPeriod.ok).toBe(false);
    if (!badPeriod.ok) expect(badPeriod.message).toContain("YYYY-MM");

    const badAmount = await budgets.createBudget({
      periodKey: "2026-09",
      scope: { kind: "general_expense" },
      amountMinor: 0,
    });
    expect(badAmount.ok).toBe(false);
    const all = await budgets.listBudgets("2026-09");
    if (!all.ok) throw new Error(all.message);
    expect(all.value.active.length).toBe(0);
  });

  it("revises via a supersede pair that preserves (period x scope)", async () => {
    const { budgets } = await seeded();
    const created = await budgets.createBudget({
      periodKey: "2026-09",
      scope: { kind: "category", categoryLabel: "لوازم" },
      amountMinor: 5_000,
      operationKey: "eb-3c-revise-create",
    });
    if (!created.ok) throw new Error(created.message);
    const revision = await budgets.reviseBudget(created.value.id, {
      amountMinor: 7_500,
      note: "زيادة بعد مراجعة",
      operationKey: "eb-3c-revise-1",
    });
    if (!revision.ok) throw new Error(revision.message);
    expect(revision.value.successor.amountMinor).toBe(7_500);
    expect(revision.value.successor.periodKey).toBe("2026-09");
    expect(revision.value.successor.scope).toEqual({ kind: "category", categoryLabel: "لوازم" });
    expect(revision.value.supersededPrevious.status).toBe("superseded");
    const list = await budgets.listBudgets("2026-09");
    if (!list.ok) throw new Error(list.message);
    expect(list.value.active.length).toBe(1);
    expect(list.value.superseded.length).toBe(1);
  });

  it("closes with a documented reason and re-close is deterministic", async () => {
    const { budgets } = await seeded();
    const created = await budgets.createBudget({
      periodKey: "2026-08",
      scope: { kind: "general_expense" },
      amountMinor: 9_000,
      operationKey: "eb-3c-close-create",
    });
    if (!created.ok) throw new Error(created.message);
    const closed = await budgets.closeBudget(created.value.id, "توقف النشاط");
    if (!closed.ok) throw new Error(closed.message);
    expect(closed.value.status).toBe("closed");
    const reclosed = await budgets.closeBudget(created.value.id, "توقف النشاط");
    if (!reclosed.ok) throw new Error(reclosed.message);
    expect(reclosed.value.id).toBe(closed.value.id);
    const list = await budgets.listBudgets("2026-08");
    if (!list.ok) throw new Error(list.message);
    expect(list.value.closed.length).toBe(1);
  });

  it("spentMinor: a month with no operating events is unknown (under_review), never zero", async () => {
    const { budgets } = await seeded();
    await budgets.createBudget({
      periodKey: "2026-07",
      scope: { kind: "general_expense" },
      amountMinor: 30_000,
      operationKey: "eb-3c-empty-month",
    });
    const statuses = await budgets.readBudgetStatuses({ from: "2026-07", to: "2026-07" });
    if (!statuses.ok) throw new Error(statuses.message);
    const status = statuses.value.lines.find(item => item.budget.periodKey === "2026-07");
    if (!status) throw new Error("لم تُقرأ حالة الميزانية");
    expect(status.spentMinor).toBeNull();
    expect(status.reading.state).toBe("under_review");
    expect(status.reading.notes).toContain("spent_unknown");
  });

  it("spentMinor: operating events in the budget's month are summed; reversals net out", async () => {
    const { budgets, finance } = await seeded();
    const expense = await finance.record({
      type: "operating_expense_cash",
      amountMinor: 1_200,
      occurredOn: "2026-09-05",
      note: "توصيل",
      counterparty: null,
      relatedEventId: null,
      expenseContext: { relationship: "project", behavior: "variable", purpose: "order", knowledge: "known" },
      idempotencyKey: "eb-3c-expense-1",
    });
    if (!expense.ok) throw new Error(expense.message);
    await budgets.createBudget({
      periodKey: "2026-09",
      scope: { kind: "general_expense" },
      amountMinor: 30_000,
      operationKey: "eb-3c-spent-general",
    });
    const statuses = await budgets.readBudgetStatuses({ from: "2026-09", to: "2026-09" });
    if (!statuses.ok) throw new Error(statuses.message);
    const status = statuses.value.lines.find(item => item.budget.operationKey === "eb-3c-spent-general");
    if (!status) throw new Error("لم تُقرأ حالة الميزانية");
    expect(status.spentMinor).toBe(1_200);
    expect(status.reading.state).toBe("within");
    expect(status.reading.remainingMinor).toBe(28_800);
  });

  it("spentMinor: category scope matches the label explicitly; other labels do not leak in", async () => {
    const { budgets, finance } = await seeded();
    await finance.record({
      type: "operating_expense_cash",
      amountMinor: 800,
      occurredOn: "2026-09-06",
      note: "إيجار المحل",
      counterparty: null,
      relatedEventId: null,
      expenseContext: {
        relationship: "project",
        behavior: "fixed",
        purpose: "period",
        knowledge: "known",
        categoryLabel: "إيجار",
      },
      idempotencyKey: "eb-3c-rent-event",
    });
    await budgets.createBudget({
      periodKey: "2026-09",
      scope: { kind: "category", categoryLabel: "إيجار" },
      amountMinor: 5_000,
      operationKey: "eb-3c-rent-budget",
    });
    await budgets.createBudget({
      periodKey: "2026-09",
      scope: { kind: "category", categoryLabel: "رواتب" },
      amountMinor: 5_000,
      operationKey: "eb-3c-salaries-budget",
    });
    const statuses = await budgets.readBudgetStatuses({ from: "2026-09", to: "2026-09" });
    if (!statuses.ok) throw new Error(statuses.message);
    const rent = statuses.value.lines.find(item => item.budget.operationKey === "eb-3c-rent-budget");
    const salaries = statuses.value.lines.find(item => item.budget.operationKey === "eb-3c-salaries-budget");
    if (!rent || !salaries) throw new Error("حالات مفقودة");
    /* الفئة نفسها تُحسب؛ الفئة الأخرى صادقة الصفر لأن أحداث الشهر موجودة. */
    expect(rent.spentMinor).toBe(800);
    expect(salaries.spentMinor).toBe(0);
    expect(salaries.reading.state).toBe("within");
  });

  it("invariant: the service never writes a FinancialEvent (a plan is not an event)", async () => {
    const { store, budgets } = await seeded();
    await budgets.createBudget({
      periodKey: "2026-09",
      scope: { kind: "general_expense" },
      amountMinor: 12_000,
      operationKey: "eb-3c-no-event",
    });
    await budgets.reviseBudget(okValue(await budgets.listBudgets("2026-09"))!.active[0]!.id, {
      amountMinor: 13_000,
      operationKey: "eb-3c-no-event-rev",
    });
    const events = await store.listFinancialEvents();
    if (!events.ok) throw new Error(events.message);
    expect(events.value.length).toBe(0);
  });

  it("SDF-062 (UNIT-013B — تنفيذ S15): مصروف ١٠ سُدّد منه ٣ وأصل ١٠٠ ← المنصرف المؤهل ١٠ بالضبط", async () => {
    const { store, budgets, finance } = await seeded();
    /* مصروف التزام ١٠٫٠٠ — الحدث التشغيلي يحمل العشرة كاملة (الذمم عمود
     * مستقل)؛ التسديد ٣٫٠٠ لاحقًا حركة ذمم/كاش لا مصروفًا ثانيًا. */
    const expense = await finance.record({
      type: "operating_expense_payable",
      amountMinor: 10_000,
      occurredOn: "2026-09-05",
      note: "فاتورة صيانة",
      counterparty: "ورشة الأجهزة",
      relatedEventId: null,
      expenseContext: {
        relationship: "project",
        behavior: "fixed",
        purpose: "project_general",
        knowledge: "known",
        sharedProjectShare: null,
        categoryLabel: null,
      },
      idempotencyKey: "sdf-062-expense",
    });
    if (!expense.ok) throw new Error(expense.message);
    const settlement = await finance.record({
      type: "payable_settlement_cash",
      amountMinor: 3_000,
      occurredOn: "2026-09-12",
      note: "دفعة على الفاتورة",
      counterparty: "ورشة الأجهزة",
      relatedEventId: expense.value.id,
      idempotencyKey: "sdf-062-settle",
    });
    if (!settlement.ok) throw new Error(settlement.message);
    /* أصل ١٠٠٫٠٠ بشراء نقدي — عمود الأصول مستقل عن المصروف التشغيلي. */
    const { AssetService } = await import("@/application/assets/assetService");
    const asset = await new AssetService(store, NOW).create({
      name: "ثلاجة عرض",
      acquisitionAmountMinor: 100_000,
      acquisitionKind: "cash",
      purchaseDate: "2026-09-08",
      lifeMonths: 60,
      depreciationStartOn: "2026-09-08",
      note: null,
    });
    if (!asset.ok) throw new Error(asset.message);
    /* الميزانية خطة فوق الشهر نفسه — لا حدث مالي منها (عقد ٤٢). */
    const budget = await budgets.createBudget({
      periodKey: "2026-09",
      scope: { kind: "general_expense" },
      amountMinor: 30_000,
      operationKey: "sdf-062-budget",
    });
    if (!budget.ok) throw new Error(budget.message);
    const statuses = await budgets.readBudgetStatuses({ from: "2026-09", to: "2026-09" });
    if (!statuses.ok) throw new Error(statuses.message);
    const line = statuses.value.lines.find(item => item.budget.operationKey === "sdf-062-budget");
    if (!line) throw new Error("لم تُقرأ حالة الميزانية");
    /* المنصرف المؤهل = ١٠ بالضبط: لا ٣ (المدفوع) ولا ١١٠ ولا ١١٣
     * (المصروف + الأصل) — الدفع حركة ذمم والأصل رأس مال، وكلاهما خارج
     * عمود المصروف التشغيلي (نفس معرفة ونطاق المصروف عند 013). */
    expect(line.spentMinor).toBe(10_000);
    expect(line.reading.remainingMinor).toBe(20_000);
    /* والأصل باقٍ بكامل دفتره — لم يُستهلك عبر الميزانية. */
    const { AssetService: AssetReader } = await import("@/application/assets/assetService");
    const overview = await new AssetReader(store, NOW).overview();
    if (!overview.ok) throw new Error(overview.message);
    expect(overview.value.totals.bookValueMinor).toBe(100_000);
  });
});
