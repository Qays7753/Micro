import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { commitsInRange, filesInCommit, scanCommitRange } from "./check-secrets-range.mjs";

/* SEC-GIT-001 (Post-Group 6 Wave 5 / DOC-041): اختبار انحداري لفاحص أسرار
 * المدى الجديد — مستودع مؤقت حقيقي بثلاثة التزامات: نظيف، ثم سر مزيف في
 * الالتزام الثاني (يُزال في الثالث — سيناريو «دُفع ثم أُزيل» الذي لا يراه
 * الفحص الحي أبدًا)، ثم نظيف. المدى الكامل يصطاد السر؛ المدى بعد إزالته
 * نظيف. المخرجات منقّحة — لا يظهر النص المطابق أبدًا. */

/* العينة المزيفة تُبنى من قطع بلا نمط حرفي في الملف — حارس الأسرار الحي
 * يمسح ملفات الاختبار نفسها، فلا يجوز أن يكون النمط نصًّا مصمتًا هنا. */
const FAKE_TOKEN = ["github", "pat", "11", "FAKE".repeat(12), "END"].join("_");
const SECRET_LINE = `GITHUB_TOKEN=${FAKE_TOKEN}`;
const SELF = fileURLToPath(import.meta.url);

function tempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "secrets-range-"));
  const run = (cmd, args) => execFileSync(cmd, args, { cwd: dir, encoding: "utf8" });
  run("git", ["init", "-q", "--initial-branch=main"]);
  run("git", ["config", "user.email", "test@example.test"]);
  run("git", ["config", "user.name", "Test"]);
  const commit = (name, files) => {
    for (const [file, content] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
      fs.writeFileSync(path.join(dir, file), content, "utf8");
    }
    run("git", ["add", "."]);
    run("git", ["commit", "-q", "-m", name]);
    return run("git", ["rev-parse", "HEAD"]).trim();
  };
  return { dir, run, commit };
}

describe("check-secrets-range (SEC-GIT-001)", () => {
  it("a secret pushed and then REMOVED is still caught in the full pushed range", () => {
    const repo = tempRepo();
    const first = repo.commit("clean base", { "src/a.ts": "export const ok = 1;\n" });
    repo.commit("oops a secret", { "src/config.ts": `${SECRET_LINE}\n` });
    const third = repo.commit("remove the secret", { "src/config.ts": "export const ok = 2;\n" });
    const hits = scanCommitRange(repo.dir, first, third);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some(hit => hit.file === "src/config.ts" && hit.line === 1)).toBe(true);
  });

  it("a clean range passes with zero hits", () => {
    const repo = tempRepo();
    const first = repo.commit("clean base", { "src/a.ts": "export const ok = 1;\n" });
    const second = repo.commit("clean second", { "src/b.ts": "export const ok = 2;\n" });
    expect(scanCommitRange(repo.dir, first, second)).toEqual([]);
  });

  it("the range AFTER the removal is clean (the finding stays attributed to its commit)", () => {
    const repo = tempRepo();
    repo.commit("clean base", { "src/a.ts": "export const ok = 1;\n" });
    const second = repo.commit("oops a secret", { "src/config.ts": `${SECRET_LINE}\n` });
    const third = repo.commit("remove the secret", { "src/config.ts": "export const ok = 2;\n" });
    expect(scanCommitRange(repo.dir, second, third)).toEqual([]);
  });

  it("the output never contains the matched secret text (sanitized by design)", () => {
    const repo = tempRepo();
    const first = repo.commit("clean base", { "src/a.ts": "export const ok = 1;\n" });
    repo.commit("oops a secret", { "src/config.ts": `${SECRET_LINE}\n` });
    const third = repo.commit("remove the secret", { "src/config.ts": "export const ok = 2;\n" });
    const hits = scanCommitRange(repo.dir, first, third);
    const rendered = JSON.stringify(hits);
    expect(rendered).not.toContain("FAKE");
    expect(rendered).not.toContain("github_pat_");
  });

  it("commitsInRange and filesInCommit resolve the pushed surface correctly", () => {
    const repo = tempRepo();
    const first = repo.commit("clean base", { "src/a.ts": "export const ok = 1;\n" });
    const second = repo.commit("adds two files", {
      "src/b.ts": "export const ok = 2;\n",
      "docs/note.md": "# hi\n",
    });
    expect(commitsInRange(repo.dir, first, second)).toHaveLength(1);
    const files = filesInCommit(repo.dir, second).sort();
    expect(files).toEqual(["docs/note.md", "src/b.ts"]);
    /* عزل الملف الذاتي: فاحص المدى لا يفحص نصوص اختباره هي نفسها (تحتوي
     * نمطًا مزيفًا مقصودًا) — الفحص يعمل على محتوى التزامات git لا على
     * ملفات الاختبار مباشرة، وهذا ما يثبته المستودع المؤقت أعلاه. */
    expect(SELF.endsWith("check-secrets-range.test.mjs")).toBe(true);
  });
});
