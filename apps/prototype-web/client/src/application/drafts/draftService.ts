/** Application boundary for pre-domain drafts. A draft is not a CraftOrder and has no price, cash, or result effect. */
import type { DraftIntent, OrderDraft, PrototypeLocalStore } from "@/storage/local/types";

export type DraftInput = Pick<
  OrderDraft,
  | "intent"
  | "customerName"
  | "itemName"
  | "catalogItemId"
  | "specifications"
  | "quantity"
  | "costSnapshots"
  | "activeCostSnapshotId"
  | "linkedOrderId"
>;
export type DraftSaveResult =
  | { ok: true; draft: OrderDraft }
  | { ok: false; code: "validation_error" | "storage_error"; message: string };
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
    private readonly store: PrototypeLocalStore,
    private readonly now: () => string = () => new Date().toISOString(),
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
      itemName: "",
      catalogItemId: null,
      specifications: "",
      quantity: 1,
      costSnapshots: [],
      activeCostSnapshotId: null,
      linkedOrderId: null,
      createdAt: this.now(),
      ...initial,
    });
  }
  async save(input: DraftInput & Pick<OrderDraft, "id" | "createdAt">): Promise<DraftSaveResult> {
    if (!Number.isInteger(input.quantity) || input.quantity < 1)
      return { ok: false, code: "validation_error", message: "الكمية يجب أن تكون قطعة واحدة أو أكثر." };
    const draft: OrderDraft = {
      ...input,
      customerName: input.customerName.trim(),
      itemName: input.itemName.trim(),
      specifications: input.specifications.trim(),
      updatedAt: this.now(),
    };
    const saved = await this.store.saveDraft(draft);
    return saved.ok
      ? { ok: true, draft: saved.value }
      : {
          ok: false,
          code: "storage_error",
          message: "تعذر حفظ المسودة على هذا الجهاز. بقيت بيانات النموذج أمامك؛ أعد المحاولة.",
        };
  }

  /** القرار ٢١ (بناء لا توصيل): تُحذف بسهولة وبلا سبب — لكن غير المرتبطة فقط. */
  async delete(id: string): Promise<DraftDeleteResult> {
    const current = await this.store.getDraft(id);
    if (!current.ok)
      return {
        ok: false,
        code: "storage_error",
        message: "تعذر قراءة المسودة قبل الحذف. لم يُحذف شيء.",
      };
    if (!current.value)
      return { ok: false, code: "not_found", message: "لم نجد هذه المسودة محليًا؛ لم يُحذف شيء." };
    if (current.value.linkedOrderId !== null)
      return {
        ok: false,
        code: "validation_error",
        message: "هذه المسودة أصبحت طلبًا محفوظًا؛ تُلغى من الطلب ولا تُحذف من هنا.",
      };
    const deleted = await this.store.deleteDraft(id);
    return deleted.ok
      ? { ok: true, id }
      : {
          ok: false,
          code: "storage_error",
          message: "تعذر حذف المسودة على هذا الجهاز. أعد المحاولة.",
        };
  }
}
