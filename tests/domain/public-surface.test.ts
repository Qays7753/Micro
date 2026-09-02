/**
 * المجموعة ٦ (البند ٧) — قفل سطح الواجهة العامة للدومين (barrel contract).
 *
 * كل رمز يظهر هنا استورد باسمه من البرميل الرسمي: استيراد القيم يثبته وقت
 * التشغيل، واستيراد الأنواع يثبته المترجم (pnpm typecheck). أي إزالة مستقبلية
 * غير مقصودة لرمز عام تفشل هنا قبل أن تصل الإنتاج؛ وأي إضافة جديدة للسطح
 * تمر عبر مراجعة واعية (تحديث هذا الملف عمدًا).
 *
 * القاعدة بعد تخفيض المجموعة ٦: ما ليس له مستورد خارجي ليس جزءًا من العقد.
 */
import { describe, expect, it } from "vitest";

import * as actualTime from "../../src/domain/actual-time/index.js";
import * as cashContinuity from "../../src/domain/cash-continuity/index.js";
import * as catalog from "../../src/domain/catalog/index.js";
import * as craftOrder from "../../src/domain/craft-order/index.js";
import * as directSale from "../../src/domain/direct-sale/index.js";
import * as financialEvent from "../../src/domain/financial-event/index.js";
import * as g5 from "../../src/domain/g5/index.js";
import * as inventoryMaterial from "../../src/domain/inventory-material/index.js";
import * as ownerEntitlement from "../../src/domain/owner-entitlement/index.js";
import * as recurringMargin from "../../src/domain/recurring-margin/index.js";
import * as shared from "../../src/domain/shared/index.js";
import * as supplierPurchase from "../../src/domain/supplier-purchase/index.js";

/* الأنواع المستوردة موضعًا — فشل الترجمة عند اختفاء أي منها. */
import type { ActualTimeComparison, ActualTimeRecord } from "../../src/domain/actual-time/index.js";
import type {
  CashContinuityEntry,
  CashWallet,
  CashWalletKind,
  CashWalletOpeningStatus,
} from "../../src/domain/cash-continuity/index.js";
import type {
  CatalogItem,
  CatalogItemKind,
  CatalogTemplate,
  CatalogTemplateComponent,
  DirectConversion,
  MeasurementUnit,
  UnitDimension,
} from "../../src/domain/catalog/index.js";
import type {
  CostSnapshot,
  CraftOrder,
  KnowledgeGapId,
  OrderEvent,
  TimeCost,
} from "../../src/domain/craft-order/index.js";
import type {
  DirectSale,
  DirectSaleCollectionStatus,
  UpdateDirectSaleInput,
} from "../../src/domain/direct-sale/index.js";
import type {
  FinancialEvent,
  FinancialEventType,
  OperatingExpenseContext,
  SharedProjectShareBasis,
} from "../../src/domain/financial-event/index.js";
import type {
  BreakEvenResult,
  G5ExpenseInput,
  G5OrderInput,
  ShortCashDeclaration,
  ShortCashResult,
} from "../../src/domain/g5/index.js";
import type {
  InventoryMovement,
  Material,
  MaterialUnit,
  WasteContext,
} from "../../src/domain/inventory-material/index.js";
import type {
  CreateOwnerEntitlementPolicyInput,
  OwnerEntitlementEvidence,
  OwnerEntitlementOpeningBalance,
  OwnerEntitlementRecord,
  OwnerEntitlementPolicy,
  OwnerEntitlementPolicyTerms,
  OwnerMovement,
  OwnerMovementReason,
} from "../../src/domain/owner-entitlement/index.js";
import type {
  AllocationCalculation,
  AllocationEvidence,
  AllocationPolicy,
  AllocationPolicyKind,
  AllocationPolicyTerms,
} from "../../src/domain/recurring-margin/index.js";
import type { Currency, MoneyMinor } from "../../src/domain/shared/index.js";
import type { SupplierPurchase, SupplierPurchasePayment } from "../../src/domain/supplier-purchase/index.js";

