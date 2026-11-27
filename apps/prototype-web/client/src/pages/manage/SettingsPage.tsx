/**
 * M5.2 (UX P-11 «الإعدادات»): تعديل اسم المشروع (R-17 — بلا أثر مالي).
 * المحتوى الحرفي: عنوان «الإعدادات» + حقل «اسم المشروع» معبّى بالاسم
 * الحالي + «حفظ» ← P-10. لا إعدادات صناديق هنا (مكانها P-37).
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button, Notice } from "@/components/primitives";
import { t } from "@/application/manage/strings";
import { manageErrorText } from "@/application/manage/presentation";
import { fetchManageProject, renameProject } from "@/application/manage/api";

export default function ManageSettingsPage() {
  const [, navigate] = useLocation();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchManageProject()
      .then(project => {
        setName(project.name);
        setLoading(false);
      })
      .catch(() => {
        /* لا مشروع: الإعدادات بلا معنى — عودة للفتح (سيقود إلى P-01). */
        navigate("/");
      });
  }, [navigate]);

  async function onSave() {
    setFormError(null);
    if (name.trim().length === 0) {
      setNameError(t("E-NAME-REQUIRED"));
      return;
    }
    setNameError(null);
    setSaving(true);
    try {
      await renameProject(name.trim());
      /* بعد الحفظ: رجوع لمصدر الفتح — بلا رسالة نجاح (قاعدة عامة). */
      navigate("/");
    } catch (error) {
      setFormError(manageErrorText(error));
      setSaving(false);
    }
  }

  return (
    <div className="micro-manage-sheet" dir="rtl">
      <h1 className="micro-manage-sheet__title">{t("t.settings")}</h1>
      <div className="micro-manage-sheet__body">
        {loading ? (
          <span className="micro-manage-page__loading" />
        ) : (
          <div className="micro-manage-field">
            <label className="micro-manage-field__label" htmlFor="manage-settings-name">
              {t("t.project_name")}
            </label>
            <input
              id="manage-settings-name"
              data-testid="manage-settings-name"
              type="text"
              value={name}
              autoComplete="off"
              onChange={event => setName(event.target.value)}
              className="micro-manage-field__input"
            />
            {nameError ? (
              <p className="micro-manage-field__error" role="alert">
                {nameError}
              </p>
            ) : null}
            {formError ? (
              <Notice tone="error" role="alert">
                {formError}
              </Notice>
            ) : null}
          </div>
        )}
      </div>
      <div className="micro-manage-sheet__save">
        <Button action="save" block disabled={loading} loading={saving} onClick={onSave}>
          {t("a.save")}
        </Button>
      </div>
    </div>
  );
}
