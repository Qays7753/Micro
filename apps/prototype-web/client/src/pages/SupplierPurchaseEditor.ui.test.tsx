/** @vitest-environment jsdom */

/** G5-S6 regression: hooks-after-early-return threw React error 310 on the payment/edit
 *  routes once the async purchase load flipped `loading` false. This test mounts the
 *  editor with a deferred list() promise so the loading → loaded transition actually
 *  re-renders the component — the exact path the browser hit in the Group 5 sweep.
 *  It also asserts the honest payment form and a documented payment save. */
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import SupplierPurchaseEditor from "./SupplierPurchaseEditor";
import type { SupplierPurchase } from "@micro-domain/supplier-purchase/index.js";
import type { SupplierPurchaseService } from "@/application/suppliers/supplierPurchaseService";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({ navigate: vi.fn(), location: "/suppliers/purchase/purchase-1/payment" }));

vi.mock("wouter", () => ({
  useSearch: () => "?from=%2Fsuppliers",
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => ({ id: "purchase-1" }),
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);

function storedPurchase(): SupplierPurchase {
  return {
    id: "purchase-1",
    supplierName: "مورد الأقمشة",
    note: "قماش قطني",
    purchasedOn: "2026-09-02",
    dueOn: null,
    totalMinor: 5000,
    paidMinor: 2000,
    payableMinor: 3000,
    status: "partially_paid",
    idempotencyKey: "purchase-key-1",
    payments: [
      { id: "purchase-1:initial", amountMinor: 2000, occurredOn: "2026-09-02", recordedAt: "2026-09-02T09:00:00.000Z", idempotencyKey: "k-initial", note: "دفعة أولى" },
    ],
    paymentReversals: [],
    revisions: [],
    createdAt: "2026-09-02T09:00:00.000Z",
    updatedAt: "2026-09-02T09:00:00.000Z",
  };
}

describe("SupplierPurchaseEditor hook-order regression (G5-S6, React error 310)", () => {
  const recordPayment = vi.fn();
  const list = vi.fn();

  beforeEach(() => {
    wouterMocks.navigate.mockClear();
    recordPayment.mockReset();
    list.mockReset();
    mockedUsePrototypeServices.mockReturnValue({
      supplierPurchases: {
        list,
        recordPayment,
        editPurchase: vi.fn(),
        reversePayment: vi.fn(),
        recordPurchase: vi.fn(),
      } as unknown as SupplierPurchaseService,
      dataVersion: 0,
      notifyDataChanged: vi.fn(),
    } as unknown as ReturnType<typeof usePrototypeServices>);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the payment form across the loading → loaded transition without throwing", async () => {
    let release!: (value: { ok: true; value: SupplierPurchase[] }) => void;
    list.mockReturnValueOnce(
      new Promise(resolve => {
        release = resolve;
      }),
    );
    let renderError: unknown = null;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      render(
        <UnsavedChangesProvider navigate={() => undefined}>
          <SupplierPurchaseEditor />
        </UnsavedChangesProvider>,
      );
      /* first paint: loading state (hooks early-return path) */
      expect(screen.getByText(/جارٍ فتح شراء المورد/)).toBeTruthy();
      /* flip loading false — the transition that used to change the hook count */
      release({ ok: true, value: [storedPurchase()] });
      await waitFor(() => {
        expect(screen.getByRole("heading", { level: 1, name: /دفعة إلى مورد الأقمشة/ })).toBeTruthy();
      });
    } catch (error) {
      renderError = error;
    } finally {
      consoleError.mockRestore();
    }
    expect(renderError).toBeNull();
    const reactErrors = consoleError.mock.calls.filter(call =>
      String(call[0]).includes("310") || String(call[0]).includes("hooks"),
    );
    expect(reactErrors).toHaveLength(0);
  });

  it("records a payment from the loaded payment form and returns to the referrer", async () => {
    list.mockResolvedValueOnce({ ok: true, value: [storedPurchase()] });
    recordPayment.mockResolvedValueOnce({ ok: true, value: storedPurchase() });
    render(
      <UnsavedChangesProvider navigate={() => undefined}>
        <SupplierPurchaseEditor />
      </UnsavedChangesProvider>,
    );
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: /دفعة إلى مورد الأقمشة/ })).toBeTruthy();
    });
    const amount = await screen.findByLabelText(/مبلغ دفعة المورد/);
    await userEvent.type(amount, "10.00");
    const save = await screen.findByRole("button", { name: /حفظ الدفعة/ });
    await userEvent.click(save);
    await waitFor(() => {
      expect(recordPayment).toHaveBeenCalledTimes(1);
      expect(recordPayment.mock.calls[0][0].amountMinor).toBe(1000);
    });
    await waitFor(() => {
      expect(wouterMocks.navigate).toHaveBeenCalledWith("/suppliers");
    });
  });
});
