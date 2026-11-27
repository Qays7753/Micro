/**
 * M5.2 (UX P-13 «العودة: المستحقات والالتزامات المفتوحة» + §7.2 + استثناء
 * R-26): تحديث كل خط مفتوح بكبسة — «حُصِّل أو سُدِّد» بكامل المتبقي فورًا
 * (صندوق واحد) أو عبر P-14 (صندوقان)، و«ما زال قائماً» ولا إشي. تاريخ
 * التسوية = اليوم (استثناء R-26 الموثق في UX P-13).
 *
 * فاضية: الصفحة ما بتبين — بيروح مباشرة لـP-50 (سياق return_after_absence).
 */
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button, Notice } from "@/components/primitives";
import { t } from "@/application/manage/strings";
import { ageTextR19, fill, manageErrorText } from "@/application/manage/presentation";
import {
  collectPayment,
  fetchManageFigures,
  fetchManageProject,
  payDebt,
  type ManageFiguresResponse,
  type ProjectStateResponse,
} from "@/application/manage/api";
import { todayInAmman } from "@/application/time";

const settled = new Set<string>();

export default function ReturnBalancesPage() {
  const [, navigate] = useLocation();
  const [project, setProject] = useState<ProjectStateResponse | null>(null);
  const [figures, setFigures] = useState<ManageFiguresResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [projectState, figuresResponse] = await Promise.all([fetchManageProject(), fetchManageFigures()]);
    setProject(projectState);
    setFigures(figuresResponse);
  }, []);

  useEffect(() => {
    load().catch(() => navigate("/"));
  }, [load, navigate]);

  if (figures === null || project === null) {
    return (
      <div className="micro-manage-page" aria-busy="true">
        <span className="micro-manage-page__loading" />
      </div>
    );
  }

  const activeBoxes = figures.boxes.filter(box => box.status === "active");
  const twoBoxes = activeBoxes.length > 1;
  const today = todayInAmman();

  const toMe = figures.balanceLines.filter(
    line => line.direction === "to_me" && line.outstandingFils > 0 && !settled.has(line.id),
  );
  const byMe = figures.balanceLines.filter(
    line => line.direction === "by_me" && line.outstandingFils > 0 && !settled.has(line.id),
  );

  /* فاضية: ما بتبين — بيروح مباشرة لـP-50 (سياق العودة). */
  if (toMe.length === 0 && byMe.length === 0) {
    navigate("/manage/reconcile?context=return_after_absence");
    return (
      <div className="micro-manage-page" aria-busy="true">
        <span className="micro-manage-page__loading" />
      </div>
    );
  }

  async function settle(line: (typeof toMe)[number]) {
    setError(null);
    try {
      const input = {
        requestId: globalThis.crypto?.randomUUID() ?? `settle-${Math.random()}`,
        amountFils: line.outstandingFils,
        box: "cash" as const,
        balanceLineId: line.id,
        effectiveOn: today,
      };
      if (line.direction === "to_me") {
        await collectPayment(input);
      } else {
        await payDebt(input);
      }
      settled.add(line.id);
      await load();
    } catch (cause) {
      setError(manageErrorText(cause));
    }
  }

  return (
    <div className="micro-manage-page" dir="rtl">
      <h1 className="micro-manage-head__title">
        {fill("r.absence_intro", {
          days: String(project.openAbsence?.daysSinceLastRecord ?? 0),
        })}
      </h1>

      {toMe.length > 0 ? (
        <section className="micro-manage-section">
          <h2 className="micro-manage-section__title">{t("t.to_me")}</h2>
          <div className="micro-manage-rows">
            {toMe.map(line => (
              <div key={line.id} className="micro-manage-row micro-manage-row--card">
                <div className="micro-manage-row__main">
                  <span className="micro-manage-row__title">{line.counterpartyName ?? t("l.no_name")}</span>
                  <span className="micro-manage-row__amount">{line.text}</span>
                </div>
                <span className="micro-manage-row__meta">{ageTextR19(line.originOn, today)}</span>
                <div className="micro-manage-card__actions">
                  {twoBoxes ? (
                    <Button
                      action="create"
                      onClick={() => navigate(`/manage/return/confirm?line=${line.id}`)}
                    >
                      {t("r.settled")}
                    </Button>
                  ) : (
                    <Button action="create" onClick={() => void settle(line)}>
                      {t("r.settled")}
                    </Button>
                  )}
                  <Button action="quiet" onClick={() => settled.add(line.id) || setFigures({ ...figures })}>
                    {t("r.still_open")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {byMe.length > 0 ? (
        <section className="micro-manage-section">
          <h2 className="micro-manage-section__title">{t("t.by_me")}</h2>
          <div className="micro-manage-rows">
            {byMe.map(line => (
              <div key={line.id} className="micro-manage-row micro-manage-row--card">
                <div className="micro-manage-row__main">
                  <span className="micro-manage-row__title">{line.counterpartyName ?? t("l.no_name")}</span>
                  <span className="micro-manage-row__amount">{line.text}</span>
                </div>
                <span className="micro-manage-row__meta">{ageTextR19(line.originOn, today)}</span>
                <div className="micro-manage-card__actions">
                  {twoBoxes ? (
                    <Button
                      action="create"
                      onClick={() => navigate(`/manage/return/confirm?line=${line.id}`)}
                    >
                      {t("r.settled")}
                    </Button>
                  ) : (
                    <Button action="create" onClick={() => void settle(line)}>
                      {t("r.settled")}
                    </Button>
                  )}
                  <Button action="quiet" onClick={() => settled.add(line.id) || setFigures({ ...figures })}>
                    {t("r.still_open")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {error !== null ? (
        <Notice tone="error" role="alert">
          {error}
        </Notice>
      ) : null}

      <div className="micro-manage-sheet__save">
        <Button action="secondary" onClick={() => navigate("/")}>
          {t("a.later")}
        </Button>
        <Button action="save" onClick={() => navigate("/manage/reconcile?context=return_after_absence")}>
          {t("a.next")}
        </Button>
      </div>
    </div>
  );
}
