import { JOD, fieldLabelAr, isValidLocalDate, isValidTimestamp, localDateInAmman } from "../shared/index.js";
import type {
  CollectDirectSalePaymentInput,
  CreateDirectSaleInput,
  DirectSale,
  DirectSaleCollectionEntry,
  DirectSaleCollectionStatus,
  DirectSaleFullReturnInput,
  DirectSaleRefundPaymentEntry,
  DirectSaleRevision,
  PayDirectSaleRefundInput,
  UpdateDirectSaleInput,
} from "./types.js";

export function assertText(value: string, field: string) {
  if (!value.trim()) throw new Error(`أكمل ${fieldLabelAr(field)} قبل الحفظ.`);
}
export function assertPositiveInteger(value: number, field: string) {
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
export function assertLocalDate(value: string) {
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
 * ورقة التحصيل ومحرر البيع بدل حسابين قد يتباعدان.
 * S11 (UNIT-005/PD-02): المرتجع الكامل يلغي الحق المتبقي — لا متبقي حي
 * بعده أبدًا (يقرأه كل القارئين من المعيّن الواحد هذا). */
export function directSaleOutstandingMinor(sale: DirectSale): number {
  if (sale.return) return 0;
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
  /* S11 (UNIT-026 sale-slice): القبض الابتدائي عند التسجيل سطر مؤرخ بهوية
   * ومفتاح حتميين (إعادة المحاولة لا تكتب سطرًا ثانيًا) — تاريخه تاريخ
   * البيع نفسه لأنه جزء من واقعة التسجيل؛ القبض اللاحق بتاريخه المستقل
   * (SDF-012). صفر القبض لا ينشئ سطرًا (لا حركة بلا مال). */
  const initialCollections: DirectSaleCollectionEntry[] =
    collection.collectedMinor > 0
      ? [
          {
            id: `${input.id.trim()}:initial`,
            amountMinor: collection.collectedMinor,
            occurredOn: input.occurredOn,
            operationKey: `${input.idempotencyKey.trim()}:initial`,
            recordedAt: input.recordedAt,
            note: null,
            allocationEntryId: null,
          },
        ]
      : [];
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
    ...(initialCollections.length > 0 ? { collections: initialCollections } : {}),
    return: null,
    refundPayments: [],
    refundedMinor: 0,
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

export function revisionList(
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

/* S11 (تصحيح المراجعة R2-002 — عهدة المفتاح عبر البيوت كلها): هل مفتاح
 * المراجعة مستخدم سلفًا لحركة على هذا البيع (إنشاء/قبض/رد)؟ — فحص مستقل
 * صغير، والمرتجع مستحيل هنا (مرفوض عند رأس updateDirectSale). */
function isKeyUsedBySaleMovement(source: DirectSale, revision: DirectSaleRevision): boolean {
  const key = revision.idempotencyKey.trim();
  return (
    source.idempotencyKey === key ||
    (source.collections ?? []).some(entry => entry.operationKey === key) ||
    (source.refundPayments ?? []).some(entry => entry.operationKey === key)
  );
}

/* S11 (تصحيح المراجعة R2-002): سطر تسوية مؤرخ لدلتا تعديل المقبض على بيع
 * ذي خطوط — بتاريخ التصحيح (تاريخ عمّان المحلي للمراجعة) وبمفتاحها —
 * المجموع المحروس والتفصيل المؤرخ يسيران معًا داخل الدالة الواحدة. */
function collectedAdjustingLine(
  source: DirectSale,
  revision: DirectSaleRevision,
  collectedDelta: number,
): DirectSaleCollectionEntry {
  const key = revision.idempotencyKey.trim();
  return {
    id: `${source.id}:adjust:${key}`,
    amountMinor: collectedDelta,
    occurredOn: localDateInAmman(revision.createdAt),
    operationKey: key,
    recordedAt: revision.createdAt,
    note: "تصحيح المقبوض",
    allocationEntryId: null,
  };
}

export function updateDirectSale(
  source: DirectSale,
  input: UpdateDirectSaleInput,
  revision: DirectSaleRevision,
): DirectSale {
  if (source.status === "cancelled") throw new Error("لا يمكن تعديل بيع مباشر ملغى.");
  /* S11 (UNIT-005/PD-02): المرتجع الكامل حالة مالية نهائية — الأصل وتاريخه
   * محفوظان للقراءة؛ تصحيح بياناته وصفه ليس مأذونًا بعده ولا اختراع سياسة
   * عكس مرتجع (لا سياسة معتمدة لذلك). */
  if (source.return) throw new Error("لا يمكن تعديل بيع مُرتجع كاملًا — سجله محفوظ بتاريخه.");
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
  /* S11 (تصحيح المراجعة R2-001 — المثال ٤/SDF-014): الإرث المجمل بلا خطوط
   * مؤرخة يبقى مجملًا — بانٍ الإنشاء يصطنع سطر :initial للقبض الابتدائي
   * (سلوك الإنشاء الصحيح) فتُنزَع صياغته هنا عن مسار التعديل؛ لا تُؤلف
   * تواريخ قبض لم يسجلها أحد أبدًا. */
  const { collections: _synthesizedInitialLine, ...rebuilt } = updated;
  /* S11 (تصحيح المراجعة R2-002 — عقد الأنواع §القبض المؤرخ): بيع بخطوط
   * مؤرخة + تعديل يغير المقبوض — دلتا التعديل حركة مؤرخة بتاريخ التصحيح
   * داخل الدالة نفسها (نمط العكس نفسه): المجموع المحروس والتفصيل المؤرخ
   * يسيران معًا دائمًا؛ والمفتاح نفسه للمراجعة والحركة لأنهما واقعة تصحيح
   * واحدة، وعهدة المفتاح تمنع تكراره فوق حركة قائمة. */
  const sourceCollections = source.collections;
  const collectedDelta = input.collectedMinor - source.collectedMinor;
  if (collectedDelta !== 0 && sourceCollections !== undefined && isKeyUsedBySaleMovement(source, revision))
    throw new Error("مفتاح التصحيح مستخدم سابقًا لحركة على هذا البيع — استعمل مفتاحًا جديدًا.");
  const adjustingLine: DirectSaleCollectionEntry | null =
    sourceCollections !== undefined && collectedDelta !== 0
      ? collectedAdjustingLine(source, revision, collectedDelta)
      : null;
  return preserveSaleHistory(rebuilt, source, adjustingLine, sourceCollections, before, revision);
}

/* S11 (UNIT-026 sale-slice + تصحيحا R2-001/002): تركيب نتيجة التعديل فوق
 * تاريخ البيع المالي — خطوط القبض المؤرخة محفوظة من الأصل حرفيًا (التصحيح
 * الوصفي لا يمحو التاريخ المالي المؤرخ؛ وغيابها = الإرث المجمل يبقى
 * غيابًا — لا تواريخ مؤلفة)، ودلتا المقبض حركة تسوية مؤرخة فوق الخطوط
 * القائمة، وحق الرد ومدفوعاته كما هما، والمجموع collectedMinor يبقى
 * الإجمالي المحروس وحيد القراءة (exactOptionalPropertyTypes: الحضور الشرطي
 * لا الإسناد الصريح لغير المعرف). */
function preserveSaleHistory(
  rebuilt: Omit<DirectSale, "collections">,
  source: DirectSale,
  adjustingLine: DirectSaleCollectionEntry | null,
  sourceCollections: readonly DirectSaleCollectionEntry[] | undefined,
  beforeRevenueMinor: number | undefined,
  revision: DirectSaleRevision,
): DirectSale {
  return Object.freeze({
    ...rebuilt,
    ...(sourceCollections !== undefined
      ? { collections: adjustingLine ? [...sourceCollections, adjustingLine] : sourceCollections }
      : {}),
    ...(source.refundPayments !== undefined ? { refundPayments: source.refundPayments } : {}),
    ...(source.refundedMinor !== undefined ? { refundedMinor: source.refundedMinor } : {}),
    return: source.return ?? null,
    revisions: revisionList(source, revision, beforeRevenueMinor),
  });
}

/* X-06 (و٤): «خفّضتُ السعر» — تخفيض موثَّق يحط السعر المتفق إلى المقبوض فعلًا:
 * لا دَين ولا تتبّع، والأصل يبقى في السجل بمراجعة تحمل السعر قبل التخفيض. */
export function applyPriceCut(
  source: DirectSale,
  revision: { idempotencyKey: string; createdAt: string; reason: string | null },
): DirectSale {
  if (source.status === "cancelled") throw new Error("لا يمكن تخفيض سعر بيع مباشر ملغى.");
  /* S11 (PD-02): المرتجع ليس تخفيض سعر متنكرًا — بيع مُرتجع لا يُخفّض. */
  if (source.return) throw new Error("لا يمكن تخفيض سعر بيع مُرتجع كاملًا.");
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
  /* S11 (PD-02): إلغاء التسجيل لخطأ الإدخال فعل مستقل عن المرتجع — بيع
   * مُرتجع كاملًا حدث فعلًا ورُدّ ماله؛ إلغاؤه يمحو أساس المرتجع فممنوع. */
  if (source.return) throw new Error("لا يمكن إلغاء تسجيل بيع مُرتجع كاملًا — استعمل أفعال المرتجع.");
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
