import { JOD, fieldLabelAr } from "../shared/index.js";
import type {
  CreateDirectSaleInput,
  DirectSale,
  DirectSaleCollectionStatus,
  DirectSaleRevision,
  UpdateDirectSaleInput,
} from "./types.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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

function assertLocalDate(value: string) {
  if (!DATE_PATTERN.test(value)) throw new Error("أدخل تاريخ البيع تاريخًا محليًا صحيحًا.");
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month! - 1 || date.getUTCDate() !== day)
    throw new Error("أدخل تاريخ البيع تاريخًا محليًا صحيحًا.");
}

/* X-06: القبض لا يتجاوز السعر المتفق عليه — والفرق يحمل قرارًا صريحًا لا افتراضًا. */
function resolveCollection(
  revenueMinor: number,
  collectedMinor: number | undefined,
  declared: DirectSaleCollectionStatus | undefined,
): { collectedMinor: number; collectionStatus: DirectSaleCollectionStatus } {
  const collected = collectedMinor ?? revenueMinor;
  if (collected > revenueMinor)
    throw new Error("المقبوض لا يتجاوز السعر المتفق عليه — سجّل الفرق قرارك في التسعير لا في القبض.");
  const derived: DirectSaleCollectionStatus =
    collected === revenueMinor ? "collected_in_full" : "partial_needs_review";
  return { collectedMinor: collected, collectionStatus: declared ?? derived };
}

/* المجموعة ٥ (S4-09): المتبقي على بيع مباشر — معيّن واحد في المجال تشترك فيه
 * ورقة التحصيل ومحرر البيع بدل حسابين قد يتباعدان. */
export function directSaleOutstandingMinor(sale: DirectSale): number {
  return Math.max(sale.revenueMinor - sale.collectedMinor, 0);
}

export function createDirectSale(input: CreateDirectSaleInput): DirectSale {
  assertText(input.id, "id");
  assertText(input.itemName, "itemName");
  assertText(input.note, "note");
  assertText(input.idempotencyKey, "idempotencyKey");
  assertPositiveInteger(input.quantity, "quantity");
  assertPositiveInteger(input.revenueMinor, "amountMinor");
  if (input.costMinor !== null) assertNonNegativeInteger(input.costMinor, "costMinor");
  assertLocalDate(input.occurredOn);
  if (Number.isNaN(Date.parse(input.recordedAt))) throw new Error("أدخل وقت التسجيل وقتًا صحيحًا.");
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
    costMinor: input.costMinor,
    profitMinor: input.costMinor === null ? null : input.revenueMinor - input.costMinor,
    occurredOn: input.occurredOn,
    recordedAt: input.recordedAt,
    note: input.note.trim(),
    idempotencyKey: input.idempotencyKey.trim(),
    status: "active",
    cancelledAt: null,
    cancellationReason: null,
    revisions: [],
  });
}

function assertRevision(revision: DirectSaleRevision) {
  assertText(revision.idempotencyKey, "idempotencyKey");
  if (revision.kind !== "edit" && revision.kind !== "cancel" && revision.kind !== "price_cut")
    throw new Error("نوع تصحيح البيع المباشر غير صالح.");
  if (Number.isNaN(Date.parse(revision.createdAt))) throw new Error("أدخل وقت التصحيح وقتًا صحيحًا.");
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
  const updated = createDirectSale({
    id: source.id,
    itemName: input.itemName,
    quantity: input.quantity,
    revenueMinor: input.revenueMinor,
    collectedMinor: input.collectedMinor,
    collectionStatus: input.collectionStatus,
    /* ربط المرجع: التمييز بين «لم يُذكر» (يبقى الأصلي) و«أُلغي صراحة» (null). */
    catalogItemId: input.catalogItemId !== undefined ? input.catalogItemId : (source.catalogItemId ?? null),
    /* D-001: الزبون بالمنطق نفسه — undefined يُبقي الأصل، وnull الصريح يمحو الزبون. */
    customerName: input.customerName !== undefined ? input.customerName : (source.customerName ?? null),
    costMinor: input.costMinor,
    occurredOn: input.occurredOn,
    recordedAt: source.recordedAt,
    note: input.note,
    idempotencyKey: source.idempotencyKey,
  });
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
