/**
 * بوابة السائق (OD01/OD21): سياق مستقل تمامًا بنفس هوية Micro — لا شريط
 * سفلي ولا أي واجهة لصاحب المشروع أو Manage أو Market. تفتح على لوحة
 * السائق للنشط، أو حالة تقديمه لغير المؤهل: تقديم ذاتي بمستندات خاصة
 * (هوية/رخصة/إثبات مركبة عند تسجيلها) ومراجعة يدوية — لا تفعيل ذاتيًا.
 */
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Truck } from "lucide-react";
import { useNetworkSession } from "@/app/useNetworkSession";
import {
  attachDriverEvidence,
  fetchDriverPortal,
  fetchDriverRequests,
  fetchDriverStatements,
  upsertDriverProfileDraft,
  upsertDriverVehicleDraft,
  setAcceptingNew,
  submitDriverApplication,
  uploadDriverEvidence,
  uploadVehicleProof,
  type DriverPortalState,
  type DriverRequestSummary,
  type DriverStatementSummary,
} from "@/application/delivery";
import { Button, EmptyState, Field, Notice } from "@/components/primitives";
import { businessDateFromTimestamp, formatLocalDate } from "@/presentation/formatters";
import {
  DRIVER_REQUEST_STATUS_LABELS,
  STATEMENT_STATUS_LABELS,
  UNKNOWN_STATUS_LABEL,
} from "@/presentation/deliveryLabels";
import { normalizeAsciiDigits } from "@/application/input";

const STATUS_LABELS: Record<string, string> = {
  draft: "مسودة — أكمل البيانات وأرسل للمراجعة",
  /* Stage C (S13/R2-13): لا أسماء داخلية في نص المستخدم — المراجعة يدوية
   * لا شخصية؛ نفس لغة رسالة النجاح عند الإرسال. */
  submitted: "مقدمة — بانتظار المراجعة اليدوية",
  under_review: "تحت المراجعة",
  changes_requested: "تحتاج استكمالًا — راجع الملاحظات وأعد الإرسال",
  rejected: "مرفوضة",
  approved: "معتمد",
  suspended_new: "موقوف عن الجديد — القائم محفوظ",
};

const EVIDENCE_LABELS: Record<string, string> = {
  identity: "صورة الهوية",
  license: "رخصة القيادة",
  vehicle_ownership: "إثبات المركبة/الإذن",
};

const EVIDENCE_STATUS_LABELS: Record<string, string> = {
  pending: "بانتظار المراجعة",
  approved: "معتمد",
  rejected: "مرفوض — أعد الرفع",
};

const VEHICLE_STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  submitted: "مقدمة للمراجعة",
  approved: "معتمدة",
  rejected: "مرفوضة",
};

const GOVERNORATES = [
  "عمان",
  "إربد",
  "الزرقاء",
  "البلقاء",
  "المفرق",
  "العقبة",
  "جرش",
  "عجلون",
  "مادبا",
  "الكرك",
  "الطفيلة",
  "معان",
];

function minorToJod(minor: string | null): string {
  if (minor === null) return "—";
  const value = BigInt(minor);
  return `${(value / 100n).toString()}.${(value % 100n).toString().padStart(2, "0")}`;
}

