/** @vitest-environment jsdom */
/* S10 (UNIT-031/032 T01 — أمر b56967d8): رحلات DOM لحاسبة التخطيط — سيناريو
 * قبول المرحلة: صندوق بمكونات الوحدة يتكرر 10 بسعر بيع 10 ⇒ ربح متوقع 30
 * وهامش 30٪ من سعر البيع «بحسب التكاليف المدرجة»؛ حفظ/فتح/تحديث/نسخة/حذف
 * بهوية ثابتة وبلا أي أثر أعمال؛ والمجهول لا يصير صفرًا (مكوّن بلا سعر
 * «غير محدد بعد»)؛ وحساب سابق يفتح بنطاقه الأصلي بلا إعادة تفسير. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { createPlanningCalculatorHarness } from "@/application/estimates/planningCalculatorTestHarness";
import type { CostEstimateService } from "@/application/estimates/costEstimateService";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import CostCalculator from "./CostCalculator";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({ navigate: vi.fn(), location: "/tools/calculator" }));
const searchState = vi.hoisted(() => ({ search: "" }));

vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useSearch: () => searchState.search,
  Redirect: ({ to }: { to: string }) => {
    void to;
    return null;
  },
  Link: ({ children }: { children: React.ReactNode }) => <a href="#">{children}</a>,
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-10-31T09:00:00.000Z";

type PlanningCalculatorHarness = ReturnType<typeof createPlanningCalculatorHarness>;

function renderCalculator(harness: PlanningCalculatorHarness): CostEstimateService {
  /* نفس مخزن الجلسة وخدمتيه — الصفحة تقرأ/تكتب ما يتحقق منه الاختبار
   * حرفيًا (رحلة كاملة عبر الحد الحقيقي لا كعبًا منفصلًا). */
  mockedUsePrototypeServices.mockReturnValue({
    costEstimates: harness.costEstimates,
    planningCalculations: harness.planningCalculations,
    dataVersion: 0,
    notifyDataChanged: vi.fn(),
  } as unknown as ReturnType<typeof usePrototypeServices>);
  render(
    <UnsavedChangesProvider navigate={() => undefined}>
      <CostCalculator />
    </UnsavedChangesProvider>,
  );
  return harness.costEstimates;
}

/** كتابة قيمة حقل رقمي داخل صفحة الحاسبة — الإدخال القانوني للأرقام. */
async function typeInto(label: string | RegExp, text: string) {
  const user = userEvent.setup();
  const field = await screen.findByLabelText(label);
  await user.clear(field);
  await user.type(field, text);
  fireEvent.blur(field);
}

