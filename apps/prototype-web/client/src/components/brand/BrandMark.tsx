/**
 * Central brand mark — the single runtime owner of the approved symbol-only mark.
 *
 * Contract:
 * - Light renders `/brand/mark/micro-quad.svg`; Dark renders `/brand/mark/micro-quad-dark.svg`.
 * - `compact` may select `/brand/mark/micro-quad-compact.svg` only when the mark is genuinely
 *   small/space-constrained; the compact source ships in the light palette, so Dark always
 *   renders the dark quad regardless of `compact`.
 * - The supplied vector geometry, clear space, open centre, proportions and colors are never
 *   altered at runtime: no redraw, stretch, rotation, fill of the open centre, glyph, gradient,
 *   shadow or glow.
 * - This component is for real brand surfaces only (AppHeader brand mark, launch splash,
 *   identity surfaces) — not for cards, rows, buttons or product-area markers.
 */
import { useTheme } from "@/contexts/ThemeContext";

type BrandMarkProps = {
  /** Accessible name. Empty/undefined string renders a decorative mark (alt="", aria-hidden). */
  label?: string;
  /** Square rendered size in px. Defaults to the header mark size (36px). */
  size?: number;
  /** Prefer the compact geometry for genuinely small renderings (light palette only). */
  compact?: boolean;
  className?: string;
};

const MARK_BASE = "/brand/mark";

export function brandMarkSrc(theme: "light" | "dark", compact: boolean): string {
  if (theme === "dark") return `${MARK_BASE}/micro-quad-dark.svg`;
  return compact ? `${MARK_BASE}/micro-quad-compact.svg` : `${MARK_BASE}/micro-quad.svg`;
}

export function BrandMark({ label, size = 36, compact = false, className }: BrandMarkProps) {
  const { theme } = useTheme();
  const decorative = !label;
  return (
    <img
      src={brandMarkSrc(theme, compact)}
      alt={decorative ? "" : label}
      aria-hidden={decorative || undefined}
      role={decorative ? undefined : "img"}
      width={size}
      height={size}
      className={className}
      data-brand-mark=""
      draggable={false}
    />
  );
}
