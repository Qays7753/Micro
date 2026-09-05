/**
 * Local persistence contracts. Domain aggregates, persistence records, and view models stay separate.
 * Schedule records are local operational follow-up only; they do not create financial effects.
 */
import type { CraftOrder } from "@micro-domain/craft-order/index.js";
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";
import type { SupplierPurchase } from "@micro-domain/supplier-purchase/index.js";
import type { CashContinuityEntry, CashWallet } from "@micro-domain/cash-continuity/index.js";
import type { InventoryMovement, InventoryShortage, Material } from "@micro-domain/inventory-material/index.js";
import type {
  CatalogItem,
  CatalogTemplate,
  DirectConversion,
  MeasurementUnit,
} from "@micro-domain/catalog/index.js";
import type { ActualTimeRecord } from "@micro-domain/actual-time/index.js";
import type { ShortCashDeclaration } from "@micro-domain/g5/index.js";
import type {
  OwnerEntitlementOpeningBalance,
  OwnerEntitlementPolicy,
  OwnerEntitlementRecord,
  OwnerMovement,
} from "@micro-domain/owner-entitlement/index.js";
import type { AllocationPolicy } from "@micro-domain/recurring-margin/index.js";
import type { DirectSale } from "@micro-domain/direct-sale/index.js";
import type { AssetRecord } from "@micro-domain/asset/index.js";
import type { LoanRecord } from "@micro-domain/loan/index.js";

/* المجموعة ٥ (الاستمرارية): المخطط ٣٥ يضيف مخزني `form-drafts` و`local-security`
 * بمُنشئ محروس — لا حقول جديدة على أي سجل قائم ولا ترحيل بيانات؛ القديم يفتح
 * ويجد المخزنين الفارغين. كلا المخزنين مستثنى من لقطة التصدير عمدًا: المسودات
 * النصية دخول عابر لا حقيقة مالية، ورمز القفل سرٌّ محلي لا يغادر الجهاز أبدًا. */
export const localSchemaVersion = 35;
export const localProfileId = "local-profile";
export const localPreferencesId = "local-preferences";
export const localExportFormat = "micro-prototype-local-export";
/* المجموعة ٥ (عقد النسخ الاحتياطي): النسخة ٢٧ تضيف حقول تكامل اختيارية
 * (بصمة sha256 + عدادات مضمّنة + إصدار التطبيق)؛ ملفات ٢٦ وأقدم تُقبل كما هي
 * بلا بصمة، والزوجان القديمان كلها تبقى في قائمة الاستيراد المسموحة. */
export const localExportVersion = 27;
export const localSecurityId = "local-security";
export type FormDraftKind =
  | "asset"
  | "loan"
  | "supplier_purchase"
  | "direct_sale"
  | "inventory_movement";
export type FormDraftEnvelope = {
  /** `${formKind}:${scopeId ?? "new"}` — مسودة واحدة لكل شاشة لكل نطاق. */
  id: string;
  formKind: FormDraftKind;
  scopeId: string | null;
  /** إصدار شكل القيم لكل نوع — تغيّره يعني تجاهل المسودة القديمة بلا انفجار. */
  valuesVersion: number;
  values: unknown;
  createdAt: string;
  updatedAt: string;
};
export type LocalSecurityRecord = {
  id: typeof localSecurityId;
  /** بصمة الرمز بترميز سداسي عشري — الرمز نفسه لا يُخزن أبدًا. */
  pinHash: string;
  /** ملح عشوائي مُولَّد مرة عند التفعيل (سلسلة سداسية عشرية). */
  salt: string;
  /** المجموعة ٦ (تدقيق A1 — SP-02): خوارزمية البصمة — غيابها = السجل القديم
   * (sha256 مفردة) ويُرقّى تلقائيًا إلى المشتق البطيء بعد أول فتح ناجح. */
  hashAlgo?: "pbkdf2";
  /** دقائق الخمول قبل القفل التلقائي؛ null = القفل اليدوي فقط. */
  autoLockMinutes: number | null;
  /** آخر لحظة نشاط معلنة — أساس اكتشاف الخمول عبر إخفاء/ظهور التطبيق. */
  lastActiveAt: string | null;
  /** محاولات فتح فاشلة متتالية — تصفّر عند النجاح؛ عدّاد فقط بلا قفل دائم. */
  failedAttempts: number;
  /** المجموعة ٦ (تدقيق A1 — SP-04): لحظة آخر محاولة فاشلة — أساس وقفة
   * المحاولات المُنفَّذة؛ null = لا محاولات فاشلة حديثة. */
  lastFailedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};
