import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { generate, ROOT } from "./generate-test-map.mjs";

/** دبوس انجراف خريطة G2 (STR-619): الأدلة الملتزمة تطابق الشجرة الحية دائمًا. */
describe("generate-test-map (Wave G2 — STR-619 drift pin)", () => {
  it("every page has control evidence or is explicitly listed as uncovered", () => {
    const data = generate();
    expect(data.pages.withoutDirectEvidence).toEqual([]);
    expect(Object.values(data.pages.map).every((v) => v.evidence.length > 0)).toBe(true);
  });

  it("contract coverage is complete: literal citations, curated concept links, or the documented-reason set", () => {
    const data = generate();
    const DOCUMENTED_REASON = new Set([
      "04-limited-sync-contract.md",
      "18-network-identity-workspace-access-contract.md",
      "19-services-notification-manage-boundary-contract.md",
      "20-market-need-response-listing-moderation-contract.md",
      "21-delivery-request-quote-status-privacy-contract.md",
      "22-network-moderation-consent-audit-contract.md",
      "23-network-data-lifecycle-recovery-contract.md",
      "24-network-data-classification-field-dictionary-contract.md",
      "25-network-money-representation-contract.md",
    ]);
    for (const [contract, entry] of Object.entries(data.contracts.map)) {
      const hasEvidence = entry.citations.length > 0 || (entry.curated ?? []).length > 0;
      expect(hasEvidence || DOCUMENTED_REASON.has(contract)).toBe(true);
    }
    expect(data.contracts.total).toBe(49);
  });

  it("committed evidence JSON matches the live tree (no silent drift)", () => {
    const committed = JSON.parse(
      fs.readFileSync(`${ROOT}/docs/architecture/refactoring/generated/test-map.json`, "utf8"),
    );
    const live = generate();
    delete committed.head;
    delete live.head;
    expect(live).toEqual(committed);
  });
});
