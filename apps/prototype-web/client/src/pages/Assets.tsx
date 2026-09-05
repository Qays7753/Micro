/**
 * المجموعة ٤ (عقد ٢٩): سطح الأصول — قائمة قراءة من «مالي». الدفتري مشتق من
 * الأحداث، والمجهول (عمر/بداية) يظهر مجهولًا لا صفرًا. الإضافة محرر عميق،
 * والتفصيل مسار عميق لكل أصل؛ هذا السطح يبقي شريط التنقل (قارئ).
 */
import { assetUnknownLifeCountLabel } from "@/presentation/g5Plurals";
import { Boxes, Plus, TrendingDown } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { withFrom } from "@/app/navigationContract";
import { useReturnPath } from "@/app/useReturnNavigation";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { MoneyValue } from "@/components/presentation/DisplayValue";
import { formatLocalDate } from "@/presentation/formatters";
import type { AssetSummaryRow } from "@/application/assets/assetService";

type State =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; rows: readonly AssetSummaryRow[] };

export default function Assets() {
  const [, navigate] = useLocation();
  const returnPath = useReturnPath();
  const { assets, dataVersion } = usePrototypeServices();
  const [state, setState] = useState<State>({ phase: "loading" });

  const load = useCallback(() => {
    assets.overview().then(result => {
      if (!result.ok) {
        setState({ phase: "error", message: result.message });
        return;
      }
      setState({ phase: "ready", rows: result.value });
    });
  }, [assets]);

  useEffect(load, [load, dataVersion]);

  return (
    <section className="micro-page micro-assets-page">
      <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>
        مالي
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">أصول المشروع</span>
        <h1>الأصول</h1>
        <p>ما تشتريه للاستخدام الطويل — يظهر بقيمته الدفترية، لا كربح ولا مصروف يوم الشراء.</p>
      </div>
      {state.phase === "loading" ? (
        <p className="micro-route-loading" role="status">
          جارٍ قراءة الأصول…
        </p>
      ) : state.phase === "error" ? (
        <p className="micro-field-error" role="alert">
          {state.message}
        </p>
      ) : state.rows.length === 0 ? (
        <section className="micro-empty-state" aria-label="لا أصول بعد">
          <Boxes aria-hidden="true" />
          <p>لا أصول مسجلة بعد. سجّل أول أصل: آلة، جهاز، أو أي شيء يخدمك أكثر من سنة.</p>
        </section>
      ) : (
        <>
          <AssetsSummary rows={state.rows} />
          <ul className="micro-cards-list" aria-label="قائمة الأصول">
            {state.rows.map(row => (
              <AssetCard
                key={row.asset.id}
                row={row}
                onOpen={() => navigate(withFrom(`/assets/${row.asset.id}`, "/assets"))}
              />
            ))}
          </ul>
        </>
      )}
      <div className="micro-form-actions">
        <button
          className="micro-button micro-button-primary"
          type="button"
          onClick={() => navigate(withFrom("/assets/new", "/assets"))}
        >
          <Plus aria-hidden="true" /> سجّل أصلًا
        </button>
      </div>
    </section>
  );
}

function AssetsSummary({ rows }: { rows: readonly AssetSummaryRow[] }) {
  const totalBookValue = rows.reduce((sum, row) => sum + row.bookValueMinor, 0);
  const unknownCount = rows.filter(
    row => row.asset.status === "active" && (row.hasUnknownLife || row.hasUnknownStart),
  ).length;
  const unrecorded = rows.reduce((sum, row) => sum + row.unrecordedDepreciationMinor, 0);
  return (
    <section className="micro-decision-card" aria-label="خلاصة الأصول">
      <div>
        <span>الدفتري الكلي</span>
        <strong>
          <MoneyValue minor={totalBookValue} /> د.أ
        </strong>
        {unrecorded > 0 ? (
          <p>
            إهلاك مستحق لم يُسجّل بعد: <MoneyValue minor={unrecorded} /> د.أ — لا يخصم من الربح إلا بتسجيل
            صريح من تفصيل الأصل.
          </p>
        ) : null}
        {unknownCount > 0 ? (
          <p>{assetUnknownLifeCountLabel(unknownCount)} — يبقى بلا إهلاك حتى تُحدده بمراجعة موثقة.</p>
        ) : null}
      </div>
    </section>
  );
}

function AssetCard({ row, onOpen }: { row: AssetSummaryRow; onOpen: () => void }) {
  const asset = row.asset;
  return (
    <li>
      <article className="micro-asset-card" data-status={asset.status}>
        <button className="micro-text-action" type="button" onClick={onOpen}>
          <strong>{asset.name}</strong>
        </button>
        <p>
          {asset.categoryLabel ? `${asset.categoryLabel} · ` : ""}
          اقتناء <MoneyValue minor={asset.acquisitionAmountMinor} /> د.أ{" "}
          {asset.acquisitionKind === "cash" ? "نقدًا" : "بالذمم"} · {formatLocalDate(asset.purchaseDate)}
        </p>
        <p>
          {asset.status === "active" ? (
            row.hasUnknownLife || row.hasUnknownStart ? (
              <>
                دفتري <MoneyValue minor={row.bookValueMinor} /> د.أ · الإهلاك{" "}
                {row.hasUnknownLife ? "عمره مجهول" : "بدايته غير محددة"}
              </>
            ) : (
              <>
                دفتري <MoneyValue minor={row.bookValueMinor} /> د.أ · إهلاك شهري{" "}
                <MoneyValue minor={row.monthlyMinor ?? 0} /> د.أ
              </>
            )
          ) : (
            <>حالة: {row.statusLabel} — أرشيف بتاريخ موثق</>
          )}
        </p>
        {row.accumulatedDepreciationMinor > 0 ? (
          <p className="micro-asset-depreciation">
            <TrendingDown aria-hidden="true" /> إهلاك مسجّل:{" "}
            <MoneyValue minor={row.accumulatedDepreciationMinor} /> د.أ
          </p>
        ) : null}
      </article>
    </li>
  );
}
