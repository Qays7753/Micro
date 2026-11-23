/**
 * Post-Group 6 continuous completion (WS-251/DOC-041 — owner order 7593b9c4
 * §5.3/§5.4 + supplement §10.2-5/§10.2-7-6, 2026-11-22): بطاقة المسودة
 * المقترحة من اسأل Micro — نموذج مطبوع قابل للتحرير، القيم المجهولة تبقى
 * فارغة والمستخدم يقررها، والمسودة ليست معاملة محفوظة أبدًا. الكتابة
 * الوحيدة الممكنة: تأكيد صريح من المستخدم بعد إكمال الحقول عبر المسار
 * الكنوني نفسه، ثم قبول الخادم — لا كتابة من إنتاج الاقتراح ذاته، ولا
 * نجاح كاذب أبدًا.
 *
 * النوعان المسجلان (السجل المغلق — كل نوع بحقلّه المطبوعة الصارمة):
 *  - delivery-booking: إنشاء مسودة حجز عبر خدمة التوصيل القياسية ثم
 *    يُكمل الحجز ويرسَل من صفحته الطبيعية.
 *  - manage-financial-event (الملحق §10.2-5): تسجيل حدث مالي عبر المسار
 *    الكنوني نفسه — يُبنى السجل بدالة إنشاء المجال نفسها (بلا أي تكرار
 *    للمخطط) ثم يُحفظ بالكتابة المتصلة أحادية السجل القائمة
 *    (PUT /api/manage/records/financialEvents/:id) — لا مسار كتابة جديد
 *    ولا تغيير للمعنى المالي؛ القيم السبع القابلة للمسودة هي الأنواع
 *    حرة السياق، والأنواع المركبة المؤجلة موثقة في سياسة العامل.
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { createDeliveryRequest, fetchDriverDirectory } from "@/application/delivery";
import { askDraftAmountMinor, constructFinancialEventRecord } from "@/application/ask";
import {
  ApiError,
  newIdempotencyKey,
  saveManageRecord,
  type AskDraftProposal,
  type NetworkSession,
} from "@/application/network";
import { Button } from "@/components/primitives";

const JORDAN_GOVERNORATES = [
  "عمان",
  "البلقاء",
  "الزرقاء",
  "إربد",
  "المفرق",
  "الجرش",
  "عجلون",
  "معان",
  "الطفيلة",
  "الكرك",
  "مادبا",
  "العقبة",
] as const;

const NEED_TYPES = [
  { value: "deliver_to_customer", label: "توصيل إلى زبون" },
  { value: "fetch_ready_goods", label: "إحضار بضاعة جاهزة" },
] as const;

const LOAD_CLASSES = [
  { value: "small", label: "صغير — يُحمل باليد" },
  { value: "medium", label: "متوسط — صندوق سيارة" },
  { value: "large", label: "كبير — بكب" },
  { value: "extra_large", label: "كبير جدًا — فان" },
] as const;

const WEIGHT_BANDS = [
  { value: "under_10kg", label: "أقل من 10 كغ" },
  { value: "10_to_50kg", label: "10 إلى 50 كغ" },
  { value: "over_50kg", label: "أكثر من 50 كغ" },
] as const;

const PRICING_MODES = [
  { value: "quote_request", label: "طلب سعر من السائق" },
  { value: "prepriced", label: "أجر معروض محدد" },
] as const;

function labelFor(list: readonly { value: string; label: string }[], value: string): string {
  return list.find(entry => entry.value === value)?.label ?? value;
}

export function AskDraftCard({
  draft,
  session,
  onDismissed,
}: {
  draft: AskDraftProposal;
  session: NetworkSession;
  onDismissed: () => void;
}) {
  /* §10.2-7-6: كل نوع ببطاقته المطبوعة — التوجيه مغلق على السجل المسجل. */
  if (draft.kind === "manage-financial-event") {
    return <ManageFinancialEventDraftCard draft={draft} session={session} onDismissed={onDismissed} />;
  }
  return <DeliveryBookingDraftCard draft={draft} session={session} onDismissed={onDismissed} />;
}

/* ── manage-financial-event (§10.2-5) ───────────────────────────────────── */