/* استخدام الأنواع في شكل مقيد حتى لا يحذفها مُنظِّف الاستيرادات. */
export type __LockedTypeSurface = [
  ActualTimeComparison,
  ActualTimeRecord,
  CashContinuityEntry,
  CashWallet,
  CashWalletKind,
  CashWalletOpeningStatus,
  CatalogItem,
  CatalogItemKind,
  CatalogTemplate,
  CatalogTemplateComponent,
  DirectConversion,
  MeasurementUnit,
  UnitDimension,
  CostSnapshot,
  CraftOrder,
  KnowledgeGapId,
  OrderEvent,
  TimeCost,
  DirectSale,
  DirectSaleCollectionStatus,
  UpdateDirectSaleInput,
  FinancialEvent,
  FinancialEventType,
  OperatingExpenseContext,
  SharedProjectShareBasis,
  BreakEvenResult,
  G5ExpenseInput,
  G5OrderInput,
  ShortCashDeclaration,
  ShortCashResult,
  InventoryMovement,
  Material,
  MaterialUnit,
  WasteContext,
  CreateOwnerEntitlementPolicyInput,
  OwnerEntitlementEvidence,
  OwnerEntitlementOpeningBalance,
  OwnerEntitlementRecord,
  OwnerEntitlementPolicy,
  OwnerEntitlementPolicyTerms,
  OwnerMovement,
  OwnerMovementReason,
  AllocationCalculation,
  AllocationEvidence,
  AllocationPolicy,
  AllocationPolicyKind,
  AllocationPolicyTerms,
  Currency,
  MoneyMinor,
  SupplierPurchase,
  SupplierPurchasePayment,
];
/* تصدير الاسم يجبر المترجم على تحليل كل الأنواع المستوردة — فشل الترجمة
 * عند اختفاء أي رمز من العقد. (لا مرجع تشغيلي: الأنواع تُمحى بعد الترجمة.) */

describe("قفل سطح الدومين العام (١) — المجموعة ٦ (البند ٧)", () => {
  it("actualTime: دوال العقد العام حاضرة وقت التشغيل", () => {
    expect(typeof actualTime.createActualTimeRecord).toBe("function");
    expect(typeof actualTime.reverseActualTimeRecord).toBe("function");
    expect(typeof actualTime.summarizeActualTime).toBe("function");
  });
  it("cashContinuity: دوال العقد العام حاضرة وقت التشغيل", () => {
    expect(typeof cashContinuity.createCashContinuityEntry).toBe("function");
    expect(typeof cashContinuity.createCashWallet).toBe("function");
    expect(typeof cashContinuity.summarizeCashContinuity).toBe("function");
  });
  it("catalog: دوال العقد العام حاضرة وقت التشغيل", () => {
    expect(typeof catalog.assertSameDimension).toBe("function");
    expect(typeof catalog.createCatalogItem).toBe("function");
    expect(typeof catalog.createCatalogTemplate).toBe("function");
    expect(typeof catalog.createDirectConversion).toBe("function");
    expect(typeof catalog.createMeasurementUnit).toBe("function");
    expect(typeof catalog.updateCatalogItemDefaults).toBe("function");
    expect(typeof catalog.convertQuantityMilli).toBe("function");
  });
  it("craftOrder: دوال العقد العام حاضرة وقت التشغيل", () => {
    expect(typeof craftOrder.calculateCostSnapshot).toBe("function");
    expect(typeof craftOrder.cancelOrder).toBe("function");
    expect(typeof craftOrder.collectRegisteredDebt).toBe("function");
    expect(typeof craftOrder.collectRemaining).toBe("function");
    expect(typeof craftOrder.collectDeposit).toBe("function");
    expect(typeof craftOrder.createCraftOrder).toBe("function");
    expect(typeof craftOrder.isRegisteredCustomerDebt).toBe("function");
    expect(typeof craftOrder.knowledgeGapsOf).toBe("function");
    expect(typeof craftOrder.registerDebt).toBe("function");
    expect(typeof craftOrder.reviseAgreedPrice).toBe("function");
    expect(typeof craftOrder.reviseOrderCost).toBe("function");
    expect(typeof craftOrder.reverseOrderCollection).toBe("function");
    expect(typeof craftOrder.settleDepositRefund).toBe("function");
    expect(typeof craftOrder.settleDepositRetain).toBe("function");
    expect(typeof craftOrder.transitionOrder).toBe("function");
  });
  it("directSale: دوال العقد العام حاضرة وقت التشغيل", () => {
    expect(typeof directSale.applyPriceCut).toBe("function");
    expect(typeof directSale.cancelDirectSale).toBe("function");
    expect(typeof directSale.createDirectSale).toBe("function");
    expect(typeof directSale.updateDirectSale).toBe("function");
    expect(typeof directSale.directSaleOutstandingMinor).toBe("function");
  });
  it("financialEvent: دوال العقد العام حاضرة وقت التشغيل", () => {
    expect(typeof financialEvent.activeSettlementsMinor).toBe("function");
    expect(typeof financialEvent.calculateSharedProjectShareMinor).toBe("function");
    expect(typeof financialEvent.createFinancialEvent).toBe("function");
    expect(typeof financialEvent.createFinancialReversal).toBe("function");
    expect(typeof financialEvent.reversedEventIds).toBe("function");
    expect(typeof financialEvent.summarizeFinancialEvents).toBe("function");
  });
});

