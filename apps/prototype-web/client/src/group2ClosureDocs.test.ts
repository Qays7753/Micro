/** رقعة إغلاق المجموعة ٢: فحص اتساق التوثيق الحي مع الحقيقة على الفرع.
 * المرجع الحي يجب ألا يدّعي أن المجموعة ٢ «عمل مستقبلي» بينما كودها
 * موجود على فرع التحصين، ولا أن يوحي بدمجها — الحالة الدقيقة: منفذة على
 * الفرع، PR #159 مفتوح وغير مدموج، main لم يتغير، والمخطط/التصدير كما
 * هما (٣٥/٢٧ من مصدر الثوابت نفسه). */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { localSchemaVersion, localExportVersion } from "@/storage/local/types";

const currentState = readFileSync(
  fileURLToPath(new URL("../../../../docs/operations/current-state.md", import.meta.url)),
  "utf8",
);
const todo = readFileSync(fileURLToPath(new URL("../../../../todo.md", import.meta.url)), "utf8");

describe("documentation consistency — Group 2 implemented on the remediation branch (closure patch)", () => {
  it("current-state records Group 2 implementation (§31) instead of leaving it future-only", () => {
    expect(currentState).toContain("§31. المجموعة ٢ — برنامج التحصين الكامل");
    expect(currentState).toContain("نُفذت على الفرع الوحيد الطويل `remediation/micro-full-hardening-2026`");
  });

  it("current-state states the exact PR and merge status — open, unmerged, main unchanged", () => {
    expect(currentState).toContain("PR #159 مفتوح وغير مدموج");
    expect(currentState).toContain("و`main` لم يتغير");
    expect(currentState).toContain("بوابة الدمج معلقة");
  });

  it("current-state exposes the typed storage_stale contract for Group 3", () => {
    expect(currentState).toContain("storage_stale");
    expect(currentState).toContain("عقد رحلة إعادة المحاولة");
  });

  it("schema and export versions in the docs match the code constants (35/27)", () => {
    expect(currentState).toContain("**٣٥ / ٢٧ بلا تغيير**");
    expect(String(localSchemaVersion)).toBe("35");
    expect(String(localExportVersion)).toBe("27");
  });

  it("todo marks Group 2 done on the branch and pending merge — not merged", () => {
    const group2Line = todo
      .split("\n")
      .find(
        line => line.includes("المجموعة ٢ — برنامج التحصين الكامل") && line.trimStart().startsWith("- ["),
      );
    expect(group2Line).toBeDefined();
    expect(group2Line?.trimStart().startsWith("- [x]")).toBe(true);
    expect(group2Line).toContain("PR #159 مفتوح وغير مدموج");
    expect(group2Line).toContain("منفذة على الفرع");
  });

  it("todo keeps Groups 4-6 of the hardening program not started (Group 3 is now implemented on the branch)", () => {
    /* المجموعة ٣ (التحصين الكامل) نُفذت على الفرع وبوابة الدمج معلقة —
     * الحارس يتقدم مع الحقيقة: ٣ منفذة بانتظار الدمج، و٤–٦ لم تبدأ. */
    const group3 = todo
      .split("\n")
      .find(
        line => line.includes("المجموعة ٣ — برنامج التحصين الكامل") && line.trimStart().startsWith("- ["),
      );
    expect(group3).toBeDefined();
    expect(group3?.trimStart().startsWith("- [x]")).toBe(true);
    expect(group3).toContain("PR #159 مفتوح وغير مدموج");
    /* المجموعة ٤ أُنجزت لاحقًا على الفرع (D-034)؛ ٥ و٦ لم تبدآ بعد. */
    const group4 = todo
      .split("\n")
      .find(
        line => line.includes("المجموعة ٤ — برنامج التحصين الكامل") && line.trimStart().startsWith("- ["),
      );
    expect(group4?.trimStart().startsWith("- [x]")).toBe(true);
    expect(group4).toContain("PR #159 مفتوح وغير مدموج");
    /* المجموعات ٥ و٦ أُنجزتا لاحقًا على الفرع (انظر group5Docs.test.ts
     * وgroup6Docs.test.ts)؛ بوابة المسح الهيكلي بعد البرنامج لم تبدأ. */
    const group5 = todo
      .split("\n")
      .find(
        line => line.includes("المجموعة ٥ — برنامج التحصين الكامل") && line.trimStart().startsWith("- ["),
      );
    expect(group5?.trimStart().startsWith("- [x]")).toBe(true);
    const group6 = todo
      .split("\n")
      .find(
        line => line.includes("المجموعة ٦ — برنامج التحصين الكامل") && line.trimStart().startsWith("- ["),
      );
    expect(group6?.trimStart().startsWith("- [x]")).toBe(true);
    expect(group6).toContain("PR #159 مفتوح وغير مدموج");
    const scanGate = todo
      .split("\n")
      .find(line => line.includes("بوابة ما بعد البرنامج") && line.trimStart().startsWith("- ["));
    expect(scanGate?.trimStart().startsWith("- [ ]")).toBe(true);
  });
});
