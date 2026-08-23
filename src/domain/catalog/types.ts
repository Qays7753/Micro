export const catalogItemKinds = ["product", "service"] as const;
export type CatalogItemKind = (typeof catalogItemKinds)[number];

export type CatalogItem = {
  id: string;
  kind: CatalogItemKind;
  name: string;
  unitLabel: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  createdOperationKey: string;
};

export type CreateCatalogItemInput = Pick<CatalogItem, "id" | "kind" | "name" | "unitLabel" | "createdAt" | "createdOperationKey">;
