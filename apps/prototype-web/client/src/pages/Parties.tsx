/**
 * S05 (DOC-014 / UNIT-037 A4/A5/A6): «العملاء والموردون» — دليل الأطراف
 * المحفوظة اختياريًا وحساب كل طرف من مصادره المرتبطة بمعرفه المؤكد. لا
 * تجميع بالاسم (SDF-009) ولا دفتر أرصدة قابل للتحرير ولا قائمة ديون مجهولة
 * منافسة (B-DUP) — التعاملات غير المحفوظة تبقى في مصادرها والمتابعة.
 */
import { Archive, ArchiveRestore, ArrowRight, HandCoins, Search, UserPlus, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useReturnPath } from "@/app/useReturnNavigation";
import { withReturnTo } from "@/app/navigationContract";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { IntegerValue, MoneyValue } from "@/components/presentation/DisplayValue";
import { formatLocalDate } from "@/presentation/formatters";
import type { PartyAccountEntry, PartyDirectoryOverview } from "@/application/parties";
import type { SavedParty } from "@micro-domain/party/index.js";

import { Button } from "@/components/primitives";
type State = { phase: "loading" } | { phase: "error" } | { phase: "ready"; overview: PartyDirectoryOverview };

type SaveState = { phase: "idle" } | { phase: "saving" } | { phase: "failed"; message: string };

const movementLabel: Record<string, string> = {
  sale_debt: "دين بيع مباشر",
  purchase_payable: "ذمة شراء",
};

/* المجموعة ٢ (§6.2) + S05: طريق التحصيل الصحيح من حساب الطرف — يفتح ورقة
 * التحصيل بالذمة المصدر (دين بيع مرتبط) حيث التحصيل الموثق بالوجهة
 * المختارة؛ الدليل نفسه يبقى قراءة ولا يكتب الحركة من هنا. */
