/** التحصين الكامل (المجموعة ٣): فحص اتساق التوثيق الحي مع الحقيقة المؤرخة (F-036/W4-B) —
 * §32 يسجل ما نُفذ فعلًا (رحلة storage_stale، D-031، D-035) مع التصحيح
 * المؤرخ للدمج (`c0469e2`)، والمخطط/التصدير من مصدر الثوابت نفسه. */
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

  it("current-state §32 carries the dated merge correction — merged later at c0469e2 (F-036/W4-B)", () => {
    const section32 = currentState.split("## §32.")[1] ?? "";
    expect(section32).toContain("PR #159 كان مفتوحًا وغير مدموج");
    expect(section32).toContain("و`main` لم يتغير حينها");
    expect(section32).toContain("دُمج PR #159 لاحقًا في `c0469e2`");
    expect(section32).toContain("المجموعات ٤–٦ لم تبدأ");
  });

  it("current-state records the honest limitations: no browser runner, no invented diagnostics", () => {
    const section32 = currentState.split("## §32.")[1] ?? "";
    expect(section32).toContain("لا يوجد عدّاء E2E");
    expect(section32).toContain("لم يُخترع نظام تشخيصات");
  });

  it("schema and export versions match the code constants (38/30 after FIN-001 WS-178; the 35/27 statement stays as Group 3 history)", () => {
    const section32 = currentState.split("## §32.")[1] ?? "";
    expect(section32).toContain("٣٥ / ٢٧ بلا تغيير");
    expect(String(localSchemaVersion)).toBe("38");
    expect(String(localExportVersion)).toBe("30");
  });

  it("todo marks Group 3 done on the branch and pending merge — not merged", () => {
    const group3Line = todo
      .split("\n")
      .find(
        line => line.includes("المجموعة ٣ — برنامج التحصين الكامل") && line.trimStart().startsWith("- ["),
      );
    expect(group3Line).toBeDefined();
    expect(group3Line?.trimStart().startsWith("- [x]")).toBe(true);
    expect(group3Line).toContain("PR #159 كان مفتوحًا وغير مدموج");
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
    expect(group6).toContain("PR #159 كان مفتوحًا وغير مدموج");
    const scanGate = todo
      .split("\n")
      .find(line => line.includes("بوابة ما بعد البرنامج") && line.trimStart().startsWith("- ["));
    /* المجموعة ٨ (المعالجة الرباعية): بوابة المسح أُغلقت بقبول المالك؛ الحارس
     * انتقل إلى بوابة الخطة الرباعية (٨–١١) — لا بدء تلقائي. */
    expect(scanGate?.trimStart().startsWith("- [x]")).toBe(true);
    expect(scanGate).toContain("راجع المكتشفات وقبلها ووافق على خطة المعالجة الرباعية");
    const remediationGate = todo
      .split("\n")
      .find(line => line.includes("خطة المعالجة الرباعية الموافَقة") && line.trimStart().startsWith("- ["));
    expect(remediationGate?.trimStart().startsWith("- [ ]")).toBe(true);
    expect(remediationGate).toContain("لا تبدأ أي منها إلا بمراجعة المالك لتقرير المجموعة السابقة وقبوله");
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

  it("closure section carries the same dated merge correction as §32 — merged later at c0469e2 (F-036/W4-B)", () => {
    const section33 = currentState.split("## §33.")[1] ?? "";
    expect(section33).toContain("PR #159 كان مفتوحًا وغير مدموج");
    expect(section33).toContain("و`main` لم يتغير حينها");
    expect(section33).toContain("دُمج PR #159 لاحقًا في `c0469e2`");
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
