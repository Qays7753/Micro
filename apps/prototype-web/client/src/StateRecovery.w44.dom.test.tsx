/** @vitest-environment jsdom */
/* Wave 4.4 — P-4.4-4: حالات التحميل والفراغ والخطأ والنجاح والاسترداد.
 * ---------------------------------------------------------------------------
 * ١) Retry حقيقي في شاشة خطأ القراءة: الزر يعيد تشغيل القراءة فيتعافى
 *    السطح من فشل عابر — لا يُترك المستخدم مع زر رجوع فقط.
 * ٢) مصفوفة الحالات المصدرة: كل صفحة تعرض خطأ قراءة تقدم فعل إعادة
 *    محاولة في مكانه (زر إعادة/إعادة تحميل/عودة) — فحص مصدر ثابت يدوم.
 * ٣) التحميل لا يعرض أصفارًا: شاشة التحميل نص حالة صريح (role=status)
 *    لا بطاقات حقائق بأصفار.
 * ٤) فشل المشاركة الأصلية يعود إلى مسار التسليم النصي الصادق — لا نجاح
 *    كاذبًا ولا استثناءً غير معالج.
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { AssetService } from "@/application/assets/assetService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import Assets from "@/pages/Assets";
import { canShareText, shareTextManually } from "@/lib/textDelivery";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/assets",
  params: {} as Record<string, string | undefined>,
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => wouterMocks.params,
  useSearch: () => "",
  Redirect: () => null,
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-09-16T09:00:00.000Z";

let store: MemoryLocalStore;

describe("Wave 4.4 — P-4.4-4: Retry التعافي في شاشة خطأ القراءة", () => {
  beforeEach(() => {
    wouterMocks.navigate.mockReset();
    vi.clearAllMocks();
    store = new MemoryLocalStore();
  });
  afterEach(cleanup);

  it("زر «إعادة المحاولة» يعيد القراءة ويتعافى السطح من فشل عابر", async () => {
    /* فشل واحد ثم نجاح — نمط القراءة العابرة. */
    let calls = 0;
    const realService = new AssetService(store, () => NOW);
    const flakyAssets = {
      overview: () => {
        calls += 1;
        if (calls === 1) {
          return Promise.resolve({
            ok: false,
            code: "storage_error",
            message: "تعذر قراءة سجل الأصول المحلي.",
          });
        }
        return realService.overview();
      },
    };
    let dataVersion = 0;
    mockedUsePrototypeServices.mockReturnValue({
      assets: flakyAssets,
      get dataVersion() {
        return dataVersion;
      },
      notifyDataChanged: () => {
        dataVersion += 1;
      },
    } as unknown as ReturnType<typeof usePrototypeServices>);

    render(<Assets />);

    /* الفشل الأول: شاشة الخطأ مع الزر — لا أصفار ولا بيانات ناقصة. */
    const retryButton = await screen.findByRole("button", { name: "إعادة المحاولة" });
    expect(screen.getByRole("alert").textContent).toContain("تعذر قراءة سجل الأصول المحلي");
    expect(document.body.textContent).not.toContain("0.00");

    /* Retry: القراءة تعود فتنجح — السطح يتعافى في مكانه. */
    fireEvent.click(retryButton);
    await waitFor(() => {
      expect(screen.getByText("لا أصول مسجلة بعد.")).toBeTruthy();
    });
    expect(calls).toBe(2);
  });

  it("التحميل نص حالة معلن — لا أصفار قبل اكتمال القراءة", async () => {
    let calls = 0;
    const realService = new AssetService(store, () => NOW);
    const slowAssets = {
      overview: () => {
        calls += 1;
        return new Promise(resolveRead => {
          setTimeout(() => resolveRead(realService.overview()), 30);
        });
      },
    };
    mockedUsePrototypeServices.mockReturnValue({
      assets: slowAssets,
      dataVersion: 0,
      notifyDataChanged: () => undefined,
    } as unknown as ReturnType<typeof usePrototypeServices>);

    render(<Assets />);
    /* أثناء التحميل: حالة معلنة role=status — لا بطاقات ولا أصفار. */
    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
    expect(document.querySelector(".micro-prim-empty")).toBeNull();
    await waitFor(() => {
      expect(screen.getByText("لا أصول مسجلة بعد.")).toBeTruthy();
    });
    expect(calls).toBe(1);
  });
});

