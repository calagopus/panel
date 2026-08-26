import { join } from 'pathe';
import { z } from 'zod';
import { serverDirectoryEntrySchema } from '@/lib/schemas/server/files.ts';
import {
  DirectoryEntry,
  TreeDirectoryCapabilities,
  TreeSelectionItem,
} from '@/pages/server/files/workspace/fileTreeData.ts';

export const FILE_TREE_EDITOR_DRAG_TYPE = 'application/x-calagopus-file-editor';
export const FILE_TREE_EDITOR_TAB_DRAG_TYPE = 'application/x-calagopus-file-editor-tab';

export interface FileTreeEditorSelection {
  directory: string;
  file: DirectoryEntry;
  action: string;
  params: Record<string, string>;
  primary: boolean;
  writable: boolean;
}

export const getFileTreeEditorTabId = (selection: FileTreeEditorSelection) =>
  JSON.stringify([
    join(selection.directory, selection.file.name),
    selection.action,
    Object.entries(selection.params).sort(([left], [right]) => left.localeCompare(right)),
  ]);

export interface FileTreeEditorDragItem {
  item: TreeSelectionItem;
  capabilities: TreeDirectoryCapabilities;
}

const editorDragItemSchema = z.object({
  item: z.object({
    path: z.string(),
    parent: z.string(),
    entry: serverDirectoryEntrySchema,
  }),
  capabilities: z.object({
    primary: z.boolean(),
    writable: z.boolean(),
    fast: z.boolean(),
  }),
});

export const setFileTreeEditorDragData = (dataTransfer: DataTransfer, items: FileTreeEditorDragItem[]) => {
  if (items.length === 0) return;

  dataTransfer.setData(FILE_TREE_EDITOR_DRAG_TYPE, JSON.stringify(items));
};

export const getFileTreeEditorDragData = (dataTransfer: DataTransfer): FileTreeEditorDragItem[] => {
  try {
    const raw = dataTransfer.getData(FILE_TREE_EDITOR_DRAG_TYPE);
    if (!raw) return [];

    const parsed = z.array(editorDragItemSchema).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
};

export interface FileTreeEditorTabDragData {
  tabId: string;
  paneId: string;
}

export const setFileTreeEditorTabDragData = (dataTransfer: DataTransfer, data: FileTreeEditorTabDragData) => {
  dataTransfer.setData(FILE_TREE_EDITOR_TAB_DRAG_TYPE, JSON.stringify(data));
  dataTransfer.effectAllowed = 'copyMove';
};

export const getFileTreeEditorTabDragData = (dataTransfer: DataTransfer): FileTreeEditorTabDragData | null => {
  try {
    const raw = dataTransfer.getData(FILE_TREE_EDITOR_TAB_DRAG_TYPE);
    if (!raw) return null;

    const parsed = z.object({ tabId: z.string(), paneId: z.string() }).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};
