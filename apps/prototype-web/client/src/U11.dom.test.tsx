/** @vitest-environment jsdom */

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import Settings from "@/pages/Settings";
import { ThemeProvider } from "@/contexts/ThemeContext";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/settings", vi.fn()],
  useParams: () => ({}),
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);

describe("Settings backup actions carry visible Arabic labels (U-11)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    );
    mockedUsePrototypeServices.mockReturnValue({
      preferences: {
        load: vi.fn(async () => ({ ok: true, preference: "system" })),
        save: vi.fn(async () => ({ ok: true, preference: "dark" })),
        readBrowserPersistence: vi.fn(async () => ({
          state: "unsupported",
          title: "التخزين الدائم غير مدعوم في هذا المتصفح",
          text: "لا يعلن هذا المتصفح حالة الدوام.",
        })),
      },
      actualTime: {
        readOperatingMode: vi.fn(async () => ({
          ok: true,
          value: { workMode: null, actualTimeTrackingEnabled: false },
        })),
        saveOperatingMode: vi.fn(),
      },
      transfers: { createExport: vi.fn(), prepareImport: vi.fn(), confirmImport: vi.fn() },
      guidedOpeningImport: { prepare: vi.fn(), confirm: vi.fn() },
      dataVersion: 0,
      notifyDataChanged: vi.fn(),
    } as unknown as ReturnType<typeof usePrototypeServices>);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it("labels the export and import actions in words, not icons alone", async () => {
    render(
      <ThemeProvider defaultTheme="system" switchable>
        <Settings />
      </ThemeProvider>,
    );
    await waitFor(() => expect(screen.getByRole("heading", { name: "احمِ بياناتك" })).toBeTruthy());

    const exportButton = screen.getByRole("button", { name: "تصدير البيانات المحلية" });
    const importButton = screen.getByRole("button", { name: "اختيار ملف استيراد" });
    expect(exportButton.textContent).toContain("تصدير");
    expect(importButton.textContent).toContain("استيراد");

    // The data-protection layer stands open, so the safest actions are not hidden.
    const layer = document.querySelector("details.micro-decision-layer");
    expect(layer).toBeTruthy();
    expect(layer!.hasAttribute("open")).toBe(true);
  });
});
