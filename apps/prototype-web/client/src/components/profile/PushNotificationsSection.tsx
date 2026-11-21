/**
 * Post-Group 6 Wave 3 (قرار المالك النهائي د-6 2026-11-21 — G09): قسم
 * «التنبيهات» داخل ملف الحساب — Web Push أفضل جهد: محاولة إرسال لا ضمان
 * وصول أبدًا. يطلب إذن المتصفح ويسجّل اشتراك هذا الجهاز على الخادم، ويعرض
 * شرح الآيفون (إضافة التطبيق للشاشة الرئيسية)، وحالات الرفض/عدم التوفر
 * صادقة بلا ادعاء. لا SMS أبدًا (قرار المالك أ-5).
 */
import { BellRing } from "lucide-react";
import { useState } from "react";
import { ApiError, registerPushSubscription } from "@/application/network";
import { Button, Notice } from "@/components/primitives";

type PermissionState = "unknown" | "denied" | "unavailable" | "permission-granted" | "registered";

interface BrowserPushSubscription {
  endpoint: string;
  getKey?: (name: string) => ArrayBuffer | null;
  toJSON?: () => { endpoint?: string; keys?: Record<string, string> };
}

export function PushNotificationsSection() {
  const [state, setState] = useState<PermissionState>("unknown");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enable(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const notification = (globalThis as { Notification?: typeof Notification }).Notification;
      if (notification === undefined) {
        setState("unavailable");
        return;
      }
      const permission = await notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "unavailable");
        return;
      }
      // A REAL browser subscription is registered server-side when one
      // exists; nothing is invented otherwise. Today no push provider is
      // configured (G09 — best-effort only), so the honest outcome is the
      // permission-granted state with in-app notifications as the base.
      const serviceWorker = (globalThis as { serviceWorker?: ServiceWorkerContainer }).serviceWorker;
      const registration = (await serviceWorker?.getRegistration?.()) ?? undefined;
      const existing = (await registration?.pushManager?.getSubscription?.()) as
        BrowserPushSubscription | undefined;
      if (existing !== undefined && typeof existing.endpoint === "string") {
        const json = existing.toJSON?.();
        await registerPushSubscription({
          endpoint: existing.endpoint,
          keys: json?.keys ?? {},
        });
        setState("registered");
        return;
      }
      setState("permission-granted");
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : "تعذر تسجيل التنبيهات على هذا الجهاز — أعد المحاولة.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="micro-profile-section" data-testid="push-notifications-section">
      <h3>
        <BellRing aria-hidden="true" /> التنبيهات
      </h3>
      <p>
        تنبيهات المتصفح (Web Push) محاولة إرسال بلا ضمان وصول — لا نعدك بوصولها أبدًا، والحسم دائمًا داخل
        التطبيق وعلى ساعة الخادم. لا رسائل SMS أبدًا.
      </p>
      {state === "permission-granted" ? (
        <Notice tone="info" data-testid="push-permission-granted">
          مُنح إذن التنبيهات على هذا الجهاز — إرسال التنبيهات خارج التطبيق غير مفعّل بعد لدى مزود الخدمة،
          والإشعار داخل التطبيق هو الأساس دائمًا.
        </Notice>
      ) : null}
      {state === "registered" ? (
        <Notice tone="info" data-testid="push-registered">
          سُجّل هذا الجهاز للتنبيهات — تبقى محاولة إرسال بلا ضمان؛ الإشعار داخل التطبيق هو الأساس دائمًا.
        </Notice>
      ) : null}
      {state === "denied" ? (
        <Notice tone="error" data-testid="push-denied">
          رفضت إذن التنبيهات من المتصفح — يمكنك تمكينه من إعدادات الموقع في المتصفح؛ التطبيق يعمل كاملًا
          بدونه.
        </Notice>
      ) : null}
      {state === "unavailable" ? (
        <Notice tone="neutral" data-testid="push-unavailable">
          هذا المتصفح لا يدعم تنبيهات الويب الآن — التطبيق يعمل كاملًا بدلًا منها بالإشعار الداخلي.
        </Notice>
      ) : null}
      <Notice tone="neutral">
        على الآيفون: أضف التطبيق إلى الشاشة الرئيسية من زر المشاركة في سفاري — تنبيهات الويب تعمل للتطبيقات
        المضافة للشاشة الرئيسية فقط.
      </Notice>
      {state !== "registered" ? (
        <Button action="secondary" loading={busy} onClick={() => void enable()}>
          فعّل تنبيهات هذا الجهاز
        </Button>
      ) : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
    </div>
  );
}
