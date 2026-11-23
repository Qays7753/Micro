/**
 * محرر حجز التوصيل (المواصفة §6/§8): المهمة والموعد، اختيار السائق المعروف،
 * المراجعة والإرسال. معاينة الإفصاح تظهر ما سيراه السائق (مناطق لا عناوين
 * حتى قرار الإفصاح)، ومبلغ التحصيل اختياري يراه السائق قبل القبول (OD13).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { ArrowRight } from "lucide-react";
import { useReturnPath } from "@/app/useReturnNavigation";
import { useNetworkSession } from "@/app/useNetworkSession";
import { newIdempotencyKey } from "@/application/network";
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

/* Wave 3 (Q75 — القرار النهائي): فئات الحمل الأربع وشرائح الوزن الثلاث —
 * القيم الحرفية نفسها التي يتحقق منها الخادم. */
const LOAD_CLASS_OPTIONS = [
  { value: "small", label: "صغير — يُحمل باليد" },
  { value: "medium", label: "متوسط — صندوق سيارة" },
  { value: "large", label: "كبير — بكب" },
  { value: "extra_large", label: "كبير جدًا — فان" },
] as const;

const WEIGHT_BAND_OPTIONS = [
  { value: "under_10kg", label: "أقل من 10 كغ" },
  { value: "10_to_50kg", label: "من 10 إلى 50 كغ" },
  { value: "over_50kg", label: "أكثر من 50 كغ" },
] as const;

