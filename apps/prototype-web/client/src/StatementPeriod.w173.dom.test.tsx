/** @vitest-environment jsdom */

/* FIN-007 (WS-173 — Wave 1): قوالب الربع ومقارنة الفترة السابقة على كشف الفترة —
 * البذرة حية (MemoryLocalStore + خدمات حقيقية) كما في G2، والساعة مثبتة على
 * 2026-09-02 (الأربعاء) فالأسبوع 30/08 → 05/09 والسابقة المكافئة 23/08 → 29/08
 * والربع الثالث 01/07 → 30/09؛ كل شيء قراءة فقط بلا كتابة. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { PeriodComparisonService } from "@/application/finance/periodComparisonService";
import { StatementService } from "@/application/finance/statementService";
import Statement from "@/pages/Statement";
import {
  calculateCostSnapshot,
  createCraftOrder,
  transitionOrder,
  type CraftOrder,
} from "@micro-domain/craft-order/index.js";
import type { StoredCraftOrder } from "@/storage/local/types";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/finance/statement",
  search: "",
  params: {} as Record<string, string>,
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => wouterMocks.params,
  useSearch: () => wouterMocks.search,
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-09-02T10:00:00.000Z";

let store: MemoryLocalStore;
let statement: StatementService;
let periodComparison: PeriodComparisonService;
const contextRef: { current: Record<string, unknown> } = { current: {} };

function Harness() {
  const [version, setVersion] = React.useState(0);
  contextRef.current = {
    statement,
    periodComparison,
    dataVersion: version,
    notifyDataChanged: () => setVersion(current => current + 1),
  };
  return (
    <UnsavedChangesProvider navigate={wouterMocks.navigate}>
      <Statement />
    </UnsavedChangesProvider>
  );
}

function estimatedSnapshot(id: string) {
  return calculateCostSnapshot(`${id}-cost`, {
    currency: "JOD",
    materialItems: [],
    time: { minutes: 60, hourlyRateMinor: 300, confidence: "estimated" },
    packagingMinor: 0,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 1,
    createdAt: "2026-08-01T09:00:00.000Z",
    freshnessDays: null,
    source: "price_approval",
  });
}

/** طلب مسلّم بوقت مقدّر — نتيجة غير نهائية فيُستبعد من نطاق النتيجة ويُعلَن. */
async function saveExcludedDeliveredOrder(
  store: MemoryLocalStore,
  input: { id: string; deliveredOn: string },
) {
  let order: CraftOrder = createCraftOrder({
    id: input.id,
    customerName: "عميلة",
    itemName: "قطعة",
    specifications: "اختبار المقارنة",
    quantity: 1,
    agreedPriceMinor: 1200,
    costSnapshot: estimatedSnapshot(input.id),
    createdAt: `${input.deliveredOn}T08:00:00.000Z`,
  });
  for (const [to, stamp] of [
    ["provisional_agreement", `${input.deliveredOn}T08:30:00.000Z`],
    ["confirmed", `${input.deliveredOn}T09:00:00.000Z`],
    ["in_progress", `${input.deliveredOn}T10:00:00.000Z`],
    ["ready", `${input.deliveredOn}T11:00:00.000Z`],
    ["delivered", `${input.deliveredOn}T12:00:00.000Z`],
  ] as const)
    order = transitionOrder(order, { to, idempotencyKey: `${input.id}-${to}`, createdAt: stamp });
  const stored: StoredCraftOrder = {
    id: order.id,
    order,
    deliveryDate: input.deliveredOn,
    agreementSource: "test",
    catalogItemId: null,
    createdAt: order.createdAt,
    updatedAt: `${input.deliveredOn}T12:00:00.000Z`,
  };
  const saved = await store.saveOrder(stored);
  if (!saved.ok) throw new Error("order should save");
}

