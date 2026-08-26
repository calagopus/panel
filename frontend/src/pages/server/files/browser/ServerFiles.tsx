import { faCode, faFolderOpen, faSearch } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { join } from 'pathe';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { createSearchParams, useNavigate, useSearchParams } from 'react-router';
import { FileOpenMode } from 'shared/src/registries/pages/server/files';
import { httpErrorToHuman } from '@/api/axios.ts';
import copyFile from '@/api/server/files/copyFile.ts';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Card from '@/elements/Card.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import Group from '@/elements/Group.tsx';
import SegmentedControl from '@/elements/SegmentedControl.tsx';
import SelectionArea from '@/elements/SelectionArea.tsx';
import Spinner from '@/elements/Spinner.tsx';
import Table, { TableData, TableHeaderProps, TableRow } from '@/elements/Table.tsx';
import Title from '@/elements/Title.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import { isOpenableFile } from '@/lib/files/files.ts';
import FileActionBar from '@/pages/server/files/browser/FileActionBar.tsx';
import FileDiskUsageBar from '@/pages/server/files/browser/FileDiskUsageBar.tsx';
import FileInfiniteScrollSentinel from '@/pages/server/files/browser/FileInfiniteScrollSentinel.tsx';
import FileMassContextMenu from '@/pages/server/files/browser/FileMassContextMenu.tsx';
import FileModals from '@/pages/server/files/browser/FileModals.tsx';
import FileOperationsProgress from '@/pages/server/files/browser/FileOperationsProgress.tsx';
import FileParentDirectoryRow from '@/pages/server/files/browser/FileParentDirectoryRow.tsx';
import FileSearchBanner from '@/pages/server/files/browser/FileSearchBanner.tsx';
import FileSettings from '@/pages/server/files/browser/FileSettings.tsx';
import FileToolbar from '@/pages/server/files/browser/FileToolbar.tsx';
import FileUpload from '@/pages/server/files/browser/FileUpload.tsx';
import SelectableFileRow from '@/pages/server/files/browser/SelectableFileRow.tsx';
import ServerFilesColumnRightSection, {
  columnOnClick,
  type ServerFilesColumn,
} from '@/pages/server/files/browser/ServerFilesColumnRightSection.tsx';
import FileBreadcrumbs from '@/pages/server/files/FileBreadcrumbs.tsx';
import { useFileBrowserQuickActions } from '@/pages/server/files/hooks/useFileBrowserQuickActions.tsx';
import { useKeyboardShortcuts } from '@/plugins/useKeyboardShortcuts.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useSelectionArea } from '@/plugins/useSelectionArea.ts';
import { FileManagerProvider } from '@/providers/FileManagerProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useFileManagerApi, useFileManagerStore } from '@/stores/fileManager.ts';
import { useServerStore } from '@/stores/server.ts';
import { fileManagerUndoScope, runLastUndoEntry } from '@/stores/undoHistory.ts';

const ESTIMATED_ROW_HEIGHT = 41;
const VIRTUALIZER_OVERSCAN = 15;

