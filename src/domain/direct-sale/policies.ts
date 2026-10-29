import { JOD, fieldLabelAr, isValidLocalDate, isValidTimestamp } from "../shared/index.js";
import type {
  CreateDirectSaleInput,
  DirectSale,
  DirectSaleCollectionStatus,
  DirectSaleRevision,
  UpdateDirectSaleInput,
} from "./types.js";

function assertText(value: string, field: string) {
  if (!value.trim()) throw new Error(`أكمل ${fieldLabelAr(field)} قبل الحفظ.`);
}
function assertPositiveInteger(value: number, field: string) {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error(`أدخل ${fieldLabelAr(field)} رقمًا صحيحًا موجبًا.`);
}

function assertNonNegativeInteger(value: number, field: string) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error(`أدخل ${fieldLabelAr(field)} رقمًا صحيحًا غير سالب.`);
}

/* R2 (M-02/X1، 2026-10-08): صلاحية التاريخ المحلي من النواة الكنسية — كانت
 * نسخة حرفية لخوارزمية Date.UTC (ترفض السنوات 0000–0099 صدفةً وتكرر
 * الملكية)؛ الرسالة كما هي تمامًا. */
function assertLocalDate(value: string) {
  if (!isValidLocalDate(value)) throw new Error("أدخل تاريخ البيع تاريخًا محليًا صحيحًا.");
}

/* X-06: القبض لا يتجاوز السعر المتفق عليه — والفرق يحمل قرارًا صريحًا لا افتراضًا.
 * F-013 (W2-A): المجهول ليس مقبوضًا كاملًا — مدخلا الإنشاء والتعديل يوجبان قيمة
 * صريحة، ولا افتراض للقبض الكامل داخل المجال؛ عقد البيع النقدي السريع وحده
 * يُحل عند حد التطبيق مرة واحدة موثقًا (DirectSaleService.record).
 * S05 (DOC-014 / UNIT-037 A1/B4 + U037-F02): المستحق الجديد يحتاج تعريفًا
 * بسيطًا — اسم/وصفًا يعرّف صاحب المبلغ أو ربط طرف محفوظ صريح (لقطته على
 * المصدر)؛ لا هاتف ولا ملف دائم مفروض، ولا يُقبل فراغ يولّد دينًا بلا
 * متبوع. القيد على المستحق الجديد فقط: القديم غير المسمى يبقى بحدوده بلا
 * تعريف رجعي مفروض (UNIT-037 B2/AC14). */
const PARTY_DEFINITION_REQUIRED_MESSAGE =
  "اكتب اسمًا أو وصفًا يعرّف صاحب المبلغ المتبقي، أو اختر عميلًا محفوظًا — المتبقي بلا تعريف يضيع من المتابعة.";

function hasPartyIdentity(input: {
  customerName?: string | null | undefined;
  customerPartyId?: string | null | undefined;
}): boolean {
  return Boolean(input.customerName?.trim() || input.customerPartyId?.trim());
}

/* S05 (العقد المشترك §5.1 — PartyRef): الرابط المحفوظ يحمل لقطة تسميته معه
 * دائمًا (saved:{partyId,labelSnapshot}) — رابط بلا لقطة شكل مكسور يُرفض
 * داخل المجال، فتبقى المصادر معروضة الاسم حتى لو أُعيدت تسمية الطرف لاحقًا. */
const PARTY_LINK_REQUIRES_SNAPSHOT_MESSAGE =
  "ربط الطرف المحفوظ يحمل لقطة اسمه معه — أعد اختيار الطرف قبل الحفظ.";

function assertPartyLinkCarriesSnapshot(input: {
  customerName?: string | null | undefined;
  customerPartyId?: string | null | undefined;
}): void {
  if (input.customerPartyId?.trim() && !input.customerName?.trim())
    throw new Error(PARTY_LINK_REQUIRES_SNAPSHOT_MESSAGE);
}

