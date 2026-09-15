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

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/suppliers/purchase/purchase-1/payment",
}));

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
      {
        id: "purchase-1:initial",
        amountMinor: 2000,
        occurredOn: "2026-09-02",
        recordedAt: "2026-09-02T09:00:00.000Z",
        idempotencyKey: "k-initial",
        note: "دفعة أولى",
      },
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
      /* كعب خدمة المسودة — قراءة فارغة وحفظ ناجح؛ الصفحة تُختبر لا المخزن. */
      formDrafts: {
        read: vi.fn().mockResolvedValue({ ok: true, value: null }),
        save: vi.fn().mockResolvedValue({ ok: true, value: { updatedAt: "2026-09-04T12:00:00.000Z" } }),
        discard: vi.fn().mockResolvedValue({ ok: true, value: null }),
      },
      supplierPurchases: {
        list,
        recordPayment,
        editPurchase: vi.fn(),
        reversePayment: vi.fn(),
        recordPurchase: vi.fn(),
      } as unknown as SupplierPurchaseService,
      /* FIN-003: المحافظ لمصدر الدفعة — كعب فارغ يكفي لرحلة الانحدار هذه. */
      cashContinuity: {
        overview: vi.fn().mockResolvedValue({ ok: true, value: { wallets: [] } }),
      },
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
    const reactErrors = consoleError.mock.calls.filter(
      call => String(call[0]).includes("310") || String(call[0]).includes("hooks"),
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

/* FIN-003 (قرار المالك المعتمد ٢٠٢٦-٠٩-١٦): قواعد مصدر الصرف في دفعة المورد —
 * محفظة واحدة تُعيَّن مسبقًا بشكل مرئي، ومحافظ متعددة تُلزم باختيار صريح
 * (محفظة أو الكاش غير الموزع)، والمصدر المختار يصل الخدمة كما هو. */
describe("SupplierPurchaseEditor payment source rules (FIN-003)", () => {
  const recordPaymentWallet = vi.fn();
  const listWallet = vi.fn();

  function mockServices(wallets: readonly { id: string; name: string }[]) {
    mockedUsePrototypeServices.mockReturnValue({
      formDrafts: {
        read: vi.fn().mockResolvedValue({ ok: true, value: null }),
        save: vi.fn().mockResolvedValue({ ok: true, value: { updatedAt: "2026-09-16T12:00:00.000Z" } }),
        discard: vi.fn().mockResolvedValue({ ok: true, value: null }),
      },
      supplierPurchases: {
        list: listWallet,
        recordPayment: recordPaymentWallet,
        editPurchase: vi.fn(),
        reversePayment: vi.fn(),
        recordPurchase: vi.fn(),
      } as unknown as SupplierPurchaseService,
      cashContinuity: {
        overview: vi.fn().mockResolvedValue({ ok: true, value: { wallets } }),
      },
      dataVersion: 0,
      notifyDataChanged: vi.fn(),
    } as unknown as ReturnType<typeof usePrototypeServices>);
  }

  beforeEach(() => {
    wouterMocks.navigate.mockClear();
    /* تنفيذ مستمر (لا Once): الحفظ الناجح يعيد شراءً محدّثًا، والعدّ في
     * الاختبار نفسه يتحقق من نداء واحد لا أكثر. */
    recordPaymentWallet.mockReset();
    recordPaymentWallet.mockImplementation(async () => ({ ok: true, value: storedPurchase() }));
    listWallet.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("preselects the single wallet visibly and passes it to the service", async () => {
    mockServices([{ id: "drawer", name: "درج-FIN003" }]);
    listWallet.mockResolvedValueOnce({ ok: true, value: [storedPurchase()] });
    render(
      <UnsavedChangesProvider navigate={() => undefined}>
        <SupplierPurchaseEditor />
      </UnsavedChangesProvider>,
    );
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: /دفعة إلى مورد الأقمشة/ })).toBeTruthy();
    });
    const selector = await screen.findByLabelText(/مصدر صرف دفعة المورد/);
    expect((selector as HTMLSelectElement).value).toBe("drawer");
    expect(screen.getByText("درج-FIN003 — تغطية من رصيدها")).toBeTruthy();
    /* الكاش غير الموزع خيار صريح إلى جانب المحفظة المعيَّنة. */
    expect(screen.getByText("الكاش غير الموزع")).toBeTruthy();
    await userEvent.type(screen.getByLabelText(/مبلغ دفعة المورد/), "10.00");
    await userEvent.click(screen.getByRole("button", { name: /حفظ الدفعة/ }));
    await waitFor(() => {
      expect(recordPaymentWallet).toHaveBeenCalledTimes(1);
      expect(recordPaymentWallet.mock.calls[0][0].walletId).toBe("drawer");
    });
  });

  it("requires an explicit choice when multiple wallets exist", async () => {
    mockServices([
      { id: "drawer", name: "درج-FIN003" },
      { id: "bank", name: "بنك-FIN003" },
    ]);
    listWallet.mockResolvedValueOnce({ ok: true, value: [storedPurchase()] });
    render(
      <UnsavedChangesProvider navigate={() => undefined}>
        <SupplierPurchaseEditor />
      </UnsavedChangesProvider>,
    );
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: /دفعة إلى مورد الأقمشة/ })).toBeTruthy();
    });
    const selector = await screen.findByLabelText(/مصدر صرف دفعة المورد/);
    expect((selector as HTMLSelectElement).value).toBe("__unset__");
    expect(screen.getByText("اختر مصدر الصرف")).toBeTruthy();
    /* المحاولة بلا اختيار تُرفض برسالة صريحة ولا تستدعي الخدمة. */
    await userEvent.type(screen.getByLabelText(/مبلغ دفعة المورد/), "10.00");
    await userEvent.click(screen.getByRole("button", { name: /حفظ الدفعة/ }));
    expect(await screen.findByText(/اختر مصدر الصرف لهذه الدفعة/)).toBeTruthy();
    expect(recordPaymentWallet).not.toHaveBeenCalled();
    /* اختيار غير الموزع صراحةً يمر كما هو. */
    await userEvent.selectOptions(selector, "");
    await userEvent.click(screen.getByRole("button", { name: /حفظ الدفعة/ }));
    await waitFor(() => {
      expect(recordPaymentWallet).toHaveBeenCalledTimes(1);
      expect(recordPaymentWallet.mock.calls[0][0].walletId).toBeNull();
    });
  });

  it("explains the unallocated fallback before saving when no wallet exists", async () => {
    mockServices([]);
    listWallet.mockResolvedValueOnce({ ok: true, value: [storedPurchase()] });
    render(
      <UnsavedChangesProvider navigate={() => undefined}>
        <SupplierPurchaseEditor />
      </UnsavedChangesProvider>,
    );
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: /دفعة إلى مورد الأقمشة/ })).toBeTruthy();
    });
    expect(
      await screen.findByText(/ستُسجَّل الدفعة من الكاش غير الموزع، ويمكن تغطيتها من محفظة لاحقًا/),
    ).toBeTruthy();
    expect(screen.queryByLabelText(/مصدر صرف دفعة المورد/)).toBeNull();
  });
});
