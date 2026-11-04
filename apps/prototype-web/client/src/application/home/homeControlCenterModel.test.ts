import { describe, expect, it } from "vitest";
import {
  buildHomeControlCenterViewModel,
  selectFollowUpBrief,
  type HomeFollowUpRow,
} from "./homeControlCenterModel";
import type { FollowUpProjection, FollowUpTask } from "@/application/follow-up";

function task(
  partial: Partial<FollowUpTask> & { itemKey: string; taskKind: FollowUpTask["taskKind"] },
): FollowUpTask {
  return {
    title: partial.title ?? `مهمة ${partial.itemKey}`,
    party: null,
    amountMinor: null,
    amountRole: null,
    amountProposed: false,
    dueOn: null,
    dateState: "none",
    scheduledTime: null,
    sourceHref: `/source/${partial.itemKey}`,
    sourceKind: "order",
    sourceId: partial.itemKey,
    occurrenceId: null,
    ...partial,
  };
}

function projectionOf(
  groups: Partial<Record<FollowUpProjection["groups"][number]["group"], readonly FollowUpTask[]>>,
) {
  return {
    groups: (["overdue", "today", "upcoming", "undated", "invalid"] as const).map(group => ({
      group,
      tasks: groups[group] ?? [],
    })),
  };
}

const draft = (id: string, itemName: string | null) => ({ id, itemName });

describe("selectFollowUpBrief — HOME-A4/3D-C2 (مختصر متابعتك حتى 3 مهام)", () => {
  it("rule 1: overdue then today fill the rows in the projection's order up to three", () => {
    const brief = selectFollowUpBrief(
      projectionOf({
        overdue: [
          task({ itemKey: "o1", taskKind: "customer_followup", dueOn: "2026-11-01", dateState: "overdue" }),
        ],
        today: [
          task({ itemKey: "t1", taskKind: "delivery", dueOn: "2026-11-02", dateState: "today" }),
          task({ itemKey: "t2", taskKind: "delivery", dueOn: "2026-11-02", dateState: "today" }),
        ],
        upcoming: [task({ itemKey: "u1", taskKind: "delivery", dueOn: "2026-11-20", dateState: "upcoming" })],
      }),
      [],
      true,
      null,
    );
    expect(brief.rows.map(row => row.id)).toEqual(["o1", "t1", "t2"]);
    /* امتلأت الصفوف بالفائت واليوم فلا وعد بإظهار القادم أيضًا (3D-C2). */
    expect(brief.rows.every(row => !row.upcoming)).toBe(true);
  });

  it("rule 2: with room left, exactly one nearest upcoming row is reserved and tagged قادم — never urgent", () => {
    const brief = selectFollowUpBrief(
      projectionOf({
        today: [task({ itemKey: "t1", taskKind: "delivery", dueOn: "2026-11-02", dateState: "today" })],
        upcoming: [
          task({ itemKey: "u1", taskKind: "delivery", dueOn: "2026-11-20", dateState: "upcoming" }),
          task({ itemKey: "u2", taskKind: "delivery", dueOn: "2026-11-25", dateState: "upcoming" }),
        ],
      }),
      [],
      true,
      null,
    );
    /* بقيت فسحة بعد القاعدة ٣ فتعرض القادمة التالية دون تكرار المحجوز (قاعدة ٤). */
    expect(brief.rows.map(row => row.id)).toEqual(["t1", "u1", "u2"]);
    expect(brief.rows[1]!.upcoming).toBe(true);
    expect(brief.rows[2]!.upcoming).toBe(true);
    expect(brief.rows[1]!.title).not.toContain("عاجل");
  });

  it("rule 3 fills no-date tasks in type order: invalid date fix, then delivery, then financial, then drafts", () => {
    const brief = selectFollowUpBrief(
      projectionOf({
        undated: [
          task({
            itemKey: "f1",
            taskKind: "receivable",
            amountMinor: 1000,
            amountRole: "المتبقي على العميل",
          }),
          task({ itemKey: "d1", taskKind: "delivery" }),
          task({ itemKey: "c1", taskKind: "customer_followup" }),
        ],
        invalid: [task({ itemKey: "x1", taskKind: "delivery", dueOn: "تالف", dateState: "invalid" })],
      }),
      [draft("dr1", "خاتم أمانة"), draft("dr2", null)],
      true,
      null,
    );
    expect(brief.rows.map(row => row.id)).toEqual(["x1", "d1", "c1"]);
    /* المسودات بعد المهام بلا موعد — البقية في القائمة الكاملة. */
  });

  it("rule 4: leftover room shows further upcoming without repeating the reserved one", () => {
    const brief = selectFollowUpBrief(
      projectionOf({
        today: [task({ itemKey: "t1", taskKind: "delivery", dueOn: "2026-11-02", dateState: "today" })],
        upcoming: [
          task({ itemKey: "u1", taskKind: "delivery", dueOn: "2026-11-20", dateState: "upcoming" }),
          task({ itemKey: "u2", taskKind: "customer_followup", dueOn: "2026-11-25", dateState: "upcoming" }),
        ],
      }),
      [],
      true,
      null,
    );
    expect(brief.rows.map(row => row.id)).toEqual(["t1", "u1", "u2"]);
  });

  it("no task appears twice: the same itemKey from any path merges once by identity", () => {
    const brief = selectFollowUpBrief(
      projectionOf({
        overdue: [
          task({ itemKey: "o1", taskKind: "customer_followup", dueOn: "2026-11-01", dateState: "overdue" }),
        ],
        undated: [task({ itemKey: "o1", taskKind: "customer_followup" })],
      }),
      [draft("o1", "x")],
      true,
      null,
    );
    expect(brief.rows.filter(row => row.id === "o1")).toHaveLength(1);
  });

  it("a complete read with no tasks is honestly empty — not «all is well»", () => {
    const brief = selectFollowUpBrief(projectionOf({}), [], true, null);
    expect(brief.rows).toHaveLength(0);
    expect(brief.empty).toBe(true);
    expect(brief.complete).toBe(true);
  });

  it("a failed source loses completeness: rows stay with the declared partiality, never a misleading void", () => {
    const brief = selectFollowUpBrief(
      projectionOf({}),
      [],
      false,
      "تعذرت قراءة بعض المتابعات — أعد المحاولة",
    );
    expect(brief.complete).toBe(false);
    expect(brief.empty).toBe(false);
    expect(brief.failedMessage).toContain("تعذرت قراءة بعض المتابعات");
  });

  it("amounts carry their role label only when they matter, and proposed amounts stay suppressed", () => {
    const brief = selectFollowUpBrief(
      projectionOf({
        today: [
          task({
            itemKey: "r1",
            taskKind: "receivable",
            amountMinor: 1500,
            amountRole: "المتبقي على العميل",
            dueOn: "2026-11-02",
            dateState: "today",
          }),
          task({
            itemKey: "p1",
            taskKind: "supplier_payable",
            amountMinor: 900,
            amountRole: null,
            amountProposed: true,
            dueOn: "2026-11-02",
            dateState: "today",
          }),
        ],
      }),
      [],
      true,
      null,
    );
    const receivable = brief.rows.find(row => row.id === "r1") as HomeFollowUpRow;
    expect(receivable.amountMinor).toBe(1500);
    expect(receivable.amountRole).toBe("المتبقي على العميل");
    const proposed = brief.rows.find(row => row.id === "p1") as HomeFollowUpRow;
    expect(proposed.amountMinor).toBeNull();
    expect(proposed.amountRole).toBeNull();
  });

  it("draft rows open their own draft with an explicit completion action", () => {
    const brief = selectFollowUpBrief(projectionOf({}), [draft("dr1", "خاتم أمانة")], true, null);
    expect(brief.rows).toHaveLength(1);
    expect(brief.rows[0]!.title).toContain("خاتم أمانة");
    expect(brief.rows[0]!.href).toBe("/orders/draft/dr1");
    expect(brief.rows[0]!.actionLabel).toBe("إكمال الطلب");
  });
});

