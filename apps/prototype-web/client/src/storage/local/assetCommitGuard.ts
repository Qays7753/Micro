import type { FinancialEvent } from "@micro-domain/financial-event/index.js";
import { reversedEventIds } from "@micro-domain/financial-event/index.js";
import { activeSettlementsMinor } from "@micro-domain/financial-event/index.js";
import type { AssetRecord } from "@micro-domain/asset/index.js";

/* S08 (UNIT-034 / أمر S08 §التنفيذ): كل كتابة حساسة على سجلات الأصول
 * وأحداثها تتحقق الحالة الحية داخل حد الكتابة نفسه — المهايئان يستهلكان
 * القرار النقي الواحد هنا (نمط supplierScheduleCommitGuard وinventoryCommitGuard):
 *
 * ١) سجل الأصل (commitAssetRecord): إعادة تشغيل الإنشاء/الحدث بمفتاحه
 *    إعادة استخدام صادقة؛ وكل تعديل (مراجعة عقد/تخلص/شطب/تصحيح اقتناء)
 *    علاقة «عملية مجال واحدة بالضبط» بين المخزّن والوارد — أي انحراف يعني
 *    كاتبًا آخر سبق الحد فيُرفض بـstorage_stale بلا أي كتابة (لا
 *    آخر-كاتب-يفوز صامتًا فوق سجل له أحداث مالية).
 * ٢) الاقتناء الذري متعدد الأحداث (commitAssetAcquisition): السجل وأحداثه
 *    معًا أو لا شيء؛ إعادة الإرسال إعادة استخدام بالمفاتيح لا تكرارًا.
 * ٣) تسديد ذممة الأصل (commitAssetPayableSettlement): مصدر حي غير معكوس
 *    (حدث asset_purchase_payable) والمبلغ داخل المتبقي الحي المحسوب من
 *    الأحداث داخل المعاملة نفسها — لا تجاوز للحق الحي أبدًا؛ وإعادة
 *    المفتاح المتطابق إعادة استخدام صادقة والمختلف تعارض بلا استبدال. */

export const ASSET_RECORD_CHANGED_MESSAGE =
  "سجل الأصل تغيّر من مسار آخر بعد فتحك له — لم يُسجَّل شيء؛ أعد المحاولة.";
export const ASSET_SETTLEMENT_BOUND_MESSAGE =
  "التسديد يتجاوز المتبقي الحي على التزام اقتناء هذا الأصل — راجع سجل التسديدات ثم أعد المحاولة.";
export const ASSET_SETTLEMENT_SOURCE_MESSAGE =
  "التزام اقتناء الأصل غير موجود أو معكوس سابقًا — لم يُسجَّل شيء؛ أعد المحاولة.";
export const ASSET_OPERATION_KEY_CONFLICT_MESSAGE =
  "عملية أصول أخرى بنفس المفتاح وحملة مختلفة سبقتك — لم يُسجَّل شيء ولم يُستبدل شيء؛ أعد المحاولة بمفتاح جديد.";

export type AssetRecordCommitGuardResult = { ok: true; reused: boolean } | { ok: false; message: string };

/* الهوية المالية لحدث الأصول: النوع والمبلغ والمفتاح والتاريخ والمصدر —
 * المعرف العشوائي ووقت التسجيل خارجها (إعادة الإرسال بعد نتيجة مجهولة
 * تبني معرفًا جديدًا بنفس الحملة فتُعاد كما هي). */
const sameAssetEventIdentity = (a: FinancialEvent, b: FinancialEvent) =>
  a.type === b.type &&
  a.amountMinor === b.amountMinor &&
  a.idempotencyKey === b.idempotencyKey &&
  a.occurredOn === b.occurredOn &&
  a.relatedEventId === b.relatedEventId &&
  (a.assetContext?.assetId ?? "") === (b.assetContext?.assetId ?? "");

const revisionsIdentical = (stored: AssetRecord, incoming: AssetRecord) => {
  const storedRevisions = stored.contractRevisions ?? [];
  const incomingRevisions = incoming.contractRevisions ?? [];
  return (
    incomingRevisions.length === storedRevisions.length &&
    storedRevisions.every(
      (revision, index) =>
        incomingRevisions[index]!.revision === revision.revision &&
        incomingRevisions[index]!.reason === revision.reason &&
        incomingRevisions[index]!.changedAt === revision.changedAt,
    )
  );
};

