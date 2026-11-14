/**
 * محرر حجز التوصيل (المواصفة §6/§8): المهمة والموعد، اختيار السائق المعروف،
 * المراجعة والإرسال. معاينة الإفصاح تظهر ما سيراه السائق (مناطق لا عناوين
 * حتى قرار الإفصاح)، ومبلغ التحصيل اختياري يراه السائق قبل القبول (OD13).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight } from "lucide-react";
import { useReturnPath } from "@/app/useReturnNavigation";
import { useNetworkSession } from "@/app/useNetworkSession";
import {
  createDeliveryRequest,
  fetchDriverDirectory,
  submitDeliveryRequest,
  type DriverDirectoryEntryDto,
} from "@/application/delivery";
import { Button, EmptyState, Field, Notice } from "@/components/primitives";
import { useUnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import { useFormDirty } from "@/components/forms/useFormDirty";
import { normalizeAsciiDigits } from "@/application/input";

const GOVERNORATES = [
  "عمان",
  "إربد",
  "الزرقاء",
  "البلقاء",
  "المفرق",
  "العقبة",
  "جرش",
  "عجلون",
  "مادبا",
  "الكرك",
  "الطفيلة",
  "معان",
];

export default function DeliveryBookingEditor() {
  const [location, navigate] = useLocation();
  /* معامل معجمي موثق (عقد ٢٦ §3 + EXE-016): سائق مختار مسبقًا من دليل
   * السائقين — يُستهلك مرة واحدة عند الفتح ثم يُنسخ من الرابط. */
  const preselectedDriver = new URLSearchParams(location.split("?")[1] ?? "").get("driver");
  const returnPath = useReturnPath();
  /* S12/F-15 (Stage C — أمر المالك 2026-11-14): تعذّر التحقق حالة مستقلة
   * قبل بوابة الدخول — انقطاع الشبكة لا يُعرض كأنه «غير مسجل». */
  const { session, signIn, loading: sessionLoading, failed: sessionFailed, refresh } = useNetworkSession();
  const [drivers, setDrivers] = useState<DriverDirectoryEntryDto[] | null>(null);
  const [directoryError, setDirectoryError] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /* Stage C (S13/R4-13): معرّف المسودة المنشأة يُحفظ — إعادة المحاولة بعد
   * فشل الإرسال تُرسل المسودة نفسها لا تنشئ مسودة ثانية. */
  const createdRequestIdRef = useRef<string | null>(null);
  const [form, setForm] = useState({
    needType: "deliver_to_customer" as "deliver_to_customer" | "fetch_ready_goods",
    driverProfileId: "",
    pricingMode: "prepriced" as "prepriced" | "quote_request",
    fareJod: "",
    collectionJod: "",
    pickupGovernorate: "عمان",
    pickupArea: "",
    dropoffGovernorate: "عمان",
    dropoffArea: "",
    recipientName: "",
    recipientPhone: "",
    recipientAddress: "",
    parcels: "1",
    loadDescription: "",
    pickupWindow: "",
    dropoffWindow: "",
    date: "",
  });

  const load = useCallback(async () => {
    setDirectoryError(false);
    try {
      const directory = await fetchDriverDirectory();
      setDrivers(directory.drivers);
    } catch {
      setDrivers(null);
      setDirectoryError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (preselectedDriver !== null && preselectedDriver !== "") {
      update({ driverProfileId: preselectedDriver });
    }
    // consumed once at open; the param never round-trips into saved state.
  }, [preselectedDriver]);

  const update = (patch: Partial<typeof form>) => setForm(current => ({ ...current, ...patch }));

  /* حارس المدخلات غير المحفوظة — الرجوع يمر بالحوار الثلاثي القائم. */
  const isDirty = useFormDirty([
    form.needType,
    form.driverProfileId,
    form.pricingMode,
    form.fareJod,
    form.collectionJod,
    form.pickupGovernorate,
    form.pickupArea,
    form.dropoffGovernorate,
    form.dropoffArea,
    form.recipientName,
    form.recipientPhone,
    form.recipientAddress,
    form.parcels,
    form.loadDescription,
    form.pickupWindow,
    form.dropoffWindow,
    form.date,
  ]);
  const requestNavigation = useUnsavedChangesGuard({ isDirty, onSave: () => submit() });

  /* S12/F-15 (Stage C): انقطاع التحقق حالة مستقلة صادقة مع إعادة محاولة. */
  if (!sessionLoading && sessionFailed) {
    return (
      <section className="micro-page">
        <div className="micro-page-heading">
          <h1>حجز توصيل</h1>
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
          <h1>حجز توصيل</h1>
        </div>
        <Notice tone="neutral">
          الحجز يحتاج تسجيل الدخول بهوية Micro.
          <Button action="quiet" onClick={() => signIn("/delivery/booking/new")}>
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
      if (!form.driverProfileId) {
        setMessage("اختر سائقًا معروفًا — لا بث ولا تعيين عشوائي.");
        return false;
      }
      const fareText = normalizeAsciiDigits(form.fareJod.trim());
      const fareMinor =
        form.pricingMode === "prepriced" && /^\d+(\.\d{1,2})?$/.test(fareText)
          ? `${Math.round(Number(fareText) * 100)}`
          : undefined;
      if (form.pricingMode === "prepriced" && fareMinor === undefined) {
        setMessage("أدخل أجرة صحيحة بالدينار (خانتان عشريتان).");
        return false;
      }
      const collectionText = normalizeAsciiDigits(form.collectionJod.trim());
      const collectionMinor = /^\d+(\.\d{1,2})?$/.test(collectionText)
        ? `${Math.round(Number(collectionText) * 100)}`
        : undefined;
      /* Stage C (S13/R4-13): المسودة المُنشأة تُرسل نفسها عند إعادة المحاولة —
       * لا مسودة ثانية من كل محاولة إرسال فاشلة. */
      let requestId = createdRequestIdRef.current;
      if (requestId === null) {
        const created = await createDeliveryRequest({
          driverProfileId: form.driverProfileId,
          needType: form.needType,
          pricingMode: form.pricingMode,
          offeredFareMinor: fareMinor,
          collectionMinor,
          collectionContent: collectionMinor === undefined ? undefined : "product",
          payload: {
            pickup: { governorate: form.pickupGovernorate, area: form.pickupArea },
            dropoff: {
              governorate: form.dropoffGovernorate,
              area: form.dropoffArea,
              name: form.recipientName,
              phone: form.recipientPhone,
              address: form.recipientAddress,
            },
            load: {
              description: form.loadDescription,
              parcels: Number(normalizeAsciiDigits(form.parcels)) || 1,
              fragile: false,
            },
            schedule: { date: form.date, pickupWindow: form.pickupWindow, dropoffWindow: form.dropoffWindow },
          },
        });
        requestId = created.request.id;
        createdRequestIdRef.current = requestId;
      }
      await submitDeliveryRequest(requestId);
      /* Stage C (S13/R4-12): رسالة النجاح كانت تُحذف فورًا بالإبحار وتُعرض
       * بنبرة خطأ — مهلة الرد تظهر في تفاصيل الحجز نفسها؛ هنا رسالة صادقة
       * قصيرة قبل الانتقال فقط عند بقاء المسار. */
      navigate(`/delivery/booking/${requestId}`);
      return true;
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "تعذر إرسال الحجز — راجع الاتصال؛ الحجز محفوظ كمسودة.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="micro-page micro-booking-editor" data-testid="delivery-booking-editor">
      <button className="micro-back-button" type="button" onClick={() => requestNavigation(returnPath)}>
        <ArrowRight aria-hidden="true" /> التوصيل
      </button>
      <div className="micro-page-heading">
        <h1>حجز توصيل</h1>
        <p>ثلاث مجموعات: المهمة والموعد، اختيار السائق، المراجعة والإرسال.</p>
      </div>
      {message ? <Notice tone="error">{message}</Notice> : null}

      <h2>المهمة والموعد</h2>
      <Field label="نوع الحاجة">
        <select
          value={form.needType}
          onChange={event => update({ needType: event.target.value as typeof form.needType })}
        >
          <option value="deliver_to_customer">توصيل للزبون</option>
          <option value="fetch_ready_goods">إحضار أغراض جاهزة</option>
        </select>
      </Field>
      <div className="micro-editor-grid">
        <Field label="محافظة الاستلام">
          <select
            value={form.pickupGovernorate}
            onChange={event => update({ pickupGovernorate: event.target.value })}
          >
            {GOVERNORATES.map(governorate => (
              <option key={governorate}>{governorate}</option>
            ))}
          </select>
        </Field>
        <Field label="منطقة الاستلام">
          <input value={form.pickupArea} onChange={event => update({ pickupArea: event.target.value })} />
        </Field>
      </div>
      <div className="micro-editor-grid">
        <Field label="محافظة التسليم">
          <select
            value={form.dropoffGovernorate}
            onChange={event => update({ dropoffGovernorate: event.target.value })}
          >
            {GOVERNORATES.map(governorate => (
              <option key={governorate}>{governorate}</option>
            ))}
          </select>
        </Field>
        <Field label="منطقة التسليم">
          <input value={form.dropoffArea} onChange={event => update({ dropoffArea: event.target.value })} />
        </Field>
      </div>
      <div className="micro-editor-grid">
        <Field label="اسم المستلم (خاص حتى قرار الإفصاح)">
          <input
            value={form.recipientName}
            onChange={event => update({ recipientName: event.target.value })}
          />
        </Field>
        <Field label="هاتف المستلم (خاص)">
          <input
            value={form.recipientPhone}
            onChange={event => update({ recipientPhone: event.target.value })}
            inputMode="tel"
          />
        </Field>
      </div>
      <Field label="عنوان المستلم (خاص)">
        <input
          value={form.recipientAddress}
          onChange={event => update({ recipientAddress: event.target.value })}
        />
      </Field>
      <div className="micro-editor-grid">
        <Field label="عدد الطرود">
          <input
            value={form.parcels}
            onChange={event => update({ parcels: event.target.value })}
            inputMode="numeric"
          />
        </Field>
        <Field label="وصف الحمولة">
          <input
            value={form.loadDescription}
            onChange={event => update({ loadDescription: event.target.value })}
          />
        </Field>
      </div>
      <div className="micro-editor-grid">
        <Field label="التاريخ">
          <input type="date" value={form.date} onChange={event => update({ date: event.target.value })} />
        </Field>
        <Field label="نافذة الاستلام">
          <input
            value={form.pickupWindow}
            onChange={event => update({ pickupWindow: event.target.value })}
            placeholder="10:00-12:00"
          />
        </Field>
        <Field label="نافذة التسليم">
          <input
            value={form.dropoffWindow}
            onChange={event => update({ dropoffWindow: event.target.value })}
            placeholder="14:00-16:00"
          />
        </Field>
      </div>

      <h2>اختيار السائق المعروف</h2>
      {directoryError ? (
        <EmptyState
          title="تعذر تحميل دليل السائقين"
          description="أعد المحاولة — لا بيانات وهمية."
          action={
            <Button action="secondary" onClick={() => void load()}>
              إعادة المحاولة
            </Button>
          }
        />
      ) : drivers === null ? (
        <p className="micro-route-loading" role="status">
          جارٍ تحميل الدليل…
        </p>
      ) : drivers.length === 0 ? (
        <EmptyState
          title="لا سائقين متاحين للعرض"
          description="لا بيانات وهمية — ادخل سائقًا من سائقوني أو شارك دعوة تقديم."
        />
      ) : (
        <ul
          className="micro-driver-picker"
          data-testid="driver-picker"
          role="radiogroup"
          aria-label="اختيار السائق"
        >
          {drivers.map(driver => (
            <li key={driver.driverProfileId}>
              <label>
                <input
                  type="radio"
                  name="driver"
                  checked={form.driverProfileId === driver.driverProfileId}
                  /* Stage C (S13/R1-23): نفس قاعدة الدليل العام — لا يُبنى حجز محدود المصير بالرفض الخادمي. */
                  disabled={!driver.eligibleForNewWork || !driver.acceptingNew}
                  onChange={() => update({ driverProfileId: driver.driverProfileId })}
                />
                <span>
                  {driver.displayName}
                  {driver.ratingsCount > 0
                    ? ` · ${driver.averageStars ?? "—"}★ (${driver.ratingsCount})`
                    : " · جديد — دون تقييمات"}
                  {driver.eligibleForNewWork && driver.acceptingNew ? "" : " · لا يستقبل جديدًا حاليًا"}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <h2>المراجعة والإرسال</h2>
      <Field label="طريقة السعر">
        <select
          value={form.pricingMode}
          onChange={event => update({ pricingMode: event.target.value as typeof form.pricingMode })}
        >
          <option value="prepriced">أجرة معروضة (يقبلها السائق خلال 30 دقيقة)</option>
          <option value="quote_request">طلب تسعير (عرض نهائي واحد)</option>
        </select>
      </Field>
      {form.pricingMode === "prepriced" ? (
        <Field label="الأجرة المعروضة (د.أ)">
          <input
            value={form.fareJod}
            onChange={event => update({ fareJod: event.target.value })}
            inputMode="decimal"
          />
        </Field>
      ) : null}
      <Field label="مبلغ تحصيل اختياري (د.أ — يراه السائق قبل القبول)">
        <input
          value={form.collectionJod}
          onChange={event => update({ collectionJod: event.target.value })}
          inputMode="decimal"
        />
      </Field>
      <Notice tone="info">
        معاينة الإفصاح: سيرى السائق المناطق والموعد والحمولة والأجرة — بيانات المستلم التفصيلية محجوبة حتى
        قرار الإفصاح الموثق.
      </Notice>
      <div className="micro-form-actions">
        <Button action="commit" loading={busy} onClick={() => void submit()}>
          إرسال الحجز للسائق
        </Button>
      </div>
    </section>
  );
}
