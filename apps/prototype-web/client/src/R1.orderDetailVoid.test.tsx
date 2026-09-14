/** @vitest-environment jsdom */

/*
 * R1 — فصل صادق في OrderDetail: خطأ القراءة ≠ الطلب غير الموجود.
 * التعاقد: فشل القراءة يعرض «تعذر قراءة الطلب» مع إعادة محاولة تكرر القراءة؛
 * القراءة الناجحة لمعرّف غائب تعرض «الطلب غير متاح محليًا» مع العودة فقط.
 * ولا تعرض أي من الشاشتين رقمًا أو حالة للطلب نفسه.
 */
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import OrderDetail from "@/pages/OrderDetail";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

vi.mock("wouter", () => ({
  useSearch: () => "",
  useLocation: () => ["/orders/order-1", vi.fn()],
  useParams: () => ({ id: "order-1" }),
  Redirect: () => null,
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);

function configureServices({ agreementsGet }: { agreementsGet: ReturnType<typeof vi.fn> }) {
  const never = vi.fn().mockResolvedValue({ ok: true, value: [] });
  mockedUsePrototypeServices.mockReturnValue({
    actualTime: { readPanel: never, readComparison: never },
    agreements: { get: agreementsGet, amendPrice: never, cancel: never },
    agreementContext: { readContext: never },
    fulfillment: { listEvents: never, recordDelivery: never, reverseDelivery: never },
    deliveryReview: { submitReview: never },
    inventory: { readOrderActualMaterialComparison: never },
    drafts: { list: never },
    costEstimates: { get: never },
    collectionReversal: { previewCompoundReversal: never, recordCollectionReversal: never },
    retainedDeposits: { listByOrder: never },
    cashContinuity: { overview: never },
    projectFinance: { listByOrder: never },
    partyLedger: { read: never },
    dataVersion: 0,
    notifyDataChanged: vi.fn(),
  } as unknown as ReturnType<typeof usePrototypeServices>);
}

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
});

describe("R1 OrderDetail: error is not not-found", () => {
  it("a failed read renders the error wording with a retry that repeats the read", async () => {
    const agreementsGet = vi.fn().mockResolvedValue({ ok: false, message: "تخزين" });
    configureServices({ agreementsGet });
    render(<OrderDetail />);
    expect(await screen.findByText("تعذر قراءة الطلب")).toBeTruthy();
    expect(screen.queryByText("الطلب غير متاح محليًا")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "إعادة المحاولة" }));
    await waitFor(() => expect(agreementsGet).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("الطلب غير متاح محليًا")).toBeNull();
  });

  it("a successful read of a missing id renders not-found with return only — no retry, no error wording", async () => {
    const agreementsGet = vi.fn().mockResolvedValue({ ok: true, stored: null });
    configureServices({ agreementsGet });
    render(<OrderDetail />);
    expect(await screen.findByText("الطلب غير متاح محليًا")).toBeTruthy();
    expect(screen.queryByText("تعذر قراءة الطلب")).toBeNull();
    expect(screen.queryByRole("button", { name: "إعادة المحاولة" })).toBeNull();
    expect(agreementsGet).toHaveBeenCalledTimes(1);
  });

  it("the two void screens are distinguishable by their data-void slot", async () => {
    const failed = vi.fn().mockResolvedValue({ ok: false, message: "تخزين" });
    configureServices({ agreementsGet: failed });
    const { container, unmount } = render(<OrderDetail />);
    await screen.findByText("تعذر قراءة الطلب");
    expect(container.querySelector('[data-void="error"]')).toBeTruthy();
    unmount();

    const missing = vi.fn().mockResolvedValue({ ok: true, stored: null });
    configureServices({ agreementsGet: missing });
    const second = render(<OrderDetail />);
    await second.findByText("الطلب غير متاح محليًا");
    expect(second.container.querySelector('[data-void="no-data"]')).toBeTruthy();
  });
});
