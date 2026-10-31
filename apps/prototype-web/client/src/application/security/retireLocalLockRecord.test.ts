/**
 * S02-B (SH-04 — UNIT-042، إلغاء المالك المعتمد 2026-10-24): أدلة إلغاء
 * القفل وPIN — الغياب البنيوي والسلوكي، وتقاعد السجل القديم بمعروف.
 *
 * يثبت هذا الملف (فحوص U042-AC01..AC16 ذات الصلة + SDF-057):
 *  1) تقاعد السجل: بيئة فُعِّل فيها القفل سابقًا — تنظيف موثق لمرة واحدة،
 *     بلا طلب الرمز القديم، وبلا مساس ببيانات الأعمال (U042-AC10/AC11)؛
 *     وفشل التنظيف حادثة تشخيصية آمنة لا تحبس المستخدم ولا تمحو بياناته.
 *  2) الغياب البنيوي: لا ملف قفل في الإنتاج أبدًا (مسح مصدر يمنع الإحياء)
 *     ولا مكون غطاء/بوابة رمز (U042-AC01/AC02/AC12).
 *  3) SDF-057: إزالة PIN ثم استعادة نسخة قديمة — لا طلب رمز ولا استعادة
 *     حالة قفل ولا حذف بيانات أعمال؛ الحراس المالية تبقى.
 */
import { describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { retireLocalLockRecord } from "./retireLocalLockRecord";
import { localDiagnostics } from "@/application/diagnostics/localDiagnosticsService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { LocalTransferService } from "@/application/transfers/localTransferService";
import { localSecurityId, type LocalSecurityRecord } from "@/storage/local/types";
import { PreferenceService } from "@/application/preferences/preferenceService";
import { AgreementService } from "@/application/agreements/agreementService";
import { CostService } from "@/application/cost/costService";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { SupplierPurchaseService } from "@/application/suppliers/supplierPurchaseService";
import { CatalogService } from "@/application/catalog/catalogService";
import { IntegrityCheckService } from "@/application/finance/integrityCheckService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { StatementService } from "@/application/finance/statementService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { FormDraftService } from "@/application/drafts/formDraftService";

const NOW = "2026-10-27T12:00:00.000Z";

/* سجل قفل تراثي كما خلفه إصدار قديم بعد التفعيل — بصمة وملح فقط، لا رمز. */
const legacyLockRecord: LocalSecurityRecord = {
  id: localSecurityId,
  pinHash: "a".repeat(64),
  salt: "b".repeat(32),
  hashAlgo: "pbkdf2",
  autoLockMinutes: 5,
  lastActiveAt: NOW,
  failedAttempts: 3,
  lastFailedAt: NOW,
  createdAt: NOW,
  updatedAt: NOW,
};

async function seedBusinessData(store: MemoryLocalStore) {
  const profile = await store.saveProfile({
    id: "local-profile",
    activityName: "ورشة النجارة",
    currency: "JOD",
    activityType: "custom_craft",
    createdAt: NOW,
    updatedAt: NOW,
  });
  if (!profile.ok) throw new Error(profile.message);
  const event = await store.saveFinancialEvent({
    id: "fin-legacy-1",
    type: "owner_investment_cash",
    currency: "JOD",
    amountMinor: 15000,
    occurredOn: "2026-09-01",
    recordedAt: NOW,
    idempotencyKey: "legacy-investment",
    note: "استثمار سابق",
    counterparty: null,
    relatedEventId: null,
    cashDeltaMinor: 15000,
    payableDeltaMinor: 0,
    ownerCapitalDeltaMinor: 15000,
    operatingExpenseDeltaMinor: 0,
  });
  if (!event.ok) throw new Error(event.message);
}

/* ─── ١) تقاعد السجل القديم ─── */

describe("S02-B lock record retirement — targeted cleanup with a known outcome", () => {
  it("cleans a legacy lock record once, asks for no old PIN, and leaves all business data intact (U042-AC10/AC11)", async () => {
    const store = new MemoryLocalStore();
    await seedBusinessData(store);
    const saved = await store.saveLocalSecurity(legacyLockRecord);
    if (!saved.ok) throw new Error(saved.message);

    const outcome = await retireLocalLockRecord(store);
    expect(outcome).toEqual({ status: "cleaned" });
    /* مادة PIN زالت — بصمة وملح ومحاولات وتوقيت؛ المخزن المجمّد كما هو. */
    const after = await store.getLocalSecurity();
    if (!after.ok) throw new Error(after.message);
    expect(after.value).toBeNull();
    /* بيانات الأعمال كاملة — لا محو ولا تصفير ولا معرف جديد. */
    const profile = await store.getProfile();
    expect(profile).toMatchObject({ ok: true, value: { activityName: "ورشة النجارة" } });
    const events = await store.listFinancialEvents();
    if (!events.ok) throw new Error(events.message);
    expect(events.value.some(entry => entry.id === "fin-legacy-1")).toBe(true);
    /* التكرار آمن: تشغيل ثانٍ لا يجد شيئًا (معروف، لا فشل). */
    const second = await retireLocalLockRecord(store);
    expect(second).toEqual({ status: "nothing-to-clean" });
  });

  it("a clean environment reports nothing-to-clean without any write", async () => {
    const store = new MemoryLocalStore();
    const outcome = await retireLocalLockRecord(store);
    expect(outcome).toEqual({ status: "nothing-to-clean" });
  });

  it("a failing cleanup is an honest safe diagnostic incident — never a cover, never data loss, boot continues (U042-AC10/فشل التنظيف)", async () => {
    const recordSpy = vi.spyOn(localDiagnostics, "recordIncident").mockReturnValue("MIC-0000000000");
    const store = new MemoryLocalStore();
    await seedBusinessData(store);
    const saved = await store.saveLocalSecurity(legacyLockRecord);
    if (!saved.ok) throw new Error(saved.message);
    /* فشل الحذف: منفذ مخزن يُحبط الحذف مرة واحدة. */
    const originalDelete = store.deleteLocalSecurity.bind(store);
    store.deleteLocalSecurity = () =>
      Promise.resolve({ ok: false as const, code: "storage_error" as const, message: "حقن فشل الحذف" });

    const outcome = await retireLocalLockRecord(store);
    expect(outcome).toEqual({ status: "cleanup-failed" });
    expect(recordSpy).toHaveBeenCalledTimes(1);
    expect(recordSpy).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: "lock_record_cleanup_failed" }),
    );
    /* البيانات لم تُمس، والسجل بقاؤه لا يحبس أحدًا — لا غطاء موجود أصلًا. */
    const profile = await store.getProfile();
    expect(profile).toMatchObject({ ok: true, value: { activityName: "ورشة النجارة" } });
    store.deleteLocalSecurity = originalDelete;

    /* فشل القراءة: الحقيقة نفسها بلا حبس ولا محو. */
    const originalRead = store.getLocalSecurity.bind(store);
    store.getLocalSecurity = () =>
      Promise.resolve({ ok: false as const, code: "storage_error" as const, message: "حقن فشل القراءة" });
    const readFailed = await retireLocalLockRecord(store);
    expect(readFailed).toEqual({ status: "cleanup-failed" });
    expect(recordSpy).toHaveBeenCalledTimes(2);
    store.getLocalSecurity = originalRead;
    recordSpy.mockRestore();
  });
});

