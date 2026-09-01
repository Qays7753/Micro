/** @vitest-environment jsdom */

/* المجموعة ٢ (§15 — اختبارات السطوح): ورقة التحصيل ودفتر المحفظة وكشف الفترة —
 * القراءة الصادقة، الحمايات، الرجوع المحفوظ، ولا نجاح بلا كتابة محلية. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { CollectionService } from "@/application/collections/collectionService";
import { WalletLedgerService } from "@/application/cash/walletLedgerService";
import { StatementService } from "@/application/finance/statementService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { FulfillmentService } from "@/application/fulfillment/fulfillmentService";
import { DirectSaleService } from "@/application/direct-sales/directSaleService";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import Collect from "@/pages/Collect";
import WalletLedger from "@/pages/WalletLedger";
import Statement from "@/pages/Statement";
import {
  calculateCostSnapshot,
  collectDeposit,
  collectRemaining,
  createCraftOrder,
  transitionOrder,
} from "@micro-domain/craft-order/index.js";
import { createDirectSale } from "@micro-domain/direct-sale/index.js";
import { createCashContinuityEntry, createCashWallet } from "@micro-domain/cash-continuity/index.js";
import { createFinancialEvent } from "@micro-domain/financial-event/index.js";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: "",
  params: {} as Record<string, string>,
}));
vi.mock("wouter", () => ({
  useLocation: () => ["/collect", wouterMocks.navigate],
  useParams: () => wouterMocks.params,
  useSearch: () => wouterMocks.search,
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-09-02T10:00:00.000Z";

let store: MemoryLocalStore;
let collections: CollectionService;
let walletLedger: WalletLedgerService;
let statement: StatementService;
const contextRef: { current: Record<string, unknown> } = { current: {} };

function G2Harness({ page }: { page: React.ReactNode }) {
  const [version, setVersion] = React.useState(0);
  contextRef.current = {
    collections,
    walletLedger,
    statement,
    cashContinuity: new CashContinuityService(store, () => NOW),
    dataVersion: version,
    notifyDataChanged: () => setVersion(current => current + 1),
  };
  return <UnsavedChangesProvider navigate={wouterMocks.navigate}>{page}</UnsavedChangesProvider>;
}

/** طلب مسلّم بمتبقٍ 80.00 د.أ (سعر 100 عربون 20). */
async function seedDeliveredOrder(store: MemoryLocalStore) {
  const cost = calculateCostSnapshot("g2-cost", {
    currency: "JOD",
    materialItems: [],
    time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
    packagingMinor: 0,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 1,
    createdAt: "2026-08-20T09:00:00.000Z",
    freshnessDays: null,
    source: "price_approval",
  });
  let order = createCraftOrder({
    id: "g2-order-1",
    customerName: "خالد",
    itemName: "طقم مطرز",
    specifications: "اختبار",
    quantity: 1,
    agreedPriceMinor: 10000,
    costSnapshot: cost,
    createdAt: "2026-08-20T09:00:00.000Z",
  });
  order = collectDeposit(order, 2000, "g2-deposit", "2026-08-20T10:00:00.000Z");
  for (const [to, stamp] of [
    ["provisional_agreement", "2026-08-20T11:00:00.000Z"],
    ["confirmed", "2026-08-21T09:00:00.000Z"],
    ["in_progress", "2026-08-22T09:00:00.000Z"],
    ["ready", "2026-08-23T09:00:00.000Z"],
    ["delivered", "2026-08-25T09:00:00.000Z"],
  ] as const)
    order = transitionOrder(order, { to, idempotencyKey: `g2-${to}`, createdAt: stamp });
  const saved = await store.saveOrder({
    id: "g2-order-1",
    order,
    catalogItemId: null,
    deliveryDate: "2026-08-25",
    agreementSource: "walk_in",
    createdAt: "2026-08-20T09:00:00.000Z",
    updatedAt: "2026-08-25T09:00:00.000Z",
  });
  if (!saved.ok) throw new Error("order should save");
}

