import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  CLASSIFIED_DIALOG_SURFACES,
  checkA11yDialogSurfaces,
  declaredDialogSurfaces,
} from "./check-a11y-dialog-surfaces.mjs";
import { ROOT } from "./check-runtime-cycles.mjs";

/* R11 W4-0 (موجة المتابعة 2026-10-15): اختبار حارس نماذج التفاعل نفسه —
 * يثبت أنه يمر على الشجرة الحية بالسجل المصنف، ويرفض سطحًا حواريًا جديدًا
 * غير مصنف، ويرفض انجراف الدور أو aria-modal عن السجل، ويرفض التسجيل
 * المتقادم، ويستخرج التصريحات من JSX كافة (نصية وتعبيرية). */

const CLIENT_SRC = path.join("apps", "prototype-web", "client", "src");

function tempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "a11y-dialog-guard-"));
  fs.mkdirSync(path.join(dir, CLIENT_SRC, "pages"), { recursive: true });
  return dir;
}

function writeClientFile(dir, rel, content) {
  const target = path.join(dir, CLIENT_SRC, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
}

function runCli(repoRoot) {
  return execFileSync(
    process.execPath,
    [path.join(ROOT, "scripts", "check-a11y-dialog-surfaces.mjs"), repoRoot],
    { encoding: "utf8" },
  );
}

describe("check-a11y-dialog-surfaces (R11 W4-0 interaction-model census guard)", () => {
  it("passes on the live repository tree with the classified registry", () => {
    const stdout = runCli(ROOT);
    expect(stdout).toContain("PASS");
    /* UNIT-001 (r11-unit001-20261018): حوار معلومات الإعداد في Setup صُنف في
     * نفس الـPR — السجل صار 8 أسطح (7 ملفات بتصريح حي). */
    expect(stdout).toMatch(/8 سطحًا حواريًا مصنفًا/);
    const { ok, stats } = checkA11yDialogSurfaces(ROOT);
    expect(ok).toBe(true);
    expect(stats.classified).toBe(8);
  });

  it("extracts string and expression dialog declarations from JSX", () => {
    const surfaces = declaredDialogSurfaces(
      "probe.tsx",
      [
        "export function P({ label }) {",
        "  return (",
        '    <div role="dialog" aria-modal="true" aria-label={label}>x</div>',
        "  );",
        "}",
        "",
      ].join("\n"),
    );
    expect(surfaces).toHaveLength(2);
    expect(surfaces.find(s => s.kind === "role")?.value).toBe("dialog");
    expect(surfaces.find(s => s.kind === "aria-modal")?.value).toBe("true");
  });

  it("rejects a NEW unclassified dialog surface (must be classified in the same PR)", () => {
    const dir = tempRepo();
    writeClientFile(
      dir,
      "pages/Probe.tsx",
      'export const P = () => <div role="alertdialog" aria-modal="true">x</div>;\n',
    );
    const { ok, violations } = checkA11yDialogSurfaces(dir);
    expect(ok).toBe(false);
    expect(violations.some(v => v.rule === "unclassified-dialog-surface" && v.key.includes("pages/Probe.tsx"))).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("rejects role drift against the registry (intended change updates the registry in-PR)", () => {
    const dir = tempRepo();
    const target = CLASSIFIED_DIALOG_SURFACES.find(s => s.role === "dialog" && s.file.includes("AppHeader"));
    writeClientFile(
      dir,
      target.file,
      'export const P = () => <div role="alertdialog" aria-modal="false">x</div>;\n',
    );
    const { ok, violations } = checkA11yDialogSurfaces(dir);
    expect(ok).toBe(false);
    expect(violations.some(v => v.rule === "dialog-role-drift")).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("rejects aria-modal drift against the registry", () => {
    const dir = tempRepo();
    const target = CLASSIFIED_DIALOG_SURFACES.find(s => s.file.includes("QuickActionSheet"));
    writeClientFile(
      dir,
      target.file,
      'export const P = () => <div role="alertdialog" aria-modal="true">x</div>;\n',
    );
    const { ok, violations } = checkA11yDialogSurfaces(dir);
    expect(ok).toBe(false);
    expect(violations.some(v => v.rule === "unexpected-aria-modal")).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("rejects a stale classified file (left the tree)", () => {
    const dir = tempRepo();
    writeClientFile(dir, "pages/Unrelated.tsx", "export const x = 1;\n");
    const { ok, violations } = checkA11yDialogSurfaces(dir);
    expect(ok).toBe(false);
    expect(violations.some(v => v.rule === "classified-file-stale")).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("the region-regression probe activates only after D-13 executes (INLINE_MISDECLARED retires)", () => {
    /* اليوم السجل يحمل INLINE_MISDECLARED فلا يعمل مسبار الارتداد؛ بعد D-13
     * يتقاعد الصنف ويعمل المسبار — تثبيت الصلة السببية نفسها. */
    const hasMisdeclared = CLASSIFIED_DIALOG_SURFACES.some(s => s.model === "INLINE_MISDECLARED");
    const dir = tempRepo();
    writeClientFile(dir, "pages/RecurringExpenseDetail.tsx", 'export const x = <div role="dialog" />;\n');
    const { violations } = checkA11yDialogSurfaces(dir);
    if (hasMisdeclared) {
      expect(violations.some(v => v.rule === "inline-region-regression")).toBe(false);
    } else {
      expect(violations.some(v => v.rule === "inline-region-regression")).toBe(true);
    }
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
