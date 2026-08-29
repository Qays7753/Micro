/** @vitest-environment jsdom */

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { PwaInstallControl } from "@/pwa/PwaInstallControl";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);

function promptEvent(): Event {
  const event = new Event("beforeinstallprompt");
  Object.assign(event, {
    prompt: vi.fn(async () => undefined),
    userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }),
    preventDefault: vi.fn(),
  });
  return event as Event;
}

describe("PwaInstallControl dismissal persistence (U-10)", () => {
  let dismissedAt: string | null;

  beforeEach(() => {
    dismissedAt = null;
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    );
    mockedUsePrototypeServices.mockReturnValue({
      preferences: {
        readInstallBannerDismissal: vi.fn(async () => ({ ok: true, dismissedAt })),
        saveInstallBannerDismissal: vi.fn(async () => {
          dismissedAt = "2026-08-29T09:00:00.000Z";
          return { ok: true, dismissedAt };
        }),
      },
    } as unknown as ReturnType<typeof usePrototypeServices>);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it("shows the banner when no dismissal stands", async () => {
    render(<PwaInstallControl />);
    act(() => {
      window.dispatchEvent(promptEvent());
    });
    expect(await screen.findByRole("heading", { name: "ثبّت Micro على جهازك" })).toBeTruthy();
  });

  it("renders nothing once dismissed, including after a remount", async () => {
    render(<PwaInstallControl />);
    act(() => {
      window.dispatchEvent(promptEvent());
    });
    expect(await screen.findByRole("heading", { name: "ثبّت Micro على جهازك" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "ليس الآن" }));
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "ثبّت Micro على جهازك" })).not.toBeTruthy(),
    );

    // Remount simulates a reload: the persisted dismissal keeps the banner away.
    cleanup();
    render(<PwaInstallControl />);
    act(() => {
      window.dispatchEvent(promptEvent());
    });
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(screen.queryByRole("heading", { name: "ثبّت Micro على جهازك" })).not.toBeTruthy();
  });
});
