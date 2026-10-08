/* Wave F شريحة ٣ (ADR-014 — تقسيم مسؤولية داخلي، 2026-10-04): هذا الصنف هو
 * منسّق مخزون المواد (المجموعة ٢ عقد ٢٨) وواجهته العامة وهيّته لا تتغيران؛
 * صار المُنسّق الذي يحفظ الحقن والساعة ويفوّض مسارات العمل إلى ملفات أشقاء
 * في البيت نفسه application/inventory/، انتقلت كلها حرفيًا بلا أي تغيير صيغة
 * أو تقريب أو تصنيف أو هوية خطأ:
 *   - inventoryMaterialModel — بيت النموذج الورقي: أنواع السطح الثلاثة
 *     والعشرون ومعينات الملف (id/storageFailure/ammanLocalDate).
 *   - inventoryMaterialReads — القراءات المشتقة: النظرة العامة والحركات
 *     ومقارنة مادة الطلب والمراجع وحالة استلام الشراء وهدر الفترة.
 *   - inventoryMaterialActivation — تفعيل المخزون (القرار ٩): قراءة
 *     المعلن/المشتق والتفعيل الصريح المؤرّخ.
 *   - inventoryMaterialLifecycle — دورة حياة سجل المادة: الإنشاء الموجه
 *     وإيقاف/إعادة المتابعة وتأكيد الرصيد.
 *   - inventoryMaterialWrites — مسار كتابة الحركات القياسي المحروس:
 *     الاستلام والاستهلاك والضبط والتراجع المرآتي.
 *   - inventoryMaterialWaste — مسارات خروج الهدر: الهدر بخياره على
 *     النتيجة (عقد ١) وإخراج المتبقي كاملًا (القرار ٢٠).
 *   - inventoryMaterialShortages — مسار النقص الموثق (D-027): السجل
 *     والاستهلاك مع النقص والحل والقراءة.
 * جرد المستهلكين الكامل قبل الحركة: 59 مستوردًا مباشرًا للوحدة (52 منها
 * اختبارات) + 12 عبر الباب العام + استيرادان ديناميكيان — كلهم عبر الصنف
 * أو أنواع السطح فلا يتغير مستورد واحد. */
import { systemClock, type Clock } from "@/application/time/clock";
import type { InventoryActivation, PrototypeLocalStore } from "@/storage/local/types";

/** R3 (بطاقة R3-SC-01/11): عدسة الخدمة — منسّق عائلة المخزون — اتحاد احتياجات الأخوة الست حصرًا. */
export type InventoryMaterialServiceStore = Pick<
  PrototypeLocalStore,
  | "listMaterials"
  | "listInventoryMovements"
  | "getInventoryActivation"
  | "saveInventoryActivation"
  | "getPreferences"
  | "listOrders"
  | "getOrder"
  | "listDirectSales"
  | "listSupplierPurchases"
  | "listCatalogItems"
  | "getCatalogItem"
  | "listCatalogTemplates"
  | "getCatalogTemplate"
  | "listInventoryShortages"
  | "listFinancialEvents"
  | "commitInventory"
  | "commitInventoryWithEvents"
  | "commitInventoryWithShortage"
>;
import type {
  InventoryMovement,
  InventoryShortage,
  Material,
} from "@micro-domain/inventory-material/index.js";
import {
  listMovements,
  overview,
  readOrderActualMaterialComparison,
  readPeriodWaste,
  readPurchaseReceiptStatus,
  readReferences,
} from "./inventoryMaterialReads";
import { activateInventory, readActivation } from "./inventoryMaterialActivation";
import {
  confirmMaterialOpening,
  openMaterial,
  retrackMaterial,
  untrackMaterial,
} from "./inventoryMaterialLifecycle";
import { adjustMaterial, consumeMaterial, receivePurchase, reverseMovement } from "./inventoryMaterialWrites";
import { extractRemainder, wasteMaterial } from "./inventoryMaterialWaste";
import {
  consumeWithShortage,
  listShortages,
  recordShortage,
  resolveShortage,
} from "./inventoryMaterialShortages";
import type {
  AdjustMaterialInput,
  ConfirmOpeningInput,
  ConsumeMaterialInput,
  ExtractRemainderInput,
  InventoryActivationInput,
  InventoryActivationState,
  InventoryOverview,
  InventoryReferences,
  InventoryResult,
  OpenMaterialInput,
  OrderActualMaterialComparison,
  PeriodWasteReading,
  PurchaseReceiptStatus,
  ReceivePurchaseInput,
  RecordShortageInput,
  ResolveShortageInput,
  RetrackMaterialInput,
  ReverseInventoryInput,
  UntrackMaterialInput,
  WasteMaterialInput,
} from "./inventoryMaterialModel";

