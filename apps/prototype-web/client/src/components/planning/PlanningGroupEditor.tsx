/**
 * S10 (UNIT-031 T01 — أمر b56967d8): محرر مجموعات حساب التخطيط — مجموعة
 * منتج/خدمة واحدة بنوعها وتكرارها وطريقة تكلفة واحدة نشطة (تفصيل مكونات
 * الوحدة أو إجمالي الكمية كاملة) وسعر بيع حر للوحدة. التكرار يطبق مرة
 * واحدة على أساس الوحدة، والوضعان لا يجتمعان (U031-AC04/AC09/AC10).
 * عرض صرف بلا سياسة مالية ولا تخزين مباشر.
 */
import { PackageOpen, Trash2 } from "lucide-react";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import type { PlanningPersistGroup } from "@/storage/local/planningCalculationTypes";

export type EditablePlanningComponent = {
  uiId: string;
  name: string;
  quantity: number;
  unit: string;
  unitPriceMinor: number;
  materialId?: string | null;
};

export type EditablePlanningGroup = {
  uiId: string;
  label: string;
  offeringType: "product" | "service";
  repeatQuantity: number;
  costMode: "details" | "total";
  components: EditablePlanningComponent[];
  totalCostMinor: number | null;
  sellingPriceMinor: number | null;
};

export function emptyPlanningComponent(index: number): EditablePlanningComponent {
  return { uiId: `pc-${index}-${Date.now()}`, name: "", quantity: 1, unit: "قطعة", unitPriceMinor: 0 };
}

export function emptyPlanningGroup(index: number): EditablePlanningGroup {
  return {
    uiId: `g-${index}-${Date.now()}`,
    label: "",
    offeringType: "product",
    repeatQuantity: 1,
    costMode: "details",
    components: [emptyPlanningComponent(1)],
    totalCostMinor: null,
    sellingPriceMinor: null,
  };
}

/** تحويل مجموعة قابلة للتحرير إلى بنية التخزين/المجال كما دخلت. */
export function toPersistGroup(group: EditablePlanningGroup): PlanningPersistGroup {
  return {
    groupId: group.uiId,
    label: group.label.trim(),
    offeringType: group.offeringType,
    repeatQuantity: group.repeatQuantity,
    costMode: group.costMode,
    unitComponents: group.components
      .map(component => ({
        name: component.name.trim(),
        quantity: component.quantity,
        unit: component.unit.trim() || "قطعة",
        unitPriceMinor: component.unitPriceMinor,
        confidence: "known" as const,
        ...(component.materialId !== undefined && component.materialId !== null
          ? { materialId: component.materialId }
          : {}),
      }))
      .filter(component => component.name.length > 0),
    totalCostMinor: group.costMode === "total" ? group.totalCostMinor : null,
    sellingPriceMinor: group.sellingPriceMinor,
  };
}

