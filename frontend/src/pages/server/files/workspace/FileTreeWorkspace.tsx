import { join } from 'pathe';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { isOpenableFile } from '@/lib/files/files.ts';
import FileTree from '@/pages/server/files/workspace/FileTree.tsx';
import FileTreeEditorPane from '@/pages/server/files/workspace/FileTreeEditorPane.tsx';
import FileTreeEditorSplit from '@/pages/server/files/workspace/FileTreeEditorSplit.tsx';
import { TreeDirectoryCapabilities, TreeSelectionItem } from '@/pages/server/files/workspace/fileTreeData.ts';
import {
  FileTreeEditorDragItem,
  FileTreeEditorSelection,
  getFileTreeEditorDragData,
  getFileTreeEditorTabDragData,
  getFileTreeEditorTabId,
} from '@/pages/server/files/workspace/fileTreeEditor.ts';
import {
  createFileTreePaneId,
  FileTreeEditorWorkspaceState,
  normalizeFileTreeWorkspace,
  restoreFileTreeWorkspace,
  storeFileTreeWorkspace,
} from '@/pages/server/files/workspace/fileTreeWorkspaceState.ts';
import useFileTreeEditorShortcuts from '@/pages/server/files/workspace/useFileTreeEditorShortcuts.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useFileManagerApi } from '@/stores/fileManager.ts';
import { useServerStore } from '@/stores/server.ts';

interface PendingTabClose {
  paneId: string;
  tabId: string;
}

interface FileTreeWorkspaceProps {
  fileTreeVisible: boolean;
  onToggleFileTree: () => void;
}

