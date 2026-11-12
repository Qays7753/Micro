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
  upsertDriverProfileDraft,
  upsertDriverVehicleDraft,
  setAcceptingNew,
  submitDriverApplication,
  uploadDriverEvidence,
  uploadVehicleProof,
  type DriverPortalState,
  type DriverRequestSummary,
} from "@/application/delivery";
import { Button, EmptyState, Field, Notice } from "@/components/primitives";

const STATUS_LABELS: Record<string, string> = {
  draft: "مسودة — أكمل البيانات وأرسل للمراجعة",
  submitted: "مقدمة — بانتظار مراجعة قيس",
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

export default function DriverPortal() {
  const [, navigate] = useLocation();
  const { session, signIn, loading: sessionLoading } = useNetworkSession();
  const [portal, setPortal] = useState<DriverPortalState | null>(null);
  const [requests, setRequests] = useState<DriverRequestSummary[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({ displayName: "", phone: "", plate: "", vehicleType: "" });

  const load = useCallback(async () => {
    try {
      const state = await fetchDriverPortal();
      setPortal(state);
      if (state.driver) {
        const list = await fetchDriverRequests();
        setRequests(list.requests);
      }
    } catch {
      setPortal(null);
    }
  }, []);

  useEffect(() => {
    if (session.authenticated) void load();
  }, [session.authenticated, load]);

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

  const uploadEvidence = async (category: "identity" | "license", file: File) => {
    try {
      const uploaded = await uploadDriverEvidence(file);
      await attachDriverEvidence({ category, mediaId: uploaded.media.id });
      setMessage(`رُفعت ${EVIDENCE_LABELS[category]} — بانتظار المراجعة.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر رفع المستند.");
    }
  };

  return (
    <section className="micro-page micro-driver-portal" data-testid="driver-portal">
      <div className="micro-page-heading">
        <span className="micro-overline">Micro — السائق</span>
        <h1>{driver ? (driver.status === "approved" ? "لوحة السائق" : "حالة تقديمك") : "تقديم سائق"}</h1>
      </div>
      {message ? <Notice tone="neutral">{message}</Notice> : null}

      {driver === null ? (
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
          <Field label="نوع المركبة (أي سيارة مقبولة — OD27)">
            <input
              value={form.vehicleType}
              onChange={event => setForm({ ...form, vehicleType: event.target.value })}
            />
          </Field>
          <Field label="رقم اللوحة">
            <input value={form.plate} onChange={event => setForm({ ...form, plate: event.target.value })} />
          </Field>
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
                  setMessage("سُجلت المركبة مع إثباتها — بانتظار المراجعة.");
                  await load();
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : "تعذر رفع إثبات المركبة.");
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
                    phone: form.phone,
                    serviceAreas: ["عمان"],
                  });
                  setMessage("حُفظ ملف السائق كمسودة.");
                  await load();
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : "تعذر حفظ الملف.");
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
                    phone: form.phone,
                    serviceAreas: ["عمان"],
                  });
                  await submitDriverApplication();
                  setMessage("أُرسل التقديم للمراجعة اليدوية — لا تفعيل ذاتيًا (OD22).");
                  await load();
                } catch (error) {
                  setMessage(
                    error instanceof Error ? error.message : "تعذر الإرسال — أكمل الهوية والرخصة أولًا.",
                  );
                }
              }}
            >
              إرسال التقديم للمراجعة
            </Button>
          </div>
        </section>
      ) : (
        <>
          <section className="micro-driver-status">
            <h2>حالتك</h2>
            <p>{STATUS_LABELS[driver.status] ?? driver.status}</p>
            <ul className="micro-evidence-list" data-testid="driver-evidence">
              {(portal?.evidence ?? []).map(evidence => (
                <li key={evidence.id}>
                  {EVIDENCE_LABELS[evidence.category] ?? evidence.category}: {evidence.status}
                  {evidence.expiresAt !== null
                    ? ` — ينتهي ${new Date(evidence.expiresAt).toLocaleDateString("ar-JO")}`
                    : ""}
                </li>
              ))}
              {portal?.vehicle ? <li>المركبة: {portal.vehicle.status}</li> : null}
            </ul>
            {driver.status === "approved" ? (
              <Button
                action={driver.acceptingNew ? "outline" : "create"}
                onClick={async () => {
                  try {
                    await setAcceptingNew(!driver.acceptingNew);
                    setMessage(
                      driver.acceptingNew
                        ? "أوقفت استقبال الحجوزات الجديدة — القائم محفوظ."
                        : "فُتح استقبال الحجوزات الجديدة.",
                    );
                    await load();
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : "تعذر تغيير الحالة.");
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
                        <strong>
                          {request.status === "awaiting_driver_response"
                            ? "طلب جديد ينتظر ردك"
                            : request.status === "confirmed"
                              ? "حجز مؤكد — تابع التنفيذ"
                              : request.status}
                        </strong>
                        <span>
                          {request.needType === "deliver_to_customer" ? "توصيل للزبون" : "إحضار أغراض جاهزة"}
                          {request.collectionMinor !== null ? ` · تحصيل ${request.collectionMinor}` : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}
        </>
      )}
    </section>
  );
}
