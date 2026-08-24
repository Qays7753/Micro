import { ArrowLeft, CalendarClock, CalendarDays, ChevronLeft, ChevronRight, CircleAlert, Clock3, Timer, Repeat2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import type { MonthOverview, ScheduleDay, ScheduleOverview, ScheduledOrder } from "@/application/scheduling/scheduleService";
import type { RecurrenceView } from "@/application/scheduling/recurrenceService";
import { buildCapacityDecisionViewModel } from "@/application/scheduling/capacityDecisionViewModel";
import { DecisionPanel } from "@/components/presentation/DecisionPanel";
import { IntegerValue, LocalDateValue, MonthValue, TimeValue } from "@/components/presentation/DisplayValue";
import { formatLocalDate, formatMonthLabel } from "@/presentation/formatters";

 type ScheduleState = { phase: "loading" } | { phase: "error"; message: string } | { phase: "ready"; overview: ScheduleOverview; month: MonthOverview; recurrences: readonly RecurrenceView[] };
const orderStatus: Record<string, string> = { provisional_agreement: "اتفاق مبدئي", confirmed: "تم التأكيد", in_progress: "قيد التنفيذ", ready: "جاهز للتسليم", delivered: "تم التسليم", settled: "مغلق" };
const weekdayLabels = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const dateLabel = (date: string) => formatLocalDate(date) ?? "غير متاح";
const monthLabel = (month: string) => formatMonthLabel(month);
const timingLabel = (schedule: ScheduledOrder["schedule"]) => schedule.scheduledTime && schedule.durationMinutes ? <><TimeValue value={schedule.scheduledTime} /> · <IntegerValue value={schedule.durationMinutes} className="micro-inline-number" /> دقيقة</> : "وقت غير محدد";
const capacityOptions = Array.from({ length: 48 }, (_, index) => (index + 1) * 15);
const frequencyLabel = (frequency: "weekly" | "monthly") => frequency === "weekly" ? "أسبوعي" : "شهري";

function localParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Amman", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return { year: part("year"), month: part("month"), day: part("day") };
}

const currentLocalMonth = () => { const { year, month } = localParts(); return `${year}-${month}`; };
const currentLocalDate = () => { const { year, month, day } = localParts(); return `${year}-${month}-${day}`; };
const shiftMonth = (month: string, offset: number) => { const date = new Date(`${month}-15T12:00:00.000Z`); date.setUTCMonth(date.getUTCMonth() + offset); return date.toISOString().slice(0, 7); };
const monthDayNumber = (date: string) => formatLocalDate(date)?.slice(0, 2) ?? "--";
const monthFirstDayOffset = (month: string) => new Date(`${month}-01T12:00:00.000Z`).getUTCDay();

