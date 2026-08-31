import { faFileCirclePlus, faFolderPlus } from '@fortawesome/free-solid-svg-icons';
import { dirname, join, resolve } from 'pathe';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createSearchParams, useNavigate, useSearchParams } from 'react-router';
import { httpErrorToHuman } from '@/api/axios.ts';
import loadDirectory from '@/api/server/files/loadDirectory.ts';
import searchFiles from '@/api/server/files/searchFiles.ts';
import Card from '@/elements/Card.tsx';
import ContextMenu from '@/elements/ContextMenu.tsx';
import { registerUploadRefresh } from '@/lib/files/uploadManager.ts';
import FileMassContextMenu from '@/pages/server/files/browser/FileMassContextMenu.tsx';
import { useDraggedFileMove } from '@/pages/server/files/hooks/useDraggedFileMove.ts';
import { getFilesFromDataTransfer } from '@/pages/server/files/hooks/useFileDragAndDrop.ts';
import FileTreeToolbar from '@/pages/server/files/workspace/FileTreeToolbar.tsx';
import FileTreeVirtualList from '@/pages/server/files/workspace/FileTreeVirtualList.tsx';
import {
  appendDirectoryRows,
  collapseNestedTreeItems,
  DirectoryEntry,
  DirectoryState,
  EMPTY_DIRECTORY_STATE,
  FileTreeProps,
  FileTreeRow as FileTreeRowData,
  groupTreeItems,
  identifyTreeItem,
  isExternalFileDrag,
  ROOT_DIRECTORY,
  TREE_ROW_HEIGHT,
  TreeDirectoryCapabilities,
  TreeSelectionItem,
} from '@/pages/server/files/workspace/fileTreeData.ts';
import { setFileTreeEditorDragData } from '@/pages/server/files/workspace/fileTreeEditor.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useSelectionArea } from '@/plugins/useSelectionArea.ts';
import useWebsocketEvent, { SocketEvent } from '@/plugins/useWebsocketEvent.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useFileManagerApi, useFileManagerStore } from '@/stores/fileManager.ts';
import { useServerStore } from '@/stores/server.ts';

