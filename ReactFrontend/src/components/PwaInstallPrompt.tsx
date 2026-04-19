import { useEffect, useMemo, useState } from "react";
import AppIcon from "./AppIcon";
import "./PwaInstallPrompt.css";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
}

const DISMISS_KEY = "rp_pwa_install_dismissed_at";
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 3;

function isStandaloneMode() {
  if (window.matchMedia("(display-mode: standalone)").matches) {
    return true;
  }
  const iosNavigator = window.navigator as Navigator & { standalone?: boolean };
  return iosNavigator.standalone === true;
}

function wasDismissedRecently() {
  const rawValue = window.localStorage.getItem(DISMISS_KEY);
  if (!rawValue) {
    return false;
  }
  const parsed = Number(rawValue);
  if (Number.isNaN(parsed)) {
    return false;
  }
  return Date.now() - parsed < DISMISS_TTL_MS;
}

export default function PwaInstallPrompt() {
  const [installPromptEvent, setInstallPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const shouldShow = useMemo(
    () => Boolean(installPromptEvent) && isVisible,
    [installPromptEvent, isVisible],
  );

  useEffect(() => {
    if (isStandaloneMode()) {
      return undefined;
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      const installEvent = event as BeforeInstallPromptEvent;
      installEvent.preventDefault();
      setInstallPromptEvent(installEvent);

      if (!wasDismissedRecently()) {
        setIsVisible(true);
      }
    };

    const handleAppInstalled = () => {
      setInstallPromptEvent(null);
      setIsVisible(false);
      window.localStorage.removeItem(DISMISS_KEY);
    };

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt as EventListener,
    );
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt as EventListener,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
  };

  const handleInstall = async () => {
    if (!installPromptEvent) {
      return;
    }

    try {
      await installPromptEvent.prompt();
      const result = await installPromptEvent.userChoice;

      if (result.outcome === "accepted") {
        setIsVisible(false);
        window.localStorage.removeItem(DISMISS_KEY);
      } else {
        handleDismiss();
      }
    } finally {
      setInstallPromptEvent(null);
    }
  };

  if (!shouldShow) {
    return null;
  }

  return (
    <section className="pwa-install-banner" aria-live="polite" role="dialog">
      <div className="pwa-install-banner-icon">
        <AppIcon name="basketball" size={18} />
      </div>
      <div className="pwa-install-banner-copy">
        <h3>Add RefereePoint To Home Screen</h3>
        <p>
          Install the app for faster access, offline basics, and a cleaner
          mobile experience.
        </p>
      </div>
      <div className="pwa-install-banner-actions">
        <button
          type="button"
          className="pwa-install-banner-dismiss"
          onClick={handleDismiss}
        >
          Not now
        </button>
        <button
          type="button"
          className="pwa-install-banner-confirm"
          onClick={handleInstall}
        >
          Install app
        </button>
      </div>
    </section>
  );
}

