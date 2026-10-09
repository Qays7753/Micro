/**
 * R5/S3: اختبارات حارس قراءة/كتابة التطبيق — حتمية بلا شبكة ولا نوم؛
 * العينات تُبنى في مجلدات مؤقتة (شجرة مصغرة تحاكي مسارات العائلات الخمس)
 * وتُمسح بعدها.
 *
 * تغطي: الأساس الحي يمر (18 قارئًا مسجلًا)، وكل قاعدة رفض على حدة (استدعاء
 * كتابة بصيغة الوصول، بصيغة المعرف المجرد، replaceSnapshot، clearFormDrafts،
 * ملف موسوم PC-4 فيه كتابة، صف مسجل غادر الشجرة)، وسلوك CLI على الحي.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { READER_FILES, checkApplicationReadWrite } from "./check-application-readwrite.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url).replace(
  /check-application-readwrite\.test\.mjs$/,
  "check-application-readwrite.mjs",
);
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP = path.join("apps", "prototype-web", "client", "src", "application");

const tempDirs = [];
function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "micro-readwrite-"));
  tempDirs.push(dir);
  return dir;
}
afterAll(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

function write(root, rel, content) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf8");
}

/** شجرة مصغرة: طاقم القراءة كله موجودًا وبريئًا من الكتابة. */
function cleanTree() {
  const root = makeTempDir();
  for (const rel of READER_FILES) write(root, path.join(APP, rel), "export const read = () => 1;\n");
  return root;
}

describe("application read/write guard (R5/S3 — readers never write)", () => {
  it("live repo: all 18 registered readers are write-free (zero violations)", () => {
    const result = checkApplicationReadWrite(REPO_ROOT);
    expect(result.ok).toBe(true);
    expect(result.stats.registered).toBe(18);
    expect(result.violations).toEqual([]);
  });

  it("a registered fixture tree passes", () => {
    expect(checkApplicationReadWrite(cleanTree()).ok).toBe(true);
  });

  it("a property-access write call in a reader fails (store.saveX)", () => {
    const root = cleanTree();
    const first = READER_FILES[0];
    write(root, path.join(APP, first), "export const read = (store: { saveX(): void }) => store.saveX();\n");
    const result = checkApplicationReadWrite(root);
    expect(result.ok).toBe(false);
    expect(result.violations).toContainEqual({ rule: "reader-writes", key: expect.stringContaining("saveX()") });
  });

  it("a destructured bare-identifier write call fails (const { commitX } = store)", () => {
    const root = cleanTree();
    const first = READER_FILES[0];
    write(root, path.join(APP, first), "export const read = (commitX: () => void) => commitX();\n");
    const result = checkApplicationReadWrite(root);
    expect(result.ok).toBe(false);
    expect(result.violations.some(v => v.key.includes("commitX()"))).toBe(true);
  });

  it("replaceSnapshot and clearFormDrafts are both banned", () => {
    const root = cleanTree();
    write(root, path.join(APP, READER_FILES[1]), "export const a = (s: any) => s.replaceSnapshot({});\n");
    write(root, path.join(APP, READER_FILES[2]), "export const b = (s: any) => s.clearFormDrafts();\n");
    const result = checkApplicationReadWrite(root);
    expect(result.violations.some(v => v.key.includes("replaceSnapshot()"))).toBe(true);
    expect(result.violations.some(v => v.key.includes("clearFormDrafts()"))).toBe(true);
  });

  it("a PC-4-tagged family file with a write call is auto-enrolled and fails", () => {
    const root = cleanTree();
    write(
      root,
      path.join(APP, "finance", "newReadFamily.ts"),
      "/* PC-4 read-model: demo */\nexport const r = (s: any) => s.saveFinancialEvent({});\n",
    );
    const result = checkApplicationReadWrite(root);
    expect(result.stats.autoEnrolled).toBe(1);
    expect(result.violations.some(v => v.key.includes("newReadFamily.ts") && v.key.includes("saveFinancialEvent()"))).toBe(
      true,
    );
  });

  it("a PC-4-tagged family file without writes passes (the enrollment is not itself a failure)", () => {
    const root = cleanTree();
    write(root, path.join(APP, "budgets", "pureRead.ts"), "/* PC-4 read-model: demo */\nexport const r = 1;\n");
    const result = checkApplicationReadWrite(root);
    expect(result.stats.autoEnrolled).toBe(1);
    expect(result.ok).toBe(true);
  });

  it("a registered reader that left the tree fails (stale row)", () => {
    const root = cleanTree();
    fs.rmSync(path.join(root, APP, READER_FILES[0]));
    const result = checkApplicationReadWrite(root);
    expect(result.violations).toContainEqual({
      rule: "reader-file-stale",
      key: path.join(APP, READER_FILES[0]).split(path.sep).join("/"),
    });
  });

  it("CLI exits 0 on the live repo and 2 on a non-repo path", () => {
    const okRun = spawnSync("node", [SCRIPT_PATH, REPO_ROOT], { encoding: "utf8" });
    expect(okRun.status).toBe(0);
    expect(okRun.stdout).toContain("application-readwrite: PASS");
    const badRun = spawnSync("node", [SCRIPT_PATH, os.tmpdir()], { encoding: "utf8" });
    expect(badRun.status).toBe(2);
  });
});
