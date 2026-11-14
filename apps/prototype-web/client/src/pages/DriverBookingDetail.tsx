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
  decideDeliveryChange,
  driverAcceptRequest,
  driverDeclare,
  driverDeclineRequest,
  driverSubmitQuote,
  fetchBookingDetail,
  proposeDeliveryChange,
  proposeDeliveryConsent,
  submitDriverStatement,
  withdrawDeliveryChange,
  withdrawDeliveryConsent,
  type BookingDetail,
} from "@/application/delivery";
import { Button, EmptyState, Field, Notice } from "@/components/primitives";
import { formatLocalDateTime } from "@/presentation/formatters";
import {
  DRIVER_EXECUTION_STATUS_LABELS,
  DRIVER_REQUEST_STATUS_LABELS,
  UNKNOWN_STATUS_LABEL,
  changeFieldRows,
  deliveryEventLabel,
} from "@/presentation/deliveryLabels";
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
  // undeliverable_declared: NO driver declarations here anymore (OD10) — the
  // driver PROPOSES retry/holding/return and the requester explicitly
  // accepts; see the consent proposal panel below.
  retry_scheduled: [
    { label: "بدأت محاولة الاستلام من جديد", kind: "retry_started_pickup" },
    { label: "بدأت الطريق مباشرة (الأغراض معي)", kind: "retry_started_transit" },
  ],
  holding_agreed: [
    { label: "بدأت الإرجاع", kind: "return_started" },
    { label: "استأنفت الطريق للتسليم", kind: "transit_resumed" },
  ],
  // awaiting_instructions: the REQUESTER records instructions from his
  // surface (contract 21 §3.2-3 actor) — the driver only waits here.
  returning: [{ label: "أبلغت الإرجاع", kind: "return_declared" }],
};

function minorToJod(minor: string | null): string {
  if (minor === null) return "—";
  const value = BigInt(minor);
  return `${(value / 100n).toString()}.${(value % 100n).toString().padStart(2, "0")}`;
}

/* Stage C (S13 — أمر المالك 2026-11-14): صفوف عربية مسماة لشروط الموافقة
 * وتغييرات التعديل المؤثر — يعاد استخدامها في عرض قرار كل طرف؛ المبالغ
 * تُعزل بـ bdi من العرض. */
function labeledRowsList(rows: { label: string; value: string; money?: boolean }[]) {
  return rows.map(row => (
    <li key={row.label}>
      {row.label}:{" "}
      {row.money ? (
        <>
          <bdi dir="ltr">{row.value}</bdi> د.أ
        </>
      ) : (
        row.value
      )}
    </li>
  ));
}