beforeEach(() => {
  store = new MemoryLocalStore();
  vi.useFakeTimers({ now: new Date(NOW), toFake: ["Date"] });
  const projectFinance = new ProjectFinancialService(store, () => NOW);
  statement = new StatementService(store, projectFinance);
  periodComparison = new PeriodComparisonService(store, () => NOW);
  wouterMocks.search = "";
  wouterMocks.navigate.mockClear();
  mockedUsePrototypeServices.mockImplementation(
    () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("Statement — قوالب الربع (FIN-007)", () => {
  it("يعرض قالبَي الربع ويحلّهما إلى حدود الربع التقويمي الصحيحة", async () => {
    render(<Harness />);
    await waitFor(() => expect(screen.getByText("كشف الفترة")).toBeTruthy());
    expect(screen.getByRole("button", { name: "هذا الربع" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "الربع الماضي" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "هذا الربع" }));
    await waitFor(() => expect(screen.getByText(/من 01\/07\/2026 إلى 30\/09\/2026 — ما صار/)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "الربع الماضي" }));
    await waitFor(() => expect(screen.getByText(/من 01\/04\/2026 إلى 30\/06\/2026 — ما صار/)).toBeTruthy());
  });

  it("وسم «فترة جارية» في الترويسة حين يحتوي النطاق المعروض اليوم — ويغيب للفترة المنقضية", async () => {
    render(<Harness />);
    await waitFor(() => expect(screen.getByText("كشف الفترة")).toBeTruthy());
    /* الأسبوع الحالي يحتوي 02/09/2026 — وسم صادق مستقل عن المقارنة. */
    expect(screen.getByText("فترة جارية")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "الربع الماضي" }));
    await waitFor(() => expect(screen.queryByText("فترة جارية")).toBeNull());
  });
});

describe("Statement — مقارنة الفترة السابقة (FIN-007)", () => {
  it("مفتاح «قارن مع الفترة السابقة» يعرض السابقة المكافئة بتواريخها الصحيحة وطرفيها", async () => {
    render(<Harness />);
    await waitFor(() => expect(screen.getByText("كشف الفترة")).toBeTruthy());
    expect(screen.queryByText("مقارنة الفترتين")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "قارن مع الفترة السابقة" }));
    await waitFor(() => expect(screen.getByText("مقارنة الفترتين")).toBeTruthy());
    /* ترويسة اللوحة: السابقة المكافئة بنفس الطول (7 أيام) قبل بداية النطاق. */
    expect(screen.getByText(/^من 23\/08\/2026 إلى 29\/08\/2026$/)).toBeTruthy();
    /* الطرفان داخل اللوحة بتاريخيهما كاملين. */
    expect(
      screen.getByText(
        /الحالية: من 30\/08\/2026 إلى 05\/09\/2026 — السابقة: من 23\/08\/2026 إلى 29\/08\/2026/,
      ),
    ).toBeTruthy();
    expect(screen.getByText("مسجلة فقط")).toBeTruthy();
  });

  it("يعرض عدّاد الطلبات المسلّمة المستبعدة على الطرف الذي فيه طلب غير مكتمل، مع حالة ناقصة", async () => {
    await saveExcludedDeliveredOrder(store, { id: "wk-excluded", deliveredOn: "2026-08-31" });
    render(<Harness />);
    await waitFor(() => expect(screen.getByText("كشف الفترة")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "قارن مع الفترة السابقة" }));
    await waitFor(() => expect(screen.getByText("ناقصة")).toBeTruthy());
    const row = document.querySelector('li[data-line-id="excludedOrderCount"]');
    expect(row).toBeTruthy();
    expect(row?.textContent).toContain("طلبات مسلّمة مستبعدة");
    /* الطرف الحالي فيه المستبعد (1) والسابقة فارغة (0) — أرقام صادقة لا اختفاء. */
    expect(row?.textContent).toContain("الحالية 1");
    expect(row?.textContent).toContain("السابقة 0");
    expect(screen.getByText("طلبات مستبعدة")).toBeTruthy();
  });

  it("فشل قراءة الكشف يعرض خطأ الصفحة واصطلاح «إعادة المحاولة» نفسه", async () => {
    statement = {
      read: () =>
        Promise.resolve({ ok: false as const, code: "storage_error" as const, message: "فشل مفبرك" }),
    } as unknown as StatementService;
    render(<Harness />);
    await waitFor(() => expect(screen.getByText("تعذر قراءة الكشف")).toBeTruthy());
    expect(screen.getByRole("button", { name: "إعادة المحاولة" })).toBeTruthy();
    expect(screen.queryByText("مقارنة الفترتين")).toBeNull();
  });
});
