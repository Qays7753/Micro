/** @vitest-environment jsdom */
/*
 * EX-D18 — فحوص رحلات واجهة السوق (jsdom): التصفح العام وفراغه وخطئه،
 * تفاصيل الإعلان مع قناة التواصل والتقدير، وبوابة مساحة المورد. الـAPI
 * مُحاكى عند حد النقل — مسارات البيانات الحقيقية محروسة بفحوص العامل
 * (worker/tests/market.*.test.ts).
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Market from "@/pages/Market";
import MarketListingDetail from "@/pages/MarketListingDetail";
import MarketVendorWorkspace from "@/pages/MarketVendorWorkspace";

const wouterMocks = vi.hoisted(() => ({ location: "/market/listing/lst_sample_1" }));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, vi.fn()],
  useParams: () => ({}),
  useSearch: () => "",
}));

const fetchMock = vi.fn();

function jsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => data,
    text: async () => JSON.stringify(data),
    clone() {
      return this;
    },
  } as unknown as Response;
}

function listingPayload() {
  return {
    listings: [
      {
        id: "lst_sample_1",
        title: "أكواب تغليف شفافة",
        category: "packaging",
        governorate: "عمان",
        priceMode: "fixed",
        priceMicroJod: "1500000",
        minQuantityMilli: "24000",
        quantityUnit: "حبة",
        availabilityStatus: "available",
        freshness: "fresh",
      },
    ],
    count: 1,
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe("market browse (guest, OD-04)", () => {
  it("renders published listings from the API with price and minimum quantity", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.startsWith("/api/market/listings")) return jsonResponse(listingPayload());
      if (path.startsWith("/api/auth/session")) return jsonResponse({ authenticated: false });
      return jsonResponse({}, 404);
    });
    render(<Market />);
    const card = await screen.findByTestId("market-results");
    expect(card.textContent).toContain("أكواب تغليف شفافة");
    expect(card.textContent).toContain("24 حبة");
    expect(card.textContent).toContain("1.500 د.أ");
    expect(screen.queryByText(/شراء/)).toBeNull();
  });

  it("shows an honest empty state when no results match", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.startsWith("/api/market/listings")) return jsonResponse({ listings: [], count: 0 });
      if (path.startsWith("/api/auth/session")) return jsonResponse({ authenticated: false });
      return jsonResponse({}, 404);
    });
    render(<Market />);
    expect(await screen.findByText("لا توجد نتائج مطابقة")).toBeTruthy();
  });

  it("shows an honest error state with a retry action when the API is unreachable", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.startsWith("/api/market/listings"))
        return jsonResponse({ error: { code: "internal_error", message: "تعذر" } }, 500);
      if (path.startsWith("/api/auth/session")) return jsonResponse({ authenticated: false });
      return jsonResponse({}, 404);
    });
    render(<Market />);
    expect(await screen.findByText("تعذر تحميل السوق")).toBeTruthy();
    expect(screen.getByRole("button", { name: "إعادة المحاولة" })).toBeTruthy();
  });

  it("offers sign-in (not fake data) to guests for the vendor workspace", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.startsWith("/api/market/listings")) return jsonResponse({ listings: [], count: 0 });
      if (path.startsWith("/api/auth/session")) return jsonResponse({ authenticated: false });
      return jsonResponse({}, 404);
    });
    render(<Market />);
    expect(await screen.findByText(/تسجيل الدخول بهوية Micro مطلوب/)).toBeTruthy();
  });
});

describe("market listing detail (OD-04 contact + estimate)", () => {
  it("renders the approved copy, the contact channel, and a non-binding estimate", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.startsWith("/api/market/listings/lst_sample_1")) {
        return jsonResponse({
          listing: {
            id: "lst_sample_1",
            title: "أكواب تغليف شفافة",
            category: "packaging",
            governorate: "عمان",
            description: "وصف معتمد للنشر العام.",
            priceMode: "fixed",
            priceMicroJod: "1500000",
            minQuantityMilli: "24000",
            stepMilli: "12000",
            quantityUnit: "حبة",
            availabilityStatus: "available",
            availabilityConfirmedAt: Date.now(),
            freshness: "fresh",
            /* د-1 (القرار النهائي): نوع القناة فقط — القيمة ليست في أي DTO عام،
             * وزر «إظهار الرقم» هو المسار المدقق الوحيد إليها. */
            contactChannelType: "phone",
            variants: [
              {
                id: "v1",
                label: "حجم صغير",
                priceMicroJod: "1200000",
                minQuantityMilli: "12000",
                availability: "available",
              },
            ],
            publishedAt: Date.now() - 1000,
          },
          mediaIds: [],
          vendor: {
            displayName: "مورد معتمد",
            governorate: "عمان",
            supplierType: "manufacturer",
            deliveryOption: "delivery",
          },
        });
      }
      if (path.startsWith("/api/auth/session")) return jsonResponse({ authenticated: false });
      return jsonResponse({}, 404);
    });
    render(<MarketListingDetail />);
    expect(await screen.findByText("أكواب تغليف شفافة")).toBeTruthy();
    expect(screen.getByText(/مورد معتمد/)).toBeTruthy();
    /* Q38: خيارات المنتج تُعرض بسعرها وأقل كميتها وتوفرها. */
    expect(screen.getByText(/حجم صغير/)).toBeTruthy();
    expect(screen.getByTestId("market-variants").textContent).toContain("12 حبة");
    /* د-1: لا رقم في أي مكان للزائر — زر الكشف الصريح فقط. */
    expect(screen.queryByText(/\+962790000001/)).toBeNull();
    expect(screen.queryByTestId("market-revealed-phone")).toBeNull();
    expect(screen.getByRole("button", { name: /إظهار الرقم/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /أضف إلى السلة|اشترِ/ })).toBeNull();
  });
});

