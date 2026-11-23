/**
 * Post-Group 6 W1 (قرار المالك النهائي أ-3/أ-4 2026-11-21 / EX-D24 — G01):
 * بطاقة إنشاء المشروع الواحد الصريح — التسجيل لا ينشئ دورًا ولا مشروعًا،
 * والمشروع يُنشأ بضغطة واحدة لكل حساب (مشروع واحد لكل حساب، صاحب واحد
 * لكل مشروع، لا دعوات ولا فريق). تُستخدم من أسطح الحساب/المورد/الحجز
 * حيث يلزم مشروع قبل أول فعل عمل. لا كتابة محلية إطلاقًا.
 */
import { useState } from "react";
import { ApiError, createWorkspace } from "@/application/network";
import { Button } from "@/components/primitives";

export function CreateProjectCard({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(): Promise<void> {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 80) {
      setError("اكتب اسم مشروع من حرفين إلى 80 حرفًا.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createWorkspace(trimmed);
      setBusy(false);
      onCreated();
    } catch (cause) {
      setBusy(false);
      if (cause instanceof ApiError) {
        // 409 = للحساب مشروع فعلًا — رسالة صادقة لا خطأ تقني.
        setError(
          cause.code === "one_project_per_account"
            ? "لحسابك مشروع واحد بالفعل — لا يمكن إنشاء مشروع ثانٍ."
            : cause.message,
        );
      } else {
        setError("تعذر إنشاء المشروع الآن — أعد المحاولة.");
      }
    }
  }

  return (
    <div className="micro-create-project" data-testid="create-project-card">
      <p>
        <b>مشروعك غير منشأ بعد.</b> أنشئ مشروعك الواحد بضغطة صريحة — لا يُنشأ شيء تلقائيًا، ولكل حساب مشروع
        واحد بصاحب واحد.
      </p>
      <label className="micro-field">
        <span>اسم المشروع</span>
        <input
          value={name}
          onChange={event => setName(event.target.value)}
          placeholder="مثال: ورشة ليان للنجارة"
          maxLength={80}
        />
      </label>
      {error ? (
        <p className="micro-field-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="micro-form-actions">
        <Button action="save" disabled={busy} onClick={() => void create()}>
          {busy ? "جارٍ الإنشاء…" : "أنشئ مشروعي"}
        </Button>
      </div>
    </div>
  );
}
