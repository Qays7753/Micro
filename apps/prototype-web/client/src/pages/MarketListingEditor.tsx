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
  fetchVendorListingDraft,
  submitListing,
  updateListingDraft,
  uploadListingImage,
  type MarketMeta,
} from "@/application/market";
import { Button, Field, Notice } from "@/components/primitives";
import { useUnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import { useFormDirty } from "@/components/forms/useFormDirty";
import { normalizeAsciiDigits } from "@/application/input";

function jodToMicro(jodText: string): string | undefined {
  const text = normalizeAsciiDigits(jodText.trim());
  if (!/^\d{1,7}(\.\d{1,6})?$/.test(text)) return undefined;
  const [whole, fraction = ""] = text.split(".");
  return `${whole}${fraction.padEnd(6, "0")}`;
}

/** Quantity ×1,000 as exact string scaling (contract 25 §3-ب — no floats). */
function quantityToMilli(quantityText: string): string | undefined {
  const text = normalizeAsciiDigits(quantityText.trim());
  if (!/^\d{1,6}(\.\d{1,3})?$/.test(text)) return undefined;
  const [whole, fraction = ""] = text.split(".");
  return `${whole}${fraction.padEnd(3, "0")}`;
}

function microToJodText(micro: string | undefined): string {
  if (micro === undefined || micro === "") return "";
  const value = BigInt(micro);
  const whole = value / 1_000_000n;
  const fraction = (value % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return fraction === "" ? whole.toString() : `${whole}.${fraction}`;
}

function milliToQuantityText(milli: string | undefined): string {
  if (milli === undefined || milli === "") return "";
  const value = BigInt(milli);
  const whole = value / 1000n;
  const fraction = (value % 1000n).toString().padStart(3, "0").replace(/0+$/, "");
  return fraction === "" ? whole.toString() : `${whole}.${fraction}`;
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
  const [message, setMessage] = useState<{ tone: "neutral" | "error" | "success"; text: string } | null>(
    null,
  );
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

  useEffect(() => {
    // EDIT MODE: load the existing draft's work copy — the form opens
    // prefilled and saves update the same listing (never a duplicate).
    if (listingId === null) return;
    let cancelled = false;
    void fetchVendorListingDraft(listingId)
      .then(({ listing }) => {
        if (cancelled) return;
        setForm(current => ({
          ...current,
          title: listing.title || current.title,
          category: listing.category || current.category,
          governorate: listing.governorate || current.governorate,
          description: listing.description || current.description,
          contactType: listing.contact?.type === "whatsapp" ? "whatsapp" : "phone",
          contactValue: listing.contact?.value ?? current.contactValue,
          priceMode: listing.pricing?.mode === "quote_required" ? "quote_required" : "fixed",
          priceJod: microToJodText(listing.pricing?.priceMicroJod),
          basisUnits: listing.pricing?.basis?.units ?? current.basisUnits,
          quantityUnit: listing.quantity?.unit ?? current.quantityUnit,
          minQuantity: milliToQuantityText(listing.quantity?.minQuantityMilli),
          stepQuantity: milliToQuantityText(listing.quantity?.stepMilli),
        }));
        setMediaIds(listing.mediaIds);
      })
      .catch(() => {
        if (!cancelled) {
          setMessage({ tone: "error", text: "تعذر تحميل الإعلان — أعد المحاولة من مساحة المورد." });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [listingId]);

  const update = useCallback((patch: Partial<typeof form>) => {
    setForm(current => ({ ...current, ...patch }));
  }, []);

  const isDirty = useFormDirty([
    form.title,
    form.category,
    form.governorate,
    form.description,
    form.contactType,
    form.contactValue,
    form.priceMode,
    form.priceJod,
    form.basisUnits,
    form.quantityUnit,
    form.minQuantity,
    form.stepQuantity,
    mediaIds.length,
  ]);
  const requestNavigation = useUnsavedChangesGuard({ isDirty, onSave: () => submit() });

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

  const submit = async (): Promise<boolean> => {
    setBusy(true);
    setMessage(null);
    try {
      const priceMicro = form.priceMode === "fixed" ? jodToMicro(form.priceJod) : undefined;
      if (form.priceMode === "fixed" && priceMicro === undefined) {
        setMessage({ tone: "error", text: "أدخل سعرًا صحيحًا بالدينار (حتى 6 منازل عشرية)." });
        return false;
      }
      const minMilli = quantityToMilli(form.minQuantity);
      if (minMilli === undefined) {
        setMessage({ tone: "error", text: "أدخل حدًا أدنى صحيحًا للكمية (حتى 3 منازل عشرية)." });
        return false;
      }
      const stepMilli = quantityToMilli(form.stepQuantity);
      if (stepMilli === undefined) {
        setMessage({ tone: "error", text: "أدخل مضاعفًا صحيحًا للكمية (حتى 3 منازل عشرية)." });
        return false;
      }
      const input = {
        title: form.title,
        category: form.category,
        governorate: form.governorate,
        description: form.description,
        contactType: form.contactType as "phone" | "whatsapp",
        contactValue: normalizeAsciiDigits(form.contactValue.trim()),
        pricing:
          form.priceMode === "fixed"
            ? {
                mode: "fixed" as const,
                priceMicroJod: priceMicro,
                basis: { units: normalizeAsciiDigits(form.basisUnits.trim()), unit: form.quantityUnit },
              }
            : ({ mode: "quote_required" as const, quoteReason: "يحتاج تحديدًا تقنيًا قبل التسعير" } as const),
        quantity: {
          unit: form.quantityUnit,
          minQuantityMilli: minMilli,
          stepMilli,
          unpacked: true,
        },
      };
      let targetId = listingId;
      if (targetId === null) {
        const draft = await createListingDraft(input);
        targetId = draft.listing.id;
      } else {
        await updateListingDraft(targetId, input);
      }
      for (const mediaId of mediaIds) {
        await attachListingMedia(targetId, mediaId);
      }
      await submitListing(targetId);
      setMessage({ tone: "success", text: "أُرسل الإعلان للمراجعة — إرسالك ليس نشرًا." });
      navigate("/market/vendor");
      return true;
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "تعذر إرسال الإعلان — راجع الحقول وأعد المحاولة.",
      });
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="micro-page micro-listing-editor" data-testid="market-listing-editor">
      <button className="micro-back-button" type="button" onClick={() => requestNavigation(returnPath)}>
        <ArrowRight aria-hidden="true" /> مساحة المورد
      </button>
      <div className="micro-page-heading">
        <h1>{listingId === null ? "إعلان جديد" : "تعديل إعلان"}</h1>
        <p>المسودة تقبل النقص؛ الإرسال للمراجعة يطلب اكتمال الحقول المناسبة.</p>
      </div>
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

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
        aria-label="صور الإعلان (خاصة حتى القبول)"
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