describe("market vendor workspace gating", () => {
  it("reveals the supplier phone through the audited endpoint for a signed-in account (د-1)", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path.startsWith("/api/market/listings/lst_sample_1/reveal-phone")) {
        if ((init?.method ?? "GET") !== "POST") return jsonResponse({}, 405);
        return jsonResponse({ phone: "+962790000001", channelType: "phone", remainingToday: 9 });
      }
      if (path.startsWith("/api/market/listings/lst_sample_1")) {
        return jsonResponse({
          listing: {
            id: "lst_sample_1",
            title: "أكواب تغليف شفافة",
            category: "packaging",
            governorate: "عمان",
            description: "وصف معتمد للنشر العام.",
            priceMode: "fixed",
            priceMicroJod: "1500000",
            minQuantityMilli: "24000",
            stepMilli: "12000",
            quantityUnit: "حبة",
            availabilityStatus: "available",
            availabilityConfirmedAt: Date.now(),
            freshness: "fresh",
            contactChannelType: "phone",
            variants: [],
            publishedAt: Date.now() - 1000,
          },
          mediaIds: [],
          vendor: {
            displayName: "مورد معتمد",
            governorate: "عمان",
            supplierType: null,
            deliveryOption: null,
          },
        });
      }
      if (path.startsWith("/api/auth/session"))
        return jsonResponse({ authenticated: true, identity: { email: "buyer@example.test" } });
      return jsonResponse({}, 404);
    });
    render(<MarketListingDetail />);
    const revealButton = await screen.findByRole("button", { name: /إظهار الرقم/ });
    fireEvent.click(revealButton);
    const revealed = await screen.findByTestId("market-revealed-phone");
    expect(revealed.textContent).toContain("+962790000001");
    expect(revealed.textContent).toContain("9");
  });

  it("requires an authenticated Micro session before any vendor data loads", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input).startsWith("/api/auth/session")) return jsonResponse({ authenticated: false });
      throw new Error("vendor endpoints must not be called for guests");
    });
    render(<MarketVendorWorkspace />);
    expect(await screen.findByTestId("market-vendor-gate")).toBeTruthy();
    expect(screen.getByRole("button", { name: /الدخول عبر Google/ })).toBeTruthy();
  });

  it("shows the workspace with the vendor's own listings after sign-in", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.startsWith("/api/auth/session")) {
        return jsonResponse({
          authenticated: true,
          identity: { email: "vendor@example.test", displayName: "Vendor" },
          vendor: { status: "approved", supplierProfileId: "sp_1" },
        });
      }
      if (path.startsWith("/api/market/vendor/overview")) {
        return jsonResponse({
          vendor: { status: "active", supplierProfileId: "sp_1" },
          termsAcceptedAt: 1,
          termsVersion: "2026-11-21",
          activatedAt: 1,
          listings: [
            {
              id: "lst_mine",
              title: "مادتي المعتمدة",
              status: "approved_for_publish",
              revisionStatus: "none",
              freshness: "fresh",
              availabilityStatus: "available",
              priceMode: "fixed",
              updatedAt: 1,
            },
          ],
        });
      }
      return jsonResponse({}, 404);
    });
    render(<MarketVendorWorkspace />);
    expect(await screen.findByText("مادتي المعتمدة")).toBeTruthy();
    expect(screen.getByRole("button", { name: "تأكيد التوفر" })).toBeTruthy();
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) => String(input).includes("/api/market/vendor/overview")),
      ).toBe(true);
    });
  });
});
