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
  answerContactAttempt,
  cancelDeliveryRequest,
  confirmDeliveryOutcome,
  decideDeliveryChange,
  decideDeliveryConsent,
  decideDeliveryQuote,
  fetchBookingDetail,
  proposeDeliveryChange,
  rateDeliveryBooking,
  recordDeliveryInstructions,
  withdrawDeliveryChange,
  type BookingDetail,
} from "@/application/delivery";
import { Button, EmptyState, Field, Notice } from "@/components/primitives";
import { formatLocalDateTime } from "@/presentation/formatters";
import { CONTACT_STATUS_LABELS, deliveryEventLabel } from "@/presentation/deliveryLabels";

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
  undeliverable_declared: "أُبلغ تعذر — لا شيء ينفذ تلقائيًا",
  awaiting_instructions: "بانتظار تعليماتك",
  holding_agreed: "احتفاظ متفق عليه",
  retry_scheduled: "محاولة جديدة مجدولة",
  returning: "قيد الإرجاع",
  return_declared: "أبلغ الإرجاع — أكد وصول الأغراض لجهتها",
};

/** OD10: تسميات أنواع الموافقة — الإرجاع إرجاع أغراض لا استرداد مال. */
const CONSENT_KIND_LABELS: Record<string, string> = {
  retry: "محاولة جديدة",
  holding: "احتفاظ بالأغراض",
  return: "إرجاع الأغراض (لا استرداد مال)",
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
  const { session, signIn, loading: sessionLoading } = useNetworkSession();
  const bookingId = match.replace("/delivery/booking/", "").split("/")[0] ?? "";
  const [data, setData] = useState<BookingDetail | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<{ tone: "neutral" | "error" | "success"; text: string } | null>(
    null,
  );
  const [stars, setStars] = useState(5);
  const [instructionNote, setInstructionNote] = useState("");
  const [changeOpen, setChangeOpen] = useState(false);
  const [changeFare, setChangeFare] = useState("");
  const [changeDate, setChangeDate] = useState("");
  const [changePickupArea, setChangePickupArea] = useState("");
  const [changeDropoffArea, setChangeDropoffArea] = useState("");
  const [changeLoad, setChangeLoad] = useState("");
  const [changeParcels, setChangeParcels] = useState("");
  const [changeCollection, setChangeCollection] = useState("");

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
  const pendingConsent =
    (data?.consentProposals ?? []).find(proposal => proposal.status === "pending") ?? null;
  const pendingChange = (data?.changeProposals ?? []).find(proposal => proposal.status === "pending") ?? null;
  const driverPendingChange =
    pendingChange !== null && pendingChange.proposedBy !== String(data?.requester.id ?? "")
      ? pendingChange
      : null;
  const myPendingChange =
    pendingChange !== null && pendingChange.proposedBy === String(data?.requester.id ?? "")
      ? pendingChange
      : null;
  const agreementPayload = (data?.request.agreementCopy?.payload ?? data?.request.payload ?? {}) as {
    pickup?: { governorate?: string; area?: string };
    dropoff?: { governorate?: string; area?: string };
    schedule?: { date?: string; pickupWindow?: string; dropoffWindow?: string };
    load?: { description?: string; parcels?: number };
  };
  const routeSummary =
    agreementPayload.pickup && agreementPayload.dropoff
      ? `${agreementPayload.pickup.governorate ?? ""} → ${agreementPayload.dropoff.governorate ?? ""}`
      : "—";
  const scheduleSummary = agreementPayload.schedule
    ? `${agreementPayload.schedule.date ?? ""} (استلام ${agreementPayload.schedule.pickupWindow ?? "—"})`
    : "—";
  const loadSummary = agreementPayload.load
    ? `${agreementPayload.load.description ?? ""}${
        agreementPayload.load.parcels ? ` — ${agreementPayload.load.parcels} طرود` : ""
      }`
    : "—";

  return (
    <section className="micro-page micro-booking-detail" data-testid="delivery-booking-detail">
      <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>
        <ArrowRight aria-hidden="true" /> التوصيل
      </button>
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      {state === "loading" ? (
        <p className="micro-route-loading" role="status">
          جارٍ تحميل الحجز…
        </p>
      ) : null}
      {state === "error" ? (
        <EmptyState
          title="الحجز غير متاح"
          description="تحقق من الرابط أو سجل الدخول بحساب صاحب الحجز."
          action={
            !session.authenticated ? (
              <Button action="secondary" onClick={() => signIn(`/delivery/booking/${bookingId}`)}>
                الدخول عبر Google
              </Button>
            ) : undefined
          }
        />
      ) : null}
      {state === "ready" && data && data.viewerRole === "driver" ? (
        <EmptyState
          title="هذا الحجز ليس واجهتك"
          description="أنت داخل بوابة السائق — تفاصيل هذا الحجز من زر «طلباتي» في البوابة."
          action={
            <Button action="secondary" onClick={() => navigate(`/driver/booking/${bookingId}`)}>
              فتح الحجز في بوابة السائق
            </Button>
          }
        />
      ) : null}
      {state === "ready" && request && data && data.viewerRole !== "driver" ? (
        <article>
          <div className="micro-page-heading">
            <span className="micro-overline">حجز {request.id.slice(0, 12)}</span>
            <h1>{STATUS_LABELS[request.status] ?? request.status}</h1>
          </div>

          {request.status === "awaiting_requester_decision" && data.quote ? (
            <section className="micro-quote-box" data-testid="quote-decision">
              <h2>عرض نهائي واحد</h2>
              <p>
                الأجرة: <bdi dir="ltr">{minorToJod(data.quote.fareMinor)}</bdi> د.أ — يشمل: {data.quote.scope}
              </p>
              <p className="micro-quote-expiry">
                صالح حتى {formatLocalDateTime(new Date(data.quote.validUntil).toISOString()) ?? ""} — بعده
                يلزم اتفاق جديد.
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
              {execution.contact === "attempt_no_answer" || execution.contact === "contact_reported" ? (
                <div className="micro-contact-answer" data-testid="contact-answer">
                  <p role="status">{CONTACT_STATUS_LABELS[execution.contact] ?? execution.contact}</p>
                  <div className="micro-form-actions">
                    <Button
                      action="commit"
                      onClick={() =>
                        void act(
                          () => answerContactAttempt(request.id, "confirmed"),
                          "سُجل تأكيدك التواصل مع السائق.",
                        )
                      }
                    >
                      تم التواصل فعلًا
                    </Button>
                    <Button
                      action="outline"
                      onClick={() =>
                        void act(
                          () => answerContactAttempt(request.id, "denied"),
                          "سُجل نفيك التواصل — مسجل بوضوح ولا يلغي شيئًا تلقائيًا.",
                        )
                      }
                    >
                      لم يتم التواصل
                    </Button>
                  </div>
                </div>
              ) : execution.contact !== "not_attempted" ? (
                <p role="status">{CONTACT_STATUS_LABELS[execution.contact] ?? execution.contact}</p>
              ) : null}
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
                  <select
                    aria-label="عدد النجوم"
                    value={stars}
                    onChange={event => setStars(Number(event.target.value))}
                  >
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

              {execution.execution === "undeliverable_declared" && pendingConsent ? (
                <div className="micro-consent-decision" data-testid="consent-decision">
                  <h3>
                    اقتراح السائق ينتظر قرارك الصريح —{" "}
                    {CONSENT_KIND_LABELS[pendingConsent.kind] ?? pendingConsent.kind}
                  </h3>
                  <p className="micro-review-item__meta">
                    الشروط المقترحة: {JSON.stringify(pendingConsent.terms)} — الإرجاع إرجاع أغراض لا استرداد
                    مال.
                  </p>
                  <p role="status">سكوتك أو رفضك لا ينفذان شيئًا تلقائيًا أبدًا؛ الحالة تبقى بانتظار واضح.</p>
                  <div className="micro-form-actions">
                    <Button
                      action="commit"
                      onClick={() =>
                        void act(
                          () => decideDeliveryConsent(request.id, pendingConsent.id, "accept"),
                          "قُبل الاقتراح صراحة — سُجل بفاعل ووقت.",
                        )
                      }
                    >
                      أقبل الاقتراح
                    </Button>
                    <Button
                      action="outline"
                      onClick={() =>
                        void act(
                          () => decideDeliveryConsent(request.id, pendingConsent.id, "reject"),
                          "رُفض الاقتراح — لا تنفيذ تلقائي.",
                        )
                      }
                    >
                      ارفض الاقتراح
                    </Button>
                  </div>
                </div>
              ) : null}
              {execution.execution === "undeliverable_declared" && !pendingConsent ? (
                <Notice tone="info">
                  بعد التعذر: محاولة جديدة أو احتفاظ أو إرجاع تحتاج اقتراحًا من السائق يقبله صاحب المشروع
                  صراحة داخل التطبيق — لا يعلنها طرف واحد ولا تنفذ آليًا (OD10).
                </Notice>
              ) : null}

              {execution.execution === "awaiting_instructions" ? (
                <div className="micro-instructions-box" data-testid="instructions-decision">
                  <h3>تعليماتك للسائق (مسجلة — لا ينتظر النظام بلا نهاية)</h3>
                  <Field label="ملاحظة (اختياري)" controlId="instruction-note">
                    <input
                      id="instruction-note"
                      value={instructionNote}
                      onChange={event => setInstructionNote(event.target.value)}
                    />
                  </Field>
                  <div className="micro-form-actions">
                    <Button
                      action="commit"
                      onClick={() =>
                        void act(
                          () =>
                            recordDeliveryInstructions(request.id, "transit", instructionNote || undefined),
                          "سُجلت تعليماتك: تابع التوصيل.",
                        )
                      }
                    >
                      تعليمات: تابع التوصيل
                    </Button>
                    <Button
                      action="outline"
                      onClick={() =>
                        void act(
                          () =>
                            recordDeliveryInstructions(request.id, "return", instructionNote || undefined),
                          "سُجلت تعليماتك: ابدأ الإرجاع.",
                        )
                      }
                    >
                      تعليمات: ابدأ الإرجاع
                    </Button>
                    <Button
                      action="outline"
                      onClick={() =>
                        void act(
                          () =>
                            recordDeliveryInstructions(request.id, "holding", instructionNote || undefined),
                          "سُجلت تعليماتك: احتفظ بالأغراض.",
                        )
                      }
                    >
                      تعليمات: احتفظ بالأغراض
                    </Button>
                  </div>
                </div>
              ) : null}

              <Button action="quiet" onClick={() => setChangeOpen(open => !open)}>
                {changeOpen ? "إغلاق التعديل المؤثر" : "اقتراح تعديل مؤثر (يحتاج قبول السائق)"}
              </Button>
              {changeOpen ? (
                <div className="micro-change-form" data-testid="change-proposal-form">
                  <p className="micro-review-item__meta">
                    الاتفاق السابق يبقى ساريًا وغير قابل للكتابة فوقه حتى يقبل السائق صراحة؛ يُنشأ عند القبول
                    نسخة اتفاق جديدة وتبقى السابقة في التاريخ (OD11).
                  </p>
                  <Field label="الأجرة الجديدة (د.أ — اتركها فارغة لبلا تغيير)">
                    <input
                      value={changeFare}
                      onChange={event => setChangeFare(event.target.value)}
                      inputMode="decimal"
                    />
                  </Field>
                  <Field label="تاريخ/موعد جديد (نصًا)">
                    <input value={changeDate} onChange={event => setChangeDate(event.target.value)} />
                  </Field>
                  <Field label="منطقة الاستلام (نصًا)">
                    <input
                      value={changePickupArea}
                      onChange={event => setChangePickupArea(event.target.value)}
                    />
                  </Field>
                  <Field label="منطقة التسليم (نصًا)">
                    <input
                      value={changeDropoffArea}
                      onChange={event => setChangeDropoffArea(event.target.value)}
                    />
                  </Field>
                  <Field label="وصف الحمولة الجديد (نصًا)">
                    <input value={changeLoad} onChange={event => setChangeLoad(event.target.value)} />
                  </Field>
                  <Field label="عدد الطرود">
                    <input
                      value={changeParcels}
                      onChange={event => setChangeParcels(event.target.value)}
                      inputMode="numeric"
                    />
                  </Field>
                  <Field label="مبلغ التحصيل الجديد (د.أ — فارغ لبلا تغيير)">
                    <input
                      value={changeCollection}
                      onChange={event => setChangeCollection(event.target.value)}
                      inputMode="decimal"
                    />
                  </Field>
                  <div className="micro-form-actions">
                    <Button
                      action="save"
                      onClick={() => {
                        const changes: Record<string, unknown> = {};
                        const fareText = changeFare.trim();
                        if (fareText !== "") {
                          if (!/^\d{1,9}(\.\d{1,2})?$/.test(fareText)) {
                            setMessage({ tone: "error", text: "أدخل أجرة صحيحة بخانتين عشريتين." });
                            return;
                          }
                          changes.fareMinor = `${Math.round(Number(fareText) * 100)}`;
                        }
                        if (changeDate.trim() !== "") changes.schedule = { date: changeDate.trim() };
                        if (changePickupArea.trim() !== "")
                          changes.pickup = { area: changePickupArea.trim() };
                        if (changeDropoffArea.trim() !== "")
                          changes.dropoff = { area: changeDropoffArea.trim() };
                        if (changeLoad.trim() !== "" || changeParcels.trim() !== "") {
                          const load: Record<string, unknown> = {};
                          if (changeLoad.trim() !== "") load.description = changeLoad.trim();
                          if (changeParcels.trim() !== "") load.parcels = Number(changeParcels.trim());
                          changes.load = load;
                        }
                        const collectionText = changeCollection.trim();
                        if (collectionText !== "") {
                          if (!/^\d{1,9}(\.\d{1,2})?$/.test(collectionText)) {
                            setMessage({ tone: "error", text: "أدخل مبلغ تحصيل صحيحًا بخانتين عشريتين." });
                            return;
                          }
                          changes.collectionMinor = `${Math.round(Number(collectionText) * 100)}`;
                        }
                        if (Object.keys(changes).length === 0) {
                          setMessage({ tone: "error", text: "أدخل قيمة واحدة على الأقل لتعديلها." });
                          return;
                        }
                        void act(async () => {
                          await proposeDeliveryChange(request.id, changes);
                          setChangeOpen(false);
                        }, "أُرسل اقتراح التعديل — ينتظر قبول السائق صراحة.");
                      }}
                    >
                      أرسل الاقتراح
                    </Button>
                    <Button action="quiet" onClick={() => setChangeOpen(false)}>
                      رجوع
                    </Button>
                  </div>
                </div>
              ) : null}
              {myPendingChange ? (
                <div className="micro-change-pending" data-testid="own-change-pending">
                  <p role="status">اقتراح تعديلك ينتظر قبول السائق صراحة — الاتفاق السابق سارٍ حتى قبوله.</p>
                  <Button
                    action="quiet"
                    onClick={() =>
                      void act(
                        () => withdrawDeliveryChange(request.id, myPendingChange.id),
                        "سُحب اقتراح التعديل — لا شيء تغير.",
                      )
                    }
                  >
                    اسحب الاقتراح
                  </Button>
                </div>
              ) : null}
              {driverPendingChange ? (
                <div className="micro-change-decision" data-testid="change-decision">
                  <h3>اقتراح تعديل من السائق — ينتظر قرارك الصريح</h3>
                  <p className="micro-review-item__meta">
                    التغييرات المقترحة:{" "}
                    {JSON.stringify(
                      (driverPendingChange.changes ?? {}).changes ?? driverPendingChange.changes,
                    )}
                  </p>
                  <div className="micro-form-actions">
                    <Button
                      action="commit"
                      onClick={() =>
                        void act(
                          () => decideDeliveryChange(request.id, driverPendingChange.id, "accept"),
                          "قُبل التعديل — نسخة اتفاق جديدة.",
                        )
                      }
                    >
                      أقبل التعديل
                    </Button>
                    <Button
                      action="outline"
                      onClick={() =>
                        void act(
                          () => decideDeliveryChange(request.id, driverPendingChange.id, "reject"),
                          "رُفض التعديل — الاتفاق السابق سارٍ.",
                        )
                      }
                    >
                      ارفض التعديل
                    </Button>
                  </div>
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
            <h2>اتفاق الحجز (نسخة محفوظة — الإصدار v{data.agreementVersion ?? 1})</h2>
            <dl className="micro-market-facts">
              <div>
                <dt>الأجرة</dt>
                <dd>
                  <bdi dir="ltr">{minorToJod(request.offeredFareMinor)}</bdi> د.أ
                </dd>
              </div>
              <div>
                <dt>التحصيل</dt>
                <dd>
                  {request.collectionMinor === null ? (
                    "لا تحصيل"
                  ) : (
                    <>
                      <bdi dir="ltr">{minorToJod(request.collectionMinor)}</bdi> د.أ
                    </>
                  )}
                </dd>
              </div>
              <div>
                <dt>السائق</dt>
                <dd>{String((data.driver.profile as { displayName?: string }).displayName ?? "—")}</dd>
              </div>
              <div>
                <dt>المسار</dt>
                <dd>{routeSummary}</dd>
              </div>
              <div>
                <dt>الموعد</dt>
                <dd>{scheduleSummary}</dd>
              </div>
              <div>
                <dt>الحمولة</dt>
                <dd>{loadSummary}</dd>
              </div>
            </dl>
          </section>

          <section>
            <h2>الخط الزمني</h2>
            <ul className="micro-timeline" data-testid="booking-timeline">
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
