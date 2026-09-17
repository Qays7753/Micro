/**
 * EXE-017 (الموجة ٣ — TOOL-002/CAT-001): اختبار حدود الملكية التقنية.
 *
 * يحرس القرار المعتمد: المالك التقني لسياسات الربح والتوزيع هو **المالية**،
 * وفحص سلامة الحسابات تابع تقنيًا للمالية، والنسخ الاحتياطي والاستعادة تابعان
 * للإعدادات/البيانات، والكتالوج مستهلك للنتائج لا مالكًا لسياسة مالية،
 * والسوق والنقل وحدة مستقبلية بلا أي كاتب مالي في حالة «قريبًا»، وأدواتي
 * المستقلة لا تكتب السجل المالي الرسمي إطلاقًا (و قراءتها له مقصورة على
 * مسارات التوافق الموثقة حتى الموجة الرابعة).
 *
 * هذا اختبار معماري ثابت (نمط routeKnowledgeSync): يقرأ مصادر الإنتاج حية
 * ويفشل عند أي انتهاك جديد — لا يعتمد على تشغيل الصفحات. الاستثناءات
 * الموثقة هنا هي عقد، لا تساهل: كل استثناء يسجل ملفه وسببه.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readRepoFile(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
}

function listSourceFiles(dirRelative: string): string[] {
  const absolute = fileURLToPath(new URL(dirRelative, import.meta.url)).replace(/\/+$/, "");
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = `${dir}/${entry}`;
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) out.push(full);
    }
  };
  walk(absolute);
  return out.map(file => file.slice(file.indexOf("client/src/") + "client/src/".length));
}

const srcFiles = listSourceFiles("..");
/** قراءة ملف إنتاج داخل client/src بمساره النسبي. */
const readSrcFile = (path: string) => readRepoFile(`../${path}`);

/** كتاب المخزن المالي (الطبقة التنفيذية للواجهة) — تستثنى لأنها تنفذ العقد لا تستدعيه. */
const isStorageAdapter = (path: string) => path.startsWith("storage/local/");
const isTestFile = (path: string) => /\.test\.(ts|tsx)$/.test(path);