export default function FileTreeWorkspace({ fileTreeVisible, onToggleFileTree }: FileTreeWorkspaceProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const server = useServerStore((state) => state.server);
  const canReadContent = useServerCan('files.read-content');
  const store = useFileManagerApi();
  const [workspace, setWorkspace] = useState<FileTreeEditorWorkspaceState>(() => restoreFileTreeWorkspace(server.uuid));
  const [dirtyTabIds, setDirtyTabIds] = useState(() => new Set<string>());
  const draftContentsRef = useRef(new Map<string, string>());
  const [pendingClose, setPendingClose] = useState<PendingTabClose | null>(null);

  const tabsById = useMemo(
    () => new Map(workspace.tabs.map((tab) => [getFileTreeEditorTabId(tab), tab])),
    [workspace.tabs],
  );
  const activePane = workspace.panes.find((pane) => pane.id === workspace.activePaneId) ?? workspace.panes[0];
  const activeSelection = (activePane?.activeTabId && tabsById.get(activePane.activeTabId)) || null;

  useEffect(() => storeFileTreeWorkspace(server.uuid, workspace), [server.uuid, workspace]);

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

  const clearDirty = useCallback((tabId: string) => {
    setDirtyTabIds((current) => {
      if (!current.has(tabId)) return current;

      const next = new Set(current);
      next.delete(tabId);
      return next;
    });
  }, []);

  const handleDraftChange = useCallback((tabId: string, content: string | null) => {
    if (content === null) draftContentsRef.current.delete(tabId);
    else draftContentsRef.current.set(tabId, content);
  }, []);

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

  const requestOpenTab = useCallback((next: FileTreeEditorSelection) => {
    const tabId = getFileTreeEditorTabId(next);

    setWorkspace((current) => {
      const existingPane = current.panes.find((pane) => pane.tabIds.includes(tabId));
      const pane = existingPane ?? current.panes.find((candidate) => candidate.id === current.activePaneId);
      if (!pane) return current;

      const existingTabIndex = current.tabs.findIndex((tab) => getFileTreeEditorTabId(tab) === tabId);
      const tabs = [...current.tabs];
      if (existingTabIndex === -1) tabs.push(next);
      else tabs[existingTabIndex] = next;
      const panes = current.panes.map((candidate) =>
        candidate.id === pane.id
          ? {
              ...candidate,
              tabIds: candidate.tabIds.includes(tabId) ? candidate.tabIds : [...candidate.tabIds, tabId],
              activeTabId: tabId,
            }
          : candidate,
      );

      return normalizeFileTreeWorkspace({ tabs, panes, activePaneId: pane.id });
    });
  }, []);

  const commitCloseTab = useCallback(
    (requestedPaneId: string, tabId: string) => {
      setWorkspace((current) => {
        const paneIndex = current.panes.findIndex((pane) => pane.id === requestedPaneId && pane.tabIds.includes(tabId));
        const actualPaneIndex =
          paneIndex === -1 ? current.panes.findIndex((pane) => pane.tabIds.includes(tabId)) : paneIndex;
        if (actualPaneIndex === -1) return current;

        const pane = current.panes[actualPaneIndex];
        const closingIndex = pane.tabIds.indexOf(tabId);
        const remainingTabIds = pane.tabIds.filter((candidate) => candidate !== tabId);
        let panes = current.panes.map((candidate, index) =>
          index === actualPaneIndex
            ? {
                ...candidate,
                tabIds: remainingTabIds,
                activeTabId:
                  candidate.activeTabId === tabId
                    ? (remainingTabIds[Math.min(closingIndex, remainingTabIds.length - 1)] ?? null)
                    : candidate.activeTabId,
              }
            : candidate,
        );
        let activePaneId = current.activePaneId;

        if (remainingTabIds.length === 0 && panes.length > 1) {
          panes = panes.filter((_, index) => index !== actualPaneIndex);
          if (activePaneId === pane.id) {
            activePaneId = panes[Math.min(actualPaneIndex, panes.length - 1)].id;
          }
        }

        return normalizeFileTreeWorkspace({
          tabs: current.tabs.filter((tab) => getFileTreeEditorTabId(tab) !== tabId),
          panes,
          activePaneId,
        });
      });
      draftContentsRef.current.delete(tabId);
      clearDirty(tabId);
    },
    [clearDirty],
  );

  const requestCloseTab = useCallback(
    (paneId: string, tabId: string) => {
      if (dirtyTabIds.has(tabId)) setPendingClose({ paneId, tabId });
      else commitCloseTab(paneId, tabId);
    },
    [commitCloseTab, dirtyTabIds],
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

  const moveTabToPane = useCallback((tabId: string, sourcePaneId: string, targetPaneId: string) => {
    setWorkspace((current) => {
      const sourcePane = current.panes.find((pane) => pane.id === sourcePaneId);
      const targetPane = current.panes.find((pane) => pane.id === targetPaneId);
      if (!sourcePane || !targetPane || !sourcePane.tabIds.includes(tabId)) return current;
      const panes = current.panes.map((pane) => ({ ...pane, tabIds: [...pane.tabIds] }));
      const source = panes.find((pane) => pane.id === sourcePaneId)!;
      const sourceIndex = source.tabIds.indexOf(tabId);
      source.tabIds = source.tabIds.filter((candidate) => candidate !== tabId);
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
        target.tabIds = target.tabIds.includes(tabId) ? target.tabIds : [...target.tabIds, tabId];
        target.activeTabId = tabId;
      }

      return normalizeFileTreeWorkspace({ tabs: current.tabs, panes, activePaneId });
    });
  }, []);

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

  const handleDirtyChange = useCallback((tabId: string, dirty: boolean) => {
    setDirtyTabIds((current) => {
      if (current.has(tabId) === dirty) return current;

      const next = new Set(current);
      if (dirty) next.add(tabId);
      else next.delete(tabId);
      return next;
    });
  }, []);

  useFileTreeEditorShortcuts({
    tabIds: activePane?.tabIds ?? [],
    activeTabId: activePane?.activeTabId ?? null,
    onClose: (tabId) => activePane && requestCloseTab(activePane.id, tabId),
    onSelect: (tabId) => activePane && requestSelectTab(activePane.id, tabId),
  });

  return (
    <>
      <div data-file-manager-workspace className='w-full max-w-none self-stretch overflow-x-auto overflow-y-hidden'>
        <div
          data-file-manager-workspace-grid
          data-file-manager-tree-visible={fileTreeVisible}
          className='file-manager-workspace-grid'
        >
          <div
            data-file-manager-tree-shell
            data-file-manager-tree-collapsed={!fileTreeVisible}
            className={`file-manager-tree-shell h-(--file-manager-workspace-height) min-h-(--file-manager-workspace-min-height) min-w-0 overflow-hidden transition-[width] duration-[180ms] [transition-timing-function:ease] motion-reduce:transition-none max-[47.999rem]:w-full ${
              fileTreeVisible
                ? 'w-(--file-manager-tree-width)'
                : 'w-(--file-manager-tree-collapsed-width) max-[47.999rem]:h-11 max-[47.999rem]:min-h-11'
            }`}
          >
            <FileTree collapsed={!fileTreeVisible} onToggleCollapsed={onToggleFileTree} onOpenFile={openFile} />
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
                  dirtyTabIds={dirtyTabIds}
                  selection={selection}
                  draftContent={pane.activeTabId ? draftContentsRef.current.get(pane.activeTabId) : undefined}
                  onSelectTab={(tabId) => requestSelectTab(pane.id, tabId)}
                  onCloseTab={(tabId) => requestCloseTab(pane.id, tabId)}
                  onClose={() => pane.activeTabId && requestCloseTab(pane.id, pane.activeTabId)}
                  onMissing={(tabId) => commitCloseTab(pane.id, tabId)}
                  onDirtyChange={handleDirtyChange}
                  onDraftChange={handleDraftChange}
                />
              );
            }}
          />
        </div>
      </div>

      <ConfirmationModal
        title={t('pages.server.files.modal.unsavedChanges.title', {})}
        opened={pendingClose !== null}
        onClose={() => setPendingClose(null)}
        onConfirmed={() => {
          if (pendingClose) commitCloseTab(pendingClose.paneId, pendingClose.tabId);
          setPendingClose(null);
        }}
        confirm={t('common.button.discard', {})}
      >
        {t('pages.server.files.modal.unsavedChanges.content', {}).md()}
      </ConfirmationModal>
    </>
  );
}
