import { useEffect, useRef } from 'react';
import type { QuickActionDefinition } from '@/lib/quickActions.ts';
import { getQuickActionsStore } from '@/stores/quickActions.ts';

export function useQuickActions(definitions: QuickActionDefinition[], enabled = true) {
  const definitionsRef = useRef(definitions);
  definitionsRef.current = definitions;

  useEffect(() => {
    if (!enabled) return;

    return getQuickActionsStore().registerPageActions(() => definitionsRef.current);
  }, [enabled]);
}
