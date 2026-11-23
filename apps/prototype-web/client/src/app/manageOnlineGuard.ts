/**
 * EX-D23 (M6 — 2026-11-14): الوضع المتصل-فقط المحروس لـManage.
 *
 * الحدود الحاكمة (أمر المالك 2026-11-14 §4/§6-M6): العلم معطل افتراضيًا لكل
 * مساحة، ولا يُفعَّل إلا بقرار المشغل المباشر بعد بوابة المالك النهائية
 * (مراجعة الترحيل والاسترداد) — لا مسار API يبدّله أبدًا. حتى ذلك الحين:
 * كتابة المالك المحلية والتصدير والاسترداد يعملون تمامًا كما هم.
 *
 * آلية الحارس عند تفعيل المشغل للعلم فقط: كل كتابة مالية محلية (الوصفات
 * المالية المحروسة على منفذ المخزن) تُرفض رفضًا صادقًا — لا طابور تزامن ولا
 * كتابة دون اتصال ولا آخر-كاتب-يفوز؛ والتصدير/الاستبدال المحمي/القراءة
 * المحلية كلها باقية (مصدر الاسترداد).
 *
 * MNG-LOCAL-02 (النتيجة المفتوحة — إصلاح 2026-11-23، أمر المالك
 * OPEN-FINDINGS-AND-PROTOTYPE-CODE): «الفشل المغلق عند جهل الوضع أو تعذر
 * قراءته طازجًا». الوضع صار ثلاث حالات: «local» (مؤكَد محلي)،
 * «online_only» (مؤكَد مقطوع)، و«unknown» (لا يمكن تحقق الوضع الآن).
 * الكتابة المالية المحلية الحساسة تُمنع في الحالتين غير المؤكدتين وبرسالة
 * صادقة — هذا تنفيذ مباشر لقرار المالك المسجل Q270 (الحفظ المالي يتطلب
 * اتصالًا؛ «لم يُحفظ» وتبقى البيانات في النموذج حتى عودة الاتصال).
 *
 * التصنيف الصادق لفشل القراءة — ليس كل فشل «مجهولًا»:
 *  - 401 (بلا جلسة): لا هوية سحابية للمتصل أصلًا فلا يمكن أن يكون مالك
 *    Manage المربوط لأي مساحة؛ الوضع «local» مؤكَد لا مفترض.
 *  - 403 (جلسة بلا ربط Manage): المتصل ليس المالك المربوط لهذه الجلسة فلا
 *    يسري عليه علم القطع؛ «local» مؤكَد.
 *  - 503 مع الكود network_not_configured (لا ربط DB/MEDIA أصلًا — وضع
 *    الإنتاج الموثق اليوم): لا يوجد خادم يحمل العلم أصلًا فلا يمكن لأحد
 *    تفعيله؛ «local» مؤكَد.
 *  - أي فشل آخر (انقطاع شبكة، خطأ 5xx آخر، مهلة، رد غير مفهوم): الوضع
 *    «unknown» — لا يمكن ضمان قراءته طازجًا فتُمنع الكتابة المالية الحساسة
 *    حتى قراءة حاسمة جديدة (مع إعادة محاولة مُعدَّلة تلقائيًا حتى لا يبقى
 *    الحجب بعد عودة الاتصال إلا لثوانٍ).
 */
import type { PrototypeLocalStore, StorageFailure } from "@/storage/local/types";
import { fetchManageMode, ApiError } from "@/application/network";

export type ManageOnlineModeState = "local" | "online_only" | "unknown";

let cachedMode: ManageOnlineModeState = "unknown";
/** هل قرأنا الوضع بقراءة حاسمة (نجاح أو نفي قاطع) مرة على الأقل؟ */
let hasDefinitiveRead = false;

export function currentManageOnlineMode(): ManageOnlineModeState {
  return cachedMode;
}

/** For tests: reset the cache to the startup default (unknown — MNG-LOCAL-02). */
export function resetManageOnlineModeForTest(): void {
  cachedMode = "unknown";
  hasDefinitiveRead = false;
  lastAutoRetryAt = 0;
}