export default function Schedule() {
  const [, navigate] = useLocation();
  const { schedules, recurrences, notifyDataChanged, dataVersion } = usePrototypeServices();
  const [selectedMonth, setSelectedMonth] = useState(currentLocalMonth);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState<ScheduleState>({ phase: "loading" });
  const [capacityChoice, setCapacityChoice] = useState("");
  const [capacityMessage, setCapacityMessage] = useState<string | null>(null);
  const [savingCapacity, setSavingCapacity] = useState(false);

  useEffect(() => {
    let active = true;
    setState({ phase: "loading" });
    Promise.all([schedules.overview(), schedules.monthOverview(selectedMonth), recurrences.list()]).then(([overviewResult, monthResult, recurrenceResult]) => {
      if (!active) return;
      if (!overviewResult.ok || !monthResult.ok || !recurrenceResult.ok) {
        const message = !overviewResult.ok ? overviewResult.message : !monthResult.ok ? monthResult.message : !recurrenceResult.ok ? recurrenceResult.message : "تعذر قراءة جدول المواعيد المحلي.";
        setState({ phase: "error", message });
        return;
      }
      setState({ phase: "ready", overview: overviewResult.value, month: monthResult.value, recurrences: recurrenceResult.value });
      setCapacityChoice(overviewResult.value.dailyCapacityMinutes?.toString() ?? "");
    }).catch(() => { if (active) setState({ phase: "error", message: "تعذر قراءة جدول المواعيد المحلي." }); });
    return () => { active = false; };
  }, [dataVersion, recurrences, reloadToken, schedules, selectedMonth]);

  async function saveCapacity() {
    setCapacityMessage(null);
    setSavingCapacity(true);
    const result = await schedules.setDailyCapacity(capacityChoice ? Number(capacityChoice) : null);
    setSavingCapacity(false);
    if (!result.ok) { setCapacityMessage(result.message); return; }
    notifyDataChanged();
    setCapacityMessage(result.value === null ? "لم تعد سعة يومية محددة؛ سيعرض Micro الوقت المسجل فقط." : `تم حفظ سعة يومية معلنة: ${result.value} دقيقة.`);
  }

  function changeMonth(offset: number) {
    setSelectedDate(null);
    setSelectedMonth((month) => shiftMonth(month, offset));
  }

  if (state.phase === "loading") return <div className="micro-route-loading" role="status">جارٍ تجهيز قراءة الشهر…</div>;
  if (state.phase === "error") return <section className="micro-page micro-not-found"><h1>تعذر تحميل جدول المواعيد</h1><p>{state.message} لم يتم تغيير أي موعد.</p><div className="micro-form-actions"><button className="micro-button micro-button-primary" type="button" onClick={() => setReloadToken((token) => token + 1)}>إعادة المحاولة</button><button className="micro-button micro-button-secondary" type="button" onClick={() => navigate("/orders")}>الطلبات</button></div></section>;

  const { overview, month, recurrences: recurrenceViews } = state;
  const total = overview.overdue.length + overview.today.length + overview.upcoming.length;
  const weekWithWork = overview.week.filter((day) => day.items.length > 0);
  const decisionDay = (selectedDate ? month.days.find((day) => day.date === selectedDate) : null) ?? overview.week[0];
  const recurrenceSources = Array.from(new Map([...overview.today, ...overview.upcoming].map((item) => [item.schedule.id, item])).values());
  return <section className="micro-page micro-schedule-page">
    <button className="micro-back-button" type="button" onClick={() => navigate("/")}><ArrowLeft aria-hidden="true" /> مشروعي الآن</button>
    <div className="micro-page-heading"><span className="micro-overline">التنظيم التشغيلي</span><h1>جدول المواعيد</h1><p>اقرأ التزامات الطلبات المسجلة في اليوم أو الأسبوع أو الشهر. الوقت والمدة يدعمان تحذيرًا فقط عندما تعرفهما؛ لا يرسل هذا الإصدار تذكيرًا خارجيًا.</p></div>
    <MonthSchedulePanel month={month} selectedDate={selectedDate} onChangeMonth={changeMonth} onSelectDate={setSelectedDate} onOpen={(item) => navigate(`/schedule/${item.schedule.id}`)} />
    {decisionDay ? <CapacityDecisionSurface day={decisionDay} capacityMinutes={overview.dailyCapacityMinutes} /> : null}
    <RecurrencePanel service={recurrences} sources={recurrenceSources} views={recurrenceViews} onChanged={notifyDataChanged} />
    <section className="micro-schedule-capacity"><div><Timer aria-hidden="true" /><div><span className="micro-overline">قدرة اليوم</span><h2>ما المدة التي تستطيع الالتزام بها؟</h2><p>{overview.dailyCapacityMinutes === null ? "غير محددة الآن؛ لن نحكم على ضغط اليوم." : `السعة المعلنة: ${overview.dailyCapacityMinutes} دقيقة. التحذير لا يمنعك من حفظ الموعد.`}</p></div></div><label className="micro-field"><span>سعة يومية اختيارية</span><select value={capacityChoice} onChange={(event) => setCapacityChoice(event.target.value)} aria-label="سعة اليوم بالدقائق"><option value="">غير محددة الآن</option>{capacityOptions.map((minutes) => <option key={minutes} value={minutes}>{minutes} دقيقة</option>)}</select></label>{capacityMessage ? <p className={capacityMessage.startsWith("تم ") || capacityMessage.startsWith("لم ") ? "micro-save-note" : "micro-field-error"} role="status">{capacityMessage}</p> : null}<button className="micro-button micro-button-secondary" type="button" disabled={savingCapacity} onClick={saveCapacity}>{savingCapacity ? "جارٍ حفظ السعة…" : "حفظ سعة اليوم"}</button></section>
    {overview.overdue.length > 0 ? <ScheduleSection title="متأخر" description="هذه الطلبات تجاوزت موعدها المسجل وتحتاج قرارًا." tone="warning" items={overview.overdue} onOpen={(item) => navigate(`/schedule/${item.schedule.id}`)} /> : null}
    {overview.today.length > 0 ? <ScheduleSection title="اليوم" description="طلبات موعدها اليوم حسب توقيت عمّان." tone="accent" items={overview.today} onOpen={(item) => navigate(`/schedule/${item.schedule.id}`)} /> : null}
    {overview.upcoming.length > 0 ? <ScheduleSection title="قادم" description="رتب العمل القادم قبل أن يصبح متأخرًا." tone="support" items={overview.upcoming} onOpen={(item) => navigate(`/schedule/${item.schedule.id}`)} /> : null}
    {total === 0 ? <section className="micro-empty-state"><span className="micro-empty-symbol"><CalendarDays aria-hidden="true" /></span><span className="micro-status-chip">لا توجد مواعيد تشغيلية</span><h2>لا توجد طلبات تحتاج موعدًا الآن</h2><p>عند تثبيت اتفاق جديد ينشئ Micro موعد تسليم محليًا قابلًا للمتابعة.</p><button className="micro-button micro-button-primary" type="button" onClick={() => navigate("/orders/new")}>بدء طلب</button></section> : null}
    {weekWithWork.length > 0 ? <section className="micro-week-agenda" aria-label="خطة الأيام السبعة"><div className="micro-week-heading"><div><span className="micro-overline">الأيام السبعة القادمة</span><h2>أين يوجد ضغط فعلي في وقتك المسجل؟</h2></div><Clock3 aria-hidden="true" /></div><div className="micro-week-list">{weekWithWork.map((day) => <WeekDay key={day.date} day={day} onOpen={(item) => navigate(`/schedule/${item.schedule.id}`)} />)}</div></section> : null}
    {overview.completedOrClosed > 0 ? <p className="micro-schedule-closed-note">يوجد {overview.completedOrClosed} موعدًا لطلبات أغلقت أو اكتملت عند التسليم ولم تعد تحتاج متابعة تشغيلية.</p> : null}
  </section>;
}

