/** @vitest-environment jsdom */

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import DraftEditor from "@/pages/DraftEditor";
import NewDraft from "@/pages/NewDraft";
import type { OrderDraft } from "@/storage/local/types";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({ location: "/orders/new", navigate: vi.fn() }));

vi.mock("wouter", () => ({
  /* و٥-ب (مجموعة ٣): المحاكاة أمينة — الاستعلام من useSearch كما في المتصفح الحقيقي. */
  useSearch: () => {
    const query = wouterMocks.location.split("?")[1] ?? "";
    return query ? `?${query}` : "";
  },
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => ({
    id: (wouterMocks.location.split("/")[3] ?? "new").split("?")[0],
  }),
  /* F-003: محاكاة Redirect الحقيقية — استبدال لا إضافة في التاريخ. */
  Redirect: ({ to }: { to: string }) => {
    void wouterMocks.navigate(to, { replace: true });
    return null;
  },
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);

function draftWithId(id: string, overrides: Partial<OrderDraft> = {}): { ok: true; draft: OrderDraft } {
  const nowIso = "2026-08-30T00:00:00.000Z";
  return {
    ok: true,
    draft: {
      id,
      intent: "customer_order",
      customerName: "",
      itemName: "",
      catalogItemId: null,
      specifications: "",
      quantity: 1,
      costSnapshots: [],
      activeCostSnapshotId: null,
      linkedOrderId: null,
      createdAt: nowIso,
      updatedAt: nowIso,
      ...overrides,
    },
  };
}

/* و٥ (§٥-١): النية تفتح المحرر الفارغ — لا إنشاء عند النقر إطلاقًا. */
describe("intent choice opens the editor without creating a record (U-06, §٥-١)", () => {
  const create = vi.fn();

  beforeEach(() => {
    create.mockReset();
    wouterMocks.navigate.mockReset();
    mockedUsePrototypeServices.mockReturnValue({
      drafts: { create },
      catalog: { list: vi.fn().mockResolvedValue({ ok: true, items: [] }) },
      notifyDataChanged: vi.fn(),
    } as unknown as ReturnType<typeof usePrototypeServices>);
  });

  afterEach(() => {
    cleanup();
    wouterMocks.location = "/orders/new";
  });

  it("the legacy /orders/new deep link now redirects straight to the primary FAB customer-order editor (F-003)", async () => {
    wouterMocks.location = "/orders/new";
    render(<NewDraft />);
    await waitFor(() =>
      expect(wouterMocks.navigate).toHaveBeenCalledWith("/orders/draft/new?intent=customer_order", {
        replace: true,
      }),
    );
    expect(create).not.toHaveBeenCalled();
  });

  it("the legacy /orders/new deep link preserves an explicit planned-design intent (F-003)", async () => {
    wouterMocks.location = "/orders/new?intent=planned_design";
    render(<NewDraft />);
    await waitFor(() =>
      expect(wouterMocks.navigate).toHaveBeenCalledWith("/orders/draft/new?intent=planned_design", {
        replace: true,
      }),
    );
    expect(create).not.toHaveBeenCalled();
  });
});

describe("the empty intent editor creates the draft only on first real input (U-06, §٥-١)", () => {
  const create = vi.fn();
  const save = vi.fn();

  function renderEditor() {
    render(
      <UnsavedChangesProvider navigate={wouterMocks.navigate}>
        <DraftEditor />
      </UnsavedChangesProvider>,
    );
  }

  beforeEach(() => {
    create.mockReset();
    save.mockReset();
    wouterMocks.navigate.mockReset();
    mockedUsePrototypeServices.mockReturnValue({
      drafts: { create, save },
      catalog: { list: vi.fn().mockResolvedValue({ ok: true, items: [] }) },
      notifyDataChanged: vi.fn(),
    } as unknown as ReturnType<typeof usePrototypeServices>);
  });

  afterEach(() => {
    cleanup();
    wouterMocks.location = "/orders/draft/new?intent=customer_order";
  });

  it("renders the empty editor with no record behind it", async () => {
    wouterMocks.location = "/orders/draft/new?intent=customer_order";
    renderEditor();
    await waitFor(() => expect(screen.getByRole("heading", { name: "طلب من عميل" })).toBeTruthy());
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(create).not.toHaveBeenCalled();
  });

  it("creates the draft when the first real input arrives, and not before", async () => {
    wouterMocks.location = "/orders/draft/new?intent=customer_order";
    create.mockResolvedValueOnce(draftWithId("draft-9", { itemName: "ص" }));
    renderEditor();
    const itemField = await screen.findByPlaceholderText("مثال: صندوق خشبي مخصص");
    await userEvent.type(itemField, "ص");
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create).toHaveBeenCalledWith("customer_order", {
      itemName: "ص",
      customerName: "",
      catalogItemId: null,
      specifications: "",
      quantity: 1,
      /* U-004: رابط التقدير المصدر يمر مع الإنشاء — فارغ عند البدء اليدوي. */
      sourceEstimateId: null,
    });
  });

  it("refuses to persist an empty draft from the save button", async () => {
    wouterMocks.location = "/orders/draft/new?intent=customer_order";
    renderEditor();
    const saveButton = await screen.findByRole("button", { name: "حفظ مسودة" });
    await userEvent.click(saveButton);
    await waitFor(() => expect(screen.getByText("لم تدخل بيانات بعد؛ لا تُحفظ مسودة فارغة.")).toBeTruthy());
    expect(create).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it("keeps typing after creation: continue-and-save uses the materialized id and its version token", async () => {
    wouterMocks.location = "/orders/draft/new?intent=customer_order";
    create.mockResolvedValueOnce(draftWithId("draft-10", { itemName: "صندوق" }));
    save.mockImplementationOnce(async (input: { id: string; itemName: string }) =>
      draftWithId(input.id, { itemName: input.itemName }),
    );
    renderEditor();
    const itemField = await screen.findByPlaceholderText("مثال: صندوق خشبي مخصص");
    await userEvent.type(itemField, "صندوق خشبي");
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    const saveButton = await screen.findByRole("button", { name: "حفظ مسودة" });
    await userEvent.click(saveButton);
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({ id: "draft-10", itemName: "صندوق خشبي" }),
        "2026-08-30T00:00:00.000Z",
      ),
    );
  });

  it("hides the delete zone while no record exists", async () => {
    wouterMocks.location = "/orders/draft/new?intent=customer_order";
    renderEditor();
    await screen.findByPlaceholderText("مثال: صندوق خشبي مخصص");
    expect(screen.queryByRole("button", { name: /احذف المسودة/ })).toBeNull();
  });
});
