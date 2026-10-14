/**
 * المجموعة ٥/٦ (عقد ٣٧ — وقفة محاولات القفل): جدول الوقفة التصاعدية
 * (٣/١٠/٣٠ ثانية بعد ٣/٥/٨ محاولات فاشلة) ورسالة الانتظار الموحدة.
 *
 * R11 Lock Remediation (2026-10-15): وحدة مشتركة صغيرة بين الخدمة (الرئيسية
 * في كومة الإقلاع: الحارس الثابت retryDelayMs) ووحدة عمليات الرمز الكسولة
 * (pinOperations.ts) — فلا استيراد دائري بينهما بأي اتجاه.
 */

/** محاولات متتالية تستوجب وقفة قصيرة قبل المحاولة التالية (احترام آدمي بلا قفل دائم). */
export function delayForAttempts(failedAttempts: number): number {
  if (failedAttempts >= 8) return 30_000;
  if (failedAttempts >= 5) return 10_000;
  if (failedAttempts >= 3) return 3_000;
  return 0;
}

/** رسالة الانتظار الموحدة لمساري التعطيل (داخل النافذة وتحت الساعة غير الموثوقة). */
export function backoffWaitMessage(remainingMs: number): string {
  return `انتظر قليلًا قبل المحاولة التالية (${Math.ceil(remainingMs / 1000)} ثانية تقريبًا).`;
}
