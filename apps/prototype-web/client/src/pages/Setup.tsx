/**
 * UNIT-001 V2 (مواصفة 2026-10-18): إعداد المشروع لأول استخدام — شاشة واحدة:
 * اسم المشروع وفعل رئيسي واحد ومدخل استعادة يفوّض لمالك 044 القائم في
 * الإعدادات، ومعلومات الإعداد خلف أيقونة تفتح حوار المكتبة المعتمد.
 *
 * ملكية صريحة (B-DUP):
 * - DUP-001: لا محفظة ولا رصيد افتتاحي ولا أي حدث مالي من هذه الشاشة أبدًا —
 *   إعداد النقد ملك UNIT-022/المحافظ القائمة؛ غياب السجل لا يعني صفرًا.
 * - DUP-002: الإنشاء فقط عبر ProfileService.create() الـidempotent — الهوية
 *   القائمة تُفتح ولا تُعدَّل من هنا؛ تعديل الاسم ملك 039 (Profile).
 * - DUP-005: الاستعادة تفوّض لمالك 044 (الإعدادات ← البيانات والنسخ الاحتياطي)
 *   عبر عقد التنقل returnTo؛ لا صفحة استيراد ثانية ولا نسخ حماية.
 * - DUP-023: مسودة الاسم وحدها منفصلة عن الهوية النهائية داخل الحد الموحّد
 *   (عقد ٣٦)؛ لا تُطبق قيم مالية من مسودات الأجيال السابقة أبدًا.
 */
import { Info } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { storageRecoveryCopy } from "@/app/StartupGate";
import { withReturnTo } from "@/app/navigationContract";
import { Button } from "@/components/primitives";

/* نوع فشل التخزين مشتق من المصدر المشترك نفسه (StartupGate) — لا حافة نوعية
 * جديدة من الواجهة إلى التخزين (R10A-F-006/OD-GUARD): نُسخ الاسترداد نص مشترك
 * والنوع يتبعه. */
type ProfileReadFailure = Parameters<typeof storageRecoveryCopy>[0];

/* U-003 + المجموعة ٥ + عقد ٣٦: مسودة الإعداد داخل حد المسودات العابر الموحّد
 * (نوع setup) — كتابة مؤقتة بلا أي حدث مالي؛ الاستعادة فعل صريح من المالك.
 * UNIT-001 V2 (DUP-023): قيم المسودة اسم فقط — أي حقول تراثية (walletName/
 * openingChoice/openingMinor) في مسودات الأجيال السابقة لا تُقرأ ولا تُطبق
 * ولا تُحوَّل إلى مال أبدًا. */
/* S03 (UNIT-001 P3.2): تفضيل ما يقدمه المشروع ينضم لقيم المسودة — اختيار
 * اختياري محايد مستقل يُسترد مع الاسم بالعرض الصريح نفسه؛ لا قيم مالية. */
type OfferingChoice = "products" | "services" | "both";
type SetupDraft = {
  activityName: string;
  offeringPreference: OfferingChoice | null;
  savedAt: string;
};
/* S03: القيم الكنونية للتفضيل — نفس معجم مالك التخزين (038)، لا قائمة
 * محلية منافسة ولا قيمة رابعة مبتكرة. */
const SETUP_OFFERING_CHOICES: readonly OfferingChoice[] = ["products", "services", "both"];
const isOfferingChoice = (value: unknown): value is OfferingChoice =>
  typeof value === "string" && (SETUP_OFFERING_CHOICES as readonly string[]).includes(value);
/* الإكراه الدفاعي نفسه (قواعد U-003): كل قيم المسودة المقروءة من الحد الموحّد
 * تمر من هنا قبل عرضها — الاسم نص أو لا عرض؛ لا مسار تراثي موازٍ. */
function coerceSetupDraft(raw: unknown): SetupDraft | null {
  if (typeof raw !== "object" || raw === null) return null;
  const candidate = raw as Partial<SetupDraft>;
  if (typeof candidate.activityName !== "string") return null;
  /* S03: التفضيل من المعجم المغلق أو محايد — أي قيمة أخرى تُكره بصدق إلى
   * المحايد فلا تُطبق قيمة مجهولة أبدًا. */
  return {
    activityName: candidate.activityName,
    offeringPreference: isOfferingChoice(candidate.offeringPreference) ? candidate.offeringPreference : null,
    savedAt: typeof candidate.savedAt === "string" ? candidate.savedAt : new Date().toISOString(),
  };
}
const hasRealSetupInput = (draft: Pick<SetupDraft, "activityName">): boolean =>
  draft.activityName.trim() !== "";

