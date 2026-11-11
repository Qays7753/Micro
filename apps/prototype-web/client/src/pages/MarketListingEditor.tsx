/**
 * محرر إعلان المورد (مواصفة السوق §5): واجهة واحدة بأربع خطوات منطقية —
 * المادة، البيع والتسعير، التوفر والاستلام، ثم الإرسال للمراجعة. المسودة
 * تقبل النقص، والقيم الرقمية نصوص صحيحة بمقاييس العقد 25 (×1,000,000
 * للسعر و×1,000 للكمية)، والصور خاصة حتى القبول.
 */
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight } from "lucide-react";
import { useReturnPath } from "@/app/useReturnNavigation";
import { useNetworkSession } from "@/app/useNetworkSession";
import {
  attachListingMedia,
  createListingDraft,
  fetchMarketMeta,
  submitListing,
  uploadListingImage,
  type MarketMeta,
} from "@/application/market";
import { Button, Field, Notice } from "@/components/primitives";

function jodToMicro(jodText: string): string | undefined {
  if (!/^\d{1,7}(\.\d{1,6})?$/.test(jodText.trim())) return undefined;
  const [whole, fraction = ""] = jodText.trim().split(".");
  return `${whole}${fraction.padEnd(6, "0")}`;
}

export default function MarketListingEditor() {
  const [match] = useLocation();
  const [, navigate] = useLocation();
  const returnPath = useReturnPath();
  const { session, signIn } = useNetworkSession();
  const listingId =
    /\/market\/vendor\/[^/]+/.test(match) && !match.endsWith("/new")
      ? match.replace("/market/vendor/", "")
      : null;
  const [meta, setMeta] = useState<MarketMeta | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "",
    category: "",
    governorate: "",
    description: "",
    contactType: "phone",
    contactValue: "",
    priceMode: "fixed",
    priceJod: "",
    basisUnits: "1",
    quantityUnit: "حبة",
    minQuantity: "1",
    stepQuantity: "1",
  });
  const [mediaIds, setMediaIds] = useState<string[]>([]);

  useEffect(() => {
    void fetchMarketMeta()
      .then(setMeta)
      .catch(() => setMeta(null));
  }, []);

  const update = useCallback((patch: Partial<typeof form>) => {
    setForm(current => ({ ...current, ...patch }));
  }, []);

  if (!session.authenticated) {
    return (
      <section className="micro-page">
        <div className="micro-page-heading">
          <h1>إضافة إعلان</h1>
        </div>
        <Notice tone="neutral">
          تجهيز إعلان يحتاج تسجيل الدخول بهوية Micro.
          <Button action="quiet" onClick={() => signIn("/market/vendor/new")}>
            الدخول عبر Google
          </Button>
        </Notice>
      </section>
    );
  }

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const priceMicro = form.priceMode === "fixed" ? jodToMicro(form.priceJod) : undefined;
      if (form.priceMode === "fixed" && priceMicro === undefined) {
        setMessage("أدخل سعرًا صحيحًا بالدينار (حتى 6 منازل عشرية).");
        return;
      }
      const draft = await createListingDraft({
        title: form.title,
        category: form.category,
        governorate: form.governorate,
        description: form.description,
        contactType: form.contactType as "phone" | "whatsapp",
        contactValue: form.contactValue,
        pricing:
          form.priceMode === "fixed"
            ? {
                mode: "fixed",
                priceMicroJod: priceMicro,
                basis: { units: form.basisUnits, unit: form.quantityUnit },
              }
            : { mode: "quote_required", quoteReason: "يحتاج تحديدًا تقنيًا قبل التسعير" },
        quantity: {
          unit: form.quantityUnit,
          minQuantityMilli: `${Number(form.minQuantity) * 1000}`,
          stepMilli: `${Number(form.stepQuantity) * 1000}`,
          unpacked: true,
        },
      });
      for (const mediaId of mediaIds) {
        await attachListingMedia(draft.listing.id, mediaId);
      }
      await submitListing(draft.listing.id);
      setMessage("أُرسل الإعلان للمراجعة — إرسالك ليس نشرًا.");
      navigate("/market/vendor");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر إرسال الإعلان — راجع الحقول وأعد المحاولة.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="micro-page micro-listing-editor" data-testid="market-listing-editor">
      <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>
        <ArrowRight aria-hidden="true" /> مساحة المورد
      </button>
      <div className="micro-page-heading">
        <h1>{listingId === null ? "إعلان جديد" : "تعديل إعلان"}</h1>
        <p>المسودة تقبل النقص؛ الإرسال للمراجعة يطلب اكتمال الحقول المناسبة.</p>
      </div>
      {message ? <Notice tone="neutral">{message}</Notice> : null}

      <Field label="عنوان المادة (8 أحرف فأكثر)">
        <input value={form.title} onChange={event => update({ title: event.target.value })} />
      </Field>
      <div className="micro-editor-grid">
        <Field label="التصنيف">
          <select value={form.category} onChange={event => update({ category: event.target.value })}>
            <option value="">اختر التصنيف</option>
            {(meta?.categories ?? []).map(entry => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="المحافظة">
          <select value={form.governorate} onChange={event => update({ governorate: event.target.value })}>
            <option value="">اختر المحافظة</option>
            {(meta?.governorates ?? []).map(entry => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="الوصف (20 حرفًا فأكثر)">
        <textarea
          value={form.description}
          onChange={event => update({ description: event.target.value })}
          rows={4}
        />
      </Field>
      <div className="micro-editor-grid">
        <Field label="طريقة التواصل">
          <select value={form.contactType} onChange={event => update({ contactType: event.target.value })}>
            <option value="phone">هاتف</option>
            <option value="whatsapp">واتساب</option>
          </select>
        </Field>
        <Field label="رقم التواصل">
          <input
            value={form.contactValue}
            onChange={event => update({ contactValue: event.target.value })}
            inputMode="tel"
          />
        </Field>
      </div>

      <h2>البيع والتسعير</h2>
      <Field label="طريقة التسعير">
        <select value={form.priceMode} onChange={event => update({ priceMode: event.target.value })}>
          <option value="fixed">سعر ثابت</option>
          <option value="quote_required">يحتاج تسعيرًا</option>
        </select>
      </Field>
      {form.priceMode === "fixed" ? (
        <div className="micro-editor-grid">
          <Field label="السعر (د.أ)">
            <input
              value={form.priceJod}
              onChange={event => update({ priceJod: event.target.value })}
              inputMode="decimal"
            />
          </Field>
          <Field label="السعر يشمل كم وحدة">
            <input
              value={form.basisUnits}
              onChange={event => update({ basisUnits: event.target.value })}
              inputMode="numeric"
            />
          </Field>
        </div>
      ) : null}
      <div className="micro-editor-grid">
        <Field label="وحدة الكمية">
          <input value={form.quantityUnit} onChange={event => update({ quantityUnit: event.target.value })} />
        </Field>
        <Field label="الحد الأدنى للكمية">
          <input
            value={form.minQuantity}
            onChange={event => update({ minQuantity: event.target.value })}
            inputMode="decimal"
          />
        </Field>
        <Field label="مضاعف الكمية">
          <input
            value={form.stepQuantity}
            onChange={event => update({ stepQuantity: event.target.value })}
            inputMode="decimal"
          />
        </Field>
      </div>

      <h2>الصور (خاصة حتى القبول)</h2>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={async event => {
          const files = [...(event.target.files ?? [])];
          const uploaded: string[] = [];
          for (const file of files.slice(0, 6)) {
            const result = await uploadListingImage(file);
            uploaded.push(result.media.id);
          }
          setMediaIds(current => [...current, ...uploaded].slice(0, 6));
        }}
      />
      <p className="micro-editor-hint">{mediaIds.length} صورة مرفوعة — تبقى خاصة حتى اكتمال القبول.</p>

      <div className="micro-form-actions">
        <Button action="save" loading={busy} onClick={() => void submit()}>
          إرسال للمراجعة
        </Button>
      </div>
    </section>
  );
}
