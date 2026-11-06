/** @vitest-environment jsdom */
/**
 * UXR-05 (PERF-003): سطح سجل النشاط — الحد مُفصح عنه والبقية بمتناول
 * «عرض المزيد»؛ لا يكتب السطح «السجل الكامل» فوق قراءة مقتطعة (عقد ٣٠ §2.2
 * وعقد READ). يقرأ عبر الخدمة الحقيقية فوق مخزن الذاكرة.
 *
 * ⚠️ مؤجل التشغيل بأمر المالك (أمر التنفيذ المتصل 2026-11-06 §6): يُكتب مع
 * التغيير ولا يُشغَّل إلا في التحقق الشامل بعد W05. */
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFinancialEvent } from "@micro-domain/financial-event/index.js";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { ActivityService } from "@/application/activity/activityService";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import FinanceActivity from "@/pages/FinanceActivity";

vi.mock("wouter", () => ({
  useSearch: () => "",
  useLocation: () => ["/finance/activity", vi.fn()],
  useParams: () => ({}),
}));

/* تصحيح مؤرخ 2026-11-06 (UXR-W05 — فحوص المرحلة النهائية): المصنع كان
 * مفقودًا فـvi.mocked فوق دالة غير مموهة يفشل بmockReturnValue undefined —
 * دين التشغيل المؤجل (كُتب بأمر المالك بلا تشغيل في W04) سُدد هنا. */
vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);

async function seedExpenses(store: MemoryLocalStore, count: number) {
  for (let index = 0; index < count; index += 1) {
    const event = createFinancialEvent({
      id: `exp-${index}`,
      type: "operating_expense_cash",
      amountMinor: 100 + index,
      occurredOn: "2026-09-01",
      recordedAt: `2026-09-01T08:${String(Math.floor(index / 60)).padStart(2, "0")}:${String(index % 60).padStart(2, "0")}.000Z`,
      idempotencyKey: `exp-${index}`,
      note: `مصروف رقم ${index}`,
      counterparty: null,
    });
    const saved = await store.saveFinancialEvent(event);
    if (!saved.ok) throw new Error(saved.message);
  }
}

function renderActivity(store: MemoryLocalStore) {
  const activity = new ActivityService(store);
  let version = 0;
  mockedUsePrototypeServices.mockReturnValue({
    activity,
    dataVersion: version,
    notifyDataChanged: () => {
      version += 1;
    },
  } as unknown as ReturnType<typeof usePrototypeServices>);
  return render(<FinanceActivity />);
}

afterEach(() => {
  cleanup();
});

describe("UXR-05 — PERF-003: سجل النشاط يفصح عن حدّه ويصل للبقية", () => {
  /* تصحيح مؤرخ 2026-11-06 (UXR-W05 — فحوص المرحلة النهائية): الاختبار كُتب في W04
   * بلا تشغيل (أمر المالك) على نموذج خاطئ: (١) البذر في أيلول خارج نطاق الأسبوع
   * الافتراضي فالسطح يعرض «لا نتائج» لا الصفوف — الاختيار الصادق هو نطاق
   * «منذ البداية» الذي يقرأ كل شيء؛ (٢) نافذة القراءة الكنونية 120/20 (عقد ٣٠
   * §2.2) فحد العائلة (20) يسبق الحد الكلي لعائلة واحدة — الإفصاح يعرض
   * العدد المقبول فعلًا (20) ثم «عرض المزيد» يرفع الحدّين معًا (W04) فالنقرة
   * تُظهر 40. الادعاءات هنا مطابقة للعقد والتنفيذ المختبر في اختبار الخدمة. */
  it("121 سجلًا من عائلة واحدة: حد العائلة مُفصح (20) و«عرض المزيد» يرفع الحدّين معًا فتكشف المزيد", async () => {
    const store = new MemoryLocalStore();
    await seedExpenses(store, 121);
    renderActivity(store);
    fireEvent.click(await screen.findByRole("button", { name: "منذ البداية" }));
    /* الإفصاح: العدد المعروض فعلًا (حد العائلة يلزم أولًا) + الوصول — لا ادعاء اكتمال ولا اقتطاع صامت. */
    expect(await screen.findByText(/تُعرض أحدث 20 عملية ضمن هذا النطاق/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "عرض المزيد" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "عرض المزيد" }));
    expect(await screen.findByText(/تُعرض أحدث 40 عملية ضمن هذا النطاق/)).toBeTruthy();
  });

  it("19 سجلًا تحت حد العائلة: لا إفصاح ولا زر مزيد — القراءة مكتملة فعلًا", async () => {
    const store = new MemoryLocalStore();
    await seedExpenses(store, 19);
    renderActivity(store);
    fireEvent.click(await screen.findByRole("button", { name: "منذ البداية" }));
    await screen.findByText("الصفوف الأحدث أولًا");
    expect(screen.queryByRole("button", { name: "عرض المزيد" })).toBeNull();
    expect(screen.queryByText(/تُعرض أحدث/)).toBeNull();
  });

  it("نطاق «منذ البداية» يوصف نطاقًا لا اكتمالًا: يظهر سطر النطاق لا ادعاء السجل الكامل", async () => {
    const store = new MemoryLocalStore();
    await seedExpenses(store, 5);
    renderActivity(store);
    expect(await screen.findByText(/نطاق القراءة: من/)).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: "منذ البداية" }));
    expect(await screen.findByText(/نطاق القراءة: كل النشاط المسجّل منذ البداية/)).toBeTruthy();
    /* العبارة بادئة «نطاق القراءة:» وصفًا للنطاق — لا عنوانًا يدّعي السجل الكامل. */
    expect(screen.queryByRole("heading", { name: "كل النشاط المسجّل منذ البداية." })).toBeNull();
  });
});