const revisionsAppendable = (stored: AssetRecord, incoming: AssetRecord) => {
  const storedRevisions = stored.contractRevisions ?? [];
  const incomingRevisions = incoming.contractRevisions ?? [];
  return (
    incomingRevisions.length === storedRevisions.length + 1 &&
    storedRevisions.every(
      (revision, index) =>
        incomingRevisions[index]!.revision === revision.revision &&
        incomingRevisions[index]!.reason === revision.reason &&
        incomingRevisions[index]!.changedAt === revision.changedAt &&
        incomingRevisions[index]!.lifeMonths === revision.lifeMonths &&
        incomingRevisions[index]!.depreciationStartOn === revision.depreciationStartOn &&
        (incomingRevisions[index]!.residualValueMinor ?? null) === (revision.residualValueMinor ?? null),
    )
  );
};

/* السجلان متطابقان في كل حقول العقد — إعادة تشغيل صادقة لأي التزام لا
 * يغيّر السجل (إنشاء بعد نتيجة مجهولة، أو تسجيل إهلاك فوق السجل نفسه):
 * لا كتابة سجل، وأحداثها تُفحص عند ذراع الأحداث وحده. */
const assetRecordContractIdentical = (stored: AssetRecord, incoming: AssetRecord) =>
  stored.id === incoming.id &&
  stored.name === incoming.name &&
  stored.categoryLabel === incoming.categoryLabel &&
  stored.acquisitionAmountMinor === incoming.acquisitionAmountMinor &&
  stored.acquisitionKind === incoming.acquisitionKind &&
  stored.purchaseDate === incoming.purchaseDate &&
  stored.lifeMonths === incoming.lifeMonths &&
  stored.depreciationStartOn === incoming.depreciationStartOn &&
  (stored.residualValueMinor ?? null) === (incoming.residualValueMinor ?? null) &&
  (stored.note ?? null) === (incoming.note ?? null) &&
  (stored.acquisitionParty?.partyId ?? "") === (incoming.acquisitionParty?.partyId ?? "") &&
  (stored.acquisitionParty?.labelSnapshot ?? "") === (incoming.acquisitionParty?.labelSnapshot ?? "") &&
  (stored.paidAtCreationMinor ?? null) === (incoming.paidAtCreationMinor ?? null) &&
  stored.status === incoming.status &&
  stored.acquisitionEventId === incoming.acquisitionEventId &&
  JSON.stringify(stored.disposal) === JSON.stringify(incoming.disposal) &&
  JSON.stringify(stored.writeOff) === JSON.stringify(incoming.writeOff) &&
  revisionsIdentical(stored, incoming) &&
  stored.operationKey === incoming.operationKey &&
  stored.createdAt === incoming.createdAt &&
  stored.updatedAt === incoming.updatedAt;

/** فحص علاقة التزام سجل أصل بين المخزّن والوارد — إنشاء أو مراجعة عقد أو
 * تخلص أو شطب، كلٌّ علاقته الواحدة بالضبط؛ وإلا رفض صريح بلا كتابة. */
