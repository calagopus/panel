import { useMediaQuery } from '@mantine/hooks';
import { join } from 'pathe';
import { Ref, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useBeforeUnload, useNavigate, useSearchParams } from 'react-router';
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
import FileTree from '@/pages/server/files/tree/FileTree.tsx';
import FileTreeEditorPane from '@/pages/server/files/tree/FileTreeEditorPane.tsx';
import FileTreeEditorSplit from '@/pages/server/files/tree/FileTreeEditorSplit.tsx';
import { TreeDirectoryCapabilities, TreeSelectionItem } from '@/pages/server/files/tree/fileTreeData.ts';
import {
  FileTreeEditorDragItem,
  FileTreeEditorSelection,
  FileTreeTabCloseAction,
  FileTreeTabPosition,
  getFileTreeEditorDraftPath,
  getFileTreeEditorDragData,
  getFileTreeEditorTabDragData,
  getFileTreeEditorTabId,
} from '@/pages/server/files/tree/fileTreeEditor.ts';
import {
  closeFileTreeWorkspaceTabs,
  createFileTreePaneId,
  FileTreeEditorWorkspaceState,
  normalizeFileTreeWorkspace,
  renameFileTreeWorkspace,
  restoreFileTreeWorkspace,
  storeFileTreeWorkspace,
} from '@/pages/server/files/tree/fileTreeWorkspaceState.ts';
import useFileTreeEditorShortcuts from '@/pages/server/files/tree/useFileTreeEditorShortcuts.ts';
import useFileTreeFileCreation from '@/pages/server/files/tree/useFileTreeFileCreation.ts';
import { useBlocker } from '@/plugins/useBlocker.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useContainerAutoHeight } from '@/plugins/viewport/useContainerAutoHeight.ts';
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

