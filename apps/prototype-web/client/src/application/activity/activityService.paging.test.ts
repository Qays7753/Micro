/** UXR-05 (PERF-003 — عقد ٣٠ §2.2): قراءة سجل النشاط بحدٍّ مُفصح عنه — hasMore
 * حقيقيًا لا عدًّا تخمينيًا، على حدود العائلة (19/20/21) وحدود الكلية
 * (119/120/121)، مع نطاق تاريخ وعائلة مختارة وتواريخ متساوية، وسلوك read()
 * القائم مطابقًا لصفحة readPage.
 *
 * ⚠️ مؤجل التشغيل بأمر المالك (أمر التنفيذ المتصل 2026-11-06 §6): يُكتب مع
 * التغيير ولا يُشغَّل إلا في التحقق الشامل بعد W05. */
import { describe, expect, it } from "vitest";
import { createFinancialEvent } from "@micro-domain/financial-event/index.js";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { ActivityService } from "./activityService";

const DAY = "2026-09-01";

async function seedExpenses(store: MemoryLocalStore, count: number, day: string = DAY, tag = "exp") {
  /* تصحيح مؤرخ 2026-11-06 (UXR-W05/مراجعة 5): الوسوم المميزة لكل دفعة بذر —
   * المعرّفات المكررة عبر الدفعات كانت تكتب فوق السجلات في MemoryLocalStore
   * (الحتمية تعيد السجل القائم) فتُفسد حساب النطاق. */
  for (let index = 0; index < count; index += 1) {
    const event = createFinancialEvent({
      id: `${tag}-${index}`,
      type: "operating_expense_cash",
      amountMinor: 100 + index,
      occurredOn: day,
      /* دقائق/ثوانٍ متزايدة فريدة لتثبيت الترتيب فوق تواريخ أثر متساوية — تصحيح مؤرخ
       * 2026-11-06 (UXR-W05 — فحص المستودع الكامل): Math.floor محظور في طبقة التطبيق
       * (D-02)؛ Math.trunc مطابق دلاليًا للأعداد غير السالبة هنا وليس تقريب مال. */
      recordedAt: `2026-09-01T08:${String(Math.trunc(index / 60)).padStart(2, "0")}:${String(index % 60).padStart(2, "0")}.000Z`,
      idempotencyKey: `${tag}-${index}`,
      note: `مصروف رقم ${index}`,
      counterparty: null,
    });
    const saved = await store.saveFinancialEvent(event);
    if (!saved.ok) throw new Error(saved.message);
  }
}

