/**
 * R7 / R6-F17-P05 (WS-216 — 2026-10-10): نموذج عرض صفحة استحقاق المالك —
 * اشتقاقات السجلات النشطة (الاستحقاقات القائمة، الأرصدة الافتتاحية القائمة،
 * السحوبات السابقة) فوق القراءة الموحدة، خلف سطح تطبيقي مالك في بيت
 * مال المالك. كان هذا المنطق داخل pages/OwnerEntitlement.tsx؛ الصفحة تبقي
 * ربط React وقنوات الكتابة ونسخ الواجهة.
 *
 * عقد هذه الوحدة:
 *  - قراءة واشتقاق فقط: الخدمة الكنسية (ownerEntitlementService بعقد PC-4)
 *    لم تُمس ولم تُقسم — F-014 PRESERVE قائم؛ هذا نموذج عرض فوقها.
 *  - لا حساب مال ولا قاعدة مالية: تصفية سجلات بعكس موثق (reversalOfId)
 *    وتصنيف أسباب الحركات — نفس منطق الصفحة حرفيًا.
 */

import type {
  OwnerEntitlementOverview,
  OwnerMoneyOverview,
  OwnerEntitlementService,
} from "./ownerEntitlementService";

/** القراءة الموحدة لمال المالك فوق المصدرين (المجموعة ٦ البند ٢). */
export async function readOwnerMoneyOverviewBlock(deps: {
  ownerEntitlement: OwnerEntitlementService;
}): Promise<OwnerMoneyOverview | null> {
  const result = await deps.ownerEntitlement.readOwnerMoneyOverview();
  return result.ok ? result.value : null;
}

/** اشتقاقات السجلات النشطة — نفس تصفية الصفحة حرفيًا: السجل المعكوس
 *  (reversalOfId غير فارغ) والسجل الذي له عكس مقابل كلاهما خارج الجلسة. */
export type ActiveOwnerRecords = {
  reversedEntitlementIds: Set<string | null>;
  reversedOpeningIds: Set<string | null>;
  reversedMovementIds: Set<string | null>;
  activeEntitlements: OwnerEntitlementOverview["entitlements"];
  activeOpeningBalances: OwnerEntitlementOverview["openingBalances"];
  /* السحوبات السابقة: سحب قائم غير معكوس وليس تسوية استحقاق/رصيد افتتاحي. */
  priorDraws: OwnerEntitlementOverview["movements"];
};

export function deriveActiveOwnerRecords(overview: OwnerEntitlementOverview): ActiveOwnerRecords {
  const reversedEntitlementIds = new Set(
    overview.entitlements.filter(record => record.reversalOfId !== null).map(record => record.reversalOfId),
  );
  const reversedOpeningIds = new Set(
    overview.openingBalances
      .filter(balance => balance.reversalOfId !== null)
      .map(balance => balance.reversalOfId),
  );
  const reversedMovementIds = new Set(
    overview.movements
      .filter(movement => movement.reversalOfId !== null)
      .map(movement => movement.reversalOfId),
  );
  const activeEntitlements = overview.entitlements.filter(
    record => record.reversalOfId === null && !reversedEntitlementIds.has(record.id),
  );
  const activeOpeningBalances = overview.openingBalances.filter(
    balance => balance.reversalOfId === null && !reversedOpeningIds.has(balance.id),
  );
  const priorDraws = overview.movements.filter(
    movement =>
      movement.kind === "draw" &&
      movement.reversalOfId === null &&
      !reversedMovementIds.has(movement.id) &&
      movement.reason !== "entitlement_settlement" &&
      movement.reason !== "opening_balance_settlement",
  );
  return {
    reversedEntitlementIds,
    reversedOpeningIds,
    reversedMovementIds,
    activeEntitlements,
    activeOpeningBalances,
    priorDraws,
  };
}