export type LocalExportIntegrity = {
  algorithm: "sha256";
  /** بصمة sha256 للنص القانوني لـ data (JSON.stringify بلا فراغات). */
  digest: string;
};
export type LocalExportCounts = {
  orders: number;
  directSales: number;
  financialEvents: number;
  supplierPurchases: number;
  cashWallets: number;
  cashContinuityEntries: number;
  materials: number;
  inventoryMovements: number;
  inventoryShortages: number;
  assets: number;
  loans: number;
  schedules: number;
  drafts: number;
};
/* المجموعة ٢ (عقد ٢٨ — مخزون انتقائي): مخزن ٣٢/نسخة ٢٤ أضافتا قرار المتابعة
 * ومعرفة رصيد البداية لكل مادة، ووسم معرفة التكلفة على الحركات، وربط الشراء
 * بمادة وكمية متوقعة، وسجلات نقص المخزون (متجر جديد `inventory-shortages`).
 * الحقول اختيارية بلا تعبئة (غياب = سلوك إرث متوافق)؛ الملفات ٢٣/٣١ تُقبل
 * وتُهاجر بقيم null/[] آمنة. */
export const localOwnerProfileId = "local-owner-profile";
export type OwnerProfile = {
  id: typeof localOwnerProfileId;
  /** معرّف مالك محلي ثابت — يولَّد مرة عند أول إنشاء ولا يتغير بالتعديل. */
  ownerId: string;
  displayName: string | null;
  /** اختياري تمامًا؛ يبقى فارغًا حتى يكتبه المالك. */
  email: string | null;
  /** حقل مستقبلي محجوز — null دائمًا في هذه المرحلة (لا مزود خارجي). */
  provider: null;
  /** حقل مستقبلي محجوز — null دائمًا في هذه المرحلة (لا حساب خارجي). */
  externalAccountId: null;
  createdAt: string;
  updatedAt: string;
};
/* القرار ٩: تفعيل المخزون صريح مؤرّخ — لحظة معلنة يُعرض تاريخها، والرصيد يوم
 * التفعيل يكفي. الترقية معلنة في الكومِت: سجل واحد بلا علاقات جديدة. */
export const localInventoryActivationId = "local-inventory-activation";
export type InventoryActivation = {
  id: typeof localInventoryActivationId;
  activatedOn: string;
  recordedAt: string;
  operationKey: string;
};

