/** @vitest-environment jsdom */
/* D-15 (FIN-009) — صندوقا مساهمة التوصيل في محرر الاتفاق: مساهمة المشروع
 * ومساهمة العميل، والوصف البسيط المستنتج من القيمتين، والحفظ يمر بالشروط
 * المشتقة إلى عقد الدومين نفسه — null تبقى null لا صفرًا صامتًا. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { CostEstimateService } from "@/application/estimates/costEstimateService";
import { DraftService } from "@/application/drafts/draftService";
import { CostService, type CostEditorInput } from "@/application/cost/costService";
import { AgreementService } from "@/application/agreements/agreementService";
import { FulfillmentService } from "@/application/fulfillment/fulfillmentService";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import AgreementEditor from "@/pages/AgreementEditor";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/orders/draft/d15-draft-1/agreement",
  params: {} as Record<string, string | undefined>,
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => wouterMocks.params,
  useSearch: () => "",
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-09-27T10:00:00.000Z";

let store: MemoryLocalStore;
let costs: CostService;
let agreements: AgreementService;
const contextRef: { current: Record<string, unknown> } = { current: {} };

function Harness({ page }: { page: React.ReactNode }) {
  const [version, setVersion] = React.useState(0);
  contextRef.current = {
    costs,
    agreements,
    fulfillment: new FulfillmentService(store, () => NOW),
    inventory: new InventoryMaterialService(store, () => NOW),
    costEstimates: new CostEstimateService(store, () => NOW),
    drafts: new DraftService(store, () => NOW),
    cashContinuity: new CashContinuityService(store, () => NOW),
    partyLedger: {
      read: async () => ({ ok: true, value: { parties: [] as unknown[] } }),
    },
    projectFinance: new ProjectFinancialService(store, () => NOW),
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

async function draftWithCost() {
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
  return withCost.draft;
}

describe("D-15 — the agreement editor two contribution boxes", () => {
  beforeEach(() => {
    wouterMocks.navigate.mockClear();
    wouterMocks.params = {};
    vi.clearAllMocks();
    store = new MemoryLocalStore();
    costs = new CostService(store, () => NOW);
    agreements = new AgreementService(store, costs, () => NOW);
  });
  afterEach(() => cleanup());

  it("records both contributions, derives shared, and saves the collectible value once", async () => {
    const draft = await draftWithCost();
    wouterMocks.params = { id: draft.id };
    render(<Harness page={<AgreementEditor />} />);
    await screen.findByText("سجّل ما اتفقت عليه");
    fireEvent.change(screen.getByLabelText("السعر المتفق عليه بالأرقام 0–9"), { target: { value: "50" } });
    fireEvent.change(document.getElementById("agreement-delivery-date")!, {
      target: { value: "2026-09-30" },
    });
    /* الصندوقان داخل القسم المطوي — كلاهما موجود في النموذج. */
    fireEvent.change(screen.getByLabelText("مساهمة المشروع في التوصيل بالأرقام 0–9"), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByLabelText("مساهمة العميل في التوصيل بالأرقام 0–9"), {
      target: { value: "5" },
    });
    /* الوصف يُستنتج من الصندوقين قبل الحفظ — لا خيار shared مستقل. */
    expect(screen.getByTestId("delivery-contribution-description").textContent).toContain("مشترك");
    expect(screen.queryByLabelText("مسؤولية كلفة النقل والتوصيل")).toBeNull();
    fireEvent.click(screen.getByText("تسجيل الاتفاق"));
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalled());
    const orderId = wouterMocks.navigate.mock.calls[0][0] as string;
    const saved = await store.getOrder(orderId.split("?")[0].replace("/orders/", ""));
    if (!saved.ok || !saved.value) throw new Error("order should exist");
    expect(saved.value.order.deliveryTerms?.responsibility).toBe("shared");
    expect(saved.value.order.deliveryTerms?.feeChargedMinor).toBe(500);
    expect(saved.value.order.deliveryTerms?.costPaidMinor).toBe(300);
    /* المطلوب من العميل: 50 + 5 (مساهمة العميل وحدها) = 55. */
    expect(saved.value.order.receivableMinor).toBe(5500);
  });

  it("a project-only contribution leaves the customer debt at the product price", async () => {
    const draft = await draftWithCost();
    wouterMocks.params = { id: draft.id };
    render(<Harness page={<AgreementEditor />} />);
    await screen.findByText("سجّل ما اتفقت عليه");
    fireEvent.change(screen.getByLabelText("السعر المتفق عليه بالأرقام 0–9"), { target: { value: "50" } });
    fireEvent.change(document.getElementById("agreement-delivery-date")!, {
      target: { value: "2026-09-30" },
    });
    fireEvent.change(screen.getByLabelText("مساهمة المشروع في التوصيل بالأرقام 0–9"), {
      target: { value: "10" },
    });
    expect(screen.getByTestId("delivery-contribution-description").textContent).toContain(
      "التوصيل على المشروع",
    );
    fireEvent.click(screen.getByText("تسجيل الاتفاق"));
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalled());
    const orderId = wouterMocks.navigate.mock.calls[0][0] as string;
    const saved = await store.getOrder(orderId.split("?")[0].replace("/orders/", ""));
    if (!saved.ok || !saved.value) throw new Error("order should exist");
    expect(saved.value.order.deliveryTerms?.responsibility).toBe("project_pays");
    expect(saved.value.order.deliveryTerms?.costPaidMinor).toBe(1000);
    /* project_pays لا يحمل أجرة على الزبون — null لا صفر صامت. */
    expect(saved.value.order.deliveryTerms?.feeChargedMinor).toBeNull();
    expect(saved.value.order.receivableMinor).toBe(5000);
  });

  it("the courier-direct choice records contextual info only with no amounts through the project", async () => {
    const draft = await draftWithCost();
    wouterMocks.params = { id: draft.id };
    render(<Harness page={<AgreementEditor />} />);
    await screen.findByText("سجّل ما اتفقت عليه");
    fireEvent.change(screen.getByLabelText("السعر المتفق عليه بالأرقام 0–9"), { target: { value: "50" } });
    fireEvent.change(document.getElementById("agreement-delivery-date")!, {
      target: { value: "2026-09-30" },
    });
    fireEvent.click(screen.getByLabelText("الزبون يدفع لشركة التوصيل مباشرة"));
    /* في وضع الدفع المباشر تختفي صناديق المساهمات — لا مبلغ عبر المشروع. */
    expect(screen.queryByLabelText("مساهمة العميل في التوصيل بالأرقام 0–9")).toBeNull();
    fireEvent.click(screen.getByText("تسجيل الاتفاق"));
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalled());
    const orderId = wouterMocks.navigate.mock.calls[0][0] as string;
    const saved = await store.getOrder(orderId.split("?")[0].replace("/orders/", ""));
    if (!saved.ok || !saved.value) throw new Error("order should exist");
    expect(saved.value.order.deliveryTerms?.responsibility).toBe("customer_pays_courier");
    expect(saved.value.order.deliveryTerms?.feeChargedMinor).toBeNull();
    expect(saved.value.order.deliveryTerms?.costPaidMinor).toBeNull();
    /* لا مستحق للمشروع من التوصيل — القيمة على السعر وحده. */
    expect(saved.value.order.receivableMinor).toBe(5000);
  });

  it("empty boxes record no delivery terms at all — legacy-simple behavior", async () => {
    const draft = await draftWithCost();
    wouterMocks.params = { id: draft.id };
    render(<Harness page={<AgreementEditor />} />);
    await screen.findByText("سجّل ما اتفقت عليه");
    fireEvent.change(screen.getByLabelText("السعر المتفق عليه بالأرقام 0–9"), { target: { value: "50" } });
    fireEvent.change(document.getElementById("agreement-delivery-date")!, {
      target: { value: "2026-09-30" },
    });
    fireEvent.click(screen.getByText("تسجيل الاتفاق"));
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalled());
    const orderId = wouterMocks.navigate.mock.calls[0][0] as string;
    const saved = await store.getOrder(orderId.split("?")[0].replace("/orders/", ""));
    if (!saved.ok || !saved.value) throw new Error("order should exist");
    /* بلا شروط: الحقل غائب تمامًا (null/undefined) — توافق رجدي مع الطلبات القديمة. */
    expect(saved.value.order.deliveryTerms ?? null).toBeNull();
    expect(saved.value.order.receivableMinor).toBe(5000);
  });
});
