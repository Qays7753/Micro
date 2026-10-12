/** @vitest-environment jsdom */

/*
 * R10-B4/OD-12 (قرار المالك مقبول ٢٠٢٦-١٠-١٣): نظام انتقال المسار المركزي —
 * اختبارات DOM سلوكية على القشرة الحية: هوية عنصر التركيز بالضبط (عنصر main
 * المعاد تركيبه، لا body ولا عنصرًا قديمًا — درس RC-3)، العنوان الصحيح لكل
 * انتقال (عنوان المسار = تسميته الكنونية ذاتها — الأسلم اشتقاقًا والأدقّ
 * سلوكًا)، الدخول المباشر، التنقل الأمامي، الرجوع والتقدم، انتقال الاستعلام
 * وحده، وبرهان سلبي: تعطيل نداء focus نفسه يُسقط وصول التركيز — فلا شيء آخر
 * غير النظام المركزي ينقله.
 */
import { act, cleanup, render } from "@testing-library/react";
import { type ReactNode, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MicroAppShell } from "@/components/layout/MicroAppShell";
import { ThemeProvider } from "@/contexts/ThemeContext";

/* موضع الملاحة المُحاكى — كعب wouter الوحيد الذي تحتاجه القشرة (useLocation). */
const wouterState = vi.hoisted(() => ({ location: "/finance" }));

vi.mock("wouter", () => ({
  useLocation: (): [string, (to: string) => void] => [wouterState.location, vi.fn()],
}));

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: () => ({
    ownerProfile: { read: () => Promise.resolve({ ok: true, value: null }) },
    preferences: {
      readInstallBannerDismissal: () => Promise.resolve({ ok: true, dismissedAt: null }),
      load: () => Promise.resolve({ ok: true, value: "light" }),
      save: () => Promise.resolve({ ok: true }),
    },
    dataVersion: 0,
  }),
}));

/* مضيف خارجي يحمل إعادة الرسم: تغيير الموضع ثم دفعة تحديث واحدة — نفس ما
 * يفعله الموجّه الحقيقي عند pushState/popstate (الموضع يتغير ثم يعاد الرسم).
 * مزوّد السمة يلف القشرة كما في App الحية (BrandMark في الترويسة يطلبه). */
let forceRender: () => void = () => undefined;

function Host({ children }: { children: ReactNode }) {
  const [, setTick] = useState(0);
  forceRender = () => setTick(tick => tick + 1);
  return (
    <ThemeProvider defaultTheme="light" switchable>
      <MicroAppShell>{children}</MicroAppShell>
    </ThemeProvider>
  );
}

function navigateTo(to: string) {
  /* داخل act — دفعة التحديث تُطبَّق وتُفرَّغ تأثيراتها قبل أي تأكيد. */
  act(() => {
    wouterState.location = to;
    forceRender();
  });
}

function currentMain(): HTMLElement {
  const main = document.querySelector("main.micro-main");
  if (!(main instanceof HTMLElement)) throw new Error("عنصر main.micro-main غير موجود في المستند");
  return main;
}

