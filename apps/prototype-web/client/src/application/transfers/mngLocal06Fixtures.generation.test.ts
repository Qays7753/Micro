import "fake-indexeddb/auto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalTransferService } from "./localTransferService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import {
  MAX_IMPORT_FAMILY_RECORDS,
  MAX_IMPORT_JSON_DEPTH,
  MAX_IMPORT_TOTAL_RECORDS,
  importFamilyCountVerdict,
  isWithinImportDepth,
  isWithinImportSizeLimit,
  measureJsonDepth,
} from "./transferResourceLimits";

/* MNG-LOCAL-06 (أمر المالك 12AA — 2026-11-24): بوابة توليد القياسات
 * الاصطناعية — مولّد السكربت يُشغَّل فعليًا (node scripts/…) على دليل مؤقت
 * خارج المستودع (لا تُرفع القياسات الضخمة في git)، ثم يمر كل ملف عبر
 * بوابات prepareImport الحقيقية نفسها قبل أي كتابة:
 *  - الحجم داخل سقف ٢^٢٤ وحدة، والعمق داخل ٦٤، والعد عند الحواف القصوى
 *    بالضبط (عائلة 20,000 وإجمالي 50,000 وعمق 64) بلا أي رفع أو تليين.
 *  - البصمة والعدادات صادقة — الملف يُقبل كاملًا بالخدمة الحية.
 * هذا يثبت صحة طريقة التوليد لا القياس الفعلي — القياس على الجهاز
 * الفعلي NOT_EXECUTED من هذه البيئة (النتيجة تبقى open حتى يجريه المالك).
 */
const GENERATOR = resolve(import.meta.dirname, "../../../../../../scripts/generate-mng-local-06-fixtures.mjs");
const OUT_DIR = resolve(tmpdir(), `mng-local-06-fixtures-${Date.now()}`);

const service = () => new LocalTransferService(new MemoryLocalStore(), () => "2026-11-24T12:00:00.000Z");

async function clearDatabases() {
  const request = indexedDB.deleteDatabase("micro-prototype-local");
  await new Promise<void>((resolve, reject) => {
    request.onerror = () => reject(new Error("main delete error"));
    request.onsuccess = () => resolve();
    request.onblocked = () => reject(new Error("main delete BLOCKED"));
  });
  const restore = indexedDB.deleteDatabase("micro-prototype-restore");
  await new Promise<void>((resolve, reject) => {
    restore.onerror = () => reject(new Error("restore delete error"));
    restore.onsuccess = () => resolve();
    restore.onblocked = () => reject(new Error("restore delete BLOCKED"));
  });
}
afterEach(clearDatabases);

function generateOnce() {
  execFileSync(process.execPath, [GENERATOR, "--out", OUT_DIR], { encoding: "utf8" });
  expect(existsSync(resolve(OUT_DIR, "mng-local-06-family-20000.json"))).toBe(true);
}

function readFixture(name: string): string {
  return readFileSync(resolve(OUT_DIR, name), "utf8");
}

describe("MNG-LOCAL-06 — بوابة قياسات الاستيراد الاصطناعية (طريقة التوليد)", () => {
  it("المولّد يولّد الملفات الثلاثة خارج المستودع من الصيغة الحية (34/43)", () => {
    generateOnce();
    const family = readFixture("mng-local-06-family-20000.json");
    const parsed = JSON.parse(family);
    expect(parsed.format).toBe("micro-prototype-local-export");
    expect(parsed.version).toBe(34);
    expect(parsed.schemaVersion).toBe(43);
  });

  it("قياس العائلة: 20,000 سجل عند الحافة بالضبط — يُقبل بالخدمة الحية كاملًا", () => {
    generateOnce();
    const text = readFixture("mng-local-06-family-20000.json");
    expect(isWithinImportSizeLimit(text)).toBe(true);
    const parsed = JSON.parse(text);
    expect(parsed.data.counterparties).toHaveLength(MAX_IMPORT_FAMILY_RECORDS);
    const verdict = importFamilyCountVerdict(parsed.data);
    expect(verdict.ok).toBe(true);
    expect(isWithinImportDepth(parsed)).toBe(true);
    const prepared = service().prepareImport(text);
    expect(prepared.ok).toBe(true);
    if (prepared.ok) expect(prepared.value.summary.counterparties).toBe(20_000);
  });

  it("قياس الإجمالي: 50,000 عند الحافة بالضبط (المصفوفات 49,998 + سجلان) — يُقبل كاملًا", () => {
    generateOnce();
    const text = readFixture("mng-local-06-total-50000.json");
    expect(isWithinImportSizeLimit(text)).toBe(true);
    const parsed = JSON.parse(text);
    const verdict = importFamilyCountVerdict(parsed.data);
    expect(verdict.ok).toBe(true);
    const arraysTotal = Object.entries(parsed.data)
      .filter(([, value]) => Array.isArray(value))
      .reduce((sum, [, value]) => sum + (value as unknown[]).length, 0);
    expect(arraysTotal).toBe(MAX_IMPORT_TOTAL_RECORDS - 2);
    const prepared = service().prepareImport(text);
    expect(prepared.ok).toBe(true);
    if (prepared.ok) {
      expect(prepared.value.summary.counterparties).toBe(20_000);
      /* summary لا يعرض إيصالات الأوامر (عائلة تاريخية للعهدة) — العد
       * يُتحقق من البيانات نفسها لا من الملخص. */
      expect(parsed.data.commandReceipts).toHaveLength(20_000);
      expect(prepared.value.summary.balanceObservations).toBe(9_998);
    }
  });

  it("قياس العمق: 64 عند الحافة بالضبط — مقاس فعلًا ومقبول (لا تجاوز ولا رفض)", () => {
    generateOnce();
    const text = readFixture("mng-local-06-depth-64.json");
    expect(isWithinImportSizeLimit(text)).toBe(true);
    const parsed = JSON.parse(text);
    expect(measureJsonDepth(parsed)).toBe(MAX_IMPORT_JSON_DEPTH);
    expect(isWithinImportDepth(parsed)).toBe(true);
    const prepared = service().prepareImport(text);
    expect(prepared.ok).toBe(true);
  });

  it("قياس فوق الحافة يُرفض بالبوابة نفسها — الحدود القائمة لم تُرفع ولم تُلَيَّن", () => {
    generateOnce();
    const text = readFixture("mng-local-06-family-20000.json");
    const parsed = JSON.parse(text);
    const verdict = importFamilyCountVerdict(parsed.data);
    expect(verdict.ok).toBe(true);
    const overFamily = { ...parsed.data, counterparties: [...parsed.data.counterparties, parsed.data.counterparties[0]] };
    expect(importFamilyCountVerdict(overFamily).ok).toBe(false);
    const overDepth = JSON.parse(readFixture("mng-local-06-depth-64.json"));
    /* سلسلة أعمق من الحافة (65 مستوى تحت السجل نفسه) — البوابة ترفضها. */
    let deeper: Record<string, unknown> = { marker: "leaf" };
    for (let level = 0; level < 65; level += 1) deeper = { nested: deeper };
    overDepth.data.counterparties[0].depthProbe = deeper;
    expect(isWithinImportDepth(overDepth)).toBe(false);
  });
});
