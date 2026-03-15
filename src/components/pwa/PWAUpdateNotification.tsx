import { useRegisterSW } from "virtual:pwa-register/react";
import { toast } from "sonner";
import { useEffect, useCallback } from "react";

const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000; // 60 minutes

export function PWAUpdateNotification() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        setInterval(() => {
          registration.update();
        }, UPDATE_CHECK_INTERVAL);
      }
    },
    onRegisterError(error) {
      console.error("[AION PWA] Registration error:", error);
    },
  });

  const handleUpdate = useCallback(() => {
    updateServiceWorker(true);
  }, [updateServiceWorker]);

  const handleDismiss = useCallback(() => {
    setNeedRefresh(false);
  }, [setNeedRefresh]);

  useEffect(() => {
    if (offlineReady) {
      toast.success("AION Vision Hub ready for offline use", {
        duration: 4000,
      });
      setOfflineReady(false);
    }
  }, [offlineReady, setOfflineReady]);

  useEffect(() => {
    if (needRefresh) {
      toast("New version available", {
        description: "Click Update to get the latest features and fixes.",
        duration: Infinity,
        action: {
          label: "Update",
          onClick: handleUpdate,
        },
        cancel: {
          label: "Later",
          onClick: handleDismiss,
        },
      });
    }
  }, [needRefresh, handleUpdate, handleDismiss]);

  return null;
}
