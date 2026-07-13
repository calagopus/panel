import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'form-engine:advanced-mode';
const CHANGE_EVENT = 'form-engine:advanced-mode-change';

export function useAdvancedMode(): [boolean, (value: boolean) => void] {
  const [advanced, setAdvancedState] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true');

  useEffect(() => {
    const handler = (e: Event) => setAdvancedState((e as CustomEvent<boolean>).detail);
    window.addEventListener(CHANGE_EVENT, handler);
    return () => window.removeEventListener(CHANGE_EVENT, handler);
  }, []);

  const setAdvanced = useCallback((value: boolean) => {
    localStorage.setItem(STORAGE_KEY, String(value));
    window.dispatchEvent(new CustomEvent<boolean>(CHANGE_EVENT, { detail: value }));
  }, []);

  return [advanced, setAdvanced];
}
