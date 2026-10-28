import type { CashContinuityEntry, CashWallet } from "@micro-domain/cash-continuity/index.js";

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

/** S04 (DOC-013 / UNIT-023 D01 — CONS-DEC03): حارس تغطية التحويل داخل حد الكتابة.
 *
 * التحويل من مصدر معروف الافتتاح لا يجعل رصيده سالبًا: تُحسب أرصدة المحافظ
 * الحية داخل المعاملة نفسها (من القيود القائمة)، ويُرفض الدفعة كاملة بلا أي
 * كتابة إذا كانت أرجل التحويل الجديدة (transfer_out/transfer_in وحدها) تنزل
 * بمحفظة معروفة الافتتاح تحت الصفر. المصدر مجهول الافتتاح لا يُفحص — التحويل
 * المؤكد الفعلي جائز مع إظهار حد المعرفة، والمجهول ليس صفرًا ولا سقفًا وهميًا.
 * التراجعات والضبط والتخصيص خارج هذا الحرس عمدًا: التصحيح المشروع قد يجعل
 * صافي القيود سالبًا ويُعرض كما هو (U025-R36) — الحارس لسلوك التحويل الجديد
 * وحده. هذا عمق دفاعي داخل الحد؛ الخدمة تفحص التغطية قبل الالتزام برسالة
 * أهدأ (U023-AC09)، والحارس يمنع سباق النافذتين (70+70 من 100 — U023-AC13):
 * الأول يلتزم والثاني يقرأ الرصيد بعد الأول فيُرفض بلا كتابة.
 */
export const TRANSFER_COVERAGE_MESSAGE =
  "الرصيد المسجل لهذا المكان لا يغطي التحويل — لم يُسجَّل شيء؛ راجع حركات المكان أو اختر المصدر الصحيح.";

export function findTransferCoverageShortfall(
  wallets: readonly CashWallet[],
  existingEntries: readonly CashContinuityEntry[],
  incomingEntries: readonly CashContinuityEntry[],
): { walletId: string; balanceAfter: number } | null {
  const knownOpening = new Set(
    wallets.filter(wallet => wallet.openingStatus !== "unknown").map(wallet => wallet.id),
  );
  /* صافي أرجل التحويل الجديدة لكل محفظة — أرجل الدفعة وحدها، لا الضبط ولا التراجع. */
  const transferNetByWallet = new Map<string, number>();
  for (const entry of incomingEntries) {
    if (entry.type !== "transfer_out" && entry.type !== "transfer_in") continue;
    transferNetByWallet.set(
      entry.walletId,
      (transferNetByWallet.get(entry.walletId) ?? 0) + entry.cashDeltaMinor,
    );
  }
  if (transferNetByWallet.size === 0) return null;
  for (const [walletId, transferNet] of transferNetByWallet) {
    if (!knownOpening.has(walletId)) continue;
    const liveBalance = existingEntries
      .filter(entry => entry.walletId === walletId)
      .reduce((total, entry) => total + entry.cashDeltaMinor, 0);
    const balanceAfter = liveBalance + transferNet;
    if (balanceAfter < 0) return { walletId, balanceAfter };
  }
  return null;
}
