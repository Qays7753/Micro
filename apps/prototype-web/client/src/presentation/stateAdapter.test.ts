import { describe, expect, it } from "vitest";
import {
  NUMERIC_SLOT_CONTRACT as NUMERIC,
  activityStatePresentation,
  honestVoidDisplayValue,
  honestVoidPresentation,
  isPermissibleTone,
  knowledgeStatePresentation,
  semanticStatePresentation,
  type StatePresentation,
} from "./stateAdapter";
import { activityStatusLabel } from "./activityLabels";
import type { ActivityStatus } from "@/application/activity/activityService";
import type { MicroActivityStatus } from "./stateAdapter";

/* فحص المطابقة النوعية: الاتحاد المحلي يجب أن يطابق ActivityStatus تمامًا
 * (يمنع انحراف المهايئ عن المصدر دون سحب الخدمة إلى عدّاد كثافة النص). */
type _ActivityStatusSync = MicroActivityStatus extends ActivityStatus
  ? ActivityStatus extends MicroActivityStatus
    ? true
    : never
  : never;
const activityStatusSync: _ActivityStatusSync = true;

/*
 * W1 — اختبارات مهايئ الحالات: صون كلمات Micro، صدق الحالات، وعقود العرض.
 * المهايئ لا ينتج كلمات — لذلك نثبّت القاموس القائم كما هو (أي إعادة تسمية
 * عرضية تفشل هنا) ونتحقق من قواعد المعيار: الانتظار ليس نجاحًا، المجهول
 * ليس فشلًا، حالات المعرفة محايدة، والفراغات الثلاثة مميزة.
 */

const ALL_SEMANTIC = [
  "success",
  "error",
  "unknown",
  "due",
  "overdue",
  "partial",
  "draft",
  "reviewed",
  "unrecorded",
  "unavailable",
  "measured-zero",
  "no-data",
  "no-results",
] as const;

const ALL_KNOWLEDGE = [
  "unconfirmed",
  "incomplete",
  "needs-review",
  "estimated",
  "unknown-magnitude",
] as const;

describe("W1 State Adapter: state-word preservation (no renames)", () => {
  it("the local activity union stays in lockstep with the source ActivityStatus type", () => {
    expect(activityStatusSync).toBe(true);
  });

  it("keeps Micro's existing activity status words exactly as they are", () => {
    expect(activityStatusLabel.active).toBe("ساري");
    expect(activityStatusLabel.pending).toBe("بانتظار قرار");
    expect(activityStatusLabel.reversed).toBe("متراجع موثقًا");
    expect(activityStatusLabel.cancelled).toBe("ملغى");
  });

  it("returns presentations only — never a word (the adapter owns markers/tone, not vocabulary)", () => {
    const p = activityStatePresentation("pending");
    expect(Object.keys(p).sort()).toEqual(["family", "isKnowledge", "markerRole", "tone"]);
  });
});

describe("W1 State Adapter: pending is never success; unknown is never failure", () => {
  it("pending maps to an info-tone clock marker — not a success tone", () => {
    const p = activityStatePresentation("pending");
    expect(p.markerRole).toBe("clock");
    expect(p.tone).not.toBe("success");
    expect(p.tone).toBe("info");
  });

  it("semantic pending carries no success tone anywhere in the outcome table", () => {
    const pendingLike: StatePresentation[] = [
      semanticStatePresentation("due"),
      semanticStatePresentation("unknown"),
    ];
    for (const p of pendingLike) {
      expect(p.tone).not.toBe("success");
    }
  });

  it("unknown result is its own state — neither success nor error", () => {
    const p = semanticStatePresentation("unknown");
    expect(p.markerRole).toBe("question");
    expect(p.tone).toBe("neutral");
    expect(p.family).toBe("outcome");
  });

  it("overdue is the only due-family state that may use the error tone", () => {
    expect(semanticStatePresentation("due").tone).toBe("neutral");
    expect(semanticStatePresentation("overdue").tone).toBe("error");
  });
});

describe("W1 State Adapter: knowledge states stay neutral (knowledge-state contract)", () => {
  it("every knowledge state uses a neutral tone and a non-color marker", () => {
    for (const key of ALL_KNOWLEDGE) {
      const p = knowledgeStatePresentation(key);
      expect(p.isKnowledge, key).toBe(true);
      expect(p.tone, `${key} must be neutral`).toBe("neutral");
      expect(p.markerRole, key).not.toBe("none");
    }
  });

  it("knowledge states are distinct from outcome states (orthogonal contract)", () => {
    const estimated = knowledgeStatePresentation("estimated");
    const success = semanticStatePresentation("success");
    expect(estimated.family).toBe("knowledge");
    expect(success.family).toBe("outcome");
    expect(estimated.tone).not.toBe(success.tone);
  });

  it("estimated carries the tilde approximate marker", () => {
    expect(knowledgeStatePresentation("estimated").markerRole).toBe("tilde");
  });
});

describe("W1 State Adapter: honest voids stay distinct", () => {
  it("unrecorded, unavailable, and measured zero are three different presentations", () => {
    const unrecorded = honestVoidPresentation("unrecorded");
    const unavailable = honestVoidPresentation("unavailable");
    const zero = honestVoidPresentation("measured-zero");
    expect(unrecorded.markerRole).toBe("dot");
    expect(unavailable.markerRole).toBe("none");
    expect(zero.markerRole).toBe("none");
    expect(new Set([unrecorded, unavailable, zero]).size).toBe(3);
  });

  it("only a measured zero may display a numeric value; voids never invent numbers", () => {
    expect(honestVoidDisplayValue("measured-zero")).toBe("0");
    expect(honestVoidDisplayValue("unrecorded")).toBeNull();
    expect(honestVoidDisplayValue("unavailable")).toBeNull();
  });

  it("no void ever renders as success, failure, or decoration", () => {
    for (const kind of ["unrecorded", "unavailable", "measured-zero"] as const) {
      const p = honestVoidPresentation(kind);
      expect(p.tone, kind).toBe("neutral");
      expect(p.family, kind).toBe("void");
    }
  });
});

describe("W1 State Adapter: presentation rules are internally consistent", () => {
  it("every defined presentation passes the permissible-tone contract", () => {
    const all: StatePresentation[] = [
      ...ALL_SEMANTIC.map(semanticStatePresentation),
      ...ALL_KNOWLEDGE.map(knowledgeStatePresentation),
      ...(["active", "pending", "reversed", "cancelled"] as const).map(activityStatePresentation),
    ];
    for (const p of all) {
      expect(isPermissibleTone(p), JSON.stringify(p)).toBe(true);
    }
  });

  it("success and error markers are check and alert respectively (word + marker + tone)", () => {
    expect(semanticStatePresentation("success").markerRole).toBe("check");
    expect(semanticStatePresentation("error").markerRole).toBe("alert");
  });

  it("numeric slot contract keeps mono font, LTR direction, bidi isolation, and the 15px financial floor", () => {
    expect(NUMERIC.font).toBe("var(--font-numeric)");
    expect(NUMERIC.direction).toBe("ltr");
    expect(NUMERIC.unicodeBidi).toBe("isolate");
    expect(NUMERIC.amountFloorPx).toBe(15);
  });
});