function FileBrowser() {
  const { t } = useTranslations();
  const server = useServerStore((state) => state.server);
  const { addToast } = useToast();
  const [_, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const typeAheadBuffer = useRef('');
  const typeAheadTimeout = useRef<ReturnType<typeof setTimeout>>(null);

  const store = useFileManagerApi();
  const isLoading = useFileManagerStore((state) => state.isLoading);
  const browsingEntries = useFileManagerStore((state) => state.browsingEntries);
  const browsingError = useFileManagerStore((state) => state.browsingError);
  const anyActing = useFileManagerStore((state) => state.actingFiles.size > 0);
  const browsingDirectory = useFileManagerStore((state) => state.browsingDirectory);
  const browsingBackup = useFileManagerStore((state) => state.browsingBackup);
  const searchInfo = useFileManagerStore((state) => state.searchInfo);
  const sortMode = useFileManagerStore((state) => state.sortMode);
  const clickOnce = useFileManagerStore((state) => state.clickOnce);
  const preferPhysicalSize = useFileManagerStore((state) => state.preferPhysicalSize);
  const { doSelectFiles, doOpenModal, setSortMode, resetEntries } = store.getState();

  const canCreate = useServerCan('files.create');
  const canUpdate = useServerCan('files.update');

  useFileBrowserQuickActions();

  const { onSelectedStart, onSelected } = useSelectionArea({
    identify: (file) => file.name,
    getSelected: () => store.getState().selectedFiles.values(),
    setSelected: doSelectFiles,
  });

  const handleOpen = useCallback(
    (openMode: FileOpenMode) => {
      if (!openMode.openable) return;

      if (typeAheadTimeout.current) clearTimeout(typeAheadTimeout.current);
      typeAheadBuffer.current = '';

      const fileManagerContext = store.getState();

      openMode.handleOpen({
        server,
        fileManagerContext,
        navigate,
        setSearchParams,

        handleDirectoryOpen: (path) => {
          setSearchParams({
            directory: join(fileManagerContext.browsingDirectory, path),
          });
        },
        handleFileOpen: (file, action, params) => {
          const searchParams = createSearchParams({
            directory: fileManagerContext.browsingDirectory,
            file,
            ...params,
          });

          navigate(`/server/${server.uuidShort}/files/${action}?${searchParams}`);
        },
      });
    },
    [server, navigate, setSearchParams, store],
  );

  const openFile = useCallback(
    (openMode: FileOpenMode) => {
      if (!openMode.openable && openMode.reason === 'tooLarge') {
        addToast(t('pages.server.files.toast.fileTooLargeToOpen', {}), 'warning');
        return;
      }
      handleOpen(openMode);
    },
    [handleOpen, addToast, t],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const state = store.getState();

      if (e.ctrlKey || e.metaKey || e.altKey || state.openModal !== null) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key.length !== 1) return;

      e.preventDefault();

      if (typeAheadTimeout.current) clearTimeout(typeAheadTimeout.current);
      typeAheadBuffer.current += e.key.toLowerCase();

      const match = state.browsingEntries.data.find((entry) =>
        entry.name.toLowerCase().startsWith(typeAheadBuffer.current),
      );

      if (match) {
        state.doSelectFiles([match]);
      }

      typeAheadTimeout.current = setTimeout(() => {
        typeAheadBuffer.current = '';
      }, 1000);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (typeAheadTimeout.current) clearTimeout(typeAheadTimeout.current);
    };
  }, [store]);

  const moveSelection = (direction: -1 | 1) => {
    const state = store.getState();
    if (state.selectedFiles.size === 0) return;

    const entries = state.browsingEntries.data;
    const indexByName = new Map(entries.map((entry, index) => [entry.name, index]));

    const selectedIndices = state.selectedFiles
      .keys()
      .map((file) => indexByName.get(file) ?? -1)
      .filter((index) => index !== -1);

    if (selectedIndices.length === 0) return;

    const nextFiles = selectedIndices.map((index) => entries[(index + direction + entries.length) % entries.length]);

    state.doSelectFiles(nextFiles);
  };

  useKeyboardShortcuts({
    shortcuts: [
      {
        id: 'files.selectAll',
        callback: () => doSelectFiles(store.getState().browsingEntries.data),
      },
      {
        id: 'files.search',
        callback: () => doOpenModal('search'),
      },
      {
        id: 'files.moveUpSelection',
        callback: () => moveSelection(-1),
      },
      {
        id: 'files.moveDownSelection',
        callback: () => moveSelection(1),
      },
      {
        id: 'files.moveUpDirectory',
        callback: () =>
          setSearchParams({
            directory: join(store.getState().browsingDirectory, '..'),
          }),
      },
      {
        id: 'files.duplicate',
        callback: () => {
          const state = store.getState();
          if (canCreate && state.selectedFiles.size === 1 && state.browsingWritableDirectory) {
            const file = state.selectedFiles.values()[0];

            copyFile(server.uuid, join(state.browsingDirectory, file.name), null)
              .then(() => {
                addToast(t('pages.server.files.toast.fileCopyingStarted', {}), 'success');
              })
              .catch((msg) => {
                addToast(httpErrorToHuman(msg), 'error');
              });
          }
        },
      },
      {
        id: 'files.rename',
        callback: () => {
          const state = store.getState();
          if (canUpdate && state.selectedFiles.size === 1 && state.browsingWritableDirectory) {
            doOpenModal('rename', [state.selectedFiles.values()[0]]);
          }
        },
      },
      {
        id: 'general.undo',
        callback: () => void runLastUndoEntry(fileManagerUndoScope(server.uuid)),
      },
      {
        key: 'Enter',
        callback: () => {
          const state = store.getState();
          if (state.selectedFiles.size === 1 && state.openModal === null) {
            openFile(isOpenableFile(state.selectedFiles.values()[0], state));
          }
        },
      },
    ],
    deps: [openFile, canCreate, canUpdate],
  });

  const columns = useMemo(() => {
    const sizeColumn: ServerFilesColumn = preferPhysicalSize ? 'physical_size' : 'size';
    const columns: TableHeaderProps[] = [
      { name: '' },
      {
        name: t('common.table.columns.name', {}),
        rightSection: <ServerFilesColumnRightSection name='name' />,
        onClick: columnOnClick('name', sortMode, setSortMode),
      },
      {
        name: t('common.table.columns.size', {}),
        rightSection: <ServerFilesColumnRightSection name={sizeColumn} />,
        onClick: columnOnClick(sizeColumn, sortMode, setSortMode),
      },
    ];

    if (window.innerWidth >= 768) {
      columns.push({
        name: t('pages.server.files.table.columns.modified', {}),
        rightSection: <ServerFilesColumnRightSection name='modified' />,
      });
    }

    columns.push({ name: '' });

    return columns;
  }, [t, sortMode, preferPhysicalSize]);

  const normalizedBrowsingDirectory = join('/', browsingDirectory);
  const backupRootDirectory = browsingBackup ? `/.backups/${browsingBackup.uuid}` : null;
  const showParentDirectoryRow =
    normalizedBrowsingDirectory !== '/' && normalizedBrowsingDirectory !== backupRootDirectory && !searchInfo;

  const tableAnchorRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    const updateScrollMargin = () => {
      if (tableAnchorRef.current) {
        setScrollMargin(tableAnchorRef.current.getBoundingClientRect().top + window.scrollY);
      }
    };

    updateScrollMargin();

    window.addEventListener('resize', updateScrollMargin);
    const resizeObserver = new ResizeObserver(updateScrollMargin);
    resizeObserver.observe(document.body);

    return () => {
      window.removeEventListener('resize', updateScrollMargin);
      resizeObserver.disconnect();
    };
  }, [browsingDirectory, searchInfo, browsingError, showParentDirectoryRow]);

  const rowVirtualizer = useWindowVirtualizer<HTMLTableRowElement>({
    count: browsingEntries.data.length,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: VIRTUALIZER_OVERSCAN,
    scrollMargin,
    getItemKey: (index) => browsingEntries.data[index]?.name ?? index,
  });

  const virtualRows = useSyncExternalStore(
    () => () => undefined,
    () => rowVirtualizer.getVirtualItems(),
  );
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start - scrollMargin : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? rowVirtualizer.getTotalSize() - (virtualRows[virtualRows.length - 1].end - scrollMargin)
      : 0;

  return (
    <div className='h-fit relative'>
      <FileDiskUsageBar />

      <Card mb='sm'>
        <FileBreadcrumbs path={browsingDirectory} />
      </Card>

      <FileSearchBanner resetEntries={resetEntries} />

      <FileMassContextMenu>
        {({ openMassMenu }) => (
          <SelectionArea
            onSelectedStart={onSelectedStart}
            onSelected={onSelected}
            deferSelection
            fireEvents={false}
            className='h-full'
            disabled={anyActing}
          >
            <div ref={tableAnchorRef}>
              <Table
                columns={columns}
                loading={isLoading}
                pagination={browsingEntries}
                error={browsingError}
                allowSelect={false}
              >
                {showParentDirectoryRow && <FileParentDirectoryRow />}

                {paddingTop > 0 && (
                  <TableRow>
                    <TableData colSpan={columns.length} style={{ height: paddingTop, padding: 0, border: 'none' }} />
                  </TableRow>
                )}

                {virtualRows.map((virtualRow) => {
                  const entry = browsingEntries.data[virtualRow.index];
                  if (!entry) return null;

                  return (
                    <SelectableFileRow
                      key={virtualRow.key}
                      measureElement={rowVirtualizer.measureElement}
                      dataIndex={virtualRow.index}
                      file={entry}
                      handleOpen={openFile}
                      openMassMenu={openMassMenu}
                      clickOnce={clickOnce}
                      preferPhysicalSize={preferPhysicalSize}
                    />
                  );
                })}

                {paddingBottom > 0 && (
                  <TableRow>
                    <TableData colSpan={columns.length} style={{ height: paddingBottom, padding: 0, border: 'none' }} />
                  </TableRow>
                )}

                {!searchInfo && <FileInfiniteScrollSentinel colSpan={columns.length} />}
              </Table>
            </div>
          </SelectionArea>
        )}
      </FileMassContextMenu>
    </div>
  );
}