export default function FileTreeWorkspace({
  ref,
  initialDirectory,
  fileTreeVisible,
  onToggleFileTree,
  onDirtyStateChange,
}: FileTreeWorkspaceProps) {
  const { t } = useTranslations();
  const mobile = useMediaQuery('(max-width: 47.999rem)');
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const server = useServerStore((state) => state.server);
  const canReadContent = useServerCan('files.read-content');
  const store = useFileManagerApi();
  const editorPreviewTabs = useFileManagerStore((state) => state.editorPreviewTabs);
  const workspaceRef = useRef<HTMLDivElement>(null);
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
    if (mobile && fileTreeVisible) onToggleFileTree();
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

  const openFilesInSplit = useCallback(
    (dragItems: FileTreeEditorDragItem[], targetPaneId: string) => {
      const selections: FileTreeEditorSelection[] = [];
      for (const { item, capabilities } of dragItems) {
        resolveEditorSelection(item, capabilities, (selection) => selections.push(selection));
      }
      if (selections.length === 0) return;

      setWorkspace((current) => {
        let tabs = [...current.tabs];
        let panes = current.panes.map((pane) => ({ ...pane, tabIds: [...pane.tabIds] }));
        let insertIndex = Math.max(
          0,
          panes.findIndex((pane) => pane.id === targetPaneId),
        );
        let activePaneId = targetPaneId;

        for (const selection of selections) {
          const tabId = getFileTreeEditorTabId(selection);
          const targetPane = panes.find((pane) => pane.id === targetPaneId);
          if (targetPane?.activeTabId === tabId) continue;

          tabs = tabs.some((tab) => getFileTreeEditorTabId(tab) === tabId)
            ? tabs.map((tab) => (getFileTreeEditorTabId(tab) === tabId ? selection : tab))
            : [...tabs, selection];

          const sourcePane = panes.find((pane) => pane.tabIds.includes(tabId));
          if (sourcePane) {
            const sourceIndex = sourcePane.tabIds.indexOf(tabId);
            sourcePane.tabIds = sourcePane.tabIds.filter((candidate) => candidate !== tabId);
            if (sourcePane.activeTabId === tabId) {
              sourcePane.activeTabId = sourcePane.tabIds[Math.min(sourceIndex, sourcePane.tabIds.length - 1)] ?? null;
            }
          }

          if (targetPane && targetPane.tabIds.length === 0 && selections.length === 1) {
            targetPane.tabIds = [tabId];
            targetPane.activeTabId = tabId;
            activePaneId = targetPane.id;
          } else {
            const paneId = createFileTreePaneId();
            insertIndex += 1;
            panes.splice(insertIndex, 0, { id: paneId, tabIds: [tabId], activeTabId: tabId, size: 1 });
            activePaneId = paneId;
          }

          panes = panes.filter((pane) => pane.tabIds.length > 0 || panes.length === 1);
        }

        return normalizeFileTreeWorkspace({ tabs, panes, activePaneId });
      });
    },
    [resolveEditorSelection],
  );

  const moveTabToPane = useCallback(
    (tabId: string, sourcePaneId: string, targetPaneId: string, position?: FileTreeTabPosition) => {
      setWorkspace((current) => {
        const sourcePane = current.panes.find((pane) => pane.id === sourcePaneId);
        const targetPane = current.panes.find((pane) => pane.id === targetPaneId);
        if (!sourcePane || !targetPane || !sourcePane.tabIds.includes(tabId)) return current;
        if (position && (!targetPane.tabIds.includes(position.tabId) || position.tabId === tabId)) return current;
        const panes = current.panes.map((pane) => ({ ...pane, tabIds: [...pane.tabIds] }));
        const source = panes.find((pane) => pane.id === sourcePaneId)!;
        if (source.previewTabId === tabId) source.previewTabId = undefined;
        const sourceIndex = source.tabIds.indexOf(tabId);
        source.tabIds = source.tabIds.filter((candidate) => candidate !== tabId);
        if (sourcePaneId === targetPaneId && position) {
          source.tabIds.splice(source.tabIds.indexOf(position.tabId) + Number(position.after), 0, tabId);
          return { ...current, panes };
        }
        if (source.activeTabId === tabId) {
          source.activeTabId = source.tabIds[Math.min(sourceIndex, source.tabIds.length - 1)] ?? null;
        }

        let activePaneId = targetPaneId;
        if (sourcePaneId === targetPaneId) {
          if (source.tabIds.length === 0) return current;

          const newPaneId = createFileTreePaneId();
          const paneIndex = panes.findIndex((pane) => pane.id === sourcePaneId);
          panes.splice(paneIndex + 1, 0, { id: newPaneId, tabIds: [tabId], activeTabId: tabId, size: 1 });
          activePaneId = newPaneId;
        } else {
          const target = panes.find((pane) => pane.id === targetPaneId)!;
          const insertIndex = position
            ? target.tabIds.indexOf(position.tabId) + Number(position.after)
            : target.tabIds.length;
          target.tabIds.splice(insertIndex, 0, tabId);
          target.activeTabId = tabId;
        }

        return normalizeFileTreeWorkspace({ tabs: current.tabs, panes, activePaneId });
      });
    },
    [],
  );

  const handleEditorDrop = useCallback(
    (paneId: string, dataTransfer: DataTransfer) => {
      const tabDrag = getFileTreeEditorTabDragData(dataTransfer);
      if (tabDrag) {
        moveTabToPane(tabDrag.tabId, tabDrag.paneId, paneId);
        return;
      }

      const fileDrag = getFileTreeEditorDragData(dataTransfer);
      if (fileDrag.length > 0) openFilesInSplit(fileDrag, paneId);
    },
    [moveTabToPane, openFilesInSplit],
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
          className='absolute inset-x-0 top-0 max-w-none overflow-x-auto overflow-y-hidden'
        >
          <div
            data-file-manager-workspace-grid
            data-file-manager-tree-visible={fileTreeVisible}
            className='file-manager-workspace-grid transition-[grid-template-columns] duration-200 ease-in-out motion-reduce:transition-none'
          >
            <div
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
                  if (mobile && fileTreeVisible) onToggleFileTree();
                }}
              />
            </div>
            <FileTreeEditorSplit
              panes={workspace.panes}
              activePaneId={workspace.activePaneId}
              dropLabel={t('pages.server.files.tree.dropToSplit', {})}
              resizeLabel={t('pages.server.files.tree.resizeEditorPanes', {})}
              onActivatePane={(paneId) => setWorkspace((current) => ({ ...current, activePaneId: paneId }))}
              onDrop={handleEditorDrop}
              onResize={resizePanes}
              renderPane={(pane, paneIndex) => {
                const paneTabs = pane.tabIds.flatMap((tabId) => {
                  const tab = tabsById.get(tabId);
                  return tab ? [tab] : [];
                });
                const selection = (pane.activeTabId && tabsById.get(pane.activeTabId)) || null;

                return (
                  <FileTreeEditorPane
                    key={`${pane.id}:${pane.activeTabId ?? 'empty'}`}
                    paneId={pane.id}
                    paneIndex={paneIndex}
                    paneCount={workspace.panes.length}
                    active={pane.id === workspace.activePaneId}
                    tabs={paneTabs}
                    activeTabId={pane.activeTabId}
                    previewTabId={pane.previewTabId}
                    dirtyTabIds={dirtyTabIds}
                    selection={selection}
                    draftContent={pane.activeTabId ? draftContentsRef.current.get(pane.activeTabId) : undefined}
                    onSelectTab={(tabId) => requestSelectTab(pane.id, tabId)}
                    onCloseTab={(tabId, action) => requestCloseTab(pane.id, tabId, action)}
                    onMoveTab={(drag, position) => moveTabToPane(drag.tabId, drag.paneId, pane.id, position)}
                    onRevealTab={revealTab}
                    onKeepTabOpen={keepTabOpen}
                    onClose={() => pane.activeTabId && requestCloseTab(pane.id, pane.activeTabId)}
                    onMissing={(tabId) => commitCloseTabs([tabId])}
                    onDirtyChange={handleDirtyChange}
                    restoreContent={pane.activeTabId ? renameDraftsRef.current.get(pane.activeTabId) : undefined}
                    onRestoreContent={handleRenameDraftRestored}
                    onDraftChange={handleDraftChange}
                    onCreateFile={(name) =>
                      pane.activeTabId ? saveNewFile(pane.activeTabId, name) : Promise.resolve()
                    }
                  />
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
