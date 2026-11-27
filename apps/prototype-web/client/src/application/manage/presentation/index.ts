/**
 * M5.1 (IMPACT §12 — «Presentation (عميل)»): باب طبقة عرض مانج — تنسيق
 * الإدخال المالي (moneyInput) وتنسيق العرض المشترك (display: التواريخ
 * والعمر والاستيفاء). كل مبلغ **معروض** يأتي نصًا جاهزًا من الخادم؛ هذا
 * الباب لا يحمل أي معادلة من §8 أبدًا.
 */
export { MANAGE_FILS_PER_JOD, parseJodInputToFils, jodInputText } from "./moneyInput.js";
export { fill, formatDateR21, formatMonthR21, ageTextR19 } from "./display.js";
export { manageErrorText } from "./errorText.js";
