/* المجموعة ٦ (البند ٣ — S2-09): «أثر التصحيحات» — سطر هادئ واحد حيثما غيّر
 * تصحيح أو تراجع رقمًا معروضًا. يقول بوضوح: الأصل محفوظ كما هو؛ التصحيح سِجِل
 * جديد؛ الرقم الظاهر صافي أثرهما معًا؛ وفتح الأصل والتصحيح نقرة واحدة.
 * لا لون تحذير — التصحيح الموثق دفتر سليم لا إنذار — ولا إخفاء لتغير مالي. */
import type { ReactNode } from "react";
import { MoneyValue } from "@/components/presentation/DisplayValue";

const countPhrase = (count: number): string => {
  if (count === 1) return "تصحيح موثق واحد";
  if (count === 2) return "تصحيحان موثقان";
  return `${count} تصحيحات موثقة`;
};

export function RestatementNote({
  count,
  netAmountMinor,
  scopeLabel,
  onOpen,
  children,
}: {
  count: number;
  /** null حين لا يمكن التعبير عن الأثر برقم واحد صادق. */
  netAmountMinor?: number | null;
  scopeLabel?: string | null;
  onOpen: () => void;
  children?: ReactNode;
}) {
  if (count <= 0) return null;
  return (
    <p className="micro-restatement-note">
      {scopeLabel ? <span>{scopeLabel} فيها </span> : null}
      <strong>{countPhrase(count)}</strong>
      <span> يؤثر في الرقم الظاهر.</span>
      {netAmountMinor !== undefined && netAmountMinor !== null ? (
        <span>
          {" "}
          صافي الأثر <MoneyValue minor={netAmountMinor} showPlus /> د.أ.
        </span>
      ) : null}
      <span> الأصل محفوظ كما هو؛ التصحيح سِجِل جديد، والرقم الظاهر صافي أثرِهما معًا.</span>{" "}
      <button className="micro-text-action" type="button" onClick={onOpen}>
        افتح الأصل والتصحيح
      </button>
      {children}
    </p>
  );
}
