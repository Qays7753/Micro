/**
 * EXE-016 (الموجة ٣ — NAV-003): اختبار تزامن معجم معاملات الوصل العميقة.
 *
 * القاعدة الملزمة (عقد ٢٦ كما عدّلته الموجة ٣): كل معامل استعلامي في الإنتاج
 * له مستهلك موثق واسم معلن — ولا قراءة خام لمعامل خارج المعجم، ولا إنتاج
 * لروابط بالمعاملات المتقاعدة (`from` القديم يُقرأ توافقًا فقط، والمعامل
 * العام `to` تقاعد كليًا). هذا الاختبار هو حارس الانحراف الصامت: معامل جديد
 * بلا تسجيل هنا يفشل البناء، ومعامل مسجل بلا مستهلك حقيقي يفشل أيضًا.
 *
 * (نمط routeKnowledgeSync: يقرأ مصادر الإنتاج حية — لا نسخة ثالثة من القوائم.)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readRepoFile(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
}

/** المعجم الموثق (عقد ٢٦ §3 بعد EXE-016): الاسم ← دوره. أي إضافة قرار موثق. */
const DOCUMENTED_PARAMS: Readonly<Record<string, string>> = {
  returnTo: "وجهة الرجوع القانونية (EXE-016) — إنتاج جديد حصرًا",
  from: "توافق خلفي فقط — يُقرأ ولا يُنتج",
  focus: "فتح قسم/فعل داخل الصفحة الهدف",
  layer: "فتح طبقة عرض داخل مالي",
  mode: "وضع التغطية في توزيع الكاش",
  event: "تركيز حدث مالي محدد",
  entry: "تركيز حركة محفظة محددة",
  view: "قراءة الفترة في مالي بدل الوضع",
  source: "الذمة المصدر لورقة التحصيل",
  product: "المرجع المختار مسبقًا في محرر البيع",
  estimate: "التقدير المصدر للمسودة/لحاسبة التعديل",
  intent: "نية المسودة (طلب عميل/مسودة تصميم)",
  order: "سياق طلب في محرر الاستهلاك",
  sale: "سياق بيع مباشر في محرر الحركة",
  purchase: "جسر الاستلام: محرر الاستلام بشراء محدد",
  material: "مادة محددة في محررات حركة المخزون",
  setup: "لافتة نجاح الإعداد الأول لمرة واحدة",
  created: "لافتة نجاح إنشاء الاتفاق لمرة واحدة",
  destinationWalletId: "المحفظة المقصودة في توزيع الكاش (EXE-016)",
};

const PRODUCTION_DIRS = ["../pages", "../app", "../components", "../application"];
const PARAM_READ_PATTERN = /\.get\("([A-Za-z][A-Za-z0-9]*)"\)/g;

function listProductionFiles(): string[] {
  const files: string[] = [];
  for (const dir of PRODUCTION_DIRS) {
    const absolute = fileURLToPath(new URL(dir, import.meta.url));
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = `${dir}/${entry}`;
        const stat = statSync(full);
        if (stat.isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) files.push(full);
      }
    };
    walk(absolute);
  }
  return files;
}

describe("EXE-016 — معجم معاملات الوصل العميقة (تزامن القراءة والإنتاج)", () => {
  it("لا قراءة خام لمعامل خارج المعجم الموثق", () => {
    const files = listProductionFiles();
    expect(files.length).toBeGreaterThan(100);
    const offenders: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      /* القراءات المرتبطة بـURLSearchParams فقط: نتجاهل قراءات Map/مفاتيح
       * أخرى غير الاستعلام بتحديد أنماط الاستعلام حولها. */
      for (const match of content.matchAll(PARAM_READ_PATTERN)) {
        const param = match[1];
        if (!(param in DOCUMENTED_PARAMS)) {
          const line = content.slice(0, match.index).split("\n").length;
          offenders.push(`${file.split("client/src/")[1]}:${line} يقرأ معامل غير موثق: ${param}`);
        }
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("لا معامل موثق بلا مستهلك حقيقي في الإنتاج", () => {
    const contents = listProductionFiles().map(file => readFileSync(file, "utf8"));
    const allProduction = contents.join("\n");
    const unconsumed: string[] = [];
    for (const param of Object.keys(DOCUMENTED_PARAMS)) {
      if (!allProduction.includes(`.get("${param}")`)) {
        unconsumed.push(param);
      }
    }
    expect(unconsumed, `معاملات بلا مستهلك: ${unconsumed.join(", ")}`).toEqual([]);
  });

  it("لا إنتاج لروابط بالمعاملات المتقاعدة: from يُقرأ توافقًا فقط وto تقاعد كليًا", () => {
    const files = listProductionFiles();
    const offenders: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      const path = file.split("client/src/")[1];
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        /* السطور الإنتاجية (لا تعليقات) التي تُنتج from=/to= داخل URL حرفيًا. */
        if (trimmed.startsWith("*") || trimmed.startsWith("//") || trimmed.startsWith("/*")) continue;
        if (/[`"'](\?|&)from=/.test(line) || /[`"'](\?|&)to=/.test(line)) {
          offenders.push(`${path}: ${trimmed.slice(0, 90)}`);
        }
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("قيم focus المعجمية الحية فقط (الميتة حُذفت مع EXE-016)", () => {
    const contract = readRepoFile("../app/navigationContract.ts");
    expect(contract).toContain('"capacity"');
    expect(contract).toContain('"recurrence"');
    expect(contract).toContain('"guided-import"');
    expect(contract).not.toContain('"export"');
    expect(contract).not.toContain('"today"');
    expect(contract).not.toContain('"priority"');
  });
});
