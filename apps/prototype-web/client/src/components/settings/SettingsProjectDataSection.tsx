/**
 * S03 (UNIT-039 P3.1/P3.2 — عقد §17 «نافذتان تعدلان المصدر»): قسم «بيانات
 * المشروع» داخل الإعدادات — البيت القائم للمحرر بعد قرار دمج 038/039: تعديل
 * اسم الهوية القائمة من هنا حصرًا بحفظ/إلغاء واضحين وتعارض معلن عند التحديث
 * المتزامن. الصفحة تبقى الموزّع (تملك الحالة والمعالجات) وتمرر كل شيء خصائص.
 *
 * حدود صريحة:
 * - التعديل كتابة محروسة واحدة عبر ProfileService.rename (CAS على updatedAt
 *   المتوقع من قراءة المحرر) — لا نداء save غير محروس ولا إعادة تأسيس ولا
 *   مشروع ثانٍ أبدًا.
 * - التعارض حالة صادقة مستقلة عن فشل التخزين: تُعرض الحالة الحالية كما هي
 *   ويُحدّث أساس النسخة إليها، والقرار (إعادة الحفظ بوعي أو الإلغاء) بيد
 *   المالك — لا lost update ولا سحق للاسم الأحدث.
 * - الاسم وحده يتغير: المعرّف وcreatedAt وكل المراجع المالية والتاريخية
 *   كما هي؛ لا كشف بيانات مالك ولا حق مالي من الاسم.
 */
import { Landmark, Save } from "lucide-react";
import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { ActivityProfile } from "@/storage/local/types";

import { Button, EmptyState } from "@/components/primitives";

/* S03: حالة القسم المستقلة — تحميل/غياب/تعذر/جاهز (UNIT-039 P3.1: «حالة
 * تحميل/غياب/تعذر مستقلة، لا كاش أو حق مالك من الاسم»). */
export type ProjectDataState =
  | { phase: "loading" }
  | { phase: "absent" }
  | { phase: "error"; message: string }
  | { phase: "ready"; profile: ActivityProfile };

export type SettingsProjectDataSectionProps = {
  projectData: ProjectDataState;
  isEditingName: boolean;
  editingName: string;
  setEditingName: Dispatch<SetStateAction<string>>;
  nameError: boolean;
  clearNameError: () => void;
  renameConflict: { message: string; currentName: string | null } | null;
  renameFailed: boolean;
  isRenaming: boolean;
  beginRename: () => void;
  saveRename: () => Promise<void>;
  cancelRename: () => void;
  openSetup: () => void;
  nameInputRef: React.RefObject<HTMLInputElement | null>;
};

const shortProfileId = (id: string) => (id.length > 14 ? `${id.slice(0, 14)}…` : id);

