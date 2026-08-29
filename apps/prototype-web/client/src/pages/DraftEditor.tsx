/** Slice 1 draft editor: saves pre-domain details only and never creates price, deposit, cash, or a CraftOrder. */
import { useEffect, useRef, useState } from "react";
import { ArrowRight, BookOpen, Save, Trash2 } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { useUnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import type { OrderDraft } from "@/storage/local/types";
import type { CatalogItem } from "@micro-domain/catalog/index.js";

type EditorState = "loading" | "ready" | "not_found" | "error";
type DraftFormValues = Pick<
  OrderDraft,
  "itemName" | "catalogItemId" | "customerName" | "quantity" | "specifications"
>;

function draftFormValues(draft: OrderDraft): DraftFormValues {
  return {
    itemName: draft.itemName,
    catalogItemId: draft.catalogItemId,
    customerName: draft.customerName,
    quantity: draft.quantity,
    specifications: draft.specifications,
  };
}

function equalDraftValues(left: DraftFormValues | null, right: DraftFormValues | null) {
  return Boolean(
    left &&
    right &&
    left.itemName === right.itemName &&
    left.catalogItemId === right.catalogItemId &&
    left.customerName === right.customerName &&
    left.quantity === right.quantity &&
    left.specifications === right.specifications,
  );
}
export default function DraftEditor() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { drafts, catalog, dataVersion, notifyDataChanged } = usePrototypeServices();
  const [state, setState] = useState<EditorState>("loading");
  const [draft, setDraft] = useState<OrderDraft | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isQuantityValid, setIsQuantityValid] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [catalogItems, setCatalogItems] = useState<readonly CatalogItem[]>([]);
  const initialValuesRef = useRef<DraftFormValues | null>(null);
  useEffect(() => {
    let active = true;
    drafts.get(params.id).then(result => {
      if (!active) return;
      if (!result.ok) {
        setState("error");
        return;
      }
      setDraft(result.value);
      initialValuesRef.current = result.value ? draftFormValues(result.value) : null;
      setState(result.value ? "ready" : "not_found");
    });
    return () => {
      active = false;
    };
  }, [dataVersion, drafts, params.id]);
  useEffect(() => {
    let active = true;
    catalog.list({ includeInactive: true }).then(result => {
      if (active && result.ok) setCatalogItems(result.items);
    });
    return () => {
      active = false;
    };
  }, [catalog, dataVersion]);
  async function save(andContinue: boolean): Promise<boolean> {
    if (!draft) return false;
    if (andContinue && !draft.itemName.trim()) {
      setMessage("وصف القطعة: اكتب وصفًا مختصرًا ثم أعد المحاولة للانتقال للتكلفة.");
      return false;
    }
    if (!isQuantityValid) {
      setMessage("الكمية: استخدم أرقام 0–9 صحيحة ثم أعد الحفظ.");
      return false;
    }
    if (andContinue && !draft.specifications.trim()) {
      setMessage("ملاحظات التخصيص: أضف ما يلزم للاتفاق قبل الانتقال للتكلفة.");
      return false;
    }
    setIsSaving(true);
    setMessage(null);
    const result = await drafts.save(draft);
    setIsSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      return false;
    }
    setDraft(result.draft);
    initialValuesRef.current = draftFormValues(result.draft);
    notifyDataChanged();
    setMessage("تم حفظ المسودة على هذا الجهاز.");
    if (andContinue) navigate(`/orders/draft/${draft.id}/cost`);
    return true;
  }
  const isDirty = Boolean(
    draft && initialValuesRef.current && !equalDraftValues(draftFormValues(draft), initialValuesRef.current),
  );
  const requestNavigation = useUnsavedChangesGuard({ isDirty, onSave: () => save(false) });
  /* القرار ٢١ (R-2): الحد القاطع يُقرأ من الحقل — linkedOrderId !== null ⇒ الزر لا يظهر أصلًا.
   * الحذف بلا سبب وبلا أثر مالي: المسودة ليست طلبًا ولا تحمل مالًا. */
  const canDelete = draft !== null && draft.linkedOrderId === null;
  async function deleteDraft() {
    if (!draft) return;
    setIsDeleting(true);
    const result = await drafts.delete(draft.id);
    setIsDeleting(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    notifyDataChanged();
    navigate("/orders", { replace: true });
  }
  if (state === "loading")
    return (
      <div className="micro-route-loading" role="status">
        جارٍ فتح المسودة…
      </div>
    );
  if (state === "not_found")
    return (
      <section className="micro-page micro-not-found">
        <h1>لم نجد هذه المسودة</h1>
        <p>قد تكون حذفت محليًا أو لم تُحفظ بعد.</p>
        <button
          className="micro-button micro-button-primary"
          type="button"
          onClick={() => navigate("/orders")}
        >
          العودة للطلبات
        </button>
      </section>
    );
  if (state === "error" || !draft)
    return (
      <section className="micro-page micro-not-found">
        <h1>تعذر فتح المسودة</h1>
        <p>لم يتم تغيير بياناتك. أعد المحاولة من قائمة الطلبات.</p>
        <button
          className="micro-button micro-button-primary"
          type="button"
          onClick={() => navigate("/orders")}
        >
          العودة للطلبات
        </button>
      </section>
    );
  if (draft.linkedOrderId)
    return (
      <section className="micro-page micro-not-found">
        <span className="micro-overline">اتفاق محفوظ</span>
        <h1>هذه المسودة أصبحت طلبًا محليًا</h1>
        <p>لا نعدل تفاصيلها من هنا حتى لا يختلف الوصف عن الاتفاق وسجل التكلفة.</p>
        <button
          className="micro-button micro-button-primary"
          type="button"
          onClick={() => navigate(`/orders/${draft.linkedOrderId}`)}
        >
          فتح الطلب
        </button>
      </section>
    );
  const isCustomerOrder = draft.intent === "customer_order";
  const hasFormError = Boolean(message && !message.startsWith("تم "));
  return (
    <section className="micro-page">
      <button className="micro-back-button" type="button" onClick={() => requestNavigation(`/orders`)}>
        <ArrowRight aria-hidden="true" /> العودة للطلبات
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">مسودة محلية</span>
        <h1>{isCustomerOrder ? "طلب من عميل" : "تصميم مخطط"}</h1>
        <p>نسجل القصة والكمية الآن. التكلفة والاتفاق يأتيان بعد ذلك.</p>
      </div>
      <section className="micro-form-card">
        <label className="micro-field">
          <span>
            وصف القطعة <small>مطلوب قبل الانتقال للتكلفة</small>
          </span>
          <input
            value={draft.itemName}
            onChange={event => setDraft({ ...draft, itemName: event.target.value })}
            placeholder="مثال: صندوق خشبي مخصص"
            aria-invalid={hasFormError && !draft.itemName.trim()}
            aria-describedby={hasFormError ? "draft-form-error" : undefined}
          />
        </label>
        <label className="micro-field">
          <span>
            مرجع العمل <small>اختياري للأعمال المتكررة فقط</small>
          </span>
          <select
            value={draft.catalogItemId ?? ""}
            onChange={event => setDraft({ ...draft, catalogItemId: event.target.value || null })}
          >
            <option value="">لا أربط هذه المسودة بمرجع الآن</option>
            {catalogItems
              .filter(item => item.active || item.id === draft.catalogItemId)
              .map(item => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.kind === "product" ? "منتج" : "خدمة"}
                  {item.active ? "" : " (موقوف)"}
                </option>
              ))}
          </select>
          <small>لا يغيّر المرجع السعر أو نسخة التكلفة أو تكلفة طلب سابق.</small>
        </label>
        <button
          className="micro-button micro-button-secondary"
          type="button"
          onClick={() => navigate("/catalog")}
        >
          <BookOpen aria-hidden="true" /> منتجاتي وخدماتي
        </button>
        {isCustomerOrder ? (
          <label className="micro-field">
            <span>
              اسم العميل <small>اختياري في المسودة</small>
            </span>
            <input
              value={draft.customerName}
              onChange={event => setDraft({ ...draft, customerName: event.target.value })}
              placeholder="مثال: سارة"
            />
          </label>
        ) : null}
        <label className="micro-field">
          <span>
            الكمية <small>أرقام 0–9</small>
          </span>
          <EnglishNumberInput
            value={draft.quantity}
            kind="integer"
            min="1"
            aria-label="الكمية بالأرقام 0–9"
            aria-invalid={hasFormError && !isQuantityValid}
            aria-describedby={hasFormError ? "draft-form-error" : undefined}
            onNumericChange={quantity => setDraft({ ...draft, quantity })}
            onTextValidityChange={setIsQuantityValid}
          />
        </label>
        <label className="micro-field">
          <span>
            ملاحظات التخصيص <small>مطلوبة قبل تسجيل الاتفاق</small>
          </span>
          <textarea
            value={draft.specifications}
            onChange={event => setDraft({ ...draft, specifications: event.target.value })}
            placeholder="لون، قياس، اسم أو تفاصيل مهمة…"
            rows={4}
            aria-describedby={hasFormError ? "draft-form-error" : undefined}
          />
        </label>
        {message ? (
          <p
            id="draft-form-error"
            className={message.startsWith("تم ") ? "micro-save-note" : "micro-field-error"}
            role={message.startsWith("تم ") ? "status" : "alert"}
          >
            {message}
          </p>
        ) : null}
        <div className="micro-form-actions">
          <button
            className="micro-button micro-button-secondary"
            type="button"
            disabled={isSaving || !isQuantityValid}
            onClick={() => {
              void save(false);
            }}
          >
            <Save aria-hidden="true" /> حفظ مسودة
          </button>
          <button
            className="micro-button micro-button-primary"
            type="button"
            disabled={isSaving || !isQuantityValid || !draft.itemName.trim()}
            onClick={() => {
              void save(true);
            }}
          >
            {isSaving ? "جارٍ الحفظ…" : "احسب التكلفة"}
          </button>
        </div>
        {canDelete ? (
          <div className="micro-draft-delete-zone">
            {confirmDelete ? (
              <>
                <p>
                  حذف المسودة يزيلها من هذا الجهاز نهائيًا — بلا سبب ولا أثر مالي، لأنها لم تصبح طلبًا.
                  لا يمكن التراجع بعد الحذف.
                </p>
                <div className="micro-form-actions">
                  <button
                    className="micro-button micro-button-secondary"
                    type="button"
                    disabled={isDeleting}
                    onClick={() => {
                      void deleteDraft();
                    }}
                  >
                    <Trash2 aria-hidden="true" /> {isDeleting ? "جارٍ الحذف…" : "احذف المسودة نهائيًا"}
                  </button>
                  <button
                    className="micro-button micro-button-quiet"
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                  >
                    تراجع
                  </button>
                </div>
              </>
            ) : (
              <button
                className="micro-button micro-button-quiet"
                type="button"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 aria-hidden="true" /> احذف المسودة
              </button>
            )}
          </div>
        ) : null}
      </section>
    </section>
  );
}