describe("R10-B4/OD-12 — centralized route-transition focus and document titles", () => {
  beforeEach(() => {
    /* jsdom لا تنفّذ matchMedia — الكعب البيتي المعتمد (كما في اختبارات القفل). */
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi
        .fn()
        .mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    });
    wouterState.location = "/finance";
  });
  afterEach(() => {
    cleanup();
    document.title = "";
    vi.restoreAllMocks();
  });

  it("direct entry: mounting the shell focuses the content main exactly and sets the route title", () => {
    render(
      <Host>
        <section>محتوى السطح</section>
      </Host>,
    );
    const main = currentMain();
    /* هوية العنصر بالضبط — لا احتواء نص body (الصيغة الفارغة التي رفضها RC-3). */
    expect(document.activeElement).toBe(main);
    /* قابل للتوجيه البرمجي بلا دخول ترتيب الجدولة (tabIndex -1 لا 0). */
    expect(main.tabIndex).toBe(-1);
    expect(document.title).toBe("المالية");
  });

  it("normal navigation: focus lands on the REMOUNTED main (new element identity) and the title follows", () => {
    render(
      <Host>
        <section>محتوى</section>
      </Host>,
    );
    const firstMain = currentMain();
    expect(document.activeElement).toBe(firstMain);
    navigateTo("/orders");
    const secondMain = currentMain();
    /* عقد إعادة التركيب القائم (key={location}) — عنصر جديد لكل انتقال. */
    expect(secondMain).not.toBe(firstMain);
    expect(document.activeElement).toBe(secondMain);
    expect(document.activeElement).not.toBe(firstMain);
    expect(document.title).toBe("العمل");
  });

  it("back/forward: every history step receives focus and the correct title again", () => {
    render(
      <Host>
        <section>محتوى</section>
      </Host>,
    );
    navigateTo("/orders");
    navigateTo("/finance");
    expect(document.title).toBe("المالية");
    /* رجوع — popstate يعيد الموضع السابق؛ التركيز والعنوان يستقبلان الانتقال. */
    navigateTo("/orders");
    expect(document.activeElement).toBe(currentMain());
    expect(document.title).toBe("العمل");
    /* تقدم — الانتقال الأمامي نفس العقد نفسه. */
    navigateTo("/finance");
    expect(document.activeElement).toBe(currentMain());
    expect(document.title).toBe("المالية");
  });

  it("a query-only transition remounts and refocuses but never changes the pathname title", () => {
    render(
      <Host>
        <section>محتوى</section>
      </Host>,
    );
    navigateTo("/orders?returnTo=/finance");
    expect(document.activeElement).toBe(currentMain());
    /* العنوان من المسار وحده — الاستعلام لا يمسه. */
    expect(document.title).toBe("العمل");
  });

  it("routes without a canonical label carry the canonical fallback label as their title", () => {
    render(
      <Host>
        <section>محتوى</section>
      </Host>,
    );
    navigateTo("/setup");
    expect(document.title).toBe("مايكرو");
    expect(document.activeElement).toBe(currentMain());
  });

  it("deep contextual routes carry their canonical contextual label (not the raw path, not the generic parent)", () => {
    render(
      <Host>
        <section>محتوى</section>
      </Host>,
    );
    navigateTo("/orders/abc123/deliver");
    expect(document.title).toBe("مراجعة التسليم");
    expect(document.activeElement).toBe(currentMain());
    /* الأسبقية: التسمية المحددة قبل العامة — سلامة الحسابات لا أدواتي. */
    navigateTo("/tools/integrity");
    expect(document.title).toBe("سلامة الحسابات");
    expect(document.activeElement).toBe(currentMain());
  });

  it("NEGATIVE PROOF: neutering the focus call itself drops focus arrival — nothing else moves it", () => {
    render(
      <Host>
        <section>محتوى</section>
      </Host>,
    );
    expect(document.activeElement).toBe(currentMain());
    /* تعطيل نداء focus نفسه (كأن استقبال النظام المركزي أُزيل): الانتقال التالي
     * لا يصل التركيز إلى main فيبقى على body — يثبت أن وصول التركيز سببه نداء
     * النظام المركزي وحده، لا أي آلية DOM أخرى (لا autofocus ولا سلوك متصفح). */
    const focusSpy = vi.spyOn(HTMLElement.prototype, "focus").mockImplementation(() => undefined);
    navigateTo("/cash");
    expect(document.activeElement).not.toBe(currentMain());
    expect(document.activeElement).toBe(document.body);
    expect(document.title).toBe("محافظ الكاش");
    focusSpy.mockRestore();
    /* وبعد إعادة التفعيل: الانتقال التالي يستقبل التركيز مجددًا بالهوية نفسها. */
    navigateTo("/finance");
    expect(document.activeElement).toBe(currentMain());
    expect(document.title).toBe("المالية");
  });
});