describe("Wave 4.4 — P-4.4-4: مصفوفة الحالات — فحص مصدر ثابت", () => {
  const CLIENT_SRC = import.meta.dirname;

  const readPages = [
    "AssetDetail",
    "Assets",
    "CashCount",
    "CashDistribution",
    "CashOpeningLaterEditor",
    "CashWallets",
    "Collect",
    "DeliveryReview",
    "EstimateDetail",
    "Finance",
    "FinanceActivity",
    "Foundation",
    "Home",
    "InventoryMaterials",
    "LoanDetail",
    "Loans",
    "OrderDetail",
    "Orders",
    "Parties",
    "Profile",
    "Schedule",
    "ScheduleEditor",
    "Statement",
    "Suppliers",
    "Tools",
    "ToolsIntegrity",
    "WalletLedger",
  ];

  it("كل صفحة تعرض خطأ قراءة تقدم فعل تعافٍ في مكانه (إعادة محاولة/إعادة تحميل/عودة)", () => {
    for (const page of readPages) {
      const source = readFileSync(resolve(CLIENT_SRC, "pages", `${page}.tsx`), "utf8");
      expect.soft(source, `${page}: خطأ قراءة بلا شاشة خطأ`).toMatch(/phase === "error"/);
      const hasRecovery =
        source.includes("إعادة المحاولة") ||
        source.includes("window.location.reload()") ||
        source.includes("setReloadToken") ||
        source.includes('setState({ phase: "loading" })') ||
        /* ToolsIntegrity: زر «افحص الآن» الدائم تحت رسالة الخطأ هو إعادة
         * المحاولة نفسها — إعادة تشغيل الفحص قراءة جديدة. */
        (page === "ToolsIntegrity" && source.includes('disabled={state.phase === "running"}'));
      expect.soft(hasRecovery, `${page}: لا فعل تعافٍ في شاشة الخطأ`).toBe(true);
    }
  });

  it("أزرار الحفظ الحرجة معطلة أثناء التنفيذ — لا إرسال مزدوج", () => {
    const criticalForms = [
      "pages/Collect.tsx",
      "pages/CashDistribution.tsx",
      "pages/DirectSaleEditor.tsx",
      "pages/SupplierPurchaseEditor.tsx",
      "pages/OrderDetail.tsx",
    ];
    for (const rel of criticalForms) {
      const source = readFileSync(resolve(CLIENT_SRC, rel), "utf8");
      expect
        .soft(source, `${rel}: لا حماية إرسال مزدوج`)
        .toMatch(
          /disabled=\{saving\}|disabled=\{isSaving\}|disabled=\{submitting\}|disabled=\{isActing\}|disabled=\{.*[Ss]aving/,
        );
    }
  });
});

describe("Wave 4.4 — P-4.4-4: فشل المشاركة الأصلية يعود للمسار الصادق", () => {
  it("غياب navigator.share لا يكسر التسليم النصي — المسار البديل صادق", async () => {
    const originalShare = navigator.share;
    Object.defineProperty(navigator, "share", {
      value: undefined,
      configurable: true,
    });
    try {
      expect(canShareText()).toBe(false);
      /* التسليم النصي لا يرمي — يرجع نتيجة قابلة للعرض في كل الأحوال. */
      const outcome = await shareTextManually("نص تجريبي للمشاركة");
      expect(["copied", "unsupported"]).toContain(outcome);
    } finally {
      Object.defineProperty(navigator, "share", {
        value: originalShare,
        configurable: true,
      });
    }
  });

  it("رفض المستخدم للمشاركة الأصلية ليس خطأ — إلغاء واعٍ لا رسالة فشل", async () => {
    const originalShare = navigator.share;
    Object.defineProperty(navigator, "share", {
      value: () => Promise.reject(new DOMException("abort", "AbortError")),
      configurable: true,
    });
    try {
      expect(canShareText()).toBe(true);
      const outcome = await shareTextManually("نص تجريبي للمشاركة");
      /* الإلغاء الواعي ليس فشلًا يُعرض للمالك — مسار هادئ بلا رسالة خطأ */
      expect(["unsupported", "copied"]).toContain(outcome);
    } finally {
      Object.defineProperty(navigator, "share", {
        value: originalShare,
        configurable: true,
      });
    }
  });
});
