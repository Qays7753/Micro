/**
 * المجموعة ٥ (عقد ٣٣ — معاينة المشاركة): شاشة معاينة نص المشاركة — يُعرض
 * النص كاملًا قبل أي شيء، ويُعدَّل يدويًا بحرية، ثم يسافر عبر نظام المشاركة
 * بالنص وحده أو يُنسخ للحافظة. لا إرسال تلقائي، ولا قراءة جهات اتصال، ولا
 * مكتبة ملاحظات دائمة (ميزة مستثناة من البرنامج كله).
 */
import { ArrowLeft, Copy, Send } from "lucide-react";
import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useReturnPath } from "@/app/useReturnNavigation";
import { canShareText, shareTextManually } from "@/lib/textDelivery";
import type { ShareDraft } from "@/application/share/shareMessageService";

export type SharePreviewLocationState = { draft: ShareDraft } | null | undefined;

export default function SharePreview() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const returnPath = useReturnPath();
  const [notice, setNotice] = useState<string | null>(null);
  /* الحالة تصل عبر history state (نفس نمط أوراق العمل) — لا استعلام يكشف المحتوى. */
  const state = (window.history.state ?? null) as SharePreviewLocationState;
  const [body, setBody] = useState(state?.draft?.body ?? "");

  if (!state?.draft) {
    return (
      <section className="micro-page micro-not-found">
        <h1>لا نص للمشاركة</h1>
        <p>افتح هذه الشاشة من سجلٍ فيه ما تشاركه — طلب أو قبضة أو تذكير أو كشف.</p>
        <button className="micro-button micro-button-primary" type="button" onClick={() => navigate(returnPath)}>
          رجوع
        </button>
      </section>
    );
  }

  const draft = state.draft;
  const shareNow = async () => {
    setNotice(null);
    const outcome = await shareTextManually(body);
    setNotice(
      outcome === "shared"
        ? "النص صار عند نظام المشاركة — الإرسال قرارك هناك."
        : outcome === "copied"
          ? "نُسخ النص للحافظة — الصقه حيث شئت."
          : "انسخه يدويًا: ظلّل النص أعلاه وانسخه من لوحة المفاتيح.",
    );
  };

  const copyNow = async () => {
    setNotice(null);
    const outcome = await shareTextManually(` ${body}`);
    setNotice(
      outcome === "copied"
        ? "نُسخ النص للحافظة — الصقه حيث شئت."
        : "انسخه يدويًا: ظلّل النص أعلاه وانسخه من لوحة المفاتيح.",
    );
  };

  return (
    <section className="micro-page micro-share-preview">
      <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>
        <ArrowLeft aria-hidden="true" /> رجوع
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">مشاركة يدوية</span>
        <h1>{draft.title}</h1>
        <p>
          راجع النص وعدّله كما تشاء قبل أن يغادر جهازك — ما يخرج هو هذا النص وحده بعد ما
          تراه أمامك؛ Micro لا يرسل شيئًا تلقائيًا ولا يقرأ جهات اتصالك.
        </p>
      </div>
      <label className="micro-field micro-share-body">
        <span>النص كما سيُشارك</span>
        <textarea
          value={body}
          onChange={event => setBody(event.target.value)}
          rows={Math.min(14, Math.max(6, Math.ceil(body.length / 38)))}
          aria-label="نص المشاركة قابل للتعديل"
        />
      </label>
      <div className="micro-form-actions">
        <button className="micro-button micro-button-primary" type="button" onClick={() => void shareNow()}>
          <Send aria-hidden="true" /> {canShareText() ? "شارك" : "أرسل النص"}
        </button>
        <button className="micro-button micro-button-secondary" type="button" onClick={() => void copyNow()}>
          <Copy aria-hidden="true" /> انسخ النص
        </button>
      </div>
      {notice ? (
        <p className="micro-offline-truth" role="status">
          {notice}
        </p>
      ) : null}
      <p className="micro-offline-truth" role="note">
        النص يعمل بلا إنترنت — توليده ونسخه محليان تمامًا؛ التسليم النهائي قرارك اليدوي.
      </p>
    </section>
  );
}
