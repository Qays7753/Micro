import {
  createCashContinuityEntry,
  createCashObservation,
  createCashWallet,
  summarizeCashContinuity,
  type CashContinuityEntry,
  type CashObservation,
  type CashObservationKnowledge,
  type CashWallet,
  type CashWalletKind,
  type CashWalletOpeningStatus,
} from "@micro-domain/cash-continuity/index.js";
import type { PrototypeLocalStore } from "@/storage/local/types";

/** R3 (بطاقة R3-SC-01/11): عدسة الخدمة — قناة السيولة النقدية الخمسة بالضبط
 * (عائلة KEEP R3-SC-19 + عائلة الرصد S04). */
export type CashContinuityServiceStore = Pick<
  PrototypeLocalStore,
  | "listCashWallets"
  | "listCashContinuityEntries"
  | "commitCashContinuity"
  | "listBalanceObservations"
  | "commitCashObservation"
>;
import {
  STORAGE_ERROR,
  VALIDATION_ERROR,
  errorMessageOf,
  validationFailure,
} from "@/application/resultCodes";
import { systemClock, todayInAmman, type Clock } from "@/application/time/clock";
import { cashCountSettlementNote } from "./cashCountMessages";

export type CashContinuityResult<T> =
  | { ok: true; value: T; reused?: boolean }
  | { ok: false; code: "validation_error" | "storage_error"; message: string };
export type CashWalletBalance = CashWallet & {
  balanceMinor: number;
  entryCount: number;
  /* «unknown»: المحفظة بلا رصيد معلن بعد — تُعرض «غير محدد» لا صفرًا (مبدأ ٥.١). */
  openingUnknown: boolean;
};
export type CashContinuityOverview = {
  wallets: readonly CashWalletBalance[];
  totalWalletCashMinor: number;
  entryCount: number;
  unknownOpeningCount: number;
  truth: string;
};
export type OpenWalletInput = {
  name: string;
  kind: CashWalletKind;
  openingMinor: number;
  occurredOn: string;
  note: string;
  operationKey: string;
  /* «unknown» = أنشئ المحفظة بلا رقم؛ يظهر «غير محدد» حتى يُدخل رصيد موثق لاحقًا. */
  openingStatus?: CashWalletOpeningStatus;
};
export type RecordOpeningLaterInput = {
  walletId: string;
  amountMinor: number;
  occurredOn: string;
  note: string;
  operationKey: string;
};
export type AdjustCashInput = {
  walletId: string;
  deltaMinor: number;
  occurredOn: string;
  note: string;
  reason: string;
  operationKey: string;
};
export type TransferCashInput = {
  fromWalletId: string;
  toWalletId: string;
  amountMinor: number;
  occurredOn: string;
  note: string;
  operationKey: string;
};
export type ReverseCashInput = { entryId: string; occurredOn: string; reason: string; operationKey: string };
/* S04 (DOC-013 / UNIT-025 + SDF-015/016): أمر العدّ والمطابقة — القياس أولًا
 * دائمًا، والفرق لا يُحسب إلا من مرجع معروف لنطاق المحفظة نفسها، والمطابقة
 * فعل صريح لا نتيجة تلقائية. */
export type RecordCashCountInput = {
  walletId: string;
  countedMinor: number;
  knowledge: CashObservationKnowledge;
  /** قرار المطابقة الصريح: true فقط عند اختيار المالك تسجيل الفرق بتسوية موثقة بسبب. */
  settle: boolean;
  /** سبب التسوية — مطلوب عند settle=true بفرق غير صفري؛ «لم أعرف سبب الفرق» خيار صريح لا افتراضي. */
  reason?: string | null;
  operationKey: string;
};
export type CashCountOutcome =
  /** المرجع مجهول (رصيد افتتاح غير معروف): الرصد يُحفظ قياسًا بلا فرق مقابل صفر وبلا تسوية (SDF-015). */
  | { outcome: "observed"; observation: CashObservation; referenceUnknown: true }
  /** مرجع معروف وفرق صفري: تطابق كامل — لا يُكتب شيء البتة (لا قيد صفري ولا رصد؛ AC08/R09). */
  | { outcome: "match"; referenceMinor: number; countedMinor: number }
  /** مرجع معروف وفرق غير صفري ومطابقة صريحة: الرصد والتسوية يُكتبان معًا بمعنىين مرتبطين (SDF-016: −10 لا −20). */
  | { outcome: "settled"; observation: CashObservation; settlement: CashContinuityEntry }
  /** مرجع معروف وفرق غير صفري بلا قرار تسوية: معاينة فقط — لا كتابة؛ القرار بيد المالك. */
  | { outcome: "difference-preview"; referenceMinor: number; differenceMinor: number };

