const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidLocalDate(value: string): boolean {
  if (!LOCAL_DATE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day;
}

export function isValidTimestamp(value: string): boolean {
  return typeof value === "string" && value.trim().length > 0 && !Number.isNaN(Date.parse(value));
}

const FIELD_LABELS_AR: Readonly<Record<string, string>> = {
  id: "المعرّف",
  name: "الاسم",
  note: "الوصف",
  reason: "السبب",
  source: "المصدر",
  supplierName: "اسم المورد",
  customerName: "اسم العميل",
  itemName: "اسم العمل",
  idempotencyKey: "مفتاح العملية",
  operationKey: "مفتاح العملية",
  createdOperationKey: "مفتاح الإنشاء",
  amountMinor: "المبلغ",
  totalMinor: "إجمالي الشراء",
  initialPaidMinor: "المبلغ المدفوع مبدئيًا",
  agreedPriceMinor: "السعر المتفق عليه",
  hourlyRateMinor: "أجر الساعة",
  unitPriceMinor: "سعر الوحدة",
  packagingMinor: "قيمة التغليف",
  deliveryMinor: "قيمة التوصيل",
  wasteMinor: "قيمة الهدر",
  safetyBufferMinor: "هامش الحماية",
  totalAmountMinor: "إجمالي المصروف المشترك",
  calculatedShareMinor: "حصة المشروع المحسوبة",
  percentageBps: "النسبة",
  baseMinor: "المبلغ الأساس",
  quantity: "الكمية",
  unitLabel: "تسمية الوحدة",
  freshnessDays: "أيام صلاحية السعر",
  purchasedOn: "تاريخ الشراء",
  dueOn: "تاريخ الاستحقاق",
  occurredOn: "تاريخ الحركة",
  startsOn: "تاريخ البداية",
  endsOn: "تاريخ النهاية",
  periodFrom: "بداية الفترة",
  periodTo: "نهاية الفترة",
  createdAt: "وقت الإنشاء",
  recordedAt: "وقت التسجيل",
  walletId: "المحفظة",
  policyId: "السياسة",
  relatedOrderId: "الطلب المرتبط",
  relatedEventId: "الحدث المرتبط",
  reversalReason: "سبب التراجع",
  sourceKeys: "مفاتيح المصدر",
  version: "رقم النسخة",
  policyVersion: "رقم نسخة السياسة",
};

/** Arabic label for a validation field key so guard messages reach the user in their own language. */
export function fieldLabelAr(field: string): string {
  return FIELD_LABELS_AR[field] ?? field;
}

export function assertId(value: string, field: string): void {
  if (!value.trim()) throw new Error(`أكمل ${fieldLabelAr(field)} قبل الحفظ.`);
}

export function assertPositiveMinor(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error(`أدخل ${fieldLabelAr(field)} رقمًا صحيحًا موجبًا ضمن الدقة الآمنة.`);
}

export function assertNonNegativeInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`أدخل ${fieldLabelAr(field)} رقمًا صحيحًا غير سالب بالوحدات الصغرى.`);
  }
}

export function addSafe(left: number, right: number): number | null {
  if (
    !Number.isSafeInteger(left) ||
    !Number.isSafeInteger(right) ||
    (right > 0 && left > Number.MAX_SAFE_INTEGER - right) ||
    (right < 0 && left < Number.MIN_SAFE_INTEGER - right)
  )
    return null;
  return left + right;
}

/** Whole milli units of a user quantity, or null when the quantity is not exactly milli-representable. */
export function quantityMilliExact(quantity: number): number | null {
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  const scaled = Math.round(quantity * 1000);
  if (!Number.isSafeInteger(scaled) || scaled <= 0 || Math.abs(quantity - scaled / 1000) > Number.EPSILON)
    return null;
  return scaled;
}

export function roundHalfUp(numerator: number, denominator: number): number | null {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator <= 0) return null;
  const quotient = Math.floor(numerator / denominator);
  const remainder = numerator % denominator;
  return quotient + (remainder * 2 >= denominator ? 1 : 0);
}

export function ceilRatio(numerator: number, denominator: number): number | null {
  if (
    !Number.isSafeInteger(numerator) ||
    !Number.isSafeInteger(denominator) ||
    numerator < 0 ||
    denominator <= 0
  )
    return null;
  return Math.floor(numerator / denominator) + (numerator % denominator === 0 ? 0 : 1);
}
