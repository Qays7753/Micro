import {
  catalogItemKinds,
  unitDimensions,
  type CatalogItem,
  type CatalogTemplate,
  type CatalogTemplateComponent,
  type CatalogTemplateYield,
  type CreateCatalogItemInput,
  type CreateCatalogTemplateInput,
  type CreateDirectConversionInput,
  type CreateMeasurementUnitInput,
  type DirectConversion,
  type MeasurementUnit,
  type QuantityConversionResult,
} from "./types.js";

const required = (value: string, label: string) => {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} مطلوب.`);
  return normalized;
};

const positiveSafeInteger = (value: number, label: string) => {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error(`${label} يجب أن يكون عددًا صحيحًا موجبًا وآمنًا.`);
  return value;
};

const validTimestamp = (value: string, label: string) => {
  const normalized = required(value, label);
  if (Number.isNaN(Date.parse(normalized))) throw new Error(`${label} غير صالح.`);
  return normalized;
};

export function createCatalogItem(input: CreateCatalogItemInput): CatalogItem {
  if (!catalogItemKinds.includes(input.kind)) throw new Error("نوع المرجع غير مدعوم.");
  const timestamp = validTimestamp(input.createdAt, "وقت إنشاء المرجع");
  return {
    id: required(input.id, "معرف المرجع"),
    kind: input.kind,
    name: required(input.name, "اسم المرجع"),
    unitLabel: input.unitLabel?.trim() || null,
    unitId: input.unitId?.trim() || null,
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdOperationKey: required(input.createdOperationKey, "مفتاح العملية"),
  };
}

export function createMeasurementUnit(input: CreateMeasurementUnitInput): MeasurementUnit {
  if (!unitDimensions.includes(input.dimension)) throw new Error("بُعد الوحدة غير مدعوم.");
  const timestamp = validTimestamp(input.createdAt, "وقت إنشاء الوحدة");
  return {
    id: required(input.id, "معرف الوحدة"),
    nameAr: required(input.nameAr, "اسم الوحدة"),
    dimension: input.dimension,
    symbol: input.symbol?.trim() || null,
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdOperationKey: required(input.createdOperationKey, "مفتاح عملية الوحدة"),
  };
}

export function assertSameDimension(from: MeasurementUnit, to: MeasurementUnit): void {
  if (from.dimension !== to.dimension)
    throw new Error("لا يمكن التحويل بين بُعدين مختلفين؛ أضف وحدتين من البعد نفسه أو سجّل تحويلًا صريحًا.");
}

export function createDirectConversion(input: CreateDirectConversionInput): DirectConversion {
  if (!unitDimensions.includes(input.dimension)) throw new Error("بُعد التحويل غير مدعوم.");
  const timestamp = validTimestamp(input.createdAt, "وقت إنشاء التحويل");
  const numerator = positiveSafeInteger(input.numerator, "بسط عامل التحويل");
  const denominator = positiveSafeInteger(input.denominator, "مقام عامل التحويل");
  if (input.fromUnitId.trim() === input.toUnitId.trim()) throw new Error("اختر وحدتين مختلفتين للتحويل.");
  return {
    id: required(input.id, "معرف التحويل"),
    fromUnitId: required(input.fromUnitId, "وحدة المصدر"),
    toUnitId: required(input.toUnitId, "وحدة الوجهة"),
    dimension: input.dimension,
    numerator,
    denominator,
    note: required(input.note, "ملاحظة التحويل"),
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdOperationKey: required(input.createdOperationKey, "مفتاح عملية التحويل"),
  };
}

export function convertQuantityMilli(
  quantityMilli: number,
  conversion: DirectConversion,
): QuantityConversionResult {
  positiveSafeInteger(quantityMilli, "الكمية");
  const scaledNumerator = quantityMilli * conversion.numerator;
  if (!Number.isSafeInteger(scaledNumerator)) throw new Error("ناتج التحويل أكبر من الرقم الآمن.");
  if (scaledNumerator % conversion.denominator !== 0)
    throw new Error("لا يمكن تمثيل ناتج التحويل بدقة؛ صحح العامل بدل التقريب الخفي.");
  const result = scaledNumerator / conversion.denominator;
  positiveSafeInteger(result, "ناتج التحويل");
  return { quantityMilli: result, exact: true };
}

function validateComponent(component: CatalogTemplateComponent): CatalogTemplateComponent {
  return {
    id: required(component.id, "معرف المكوّن"),
    name: required(component.name, "اسم المكوّن"),
    quantityMilli: positiveSafeInteger(component.quantityMilli, "كمية المكوّن"),
    unitId: required(component.unitId, "وحدة المكوّن"),
    note: component.note?.trim() || null,
  };
}

function validateYield(value: CatalogTemplateYield | null): CatalogTemplateYield | null {
  if (value === null) return null;
  return {
    quantityMilli: positiveSafeInteger(value.quantityMilli, "كمية الناتج"),
    unitId: required(value.unitId, "وحدة الناتج"),
  };
}

export function createCatalogTemplate(input: CreateCatalogTemplateInput): CatalogTemplate {
  const timestamp = validTimestamp(input.createdAt, "وقت إنشاء القالب");
  if (!Number.isSafeInteger(input.revision) || input.revision < 1)
    throw new Error("رقم نسخة القالب غير صالح.");
  const components = input.components.map(validateComponent);
  const yieldValue = validateYield(input.yield);
  const yieldReadiness = yieldValue === null ? "not_configured" : input.yieldReadiness;
  if (yieldValue !== null && yieldReadiness !== "ready" && yieldReadiness !== "needs_conversion")
    throw new Error("حالة ناتج القالب غير صالحة.");
  return {
    id: required(input.id, "معرف القالب"),
    catalogItemId: required(input.catalogItemId, "مرجع القالب"),
    title: input.title?.trim() || null,
    note: input.note?.trim() || null,
    components,
    yield: yieldValue,
    yieldReadiness,
    revision: input.revision,
    sourceTemplateId: input.sourceTemplateId?.trim() || null,
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdOperationKey: required(input.createdOperationKey, "مفتاح عملية القالب"),
  };
}
