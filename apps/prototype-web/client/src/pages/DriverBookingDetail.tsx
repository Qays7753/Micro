/**
 * تفاصيل الحجز — واجهة السائق (OD01): قراءة الطلب الموجه برقمه وموعده
 * وحمولته ومبلغ التحصيل (OD13) — عناوين التفصيلية محجوبة حتى قرار الإفصاح.
 * الأفعال: قبول الأجرة المعروضة أو عرض نهائي واحد، ثم تصريحات التنفيذ
 * (وصول/استلام/طريق/تسليم/تعذر مع محاولة اتصال موثقة — OD15).
 */
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight } from "lucide-react";
import { useReturnPath } from "@/app/useReturnNavigation";
import { useNetworkSession } from "@/app/useNetworkSession";
import {
  driverAcceptRequest,
  driverDeclare,
  driverDeclineRequest,
  driverSubmitQuote,
  fetchBookingDetail,
  type BookingDetail,
} from "@/application/delivery";
import { Button, EmptyState, Field, Notice } from "@/components/primitives";

const EXECUTION_ACTIONS: Record<string, { label: string; kind: string }[]> = {
  not_started: [{ label: "بدأت التوجه للاستلام", kind: "start" }],
  heading_to_pickup: [{ label: "وصلت لنقطة الاستلام", kind: "arrive" }],
  arrived_at_source: [
    { label: "استلمت الأغراض", kind: "pickup_declared" },
    { label: "تعذر الاستلام", kind: "awaiting_instructions" },
  ],
  picked_up: [{ label: "بدأت الطريق للتسليم", kind: "transit_started" }],
  in_transit: [
    { label: "أبلغت التسليم", kind: "delivery_declared" },
    { label: "سجلت محاولة اتصال دون رد (قبل أي تعذر)", kind: "contact_attempt_no_answer" },
    { label: "تعذر التسليم", kind: "delivery_failed" },
  ],
  undeliverable_declared: [
    { label: "اتفقنا على محاولة جديدة", kind: "retry_agreed" },
    { label: "اتفقنا على احتفاظ", kind: "holding_agreed" },
    { label: "اتفقنا على إرجاع", kind: "return_agreed" },
  ],
  returning: [{ label: "أبلغت الإرجاع", kind: "return_declared" }],
};

function minorToJod(minor: string | null): string {
  if (minor === null) return "—";
  const value = BigInt(minor);
  return `${(value / 100n).toString()}.${(value % 100n).toString().padStart(2, "0")}`;
}

