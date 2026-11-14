/**
 * EX-D23 (M3 — 2026-11-14): قسم «ربط Manage المتصل» داخل ملف الحساب —
 * أصغر حد تطبيقي متوافق يوصل الشاشة القائمة (ملف المالك) بحالة الخادم:
 * الحالة الصادقة لكل مساحة (مهيأة/معطلة/ربط)، مسار الربط المزدوج
 * (سر يُولَّد داخل Manage هنا + تأكيد ثانٍ داخل الجلسة)، وحالة بيانات
 * الخادم (غير مهاجرة بعد = الصدق؛ اللقطة المحلية تبقى مصدر العمل).
 * لا كتابة محلية إطلاقًا من هذا القسم؛ والمطابقة بالبريد ممنوعة بنيويًا.
 */
import { Link2, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  confirmManageLink,
  fetchManageFamilies,
  fetchManageOnlineState,
  generateManageProofSecret,
  startManageLink,
  unlinkManage,
  type ManageLinkStartResult,
  type ManageOnlineState,
} from "@/application/network";
import { Button } from "@/components/primitives";

type LinkPhase =
  | { step: "idle" }
  | { step: "starting" }
  | { step: "pending"; pending: ManageLinkStartResult }
  | { step: "confirming"; pending: ManageLinkStartResult }
  | { step: "unlinked-refresh" };

