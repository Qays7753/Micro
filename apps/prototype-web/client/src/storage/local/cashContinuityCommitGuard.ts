import type { CashContinuityEntry } from "@micro-domain/cash-continuity/index.js";

/** EXE-008 (CASH-001): رفض المخزن قيد افتتاح ثانيًا لنفس المحفظة.
 *
 * الخدمة تمنع الافتتاح الثاني أصلًا من كل مسار إنتاجي (openWallet وrecordOpeningBalanceLater
 * يرفضانه برسالة صادقة)، لكن الحماية كانت في طبقة الخدمة فقط — أي مستدعٍ مستقبلي
 * يستدعي commitCashContinuity مباشرة بقيد opening_balance جديد بمفتاح مختلف كان
 * سيمر. هذا الحرس عمق دفاعي داخل حد الكتابة نفسه: تُقرأ القيود القائمة داخل
 * المعاملة، ووجود افتتاح سابق للمحفظة نفسها (أو افتتاحين جديدين لها في الدفعة
 * الواحدة) يُرفض الكتابة كلها ولا يُكتب شيء. إعادة إرسال الافتتاح نفسه بمفتاح
 * العملية نفسه لا تصل إلى هنا أصلًا — تتخطاه فلترة المفتاح المكرر كمُعاد استخدامه.
 */
export const SECOND_WALLET_OPENING_MESSAGE =
  "لكل محفظة قيد افتتاح واحد فقط. رفض المخزن قيد افتتاح ثانيًا لنفس المحفظة — التسوية اللاحقة تُسجل ضبط كاش موثقًا بسبب، لا افتتاحًا ثانيًا.";

export function findSecondWalletOpening(
  existingEntries: readonly CashContinuityEntry[],
  incomingEntries: readonly CashContinuityEntry[],
): CashContinuityEntry | null {
  const openedWalletIds = new Set(
    existingEntries.filter(entry => entry.type === "opening_balance").map(entry => entry.walletId),
  );
  const batchOpenedWalletIds = new Set<string>();
  for (const entry of incomingEntries) {
    if (entry.type !== "opening_balance") continue;
    if (openedWalletIds.has(entry.walletId) || batchOpenedWalletIds.has(entry.walletId)) return entry;
    batchOpenedWalletIds.add(entry.walletId);
  }
  return null;
}
