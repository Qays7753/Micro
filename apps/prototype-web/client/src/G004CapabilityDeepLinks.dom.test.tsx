/** @vitest-environment jsdom */
/* G-004 (تدقيق الإدارة المالية المتدرجة 2026-09-19): الرابط العميق البارد
 * إلى مسار إنشاء قدرة متوقفة لا يتجاوز الحرس — وضع «قدرة متوقفة» الصادق
 * بفعل رجوع آمن ووصول للإعدادات، والمسار المفعل يفتح المحرر كما كان،
 * ومسارات السجلات القائمة (تصحيح/عكس) لا تُحرس أبدًا. */
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { PreferenceService } from "@/application/preferences/preferenceService";
import { CapabilityCreateGate } from "@/app/CapabilityRouteGate";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/orders/draft/new",
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => ({}),
  useSearch: () => "",
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-09-20T09:00:00.000Z";
let store: MemoryLocalStore;
let preferences: PreferenceService;

function GateHarness({
  capability,
  isCreate,
  children,
}: {
  capability: "orders" | "inventory" | "suppliers" | "catalog";
  isCreate: boolean;
  children: React.ReactNode;
}) {
  const [version, setVersion] = React.useState(0);
  mockedUsePrototypeServices.mockImplementation(
    () =>
      ({
        preferences,
        dataVersion: version,
        notifyDataChanged: () => setVersion(v => v + 1),
      }) as unknown as ReturnType<typeof usePrototypeServices>,
  );
  return (
    <CapabilityCreateGate capability={capability} isCreate={isCreate}>
      {children}
    </CapabilityCreateGate>
  );
}

async function setCapabilities(disabled: readonly string[]) {
  const saved = await preferences.saveDisabledCapabilities(disabled);
  if (!saved.ok) throw new Error(saved.message);
}

describe("G-004 — cold deep links cannot bypass a disabled create route", () => {
  beforeEach(() => {
    wouterMocks.navigate.mockReset();
    vi.clearAllMocks();
    store = new MemoryLocalStore();
    preferences = new PreferenceService(store, () => NOW);
  });
  afterEach(() => cleanup());

  it("cold deep link to a disabled create route shows the disabled state, never the editor", async () => {
    await setCapabilities(["orders"]);
    render(
      <GateHarness capability="orders" isCreate={true}>
        <div data-testid="editor-should-not-render">EDITOR</div>
      </GateHarness>,
    );
    const disabledState = await screen.findByTestId("capability-disabled-state");
    expect(disabledState.textContent).toContain("متوقفة عن الإدخال");
    expect(screen.queryByTestId("editor-should-not-render")).toBeNull();
    /* فعلان صادقان: إعادة التفعيل من الإعدادات ورجوع آمن. */
    expect(screen.getByRole("button", { name: /الإعدادات/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /مشروعي الآن/ })).toBeTruthy();
  });

  it("the same create route with the capability enabled opens the editor", async () => {
    await setCapabilities([]);
    render(
      <GateHarness capability="orders" isCreate={true}>
        <div data-testid="editor-should-render">EDITOR</div>
      </GateHarness>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("editor-should-render")).toBeTruthy();
    });
    expect(screen.queryByTestId("capability-disabled-state")).toBeNull();
  });

  it("existing-record routes are never gated (isCreate false renders children even when disabled)", async () => {
    await setCapabilities(["suppliers"]);
    render(
      <GateHarness capability="suppliers" isCreate={false}>
        <div data-testid="existing-record-view">RECORD</div>
      </GateHarness>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("existing-record-view")).toBeTruthy();
    });
  });

  it("until the preference read settles the gate shows loading, not the editor (no flash)", async () => {
    /* قراءة بطيئة: التفضيل لا يُحل إلا بعد نداء يدوي — الحرس يعرض حالة
     * التحميل لا المحرر، فلا وميض محرر قبل السدل. */
    /* حامل مرجعي — إسناد داخل وعاء الوعد لا يضيّق النوع عند النداء اللاحق. */
    const resolveReadRef: {
      current: ((value: { ok: boolean; disabled: readonly string[] }) => void) | null;
    } = { current: null };
    const slowPreferences = {
      readDisabledCapabilities: () =>
        new Promise<{ ok: boolean; disabled: readonly string[] }>(resolve => {
          resolveReadRef.current = resolve;
        }),
    };
    mockedUsePrototypeServices.mockImplementation(
      () => ({ preferences: slowPreferences }) as unknown as ReturnType<typeof usePrototypeServices>,
    );
    render(
      <CapabilityCreateGate capability="orders" isCreate={true}>
        <div data-testid="editor-should-not-flash">EDITOR</div>
      </CapabilityCreateGate>,
    );
    expect(screen.queryByTestId("editor-should-not-flash")).toBeNull();
    await screen.findByRole("status");
    resolveReadRef.current?.({ ok: true, disabled: [] });
    await waitFor(() => {
      expect(screen.getByTestId("editor-should-not-flash")).toBeTruthy();
    });
  });

  it("the router wires the guard around every create route (structural source check)", () => {
    /* مسح مصدري بنمط حراسة StateRecovery.w44 — الحرس على مسارات الإنشاء
     * الأربعة في الراوتر: مسودة جديدة، شراء جديد، مادة جديدة، حركة جديدة. */
    const routerSource = readFileSync("client/src/app/MicroRouter.tsx", "utf-8");
    expect((routerSource.match(/CapabilityCreateGate/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect(routerSource).toContain('capability="orders"');
    expect(routerSource).toContain('capability="suppliers"');
    expect(routerSource).toContain('capability="inventory"');
    expect(routerSource).toContain('isCreate={params.id === "new"}');
    /* ومسارات السجلات القائمة (تأكيد/عكس) خارج الحرس. */
    expect(routerSource).toContain('<Route path="/inventory/material/:id/confirm"');
    expect(routerSource).toContain('<Route path="/inventory/movement/:id/reverse"');
  });
});
