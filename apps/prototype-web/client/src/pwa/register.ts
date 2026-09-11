import { hasDirtyForms } from "./dirtyRegistry";
import { registerSW } from "virtual:pwa-register";
import { localDiagnostics } from "@/application/diagnostics/localDiagnosticsService";
import { routeTemplateFor } from "@/application/diagnostics/routeTemplate";

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
let visibilityHandlerRegistered = false;
let reloadRequested = false;
const listeners = new Set<PwaListener>();

function emit() {
  listeners.forEach(listener => listener());
}

/* المجموعة ٥ (التحصين الكامل): فشل تسجيل الخدمة يسجّل حادثة محلية
 * بينتين الأماميات — رمز مطبوع وقالب مسار مخفي فقط؛ الكائن
 * الخام لا يدخل السجل أبدًا؛ والفشل هنا لا ينتج خطأًثانيًا. */
function recordPwaIncident(errorCode: "pwa_register_failed" | "pwa_update_failed"): void {
  try {
    localDiagnostics.recordIncident({
      operation: "pwaRegister",
      errorCode,
      routeTemplate: routeTemplateFor(globalThis.location?.pathname ?? "/"),
    });
  } catch {
    /* السجل رفاهية لا عقبة. */
  }
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
    onNeedReload() {
      /* المجموعة ٥ (عقد ٣٨): لا إعادة تحميل تلقائية فوق نموذج قذر — العمل
       * غير المحفوظ أغلى من سرعة التحديث؛ يُطلب القرار اليدوي من البطاقة.
       * (تصحيح S2-11: كان السلوك يعيد التحميل مباشرة بلا سؤال.) */
      if (hasDirtyForms()) return;
      if (reloadRequested) return;
      reloadRequested = true;
      window.location.reload();
    },
    onRegisteredSW(_scriptUrl, nextRegistration) {
      registration = nextRegistration;
      void registration?.update().catch(() => undefined);
    },
    onRegisterError(error) {
      state = { ...state, error: "تعذر تفعيل وضع التطبيق المحلي؛ سيستمر Micro من المتصفح." };
      emit();
      console.warn("Micro PWA registration failed", error);
      recordPwaIncident("pwa_register_failed");
    },
  });

  if (!visibilityHandlerRegistered) {
    document.addEventListener("visibilitychange", handleVisibilityChange);
    visibilityHandlerRegistered = true;
  }
}

export function getPwaRuntimeState() {
  return state;
}

export function subscribePwa(listener: PwaListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
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
    recordPwaIncident("pwa_update_failed");
  }
}

function handleVisibilityChange() {
  if (document.visibilityState === "visible") checkForPwaUpdate();
}

export function checkForPwaUpdate() {
  void registration?.update().catch(() => undefined);
}