export function SettingsProjectDataSection({
  projectData,
  isEditingName,
  editingName,
  setEditingName,
  nameError,
  clearNameError,
  renameConflict,
  renameFailed,
  isRenaming,
  beginRename,
  saveRename,
  cancelRename,
  openSetup,
  nameInputRef,
}: SettingsProjectDataSectionProps) {
  /* S03-R3-F04: زر «عدّل اسم المشروع» يُستبدل بأزرار المحرر عند الفتح فيُفقد
   * التركيز إلى body — عند الإغلاق (إلغاء/حفظ ناجح) يعود التركيز إلى زر
   * التعديل نفسه؛ الفتح يستقر في الحقل عبر autoFocus كسابقة المحررات
   * الداخلية (OwnerEntitlement/FinancialEventRow). */
  const beginButtonRef = useRef<HTMLButtonElement>(null);
  const wasEditingNameRef = useRef(false);
  useEffect(() => {
    if (wasEditingNameRef.current && !isEditingName) beginButtonRef.current?.focus();
    wasEditingNameRef.current = isEditingName;
  }, [isEditingName]);
  return (
    <details className="micro-decision-layer" open>
      <summary className="micro-decision-layer-summary">
        <span>
          <b>بيانات المشروع</b>
          <small>اسم مشروعك وهويته الثابتة — تعديل الاسم لا يمس السجلات ولا الأرقام.</small>
        </span>
        <strong>افتح القسم</strong>
      </summary>
      <section className="micro-form-card" aria-labelledby="project-data-title">
        <div className="micro-section-heading">
          <div>
            <span className="micro-overline">هوية محلية واحدة</span>
            <h2 id="project-data-title">اسم المشروع</h2>
          </div>
          <Landmark aria-hidden="true" />
        </div>
        {projectData.phase === "loading" ? (
          <p className="micro-route-loading" role="status">
            جارٍ قراءة بيانات مشروعك…
          </p>
        ) : null}
        {projectData.phase === "error" ? (
          <div className="micro-storage-error" role="alert">
            <strong>تعذر قراءة ملف المشروع المحلي</strong>
            <p>{projectData.message}</p>
          </div>
        ) : null}
        {projectData.phase === "absent" ? (
          /* S03-R3-F01: الغياب حالة مستقلة صادقة لا فشل — عقد الفراغ الكنوني
           * (EmptyState: رمز هادئ + عنوان موجّه + فعل واحد)، لا قالب خطأ
           * التخزين الأحمر المحجوز لتعذّر القراءة وحده. */
          <EmptyState
            role="status"
            data-testid="settings-project-absent"
            symbol={<Landmark aria-hidden="true" />}
            title="لا يوجد ملف مشروع على هذا الجهاز بعد"
            description="الإعداد ينشئ الهوية مرة واحدة — لا مشروع ثانٍ من هنا."
            action={
              <Button action="save" onClick={openSetup}>
                افتح إعداد المشروع
              </Button>
            }
          />
        ) : null}
        {projectData.phase === "ready" ? (
          <>
            {!isEditingName ? (
              <dl className="micro-profile-facts">
                <div>
                  <dt>اسم المشروع</dt>
                  <dd>{projectData.profile.activityName}</dd>
                </div>
                <div>
                  <dt>معرّف المشروع المحلي</dt>
                  <dd dir="ltr" title={projectData.profile.id}>
                    {shortProfileId(projectData.profile.id)}
                  </dd>
                </div>
                <div>
                  <dt>ثبات الهوية</dt>
                  <dd>المعرّف لا يتغير مع تعديل الاسم — السجلات والمراجع كما هي.</dd>
                </div>
              </dl>
            ) : (
              <>
                <label className="micro-field" htmlFor="project-name-input">
                  <span>اسم المشروع</span>
                  <input
                    id="project-name-input"
                    data-testid="project-name-input"
                    ref={nameInputRef}
                    autoFocus
                    value={editingName}
                    onChange={event => {
                      setEditingName(event.target.value);
                      if (nameError && event.target.value.trim() !== "") clearNameError();
                    }}
                    aria-invalid={nameError}
                    aria-describedby={nameError ? "project-name-error" : "project-name-help"}
                  />
                  <small id="project-name-help">
                    الاسم الذي يظهر في «مشروعي الآن» وفي السجلات؛ هوية مشروعك ومراجعه لا تتغير.
                  </small>
                </label>
                {nameError ? (
                  <p id="project-name-error" className="micro-field-error" role="alert">
                    اسم المشروع: اكتب اسم مشروعك، أو ألغِ التعديل.
                  </p>
                ) : null}
              </>
            )}
            {/* S03 (عقد §17): التعارض الصادق — الحالة الحالية معروضة كما هي
                وأساس النسخة تحدّث إليها؛ لا سحق صامت للاسم الأحدث. */}
            {renameConflict ? (
              <p className="micro-field-error" role="alert" data-testid="rename-conflict-note">
                {renameConflict.message}
                {renameConflict.currentName !== null
                  ? ` الاسم المحفوظ الآن: «${renameConflict.currentName}».`
                  : ""}
              </p>
            ) : null}
            {renameFailed ? (
              <p className="micro-field-error" role="alert" data-testid="rename-failed-note">
                لم يتم حفظ اسم المشروع على هذا الجهاز. تحقق من مساحة التخزين ثم أعد المحاولة.
              </p>
            ) : null}
            <div className="micro-form-actions">
              {isEditingName ? (
                <>
                  <Button action="secondary" disabled={isRenaming} onClick={cancelRename}>
                    إلغاء التعديل
                  </Button>
                  <Button action="save" disabled={isRenaming} onClick={() => void saveRename()}>
                    <Save aria-hidden="true" />
                    {isRenaming ? "جارٍ الحفظ…" : "احفظ الاسم"}
                  </Button>
                </>
              ) : (
                <Button action="secondary" onClick={beginRename} ref={beginButtonRef}>
                  عدّل اسم المشروع
                </Button>
              )}
            </div>
          </>
        ) : null}
      </section>
    </details>
  );
}