export function validateAssetRecordCommit(
  stored: AssetRecord | undefined,
  incoming: AssetRecord,
): AssetRecordCommitGuardResult {
  if (stored === undefined) return { ok: true, reused: false };
  /* إعادة تشغيل لا تغيّر السجل (إنشاء مكرر/تسجيل إهلاك فوق السجل نفسه) —
   * إعادة استخدام صادقة للسجل لا كتابة فوقه ولا إسقاط لما تراكم عليه. */
  if (assetRecordContractIdentical(stored, incoming)) return { ok: true, reused: true };
  /* الهوية الثابتة خارج أثر العملية — أي تغيّر فيها يعني عملية أخرى. */
  if (
    stored.id !== incoming.id ||
    stored.operationKey !== incoming.operationKey ||
    stored.createdAt !== incoming.createdAt
  )
    return { ok: false, message: ASSET_RECORD_CHANGED_MESSAGE };
  /* التخلص: نشط يتخلص منه — التجميد يضاف مرة واحدة والمراجعات كما هي حرفيًا. */
  if (incoming.status === "disposed" && !stored.disposal) {
    if (stored.status !== "active") return { ok: false, message: ASSET_RECORD_CHANGED_MESSAGE };
    if (!incoming.disposal || incoming.writeOff !== stored.writeOff || !revisionsIdentical(stored, incoming))
      return { ok: false, message: ASSET_RECORD_CHANGED_MESSAGE };
    return { ok: true, reused: false };
  }
  /* الشطب: نشط يُشطب — القيمة المجمدة تضاف مرة واحدة والمراجعات كما هي. */
  if (incoming.status === "written_off" && !stored.writeOff) {
    if (stored.status !== "active") return { ok: false, message: ASSET_RECORD_CHANGED_MESSAGE };
    if (!incoming.writeOff || incoming.disposal !== stored.disposal || !revisionsIdentical(stored, incoming))
      return { ok: false, message: ASSET_RECORD_CHANGED_MESSAGE };
    return { ok: true, reused: false };
  }
  /* مراجعة العقد: مراجعة واحدة جديدة بالضبط تُلحق بالتاريخ والحقول العليا
   * تطابق المراجعة نفسها (النقاء عند المجال) — والإهلاك المسجل لا يُمس. */
  if (incoming.status === "active" && revisionsAppendable(stored, incoming)) {
    if (stored.disposal !== incoming.disposal || stored.writeOff !== incoming.writeOff)
      return { ok: false, message: ASSET_RECORD_CHANGED_MESSAGE };
    return { ok: true, reused: false };
  }
  /* تصحيح الاقتناء: القيمة/النوع/المدفوع الأولي/رابط الحدث قد تتبدل والباقي
   * ثابت — علاقة موثقة عند كاتبها (commitAssetAcquisitionCorrection) لا هنا. */
  return { ok: false, message: ASSET_RECORD_CHANGED_MESSAGE };
}

export type AssetEventsCommitGuardResult =
  { ok: true; reused: boolean; storedEvents: readonly FinancialEvent[] } | { ok: false; message: string };

/** أحداث الالتزام (اقتناء/تصحيح) مقابل الأحداث الحية — إعادة الإرسال
 * بالمفاتيح إعادة استخدام صادقة بالقيم المخزنة، والمفتاح بحملة مختلفة
 * تعارض بلا استبدال، والجديد يُكتب. */
export function validateAssetEventsCommit(
  liveEvents: readonly FinancialEvent[],
  incoming: readonly FinancialEvent[],
): AssetEventsCommitGuardResult {
  const byKey = new Map(liveEvents.map(event => [event.idempotencyKey, event] as const));
  const storedEvents: FinancialEvent[] = [];
  let reused = false;
  for (const event of incoming) {
    const stored = byKey.get(event.idempotencyKey);
    if (stored) {
      if (!sameAssetEventIdentity(stored, event))
        return { ok: false, message: ASSET_OPERATION_KEY_CONFLICT_MESSAGE };
      reused = true;
      storedEvents.push(stored);
      continue;
    }
    storedEvents.push(event);
  }
  return { ok: true, reused, storedEvents };
}

export type AssetSettlementCommitGuardResult =
  { ok: true; reused: boolean; stored: FinancialEvent } | { ok: false; message: string };

/** تسديد ذممة اقتناء أصل داخل حد الكتابة — المصدر حي والمبلغ داخل المتبقي
 * الحي المحسوب من الأحداث الحية داخل المعاملة نفسها؛ وإعادة المفتاح
 * المتطابق إعادة استخدام صادقة. */
export function validateAssetPayableSettlementCommit(
  liveEvents: readonly FinancialEvent[],
  settlement: FinancialEvent,
): AssetSettlementCommitGuardResult {
  const byKey = liveEvents.find(event => event.idempotencyKey === settlement.idempotencyKey);
  if (byKey) {
    if (!sameAssetEventIdentity(byKey, settlement))
      return { ok: false, message: ASSET_OPERATION_KEY_CONFLICT_MESSAGE };
    return { ok: true, reused: true, stored: byKey };
  }
  const source = liveEvents.find(event => event.id === settlement.relatedEventId);
  if (!source || source.type !== "asset_purchase_payable")
    return { ok: false, message: ASSET_SETTLEMENT_SOURCE_MESSAGE };
  const reversed = reversedEventIds(liveEvents);
  if (source.correctionType === "reverse" || reversed.has(source.id))
    return { ok: false, message: ASSET_SETTLEMENT_SOURCE_MESSAGE };
  const settled = activeSettlementsMinor(liveEvents, source.id);
  if (settlement.amountMinor > source.amountMinor - settled)
    return { ok: false, message: ASSET_SETTLEMENT_BOUND_MESSAGE };
  return { ok: true, reused: false, stored: settlement };
}
