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
  Upload,
} from "lucide-react";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useReturnPath } from "@/app/useReturnNavigation";
import { withReturnTo } from "@/app/navigationContract";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { businessDateFromTimestamp, formatLocalDate } from "@/presentation/formatters";
import type { OperatingModeValue } from "@/application/time";
import type { BoundRestoreIntent, TransferSummary } from "@/application/transfers";
import type { GuidedOpeningImportPreview } from "@/application/transfers";
import { DecisionPanel } from "@/components/presentation/DecisionPanel";
import { DateTimeValue, IntegerValue } from "@/components/presentation/DisplayValue";
import { useTheme } from "@/contexts/ThemeContext";
import type { BrowserPersistenceReading } from "@/application/preferences";
import type { OperatingWorkMode } from "@/storage/local/types";
import { localDiagnostics } from "@/application/diagnostics";

import { SettingsDataProtectionSection } from "@/components/settings/SettingsDataProtectionSection";
import {
  SettingsOperatingModeSection,
  modeOptions,
  type OperatingModeState,
} from "@/components/settings/SettingsOperatingModeSection";
import { SettingsAppearanceSection } from "@/components/settings/SettingsAppearanceSection";
import { SettingsCapabilitiesSection } from "@/components/settings/SettingsCapabilitiesSection";

