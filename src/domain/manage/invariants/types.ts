/**
 * M2.3 (§9 — مانج-في₂، الموجة E): أنواع حال فحوص الثوابت INV-1…INV-10
 * (`src/domain/manage/invariants/`) — إسقاط صرف لصفوف §3 التي تحتاجها
 * الفحوص، بلا أي مفتاح قاعدة.
 *
 * مبادئ ملزمة داخل الموديول:
 *  1. الحالة المفسدة قابلة للتمثيل: الحساب والفئة ونوع الإيراد ونوع القيد
 *     نصوص خام لا تعدادات مغلقة — الثوابت شبكة الأمان فوق حالة مفسدة، فلا
 *     يجوز أن تخفيها أنواع اللغة قبل أن تراها الفحوص (اختبار حالة مفسدة
 *     لكل ثابت، ومعيار الرفض «ثابت يعيد النجاح دومًا»).
 *  2. الدومين صرف خالص (§14.1): لا I/O ولا ساعة — التواريخ تمرَّر قيمًا
 *     (نص تاريخ عمان المحلي كما هو)، والمعرفات مراجع مغلقة لا يفحص شكلها
 *     هنا (شكل UUID قرار طبقة الكتابة M2.4+).
 *  3. المال `MoneyFils` حصرًا (عدد صحيح آمن بالفلس — M1.7): كل مقدار في
 *     الحالة والنتائج بالفلس، ولا تحويل وحدة واحد داخل الموديول.
 *  4. الإسقاط واجب كاملًا: الصفوف مصفوفات (قد تكون فارغة) لا حقول اختيارية
 *     «لم تُحمَّل»، فلا ينجو فحص بحالة ناقصة البيانات صمتًا؛ الكاش وحده
 *     اختياري (§3.11: التخزين المؤقت للقيم المشتقة جائز لا مفروض).
 *  5. الاستيراد نسبي داخل شجرة مانج حصرًا (نقاء R11/§14.3).
 */
import type { MoneyFils } from "../money/types.js";

/** معرّفات الثوابت العشرة حرفيًا من §9 (INV-1…INV-10 — عشرة كاملة). */
export type InvariantId =
  "INV-1" | "INV-2" | "INV-3" | "INV-4" | "INV-5" | "INV-6" | "INV-7" | "INV-8" | "INV-9" | "INV-10";

/** صندوق كما تحتاجه الفحوص (§3.2: الحالة والفتح — الرصيد محسوب لا مخزّن). */
export interface InvariantBox {
  id: string;
  status: "active" | "merged";
  openingStatus: "known" | "unknown";
}

/** سطر رصيد باتجاهه (§3.6 — المستحق القائم محسوب من الترحيلات لا مخزّن). */
export interface InvariantBalanceLine {
  id: string;
  direction: "to_me" | "by_me";
}

/** بيع بتاريخيه الإداريين (§3.4 — INV-9 يفحص عدم أثرهما المالي). */
export interface InvariantSale {
  id: string;
  registeredOn: string;
  plannedDeliveryOn: string;
}

/** لقطة بند البيع الحرفية من §3.5 (المصدر الذاتي للبند — INV-7). */
export interface InvariantSaleLine {
  id: string;
  saleId: string;
  position: number;
  /** null = بند حر (§3.5). */
  productId: string | null;
  description: string;
  quantityMilli: number;
  /** null = سعر لم يُدخل / كلفة مجهولة (§3.5). */
  unitPriceFils: MoneyFils | null;
  unitCostFils: MoneyFils | null;
}

/** عملية بسطور §3.7 التي تحدد نطاق التصحيح (INV-8) وتُقارن عبر الانتقالات. */
export interface InvariantOperation {
  id: string;
  kind: string;
  status: "active" | "reversed";
  /** مضبوط على البديل المصحِّح لعملية (§3.7/§5 OP-CORRECT). */
  correctsOperationId?: string;
  /** مضبوط على العملية العاكسة (§3.7/§5 OP-CANCEL-OPERATION). */
  reversedByOperationId?: string;
}

/** ترحيل بحقول §3.8 الخام — نصوص مفتوحة عمدًا (المبدأ ١ أعلاه). */
export interface InvariantPosting {
  account: string;
  refId?: string;
  category?: string;
  revKind?: string;
  deltaFils: MoneyFils;
}

/** قيد بترحيلاته (§3.8) — نوع القيد نص خام عمدًا (المبدأ ١ أعلاه). */
export interface InvariantEntry {
  id: string;
  operationId: string;
  entryType: string;
  effectiveOn: string;
  /** Q20 حصرًا (§3.8). */
  reversesEntryId?: string;
  postings: InvariantPosting[];
}

/** القيم المخزّنة مؤقتًا المسموح التحقق منها بإعادة الحساب (§3.11 حرفيًا). */
export interface CachedFigures {
  /** رصيد كل صندوق: Σ BOX[k] من كل الترحيلات. */
  boxBalances?: Record<string, MoneyFils>;
  /** المستحق القائم لكل سطر: Σ AR[L] أو Σ AP[L] حسب اتجاهه (§8.2). */
  lineOutstanding?: Record<string, MoneyFils>;
  /** الدفعة المقدمة لكل بيع: Σ PRE[s] (§8.2). */
  salePrepayments?: Record<string, MoneyFils>;
}

/** حالة الدفتر التي تعمل فوقها الفحوص: إسقاط صفوف §3 بلا كاش وجوبًا. */
export interface LedgerCheckState {
  boxes: InvariantBox[];
  balanceLines: InvariantBalanceLine[];
  sales: InvariantSale[];
  saleLines: InvariantSaleLine[];
  operations: InvariantOperation[];
  entries: InvariantEntry[];
  cachedFigures?: CachedFigures;
}

/**
 * نتيجة فحص ثابت واحد: `pass` — الثابت محقق؛ `unknown` — الثابت غير قابل
 * للتحقق الرقمي في هذه الحالة (INV-1 وحدها مع فتح مجهول نشط: الطرفان
 * «مجهولان» — التفسير المُلزم 6 في أمر المرحلة 2)؛ `violation` — مكسور،
 * وكل خرق سطر مستقل بنصه الكامل.
 */
export type InvariantCheckResult =
  | { invariantId: InvariantId; outcome: "pass" }
  | { invariantId: InvariantId; outcome: "unknown"; reason: string }
  | { invariantId: InvariantId; outcome: "violation"; violations: string[] };

/** نتيجتا التأكيد المفرد للثابتين الأساسيين (§13: كل اختبار يختم بهما). */
export interface CoreInvariantResults {
  inv1: InvariantCheckResult;
  inv2: InvariantCheckResult;
}
