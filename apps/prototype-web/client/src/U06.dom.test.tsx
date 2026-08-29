/** @vitest-environment jsdom */

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import type { DraftIntent } from "@/storage/local/types";
import NewDraft from "@/pages/NewDraft";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({ location: "/orders/new", navigate: vi.fn() }));

vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);

function draftWithId(id: string) {
  return { ok: true as const, draft: { id } };
}

describe("NewDraft consumes the quick-action intent (U-06)", () => {
  const create = vi.fn();

  beforeEach(() => {
    create.mockReset();
    wouterMocks.navigate.mockReset();
    mockedUsePrototypeServices.mockReturnValue({
      drafts: { create },
      notifyDataChanged: vi.fn(),
    } as unknown as ReturnType<typeof usePrototypeServices>);
  });

  afterEach(() => {
    cleanup();
    wouterMocks.location = "/orders/new";
  });

  it("creates the planned-design draft directly from the route's answer", async () => {
    wouterMocks.location = "/orders/new?intent=planned_design";
    create.mockResolvedValueOnce(draftWithId("draft-9"));
    render(<NewDraft />);
    await waitFor(() => expect(create).toHaveBeenCalledWith("planned_design"));
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalledWith("/orders/draft/draft-9"));
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("creates the customer-order draft from the route's answer", async () => {
    wouterMocks.location = "/orders/new?intent=customer_order";
    create.mockResolvedValueOnce(draftWithId("draft-10"));
    render(<NewDraft />);
    await waitFor(() => expect(create).toHaveBeenCalledWith("customer_order"));
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalledWith("/orders/draft/draft-10"));
  });

  it("falls back to the manual choice when the route carries no answer", async () => {
    wouterMocks.location = "/orders/new";
    render(<NewDraft />);
    expect(screen.getByRole("heading", { name: "اختر نقطة البداية" })).toBeTruthy();
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(create).not.toHaveBeenCalled();
    expect(wouterMocks.navigate).not.toHaveBeenCalled();
  });

  it("keeps the manual choice available when auto-creation fails", async () => {
    wouterMocks.location = "/orders/new?intent=planned_design";
    create.mockResolvedValueOnce({ ok: false, message: "تعذر إنشاء المسودة الآن." });
    render(<NewDraft />);
    await waitFor(() => expect(screen.getByText("تعذر إنشاء المسودة الآن.")).toBeTruthy());
    expect(wouterMocks.navigate).not.toHaveBeenCalled();
    // The owner can still choose manually after the failure.
    expect(screen.getByRole("button", { name: /طلب عميل/ })).toHaveProperty("disabled", false);
    expect(screen.getByRole("button", { name: /مسودة تصميم/ })).toHaveProperty("disabled", false);
  });
});
