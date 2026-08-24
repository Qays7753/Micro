import { registerSW } from "virtual:pwa-register";

export type PwaRuntimeState = {
  serviceWorkerSupported: boolean;
  updateAvailable: boolean;
  offlineReady: boolean;
  error: string | null;
};

type PwaListener = () => void;

let state: PwaRuntimeState = {
  serviceWorkerSupported: false,
  updateAvailable: false,
  offlineReady: false,
  error: null,
};
let started = false;
let registration: ServiceWorkerRegistration | undefined;
let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | undefined;
const listeners = new Set<PwaListener>();

function emit() {
  listeners.forEach(listener => listener());
}

function canRegisterServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return false;
  return window.isSecureContext || location.hostname === "localhost" || location.hostname === "127.0.0.1";
}

export function registerPwaServiceWorker() {
  if (started || !canRegisterServiceWorker()) return;
  started = true;
  state = { ...state, serviceWorkerSupported: true };
  emit();

  updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      state = { ...state, updateAvailable: true, error: null };
      emit();
    },
    onOfflineReady() {
      state = { ...state, offlineReady: true, error: null };
      emit();
    },
    onRegisteredSW(_scriptUrl, nextRegistration) {
      registration = nextRegistration;
      void registration?.update().catch(() => undefined);
    },
    onRegisterError(error) {
      state = { ...state, error: "تعذر تفعيل وضع التطبيق المحلي؛ سيستمر Micro من المتصفح." };
      emit();
      console.warn("Micro PWA registration failed", error);
    },
  });
}

export function getPwaRuntimeState() {
  return state;
}

export function subscribePwa(listener: PwaListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function applyPwaUpdate() {
  if (!updateServiceWorker) return;
  state = { ...state, updateAvailable: false };
  emit();
  try {
    await updateServiceWorker(true);
  } catch (error) {
    state = { ...state, updateAvailable: true, error: "تعذر تطبيق التحديث الآن؛ يمكنك المحاولة لاحقًا." };
    emit();
    console.warn("Micro PWA update failed", error);
  }
}

export function checkForPwaUpdate() {
  void registration?.update().catch(() => undefined);
}
