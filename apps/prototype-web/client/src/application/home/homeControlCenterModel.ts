export type HomeValueState = "known" | "incomplete" | "not_initialized";
export type HomeAction = { id: string; label: string; href: string; reason: string };
export type HomeFinancialFact = {
  id: "cash" | "receivables" | "payables" | "owner_capital";
  label: string;
  state: HomeValueState;
  valueMinor: number | null;
  currency: "JOD";
  source: string;
  period: string;
  helper: string;
};
export type HomeAttentionItem = {
  id: string;
  priority: number;
  kind: "draft" | "order" | "collection" | "debt" | "follow_up" | "capacity" | "cost" | "result_review";
  title: string;
  reason: string;
  action: HomeAction;
};
export type HomeOptionalModule = {
  id: "inventory" | "schedule" | "supplier_commitments" | "period_result";
  label: string;
  state: "available" | "needs_setup" | "empty";
  action: HomeAction | null;
};
export type HomeRecentChange = {
  id: string;
  occurredOn: string;
  title: string;
  detail: string;
  href: string;
};
export type HomeControlCenterInput = {
  activityName: string;
  todayLocal: string;
  truthLine: string;
  primaryAction: HomeAction;
  facts: readonly HomeFinancialFact[];
  attention: readonly HomeAttentionItem[];
  optionalModules: readonly HomeOptionalModule[];
  recentChanges: readonly HomeRecentChange[];
};
export type HomeControlCenterViewModel = {
  heading: { activityName: string; todayLocal: string };
  truthLine: string;
  primaryAction: HomeAction;
  facts: readonly HomeFinancialFact[];
  attention: readonly HomeAttentionItem[];
  optionalModules: readonly HomeOptionalModule[];
  recentChanges: readonly HomeRecentChange[];
};

const compareAttention = (left: HomeAttentionItem, right: HomeAttentionItem) =>
  left.priority - right.priority || left.id.localeCompare(right.id, "ar");

export function buildHomeControlCenterViewModel(input: HomeControlCenterInput): HomeControlCenterViewModel {
  const seenAttention = new Set<string>();
  const attention = [...input.attention]
    .filter(item => {
      if (seenAttention.has(item.id)) return false;
      seenAttention.add(item.id);
      return true;
    })
    .sort(compareAttention)
    .slice(0, 3);
  const facts = input.facts.map(fact =>
    fact.state === "known" && fact.valueMinor !== null ? fact : { ...fact, valueMinor: null },
  );
  const optionalModules = input.optionalModules.filter(module => module.state !== "empty");
  const recentChanges = input.recentChanges.slice(0, 5);
  return {
    heading: { activityName: input.activityName, todayLocal: input.todayLocal },
    truthLine: input.truthLine,
    primaryAction: input.primaryAction,
    facts,
    attention,
    optionalModules,
    recentChanges,
  };
}
