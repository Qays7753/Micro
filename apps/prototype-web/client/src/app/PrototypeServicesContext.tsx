/** Composition root: React receives application services, never the IndexedDB adapter itself. */
import { createContext, type ReactNode, useContext, useMemo, useState } from "react";
import { DraftService } from "@/application/drafts/draftService";
import { CostService } from "@/application/cost/costService";
import { ProfileService } from "@/application/profile/profileService";
import { createBrowserLocalStore } from "@/storage/local/createBrowserLocalStore";

type PrototypeServices = { profiles: ProfileService; drafts: DraftService; costs: CostService; dataVersion: number; notifyDataChanged: () => void };
const PrototypeServicesContext = createContext<PrototypeServices | undefined>(undefined);

export function PrototypeServicesProvider({ children }: { children: ReactNode }) {
  const [dataVersion, setDataVersion] = useState(0);
  const services = useMemo(() => {
    const store = createBrowserLocalStore();
    return { profiles: new ProfileService(store), drafts: new DraftService(store), costs: new CostService(store), dataVersion, notifyDataChanged: () => setDataVersion(version => version + 1) };
  }, [dataVersion]);
  return <PrototypeServicesContext.Provider value={services}>{children}</PrototypeServicesContext.Provider>;
}

export function usePrototypeServices() {
  const context = useContext(PrototypeServicesContext);
  if (!context) throw new Error("usePrototypeServices must be used inside PrototypeServicesProvider");
  return context;
}
