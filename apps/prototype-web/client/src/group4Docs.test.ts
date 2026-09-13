/** التحصين الكامل (المجموعة ٤): فحص اتساق التوثيق الحي مع الحقيقة على الفرع —
 * §34 يسجل القياس الفعلي والسقفين المفعّلين والبوابة الواحدة، بلا ادّعاء دمج،
 * والمخطط/التصدير من مصدر الثوابت نفسه، والمجموعتان ٥ و٦ لم تبدآ. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { localSchemaVersion, localExportVersion } from "@/storage/local/types";

const currentState = readFileSync(
  fileURLToPath(new URL("../../../../docs/operations/current-state.md", import.meta.url)),
  "utf8",
);
const todo = readFileSync(fileURLToPath(new URL("../../../../todo.md", import.meta.url)), "utf8");

describe("documentation consistency — Group 4 bundle budget implemented on the remediation branch", () => {
  it("current-state records the Group 4 section (§34) with the measured baseline and the gate", () => {
    expect(currentState).toContain("§34. المجموعة ٤ — برنامج التحصين الكامل");
    const section34 = currentState.split("## §34.")[1] ?? "";
    expect(section34).toContain("check-bundle-budget.mjs");
    expect(section34).toContain("650_000");
    expect(section34).toContain("155_000");
    expect(section34).toContain("build.manifest");
    expect(section34).toContain("closeBundle");
  });

  it("§34 records the exact measured baseline and both ceilings in the same units", () => {
    const section34 = currentState.split("## §34.")[1] ?? "";
    expect(section34).toContain("٦٢٨٬٨٣٨");
    expect(section34).toContain("١٤٨٬٣٨٤");
    expect(section34).toContain("بايت عشري");
    expect(section34).toContain("zlib");
    expect(section34).toContain("مستوى ٩");
  });

  it("§34 states the PR and merge posture — open, unmerged, main unchanged, no silent raise", () => {
    const section34 = currentState.split("## §34.")[1] ?? "";
    expect(section34).toContain("PR #159 مفتوح وغير مدموج");
    expect(section34).toContain("و`main` لم يتغير");
    expect(section34).toContain("سقف نمو لا إذن برفعه");
    expect(section34).toContain("المجموعتان ٥ و٦ لم تبدآ");
  });

  it("schema and export versions stay 35/27 — build tooling touches no store", () => {
    const section34 = currentState.split("## §34.")[1] ?? "";
    expect(section34).toContain("٣٥/٢٧ بلا تغيير");
    expect(String(localSchemaVersion)).toBe("35");
    expect(String(localExportVersion)).toBe("27");
  });

  it("todo marks Group 4 done on the branch and pending merge — not merged", () => {
    const group4Line = todo
      .split("\n")
      .find(
        line => line.includes("المجموعة ٤ — برنامج التحصين الكامل") && line.trimStart().startsWith("- ["),
      );
    expect(group4Line).toBeDefined();
    expect(group4Line?.trimStart().startsWith("- [x]")).toBe(true);
    expect(group4Line).toContain("PR #159 مفتوح وغير مدموج");
    expect(group4Line).toContain("منفذة على الفرع");
    expect(group4Line).toContain("§34");
  });

  it("the canonical build command enforces the gate (package.json wiring)", () => {
    const appPackage = readFileSync(fileURLToPath(new URL("../../package.json", import.meta.url)), "utf8");
    const parsed = JSON.parse(appPackage) as { scripts: Record<string, string> };
    expect(parsed.scripts.build).toBe("vite build && node scripts/check-bundle-budget.mjs");
  });
});
