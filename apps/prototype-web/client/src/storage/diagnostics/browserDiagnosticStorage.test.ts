/**
 * R11 ARCH-010 (موجة المتابعة 2026-10-15): اختبار مهايئ تخزين التشخيص
 * المسجل — يثبت عقد الفشل الآمن كما كان بلا أي تغيير سلوك: التخزين الغائب
 * يُرجع كعبًا يرمي عند القراءة والكتابة معًا (فترجع الخدمة null وتُظهر
 * الواجهة الركن بلا معرف)، والتخزين الحاضر يُمرر كما هو، ودمج الخدمة مع
 * المهايئ الغائب فاشل-آمن بلا رمي — والتشخيص يبقى محليًا غير مالي خارج
 * منفذ التخزين المالية/المحلية (يفرضه الحارس المخصص سلبيًا في
 * scripts/check-diagnostics-storage.test.mjs).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { browserDiagnosticStorage } from "./browserDiagnosticStorage";
import { LocalDiagnosticsService } from "@/application/diagnostics/localDiagnosticsService";

const FAKE_CLOCK = () => "2026-10-15T00:00:00.000Z";

function fakeBrowserStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("browserDiagnosticStorage — the registered diagnostics adapter (R11 ARCH-010)", () => {
  it("returns a throwing stub when browser localStorage is unavailable (no storage at all)", () => {
    const storage = browserDiagnosticStorage();
    expect(() => storage.getItem("micro.diagnostics.v1")).toThrow("diagnostics storage unavailable");
    expect(() => storage.setItem("micro.diagnostics.v1", "[]")).toThrow("diagnostics storage unavailable");
  });

  it("returns a throwing stub when browser localStorage is null (blocked or disabled)", () => {
    vi.stubGlobal("localStorage", null);
    const storage = browserDiagnosticStorage();
    expect(() => storage.getItem("micro.diagnostics.v1")).toThrow("diagnostics storage unavailable");
    expect(() => storage.setItem("micro.diagnostics.v1", "[]")).toThrow("diagnostics storage unavailable");
  });

  it("passes the browser storage through as-is when present", () => {
    const fake = fakeBrowserStorage();
    vi.stubGlobal("localStorage", fake);
    const storage = browserDiagnosticStorage();
    expect(storage).toBe(fake);
    storage.setItem("micro.diagnostics.v1", "[1]");
    expect(storage.getItem("micro.diagnostics.v1")).toBe("[1]");
  });

  it("keeps the service fail-safe end-to-end when storage is unavailable: no throw, null incident, empty list", () => {
    const diagnostics = new LocalDiagnosticsService(browserDiagnosticStorage(), FAKE_CLOCK, "test-identity");
    expect(() => {
      diagnostics.recordIncident({
        operation: "errorBoundary",
        errorCode: "render_crash",
        routeTemplate: "/orders/:id",
      });
    }).not.toThrow();
    expect(
      diagnostics.recordIncident({
        operation: "errorBoundary",
        errorCode: "render_crash",
        routeTemplate: "/orders/:id",
      }),
    ).toBeNull();
    expect(diagnostics.list()).toEqual([]);
    expect(() => diagnostics.reportText()).not.toThrow();
  });

  it("records and reads back through the adapter when storage is present (round trip stays local)", () => {
    vi.stubGlobal("localStorage", fakeBrowserStorage());
    const diagnostics = new LocalDiagnosticsService(browserDiagnosticStorage(), FAKE_CLOCK, "test-identity");
    const errorId = diagnostics.recordIncident({
      operation: "pwaRegister",
      errorCode: "pwa_register_failed",
      routeTemplate: "/",
    });
    expect(errorId).toMatch(/^MIC-[0-9a-f]{10}$/);
    const entries = diagnostics.list();
    expect(entries).toHaveLength(1);
    expect(entries[0].operation).toBe("pwaRegister");
    expect(entries[0].errorCode).toBe("pwa_register_failed");
    expect(entries[0].appVersion).toBe("test-identity");
  });
});
