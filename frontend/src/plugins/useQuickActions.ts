import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import type { QuickActionDefinition, QuickActionMode, QuickActionScope } from '@/lib/quickActions.ts';
import { useCurrentWindow } from '@/providers/CurrentWindowProvider.tsx';
import { getQuickActionsStore, useQuickActionsStore } from '@/stores/quickActions.ts';

/**
 * Virtual windows render a whole second router tree in the same context, but only the main window
 * has a palette - so registering from one would leak its rows, and its closed-over server, into the
 * main window's list.
 */
function useRegistrationEnabled(enabled: boolean) {
  const { id } = useCurrentWindow();

  return enabled && id === null;
}

/** Repaints an open palette after the host re-renders, since it reads providers lazily. */
function useProviderRepaint() {
  useEffect(() => {
    const store = getQuickActionsStore();
    if (store.open) store.bumpRevision();
  });
}

export function useQuickActions(definitions: QuickActionDefinition[], enabled = true) {
  const definitionsRef = useRef(definitions);
  definitionsRef.current = definitions;

  const active = useRegistrationEnabled(enabled);

  useEffect(() => {
    if (!active) return;

    return getQuickActionsStore().registerActions(() => definitionsRef.current);
  }, [active]);

  useProviderRepaint();
}

export function useQuickActionModes(modes: QuickActionMode[], enabled = true) {
  const modesRef = useRef(modes);
  modesRef.current = modes;

  const active = useRegistrationEnabled(enabled);

  useEffect(() => {
    if (!active) return;

    return getQuickActionsStore().registerModes(() => modesRef.current);
  }, [active]);

  useProviderRepaint();
}

export function useQuickActionLocation(): { scope: QuickActionScope; serverId: string | undefined } {
  const location = useLocation();

  const rawServerId = location.pathname.match(/^\/server\/([^/]+)/)?.[1];
  const serverId = rawServerId && rawServerId !== ':id' ? rawServerId : undefined;

  return {
    scope: serverId ? 'server' : location.pathname.startsWith('/admin') ? 'admin' : 'dashboard',
    serverId,
  };
}

/**
 * The palette query with `prefix` stripped and trimmed, or null while the query does not start
 * with it. An empty string therefore means the mode is active but nothing was typed after it.
 */
export function useQuickActionTerm(prefix: string): string | null {
  const query = useQuickActionsStore((state) => state.query);

  return query.startsWith(prefix) ? query.slice(prefix.length).trim() : null;
}