describe("EXE-017 — حدود الملكية التقنية (خريطة الملكية المعتمدة)", () => {
  it("سياسات التوزيع/التحميل: الكاتب الوحيد خارج طبقة التخزين هو خدمة مالية (recurringWorkService)", () => {
    for (const path of srcFiles) {
      if (isStorageAdapter(path) || isTestFile(path)) continue;
      const content = readSrcFile(path);
      const writerCalls = content.match(/\.(?:saveAllocationPolicy|commitAllocationPolicySuccessor)\s*\(/g);
      if (writerCalls && path !== "application/finance/recurringWorkService.ts") {
        throw new Error(
          `انتهاك ملكية: ${path} يستدعي كاتب سياسة التوزيع مباشرة — الكاتب القانوني الوحيد هو application/finance/recurringWorkService.ts (المالية).`,
        );
      }
    }
    /* الخدمة نفسها موجودة في بيتها المالي — النقل موثق في تقرير الموجة ٣. */
    expect(
      existsSync(fileURLToPath(new URL("../application/finance/recurringWorkService.ts", import.meta.url))),
    ).toBe(true);
  });

  it("سياسات استحقاق المالك: كاتبها الوحيد خارج التخزين هو ownerEntitlementService (المالية)", () => {
    for (const path of srcFiles) {
      if (isStorageAdapter(path) || isTestFile(path)) continue;
      const content = readSrcFile(path);
      const writerCalls = content.match(
        /\.(?:saveOwnerEntitlementPolicy|commitOwnerEntitlementPolicySuccessor)\s*\(/g,
      );
      if (writerCalls && path !== "application/finance/ownerEntitlementService.ts") {
        throw new Error(
          `انتهاك ملكية: ${path} يستدعي كاتب سياسة استحقاق المالك — الكاتب القانوني الوحيد هو application/finance/ownerEntitlementService.ts (المالية).`,
        );
      }
    }
  });

  it("الكتالوج مستهلك للنتائج: لا يستورد خدمة سياسات التوزيع استيرادًا قيميًا (الأنواع فقط مسموحة)", () => {
    const catalogFiles = ["pages/Catalog.tsx", ...listSourceFiles("../components/catalog")];
    const typeOnlyImport =
      /import\s+type\s*\{[\s\S]*?\}\s*from\s*"@\/application\/finance\/recurringWorkService";?/g;
    for (const relative of catalogFiles) {
      const content = readSrcFile(relative);
      const remaining = content.replace(typeOnlyImport, "");
      expect(
        remaining.includes("@/application/finance/recurringWorkService"),
        `${relative} يستورد recurringWorkService خارج نمط «أنواع فقط» — الطريق القانوني الوحيد للكتالوج هو سياق الخدمات (usePrototypeServices).`,
      ).toBe(false);
    }
  });

  it("أدواتي المستقلة: لا كاتبًا ماليًا في صفحاتها — كتابها الوحيد مخزن التقديرات المستقل", () => {
    const toolsPages = [
      "pages/Tools.tsx",
      "pages/ToolsIntegrity.tsx",
      "pages/CostCalculator.tsx",
      "pages/EstimateDetail.tsx",
    ];
    /* أسماء الكتاب الممنوعة على أي خدمة غير costEstimates (مخزن الأداة المستقل). */
    const writerPattern =
      /\.(?:save|create|record|commit|update|delete|remove|reverse|deactivate|collect|distribute|confirm|reset|edit|restore)\w*\s*\(/g;
    for (const relative of toolsPages) {
      const content = readRepoFile(`../${relative}`);
      /* كتاب التقديرات نفسه مباح — الأداة تملك مخزنها. */
      const withoutEstimateWriters = content.replace(/costEstimates\.\w+\s*\(/g, "allowed(");
      const violations = withoutEstimateWriters.match(writerPattern) ?? [];
      expect(
        violations,
        `${relative} يستدعي كاتبًا خارج مخزن التقديرات المستقل (${violations.join(", ")}) — الأداة المستقلة لا تكتب السجل المالي الرسمي.`,
      ).toEqual([]);
    }
  });

  it("أدواتي: خدمات السياق المستهلكة محصورة في قائمة التوافق الموثقة (لا قارئ سجل جديد)", () => {
    /* قائمة التوافق بعد P-4.2-2 (F03/T4/T5/T6): أدواتي أدوات مستقلة فقط —
     * حُذفت قراءات partyLedger/supplierPurchases (شارات الوحدات) وبطاقة
     * النسخ وصف السوق الميت وقسم حالة الوحدات كله. صفحة ToolsIntegrity
     * (مسار التوافق /tools/integrity — قرار F05) تستهلك فحص المالية وحده. */
    const allowedServicesByPage: Record<string, readonly string[]> = {
      "pages/Tools.tsx": ["costEstimates", "dataVersion", "notifyDataChanged"],
      "pages/ToolsIntegrity.tsx": ["integrityCheck"],
      "pages/CostCalculator.tsx": ["dataVersion", "costEstimates", "inventory", "notifyDataChanged"],
      "pages/EstimateDetail.tsx": ["dataVersion", "costEstimates", "notifyDataChanged"],
    };
    for (const [relative, allowed] of Object.entries(allowedServicesByPage)) {
      const content = readRepoFile(`../${relative}`);
      const destructure = content.match(/const\s*\{([^}]*)\}\s*=\s*usePrototypeServices\(\)/);
      expect(
        destructure,
        `${relative} لم يعد يستخدم سياق الخدمات — حدّث قائمة التوافق في هذا الاختبار.`,
      ).not.toBeNull();
      const consumed = (destructure?.[1] ?? "")
        .split(",")
        .map(name => name.trim())
        .filter(name => name.length > 0);
      const unexpected = consumed.filter(name => !allowed.includes(name));
      expect(
        unexpected,
        `${relative} يستهلك خدمات خارج قائمة التوافق (${unexpected.join(", ")}) — قراءة السجل المالي الرسمي من أدواتي قرار موثق لا إضافة صامتة.`,
      ).toEqual([]);
    }
  });

  it("السوق والنقل (قريبًا): لا خدمة ولا كتابة — إعلان صادق بلا أثر", () => {
    const market = readRepoFile("../pages/Market.tsx");
    expect(market.includes("usePrototypeServices")).toBe(false);
    expect(market.includes("@/application/")).toBe(false);
    expect(market.includes("@/storage/local/")).toBe(false);
    /* مدخل النقل والتوصيل الحالي: حوار الترويسة — بلا خدمات أو كتابة. */
    const header = readRepoFile("../components/layout/AppHeader.tsx");
    expect(header.includes("usePrototypeServices")).toBe(false);
    expect(header.includes("@/application/")).toBe(false);
  });

  it("النسخ الاحتياطي والاستعادة: خدمات النقل محصورة في وحدة الإعدادات وجذر التركيب", () => {
    /* وحدة الإعدادات/البيانات تملك النسخ والاستعادة: صفحتها ومكوناتها
     * (components/settings/*) وجذر التركيب الذي يبني الخدمات. */
    const isSettingsUnit = (path: string) =>
      path === "pages/Settings.tsx" ||
      path === "app/PrototypeServicesContext.tsx" ||
      path.startsWith("components/settings/");
    for (const path of srcFiles) {
      if (isTestFile(path)) continue;
      const content = readSrcFile(path);
      const transferImport = content.match(
        /(?:from\s*"|import\s*")@\/application\/transfers\/(?:localTransferService|guidedOpeningImportService)"/,
      );
      if (transferImport && !isSettingsUnit(path)) {
        throw new Error(
          `انتهاك ملكية: ${path} يستورد خدمات النقل/الاستعادة — المالك التقني هو الإعدادات/البيانات (pages/Settings.tsx) وجذر التركيب وحدهما.`,
        );
      }
    }
  });

  it("فحص سلامة الحسابات: خدمته مقيمة في بيت المالية (المالك التقني)", () => {
    expect(
      existsSync(fileURLToPath(new URL("../application/finance/integrityCheckService.ts", import.meta.url))),
    ).toBe(true);
  });
});
