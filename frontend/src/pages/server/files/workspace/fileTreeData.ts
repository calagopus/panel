import { dirname, join } from 'pathe';
import { z } from 'zod';
import { serverDirectoryEntrySchema } from '@/lib/schemas/server/files.ts';
import { FileMoveGroup } from '@/pages/server/files/browser/fileMove.ts';

export type DirectoryEntry = z.infer<typeof serverDirectoryEntrySchema>;

export interface DirectoryState {
  entries: DirectoryEntry[];
  page: number;
  total: number;
  primary: boolean;
  writable: boolean;
  fast: boolean;
  loading: boolean;
  error: string | null;
}

export type FileTreeRow =
  | {
      type: 'entry';
      key: string;
      path: string;
      parent: string;
      depth: number;
      entry: DirectoryEntry;
      expanded: boolean;
    }
  | {
      type: 'loading';
      key: string;
      depth: number;
    }
  | {
      type: 'empty';
      key: string;
      depth: number;
    }
  | {
      type: 'searchEmpty';
      key: string;
      depth: number;
    }
  | {
      type: 'loadMore';
      key: string;
      directory: string;
      depth: number;
      page: number;
      loading: boolean;
    }
  | {
      type: 'error';
      key: string;
      directory: string;
      depth: number;
      page: number;
      loading: boolean;
      message: string;
    };

export interface TreeSelectionItem {
  path: string;
  parent: string;
  entry: DirectoryEntry;
}

export interface TreeDirectoryCapabilities {
  primary: boolean;
  writable: boolean;
  fast: boolean;
}

export interface FileTreeProps {
  onOpenFile: (item: TreeSelectionItem, capabilities: TreeDirectoryCapabilities) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export const ROOT_DIRECTORY = '/';
export const TREE_ROW_HEIGHT = 32;
export const identifyTreeItem = (item: TreeSelectionItem) => item.path;

export const EMPTY_DIRECTORY_STATE: DirectoryState = {
  entries: [],
  page: 0,
  total: 0,
  primary: false,
  writable: false,
  fast: true,
  loading: false,
  error: null,
};

export const truncateFileTreeName = (name: string, directory: boolean, maxLength = 30) => {
  if (name.length <= maxLength) return name;

  const extensionStart = directory ? -1 : name.lastIndexOf('.');
  if (extensionStart <= 0) return `${name.slice(0, Math.max(1, maxLength - 1))}…`;

  const extension = name.slice(extensionStart);
  const base = name.slice(0, extensionStart);
  const baseLength = Math.max(1, maxLength - extension.length - 1);

  return `${base.slice(0, baseLength)}…${extension}`;
};

export const isExternalFileDrag = (dataTransfer: DataTransfer) => {
  if (Array.from(dataTransfer.types).includes('Files')) return true;
  if (dataTransfer.files.length > 0) return true;

  return Array.from(dataTransfer.items).some((item) => item.kind === 'file');
};

export const collapseNestedTreeItems = (items: TreeSelectionItem[]) => {
  const selectedDirectories = new Set(items.filter((item) => item.entry.directory).map((item) => item.path));

  return items.filter((item) => {
    let parent = item.parent;

    while (parent !== ROOT_DIRECTORY) {
      if (selectedDirectories.has(parent)) return false;

      const nextParent = dirname(parent);
      if (nextParent === parent) break;
      parent = nextParent;
    }

    return true;
  });
};

export const groupTreeItems = (items: TreeSelectionItem[]): FileMoveGroup[] => {
  const groups = new Map<string, DirectoryEntry[]>();

  for (const item of items) {
    const group = groups.get(item.parent);
    if (group) group.push(item.entry);
    else groups.set(item.parent, [item.entry]);
  }

  return Array.from(groups, ([sourceDirectory, files]) => ({
    sourceDirectory,
    files,
  }));
};

export const appendDirectoryRows = (
  rows: FileTreeRow[],
  directory: string,
  depth: number,
  directories: Record<string, DirectoryState>,
  expandedDirectories: Set<string>,
) => {
  const state = directories[directory];

  if (!state || (state.loading && state.entries.length === 0)) {
    rows.push({ type: 'loading', key: `loading:${directory}`, depth });
    return;
  }

  for (const entry of state.entries) {
    const path = join(directory, entry.name);
    const expanded = entry.directory && expandedDirectories.has(path);

    rows.push({ type: 'entry', key: path, path, parent: directory, depth, entry, expanded });

    if (expanded) {
      appendDirectoryRows(rows, path, depth + 1, directories, expandedDirectories);
    }
  }

  if (state.error) {
    rows.push({
      type: 'error',
      key: `error:${directory}`,
      directory,
      depth,
      page: state.page + 1,
      loading: state.loading,
      message: state.error,
    });
  } else if (state.entries.length === 0) {
    rows.push({ type: 'empty', key: `empty:${directory}`, depth });
  } else if (state.entries.length < state.total) {
    rows.push({
      type: 'loadMore',
      key: `load-more:${directory}`,
      directory,
      depth,
      page: state.page + 1,
      loading: state.loading,
    });
  }
};