function FileTree({ onOpenFile, activePath, initialDirectory, collapsed, onToggleCollapsed }: FileTreeProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const server = useServerStore((state) => state.server);
  const canCreateFiles = useServerCan('files.create');
  const canUpdateFiles = useServerCan('files.update');
  const store = useFileManagerApi();
  const preferPhysicalSize = useFileManagerStore((state) => state.preferPhysicalSize);
  const treeRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const activeServerRef = useRef(server.uuid);
  const loadingDirectoriesRef = useRef(new Set<string>());
  const directoriesRef = useRef<Record<string, DirectoryState>>({});
  const expandedDirectoriesRef = useRef(new Set<string>());
  const selectedPathsRef = useRef(new Set<string>());
  const itemsByPathRef = useRef(new Map<string, TreeSelectionItem>());
  const highlightedDropTargetRef = useRef<{ element: HTMLElement; target: string } | null>(null);
  const clearDropTargetTimerRef = useRef<number | null>(null);
  const searchRequestRef = useRef(0);
  const reloadTreeRef = useRef<() => void>(() => undefined);
  const onOpenFileRef = useRef(onOpenFile);
  const [directories, setDirectories] = useState<Record<string, DirectoryState>>({});
  const [expandedDirectories, setExpandedDirectories] = useState(() => new Set<string>());
  const [selectedPaths, setSelectedPaths] = useState(() => new Set<string>());
  const [draggedPaths, setDraggedPaths] = useState(() => new Set<string>());
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DirectoryEntry[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchRevision, setSearchRevision] = useState(0);
  const { moving, canMoveToDirectory, getDropHandlers } = useDraggedFileMove({ trackDropTarget: false });
  const movingRef = useRef(moving);

  const setHorizontalDragScrollLocked = useCallback((locked: boolean) => {
    if (locked) viewportRef.current?.style.setProperty('overflow-x', 'hidden');
    else viewportRef.current?.style.removeProperty('overflow-x');
  }, []);

  useEffect(() => {
    directoriesRef.current = directories;
    expandedDirectoriesRef.current = expandedDirectories;
    selectedPathsRef.current = selectedPaths;
    movingRef.current = moving;
    onOpenFileRef.current = onOpenFile;
  }, [directories, expandedDirectories, selectedPaths, moving, onOpenFile]);

  const clearDropTarget = useCallback(() => {
    if (clearDropTargetTimerRef.current !== null) {
      window.clearTimeout(clearDropTargetTimerRef.current);
      clearDropTargetTimerRef.current = null;
    }

    highlightedDropTargetRef.current?.element.classList.remove('file-tree-drop-target', 'file-tree-root-drop-target');
    highlightedDropTargetRef.current = null;
    store.getState().setDraggingTarget(null);
    setHorizontalDragScrollLocked(false);
  }, [setHorizontalDragScrollLocked, store]);

  const highlightDropTarget = useCallback((target: string, element: HTMLElement) => {
    if (clearDropTargetTimerRef.current !== null) {
      window.clearTimeout(clearDropTargetTimerRef.current);
      clearDropTargetTimerRef.current = null;
    }

    const current = highlightedDropTargetRef.current;
    if (current?.target === target && current.element === element) return;

    current?.element.classList.remove('file-tree-drop-target', 'file-tree-root-drop-target');
    element.classList.add(element === treeRef.current ? 'file-tree-root-drop-target' : 'file-tree-drop-target');
    highlightedDropTargetRef.current = { element, target };
  }, []);

  const scheduleDropTargetClear = useCallback(
    (delay = 60) => {
      if (clearDropTargetTimerRef.current !== null) window.clearTimeout(clearDropTargetTimerRef.current);
      clearDropTargetTimerRef.current = window.setTimeout(clearDropTarget, delay);
    },
    [clearDropTarget],
  );

  useEffect(() => {
    const clearWhenOutsideTree = (event: DragEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || !treeRef.current?.contains(target)) clearDropTarget();
    };
    const clearWhenHidden = () => {
      if (document.hidden) clearDropTarget();
    };

    document.addEventListener('dragover', clearWhenOutsideTree, true);
    document.addEventListener('drop', clearDropTarget, true);
    document.addEventListener('dragend', clearDropTarget, true);
    document.addEventListener('visibilitychange', clearWhenHidden);
    window.addEventListener('blur', clearDropTarget);

    return () => {
      document.removeEventListener('dragover', clearWhenOutsideTree, true);
      document.removeEventListener('drop', clearDropTarget, true);
      document.removeEventListener('dragend', clearDropTarget, true);
      document.removeEventListener('visibilitychange', clearWhenHidden);
      window.removeEventListener('blur', clearDropTarget);
      clearDropTarget();
    };
  }, [clearDropTarget]);

  const loadPage = useCallback(
    async (directory: string, page: number) => {
      const requestServerUuid = server.uuid;
      const loadingKey = `${requestServerUuid}:${directory}`;
      if (loadingDirectoriesRef.current.has(loadingKey)) return;

      loadingDirectoriesRef.current.add(loadingKey);
      setDirectories((current) => {
        const previous = current[directory] ?? EMPTY_DIRECTORY_STATE;

        return {
          ...current,
          [directory]: {
            ...previous,
            entries: page === 1 ? [] : previous.entries,
            loading: true,
            error: null,
          },
        };
      });

      try {
        const response = await loadDirectory(requestServerUuid, directory, page, 'name_asc');
        if (activeServerRef.current === requestServerUuid) {
          setDirectories((current) => {
            const existingEntries = page === 1 ? [] : (current[directory]?.entries ?? []);
            const entriesByName = new Map(existingEntries.map((entry) => [entry.name, entry]));
            for (const entry of response.entries.data) entriesByName.set(entry.name, entry);

            return {
              ...current,
              [directory]: {
                entries: Array.from(entriesByName.values()),
                page: response.entries.page,
                total: response.entries.total,
                primary: response.isFilesystemPrimary,
                writable: response.isFilesystemWritable,
                fast: response.isFilesystemFast,
                loading: false,
                error: null,
              },
            };
          });
        }
      } catch (error) {
        if (activeServerRef.current === requestServerUuid) {
          const message = httpErrorToHuman(error);
          setDirectories((current) => ({
            ...current,
            [directory]: {
              ...(current[directory] ?? EMPTY_DIRECTORY_STATE),
              loading: false,
              error: message,
            },
          }));
          addToast(message, 'error');
        }
      }
      loadingDirectoriesRef.current.delete(loadingKey);
    },
    [server.uuid, addToast],
  );

  useEffect(() => {
    activeServerRef.current = server.uuid;
    loadingDirectoriesRef.current.clear();
    setDirectories({});
    setExpandedDirectories(new Set());
    selectedPathsRef.current = new Set();
    setSelectedPaths(new Set());
    setDraggedPaths(new Set());
    store.getState().clearDraggingFiles();
    store.getState().doSelectFiles([]);
    clearDropTarget();
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    setSearchLoading(false);
    setSearchError(null);
    void loadPage(ROOT_DIRECTORY, 1);
  }, [server.uuid, loadPage, clearDropTarget, store]);

  useEffect(() => {
    const paths: string[] = [];
    let current = resolve(ROOT_DIRECTORY, initialDirectory);

    while (current !== ROOT_DIRECTORY) {
      paths.unshift(current);
      const parent = dirname(current);
      if (parent === current) break;
      current = parent;
    }

    if (paths.length === 0) return;

    setExpandedDirectories((expanded) => {
      const next = new Set(expanded);
      for (const path of paths) next.add(path);
      return next.size === expanded.size ? expanded : next;
    });

    for (const path of paths) {
      if (!directoriesRef.current[path]) void loadPage(path, 1);
    }
  }, [initialDirectory, loadPage]);

  useEffect(
    () =>
      registerUploadRefresh(`server:${server.uuid}`, () => {
        const paths = [ROOT_DIRECTORY, ...expandedDirectoriesRef.current].filter(
          (path) => !!directoriesRef.current[path],
        );
        for (const path of paths) void loadPage(path, 1);
      }),
    [server.uuid, loadPage],
  );

  useEffect(() => store.getState().registerRefreshListener(() => reloadTreeRef.current()), [store]);
  useEffect(() => () => store.getState().doSelectFiles([]), [store]);

  useEffect(() => {
    const query = searchQuery.trim();
    const request = ++searchRequestRef.current;

    if (!searchOpen || !query) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError(null);
      return;
    }

    setSearchLoading(true);
    setSearchResults([]);
    setSearchError(null);

    const timeout = window.setTimeout(() => {
      searchFiles(server.uuid, {
        root: ROOT_DIRECTORY,
        pathFilter: { include: [`**/*${query}*`], exclude: [], caseInsensitive: true },
        sizeFilter: null,
        contentFilter: null,
      })
        .then((entries) => {
          if (searchRequestRef.current === request) setSearchResults(entries);
        })
        .catch((error) => {
          if (searchRequestRef.current === request) setSearchError(httpErrorToHuman(error));
        })
        .finally(() => {
          if (searchRequestRef.current === request) setSearchLoading(false);
        });
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      if (searchRequestRef.current === request) searchRequestRef.current++;
    };
  }, [server.uuid, searchOpen, searchQuery, searchRevision]);

  const searching = searchOpen && searchQuery.trim().length > 0;

  const rows = useMemo(() => {
    if (searching) {
      if (searchError) return [];

      if (searchLoading && searchResults.length === 0) {
        return [{ type: 'loading', key: 'search:loading', depth: 0 } satisfies FileTreeRowData];
      }

      if (searchResults.length === 0) {
        return [{ type: 'searchEmpty', key: 'search:empty', depth: 0 } satisfies FileTreeRowData];
      }

      return searchResults.map((entry): FileTreeRowData => {
        const path = join(ROOT_DIRECTORY, entry.name);
        return {
          type: 'entry',
          key: `search:${path}`,
          path,
          parent: dirname(path),
          depth: 0,
          entry,
          expanded: false,
        };
      });
    }

    const result: FileTreeRowData[] = [];
    appendDirectoryRows(result, ROOT_DIRECTORY, 0, directories, expandedDirectories);

    return result;
  }, [directories, expandedDirectories, searching, searchLoading, searchResults, searchError]);

  const { itemsByPath, visiblePaths } = useMemo(() => {
    const items = new Map<string, TreeSelectionItem>();

    for (const row of rows) {
      if (row.type === 'entry') items.set(row.path, { path: row.path, parent: row.parent, entry: row.entry });
    }

    return { itemsByPath: items, visiblePaths: Array.from(items.keys()) };
  }, [rows]);
  const selectedItems = useMemo(
    () =>
      Array.from(selectedPaths).flatMap((path): TreeSelectionItem[] => {
        const item = itemsByPath.get(path);
        return item ? [item] : [];
      }),
    [itemsByPath, selectedPaths],
  );
  const allVisibleItemsSelected = visiblePaths.length > 0 && visiblePaths.every((path) => selectedPaths.has(path));
  const someVisibleItemsSelected = visiblePaths.some((path) => selectedPaths.has(path));
  const isDirectoryWritable = (path: string, parent: string, virtual: boolean) =>
    directories[path]?.writable ?? (!virtual && (directories[parent]?.writable ?? false));
  const getDirectoryCapabilities = useCallback((path: string): TreeDirectoryCapabilities => {
    const directory = directoriesRef.current[path] ?? directoriesRef.current[ROOT_DIRECTORY];
    return {
      primary: directory?.primary ?? false,
      writable: directory?.writable ?? false,
      fast: directory?.fast ?? true,
    };
  }, []);

  const setSelectedItems = useCallback(
    (items: TreeSelectionItem[]) => {
      const paths = new Set(items.map((item) => item.path));
      selectedPathsRef.current = paths;
      setSelectedPaths(paths);

      const fileManager = store.getState();
      const sourceDirectory = items[0]?.parent;
      if (!sourceDirectory || !items.every((item) => item.parent === sourceDirectory)) {
        fileManager.doSelectFiles([]);
        return;
      }

      fileManager.setBrowsingContext({ directory: sourceDirectory, ...getDirectoryCapabilities(sourceDirectory) });
      fileManager.doSelectFiles(items.map((item) => item.entry));
    },
    [getDirectoryCapabilities, store],
  );

  const clearSelectedItems = useCallback(() => setSelectedItems([]), [setSelectedItems]);

  const createTarget =
    selectedItems.length === 1
      ? selectedItems[0].entry.directory
        ? selectedItems[0].path
        : selectedItems[0].parent
      : ROOT_DIRECTORY;
  const createTargetWritable =
    selectedItems.length === 1 && selectedItems[0].entry.directory
      ? isDirectoryWritable(selectedItems[0].path, selectedItems[0].parent, selectedItems[0].entry.virtual)
      : (directories[createTarget]?.writable ?? false);
  const treeLoading = Object.values(directories).some((directory) => directory.loading);
  const rowHeight = TREE_ROW_HEIGHT;
  const massSelectionDirectory =
    selectedItems.length > 1 && selectedItems.every((item) => item.parent === selectedItems[0].parent)
      ? selectedItems[0].parent
      : null;
  const massSelectionFiles = massSelectionDirectory ? selectedItems.map((item) => item.entry) : undefined;

  useEffect(() => {
    itemsByPathRef.current = itemsByPath;
  }, [itemsByPath]);

  const getSelectedItems = useCallback(
    () =>
      Array.from(selectedPathsRef.current).flatMap((path): TreeSelectionItem[] => {
        const item = itemsByPathRef.current.get(path);
        return item ? [item] : [];
      }),
    [],
  );

  const toggleAllVisibleItems = () => {
    const next = new Set(selectedPathsRef.current);

    if (allVisibleItemsSelected) {
      for (const path of visiblePaths) next.delete(path);
    } else {
      for (const path of visiblePaths) next.add(path);
    }

    setSelectedItems(
      Array.from(next).flatMap((path): TreeSelectionItem[] => {
        const item = itemsByPathRef.current.get(path);
        return item ? [item] : [];
      }),
    );
  };

  const prepareCreateTarget = () => {
    const fileManager = store.getState();
    fileManager.setBrowsingContext({ directory: createTarget, writable: createTargetWritable });
    return fileManager;
  };

  const openCreateFile = () => {
    prepareCreateTarget();
    navigate(`/server/${server.uuidShort}/files/new?${createSearchParams({ directory: createTarget })}`);
  };

  const openCreateDirectory = () => {
    prepareCreateTarget();
    setSearchParams({ directory: createTarget });
    store.getState().doOpenModal('nameDirectory');
  };

  const openFileUpload = () => {
    prepareCreateTarget().fileInputRef.current?.click();
  };

  const openFolderUpload = () => {
    prepareCreateTarget().folderInputRef.current?.click();
  };

  const openUrlUpload = () => {
    prepareCreateTarget().doOpenModal('pullFile');
  };

  const openAnalysis = () => {
    prepareCreateTarget().doOpenModal('largestDirectories');
  };

  const reloadTree = () => {
    if (searching) {
      setSearchRevision((current) => current + 1);
      return;
    }

    const directoriesToReload = [ROOT_DIRECTORY, ...expandedDirectories].filter((path) => !!directories[path]);
    void Promise.all(directoriesToReload.map((path) => loadPage(path, 1)));
  };
  useEffect(() => {
    reloadTreeRef.current = reloadTree;
  }, [reloadTree]);

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
    clearSelectedItems();
  };

  const changeSearchQuery = (query: string) => {
    setSearchQuery(query);
    clearSelectedItems();
  };
  useWebsocketEvent(SocketEvent.OPERATION_COMPLETED, reloadTree);
  const { onSelectedStart, onSelected } = useSelectionArea({
    identify: identifyTreeItem,
    getSelected: getSelectedItems,
    setSelected: setSelectedItems,
  });

  const toggleDirectory = useCallback(
    (path: string) => {
      const expanding = !expandedDirectoriesRef.current.has(path);
      setExpandedDirectories((current) => {
        const next = new Set(current);
        if (expanding) next.add(path);
        else next.delete(path);
        return next;
      });

      if (expanding && !directoriesRef.current[path]) {
        void loadPage(path, 1);
      }
    },
    [loadPage],
  );

  const openItem = useCallback(
    (item: TreeSelectionItem) => {
      store.getState().doSelectFiles([]);

      if (item.entry.directory) {
        const capabilities = getDirectoryCapabilities(item.path);
        store.getState().setBrowsingContext({ directory: item.path, ...capabilities });
        toggleDirectory(item.path);
      } else {
        onOpenFileRef.current(item, getDirectoryCapabilities(item.parent));
      }
    },
    [getDirectoryCapabilities, store, toggleDirectory],
  );

  const toggleItemSelection = useCallback(
    (item: TreeSelectionItem) => {
      const next = new Set(selectedPathsRef.current);
      if (next.has(item.path)) next.delete(item.path);
      else next.add(item.path);
      setSelectedItems(
        Array.from(next).flatMap((path): TreeSelectionItem[] => {
          const selected = itemsByPathRef.current.get(path);
          return selected ? [selected] : [];
        }),
      );
    },
    [setSelectedItems],
  );

  const clearDragState = useCallback(() => {
    setDraggedPaths(new Set());
    store.getState().clearDraggingFiles();
    clearDropTarget();
  }, [clearDropTarget, store]);

  const startDrag = useCallback(
    (event: React.DragEvent, item: TreeSelectionItem) => {
      const items = collapseNestedTreeItems(selectedPathsRef.current.has(item.path) ? getSelectedItems() : [item]);
      const canMove =
        canUpdateFiles &&
        !movingRef.current &&
        items.every((selected) => directoriesRef.current[selected.parent]?.writable);
      const editorItems = items
        .filter((selected) => !selected.entry.directory)
        .map((selected) => ({ item: selected, capabilities: getDirectoryCapabilities(selected.parent) }));
      if (!canMove && editorItems.length === 0) {
        event.preventDefault();
        return;
      }

      setFileTreeEditorDragData(event.dataTransfer, editorItems);
      event.dataTransfer.setData('text/plain', items.map((entry) => entry.path).join('\n'));
      event.dataTransfer.effectAllowed = canMove ? 'copyMove' : 'copy';
      setHorizontalDragScrollLocked(true);
      if (!canMove) return;

      setDraggedPaths(new Set(items.map((entry) => entry.path)));
      store.getState().doDragFileGroups(groupTreeItems(items));
      event.dataTransfer.setData('application/x-calagopus-file-manager', 'move');
    },
    [canUpdateFiles, getDirectoryCapabilities, getSelectedItems, setHorizontalDragScrollLocked, store],
  );

  const refreshDirectories = (paths: string[]) => {
    for (const path of new Set(paths)) void loadPage(path, 1);
    store.getState().invalidateFilemanager(false);
  };

  const uploadDroppedFiles = async (dataTransfer: DataTransfer, target: string) => {
    try {
      const files = await getFilesFromDataTransfer(dataTransfer);
      if (files.length === 0) return;

      await store.getState().fileUploader.uploadFilesToDirectory(target, files);
      refreshDirectories([target]);
    } catch (error) {
      addToast(httpErrorToHuman(error), 'error');
    }
  };

  const getDropDestination = (event: React.DragEvent<HTMLDivElement>) => {
    const origin = event.target;
    if (!(origin instanceof Element)) return null;

    const element = origin.closest<HTMLElement>('[data-file-tree-drop-target]');
    if (!element || !event.currentTarget.contains(element)) return null;

    const target = element.dataset.fileTreeDropTarget;
    if (!target) return null;

    const highlightElement =
      element.dataset.fileTreeDirectory === target ? element : target === ROOT_DIRECTORY ? treeRef.current : null;

    return {
      target,
      writable: element.dataset.fileTreeDropWritable === 'true',
      highlightElement,
    };
  };

  const onTreeDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    const internalMove = store.getState().draggingFileGroups.length > 0;
    const externalUpload = !internalMove && isExternalFileDrag(event.dataTransfer);
    if (!externalUpload && !internalMove) return;

    event.preventDefault();
    event.stopPropagation();
    setHorizontalDragScrollLocked(true);
    const destination = getDropDestination(event);
    const allowed = destination
      ? externalUpload
        ? canCreateFiles && destination.writable
        : canMoveToDirectory(destination.target, destination.writable)
      : false;

    if (!allowed || !destination) {
      event.dataTransfer.dropEffect = 'none';
      clearDropTarget();
      return;
    }

    if (externalUpload) {
      event.dataTransfer.dropEffect = 'copy';
    } else {
      event.dataTransfer.dropEffect = 'move';
    }
    if (destination.highlightElement) {
      highlightDropTarget(destination.target, destination.highlightElement);
      scheduleDropTargetClear(750);
    }
  };

  const onTreeDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    scheduleDropTargetClear();
  };

  const onTreeDrop = (event: React.DragEvent<HTMLDivElement>) => {
    const internalMove = store.getState().draggingFileGroups.length > 0;
    const externalUpload = !internalMove && isExternalFileDrag(event.dataTransfer);
    if (!externalUpload && !internalMove) return;

    event.preventDefault();
    event.stopPropagation();
    const destination = getDropDestination(event);
    clearDropTarget();
    if (!destination) return;

    if (externalUpload) {
      if (!canCreateFiles || !destination.writable) return;

      void uploadDroppedFiles(event.dataTransfer, destination.target);
      return;
    }

    if (!canMoveToDirectory(destination.target, destination.writable)) return;

    getDropHandlers<HTMLDivElement>(destination.target, destination.writable).onDrop(event);
    clearSelectedItems();
    setDraggedPaths(new Set());
  };

  return (
    <ContextMenu
      enabled={canCreateFiles && createTargetWritable && !moving}
      items={[
        {
          type: 'action',
          icon: faFileCirclePlus,
          label: t('pages.server.files.quickAction.newFile', {}),
          onClick: openCreateFile,
          color: 'gray',
        },
        {
          type: 'action',
          icon: faFolderPlus,
          label: t('pages.server.files.quickAction.newDirectory', {}),
          onClick: openCreateDirectory,
          color: 'gray',
        },
      ]}
      registry={window.extensionContext.extensionRegistry.pages.server.files.newFileContextMenu}
      registryProps={{}}
    >
      {({ openMenu }) => (
        <Card
          ref={treeRef}
          p={0}
          className='flex h-(--file-manager-workspace-height) min-h-(--file-manager-workspace-min-height) w-full flex-col overflow-hidden transition-colors'
          data-file-manager-tree
          data-file-tree-directory={ROOT_DIRECTORY}
          data-file-tree-drop-target={ROOT_DIRECTORY}
          data-file-tree-drop-writable={String(directories[ROOT_DIRECTORY]?.writable ?? false)}
          onContextMenu={(event) => {
            const target = event.target;
            if (
              !canCreateFiles ||
              !createTargetWritable ||
              moving ||
              !(target instanceof Element) ||
              target.closest('[data-file-manager-tree-row], [data-file-manager-tree-toolbar], button, a, input')
            ) {
              return;
            }

            event.preventDefault();
            event.stopPropagation();
            openMenu(event.clientX, event.clientY);
          }}
          onDragOver={onTreeDragOver}
          onDragLeave={onTreeDragLeave}
          onDrop={onTreeDrop}
        >
          <FileTreeToolbar
            collapsed={collapsed}
            onToggleCollapsed={onToggleCollapsed}
            allSelected={allVisibleItemsSelected}
            someSelected={someVisibleItemsSelected}
            hasVisibleItems={visiblePaths.length > 0}
            moving={moving}
            canCreateFiles={canCreateFiles}
            createTargetWritable={createTargetWritable}
            searchOpen={searchOpen}
            searchQuery={searchQuery}
            searchLoading={searchLoading}
            searchError={searchError}
            treeLoading={treeLoading}
            analysisAvailable={directories[createTarget]?.primary ?? directories[ROOT_DIRECTORY]?.primary ?? false}
            onToggleAll={toggleAllVisibleItems}
            onOpenSearch={() => setSearchOpen(true)}
            onCloseSearch={closeSearch}
            onSearchChange={changeSearchQuery}
            onOpenCreateMenu={openMenu}
            onUploadFiles={openFileUpload}
            onUploadDirectory={openFolderUpload}
            onUploadUrl={openUrlUpload}
            onAnalysis={openAnalysis}
            onReload={reloadTree}
          />

          <div
            ref={headerRef}
            role='row'
            data-file-manager-tree-header
            className='grid h-8 min-w-(--file-manager-tree-min-content-width) shrink-0 grid-cols-(--file-manager-tree-columns) items-center gap-x-2 border-b border-(--mantine-color-default-border) text-xs font-medium text-(--mantine-color-dimmed) will-change-transform'
          >
            <span className='pl-2.5'>{t('common.table.columns.name', {})}</span>
            <span>{t('common.table.columns.size', {})}</span>
            <span>{t('pages.server.files.table.columns.modified', {})}</span>
            <span aria-hidden='true' />
          </div>

          <FileMassContextMenu
            directory={massSelectionDirectory ?? undefined}
            files={massSelectionFiles}
            writableDirectory={
              massSelectionDirectory ? getDirectoryCapabilities(massSelectionDirectory).writable : undefined
            }
          >
            {({ openMassMenu }) => (
              <FileTreeVirtualList
                rows={rows}
                itemsByPath={itemsByPath}
                activePath={activePath}
                selectedPaths={selectedPaths}
                draggedPaths={draggedPaths}
                rowHeight={rowHeight}
                moving={moving}
                canUpdateFiles={canUpdateFiles}
                preferPhysicalSize={preferPhysicalSize}
                massSelectionDirectory={massSelectionDirectory}
                openMassMenu={openMassMenu}
                headerRef={headerRef}
                viewportRef={viewportRef}
                getDirectoryCapabilities={getDirectoryCapabilities}
                isDirectoryWritable={isDirectoryWritable}
                onSelectedStart={onSelectedStart}
                onSelected={onSelected}
                onOpen={openItem}
                onToggleSelection={toggleItemSelection}
                onStartDrag={startDrag}
                onDragEnd={clearDragState}
                onLoadPage={loadPage}
              />
            )}
          </FileMassContextMenu>
        </Card>
      )}
    </ContextMenu>
  );
}

export default memo(FileTree);
