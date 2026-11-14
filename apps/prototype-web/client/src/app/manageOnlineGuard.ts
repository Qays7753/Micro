/**
 * EX-D23 (M6 — 2026-11-14): الوضع المتصل-فقط المحروس لـManage.
 *
 * الحدود الحاكمة (أمر المالك 2026-11-14 §4/§6-M6): العلم معطل افتراضيًا لكل
 * مساحة، ولا يُفعَّل إلا بقرار المشغل المباشر بعد بوابة المالك النهائية
 * (مراجعة الترحيل والاسترداد) — لا مسار API يبدّله إطلاقًا. حتى ذلك الحين:
 * كتابة المالك المحلية والتصدير والاسترداد يعملون تمامًا كما هم.
 *
 * آلية الحارس عند تفعيل المشغل للعلم فقط: كل كتابة مالية محلية (وصفات
 * commit* المحروسة على منفذ المخزن) تُرفض رفضًا صادقًا — لا طابور تزامن ولا
 * كتابة دون اتصال ولا آخر-كاتب-يفوز؛ والتصدير/الاستبدال المحمي/القراءة
 * المحلية كلها باقية (مصدر الاسترداد). فشل قراءة الوضع = المحلي (الفتح نحو
 * الواقع الحالي هو الأمانة، لا العكس).
 */
import type { PrototypeLocalStore } from "@/storage/local/types";
import { fetchManageMode } from "@/application/network";

export type ManageOnlineModeState = "local" | "online_only";

let cachedMode: ManageOnlineModeState = "local";

export function currentManageOnlineMode(): ManageOnlineModeState {
  return cachedMode;
}

/** For tests: reset the cache to the startup default. */
export function resetManageOnlineModeForTest(): void {
  cachedMode = "local";
}

/** For tests/operator-verified flows: set the cached mode directly. */
export function setManageOnlineModeForTest(mode: ManageOnlineModeState): void {
  cachedMode = mode;
}

/**
 * اقرأ الوضع من الخادم مرة (عند الإقلاع). كل فشل — شبكة/غير موثق/غير مربوط/
 * غير مهيأ — يعني «محلي»: الكتابة المحلية هي الواقع الحالي والوضع لا يُفعَّل
 * إلا بقرار مشغل صريح موثق.
 */
export async function refreshManageOnlineMode(): Promise<ManageOnlineModeState> {
  try {
    const mode = await fetchManageMode();
    cachedMode = mode.onlineOnly ? "online_only" : "local";
  } catch {
    cachedMode = "local";
  }
  return cachedMode;
}

/** الرفض الصادق عند تفعيل وضع القطع: لا كتابة مالية محلية في الوضع المتصل. */
export class ManageOnlineOnlyError extends Error {
  constructor() {
    super(
      "الكتابة المالية متصلة فقط في وضع القطع — لا كتابة محلية دون اتصال ولا طابور تزامن؛ التصدير المحلي متاح دائمًا للاسترداد.",
    );
    this.name = "ManageOnlineOnlyError";
  }
}

export function assertLocalFinancialWriteAllowed(): void {
  if (cachedMode === "online_only") {
    throw new ManageOnlineOnlyError();
  }
}

/**
 * غلاف الحارس حول المخزن الوحيد: يمرر كل شيء كما هو، ويعترض وصفات
 * commit* (الكتابات المالية المحروسة وحدها) بفحص الحارس. لا يمس القراءة
 * ولا المسودات ولا التفضيلات ولا replaceSnapshot/runProtectedReplacement
 * (التصدير/الاسترداد باقٍ حرفيًا). معطل بنيويًا حتى يفعّل المشغل العلم —
 * سلوك اليوم مطابق لما كان قبل الغلاف تمامًا.
 */
export function guardLocalStoreForOnlineMode(store: PrototypeLocalStore): PrototypeLocalStore {
  return new Proxy(store, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof property === "string" && property.startsWith("commit") && typeof value === "function") {
        return (...args: unknown[]) => {
          assertLocalFinancialWriteAllowed();
          return (value as (...fnArgs: unknown[]) => unknown).apply(target, args);
        };
      }
      return value;
    },
  }) as PrototypeLocalStore;
}
