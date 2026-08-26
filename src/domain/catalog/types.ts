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
  active: boolean;
  createdAt: string;
  updatedAt: string;
  createdOperationKey: string;
};

export type CreateCatalogItemInput = Pick<CatalogItem, "id" | "kind" | "name" | "unitLabel" | "createdAt" | "createdOperationKey"> & { unitId?: string | null };

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

export type CreateMeasurementUnitInput = Pick<MeasurementUnit, "id" | "nameAr" | "dimension" | "symbol" | "createdAt" | "createdOperationKey">;

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

export type CreateDirectConversionInput = Pick<DirectConversion, "id" | "fromUnitId" | "toUnitId" | "dimension" | "numerator" | "denominator" | "note" | "createdAt" | "createdOperationKey">;

export type CatalogTemplateComponent = {
  id: string;
  name: string;
  quantityMilli: number;
  unitId: string;
  note: string | null;
};

export type CatalogTemplateYield = {
  quantityMilli: number;
  unitId: string;
};

export type CatalogTemplateYieldReadiness = "not_configured" | "ready" | "needs_conversion";

export type CatalogTemplate = {
  id: string;
  catalogItemId: string;
  title: string | null;
  note: string | null;
  components: readonly CatalogTemplateComponent[];
  yield: CatalogTemplateYield | null;
  yieldReadiness: CatalogTemplateYieldReadiness;
  revision: number;
  sourceTemplateId: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  createdOperationKey: string;
};

export type CreateCatalogTemplateInput = Pick<CatalogTemplate, "id" | "catalogItemId" | "title" | "note" | "components" | "yield" | "yieldReadiness" | "revision" | "sourceTemplateId" | "createdAt" | "createdOperationKey">;

export type QuantityConversionResult = { quantityMilli: number; exact: true };
