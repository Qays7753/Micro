/** Style: Micro decision path — stock is an explainable material fact, never an implied profit report. */
import {
  ArrowLeft,
  Boxes,
  CircleMinus,
  PackagePlus,
  Plus,
  RotateCcw,
  Scissors,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import type { InventoryMovement } from "@micro-domain/inventory-material/index.js";
import type { InventoryOverview } from "@/application/inventory/inventoryMaterialService";
import { LocalDateValue, MoneyValue, QuantityValue } from "@/components/presentation/DisplayValue";
const label = (type: InventoryMovement["type"]) =>
  ({
    opening: "رصيد مادة بداية",
    purchase_receipt: "استلام شراء",
    consumption: "استهلاك لطلب",
    waste: "هدر مادة",
    adjustment: "ضبط مادة",
    reversal: "عكس حركة",
  })[type];
type State =
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "ready"; overview: InventoryOverview; movements: readonly InventoryMovement[] };
export default function InventoryMaterials() {
  const [, navigate] = useLocation();
  const { inventory, dataVersion } = usePrototypeServices();
  const [state, setState] = useState<State>({ phase: "loading" });
  useEffect(() => {
    let active = true;
    Promise.all([inventory.overview(), inventory.movements()]).then(([overview, movements]) => {
      if (!active) return;
      if (!overview.ok || !movements.ok) {
        setState({ phase: "error" });
        return;
      }
      setState({ phase: "ready", overview: overview.value, movements: movements.value });
    });
    return () => {
      active = false;
    };
  }, [inventory, dataVersion]);
  if (state.phase === "loading")
    return (
      <div className="micro-route-loading" role="status">
        جارٍ قراءة المواد المحلية…
      </div>
    );
  if (state.phase === "error")
    return (
      <section className="micro-page micro-not-found">
        <h1>تعذر قراءة المواد</h1>
        <p>لم يتغير أي سجل. أعد فتح التطبيق للمحاولة.</p>
        <button
          className="micro-button micro-button-primary"
          type="button"
          onClick={() => navigate("/finance")}
        >
          الوضع المالي
        </button>
      </section>
    );
  return (
    <section className="micro-page micro-finance-page">
      <button className="micro-back-button" type="button" onClick={() => navigate("/finance")}>
        <ArrowLeft aria-hidden="true" /> الوضع المالي
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">مخزون بسيط</span>
        <h1>المواد المتاحة</h1>
        <p>سجّل ما يتوفر فعلًا، ثم اربط الاستهلاك أو الهدر بحدث واضح. شراء المواد لا يصبح تكلفة بيع هنا.</p>
      </div>
      <section className="micro-decision-card">
        <Boxes aria-hidden="true" />
        <div>
          <span>حد الحقيقة · القيم بد.أ</span>
          <strong>المتبقي مادة وقيمة، لا ربح ولا مصروف تلقائي.</strong>
          <p>{state.overview.truth}</p>
        </div>
      </section>
      <div className="micro-cash-actions">
        <button
          className="micro-button micro-button-primary"
          type="button"
          onClick={() => navigate("/inventory/material/new")}
        >
          <Plus aria-hidden="true" /> مادة ورصيد بداية
        </button>
        <button
          className="micro-button micro-button-secondary"
          type="button"
          disabled={!state.overview.materials.length}
          onClick={() => navigate("/inventory/movement/receipt")}
        >
          <PackagePlus aria-hidden="true" /> استلام شراء
        </button>
      </div>
      <div className="micro-cash-actions">
        <button
          className="micro-button micro-button-secondary"
          type="button"
          disabled={!state.overview.materials.length}
          onClick={() => navigate("/inventory/movement/consume")}
        >
          <Scissors aria-hidden="true" /> استهلاك لطلب
        </button>
        <button
          className="micro-button micro-button-secondary"
          type="button"
          disabled={!state.overview.materials.length}
          onClick={() => navigate("/inventory/movement/waste")}
        >
          <CircleMinus aria-hidden="true" /> هدر أو ضبط
        </button>
      </div>
      <section className="micro-supplier-list">
        <div className="micro-finance-event-heading">
          <span className="micro-overline">المتاح الآن</span>
          <h2>
            {state.overview.materials.length ? `${state.overview.materials.length} مواد` : "لم تسجل مادة بعد"}
          </h2>
        </div>
        {state.overview.materials.length ? (
          state.overview.materials.map(material => (
            <article key={material.id}>
              <div>
                <strong>
                  <Boxes aria-hidden="true" /> {material.name}
                </strong>
                <small>
                  {material.unit === "piece"
                    ? "قطعة"
                    : material.unit === "meter"
                      ? "متر"
                      : material.unit === "kilogram"
                        ? "كيلوغرام"
                        : material.unit === "liter"
                          ? "لتر"
                          : "وحدة أخرى"}{" "}
                  · {material.movementCount} حركات محفوظة
                </small>
              </div>
              <div className="micro-supplier-balance">
                <b>
                  <QuantityValue valueMilli={material.quantityMilli} />
                </b>
                <small>
                  <MoneyValue minor={material.valueMinor} className="micro-inline-number" />
                </small>
              </div>
            </article>
          ))
        ) : (
          <p>
            أضف مادة عندما تؤثر كميتها أو تكلفتها في قرار الشراء أو التسعير. لا يفرض Micro مخزونًا على الخدمة.
          </p>
        )}
      </section>
      {state.movements.length ? (
        <section className="micro-supplier-list micro-cash-history">
          <div className="micro-finance-event-heading">
            <span className="micro-overline">أحدث الحركات</span>
            <h2>سجل لا يحذف بصمت</h2>
          </div>
          {state.movements.slice(0, 8).map(movement => (
            <article key={movement.id}>
              <div>
                <strong>{label(movement.type)}</strong>
                <small>
                  <LocalDateValue value={movement.occurredOn} /> · {movement.note}
                  {movement.reason ? ` · السبب: ${movement.reason}` : ""}
                </small>
              </div>
              <div className="micro-supplier-balance">
                <b>
                  <QuantityValue valueMilli={movement.quantityDeltaMilli} className="micro-inline-number" />
                </b>
                <small>
                  <MoneyValue minor={movement.valueDeltaMinor} showPlus className="micro-inline-number" />
                </small>
                {movement.type !== "reversal" ? (
                  <button
                    className="micro-button micro-button-quiet"
                    type="button"
                    onClick={() => navigate(`/inventory/movement/${movement.id}/reverse`)}
                  >
                    <RotateCcw aria-hidden="true" /> عكس
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </section>
      ) : null}
    </section>
  );
}
