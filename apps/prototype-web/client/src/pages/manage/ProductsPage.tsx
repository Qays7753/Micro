/**
 * M5.3 (UX P-22 «منتجاتي»): المنتجات اللي بتنقترح عند البيع — قائمة
 * النشطة (الاسم · الوحدة · سعر البيع للوحدة · «تكلفة الوحدة» = مجموع
 * المكوّنات أو «غير معروفة» — كلها من الخادم D-5) وقسم مطوي للمؤرشفة
 * بنفس الصفوف مع «مؤرشفة».
 *
 * لا فلوس ولا صناديق هنا (منفصلة تمامًا عن أدواتي)؛ الإضافة من هنا وحده.
 * المحرر P-23 ورقة عمق كاملة بمسارها الخاص؛ كبسة الصف تفتحه معبّأ.
 */
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button, EmptyState } from "@/components/primitives";
import { t } from "@/application/manage/strings";
import { jodInputText } from "@/application/manage/presentation";
import { fetchManageProducts, type ProductItem } from "@/application/manage/api";

export default function ProductsPage() {
  const [, navigate] = useLocation();
  const [active, setActive] = useState<ProductItem[] | null>(null);
  const [archived, setArchived] = useState<ProductItem[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async () => {
    const listing = await fetchManageProducts();
    setActive(listing.active);
    setArchived(listing.archived);
  }, []);
  useEffect(() => {
    load().catch(() => {
      setActive([]);
      setArchived([]);
    });
  }, [load]);

  /** صف واحد: الاسم والوحدة وسعر البيع وتكلفة الوحدة (أو «غير معروفة»). */
  function productRow(product: ProductItem, withArchivedChip: boolean) {
    return (
      <button
        key={product.productId}
        type="button"
        className="micro-manage-row"
        onClick={() => navigate(`/manage/products/${product.productId}`)}
      >
        <span className="micro-manage-row__main">
          <span className="micro-manage-row__title">
            {product.name}
            {withArchivedChip ? ` · ${t("l.archived")}` : ""}
          </span>
          <span className="micro-manage-row__amount">
            {product.unitCostFils === null
              ? t("l.unit_cost_unknown")
              : `${jodInputText(product.unitCostFils)} ${t("l.currency")}`}
          </span>
        </span>
        <span className="micro-manage-row__meta">
          {product.unitLabel ?? ""} · {jodInputText(product.unitPriceFils)} {t("l.currency")}
        </span>
      </button>
    );
  }

  return (
    <div className="micro-manage-page">
      <header className="micro-manage-head">
        <h1 className="micro-manage-head__title">{t("s.products")}</h1>
        <Button action="create" onClick={() => navigate("/manage/products/new")}>
          {t("a.add_product")}
        </Button>
      </header>

      {active === null ? (
        <span className="micro-manage-page__loading" />
      ) : active.length === 0 ? (
        <EmptyState
          title={t("e.empty_products")}
          action={
            <Button action="create" onClick={() => navigate("/manage/products/new")}>
              {t("a.add_product")}
            </Button>
          }
        />
      ) : (
        <div className="micro-manage-rows">{active.map(p => productRow(p, false))}</div>
      )}

      {/* قسم مطوي: المنتجات المؤرشفة (نفس الصفوف مع «مؤرشفة»). */}
      {archived.length > 0 ? (
        <section className="micro-manage-section">
          <button
            type="button"
            className="micro-manage-link"
            aria-expanded={showArchived}
            onClick={() => setShowArchived(open => !open)}
          >
            {t("t.archived_section")}
          </button>
          {showArchived ? (
            <div className="micro-manage-rows">{archived.map(p => productRow(p, true))}</div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
