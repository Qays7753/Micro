/** @vitest-environment jsdom */

/**
 * W2 — BrandMark contract tests: symbol-only mark, theme-correct asset, a11y, stable box.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BrandMark, brandMarkSrc } from "@/components/brand/BrandMark";

/* ThemeContext is mocked at the module boundary: BrandMark must trust the same resolved
 * theme state as the shell (no independent system-media reads — Micro never follows OS). */
const useThemeMock = vi.fn();
vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => useThemeMock(),
}));

afterEach(() => {
  cleanup();
  useThemeMock.mockReset();
});

describe("brandMarkSrc selection", () => {
  it("light resolves the light quad", () => {
    expect(brandMarkSrc("light", false)).toBe("/brand/mark/micro-quad.svg");
  });

  it("dark resolves the dark quad", () => {
    expect(brandMarkSrc("dark", false)).toBe("/brand/mark/micro-quad-dark.svg");
  });

  it("compact applies only in light — dark always renders the dark quad", () => {
    expect(brandMarkSrc("light", true)).toBe("/brand/mark/micro-quad-compact.svg");
    expect(brandMarkSrc("dark", true)).toBe("/brand/mark/micro-quad-dark.svg");
  });
});

describe("BrandMark component", () => {
  it("renders the theme-correct asset with stable square dimensions", () => {
    useThemeMock.mockReturnValue({ theme: "light" });
    const { container } = render(<BrandMark size={36} />);
    const img = container.querySelector("img[data-brand-mark]");
    expect(img).toBeTruthy();
    expect(img?.getAttribute("src")).toBe("/brand/mark/micro-quad.svg");
    expect(img?.getAttribute("width")).toBe("36");
    expect(img?.getAttribute("height")).toBe("36");
  });

  it("re-renders the dark asset when the resolved theme flips — no pairing mismatch", () => {
    useThemeMock.mockReturnValue({ theme: "light" });
    const { container, rerender } = render(<BrandMark size={120} />);
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/brand/mark/micro-quad.svg");
    useThemeMock.mockReturnValue({ theme: "dark" });
    rerender(<BrandMark size={120} />);
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/brand/mark/micro-quad-dark.svg");
  });

  it("is decorative by default (alt='', aria-hidden) to keep the AppHeader a11y contract", () => {
    useThemeMock.mockReturnValue({ theme: "light" });
    const { container } = render(<BrandMark />);
    const img = container.querySelector("img");
    expect(img?.getAttribute("alt")).toBe("");
    expect(img?.getAttribute("aria-hidden")).toBe("true");
    expect(img?.getAttribute("role")).toBeNull();
  });

  it("exposes an accessible name when a label is provided", () => {
    useThemeMock.mockReturnValue({ theme: "dark" });
    render(<BrandMark label="مايكرو" />);
    const img = screen.getByRole("img", { name: "مايكرو" });
    expect(img.getAttribute("src")).toBe("/brand/mark/micro-quad-dark.svg");
    expect(img.getAttribute("aria-hidden")).toBeNull();
  });

  it("never references the rejected wordmark/lockup assets", () => {
    useThemeMock.mockReturnValue({ theme: "light" });
    const { container } = render(<BrandMark compact />);
    const src = container.querySelector("img")?.getAttribute("src") ?? "";
    expect(src).not.toMatch(/lockup|arabic|latin|wordmark|micro-mark/i);
  });
});
