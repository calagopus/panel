import { useEffect, useRef } from 'react';
import { eventKeyMatches } from '@/lib/quickActions/shortcuts.ts';

export function useSelectKeyHeld() {
  const heldRef = useRef(false);

  useEffect(() => {
    const reset = () => {
      heldRef.current = false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!eventKeyMatches(e, 's')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) {
        heldRef.current = false;
        return;
      }

      const target = e.target as HTMLElement;
      if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
        heldRef.current = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (eventKeyMatches(e, 's')) reset();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') reset();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', reset);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return heldRef;
}
