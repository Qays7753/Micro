/**
 * ملف المالك والمشروع (المجموعة ١ — Scope G): هوية مالك محلية + معلومات المشروع.
 * سطح قراءة بسيط يُفتح من الترويسة/الإعدادات بلا مقعد سادس، والرجوع يحفظ المصدر.
 * لا OAuth ولا مزامنة ولا زر «تسجيل دخول» وهمي — ملاحظة مستقبلية هادئة فقط.
 */
import { ArrowRight, CircleUserRound, Landmark, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { formatLocalDate, localDateInAmman } from "@/presentation/formatters";
import { resolveReturnPath, withReturnTo } from "@/app/navigationContract";
import { useUnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import { useReturnPath } from "@/app/useReturnNavigation";

import { Button } from "@/components/primitives";
type ProfileState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | {
      phase: "ready";
      owner: { ownerId: string; displayName: string | null; email: string | null };
      project: {
        activityName: string;
        walletCount: number;
        firstWalletName: string | null;
        unknownOpeningCount: number;
        lastVerifiedExportAt: string | null;
      };
    };

const shortOwnerId = (ownerId: string) => (ownerId.length > 14 ? `${ownerId.slice(0, 14)}…` : ownerId);

export default function Profile() {
  const [location, navigate] = useLocation();
  const search = useSearch();
  const returnPath = useReturnPath();
  const { ownerProfile, profiles, cashContinuity, preferences, dataVersion, notifyDataChanged } =
    usePrototypeServices();
  const [state, setState] = useState<ProfileState>({ phase: "loading" });
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  /* S03 (UNIT-039 — دمج 038/039): محرر اسم المشروع انتقل إلى قسم «بيانات
   * المشروع» داخل الإعدادات بحد كتابة محروس واحد (CAS) — هذه الصفحة هوية
   * المالك وحدها الآن؛ لا محرر اسم ثانٍ منافس ولا كتابة غير محروسة. */
  /* R9-GA-F3.6b (استمرار R9 الجذري): نبرة الرسالة في الحالة لا بقراءة
   * بادئة النص — العنصر الواحد كان يخلط النجاح مع الخطأ بصفة إعلان
   * واحدة (status) فيُخفى الخطأ الفعلي. الفصل الكنوني: خطأ ⇒
   * micro-field-error + alert، نجاح ⇒ micro-save-note + status. */
  const [message, setMessage] = useState<{ text: string; tone: "error" | "success" } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [returnTarget] = useState(() => resolveReturnPath(search, "/", location));

  useEffect(() => {
    let active = true;
    Promise.all([
      ownerProfile.ensureLocal(),
      profiles.load(),
      cashContinuity.overview(),
      preferences.readLastVerifiedExport(),
    ]).then(([owner, profile, cash, exportInfo]) => {
      if (!active) return;
      if (!owner.ok) {
        setState({ phase: "error", message: owner.message });
        return;
      }
      if (!profile.ok) {
        setState({ phase: "error", message: profile.message });
        return;
      }
      if (!cash.ok) {
        setState({ phase: "error", message: cash.message });
        return;
      }
      if (!exportInfo.ok) {
        setState({ phase: "error", message: exportInfo.message });
        return;
      }
      setState({
        phase: "ready",
        owner: {
          ownerId: owner.value?.ownerId ?? "—",
          displayName: owner.value?.displayName ?? null,
          email: owner.value?.email ?? null,
        },
        project: {
          activityName: profile.value?.activityName ?? "",
          walletCount: cash.value.wallets.length,
          firstWalletName: cash.value.wallets[0]?.name ?? null,
          unknownOpeningCount: cash.value.unknownOpeningCount,
          lastVerifiedExportAt: exportInfo.exportedAt,
        },
      });
    });
    return () => {
      active = false;
    };
  }, [ownerProfile, profiles, cashContinuity, preferences, dataVersion]);

  const isDirty =
    isEditing &&
    state.phase === "ready" &&
    (displayName !== (state.owner.displayName ?? "") || email !== (state.owner.email ?? ""));

  async function save(): Promise<boolean> {
    if (state.phase !== "ready") return false;
    setIsSaving(true);
    setMessage(null);
    const ownerResult = await ownerProfile.save({
      displayName: displayName || null,
      email: email || null,
    });
    if (!ownerResult.ok) {
      setIsSaving(false);
      setMessage({ text: ownerResult.message, tone: "error" });
      return false;
    }
    setIsSaving(false);
    notifyDataChanged();
    setMessage({ text: "حُفظ ملفك محليًا على هذا الجهاز.", tone: "success" });
    setIsEditing(false);
    return true;
  }

  const requestNavigation = useUnsavedChangesGuard({ isDirty, onSave: save });

  function beginEdit() {
    if (state.phase !== "ready") return;
    setDisplayName(state.owner.displayName ?? "");
    setEmail(state.owner.email ?? "");
    setMessage(null);
    setIsEditing(true);
  }

  function cancelEdit() {
    setIsEditing(false);
    setMessage(null);
  }

  if (state.phase === "loading")
    return (
      <div className="micro-route-loading" role="status">
        جارٍ فتح ملفك المحلي…
      </div>
    );
  if (state.phase === "error")
    return (
      <section className="micro-page micro-not-found">
        <h1>تعذر فتح ملفك</h1>
        <p role="alert">{state.message}</p>
        <Button
          action="save"

          onClick={() => window.location.reload()}
        >
          إعادة المحاولة
        </Button>
      </section>
    );

  const { owner, project } = state;
  return (
    <section className="micro-page micro-profile-page">
      <button
        className="micro-back-button"
        type="button"
        onClick={() => requestNavigation(returnTarget || returnPath)}
      >
        <ArrowRight aria-hidden="true" /> رجوع
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">ملف محلي</span>
        <h1>ملفك وملف مشروعك</h1>
        <p>هوية المالك ومعلومات المشروع — منفصلان عن المال والسجلات.</p>
      </div>
      <section className="micro-profile-section" aria-labelledby="owner-identity-title">
        <div className="micro-section-title">
          <CircleUserRound aria-hidden="true" />
          <div>
            <h2 id="owner-identity-title">هوية المالك</h2>
          </div>
        </div>
        {isEditing ? (
          <div className="micro-profile-fields">
            <label className="micro-field">
              <span>اسمك</span>
              <input
                value={displayName}
                onChange={event => setDisplayName(event.target.value)}
                placeholder="مثال: ليان"
              />
              <small>اختياري — يظهر في ملفك فقط.</small>
            </label>
            <label className="micro-field">
              <span>بريدك الإلكتروني</span>
              <input
                value={email}
                onChange={event => setEmail(event.target.value)}
                placeholder="مثال: name@mail.com"
                inputMode="email"
                dir="ltr"
                lang="en"
              />
              <small>اختياري — لا يُستخدم لأي مزامنة في هذا الإصدار.</small>
            </label>
          </div>
        ) : (
          <dl className="micro-profile-facts">
            <div>
              <dt>اسمك</dt>
              <dd>{owner.displayName ?? "غير مكتوب بعد — اختياري"}</dd>
            </div>
            <div>
              <dt>بريدك الإلكتروني</dt>
              <dd>{owner.email ? <bdi dir="ltr">{owner.email}</bdi> : "غير مكتوب — اختياري"}</dd>
            </div>
            <div>
              <dt>معرّف المالك المحلي</dt>
              <dd dir="ltr" title={owner.ownerId}>
                {shortOwnerId(owner.ownerId)}
              </dd>
            </div>
            <div>
              <dt>حالة الهوية</dt>
              <dd>محلي على هذا الجهاز</dd>
            </div>
          </dl>
        )}
        <p className="micro-profile-future-note">
          تسجيل الدخول والمزامنة ستتوفر لاحقًا — ليست مفعّلة في هذا الإصدار.
        </p>
        {/* S03: التعديل هنا لهوية المالك وحدها — الاسم اختياري بلا غرض مصادقة. */}
        {message ? (
          <p
            className={message.tone === "error" ? "micro-field-error" : "micro-save-note"}
            role={message.tone === "error" ? "alert" : "status"}
          >
            {message.text}
          </p>
        ) : null}
        <div className="micro-form-actions">
          {isEditing ? (
            <>
              <Button action="secondary" disabled={isSaving} onClick={cancelEdit}>
                إلغاء التعديل
              </Button>
              <Button action="save" disabled={isSaving} onClick={() => void save()}>
                {isSaving ? "جارٍ الحفظ…" : "احفظ ملفك"}
              </Button>
            </>
          ) : (
            <Button action="secondary" onClick={beginEdit}>
              عدّل ملفك
            </Button>
          )}
        </div>
      </section>
      <section className="micro-profile-section" aria-labelledby="project-profile-title">
        <div className="micro-section-title">
          <Landmark aria-hidden="true" />
          <div>
            <h2 id="project-profile-title">ملف المشروع</h2>
          </div>
        </div>
        {/* S03 (UNIT-039 — دمج 038/039): عرض قراءة فقط — تعديل الاسم من قسم
            «بيانات المشروع» في الإعدادات (الحد المحروس الوحيد)؛ لا محرر
            ثانٍ هنا ولا كتابة من هذه الصفحة. أثناء تعديل بيانات المالك تُخفى
            الحقائق (سلوك الشاشة القائم) — القراءة تعود مع نهاية التعديل. */}
        {isEditing ? null : (
          <dl className="micro-profile-facts">
            <div>
              <dt>اسم المشروع</dt>
              <dd>
                {project.activityName || "غير مكتوب"}{" "}
                {/* S03 (UNIT-039 — دمج 038/039): المحرر الوحيد للاسم في قسم «بيانات المشروع»
                  بالإعدادات (حد كتابة محروس CAS) — لا محرر ثانٍ ولا كتابة من هنا. */}
                <button
                  className="micro-text-action"
                  type="button"
                  onClick={() => navigate(withReturnTo("/settings", "/profile"))}
                >
                  عدّله من الإعدادات
                </button>
              </dd>
            </div>
            <div>
              <dt>العملة واللغة</dt>
              <dd>الدينار الأردني · العربية · من اليمين لليسار</dd>
            </div>
            <div>
              <dt>المحفظة</dt>
              <dd>
                {project.walletCount === 0
                  ? "لم تُسجَّل محفظة بعد"
                  : project.walletCount === 1
                    ? project.firstWalletName
                    : `${project.walletCount} محافظ مسجلة`}
              </dd>
            </div>
            <div>
              <dt>حالة الرصيد الافتتاحي</dt>
              <dd>
                {project.walletCount === 0
                  ? "غير مسجل"
                  : project.unknownOpeningCount > 0
                    ? "غير محدد بعد — رصيد لم يُوثَّق"
                    : "محدد"}
              </dd>
            </div>
            <div>
              <dt>آخر نسخة احتياطية متحققة</dt>
              <dd>
                {project.lastVerifiedExportAt
                  ? /* المجموعة ٦ (البند ٥): رقمي DD/MM/YYYY بجدار ثنائي الاتجاه —
                     نسق ar-JO كان يعرض أرقامًا هندية. */
                    (() => {
                      const display = formatLocalDate(localDateInAmman(project.lastVerifiedExportAt));
                      return display ? <bdi dir="ltr">{display}</bdi> : "—";
                    })()
                  : "لا نسخة بعد"}
              </dd>
            </div>
          </dl>
        )}
      </section>
      <section className="micro-local-truth" aria-label="حقيقة التخزين">
        <ShieldCheck aria-hidden="true" />
        <p>
          <b>سطر حقيقة:</b> بياناتك محفوظة على هذا الجهاز — لا حساب سحابي ولا نسخ تلقائي في هذا الإصدار.
        </p>
      </section>
    </section>
  );
}
