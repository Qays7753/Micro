#!/usr/bin/env node
/**
 * Wave G2 (STR-619) — generated test/documentation coverage evidence.
 *
 * يولّد `docs/architecture/refactoring/generated/test-map.json` من الشجرة الحية:
 * (1) خريطة صفحة→اختبار (مستوردون مباشرون؛ وعند غيابهم: إشارات بالاسم ثم
 *     بمسار المسجل في MicroRouter)؛ (2) روابط العقود→الرقابة (استشهادات
 *     اسم الملف الحرفية + خريطة مفاهيم مُنسّقة)؛ (3) مواضع اختبارات المجال.
 *
 * الاستخدام: node scripts/generate-test-map.mjs [--check]
 * --check: يقارن الناتج بالملف الملتزم ويفشل عند الانجراف (دبوس الانجراف).
 * الخروج: 0 نجاح؛ 1 انجراف أو خطأ.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP = path.join(ROOT, "apps/prototype-web/client/src");
const OUT_PATH = path.join(ROOT, "docs/architecture/refactoring/generated/test-map.json");

/** روابط الرقابة المُنسّقة: ملف العقد → نمط أسماء ملفات الاختبار/الرقابة التي تثبته. */
export const CONTROL_LINKS = {
  "01-financial-result-contract.md": "financial-analysis|periodComparison|periodResult|statement",
  "02-order-lifecycle-contract.md": "Wave4ContractOracles|craft-order",
  "03-cost-snapshot-contract.md": "cost|CostEstimate|DraftCost",
  "04-limited-sync-contract.md": null,
  "05-financial-p0-policies.md": "FinalLogicOwnerDecisions|Wave4ContractOracles",
  "06-financial-event-prototype-contract.md": "financial-event",
  "07-schedule-capacity-prototype-contract.md": "scheduling/|scheduleService|capacityDecision",
  "08-expense-classification-prototype-contract.md": "expense-category|expenseCategory|EventsLayer",
  "09-supplier-purchase-prototype-contract.md": "supplier-purchase|SupplierPurchase",
  "10-cash-continuity-prototype-contract.md": "cash-continuity|cashContinuity",
  "11-inventory-material-consumption-prototype-contract.md": "inventory-material|inventoryMaterial|waste-context",
  "12-financial-insights-g5-prototype-contract.md": "g5|operatingBreakEven|financialPulse",
  "13-actual-material-per-order-prototype-contract.md": "CatalogPlannedCost|templatePlannedCost|materialSuggestions",
  "14-period-result-allocation-policy-prototype-contract.md": "allocationPolicy|AllocationPolicy",
  "15-catalog-reference-prototype-contract.md": "domain/catalog|CatalogCoreStorage|catalogItem",
  "16-optional-operating-mode-and-actual-time-contract.md": "actual-time|actualTime|Set003",
  "17-contribution-break-even-short-cash-g5-contract.md": "operatingBreakEven|shortCash|g5",
  "18-derived-monthly-order-schedule-g6-a-contract.md": "recurring-margin|recurringMargin|Schedule",
  "18-network-identity-workspace-access-contract.md": null,
  "19-bounded-local-schedule-recurrence-g6-b-contract.md": "recurrenceService|recurrence|Schedule",
  "19-services-notification-manage-boundary-contract.md": null,
  "20-agreement-source-follow-up-g7-a-contract.md": "agreement|Agreement|followUp",
  "20-market-need-response-listing-moderation-contract.md": null,
  "21-delivery-request-quote-status-privacy-contract.md": null,
  "21-guided-opening-import-prototype-contract.md": "guidedOpening|GuidedOpening",
  "22-bounded-operating-capacity-pilot-contract.md": "capacityDecision|Set003Capabilities",
  "22-network-moderation-consent-audit-contract.md": null,
  "23-general-financial-event-correction-boundary-proposal-v1.md": "correction|Correction|EventsLayer",
  "23-network-data-lifecycle-recovery-contract.md": null,
  "24-network-data-classification-field-dictionary-contract.md": null,
  "25-network-money-representation-contract.md": null,
  "26-navigation-referrer-and-deep-link-contract.md": "Wave42Package5|useReturnNavigation|navigation",
  "27-guided-financial-entry-contract.md": "FinancialEventEditor.guided|guided",
  "28-selective-inventory-tracking-contract.md": "InventoryMaterials|inventoryMaterial|inventory-material",
  "29-group4-deep-finance-contract.md": "G4Loans|loan|receivedLoan|asset",
  "30-unified-activity-reader-contract.md": "FinanceActivity|activity|EventsLayer",
  "31-period-statement-depth-contract.md": "statementService|Statement",
  "32-local-period-statement-markdown-contract.md": "statementMarkdown|Markdown",
  "33-manual-share-preview-contract.md": "OrderShare|SharePreview",
  "34-correction-history-trail-contract.md": "correctionHistory",
  "35-integrity-continuity-checks-contract.md": "integrityCheck|Integrity",
  "36-form-drafts-local-boundary-contract.md": "drafts|Draft",
  "37-local-app-lock-contract.md": "lockGate|Settings.lock|security",
  "38-pwa-dirty-safe-update-contract.md": "pwa/|Pwa|dirty",
  "39-export-envelope-integrity-contract.md": "group6Docs|exportGoldens|transferEnvelope",
  "40-technical-ownership-map-contract.md": "ownershipBoundaries|group6Docs|Wave42Package5",
  "41-recurring-expense-reminders-contract.md": "recurringExpense|RecurringExpense",
  "42-optional-expense-budgets-goals-contract.md": "expenseBudget|ExpenseBudget",
  "43-asset-depreciation-prototype-contract.md": "asset|Asset|assetResidual",
};

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "dist") continue;
      walk(p, acc);
    } else acc.push(p);
  }
  return acc;
}

