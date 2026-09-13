/**
 * المجموعة ١١ (المرحلة 11-B — تفكيك الإعدادات): حماية البيانات: القفل والتشخيص والدقة والتذكير والتصدير والاستيراد والتصفير — مقطع عرض مستخرج
 * من صفحة Settings.tsx حرفيًا؛ الصفحة تبقى الموزّع (تملك الحالة والمعالجات
 * وبوابة الرمز) وتمرّر كل شيء خصائصِ أدناه. نفس السلوك حرفيًا.
 */
import { type Dispatch, type SetStateAction } from "react";
import { type ChangeEvent } from "react";
import {
  Activity,
  BellRing,
  CircleDollarSign,
  Download,
  FileCheck2,
  RotateCcw,
  Shield,
  ShieldAlert,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { type RefObject } from "react";
import { formatLocalDateTime } from "@/presentation/formatters";
import { LockSettingsCard } from "@/components/security/LockSettingsCard";
import { formatLocalDate } from "@/presentation/formatters";
import type { BrowserPersistenceReading } from "@/application/preferences/preferenceService";
import type { TransferPreview, TransferSummary } from "@/application/transfers/localTransferService";

export type SettingsDataProtectionSectionProps = {
  persistence: BrowserPersistenceReading | null;
  lastExport: string | null;
  backupReminder: boolean | null;
  setBackupReminder: Dispatch<SetStateAction<boolean | null>>;
  currentSummary: TransferSummary | null;
  resetFlow: { phase: "idle" } | { phase: "exporting" } | { phase: "confirm" } | { phase: "done" };
  setResetFlow: Dispatch<
    SetStateAction<{ phase: "idle" } | { phase: "exporting" } | { phase: "confirm" } | { phase: "done" }>
  >;
  resetNameConfirmation: string;
  setResetNameConfirmation: Dispatch<SetStateAction<string>>;
  diagnosticCopyResult: { message: string } | null;
  preview: TransferPreview | null;
  isWorking: boolean;
  notice: { text: string; section: "storage" | "mode" } | null;
  copyDiagnosticReport: () => Promise<void>;
  exportLocal: () => Promise<void>;
  startResetFlow: () => Promise<void>;
  chooseImport: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  confirmReset: () => Promise<void>;
  setStorageNotice: (text: string) => void;
  notifyDataChanged: () => void;
  onToggleBackupReminder: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
};

export function SettingsDataProtectionSection({
  persistence,
  lastExport,
  backupReminder,
  setBackupReminder,
  currentSummary,
  resetFlow,
  setResetFlow,
  resetNameConfirmation,
  setResetNameConfirmation,
  diagnosticCopyResult,
  preview,
  isWorking,
  notice,
  copyDiagnosticReport,
  exportLocal,
  startResetFlow,
  chooseImport,
  confirmReset,
  setStorageNotice,
  notifyDataChanged,
  onToggleBackupReminder,
  inputRef,
}: SettingsDataProtectionSectionProps) {
  return (
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
        {/* المجموعة ٥ (عقد ٣٧): قفل محلي اختياري — تفعيل وتعطيل بالرمز. */}
        <LockSettingsCard />
        {/* المجموعة ٥ (التحصين الكامل): تشخيص محلي خصوصي — نسخ يدوي فقط لا إرسال أبدًا. */}
        <article className="micro-setting-row">
          <span className="micro-setting-icon">
            <Activity aria-hidden="true" />
          </span>
          <div>
            <h2>تقرير التشخيص المحلي</h2>
            <p>
              سجل حوادث محديد الحجم على هذا الجهاز فقط — معرّف حادثة وقالب مسار ورمز خطأ فقط؛ بلا أسماء أو
              مبالغ أو رموز قفل؛ ولا يُرسل شيءًا تلقائيًا أبدًا.
            </p>
            <button
              className="micro-button micro-button-secondary"
              type="button"
              onClick={() => void copyDiagnosticReport()}
            >
              <FileCheck2 aria-hidden="true" /> نسخ التقرير المحلي
            </button>
            {diagnosticCopyResult ? (
              <p className="micro-save-note" role="status">
                {diagnosticCopyResult.message}
              </p>
            ) : null}
          </div>
        </article>
        {/* P-001: سياسة دقة المال معلنة — قرشان (منزلتان عشريتان) في كل مكان:
            الإدخال والحساب والعرض والتصدير وحدةً واحدة متسقة، بلا تحويل يدوي
            ولا تفسير جديد للوحدة. ما دون القرش يُقرّب عند الإدخال بثبات، لا
            يُعرض رقمًا نصف قرش. */}
        <article className="micro-setting-row">
          <span className="micro-setting-icon">
            <CircleDollarSign aria-hidden="true" />
          </span>
          <div>
            <h2>دقة المال: قرشان للدينار</h2>
            <p>
              كل مبلغ في Micro يُدخل ويُحسب ويُعرض بمنزلتين عشريتين (القرش) — سعر البيع والتكلفة والمصروف
              والتصدير سواء. الثمن بثلاث منزلات يُدخل بقيمة القرش المقرّبة عند الكتابة، بلا قيم نصف قرش ولا
              وحدتين مختلفتين.
            </p>
          </div>
        </article>
        {/* O-001: تذكير نسخة دوري هادئ قابل للإطفاء — لا إزعاج يومي ولا حجب. */}
        <article className="micro-setting-row">
          <span className="micro-setting-icon">
            <BellRing aria-hidden="true" />
          </span>
          <div>
            <h2>تذكير النسخة الاحتياطية</h2>
            {backupReminder === null ? (
              <p>يُقرأ التفضيل…</p>
            ) : (
              <>
                <p>
                  {backupReminder
                    ? "مفعّل — سطر هادئ في الشاشة الرئيسية بعد 7 أيام من آخر تصدير مُتحقق."
                    : "مطفأ — لن يظهر سطر التذكير؛ تصديرك وعمر نسختك يبقيان كما هما في الإعدادات."}
                </p>
                <button
                  className="micro-text-action"
                  type="button"
                  disabled={isWorking}
                  onClick={onToggleBackupReminder}
                >
                  {backupReminder ? "أطفئ التذكير" : "فعّل التذكير"}
                </button>
              </>
            )}
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
              ? `آخر نسخة مُتحقق منها: ${formatLocalDate(lastExport.slice(0, 10)) ?? lastExport.slice(0, 10)} — يُعاد التحقق من الملف دورة كاملة قبل إعلان جهوزيته.`
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
              سيُمسح كل شيء على هذا الجهاز: الطلبات، الأحداث المالية، المحافظ، المخزون، والتقديرات، مع مسودات
              النماذج غير المُسلّمة (الإعداد والأحداث والنماذج المفتوحة). يبقى قفل التطبيق المحلي مفعّلًا كما
              هو. الملف المحمّل هو نسختك الوحيدة.
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
