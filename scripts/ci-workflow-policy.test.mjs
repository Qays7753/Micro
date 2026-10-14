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
 *  5) لا سير عمل موازٍ مكرر — قائمة ملفات workflows محصورة بالاسم
 *     حصرًا: ci.yml وحده يملك الفحوص (بوابة الدمج)، وhistory-secret-scan.yml
 *     (R11 W1b-5 / OD-SEC، قرار المالك A_PLUS_C — NON_BLOCKING_RECURRING)
 *     مسموح بالاسم لأنه ماسح تاريخ مجدول لا يعمل على PRs ولا الدفع
 *     أبدًا — مسنود أدناه بتثبيت آلي لأحداثه (لا pull_request/push).
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

  it("the workflows directory is exactly the two named files (single checks workflow + the OD-SEC scheduled history scanner)", () => {
    const files = fs.readdirSync(WORKFLOWS_DIR).filter(f => f.endsWith(".yml") || f.endsWith(".yaml"));
    /* R11 W1b-5: قائمة محصورة بالاسم — لا ملف ثالث يظهر بصمت؛ ci.yml
     * يبقى سير عمل الفحوص الوحيد، وhistory-secret-scan.yml هو ماسح
     * التاريخ المجدول المعتمد (A_PLUS_C) فقط. */
    expect(files.sort()).toEqual(["ci.yml", "history-secret-scan.yml"]);
  });

  it("history-secret-scan never triggers on PRs or pushes (OD-SEC A_PLUS_C non-blocking, machine-pinned)", () => {
    const scan = fs.readFileSync(path.join(WORKFLOWS_DIR, "history-secret-scan.yml"), "utf8");
    /* اقتطاع سطري المرساة (^…$m) — «cron:» و«runs-on:» يحتويان «on:»
     * حرفيًا كنص جزئي، فالاقتطاع البسيط على «on:» يقطع الكتلة مبكرًا. */
    const onBlock = scan.split(/^on:$/m)[1].split(/^permissions:$/m)[0];
    expect(onBlock).not.toMatch(/pull_request|push/);
    expect(onBlock).toContain("schedule:");
    expect(onBlock).toContain("workflow_dispatch:");
    /* نفس عقد least-privilege المفروض على ci.yml أعلاه ينطبق هنا. */
    expect(scan).toContain("persist-credentials: false");
    const permBlock = scan.split(/^permissions:$/m)[1].split(/^concurrency:$/m)[0];
    expect(permBlock).toContain("contents: read");
    expect(permBlock.match(/:\s*(write|admin)/g) ?? []).toEqual([]);
    /* ومرجع الـaction الوحيد مثبت بالبصمة الكاملة نفسها المعتمدة في ci.yml. */
    const uses = [...scan.matchAll(/uses:\s*(\S+)/g)].map(match => match[1]);
    expect(uses.length).toBeGreaterThanOrEqual(1);
    for (const ref of uses) {
      expect(ref, `المرجع ${ref} يجب أن يكون بصمة كاملة`).toMatch(/^[^@]+@[0-9a-f]{40}(#.*)?$/);
    }
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

  /* R10-B5/F-025 (2026-10-13): تكلفة سلسلة التوريد — كلمات المرور الثابتة.
   * أي رجوع إلى وسم عائم أو اعتماد محفوظ يكسر هذه الاختبارات عمدًا. */
  it("every action use is SHA-pinned to a full 40-hex commit (no floating tags)", () => {
    const ci = readCi();
    const uses = [...ci.matchAll(/uses:\s*(\S+)/g)].map(match => match[1]);
    expect(uses.length).toBeGreaterThanOrEqual(4);
    for (const ref of uses) {
      expect(ref, `المرجع ${ref} يجب أن يكون بصمة كاملة`).toMatch(/^[^@]+@[0-9a-f]{40}(#.*)?$/);
    }
  });

  it("checkout does not persist credentials past the step (RV4-N10)", () => {
    const ci = readCi();
    const checkoutBlock = ci.split("- name: Checkout")[1].split("- name:")[0];
    expect(checkoutBlock).toContain("persist-credentials: false");
  });

  it("node-version is an exact pinned minor matching the anchored github-actions toolchain (v22.23.3)", () => {
    const ci = readCi();
    expect(ci).toMatch(/node-version:\s*22\.23\.3\s*$/m);
    /* لا رجوع إلى رقم رئيسي عائم — القياسات المرساة تعتمد الإصدار الدقيق. */
    expect(ci).not.toMatch(/node-version:\s*22\s*$/m);
  });

  it("workflow permissions stay least-privilege (contents: read only)", () => {
    const ci = readCi();
    const permBlock = ci.split("permissions:")[1].split("concurrency:")[0];
    expect(permBlock).toContain("contents: read");
    expect(permBlock.match(/:\s*(write|admin)/g) ?? []).toEqual([]);
  });
});
