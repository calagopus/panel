import { z } from 'zod';
import { serverDirectoryEntrySchema } from '@/lib/schemas/server/files.ts';
import { FileTreeEditorSelection, getFileTreeEditorTabId } from './fileTreeEditor.ts';

export interface FileTreeEditorPaneState {
  id: string;
  tabIds: string[];
  activeTabId: string | null;
  size: number;
}

export interface FileTreeEditorWorkspaceState {
  tabs: FileTreeEditorSelection[];
  panes: FileTreeEditorPaneState[];
  activePaneId: string;
}

const selectionSchema = z.object({
  directory: z.string(),
  file: serverDirectoryEntrySchema,
  action: z.string(),
  params: z.record(z.string(), z.string()),
  primary: z.boolean().default(true),
  writable: z.boolean(),
});

const paneSchema = z.object({
  id: z.string(),
  tabIds: z.array(z.string()),
  activeTabId: z.string().nullable(),
  size: z.number().positive().default(1),
});

const workspaceSchema = z.object({
  version: z.literal(2),
  tabs: z.array(selectionSchema),
  panes: z.array(paneSchema),
  activePaneId: z.string(),
});

let paneSequence = 0;

export const createFileTreePaneId = () => {
  paneSequence += 1;
  return `pane-${Date.now().toString(36)}-${paneSequence.toString(36)}`;
};

export const createEmptyFileTreeWorkspace = (): FileTreeEditorWorkspaceState => {
  const paneId = createFileTreePaneId();
  return { tabs: [], panes: [{ id: paneId, tabIds: [], activeTabId: null, size: 1 }], activePaneId: paneId };
};

export const normalizeFileTreeWorkspace = (input: FileTreeEditorWorkspaceState): FileTreeEditorWorkspaceState => {
  const tabs = Array.from(new Map(input.tabs.map((tab) => [getFileTreeEditorTabId(tab), tab])).values());
  const validTabIds = new Set(tabs.map(getFileTreeEditorTabId));
  const assigned = new Set<string>();
  const panes = input.panes.flatMap((pane): FileTreeEditorPaneState[] => {
    const tabIds = pane.tabIds.filter((tabId) => {
      if (!validTabIds.has(tabId) || assigned.has(tabId)) return false;
      assigned.add(tabId);
      return true;
    });
    if (tabIds.length === 0 && tabs.length > 0) return [];

    return [
      {
        ...pane,
        tabIds,
        activeTabId: pane.activeTabId && tabIds.includes(pane.activeTabId) ? pane.activeTabId : (tabIds[0] ?? null),
        size: Number.isFinite(pane.size) && pane.size > 0 ? pane.size : 1,
      },
    ];
  });

  const fallbackPane = panes[0] ?? {
    id: createFileTreePaneId(),
    tabIds: [],
    activeTabId: null,
    size: 1,
  };
  if (panes.length === 0) panes.push(fallbackPane);

  const unassigned = tabs.map(getFileTreeEditorTabId).filter((tabId) => !assigned.has(tabId));
  if (unassigned.length > 0) {
    panes[0] = {
      ...panes[0],
      tabIds: [...panes[0].tabIds, ...unassigned],
      activeTabId: panes[0].activeTabId ?? unassigned[0],
    };
  }

  return {
    tabs,
    panes,
    activePaneId: panes.some((pane) => pane.id === input.activePaneId) ? input.activePaneId : panes[0].id,
  };
};

const storageKey = (serverUuid: string) => `file_tree_editor_workspace:${serverUuid}`;

export const restoreFileTreeWorkspace = (serverUuid: string): FileTreeEditorWorkspaceState => {
  try {
    const stored = localStorage.getItem(storageKey(serverUuid));
    if (!stored) return createEmptyFileTreeWorkspace();
    const raw: unknown = JSON.parse(stored);
    const parsed = workspaceSchema.safeParse(raw);
    return parsed.success ? normalizeFileTreeWorkspace(parsed.data) : createEmptyFileTreeWorkspace();
  } catch {
    return createEmptyFileTreeWorkspace();
  }
};

export const storeFileTreeWorkspace = (serverUuid: string, workspace: FileTreeEditorWorkspaceState) => {
  try {
    localStorage.setItem(storageKey(serverUuid), JSON.stringify({ version: 2, ...workspace }));
  } catch {
    // A private or full browser store should not stop files from opening.
  }
};
