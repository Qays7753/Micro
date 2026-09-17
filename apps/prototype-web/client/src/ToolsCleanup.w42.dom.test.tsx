/** @vitest-environment jsdom */

/* P-4.2-2 (Wave 4.2 — قرارات المالك F03 + T4/T5/T6): حارس تنظيف «أدواتي».
 * أدواتي أدوات مستقلة فقط:
 * - لا قسم «حالة الوحدات» (F03) — الإعدادات بيت التهيئة والقدرات الوحيد.
 * - لا بطاقة نسخ احتياطي (T4) — بيتها الإعدادات.
 * - لا شارات/قراءات دفتر الناس والموردين (T5) — الحالة تُقرأ من بيتها.
 * - لا صف «السوق والتوصيل» الميت (T6) — تمثيل السوق مقعده والنقل لوحة الترويسة.
 * - تبقى الحاسبة والتقديرات والجسر والشرح الصادق المطلوب حرفيًا. */
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { CostEstimateService } from "@/application/estimates/costEstimateService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import Tools from "@/pages/Tools";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({ navigate: vi.fn(), location: "/tools" }));

vi.mock("wouter", () => ({
  useSearch: () => "",
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => ({}),
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-09-17T09:00:00.000Z";
let store: MemoryLocalStore;
let costEstimates: CostEstimateService;

describe("P-4.2-2 — تنظيف «أدواتي» (F03/T4/T5/T6)", () => {
  beforeEach(() => {
    store = new MemoryLocalStore();
    costEstimates = new CostEstimateService(store, () => NOW);
    wouterMocks.location = "/tools";
    wouterMocks.navigate.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("السطح: أدوات مستقلة فقط — لا حالة وحدات ولا نسخ ولا شارات مالية ولا صف سوق ميت", async () => {
    mockedUsePrototypeServices.mockImplementation(
      () =>
        ({
          costEstimates,
          dataVersion: 0,
          notifyDataChanged: vi.fn(),
        }) as unknown as ReturnType<typeof usePrototypeServices>,
    );
    render(<Tools />);
    await waitFor(() => expect(screen.queryByText("جارٍ قراءة أدواتك المحلية…")).not.toBeTruthy());

    /* الشرح الصادق المطلوب حرفيًا بقرار P-4.2-2. */
    expect(screen.getByText(/أدوات مستقلة للحساب والتقدير، لا تغيّر سجلات مشروعك/)).toBeTruthy();

    /* الباقي: الحاسبة + التقديرات. */
    expect(screen.getByRole("heading", { name: "احسب قبل أن تلتزم" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /افتح الحاسبة/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "تقديراتي المحفوظة" })).toBeTruthy();

    /* المحذوف بقرار المالك — لا يعود أبدًا إلى هذا السطح. */
    expect(screen.queryByRole("heading", { name: "حالة الوحدات" })).toBeNull();
    expect(screen.queryByText("النسخ الاحتياطي والبيانات")).toBeNull();
    expect(screen.queryByText("الموردون والمشتريات")).toBeNull();
    expect(screen.queryByText("دفتر الناس")).toBeNull();
    expect(screen.queryByText("السوق والتوصيل")).toBeNull();
    expect(screen.queryByText("فحص سلامة مالي")).toBeNull();
    expect(screen.queryByText("منتجاتي وخدماتي")).toBeNull();
    expect(screen.queryByText("المواعيد والمتابعات")).toBeNull();
  });
});
