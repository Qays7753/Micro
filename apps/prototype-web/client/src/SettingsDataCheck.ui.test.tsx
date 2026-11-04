/** @vitest-environment jsdom */
/* S17 (DOC-026 / UNIT-033 — قسم «فحص البيانات» داخل الإعدادات): تشغيل الفحص
 * من القسم يعرض الخلاصة الصادقة وبطاقات الفحوص بكلمة وأيقونة، والروابط
 * العميقة تُبنى بReturnTo محفوظ، والمخزن لا يتغير (صفر كتابات) — الخدمات
 * حقيقية فوق مخزن الذاكرة نفسه، والحالات الصادقة لعقد A3 مثبتة: لا أخضر
 * قبل التشغيل، و«لم نكتشف مشكلة ضمن الفحوص المنفذة» لا «كل الحسابات
 * صحيحة»، والضغط المتكرر تشغيل واحد. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices, getPrototypeLocalStore } from "@/app/PrototypeServicesContext";
import { IntegrityCheckService } from "@/application/finance/integrityCheckService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { StatementService } from "@/application/finance/statementService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { SettingsDataCheckSection } from "@/components/settings/SettingsDataCheckSection";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
  getPrototypeLocalStore: vi.fn(),
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const mockedGetStore = vi.mocked(getPrototypeLocalStore);

const now = () => "2026-11-04T09:00:00.000Z";

function buildRealServices(store: MemoryLocalStore) {
  const projectFinance = new ProjectFinancialService(store, now);
  const statement = new StatementService(store, projectFinance);
  const cashContinuity = new CashContinuityService(store, now);
  const integrityCheck = new IntegrityCheckService(store, projectFinance, statement, cashContinuity, now);
  return { projectFinance, statement, cashContinuity, integrityCheck };
}

/* أمر استئناف S14 (A3): القسم يبني فحص السلامة عند أول فتح بساعة النظام
 * الافتراضية؛ يُثبَّت Date على لحظة الاختبار فيصير التقرير حتميًا. */
function freezeAtTestNow() {
  vi.useFakeTimers({ now: new Date(now()), toFake: ["Date"] });
}

async function renderOpenSection(store: MemoryLocalStore, services: ReturnType<typeof buildRealServices>) {
  mockedGetStore.mockReturnValue(store as never);
  mockedUsePrototypeServices.mockReturnValue({
    ...services,
    dataVersion: 0,
    notifyDataChanged: vi.fn(),
  } as unknown as ReturnType<typeof usePrototypeServices>);
  render(<SettingsDataCheckSection open={true} onToggle={() => {}} />);
  /* الخدمة تُحمّل كسولًا — الجاهزية تُثبت بظهور عدّ الفحوص المسجل (TOOL-001). */
  await screen.findByText(/أرقامك كما هي/);
  return services;
}

