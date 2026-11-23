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
/** MNG-LOCAL-02 (Post-Group 6 W1 — أمر المالك bd242b3e): هل قرأنا الوضع
 * بنجاح مرة على الأقل؟ الوضع المجهول قبل أول قراءة ناجحة هو المحلي (واقع
 * اليوم الموثق في M6)، لكن بعد معرفة «online_only» لا يجوز أن يعود بصمت
 * إلى المحلي عند فشل قراءة لاحق — الوضع المعروف يبقى لزجًا. */
let hasEverReadMode = false;

export function currentManageOnlineMode(): ManageOnlineModeState {
  return cachedMode;
}

/** For tests: reset the cache to the startup default. */
export function resetManageOnlineModeForTest(): void {
  cachedMode = "local";
  hasEverReadMode = false;
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
    hasEverReadMode = true;
  } catch {
    if (!hasEverReadMode) {
      cachedMode = "local";
    }
    // MNG-LOCAL-02: بعد قراءة ناجحة سابقة يبقى الوضع المعروف — لا رجوع
    // صامت إلى الكتابة المحلية عند فشل قراءة لاحق (لا تذبذب).
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
 * Post-Group 6 W1 (EX-D24 / MNG-LOCAL-01 — أمر المالك bd242b3e): وصفات
 * الكتابة المالية/التشغيلية المحروسة التي لا تبدأ بـ«commit» — تعداد صريح
 * لا تخمين بادئات، لأن save* يشمل أيضًا مسودات وتفضيلات وتهيئة يجب أن تبقى
 * محلية في كل وضع. المعيار: السجل يغير حقيقة المال أو المخزون أو حق
 * المالك أو وقت العمل المكتبي — لا المسميات ولا التهيئة ولا المسودات.
 * أي وصفة مالية جديدة تضاف هنا مع اختبار تعداد في نفس الالتزام.
 */
const GUARDED_LOCAL_FINANCIAL_WRITES: ReadonlySet<string> = new Set([
  "saveOrder", // الطلب يحمل ماله وعربونه وتسليمه
  "saveDirectSale", // البيع المباشر قيد مالي
  "saveFinancialEvent", // الحدث المالي العام (MNG-LOCAL-01)
  "saveSupplierPurchase", // الشراء يكتب المخزون والمال
  "saveShortCashDeclaration", // إقرار النقد الناقص
  "saveOwnerEntitlementRecord", // حق المالك
  "saveOwnerEntitlementOpeningBalance", // افتتاح حق المالك
  "saveActualTimeRecord", // وقت العمل الفعلي مدخل تكلفة
  "saveInventoryActivation", // تفعيل المخزون يكتب حالة المواد
  "saveExpenseBudget", // ميزانية المصروف (MNG-LOCAL-01)
  "saveExpenseBudgetRevisionPair", // زوج مراجعة الميزانية
]);

/**
 * غلاف الحارس حول المخزن الوحيد: يمرر كل شيء كما هو، ويعترض وصفات
 * commit* المحروسة ووصفات الكتابة المالية الصريحة (MNG-LOCAL-01 — التعداد
 * أعلاه) بفحص الحارس. لا يمس القراءة ولا المسودات ولا التفضيلات ولا
 * التهيئة/الكتالوج ولا replaceSnapshot/runProtectedReplacement
 * (التصدير/الاسترداد باقٍ حرفيًا). معطل بنيويًا حتى يفعّل المشغل العلم —
 * سلوك اليوم مطابق لما كان قبل الغلاف تمامًا.
 */
export function guardLocalStoreForOnlineMode(store: PrototypeLocalStore): PrototypeLocalStore {
  return new Proxy(store, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof property === "string" && typeof value === "function") {
        const guarded = property.startsWith("commit") || GUARDED_LOCAL_FINANCIAL_WRITES.has(property);
        if (guarded) {
          return (...args: unknown[]) => {
            assertLocalFinancialWriteAllowed();
            return (value as (...fnArgs: unknown[]) => unknown).apply(target, args);
          };
        }
      }
      return value;
    },
  }) as PrototypeLocalStore;
}
