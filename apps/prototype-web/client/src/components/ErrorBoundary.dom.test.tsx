/** @vitest-environment jsdom */

/* التحصين الكامل (المجموعة ٣ + المجموعة ٥): سقوط الواجهة — الحد الأدنى الصادق
 * الآمن مع تشخيص محلي خصوصي. السقوط يعرض بطاقة الاسترداد الهادئة بلا Stack
 * Trace ولا تفاصيل داخلية، ويستقبل التركيز، وزر إعادة الفتح يستدعي إعادة
 * التحميل. المجموعة ٥ أضافت العقد المعتمد: حادثة واحدة بمعرّف آمن تُخزن
 * محليًا في حلقة محدودة — بلا أسماء أو مبالغ أو كائن الاستثناء أبدًا. */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ErrorBoundary from "@/components/ErrorBoundary";
import { localDiagnostics } from "@/application/diagnostics/localDiagnosticsService";

function Bomb(): React.ReactElement {
  throw new Error("خطأ داخلي حساس: 42.00 د.أ من بيانات زبون");
}

const reloadSpy = vi.fn();

function readStoredEntries(): unknown[] {
  const raw = window.localStorage.getItem("micro.diagnostics.v1");
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

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
    vi.restoreAllMocks();
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

  it("records exactly one privacy-safe incident and shows its reference id — nothing else is written", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );

    /* حادثة واحدة فقط — بمعرّف آمن وحقول العقد وحدها. */
    const entries = readStoredEntries();
    expect(entries).toHaveLength(1);
    const entry = entries[0] as Record<string, unknown>;
    expect(typeof entry.errorId).toBe("string");
    expect(entry.errorId as string).toMatch(/^MIC-[0-9a-f]{10}$/);
    expect(entry.appVersion).toBe("micro-local-dev");
    expect(entry.schemaVersion).toBe(35);
    expect(entry.routeTemplate).toBe("/");
    expect(entry.operation).toBe("errorBoundary");
    expect(entry.errorCode).toBe("render_crash");
    expect(typeof entry.timestamp).toBe("string");
    expect(typeof entry.safeMessage).toBe("string");

    /* الخصوصية: لا الرسالة الداخلية ولا المبلغ ولا كائن الاستثناء في السجل. */
    const stored = window.localStorage.getItem("micro.diagnostics.v1") ?? "";
    expect(stored.includes("خطأ داخلي حساس")).toBe(false);
    expect(stored.includes("42.00")).toBe(false);
    expect(stored.includes("Stack")).toBe(false);
    expect(stored.includes("at ")).toBe(false);

    /* المعرّف نفسه ظاهر للمالك — آمن للنسخ اليدوي. */
    const reference = screen.getByText(/^MIC-/);
    expect(reference.textContent).toBe(entry.errorId as string);

    /* لا مفتاح تخزين آخر يُلمس إطلاقًا. */
    expect(window.localStorage.length).toBe(1);
    consoleError.mockRestore();
  });

  it("a failing diagnostics recorder never breaks the boundary, loops it, or invents a reference id", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    /* أسوأ حالة ممكنة: المسجّل نفسه يرمي (العقد يمنع ذلك أصلًا) — الركن
     * يبقى هادئًا بلا معرف ولا خطأ ثانٍ ولا حلقة سقوط. */
    const recordSpy = vi.spyOn(localDiagnostics, "recordIncident").mockImplementation(() => {
      throw new Error("recorder exploded");
    });
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("لم يتم تغيير بياناتك")).toBeTruthy();
    expect(screen.queryByText(/^MIC-/)).toBeNull();
    expect(screen.getByRole("button", { name: "إعادة الفتح" })).toBeTruthy();
    expect(recordSpy).toHaveBeenCalledTimes(1);
    recordSpy.mockRestore();
    consoleError.mockRestore();
  });

  it("malformed diagnostics storage recovers as an empty log without breaking the boundary", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    window.localStorage.setItem("micro.diagnostics.v1", "{garbage-not-json");
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeTruthy();
    /* الاستعادة: القائمة الجديدة تحمل الحادثة الحالية وحدها. */
    const entries = localDiagnostics.list();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.errorCode).toBe("render_crash");
    consoleError.mockRestore();
  });
});