const FINANCIAL_EVENT_TYPES = [
  { value: "owner_investment_cash", label: "إيداع نقدي من المالك" },
  { value: "owner_withdrawal_cash", label: "سحب نقدي للمالك" },
  { value: "operating_expense_cash", label: "مصروف تشغيل نقدي" },
  { value: "operating_expense_payable", label: "مصروف تشغيل بالأجل (التزام)" },
  { value: "amanah_held_cash", label: "أمانة نقدية بحوزتك" },
  { value: "amanah_released_cash", label: "رد أمانة نقدية" },
  { value: "loss_non_cash", label: "خسارة غير نقدية (هدر/تلف)" },
] as const;

function ManageFinancialEventDraftCard({
  draft,
  session,
  onDismissed,
}: {
  draft: AskDraftProposal;
  session: NetworkSession;
  onDismissed: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const field of draft.fields) {
      initial[field.name] = field.value === null || field.value === undefined ? "" : String(field.value);
    }
    return initial;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ id: string } | null>(null);

  const field = (name: string) => draft.fields.find(entry => entry.name === name);
  const value = (name: string) => values[name] ?? "";

  /* المبلغ يُفحص بمحلل المال الكنوني نفسه (قروش صحيحة بلا تقريب عشري). */
  const amountMinor = askDraftAmountMinor(value("amountJod"));
  const requiredComplete =
    value("eventType") !== "" &&
    amountMinor !== null &&
    amountMinor > 0 &&
    value("occurredOn") !== "" &&
    value("note").trim().length > 0;

  async function confirm(): Promise<void> {
    const workspaceId = session.workspaces?.[0]?.id;
    if (!workspaceId) {
      setError("لا يوجد مشروع نشط لهذا الحساب — أنشئ مشروعك أولًا.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      /* §10.2-5: المسار الكنوني نفسه — السجل يُبنى بدالة إنشاء المجال
       * نفسها (كل حراس الشكل والقيم الكنونية)، ثم الكتابة المتصلة أحادية
       * السجل القائمة هي الحفظ، والنجاح يظهر فقط بعد قبول الخادم. */
      const record = constructFinancialEventRecord({
        eventType: value("eventType"),
        amountJodText: value("amountJod"),
        occurredOn: value("occurredOn"),
        note: value("note"),
        counterparty: value("counterparty"),
      });
      const idempotencyKey = String(record.idempotencyKey);
      const result = await saveManageRecord(
        "financialEvents",
        record.id,
        { ...record },
        null,
        idempotencyKey,
        undefined,
        workspaceId,
      );
      setBusy(false);
      setSaved({ id: result.id });
    } catch (cause) {
      setBusy(false);
      /* فشل الخادم = لا كتابة ولا نجاح كاذب — أعد المحاولة أو عدّل. */
      setError(
        cause instanceof ApiError ? cause.message : "تعذر تسجيل الحدث الآن — لم يُحفظ شيء. أعد المحاولة.",
      );
    }
  }

  if (saved !== null) {
    return (
      <div className="micro-ask-draft" data-testid="ask-draft-saved">
        <p role="status">سُجّل الحدث المالي بعد قبول الخادم — يظهر في سجل الأحداث المالية لمشروعك.</p>
        <div className="micro-form-actions">
          <Button action="quiet" onClick={onDismissed}>
            إغلاق
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="micro-ask-draft" data-testid="ask-draft-card">
      <p className="micro-overline">مسودة مقترحة — ليست محفوظة</p>
      <h3>{draft.title}</h3>
      <p className="micro-ask-draft-note">
        أكمل الحقول بنفسك — القيم التي لم تذكرها في سؤالك بقيت فارغة عمدًا، والتأكيد يسجّل الحدث المالي عبر
        المسار المالي المعتمد نفسه لمشروعك.
      </p>
      {field("eventType") ? (
        <label className="micro-field">
          <span>{field("eventType")!.label} (إلزامي)</span>
          <select
            value={value("eventType")}
            onChange={event => setValues({ ...values, eventType: event.target.value })}
          >
            <option value="">— اختر النوع —</option>
            {FINANCIAL_EVENT_TYPES.map(entry => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {field("amountJod") ? (
        <label className="micro-field">
          <span>{field("amountJod")!.label} (إلزامي)</span>
          <input
            type="text"
            inputMode="decimal"
            pattern="[0-9]*[.]?[0-9]{0,2}"
            value={value("amountJod")}
            onChange={event => setValues({ ...values, amountJod: event.target.value })}
          />
        </label>
      ) : null}
      {field("occurredOn") ? (
        <label className="micro-field">
          <span>{field("occurredOn")!.label} (إلزامي)</span>
          <input
            type="date"
            value={value("occurredOn")}
            onChange={event => setValues({ ...values, occurredOn: event.target.value })}
          />
        </label>
      ) : null}
      {field("note") ? (
        <label className="micro-field">
          <span>{field("note")!.label} (إلزامي)</span>
          <input
            type="text"
            value={value("note")}
            onChange={event => setValues({ ...values, note: event.target.value })}
          />
        </label>
      ) : null}
      {field("counterparty") ? (
        <label className="micro-field">
          <span>{field("counterparty")!.label}</span>
          <input
            type="text"
            value={value("counterparty")}
            onChange={event => setValues({ ...values, counterparty: event.target.value })}
          />
        </label>
      ) : null}
      {error ? (
        <p className="micro-field-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="micro-form-actions">
        <Button action="commit" disabled={busy || !requiredComplete} onClick={() => void confirm()}>
          تسجيل الحدث عبر المسار المالي المعتمد
        </Button>
        <Button action="quiet" onClick={onDismissed}>
          إلغاء (لا يُرسَل شيء)
        </Button>
      </div>
    </div>
  );
}

/* ── delivery-booking ───────────────────────────────────────────────────── */

function DeliveryBookingDraftCard({
  draft,
  session,
  onDismissed,
}: {
  draft: AskDraftProposal;
  session: NetworkSession;
  onDismissed: () => void;
}) {
  const [, navigate] = useLocation();
  /* قيم البطاقة تبدأ من قيم المسودة المقترحة (الفارغة تبقى فارغة) —
   * التحرير حر قبل التأكيد والإلغاء ممكن دائمًا ولا يكتب شيئًا. */
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const field of draft.fields) {
      initial[field.name] = field.value === null || field.value === undefined ? "" : String(field.value);
    }
    return initial;
  });
  const [driverProfileId, setDriverProfileId] = useState("");
  const [drivers, setDrivers] = useState<{ driverProfileId: string; displayName: string }[] | null>(null);
  const [driversFailed, setDriversFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ id: string } | null>(null);

  useEffect(() => {
    let active = true;
    setDrivers(null);
    setDriversFailed(false);
    fetchDriverDirectory()
      .then(result => {
        if (!active) return;
        setDrivers(result.drivers);
      })
      .catch(() => {
        if (active) setDriversFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const field = (name: string) => draft.fields.find(entry => entry.name === name);
  const value = (name: string) => values[name] ?? "";

  const needType = value("needType");
  const pricingMode = value("pricingMode");
  const goodsBooking = needType === "deliver_to_customer" || needType === "fetch_ready_goods";

  const requiredComplete =
    driverProfileId !== "" &&
    needType !== "" &&
    value("pickupGovernorate") !== "" &&
    value("dropoffGovernorate") !== "" &&
    (!goodsBooking ||
      (value("loadClass") !== "" && value("weightBand") !== "" && value("pieceCount") !== "")) &&
    pricingMode !== "" &&
    (pricingMode !== "prepriced" || value("offeredFareJod") !== "");

  async function confirm(): Promise<void> {
    const workspaceId = session.workspaces?.[0]?.id;
    if (!workspaceId) {
      setError("لا يوجد مشروع نشط لهذا الحساب — أنشئ مشروعك أولًا.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      /* §5.4: المسار الكنوني نفسه — خدمة إنشاء الحجز القياسية بمفتاح
       * عملية ثابت، والنجاح يظهر فقط بعد قبول الخادم (201). */
      const result = await createDeliveryRequest({
        driverProfileId,
        needType: needType as "deliver_to_customer" | "fetch_ready_goods",
        pricingMode: pricingMode as "prepriced" | "quote_request",
        ...(pricingMode === "prepriced"
          ? { offeredFareMinor: String(Math.round(Number(value("offeredFareJod")) * 100)) }
          : {}),
        ...(goodsBooking
          ? {
              loadClass: value("loadClass") as "small" | "medium" | "large" | "extra_large",
              weightBand: value("weightBand") as "under_10kg" | "10_to_50kg" | "over_50kg",
              pieceCount: Number(value("pieceCount")),
            }
          : {}),
        payload: {
          pickup: { governorate: value("pickupGovernorate") },
          dropoff: { governorate: value("dropoffGovernorate") },
          ...(value("scheduleDate") !== "" ? { schedule: { date: value("scheduleDate") } } : {}),
        },
        workspaceId,
        idempotencyKey: newIdempotencyKey(),
      });
      setBusy(false);
      setSaved({ id: result.request.id });
    } catch (cause) {
      setBusy(false);
      /* فشل الخادم = لا كتابة ولا نجاح كاذب — أعد المحاولة أو عدّل. */
      setError(
        cause instanceof ApiError ? cause.message : "تعذر إنشاء المسودة الآن — لم يُحفظ شيء. أعد المحاولة.",
      );
    }
  }

  if (saved !== null) {
    return (
      <div className="micro-ask-draft" data-testid="ask-draft-saved">
        <p role="status">أُنشئت مسودة الحجز بعد قبول الخادم — أكمل بياناتها وأرسلها من صفحتها الطبيعية.</p>
        <div className="micro-form-actions">
          <Button action="commit" onClick={() => navigate(`/delivery/booking/${saved.id}`)}>
            افتح صفحة الحجز
          </Button>
          <Button action="quiet" onClick={onDismissed}>
            إغلاق
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="micro-ask-draft" data-testid="ask-draft-card">
      <p className="micro-overline">مسودة مقترحة — ليست محفوظة</p>
      <h3>{draft.title}</h3>
      <p className="micro-ask-draft-note">
        أكمل الحقول بنفسك — القيم التي لم تذكرها في سؤالك بقيت فارغة عمدًا، والتأكيد ينشئ مسودة الحجز عبر
        المسار المعتمد نفسه ثم تكملها من صفحتها.
      </p>
      <label className="micro-field">
        <span>السائق (إلزامي — تختاره بنفسك)</span>
        {driversFailed ? (
          <span className="micro-field-error" role="alert">
            تعذر تحميل قائمة السائقين — أعد المحاولة.
          </span>
        ) : drivers === null ? (
          <span role="status">جارٍ تحميل السائقين…</span>
        ) : (
          <select value={driverProfileId} onChange={event => setDriverProfileId(event.target.value)}>
            <option value="">— اختر السائق —</option>
            {drivers.map(driver => (
              <option key={driver.driverProfileId} value={driver.driverProfileId}>
                {driver.displayName}
              </option>
            ))}
          </select>
        )}
      </label>
      {field("needType") ? (
        <label className="micro-field">
          <span>
            {field("needType")!.label}
            {field("needType")!.required ? " (إلزامي)" : ""}
          </span>
          <select
            value={value("needType")}
            onChange={event => setValues({ ...values, needType: event.target.value })}
          >
            <option value="">— غير محدد —</option>
            {NEED_TYPES.map(entry => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {field("pickupGovernorate") ? (
        <label className="micro-field">
          <span>{field("pickupGovernorate")!.label} (إلزامي)</span>
          <select
            value={value("pickupGovernorate")}
            onChange={event => setValues({ ...values, pickupGovernorate: event.target.value })}
          >
            <option value="">— غير محدد —</option>
            {JORDAN_GOVERNORATES.map(gov => (
              <option key={gov} value={gov}>
                {gov}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {field("dropoffGovernorate") ? (
        <label className="micro-field">
          <span>{field("dropoffGovernorate")!.label} (إلزامي)</span>
          <select
            value={value("dropoffGovernorate")}
            onChange={event => setValues({ ...values, dropoffGovernorate: event.target.value })}
          >
            <option value="">— غير محدد —</option>
            {JORDAN_GOVERNORATES.map(gov => (
              <option key={gov} value={gov}>
                {gov}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {goodsBooking && field("loadClass") ? (
        <label className="micro-field">
          <span>{field("loadClass")!.label} (إلزامي)</span>
          <select
            value={value("loadClass")}
            onChange={event => setValues({ ...values, loadClass: event.target.value })}
          >
            <option value="">— غير محدد —</option>
            {LOAD_CLASSES.map(entry => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {goodsBooking && field("weightBand") ? (
        <label className="micro-field">
          <span>{field("weightBand")!.label} (إلزامي)</span>
          <select
            value={value("weightBand")}
            onChange={event => setValues({ ...values, weightBand: event.target.value })}
          >
            <option value="">— غير محدد —</option>
            {WEIGHT_BANDS.map(entry => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {goodsBooking && field("pieceCount") ? (
        <label className="micro-field">
          <span>{field("pieceCount")!.label} (إلزامي)</span>
          <input
            type="number"
            min={1}
            max={200}
            inputMode="numeric"
            value={value("pieceCount")}
            onChange={event => setValues({ ...values, pieceCount: event.target.value })}
            placeholder="غير محدد"
          />
        </label>
      ) : null}
      {field("scheduleDate") ? (
        <label className="micro-field">
          <span>{field("scheduleDate")!.label}</span>
          <input
            type="date"
            value={value("scheduleDate")}
            onChange={event => setValues({ ...values, scheduleDate: event.target.value })}
          />
        </label>
      ) : null}
      {field("pricingMode") ? (
        <label className="micro-field">
          <span>{field("pricingMode")!.label} (إلزامي)</span>
          <select
            value={value("pricingMode")}
            onChange={event => setValues({ ...values, pricingMode: event.target.value })}
          >
            <option value="">— غير محدد —</option>
            {PRICING_MODES.map(entry => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {pricingMode === "prepriced" && field("offeredFareJod") ? (
        <label className="micro-field">
          <span>{field("offeredFareJod")!.label} (إلزامي)</span>
          <input
            type="decimal"
            inputMode="decimal"
            value={value("offeredFareJod")}
            onChange={event => setValues({ ...values, offeredFareJod: event.target.value })}
            placeholder="غير محدد — أدخله بنفسك"
          />
        </label>
      ) : null}
      {draft.fields
        .filter(
          entry =>
            ![
              "needType",
              "pickupGovernorate",
              "dropoffGovernorate",
              "loadClass",
              "weightBand",
              "pieceCount",
              "scheduleDate",
              "pricingMode",
              "offeredFareJod",
            ].includes(entry.name),
        )
        .map(entry => (
          <label className="micro-field" key={entry.name}>
            <span>
              {entry.label}
              {entry.required ? " (إلزامي)" : ""}
            </span>
            <input
              type="text"
              value={value(entry.name)}
              onChange={event => setValues({ ...values, [entry.name]: event.target.value })}
              placeholder="غير محدد"
            />
          </label>
        ))}
      <div className="micro-form-actions">
        <Button action="quiet" disabled={busy} onClick={onDismissed}>
          إلغاء المسودة
        </Button>
        <Button action="commit" disabled={busy || !requiredComplete} onClick={() => void confirm()}>
          {busy ? "جارٍ الإنشاء…" : "أنشئ مسودة الحجز"}
        </Button>
      </div>
      {!requiredComplete ? (
        <p className="micro-ask-draft-hint" role="status">
          أكمل كل الحقول الإلزامية لتفعيل التأكيد — المسودة لا تُحفظ قبل تأكيدك الصريح.
        </p>
      ) : null}
      {error ? (
        <p className="micro-field-error" role="alert">
          {error}
        </p>
      ) : null}
      <p className="micro-ask-draft-meta">
        {needType ? `النوع: ${labelFor(NEED_TYPES, needType)}` : null}
        {pricingMode ? ` · التسعير: ${labelFor(PRICING_MODES, pricingMode)}` : null}
      </p>
    </div>
  );
}
