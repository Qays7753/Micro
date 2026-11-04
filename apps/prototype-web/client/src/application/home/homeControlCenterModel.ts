/**
 * UNIT-003 (تنفيذ S16 بالأمر الموحد §4 — HOME-A/B): نموذج عرض الرئيسية
 * الجديد. الرئيسية وجهة الفتح الوسطى: أفعال سريعة، مختصر متابعة واحد (حتى
 * 3 مهام بقاعدة HOME-A4/3D-C2)، ولمحة مالية واحدة بفترة أداء واحدة
 * (اليوم/هذا الشهر) والنقد المسجل الآن منفصلًا عنها (HOME-R05)؛ لا حالة
 * «اليوم» المتقاطعة ولا بطاقة الغياب ولا آخر التسجيلات (HOME-R06) ولا
 * خيارات المشروع (HOME-R07) — كلها عند أصحابها.
 *
 * القراءة محايدة للفترة: الخدمة تقرأ اليوم والشهر مرة واحدة، والصفحة
 * تعرض المختار منهما — لا قراءة ثانية عند التبديل (HOME-AC10).
 */
import type { FollowUpProjection, FollowUpTask } from "@/application/follow-up";

export type HomeValueState = "known" | "incomplete" | "not_initialized";

/* ── لمحة مالية (HOME-B1) — من المصدر نفسه، بلا معادلات واجهة ── */
export type HomeGlimpsePeriodKind = "today" | "month";
export type HomeGlimpsePeriod = {
  kind: HomeGlimpsePeriodKind;
  /* النطاق الفعلي الموافق للقراءة المعروضة — يُمرر إلى 016 عند فتح الرقم
   * (HOME-X04/3D-C1: بالنطاق الدقيق ومقصد الرقم، بلا ملخص 013 وسيط). */
  from: string;
  to: string;
  label: string;
};
export type HomeGlimpseNumber = {
  id: "sales" | "result";
  label: string;
  state: HomeValueState;
  valueMinor: number | null;
  honestNote: string | null;
  sourceHref: string;
};
export type HomeGlimpseCash = {
  label: string;
  state: HomeValueState;
  valueMinor: number | null;
  /* المجموعة ١ (§7.1): مؤهل الأمانات قرب الرقم عند الانطباق — ليس ربحًا
   * ولا مبلغًا متاحًا للسحب. */
  qualifier: string | null;
  sourceHref: string;
};
export type HomeGlimpsePeriodNumbers = {
  period: HomeGlimpsePeriod;
  sales: HomeGlimpseNumber;
  result: HomeGlimpseNumber;
};
export type HomeFinancialGlimpse = {
  today: HomeGlimpsePeriodNumbers;
  month: HomeGlimpsePeriodNumbers;
  /* النقد المسجل الآن — قراءة الوضع الحالية، منفصلة عن فترة الأداء:
   * لا يتغير بتغيير اليوم/الشهر (HOME-B1). */
  cashNow: HomeGlimpseCash;
};

/* ── متابعتك (HOME-A3/A4 — 3D-C2) — مختصر واحد لا قائمتين ── */
export type HomeFollowUpRow = {
  /* هوية ثابتة نوعية: نوع المصدر + معرفه + نوع المهمة + معرف الموعد/الدورة
   * إن انطبق (منع التكرار داخل المتابعة — HOME-D). */
  id: string;
  title: string;
  detail: string | null;
  /* مبلغ بمعناه ودوره إن كان لازمًا للمهمة — بتسمية دوره لا رقمًا عاريًا
   * (HOME-A3)؛ المقترح موسوم من المصدر. */
  amountMinor: number | null;
  amountRole: string | null;
  dateLocal: string | null;
  timeLocal: string | null;
  /* وسم «قادم» للموعد المستقبلي المحجوز (HOME-A4 قاعدة ٢) — لا يوصف بالعاجل. */
  upcoming: boolean;
  href: string;
  actionLabel: string;
};
export type HomeFollowUpBrief = {
  rows: readonly HomeFollowUpRow[];
  /* اكتمال القراءة: فشل أي مصدر يفقد المختصر صفته — تُعرض المهام المثبتة
   * مع إعلان التعذر وإعادة المحاولة؛ لا عدد شامل ولا فراغ مضلل (HOME-A4). */
  complete: boolean;
  failedMessage: string | null;
  /* قراءة مكتملة بلا مهام — الحالة الصادقة لا «كل شيء ممتاز» (HOME-B3). */
  empty: boolean;
};

/* ── معلومات (!) — HOME-B4/F10 ── */
export type HomeBackupState = {
  /* لا تاريخ نسخة ناجحة من مجرد بدء تنزيل — المتحقق فقط (من 044 عبر 038). */
  lastVerifiedExportAt: string | null;
  daysSinceExport: number | null;
  reminderEnabled: boolean;
};

export type HomeControlCenterInput = {
  activityName: string;
  todayLocal: string;
  truthLine: string | null;
  glimpse: HomeFinancialGlimpse;
  followUp: HomeFollowUpBrief;
  backup: HomeBackupState;
};
export type HomeControlCenterViewModel = {
  heading: { activityName: string; todayLocal: string };
  truthLine: string | null;
  glimpse: HomeFinancialGlimpse;
  followUp: HomeFollowUpBrief;
  backup: HomeBackupState;
};

