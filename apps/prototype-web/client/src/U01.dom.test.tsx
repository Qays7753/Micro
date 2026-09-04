/** @vitest-environment jsdom */

import React, { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import {
  UnsavedChangesProvider,
  useUnsavedChangesGuard,
  useUnsavedChangesNavigation,
} from "@/components/forms/UnsavedChangesGuard";
import { EnglishQuantityInput } from "@/components/forms/EnglishQuantityInput";
import { MoneyValue } from "@/components/presentation/DisplayValue";
import CostEditor from "@/pages/CostEditor";
import type { OrderDraft } from "@/storage/local/types";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

vi.mock("wouter", () => ({
  useSearch: () => "",
  useLocation: () => ["/orders/draft/draft-1/cost", vi.fn()],
  useParams: () => ({ id: "draft-1" }),
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);

function createDraft(): OrderDraft {
  return {
    id: "draft-1",
    intent: "customer_order",
    customerName: "",
    itemName: "قطعة اختبار",
    catalogItemId: null,
    specifications: "",
    quantity: 1,
    costSnapshots: [],
    activeCostSnapshotId: null,
    linkedOrderId: null,
    createdAt: "2026-08-27T08:00:00.000Z",
    updatedAt: "2026-08-27T08:00:00.000Z",
  };
}

function configureIncompleteCostServices() {
  const drafts = {
    get: vi.fn().mockResolvedValue({ ok: true, value: createDraft() }),
  };
  /* المجموعة ٢ (عقد ٢٨): مقترحات مواد المخزون — قراءة فقط بلا مواد في الاختبار. */
  const inventory = {
    overview: vi.fn().mockResolvedValue({ ok: true, value: { materials: [], movementCount: 0 } }),
    movements: vi.fn().mockResolvedValue({ ok: true, value: [] }),
  };
  const costs = {
    preview: vi.fn().mockReturnValue({
      ok: true,
      snapshot: {
        knowledgeState: "incomplete",
        priceFloorMinor: null,
        unitCostMinor: null,
        knowledgeGaps: [{ id: "time_incomplete", mandatory: true }],
      },
    }),
    saveSnapshot: vi.fn(),
  };
  mockedUsePrototypeServices.mockReturnValue({
    drafts,
    costs,
    inventory,
    dataVersion: 0,
    notifyDataChanged: vi.fn(),
  } as unknown as ReturnType<typeof usePrototypeServices>);
}

function GuardFixture({ onSave }: { onSave: () => Promise<boolean> }) {
  useUnsavedChangesGuard({ isDirty: true, onSave });
  const requestNavigation = useUnsavedChangesNavigation();
  return (
    <button type="button" onClick={() => requestNavigation("/next")}>
      انتقل
    </button>
  );
}

function QuantityFixture() {
  const [valueMilli, setValueMilli] = useState(0);
  const [isValid, setIsValid] = useState(true);
  return (
    <>
      <EnglishQuantityInput
        aria-label="الكمية"
        valueMilli={valueMilli}
        onMilliChange={setValueMilli}
        onTextValidityChange={setIsValid}
      />
      <output data-testid="quantity-value">{valueMilli}</output>
      <output data-testid="quantity-validity">{String(isValid)}</output>
    </>
  );
}

describe("U-01 DOM guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders null money as — instead of manufacturing zero", () => {
    render(<MoneyValue minor={null} />);
    const value = screen.getAllByText("—")[0];
    expect(value).toBeTruthy();
    expect(value.textContent).not.toContain("0.00");
    expect(value.getAttribute("dir")).toBe("ltr");
  });

  it("isolates an ASCII financial amount inside Arabic text", () => {
    render(
      <p dir="rtl">
        العربون <MoneyValue minor={12400} />
      </p>,
    );
    const amount = screen.getByText("124.00");
    expect(amount.getAttribute("dir")).toBe("ltr");
    expect(amount.textContent).toBe("124.00");
    expect(amount.textContent).not.toMatch(/[٠-٩]/);
  });

  it("shows the dirty-navigation drawer with all three explicit choices", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    render(
      <UnsavedChangesProvider navigate={navigate}>
        <GuardFixture onSave={async () => true} />
      </UnsavedChangesProvider>,
    );

    await user.click(screen.getByRole("button", { name: "انتقل" }));

    expect(screen.getByTestId("unsaved-changes-drawer")).toBeTruthy();
    /* §3.11: الحوار الجديد — البقاء أولًا */
    expect(screen.getByText("تعديلات غير محفوظة")).toBeTruthy();
    expect(screen.getByRole("button", { name: "احفظ واستمر" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "اخرج دون حفظ" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "ابقَ في الصفحة" })).toBeTruthy();
  });

  it("المجموعة ٦ (البند ٥): الرقم الهند يُطبع عند حد الإدخال إلى إنجليزي بالمعنى نفسه، والكمية تُقبل", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<QuantityFixture />);
    const input = screen.getByRole("textbox", { name: "الكمية" });

    /* ١ (U+0661) تُحوَّل إلى 1 عند الحد — الإدخال النهائي إنجليزي حصرًا
     * والقيمة الرقمية لا تتغير. (كان القرار السابق رفضًا مرئيًا؛ أمر
     * المجموعة ٦ يفرض التطبيع الآمن عند الحدود.) */
    await user.type(input, "١");
    expect(input).toHaveProperty("value", "1");
    expect(screen.getByTestId("quantity-validity").textContent).toBe("true");
    expect(screen.getByTestId("quantity-value").textContent).toBe("1000");

    await user.clear(input);
    await user.type(input, "2");
    expect(input).toHaveProperty("value", "2");
    expect(screen.getByTestId("quantity-validity").textContent).toBe("true");
    expect(screen.getByTestId("quantity-value").textContent).toBe("2000");
  });

  it("renders the incomplete-cost knowledge state without calling it profit", async () => {
    configureIncompleteCostServices();
    render(
      <UnsavedChangesProvider navigate={vi.fn()}>
        <CostEditor />
      </UnsavedChangesProvider>,
    );

    await waitFor(() => expect(screen.getByText("تكلفة ناقصة")).toBeTruthy());
    /* §10/§6: المجهول علامة — لا جملة «غير متاح بعد»؛ الحقيقة في قائمة النواقص لا في جملة. */
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.getByText(/وقت العمل أو سعر الساعة غير مكتمل/)).toBeTruthy();
    expect(screen.queryByText(/ربح|صافي الربح/)).toBeNull();
  });
});
