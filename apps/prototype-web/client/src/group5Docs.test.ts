/** التحصين الكامل (المجموعة ٥): فحص اتساق التوثيق الحي مع الحقيقة على الفرع —
 * §35 يسجل التصنيف والحد والترحيل وجدول الأمن والتشخيص وهوية البناء، بلا
 * ادّعاء دمج، والمخطط/التصدير من مصدر الثوابت نفسه، والمجموعة ٦ لم تبدأ. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { localSchemaVersion, localExportVersion } from "@/storage/local/types";

const currentState = readFileSync(
  fileURLToPath(new URL("../../../../docs/operations/current-state.md", import.meta.url)),
  "utf8",
);
const todo = readFileSync(fileURLToPath(new URL("../../../../todo.md", import.meta.url)), "utf8");

describe("documentation consistency — Group 5 boundaries implemented on the remediation branch", () => {
  it("current-state records the Group 5 section (§35) with the taxonomy and the boundary", () => {
    expect(currentState).toContain("§35. المجموعة ٥ — برنامج التحصين الكامل");
    const section35 = currentState.split("## §35.")[1] ?? "";
    expect(section35).toContain("FormDraftService");
    expect(section35).toContain("legacyFormDraftMigration");
    expect(section35).toContain("micro.finance-draft.");
    expect(section35).toContain("micro.setup-draft.v1");
    expect(section35).toContain("runWhenProtected");
    expect(section35).toContain("localDiagnosticsService");
    expect(section35).toContain("buildIdentity");
    expect(section35).toContain("routeTemplateFor");
  });

  it("§35 records the write-verify-delete migration policy and the explicit restore requirement", () => {
    const section35 = currentState.split("## §35.")[1] ?? "";
    expect(section35).toContain("اكتب←تحقق←احذف");
    expect(section35).toContain("فشل أي خطوة يُبقي القديمة");
    expect(section35).toContain("الاستعادة صارت");
  });

  it("§35 records the destructive-replacement rule: no lock is never verification", () => {
    const section35 = currentState.split("## §35.")[1] ?? "";
    expect(section35).toContain("لا قفل = حجب صريح");
    expect(section35).toContain("غياب القفل ليس تحققًا");
    expect(section35).toContain("فشل قراءة سجل القفل = إقفال صادق");
    expect(section35).toContain("يبقى مفعّلًا");
  });

  it("§35 records the diagnostics contract: bounded, eight fields only, never uploaded", () => {
    const section35 = currentState.split("## §35.")[1] ?? "";
    expect(section35).toContain("٢٥ إدخالًا / ٤٨٬٠٠٠ بايت");
    expect(section35).toContain("micro.diagnostics.v1");
    expect(section35).toContain("safeMessage");
    expect(section35).toContain("لا طلب شبكة");
  });

  it("§35 records the real build identity with the honest local fallback", () => {
    const section35 = currentState.split("## §35.")[1] ?? "";
    expect(section35).toContain("GITHUB_SHA");
    expect(section35).toContain("CF_PAGES_COMMIT_SHA");
    expect(section35).toContain("micro-local-dev");
    expect(section35).toContain("VITE_APP_VERSION");
  });

  it("schema/export versions stay 35/27 from the constants source, and the old placeholder is gone from export code", () => {
    expect(localSchemaVersion).toBe(35);
    expect(localExportVersion).toBe(27);
    const section35 = currentState.split("## §35.")[1] ?? "";
    expect(section35).toContain("٣٥/٢٧ بلا تغيير");
    const transferSource = readFileSync(
      fileURLToPath(new URL("./application/transfers/localTransferService.ts", import.meta.url)),
      "utf8",
    );
    expect(transferSource).not.toContain('appVersion: "micro-prototype-web"');
  });

  it("todo reflects the program truth: Group 5 implemented on the branch, Group 6 not started", () => {
    const group5 = todo
      .split("\n")
      .find(
        line => line.includes("المجموعة ٥ — برنامج التحصين الكامل") && line.trimStart().startsWith("- ["),
      );
    expect(group5).toBeDefined();
    expect(group5?.trimStart().startsWith("- [x]")).toBe(true);
    expect(group5).toContain("PR #159 مفتوح وغير مدموج");
    const group6 = todo
      .split("\n")
      .find(
        line => line.includes("المجموعة ٦ — برنامج التحصين الكامل") && line.trimStart().startsWith("- ["),
      );
    expect(group6).toBeDefined();
    expect(group6?.trimStart().startsWith("- [ ]")).toBe(true);
  });
});
