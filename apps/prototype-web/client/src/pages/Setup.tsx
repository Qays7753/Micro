/**
 * Anti-vibe setup: one required identity input, one default cash location, and an honest
 * opening-position choice — known / unknown / started-from-zero (owner principle 5.1).
 * Unknown is never rendered as zero; it stays an explicit unresolved state.
 */
/* مبدأ Micro: توحيد اسم العملة في البداية عرضي، ولا يغيّر القيمة الداخلية أو حدود الحفظ المحلي. */
import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { localDateInAmman } from "@/presentation/formatters";

type Step = 1 | 2 | 3;
type OpeningChoice = "known" | "unknown" | "zero";

/* U-003: مسودة الإعداد تبقى محفوظة محليًا أثناء الكتابة — بلا أي حدث مالي حتى
 * تأكيد المالك. استعادة آمنة: بيانات معطوبة تُتجاهل بلا انفجار، والمسودة
 * تُمسح بعد الإتمام أو بإعادة تعيين صريحة. */
const SETUP_DRAFT_KEY = "micro.setup-draft.v1";
type SetupDraft = {
  step: Step;
  activityName: string;
  walletName: string;
  openingChoice: OpeningChoice | null;
  openingMinor: number;
  savedAt: string;
};
function readSetupDraft(): SetupDraft | null {
  try {
    const raw = globalThis.localStorage?.getItem(SETUP_DRAFT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const candidate = parsed as Partial<SetupDraft>;
    const step: Step = candidate.step === 2 || candidate.step === 3 ? candidate.step : 1;
    if (
      typeof candidate.activityName !== "string" ||
      typeof candidate.walletName !== "string" ||
      (candidate.openingChoice !== null &&
        candidate.openingChoice !== undefined &&
        candidate.openingChoice !== "known" &&
        candidate.openingChoice !== "unknown" &&
        candidate.openingChoice !== "zero") ||
      (candidate.openingMinor !== undefined &&
        (typeof candidate.openingMinor !== "number" || !Number.isSafeInteger(candidate.openingMinor)))
    )
      return null;
    return {
      step,
      activityName: candidate.activityName,
      walletName: candidate.walletName || "الدرج",
      openingChoice:
        candidate.openingChoice === "known" ||
        candidate.openingChoice === "unknown" ||
        candidate.openingChoice === "zero"
          ? candidate.openingChoice
          : null,
      openingMinor: typeof candidate.openingMinor === "number" ? candidate.openingMinor : 0,
      savedAt: typeof candidate.savedAt === "string" ? candidate.savedAt : new Date().toISOString(),
    };
  } catch {
    /* بيانات معطوبة أو بيئة بلا تخزين — تُتجاهل بلا انفجال. */
    return null;
  }
}
function writeSetupDraft(draft: SetupDraft | null) {
  try {
    if (draft === null) globalThis.localStorage?.removeItem(SETUP_DRAFT_KEY);
    else globalThis.localStorage?.setItem(SETUP_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* لا تخزين متاح: تُفقد المسودة عند الانقطاع لكن لا يتعطل الإعداد. */
  }
}

export default function Setup() {
  const [, navigate] = useLocation();
  const { profiles, cashContinuity, notifyDataChanged } = usePrototypeServices();
  /* U-003: الاستعادة مرة واحدة عند الفتح — القيم المُدخلة سابقًا تعود كما كانت. */
  const [restoredDraft] = useState<SetupDraft | null>(() => readSetupDraft());
  const [step, setStep] = useState<Step>(() => restoredDraft?.step ?? 1);
  const [activityName, setActivityName] = useState(() => restoredDraft?.activityName ?? "");
  const [walletName, setWalletName] = useState(() => restoredDraft?.walletName ?? "الدرج");
  const [openingChoice, setOpeningChoice] = useState<OpeningChoice | null>(
    () => restoredDraft?.openingChoice ?? null,
  );
  const [openingMinor, setOpeningMinor] = useState(() => restoredDraft?.openingMinor ?? 0);
  const [openingValid, setOpeningValid] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [draftNotice, setDraftNotice] = useState<string | null>(
    () =>
      restoredDraft && (restoredDraft.activityName.trim() || restoredDraft.openingChoice)
        ? "استعدنا مسودة إعدادك من آخر مرة — أكمل من حيث توقفت؛ لم يُسجّل شيء بعد."
        : null,
  );
  /* U-003: كل تغيير يحفظ المسودة فورًا — كتابة صغيرة محلية بلا أثر مالي. */
  useEffect(() => {
    writeSetupDraft({
      step,
      activityName,
      walletName,
      openingChoice,
      openingMinor,
      savedAt: new Date().toISOString(),
    });
  }, [step, activityName, walletName, openingChoice, openingMinor]);

  async function submit() {
    setIsSaving(true);
    setError(null);
    const profileResult = await profiles.save(activityName);
    if (!profileResult.ok) {
      setIsSaving(false);
      setError(profileResult.message);
      return;
    }
    /* ٥.١: محفظة نقد افتراضية عند أول تشغيل — ما لم يختر المالك تخطي الخطوة كلها. */
    if (walletName.trim() && openingChoice) {
      const walletResult = await cashContinuity.openWallet({
        name: walletName.trim(),
        kind: "cash_drawer",
        openingMinor: openingChoice === "known" ? openingMinor : 0,
        occurredOn: localDateInAmman(),
        note:
          openingChoice === "known"
            ? "رصيد بداية معلن من الإعداد الأول"
            : openingChoice === "unknown"
              ? "رصيد غير معروف عند الإعداد الأول — يُحدَّد لاحقًا برصيد موثق"
              : "بدأت من الصفر — رصيد افتتاحي صفري موثق",
        operationKey: `setup-wallet-${profileResult.profile.id}`,
        openingStatus: openingChoice === "unknown" ? "unknown" : "known",
      });
      if (!walletResult.ok) {
        setIsSaving(false);
        setError(walletResult.message);
        return;
      }
    }
    notifyDataChanged();
    setIsSaving(false);
    /* U-003: الإتمام الناجح يمسح المسودة — لا تعود بعد أن صارت بيانات فعلية. */
    writeSetupDraft(null);
    /* §2.5: بعد الحد الأدنى، صفحة الأساس للعمق الاختياري — ثم الرئيسية بفعل واضح. */
    navigate("/foundation", { replace: true });
  }

  const nextFromStep2 = () => {
    if (!activityName.trim()) {
      setError("حط اسم لمشروعك أولًا.");
      setStep(1);
      return;
    }
    setError(null);
    setStep(3);
  };

  return (
    <section className="micro-page micro-setup-page">
      <div className="micro-page-heading micro-setup-heading">
        <span className="micro-overline">قرار البداية</span>
        <h1>{step === 1 ? "ما اسم مشروعك؟" : step === 2 ? "وين تحط فلوسك؟" : "شو وضع الدرج هلق؟"}</h1>
        <p>
          {step === 1
            ? "اسم واحد فقط إلزامي — كل ما بعده اختياري ويمكن إكماله لاحقًا."
            : step === 2
              ? "محفظة نقد افتراضية تكفي للبداية؛ تقدر تضيف محافظ أخرى لاحقًا من «مالي»."
              : "ثلاثة أجوبة صادقة: رقم تعرفه، أو «ما بعرف» الآن، أو بدأت فعلًا من الصفر."}
        </p>
        <div className="micro-setup-impact">
          <span>ما يعرفه Micro الآن</span>
          <strong>
            {/* P-003: تسمية محايدة — لا يفترض النظام قطاعًا ولا حرفة بعينها. */}
            مشروعك <b>·</b> الدينار الأردني <em>د.أ</em>
          </strong>
          <small>«ما بعرف» تبقى حالة معلنة — لا تُعرض صفرًا في أي شاشة.</small>
        </div>
      </div>
      {/* U-003: إشعار الاستعادة مع إعادة تعيين صريحة عند الطلب. */}
      {draftNotice ? (
        <p className="micro-save-note" role="status">
          {draftNotice}{" "}
          <button
            className="micro-text-action"
            type="button"
            onClick={() => {
              writeSetupDraft(null);
              setDraftNotice(null);
              setStep(1);
              setActivityName("");
              setWalletName("الدرج");
              setOpeningChoice(null);
              setOpeningMinor(0);
              setError(null);
            }}
          >
            ابدأ الإعداد من جديد
          </button>
        </p>
      ) : null}
      <form
        className="micro-form-card micro-setup-decision"
        onSubmit={event => {
          event.preventDefault();
          if (step === 1) {
            if (!activityName.trim()) {
              setError("حط اسم لمشروعك أولًا.");
              return;
            }
            setError(null);
            setStep(2);
            return;
          }
          if (step === 2) {
            nextFromStep2();
            return;
          }
          if (step === 3) {
            if (openingChoice === "known" && (!openingValid || openingMinor < 0)) {
              setError("أدخل الرصيد بالأرقام 0–9.");
              return;
            }
            void submit();
          }
        }}
      >
        <div className="micro-setup-step">
          <span>{step}</span>
          <div>
            <b>
              {step === 1 ? "سمّ سجل مشروعك" : step === 2 ? "أماكن الفلوس" : "الموقف الافتتاحي"}
            </b>
            <p>
              {step === 1
                ? "سترى هذا الاسم في سجل الطلبات، وصفحة الأساس بعده اختيارية بالكامل."
                : step === 2
                  ? "محفظة «الدرج» مقترحة افتراضيًا — عدّل اسمها أو تخطَّ هذه الخطوة."
                  : "اختيارك يُسجَّل كما هو: معرفة، أو مجهولة معلنة، أو صفر موثق."}
            </p>
          </div>
        </div>
        {step === 1 ? (
          <label className="micro-field">
            <span>اسم المشروع</span>
            <input
              autoFocus
              value={activityName}
              onChange={event => setActivityName(event.target.value)}
              placeholder="مثال: مشغل ليان"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "setup-error" : undefined}
            />
          </label>
        ) : null}
        {step === 2 ? (
          <>
            <label className="micro-field">
              <span>اسم محفظة النقد الافتراضية</span>
              <input
                autoFocus
                value={walletName}
                onChange={event => setWalletName(event.target.value)}
                placeholder="الدرج"
              />
            </label>
            <button
              className="micro-text-action"
              type="button"
              disabled={isSaving}
              onClick={() => {
                /* F-002: تخطّي المحفظة يتخطى سؤال الموقف الافتتاحي أيضًا — لا يُسأل جواب
                 * ثم يُهمل عند الحفظ. المحفظة والرصيد يُسجَّلان لاحقًا من «مالي». */
                if (!activityName.trim()) {
                  setError("حط اسم لمشروعك أولًا.");
                  setStep(1);
                  return;
                }
                setWalletName("");
                setOpeningChoice(null);
                setError(null);
                void submit();
              }}
            >
              تخطَّ المحفظة الآن — أسجلها لاحقًا من «مالي» <ArrowLeft aria-hidden="true" />
            </button>
          </>
        ) : null}
        {step === 3 ? (
          <div className="micro-wallet-select-grid">
            <label className="micro-field">
              <span>الموقف الافتتاحي</span>
              <select
                value={openingChoice ?? ""}
                onChange={event =>
                  setOpeningChoice(
                    event.target.value === "known"
                      ? "known"
                      : event.target.value === "unknown"
                        ? "unknown"
                        : event.target.value === "zero"
                          ? "zero"
                          : null,
                  )
                }
              >
                <option value="">اختر جوابًا</option>
                <option value="known">أعرف الرقم</option>
                <option value="unknown">ما بعرف الآن — يُحدَّد لاحقًا</option>
                <option value="zero">بدأت من الصفر</option>
              </select>
            </label>
            {openingChoice === "known" ? (
              <label className="micro-field">
                <span>كم في الدرج الآن؟ (د.أ)</span>
                <EnglishNumberInput
                  value={openingMinor}
                  kind="money"
                  onNumericChange={setOpeningMinor}
                  onTextValidityChange={setOpeningValid}
                  aria-label="الرصيد الافتتاحي"
                />
                <small>تاريخ البداية يقبل يومًا سابقًا لاحقًا من صفحة المحفظة.</small>
              </label>
            ) : null}
            {openingChoice === "unknown" ? (
              <p className="micro-field-error" role="status">
                ستبقى المحفظة «غير محددة» — تُظهر طريقًا لإدخال رصيد موثق لاحقًا، ولا تُعرض صفرًا أبدًا.
              </p>
            ) : null}
            {openingChoice === "zero" ? (
              <p className="micro-save-note" role="status">
                صفر موثق = بداية نظيفة معلنة؛ ليس مجهولًا مقنّعًا.
              </p>
            ) : null}
          </div>
        ) : null}
        {error ? (
          <p id="setup-error" className="micro-field-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="micro-local-truth">
          <ShieldCheck aria-hidden="true" />
          <p>
            <b>سطر حقيقة:</b> كل ما تدخله هنا يُحفظ على هذا الجهاز فقط في هذا الإصدار.
          </p>
        </div>
        <div className="micro-form-actions">
          {step > 1 ? (
            <button
              className="micro-button micro-button-secondary"
              type="button"
              onClick={() => setStep(current => (current === 3 ? 2 : 1))}
            >
              <ArrowRight aria-hidden="true" /> خطوة سابقة
            </button>
          ) : null}
          <button className="micro-button micro-button-primary micro-button-block" type="submit" disabled={isSaving}>
            {isSaving
              ? "جارٍ الحفظ…"
              : step === 1
                ? "التالي"
                : step === 2
                  ? "التالي"
                  : "احفظ وافتح صفحة الأساس"}
            {step === 3 && !isSaving ? <ArrowLeft aria-hidden="true" /> : null}
          </button>
        </div>
      </form>
    </section>
  );
}