/** For tests/operator-verified flows: set the cached mode directly. */
export function setManageOnlineModeForTest(mode: ManageOnlineModeState): void {
  cachedMode = mode;
  hasDefinitiveRead = true;
}

/** هل الخطأ نفيًا قاطعًا بأن علم القطع لا يمكن أن يسري على هذا المتصل؟ */
function isDefinitiveLocalAnswer(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.status === 401 || error.status === 403) return true;
  return error.status === 503 && error.code === "network_not_configured";
}

/** آخر محاولة إعادة قراءة تلقائية (معدَّلة — لا عاصفة طلبات عند كل كتابة مرفوضة). */
const REFRESH_RETRY_MIN_INTERVAL_MS = 15_000;
let lastAutoRetryAt = 0;

/**
 * اقرأ الوضع من الخادم (عند الإقلاع، وبعد كل رفض على وضع مجهول — بمعدل
 * محدود). التصنيف الكامل في ترويسة الوحدة: النجاح يثبت الوضع، والنفي القاطع
 * (401/403/503-غير-مهيأ) يثبت «local»، وغيره يجعل الوضع «unknown» فاشلًا
 * مغلقًا أمام الكتابة المالية الحساسة.
 */
export async function refreshManageOnlineMode(): Promise<ManageOnlineModeState> {
  try {
    const mode = await fetchManageMode();
    cachedMode = mode.onlineOnly ? "online_only" : "local";
    hasDefinitiveRead = true;
  } catch (error) {
    if (isDefinitiveLocalAnswer(error)) {
      cachedMode = "local";
      hasDefinitiveRead = true;
    } else {
      /* MNG-LOCAL-02: الفشل غير القاطع — الوضع غير قابل للقراءة الطازجة،
       * فالحجب هو الأمانة (بما فيه بعد قراءة سابقة ناجحة: القراءة الطازجة
       * هي ما يهم، والعلم قد قُلّب على الخادم منذ آخر قراءة). */
      cachedMode = "unknown";
    }
  }
  return cachedMode;
}

/** إعادة محاولة تلقائية معدَّلة — تُستدعى عند رفض كتابة بسبب الوضع المجهول
 * فقط؛ أول إعادة فورية عند أول رفض بعد سكون، ثم مرة كل ١٥ ثانية على
 * الأكثر حتى تنجح قراءة حاسمة (عودة الاتصال ترفع الحجب بلا إعادة تحميل). */
export async function retryManageOnlineModeRefresh(): Promise<void> {
  const now = Date.now();
  if (now - lastAutoRetryAt < REFRESH_RETRY_MIN_INTERVAL_MS) return;
  lastAutoRetryAt = now;
  try {
    await refreshManageOnlineMode();
  } catch {
    /* refresh لا يرمي أبدًا؛ الحزام دفاعي فقط. */
  }
}

/** رسالة الرفض الصادقة عند وضع القطع (تفعيل المشغل — كما كانت في M6). */
export const MANAGE_ONLINE_ONLY_MESSAGE =
  "الكتابة المالية متصلة فقط في وضع القطع — لا كتابة محلية دون اتصال ولا طابور تزامن؛ التصدير المحلي متاح دائمًا للاسترداد.";

/** رسالة الرفض الصادقة عند الوضع المجهول (MNG-LOCAL-02 + قرار المالك Q270):
 * «لم يُحفظ» وتبقى البيانات في النموذج حتى عودة الاتصال. */
export const MANAGE_MODE_UNKNOWN_MESSAGE =
  "لم يُحفظ — الحفظ المالي يتطلب اتصالًا يُتحقق منه من وضع بياناتك؛ وتبقى بياناتك في النموذج كما هي ولم يُكتب شيء. أعد المحاولة عند عودة الاتصال.";

