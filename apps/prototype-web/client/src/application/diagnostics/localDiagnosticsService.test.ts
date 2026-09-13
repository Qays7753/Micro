/** المجموعة ٥ (التحصين الكامل — التشخيص المحلي الخصوصي): الحلقة المحدودة،
 * الحقول المسموحة وحدها، التعافي من التخزين المعطوب، فشل الكتابة بلا رمي،
 * والتقرير اليدوي المحلي بلا أي إرسال — إثباتًا بإعادة قراءة التخزين. */
import { describe, expect, it, vi } from "vitest";
import {
  LocalDiagnosticsService,
  MAX_DIAGNOSTIC_ENTRIES,
  MAX_DIAGNOSTIC_TOTAL_BYTES,
  type DiagnosticStorage,
} from "./localDiagnosticsService";
import { routeTemplateFor } from "./routeTemplate";

const NOW = "2026-09-11T09:00:00.000Z";
const TPLUS = (minutes: number) => new Date(Date.parse(NOW) + minutes * 60_000).toISOString();

function storageRef(): DiagnosticStorage & { map: Map<string, string>; failSet: boolean } {
  const map = new Map<string, string>();
  const harness: DiagnosticStorage & { map: Map<string, string>; failSet: boolean } = {
    map,
    failSet: false,
    getItem: key => {
      if (harness.failSet) throw new Error("unavailable");
      return map.get(key) ?? null;
    },
    setItem: (key, value) => {
      if (harness.failSet) throw new Error("quota exceeded");
      map.set(key, value);
    },
  };
  return harness;
}

function service(storage: ReturnType<typeof storageRef>, clock: () => string = () => NOW) {
  return new LocalDiagnosticsService(storage, clock, "test-identity");
}

const incident = (routeTemplate = "/orders/:id") => ({
  operation: "errorBoundary",
  errorCode: "render_crash" as const,
  routeTemplate,
});

