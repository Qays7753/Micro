/** @vitest-environment jsdom */

/*
 * R2 (D8) — FinanceActivity: لا بيانات ≠ لا نتائج.
 * التعاقد: السجل الفارغ كليًا (تعداد صامت بلا حدود) يعرض شريحة «لا نشاط
 * مسجّل بعد»؛ والسجل غير الفارغ مع مرشّح يستثني كل الصفوف يعرض «لا نتائج
 * في هذا النطاق» مع إرشاد إزالة المرشّح. كلاهما ليس خطأ.
 */
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import FinanceActivity from "@/pages/FinanceActivity";
import type { ActivityRecord } from "@/application/activity/activityService";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

vi.mock("wouter", () => ({
  useSearch: () => "",
  useLocation: () => ["/finance/activity", vi.fn()],
  useParams: () => ({}),
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);

function record(id: string): ActivityRecord {
  return {
    id,
    family: "sale",
    detail: null,
    occurredOn: "2026-09-15",
    recordedAt: "2026-09-15T10:00:00.000Z",
    amountMinor: 1000,
    quantityMilli: null,
    effect: "cash_in",
    status: "active",
    reversalOfId: null,
    sourceHref: "/sales/direct/" + id,
    sourceStore: "directSales",
  };
}

function configureWithLedger(rows: ActivityRecord[]) {
  const read = vi
    .fn()
    .mockImplementation((input: { from: string | null; to: string | null; limit?: number }) => {
      // unbounded reads see the ledger; the default this_week window filters it out
      const visible = input.from === null && input.to === null ? rows : [];
      return Promise.resolve({
        ok: true,
        value: input.limit === 1 ? rows.slice(0, 1) : visible,
      });
    });
  mockedUsePrototypeServices.mockReturnValue({
    activity: { read },
    dataVersion: 0,
    notifyDataChanged: vi.fn(),
  } as unknown as ReturnType<typeof usePrototypeServices>);
  return read;
}

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
});

describe("R2 FinanceActivity: no-data is not no-results (D8)", () => {
  it("an entirely empty ledger renders the no-data chip and the first-recording guidance", async () => {
    configureWithLedger([]);
    render(<FinanceActivity />);
    expect(await screen.findByText("لا نشاط مسجّل بعد")).toBeTruthy();
    expect(screen.getByText("لم يُسجَّل أي نشاط حتى الآن.")).toBeTruthy();
    expect(screen.queryByText("لا نتائج في هذا النطاق")).toBeNull();
  });

  it("a filtered-out view over a non-empty ledger renders no-results with filter guidance", async () => {
    configureWithLedger([record("a")]);
    render(<FinanceActivity />);
    // default range is this_week over a ledger that has records: no-results is the honest void
    expect(await screen.findByText("لا نتائج في هذا النطاق")).toBeTruthy();
    expect(screen.getByText("لا نشاط يطابق النطاق أو العائلة المختارة.")).toBeTruthy();
    expect(screen.queryByText("لا نشاط مسجّل بعد")).toBeNull();
  });

  it("widening the range to all reveals the recorded rows again", async () => {
    configureWithLedger([record("a")]);
    render(<FinanceActivity />);
    await screen.findByText("لا نتائج في هذا النطاق");
    await userEvent.click(screen.getByRole("button", { name: "منذ البداية" }));
    await waitFor(() => expect(screen.queryByText("لا نتائج في هذا النطاق")).toBeNull());
  });
});