/** رفض الكتابة المالية الحساسة كنتيجة تخزين موحدة (لا رمي): كل مستهلكي
 * المخزن يتعاملون أصلًا مع {ok:false, code, message} فلا يسقط أي فعل في
 * واجهة غير ممسوسة ولا يعلق زر في حالة انتظار — الرسالة تصل كما هي أينما
 * تمر رسائل فشل التخزين (وأينما تستبدلها الخدمة برسالتها العامة تبقى
 * صادقة: «لم يُحفظ ولم يتغير شيء»). */
export function localFinancialWriteRefusal(): StorageFailure | null {
  if (cachedMode === "online_only") {
    return { ok: false, code: "storage_error", message: MANAGE_ONLINE_ONLY_MESSAGE };
  }
  if (cachedMode === "unknown") {
    void retryManageOnlineModeRefresh();
    return { ok: false, code: "storage_error", message: MANAGE_MODE_UNKNOWN_MESSAGE };
  }
  return null;
}

/* ───────────── تعداد الوصفات المالية (MNG-LOCAL-01 + MNG-LOCAL-02) ─────────────
 *
 * المعيار الكنوني (MNG-LOCAL-01 — أمر المالك bd242b3e): السجل المحروس يغير
 * حقيقة المال أو المخزون أو حق المالك أو وقت العمل المكتبي — لا المسميات
 * ولا التهيئة ولا المسودات. إصلاح MNG-LOCAL-02 (2026-11-23) استبدل قاعدة
 * البادئة «كل commit*» بتعداد صريح كاملًا: بادئة commit كانت تلتقط عرضًا
 * وصفات غير مالية (تفضيلات المظهر وملف النشاط والمواعيد والقوالب...) فتُحجب
 * في الوضع المجهول حجبًا خاطئًا؛ التعداد أدناه يغطي كل وصفات commit وsave
 * على الواجهة وقت الترجمة (توكيدا النفي في الأسفل) فلا تنجو وصفة مالية من
 * الحصر ولا تُحجب وصفة غير مالية. */

/** الوصفات المالية من عائلة save* — التعداد الكنوني لـMNG-LOCAL-01 كما كان. */
export const SAVE_FINANCIAL_RECIPES = [
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
] as const;

/** الوصفات المالية من عائلة commit* — طلبات/مبيعات/أحداث/مخزون/كاش/أطراف/
 * أصول/قروض/عهد/مصروف متكرر مسجَّل/حق مالك: كل ما يكتب أو يصحح أو يعكس
 * حقيقة مالية أو مخزونية. */
export const COMMIT_FINANCIAL_RECIPES = [
  "commitOrderUpdate",
  "commitOrderFromDraft",
  "commitOrderDelivery",
  "commitOrderDeliveryReversal",
  "commitOrderCollectionReversal",
  "commitDepositRefundSettlement",
  "commitDirectSaleWrite",
  "commitDirectSaleCollectionReversal",
  "commitFinancialEventCorrection",
  "commitFinancialEventReplacement",
  "commitSupplierPurchase",
  "commitSupplierPurchaseWithAttribution",
  "commitCashContinuity",
  "commitCashObservation",
  "commitCounterpartyWrite",
  "commitAccountCompletion",
  "commitInventory",
  "commitInventoryWithShortage",
  "commitInventoryWithEvents",
  "commitShortCashDeclarationReversal",
  "commitOwnerEntitlementRecordReversal",
  "commitOwnerEntitlementOpeningBalanceReversal",
  "commitOwnerMovement",
  "commitAssetRecord",
  "commitAssetAcquisition",
  "commitAssetAcquisitionCorrection",
  "commitAssetPayableSettlement",
  "commitLoanRecord",
  "commitLoanCorrection",
  "commitReceivedLoanRecord",
  "commitReceivedLoanCorrection",
  "commitDepositClassification",
  "commitDepositClassificationCorrection",
  "commitRecurringExpenseOccurrenceRecord",
] as const;

/** الوصفات غير المالية المصنفة صراحة — تظل متاحة في كل وضع (هوية/مظهر/
 * مواعيد/مفاهيم القوالب والسياسات/تقديرات التفكير/مسودات ومفاهيم المصروف
 * المتكرر/نية الاستبدال): لا تغير أيًّا من حقيقة المال أو المخزون أو حق
 * المالك أو وقت العمل. */
