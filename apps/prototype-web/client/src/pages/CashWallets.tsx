/** Style: Micro «مسار القرار» — cash places are explicit local facts, never a hidden pooled balance. */
import {
  ArrowLeft,
  ArrowRightLeft,
  Calculator,
  HandCoins,
  Landmark,
  NotebookPen,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  WalletCards,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useReturnPath } from "@/app/useReturnNavigation";
import { withFrom } from "@/app/navigationContract";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import type { CashContinuityEntry } from "@micro-domain/cash-continuity/index.js";
import type { CashContinuityOverview } from "@/application/cash/cashContinuityService";
import type { ProjectFinancialPosition } from "@/application/finance/projectFinancialService";
import { LocalDateValue, MoneyValue } from "@/components/presentation/DisplayValue";
import { cashWalletCountLabel, savedImpactCountLabel } from "@/presentation/plurals";
type State =
  | { phase: "loading" }
  | { phase: "error" }
  | {
      phase: "ready";
      overview: CashContinuityOverview;
      entries: readonly CashContinuityEntry[];
      position: ProjectFinancialPosition;
    };
const label = (type: CashContinuityEntry["type"]) =>
  ({
    opening_balance: "رصيد بداية",
    cash_adjustment: "ضبط كاش",
    transfer_out: "تحويل صادر",
    transfer_in: "تحويل وارد",
    reversal: "تراجع عن أثر",
    allocation: "تخصيص من غير الموزع",
  })[type];

