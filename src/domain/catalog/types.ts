export const catalogItemKinds = ["product", "service"] as const;
export type CatalogItemKind = (typeof catalogItemKinds)[number];

export const unitDimensions = ["count", "mass", "volume", "time", "distance", "area"] as const;
export type UnitDimension = (typeof unitDimensions)[number];

export type CatalogItem = {
  id: string;
  kind: CatalogItemKind;
  name: string;
  /** Kept for historical display compatibility. It is not a conversion source. */
  unitLabel: string | null;
  /** Optional organized unit reference; legacy records migrate to null. */
  unitId?: string | null;
  /* P-002 (الخيار أ): اقتراحات اختيارية على المرجع — ليست سعرًا ولا تكلفة فعلية.
   * البيع المباشر يحفظ نسخته المستقلة عند الحفظ؛ تغيير هذه القيم لاحقًا لا يغيّر
   * أي بيع سابق. غياب الحقل (سجلات قديمة) يعني «لا اقتراح مسجّلًا». */
  /** Optional suggested selling price per unit; a proposal, never the actual sale price. */
  defaultPriceMinor?: number | null;
  /** Optional suggested unit cost; a proposal, never the actual cost of a sale. */
  defaultUnitCostMinor?: number | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  createdOperationKey: string;
};

export type CreateCatalogItemInput = Pick<
  CatalogItem,
  "id" | "kind" | "name" | "unitLabel" | "createdAt" | "createdOperationKey"
> & {
  unitId?: string | null;
  defaultPriceMinor?: number | null;
  defaultUnitCostMinor?: number | null;
};

/* P-002: تحديث اقتراحات المرجع (السعر/التكلفة الافتراضية) — لا يمس الاسم ولا التفعيل
 * ولا أي بيع سابق؛ البيع يحتفظ بنسخته التي حفظها وقت البيع. */
export type UpdateCatalogItemDefaultsInput = {
  defaultPriceMinor: number | null;
  defaultUnitCostMinor: number | null;
  updatedAt: string;
};

export type MeasurementUnit = {
  id: string;
  nameAr: string;
  dimension: UnitDimension;
  symbol: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  createdOperationKey: string;
};

export type CreateMeasurementUnitInput = Pick<
  MeasurementUnit,
  "id" | "nameAr" | "dimension" | "symbol" | "createdAt" | "createdOperationKey"
>;

export type DirectConversion = {
  id: string;
  fromUnitId: string;
  toUnitId: string;
  dimension: UnitDimension;
  numerator: number;
  denominator: number;
  note: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  createdOperationKey: string;
};

export type CreateDirectConversionInput = Pick<
  DirectConversion,
  | "id"
  | "fromUnitId"
  | "toUnitId"
  | "dimension"
  | "numerator"
  | "denominator"
  | "note"
  | "createdAt"
  | "createdOperationKey"
>;

export type CatalogTemplateComponent = {
  id: string;
  name: string;
  quantityMilli: number;
  unitId: string;
  note: string | null;
  /* المجموعة ٣ (عقد D5): ربط هوية المادة بالمكوّن — مرجع تخطيط بلا أثر مخزون؛
   * تكلفة المادة تُقترح لحظة الاستخدام ولا تُخزن هنا. غياب الحقل = مكوّن حر. */
  materialId?: string | null;
};

/* المجموعة ٣ (عقد D5): بنود التكلفة الاختيارية على مستوى القالب — مرآة بنية
 * نسخة تكلفة الطلب (وقت/تغليف/توصيل/هدر/هامش حماية) حتى يتطابق القالب مع
 * المسودة بلا ترجمة. كلها اختيارية: غياب extras = قالب ببنود لا يعرفها بعد. */
export type CatalogTemplateExtras = {
  timeMinutes: number | null;
  hourlyRateMinor: number | null;
  packagingMinor: number;
  deliveryMinor: number;
  wasteMinor: number;
  safetyBufferMinor: number;
};

export type CatalogTemplateYield = {
  quantityMilli: number;
  unitId: string;
};

type CatalogTemplateYieldReadiness = "not_configured" | "ready" | "needs_conversion";

export type CatalogTemplate = {
  id: string;
  catalogItemId: string;
  title: string | null;
  note: string | null;
  components: readonly CatalogTemplateComponent[];
  yield: CatalogTemplateYield | null;
  yieldReadiness: CatalogTemplateYieldReadiness;
  /* المجموعة ٣ (عقد D5): بنود اختيارية — عمل/تغليف/توصيل/هدر/هامش. */
  extras?: CatalogTemplateExtras | null;
  revision: number;
  sourceTemplateId: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  createdOperationKey: string;
};

export type CreateCatalogTemplateInput = Pick<
  CatalogTemplate,
  | "id"
  | "catalogItemId"
  | "title"
  | "note"
  | "components"
  | "yield"
  | "yieldReadiness"
  | "revision"
  | "sourceTemplateId"
  | "createdAt"
  | "createdOperationKey"
> & { extras?: CatalogTemplateExtras | null };

export type QuantityConversionResult = { quantityMilli: number; exact: true };