describe("local diagnostics ring buffer (group 5 — bounded, private, local-only)", () => {
  it("records one incident with exactly the allowed fields and returns its errorId", () => {
    const storage = storageRef();
    const diagnostics = service(storage);
    const errorId = diagnostics.recordIncident(incident());
    expect(errorId).toMatch(/^MIC-[0-9a-f]{10}$/);
    const entries = diagnostics.list();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      errorId,
      appVersion: "test-identity",
      schemaVersion: 35,
      routeTemplate: "/orders/:id",
      operation: "errorBoundary",
      errorCode: "render_crash",
      timestamp: NOW,
      safeMessage: "تعذر عرض الشاشة ولم تتغير أي بيانات.",
    });
  });

  it("keeps the newest entries first and drops the oldest beyond the entry-count bound", () => {
    const storage = storageRef();
    let clock = NOW;
    const diagnostics = service(storage, () => clock);
    for (let index = 0; index < MAX_DIAGNOSTIC_ENTRIES + 7; index += 1) {
      diagnostics.recordIncident(incident("/"));
      clock = TPLUS(index + 1);
    }
    const entries = diagnostics.list();
    expect(entries).toHaveLength(MAX_DIAGNOSTIC_ENTRIES);
    /* الأحدث أولًا حتميًا: أول إدخال هو آخر حادثة زمنًا. */
    expect(entries[0]?.timestamp).toBe(TPLUS(MAX_DIAGNOSTIC_ENTRIES + 6));
    expect(entries[entries.length - 1]?.timestamp).toBe(TPLUS(7));
  });

  it("bounds the total byte size and always keeps at least the latest incident", () => {
    const storage = storageRef();
    const diagnostics = service(storage);
    for (let index = 0; index < 60; index += 1) {
      expect(diagnostics.recordIncident(incident("/"))).not.toBeNull();
    }
    const entries = diagnostics.list();
    const serialized = storage.map.get("micro.diagnostics.v1") ?? "";
    expect(new TextEncoder().encode(serialized).length).toBeLessThanOrEqual(MAX_DIAGNOSTIC_TOTAL_BYTES);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.length).toBeLessThanOrEqual(MAX_DIAGNOSTIC_ENTRIES);
  });

  it("recovers from malformed storage as an empty log without throwing", () => {
    const storage = storageRef();
    storage.map.set("micro.diagnostics.v1", "{garbage");
    const diagnostics = service(storage);
    expect(diagnostics.list()).toEqual([]);
    /* الاستعادة مستمرة: تسجيل جديد بعد المعطوب يعمل. */
    const errorId = diagnostics.recordIncident(incident("/"));
    expect(errorId).not.toBeNull();
    expect(diagnostics.list()).toHaveLength(1);
  });

  it("filters injected non-conforming entries out of the list (defense in depth)", () => {
    const storage = storageRef();
    storage.map.set(
      "micro.diagnostics.v1",
      JSON.stringify([
        {
          errorId: "EVIL-INJECTION",
          appVersion: "x",
          schemaVersion: 1,
          routeTemplate: "/",
          operation: "o",
          errorCode: "render_crash",
          timestamp: NOW,
          safeMessage: "m",
        },
        {
          errorId: "MIC-0000000000",
          appVersion: "x",
          schemaVersion: 35,
          routeTemplate: "/",
          operation: "o",
          errorCode: "unknown_error",
          timestamp: NOW,
          safeMessage: "m",
        },
      ]),
    );
    const diagnostics = service(storage);
    const entries = diagnostics.list();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.errorId).toBe("MIC-0000000000");
  });

  it("a write failure returns null and never throws — no second error, no blocking", () => {
    const storage = storageRef();
    const diagnostics = service(storage);
    storage.failSet = true;
    expect(() => diagnostics.recordIncident(incident("/"))).not.toThrow();
    expect(diagnostics.recordIncident(incident("/"))).toBeNull();
    expect(diagnostics.list()).toEqual([]);
  });

  it("the manual report contains only the approved safe fields and no secrets", () => {
    const storage = storageRef();
    const diagnostics = service(storage);
    diagnostics.recordIncident(incident("/cash/wallet/:id"));
    const report = diagnostics.reportText();
    const parsed = JSON.parse(report) as Record<string, unknown>;
    expect(Object.keys(parsed).sort()).toEqual(["appVersion", "entries", "generatedAt", "schemaVersion"]);
    const entry = (parsed.entries as Array<Record<string, unknown>>)[0];
    expect(Object.keys(entry).sort()).toEqual([
      "appVersion",
      "errorCode",
      "errorId",
      "operation",
      "routeTemplate",
      "safeMessage",
      "schemaVersion",
      "timestamp",
    ]);
    /* لا أسماء ولا مبالغ ولا رموز ولا مسارات خام ولا استعلامات. */
    expect(report).not.toContain("note");
    expect(report).not.toContain("pin");
    expect(report).not.toContain("token");
    expect(entry.routeTemplate).toBe("/cash/wallet/:id");
  });

  it("makes no network requests — no fetch/XHR/sendBeacon in any path", () => {
    const fetchSpy = vi.fn();
    const beaconSpy = vi.fn();
    globalThis.fetch = fetchSpy as never;
    (navigator as unknown as { sendBeacon: unknown }).sendBeacon = beaconSpy;
    const storage = storageRef();
    const diagnostics = service(storage);
    for (let index = 0; index < 5; index += 1) diagnostics.recordIncident(incident("/"));
    diagnostics.reportText();
    diagnostics.list();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(beaconSpy).not.toHaveBeenCalled();
    delete (globalThis as { fetch?: unknown }).fetch;
  });
});

describe("route template redaction (group 5 — parameters and queries never stored)", () => {
  it("redacts known dynamic segments to their templates and drops the query entirely", () => {
    expect(routeTemplateFor("/orders/ord-123")).toBe("/orders/:id");
    expect(routeTemplateFor("/cash/wallet/wallet-9/adjust?x=1&secret=99")).toBe("/cash/wallet/:id/adjust");
    expect(routeTemplateFor("/finance/new/operating_expense_cash")).toBe("/finance/new/:type");
    expect(routeTemplateFor("/orders/draft/abc/cost#fragment")).toBe("/orders/draft/:id/cost");
    expect(routeTemplateFor("/")).toBe("/");
    expect(routeTemplateFor("/settings")).toBe("/settings");
  });

  it("an unknown route collapses to /unknown — the raw path is never stored", () => {
    expect(routeTemplateFor("/totally/unknown/route/with-id-99")).toBe("/unknown");
    expect(routeTemplateFor("/private/path?token=abc")).toBe("/unknown");
  });
});
