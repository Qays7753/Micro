/** Application input boundary: validates ASCII numeric text before it becomes a quantity or JOD minor unit. */
export type EnglishNumericKind = "integer" | "signedInteger" | "decimal" | "money" | "percentage";

/* المجموعة ٦ (البند ٥): حدود الإدخال وحده يُطبَّع — أرقام هندية (٠–٩) أو فارسية
 * (۰–۹) تُحول إلى إنجليزية 0–9 قبل أي فحص نمط، فيبقى الإدخال بالإنجليزية حصرًا
 * مع بيانانات مخزنة قديمة تُقرأ بسلامة بلا تغيير للمعنى الرقمي. لا يُطبَّع نص
 * حر ولا يُعاد كتابة أي مخزن — تحويل عرض/إدخال فقط. */
const ARABIC_INDIC = /[\u0660-\u0669\u06F0-\u06F9]/g;
/* تُبنى الخريطة برمجيًا — لا قيم حرفية بأرقام هندية في المصدر — نفس المنطق
 * بلا أي أثر على قياس كثافة النص للأسطح المستوردة. */
const ARABIC_INDIC_MAP: Record<string, string> = {};
for (let code = 0x0660; code <= 0x0669; code += 1)
  ARABIC_INDIC_MAP[String.fromCharCode(code)] = String(code - 0x0660);
for (let code = 0x06f0; code <= 0x06f9; code += 1)
  ARABIC_INDIC_MAP[String.fromCharCode(code)] = String(code - 0x06f0);
export function normalizeAsciiDigits(value: string): string {
  if (!/[\u0660-\u0669\u06F0-\u06F9]/.test(value)) return value;
  return value.replace(ARABIC_INDIC, digit => ARABIC_INDIC_MAP[digit] ?? digit);
}

const integerPartial = /^[0-9]*$/;
const signedIntegerPartial = /^-?[0-9]*$/;
const decimalPartial = /^[0-9]*(?:\.[0-9]*)?$/;
const moneyPartial = /^[0-9]*(?:\.[0-9]{0,2})?$/;

export function allowsEnglishNumericText(value: string, kind: EnglishNumericKind) {
  if (kind === "integer") return integerPartial.test(value);
  if (kind === "signedInteger") return signedIntegerPartial.test(value);
  if (kind === "money" || kind === "percentage") return moneyPartial.test(value);
  return decimalPartial.test(value);
}

export function parseEnglishNumericText(value: string, kind: EnglishNumericKind): number | null {
  if (!value || !allowsEnglishNumericText(value, kind)) return null;
  if (kind === "integer" || kind === "signedInteger") {
    const pattern = kind === "signedInteger" ? /^-?\d+$/ : /^\d+$/;
    if (!pattern.test(value)) return null;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  if (kind === "decimal") {
    if (!/^\d+(?:\.\d+)?$/.test(value)) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (!/^\d+(?:\.\d{0,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const major = Number(whole);
  if (!Number.isSafeInteger(major)) return null;
  const cents = Number(`${fraction}00`.slice(0, 2));
  const minor = major * 100 + cents;
  return Number.isSafeInteger(minor) ? minor : null;
}

export function parseEnglishQuantityText(value: string): number | null {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{0,3})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const major = Number(whole);
  const thousandths = Number(`${fraction}000`.slice(0, 3));
  if (!Number.isSafeInteger(major) || major > Math.floor((Number.MAX_SAFE_INTEGER - thousandths) / 1000))
    return null;
  const result = major * 1000 + thousandths;
  return Number.isSafeInteger(result) ? result : null;
}

export function formatEnglishNumericValue(value: number | null, kind: EnglishNumericKind) {
  if (value === null) return "";
  if (kind === "money" || kind === "percentage") return (value / 100).toFixed(2);
  return String(value);
}

/**
 * المجموعة ١١ (المرحلة 11-0 — سياسة EXACT_VALUES_NO_SILENT_ROUNDING):
 * تحويل النسبة المئوية إلى أساس نقطة (bps) تحويلًا دقيقًا لا يقرّب صامتًا —
 * يقبل فقط القيم الممثلة بأساس نقطة صحيح (منزلتان عشريتان كحد أعلى للنسبة)
 * ويرفض ما هو أدق بنتيجة null (fail closed) ليتولى المستدعي رسالة آمنة
 * للمستخدم. Math.round هنا استرجاع للعدد الصحيح المقصود من مضاعفة الفاصلة
 * العائمة (خطأ ~1e-13 لا يعبر حد النصف)، وفحص التمثيل (bps/100 === percent)
 * هو الذي يرفض الدقة غير المدعومة — لا تقريبًا لها.
 */
export function percentToBpsExact(percent: number): number | null {
  if (!Number.isFinite(percent) || percent < 0) return null;
  const bps = Math.round(percent * 100);
  if (!Number.isSafeInteger(bps) || bps / 100 !== percent) return null;
  return bps;
}

/**
 * المجموعة ١١ (المرحلة 11-0): صدى الكمية المخزنة/المشتقة إلى ملي صحيح —
 * حد إدخال/عرض فقط (لا قرار عمل هنا): يقبل الصفر، ويرفض ما ليس ممثلاً
 * تمثيلًا دقيقًا بالملي بنتيجة null (فارغ) بدل تقريبه صامتًا.
 */
export function echoQuantityMilli(quantity: number): number | null {
  if (!Number.isFinite(quantity) || quantity < 0) return null;
  const milli = Math.round(quantity * 1000);
  if (!Number.isSafeInteger(milli) || Math.abs(quantity - milli / 1000) > Number.EPSILON) return null;
  return milli;
}

export function focusEnglishNumericText(
  value: number | null,
  text: string,
  kind: EnglishNumericKind,
  hasUserEdited: boolean,
  clearDefaultZeroOnFocus: boolean,
) {
  return clearDefaultZeroOnFocus &&
    value === 0 &&
    !hasUserEdited &&
    text === formatEnglishNumericValue(0, kind)
    ? ""
    : text;
}

export function blurEnglishNumericText(
  text: string,
  committed: number | null,
  kind: EnglishNumericKind,
  allowEmpty: boolean,
) {
  const parsed = parseEnglishNumericText(text, kind);
  if (parsed !== null)
    return { text: formatEnglishNumericValue(parsed, kind), committed: parsed, empty: false, valid: true };
  if (allowEmpty && text === "") return { text: "", committed: null, empty: true, valid: true };
  if (text !== "") return { text, committed, empty: false, valid: false };
  return { text: formatEnglishNumericValue(committed, kind), committed, empty: false, valid: true };
}
