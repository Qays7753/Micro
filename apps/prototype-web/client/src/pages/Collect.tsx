/**
 * المجموعة ٢ (§6 — Scope B): ورقة التحصيل — سطح تحصيل مخصص واعٍ بالسياق.
 * يُفتح من الرئيسية (بند دين)، ودفتر الناس (صف الطرف)، وورقة الإضافة (سجّل)،
 * أو مباشرة بلا مصدر فيعمل منتقي ديون آمن. يعرض الشخص والمتبقي وسياق المصدر،
 * يعبّئ المتبقي قابلًا للتعديل، يفرض وجهة كاش صريحة (الدرج افتراضيًا حين يوجد)،
 * يمنع التحصيل فوق المتبقي، ويكتب بواقعية: كاش+ / متبقٍ− — لا إيراد ولا ربح.
 */
import { ArrowLeft, HandCoins, Handshake, Landmark, ReceiptText } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useReturnPath } from "@/app/useReturnNavigation";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { useFormDirty } from "@/components/forms/useFormDirty";
import { useUnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import { LocalDateValue, MoneyValue } from "@/components/presentation/DisplayValue";
import type { CollectionOutcome, ReceivableSource } from "@/application/collections/collectionService";
import type { CashContinuityOverview } from "@/application/cash/cashContinuityService";
import { formatLocalDate, localDateInAmman } from "@/presentation/formatters";
import { formatMoneyWithUnit } from "@/presentation/formatters";

type PageState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; source: ReceivableSource | null; sources: readonly ReceivableSource[]; wallets: CashContinuityOverview }
  | { phase: "done"; outcome: CollectionOutcome; personName: string };

/** تحليل ?source دفاعيًا: order:<id> أو sale:<id> — غير ذلك يُهمل بهدوء (لا انفجار). */
function parseSourceParam(search: string): { kind: "order" | "direct_sale"; id: string } | null {
  const raw = new URLSearchParams(search).get("source");
  if (!raw) return null;
  const match = raw.match(/^(order|sale):([A-Za-z0-9_-]{1,64})$/);
  if (!match) return null;
  return { kind: match[1] === "order" ? "order" : "direct_sale", id: match[2]! };
}

