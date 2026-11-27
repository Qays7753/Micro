/**
 * M5.2 (UX P-12 «العودة بعد الانقطاع: الطلبات المتأخرة» + §7.2): يكمّل من
 * وضعه الحالي بدون ما يحس إنه عم يتحاسب — بطاقة لكل طلب متأخر بثلاثة
 * أزرار بنفس الوزن (تم التسليم / أُلغي / ما زال قائماً)، بلا شارة «متأخر»
 * وبلا ألوان تحذير، وبعد الإجابة تنطوي البطاقة بحالتها الجديدة.
 *
 * «لاحقاً» متاح دائمًا (بطاقة العودة تبقى في P-10 حتى الإكمال — G-11).
 * ما في طلبات متأخرة: الصفحة ما بتبين — التوجيه يقفز لـP-13 مباشرة
 * (وجملة r.absence_intro تنتقل لأولها).
 */
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/primitives";
import { OrderRow, paidOfText } from "@/components/manage/OrderRow";
import { t } from "@/application/manage/strings";
import { fill } from "@/application/manage/presentation";
import {
  fetchManageProject,
  fetchManageSaleRows,
  type ProjectStateResponse,
  type SaleRow,
} from "@/application/manage/api";

/** البطاقات المجاوَبة (تنطوي بحالتها الجديدة st.*). */
const answered = new Set<string>();

export default function ReturnOrdersPage() {
  const [, navigate] = useLocation();
  const [project, setProject] = useState<ProjectStateResponse | null>(null);
  const [rows, setRows] = useState<SaleRow[] | null>(null);

  const load = useCallback(async () => {
    const [projectState, saleRows] = await Promise.all([fetchManageProject(), fetchManageSaleRows()]);
    setProject(projectState);
    setRows(saleRows.sales);
  }, []);

  useEffect(() => {
    load().catch(() => {
      /* انقطاع/غياب مشروع: عودة للفتح الصادقة. */
      navigate("/");
    });
  }, [load, navigate]);

  if (rows === null || project === null) {
    return (
      <div className="micro-manage-page" aria-busy="true">
        <span className="micro-manage-page__loading" />
      </div>
    );
  }

  const overdue = rows.filter(row => row.status === "overdue" && !answered.has(row.id));

  /* ما في طلبات متأخرة: الصفحة ما بتبين — الجملة تنتقل لأول P-13. */
  if (overdue.length === 0) {
    navigate("/manage/return/balances");
    return (
      <div className="micro-manage-page" aria-busy="true">
        <span className="micro-manage-page__loading" />
      </div>
    );
  }

  return (
    <div className="micro-manage-page" dir="rtl">
      <h1 className="micro-manage-head__title">
        {fill("r.absence_intro", {
          days: String(project.openAbsence?.daysSinceLastRecord ?? 0),
        })}
      </h1>

      <section className="micro-manage-section">
        <h2 className="micro-manage-section__title">{t("s.overdue_orders")}</h2>
        <div className="micro-manage-rows">
          {overdue.map(row => (
            <div key={row.id} className="micro-manage-row micro-manage-row--card">
              <OrderRow
                saleId={row.id}
                customerName={row.customerName}
                firstLineDescription={row.firstLineDescription}
                status={row.status}
                paidText={paidOfText(row.paidFils, row.ofFils)}
                showStatus={false}
              />
              <div className="micro-manage-card__actions">
                <Button action="create" onClick={() => navigate(`/manage/op/deliver/${row.id}`)}>
                  {t("a.deliver")}
                </Button>
                <Button action="secondary" onClick={() => navigate(`/manage/op/cancel-sale/${row.id}`)}>
                  {t("r.cancelled")}
                </Button>
                <Button
                  action="quiet"
                  onClick={() => {
                    /* ما زال قائماً: ولا إشي — البطاقة تنطوي. */
                    answered.add(row.id);
                    setRows([...rows]);
                  }}
                >
                  {t("r.still_open")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="micro-manage-sheet__save">
        <Button action="secondary" onClick={() => navigate("/")}>
          {t("a.later")}
        </Button>
        <Button action="save" onClick={() => navigate("/manage/return/balances")}>
          {t("a.next")}
        </Button>
      </div>
    </div>
  );
}
