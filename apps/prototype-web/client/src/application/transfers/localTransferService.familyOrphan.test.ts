/** المجموعة ٦ (تدقيق A2 — AI-01): أحداث العائلة اليتيمة تُرفض عند الاستيراد.
 * ملف مدموج يدويًا (بلا بصمة ولا عدادات — مسار الملفات المدموجة القائم) يحمل
 * حدث اقتناء أصل أو أصل قرض بلا سجل مالكه كان يمر شكلًا فتدخل دفاتره آثار
 * لا مالك لها ولا سبيل لتصحيحها (حارس العائلة يمنع التصحيح العام ووصلته تقود
 * لصفحة غير موجودة). الآن يُرفض قبل أي معاينة — والملف المدموج السليم يبقى
 * مقبولًا كما وعد مسار الدمج اليدوي. */
import { describe, expect, it } from "vitest";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { AssetService } from "@/application/assets/assetService";
import { LoanService } from "@/application/loans/loanService";
import { LocalTransferService } from "./localTransferService";

const now = () => "2026-09-05T12:00:00.000Z";

async function seedFamily(store: MemoryLocalStore) {
  const assets = new AssetService(store, now);
  const loans = new LoanService(store, now);
  const asset = await assets.create({
    name: "ثلاجة عرض",
    acquisitionAmountMinor: 60000,
    acquisitionKind: "cash",
    purchaseDate: "2026-06-01",
    lifeMonths: 24,
    depreciationStartOn: null,
    note: null,
  });
  if (!asset.ok) throw new Error(asset.message);
  const loan = await loans.create({
    borrowerName: "أحمد",
    principalMinor: 50000,
    loanDate: "2026-07-01",
    purposeNote: null,
    sourceWalletId: null,
  });
  if (!loan.ok) throw new Error(loan.message);
}

/** ملف مدموج يدويًا: أسقط البصمة والعدادات وإصدار التطبيق — نفس ما يفعله من
 * يدمج ملفين قديمين خارج التطبيق؛ المسار القائم يقبله للملفات السليمة. */
function handMergedFile(exported: object): Record<string, unknown> {
  const merged = JSON.parse(JSON.stringify(exported)) as Record<string, unknown>;
  delete merged.integrity;
  delete merged.counts;
  delete merged.appVersion;
  return merged;
}

describe("family-context orphan rejection (المجموعة ٦ — تدقيق A2 / AI-01)", () => {
  it("rejects a hand-merged file whose asset event lost its asset record", async () => {
    const store = new MemoryLocalStore();
    await seedFamily(store);
    const transfers = new LocalTransferService(store, now);
    const exported = await transfers.createExport();
    if (!exported.ok) throw new Error(exported.message);
    const merged = handMergedFile(exported.value);
    const data = merged.data as Record<string, unknown>;
    data.assets = [];
    const prepared = new LocalTransferService(new MemoryLocalStore(), now).prepareImport(
      JSON.stringify(merged),
    );
    expect(prepared.ok).toBe(false);
    if (!prepared.ok) expect(prepared.code).toBe("validation_error");
    if (!prepared.ok) expect(prepared.message).toContain("ناقص أو لا يطابق");
  });

  it("rejects a hand-merged file whose loan event lost its loan record", async () => {
    const store = new MemoryLocalStore();
    await seedFamily(store);
    const transfers = new LocalTransferService(store, now);
    const exported = await transfers.createExport();
    if (!exported.ok) throw new Error(exported.message);
    const merged = handMergedFile(exported.value);
    const data = merged.data as Record<string, unknown>;
    data.loans = [];
    const prepared = new LocalTransferService(new MemoryLocalStore(), now).prepareImport(
      JSON.stringify(merged),
    );
    expect(prepared.ok).toBe(false);
    if (!prepared.ok) expect(prepared.code).toBe("validation_error");
    if (!prepared.ok) expect(prepared.message).toContain("ناقص أو لا يطابق");
  });

  it("keeps accepting the same hand-merged file when records and events travel together", async () => {
    const store = new MemoryLocalStore();
    await seedFamily(store);
    const transfers = new LocalTransferService(store, now);
    const exported = await transfers.createExport();
    if (!exported.ok) throw new Error(exported.message);
    const merged = handMergedFile(exported.value);
    const prepared = new LocalTransferService(new MemoryLocalStore(), now).prepareImport(
      JSON.stringify(merged),
    );
    expect(prepared.ok).toBe(true);
    if (prepared.ok) {
      expect(prepared.value.summary.assets).toBe(1);
      expect(prepared.value.summary.loans).toBe(1);
    }
  });

  it("rejects a ghost asset context even when the file keeps other intact records", async () => {
    const store = new MemoryLocalStore();
    await seedFamily(store);
    const transfers = new LocalTransferService(store, now);
    const exported = await transfers.createExport();
    if (!exported.ok) throw new Error(exported.message);
    const merged = handMergedFile(exported.value);
    const data = merged.data as Record<string, unknown>;
    const events = data.financialEvents as Array<Record<string, unknown>>;
    const acquisition = events.find(event => event.type === "asset_purchase_cash");
    if (!acquisition) throw new Error("acquisition event missing from export");
    const context = acquisition.assetContext as Record<string, unknown>;
    context.assetId = "asset-ghost-not-in-file";
    const prepared = new LocalTransferService(new MemoryLocalStore(), now).prepareImport(
      JSON.stringify(merged),
    );
    expect(prepared.ok).toBe(false);
  });
});
