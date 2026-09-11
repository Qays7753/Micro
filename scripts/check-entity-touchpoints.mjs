#!/usr/bin/env node
/**
 * المجموعة ٦ (برنامج التحصين الكامل 2026): حارس نقاط اتصال الكيانات الدائمة.
 *
 * الغاية: كل object store في IndexedDB (أو سجل محلي دائم) يجب أن يكون مسجلًا
 * في `docs/quality/persistent-entity-touchpoints.json` مع نقاط اتصاله المعلنة:
 * المهايئان (Memory/IndexedDB)، اختبارات التخزين، التصدير/الاستيراد أو سبب
 * استثناءه الصريح، والنوع ونقطة التوثيق. إضافة store بلا تسجيل تفشل الفحص؛
 * وحذف store يترك مدخلًا يتيمًا فيفشل الفحص أيضًا.
 *
 * حدود الأمانة (مقصودة وموثقة): هذا الحارس يتحقق من اكتمال التغطية المعلنة
 * (كل store مسجل، وكل مسار مذكور موجود فعلًا، وكل غياب له سبب صريح) — هو
 * ليس إثباتًا دلاليًا بأن الاختبار المذكور «يكفي»؛ كفاية الاختبار تُقاس
 * بمراجعة الاختبارات نفسها لا بفحص أسماء. من يدعي أن المسح الاسمي يثبت
 * الاكتمال الدلالي فهو مخطئ، والوثيقة تقول ذلك صراحة.
 *
 * الاستخراج من المصدر: أسماء الـ stores من حرفيات `createObjectStore("…")`
 * في `IndexedDbLocalStore.ts` (أسماء نصية ثابتة)، وحقول اللقطة من
 * `LocalStoreSnapshot` في `types.ts`. تغيير بنية المصدر إلى أسماء ديناميكية
 * يُفشل الفحص بصدق (STORE_EXTRACT_FAIL) لا أن يمر بصمت.
 *
 * الاستخدام: node scripts/check-entity-touchpoints.mjs [repoRoot].
 * الخروج: 0 = البيان سليم؛ 1 = أي إخلال (رمز سبب + الكيان، بلا stack traces).
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const DEFAULTS = {
  manifestPath: "docs/quality/persistent-entity-touchpoints.json",
  storeSourcePath: "apps/prototype-web/client/src/storage/local/IndexedDbLocalStore.ts",
  typesSourcePath: "apps/prototype-web/client/src/storage/local/types.ts",
};

/** الحد الأدنى المتوقع من stores — أقل من هذا يعني تغير بنية المصدر. */
export const MIN_EXPECTED_STORES = 20;

export const CREATE_STORE_REGEX = /createObjectStore\(\s*([A-Za-z_$][\w$]*)\s*,/g;
export const CONST_STRING_REGEX = /const\s+([A-Za-z_$][\w$]*)\s*=\s*"([^"]*)"/g;

/**
 * استخراج أسماء object stores من مصدر IndexedDbLocalStore.ts:
 * المستودع يعرّف `const xStore = "name"` ثم ينشئ بـ`createObjectStore(x, …)`.
 * الاستخراج يحل المتغير إلى قيمته الحرفية؛ اسم غير قابل للحل (ديناميكي أو
 * معدوم) يُعاد كما هو فيفشل التطابق بصدق لا أن يمر بصمت.
 */
export function extractObjectStores(storeSource) {
  const stringConstants = new Map();
  let constMatch;
  CONST_STRING_REGEX.lastIndex = 0;
  while ((constMatch = CONST_STRING_REGEX.exec(storeSource)) !== null) {
    stringConstants.set(constMatch[1], constMatch[2]);
  }
  const stores = [];
  let match;
  CREATE_STORE_REGEX.lastIndex = 0;
  while ((match = CREATE_STORE_REGEX.exec(storeSource)) !== null) {
    const identifier = match[1];
    stores.push(stringConstants.get(identifier) ?? `unresolved:${identifier}`);
  }
  return stores;
}