const id = (prefix: string) =>
  globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const storageFailure = <T>(): CashContinuityResult<T> => ({
  ok: false,
  code: STORAGE_ERROR,
  message: "تعذر حفظ استمرارية الكاش محليًا — بياناتك كما هي؛ أعد المحاولة.",
});

export class CashContinuityService {
  constructor(
    private readonly store: CashContinuityServiceStore,
    private readonly now: Clock = systemClock,
  ) {}

  async overview(): Promise<CashContinuityResult<CashContinuityOverview>> {
    const [wallets, entries] = await Promise.all([
      this.store.listCashWallets(),
      this.store.listCashContinuityEntries(),
    ]);
    if (!wallets.ok || !entries.ok)
      return { ok: false, code: STORAGE_ERROR, message: "تعذر قراءة محافظ الكاش المحلية." };
    const balances = wallets.value.map(wallet => {
      const walletEntries = entries.value.filter(entry => entry.walletId === wallet.id);
      return {
        ...wallet,
        balanceMinor: summarizeCashContinuity(walletEntries),
        entryCount: walletEntries.length,
        openingUnknown: wallet.openingStatus === "unknown",
      };
    });
    return {
      ok: true,
      value: {
        wallets: balances,
        totalWalletCashMinor: balances.reduce((sum, wallet) => sum + wallet.balanceMinor, 0),
        entryCount: entries.value.length,
        unknownOpeningCount: balances.filter(wallet => wallet.openingUnknown).length,
        truth:
          "هذه المحافظ تسجل فقط الافتتاح والتحويلات والضبط والتخصيص الذي ربطته بها. تحصيلات الطلبات والمصاريف والمشتريات السابقة تبقى كاشًا غير موزع إلى أن يسجل لها عقد توزيع صريح.",
      },
    };
  }

  async entries(): Promise<CashContinuityResult<readonly CashContinuityEntry[]>> {
    const result = await this.store.listCashContinuityEntries();
    return result.ok
      ? { ok: true, value: result.value }
      : { ok: false, code: STORAGE_ERROR, message: "تعذر قراءة سجل استمرارية الكاش." };
  }

  /* EXE-008 (حوكمة الكاش — القرار المعتمد): الافتتاح متاح أثناء التأسيس/إنشاء المحفظة
   * فقط، و«الافتتاح اللاحق» مقصور على رفع ختم المجهول لمحفظة أُنشئت بلا رقم —
   * وبعده ضبط كاش موثق بسبب هو الطريق الوحيد. المنع مزدوج الطبقة: هنا في الخدمة،
   * وعمقًا دفاعيًا داخل معاملة المخزن (cashContinuityCommitGuard). */
  async openWallet(
    input: OpenWalletInput,
  ): Promise<CashContinuityResult<{ wallet: CashWallet; opening: CashContinuityEntry | null }>> {
    const [wallets, entries] = await Promise.all([
      this.store.listCashWallets(),
      this.store.listCashContinuityEntries(),
    ]);
    if (!wallets.ok || !entries.ok) return storageFailure();
    const repeatedWallet = wallets.value.find(wallet => wallet.createdOperationKey === input.operationKey);
    const repeatedOpening = entries.value.find(entry => entry.operationKey === input.operationKey);
    if (repeatedWallet)
      return { ok: true, value: { wallet: repeatedWallet, opening: repeatedOpening ?? null }, reused: true };
    try {
      if (!Number.isInteger(input.openingMinor) || input.openingMinor < 0)
        throw new Error("رصيد البداية يجب أن يكون مبلغًا صحيحًا موجبًا أو صفرًا.");
      const wallet = createCashWallet({
        id: id("wallet"),
        name: input.name,
        kind: input.kind,
        createdAt: this.now(),
        createdOperationKey: input.operationKey,
        /* ٥.١: المحفظة المجهولة تُختم «unknown» — لا تُعرض صفرًا صامتًا. */
        openingStatus: input.openingStatus === "unknown" ? "unknown" : "known",
      });
      const opening =
        input.openingMinor === 0 || input.openingStatus === "unknown"
          ? null
          : createCashContinuityEntry({
              id: id("opening"),
              walletId: wallet.id,
              type: "opening_balance",
              occurredOn: input.occurredOn,
              recordedAt: this.now(),
              cashDeltaMinor: input.openingMinor,
              note: input.note,
              operationKey: input.operationKey,
            });
      const saved = await this.store.commitCashContinuity(wallet, opening ? [opening] : []);
      return saved.ok ? { ok: true, value: { wallet, opening } } : storageFailure();
    } catch (error) {
      return validationFailure(errorMessageOf(error, "بيانات محفظة الكاش غير صالحة."));
    }
  }

