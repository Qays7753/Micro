/** @vitest-environment jsdom */
/**
 * الموجة 4 (G08 — Q168/Q175/Q176، القرارات النهائية 2026-11-21): الوصلات
 * السياقية من إدارة إلى السوق/التوصيل — تنقّل بسياق فقط بلا نسخ سجلات ولا
 * أي أثر مالي. هذا الاختبار يغطي الرابط الأخطر: فتح السوق بمادة البحث
 * جاهزة من نقص المخزون (?search=) — التهيئة من الرابط مرة واحدة ثم
 * الفلاتر بيد المستخدم.
 */
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Market from "@/pages/Market";

const wouterState = vi.hoisted(() => ({ path: "/market?search=%D8%AE%D8%B4%D8%A8" }));
vi.mock("wouter", () => ({
  useLocation: () => [wouterState.path, vi.fn()],
  useParams: () => ({}),
  useSearch: () => wouterState.path,
}));

const fetchMock = vi.fn();

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => payload,
    text: async () => JSON.stringify(payload),
    clone() {
      return this;
    },
  } as unknown as Response;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
});

describe("Wave 4 G08: the contextual market link from the inventory shortage", () => {
  it("opens the browse with the linked material pre-searched (?search=خشب)", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.startsWith("/api/market/listings")) {
        // The browse request itself must carry the linked search term.
        expect(path).toContain("search=%D8%AE%D8%B4%D8%A8");
        return jsonResponse({ listings: [], count: 0, nextCursor: null, hasMore: false });
      }
      if (path.startsWith("/api/market/meta")) {
        return jsonResponse({
          categories: [{ id: "packaging", label: "التغليف", sub: [] }],
          governorates: ["عمان"],
          supplierTypes: ["manufacturer"],
          deliveryOptions: ["delivery"],
        });
      }
      if (path.startsWith("/api/auth/session")) return jsonResponse({ authenticated: false });
      return jsonResponse({}, 404);
    });
    render(<Market />);
    await waitFor(() => {
      expect(screen.getByTestId("market-results")).toBeTruthy();
    });
    // The search input itself shows the linked material.
    const searchInput = screen.getByLabelText("بحث في السوق") as HTMLInputElement;
    expect(searchInput.value).toBe("خشب");
  });
});
