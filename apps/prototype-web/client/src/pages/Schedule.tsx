/** Style: Micro «مسار القرار» — phone-first RTL schedule; the monthly view is derived evidence, not a booking calendar. */
import { ArrowLeft, CalendarClock, CalendarDays, ChevronLeft, ChevronRight, CircleAlert, Clock3, Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import type { MonthOverview, ScheduleDay, ScheduleOverview, ScheduledOrder } from "@/application/scheduling/scheduleService";

type ScheduleState = { phase: "loading" } | { phase: "error"; message: string } | { phase: "ready"; overview: ScheduleOverview; month: MonthOverview };
const orderStatus: Record<string, string> = { provisional_agreement: "اتفاق مبدئي", confirmed: "تم التأكيد", in_progress: "قيد التنفيذ", ready: "جاهز للتسليم", delivered: "تم التسليم", settled: "مغلق" };
const weekdayLabels = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const dateLabel = (date: string) => new Intl.DateTimeFormat("ar-JO", { timeZone: "Asia/Amman", weekday: "long", day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00.000Z`));
const monthLabel = (month: string) => new Intl.DateTimeFormat("ar-JO", { timeZone: "Asia/Amman", month: "long", year: "numeric" }).format(new Date(`${month}-15T12:00:00.000Z`));
const timingLabel = (schedule: ScheduledOrder["schedule"]) => schedule.scheduledTime && schedule.durationMinutes ? `${schedule.scheduledTime} · ${schedule.durationMinutes} دقيقة` : "وقت غير محدد";
const capacityOptions = Array.from({ length: 48 }, (_, index) => (index + 1) * 15);

function localParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Amman", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return { year: part("year"), month: part("month"), day: part("day") };
}

const currentLocalMonth = () => { const { year, month } = localParts(); return `${year}-${month}`; };
const currentLocalDate = () => { const { year, month, day } = localParts(); return `${year}-${month}-${day}`; };
const shiftMonth = (month: string, offset: number) => { const date = new Date(`${month}-15T12:00:00.000Z`); date.setUTCMonth(date.getUTCMonth() + offset); return date.toISOString().slice(0, 7); };
const monthDayNumber = (date: string) => new Intl.DateTimeFormat("en", { timeZone: "Asia/Amman", day: "numeric" }).format(new Date(`${date}T12:00:00.000Z`));
const monthFirstDayOffset = (month: string) => new Date(`${month}-01T12:00:00.000Z`).getUTCDay();

export default function Schedule() {
  const [, navigate] = useLocation();
  const { schedules, notifyDataChanged, dataVersion } = usePrototypeServices();
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
    Promise.all([schedules.overview(), schedules.monthOverview(selectedMonth)]).then(([overviewResult, monthResult]) => {
      if (!active) return;
      if (!overviewResult.ok || !monthResult.ok) {
        const message = overviewResult.ok ? (monthResult.ok ? "تعذر قراءة جدول المواعيد المحلي." : monthResult.message) : overviewResult.message;
        setState({ phase: "error", message });
        return;
      }
      setState({ phase: "ready", overview: overviewResult.value, month: monthResult.value });
      setCapacityChoice(overviewResult.value.dailyCapacityMinutes?.toString() ?? "");
    }).catch(() => { if (active) setState({ phase: "error", message: "تعذر قراءة جدول المواعيد المحلي." }); });
    return () => { active = false; };
  }, [dataVersion, reloadToken, schedules, selectedMonth]);

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

  const { overview, month } = state;
  const total = overview.overdue.length + overview.today.length + overview.upcoming.length;
  const weekWithWork = overview.week.filter((day) => day.items.length > 0);
  return <section className="micro-page micro-schedule-page">
    <button className="micro-back-button" type="button" onClick={() => navigate("/")}><ArrowLeft aria-hidden="true" /> مشروعي الآن</button>
    <div className="micro-page-heading"><span className="micro-overline">التنظيم التشغيلي</span><h1>جدول المواعيد</h1><p>اقرأ التزامات الطلبات المسجلة في اليوم أو الأسبوع أو الشهر. الوقت والمدة يدعمان تحذيرًا فقط عندما تعرفهما؛ لا يرسل هذا الإصدار تذكيرًا خارجيًا.</p></div>
    <MonthSchedulePanel month={month} selectedDate={selectedDate} onChangeMonth={changeMonth} onSelectDate={setSelectedDate} onOpen={(item) => navigate(`/schedule/${item.schedule.id}`)} />
    <section className="micro-schedule-capacity"><div><Timer aria-hidden="true" /><div><span className="micro-overline">قدرة اليوم</span><h2>ما المدة التي تستطيع الالتزام بها؟</h2><p>{overview.dailyCapacityMinutes === null ? "غير محددة الآن؛ لن نحكم على ضغط اليوم." : `السعة المعلنة: ${overview.dailyCapacityMinutes} دقيقة. التحذير لا يمنعك من حفظ الموعد.`}</p></div></div><label className="micro-field"><span>سعة يومية اختيارية</span><select value={capacityChoice} onChange={(event) => setCapacityChoice(event.target.value)} aria-label="سعة اليوم بالدقائق"><option value="">غير محددة الآن</option>{capacityOptions.map((minutes) => <option key={minutes} value={minutes}>{minutes} دقيقة</option>)}</select></label>{capacityMessage ? <p className={capacityMessage.startsWith("تم ") || capacityMessage.startsWith("لم ") ? "micro-save-note" : "micro-field-error"} role="status">{capacityMessage}</p> : null}<button className="micro-button micro-button-secondary" type="button" disabled={savingCapacity} onClick={saveCapacity}>{savingCapacity ? "جارٍ حفظ السعة…" : "حفظ سعة اليوم"}</button></section>
    {overview.overdue.length > 0 ? <ScheduleSection title="متأخر" description="هذه الطلبات تجاوزت موعدها المسجل وتحتاج قرارًا." tone="warning" items={overview.overdue} onOpen={(item) => navigate(`/schedule/${item.schedule.id}`)} /> : null}
    {overview.today.length > 0 ? <ScheduleSection title="اليوم" description="طلبات موعدها اليوم حسب توقيت عمّان." tone="accent" items={overview.today} onOpen={(item) => navigate(`/schedule/${item.schedule.id}`)} /> : null}
    {overview.upcoming.length > 0 ? <ScheduleSection title="قادم" description="رتب العمل القادم قبل أن يصبح متأخرًا." tone="support" items={overview.upcoming} onOpen={(item) => navigate(`/schedule/${item.schedule.id}`)} /> : null}
    {total === 0 ? <section className="micro-empty-state"><span className="micro-empty-symbol"><CalendarDays aria-hidden="true" /></span><span className="micro-status-chip">لا توجد مواعيد تشغيلية</span><h2>لا توجد طلبات تحتاج موعدًا الآن</h2><p>عند تثبيت اتفاق جديد ينشئ Micro موعد تسليم محليًا قابلًا للمتابعة.</p><button className="micro-button micro-button-primary" type="button" onClick={() => navigate("/orders/new")}>بدء طلب</button></section> : null}
    {weekWithWork.length > 0 ? <section className="micro-week-agenda" aria-label="خطة الأيام السبعة"><div className="micro-week-heading"><div><span className="micro-overline">الأيام السبعة القادمة</span><h2>أين يوجد ضغط فعلي في وقتك المسجل؟</h2></div><Clock3 aria-hidden="true" /></div><div className="micro-week-list">{weekWithWork.map((day) => <WeekDay key={day.date} day={day} onOpen={(item) => navigate(`/schedule/${item.schedule.id}`)} />)}</div></section> : null}
    {overview.completedOrClosed > 0 ? <p className="micro-schedule-closed-note">يوجد {overview.completedOrClosed} موعدًا لطلبات أغلقت أو اكتملت عند التسليم ولم تعد تحتاج متابعة تشغيلية.</p> : null}
  </section>;
}

function MonthSchedulePanel({ month, selectedDate, onChangeMonth, onSelectDate, onOpen }: { month: MonthOverview; selectedDate: string | null; onChangeMonth: (offset: number) => void; onSelectDate: (date: string | null) => void; onOpen: (item: ScheduledOrder) => void }) {
  const selectedDay = month.days.find((day) => day.date === selectedDate) ?? null;
  return <section className="micro-month-panel" aria-labelledby="monthly-schedule-title">
    <div className="micro-month-heading"><div><span className="micro-overline">قراءة شهرية مشتقة</span><h2 id="monthly-schedule-title">{monthLabel(month.month)}</h2><p>من مواعيد الطلبات المحلية · توقيت عمّان</p></div><CalendarDays aria-hidden="true" /></div>
    <div className="micro-month-navigation"><button className="micro-icon-button" type="button" aria-label="الشهر السابق" onClick={() => onChangeMonth(-1)}><ChevronRight aria-hidden="true" /></button><strong dir="ltr">{month.month}</strong><button className="micro-icon-button" type="button" aria-label="الشهر التالي" onClick={() => onChangeMonth(1)}><ChevronLeft aria-hidden="true" /></button></div>
    <dl className="micro-month-summary"><div><dt>مواعيد مسجلة</dt><dd className="micro-number">{month.scheduledCount}</dd></div><div><dt>دقائق معروفة</dt><dd className="micro-number">{month.scheduledMinutes}</dd></div><div><dt>وقت غير محدد</dt><dd className="micro-number">{month.unknownTimingCount}</dd></div><div><dt>متأخر ضمن الشهر</dt><dd className="micro-number">{month.overdueCount}</dd></div></dl>
    {month.scheduledCount === 0 ? <div className="micro-month-empty" role="status"><CircleAlert aria-hidden="true" /><div><strong>لا توجد مواعيد مسجلة لهذا الشهر</strong><p>هذا لا يعني أن الشهر متاح بالكامل؛ لا توجد التزامات تشغيلية مسجلة لقراءتها.</p></div></div> : null}
    <div className="micro-month-weekdays" aria-hidden="true">{weekdayLabels.map((label) => <span key={label}>{label}</span>)}</div>
    <div className="micro-month-grid" role="grid" aria-label={`أيام ${monthLabel(month.month)}`}>
      {Array.from({ length: monthFirstDayOffset(month.month) }, (_, index) => <span className="micro-month-cell micro-month-cell-empty" aria-hidden="true" key={`leading-${index}`} />)}
      {month.days.map((day) => <MonthDayCell key={day.date} day={day} selected={selectedDate === day.date} today={day.date === currentLocalDate()} onSelect={() => onSelectDate(selectedDate === day.date ? null : day.date)} />)}
    </div>
    {selectedDay ? <MonthDayDetail day={selectedDay} onOpen={onOpen} /> : <p className="micro-month-prompt">اضغط على يوم لعرض مواعيده المسجلة دون فتح محرر أو تغيير السجل.</p>}
  </section>;
}

function MonthDayCell({ day, selected, today, onSelect }: { day: ScheduleDay; selected: boolean; today: boolean; onSelect: () => void }) {
  const knownTimes = [...new Set(day.items.flatMap((item) => item.schedule.scheduledTime ? [item.schedule.scheduledTime] : []))];
  const warnings = [day.conflictCount > 0 ? "تعارض" : null, day.overCapacity ? "فوق السعة" : null, day.unknownTimingCount > 0 ? "وقت غير محدد" : null].filter(Boolean);
  const summary = day.items.length === 0 ? "لا مواعيد" : `${day.items.length} موعد${knownTimes[0] ? ` · ${knownTimes[0]}` : ""}`;
  return <button className="micro-month-cell" type="button" role="gridcell" aria-label={`${dateLabel(day.date)}: ${summary}${warnings.length > 0 ? ` · ${warnings.join("، ")}` : ""}`} aria-pressed={selected} aria-current={today ? "date" : undefined} data-selected={selected} data-today={today} data-alert={warnings.length > 0} onClick={onSelect}><span className="micro-month-date"><span dir="ltr">{monthDayNumber(day.date)}</span>{today ? <small>اليوم</small> : null}</span><span className="micro-month-cell-count">{day.items.length > 0 ? <><b className="micro-number">{day.items.length}</b> موعد</> : "لا مواعيد"}</span>{knownTimes.length > 0 ? <span className="micro-month-cell-time" dir="ltr">{knownTimes[0]}</span> : null}{warnings.length > 0 ? <span className="micro-month-cell-warning"><CircleAlert aria-hidden="true" />{warnings[0]}</span> : null}</button>;
}

function MonthDayDetail({ day, onOpen }: { day: ScheduleDay; onOpen: (item: ScheduledOrder) => void }) {
  const warnings = [day.conflictCount > 0 ? `تعارض في ${day.conflictCount} موعد` : null, day.overCapacity ? "يتجاوز السعة اليومية المعلنة" : null, day.unknownTimingCount > 0 ? `${day.unknownTimingCount} وقت غير محدد` : null].filter(Boolean);
  return <section className="micro-month-day-detail" aria-labelledby={`month-day-${day.date}`}><div className="micro-month-detail-heading"><div><span className="micro-overline">تفاصيل اليوم</span><h3 id={`month-day-${day.date}`}>{dateLabel(day.date)}</h3></div><span className="micro-number">{day.scheduledMinutes} دقيقة معروفة</span></div>{warnings.length > 0 ? <p className="micro-month-warning"><CircleAlert aria-hidden="true" />{warnings.join(" · ")}</p> : null}{day.items.length === 0 ? <p>لا مواعيد مسجلة في هذا اليوم.</p> : <div className="micro-month-day-list">{day.items.map((item) => <button type="button" key={item.schedule.id} onClick={() => onOpen(item)}><span className="micro-draft-symbol"><CalendarClock aria-hidden="true" /></span><span><strong>{item.order.order.itemName}</strong><small>{orderStatus[item.order.order.status] ?? "يحتاج مراجعة"} · {timingLabel(item.schedule)}</small></span><ChevronLeft aria-hidden="true" /></button>)}</div>}</section>;
}

function ScheduleSection({ title, description, tone, items, onOpen }: { title: string; description: string; tone: "warning" | "accent" | "support"; items: readonly ScheduledOrder[]; onOpen: (item: ScheduledOrder) => void }) { return <section className="micro-schedule-section" data-tone={tone} aria-label={title}><div className="micro-schedule-heading"><div><span className="micro-overline">{title}</span><h2>{description}</h2></div><span>{items.length}</span></div><div className="micro-draft-list">{items.map((item) => <button className="micro-draft-row" type="button" key={item.schedule.id} onClick={() => onOpen(item)}><span className="micro-draft-symbol"><CalendarClock aria-hidden="true" /></span><span><strong>{item.order.order.itemName}</strong><small>{orderStatus[item.order.order.status] ?? "يحتاج مراجعة"} · {item.schedule.scheduledFor}</small><small>{timingLabel(item.schedule)}</small><small className="micro-row-next-action">الفعل التالي: {item.order.order.nextAction}</small></span><ChevronLeft aria-hidden="true" /></button>)}</div></section>; }

function WeekDay({ day, onOpen }: { day: ScheduleDay; onOpen: (item: ScheduledOrder) => void }) { const warnings = [day.conflictCount > 0 ? `تعارض: ${day.conflictCount} موعد` : null, day.overCapacity ? "يتجاوز السعة المعلنة" : null, day.unknownTimingCount > 0 ? `${day.unknownTimingCount} وقت غير محدد` : null].filter(Boolean); return <article className="micro-week-day" data-alert={warnings.length > 0}><div className="micro-week-day-heading"><div><strong>{dateLabel(day.date)}</strong><small><span className="micro-number">{day.scheduledMinutes}</span> دقيقة بوقت مسجل</small></div>{warnings.length > 0 ? <CircleAlert aria-label="تنبيه تشغيلي" /> : null}</div>{warnings.length > 0 ? <p>{warnings.join(" · ")}</p> : null}<div>{day.items.map((item) => <button type="button" key={item.schedule.id} onClick={() => onOpen(item)}><span><b>{item.order.order.itemName}</b><small>{timingLabel(item.schedule)}</small></span><ChevronLeft aria-hidden="true" /></button>)}</div></article>; }
