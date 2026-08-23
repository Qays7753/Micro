export const materialUnits = ["piece", "meter", "kilogram", "liter", "other"] as const;
export type MaterialUnit = (typeof materialUnits)[number];
export type Material = { id: string; name: string; unit: MaterialUnit; createdAt: string; createdOperationKey: string };
export type InventoryMovementType = "opening" | "purchase_receipt" | "consumption" | "waste" | "adjustment" | "reversal";
export type InventoryMovement = { id: string; materialId: string; type: InventoryMovementType; occurredOn: string; recordedAt: string; quantityDeltaMilli: number; valueDeltaMinor: number; note: string; reason: string | null; operationKey: string; purchaseId: string | null; orderId: string | null; reversesMovementId: string | null };
export type CreateMaterialInput = { id: string; name: string; unit: MaterialUnit; createdAt: string; createdOperationKey: string };
export type CreateInventoryMovementInput = Omit<InventoryMovement, "reason" | "purchaseId" | "orderId" | "reversesMovementId"> & { reason?: string | null; purchaseId?: string | null; orderId?: string | null; reversesMovementId?: string | null };
export type MaterialInventoryPosition = { materialId: string; quantityMilli: number; valueMinor: number; movementCount: number };
