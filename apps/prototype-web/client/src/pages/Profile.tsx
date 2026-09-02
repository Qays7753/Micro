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
import { resolveReturnPath } from "@/app/navigationContract";
import { useUnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import { useReturnPath } from "@/app/useReturnNavigation";

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
  const [projectName, setProjectName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
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
    (displayName !== (state.owner.displayName ?? "") ||
      email !== (state.owner.email ?? "") ||
      projectName.trim() !== state.project.activityName);

  async function save(): Promise<boolean> {
    if (state.phase !== "ready") return false;
    if (!projectName.trim()) {
      setMessage("اسم المشروع لا يمكن أن يصبح فارغًا؛ اكتب اسمًا أو ألغِ التعديل.");
      return false;
    }
    setIsSaving(true);
    setMessage(null);
    const ownerResult = await ownerProfile.save({
      displayName: displayName || null,
      email: email || null,
    });
    if (!ownerResult.ok) {
      setIsSaving(false);
      setMessage(ownerResult.message);
      return false;
    }
    const projectResult = await profiles.save(projectName.trim());
    if (!projectResult.ok) {
      setIsSaving(false);
      setMessage(projectResult.message);
      return false;
    }
    setIsSaving(false);
    notifyDataChanged();
    setMessage("حُفظ ملفك محليًا على هذا الجهاز.");
    setIsEditing(false);
    return true;
  }

  const requestNavigation = useUnsavedChangesGuard({ isDirty, onSave: save });

  function beginEdit() {
    if (state.phase !== "ready") return;
    setDisplayName(state.owner.displayName ?? "");
    setEmail(state.owner.email ?? "");
    setProjectName(state.project.activityName);
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
        <p>{state.message}</p>
        <button className="micro-button micro-button-primary" type="button" onClick={() => window.location.reload()}>
          إعادة المحاولة
        </button>
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
              <dd>{owner.email ?? "غير مكتوب — اختياري"}</dd>
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
      </section>
      <section className="micro-profile-section" aria-labelledby="project-profile-title">
        <div className="micro-section-title">
          <Landmark aria-hidden="true" />
          <div>
            <h2 id="project-profile-title">ملف المشروع</h2>
          </div>
        </div>
        {isEditing ? (
          <div className="micro-profile-fields">
            <label className="micro-field">
              <span>اسم المشروع</span>
              <input value={projectName} onChange={event => setProjectName(event.target.value)} />
              <small>الاسم الذي يظهر في «مشروعي الآن» وفي السجلات.</small>
            </label>
          </div>
        ) : (
          <dl className="micro-profile-facts">
            <div>
              <dt>اسم المشروع</dt>
              <dd>{project.activityName || "غير مكتوب"}</dd>
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
        {message ? (
          <p className={message.includes("حُفظ") ? "micro-save-note" : "micro-field-error"} role="status">
            {message}
          </p>
        ) : null}
        <div className="micro-form-actions">
          {isEditing ? (
            <>
              <button
                className="micro-button micro-button-secondary"
                type="button"
                disabled={isSaving}
                onClick={cancelEdit}
              >
                إلغاء التعديل
              </button>
              <button
                className="micro-button micro-button-primary"
                type="button"
                disabled={isSaving}
                onClick={() => void save()}
              >
                {isSaving ? "جارٍ الحفظ…" : "احفظ ملفك"}
              </button>
            </>
          ) : (
            <button className="micro-button micro-button-secondary" type="button" onClick={beginEdit}>
              عدّل ملفك
            </button>
          )}
        </div>
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