export default function DriverBookingDetail() {
  const [match] = useLocation();
  const [, navigate] = useLocation();
  const returnPath = useReturnPath();
  const { session, signIn, loading: sessionLoading } = useNetworkSession();
  const bookingId = match.replace("/driver/booking/", "").split("/")[0] ?? "";
  const [data, setData] = useState<BookingDetail | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [quoteJod, setQuoteJod] = useState("");
  const [quoteScope, setQuoteScope] = useState("");

  const load = useCallback(async () => {
    setState("loading");
    try {
      setData(await fetchBookingDetail(bookingId));
      setState("ready");
    } catch {
      setState("error");
    }
  }, [bookingId]);

  useEffect(() => {
    if (session.authenticated) void load();
    else if (!sessionLoading) setState("error");
  }, [session.authenticated, sessionLoading, load]);

  const act = async (action: () => Promise<void>, success: string) => {
    try {
      await action();
      setMessage(success);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تنفيذ الفعل.");
    }
  };

  const request = data?.request;
  const execution = data?.execution;
  const actions = execution ? (EXECUTION_ACTIONS[execution.execution] ?? []) : [];

  return (
    <section className="micro-page micro-driver-booking" data-testid="driver-booking-detail">
      <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>
        <ArrowRight aria-hidden="true" /> بوابة السائق
      </button>
      {message ? <Notice tone="neutral">{message}</Notice> : null}
      {state === "error" ? (
        <EmptyState
          title="الطلب غير متاح"
          description={
            session.authenticated
              ? "تحقق من الرابط — لا ترى إلا الطلبات الموجهة إليك."
              : "سجل دخولك بحساب السائق."
          }
          action={
            !session.authenticated ? (
              <Button action="secondary" onClick={() => signIn(`/driver/booking/${bookingId}`)}>
                الدخول عبر Google
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {state === "ready" && request && data && data.viewerRole === "driver" ? (
        <article>
          <div className="micro-page-heading">
            <span className="micro-overline">طلب موجه إليك — {request.id.slice(0, 12)}</span>
            <h1>
              {request.status === "awaiting_driver_response"
                ? "طلب ينتظر ردك (30 دقيقة)"
                : request.status === "confirmed"
                  ? "حجز مؤكد — نفّذ وصرّح"
                  : request.status}
            </h1>
          </div>

          <dl className="micro-market-facts">
            <div>
              <dt>المسار</dt>
              <dd>
                {String((request.payload.pickup as Record<string, unknown> | undefined)?.governorate ?? "—")}{" "}
                ←{" "}
                {String((request.payload.dropoff as Record<string, unknown> | undefined)?.governorate ?? "—")}
              </dd>
            </div>
            <div>
              <dt>الأجرة</dt>
              <dd>{minorToJod(request.offeredFareMinor)} د.أ</dd>
            </div>
            <div>
              <dt>التحصيل (اختياري)</dt>
              <dd>
                {request.collectionMinor === null ? "لا تحصيل" : `${minorToJod(request.collectionMinor)} د.أ`}
              </dd>
            </div>
            <div>
              <dt>صاحب المشروع</dt>
              <dd>{data.requester.displayName}</dd>
            </div>
          </dl>
          <Notice tone="info">
            العناوين وأرقام المستلم التفصيلية محجوبة حتى قرار الإفصاح الموثق — المناطق والمواعيد ظاهرة.
          </Notice>

          {request.status === "awaiting_driver_response" ? (
            <section className="micro-form-actions">
              {request.pricingMode === "prepriced" ? (
                <Button
                  action="commit"
                  onClick={() =>
                    void act(() => driverAcceptRequest(request.id), "قُبلت الأجرة — الحجز مؤكد.")
                  }
                >
                  اقبل الأجرة المعروضة
                </Button>
              ) : (
                <div className="micro-quote-form">
                  <Field label="عرضك النهائي (د.أ — عرض واحد)">
                    <input
                      value={quoteJod}
                      onChange={event => setQuoteJod(event.target.value)}
                      inputMode="decimal"
                    />
                  </Field>
                  <Field label="ما يشمله العرض">
                    <input value={quoteScope} onChange={event => setQuoteScope(event.target.value)} />
                  </Field>
                  <Button
                    action="commit"
                    onClick={() =>
                      void act(async () => {
                        const minor = /^\d+(\.\d{1,2})?$/.test(quoteJod.trim())
                          ? `${Math.round(Number(quoteJod) * 100)}`
                          : null;
                        if (minor === null) throw new Error("أدخل أجرة صحيحة بخانتين عشريتين.");
                        await driverSubmitQuote(request.id, minor, quoteScope || "عرض نهائي");
                      }, "أُرسل العرض النهائي — ينتظر قبول المشروع.")
                    }
                  >
                    أرسل العرض النهائي
                  </Button>
                </div>
              )}
              <Button
                action="outline"
                onClick={() =>
                  void act(() => driverDeclineRequest(request.id), "رُفض الطلب — لا تحويل لسائق آخر.")
                }
              >
                ارفض الطلب
              </Button>
            </section>
          ) : null}

          {request.status === "confirmed" && execution ? (
            <section>
              <h2>التنفيذ والتصريحات</h2>
              <p className="micro-driver-execution">الحالة الحالية: {execution.execution}</p>
              <div className="micro-form-actions">
                {actions.map(action => (
                  <Button
                    key={action.kind}
                    action="save"
                    onClick={() =>
                      void act(() => driverDeclare(request.id, action.kind), `سُجل: ${action.label}`)
                    }
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
              {execution.confirmation === "awaiting_requester_confirmation" ? (
                <Notice tone="info">
                  النتيجة المصرحة تنتظر تأكيد صاحب المشروع — تابع عملك واقبل حجوزات أخرى ضمن قدرتك (OD16).
                </Notice>
              ) : null}
            </section>
          ) : null}

          <section>
            <h2>الخط الزمني</h2>
            <ul className="micro-timeline">
              {data.events.map((event, index) => (
                <li key={index}>
                  {new Date(event.at).toLocaleString("ar-JO")} — {event.axis}: {event.type}
                </li>
              ))}
            </ul>
          </section>
        </article>
      ) : null}
    </section>
  );
}