  /** PA-007: رصيد افتتاحي موثق لاحقًا لمحفظة قائمة — occurredOn للماضي وrecordedAt للآن، ويُرفع ختم المجهول.
   *  EXE-008: ثاني افتتاح لمحفظة معروفة الرصيد ممنوع من هنا ومن المخزن معًا —
   *  المتاح بعده ضبط الكاش الموثق بسبب (CashAdjustmentEditor). */
  async recordOpeningBalanceLater(
    input: RecordOpeningLaterInput,
  ): Promise<CashContinuityResult<CashContinuityEntry>> {
    const [wallets, entries] = await Promise.all([
      this.store.listCashWallets(),
      this.store.listCashContinuityEntries(),
    ]);
    if (!wallets.ok || !entries.ok) return storageFailure();
    const repeated = entries.value.find(entry => entry.operationKey === input.operationKey);
    if (repeated) return { ok: true, value: repeated, reused: true };
    const wallet = wallets.value.find(candidate => candidate.id === input.walletId);
    if (!wallet) return validationFailure("اختر محفظة موجودة قبل إدخال الرصيد.");
    if (entries.value.some(entry => entry.walletId === wallet.id && entry.type === "opening_balance"))
      return validationFailure(
        "لهذه المحفظة رصيد افتتاحي مسجل؛ التسوية اللاحقة تُسجل ضبط كاش بسبب، لا افتتاحًا ثانيًا.",
      );
    try {
      if (!Number.isInteger(input.amountMinor) || input.amountMinor < 0)
        throw new Error("رصيد البداية يجب أن يكون مبلغًا صحيحًا موجبًا أو صفرًا.");
      const entry = createCashContinuityEntry({
        id: id("opening-later"),
        walletId: wallet.id,
        type: "opening_balance",
        occurredOn: input.occurredOn,
        recordedAt: this.now(),
        cashDeltaMinor: input.amountMinor,
        note: input.note,
        operationKey: input.operationKey,
      });
      /* رفع ختم المجهول يُحفظ مع القيد في المعاملة نفسها — ذرّي. */
      const updatedWallet: CashWallet = { ...wallet, openingStatus: "known" };
      const saved = await this.store.commitCashContinuity(updatedWallet, [entry]);
      return saved.ok ? { ok: true, value: entry } : storageFailure();
    } catch (error) {
      return validationFailure(errorMessageOf(error, "بيانات الرصيد الافتتاحي غير صالحة."));
    }
  }

