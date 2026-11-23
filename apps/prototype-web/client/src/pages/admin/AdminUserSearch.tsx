/**
 * Post-Group 6 continuous completion (G02 — Q129): قسم «البحث عن مستخدم»
 * داخل لوحة المشرف — البحث بالاسم/البريد/الهاتف مع الحالة الصادقة
 * للأدوار والإيقاف، وإيقاف هوية كاملة بسبب إلزامي مكتوب بتأكيد صريح.
 * جزء من وحدة لوحة المشرف المنفصلة (pages/admin).
 */
import { useState } from "react";
import { searchAdminUsers, suspendAdminIdentity, type AdminUserResult } from "@/application/admin";
import { ApiError } from "@/application/network";
import { Button } from "@/components/primitives";

export function AdminUserSearch({ onActioned }: { onActioned: () => void }) {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AdminUserResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<AdminUserResult | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function runSearch(): Promise<void> {
    if (query.trim().length < 2) return;
    setSearching(true);
    setSearchError(null);
    try {
      setSearchResults(await searchAdminUsers(query.trim()));
    } catch (cause) {
      setSearchError(cause instanceof ApiError ? cause.message : "تعذر البحث الآن — أعد المحاولة.");
    } finally {
      setSearching(false);
    }
  }

  async function runSuspend(): Promise<void> {
    if (!suspendTarget || suspendReason.trim().length < 4) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await suspendAdminIdentity(suspendTarget.identityId, suspendReason.trim());
      setBusy(false);
      setNotice(`أُوقفت هوية ${suspendTarget.displayName} — جلساتها ملغاة والدخول مرفوض بسببها المسجل.`);
      setSuspendTarget(null);
      setSuspendReason("");
      setSearchResults(null);
      onActioned();
    } catch (cause) {
      setBusy(false);
      setError(cause instanceof ApiError ? cause.message : "تعذر إيقاف الهوية الآن — أعد المحاولة.");
    }
  }

  return (
    <section className="micro-admin-section" aria-labelledby="admin-search-title">
      <h2 id="admin-search-title">البحث عن مستخدم</h2>
      <form
        className="micro-admin-search"
        onSubmit={event => {
          event.preventDefault();
          void runSearch();
        }}
      >
        <label className="micro-field">
          <span>الاسم أو البريد أو الهاتف</span>
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="مثال: +962790000000"
            dir="auto"
          />
        </label>
        <Button action="secondary" type="submit" loading={searching} disabled={query.trim().length < 2}>
          ابحث
        </Button>
      </form>
      {searchError ? (
        <p className="micro-field-error" role="alert">
          {searchError}
        </p>
      ) : null}
      {searchResults !== null ? (
        searchResults.length === 0 ? (
          <p role="status">لا نتائج مطابقة.</p>
        ) : (
          <ul className="micro-admin-users" data-testid="admin-search-results">
            {searchResults.map(user => (
              <li key={user.identityId}>
                <div>
                  <strong>{user.displayName}</strong> — <bdi dir="ltr">{user.email}</bdi>
                  <div className="micro-admin-user-state">
                    {user.isAdmin ? "حساب إدارة" : null}
                    {user.vendorStatus !== null ? `مورد (${user.vendorStatus})` : null}
                    {user.driverStatus !== null ? `سائق (${user.driverStatus})` : null}
                    {user.suspended ? `موقوف: ${user.suspensionReason ?? ""}` : "غير موقوف"}
                  </div>
                </div>
                {!user.suspended && !user.isAdmin ? (
                  <Button
                    action="secondary"
                    disabled={busy}
                    onClick={() => {
                      setSuspendTarget(user);
                      setSuspendReason("");
                      setError(null);
                    }}
                  >
                    أوقف الهوية
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )
      ) : null}
      {suspendTarget ? (
        <div className="micro-confirm-box" role="alertdialog" aria-label="تأكيد إيقاف الهوية">
          <p>
            إيقاف هوية <strong>{suspendTarget.displayName}</strong> كاملة بسبب مكتوب — تُلغى جلساتها فورًا
            ويرفض دخولها بالسبب نفسه. لا يُلغى أي حجز جارٍ تلقائيًا (الحجز يكتمل)؛ الإلغاء الإداري فعل منفصل
            أدناه.
          </p>
          <label className="micro-field">
            <span>السبب (إلزامي)</span>
            <input
              value={suspendReason}
              onChange={event => setSuspendReason(event.target.value)}
              placeholder="مثال: خطر على الناس — بلاغ موثق"
            />
          </label>
          <div className="micro-form-actions">
            <Button action="quiet" disabled={busy} onClick={() => setSuspendTarget(null)}>
              تراجع
            </Button>
            <Button
              action="commit"
              disabled={busy || suspendReason.trim().length < 4}
              onClick={() => void runSuspend()}
            >
              {busy ? "جارٍ الإيقاف…" : "نفّذ الإيقاف"}
            </Button>
          </div>
        </div>
      ) : null}
      {notice ? (
        <p className="micro-save-note" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="micro-field-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
