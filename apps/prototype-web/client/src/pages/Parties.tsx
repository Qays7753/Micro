/**
 * دفتر الناس (owner principle 5.3): a lightweight party ledger — name-level aggregation
 * over existing records. No CRM entity, no new stores: one honest read model.
 */
import { ArrowLeft, HandCoins, Search, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useReturnPath } from "@/app/useReturnNavigation";
import { withFrom } from "@/app/navigationContract";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { IntegerValue, MoneyValue } from "@/components/presentation/DisplayValue";
import { formatLocalDate } from "@/presentation/formatters";
import type { PartyLedgerOverview } from "@/application/parties/partyLedgerService";

type State =
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "ready"; overview: PartyLedgerOverview };

const movementLabel: Record<string, string> = {
  order_debt: "دين طلب",
  order_collection: "تحصيل طلب",
  direct_sale_debt: "دين بيع مباشر",
  direct_sale_collected: "قبض بيع مباشر",
  purchase_payable: "ذمة شراء",
  purchase_payment: "دفعة مورد",
  payable_event: "التزام",
  settlement: "تسديد",
};
/* المجموعة ٢ (§6.2): طريق التحصيل الصحيح من صف الطرف — يفتح ورقة التحصيل
 * بالذمة المصدر (طلبًا كانت أو بيعًا آجل) حيث التحصيل الموثق بالوجهة المختارة؛
 * الدفتر نفسه يبقى قراءة ولا يكتب الحركة من هنا. */
