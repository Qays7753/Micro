import type { HTMLAttributes, ReactNode } from "react";
import clsx from "clsx";
import {
  activityStatePresentation,
  knowledgeStatePresentation,
  semanticStatePresentation,
  type KnowledgeStateKey,
  type MicroActivityStatus,
  type SemanticStateKey,
  type StatePresentation,
} from "@/presentation/stateAdapter";
import { StateMarker } from "./markers";

/*
 * W2 — StatusChip: عقد شريحة الحالة (component-states.md).
 * ---------------------------------------------------------------------------
 * العقد: الكلمة (ملك المنتج — تُمرَّر كـ prop ولا تُولَّد أبدًا) + علامة غير
 * لونية من المهايئ + نغمة دلالية. السطح أبيض (Surface) حتى تجتاز علامات
 * النجاح/الحالة حد 3:1 غير النصي (accessibility.md)؛ الكلمة دائمًا بحبر
 * آمن. حالات المعرفة والفراغات الصادقة محايدة بلا لون دلالي.
 * الحد الأدنى للخط 13px (أرضية اللصائق — typography.md).
 */

export type ChipState = SemanticStateKey | KnowledgeStateKey | MicroActivityStatus;

const ACTIVITY_KEYS: readonly MicroActivityStatus[] = ["active", "pending", "reversed", "cancelled"];
const KNOWLEDGE_KEYS: readonly KnowledgeStateKey[] = [
  "unconfirmed",
  "incomplete",
  "needs-review",
  "estimated",
  "unknown-magnitude",
];

export function chipPresentation(state: ChipState): StatePresentation {
  if (KNOWLEDGE_KEYS.includes(state as KnowledgeStateKey)) {
    return knowledgeStatePresentation(state as KnowledgeStateKey);
  }
  if (ACTIVITY_KEYS.includes(state as MicroActivityStatus)) {
    return activityStatePresentation(state as MicroActivityStatus);
  }
  return semanticStatePresentation(state as SemanticStateKey);
}

export interface StatusChipProps extends HTMLAttributes<HTMLSpanElement> {
  /** كلمة الحالة — ملك المنتج، تُمرَّر كأبناء (لا تُولَّد ولا يُعاد تسميتها). */
  children: ReactNode;
  /** مفتاح الحالة الدلالي من مهايئ الحالات. */
  state: ChipState;
}

export function StatusChip({ state, className, children, ...rest }: StatusChipProps) {
  const presentation = chipPresentation(state);
  return (
    <span
      className={clsx("micro-prim-chip", className)}
      data-tone={presentation.tone}
      data-family={presentation.family}
      {...rest}
    >
      <StateMarker role={presentation.markerRole} />
      <span className="micro-prim-chip__word">{children}</span>
    </span>
  );
}
