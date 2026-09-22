/** Composition root: React receives application services, never the IndexedDB adapter itself. */
import {
  createContext,
  useCallback,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DraftService } from "@/application/drafts/draftService";
/* المجموعة ٥ (عقد ٣٦): مسودات النماذج الطويلة — خارج اللقطة، بلا أثر مالي. */
import { FormDraftService } from "@/application/drafts/formDraftService";
/* المجموعة ٥ (عقد ٣٧): القفل المحلي — بصمة الرمز فقط، خارج اللقطة. */
import { LocalLockService } from "@/application/security/localLockService";
import { CostService } from "@/application/cost/costService";
import { AgreementService } from "@/application/agreements/agreementService";
import { AgreementContextService } from "@/application/agreements/agreementContextService";
import { FulfillmentService } from "@/application/fulfillment/fulfillmentService";
import { DeliveryReviewService } from "@/application/fulfillment/deliveryReviewService";
/* EXE-014 (D-034 — أمانة الحزمة): خدمات النقل والاستعادة تُحمَّل عند الحاجة
 * فقط — الإدخال المالي اليومي لا يدفع ثمن آلة الترحيل والتحقق في مسار الإقلاع.
 * النوع هنا فقط (import type) فلا يسحب الوحدة إلى حزمة الدخول. */
import type { LocalTransferService } from "@/application/transfers/localTransferService";
import type { GuidedOpeningImportService } from "@/application/transfers/guidedOpeningImportService";
import { PreferenceService } from "@/application/preferences/preferenceService";
import { ProfileService } from "@/application/profile/profileService";
import { OwnerProfileService } from "@/application/owner/ownerProfileService";
import { FinancialPulseService } from "@/application/financial-pulse/financialPulseService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { CorrectionHistoryService } from "@/application/finance/correctionHistoryService";
import { OwnerEntitlementService } from "@/application/finance/ownerEntitlementService";
import { DailyFollowUpService } from "@/application/follow-up/dailyFollowUpService";
import { HomeControlCenterService } from "@/application/home/homeControlCenterService";
import { ScheduleService } from "@/application/scheduling/scheduleService";
import { ScheduleRecurrenceService } from "@/application/scheduling/recurrenceService";
import { SupplierPurchaseService } from "@/application/suppliers/supplierPurchaseService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { CatalogService } from "@/application/catalog/catalogService";
import { ActualTimeService } from "@/application/time/actualTimeService";
import { RecurringWorkService } from "@/application/finance/recurringWorkService";
import { G5Service } from "@/application/g5/g5Service";
import { DirectSaleService } from "@/application/direct-sales/directSaleService";
import { CostEstimateService } from "@/application/estimates/costEstimateService";
import { PartyLedgerService } from "@/application/parties/partyLedgerService";
/* المجموعة ٢: التحصيل ودفتر المحفظة والكشف — خدمات مالية جديدة فوق المخزن نفسه. */
import { CollectionService } from "@/application/collections/collectionService";
/* المجموعة ٦ (البند ١ — S2-04أ): التراجع المزدوج عن القبضة وتخصيصها المطابق. */
import { CollectionReversalService } from "@/application/collections/collectionReversalService";
import { SaleCollectionReversalService } from "@/application/collections/saleCollectionReversalService";
import { WalletLedgerService } from "@/application/cash/walletLedgerService";
import { StatementService } from "@/application/finance/statementService";
/* FIN-003/007 (WS-173 — Wave 1): مقارنة الفترتين وجسر النتيجة إلى الكاش — خدمات
 * قراءة فقط فوق المخزن نفسه (بساعة قابلة للحقن). نماذج القراءة تُعاد تصديرها
 * من جذر التطبيق هذا فتستوردها الأسطح من هنا لا من ملف الخدمة مباشرة:
 * محتوى الطبقتين كله داخل تفاصيل مطوية فلا يدخل إغلاق كثافة النص لأي شاشة. */
