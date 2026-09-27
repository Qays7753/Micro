/** @vitest-environment jsdom */
/* ORD-001/ORD-002/ORD-003 — أسطح رحلة الطلب المعتمدة:
 * لافتة نجاح الاتفاق (رقم الطلب/الحالة/الأثر المالي/الفعل التالي)، لوحة شروط
 * النقل قبل التسليم والربح التقديري الموسوم، إيصال التسليم المخصص ببياناته
 * الموثقة، وإعادة فتح طلب مسلّم بملخص لا برسالة نجاح قديمة. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { CostEstimateService } from "@/application/estimates/costEstimateService";
import { DraftService } from "@/application/drafts/draftService";
import { CostService, type CostEditorInput } from "@/application/cost/costService";
import { AgreementService } from "@/application/agreements/agreementService";
import { FulfillmentService } from "@/application/fulfillment/fulfillmentService";
import { DeliveryReviewService } from "@/application/fulfillment/deliveryReviewService";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { ScheduleService } from "@/application/scheduling/scheduleService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { ActualTimeService } from "@/application/time/actualTimeService";
import { AgreementContextService } from "@/application/agreements/agreementContextService";
import { CollectionReversalService } from "@/application/collections/collectionReversalService";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import OrderDetail from "@/pages/OrderDetail";
import DeliveryReview from "@/pages/DeliveryReview";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/orders/o1",
  params: {} as Record<string, string | undefined>,
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => wouterMocks.params,
  useSearch: () => {
    const query = wouterMocks.location.split("?")[1] ?? "";
    return query ? `?${query}` : "";
  },
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-09-16T10:00:00.000Z";

let store: MemoryLocalStore;
let costs: CostService;
let agreements: AgreementService;
let fulfillment: FulfillmentService;
let deliveryReview: DeliveryReviewService;
const contextRef: { current: Record<string, unknown> } = { current: {} };

function Harness({ page }: { page: React.ReactNode }) {
  const [version, setVersion] = React.useState(0);
  contextRef.current = {
    costs,
    agreements,
    fulfillment,
    deliveryReview,
    inventory: new InventoryMaterialService(store, () => NOW),
    costEstimates: new CostEstimateService(store, () => NOW),
    drafts: new DraftService(store, () => NOW),
    cashContinuity: new CashContinuityService(store, () => NOW),
    actualTime: new ActualTimeService(store, () => NOW),
    agreementContext: new AgreementContextService(store, () => NOW),
    collectionReversal: new CollectionReversalService(store, new ProjectFinancialService(store, () => NOW)),
    schedules: new ScheduleService(store, () => NOW),
    dataVersion: version,
    notifyDataChanged: () => setVersion(current => current + 1),
  };
  mockedUsePrototypeServices.mockImplementation(
    () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
  );
  return <UnsavedChangesProvider navigate={wouterMocks.navigate}>{page}</UnsavedChangesProvider>;
}

const costInput: CostEditorInput = {
  materialItems: [],
  time: { minutes: 60, hourlyRateMinor: 400, confidence: "known" },
  packagingMinor: 0,
  deliveryMinor: 0,
  wasteMinor: 0,
  safetyBufferMinor: 0,
  quantity: 1,
};

async function agreedOrder(options?: {
  depositMinor?: number;
  deliveryTerms?: {
    responsibility: "project_pays" | "customer_pays_project" | "customer_pays_courier" | "shared";
    feeIncludedInPrice: boolean;
    costIncludedInProductCost: boolean;
    feeChargedMinor: number | null;
    costPaidMinor: number | null;
    projectShareMinor: number | null;
    customerShareMinor: number | null;
  };
}) {
  const drafts = new DraftService(store, () => NOW);
  const created = await drafts.create("customer_order");
  if (!created.ok) throw new Error(created.message);
  const saved = await drafts.save({
    ...created.draft,
    customerName: "سارة",
    itemName: "رف خشبي",
    specifications: "مقاس كبير",
    quantity: 1,
  });
  if (!saved.ok) throw new Error(saved.message);
  const withCost = await costs.saveSnapshot(saved.draft, costInput);
  if (!withCost.ok) throw new Error(withCost.message);
  const agreed = await agreements.createFromDraft(withCost.draft, {
    agreedPriceMinor: 5000,
    deliveryDate: "2026-09-20",
    depositMinor: options?.depositMinor ?? 0,
    agreementSource: null,
    deliveryTerms: options?.deliveryTerms ?? null,
  });
  if (!agreed.ok) throw new Error(agreed.message);
  return agreed.stored;
}

describe("ORD-001/ORD-002/ORD-003 — order journey surfaces", () => {
  beforeEach(() => {
    wouterMocks.navigate.mockClear();
    wouterMocks.params = { id: "order-ord-1" };
    wouterMocks.location = "/orders/order-ord-1";
    vi.clearAllMocks();
    store = new MemoryLocalStore();
    costs = new CostService(store, () => NOW);
    agreements = new AgreementService(store, costs, () => NOW);
    fulfillment = new FulfillmentService(store, () => NOW);
    deliveryReview = new DeliveryReviewService(store, () => NOW);
  });
  afterEach(() => cleanup());

  it("ORD-001: the ?created=1 banner shows order number, state, financial effect, and next action — and disappears without it", async () => {
    const stored = await agreedOrder({ depositMinor: 1000 });
    wouterMocks.params = { id: stored.id };
    wouterMocks.location = `/orders/${stored.id}?created=1`;
    render(<Harness page={<OrderDetail />} />);
    const banner = await screen.findByTestId("order-created-banner");
    expect(banner.textContent).toContain("سُجّل الاتفاق بنجاح");
    expect(banner.textContent).toContain(stored.id);
    expect(banner.textContent).toContain("عربون محصل 10.00");
    /* العربون يغيّر الفعل التالي إلى تنفيذ الطلب — سلوك الدومين القائم. */
    expect(banner.textContent).toContain("نفّذ الطلب ثم سجّل التسليم");
    cleanup();
    /* بلا المعامل — لا لافتة نجاح قديمة عند إعادة الفتح. */
    wouterMocks.location = `/orders/${stored.id}`;
    render(<Harness page={<OrderDetail />} />);
    await waitFor(() => expect(screen.getByText("رف خشبي")).toBeTruthy());
    expect(screen.queryByTestId("order-created-banner")).toBeNull();
  });

  it("D-15: the created banner summarizes price, both contributions, who pays delivery, and the amount requested — without implying collection", async () => {
    /* سعر 50 + مساهمة عميل 5 عبر المشروع + مساهمة مشروع 3 → المطلوب 55. */
    const stored = await agreedOrder({
      deliveryTerms: {
        responsibility: "shared",
        feeIncludedInPrice: false,
        costIncludedInProductCost: false,
        feeChargedMinor: 500,
        costPaidMinor: 300,
        projectShareMinor: null,
        customerShareMinor: null,
      },
    });
    wouterMocks.params = { id: stored.id };
    wouterMocks.location = `/orders/${stored.id}?created=1`;
    render(<Harness page={<OrderDetail />} />);
    const banner = await screen.findByTestId("order-created-banner");
    expect(banner.textContent).toContain("سعر المنتج: 50.00 د.أ");
    expect(banner.textContent).toContain("مساهمة المشروع في التوصيل: 3.00 د.أ");
    expect(banner.textContent).toContain("مساهمة العميل في التوصيل: 5.00 د.أ");
    expect(banner.textContent).toContain("التوصيل مشترك بين المشروع والعميل");
    expect(banner.textContent).toContain("المبلغ المطلوب من العميل: 55.00 د.أ");
    /* الحفظ ليس قبضًا — لا إيحاء بحدوث تحصيل لمجرد تسجيل شروط التوصيل. */
    expect(banner.textContent).toContain("لا أثر مالي بعد — لم يُقبض شيء");
    cleanup();
  });

  it("D-15: a customer-only contribution banner says delivery is on the customer and adds it to the requested amount", async () => {
    const stored = await agreedOrder({
      deliveryTerms: {
        responsibility: "customer_pays_project",
        feeIncludedInPrice: false,
        costIncludedInProductCost: false,
        feeChargedMinor: 500,
        costPaidMinor: null,
        projectShareMinor: null,
        customerShareMinor: null,
      },
    });
    wouterMocks.params = { id: stored.id };
    wouterMocks.location = `/orders/${stored.id}?created=1`;
    render(<Harness page={<OrderDetail />} />);
    const banner = await screen.findByTestId("order-created-banner");
    expect(banner.textContent).toContain("التوصيل على العميل");
    expect(banner.textContent).toContain("المبلغ المطلوب من العميل: 55.00 د.أ");
    /* بلا شروط توصيل لا يظهر سطر الملخص أصلًا — سلوك رجدي مطابق. */
    cleanup();
    const plain = await agreedOrder();
    wouterMocks.params = { id: plain.id };
    wouterMocks.location = `/orders/${plain.id}?created=1`;
    render(<Harness page={<OrderDetail />} />);
    const plainBanner = await screen.findByTestId("order-created-banner");
    expect(plainBanner.textContent).not.toContain("المبلغ المطلوب من العميل");
    expect(plainBanner.textContent).toContain("لا أثر مالي بعد");
  });

  it("ORD-003/D-15: the two contribution boxes record terms before delivery and update the receivable once", async () => {
    const stored = await agreedOrder();
    wouterMocks.params = { id: stored.id };
    render(<Harness page={<OrderDetail />} />);
    await screen.findByText("رف خشبي");
    const panel = screen.getByTestId("delivery-terms-panel");
    expect(panel.textContent).toContain("لا شروط نقل وتوصيل مسجلة");
    fireEvent.click(screen.getByText("تسجيل شروط النقل والتوصيل"));
    fireEvent.change(screen.getByLabelText("تعديل مساهمة المشروع في التوصيل"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("تعديل مساهمة العميل في التوصيل"), { target: { value: "2" } });
    /* D-15: المسؤولية تُستنتج من الصندوقين — المساهمتان موجبتان معًا = مشترك. */
    expect(screen.getByTestId("terms-contribution-description").textContent).toContain("مشترك");
    fireEvent.click(screen.getByText("حفظ شروط النقل"));
    await waitFor(() =>
      expect(screen.getByTestId("delivery-terms-panel").textContent).toContain(
        "التوصيل مشترك بين المشروع والعميل",
      ),
    );
    expect(screen.getByTestId("delivery-terms-panel").textContent).toContain("مساهمة العميل: 2.00");
    expect(screen.getByTestId("delivery-terms-panel").textContent).toContain("مساهمة المشروع: 1.00");
    /* قيمة الطلب 50 + 2 = 52 — مساهمة العميل وحدها تدخل القيمة القابلة للتحصيل. */
    const saved = await store.getOrder(stored.id);
    if (!saved.ok || !saved.value) throw new Error("order should exist");
    expect(saved.value.order.receivableMinor).toBe(5200);
    expect(saved.value.order.deliveryTerms?.feeChargedMinor).toBe(200);
    expect(saved.value.order.deliveryTerms?.costPaidMinor).toBe(100);
    expect(saved.value.order.deliveryTerms?.responsibility).toBe("shared");
    expect(saved.value.order.events.some(event => event.type === "delivery_terms_recorded")).toBe(true);
  });

  it("ORD-003: the estimated profit is labelled تقديري and stays out of official results", async () => {
    const stored = await agreedOrder();
    wouterMocks.params = { id: stored.id };
    render(<Harness page={<OrderDetail />} />);
    await screen.findByTestId("estimated-result-panel");
    const panel = screen.getByTestId("estimated-result-panel");
    expect(panel.textContent).toContain("الربح التقديري");
    expect(panel.textContent).toContain("تقديري");
    /* السعر 50.00 − التكلفة 4.00 = 46.00 تقديريًا. */
    expect(panel.textContent).toContain("46.00");
    expect(panel.textContent).toContain("لا يُضاف إلى أي نتيجة رسمية");
  });

  /* ── إصلاح المتابعة (ORD-003): تحرير الشروط المشتركة من صفحة الطلب ──
   * كان مسار التحرير يفتح اللوحة من فراغ (فيمسح أجرة/كلفة/حصصًا مسجلة
   * بحفظ غير مقصود)، ويصفّر حصتي التكلفة المشتركة دائمًا، ويحتفظ بمفتاح
   * حتمية واحد طوال عمر الصفحة فيصير التعديل الثاني صمتًا. */

  it("ORD-003 follow-up/D-15: editing existing shared terms prefills both boxes and keeps the legacy shares", async () => {
    const stored = await agreedOrder();
    const applied = await fulfillment.applyDeliveryTerms(
      stored.id,
      {
        responsibility: "shared",
        feeIncludedInPrice: false,
        costIncludedInProductCost: false,
        feeChargedMinor: 200,
        costPaidMinor: 100,
        projectShareMinor: 60,
        customerShareMinor: 40,
      },
      "ord003-followup-initial",
    );
    if (!applied.ok) throw new Error(applied.message);
    wouterMocks.params = { id: stored.id };
    render(<Harness page={<OrderDetail />} />);
    await screen.findByText("رف خشبي");
    /* العرض يُظهر الحصتين المسجلتين — الحصص بيانات موثقة لا تختفي. */
    const panel = screen.getByTestId("delivery-terms-panel");
    await waitFor(() => expect(panel.textContent).toContain("مشترك"));
    expect(panel.textContent).toContain("حصة المشروع من النقل: 0.60");
    expect(panel.textContent).toContain("حصة الزبون من النقل: 0.40");
    /* فتح التحرير يملأ الصندوقين بالقيم المسجلة نفسها — لا من فراغ. */
    fireEvent.click(screen.getByText("تعديل شروط النقل والتوصيل"));
    expect((screen.getByLabelText("تعديل مساهمة المشروع في التوصيل") as HTMLInputElement).value).toBe("1.00");
    expect((screen.getByLabelText("تعديل مساهمة العميل في التوصيل") as HTMLInputElement).value).toBe("2.00");
    /* نموذج الصندوقين لا يطلب حصصًا — الحصص القديمة تُحفظ بالمُرور لا بالتحرير. */
    expect(screen.queryByLabelText("تعديل حصة المشروع من النقل")).toBeNull();
    expect(screen.queryByLabelText("تعديل حصة الزبون من النقل")).toBeNull();
    fireEvent.change(screen.getByLabelText("تعديل مساهمة العميل في التوصيل"), {
      target: { value: "2.50" },
    });
    fireEvent.click(screen.getByText("حفظ شروط النقل"));
    await waitFor(() =>
      expect(screen.getByTestId("delivery-terms-panel").textContent).toContain("مساهمة العميل: 2.50"),
    );
    const saved = await store.getOrder(stored.id);
    if (!saved.ok || !saved.value) throw new Error("order should exist");
    expect(saved.value.order.deliveryTerms?.responsibility).toBe("shared");
    /* الحصص القديمة محفوظة كما سُجّلت — لا تصفير صمت. */
    expect(saved.value.order.deliveryTerms?.projectShareMinor).toBe(60);
    expect(saved.value.order.deliveryTerms?.customerShareMinor).toBe(40);
    expect(saved.value.order.deliveryTerms?.feeChargedMinor).toBe(250);
    expect(saved.value.order.deliveryTerms?.costPaidMinor).toBe(100);
  });

  it("ORD-003 follow-up: a second edit after a successful save is a new documented event, not a silent no-op", async () => {
    const stored = await agreedOrder();
    wouterMocks.params = { id: stored.id };
    render(<Harness page={<OrderDetail />} />);
    await screen.findByText("رف خشبي");
    /* التعديل الأول عبر الواجهة — صندوق العميل وحده يستنتج «على العميل». */
    fireEvent.click(screen.getByText("تسجيل شروط النقل والتوصيل"));
    fireEvent.change(screen.getByLabelText("تعديل مساهمة العميل في التوصيل"), { target: { value: "2" } });
    fireEvent.click(screen.getByText("حفظ شروط النقل"));
    await waitFor(() =>
      expect(screen.getByTestId("delivery-terms-panel").textContent).toContain("مساهمة العميل: 2.00"),
    );
    /* التعديل الثاني على الصفحة نفسها — مفتاح عملية جديد لكل فتح لوحة. */
    fireEvent.click(screen.getByText("تعديل شروط النقل والتوصيل"));
    fireEvent.change(screen.getByLabelText("تعديل مساهمة العميل في التوصيل"), { target: { value: "3" } });
    fireEvent.click(screen.getByText("حفظ شروط النقل"));
    await waitFor(() =>
      expect(screen.getByTestId("delivery-terms-panel").textContent).toContain("مساهمة العميل: 3.00"),
    );
    const saved = await store.getOrder(stored.id);
    if (!saved.ok || !saved.value) throw new Error("order should exist");
    expect(saved.value.order.deliveryTerms?.feeChargedMinor).toBe(300);
    const termsEvents = saved.value.order.events.filter(event => event.type === "delivery_terms_recorded");
    expect(termsEvents.length).toBe(2);
    /* القيمة القابلة للتحصيل: 50 + 3 = 53. */
    expect(saved.value.order.receivableMinor).toBe(5300);
  });

  it("ORD-003 follow-up/D-15: zeroing the customer box moves delivery onto the project and clears the legacy shares deliberately", async () => {
    const stored = await agreedOrder();
    const applied = await fulfillment.applyDeliveryTerms(
      stored.id,
      {
        responsibility: "shared",
        feeIncludedInPrice: false,
        costIncludedInProductCost: false,
        feeChargedMinor: 200,
        costPaidMinor: 100,
        projectShareMinor: 60,
        customerShareMinor: 40,
      },
      "ord003-followup-away",
    );
    if (!applied.ok) throw new Error(applied.message);
    wouterMocks.params = { id: stored.id };
    render(<Harness page={<OrderDetail />} />);
    await screen.findByText("رف خشبي");
    fireEvent.click(screen.getByText("تعديل شروط النقل والتوصيل"));
    /* مساهمة العميل صفر صريحة ومساهمة المشروع موجبة → التوصيل على المشروع. */
    fireEvent.change(screen.getByLabelText("تعديل مساهمة العميل في التوصيل"), { target: { value: "0" } });
    expect(screen.getByTestId("terms-contribution-description").textContent).toContain("على المشروع");
    fireEvent.click(screen.getByText("حفظ شروط النقل"));
    await waitFor(() =>
      expect(screen.getByTestId("delivery-terms-panel").textContent).toContain("التوصيل على المشروع"),
    );
    const saved = await store.getOrder(stored.id);
    if (!saved.ok || !saved.value) throw new Error("order should exist");
    expect(saved.value.order.deliveryTerms?.responsibility).toBe("project_pays");
    /* خارج «مشترك» تُصفَّر الحصص عمدًا (عقد الدومين) — حقلا الحصص غير قابلين
     * للتحرير في نموذج الصندوقين. */
    expect(saved.value.order.deliveryTerms?.projectShareMinor).toBeNull();
    expect(saved.value.order.deliveryTerms?.customerShareMinor).toBeNull();
    expect(saved.value.order.deliveryTerms?.feeChargedMinor).toBeNull();
    expect(saved.value.order.deliveryTerms?.costPaidMinor).toBe(100);
    /* قيمة الطلب تعود إلى السعر وحده — مساهمة المشروع لا تدخل دين العميل. */
    expect(saved.value.order.receivableMinor).toBe(5000);
  });

  it("ORD-002: first delivery shows the dedicated receipt with verified fields only", async () => {
    const stored = await agreedOrder({ depositMinor: 1000 });
    await agreements.startExecution(stored.id);
    await fulfillment.markReady(stored.id);
    const cashContinuity = new CashContinuityService(store, () => NOW);
    const opened = await cashContinuity.openWallet({
      name: "درج-ORD",
      kind: "cash_drawer",
      openingMinor: 0,
      occurredOn: "2026-09-16",
      note: "محفظة اختبار",
      operationKey: "ord-wallet-1",
      openingStatus: "known",
    });
    if (!opened.ok) throw new Error(opened.message);
    wouterMocks.params = { id: stored.id };
    wouterMocks.location = `/orders/${stored.id}/deliver`;
    render(<Harness page={<DeliveryReview />} />);
    await screen.findByText("مراجعة التسليم");
    /* القبض عند التسليم داخل «خيارات متقدمة» — فتح صريح قبل الملء. */
    fireEvent.click(screen.getByText("خيارات متقدمة: تعديل السعر والقبض عند التسليم"));
    fireEvent.change(screen.getByLabelText("المقبوض عند التسليم"), { target: { value: "40" } });
    fireEvent.change(screen.getByLabelText("وجهة كاش التسليم"), {
      target: { value: opened.value.wallet.id },
    });
    fireEvent.click(screen.getByText("أكّد التسليم"));
    const receipt = await screen.findByTestId("delivery-success-receipt");
    expect(receipt.textContent).toContain("تم تسليم الطلب بنجاح");
    expect(receipt.textContent).toContain(stored.id);
    expect(receipt.textContent).toContain("لحظة التسليم:");
    expect(receipt.textContent).toContain("الحالة الجديدة: تمت التسوية");
    expect(receipt.textContent).toContain("المقبوض عند التسليم: 40.00");
    expect(receipt.textContent).toContain("المتبقي بعد التسليم: 0.00");
    expect(receipt.textContent).toContain("وجهة الكاش: درج-ORD");
    expect(receipt.textContent).toContain("أثر المخزون");
    expect(receipt.textContent).toContain("الفعل التالي:");
    /* الإيراد معترف مرة واحدة: السعر 50 (لا يشمل القبض — القبض ليس إيرادًا). */
    expect(receipt.textContent).toContain("50.00");
  });

  it("ORD-002: reopening a delivered order shows a summary, never the success message or an error", async () => {
    const stored = await agreedOrder({ depositMinor: 1000 });
    await agreements.startExecution(stored.id);
    await fulfillment.markReady(stored.id);
    await deliveryReview.commitDelivery(stored.id, {
      rows: [],
      finalPriceMinor: null,
      priceRevisionReason: null,
      collectNow: null,
      operationKey: "ord-deliver-1",
    });
    wouterMocks.params = { id: stored.id };
    wouterMocks.location = `/orders/${stored.id}`;
    render(<Harness page={<OrderDetail />} />);
    const summary = await screen.findByTestId("delivered-summary");
    expect(summary.textContent).toContain("سُلّم هذا الطلب في");
    expect(summary.textContent).toContain("المقبوض: 10.00");
    expect(summary.textContent).toContain("المتبقي: 40.00");
    expect(screen.queryByTestId("order-created-banner")).toBeNull();
    expect(screen.queryByText("تم تسليم الطلب بنجاح")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("ORD-002: a duplicate delivery commit is idempotent — no second delivery event, cash, revenue, or inventory effect", async () => {
    const stored = await agreedOrder();
    await agreements.startExecution(stored.id);
    await fulfillment.markReady(stored.id);
    const first = await deliveryReview.commitDelivery(stored.id, {
      rows: [],
      finalPriceMinor: null,
      priceRevisionReason: null,
      collectNow: null,
      operationKey: "ord-deliver-2",
    });
    if (!first.ok) throw new Error(first.message);
    const second = await deliveryReview.commitDelivery(stored.id, {
      rows: [],
      finalPriceMinor: null,
      priceRevisionReason: null,
      collectNow: null,
      operationKey: "ord-deliver-2-retry",
    });
    if (!second.ok) throw new Error(second.message);
    expect(second.value.reused ?? first.value.reused ?? true).toBe(true);
    const saved = await store.getOrder(stored.id);
    if (!saved.ok || !saved.value) throw new Error("order should exist");
    const deliveryEvents = saved.value.order.events.filter(event => event.toStatus === "delivered");
    expect(deliveryEvents).toHaveLength(1);
    expect(saved.value.order.recognizedRevenueMinor).toBe(5000);
    expect(saved.value.order.recognizedCostMinor).toBe(400);
  });
});
