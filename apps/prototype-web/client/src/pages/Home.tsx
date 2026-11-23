/**
 * UNIT-003 (تنفيذ S16 بالأمر الموحد §4 — HOME-A): الرئيسية وجهة الفتح
 * الوسطى (NAV-01 §1). الترتيب الوظيفي المعتمد:
 * ١) اسم المشروع وتاريخ اليوم ومدخل الإعدادات وزر «!» (معلومات الرئيسية).
 * ٢) إجراءات سريعة: صف يدوي قابل للسحب (بيع/مصروف/طلب جديد/شراء/أدوات
 *    المشروع) وزر «عرض الكل» ثابت خارجه (لوحة بديلة تعرض الخمسة كاملة).
 * ٣) متابعتك: حتى 3 مهام من القارئ الموحد، ورابط «عرض المتابعة» إلى
 *    القائمة الكاملة غير المقيدة.
 * ٤) لمحة مالية: فترة أداء واحدة (اليوم/هذا الشهر بلوحة تطبيق/إلغاء)،
 *    المبيعات المسجلة ونتيجة الفترة يفتحان كشف 016 بالنطاق نفسه، والنقد
 *    المسجل الآن منفصل يفتح 022، ورابط «عرض المالية» يفتح 013.
 * ٥) (أُزيل — DEC-SHELL-01/UXR-03): اسأل Micro غادر الرئيسية إلى عنصر
 *    واحد عند الطلب في قائمة «مايكرو» (AppHeader) وفق 043 فقط.
 * ما غادر الرئيسية (HOME-C): الأهم الآن/اليوم المتداخلان (مختصر واحد
 * بدلهما)، أثناء غيابك، آخر التسجيلات، وخيارات المشروع — كلها عند أصحابها.
 * الأفعال تفوض التسجيل إلى أصحابه؛ الفتح والقراءة لا يكتبان شيئًا.
 */
import { useEffect, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  BadgeDollarSign,
  BellRing,
  CalendarDays,
  CircleAlert,
  CircleDollarSign,
  CircleHelp,
  ClipboardPlus,
  Settings,
  ShoppingCart,
  ShieldCheck,
  TrendingUp,
  Wrench,
  X,
} from "lucide-react";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { useDisabledCapabilities } from "@/app/useDisabledCapabilities";
import { useQuickRecording } from "@/app/quickRecording";
import { MoneyValue } from "@/components/presentation/DisplayValue";
import { Button } from "@/components/primitives";
import { formatArabicPlural, formatLocalDateLong } from "@/presentation/formatters";
import { withReturnTo } from "@/app/navigationContract";
import type {
  HomeControlCenterViewModel,
  HomeFollowUpRow,
  HomeGlimpseNumber,
  HomeGlimpsePeriodKind,
  HomeGlimpsePeriodNumbers,
} from "@/application/home";

/* Z1.4 (§3.1 — حالات القراءة): الإقلاع الأول له بوابة تحميل كاملة وسطح خطأ
 * كامل؛ أما فشل التحديث الخلفي مع جهوزية قائمة فيُعلن خطأً مضمّنًا فوق
 * المحتوى الجاهز الذي يبقى في مكانه، مع إعادة محاولة آمنة تعيد القراءة
 * نفسها في مكانها (لا إعادة تحميل الصفحة أبدًا). */
type HomeState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  /* Stage C (S13/R5-1): لا مشروع بعد — دعوة إعداد صادقة لا شاشة خطأ. */
  | { phase: "no_project" }
  | { phase: "ready"; model: HomeControlCenterViewModel; refreshError: string | null };

/* UXR-01 (أمر UXR-W01 — قبول A01): رفض وعد القراءة (استثناء غير متوقع)
 * يظهر رسالة آمنة ثابتة — لا استثناء خام ولا معرفات شخصية في الرسائل
 * (AGENTS §10/9)؛ وهي نفس رسالة فشل التخزين الكنونية من القارئ فلا يظهر
 * للمستخدم وعد أدق مما يملكه النظام. */