import { Button, type FeedbackKind } from "@/components/primitives";
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
    agreements,
    inventory,
    supplierPurchases,
    catalog,
    dataVersion,
    notifyDataChanged,
    integrityCheck,
    formDrafts,
  } = usePrototypeServices();
  /* S02-B (SH-04 — UNIT-042، إلغاء المالك المعتمد): بوابة الرمز حُذفت كاملة
   * — لا طلب PIN للتصدير/الاستيراد/التصفير ولا فعل معلق ينتظر رمزًا. حماية
   * البيانات مستقلة عن القفل وتبقى كما هي: المعاينة المراجعة والتأكيد
   * الصريح والنسخة الرجوع الدائمة (S02-A) والتحقق من الملف وحراس المال. */
  /* المجموعة ٥ (التحصين الكامل — نسخ تشخيص محلي خصوصي): أثر
   * النسخ يظهر في موضعه دون فتح طبقة أخرى. */
  const [diagnosticCopyResult, setDiagnosticCopyResult] = useState<null | {
    kind: FeedbackKind;
    message: string;
  }>(null);
  async function copyDiagnosticReport() {
    setDiagnosticCopyResult(null);
    const clipboard = navigator.clipboard;
    if (clipboard === undefined || typeof clipboard.writeText !== "function") {
      setDiagnosticCopyResult({
        kind: "error",
        message: "الحافظة غير متاحة في هذا المتصفح — لا يمكن نسخ التقرير.",
      });
      return;
    }
    try {
      await clipboard.writeText(localDiagnostics.reportText());
      setDiagnosticCopyResult({
        kind: "completion",
        message: "نُسخ تقرير التشخيص إلى الحافظة — بيانات محلية آمنة فقط؛ لا يُرسل شيء تلقائيًا أبدًا.",
      });
    } catch {
      setDiagnosticCopyResult({
        kind: "error",
        message: "تعذر النسخ إلى الحافظة — بقيت بياناتك كما هي ولم يُرسل شيء.",
      });
    }
  }

  /* المجموعة ٥ (عقد ٣٩): حكم فحص السلامة بعد الاستعادة — يُعرض مع رابط التفاصيل. */
  const [restoreCheck, setRestoreCheck] = useState<{
    /* TOOL-001: «غير متاح» حالة صادقة مستقلة — الاتحاد الكامل لحالات الفحص. */
    overall: "PASS" | "WARN" | "UNAVAILABLE" | "FAIL";
    note: string;
  } | null>(null);
  /* S02-A (SH-03): حالة النسخة السابقة الدائمة — من قاعدة الحماية عبر
   * readRestoreStatus لا من ذاكرة الصفحة، فتصمد بعد الإغلاق وإعادة
   * التحميل، وتحسم أي نية استبدال معلقة أولًا بصدق. */
  const [rollbackStatus, setRollbackStatus] = useState<{ createdAt: string } | null>(null);
  const guidedCardRef = useRef<HTMLDivElement>(null);
  /* Wave 4.2 — P-4.2-3 (T2): القسم الموحد «البيانات والنسخ الاحتياطي» —
   * الطبقتان القديمتان دُمجتا في قسم واحد مفتوح افتراضيًا؛ الوصلة العميقة
   * ?focus=guided-import وإشعارات التخزين يفتحانه ويُمرّران النظر إلى بطاقة
   * الإدخال الافتتاحي (السلوكان القائمان محفوظان). القيمة المجهولة تُهمل. */
  const [dataSectionOpen, setDataSectionOpen] = useState(true);
  const [guidedAttention, setGuidedAttention] = useState(() => {
    try {
      return new URLSearchParams(search ?? "").get("focus") === "guided-import";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (guidedAttention) {
      setDataSectionOpen(true);
      guidedCardRef.current?.scrollIntoView({ block: "start" });
    }
  }, [guidedAttention]);
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
    /* EXE-014 (D-034): خدمات النقل تُحمَّل خاملًا — يُنتظر جاهزيتها قبل
     * قراءة ملخص البيانات الحالية. */
    if (!transfers) return;
    void transfers.createExport().then(value => {
      if (active && value.ok) {
        const serialized = JSON.stringify(value.value, null, 2);
        const prepared = transfers.prepareImport(serialized);
        if (prepared.ok) setCurrentSummary(prepared.value.summary);
      }
    });
    /* S02-A: النسخة السابقة الدائمة تُقرأ من قاعدة الحماية — بعد أي إعادة
     * تحميل تظل ظاهرة، وأي نية معلقة تُحسم أولًا بصدق. */
    void transfers.readRestoreStatus().then(value => {
      if (active && value.ok) {
        setRollbackStatus(
          value.value.rollbackCreatedAt ? { createdAt: value.value.rollbackCreatedAt } : null,
        );
      }
    });
    return () => {
      active = false;
    };
  }, [preferences, transfers, dataVersion]);
  const inputRef = useRef<HTMLInputElement>(null);
  const guidedInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<BoundRestoreIntent | null>(null);
  const [guidedPreview, setGuidedPreview] = useState<GuidedOpeningImportPreview | null>(null);
  /* S3-11: الإشعار يُعرض داخل القسم الذي أنتجه — لا في أسفل صفحة بطول ٨٤١ سطرًا. */
  const [notice, setNotice] = useState<{
    kind: FeedbackKind;
    text: string;
    section: "storage" | "mode";
  } | null>(null);
  /* جولة الاستئناف (استدلال QA حي): إشعارات التخزين (نجاح التصدير، رفض التلاعب،
   * معاينة الاستيراد) تُعرض داخل طبقة «بيانات البداية والاستعادة» المطوية أصلًا —
   * فتُفتح الطبقة مع كل إشعار تخزين حتى لا يبقى الأثر غير مرئي للمستخدم. */
  const toggleBackupReminder = () => {
    const next = !backupReminder;
    setBackupReminder(next);
    void preferences.saveBackupReminderEnabled(next).then(result => {
      if (!result.ok) {
        setBackupReminder(!next);
        setStorageNotice("error", result.message);
        return;
      }
      notifyDataChanged();
    });
  };
  const setStorageNotice = (kind: FeedbackKind, text: string) => {
    setNotice({ kind, text, section: "storage" });
    setGuidedAttention(true);
  };
  const setModeNotice = (kind: FeedbackKind, text: string) => setNotice({ kind, text, section: "mode" });
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
      setModeNotice("error", result.message);
      return;
    }
    setOperatingMode({ phase: "ready", value: result.value });
    notifyDataChanged();
    setModeNotice("completion", "تم حفظ طريقة العمل وتتبع الوقت على هذا الجهاز فقط.");
  }

  async function exportLocal() {
    await performExportLocal();
  }

  async function performExportLocal() {
    setNotice(null);
    setIsWorking(true);
    /* ٥.٧: تصدير مُتحقق منه — يُعاد تحليل الملف دورة كاملة قبل إعلان جهوزيته. */
    if (!transfers) {
      setIsWorking(false);
      setStorageNotice("error", "جارٍ تجهيز أدوات البيانات بعد الإقلاع — أعد المحاولة بعد لحظة.");
      return;
    }
    const result = await transfers.createVerifiedExport();
    setIsWorking(false);
    if (!result.ok) {
      setStorageNotice("error", result.message);
      return;
    }
    const blob = new Blob([JSON.stringify(result.value.file, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `micro-local-${businessDateFromTimestamp(result.value.file.exportedAt)}.json`;
    link.click();
    /* S5-11: الإبطال مؤجل — الإبطال الفوري المتزامن قد يجهض التنزيل في WebKit. */
    globalThis.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    await preferences.markVerifiedExport();
    setLastExport(result.value.file.exportedAt);
    setCurrentSummary(result.value.summary);
    notifyDataChanged();
    setStorageNotice(
      "completion",
      "النسخة جاهزة ومُتحقق منها — احفظها بمكان آمن، فيها كل أرقامك. لو ضاع الجهاز تضيع معه؛ لا سحابة في هذا الإصدار.",
    );
  }

  /* ٥.٧: بوابة «ابدأ من جديد» — لا تصفير قبل نسخة مُتحقق منها، ولا استمرار إن فشل التصدير. */
  async function startResetFlow() {
    await performResetFlow();
  }

  async function performResetFlow() {
    setNotice(null);
    if (!transfers) {
      setResetFlow({ phase: "idle" });
      setStorageNotice("error", "جارٍ تجهيز أدوات البيانات بعد الإقلاع — أعد المحاولة بعد لحظة.");
      return;
    }
    setResetFlow({ phase: "exporting" });
    const result = await transfers.createVerifiedExport();
    if (!result.ok) {
      setResetFlow({ phase: "idle" });
      setStorageNotice(
        "error",
        `${result.message} بياناتك كما هي — لا يبدأ أي تصفير قبل نسخة احتياطية ناجحة.`,
      );
      return;
    }
    const blob = new Blob([JSON.stringify(result.value.file, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `micro-local-${businessDateFromTimestamp(result.value.file.exportedAt)}.json`;
    link.click();
    /* S5-11: الإبطال مؤجل — الإبطال الفوري المتزامن قد يجهض التنزيل في WebKit. */
    globalThis.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    await preferences.markVerifiedExport();
    setLastExport(result.value.file.exportedAt);
    setResetNameConfirmation("");
    setResetFlow({ phase: "confirm" });
  }

  async function confirmReset() {
    await performReset();
  }

  async function performReset() {
    setNotice(null);
    setIsWorking(true);
    if (!transfers) {
      setIsWorking(false);
      setResetFlow({ phase: "idle" });
      setStorageNotice("error", "جارٍ تجهيز أدوات البيانات بعد الإقلاع — أعد المحاولة بعد لحظة.");
      return;
    }
    const result = await transfers.resetAll();
    setIsWorking(false);
    if (!result.ok) {
      setResetFlow({ phase: "idle" });
      setStorageNotice("error", result.message);
      return;
    }
    /* S5-03 + المجموعة ٥ (التحصين الكامل): سياسة المسودات المعلنة بعد نجاح التصفير
     * فقط — تُمسح مسودات النماذج والإعداد العابرة؛ ويبقى سجل
     * القفل المحلي كما هو (الحماية لا تُمسح بصامت). فشل مسح المسودات
     * يُعلن صادقًا ولا يرد التصفير.
     * R11 ARCH-012 (2026-10-15): مسح مفاتيح النظام القديم تقاعد مع
     * مهايئه التراثي بقرار مالك موثق (r11-arch012-20261015) — المفاتيح
     * المتروكة في المتصفح تصير خاملة لا تُقرأ أبدًا، ولا مسح تخزين
     * تخريبي وقت التشغيل (ممنوع بالعقد). */
    const cleared = await formDrafts.clearAll();
    setResetFlow({ phase: "done" });
    notifyDataChanged();
    if (!cleared.ok) {
      setNotice({
        kind: "error",
        text: "تمت إعادة التعيين، لكن تعذر مسح مسودات النماذج غير المُسلّمة — لم يُسجّل أي أثر مالي؛ افتح النموذج وتجاهل مسودته.",
        section: "storage",
      });
      setGuidedAttention(true);
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
      if (!transfers) {
        setStorageNotice("error", "جارٍ تجهيز أدوات البيانات بعد الإقلاع — أعد المحاولة بعد لحظة.");
        return;
      }
      /* S02-A (SH-02): المعاينة مربوطة بالمراجعة — الجيل وبصمة الحالة الحية
       * لحظة العرض؛ التأكيد لا يقبل إلا أمرًا مربوطًا، وتغيّر البيانات بعده
       * يعيد المراجعة ولا يستبدل عملًا أحدث. */
      const prepared = await transfers.prepareRestore(await file.text());
      if (!prepared.ok) {
        setStorageNotice("error", prepared.message);
        return;
      }
      setPreview(prepared.value);
      /* جولة الاستئناف: معاينة الاستيراد تعرض داخل القسم الموحد — نفتحه لتُرى. */
      setGuidedAttention(true);
    } catch {
      setStorageNotice("error", "تعذر قراءة الملف. بقيت بيانات هذا الجهاز دون تغيير.");
    } finally {
      setIsWorking(false);
    }
  }

  async function confirmImport() {
    if (!preview) return;
    /* S02-B: التأكيد الصريح بعد المراجعة + حماية ٠٤٤ التقنية (النسخة
     * الرجوع الدائمة والسياج) — بلا رمز أبدًا (قرار إلغاء ٠٤٢ المعتمد). */
    await performImport();
  }

  async function performImport() {
    if (!preview) return;
    if (!transfers) {
      setStorageNotice("error", "جارٍ تجهيز أدوات البيانات بعد الإقلاع — أعد المحاولة بعد لحظة.");
      return;
    }
    setNotice(null);
    setIsWorking(true);
    const result = await transfers.confirmImport(preview);
    setIsWorking(false);
    if (!result.ok) {
      setStorageNotice("error", result.message);
      return;
    }
    setPreview(null);
    notifyDataChanged();
    /* S02-A (SH-03): النسخة السابقة الدائمة جاهزة — من قاعدة الحماية لا من
     * حالة الصفحة، فطريق الرجوع محفوظ بيد المالك حتى بعد إعادة التحميل. */
    if (transfers) {
      void transfers.readRestoreStatus().then(value => {
        if (value.ok) {
          setRollbackStatus(
            value.value.rollbackCreatedAt ? { createdAt: value.value.rollbackCreatedAt } : null,
          );
        }
      });
    }
    /* S02-A (عقد ٠٤٤ B6): المسودات العابرة عُزلت مع اللقطة القديمة داخل نسخة
     * الرجوع الدائمة — لا تبقى فوق بيانات استُبدلت ولا تضيع بصمت؛ تُسترد
     * مع اللقطة القديمة عند الاسترجاع. */
    setStorageNotice(
      "completion",
      "تم استبدال البيانات المحلية بالملف الذي راجعته؛ نسخة بياناتك السابقة محفوظة أدناه (تنزيل أو استرجاع كامل بمراجعة وتأكيد) — ومعها المسودات غير المُسلّمة معزولة كما كانت.",
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
            : check.overall === "UNAVAILABLE"
              ? "فحص السلامة بعد الاستعادة: تعذّرت قراءة بعض الفحوص — أعد تشغيل الفحص من أدواته."
              : "فحص السلامة بعد الاستعادة: يوجد خلل يحتاج تصحيحًا موثقًا — افتح فحص السلامة للتفاصيل.",
    });
    if (!result.value.profile) navigate("/setup");
  }

  /* S02-A (SH-03): تنزيل النسخة السابقة الدائمة — من قاعدة الحماية نفسها،
   * فتُنزَّل حتى بعد إعادة التحميل (نفس آلية التصدير: Blob + رابط مؤجل الإبطال). */
  async function downloadRestoreBackup() {
    if (!transfers) {
      setStorageNotice("error", "جارٍ تجهيز أدوات البيانات بعد الإقلاع — أعد المحاولة بعد لحظة.");
      return;
    }
    const rollback = await transfers.readActiveRollback();
    if (!rollback.ok || rollback.value === null) {
      setStorageNotice("error", "لا توجد نسخة سابقة محفوظة على هذا الجهاز — لا ما يُنزَّل.");
      return;
    }
    const blob = new Blob([JSON.stringify(rollback.value.file, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `micro-backup-before-restore-${businessDateFromTimestamp(rollback.value.file.exportedAt)}.json`;
    link.click();
    globalThis.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  /* S02-A (عقد ٠٤٤ B4.4): استرجاع البيانات السابقة — نفس خدمة الاستعادة
   * نفسها: معاينة وأثر وتأكيد، وحماية كاملة للبيانات الحالية التي سيستبدلها
   * الرجوع أيضًا؛ لا استرجاع من مجرد نقرة إشعار. */
  async function startRollbackRestore() {
    if (!transfers) {
      setStorageNotice("error", "جارٍ تجهيز أدوات البيانات بعد الإقلاع — أعد المحاولة بعد لحظة.");
      return;
    }
    setNotice(null);
    setIsWorking(true);
    const prepared = await transfers.prepareRollbackRestore();
    setIsWorking(false);
    if (!prepared.ok) {
      setStorageNotice("error", prepared.message);
      return;
    }
    setPreview(prepared.value);
    setGuidedAttention(true);
  }

  async function chooseGuidedOpeningImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setNotice(null);
    setIsWorking(true);
    try {
      if (!guidedOpeningImport) {
        setStorageNotice("error", "جارٍ تجهيز أدوات البيانات بعد الإقلاع — أعد المحاولة بعد لحظة.");
        return;
      }
      const prepared = await guidedOpeningImport.prepare(await file.text());
      if (!prepared.ok) {
        setStorageNotice("error", prepared.message);
        return;
      }
      setGuidedPreview(prepared.value);
    } catch {
      setStorageNotice("error", "تعذر قراءة ملف البداية. بقيت بيانات هذا الجهاز دون تغيير.");
    } finally {
      setIsWorking(false);
    }
  }

  async function confirmGuidedOpeningImport() {
    if (!guidedPreview) return;
    /* S02-B: نفس قاعدة الاستعادة الكاملة بلا رمز — تأكيد صريح بعد معاينة
     * وحماية تقنية داخل حد الكتابة (بروتوكول S02-A). */
    await performGuidedOpeningImport();
  }

  async function performGuidedOpeningImport() {
    if (!guidedPreview) return;
    if (!guidedOpeningImport) {
      setStorageNotice("error", "جارٍ تجهيز أدوات البيانات بعد الإقلاع — أعد المحاولة بعد لحظة.");
      return;
    }
    setNotice(null);
    setIsWorking(true);
    const result = await guidedOpeningImport.confirm(guidedPreview);
    setIsWorking(false);
    if (!result.ok) {
      setStorageNotice("error", result.message);
      return;
    }
    setGuidedPreview(null);
    notifyDataChanged();
    setStorageNotice(
      "completion",
      result.reused
        ? "تم التعرف على هذه المحاولة مسبقًا؛ لم يتكرر أي أثر."
        : "تم إدخال الموقف الافتتاحي المحدود مع إبقاء ما لم نعرفه خارج السجل.",
    );
    /* EXE-014 (DATA-001): فحص سلامة بعد الاستيراد الافتتاحي أيضًا — نفس
     * قاعدة الاستعادة الكاملة: قراءة جديدة فوق ما كُتب، بلا إصلاح تلقائي،
     * والنتيجة ظاهرة برابط التفاصيل. */
    const check = await integrityCheck.run();
    setRestoreCheck({
      overall: check.overall,
      note:
        check.overall === "PASS"
          ? "فحص السلامة بعد الاستيراد الافتتاحي: سليم — الأرقام المُدخلة متسقة مع قواعدها (الاتساق لا الجدوى)."
          : check.overall === "WARN"
            ? "فحص السلامة بعد الاستيراد الافتتاحي: توجد ملاحظات للمراجعة — افتح فحص السلامة للتفاصيل."
            : check.overall === "UNAVAILABLE"
              ? "فحص السلامة بعد الاستيراد الافتتاحي: تعذّرت قراءة بعض الفحوص — أعد تشغيل الفحص من أدواته."
              : "فحص السلامة بعد الاستيراد الافتتاحي: يوجد خلل يحتاج تصحيحًا موثقًا — افتح فحص السلامة للتفاصيل.",
    });
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
          onClick={() => navigate(withReturnTo("/profile", "/settings"))}
        >
          افتح الملف
          <ChevronLeft aria-hidden="true" />
        </button>
      </section>
      <SettingsDataProtectionSection
        dataSectionOpen={dataSectionOpen}
        onToggleDataSection={setDataSectionOpen}
        guidedAttention={guidedAttention}
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
        guidedPreview={guidedPreview}
        setGuidedPreview={setGuidedPreview}
        restoreCheck={restoreCheck}
        rollbackStatus={rollbackStatus}
        downloadRestoreBackup={() => void downloadRestoreBackup()}
        startRollbackRestore={startRollbackRestore}
        preview={preview}
        setPreview={setPreview}
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
        chooseGuidedOpeningImport={chooseGuidedOpeningImport}
        confirmGuidedOpeningImport={confirmGuidedOpeningImport}
        confirmImport={confirmImport}
        navigate={navigate}
        guidedCardRef={guidedCardRef}
        guidedInputRef={guidedInputRef}
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

      {/* SET-003: قدرات المشروع — إيقاف الإدخال لا يمس السجلات القائمة. */}
      <SettingsCapabilitiesSection
        preferences={preferences}
        agreements={agreements}
        inventory={inventory}
        supplierPurchases={supplierPurchases}
        catalog={catalog}
        dataVersion={dataVersion}
        notifyDataChanged={notifyDataChanged}
      />

      <SettingsAppearanceSection theme={theme} toggleTheme={toggleTheme} />
    </section>
  );
}
