// ═══════════════════════════════════════════════════════════
// AION VISION HUB — White-Label Branding Context
// Fetches per-tenant branding from /tenants/current and
// applies CSS custom properties dynamically. Falls back to
// AION defaults when no tenant branding is configured.
// ═══════════════════════════════════════════════════════════

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';

// ── Types ────────────────────────────────────────────────

export interface TenantBranding {
  /** Display name shown in sidebar and page titles */
  name: string;
  /** URL to the logo image (sidebar / header) */
  logoUrl?: string;
  /** URL to the favicon */
  faviconUrl?: string;
  /** Primary brand colour — used for buttons, active nav, etc. */
  primaryColor: string;
  /** Secondary brand colour — used for accents and hover states */
  secondaryColor: string;
  /** Accent colour — used for highlights and badges */
  accentColor: string;
}

interface BrandingContextType {
  branding: TenantBranding;
  isLoading: boolean;
  /** Force-reload branding from the API */
  refresh: () => Promise<void>;
}

// ── Defaults ─────────────────────────────────────────────

const AION_DEFAULTS: TenantBranding = {
  name: 'AION',
  logoUrl: undefined,
  faviconUrl: undefined,
  primaryColor: 'hsl(217, 91%, 60%)',   // Blue-600
  secondaryColor: 'hsl(215, 20%, 65%)', // Slate-400
  accentColor: 'hsl(142, 71%, 45%)',    // Green-500
};

// ── CSS variable mapping ─────────────────────────────────

function applyBrandingCSS(branding: TenantBranding) {
  const root = document.documentElement;

  // Only override when the tenant actually provided custom colours
  if (branding.primaryColor && branding.primaryColor !== AION_DEFAULTS.primaryColor) {
    root.style.setProperty('--brand-primary', branding.primaryColor);
  }
  if (branding.secondaryColor && branding.secondaryColor !== AION_DEFAULTS.secondaryColor) {
    root.style.setProperty('--brand-secondary', branding.secondaryColor);
  }
  if (branding.accentColor && branding.accentColor !== AION_DEFAULTS.accentColor) {
    root.style.setProperty('--brand-accent', branding.accentColor);
  }

  // Favicon
  if (branding.faviconUrl) {
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = branding.faviconUrl;
  }

  // Page title
  if (branding.name) {
    document.title = `${branding.name} — Vision Hub`;
  }
}

function clearBrandingCSS() {
  const root = document.documentElement;
  root.style.removeProperty('--brand-primary');
  root.style.removeProperty('--brand-secondary');
  root.style.removeProperty('--brand-accent');
}

// ── Context ──────────────────────────────────────────────

const BrandingContext = createContext<BrandingContextType>({
  branding: AION_DEFAULTS,
  isLoading: true,
  refresh: async () => {},
});

export const useBranding = () => useContext(BrandingContext);

// ── Provider ─────────────────────────────────────────────

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [branding, setBranding] = useState<TenantBranding>(AION_DEFAULTS);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBranding = useCallback(async () => {
    if (!isAuthenticated) {
      setBranding(AION_DEFAULTS);
      clearBrandingCSS();
      setIsLoading(false);
      return;
    }

    try {
      const response = await apiClient.get<{ data: any }>('/tenants/current');
      const tenant = response?.data ?? response;

      if (!tenant) {
        setBranding(AION_DEFAULTS);
        setIsLoading(false);
        return;
      }

      const settings = tenant.settings ?? {};
      const brandingSettings = settings.branding ?? {};

      const resolved: TenantBranding = {
        name: brandingSettings.name || tenant.name || AION_DEFAULTS.name,
        logoUrl: brandingSettings.logoUrl || undefined,
        faviconUrl: brandingSettings.faviconUrl || undefined,
        primaryColor: brandingSettings.primaryColor || AION_DEFAULTS.primaryColor,
        secondaryColor: brandingSettings.secondaryColor || AION_DEFAULTS.secondaryColor,
        accentColor: brandingSettings.accentColor || AION_DEFAULTS.accentColor,
      };

      setBranding(resolved);
      applyBrandingCSS(resolved);
    } catch (err) {
      console.warn('[Branding] Failed to load tenant branding, using defaults:', err);
      setBranding(AION_DEFAULTS);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  return (
    <BrandingContext.Provider value={{ branding, isLoading, refresh: fetchBranding }}>
      {children}
    </BrandingContext.Provider>
  );
}
