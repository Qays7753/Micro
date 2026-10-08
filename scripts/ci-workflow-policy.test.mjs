/**
 * الخطوة ٤ (برنامج تصحيح ما بعد المسح لPR #316 — 2026-10-06): تحقق ثابت
 * (static) من سياسة أحداث/فروع سير عمل CI — سلوك الأحداث المقصود يصبح
 * قابلًا للفحص بدل افتراضه.
 *
 * السلوك المقصود المثبت هنا (من بطاقة الخطوة ٤ + تصويب R4-A4 المؤرخ):
 *  1) pull_request بلا مرشح فروع → CI على كل PR (بوابة الدمج الإلزامية)؛
 *  2) الدفع إلى main يشغّل CI (تحقق ما بعد الدمج على main)؛
 *  3) الوسوم v* تشغّل الفحوص نفسها (سياسة المجموعة ٦ AR-01/AR-03/AR-10)؛
 *  4) تنفيذ يدوي (workflow_dispatch) متاح ولا يشغّل نفسه؛
 *  5) لا سير عمل موازٍ مكرر (ملف workflows واحد فقط يملك الفحوص).
 *
 * R4-A4 [تصويب مؤرخ 2026-10-08 — إغلاق R3-N5]: حُذف سطر فرع التنفيذ
 * المخصص المتقاعد refactoring/post-scan-structural-completion-20261005
 * بموجب قرار المالك المفوض في أمر R4 — الفرع غير موجود على origin فكان
 * المحفز لا يمكن أن يشتعل أبدًا؛ موجتا R2/R3 اتبعتا نمط PR-first ولم
 * تضيفا فروعهما. أي فرع تنفيذ مستقبلي يحتاج شهادة CI على رؤوسه قبل فتح
 * PR يضيف سطره المسمى حصرًا بقرار مالك موثق في نفس الـPR (لا توسيع
 * لـrefactoring/** ولا أنماط نجمة).
 * التحليل نصي مقصود (بدل تبعية YAML parser جديدة): الملف صغير ومحروس
 * بهذا الاختبار نفسه — أي إعادة تشكيل للصيغة تكسر الاختبار فتُراجَع عمدًا.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CI_PATH = path.join(REPO_ROOT, ".github", "workflows", "ci.yml");
const WORKFLOWS_DIR = path.join(REPO_ROOT, ".github", "workflows");

function readCi() {
  return fs.readFileSync(CI_PATH, "utf8");
}

describe("ci-workflow-policy (Step 4 — intended event/branch behavior)", () => {
  it("pull_request has no branch filter — CI runs for every PR (merge-gate evidence)", () => {
    const ci = readCi();
    expect(ci).toMatch(/^  pull_request:\s*$/m);
  });

  it("push triggers exactly main + v* tags — retired dedicated branch removed with its owner decision (R4-A4)", () => {
    const ci = readCi();
    const pushBlock = ci.split("on:")[1].split("permissions:")[0];
    expect(pushBlock).toContain("- main");
    /* لا توسيع لأنماط الفروع: أي نجم أو نمط مثل refactoring/** ممنوع. */
    expect(pushBlock).not.toMatch(/-\s+.*\*/);
    expect(pushBlock).toContain('tags: ["v*"]');
    /* الفرع المخصص المتقاعد لا يعود (قرار المالك R4-A4 — إغلاق R3-N5). */
    expect(pushBlock).not.toContain("post-scan-structural-completion-20261005");
  });

  it("manual execution is supported via workflow_dispatch", () => {
    const ci = readCi();
    expect(ci).toMatch(/^  workflow_dispatch:\s*$/m);
  });

  it("no duplicate CI workflow exists (single checks workflow)", () => {
    const files = fs.readdirSync(WORKFLOWS_DIR).filter(f => f.endsWith(".yml") || f.endsWith(".yaml"));
    expect(files).toEqual(["ci.yml"]);
  });

  it("the audit step calls the fixed, testable script (Step 2 wiring pin)", () => {
    const ci = readCi();
    expect(ci).toMatch(/run: bash scripts\/ci-audit-step\.sh/);
    /* النمط المعيب القديم لا يعود: حلقة inline تلقط الخرج بعد fi (بلا else). */
    expect(ci).not.toContain("for attempt in 1 2 3");
    expect(ci).not.toMatch(/fi\s*\n\s*code=\$\?/);
  });

  it("checkout keeps full history (PR whitespace check needs merge base)", () => {
    const ci = readCi();
    expect(ci).toContain("fetch-depth: 0");
  });
});