  async adjust(input: AdjustCashInput): Promise<CashContinuityResult<CashContinuityEntry>> {
    const [wallets, entries] = await Promise.all([
      this.store.listCashWallets(),
      this.store.listCashContinuityEntries(),
    ]);
    if (!wallets.ok || !entries.ok) return storageFailure();
    const repeated = entries.value.find(entry => entry.operationKey === input.operationKey);
    if (repeated) return { ok: true, value: repeated, reused: true };
    if (!wallets.value.some(wallet => wallet.id === input.walletId))
      return validationFailure("اختر محفظة كاش موجودة قبل ضبط رصيدها.");
    try {
      const entry = createCashContinuityEntry({
        id: id("adjustment"),
        walletId: input.walletId,
        type: "cash_adjustment",
        occurredOn: input.occurredOn,
        recordedAt: this.now(),
        cashDeltaMinor: input.deltaMinor,
        note: input.note,
        reason: input.reason,
        operationKey: input.operationKey,
      });
      const saved = await this.store.commitCashContinuity(null, [entry]);
      return saved.ok ? { ok: true, value: entry } : storageFailure();
    } catch (error) {
      return validationFailure(errorMessageOf(error, "بيانات ضبط الكاش غير صالحة."));
    }
  }

  async transfer(input: TransferCashInput): Promise<CashContinuityResult<readonly CashContinuityEntry[]>> {
    const [wallets, entries] = await Promise.all([
      this.store.listCashWallets(),
      this.store.listCashContinuityEntries(),
    ]);
    if (!wallets.ok || !entries.ok) return storageFailure();
    const repeated = entries.value.filter(entry => entry.operationKey === input.operationKey);
    if (repeated.length) return { ok: true, value: repeated, reused: true };
    if (
      !wallets.value.some(wallet => wallet.id === input.fromWalletId) ||
      !wallets.value.some(wallet => wallet.id === input.toWalletId)
    )
      return validationFailure("اختر محافظتين موجودتين للتحويل.");
    if (input.fromWalletId === input.toWalletId)
      return validationFailure("لا يمكن التحويل إلى المحفظة نفسها.");
    /* S04 (DOC-013 / UNIT-023 D01 — CONS-DEC03): فحص التغطية قبل الالتزام
     * لمصدر معروف الافتتاح — الرصيد المسجل لا يغطي المبلغ فلا يُكتب شيء
     * برسالة هادئة تدعو لمراجعة الحركات أو اختيار المصدر الصحيح؛ والمصدر
     * مجهول الافتتاح جائز (تحويل مؤكد فعليًا) — المجهول ليس صفرًا ولا
     * سقفًا وهميًا. الحارس داخل حد الكتابة (المحوّلان) يمنع سباق النافذتين.
     */
    const fromWallet = wallets.value.find(wallet => wallet.id === input.fromWalletId);
    if (fromWallet && fromWallet.openingStatus !== "unknown") {
      const sourceBalance = summarizeCashContinuity(
        entries.value.filter(entry => entry.walletId === input.fromWalletId),
      );
      if (sourceBalance < input.amountMinor)
        return validationFailure(
          "الرصيد المسجل لهذا المكان لا يغطي المبلغ. راجع حركاته أو اختر المصدر الصحيح.",
        );
    }
    try {
      const transferId = id("transfer");
      const out = createCashContinuityEntry({
        id: id("transfer-out"),
        walletId: input.fromWalletId,
        type: "transfer_out",
        occurredOn: input.occurredOn,
        recordedAt: this.now(),
        cashDeltaMinor: -input.amountMinor,
        note: input.note,
        operationKey: input.operationKey,
        transferId,
      });
      const into = createCashContinuityEntry({
        id: id("transfer-in"),
        walletId: input.toWalletId,
        type: "transfer_in",
        occurredOn: input.occurredOn,
        recordedAt: this.now(),
        cashDeltaMinor: input.amountMinor,
        note: input.note,
        operationKey: input.operationKey,
        transferId,
      });
      const saved = await this.store.commitCashContinuity(null, [out, into]);
      /* S04 (UNIT-023 D01): حارس التغطية داخل الحد يرفض بـstorage_stale —
       * الرسالة الصادقة للمالك (الرصيد لا يغطي) تصل كما هي لا تُابتلع في
       * فشل تخزين عام؛ سباق النافذتين يُرى تعارض تغطية لا عطلًا غامضًا. */
      if (!saved.ok)
        return saved.code === "storage_stale"
          ? validationFailure(saved.message)
          : storageFailure<readonly CashContinuityEntry[]>();
      return { ok: true, value: [out, into] };
    } catch (error) {
      return validationFailure(errorMessageOf(error, "بيانات التحويل غير صالحة."));
    }
  }