function toRel(abs, base) {
  return path.relative(base, abs).split(path.sep).join("/");
}

const fileContentCache = new Map();
function readCached(file) {
  let c = fileContentCache.get(file);
  if (c === undefined) {
    c = fs.readFileSync(file, "utf8");
    fileContentCache.set(file, c);
  }
  return c;
}
const importsCache = new Map();
function importsOfCached(file) {
  let v = importsCache.get(file);
  if (v === undefined) {
    v = importsOf(file);
    importsCache.set(file, v);
  }
  return v;
}

function importsOf(file) {
  const src = readCached(file);
  const out = new Set();
  const re = /(?:import|export)[^'"]*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const spec = m[1] || m[2];
    if (spec && (spec.startsWith(".") || spec.startsWith("@/"))) out.add(spec);
  }
  return out;
}

const realpathCache = new Map();
function realpathCached(p) {
  let v = realpathCache.get(p);
  if (v === undefined) {
    try {
      v = fs.realpathSync(p);
    } catch {
      v = null;
    }
    realpathCache.set(p, v);
  }
  return v;
}

function sameFile(a, b) {
  return realpathCached(a) !== null && realpathCached(a) === realpathCached(b);
}

export function generate() {
  const appFiles = walk(APP);
  const testFiles = appFiles.filter(f => /\.(test|spec)\.[tj]sx?$/.test(f));
  const pageFiles = appFiles.filter(
    f => f.startsWith(APP + "/pages/") && f.endsWith(".tsx") && !/\.test\./.test(f),
  );

  /* مسارات الصفحات من MicroRouter (لربط الأدلة غير المباشرة). */
  const routerSrc = fs.readFileSync(path.join(APP, "app/MicroRouter.tsx"), "utf8");
  const routeRe = /<Route path="([^"]+)" component=\{(\w+)\} \/>/g;
  const routeByComponent = {};
  let rm;
  while ((rm = routeRe.exec(routerSrc)) !== null) routeByComponent[rm[2]] = rm[1];
  const lazyRe = /const (\w+) = lazy\(\(\) => import\("@\/pages\/(\w+)"\)\)/g;
  const componentByPage = {};
  let lm;
  while ((lm = lazyRe.exec(routerSrc)) !== null) componentByPage[lm[2]] = lm[1];

  const pageMap = {};
  const pageEvidence = {};
  for (const page of pageFiles) {
    const rel = toRel(page, APP);
    const base = path.basename(page, ".tsx");
    const direct = [];
    for (const t of testFiles) {
      for (const s of importsOfCached(t)) {
        let p2;
        if (s.startsWith("@/")) p2 = path.join(APP, s.slice(2));
        else p2 = path.resolve(path.dirname(t), s);
        if (
          sameFile(p2, page) ||
          sameFile(p2 + ".tsx", page) ||
          sameFile(p2 + ".ts", page)
        ) {
          direct.push(toRel(t, APP));
          break;
        }
      }
    }
    let kind = "direct";
    let evidence = [...new Set(direct)].sort();
    if (evidence.length === 0) {
      /* إشارة بالاسم داخل ملفات الاختبار */
      const named = testFiles.filter(t => readCached(t).includes(base)).map(t => toRel(t, APP));
      if (named.length > 0) {
        kind = "named-reference";
        evidence = [...new Set(named)].sort();
      } else {
        /* مسار المسجل (مطابقة بادئة المسار كنص جزئي داخل مصدر الاختبار) */
        const comp = componentByPage[base];
        const route = comp ? routeByComponent[comp] : undefined;
        if (route) {
          const prefix = route.split("/:")[0].replace(/^\//, "");
          const needle = "/" + prefix;
          const byRoute = testFiles
            .filter(t => readCached(t).includes(needle))
            .map(t => toRel(t, APP));
          if (byRoute.length > 0) {
            kind = "route-reference";
            evidence = [...new Set(byRoute)].sort();
          }
        }
      }
    }
    pageMap[rel] = { kind, evidence };
    if (kind === "direct") pageMap[rel].evidence = pageMap[rel].evidence;
  }

  /* العقود: استشهاد حرفي + نمط مفهوم مُنسّق */
  const contractDir = path.join(ROOT, "docs/contracts");
  const contracts = fs.readdirSync(contractDir).filter(f => f.endsWith(".md")).sort();
  const allTestRel = [
    ...walk(path.join(ROOT, "tests")).filter(f => /\.(ts|tsx|mjs)$/.test(f)),
    ...testFiles,
    ...walk(path.join(ROOT, "scripts")).filter(f => /\.(mjs|test\.mjs)$/.test(f)),
  ].map(f => (f.startsWith(APP) ? "apps/prototype-web/client/src/" + toRel(f, APP) : toRel(f, ROOT)));
  const allTestAbs = [
    ...walk(path.join(ROOT, "tests")).filter(f => /\.(ts|tsx|mjs)$/.test(f)),
    ...testFiles,
    ...walk(path.join(ROOT, "scripts")).filter(f => /\.(mjs|test\.mjs)$/.test(f)),
  ];

  const contractMap = {};
  for (const c of contracts) {
    const citations = [];
    const curatedRe = CONTROL_LINKS[c];
    const curated = [];
    for (let i = 0; i < allTestAbs.length; i++) {
      /* استبعاد ذاتي: المولّد ودبوسه يذكران أسماء العقود كبيانات فلا يُحسبان
       * استشهادًا رقابيًا. */
      if (
        allTestRel[i].endsWith("scripts/generate-test-map.mjs") ||
        allTestRel[i].endsWith("scripts/generate-test-map.test.mjs")
      )
        continue;
      const src = readCached(allTestAbs[i]);
      if (src.includes(c)) citations.push(allTestRel[i]);
      if (curatedRe && new RegExp(curatedRe).test(allTestRel[i])) curated.push(allTestRel[i]);
    }
    contractMap[c] = {
      citations: [...new Set(citations)].sort(),
      curated: curatedRe ? [...new Set(curated)].sort() : null,
    };
  }

  /* مواضع اختبارات المجال */
  const domainLocations = {
    "tests/domain/": walk(path.join(ROOT, "tests/domain"))
      .filter(f => f.endsWith(".test.ts"))
      .map(f => toRel(f, ROOT))
      .sort(),
    "tests/ (root)": fs
      .readdirSync(path.join(ROOT, "tests"))
      .filter(f => f.endsWith(".test.ts"))
      .map(f => "tests/" + f)
      .sort(),
    "src/domain/ (colocated)": walk(path.join(ROOT, "src/domain"))
      .filter(f => f.endsWith(".test.ts"))
      .map(f => toRel(f, ROOT))
      .sort(),
  };

  let head = "unknown";
  try {
    head = execSync("git rev-parse HEAD", { cwd: ROOT }).toString().trim();
  } catch {}

  return {
    generator: "scripts/generate-test-map.mjs",
    head,
    pages: {
      total: pageFiles.length,
      map: pageMap,
      withoutDirectEvidence: Object.entries(pageMap)
        .filter(([, v]) => v.evidence.length === 0)
        .map(([k]) => k)
        .sort(),
    },
    contracts: { total: contracts.length, map: contractMap },
    domainTestLocations: domainLocations,
  };
}

function main(argv) {
  const check = argv.includes("--check");
  const data = generate();
  const json = JSON.stringify(data, null, 2) + "\n";
  if (check) {
    const committed = fs.readFileSync(OUT_PATH, "utf8");
    const a = JSON.parse(committed);
    const b = JSON.parse(json);
    /* حقل head بيانات نسب (التزام التوليد) لا محتوى — يُتجاهل في فحص الانجراف. */
    delete a.head;
    delete b.head;
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      console.error("generate-test-map: FAIL drift detected — regenerate with node scripts/generate-test-map.mjs");
      process.exit(1);
    }
    console.log("generate-test-map: no drift (matches committed evidence)");
    process.exit(0);
  }
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, json);
  console.log(`generate-test-map: wrote ${toRel(OUT_PATH, ROOT)} (pages ${data.pages.total}, contracts ${data.contracts.total})`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main(process.argv.slice(2));
}