describe("S10 T01 planning calculator DOM journeys", () => {
  beforeEach(() => {
    searchState.search = "";
    wouterMocks.location = "/tools/calculator";
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("رحلة المالك: مكونات وحدة ×10 وسعر 10 ⇒ ربح متوقع 30 وهامش 30٪ — بلا أي أثر أعمال", async () => {
    const harness = createPlanningCalculatorHarness(() => NOW);
    renderCalculator(harness);

    await typeInto("اسم المنتج أو الخدمة 1", "صندوق هدايا");
    await typeInto("المكوّن 1", "صندوق خشب");
    await typeInto("سعر وحدة المكوّن 1 للمجموعة 1", "2");
    const addComponent = screen.getByRole("button", { name: "أضف مكوّنًا للوحدة" });
    await userEvent.click(addComponent);
    await typeInto("المكوّن 2", "شوكولاتة");
    await typeInto("كمية المكوّن 2 للمجموعة 1", "2");
    await typeInto("سعر وحدة المكوّن 2 للمجموعة 1", "0.5");
    await userEvent.click(screen.getByRole("button", { name: "أضف مكوّنًا للوحدة" }));
    await typeInto("المكوّن 3", "لعبة");
    await typeInto("سعر وحدة المكوّن 3 للمجموعة 1", "3");
    await userEvent.click(screen.getByRole("button", { name: "أضف مكوّنًا للوحدة" }));
    await typeInto("المكوّن 4", "وردة");
    await typeInto("سعر وحدة المكوّن 4 للمجموعة 1", "1");
    await typeInto("كمية المجموعة 1", "10");
    await typeInto("سعر بيع الوحدة للمجموعة 1", "10");

    const result = await screen.findByText(/ربح متوقع/);
    expect(result.textContent).toContain("30.00");
    /* الهامش من سعر البيع — النسبة المئوية العربية معزولة bdi داخل النتيجة. */
    expect(result.textContent).toContain("30٪ من سعر البيع");
    /* تكلفة التسعير 70 (7.00 للوحدة) عبر النواة الواحدة. */
    expect(screen.getByText(/تكلفة التسعير:/).textContent).toContain("70.00");

    /* الحكم الحاسم: لا كاش ولا أحداث ولا طلبات ولا مخزون — المعاينة نقية. */
    const orders = await harness.store.listOrders();
    expect(orders.ok && orders.value).toHaveLength(0);
    const events = await harness.store.listFinancialEvents();
    expect(events.ok && events.value).toHaveLength(0);
    const estimates = await harness.store.listCostEstimates();
    expect(estimates.ok && estimates.value).toHaveLength(0);
  });

  it("مكوّن مسمى بلا سعر يظل «غير محدد بعد» مستبعدًا — لا صفر مضلل", async () => {
    const harness = createPlanningCalculatorHarness(() => NOW);
    renderCalculator(harness);
    await typeInto("اسم المنتج أو الخدمة 1", "صندوق");
    await typeInto("المكوّن 1", "خشب");
    await typeInto("سعر وحدة المكوّن 1 للمجموعة 1", "2");
    const addComponent = screen.getByRole("button", { name: "أضف مكوّنًا للوحدة" });
    await userEvent.click(addComponent);
    await typeInto("المكوّن 2", "شريط ساتان");
    /* لا سعر للمكوّن الثاني — يبقى غير محدد بعد. */
    await screen.findByText(/غير محدد بعد/);
    expect(screen.getByText(/شريط ساتان/).textContent).toContain("شريط ساتان");
  });

  it("حفظ الحساب ثم فتحه من «حساباتي المحفوظة» يعيد مدخلاته — والتحديث يحدث السجل نفسه", async () => {
    const harness = createPlanningCalculatorHarness(() => NOW);
    const service = harness.costEstimates;
    renderCalculator(harness);

    await typeInto(/عنوان الحساب/, "صندوق هدايا");
    await typeInto("اسم المنتج أو الخدمة 1", "صندوق هدايا");
    await typeInto("المكوّن 1", "خشب");
    await typeInto("سعر وحدة المكوّن 1 للمجموعة 1", "2");
    await typeInto("سعر بيع الوحدة للمجموعة 1", "10");

    const saveButton = await screen.findByRole("button", { name: "احفظ الحساب" });
    await userEvent.click(saveButton);
    await screen.findByText(/تم حفظ الحساب/);

    /* «حساباتي المحفوظة» تظهر داخل الحاسبة عند وجود محفوظ. */
    const savedRow = await screen.findByTestId("saved-calculation-row");
    expect(savedRow.textContent).toContain("صندوق هدايا");

    /* الفتح من القائمة يعيد المدخلات في المحرر نفسه (لا محرر ثانٍ). */
    await userEvent.click(within(savedRow).getByRole("button", { name: "صندوق هدايا" }));
    await waitFor(() => {
      expect((screen.getByLabelText("اسم المنتج أو الخدمة 1") as HTMLInputElement).value).toBe("صندوق هدايا");
      expect((screen.getByLabelText("سعر بيع الوحدة للمجموعة 1") as HTMLInputElement).value).toBe("10.00");
    });
    /* وضع التعديل: الزر «احفظ التعديلات» و«احفظ نسخة جديدة». */
    expect(screen.getByRole("button", { name: /احفظ التعديلات/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /احفظ نسخة جديدة/ })).toBeTruthy();

    /* التحديث يحدث السجل نفسه — لا ثاني. */
    await typeInto("سعر بيع الوحدة للمجموعة 1", "12");
    await userEvent.click(screen.getByRole("button", { name: /احفظ التعديلات/ }));
    await screen.findByText(/حُفظ تعديل الحساب نفسه/);
    const list = await service.list();
    if (!list.ok) throw new Error(list.message);
    expect(list.value).toHaveLength(1);
    /* سعر 12 د.أ للوحدة بتكرار 1 ⇒ قيمة البيع 1200 minor في السجل نفسه. */
    expect(list.value[0]?.planning?.savedResult.sellingTotalMinor).toBe(1200);

    /* صفر أثر أعمال بعد الحفظ والتحديث. */
    const orders = await harness.store.listOrders();
    expect(orders.ok && orders.value).toHaveLength(0);
    const events = await harness.store.listFinancialEvents();
    expect(events.ok && events.value).toHaveLength(0);
  });

  it("حفظ نسخة صريح ينشئ هوية جديدة ويبقي الأصل", async () => {
    const harness = createPlanningCalculatorHarness(() => NOW);
    const service = harness.costEstimates;
    renderCalculator(harness);
    await typeInto(/عنوان الحساب/, "صندوق");
    await typeInto("اسم المنتج أو الخدمة 1", "صندوق");
    await typeInto("المكوّن 1", "خشب");
    await typeInto("سعر وحدة المكوّن 1 للمجموعة 1", "2");
    await typeInto("سعر بيع الوحدة للمجموعة 1", "10");
    await userEvent.click(await screen.findByRole("button", { name: "احفظ الحساب" }));
    await screen.findByText(/تم حفظ الحساب/);
    await userEvent.click(screen.getByRole("button", { name: /احفظ نسخة جديدة/ }));
    await screen.findByText(/حُفظت نسخة جديدة/);
    const list = await service.list();
    if (!list.ok) throw new Error(list.message);
    expect(list.value).toHaveLength(2);
  });

  it("حذف حساب محفوظ بتأكيد يحذفه وحده — ولا يمس طلبًا ولا منتجًا", async () => {
    const harness = createPlanningCalculatorHarness(() => NOW);
    const service = harness.costEstimates;
    renderCalculator(harness);
    await typeInto(/عنوان الحساب/, "صندوق");
    await typeInto("اسم المنتج أو الخدمة 1", "صندوق");
    await typeInto("المكوّن 1", "خشب");
    await typeInto("سعر وحدة المكوّن 1 للمجموعة 1", "2");
    await userEvent.click(await screen.findByRole("button", { name: "احفظ الحساب" }));
    await screen.findByText(/تم حفظ الحساب/);

    const row = screen.getByTestId("saved-calculation-row");
    await userEvent.click(within(row).getByRole("button", { name: /حذف حساب/ }));
    const confirmText = await screen.findByText(/احذف «صندوق» نهائيًا؟/);
    expect(confirmText.textContent).toContain("لا يحذف هذا أي طلب أو منتج أو سجل مالي");
    await userEvent.click(within(row).getByRole("button", { name: "احذفه" }));
    await waitFor(async () => {
      const list = await service.list();
      expect(list.ok && list.value).toHaveLength(0);
    });
    /* حذف آخر محفوظ يخفي مدخل المحفوظات. */
    await waitFor(() => {
      expect(screen.queryByTestId("saved-calculation-row")).toBeNull();
    });
  });

  it("تقدير قديم (بلا حقل تخطيط) يفتح في محرره التوافقي بنطاقه — بلا إعادة تفسير", async () => {
    const harness = createPlanningCalculatorHarness(() => NOW);
    const service = harness.costEstimates;
    const legacy = await service.save({
      title: "تقدير قديم",
      materialItems: [{ name: "دقيق", quantity: 2, unit: "كيلو", unitPriceMinor: 1200, confidence: "known" }],
      time: null,
      packagingMinor: 0,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 500,
      quantity: 2,
      note: null,
    });
    if (!legacy.ok) throw new Error(legacy.message);

    searchState.search = `?estimate=${legacy.value.id}`;
    renderCalculator(harness);
    /* إشعار الحساب السابق + حقول النموذج الأصلي كما حفظت (مواد الدفعة وعدد القطع). */
    await screen.findByText(/حساب سابق بنموذج ما قبل/);
    expect((screen.getByLabelText("عدد القطع الناتجة") as HTMLInputElement).value).toBe("2");
    expect((screen.getByLabelText("كمية المادة 1") as HTMLInputElement).value).toBe("2");
    expect((screen.getByLabelText("سعر وحدة المادة 1") as HTMLInputElement).value).toBe("12.00");
    /* لا مدخل «حفظ نسخة» في الوضع القديم — تحديث السجل نفسه فقط. */
    expect(screen.queryByRole("button", { name: /احفظ نسخة جديدة/ })).toBeNull();
  });

  it("رابط حساب محذوف يفتح الحاسبة فارغة برسالة صادقة ولا يغير شيئًا", async () => {
    const harness = createPlanningCalculatorHarness(() => NOW);
    searchState.search = "?estimate=estimate-gone";
    renderCalculator(harness);
    await screen.findByText(/لم نجد الحساب المطلوب فتحه/);
  });

  it("مساعدة اقتراح السعر: تكلفة 9 وهامش 25٪ ⇒ 12؛ وزيادة 25٪ ⇒ 11.25 (U031-AC11)", async () => {
    const harness = createPlanningCalculatorHarness(() => NOW);
    renderCalculator(harness);
    await typeInto("اسم المنتج أو الخدمة 1", "خدمة تنظيم");
    await typeInto("المكوّن 1", "جهد");
    await typeInto("سعر وحدة المكوّن 1 للمجموعة 1", "9");

    /* فتح طبقة المساعدة وتجربة الهامش. */
    fireEvent.click(screen.getByText("ساعدني في تحديد السعر"));
    const basisSelect = await screen.findByLabelText("أساس الاقتراح");
    await userEvent.selectOptions(basisSelect, "margin");
    await typeInto("قيمة هدف التسعير", "25");
    await userEvent.click(screen.getByRole("button", { name: "احسب السعر المقترح" }));
    const marginSuggestion = await screen.findByText(/سعر مقترح/);
    expect(marginSuggestion.textContent).toContain("12.00");
    expect(marginSuggestion.textContent).toContain("هامش 25");

    await userEvent.selectOptions(basisSelect, "markup");
    await typeInto("قيمة هدف التسعير", "25");
    await userEvent.click(screen.getByRole("button", { name: "احسب السعر المقترح" }));
    const markupSuggestion = await screen.findByText(/سعر مقترح/);
    expect(markupSuggestion.textContent).toContain("11.25");
    expect(markupSuggestion.textContent).toContain("زيادة 25");
  });
});
