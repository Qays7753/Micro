import {
  Activity,
  ArrowRight,
  BellRing,
  ChevronLeft,
  CircleDollarSign,
  CircleUserRound,
  Download,
  FileCheck2,
  Hammer,
  MoonStar,
  RotateCcw,
  Save,
  Shield,
  ShieldAlert,
  Upload,
} from "lucide-react";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useReturnPath } from "@/app/useReturnNavigation";
import { LockSettingsCard } from "@/components/security/LockSettingsCard";
import { DataActionPinGate } from "@/components/security/DataActionPinGate";
import { withFrom } from "@/app/navigationContract";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { formatLocalDate } from "@/presentation/formatters";
import type { OperatingModeValue } from "@/application/time/actualTimeService";
import type { TransferPreview, TransferSummary } from "@/application/transfers/localTransferService";
import type { GuidedOpeningImportPreview } from "@/application/transfers/guidedOpeningImportService";
import { DecisionPanel } from "@/components/presentation/DecisionPanel";
import { DateTimeValue, IntegerValue } from "@/components/presentation/DisplayValue";
import { useTheme } from "@/contexts/ThemeContext";
import type { BrowserPersistenceReading } from "@/application/preferences/preferenceService";
import type { OperatingWorkMode } from "@/storage/local/types";
import { localDiagnostics } from "@/application/diagnostics/localDiagnosticsService";
import {
  browserLegacyFormDraftStorage,
  clearLegacyFormDraftStorage,
} from "@/application/drafts/legacyFormDraftMigration";