export default function Setup() {
  const [, navigate] = useLocation();
  const { profiles, preferences, notifyDataChanged, formDrafts } = usePrototypeServices();
  const [activityName, setActivityName] = useState("");
  const [nameError, setNameError] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  /* S03 (UNIT-001 P3.1/P3.2): تفضيل ما يقدمه المشروع — سؤال البداية الاختياري
   * المحايد ("" = لم يُحدد بعد)؛ مستقل تمامًا عن workMode (طريقة مواد/وقت في
   * الإعدادات) ولا يُخلط بنوع النشاط ولا يعيد تصنيف أي سجل تاريخي. */
  const [offering, setOffering] = useState<OfferingChoice | "">("");
  /* S03 (UNIT-001 P3.2 — حرس الفصل الصادق): نجاح الهوية مع فشل حفظ التفضيل
   * الاختياري يُعلن جزئيًا كما هو — لا إعادة إنشاء للهوية ولا ابتلاع للفشل
   * ولا نجاح صامت؛ إعادة المحاولة تخص التفضيل وحده، والمتابعة قرار المالك. */
  const [preferenceSaveFailed, setPreferenceSaveFailed] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  /* R02/B4: حارس وجود الهوية — القراءة عند الفتح تفصل «لا ملف» (تعرض الشاشة)
   * عن «فشل القراءة» (استرداد) عن «ملف قائم» (يفتح المشروع؛ لا هوية ثانية
   * ولا تعديل من مسار الإعداد، ولا مشروع جديد لتغطية فشل قراءة). */
  const [profileCheck, setProfileCheck] = useState<"absent" | "read-failed">("absent");
  const [storageFailure, setStorageFailure] = useState<ProfileReadFailure | null>(null);
  /* U-003 + المجموعة ٥: القراءة عند الفتح تعرض استعادة صريحة — لا تطبيق
   * للقيم إلا بفعل المالك؛ والقراءة من حد المسودات العابرة الموحّد وحده.
   * R11 ARCH-012 (2026-10-15): ترحيل مفتاح الصفحة القديم تقاعد بقرار مالك —
   * القراءة الحية وحدها تبقى هنا.
   * R11 ARCH-012-NF-001 (موجة المتابعة الموحدة 2026-10-16): دورة حياة صريحة
   * خالية من السباق — لا كتابة ولا مسح قبل استقرار قراءة الفتح، ولا مسح
   * والعرض قائم أو الحالة مجهولة (فشل قراءة)، والمسح الفارغ مرة واحدة عند
   * الانتقال الحقيقي←الفارغ فقط. */
  const [draftOffer, setDraftOffer] = useState<SetupDraft | null>(null);
  const [draftSaveFailed, setDraftSaveFailed] = useState(false);
  /* U001-IR-003 (مراجعة مستقلة 2026-10-18): الطابع المتوقع للمسودة — آخر حالة
   * معروفة لهذه الجلسة من حد المسودات الموحّد (عقد ٣٦: نافذة قديمة لا تطمس
   * أحدث). يُقرأ من قراءة الفتح، ويُمرّر في كل حفظ، ولا يتحدث إلا بعد حفظ
   * ناجح، ويُصفّر بعد تجاهل/مسح ناجح — القبول الصريح للاستعادة يستمر من
   * طابع العرض المقبول نفسه. */
  const draftExpectedUpdatedAt = useRef<string | null>(null);
  /* سلسلة كتابة واحدة للحفظ والمسح: الكتابات تتسلسل فلا يتعارض حفظ متأخر مع
   * حفظ سابق لنفس النافذة بطابع متقادم، ولا يُبعث مسود بعد مسح ناجح. */
  const draftWriteChain = useRef<Promise<unknown>>(Promise.resolve());
  const enqueueDraftWrite = (operation: () => Promise<void>) => {
    draftWriteChain.current = draftWriteChain.current.then(operation, operation);
  };
  /* U001-IR-003: التعارض حالة صادقة معلنة — نص الخدمة المعتمد يظهر كما هو
   * (role=alert) ولا يُبتلع نجاحًا صمتًا ولا يُعرض كفشل تخزين. */
  const [draftConflict, setDraftConflict] = useState<string | null>(null);
  /* بوابة الاستقرار: تحجز أثر الحفظ/المسح كله حتى تستقر قراءة الفتح. */
  const [draftReadSettled, setDraftReadSettled] = useState(false);
  /* أمان المسح: لا يمسح المسودة الفارغة إلا بعد قراءة مستقرة ناجحة أو حفظ
   * ناجح في هذه الجلسة — فشل القراءة يبقي الحالة مجهولة فلا مسح أعمى. */
  const draftClearSafe = useRef(false);
  /* المسح عند العودة إلى الفراغ مرة واحدة بالضبط لكل دورة إدخال حقيقي. */
  const hadRealInput = useRef(false);
  /* R08/B4: حوار معلومات الإعداد — يفتح من الأيقونة ويغلق بالزر أو Escape أو
   * الرجوع؛ فتحه وإغلاقه لا يحفظان المشروع ولا يغيران الاسم أبدًا. */
  const [infoOpen, setInfoOpen] = useState(false);
  const infoSentinelRef = useRef(false);
  const suppressInfoPopRef = useRef(false);
  const infoOpenRef = useRef(false);
  useEffect(() => {
    infoOpenRef.current = infoOpen;
  }, [infoOpen]);

  /* R02: عند الفتح يُقرأ مصدر الهوية الواحد — النجاح بلا ملف يعرض الإعداد
   * (فشل القراءة ليس بيانات فارغة)، والملف القائم يفتح المشروع فورًا. */
  useEffect(() => {
    let active = true;
    void profiles.load().then(result => {
      if (!active) return;
      if (!result.ok) {
        setStorageFailure(result);
        setProfileCheck("read-failed");
        return;
      }
      if (result.value) {
        navigate("/", { replace: true });
        return;
      }
      setProfileCheck("absent");
    });
    return () => {
      active = false;
    };
  }, [profiles, navigate]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const result = await formDrafts.read("setup", null);
      if (!active) return;
      if (result.ok) {
        draftClearSafe.current = true;
        /* U001-IR-003: الطابع المتوقع يُستقر من قراءة الفتح نفسها — الغلاف كما
         * هو (حتى غير القابل للإكراه) يملك طابعه؛ الغياب طابع معدوم. */
        draftExpectedUpdatedAt.current = result.value === null ? null : result.value.updatedAt;
        if (result.value !== null) {
          const coerced = coerceSetupDraft(result.value.values);
          if (coerced !== null && hasRealSetupInput(coerced)) setDraftOffer(coerced);
        }
      }
      setDraftReadSettled(true);
    })();
    return () => {
      active = false;
    };
  }, [formDrafts]);
  /* U-003/R09: كل تغير حقيقي يحفظ مسودة الاسم فورًا — كتابة صغيرة محلية بلا
   * أثر مالي؛ المسودة الفارغة من الإدخال الحقيقي لا تُنشأ أصلًا، ومسح ما
   * أنشأته الجلسة يستقر إلى مصيره الصريح وحده. */
  const offerPending = draftOffer !== null;
  useEffect(() => {
    /* NF-001: لا كتابة (حفظًا أو مسحًا) قبل استقرار قراءة الفتح، ولا كتابة
     * والعرض قائم — القرار الصريح وحده يحرك السجل. */
    if (!draftReadSettled) return;
    if (offerPending) return;
    /* S03: التفضيل يُحفظ مع الاسم في المسودة نفسها — لكن المسودة لا تُنشأ
     * إلا بمدخل حقيقي (الاسم)؛ تفضيل بلا اسم ليس إعدادًا معلقًا. */
    const values = {
      activityName,
      offeringPreference: offering === "" ? null : offering,
      savedAt: new Date().toISOString(),
    } satisfies SetupDraft;
    const real = hasRealSetupInput(values);
    if (!real) {
      setDraftSaveFailed(false);
      setDraftConflict(null);
      if (hadRealInput.current && draftClearSafe.current) {
        hadRealInput.current = false;
        enqueueDraftWrite(async () => {
          const removed = await formDrafts.discard("setup", null);
          /* U001-IR-003: التصفير بعد مسح ناجح فقط — فشل المسح يبقي الطابع على
           * آخر حالة صحيحة معروفة فلا تعارض زائف ولا طمس. */
          if (removed.ok) draftExpectedUpdatedAt.current = null;
        });
      }
      return;
    }
    hadRealInput.current = true;
    enqueueDraftWrite(async () => {
      /* U001-IR-003: كل حفظ يمر بالطابع المتوقع (عقد ٣٦) — النافذة القديمة
       * تتعارض ولا تكتب فوق الأحدث، والقيم تبقى أمام المستخدم. */
      const result = await formDrafts.save("setup", null, { ...values }, draftExpectedUpdatedAt.current);
      if (result.ok) {
        draftClearSafe.current = true;
        draftExpectedUpdatedAt.current = result.value.updatedAt;
        setDraftSaveFailed(false);
        setDraftConflict(null);
      } else if (result.code === "conflict") {
        /* لا طمس حدث ولا نجاح صمت — نص الخدمة الصادق معروض كما هو حتى يقرر
         * المالك (إكمال/تفريغ/تجاهل)؛ الطابع المتوقع لا يتغير هنا. */
        setDraftConflict(result.message);
      } else {
        setDraftSaveFailed(true);
      }
    });
  }, [activityName, offering, offerPending, draftReadSettled, formDrafts]);
  /* إدخال جديد قبل حل عرض الاستعادة: الإدخال الجديد هو الأساس — يُخفى العرض
   * وتُدار المسودة بقيم المستخدم (نفس دلالة محرر الأحداث). */
  useEffect(() => {
    if (!offerPending) return;
    if (activityName.trim() !== "") setDraftOffer(null);
  }, [activityName, offerPending]);

  /* R08/B4: زر الرجوع (المتصفح/الهاتف) يغلق الحوار وحده ولا يغادر الشاشة —
   * حارس entry تاريخي واحد يفتح مع الحوار ويُستهلك عند إغلاقه. */
  useEffect(() => {
    const onPopState = () => {
      if (suppressInfoPopRef.current) {
        suppressInfoPopRef.current = false;
        return;
      }
      if (infoOpenRef.current) {
        infoSentinelRef.current = false;
        setInfoOpen(false);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  const openInfo = () => {
    infoSentinelRef.current = true;
    history.pushState({ microSetupInfo: true }, "");
    setInfoOpen(true);
  };
  /* استهلاك حارس entry التاريخي في كل مسار خروج — الإغلاق البرمجي أو مغادرة
   * الشاشة أثناء فتح الحوار (نجاح الحفظ مثلًا)؛ يمنع بقية entry يجعل أول
   * رجوع من الرئيسية يُبتلع (RV3-N003). */
  const consumeInfoSentinel = () => {
    if (!infoSentinelRef.current) return;
    infoSentinelRef.current = false;
    suppressInfoPopRef.current = true;
    history.back();
  };
  const closeInfo = () => {
    consumeInfoSentinel();
    setInfoOpen(false);
  };

  /* R04/R05/R06/R07/R12 — الحفظ: فراغ الاسم بعد trim يُرفض قرب الحقل مع
   * التركيز؛ أثناء التنفيذ يُعلن التقدم ويُمنع الإرسال المتكرر والانتقال
   * لفعل استعادة يغيّر البيانات؛ النجاح المثبت وحده يفتح الرئيسية ويمسح
   * المسودة؛ الفشل يبقي الاسم ويعيد المحاولة بعد التحقق من الملف القائم. */
  /* S03: الختام الموحد للنجاح — يُستدعى بعد إثبات الهوية (والتفضيل إن اختير
   * ونجح)؛ لا إعادة إنشاء ولا ازدواج إشعار. */
  function finishSubmit() {
    notifyDataChanged();
    setIsSaving(false);
    setPreferenceSaveFailed(false);
    consumeInfoSentinel();
    navigate("/?setup=1", { replace: true });
  }

  /* S03 (UNIT-001 P3.2): إعادة محاولة التفضيل وحده بعد نجاح الهوية — لا
   * يمس الهوية أبدًا؛ الفشل يبقى جزئيًا معلنًا. */
  async function retryPreferenceSave() {
    if (isSaving) return;
    if (offering === "") {
      finishSubmit();
      return;
    }
    setIsSaving(true);
    const result = await preferences.saveOfferingPreference(offering);
    if (result.ok) {
      finishSubmit();
      return;
    }
    setIsSaving(false);
    setPreferenceSaveFailed(true);
  }

  async function submit() {
    if (isSaving) return;
    if (!activityName.trim()) {
      setSaveFailed(false);
      setNameError(true);
      nameInputRef.current?.focus();
      return;
    }
    setNameError(false);
    setSaveFailed(false);
    setPreferenceSaveFailed(false);
    setIsSaving(true);
    /* R07: التحقق من الملف قبل أي إنشاء جديد — الملف الذي ثبت حفظه يُستخدم
     * ولا يُنشأ بديل؛ تعذر القراءة ينتقل للاسترداد دون كتابة بديلة. */
    const check = await profiles.load();
    if (!check.ok) {
      setIsSaving(false);
      setStorageFailure(check);
      setProfileCheck("read-failed");
      return;
    }
    if (check.value) {
      /* R02: هوية قائمة — يفتح المشروع القائم؛ لا هوية ثانية ولا تعديل. */
      setIsSaving(false);
      consumeInfoSentinel();
      enqueueDraftWrite(async () => {
        const removed = await formDrafts.discard("setup", null);
        if (removed.ok) draftExpectedUpdatedAt.current = null;
      });
      navigate("/?setup=1", { replace: true });
      return;
    }
    const result = await profiles.create(activityName);
    if (!result.ok) {
      /* T07: الاسم باقٍ والفعل متاح لإعادة المحاولة. */
      setIsSaving(false);
      setSaveFailed(true);
      return;
    }
    /* S03 (UNIT-001 P3.2): الهوية نجحت مثبتةً — تُمسح مسودة الاسم الآن لا
     * بعد التفضيل؛ ثم يُحفظ التفضيل الاختياري إن اختير من مصدره الواحد.
     * فشل التفضيل لا يعيد إنشاء الهوية ولا يبتلع النجاح: يُعلن جزئيًا
     * والقرار (إعادة المحاولة/المتابعة) بيد المالك. */
    enqueueDraftWrite(async () => {
      const removed = await formDrafts.discard("setup", null);
      if (removed.ok) draftExpectedUpdatedAt.current = null;
    });
    if (offering !== "") {
      const preference = await preferences.saveOfferingPreference(offering);
      if (!preference.ok) {
        setIsSaving(false);
        setPreferenceSaveFailed(true);
        return;
      }
    }
    /* R06: نجاح مثبت → الرئيسية مباشرة مع T08 على الرئيسية؛ لا شاشة إيصال
     * ولا إعداد نقدي؛ المسودة تمسح بعد إثبات النجاح فقط. */
    finishSubmit();
  }

  /* R11/DUP-005: مدخل الاستعادة يفوّض لمالك 044 القائم (الإعدادات ← البيانات
   * والنسخ الاحتياطي) عبر عقد التنقل returnTo — لا صفحة استيراد ثانية؛
   * الإلغاء يعيد سياق الإعداد والقيم محفوظة في مسودة الاسم. */
  const openRestore = () => {
    if (isSaving) return;
    navigate(withReturnTo("/settings", "/setup"));
  };

  /* R01/B4: فشل قراءة مصدر الهوية — استرداد المصدر المشترك، لا بيانات فارغة
   * ولا مشروع جديد ولا كتابة بديلة. */
  if (profileCheck === "read-failed") {
    const copy = storageRecoveryCopy(storageFailure ?? { ok: false, code: "storage_error", message: "" });
    return (
      <div className="micro-storage-error" role="alert" data-testid="setup-storage-recovery">
        <strong>{copy.title}</strong>
        <p>{copy.description}</p>
        <Button action="save" onClick={() => window.location.reload()}>
          إعادة المحاولة
        </Button>
      </div>
    );
  }

  return (
    <section className="micro-page micro-setup-page">
      <div className="micro-page-heading micro-setup-heading">
        <h1>إعداد مشروعك</h1>
        {/* R08: أيقونة المعلومات — مسماة لقارئ الشاشة (T09)؛ تفتح حوار
            المكتبة وحده؛ تبقى متاحة أثناء الحفظ (معلومة قرائية لا تغيّر بيانات)؛
            صنف زر الأيقونة المكتبي القائم (هدف لمس 44×44). */}
        <button
          type="button"
          className="micro-icon-button"
          aria-label="معلومات الإعداد وحفظ البيانات"
          data-testid="setup-info-trigger"
          onClick={openInfo}
        >
          <Info aria-hidden="true" />
        </button>
      </div>
      {/* U-003 + المجموعة ٥ + R10: عرض استعادة صريح لمسودة اسم — «أكمل» يطبق
          الاسم و«تجاهل» يمسح المسودة وحدها؛ لا مشروع ولا نقود قبل التأكيد. */}
      {draftOffer ? (
        <p className="micro-save-note" role="status" data-testid="setup-draft-offer">
          إعداد غير مكتمل{" "}
          <button
            className="micro-text-action"
            type="button"
            onClick={() => {
              setActivityName(draftOffer.activityName);
              /* S03: استعادة التفضيل مع الاسم — نفس العرض الصريح، أو محايد إن
               * غاب من مسودة قديمة. */
              setOffering(draftOffer.offeringPreference ?? "");
              setDraftOffer(null);
              setNameError(false);
            }}
          >
            أكمل الإعداد
          </button>{" "}
          <button
            className="micro-text-action"
            type="button"
            onClick={() => {
              enqueueDraftWrite(async () => {
                const removed = await formDrafts.discard("setup", null);
                if (removed.ok) draftExpectedUpdatedAt.current = null;
              });
              setDraftOffer(null);
            }}
          >
            تجاهل المسودة
          </button>
        </p>
      ) : null}
      {draftSaveFailed ? (
        <p className="micro-field-error" role="alert">
          تعذر حفظ المسودة. احتفظ بالشاشة مفتوحة حتى تكمل الإعداد.
        </p>
      ) : null}
      {/* U001-IR-003: تعارض التزامن الصادق — نص الخدمة المعتمد كما هو، بلا
          تصميم جديد وبلا إخفاء أو تحويل إلى فشل تخزين. */}
      {draftConflict ? (
        <p className="micro-field-error" role="alert" data-testid="setup-draft-conflict">
          {draftConflict}
        </p>
      ) : null}
      <form
        className="micro-form-card micro-setup-decision"
        onSubmit={event => {
          event.preventDefault();
          void submit();
        }}
      >
        <label className="micro-field" htmlFor="setup-activity-name">
          <span>اسم المشروع</span>
          <input
            id="setup-activity-name"
            ref={nameInputRef}
            autoFocus
            value={activityName}
            onChange={event => {
              setActivityName(event.target.value);
              if (nameError && event.target.value.trim() !== "") setNameError(false);
            }}
            placeholder="مثال: حلويات ليان"
            aria-invalid={nameError}
            aria-describedby={nameError ? "setup-name-error" : undefined}
          />
        </label>
        {/* R04/T05: الخطأ قرب الحقل وخارج تسميته — نص التسمية يبقى نظيفًا لقارئ
            الشاشة والوصف يربقه بالحقل نفسه. */}
        {nameError ? (
          <p id="setup-name-error" className="micro-field-error" role="alert">
            اكتب اسم مشروعك.
          </p>
        ) : null}
        {saveFailed ? (
          <p className="micro-field-error" role="alert" data-testid="setup-save-failed">
            تعذر حفظ مشروعك. أعد المحاولة.
          </p>
        ) : null}
        {/* S03 (UNIT-001 P3.1/P3.2): سؤال البداية الاختياري المحايد — ما يقدمه
            المشروع غالبًا. الافتراضي الصادق «لم أحدد بعد» (محايد لا يفترض
            منتجات)، ولا يمس نوع النشاط أو طريقة العمل (workMode) ولا أي سجل
            أو رقم مالي؛ التعديل لاحقًا من الإعدادات (038) بيد المالك. */}
        <fieldset className="micro-field" data-testid="setup-offering-question">
          <legend>ما يقدّمه مشروعك غالبًا؟</legend>
          <p className="micro-local-truth" id="setup-offering-help">
            اختياري — لا يحدد نوع نشاطك ولا يغيّر أي سجل. عدّله لاحقًا من الإعدادات.
          </p>
          {(
            [
              { value: "", label: "لم أحدد بعد", hint: "محايد — لا يُفترض شيء عن مشروعك." },
              { value: "products", label: "منتجات", hint: "تبيع أشياء تصنعها أو تجلبها." },
              { value: "services", label: "خدمات", hint: "تنجز عملًا أو خدمة للعميل." },
              { value: "both", label: "منتجات وخدمات معًا", hint: "تقدم النوعين معًا." },
            ] as Array<{ value: OfferingChoice | ""; label: string; hint: string }>
          ).map(option => (
            <label key={option.value || "unselected"} className="micro-radio-choice">
              <input
                type="radio"
                name="setup-offering"
                value={option.value}
                checked={offering === option.value}
                onChange={() => setOffering(option.value)}
                aria-describedby="setup-offering-help"
              />
              <span>
                <b>{option.label}</b>
                <small>{option.hint}</small>
              </span>
            </label>
          ))}
        </fieldset>
        {/* S03 (UNIT-001 P3.2): النجاح الجزئي الصادق — الهوية أُنشئت باسمها
            والتفضيل الاختياري تعذر حفظه؛ لا إعادة إنشاء ولا ابتلاع للفشل،
            والقرار بيد المالك: إعادة محاولة التفضيل وحده أو المتابعة دونه. */}
        {preferenceSaveFailed ? (
          <p className="micro-save-note" role="status" data-testid="setup-preference-partial">
            أُنشئ مشروعك باسمه، لكن تعذّر حفظ تفضيل «ما يقدّمه مشروعك» على هذا الجهاز.{" "}
            <button
              className="micro-text-action"
              type="button"
              disabled={isSaving}
              onClick={() => void retryPreferenceSave()}
            >
              أعد محاولة حفظ التفضيل
            </button>{" "}
            <button className="micro-text-action" type="button" disabled={isSaving} onClick={finishSubmit}>
              تابع إلى مشروعك دون التفضيل
            </button>
          </p>
        ) : null}
        <div className="micro-form-actions">
          {/* عقد المكتبة للتحميل: aria-busy + دوّار + منع التكرار، مع نص T04
              المعتمد بلا إزاحة تخطيط (R05/R12). */}
          <Button action="save" block type="submit" loading={isSaving} disabled={isSaving}>
            {isSaving ? "جارٍ الحفظ…" : "احفظ وابدأ"}
          </Button>
        </div>
        {/* R11: فعل ثانوي — مدخل الاستعادة القائمة لمن لديه بيانات سابقة؛
            لا يحتاج اسمًا جديدًا أولًا. معطّل أثناء الحفظ فقط (R12). */}
        <Button
          action="secondary"
          block
          type="button"
          disabled={isSaving}
          onClick={openRestore}
          data-testid="setup-restore-entry"
        >
          استعادة نسخة احتياطية
        </Button>
      </form>
      {infoOpen ? <SetupInfoDialog onClose={closeInfo} /> : null}
    </section>
  );
}

/* R08/B4: حوار «معلومات الإعداد» — عنصر المكتبة (micro-dialog) بعقد TRUE_MODAL
 * كامل: غطاء + دخول تركيز + احتواء Tab + Escape + استعادة تركيز للمشغّل؛
 * الرجوع (زر النظام/المتصفح) يغلقه دون مغادرة الشاشة (حارس history أعلاه)؛
 * فتحه وإغلاقه لا يحفظان النموذج ولا يمسحان الاسم — قراءة خالصة. */
function SetupInfoDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    return () => {
      triggerRef.current?.focus?.();
    };
  }, []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusables = dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled])");
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  return (
    <div className="micro-dialog-overlay" onClick={onClose} data-testid="setup-info-overlay">
      <div
        ref={dialogRef}
        className="micro-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="setup-info-title"
        dir="rtl"
        data-testid="setup-info-dialog"
        onClick={event => event.stopPropagation()}
      >
        <h2 id="setup-info-title">معلومات الإعداد</h2>
        <p>يمكنك تغيير اسم المشروع لاحقًا.</p>
        <p>تُحفظ بياناتك على هذا الجهاز فقط. مسح بيانات المتصفح قد يحذفها.</p>
        <p>احتفظ بنسخة احتياطية من الإعدادات.</p>
        <div className="micro-dialog-actions">
          <Button ref={closeButtonRef} action="secondary" onClick={onClose}>
            إغلاق
          </Button>
        </div>
      </div>
    </div>
  );
}
