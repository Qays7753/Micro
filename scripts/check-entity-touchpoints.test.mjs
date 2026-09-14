/**
 * المجموعة ٦ (برنامج التحصين الكامل): اختبارات حارس نقاط اتصال الكيانات —
 * حتمية بلا شبكة ولا نوم؛ مستودعات مصغرة تُبنى في مجلدات مؤقتة بنفس
 * اصطلاح المستودع الحقيقي (const xStore = "name" ثم createObjectStore(x, …)).
 *
 * تغطي: البيان السليم، الكيان الناقص من البيان، الكيان المجهول، الغياب بلا
 * سبب، حقل لقطة غائب عن الأنواع، نوع مجال غائب، مهايئات خاطئة، مسارات
 * اختبار معدومة/فارغة، كيان مصدر بلا أدلة نقل، التوثيق الناقص، JSON تالف،
 * بيان مفقود، اسم store ديناميكي (استخراج صادق)، سجل localStorage يسير
 * وسليم، سلوك CLI، والمستودع الحي نفسه (فحص دخاني).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { ROOT, extractObjectStores, validateEntityTouchpoints } from "./check-entity-touchpoints.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url).replace(
  /check-entity-touchpoints\.test\.mjs$/,
  "check-entity-touchpoints.mjs",
);

const tempDirs = [];
function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "micro-touchpoints-"));
  tempDirs.push(dir);
  return dir;
}
afterAll(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

const STORE_SOURCE = `const alphaStore = "alpha";
const betaStore = "beta";
database.createObjectStore(alphaStore, { keyPath: "id" });
database.createObjectStore(betaStore, { keyPath: "id" });
`;
const TYPES_SOURCE = `export type AlphaRecord = { id: string };
export type BetaRecord = { id: string };
export type LocalStoreSnapshot = {
  alpha: readonly AlphaRecord[];
  beta?: readonly BetaRecord[];
};
`;

function makeMiniRepo({ manifest, storeSource = STORE_SOURCE, typesSource = TYPES_SOURCE } = {}) {
  const root = makeTempDir();
  fs.mkdirSync(path.join(root, "storage"), { recursive: true });
  fs.writeFileSync(path.join(root, "storage", "IndexedDbLocalStore.ts"), storeSource);
  fs.writeFileSync(path.join(root, "storage", "types.ts"), typesSource);
  if (manifest !== undefined) {
    fs.writeFileSync(path.join(root, "manifest.json"), JSON.stringify(manifest, null, 2));
  }
  return root;
}

function baseEntry(store, overrides = {}) {
  return {
    store,
    snapshotField: store === "alpha" ? "alpha" : null,
    domainType: store === "alpha" ? "AlphaRecord" : "BetaRecord",
    adapters: ["memory", "indexeddb"],
    adapterTests: ["storage/IndexedDbLocalStore.test.ts"],
    transferTests: store === "alpha" ? ["transfers/roundTrip.test.ts"] : [],
    notExportedReason: store === "alpha" ? null : "كيان محلي فقط — خارج التصدير بقرار موثق",
    docs: "current-state.md §1",
    ...overrides,
  };
}

function validateFor(root) {
  return validateEntityTouchpoints({
    repoRoot: root,
    manifestPath: "manifest.json",
    storeSourcePath: "storage/IndexedDbLocalStore.ts",
    typesSourcePath: "storage/types.ts",
    minExpectedStores: 2,
  });
}

/** يجهز ملفات الاختبار المذكورة في البيان داخل المستودع المصغر. */
function seedReferencedTests(root) {
  fs.mkdirSync(path.join(root, "transfers"), { recursive: true });
  fs.writeFileSync(path.join(root, "storage", "IndexedDbLocalStore.test.ts"), "// test\n");
  fs.writeFileSync(path.join(root, "transfers", "roundTrip.test.ts"), "// test\n");
}

describe("check-entity-touchpoints — extraction", () => {
  it("resolves store constants through createObjectStore calls", () => {
    expect(extractObjectStores(STORE_SOURCE)).toEqual(["alpha", "beta"]);
  });

  it("returns unresolved identifiers honestly when names become dynamic", () => {
    const dynamic = 'const name = computeName();\ndatabase.createObjectStore(name, { keyPath: "id" });\n';
    expect(extractObjectStores(dynamic)).toEqual(["unresolved:name"]);
  });
});

