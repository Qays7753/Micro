/** Composition root: React receives application services, never the IndexedDB adapter itself. */
import { createContext, type ReactNode, useContext, useMemo, useState } from "react";
import { DraftService } from "@/application/drafts/draftService";
import { CostService } from "@/application/cost/costService";
import { AgreementService } from "@/application/agreements/agreementService";
import { FulfillmentService } from "@/application/fulfillment/fulfillmentService";
import { LocalTransferService } from "@/application/transfers/localTransferService";
import { PreferenceService } from "@/application/preferences/preferenceService";
import { ProfileService } from "@/application/profile/profileService";
import { FinancialPulseService } from "@/application/financial-pulse/financialPulseService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { DailyFollowUpService } from "@/application/follow-up/dailyFollowUpService";
import { ScheduleService } from "@/application/scheduling/scheduleService";
import { SupplierPurchaseService } from "@/application/suppliers/supplierPurchaseService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { createBrowserLocalStore } from "@/storage/local/createBrowserLocalStore";

type PrototypeServices = { profiles: ProfileService; preferences: PreferenceService; drafts: DraftService; costs: CostService; agreements: AgreementService; financialPulse: FinancialPulseService; projectFinance: ProjectFinancialService; supplierPurchases: SupplierPurchaseService; cashContinuity: CashContinuityService; inventory: InventoryMaterialService; dailyFollowUp: DailyFollowUpService; schedules: ScheduleService; fulfillment: FulfillmentService; transfers: LocalTransferService; dataVersion: number; notifyDataChanged: () => void };
const PrototypeServicesContext = createContext<PrototypeServices | undefined>(undefined);

export function PrototypeServicesProvider({ children }: { children: ReactNode }) {
  const [dataVersion, setDataVersion] = useState(0);
  const services = useMemo(() => {
    const store = createBrowserLocalStore();
    const costs = new CostService(store);
    const schedules = new ScheduleService(store);
    return { profiles: new ProfileService(store), preferences: new PreferenceService(store), drafts: new DraftService(store), costs, agreements: new AgreementService(store, costs), financialPulse: new FinancialPulseService(store), projectFinance: new ProjectFinancialService(store), supplierPurchases: new SupplierPurchaseService(store), cashContinuity: new CashContinuityService(store), inventory: new InventoryMaterialService(store), dailyFollowUp: new DailyFollowUpService(store), schedules, fulfillment: new FulfillmentService(store, undefined, schedules), transfers: new LocalTransferService(store), dataVersion, notifyDataChanged: () => setDataVersion(version => version + 1) };
  }, [dataVersion]);
  return <PrototypeServicesContext.Provider value={services}>{children}</PrototypeServicesContext.Provider>;
}

export function usePrototypeServices() {
  const context = useContext(PrototypeServicesContext);
  if (!context) throw new Error("usePrototypeServices must be used inside PrototypeServicesProvider");
  return context;
}
