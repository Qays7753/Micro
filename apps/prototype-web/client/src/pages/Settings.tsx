import { Download, FileCheck2, Hammer, MoonStar, RotateCcw, Save, Shield, Upload } from "lucide-react";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import type { OperatingModeValue } from "@/application/time/actualTimeService";
import type { TransferPreview, TransferSummary } from "@/application/transfers/localTransferService";
import type { GuidedOpeningImportPreview } from "@/application/transfers/guidedOpeningImportService";
import { DecisionPanel } from "@/components/presentation/DecisionPanel";
import { DateTimeValue, IntegerValue } from "@/components/presentation/DisplayValue";
import { useTheme } from "@/contexts/ThemeContext";
import type { BrowserPersistenceReading } from "@/application/preferences/preferenceService";
import type { OperatingWorkMode } from "@/storage/local/types";

type OperatingModeState =
  { phase: "loading" } | { phase: "error"; message: string } | { phase: "ready"; value: OperatingModeValue };

const modeOptions: Array<{ value: "" | OperatingWorkMode; label: string; description: string }> = [
  { value: "", label: "لم أحدد بعد", description: "يبقى الاختيار مفتوحًا، وتظهر الأدوات عند الحاجة فقط." },
  {
    value: "material_focused",
    label: "المادة أولًا",
    description: "مفيد عندما يكون فرق المادة أهم ما أراجعه في الطلب.",
  },
  {
    value: "time_focused",
    label: "الوقت أولًا",
    description: "مفيد عندما يكون وقت التنفيذ مؤثرًا في العمل أو الخدمة.",
  },
  {
    value: "mixed",
    label: "المادة والوقت معًا",
    description: "مفيد عندما يؤثر كل من المادة ووقت التنفيذ في القرار.",
  },
];

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const [, navigate] = useLocation();
  const { actualTime, transfers, guidedOpeningImport, preferences, dataVersion, notifyDataChanged } =
    usePrototypeServices();
  const [persistence, setPersistence] = useState<BrowserPersistenceReading | null>(null);
  /* ٥.٧: حالة النسخة المُتحققة وبوابة «ابدأ من جديد». */
  const [lastExport, setLastExport] = useState<string | null>(null);
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
  const [notice, setNotice] = useState<string | null>(null);
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
      setNotice(result.message);
      return;
    }
    setOperatingMode({ phase: "ready", value: result.value });
    notifyDataChanged();
    setNotice("تم حفظ طريقة العمل وتتبع الوقت على هذا الجهاز فقط.");
  }

  async function exportLocal() {
    setNotice(null);
    setIsWorking(true);
    /* ٥.٧: تصدير مُتحقق منه — يُعاد تحليل الملف دورة كاملة قبل إعلان جهوزيته. */
    const result = await transfers.createVerifiedExport();
    setIsWorking(false);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    const blob = new Blob([JSON.stringify(result.value.file, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `micro-local-${result.value.file.exportedAt.slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    await preferences.markVerifiedExport();
    setLastExport(result.value.file.exportedAt);
    setCurrentSummary(result.value.summary);
    notifyDataChanged();
    setNotice(
      "النسخة جاهزة ومُتحقق منها ✓ — احفظها بمكان آمن، فيها كل أرقامك. لو ضاع الجهاز بتضيع معه؛ لا سحابة في هذا الإصدار.",
    );
  }

  /* ٥.٧: بوابة «ابدأ من جديد» — لا تصفير قبل نسخة مُتحقق منها، ولا استمرار إن فشل التصدير. */
  async function startResetFlow() {
    setNotice(null);
    setResetFlow({ phase: "exporting" });
    const result = await transfers.createVerifiedExport();
    if (!result.ok) {
      setResetFlow({ phase: "idle" });
      setNotice(
        `${result.message} بياناتك كما هي — لا يبدأ أي تصفير قبل نسخة احتياطية ناجحة.`,
      );
      return;
    }
    const blob = new Blob([JSON.stringify(result.value.file, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `micro-local-${result.value.file.exportedAt.slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    await preferences.markVerifiedExport();
    setLastExport(result.value.file.exportedAt);
    setResetNameConfirmation("");
    setResetFlow({ phase: "confirm" });
  }

  async function confirmReset() {
    setNotice(null);
    setIsWorking(true);
    const result = await transfers.resetAll();
    setIsWorking(false);
    if (!result.ok) {
      setResetFlow({ phase: "idle" });
      setNotice(result.message);
      return;
    }
    setResetFlow({ phase: "done" });
    notifyDataChanged();
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
        setNotice(prepared.message);
        return;
      }
      setPreview(prepared.value);
    } catch {
      setNotice("تعذر قراءة الملف. بقيت بيانات هذا الجهاز دون تغيير.");
    } finally {
      setIsWorking(false);
    }
  }

  async function confirmImport() {
    if (!preview) return;
    setNotice(null);
    setIsWorking(true);
    const result = await transfers.confirmImport(preview);
    setIsWorking(false);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setPreview(null);
    notifyDataChanged();
    setNotice("تم استبدال البيانات المحلية بالملف الذي راجعته.");
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
        setNotice(prepared.message);
        return;
      }
      setGuidedPreview(prepared.value);
    } catch {
      setNotice("تعذر قراءة ملف البداية. بقيت بيانات هذا الجهاز دون تغيير.");
    } finally {
      setIsWorking(false);
    }
  }

  async function confirmGuidedOpeningImport() {
    if (!guidedPreview) return;
    setNotice(null);
    setIsWorking(true);
    const result = await guidedOpeningImport.confirm(guidedPreview);
    setIsWorking(false);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setGuidedPreview(null);
    notifyDataChanged();
    setNotice(
      result.reused
        ? "تم التعرف على هذه المحاولة مسبقًا؛ لم يتكرر أي أثر."
        : "تم إدخال الموقف الافتتاحي المحدود مع إبقاء ما لم نعرفه خارج السجل.",
    );
  }

  const selectedModeDescription = modeOptions.find(option => option.value === selectedMode)?.description;

  /* مبدأ Micro: التفضيل اليومي ظاهر، أما البيانات الحساسة والاستعادة فتحتاج فتحًا مقصودًا. */
  return (
    <section className="micro-page">
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
      <details className="micro-decision-layer" open>
        <summary className="micro-decision-layer-summary">
          <span>
            <b>بيانات ونسخ احتياطي محلي</b>
            <small>تصدير واستيراد حساس؛ راجع الملف قبل استبدال بيانات الجهاز.</small>
          </span>
          <strong>افتح البيانات</strong>
        </summary>
        <section className="micro-settings-list" aria-labelledby="data-protection-title">
        <div className="micro-section-heading">
          <div>
            <span className="micro-overline">حماية البيانات</span>
            <h2 id="data-protection-title">احمِ بياناتك</h2>
          </div>
          <Shield aria-hidden="true" />
        </div>
        <article className="micro-setting-row">
          <span className="micro-setting-icon">
            <Shield aria-hidden="true" />
          </span>
          <div>
            <h2>بياناتك على هذا الجهاز</h2>
            <p>لا توجد مزامنة سحابية أو تسجيل دخول أو نسخة احتياطية تلقائية هنا.</p>
          </div>
        </article>
        {persistence !== null ? (
          <article className="micro-setting-row">
            <span className="micro-setting-icon">
              <Shield aria-hidden="true" />
            </span>
            <div>
              <h2>{persistence.title}</h2>
              <p>{persistence.text}</p>
            </div>
          </article>
        ) : null}
        <StorageRow
          icon={Download}
          title={lastExport ? "تصدير محلي مُتحقق" : "تصدير محلي"}
          text={
            lastExport
              ? `آخر نسخة مُتحقق منها: ${lastExport.slice(0, 10)} — يُعاد التحقق من الملف دورة كاملة قبل إعلان جهوزيته.`
              : "ينشئ ملف نسخة مُتحققًا منه لبياناتك الحالية على هذا الجهاز، دون أسرار أو مفاتيح."
          }
          actionLabel="تصدير"
          label="تصدير البيانات المحلية"
          disabled={isWorking}
          onClick={exportLocal}
        />
        <StorageRow
          icon={Upload}
          title="استيراد محلي"
          text="نقرأ الملف ونتحقق منه أولًا، ثم نعرض ملخصًا قبل استبدال أي بيانات."
          actionLabel="استيراد"
          label="اختيار ملف استيراد"
          disabled={isWorking}
          onClick={() => inputRef.current?.click()}
        />
        <input
          ref={inputRef}
          className="micro-visually-hidden"
          type="file"
          accept="application/json,.json"
          onChange={chooseImport}
        />
        {/* ٥.٧: بوابة «ابدأ من جديد» — تصدير مُتحقق ثم تأكيد مزدوج؛ الفشل يوقف كل شيء. */}
        {resetFlow.phase === "idle" || resetFlow.phase === "done" ? (
          <StorageRow
            icon={RotateCcw}
            title="ابدأ من جديد"
            text="يمسح كل بيانات هذا الجهاز بعد نسخة احتياطية مُتحقق منها إلزاميًا. الفشل يوقف العملية بالكامل."
            actionLabel="ابدأ"
            label="بدء مسار المشروع الجديد"
            disabled={isWorking}
            onClick={() => void startResetFlow()}
          />
        ) : null}
        {resetFlow.phase === "exporting" ? (
          <p className="micro-save-note" role="status">
            جارٍ إنشاء نسخة احتياطية مُتحقق منها والتحقق منها… لم يُمس أي شيء بعد.
          </p>
        ) : null}
        {resetFlow.phase === "confirm" ? (
          <section className="micro-import-preview" aria-live="polite">
            <span className="micro-overline">
              <RotateCcw aria-hidden="true" /> بوابة البدء من جديد
            </span>
            <h2>النسخة الاحتياطية جاهزة ومُتحقق منها</h2>
            <p>
              حُمّل الملف إلى جهازك (micro-local-{lastExport?.slice(0, 10) ?? ""}.json). لتأكيد المسح اكتب
              «ابدأ من جديد» في الحقل أدناه.
            </p>
            <label className="micro-field">
              <span>اكتب «ابدأ من جديد» للتأكيد</span>
              <input
                value={resetNameConfirmation}
                onChange={event => setResetNameConfirmation(event.target.value)}
                placeholder="ابدأ من جديد"
              />
            </label>
            <p className="micro-field-error">
              سيُمسح كل شيء على هذا الجهاز: الطلبات، الأحداث المالية، المحافظ، المخزون، والتقديرات. الملف
              المحمّل هو نسختك الوحيدة.
            </p>
            <div className="micro-form-actions">
              <button
                className="micro-button micro-button-secondary"
                type="button"
                disabled={isWorking}
                onClick={() => setResetFlow({ phase: "idle" })}
              >
                إلغاء — بياناتي تبقى
              </button>
              <button
                className="micro-button micro-button-danger"
                type="button"
                disabled={isWorking || resetNameConfirmation.trim() !== "ابدأ من جديد"}
                onClick={() => void confirmReset()}
              >
                {isWorking ? "جارٍ المسح…" : "امسح وابدأ من جديد"}
              </button>
            </div>
          </section>
        ) : null}
      </section>
      </details>
      <details className="micro-decision-layer" open>
        <summary className="micro-decision-layer-summary">
          <span>
            <b>تفضيلات العمل اليومية</b>
            <small>اختر طريقة العمل وتتبّع الوقت دون تغيير السجل المالي.</small>
          </span>
          <strong>افتح التفضيل</strong>
        </summary>
        <section className="micro-form-card" aria-labelledby="operating-mode-title">
          <div className="micro-section-heading">
            <div>
              <span className="micro-overline">تفضيل اختياري</span>
              <h2 id="operating-mode-title">كيف تنجز عملك غالبًا؟</h2>
            </div>
            <Hammer aria-hidden="true" />
          </div>
          <p>
            يساعد هذا الاختيار Micro على تقديم الأداة الأقرب لسؤالك في الطلب. لا يغير نوع النشاط أو سجلًا
            تاريخيًا أو أي رقم مالي.
          </p>
          {operatingMode.phase === "loading" ? (
            <p className="micro-route-loading" role="status">
              جارٍ قراءة تفضيل طريقة العمل…
            </p>
          ) : null}
          {operatingMode.phase === "error" ? (
            <div className="micro-storage-error" role="alert">
              <strong>تعذر قراءة التفضيل المحلي</strong>
              <p>{operatingMode.message}</p>
            </div>
          ) : null}
          {operatingMode.phase === "ready" ? (
            <>
              <label className="micro-field">
                <span>طريقة العمل المعتادة</span>
                <select
                  value={selectedMode}
                  onChange={event => setSelectedMode(event.target.value as "" | OperatingWorkMode)}
                  aria-describedby="operating-mode-help"
                >
                  {modeOptions.map(option => (
                    <option key={option.value || "none"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <p id="operating-mode-help" className="micro-local-truth">
                {selectedModeDescription}
              </p>
              <label className="micro-confirm-warning micro-setting-toggle">
                <input
                  type="checkbox"
                  checked={trackingEnabled}
                  onChange={event => setTrackingEnabled(event.target.checked)}
                />
                <span>
                  <b>تفعيل تتبع الوقت المحلي</b> يتيح تسجيل وقت فعلي للطلب لاحقًا عند الحاجة، ولا يشغّل مؤقتًا
                  في الخلفية.
                </span>
              </label>
              <p className="micro-cost-disclaimer">
                عدم الاختيار أو إيقاف التتبع لا يمنع إنشاء الطلب أو تسجيل المال أو المادة؛ لكنه يعني أن مقارنة
                الوقت لن تكون متاحة بلا سجل.
              </p>
              <button
                className="micro-button micro-button-primary micro-save-cost"
                type="button"
                disabled={isSavingOperatingMode}
                onClick={saveOperatingMode}
              >
                <Save aria-hidden="true" />
                {isSavingOperatingMode ? "جارٍ حفظ التفضيل…" : "حفظ طريقة العمل"}
              </button>
            </>
          ) : null}
        </section>
      </details>
      <details className="micro-decision-layer" open>
        <summary className="micro-decision-layer-summary">
          <span>
            <b>المظهر</b>
            <small>تغيير العرض اليومي فقط.</small>
          </span>
          <strong>افتح المظهر</strong>
        </summary>
        <section className="micro-settings-list" aria-label="إعدادات المظهر">
          <article className="micro-setting-row">
            <span className="micro-setting-icon">
              <MoonStar aria-hidden="true" />
            </span>
            <div>
              <h2>المظهر</h2>
              <p>الوضع الحالي: {theme === "dark" ? "داكن" : "فاتح"}.</p>
            </div>
            <button className="micro-button micro-button-secondary" type="button" onClick={toggleTheme}>
              التبديل إلى {theme === "dark" ? "الفاتح" : "الداكن"}
            </button>
          </article>
        </section>
      </details>
      <details className="micro-decision-layer">
        <summary className="micro-decision-layer-summary">
          <span>
            <b>بيانات البداية والاستعادة</b>
            <small>إدخال أو استبدال محلي حساس؛ راجع الملخص قبل الكتابة.</small>
          </span>
          <strong>افتح البيانات</strong>
        </summary>
        <section className="micro-form-card" aria-labelledby="guided-opening-title">
          <div className="micro-section-heading">
            <div>
              <span className="micro-overline">بداية محدودة</span>
              <h2 id="guided-opening-title">إدخال موقف افتتاحي</h2>
            </div>
            <Upload aria-hidden="true" />
          </div>
          <p>
            أدخل نشاطًا ومحافظ كاش وموادًا معلنة من تاريخ البداية فقط. لا يحول هذا الملف تاريخًا قديمًا إلى
            مبيعات أو ربح أو ديون.
          </p>
          <button
            className="micro-button micro-button-secondary"
            type="button"
            disabled={isWorking}
            onClick={() => guidedInputRef.current?.click()}
          >
            اختيار ملف البداية
          </button>
          <input
            ref={guidedInputRef}
            className="micro-visually-hidden"
            type="file"
            accept="application/json,.json"
            onChange={chooseGuidedOpeningImport}
          />
        </section>
        {guidedPreview ? (
          <section className="micro-import-preview" aria-live="polite">
            <span className="micro-overline">
              <FileCheck2 aria-hidden="true" /> مراجعة قبل الكتابة
            </span>
            <h2>لم نغير بياناتك بعد</h2>
            <p>سيُدخل الملف موقفًا افتتاحيًا محدودًا فقط:</p>
            <ul>
              <li>
                <IntegerValue value={guidedPreview.summary.acceptedWallets} className="micro-inline-number" />{" "}
                محفظة كاش بقيمة{" "}
                <IntegerValue
                  value={guidedPreview.summary.acceptedCashMinor}
                  className="micro-inline-number"
                />{" "}
                قرشًا
              </li>
              <li>
                <IntegerValue
                  value={guidedPreview.summary.acceptedMaterials}
                  className="micro-inline-number"
                />{" "}
                مادة بكمية{" "}
                <IntegerValue
                  value={guidedPreview.summary.acceptedMaterialQuantityMilli}
                  className="micro-inline-number"
                />{" "}
                (أجزاء من ألف)
              </li>
              <li>
                <IntegerValue
                  value={guidedPreview.summary.estimatedRecords}
                  className="micro-inline-number"
                />{" "}
                قيمة تقديرية تحتاج مراجعة
              </li>
            </ul>
            <p className="micro-local-truth">
              الإدخال يكتب مرة واحدة على بيانات فارغة، وإعادة المحاولة لا تكرر الأثر. لا توجد استعادة تلقائية
              بعد التأكيد.
            </p>
            <div className="micro-form-actions">
              <button
                className="micro-button micro-button-secondary"
                type="button"
                disabled={isWorking}
                onClick={() => setGuidedPreview(null)}
              >
                إلغاء
              </button>
              <button
                className="micro-button micro-button-primary"
                type="button"
                disabled={isWorking}
                onClick={confirmGuidedOpeningImport}
              >
                {isWorking ? "جارٍ الإدخال…" : "تأكيد إدخال البداية"}
              </button>
            </div>
          </section>
        ) : null}
        {preview ? (
          <section className="micro-import-preview" aria-live="polite">
            <span className="micro-overline">
              <FileCheck2 aria-hidden="true" /> ملف جاهز للمراجعة
            </span>
            <h2>لم نغير بياناتك بعد</h2>
            <p>
              الملف صادر في <DateTimeValue value={preview.summary.exportedAt} /> ويحتوي على:
            </p>
            <ul>
              <li>{preview.summary.profile ? "ملف نشاط واحد" : "لا يحتوي ملف نشاط"}</li>
              <li>
                {preview.summary.preferences ? "تفضيل مظهر وطريقة عمل محفوظ" : "لا يحتوي تفضيلًا محفوظًا"}
              </li>
              <li>
                <IntegerValue value={preview.summary.drafts} className="micro-inline-number" /> مسودة
              </li>
              <li>
                <IntegerValue value={preview.summary.orders} className="micro-inline-number" /> طلب ·{" "}
                <IntegerValue value={preview.summary.directSales} className="micro-inline-number" /> بيع مباشر
              </li>
              <li>
                <IntegerValue value={preview.summary.schedules} className="micro-inline-number" /> موعد
              </li>
              <li>
                <IntegerValue value={preview.summary.supplierPurchases} className="micro-inline-number" />{" "}
                شراء مواد
              </li>
              <li>
                <IntegerValue value={preview.summary.cashWallets} className="micro-inline-number" /> محافظ كاش
                و
                <IntegerValue
                  value={preview.summary.cashContinuityEntries}
                  className="micro-inline-number"
                />{" "}
                آثار افتتاح/تحويل/تصحيح
              </li>
              <li>
                <IntegerValue value={preview.summary.materials} className="micro-inline-number" /> مواد و
                <IntegerValue
                  value={preview.summary.inventoryMovements}
                  className="micro-inline-number"
                />{" "}
                حركات مخزون
              </li>
              <li>
                <IntegerValue value={preview.summary.snapshots} className="micro-inline-number" /> نسخة
                تكلفة و<IntegerValue value={preview.summary.events} className="micro-inline-number" /> حدث
                مالي/تشغيلي داخل الطلب
              </li>
              <li>
                <IntegerValue value={preview.summary.actualTimeRecords} className="micro-inline-number" /> سجل
                وقت فعلي تفسيري مستقل عن المال
              </li>
            </ul>
            <p className="micro-field-error">
              التأكيد سيستبدل البيانات المحلية الحالية بهذا الملف. لا توجد استعادة تلقائية بعد الضغط.
            </p>
            {/* ٥.٧: معاينة الاستعادة تعرض ما سيُستبدل — أرقامك الحالية مقابل محتوى الملف. */}
            {currentSummary ? (
              <p>
                <b>ما سيُستبدل من بياناتك الحالية:</b>{" "}
                {currentSummary.orders} طلب · {currentSummary.directSales} بيع مباشر ·{" "}
                {currentSummary.financialEvents} حدث مالي · {currentSummary.costEstimates} تقدير محفوظ ·{" "}
                {currentSummary.cashWallets} محفظة.
              </p>
            ) : null}
            <div className="micro-form-actions">
              <button
                className="micro-button micro-button-secondary"
                type="button"
                disabled={isWorking}
                onClick={() => setPreview(null)}
              >
                إلغاء
              </button>
              <button
                className="micro-button micro-button-primary"
                type="button"
                disabled={isWorking}
                onClick={confirmImport}
              >
                {isWorking ? "جارٍ الاستيراد…" : "استبدال البيانات المحلية"}
              </button>
            </div>
          </section>
        ) : null}
      </details>
      {notice ? (
        <p className="micro-save-note" role="status">
          {notice}
        </p>
      ) : null}
    </section>
  );
}

function StorageRow({
  icon: Icon,
  title,
  text,
  actionLabel,
  label,
  disabled,
  onClick,
}: {
  icon: typeof Download;
  title: string;
  text: string;
  actionLabel: string;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <article className="micro-setting-row">
      <span className="micro-setting-icon">
        <Icon aria-hidden="true" />
      </span>
      <div>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
      <button
        className="micro-button micro-button-secondary"
        type="button"
        disabled={disabled}
        onClick={onClick}
        aria-label={label}
      >
        <Icon aria-hidden="true" />
        {actionLabel}
      </button>
    </article>
  );
}
