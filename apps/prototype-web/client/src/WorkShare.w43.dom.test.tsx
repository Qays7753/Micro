/** @vitest-environment jsdom */
/* Wave 4.3 — P-4.3-4: العمل والطلبات والمشاركة.
 * ---------------------------------------------------------------------------
 * ١) F06: «شارك إشعار القبض» يظهر بعد نجاح التحصيل الحقيقي فقط — من الحدث
 *    المحفوظ القائم (عقد ٣٣)؛ يفتح المعاينة بنص الإشعار وreturnTo محفوظ.
 * ٢) F06: البيع المباشر بلا نوع مسودة زبون في العقد — لا زر مشاركة له.
 * ٣) F06: التحصيل غير الناجح لا يُنتج زر مشاركة ولا شاشة نتيجة.
 * ٤) §11: الطلبات مجمعة بحالة العمل — يحتاج تنفيذًا / ينتظر تحصيلًا / ملغاة
 *    مطوية؛ الخطوة التالية في كل صف.
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { DraftService } from "@/application/drafts/draftService";
import { CostService, type CostEditorInput } from "@/application/cost/costService";
import { AgreementService } from "@/application/agreements/agreementService";
import { FulfillmentService } from "@/application/fulfillment/fulfillmentService";
import { CollectionService } from "@/application/collections/collectionService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { DirectSaleService } from "@/application/direct-sales/directSaleService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { DailyFollowUpService } from "@/application/follow-up/dailyFollowUpService";
import { ScheduleService } from "@/application/scheduling/scheduleService";
import { ProfileService } from "@/application/profile/profileService";
import Collect from "@/pages/Collect";
import Orders from "@/pages/Orders";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/collect",
  search: "",
  params: {} as Record<string, string>,
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => wouterMocks.params,
  useSearch: () => wouterMocks.search,
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-09-16T09:00:00.000Z";

let store: MemoryLocalStore;
let agreements: AgreementService;
let fulfillment: FulfillmentService;
let costs: CostService;
let dataVersion = 0;

const costInput: CostEditorInput = {
  materialItems: [],
  time: { minutes: 30, hourlyRateMinor: 300, confidence: "known" },
  packagingMinor: 0,
  deliveryMinor: 0,
  wasteMinor: 0,
  safetyBufferMinor: 0,
  quantity: 1,
};

function buildServices() {
  const schedules = new ScheduleService(store, () => NOW);
  const cashContinuity = new CashContinuityService(store, () => NOW);
  const projectFinance = new ProjectFinancialService(store, () => NOW);
  return {
    collections: new CollectionService(
      store,
      fulfillment,
      new DirectSaleService(store, () => NOW),
      projectFinance,
    ),
    cashContinuity,
    agreements,
    fulfillment,
    dailyFollowUp: new DailyFollowUpService(store),
    directSales: new DirectSaleService(store, () => NOW),
    schedules,
    preferences: {
      load: async () => ({ ok: true, preference: { theme: "light" } }),
      save: async () => ({ ok: true }),
      readDisabledCapabilities: async () => ({ ok: true, disabled: [] }),
    },
    dataVersion,
    notifyDataChanged: () => {
      dataVersion += 1;
    },
  } as unknown as ReturnType<typeof usePrototypeServices>;
}

async function seedProfile() {
  const result = await new ProfileService(store, () => NOW).save("مشغل عمل");
  if (!result.ok) throw new Error(result.message);
}

async function agreedOrder(options?: { depositMinor?: number; itemName?: string; customer?: string }) {
  const drafts = new DraftService(store, () => NOW);
  const created = await drafts.create("customer_order");
  if (!created.ok) throw new Error(created.message);
  const saved = await drafts.save({
    ...created.draft,
    customerName: options?.customer ?? "سارة",
    itemName: options?.itemName ?? "رف خشبي",
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
  });
  if (!agreed.ok) throw new Error(agreed.message);
  return agreed.stored;
}

async function deliverWithDebt(stored: { id: string }) {
  const started = await agreements.startExecution(stored.id);
  if (!started.ok) throw new Error(started.message);
  const ready = await fulfillment.markReady(stored.id);
  if (!ready.ok) throw new Error(ready.message);
  const delivered = await fulfillment.deliver(stored.id);
  if (!delivered.ok) throw new Error(delivered.message);
}

function renderWithProviders(page: React.ReactNode) {
  render(<UnsavedChangesProvider navigate={wouterMocks.navigate}>{page}</UnsavedChangesProvider>);
}

describe("Wave 4.3 — P-4.3-4: Work, orders, and sharing", () => {
  beforeEach(() => {
    wouterMocks.navigate.mockReset();
    wouterMocks.params = {};
    wouterMocks.location = "/collect";
    wouterMocks.search = "";
    vi.clearAllMocks();
    store = new MemoryLocalStore();
    dataVersion = 0;
    costs = new CostService(store, () => NOW);
    agreements = new AgreementService(store, costs, () => NOW);
    fulfillment = new FulfillmentService(store, () => NOW, new ScheduleService(store, () => NOW));
    mockedUsePrototypeServices.mockReturnValue(buildServices());
  });
  afterEach(() => cleanup());

  it("F06: «شارك إشعار القبض» appears only after a successful order collection and opens the preview", async () => {
    await seedProfile();
    const stored = await agreedOrder({ depositMinor: 1000 });
    await deliverWithDebt(stored);
    wouterMocks.location = `/collect?source=order:${stored.id}&returnTo=/orders`;
    wouterMocks.search = `?source=order:${stored.id}&returnTo=/orders`;
    renderWithProviders(<Collect />);
    /* قبل النجاح لا زر مشاركة أصلًا. */
    await waitFor(() => expect(screen.getByRole("button", { name: /سجّل القبض/ })).toBeTruthy());
    expect(screen.queryByTestId("share-receipt-entry")).toBeNull();
    fireEvent.change(
      screen.getByLabelText("مبلغ التحصيل").querySelector("input") ?? screen.getByLabelText("مبلغ التحصيل"),
      {
        target: { value: "20" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: /سجّل القبض/ }));
    /* بعد النجاح الحقيقي: زر المشاركة من الحدث المحفوظ القائم. */
    const shareEntry = await screen.findByTestId("share-receipt-entry");
    expect(shareEntry.textContent).toContain("شارك إشعار القبض");
    fireEvent.click(shareEntry);
    expect(wouterMocks.navigate).toHaveBeenCalledWith(
      "/share/preview?returnTo=%2Fcollect",
      expect.objectContaining({ state: expect.objectContaining({ draft: expect.anything() }) }),
    );
  });

  it("F06: a direct-sale collection has no share button — no customer draft kind in the contract", async () => {
    await seedProfile();
    const sale = await new DirectSaleService(store, () => NOW).record({
      itemName: "شوكولاتة",
      quantity: 1,
      revenueMinor: 3000,
      collectedMinor: 1000,
      collectionStatus: "partial_debt",
      customerName: "ليان",
      costMinor: null,
      occurredOn: "2026-09-15",
      note: "بيع آجل",
      idempotencyKey: "w43-credit-sale",
    });
    if (!sale.ok) throw new Error(sale.message);
    wouterMocks.location = `/collect?source=sale:${sale.value.id}`;
    wouterMocks.search = `?source=sale:${sale.value.id}`;
    renderWithProviders(<Collect />);
    await waitFor(() => expect(screen.getByRole("button", { name: /سجّل القبض/ })).toBeTruthy());
    fireEvent.change(
      screen.getByLabelText("مبلغ التحصيل").querySelector("input") ?? screen.getByLabelText("مبلغ التحصيل"),
      {
        target: { value: "10" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: /سجّل القبض/ }));
    await waitFor(() => expect(screen.getByText(/قبضت من/)).toBeTruthy());
    expect(screen.queryByTestId("share-receipt-entry")).toBeNull();
  });

  it("F06: an unsuccessful collection shows the honest error and never a share entry", async () => {
    await seedProfile();
    const stored = await agreedOrder({ depositMinor: 1000 });
    await deliverWithDebt(stored);
    wouterMocks.location = `/collect?source=order:${stored.id}`;
    wouterMocks.search = `?source=order:${stored.id}`;
    renderWithProviders(<Collect />);
    await waitFor(() => expect(screen.getByRole("button", { name: /سجّل القبض/ })).toBeTruthy());
    /* مبلغ يتجاوز المتبقي — رفض صادق لا نتيجة ولا مشاركة. */
    fireEvent.change(
      screen.getByLabelText("مبلغ التحصيل").querySelector("input") ?? screen.getByLabelText("مبلغ التحصيل"),
      {
        target: { value: "99999" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: /سجّل القبض/ }));
    await waitFor(() =>
      expect(screen.getAllByRole("alert").some(alert => alert.textContent?.includes("يتجاوز المتبقي"))).toBe(
        true,
      ),
    );
    expect(screen.queryByTestId("share-receipt-entry")).toBeNull();
    expect(screen.queryByText(/قبضت من/)).toBeNull();
  });

  it("§11: orders are grouped by work state with next steps, cancelled collapsed not deleted", async () => {
    await seedProfile();
    const executing = await agreedOrder({ itemName: "مجسم جبس" });
    const started = await agreements.startExecution(executing.id);
    if (!started.ok) throw new Error(started.message);
    const debtOrder = await agreedOrder({ itemName: "إطار صور", depositMinor: 1000 });
    await deliverWithDebt(debtOrder);
    const cancelled = await agreedOrder({ itemName: "طلب ملغى" });
    const cancelledRead = await store.getOrder(cancelled.id);
    if (!cancelledRead.ok || !cancelledRead.value) throw new Error("missing order");
    await store.saveOrder({
      ...cancelledRead.value,
      order: { ...cancelledRead.value.order, status: "cancelled" },
    });
    wouterMocks.location = "/orders";
    wouterMocks.search = "";
    renderWithProviders(<Orders />);
    /* المجموعات بترتيب العمل؛ الخطوة التالية في كل صف؛ الملغاة مطوية مرئية. */
    const executingGroup = await screen.findByText("يحتاج تنفيذًا الآن");
    expect(executingGroup.parentElement?.textContent).toContain("مجسم جبس");
    expect(executingGroup.parentElement?.textContent).toContain("الخطوة التالية:");
    const awaitingGroup = screen.getByText("ينتظر تحصيلًا");
    expect(awaitingGroup.parentElement?.textContent).toContain("إطار صور");
    const cancelledGroup = document.querySelector(".micro-orders-cancelled") as HTMLDetailsElement | null;
    expect(cancelledGroup).toBeTruthy();
    expect(cancelledGroup?.textContent).toContain("طلب ملغى");
    expect(cancelledGroup?.textContent).toContain("تبقى في السجل للتدقيق");
  });
});
