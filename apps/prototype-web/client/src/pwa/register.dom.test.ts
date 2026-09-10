/** @vitest-environment jsdom */

/* التحصين الكامل (المجموعة ٣): مسار تحديث عامل الخدمة — المنطق الحقيقي في
 * pwa/register.ts يُختبر حتميًا: onNeedReload لا يعيد التحميل تلقائيًا فوق
 * نموذج قذر (عقد ٣٨)، وإعادة التحميل مرة واحدة على الأكثر، والتحديث اليدوي
 * يمر عبر updateServiceWorker(true) (رسالة SKIP_WAITING)، وإعادة الفحص عند
 * عودة الظهور. مستوى jsdom فقط — لا يُدّعى اختبار متصفح حقيقي؛ ذلك مقرر
 * على أداة متصفح غير موجودة بعد (موثق في قيود المجموعة ٣). */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const registerSWMock = vi.hoisted(() => vi.fn());
const updateSWMock = vi.hoisted(() => vi.fn());

vi.mock("@/pwa/registerSW.virtual", () => ({
  registerSW: registerSWMock,
}));

type CapturedOptions = {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onRegisteredSW?: (scriptUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
  onRegisterError?: (error: Error) => void;
};

async function freshRegister() {
  const captured: { options?: CapturedOptions } = {};
  registerSWMock.mockImplementation((options: CapturedOptions = {}) => {
    captured.options = options;
    return updateSWMock;
  });
  const module = await import("@/pwa/register");
  const dirty = await import("@/pwa/dirtyRegistry");
  return { module, dirty, captured };
}

describe("PWA service-worker update path (register.ts — deterministic jsdom level)", () => {
  let reloadSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    registerSWMock.mockReset();
    updateSWMock.mockReset();
    vi.stubEnv("PROD", true);
    Object.defineProperty(navigator, "serviceWorker", {
      value: {},
      configurable: true,
    });
    reloadSpy = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...window.location, reload: reloadSpy },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("registers once with immediate:true and exposes the update state machine", async () => {
    const { module, captured } = await freshRegister();
    expect(module.getPwaRuntimeState().serviceWorkerSupported).toBe(false);
    module.registerPwaServiceWorker();
    expect(registerSWMock).toHaveBeenCalledTimes(1);
    expect(registerSWMock.mock.calls[0]![0]).toMatchObject({ immediate: true });
    expect(module.getPwaRuntimeState().serviceWorkerSupported).toBe(true);
    /* onNeedRefresh ترفع حالة التحديث المتاح — البطاقة تُبنى منها. */
    captured.options!.onNeedRefresh!();
    expect(module.getPwaRuntimeState().updateAvailable).toBe(true);
    captured.options!.onOfflineReady!();
    expect(module.getPwaRuntimeState().offlineReady).toBe(true);
  });

  it("clean path: onNeedReload reloads exactly once — a second trigger never reloads again", async () => {
    const { module, dirty, captured } = await freshRegister();
    dirty.setDirtyForms(0);
    module.registerPwaServiceWorker();
    captured.options!.onNeedReload!();
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    captured.options!.onNeedReload!();
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it("dirty path: onNeedReload refuses to reload over unsaved work (contract 38)", async () => {
    const { module, dirty, captured } = await freshRegister();
    module.registerPwaServiceWorker();
    dirty.setDirtyForms(1);
    captured.options!.onNeedReload!();
    expect(reloadSpy).not.toHaveBeenCalled();
    /* الجسر نفسه: تنظيف القذارة يسمح بإعادة التحميل — لكن مرة واحدة فقط. */
    dirty.setDirtyForms(0);
    captured.options!.onNeedReload!();
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it("manual applyPwaUpdate drives updateServiceWorker(true) — the SKIP_WAITING message", async () => {
    const { module } = await freshRegister();
    module.registerPwaServiceWorker();
    await module.applyPwaUpdate();
    expect(updateSWMock).toHaveBeenCalledWith(true);
  });

  it("onRegisteredSW stores the registration so visibility re-check calls registration.update", async () => {
    const { module, captured } = await freshRegister();
    module.registerPwaServiceWorker();
    const update = vi.fn().mockResolvedValue(undefined);
    captured.options!.onRegisteredSW!("sw.js", { update } as unknown as ServiceWorkerRegistration);
    /* تسجيل الموثّق نفسه يستدعي update فور التسجيل (فحص لحظي) — ثم فحص
     * الظهور اليدوي يضيف نداءً ثانيًا: نداءان لا أكثر. */
    expect(update).toHaveBeenCalledTimes(1);
    module.checkForPwaUpdate();
    expect(update).toHaveBeenCalledTimes(2);
  });

  it("guards non-PROD and unsupported browsers: no registration attempted", async () => {
    vi.stubEnv("PROD", false);
    const { module } = await freshRegister();
    module.registerPwaServiceWorker();
    expect(registerSWMock).not.toHaveBeenCalled();
    expect(module.getPwaRuntimeState().serviceWorkerSupported).toBe(false);
  });
});