export default function Collect() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const returnPath = useReturnPath();
  const { collections, cashContinuity, dataVersion, notifyDataChanged } = usePrototypeServices();
  const requested = parseSourceParam(search);

  const [state, setState] = useState<PageState>({ phase: "loading" });
  /* المجموعة ٢ (§14): بعد نجاح محلي موثق لا تعيد القراءة طمس شاشة النتيجة —
   * إشارة تغيّر البيانات تجدد القوائم عند الفتح لا بعد الإنجاز. */
  const doneRef = useRef(false);
  const [selectedId, setSelectedId] = useState<string | null>(
    requested ? `${requested.kind}:${requested.id}` : null,
  );
  const [amountMinor, setAmountMinor] = useState(0);
  const [validAmount, setValidAmount] = useState(true);
  const [destination, setDestination] = useState<string>("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadedToken, setLoadedToken] = useState(0);
  const idempotencyKeyRef = useRef(
    globalThis.crypto?.randomUUID?.() ?? `collect-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  useEffect(() => {
    let active = true;
    Promise.all([collections.listReceivableSources(), cashContinuity.overview()]).then(
      ([sourcesResult, walletsResult]) => {
        if (!active || doneRef.current) return;
        if (!sourcesResult.ok || !walletsResult.ok) {
          const message = !sourcesResult.ok
            ? sourcesResult.message
            : !walletsResult.ok
              ? walletsResult.message
              : "تعذر قراءة الديون.";
          setState({ phase: "error", message });
          return;
        }
        const found = requested
          ? sourcesResult.value.find(
              item => item.kind === requested.kind && item.id === requested.id,
            ) ?? null
          : null;
        /* الوصلة العميقة قد تشير لذمة حُصّلت كاملة أو أُلغيت — نفتح المنتقي بهدوء لا خطأ. */
        setSelectedId(found ? `${found.kind}:${found.id}` : null);
        setState({ phase: "ready", source: found, sources: sourcesResult.value, wallets: walletsResult.value });
        if (found) setAmountMinor(found.outstandingMinor);
        const drawer = walletsResult.value.wallets.find(wallet => wallet.kind === "cash_drawer");
        setDestination(current => current || drawer?.id || "");
        setLoadedToken(token => token + 1);
      },
    );
    return () => {
      active = false;
    };
    /* requested مقصود خارج الاعتماديات: يُقرأ مرة عند الفتح لا مع كل بحث.
     * المعامل يُثبَّت في selectedId عند أول تحميل؛ تغيير البحث لا يعيد فتح الذمة. */
  }, [collections, cashContinuity, dataVersion]);

  const ready = state.phase === "ready" ? state : null;
  const source = ready?.source ?? null;
  const walletOptions = ready?.wallets.wallets ?? [];
  const drawer = walletOptions.find(wallet => wallet.kind === "cash_drawer") ?? null;

  /* قذارة النموذج: أي مبلغ مكتوب أو وجهة أو ملاحظة — تُحمى من الخروج الصامت.
   * (فحص حي — مجموعة ٣): بعد النجاح (done) لا وسخ أصلًا — الطور يسقط wallets
   * فلا يُقارن الدرج بوجهةٍ فارغة فيفتح الحوار خطأً على شاشة النتيجة. */
  const isDirty = useMemo(
    () =>
      state.phase === "ready" &&
      (amountMinor > 0 || note.trim().length > 0 || destination !== (drawer?.id ?? "")),
    [state.phase, amountMinor, note, destination, drawer],
  );
  useFormDirty([amountMinor, note, destination, loadedToken], loadedToken);
  const requestNavigation = useUnsavedChangesGuard({
    isDirty,
    onSave: () => submit(),
  });

  const destinationLabel =
    destination === ""
      ? "غير موزع — يُوزَّع لاحقًا بقرار صريح"
      : walletOptions.find(wallet => wallet.id === destination)?.name ?? "غير موزع";

  async function submit() {
    if (!source) {
      setMessage("اختر دين التحصيل أولًا.");
      return false;
    }
    if (!validAmount || !Number.isInteger(amountMinor) || amountMinor <= 0) {
      setMessage("أدخل مبلغ التحصيل رقمًا صحيحًا موجبًا بالأرقام 0–9.");
      return false;
    }
    if (amountMinor > source.outstandingMinor) {
      setMessage(
        `التحصيل يتجاوز المتبقي على ${source.personName} — المتبقي ${formatMoneyWithUnit(source.outstandingMinor)}. حصّل المتبقي أو أقل منه.`,
      );
      return false;
    }
    setSaving(true);
    setMessage(null);
    const result = await collections.collect({
      sourceKind: source.kind,
      sourceId: source.id,
      amountMinor,
      walletId: destination === "" ? null : destination,
      note: note.trim() || null,
      idempotencyKey: idempotencyKeyRef.current,
    });
    setSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      return false;
    }
    /* نجاح محلي مكتمل: يُعرض كما هو، والنموذج يُفرّغ فلا يعترض الخروج بعده. */
    doneRef.current = true;
    setAmountMinor(0);
    setNote("");
    notifyDataChanged();
    setState({ phase: "done", outcome: result.value, personName: source.personName });
    return true;
  }

  if (state.phase === "loading")
    return (
      <div className="micro-route-loading" role="status">
        جارٍ قراءة الديون القابلة للتحصيل…
      </div>
    );
  if (state.phase === "error")
    return (
      <section className="micro-page micro-not-found">
        <h1>تعذر فتح ورقة التحصيل</h1>
        <p>{state.message}</p>
        <button className="micro-button micro-button-primary" type="button" onClick={() => navigate(returnPath)}>
          رجوع
        </button>
      </section>
    );
  if (state.phase === "done") {
    const { outcome } = state;
    return (
      <section className="micro-page micro-collect-page">
        <div className="micro-page-heading">
          <span className="micro-overline">ورقة تحصيل · انسجّل القبض</span>
          <h1>قبضت من {state.personName}</h1>
        </div>
        <section className="micro-decision-card" aria-label="نتيجة التحصيل">
          <span>المبلغ المقبوض</span>
          <strong>
            <MoneyValue minor={outcome.collectedMinor} /> د.أ
          </strong>
          <p>
            {outcome.remainingAfterMinor > 0
              ? `الباقي على ${state.personName}: ${formatMoneyWithUnit(outcome.remainingAfterMinor)} — الديون مستمرة لا تتغير قيمتها.`
              : `الباقي على ${state.personName}: صفر — الذمة سُدّت بالكامل.`}
          </p>
          <p>
            {outcome.attributedToWalletMinor > 0
              ? `انتقل إلى «${outcome.walletName ?? "المحفظة"}»: ${formatMoneyWithUnit(outcome.attributedToWalletMinor)} — حركة موثقة في دفتر المحفظة.`
              : "بقي الكاش غير موزع — وزّعه على محفظة عندما تعرف وجهته."}
          </p>
          {/* (إصلاح تكاملي — مجموعة ٤): فشل نسبة المحفظة بعد تسجيل القبض يظهر سببه
              في النتيجة لا كخطأ يكذب على كتابةٍ تمت — المال بقي غير موزع بلا فقدان. */}
          {outcome.attributionNotice ? (
            <p className="micro-local-truth">وجهة المحفظة لم تُنفّذ: {outcome.attributionNotice}</p>
          ) : null}
          <p className="micro-local-truth">بياناتك محفوظة على هذا الجهاز — التحصيل سُجل محليًا ولم يُرسل لأي مكان.</p>
        </section>
        <div className="micro-form-actions">
          <button
            className="micro-button micro-button-primary"
            type="button"
            onClick={() => requestNavigation(outcome.sourceHref)}
          >
            <ReceiptText aria-hidden="true" /> افتح السجل
          </button>
          <button
            className="micro-button micro-button-secondary"
            type="button"
            onClick={() => requestNavigation(returnPath)}
          >
            تم
          </button>
        </div>
      </section>
    );
  }

  const outstanding = source?.outstandingMinor ?? 0;
  /* (إصلاح تكاملي — مجموعة ٤، عيبان): (١) معاينة الأثر لا تعرض تجاوزًا كأنه نتيجة
   * صالحة — عند تجاوز المتبقي يبقى المتبقي كما هو ويظهر تحذير داخل المعاينة؛
   * (٢) تصحيح المبلغ/الوجهة يُزيل رسالة الخطأ القديمة فلا تُقرأ كأنها حالة حالية. */
  const overAmount = Boolean(source && validAmount && amountMinor > source.outstandingMinor);
  const remainingAfter = overAmount
    ? outstanding
    : Math.max(outstanding - (validAmount ? amountMinor : 0), 0);

  return (
    <section className="micro-page micro-collect-page">
      <button
        className="micro-back-button"
        type="button"
        onClick={() => requestNavigation(returnPath)}
        disabled={saving}
      >
        <ArrowLeft aria-hidden="true" /> رجوع
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">ورقة تحصيل</span>
        <h1>حصّل من مين عليه إلَي</h1>
        <p>قبض واحد موثق: الكاش يرتفع والدين ينقص — لا إيراد ولا ربح يُسجّل هنا.</p>
      </div>
      {source ? (
        <section className="micro-decision-card" aria-label="الذمة المختارة">
          <div className="micro-cash-decision-heading">
            <span className="micro-overline">{source.qualifier}</span>
          </div>
          <div>
            <strong>
              <HandCoins aria-hidden="true" /> {source.personName}
            </strong>
            <small>
              {source.itemName} · <LocalDateValue value={source.occurredOn} />
            </small>
          </div>
          <div className="micro-collect-outstanding">
            <span>المتبقي عليه</span>
            <strong>
              <MoneyValue minor={outstanding} /> د.أ
            </strong>
          </div>
        </section>
      ) : ready && ready.sources.length > 0 ? (
        <section className="micro-form-card" aria-label="اختر ذمة التحصيل">
          <label className="micro-field">
            <span>مين اللي بتحصّل منه؟</span>
            <select
              value={selectedId ?? ""}
              onChange={event => {
                const value = event.target.value;
                setSelectedId(value || null);
                const picked = ready.sources.find(item => `${item.kind}:${item.id}` === value) ?? null;
                setState({ ...ready, source: picked });
                if (picked) setAmountMinor(picked.outstandingMinor);
              }}
            >
              <option value="">اختر شخصًا وذمة…</option>
              {ready.sources.map(item => (
                <option key={`${item.kind}:${item.id}`} value={`${item.kind}:${item.id}`}>
                  {item.personName} — {item.itemName} — المتبقي {formatMoneyWithUnit(item.outstandingMinor)}
                </option>
              ))}
            </select>
          </label>
        </section>
      ) : ready && ready.sources.length === 0 ? (
        <section className="micro-home-quiet" aria-label="لا ديون">
          <strong>ما في ديون قابلة للتحصيل الآن.</strong>
          <p>
            الديون تظهر هنا بعد التسليم مع متبقٍ، أو بعد تسجيل الدين صراحة، أو من بيع آجل — التحصيل قبل
            التسليم يُسجّل عربونًا من تفاصيل الطلب.
          </p>
          <button
            className="micro-button micro-button-secondary"
            type="button"
            onClick={() => requestNavigation(returnPath)}
          >
            رجوع
          </button>
        </section>
      ) : null}
      {source ? (
        <section className="micro-form-card" aria-label="نموذج التحصيل">
          <label className="micro-field">
            <span>كم قبضت؟ (د.أ)</span>
            <EnglishNumberInput
              value={amountMinor}
              kind="money"
              onNumericChange={value => {
                setAmountMinor(value);
                if (message) setMessage(null);
              }}
              onTextValidityChange={setValidAmount}
              aria-label="مبلغ التحصيل"
            />
          </label>
          <div className="micro-form-actions" role="group" aria-label="تعبئة سريعة">
            <button
              className="micro-text-action"
              type="button"
              onClick={() => setAmountMinor(source.outstandingMinor)}
            >
              كامل المتبقي ({formatMoneyWithUnit(source.outstandingMinor)})
            </button>
            <button
              className="micro-text-action"
              type="button"
              onClick={() => setAmountMinor(Math.max(Math.floor(source.outstandingMinor / 2), 0))}
            >
              نصف المتبقي
            </button>
          </div>
          <label className="micro-field">
            <span>
              وجهة الكاش <small>الدرج افتراضيًا حين يوجد — لا اختيار صامت</small>
            </span>
            <select value={destination} onChange={event => setDestination(event.target.value)}>
              <option value="">غير موزع — يُوزَّع لاحقًا بقرار صريح</option>
              {walletOptions.map(wallet => (
                <option key={wallet.id} value={wallet.id}>
                  {wallet.name} ({wallet.kind === "cash_drawer" ? "درج" : wallet.kind === "bank_account" ? "حساب بنكي" : wallet.kind === "digital_wallet" ? "محفظة رقمية" : "مكان كاش"}{" "}
                  — الرصيد {formatMoneyWithUnit(wallet.balanceMinor)})
                  {drawer && wallet.id === drawer.id ? " · الافتراضي" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="micro-field">
            <span>
              ملاحظة <small>اختيارية</small>
            </span>
            <input
              value={note}
              onChange={event => setNote(event.target.value)}
              placeholder="مثال: قبض نصف المتبقي اليوم"
              aria-label="ملاحظة التحصيل"
            />
          </label>
          {/* معاينة الأثر قبل التأكيد — مادية لأنها تلمس الكاش والدين معًا. */}
          <section className="micro-decision-card" data-knowledge="known" aria-label="أثر التحصيل">
            <span>الأثر قبل الحفظ</span>
            <dl className="micro-collect-preview">
              <div>
                <dt>
                  {destination === "" ? "الكاش غير الموزع" : `كاش «${destinationLabel}»`}
                </dt>
                <dd>
                  <MoneyValue minor={validAmount ? amountMinor : 0} showPlus /> د.أ
                </dd>
              </div>
              <div>
                <dt>متبقي {source.personName}</dt>
                <dd>
                  <MoneyValue minor={remainingAfter} /> د.أ
                </dd>
              </div>
              <div>
                <dt>الإيراد والنتيجة</dt>
                <dd>لا تتغير — القبض ليس إيرادًا</dd>
              </div>
            </dl>
            {overAmount ? (
              <p className="micro-field-error" role="alert">
                المبلغ المُدخل يتجاوز المتبقي على {source.personName} — القبض لن يُسجّل حتى تصحّح
                المبلغ؛ المتبقي أعلاه يبقى كما هو.
              </p>
            ) : null}
          </section>
          {message ? (
            <p className="micro-field-error" role="alert">
              {message}
            </p>
          ) : null}
          <button
            className="micro-button micro-button-primary"
            type="button"
            disabled={saving}
            onClick={() => void submit()}
          >
            <Handshake aria-hidden="true" />
            {saving ? "جارٍ تسجيل القبض…" : "سجّل القبض"}
          </button>
          <p className="micro-home-truth-line">
            <Landmark aria-hidden="true" /> القبض يُسجّل اليوم {formatLocalDate(localDateInAmman())} — كتابة
            محلية واحدة، والضغط مرتين لا يضاعف أثرًا.
          </p>
        </section>
      ) : null}
    </section>
  );
}

