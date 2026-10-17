import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  CONTRACTS,
  REQUIRED_FILES,
  ROOT,
  checkAgentDocumentContract,
} from "./check-agent-document-contract.mjs";

const temporaryRoots = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function fixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "micro-agent-doc-contract-"));
  temporaryRoots.push(root);
  const contractText = Object.values(CONTRACTS)
    .flatMap((contract) => [...(contract.markers ?? []), ...(contract.links ?? [])])
    .join(" ");
  for (const relativePath of REQUIRED_FILES) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, `${contractText}\n`, "utf8");
  }
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ scripts: { guards: "node scripts/check-agent-document-contract.mjs" } }), "utf8");
  return root;
}

describe("agent documentation contract guard", () => {
  it("passes for the real repository after the contract is reconciled", () => {
    expect(checkAgentDocumentContract({ repoRoot: ROOT })).toEqual([]);
  });

  it("rejects a competing root AGENT.md", () => {
    const root = fixtureRoot();
    fs.writeFileSync(path.join(root, "AGENT.md"), "wrong entry point\n", "utf8");
    const findings = checkAgentDocumentContract({ repoRoot: root });
    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "competing-entry-point", path: "AGENT.md" }),
    ]));
  });

  it("rejects a missing authority marker", () => {
    const root = fixtureRoot();
    const agentsPath = path.join(root, "AGENTS.md");
    fs.writeFileSync(agentsPath, fs.readFileSync(agentsPath, "utf8").replace("جدول التوجيه الوحيد", "جدول قراءة موازٍ"), "utf8");
    const findings = checkAgentDocumentContract({ repoRoot: root });
    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "missing-marker", path: "AGENTS.md" }),
    ]));
  });

  it("rejects a missing required file and an unregistered guard", () => {
    const root = fixtureRoot();
    fs.rmSync(path.join(root, "docs/operations/agent-handoff-protocol-v1.md"));
    fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ scripts: { guards: "node scripts/check-secrets.mjs" } }), "utf8");
    const findings = checkAgentDocumentContract({ repoRoot: root });
    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "missing-file", path: "docs/operations/agent-handoff-protocol-v1.md" }),
      expect.objectContaining({ kind: "unregistered-guard", path: "package.json" }),
    ]));
  });
});
