/** @vitest-environment jsdom */

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import Orders from "@/pages/Orders";
import type { StoredCraftOrder } from "@/storage/local/types";
import type { DirectSale } from "@micro-domain/direct-sale/index.js";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = { navigate: vi.fn() };

vi.mock("wouter", () => ({
  useLocation: () => ["/orders", wouterMocks.navigate],
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);

const emptyFollowUp = {
  kind: "empty" as const,
  title: "لا توجد طلبات بعد",
  truth: "لم تحفظ طلبًا أو مسودة محلية حتى الآن.",
  nextAction: "ابدأ بطلب واحد من عميل تعرف قصته.",
  href: "/orders/new",
  actionLabel: "بدء طلب",
};

function savedOrder(id: string): StoredCraftOrder {
  return {
    id,
    catalogItemId: null,
    deliveryDate: "2026-08-30",
    agreementSource: null,
    createdAt: "2026-08-29T08:00:00.000Z",
    updatedAt: "2026-08-29T08:00:00.000Z",
    order: {
      id,
      itemName: "طاولة اختبار",
      customerName: "عميل اختبار",
      specifications: "مواصفة اختبار",
      quantity: 1,
      agreedPriceMinor: 10000,
      status: "provisional_agreement",
      settlementStatus: "unpaid",
      receivableMinor: 10000,
      collectedMinor: 0,
      nextAction: "راجع السعر",
    },
  } as StoredCraftOrder;
}

function savedSale(id: string): DirectSale {
  return {
    id,
    itemName: "كوب جاهز",
    quantity: 2,
    currency: "JOD",
    revenueMinor: 1200,
    collectedMinor: 1200,
    costMinor: null,
    profitMinor: null,
    occurredOn: "2026-08-29",
    recordedAt: "2026-08-29T09:00:00.000Z",
    note: "بيع مباشر",
    idempotencyKey: "sale-ui-1",
  };
}

describe("Work destination", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    wouterMocks.navigate.mockReset();
    mockedUsePrototypeServices.mockReturnValue({
      dailyFollowUp: {
        read: vi.fn().mockResolvedValue({
          ok: true,
          drafts: [],
          orders: [],
          followUp: emptyFollowUp,
        }),
      },
      directSales: {
        list: vi.fn().mockResolvedValue({ ok: true, value: [] }),
      },
      dataVersion: 0,
    } as unknown as ReturnType<typeof usePrototypeServices>);
  });

  it("keeps direct sales visible without showing an empty orders section", async () => {
    render(<Orders />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "العمل" })).toBeTruthy());
    expect(screen.getByRole("heading", { name: "مبيعاتي" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "طلباتي" })).toBeNull();
    expect(screen.queryByText("لا توجد طلبات بعد")).toBeNull();
  });

  it("adds the saved orders section after the first order without changing the destination", async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, drafts: [], orders: [], followUp: emptyFollowUp })
      .mockResolvedValueOnce({
        ok: true,
        drafts: [],
        orders: [savedOrder("order-1")],
        followUp: {
          ...emptyFollowUp,
          kind: "active_order" as const,
          title: "طاولة اختبار",
          truth: "طلب محفوظ.",
          nextAction: "راجع السعر",
          href: "/orders/order-1",
          actionLabel: "فتح الطلب",
        },
      });
    mockedUsePrototypeServices.mockReturnValue({
      dailyFollowUp: { read },
      directSales: {
        list: vi.fn().mockResolvedValue({ ok: true, value: [] }),
      },
      dataVersion: 0,
    } as unknown as ReturnType<typeof usePrototypeServices>);

    const view = render(<Orders key="inside-out" />);
    await waitFor(() => expect(screen.queryByRole("heading", { name: "طلباتي" })).toBeNull());
    expect(screen.getByRole("heading", { name: "مبيعاتي" })).toBeTruthy();

    view.rerender(<Orders key="hybrid" />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "طلباتي" })).toBeTruthy());
    expect(screen.getByRole("heading", { name: "العمل" })).toBeTruthy();
    expect(screen.getByText("طاولة اختبار")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "مبيعاتي" })).toBeTruthy();
  });

  it("shows a cost-unknown direct sale beside orders with unavailable profit", async () => {
    mockedUsePrototypeServices.mockReturnValue({
      dailyFollowUp: {
        read: vi.fn().mockResolvedValue({
          ok: true,
          drafts: [],
          orders: [savedOrder("order-hybrid")],
          followUp: { ...emptyFollowUp, kind: "active_order", truth: "طلب محفوظ." },
        }),
      },
      directSales: {
        list: vi.fn().mockResolvedValue({ ok: true, value: [savedSale("sale-hybrid")] }),
      },
      dataVersion: 0,
    } as unknown as ReturnType<typeof usePrototypeServices>);

    render(<Orders />);

    await waitFor(() => expect(screen.getByText("كوب جاهز")).toBeTruthy());
    expect(screen.getByText("طاولة اختبار")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "مبيعاتي" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "طلباتي" })).toBeTruthy();
    expect(screen.getByText("غير متاح")).toBeTruthy();
  });

  it("opens a saved direct sale from My Sales", async () => {
    mockedUsePrototypeServices.mockReturnValue({
      dailyFollowUp: {
        read: vi.fn().mockResolvedValue({ ok: true, drafts: [], orders: [], followUp: emptyFollowUp }),
      },
      directSales: {
        list: vi.fn().mockResolvedValue({ ok: true, value: [savedSale("sale-open")] }),
      },
      dataVersion: 0,
    } as unknown as ReturnType<typeof usePrototypeServices>);

    render(<Orders />);

    const sale = await screen.findByRole("button", { name: "فتح بيع كوب جاهز" });
    fireEvent.click(sale);
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/direct-sales/sale-open");
  });
});
