import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone
    ) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstall = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      toast.success("AION Vision Hub installed successfully");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      console.log("[AION PWA] User accepted install prompt");
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  useEffect(() => {
    if (!deferredPrompt || isInstalled) return;
    const timer = setTimeout(() => {
      toast("Install AION Vision Hub", {
        description:
          "Get quick access from your home screen with offline support.",
        duration: 15000,
        action: {
          label: "Install",
          onClick: handleInstall,
        },
        cancel: {
          label: "Not now",
          onClick: () => {},
        },
      });
    }, 30000);
    return () => clearTimeout(timer);
  }, [deferredPrompt, isInstalled, handleInstall]);

  return null;
}