/* S05 (DOC-014 / UNIT-037 A1/AC06): قيد المستحق الجديد فقط عند التعديل —
 * الدلتا من الحالة الأصلية تحدد هل استُحدث دين جديد (كان غير دَين فصار
 * partial_debt)؛ القديم غير المسمى الذي بقي دينًا كما كان يبقى بلا تعريف
 * رجعي مفروض (B2/AC14) — التعديل على أصل قائم لا يستحدث حقًا جديدًا. */
function assertDebtDefinitionOnEdit(updated: DirectSale, source: DirectSale): void {
  const introducesNewDebt =
    updated.collectionStatus === "partial_debt" && source.collectionStatus !== "partial_debt";
  if (
    introducesNewDebt &&
    !hasPartyIdentity({ customerName: updated.customerName, customerPartyId: updated.customerPartyId })
  )
    throw new Error(PARTY_DEFINITION_REQUIRED_MESSAGE);
}

/* إبقاء الأصل عند الغياب (مسار التعديل): undefined يُبقي الأصل، والقيمة الصريحة
 * (ومنها null) تُطبّق — منطق موحد للمرجع والزبون وربط الطرف المحفوظ. */
function keepOrOverride<T>(incoming: T | undefined, current: T | null): T | null {
  return incoming !== undefined ? incoming : current;
}

function resolveCollection(
  revenueMinor: number,
  collectedMinor: number,
  declared: DirectSaleCollectionStatus | undefined,
): { collectedMinor: number; collectionStatus: DirectSaleCollectionStatus } {
  if (!Number.isSafeInteger(collectedMinor) || collectedMinor < 0)
    throw new Error("سجّل المقبوض الآن صراحةً — المجهول لا يُحسب قبضًا كاملًا.");
  if (collectedMinor > revenueMinor)
    throw new Error("المقبوض لا يتجاوز السعر المتفق عليه — سجّل الفرق قرارك في التسعير لا في القبض.");
  const derived: DirectSaleCollectionStatus =
    collectedMinor === revenueMinor ? "collected_in_full" : "partial_needs_review";
  return { collectedMinor, collectionStatus: declared ?? derived };
}

/* المجموعة ٥ (S4-09): المتبقي على بيع مباشر — معيّن واحد في المجال تشترك فيه
 * ورقة التحصيل ومحرر البيع بدل حسابين قد يتباعدان. */
export function directSaleOutstandingMinor(sale: DirectSale): number {
  return Math.max(sale.revenueMinor - sale.collectedMinor, 0);
}

/* بانٍ داخلي واحد — تحقق الحقول المشترك داخل نفسه، وعقد الإنشاء يمتحّن تعريف
 * المستحق الجديد فوقه؛ ومسار التعديل يمتحّن القيد نفسه بمنطق الدلتا (مستحق
 * جديد فقط) كي يبقى القديم غير المسمى قابل التعديل بلا تعريف رجعي مفروض. */
function buildSaleRecord(input: CreateDirectSaleInput): DirectSale {
  assertText(input.id, "id");
  assertText(input.itemName, "itemName");
  assertText(input.note, "note");
  assertText(input.idempotencyKey, "idempotencyKey");
  assertPositiveInteger(input.quantity, "quantity");
  assertPositiveInteger(input.revenueMinor, "amountMinor");
  if (input.costMinor !== null) assertNonNegativeInteger(input.costMinor, "costMinor");
  assertLocalDate(input.occurredOn);
  /* R2 (M-02/X1): فحص الطابع من النواة — سلوك متكافل، مالك واحد. */
  if (!isValidTimestamp(input.recordedAt)) throw new Error("أدخل وقت التسجيل وقتًا صحيحًا.");
  const collection = resolveCollection(input.revenueMinor, input.collectedMinor, input.collectionStatus);
  return Object.freeze({
    id: input.id.trim(),
    itemName: input.itemName.trim(),
    quantity: input.quantity,
    currency: JOD,
    revenueMinor: input.revenueMinor,
    collectedMinor: collection.collectedMinor,
    collectionStatus: collection.collectionStatus,
    catalogItemId: input.catalogItemId?.trim() || null,
    /* D-001: الزبون حقل مستقل — الفراغ يُقرأ «بلا زبون» لا اسمًا مستخرجًا من الملاحظة. */
    customerName: input.customerName?.trim() || null,
    /* S05 (DOC-014 / UNIT-037): ربط الطرف المحفوظ الصريح إن اختير — غيابه null. */
    customerPartyId: input.customerPartyId?.trim() || null,
    costMinor: input.costMinor,
    profitMinor: input.costMinor === null ? null : input.revenueMinor - input.costMinor,
    occurredOn: input.occurredOn,
    recordedAt: input.recordedAt,
    note: input.note.trim(),
    idempotencyKey: input.idempotencyKey.trim(),
    status: "active" as const,
    cancelledAt: null,
    cancellationReason: null,
    revisions: [],
  });
}

