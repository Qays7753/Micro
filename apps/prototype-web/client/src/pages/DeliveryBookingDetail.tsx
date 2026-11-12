/**
 * تفاصيل الحجز — واجهة صاحب المشروع: الحقيقة نفسها بأفعال الطرف المالك —
 * قبول/رفض العرض النهائي، تأكيد النتيجة أو الاعتراض، التقييم بعد تأكيد
 * التوصيل، وخط زمني للأحداث. صمتك لا يغلق شيئًا أبدًا (OD16).
 */
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight } from "lucide-react";
import { useReturnPath } from "@/app/useReturnNavigation";
import { useNetworkSession } from "@/app/useNetworkSession";
import {
  cancelDeliveryRequest,
  confirmDeliveryOutcome,
  decideDeliveryQuote,
  fetchBookingDetail,
  rateDeliveryBooking,
  type BookingDetail,
} from "@/application/delivery";
import { Button, EmptyState, Notice } from "@/components/primitives";

const STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  awaiting_driver_response: "بانتظار قبول السائق",
  awaiting_requester_decision: "بانتظار موافقتك على العرض",
  confirmed: "الحجز مؤكد",
  driver_declined: "رفضه السائق — اختر بديلًا أو عدّل الموعد",
  quote_rejected: "رفضتَ العرض",
  withdrawn: "مسحوب",
  response_expired: "انتهت مهلة الرد — لا تحويل تلقائي لسائق آخر",
  cancelled: "ملغى",
};

const EXECUTION_LABELS: Record<string, string> = {
  not_started: "لم يبدأ",
  heading_to_pickup: "باتجاه الاستلام",
  arrived_at_source: "وصل للمصدر",
  picked_up: "استلم الأغراض",
  in_transit: "قيد التوصيل",
  delivered_declared: "السائق أبلغ التسليم — بانتظار تأكيدك",
  undeliverable_declared: "أُبلغ تعذر",
  awaiting_instructions: "بانتظار تعليماتك",
  holding_agreed: "احتفاظ متفق عليه",
  retry_scheduled: "محاولة جديدة مجدولة",
  returning: "قيد الإرجاع",
  return_declared: "أبلغ الإرجاع — أكد وصول الأغراض لجهتها",
};

function minorToJod(minor: string | null): string {
  if (minor === null) return "—";
  const value = BigInt(minor);
  return `${(value / 100n).toString()}.${(value % 100n).toString().padStart(2, "0")}`;
}

export default function DeliveryBookingDetail() {
  const [match] = useLocation();
  const [, navigate] = useLocation();
  const returnPath = useReturnPath();
  const { session, loading: sessionLoading } = useNetworkSession();
  const bookingId = match.replace("/delivery/booking/", "").split("/")[0] ?? "";
  const [data, setData] = useState<BookingDetail | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [stars, setStars] = useState(5);

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

  return (
    <section className="micro-page micro-booking-detail" data-testid="delivery-booking-detail">
      <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>
        <ArrowRight aria-hidden="true" /> التوصيل
      </button>
      {message ? <Notice tone="neutral">{message}</Notice> : null}
      {state === "error" ? (
        <EmptyState title="الحجز غير متاح" description="تحقق من الرابط أو سجل الدخول بحساب صاحب الحجز." />
      ) : null}
      {state === "ready" && request && data ? (
        <article>
          <div className="micro-page-heading">
            <span className="micro-overline">حجز {request.id.slice(0, 12)}</span>
            <h1>{STATUS_LABELS[request.status] ?? request.status}</h1>
          </div>

          {request.status === "awaiting_requester_decision" && data.quote ? (
            <section className="micro-quote-box" data-testid="quote-decision">
              <h2>عرض نهائي واحد (OD05)</h2>
              <p>
                الأجرة: {minorToJod(data.quote.fareMinor)} د.أ — يشمل: {data.quote.scope}
              </p>
              <p className="micro-quote-expiry">
                صالح حتى {new Date(data.quote.validUntil).toLocaleTimeString("ar-JO")} — بعده يلزم اتفاق جديد.
              </p>
              <div className="micro-form-actions">
                <Button
                  action="commit"
                  onClick={() =>
                    void act(() => decideDeliveryQuote(request.id, true), "قُبل العرض — الحجز مؤكد.")
                  }
                >
                  قبول العرض
                </Button>
                <Button
                  action="outline"
                  onClick={() =>
                    void act(() => decideDeliveryQuote(request.id, false), "رُفض العرض — لا بديل تلقائي.")
                  }
                >
                  رفض العرض
                </Button>
              </div>
            </section>
          ) : null}

          {request.status === "confirmed" && execution ? (
            <section>
              <h2>التنفيذ</h2>
              <p>{EXECUTION_LABELS[execution.execution] ?? execution.execution}</p>
              {execution.confirmation === "awaiting_requester_confirmation" ? (
                <div className="micro-form-actions" data-testid="outcome-decision">
                  <Button
                    action="commit"
                    onClick={() => void act(() => confirmDeliveryOutcome(request.id, true), "أُكدت النتيجة.")}
                  >
                    أؤكد اكتمال التوصيل
                  </Button>
                  <Button
                    action="destructive"
                    onClick={() =>
                      void act(
                        () => confirmDeliveryOutcome(request.id, false),
                        "سُجل الاعتراض — يبقى السجل مفتوحًا.",
                      )
                    }
                  >
                    في مشكلة
                  </Button>
                </div>
              ) : null}
              {execution.confirmation === "confirmed_by_requester" &&
              execution.execution === "delivered_declared" ? (
                <div className="micro-rating-box" data-testid="rating-box">
                  <h3>قيّم السائق (نجوم فورية — التعليق ينتظر المراجعة)</h3>
                  <select value={stars} onChange={event => setStars(Number(event.target.value))}>
                    {[5, 4, 3, 2, 1].map(value => (
                      <option key={value} value={value}>
                        {value} نجوم
                      </option>
                    ))}
                  </select>
                  <Button
                    action="save"
                    onClick={() =>
                      void act(
                        () => rateDeliveryBooking(request.id, stars),
                        "سُجل التقييم — مرة واحدة لا تتكرر.",
                      )
                    }
                  >
                    سجّل التقييم
                  </Button>
                </div>
              ) : null}
              <Button
                action="quiet"
                onClick={() =>
                  void act(() => cancelDeliveryRequest(request.id), "أُلغي الحجز وفق شروط السائق المحفوظة.")
                }
              >
                إلغاء الحجز (بشروط السائق المحفوظة)
              </Button>
            </section>
          ) : null}

          <section>
            <h2>اتفاق الحجز (نسخة محفوظة — OD11)</h2>
            <dl className="micro-market-facts">
              <div>
                <dt>الأجرة</dt>
                <dd>{minorToJod(request.offeredFareMinor)} د.أ</dd>
              </div>
              <div>
                <dt>التحصيل</dt>
                <dd>
                  {request.collectionMinor === null
                    ? "لا تحصيل"
                    : `${minorToJod(request.collectionMinor)} د.أ`}
                </dd>
              </div>
              <div>
                <dt>السائق</dt>
                <dd>{String((data.driver.profile as { displayName?: string }).displayName ?? "—")}</dd>
              </div>
            </dl>
          </section>

          <section>
            <h2>الخط الزمني</h2>
            <ul className="micro-timeline" data-testid="booking-timeline">
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