export function PlanningGroupEditor({
  group,
  index,
  onChange,
  onRemove,
}: {
  group: EditablePlanningGroup;
  index: number;
  onChange: (next: EditablePlanningGroup) => void;
  onRemove: () => void;
}) {
  return (
    <div className="micro-planning-group" data-testid={`planning-group-${index + 1}`}>
      <label className="micro-field">
        <span>اسم المنتج أو الخدمة {index + 1}</span>
        <input
          value={group.label}
          onChange={event => onChange({ ...group, label: event.target.value })}
          placeholder="مثال: صندوق هدايا"
        />
      </label>
      <div className="micro-field-grid">
        <label className="micro-field">
          <span>النوع</span>
          <select
            value={group.offeringType}
            onChange={event =>
              onChange({ ...group, offeringType: event.target.value === "service" ? "service" : "product" })
            }
          >
            <option value="product">منتج</option>
            <option value="service">خدمة</option>
          </select>
        </label>
        <label className="micro-field">
          <span>الكمية المكررة</span>
          <EnglishNumberInput
            value={group.repeatQuantity}
            kind="integer"
            onNumericChange={value => onChange({ ...group, repeatQuantity: value })}
            aria-label={`كمية المجموعة ${index + 1}`}
          />
        </label>
        <label className="micro-field">
          <span>سعر بيع الوحدة (د.أ)</span>
          <EnglishNumberInput
            value={group.sellingPriceMinor ?? 0}
            kind="money"
            allowEmpty={group.sellingPriceMinor === null}
            onEmptyChange={() => onChange({ ...group, sellingPriceMinor: null })}
            onNumericChange={value => onChange({ ...group, sellingPriceMinor: value })}
            aria-label={`سعر بيع الوحدة للمجموعة ${index + 1}`}
          />
          <small>السعر حر بلا حد أدنى — اتركه فارغًا إن لم تحدد بعد.</small>
        </label>
      </div>
      <label className="micro-field">
        <span>طريقة التكلفة</span>
        <select
          value={group.costMode}
          onChange={event =>
            onChange({ ...group, costMode: event.target.value === "total" ? "total" : "details" })
          }
        >
          <option value="details">احسبها من مكونات الوحدة</option>
          <option value="total">أعرف التكلفة للكمية كاملة</option>
        </select>
      </label>
      {group.costMode === "total" ? (
        <label className="micro-field">
          <span>تكلفة الكمية الكاملة (د.أ)</span>
          <EnglishNumberInput
            value={group.totalCostMinor ?? 0}
            kind="money"
            allowEmpty={group.totalCostMinor === null}
            onEmptyChange={() => onChange({ ...group, totalCostMinor: null })}
            onNumericChange={value => onChange({ ...group, totalCostMinor: value })}
            aria-label={`تكلفة الكمية الكاملة للمجموعة ${index + 1}`}
          />
          <small>يبقى هذا الإجمالي هو الأصل الدقيق — نصيب الوحدة عرض مشتق لا يعاد ضربه في الكمية.</small>
        </label>
      ) : (
        <>
          <p className="micro-home-quiet">مكونات الوحدة الواحدة:</p>
          {group.components.map((component, componentIndex) => (
            <div className="micro-field-grid" key={component.uiId}>
              <label className="micro-field">
                <span>المكوّن {componentIndex + 1}</span>
                <input
                  value={component.name}
                  onChange={event =>
                    onChange({
                      ...group,
                      components: group.components.map(item =>
                        item.uiId === component.uiId ? { ...item, name: event.target.value } : item,
                      ),
                    })
                  }
                  placeholder="مثال: شوكولاتة"
                />
              </label>
              <label className="micro-field">
                <span>الكمية للوحدة</span>
                <EnglishNumberInput
                  value={component.quantity}
                  kind="decimal"
                  onNumericChange={value =>
                    onChange({
                      ...group,
                      components: group.components.map(item =>
                        item.uiId === component.uiId ? { ...item, quantity: value } : item,
                      ),
                    })
                  }
                  aria-label={`كمية المكوّن ${componentIndex + 1} للمجموعة ${index + 1}`}
                />
              </label>
              <label className="micro-field">
                <span>الوحدة</span>
                <input
                  value={component.unit}
                  onChange={event =>
                    onChange({
                      ...group,
                      components: group.components.map(item =>
                        item.uiId === component.uiId ? { ...item, unit: event.target.value } : item,
                      ),
                    })
                  }
                  placeholder="قطعة / كيلو"
                />
              </label>
              <label className="micro-field">
                <span>سعر الوحدة (د.أ)</span>
                <EnglishNumberInput
                  value={component.unitPriceMinor}
                  kind="money"
                  onNumericChange={value =>
                    onChange({
                      ...group,
                      components: group.components.map(item =>
                        item.uiId === component.uiId ? { ...item, unitPriceMinor: value } : item,
                      ),
                    })
                  }
                  aria-label={`سعر وحدة المكوّن ${componentIndex + 1} للمجموعة ${index + 1}`}
                />
              </label>
              {group.components.length > 1 ? (
                <button
                  className="micro-text-action micro-delete-row"
                  type="button"
                  onClick={() =>
                    onChange({
                      ...group,
                      components: group.components.filter(item => item.uiId !== component.uiId),
                    })
                  }
                >
                  <Trash2 aria-hidden="true" /> احذف المكوّن
                </button>
              ) : null}
            </div>
          ))}
          <button
            className="micro-text-action"
            type="button"
            onClick={() =>
              onChange({
                ...group,
                components: [...group.components, emptyPlanningComponent(group.components.length + 1)],
              })
            }
          >
            <PackageOpen aria-hidden="true" /> أضف مكوّنًا للوحدة
          </button>
        </>
      )}
      <button className="micro-text-action micro-delete-row" type="button" onClick={onRemove}>
        <Trash2 aria-hidden="true" /> احذف المجموعة
      </button>
    </div>
  );
}
