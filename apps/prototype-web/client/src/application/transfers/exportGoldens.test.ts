/**
 * Wave 3A (ARCH-002 / WS-212 — STR-401 + STR-405 من المسح المقبول): أصول تكافؤ مادية على القرص.
 *
 * الغرض: تجميد ملفات تصدير حقيقية بوصفها oracles دائمة:
 *  - الزوج الحالي 30/38 مُشتق حتميًا من عهدة 8/17 الأمينة عبر مسار الترحيل والاستعادة
 *    والتصدير الفعلي (يقارن مقارنة عميقة كاملة في كل تشغيل — أقوى حارس بايتات هنا)؛
 *  - ملف مكمّل غني بالعائلات الجديدة (مصروف متكرر/ميزانية/قرض مستلم/بيع مباشر/أصل/قرض...)
 *    مجمّد من مسار الخدمات الحقيقية (تجميد القيم؛ المطابقة قبولًا وعدادات ودورة كاملة)؛
 *  - ملف ذهبي أدنى لكل زوج تاريخي مقبول (24) — بوابة الأزواج مجمدة ملفًا ملفًا؛
 *  - عهدة 8/17 الأمينة نفسها كملف (تُستورد من اختبارها الأصلي — مصدر واحد).
 *
 * MANIFEST يسجل sha256 لكل ملف وأصل التوليد: أي تعديل يدوي لأي ذهبي يُكشف فورًا.
 *
 * التوليد (عند إضافة عائلات جديدة قانونيًا فقط): GOLDEN_UPDATE=1
 * المقارنة (الوضع الافتراضي في كل تشغيل CI): أي انحراف يُرفض.
 *
 * حدود صريحة (عقد 39): لا يغير هذا الملف أي سطر إنتاج؛ الأزواج والبايتات وترتيب
 * الرفض ورسائله كما هي؛ الذهبيات إضافية فقط وحد رجوعها الحذف.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LocalTransferService } from "./localTransferService";
import { RELEASED_LEGACY_EXPORT_PAIRS } from "./transferEnvelope";
import { exportCountsOf } from "./transferCounters";
import { file817 } from "./historical817.fixture";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { localExportVersion, localSchemaVersion, type LocalExportFile } from "@/storage/local/types";
import { syncSha256Hex } from "@/lib/syncSha256";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { SupplierPurchaseService } from "@/application/suppliers/supplierPurchaseService";
import { OwnerEntitlementService } from "@/application/owner-money/ownerEntitlementService";
import { LoanService } from "@/application/loans/loanService";
import { ReceivedLoanService } from "@/application/loans/receivedLoanService";
import { AssetService } from "@/application/assets/assetService";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { RecurringExpenseService } from "@/application/recurring/recurringExpenseService";
import { ExpenseBudgetService } from "@/application/budgets/expenseBudgetService";

const GOLDEN_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../../../docs/fixtures/export-goldens",
);
const NOW = () => "2026-10-03T10:00:00.000Z" as const;
const GENERATE = process.env.GOLDEN_UPDATE === "1";

interface GoldenManifestEntry {
  file: string;
  sha256: string;
  kind: "current-pair" | "current-pair-supplement" | "legacy-minimal" | "historical-faithful";
  description: string;
  byteStable: boolean;
}
interface GoldenManifest {
  generatedAt: string;
  generator: string;
  command: string;
  files: GoldenManifestEntry[];
}

const sha256Of = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
const readGolden = (name: string) => readFileSync(path.join(GOLDEN_DIR, name), "utf8");
const writeGolden = (name: string, text: string) => {
  mkdirSync(GOLDEN_DIR, { recursive: true });
  writeFileSync(path.join(GOLDEN_DIR, name), text, "utf8");
};

/** مظروف أدنى صالح لزوج تاريخي — نفس بنية الاختبار الأصلي (بلا مظروف تكامل للقدماء). */
function minimalLegacyFileFor(version: number, schemaVersion: number): LocalExportFile {
  const data = {
    profile: null,
    preferences: null,
    drafts: [],
    orders: [],
    schedules: [],
    financialEvents: [],
  };
  return {
    format: "micro-prototype-local-export",
    version,
    schemaVersion,
    exportedAt: "2026-10-03T10:00:00.000Z",
    data,
  } as unknown as LocalExportFile;
}

