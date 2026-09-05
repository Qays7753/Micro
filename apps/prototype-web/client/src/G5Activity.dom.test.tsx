/** @vitest-environment jsdom */

/* المجموعة ٥ (عقد ٣٠ — اختبار سطح القارئ): الصفحة تعرض صفوف العائلات بأثرها
 * ومصدرها، والتصفية بالعائلة فعل عرض، والفراغ يعلّم الخطوة التالية — كل ذلك
 * بخدمات حقيقية فوق MemoryLocalStore (نمط B). */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { createFinancialEvent } from "@micro-domain/financial-event/index.js";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { ActivityService } from "@/application/activity/activityService";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import FinanceActivity from "@/pages/FinanceActivity";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: "",
}));
vi.mock("wouter", () => ({
  useLocation: () => ["/finance/activity", wouterMocks.navigate],
  useSearch: () => wouterMocks.search,
  useParams: () => ({}),
  useReturnPath: () => "/finance",
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-09-05T09:00:00.000Z";

let store: MemoryLocalStore;
const contextRef: { current: Record<string, unknown> } = { current: {} };

function Harness() {
  const [version, setVersion] = React.useState(0);
  contextRef.current = {
    activity: new ActivityService(store),
    dataVersion: version,
    notifyDataChanged: () => setVersion(current => current + 1),
  };
  return (
    <UnsavedChangesProvider navigate={wouterMocks.navigate}>
      <FinanceActivity />
    </UnsavedChangesProvider>
  );
}

beforeEach(() => {
  store = new MemoryLocalStore();
  wouterMocks.navigate.mockReset();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function seedExpense() {
  const saved = await store.saveFinancialEvent(
    createFinancialEvent({
      id: "dom-exp-1",
      type: "operating_expense_cash",
      amountMinor: 1500,
      occurredOn: "2026-09-01",
      recordedAt: "2026-09-01T08:00:00.000Z",
      idempotencyKey: "dom-exp-1",
      note: "بنزين",
      counterparty: null,
    }),
  );
  if (!saved.ok) throw new Error(saved.message);
}

describe("FinanceActivity reader surface (المجموعة ٥ — عقد ٣٠)", () => {
  it("renders family rows with effect word, amount, and deep link", async () => {
    await seedExpense();
    mockedUsePrototypeServices.mockImplementation(
      () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
    );
    render(<Harness />);
    /* «مصروف» يطابق زر التصفية وصف القائمة معًا — صف القائمة هو القوي داخل مقال. */
    await screen.findByText("بنزين");
    const row = screen.getAllByText("مصروف").find(element => element.closest("article")) ?? null;
    expect(row).toBeTruthy();
    expect(screen.getByText("نقدي خارج")).toBeTruthy();
    expect(screen.getByText("15.00")).toBeTruthy();
    /* رابط المصدر موجود على زر الصف. */
    expect(wouterMocks.navigate).not.toHaveBeenCalled();
    if (row === null) throw new Error("activity row missing");
    fireEvent.click(row.closest("button")!);
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalled());
    expect(wouterMocks.navigate.mock.calls[0]?.[0]).toContain("/finance?event=");
  });

  it("empty state teaches the next action — no invented rows", async () => {
    mockedUsePrototypeServices.mockImplementation(
      () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
    );
    render(<Harness />);
    const empty = await screen.findByText(/أول تسجيل من زر «سجّل»/);
    expect(empty).toBeTruthy();
  });

  it("family filter narrows the list as a display-only action", async () => {
    await seedExpense();
    mockedUsePrototypeServices.mockImplementation(
      () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
    );
    render(<Harness />);
    await screen.findByText("بنزين");
    /* تصفية بقروض: تختفي مصاريف هذا النطاق ويعرض الفراغ الهادئ. */
    fireEvent.click(screen.getByRole("button", { name: "قرض" }));
    await waitFor(() => {
      expect(screen.queryByText("بنزين")).toBeNull();
    });
  });
});
