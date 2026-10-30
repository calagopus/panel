import { create } from 'zustand';
import { toastTimeout } from '@/providers/contexts/toastContext.ts';

export interface UndoEntry {
  id: number;
  scope: string;
  expiresAt: number;
  undo: () => void | Promise<void>;
}

interface UndoHistoryStore {
  entries: UndoEntry[];
}

const maxUndoEntries = 10;

export function fileManagerUndoScope(serverUuid: string): string {
  return `server:${serverUuid}:files`;
}

export const useUndoHistoryStore = create<UndoHistoryStore>()(() => ({
  entries: [],
}));

let nextUndoEntryId = 1;
const runningScopes = new Set<string>();

export function pushUndoEntry(scope: string, undo: () => void | Promise<void>): number {
  const id = nextUndoEntryId++;
  const now = Date.now();

  useUndoHistoryStore.setState((state) => ({
    entries: [
      ...state.entries.filter((entry) => entry.expiresAt > now),
      { id, scope, expiresAt: now + toastTimeout, undo },
    ].slice(-maxUndoEntries),
  }));

  return id;
}

function takeUndoEntry(match: (entry: UndoEntry) => boolean): UndoEntry | null {
  const current = useUndoHistoryStore.getState().entries;
  const now = Date.now();
  const entries = current.filter((entry) => entry.expiresAt > now);

  let taken: UndoEntry | null = null;
  for (let i = entries.length - 1; i >= 0 && !taken; i--) {
    if (match(entries[i])) taken = entries.splice(i, 1)[0];
  }

  if (taken || entries.length !== current.length) useUndoHistoryStore.setState({ entries });

  return taken;
}

async function runUndo(entry: UndoEntry | null): Promise<void> {
  if (!entry) return;

  runningScopes.add(entry.scope);
  try {
    await entry.undo();
  } finally {
    runningScopes.delete(entry.scope);
  }
}

export function runUndoEntry(id: number): Promise<void> {
  return runUndo(takeUndoEntry((entry) => entry.id === id && !runningScopes.has(entry.scope)));
}

export function runLastUndoEntry(scope: string): Promise<void> {
  if (runningScopes.has(scope)) return Promise.resolve();

  return runUndo(takeUndoEntry((entry) => entry.scope === scope));
}
