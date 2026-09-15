/**
 * BrandLaunchSplash — the current-system (Web/PWA) in-app launch splash.
 *
 * Contract:
 * - Shown once per page load at the existing startup boundary (StartupGate), never during
 *   route transitions, button actions or data operations.
 * - Uses the symbol-only mark; Light/Dark asset pairing follows the same resolved theme state
 *   as the shell, and the surface background is the shell canvas token, so there is no
 *   incorrect Light/Dark logo pairing and no white flash between splash release and shell.
 * - Plays the approved one-shot assembly motion once (bounded, never loops, never a spinner),
 *   derived from the supplied 60fps/55-frame Lottie timings using the supplied per-layer SVGs —
 *   no animation dependency added.
 * - `prefers-reduced-motion` renders the final static mark immediately.
 * - Never blocks the app: motion has a bounded fallback timer, and the splash has a hard cap;
 *   if motion assets fail to load the static mark is shown.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "@/contexts/ThemeContext";
import { BrandMark } from "@/components/brand/BrandMark";

type BrandLaunchSplashProps = {
  /** True once the existing startup gate has settled (ready or recovery state). */
  gateSettled: boolean;
  /** Called once, after the bounded release fade, when the splash must unmount. */
  onRelease: () => void;
};

/* The supplied Lottie assembly is 60fps/55 frames; the last layer settles at frame 54 (900ms).
 * Each layer's own motion window is 42 frames (700ms), staggered by 4 frames (66.67ms). */
const LAYER_COUNT = 4;
const LAYER_NAMES = ["top-ink", "right-turquoise", "bottom-taupe", "left-terracotta"] as const;
const MOTION_TOTAL_MS = 900;
const MOTION_FALLBACK_MS = 1600; // bounded fallback if animationend never fires
const RELEASE_FADE_MS = 240;
const SPLASH_MAX_MS = 4000; // hard cap — the app is never blocked by the splash

export const SPLASH_TIMINGS = { MOTION_TOTAL_MS, MOTION_FALLBACK_MS, RELEASE_FADE_MS, SPLASH_MAX_MS };

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function BrandLaunchSplash({ gateSettled, onRelease }: BrandLaunchSplashProps) {
  const { theme } = useTheme();
  /* jsdom and reduced-motion environments take the static path: deterministic, no animation. */
  const [phase, setPhase] = useState<"assemble" | "resolved">(() => (prefersReducedMotion() ? "resolved" : "assemble"));
  const [releasing, setReleasing] = useState(false);
  const releasedRef = useRef(false);
  const onReleaseRef = useRef(onRelease);
  onReleaseRef.current = onRelease;

  const beginRelease = () => {
    if (releasedRef.current) return;
    releasedRef.current = true;
    setReleasing(true);
    window.setTimeout(() => onReleaseRef.current(), RELEASE_FADE_MS);
  };

  /* Bounded motion fallback: if animationend is lost, resolve to the static mark anyway. */
  useEffect(() => {
    if (phase !== "assemble") return;
    const t = window.setTimeout(() => setPhase("resolved"), MOTION_FALLBACK_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  /* Hard cap: release even if the gate never settles. */
  useEffect(() => {
    const t = window.setTimeout(beginRelease, SPLASH_MAX_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Release = gate settled AND motion finished (or skipped/failed), without exceeding the cap. */
  useEffect(() => {
    if (phase === "resolved" && gateSettled) beginRelease();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, gateSettled]);

  const handleLayerError = () => setPhase("resolved");

  const content = (
    <div
      className="micro-launch-splash"
      data-releasing={releasing || undefined}
      data-theme={theme}
      dir="rtl"
    >
      <p className="micro-launch-splash-status" role="status" aria-live="polite">
        جارٍ فتح مشروعك المحلي…
      </p>
      <div className="micro-launch-splash-mark" aria-hidden="true">
        {phase === "assemble" ? (
          LAYER_NAMES.map((name, i) => (
            <img
              key={name}
              src={`/brand/motion/${theme}/${i + 1}-${name}.svg`}
              alt=""
              draggable={false}
              className={`micro-launch-splash-layer micro-launch-splash-layer-${i + 1}`}
              onError={handleLayerError}
              onAnimationEnd={i === LAYER_COUNT - 1 ? () => setPhase("resolved") : undefined}
            />
          ))
        ) : (
          <BrandMark size={120} className="micro-launch-splash-final" />
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
