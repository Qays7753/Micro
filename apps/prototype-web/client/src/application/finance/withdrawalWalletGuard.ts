import {
  summarizeCashContinuity,
  type CashContinuityEntry,
  type CashWallet,
} from "@micro-domain/cash-continuity/index.js";
import { formatMoneyWithUnit } from "@/presentation/formatters";

/* G-006 (تدقيق الإدارة المالية المتدرجة 2026-09-19): مسار دفتر المالك كان
 * يتحقق وجود المحفظة فقط (لا تغطيتها) فكان السحب يجعل رصيدها سالبًا بصمت،
 * بينما مسار الحدث يفحص التغطية بعد حفظ الحدث. هذا الحرس المشترك الواحد
 * هو السياسة الكنونية للمسارين معًا (طبقة التطبيق — لا منطق مالي في
 * الواجهة): تحقق المبلغ، فوجود المحفظة، فتغطية الرصيد برسالة تعرض المتاح
 * والمطلوب؛ غير الموزع مصدر صريح مسموح كما هو معلن (لا سياسة تُخترع).
 * السحب ليس مصروفًا ولا يدخل نتيجة الفترة — هذا الحرس لا يغير شيئًا من
 * تلك الدلالة، يمنع فقط الكتابة الجزئية/السالبة فوق رصيد لا يغطيها. */

export type WithdrawalWalletGuardInput = {
  /** المحفظة المختارة — null يعني الكاش غير الموزع (مصدر صريح مسموح). */
  walletId: string | null;
  wallets: readonly CashWallet[];
  cashEntries: readonly CashContinuityEntry[];
  amountMinor: number;
};

export type WithdrawalWalletGuardResult =
  | { ok: true; value: { walletId: string; walletBalanceMinor: number } }
  | { ok: false; message: string; availableMinor: number };

/** تقييم تغطية المحفظة لسحب مالك — دالة نقية واحدة للمسارين. */
export function evaluateWithdrawalWalletCoverage(
  input: WithdrawalWalletGuardInput,
): WithdrawalWalletGuardResult {
  const { walletId, wallets, cashEntries, amountMinor } = input;
  if (!Number.isInteger(amountMinor) || amountMinor <= 0)
    return {
      ok: false,
      message: "أدخل مبلغ السحب رقمًا صحيحًا موجبًا.",
      availableMinor: 0,
    };
  /* غير الموزع مصدر صريح — لا فحص رصيد يُخترع له (سياسة معلنة قائمة). */
  if (walletId === null || walletId.trim() === "")
    return { ok: true, value: { walletId: "", walletBalanceMinor: 0 } };
  const wallet = wallets.find(candidate => candidate.id === walletId);
  if (!wallet)
    return {
      ok: false,
      message: "اختر محفظة كاش موجودة؛ لا تحفظ حركة بلا محفظة.",
      availableMinor: 0,
    };
  const walletBalanceMinor = summarizeCashContinuity(
    cashEntries.filter(entry => entry.walletId === wallet.id),
  );
  if (walletBalanceMinor < amountMinor)
    return {
      ok: false,
      message: `رصيد المحفظة لا يغطي هذا السحب — المتاح لديك ${formatMoneyWithUnit(
        walletBalanceMinor,
      )} والمطلوب ${formatMoneyWithUnit(amountMinor)}. اختر محفظة أخرى أو صرّف المبلغ من الكاش غير الموزع.`,
      availableMinor: walletBalanceMinor,
    };
  return { ok: true, value: { walletId: wallet.id, walletBalanceMinor } };
}