import { SettingsDataProtectionSection } from "@/components/settings/SettingsDataProtectionSection";
import {
  SettingsOperatingModeSection,
  modeOptions,
  type OperatingModeState,
} from "@/components/settings/SettingsOperatingModeSection";
import { SettingsAppearanceSection } from "@/components/settings/SettingsAppearanceSection";
import { SettingsGuidedOpeningSection } from "@/components/settings/SettingsGuidedOpeningSection";

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const [, navigate] = useLocation();
  /* S1-13: زر رجوع موحد — الأساس بديل قانوني، و?from (من صفحة الأساس) يُحترم. */
  const returnPath = useReturnPath();
  const search = useSearch();
  const {
    actualTime,
    transfers,
    guidedOpeningImport,
    preferences,
    dataVersion,
    notifyDataChanged,
    integrityCheck,
    localLock,
    formDrafts,
  } = usePrototypeServices();
  /* المجموعة ٦ (تدقيق A1 — SP-01/DP-04): مسار الاسترداد معفى من الغطاء لكن
   * إجراءات مغادرة البيانات (تصدير/استيراد/تصفير) تتطلب إثبات رمز القفل مرة
   * واحدة في الجلسة — الجهاز المقفل لا يُصدّر أرقامه ولا يُمسح بلا الرمز. */
  const lockVerifiedRef = useRef(false);
  const pendingGatedActionRef = useRef<(() => void | Promise<void>) | null>(null);
  const [gatedAction, setGatedAction] = useState<null | { title: string; description: string }>(null);
  const runWhenUnlocked = async (action: () => void | Promise<void>, title: string, description: string) => {
    if (lockVerifiedRef.current) {
      await action();
      return;
    }
    const status = await localLock.status();
    /* فشل القراءة لا يحبس المالك عن بياناته — تخفي صادق كما في كل البوابات. */
    if (!status.ok || !status.value.enabled) {
      await action();
      return;
    }
    pendingGatedActionRef.current = action;
    setGatedAction({ title, description });
  };
  /* المجموعة ٥ (التحصين الكامل): الاستبدال التدميري (استيراد كامل أو
   * تأكيد إدخال البداية) لا يمر بلا حماية أبدًا — قفل مفعّل = بوابة
   * الرمز القائمة؛ ولا قفل = حجب صريح حتى إتمام خطوة تفعيل الحماية
   * (غياب القفل ليس تحقًا ولا يُعد تفويضًا صامتًا)؛ وفشل قراءة سجل
   * القفل = إقفال صادق مصرح بلا تغيير أي بيانات. المعاينة وحدها قراءة خالصة
   * قبل هذه البوابة. */
  const [protectionBlocked, setProtectionBlocked] = useState<null | {
    title: string;
    message: string;
  }>(null);
  const runWhenProtected = async (action: () => void | Promise<void>, title: string, gateMessage: string) => {
    if (lockVerifiedRef.current) {
      await action();
      return;
    }
    const status = await localLock.status();
    if (!status.ok) {
      setProtectionBlocked({
        title,
        message:
          "لم نستطع قراءة إعداد القفل قبل إجراء يستبدل بياناتك؛ لم يتغير أي شيء. أعد المحاولة؛ فإن تكرر فافتح فحص السلامة من الأدوات.",
      });
      return;
    }
    if (!status.value.enabled) {
      setProtectionBlocked({
        title,
        message:
          "هذا الإجراء يستبدل بيانات هذا الجهاز ويحتاج حماية بالرمز أولاً — فعّل «قفل التطبيق المحلي» من قسم «احمِ بياناتك» أعلى هذه الصفحة ثم أعد المحاولة. المعاينة التي رأيتها لم تغيّر شيئًا.",
      });
      return;
    }
    pendingGatedActionRef.current = action;
    setGatedAction({ title, description: gateMessage });
  };
  /* المجموعة ٥ (التحصين الكامل — نسخ تشخيص محلي خصوصي): أثر
   * النسخ يظهر في موضعه دون فتح طبقة أخرى. */
  const [diagnosticCopyResult, setDiagnosticCopyResult] = useState<null | { message: string }>(null);
  async function copyDiagnosticReport() {
    setDiagnosticCopyResult(null);
    const clipboard = navigator.clipboard;
    if (clipboard === undefined || typeof clipboard.writeText !== "function") {
      setDiagnosticCopyResult({
        message: "الحافظة غير متاحة في هذا المتصفح — لا يمكن نسخ التقرير.",
      });
      return;
    }
    try {
      await clipboard.writeText(localDiagnostics.reportText());
      setDiagnosticCopyResult({
        message: "نُسخ تقرير التشخيص إلى الحافظة — بيانات محلية آمنة فقط؛ لا يُرسل شيء تلقائيًا أبدًا.",
      });
    } catch {
      setDiagnosticCopyResult({
        message: "تعذر النسخ إلى الحافظة — بقيت بياناتك كما هي ولم يُرسل شيء.",
      });
    }
  }

  /* المجموعة ٥ (عقد ٣٩): حكم فحص السلامة بعد الاستعادة — يُعرض مع رابط التفاصيل. */
  const [restoreCheck, setRestoreCheck] = useState<{
    overall: "PASS" | "WARN" | "FAIL";
    note: string;
  } | null>(null);
  const guidedCardRef = useRef<HTMLDivElement>(null);
  /* المجموعة ١ (Scope A/E): ?focus=guided-import يفتح بطاقة إدخال الموقف الافتتاحي
   * مباشرة — الوصلة من صفحة الأساس تصل للموضع لا لصفحة عامة. القيمة المجهولة تُهمل. */
  const [guidedLayerOpen, setGuidedLayerOpen] = useState(() => {
    try {
      return new URLSearchParams(search ?? "").get("focus") === "guided-import";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (guidedLayerOpen) guidedCardRef.current?.scrollIntoView({ block: "start" });
  }, [guidedLayerOpen]);
  const [persistence, setPersistence] = useState<BrowserPersistenceReading | null>(null);
  /* ٥.٧: حالة النسخة المُتحققة وبوابة «ابدأ من جديد». */
  const [lastExport, setLastExport] = useState<string | null>(null);
  /* O-001: مفتاح تذكير النسخة الدوري — مفعّل افتراضيًا وقابل للإطفاء بهدوء. */
  const [backupReminder, setBackupReminder] = useState<boolean | null>(null);
  const [currentSummary, setCurrentSummary] = useState<TransferSummary | null>(null);
  const [resetFlow, setResetFlow] = useState<
    { phase: "idle" } | { phase: "exporting" } | { phase: "confirm" } | { phase: "done" }
  >({ phase: "idle" });
  const [resetNameConfirmation, setResetNameConfirmation] = useState("");
  useEffect(() => {
    let active = true;
    void preferences.readBrowserPersistence().then(value => {
      if (active) setPersistence(value);
    });
    void preferences.readLastVerifiedExport().then(value => {
      if (active && value.ok) setLastExport(value.exportedAt);
    });
    void preferences.readBackupReminderEnabled().then(value => {
      if (active && value.ok) setBackupReminder(value.enabled);
    });
    void transfers.createExport().then(value => {
      if (active && value.ok) {
        const serialized = JSON.stringify(value.value, null, 2);
        const prepared = transfers.prepareImport(serialized);
        if (prepared.ok) setCurrentSummary(prepared.value.summary);
      }
    });
    return () => {
      active = false;
    };
  }, [preferences, transfers, dataVersion]);
  const inputRef = useRef<HTMLInputElement>(null);
  const guidedInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<TransferPreview | null>(null);
  const [guidedPreview, setGuidedPreview] = useState<GuidedOpeningImportPreview | null>(null);
  /* S3-11: الإشعار يُعرض داخل القسم الذي أنتجه — لا في أسفل صفحة بطول ٨٤١ سطرًا. */
  const [notice, setNotice] = useState<{ text: string; section: "storage" | "mode" } | null>(null);
  /* جولة الاستئناف (استدلال QA حي): إشعارات التخزين (نجاح التصدير، رفض التلاعب،
   * معاينة الاستيراد) تُعرض داخل طبقة «بيانات البداية والاستعادة» المطوية أصلًا —
   * فتُفتح الطبقة مع كل إشعار تخزين حتى لا يبقى الأثر غير مرئي للمستخدم. */
  const toggleBackupReminder = () => {
    const next = !backupReminder;
    setBackupReminder(next);
    void preferences.saveBackupReminderEnabled(next).then(result => {
      if (!result.ok) {
        setBackupReminder(!next);
        setStorageNotice(result.message);
        return;
      }
      notifyDataChanged();
    });
  };
  const setStorageNotice = (text: string) => {
    setNotice({ text, section: "storage" });
    setGuidedLayerOpen(true);
  };
  const setModeNotice = (text: string) => setNotice({ text, section: "mode" });
  const [isWorking, setIsWorking] = useState(false);
  const [operatingMode, setOperatingMode] = useState<OperatingModeState>({ phase: "loading" });
  const [selectedMode, setSelectedMode] = useState<"" | OperatingWorkMode>("");
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [isSavingOperatingMode, setIsSavingOperatingMode] = useState(false);

  useEffect(() => {
    let active = true;
    setOperatingMode({ phase: "loading" });
    actualTime.readOperatingMode().then(result => {
      if (!active) return;
      if (!result.ok) {
        setOperatingMode({ phase: "error", message: result.message });
        return;
      }
      setSelectedMode(result.value.workMode ?? "");
      setTrackingEnabled(result.value.actualTimeTrackingEnabled);
      setOperatingMode({ phase: "ready", value: result.value });
    });
    return () => {
      active = false;
    };
  }, [actualTime, dataVersion]);

  async function saveOperatingMode() {
    setNotice(null);
    setIsSavingOperatingMode(true);
    const result = await actualTime.saveOperatingMode({
      workMode: selectedMode || null,
      actualTimeTrackingEnabled: trackingEnabled,
    });
    setIsSavingOperatingMode(false);
    if (!result.ok) {
      setModeNotice(result.message);
      return;
    }
    setOperatingMode({ phase: "ready", value: result.value });
    notifyDataChanged();
    setModeNotice("تم حفظ طريقة العمل وتتبع الوقت على هذا الجهاز فقط.");
  }

  async function exportLocal() {
    await runWhenUnlocked(
      performExportLocal,
      "تصدير بياناتك يحتاج رمز القفل",
      "التصدير يُنشئ ملفًا فيه كل أرقامك — تأكيد الرمز مرة واحدة في هذه الجلسة يفتح الإجراء، ويبقى الرمز في هذا الجهاز.",
    );
  }

  async function performExportLocal() {
    setNotice(null);
    setIsWorking(true);
    /* ٥.٧: تصدير مُتحقق منه — يُعاد تحليل الملف دورة كاملة قبل إعلان جهوزيته. */
    const result = await transfers.createVerifiedExport();
    setIsWorking(false);
    if (!result.ok) {
      setStorageNotice(result.message);
      return;
    }
    const blob = new Blob([JSON.stringify(result.value.file, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `micro-local-${result.value.file.exportedAt.slice(0, 10)}.json`;
    link.click();
    /* S5-11: الإبطال مؤجل — الإبطال الفوري المتزامن قد يجهض التنزيل في WebKit. */
    globalThis.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    await preferences.markVerifiedExport();
    setLastExport(result.value.file.exportedAt);
    setCurrentSummary(result.value.summary);
    notifyDataChanged();
    setStorageNotice(
      "النسخة جاهزة ومُتحقق منها ✓ — احفظها بمكان آمن، فيها كل أرقامك. لو ضاع الجهاز تضيع معه؛ لا سحابة في هذا الإصدار.",
    );
  }

  /* ٥.٧: بوابة «ابدأ من جديد» — لا تصفير قبل نسخة مُتحقق منها، ولا استمرار إن فشل التصدير. */
  async function startResetFlow() {
    await runWhenUnlocked(
      performResetFlow,
      "البدء من جديد يحتاج رمز القفل",
      "المسار يمسح كل بيانات هذا الجهاز بعد نسخة احتياطية إلزامية — تأكيد الرمز يفتح البوابة.",
    );
  }

  async function performResetFlow() {
    setNotice(null);
    setResetFlow({ phase: "exporting" });
    const result = await transfers.createVerifiedExport();
    if (!result.ok) {
      setResetFlow({ phase: "idle" });
      setStorageNotice(`${result.message} بياناتك كما هي — لا يبدأ أي تصفير قبل نسخة احتياطية ناجحة.`);
      return;
    }
    const blob = new Blob([JSON.stringify(result.value.file, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `micro-local-${result.value.file.exportedAt.slice(0, 10)}.json`;
    link.click();
    /* S5-11: الإبطال مؤجل — الإبطال الفوري المتزامن قد يجهض التنزيل في WebKit. */
    globalThis.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    await preferences.markVerifiedExport();
    setLastExport(result.value.file.exportedAt);
    setResetNameConfirmation("");
    setResetFlow({ phase: "confirm" });
  }

  async function confirmReset() {
    await runWhenUnlocked(
      performReset,
      "المسح النهائي يحتاج رمز القفل",
      "آخر خطوة قبل مسح كل بيانات هذا الجهاز — أدخل رمز القفل للتأكيد النهائي.",
    );
  }

  async function performReset() {
    setNotice(null);
    setIsWorking(true);
    const result = await transfers.resetAll();
    setIsWorking(false);
    if (!result.ok) {
      setResetFlow({ phase: "idle" });
      setStorageNotice(result.message);
      return;
    }
    /* S5-03 + المجموعة ٥ (التحصين الكامل): سياسة المسودات المعلنة بعد نجاح التصفير
     * فقط — تُمسح مسودات النماذج والإعداد العابرة ومفاتيحها القديمة؛ ويبقى سجل
     * القفل المحلي كما هو (الحماية لا تُمسح بصامت). فشل مسح المسودات
     * يُعلن صادقًا ولا يرد التصفير. */
    const storage = browserLegacyFormDraftStorage();
    if (storage !== null) clearLegacyFormDraftStorage(storage);
    const cleared = await formDrafts.clearAll();
    setResetFlow({ phase: "done" });
    notifyDataChanged();
    if (!cleared.ok) {
      setNotice({
        text: "تمت إعادة التعيين، لكن تعذر مسح مسودات النماذج غير المُسلّمة — لم يُسجّل أي أثر مالي؛ افتح النموذج وتجاهل مسودته.",
        section: "storage",
      });
      setGuidedLayerOpen(true);
      return;
    }
    navigate("/setup");
  }

  async function chooseImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setNotice(null);
    setIsWorking(true);
    try {
      const prepared = transfers.prepareImport(await file.text());
      if (!prepared.ok) {
        setStorageNotice(prepared.message);
        return;
      }
      setPreview(prepared.value);
      /* جولة الاستئناف: معاينة الاستيراد تعرض داخل الطبقة نفسها — نفتحها لتُرى. */
      setGuidedLayerOpen(true);
    } catch {
      setStorageNotice("تعذر قراءة الملف. بقيت بيانات هذا الجهاز دون تغيير.");
    } finally {
      setIsWorking(false);
    }
  }

  async function confirmImport() {
    if (!preview) return;
    /* المجموعة ٥ (التحصين الكامل): الاستبدال النهائي محمي دومًا —
     * رمز إن وجد، وإلا خطوة تفعيل الحماية قبل أي كتابة. */
    await runWhenProtected(
      performImport,
      "استبدال بياناتك يحتاج رمز القفل",
      "الاستيراد يستبدل كل بيانات هذا الجهاز بملف النسخة التي راجعتها — أدخل رمز القفل للتأكيد.",
    );
  }

  async function performImport() {
    if (!preview) return;
    setNotice(null);
    setIsWorking(true);
    const result = await transfers.confirmImport(preview);
    setIsWorking(false);
    if (!result.ok) {
      setStorageNotice(result.message);
      return;
    }
    setPreview(null);
    notifyDataChanged();
    /* المجموعة ٥ (التحصين الكامل): المسودات العابرة لا تُمسح صامتًا ولا تُستبدل —
     * السياسة المختارة: الإبقاء مع إفصاح صادق
     * عن حالتها المستقلة عن الملف. */
    const drafts = await formDrafts.list();
    setStorageNotice(
      drafts.ok && drafts.value.length > 0
        ? `تم استبدال البيانات المحلية بالملف الذي راجعته؛ وأُبقيت ${drafts.value.length} مسودة نموذج غير مُسلّمة محليًا كما هي (مستقلة عن الملف) — تُعرض عند فتح نماذجها ويمكن تجاهلها هناك.`
        : "تم استبدال البيانات المحلية بالملف الذي راجعته.",
    );
    /* المجموعة ٥ (عقد ٣٩): فحص سلامة بعد الاستعادة مباشرة — قراءة جديدة فوق
     * البيانات المستعادة، بلا إصلاح تلقائي؛ النتيجة إجمالية مع رابط للتفاصيل. */
    const check = await integrityCheck.run();
    setRestoreCheck({
      overall: check.overall,
      note:
        check.overall === "PASS"
          ? "فحص السلامة بعد الاستعادة: سليم — الأرقام المستعادة متسقة مع قواعدها (الاتساق لا الجدوى)."
          : check.overall === "WARN"
            ? "فحص السلامة بعد الاستعادة: توجد ملاحظات للمراجعة — افتح فحص السلامة للتفاصيل."
            : "فحص السلامة بعد الاستعادة: يوجد خلل يحتاج تصحيحًا موثقًا — افتح فحص السلامة للتفاصيل.",
    });
    if (!result.value.profile) navigate("/setup");
  }

  async function chooseGuidedOpeningImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setNotice(null);
    setIsWorking(true);
    try {
      const prepared = await guidedOpeningImport.prepare(await file.text());
      if (!prepared.ok) {
        setStorageNotice(prepared.message);
        return;
      }
      setGuidedPreview(prepared.value);
    } catch {
      setStorageNotice("تعذر قراءة ملف البداية. بقيت بيانات هذا الجهاز دون تغيير.");
    } finally {
      setIsWorking(false);
    }
  }

  async function confirmGuidedOpeningImport() {
    if (!guidedPreview) return;
    /* المجموعة ٥ (التحصين الكامل): تأكيد إدخال البداية فعل
     * استبدال/كتابة حساس — المعاينة قراءة خالصة ثم
     * نفس قاعدة الحماية الصريحة للاستيراد الكامل بلا استثناء. */
    const guidedProtection = {
      /* عنوان البوابة نفسه من حوار الرمز القائم — الوصف المختص يحمل تخصيص الإجراء. */
      title: "تأكيد رمز القفل",
      message:
        "إدخال الموقف الافتتاحي يكتب على بيانات هذا الجهاز مرة واحدة آمنة التكرار — أدخل رمز القفل للتأكيد.",
    };
    await runWhenProtected(performGuidedOpeningImport, guidedProtection.title, guidedProtection.message);
  }

  async function performGuidedOpeningImport() {
    if (!guidedPreview) return;
    setNotice(null);
    setIsWorking(true);
    const result = await guidedOpeningImport.confirm(guidedPreview);
    setIsWorking(false);
    if (!result.ok) {
      setStorageNotice(result.message);
      return;
    }
    setGuidedPreview(null);
    notifyDataChanged();
    setStorageNotice(
      result.reused
        ? "تم التعرف على هذه المحاولة مسبقًا؛ لم يتكرر أي أثر."
        : "تم إدخال الموقف الافتتاحي المحدود مع إبقاء ما لم نعرفه خارج السجل.",
    );
  }

  const selectedModeDescription = modeOptions.find(option => option.value === selectedMode)?.description;

  /* مبدأ Micro: التفضيل اليومي ظاهر، أما البيانات الحساسة والاستعادة فتحتاج فتحًا مقصودًا. */
  return (
    <section className="micro-page">
      <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>
        <ArrowRight aria-hidden="true" /> {returnPath === "/" ? "مشروعي الآن" : "رجوع"}
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">التحكم المحلي</span>
        <h1>الإعدادات</h1>
        <p>خيارات الواجهة وحماية البيانات على هذا الجهاز.</p>
      </div>
      <DecisionPanel
        label="الحقيقة المحلية"
        truth="بيانات Micro محفوظة محليًا على هذا الجهاز."
        nextAction="حذف التطبيق أو بيانات المتصفح لا يضمن الاحتفاظ بها؛ صدّر نسخة محلية قبل الحذف أو تغيير الهاتف."
        tone="warning"
      />
      {/* المجموعة ١ (Scope G): مدخل ملف المالك من الإعدادات — سطر هادئ لا CTA منافس. */}
      <section className="micro-settings-profile-entry">
        <CircleUserRound aria-hidden="true" />
        <div>
          <b>ملفك وملف مشروعك</b>
          <small>هوية المالك ومعلومات المشروع — محفوظة على هذا الجهاز فقط.</small>
        </div>
        <button
          className="micro-text-action"
          type="button"
          onClick={() => navigate("/profile?from=%2Fsettings")}
        >
          افتح الملف
          <ChevronLeft aria-hidden="true" />
        </button>
      </section>
      <SettingsDataProtectionSection
        persistence={persistence}
        lastExport={lastExport}
        backupReminder={backupReminder}
        setBackupReminder={setBackupReminder}
        currentSummary={currentSummary}
        resetFlow={resetFlow}
        setResetFlow={setResetFlow}
        resetNameConfirmation={resetNameConfirmation}
        setResetNameConfirmation={setResetNameConfirmation}
        diagnosticCopyResult={diagnosticCopyResult}
        preview={preview}
        isWorking={isWorking}
        notice={notice}
        copyDiagnosticReport={copyDiagnosticReport}
        exportLocal={exportLocal}
        startResetFlow={startResetFlow}
        chooseImport={chooseImport}
        confirmReset={confirmReset}
        setStorageNotice={setStorageNotice}
        notifyDataChanged={notifyDataChanged}
        onToggleBackupReminder={toggleBackupReminder}
        inputRef={inputRef}
      />

      <SettingsOperatingModeSection
        operatingMode={operatingMode}
        selectedMode={selectedMode}
        setSelectedMode={setSelectedMode}
        trackingEnabled={trackingEnabled}
        setTrackingEnabled={setTrackingEnabled}
        isSavingOperatingMode={isSavingOperatingMode}
        selectedModeDescription={selectedModeDescription}
        notice={notice}
        saveOperatingMode={saveOperatingMode}
      />

      <SettingsAppearanceSection theme={theme} toggleTheme={toggleTheme} />

      <SettingsGuidedOpeningSection
        guidedLayerOpen={guidedLayerOpen}
        setGuidedLayerOpen={setGuidedLayerOpen}
        guidedPreview={guidedPreview}
        setGuidedPreview={setGuidedPreview}
        currentSummary={currentSummary}
        restoreCheck={restoreCheck}
        isWorking={isWorking}
        preview={preview}
        setPreview={setPreview}
        notice={notice}
        chooseGuidedOpeningImport={chooseGuidedOpeningImport}
        confirmGuidedOpeningImport={confirmGuidedOpeningImport}
        confirmImport={confirmImport}
        navigate={navigate}
        guidedCardRef={guidedCardRef}
        guidedInputRef={guidedInputRef}
      />
      {protectionBlocked ? (
        <div
          className="micro-lock-overlay"
          role="alertdialog"
          aria-modal="true"
          aria-label={protectionBlocked.title}
        >
          <ShieldAlert aria-hidden="true" className="micro-lock-icon" />
          <h1>{protectionBlocked.title}</h1>
          <p>{protectionBlocked.message}</p>
          <div className="micro-lock-form">
            <button
              className="micro-button micro-button-secondary"
              type="button"
              onClick={() => setProtectionBlocked(null)}
            >
              حسنًا
            </button>
          </div>
        </div>
      ) : null}
      {gatedAction ? (
        <DataActionPinGate
          actionTitle={gatedAction.title}
          actionDescription={gatedAction.description}
          onVerified={() => {
            setGatedAction(null);
            lockVerifiedRef.current = true;
            const action = pendingGatedActionRef.current;
            pendingGatedActionRef.current = null;
            void action?.();
          }}
          onCancel={() => {
            setGatedAction(null);
            pendingGatedActionRef.current = null;
          }}
        />
      ) : null}
    </section>
  );
}