export default function CashWallets() {
  const [, navigate] = useLocation();
  /* S1-10: الرجوع للمصدر (?from) مع بديل قانوني ثابت (عقد ٢٦ §٢.٢). */
  const returnPath = useReturnPath();
  const { cashContinuity, projectFinance, dataVersion } = usePrototypeServices();
  const [state, setState] = useState<State>({ phase: "loading" });
  useEffect(() => {
    let active = true;
    Promise.all([cashContinuity.overview(), cashContinuity.entries(), projectFinance.readPosition()]).then(
      ([overview, entries, position]) => {
        if (!active) return;
        if (!overview.ok || !entries.ok || !position.ok) {
          setState({ phase: "error" });
          return;
        }
        setState({
          phase: "ready",
          overview: overview.value,
          entries: entries.value,
          position: position.value,
        });
      },
    );
    return () => {
      active = false;
    };
  }, [cashContinuity, projectFinance, dataVersion]);
  if (state.phase === "loading")
    return (
      <div className="micro-route-loading" role="status">
        جارٍ قراءة محافظ الكاش المحلية…
      </div>
    );
  if (state.phase === "error")
    return (
      <section className="micro-page micro-not-found">
        <h1>تعذر قراءة محافظ الكاش</h1>
        <p>لم يتغير أي سجل. أعد فتح التطبيق للمحاولة.</p>
        <button
          className="micro-button micro-button-primary"
          type="button"
          onClick={() => navigate(withFrom("/finance", "/cash"))}
        >
          الوضع المالي
        </button>
      </section>
    );
  return (
    <section className="micro-page micro-finance-page">
      <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>
        <ArrowLeft aria-hidden="true" /> {returnPath === "/finance" ? "الوضع المالي" : "رجوع"}
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">استمرارية السجل</span>
        <h1>محافظ الكاش</h1>
        <p>
          ابدأ من الأماكن التي تعرف أن الكاش موجود فيها، ثم انقل أو اضبط أثرًا بسبب. لا يحول Micro أي افتتاح
          إلى ربح أو دخل.
        </p>
      </div>
      <section className="micro-decision-card">
        <WalletCards aria-hidden="true" />
        <div>
          <span>كاش المحافظ المعلن (د.أ)</span>
          <strong>
            <MoneyValue minor={state.overview.totalWalletCashMinor} />
          </strong>
          <p>{state.overview.truth}</p>
        </div>
      </section>
      {/* المجموعة ٢ (§7.1/Scope G): الأمانات كاش حقيقي في الدرج لا ملك ولا ربح —
          تظهر بمبلغها الدقيق مع سطر الثقة لا بمجاز غامض. */}
      {state.position.amanahHeldMinor > 0 ? (
        <section className="micro-decision-card" data-amanah="true" aria-label="الأمانات بحوزتك">
          <HandCoins aria-hidden="true" />
          <div>
            <span>أمانات بأمانتك</span>
            <strong>
              <MoneyValue minor={state.position.amanahHeldMinor} /> د.أ
            </strong>
            <p>هذا كاش موجود في الدرج، لكنه مش ربحك ولا مالك — قُبض وسُلّم من «تسجيل حركة» في مالي.</p>
          </div>
        </section>
      ) : null}
      <section className="micro-cash-facts">
        <div>
          <span>الكاش غير الموزع (د.أ)</span>
          <strong>
            <MoneyValue minor={state.position.unallocatedCashMinor} />
          </strong>
          {/* S2-04 (ب): الرصيد السالب يُفسَّر بسببه لا برقم مجرد — تراجع تحصيل/تصحيح بيع
              مع تخصيص قائم يترك تخصيصًا زائدًا؛ التراجع الموثق للتخصيص من السجل أسفله. */}
          {state.position.unallocatedCashMinor < 0 ? (
            <small className="micro-field-error" role="alert">
              تخصيص زائد — راجع تراجع التحصيل أو تصحيح البيع ثم تراجع التخصيص الموثق من السجل.
            </small>
          ) : (
            <small>طلب أو حدث أو شراء مواد لم يربطه النظام بمحفظة بعد.</small>
          )}
        </div>
        <div>
          <span>الكاش المسجل الكلي (د.أ)</span>
          <strong>
            <MoneyValue minor={state.position.recordedCashMinor} />
          </strong>
          <small>المحافظ المعلنة + الكاش غير الموزع.</small>
        </div>
      </section>
      {/* مبدأ Micro: لا يظهر الفعل المشروط كزر معطل؛ يظهر شرط إنجازه قريبًا. */}
      <div className="micro-cash-actions">
        <button
          className="micro-button micro-button-primary"
          type="button"
          onClick={() => navigate(withFrom("/cash/wallet/new", "/cash"))}
        >
          <Plus aria-hidden="true" /> محفظة ورصيد بداية
        </button>
        {state.overview.wallets.length > 0 ? (
          <button
            className="micro-button micro-button-secondary"
            type="button"
            onClick={() => navigate(withFrom("/cash/count", "/cash"))}
          >
            <Calculator aria-hidden="true" /> عدّ الصندوق
          </button>
        ) : (
          <div className="micro-later-action" role="status">
            <strong>عدّ الصندوق — لاحقًا</strong>
            <small>سجّل محفظة الدرج أولًا حتى تتمكن من مقارنة المعدود بالمسجل.</small>
          </div>
        )}
        {state.position.unallocatedCashMinor !== 0 ? (
          <button
            className="micro-button micro-button-secondary"
            type="button"
            onClick={() => navigate(withFrom("/cash/distribute", "/cash"))}
          >
            <SlidersHorizontal aria-hidden="true" /> وزّع غير الموزع
          </button>
        ) : null}
        {state.overview.wallets.length >= 2 ? (
          <button
            className="micro-button micro-button-secondary"
            type="button"
            onClick={() => navigate(withFrom("/cash/transfer", "/cash"))}
          >
            <ArrowRightLeft aria-hidden="true" /> تحويل بين المحافظ
          </button>
        ) : (
          <div className="micro-later-action" role="status">
            <strong>تحويل بين المحافظ — لاحقًا</strong>
            <small>أضف محفظة ثانية أولًا حتى يظهر التحويل.</small>
          </div>
        )}
      </div>
      {/* D-004: المحفظة المجهولة الافتتاح تُعرض مجهولةً بصراحة مع طريق إكمال موثق لاحقًا. */}
      {state.overview.unknownOpeningCount > 0 ? (
        <p className="micro-later-action" role="status">
          <strong>محفظة بلا رصيد افتتاحي معروف</strong>
          <small>
            رصيدها المعروض الآن يخص الحركات المسجلة فقط؛ سجّل رصيدها الموثق لاحقًا ليزول الختم بصدق.
          </small>
        </p>
      ) : null}
      <section className="micro-supplier-list">
        <div className="micro-finance-event-heading">
          <span className="micro-overline">الأماكن المعلنة</span>
          <h2>
            {state.overview.wallets.length
              ? cashWalletCountLabel(state.overview.wallets.length)
              : "لم تسجل محفظة بعد"}
          </h2>
        </div>
        {state.overview.wallets.length ? (
          state.overview.wallets.map(wallet => (
            <article key={wallet.id}>
              <div>
                <strong>
                  <Landmark aria-hidden="true" /> {wallet.name}
                </strong>
                <small>
                  {wallet.kind === "cash_drawer"
                    ? "درج"
                    : wallet.kind === "bank_account"
                      ? "حساب بنكي"
                      : wallet.kind === "digital_wallet"
                        ? "محفظة رقمية"
                        : "مكان كاش آخر"}{" "}
                  · {savedImpactCountLabel(wallet.entryCount)}
                  {wallet.openingUnknown ? " · رصيد الافتتاح غير معروف" : ""}
                </small>
              </div>
              <div className="micro-supplier-balance">
                <b>
                  <MoneyValue minor={wallet.balanceMinor} />
                </b>
                <button
                  className="micro-button micro-button-quiet"
                  type="button"
                  onClick={() => navigate(withFrom(`/cash/wallet/${wallet.id}`, "/cash"))}
                >
                  <NotebookPen aria-hidden="true" /> السجل
                </button>
                {wallet.openingUnknown ? (
                  <button
                    className="micro-button micro-button-secondary"
                    type="button"
                    onClick={() => navigate(withFrom(`/cash/wallet/${wallet.id}/opening-later`, "/cash"))}
                  >
                    سجّل رصيدًا موثقًا لاحقًا
                  </button>
                ) : (
                  <button
                    className="micro-button micro-button-secondary"
                    type="button"
                    onClick={() => navigate(withFrom(`/cash/wallet/${wallet.id}/adjust`, "/cash"))}
                  >
                    <SlidersHorizontal aria-hidden="true" /> ضبط بسبب
                  </button>
                )}
              </div>
            </article>
          ))
        ) : (
          <p>لا تجعل الكاش المسجل بداية غامضة. أضف درجًا أو حسابًا ورصيده في يوم البدء.</p>
        )}
      </section>
      {state.entries.length ? (
        <section className="micro-supplier-list micro-cash-history">
          <div className="micro-finance-event-heading">
            <span className="micro-overline">أحدث الآثار · المبالغ (د.أ)</span>
            <h2>سجل لا يحذف بصمت</h2>
          </div>
          {state.entries
            .slice()
            .reverse()
            .slice(0, 8)
            .map(entry => (
              <article key={entry.id}>
                <div>
                  <strong>{label(entry.type)}</strong>
                  <small>
                    <LocalDateValue value={entry.occurredOn} /> · {entry.note}
                    {entry.reason ? ` · السبب: ${entry.reason}` : ""}
                  </small>
                </div>
                <div className="micro-supplier-balance">
                  <b>
                    <MoneyValue minor={entry.cashDeltaMinor} showPlus />
                  </b>
                  {entry.type !== "reversal" ? (
                    <button
                      className="micro-button micro-button-quiet"
                      type="button"
                      onClick={() => navigate(withFrom(`/cash/entry/${entry.id}/reverse`, "/cash"))}
                    >
                      <RotateCcw aria-hidden="true" /> تراجع
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
        </section>
      ) : null}
    </section>
  );
}
