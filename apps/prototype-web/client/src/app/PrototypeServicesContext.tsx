/** Composition root: React receives application services, never the IndexedDB adapter itself. */
import { createContext, type ReactNode, useContext, useMemo, useState } from "react";
import { DraftService } from "@/application/drafts/draftService";
import { CostService } from "@/application/cost/costService";
import { AgreementService } from "@/application/agreements/agreementService";
import { AgreementContextService } from "@/application/agreements/agreementContextService";
import { FulfillmentService } from "@/application/fulfillment/fulfillmentService";
import { LocalTransferService } from "@/application/transfers/localTransferService";
import { GuidedOpeningImportService } from "@/application/transfers/guidedOpeningImportService";
import { PreferenceService } from "@/application/preferences/preferenceService";
import { ProfileService } from "@/application/profile/profileService";
import { FinancialPulseService } from "@/application/financial-pulse/financialPulseService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
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
import { G5Service } from "@/application/g5/g5Service";
import { createBrowserLocalStore } from "@/storage/local/createBrowserLocalStore";

type PrototypeServices = { profiles: ProfileService; preferences: PreferenceService; actualTime: ActualTimeService; drafts: DraftService; costs: CostService; agreements: AgreementService; agreementContext: AgreementContextService; financialPulse: FinancialPulseService; projectFinance: ProjectFinancialService; ownerEntitlement: OwnerEntitlementService; g5: G5Service; supplierPurchases: SupplierPurchaseService; cashContinuity: CashContinuityService; inventory: InventoryMaterialService; catalog: CatalogService; dailyFollowUp: DailyFollowUpService; homeControlCenter: HomeControlCenterService; schedules: ScheduleService; recurrences: ScheduleRecurrenceService; fulfillment: FulfillmentService; transfers: LocalTransferService; guidedOpeningImport: GuidedOpeningImportService; dataVersion: number; notifyDataChanged: () => void };
const PrototypeServicesContext = createContext<PrototypeServices | undefined>(undefined);

export function PrototypeServicesProvider({ children }: { children: ReactNode }) {
  const [dataVersion, setDataVersion] = useState(0);
  const services = useMemo(() => {
    const store = createBrowserLocalStore();
    const costs = new CostService(store);
    const projectFinance = new ProjectFinancialService(store);
    const ownerEntitlement = new OwnerEntitlementService(store, (from, to) => projectFinance.readRecordedPeriodResult(from, to));
    const g5 = new G5Service(store, projectFinance);
    const schedules = new ScheduleService(store);
    const recurrences = new ScheduleRecurrenceService(store);
    const agreementContext = new AgreementContextService(store);
    const dailyFollowUp = new DailyFollowUpService(store);
    const supplierPurchases = new SupplierPurchaseService(store);
    const inventory = new InventoryMaterialService(store);
    return { profiles: new ProfileService(store), preferences: new PreferenceService(store), actualTime: new ActualTimeService(store), drafts: new DraftService(store), costs, agreements: new AgreementService(store, costs), agreementContext, financialPulse: new FinancialPulseService(store), projectFinance, ownerEntitlement, g5, supplierPurchases, cashContinuity: new CashContinuityService(store), inventory, catalog: new CatalogService(store), dailyFollowUp, homeControlCenter: new HomeControlCenterService(store, dailyFollowUp, projectFinance, supplierPurchases, inventory), schedules, recurrences, fulfillment: new FulfillmentService(store, undefined, schedules), transfers: new LocalTransferService(store), guidedOpeningImport: new GuidedOpeningImportService(store), dataVersion, notifyDataChanged: () => setDataVersion(version => version + 1) };
  }, [dataVersion]);
  return <PrototypeServicesContext.Provider value={services}>{children}</PrototypeServicesContext.Provider>;
}

export function usePrototypeServices() {
  const context = useContext(PrototypeServicesContext);
  if (!context) throw new Error("usePrototypeServices must be used inside PrototypeServicesProvider");
  return context;
}
