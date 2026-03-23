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
      console.error("[PWA] Registration error:", error);
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
      toast.success("Clave Seguridad listo para uso offline", {
        duration: 4000,
      });
      setOfflineReady(false);
    }
  }, [offlineReady, setOfflineReady]);

  useEffect(() => {
    if (needRefresh) {
      toast("Nueva versión disponible", {
        description: "Haz clic en Actualizar para obtener las últimas mejoras.",
        duration: Infinity,
        action: {
          label: "Actualizar",
          onClick: handleUpdate,
        },
        cancel: {
          label: "Después",
          onClick: handleDismiss,
        },
      });
    }
  }, [needRefresh, handleUpdate, handleDismiss]);

  return null;
}
