/** Local boot gate: load the activity profile once and route a first-time owner to minimal setup. */
import { type ReactNode, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import type { StorageFailure } from "@/storage/local/types";

export const isPublicLocalRecoveryRoute = (path: string) => path === "/setup" || path === "/settings";

export function storageRecoveryCopy(failure: StorageFailure): { title: string; description: string } {
  switch (failure.code) {
    case "storage_blocked":
      return {
        title: "Micro مفتوح في نافذة أخرى.",
        description: "أغلق النوافذ الأخرى ثم أعد المحاولة. لم يتم تغيير بياناتك.",
      };
    case "storage_upgrade_failed":
      return {
        title: "تعذر ترقية التخزين المحلي بأمان.",
        description: "أغلق النسخ الأخرى ثم أعد المحاولة. لا تستخدم هذه النسخة لإدخال بيانات جديدة.",
      };
    case "storage_stale":
      return {
        title: "هذه النسخة من Micro قديمة.",
        description: "أعد تحميل التطبيق قبل إدخال بيانات جديدة. لم يتم تغيير بياناتك.",
      };
    default:
      return {
        title: "تعذر فتح البيانات المحلية.",
        description: "لم يتم تغيير شيء. أعد فتح التطبيق، ثم تحقق من مساحة التخزين في المتصفح.",
      };
  }
}

export function StartupGate({ children }: { children: ReactNode }) {
  const { profiles, dataVersion } = usePrototypeServices();
  const [location, navigate] = useLocation();
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [storageFailure, setStorageFailure] = useState<StorageFailure | null>(null);
  useEffect(() => {
    let active = true;
    profiles.load().then(result => {
      if (!active) return;
      if (!result.ok) {
        setStorageFailure(result);
        setState("error");
        return;
      }
      if (!result.value && !isPublicLocalRecoveryRoute(location)) navigate("/setup", { replace: true });
      setState("ready");
    });
    return () => {
      active = false;
    };
  }, [dataVersion, location, navigate, profiles]);
  if (state === "loading")
    return (
      <div className="micro-route-loading" role="status" aria-live="polite">
        جارٍ فتح مشروعك المحلي…
      </div>
    );
  if (state === "error") {
    const copy = storageRecoveryCopy(storageFailure ?? { ok: false, code: "storage_error", message: "" });
    return (
      <div className="micro-storage-error" role="alert">
        <strong>{copy.title}</strong>
        <p>{copy.description}</p>
        <button
          type="button"
          className="micro-button micro-button-secondary"
          onClick={() => window.location.reload()}
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }
  return <>{children}</>;
}