const HOME_UNEXPECTED_READ_FAILURE = "تعذر قراءة بيانات مشروعك المحلية.";

/* HOME-F03: الفترة حالة عرض — «هذا الشهر» أول دخول؛ تُحفظ للرجوع داخل
 * الجلسة (لا إعدادًا ماليًا عامًا، ولا تخزينًا جديدًا). */
let lastHomePeriod: HomeGlimpsePeriodKind = "month";

/* P-4.3-2 (D7): رقم اللمحة — قابل للفتح إلى مصدره (كشف 016 بالنطاق نفسه)،
 * والناقص وصف صادق لا صفر مضلل؛ أثناء التحميل لا أصفار افتراضية (البطاقة
 * كلها خلف حالة التحميل الكاملة). */
function GlimpseNumberCard({
  number,
  onNavigate,
}: {
  number: HomeGlimpseNumber;
  onNavigate: (href: string) => void;
}) {
  return (
    <article className="micro-home-number" data-state={number.state}>
      <span>{number.label}</span>
      <strong>
        {number.state === "known" && number.valueMinor !== null ? (
          <button
            className="micro-text-action"
            type="button"
            aria-label={`افتح ${number.label} بالنطاق نفسه`}
            onClick={() => onNavigate(number.sourceHref)}
          >
            <MoneyValue minor={number.valueMinor} />
          </button>
        ) : (
          <span className="micro-home-number-note">{number.honestNote ?? "غير مكتملة"}</span>
        )}
      </strong>
    </article>
  );
}

/* HOME-A3: صف متابعة — نوع المهمة واسمها المختصر، ثم الموعد إن ثبت، ثم
 * الفعل الصحيح؛ المبلغ بتسمية دوره فقط حين يلزم، ووسم «قادم» للمحجوز. */
function FollowUpRow({ row, onNavigate }: { row: HomeFollowUpRow; onNavigate: (href: string) => void }) {
  return (
    <article className="micro-home-followup-item" data-upcoming={row.upcoming}>
      <div>
        <strong>
          <bdi dir="auto">{row.title}</bdi>
          {row.upcoming ? <span className="micro-home-followup-soon">قادم</span> : null}
        </strong>
        {row.detail ? <p dir="auto">{row.detail}</p> : null}
        {row.amountMinor !== null && row.amountRole ? (
          <p className="micro-home-followup-amount">
            {row.amountRole} <MoneyValue minor={row.amountMinor} /> د.أ
          </p>
        ) : null}
        {row.dateLocal ? (
          <small>
            <time dateTime={row.dateLocal}>{formatLocalDateLong(row.dateLocal) ?? row.dateLocal}</time>
            {row.timeLocal ? (
              <bdi dir="ltr" className="micro-inline-number">
                {" "}
                · {row.timeLocal}
              </bdi>
            ) : null}
          </small>
        ) : null}
      </div>
      <button className="micro-text-action" type="button" onClick={() => onNavigate(row.href)}>
        {row.actionLabel}
        <ArrowLeft aria-hidden="true" />
      </button>
    </article>
  );
}

