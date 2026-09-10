/** @vitest-environment jsdom */

/* التحصين الكامل (المجموعة ٣): اختبارات الرحلات الحرجة عبر الحدود الحقيقية —
 * تفاعل المستخدم ← خدمة التطبيق ← مخزن الذاكرة بذاته (الحرّاس نفسها). تغطي:
 * (١) رحلة استرجاع storage_stale المطبوعة لمسار دفعة المورد ومسار موعد
 * التوقيت: لا كتابة فوق الأحدث، قيم المستخدم باقية، إعادة قراءة صريحة، ثم
 * حفظ ثانٍ واعٍ — لا تكرار أعمى للحمولة القديمة.
 * (٢) الفشل التخزيني الحقيقي خطأ ظاهر (role=alert) لا نجاحًا مزيفًا.
 * (٣) النقر المتكرر السريع لا يكرر الأثر (زر مشغول + حتمية).
 * (٤) رحلة D-031: السجل المسلّم المقفل — القراءة باقية، لا تراجعًا عامًا عن
 * القبضة، والمخرج الموثق الوحيد «تراجع موثق عن التسليم» يعمل ويثبت حالته
 * في المخزن، والنتيجة مطابقة لمصطلح D-035.
 * تُبنى التعارضات حتميًا: مسار آخر يكتب بين قراءة الصفحة والتزامها — النافذة
 * نفسها التي يحميها حارس علاقة الأحداث داخل المعاملة. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { STALE_CONFLICT_NOTE, STALE_RELOAD_ACTION_LABEL, STALE_RELOADED_NOTE } from "@/app/resultFeedback";
import { CostEstimateService } from "@/application/estimates/costEstimateService";
import { DraftService } from "@/application/drafts/draftService";
import { CatalogService } from "@/application/catalog/catalogService";
import { RecurringWorkService } from "@/application/recurring-work/recurringWorkService";
import { DirectSaleService } from "@/application/direct-sales/directSaleService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { CostService } from "@/application/cost/costService";
import { AgreementService } from "@/application/agreements/agreementService";
import { AgreementContextService } from "@/application/agreements/agreementContextService";
import { FulfillmentService } from "@/application/fulfillment/fulfillmentService";
import { DeliveryReviewService } from "@/application/fulfillment/deliveryReviewService";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { ActualTimeService } from "@/application/time/actualTimeService";
import { ScheduleService } from "@/application/scheduling/scheduleService";
import { SupplierPurchaseService } from "@/application/suppliers/supplierPurchaseService";
import { PartyLedgerService } from "@/application/parties/partyLedgerService";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { FormDraftService } from "@/application/drafts/formDraftService";
import SupplierPurchaseEditor from "@/pages/SupplierPurchaseEditor";
import ScheduleEditor from "@/pages/ScheduleEditor";
import OrderDetail from "@/pages/OrderDetail";
import type { ScheduleEntry } from "@/storage/local/types";
import {
  calculateCostSnapshot,
  collectRemaining,
  createCraftOrder,
  transitionOrder,
} from "@micro-domain/craft-order/index.js";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/suppliers",
  params: {} as Record<string, string>,
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
const NOW = "2026-09-11T09:00:00.000Z";

let store: InterposingStore;
const contextRef: { current: Record<string, unknown> } = { current: {} };

/** محوّل يقحم كتابة مسار آخر بين قراءة الصفحة والتزامها — النافذة العرقية
 * نفسها، بلا سباقات زمنية ولا مصادف. */