export type ActivityProfile = {
  id: typeof localProfileId;
  activityName: string;
  currency: "JOD";
  activityType: "custom_craft";
  createdAt: string;
  updatedAt: string;
};
export type OperatingWorkMode = "material_focused" | "time_focused" | "mixed";
export type LocalPreferences = {
  id: typeof localPreferencesId;
  theme: "light" | "dark" | "system";
  dailyScheduleCapacityMinutes: number | null;
  workMode: OperatingWorkMode | null;
  actualTimeTrackingEnabled: boolean;
  /** آخر إخفاء لبطاقة التثبيت؛ تُظهر البطاقة مجددًا بعد نافذة الثلاثين يومًا. ليست بيانات مالية. */
  installBannerDismissedAt: string | null;
  /** آخر تصدير مُتحقق منه — أساس تذكير النسخ الاحتياطي (P-01 طبقة ١). ليست بيانات مالية. */
  lastVerifiedExportAt?: string | null;
  /* O-001: تذكير النسخة الدوري اختياري — غيابه يعني «مفعّل» (السلوك القائم).
   * إطفاؤه يخفي سطر التذكير من الشاشة الرئيسية فقط؛ لا يمس التصدير ولا بياناته. */
  backupReminderEnabled?: boolean;
  updatedAt: string;
};
export type DraftIntent = "customer_order" | "planned_design";
export type DraftCostMaterial = {
  name: string;
  quantity: number;
  unit: string;
  unitPriceMinor: number;
  confidence: "known" | "estimated";
  /* المجموعة ٣ (عقد D2/D3): هوية المادة المرتبطة إن اختيرت من المخزون — هوية
   * فقط؛ الأرقام تُدخل وتُجمَّد كما هي. غياب الحقل = بند حر. */
  materialId?: string | null;
};
export type DraftCostTime = {
  minutes: number | null;
  hourlyRateMinor: number | null;
  confidence: "known" | "estimated";
};
export type DraftCostSnapshot = {
  id: string;
  revision: number;
  currency: "JOD";
  materialItems: readonly DraftCostMaterial[];
  time: DraftCostTime | null;
  packagingMinor: number;
  deliveryMinor: number;
  wasteMinor: number;
  safetyBufferMinor: number;
  quantity: number;
  createdAt: string;
};
export type OrderDraft = {
  id: string;
  intent: DraftIntent;
  customerName: string;
  itemName: string;
  catalogItemId: string | null;
  specifications: string;
  quantity: number;
  costSnapshots: readonly DraftCostSnapshot[];
  activeCostSnapshotId: string | null;
  linkedOrderId: string | null;
  /* U-004: مرجع التقدير الذي بدأت منه المسودة — أثر سجل فقط: التقدير لا يتغير،
  * ومحرر التكلفة يعرض بنوده كاقتراحات قابلة للتعديل. حقل اختياري؛ القديم بلاه يُقرأ فارغًا. */
  sourceEstimateId?: string | null;
  createdAt: string;
  updatedAt: string;
};
export type AgreementSource = "instagram" | "whatsapp" | "referral" | "walk_in" | "other";
export type FollowUpEvent = {
  id: string;
  type: "created" | "changed";
  idempotencyKey: string;
  createdAt: string;
  previousDate: string | null;
  followUpDate: string | null;
  reason: string;
};
export type StoredCraftOrder = {
  id: string;
  order: CraftOrder;
  catalogItemId: string | null;
  deliveryDate: string;
  agreementSource: AgreementSource | string | null;
  followUpSummary?: string | null;
  followUpDate?: string | null;
  followUpReason?: string | null;
  followUpEvents?: readonly FollowUpEvent[];
  createdAt: string;
  updatedAt: string;
};

export type ScheduleStatus = "scheduled" | "postponed" | "completed" | "cancelled";
type ScheduleEventType = "created" | "postponed" | "timing_changed" | "completed" | "cancelled";
type ScheduleEvent = {
  id: string;
  type: ScheduleEventType;
  idempotencyKey: string;
  createdAt: string;
  previousScheduledFor: string | null;
  scheduledFor: string;
  previousScheduledTime: string | null;
  scheduledTime: string | null;
  previousDurationMinutes: number | null;
  durationMinutes: number | null;
  reason: string | null;
};
export type ScheduleEntry = {
  id: string;
  orderId: string;
  kind: "delivery";
  scheduledFor: string;
  scheduledTime: string | null;
  durationMinutes: number | null;
  status: ScheduleStatus;
  postponeReason: string | null;
  events: readonly ScheduleEvent[];
  recurrenceId?: string | null;
  recurrenceIndex?: number | null;
  createdAt: string;
  updatedAt: string;
};
export type ScheduleRecurrenceFrequency = "weekly" | "monthly";
type ScheduleRecurrenceStatus = "active" | "cancelled";
export type ScheduleRecurrence = {
  id: string;
  sourceScheduleId: string;
  orderId: string;
  frequency: ScheduleRecurrenceFrequency;
  occurrenceCount: number;
  status: ScheduleRecurrenceStatus;
  idempotencyKey: string;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
};

/* تقدير تكلفة مستقل (PA-006 ومبدأ «أدواتي»): حساب تفكير قبل الالتزام — لا يُنشئ
 * أي حدث مالي ولا حركة مخزون ولا طلبًا. يُحفظ للمراجعة اللاحقة فقط ويوسم دائمًا «تقديري». */
