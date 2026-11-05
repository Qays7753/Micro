/** @vitest-environment jsdom */

/*
 * UXR-01 (أمر UXR-W01 — قبول A01): رحلات جاهزية الرئيسية فوق الحدود الحقيقية
 * (تفاعل ← خدمة ← مخزن الذاكرة) مع الحالات الأربع التي يطلبها الفحص:
 * فشل تجهيز الخدمات كسطح مميز، رفض وعد القراءة (استثناء غير متوقع) برسالة
 * آمنة بلا استثناء خام، فشل Result ثم إعادة محاولة ناجحة بلا تكرار قراءة،
 * وتجاهل نتيجة محاولة أقدم تصل بعد محاولة أحدث أو بعد تركيب صفحة جديدة
 * (كل حالة بكشف يحكمه الاختبار — لا سباق ولا نوم ولا كتابة مالية).
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { QuickRecordingProvider } from "@/app/quickRecording";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { CollectionService } from "@/application/collections/collectionService";
import { DirectSaleService } from "@/application/direct-sales/directSaleService";
import { DueDatesService } from "@/application/finance/dueDatesService";
import { FulfillmentService } from "@/application/fulfillment/fulfillmentService";
import { UnifiedFollowUpService } from "@/application/follow-up/unifiedFollowUpService";
import { DailyFollowUpService } from "@/application/follow-up/dailyFollowUpService";
import { HomeControlCenterService } from "@/application/home/homeControlCenterService";
import { ProfileService } from "@/application/profile/profileService";
import { activeDeliveryLens } from "@/application/scheduling";
import Home from "@/pages/Home";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/",
  params: {} as Record<string, string>,
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => wouterMocks.params,
  useSearch: () => "",
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);

function buildHomeService(store: MemoryLocalStore, now: () => string) {
  const projectFinance = new ProjectFinancialService(store, now);
  const directSales = new DirectSaleService(store, now);
  const fulfillment = new FulfillmentService(store, now);
  const collections = new CollectionService(store, fulfillment, directSales, projectFinance);
  const dueDates = new DueDatesService(store, collections, now);
  const unified = new UnifiedFollowUpService(
    activeDeliveryLens(store),
    store,
    collections,
    dueDates,
    projectFinance,
    store,
    now,
  );
  return new HomeControlCenterService(store, new DailyFollowUpService(store), projectFinance, unified, now);
}

const NOW = "2026-09-12T09:00:00.000Z";

let store: MemoryLocalStore;
let dataVersion = 0;

function mockContext(overrides: Record<string, unknown> = {}) {
  mockedUsePrototypeServices.mockReturnValue({
    homeControlCenter: buildHomeService(store, () => NOW),
    projectFinance: new ProjectFinancialService(store, () => NOW),
    dataVersion,
    notifyDataChanged: () => {
      dataVersion += 1;
    },
    ...overrides,
  } as unknown as ReturnType<typeof usePrototypeServices>);
}

async function seedProfile(target: MemoryLocalStore, name: string) {
  const result = await new ProfileService(target, () => NOW).create(name);
  if (!result.ok) throw new Error(result.message);
}

function renderHome() {
  return render(
    <QuickRecordingProvider>
      <UnsavedChangesProvider navigate={wouterMocks.navigate}>
        <Home />
      </UnsavedChangesProvider>
    </QuickRecordingProvider>,
  );
}

afterEach(() => {
  cleanup();
});

describe("Home readiness journeys — UXR-01 (W01, A01)", () => {
  beforeEach(() => {
    store = new MemoryLocalStore();
    dataVersion = 0;
  });

  it("renders the distinct failed-setup surface with an effective retry (not endless loading)", async () => {
    const retrySetup = vi.fn();
    mockContext({ homeControlCenter: null, homeSetup: { status: "failed", retry: retrySetup } });
    renderHome();
    expect(await screen.findByRole("heading", { name: "تعذر تحميل مشروعك" })).toBeTruthy();
    expect(screen.getByText("تعذر تجهيز مشروعك.")).toBeTruthy();
    expect(screen.queryByText("جارٍ تجهيز مشروعك…")).not.toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "إعادة المحاولة" }));
    expect(retrySetup).toHaveBeenCalledTimes(1);
  });

  it("keeps the honest loading status while setup is still in flight", () => {
    mockContext({ homeControlCenter: null, homeSetup: { status: "loading" } });
    renderHome();
    expect(screen.getByRole("status").textContent).toContain("جارٍ تجهيز مشروعك");
    expect(screen.queryByRole("alert")).not.toBeTruthy();
  });

  it("shows a safe full error surface when the read promise itself rejects — no raw exception leak", async () => {
    await seedProfile(store, "مشغل الاختبار");
    const throwingControlCenter = {
      read: () => Promise.reject(new Error("RAW INTERNAL PATH /home/user/private-token")),
    } as unknown as HomeControlCenterService;
    mockContext({ homeControlCenter: throwingControlCenter });
    renderHome();
    expect(await screen.findByRole("heading", { name: "تعذر تحميل مشروعك" })).toBeTruthy();
    expect(screen.getByText("تعذر قراءة بيانات مشروعك المحلية.")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).not.toContain("RAW INTERNAL PATH");
    expect(screen.queryByRole("heading", { name: "مشغل الاختبار" })).not.toBeTruthy();
  });

  it("recovers in place after a failed Result when the user retries — exactly one new read", async () => {
    await seedProfile(store, "مشغل الاختبار");
    const realControlCenter = buildHomeService(store, () => NOW);
    let readCalls = 0;
    const flakyControlCenter = {
      read: async () => {
        readCalls += 1;
        if (readCalls === 1)
          return {
            ok: false as const,
            code: "storage_error" as const,
            message: "تعذر قراءة بيانات مشروعك المحلية.",
          };
        return realControlCenter.read();
      },
    } as unknown as HomeControlCenterService;
    mockContext({ homeControlCenter: flakyControlCenter });
    renderHome();
    expect(await screen.findByRole("heading", { name: "تعذر تحميل مشروعك" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "إعادة المحاولة" }));
    expect(await screen.findByRole("heading", { name: "مشغل الاختبار" })).toBeTruthy();
    /* إعادة محاولة واحدة = قراءة واحدة جديدة؛ لا تكرار قراءة ولا إعادة تحميل. */
    expect(readCalls).toBe(2);
  });

  it("ignores a stale attempt that settles after a newer attempt (newer result wins)", async () => {
    await seedProfile(store, "مشغل الاختبار");
    const secondStore = new MemoryLocalStore();
    await seedProfile(secondStore, "مشغل أحدث");
    const olderService = buildHomeService(store, () => NOW);
    const newerService = buildHomeService(secondStore, () => NOW);
    let releaseOlder: () => void = () => {};
    const olderGate = new Promise<void>(resolve => {
      releaseOlder = resolve;
    });
    let readCalls = 0;
    const racingControlCenter = {
      read: () => {
        readCalls += 1;
        /* المحاولة الأولى (الأقدم) معلقة عند بوابة الاختبار. */
        if (readCalls === 1) return olderGate.then(() => olderService.read());
        return newerService.read();
      },
    } as unknown as HomeControlCenterService;
    function RacingHarness() {
      const [version, setVersion] = React.useState(dataVersion);
      mockedUsePrototypeServices.mockReturnValue({
        homeControlCenter: racingControlCenter,
        homeSetup: { status: "ready" },
        projectFinance: new ProjectFinancialService(store, () => NOW),
        dataVersion: version,
        notifyDataChanged: () => {
          setVersion(current => current + 1);
        },
      } as unknown as ReturnType<typeof usePrototypeServices>);
      return (
        <QuickRecordingProvider>
          <UnsavedChangesProvider navigate={wouterMocks.navigate}>
            <Home />
            <button type="button" onClick={() => setVersion(current => current + 1)}>
              bump-refresh
            </button>
          </UnsavedChangesProvider>
        </QuickRecordingProvider>
      );
    }
    render(<RacingHarness />);
    /* المحاولة الأحدث تبدأ وتصل أولًا وتُعرض. */
    fireEvent.click(screen.getByText("bump-refresh"));
    expect(await screen.findByRole("heading", { name: "مشغل أحدث" })).toBeTruthy();
    /* المحاولة الأقدم تصل الآن متأخرة — تُتجاهل ولا تكتب فوق النتيجة الأحدث. */
    releaseOlder();
    await waitFor(() => expect(readCalls).toBeGreaterThanOrEqual(2));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(screen.getByRole("heading", { name: "مشغل أحدث" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "مشغل الاختبار" })).not.toBeTruthy();
  });

  it("silently ignores a read that settles after the page unmounts", async () => {
    await seedProfile(store, "مشغل الاختبار");
    let releaseRead: () => void = () => {};
    const readGate = new Promise<void>(resolve => {
      releaseRead = resolve;
    });
    const gatedControlCenter = {
      read: () =>
        readGate.then(() => {
          throw new Error("late rejection after unmount must not surface");
        }),
    } as unknown as HomeControlCenterService;
    mockContext({ homeControlCenter: gatedControlCenter });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const mounted = renderHome();
    expect(screen.getByRole("status").textContent).toContain("جارٍ تجهيز مشروعك");
    mounted.unmount();
    releaseRead();
    await new Promise(resolve => setTimeout(resolve, 0));
    /* بعد التركيب لم يعد للصفحة سطح — لا رسالة خطأ ولا تحذير تفاعل غير معالج. */
    const reported = consoleError.mock.calls.map(call => String(call[0]));
    consoleError.mockRestore();
    expect(reported.join("\n")).not.toContain("late rejection after unmount");
    expect(reported.join("\n")).not.toContain("not wrapped in act");
  });

  it("re-reads honestly when the user returns to the SPA surface", async () => {
    await seedProfile(store, "مشغل الاختبار");
    const realControlCenter = buildHomeService(store, () => NOW);
    let readCalls = 0;
    const countingControlCenter = {
      read: () => {
        readCalls += 1;
        return realControlCenter.read();
      },
    } as unknown as HomeControlCenterService;
    mockContext({ homeControlCenter: countingControlCenter });
    const first = renderHome();
    expect(await screen.findByRole("heading", { name: "مشغل الاختبار" })).toBeTruthy();
    expect(readCalls).toBe(1);
    first.unmount();
    renderHome();
    expect(await screen.findByRole("heading", { name: "مشغل الاختبار" })).toBeTruthy();
    expect(readCalls).toBe(2);
  });
});
