/** التحصين الكامل (المجموعة ٣): فحص اتساق التوثيق الحي مع الحقيقة على الفرع —
 * §32 يسجل ما نُفذ فعلًا (رحلة storage_stale، D-031، D-035) بلا ادّعاء دمج،
 * والمخروط/التصدير من مصدر الثوابت نفسه، والمجموعات ٤–٦ لم تبدأ. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { localSchemaVersion, localExportVersion } from "@/storage/local/types";

const currentState = readFileSync(
  fileURLToPath(new URL("../../../../docs/operations/current-state.md", import.meta.url)),
  "utf8",
);
const todo = readFileSync(fileURLToPath(new URL("../../../../todo.md", import.meta.url)), "utf8");

describe("documentation consistency — Group 3 implemented on the remediation branch", () => {
  it("current-state records the Group 3 section (§32) as implemented on the branch", () => {
    expect(currentState).toContain("§32. المجموعة ٣ — برنامج التحصين الكامل");
    expect(currentState).toContain("رحلة استرجاع `storage_stale`");
    expect(currentState).toContain("D-031 — Use Case التصحيح الموثق للحالة المقفلة");
    expect(currentState).toContain("D-035 — معجم التصحيح الموثق");
  });

  it("current-state states the exact PR and merge status — open, unmerged, main unchanged", () => {
    const section32 = currentState.split("## §32.")[1] ?? "";
    expect(section32).toContain("PR #159 مفتوح وغير مدموج");
    expect(section32).toContain("و`main` لم يتغير");
    expect(section32).toContain("بوابة الدمج معلقة");
    expect(section32).toContain("المجموعات ٤–٦ لم تبدأ");
  });

  it("current-state records the honest limitations: no browser runner, no invented diagnostics", () => {
    const section32 = currentState.split("## §32.")[1] ?? "";
    expect(section32).toContain("لا يوجد عدّاء E2E");
    expect(section32).toContain("لم يُخترع نظام تشخيصات");
  });

  it("schema and export versions in the docs match the code constants (35/27)", () => {
    const section32 = currentState.split("## §32.")[1] ?? "";
    expect(section32).toContain("٣٥ / ٢٧ بلا تغيير");
    expect(String(localSchemaVersion)).toBe("35");
    expect(String(localExportVersion)).toBe("27");
  });

  it("todo marks Group 3 done on the branch and pending merge — not merged", () => {
    const group3Line = todo
      .split("\n")
      .find(
        line => line.includes("المجموعة ٣ — برنامج التحصين الكامل") && line.trimStart().startsWith("- ["),
      );
    expect(group3Line).toBeDefined();
    expect(group3Line?.trimStart().startsWith("- [x]")).toBe(true);
    expect(group3Line).toContain("PR #159 مفتوح وغير مدموج");
    expect(group3Line).toContain("منفذة على الفرع");
  });

  it("todo keeps Groups 4-6 of the hardening program not started", () => {
    for (const group of ["المجموعة ٤", "المجموعة ٥", "المجموعة ٦"]) {
      const lines = todo.split("\n").filter(line => line.includes(`${group} — برنامج التحصين الكامل`));
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        expect(line.trimStart().startsWith("- [ ]")).toBe(true);
      }
    }
  });
});
