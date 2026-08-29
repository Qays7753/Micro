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
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import type { InventoryMovement } from "@micro-domain/inventory-material/index.js";
import type {
  InventoryActivationState,
  InventoryOverview,
} from "@/application/inventory/inventoryMaterialService";
import { LocalDateValue, MoneyValue, QuantityValue } from "@/components/presentation/DisplayValue";
import { formatArabicPlural } from "@/presentation/formatters";
import { savedMovementCountLabel } from "@/presentation/plurals";
const label = (type: InventoryMovement["type"]) =>
  ({
    opening: "رصيد مادة بداية",
    purchase_receipt: "استلام شراء",
    consumption: "استهلاك لطلب",
    waste: "هدر مادة",
    adjustment: "ضبط مادة",
    reversal: "تراجع عن حركة",
  })[type];
type State =
  | { phase: "loading" }
  | { phase: "error" }
  | {
      phase: "ready";
      overview: InventoryOverview;
      movements: readonly InventoryMovement[];
      activation: InventoryActivationState;
    };
export default function InventoryMaterials() {
  const [, navigate] = useLocation();
  const { inventory, dataVersion, notifyDataChanged } = usePrototypeServices();
  const [state, setState] = useState<State>({ phase: "loading" });
  const [activating, setActivating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const operationKeyRef = useRef(`inventory-activation-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`);
  useEffect(() => {
    let active = true;
    Promise.all([inventory.overview(), inventory.movements(), inventory.readActivation()]).then(
      ([overview, movements, activation]) => {
        if (!active) return;
        if (!overview.ok || !movements.ok || !activation.ok) {
          setState({ phase: "error" });
          return;
        }
        setState({
          phase: "ready",
          overview: overview.value,
          movements: movements.value,
          activation: activation.value,
        });
      },
    );
    return () => {
      active = false;
    };
  }, [inventory, dataVersion]);
  /* القرار ٩: تفعيل صريح بتاريخ اليوم — لحظة معلنة تُعرض، والرصيد يومها يكفي. */
  async function activateInventory() {
    setActivating(true);
    const result = await inventory.activate({ operationKey: operationKeyRef.current });
    setActivating(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    notifyDataChanged();
    setMessage(`تم تفعيل المخزون بتاريخ ${result.value.activatedOn} — اللحظة معلنة في السجل.`);
  }
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
  const materialCountLabel = formatArabicPlural(state.overview.materials.length, {
    zero: "لم تسجل مادة بعد",
    one: "مادة واحدة",
    two: "مادتان",
    few: "مواد",
    many: "مادة",
    other: "مادة",
  });
  const notActivated = state.activation.activatedOn === null;
  return (
    <section className="micro-page micro-finance-page">
      <button className="micro-back-button" type="button" onClick={() => navigate("/finance")}>
        <ArrowLeft aria-hidden="true" /> مالي
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">مخزون بسيط</span>
        <h1>المواد والمخزون</h1>
        <p>سجّل ما يتوفر فعلًا، ثم اربط الاستهلاك أو الهدر بحدث واضح. شراء المواد لا يصبح تكلفة بيع هنا.</p>
      </div>
      {message ? (
        <p className="micro-save-note" role="status">
          {message}
        </p>
      ) : null}
      {/* القرار ٩ + §٢.٨: قبل التفعيل الموضع غير نشط معلنًا — لا بوابة، والتفعيل بتاريخ اليوم. */}
      {notActivated ? (
        <section className="micro-inventory-inactive" aria-labelledby="inventory-inactive-title">
          <SlidersHorizontal aria-hidden="true" />
          <div>
            <span className="micro-overline">موضع غير نشط</span>
            <h2 id="inventory-inactive-title">المخزون غير مفعّل</h2>
            <p>
              تفعيله يغيّر أرقام التكلفة: من لحظة التفعيل تدخل حركات المواد شبكة المصادر. لقطة رصيد يوم
              التفعيل تكفي — لا يُطلب استيراد تاريخ سابق.
            </p>
          </div>
          <button
            className="micro-button micro-button-primary"
            type="button"
            disabled={activating}
            onClick={() => {
              void activateInventory();
            }}
          >
            {activating ? "جارٍ التفعيل…" : "تفعيل بتاريخ اليوم"}
          </button>
        </section>
      ) : (
        <section className="micro-decision-card">
          <SlidersHorizontal aria-hidden="true" />
          <div>
            <span>حد الحقيقة · القيم (د.أ)</span>
            <strong>
              {state.activation.source === "declared" ? "مُدار بتفعيل صريح منذ " : "مُدار من "}
              <LocalDateValue value={state.activation.activatedOn ?? ""} />
            </strong>
            <p>{state.activation.truth}</p>
          </div>
        </section>
      )}
      {/* مبدأ Micro: أفعال المادة لا تظهر كأنها متاحة قبل وجود مادة مسجلة. */}
      <div className="micro-cash-actions">
        <button
          className="micro-button micro-button-primary"
          type="button"
          onClick={() => navigate("/inventory/material/new")}
        >
          <Plus aria-hidden="true" /> مادة ورصيد بداية
        </button>
        {state.overview.materials.length ? (
          <button
            className="micro-button micro-button-secondary"
            type="button"
            onClick={() => navigate("/inventory/movement/receipt")}
          >
            <PackagePlus aria-hidden="true" /> استلام شراء
          </button>
        ) : (
          <div className="micro-later-action" role="status">
            <strong>استلام شراء — لاحقًا</strong>
            <small>أضف مادة ورصيد بدايتها أولًا.</small>
          </div>
        )}
      </div>
      <div className="micro-cash-actions">
        {state.overview.materials.length ? (
          <>
            <button
              className="micro-button micro-button-secondary"
              type="button"
              onClick={() => navigate("/inventory/movement/consume")}
            >
              <Scissors aria-hidden="true" /> استهلاك لطلب
            </button>
            <button
              className="micro-button micro-button-secondary"
              type="button"
              onClick={() => navigate("/inventory/movement/waste")}
            >
              <CircleMinus aria-hidden="true" /> هدر أو ضبط
            </button>
          </>
        ) : (
          <div className="micro-later-action" role="status">
            <strong>الاستهلاك والهدر — لاحقًا</strong>
            <small>أضف مادة ورصيد بدايتها أولًا حتى تختار سجلًا حقيقيًا.</small>
          </div>
        )}
      </div>
      <section className="micro-supplier-list">
        <div className="micro-finance-event-heading">
          <span className="micro-overline">المتاح الآن</span>
          <h2>{state.overview.materials.length ? materialCountLabel : "لم تسجل مادة بعد"}</h2>
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
                  · {savedMovementCountLabel(material.movementCount)}
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
                    <RotateCcw aria-hidden="true" /> تراجع
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