import { PeriodComparisonService } from "@/application/finance/periodComparisonService";
import { ProfitToCashBridgeService } from "@/application/finance/profitToCashBridgeService";
export type { PeriodComparisonReading } from "@/application/finance/periodComparisonService";
export type { ProfitToCashBridgeReading } from "@/application/finance/profitToCashBridgeService";
/* المجموعة ١ (فحص سلامة مالي): خدمة قراءة فقط فوق القارئ الكنسي والكشف والمحافظ. */
import { IntegrityCheckService } from "@/application/finance/integrityCheckService";
/* Stage 2 — OPS-001 (tracker): مواعيد الاستحقاق والتقادم الأساسي — قراءة فقط. */
import { DueDatesService } from "@/application/finance/dueDatesService";
/* Stage 2 — OPS-005/006 (tracker): القارئ الموحد للقادم والمتأخر — قراءة فقط. */
import { UpcomingService } from "@/application/finance/upcomingService";
/* OPS-003 (عقد ٤١): النوع فقط هنا — الخدمة تُحمّل ديناميكيًا بعد الإقلاع
 * (سابقة EXE-014/D-034) فلا تدخل كومة الإقلاع ولا تضغط ميزانية الحزمة. */
import type { RecurringExpenseService } from "@/application/finance/recurringExpenseService";
/* Stage 2 — OPS-004 (tracker): قراءة التكلفة/الكمية المخططتين للقوالب — قراءة فقط. */
import { TemplatePlannedCostService } from "@/application/catalog/templatePlannedCostService";
import { createBrowserLocalStore } from "@/storage/local/createBrowserLocalStore";
import type { PrototypeLocalStore } from "@/storage/local/types";
/* المجموعة ٤ (عقد ٢٩): الأصول والقروض وتصنيف العربون المحتفظ به. */
import { AssetService } from "@/application/assets/assetService";
import { LoanService } from "@/application/loans/loanService";
import { RetainedDepositService } from "@/application/finance/retainedDepositService";
/* المجموعة ٥ (عقد ٣٠): القارئ الموحّد للنشاط. */
import { ActivityService } from "@/application/activity/activityService";

