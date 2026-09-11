/** التحصين الكامل (المجموعة ٦): فحص اتساق الحوكمة والتوثيق الحي مع الحقيقة على
 * الفرع — §36 يسجل الحراس والسياسات والبوابة، وAGENTS.md يحمل قواعد التنفيذ
 * وبوابة المسح الهيكلي، وقالب PR يحمل الحقول الإلزامية، والأرقام الحدية
 * (35/27، سقف lint، سقفا الحزمة) متطابقة بين الكود والتوثيق بلا رفع صامت،
 * والمسح الهيكلي بعد المجموعة ٦ موثق ولم يبدأ ولا يجوز بدؤه تلقائيًا. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { localSchemaVersion, localExportVersion } from "@/storage/local/types";
import { GZIP_BYTE_LIMIT, RAW_BYTE_LIMIT } from "../../scripts/check-bundle-budget.mjs";

function readRepoFile(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
}

/** يوحّد الفراغات (التغليف عبر الأسطر لا يكسر التوكّد). */
function normalize(text: string): string {
  return text.replace(/\s+/g, " ");
}

const agents = readRepoFile("../../../../AGENTS.md");
const currentState = readRepoFile("../../../../docs/operations/current-state.md");
const todo = readRepoFile("../../../../todo.md");
const prTemplate = readRepoFile("../../../../.github/pull_request_template.md");
const sliceTemplate = readRepoFile("../../../../docs/operations/slice-handoff-template.md");
const rootPackageJson = JSON.parse(readRepoFile("../../../../package.json"));
const rootVitestConfig = readRepoFile("../../../../vitest.config.ts");
const manifest = JSON.parse(readRepoFile("../../../../docs/quality/persistent-entity-touchpoints.json"));

