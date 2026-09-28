/**
 * المجموعة ٥ (التحصين الكامل — قالب المسار الآمن): تحويل المسار الحي إلى
 * قالب معروف بلا معاملات ولا استعلام — الطريق الوحيد الذي تدخل به حركة
 * المستخدم إلى أي سجل تشخيصي.
 *
 * قواعد الإخفاء:
 * - الاستعلام (#…) كله يُسقط دومًا — لا قيم استعلام إطلاقًا.
 * - كل مقطع منزوع البنية (معرّف/نوع/معامل) يُطابق فقط قالب :seg المسجل
 *   في جدول المسارات المعروف من MicroRouter.
 * - المسار خارج الجدول يُخفى كليًا إلى /unknown — لا يُمرر نص المسار
 *   الخام أبدًا (قد يحمل معرفات أو قيم حساسة).
 *
 * W4-E (F-047): اكتمل الجدول بكل مسارات MicroRouter الحية — كانت المسارات
 * العشرة التالية تؤول صامتة إلى /unknown (finance/more وupcoming وrecurring
 * وموجاتها، وnew/owner_withdrawal_cash، وloans/received وموجتيها، وmarket).
 * ولأن ميزانية حزمة الدخول (D-034) لا تحتمل تمثيلًا حرفيًا متكررًا، يُخزَّن
 * الجدول مجموعاتٍ «قسم:مسار,مسار,…» يفكها المحرك عند الإقلاع: اسم القسم
 * المشترك (مثل finance) يُكتب مرة واحدة، والجذر «/» ثابت أول. اختبار
 * التزامن (routeTemplateSync) يشتق مسارات MicroRouter من مصدره نفسه ويثبت
 * أن كل مسار حي يعود بقالبه المتوقع حرفيًا — أي خطأ ترميز يفشل بالاسم.
 * داخل كل مجموعة يسبق المسار النوعي أخاه البديل (owner_withdrawal_cash
 * قبل :type، وrecurring/new قبل recurring/:id) كي لا يبتلعه.
 */
const ROUTE_GROUPS =
  "assets:new,:id cash:count,distribute,transfer,entry/:id/reverse,wallet/new,wallet/:id,wallet/:id/adjust,wallet/:id/opening-later catalog collect direct-sales:new,:id finance:activity,g5/declaration,more,new/owner_withdrawal_cash,new/:type,owner-entitlement,recurring,recurring/new,recurring/:id,recurring/:id/edit,statement,upcoming,withdraw foundation inventory:material/new,material/:id/confirm,movement/:id/reverse,movement/:type loans:new,:id,received/new,received/:id market orders:new,draft/:id,draft/:id/agreement,draft/:id/cost,:id,:id/deliver parties profile review schedule::id settings setup share:preview suppliers:purchase/:id,purchase/:id/payment tools:calculator,estimate/:id,integrity";

const ROUTE_TEMPLATES: string[] = ["/"];
for (const group of ROUTE_GROUPS.split(" ")) {
  const colon = group.indexOf(":");
  const section = colon < 0 ? group : group.slice(0, colon);
  ROUTE_TEMPLATES.push(`/${section}`);
  if (colon < 0) continue;
  for (const tail of group.slice(colon + 1).split(",")) {
    ROUTE_TEMPLATES.push(`/${section}/${tail}`);
  }
}

const UNKNOWN_ROUTE_TEMPLATE = "/unknown";

function splitSegments(path: string): readonly string[] {
  return path.split("/").filter(segment => segment !== "");
}

function templateMatches(template: readonly string[], segments: readonly string[]): boolean {
  if (template.length !== segments.length) return false;
  for (let index = 0; index < template.length; index += 1) {
    const expected = template[index];
    if (expected.startsWith(":")) continue;
    if (expected !== segments[index]) return false;
  }
  return true;
}

/** قالب المسار الآمن لموقع حي — الإخفاء الافتراضي /unknown عند أي شك. */
export function routeTemplateFor(location: string): string {
  const pathnameOnly = location.split(/[?#]/, 1)[0] ?? location;
  const segments = splitSegments(pathnameOnly);
  if (segments.length === 0) return "/";
  for (const template of ROUTE_TEMPLATES) {
    if (templateMatches(splitSegments(template), segments)) return template;
  }
  return UNKNOWN_ROUTE_TEMPLATE;
}
