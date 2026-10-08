/** Application boundary for pre-domain drafts. A draft is not a CraftOrder and has no price, cash, or result effect. */
import type { DraftIntent, OrderDraft, PrototypeLocalStore } from "@/storage/local/types";

/** R3 (بطاقة R3-SC-01/11): عدسة الخدمة — مسودات الطلب الأربع بالضبط (عائلة KEEP R3-SC-17). */
export type DraftServiceStore = Pick<PrototypeLocalStore, "listDrafts" | "getDraft" | "saveDraft" | "deleteDraft">;
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
