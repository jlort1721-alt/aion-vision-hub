import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface ShortcutConfig {
  onToggleMute?: () => void;
  onOpenGate?: () => void;
  onNewIncident?: () => void;
}

/**
 * Global keyboard shortcuts for operator efficiency.
 * F1-F5: Navigate to key pages
 * Alt+G: Quick open gate
 * Alt+N: New incident
 * Escape: Close any open dialog (handled natively by radix)
 */
export function useKeyboardShortcuts(config: ShortcutConfig = {}) {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // F-key shortcuts
      switch (e.key) {
        case 'F1':
          e.preventDefault();
          navigate('/dashboard');
          break;
        case 'F2':
          e.preventDefault();
          navigate('/live-view');
          break;
        case 'F3':
          e.preventDefault();
          navigate('/events');
          break;
        case 'F4':
          e.preventDefault();
          navigate('/incidents');
          break;
        case 'F5':
          e.preventDefault();
          config.onToggleMute?.();
          break;
      }

      // Alt combos
      if (e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'g':
            e.preventDefault();
            config.onOpenGate?.();
            break;
          case 'n':
            e.preventDefault();
            config.onNewIncident?.();
            break;
          case '1':
            e.preventDefault();
            navigate('/dashboard');
            break;
          case '2':
            e.preventDefault();
            navigate('/live-view');
            break;
          case '3':
            e.preventDefault();
            navigate('/events');
            break;
          case '4':
            e.preventDefault();
            navigate('/incidents');
            break;
          case '5':
            e.preventDefault();
            navigate('/ai-assistant');
            break;
        }
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [navigate, config]);
}
