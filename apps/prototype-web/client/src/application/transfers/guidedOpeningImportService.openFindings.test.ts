/**
 * MNG-LOCAL-05/06 (إصلاح النتائج المفتوحة 2026-11-23 — WS-254/DOC-044):
 * اختبارات انحدار مركزة لمسار الاستيراد الافتتاحي الموجه:
 *  - MNG-LOCAL-05: أي استثناء غير متوقع أثناء بناء كائنات المجال واللقطة لا
 *    يُظهر نصه الخام أبدًا — الرسالة الثابتة الآمنة فقط (كان آخر موضع يمرّر
 *    نص الاستثناء عند الالتقاط العام لعملية البناء)؛
 *  - MNG-LOCAL-06: بوابة العد الكنونية (سقف العائلة والإجمالي نفسه لمسار
 *    الاستعادة الكامل — باب واحد لكل مستورد) على قسمي المحافظ والمواد، مع
 *    اختبار الحافة بالضبط: عند السقف يمر، وفوقه يُرفض برسالة العد الصادقة
 *    قبل أي كتابة.
 */
import { describe, expect, it, vi } from "vitest";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { LocalTransferService } from "./localTransferService";
import { GuidedOpeningImportService, type GuidedOpeningImportFile } from "./guidedOpeningImportService";
import { IMPORT_COUNT_LIMIT_MESSAGE, MAX_IMPORT_FAMILY_RECORDS } from "./transferResourceLimits";

/* MNG-LOCAL-05: يُعطَّل مُنشئ المحفظة مرة واحدة ليرمي استثناءً بنص داخلي
 * عدائي — الطريق الوحيد لإثبات الالتقاط العام لمسار البناء دون تعديل بنية
 * الإنتاج. */
vi.mock("@micro-domain/cash-continuity/index.js", async importOriginal => {
  const actual = await importOriginal<typeof import("@micro-domain/cash-continuity/index.js")>();
  const realCreate = actual.createCashWallet;
  return {
    ...actual,
    createCashWallet: vi.fn((...args: Parameters<typeof realCreate>) => realCreate(...args)),
  };
});
import { createCashWallet } from "@micro-domain/cash-continuity/index.js";

const mockedCreateWallet = vi.mocked(createCashWallet);

function testBackupBuilder(
  store: ConstructorParameters<typeof LocalTransferService>[0],
): ReturnType<typeof LocalTransferService.verifiedBackupBuilder> {
  return LocalTransferService.verifiedBackupBuilder(new LocalTransferService(store));
}

const valid = {
  format: "micro-guided-opening-import",
  version: 1,
  importId: "opening-2026-08-24-open-findings",
  profile: {
    activityName: "مخبز صغير",
    currency: "JOD",
    activityType: "custom_craft",
    source: "عد يدوي",
    knowledge: "known",
    occurredOn: "2026-08-01",
    note: "بداية معلنة",
  },
  cashWallets: [
    {
      id: "drawer",
      name: "درج",
      kind: "cash_drawer",
      openingMinor: 12500,
      source: "عد يدوي",
      knowledge: "known",
      occurredOn: "2026-08-01",
      note: "عد المالك",
    },
  ],
  materials: [],
} as const;

function walletAt(index: number) {
  return {
    id: `wallet-${index}`,
    name: `درج ${index}`,
    kind: "cash_drawer",
    openingMinor: 100,
    source: "عد يدوي",
    knowledge: "known",
    occurredOn: "2026-08-01",
    note: "عد المالك",
  };
}

describe("MNG-LOCAL-05 — no raw exception text from the guided opening import, anywhere", () => {
  it("an UNEXPECTED exception while building the domain objects returns the fixed safe message only", async () => {
    // THE one hostile throw: consumed by this test's single wallet creation;
    // every later call delegates to the real implementation.
    mockedCreateWallet.mockImplementationOnce(() => {
      throw new Error("RAW INTERNAL DETAIL: invariant violation at createCashWallet");
    });
    const store = new MemoryLocalStore();
    const service = new GuidedOpeningImportService(store, testBackupBuilder(store));
    const result = await service.prepare(JSON.stringify(valid));
    expect(result).toMatchObject({ ok: false, code: "validation_error" });
    if (result.ok) throw new Error("expected rejection");
    expect(result.message).toBe("بيانات الاستيراد الافتتاحي غير صالحة. بقيت بيانات هذا الجهاز دون تغيير.");
    expect(result.message).not.toContain("RAW INTERNAL DETAIL");
    expect(result.message).not.toContain("invariant");
    // Nothing was written by the refused path.
    await expect(store.readSnapshot()).resolves.toMatchObject({
      ok: true,
      value: { profile: null, cashWallets: [] },
    });
  });
});

describe("MNG-LOCAL-06 — canonical count limits on the guided opening import", () => {
  it("rejects a bloated family (over MAX_IMPORT_FAMILY_RECORDS) with the honest count message before any write", async () => {
    const store = new MemoryLocalStore();
    const service = new GuidedOpeningImportService(store, testBackupBuilder(store));
    const bloated = {
      ...valid,
      importId: "opening-bloated-family",
      cashWallets: Array.from({ length: MAX_IMPORT_FAMILY_RECORDS + 1 }, (_, index) => walletAt(index)),
    };
    const result = await service.prepare(JSON.stringify(bloated));
    expect(result).toMatchObject({ ok: false, code: "validation_error" });
    if (result.ok) throw new Error("expected rejection");
    expect(result.message).toBe(IMPORT_COUNT_LIMIT_MESSAGE);
    await expect(store.readSnapshot()).resolves.toMatchObject({
      ok: true,
      value: { profile: null, cashWallets: [] },
    });
  });

  it("the EXACT boundary passes: a family at exactly the cap is not refused by the count gate", async () => {
    const store = new MemoryLocalStore();
    const service = new GuidedOpeningImportService(store, testBackupBuilder(store));
    const atCap = {
      ...valid,
      importId: "opening-at-cap-boundary",
      cashWallets: Array.from({ length: MAX_IMPORT_FAMILY_RECORDS }, (_, index) => walletAt(index)),
    };
    const result = await service.prepare(JSON.stringify(atCap));
    expect(result.ok).toBe(true);
    if (result.ok) {
      const file = result.value.file as GuidedOpeningImportFile;
      expect(file.cashWallets.length).toBe(MAX_IMPORT_FAMILY_RECORDS);
      expect(result.value.summary.acceptedWallets).toBe(MAX_IMPORT_FAMILY_RECORDS);
    }
  });
});
