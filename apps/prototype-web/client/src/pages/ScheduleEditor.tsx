/* مبدأ Micro: الموعد حالة تشغيلية مستقلة، ويُعرض يومه بوضوح دون تغيير أثر المال أو التاريخ. */
import { ArrowRight, CalendarClock, CalendarPlus, Clock3, History, Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useReturnPath } from "@/app/useReturnNavigation";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { STALE_CONFLICT_NOTE, STALE_RELOAD_ACTION_LABEL, STALE_RELOADED_NOTE } from "@/app/resultFeedback";
import { useUnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import { LocalDateField } from "@/components/forms/LocalDateField";
import { IntegerValue, LocalDateValue, TimeValue } from "@/components/presentation/DisplayValue";
import type { ScheduleEntry } from "@/storage/local/types";

type EditorState = "loading" | "ready" | "error";
type ScheduleFormValues = { date: string; time: string; duration: string; reason: string };
const eventLabel: Record<string, string> = {
  created: "تسجيل الموعد",
  postponed: "تأجيل الموعد",
  timing_changed: "تعديل الوقت أو المدة",
  completed: "إكمال الموعد",
  cancelled: "إلغاء الموعد",
};
const timing = (time: string | null, duration: number | null) =>
  time && duration ? (
    <>
      <TimeValue value={time} /> · <IntegerValue value={duration} className="micro-inline-number" /> دقيقة
    </>
  ) : (
    "وقت غير محدد"
  );

function equalScheduleValues(left: ScheduleFormValues | null, right: ScheduleFormValues | null) {
  return Boolean(
    left &&
    right &&
    left.date === right.date &&
    left.time === right.time &&
    left.duration === right.duration &&
    left.reason === right.reason,
  );
}

export default function ScheduleEditor() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  /* المجموعة ١ (Scope A): الرجوع يعود للمصدر (?from) مع بديل قانوني موثّق. */
  const returnPath = useReturnPath();
  const { schedules, notifyDataChanged, dataVersion } = usePrototypeServices();
  const [phase, setPhase] = useState<EditorState>("loading");
  const [schedule, setSchedule] = useState<ScheduleEntry | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("");
  const [reason, setReason] = useState("");
  /* التحصين الكامل (المجموعة ٣): ملاحظة مُطبوعة النبرة — الفشل خطأ ظاهر
   * بـ role=alert لا نجاحًا مزيفًا بقراءة بادئة النص. */
  const [feedback, setFeedback] = useState<{ tone: "error" | "success" | "info"; text: string } | null>(null);
  /* عقد §31 (المجموعة ٢): storage_stale المطبوع يحرّك رحلة الاسترجاع —
   * إعادة قراءة ثم قرار واعٍ؛ لا تكرار أعمى للقيم القديمة. */
  const [staleConflict, setStaleConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const [postponing, setPostponing] = useState(false);
  const initialValuesRef = useRef<ScheduleFormValues | null>(null);
  useEffect(() => {
    let active = true;
    schedules.get(id).then(result => {
      if (!active) return;
      if (!result.ok) {
        setPhase("error");
        return;
      }
      const loadedValues = {
        date: result.value.scheduledFor,
        time: result.value.scheduledTime ?? "",
        duration: result.value.durationMinutes?.toString() ?? "",
        reason: "",
      };
      setSchedule(result.value);
      setDate(loadedValues.date);
      setTime(loadedValues.time);
      setDuration(loadedValues.duration);
      setReason(loadedValues.reason);
      initialValuesRef.current = loadedValues;
      setPhase("ready");
    });
    return () => {
      active = false;
    };
  }, [dataVersion, id, schedules]);
  /* رحلة الاسترجاع (§31): إعادة قراءة الموعد الحالي عبر مسار القراءة
   * المعتمد نفسه — قيم المستخدم غير المحفوظة تبقى في الحقول كما هي. */
  async function reloadCurrentSchedule(): Promise<void> {
    const result = await schedules.get(id);
    if (!result.ok) {
      setFeedback({ tone: "error", text: result.message });
      return;
    }
    setStaleConflict(false);
    setSchedule(result.value);
    initialValuesRef.current = {
      date: result.value.scheduledFor,
      time: result.value.scheduledTime ?? "",
      duration: result.value.durationMinutes?.toString() ?? "",
      reason: "",
    };
    setFeedback({ tone: "info", text: STALE_RELOADED_NOTE });
  }
  const currentValues = { date, time, duration, reason };
  const isDirty = Boolean(
    initialValuesRef.current && !equalScheduleValues(currentValues, initialValuesRef.current),
  );
  async function persistTiming(): Promise<boolean> {
    if (!schedule) return false;
    setFeedback(null);
    setSaving(true);
    const result = await schedules.updateTiming(schedule.id, {
      scheduledFor: date,
      scheduledTime: time || null,
      durationMinutes: duration ? Number(duration) : null,
      reason,
    });
    setSaving(false);
    if (!result.ok) {
      if (result.code === "storage_stale") setStaleConflict(true);
      setFeedback({ tone: "error", text: result.message });
      return false;
    }
    const nextValues = {
      date: result.value.scheduledFor,
      time: result.value.scheduledTime ?? "",
      duration: result.value.durationMinutes?.toString() ?? "",
      reason: "",
    };
    setSchedule(result.value);
    setDate(nextValues.date);
    setTime(nextValues.time);
    setDuration(nextValues.duration);
    setReason(nextValues.reason);
    initialValuesRef.current = nextValues;
    notifyDataChanged();
    setStaleConflict(false);
    setFeedback(
      result.value.status === "postponed"
        ? { tone: "success", text: "تم حفظ التأجيل محليًا مع سبب وتاريخ الموعد السابق." }
        : { tone: "success", text: "تم حفظ وقت الموعد ومدته محليًا مع سجل التعديل." },
    );
    return true;
  }
  const requestNavigation = useUnsavedChangesGuard({ isDirty, onSave: persistTiming });
  /* F-080: فعل «أجّل» — غلاف راحة معلن: تأجيل الموعد يومًا واحدًا بسببه الموثق.
   * لا يخترع سببًا؛ يسجّل ما فُعل بالضبط، ومن أراد تاريخًا أو سببًا آخر يستخدم النموذج. */
  async function postponeOneDay() {
    if (!schedule) return;
    setFeedback(null);
    setPostponing(true);
    const nextDay = new Date(`${schedule.scheduledFor}T12:00:00.000Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const result = await schedules.postpone(
      schedule.id,
      nextDay.toISOString().slice(0, 10),
      "تأجيل سريع يومًا واحدًا",
    );
    setPostponing(false);
    if (!result.ok) {
      if (result.code === "storage_stale") setStaleConflict(true);
      setFeedback({ tone: "error", text: result.message });
      return;
    }
    setSchedule(result.value);
    setDate(result.value.scheduledFor);
    initialValuesRef.current = {
      date: result.value.scheduledFor,
      time: result.value.scheduledTime ?? "",
      duration: result.value.durationMinutes?.toString() ?? "",
      reason: "",
    };
    notifyDataChanged();
    setStaleConflict(false);
    setFeedback({
      tone: "success",
      text: "تم تأجيل الموعد يومًا واحدًا — التأجيل موثق في سجل الموعد.",
    });
  }
  if (phase === "loading")
    return (
      <div className="micro-route-loading" role="status">
        جارٍ فتح الموعد…
      </div>
    );
  if (phase === "error" || !schedule)
    return (
      <section className="micro-page micro-not-found">
        <h1>الموعد غير متاح محليًا</h1>
        <p>ارجع إلى جدول المواعيد وأعد المحاولة.</p>
        <button
          className="micro-button micro-button-primary"
          type="button"
          onClick={() => navigate("/schedule")}
        >
          المواعيد
        </button>
      </section>
    );
  return (
    <section className="micro-page micro-schedule-page">
      <button className="micro-back-button" type="button" onClick={() => requestNavigation(returnPath)}>
        <ArrowRight aria-hidden="true" /> المواعيد
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">تعديل تشغيلي</span>
        <h1>وقت ومدة الموعد</h1>
        <p>
          تعديل الموعد لا يغير حالة الطلب أو السعر أو القبض أو الدين. اليوم الجديد يحتاج سببًا؛ الوقت والمدة
          اختياريان لكنهما زوج واحد.
        </p>
      </div>
      <section className="micro-decision-card">
        <span>الموعد المسجل</span>
        <strong>
          <LocalDateValue value={schedule.scheduledFor} />
        </strong>
        <p>
          {timing(schedule.scheduledTime, schedule.durationMinutes)}
          {schedule.status === "postponed" && schedule.postponeReason
            ? ` · سبب التأجيل الأخير: ${schedule.postponeReason}`
            : ""}
        </p>
      </section>
      <section className="micro-form-card">
        <LocalDateField label="يوم الموعد" value={date} onChange={event => setDate(event.target.value)} />
        <div className="micro-field-grid">
          <label className="micro-field">
            <span>
              الوقت <small>اختياري</small>
            </span>
            <input type="time" value={time} onChange={event => setTime(event.target.value)} />
          </label>
          <label className="micro-field">
            <span>
              المدة <small>اختيارية</small>
            </span>
            <select value={duration} onChange={event => setDuration(event.target.value)}>
              <option value="">وقت غير محدد</option>
              <option value="15">15 دقيقة</option>
              <option value="30">30 دقيقة</option>
              <option value="45">45 دقيقة</option>
              <option value="60">60 دقيقة</option>
              <option value="90">90 دقيقة</option>
              <option value="120">120 دقيقة</option>
              <option value="180">180 دقيقة</option>
              <option value="240">240 دقيقة</option>
              <option value="360">360 دقيقة</option>
              <option value="480">480 دقيقة</option>
              <option value="600">600 دقيقة</option>
              <option value="720">720 دقيقة</option>
            </select>
          </label>
        </div>
        <label className="micro-field">
          <span>
            سبب التعديل <small>مطلوب عند تغيير اليوم</small>
          </span>
          <textarea
            value={reason}
            onChange={event => setReason(event.target.value)}
            placeholder="مثال: تأخر تأكيد العميل أو تغير موعد التوصيل"
          />
        </label>
        <p className="micro-schedule-editor-note">
          <Clock3 aria-hidden="true" /> وقت غير محدد لا يحسب كأنه صفر ولا يدخل في تحذير التعارض أو ضغط القدرة.
        </p>
        {staleConflict ? (
          <section className="micro-cancel-panel" data-testid="stale-conflict-card">
            <p className="micro-warning-copy" role="alert">
              {STALE_CONFLICT_NOTE}
            </p>
            <div className="micro-form-actions micro-contextual-actions">
              <button
                className="micro-button micro-button-secondary"
                type="button"
                disabled={saving || postponing}
                onClick={() => {
                  void reloadCurrentSchedule();
                }}
              >
                {STALE_RELOAD_ACTION_LABEL}
              </button>
            </div>
          </section>
        ) : null}
        {feedback ? (
          <p
            className={
              feedback.tone === "error"
                ? "micro-field-error"
                : feedback.tone === "info"
                  ? "micro-local-truth"
                  : "micro-save-note"
            }
            role={feedback.tone === "error" ? "alert" : "status"}
          >
            {feedback.text}
          </p>
        ) : null}
        <div className="micro-form-actions micro-sticky-save">
          <button
            className="micro-button micro-button-primary micro-save-cost"
            type="button"
            disabled={saving}
            onClick={() => {
              void persistTiming();
            }}
          >
            <Save aria-hidden="true" />
            {saving ? "جارٍ حفظ الموعد…" : "حفظ الموعد"}
          </button>
        </div>
        {schedule.status === "scheduled" || schedule.status === "postponed" ? (
          <button
            className="micro-button micro-button-secondary"
            type="button"
            disabled={postponing || saving}
            onClick={() => {
              void postponeOneDay();
            }}
          >
            <CalendarPlus aria-hidden="true" />
            {postponing ? "جارٍ التأجيل…" : "أجّل يومًا"}
          </button>
        ) : null}
      </section>
      <section className="micro-form-card">
        <h2 className="micro-section-title">
          <History aria-hidden="true" /> سجل الموعد
        </h2>
        <div className="micro-event-list">
          {schedule.events.map(event => (
            <div key={event.id}>
              <span className="micro-event-dot" />
              <p>
                <b>{eventLabel[event.type] ?? "تحديث الموعد"}</b>
                <small>
                  <LocalDateValue value={event.scheduledFor} />
                  {event.previousScheduledFor ? (
                    <>
                      {" "}
                      · كان اليوم: <LocalDateValue value={event.previousScheduledFor} />
                    </>
                  ) : null}{" "}
                  · {timing(event.scheduledTime, event.durationMinutes)}
                  {event.previousScheduledTime || event.previousDurationMinutes ? (
                    <> · كان: {timing(event.previousScheduledTime, event.previousDurationMinutes)}</>
                  ) : null}
                  {event.reason ? ` · ${event.reason}` : ""}
                </small>
              </p>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
