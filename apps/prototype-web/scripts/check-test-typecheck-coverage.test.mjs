/** R10-B5/NF-020 جزء 2 — سلبيات حارس تغطية التدقيق النوعي (نمط الكثافة):
 * الأنماط الثلاثة المرفوضة (نمط استثناء عائد، ملف اختبار خارج البرنامج)
 * والنظافة الكاملة على التكوين الحي. لا شبكة ولا تعديل حي. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  checkCoverage,
  excludePatternMatchesTests,
  listTestFiles,
  loadTsconfig,
} from "./check-test-typecheck-coverage.mjs";

function tempApp(tsconfigExclude) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nf020-cov-"));
  fs.mkdirSync(path.join(dir, "client", "src"), { recursive: true });
  fs.mkdirSync(path.join(dir, "node_modules", "typescript", "bin"), { recursive: true });
  const excludeJson = tsconfigExclude === null ? "" : `,\n  "exclude": ${JSON.stringify(tsconfigExclude)}`;
  fs.writeFileSync(
    path.join(dir, "tsconfig.json"),
    `{\n  "include": ["client/src/**/*"]${excludeJson},\n  "compilerOptions": { "noEmit": true }\n}\n`,
  );
  fs.writeFileSync(path.join(dir, "client", "src", "app.test.ts"), 'it("x", () => {});\n');
  return dir;
}

/* tsc غير موجود في الأجنحة المؤقتة — نمرر برنامجًا صريحًا بدل تشغيله. */
const programFor = dir => [path.join(dir, "client", "src", "app.test.ts")];
const programEmpty = () => [];

describe("check-test-typecheck-coverage negatives (NF-020 part 2)", () => {
  it("flags the retired exclusion pattern itself, in any known spelling", () => {
    expect(excludePatternMatchesTests("**/*.test.ts")).toBe(true);
    expect(excludePatternMatchesTests("**/*.test.tsx")).toBe(true);
    expect(excludePatternMatchesTests("*.spec.ts")).toBe(true);
    expect(excludePatternMatchesTests("node_modules")).toBe(false);
    expect(excludePatternMatchesTests("dist")).toBe(false);
  });

  it("fails closed when the exclusion pattern returns", () => {
    const dir = tempApp(["node_modules", "**/*.test.ts"]);
    const result = checkCoverage(dir, { program: programFor(dir) });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("EXCLUSION_PATTERN_RETURNED");
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("fails closed when a test file is outside the typecheck program", () => {
    const dir = tempApp(["node_modules", "build", "dist"]);
    const result = checkCoverage(dir, { program: programEmpty() });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("TEST_FILE_OUTSIDE_TYPECHECK");
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("the live config is clean and the live test census is non-empty", () => {
    expect(loadTsconfig().exclude ?? []).not.toContain("**/*.test.ts");
    expect(listTestFiles().length).toBeGreaterThan(200);
    /* البرنامج الحي يُفحص في المسار الرسمي (pnpm guards) لا هنا — بلا تكرار بطيء. */
  });
});
