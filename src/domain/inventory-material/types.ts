export const materialUnits = ["piece", "meter", "kilogram", "liter", "other"] as const;
export type MaterialUnit = (typeof materialUnits)[number];
/* المجموعة ٢ (عقد ٢٨): قرار متابعة الكمية لكل مادة على حدة — غياب الحقل يعني
 * «متتبَّعة» للإرث القائم (سلوك محفوظ، لا تعبئة افتراضية ولا اختراع حالة). */
export type MaterialTrackingStatus = "tracked" | "untracked";
export type MaterialTrackingState = {
  status: MaterialTrackingStatus;
  /** تاريخ آخر قرار (YYYY-MM-DD) — أو null إن لم يُذكر. */
  decidedOn: string | null;
  /** سبب إيقاف المتابعة — إلزامي المعنى لكن يُقبل null (القرار نفسه هو المسجل). */
  reason: string | null;
};
/* المجموعة ٢ (عقد ٢٨): معرفة رصيد البداية — «غير محدد بعد» لا تصير صفرًا أبدًا،
 * و«صفر مؤكد» حالة معلنة تختلف عن غياب المعرفة. غياب الحقل = معرفة موروثة (known). */
export type MaterialOpeningKnowledge = {
  quantityState: "unconfirmed" | "confirmed";
  /** null حين quantityState غير مؤكد؛ رقم (بما فيه 0 = صفر مؤكد) حين مؤكد. */
  quantityMilli: number | null;
  costState: "known" | "unknown";
  /** null حين costState غير معروفة — لا يُخترع رقم. */
  valueMinor: number | null;
  confirmedOn: string | null;
  sourceNote: string | null;
};
export type Material = {
  id: string;
  name: string;
  unit: MaterialUnit;
  createdAt: string;
  createdOperationKey: string;
  tracking?: MaterialTrackingState | null;
  opening?: MaterialOpeningKnowledge | null;
};
type InventoryMovementType =
  "opening" | "purchase_receipt" | "consumption" | "waste" | "adjustment" | "reversal";
/* المجموعة ٢ (عقد ٢٨): معرفة تكلفة الحركة — «غير معروفة» تعني قيمة صفرية معلنة
 * الالتباس (0 لا تعني مجانًا). غياب الحقل = «known» (إرث متوافق). */
export type MovementCostKnowledge = "known" | "unknown";
export type WasteContext =
  | { kind: "order"; orderId: string }
  | { kind: "catalog_item"; catalogItemId: string }
  | { kind: "catalog_template"; catalogItemId: string; templateId: string }
  | { kind: "general_project" }
  | { kind: "unallocated"; allocationNote: string | null };
export type InventoryMovement = {
  id: string;
  materialId: string;
  type: InventoryMovementType;
  occurredOn: string;
  recordedAt: string;
  quantityDeltaMilli: number;
  valueDeltaMinor: number;
  note: string;
  reason: string | null;
  operationKey: string;
  purchaseId: string | null;
  orderId: string | null;
  reversesMovementId: string | null;
  wasteContext: WasteContext | null;
  costKnowledge?: MovementCostKnowledge | null;
};
export type CreateMaterialInput = {
  id: string;
  name: string;
  unit: MaterialUnit;
  createdAt: string;
  createdOperationKey: string;
  tracking?: MaterialTrackingState | null;
  opening?: MaterialOpeningKnowledge | null;
};
export type CreateInventoryMovementInput = Omit<
  InventoryMovement,
  "reason" | "purchaseId" | "orderId" | "reversesMovementId" | "wasteContext" | "costKnowledge"
> & {
  reason?: string | null;
  purchaseId?: string | null;
  orderId?: string | null;
  reversesMovementId?: string | null;
  wasteContext?: WasteContext | null;
  costKnowledge?: MovementCostKnowledge | null;
};
/* المجموعة ٢ (عقد ٢٨ / القرار D-027): سجل النقص — تعيين صريح موثّق بدل رصيد سالب.
 * الكمية الناقصة رقم موجب معلن، والسجل يبقى مفتوحًا حتى حلّ صريح من المالك. */
export type InventoryShortage = {
  id: string;
  materialId: string;
  /** الكمية المطلوبة عند المحاولة — موجبة. */
  requestedQuantityMilli: number;
  /** المتاح المعروف لحظة التسجيل — غير سالب. */
  availableQuantityMilli: number;
  /** النقص = requested − available — موجب. */
  shortageQuantityMilli: number;
  occurredOn: string;
  recordedAt: string;
  /** بيان إلزامي — النقص بلا بيان لا يُسجَّل. */
  note: string;
  /** مرجع طلب مستقبلي اختياري — لا يُخترع طلب. */
  orderId: string | null;
  operationKey: string;
  status: "open" | "resolved";
  resolvedOn: string | null;
  resolutionNote: string | null;
};
export type CreateInventoryShortageInput = Omit<
  InventoryShortage,
  "status" | "resolvedOn" | "resolutionNote"
>;
export type ResolveInventoryShortageInput = {
  resolvedOn: string;
  resolutionNote: string;
};
export type MaterialInventoryPosition = {
  materialId: string;
  quantityMilli: number;
  valueMinor: number;
  movementCount: number;
};