class InterposingStore extends MemoryLocalStore {
  public interposeSupplierCommit: (() => Promise<void>) | null = null;
  public interposeScheduleCommit: (() => Promise<void>) | null = null;
  public supplierCommitCount = 0;
  override async commitSupplierPurchase(commit: Parameters<MemoryLocalStore["commitSupplierPurchase"]>[0]) {
    this.supplierCommitCount += 1;
    if (this.interposeSupplierCommit) {
      const hook = this.interposeSupplierCommit;
      this.interposeSupplierCommit = null;
      await hook();
    }
    return super.commitSupplierPurchase(commit);
  }
  override async commitScheduleUpdate(schedule: ScheduleEntry) {
    if (this.interposeScheduleCommit) {
      const hook = this.interposeScheduleCommit;
      this.interposeScheduleCommit = null;
      await hook();
    }
    return super.commitScheduleUpdate(schedule);
  }
}

/** فشل تخزيني حقيقي عند الالتزام — يميّز storage_error من تعارض storage_stale. */
class GenuineFailureStore extends InterposingStore {
  public failedCommit = false;
  override async commitSupplierPurchase(commit: Parameters<MemoryLocalStore["commitSupplierPurchase"]>[0]) {
    /* الإنشاء الأولي ينجح؛ فشل تخزيني حقيقي عند التزام التعديل فقط. */
    if (commit.kind === "revision") {
      this.failedCommit = true;
      return {
        ok: false as const,
        code: "storage_error" as const,
        message: "فشل تخزيني حقيقي مفبرك للاختبار.",
      };
    }
    return super.commitSupplierPurchase(commit);
  }
}

function Harness({ page }: { page: React.ReactNode }) {
  const [version, setVersion] = React.useState(0);
  contextRef.current = {
    formDrafts: new FormDraftService(store),
    costEstimates: new CostEstimateService(store, () => NOW),
    drafts: new DraftService(store, () => NOW),
    catalog: new CatalogService(store, () => NOW),
    costs: new CostService(store, () => NOW),
    agreements: new AgreementService(store, new CostService(store, () => NOW), () => NOW),
    fulfillment: new FulfillmentService(store, () => NOW),
    deliveryReview: new DeliveryReviewService(store, () => NOW),
    recurringWork: new RecurringWorkService(store, () => NOW),
    directSales: new DirectSaleService(store, () => NOW),
    projectFinance: new ProjectFinancialService(store, () => NOW),
    cashContinuity: new CashContinuityService(store, () => NOW),
    agreementContext: new AgreementContextService(store, () => NOW),
    inventory: new InventoryMaterialService(store, () => NOW),
    actualTime: new ActualTimeService(store, () => NOW),
    schedules: new ScheduleService(store, () => NOW),
    supplierPurchases: new SupplierPurchaseService(store, () => NOW),
    partyLedger: new PartyLedgerService(store),
    dataVersion: version,
    notifyDataChanged: () => setVersion(current => current + 1),
  };
  return <UnsavedChangesProvider navigate={wouterMocks.navigate}>{page}</UnsavedChangesProvider>;
}

const purchaseInput = (idempotencyKey: string) => ({
  supplierName: "مؤسسة النسيج",
  note: "شراء قماش",
  purchasedOn: "2026-09-10",
  dueOn: null,
  totalMinor: 10000,
  initialPaidMinor: 2000,
  idempotencyKey,
  materialId: null,
  expectedQuantityMilli: null,
});

async function saveScheduleOrder(store: InterposingStore, id: string, deliveryDate: string) {
  const cost = calculateCostSnapshot(`${id}-cost`, {
    currency: "JOD",
    materialItems: [],
    time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
    packagingMinor: 0,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 1,
    createdAt: "2026-09-01T00:00:00.000Z",
    freshnessDays: null,
    source: "price_approval",
  });
  const order = createCraftOrder({
    id,
    customerName: "سارة",
    itemName: `طلب ${id}`,
    specifications: "اختبار",
    quantity: 1,
    agreedPriceMinor: 2000,
    costSnapshot: cost,
    createdAt: "2026-09-01T00:00:00.000Z",
  });
  await store.saveOrder({
    id,
    order: { ...order, status: "in_progress", nextAction: "أكمل التنفيذ" },
    deliveryDate,
    catalogItemId: null,
    agreementSource: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  });
}

