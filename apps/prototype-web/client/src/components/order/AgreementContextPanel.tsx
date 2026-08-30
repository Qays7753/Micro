/* §10: «ذاكرة الاتفاق» وحدة مستقلة داخل طبقة «تفاصيل إضافية» — التسمية على الوجه، والشرح خلفها. */
import { useEffect, useState } from "react";
import { CircleAlert, MessageCircle, Save } from "lucide-react";
import type {
  AgreementContextService,
  AgreementSourceValue,
} from "@/application/agreements/agreementContextService";
import type { AgreementSource, StoredCraftOrder } from "@/storage/local/types";
import { LocalDateValue } from "@/components/presentation/DisplayValue";
import { classifyFollowUpDate, localDateInAmman } from "@/application/agreements/followUpDate";

const agreementSourceLabel: Record<string, string> = {
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  referral: "إحالة",
  walk_in: "زيارة مباشرة",
  other: "أخرى",
  conversation: "محادثة (سجل قديم)",
  call: "مكالمة (سجل قديم)",
  in_person: "لقاء مباشر (سجل قديم)",
};
const allowedSources: readonly AgreementSource[] = ["instagram", "whatsapp", "referral", "walk_in", "other"];
const followUpStateLabel: Record<ReturnType<typeof classifyFollowUpDate>, string> = {
  none: "لا يوجد موعد متابعة",
  invalid: "موعد متابعة يحتاج مراجعة",
  overdue: "متابعة متأخرة",
  today: "متابعة مستحقة اليوم",
  upcoming: "متابعة قادمة",
};
const followUpState = (date: string | null) =>
  followUpStateLabel[classifyFollowUpDate(date, localDateInAmman(new Date()))];

type SaveState = { kind: "ok" | "error"; text: string } | null;

export function AgreementContextPanel({
  stored,
  service,
  onSaved,
}: {
  stored: StoredCraftOrder;
  service: AgreementContextService;
  onSaved: (stored: StoredCraftOrder) => void;
}) {
  const legacySource =
    stored.agreementSource && !allowedSources.includes(stored.agreementSource as AgreementSource)
      ? (stored.agreementSource as AgreementSourceValue)
      : null;
  const [source, setSource] = useState<AgreementSource | "">(
    allowedSources.includes(stored.agreementSource as AgreementSource)
      ? (stored.agreementSource as AgreementSource)
      : "",
  );
  const [sourceTouched, setSourceTouched] = useState(false);
  const [summary, setSummary] = useState(stored.followUpSummary ?? "");
  const [date, setDate] = useState(stored.followUpDate ?? "");
  const [reason, setReason] = useState("");
  const [saveState, setSaveState] = useState<SaveState>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSource(
      allowedSources.includes(stored.agreementSource as AgreementSource)
        ? (stored.agreementSource as AgreementSource)
        : "",
    );
    setSourceTouched(false);
    setSummary(stored.followUpSummary ?? "");
    setDate(stored.followUpDate ?? "");
    setReason("");
  }, [stored]);
  async function save() {
    setSaveState(null);
    setSaving(true);
    const nextSource = sourceTouched ? source || null : (legacySource ?? (source || null));
    const result = await service.save(stored.id, {
      agreementSource: nextSource,
      followUpSummary: summary || null,
      followUpDate: date || null,
      followUpReason: reason || null,
    });
    setSaving(false);
    if (!result.ok) {
      setSaveState({ kind: "error", text: result.message });
      return;
    }
    setReason("");
    setSaveState({ kind: "ok", text: "تم حفظ سياق الاتفاق والمتابعة محليًا." });
    onSaved(result.value);
  }

  return (
    <section className="micro-agreement-context" aria-labelledby="agreement-context-title">
      <div className="micro-agreement-context-heading">
        <div>
          <span className="micro-overline">ذاكرة الاتفاق</span>
          <h2 id="agreement-context-title">من أين جاء الاتفاق ومتى أعود؟</h2>
        </div>
        <MessageCircle aria-hidden="true" />
      </div>
      <div className="micro-context-summary">
        <div>
          <span>مصدر الاتفاق</span>
          <strong>
            {legacySource
              ? (agreementSourceLabel[legacySource] ?? "مصدر قديم")
              : stored.agreementSource
                ? (agreementSourceLabel[stored.agreementSource] ?? stored.agreementSource)
                : "غير محدد"}
          </strong>
        </div>
        <div>
          <span>حالة المتابعة</span>
          <strong>{followUpState(stored.followUpDate ?? null)}</strong>
          {stored.followUpDate ? (
            <small>
              <LocalDateValue value={stored.followUpDate} />
            </small>
          ) : null}
        </div>
      </div>
      <div className="micro-form-card">
        <label className="micro-field">
          <span>
            مصدر الاتفاق <small>اختياري</small>
          </span>
          <select
            value={source}
            onChange={event => {
              setSource(event.target.value as AgreementSource | "");
              setSourceTouched(true);
            }}
          >
            <option value="">غير محدد</option>
            <option value="instagram">Instagram</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="referral">إحالة</option>
            <option value="walk_in">زيارة مباشرة</option>
            <option value="other">أخرى</option>
            {legacySource ? (
              <option value={legacySource} disabled>
                {agreementSourceLabel[legacySource] ?? "مصدر قديم محفوظ"}
              </option>
            ) : null}
          </select>
        </label>
        {legacySource ? (
          <p className="micro-context-legacy">
            <CircleAlert aria-hidden="true" /> مصدر قديم محفوظ؛ اختر بديلًا أو «غير محدد».
          </p>
        ) : null}
        <label className="micro-field">
          <span>
            ملخص المتابعة <small>اختياري، يكتبه المالك</small>
          </span>
          <textarea
            value={summary}
            onChange={event => setSummary(event.target.value)}
            maxLength={240}
            placeholder="مثال: تأكيد اللون والمقاس مع العميل"
          />
        </label>
        <label className="micro-field">
          <span>
            موعد المتابعة <small>اختياري</small>
          </span>
          <input type="date" value={date} onChange={event => setDate(event.target.value)} />
        </label>
        <label className="micro-field">
          <span>
            هدف أو سبب المتابعة{" "}
            <small>{stored.followUpDate ? "مطلوب عند تغيير التاريخ" : "مطلوب مع موعد المتابعة"}</small>
          </span>
          <input
            type="text"
            value={reason}
            onChange={event => setReason(event.target.value)}
            maxLength={160}
            placeholder="مثال: تأكيد موعد التسليم"
          />
        </label>
        {saveState ? (
          <p className={saveState.kind === "ok" ? "micro-save-note" : "micro-field-error"} role="status">
            {saveState.text}
          </p>
        ) : null}
        <button
          className="micro-button micro-button-primary micro-save-cost"
          type="button"
          disabled={saving}
          onClick={save}
        >
          <Save aria-hidden="true" />
          {saving ? "جارٍ حفظ السياق…" : "حفظ سياق الاتفاق"}
        </button>
      </div>
      {(stored.followUpEvents ?? []).length > 0 ? (
        <div className="micro-context-history">
          <span className="micro-overline">تاريخ المتابعة</span>
          {(stored.followUpEvents ?? []).map(event => (
            <p key={event.id}>
              <b>{event.previousDate ? "تغيير موعد المتابعة" : "إضافة موعد متابعة"}</b>
              <small>
                <LocalDateValue value={event.previousDate} /> ← <LocalDateValue value={event.followUpDate} />{" "}
                · {event.reason}
              </small>
            </p>
          ))}
        </div>
      ) : null}
    </section>
  );
}