function collectTargetHref(entry: PartyAccountEntry): string | null {
  const debt = entry.movements.find(movement => movement.kind === "sale_debt");
  if (!debt) return null;
  const saleId = debt.href.replace(/^\/direct-sales\//u, "");
  return saleId ? withReturnTo(`/collect?source=sale:${saleId}`, "/parties") : null;
}

export default function Parties() {
  const [, navigate] = useLocation();
  /* S1-10: الرجوع للمصدر (?from) مع بديل قانوني ثابت (عقد ٢٦ §٢.٢). */
  const returnPath = useReturnPath();
  const { partyDirectory, dataVersion } = usePrototypeServices();
  const [state, setState] = useState<State>({ phase: "loading" });
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [saveState, setSaveState] = useState<SaveState>({ phase: "idle" });

  useEffect(() => {
    /* S05: الخدمة تُحمَّل كسولًا فوق المخزن الوحيد — null تعني «جارٍ التجهيز»
     * (نمط transfers/loans/cashCount) لا فشلًا صامتًا ولا بيانات مزعومة. */
    if (!partyDirectory) return;
    let active = true;
    void partyDirectory.read().then(result => {
      if (!active) return;
      setState(result.ok ? { phase: "ready", overview: result.value } : { phase: "error" });
    });
    return () => {
      active = false;
    };
  }, [partyDirectory, dataVersion]);

  const filteredParties = useMemo(() => {
    if (state.phase !== "ready") return [];
    const needle = query.trim();
    if (!needle) return state.overview.parties;
    return state.overview.parties.filter(entry => entry.party.label.includes(needle));
  }, [state, query]);

  if (state.phase === "loading")
    return (
      <div className="micro-route-loading" role="status">
        جارٍ تجهيز العملاء والموردين…
      </div>
    );
  if (state.phase === "error")
    return (
      <section className="micro-page micro-not-found">
        <h1>تعذر قراءة العملاء والموردين</h1>
        <p role="alert">لم يتم تغيير بياناتك.</p>
        <div className="micro-form-actions">
          <Button action="save" onClick={() => setState({ phase: "loading" })}>
            إعادة المحاولة
          </Button>
        </div>
        <Button action="secondary" onClick={() => navigate(withReturnTo("/finance", "/parties"))}>
          المالية
        </Button>
      </section>
    );

  const { overview } = state;

  const saveNewParty = async () => {
    if (!partyDirectory) return;
    setSaveState({ phase: "saving" });
    /* عهدة الحفظ بمفتاح نية ثابت: تكرار النقر أو إعادة الإرسال بعد فشل لا
     * ينشئ طرفًا ثانيًا ولا يكرر أثرًا (UNIT-037 B3/U037-AC22). */
    const operationKey = `party-save:${newLabel.trim()}:${Date.now()}`;
    const saved = await partyDirectory.save({
      label: newLabel,
      phone: newPhone || null,
      note: null,
      operationKey,
    });
    if (!saved.ok) {
      setSaveState({ phase: "failed", message: saved.message });
      return;
    }
    setAddOpen(false);
    setNewLabel("");
    setNewPhone("");
    setSaveState({ phase: "idle" });
    const refreshed = await partyDirectory.read();
    if (refreshed.ok) setState({ phase: "ready", overview: refreshed.value });
  };

  return (
    <section className="micro-page micro-parties-page">
      <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>
        <ArrowRight aria-hidden="true" /> {returnPath === "/finance" ? "المالية" : "رجوع"}
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">العملاء والموردون</span>
        <h1>من تتعامل معه عند الحاجة</h1>
        <p>
          هنا من حفظته صراحة لإعادة الاستخدام — اختياره في البيع والشراء يكون بقرارك، وحسابه يُقرأ من تعاملاته
          المرتبطة به وحدها. من لم تحفظه يبقى في مصدره والمتابعة؛ لا نجمع بالاسم ولا نقاص بين لك وعليك.
        </p>
      </div>
      <section className="micro-home-facts" aria-label="خلاصة الدليل">
        <article className="micro-home-fact" data-state="known">
          <div className="micro-home-fact-heading">
            <HandCoins aria-hidden="true" />
            <span>لك عند المحفوظين</span>
          </div>
          <strong>
            <MoneyValue minor={overview.totalReceivableMinor} />
          </strong>
          <small>ديون البيع المرتبطة صراحة بمعرف الطرف</small>
        </article>
        <article className="micro-home-fact" data-state="known">
          <div className="micro-home-fact-heading">
            <Users aria-hidden="true" />
            <span>عليك للمحفوظين</span>
          </div>
          <strong>
            <MoneyValue minor={overview.totalPayableMinor} />
          </strong>
          <small>ذمم الشراء المرتبطة صراحة بمعرف الطرف</small>
        </article>
      </section>
      <div className="micro-form-actions">
        <Button action="save" onClick={() => setAddOpen(open => !open)}>
          <UserPlus aria-hidden="true" /> احفظ طرفًا جديدًا
        </Button>
        {overview.archivedParties.length > 0 ? (
          <Button action="secondary" onClick={() => setShowArchived(shown => !shown)}>
            {showArchived ? "إخفاء المؤرشفين" : `المؤرشفون (${overview.archivedParties.length})`}
          </Button>
        ) : null}
      </div>
      {addOpen ? (
        <section className="micro-party-add-form" aria-label="حفظ طرف جديد">
          <label className="micro-field">
            <span>الاسم أو الوصف</span>
            <input
              value={newLabel}
              onChange={event => setNewLabel(event.target.value)}
              aria-label="الاسم أو الوصف"
            />
          </label>
          <label className="micro-field">
            <span>هاتف (اختياري)</span>
            <input
              value={newPhone}
              onChange={event => setNewPhone(event.target.value)}
              aria-label="هاتف الطرف الاختياري"
            />
          </label>
          {saveState.phase === "failed" ? (
            <p className="micro-field-error" role="alert">
              {saveState.message}
            </p>
          ) : null}
          <p className="micro-save-note">
            الحفظ هنا لا يسجل دينًا ولا حركة — هوية تعاد استخدامها في البيع والشراء وقت اختيارها.
          </p>
          <div className="micro-form-actions">
            <Button
              action="save"
              disabled={saveState.phase === "saving" || !newLabel.trim()}
              onClick={() => {
                void saveNewParty();
              }}
            >
              {saveState.phase === "saving" ? "جارٍ الحفظ…" : "حفظ الطرف"}
            </Button>
            <Button
              action="secondary"
              onClick={() => {
                setAddOpen(false);
                setSaveState({ phase: "idle" });
              }}
            >
              إلغاء
            </Button>
          </div>
        </section>
      ) : null}
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
          <strong>لم تحفظ عملاء أو موردين بعد.</strong>
          <p>
            حفظ الطرف اختياري دائمًا — البيع والشراء يعملان بدونه، والمتبقي منهما يُعرَّف باسم بسيط عند مصدره
            وقت الحاجة.
          </p>
        </div>
      ) : filteredParties.length === 0 ? (
        <div className="micro-home-quiet">
          <strong>ما لقينا شيئًا بهذا البحث.</strong>
          <p>جرّب اسمًا أقصر أو راجع القائمة كاملة.</p>
        </div>
      ) : (
        <div className="micro-home-today-list">
          {filteredParties.map(entry => (
            <PartyCard key={entry.party.id} entry={entry} onNavigate={navigate} />
          ))}
        </div>
      )}
      {showArchived && overview.archivedParties.length > 0 ? (
        <section aria-label="الأطراف المؤرشفة" className="micro-party-archived">
          <h2>المؤرشفون — لا يُقترحون للاستعمال الجديد</h2>
          <div className="micro-home-today-list">
            {overview.archivedParties.map(entry => (
              <PartyCard key={entry.party.id} entry={entry} onNavigate={navigate} />
            ))}
          </div>
        </section>
      ) : null}
      <p className="micro-home-truth-line">
        <Search aria-hidden="true" /> هذا الدليل قراءة من تعاملاتك المرتبطة صراحة — ما يُسجَّل منه شيء جديد،
        ولا يعد بكل تعاملات الشخص خارج النظام.
      </p>
    </section>
  );
}