  async reverse(input: ReverseCashInput): Promise<CashContinuityResult<readonly CashContinuityEntry[]>> {
    const entriesResult = await this.store.listCashContinuityEntries();
    if (!entriesResult.ok) return storageFailure();
    const entries = entriesResult.value;
    const repeated = entries.filter(entry => entry.operationKey === input.operationKey);
    if (repeated.length) return { ok: true, value: repeated, reused: true };
    const target = entries.find(entry => entry.id === input.entryId);
    if (!target) return validationFailure("لم نجد أثر الكاش الذي تريد التراجع عنه.");
    if (target.type === "reversal")
      return validationFailure("لا يتراجع هذا الإصدار عن أثر تراجع سابق؛ سجّل ضبط كاش بسبب بدلًا من ذلك.");
    const targets = target.transferId
      ? entries.filter(entry => entry.transferId === target.transferId)
      : [target];
    if (targets.length === 0 || (target.transferId && targets.length !== 2))
      return validationFailure("أثر التحويل غير متوازن ولا يمكن التراجع عنه بأمان.");
    if (targets.some(entry => entries.some(candidate => candidate.reversesEntryId === entry.id)))
      return validationFailure("تم التراجع عن هذا الأثر سابقًا. لا يمكن التراجع عنه مرة ثانية.");
    try {
      const reversalTransferId = target.transferId ? id("reversal-transfer") : null;
      const reversals = targets.map(entry =>
        createCashContinuityEntry({
          id: id("reversal"),
          walletId: entry.walletId,
          type: "reversal",
          occurredOn: input.occurredOn,
          recordedAt: this.now(),
          cashDeltaMinor: -entry.cashDeltaMinor,
          note: `تراجع: ${entry.note}`,
          reason: input.reason,
          operationKey: input.operationKey,
          transferId: reversalTransferId,
          reversesEntryId: entry.id,
        }),
      );
      const saved = await this.store.commitCashContinuity(null, reversals);
      return saved.ok ? { ok: true, value: reversals } : storageFailure();
    } catch (error) {
      return validationFailure(errorMessageOf(error, "بيانات التراجع عن الكاش غير صالحة."));
    }
  }

