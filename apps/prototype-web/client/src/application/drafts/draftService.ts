/** Application boundary for pre-domain drafts. A draft is not a CraftOrder and has no price, cash, or result effect. */
import type { DraftGroup, DraftIntent, OrderDraft, PrototypeLocalStore } from "@/storage/local/types";

/** R3 (بطاقة R3-SC-01/11): عدسة الخدمة — مسودات الطلب الأربع بالضبط (عائلة KEEP R3-SC-17). */
export type DraftServiceStore = Pick<
  PrototypeLocalStore,
  "listDrafts" | "getDraft" | "saveDraft" | "deleteDraft"
>;
import {
  CONFLICT,
  NOT_FOUND,
  STORAGE_ERROR,
  VALIDATION_ERROR,
  notFoundFailure,
  storageFailure,
  validationFailure,
} from "@/application/resultCodes";
import { systemClock, type Clock } from "@/application/time/clock";

export type DraftInput = Pick<
  OrderDraft,
  | "intent"
  | "customerName"
  | "orderName"
  | "itemName"
  | "catalogItemId"
  | "specifications"
  | "quantity"
  | "costSnapshots"
  | "activeCostSnapshotId"
  | "linkedOrderId"
  | "sourceEstimateId"
  | "offeringRef"
  | "groups"
  | "suggestedPriceMinor"
>;
export type DraftSaveResult =
  | { ok: true; draft: OrderDraft }
  | { ok: false; code: "validation_error" | "storage_error" | "conflict"; message: string };
/* القرار ٢١: الحذف للمسودة غير المرتبطة فقط — الحدّ القاطع linkedOrderId !== null ⇒ ممنوع،
 * وتُقرأ قيمة الحقل لا تُستنتج من الحالة. المسودة لا أثر مالي لها. */
export type DraftDeleteResult =
  | { ok: true; id: string }
  | { ok: false; code: "validation_error" | "storage_error" | "not_found"; message: string };

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export class DraftService {
  constructor(
    private readonly store: DraftServiceStore,
    private readonly now: Clock = systemClock,
  ) {}
  list() {
    return this.store.listDrafts();
  }
  get(id: string) {
    return this.store.getDraft(id);
  }
  /* §٥-١ (و٥): الإنشاء لا يحدث عند نقر النية بل عند أول إدخال حقيقي — فالإنشاء
   * يقبل قيم البداية التي كتبها المالك، ولا يولّد مسودة فارغة من نقرة. */
  async create(intent: DraftIntent, initial: Partial<DraftInput> = {}): Promise<DraftSaveResult> {
    return this.save({
      id: createId(),
      intent,
      customerName: "",
      orderName: null,
      itemName: "",
      catalogItemId: null,
      specifications: "",
      quantity: 1,
      costSnapshots: [],
      activeCostSnapshotId: null,
      linkedOrderId: null,
      sourceEstimateId: null,
      offeringRef: null,
      groups: null,
      suggestedPriceMinor: null,
      createdAt: this.now(),
      ...initial,
    });
  }
  /* و٦ (§٥-٩): الحفظ برقم مرجعي للمسودة كما فُتحت — إن تقدّم السجل (تحديث آخر من نافذة
   * ثانية أو نسخة تكلفة جديدة) رُفض الحفظ بدل الطمس الصامت. */
  async save(
    input: DraftInput & Pick<OrderDraft, "id" | "createdAt">,
    expectedUpdatedAt?: string,
  ): Promise<DraftSaveResult> {
    if (!Number.isInteger(input.quantity) || input.quantity < 1)
      return validationFailure("الكمية يجب أن تكون قطعة واحدة أو أكثر.");
    /* S09 (UNIT-007/029 — أمر ad133bae القسم ٢): تحقق حقول المسودة الجديدة
     * قبل أي كتابة — المجموعات والمرجع الموسوم والسعر المقترح؛ الغياب/null
     * = السلوك القائم (متوافق رجعيًا). */
    const offeringCheck = validateOfferingRef(input.offeringRef);
    if (offeringCheck) return validationFailure(offeringCheck);
    const suggestedCheck = validateSuggestedPrice(input.suggestedPriceMinor);
    if (suggestedCheck) return validationFailure(suggestedCheck);
    const groupsResult = normalizeGroups(input.groups);
    if (typeof groupsResult === "string") return validationFailure(groupsResult);
    if (expectedUpdatedAt !== undefined) {
      const current = await this.store.getDraft(input.id);
      if (!current.ok) return storageFailure("تعذر قراءة المسودة قبل الحفظ. أعد المحاولة.");
      if (current.value && current.value.updatedAt !== expectedUpdatedAt)
        return {
          ok: false,
          code: CONFLICT,
          message: "هذه المسودة عُدّلت من نافذة أخرى بعد فتحك لها؛ لم يُحفظ تعديلك.",
        };
    }
    const draft: OrderDraft = {
      ...input,
      customerName: input.customerName.trim(),
      orderName: input.orderName?.trim() || null,
      itemName: input.itemName.trim(),
      specifications: input.specifications.trim(),
      groups: groupsResult,
      updatedAt: this.now(),
    };
    const saved = await this.store.saveDraft(draft);
    return saved.ok
      ? { ok: true, draft: saved.value }
      : storageFailure("تعذر حفظ المسودة على هذا الجهاز. بقيت بيانات النموذج أمامك؛ أعد المحاولة.");
  }

  /** القرار ٢١ (بناء لا توصيل): تُحذف بسهولة وبلا سبب — لكن غير المرتبطة فقط. */
  async delete(id: string): Promise<DraftDeleteResult> {
    const current = await this.store.getDraft(id);
    if (!current.ok) return storageFailure("تعذر قراءة المسودة قبل الحذف. لم يُحذف شيء.");
    if (!current.value) return notFoundFailure("لم نجد هذه المسودة محليًا؛ لم يُحذف شيء.");
    if (current.value.linkedOrderId !== null)
      return validationFailure("هذه المسودة أصبحت طلبًا محفوظًا؛ تُلغى من الطلب ولا تُحذف من هنا.");
    const deleted = await this.store.deleteDraft(id);
    return deleted.ok ? { ok: true, id } : storageFailure("تعذر حذف المسودة على هذا الجهاز. أعد المحاولة.");
  }
}

