/** Local boot gate: load the activity profile once and route a first-time owner to minimal setup. */
import { type ReactNode, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";

export const isPublicLocalRecoveryRoute = (path: string) => path === "/setup" || path === "/settings";

export function StartupGate({ children }: { children: ReactNode }) {
  const { profiles, dataVersion } = usePrototypeServices();
  const [location, navigate] = useLocation();
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    let active = true;
    profiles.load().then(result => {
      if (!active) return;
      if (!result.ok) { setState("error"); return; }
      if (!result.value && !isPublicLocalRecoveryRoute(location)) navigate("/setup", { replace: true });
      setState("ready");
    });
    return () => { active = false; };
  }, [dataVersion, location, navigate, profiles]);
  if (state === "loading") return <div className="micro-route-loading" role="status" aria-live="polite">جارٍ فتح مشروعك المحلي…</div>;
  if (state === "error") return <div className="micro-storage-error" role="alert"><strong>تعذر فتح البيانات المحلية.</strong><p>لم يتم تغيير شيء. أعد فتح التطبيق، ثم تحقق من مساحة التخزين في المتصفح.</p><button type="button" className="micro-button micro-button-secondary" onClick={() => window.location.reload()}>إعادة المحاولة</button></div>;
  return <>{children}</>;
}