/** الزوج الحالي 30/38 مُشتق حتميًا: 8/17 الأمينة → ترحيل → استعادة → تصدير. */
async function currentGoldenViaMigration(): Promise<LocalExportFile> {
  const target = new MemoryLocalStore();
  const targetTransfers = new LocalTransferService(target, NOW);
  const prepared = targetTransfers.prepareImport(JSON.stringify(file817));
  if (!prepared.ok) throw new Error(`عهدة 8/17 رُفضت: ${prepared.message}`);
  const confirmed = await targetTransfers.confirmImport(prepared.value);
  if (!confirmed.ok) throw new Error(`استعادة 8/17 فشلت: ${confirmed.message}`);
  const exported = await targetTransfers.createExport();
  if (!exported.ok) throw new Error(`تصدير الزوج الحالي فشل: ${exported.message}`);
  return exported.value;
}

/** مخزن مكمّل عبر الخدمات الحقيقية: يغطي العائلات الجديدة الغائبة عن 8/17. */
async function seedSupplementStore(): Promise<MemoryLocalStore> {
  const store = new MemoryLocalStore();
  const cash = new CashContinuityService(store, NOW);
  const finance = new ProjectFinancialService(store, NOW);
  const suppliers = new SupplierPurchaseService(store, NOW);
  const owner = new OwnerEntitlementService(store, NOW);
  const loans = new LoanService(store, NOW);
  const received = new ReceivedLoanService(store, NOW);
  const assets = new AssetService(store, NOW);
  const inventory = new InventoryMaterialService(store, NOW);
  const recurring = new RecurringExpenseService(store, NOW);
  const budgets = new ExpenseBudgetService(store, NOW);

  const wallet = await cash.openWallet({
    name: "ذهب-مكمل",
    kind: "cash_drawer",
    openingMinor: 9000,
    occurredOn: "2026-09-01",
    note: "افتتاح الملف المكمّل",
    operationKey: "golden-supplement-wallet",
  });
  if (!wallet.ok) throw new Error(wallet.message);

  const expense = await finance.record({
    type: "operating_expense_cash",
    amountMinor: 300,
    occurredOn: "2026-09-05",
    note: "توصيل الملف المكمّل",
    counterparty: null,
    relatedEventId: null,
    expenseContext: { relationship: "project", behavior: "variable", purpose: "order", knowledge: "known" },
    idempotencyKey: "golden-supplement-expense",
  });
  if (!expense.ok) throw new Error(expense.message);

  const purchase = await suppliers.recordPurchase({
    supplierName: "مورد الذهبي المكمّل",
    note: "خامات",
    purchasedOn: "2026-09-06",
    dueOn: null,
    totalMinor: 1600,
    initialPaidMinor: 600,
    idempotencyKey: "golden-supplement-purchase",
  });
  if (!purchase.ok) throw new Error(purchase.message);

  const draw = await owner.recordMovement({
    kind: "draw",
    amountMinor: 600,
    walletId: wallet.value.wallet.id,
    occurredOn: "2026-09-07",
    note: "سحب الملف المكمّل",
    reason: "owner_draw",
    idempotencyKey: "golden-supplement-draw",
  });
  if (!draw.ok) throw new Error(draw.message);

  const loan = await loans.create({
    borrowerName: "سليم المكمّل",
    principalMinor: 3200,
    loanDate: "2026-09-08",
    purposeNote: "قرض الذهبي",
  });
  if (!loan.ok) throw new Error(loan.message);

  const receivedLoan = await received.create({
    lenderName: "سامي المكمّل",
    lenderType: "person",
    principalMinor: 21000,
    receivedOn: "2026-09-02",
    dueOn: null,
    note: "قرض مستلم للذهبي",
    walletId: null,
  });
  if (!receivedLoan.ok) throw new Error(receivedLoan.message);

  const asset = await assets.create({
    name: "ماكينة الذهبي",
    acquisitionAmountMinor: 5200,
    acquisitionKind: "cash",
    purchaseDate: "2026-09-08",
    lifeMonths: 24,
    depreciationStartOn: "2026-09-08",
    note: "أصل الذهبي المكمّل",
  });
  if (!asset.ok) throw new Error(asset.message);

  const material = await inventory.openMaterial({
    name: "خشب الذهبي",
    unit: "piece",
    tracking: "tracked",
    opening: {
      quantityState: "confirmed",
      quantityMilli: 5200,
      costState: "known",
      valueMinor: 2600,
      confirmedOn: "2026-09-01",
      sourceNote: "جرد الذهبي",
    },
    note: "رصيد الذهبي",
    operationKey: "golden-supplement-material",
  });
  if (!material.ok) throw new Error(material.message);

  const series = await recurring.createDraft({
    title: "إيجار الذهبي",
    rule: {
      effectiveFromPeriod: "2026-09",
      frequency: "monthly",
      interval: 1,
      anchorDate: "2026-09-01",
      dueDay: 5,
      monthEndPolicy: "last_valid_day",
      timezone: "Asia/Amman",
      amountMode: "suggested",
      suggestedAmountMinor: 25_000,
      suggestedWalletId: null,
      categoryLabel: "إيجار",
      changeReason: null,
      note: null,
    },
  });
  if (!series.ok) throw new Error(series.message);

  const budget = await budgets.createBudget({
    periodKey: "2026-09",
    scope: { kind: "general_expense" },
    amountMinor: 40_000,
    note: "ميزانية الذهبي",
    operationKey: "golden-supplement-budget",
  });
  if (!budget.ok) throw new Error(budget.message);

  return store;
}

