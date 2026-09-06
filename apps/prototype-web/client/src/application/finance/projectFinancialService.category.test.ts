import { describe, expect, it } from "vitest";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";

const now = () => "2026-09-03T09:00:00.000Z";

/* المجموعة ١ (تصنيفي للمصاريف): توائم على مستوى الخدمة — يمر الوسم عبر كل
 * فروع توسيع الحصة في record (النسبة/التقدير/التأجيل/الثابتة) ويعبر التعديل
 * الذري والاسترجاع كما هو، بلا أي تغيير في الدلتا أو حساب الحصة. */

describe("ProjectFinancialService category label invariance (service twins)", () => {
  async function recordTwins(
    sharedExpense: Parameters<ProjectFinancialService["record"]>[0]["sharedExpense"],
    topLevelAmountMinor?: number,
  ) {
    const bare = new ProjectFinancialService(new MemoryLocalStore(), now);
    const labeled = new ProjectFinancialService(new MemoryLocalStore(), now);
    const base = {
      type: "operating_expense_cash" as const,
      ...(topLevelAmountMinor !== undefined ? { amountMinor: topLevelAmountMinor } : {}),
      occurredOn: "2026-09-02",
      note: "فاتورة مشتركة",
      counterparty: null,
      relatedEventId: null,
      idempotencyKey: "twin",
      expenseContext: {
        relationship: "shared" as const,
        behavior: "variable" as const,
        purpose: "project_general" as const,
        knowledge: "known" as const,
        sharedProjectShare: { basis: "agreed_percentage" as const, note: null },
      },
      sharedExpense,
    };
    const bareResult = await bare.record(base);
    const labeledResult = await labeled.record({
      ...base,
      idempotencyKey: "twin-labeled",
      expenseContext: { ...base.expenseContext, categoryLabel: "كهرباء" },
    });
    if (!bareResult.ok || !labeledResult.ok) throw new Error("records should succeed");
    return { bare: bareResult.value, labeled: labeledResult.value };
  }

  it("percentage: the label survives the share expansion and changes no delta", async () => {
    const { bare, labeled } = await recordTwins({
      mode: "percentage",
      sharedTotalAmountMinor: 10000,
      sharedPercentageBps: 6000,
    });
    expect(labeled.amountMinor).toBe(bare.amountMinor);
    expect(labeled.cashDeltaMinor).toBe(bare.cashDeltaMinor);
    expect(labeled.operatingExpenseDeltaMinor).toBe(bare.operatingExpenseDeltaMinor);
    expect(labeled.expenseContext?.categoryLabel).toBe("كهرباء");
    expect(labeled.expenseContext?.sharedProjectShare?.calculatedShareMinor).toBe(
      bare.expenseContext?.sharedProjectShare?.calculatedShareMinor,
    );
  });

  it("estimate and defer: the label survives and the unallocated rule is untouched", async () => {
    const estimated = await recordTwins({ mode: "estimate", amountMinor: 4000 }, 4000);
    expect(estimated.labeled.expenseContext?.categoryLabel).toBe("كهرباء");
    expect(estimated.labeled.expenseContext?.knowledge).toBe("estimated");
    const deferred = await recordTwins({ mode: "defer", sharedTotalAmountMinor: 10000 });
    expect(deferred.labeled.expenseContext?.categoryLabel).toBe("كهرباء");
    expect(deferred.labeled.operatingExpenseDeltaMinor).toBe(0);
    expect(deferred.bare.operatingExpenseDeltaMinor).toBe(0);
    expect(deferred.labeled.amountMinor).toBe(deferred.bare.amountMinor);
  });

  it("editEvent and restoreEvent carry the label verbatim with deltas intact", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const recorded = await finance.record({
      type: "operating_expense_cash",
      amountMinor: 3000,
      occurredOn: "2026-09-02",
      note: "إيجار",
      counterparty: null,
      relatedEventId: null,
      expenseContext: {
        relationship: "project",
        behavior: "fixed",
        purpose: "period",
        knowledge: "known",
        sharedProjectShare: null,
        categoryLabel: "إيجار",
      },
      idempotencyKey: "edit-label",
    });
    if (!recorded.ok) throw new Error(recorded.message);
    const edited = await finance.editEvent({
      sourceEventId: recorded.value.id,
      amountMinor: 3500,
      occurredOn: "2026-09-02",
      note: "إيجار مصحح",
      counterparty: null,
      reason: "المبلغ الصحيح ٣٥",
      idempotencyKey: "edit-label-2",
    });
    if (!edited.ok) throw new Error(edited.message);
    expect(edited.value.expenseContext?.categoryLabel).toBe("إيجار");
    expect(edited.value.cashDeltaMinor).toBe(-3500);
    const reversalList = await store.listFinancialEvents();
    if (!reversalList.ok) throw new Error(reversalList.message);
    const reversal = reversalList.value.find(
      event => event.correctionType === "reverse" && event.correctionOfEventId === recorded.value.id,
    );
    expect(reversal?.expenseContext?.categoryLabel).toBe("إيجار");
    const restored = await finance.restoreEvent({
      sourceEventId: recorded.value.id,
      idempotencyKey: `restore:${recorded.value.id}`,
    });
    if (!restored.ok) throw new Error(restored.message);
    expect(restored.value.expenseContext?.categoryLabel).toBe("إيجار");
  });
});

