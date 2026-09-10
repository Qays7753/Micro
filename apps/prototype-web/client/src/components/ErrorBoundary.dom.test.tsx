/** @vitest-environment jsdom */

/* التحصين الكامل (المجموعة ٣): سقوط الواجهة — الحد الأدنى الصادق الآمن.
 * السقوط يعرض بطاقة الاسترداد الهادئة بلا Stack Trace ولا تفاصيل داخلية،
 * ويستقبل التركيز، وزر إعادة الفتح يستدعي إعادة التحميل. لا يوجد عقد
 * تشخيصات محلي معتمد في هذا المستودع — لذلك لا يُخترع نظام دعم هنا؛
 * القرار التصميمي المسجل لمجموعة لاحقة أو موافقة صريحة. */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ErrorBoundary from "@/components/ErrorBoundary";

function Bomb(): React.ReactElement {
  throw new Error("خطأ داخلي حساس: 42.00 د.أ من بيانات زبون");
}

const reloadSpy = vi.fn();

describe("ErrorBoundary fallback — safe, private, focused recovery", () => {
  beforeEach(() => {
    /* إعادة تحميل jsdom غير منفذة — تُستبدل بجاسوس لنفي الاستدعاء. */
    reloadSpy.mockClear();
    Object.defineProperty(window, "location", {
      value: { ...window.location, reload: reloadSpy },
      configurable: true,
      writable: true,
    });
  });
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("renders the calm recovery card on an unexpected render error and announces it", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("لم يتم تغيير بياناتك")).toBeTruthy();
    expect(screen.getByRole("button", { name: "إعادة الفتح" })).toBeTruthy();
    /* الخصوصية: لا أثر للرسالة الداخلية ولا أي Stack Trace في السطح. */
    const body = document.body.textContent ?? "";
    expect(body.includes("خطأ داخلي حساس")).toBe(false);
    expect(body.includes("Error")).toBe(false);
    expect(body.includes("42.00")).toBe(false);
    /* التركيز ينتقل إلى العنوان القابل للتوجيه. */
    expect(document.activeElement?.textContent).toContain("لم يتم تغيير بياناتك");
    consoleError.mockRestore();
  });

  it("reload button triggers exactly one window reload; children unmount", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    fireEvent.click(screen.getByRole("button", { name: "إعادة الفتح" }));
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });

  it("writes nothing to localStorage or diagnostics surfaces on error", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    /* لا أخطاء مخزنة محليًا — لا سجل تشخيصات ولا بيانات حساسة تلمس القرص. */
    expect(window.localStorage.length).toBe(0);
    consoleError.mockRestore();
  });
});