async function scheduleIdFor(store: InterposingStore, orderId: string): Promise<string> {
  const schedules = await store.listSchedules();
  if (!schedules.ok) throw new Error(schedules.message);
  const found = schedules.value.find(schedule => schedule.orderId === orderId);
  if (!found) throw new Error("schedule missing");
  return found.id;
}

/** سجل مسلّم مقفل: قبضة جزئية ثم «يحتاج مراجعة» — عبر النطاق نفسه لا حقن حالات. */
async function saveLockedDeliveredOrder(store: InterposingStore, id: string) {
  const cost = calculateCostSnapshot(`${id}-cost`, {
    currency: "JOD",
    materialItems: [
      {
        name: "خشب",
        quantity: 2,
        unit: "قطعة",
        unitPriceMinor: 500,
        priceDate: "2026-09-01",
        source: "user_input",
        confidence: "known",
      },
    ],
    time: { minutes: 60, hourlyRateMinor: 600, confidence: "known" },
    packagingMinor: 100,
    deliveryMinor: 100,
    wasteMinor: 50,
    safetyBufferMinor: 250,
    quantity: 1,
    createdAt: "2026-09-01T09:00:00.000Z",
    source: "price_approval",
  });
  let order = createCraftOrder({
    id,
    customerName: "ليلى",
    itemName: "رف خشبي",
    specifications: "مقاس متوسط",
    quantity: 1,
    agreedPriceMinor: 8000,
    costSnapshot: cost,
    createdAt: "2026-09-01T09:05:00.000Z",
  });
  const chain: ReadonlyArray<
    ["provisional_agreement" | "confirmed" | "in_progress" | "ready" | "delivered", string]
  > = [
    ["provisional_agreement", "lock-provisional"],
    ["confirmed", "lock-confirmed"],
    ["in_progress", "lock-progress"],
    ["ready", "lock-ready"],
    ["delivered", "lock-delivered"],
  ];
  for (const [to, key] of chain) {
    order = transitionOrder(order, {
      to,
      idempotencyKey: key,
      createdAt: `2026-09-02T09:1${chain.findIndex(item => item[1] === key)}:00Z`,
    });
  }
  order = collectRemaining(order, 2500, "lock-collect", "2026-09-03T10:00:00.000Z");
  order = transitionOrder(order, {
    to: "needs_review",
    idempotencyKey: "lock-review",
    createdAt: "2026-09-03T11:00:00.000Z",
  });
  await store.saveOrder({
    id,
    order,
    deliveryDate: "2026-09-03",
    catalogItemId: null,
    agreementSource: null,
    createdAt: "2026-09-01T09:05:00.000Z",
    updatedAt: "2026-09-03T11:00:00.000Z",
  });
}