export default function Home() {
  const [, navigate] = useLocation();
  const { homeControlCenter, dataVersion, homeSetup } = usePrototypeServices();
  const [state, setState] = useState<HomeState>({ phase: "loading" });
  /* Z1.4: عدّاد إعادة المحاولة الآمنة — زيادته تعيد تشغيل قراءة الواجهة نفسها
   * في مكانها (سطح الخطأ الكامل والخطأ المضمّن كلاهما)، بلا إعادة تحميل. */
  const [retryCount, setRetryCount] = useState(0);
  /* NAV-001/ACCESS-01/H: أزرار التسجيل السريع في «الرئيسية» — البيع والمصروف
   * يفتحان الورقة عبر سياق القشرة في نموذجهما مباشرة، والطلب والشراء
   * والأدوات مساراتها العميقة إلى أصحابها. */
  const quickRecording = useQuickRecording();
  /* SET-003 / G-004: القدرات المتوقفة عن الإدخال تخفي أزرار إنشائها اليومية
   * فقط — السجلات القائمة تبقى ظاهرة في كل دفاترها؛ الأدوات ليست قدرة
   * قابلة للتعطيل. */
  const { disabled: disabledCapabilities } = useDisabledCapabilities();
  /* ACCESS-01/H: «عرض الكل» لوحة بديلة تعرض الخمسة كاملة — ثابتة خارجه. */
  const [allActionsOpen, setAllActionsOpen] = useState(false);
  const allActionsRef = useRef<HTMLDivElement>(null);
  const allActionsButtonRef = useRef<HTMLButtonElement>(null);
  /* HOME-B1: لوحة اختيار الفترة القصيرة — اليوم/هذا الشهر مع تطبيق وإلغاء. */
  const [periodKind, setPeriodKind] = useState<HomeGlimpsePeriodKind>(lastHomePeriod);
  const [periodPickerOpen, setPeriodPickerOpen] = useState(false);
  const [periodDraft, setPeriodDraft] = useState<HomeGlimpsePeriodKind>(periodKind);
  const periodButtonRef = useRef<HTMLButtonElement>(null);
  /* HOME-R09: الشرح العام عند الطلب — زر «!» يفتح معلومات الرئيسية. */
  const [infoOpen, setInfoOpen] = useState(false);
  const infoRef = useRef<HTMLDivElement>(null);
  const infoButtonRef = useRef<HTMLButtonElement>(null);
  /* UNIT-043/HOME-A2-5 + DEC-SHELL-01 (UXR-03 — أمر W02): إعلان «اسأل
   * Micro — قريبًا» غادر الرئيسية — عنصر واحد عند الطلب في قائمة «مايكرو»
   * (AppHeader)؛ لا شريط دائم ولا بطاقة ثانوية داخل الرئيسية. */
  /* SET-002: لافتة نجاح الإعداد الأول — تظهر مرة بعد الحفظ وتغادر مع التنقل. */
  const search = useSearch();
  const setupDone = new URLSearchParams((search ?? "").replace(/^\?/, "")).get("setup") === "1";
  /* UXR-01 (أمر UXR-W01 — A01): تسلسل محاولات القراءة — نتيجة محاولة أقدم
   * تُتجاهل بعد بدء محاولة أحدث (لا تسمح للاحق بالكتابة فوق الأحدث)، وكل
   * نتيجة تُتجاهل بعد تركيب الصفحة (active). رفض الوعد يُعرض برسالة آمنة
   * مميزة عن الفراغ وعن «جارٍ التجهيز»، مع إعادة المحاولة في مكانها. */
  const readAttemptRef = useRef(0);
  useEffect(() => {
    /* S05 (ميزانية الحزمة): المركز يُحمَّل ديناميكيًا بعد الإقلاع؛ حتى جاهزيته
     * تبقى الصفحة في حالة تجهيزها الصادقة (role=status) ولا يُدّعى فشل قراءة —
     * غياب الخدمة ليس خطأ القراءة. */
    if (!homeControlCenter) return;
    let active = true;
    const attempt = ++readAttemptRef.current;
    /* S5-08: تحديث خلفي لا وميض تحميل — القراءة السابقة تبقى معروضة حتى
     * تصل الجديدة (stale-while-revalidate)؛ حالة التحميل الكاملة للإقلاع فقط. */
    setState(current => (current.phase === "ready" ? current : { phase: "loading" }));
    homeControlCenter.read().then(
      result => {
        if (!active || attempt !== readAttemptRef.current) return;
        setState(current => {
          if (result.ok) return { phase: "ready", model: result.value, refreshError: null };
          /* Z1.4: فشل التحديث الخلفي مع جهوزية قائمة لا يستبدلها. */
          if (current.phase === "ready")
            return { phase: "ready", model: current.model, refreshError: result.message };
          /* Stage C (S13/R5-1): لا مشروع ≠ خطأ قراءة — دعوة إعداد صادقة. */
          if (result.code === "no_project") return { phase: "no_project" };
          return { phase: "error", message: result.message };
        });
      },
      () => {
        if (!active || attempt !== readAttemptRef.current) return;
        /* UXR-01: رفض الوعد فشل حقيقي مميز — لا فراغ ولا تحميل دائم؛ نفس
         * قاعدة الز1.4: الجهوزية القائمة تبقى وخطأ التحديث يعلن مكانها. */
        setState(current => {
          if (current.phase === "ready")
            return { phase: "ready", model: current.model, refreshError: HOME_UNEXPECTED_READ_FAILURE };
          return { phase: "error", message: HOME_UNEXPECTED_READ_FAILURE };
        });
      },
    );
    return () => {
      active = false;
    };
  }, [dataVersion, homeControlCenter, retryCount]);
  useEffect(() => {
    if (!infoOpen && !periodPickerOpen && !allActionsOpen) return;
    /* Micro Calm: طبقات الرئيسية تُغلق بEscape أيضًا — بلا حصر تركيز إضافي؛
     * وإغلاق Escape يعيد التركيز إلى مشغّل اللوحة المفتوحة كما في لوحة وظائف
     * المالية ولوحتي الترويسة (OD-A11Y). اسأل Micro غادر الرئيسية إلى
     * قائمة «مايكرو» (DEC-SHELL-01/DEC-HOM-01 — UXR-03). */
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setAllActionsOpen(false);
      setPeriodPickerOpen(false);
      setInfoOpen(false);
      if (periodPickerOpen) periodButtonRef.current?.focus();
      else if (infoOpen) infoButtonRef.current?.focus();
      else if (allActionsOpen) allActionsButtonRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [infoOpen, periodPickerOpen, allActionsOpen]);
  /* UXR-01 (PERF-004/S11 L-01 — COPY-27): فشل تجهيز خدمات الرئيسية (رفض
   * الاستيراد الكسول) وفشل القراءة سطح خطأ كامل واحد — الحالتان مميزتان
   * برسالتيهما الصادقتين وبفعل إعادة المحاولة لصاحبه: التجهيز يُعاد من
   * جذر التركيب والقراءة تُعاد في مكانها؛ لا قراءةً بلا خدمة ولا إعادة
   * تحميل صفحة ولا eager-loading. */
  const setupFailure = homeSetup?.status === "failed" ? homeSetup : null;
  /* ترتيب صادق: فشل التجهيز يحجب القراءة أصلًا؛ ورسالة القراءة لا تُعرض
   * إلا عند غيابه — فالحالتان لا تتنازعان السطح أبدًا. */
  /* Stage C (S13/R5-1): ضيف/حساب متصل بلا إعداد Manage يرى دعوة تأسيس
   * صادقة — لا شاشة «تعذر تحميل مشروعك» التي لا تنجح إعادتها أبدًا. */
  if (state.phase === "no_project") {
    return (
      <section className="micro-page micro-not-found" data-testid="home-no-project">
        <h1>ابدأ مشروعك في Micro</h1>
        <p role="status">
          هذه الصفحة بيت أدوات صاحب المشروع — الأساس يُنشأ خطوة واحدة قصيرة، والسوق والتوصيل متاحان لك الآن من
          شريط التنقل بلا إعداد.
        </p>
        <Button action="create" onClick={() => navigate("/setup")}>
          أنشئ مشروعي الآن
        </Button>
      </section>
    );
  }
  if (setupFailure || state.phase === "error") {
    const failureMessage = setupFailure
      ? "تعذر تجهيز مشروعك."
      : state.phase === "error"
        ? state.message
        : null;
    return (
      <section className="micro-page micro-not-found">
        <h1>تعذر تحميل مشروعك</h1>
        <p role="alert">{failureMessage}</p>
        <Button
          action="save"
          onClick={setupFailure ? setupFailure.retry : () => setRetryCount(count => count + 1)}
        >
          إعادة المحاولة
        </Button>
        <Button action="secondary" onClick={() => navigate("/")}>
          الرئيسية
        </Button>
      </section>
    );
  }
  if (state.phase === "loading")
    return (
      <div className="micro-route-loading" role="status">
        جارٍ تجهيز مشروعك…
      </div>
    );
  const { model } = state;
  /* المجموعة ١ (§7.2): كل رحلة من الرئيسية تحفظ مصدرها — الرجوع يعود هنا. */
  const openFromHome = (href: string) => navigate(withReturnTo(href, "/"));
  const ordersEnabled = !disabledCapabilities.includes("orders");
  const suppliersEnabled = !disabledCapabilities.includes("suppliers");
  /* ACCESS-01/H: خمسة مداخل إلى أصحابها — لا قائمة أنواع داخل نموذج. */
  const quickActions = [
    { id: "sale", label: "بيع", icon: BadgeDollarSign, run: () => quickRecording.openQuickForm("sale-form") },
    {
      id: "expense",
      label: "مصروف",
      icon: CircleDollarSign,
      run: () => quickRecording.openQuickForm("expense-form"),
    },
    ...(ordersEnabled
      ? [
          {
            id: "order",
            label: "طلب جديد",
            icon: ClipboardPlus,
            run: () => openFromHome("/orders/draft/new?intent=customer_order"),
          },
        ]
      : []),
    ...(suppliersEnabled
      ? [
          {
            id: "purchase",
            label: "شراء",
            icon: ShoppingCart,
            run: () => openFromHome("/suppliers/purchase/new"),
          },
        ]
      : []),
    { id: "tools", label: "أدوات المشروع", icon: Wrench, run: () => openFromHome("/tools") },
  ] as const;
  const openAllActions = () => {
    setAllActionsOpen(true);
    window.setTimeout(() => {
      allActionsRef.current?.querySelectorAll<HTMLElement>("button")[0]?.focus();
    }, 0);
  };
  const applyPeriod = (kind: HomeGlimpsePeriodKind) => {
    setPeriodKind(kind);
    lastHomePeriod = kind;
    setPeriodPickerOpen(false);
    periodButtonRef.current?.focus();
  };
  /* HOME-B1: المختار من قراءة واحدة — التبديل لا يعيد القراءة ولا يغير النقد. */
  const glimpse: HomeGlimpsePeriodNumbers =
    periodKind === "today" ? model.glimpse.today : model.glimpse.month;
  const cashNow = model.glimpse.cashNow;
  return (
    <section className="micro-page micro-home-control-center">
      {/* HOME-A2-1 (تنفيذ S16) + DEC-HOM-01 (UXR-03 — أمر W02): الاسم
          والتاريخ ومدخل الإعدادات وزر «!» — حذف الطبقة الداخلية «الرئيسية»
          (تكرار الترويسة/الشريط) ويبقى H1 اسم المشروع وحده. */}
      <div className="micro-home-heading">
        <h1>{model.heading.activityName}</h1>
        <div className="micro-home-heading-row">
          <p>
            <CalendarDays aria-hidden="true" />{" "}
            <time dateTime={model.heading.todayLocal}>
              {formatLocalDateLong(model.heading.todayLocal) ?? model.heading.todayLocal}
            </time>
          </p>
          <div className="micro-home-heading-actions">
            <button className="micro-text-action" type="button" onClick={() => openFromHome("/settings")}>
              <Settings aria-hidden="true" /> الإعدادات
            </button>
            <button
              className="micro-text-action"
              type="button"
              ref={infoButtonRef}
              aria-label="معلومات الرئيسية"
              aria-expanded={infoOpen}
              onClick={() => setInfoOpen(true)}
            >
              <CircleHelp aria-hidden="true" /> معلومات
            </button>
          </div>
        </div>
      </div>
      {/* Z1.4: خطأ التحديث الخلفي — إعلان صادق قرب الأعلى والمحتوى الجاهز
          الموجود تحته يبقى في مكانه. */}
      {state.refreshError ? (
        <section className="micro-home-refresh-error" role="alert">
          <CircleAlert aria-hidden="true" />
          <p>{state.refreshError}</p>
          <Button action="save" onClick={() => setRetryCount(count => count + 1)}>
            إعادة المحاولة
          </Button>
        </section>
      ) : null}
      {/* SET-002 + UNIT-001 V2 (R06/T08): نجاح واضح بعد الإعداد الأول —
          الدعوة الاختيارية لاستكمال 002 دون منع العمل. */}
      {setupDone ? (
        <section className="micro-note-card" role="status" data-testid="setup-success-banner">
          <ShieldCheck aria-hidden="true" />
          <p>
            تم إعداد مشروعك.{" "}
            <button className="micro-text-action" type="button" onClick={() => openFromHome("/foundation")}>
              ابدأ تسجيل بيانات مشروعك الأساسية
            </button>{" "}
            أو ابدأ مهمتك من الأفعال أدناه — لا شيء إلزامي.
          </p>
        </section>
      ) : null}
      {/* O-001 (P-01 طبقة ١): تذكير النسخة الهادئ عند حلوله فقط. */}
      {model.truthLine ? (
        <p className="micro-home-truth-line" role="status">
          <CircleAlert aria-hidden="true" /> {model.truthLine}{" "}
          <button className="micro-text-action" type="button" onClick={() => openFromHome("/settings")}>
            افتح الإعدادات
          </button>
        </p>
      ) : null}
      {/* HOME-A2-2: إجراءات سريعة — صف يدوي قابل للسحب و«عرض الكل» ثابت خارجه. */}
      <section className="micro-home-quick-actions" aria-labelledby="home-quick-title">
        <div className="micro-section-title">
          <BadgeDollarSign aria-hidden="true" />
          <div>
            <h2 id="home-quick-title">إجراءات سريعة</h2>
          </div>
        </div>
        <div className="micro-home-quick-row">
          <div className="micro-quick-actions micro-quick-actions-scroll" data-testid="home-quick-actions">
            {quickActions.map(entry => (
              <button
                key={entry.id}
                className="micro-quick-action"
                type="button"
                data-testid={`home-action-${entry.id}`}
                onClick={entry.run}
              >
                <entry.icon aria-hidden="true" /> {entry.label}
              </button>
            ))}
          </div>
          <button
            className="micro-quick-action micro-quick-action-all"
            type="button"
            ref={allActionsButtonRef}
            aria-expanded={allActionsOpen}
            onClick={openAllActions}
          >
            عرض الكل
          </button>
        </div>
      </section>
      {/* HOME-A2-3: متابعتك — مختصر واحد حتى 3 مهام و«عرض المتابعة» للقائمة
          الكاملة غير المقيدة؛ فشل مصدر يعلن جزئية القراءة بلا فراغ مضلل. */}
      <section className="micro-home-followup-section" aria-labelledby="home-followup-title">
        <div className="micro-section-title">
          <BellRing aria-hidden="true" />
          <div>
            <h2 id="home-followup-title">متابعتك</h2>
          </div>
          <button
            className="micro-text-action"
            type="button"
            onClick={() => openFromHome("/finance/upcoming")}
          >
            عرض المتابعة
            <ArrowLeft aria-hidden="true" />
          </button>
        </div>
        {model.followUp.rows.length > 0 ? (
          <div className="micro-home-followup-list" data-testid="home-followup-rows">
            {model.followUp.rows.map(row => (
              <FollowUpRow key={row.id} row={row} onNavigate={openFromHome} />
            ))}
          </div>
        ) : model.followUp.complete ? (
          /* HOME-B3 + COPY-13 (UXR-03 — أمر W02): قراءة مكتملة بلا مهام —
           * الحالة الصادقة بلغة القاموس المعتمدة، مع مدخل المتابعة دون
           * قائمة فراغات؛ لا «كل شيء ممتاز». */
          <p className="micro-home-truth-line" role="status">
            لا توجد متابعات مسجلة الآن
          </p>
        ) : null}
        {model.followUp.failedMessage ? (
          <p className="micro-home-truth-line" role="alert">
            {model.followUp.failedMessage} —{" "}
            <button
              className="micro-text-action"
              type="button"
              onClick={() => setRetryCount(count => count + 1)}
            >
              إعادة المحاولة
            </button>
          </p>
        ) : null}
      </section>
      {/* HOME-A2-4: لمحة مالية — فترة أداء واحدة والنقد الآن منفصل. */}
      <section className="micro-home-glimpse-section" aria-labelledby="home-glimpse-title">
        <div className="micro-section-title">
          <TrendingUp aria-hidden="true" />
          <div>
            <h2 id="home-glimpse-title">لمحة مالية</h2>
          </div>
          <button
            className="micro-text-action"
            type="button"
            ref={periodButtonRef}
            aria-expanded={periodPickerOpen}
            onClick={() => {
              setPeriodDraft(periodKind);
              setPeriodPickerOpen(true);
            }}
          >
            الفترة: {glimpse.period.label}
          </button>
        </div>
        <div className="micro-home-numbers" data-testid="home-glimpse">
          <GlimpseNumberCard number={glimpse.sales} onNavigate={openFromHome} />
          <GlimpseNumberCard number={glimpse.result} onNavigate={openFromHome} />
          <article className="micro-home-number" data-state={cashNow.state}>
            <span>{cashNow.label}</span>
            <strong>
              {cashNow.state === "known" && cashNow.valueMinor !== null ? (
                <button
                  className="micro-text-action"
                  type="button"
                  aria-label={`افتح ${cashNow.label}`}
                  onClick={() => openFromHome(cashNow.sourceHref)}
                >
                  <MoneyValue minor={cashNow.valueMinor} />
                </button>
              ) : (
                <span className="micro-home-number-note">غير مسجل بعد</span>
              )}
            </strong>
            {cashNow.qualifier ? <small className="micro-home-number-note">{cashNow.qualifier}</small> : null}
          </article>
        </div>
        <p className="micro-home-truth-line">
          <button className="micro-text-action" type="button" onClick={() => openFromHome("/finance")}>
            عرض المالية
            <ArrowLeft aria-hidden="true" />
          </button>
        </p>
      </section>
      {/* DEC-SHELL-01/DEC-HOM-01 (UXR-03 — أمر W02): «اسأل Micro — قريبًا»
          بلا أثر دائم في الرئيسية — عنصر واحد عند الطلب في قائمة «مايكرو». */}
      {/* ── اللوحات ── */}
      {allActionsOpen ? (
        <div className="micro-soon-backdrop" role="presentation" onClick={() => setAllActionsOpen(false)}>
          <div
            ref={allActionsRef}
            className="micro-functions-board"
            role="dialog"
            aria-modal="false"
            aria-label="كل الإجراءات"
            data-testid="home-all-actions"
            onClick={event => event.stopPropagation()}
          >
            <div className="micro-functions-board-heading">
              <h2>إجراءات سريعة</h2>
              <button
                className="micro-text-action"
                type="button"
                onClick={() => {
                  setAllActionsOpen(false);
                  allActionsButtonRef.current?.focus();
                }}
              >
                <X aria-hidden="true" /> إغلاق
              </button>
            </div>
            <section className="micro-functions-board-group" aria-label="كل الإجراءات">
              <ul>
                {quickActions.map(entry => (
                  <li key={entry.id}>
                    <button
                      className="micro-functions-board-entry"
                      type="button"
                      onClick={() => {
                        setAllActionsOpen(false);
                        entry.run();
                      }}
                    >
                      <span>
                        <strong>{entry.label}</strong>
                      </span>
                      <ArrowLeft aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      ) : null}
      {periodPickerOpen ? (
        <div className="micro-soon-backdrop" role="presentation" onClick={() => setPeriodPickerOpen(false)}>
          <div
            className="micro-functions-board micro-home-period-picker"
            role="dialog"
            aria-modal="false"
            aria-label="اختيار الفترة"
            data-testid="home-period-picker"
            onClick={event => event.stopPropagation()}
          >
            <div className="micro-functions-board-heading">
              <h2>الفترة</h2>
              <button
                className="micro-text-action"
                type="button"
                onClick={() => {
                  setPeriodPickerOpen(false);
                  periodButtonRef.current?.focus();
                }}
              >
                <X aria-hidden="true" /> إغلاق
              </button>
            </div>
            <section className="micro-functions-board-group" aria-label="خيارات الفترة">
              <ul>
                {(
                  [
                    { kind: "today", label: "اليوم", hint: "أداء اليوم وحده" },
                    { kind: "month", label: "هذا الشهر", hint: "من أول الشهر حتى اليوم" },
                  ] as const
                ).map(option => (
                  <li key={option.kind}>
                    <button
                      className="micro-functions-board-entry"
                      type="button"
                      aria-label={option.label}
                      data-selected={periodDraft === option.kind}
                      onClick={() => setPeriodDraft(option.kind)}
                    >
                      <span>
                        <strong>{option.label}</strong>
                        <small>{option.hint}</small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
            <div className="micro-form-actions">
              <Button action="secondary" onClick={() => setPeriodPickerOpen(false)}>
                إلغاء
              </Button>
              <Button action="save" onClick={() => applyPeriod(periodDraft)}>
                تطبيق
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {infoOpen ? (
        <div className="micro-soon-backdrop" role="presentation" onClick={() => setInfoOpen(false)}>
          <div
            ref={infoRef}
            className="micro-soon-panel"
            role="dialog"
            aria-modal="false"
            aria-label="معلومات الرئيسية"
            data-testid="home-info-panel"
            onClick={event => event.stopPropagation()}
          >
            <div className="micro-soon-panel-head">
              <strong>معلومات الرئيسية</strong>
              <button
                className="micro-icon-button"
                type="button"
                aria-label="إغلاق"
                onClick={() => {
                  setInfoOpen(false);
                  infoButtonRef.current?.focus();
                }}
              >
                <X aria-hidden="true" />
              </button>
            </div>
            <p>
              المبيعات المسجلة إيراد مسجل (أساس التسليم) — ليست المقبوض؛ القبض ليس ربحًا، والنقد الآن منفصل عن
              فترة الأداء.
            </p>
            <p>نتيجة الفترة تحتاج تكلفة مكتملة؛ الناقص يوصف بصدقه ولا يقدّر رقمًا مؤكدًا.</p>
            <p>بياناتك محفوظة محليًا على هذا الجهاز.</p>
            <p className="micro-soon-panel-footer">
              {model.backup.lastVerifiedExportAt === null
                ? "لا توجد نسخة احتياطية متحققة بعد."
                : `آخر نسخة احتياطية متحققة قبل ${formatArabicPlural(model.backup.daysSinceExport ?? 0, {
                    zero: "أقل من يوم",
                    one: "يوم واحد",
                    two: "يومين",
                    few: "أيام",
                    many: "يومًا",
                    other: "يوم",
                  })}.`}{" "}
              <button className="micro-text-action" type="button" onClick={() => openFromHome("/settings")}>
                النسخ الاحتياطي من الإعدادات
              </button>
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
