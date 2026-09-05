import { dirname, join } from 'pathe';
import { z } from 'zod';
import { isViewableArchive } from '@/lib/files/files.ts';
import { serverDirectoryEntrySchema } from '@/lib/schemas/server/files.ts';
import { FileMoveGroup } from '@/pages/server/files/list/fileMove.ts';

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
      expandable: boolean;
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
  expandable: boolean;
}

export interface TreeDirectoryCapabilities {
  primary: boolean;
  writable: boolean;
  fast: boolean;
}

export interface FileTreeProps {
  onOpenFile: (item: TreeSelectionItem, capabilities: TreeDirectoryCapabilities) => void;
  activePath: string | null;
  initialDirectory: string;
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

export const resolveDirectoryCapabilities = (
  directories: Record<string, DirectoryState>,
  path: string,
): TreeDirectoryCapabilities => {
  let current = path;
  let directory = directories[current];

  while (!directory && current !== ROOT_DIRECTORY) {
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
    directory = directories[current];
  }

  directory = directory ?? directories[ROOT_DIRECTORY];
  return {
    primary: directory?.primary ?? false,
    writable: directory?.writable ?? false,
    fast: directory?.fast ?? true,
  };
};

/** Archives with a browsable index expand in place, the way the list view browses into them. */
export const isExpandableEntry = (entry: DirectoryEntry, fast: boolean) =>
  entry.directory || isViewableArchive(entry, fast);

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

/**
 * Search hits are named relative to the search root ("PluginMetrics/config.yml"), so the row keeps
 * that root as its parent - deriving one from the hit's own path would double the shared segments
 * when the entry name is later resolved against it.
 */
export const searchRow = (
  root: string,
  entry: DirectoryEntry,
  fast: boolean,
  expandedDirectories: Set<string>,
): FileTreeRow => {
  const path = join(root, entry.name);

  return {
    type: 'entry',
    key: `search:${path}`,
    path,
    parent: root,
    depth: 0,
    entry,
    expandable: isExpandableEntry(entry, fast),
    expanded: isExpandableEntry(entry, fast) && expandedDirectories.has(path),
  };
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
    const expandable = isExpandableEntry(entry, state.fast);
    const expanded = expandable && expandedDirectories.has(path);

    rows.push({ type: 'entry', key: path, path, parent: directory, depth, entry, expandable, expanded });

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

export const appendSearchRows = (
  rows: FileTreeRow[],
  root: string,
  entries: DirectoryEntry[],
  directories: Record<string, DirectoryState>,
  expandedDirectories: Set<string>,
) => {
  const { fast } = resolveDirectoryCapabilities(directories, root);

  for (const entry of entries) {
    const row = searchRow(root, entry, fast, expandedDirectories);
    rows.push(row);
    if (row.type === 'entry' && row.expanded) {
      appendDirectoryRows(rows, row.path, 1, directories, expandedDirectories);
    }
  }
};

export const escapeFileTreeSearch = (query: string) => query.replace(/[\\*?[\]{}]/g, '\\$&');
