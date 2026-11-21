/**
 * Post-Group 6 continuous completion (WS-251/DOC-041 — owner order
 * 7593b9c4 §4 G01 + owner supplement §10.1-1 2026-11-22): قسم «الأدوار»
 * داخل ملف الحساب — مداخل إضافة الأدوار من «حسابي» في أي وقت (Q5)
 * بما فيها إعادة التقديم بعد إزالة دور (طلب جديد كامل؛ السوابق مؤرشفة
 * ولا يُستعاد شيء تلقائيًا)، وإلغاء المسودة فوريًا، وإزالة الدور المفعّل
 * بطلبه مع الحمايات المقررة: السائق عنده حجز جارٍ لا يُزال، وإعلانات
 * المورد تُخفى وتُؤرشف (لا حذف أبدًا)، وسجلات الطرف الآخر تبقى باسم
 * «مستخدم سابق». دور صاحب المشروع: التصدير أولًا ثم حذف بيانات المشروع
 * (حدوده معرفة في الملحق §10.1-3 — تدخل مع موجة الحساب لاحقًا في هذا
 * التسليم نفسه).
 */
import { UsersRound } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import {
  ApiError,
  cancelDriverDraft,
  cancelSupplierDraft,
  removeDriverRole,
  removeSupplierRole,
} from "@/application/network";
import { Button } from "@/components/primitives";

export interface RolesSectionProps {
  vendorStatus: string | null;
  driverStatus: string | null;
  hasProject: boolean;
  onChanged: () => void;
}

const SUPPLIER_STATUS_LABELS: Record<string, string> = {
  draft: "مسودة — لم تكتمل بعد",
  active: "مفعّل",
  submitted: "قيد المراجعة",
  changes_requested: "طلبت مراجعة تعديلات",
  rejected: "مرفوض",
  suspended: "موقوف بقرار إشرافي",
  removed: "مُزال بطلبك",
};

const DRIVER_STATUS_LABELS: Record<string, string> = {
  draft: "مسودة — لم تُقدَّم للمراجعة",
  submitted: "قيد المراجعة",
  under_review: "قيد المراجعة",
  approved: "معتمد",
  changes_requested: "طلبت مراجعة تعديلات",
  rejected: "مرفوض",
  suspended_new: "موقوف عن الجديد",
  removed: "مُزال بطلبك",
};

function supplierStatusLabel(status: string): string {
  return SUPPLIER_STATUS_LABELS[status] ?? status;
}

function driverStatusLabel(status: string): string {
  return DRIVER_STATUS_LABELS[status] ?? status;
}

