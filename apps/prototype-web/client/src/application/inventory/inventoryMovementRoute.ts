/**
 * مبدأ Micro: نوع حركة المخزون المجهول يفشل بوضوح بدل أن يرث معنى حركة أخرى.
 */
export const supportedInventoryMovementTypes = ["receipt", "consume", "waste", "adjust"] as const;

export type InventoryMovementRouteType = (typeof supportedInventoryMovementTypes)[number];

export function resolveInventoryMovementType(value: string | undefined): InventoryMovementRouteType | null {
  return supportedInventoryMovementTypes.includes(value as InventoryMovementRouteType)
    ? (value as InventoryMovementRouteType)
    : null;
}
