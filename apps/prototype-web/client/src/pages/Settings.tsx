import { Download, FileCheck2, Hammer, MoonStar, Save, Shield, Trash2, Upload } from "lucide-react";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import type { OperatingModeValue } from "@/application/time/actualTimeService";
import type { TransferPreview } from "@/application/transfers/localTransferService";
import type { GuidedOpeningImportPreview } from "@/application/transfers/guidedOpeningImportService";
import { DecisionPanel } from "@/components/presentation/DecisionPanel";
import { DateTimeValue, IntegerValue } from "@/components/presentation/DisplayValue";
import { useTheme } from "@/contexts/ThemeContext";
import type { OperatingWorkMode } from "@/storage/local/types";

type OperatingModeState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; value: OperatingModeValue };

const modeOptions: Array<{ value: "" | OperatingWorkMode; label: string; description: string }> = [
  { value: "", label: "لم أحدد بعد", description: "يبقى الاختيار مفتوحًا، وتظهر الأدوات عند الحاجة فقط." },
  { value: "material_focused", label: "المادة أولًا", description: "مفيد عندما يكون فرق المادة أهم ما أراجعه في الطلب." },
  { value: "time_focused", label: "الوقت أولًا", description: "مفيد عندما يكون وقت التنفيذ مؤثرًا في العمل أو الخدمة." },
  { value: "mixed", label: "المادة والوقت معًا", description: "مفيد عندما يؤثر كل من المادة ووقت التنفيذ في القرار." },
];