export function RolesSection({ vendorStatus, driverStatus, hasProject, onChanged }: RolesSectionProps) {
  const [, navigate] = useLocation();
  const [confirming, setConfirming] = useState<
    "supplier-draft" | "driver-draft" | "supplier-remove" | "driver-remove" | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>, done: string): Promise<void> {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      setBusy(false);
      setConfirming(null);
      setNotice(done);
      onChanged();
    } catch (cause) {
      setBusy(false);
      /* الرفض الصادق (409) يُعرض بسبب الخادم نفسه — مثل حماية الحجز الجارئ. */
      setError(
        cause instanceof ApiError ? cause.message : "تعذر تنفيذ الطلب الآن — بياناتك سليمة. أعد المحاولة.",
      );
    }
  }

  const supplierDraft = vendorStatus === "draft";
  const supplierActive = vendorStatus === "active";
  const supplierRemoved = vendorStatus === "removed";
  const driverDraft = driverStatus === "draft";
  const driverApproved = driverStatus === "approved";
  const driverRemoved = driverStatus === "removed";
  const noRoles = vendorStatus === null && driverStatus === null && !hasProject;

  return (
    <section className="micro-profile-roles" aria-labelledby="roles-title" data-testid="account-roles">
      <div className="micro-section-title">
        <UsersRound aria-hidden="true" />
        <div>
          <h2 id="roles-title">أدوارك</h2>
        </div>
      </div>
      <p className="micro-roles-note">
        كل دور وضع مستقل — أضفه من هنا أو من سطحه في أي وقت. الإزالة بطلبك ولا تحذف سجلاتك أبدًا؛ وإعادة دور
        أُزال تعني طلبًا جديدًا يبدأ من البداية (سوابقك تبقى مؤرشفة ولا يُستعاد شيء تلقائيًا).
      </p>
      {noRoles ? <p role="status">لا أدوار بعد على حسابك — أضف الدور الذي تحتاجه من هنا.</p> : null}
      {/* Q5 + الملحق §10.1-1: مداخل الإضافة من «حسابي» — لكل حساب بلا الدور
       * مدخل واحد صريح، وللدور المُزال مدخل إعادة تقديم بنسخة صادقة. */}
      <div className="micro-roles-add" data-testid="roles-add-entry-points">
        {!hasProject ? (
          <Button action="create" onClick={() => navigate("/setup")}>
            أنشئ مشروعك (دور صاحب المشروع)
          </Button>
        ) : null}
        {vendorStatus === null ? (
          <Button action="create" onClick={() => navigate("/market/vendor")}>
            أضف دور المورد
          </Button>
        ) : null}
        {driverStatus === null ? (
          <Button action="create" onClick={() => navigate("/driver")}>
            أضف دور السائق
          </Button>
        ) : null}
      </div>
      {!noRoles ? (
        <dl className="micro-profile-facts">
          {hasProject ? (
            <div>
              <dt>صاحب المشروع</dt>
              <dd>
                مفعّل — مشروع واحد
                {/* الإزالة هنا تصدير أولًا ثم حذف بيانات المشروع، وحدود الحذف
                 * غير معرّفة بعد؛ لا زر حذف بيانات مالية من هذا الإصدار. */}
                <small className="micro-role-note">
                  الإزالة تحتاج تعريف حدود حذف بيانات المشروع — خطوة عند المالك
                </small>
              </dd>
            </div>
          ) : null}
          {vendorStatus !== null ? (
            <div>
              <dt>المورد</dt>
              <dd>
                {supplierStatusLabel(vendorStatus)}
                {supplierDraft ? (
                  <Button
                    action="secondary"
                    disabled={busy}
                    onClick={() => setConfirming(confirming === "supplier-draft" ? null : "supplier-draft")}
                  >
                    إلغاء مسودة المورد
                  </Button>
                ) : null}
                {supplierActive ? (
                  <Button
                    action="secondary"
                    disabled={busy}
                    onClick={() => setConfirming(confirming === "supplier-remove" ? null : "supplier-remove")}
                  >
                    إزالة دور المورد
                  </Button>
                ) : null}
                {supplierRemoved ? (
                  <small className="micro-role-note">
                    إعلاناتك السابقة مخفية ومؤرشفة محفوظة — إعادة الدور طلب جديد يبدأ من البداية ولا تستعيد
                    الإعلانات المؤرشفة.
                    <Button action="secondary" onClick={() => navigate("/market/vendor")}>
                      قدّم طلب مورد جديد
                    </Button>
                  </small>
                ) : null}
              </dd>
            </div>
          ) : null}
          {driverStatus !== null ? (
            <div>
              <dt>السائق</dt>
              <dd>
                {driverStatusLabel(driverStatus)}
                {driverDraft ? (
                  <Button
                    action="secondary"
                    disabled={busy}
                    onClick={() => setConfirming(confirming === "driver-draft" ? null : "driver-draft")}
                  >
                    إلغاء مسودة السائق
                  </Button>
                ) : null}
                {driverApproved ? (
                  <Button
                    action="secondary"
                    disabled={busy}
                    onClick={() => setConfirming(confirming === "driver-remove" ? null : "driver-remove")}
                  >
                    إزالة دور السائق
                  </Button>
                ) : null}
                {driverRemoved ? (
                  <small className="micro-role-note">
                    صفحتك العامة السابقة مخفية وسجلاتك محفوظة — إعادة الدور طلب جديد يخضع لاعتماد المشرف من
                    البداية ولا تستعيد سجلات الطلب السابق.
                    <Button action="secondary" onClick={() => navigate("/driver")}>
                      قدّم طلب سائق جديد
                    </Button>
                  </small>
                ) : null}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      {confirming === "supplier-draft" ? (
        <div className="micro-confirm-box" role="alertdialog" aria-label="تأكيد إلغاء مسودة المورد">
          <p>إلغاء مسودة المورد فوري — تُحذف بيانات المسودة فقط (لم تُنشر يومًا).</p>
          <div className="micro-form-actions">
            <Button action="quiet" disabled={busy} onClick={() => setConfirming(null)}>
              تراجع
            </Button>
            <Button
              action="commit"
              disabled={busy}
              onClick={() => void run(cancelSupplierDraft, "أُلغيت مسودة المورد.")}
            >
              {busy ? "جارٍ الإلغاء…" : "ألغِ المسودة"}
            </Button>
          </div>
        </div>
      ) : null}
      {confirming === "driver-draft" ? (
        <div className="micro-confirm-box" role="alertdialog" aria-label="تأكيد إلغاء مسودة السائق">
          <p>إلغاء مسودة السائق فوري — تُحذف بيانات المسودة ووثائقها (لم تُعتمد يومًا).</p>
          <div className="micro-form-actions">
            <Button action="quiet" disabled={busy} onClick={() => setConfirming(null)}>
              تراجع
            </Button>
            <Button
              action="commit"
              disabled={busy}
              onClick={() => void run(cancelDriverDraft, "أُلغيت مسودة السائق.")}
            >
              {busy ? "جارٍ الإلغاء…" : "ألغِ المسودة"}
            </Button>
          </div>
        </div>
      ) : null}
      {confirming === "supplier-remove" ? (
        <div className="micro-confirm-box" role="alertdialog" aria-label="تأكيد إزالة دور المورد">
          <p>
            إزالة دور المورد تخفي إعلاناتك فورًا وتؤرشفها — لا يُحذف أي سجل. سجلات الطرف الآخر تبقى باسم
            «مستخدم سابق». إعادة الدور بعد الإزالة خطوة لاحقة عند المالك.
          </p>
          <div className="micro-form-actions">
            <Button action="quiet" disabled={busy} onClick={() => setConfirming(null)}>
              تراجع
            </Button>
            <Button
              action="commit"
              disabled={busy}
              onClick={() => void run(removeSupplierRole, "أُزيل دور المورد — إعلاناتك مخفية ومؤرشفة.")}
            >
              {busy ? "جارٍ الإزالة…" : "أزل الدور"}
            </Button>
          </div>
        </div>
      ) : null}
      {confirming === "driver-remove" ? (
        <div className="micro-confirm-box" role="alertdialog" aria-label="تأكيد إزالة دور السائق">
          <p>
            إزالة دور السائق تخفي صفحتك العامة وتبقي سجلاتك محفوظة. إن كان لديك حجز جارٍ فسيُرفض الطلب حتى
            يكتمل الحجز.
          </p>
          <div className="micro-form-actions">
            <Button action="quiet" disabled={busy} onClick={() => setConfirming(null)}>
              تراجع
            </Button>
            <Button
              action="commit"
              disabled={busy}
              onClick={() => void run(removeDriverRole, "أُزيل دور السائق — سجلاتك محفوظة.")}
            >
              {busy ? "جارٍ الإزالة…" : "أزل الدور"}
            </Button>
          </div>
        </div>
      ) : null}
      {notice ? (
        <p className="micro-save-note" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="micro-field-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