/** هل حقل اللقطة موجود حرفيًا كخاصية في مصدر الأنواع؟ */
export function snapshotFieldExists(typesSource, field) {
  const fieldRegex = new RegExp(`(^|\\s)${field}\\s*\\??\\s*:`);
  return fieldRegex.test(typesSource);
}

function checkPathExists(repoRoot, finding, entity, relativePath, code) {
  if (typeof relativePath !== "string" || relativePath.length === 0) {
    finding.push({ code, entity, detail: "empty path" });
    return;
  }
  const absolute = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolute)) {
    finding.push({ code, entity, detail: relativePath });
  }
}

/**
 * التحقق الكامل للبيان مقابل المصدر — يعيد {ok, findings}.
 * كل finding: {code, entity, detail} — بلا استثناءات ولا مسارات مطبوعة.
 */
export function validateEntityTouchpoints({
  repoRoot = ROOT,
  manifestPath = DEFAULTS.manifestPath,
  storeSourcePath = DEFAULTS.storeSourcePath,
  typesSourcePath = DEFAULTS.typesSourcePath,
  minExpectedStores = MIN_EXPECTED_STORES,
} = {}) {
  const findings = [];
  const root = path.resolve(repoRoot);
  const manifestFile = path.join(root, manifestPath);
  const storeFile = path.join(root, storeSourcePath);
  const typesFile = path.join(root, typesSourcePath);

  if (!fs.existsSync(manifestFile)) {
    return { ok: false, findings: [{ code: "MANIFEST_MISSING", entity: "-", detail: manifestPath }] };
  }
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  } catch {
    return {
      ok: false,
      findings: [{ code: "MANIFEST_INVALID_JSON", entity: "-", detail: manifestPath }],
    };
  }
  if (!fs.existsSync(storeFile)) {
    return { ok: false, findings: [{ code: "STORE_SOURCE_MISSING", entity: "-", detail: storeSourcePath }] };
  }
  if (!fs.existsSync(typesFile)) {
    return { ok: false, findings: [{ code: "TYPES_SOURCE_MISSING", entity: "-", detail: typesSourcePath }] };
  }

  const storeSource = fs.readFileSync(storeFile, "utf8");
  const typesSource = fs.readFileSync(typesFile, "utf8");
  const codeStores = extractObjectStores(storeSource);
  if (codeStores.length < minExpectedStores || new Set(codeStores).size !== codeStores.length) {
    findings.push({
      code: "STORE_EXTRACT_FAIL",
      entity: "-",
      detail: `extracted=${codeStores.length} (min=${minExpectedStores}, unique=${new Set(codeStores).size})`,
    });
  }

  const entries = Array.isArray(manifest.objectStores) ? manifest.objectStores : null;
  if (entries === null) {
    return {
      ok: false,
      findings: [{ code: "MANIFEST_INVALID_JSON", entity: "-", detail: "objectStores array missing" }],
    };
  }

  const manifestStores = new Set();
  for (const entry of entries) {
    const entity = typeof entry?.store === "string" ? entry.store : "(unnamed)";
    manifestStores.add(entity);

    if (codeStores.length >= minExpectedStores && !codeStores.includes(entity)) {
      findings.push({ code: "MANIFEST_STORE_UNKNOWN", entity, detail: "store not created in IndexedDbLocalStore.ts" });
    }

    const exported = typeof entry?.snapshotField === "string" && entry.snapshotField.length > 0;
    if (exported) {
      if (!snapshotFieldExists(typesSource, entry.snapshotField)) {
        findings.push({ code: "SNAPSHOT_FIELD_ABSENT", entity, detail: entry.snapshotField });
      }
      if (!Array.isArray(entry.transferTests) || entry.transferTests.length === 0) {
        findings.push({ code: "TRANSFER_TESTS_REQUIRED", entity, detail: "exported entity needs >=1 transfer/import test path" });
      } else {
        for (const testPath of entry.transferTests) {
          checkPathExists(root, findings, entity, testPath, "TEST_PATH_NOT_FOUND");
        }
      }
    } else if (typeof entry?.notExportedReason !== "string" || entry.notExportedReason.trim().length < 10) {
      findings.push({
        code: "REASON_REQUIRED",
        entity,
        detail: "not-exported entity needs an explicit notExportedReason (>=10 chars)",
      });
    }

    if (typeof entry?.domainType !== "string" || !typesSource.includes(entry.domainType)) {
      findings.push({ code: "DOMAIN_TYPE_ABSENT", entity, detail: String(entry?.domainType) });
    }

    const adapters = entry?.adapters;
    if (
      !Array.isArray(adapters) ||
      adapters.length !== 2 ||
      adapters[0] !== "memory" ||
      adapters[1] !== "indexeddb"
    ) {
      findings.push({ code: "ADAPTERS_INVALID", entity, detail: JSON.stringify(adapters) });
    }

    if (!Array.isArray(entry?.adapterTests) || entry.adapterTests.length === 0) {
      findings.push({ code: "ADAPTER_TESTS_REQUIRED", entity, detail: ">=1 test exercising this store through an adapter" });
    } else {
      for (const testPath of entry.adapterTests) {
        checkPathExists(root, findings, entity, testPath, "TEST_PATH_NOT_FOUND");
      }
    }

    if (typeof entry?.docs !== "string" || entry.docs.trim().length === 0) {
      findings.push({ code: "DOCS_REQUIRED", entity, detail: "docs pointer (current-state section) required" });
    }
  }

  for (const store of codeStores) {
    if (!manifestStores.has(store)) {
      findings.push({ code: "MANIFEST_STORE_MISSING", entity: store, detail: "created in code but absent from the manifest" });
    }
  }

  const localRecords = Array.isArray(manifest.localOnlyRecords) ? manifest.localOnlyRecords : [];
  for (const record of localRecords) {
    const entity = typeof record?.record === "string" ? record.record : "(unnamed)";
    if (codeStores.includes(entity)) {
      findings.push({ code: "LOCAL_RECORD_IS_STORE", entity, detail: "IndexedDB store must be listed under objectStores" });
    }
    if (record?.storage !== "localStorage") {
      findings.push({ code: "LOCAL_RECORD_INVALID", entity, detail: "storage must be 'localStorage'" });
    }
    if (typeof record?.notExportedReason !== "string" || record.notExportedReason.trim().length < 10) {
      findings.push({ code: "REASON_REQUIRED", entity, detail: "local-only record needs explicit notExportedReason" });
    }
    if (!Array.isArray(record?.adapterTests) || record.adapterTests.length === 0) {
      findings.push({ code: "ADAPTER_TESTS_REQUIRED", entity, detail: ">=1 test exercising this record" });
    } else {
      for (const testPath of record.adapterTests) {
        checkPathExists(root, findings, entity, testPath, "TEST_PATH_NOT_FOUND");
      }
    }
    if (typeof record?.docs !== "string" || record.docs.trim().length === 0) {
      findings.push({ code: "DOCS_REQUIRED", entity, detail: "docs pointer required" });
    }
  }

  return { ok: findings.length === 0, findings };
}

function main() {
  const repoRoot = process.argv[2] ?? ROOT;
  if (process.argv.length > 3) {
    process.stderr.write(
      "check-entity-touchpoints: USAGE — node scripts/check-entity-touchpoints.mjs [repoRoot]\n",
    );
    return 1;
  }
  if (!fs.existsSync(repoRoot)) {
    process.stderr.write(`check-entity-touchpoints: ROOT_MISSING — ${repoRoot}\n`);
    return 1;
  }
  const { ok, findings } = validateEntityTouchpoints({ repoRoot });
  if (!ok) {
    process.stderr.write(
      `check-entity-touchpoints: FAIL — ${findings.length} finding(s) — (code:entity:detail)\n` +
        findings.map((f) => `  ${f.code} : ${f.entity} : ${f.detail}`).join("\n") +
        "\n",
    );
    return 1;
  }
  process.stdout.write(
    "check-entity-touchpoints: PASS — manifest covers every store, every declared path exists, every omission has a reason\n",
  );
  return 0;
}

const invokedDirectly =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  process.exit(main());
}