type FileManagerView = 'files' | 'editor';
const FileTreeWorkspace = lazy(() => import('@/pages/server/files/workspace/FileTreeWorkspace.tsx'));
const FILE_MANAGER_VIEW_STORAGE_KEY = 'file_manager_view';
const fileTreeVisibilityStorageKey = (serverUuid: string) => `file_manager_tree_visible:${serverUuid}`;

const getStoredFileManagerView = (): FileManagerView =>
  localStorage.getItem(FILE_MANAGER_VIEW_STORAGE_KEY) === 'editor' ? 'editor' : 'files';

const getStoredFileTreeVisibility = (serverUuid: string) =>
  localStorage.getItem(fileTreeVisibilityStorageKey(serverUuid)) !== 'false';

function ServerFilesComponent() {
  const { t } = useTranslations();
  const serverUuid = useServerStore((state) => state.server.uuid);
  const doOpenModal = useFileManagerStore((state) => state.doOpenModal);
  const [view, setView] = useState<FileManagerView>(getStoredFileManagerView);
  const [fileTreeVisible, setFileTreeVisible] = useState(() => getStoredFileTreeVisibility(serverUuid));

  useEffect(() => setFileTreeVisible(getStoredFileTreeVisibility(serverUuid)), [serverUuid]);

  const changeView = (value: string) => {
    if (value !== 'files' && value !== 'editor') return;

    localStorage.setItem(FILE_MANAGER_VIEW_STORAGE_KEY, value);
    setView(value);
  };

  const toggleFileTree = () => {
    setFileTreeVisible((visible) => {
      localStorage.setItem(fileTreeVisibilityStorageKey(serverUuid), String(!visible));
      return !visible;
    });
  };

  return (
    <div data-file-manager-page className='flex w-full min-w-0 flex-col'>
      <FileModals />
      <FileUpload showOverlay={view === 'files'} />
      <FileActionBar />

      <Group justify='space-between' align='center' mb='md'>
        <Group>
          <Title order={1}>
            {t(view === 'editor' ? 'pages.server.files.view.editor' : 'pages.server.files.view.files', {})}
          </Title>
          <FileSettings />
        </Group>

        <Group>
          {view === 'editor' && (
            <Tooltip label={t('pages.server.files.tooltip.advancedSearch', {})}>
              <ActionIcon
                type='button'
                variant='subtle'
                color='gray'
                aria-label={t('pages.server.files.tooltip.advancedSearch', {})}
                onClick={() => doOpenModal('search')}
              >
                <FontAwesomeIcon icon={faSearch} />
              </ActionIcon>
            </Tooltip>
          )}

          <SegmentedControl
            value={view}
            onChange={changeView}
            data={[
              {
                value: 'files',
                label: (
                  <FontAwesomeIcon
                    icon={faFolderOpen}
                    title={t('pages.server.files.view.files', {})}
                    aria-label={t('pages.server.files.view.files', {})}
                    fixedWidth
                  />
                ),
              },
              {
                value: 'editor',
                label: (
                  <FontAwesomeIcon
                    icon={faCode}
                    title={t('pages.server.files.view.editor', {})}
                    aria-label={t('pages.server.files.view.editor', {})}
                    fixedWidth
                  />
                ),
              },
            ]}
          />

          <FileOperationsProgress />
          <FileToolbar />
        </Group>
      </Group>

      {view === 'files' ? (
        <FileBrowser />
      ) : (
        <Suspense
          fallback={
            <div className='flex justify-center py-16'>
              <Spinner size={48} />
            </div>
          }
        >
          <FileTreeWorkspace key={serverUuid} fileTreeVisible={fileTreeVisible} onToggleFileTree={toggleFileTree} />
        </Suspense>
      )}
    </div>
  );
}

export default function ServerFiles() {
  const { t } = useTranslations();

  return (
    <ServerContentContainer
      title={t('pages.server.files.title', {})}
      hideTitleComponent
      registry={window.extensionContext.extensionRegistry.pages.server.files.container}
    >
      <FileManagerProvider>
        <ServerFilesComponent />
      </FileManagerProvider>
    </ServerContentContainer>
  );
}