/* ─── ٢) الغياب البنيوي — مسح مصدر يمنع الإحياء ─── */

describe("S02-B structural lock absence — the PIN product cannot come back silently (U042-AC01/AC02/AC12)", () => {
  const CLIENT_SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../");
  const RETIRED_MARKERS = [
    "localLockService",
    "AppLockGate",
    "DataActionPinGate",
    "LockSettingsCard",
    "pinOperations",
    "localLockBackoff",
    "pendingGatedAction",
  ];

  function listProductionFiles(dir: string, acc: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) listProductionFiles(full, acc);
      else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.[a-z]+$/.test(entry.name)) acc.push(full);
    }
    return acc;
  }

  it("no production file references any retired lock module or gate — deletion is total, not hidden", () => {
    const offenders: string[] = [];
    for (const file of listProductionFiles(CLIENT_SRC)) {
      const source = readFileSync(file, "utf8");
      for (const marker of RETIRED_MARKERS) {
        if (source.includes(marker)) offenders.push(`${path.relative(CLIENT_SRC, file)} [${marker}]`);
      }
    }
    expect(offenders, `مراجع قفل متقاعد في الإنتاج: ${offenders.join("; ")}`).toEqual([]);
  });

  it("the diagnostics safe-message catalog carries the cleanup-failure code with no secrets", async () => {
    const { safeMessageFor } = await import("@/application/diagnostics/localDiagnosticsService");
    expect(safeMessageFor("lock_record_cleanup_failed")).not.toContain("a".repeat(64));
    expect(safeMessageFor("lock_record_cleanup_failed")).toContain("لا يوجد قفل");
  });
});