function CapacityDecisionSurface({ day, capacityMinutes }: { day: ScheduleDay; capacityMinutes: number | null }) {
  const decision = buildCapacityDecisionViewModel(day, capacityMinutes);
  return <section className="micro-capacity-decision" aria-label={`قرار السعة ليوم ${dateLabel(day.date)}`}>
    <DecisionPanel label={`${decision.label} · ${dateLabel(day.date)}`} truth={decision.truth} nextAction={decision.nextAction} tone={decision.tone} />
    {day.conflictCount > 0 ? <p className="micro-month-warning"><CircleAlert aria-hidden="true" />التعارض مستقل عن قرار السعة: يوجد تعارض في {day.conflictCount} موعد؛ راجع الموعد القائم دون اعتبار ذلك رفضًا أو ضمانًا للتوفر.</p> : null}
  </section>;
}

function RecurrencePanel({ service, sources, views, onChanged }: { service: import("@/application/scheduling/recurrenceService").ScheduleRecurrenceService; sources: readonly ScheduledOrder[]; views: readonly RecurrenceView[]; onChanged: () => void }) {
  const [sourceId, setSourceId] = useState("");
  const [frequency, setFrequency] = useState<"weekly" | "monthly">("weekly");
  const [count, setCount] = useState("3");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const selectedSourceId = sourceId || sources[0]?.schedule.id || "";

  async function create() {
    setMessage(null); setSaving(true);
    const result = await service.create({ sourceScheduleId: selectedSourceId, frequency, occurrenceCount: Number(count) });
    setSaving(false);
    if (!result.ok) { setMessage(result.message); return; }
    const created = result.value.created.length; const skipped = result.value.skipped.length;
    setMessage(`تم حفظ قالب ${frequencyLabel(result.value.recurrence.frequency)}. أُنشئت ${created} ظهورات مستقلة${skipped > 0 ? `، وتجاوزنا ${skipped} لأن التاريخ موجود` : ""}.`);
    onChanged();
  }

  async function cancel(id: string) {
    setMessage(null); setSaving(true);
    const result = await service.cancel(id, cancelReason);
    setSaving(false);
    if (!result.ok) { setMessage(result.message); return; }
    setCancellingId(null); setCancelReason(""); setMessage("تم إيقاف الظهورات المستقبلية لهذا القالب؛ الظهورات السابقة محفوظة."); onChanged();
  }

  return <section className="micro-recurrence-panel" aria-labelledby="recurrence-title"><div className="micro-recurrence-heading"><div><span className="micro-overline">تكرار محلي محدود</span><h2 id="recurrence-title">هل يتكرر هذا الموعد بنمط واضح؟</h2><p>ينشئ Micro من 1 إلى 12 ظهورًا مستقبليًا فقط. لا ينشئ طلبًا أو حجزًا أو تذكيرًا، ولا يغير الموعد الأصلي.</p></div><Repeat2 aria-hidden="true" /></div>{sources.length === 0 ? <div className="micro-recurrence-empty"><CircleAlert aria-hidden="true" /><p>أنشئ أو ثبّت موعدًا نشطًا أولًا حتى يمكن اختيار مصدر للتكرار.</p></div> : <div className="micro-form-card"><label className="micro-field"><span>الموعد المصدر</span><select value={selectedSourceId} onChange={(event) => setSourceId(event.target.value)} aria-label="الموعد المصدر للتكرار">{sources.map((item) => <option key={item.schedule.id} value={item.schedule.id}>{item.order.order.itemName} · {formatLocalDate(item.schedule.scheduledFor) ?? "غير متاح"}</option>)}</select></label><div className="micro-field-grid"><label className="micro-field"><span>النمط</span><select value={frequency} onChange={(event) => setFrequency(event.target.value as "weekly" | "monthly")}><option value="weekly">أسبوعي</option><option value="monthly">شهري</option></select></label><label className="micro-field"><span>عدد الظهورات</span><select value={count} onChange={(event) => setCount(event.target.value)}>{Array.from({ length: 12 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value}</option>)}</select></label></div><p className="micro-recurrence-note"><CalendarDays aria-hidden="true" /> التكرار ينقل اليوم والوقت والمدة كما هي. الوقت غير المحدد يبقى غير محدد، والتعارض أو تجاوز السعة يظهران كتحذير فقط.</p><button className="micro-button micro-button-primary" type="button" disabled={saving || !selectedSourceId} onClick={create}>{saving ? "جارٍ حفظ القالب…" : "حفظ قالب التكرار"}</button></div>}{message ? <p className={message.startsWith("تم ") ? "micro-save-note" : "micro-field-error"} role="status">{message}</p> : null}{views.length > 0 ? <div className="micro-recurrence-list">{views.map((view) => <article className="micro-recurrence-card" key={view.recurrence.id}><div className="micro-recurrence-card-heading"><div><span className="micro-overline">{view.recurrence.status === "active" ? "قالب نشط" : "قالب موقوف"}</span><h3>{view.order?.order.itemName ?? "طلب غير متاح"}</h3><p>{frequencyLabel(view.recurrence.frequency)} · <IntegerValue value={view.recurrence.occurrenceCount} className="micro-inline-number" /> ظهورات · المصدر: {view.source ? <LocalDateValue value={view.source.scheduledFor} /> : "غير متاح"}</p></div>{view.recurrence.status === "active" ? <Repeat2 aria-label="قالب تكرار نشط" /> : <XCircle aria-label="قالب تكرار موقوف" />}</div><div className="micro-recurrence-appearances">{view.appearances.length > 0 ? view.appearances.map((appearance) => <span key={appearance.id}><b><LocalDateValue value={appearance.scheduledFor} /></b><small>{appearance.scheduledTime && appearance.durationMinutes ? <><TimeValue value={appearance.scheduledTime} /> · <IntegerValue value={appearance.durationMinutes} className="micro-inline-number" /> د</> : "وقت غير محدد"}</small></span>) : <span>لم تُنشأ ظهورات؛ راجع التواريخ المتجاوزة.</span>}</div>{view.recurrence.status === "active" ? cancellingId === view.recurrence.id ? <div className="micro-recurrence-cancel"><label className="micro-field"><span>سبب إيقاف المستقبل</span><textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="مثال: تغير نمط العمل" /></label><div className="micro-form-actions"><button className="micro-button micro-button-secondary" type="button" disabled={saving} onClick={() => cancel(view.recurrence.id)}>إيقاف الظهورات المستقبلية</button><button className="micro-button micro-button-quiet" type="button" disabled={saving} onClick={() => { setCancellingId(null); setCancelReason(""); }}>إلغاء</button></div></div> : <button className="micro-text-action" type="button" onClick={() => setCancellingId(view.recurrence.id)}>إيقاف الظهورات المستقبلية بسبب مكتوب</button> : <p className="micro-recurrence-cancelled">أوقفه المالك{view.recurrence.cancellationReason ? ` بسبب: ${view.recurrence.cancellationReason}` : ""}. الظهورات السابقة محفوظة.</p>}</article>)}</div> : null}</section>;
}