export default function DeliveryBookingEditor() {
  const [location, navigate] = useLocation();
  const searchString = useSearch();
  /* الموجة 4 (G08): سياق الرابط ?context=order:<id> — تلميح عرض فقط. */
  const orderContext = useMemo(() => {
    const matchContext = /[?&]context=order:([^&]+)/.exec(searchString);
    return matchContext === null ? null : decodeURIComponent(matchContext[1]!);
  }, [searchString]);
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
  /* SRV-03 (Post-Group 6 Wave 3): مفتاح ثابت لهذه العملية المنطقية (إنشاء
   * هذا الحجز) يُولّد مرة ويُعاد استعماله عند كل إعادة محاولة — لا مفتاح
   * جديد لكل محاولة (الخادم يحجز المفتاح ذريًّا ويرفض التكرار المتزامن). */
  const createIdempotencyKeyRef = useRef<string | null>(null);
  const [form, setForm] = useState({
    needType: "deliver_to_customer" as "deliver_to_customer" | "fetch_ready_goods" | "period_booking",
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
    /* Wave 3 (Q75/Q100/MD-01): فئة الحمل وشريحة الوزن ونافذة الفترة وملاحظاتها
     * وموافقة كشف بيانات المستلم. */
    loadClass: "small" as (typeof LOAD_CLASS_OPTIONS)[number]["value"],
    weightBand: "under_10kg" as (typeof WEIGHT_BAND_OPTIONS)[number]["value"],
    periodStart: "",
    periodEnd: "",
    periodNotes: "",
    recipientDataConsent: false,
  });

  const load = useCallback(async () => {
    setDirectoryError(false);
    try {
      /* Wave 3 (Q73/Q93): الدليل مع المسار — يُرتّب من يغطي المحافظتين أولًا
       * مع علامة «يغطي مسارك»؛ الباقون يتبعون بلا رفض (السائق يقرر). */
      const directory = await fetchDriverDirectory({
        pickupGovernorate: form.pickupGovernorate,
        dropoffGovernorate: form.dropoffGovernorate,
      });
      setDrivers(directory.drivers);
    } catch {
      setDrivers(null);
      setDirectoryError(true);
    }
    // The route depends on the two governorates only — a change to either
    // reloads the ordered directory.
  }, [form.pickupGovernorate, form.dropoffGovernorate]);

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
    form.loadClass,
    form.weightBand,
    form.periodStart,
    form.periodEnd,
    form.periodNotes,
    form.recipientDataConsent,
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
      /* Wave 3 (Q100): نافذة الفترة إلزامية لنوع «حجز لفترة» — بداية ونهاية
       * (وقت محلي يُحوّل إلى طابع خادمي؛ الخادم يتحقق ويحسم بساعته). */
      let scheduledStartAt: number | undefined;
      let scheduledEndAt: number | undefined;
      if (form.needType === "period_booking") {
        const start = new Date(form.periodStart).getTime();
        const end = new Date(form.periodEnd).getTime();
        if (
          !Number.isFinite(start) ||
          !Number.isFinite(end) ||
          form.periodStart === "" ||
          form.periodEnd === ""
        ) {
          setMessage("أدخل بداية الفترة ونهايتها للحجز بالفترة.");
          return false;
        }
        if (end <= start) {
          setMessage("نهاية الفترة يجب أن تكون بعد بدايتها.");
          return false;
        }
        scheduledStartAt = start;
        scheduledEndAt = end;
      }
      /* Stage C (S13/R4-13): المسودة المُنشأة تُرسل نفسها عند إعادة المحاولة —
       * لا مسودة ثانية من كل محاولة إرسال فاشلة. */
      let requestId = createdRequestIdRef.current;
      if (requestId === null) {
        /* W1 (EX-D24/AUTHZ-05): السياق النشط الصريح — مشروع واحد لكل حساب
         * ولا إنشاء ضمنيًا؛ غيابه رسالة صادقة لا إعادة توجيه صامتة. */
        const activeWorkspaceId = session.workspaces?.[0]?.id;
        if (!activeWorkspaceId) {
          setMessage("لا يوجد مشروع بعد — أنشئ مشروعك أولًا من ملف الحساب.");
          return false;
        }
        /* SRV-03: المفتاح يولّد مرة لهذا الحجز ويُثبّت — إعادة المحاولة بعد
         * فشل الشبكة تعيد استعمال المفتاح نفسه فلا يُنشأ حجز مكرر أبدًا. */
        if (createIdempotencyKeyRef.current === null) {
          createIdempotencyKeyRef.current = newIdempotencyKey();
        }
        const created = await createDeliveryRequest({
          driverProfileId: form.driverProfileId,
          needType: form.needType,
          pricingMode: form.pricingMode,
          offeredFareMinor: fareMinor,
          collectionMinor,
          collectionContent: collectionMinor === undefined ? undefined : "product",
          workspaceId: activeWorkspaceId,
          ...(form.needType === "period_booking"
            ? {
                scheduledStartAt,
                scheduledEndAt,
                periodNotes: form.periodNotes.trim() === "" ? undefined : form.periodNotes.trim(),
              }
            : {
                loadClass: form.loadClass,
                weightBand: form.weightBand,
                pieceCount: Number(normalizeAsciiDigits(form.parcels)) || 1,
              }),
          recipientDataConsent: form.recipientDataConsent === true ? true : undefined,
          idempotencyKey: createIdempotencyKeyRef.current,
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
      {/* الموجة 4 (G08 — Q168/Q176): الرابط السياقي من الطلب — تلميح صادق عن
       * مصدر التنقل فقط؛ لا نسخ بيانات الطلب إلى الحجز ولا أي أثر مالي. */}
      {orderContext !== null ? (
        <Notice tone="neutral" data-testid="booking-order-context">
          فتحت هذا الحجز من طلبك «{orderContext}» — الحجز مستقل ماليًا ولا يُنشئ أي قيد في دفتر المشروع.
        </Notice>
      ) : null}
      {message ? <Notice tone="error">{message}</Notice> : null}

      <h2>المهمة والموعد</h2>
      <Field label="نوع الحاجة">
        <select
          value={form.needType}
          onChange={event => update({ needType: event.target.value as typeof form.needType })}
        >
          <option value="deliver_to_customer">توصيل للزبون</option>
          <option value="fetch_ready_goods">إحضار أغراض جاهزة</option>
          {/* Wave 3 (Q100 — القرار النهائي): النوع الثالث «حجز لفترة» —
           * بداية ونهاية وسعر متفق عليه وملاحظات. */}
          <option value="period_booking">حجز لفترة (بداية ونهاية)</option>
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
      {form.needType === "period_booking" ? (
        <>
          {/* Wave 3 (Q100): نافذة الفترة إلزامية — بداية ونهاية وسعر متفق
           * عليه وملاحظات؛ الخادم يتحقق ويفحص التداخل ضمن سعة السائق. */}
          <div className="micro-editor-grid">
            <Field label="بداية الفترة">
              <input
                type="datetime-local"
                value={form.periodStart}
                onChange={event => update({ periodStart: event.target.value })}
                data-testid="period-start"
              />
            </Field>
            <Field label="نهاية الفترة">
              <input
                type="datetime-local"
                value={form.periodEnd}
                onChange={event => update({ periodEnd: event.target.value })}
                data-testid="period-end"
              />
            </Field>
          </div>
          <Field label="ملاحظات الفترة (اختياري)">
            <input
              value={form.periodNotes}
              onChange={event => update({ periodNotes: event.target.value })}
              placeholder="مثال: يوم كامل لتوصيلات السوق"
            />
          </Field>
        </>
      ) : (
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
      )}
      {form.needType !== "period_booking" ? (
        <>
          {/* Wave 3 (Q75 — القرار النهائي): فئة الحمل وعدد القطع وشرائح
           * الوزن — حقول إلزامية يتحقق منها الخادم (د-7/Q97). */}
          <div className="micro-editor-grid">
            <Field label="فئة الحمل">
              <select
                value={form.loadClass}
                onChange={event => update({ loadClass: event.target.value as typeof form.loadClass })}
                data-testid="load-class"
              >
                {LOAD_CLASS_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="الوزن التقريبي">
              <select
                value={form.weightBand}
                onChange={event => update({ weightBand: event.target.value as typeof form.weightBand })}
                data-testid="weight-band"
              >
                {WEIGHT_BAND_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="micro-editor-grid">
            <Field label="عدد القطع">
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
        </>
      ) : null}

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
                  {/* Wave 3 (Q73): علامة التغطية — السائق الذي يغطي المسار
                   * يتصدر القائمة بعلامة «يغطي مسارك». */}
                  {driver.coversRoute === true ? (
                    <strong data-testid={`covers-route-${driver.driverProfileId}`}> · يغطي مسارك</strong>
                  ) : null}
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
      {/* Wave 3 (MD-01 — القرار النهائي د-1 + Q115/Q238): موافقة مدى الحجز
       * على كشف بيانات المستلم للسائق المعيّن بعد تأكيد الحجز — اختيار
       * صريح قابل للسحب لاحقًا؛ بلاه يبقى السائق على المناطق والموعد فقط. */}
      <label className="micro-consent-check" data-testid="recipient-consent">
        <input
          type="checkbox"
          checked={form.recipientDataConsent}
          onChange={event => update({ recipientDataConsent: event.target.checked })}
        />
        <span>
          أوافق على إظهار بيانات المستلم (الاسم والهاتف والعنوان) للسائق المعيّن بعد تأكيد الحجز — يمكنني سحب
          الموافقة لاحقًا من صفحة الحجز.
        </span>
      </label>
      {/* Wave 3 (Q73): تنبيه صادق عند اختيار سائق خارج تغطية المسار —
       * الحجز مسموح والسائق يقرر؛ لا رفض خادمي. */}
      {(() => {
        const selected = drivers?.find(driver => driver.driverProfileId === form.driverProfileId);
        if (selected === undefined || selected === null || selected.coversRoute !== false) return null;
        return (
          <Notice tone="info" data-testid="outside-coverage-notice">
            السائق المختار خارج تغطية هذا المسار — الحجز مسموح مع هذا التنبيه، والسائق يقرر قبوله بعد رؤية
            المسار والحمولة.
          </Notice>
        );
      })()}
      <Notice tone="info">
        معاينة الإفصاح: سيرى السائق المناطق والموعد والحمولة والأجرة — بيانات المستلم التفصيلية لا تظهر للسائق
        إلا بموافقتك الصريحة أعلاه، ويمكن سحبها في أي وقت.
      </Notice>
      <div className="micro-form-actions">
        <Button action="commit" loading={busy} onClick={() => void submit()}>
          إرسال الحجز للسائق
        </Button>
      </div>
    </section>
  );
}
