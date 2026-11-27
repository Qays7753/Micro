/**
 * M5.3 (UX P-23 «المنتج (إضافة/تعديل)» + P-24 «تأكيد الأرشفة»): ورقة عمق
 * كاملة — الاسم (إجباري)، الوحدة (اختياري)، سعر البيع للوحدة (C-01،
 * إجباري)، والمكوّنات (صف «المكوّن» + «التكلفة» C-01، الصف الناقص يُشال
 * عند الحفظ) مع «تكلفة الوحدة» تتحدث مع الكتابة (§8.2: مجموع المكوّنات —
 * المسموح الوحيد في الواجهة).
 *
 * R-17: حفظ المنتج تحديث مباشر بلا عملية ولا قيد — ما يغيّر ولا طلب سابق
 * (INV-7). الأرشفة (P-24): بطاقة تأكيد داخل الورقة (نافذة غير معلنة
 * الحوارية — بلا دور حواري)؛ إلغاء الأرشفة فوري.
 */
import { useCallback, useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Button, Notice } from "@/components/primitives";
import { AmountField } from "@/components/manage/AmountField";
import { t } from "@/application/manage/strings";
import { jodInputText, manageErrorText, parseJodInputToFils } from "@/application/manage/presentation";
import {
  archiveManageProduct,
  fetchManageProducts,
  saveManageProduct,
  type ProductItem,
} from "@/application/manage/api";

interface ComponentDraft {
  name: string;
  costText: string;
}

interface ProductDraft {
  productId: string | null;
  name: string;
  unitLabel: string;
  priceText: string;
  components: ComponentDraft[];
  nameError: string | null;
  priceError: string | null;
}

const emptyDraft = (): ProductDraft => ({
  productId: null,
  name: "",
  unitLabel: "",
  priceText: "",
  components: [],
  nameError: null,
  priceError: null,
});

/** §8.2 («تكلفة الوحدة = مجموع المكوّنات» — مسموح في الواجهة): مجموع
 *  أعداد فلس صحيحة آمنة بلا تقريب ولا تحويل. «المكوّن» = صف مكتمل (اسم
 *  وتكلفة صحيحة — ما عداه يُشال عند الحفظ فلا يدخل المجموع الحي كذلك)؛
 *  لا مكوّنات مكتملة ← null («غير معروفة»). */
function componentsCostFils(components: ComponentDraft[]): number | null {
  let total = 0;
  let any = false;
  for (const component of components) {
    const name = component.name.trim();
    const fils = parseJodInputToFils(component.costText);
    if (name.length === 0 || fils === null) continue;
    total += fils;
    any = true;
  }
  return any ? total : null;
}