export function createDirectSale(input: CreateDirectSaleInput): DirectSale {
  const draft = buildSaleRecord(input);
  /* S05 (DOC-014 / UNIT-037 A1): بيع بقي منه مبلغ مؤهل كدين = مستحق جديد —
   * «على مَن المبلغ؟» تعريف بسيط أو اختيار محفوظ؛ لا دين جديد بلا تعريف. */
  if (
    draft.collectionStatus === "partial_debt" &&
    !hasPartyIdentity({ customerName: draft.customerName, customerPartyId: draft.customerPartyId })
  )
    throw new Error(PARTY_DEFINITION_REQUIRED_MESSAGE);
  assertPartyLinkCarriesSnapshot(draft);
  return draft;
}

function assertRevision(revision: DirectSaleRevision) {
  assertText(revision.idempotencyKey, "idempotencyKey");
  if (revision.kind !== "edit" && revision.kind !== "cancel" && revision.kind !== "price_cut")
    throw new Error("نوع تصحيح البيع المباشر غير صالح.");
  if (!isValidTimestamp(revision.createdAt)) throw new Error("أدخل وقت التصحيح وقتًا صحيحًا.");
  if (revision.kind === "cancel") assertText(revision.reason ?? "", "cancellationReason");
}

function revisionList(
  source: DirectSale,
  revision: DirectSaleRevision,
  beforeRevenueMinor?: number | null,
): DirectSaleRevision[] {
  const revisions = [...(source.revisions ?? [])];
  if (source.idempotencyKey === revision.idempotencyKey)
    throw new Error("مفتاح التصحيح مستخدم أصلًا لتسجيل البيع.");
  if (revisions.some(candidate => candidate.idempotencyKey === revision.idempotencyKey))
    throw new Error("تم تنفيذ هذا التصحيح مسبقًا.");
  assertRevision(revision);
  revisions.push({
    kind: revision.kind,
    idempotencyKey: revision.idempotencyKey.trim(),
    createdAt: revision.createdAt,
    reason: revision.reason?.trim() || null,
    ...(beforeRevenueMinor !== undefined && beforeRevenueMinor !== null ? { beforeRevenueMinor } : {}),
  });
  return revisions;
}