function MonthSchedulePanel({ month, selectedDate, onChangeMonth, onSelectDate, onOpen }: { month: MonthOverview; selectedDate: string | null; onChangeMonth: (offset: number) => void; onSelectDate: (date: string | null) => void; onOpen: (item: ScheduledOrder) => void }) {
  const selectedDay = month.days.find((day) => day.date === selectedDate) ?? null;
  return <section className="micro-month-panel" aria-labelledby="monthly-schedule-title"><div className="micro-month-heading"><div><span className="micro-overline">قراءة شهرية مشتقة</span><h2 id="monthly-schedule-title">{monthLabel(month.month)}</h2><p>من مواعيد الطلبات المحلية · توقيت عمّان</p></div><CalendarDays aria-hidden="true" /></div><div className="micro-month-navigation"><button className="micro-icon-button" type="button" aria-label="الشهر السابق" onClick={() => onChangeMonth(-1)}><ChevronRight aria-hidden="true" /></button><strong><MonthValue value={month.month} /></strong><button className="micro-icon-button" type="button" aria-label="الشهر التالي" onClick={() => onChangeMonth(1)}><ChevronLeft aria-hidden="true" /></button></div><dl className="micro-month-summary"><div><dt>مواعيد مسجلة</dt><dd><IntegerValue value={month.scheduledCount} /></dd></div><div><dt>دقائق معروفة</dt><dd><IntegerValue value={month.scheduledMinutes} /></dd></div><div><dt>وقت غير محدد</dt><dd><IntegerValue value={month.unknownTimingCount} /></dd></div><div><dt>متأخر ضمن الشهر</dt><dd><IntegerValue value={month.overdueCount} /></dd></div></dl>{month.scheduledCount === 0 ? <div className="micro-month-empty" role="status"><CircleAlert aria-hidden="true" /><div><strong>لا توجد مواعيد مسجلة لهذا الشهر</strong><p>هذا لا يعني أن الشهر متاح بالكامل؛ لا توجد التزامات تشغيلية مسجلة لقراءتها.</p></div></div> : null}<div className="micro-month-weekdays" aria-hidden="true">{weekdayLabels.map((label) => <span key={label}>{label}</span>)}</div><div className="micro-month-grid" role="grid" aria-label={`أيام ${monthLabel(month.month)}`}>{Array.from({ length: monthFirstDayOffset(month.month) }, (_, index) => <span className="micro-month-cell micro-month-cell-empty" aria-hidden="true" key={`leading-${index}`} />)}{month.days.map((day) => <MonthDayCell key={day.date} day={day} selected={selectedDate === day.date} today={day.date === currentLocalDate()} onSelect={() => onSelectDate(selectedDate === day.date ? null : day.date)} />)}</div>{selectedDay ? <MonthDayDetail day={selectedDay} onOpen={onOpen} /> : <p className="micro-month-prompt">اضغط على يوم لعرض مواعيده المسجلة دون فتح محرر أو تغيير السجل.</p>}</section>;
}

