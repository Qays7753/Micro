/* التحصين الكامل (المجموعة ٣): كعب اختباري لوحدة virtual:pwa-register —
 * يشكّل واجهة vite-plugin-pwa نفسها (registerSW) كي يمكن اختبار مسار تحديث
 * عامل الخدمة الحقيقي (register.ts) حتميًا في jsdom. لا يُستورد في بناء
 * المنتج إطلاقًا: vitest.config.ts وحده يحوّل الوحدة الافتراضية إليه. */
export type RegisterSWImmediateOptions = {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onRegisteredSW?: (scriptUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
  onRegisterError?: (error: Error) => void;
};

export function registerSW(_options: RegisterSWImmediateOptions = {}) {
  return async function updateServiceWorker(_reloadPage?: boolean) {
    /* no-op في الاختبار — تتحكم به الاختبارات عبر vi.mock على هذا الملف. */
  };
}
