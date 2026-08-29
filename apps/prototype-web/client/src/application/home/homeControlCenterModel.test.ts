import { describe, expect, it } from "vitest";
import { buildHomeControlCenterViewModel, type HomeControlCenterInput } from "./homeControlCenterModel";

const action = (id: string, label = "افتح") => ({ id, label, href: `/${id}`, reason: `سبب ${id}` });
const fact = (
  id: "cash" | "receivables" | "payables" | "owner_capital",
  state: "known" | "incomplete" | "not_initialized",
  valueMinor: number | null,
) => ({
  id,
  label: id,
  state,
  valueMinor,
  currency: "JOD" as const,
  source: "السجل المحلي",
  period: "2026-08",
  helper: "مصدر محلي",
});
const baseInput = (): HomeControlCenterInput => ({
  activityName: "مشغل اختبار",
  todayLocal: "2026-08-25",
  truthLine: "هذه قراءة محلية محدودة.",
  primaryAction: action("orders/new", "طلب جديد"),
  financeUnit: {
    action: action("finance", "افتح مالي"),
    truth: "المحافظ والموردون والمواد ودفتر المالك على مسارين من فتح التطبيق.",
  },
  facts: [
    fact("cash", "known", 1250),
    fact("receivables", "incomplete", 0),
    fact("payables", "not_initialized", null),
    fact("owner_capital", "known", 1250),
  ],
  attention: [],
  optionalModules: [],
  recentChanges: [],
});

describe("buildHomeControlCenterViewModel", () => {
  it("keeps known JOD facts with source, period, and value while clearing incomplete values instead of inventing zero", () => {
    const model = buildHomeControlCenterViewModel(baseInput());
    expect(model.facts).toMatchObject([
      {
        id: "cash",
        state: "known",
        valueMinor: 1250,
        currency: "JOD",
        source: "السجل المحلي",
        period: "2026-08",
      },
      { id: "receivables", state: "incomplete", valueMinor: null },
      { id: "payables", state: "not_initialized", valueMinor: null },
      { id: "owner_capital", state: "known", valueMinor: 1250 },
    ]);
  });

  it("orders unique attention by priority and caps the result at three items", () => {
    const model = buildHomeControlCenterViewModel({
      ...baseInput(),
      attention: [
        {
          id: "late",
          priority: 3,
          kind: "order",
          title: "طلب متأخر",
          reason: "التسليم يحتاج متابعة",
          action: action("late"),
        },
        {
          id: "draft",
          priority: 1,
          kind: "draft",
          title: "مسودة",
          reason: "لم تتحول إلى اتفاق",
          action: action("draft"),
        },
        {
          id: "draft",
          priority: 1,
          kind: "draft",
          title: "مسودة مكررة",
          reason: "لا تُعرض مرتين",
          action: action("draft"),
        },
        {
          id: "cost",
          priority: 2,
          kind: "cost",
          title: "تكلفة ناقصة",
          reason: "سعر الساعة غير معروف",
          action: action("cost"),
        },
        {
          id: "follow-up",
          priority: 4,
          kind: "follow_up",
          title: "متابعة",
          reason: "تاريخ مسجل",
          action: action("follow-up"),
        },
      ],
    });
    expect(model.attention.map(item => item.id)).toEqual(["draft", "cost", "late"]);
  });

  it("shows only optional modules with actual data or a relevant setup action", () => {
    const model = buildHomeControlCenterViewModel({
      ...baseInput(),
      optionalModules: [
        { id: "inventory", label: "المخزون", state: "empty", action: null },
        { id: "schedule", label: "الجدول", state: "needs_setup", action: action("schedule") },
        {
          id: "supplier_commitments",
          label: "التزامات الموردين",
          state: "available",
          action: action("suppliers"),
        },
        { id: "period_result", label: "نتيجة الفترة", state: "empty", action: null },
      ],
    });
    expect(model.optionalModules.map(module => module.id)).toEqual(["schedule", "supplier_commitments"]);
  });

  it("keeps the permanent finance unit unconditional even while every optional module is empty", () => {
    const model = buildHomeControlCenterViewModel(baseInput());
    expect(model.financeUnit).toMatchObject({
      action: { id: "finance", href: "/finance" },
    });
    expect(model.optionalModules).toHaveLength(0);
  });

  it("keeps the recent activity bounded to five useful changes and preserves the primary CTA", () => {
    const model = buildHomeControlCenterViewModel({
      ...baseInput(),
      primaryAction: action("draft-1", "استأنف المسودة"),
      recentChanges: Array.from({ length: 7 }, (_, index) => ({
        id: `change-${index}`,
        occurredOn: `2026-08-${String(index + 1).padStart(2, "0")}`,
        title: `تغيير ${index}`,
        detail: "تفصيل محلي",
        href: "/review",
      })),
    });
    expect(model.primaryAction).toMatchObject({ id: "draft-1", label: "استأنف المسودة", href: "/draft-1" });
    expect(model.recentChanges).toHaveLength(5);
    expect(model.recentChanges.at(-1)?.id).toBe("change-4");
  });
});