type PrototypeServices = {
  profiles: ProfileService;
  /* المجموعة ١ (ملف المالك): هوية محلية مستقلة — لا مزود خارجي ولا مزامنة. */
  ownerProfile: OwnerProfileService;
  preferences: PreferenceService;
  actualTime: ActualTimeService;
  drafts: DraftService;
  /* المجموعة ٥ (عقد ٣٦): مسودات النماذج الطويلة. */
  formDrafts: FormDraftService;
  /* المجموعة ٥ (عقد ٣٧): القفل المحلي. */
  localLock: LocalLockService;
  directSales: DirectSaleService;
  costs: CostService;
  agreements: AgreementService;
  agreementContext: AgreementContextService;
  financialPulse: FinancialPulseService;
  projectFinance: ProjectFinancialService;
  /* U-001: «السجل» — خدمة قراءة التصحيحات الموثقة عبر السجلات المدعومة. */
  correctionHistory: CorrectionHistoryService;
  ownerEntitlement: OwnerEntitlementService;
  recurringWork: RecurringWorkService;
  g5: G5Service;
  supplierPurchases: SupplierPurchaseService;
  cashContinuity: CashContinuityService;
  inventory: InventoryMaterialService;
  catalog: CatalogService;
  dailyFollowUp: DailyFollowUpService;
  homeControlCenter: HomeControlCenterService;
  schedules: ScheduleService;
  recurrences: ScheduleRecurrenceService;
  fulfillment: FulfillmentService;
  /* المجموعة ٣ (عقد D4): مراجعة التسليم وتنفيذه وعكسه — المسار الوحيد للتسليم
   * بحركات مخزون وقبض عند التسليم. */
  deliveryReview: DeliveryReviewService;
  /* EXE-014: تُوفَّر عند اكتمال التحميل الخامل — null يعني «جارٍ التجهيز»،
   * ومستهلكها الوحيد (الإعدادات) يعلن ذلك بصدق لا بفشل صامت. */
  transfers: LocalTransferService | null;
  guidedOpeningImport: GuidedOpeningImportService | null;
  costEstimates: CostEstimateService;
  partyLedger: PartyLedgerService;
  /* المجموعة ٢ (Scope B): ورقة التحصيل — المصدر الواحد لتحصيل الذمم. */
  collections: CollectionService;
  /* Stage 2 — OPS-001: قراءة التقادم ومواعيد الاستحقاق — لا كتابة إطلاقًا. */
  dueDates: DueDatesService;
  /* Stage 2 — OPS-005/006: القارئ الموحد للقادم والمتأخر — لا كتابة إطلاقًا. */
  upcoming: UpcomingService;
  recurringExpenses: RecurringExpenseService | null;
  /* Stage 2 — OPS-004: قراءة التكلفة/الكمية المخططتين للقوالب — لا كتابة إطلاقًا. */
  templatePlannedCost: TemplatePlannedCostService;
  /* المجموعة ٦ (البند ١): تراجع القبضة مع تخصيصها المطابق بنقطة واحدة ذرّية. */
  collectionReversal: CollectionReversalService;
  saleCollectionReversal: SaleCollectionReversalService;
  /* المجموعة ٢ (§9.1): دفتر المحفظة — قراءة حركات كل محفظة بمصادرها. */
  walletLedger: WalletLedgerService;
  /* المجموعة ٢ (§9.2): كشف الفترة — كاش/نتيجة/أمانات/ذمم/مال المالك. */
  statement: StatementService;
  /* FIN-007 (WS-173 — Wave 1): مقارنة الفترة المعروضة مع سابقتها المكافئة — قراءة فقط. */
  periodComparison: PeriodComparisonService;
  /* FIN-003 (WS-173 — Wave 1): جسر النتيجة المسجلة إلى تغير الكاش المسجل — قراءة فقط. */
  profitToCashBridge: ProfitToCashBridgeService;
  /* المجموعة ٥ (عقد ٣٠): القارئ الموحّد — «آخر ما حدث» في الرئيس ومالي. */
  activity: ActivityService;
  /* المجموعة ١ (فحص سلامة مالي): قراءة فقط — «يقرأ أرقامك ولا يغيّر شيئًا». */
  integrityCheck: IntegrityCheckService;
  /* المجموعة ٤ (عقد ٢٩): الأصول والإهلاك، والقروض الصادرة، وتصنيف العربون
   * المحتفظ به — كتابة الأحداث المالية من هنا فقط لا من أي صفحة. */
  assets: AssetService;
  loans: LoanService;
  retainedDeposits: RetainedDepositService;
  dataVersion: number;
  notifyDataChanged: () => void;
};
const PrototypeServicesContext = createContext<PrototypeServices | undefined>(undefined);

const CROSS_TAB_CHANNEL = "micro-data-changed";