function collectTargetHref(
  party: PartyLedgerOverview["parties"][number],
): string | null {
  const debt = party.movements.find(
    movement => movement.kind === "order_debt" || movement.kind === "direct_sale_debt",
  );
  if (!debt) return null;
  if (debt.kind === "order_debt") {
    const orderId = debt.href.replace(/^\/orders\//u, "");
    /* S1-01: الرجوع من ورقة التحصيل يعود إلى دفتر الناس لا إلى الرئيسية (عقد ٢٦ §٢.٣). */
    return orderId ? withFrom(`/collect?source=order:${orderId}`, "/parties") : null;
  }
  const saleId = debt.href.replace(/^\/direct-sales\//u, "");
  return saleId ? withFrom(`/collect?source=sale:${saleId}`, "/parties") : null;
}

export default function Parties() {
  const [, navigate] = useLocation();
  /* S1-10: الرجوع للمصدر (?from) مع بديل قانوني ثابت (عقد ٢٦ §٢.٢). */
  const returnPath = useReturnPath();
  const { partyLedger, dataVersion } = usePrototypeServices();
  const [state, setState] = useState<State>({ phase: "loading" });
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    partyLedger.read().then(result => {
      if (!active) return;
      setState(result.ok ? { phase: "ready", overview: result.value } : { phase: "error" });
    });
    return () => {
      active = false;
    };
  }, [partyLedger, dataVersion]);

  const filteredParties = useMemo(() => {
    if (state.phase !== "ready") return [];
    const needle = query.trim();
    if (!needle) return state.overview.parties;
    return state.overview.parties.filter(party => party.name.includes(needle));
  }, [state, query]);

  if (state.phase === "loading")
    return (
      <div className="micro-route-loading" role="status">
        جارٍ تجميع دفتر الناس…
      </div>
    );
  if (state.phase === "error")
    return (
      <section className="micro-page micro-not-found">
        <h1>تعذر قراءة دفتر الناس</h1>
        <p>لم يتم تغيير بياناتك. أعد المحاولة.</p>
        <button className="micro-button micro-button-primary" type="button" onClick={() => navigate(withFrom("/finance", "/parties"))}>
          الوضع المالي
        </button>
      </section>
    );

  const { overview } = state;

  return (
    <section className="micro-page micro-parties-page">
      <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>
        <ArrowLeft aria-hidden="true" /> {returnPath === "/finance" ? "الوضع المالي" : "رجوع"}
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">دفتر الناس</span>
        <h1>مين عليه إلَي، وعليّ لمين؟</h1>
        <p>تجميع حي بالاسم من الطلبات والمشتريات والالتزامات — لا كيانات إضافية ولا إدخال مزدوج.</p>
      </div>
      <section className="micro-home-facts" aria-label="خلاصة الدفتر">
        <article className="micro-home-fact" data-state="known">
          <div className="micro-home-fact-heading">
            <HandCoins aria-hidden="true" />
            <span>لك عند الناس</span>
          </div>
          <strong>
            <MoneyValue minor={overview.totalReceivableMinor} />
          </strong>
        </article>
        <article className="micro-home-fact" data-state="known">
          <div className="micro-home-fact-heading">
            <Users aria-hidden="true" />
            <span>عليك للناس</span>
          </div>
          <strong>
            <MoneyValue minor={overview.totalPayableMinor} />
          </strong>
        </article>
      </section>
      <label className="micro-field">
        <span>ابحث بالاسم</span>
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="مثال: خالد"
          aria-label="بحث بالاسم"
        />
      </label>
      {overview.parties.length === 0 ? (
        <div className="micro-home-quiet">
          <strong>لسه ما في حدا عليه فلوس.</strong>
          <p>لما تسجل دين طلب أو ذمة مورد بيظهروا هون مجمّعين بالاسم.</p>
        </div>
      ) : filteredParties.length === 0 ? (
        <div className="micro-home-quiet">
          <strong>ما لقينا شي بهذا البحث.</strong>
          <p>جرّب اسمًا أقصر أو راجع القائمة كاملة.</p>
        </div>
      ) : (
        <div className="micro-home-today-list">
          {filteredParties.map(party => (
            <details className="micro-party-entry" key={party.name}>
              <summary className="micro-party-summary">
                <span>
                  <b>{party.name}</b>
                  <small>
                    {party.receivableMinor > 0 ? (
                      <>
                        لك <MoneyValue minor={party.receivableMinor} className="micro-inline-number" />
                      </>
                    ) : null}
                    {party.receivableMinor > 0 && party.payableMinor > 0 ? " · " : null}
                    {party.payableMinor > 0 ? (
                      <>
                        عليك <MoneyValue minor={party.payableMinor} className="micro-inline-number" />
                      </>
                    ) : null}
                    {" · "}
                    <IntegerValue value={party.movements.length} /> حركة
                  </small>
                </span>
                <strong>افتح التفاصيل</strong>
              </summary>
              <ul className="micro-party-movements">
                {/* D-003: اختصار التحصيل — يفتح سجل الدين المصدر نفسه حيث يجري التحصيل
                    الموثق؛ الدفتر يبقى نموذج قراءة ولا يكتب حدثًا ماليًا من هنا. */}
                {party.receivableMinor > 0 && collectTargetHref(party) ? (
                  <li className="micro-party-collect-shortcut">
                    <button type="button" onClick={() => navigate(collectTargetHref(party)!)}>
                      <span>
                        <b>حصّل من {party.name}</b>
                        <small>يفتح ورقة التحصيل بهذا الدين — مبلغ ووجهة كاش موثقة، ولا يُكتب شيء من الدفتر.</small>
                      </span>
                      <HandCoins aria-hidden="true" />
                    </button>
                  </li>
                ) : null}
                {party.movements.map(movement => (
                  <li key={movement.id}>
                    <button type="button" onClick={() => navigate(withFrom(movement.href, "/parties"))}>
                      <span>
                        <small>{formatLocalDate(movement.occurredOn)}</small>
                        <b>
                          {movementLabel[movement.kind] ?? movement.kind} · {movement.label}
                        </b>
                      </span>
                      <MoneyValue minor={movement.amountMinor} showPlus />
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}
      <p className="micro-home-truth-line">
        <Search aria-hidden="true" /> هذا الدفتر قراءة مجمّعة من سجلاتك الحالية — ما يُسجَّل منه شيء جديد.
      </p>
    </section>
  );
}