async function supplementGoldenFromServices(): Promise<LocalExportFile> {
  const store = await seedSupplementStore();
  const transfers = new LocalTransferService(store, NOW);
  const exported = await transfers.createExport();
  if (!exported.ok) throw new Error(exported.message);
  return exported.value;
}

const LEGACY_PAIRS = [...RELEASED_LEGACY_EXPORT_PAIRS]
  .map(pair => pair.split("/").map(Number) as [number, number])
  .sort((a, b) => b[0] - a[0]);

describe("Wave 3A — export/import golden artifacts (STR-401)", () => {
  it("current-pair golden (30/38): deterministic migration-derived export matches the frozen golden byte-for-byte", async () => {
    const live = await currentGoldenViaMigration();
    const name = "current-pair.golden.json";
    if (GENERATE) {
      writeGolden(name, JSON.stringify(live, null, 2));
    }
    const golden = JSON.parse(readGolden(name)) as LocalExportFile;
    expect(live).toEqual(golden);
    expect(golden.version).toBe(localExportVersion);
    expect(golden.schemaVersion).toBe(localSchemaVersion);
    expect(golden.integrity?.algorithm).toBe("sha256");
    expect(golden.integrity?.digest).toBe(syncSha256Hex(JSON.stringify(golden.data)));
    expect(golden.counts).toEqual(exportCountsOf(golden.data));
  });

  it("current-pair supplement golden: rich new-family export stays importable with honest counts", async () => {
    const name = "current-pair-supplement.golden.json";
    if (GENERATE) {
      const live = await supplementGoldenFromServices();
      writeGolden(name, JSON.stringify(live, null, 2));
    }
    const goldenText = readGolden(name);
    const golden = JSON.parse(goldenText) as LocalExportFile;
    expect(golden.version).toBe(localExportVersion);
    expect(golden.schemaVersion).toBe(localSchemaVersion);
    /* القبول الكامل: البوابة + الترحيل + التحقق البنيوي + العدادات + البصمة. */
    const transfers = new LocalTransferService(new MemoryLocalStore(), NOW);
    const prepared = transfers.prepareImport(goldenText);
    if (!prepared.ok) throw new Error(`الذهبي المكمّل رُفض: ${prepared.message}`);
    expect(prepared.value.file.counts).toEqual(golden.counts);
    expect(prepared.value.file.counts).toEqual(exportCountsOf(prepared.value.file.data));
    /* دورة كاملة: الاستعادة تحفظ البيانات المُرحَّلة كما هي. */
    const confirmed = await transfers.confirmImport(prepared.value);
    if (!confirmed.ok) throw new Error(confirmed.message);
    const reExported = await transfers.createExport();
    if (!reExported.ok) throw new Error(reExported.message);
    expect(reExported.value.data).toEqual(prepared.value.file.data);
    /* تغطية العائلات الجديدة موجودة فعلًا في الملف المجمّد (عدادات العقد ٣٩). */
    expect(golden.counts?.recurringExpenseSeries).toBeGreaterThan(0);
    expect(golden.counts?.recurringExpenseRevisions).toBeGreaterThan(0);
    expect(golden.counts?.expenseBudgets).toBeGreaterThan(0);
    expect(golden.counts?.receivedLoans).toBeGreaterThan(0);
    expect(golden.counts?.assets).toBeGreaterThan(0);
    expect(golden.counts?.loans).toBeGreaterThan(0);
    expect(golden.counts?.cashWallets).toBeGreaterThan(0);
    expect(golden.counts?.cashContinuityEntries).toBeGreaterThan(0);
    expect(golden.counts?.materials).toBeGreaterThan(0);
    expect(golden.counts?.inventoryMovements).toBeGreaterThan(0);
    expect(golden.counts?.supplierPurchases).toBeGreaterThan(0);
    expect(golden.counts?.financialEvents).toBeGreaterThan(0);
  });

  it("every released legacy pair has a frozen minimal golden that still imports to 30/38", () => {
    expect(LEGACY_PAIRS.length).toBe(24);
    const transfers = new LocalTransferService(new MemoryLocalStore(), NOW);
    for (const [version, schemaVersion] of LEGACY_PAIRS) {
      const name = `legacy-minimal-${version}-${schemaVersion}.golden.json`;
      if (GENERATE) {
        writeGolden(name, JSON.stringify(minimalLegacyFileFor(version, schemaVersion), null, 2));
      }
      const prepared = transfers.prepareImport(readGolden(name));
      if (!prepared.ok) {
        throw new Error(`الزوج التاريخي ${version}/${schemaVersion} رُفض: ${prepared.message}`);
      }
      expect(prepared.value.file.version).toBe(localExportVersion);
      expect(prepared.value.file.schemaVersion).toBe(localSchemaVersion);
    }
  });

  it("the faithful historical 8/17 fixture is materialized on disk and still round-trips", () => {
    const name = "historical-8-17-faithful.golden.json";
    if (GENERATE) {
      writeGolden(name, JSON.stringify(file817, null, 2));
    }
    const golden = JSON.parse(readGolden(name));
    /* الملف المساوي تمامًا لعهدة الاختبار الأصلي (مصدر واحد — الاستيراد المشترك). */
    expect(golden).toEqual(file817);
    const transfers = new LocalTransferService(new MemoryLocalStore(), NOW);
    const prepared = transfers.prepareImport(readGolden(name));
    if (!prepared.ok) throw new Error(`عهدة 8/17 المادية رُفضت: ${prepared.message}`);
    /* نفس ثوابت الأمان التاريخية المثبتة في اختبارها الأصلي. */
    expect(prepared.value.file.data.orders[0]?.order.collectedMinor).toBe(12000);
    expect(prepared.value.file.data.orders[0]?.order.events.length).toBe(3);
  });

  it("MANIFEST pins every golden's sha256 — any manual edit is caught", () => {
    const manifestName = "MANIFEST.json";
    if (GENERATE) {
      const entries: GoldenManifestEntry[] = [
        {
          file: "current-pair.golden.json",
          sha256: "",
          kind: "current-pair",
          description: "30/38 مشتق من 8/17 عبر الترحيل والاستعادة والتصدير — مقارنة عميقة كاملة",
          byteStable: true,
        },
        {
          file: "current-pair-supplement.golden.json",
          sha256: "",
          kind: "current-pair-supplement",
          description:
            "30/38 غني بالعائلات الجديدة عبر الخدمات — تجميد قبول وعدادات ودورة (المعرفات مولدة ومجمّدة)",
          byteStable: false,
        },
        ...LEGACY_PAIRS.map(([v, s]): GoldenManifestEntry => ({
          file: `legacy-minimal-${v}-${s}.golden.json`,
          sha256: "",
          kind: "legacy-minimal",
          description: `زوج تاريخي مقبول ${v}/${s} — مظروف أدنى مجمّد`,
          byteStable: true,
        })),
        {
          file: "historical-8-17-faithful.golden.json",
          sha256: "",
          kind: "historical-faithful",
          description: "عهدة 570eba1 الأمينة (8/17) — مشتركة مع اختبارها الأصلي",
          byteStable: true,
        },
      ].map(e => ({ ...e, sha256: sha256Of(readGolden(e.file)) }));
      const manifest: GoldenManifest = {
        generatedAt: NOW(),
        generator: "apps/prototype-web/client/src/application/transfers/exportGoldens.test.ts",
        command: "GOLDEN_UPDATE=1 pnpm --filter @micro/prototype-web test -- exportGoldens",
        files: entries,
      };
      writeGolden(manifestName, JSON.stringify(manifest, null, 2));
    }
    const manifest = JSON.parse(readGolden(manifestName)) as GoldenManifest;
    expect(manifest.files.length).toBe(27);
    for (const entry of manifest.files) {
      const actual = sha256Of(readGolden(entry.file));
      expect(actual, `${entry.file} خُعدل يدويًا أو انحرف عن الأصل`).toBe(entry.sha256);
    }
  });
});

describe("Wave 3A — golden directory hygiene", () => {
  it("no unexpected files live in the golden directory", () => {
    if (GENERATE || !existsSync(GOLDEN_DIR)) return;
    const files = readdirSync(GOLDEN_DIR).filter(f => !f.startsWith("."));
    const manifest = JSON.parse(readGolden("MANIFEST.json")) as GoldenManifest;
    const expected = new Set(manifest.files.map(f => f.file).concat("MANIFEST.json"));
    for (const f of files) {
      expect(expected.has(f), `ملف غير manifest في دليل الذهبيات: ${f}`).toBe(true);
    }
  });
});
