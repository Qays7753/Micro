import { catalogItemKinds, type CatalogItem, type CreateCatalogItemInput } from "./types.js";

const required = (value: string, label: string) => {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} مطلوب.`);
  return normalized;
};

export function createCatalogItem(input: CreateCatalogItemInput): CatalogItem {
  if (!catalogItemKinds.includes(input.kind)) throw new Error("نوع المرجع غير مدعوم.");
  const timestamp = required(input.createdAt, "وقت إنشاء المرجع");
  return {
    id: required(input.id, "معرف المرجع"),
    kind: input.kind,
    name: required(input.name, "اسم المرجع"),
    unitLabel: input.unitLabel?.trim() || null,
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdOperationKey: required(input.createdOperationKey, "مفتاح العملية"),
  };
}