describe("G3 hardening — storage_stale recovery journeys (typed codes, real store)", () => {
  beforeEach(() => {
    store = new InterposingStore();
    wouterMocks.location = "/suppliers";
    wouterMocks.params = {};
    wouterMocks.navigate.mockReset();
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("supplier payment: stale conflict refuses the write, keeps user input, reloads explicitly, second save is deliberate", async () => {
    const setup = new SupplierPurchaseService(store, () => NOW);
    const created = await setup.recordPurchase(purchaseInput("stale-purchase"));
    if (!created.ok) throw new Error(created.message);
    const purchaseId = created.value.id;

    /* مسار آخر يدفع 30.00 بين قراءة الصفحة والتزامها — القبضة الأحدث لا تُداس. */
    store.interposeSupplierCommit = async () => {
      const otherPath = new SupplierPurchaseService(store, () => NOW);
      const concurrent = await otherPath.recordPayment({
        purchaseId,
        amountMinor: 3000,
        occurredOn: "2026-09-10",
        note: "دفعة مسار آخر",
        idempotencyKey: "concurrent-payment-key",
      });
      if (!concurrent.ok) throw new Error(concurrent.message);
    };

    wouterMocks.location = `/suppliers/purchase/${purchaseId}/payment`;
    wouterMocks.params = { id: purchaseId };
    mockedUsePrototypeServices.mockImplementation(
      () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
    );
    render(<Harness page={<SupplierPurchaseEditor />} />);
    await screen.findByRole("heading", { name: `دفعة إلى مؤسسة النسيج` });

    fireEvent.change(screen.getByLabelText("مبلغ دفعة المورد"), { target: { value: "10.00" } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ الدفعة" }));

    /* ١) التعارض يصل مُطبوعًا: بطاقة التعارض بالكود لا بتفسير نص. */
    const conflictCard = await screen.findByTestId("stale-conflict-card");
    expect(conflictCard).toBeTruthy();
    expect(conflictCard.textContent).toContain(STALE_CONFLICT_NOTE);
    /* ٢) مدخل المستخدم لم يُهدر بصمت — القيمة باقية في الحقل. */
    expect((screen.getByLabelText("مبلغ دفعة المورد") as HTMLInputElement).value).toBe("10.00");
    /* ٣) لا كتابة فوق الأحدث: المسار الآخر فقط في المخزن (٢٠٠٠ أولي + ٣٠٠٠). */
    const afterStale = await new SupplierPurchaseService(store, () => NOW).list();
    if (!afterStale.ok) throw new Error(afterStale.message);
    const after = afterStale.value.find(item => item.id === purchaseId)!;
    expect(after.payments.filter(p => p.id !== `${purchaseId}:initial`)).toHaveLength(1);
    expect(after.paidMinor).toBe(5000);
    /* ٤) لا إعادة إرسال تلقائية: لم يعد التنقل (الحفظ لم ينجح). */
    expect(wouterMocks.navigate).not.toHaveBeenCalled();

    /* ٥) إعادة القراءة الصريحة عبر مسار القراءة المعتمد نفسه. */
    fireEvent.click(screen.getByRole("button", { name: STALE_RELOAD_ACTION_LABEL }));
    await waitFor(() => expect(screen.queryByTestId("stale-conflict-card")).toBeNull());
    expect(screen.getByText(STALE_RELOADED_NOTE)).toBeTruthy();
    /* بطاقة الحقيقة الآن تعكس الحالة الأحدث (٥٠.٠٠ مدفوع). */
    expect(screen.getByText(/50\.00/)).toBeTruthy();

    /* ٦) الحفظ الثاني قرار واعٍ فوق الحالة الجديدة — يدخل مرة واحدة. */
    fireEvent.click(screen.getByRole("button", { name: "حفظ الدفعة" }));
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalled());
    const final = await new SupplierPurchaseService(store, () => NOW).list();
    if (!final.ok) throw new Error(final.message);
    const finalPurchase = final.value.find(item => item.id === purchaseId)!;
    const laterPayments = finalPurchase.payments.filter(p => p.id !== `${purchaseId}:initial`);
    expect(laterPayments).toHaveLength(2);
    expect(laterPayments.map(p => p.amountMinor).sort((a, b) => a - b)).toEqual([1000, 3000]);
    expect(finalPurchase.paidMinor).toBe(6000);
  });

  it("schedule timing: stale conflict preserves the user's timing, reloads the current record, deliberate second save lands once", async () => {
    await saveScheduleOrder(store, "order-sched", "2026-09-14");
    /* القراءة عبر الخدمة تبني جدول المواعيد من تاريخ التسليم (backfill) كما في الإنتاج. */
    const warmup = await new ScheduleService(store, () => NOW).overview();
    if (!warmup.ok) throw new Error(warmup.message);
    const scheduleId = await scheduleIdFor(store, "order-sched");

    store.interposeScheduleCommit = async () => {
      const otherPath = new ScheduleService(store, () => NOW);
      const concurrent = await otherPath.postpone(scheduleId, "2026-09-15", "سبب المسار الآخر");
      if (!concurrent.ok) throw new Error(concurrent.message);
    };

    wouterMocks.location = `/schedule/${scheduleId}`;
    wouterMocks.params = { id: scheduleId };
    mockedUsePrototypeServices.mockImplementation(
      () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
    );
    render(<Harness page={<ScheduleEditor />} />);
    await screen.findByRole("heading", { name: "وقت ومدة الموعد" });

    fireEvent.change(screen.getByLabelText(/يوم الموعد/), { target: { value: "2026-09-16" } });
    fireEvent.change(screen.getByLabelText(/سبب التعديل/), { target: { value: "تغيير موعد الزبون" } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ الموعد" }));

    /* التعارض المطبوع: بطاقة + إبقاء قيم المستخدم + لا نجاح كاذب. */
    const conflictCard = await screen.findByTestId("stale-conflict-card");
    expect(conflictCard.textContent).toContain(STALE_CONFLICT_NOTE);
    expect((screen.getByLabelText(/يوم الموعد/) as HTMLInputElement).value).toBe("2026-09-16");
    expect(screen.queryByText(/تم حفظ/)).toBeNull();
    /* المخزن يحمل تأجيل المسار الآخر فقط. */
    const storedNow = await store.listSchedules();
    if (!storedNow.ok) throw new Error(storedNow.message);
    const storedSchedule = storedNow.value.find(s => s.id === scheduleId)!;
    expect(storedSchedule.scheduledFor).toBe("2026-09-15");
    expect(storedSchedule.events.filter(e => e.type === "postponed")).toHaveLength(1);

    /* إعادة القراءة الصريحة ثم الحفظ الواعي الثاني. */
    fireEvent.click(screen.getByRole("button", { name: STALE_RELOAD_ACTION_LABEL }));
    await waitFor(() => expect(screen.queryByTestId("stale-conflict-card")).toBeNull());
    expect(screen.getByText(STALE_RELOADED_NOTE)).toBeTruthy();
    expect((screen.getByLabelText(/يوم الموعد/) as HTMLInputElement).value).toBe("2026-09-16");
    expect(screen.getByText(/سبب التأجيل الأخير: سبب المسار الآخر/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "حفظ الموعد" }));
    await waitFor(() => expect(screen.getByText(/تم حفظ التأجيل محليًا/)).toBeTruthy());
    const final = await store.listSchedules();
    if (!final.ok) throw new Error(final.message);
    const finalSchedule = final.value.find(s => s.id === scheduleId)!;
    expect(finalSchedule.scheduledFor).toBe("2026-09-16");
    expect(finalSchedule.events.filter(e => e.type === "postponed")).toHaveLength(2);
    expect(finalSchedule.postponeReason).toBe("تغيير موعد الزبون");
  });

  it("genuine storage failure renders as an error (role=alert), never styled as success", async () => {
    const failing = new GenuineFailureStore();
    const setup = new SupplierPurchaseService(failing, () => NOW);
    const created = await setup.recordPurchase(purchaseInput("genuine-failure"));
    if (!created.ok) throw new Error(created.message);
    const purchaseId = created.value.id;
    store = failing;

    wouterMocks.location = `/suppliers/purchase/${purchaseId}`;
    wouterMocks.params = { id: purchaseId };
    mockedUsePrototypeServices.mockImplementation(
      () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
    );
    render(<Harness page={<SupplierPurchaseEditor />} />);
    await screen.findByRole("heading", { name: "شراء من مؤسسة النسيج" });

    fireEvent.click(screen.getByRole("button", { name: "عدّل هذا الشراء" }));
    fireEvent.change(screen.getByPlaceholderText("مثال: فاتورة مصححة من المورد"), {
      target: { value: "فاتورة مصححة" },
    });
    fireEvent.click(screen.getByRole("button", { name: "أكّد تعديل الشراء" }));

    /* عيب ما قبل المجموعة ٣: الفشل كان يُعرض بمظهر النجاح — الآن خطأ واحد
     * ظاهر بصوت alert داخل معاينة التصحيح، وصفر عقد نجاح. */
    await waitFor(() => expect(failing.failedCommit).toBe(true));
    await waitFor(() => {
      expect(document.querySelectorAll(".micro-field-error").length).toBe(1);
    });
    const errorNode = document.querySelector(".micro-field-error");
    expect(errorNode?.getAttribute("role")).toBe("alert");
    expect(document.querySelectorAll(".micro-save-note").length).toBe(0);
  });

  it("rapid repeated activation creates one commit, not duplicate financial effects", async () => {
    const setup = new SupplierPurchaseService(store, () => NOW);
    const created = await setup.recordPurchase(purchaseInput("double-click"));
    if (!created.ok) throw new Error(created.message);
    const purchaseId = created.value.id;

    wouterMocks.location = `/suppliers/purchase/${purchaseId}/payment`;
    wouterMocks.params = { id: purchaseId };
    mockedUsePrototypeServices.mockImplementation(
      () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
    );
    render(<Harness page={<SupplierPurchaseEditor />} />);
    await screen.findByRole("heading", { name: `دفعة إلى مؤسسة النسيج` });

    fireEvent.change(screen.getByLabelText("مبلغ دفعة المورد"), { target: { value: "7.00" } });
    const saveButton = screen.getByRole("button", { name: "حفظ الدفعة" }) as HTMLButtonElement;
    fireEvent.click(saveButton);
    /* الزر مشغول فورًا — النقرة الثانية المتعاقبة لا تمر (تعطيل أثناء التنفيذ). */
    expect(saveButton.disabled).toBe(true);
    fireEvent.click(saveButton);

    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalled());
    /* التزامان فقط: الإنشاء في التحضير + الدفعة الواحدة — لا تكرار مالي. */
    expect(store.supplierCommitCount).toBe(2);
    const list = await new SupplierPurchaseService(store, () => NOW).list();
    if (!list.ok) throw new Error(list.message);
    const purchase = list.value.find(item => item.id === purchaseId)!;
    expect(purchase.payments.filter(p => p.id !== `${purchaseId}:initial`)).toHaveLength(1);
    expect(purchase.payments.filter(p => p.id !== `${purchaseId}:initial`)[0]!.amountMinor).toBe(700);
  });
});

describe("G3 hardening — D-031 locked delivered record: honest lock, documented correction, D-035 terminology", () => {
  beforeEach(() => {
    store = new InterposingStore();
    wouterMocks.location = "/orders";
    wouterMocks.params = {};
    wouterMocks.navigate.mockReset();
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows the lock honestly, keeps read-only access, blocks the general collection reversal, and exposes only the documented exit", async () => {
    await saveLockedDeliveredOrder(store, "order-locked");
    wouterMocks.location = "/orders/order-locked";
    wouterMocks.params = { id: "order-locked" };
    mockedUsePrototypeServices.mockImplementation(
      () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
    );
    render(<Harness page={<OrderDetail />} />);
    await screen.findByRole("heading", { name: /رف خشبي/ });

    /* القراءة والتاريخ متاحان أثناء القفل (مراجعة جنائية للسجل). */
    expect(screen.getByText(/الطلب المسلّم مقفل في «يحتاج مراجعة»/)).toBeTruthy();
    /* لا أزرار تراجع عامة عن القبضة أثناء القفل — الفعل لا يُعرض كأنه سينجح. */
    expect(screen.queryAllByRole("button", { name: /تراجع عن \d/ })).toHaveLength(0);
    /* ملخص التصحيحات لا يعد بفعل مقفل. */
    expect(screen.queryByText(/تعديل السعر · تراجع عن قبضة/)).toBeNull();
    /* المخرج الموثق الوحيد ظاهر بمصطلح D-035. */
    const exitButton = screen.getByRole("button", { name: "تراجع موثق عن التسليم" });
    expect(exitButton).toBeTruthy();

    /* D-035: لا مصطلح ممنوع على سطح التصحيح الحساس كله. */
    const bodyText = document.body.textContent ?? "";
    for (const prohibited of ["اعكس", "عكس موثق", "عكس كامل"]) {
      expect(bodyText.includes(prohibited)).toBe(false);
    }

    /* رحلة التصحيح الموثق: سبب صريح ثم معاملة واحدة. */
    fireEvent.click(exitButton);
    fireEvent.change(screen.getByPlaceholderText("مثال: سُلّم الطلب للزبون الخطأ"), {
      target: { value: "سُلّم قبل إتمام التعديل المتفق عليه" },
    });
    fireEvent.click(screen.getByRole("button", { name: "أكّد التراجع الموثق عن التسليم" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "استئناف التنفيذ بعد المراجعة" })).toBeTruthy();
    });
    /* القفل انفتح: ملاحظة القفل اختفت. */
    expect(screen.queryByText(/الطلب المسلّم مقفل/)).toBeNull();

    /* المخزن: العلاقة والحياد الصادق والكاش المحفوظ — الأحداث الأصلية باقية. */
    const stored = await store.getOrder("order-locked");
    if (!stored.ok || !stored.value) throw new Error("order should read");
    const order = stored.value.order;
    expect(order.status).toBe("needs_review");
    const deliveryEvent = order.events.find(e => e.type === "status_changed" && e.toStatus === "delivered");
    const reversalEvent = order.events.find(e => e.type === "delivery_reversed");
    expect(reversalEvent).toMatchObject({
      reversesEventId: deliveryEvent!.id,
      note: "سُلّم قبل إتمام التعديل المتفق عليه",
    });
    expect(order.recognizedRevenueMinor).toBe(0);
    expect(order.recognizedCostMinor).toBe(0);
    expect(order.profitIndicatorMinor).toBeNull();
    expect(order.resultStatus).toBe("review_required");
    /* الكاش المقبوض لم يُمس عبر هذا المسار. */
    expect(order.collectedMinor).toBe(2500);
    expect(order.events.filter(e => e.type === "collection_recorded")).toHaveLength(1);
    /* حدث التسليم الأصلي باقٍ كما هو — لا حذف ولا تعديل للتاريخ. */
    expect(order.events.filter(e => e.type === "status_changed" && e.toStatus === "delivered")).toHaveLength(
      1,
    );
  });

  it("refuses the documented correction without a reason and keeps the store unchanged", async () => {
    await saveLockedDeliveredOrder(store, "order-locked-reason");
    wouterMocks.location = "/orders/order-locked-reason";
    wouterMocks.params = { id: "order-locked-reason" };
    mockedUsePrototypeServices.mockImplementation(
      () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
    );
    render(<Harness page={<OrderDetail />} />);
    await screen.findByRole("button", { name: "تراجع موثق عن التسليم" });
    fireEvent.click(screen.getByRole("button", { name: "تراجع موثق عن التسليم" }));
    /* بلا سبب: الرفع يرفض — بلا كتابة. */
    fireEvent.click(screen.getByRole("button", { name: "أكّد التراجع الموثق عن التسليم" }));
    await waitFor(() => {
      expect(document.querySelectorAll(".micro-field-error").length).toBeGreaterThan(0);
    });
    expect(document.querySelector(".micro-field-error")?.textContent).toContain("سبب");
    const stored = await store.getOrder("order-locked-reason");
    if (!stored.ok || !stored.value) throw new Error("order should read");
    expect(stored.value.order.events.filter(e => e.type === "delivery_reversed")).toHaveLength(0);
    expect(stored.value.order.status).toBe("needs_review");
  });
});