describe("قفل سطح الدومين العام (٢) — المجموعة ٦ (البند ٧)", () => {
  it("g5: دوال العقد العام حاضرة وقت التشغيل", () => {
    expect(typeof g5.calculateBreakEven).toBe("function");
    expect(typeof g5.calculateShortCash).toBe("function");
    expect(typeof g5.calculateBreakEvenUnits).toBe("function");
    expect(typeof g5.calculateContributionMargin).toBe("function");
    expect(typeof g5.createShortCashDeclaration).toBe("function");
    expect(typeof g5.createShortCashReversal).toBe("function");
  });
  it("inventoryMaterial: دوال العقد العام حاضرة وقت التشغيل", () => {
    expect(typeof inventoryMaterial.assertInventoryRemainsNonNegative).toBe("function");
    expect(typeof inventoryMaterial.consumptionValueMinor).toBe("function");
    expect(typeof inventoryMaterial.createInventoryMovement).toBe("function");
    expect(typeof inventoryMaterial.createMaterial).toBe("function");
    expect(typeof inventoryMaterial.isCostBackedConsumption).toBe("function");
    expect(typeof inventoryMaterial.summarizeMaterialInventory).toBe("function");
  });
  it("recurringMargin: دوال العقد العام حاضرة وقت التشغيل", () => {
    expect(typeof recurringMargin.perOutputUnitAmountMinor).toBe("function");
    expect(typeof recurringMargin.calculateAllocationPolicy).toBe("function");
    expect(typeof recurringMargin.createAllocationPolicy).toBe("function");
    expect(typeof recurringMargin.createAllocationPolicySuccessor).toBe("function");
    expect(typeof recurringMargin.isAllocationPolicyEffective).toBe("function");
    expect(typeof recurringMargin.isValidAllocationPolicy).toBe("function");
    expect(typeof recurringMargin.isValidWasteContext).toBe("function");
  });
  it("supplierPurchase: دوال العقد العام حاضرة وقت التشغيل", () => {
    expect(typeof supplierPurchase.createSupplierPurchase).toBe("function");
    expect(typeof supplierPurchase.recordSupplierPurchasePayment).toBe("function");
    expect(typeof supplierPurchase.reverseSupplierPurchasePayment).toBe("function");
    expect(typeof supplierPurchase.updateSupplierPurchase).toBe("function");
  });
  it("shared: معينات المال والتاريخ حاضرة وقت التشغيل", () => {
    expect(shared.JOD).toBeDefined();
    expect(typeof shared.addSafe).toBe("function");
    expect(typeof shared.assertId).toBe("function");
    expect(typeof shared.assertNonNegativeInteger).toBe("function");
    expect(typeof shared.assertPositiveMinor).toBe("function");
    expect(typeof shared.ceilRatio).toBe("function");
    expect(typeof shared.fieldLabelAr).toBe("function");
    expect(typeof shared.isValidLocalDate).toBe("function");
    expect(typeof shared.isValidTimestamp).toBe("function");
    expect(typeof shared.quantityMilliExact).toBe("function");
    expect(typeof shared.roundHalfUp).toBe("function");
  });
});

