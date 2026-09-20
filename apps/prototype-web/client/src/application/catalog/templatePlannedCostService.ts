/**
 * Stage 2 — OPS-004 (tracker): قراءة التكلفة والكمية المخططتين لقالب الكتالوج
 * — قراءة وتقدير فقط، بلا أي كتابة: لا حركة مخزون ولا COGS ولا استهلاك ولا
 * Writer ولا بيانات محفوظة جديدة (المخطط/التصدير 35/27 كما هو).
 *
 * مصدر واحد لكل رقم:
 * • الكمية المخططة: مجموع كميات مكوّنات القالب نفسها (+ الناتج كمّا كما سُجّل).
 * • سعر الوحدة للمكوّن المرتبط بمادة: الدليل الكنوني الواحد لمقترحات المواد
 *   (materialSuggestionsFrom — آخر استلام غير معكوس بمعيّنه الدقيق)؛ بلا
 *   استلام = «غير متاح» لا صفر.
 * • الرياضيات: معيّنات الحدّ المشتركة نفسها التي يحكمها calculateCostSnapshot
 *   (roundHalfUp من النطاق المشترك: البند roundHalfUp(كميةملي×سعر،1000)
 *   والوقت roundHalfUp(دقائق×أجر،60)) — نفس سياسة التقريب الكنونية بلا
 *   مسار حساب ثانٍ ولا مرور بأعداد فاصلة عائمة.
 * قاعدة الوحدة الصادقة: لا يُطبَّق سعر المادة على كمية مكوّن إلا إذا كانت
 * وحدة المكوّن المسجلة هي وحدة المادة نفسها (تطابق اسم الوحدة الكنوني)؛
 * وإلا يُعلن «وحدتان مختلفتان» ولا يُخمّن تحويل ولا يُقرّب.
 */