describe("UXR-05 — PERF-003: activity readPage بحد مُفصح عنه (عقد ٣٠ §2.2)", () => {
  it("حد العائلة: 19 و20 بلا بقية، و21 بقية موثقة عبر familyCapped وhasMore", async () => {
    const store19 = new MemoryLocalStore();
    await seedExpenses(store19, 19);
    const reader19 = new ActivityService(store19);
    const page19 = await reader19.readPage({ limit: 120, perFamilyLimit: 20 });
    if (!page19.ok) throw new Error(page19.message);
    expect(page19.value.records.length).toBe(19);
    expect(page19.value.hasMore).toBe(false);
    expect(page19.value.familyCapped).toEqual([]);

    const store20 = new MemoryLocalStore();
    await seedExpenses(store20, 20);
    const reader20 = new ActivityService(store20);
    const page20 = await reader20.readPage({ limit: 120, perFamilyLimit: 20 });
    if (!page20.ok) throw new Error(page20.message);
    /* 20 = الحد بالضبط: لا قنص ولا بقية — `rawCount > perFamilyLimit` هو الفيصل. */
    expect(page20.value.records.length).toBe(20);
    expect(page20.value.hasMore).toBe(false);
    expect(page20.value.familyCapped).toEqual([]);

    const store21 = new MemoryLocalStore();
    await seedExpenses(store21, 21);
    const reader21 = new ActivityService(store21);
    const page21 = await reader21.readPage({ limit: 120, perFamilyLimit: 20 });
    if (!page21.ok) throw new Error(page21.message);
    expect(page21.value.records.length).toBe(20);
    expect(page21.value.hasMore).toBe(true);
    expect(page21.value.inScopeCount).toBe(20);
    expect(page21.value.familyCapped).toEqual(["expense"]);
    /* رفع الحدّين معًا (عرض المزيد) يفتح السجل الحادي والعشرين فعلًا. */
    const widened = await reader21.readPage({ limit: 240, perFamilyLimit: 40 });
    if (!widened.ok) throw new Error(widened.message);
    expect(widened.value.records.length).toBe(21);
    expect(widened.value.hasMore).toBe(false);
  });

  it("حد الكلية: 119 و120 بلا بقية، و121 بقية موثقة عبر hasMore", async () => {
    const store119 = new MemoryLocalStore();
    await seedExpenses(store119, 119);
    const reader119 = new ActivityService(store119);
    const page119 = await reader119.readPage({ limit: 120, perFamilyLimit: 200 });
    if (!page119.ok) throw new Error(page119.message);
    expect(page119.value.records.length).toBe(119);
    expect(page119.value.hasMore).toBe(false);

    const store120 = new MemoryLocalStore();
    await seedExpenses(store120, 120);
    const reader120 = new ActivityService(store120);
    const page120 = await reader120.readPage({ limit: 120, perFamilyLimit: 200 });
    if (!page120.ok) throw new Error(page120.message);
    expect(page120.value.records.length).toBe(120);
    expect(page120.value.hasMore).toBe(false);

    const store121 = new MemoryLocalStore();
    await seedExpenses(store121, 121);
    const reader121 = new ActivityService(store121);
    const page121 = await reader121.readPage({ limit: 120, perFamilyLimit: 200 });
    if (!page121.ok) throw new Error(page121.message);
    expect(page121.value.records.length).toBe(120);
    expect(page121.value.hasMore).toBe(true);
    expect(page121.value.inScopeCount).toBe(121);
    expect(page121.value.familyCapped).toEqual([]);
  });

  it("النطاق: hasMore يُحسب داخل نافذة التاريخ لا عبر السجل كله", async () => {
    const store = new MemoryLocalStore();
    await seedExpenses(store, 30, "2026-08-01", "aug");
    await seedExpenses(store, 3, "2026-09-01", "sep");
    const reader = new ActivityService(store);
    const inWindow = await reader.readPage({
      limit: 120,
      perFamilyLimit: 20,
      from: "2026-09-01",
      to: "2026-09-30",
    });
    if (!inWindow.ok) throw new Error(inWindow.message);
    expect(inWindow.value.records.length).toBe(3);
    expect(inWindow.value.hasMore).toBe(false);
    /* تصحيح مؤرخ 2026-11-06 (UXR-W05/مراجعة 5): خارج النافذة 33 سجلًا إجمالًا
     * (30 أقدم + 3 داخل النافذة)؛ حد العائلة (20) يقنّص العائلة فتُقبَل 20
     * صفًا فقط — inScopeCount يَعُدّ الصفوف المقبولة قبل حد الكلية (rows.length)
     * فقيمته 20، والبقية موثقة عبر hasMore وfamilyCapped؛ النافذة الضيقة لا
     * تدّعي اكتمال السجل ولا يظهر مزيد داخلها كذبًا. */
    const unbounded = await reader.readPage({ limit: 120, perFamilyLimit: 20 });
    if (!unbounded.ok) throw new Error(unbounded.message);
    expect(unbounded.value.records.length).toBe(20);
    expect(unbounded.value.inScopeCount).toBe(20);
    expect(unbounded.value.hasMore).toBe(true);
    expect(unbounded.value.familyCapped).toEqual(["expense"]);
  });

  it("تصفية العائلة: hasMore داخل العائلة المختارة، والبقية بتاريخ أثر متساوٍ مرتبة حتميًا", async () => {
    const store = new MemoryLocalStore();
    await seedExpenses(store, 25);
    const reader = new ActivityService(store);
    const familyScoped = await reader.readPage({ limit: 120, perFamilyLimit: 20, families: ["expense"] });
    if (!familyScoped.ok) throw inScopeError(familyScoped);
    expect(familyScoped.value.records.length).toBe(20);
    expect(familyScoped.value.hasMore).toBe(true);
    expect(familyScoped.value.familyCapped).toEqual(["expense"]);
    /* الترتيب الأحدث تسجيلًا أولًا حتمي فوق تواريخ أثر متساوية (recordedAt ثم id). */
    const ids = familyScoped.value.records.map(row => row.id);
    const sorted = [...ids].sort((left, right) => {
      const leftIndex = Number(left.split(":")[1]?.replace("exp-", "") ?? -1);
      const rightIndex = Number(right.split(":")[1]?.replace("exp-", "") ?? -1);
      return rightIndex - leftIndex;
    });
    expect(ids).toEqual(sorted);
  });

  it("read() القائمة مطابقة لسجلات readPage — لا تغيير سلوك الأسطح الموجودة", async () => {
    const store = new MemoryLocalStore();
    await seedExpenses(store, 21);
    const reader = new ActivityService(store);
    const legacy = await reader.read({ limit: 120, perFamilyLimit: 20 });
    const paged = await reader.readPage({ limit: 120, perFamilyLimit: 20 });
    if (!legacy.ok) throw new Error(legacy.message);
    if (!paged.ok) throw new Error(paged.message);
    expect(legacy.value).toEqual(paged.value.records);
  });
});

function inScopeError(result: { message: string }): Error {
  return new Error(result.message);
}