/* الواجهة العامة محفوظة حرفيًا — كل أنواع السطح تعاد من بيتها الورقي
 * (نمط Wave E/F المجرّب) فلا يتغير أي مستورد من نحو السبعين. */
export type {
  AdjustMaterialInput,
  ConfirmOpeningInput,
  ConsumeMaterialInput,
  ExtractRemainderInput,
  InventoryActivationInput,
  InventoryActivationState,
  InventoryMaterialOverview,
  InventoryOverview,
  InventoryReferences,
  InventoryResult,
  MaterialOpeningInput,
  OpenMaterialInput,
  OrderActualMaterialComparison,
  OrderActualMaterialComparisonReviewReason,
  PeriodWasteReading,
  PurchaseReceiptStatus,
  ReceivePurchaseInput,
  RecordShortageInput,
  ResolveShortageInput,
  RetrackMaterialInput,
  ReverseInventoryInput,
  UntrackMaterialInput,
  WasteMaterialInput,
} from "./inventoryMaterialModel";

export class InventoryMaterialService {
  constructor(
    private readonly store: InventoryMaterialServiceStore,
    private readonly now: Clock = systemClock,
  ) {}

  async overview(): Promise<InventoryResult<InventoryOverview>> {
    return overview(this.store);
  }

  async movements(): Promise<InventoryResult<readonly InventoryMovement[]>> {
    return listMovements(this.store);
  }

  async readActivation(): Promise<InventoryResult<InventoryActivationState>> {
    return readActivation(this.store);
  }

  async activate(input: InventoryActivationInput): Promise<InventoryResult<InventoryActivation>> {
    return activateInventory(this.store, this.now, input);
  }

  async readOrderActualMaterialComparison(
    orderId: string,
  ): Promise<InventoryResult<OrderActualMaterialComparison>> {
    return readOrderActualMaterialComparison(this.store, orderId);
  }

  async references(): Promise<InventoryResult<InventoryReferences>> {
    return readReferences(this.store);
  }

  async openMaterial(
    input: OpenMaterialInput,
  ): Promise<InventoryResult<{ material: Material; opening: InventoryMovement | null }>> {
    return openMaterial(this.store, this.now, input);
  }

  async untrackMaterial(input: UntrackMaterialInput): Promise<InventoryResult<Material>> {
    return untrackMaterial(this.store, this.now, input);
  }

  async retrackMaterial(input: RetrackMaterialInput): Promise<InventoryResult<Material>> {
    return retrackMaterial(this.store, this.now, input);
  }

  async confirmMaterialOpening(
    input: ConfirmOpeningInput,
  ): Promise<InventoryResult<{ material: Material; movement: InventoryMovement | null }>> {
    return confirmMaterialOpening(this.store, this.now, input);
  }

  async receivePurchase(input: ReceivePurchaseInput): Promise<InventoryResult<InventoryMovement>> {
    return receivePurchase(this.store, this.now, input);
  }

  async consume(input: ConsumeMaterialInput): Promise<InventoryResult<InventoryMovement>> {
    return consumeMaterial(this.store, this.now, input);
  }

  async recordShortage(input: RecordShortageInput): Promise<InventoryResult<InventoryShortage>> {
    return recordShortage(this.store, this.now, input);
  }

  async consumeWithShortage(
    input: ConsumeMaterialInput,
  ): Promise<InventoryResult<{ movement: InventoryMovement | null; shortage: InventoryShortage }>> {
    return consumeWithShortage(this.store, this.now, input);
  }

  async resolveShortage(input: ResolveShortageInput): Promise<InventoryResult<InventoryShortage>> {
    return resolveShortage(this.store, this.now, input);
  }

  async shortages(): Promise<InventoryResult<readonly InventoryShortage[]>> {
    return listShortages(this.store);
  }

  async waste(input: WasteMaterialInput): Promise<InventoryResult<InventoryMovement>> {
    return wasteMaterial(this.store, this.now, input);
  }

  async extractRemainder(input: ExtractRemainderInput): Promise<InventoryResult<InventoryMovement>> {
    return extractRemainder(this.store, this.now, input);
  }

  async adjust(input: AdjustMaterialInput): Promise<InventoryResult<InventoryMovement>> {
    return adjustMaterial(this.store, this.now, input);
  }

  async reverse(input: ReverseInventoryInput): Promise<InventoryResult<InventoryMovement>> {
    return reverseMovement(this.store, this.now, input);
  }

  async purchaseReceiptStatus(purchaseId: string): Promise<InventoryResult<PurchaseReceiptStatus | null>> {
    return readPurchaseReceiptStatus(this.store, purchaseId);
  }

  async readPeriodWaste(from: string, to: string): Promise<InventoryResult<PeriodWasteReading>> {
    return readPeriodWaste(this.store, from, to);
  }
}
