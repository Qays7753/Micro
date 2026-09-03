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