describe("buildHomeControlCenterViewModel (S16)", () => {
  it("carries the heading, glimpse, brief, and backup state without inventing anything", () => {
    const model = buildHomeControlCenterViewModel({
      activityName: "مشغل اختبار",
      todayLocal: "2026-11-02",
      truthLine: null,
      glimpse: {
        today: {
          period: { kind: "today", from: "2026-11-02", to: "2026-11-02", label: "اليوم" },
          sales: {
            id: "sales",
            label: "المبيعات المسجلة",
            state: "known",
            valueMinor: 0,
            honestNote: null,
            sourceHref: "/finance/statement?since=2026-11-02&until=2026-11-02",
          },
          result: {
            id: "result",
            label: "نتيجة الفترة",
            state: "incomplete",
            valueMinor: null,
            honestNote: "تحتاج بيانات تكلفة",
            sourceHref: "/finance/statement?since=2026-11-02&until=2026-11-02",
          },
        },
        month: {
          period: { kind: "month", from: "2026-11-01", to: "2026-11-02", label: "هذا الشهر" },
          sales: {
            id: "sales",
            label: "المبيعات المسجلة",
            state: "known",
            valueMinor: 0,
            honestNote: null,
            sourceHref: "/finance/statement?since=2026-11-01&until=2026-11-02",
          },
          result: {
            id: "result",
            label: "نتيجة الفترة",
            state: "incomplete",
            valueMinor: null,
            honestNote: "تحتاج بيانات تكلفة",
            sourceHref: "/finance/statement?since=2026-11-01&until=2026-11-02",
          },
        },
        cashNow: {
          label: "النقد المسجل الآن",
          state: "not_initialized",
          valueMinor: null,
          qualifier: null,
          sourceHref: "/cash",
        },
      },
      followUp: { rows: [], complete: true, failedMessage: null, empty: true },
      backup: { lastVerifiedExportAt: null, daysSinceExport: null, reminderEnabled: true },
    });
    expect(model.heading.activityName).toBe("مشغل اختبار");
    expect(model.heading.todayLocal).toBe("2026-11-02");
    expect(model.glimpse.today.period.from).toBe("2026-11-02");
    expect(model.glimpse.cashNow.state).toBe("not_initialized");
    expect(model.followUp.empty).toBe(true);
    expect(model.backup.lastVerifiedExportAt).toBeNull();
    expect(model.truthLine).toBeNull();
  });
});
