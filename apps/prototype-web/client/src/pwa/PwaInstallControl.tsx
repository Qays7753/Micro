import { Download, Share, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  type BeforeInstallPromptEvent,
  isBeforeInstallPromptEvent,
  isIosSafari,
  isStandaloneMode,
} from "./install";

export function PwaInstallControl() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(true);
  const [isIos, setIsIos] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isPrompting, setIsPrompting] = useState(false);

  useEffect(() => {
    setIsStandalone(isStandaloneMode());
    setIsIos(isIosSafari());

    function handleBeforeInstallPrompt(event: Event) {
      if (!isBeforeInstallPromptEvent(event) || isStandaloneMode()) return;
      event.preventDefault();
      setPromptEvent(event);
      setIsDismissed(false);
    }

    function handleAppInstalled() {
      setPromptEvent(null);
      setIsStandalone(true);
      setIsDismissed(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function promptForInstall() {
    if (!promptEvent) return;
    setIsPrompting(true);
    try {
      await promptEvent.prompt();
      await promptEvent.userChoice;
      setPromptEvent(null);
      setIsDismissed(true);
    } finally {
      setIsPrompting(false);
    }
  }

  const showAndroidInstall = Boolean(promptEvent) && !isStandalone && !isDismissed;
  const showIosInstructions = isIos && !isStandalone && !showAndroidInstall && !isDismissed;
  if (!showAndroidInstall && !showIosInstructions) return null;

  return (
    <aside className="micro-install-control" aria-live="polite">
      <div className="micro-install-card" data-platform={showAndroidInstall ? "chromium" : "ios"}>
        <span className="micro-install-icon" aria-hidden="true">
          {showAndroidInstall ? <Download /> : <Share />}
        </span>
        <div className="micro-install-copy">
          <h2>{showAndroidInstall ? "ثبّت Micro على جهازك" : "أضف Micro إلى الشاشة الرئيسية"}</h2>
          <p>
            {showAndroidInstall
              ? "يفتح أسرع ويظل متاحًا بعد الزيارة الأولى. سيظهر تأكيد النظام عند اختيار التثبيت."
              : "في Safari اضغط زر المشاركة ثم اختر «إضافة إلى الشاشة الرئيسية»."}
          </p>
        </div>
        <div className="micro-install-actions">
          {showAndroidInstall ? (
            <button
              className="micro-button micro-button-primary"
              type="button"
              disabled={isPrompting}
              onClick={promptForInstall}
            >
              <Download aria-hidden="true" />
              {isPrompting ? "جارٍ فتح تأكيد النظام…" : "تثبيت Micro"}
            </button>
          ) : null}
          <button
            className="micro-icon-button"
            type="button"
            onClick={() => setIsDismissed(true)}
            aria-label="ليس الآن"
            title="ليس الآن"
          >
            <X aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
}
