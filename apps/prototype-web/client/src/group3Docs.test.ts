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

  it("todo reflects the program truth: Group 4 implemented on the branch, Groups 5-6 not started", () => {
    /* المجموعة ٤ أُنجزت لاحقًا على الفرع (D-034 — انظر group4Docs.test.ts)؛ ٥ و٦ لم تبدآ. */
    const group4 = todo
      .split("\n")
      .find(
        line => line.includes("المجموعة ٤ — برنامج التحصين الكامل") && line.trimStart().startsWith("- ["),
      );
    expect(group4?.trimStart().startsWith("- [x]")).toBe(true);
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

  it("current-state records the Group 3 closure patch (§33) — the concurrency defect is closed", () => {
    const section33 = currentState.split("## §33.")[1] ?? "";
    expect(section33).toContain("commitOrderDeliveryReversal");
    expect(section33).toContain("deliveryReversalCommitGuard");
    expect(section33).toContain("كتابة عمياء");
    expect(section33).toContain("storage_stale");
    expect(section33).toContain("لا يوجد مسار كتابة لعلاقة ثانية على التسليم نفسه");
    expect(section33).toContain("٣٥/٢٧ بلا تغيير");
  });

  it("closure section states the same PR and merge posture as §32 — open, unmerged, main unchanged", () => {
    const section33 = currentState.split("## §33.")[1] ?? "";
    expect(section33).toContain("PR #159 مفتوح وغير مدموج");
    expect(section33).toContain("و`main` لم يتغير");
    expect(section33).toContain("بوابة الدمج معلقة");
  });

  it("todo records the Group 3 closure note with the shared guard reference", () => {
    const group3Line = todo
      .split("\n")
      .find(
        line => line.includes("المجموعة ٣ — برنامج التحصين الكامل") && line.trimStart().startsWith("- ["),
      );
    expect(group3Line).toBeDefined();
    expect(group3Line).toContain("رقعة الإغلاق");
    expect(group3Line).toContain("deliveryReversalCommitGuard");
    expect(group3Line).toContain("§33");
  });
});