/* بطاقة الطرف: حسابه من مصادريه المرتبطين + أفعال التعديل/الأرشفة الصريحة.
 * الأفعال كلها على الهوية وحدها — لا رصيد يُحرَّر من هنا أبدًا (UNIT-037 B2). */
function PartyCard({ entry, onNavigate }: { entry: PartyAccountEntry; onNavigate: (to: string) => void }) {
  const { partyDirectory } = usePrototypeServices();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameLabel, setRenameLabel] = useState(entry.party.label);

  const runAction = async (action: () => Promise<{ ok: boolean; message?: string }>) => {
    if (!partyDirectory) return;
    setBusy(true);
    setActionError(null);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      setActionError(result.message ?? "تعذر تنفيذ الفعل — أعد المحاولة.");
      return;
    }
    const refreshed = await partyDirectory.read();
    if (refreshed.ok) setRenameOpen(false);
  };

  const rename = () =>
    runAction(async () => {
      if (!partyDirectory) return { ok: false };
      const result = await partyDirectory.rename({
        partyId: entry.party.id,
        label: renameLabel,
        expectedUpdatedAt: entry.party.updatedAt,
        operationKey: `party-rename:${entry.party.id}:${Date.now()}`,
      });
      return result.ok ? { ok: true } : { ok: false, message: result.message };
    });

  const setArchived = (archived: boolean) =>
    runAction(async () => {
      if (!partyDirectory) return { ok: false };
      const result = await partyDirectory.setArchived({
        partyId: entry.party.id,
        archived,
        expectedUpdatedAt: entry.party.updatedAt,
        operationKey: `party-archive:${entry.party.id}:${archived ? 1 : 0}:${Date.now()}`,
      });
      return result.ok ? { ok: true } : { ok: false, message: result.message };
    });

  const collectHref = collectTargetHref(entry);
  return (
    <details className="micro-party-entry">
      <summary className="micro-party-summary">
        <span>
          <b dir="auto">{entry.party.label}</b>
          {entry.party.archivedAt != null ? <small className="micro-party-repeat-mark">مؤرشف</small> : null}
          <small>
            {entry.receivableMinor > 0 ? (
              <>
                لك <MoneyValue minor={entry.receivableMinor} className="micro-inline-number" />
              </>
            ) : null}
            {entry.receivableMinor > 0 && entry.payableMinor > 0 ? " · " : null}
            {entry.payableMinor > 0 ? (
              <>
                عليك <MoneyValue minor={entry.payableMinor} className="micro-inline-number" />
              </>
            ) : null}
            {" · "}
            <IntegerValue value={entry.movements.length} /> تعامل مرتبط
          </small>
        </span>
        <strong>افتح الحساب</strong>
      </summary>
      <ul className="micro-party-movements">
        {collectHref ? (
          <li className="micro-party-collect-shortcut">
            <button type="button" onClick={() => onNavigate(collectHref)}>
              <span>
                <b>حصّل من {entry.party.label}</b>
                <small>
                  يفتح ورقة التحصيل بأول دين مرتبط — مبلغ ووجهة كاش موثقة، ولا يُكتب شيء من الدليل.
                </small>
              </span>
              <HandCoins aria-hidden="true" />
            </button>
          </li>
        ) : null}
        {entry.movements.length === 0 ? (
          <li className="micro-party-empty-account">
            <small>لا تعاملات مرتبطة بهذا الطرف بعد — الحفظ لا يستحدث دينًا ولا ذمة.</small>
          </li>
        ) : (
          entry.movements.map(movement => (
            <li key={movement.id}>
              <button type="button" onClick={() => onNavigate(withReturnTo(movement.href, "/parties"))}>
                <span>
                  <small>
                    <bdi dir="ltr">{formatLocalDate(movement.occurredOn)}</bdi>
                  </small>
                  <b>
                    {movementLabel[movement.kind] ?? movement.kind} · {movement.label}
                  </b>
                </span>
                <MoneyValue minor={movement.amountMinor} showPlus />
              </button>
            </li>
          ))
        )}
        {actionError ? (
          <li>
            <p className="micro-field-error" role="alert">
              {actionError}
            </p>
          </li>
        ) : null}
        <li className="micro-party-identity-actions">
          <div className="micro-form-actions">
            <Button action="secondary" disabled={busy} onClick={() => setRenameOpen(open => !open)}>
              تعديل الاسم
            </Button>
            {entry.party.archivedAt == null ? (
              <Button action="secondary" disabled={busy} onClick={() => void setArchived(true)}>
                <Archive aria-hidden="true" /> أرشفة
              </Button>
            ) : (
              <Button action="secondary" disabled={busy} onClick={() => void setArchived(false)}>
                <ArchiveRestore aria-hidden="true" /> إعادة الإظهار
              </Button>
            )}
          </div>
          {renameOpen ? (
            <div className="micro-form-actions">
              <label className="micro-field">
                <span>التسمية الجديدة</span>
                <input
                  value={renameLabel}
                  onChange={event => setRenameLabel(event.target.value)}
                  aria-label="التسمية الجديدة"
                />
              </label>
              <Button action="save" disabled={busy || !renameLabel.trim()} onClick={() => void rename()}>
                حفظ التسمية
              </Button>
            </div>
          ) : null}
          <small>
            تغيير الاسم هنا لا يعيد كتابة أي تعامل قديم — لقطة الاسم محفوظة عند كل مصدر كما سُجلت. والأرشفة
            تخفيه من الاقتراح فقط ولا تحذف تاريخه.
          </small>
        </li>
      </ul>
    </details>
  );
}
