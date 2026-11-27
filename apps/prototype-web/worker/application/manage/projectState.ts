/**
 * M5.2 (Manage v2 phase 5 — spec §3.1 `project` + R-17 + UX P-10/P-11): قراءة
 * حالة المشروع (الاسم + الانقطاع المفتوح بأيامه لبطاقة العودة) وتعديل
 * الاسم — تحديث مباشر بلا عملية ولا قيد (R-17: بلا أثر مالي؛ نمط تحرير
 * حقول البيع M3.1 والمنتجات M3.1: حتمي بنيويًا — القيم نفسها تعيد كتابة
 * نفسها، وكل أرقام §8 تبقى من الدفتر وحده).
 *
 * الأيام في جملة `r.absence_intro` («مرّ {days} يوماً على آخر تسجيل»)
 * محسوبة هنا في الخادم من حدث الانقطاع المفتوح (started_on = يوم آخر
 * عملية — §7.2): عدّ أيام صحيح بمقارنة التواريخ الخام، لا عرض للعميل
 * أن يحسبها.
 */
import type postgres from "postgres";

/** حالة الانقطاع المفتوح لبطاقة العودة في P-10 (§7.2). */
export interface OpenAbsenceState {
  startedOn: string;
  endedOn: string;
  /** الأيام منذ آخر تسجيل (اليوم − started_on) — نص العرض عند العميل. */
  daysSinceLastRecord: number;
}

/** استجابة قراءة حالة المشروع (P-10/P-11). */
export interface ProjectStateResponse {
  projectId: string;
  name: string;
  /** حدث الانقطاع المفتوح إن وُجد (البطاقة تظهر وتدوم حتى إكمال التدفق). */
  openAbsence: OpenAbsenceState | null;
}

/** فرق الأيام الصحيح بين تاريخَي ISO محليين (سالب إذا انعكس الترتيب). */
function daysBetween(fromOn: string, toOn: string): number {
  const fromDate = new Date(`${fromOn}T00:00:00Z`).getTime();
  const toDate = new Date(`${toOn}T00:00:00Z`).getTime();
  return Math.round((toDate - fromDate) / 86_400_000);
}

/** قراءة حالة المشروع: الاسم + الانقطاع المفتوح (المفتوح وحده — المكتمل لا بطاقة له). */
export async function readProjectState(
  sql: postgres.Sql,
  projectId: string,
  today: string,
): Promise<ProjectStateResponse> {
  const project = (await sql`SELECT id, name FROM project WHERE id = ${projectId}`) as Array<{
    id: string;
    name: string;
  }>;
  if (project.length === 0) {
    throw new ProjectNotFound();
  }
  const open = (await sql`
    SELECT started_on::text AS started_on, ended_on::text AS ended_on
    FROM absence_event
    WHERE project_id = ${projectId} AND complete IS NULL
    ORDER BY started_on DESC
    LIMIT 1`) as Array<{ started_on: string; ended_on: string }>;
  const absence = open[0];
  return {
    projectId: String(project[0]!.id),
    name: String(project[0]!.name),
    openAbsence:
      absence === undefined
        ? null
        : {
            startedOn: String(absence.started_on),
            endedOn: String(absence.ended_on),
            daysSinceLastRecord: daysBetween(String(absence.started_on), today),
          },
  };
}

/** خطأ «لا مشروع» — المسار يحوّله إلى 404 الموحد (R-24). */
export class ProjectNotFound extends Error {
  constructor() {
    super("project not found");
  }
}

/** نتيجة تعديل الاسم (P-11: العودة لـP-10 يعيد قراءة الحالة كاملة). */
export interface ProjectRenameResult {
  projectId: string;
  name: string;
}

/** تعديل اسم المشروع (R-17 — تحديث مباشر بلا أثر مالي). */
export async function renameProject(
  sql: postgres.Sql,
  input: { projectId: string; name: string },
): Promise<ProjectRenameResult> {
  const updated = (await sql`
    UPDATE project SET name = ${input.name} WHERE id = ${input.projectId}
    RETURNING id, name`) as Array<{ id: string; name: string }>;
  if (updated.length === 0) {
    throw new ProjectNotFound();
  }
  return { projectId: String(updated[0]!.id), name: String(updated[0]!.name) };
}
