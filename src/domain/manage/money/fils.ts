/**
 * M1.7 (§9 R-1/R-1a/R-2 + R-20…R-22 / IMPACT §4 / قرار المالك D-4): حساب الفلس
 * الصرف الخالص لموديول مانج — تحليل نص الدينار، تنسيقه، وجمعه وطرحه وضربه
 * بكمية بالملي وقسمته بتقريب «نصف لأعلى» مرة واحدة بالضبط لكل ضرب/قسمة.
 *
 * مبادئ التنفيذ (ملزمة داخل هذا الملف):
 *  1. حساب صحيح خالص: التجميع والضرب والقسمة بـBigInt حصرًا (لا عشري عائم
 *     ولا Math — الحارس الزمني يمنع round/floor في المجال أصلًا)، والتحويل
 *     إلى Number لا يقع إلا بعد إثبات الناتج داخل المدى الآمن.
 *  2. فشل مغلق: كل مدخل غير عدد صحيح آمن، وكل ناتج يخرج عن المدى، وكل قاسم
 *     غير عدد صحيح موجب، ونص غير قانوني — يُرفض برمي عربي واضح؛ لا قيمة
 *     افتراضية ولا تسامح صامت.
 *  3. التقريب «نصف لأعلى» (R-2): floor((2n + d) / (2d)) — عند كسر 0.5
 *     تمامًا يذهب إلى القيمة الأعلى (نحو +∞). هذا هو المعنى الحرفي لـ«نصف
 *     لأعلى» في المواصفة، وهو مطابق لسلوكها على كل مقاديرها الموجبة (كل
 *     حالات تقريب المواصفة موجبة: قيمة بند، توزيع، نسبة). امتداده المتماثل
 *     للسالب (-2.5 → -2) موثَّق هنا ويثبَّت بالاختبارات — لا اجتهاد صامت.
 *  4. الاستقلال: لا استيراد واحد خارج شجرة مانج (نقاء R11/§14.3) — عمدًا
 *     لا مشتركَ: دوال المال المشتركة بوحدة القرش (قرار D-4: لا تتغير)،
 *     ومساعدات المجال المشتركة تعيد null لا رميًا (عقد مختلف). الثلاثة
 *     أسطر الزائدة هنا أرخص من تبعية عقدية.
 *  5. لا قسمة ولا ضرب بمئة في أي مكان (قبول المهمة): كل عملية بثابت
 *     FILS_PER_JOD وبـBigInt حصرًا — الفلس وحدة التخزين الوحيدة (R-1).
 */
import type { MoneyFils } from "./types.js";

/** ١ دينار = ١٠٠٠ فلس (ISO 4217 — الوحدة الصغرى للدينار الأردني). */
export const FILS_PER_JOD = 1000;

const MAX_SAFE_FILS = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_SAFE_FILS = BigInt(Number.MIN_SAFE_INTEGER);

/** نص قانوني بالكامل (R-20): جزء صحيح مجرد أو مجمَّع بفواصل آلاف صحيحة +
 *  كسر اختياري من ١–٣ أرقام. الأرقام الإنجليزية حصرًا؛ لا إشارة ولا فراغ. */
const JOD_TEXT_PATTERN = /^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,3})?$/;

