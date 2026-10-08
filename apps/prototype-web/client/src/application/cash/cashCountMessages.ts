/* R2 (M-10/D11، 2026-10-08): بناء نص السجل الدائم لتسوية عدّ الصندوق.
 * كانا في طبقة العرض (presentation/cashCountMessages) — عيب ملكية: طبقة
 * العرض لا تبني نص سجل محفوظ. الملاحظة والسبب يُكتبان على قيد
 * cash_adjustment دائم عبر المنسّق الكنوني للمحفوظ `persistedMoneyTextMinor`
 * (منزلتان دائمًا، بلا تجميع، بالوحدة) — لا بمنسّق العرض Intl المجمِّع.
 * رسالة التوست اللحظية (عرض لحظي بفواصل) بقيت في العرض حيث مكانها.
 * F-001 محفوظ: مقياس المال 1/100 في كل نص مالي — الاختبار يحرسه. */
import { persistedMoneyTextMinor } from "@micro-domain/shared/index.js";

/** نص الملاحظة التي تُحفظ مع تسوية العدّ — المعدود بمقياس المال لا الكميات. */
export function cashCountSettlementNote(countedMinor: number): string {
  return `تسوية عدّ الصندوق — المعدود ${persistedMoneyTextMinor(countedMinor)}`;
}

/** سبب التسوية — الفرق بمقياس المال، بإشارته، لا وحدات صغرى خام. */
export function cashCountDifferenceReason(differenceMinor: number): string {
  return differenceMinor > 0
    ? `فرق زيادة عند العدّ (+${persistedMoneyTextMinor(differenceMinor)})`
    : `فرق نقص عند العدّ (${persistedMoneyTextMinor(differenceMinor)})`;
}
