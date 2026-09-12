/** Transfer counters: export-count calculation and the strict current-file
 * count verification, extracted verbatim from localTransferService
 * (Group 10, Phase 10-D). Keys, order, and rejection rules unchanged.
 */
import { type LocalExportCounts, type LocalStoreSnapshot } from "@/storage/local/types";
import { isRecord } from "./transferFamilyValidators";

export function exportCountsOf(snapshot: LocalStoreSnapshot): LocalExportCounts {
  return {
    orders: snapshot.orders?.length ?? 0,
    directSales: snapshot.directSales?.length ?? 0,
    financialEvents: snapshot.financialEvents?.length ?? 0,
    supplierPurchases: snapshot.supplierPurchases?.length ?? 0,
    cashWallets: snapshot.cashWallets?.length ?? 0,
    cashContinuityEntries: snapshot.cashContinuityEntries?.length ?? 0,
    materials: snapshot.materials?.length ?? 0,
    inventoryMovements: snapshot.inventoryMovements?.length ?? 0,
    inventoryShortages: snapshot.inventoryShortages?.length ?? 0,
    assets: snapshot.assets?.length ?? 0,
    loans: snapshot.loans?.length ?? 0,
    schedules: snapshot.schedules?.length ?? 0,
    drafts: snapshot.drafts?.length ?? 0,
  };
}

/** تحقق العدادات للملف الحالي — يُعيد رسالة الرفض أو null عند القبول. */
export function verifyTransferCounts(
  candidate: Record<string, unknown>,
  migrated: LocalStoreSnapshot,
  isCurrent: boolean,
): string | null {
  if (isCurrent && !isRecord(candidate.counts))
    return "ملف الإصدار الحالي بلا عدادات تحقق — يبدو أن الملف فُتح وعُدّل وحُذف مظروف التحقق منه؛ لا يعتمد عليه. بقيت بيانات هذا الجهاز دون تغيير.";
  /* المجموعة ٢ (التحصين الكامل — MED-002): العدادات صارمة للملف الحالي —
   * كل مفتاح من مفاتيح العد المعروفة يجب أن يكون حاضرًا عددًا صحيحًا غير
   * سالب يطابق البيانات المُرحَّلة، وأي مفتاح غريب إضافي علامة تلاعب؛ الغائب
   * وغير الصحيح والسالب والمتضارب كلها تُرفض قبل أي استبدال. الملفات
   * القديمة (بلا عدادات أصلًا) على مسارها الموروث. */
  if (isRecord(candidate.counts) && isCurrent) {
    const incomingCounts: Record<string, unknown> = candidate.counts;
    const migratedCounts = exportCountsOf(migrated);
    const expectedKeys = Object.keys(migratedCounts) as Array<keyof LocalExportCounts>;
    const extraKeys = Object.keys(incomingCounts).filter(key => !(key in migratedCounts));
    const invalid = expectedKeys.some(key => {
      const incoming = incomingCounts[key];
      return (
        typeof incoming !== "number" ||
        !Number.isInteger(incoming) ||
        incoming < 0 ||
        incoming !== migratedCounts[key]
      );
    });
    if (extraKeys.length > 0 || invalid)
      return "عدادات الملف لا تطابق بياناته بعد الترحيل — يبدو أن الملف تغيّر أو نقص بعد إنشائه؛ لا يعتمد عليه. بقيت بيانات هذا الجهاز دون تغيير.";
  }
  return null;
}