function requireSafeInteger(value: number, description: string): MoneyFils {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${description} يجب أن يكون عددًا صحيحًا آمنًا بالفلس (وحدات 1/1000 دينار).`);
  }
  return value;
}

/** تحويل ناتج BigInt إلى MoneyFils بعد إثباته داخل المدى الآمن. */
function toSafeFilsOrThrow(value: bigint, description: string): MoneyFils {
  if (value > MAX_SAFE_FILS || value < MIN_SAFE_FILS) {
    throw new Error(`${description} خرج عن نطاق الأعداد الصحيحة الآمنة بالفلس — ارفض العملية بدل تخزين قيمة مضلِّلة.`);
  }
  return Number(value);
}

/** تقريب نصف لأعلى مرة واحدة (R-2): floor((2n + d) / (2d)) — انظر البند ٣ أعلاه. */
function roundHalfUpBig(numerator: bigint, denominator: bigint): bigint {
  const scaledNumerator = 2n * numerator + denominator;
  const scaledDenominator = 2n * denominator;
  let quotient = scaledNumerator / scaledDenominator;
  const remainder = scaledNumerator % scaledDenominator;
  if (remainder < 0n) {
    quotient -= 1n;
  }
  return quotient;
}

/** تجميع الجزء الصحيح بمجموعات ثلاث بفاصلة «,» (R-20) — معالجة نصية صرفة. */
function groupThousands(wholeDigits: string): string {
  const groups: string[] = [];
  let remaining = wholeDigits;
  while (remaining.length > 3) {
    groups.unshift(remaining.slice(-3));
    remaining = remaining.slice(0, -3);
  }
  groups.unshift(remaining);
  return groups.join(",");
}

/**
 * تحليل نص دينار صارم إلى فلس (R-1a/R-20): «12.350» و«12.35» و«12»
 * و«1,250.000» (فواصل الآلاف القانونية) مقبولة؛ أكثر من ٣ منازل عشرية،
 * غير الرقمي، الإشارة، الفراغ، الأرقام الهندية، والتجميع المعطوب مرفوضة
 * بالرمي. الصيغة المجمَّعة هي نفسها ناتج jodTextFromFils فيتحقق
 * parse(format(x)) === x لكل قيمة آمنة.
 */
export function filsFromJodText(text: string): MoneyFils {
  if (typeof text !== "string" || text.length === 0 || !JOD_TEXT_PATTERN.test(text)) {
    throw new Error(
      "نص المال غير صالح: أدخل رقمًا إنجليزيًا بثلاث منازل عشرية كحد أقصى بفاصلة «.»، وفواصل آلاف اختيارية بصيغة «1,250.000».",
    );
  }
  const [wholePart, fractionPart = ""] = text.split(".");
  const wholeDigits = (wholePart ?? "").replace(/,/g, "");
  const fractionDigits = `${fractionPart}000`.slice(0, 3);
  const fils = BigInt(wholeDigits) * BigInt(FILS_PER_JOD) + BigInt(fractionDigits);
  return toSafeFilsOrThrow(fils, "نص المال المدخل");
}

/**
 * تنسيق فلس إلى نص دينار قانوني (R-1a/R-20/R-22): ٣ منازل عشرية دائمًا،
 * فاصلة عشرية «.»، فواصل آلاف «,»، وإشارة سالبة للأرصدة المحسوبة السالبة.
 * حساب صحيح ونصي خالص (لا Intl) — حتمي بايت-بايت على كل منصة.
 */
export function jodTextFromFils(fils: MoneyFils): string {
  requireSafeInteger(fils, "قيمة المال المراد تنسيقها");
  const sign = fils < 0 ? "-" : "";
  const absolute = fils < 0 ? -fils : fils;
  const fraction = absolute % FILS_PER_JOD;
  const whole = (absolute - fraction) / FILS_PER_JOD;
  return `${sign}${groupThousands(String(whole))}.${String(fraction).padStart(3, "0")}`;
}

/** جمع فلسين مع فحص الفائض قبل أي جمع (المجموع قد لا يتمثل بدقة في double). */
export function addFils(left: MoneyFils, right: MoneyFils): MoneyFils {
  requireSafeInteger(left, "طرف الجمع الأول");
  requireSafeInteger(right, "طرف الجمع الثاني");
  if (right > 0 && left > Number.MAX_SAFE_INTEGER - right) {
    throw new Error("ناتج جمع الفلوس خرج عن نطاق الأعداد الصحيحة الآمنة.");
  }
  if (right < 0 && left < Number.MIN_SAFE_INTEGER - right) {
    throw new Error("ناتج جمع الفلوس خرج عن نطاق الأعداد الصحيحة الآمنة.");
  }
  return left + right;
}

/** طرح فلسين: تحقُّق أصلي ثم جمع مع السالب — نفس عقد الجمع وعتباته. */
export function subFils(left: MoneyFils, right: MoneyFils): MoneyFils {
  requireSafeInteger(left, "طرف الطرح الأول");
  requireSafeInteger(right, "طرف الطرح الثاني");
  return addFils(left, -right);
}

/**
 * ضرب فلس بكمية بالملي (R-2: قيمة البند = تقريب(الكمية × سعر الوحدة) مرة
 * واحدة): الناتج الدقيق = fils × quantityMilli ÷ FILS_PER_JOD بتقريب نصف
 * لأعلى مرة واحدة بالضبط — لا تقريب وسيط أبدًا. الضرب بـBigInt فلا فائض
 * صامت؛ الناتج النهائي فقط يُفحص ضد المدى الآمن.
 */
export function mulFilsByQuantityMilli(fils: MoneyFils, quantityMilli: number): MoneyFils {
  requireSafeInteger(fils, "المبلغ المضروب");
  requireSafeInteger(quantityMilli, "الكمية بالملي");
  const product = BigInt(fils) * BigInt(quantityMilli);
  const result = roundHalfUpBig(product, BigInt(FILS_PER_JOD));
  return toSafeFilsOrThrow(result, "ناتج ضرب المبلغ بالكمية");
}

/** قسمة فلس على عدد أقسام صحيح موجب بتقريب نصف لأعلى مرة واحدة (R-2). */
export function divFils(fils: MoneyFils, divisor: number): MoneyFils {
  requireSafeInteger(fils, "المبلغ المقسوم");
  if (!Number.isSafeInteger(divisor) || divisor <= 0) {
    throw new Error("قاسم القسمة يجب أن يكون عددًا صحيحًا موجبًا.");
  }
  const result = roundHalfUpBig(BigInt(fils), BigInt(divisor));
  return toSafeFilsOrThrow(result, "ناتج قسمة المبلغ");
}