export default function SettingsPage() {
  const { theme, preference, toggleTheme } = useTheme();
  const [, navigate] = useLocation();
  const { actualTime, transfers, guidedOpeningImport, dataVersion, notifyDataChanged } = usePrototypeServices();
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
  const [resetArmed, setResetArmed] = useState(false);

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
    const result = await transfers.createExport();
    setIsWorking(false);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    const blob = new Blob([JSON.stringify(result.value, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `micro-local-${result.value.exportedAt.slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice("تم تجهيز ملف تصدير محلي. احتفظ به في مكان تختاره؛ لا توجد نسخة سحابية هنا.");
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
      if (!prepared.ok) { setNotice(prepared.message); return; }
      setGuidedPreview(prepared.value);
    } catch { setNotice("تعذر قراءة ملف البداية. بقيت بيانات هذا الجهاز دون تغيير."); }
    finally { setIsWorking(false); }
  }

  async function confirmGuidedOpeningImport() {
    if (!guidedPreview) return;
    setNotice(null);
    setIsWorking(true);
    const result = await guidedOpeningImport.confirm(guidedPreview);
    setIsWorking(false);
    if (!result.ok) { setNotice(result.message); return; }
    setGuidedPreview(null);
    notifyDataChanged();
    setNotice(result.reused ? "تم التعرف على هذه المحاولة مسبقًا؛ لم يتكرر أي أثر." : "تم إدخال الموقف الافتتاحي المحدود مع إبقاء ما لم نعرفه خارج السجل.");
  }

  async function resetLocalData() {
    setNotice(null);
    setIsWorking(true);
    const result = await transfers.resetLocalData();
    setIsWorking(false);
    if (!result.ok) { setNotice(result.message); return; }
    setResetArmed(false);
    notifyDataChanged();
    setNotice("تم مسح البيانات المحلية من هذا الجهاز. لا توجد نسخة سحابية يمكن استعادتها.");
    navigate("/setup");
  }

  const selectedModeDescription = modeOptions.find(option => option.value === selectedMode)?.description;

  return <section className="micro-page">
    <div className="micro-page-heading">
      <span className="micro-overline">التحكم المحلي</span>
      <h1>الإعدادات</h1>
      <p>خيارات الواجهة وحماية البيانات على هذا الجهاز.</p>
    </div>
    <DecisionPanel label="الحقيقة المحلية" truth="بيانات Micro محفوظة محليًا على هذا الجهاز." nextAction="حذف التطبيق أو بيانات المتصفح لا يضمن الاحتفاظ بها؛ صدّر نسخة محلية قبل الحذف أو تغيير الهاتف." tone="warning" />
    <section className="micro-settings-list" aria-label="إعدادات الواجهة وطريقة العمل والبيانات">
      <article className="micro-setting-row">
        <span className="micro-setting-icon"><MoonStar aria-hidden="true" /></span>
        <div>
          <h2>المظهر</h2>
          <p>المعروض الآن: {theme === "dark" ? "داكن" : "فاتح"}، والافتراضي عند البداية: {preference === "system" ? "النظام" : "اختيارك المحلي"}.</p>
        </div>
        <button className="micro-button micro-button-secondary" type="button" onClick={toggleTheme}>تبديل</button>
      </article>
      <article className="micro-setting-row">
        <span className="micro-setting-icon"><Shield aria-hidden="true" /></span>
        <div>
          <h2>بياناتك على هذا الجهاز</h2>
          <p>لا توجد مزامنة سحابية أو تسجيل دخول أو نسخة احتياطية تلقائية هنا.</p>
        </div>
      </article>
    </section>
    <section className="micro-form-card" aria-labelledby="operating-mode-title">
      <div className="micro-section-heading">
        <div>
          <span className="micro-overline">تفضيل اختياري</span>
          <h2 id="operating-mode-title">كيف تنجز عملك غالبًا؟</h2>
        </div>
        <Hammer aria-hidden="true" />
      </div>
      <p>يساعد هذا الاختيار Micro على تقديم الأداة الأقرب لسؤالك في الطلب. لا يغير نوع النشاط أو سجلًا تاريخيًا أو أي رقم مالي.</p>
      {operatingMode.phase === "loading" ? <p className="micro-route-loading" role="status">جارٍ قراءة تفضيل طريقة العمل…</p> : null}
      {operatingMode.phase === "error" ? <div className="micro-storage-error" role="alert"><strong>تعذر قراءة التفضيل المحلي</strong><p>{operatingMode.message}</p></div> : null}
      {operatingMode.phase === "ready" ? <>
        <label className="micro-field">
          <span>طريقة العمل المعتادة</span>
          <select value={selectedMode} onChange={event => setSelectedMode(event.target.value as "" | OperatingWorkMode)} aria-describedby="operating-mode-help">
            {modeOptions.map(option => <option key={option.value || "none"} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <p id="operating-mode-help" className="micro-local-truth">{selectedModeDescription}</p>
        <label className="micro-confirm-warning micro-setting-toggle">
          <input type="checkbox" checked={trackingEnabled} onChange={event => setTrackingEnabled(event.target.checked)} />
          <span><b>تفعيل تتبع الوقت المحلي</b> يتيح تسجيل وقت فعلي للطلب لاحقًا عند الحاجة، ولا يشغّل مؤقتًا في الخلفية.</span>
        </label>
        <p className="micro-cost-disclaimer">عدم الاختيار أو إيقاف التتبع لا يمنع إنشاء الطلب أو تسجيل المال أو المادة؛ لكنه يعني أن مقارنة الوقت لن تكون متاحة بلا سجل.</p>
        <button className="micro-button micro-button-primary micro-save-cost" type="button" disabled={isSavingOperatingMode} onClick={saveOperatingMode}><Save aria-hidden="true" />{isSavingOperatingMode ? "جارٍ حفظ التفضيل…" : "حفظ طريقة العمل"}</button>
      </> : null}
    </section>
    <section className="micro-settings-list" aria-label="إدارة البيانات المحلية">
      <StorageRow icon={Download} title="تصدير محلي" text="ينشئ ملف JSON لبيانات Prototype الحالية دون أسرار أو مفاتيح." label="تصدير البيانات المحلية" disabled={isWorking} onClick={exportLocal} />
      <StorageRow icon={Upload} title="استيراد محلي" text="نقرأ الملف ونتحقق منه أولًا، ثم نعرض ملخصًا قبل استبدال أي بيانات." label="اختيار ملف استيراد" disabled={isWorking} onClick={() => inputRef.current?.click()} />
      <input ref={inputRef} className="micro-visually-hidden" type="file" accept="application/json,.json" onChange={chooseImport} />
    </section>
    <section className="micro-form-card" aria-labelledby="guided-opening-title">
      <div className="micro-section-heading"><div><span className="micro-overline">بداية محدودة</span><h2 id="guided-opening-title">إدخال موقف افتتاحي</h2></div><Upload aria-hidden="true" /></div>
      <p>أدخل نشاطًا ومحافظ كاش وموادًا معلنة من تاريخ البداية فقط. لا يحول هذا الملف تاريخًا قديمًا إلى مبيعات أو ربح أو ديون.</p>
      <button className="micro-button micro-button-secondary" type="button" disabled={isWorking} onClick={() => guidedInputRef.current?.click()}>اختيار ملف البداية</button>
      <input ref={guidedInputRef} className="micro-visually-hidden" type="file" accept="application/json,.json" onChange={chooseGuidedOpeningImport} />
    </section>
    {guidedPreview ? <section className="micro-import-preview" aria-live="polite">
      <span className="micro-overline"><FileCheck2 aria-hidden="true" /> مراجعة قبل الكتابة</span>
      <h2>لم نغير بياناتك بعد</h2>
      <p>سيُدخل الملف موقفًا افتتاحيًا محدودًا فقط:</p>
      <ul><li><IntegerValue value={guidedPreview.summary.acceptedWallets} className="micro-inline-number" /> محفظة كاش بقيمة <IntegerValue value={guidedPreview.summary.acceptedCashMinor} className="micro-inline-number" /> قرشًا</li><li><IntegerValue value={guidedPreview.summary.acceptedMaterials} className="micro-inline-number" /> مادة بكمية <IntegerValue value={guidedPreview.summary.acceptedMaterialQuantityMilli} className="micro-inline-number" /> milli</li><li><IntegerValue value={guidedPreview.summary.estimatedRecords} className="micro-inline-number" /> قيمة تقديرية تحتاج مراجعة</li></ul>
      <p className="micro-local-truth">الاستيراد ذري على Store فارغ، وإعادة المحاولة لا تكرر الأثر. لا توجد استعادة تلقائية بعد التأكيد.</p>
      <div className="micro-form-actions"><button className="micro-button micro-button-secondary" type="button" disabled={isWorking} onClick={() => setGuidedPreview(null)}>إلغاء</button><button className="micro-button micro-button-primary" type="button" disabled={isWorking} onClick={confirmGuidedOpeningImport}>{isWorking ? "جارٍ الإدخال…" : "تأكيد إدخال البداية"}</button></div>
    </section> : null}
    {preview ? <section className="micro-import-preview" aria-live="polite">
      <span className="micro-overline"><FileCheck2 aria-hidden="true" /> ملف جاهز للمراجعة</span>
      <h2>لم نغير بياناتك بعد</h2>
      <p>الملف صادر في <DateTimeValue value={preview.summary.exportedAt} /> ويحتوي على:</p>
      <ul>
        <li>{preview.summary.profile ? "ملف نشاط واحد" : "لا يحتوي ملف نشاط"}</li>
        <li>{preview.summary.preferences ? "تفضيل مظهر وطريقة عمل محفوظ" : "لا يحتوي تفضيلًا محفوظًا"}</li>
        <li><IntegerValue value={preview.summary.drafts} className="micro-inline-number" /> مسودة</li>
        <li><IntegerValue value={preview.summary.orders} className="micro-inline-number" /> طلب</li>
        <li><IntegerValue value={preview.summary.schedules} className="micro-inline-number" /> موعد</li>
        <li><IntegerValue value={preview.summary.supplierPurchases} className="micro-inline-number" /> شراء مواد</li>
        <li><IntegerValue value={preview.summary.cashWallets} className="micro-inline-number" /> محافظ كاش و<IntegerValue value={preview.summary.cashContinuityEntries} className="micro-inline-number" /> آثار افتتاح/تحويل/تصحيح</li>
        <li><IntegerValue value={preview.summary.materials} className="micro-inline-number" /> مواد و<IntegerValue value={preview.summary.inventoryMovements} className="micro-inline-number" /> حركات مخزون</li>
        <li><IntegerValue value={preview.summary.snapshots} className="micro-inline-number" /> Snapshot تكلفة و<IntegerValue value={preview.summary.events} className="micro-inline-number" /> حدث</li>
      </ul>
      <p className="micro-field-error">التأكيد سيستبدل البيانات المحلية الحالية بهذا الملف. لا توجد استعادة تلقائية بعد الضغط.</p>
      <div className="micro-form-actions">
        <button className="micro-button micro-button-secondary" type="button" disabled={isWorking} onClick={() => setPreview(null)}>إلغاء</button>
        <button className="micro-button micro-button-primary" type="button" disabled={isWorking} onClick={confirmImport}>{isWorking ? "جارٍ الاستيراد…" : "استبدال البيانات المحلية"}</button>
      </div>
    </section> : null}
    <section className="micro-form-card micro-danger-zone" aria-labelledby="reset-local-data-title">
      <div className="micro-section-heading"><div><span className="micro-overline">إجراء نهائي محلي</span><h2 id="reset-local-data-title">إعادة ضبط البيانات</h2></div><Trash2 aria-hidden="true" /></div>
      <p>يمسح هذا الجهاز كل المسودات والطلبات والأحداث والإعدادات المحلية. صدّر نسخة JSON أولًا إذا أردت الاحتفاظ بها؛ لا توجد مزامنة أو استعادة سحابية.</p>
      {resetArmed ? <div className="micro-confirm-warning" role="alert"><Trash2 aria-hidden="true" /><span><b>سيُحذف السجل المحلي عند التأكيد.</b> لا يمكن التراجع من داخل Micro بعد المسح، ولن تتغير أي بيانات خارج هذا الجهاز.</span></div> : null}
      <div className="micro-form-actions"><button className="micro-button micro-button-secondary" type="button" disabled={isWorking} onClick={() => setResetArmed(current => !current)}>{resetArmed ? "إلغاء إعادة الضبط" : "إعادة ضبط محلية"}</button>{resetArmed ? <button className="micro-button micro-button-danger" type="button" disabled={isWorking} onClick={() => { void resetLocalData(); }}><Trash2 aria-hidden="true" />{isWorking ? "جارٍ مسح البيانات…" : "تأكيد مسح البيانات"}</button> : null}</div>
    </section>
    {notice ? <p className="micro-save-note" role="status">{notice}</p> : null}
  </section>;
}

function StorageRow({ icon: Icon, title, text, label, disabled, onClick }: { icon: typeof Download; title: string; text: string; label: string; disabled: boolean; onClick: () => void }) {
  return <article className="micro-setting-row"><span className="micro-setting-icon"><Icon aria-hidden="true" /></span><div><h2>{title}</h2><p>{text}</p></div><button className="micro-icon-button" type="button" disabled={disabled} onClick={onClick} aria-label={label}><Icon aria-hidden="true" /></button></article>;
}
