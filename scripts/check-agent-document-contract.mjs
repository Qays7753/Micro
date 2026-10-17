#!/usr/bin/env node
/**
 * Documentation governance guard for the Agent operating contract.
 *
 * This guard protects responsibilities and links between the existing
 * AGENTS.md, README, SOP, Handoff, Operations Control, and frozen todo stub.
 * It does not decide product behavior and does not replace any source of truth.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const REQUIRED_FILES = [
  "AGENTS.md",
  "README.md",
  "CONTRIBUTING.md",
  "docs/operations/agent-development-sop-v1.md",
  "docs/operations/agent-handoff-protocol-v1.md",
  "docs/operations/slice-handoff-template.md",
  "docs/operations/current-state.md",
  "docs/operations/current-state-log.md",
  "docs/operations/README.md",
  "docs/operations/control/README.md",
  "docs/operations/control/generated/AGENT-BRIEF.md",
  "docs/operations/control/generated/ACTIVE-WORK.md",
  ".github/pull_request_template.md",
  "todo.md",
  "package.json",
];

export const CONTRACTS = {
  "AGENTS.md": {
    markers: ["نقطة الدخول الأولى", "جدول التوجيه الوحيد", "docs/operations/agent-development-sop-v1.md", "docs/operations/agent-handoff-protocol-v1.md"],
    links: ["docs/operations/control/README.md", "docs/operations/current-state.md"],
  },
  "README.md": {
    markers: ["الحالة التنفيذية ليست ثابتة داخل README", "AGENTS.md", "agent-development-sop-v1.md", "agent-handoff-protocol-v1.md"],
    links: ["docs/operations/current-state.md", "docs/operations/README.md", "AGENTS.md"],
    forbidden: ["PR #105", "bridge/financial-decision-core-g3-g5"],
  },
  "CONTRIBUTING.md": {
    markers: ["AGENTS.md", "agent-development-sop-v1.md", "agent-handoff-protocol-v1.md"],
    links: ["docs/operations/agent-development-sop-v1.md"],
  },
  "docs/operations/agent-development-sop-v1.md": {
    markers: ["SOP", "AGENTS.md", "agent-handoff-protocol-v1.md", "Operations Control"],
    links: ["AGENTS.md", "agent-handoff-protocol-v1.md", "docs/operations/control/README.md"],
  },
  "docs/operations/agent-handoff-protocol-v1.md": {
    markers: ["بروتوكول", "AGENTS.md", "agent-development-sop-v1.md", "Operations Control"],
    links: ["AGENTS.md", "agent-development-sop-v1.md", "docs/operations/control/README.md"],
  },
  "docs/operations/slice-handoff-template.md": {
    markers: ["قالب شريحة Micro", "agent-development-sop-v1.md", "Operations Control"],
    links: ["agent-development-sop-v1.md", "agent-handoff-protocol-v1.md", "Operations Control"],
  },
  "docs/operations/README.md": {
    markers: ["AGENTS.md", "agent-development-sop-v1.md", "agent-handoff-protocol-v1.md", "Operations Control"],
    links: ["../../AGENTS.md", "agent-development-sop-v1.md", "agent-handoff-protocol-v1.md", "control/README.md"],
  },
  "docs/operations/control/README.md": {
    markers: ["Operations Control", "مصادر الحقيقة", "generated/AGENT-BRIEF.md", "generated/ACTIVE-WORK.md"],
    links: ["docs/operations/current-state.md", "AGENTS.md"],
  },
  ".github/pull_request_template.md": {
    markers: ["بطاقة الشريحة", "current-state.md", "Operations Control"],
    links: ["AGENTS.md", "current-state.md", "Operations Control"],
  },
  "todo.md": {
    markers: ["كعب حالة مختصر", "Operations Control", "لا تُدار مهام جديدة من هنا"],
    links: ["docs/operations/current-state.md", "docs/operations/control/README.md"],
  },
};

function readText(repoRoot, relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  return fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, "utf8") : null;
}

export function checkAgentDocumentContract({ repoRoot = ROOT } = {}) {
  const findings = [];
  const root = path.resolve(repoRoot);

  for (const relativePath of REQUIRED_FILES) {
    if (!fs.existsSync(path.join(root, relativePath))) {
      findings.push({ kind: "missing-file", path: relativePath, message: `${relativePath} is required by the Agent documentation contract` });
    }
  }

  if (fs.existsSync(path.join(root, "AGENT.md"))) {
    findings.push({ kind: "competing-entry-point", path: "AGENT.md", message: "root AGENT.md must not compete with AGENTS.md" });
  }

  for (const [relativePath, contract] of Object.entries(CONTRACTS)) {
    const text = readText(root, relativePath);
    if (text === null) continue;
    for (const marker of contract.markers ?? []) {
      if (!text.includes(marker)) {
        findings.push({ kind: "missing-marker", path: relativePath, message: `missing required marker: ${marker}` });
      }
    }
    for (const link of contract.links ?? []) {
      if (!text.includes(link)) {
        findings.push({ kind: "missing-link", path: relativePath, message: `missing required authority link: ${link}` });
      }
    }
    for (const forbidden of contract.forbidden ?? []) {
      if (text.includes(forbidden)) {
        findings.push({ kind: "stale-claim", path: relativePath, message: `durable operating document contains stale mutable claim: ${forbidden}` });
      }
    }
  }

  const packageText = readText(root, "package.json");
  if (packageText !== null) {
    try {
      const packageJson = JSON.parse(packageText);
      const guards = String(packageJson.scripts?.guards ?? "");
      if (!guards.includes("scripts/check-agent-document-contract.mjs")) {
        findings.push({ kind: "unregistered-guard", path: "package.json", message: "documentation contract guard must run from pnpm guards" });
      }
    } catch (error) {
      findings.push({ kind: "invalid-package", path: "package.json", message: `package.json is not valid JSON: ${error.message}` });
    }
  }

  return findings;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const repoRoot = process.argv[2] ? path.resolve(process.argv[2]) : ROOT;
  if (!fs.existsSync(repoRoot) || !fs.statSync(repoRoot).isDirectory()) {
    console.error(`USAGE: ${path.basename(process.argv[1])} [repo-root]`);
    process.exit(2);
  }
  const findings = checkAgentDocumentContract({ repoRoot });
  for (const finding of findings) {
    console.error(`check-agent-document-contract: FAIL ${finding.kind} ${finding.path ?? ""} ${finding.message}`);
  }
  if (findings.length > 0) {
    console.error(`check-agent-document-contract: ${findings.length} finding(s)`);
    process.exit(1);
  }
  console.log("check-agent-document-contract: contract intact");
}