export default function DriverBookingDetail() {
  const [match] = useLocation();
  const [, navigate] = useLocation();
  const returnPath = useReturnPath();
  /* S12/F-15 (Stage C — أمر المالك 2026-11-14): تعذّر التحقق حالة مستقلة
   * قبل أي بوابة — انقطاع الشبكة لا يُعرض كأنه «الطلب غير متاح» أبدًا. */
  const { session, signIn, loading: sessionLoading, failed: sessionFailed, refresh } = useNetworkSession();
  const bookingId = match.replace("/driver/booking/", "").split("/")[0] ?? "";
  const [data, setData] = useState<BookingDetail | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<{ tone: "neutral" | "error" | "success"; text: string } | null>(
    null,
  );
  /* Stage C (S13/R4): فعل واحد قيد التنفيذ في أي لحظة — الزر لا يُعاد
   * إطلاقه أثناء انتظار الخادم (مفتاح idempotency جديد لكل استدعاء). */
  const [pendingAction, setPendingAction] = useState(false);
  const [quoteJod, setQuoteJod] = useState("");
  const [quoteScope, setQuoteScope] = useState("");
  const [failureReason, setFailureReason] = useState("");
  /* Stage C (S13/R4-17): مبلغ التصريح بالتحصيل وقيمة بند الكشف حقلتان
   * مستقلتان — كانا يتشاركان حالة واحدة فتُمسح إحداهما بمسح الأخرى. */
  const [collectionJod, setCollectionJod] = useState("");
  const [statementAmountJod, setStatementAmountJod] = useState("");
  const [statementDescription, setStatementDescription] = useState("");
  /* OD10: نموذج اقتراح الموافقة (retry/holding/return) — لا يعلنها السائق
   * وحده أبدًا؛ تقترح وتقبل صراحة من الطرف الآخر. */
  const [consentKind, setConsentKind] = useState<"retry" | "holding" | "return">("retry");
  const [consentAttempts, setConsentAttempts] = useState("1");
  const [consentPrice, setConsentPrice] = useState("");
  const [consentDuration, setConsentDuration] = useState("");
  const [consentPlace, setConsentPlace] = useState("");
  const [consentCost, setConsentCost] = useState("");
  const [consentDestination, setConsentDestination] = useState<"requester" | "original_supplier">(
    "requester",
  );
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

  /* Stage C (S13/R4-1): حارس الفعل الواحد — قيد التنفيذ يُعلن ويُمنع
   * الإطلاق المزدوج؛ الرسالة الصادقة تبقى كما هي. */
  const act = async (action: () => Promise<void>, success: string) => {
    if (pendingAction) return;
    setPendingAction(true);
    try {
      await action();
      setMessage({ tone: "success", text: success });
      await load();
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "تعذر تنفيذ الفعل.",
      });
    } finally {
      setPendingAction(false);
    }
  };

  const request = data?.request;
  const execution = data?.execution;
  const actions = execution ? (EXECUTION_ACTIONS[execution.execution] ?? []) : [];
  const pendingConsent =
    (data?.consentProposals ?? []).find(proposal => proposal.status === "pending") ?? null;
  const pendingChange = (data?.changeProposals ?? []).find(proposal => proposal.status === "pending") ?? null;
  const requesterPendingChange =
    pendingChange !== null && pendingChange.proposedBy === String(data?.requester.id ?? "")
      ? pendingChange
      : null;
  const myPendingChange =
    pendingChange !== null && pendingChange.proposedBy !== String(data?.requester.id ?? "")
      ? pendingChange
      : null;
  /* The daily statement needs the requester's network id; the driver view of
   * the detail carries it on the requester object. */
  const requesterIdentityId = String((data?.requester as unknown as { id?: string } | undefined)?.id ?? "");

  return (
    <section className="micro-page micro-driver-booking" data-testid="driver-booking-detail">
      <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>
        <ArrowRight aria-hidden="true" /> بوابة السائق
      </button>
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      {/* S12/F-15 (Stage C): انقطاع التحقق حالة مستقلة صادقة مع إعادة محاولة —
          لا يُعرض أبدًا كأنه «غير متاح» أو «غير مسجل». */}
      {!sessionLoading && sessionFailed ? (
        <EmptyState
          title="تعذر التحقق من جلستك الآن"
          description="انقطاع الشبكة لا يعني أن الطلب اختفى ولا أنك غير مسجل. تحقق من اتصالك ثم أعد المحاولة."
          action={
            <Button action="secondary" onClick={() => void refresh()}>
              إعادة المحاولة
            </Button>
          }
        />
      ) : null}
      {state === "error" && !(!sessionLoading && sessionFailed) ? (
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
            ) : (
              <Button action="secondary" onClick={() => void load()}>
                إعادة المحاولة
              </Button>
            )
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
            {/* Stage C (S13): المعرف الخام لا يُعرض مقطوعًا في الترويسة —
                مرجع الدعم الكامل المعزول بـ bdi أسفل الصفحة. */}
            <span className="micro-overline">طلب توصيل موجه إليك</span>
            <h1>
              {request.status === "awaiting_driver_response"
                ? "طلب ينتظر ردك (30 دقيقة)"
                : (DRIVER_REQUEST_STATUS_LABELS[request.status] ?? UNKNOWN_STATUS_LABEL)}
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
            {/* Stage C (S13/R1-1): الموعد والحمولة أمام قرار القبول — كانتا
                محجوبتين عن السائق قبل أصغر قرار (قبول/رفض الأجرة). */}
            <div>
              <dt>الموعد</dt>
              <dd>
                {(() => {
                  const schedule = (
                    request.payload as { schedule?: { date?: string; pickupWindow?: string } }
                  ).schedule;
                  if (!schedule || (!schedule.date && !schedule.pickupWindow)) return "—";
                  return `${schedule.date ?? ""}${schedule.pickupWindow ? ` (استلام ${schedule.pickupWindow})` : ""}`;
                })()}
              </dd>
            </div>
            <div>
              <dt>الحمولة</dt>
              <dd>
                {(() => {
                  const loadInfo = (request.payload as { load?: { description?: string; parcels?: number } })
                    .load;
                  if (!loadInfo || (!loadInfo.description && loadInfo.parcels == null)) return "—";
                  return `${loadInfo.description ?? ""}${
                    loadInfo.parcels != null ? ` — ${loadInfo.parcels} طرود` : ""
                  }`;
                })()}
              </dd>
            </div>
            <div>
              <dt>الأجرة</dt>
              <dd>
                <bdi dir="ltr">{minorToJod(request.offeredFareMinor)}</bdi> د.أ
              </dd>
            </div>
            <div>
              <dt>التحصيل (اختياري)</dt>
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
              {execution.execution === "undeliverable_declared" ? (
                pendingConsent ? (
                  <div className="micro-consent-pending" data-testid="driver-consent-pending">
                    <p role="status">
                      اقتراحك (
                      {pendingConsent.kind === "retry"
                        ? "محاولة جديدة"
                        : pendingConsent.kind === "holding"
                          ? "احتفاظ"
                          : "إرجاع أغراض — لا استرداد مال"}
                      ) ينتظر قبول صاحب المشروع صراحة — لا شيء ينفذ قبل قبوله ولا تلقائيًا أبدًا.
                    </p>
                    <Button
                      action="quiet"
                      onClick={() =>
                        void act(
                          () => withdrawDeliveryConsent(request.id, pendingConsent.id),
                          "سُحب الاقتراح — لا شيء تغير.",
                        )
                      }
                    >
                      اسحب الاقتراح
                    </Button>
                  </div>
                ) : (
                  <div className="micro-consent-propose" data-testid="driver-consent-propose">
                    {/* Stage C (S13): مرجع القاعدة الداخلي (OD10) لا يظهر
                     * للمستخدم — الجملة التشغيلية الصادقة تبقى كما هي. */}
                    <h3>اقترح على صاحب المشروع — لا يُنفذ إلا بقبوله الصريح</h3>
                    <Field label="نوع الاقتراح">
                      <select
                        value={consentKind}
                        onChange={event =>
                          setConsentKind(event.target.value as "retry" | "holding" | "return")
                        }
                      >
                        <option value="retry">محاولة جديدة</option>
                        <option value="holding">احتفاظ بالأغراض</option>
                        <option value="return">إرجاع الأغراض (لا استرداد مال)</option>
                      </select>
                    </Field>
                    {consentKind === "retry" ? (
                      <>
                        <Field label="عدد المحاولات (1-5)">
                          <input
                            value={consentAttempts}
                            onChange={event => setConsentAttempts(event.target.value)}
                            inputMode="numeric"
                          />
                        </Field>
                        <Field label="أجرة المحاولة (د.أ — اختياري، من شروطك المعلنة)">
                          <input
                            value={consentPrice}
                            onChange={event => setConsentPrice(event.target.value)}
                            inputMode="decimal"
                          />
                        </Field>
                      </>
                    ) : null}
                    {consentKind === "holding" ? (
                      <>
                        <Field label="مدة الاحتفاظ (نصًا — مطلوب)">
                          <input
                            value={consentDuration}
                            onChange={event => setConsentDuration(event.target.value)}
                          />
                        </Field>
                        <Field label="المكان (اختياري)">
                          <input
                            value={consentPlace}
                            onChange={event => setConsentPlace(event.target.value)}
                          />
                        </Field>
                        <Field label="تكلفة الاحتفاظ (د.أ — اختيارية)">
                          <input
                            value={consentCost}
                            onChange={event => setConsentCost(event.target.value)}
                            inputMode="decimal"
                          />
                        </Field>
                      </>
                    ) : null}
                    {consentKind === "return" ? (
                      <>
                        <Field label="جهة الإرجاع">
                          <select
                            value={consentDestination}
                            onChange={event =>
                              setConsentDestination(event.target.value as "requester" | "original_supplier")
                            }
                          >
                            <option value="requester">صاحب المشروع</option>
                            <option value="original_supplier">المورد الأصلي</option>
                          </select>
                        </Field>
                        <Field label="تكلفة الإرجاع (د.أ — الإرجاع المجاني اختيارك لا إلزامك)">
                          <input
                            value={consentCost}
                            onChange={event => setConsentCost(event.target.value)}
                            inputMode="decimal"
                          />
                        </Field>
                      </>
                    ) : null}
                    <Button
                      action="save"
                      onClick={() => {
                        const terms: Record<string, unknown> = {};
                        if (consentKind === "retry") {
                          const attempts = Number(normalizeAsciiDigits(consentAttempts.trim()));
                          if (!Number.isInteger(attempts) || attempts < 1 || attempts > 5) {
                            setMessage({ tone: "error", text: "عدد المحاولات رقم صحيح بين 1 و5." });
                            return;
                          }
                          terms.attempts = attempts;
                          const priceText = consentPrice.trim();
                          if (priceText !== "") {
                            if (!/^\d{1,9}(\.\d{1,2})?$/.test(priceText)) {
                              setMessage({ tone: "error", text: "أدخل أجرة صحيحة بخانتين عشريتين." });
                              return;
                            }
                            terms.priceMinor = `${Math.round(Number(priceText) * 100)}`;
                          }
                        } else if (consentKind === "holding") {
                          if (consentDuration.trim().length < 2) {
                            setMessage({ tone: "error", text: "اكتب مدة الاحتفاظ." });
                            return;
                          }
                          terms.durationText = consentDuration.trim();
                          if (consentPlace.trim() !== "") terms.place = consentPlace.trim();
                          const costText = consentCost.trim();
                          if (costText !== "") {
                            if (!/^\d{1,9}(\.\d{1,2})?$/.test(costText)) {
                              setMessage({ tone: "error", text: "أدخل تكلفة صحيحة بخانتين عشريتين." });
                              return;
                            }
                            terms.costMinor = `${Math.round(Number(costText) * 100)}`;
                          }
                        } else {
                          terms.destination = consentDestination;
                          const costText = consentCost.trim();
                          if (costText !== "") {
                            if (!/^\d{1,9}(\.\d{1,2})?$/.test(costText)) {
                              setMessage({ tone: "error", text: "أدخل تكلفة صحيحة بخانتين عشريتين." });
                              return;
                            }
                            terms.costMinor = `${Math.round(Number(costText) * 100)}`;
                          }
                        }
                        void act(async () => {
                          await proposeDeliveryConsent(request.id, consentKind, terms);
                        }, "أُرسل الاقتراح — ينتظر قبول صاحب المشروع صراحة.");
                      }}
                    >
                      أرسل الاقتراح
                    </Button>
                  </div>
                )
              ) : null}
              {execution.execution === "awaiting_instructions" ? (
                <Notice tone="info">
                  بانتظار تعليمات صاحب المشروع — يسجلها من واجهته (تابع التوصيل/الإرجاع/الاحتفاظ)؛ لا ينتظر
                  النظام بلا نهاية والحالة المعروضة صادقة.
                </Notice>
              ) : null}

              <Button action="quiet" onClick={() => setChangeOpen(open => !open)}>
                {changeOpen ? "إغلاق اقتراح التعديل المؤثر" : "اقتراح تعديل مؤثر (يحتاج قبول المشروع)"}
              </Button>
              {changeOpen ? (
                <div className="micro-change-form" data-testid="driver-change-form">
                  <p className="micro-review-item__meta">
                    {/* Stage C (S13): مرجع القاعدة الداخلي (OD11) ينتقل إلى
                     * التعليق — الجملة القرارية تبقى نصًا للمستخدم. */}
                    الاتفاق السابق يبقى ساريًا حتى يقبل صاحب المشروع صراحة؛ عند قبوله تُنشأ نسخة اتفاق جديدة
                    وتبقى السابقة في التاريخ.
                  </p>
                  <Field label="الأجرة الجديدة (د.أ — فارغة لبلا تغيير)">
                    <input
                      value={changeFare}
                      onChange={event => setChangeFare(event.target.value)}
                      inputMode="decimal"
                    />
                  </Field>
                  <Field label="موعد جديد (نصًا)">
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
                  <Field label="وصف الحمولة (نصًا)">
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
                          setMessage({ tone: "error", text: "أدخل قيمة واحدة على الأقل." });
                          return;
                        }
                        void act(async () => {
                          await proposeDeliveryChange(request.id, changes);
                          setChangeOpen(false);
                          /* Stage C (S13/R4-18): إعادة تعيين حقول النموذج بعد
                           * النجاح فقط — لا تبقى قيم الاقتراح السابق عند الفتح
                           * اللاحق. */
                          setChangeFare("");
                          setChangeDate("");
                          setChangePickupArea("");
                          setChangeDropoffArea("");
                          setChangeLoad("");
                          setChangeParcels("");
                          setChangeCollection("");
                        }, "أُرسل اقتراح التعديل — ينتظر قبول المشروع صراحة.");
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
                <div className="micro-change-pending" data-testid="driver-own-change-pending">
                  <p role="status">اقتراح تعديلك ينتظر قبول المشروع صراحة — الاتفاق السابق سارٍ.</p>
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
              {requesterPendingChange ? (
                <div className="micro-change-decision" data-testid="driver-change-decision">
                  <h3>اقتراح تعديل من صاحب المشروع — ينتظر قرارك الصريح</h3>
                  {/* Stage C (S13/R1-4): التغييرات المقترحة تُعرض صفوفًا عربية
                   * مسماة بالمبالغ بالدينار — لا JSON خام قبل قرار. */}
                  <ul className="micro-review-item__meta" data-testid="driver-change-fields">
                    {labeledRowsList(changeFieldRows(requesterPendingChange.changes))}
                  </ul>
                  <div className="micro-form-actions">
                    <Button
                      action="commit"
                      onClick={() =>
                        void act(
                          () => decideDeliveryChange(request.id, requesterPendingChange.id, "accept"),
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
                          () => decideDeliveryChange(request.id, requesterPendingChange.id, "reject"),
                          "رُفض التعديل — الاتفاق السابق سارٍ.",
                        )
                      }
                    >
                      ارفض التعديل
                    </Button>
                  </div>
                </div>
              ) : null}
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
                  <h3>أرسل بند كشف اليوم لهذا الحجز (تأكيد كامل فقط — لا تسوية جزئية)</h3>
                  <Field label="وصف البند" controlId="statement-description">
                    <input
                      id="statement-description"
                      value={statementDescription}
                      onChange={event => setStatementDescription(event.target.value)}
                      /* F-11 (Phase F — review 2): المبلغ داخل placeholder لا
                       * يمكن عزله بـ bdi — المثال بلا رقم. Stage C (S13/R2-18):
                       * صياغة المثال بلا تكرار. */
                      placeholder="مثال: تحصيل مبلغ هذا الحجز من المستلم"
                    />
                  </Field>
                  <Field label="قيمة البند (د.أ)" controlId="statement-amount">
                    <input
                      id="statement-amount"
                      value={statementAmountJod}
                      onChange={event => setStatementAmountJod(event.target.value)}
                      inputMode="decimal"
                      dir="ltr"
                      lang="en"
                    />
                  </Field>
                  <Button
                    action="save"
                    disabled={pendingAction}
                    onClick={() =>
                      void act(async () => {
                        const text = normalizeAsciiDigits(statementAmountJod.trim());
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
                        setStatementAmountJod("");
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
            {/* Stage C (S13/R2-11): مرجع دعم كامل واحد معزول بـ bdi — بديلًا
             * عن المقطع الخام في الترويسة؛ موجود عند الحاجة بلا قصّ منتصف
             * المعرّف. */}
            <p className="micro-review-item__meta">
              مرجع الطلب للدعم: <bdi dir="ltr">{request.id}</bdi>
            </p>
          </section>
        </article>
      ) : null}
    </section>
  );
}