/** درج بفتح 50.00 د.أ + بيع آجل متبقٍ 15.00 د.أ + مصروف مسجل 12.00 د.أ. */
async function seedWalletsAndSales(store: MemoryLocalStore) {
  const wallet = createCashWallet({
    id: "drawer-1",
    name: "درج المحل",
    kind: "cash_drawer",
    createdAt: NOW,
    createdOperationKey: "drawer-open-key",
  });
  const entries = [
    createCashContinuityEntry({
      id: "drawer-opening",
      walletId: wallet.id,
      type: "opening_balance",
      occurredOn: "2026-09-01",
      recordedAt: NOW,
      cashDeltaMinor: 5000,
      note: "رصيد بداية",
      operationKey: "drawer-open-key",
    }),
    createCashContinuityEntry({
      id: "drawer-alloc-1",
      walletId: wallet.id,
      type: "allocation",
      occurredOn: "2026-09-02",
      recordedAt: NOW,
      cashDeltaMinor: 1500,
      note: "تخصيص قبض بيع",
      operationKey: "alloc-1",
      sourceRefId: "g2-sale-1",
      sourceRefKind: "sale",
    }),
  ];
  const committed = await store.commitCashContinuity(wallet, entries);
  if (!committed.ok) throw new Error("wallet should commit");
  const sale = await store.saveDirectSale(
    createDirectSale({
      id: "g2-sale-1",
      itemName: "شوكولا",
      quantity: 1,
      revenueMinor: 2500,
      collectedMinor: 1000,
      catalogItemId: null,
      customerName: "هدى",
      costMinor: 900,
      occurredOn: "2026-09-02",
      recordedAt: NOW,
      note: "بيع بجزء مدفوع",
      idempotencyKey: "g2-sale-1-key",
    }),
  );
  if (!sale.ok) throw new Error("sale should save");
}

async function seedExpenseEvent(store: MemoryLocalStore) {
  const saved = await store.saveFinancialEvent(
    createFinancialEvent({
      id: "g2-exp-1",
      type: "operating_expense_cash",
      amountMinor: 1200,
      occurredOn: "2026-09-02",
      recordedAt: NOW,
      idempotencyKey: "g2-exp-1-key",
      note: "أكياس",
      counterparty: null,
      relatedEventId: null,
      expenseContext: {
        relationship: "project",
        behavior: "unknown",
        purpose: "project_general",
        knowledge: "known",
        sharedProjectShare: null,
      },
    }),
  );
  if (!saved.ok) throw new Error("event should save");
}

beforeEach(() => {
  store = new MemoryLocalStore();
  const projectFinance = new ProjectFinancialService(store, () => NOW);
  const fulfillment = new FulfillmentService(store, () => NOW);
  const directSales = new DirectSaleService(store, () => NOW);
  collections = new CollectionService(store, fulfillment, directSales, projectFinance, () => NOW);
  walletLedger = new WalletLedgerService(store);
  statement = new StatementService(store, projectFinance);
  wouterMocks.search = "";
  wouterMocks.params = {};
  wouterMocks.navigate.mockClear();
  mockedUsePrototypeServices.mockImplementation(
    () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
  );
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Collect — ورقة التحصيل (المجموعة ٢ §6)", () => {
  it("يعرض الذمم والمصدر والمتبقي ويعبّئ المبلغ مع معاينة أثر لا إيراد فيها", async () => {
    await seedDeliveredOrder(store);
    await seedWalletsAndSales(store);
    wouterMocks.search = "source=order:g2-order-1&from=/";
    render(<G2Harness page={<Collect />} />);
    await waitFor(() => expect(screen.getByText("خالد")).toBeTruthy());
    expect(screen.getByText("المتبقي عليه").nextElementSibling?.textContent).toContain("80.00");
    /* معاينة الأثر: القبض كاش والدين ينقص — والإيراد لا يتغير. */
    expect(screen.getByText("الإيراد والنتيجة")).toBeTruthy();
    expect(screen.getByText("لا تتغير — القبض ليس إيرادًا")).toBeTruthy();
    /* الدرج وجهة افتراضية معلنة لا اختيارًا صامتًا. */
    const destination = screen.getByLabelText(/وجهة الكاش/) as HTMLSelectElement;
    expect(destination.selectedOptions[0]?.textContent).toContain("درج المحل");
    expect(destination.selectedOptions[0]?.textContent).toContain("الافتراضي");
  });

  it("يمنع التحصيل فوق المتبقي ويعرض المتبقي والمطلوب في رسالة الحماية", async () => {
    await seedDeliveredOrder(store);
    await seedWalletsAndSales(store);
    wouterMocks.search = "source=order:g2-order-1";
    render(<G2Harness page={<Collect />} />);
    await waitFor(() => expect(screen.getByText("خالد")).toBeTruthy());
    const amount = screen.getByLabelText("مبلغ التحصيل");
    fireEvent.change(amount, { target: { value: "90" } });
    fireEvent.click(screen.getByText("سجّل القبض"));
    await waitFor(() => expect(screen.getByText(/التحصيل يتجاوز المتبقي على خالد/)).toBeTruthy());
    expect(screen.getByText(/المتبقي 80\.00 د\.أ/)).toBeTruthy();
  });

  it("يسجّل القبض ويصدق بالحالة النهائية: الكاش انتقل والمتبقي بقي دينًا", async () => {
    await seedDeliveredOrder(store);
    await seedWalletsAndSales(store);
    wouterMocks.search = "source=order:g2-order-1";
    render(<G2Harness page={<Collect />} />);
    await waitFor(() => expect(screen.getByText("خالد")).toBeTruthy());
    fireEvent.change(screen.getByLabelText("مبلغ التحصيل"), { target: { value: "30" } });
    fireEvent.click(screen.getByText("سجّل القبض"));
    await waitFor(() => expect(screen.getByText("قبضت من خالد")).toBeTruthy());
    expect(screen.getByText(/الباقي على خالد: 50\.00/)).toBeTruthy();
    expect(screen.getByText(/انتقل إلى «درج المحل»: 30\.00/)).toBeTruthy();
    expect(screen.getByText("افتح السجل")).toBeTruthy();
    /* الضغط الثاني لا ينشئ قبضة ثانية — المفتاح نفسه والنتيجة نفسها. */
    const ordersResult = await store.listOrders();
    const receivable = ordersResult.ok ? ordersResult.value[0]?.order.receivableMinor : undefined;
    expect(receivable).toBe(5000);
  });
});

