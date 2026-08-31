/* F-001: نصوص تسوية عدّ الصندوق تُبنى هنا كلها عبر المنسّق المشترك (مقياس المال 1/100) —
 * لا قسمة خام ولا أرقام وحدات صغرى في أي رسالة مالية. الاختبار يحرس المقياس. */
import { formatMoneyMinor } from "./formatters";

/** نص الملاحظة التي تُحفظ مع تسوية العدّ — المعدود بمقياس المال لا الكميات. */
export function cashCountSettlementNote(countedMinor: number): string {
  return `تسوية عدّ الصندوق — المعدود ${formatMoneyMinor(countedMinor)} د.أ`;
}

/** سبب التسوية — الفرق بمقياس المال، بإشارته، لا وحدات صغرى خام. */
export function cashCountDifferenceReason(differenceMinor: number): string {
  return differenceMinor > 0
    ? `فرق زيادة عند العدّ (+${formatMoneyMinor(Math.abs(differenceMinor))} د.أ)`
    : `فرق نقص عند العدّ (-${formatMoneyMinor(Math.abs(differenceMinor))} د.أ)`;
}

/** رسالة النجاح بعد التسجيل — الرصيد الجديد بمقياس المال. */
export function cashCountSettledMessage(countedMinor: number): string {
  return `انسجّلت التسوية ✓ — الصندوق صار ${formatMoneyMinor(countedMinor)} د.أ. ولا رقم قديم تغيّر؛ الفرق أثر من اليوم فقط.`;
}
