/** @vitest-environment jsdom */

/* المجموعة ٤ (عقد ٢٩ — اختبارات سطوح الأصول): رحلة تسجيل الأصل تسأل سؤال
 * الاستخدام الطويل وتعرض أثرها قبل الحفظ؛ القائمة تعرض الدفتري المشتق؛
 * لا مصروف تشغيلي ولا إهلاك خفي — والكاش يظهر في الأحداث فقط مرة. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { AssetService } from "@/application/assets/assetService";
import { LoanService } from "@/application/loans/loanService";
import { RetainedDepositService } from "@/application/finance/retainedDepositService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { FormDraftService } from "@/application/drafts/formDraftService";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import Assets from "@/pages/Assets";
import AssetEditor from "@/pages/AssetEditor";
import AssetDetail from "@/pages/AssetDetail";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/assets",
  params: {} as Record<string, string>,
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => wouterMocks.params,
  useSearch: () => "",
}));

vi.stubGlobal(
  "prompt",
  vi.fn(() => "سبب موثق للاختبار"),
);

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-09-04T10:00:00.000Z";

let store: MemoryLocalStore;
let assets: AssetService;
const contextRef: { current: Record<string, unknown> } = { current: {} };

function Harness({ page }: { page: React.ReactNode }) {
  const [version, setVersion] = React.useState(0);
  contextRef.current = {
    formDrafts: new FormDraftService(store),
    assets,
    loans: new LoanService(store, () => NOW),
    retainedDeposits: new RetainedDepositService(store, () => NOW),
    dataVersion: version,
    notifyDataChanged: () => setVersion(current => current + 1),
  };
  return <UnsavedChangesProvider navigate={wouterMocks.navigate}>{page}</UnsavedChangesProvider>;
}

beforeEach(() => {
  store = new MemoryLocalStore();
  assets = new AssetService(store, () => NOW);
  wouterMocks.location = "/assets";
  wouterMocks.navigate.mockClear();
  vi.clearAllMocks();
  mockedUsePrototypeServices.mockImplementation(
    () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
  );
});
afterEach(cleanup);

describe("G4 assets surfaces (المجموعة ٤ — عقد ٢٩)", () => {
  it("records a long-use asset through the practical question journey with a preview before save", async () => {
    wouterMocks.location = "/assets/new";
    render(<Harness page={<AssetEditor />} />);
    fireEvent.change(await screen.findByPlaceholderText("مثال: ثلاجة عرض للمحل"), {
      target: { value: "ثلاجة عرض" },
    });
    fireEvent.change(await screen.findByPlaceholderText("مثال: معدات، أثاث، كهربائيات"), {
      target: { value: "كهربائيات" },
    });
    const amount = await screen.findByLabelText("قيمة الشراء");
    fireEvent.change(amount, { target: { value: "600" } });
    fireEvent.blur(amount);
    fireEvent.click(await screen.findByRole("button", { name: "نعم، عمره طويل" }));
    const life = await screen.findByPlaceholderText("مثال: 24");
    fireEvent.change(life, { target: { value: "24" } });
    /* معاينة الأثر قبل الحفظ: إعلان صريح لا خصم ربح. */
    expect(await screen.findByText(/لا يُسجَّل مصروفًا هذا الشهر/)).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: /احفظ الأصل/ }));
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalled());
    const events = await store.listFinancialEvents();
    if (!events.ok) throw new Error(events.message);
    const acquisition = events.value.find(event => event.type === "asset_purchase_cash");
    expect(acquisition).toBeTruthy();
    expect(acquisition!.amountMinor).toBe(60000);
    expect(acquisition!.assetDeltaMinor).toBe(60000);
    expect(acquisition!.operatingExpenseDeltaMinor).toBe(0);
    const list = await store.listAssets();
    if (!list.ok) throw new Error(list.message);
    expect(list.value).toHaveLength(1);
    expect(list.value[0]!.lifeMonths).toBe(24);
  });

  it("rejects saving an asset with an unknown life chosen but invalid life entered", async () => {
    wouterMocks.location = "/assets/new";
    render(<Harness page={<AssetEditor />} />);
    fireEvent.change(await screen.findByPlaceholderText("مثال: ثلاجة عرض للمحل"), {
      target: { value: "ماكينة" },
    });
    const amount = await screen.findByLabelText("قيمة الشراء");
    fireEvent.change(amount, { target: { value: "100" } });
    fireEvent.blur(amount);
    fireEvent.click(await screen.findByRole("button", { name: "نعم، عمره طويل" }));
    fireEvent.change(await screen.findByPlaceholderText("مثال: 24"), { target: { value: "0" } });
    fireEvent.click(await screen.findByRole("button", { name: /احفظ الأصل/ }));
    expect((await screen.findByRole("alert")).textContent ?? "").toContain("العمر النافع");
    const list = await store.listAssets();
    if (!list.ok) throw new Error(list.message);
    expect(list.value).toHaveLength(0);
  });

  it("lists assets with derived book value and unknown-life honesty", async () => {
    await assets.create({
      name: "ثلاجة عرض",
      acquisitionAmountMinor: 60000,
      acquisitionKind: "cash",
      purchaseDate: "2026-06-01",
      lifeMonths: null,
      depreciationStartOn: null,
    });
    render(<Harness page={<Assets />} />);
    expect(await screen.findByText("ثلاجة عرض")).toBeTruthy();
    expect(screen.getByText(/عمره مجهول/)).toBeTruthy();
    /* المجهول يظهر مجهولًا: بطاقة الخلاصة تعلن الأصل بلا جدول إهلاك. */
    expect(screen.getByText(/أصل واحد بعمر أو بداية مجهولة|أصلان بعمر أو بداية مجهولة/)).toBeTruthy();
  });

  it("asset detail records proposed depreciation after explicit confirm and previews the non-cash effect", async () => {
    const created = await assets.create({
      name: "ماكينة",
      acquisitionAmountMinor: 60000,
      acquisitionKind: "cash",
      purchaseDate: "2026-06-01",
      lifeMonths: 24,
      depreciationStartOn: "2026-06-01",
    });
    if (!created.ok) return;
    wouterMocks.location = `/assets/${created.value.asset.id}`;
    window.history.pushState({}, "", `/assets/${created.value.asset.id}`);
    render(<Harness page={<AssetDetail />} />);
    expect(await screen.findByText("ماكينة")).toBeTruthy();
    expect(await screen.findByText(/لا يخصم من الصندوق شيئًا|تسجيله يخفض ربح فترته فقط/)).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: /سجّل الإهلاك المستحق/ }));
    await waitFor(async () => {
      const events = await store.listFinancialEvents();
      if (!events.ok) throw new Error(events.message);
      expect(events.value.filter(event => event.type === "asset_depreciation")).toHaveLength(1);
    });
    const events = await store.listFinancialEvents();
    if (!events.ok) throw new Error(events.message);
    const depreciation = events.value.find(event => event.type === "asset_depreciation")!;
    expect(depreciation.cashDeltaMinor).toBe(0);
    expect(depreciation.assetDeltaMinor).toBe(-7500);
    /* بعد التسجيل: لا مستحق جديد — العرض يعلنها بدل زر التسجيل. */
    expect(await screen.findByText(/لا مستحق جديد/)).toBeTruthy();
    const events2 = await store.listFinancialEvents();
    if (!events2.ok) throw new Error(events2.message);
    expect(events2.value.filter(event => event.type === "asset_depreciation")).toHaveLength(1);
  });
  it("surfaces acquisition correction with reverse+replace events and preserved history", async () => {
    const created = await assets.create({
      name: "ثلاجة عرض",
      acquisitionAmountMinor: 60000,
      acquisitionKind: "cash",
      purchaseDate: "2026-06-01",
      lifeMonths: 24,
      depreciationStartOn: "2026-06-01",
    });
    if (!created.ok) return;
    wouterMocks.location = `/assets/${created.value.asset.id}`;
    window.history.pushState({}, "", `/assets/${created.value.asset.id}`);
    render(<Harness page={<AssetDetail />} />);
    expect(await screen.findByText("ثلاجة عرض")).toBeTruthy();
    /* سطح تصحيح الاقتناء (تصحيح مراجعة 4-c): زر نصي يفتح النموذج المتدرّج. */
    fireEvent.click(await screen.findByRole("button", { name: /صحّح قيمة أو طريقة الاقتناء/ }));
    const corrected = await screen.findByLabelText("قيمة الشراء الصحيحة");
    fireEvent.change(corrected, { target: { value: "480" } });
    fireEvent.blur(corrected);
    fireEvent.change(await screen.findByLabelText("طريقة الدفع الصحيحة"), {
      target: { value: "payable" },
    });
    const reason = await screen.findByPlaceholderText("مثال: الفاتورة الحقيقية كانت أعلى");
    fireEvent.change(reason, { target: { value: "الفاتورة الحقيقية" } });
    fireEvent.click(await screen.findByRole("button", { name: /صحّح الاقتناء/ }));
    await waitFor(() => {
      /* معاينة الأثر: التصحيح معلن قبل التنفيذ. */
      expect(screen.queryByText(/سيظهر التراجع والبديل في التاريخ/)).toBeTruthy();
    });
    const events = await store.listFinancialEvents();
    if (!events.ok) throw new Error(events.message);
    const originals = events.value.filter(
      event => event.type === "asset_purchase_cash" && event.correctionType !== "reverse",
    );
    const replacements = events.value.filter(
      event => event.type === "asset_purchase_payable" && event.correctionType !== "reverse",
    );
    const reversals = events.value.filter(event => event.correctionType === "reverse");
    expect(originals).toHaveLength(1);
    expect(replacements).toHaveLength(1);
    expect(reversals).toHaveLength(1);
    /* الأصل يحتفظ بهويته ودفته يتبع البديل؛ التاريخ لم يُمس. */
    const list = await store.listAssets();
    if (!list.ok) throw new Error(list.message);
    expect(list.value).toHaveLength(1);
    expect(list.value[0]!.acquisitionAmountMinor).toBe(48000);
    expect(list.value[0]!.acquisitionKind).toBe("payable");
    expect(list.value[0]!.acquisitionEventId).toBe(replacements[0]!.id);
  });
});
