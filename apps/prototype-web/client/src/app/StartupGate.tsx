/** Local boot gate: load the activity profile once and route a first-time owner to minimal setup. */
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { Button } from "@/components/primitives";
import { requestPersistentStorage } from "@/storage/local/persistentStorage";
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

export function StartupGate({ children, onSettled }: { children: ReactNode; onSettled?: () => void }) {
  const { profiles, ownerProfile, dataVersion } = usePrototypeServices();
  const [location, navigate] = useLocation();
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [storageFailure, setStorageFailure] = useState<StorageFailure | null>(null);
  /* W3 (brand launch splash): one-shot signal that the existing readiness state has settled
   * (ready OR recovery) — additive only; the gate's own boot behavior is unchanged. */
  const settledRef = useRef(false);
  useEffect(() => {
    if (state === "loading" || settledRef.current) return;
    settledRef.current = true;
    onSettled?.();
  }, [state, onSettled]);
  // P-01 الطبقة 0: يُطلب الدوام مرة عند الإقلاع. نتيجته لا تعطل الإقلاع ولا
  // تُخزَّن؛ تُقرأ حيّة في الإعدادات، فلا schema ولا export يتغيران.
  useEffect(() => {
    void requestPersistentStorage();
  }, []);
  useEffect(() => {
    /* S5-09: إقلاع واحد لكل جلسة — كانت الطبقة تعيد قراءة الملف مع كل تغيير مسار
     * وكل dataVersion (فتح IndexedDB إضافي بلا فائدة). مسار الخطأ يبقي إعادة
     * المحاولة حية، والإقلاع الأول يفعل كل شيء كما كان. */
    if (state === "ready") return;
    let active = true;
    profiles.load().then(result => {
      if (!active) return;
      if (!result.ok) {
        setStorageFailure(result);
        setState("error");
        return;
      }
      if (!result.value && !isPublicLocalRecoveryRoute(location)) navigate("/setup", { replace: true });
      /* المجموعة ١ (ملف المالك): بعد وجود المشروع تُضمن هوية مالك محلية ثابتة —
       * إنشاء مرة واحدة ثم قراءة؛ فشلها لا يعطل الإقلاع ولا يغير بيانات قائمة. */
      if (result.value) void ownerProfile.ensureLocal();
      setState("ready");
    });
    return () => {
      active = false;
    };
  }, [dataVersion, location, navigate, ownerProfile, profiles, state]);
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
        {/* W2 (completion): إعادة المحاولة = صنف الحفظ (سابقة رحلة الرئيسية
         * المعتمدة في W4 — نفس فعل window.location.reload)؛ يكسب الزر عقد
         * المكوّن الأولي: 48px، تركيز مرئي، منع التكرار. */}
        <Button action="save" onClick={() => window.location.reload()}>
          إعادة المحاولة
        </Button>
      </div>
    );
  }
  return <>{children}</>;
}