describe("check-entity-touchpoints — split storage sources (Group 10)", () => {
  it("reads constants and createObjectStore calls from two files as one source", () => {
    const root = makeMiniRepo({
      manifest: { objectStores: [baseEntry("alpha"), baseEntry("beta")] },
    });
    /* الثوابت في ملف والإنشاء في آخر — الفحص يقرأهما معًا (المجموعة ١٠). */
    fs.writeFileSync(path.join(root, "storage", "indexedDbStores.ts"), STORE_SOURCE);
    fs.writeFileSync(path.join(root, "storage", "indexedDbMigrations.ts"), "");
    fs.writeFileSync(
      path.join(root, "storage", "IndexedDbLocalStore.ts"),
      "/* decomposed: constants and creation moved out */\n",
    );
    seedReferencedTests(root);
    const { ok, findings } = validateEntityTouchpoints({
      repoRoot: root,
      manifestPath: "manifest.json",
      storeSourcePaths: ["storage/indexedDbStores.ts", "storage/indexedDbMigrations.ts"],
      typesSourcePath: "storage/types.ts",
      minExpectedStores: 2,
    });
    expect(findings).toEqual([]);
    expect(ok).toBe(true);
  });
});

describe("check-entity-touchpoints — manifest validation", () => {
  it("passes a complete manifest where every omission has a reason", () => {
    const root = makeMiniRepo({
      manifest: {
        objectStores: [baseEntry("alpha"), baseEntry("beta")],
        localOnlyRecords: [
          {
            record: "micro.local-only.v1",
            storage: "localStorage",
            adapterTests: ["localDiagnosticsService.test.ts"],
            notExportedReason: "سجل محلي خصوصي لا يُصدَّر أبدًا (سبب موثق)",
            docs: "current-state.md §2",
          },
        ],
      },
    });
    seedReferencedTests(root);
    fs.writeFileSync(path.join(root, "localDiagnosticsService.test.ts"), "// test\n");
    const { ok, findings } = validateFor(root);
    expect(findings).toEqual([]);
    expect(ok).toBe(true);
  });

  it("fails when a real store is missing from the manifest", () => {
    const root = makeMiniRepo({ manifest: { objectStores: [baseEntry("alpha")] } });
    seedReferencedTests(root);
    const { ok, findings } = validateFor(root);
    expect(ok).toBe(false);
    expect(findings).toContainEqual({
      code: "MANIFEST_STORE_MISSING",
      entity: "beta",
      detail: "created in code but absent from the manifest",
    });
  });

  it("fails when the manifest lists a store the code never creates", () => {
    const root = makeMiniRepo({
      manifest: { objectStores: [baseEntry("alpha"), baseEntry("beta"), baseEntry("ghost")] },
    });
    seedReferencedTests(root);
    const { findings } = validateFor(root);
    expect(findings).toContainEqual({
      code: "MANIFEST_STORE_UNKNOWN",
      entity: "ghost",
      detail: "store not created in the IndexedDB storage sources (indexedDbStores/indexedDbMigrations)",
    });
  });

  it("fails when a not-exported entity has no explicit reason", () => {
    const root = makeMiniRepo({
      manifest: {
        objectStores: [
          baseEntry("alpha"),
          baseEntry("beta", { notExportedReason: "" }),
        ],
      },
    });
    seedReferencedTests(root);
    const { findings } = validateFor(root);
    expect(findings.some((f) => f.code === "REASON_REQUIRED" && f.entity === "beta")).toBe(true);
  });

  it("fails when the declared snapshot field is absent from the types source", () => {
    const root = makeMiniRepo({
      manifest: { objectStores: [baseEntry("alpha", { snapshotField: "phantomField" }), baseEntry("beta")] },
    });
    seedReferencedTests(root);
    const { findings } = validateFor(root);
    expect(findings.some((f) => f.code === "SNAPSHOT_FIELD_ABSENT" && f.entity === "alpha")).toBe(true);
  });

  it("fails when the domain type is absent, adapters are wrong, or docs are missing", () => {
    const root = makeMiniRepo({
      manifest: {
        objectStores: [
          baseEntry("alpha", { domainType: "PhantomRecord", adapters: ["memory"], docs: "" }),
          baseEntry("beta"),
        ],
      },
    });
    seedReferencedTests(root);
    const { findings } = validateFor(root);
    expect(findings.some((f) => f.code === "DOMAIN_TYPE_ABSENT" && f.entity === "alpha")).toBe(true);
    expect(findings.some((f) => f.code === "ADAPTERS_INVALID" && f.entity === "alpha")).toBe(true);
    expect(findings.some((f) => f.code === "DOCS_REQUIRED" && f.entity === "alpha")).toBe(true);
  });

  it("fails on empty adapter tests, missing test files, and exported entities without transfer tests", () => {
    const root = makeMiniRepo({
      manifest: {
        objectStores: [
          baseEntry("alpha", {
            adapterTests: ["storage/nope.test.ts"],
            transferTests: [],
          }),
          baseEntry("beta"),
        ],
      },
    });
    seedReferencedTests(root);
    const { findings } = validateFor(root);
    expect(findings.some((f) => f.code === "TEST_PATH_NOT_FOUND" && f.entity === "alpha")).toBe(true);
    expect(findings.some((f) => f.code === "TRANSFER_TESTS_REQUIRED" && f.entity === "alpha")).toBe(true);
    const empty = makeMiniRepo({
      manifest: { objectStores: [baseEntry("alpha", { adapterTests: [] }), baseEntry("beta")] },
    });
    seedReferencedTests(empty);
    expect(
      validateFor(empty).findings.some(
        (f) => f.code === "ADAPTER_TESTS_REQUIRED" && f.entity === "alpha",
      ),
    ).toBe(true);
  });

  it("fails honestly on malformed or missing manifests", () => {
    const malformed = makeMiniRepo({ manifest: { objectStores: "not-an-array" } });
    expect(validateFor(malformed).findings[0]?.code).toBe("MANIFEST_INVALID_JSON");
    const broken = makeMiniRepo();
    fs.writeFileSync(path.join(broken, "manifest.json"), "{ this is not json");
    expect(validateFor(broken).findings[0]?.code).toBe("MANIFEST_INVALID_JSON");
    const absent = makeMiniRepo({ manifest: undefined });
    expect(validateFor(absent).findings[0]?.code).toBe("MANIFEST_MISSING");
  });

  it("fails dynamic store names (STORE_EXTRACT_FAIL) instead of passing silently", () => {
    const dynamicRoot = makeMiniRepo({
      storeSource: 'const name = computeName();\ndatabase.createObjectStore(name, { keyPath: "id" });\n',
      manifest: { objectStores: [baseEntry("alpha"), baseEntry("beta")] },
    });
    seedReferencedTests(dynamicRoot);
    const { findings } = validateFor(dynamicRoot);
    expect(findings.some((f) => f.code === "STORE_EXTRACT_FAIL")).toBe(true);
  });

  it("validates local-only records: storage kind, reason, tests, and no IDB overlap", () => {
    const root = makeMiniRepo({
      manifest: {
        objectStores: [baseEntry("alpha"), baseEntry("beta")],
        localOnlyRecords: [
          { record: "alpha", storage: "localStorage", adapterTests: [], notExportedReason: "x", docs: "d" },
          {
            record: "micro.x.v1",
            storage: "indexeddb",
            adapterTests: ["a.test.ts"],
            notExportedReason: "reason",
            docs: "d",
          },
          {
            record: "micro.y.v1",
            storage: "localStorage",
            adapterTests: ["exists.test.ts"],
            notExportedReason: "",
            docs: "",
          },
        ],
      },
    });
    seedReferencedTests(root);
    fs.writeFileSync(path.join(root, "exists.test.ts"), "// test\n");
    const { findings } = validateFor(root);
    expect(findings.some((f) => f.code === "LOCAL_RECORD_IS_STORE" && f.entity === "alpha")).toBe(true);
    expect(findings.some((f) => f.code === "LOCAL_RECORD_INVALID" && f.entity === "micro.x.v1")).toBe(true);
    expect(findings.some((f) => f.code === "REASON_REQUIRED" && f.entity === "micro.y.v1")).toBe(true);
    expect(findings.some((f) => f.code === "DOCS_REQUIRED" && f.entity === "micro.y.v1")).toBe(true);
    expect(findings.some((f) => f.code === "TEST_PATH_NOT_FOUND" && f.entity === "micro.x.v1")).toBe(true);
  });
});