import type { PrototypeLocalStore } from "@/storage/local/types";
import {
  materialSuggestionsFrom,
  type MaterialSuggestion,
} from "@/application/inventory/materialSuggestions";
import type { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import type { CatalogTemplate, MeasurementUnit } from "@micro-domain/catalog/index.js";
import { roundHalfUp } from "@micro-domain/shared/index.js";

export type TemplateComponentPriceState = "priced" | "free_component" | "no_linked_price" | "unit_mismatch";

export type TemplateComponentPlannedCost = {
  componentId: string;
  name: string;
  quantityMilli: number;
  unitNameAr: string | null;
  linkedMaterialName: string | null;
  /** سعر الوحدة من الدليل الكنوني (آخر استلام) أو null = غير متاح. */
  unitPriceMinor: number | null;
  /** تقدير تكلفة المكوّن أو null عند نقص السعر/تعذر وحدة مطابقة. */
  componentMinor: number | null;
  state: TemplateComponentPriceState;
};

export type TemplatePlannedCostKnowledge = "estimated" | "incomplete" | "unavailable";

export type TemplatePlannedCost = {
  templateId: string;
  templateTitle: string | null;
  /** الكمية المخططة: مجموع كميات المكوّنات كما سُجّلت (قراءة لا تحويل). */
  plannedQuantityMilli: number;
  componentCount: number;
  yieldQuantityMilli: number | null;
  yieldReadiness: CatalogTemplate["yieldReadiness"];
  components: readonly TemplateComponentPlannedCost[];
  pricedComponentCount: number;
  unpricedComponentCount: number;
  /** تقدير المواد للمكوّنات المُسعّرة وحدها (عرض جزئي صادق) أو null. */
  materialMinor: number | null;
  /** تقدير وقت العمل أو null عند غياب أحد الطرفين (لا صفر). */
  timeMinor: number | null;
  timeMinutes: number | null;
  hourlyRateMinor: number | null;
  packagingMinor: number | null;
  deliveryMinor: number | null;
  wasteMinor: number | null;
  safetyBufferMinor: number | null;
  /** التقدير الكامل حين تكتمل المعرفة؛ وإلا null — لا مجموع مضلل. */
  plannedCostMinor: number | null;
  knowledge: TemplatePlannedCostKnowledge;
};

export type TemplatePlannedCostResult<T> =
  { ok: true; value: T } | { ok: false; code: "storage_error" | "not_found"; message: string };

export class TemplatePlannedCostService {
  constructor(
    private readonly store: PrototypeLocalStore,
    private readonly inventory: Pick<InventoryMaterialService, "overview" | "movements">,
  ) {}

  /** تقديرات كل القوالب — قراءة واحدة للمصادر المشتركة؛ لا كتابة أبدًا. */
  async readAll(): Promise<TemplatePlannedCostResult<readonly TemplatePlannedCost[]>> {
    const [templatesResult, unitsResult, overviewResult, movementsResult] = await Promise.all([
      this.store.listCatalogTemplates(),
      this.store.listMeasurementUnits(),
      this.inventory.overview(),
      this.inventory.movements(),
    ]);
    if (!templatesResult.ok || !unitsResult.ok || !overviewResult.ok || !movementsResult.ok)
      return { ok: false, code: "storage_error", message: "تعذر قراءة القوالب والوحدات والمخزون." };
    const suggestions = materialSuggestionsFrom(overviewResult.value, movementsResult.value);
    const unitsById = new Map<string, MeasurementUnit>(unitsResult.value.map(unit => [unit.id, unit]));
    return {
      ok: true,
      value: templatesResult.value.map(template =>
        plannedCostOf(template, suggestions, overviewResult.value.materials, unitsById),
      ),
    };
  }

  async readForTemplate(templateId: string): Promise<TemplatePlannedCostResult<TemplatePlannedCost>> {
    const all = await this.readAll();
    if (!all.ok) return all;
    const found = all.value.find(entry => entry.templateId === templateId);
    if (!found) return { ok: false, code: "not_found", message: "القالب غير موجود محليًا." };
    return { ok: true, value: found };
  }
}

function plannedCostOf(
  template: CatalogTemplate,
  suggestions: readonly MaterialSuggestion[],
  materials: readonly { id: string; name: string; unit: string }[],
  unitsById: Map<string, MeasurementUnit>,
): TemplatePlannedCost {
  const components: TemplateComponentPlannedCost[] = template.components.map(component => {
    const unit = unitsById.get(component.unitId) ?? null;
    const unitNameAr = unit?.nameAr ?? null;
    const material = component.materialId
      ? (materials.find(candidate => candidate.id === component.materialId) ?? null)
      : null;
    const suggestion = component.materialId
      ? (suggestions.find(candidate => candidate.materialId === component.materialId) ?? null)
      : null;
    let state: TemplateComponentPriceState = "free_component";
    let unitPriceMinor: number | null = null;
    let componentMinor: number | null = null;
    if (component.materialId && !material) {
      state = "no_linked_price";
    } else if (component.materialId && !suggestion) {
      state = "no_linked_price";
    } else if (suggestion) {
      if (suggestion.unitPriceMinor === null) {
        state = "no_linked_price";
      } else if (unitNameAr === null || unitNameAr !== suggestion.unit) {
        /* وحدة المكوّن غير وحدة المادة — لا يُخمّن تحويل ولا يُقرّب. */
        state = "unit_mismatch";
      } else {
        state = "priced";
        unitPriceMinor = suggestion.unitPriceMinor;
        componentMinor = roundHalfUp(component.quantityMilli * suggestion.unitPriceMinor, 1000);
      }
    }
    return {
      componentId: component.id,
      name: component.name,
      quantityMilli: component.quantityMilli,
      unitNameAr,
      linkedMaterialName: material?.name ?? null,
      unitPriceMinor,
      componentMinor,
      state,
    };
  });

  const priced = components.filter(component => component.state === "priced");
  const unpriced = components.length - priced.length;
  const materialMinor = priced.length
    ? priced.reduce((total, component) => total + (component.componentMinor ?? 0), 0)
    : null;
  const extras = template.extras ?? null;
  const timeMinor =
    extras && extras.timeMinutes !== null && extras.hourlyRateMinor !== null
      ? roundHalfUp(extras.timeMinutes * extras.hourlyRateMinor, 60)
      : null;
  const hasExtras = extras !== null;
  const everythingKnown = unpriced === 0 && timeMinor !== null && hasExtras;
  let plannedCostMinor: number | null = null;
  let knowledge: TemplatePlannedCostKnowledge;
  if (!priced.length && timeMinor === null && !hasExtras) {
    knowledge = "unavailable";
  } else if (!everythingKnown) {
    knowledge = "incomplete";
  } else {
    knowledge = "estimated";
    plannedCostMinor =
      (materialMinor ?? 0) +
      (timeMinor ?? 0) +
      (extras?.packagingMinor ?? 0) +
      (extras?.deliveryMinor ?? 0) +
      (extras?.wasteMinor ?? 0);
  }

  return {
    templateId: template.id,
    templateTitle: template.title,
    plannedQuantityMilli: template.components.reduce(
      (total, component) => total + component.quantityMilli,
      0,
    ),
    componentCount: template.components.length,
    yieldQuantityMilli: template.yield?.quantityMilli ?? null,
    yieldReadiness: template.yieldReadiness,
    components,
    pricedComponentCount: priced.length,
    unpricedComponentCount: unpriced,
    materialMinor,
    timeMinor,
    timeMinutes: extras?.timeMinutes ?? null,
    hourlyRateMinor: extras?.hourlyRateMinor ?? null,
    packagingMinor: extras?.packagingMinor ?? null,
    deliveryMinor: extras?.deliveryMinor ?? null,
    wasteMinor: extras?.wasteMinor ?? null,
    safetyBufferMinor: extras?.safetyBufferMinor ?? null,
    plannedCostMinor,
    knowledge,
  };
}
