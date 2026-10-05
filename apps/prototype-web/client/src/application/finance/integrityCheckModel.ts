/**
 * Wave F (ADR-013 — عنقود ١، تقسيم مسؤولية داخلي 2026-10-04): نموذج فحص
 * السلامة المشترك — الأنواع العامة وسجل الفحوص ومفردات الحالة وبُناة النتائج
 * (fail/unavailable) — انتقلت حرفيًا من integrityCheckService.ts إلى هذه الوحدة
 * كي تستهلكها عائلات الفحوص الأشقاء بلا دورة استيراد؛ الخدمة تبقى المُنسِّق
 * وتعيد تصدير هذا السطح كما هو فلا تتغير واجهتها العامة ولا أي دلالة.
 *
 * الوعد الملزم معماريًا قائم هنا كما في كل ملفات الفحص: «يقرأ أرقامك ولا
 * يغيّر شيئًا» — قراءة فقط، لا كتابة ولا إصلاح تلقائي أبدًا.
 */
import type { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import type { StatementService } from "@/application/finance/statementService";
import type { CashContinuityService } from "@/application/cash/cashContinuityService";
import type { PrototypeLocalStore } from "@/storage/local/types";

/* TOOL-001 (قرار المالك ٢٠٢٦-٠٩-١٦): «غير متاح» حالة صادقة مستقلة — تعذّر
 * القراءة ليس خللًا في الأرقام ولا نجاحًا؛ لا يُحتسب نجاحًا في الخلاصة أبدًا. */
export type IntegrityCheckStatus = "PASS" | "WARN" | "UNAVAILABLE" | "FAIL";
export type IntegrityCheckId =
  | "MIC-1"
  | "MIC-2"
  | "MIC-4"
  | "MIC-7"
  | "MIC-8"
  | "MIC-9"
  /* المجموعة ٤ (عقد ٢٩): الأصول والقروض والعربون المحتفظ وربط استهلاك التسليم. */
  | "MIC-10"
  | "MIC-11"
  | "MIC-12"
  | "MIC-13"
  /* المجموعة ٥ (عقد ٣٥): صحة الكاش غير الموزّع، تفرّد مفاتيح الأحداث،
   * وفصل مال المالك عن النتيجة والمصروف. */
  | "MIC-14"
  | "MIC-15"
  | "MIC-16"
  /* G-002 (تدقيق الإدارة المالية المتدرجة 2026-09-19): اكتمال تخصيص محافظ
   * دفعات الموردين — دفعة موصولة بمحفظة بلا قيد تغطية مطابق = خلل بنيوي
   * يُعلن للمراجعة، والفحص قراءة فقط لا يصلح شيئًا تلقائيًا. */
  | "MIC-17"
  /* Group 1 — الميثاق الرئيسي للإصلاح 2026-09-28 (F-004/F-005): ثابت أساس
   * التسوية — أحداث القبض والعكس تسوي الحالة المجمعة، والمتبقي المسجل يطابق
   * أساس قيمة الطلب القابلة للتحصيل؛ قراءة فقط بلا إصلاح تلقائي. */
  | "MIC-18";
export type IntegrityCheckResult = {
  id: IntegrityCheckId;
  titleAr: string;
  status: IntegrityCheckStatus;
  detailAr: string;
  driftMinor?: number | null;
  offenderCount?: number;
  offenderSampleIds?: readonly string[];
  deepLink?: string | null;
  /* Wave 4.3 — P-4.3-3 (D9): ملخص مقروء للسجلات المتأثرة — اسم العملية
   * وتاريخها ومبلغها ورابطها حيث يمكن فتحها؛ حل تربيعي للمعرّفات التقنية
   * الخام. لا يغير المنطق ولا عدد الفحوص — عرض أصدق فقط. */
  offenderSample?: readonly IntegrityOffenderSummary[];
};
/* ملخص مقروء واحد لسجل متأثر — يحمل نوعه فقط؛ التسمية العربية للنوع تُبنى
 * في الواجهة من خرائط العرض القائمة فلا تكرر هنا. */
export type IntegrityOffenderSummary = {
  id: string;
  kind:
    "financial_event" | "craft_order" | "cash_wallet" | "supplier_purchase" | "asset" | "loan" | "material";
  /* اسم العملية حيث يوجد — المورد/الزبون/المادة/المحفظة… */
  name: string | null;
  /* نوع الحدث المالي إن كان السجل حدثًا — يُستخدم للتسمية في الواجهة. */
  eventType?: string;
  dateLocal: string | null;
  amountMinor: number | null;
  href: string | null;
};
export type IntegrityCheckReport = {
  runAt: string;
  from: string;
  to: string;
  overall: IntegrityCheckStatus;
  checks: readonly IntegrityCheckResult[];
  /* المجموعة ٥ (عقد ٣٥): ختم إصدار الفحص — إصدار المخطط وإصدار التصدير
   * لحظة التشغيل، فيعرف المالك أي جيل من القواعد فحص أرقامه. */
  schemaVersion: number;
  exportVersion: number;
};

/* سياق الفحص المشترك (Wave F): التبعيات نفسها التي كانت حقن الخدمة — العائلات
 * تقرأ عبره فقط (مسارات list/read حصرًا) والخدمة تبقى صاحبة الحقن والترتيب. */
export type IntegrityCheckContext = {
  readonly store: PrototypeLocalStore;
  readonly projectFinance: ProjectFinancialService;
  readonly statementService: StatementService;
  readonly cashContinuity: CashContinuityService;
};

export const EVENTS_DEEP_LINK = "/finance?layer=events";
export const eventDeepLink = (ids: readonly string[]): string =>
  ids.length > 0 ? `${EVENTS_DEEP_LINK}&event=${encodeURIComponent(ids[0]!)}` : EVENTS_DEEP_LINK;

const PASS_TEXT = "سليم";
const WARN_TEXT = "تحذير";
const FAIL_TEXT = "خلل";
export const integrityStatusWord: Record<IntegrityCheckStatus, string> = {
  PASS: PASS_TEXT,
  WARN: WARN_TEXT,
  UNAVAILABLE: "غير متاح",
  FAIL: FAIL_TEXT,
};

/* باني نتيجة الخلل — العنوان من سجل الفحوص وعيّنة المتأثرين مقصوصة لخمسة. */
export function fail(
  id: IntegrityCheckId,
  detailAr: string,
  offenders: readonly string[],
  driftMinor: number | null = null,
  deepLink: string | null = null,
): IntegrityCheckResult {
  return {
    id,
    titleAr: INTEGRITY_TITLES[id],
    status: "FAIL",
    detailAr,
    driftMinor,
    offenderCount: offenders.length,
    offenderSampleIds: offenders.slice(0, 5),
    deepLink,
  };
}

/* TOOL-001: فحص تعذّرت قراءة مصدره — غير متاح، لا خلل ولا نجاح؛ والسبب
 * يظهر كما هو ليُعاد التشغيل بدل افتراض أرقام سليمة أو معطوبة. */
export function unavailable(id: IntegrityCheckId, detailAr: string): IntegrityCheckResult {
  return {
    id,
    titleAr: INTEGRITY_TITLES[id],
    status: "UNAVAILABLE",
    detailAr,
  };
}

export const INTEGRITY_TITLES: Record<IntegrityCheckId, string> = {
  "MIC-1": "تطابق نتيجة الفترة",
  "MIC-2": "بنية الكاش والمحافظ",
  "MIC-4": "سلامة الأحداث والتوزيع",
  "MIC-7": "رصيد الأمانات",
  "MIC-8": "سلامة المخزون والمواد",
  "MIC-9": "صدق حالة الرقم",
  "MIC-10": "سلامة الأصول والإهلاك",
  "MIC-11": "سلامة القروض والسداد",
  "MIC-12": "تصنيف العربون المحتفظ",
  "MIC-13": "ربط استهلاك التسليم",
  /* المجموعة ٥ (عقد ٣٥): فحوص الاستمرارية الثلاثة. */
  "MIC-14": "صحة الكاش غير الموزّع",
  "MIC-15": "تفرّد مفاتيح الأحداث",
  "MIC-16": "فصل مال المالك",
  "MIC-17": "تخصيص محافظ دفعات الموردين",
  /* Group 1 — الميثاق الرئيسي (F-004/F-005): ثابت أساس التسوية. */
  "MIC-18": "ثابت أساس التسوية",
};
