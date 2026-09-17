/**
 * Wave 4.2 — P-4.2-3 (قرار المالك T2/F-04): القسم الموحد «البيانات والنسخ الاحتياطي».
 * دمج الطبقتين القائمتين «بيانات ونسخ احتياطي محلي» و«بيانات البداية والاستعادة»
 * في قسم واحد مسمى بترتيب «الأقل تدميرًا أولًا» (WF-025):
 * الحقيقة → القفل → التصدير → الاستعادة الآمنة → الإدخال الافتتاحي الموجه →
 * تذكير النسخ → التشخيص → دقة المال → التصفير أخيرًا.
 * الصفحة تبقى الموزّع (تملك الحالة والمعالجات وبوابة الرمز) وتمرّر كل شيء خصائصِ أدناه.
 * لا خدمة ولا نص ولا مسار تغير — إعادة تنظيم سطح فقط؛ حراس PIN والمعاينة
 * ونسخة ما قبل الاستعادة (EXE-014) كما هم حرفيًا.
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
  Upload,
  type LucideIcon,
} from "lucide-react";
import { type RefObject } from "react";
import { LockSettingsCard } from "@/components/security/LockSettingsCard";
import { formatLocalDate } from "@/presentation/formatters";
import { withReturnTo } from "@/app/navigationContract";
import type { GuidedOpeningImportPreview } from "@/application/transfers/guidedOpeningImportService";
import type { BrowserPersistenceReading } from "@/application/preferences/preferenceService";
import type { TransferPreview, TransferSummary } from "@/application/transfers/localTransferService";
import type { LocalExportFile } from "@/storage/local/types";
import { DateTimeValue, IntegerValue } from "@/components/presentation/DisplayValue";

import { Button, FeedbackNote, type FeedbackKind } from "@/components/primitives";
export type SettingsDataProtectionSectionProps = {
  /* حالة القسم الموحد (مفتوح افتراضيًا؛ الإشعار والوصلة العميقة يفتحانه). */
  dataSectionOpen: boolean;
  onToggleDataSection: (open: boolean) => void;
  /* إبراز البطاقة الافتتاحية عند الوصلة العميقة أو الإشعار (سلوك الطبقة القديمة). */
  guidedAttention: boolean;
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
  diagnosticCopyResult: { kind: FeedbackKind; message: string } | null;
  /* الإدخال الافتتاحي الموجه ومعاينات الاستعادة — انتقلت من طبقتها القديمة إلى هنا. */
  guidedPreview: GuidedOpeningImportPreview | null;
  setGuidedPreview: Dispatch<SetStateAction<GuidedOpeningImportPreview | null>>;
  restoreCheck: { overall: "PASS" | "WARN" | "UNAVAILABLE" | "FAIL"; note: string } | null;
  restoreBackup: LocalExportFile | null;
  downloadRestoreBackup: () => void;
  preview: TransferPreview | null;
  setPreview: Dispatch<SetStateAction<TransferPreview | null>>;
  isWorking: boolean;
  notice: { kind: FeedbackKind; text: string; section: "storage" | "mode" } | null;
  copyDiagnosticReport: () => Promise<void>;
  exportLocal: () => Promise<void>;
  startResetFlow: () => Promise<void>;
  chooseImport: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  confirmReset: () => Promise<void>;
  setStorageNotice: (kind: FeedbackKind, text: string) => void;
  notifyDataChanged: () => void;
  onToggleBackupReminder: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
  chooseGuidedOpeningImport: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  confirmGuidedOpeningImport: () => Promise<void>;
  confirmImport: () => Promise<void>;
  navigate: (target: string) => void;
  guidedCardRef: RefObject<HTMLDivElement | null>;
  guidedInputRef: RefObject<HTMLInputElement | null>;
};