type CostEstimateKnowledge = "known" | "estimated" | "partial" | "incomplete" | "stale" | "variable";
export type CostEstimate = {
  id: string;
  title: string;
  currency: "JOD";
  /* مدخلات الحاسبة نفسها: مواد ووقت وبنود اختيارية وكمية وهامش حماية. */
  materialItems: readonly DraftCostMaterial[];
  time: DraftCostTime | null;
  packagingMinor: number;
  deliveryMinor: number;
  wasteMinor: number;
  safetyBufferMinor: number;
  quantity: number;
  /* ملخص نتيجة الحساب لحظة الحفظ — يُعاد حسابه عند الفتح للتأكد من الثبات. */
  plannedCostMinor: number;
  unitCostMinor: number;
  priceFloorMinor: number;
  knowledgeState: CostEstimateKnowledge;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LocalStoreSnapshot = {
  profile: ActivityProfile | null;
  ownerProfile?: OwnerProfile | null;
  preferences: LocalPreferences | null;
  drafts: readonly OrderDraft[];
  orders: readonly StoredCraftOrder[];
  directSales?: readonly DirectSale[];
  schedules: readonly ScheduleEntry[];
  recurrences?: readonly ScheduleRecurrence[];
  financialEvents: readonly FinancialEvent[];
  supplierPurchases?: readonly SupplierPurchase[];
  cashWallets?: readonly CashWallet[];
  cashContinuityEntries?: readonly CashContinuityEntry[];
  materials?: readonly Material[];
  inventoryMovements?: readonly InventoryMovement[];
  inventoryShortages?: readonly InventoryShortage[];
  inventoryActivation?: InventoryActivation | null;
  catalogItems?: readonly CatalogItem[];
  measurementUnits?: readonly MeasurementUnit[];
  directConversions?: readonly DirectConversion[];
  catalogTemplates?: readonly CatalogTemplate[];
  actualTimeRecords?: readonly ActualTimeRecord[];
  shortCashDeclarations?: readonly ShortCashDeclaration[];
  ownerEntitlementPolicies?: readonly OwnerEntitlementPolicy[];
  ownerEntitlementRecords?: readonly OwnerEntitlementRecord[];
  ownerEntitlementOpeningBalances?: readonly OwnerEntitlementOpeningBalance[];
  ownerMovements?: readonly OwnerMovement[];
  allocationPolicies?: readonly AllocationPolicy[];
  costEstimates?: readonly CostEstimate[];
  /* المجموعة ٤ (عقد ٢٩): سجلات الأصول والقروض — مجموعتان جديدتان متجران
   * مستقلان؛ الحقيقة المالية في أحداثها داخل financialEvents. الغياب في
   * التصدير القديم = قائمة فارغة بلا اختراع تاريخ. */
  assets?: readonly AssetRecord[];
  loans?: readonly LoanRecord[];
};
export type LocalExportFile = {
  format: typeof localExportFormat;
  version: typeof localExportVersion;
  schemaVersion: typeof localSchemaVersion;
  exportedAt: string;
  data: LocalStoreSnapshot;
  /* المجموعة ٥: تكامل الملف — اختيارية كلها فتبقى ملفات ٢٦ وأقدم صالحة؛
   * البصمة تُتحقق عند وجودها وغيابها يعني ملفًا قديمًا يُعامل كالسابق. */
  integrity?: LocalExportIntegrity;
  counts?: LocalExportCounts;
  appVersion?: string;
};
export type StorageFailureCode =
  "storage_unavailable" | "storage_error" | "storage_upgrade_failed" | "storage_blocked" | "storage_stale";
export type StorageFailure = { ok: false; code: StorageFailureCode; message: string };
type StorageSuccess<T> = { ok: true; value: T };
export type StorageResult<T> = StorageSuccess<T> | StorageFailure;

export interface PrototypeLocalStore {
  getProfile(): Promise<StorageResult<ActivityProfile | null>>;
  saveProfile(profile: ActivityProfile): Promise<StorageResult<ActivityProfile>>;
  /** ملف المالك (المجموعة ١): هوية محلية مستقلة — سجل واحد بمعرّف ثابت. */
  getOwnerProfile(): Promise<StorageResult<OwnerProfile | null>>;
  saveOwnerProfile(profile: OwnerProfile): Promise<StorageResult<OwnerProfile>>;
  getPreferences(): Promise<StorageResult<LocalPreferences | null>>;
  savePreferences(preferences: LocalPreferences): Promise<StorageResult<LocalPreferences>>;
  listDrafts(): Promise<StorageResult<readonly OrderDraft[]>>;
  getDraft(id: string): Promise<StorageResult<OrderDraft | null>>;
  saveDraft(draft: OrderDraft): Promise<StorageResult<OrderDraft>>;
  /** القرار ٢١: حذف مسودة غير مرتبطة — سجل بلا أثر مالي؛ الحارس في خدمة التطبيق. */
  deleteDraft(id: string): Promise<StorageResult<null>>;
  listOrders(): Promise<StorageResult<readonly StoredCraftOrder[]>>;
  getOrder(id: string): Promise<StorageResult<StoredCraftOrder | null>>;
  saveOrder(order: StoredCraftOrder): Promise<StorageResult<StoredCraftOrder>>;
  /** المجموعة ٦ (البند ١ — S2-04أ): تراجع القبضة مع تخصيصها المطابق في معاملة
   * واحدة ذرّية — الطلب وأثر الكاش يُكتبان معًا أو لا يُكتب شيء، مع فحص هوية داخل
   * المعاملة يمنع التكرار المزدوج ويكشف الحالة النصفية بصدق لا بإكمال صامت. */
  commitOrderCollectionReversal(
    order: StoredCraftOrder,
    allocationReversal: CashContinuityEntry | null,
    reversalEventKey: string,
  ): Promise<
    StorageResult<{ order: StoredCraftOrder; cashEntry: CashContinuityEntry | null; reused: boolean }>
  >;
  listDirectSales(): Promise<StorageResult<readonly DirectSale[]>>;
  saveDirectSale(sale: DirectSale): Promise<StorageResult<DirectSale>>;
  listSchedules(): Promise<StorageResult<readonly ScheduleEntry[]>>;
  getSchedule(id: string): Promise<StorageResult<ScheduleEntry | null>>;
  saveSchedule(schedule: ScheduleEntry): Promise<StorageResult<ScheduleEntry>>;
  listRecurrences(): Promise<StorageResult<readonly ScheduleRecurrence[]>>;
  getRecurrence(id: string): Promise<StorageResult<ScheduleRecurrence | null>>;
  saveRecurrence(recurrence: ScheduleRecurrence): Promise<StorageResult<ScheduleRecurrence>>;
  commitRecurrence(
    recurrence: ScheduleRecurrence,
    schedules: readonly ScheduleEntry[],
  ): Promise<StorageResult<{ recurrence: ScheduleRecurrence; schedules: readonly ScheduleEntry[] }>>;
  listFinancialEvents(): Promise<StorageResult<readonly FinancialEvent[]>>;
  getFinancialEvent(id: string): Promise<StorageResult<FinancialEvent | null>>;
  saveFinancialEvent(event: FinancialEvent): Promise<StorageResult<FinancialEvent>>;
  commitFinancialEventCorrection(
    sourceEventId: string,
    reversal: FinancialEvent,
  ): Promise<StorageResult<FinancialEvent>>;
  /** تعديل موثق واحد-ذرّي: يكتب التراجع والبديل في معاملة واحدة فلا يبقى أثر معلّق بينهما. */
  commitFinancialEventReplacement(
    sourceEventId: string,
    reversal: FinancialEvent,
    replacement: FinancialEvent,
  ): Promise<StorageResult<{ reversal: FinancialEvent; replacement: FinancialEvent }>>;
  listSupplierPurchases(): Promise<StorageResult<readonly SupplierPurchase[]>>;
  getSupplierPurchase(id: string): Promise<StorageResult<SupplierPurchase | null>>;
  saveSupplierPurchase(purchase: SupplierPurchase): Promise<StorageResult<SupplierPurchase>>;
  listCashWallets(): Promise<StorageResult<readonly CashWallet[]>>;
  listCashContinuityEntries(): Promise<StorageResult<readonly CashContinuityEntry[]>>;
  commitCashContinuity(
    wallet: CashWallet | null,
    entries: readonly CashContinuityEntry[],
  ): Promise<StorageResult<{ wallet: CashWallet | null; entries: readonly CashContinuityEntry[] }>>;
  listMaterials(): Promise<StorageResult<readonly Material[]>>;
  listInventoryMovements(): Promise<StorageResult<readonly InventoryMovement[]>>;
  getInventoryActivation(): Promise<StorageResult<InventoryActivation | null>>;
  saveInventoryActivation(activation: InventoryActivation): Promise<StorageResult<InventoryActivation>>;
  commitInventory(
    material: Material | null,
    movements: readonly InventoryMovement[],
  ): Promise<StorageResult<{ material: Material | null; movements: readonly InventoryMovement[] }>>;
  /* المجموعة ٢ (عقد ٢٨): قراءة سجلات نقص المخزون — مرتبطة زمنيًا كالحركات. */
  listInventoryShortages(): Promise<StorageResult<readonly InventoryShortage[]>>;
  /* المجموعة ٢ (عقد ٢٨ / D-027): كتابة ذرّية واحدة للمادة وحركاتها وسجل النقص —
   * كل شيء أو لا شيء؛ لا حالة بينية (استهلاك جزئي + نقص معًا مثلًا). */
  commitInventoryWithShortage(
    material: Material | null,
    movements: readonly InventoryMovement[],
    shortage: InventoryShortage | null,
  ): Promise<StorageResult<{
    material: Material | null;
    movements: readonly InventoryMovement[];
    shortage: InventoryShortage | null;
  }>>;
  listCatalogItems(): Promise<StorageResult<readonly CatalogItem[]>>;
  getCatalogItem(id: string): Promise<StorageResult<CatalogItem | null>>;
  saveCatalogItem(item: CatalogItem): Promise<StorageResult<CatalogItem>>;
  listMeasurementUnits(): Promise<StorageResult<readonly MeasurementUnit[]>>;
  getMeasurementUnit(id: string): Promise<StorageResult<MeasurementUnit | null>>;
  saveMeasurementUnit(unit: MeasurementUnit): Promise<StorageResult<MeasurementUnit>>;
  listDirectConversions(): Promise<StorageResult<readonly DirectConversion[]>>;
  getDirectConversion(id: string): Promise<StorageResult<DirectConversion | null>>;
  saveDirectConversion(conversion: DirectConversion): Promise<StorageResult<DirectConversion>>;
  listCatalogTemplates(catalogItemId?: string): Promise<StorageResult<readonly CatalogTemplate[]>>;
  getCatalogTemplate(id: string): Promise<StorageResult<CatalogTemplate | null>>;
  commitCatalogTemplateRevision(
    previous: CatalogTemplate,
    next: CatalogTemplate,
  ): Promise<StorageResult<{ previous: CatalogTemplate; next: CatalogTemplate }>>;
  saveCatalogTemplate(template: CatalogTemplate): Promise<StorageResult<CatalogTemplate>>;
  listActualTimeRecords(): Promise<StorageResult<readonly ActualTimeRecord[]>>;
  listShortCashDeclarations(): Promise<StorageResult<readonly ShortCashDeclaration[]>>;
  getShortCashDeclaration(id: string): Promise<StorageResult<ShortCashDeclaration | null>>;
  saveShortCashDeclaration(declaration: ShortCashDeclaration): Promise<StorageResult<ShortCashDeclaration>>;
  commitShortCashDeclarationReversal(
    sourceId: string,
    reversal: ShortCashDeclaration,
  ): Promise<StorageResult<ShortCashDeclaration>>;
  listOwnerEntitlementPolicies(): Promise<StorageResult<readonly OwnerEntitlementPolicy[]>>;
  getOwnerEntitlementPolicy(id: string): Promise<StorageResult<OwnerEntitlementPolicy | null>>;
  saveOwnerEntitlementPolicy(policy: OwnerEntitlementPolicy): Promise<StorageResult<OwnerEntitlementPolicy>>;
  commitOwnerEntitlementPolicySuccessor(
    previous: OwnerEntitlementPolicy,
    successor: OwnerEntitlementPolicy,
  ): Promise<StorageResult<{ previous: OwnerEntitlementPolicy; successor: OwnerEntitlementPolicy }>>;
  listOwnerEntitlementRecords(): Promise<StorageResult<readonly OwnerEntitlementRecord[]>>;
  getOwnerEntitlementRecord(id: string): Promise<StorageResult<OwnerEntitlementRecord | null>>;
  saveOwnerEntitlementRecord(record: OwnerEntitlementRecord): Promise<StorageResult<OwnerEntitlementRecord>>;
  commitOwnerEntitlementRecordReversal(
    sourceId: string,
    reversal: OwnerEntitlementRecord,
  ): Promise<StorageResult<OwnerEntitlementRecord>>;
  listOwnerEntitlementOpeningBalances(): Promise<StorageResult<readonly OwnerEntitlementOpeningBalance[]>>;
  saveOwnerEntitlementOpeningBalance(
    balance: OwnerEntitlementOpeningBalance,
  ): Promise<StorageResult<OwnerEntitlementOpeningBalance>>;
  commitOwnerEntitlementOpeningBalanceReversal(
    sourceId: string,
    reversal: OwnerEntitlementOpeningBalance,
  ): Promise<StorageResult<OwnerEntitlementOpeningBalance>>;
  listOwnerMovements(): Promise<StorageResult<readonly OwnerMovement[]>>;
  getOwnerMovement(id: string): Promise<StorageResult<OwnerMovement | null>>;
  commitOwnerMovement(
    movement: OwnerMovement,
    cashEntry: CashContinuityEntry,
  ): Promise<StorageResult<{ movement: OwnerMovement; cashEntry: CashContinuityEntry }>>;
  getActualTimeRecord(id: string): Promise<StorageResult<ActualTimeRecord | null>>;
  saveActualTimeRecord(record: ActualTimeRecord): Promise<StorageResult<ActualTimeRecord>>;
  listAllocationPolicies(catalogItemId?: string): Promise<StorageResult<readonly AllocationPolicy[]>>;
  getAllocationPolicy(id: string): Promise<StorageResult<AllocationPolicy | null>>;
  saveAllocationPolicy(policy: AllocationPolicy): Promise<StorageResult<AllocationPolicy>>;
  commitAllocationPolicySuccessor(
    previous: AllocationPolicy,
    successor: AllocationPolicy,
  ): Promise<StorageResult<{ previous: AllocationPolicy; successor: AllocationPolicy }>>;
  listCostEstimates(): Promise<StorageResult<readonly CostEstimate[]>>;
  getCostEstimate(id: string): Promise<StorageResult<CostEstimate | null>>;
  saveCostEstimate(estimate: CostEstimate): Promise<StorageResult<CostEstimate>>;
  /** حذف تقدير حر: أداة تفكير لا سجل مالي — يحذف بلا أثر على أي رصيد. */
  deleteCostEstimate(id: string): Promise<StorageResult<null>>;
  commitOrderFromDraft(
    order: StoredCraftOrder,
    draft: OrderDraft,
    schedule?: ScheduleEntry,
  ): Promise<StorageResult<{ order: StoredCraftOrder; draft: OrderDraft; schedule: ScheduleEntry | null }>>;
  /* المجموعة ٣ (عقد D4): معاملة تسليم ذرّية واحدة — الطلب المسلّم وحركات
   * استهلاك المواد وسجلات النقص وتخصيص الكاش المقبوض عند التسليم تُكتب معًا
   * أو لا يُكتب شيء؛ فحص الهوية داخل المعاملة يمنع تكرار التسليم والحركات
   * عند إعادة المحاولة أو الإعادة بعد انقطاع. */
  commitOrderDelivery(
    order: StoredCraftOrder,
    movements: readonly InventoryMovement[],
    shortages: readonly InventoryShortage[],
    wallet: CashWallet | null,
    cashEntry: CashContinuityEntry | null,
  ): Promise<StorageResult<{
    order: StoredCraftOrder;
    movements: readonly InventoryMovement[];
    shortages: readonly InventoryShortage[];
    cashEntry: CashContinuityEntry | null;
    reused: boolean;
  }>>;
  /* المجموعة ٣ (عقد D4): عكس التسليم ذرّيًا — الطلب المعكوس وحركات المرآة
   * تُكتبان معًا؛ لا حالة بينية (عكس بلا حركات أو حركات بلا عكس). */
  commitOrderDeliveryReversal(
    order: StoredCraftOrder,
    reversalMovements: readonly InventoryMovement[],
  ): Promise<StorageResult<{
    order: StoredCraftOrder;
    reversalMovements: readonly InventoryMovement[];
    reused: boolean;
  }>>;
  readSnapshot(): Promise<StorageResult<LocalStoreSnapshot>>;
  replaceSnapshot(snapshot: LocalStoreSnapshot): Promise<StorageResult<LocalStoreSnapshot>>;
  /* المجموعة ٥ (عقد المسودة النصية): مسودات النماذج الطويلة — مخزن مستقل خارج
   * اللقطة؛ لا حدث مالي ولا مخزون ولا تغيير رصيد يحدث عبر هذه المسارات أبدًا.
   * الاستعادة عرضٌ صريح يقبله المستخدم؛ التعارض مع سجل نهائي يرفض التطبيق الصامت. */
  getFormDraft(id: string): Promise<StorageResult<FormDraftEnvelope | null>>;
  saveFormDraft(draft: FormDraftEnvelope): Promise<StorageResult<FormDraftEnvelope>>;
  deleteFormDraft(id: string): Promise<StorageResult<null>>;
  /* المجموعة ٥ (القفل المحلي): سجل أمان واحد بمعرّف ثابت — خارج اللقطة والتصدير
   * والأسرار؛ تخزين الرمز نفسه ممنوع، البصمة فقط. */
  getLocalSecurity(): Promise<StorageResult<LocalSecurityRecord | null>>;
  saveLocalSecurity(security: LocalSecurityRecord): Promise<StorageResult<LocalSecurityRecord>>;
  /** تعطيل القفل يحذف سجل الأمان نهائيًا — لا أثر يبقى في الجهاز. */
  deleteLocalSecurity(): Promise<StorageResult<null>>;
  /* المجموعة ٤ (عقد ٢٩ — الأصول): قراءة سجل الأصول. */
  listAssets(): Promise<StorageResult<readonly AssetRecord[]>>;
  getAsset(id: string): Promise<StorageResult<AssetRecord | null>>;
  /* كتابة ذرّية واحدة: سجل الأصل مع حدثه المالي (إنشاء/إهلاك دورة حياة/تخلص/
   * شطب) أو بلا حدث (مراجعة عقد) — كل شيء أو لا شيء؛ إعادة المحاولة آمنة
   * بفحص هوية داخل المعاملة يعيد الاستخدام الصادق لا التكرار. */
  commitAssetRecord(
    record: AssetRecord,
    event: FinancialEvent | null,
  ): Promise<StorageResult<{ record: AssetRecord; event: FinancialEvent | null; reused: boolean }>>;
  /* تصحيح اقتناء أصل: التراجع والبديل والسجل المحدّث في معاملة واحدة. */
  commitAssetAcquisitionCorrection(
    record: AssetRecord,
    reversal: FinancialEvent,
    replacement: FinancialEvent,
  ): Promise<StorageResult<{
    record: AssetRecord;
    reversal: FinancialEvent;
    replacement: FinancialEvent;
    reused: boolean;
  }>>;
  /* المجموعة ٤ (عقد ٢٩ — القروض): قراءة سجل القروض. */
  listLoans(): Promise<StorageResult<readonly LoanRecord[]>>;
  getLoan(id: string): Promise<StorageResult<LoanRecord | null>>;
  /* كتابة ذرّية واحدة: سجل القرض مع حدثه (إنشاء/سداد) أو تراجع سداد (الحدث
   * المعكوس) — لا حالة بينية أبدًا. */
  commitLoanRecord(
    record: LoanRecord,
    event: FinancialEvent,
  ): Promise<StorageResult<{ record: LoanRecord; event: FinancialEvent; reused: boolean }>>;
  /* تصحيح قرض: التراجع والبديل والسجل المحدّث في معاملة واحدة. */
  commitLoanCorrection(
    record: LoanRecord,
    reversal: FinancialEvent,
    replacement: FinancialEvent,
  ): Promise<StorageResult<{
    record: LoanRecord;
    reversal: FinancialEvent;
    replacement: FinancialEvent;
    reused: boolean;
  }>>;
  /* المجموعة ٤ (عقد ٢٩ — العربون المحتفظ): تصنيف معنى العربون والحدث المالي
   * المرتبط في معاملة واحدة؛ التراجع عن تصنيف: تراجع + بديل + الطلب معًا. */
  commitDepositClassification(
    order: StoredCraftOrder,
    event: FinancialEvent,
  ): Promise<StorageResult<{ order: StoredCraftOrder; event: FinancialEvent; reused: boolean }>>;
  commitDepositClassificationCorrection(
    order: StoredCraftOrder,
    reversal: FinancialEvent,
    replacement: FinancialEvent,
  ): Promise<StorageResult<{
    order: StoredCraftOrder;
    reversal: FinancialEvent;
    replacement: FinancialEvent;
    reused: boolean;
  }>>;
}
