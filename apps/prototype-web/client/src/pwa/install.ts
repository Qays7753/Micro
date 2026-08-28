export type BeforeInstallPromptEvent = Event & {
  readonly platforms?: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt: () => Promise<void>;
};

type StandaloneNavigator = Navigator & { standalone?: boolean };
type StandaloneWindow = Pick<Window, "matchMedia">;

export function isStandaloneMode(
  windowObject: StandaloneWindow = window,
  navigatorObject: StandaloneNavigator = navigator as StandaloneNavigator,
) {
  const displayModeStandalone = windowObject.matchMedia("(display-mode: standalone)").matches;
  return displayModeStandalone || navigatorObject.standalone === true;
}

export function isIosSafari(
  userAgent = navigator.userAgent,
  platform = navigator.platform,
  maxTouchPoints = navigator.maxTouchPoints,
) {
  const isAppleMobileDevice =
    /iPhone|iPad|iPod/i.test(userAgent) || (platform === "MacIntel" && maxTouchPoints > 1);
  const isSafari = /Safari\//i.test(userAgent);
  const isOtherIosBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//i.test(userAgent);
  return isAppleMobileDevice && isSafari && !isOtherIosBrowser;
}

export function isBeforeInstallPromptEvent(event: Event): event is BeforeInstallPromptEvent {
  const candidate = event as Partial<BeforeInstallPromptEvent>;
  return typeof candidate.prompt === "function" && candidate.userChoice instanceof Promise;
}

/** نافذة إخفاء بطاقة التثبيت: ثلاثون يومًا، ثم يجوز للبطاقة العودة مرة واحدة. */
const INSTALL_BANNER_DISMISSAL_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export function isInstallBannerDismissalActive(
  dismissedAt: string | null | undefined,
  now: string,
): boolean {
  if (!dismissedAt) return false;
  const dismissed = Date.parse(dismissedAt);
  const current = Date.parse(now);
  if (Number.isNaN(dismissed) || Number.isNaN(current)) return false;
  return current - dismissed < INSTALL_BANNER_DISMISSAL_WINDOW_MS;
}