/* أفعال متابعة بلا موعد (HOME-A4 قاعدة ٣) — الترتيب النوعي داخل الفئة:
 * تصحيح التاريخ التالف أولًا، ثم خطوة الطلب المؤهلة، ثم التحصيل/السداد،
 * ثم المسودات المحفوظة. */
const UNDATED_TASK_ORDER: Partial<Record<FollowUpTask["taskKind"], number>> = {
  delivery: 1,
  customer_followup: 2,
  receivable: 3,
  supplier_payable: 3,
  expense_payable: 3,
  recurring_review: 3,
};

function taskRow(task: FollowUpTask, upcoming: boolean): HomeFollowUpRow {
  return {
    id: task.itemKey,
    title: task.title,
    detail: task.party,
    amountMinor: task.amountProposed ? null : task.amountMinor,
    amountRole: task.amountProposed || task.amountMinor === null ? null : task.amountRole,
    dateLocal: task.dueOn,
    timeLocal: task.scheduledTime,
    upcoming,
    href: task.sourceHref,
    actionLabel: followUpActionLabel(task),
  };
}

function followUpActionLabel(task: FollowUpTask): string {
  switch (task.taskKind) {
    case "delivery":
      return "مراجعة التسليم";
    case "customer_followup":
      return "متابعة العميل";
    case "receivable":
      return "تحصيل";
    case "supplier_payable":
      return "تسجيل دفعة";
    case "expense_payable":
      return "سداد";
    case "recurring_review":
      return "مراجعة";
  }
}

/** HOME-A4/3D-C2: اختيار مختصر المتابعة (حتى 3 صفوف) من قراءة القارئ
 * الموحد — قاعدة عرض معلنة، لا ادعاء أهمية مالية ولا ترتيب بقيمة الدين. */
export function selectFollowUpBrief(
  projection: Pick<FollowUpProjection, "groups">,
  drafts: readonly { id: string; itemName: string | null }[],
  complete: boolean,
  failedMessage: string | null,
): HomeFollowUpBrief {
  const rows: HomeFollowUpRow[] = [];
  const pushTask = (task: FollowUpTask, upcoming = false) => {
    if (rows.some(row => row.id === task.itemKey)) return;
    rows.push(taskRow(task, upcoming));
  };
  const undatedRows: HomeFollowUpRow[] = projection.groups
    .find(group => group.group === "undated")!
    .tasks.map(task => ({ task, order: UNDATED_TASK_ORDER[task.taskKind] ?? 2 }))
    .sort(
      (left, right) => left.order - right.order || left.task.itemKey.localeCompare(right.task.itemKey, "ar"),
    )
    .map(entry => taskRow(entry.task, false));
  const draftRows: HomeFollowUpRow[] = drafts.map(draft => ({
    id: `draft:${draft.id}`,
    title: `إكمال طلب — ${draft.itemName || "بلا وصف"}`,
    detail: null,
    amountMinor: null,
    amountRole: null,
    dateLocal: null,
    timeLocal: null,
    upcoming: false,
    href: `/orders/draft/${draft.id}`,
    actionLabel: "إكمال الطلب",
  }));
  /* قاعدة ١: الفائت ثم اليوم بترتيب المصدر، حتى امتلاء حد 3 صفوف. */
  for (const groupName of ["overdue", "today"] as const) {
    for (const task of projection.groups.find(group => group.group === groupName)!.tasks) {
      if (rows.length >= 3) break;
      pushTask(task);
    }
  }
  /* قاعدة ٢: إن بقي مكان ووجد موعد مستقبلي مثبت — صف واحد لأقربها بوسم قادم. */
  const upcomingTasks = projection.groups.find(group => group.group === "upcoming")!.tasks;
  let reservedUpcoming: FollowUpTask | null = null;
  if (rows.length < 3 && upcomingTasks.length > 0) {
    reservedUpcoming = upcomingTasks[0]!;
    pushTask(reservedUpcoming, true);
  }
  if (rows.length < 3) {
    /* قاعدة ٣: تكمل الأماكن بمهام بلا موعد — تصحيح التاريخ التالف أولًا
     * (مجموعة invalid)، ثم خطوات/تحصيل/سداد بترتيبها النوعي، ثم المسودات. */
    const orderedFill: HomeFollowUpRow[] = [];
    for (const task of projection.groups.find(group => group.group === "invalid")!.tasks) {
      orderedFill.push(taskRow(task, false));
    }
    for (const row of undatedRows) orderedFill.push(row);
    for (const row of draftRows) orderedFill.push(row);
    for (const row of orderedFill) {
      if (rows.length >= 3) break;
      if (rows.some(existing => existing.id === row.id)) continue;
      rows.push(row);
    }
  }
  /* قاعدة ٤: إن بقي مكان تعرض المواعيد القادمة التالية دون تكرار المحجوز. */
  for (const task of upcomingTasks) {
    if (rows.length >= 3) break;
    if (reservedUpcoming && task.itemKey === reservedUpcoming.itemKey) continue;
    pushTask(task, true);
  }
  return {
    rows: rows.slice(0, 3),
    complete,
    failedMessage,
    empty: complete && rows.length === 0,
  };
}

export function buildHomeControlCenterViewModel(input: HomeControlCenterInput): HomeControlCenterViewModel {
  return {
    heading: { activityName: input.activityName, todayLocal: input.todayLocal },
    truthLine: input.truthLine,
    glimpse: input.glimpse,
    followUp: input.followUp,
    backup: input.backup,
  };
}