export default function ProductEditorPage() {
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const isNew = params.id === "new";
  const [draft, setDraft] = useState<ProductDraft | null>(isNew ? emptyDraft() : null);
  const [archived, setArchived] = useState(false);
  const [missing, setMissing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (isNew) return;
    try {
      const listing = await fetchManageProducts();
      const product: ProductItem | undefined = [...listing.active, ...listing.archived].find(
        p => p.productId === params.id,
      );
      if (product === undefined) {
        setMissing(true);
        return;
      }
      setDraft({
        productId: product.productId,
        name: product.name,
        unitLabel: product.unitLabel ?? "",
        priceText: jodInputText(product.unitPriceFils),
        components: product.components.map(c => ({
          name: c.name,
          costText: jodInputText(c.costFils),
        })),
        nameError: null,
        priceError: null,
      });
      setArchived(product.archived);
    } catch {
      setMissing(true);
    }
  }, [isNew, params.id]);
  useEffect(() => {
    void load();
  }, [load]);

  if (missing) {
    return (
      <div className="micro-manage-page">
        <Button action="secondary" onClick={() => navigate("/manage/products")}>
          {t("a.back")}
        </Button>
      </div>
    );
  }
  if (draft === null) {
    return (
      <div className="micro-manage-page" aria-busy="true">
        <span className="micro-manage-page__loading" />
      </div>
    );
  }

  async function onSave() {
    if (draft === null) return;
    setFormError(null);
    if (draft.name.trim().length === 0) {
      setDraft({ ...draft, nameError: t("E-NAME-REQUIRED") });
      return;
    }
    const priceFils = parseJodInputToFils(draft.priceText);
    if (priceFils === null) {
      setDraft({ ...draft, priceError: t("E-UNIT-PRICE-REQUIRED") });
      return;
    }
    setSaving(true);
    try {
      await saveManageProduct({
        productId: draft.productId ?? globalThis.crypto.randomUUID(),
        name: draft.name.trim(),
        ...(draft.unitLabel.trim().length > 0 ? { unitLabel: draft.unitLabel.trim() } : {}),
        unitPriceFils: priceFils,
        /* الصف الناقص (اسم أو تكلفة) يُشال عند الحفظ (عقد P-23). */
        components: draft.components
          .filter(c => c.name.trim().length > 0 && parseJodInputToFils(c.costText) !== null)
          .map(c => ({
            name: c.name.trim(),
            costFils: parseJodInputToFils(c.costText)!,
          })),
      });
      /* بعد الحفظ: رجوع لقائمة منتجاتي — بلا رسالة نجاح (قاعدة عامة). */
      navigate("/manage/products");
    } catch (error) {
      setFormError(manageErrorText(error));
      setSaving(false);
    }
  }

  const draftCost = componentsCostFils(draft.components);

  return (
    <div className="micro-manage-sheet" dir="rtl">
      <h1 className="micro-manage-sheet__title">{t("s.products")}</h1>
      <div className="micro-manage-sheet__body">
        <div className="micro-manage-field">
          <label className="micro-manage-field__label" htmlFor="manage-product-name">
            {t("f.name")}
          </label>
          <input
            id="manage-product-name"
            data-testid="manage-product-name"
            type="text"
            value={draft.name}
            onChange={event => setDraft({ ...draft, name: event.target.value, nameError: null })}
            className="micro-manage-field__input"
          />
          {draft.nameError ? (
            <p className="micro-manage-field__error" role="alert">
              {draft.nameError}
            </p>
          ) : null}
        </div>
        <div className="micro-manage-field">
          <label className="micro-manage-field__label" htmlFor="manage-product-unit">
            {t("f.unit_label")}
          </label>
          <input
            id="manage-product-unit"
            data-testid="manage-product-unit"
            type="text"
            value={draft.unitLabel}
            onChange={event => setDraft({ ...draft, unitLabel: event.target.value })}
            className="micro-manage-field__input"
          />
        </div>
        <AmountField
          label={t("f.unit_price")}
          value={draft.priceText}
          error={draft.priceError ?? undefined}
          testId="manage-product-price"
          onTextChange={text => setDraft({ ...draft, priceText: text, priceError: null })}
        />

        {/* المكوّنات: صفوف «المكوّن» + «التكلفة» مع حذف لكل صف. */}
        <section className="micro-manage-section">
          <h2 className="micro-manage-section__title">{t("f.component_name")}</h2>
          {draft.components.map((component, index) => (
            <div key={index} className="micro-manage-row">
              <input
                type="text"
                value={component.name}
                placeholder={t("f.component_name")}
                aria-label={t("f.component_name")}
                onChange={event => {
                  const components = [...draft.components];
                  components[index] = { ...component, name: event.target.value };
                  setDraft({ ...draft, components });
                }}
                className="micro-manage-field__input"
              />
              <input
                type="text"
                inputMode="decimal"
                dir="ltr"
                value={component.costText}
                placeholder={t("f.component_cost")}
                aria-label={t("f.component_cost")}
                onChange={event => {
                  const components = [...draft.components];
                  components[index] = { ...component, costText: event.target.value };
                  setDraft({ ...draft, components });
                }}
                className="micro-manage-field__input"
              />
              <button
                type="button"
                className="micro-manage-link"
                aria-label={t("a.delete_line")}
                onClick={() =>
                  setDraft({
                    ...draft,
                    components: draft.components.filter((_, i) => i !== index),
                  })
                }
              >
                {t("a.delete_line")}
              </button>
            </div>
          ))}
          <Button
            action="secondary"
            onClick={() =>
              setDraft({ ...draft, components: [...draft.components, { name: "", costText: "" }] })
            }
          >
            {t("a.add_component")}
          </Button>
          {/* «تكلفة الوحدة» تتحدث مع الكتابة (§8.2 — المجموع المسموح). */}
          <p className="micro-manage-card__line micro-manage-card__line--secondary">
            {t("f.unit_cost")}:{" "}
            {draftCost === null ? t("l.unit_cost_unknown") : `${jodInputText(draftCost)} ${t("l.currency")}`}
          </p>
        </section>

        {/* P-24 تأكيد الأرشفة: بطاقة داخل الورقة (نافذة غير معلنة الحوارية). */}
        {confirmArchive && draft.productId !== null ? (
          <section className="micro-manage-card">
            <p className="micro-manage-card__line">{t("d.archive_product")}</p>
            <div className="micro-manage-card__actions">
              <Button action="quiet" onClick={() => setConfirmArchive(false)}>
                {t("a.back")}
              </Button>
              <Button
                action="destructive"
                onClick={() => {
                  void archiveManageProduct(draft.productId!, true).then(() => navigate("/manage/products"));
                }}
              >
                {t("a.confirm")}
              </Button>
            </div>
          </section>
        ) : null}

        {formError ? (
          <Notice tone="error" role="alert">
            {formError}
          </Notice>
        ) : null}
      </div>
      <div className="micro-manage-sheet__save">
        <Button action="quiet" onClick={() => navigate("/manage/products")}>
          {t("a.back")}
        </Button>
        {/* منتج موجود غير مؤرشف ← «أرشفة» (P-24)؛ مؤرشف ← «إلغاء الأرشفة» فوري. */}
        {draft.productId !== null && !archived ? (
          <Button action="secondary" onClick={() => setConfirmArchive(true)}>
            {t("a.archive")}
          </Button>
        ) : null}
        {draft.productId !== null && archived ? (
          <Button
            action="secondary"
            onClick={() => {
              void archiveManageProduct(draft.productId!, false).then(() => navigate("/manage/products"));
            }}
          >
            {t("a.unarchive")}
          </Button>
        ) : null}
        <Button action="save" block loading={saving} onClick={() => void onSave()}>
          {t("a.save")}
        </Button>
      </div>
    </div>
  );
}
