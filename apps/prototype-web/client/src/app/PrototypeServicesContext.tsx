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
import { createBrowserLocalStore } from "@/storage/local/createBrowserLocalStore";

type PrototypeServices = { profiles: ProfileService; preferences: PreferenceService; drafts: DraftService; costs: CostService; agreements: AgreementService; financialPulse: FinancialPulseService; fulfillment: FulfillmentService; transfers: LocalTransferService; dataVersion: number; notifyDataChanged: () => void };
const PrototypeServicesContext = createContext<PrototypeServices | undefined>(undefined);

export function PrototypeServicesProvider({ children }: { children: ReactNode }) {
  const [dataVersion, setDataVersion] = useState(0);
  const services = useMemo(() => {
    const store = createBrowserLocalStore();
    const costs = new CostService(store);
    return { profiles: new ProfileService(store), preferences: new PreferenceService(store), drafts: new DraftService(store), costs, agreements: new AgreementService(store, costs), financialPulse: new FinancialPulseService(store), fulfillment: new FulfillmentService(store), transfers: new LocalTransferService(store), dataVersion, notifyDataChanged: () => setDataVersion(version => version + 1) };
  }, [dataVersion]);
  return <PrototypeServicesContext.Provider value={services}>{children}</PrototypeServicesContext.Provider>;
}

export function usePrototypeServices() {
  const context = useContext(PrototypeServicesContext);
  if (!context) throw new Error("usePrototypeServices must be used inside PrototypeServicesProvider");
  return context;
}
