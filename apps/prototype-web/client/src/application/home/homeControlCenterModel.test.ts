import { describe, expect, it } from "vitest";
import {
  buildHomeControlCenterViewModel,
  type HomeControlCenterInput,
  type HomeTodayItem,
} from "./homeControlCenterModel";

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
  road:
    state === "not_initialized"
      ? { id: `road-${id}`, label: "سجّله", href: `/new-${id}`, reason: "طريق التسجيل" }
      : null,
});
const todayItem = (id: string, priority: number, kind: HomeTodayItem["kind"]): HomeTodayItem => ({
  id,
  kind,
  title: `بند ${id}`,
  detail: `تفصيل ${id}`,
  dateLocal: null,
  timeLocal: null,
  href: `/${id}`,
  actionLabel: "افتح",
  priority,
});
const baseInput = (): HomeControlCenterInput => ({
  activityName: "مشغل اختبار",
  todayLocal: "2026-08-25",
  truthLine: "هذه قراءة محلية محدودة.",
  /* Z1.4: القراءة تمرر هل توجد بيانات مسجلة — اليوم الفارغ يُميَّز عن
   * اليوم الهادئ على البيانات القائمة. */
  hasAnyRecordedData: true,
  financeUnit: {
    action: action("finance", "افتح مالي"),
    truth: "المحافظ والموردون والمواد ودفتر المالك على مسارين من فتح التطبيق.",
  },
  catalogUnit: {
    action: action("catalog", "افتح منتجاتي وخدماتي"),
    truth: "ما أكرره وبكم — والقراءة عند المرجع نفسه.",
  },
  todaySection: {
    items: [],
    upcomingCount: 0,
    nextUpcomingDate: null,
    nextUpcomingHref: null,
    truth: "قراءة صباحية من سجلاتك.",
  },
  facts: [
    fact("cash", "known", 1250),
    fact("receivables", "incomplete", 0),
    fact("payables", "not_initialized", null),
    fact("owner_capital", "known", 1250),
  ],
  optionalModules: [],
  recentChanges: [],
  /* Wave 4.3 — P-4.3-2: أرقام الفترة والـInsights جزء إلزامي من المدخلات. */
  periodNumbers: {
    today: {
      sales: {
        id: "sales",
        label: "مبيعات اليوم",
        state: "known",
        valueMinor: 0,
        honestNote: null,
        source: "/finance?view=period",
      },
      result: {
        id: "result",
        label: "نتيجة اليوم",
        state: "known",
        valueMinor: 0,
        honestNote: null,
        source: "/finance?view=period",
      },
    },
    month: {
      sales: {
        id: "sales",
        label: "مبيعات الشهر",
        state: "known",
        valueMinor: 0,
        honestNote: null,
        source: "/finance?view=period",
      },
      result: {
        id: "result",
        label: "نتيجة الشهر",
        state: "known",
        valueMinor: 0,
        honestNote: null,
        source: "/finance?view=period",
      },
    },
  },
  insights: [],
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

  it("keeps an unregistered fact a road to its own registration path, never a dead «غير مهيأ» (§2.7)", () => {
    const model = buildHomeControlCenterViewModel(baseInput());
    const payables = model.facts.find(fact => fact.id === "payables");
    expect(payables?.road).toMatchObject({ href: "/new-payables", label: "سجّله" });
    const cash = model.facts.find(fact => fact.id === "cash");
    expect(cash?.road).toBeNull();
  });

  /* دمج بند ١٠ (قرار المالك): ترتيب بالأولوية، ولا بند يظهر مرتين، ولا إلغاء للمحتوى الممتص. */
  it("merges the absorbed attention content into Today ordered by priority with no item twice", () => {
    const model = buildHomeControlCenterViewModel({
      ...baseInput(),
      todaySection: {
        ...baseInput().todaySection,
        items: [
          todayItem("today-capacity:today", 40, "capacity_warning"),
          todayItem("today-order:late", 30, "open_order"),
          todayItem("today-draft:draft", 10, "draft"),
          todayItem("today-draft:draft", 10, "draft"),
          todayItem("today-cost:cost", 20, "cost_incomplete"),
          todayItem("today-follow-up:follow", 25, "follow_up_due"),
        ],
      },
    });
    expect(model.todaySection.items.map(item => item.id)).toEqual([
      "today-draft:draft",
      "today-cost:cost",
      "today-follow-up:follow",
      "today-order:late",
      "today-capacity:today",
    ]);
  });

  it("keeps the honest empty Today state for a project with nothing on it (journey 1)", () => {
    const model = buildHomeControlCenterViewModel(baseInput());
    expect(model.todaySection.items).toHaveLength(0);
  });

  it("shows only optional modules with actual data or a relevant setup action", () => {
    const model = buildHomeControlCenterViewModel({
      ...baseInput(),
      optionalModules: [
        { id: "schedule", label: "الجدول", state: "empty", action: null },
        { id: "schedule", label: "الجدول", state: "needs_setup", action: action("schedule") },
        { id: "period_result", label: "نتيجة الفترة", state: "available", action: action("period-result") },
        { id: "period_result", label: "نتيجة الفترة", state: "empty", action: null },
      ],
    });
    expect(model.optionalModules.map(module => module.id)).toEqual(["schedule", "period_result"]);
  });

  it("keeps the permanent finance and catalog units unconditional even while every optional module is empty", () => {
    const model = buildHomeControlCenterViewModel(baseInput());
    expect(model.financeUnit).toMatchObject({
      action: { id: "finance", href: "/finance" },
    });
    expect(model.catalogUnit).toMatchObject({
      action: { id: "catalog", href: "/catalog" },
    });
    expect(model.optionalModules).toHaveLength(0);
  });

  it("keeps the recent activity bounded to five useful changes", () => {
    const model = buildHomeControlCenterViewModel({
      ...baseInput(),
      recentChanges: Array.from({ length: 7 }, (_, index) => ({
        id: `change-${index}`,
        occurredOn: `2026-08-${String(index + 1).padStart(2, "0")}`,
        title: `تغيير ${index}`,
        detail: "تفصيل محلي",
        href: "/review",
      })),
    });
    expect(model.recentChanges).toHaveLength(5);
    expect(model.recentChanges.at(-1)?.id).toBe("change-4");
  });

  /* Wave 4.3 — P-4.3-2: الأرقام تمر كما هي والنتيجة الناقصة تبقى ناقصة،
   * والـInsights تُقصر إلى أربعة كحد أقصى حتى لا تنافس الأولوية. */
  it("passes period numbers through unchanged and bounds insights to four rows", () => {
    const model = buildHomeControlCenterViewModel({
      ...baseInput(),
      periodNumbers: {
        today: {
          sales: {
            id: "sales",
            label: "مبيعات اليوم",
            state: "known",
            valueMinor: 1500,
            honestNote: null,
            source: "/finance?view=period",
          },
          result: {
            id: "result",
            label: "نتيجة اليوم",
            state: "incomplete",
            valueMinor: null,
            honestNote: "تحتاج بيانات تكلفة",
            source: "/finance?view=period",
          },
        },
        month: {
          sales: {
            id: "sales",
            label: "مبيعات الشهر",
            state: "known",
            valueMinor: 32000,
            honestNote: null,
            source: "/finance?view=period",
          },
          result: {
            id: "result",
            label: "نتيجة الشهر",
            state: "known",
            valueMinor: 9100,
            honestNote: null,
            source: "/finance?view=period",
          },
        },
      },
      insights: Array.from({ length: 6 }, (_, index) => ({
        id: `insight-${index}`,
        what: `ملحوظة ${index}`,
        why: null,
        action: null,
      })),
    });
    expect(model.periodNumbers.today.result).toMatchObject({
      state: "incomplete",
      valueMinor: null,
      honestNote: "تحتاج بيانات تكلفة",
    });
    expect(model.periodNumbers.month.result).toMatchObject({ state: "known", valueMinor: 9100 });
    expect(model.insights).toHaveLength(4);
  });
});

