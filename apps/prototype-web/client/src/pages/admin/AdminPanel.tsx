/**
 * Post-Group 6 continuous completion (WS-251/DOC-041 — owner order 7593b9c4
 * §4 G02): لوحة المشرف — Q129 وحده، داخل التطبيق نفسه بمسار وتخطيط
 * خاصين (/admin — تخطيطها الإداري الخاص لا أسطح القراءة المعيارية)،
 * ومحمية من الخادم (كل مسار admin-only؛ غير المشرف يرى رفضًا صادقًا)،
 * ومبنية كوحدة منفصلة في الكود (pages/admin + application/admin) يسهل
 * فصلها لاحقًا كما ينص القرار.
 *
 * لا تقرأ هذه اللوحة ولا تكتب أي سجل مالي في Manage (أقل امتياز)؛ وMFA
 * على حساب Google للإدارة فحص تشغيلي على المشغل لا يُدّعى من الكود.
 */
import { ArrowRight, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  adminCancelBooking,
  fetchAdminDecisions,
  fetchAdminQueues,
  searchAdminUsers,
  suspendAdminIdentity,
  type AdminDecision,
  type AdminQueues,
  type AdminUserResult,
} from "@/application/admin";
import { ApiError } from "@/application/network";
import { useNetworkSession } from "@/app/useNetworkSession";
import { useReturnPath } from "@/app/useReturnNavigation";
import { Button, Notice } from "@/components/primitives";

type LoadState<T> =
  { phase: "loading" } | { phase: "failed" } | { phase: "refused" } | { phase: "ready"; value: T };

/** عمر العنصر بلغة مباشرة — من ساعة الخادم كما يفرض القرار. */
function ageLabel(ageMs: number | null): string {
  if (ageMs === null) return "بلا وقت معلوم";
  const minutes = Math.floor(ageMs / 60000);
  if (minutes < 1) return "الآن";
  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  return `منذ ${days} يوم`;
}

const QUEUE_SECTIONS: { key: keyof AdminQueues["queues"]; title: string }[] = [
  { key: "driverApplications", title: "طلبات سائقين قيد المراجعة" },
  { key: "driverEvidence", title: "وثائق سائقين بانتظار المراجعة" },
  { key: "driverVehicles", title: "مركبات بانتظار المراجعة" },
  { key: "marketListings", title: "إعلانات بانتظار المراجعة" },
  { key: "marketMedia", title: "صور إعلانات بانتظار المراجعة" },
  { key: "marketReports", title: "بلاغات مفتوحة" },
  { key: "openCases", title: "بلاغات حجز مفتوحة" },
];

const ACTION_LABELS: Record<string, string> = {
  identity_suspended: "إيقاف هوية كاملة",
  admin_booking_cancelled: "إلغاء إداري لحجز جارٍ",
  review_list: "قرار مراجعة إعلان",
  review_profile: "قرار مراجعة ملف مورد",
  review_media: "قرار مراجعة صورة",
  review_driver: "قرار مراجعة سائق",
  review_evidence: "قرار مراجعة وثيقة",
  review_vehicle: "قرار مراجعة مركبة",
  delivery_case_close: "إغلاق بلاغ حجز",
};

function decisionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export default function AdminPanel() {
  const { session, loading: sessionLoading, failed: sessionFailed, refresh } = useNetworkSession();
  const returnTo = useReturnPath();
  const [, navigate] = useLocation();
  const [queues, setQueues] = useState<LoadState<AdminQueues>>({ phase: "loading" });
  const [decisions, setDecisions] = useState<LoadState<AdminDecision[]>>({ phase: "loading" });
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AdminUserResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<AdminUserResult | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [cancelBookingId, setCancelBookingId] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelConfirming, setCancelConfirming] = useState(false);

  const loadAll = useCallback(async () => {
    setQueues({ phase: "loading" });
    setDecisions({ phase: "loading" });
    try {
      const value = await fetchAdminQueues();
      setQueues({ phase: "ready", value });
    } catch (cause) {
      setQueues(
        cause instanceof ApiError && cause.status === 403 ? { phase: "refused" } : { phase: "failed" },
      );
    }
    try {
      const value = await fetchAdminDecisions();
      setDecisions({ phase: "ready", value });
    } catch (cause) {
      setDecisions(
        cause instanceof ApiError && cause.status === 403 ? { phase: "refused" } : { phase: "failed" },
      );
    }
  }, []);

  useEffect(() => {
    if (sessionLoading || !session.authenticated) return;
    void loadAll();
  }, [sessionLoading, session.authenticated, loadAll]);

  async function runSearch(): Promise<void> {
    if (query.trim().length < 2) return;
    setSearching(true);
    setSearchError(null);
    try {
      setSearchResults(await searchAdminUsers(query.trim()));
    } catch (cause) {
      setSearchError(cause instanceof ApiError ? cause.message : "تعذر البحث الآن — أعد المحاولة.");
    } finally {
      setSearching(false);
    }
  }

  async function runSuspend(): Promise<void> {
    if (!suspendTarget || suspendReason.trim().length < 4) return;
    setActionBusy(true);
    setActionError(null);
    setActionNotice(null);
    try {
      await suspendAdminIdentity(suspendTarget.identityId, suspendReason.trim());
      setActionBusy(false);
      setActionNotice(
        `أُوقفت هوية ${suspendTarget.displayName} — جلساتها ملغاة والدخول مرفوض بسببها المسجل.`,
      );
      setSuspendTarget(null);
      setSuspendReason("");
      setSearchResults(null);
      void loadAll();
    } catch (cause) {
      setActionBusy(false);
      setActionError(cause instanceof ApiError ? cause.message : "تعذر إيقاف الهوية الآن — أعد المحاولة.");
    }
  }

  async function runCancel(): Promise<void> {
    if (cancelBookingId.trim().length < 2 || cancelReason.trim().length < 4) return;
    setActionBusy(true);
    setActionError(null);
    setActionNotice(null);
    try {
      await adminCancelBooking(cancelBookingId.trim(), cancelReason.trim());
      setActionBusy(false);
      setActionNotice("أُلغي الحجز إداريًا وأُبلغ صاحب الحجز فورًا بسبب القرار.");
      setCancelBookingId("");
      setCancelReason("");
      setCancelConfirming(false);
      void loadAll();
    } catch (cause) {
      setActionBusy(false);
      setActionError(cause instanceof ApiError ? cause.message : "تعذر الإلغاء الإداري الآن — أعد المحاولة.");
    }
  }

  /* F-15/S12: تعذّر التحقق من الجلسة لا يُعرض أبدًا كأنه «غير مصرح». */
  if (!sessionLoading && sessionFailed) {
    return (
      <div className="micro-page-pad" data-testid="admin-session-failed">
        <h1>لوحة الإشراف</h1>
        <Notice tone="error">
          تعذر التحقق من جلستك الآن — انقطاع الشبكة لا يعني أنك غير مصرح. تحقق من اتصالك ثم أعد المحاولة.
        </Notice>
        <Button action="secondary" onClick={() => void refresh()}>
          إعادة المحاولة
        </Button>
      </div>
    );
  }

  if (sessionLoading) {
    return (
      <div className="micro-route-loading" role="status">
        جارٍ التحقق من صلاحية الإشراف…
      </div>
    );
  }

  if (!session.authenticated) {
    return (
      <div className="micro-page-pad" data-testid="admin-signin-gate">
        <h1>لوحة الإشراف</h1>
        <Notice tone="error">هذه اللوحة لحساب الإدارة وحده — سجّل الدخول بحساب الإدارة.</Notice>
      </div>
    );
  }

  const refused = queues.phase === "refused" || decisions.phase === "refused";
  if (refused) {
    return (
      <div className="micro-page-pad" data-testid="admin-refused">
        <h1>لوحة الإشراف</h1>
        <Notice tone="error">حسابك لا يملك صلاحية الإشراف — هذه اللوحة لحساب الإدارة المنفصل وحده.</Notice>
      </div>
    );
  }

  return (
    <section className="micro-page micro-admin-panel" data-testid="admin-panel">
      <button className="micro-back-button" type="button" onClick={() => navigate(returnTo)}>
        <ArrowRight aria-hidden="true" /> رجوع
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">لوحة المشرف</span>
        <h1>لوحة الإشراف</h1>
        <p>الطوابير والقرارات والإيقاف والإلغاء الإداري — بلا أي وصول مالي إلى Manage.</p>
      </div>

      {queues.phase === "loading" || decisions.phase === "loading" ? (
        <div className="micro-route-loading" role="status">
          جارٍ تحميل الطوابير والقرارات…
        </div>
      ) : null}
      {queues.phase === "failed" || decisions.phase === "failed" ? (
        <>
          <Notice tone="error">تعذر تحميل اللوحة الآن — أعد المحاولة.</Notice>
          <Button action="secondary" onClick={() => void loadAll()}>
            إعادة المحاولة
          </Button>
        </>
      ) : null}

      {queues.phase === "ready" ? (
        <>
          <section className="micro-admin-section" aria-labelledby="admin-ops-title">
            <h2 id="admin-ops-title">أرقام تشغيلية</h2>
            <ul className="micro-admin-facts" data-testid="admin-ops-counts">
              <li>موردون نشطون بإعلان منشور: {queues.value.opsCounts.activeSuppliers}</li>
              <li>سائقون معتمدون: {queues.value.opsCounts.activeDrivers}</li>
              <li>حجوزات آخر ٧ أيام: {queues.value.opsCounts.weeklyBookings}</li>
              <li>هويات موقوفة: {queues.value.opsCounts.suspendedIdentities}</li>
            </ul>
            <p className="micro-admin-note">
              الأرقام الصادقة فقط — عتبة الإطلاق (١٠ موردين و٥ سائقين على المحافظات) قرار مالك على حسابات
              حقيقية، ولا يُدّعى بلوغها من بيانات اصطناعية.
            </p>
          </section>

          <section className="micro-admin-section" aria-labelledby="admin-queues-title">
            <h2 id="admin-queues-title">الطوابير</h2>
            {QUEUE_SECTIONS.map(section => {
              const items = queues.value.queues[section.key];
              return (
                <div
                  key={section.key}
                  className="micro-admin-queue"
                  data-testid={`admin-queue-${section.key}`}
                >
                  <h3>
                    {section.title} <span className="micro-admin-count">({items.length})</span>
                  </h3>
                  {items.length === 0 ? (
                    <p className="micro-admin-empty">لا عناصر</p>
                  ) : (
                    <ul>
                      {items.slice(0, 10).map(item => (
                        <li key={String(item.id)}>{ageLabel(item.ageMs)}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </section>
        </>
      ) : null}

      <section className="micro-admin-section" aria-labelledby="admin-search-title">
        <h2 id="admin-search-title">البحث عن مستخدم</h2>
        <form
          className="micro-admin-search"
          onSubmit={event => {
            event.preventDefault();
            void runSearch();
          }}
        >
          <label className="micro-field">
            <span>الاسم أو البريد أو الهاتف</span>
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="مثال: +962790000000"
              dir="auto"
            />
          </label>
          <Button action="secondary" type="submit" loading={searching} disabled={query.trim().length < 2}>
            ابحث
          </Button>
        </form>
        {searchError ? (
          <p className="micro-field-error" role="alert">
            {searchError}
          </p>
        ) : null}
        {searchResults !== null ? (
          searchResults.length === 0 ? (
            <p role="status">لا نتائج مطابقة.</p>
          ) : (
            <ul className="micro-admin-users" data-testid="admin-search-results">
              {searchResults.map(user => (
                <li key={user.identityId}>
                  <div>
                    <strong>{user.displayName}</strong> — <bdi dir="ltr">{user.email}</bdi>
                    <div className="micro-admin-user-state">
                      {user.isAdmin ? "حساب إدارة" : null}
                      {user.vendorStatus !== null ? `مورد (${user.vendorStatus})` : null}
                      {user.driverStatus !== null ? `سائق (${user.driverStatus})` : null}
                      {user.suspended ? `موقوف: ${user.suspensionReason ?? ""}` : "غير موقوف"}
                    </div>
                  </div>
                  {!user.suspended && !user.isAdmin ? (
                    <Button
                      action="secondary"
                      disabled={actionBusy}
                      onClick={() => {
                        setSuspendTarget(user);
                        setSuspendReason("");
                        setActionError(null);
                      }}
                    >
                      أوقف الهوية
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )
        ) : null}
        {suspendTarget ? (
          <div className="micro-confirm-box" role="alertdialog" aria-label="تأكيد إيقاف الهوية">
            <p>
              إيقاف هوية <strong>{suspendTarget.displayName}</strong> كاملة بسبب مكتوب — تُلغى جلساتها فورًا
              ويرفض دخولها بالسبب نفسه. لا يُلغى أي حجز جارٍ تلقائيًا (الحجز يكتمل)؛ الإلغاء الإداري فعل منفصل
              أدناه.
            </p>
            <label className="micro-field">
              <span>السبب (إلزامي)</span>
              <input
                value={suspendReason}
                onChange={event => setSuspendReason(event.target.value)}
                placeholder="مثال: خطر على الناس — بلاغ موثق"
              />
            </label>
            <div className="micro-form-actions">
              <Button action="quiet" disabled={actionBusy} onClick={() => setSuspendTarget(null)}>
                تراجع
              </Button>
              <Button
                action="commit"
                disabled={actionBusy || suspendReason.trim().length < 4}
                onClick={() => void runSuspend()}
              >
                {actionBusy ? "جارٍ الإيقاف…" : "نفّذ الإيقاف"}
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="micro-admin-section" aria-labelledby="admin-cancel-title">
        <h2 id="admin-cancel-title">إلغاء حجز جارٍ إداريًا</h2>
        {!cancelConfirming ? (
          <Button action="secondary" onClick={() => setCancelConfirming(true)}>
            ألغِ حجزًا جاريًا بقرار إداري
          </Button>
        ) : (
          <div className="micro-confirm-box" role="alertdialog" aria-label="تأكيد الإلغاء الإداري">
            <p>
              الإلغاء الإداري للحجز الجارٍ فعل نهائي بسبب مكتوب — يُبلَّغ صاحب الحجز فورًا، ويبقى سجل الحجز
              للطرفين.
            </p>
            <label className="micro-field">
              <span>معرّف الحجز</span>
              <input
                value={cancelBookingId}
                onChange={event => setCancelBookingId(event.target.value)}
                dir="ltr"
              />
            </label>
            <label className="micro-field">
              <span>السبب (إلزامي)</span>
              <input
                value={cancelReason}
                onChange={event => setCancelReason(event.target.value)}
                placeholder="مثال: خطر على الناس"
              />
            </label>
            <div className="micro-form-actions">
              <Button action="quiet" disabled={actionBusy} onClick={() => setCancelConfirming(false)}>
                تراجع
              </Button>
              <Button
                action="commit"
                disabled={actionBusy || cancelBookingId.trim().length < 2 || cancelReason.trim().length < 4}
                onClick={() => void runCancel()}
              >
                {actionBusy ? "جارٍ الإلغاء…" : "ألغِ الحجز"}
              </Button>
            </div>
          </div>
        )}
      </section>

      {decisions.phase === "ready" ? (
        <section className="micro-admin-section" aria-labelledby="admin-decisions-title">
          <h2 id="admin-decisions-title">سجل القرارات</h2>
          {decisions.value.length === 0 ? (
            <p className="micro-admin-empty">لا قرارات مسجلة بعد.</p>
          ) : (
            <ul className="admin-decisions" data-testid="admin-decisions">
              {decisions.value.slice(0, 20).map(decision => (
                <li key={decision.id}>
                  <div>
                    {decisionLabel(decision.action)}
                    {decision.reason ? <span> — {decision.reason}</span> : null}
                  </div>
                  <div className="micro-admin-decision-meta">
                    {decision.actorName ?? "مشرف"} · {ageLabel(decision.ageMs)} ·{" "}
                    {decision.result === "success" ? "نُفِّذ" : decision.result}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {actionNotice ? (
        <p className="micro-save-note" role="status">
          {actionNotice}
        </p>
      ) : null}
      {actionError ? (
        <p className="micro-field-error" role="alert">
          {actionError}
        </p>
      ) : null}
      <p className="micro-admin-footer" data-testid="admin-footer">
        <ShieldAlert aria-hidden="true" size={14} /> حساب الإدارة منفصل عن أدوار العمل، وتفعيل التحقق بخطوتين
        على حسابه فحص تشغيلي على المشغل لا يُدّعى من الكود.
      </p>
    </section>
  );
}