function MonthDayCell({ day, selected, today, onSelect }: { day: ScheduleDay; selected: boolean; today: boolean; onSelect: () => void }) { const knownTimes = [...new Set(day.items.flatMap((item) => item.schedule.scheduledTime ? [item.schedule.scheduledTime] : []))]; const warnings = [day.conflictCount > 0 ? "تعارض" : null, day.overCapacity ? "فوق السعة" : null, day.unknownTimingCount > 0 ? "وقت غير محدد" : null].filter(Boolean); const summary = day.items.length === 0 ? "لا مواعيد" : `${day.items.length} موعد${knownTimes[0] ? ` · ${knownTimes[0]}` : ""}`; return <button className="micro-month-cell" type="button" role="gridcell" aria-label={`${dateLabel(day.date)}: ${summary}${warnings.length > 0 ? ` · ${warnings.join("، ")}` : ""}`} aria-pressed={selected} aria-current={today ? "date" : undefined} data-selected={selected} data-today={today} data-alert={warnings.length > 0} onClick={onSelect}><span className="micro-month-date"><span dir="ltr">{monthDayNumber(day.date)}</span>{today ? <small>اليوم</small> : null}</span><span className="micro-month-cell-count">{day.items.length > 0 ? <><b><IntegerValue value={day.items.length} className="micro-inline-number" /></b> موعد</> : "لا مواعيد"}</span>{knownTimes.length > 0 ? <span className="micro-month-cell-time" dir="ltr">{knownTimes[0]}</span> : null}{warnings.length > 0 ? <span className="micro-month-cell-warning"><CircleAlert aria-hidden="true" />{warnings[0]}</span> : null}</button>; }
function MonthDayDetail({ day, onOpen }: { day: ScheduleDay; onOpen: (item: ScheduledOrder) => void }) { const warnings = [day.conflictCount > 0 ? `تعارض في ${day.conflictCount} موعد` : null, day.overCapacity ? "يتجاوز السعة اليومية المعلنة" : null, day.unknownTimingCount > 0 ? `${day.unknownTimingCount} وقت غير محدد` : null].filter(Boolean); return <section className="micro-month-day-detail" aria-labelledby={`month-day-${day.date}`}><div className="micro-month-detail-heading"><div><span className="micro-overline">تفاصيل اليوم</span><h3 id={`month-day-${day.date}`}>{dateLabel(day.date)}</h3></div><span><IntegerValue value={day.scheduledMinutes} className="micro-inline-number" /> دقيقة معروفة</span></div>{warnings.length > 0 ? <p className="micro-month-warning"><CircleAlert aria-hidden="true" />{warnings.join(" · ")}</p> : null}{day.items.length === 0 ? <p>لا مواعيد مسجلة في هذا اليوم.</p> : <div className="micro-month-day-list">{day.items.map((item) => <button type="button" key={item.schedule.id} onClick={() => onOpen(item)}><span className="micro-draft-symbol"><CalendarClock aria-hidden="true" /></span><span><strong>{item.order.order.itemName}</strong><small>{orderStatus[item.order.order.status] ?? "يحتاج مراجعة"} · {timingLabel(item.schedule)}</small></span><ChevronLeft aria-hidden="true" /></button>)}</div>}</section>; }
function ScheduleSection({ title, description, tone, items, onOpen }: { title: string; description: string; tone: "warning" | "accent" | "support"; items: readonly ScheduledOrder[]; onOpen: (item: ScheduledOrder) => void }) { return <section className="micro-schedule-section" data-tone={tone}><div className="micro-schedule-heading"><div><span className="micro-overline">{title}</span><h2>{description}</h2></div><span><IntegerValue value={items.length} className="micro-inline-number" /></span></div><div className="micro-draft-list">{items.map((item) => <button className="micro-draft-row" type="button" key={item.schedule.id} onClick={() => onOpen(item)}><span className="micro-draft-symbol"><CalendarClock aria-hidden="true" /></span><span><strong>{item.order.order.itemName}</strong><small>{orderStatus[item.order.order.status] ?? "يحتاج مراجعة"} · <LocalDateValue value={item.schedule.scheduledFor} /></small><small>{timingLabel(item.schedule)}</small><small className="micro-row-next-action">الفعل التالي: {item.order.order.nextAction}</small></span><ChevronLeft aria-hidden="true" /></button>)}</div></section>; }
function WeekDay({ day, onOpen }: { day: ScheduleDay; onOpen: (item: ScheduledOrder) => void }) { const warnings = [day.conflictCount > 0 ? `تعارض: ${day.conflictCount} موعد` : null, day.overCapacity ? "يتجاوز السعة المعلنة" : null, day.unknownTimingCount > 0 ? `${day.unknownTimingCount} وقت غير محدد` : null].filter(Boolean); return <article className="micro-week-day" data-alert={warnings.length > 0}><div className="micro-week-day-heading"><div><strong>{dateLabel(day.date)}</strong><small><IntegerValue value={day.scheduledMinutes} className="micro-inline-number" /> دقيقة بوقت مسجل</small></div>{warnings.length > 0 ? <CircleAlert aria-label="تنبيه تشغيلي" /> : null}</div>{warnings.length > 0 ? <p>{warnings.join(" · ")}</p> : null}<div>{day.items.map((item) => <button type="button" key={item.schedule.id} onClick={() => onOpen(item)}><span><b>{item.order.order.itemName}</b><small>{timingLabel(item.schedule)}</small></span><ChevronLeft aria-hidden="true" /></button>)}</div></article>; }