export function PrototypeServicesProvider({ children }: { children: ReactNode }) {
  const [dataVersion, setDataVersion] = useState(0);
  /* S5-12: نافذة أخرى كتبت بيانات؟ BroadcastChannel ينبّه هذه النافذة فتُحدّث
   * قراءاتها بدل أن تظل تعرض حالة قديمة حتى إعادة التحميل. */
  const channelRef = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(CROSS_TAB_CHANNEL);
    channelRef.current = channel;
    channel.onmessage = () => setDataVersion(version => version + 1);
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, []);
  const notifyDataChanged = useCallback(() => {
    setDataVersion(version => version + 1);
    channelRef.current?.postMessage("changed");
  }, []);
  /* EXE-014 (D-034): خدمات النقل والاستعادة تُحمَّل ديناميكيًا بعد الإقلاع —
   * كومة الترحيل والتحقق كبيرة ولا يحتاجها مسار الإقلاع؛ تُبنى فوق المخزن
   * نفسه فور جاهزيتها ولا يُعاد بناؤها عند تحديث dataVersion. */
  const [transferServices, setTransferServices] = useState<{
    transfers: LocalTransferService;
    guidedOpeningImport: GuidedOpeningImportService;
  } | null>(null);
  /* OPS-003 (عقد ٤١، سابقة EXE-014/D-034): خدمة المصروف المتكرر تُحمَّل
   * ديناميكيًا بعد الإقلاع — لا يحتاجها مسار الإقلاع؛ تُبنى فوق المخزن نفسه
   * والكاتب الكنوني فور جاهزيتها ولا تُعاد عند تحديث dataVersion. */
  const [recurringExpenseService, setRecurringExpenseService] = useState<RecurringExpenseService | null>(
    null,
  );
  useEffect(() => {
    let active = true;
    void Promise.all([
      import("@/application/transfers/localTransferService"),
      import("@/application/transfers/guidedOpeningImportService"),
      import("@/application/finance/recurringExpenseService"),
    ]).then(([transferModule, guidedModule, recurringModule]) => {
      if (!active) return;
      setTransferServices({
        transfers: new transferModule.LocalTransferService(singletonStore),
        guidedOpeningImport: new guidedModule.GuidedOpeningImportService(singletonStore),
      });
      setRecurringExpenseService(
        new recurringModule.RecurringExpenseService(
          singletonStore,
          undefined,
          singletonServices.projectFinance,
        ),
      );
    });
    return () => {
      active = false;
    };
  }, []);
  /* S5-08 (المجموعة ٦ — البند ٦): الخدمات والمخزن عناصر بلا حالة — تُنشأ مرة
   * واحدة على مستوى الوحدة (singleton)، وdataVersion يعيد تركيب غلاف السياق
   * الرخيص فقط: هوية السياق تتغير فيلتقط التأثيرات المفتاحة على dataVersion
   * التحديث، وهويات الخدمات الداخلية تبقى مستقرة فلا يُعاد بناء الخدمات الأربعون
   * (40 — العد الموثق عند 9a8c949) عند كل كتابة، ويبقى المخزن واحدًا فوق الاتصال
   * المخزَّن (S5-07). */
  const services = useMemo<PrototypeServices>(
    () => ({
      ...singletonServices,
      ...(transferServices ?? { transfers: null, guidedOpeningImport: null }),
      recurringExpenses: recurringExpenseService,
      dataVersion,
      notifyDataChanged,
    }),
    [transferServices, recurringExpenseService, dataVersion, notifyDataChanged],
  );
  return <PrototypeServicesContext.Provider value={services}>{children}</PrototypeServicesContext.Provider>;
}

/* مجموعة الخدمات الواحدة — تُبنى مرة عند تحميل الوحدة. الخدمات كلها بلا حالة
 * (حقول قراءة فقط في منشئاتها) فلا حالة مشتركة تُفسد بين الأسطح.
 * EXE-014: المخزن نفسه عنصر وحيد معلن — خدمات النقل الخاملة تُبنى فوقه
 * لاحقًا فترى البيانات نفسها لا نسخة ثانية. */
const singletonStore = createBrowserLocalStore();
function createServices(): Omit<
  PrototypeServices,
  | "dataVersion"
  | "notifyDataChanged"
  | "transfers"
  | "guidedOpeningImport"
  | "transferServices"
  | "recurringExpenses"
