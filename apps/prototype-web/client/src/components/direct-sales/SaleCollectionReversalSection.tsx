/**
 * EXE-010 (AUD-NEW-04): قسم «عكس التحصيل» في محرر البيع المباشر — إجراء صريح
 * بسبب إلزامي يعكس تحصيلًا مخصصًا على محفظة بخطوة موثقة واحدة: السجل يتعدل
 * بمراجعة عكس، وقيد المحفظة يُفك بقيد مرآة مرتبط بالأصل (reversesEntryId)،
 * والذمم تعود بقوتها. المرجع القانوني هو التخصيص نفسه — لا مطابقة بالمبلغ.
 * التحصيلات غير المخصصة (كاش غير موزع) تُصحح من تعديل المقبوض في المحرر —
 * المسار الآمن أصلًا لأن الكاش كله في غير الموزع.
 */
import { Undo2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { DirectSale } from "@micro-domain/direct-sale/index.js";
import type {
  ReversibleSaleCollection,
  SaleCollectionReversalPreview,
  SaleCollectionReversalService,
} from "@/application/collections/saleCollectionReversalService";
import { formatLocalDate, formatMoneyMinor } from "@/presentation/formatters";

import { Button } from "@/components/primitives";

const freshOperationKey = () => `sale-collect-reverse-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;

export function SaleCollectionReversalSection({
  saleId,
  saleStatus,
  saleCollectionReversal,
  dataVersion,
  notifyDataChanged,
}: {
  saleId: string | null;
  saleStatus: DirectSale["status"];
  saleCollectionReversal: SaleCollectionReversalService;
  dataVersion: number;
  notifyDataChanged: () => void;
}) {
  const [collections, setCollections] = useState<readonly ReversibleSaleCollection[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState("");
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<SaleCollectionReversalPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const operationKeyRef = useRef(freshOperationKey());

  useEffect(() => {
    if (!saleId || saleStatus === "cancelled") return;
    let active = true;
    void saleCollectionReversal.listReversibleCollections(saleId).then(result => {
      if (!active) return;
      if (result.ok) {
        setCollections(result.value);
        setSelectedEntryId(current => current || (result.value[0]?.allocationEntryId ?? ""));
      } else setMessage(result.message);
    });
    return () => {
      active = false;
    };
  }, [saleId, saleStatus, saleCollectionReversal, dataVersion]);

  useEffect(() => {
    if (!saleId || !selectedEntryId) {
      setPreview(null);
      return;
    }
    let active = true;
    void saleCollectionReversal.preview({ saleId, allocationEntryId: selectedEntryId }).then(result => {
      if (!active) return;
      if (result.ok) setPreview(result.value);
      else {
        setPreview(null);
        setMessage(result.message);
      }
    });
    return () => {
      active = false;
    };
  }, [saleId, selectedEntryId, saleCollectionReversal, dataVersion]);

  if (!saleId || saleStatus === "cancelled" || collections.length === 0) return null;

  async function reverse() {
    if (!saleId || !selectedEntryId) return;
    if (!reason.trim()) {
      setMessage("أكمل سبب عكس التحصيل قبل الحفظ.");
      return;
    }
    setBusy(true);
    const result = await saleCollectionReversal.reverse({
      saleId,
      allocationEntryId: selectedEntryId,
      reason,
      operationKey: operationKeyRef.current,
    });
    setBusy(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    operationKeyRef.current = freshOperationKey();
    setReason("");
    setMessage(
      result.reused
        ? "العكس محفوظ سابقًا؛ لم يتكرر الأثر."
        : "تم عكس التحصيل: المقبوض نقص، وتوزيع المحفظة فُك بقيد مرتبط بالأصل، والذمم عادت.",
    );
    notifyDataChanged();
  }

  return (
    <details className="micro-owner-layer" data-testid="sale-collection-reversal">
      <summary className="micro-owner-layer-summary">
        <span>
          <b>عكس تحصيل</b>
          <small>قبضت على محفظة خطأ؟ اعكسه بخطوة موثقة واحدة تصحح التوزيع أيضًا</small>
        </span>
        <strong>افتح العكس</strong>
      </summary>
      <section className="micro-form-card">
        <div className="micro-decision-card">
          <Undo2 aria-hidden="true" />
          <div>
            <span>حد الحقيقة</span>
            <strong>العكس يصحح السجل والتوزيع معًا — ولا يحذف شيئًا.</strong>
            <p>
              التحصيل الأصلي يبقى ظاهرًا في سجل التصحيحات ودفتر المحفظة، والعكس يرتبط به بقيد مرآة. التحصيلات
              المسجلة على الكاش غير الموزع تُصحح من تعديل المقبوض أعلاه — لا تحتاج عكسًا هنا.
            </p>
          </div>
        </div>
        <label className="micro-field">
          <span>التحصيل المُراد عكسه</span>
          <select value={selectedEntryId} onChange={event => setSelectedEntryId(event.target.value)}>
            {collections.map(collection => (
              <option key={collection.allocationEntryId} value={collection.allocationEntryId}>
                {formatLocalDate(collection.recordedAt) ?? collection.recordedAt} ·{" "}
                {formatMoneyMinor(collection.amountMinor)} د.أ — {collection.walletName}
              </option>
            ))}
          </select>
        </label>
        {preview && preview.status === "full_match" && preview.allocation ? (
          <div className="micro-finance-reversal-review" data-testid="sale-reversal-preview">
            <strong>معاينة أثر العكس</strong>
            <dl>
              <div>
                <dt>المقبوض على البيع</dt>
                <dd>
                  {formatMoneyMinor(preview.collectedBeforeMinor)} ←{" "}
                  {formatMoneyMinor(preview.collectedAfterMinor ?? 0)} د.أ
                </dd>
              </div>
              <div>
                <dt>المتبقي (الذمم)</dt>
                <dd>
                  {formatMoneyMinor(preview.receivableBeforeMinor)} ←{" "}
                  {formatMoneyMinor(preview.receivableAfterMinor ?? 0)} د.أ
                </dd>
              </div>
              <div>
                <dt>رصيد المحفظة «{preview.allocation.walletName}»</dt>
                <dd>
                  {formatMoneyMinor(preview.walletBalanceBeforeMinor ?? 0)} ←{" "}
                  {formatMoneyMinor(preview.walletBalanceAfterMinor ?? 0)} د.أ
                </dd>
              </div>
              <div>
                <dt>الكاش المسجل</dt>
                <dd>
                  {preview.recordedCashBeforeMinor === null
                    ? "—"
                    : `${formatMoneyMinor(preview.recordedCashBeforeMinor)} ← ${formatMoneyMinor(preview.recordedCashAfterMinor ?? 0)} د.أ`}
                </dd>
              </div>
            </dl>
            {preview.walletWarning ? (
              <p className="micro-field-error" role="alert">
                {preview.walletWarning}
              </p>
            ) : null}
          </div>
        ) : null}
        {preview && preview.status !== "full_match" && preview.refusalReason ? (
          <p className="micro-field-error" role="alert">
            {preview.refusalReason}
          </p>
        ) : null}
        <label className="micro-field">
          <span>
            سبب العكس <small>مطلوب</small>
          </span>
          <input
            value={reason}
            onChange={event => setReason(event.target.value)}
            placeholder="مثال: القبض سُجل على البيع الخطأ"
          />
        </label>
        {message ? (
          <p className="micro-field-error" role="status">
            {message}
          </p>
        ) : null}
        <Button action="save" disabled={busy} onClick={() => void reverse()}>
          <Undo2 aria-hidden="true" /> اعكس التحصيل
        </Button>
      </section>
    </details>
  );
}