  /* S04 (DOC-013 / UNIT-025 P3.1/P3.2 + العقد المشترك §6 + SDF-015/016):
   * العدّ والمطابقة — قياس الموجود أولًا، والفرق من مرجع معروف فقط،
   * والمطابقة فعل صريح. المصفوفة الكاملة:
   *  - مرجع مجهول (رصيد افتتاح غير معروف): يُحفظ الرصد قياسًا دائمًا بلا
   *    فرق مقابل صفر وبلا تسوية وبلا تمويل مالك (SDF-015)؛ طلب تسوية على
   *    مرجع مجهول يُرفض بصدق («الرصيد المسجل غير مكتمل») بلا أي كتابة.
   *  - مرجع معروف وفرق صفري: تطابق — لا يُكتب شيء البتة: لا قيد صفري ولا
   *    رصد (R09/AC08)؛ عودة صادقة تُنهي الفحص لا تدّعي حفظًا.
   *  - مرجع معروف وفرق غير صفري مع مطابقة صريحة: الرصد والتسوية
   *    (cash_adjustment بسببه) يُكتبان معًا في حد واحد بمعنيين مرتبطين —
   *    قياس 90 وتسوية نقص 10، لا نقص 20 ولا تمويل سالب (SDF-016)؛ والمرجع
   *    الحي داخل حد الكتابة يمنع تسوية مزدوجة من نافذتين.
   *  - بلا مطابقة: معاينة فقط — لا كتابة؛ القرار بيد المالك.
   * القياس لا يُنشئ نقدًا ولا يمحو حركة ولا يعيد تفسير تسوية قديمة. */
  async recordCashCount(input: RecordCashCountInput): Promise<CashContinuityResult<CashCountOutcome>> {
    const [wallets, entries, observations] = await Promise.all([
      this.store.listCashWallets(),
      this.store.listCashContinuityEntries(),
      this.store.listBalanceObservations(),
    ]);
    if (!wallets.ok || !entries.ok || !observations.ok) return storageFailure();
    const wallet = wallets.value.find(candidate => candidate.id === input.walletId);
    if (!wallet) return validationFailure("اختر مكان نقد موجودًا قبل العدّ.");
    /* عهدة الأمر: الإرسال نفسه يعيد الرصد نفسه لا ثانيًا — المفتاح من المتصل */
    const repeated = observations.value.find(observation => observation.operationKey === input.operationKey);
    if (repeated) {
      /* إعادة النية نفسها: إن كانت تسويتها مسجلة فهي النتيجة الصادقة. */
      const settlement = entries.value.find(entry => entry.operationKey === input.operationKey) ?? null;
      if (settlement)
        return { ok: true, value: { outcome: "settled", observation: repeated, settlement }, reused: true };
      return {
        ok: true,
        value: { outcome: "observed", observation: repeated, referenceUnknown: true },
        reused: true,
      };
    }
    const referenceUnknown = wallet.openingStatus === "unknown";
    const referenceMinor = summarizeCashContinuity(
      entries.value.filter(entry => entry.walletId === wallet.id),
    );
    const differenceMinor = input.countedMinor - referenceMinor;
    if (referenceUnknown && input.settle)
      return validationFailure("الرصيد المسجل غير مكتمل؛ لا يمكن حساب الفرق — سجّل القياس فقط.");
    if (!referenceUnknown && differenceMinor === 0)
      return { ok: true, value: { outcome: "match", referenceMinor, countedMinor: input.countedMinor } };
    /* المعاينة (لا كتابة) لم المرجع المعروف وفرق غير صفري بلا قرار تسوية —
     * أما المرجع المجهول فيتجاوز المعاينة إلى حفظ القياس وحده (SDF-015). */
    if (!referenceUnknown && !input.settle)
      return { ok: true, value: { outcome: "difference-preview", referenceMinor, differenceMinor } };
    /* السبب الموثق مطلوب للتسوية وحدها — القياس بلا تسوية لا يطلب سببًا. */
    const settledReason = referenceUnknown ? null : (input.reason?.trim() ?? "");
    if (!referenceUnknown && !settledReason)
      return validationFailure("تسجيل فرق العدّ يتطلب سببًا موثقًا — «لم أعرف سبب الفرق» خيار صريح.");
    try {
      const cutoff = this.now();
      const observation = createCashObservation({
        id: id("observation"),
        scopeKind: "wallet",
        walletId: wallet.id,
        countedMinor: input.countedMinor,
        knowledge: input.knowledge,
        cutoff,
        observedOn: todayInAmman(this.now),
        recordedAt: cutoff,
        operationKey: input.operationKey,
        note: `رصد عدّ في ${wallet.name}`,
        walletKind: wallet.kind,
      });
      const settlement = referenceUnknown
        ? null
        : createCashContinuityEntry({
            id: id("count-settlement"),
            walletId: wallet.id,
            type: "cash_adjustment",
            occurredOn: todayInAmman(this.now),
            recordedAt: cutoff,
            cashDeltaMinor: differenceMinor,
            note: cashCountSettlementNote(input.countedMinor),
            reason: settledReason,
            operationKey: input.operationKey,
          });
      const saved = await this.store.commitCashObservation(
        observation,
        settlement,
        referenceUnknown ? null : referenceMinor,
      );
      if (!saved.ok)
        return saved.code === "storage_stale"
          ? { ok: false, code: "storage_error", message: saved.message }
          : storageFailure<CashCountOutcome>();
      /* الحد يضمن الافراد: التسوية المطلوبة مكتوبة مع رصدها أو رُفضت المعاملة
       * كلها — لا نصف حالة يعاد تركيبه هنا. */
      if (settlement && saved.value.settlement)
        return {
          ok: true,
          value: {
            outcome: "settled",
            observation: saved.value.observation,
            settlement: saved.value.settlement,
          },
          reused: saved.value.reused,
        };
      return {
        ok: true,
        value: { outcome: "observed", observation: saved.value.observation, referenceUnknown: true },
        reused: saved.value.reused,
      };
    } catch (error) {
      return validationFailure(errorMessageOf(error, "بيانات العدّ غير صالحة."));
    }
  }
}
