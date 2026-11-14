/**
 * محرر إعلان المورد (مواصفة السوق §5): واجهة واحدة بأربع خطوات منطقية —
 * المادة، البيع والتسعير، التوفر والاستلام، ثم الإرسال للمراجعة. المسودة
 * تقبل النقص، والقيم الرقمية نصوص صحيحة بمقاييس العقد 25 (×1,000,000
 * للسعر و×1,000 للكمية)، والصور خاصة حتى القبول.
 */
import { useCallback, useEffect, useRef, useState } from "react";
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
  type ListingDraftInput,
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
  const { session, signIn, loading: sessionLoading, failed: sessionFailed, refresh } = useNetworkSession();
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
  /* Stage C (S13/R1-10): إعلان مسعّر بشرائح لا يُحول صامتًا إلى سعر ثابت —
   * التسعير بالشرائح يُدار من التحديث المباشر في مساحة المورد؛ هذا
   * المحرر يحفظ بقية الحقول ولا يلمس جدول الشرائح أبدًا. */
  const [tieredOriginal, setTieredOriginal] = useState(false);
  /* Stage C (S13/R1-10): تسعير الشرائح الأصلي يُعاد كما هو — لا يستبدله
   * المحرر ولا يخترع بديلًا عنه. */
  const originalPricingRef = useRef<Record<string, unknown> | null>(null);
  /* Stage C (S13/R4-4): رفع الصور فعل لكل ملف — النجاح الجزئي يُحفظ
   * تزايديًا والفشل يُعلن باسم الملف بلا فقد صامت. */
  const [uploadingCount, setUploadingCount] = useState(0);
  /* Stage C (S13/R4-13): معرّف المسودة المُنشأة يُحفظ — إعادة المحاولة بعد
   * فشل الإرسال لا تنشئ مسودة ثانية. */
  const createdDraftIdRef = useRef<string | null>(null);

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
        /* Stage C (S13/R1-10): التسعير بالشرائح حالة معلنة لا تحويل صامت. */
        if (listing.pricing?.mode === "tiered") {
          setTieredOriginal(true);
          originalPricingRef.current = listing.pricing as unknown as Record<string, unknown>;
        }
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
  /* S12/F-15 (Stage C — أمر المالك 2026-11-14): تعذّر التحقق حالة مستقلة
   * قبل بوابة الدخول — انقطاع الشبكة لا يُعرض كأنه «غير مسجل». */
  if (!sessionLoading && sessionFailed) {
    return (
      <section className="micro-page">
        <div className="micro-page-heading">
          <h1>إضافة إعلان</h1>
        </div>
        <Notice tone="error">
          تعذر التحقق من جلستك الآن — انقطاع الشبكة لا يعني أنك غير مسجل. تحقق من اتصالك ثم أعد المحاولة.
          <Button action="quiet" onClick={() => void refresh()}>
            إعادة المحاولة
          </Button>
        </Notice>
      </section>
    );
  }

  if (!sessionLoading && !session.authenticated) {
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

  /* Stage C (S13/R1-12): بناء المدخل والتحقق المشترك بين حفظ المسودة
   * وإرسالها — نفس قواعد الخادم؛ الإرسال للمراجعة هو الخطوة الوحيدة
   * المحجوزة لزر الإرسال. */
  const buildInput = (): { input: ListingDraftInput; targetId: string | null } | { error: string } => {
    const priceMicro = form.priceMode === "fixed" && !tieredOriginal ? jodToMicro(form.priceJod) : undefined;
    if (form.priceMode === "fixed" && !tieredOriginal && priceMicro === undefined) {
      return { error: "أدخل سعرًا صحيحًا بالدينار (حتى 6 منازل عشرية)." };
    }
    const minMilli = quantityToMilli(form.minQuantity);
    if (minMilli === undefined) {
      return { error: "أدخل حدًا أدنى صحيحًا للكمية (حتى 3 منازل عشرية)." };
    }
    const stepMilli = quantityToMilli(form.stepQuantity);
    if (stepMilli === undefined) {
      return { error: "أدخل مضاعفًا صحيحًا للكمية (حتى 3 منازل عشرية)." };
    }
    const base = {
      title: form.title,
      category: form.category,
      governorate: form.governorate,
      description: form.description,
      contactType: form.contactType as "phone" | "whatsapp",
      contactValue: normalizeAsciiDigits(form.contactValue.trim()),
      quantity: {
        unit: form.quantityUnit,
        minQuantityMilli: minMilli,
        stepMilli,
        unpacked: true,
      },
    };
    /* Stage C (S13/R1-10): إعلان مسعّر بشرائح — لا يُرسل التسعير أبدًا فلا
     * يُستبدل جدول الشرائح في نسخة العمل؛ الحقول الأخرى تُحفظ كما هي. */
    if (tieredOriginal && originalPricingRef.current !== null) {
      return {
        input: { ...base, pricing: originalPricingRef.current as ListingDraftInput["pricing"] },
        targetId: listingId,
      };
    }
    return {
      input: {
        ...base,
        pricing:
          form.priceMode === "fixed"
            ? {
                mode: "fixed" as const,
                priceMicroJod: priceMicro,
                basis: { units: normalizeAsciiDigits(form.basisUnits.trim()), unit: form.quantityUnit },
              }
            : ({ mode: "quote_required" as const, quoteReason: "يحتاج تحديدًا تقنيًا قبل التسعير" } as const),
      },
      targetId: listingId,
    };
  };

  const persistDraft = async (): Promise<string | null> => {
    const built = buildInput();
    if ("error" in built) {
      setMessage({ tone: "error", text: built.error });
      return null;
    }
    let targetId = built.targetId ?? createdDraftIdRef.current;
    if (targetId === null) {
      const draft = await createListingDraft(built.input);
      targetId = draft.listing.id;
      createdDraftIdRef.current = targetId;
    } else {
      await updateListingDraft(targetId, built.input);
    }
    for (const mediaId of mediaIds) {
      await attachListingMedia(targetId, mediaId);
    }
    return targetId;
  };

  const saveDraftOnly = async (): Promise<boolean> => {
    if (busy) return false;
    setBusy(true);
    setMessage(null);
    try {
      const saved = await persistDraft();
      if (saved === null) return false;
      setMessage({ tone: "success", text: "حُفظت المسودة — لم تُرسل للمراجعة بعد." });
      navigate("/market/vendor");
      return true;
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "تعذر حفظ المسودة — أعد المحاولة.",
      });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submit = async (): Promise<boolean> => {
    setBusy(true);
    setMessage(null);
    try {
      const targetId = await persistDraft();
      if (targetId === null) return false;
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

  /* Stage C (S13/R1-11): حارس المغادرة يحفظ المسودة فقط — زر «احفظ واستمر»
   * في الحوار لا يرسل للمراجعة أبدًا؛ الإرسال فعل صريح من زره وحده. */
  const requestNavigation = useUnsavedChangesGuard({ isDirty, onSave: () => saveDraftOnly() });

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
      {/* Stage C (S13/R4-14): فشل جلب الميتا حالة معلنة — لا قائمة تصنيفات
       * فارغة صامتة تنتهي برفض الخادم بلا تفسير. */}
      {meta === null ? (
        <Notice tone="error">
          تعذر تحميل التصنيفات والمحافظات — لا يمكن حفظ الإعلان بلا تصنيف. أعد المحاولة.
          <Button
            action="quiet"
            onClick={() =>
              void fetchMarketMeta()
                .then(setMeta)
                .catch(() => setMeta(null))
            }
          >
            إعادة المحاولة
          </Button>
        </Notice>
      ) : null}

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
      {/* Stage C (S13/R1-10): تسعير الشرائح يُدار من التحديث المباشر في
       * مساحة المورد — هذا المحرر لا يعرضه ولا يستبدله؛ حفظ بقية الحقول
       * آمن ولا يلمس جدول الشرائح. */}
      {tieredOriginal ? (
        <Notice tone="info">
          هذا الإعلان مسعّر بشرائح — تعديل الشرائح يتم من «التحديث المباشر» في مساحة المورد؛ محرر الإعلان يحفظ
          بقية الحقول ولا يغيّر التسعير.
        </Notice>
      ) : (
        <>
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
        </>
      )}
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
        disabled={uploadingCount > 0}
        onChange={async event => {
          /* Stage C (S13/R4-4): النجاح الجزئي يُلحق تزايديًا والفشل يُعلن
           * باسم الملف — لا فقد صامت ولا وعد غير معلن. */
          const files = [...(event.target.files ?? [])];
          event.target.value = "";
          let failedFile: string | null = null;
          let failure: unknown = null;
          setUploadingCount(current => current + files.length);
          try {
            for (const file of files.slice(0, 6)) {
              try {
                const result = await uploadListingImage(file);
                setMediaIds(current => [...current, result.media.id].slice(0, 6));
              } catch (error) {
                failedFile = file.name;
                failure = error;
                break;
              }
            }
          } finally {
            setUploadingCount(0);
          }
          if (failedFile !== null) {
            const detail =
              failure instanceof Error && failure.message
                ? failure.message
                : "الصور المرفوعة سابقًا محفوظة. أعد المحاولة.";
            setMessage({
              tone: "error",
              text: `تعذر رفع الصورة «${failedFile}» — ${detail}`,
            });
          }
        }}
      />
      <p className="micro-editor-hint">
        {uploadingCount > 0
          ? `جارٍ رفع الصور (${uploadingCount})…`
          : `${mediaIds.length} صورة مرفوعة — تبقى خاصة حتى اكتمال القبول.`}
      </p>

      <div className="micro-form-actions">
        <Button action="save" loading={busy} onClick={() => void submit()}>
          إرسال للمراجعة
        </Button>
        {/* Stage C (S13/R1-12): توقيف صريح عند المسودة — لا إرسال خفي
         * للمراجعة من زر الحفظ. */}
        <Button action="outline" disabled={busy} onClick={() => void saveDraftOnly()}>
          حفظ كمسودة
        </Button>
      </div>
    </section>
  );
}
