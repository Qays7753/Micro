/** @vitest-environment jsdom */

/*
 * UXR-02 (أمر UXR-W01 — F-015): القشرة تزامن نوع المسار على وسم المستند
 * (data-micro-route-kind) لأن حاوية التمرير الفعلية هي المستند نفسه —
 * قيمة تعويض التمرير للتركيز/scrollIntoView تُعلن على html في index.css
 * حسب هذا الوسم (سطح = الشريط السفلي الثابت؛ عمق = بلا شريط). هذا الاختبار
 * يثبت المزامنة لكل نوع مسار وإزالة الوسم عند التركيب الأخير (نفس سابقة
 * ThemeContext في كتابة documentElement) — القياس الهندسي الفعلي (العنصر
 * المركّز فوق حافة الشريط) يُثبت بالمتزامح في تقرير W01 لا في jsdom.
 */
import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { MicroAppShell } from "@/components/layout/MicroAppShell";
/* BrandMark داخل الترويسة يقرأ وضع الثيم الحي (ADR-009) — المزوّد فوق
 * القشرة في التطبيق الحقيقي؛ هنا مثله مع كعب matchMedia لـjsdom. */
import { ThemeProvider } from "@/contexts/ThemeContext";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));
const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);

const wouterMocks = vi.hoisted(() => ({
  location: "/",
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, vi.fn()],
  useParams: () => ({}),
  useSearch: () => "",
}));

beforeAll(() => {
  /* jsdom يفتقر إلى matchMedia — نفس كعب R2.renderSmoke. */
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
});

function renderShellAt(location: string) {
  wouterMocks.location = location;
  mockedUsePrototypeServices.mockReturnValue({
    ownerProfile: { read: async () => ({ ok: true, value: null }) },
    /* DOC-039 (NAV-001/R1-15): القشرة تقرأ وجود المشروع المحلي لمقاعد الضيف. */
    profiles: { load: async () => ({ ok: true, value: null }) },
    preferences: {
      load: async () => ({ ok: true, preference: { theme: "light" } }),
      save: async () => ({ ok: true }),
      readInstallBannerDismissal: async () => ({ ok: true, value: true }),
      saveInstallBannerDismissal: async () => ({ ok: true }),
    },
    dataVersion: 0,
  } as unknown as ReturnType<typeof usePrototypeServices>);
  return render(
    <ThemeProvider>
      <MicroAppShell>{<p>سطح الاختبار</p>}</MicroAppShell>
    </ThemeProvider>,
  );
}

describe("MicroAppShell — UXR-02 scroll-ownership route-kind sync (W01, F-015)", () => {
  afterEach(() => {
    cleanup();
  });

  it("mirrors the surface route kind onto the document scroll container", () => {
    renderShellAt("/");
    expect(document.documentElement.dataset.microRouteKind).toBe("surface");
  });

  it("mirrors the deep route kind (fixed bottom bar hidden) for editor routes", () => {
    renderShellAt("/cash/transfer");
    expect(document.documentElement.dataset.microRouteKind).toBe("deep");
  });

  it("mirrors the setup route kind on the first-run surface", () => {
    renderShellAt("/setup");
    expect(document.documentElement.dataset.microRouteKind).toBe("setup");
  });

  it("removes the attribute when the shell unmounts (no stale scroll compensation)", () => {
    const mounted = renderShellAt("/finance");
    expect(document.documentElement.dataset.microRouteKind).toBe("surface");
    mounted.unmount();
    expect(document.documentElement.dataset.microRouteKind).toBeUndefined();
  });
});
