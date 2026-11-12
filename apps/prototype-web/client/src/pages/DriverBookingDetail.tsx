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
  declareCollection,
  driverAcceptRequest,
  driverDeclare,
  driverDeclineRequest,
  driverSubmitQuote,
  fetchBookingDetail,
  submitDriverStatement,
  type BookingDetail,
} from "@/application/delivery";
import { Button, EmptyState, Field, Notice } from "@/components/primitives";
import { formatLocalDateTime } from "@/presentation/formatters";
import { DRIVER_EXECUTION_STATUS_LABELS, deliveryEventLabel } from "@/presentation/deliveryLabels";
import { normalizeAsciiDigits } from "@/application/input";

const EXECUTION_ACTIONS: Record<string, { label: string; kind: string; needsReason?: boolean }[]> = {
  not_started: [{ label: "بدأت التوجه للاستلام", kind: "start" }],
  heading_to_pickup: [{ label: "وصلت لنقطة الاستلام", kind: "arrive" }],
  arrived_at_source: [
    { label: "استلمت الأغراض", kind: "pickup_declared" },
    { label: "تواصلت مع صاحب المشروع وتم الاتصال", kind: "contact_reported" },
    { label: "تعذر الاستلام", kind: "pickup_failed", needsReason: true },
  ],
  picked_up: [{ label: "بدأت الطريق للتسليم", kind: "transit_started" }],
  in_transit: [
    { label: "أبلغت التسليم", kind: "delivery_declared" },
    { label: "سجلت محاولة اتصال دون رد (قبل أي تعذر)", kind: "contact_attempt_no_answer" },
    { label: "تواصلت مع صاحب المشروع وتم الاتصال", kind: "contact_reported" },
    { label: "تعذر التسليم", kind: "delivery_failed", needsReason: true },
  ],
  undeliverable_declared: [
    { label: "اتفقنا على محاولة جديدة", kind: "retry_agreed" },
    { label: "اتفقنا على احتفاظ", kind: "holding_agreed" },
    { label: "اتفقنا على إرجاع", kind: "return_agreed" },
  ],
  retry_scheduled: [
    { label: "بدأت محاولة الاستلام من جديد", kind: "retry_started_pickup" },
    { label: "بدأت الطريق مباشرة (الأغراض معي)", kind: "retry_started_transit" },
  ],
  holding_agreed: [
    { label: "بدأت الإرجاع", kind: "return_started" },
    { label: "استأنفت الطريق للتسليم", kind: "transit_resumed" },
  ],
  awaiting_instructions: [
    { label: "تعليمات: تابع التوصيل", kind: "instructions_transit" },
    { label: "تعليمات: ابدأ الإرجاع", kind: "instructions_return" },
    { label: "تعليمات: احتفظ بالأغراض", kind: "instructions_holding" },
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
  const [message, setMessage] = useState<{ tone: "neutral" | "error" | "success"; text: string } | null>(
    null,
  );
  const [quoteJod, setQuoteJod] = useState("");
  const [quoteScope, setQuoteScope] = useState("");
  const [failureReason, setFailureReason] = useState("");
  const [collectionJod, setCollectionJod] = useState("");
  const [statementDescription, setStatementDescription] = useState("");

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
      setMessage({ tone: "success", text: success });
      await load();
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "تعذر تنفيذ الفعل.",
      });
    }
  };

  const request = data?.request;
  const execution = data?.execution;
  const actions = execution ? (EXECUTION_ACTIONS[execution.execution] ?? []) : [];
  /* The daily statement needs the requester's network id; the driver view of
   * the detail carries it on the requester object. */
  const requesterIdentityId = String((data?.requester as unknown as { id?: string } | undefined)?.id ?? "");

  return (
    <section className="micro-page micro-driver-booking" data-testid="driver-booking-detail">
      <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>
        <ArrowRight aria-hidden="true" /> بوابة السائق
      </button>
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
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

      {state === "loading" ? (
        <p className="micro-route-loading" role="status">
          جارٍ تحميل الطلب…
        </p>
      ) : null}
      {state === "ready" && data && data.viewerRole !== "driver" ? (
        <EmptyState
          title="هذا الحجز ليس واجهتك"
          description="هذه تفاصيل واجهة السائق — افتح الحجز من واجهة المشروع."
          action={
            <Button action="secondary" onClick={() => navigate(`/delivery/booking/${bookingId}`)}>
              فتح الحجز في واجهة المشروع
            </Button>
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
              <p className="micro-driver-execution">
                الحالة الحالية: {DRIVER_EXECUTION_STATUS_LABELS[execution.execution] ?? execution.execution}
              </p>
              <div className="micro-form-actions">
                {actions.map(action =>
                  action.needsReason ? (
                    <div key={action.kind} className="micro-failure-declare">
                      <Field
                        label={`سبب «${action.label}» (مطلوب — يُسجل ويظهر للطرفين)`}
                        controlId="failure-reason"
                      >
                        <input
                          id="failure-reason"
                          value={failureReason}
                          onChange={event => setFailureReason(event.target.value)}
                          placeholder="مثال: لا أحد في العنوان بعد محاولة الاتصال"
                        />
                      </Field>
                      <Button
                        action="destructive"
                        disabled={failureReason.trim().length === 0}
                        onClick={() =>
                          void act(async () => {
                            await driverDeclare(request.id, action.kind, failureReason.trim());
                            setFailureReason("");
                          }, `سُجل: ${action.label}`)
                        }
                      >
                        {action.label}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      key={action.kind}
                      action="save"
                      onClick={() =>
                        void act(() => driverDeclare(request.id, action.kind), `سُجل: ${action.label}`)
                      }
                    >
                      {action.label}
                    </Button>
                  ),
                )}
              </div>
              {request.collectionMinor !== null && execution.money === "agreed" ? (
                <div className="micro-collection-declare">
                  <h3>صرّح بما قبضته فعلًا (تسجيل فقط — لا محفظة ولا تحويل)</h3>
                  <Field label="المبلغ المقبوض (د.أ)" controlId="collection-declared">
                    <input
                      id="collection-declared"
                      value={collectionJod}
                      onChange={event => setCollectionJod(event.target.value)}
                      inputMode="decimal"
                    />
                  </Field>
                  <Button
                    action="save"
                    onClick={() =>
                      void act(async () => {
                        const text = normalizeAsciiDigits(collectionJod.trim());
                        const minor = /^\d+(\.\d{1,2})?$/.test(text)
                          ? `${Math.round(Number(text) * 100)}`
                          : null;
                        if (minor === null) throw new Error("أدخل مبلغًا صحيحًا بخانتين عشريتين.");
                        await declareCollection(request.id, minor);
                        setCollectionJod("");
                      }, "سُجل التصريح بالتحصيل.")
                    }
                  >
                    سجّل التصريح
                  </Button>
                </div>
              ) : null}
              {request.collectionMinor !== null &&
              ["agreed", "collection_declared"].includes(execution.money) ? (
                <div className="micro-statement-item">
                  <h3>أرسل بند كشف اليوم لهذا الحجز (كامل التأكيد فقط — لا تسوية جزئية)</h3>
                  <Field label="وصف البند" controlId="statement-description">
                    <input
                      id="statement-description"
                      value={statementDescription}
                      onChange={event => setStatementDescription(event.target.value)}
                      placeholder={`مثال: تحصيل ${minorToJod(request.collectionMinor)} د.أ عن هذا الحجز`}
                    />
                  </Field>
                  <Field label="قيمة البند (د.أ)" controlId="statement-amount">
                    <input
                      id="statement-amount"
                      value={collectionJod}
                      onChange={event => setCollectionJod(event.target.value)}
                      inputMode="decimal"
                    />
                  </Field>
                  <Button
                    action="save"
                    onClick={() =>
                      void act(async () => {
                        const text = normalizeAsciiDigits(collectionJod.trim());
                        const minor = /^\d+(\.\d{1,2})?$/.test(text)
                          ? `${Math.round(Number(text) * 100)}`
                          : null;
                        if (minor === null) throw new Error("أدخل قيمة صحيحة بخانتين عشريتين.");
                        if (statementDescription.trim().length === 0)
                          throw new Error("اكتب وصفًا قصيرًا للبند.");
                        await submitDriverStatement({
                          requesterIdentityId,
                          items: [
                            {
                              requestId: request.id,
                              description: statementDescription.trim(),
                              amountMinor: minor,
                            },
                          ],
                        });
                        setStatementDescription("");
                        setCollectionJod("");
                      }, "أُرسل بند الكشف — ينتظر تأكيد المشروع كاملًا.")
                    }
                  >
                    أرسل بند الكشف
                  </Button>
                </div>
              ) : null}
              {execution.confirmation === "awaiting_requester_confirmation" ? (
                <Notice tone="info">
                  النتيجة المصرحة تنتظر تأكيد صاحب المشروع — لا إغلاق تلقائيًا أبدًا؛ تابع عملك واقبل ما يناسب
                  قدرتك.
                </Notice>
              ) : null}
            </section>
          ) : null}

          <section>
            <h2>الخط الزمني</h2>
            <ul className="micro-timeline">
              {data.events.map((event, index) => (
                <li key={index}>
                  {formatLocalDateTime(new Date(event.at).toISOString()) ?? ""} —{" "}
                  {deliveryEventLabel(event.axis, event.type)}
                </li>
              ))}
            </ul>
          </section>
        </article>
      ) : null}
    </section>
  );
}
