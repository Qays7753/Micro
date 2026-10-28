/** @vitest-environment jsdom */
/**
 * S02-B (SH-04 — UNIT-042): أدلة الغياب السلوكي للقفل في الواجهة — SDF-057:
 * بيئة فُعِّل فيها القفل سابقًا تفتح الإعدادات كاملة بلا غطاء وبلا إعداد
 * رمز (U042-AC01/AC02)، بعد تقاعد السجل القديم بمعروف؛ ولا يمكن لأي مسار
 * أن يطلب PIN بعد اليوم (البوابة نفسها حُذفت مع مكوّنها).
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { retireLocalLockRecord } from "@/application/security/retireLocalLockRecord";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { LocalTransferService } from "@/application/transfers/localTransferService";
import { localSecurityId, type LocalSecurityRecord } from "@/storage/local/types";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import Settings from "@/pages/Settings";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { PreferenceService } from "@/application/preferences/preferenceService";
import { ProfileService } from "@/application/profile/profileService";
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

/* ─── ٣) SDF-057 — استعادة نسخة قديمة بعد إزالة PIN ─── */

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));
vi.mock("wouter", () => ({
  useSearch: () => "",
  useLocation: () => ["/settings", vi.fn()],
  useParams: () => ({}),
}));
const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);

describe("SDF-057 — PIN removed, then an old backup is restored: no PIN, no lock state, business data and guards intact", () => {
  it("a legacy-enabled device opens Settings without any lock UI while the record is retired and data is intact", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    );
    const store = new MemoryLocalStore();
    await seedBusinessData(store);
    const saved = await store.saveLocalSecurity(legacyLockRecord);
    if (!saved.ok) throw new Error(saved.message);
    /* التقاعد يعمل أولًا كما عند الإقلاع الحقيقي. */
    const retirement = await retireLocalLockRecord(store);
    expect(retirement).toEqual({ status: "cleaned" });

    /* خدمات مطابقة للعقد كما في Set003 — لا مضاعف يدوي ناقص. */
    const transfers = new LocalTransferService(store, () => NOW);
    mockedUsePrototypeServices.mockReturnValue({
      formDrafts: new FormDraftService(store),
      integrityCheck: new IntegrityCheckService(
        store,
        new ProjectFinancialService(store, () => NOW),
        new StatementService(store, new ProjectFinancialService(store, () => NOW)),
        new CashContinuityService(store, () => NOW),
      ),
      preferences: new PreferenceService(store, () => NOW),
      profiles: new ProfileService(store, () => NOW),
      agreements: new AgreementService(store, new CostService(store, () => NOW), () => NOW),
      inventory: new InventoryMaterialService(store, () => NOW),
      supplierPurchases: new SupplierPurchaseService(store, () => NOW),
      catalog: new CatalogService(store, () => NOW),
      actualTime: {
        readOperatingMode: vi.fn(async () => ({
          ok: true,
          value: { workMode: null, actualTimeTrackingEnabled: false },
        })),
        saveOperatingMode: vi.fn(),
      },
      transfers,
      guidedOpeningImport: null,
      dataVersion: 0,
      notifyDataChanged: vi.fn(),
    } as unknown as ReturnType<typeof usePrototypeServices>);

    render(
      <ThemeProvider>
        <Settings />
      </ThemeProvider>,
    );
    /* الإعدادات تفتح كاملة: لا غطاء قفل ولا إعداد رمز ولا مدة خمول (U042-AC01/AC02). */
    expect(await screen.findByRole("heading", { level: 1, name: "الإعدادات" })).toBeTruthy();
    expect(screen.queryByLabelText("رمز القفل")).toBeNull();
    expect(screen.queryByText(/قفل التطبيق/)).toBeNull();
    expect(screen.queryByText(/مدة الخمول/)).toBeNull();
    /* التفاعل مفتوح — لا inert ولا حبس (فعل البيانات نفسه قابل للاستخدام). */
    const exportButton = await screen.findByRole("button", { name: "تصدير البيانات المحلية" });
    expect(exportButton.getAttribute("disabled")).toBeNull();
  });

  it("restoring an old backup after PIN removal: no PIN request exists, no lock state returns, business data is restored, financial guards stay", async () => {
    const store = new MemoryLocalStore();
    await seedBusinessData(store);
    /* نسخة قديمة من جهاز آخر (لا تحمل أي حالة قتل أصلًا — المخزن خارج التصدير). */
    const other = new MemoryLocalStore();
    const otherProfile = await other.saveProfile({
      id: "local-profile",
      activityName: "ورشة النسخة القديمة",
      currency: "JOD",
      activityType: "custom_craft",
      createdAt: NOW,
      updatedAt: NOW,
    });
    if (!otherProfile.ok) throw new Error(otherProfile.message);
    const otherEvent = await other.saveFinancialEvent({
      id: "fin-old-1",
      type: "owner_investment_cash",
      currency: "JOD",
      amountMinor: 9000,
      occurredOn: "2026-08-01",
      recordedAt: NOW,
      idempotencyKey: "old-investment",
      note: "استثمار النسخة القديمة",
      counterparty: null,
      relatedEventId: null,
      cashDeltaMinor: 9000,
      payableDeltaMinor: 0,
      ownerCapitalDeltaMinor: 9000,
      operatingExpenseDeltaMinor: 0,
    });
    if (!otherEvent.ok) throw new Error(otherEvent.message);

    const legacyService = new LocalTransferService(other, () => NOW);
    const exported = await legacyService.createVerifiedExport();
    if (!exported.ok) throw new Error(exported.message);

    /* بيئة القفل القديم على الجهاز المستهدف + التقاعد. */
    const saved = await store.saveLocalSecurity(legacyLockRecord);
    if (!saved.ok) throw new Error(saved.message);
    expect(await retireLocalLockRecord(store)).toEqual({ status: "cleaned" });

    /* الاستعادة الكاملة عبر الخدمة الحية — لا بوابة رمز في المسار أصلًا. */
    const service = new LocalTransferService(store, () => NOW);
    const prepared = await service.prepareRestore(JSON.stringify(exported.value.file));
    if (!prepared.ok) throw new Error(prepared.message);
    const confirmed = await service.confirmImport(prepared.value);
    if (!confirmed.ok) throw new Error(confirmed.message);

    /* بيانات الأعمال استُبدلت كاملة من النسخة (لا حذف ولا خلط). */
    const profile = await store.getProfile();
    expect(profile).toMatchObject({ ok: true, value: { activityName: "ورشة النسخة القديمة" } });
    const events = await store.listFinancialEvents();
    if (!events.ok) throw new Error(events.message);
    expect(events.value.some(entry => entry.id === "fin-old-1")).toBe(true);
    expect(events.value.some(entry => entry.id === "fin-legacy-1")).toBe(false);
    /* الحراس المالية باقية: مبلغ الحدث محفوظ بوحدته الصغرى كما سُجل. */
    const oldEvent = events.value.find(entry => entry.id === "fin-old-1");
    expect(oldEvent?.amountMinor).toBe(9000);
    /* لا حالة قفل عادت: السجل ما يزال نظيفًا بعد الاستعادة (المخزن خارج اللقطة). */
    const security = await store.getLocalSecurity();
    if (!security.ok) throw new Error(security.message);
    expect(security.value).toBeNull();
  });
});