export function updateDirectSale(
  source: DirectSale,
  input: UpdateDirectSaleInput,
  revision: DirectSaleRevision,
): DirectSale {
  if (source.status === "cancelled") throw new Error("لا يمكن تعديل بيع مباشر ملغى.");
  if (revision.kind !== "edit") throw new Error("تعديل البيع المباشر يحتاج تصحيحًا من نوع التعديل.");
  if ((source.revisions ?? []).some(candidate => candidate.kind === "cancel"))
    throw new Error("لا يمكن تعديل بيع مباشر يحمل إلغاءً سابقًا.");
  const updated = buildSaleRecord({
    id: source.id,
    itemName: input.itemName,
    quantity: input.quantity,
    revenueMinor: input.revenueMinor,
    collectedMinor: input.collectedMinor,
    collectionStatus: input.collectionStatus,
    /* ربط المرجع: التمييز بين «لم يُذكر» (يبقى الأصلي) و«أُلغي صراحة» (null). */
    catalogItemId: keepOrOverride(input.catalogItemId, source.catalogItemId),
    /* D-001: الزبون بالمنطق نفسه — undefined يُبقي الأصل، وnull الصريح يمحو الزبون. */
    customerName: keepOrOverride(input.customerName, source.customerName),
    /* S05 (DOC-014 / UNIT-037): ربط الطرف بالمنطق نفسه — undefined يُبقي الأصل،
     * وnull الصريح يفك الربط. */
    customerPartyId: keepOrOverride(input.customerPartyId, source.customerPartyId),
    costMinor: input.costMinor,
    occurredOn: input.occurredOn,
    recordedAt: source.recordedAt,
    note: input.note,
    idempotencyKey: source.idempotencyKey,
  });
  /* S05 (DOC-014 / UNIT-037 A1/AC06 — قيد المستحق الجديد فقط): التعديل الذي
   * يدخل بيعًا في دين جديد يوجب تعريفًا بسيطًا — والقيد بدلتا الحالة لا
   * بالحالة النهائية وحدها. */
  assertDebtDefinitionOnEdit(updated, source);
  assertPartyLinkCarriesSnapshot(updated);
  /* X-06: الأصل يبقى في السجل — كل تعديل يغيّر السعر المتفق يحمل سعره الأصلي معه. */
  const before = input.revenueMinor !== source.revenueMinor ? source.revenueMinor : undefined;
  return Object.freeze({
    ...updated,
    revisions: revisionList(source, revision, before),
  });
}

/* X-06 (و٤): «خفّضتُ السعر» — تخفيض موثَّق يحط السعر المتفق إلى المقبوض فعلًا:
 * لا دَين ولا تتبّع، والأصل يبقى في السجل بمراجعة تحمل السعر قبل التخفيض. */
export function applyPriceCut(
  source: DirectSale,
  revision: { idempotencyKey: string; createdAt: string; reason: string | null },
): DirectSale {
  if (source.status === "cancelled") throw new Error("لا يمكن تخفيض سعر بيع مباشر ملغى.");
  if ((source.revisions ?? []).some(candidate => candidate.kind === "cancel"))
    throw new Error("لا يمكن تخفيض سعر بيع مباشر يحمل إلغاءً سابقًا.");
  if (source.collectedMinor >= source.revenueMinor)
    throw new Error("التخفيض يخص بيعًا قبضه أقل من سعره المتفق — لا بيعًا مقبوضًا كاملًا.");
  const cut: DirectSaleRevision = {
    kind: "price_cut",
    idempotencyKey: revision.idempotencyKey,
    createdAt: revision.createdAt,
    reason: revision.reason,
  };
  const before = source.revenueMinor;
  const next: DirectSale = {
    ...source,
    revenueMinor: source.collectedMinor,
    profitMinor: source.costMinor === null ? null : source.collectedMinor - source.costMinor,
    collectionStatus: "collected_in_full",
    revisions: revisionList(source, cut, before),
  };
  return Object.freeze(next);
}

export function cancelDirectSale(source: DirectSale, revision: DirectSaleRevision): DirectSale {
  if (source.status === "cancelled") throw new Error("تم إلغاء هذا البيع المباشر مسبقًا.");
  if (revision.kind !== "cancel") throw new Error("إلغاء البيع المباشر يحتاج تصحيحًا من نوع الإلغاء.");
  if ((source.revisions ?? []).some(candidate => candidate.kind === "cancel"))
    throw new Error("تم إلغاء هذا البيع المباشر مسبقًا.");
  return Object.freeze({
    ...source,
    status: "cancelled",
    cancelledAt: revision.createdAt,
    cancellationReason: revision.reason?.trim() || null,
    revisions: revisionList(source, revision),
  });
}
