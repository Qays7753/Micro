import type { usePrototypeServices } from "@/app/PrototypeServicesContext";

/*
 * W3 — أدوات تسجيل مشتركة لنموذجي البيع/المصروف السريعين (طبقة أنماط المالية).
 * قراءة الموضع والتخصيص الصريح للمحفظة — نفس سلوك القشرة السابق حرفيًا.
 */

type Services = ReturnType<typeof usePrototypeServices>;

/** الكاش المسجل الآن — للوصل الصادق بعد التسجيل. */
export async function cashNow(projectFinance: Services["projectFinance"]): Promise<number | null> {
  const position = await projectFinance.readPosition();
  return position.ok ? position.value.recordedCashMinor : null;
}

/** تخصيص صريح بعد التسجيل — النتيجة تعاد للفاعل لا تُبتلع (إصلاح تكاملي م٤). */
export async function attributeToWallet(
  projectFinance: Services["projectFinance"],
  walletId: string,
  deltaMinor: number,
  note: string,
  sourceRefId?: string,
  sourceRefKind?: "sale" | "expense" | "collection" | "order",
  operationKey?: string,
): Promise<{ ok: boolean; message: string | null }> {
  if (!walletId || deltaMinor === 0) return { ok: true, message: null };
  const result = await projectFinance.distributeUnallocated({
    walletId,
    deltaMinor,
    note,
    sourceRefId: sourceRefId ?? null,
    sourceRefKind: sourceRefKind ?? null,
    /* G6-F1-5: مفتاح جذر مشتق من مفتاح السجل نفسه — إعادة المحاولة أو
     * التكرار لا يخصص الكاش مرتين. */
    operationKey: operationKey ?? undefined,
  });
  return result.ok ? { ok: true, message: null } : { ok: false, message: result.message };
}