describe("SettingsDataCheckSection (فحص البيانات داخل الإعدادات — UNIT-033)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    freezeAtTestNow();
  });
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("idle state is honest — no fake green, the read-only promise, and no invented run history (A3/AC03)", async () => {
    const store = new MemoryLocalStore();
    const services = buildRealServices(store);
    await renderOpenSection(store, services);

    expect(screen.getByText("يقرأ أرقامك ولا يغيّر شيئًا.")).toBeTruthy();
    /* A3: «لم تُفحص البيانات بعد» — لا عبارة سلامة قبل التشغيل ولا إنذارًا. */
    expect(screen.getByText(/لم تُفحص البيانات بعد/)).toBeTruthy();
    expect(screen.queryByText(/كل الحسابات صحيحة/)).toBeNull();
    /* TOOL-001: عدّ مشتق من سجل الخدمة نفسه. */
    const registered = services.integrityCheck.registeredCheckCount();
    expect(registered).toBeGreaterThanOrEqual(13);
    expect(screen.getByText(new RegExp(`${registered} (فحصًا|فحوص|فحص)`))).toBeTruthy();
  });

  it("a full run renders the scoped honest verdict, check cards, and the store is untouched (A3/AC04 + zero writes)", async () => {
    const store = new MemoryLocalStore();
    const services = buildRealServices(store);
    await services.projectFinance.record({
      type: "owner_investment_cash",
      amountMinor: 100000,
      occurredOn: "2026-11-01",
      note: "استثمار",
      counterparty: null,
      relatedEventId: null,
      idempotencyKey: "section-integrity-inv",
    });
    const snapshotBefore = await store.readSnapshot();
    await renderOpenSection(store, services);

    fireEvent.click(screen.getByRole("button", { name: /بدء الفحص/ }));
    /* A3: النجاح ضمن النطاق فقط — «لم نكتشف مشكلة ضمن الفحوص المنفذة»،
     * لا «كل الحسابات صحيحة» ولا شهادة صحة محاسبية شاملة. */
    expect(await screen.findByText(/لم نكتشف مشكلة ضمن الفحوص المنفذة/)).toBeTruthy();
    expect(screen.getByText(/الاتساق لا الجدوى/)).toBeTruthy();
    const registered = services.integrityCheck.registeredCheckCount();
    const totals = screen.getByTestId("integrity-status-totals");
    expect(totals.textContent).toContain(`من أصل ${registered} فحصًا مسجلًا`);
    /* النتيجة بوقتها ونطاقها، مع دعوة إعادة الفحش للتحقق من الحالة الحالية. */
    expect(screen.getByText(/آخر تشغيل مكتمل:/)).toBeTruthy();
    expect(screen.getByText(/أعد الفحص للتحقق من البيانات الحالية/)).toBeTruthy();
    /* الحالة كلمة لا لونًا: «سليم» ظاهرة نصًّا لكل فحص ناجح. */
    expect(screen.getAllByText("سليم").length).toBeGreaterThanOrEqual(5);
    expect(screen.getByText("تطابق نتيجة الفترة")).toBeTruthy();

    /* صفر كتابات: اللقطة قبل وبعد متطابقة تمامًا (الفحص قراءة خالصة). */
    const snapshotAfter = await store.readSnapshot();
    if (!snapshotBefore.ok || !snapshotAfter.ok) throw new Error("snapshot reads should succeed");
    expect(JSON.stringify(snapshotAfter.value)).toBe(JSON.stringify(snapshotBefore.value));
  });

  it("a failing check renders its deep link to the focused event row (A3/AC05 + review delegation)", async () => {
    const store = new MemoryLocalStore();
    const services = buildRealServices(store);
    const recorded = await services.projectFinance.record({
      type: "operating_expense_cash",
      amountMinor: 2500,
      occurredOn: "2026-11-02",
      note: "بنزين",
      counterparty: null,
      relatedEventId: null,
      expenseContext: {
        relationship: "project",
        behavior: "variable",
        purpose: "project_general",
        knowledge: "known",
        sharedProjectShare: null,
      },
      idempotencyKey: "section-integrity-expense",
    });
    if (!recorded.ok) throw new Error(recorded.message);
    /* تلف مزروع: تعديل الدلتا مباشرة في المخزن (تجاوز المسار الحي). */
    await store.saveFinancialEvent({ ...recorded.value, cashDeltaMinor: -999 });
    await renderOpenSection(store, services);

    fireEvent.click(screen.getByRole("button", { name: /بدء الفحص/ }));
    expect(await screen.findByText(/يوجد خلل يحتاج تصحيحًا موثقًا/)).toBeTruthy();
    expect(screen.getAllByText("خلل").length).toBeGreaterThan(0);
    /* المراجعة تفوَّض لمالك المصدر بروابط عميقة — لا إصلاح آلي من القارئ. */
    const openLinks = screen.getAllByRole("button", { name: "افتح السجل المعني" });
    expect(openLinks.length).toBeGreaterThan(0);
    expect(screen.getByText(/أعرض السجلات المتأثرة/)).toBeTruthy();
  });

  it("repeated activation is one intended run — a synchronous double click never starts overlapping runs (B4/AC12)", async () => {
    const store = new MemoryLocalStore();
    const services = buildRealServices(store);
    await renderOpenSection(store, services);

    /* المقياس: عدد قراءات سجل الأحداث في تشغيل واحد — ثم ضغطتان متزامنتان
     * في جولة ثانية يجب أن تنتجا العدد نفسه (تشغيلًا واحدًا) لا ضعفه. */
    const listSpy = vi.spyOn(store, "listFinancialEvents");
    fireEvent.click(screen.getByRole("button", { name: /بدء الفحص/ }));
    await waitFor(() => expect(screen.getByText(/آخر تشغيل مكتمل:/)).toBeTruthy());
    const singleRunReads = listSpy.mock.calls.length;
    expect(singleRunReads).toBeGreaterThan(0);

    cleanup();
    listSpy.mockClear();
    await renderOpenSection(store, services);
    const button = screen.getByRole("button", { name: /بدء الفحص/ });
    /* ضغطتان متزامنتان قبل أي إعادة رسم — الحارس المرجع يمنع التداخل. */
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByText(/آخر تشغيل مكتمل:/)).toBeTruthy());
    expect(listSpy.mock.calls.length).toBe(singleRunReads);
  });

  it("a read failure surfaces as UNAVAILABLE — never green, never zero, with retry available (A3/AC06)", async () => {
    const store = new MemoryLocalStore();
    const services = buildRealServices(store);
    /* فشل قراءة مزروع: سجل الأحداث يرفض القراءة — الخدمة تُظهر كل الفحوص
     * «غير متاح» (لا تقليص للقائمة ولا نجاحًا مفبركًا ولا صفر مشكلات). */
    const failingStore = {
      ...store,
      listFinancialEvents: () =>
        Promise.resolve({ ok: false as const, code: "storage_error", message: "تعذّرت القراءة" }),
    } as unknown as MemoryLocalStore;
    await renderOpenSection(failingStore, services);

    fireEvent.click(screen.getByRole("button", { name: /بدء الفحص/ }));
    expect(await screen.findByText(/تعذّر إكمال الفحص؛ تعذّرت قراءة مصادر بعض الفحوص/)).toBeTruthy();
    const totals = screen.getByTestId("integrity-status-totals");
    expect(totals.textContent).toContain("غير متاح");
    /* لا أخضر ولا صفر مشكلات: صفر سليم، وكل الفحوص المسجلة معلنة غير متاحة. */
    const registered = services.integrityCheck.registeredCheckCount();
    expect(totals.textContent).toContain("0 سليم");
    expect(totals.textContent).toContain(`${registered} غير متاح`);
    expect(totals.textContent).toContain(`من أصل ${registered} فحصًا مسجلًا`);
    expect(screen.queryByText(/لم نكتشف مشكلة/)).toBeNull();
    /* إعادة المحاولة متاحة — الفشل ليس نهاية ولا يتحول فراغًا. */
    expect(screen.getByRole("button", { name: /بدء الفحص/ }).hasAttribute("disabled")).toBe(false);
  });
});
