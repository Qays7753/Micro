/* MIC-17: اكتمال تخصيص محافظ دفعات الموردين (G-002) — انتقلت حرفيًا من
 * integrityCheckService.ts في Wave F (ADR-013 — تقسيم مسؤولية داخلي)؛
 * الفحص قراءة فقط عبر السياق المشترك ولا يكتب ولا يصلح أبدًا.
 *
 * كل دفعة موصولة بمحفظة (حقل walletId) يجب أن يقابلها قيد تغطية
 * supplier_purchase بنفس المبلغ على المحفظة نفسها — الناقص (بقايا فشل
 * قديم قبل المعاملة الذرّية) يُعلن خللًا بنيويًا للمراجعة، والفحص قراءة
 * فقط: الشفاء يتم بإعادة إرسال الدفعة نفسها أو بقرار المالك، لا تلقائيًا.
 * الدفعات المرتجعة تدخل في المتوقع مثلها مثل النشطة — عكس الدفعة لا يعكس
 * تخصيص محفظتها اليوم (سلوك موثق ينتظر قرار مالك منفصل)، فاستبعادها كان
 * سيزيف إنذارًا كاذبًا لا يكشف الناقص الحقيقي. */
import {
  fail,
  INTEGRITY_TITLES,
  unavailable,
  type IntegrityCheckContext,
  type IntegrityCheckResult,
} from "./integrityCheckModel";

export async function checkSupplierWalletAttribution(
  ctx: IntegrityCheckContext,
): Promise<IntegrityCheckResult> {
  const [purchasesResult, entriesResult] = await Promise.all([
    ctx.store.listSupplierPurchases(),
    ctx.store.listCashContinuityEntries(),
  ]);
  if (!purchasesResult.ok || !entriesResult.ok)
    return unavailable("MIC-17", "تعذر قراءة مشتريات الموردين أو قيود المحافظ — أعد المحاولة.");
  const entries = entriesResult.value;
  const offenders: string[] = [];
  for (const purchase of purchasesResult.value) {
    const byWallet = new Map<string, number>();
    for (const payment of purchase.payments) {
      const walletId = payment.walletId?.trim() || null;
      if (!walletId) continue;
      byWallet.set(walletId, (byWallet.get(walletId) ?? 0) + payment.amountMinor);
    }
    if (byWallet.size === 0) continue;
    for (const [walletId, expectedPaidMinor] of byWallet) {
      const attributedMinor = entries
        .filter(
          entry =>
            entry.type === "allocation" &&
            entry.sourceRefKind === "supplier_purchase" &&
            entry.sourceRefId === purchase.id &&
            entry.walletId === walletId,
        )
        .reduce((sum, entry) => sum + entry.cashDeltaMinor, 0);
      if (attributedMinor !== -expectedPaidMinor) offenders.push(purchase.id);
    }
  }
  if (offenders.length === 0)
    return {
      id: "MIC-17",
      titleAr: INTEGRITY_TITLES["MIC-17"],
      status: "PASS",
      detailAr: `كل دفعة مورد موصولة بمحفظة يقابلها قيد تغطية مطابق — لا أثر غير موزع (${purchasesResult.value.length}).`,
    };
  return fail(
    "MIC-17",
    `دفعات مورد بمحفظة بلا قيد تغطية مطابق في ${offenders.length} شراء — راجع الشراء وأعد إرسال الدفعة نفسها لتشفى، أو راجعه بقرار واعٍ.`,
    offenders,
    null,
    "/suppliers",
  );
}