export default function DriverPortal() {
  const [, navigate] = useLocation();
  const { session, signIn, loading: sessionLoading, failed: sessionFailed, refresh } = useNetworkSession();
  const [portal, setPortal] = useState<DriverPortalState | null>(null);
  const [requests, setRequests] = useState<DriverRequestSummary[]>([]);
  const [statements, setStatements] = useState<DriverStatementSummary[]>([]);
  /* Stage C (S13/R4-9): فشل جلب الكشوف ليس «لا كشوف» — حالة مستقلة صادقة
   * مع إعادة محاولة، لا قسم يختفي بصمت. */
  const [statementsFailed, setStatementsFailed] = useState(false);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<{ tone: "neutral" | "error" | "success"; text: string } | null>(
    null,
  );
  const [form, setForm] = useState({
    displayName: "",
    phone: "",
    plate: "",
    vehicleType: "",
    serviceAreas: [] as string[],
  });
  const [prefilled, setPrefilled] = useState(false);

  const load = useCallback(async () => {
    setLoadState("loading");
    try {
      const state = await fetchDriverPortal();
      setPortal(state);
      setForm(current => {
        // Prefill from the driver's own work copy (edit mode, not a blank form).
        const fields = state.driver?.profileFields;
        if (prefilled || fields === null || fields === undefined) return current;
        setPrefilled(true);
        return {
          ...current,
          displayName: fields.displayName ?? current.displayName,
          phone: fields.phone ?? current.phone,
          serviceAreas: fields.serviceAreas ?? current.serviceAreas,
        };
      });
      if (state.driver) {
        const [list, statementList] = await Promise.all([
          fetchDriverRequests(),
          fetchDriverStatements().then(
            result => {
              setStatementsFailed(false);
              return result;
            },
            () => {
              setStatementsFailed(true);
              return { statements: [] as DriverStatementSummary[] };
            },
          ),
        ]);
        setRequests(list.requests);
        setStatements(statementList.statements);
      }
      setLoadState("ready");
    } catch {
      // A network failure is NOT "no application" — surface it honestly.
      setLoadState("error");
    }
  }, [prefilled]);

  useEffect(() => {
    if (session.authenticated) void load();
  }, [session.authenticated, load]);

  /* F-15/S12 (Phase E): تعذّر التحقق حالة مستقلة قبل بوابة الدخول — انقطاع
   * الشبكة لا يُعرض كأنه «غير مسجل». */
  if (!sessionLoading && sessionFailed) {
    return (
      <section className="micro-page micro-driver-portal" data-testid="driver-portal-unverified">
        <div className="micro-page-heading">
          <span className="micro-overline">Micro — السائق</span>
          <h1>بوابة السائق</h1>
        </div>
        <Notice tone="error">
          تعذر التحقق من جلستك الآن — انقطاع الشبكة لا يعني أنك غير مسجل. تحقق من اتصالك ثم أعد المحاولة.
        </Notice>
        <Button action="secondary" onClick={() => void refresh()}>
          إعادة المحاولة
        </Button>
      </section>
    );
  }

  if (!sessionLoading && !session.authenticated) {
    return (
      <section className="micro-page micro-driver-portal" data-testid="driver-portal-gate">
        <div className="micro-page-heading">
          <span className="micro-overline">Micro — السائق</span>
          <h1>بوابة السائق</h1>
        </div>
        <EmptyState
          symbol={<Truck aria-hidden="true" />}
          title="بوابة مستقلة بهوية Micro نفسها"
          description="لا حساب ثانٍ ولا تطبيق منفصل — سجل دخولك وابدأ التقديم الذاتي أو تابع طلبك."
          action={
            <Button action="create" onClick={() => signIn("/driver")}>
              الدخول عبر Google
            </Button>
          }
        />
      </section>
    );
  }

  const driver = portal?.driver ?? null;

  const toggleArea = (governorate: string) => {
    setForm(current => ({
      ...current,
      serviceAreas: current.serviceAreas.includes(governorate)
        ? current.serviceAreas.filter(area => area !== governorate)
        : [...current.serviceAreas, governorate],
    }));
  };

  const uploadEvidence = async (category: "identity" | "license", file: File) => {
    try {
      const uploaded = await uploadDriverEvidence(file);
      await attachDriverEvidence({ category, mediaId: uploaded.media.id });
      setMessage({ tone: "success", text: `رُفعت ${EVIDENCE_LABELS[category]} — بانتظار المراجعة.` });
      await load();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "تعذر رفع المستند." });
    }
  };

  return (
    <section className="micro-page micro-driver-portal" data-testid="driver-portal">
      <div className="micro-page-heading">
        <span className="micro-overline">Micro — السائق</span>
        <h1>{driver ? (driver.status === "approved" ? "لوحة السائق" : "حالة تقديمك") : "تقديم سائق"}</h1>
      </div>
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

      {/* Stage C (S13/R1-25): حالة التحميل تُعلن أيضًا أثناء التحقق من
       * الجلسة — لا صفحة فارغة تحت الترويسة. */}
      {loadState === "loading" && (session.authenticated || sessionLoading) ? (
        <p className="micro-route-loading" role="status">
          جارٍ تحميل بوابة السائق…
        </p>
      ) : null}
      {loadState === "error" ? (
        <EmptyState
          title="تعذر تحميل بوابة السائق"
          description="أعد المحاولة — لا نبني حالتك من غياب البيانات."
          action={
            <Button action="secondary" onClick={() => void load()}>
              إعادة المحاولة
            </Button>
          }
        />
      ) : null}
      {loadState === "ready" && driver === null ? (
        <section className="micro-driver-apply">
          <h2>بيانات التشغيل الأساسية</h2>
          <Field label="الاسم المعروض">
            <input
              value={form.displayName}
              onChange={event => setForm({ ...form, displayName: event.target.value })}
            />
          </Field>
          <Field label="هاتف التواصل">
            <input
              value={form.phone}
              onChange={event => setForm({ ...form, phone: event.target.value })}
              inputMode="tel"
            />
          </Field>
          <Field label="نوع المركبة (أي سيارة مقبولة)">
            <input
              value={form.vehicleType}
              onChange={event => setForm({ ...form, vehicleType: event.target.value })}
            />
          </Field>
          <Field label="رقم اللوحة">
            <input value={form.plate} onChange={event => setForm({ ...form, plate: event.target.value })} />
          </Field>
          <fieldset className="micro-service-areas">
            <legend>مناطق خدمتك (تظهر لأصحاب المشاريع عند الترشيح)</legend>
            {GOVERNORATES.map(governorate => (
              <label key={governorate}>
                <input
                  type="checkbox"
                  checked={form.serviceAreas.includes(governorate)}
                  onChange={() => toggleArea(governorate)}
                />
                {governorate}
              </label>
            ))}
          </fieldset>
          <h2>المستندات الخاصة (السائق والمراجعون المخولون فقط يرونها)</h2>
          <label className="micro-evidence-upload">
            صورة الهوية
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={event => {
                const file = event.target.files?.[0];
                if (file) void uploadEvidence("identity", file);
              }}
            />
          </label>
          <label className="micro-evidence-upload">
            رخصة القيادة
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={event => {
                const file = event.target.files?.[0];
                if (file) void uploadEvidence("license", file);
              }}
            />
          </label>
          <label className="micro-evidence-upload">
            إثبات المركبة/الإذن (عند تسجيلها)
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={async event => {
                const file = event.target.files?.[0];
                if (!file) return;
                try {
                  const proof = await uploadVehicleProof(file);
                  await upsertDriverVehicleDraft({
                    plate: form.plate,
                    vehicleType: form.vehicleType,
                    ownershipProofMediaId: proof.media.id,
                  });
                  setMessage({ tone: "success", text: "سُجلت المركبة مع إثباتها — بانتظار المراجعة." });
                  await load();
                } catch (error) {
                  setMessage({
                    tone: "error",
                    text: error instanceof Error ? error.message : "تعذر رفع إثبات المركبة.",
                  });
                }
              }}
            />
          </label>
          <div className="micro-form-actions">
            <Button
              action="save"
              onClick={async () => {
                try {
                  await upsertDriverProfileDraft({
                    displayName: form.displayName,
                    phone: normalizeAsciiDigits(form.phone.trim()),
                    serviceAreas: form.serviceAreas,
                  });
                  setMessage({ tone: "success", text: "حُفظ ملف السائق كمسودة." });
                  await load();
                } catch (error) {
                  setMessage({
                    tone: "error",
                    text: error instanceof Error ? error.message : "تعذر حفظ الملف.",
                  });
                }
              }}
            >
              حفظ المسودة
            </Button>
            <Button
              action="commit"
              onClick={async () => {
                try {
                  await upsertDriverProfileDraft({
                    displayName: form.displayName,
                    phone: normalizeAsciiDigits(form.phone.trim()),
                    serviceAreas: form.serviceAreas,
                  });
                  await submitDriverApplication();
                  setMessage({ tone: "success", text: "أُرسل التقديم للمراجعة اليدوية — لا تفعيل ذاتيًا." });
                  await load();
                } catch (error) {
                  setMessage({
                    tone: "error",
                    text:
                      error instanceof Error ? error.message : "تعذر الإرسال — أكمل الهوية والرخصة أولًا.",
                  });
                }
              }}
            >
              إرسال التقديم للمراجعة
            </Button>
          </div>
        </section>
      ) : null}
      {loadState === "ready" && driver !== null ? (
        <>
          <section className="micro-driver-status">
            <h2>حالتك</h2>
            <p>{STATUS_LABELS[driver.status] ?? driver.status}</p>
            {driver.reviewReason !== null ? (
              <p className="micro-review-reason" role="status">
                ملاحظة المراجع: {driver.reviewReason}
              </p>
            ) : null}
            <ul className="micro-evidence-list" data-testid="driver-evidence">
              {(portal?.evidence ?? []).map(evidence => (
                <li key={evidence.id}>
                  {EVIDENCE_LABELS[evidence.category] ?? evidence.category}:{" "}
                  {EVIDENCE_STATUS_LABELS[evidence.status] ?? evidence.status}
                  {evidence.expiresAt !== null
                    ? ` — ينتهي ${formatLocalDate(businessDateFromTimestamp(new Date(evidence.expiresAt).toISOString()))}`
                    : ""}
                </li>
              ))}
              {portal?.vehicle ? (
                <li>المركبة: {VEHICLE_STATUS_LABELS[portal.vehicle.status] ?? portal.vehicle.status}</li>
              ) : null}
            </ul>
            {driver.status === "approved" ? (
              <Button
                action={driver.acceptingNew ? "outline" : "create"}
                onClick={async () => {
                  try {
                    await setAcceptingNew(!driver.acceptingNew);
                    setMessage({
                      tone: "success",
                      text: driver.acceptingNew
                        ? "أوقفت استقبال الحجوزات الجديدة — القائم محفوظ."
                        : "فُتح استقبال الحجوزات الجديدة.",
                    });
                    await load();
                  } catch (error) {
                    setMessage({
                      tone: "error",
                      text: error instanceof Error ? error.message : "تعذر تغيير الحالة.",
                    });
                  }
                }}
              >
                {driver.acceptingNew ? "إيقاف استقبال الجديد" : "بدء استقبال الجديد"}
              </Button>
            ) : null}
          </section>

          {driver.status === "approved" ? (
            <section className="micro-driver-inbox">
              <h2>الوارد (مهلة الرد 30 دقيقة)</h2>
              {requests.length === 0 ? (
                <EmptyState
                  title="لا طلبات واردة"
                  description="ستظهر الطلبات الموجهة إليك هنا فور إرسالها."
                />
              ) : (
                <ul data-testid="driver-request-list">
                  {requests.map(request => (
                    <li key={request.id}>
                      <button
                        type="button"
                        className="micro-driver-request-card"
                        onClick={() => navigate(`/driver/booking/${request.id}`)}
                      >
                        {/* Stage C (S13/R1-18 + R2-5): خريطة الحالات الكاملة
                         * من المصدر المشترك بلا كود خام، والأجرة المعروضة
                         * على البطاقة — أول رقم قرار قبل الفتح. */}
                        <strong>
                          {request.status === "awaiting_driver_response"
                            ? "طلب جديد ينتظر ردك"
                            : (DRIVER_REQUEST_STATUS_LABELS[request.status] ?? UNKNOWN_STATUS_LABEL)}
                        </strong>
                        <span>
                          {request.needType === "deliver_to_customer" ? "توصيل للزبون" : "إحضار أغراض جاهزة"}
                          {" · الأجرة "}
                          <bdi dir="ltr">{minorToJod(request.offeredFareMinor)}</bdi> د.أ
                          {request.collectionMinor !== null ? (
                            <>
                              {" · تحصيل "}
                              <bdi dir="ltr">{minorToJod(request.collectionMinor)}</bdi> د.أ
                            </>
                          ) : (
                            ""
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          {/* Stage C (S13/R4-9): فشل جلب الكشوف حالة معلنة مع إعادة محاولة —
           * لا يُعرض أبدًا كأن لا كشوف. */}
          {driver.status === "approved" && statementsFailed ? (
            <section className="micro-driver-statements" data-testid="driver-statements-failed">
              <h2>كشوفك اليومية</h2>
              <p role="alert">تعذر تحميل كشوفك الآن — لا تعني غيابها. أعد المحاولة.</p>
              <Button action="secondary" onClick={() => void load()}>
                إعادة المحاولة
              </Button>
            </section>
          ) : null}
          {driver.status === "approved" && statements.length > 0 ? (
            <section className="micro-driver-statements" data-testid="driver-statements">
              <h2>كشوفك اليومية</h2>
              <ul className="micro-statement-list">
                {statements.map(statement => (
                  <li key={statement.id} className="micro-statement-card">
                    <p>
                      {formatLocalDate(statement.date)} —{" "}
                      <bdi dir="ltr">{minorToJod(statement.totalMinor)}</bdi> د.أ —{" "}
                      {STATEMENT_STATUS_LABELS[statement.status] ?? statement.status}
                    </p>
                    <ul className="micro-statement-card__items">
                      {statement.items.map((item, index) => (
                        <li key={index}>
                          {item.description} — <bdi dir="ltr">{minorToJod(item.amountMinor)}</bdi> د.أ
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
