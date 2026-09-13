/**
 * المجموعة ١١ (المرحلة 11-B — تفكيك الإعدادات): إدخال الموقف الافتتاحي الموجّه بمعايناته — مقطع عرض مستخرج
 * من صفحة Settings.tsx حرفيًا؛ الصفحة تبقى الموزّع (تملك الحالة والمعالجات
 * وبوابة الرمز) وتمرّر كل شيء خصائصِ أدناه. نفس السلوك حرفيًا.
 */
import { type ChangeEvent, type Dispatch, type RefObject, type SetStateAction } from "react";
import { FileCheck2, Upload } from "lucide-react";
import { withFrom } from "@/app/navigationContract";
import type { GuidedOpeningImportPreview } from "@/application/transfers/guidedOpeningImportService";
import type { TransferPreview, TransferSummary } from "@/application/transfers/localTransferService";
import { DateTimeValue, IntegerValue } from "@/components/presentation/DisplayValue";
import { formatLocalDateTime } from "@/presentation/formatters";

export type SettingsGuidedOpeningSectionProps = {
  guidedLayerOpen: boolean;
  setGuidedLayerOpen: Dispatch<SetStateAction<boolean>>;
  guidedPreview: GuidedOpeningImportPreview | null;
  setGuidedPreview: Dispatch<SetStateAction<GuidedOpeningImportPreview | null>>;
  currentSummary: TransferSummary | null;
  restoreCheck: { overall: "PASS" | "WARN" | "FAIL"; note: string } | null;
  isWorking: boolean;
  preview: TransferPreview | null;
  setPreview: Dispatch<SetStateAction<TransferPreview | null>>;
  notice: { text: string; section: "storage" | "mode" } | null;
  chooseGuidedOpeningImport: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  confirmGuidedOpeningImport: () => Promise<void>;
  confirmImport: () => Promise<void>;
  navigate: (target: string) => void;
  guidedCardRef: RefObject<HTMLDivElement | null>;
  guidedInputRef: RefObject<HTMLInputElement | null>;
};

export function SettingsGuidedOpeningSection({
  guidedLayerOpen,
  setGuidedLayerOpen,
  guidedPreview,
  setGuidedPreview,
  currentSummary,
  restoreCheck,
  isWorking,
  preview,
  setPreview,
  notice,
  chooseGuidedOpeningImport,
  confirmGuidedOpeningImport,
  confirmImport,
  navigate,
  guidedCardRef,
  guidedInputRef,
}: SettingsGuidedOpeningSectionProps) {
  return (
    <details
      className="micro-decision-layer"
      open={guidedLayerOpen || undefined}
      onToggle={event => setGuidedLayerOpen((event.target as HTMLDetailsElement).open)}
    >
      <summary className="micro-decision-layer-summary">
        <span>
          <b>بيانات البداية والاستعادة</b>
          <small>إدخال أو استبدال محلي حساس؛ راجع الملخص قبل الكتابة.</small>
        </span>
        <strong>افتح البيانات</strong>
      </summary>
      <div
        ref={guidedCardRef}
        className="micro-settings-focused-card"
        data-focused={guidedLayerOpen || undefined}
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
        {notice?.section === "storage" ? (
          <p className="micro-save-note" role="status">
            {notice.text}
          </p>
        ) : null}
        {restoreCheck ? (
          <article className="micro-setting-row" data-status={restoreCheck.overall}>
            <div>
              <strong data-status={restoreCheck.overall}>{restoreCheck.note}</strong>
              <button
                className="micro-text-action"
                type="button"
                onClick={() => navigate(withFrom("/tools/integrity", "/settings"))}
              >
                افتح فحص السلامة
              </button>
            </div>
          </article>
        ) : null}
      </div>
    </details>
  );
}
