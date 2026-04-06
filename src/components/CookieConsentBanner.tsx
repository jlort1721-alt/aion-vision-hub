import { useState, useEffect, useCallback } from 'react';
import { Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/contexts/I18nContext';

const STORAGE_KEY = 'aion-cookie-consent';

export interface CookieConsent {
  essential: boolean;
  analytics: boolean;
  timestamp: string;
}

export function useCookieConsent() {
  const [consent, setConsent] = useState<CookieConsent | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const hasConsented = consent !== null;

  const save = useCallback((c: CookieConsent) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
    setConsent(c);
  }, []);

  const acceptAll = useCallback(() => {
    save({ essential: true, analytics: true, timestamp: new Date().toISOString() });
  }, [save]);

  const acceptEssential = useCallback(() => {
    save({ essential: true, analytics: false, timestamp: new Date().toISOString() });
  }, [save]);

  return { hasConsented, consent, acceptAll, acceptEssential, save };
}

export default function CookieConsentBanner() {
  const { t } = useI18n();
  const { hasConsented, acceptAll, acceptEssential, save } = useCookieConsent();
  const [visible, setVisible] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);

  useEffect(() => {
    if (!hasConsented) {
      // Small delay so the slide-up animation is visible
      const timer = setTimeout(() => setVisible(true), 100);
      return () => clearTimeout(timer);
    }
  }, [hasConsented]);

  if (hasConsented || !visible) return null;

  const handleAcceptAll = () => {
    acceptAll();
    setVisible(false);
  };

  const handleEssentialOnly = () => {
    acceptEssential();
    setVisible(false);
  };

  const handleSavePreferences = () => {
    save({ essential: true, analytics: analyticsEnabled, timestamp: new Date().toISOString() });
    setVisible(false);
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up"
      style={{ animation: 'slideUp 0.4s ease-out' }}
    >
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      <div
        className="backdrop-blur-md border-t border-white/10"
        style={{ backgroundColor: 'rgba(13, 27, 42, 0.95)' }}
      >
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-5">
          {/* Main banner */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            {/* Icon + text */}
            <div className="flex gap-3 flex-1 min-w-0">
              <Shield className="h-6 w-6 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold text-white">
                  {t('cookie.banner_title')}
                </h3>
                <p className="text-xs text-gray-300 leading-relaxed">
                  {t('cookie.banner_text')}
                </p>
                <div className="flex gap-3 text-xs">
                  <a href="/privacy" className="text-red-400 hover:text-red-300 underline underline-offset-2 transition-colors">
                    {t('cookie.privacy_link')}
                  </a>
                  <a href="/cookies" className="text-red-400 hover:text-red-300 underline underline-offset-2 transition-colors">
                    {t('cookie.cookie_link')}
                  </a>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:shrink-0">
              <Button
                onClick={handleAcceptAll}
                className="text-xs font-medium text-white"
                style={{ backgroundColor: '#C8232A' }}
                size="sm"
              >
                {t('cookie.accept_all')}
              </Button>
              <Button
                onClick={handleEssentialOnly}
                variant="outline"
                size="sm"
                className="text-xs font-medium border-gray-500 text-gray-200 hover:bg-white/10 hover:text-white"
              >
                {t('cookie.essential_only')}
              </Button>
              <Button
                onClick={() => setShowConfig(!showConfig)}
                variant="ghost"
                size="sm"
                className="text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5"
              >
                {t('cookie.configure')}
              </Button>
            </div>
          </div>

          {/* Configuration panel */}
          {showConfig && (
            <div className="mt-4 border-t border-white/10 pt-4 space-y-3">
              {/* Essential cookies — always on */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-white">{t('cookie.essential_title')}</p>
                  <p className="text-xs text-gray-400">{t('cookie.essential_desc')}</p>
                </div>
                <div className="shrink-0 ml-4">
                  <div className="h-5 w-9 rounded-full bg-green-600 relative cursor-not-allowed opacity-70">
                    <div className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-white" />
                  </div>
                </div>
              </div>

              {/* Analytics cookies — toggleable */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-white">{t('cookie.analytics_title')}</p>
                  <p className="text-xs text-gray-400">{t('cookie.analytics_desc')}</p>
                </div>
                <div className="shrink-0 ml-4">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={analyticsEnabled}
                    onClick={() => setAnalyticsEnabled(!analyticsEnabled)}
                    className={`h-5 w-9 rounded-full relative transition-colors ${
                      analyticsEnabled ? 'bg-green-600' : 'bg-gray-600'
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
                        analyticsEnabled ? 'right-0.5' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  onClick={handleSavePreferences}
                  size="sm"
                  className="text-xs font-medium text-white"
                  style={{ backgroundColor: '#C8232A' }}
                >
                  {t('cookie.save_preferences')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
