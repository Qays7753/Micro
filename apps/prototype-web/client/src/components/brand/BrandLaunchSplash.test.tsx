/** @vitest-environment jsdom */

/**
 * W3 — BrandLaunchSplash contract tests:
 * initial display, one-shot motion release, reduced-motion static fallback,
 * Light/Dark asset pairing, motion-failure fallback, bounded hard cap.
 */
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrandLaunchSplash } from "@/components/brand/BrandLaunchSplash";

const useThemeMock = vi.fn();
vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => useThemeMock(),
}));

const LIGHT_LAYERS = [
  "/brand/motion/light/1-top-ink.svg",
  "/brand/motion/light/2-right-turquoise.svg",
  "/brand/motion/light/3-bottom-taupe.svg",
  "/brand/motion/light/4-left-terracotta.svg",
];
const DARK_LAYERS = LIGHT_LAYERS.map(src => src.replace("/light/", "/dark/"));
const STATIC_LIGHT = "/brand/mark/micro-quad.svg";
const STATIC_DARK = "/brand/mark/micro-quad-dark.svg";

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("prefers-reduced-motion") ? matches : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

beforeEach(() => {
  useThemeMock.mockReturnValue({ theme: "light" });
  stubMatchMedia(false);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  useThemeMock.mockReset();
});

const splashImgs = (_container: HTMLElement) =>
  Array.from(document.body.querySelectorAll(".micro-launch-splash img"));

describe("BrandLaunchSplash", () => {
  it("shows the symbol-only assembly at boot and does not release before the gate settles", () => {
    const onRelease = vi.fn();
    const { container } = render(<BrandLaunchSplash gateSettled={false} onRelease={onRelease} />);
    const srcs = splashImgs(container).map(img => img.getAttribute("src"));
    expect(srcs).toEqual(LIGHT_LAYERS);
    expect(document.body.querySelector(".micro-launch-splash-status")?.textContent).toContain("جارٍ فتح مشروعك المحلي");
    expect(onRelease).not.toHaveBeenCalled();
  });

  it("releases once after the gate settles and the one-shot motion completes (no loop)", () => {
    vi.useFakeTimers();
    const onRelease = vi.fn();
    const { container, rerender } = render(<BrandLaunchSplash gateSettled={false} onRelease={onRelease} />);
    const layer4 = document.body.querySelector(".micro-launch-splash-layer-4") as HTMLImageElement;
    layer4.dispatchEvent(new window.Event("animationend", { bubbles: true }));
    expect(onRelease).not.toHaveBeenCalled(); // gate not settled yet
    rerender(<BrandLaunchSplash gateSettled onRelease={onRelease} />);
    act(() => {
      vi.advanceTimersByTime(240); // release fade
    });
    expect(onRelease).toHaveBeenCalledTimes(1);
    // Static resolved mark replaces the layers — same box, no shift.
    expect(splashImgs(container).map(img => img.getAttribute("src"))).toEqual([STATIC_LIGHT]);
  });

  it("shows the final static mark immediately under prefers-reduced-motion", () => {
    stubMatchMedia(true);
    vi.useFakeTimers();
    const onRelease = vi.fn();
    const { container } = render(<BrandLaunchSplash gateSettled onRelease={onRelease} />);
    expect(splashImgs(container).map(img => img.getAttribute("src"))).toEqual([STATIC_LIGHT]);
    act(() => {
      vi.advanceTimersByTime(240);
    });
    expect(onRelease).toHaveBeenCalledTimes(1);
  });

  it("pairs the Dark asset set with the dark theme — no Light logo on a Dark surface", () => {
    useThemeMock.mockReturnValue({ theme: "dark" });
    const { container } = render(<BrandLaunchSplash gateSettled={false} onRelease={vi.fn()} />);
    expect(splashImgs(container).map(img => img.getAttribute("src"))).toEqual(DARK_LAYERS);
  });

  it("keeps the product usable when motion assets fail to load — static fallback", () => {
    vi.useFakeTimers();
    const onRelease = vi.fn();
    const { container } = render(<BrandLaunchSplash gateSettled onRelease={onRelease} />);
    const layer1 = document.body.querySelector(".micro-launch-splash-layer-1") as HTMLImageElement;
    act(() => {
      layer1.dispatchEvent(new window.Event("error", { bubbles: true }));
    });
    expect(splashImgs(container).map(img => img.getAttribute("src"))).toEqual([STATIC_LIGHT]);
    act(() => {
      vi.advanceTimersByTime(240);
    });
    expect(onRelease).toHaveBeenCalledTimes(1);
  });

  it("resolves the motion via the bounded fallback even if animationend never fires", () => {
    vi.useFakeTimers();
    const onRelease = vi.fn();
    const { container } = render(<BrandLaunchSplash gateSettled onRelease={onRelease} />);
    act(() => {
      vi.advanceTimersByTime(1600); // MOTION_FALLBACK_MS
    });
    expect(splashImgs(container).map(img => img.getAttribute("src"))).toEqual([STATIC_LIGHT]);
    act(() => {
      vi.advanceTimersByTime(240);
    });
    expect(onRelease).toHaveBeenCalledTimes(1);
  });

  it("never blocks the app: hard cap releases the splash even if the gate never settles", () => {
    vi.useFakeTimers();
    const onRelease = vi.fn();
    render(<BrandLaunchSplash gateSettled={false} onRelease={onRelease} />);
    act(() => {
      vi.advanceTimersByTime(4000); // SPLASH_MAX_MS
    });
    act(() => {
      vi.advanceTimersByTime(240); // release fade
    });
    expect(onRelease).toHaveBeenCalledTimes(1);
  });

  it("renders no wordmark and no lockup — symbol-only surfaces only", () => {
    render(<BrandLaunchSplash gateSettled={false} onRelease={vi.fn()} />);
    const srcs = splashImgs(document.body).map(img => img.getAttribute("src")).join(" ");
    expect(srcs).not.toMatch(/lockup|arabic-|latin-|wordmark|micro-mark/i);
    expect(document.body.querySelector(".micro-launch-splash")?.textContent ?? "").not.toContain("Micro");
  });
});