> {
  const store = singletonStore;
  const costs = new CostService(store);
  const projectFinance = new ProjectFinancialService(store);
  const ownerEntitlement = new OwnerEntitlementService(store, (from, to) =>
    projectFinance.readRecordedPeriodResult(from, to),
  );
  const g5 = new G5Service(store, projectFinance);
  const schedules = new ScheduleService(store);
  const recurrences = new ScheduleRecurrenceService(store);
  const agreementContext = new AgreementContextService(store);
  const dailyFollowUp = new DailyFollowUpService(store);
  const supplierPurchases = new SupplierPurchaseService(store);
  const inventory = new InventoryMaterialService(store);
  const recurringWork = new RecurringWorkService(store);
  const directSales = new DirectSaleService(store);
  const fulfillment = new FulfillmentService(store, undefined, schedules);
  const deliveryReview = new DeliveryReviewService(store, undefined, projectFinance, schedules);
  const cashContinuity = new CashContinuityService(store);
  const statement = new StatementService(store, projectFinance);
  const periodComparison = new PeriodComparisonService(store);
  const profitToCashBridge = new ProfitToCashBridgeService(store);
  /* Stage 2 — OPS-001: قراءة التقادم فوق مصدر الذمم القابلة للتحصيل نفسه. */
  const collections = new CollectionService(store, fulfillment, directSales, projectFinance);
  const dueDates = new DueDatesService(store, collections);
  const upcoming = new UpcomingService(dueDates, collections, schedules, projectFinance);
  const templatePlannedCost = new TemplatePlannedCostService(store, inventory);
  const activity = new ActivityService(store);
  return {
    profiles: new ProfileService(store),
    ownerProfile: new OwnerProfileService(store),
    preferences: new PreferenceService(store),
    actualTime: new ActualTimeService(store),
    drafts: new DraftService(store),
    formDrafts: new FormDraftService(store),
    localLock: new LocalLockService(store),
    directSales: directSales,
    costs,
    agreements: new AgreementService(store, costs),
    agreementContext,
    financialPulse: new FinancialPulseService(store),
    projectFinance,
    correctionHistory: new CorrectionHistoryService(store),
    ownerEntitlement,
    recurringWork,
    g5,
    supplierPurchases,
    cashContinuity,
    inventory,
    catalog: new CatalogService(store),
    dailyFollowUp,
    homeControlCenter: new HomeControlCenterService(
      store,
      dailyFollowUp,
      projectFinance,
      supplierPurchases,
      inventory,
      agreementContext,
      activity,
    ),
    schedules,
    recurrences,
    fulfillment: fulfillment,
    deliveryReview,
    costEstimates: new CostEstimateService(store),
    partyLedger: new PartyLedgerService(store),
    collections,
    dueDates,
    upcoming,
    templatePlannedCost,
    collectionReversal: new CollectionReversalService(store, projectFinance),
    saleCollectionReversal: new SaleCollectionReversalService(store, projectFinance),
    walletLedger: new WalletLedgerService(store),
    statement,
    periodComparison,
    profitToCashBridge,
    activity,
    integrityCheck: new IntegrityCheckService(store, projectFinance, statement, cashContinuity),
    assets: new AssetService(store),
    loans: new LoanService(store),
    retainedDeposits: new RetainedDepositService(store),
  };
}

const singletonServices = createServices();

/* FIN-002 (WS-174 — Wave 2، سابقة EXE-014/D-034): موّرد المخزن الوحيد للأسطح
 * التي تبني خدمةً محمّلة ديناميكيًا بمعرّفها الخاص عند أول فتح — الخدمة نفسها
 * لا تُسجَّل في هذا السياق أبدًا (لا تضاف إلى PrototypeServices ولا تُبنى هنا)
 * فلا تدخل كومة الإقلاع؛ الصفحة تستورد النوع فقط وتستدعي الوحدة بـimport().
 * الصفحات لا تلمس التخزين مباشرة (حدود الطبقات) — تطلبها من جذر التركيب. */
export function getPrototypeLocalStore(): PrototypeLocalStore {
  return singletonStore;
}

export function usePrototypeServices() {
  const context = useContext(PrototypeServicesContext);
  if (!context) throw new Error("usePrototypeServices must be used inside PrototypeServicesProvider");
  return context;
}