/* ── S09 (أمر ad133bae القسم ٢): تحقق حقول المسودة الجديدة — دوال نقية صغيرة
 * عند حدود الخدمة؛ لا كاتب ثانٍ ولا سياسة مالية. ── */

function isNonNegativeMoney(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function validateSuggestedPrice(value: number | null | undefined): string | null {
  /* CONS-DEC07: السعر حر — لا حد أدنى ولا نسبة؛ 0 الصريح صحيح، والغياب/null = بلا اقتراح. */
  if (value === null || value === undefined) return null;
  if (!isNonNegativeMoney(value))
    return "السعر المقترح يجب أن يكون مبلغًا صحيحًا غير سالب بالقروش، أو اتركه فارغًا.";
  return null;
}

function validateOfferingRefShape(value: NonNullable<OrderDraft["offeringRef"]>): string | null {
  if (!value.catalogItemId.trim()) return "مرجع العرض المحفوظ ناقص معرّف المنتج؛ أعد اختياره من القائمة.";
  if (value.templateId !== null && !value.templateId.trim())
    return "مرجع القالب في مرجع العرض غير صالح؛ أعد الاختيار.";
  if (value.revision !== null && (!Number.isSafeInteger(value.revision) || value.revision < 1))
    return "رقم مراجعة مرجع العرض غير صالح؛ أعد الاختيار.";
  if (!value.nameSnapshot.trim()) return "مرجع العرض المحفوظ ناقص لقطة الاسم؛ أعد الاختيار.";
  if (!value.takenAt.trim()) return "مرجع العرض المحفوظ ناقص لحظة الأخذ؛ أعد الاختيار.";
  return null;
}

function validateOfferingRef(value: OrderDraft["offeringRef"]): string | null {
  if (value === null || value === undefined) return null;
  return validateOfferingRefShape(value);
}

type NormalizedGroups = NonNullable<OrderDraft["groups"]> | null | string;

function normalizeGroups(groups: OrderDraft["groups"]): NormalizedGroups {
  if (groups === null || groups === undefined) return null;
  if (!Array.isArray(groups)) return "مجموعات المسودة يجب أن تكون قائمة؛ أعد المحاولة.";
  if (groups.length === 0) return null; /* قائمة فارغة = بلا مجموعات (كما كان). */
  const seen = new Set<string>();
  const normalized: DraftGroup[] = [];
  for (const group of groups) {
    if (!group || typeof group !== "object") return "كل مجموعة يجب أن تكون سجلًا صالحًا.";
    const id = group.id?.trim() ?? "";
    const label = group.label?.trim() ?? "";
    if (!id) return "أكمل هوية المجموعة قبل الحفظ.";
    if (seen.has(id)) return "هوية المجموعة مكررة؛ لا مجموعتان بهوية واحدة.";
    seen.add(id);
    if (!label) return "أدخل اسمًا للمجموعة قبل الحفظ.";
    if (label.length > 200) return "اسم المجموعة أطول من اللازم؛ اختصره إلى 200 حرف أو أقل.";
    if (!Number.isSafeInteger(group.repeatQuantity) || group.repeatQuantity < 1)
      return "أدخل تكرار المجموعة رقمًا صحيحًا 1 أو أكثر.";
    if (group.offeringType !== "product" && group.offeringType !== "service")
      return "نوع عرض المجموعة يجب أن يكون منتجًا أو خدمة.";
    const refCheck = validateOfferingRef(group.offeringRef);
    if (refCheck) return refCheck;
    const note = group.note?.trim() ?? null;
    if (note && note.length > 500) return "ملاحظة المجموعة أطول من اللازم؛ اختصرها إلى 500 حرف أو أقل.";
    normalized.push({
      id,
      label,
      repeatQuantity: group.repeatQuantity,
      offeringType: group.offeringType,
      offeringRef: group.offeringRef ?? null,
      note: note && note.length > 0 ? note : null,
    });
  }
  return normalized;
}
