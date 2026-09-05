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
import { LocalTransferService } from "@/application/transfers/localTransferService";
import { GuidedOpeningImportService } from "@/application/transfers/guidedOpeningImportService";
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
import { RecurringWorkService } from "@/application/recurring-work/recurringWorkService";
import { G5Service } from "@/application/g5/g5Service";
import { DirectSaleService } from "@/application/direct-sales/directSaleService";
import { CostEstimateService } from "@/application/estimates/costEstimateService";
import { PartyLedgerService } from "@/application/parties/partyLedgerService";
/* المجموعة ٢: التحصيل ودفتر المحفظة والكشف — خدمات مالية جديدة فوق المخزن نفسه. */
import { CollectionService } from "@/application/collections/collectionService";
/* المجموعة ٦ (البند ١ — S2-04أ): التراجع المزدوج عن القبضة وتخصيصها المطابق. */
import { CollectionReversalService } from "@/application/collections/collectionReversalService";
import { WalletLedgerService } from "@/application/cash/walletLedgerService";
import { StatementService } from "@/application/finance/statementService";
/* المجموعة ١ (فحص سلامة مالي): خدمة قراءة فقط فوق القارئ الكنسي والكشف والمحافظ. */
import { IntegrityCheckService } from "@/application/finance/integrityCheckService";
import { createBrowserLocalStore } from "@/storage/local/createBrowserLocalStore";
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
  transfers: LocalTransferService;
  guidedOpeningImport: GuidedOpeningImportService;
  costEstimates: CostEstimateService;
  partyLedger: PartyLedgerService;
  /* المجموعة ٢ (Scope B): ورقة التحصيل — المصدر الواحد لتحصيل الذمم. */
  collections: CollectionService;
  /* المجموعة ٦ (البند ١): تراجع القبضة مع تخصيصها المطابق بنقطة واحدة ذرّية. */
  collectionReversal: CollectionReversalService;
  /* المجموعة ٢ (§9.1): دفتر المحفظة — قراءة حركات كل محفظة بمصادرها. */
  walletLedger: WalletLedgerService;
  /* المجموعة ٢ (§9.2): كشف الفترة — كاش/نتيجة/أمانات/ذمم/مال المالك. */
  statement: StatementService;
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
  /* S5-08 (المجموعة ٦ — البند ٦): الخدمات والمخزن عناصر بلا حالة — تُنشأ مرة
   * واحدة على مستوى الوحدة (singleton)، وdataVersion يعيد تركيب غلاف السياق
   * الرخيص فقط: هوية السياق تتغير فيلتقط التأثيرات المفتاحة على dataVersion
   * التحديث، وهويات الخدمات الداخلية تبقى مستقرة فلا يُعاد بناء ~35 خدمة عند
   * كل كتابة، ويبقى المخزن واحدًا فوق الاتصال المخزَّن (S5-07). */
  const services = useMemo<PrototypeServices>(
    () => ({ ...singletonServices, dataVersion, notifyDataChanged }),
    [dataVersion, notifyDataChanged],
  );
  return <PrototypeServicesContext.Provider value={services}>{children}</PrototypeServicesContext.Provider>;
}

/* مجموعة الخدمات الواحدة — تُبنى مرة عند تحميل الوحدة. الخدمات كلها بلا حالة
 * (حقول قراءة فقط في منشئاتها) فلا حالة مشتركة تُفسد بين الأسطح. */
function createServices(): Omit<PrototypeServices, "dataVersion" | "notifyDataChanged"> {
  const store = createBrowserLocalStore();
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
    transfers: new LocalTransferService(store),
    guidedOpeningImport: new GuidedOpeningImportService(store),
    costEstimates: new CostEstimateService(store),
    partyLedger: new PartyLedgerService(store),
    collections: new CollectionService(store, fulfillment, directSales, projectFinance),
    collectionReversal: new CollectionReversalService(store, projectFinance),
    walletLedger: new WalletLedgerService(store),
    statement,
    activity,
    integrityCheck: new IntegrityCheckService(store, projectFinance, statement, cashContinuity),
    assets: new AssetService(store),
    loans: new LoanService(store),
    retainedDeposits: new RetainedDepositService(store),
  };
}

const singletonServices = createServices();

export function usePrototypeServices() {
  const context = useContext(PrototypeServicesContext);
  if (!context) throw new Error("usePrototypeServices must be used inside PrototypeServicesProvider");
  return context;
}
