/** IndexedDB store names and the database identity — one pure constants module so the
 * schema-upgrade path and the adapter share a single source (Group 10, Phase 10-B).
 * Values are frozen history: no rename, no store added or removed (schema 35).
 */
export const databaseName = "micro-prototype-local";
export const profileStore = "activity-profile";
/* مخزن ٣٠ (المجموعة ١): هوية المالك المحلية — سجل واحد بلا فهارس. */
export const ownerProfileStore = "owner-profile";
export const preferencesStore = "local-preferences";
export const draftStore = "order-drafts";
export const orderStore = "craft-orders";
export const directSaleStore = "direct-sales";
export const scheduleStore = "schedule-entries";
export const recurrenceStore = "schedule-recurrences";
export const financialEventStore = "financial-events";
export const supplierPurchaseStore = "supplier-purchases";

/* المجموعة ٢ (التحصين الكامل — HIGH-001): رسالة تعارض قالب التكرار — مسار آخر
 * كتب بين قراءة الخدمة والتزامها؛ لا يُكتب شيء ويُعاد المحاولة. */
export const RECURRENCE_STALE_MESSAGE =
  "قالب التكرار أو مواعده تغيّرت من مسار آخر بعد فتحك لها — لم يُسجَّل شيء؛ أعد المحاولة.";
export const cashWalletStore = "cash-wallets";
export const cashContinuityEntryStore = "cash-continuity-entries";
export const materialStore = "materials";
export const inventoryMovementStore = "inventory-movements";
/* القرار ٩: سجل تفعيل المخزون المؤرّخ — مستودع منفرد بلا فهارس. */
export const inventoryActivationStore = "inventory-activations";
/* المجموعة ٢ (عقد ٢٨ / D-027): سجلات نقص المخزون — تعيين موثّق بدل رصيد سالب. */
export const inventoryShortageStore = "inventory-shortages";
export const catalogItemStore = "catalog-items";
export const measurementUnitStore = "measurement-units";
export const directConversionStore = "direct-conversions";
export const catalogTemplateStore = "catalog-templates";
export const actualTimeStore = "actual-time-records";
export const shortCashDeclarationStore = "short-cash-declarations";
export const ownerEntitlementPolicyStore = "owner-entitlement-policies";
export const ownerEntitlementRecordStore = "owner-entitlement-records";
export const ownerEntitlementOpeningBalanceStore = "owner-entitlement-opening-balances";
export const ownerMovementStore = "owner-movements";
export const allocationPolicyStore = "allocation-policies";
export const costEstimateStore = "cost-estimates";
/* المجموعة ٤ (عقد ٢٩): سجلات الأصول والقروض — سجلان تشغيليان فوق أحداثهما المالية. */
export const assetStore = "assets";
export const loanStore = "loans";
/* المجموعة ٥ (الاستمرارية): مسودات النماذج الطويلة وسجل القفل المحلي — مخزنان
 * خارج اللقطة عمدًا (مسودة عابرة/سر محلي)؛ المُنشئ محروس فيُفتح القديم بلا فقدان. */
export const formDraftStore = "form-drafts";
export const securityStore = "local-security";
