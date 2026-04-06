import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface ShortcutConfig {
  onToggleMute?: () => void;
  onOpenGate?: () => void;
  onNewIncident?: () => void;
}

/**
 * Global keyboard shortcuts for operator efficiency.
 *
 * Ctrl/Cmd+K:         Open command palette
 * Ctrl/Cmd+Shift+N:   New incident
 * Ctrl/Cmd+Shift+E:   Events
 * Ctrl/Cmd+Shift+L:   Live View
 * Ctrl/Cmd+Shift+D:   Dashboard
 * Ctrl/Cmd+Shift+A:   AI Assistant
 * F11:                Toggle fullscreen
 * F1-F5:             Navigate to key pages
 * Alt+G:             Quick open gate
 * Alt+N:             New incident
 * Escape:            Close any open dialog (handled natively by radix)
 */
export function useKeyboardShortcuts(config: ShortcutConfig = {}) {
  const navigate = useNavigate();

  useEffect(() => {
    const openCommandPalette = () => {
      document.dispatchEvent(new CustomEvent('open-command-palette'));
    };

    const toggleFullscreen = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    };

    const handler = (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const isCtrlOrMeta = e.ctrlKey || e.metaKey;

      // Ctrl/Cmd+K: Command palette (handled in CommandPalette too, but prevent default here)
      if (isCtrlOrMeta && e.key === 'k') {
        e.preventDefault();
        openCommandPalette();
        return;
      }

      // Ctrl/Cmd+Shift combos
      if (isCtrlOrMeta && e.shiftKey) {
        switch (e.key.toLowerCase()) {
          case 'n':
            e.preventDefault();
            navigate('/incidents?action=new');
            return;
          case 'e':
            e.preventDefault();
            navigate('/events');
            return;
          case 'l':
            e.preventDefault();
            navigate('/live-view');
            return;
          case 'd':
            e.preventDefault();
            navigate('/dashboard');
            return;
          case 'a':
            e.preventDefault();
            navigate('/ai-assistant');
            return;
        }
      }

      // F11: Toggle fullscreen
      if (e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
        return;
      }

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