export const NON_FINANCIAL_WRITE_RECIPES = [
  "commitProfileCreate",
  "commitProfileRename",
  "commitPreferencesUpdate",
  "commitScheduleCreate",
  "commitScheduleUpdate",
  "commitRecurrence",
  "commitCatalogTemplateRevision",
  "commitAllocationPolicySuccessor",
  "commitOwnerEntitlementPolicySuccessor",
  "commitCostEstimateCreate",
  "commitRecurringExpenseDraft",
  "commitRecurringExpenseSeriesChange",
  "commitRecurringExpenseOccurrences",
  "commitRecurringExpenseOccurrenceLink",
  "commitRecurringExpenseOccurrenceDecision",
  "commitReplacementIntent",
  "saveDraft",
  "saveFormDraft",
  "savePreferences",
  "saveProfile",
  "saveOwnerProfile",
  "saveOwnerEntitlementPolicy",
  "saveCatalogItem",
  "saveCatalogTemplate",
  "saveMeasurementUnit",
  "saveCostEstimate",
  "saveDirectConversion",
  "saveAllocationPolicy",
  "saveSchedule",
  "saveRecurrence",
  "saveAskHistoryEntry",
  "saveLocalSecurity",
] as const;

/** المجموعة المحروسة الواحدة — تعداد صريح لا تخمين بادئات. */
const GUARDED_LOCAL_FINANCIAL_WRITES: ReadonlySet<string> = new Set<string>([
  ...SAVE_FINANCIAL_RECIPES,
  ...COMMIT_FINANCIAL_RECIPES,
]);

/* توكيدا الاكتمال وقت الترجمة: كل وصفة commit وsave على واجهة المخزن
 * يجب أن تكون إما في التعداد المالي المحروس أو في التصنيف غير المالي —
 * أي وصفة جديدة بلا تصنيف تكسر البناء فورًا (لا تنجو من الحصر بصمت). */
type StoreKey = keyof PrototypeLocalStore;
type CommitKeys = { [K in StoreKey]: K extends `commit${string}` ? K : never }[StoreKey];
type SaveKeys = { [K in StoreKey]: K extends `save${string}` ? K : never }[StoreKey];
type ClassifiedKeys =
  | (typeof COMMIT_FINANCIAL_RECIPES)[number]
  | (typeof SAVE_FINANCIAL_RECIPES)[number]
  | (typeof NON_FINANCIAL_WRITE_RECIPES)[number];
type AssertNever<T extends never> = T;
type _CommitRecipesAllClassified = AssertNever<Exclude<CommitKeys, ClassifiedKeys>>;
type _SaveRecipesAllClassified = AssertNever<Exclude<SaveKeys, ClassifiedKeys>>;

/**
 * غلاف الحارس حول المخزن الوحيد: يمرر كل شيء كما هو، ويعترض الوصفات المالية
 * المحروسة وحدها (التعداد الكامل أعلاه). عند الرفض (MNG-LOCAL-02: وضع القطع
 * أو الوضع المجهول) يُعاد فورًا نتيجة فشل تخزين صادقة بدل الرمي — قرار
 * القبول/الرفض نفسه لم يتغير (الرفض قبل أي كتابة)، والقراءة والمسودات
 * والتفضيلات والتهيئة/الكتالوج وreplaceSnapshot/runProtectedReplacement
 * (التصدير/الاسترداد) لا تُمس أبدًا.
 */
export function guardLocalStoreForOnlineMode(store: PrototypeLocalStore): PrototypeLocalStore {
  return new Proxy(store, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof property === "string" && typeof value === "function") {
        if (GUARDED_LOCAL_FINANCIAL_WRITES.has(property)) {
          return (...args: unknown[]) => {
            const refusal = localFinancialWriteRefusal();
            if (refusal !== null) {
              return Promise.resolve(refusal);
            }
            return (value as (...fnArgs: unknown[]) => unknown).apply(target, args);
          };
        }
      }
      return value;
    },
  }) as PrototypeLocalStore;
}
