/** رقعة إغلاق المجموعة ٢: فحص اتساق التوثيق الحي مع الحقيقة المؤرخة (F-036/W4-B).
 * المرجع يوثق لحظة الكتابة (منفذة على الفرع) ثم يحمل التصحيح المؤرخ:
 * دُمج PR #159 لاحقًا في `c0469e2` وتقدّم `main` بعده، والمخطط/التصدير كما
 * هما (٣٥/٢٧ تاريخًا؛ الزوج الحي 38/30 من مصدر الثوابت نفسه). */
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

  it("current-state carries the dated merge correction — PR #159 merged later at c0469e2 (F-036/W4-B)", () => {
    expect(currentState).toContain("PR #159 كان مفتوحًا وغير مدموج");
    expect(currentState).toContain("و`main` لم يتغير حينها");
    expect(currentState).toContain("دُمج PR #159 لاحقًا في `c0469e2`");
    expect(currentState).toContain("تصحيح مؤرخ 2026-09-29 — F-036/W4-B");
    expect(currentState).not.toContain("PR #159 مفتوح");
  });

  it("current-state exposes the typed storage_stale contract for Group 3", () => {
    expect(currentState).toContain("storage_stale");
    expect(currentState).toContain("عقد رحلة إعادة المحاولة");
  });

  it("schema and export versions match the code constants (38/30 after FIN-001 WS-178; the 35/27 statement stays as Group 2 history)", () => {
    expect(currentState).toContain("**٣٥ / ٢٧ بلا تغيير**");
    expect(String(localSchemaVersion)).toBe("38");
    expect(String(localExportVersion)).toBe("30");
  });

  it("todo marks Group 2 done on the branch and pending merge — not merged", () => {
    const group2Line = todo
      .split("\n")
      .find(
        line => line.includes("المجموعة ٢ — برنامج التحصين الكامل") && line.trimStart().startsWith("- ["),
      );
    expect(group2Line).toBeDefined();
    expect(group2Line?.trimStart().startsWith("- [x]")).toBe(true);
    expect(group2Line).toContain("PR #159 كان مفتوحًا وغير مدموج");
    expect(group2Line).toContain("دُمج PR #159 لاحقًا في `c0469e2`");
    expect(group2Line).toContain("منفذة على الفرع");
  });

  it("todo keeps Groups 4-6 of the hardening program not started (Group 3 is now implemented on the branch)", () => {
    /* المجموعة ٣ (التحصين الكامل) نُفذت على الفرع — دُمج PR #159 لاحقًا في
     * `c0469e2` (F-036/W4-B)؛ الحارس يتقدم مع الحقيقة المؤرخة. */
    const group3 = todo
      .split("\n")
      .find(
        line => line.includes("المجموعة ٣ — برنامج التحصين الكامل") && line.trimStart().startsWith("- ["),
      );
    expect(group3).toBeDefined();
    expect(group3?.trimStart().startsWith("- [x]")).toBe(true);
    expect(group3).toContain("PR #159 كان مفتوحًا وغير مدموج");
    /* المجموعة ٤ أُنجزت لاحقًا على الفرع (D-034)؛ ٥ و٦ لم تبدآ بعد. */
    const group4 = todo
      .split("\n")
      .find(
        line => line.includes("المجموعة ٤ — برنامج التحصين الكامل") && line.trimStart().startsWith("- ["),
      );
    expect(group4?.trimStart().startsWith("- [x]")).toBe(true);
    expect(group4).toContain("PR #159 كان مفتوحًا وغير مدموج");
    /* المجموعات ٥ و٦ أُنجزتا لاحقًا على الفرع (انظر group5Docs.test.ts
     * وgroup6Docs.test.ts)؛ بوابة المسح الهيكلي بعد البرنامج نُفّذت وأُغلقت. */
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
});