const REMOVED_SURFACE_SYMBOLS = [
  "deriveKnowledgeGaps",

  "CashAllocationSourceKind",

  "CatalogTemplateYieldReadiness",

  "CostConfidence",

  "CostSource",

  "DirectSaleRevisionKind",

  "DirectSaleStatus",

  "ExpenseBehavior",

  "ExpenseKnowledge",

  "ExpensePurpose",

  "ExpenseRelationship",

  "FinancialEventCorrectionType",

  "G5Direction",

  "G5QuantityIssue",

  "G5Status",

  "ShortCashDeclarationKind",

  "InventoryMovementType",

  "OwnerEntitlementCalculation",

  "OwnerEntitlementCalculationBasis",

  "OwnerEntitlementPolicyStatus",

  "OwnerMovementKind",

  "AllocationPolicyStatus",

  "PerOutputUnitAmount",
];

const ALL_BARRELS: Record<string, unknown>[] = [
  actualTime,

  cashContinuity,

  catalog,

  craftOrder,

  directSale,

  financialEvent,

  g5,

  inventoryMaterial,

  ownerEntitlement,

  recurringMargin,

  shared,

  supplierPurchase,
];

describe("قفل سطح الدومين العام (٣) — إغلاق العقد", () => {
  it("ownerEntitlement: دوال العقد العام حاضرة وقت التشغيل", () => {
    expect(typeof ownerEntitlement.calculateOwnerEntitlement).toBe("function");
    expect(typeof ownerEntitlement.createOwnerEntitlementOpeningBalance).toBe("function");
    expect(typeof ownerEntitlement.createOwnerEntitlementOpeningBalanceReversal).toBe("function");
    expect(typeof ownerEntitlement.createOwnerEntitlementPolicy).toBe("function");
    expect(typeof ownerEntitlement.createOwnerEntitlementPolicySuccessor).toBe("function");
    expect(typeof ownerEntitlement.createOwnerEntitlementRecord).toBe("function");
    expect(typeof ownerEntitlement.createOwnerEntitlementRecordReversal).toBe("function");
    expect(typeof ownerEntitlement.createOwnerMovement).toBe("function");
    expect(typeof ownerEntitlement.createOwnerMovementReversal).toBe("function");
    expect(typeof ownerEntitlement.isPolicyEffective).toBe("function");
    expect(typeof ownerEntitlement.isValidOwnerEntitlementOpeningBalance).toBe("function");
    expect(typeof ownerEntitlement.isValidOwnerEntitlementPolicy).toBe("function");
    expect(typeof ownerEntitlement.isValidOwnerEntitlementRecord).toBe("function");
    expect(typeof ownerEntitlement.isValidOwnerMovement).toBe("function");
    expect(typeof ownerEntitlement.ownerEntitlementPolicyFamilyForKind).toBe("function");
  });
  it("لا يحمل أي برميل رموزًا سحبنا تصديرها — السطح صار عقدًا مغلقًا", () => {
    /* المجموعة ٦ (البند ٧): الرموز غير المستوردة خارجيًا لم تعد جزءًا من
     * العقد العام — ظهورها هنا مجددًا يُعد توسيعًا غير مقصود للسطح. */
    for (const barrel of ALL_BARRELS) {
      const keys = Object.keys(barrel);
      for (const symbol of REMOVED_SURFACE_SYMBOLS) {
        expect(keys).not.toContain(symbol);
      }
    }
  });
});
