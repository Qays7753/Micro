/** R7 / R6-F17-P05 (2026-10-10): عقد اشتقاقات السجلات النشطة لاستحقاق
 * المالك — نفس تصفية الصفحة حرفيًا فوق القراءة الموحدة. */
import { describe, expect, it } from "vitest";
import { deriveActiveOwnerRecords } from "./ownerEntitlementViewModel";
import type { OwnerEntitlementOverview } from "./ownerEntitlementService";

const overview = (entitlements: object[], openings: object[], movements: object[]) =>
  ({
    entitlements,
    openingBalances: openings,
    movements,
    walletBalances: [],
    activePolicies: [],
    policies: [],
  }) as unknown as OwnerEntitlementOverview;

describe("R7/P05 — اشتقاقات السجلات النشطة", () => {
  it("السجل المعكوس والسجل الذي له عكس مقابل كلاهما خارج الجلسة", () => {
    const o = overview(
      [
        { id: "e1", reversalOfId: null },
        { id: "e2", reversalOfId: "e1" },
        { id: "e3", reversalOfId: null },
      ],
      [
        { id: "b1", reversalOfId: null },
        { id: "b2", reversalOfId: "b1" },
      ],
      [],
    );
    const d = deriveActiveOwnerRecords(o);
    expect(d.activeEntitlements.map(record => record.id)).toEqual(["e3"]);
    expect(d.activeOpeningBalances.map(balance => balance.id)).toEqual([]);
  });

  it("السحوبات السابقة: سحب قائم غير معكوس وليس تسوية استحقاق/رصيد", () => {
    const o = overview(
      [],
      [],
      [
        { id: "m1", kind: "draw", reversalOfId: null, reason: "personal" },
        { id: "m2", kind: "draw", reversalOfId: null, reason: "entitlement_settlement" },
        { id: "m3", kind: "draw", reversalOfId: null, reason: "opening_balance_settlement" },
        { id: "m5", kind: "return", reversalOfId: null, reason: "personal" },
      ],
    );
    const d = deriveActiveOwnerRecords(o);
    expect(d.priorDraws.map(movement => movement.id)).toEqual(["m1"]);
  });

  it("السحب الذي له عكس مقابل (سحب تراجع) يخرج من السحوبات السابقة", () => {
    const o = overview(
      [],
      [],
      [
        { id: "m1", kind: "draw", reversalOfId: null, reason: "personal" },
        { id: "m4", kind: "draw", reversalOfId: "m1", reason: "personal" },
      ],
    );
    const d = deriveActiveOwnerRecords(o);
    expect(d.priorDraws).toEqual([]);
    expect(d.reversedMovementIds.has("m1")).toBe(true);
  });
});
