import { describe, expect, it } from "vitest";
import { LocalTransferService } from "./localTransferService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { PreferenceService } from "@/application/preferences/preferenceService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";

/* G-004 (تدقيق الإدارة المالية المتدرجة 2026-09-19): أعلام تعطيل القدرات
 * تبقى بعد التصدير والاستعادة في جلسة نظيفة — لا فقدان بيانات ولا عودة
 * القدرات الموقفة بصمت. */

const now = () => "2026-09-20T09:00:00.000Z";

describe("G-004 — capability flags survive export/restore in a clean session", () => {
  it("disabled capabilities persist through export and restore into a clean store", async () => {
    const source = new MemoryLocalStore();
    const preferences = new PreferenceService(source, () => now());
    const cash = new CashContinuityService(source, () => now());
    const saved = await preferences.saveDisabledCapabilities(["suppliers", "inventory"]);
    if (!saved.ok) throw new Error(saved.message);
    const opened = await cash.openWallet({
      name: "درج-G004",
      kind: "cash_drawer",
      openingMinor: 10000,
      occurredOn: "2026-09-01",
      note: "رصيد",
      operationKey: "g004-roundtrip-open",
    });
    if (!opened.ok) throw new Error(opened.message);

    const transfers = new LocalTransferService(source, () => now());
    const exported = await transfers.createExport();
    if (!exported.ok) throw new Error(exported.message);
    const payload = JSON.stringify(exported.value);

    const target = new MemoryLocalStore();
    const targetTransfers = new LocalTransferService(target, () => now());
    const preview = targetTransfers.prepareImport(payload);
    if (!preview.ok) throw new Error(preview.message);
    const confirmed = await targetTransfers.confirmImport(preview.value);
    if (!confirmed.ok) throw new Error(confirmed.message);

    const targetPreferences = new PreferenceService(target, () => now());
    const reread = await targetPreferences.readDisabledCapabilities();
    if (!reread.ok) throw new Error(reread.message);
    expect([...reread.disabled].sort()).toEqual(["inventory", "suppliers"]);
    /* لا فقدان بيانات: المحفظة والافتتاح معها. */
    const wallets = await target.listCashWallets();
    if (!wallets.ok) throw new Error(wallets.message);
    expect(wallets.value.map(wallet => wallet.name)).toContain("درج-G004");
    const entries = await target.listCashContinuityEntries();
    if (!entries.ok) throw new Error(entries.message);
    expect(entries.value).toHaveLength(1);
  });

  it("an enabled surface stays enabled after a round-trip (no invented disablement)", async () => {
    const source = new MemoryLocalStore();
    const preferences = new PreferenceService(source, () => now());
    const saved = await preferences.saveDisabledCapabilities([]);
    if (!saved.ok) throw new Error(saved.message);
    const transfers = new LocalTransferService(source, () => now());
    const exported = await transfers.createExport();
    if (!exported.ok) throw new Error(exported.message);
    const target = new MemoryLocalStore();
    const targetTransfers = new LocalTransferService(target, () => now());
    const preview = targetTransfers.prepareImport(JSON.stringify(exported.value));
    if (!preview.ok) throw new Error(preview.message);
    const confirmed = await targetTransfers.confirmImport(preview.value);
    if (!confirmed.ok) throw new Error(confirmed.message);
    const targetPreferences = new PreferenceService(target, () => now());
    const reread = await targetPreferences.readDisabledCapabilities();
    if (!reread.ok) throw new Error(reread.message);
    expect(reread.disabled).toEqual([]);
  });
});