describe("governance consistency — Group 6 prevention implemented on the remediation branch", () => {
  it("AGENTS.md carries the Group 6 execution rules (pre-read, understanding card, boundaries, stop rules)", () => {
    const rules = normalize(agents);
    expect(rules).toContain("## 10. قواعد التنفيذ غير القابلة للتفاوض");
    expect(rules).toContain("بطاقة فهم مكتوبة قبل الكود");
    expect(rules).toContain("خارج النطاق");
    expect(rules).toContain("حد الاستعادة");
    expect(rules).toContain("لا كتابة عمياء (blind read-modify-write)");
    expect(rules).toContain("localStorage");
    expect(rules).toContain("persistent-entity-touchpoints.json");
    expect(rules).toContain("check-secrets.mjs");
    expect(rules).toContain("check-test-focus.mjs");
    expect(rules).toContain("الافتراض الصامت لاستكمال التنفيذ ممنوع");
    expect(rules).toContain("شريحة واحدة قابلة للمراجعة");
    expect(rules).toContain("لا قواعد مجال");
  });

  it("AGENTS.md records the mandatory post-Group 6 structure-scan gate WITHOUT authorizing refactoring", () => {
    const gate = normalize(agents);
    expect(gate).toContain("## 11. بوابة ما بعد المجموعة ٦");
    expect(gate).toContain("المسح الهيكلي للقراءة فقط");
    expect(gate).toContain("لا يبدأ أي إعادة هيكلة بنيوية أو نقل ملفات جماعي");
    expect(gate).toContain("المالك يراجع المكتشفات ويقررها قبل بدء أي معالجة هيكلية معتمدة");
    expect(gate).toContain("لم يُنفذ المسح");
  });

  it("the PR template requires every mandated field with explicit not-applicable reasons", () => {
    const template = normalize(prTemplate);
    expect(template).toContain("الملفات/الوحدات المتغيرة");
    expect(template).toContain("ما لم يتغير عمدًا");
    expect(template).toContain("أثر المخطط/التصدير/الاستيراد/الترحيل");
    expect(template).toContain("الثبات التاريخي والعكس");
    expect(template).toContain("التزامن/الحتمية/إعادة المحاولة");
    expect(template).toContain("RTL/الوصول/الوضعين");
    expect(template).toContain("اختبارات النجاح");
    expect(template).toContain("اختبارات الفشل");
    expect(template).toContain("الترحيل/التوافق (released pairs/envelopes)");
    expect(template).toContain("التزامن/إعادة المحاولة");
    expect(template).toContain("حد الاستعادة (rollback boundary)");
    expect(template).toContain("فحص الأسرار والملفات المولدة");
    expect(template).toContain("المؤجل/القيود المعروفة");
    expect(template).toContain("قرار المالك مطلوب؟");
    expect(template).toContain("لا ينطبق — السبب");
    expect(template).toContain("المسح الهيكلي للقراءة فقط");
    expect(normalize(sliceTemplate)).toContain("حد الاستعادة (rollback boundary)");
    expect(normalize(sliceTemplate)).toContain("المسح الهيكلي للقراءة فقط");
  });

  it("current-state §36 records the guard map, policies, and the merge gate posture", () => {
    const section36 = normalize(currentState.split("## §36.")[1] ?? "");
    expect(section36).not.toBe("");
    expect(section36).toContain("pnpm guards");
    expect(section36).toContain("check-secrets.mjs");
    expect(section36).toContain("check-test-focus.mjs");
    expect(section36).toContain("check-entity-touchpoints.mjs");
    expect(section36).toContain("persistent-entity-touchpoints.json");
    expect(section36).toContain("٣٥/٢٧ بلا تغيير");
    expect(section36).toContain("37/37");
    expect(section36).toContain("650_000");
    expect(section36).toContain("155_000");
    expect(section36).toContain("بوابة الدمج النهائية");
    expect(section36).toContain("لا إعادة هيكلة");
    expect(section36).toContain("AGENTS.md");
  });

  it("schema/export versions stay 35/27 and the limits stay pinned between code and docs (no silent raise)", () => {
    expect(localSchemaVersion).toBe(35);
    expect(localExportVersion).toBe(27);
    expect(RAW_BYTE_LIMIT).toBe(650_000);
    expect(GZIP_BYTE_LIMIT).toBe(155_000);
    const lintScript = rootPackageJson.scripts?.lint ?? "";
    expect(lintScript).toContain("--max-warnings 37");
    expect(lintScript).toContain("src");
    expect(lintScript).toContain("tests");
    expect(lintScript).toContain("apps/prototype-web/client/src");
    const section36 = normalize(currentState.split("## §36.")[1] ?? "");
    expect(section36).toContain("٣٥/٢٧ بلا تغيير");
    expect(section36).toContain("37/37");
  });

  it("the guards are wired into the canonical check chain and the test path (local == CI)", () => {
    expect(rootPackageJson.scripts?.guards).toContain("check-secrets.mjs");
    expect(rootPackageJson.scripts?.guards).toContain("check-test-focus.mjs");
    expect(rootPackageJson.scripts?.guards).toContain("check-entity-touchpoints.mjs");
    expect(rootPackageJson.scripts?.check).toContain("pnpm guards");
    expect(rootVitestConfig).toContain("scripts/**/*.test.mjs");
  });

  it("the persistent-entity manifest exists, covers all 32 stores, and states its honest limits", () => {
    expect(manifest.objectStores).toHaveLength(32);
    const notExported = manifest.objectStores.filter(entry => entry.snapshotField === null);
    expect(notExported.map(entry => entry.store).sort()).toEqual(["form-drafts", "local-security"]);
    for (const entry of notExported) {
      expect(entry.notExportedReason.length).toBeGreaterThanOrEqual(10);
    }
    expect(manifest.localOnlyRecords.map(record => record.record)).toContain("micro.diagnostics.v1");
    expect(manifest.policy).toContain("لا يثبت كفاية الاختبارات دلاليًا");
  });

  it("todo reflects the program truth: Group 6 implemented on the branch, structure scan NOT started", () => {
    const group6 = todo
      .split("\n")
      .find(
        line => line.includes("المجموعة ٦ — برنامج التحصين الكامل") && line.trimStart().startsWith("- ["),
      );
    expect(group6).toBeDefined();
    expect(group6?.trimStart().startsWith("- [x]")).toBe(true);
    expect(group6).toContain("PR #159 مفتوح وغير مدموج");
    const scanGate = todo
      .split("\n")
      .find(line => line.includes("بوابة ما بعد البرنامج") && line.trimStart().startsWith("- ["));
    expect(scanGate).toBeDefined();
    expect(scanGate?.trimStart().startsWith("- [ ]")).toBe(true);
    expect(scanGate).toContain("للقراءة فقط، لم تبدأ");
    expect(scanGate).toContain("قبل موافقة المالك");
  });
});