export function ManageOnlineSection() {
  const [state, setState] = useState<ManageOnlineState | null>(null);
  const [stateLoading, setStateLoading] = useState(true);
  const [stateFailed, setStateFailed] = useState(false);
  const [phase, setPhase] = useState<LinkPhase>({ step: "idle" });
  const [proof, setProof] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [familiesText, setFamiliesText] = useState<string | null>(null);
  const [familiesLoading, setFamiliesLoading] = useState(false);

  const loadState = useCallback(async () => {
    setStateLoading(true);
    setStateFailed(false);
    try {
      setState(await fetchManageOnlineState());
    } catch {
      setState(null);
      setStateFailed(true);
    } finally {
      setStateLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const linked = state?.workspaces.some(w => w.linkStatus === "linked") ?? false;

  const loadFamilies = useCallback(async () => {
    setFamiliesLoading(true);
    try {
      const families = await fetchManageFamilies();
      setFamiliesText(
        families.totalRecords === 0
          ? "الخادم لا يحمل بيانات مهاجرة بعد — نسختك المحلية على هذا الجهاز هي مصدر العمل."
          : `الخادم يحمل ${families.totalRecords} سجلًا مهاجرًا في ${families.families.length} عائلة.`,
      );
    } catch (error) {
      setFamiliesText(error instanceof ApiError ? error.message : "تعذر قراءة حالة بيانات الخادم الآن.");
    } finally {
      setFamiliesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (linked) void loadFamilies();
  }, [linked, loadFamilies]);

  async function beginLink(): Promise<void> {
    setActionError(null);
    setPhase({ step: "starting" });
    try {
      const pending = await startManageLink(proof);
      setPhase({ step: "pending", pending });
    } catch (error) {
      setPhase({ step: "idle" });
      setActionError(error instanceof ApiError ? error.message : "تعذر بدء الربط الآن.");
    }
  }

  async function confirmLink(nonce: string): Promise<void> {
    setActionError(null);
    setPhase(current =>
      current.step === "pending" ? { step: "confirming", pending: current.pending } : current,
    );
    try {
      await confirmManageLink(nonce);
      setPhase({ step: "idle" });
      setProof("");
      await loadState();
    } catch (error) {
      setPhase(current =>
        current.step === "confirming" ? { step: "pending", pending: current.pending } : current,
      );
      setActionError(error instanceof ApiError ? error.message : "تعذر تأكيد الربط الآن.");
    }
  }

  async function unlink(): Promise<void> {
    setActionError(null);
    setPhase({ step: "unlinked-refresh" });
    try {
      await unlinkManage();
      setFamiliesText(null);
      await loadState();
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "تعذر فك الربط الآن.");
    } finally {
      setPhase({ step: "idle" });
    }
  }

  function generateProof(): void {
    setActionError(null);
    try {
      setProof(generateManageProofSecret());
    } catch {
      setActionError("تعذر توليد السر في هذا المتصفح — أعد المحاولة.");
    }
  }

  return (
    <section
      className="micro-profile-account"
      aria-label="ربط Manage المتصل"
      data-testid="manage-online-section"
    >
      <h2>ربط Manage المتصل</h2>
      {stateLoading ? (
        <p role="status">جارٍ قراءة حالة الربط…</p>
      ) : stateFailed ? (
        <>
          <p role="alert">تعذر قراءة حالة ربط Manage الآن — بيانات مشروعك المحلية سليمة.</p>
          <Button action="quiet" onClick={() => void loadState()}>
            إعادة المحاولة
          </Button>
        </>
      ) : state === null || state.workspaces.length === 0 ? (
        <p>لا توجد مساحة عمل متصلة لحسابك بعد — تُنشأ تلقائيًا مع أول فعل عمل متصل.</p>
      ) : state.workspaces.every(w => !w.manageEnabled) ? (
        <p data-testid="manage-capability-disabled">
          قدرة Manage غير مفعلة لمساحة عملك بعد — تفعيلها خطوة مشغل بعد تطبيق المخطط والتحقق منه.
        </p>
      ) : linked ? (
        <>
          <p data-testid="manage-linked" className="micro-save-note" role="status">
            ربط موثق قائم: هذا الحساب هو مالك Manage لهذه المساحة (بإثبات ملكية موثق، لا بمطابقة البريد).
          </p>
          <p role="status">{familiesLoading ? "جارٍ قراءة حالة بيانات الخادم…" : familiesText}</p>
          <div className="micro-form-actions">
            <Button
              action="secondary"
              disabled={phase.step === "unlinked-refresh"}
              onClick={() => void unlink()}
            >
              فك الربط
            </Button>
          </div>
        </>
      ) : state.workspaces.some(w => w.linkStatus === "taken") ? (
        <p data-testid="manage-link-taken">
          هذه المساحة لها مالك Manage مربوط بالفعل — لا يمكن ربط مالك ثانٍ.
        </p>
      ) : phase.step === "pending" || phase.step === "confirming" ? (
        <>
          <p role="status" data-testid="manage-link-pending">
            طلب ربط قائم بانتظار التأكيد الثاني داخل هذه الجلسة — تنتهي مهلته خلال ١٥ دقيقة.
          </p>
          <div className="micro-form-actions">
            <Button
              action="save"
              disabled={phase.step === "confirming"}
              onClick={() => void confirmLink(phase.step === "pending" ? phase.pending.nonce : "")}
            >
              {phase.step === "confirming" ? "جارٍ التأكيد…" : "أكّد الربط"}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p>
            اربط مالك هذا الجهاز بحسابك عبر إثبات ملكية موثق: ولّد سرًا هنا، انسخه واحتفظ به، ثم ابدأ الربط
            وأكّده.
          </p>
          <label className="micro-field">
            <span>سر إثبات الملكية</span>
            <input
              value={proof}
              onChange={event => setProof(event.target.value)}
              placeholder="ولّد سرًا ثم انسخه واحتفظ به"
              inputMode="text"
              dir="ltr"
              lang="en"
              data-testid="manage-proof-input"
            />
            <small>يُولَّد داخل Manage على هذا الجهاز — لا يُخزن ولا يدخل ملف التصدير أبدًا.</small>
          </label>
          <div className="micro-form-actions">
            <Button action="secondary" onClick={generateProof}>
              ولّد سرًا
            </Button>
            <Button
              action="save"
              disabled={phase.step === "starting" || proof.trim().length < 32}
              onClick={() => void beginLink()}
            >
              {phase.step === "starting" ? "جارٍ البدء…" : "ابدأ الربط"}
            </Button>
          </div>
        </>
      )}
      {actionError ? (
        <p className="micro-field-error" role="alert">
          {actionError}
        </p>
      ) : null}
      <p className="micro-profile-future-note">
        <Link2 aria-hidden="true" /> الربط لا ينقل بياناتك ولا يوقف عملك المحلي — الترحيل خطوة مستقلة بموافقة
        موثقة، <ShieldCheck aria-hidden="true" /> ونسختك المحلية تبقى مصدر العمل والاسترداد.
      </p>
    </section>
  );
}
