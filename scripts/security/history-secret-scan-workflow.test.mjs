/**
 * R11 W1b-5 / D-16 (OD-SEC — A_PLUS_C): اختبارات شكل سير عمل مسح التاريخ
 * الدوري — تثبّت الخصائص الأمنية المقررة قرارًا ولا تسمح بانجرافها الصامت:
 *
 *  - non-blocking: مجدول + يدوي فقط؛ لا يعمل على PRs إطلاقًا.
 *  - least-privilege: صلاحية قراءة وحدها؛ لا write token؛ لا اعتماد محفوظ.
 *  - مرجع action واحد مثبت بالبصمة الكاملة المعتمدة نفسها في ci.yml.
 *  - أحمر عند الاكتشاف أو خطأ الماسح: لا continue-on-error في أي خطوة؛
 *    خطوة المسح هي الماسح نفسه بأكواد خروجه (0/1/2).
 *  - مخرجات بصمات فقط عبر الماسح الكنوني (--report) على مرآة نظيفة
 *    (git clone --mirror) بكل المراجع.
 *  - لا فتح issues تلقائيًا ولا تعليقات PR ولا أي نداء شبكة بصلاحيات.
 *
 * النص هو المصدر (نمط ci-audit-gate.test.mjs): التحليل النصي المقرر
 * المدقق بالاختبار — لا اعتمادية YAML جديدة تدخل المستودع.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "vitest";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const WORKFLOW = path.join(REPO_ROOT, ".github", "workflows", "history-secret-scan.yml");
const CI_WORKFLOW = path.join(REPO_ROOT, ".github", "workflows", "ci.yml");

function readWorkflow() {
  assert.ok(fs.existsSync(WORKFLOW), "history-secret-scan.yml must exist");
  return fs.readFileSync(WORKFLOW, "utf8");
}

describe("history-secret-scan workflow shape (R11 W1b-5 / OD-SEC)", () => {
  it("non-blocking by design: scheduled + manual dispatch only — never on pull_request or push", () => {
    const text = readWorkflow();
    assert.match(text, /on:\s*\n\s*schedule:/, "must be scheduled");
    assert.match(text, /workflow_dispatch:/, "must support manual dispatch");
    assert.doesNotMatch(text, /pull_request:/, "must not run on pull requests (non-blocking)");
    assert.doesNotMatch(text, /push:/, "must not run on push");
  });

  it("least privilege: contents: read only — no other permission scope, no write token", () => {
    const text = readWorkflow();
    const permissionsBlock = text.match(/permissions:\s*\n((?:\s+\w+:\s*\w+\s*\n)+)/);
    assert.ok(permissionsBlock, "a permissions block must exist");
    assert.match(permissionsBlock[1], /contents:\s*read/, "contents must be read-only");
    assert.equal(
      (permissionsBlock[1].match(/\w+:/g) ?? []).length,
      1,
      "exactly one permission scope (contents) — no write scopes",
    );
    assert.doesNotMatch(text, /\$\{\{\s*secrets\./, "no repository secrets are consumed");
    assert.doesNotMatch(text, /GITHUB_TOKEN/, "no explicit token manipulation");
  });

  it("uses the single checkout action pinned by the exact SHA approved in ci.yml, with persist-credentials: false", () => {
    const text = readWorkflow();
    const ciPin = fs.readFileSync(CI_WORKFLOW, "utf8").match(/actions\/checkout@([0-9a-f]{40})/);
    assert.ok(ciPin, "ci.yml must carry the pinned checkout SHA");
    const uses = text.match(/uses:\s*([^\s]+)/g) ?? [];
    assert.ok(uses.length > 0, "the workflow uses at least one action");
    for (const use of uses) {
      assert.match(use, /actions\/checkout@[0-9a-f]{40}/, `action must be SHA-pinned: ${use}`);
      assert.match(
        use,
        new RegExp(`actions/checkout@${ciPin[1]}`),
        "the pin must equal ci.yml's approved SHA",
      );
    }
    assert.match(text, /persist-credentials:\s*false/, "credentials must not persist after checkout");
  });

  it("red on finding or scanner error: no continue-on-error anywhere; the scan step runs the canonical scanner", () => {
    const text = readWorkflow();
    assert.doesNotMatch(text, /continue-on-error/, "no step may mask a failure as success");
    assert.match(
      text,
      /node scripts\/security\/scan-git-history-secrets\.mjs [^\n]*--report/,
      "the scan step must invoke the canonical scanner with --report",
    );
    /* الماسح: 0 نظيف / 1 اكتشافات منقحة / 2 خطأ — أكواد الخروج تمر كما هي
     * فأي غير صفر يفشل الخطوة والوظيفة (أحمر). */
  });

  it("scans a fresh full mirror (all refs) — clone --mirror, bare assertion", () => {
    const text = readWorkflow();
    assert.match(text, /git clone --mirror/, "must clone a fresh mirror");
    assert.match(text, /rev-parse --is-bare-repository/, "must assert the mirror is bare");
    assert.doesNotMatch(
      text,
      /fetch-depth:\s*0/,
      "the scanner checkout needs no history (the mirror carries it)",
    );
  });

  it("no automated issue/PR/notification calls — the run status IS the notification", () => {
    const text = readWorkflow();
    assert.doesNotMatch(
      text,
      /gh\s+api|curl\s|octokit|issues\/|\/comments/,
      "no API calls that need write scopes",
    );
    assert.match(
      text,
      /if:\s*always\(\)/,
      "the report step still publishes after a failed scan (informational)",
    );
  });

  it("the scanner's shared pattern table is untouched by this workflow (guard-level invariant)", () => {
    /* سير العمل لا ينسخ جدول الأنماط أبدًا — الماسح يستورده من حارس شجرة
     * العمل (اختبار الماسح نفسه يثبت ذلك: pattern-source sharing). هنا
     * نثبت أن ملف السير لا يحمل أي جدول أنماط خاصًا به. */
    const text = readWorkflow();
    assert.doesNotMatch(
      text,
      /ghp_|github_pat_|AKIA|xox|AIza|npm_|sk-ant|glpat/,
      "no pattern literals in the workflow",
    );
  });
});
