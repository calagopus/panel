import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useIntersection, useMergedRef } from '@mantine/hooks';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import classNames from 'classnames';
import { join } from 'pathe';
import { type Ref, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createSearchParams, useNavigate, useSearchParams } from 'react-router';
import { FileOpenMode } from 'shared/src/registries/pages/server/files';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import copyFile from '@/api/server/files/copyFile.ts';
import Card from '@/elements/Card.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import Group from '@/elements/Group.tsx';
import SelectionArea from '@/elements/SelectionArea.tsx';
import Spinner from '@/elements/Spinner.tsx';
import Table, { TableData, TableHeaderProps, TableRow } from '@/elements/Table.tsx';
import Title from '@/elements/Title.tsx';
import { isOpenableFile } from '@/lib/files.ts';
import { serverDirectorySortingModeSchema } from '@/lib/schemas/server/files.ts';
import FileActionBar from '@/pages/server/files/FileActionBar.tsx';
import FileBreadcrumbs from '@/pages/server/files/FileBreadcrumbs.tsx';
import FileDiskUsageBar from '@/pages/server/files/FileDiskUsageBar.tsx';
import FileMassContextMenu from '@/pages/server/files/FileMassContextMenu.tsx';
import FileModals from '@/pages/server/files/FileModals.tsx';
import FileOperationsProgress from '@/pages/server/files/FileOperationsProgress.tsx';
import FileParentDirectoryRow from '@/pages/server/files/FileParentDirectoryRow.tsx';
import FileRow, { FileRowProps } from '@/pages/server/files/FileRow.tsx';
import FileSearchBanner from '@/pages/server/files/FileSearchBanner.tsx';
import FileSettings from '@/pages/server/files/FileSettings.tsx';
import FileToolbar from '@/pages/server/files/FileToolbar.tsx';
import FileUpload from '@/pages/server/files/FileUpload.tsx';
import { useKeyboardShortcuts } from '@/plugins/useKeyboardShortcuts.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useSelectionArea } from '@/plugins/useSelectionArea.ts';
import { FileManagerProvider } from '@/providers/FileManagerProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useFileManagerApi, useFileManagerStore } from '@/stores/fileManager.ts';
import { useServerStore } from '@/stores/server.ts';
import { fileManagerUndoScope, runLastUndoEntry } from '@/stores/undoHistory.ts';

type ServerFilesColumn = 'name' | 'size' | 'physical_size' | 'modified';

const columnOnClick = (
  name: ServerFilesColumn,
  sortMode: z.infer<typeof serverDirectorySortingModeSchema>,
  setSortMode: (mode: z.infer<typeof serverDirectorySortingModeSchema>) => void,
) => {
  return () => {
    if (sortMode === `${name}_asc`) {
      setSortMode(`${name}_desc`);
    } else {
      setSortMode(`${name}_asc`);
    }
  };
};

function ServerFilesColumnRightSection({ name }: { name: ServerFilesColumn }) {
  const sortMode = useFileManagerStore((state) => state.sortMode);
  const setSortMode = useFileManagerStore((state) => state.setSortMode);

  const isActive = sortMode.startsWith(name);
  const isAsc = sortMode.endsWith('asc');

  return (
    <div
      onClick={columnOnClick(name, sortMode, setSortMode)}
      className='inline-flex flex-col items-center self-center -mt-0.5'
    >
      <FontAwesomeIcon
        icon={faChevronUp}
        size='xs'
        className={classNames(
          '-mb-0.5',
          isActive && isAsc ? 'text-(--mantine-color-text)' : 'text-(--mantine-color-dimmed)',
        )}
      />
      <FontAwesomeIcon
        icon={faChevronDown}
        size='xs'
        className={isActive && !isAsc ? 'text-(--mantine-color-text)' : 'text-(--mantine-color-dimmed)'}
      />
    </div>
  );
}