export function SettingsDataProtectionSection({
  dataSectionOpen,
  onToggleDataSection,
  guidedAttention,
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
  guidedPreview,
  setGuidedPreview,
  restoreCheck,
  restoreBackup,
  downloadRestoreBackup,
  preview,
  setPreview,
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
  chooseGuidedOpeningImport,
  confirmGuidedOpeningImport,
  confirmImport,
  navigate,
  guidedCardRef,
  guidedInputRef,
}: SettingsDataProtectionSectionProps) {
  return (
    <details
      className="micro-decision-layer"
      open={dataSectionOpen || undefined}
      onToggle={event => onToggleDataSection((event.target as HTMLDetailsElement).open)}
    >
      <summary className="micro-decision-layer-summary">
        <span>
          <b>البيانات والنسخ الاحتياطي</b>
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
        {/* ١ — الحقيقة أولًا (قراءة خالصة). */}
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
        {/* ٢ — الحماية: قفل محلي اختياري (عقد ٣٧) — تفعيل وتعطيل بالرمز. */}
        <LockSettingsCard />
        {/* ٣ — الفعل الأساسي للقسم: تصدير ينشئ ملفًا ولا يمس السجل. */}
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
        {/* ٤ — الاستعادة الآمنة (يستبدل كل شيء — عمق معاينته أدناه مباشرة). */}
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
                <IntegerValue value={preview.summary.snapshots} className="micro-inline-number" /> نسخة تكلفة
                و<IntegerValue value={preview.summary.events} className="micro-inline-number" /> حدث
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
                <b>ما سيُستبدل من بياناتك الحالية:</b> {currentSummary.orders} طلب ·{" "}
                {currentSummary.directSales} بيع مباشر · {currentSummary.financialEvents} حدث مالي ·{" "}
                {currentSummary.costEstimates} تقدير محفوظ · {currentSummary.cashWallets} محفظة.
              </p>
            ) : null}
            {/* EXE-014 (DATA-001 / AUD-NEW-09): الاستثناءات المقصودة تُفصح في
                المعاينة بوضوح — تبقى خارج الاستبدال ولا تتحول لبيانات مالية
                مستعادة دون قرار. */}
            <p className="micro-local-truth">
              يبقى خارج الاستبدال: رمز القفل المحلي وحماية هذا الجهاز، ومسودات النماذج غير المُسلّمة — تُحفظ
              كما هي وتُعرض عند فتح نماذجها.
            </p>
            <p className="micro-local-truth">
              قبل الاستبدال تُنشأ نسخة احتياطية مُتحقّقة من بياناتك الحالية وتظهر هنا للتنزيل فور نجاح
              الاستعادة — لا استبدال بلا طريق رجوع.
            </p>
            <div className="micro-form-actions">
              <Button
                action="secondary"

                disabled={isWorking}
                onClick={() => setPreview(null)}
              >
                إلغاء
              </Button>
              <Button
                action="commit"

                disabled={isWorking}
                onClick={confirmImport}
              >
                {isWorking ? "جارٍ الاستيراد…" : "استبدال البيانات المحلية"}
              </Button>
            </div>
          </section>
        ) : null}
        {/* EXE-014 (DATA-001 / AUD-NEW-09): نسخة ما قبل الاستبدال القابلة للاسترجاع + تنزيلها. */}
        {restoreBackup ? (
          <article className="micro-setting-row" data-testid="restore-backup-row">
            <div>
              <strong>نسخة ما قبل الاستبدال جاهزة</strong>
              <small>
                مُنشأة قبل الكتابة ومُتحقّقة دورة كاملة — صدرت{" "}
                <DateTimeValue value={restoreBackup.exportedAt} />؛ نزّلها واحفظها خارج الجهاز قبل أي خطوة
                لاحقة.
              </small>
            </div>
            <Button action="secondary" onClick={downloadRestoreBackup}>
              <Download aria-hidden="true" /> نزّل النسخة الاحتياطية
            </Button>
          </article>
        ) : null}
        {restoreCheck ? (
          <article className="micro-setting-row" data-status={restoreCheck.overall}>
            <div>
              <strong data-status={restoreCheck.overall}>{restoreCheck.note}</strong>
              <button
                className="micro-text-action"
                type="button"
                onClick={() => navigate(withReturnTo("/tools/integrity", "/settings"))}
              >
                افتح فحص السلامة
              </button>
            </div>
          </article>
        ) : null}
        {/* ٥ — الإدخال الافتتاحي الموجه (يكتب مرة على فراغ) — انتقل إلى القسم الموحد
            محافظًا على الوصلة العميقة ?focus=guided-import (scrollIntoView) وبطاقته المركّزة. */}
        <div
          ref={guidedCardRef}
          className="micro-settings-focused-card"
          data-focused={guidedAttention || undefined}
        >
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
            <Button
              action="secondary"

              disabled={isWorking}
              onClick={() => guidedInputRef.current?.click()}
            >
              اختيار ملف البداية
            </Button>
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
                  <IntegerValue
                    value={guidedPreview.summary.acceptedWallets}
                    className="micro-inline-number"
                  />{" "}
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
                الإدخال يكتب مرة واحدة على بيانات فارغة، وإعادة المحاولة لا تكرر الأثر. لا توجد استعادة
                تلقائية بعد التأكيد.
              </p>
              <div className="micro-form-actions">
                <Button
                  action="secondary"

                  disabled={isWorking}
                  onClick={() => setGuidedPreview(null)}
                >
                  إلغاء
                </Button>
                <Button
                  action="save"

                  disabled={isWorking}
                  onClick={confirmGuidedOpeningImport}
                >
                  {isWorking ? "جارٍ الإدخال…" : "تأكيد إدخال البداية"}
                </Button>
              </div>
            </section>
          ) : null}
        </div>
        {/* ٦ — تذكير النسخة الدوري (تفضيل هادئ). */}
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
        {/* ٧ — تشخيص محلي خصوصي (نسخ يدوي فقط لا إرسال أبدًا). */}
        <article className="micro-setting-row">
          <span className="micro-setting-icon">
            <Activity aria-hidden="true" />
          </span>
          <div>
            <h2>تقرير التشخيص المحلي</h2>
            <p>
              سجل حوادث محدود الحجم على هذا الجهاز فقط — معرّف حادثة وقالب مسار ورمز خطأ فقط؛ بلا أسماء أو
              مبالغ أو رموز قفل؛ ولا يُرسل شيءًا تلقائيًا أبدًا.
            </p>
            <Button
              action="secondary"

              onClick={() => void copyDiagnosticReport()}
            >
              <FileCheck2 aria-hidden="true" /> نسخ التقرير المحلي
            </Button>
            {diagnosticCopyResult ? (
              <FeedbackNote kind={diagnosticCopyResult.kind} word={diagnosticCopyResult.message} />
            ) : null}
          </div>
        </article>
        {/* ٨ — دقة المال معلنة (قراءة). */}
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
        {/* ٩ — الأشد تدميرًا أخيرًا: بوابة «ابدأ من جديد» — تصدير مُتحقق ثم تأكيد
            مزدوج؛ الفشل يوقف كل شيء. */}
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
              <Button
                action="secondary"

                disabled={isWorking}
                onClick={() => setResetFlow({ phase: "idle" })}
              >
                إلغاء — بياناتي تبقى
              </Button>
              <Button
                action="destructive"

                disabled={isWorking || resetNameConfirmation.trim() !== "ابدأ من جديد"}
                onClick={() => void confirmReset()}
              >
                {isWorking ? "جارٍ المسح…" : "امسح وابدأ من جديد"}
              </Button>
            </div>
          </section>
        ) : null}
        {notice?.section === "storage" ? <FeedbackNote kind={notice.kind} word={notice.text} /> : null}
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
      <Button
        action="secondary"

        disabled={disabled}
        onClick={onClick}
        aria-label={label}
      >
        <Icon aria-hidden="true" />
        {actionLabel}
      </Button>
    </article>
  );
}