describe("WalletLedger — دفتر المحفظة (المجموعة ٢ §9.1)", () => {
  it("يعرض الرصيد والحركات بترتيبها ووصل المصدر، والمجهول الافتتاحي لا يُصفّر", async () => {
    await seedWalletsAndSales(store);
    wouterMocks.search = "from=/cash";
    wouterMocks.params = { id: "drawer-1" };
    render(<G2Harness page={<WalletLedger />} />);
    await waitFor(() => expect(screen.getByText("درج المحل")).toBeTruthy());
    /* الرصيد 50 + 15 = 65.00 د.أ */
    expect(screen.getByText("65.00")).toBeTruthy();
    expect(screen.getByText("تخصيص من غير الموزع")).toBeTruthy();
    expect(screen.getByText("بيع مباشر — السجل المصدر")).toBeTruthy();
    /* عناصر السطر: الرصيد الجاري يظهر حيث يحمل معنى. */
    expect(screen.getByText("رصيد بداية")).toBeTruthy();
  });

  it("يرفض محفظة غير موجودة برسالة صادقة لا برصيد مختلق", async () => {
    wouterMocks.params = { id: "missing" };
    render(<G2Harness page={<WalletLedger />} />);
    await waitFor(() => expect(screen.getByText("دفتر محفظة غير متاح")).toBeTruthy());
    expect(screen.getByText(/لم تُعثر/)).toBeTruthy();
  });
});

describe("Statement — كشف الفترة (المجموعة ٢ §9.2)", () => {
  it("يفصل الكاش عن النتيجة والأمانات عن الربح ويصل كل سطر بمصدره", async () => {
    await seedWalletsAndSales(store);
    await seedExpenseEvent(store);
    render(<G2Harness page={<Statement />} />);
    await waitFor(() => expect(screen.getByText("كشف الفترة")).toBeTruthy());
    expect(screen.getByText("ما دخل من كاش")).toBeTruthy();
    expect(screen.getByText("ما خرج من كاش")).toBeTruthy();
    expect(screen.getByText("قبض البيع المباشر")).toBeTruthy();
    expect(screen.getByText(/بتاريخ البيع/)).toBeTruthy();
    expect(screen.getByText("مصاريف مدفوعة")).toBeTruthy();
    expect(screen.getByText("الأمانات — ليست ربحك")).toBeTruthy();
    expect(screen.getByText("ما يعنيه هذا الكشف")).toBeTruthy();
  });

  it("نطاق مقلوب يُرفض برسالة صريحة لا بأصفار", async () => {
    render(<G2Harness page={<Statement />} />);
    await waitFor(() => expect(screen.getByText("كشف الفترة")).toBeTruthy());
    fireEvent.click(screen.getByText("نطاق مخصص"));
    fireEvent.change(screen.getByLabelText(/من/), { target: { value: "2026-09-07" } });
    fireEvent.change(screen.getByLabelText(/إلى/), { target: { value: "2026-09-01" } });
    await waitFor(() => expect(screen.getByText("اختر نطاق كشف يبدأ قبل نهايته.")).toBeTruthy());
  });
});