function FileInfiniteScrollSentinel({ colSpan }: { colSpan: number }) {
  const store = useFileManagerApi();
  const hasNextPage = useFileManagerStore((state) => state.hasNextPage);
  const isFetchingNextPage = useFileManagerStore((state) => state.isFetchingNextPage);
  const { ref, entry } = useIntersection<HTMLTableRowElement>({ threshold: 0, rootMargin: '600px' });

  useEffect(() => {
    if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
      store.getState().fetchNextPage();
    }
  }, [entry?.isIntersecting, hasNextPage, isFetchingNextPage, store]);

  if (!hasNextPage) return null;

  return (
    <TableRow ref={ref}>
      <TableData colSpan={colSpan} className='py-3'>
        <div className='flex items-center justify-center'>
          <Spinner size={20} />
        </div>
      </TableData>
    </TableRow>
  );
}

const ESTIMATED_ROW_HEIGHT = 41;
const VIRTUALIZER_OVERSCAN = 15;

interface VirtualFileRowProps extends Omit<FileRowProps, 'dataIndex'> {
  innerRef: Ref<HTMLElement>;
  measureElement: (node: HTMLTableRowElement | null) => void;
  dataIndex: number;
}

function VirtualFileRow({ innerRef, measureElement, dataIndex, ...rowProps }: VirtualFileRowProps) {
  const mergedRef = useMergedRef<HTMLTableRowElement>(innerRef as Ref<HTMLTableRowElement>, measureElement);

  return <FileRow ref={mergedRef} dataIndex={dataIndex} {...rowProps} />;
}

function ServerFilesComponent() {
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
  const selectedFiles = useFileManagerStore((state) => state.selectedFiles);
  const actingFiles = useFileManagerStore((state) => state.actingFiles);
  const actingFilesSource = useFileManagerStore((state) => state.actingFilesSource);
  const browsingDirectory = useFileManagerStore((state) => state.browsingDirectory);
  const browsingBackup = useFileManagerStore((state) => state.browsingBackup);
  const searchInfo = useFileManagerStore((state) => state.searchInfo);
  const sortMode = useFileManagerStore((state) => state.sortMode);
  const clickOnce = useFileManagerStore((state) => state.clickOnce);
  const preferPhysicalSize = useFileManagerStore((state) => state.preferPhysicalSize);
  const { doSelectFiles, doOpenModal, setSortMode, resetEntries } = store.getState();

  const canCreate = useServerCan('files.create');
  const canUpdate = useServerCan('files.update');

  const { onSelectedStart, onSelected } = useSelectionArea({
    identify: (file) => file.name,
    getSelected: () => store.getState().selectedFiles.values(),
    setSelected: doSelectFiles,
  });

  const handleOpen = useCallback(
    (openMode: FileOpenMode) => {
      if (openMode.openable) {
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
      } else if (openMode.reason === 'tooLarge') {
        addToast(t('pages.server.files.toast.fileTooLargeToOpen', {}), 'warning');
      }
    },
    [server, navigate, setSearchParams, store],
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
            handleOpen(isOpenableFile(state.selectedFiles.values()[0], state));
          }
        },
      },
    ],
    deps: [handleOpen, canCreate, canUpdate],
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

  const virtualRows = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start - scrollMargin : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? rowVirtualizer.getTotalSize() - (virtualRows[virtualRows.length - 1].end - scrollMargin)
      : 0;

  return (
    <div className='h-fit relative'>
      <FileModals />
      <FileUpload />
      <FileActionBar />

      <Group justify='space-between' align='center' mb='md'>
        <Group>
          <Title order={1}>{t('pages.server.files.title', {})}</Title>

          <FileSettings />
        </Group>
        <Group>
          <FileOperationsProgress />
          <FileToolbar />
        </Group>
      </Group>

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
            fireEvents={false}
            className='h-full'
            disabled={actingFiles.size > 0}
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
                    <SelectionArea.Selectable key={virtualRow.key} item={entry}>
                      {(innerRef: Ref<HTMLElement>) => (
                        <VirtualFileRow
                          innerRef={innerRef}
                          measureElement={rowVirtualizer.measureElement}
                          dataIndex={virtualRow.index}
                          file={entry}
                          handleOpen={handleOpen}
                          openMassMenu={openMassMenu}
                          isSelected={selectedFiles.has(entry)}
                          isActing={actingFiles.has(entry) && actingFilesSource === browsingDirectory}
                          clickOnce={clickOnce}
                          preferPhysicalSize={preferPhysicalSize}
                        />
                      )}
                    </SelectionArea.Selectable>
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
