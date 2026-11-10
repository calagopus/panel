import { join } from 'pathe';
import { CSSProperties, Ref, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useBeforeUnload, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import loadDirectory from '@/api/server/files/loadDirectory.ts';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { hashContent, readFileDraft, removeFileDraft, storeFileDraft } from '@/lib/files/fileDrafts.ts';
import {
  hasOverlappingFileRenames,
  isWithinRenamedPath,
  registerFileRenameListener,
  resolveFileRenames,
} from '@/lib/files/fileRenames.ts';
import { isOpenableFile } from '@/lib/files/files.ts';
import { removeUserSetting, setUserSettingLocal, useUserSetting } from '@/lib/userSettings.ts';
import FileTree from '@/pages/server/files/tree/FileTree.tsx';
import { TreeDirectoryCapabilities, TreeSelectionItem } from '@/pages/server/files/tree/fileTreeData.ts';
import {
  FileTreeEditorSelection,
  FileTreeTabCloseAction,
  getFileTreeEditorDraftPath,
  getFileTreeEditorDragData,
  getFileTreeEditorTabDragData,
  getFileTreeEditorTabId,
} from '@/pages/server/files/tree/fileTreeEditor.ts';
import FileTreeEditorPane from '@/pages/server/files/tree/FileTreeEditorPane.tsx';
import FileTreeEditorSplit from '@/pages/server/files/tree/FileTreeEditorSplit.tsx';
import FileTreeEditorTabContent from '@/pages/server/files/tree/FileTreeEditorTabContent.tsx';
import FileTreeResizeHandle from '@/pages/server/files/tree/FileTreeResizeHandle.tsx';
import {
  closeFileTreeWorkspaceTabs,
  FileTreeEditorWorkspaceState,
  FileTreePaneDropTarget,
  normalizeFileTreeWorkspace,
  placeFileTreeTabs,
  renameFileTreeWorkspace,
  restoreFileTreeWorkspace,
  storeFileTreeWorkspace,
} from '@/pages/server/files/tree/fileTreeWorkspaceState.ts';
import useFileTreeEditorShortcuts from '@/pages/server/files/tree/useFileTreeEditorShortcuts.ts';
import useFileTreeFileCreation from '@/pages/server/files/tree/useFileTreeFileCreation.ts';
import { useBlocker } from '@/plugins/useBlocker.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useContainerAutoHeight } from '@/plugins/viewport/useContainerAutoHeight.ts';
import { usePageBreakpoint } from '@/plugins/viewport/usePageBreakpoint.ts';
import { useCurrentWindow } from '@/providers/CurrentWindowProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useFileManagerApi, useFileManagerStore } from '@/stores/fileManager.ts';
import { useServerStore } from '@/stores/server.ts';

interface FileTreeWorkspaceProps {
  ref?: Ref<FileTreeWorkspaceHandle>;
  initialDirectory: string;
  fileTreeVisible: boolean;
  onToggleFileTree: () => void;
  onDirtyStateChange: (dirty: boolean) => void;
}

export interface FileTreeWorkspaceHandle {
  createFile: () => void;
}

const FILE_TREE_WIDTH_KEY = 'file_manager::tree_width';
const fileTreeWidthSchema = z.number().positive().nullable();
// Every kept tab holds a collab session, and wings allows 8 per connection by default.
const KEPT_TAB_LIMIT = 5;

export default function FileTreeWorkspace({
  ref,
  initialDirectory,
  fileTreeVisible,
  onToggleFileTree,
  onDirtyStateChange,
}: FileTreeWorkspaceProps) {
  const { t } = useTranslations();
  const wide = usePageBreakpoint('md');
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const server = useServerStore((state) => state.server);
  const canReadContent = useServerCan('files.read-content');
  const store = useFileManagerApi();
  const editorPreviewTabs = useFileManagerStore((state) => state.editorPreviewTabs);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const treeShellRef = useRef<HTMLDivElement>(null);
  const [treeWidth] = useUserSetting(FILE_TREE_WIDTH_KEY, fileTreeWidthSchema, null);
  const { getParent } = useCurrentWindow();
  const [workspace, setWorkspace] = useState<FileTreeEditorWorkspaceState>(() => restoreFileTreeWorkspace(server.uuid));
  const [dirtyTabIds, setDirtyTabIds] = useState(
    () =>
      new Set(
        workspace.tabs
          .filter((tab) => readFileDraft(server.uuid, getFileTreeEditorDraftPath(tab)))
          .map(getFileTreeEditorTabId),
      ),
  );
  const draftContentsRef = useRef(new Map<string, string>());
  const renameDraftsRef = useRef(new Map<string, string>());
  const workspaceStateRef = useRef(workspace);
  const dirtyTabIdsRef = useRef(dirtyTabIds);
  const [revealRequest, setRevealRequest] = useState<{ path: string }>();
  const [pendingClose, setPendingClose] = useState<string[] | null>(null);
  const hasUnsavedChanges = dirtyTabIds.size > 0;
  const blocker = useBlocker(hasUnsavedChanges, true);
  useBeforeUnload((event) => {
    if (hasUnsavedChanges) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
  useEffect(() => {
    onDirtyStateChange(hasUnsavedChanges);
    return () => onDirtyStateChange(false);
  }, [hasUnsavedChanges, onDirtyStateChange]);

  useEffect(() => {
    workspaceStateRef.current = workspace;
    dirtyTabIdsRef.current = dirtyTabIds;
  });

  const tabsById = useMemo(
    () => new Map(workspace.tabs.map((tab) => [getFileTreeEditorTabId(tab), tab])),
    [workspace.tabs],
  );
  const activePane = workspace.panes.find((pane) => pane.id === workspace.activePaneId) ?? workspace.panes[0];
  const activeSelection = (activePane?.activeTabId && tabsById.get(activePane.activeTabId)) || null;

  const [keptTabIds, setKeptTabIds] = useState<string[]>([]);
  const visibleTabIds = [activePane, ...workspace.panes].flatMap((pane) =>
    pane?.activeTabId ? [pane.activeTabId] : [],
  );
  const nextKeptTabIds = [...new Set([...visibleTabIds, ...keptTabIds])]
    .filter((tabId) => tabsById.has(tabId))
    .slice(0, Math.max(KEPT_TAB_LIMIT, new Set(visibleTabIds).size));
  if (
    nextKeptTabIds.length !== keptTabIds.length ||
    nextKeptTabIds.some((tabId, index) => tabId !== keptTabIds[index])
  ) {
    setKeptTabIds(nextKeptTabIds);
  }

  useEffect(() => storeFileTreeWorkspace(server.uuid, workspace), [server.uuid, workspace]);

  const keepTabOpen = useCallback((tabId?: string) => {
    setWorkspace((current) => {
      const shouldKeep = (previewId?: string) => !!previewId && (tabId === undefined || previewId === tabId);
      if (!current.panes.some((pane) => shouldKeep(pane.previewTabId))) return current;
      return {
        ...current,
        panes: current.panes.map((pane) =>
          shouldKeep(pane.previewTabId) ? { ...pane, previewTabId: undefined } : pane,
        ),
      };
    });
  }, []);

  useEffect(() => {
    if (!editorPreviewTabs) keepTabOpen();
  }, [editorPreviewTabs, keepTabOpen]);

  useEffect(() => {
    let cancelled = false;
    const unregister = registerFileRenameListener(server.uuid, {
      before: (files) => {
        const current = workspaceStateRef.current;
        if (
          hasOverlappingFileRenames(files) &&
          current.tabs.some((tab) =>
            files.some((file) => isWithinRenamedPath(join(tab.directory, tab.file.name), file.from)),
          )
        ) {
          throw new Error(t('pages.server.files.toast.closeTabsBeforeBulkRename', {}));
        }
        const renamed = renameFileTreeWorkspace(current, files);
        const ids = current.tabs.map((tab) => {
          const id = getFileTreeEditorTabId(tab);
          return renamed.ids.get(id) ?? id;
        });
        if (new Set(ids).size !== ids.length) {
          throw new Error(t('pages.server.files.toast.closeDestinationBeforeRename', {}));
        }
      },
      after: async (result) => {
        const files = await resolveFileRenames(
          server.uuid,
          result,
          workspaceStateRef.current.tabs.map((tab) => join(tab.directory, tab.file.name)),
        );
        if (cancelled || files.length === 0) return;
        const renamed = renameFileTreeWorkspace(workspaceStateRef.current, files);
        if (renamed.ids.size === 0) return;
        for (const tab of workspaceStateRef.current.tabs) {
          const nextId = renamed.ids.get(getFileTreeEditorTabId(tab));
          if (!nextId) continue;
          const nextTab = renamed.workspace.tabs.find((entry) => getFileTreeEditorTabId(entry) === nextId);
          if (!nextTab) continue;
          const oldPath = getFileTreeEditorDraftPath(tab);
          const draft = readFileDraft(server.uuid, oldPath);
          if (draft)
            storeFileDraft(server.uuid, getFileTreeEditorDraftPath(nextTab), draft.content, draft.originalHash);
          removeFileDraft(server.uuid, oldPath);
        }
        const remapId = (id: string) => renamed.ids.get(id) ?? id;
        draftContentsRef.current = new Map(
          Array.from(draftContentsRef.current, ([id, content]) => [remapId(id), content]),
        );
        renameDraftsRef.current = new Map(
          Array.from(renameDraftsRef.current, ([id, content]) => [remapId(id), content]),
        );
        for (const id of renamed.ids.values()) {
          const content = draftContentsRef.current.get(id);
          if (content !== undefined) renameDraftsRef.current.set(id, content);
        }
        workspaceStateRef.current = renamed.workspace;
        setWorkspace(renamed.workspace);
        setDirtyTabIds((current) => new Set(Array.from(current, remapId)));
        setPendingClose((current) => current?.map(remapId) ?? null);
      },
    });
    return () => {
      cancelled = true;
      unregister();
    };
  }, [server.uuid, t]);

  const handleRenameDraftRestored = useCallback((tabId: string) => {
    renameDraftsRef.current.delete(tabId);
  }, []);

  // The CSS fallback guesses how much page chrome sits above the workspace; measure it instead so
  // the panes end exactly at the viewport bottom rather than pushing the page into a short scroll.
  useContainerAutoHeight({
    containerRef: workspaceRef,
    loading: false,
    getParent,
    layout: () => undefined,
    cssVariable: '--file-manager-workspace-height',
    useVisualViewportInset: true,
    minHeightFraction: 0.6,
    deps: [getParent],
  });

  // Restored tabs carry writable/primary snapshots from when they were opened; verify them against the
  // live filesystem once per mount (the component is keyed by server uuid).
  useEffect(() => {
    const directories = new Set(workspace.tabs.map((tab) => tab.directory));
    if (directories.size === 0) return;

    let cancelled = false;
    for (const directory of directories) {
      // Loaded directly rather than through the query cache: the list view holds this directory
      // under an infinite query, and writing a single page under that key breaks its pagination.
      loadDirectory(server.uuid, directory, 1, 'name_asc')
        .then((response) => {
          if (cancelled) return;

          setWorkspace((current) => {
            const stale = current.tabs.some(
              (tab) =>
                tab.directory === directory &&
                (tab.writable !== response.isFilesystemWritable || tab.primary !== response.isFilesystemPrimary),
            );
            if (!stale) return current;

            return {
              ...current,
              tabs: current.tabs.map((tab) =>
                tab.directory === directory
                  ? { ...tab, writable: response.isFilesystemWritable, primary: response.isFilesystemPrimary }
                  : tab,
              ),
            };
          });
        })
        .catch(() => undefined);
    }

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    store.getState().doSelectFiles([]);
  }, [store]);

  useEffect(() => {
    if (!activeSelection) return;

    store.getState().setBrowsingContext({
      directory: activeSelection.directory,
      primary: activeSelection.primary,
      writable: activeSelection.writable,
    });
  }, [activeSelection, store]);

  const handleDraftChange = useCallback(
    (tabId: string, content: string | null) => {
      if (content === null) {
        draftContentsRef.current.delete(tabId);
        renameDraftsRef.current.delete(tabId);
      } else {
        if (!draftContentsRef.current.has(tabId)) keepTabOpen(tabId);
        draftContentsRef.current.set(tabId, content);
      }
    },
    [keepTabOpen],
  );

  const requestSelectTab = useCallback((paneId: string, tabId: string) => {
    setWorkspace((current) => {
      const pane = current.panes.find((candidate) => candidate.id === paneId);
      if (!pane?.tabIds.includes(tabId) || (pane.activeTabId === tabId && current.activePaneId === paneId)) {
        return current;
      }

      return {
        ...current,
        activePaneId: paneId,
        panes: current.panes.map((candidate) =>
          candidate.id === paneId ? { ...candidate, activeTabId: tabId } : candidate,
        ),
      };
    });
  }, []);

  const revealTab = (tabId: string) => {
    const tab = workspaceStateRef.current.tabs.find((entry) => getFileTreeEditorTabId(entry) === tabId);
    if (!tab || tab.action === 'new') return;
    if (!fileTreeVisible) onToggleFileTree();
    setRevealRequest({ path: join(tab.directory, tab.file.name) });
  };

  const requestOpenTab = useCallback(
    (next: FileTreeEditorSelection) => {
      const tabId = getFileTreeEditorTabId(next);

      setWorkspace((current) => {
        const existingPane = current.panes.find((pane) => pane.tabIds.includes(tabId));
        const pane = existingPane ?? current.panes.find((candidate) => candidate.id === current.activePaneId);
        if (!pane) return current;

        const preview = current.tabs.find((tab) => getFileTreeEditorTabId(tab) === pane.previewTabId);
        const hasDraft = (tab: FileTreeEditorSelection) => {
          const id = getFileTreeEditorTabId(tab);
          return (
            dirtyTabIdsRef.current.has(id) ||
            draftContentsRef.current.has(id) ||
            !!readFileDraft(server.uuid, getFileTreeEditorDraftPath(tab))
          );
        };
        const openAsPreview = editorPreviewTabs && !existingPane && next.action !== 'new' && !hasDraft(next);
        const replacing =
          openAsPreview && preview && preview.action !== 'new' && !hasDraft(preview) ? pane.previewTabId : undefined;
        const existingTabIndex = current.tabs.findIndex((tab) => getFileTreeEditorTabId(tab) === tabId);
        const tabs = current.tabs.filter((tab) => getFileTreeEditorTabId(tab) !== replacing);
        if (existingTabIndex === -1) tabs.push(next);
        else tabs[existingTabIndex] = next;
        const panes = current.panes.map((candidate) =>
          candidate.id === pane.id
            ? {
                ...candidate,
                tabIds: replacing
                  ? candidate.tabIds.map((id) => (id === replacing ? tabId : id))
                  : candidate.tabIds.includes(tabId)
                    ? candidate.tabIds
                    : [...candidate.tabIds, tabId],
                activeTabId: tabId,
                previewTabId: openAsPreview ? tabId : candidate.previewTabId,
              }
            : candidate,
        );

        return normalizeFileTreeWorkspace({ tabs, panes, activePaneId: pane.id });
      });
    },
    [editorPreviewTabs, server.uuid],
  );

  const { createFile: createNewFile, saveNewFile } = useFileTreeFileCreation({
    initialTabCount: workspace.tabs.length,
    getTabs: () => workspaceStateRef.current.tabs,
    getDraftContent: (tabId) => draftContentsRef.current.get(tabId),
    onSaved: (tab, nextTab, submitted) => {
      const tabId = getFileTreeEditorTabId(tab);
      const nextId = getFileTreeEditorTabId(nextTab);
      const filePath = join(nextTab.directory, nextTab.file.name);
      const latest = draftContentsRef.current.get(tabId) ?? '';
      const stillDirty = latest !== submitted;
      if (stillDirty) {
        draftContentsRef.current.set(nextId, latest);
        renameDraftsRef.current.set(nextId, latest);
        storeFileDraft(server.uuid, filePath, latest, hashContent(submitted));
      } else removeFileDraft(server.uuid, filePath);
      draftContentsRef.current.delete(tabId);
      removeFileDraft(server.uuid, getFileTreeEditorDraftPath(tab));
      setPendingClose((current) => current?.map((id) => (id === tabId ? nextId : id)) ?? null);
      setDirtyTabIds((current) => {
        const next = new Set(current);
        next.delete(tabId);
        if (stillDirty) next.add(nextId);
        return next;
      });
      setWorkspace((current) =>
        normalizeFileTreeWorkspace({
          ...current,
          tabs: current.tabs.map((entry) => (getFileTreeEditorTabId(entry) === tabId ? nextTab : entry)),
          panes: current.panes.map((pane) => ({
            ...pane,
            tabIds: pane.tabIds.map((id) => (id === tabId ? nextId : id)),
            activeTabId: pane.activeTabId === tabId ? nextId : pane.activeTabId,
          })),
        }),
      );
    },
  });

  const createFile = (directory: string, capabilities: TreeDirectoryCapabilities) => {
    const tab = createNewFile(directory, capabilities);
    if (!tab) return;
    requestOpenTab(tab);
    if (!wide && fileTreeVisible) onToggleFileTree();
  };

  useImperativeHandle(ref, () => ({
    createFile: () => {
      const state = store.getState();
      createFile(state.browsingDirectory, {
        primary: state.browsingPrimaryFilesystem,
        writable: state.browsingWritableDirectory,
        fast: state.browsingFastDirectory,
      });
    },
  }));

  const commitCloseTabs = useCallback(
    (tabIds: string[]) => {
      const closing = new Set(tabIds);
      for (const tab of workspaceStateRef.current.tabs) {
        const id = getFileTreeEditorTabId(tab);
        if (!closing.has(id)) continue;
        removeFileDraft(server.uuid, getFileTreeEditorDraftPath(tab));
        draftContentsRef.current.delete(id);
        renameDraftsRef.current.delete(id);
      }
      setWorkspace((current) => closeFileTreeWorkspaceTabs(current, closing));
      setDirtyTabIds((current) => new Set([...current].filter((id) => !closing.has(id))));
    },
    [server.uuid],
  );

  const closeMissingTab = useCallback((tabId: string) => commitCloseTabs([tabId]), [commitCloseTabs]);

  const requestCloseTab = useCallback(
    (paneId: string, tabId: string, action?: FileTreeTabCloseAction) => {
      const current = workspaceStateRef.current;
      const pane = current.panes.find((candidate) => candidate.id === paneId);
      if (!pane?.tabIds.includes(tabId)) return;
      const dirty = dirtyTabIdsRef.current;
      const tabIndex = pane.tabIds.indexOf(tabId);
      const newTabIds = new Set(current.tabs.filter((tab) => tab.action === 'new').map(getFileTreeEditorTabId));
      const tabIds = pane.tabIds.filter((id, index) => {
        switch (action) {
          case 'others':
            return id !== tabId;
          case 'right':
            return index > tabIndex;
          case 'saved':
            return !dirty.has(id) && !newTabIds.has(id);
          case 'all':
            return true;
          default:
            return id === tabId;
        }
      });
      if (tabIds.length === 0) return;
      if (tabIds.some((id) => dirty.has(id))) setPendingClose(tabIds);
      else commitCloseTabs(tabIds);
    },
    [commitCloseTabs],
  );

  const resolveEditorSelection = useCallback(
    (
      item: TreeSelectionItem,
      capabilities: TreeDirectoryCapabilities,
      onResolved: (selection: FileTreeEditorSelection) => void,
    ) => {
      if (!canReadContent) return;

      const fileManagerContext = {
        ...store.getState(),
        browsingDirectory: item.parent,
        browsingPrimaryFilesystem: capabilities.primary,
        browsingWritableDirectory: capabilities.writable,
        browsingFastDirectory: capabilities.fast,
      };
      const openMode = isOpenableFile(item.entry, fileManagerContext);

      if (!openMode.openable) {
        if (openMode.reason === 'tooLarge') {
          addToast(t('pages.server.files.toast.fileTooLargeToOpen', {}), 'warning');
        }
        return;
      }

      openMode.handleOpen({
        server,
        fileManagerContext,
        navigate,
        setSearchParams,
        handleDirectoryOpen: (path) => {
          const directory = join(item.parent, path);
          fileManagerContext.setBrowsingDirectory(directory);
          setSearchParams({ directory });
        },
        handleFileOpen: (file, action, params) =>
          onResolved({
            directory: item.parent,
            file: file === item.entry.name ? item.entry : { ...item.entry, name: file },
            action,
            params,
            primary: capabilities.primary,
            writable: capabilities.writable,
          }),
      });
    },
    [addToast, canReadContent, navigate, server, setSearchParams, store, t],
  );

  const openFile = useCallback(
    (item: TreeSelectionItem, capabilities: TreeDirectoryCapabilities) =>
      resolveEditorSelection(item, capabilities, requestOpenTab),
    [requestOpenTab, resolveEditorSelection],
  );

  const handleEditorDrop = useCallback(
    (target: FileTreePaneDropTarget, dataTransfer: DataTransfer) => {
      const tabDrag = getFileTreeEditorTabDragData(dataTransfer);
      if (tabDrag) {
        setWorkspace((current) => {
          const tab = current.tabs.find((entry) => getFileTreeEditorTabId(entry) === tabDrag.tabId);
          return tab ? placeFileTreeTabs(current, [tab], target) : current;
        });
        return;
      }

      const selections: FileTreeEditorSelection[] = [];
      for (const { item, capabilities } of getFileTreeEditorDragData(dataTransfer)) {
        resolveEditorSelection(item, capabilities, (selection) => selections.push(selection));
      }
      if (selections.length > 0) setWorkspace((current) => placeFileTreeTabs(current, selections, target));
    },
    [resolveEditorSelection],
  );

  const resizePanes = useCallback((leftPaneId: string, rightPaneId: string, leftSize: number, rightSize: number) => {
    setWorkspace((current) => ({
      ...current,
      panes: current.panes.map((pane) =>
        pane.id === leftPaneId
          ? { ...pane, size: leftSize }
          : pane.id === rightPaneId
            ? { ...pane, size: rightSize }
            : pane,
      ),
    }));
  }, []);

  const equalizePanes = useCallback(() => {
    setWorkspace((current) => ({ ...current, panes: current.panes.map((pane) => ({ ...pane, size: 1 })) }));
  }, []);

  const resizeTree = useCallback(
    (width: number | null) => {
      if (width !== null) setUserSettingLocal(FILE_TREE_WIDTH_KEY, width);
      else if (treeWidth !== null) removeUserSetting(FILE_TREE_WIDTH_KEY);
    },
    [treeWidth],
  );

  const handleDirtyChange = useCallback(
    (tabId: string, dirty: boolean) => {
      if (dirty) keepTabOpen(tabId);
      setDirtyTabIds((current) => {
        if (current.has(tabId) === dirty) return current;

        const next = new Set(current);
        if (dirty) next.add(tabId);
        else next.delete(tabId);
        return next;
      });
    },
    [keepTabOpen],
  );

  useFileTreeEditorShortcuts({
    tabIds: activePane?.tabIds ?? [],
    activeTabId: activePane?.activeTabId ?? null,
    onClose: (tabId) => activePane && requestCloseTab(activePane.id, tabId),
    onSelect: (tabId) => activePane && requestSelectTab(activePane.id, tabId),
  });

  return (
    <>
      {/* The workspace is measured to the viewport bottom, so it is taken out of flow like the file
          editor's - left in it, its full height would push the page into a permanent short scroll. */}
      <div className='relative w-full min-w-0 self-stretch'>
        <div
          ref={workspaceRef}
          data-file-manager-workspace
          className='absolute inset-x-0 top-0 max-w-none overflow-x-auto overflow-y-hidden bg-(--mantine-color-body)'
        >
          <div
            ref={gridRef}
            data-file-manager-workspace-grid
            data-file-manager-tree-visible={fileTreeVisible}
            className='file-manager-workspace-grid relative transition-[grid-template-columns] duration-200 ease-in-out motion-reduce:transition-none'
            style={
              treeWidth !== null ? ({ '--file-manager-tree-width': `${treeWidth}px` } as CSSProperties) : undefined
            }
          >
            <div
              ref={treeShellRef}
              data-file-manager-tree-shell
              data-file-manager-tree-collapsed={!fileTreeVisible}
              className={`file-manager-tree-shell w-full min-w-0 overflow-hidden transition-[height,min-height] duration-200 ease-in-out motion-reduce:transition-none ${
                fileTreeVisible
                  ? 'h-(--file-manager-workspace-height) min-h-(--file-manager-workspace-min-height)'
                  : 'h-11 min-h-11'
              }`}
            >
              <FileTree
                revealRequest={revealRequest}
                activePath={
                  activeSelection && activeSelection.action !== 'new'
                    ? join(activeSelection.directory, activeSelection.file.name)
                    : null
                }
                onCreateFile={createFile}
                initialDirectory={initialDirectory}
                collapsed={!fileTreeVisible}
                onToggleCollapsed={onToggleFileTree}
                onOpenFile={(...args) => {
                  openFile(...args);
                  if (!wide && fileTreeVisible) onToggleFileTree();
                }}
              />
            </div>
            {fileTreeVisible && (
              <FileTreeResizeHandle
                gridRef={gridRef}
                treeRef={treeShellRef}
                label={t('pages.server.files.tree.resizeFileTree', {})}
                onResize={resizeTree}
              />
            )}
            <FileTreeEditorSplit
              panes={workspace.panes}
              activePaneId={workspace.activePaneId}
              resizeLabel={t('pages.server.files.tree.resizeEditorPanes', {})}
              onActivatePane={(paneId) => setWorkspace((current) => ({ ...current, activePaneId: paneId }))}
              onDrop={handleEditorDrop}
              onResize={resizePanes}
              onEqualize={equalizePanes}
              renderPane={(pane, paneIndex) => {
                const paneTabs = pane.tabIds.flatMap((tabId) => {
                  const tab = tabsById.get(tabId);
                  return tab ? [tab] : [];
                });

                return (
                  <FileTreeEditorPane
                    key={pane.id}
                    paneId={pane.id}
                    active={pane.id === workspace.activePaneId}
                    tabs={paneTabs}
                    activeTabId={pane.activeTabId}
                    previewTabId={pane.previewTabId}
                    dirtyTabIds={dirtyTabIds}
                    onSelectTab={(tabId) => requestSelectTab(pane.id, tabId)}
                    onCloseTab={(tabId, action) => requestCloseTab(pane.id, tabId, action)}
                    onDropOnTabs={(dataTransfer, position) =>
                      handleEditorDrop({ paneId: pane.id, position }, dataTransfer)
                    }
                    onRevealTab={revealTab}
                    onKeepTabOpen={keepTabOpen}
                  >
                    {paneTabs.map((tab) => {
                      const tabId = getFileTreeEditorTabId(tab);
                      if (!keptTabIds.includes(tabId)) return null;
                      const visible = tabId === pane.activeTabId;

                      return (
                        <FileTreeEditorTabContent
                          key={tabId}
                          tabId={tabId}
                          paneId={pane.id}
                          paneIndex={paneIndex}
                          paneCount={workspace.panes.length}
                          visible={visible}
                          active={visible && pane.id === workspace.activePaneId}
                          selection={tab}
                          draftContent={draftContentsRef.current.get(tabId)}
                          restoreContent={renameDraftsRef.current.get(tabId)}
                          onRestoreContent={handleRenameDraftRestored}
                          onClose={requestCloseTab}
                          onMissing={closeMissingTab}
                          onDirtyChange={handleDirtyChange}
                          onDraftChange={handleDraftChange}
                          onCreateFile={saveNewFile}
                        />
                      );
                    })}
                  </FileTreeEditorPane>
                );
              }}
            />
          </div>
        </div>
      </div>

      <ConfirmationModal
        title={t('pages.server.files.modal.unsavedChanges.title', {})}
        opened={blocker.state === 'blocked'}
        onClose={blocker.reset}
        onConfirmed={blocker.proceed}
        confirm={t('common.button.leavePage', {})}
      >
        {t('pages.server.files.modal.unsavedChanges.content', {}).md()}
      </ConfirmationModal>

      <ConfirmationModal
        title={t('pages.server.files.modal.unsavedChanges.title', {})}
        opened={pendingClose !== null}
        onClose={() => setPendingClose(null)}
        onConfirmed={() => {
          if (pendingClose) commitCloseTabs(pendingClose);
          setPendingClose(null);
        }}
        confirm={t('common.button.discard', {})}
      >
        {t('pages.server.files.modal.unsavedChanges.content', {}).md()}
      </ConfirmationModal>
    </>
  );
}