/* Conflict H (WF-04): تصحيح تصنيف المصروف بعد الحفظ — البديل يحمل التصنيف
 * الجديد، والتراجع والأصل يحتفظان بالقديم؛ لا إعادة تسجيل يدوية ولا محو. */
describe("ProjectFinancialService post-save expense classification correction (Conflict H / WF-04)", () => {
  it("replaces the classification on the atomic replacement while the original and reversal keep the old one", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const recorded = await finance.record({
      type: "operating_expense_cash",
      amountMinor: 3000,
      occurredOn: "2026-09-02",
      note: "بنزين",
      counterparty: null,
      relatedEventId: null,
      expenseContext: {
        relationship: "project",
        behavior: "variable",
        purpose: "period",
        knowledge: "known",
        sharedProjectShare: null,
        categoryLabel: "وقود",
      },
      idempotencyKey: "wf04-base",
    });
    if (!recorded.ok) throw new Error(recorded.message);
    const corrected = await finance.editEvent({
      sourceEventId: recorded.value.id,
      amountMinor: 3000,
      occurredOn: "2026-09-02",
      note: "بنزين",
      counterparty: null,
      expenseContext: {
        relationship: "project",
        behavior: "fixed",
        purpose: "project_general",
        knowledge: "known",
        sharedProjectShare: null,
        categoryLabel: "توصيل",
      },
      reason: "هذا مصروف توصيل لا وقود",
      idempotencyKey: "wf04-edit",
    });
    if (!corrected.ok) throw new Error(corrected.message);
    expect(corrected.value.expenseContext?.categoryLabel).toBe("توصيل");
    expect(corrected.value.expenseContext?.behavior).toBe("fixed");
    expect(corrected.value.expenseContext?.purpose).toBe("project_general");
    /* الدلتا المالية لم تتأثر بتغيير التصنيف — التصنيف بعد قراءة لا كتابة مالية. */
    expect(corrected.value.cashDeltaMinor).toBe(-3000);
    expect(corrected.value.operatingExpenseDeltaMinor).toBe(3000);
    const all = await store.listFinancialEvents();
    if (!all.ok) throw new Error(all.message);
    const source = all.value.find(event => event.id === recorded.value.id);
    expect(source?.expenseContext?.categoryLabel).toBe("وقود");
    const reversal = all.value.find(
      event => event.correctionType === "reverse" && event.correctionOfEventId === recorded.value.id,
    );
    expect(reversal?.expenseContext?.categoryLabel).toBe("وقود");
  });

  it("rejects classification correction on a non-expense event and drops the share when leaving shared", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const investment = await finance.record({
      type: "owner_investment_cash",
      amountMinor: 5000,
      occurredOn: "2026-09-02",
      note: "رأس مال",
      counterparty: null,
      relatedEventId: null,
      idempotencyKey: "wf04-invest",
    });
    if (!investment.ok) throw new Error(investment.message);
    const rejected = await finance.editEvent({
      sourceEventId: investment.value.id,
      amountMinor: 5000,
      occurredOn: "2026-09-02",
      note: "رأس مال",
      counterparty: null,
      expenseContext: {
        relationship: "project",
        behavior: "fixed",
        purpose: "period",
        knowledge: "known",
        sharedProjectShare: null,
        categoryLabel: "لا يصح",
      },
      reason: "محاولة تصنيف غير مصروف",
      idempotencyKey: "wf04-reject",
    });
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.message).toContain("لأحداث المصروف فقط");

    /* مصروف مشترك بحصة → التصحيح إلى «للمشروع» يسقط الحصة لا يحتفظ بها. */
    const shared = await finance.record({
      type: "operating_expense_cash",
      amountMinor: 2000,
      occurredOn: "2026-09-02",
      note: "فاتورة مشتركة",
      counterparty: null,
      relatedEventId: null,
      expenseContext: {
        relationship: "shared",
        behavior: "variable",
        purpose: "project_general",
        knowledge: "known",
        sharedProjectShare: { basis: "agreed_fixed_share", note: "نص" },
        categoryLabel: "كهرباء",
      },
      sharedExpense: { mode: "fixed", amountMinor: 2000 },
      idempotencyKey: "wf04-shared",
    });
    if (!shared.ok) throw new Error(shared.message);
    const toProject = await finance.editEvent({
      sourceEventId: shared.value.id,
      amountMinor: 3000,
      occurredOn: "2026-09-02",
      note: "فاتورة مشتركة",
      counterparty: null,
      expenseContext: {
        relationship: "project",
        behavior: "variable",
        purpose: "project_general",
        knowledge: "known",
        sharedProjectShare: null,
        categoryLabel: "كهرباء",
      },
      reason: "صار للمشروع كله",
      idempotencyKey: "wf04-to-project",
    });
    expect(toProject.ok).toBe(true);
    if (toProject.ok) {
      expect(toProject.value.expenseContext?.relationship).toBe("project");
      expect(toProject.value.expenseContext?.sharedProjectShare).toBeNull();
    }
  });
});
