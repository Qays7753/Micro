/**
 * سائقوني والبحث عن سائق (OD03): المحفوظون وسابق التعامل والدليل العام —
 * حفظ السائق لا يمنح حصرية ولا أولوية قبول مضمونة؛ الدعوة للتقديم لا ترسل
 * رسالة تلقائية ولا تمنح اعتمادًا.
 */
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight } from "lucide-react";
import { useReturnPath } from "@/app/useReturnNavigation";
import { useNetworkSession } from "@/app/useNetworkSession";
import {
  fetchDriverDirectory,
  toggleSavedDriver,
  type DriverDirectoryEntryDto,
} from "@/application/delivery";
import { Button, EmptyState, Notice } from "@/components/primitives";

export default function DeliveryDrivers() {
  const [, navigate] = useLocation();
  const returnPath = useReturnPath();
  const { session, signIn } = useNetworkSession();
  const [drivers, setDrivers] = useState<DriverDirectoryEntryDto[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const directory = await fetchDriverDirectory();
      setDrivers(directory.drivers);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="micro-page micro-drivers-page" data-testid="delivery-drivers-page">
      <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>
        <ArrowRight aria-hidden="true" /> التوصيل
      </button>
      <div className="micro-page-heading">
        <h1>سائقوني والبحث عن سائق</h1>
        <p>اختر سائقًا معروف الهوية والمركبة — الترشيح حسب المسار والأهلية، بلا ترتيب مدفوع.</p>
      </div>
      {message ? <Notice tone="neutral">{message}</Notice> : null}
      {!session.authenticated ? (
        <Notice tone="neutral">
          حفظ السائقين والحجز يحتاجان تسجيل الدخول.
          <Button action="quiet" onClick={() => signIn("/delivery/drivers")}>
            الدخول عبر Google
          </Button>
        </Notice>
      ) : null}

      {state === "loading" ? <p>جارٍ التحميل…</p> : null}
      {state === "error" ? (
        <EmptyState
          title="تعذر تحميل دليل السائقين"
          description="أعد المحاولة."
          action={
            <Button action="secondary" onClick={() => void load()}>
              إعادة المحاولة
            </Button>
          }
        />
      ) : null}
      {state === "ready" && drivers.length === 0 ? (
        <EmptyState
          title="لا سائقين معتمدين بعد"
          description="الدليل يعرض السائقين المعتمدين فقط — لا بيانات وهمية. شارك رابط بوابة السائق مع من تعرفه."
        />
      ) : null}

      <ul className="micro-drivers-list" data-testid="drivers-directory">
        {drivers.map(driver => (
          <li key={driver.driverProfileId} className="micro-driver-card">
            <div>
              <strong>{driver.displayName}</strong>
              <p>
                {driver.governorates.join(" · ") || "كل المحافظات"}
                {driver.ratingsCount > 0
                  ? ` — ${driver.averageStars ?? "—"}★ (${driver.ratingsCount} تقييمًا)`
                  : " — جديد: دون تقييمات"}
                {driver.eligibleForNewWork && driver.acceptingNew ? "" : " — لا يستقبل حجوزات جديدة حاليًا"}
              </p>
            </div>
            <div className="micro-driver-card__actions">
              <Button
                action="create"
                disabled={!session.authenticated || !driver.eligibleForNewWork || !driver.acceptingNew}
                onClick={() => navigate(`/delivery/booking/new?driver=${driver.driverProfileId}`)}
              >
                احجز معه
              </Button>
              {session.authenticated ? (
                <Button
                  action="quiet"
                  onClick={async () => {
                    try {
                      const result = await toggleSavedDriver(driver.driverProfileId);
                      setMessage(result.saved ? "حُفظ السائق في سائقوني." : "أُلغي حفظ السائق.");
                    } catch (error) {
                      setMessage(error instanceof Error ? error.message : "تعذر الحفظ.");
                    }
                  }}
                >
                  حفظ / إلغاء الحفظ
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