describe("check-entity-touchpoints — CLI and live repository", () => {
  /** مستودع مصغر بـ٢١ متجرًا بالبنية النسبية نفسها التي يستخدمها الـCLI افتراضيًا. */
  function makeCliMiniRepo() {
    const root = makeTempDir();
    const storeDir = path.join(root, "apps/prototype-web/client/src/storage/local");
    fs.mkdirSync(storeDir, { recursive: true });
    fs.mkdirSync(path.join(root, "docs/quality"), { recursive: true });
    const storeNames = Array.from({ length: 21 }, (_, index) => `entity${index + 1}`);
    const storeSource = [
      ...storeNames.map((name) => `const ${name}Store = "${name}";`),
      ...storeNames.map((name) => `database.createObjectStore(${name}Store, { keyPath: "id" });`),
      "",
    ].join("\n");
    const typesSource = [
      ...storeNames.map((name) => `export type ${name}Record = { id: string };`),
      "export type LocalStoreSnapshot = {",
      ...storeNames.map((name) => `  ${name}: readonly ${name}Record[];`),
      "};",
      "",
    ].join("\n");
    /* المجموعة ١٠: الثوابت والإنشاء في ملفين — كما في المصدر الحقيقي بعد التفكيك. */
    fs.writeFileSync(path.join(storeDir, "indexedDbStores.ts"), storeNames.map((name) => `const ${name}Store = "${name}";`).join("\n") + "\n");
    fs.writeFileSync(
      path.join(storeDir, "indexedDbMigrations.ts"),
      storeNames.map((name) => `database.createObjectStore(${name}Store, { keyPath: "id" });`).join("\n") + "\n",
    );
    fs.writeFileSync(path.join(storeDir, "types.ts"), typesSource);
    fs.writeFileSync(path.join(storeDir, "IndexedDbLocalStore.test.ts"), "// test\n");
    const manifest = {
      objectStores: storeNames.slice(0, 20).map((name) => ({
        store: name,
        snapshotField: name,
        domainType: `${name}Record`,
        adapters: ["memory", "indexeddb"],
        adapterTests: ["apps/prototype-web/client/src/storage/local/IndexedDbLocalStore.test.ts"],
        transferTests: ["apps/prototype-web/client/src/storage/local/IndexedDbLocalStore.test.ts"],
        notExportedReason: null,
        docs: "current-state.md §1",
      })),
    };
    fs.writeFileSync(
      path.join(root, "docs/quality/persistent-entity-touchpoints.json"),
      JSON.stringify(manifest, null, 2),
    );
    return root;
  }

  it("exits 1 with code:entity:detail lines on a manifest missing a real store", () => {
    const root = makeCliMiniRepo();
    const result = spawnSync(process.execPath, [SCRIPT_PATH, root], { encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("check-entity-touchpoints: FAIL");
    expect(result.stderr).toContain("MANIFEST_STORE_MISSING : entity21");
  });

  it("exits 0 when the 21-store manifest is completed", () => {
    const root = makeCliMiniRepo();
    const manifestPath = path.join(root, "docs/quality/persistent-entity-touchpoints.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    manifest.objectStores.push({
      store: "entity21",
      snapshotField: "entity21",
      domainType: "entity21Record",
      adapters: ["memory", "indexeddb"],
      adapterTests: ["apps/prototype-web/client/src/storage/local/IndexedDbLocalStore.test.ts"],
      transferTests: ["apps/prototype-web/client/src/storage/local/IndexedDbLocalStore.test.ts"],
      notExportedReason: null,
      docs: "current-state.md §1",
    });
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    const result = spawnSync(process.execPath, [SCRIPT_PATH, root], { encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("check-entity-touchpoints: PASS");
  });

  it("rejects extra arguments (USAGE) and missing roots (ROOT_MISSING)", () => {
    const extra = spawnSync(process.execPath, [SCRIPT_PATH, "/tmp", "/another"], { encoding: "utf8" });
    expect(extra.status).toBe(1);
    expect(extra.stderr).toContain("USAGE");
    const missing = spawnSync(
      process.execPath,
      [SCRIPT_PATH, path.join(os.tmpdir(), "micro-definitely-missing-dir-xyz")],
      { encoding: "utf8" },
    );
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain("ROOT_MISSING");
  });

  it("passes on the live repository manifest (smoke — every real store covered)", () => {
    const result = spawnSync(process.execPath, [SCRIPT_PATH, ROOT], { encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("check-entity-touchpoints: PASS");
  });
});
