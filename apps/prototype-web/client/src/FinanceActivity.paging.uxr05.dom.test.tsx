/** @vitest-environment jsdom */
/**
 * UXR-05 (PERF-003): سطح سجل النشاط — الحد مُفصح عنه والبقية بمتناول
 * «عرض المزيد»؛ لا يكتب السطح «السجل الكامل» فوق قراءة مقتطعة (عقد ٣٠ §2.2
 * وعقد READ). يقرأ عبر الخدمة الحقيقية فوق مخزن الذاكرة.
 *
 * ⚠️ مؤجل التشغيل بأمر المالك (أمر التنفيذ المتصل 2026-11-06 §6): يُكتب مع
 * التغيير ولا يُشغَّل إلا في التحقق الشامل بعد W05. */
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
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
  it("121 سجلًا: تُعرض 120 مع إفصاح الحد و«عرض المزيد»، والنقرة تكشف الحادي والعشرين بعد المئة والعشرين", async () => {
    const store = new MemoryLocalStore();
    await seedExpenses(store, 121);
    renderActivity(store);
    /* الإفصاح: العدد المعروض + الوصول — لا ادعاء اكتمال ولا اقتطاع صامت. */
    expect(await screen.findByText(/تُعرض أحدث 120 عملية ضمن هذا النطاق/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "عرض المزيد" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "عرض المزيد" }));
    expect(await screen.findByText(/تُعرض أحدث 121 عملية ضمن هذا النطاق/)).toBeTruthy();
  });

  it("19 سجلًا تحت حد العائلة: لا إفصاح ولا زر مزيد — القراءة مكتملة فعلًا", async () => {
    const store = new MemoryLocalStore();
    await seedExpenses(store, 19);
    renderActivity(store);
    await screen.findByText("الصفوف الأحدث أولًا");
    expect(screen.queryByRole("button", { name: "عرض المزيد" })).toBeNull();
    expect(screen.queryByText(/تُعرض أحدث/)).toBeNull();
  });

  it("نطاق «منذ البداية» يوصف نطاقًا لا اكتمالًا: يظهر سطر النطاق لا ادعاء السجل الكامل", async () => {
    const store = new MemoryLocalStore();
    await seedExpenses(store, 5);
    renderActivity(store);
    expect(await screen.findByText(/نطاق القراءة: من/)).toBeTruthy();
    expect(screen.queryByText("كل النشاط المسجّل منذ البداية.", { exact: true })).toBeNull();
  });
});
