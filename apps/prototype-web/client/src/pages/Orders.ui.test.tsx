/** @vitest-environment jsdom */

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import Orders from "@/pages/Orders";
import type { OrderDraft, StoredCraftOrder } from "@/storage/local/types";
import type { DirectSale } from "@micro-domain/direct-sale/index.js";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = { navigate: vi.fn() };

vi.mock("wouter", () => ({
  useSearch: () => "",
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
      schedules: {
        overview: vi.fn().mockResolvedValue({
          ok: true,
          value: {
            overdue: [],
            today: [],
            upcoming: [],
            week: [],
            dailyCapacityMinutes: null,
            completedOrClosed: 0,
          },
        }),
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
      schedules: {
        overview: vi.fn().mockResolvedValue({
          ok: true,
          value: {
            overdue: [],
            today: [],
            upcoming: [],
            week: [],
            dailyCapacityMinutes: null,
            completedOrClosed: 0,
          },
        }),
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

  it("shows a cost-unknown direct sale beside orders with a compact row (profit deferred to the detail screen)", async () => {
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
      schedules: {
        overview: vi.fn().mockResolvedValue({
          ok: true,
          value: {
            overdue: [],
            today: [],
            upcoming: [],
            week: [],
            dailyCapacityMinutes: null,
            completedOrClosed: 0,
          },
        }),
      },
      dataVersion: 0,
    } as unknown as ReturnType<typeof usePrototypeServices>);

    render(<Orders />);

    await waitFor(() => expect(screen.getByText("كوب جاهز")).toBeTruthy());
    expect(screen.getByText("طاولة اختبار")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "مبيعاتي" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "طلباتي" })).toBeTruthy();
    /* المجموعة ١ (§8.2): الربح ومراجعات السعر خلف شاشة التفصيل — الصف مختصر. */
    expect(screen.queryByText(/الربح/)).toBeNull();
    expect(screen.queryByText(/خـفّض السعر/)).toBeNull();
  });

  it("opens a saved direct sale from My Sales", async () => {
    mockedUsePrototypeServices.mockReturnValue({
      dailyFollowUp: {
        read: vi.fn().mockResolvedValue({ ok: true, drafts: [], orders: [], followUp: emptyFollowUp }),
      },
      directSales: {
        list: vi.fn().mockResolvedValue({ ok: true, value: [savedSale("sale-open")] }),
      },
      schedules: {
        overview: vi.fn().mockResolvedValue({
          ok: true,
          value: {
            overdue: [],
            today: [],
            upcoming: [],
            week: [],
            dailyCapacityMinutes: null,
            completedOrClosed: 0,
          },
        }),
      },
      dataVersion: 0,
    } as unknown as ReturnType<typeof usePrototypeServices>);

    render(<Orders />);

    const sale = await screen.findByRole("button", { name: "فتح بيع كوب جاهز" });
    fireEvent.click(sale);
    /* المجموعة ١ (Scope A): الرابط يحفظ مصدره — الرجوع من المحرر يعود إلى «العمل». */
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/direct-sales/sale-open?returnTo=%2Forders");
  });

  it("keeps the appointments section permanent with an honest empty state (F-070)", async () => {
    mockedUsePrototypeServices.mockReturnValue({
      dailyFollowUp: {
        read: vi.fn().mockResolvedValue({
          ok: true,
          drafts: [],
          orders: [savedOrder("order-schedule")],
          followUp: { ...emptyFollowUp, kind: "active_order", truth: "طلب محفوظ." },
        }),
      },
      directSales: {
        list: vi.fn().mockResolvedValue({ ok: true, value: [] }),
      },
      schedules: {
        overview: vi.fn().mockResolvedValue({
          ok: true,
          value: {
            overdue: [],
            today: [],
            upcoming: [],
            week: [],
            dailyCapacityMinutes: null,
            completedOrClosed: 0,
          },
        }),
      },
      dataVersion: 0,
    } as unknown as ReturnType<typeof usePrototypeServices>);

    render(<Orders />);

    expect(await screen.findByRole("heading", { name: "المواعيد" })).toBeTruthy();
    expect(screen.getByText(/لا مواعيد بعد/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /افتح جدول المواعيد/ })).toBeTruthy();
  });

  it("lists an upcoming appointment with its own road into the editor (F-070)", async () => {
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
      schedules: {
        overview: vi.fn().mockResolvedValue({
          ok: true,
          value: {
            overdue: [],
            today: [],
            upcoming: [
              {
                schedule: {
                  id: "schedule-1",
                  scheduledFor: "2026-09-01",
                  scheduledTime: "16:00",
                  status: "scheduled",
                },
                order: savedOrder("order-schedule"),
                bucket: "upcoming" as const,
              },
            ],
            week: [],
            dailyCapacityMinutes: null,
            completedOrClosed: 0,
          },
        }),
      },
      dataVersion: 0,
    } as unknown as ReturnType<typeof usePrototypeServices>);

    render(<Orders />);

    const appointment = await screen.findByRole("button", { name: /طاولة اختبار/ });
    fireEvent.click(appointment);
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/schedule/schedule-1?returnTo=%2Forders");
  });

  /* المجموعة ١ (§8.1): «الأولوية الآن» دائمًا حتى بلا سجلات — بصدق لا بفبركة. */
  it("renders the priority block even with no orders, sales, or drafts", async () => {
    render(<Orders />);
    expect(await screen.findByText("الأولوية الآن")).toBeTruthy();
    expect(screen.getByText(/لا شيء مستعجل الآن/)).toBeTruthy();
  });

  it("offers the direct-sale secondary CTA and the first-sale empty action", async () => {
    render(<Orders />);
    const cta = await screen.findByRole("button", { name: /تسجيل بيع مباشر/ });
    fireEvent.click(cta);
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/direct-sales/new?returnTo=%2Forders");
    const firstSale = screen.getByRole("button", { name: /سجّل أول بيع/ });
    expect(firstSale).toBeTruthy();
  });

  /* ── Z2.0 — عقود وضوح قائمة العمل (§3.3/§6): المرحلة والمؤهل المرحلي
   * والفعل التالي في كل صف قابل للفعل؛ المسلّم يتأهل بلحظة التسليم لا
   * بموعد مستحق مضى؛ صفوف التحصيل تعلن المتبقي؛ ومسودة تسمّي ناقصها
   * الملموس (وصف/تكلفة/اتفاق) لا عبارة عامة. ── */

  function workOrder(
    id: string,
    overrides: {
      status?: string;
      settlementStatus?: string;
      receivableMinor?: number;
      collectedMinor?: number;
      nextAction?: string;
      itemName?: string;
      deliveredAt?: string | null;
    },
  ): StoredCraftOrder {
    return {
      id,
      catalogItemId: null,
      deliveryDate: "2026-08-30",
      agreementSource: null,
      createdAt: "2026-08-29T08:00:00.000Z",
      updatedAt: "2026-08-29T08:00:00.000Z",
      order: {
        ...(savedOrder(id).order as object),
        itemName: overrides.itemName ?? "طاولة اختبار",
        status: overrides.status ?? "provisional_agreement",
        settlementStatus: overrides.settlementStatus ?? "unpaid",
        receivableMinor: overrides.receivableMinor ?? 10000,
        collectedMinor: overrides.collectedMinor ?? 0,
        nextAction: overrides.nextAction ?? "راجع السعر",
        events: overrides.deliveredAt
          ? [
              {
                id: `${id}:delivered`,
                type: "status_changed",
                toStatus: "delivered",
                createdAt: overrides.deliveredAt,
              },
            ]
          : [],
      },
    } as StoredCraftOrder;
  }

  function workingDraft(
    id: string,
    overrides: { itemName?: string; specifications?: string; hasCost?: boolean },
  ): OrderDraft {
    return {
      id,
      intent: "customer_order",
      customerName: "سارة",
      orderName: null,
      itemName: overrides.itemName ?? "رف خشبي",
      catalogItemId: null,
      specifications: overrides.specifications ?? "مقاس كبير",
      quantity: 1,
      costSnapshots: overrides.hasCost ? ([{}] as unknown as OrderDraft["costSnapshots"]) : [],
      activeCostSnapshotId: overrides.hasCost ? `${id}-cost` : null,
      linkedOrderId: null,
      createdAt: "2026-08-29T08:00:00.000Z",
      updatedAt: "2026-08-29T08:00:00.000Z",
    } as OrderDraft;
  }

  function mockWorkState(orders: readonly StoredCraftOrder[], drafts: readonly OrderDraft[]) {
    mockedUsePrototypeServices.mockReturnValue({
      dailyFollowUp: {
        read: vi.fn().mockResolvedValue({
          ok: true,
          drafts,
          orders,
          followUp: {
            kind: "active_order",
            title: "طلب محفوظ",
            truth: "طلب محفوظ.",
            nextAction: "راجع السعر",
            href: "/orders/order-1",
            actionLabel: "فتح الطلب",
          },
        }),
      },
      directSales: {
        list: vi.fn().mockResolvedValue({ ok: true, value: [] }),
      },
      schedules: {
        overview: vi.fn().mockResolvedValue({
          ok: true,
          value: {
            overdue: [],
            today: [],
            upcoming: [],
            week: [],
            dailyCapacityMinutes: null,
            completedOrClosed: 0,
          },
        }),
      },
      dataVersion: 0,
    } as unknown as ReturnType<typeof usePrototypeServices>);
  }

  const groupRow = async (groupTitle: string, itemName: string) => {
    const heading = await screen.findByText(groupTitle);
    const group = heading.parentElement;
    expect(group).toBeTruthy();
    const row = group?.querySelector("button.micro-draft-row");
    expect(row).toBeTruthy();
    expect(row?.textContent).toContain(itemName);
    return row?.textContent ?? "";
  };

  it("Z2.0: every actionable group row exposes a non-empty stage label and next action", async () => {
    mockWorkState(
      [
        workOrder("order-exec", {
          status: "in_progress",
          itemName: "مجسم جبس",
          nextAction: "سجّل الجاهزية أو سبب التأجيل",
        }),
        workOrder("order-wait", {
          status: "provisional_agreement",
          itemName: "إطار صور",
          nextAction: "أكد السعر والموعد",
        }),
        workOrder("order-debt", {
          status: "delivered",
          settlementStatus: "debt",
          receivableMinor: 4000,
          collectedMinor: 6000,
          itemName: "لوحة زيتية",
          nextAction: "تابع تحصيل الدين",
        }),
        workOrder("order-done", {
          status: "settled",
          settlementStatus: "paid",
          receivableMinor: 0,
          collectedMinor: 10000,
          itemName: "خاتم فضة",
          nextAction: "راجع النتيجة والخطوة التالية",
        }),
      ],
      [],
    );
    render(<Orders />);

    const executingRow = await groupRow("يحتاج تنفيذًا الآن", "مجسم جبس");
    expect(executingRow).toContain("قيد التنفيذ");
    expect(executingRow).toMatch(/الخطوة التالية: ?\S/);

    const waitingRow = await groupRow("ينتظر العميل", "إطار صور");
    expect(waitingRow).toContain("اتفاق محفوظ");
    expect(waitingRow).toMatch(/الخطوة التالية: ?\S/);

    const collectionRow = await groupRow("ينتظر تحصيلًا", "لوحة زيتية");
    expect(collectionRow).toContain("تم التسليم");
    expect(collectionRow).toMatch(/الخطوة التالية: ?\S/);
    expect(collectionRow).toContain("تابع تحصيل الدين");

    const deliveredRow = await groupRow("تم تسليمه", "خاتم فضة");
    expect(deliveredRow).toContain("مغلق");
    expect(deliveredRow).toMatch(/الخطوة التالية: ?\S/);
    expect(deliveredRow).toContain("راجع النتيجة والخطوة التالية");
  });

  it("Z2.0: delivered rows qualify with the delivery moment, never a stale due date", async () => {
    mockWorkState(
      [
        workOrder("order-done", {
          status: "settled",
          settlementStatus: "paid",
          receivableMinor: 0,
          collectedMinor: 10000,
          itemName: "خاتم فضة",
          nextAction: "راجع النتيجة والخطوة التالية",
          deliveredAt: "2026-09-01T12:00:00.000Z",
        }),
      ],
      [],
    );
    render(<Orders />);

    const deliveredRow = await groupRow("تم تسليمه", "خاتم فضة");
    expect(deliveredRow).toContain("سُلّم في");
    expect(deliveredRow).not.toContain("موعد التسليم");
  });

  it("Z2.0: awaiting-collection rows keep the remaining-amount line beside the delivery moment", async () => {
    mockWorkState(
      [
        workOrder("order-debt", {
          status: "delivered",
          settlementStatus: "debt",
          receivableMinor: 4000,
          collectedMinor: 6000,
          itemName: "لوحة زيتية",
          nextAction: "تابع تحصيل الدين",
          deliveredAt: "2026-09-01T12:00:00.000Z",
        }),
      ],
      [],
    );
    render(<Orders />);

    const collectionRow = await groupRow("ينتظر تحصيلًا", "لوحة زيتية");
    expect(collectionRow).toContain("دين مسجل (د.أ):");
    expect(collectionRow).toContain("سُلّم في");
    expect(collectionRow).not.toContain("موعد التسليم");
  });

  it("Z2.0: draft rows name their concrete missing step, not the generic prompt alone", async () => {
    mockWorkState(
      [],
      [
        workingDraft("draft-no-name", { itemName: "", hasCost: false }),
        workingDraft("draft-no-cost", { itemName: "رف خشبي", hasCost: false }),
        workingDraft("draft-ready", { itemName: "صندوق خشبي", hasCost: true }),
      ],
    );
    render(<Orders />);

    const noNameRow = await screen.findByRole("button", { name: /مسودة تحتاج وصفًا/ });
    expect(noNameRow.textContent).toMatch(/الخطوة التالية: ?\S/);
    expect(noNameRow.textContent).toContain("وصف القطعة");
    expect(noNameRow.textContent).not.toContain("أكمل ما تعرفه الآن");

    const noCostRow = screen.getByRole("button", { name: /رف خشبي/ });
    expect(noCostRow.textContent).toMatch(/الخطوة التالية: ?\S/);
    expect(noCostRow.textContent).toContain("التكلفة");
    expect(noCostRow.textContent).not.toContain("أكمل ما تعرفه الآن");

    const readyRow = screen.getByRole("button", { name: /صندوق خشبي/ });
    expect(readyRow.textContent).toMatch(/الخطوة التالية: ?\S/);
    expect(readyRow.textContent).toContain("الاتفاق");
    expect(readyRow.textContent).not.toContain("أكمل ما تعرفه الآن");
  });
});