/* Z1.1 (العرض المعتمد §3.1): حالة اليوم الواحدة المعلنة — انتباه/فراغ/
 * بيانات ناقصة/هادئ — مشتقة في النموذج لا في الواجهة، والمصدر واحد. */
describe("buildHomeControlCenterViewModel — Z1 daily status", () => {
  it("attention: أي بند لليوم يجعله يوم انتباه مع كتلة الأولوية نفسها", () => {
    const model = buildHomeControlCenterViewModel({
      ...baseInput(),
      todaySection: {
        ...baseInput().todaySection,
        items: [todayItem("today-draft:draft", 10, "draft")],
      },
    });
    expect(model.dailyStatus).toEqual({ kind: "attention" });
    expect(model.priorityBlock?.id).toBe("today-draft:draft");
  });

  it("empty: لا بنود ولا بيانات مسجلة — يوم مفتوح لا يُخترع له محتوى", () => {
    const model = buildHomeControlCenterViewModel({
      ...baseInput(),
      hasAnyRecordedData: false,
    });
    expect(model.dailyStatus).toEqual({ kind: "empty" });
    expect(model.priorityBlock).toBeNull();
  });

  it("incomplete: بيانات مسجلة مع حقائق غير مسجلة — ما لا يمكن استنتاجه يُعلن", () => {
    const model = buildHomeControlCenterViewModel(baseInput());
    expect(model.dailyStatus).toEqual({ kind: "incomplete" });
  });

  it("normal: بيانات مسجلة بلا بنود مستحقة ولا حقائق غير مسجلة — يوم هادئ", () => {
    const model = buildHomeControlCenterViewModel({
      ...baseInput(),
      facts: [
        fact("cash", "known", 1250),
        fact("receivables", "known", 0),
        fact("payables", "known", 0),
        fact("owner_capital", "known", 1250),
      ],
    });
    expect(model.dailyStatus).toEqual({ kind: "normal" });
  });

  it("attention beats incomplete and empty: البند المستحق أولًا حتى مع حقائق غير مسجلة", () => {
    const model = buildHomeControlCenterViewModel({
      ...baseInput(),
      hasAnyRecordedData: false,
      todaySection: {
        ...baseInput().todaySection,
        items: [todayItem("today-due-amount:debt", 15, "due_amount")],
      },
    });
    expect(model.dailyStatus).toEqual({ kind: "attention" });
  });
});
